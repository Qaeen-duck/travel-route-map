import { useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * 主画布（PRD F7）
 *
 * 为什么是 Konva 而不是 SVG/DOM：附录 B.2 定的。节点要拖拽、要分图层、
 * 还要整张导出成位图，Konva 在这三件事上比手写 canvas 省太多。
 */
export default function MapCanvas({ selectedNodeId, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

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

  return (
    <div ref={containerRef} className="relative h-full w-full bg-wash">
      {ordered.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-inkbrown/60">
          还没有地点，先在左边搜索添加你的第一个地点吧
        </div>
      ) : null}

      {size.width > 0 && size.height > 0 ? (
        <Stage
          width={size.width}
          height={size.height}
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
    </div>
  );
}
