import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import { Layer, Line, Stage } from 'react-konva';
import MapNodeShape from '@/components/MapNodeShape';
import { orderNodes } from '@/lib/order';
import { PALETTE } from '@/lib/palette';
import { projectNodes } from '@/lib/projection';
import { useProjectStore } from '@/store/projectStore';

interface Props {
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

/** 缩放范围。下限能看全大跨度路线，上限够看清单个贴纸细节 */
const MIN_SCALE = 0.3;
const MAX_SCALE = 4;

/** 每次滚轮/点按的缩放步进 */
const ZOOM_STEP = 1.15;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/**
 * 主画布（PRD F7）
 *
 * 视图变换（缩放/平移）和地理投影是**两层**，刻意分开：
 * - 投影层：projectNodes 把经纬度算成像素，永远按容器尺寸 fitExtent，结果固定
 * - 视图层：Stage 的 scale / position，只影响「怎么看」，不影响「在哪」
 * 这样无论用户怎么拖怎么缩，节点间的真实空间关系都不会变，
 * 也保证 P0-5 导出时可以忽略当前视图状态、直接按原始投影出图（AC-13）。
 */
export default function MapCanvas({ selectedNodeId, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Konva 的 Stage 必须拿到具体像素宽高，不吃 CSS 百分比，所以要监听容器尺寸
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const project = useProjectStore((s) => s.project);

  const ordered = useMemo(
    () => orderNodes(project.nodes, project.route_order),
    [project.nodes, project.route_order],
  );

  // 经纬度 → 像素，每次渲染现算，不入库（PRD 决策 2）
  const points = useMemo(
    () => (size.width > 0 && size.height > 0 ? projectNodes(ordered, size) : []),
    [ordered, size],
  );

  const pointById = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);

  // Konva Line 要的是扁平坐标数组 [x1, y1, x2, y2, ...]
  const linePoints = useMemo(() => {
    const flat: number[] = [];
    for (const node of ordered) {
      const p = pointById.get(node.id);
      if (p) {
        flat.push(p.x, p.y);
      }
    }
    return flat;
  }, [ordered, pointById]);

  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  /** 以画布中心为锚点缩放，用于底部的 +/− 按钮 */
  const zoomByStep = useCallback(
    (direction: 1 | -1) => {
      const center = { x: size.width / 2, y: size.height / 2 };
      setScale((old) => {
        const next = clampScale(direction === 1 ? old * ZOOM_STEP : old / ZOOM_STEP);
        setPosition((oldPos) => {
          // 保持画布中心对应的内容不动
          const contentPoint = {
            x: (center.x - oldPos.x) / old,
            y: (center.y - oldPos.y) / old,
          };
          return {
            x: center.x - contentPoint.x * next,
            y: center.y - contentPoint.y * next,
          };
        });
        return next;
      });
    },
    [size.width, size.height],
  );

  /** 滚轮缩放，以鼠标位置为锚点 —— 缩放时光标下的内容不跑，这是地图类交互的基本预期 */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      if (!stage) {
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      const oldScale = scale;
      const contentPoint = {
        x: (pointer.x - position.x) / oldScale,
        y: (pointer.y - position.y) / oldScale,
      };
      const next = clampScale(e.evt.deltaY < 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP);
      setScale(next);
      setPosition({
        x: pointer.x - contentPoint.x * next,
        y: pointer.y - contentPoint.y * next,
      });
    },
    [scale, position],
  );

  const isDefaultView = scale === 1 && position.x === 0 && position.y === 0;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-wash">
      {ordered.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-inkbrown/60">
          还没有地点，先在左边搜索添加你的第一个地点吧
        </div>
      ) : null}

      {size.width > 0 && size.height > 0 ? (
        <Stage
          width={size.width}
          height={size.height}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          draggable
          onWheel={handleWheel}
          onDragEnd={(e) => {
            // 只处理 Stage 自身的拖拽，节点上的拖拽事件不该改视图
            if (e.target === e.target.getStage()) {
              setPosition({ x: e.target.x(), y: e.target.y() });
            }
          }}
          onClick={(e) => {
            // 点空白处取消选中
            if (e.target === e.target.getStage()) {
              onSelectNode(null);
            }
          }}
        >
          <Layer>
            {/* 路线连线：F6.3 要求虚线、不生硬 */}
            {linePoints.length >= 4 ? (
              <Line
                points={linePoints}
                stroke={PALETTE.softbrown}
                strokeWidth={2}
                dash={[10, 8]}
                lineCap="round"
                lineJoin="round"
                tension={0.25}
              />
            ) : null}

            {ordered.map((node, index) => {
              const p = pointById.get(node.id);
              if (!p) {
                return null;
              }
              return (
                <MapNodeShape
                  key={node.id}
                  node={node}
                  x={p.x}
                  y={p.y}
                  index={index}
                  selected={selectedNodeId === node.id}
                  onSelect={onSelectNode}
                />
              );
            })}
          </Layer>
        </Stage>
      ) : null}

      {/* 缩放控件 */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border border-softbrown/30 bg-cream/90 px-2 py-1.5 shadow-sm backdrop-blur">
        <button
          type="button"
          aria-label="缩小"
          disabled={scale <= MIN_SCALE}
          onClick={() => zoomByStep(-1)}
          className="h-7 w-7 rounded text-lg leading-none text-inkbrown transition hover:bg-wash disabled:cursor-not-allowed disabled:opacity-30"
        >
          −
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-inkbrown/70">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          aria-label="放大"
          disabled={scale >= MAX_SCALE}
          onClick={() => zoomByStep(1)}
          className="h-7 w-7 rounded text-lg leading-none text-inkbrown transition hover:bg-wash disabled:cursor-not-allowed disabled:opacity-30"
        >
          +
        </button>
        <span className="mx-1 h-4 w-px bg-softbrown/30" />
        <button
          type="button"
          disabled={isDefaultView}
          onClick={resetView}
          className="rounded px-2 py-1 text-xs text-inkbrown transition hover:bg-wash disabled:cursor-not-allowed disabled:opacity-30"
        >
          适应画布
        </button>
      </div>

      {ordered.length > 0 ? (
        <p className="pointer-events-none absolute bottom-5 left-4 text-xs text-inkbrown/30">
          滚轮缩放 · 拖拽平移
        </p>
      ) : null}
    </div>
  );
}
