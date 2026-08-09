import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Layer, Line, Stage, Text } from 'react-konva';
import { orderNodes } from '@/lib/order';
import { PALETTE } from '@/lib/palette';
import { projectNodes } from '@/lib/projection';
import { useProjectStore } from '@/store/projectStore';

/**
 * 主画布（PRD F7）
 *
 * 为什么是 Konva 而不是 SVG/DOM：附录 B.2 定的。节点后续要拖拽、要分图层、
 * 还要整张导出成位图，Konva 在这三件事上比手写 canvas 省太多。这里不做替换。
 *
 * P0-1 只证明「数据 → 渲染」这条链路通：节点画成圆点 + 名字，连线画成虚线。
 * 水彩贴纸、手绘线、纸纹底这些视觉留到 P0-4 与 P1 打磨阶段。
 */
export default function MapCanvas() {
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
          还没有地点，先添加你的第一个地点吧
        </div>
      ) : null}

      {size.width > 0 && size.height > 0 ? (
        <Stage width={size.width} height={size.height}>
          <Layer>
            {/* 路线连线：F6.3 要求虚线、不生硬，先用虚线 + 轻微张力，曲线细化留到打磨阶段 */}
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

            {/* 节点：P0-1 用最朴素的圆点占位 */}
            {ordered.map((node, index) => {
              const p = pointById.get(node.id);
              if (!p) {
                return null;
              }
              return (
                <Circle
                  key={node.id}
                  x={p.x}
                  y={p.y}
                  radius={14}
                  fill={index === 0 ? PALETTE.coral : PALETTE.terracotta}
                  stroke={PALETTE.cream}
                  strokeWidth={3}
                />
              );
            })}

            {/* 节点标签：第几站 + POI 名称 */}
            {ordered.map((node, index) => {
              const p = pointById.get(node.id);
              if (!p) {
                return null;
              }
              return (
                <Text
                  key={`label-${node.id}`}
                  x={p.x - 60}
                  y={p.y + 20}
                  width={120}
                  align="center"
                  text={`${index + 1}. ${node.poi_name}`}
                  fontSize={14}
                  fontFamily="PingFang SC, system-ui, sans-serif"
                  fill={PALETTE.inkbrown}
                />
              );
            })}
          </Layer>
        </Stage>
      ) : null}
    </div>
  );
}
