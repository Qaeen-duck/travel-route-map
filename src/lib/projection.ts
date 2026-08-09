import { geoMercator, type GeoGeometryObjects } from 'd3-geo';
import type { TravelNode } from '@/types/project';

/**
 * 经纬度 → 画布像素坐标（PRD 决策 2 / F7.1）
 *
 * 为什么用 d3-geo 的 geoMercator：
 * 1) PRD F7.1 建议 Web Mercator，这是它的标准实现，和未来 L2 真实地形底图
 *    （地图瓦片几乎都是 Web Mercator）天然对齐，换背景时节点不用重算。
 * 2) d3-geo 可以只 import 投影模块，不像 Leaflet/Mapbox 会拖进一整套地图引擎和瓦片请求。
 *    PRD 决策 5 明确「不使用地图瓦片渲染能力」，这里保持干净。
 * 3) fitExtent 一行搞定 PRD F7.2「按本次旅行节点的自然边界决定画布比例」，
 *    自动算缩放和平移，且等比缩放 —— 不会拉伸，这是 AC-13 不失真的底层保证。
 *
 * 本函数是纯函数：不读 store、不写 store、无副作用。
 * 像素坐标永远是渲染期的派生值，绝不进持久化数据。
 */

export interface CanvasSize {
  width: number;
  height: number;
}

export interface ProjectedPoint {
  id: string;
  x: number;
  y: number;
}

/** 画布内边距，留给节点标签和后续装饰边框 */
const DEFAULT_PADDING = 72;

/** 只有一个节点（或所有节点几乎重合）时没有边界可 fit，用这个固定缩放兜底 */
const SINGLE_NODE_SCALE = 20000;

/** 判定「几乎重合」的经纬度阈值，约等于 0.1 米量级 */
const DEGENERATE_EPS = 1e-6;

export function projectNodes(
  nodes: readonly TravelNode[],
  size: CanvasSize,
  padding: number = DEFAULT_PADDING,
): ProjectedPoint[] {
  const first = nodes[0];
  if (!first) {
    return [];
  }

  const projection = geoMercator();

  const lngs = nodes.map((n) => n.lng);
  const lats = nodes.map((n) => n.lat);
  const spanLng = Math.max(...lngs) - Math.min(...lngs);
  const spanLat = Math.max(...lats) - Math.min(...lats);
  const isDegenerate = nodes.length === 1 || (spanLng < DEGENERATE_EPS && spanLat < DEGENERATE_EPS);

  if (isDegenerate) {
    // 单节点态（PRD 状态清单）：不能 fitExtent，否则 d3 会算出 Infinity 缩放
    projection
      .center([first.lng, first.lat])
      .scale(SINGLE_NODE_SCALE)
      .translate([size.width / 2, size.height / 2]);
  } else {
    const multiPoint: GeoGeometryObjects = {
      type: 'MultiPoint',
      coordinates: nodes.map((n) => [n.lng, n.lat]),
    };
    projection.fitExtent(
      [
        [padding, padding],
        [Math.max(padding + 1, size.width - padding), Math.max(padding + 1, size.height - padding)],
      ],
      multiPoint,
    );
  }

  const points: ProjectedPoint[] = [];
  for (const node of nodes) {
    const xy = projection([node.lng, node.lat]);
    // 投影可能返回 null（点落在投影可视范围外，例如极区）；这类节点先跳过不渲染，
    // 后续阶段再决定是提示用户还是裁切。
    if (!xy) {
      continue;
    }
    points.push({ id: node.id, x: xy[0], y: xy[1] });
  }
  return points;
}
