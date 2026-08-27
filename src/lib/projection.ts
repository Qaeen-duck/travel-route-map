import { geoMercator, type GeoGeometryObjects } from 'd3-geo';
import type { TravelNode } from '@/types/project';
import { computeInsets } from '@/lib/nodeVisual';

/**
 * 经纬度 → 画布像素坐标（PRD 决策 2 / F7.1）
 *
 * 为什么用 d3-geo 的 geoMercator：
 * 1) PRD F7.1 建议 Web Mercator，这是它的标准实现，和未来 L2 真实地形底图
 *    （地图瓦片几乎都是 Web Mercator）天然对齐，换背景时节点不用重算。
 * 2) 可以只 import 投影模块，不像 Leaflet/Mapbox 会拖进整套地图引擎和瓦片请求。
 *    PRD 决策 5 明确「不使用地图瓦片渲染能力」。
 * 3) fitExtent 一行搞定 F7.2「按节点自然边界决定画布比例」，且是等比缩放 ——
 *    这是 AC-13 三种比例导出不失真的底层保证。
 *
 * 纯函数：不读写 store、无副作用。像素坐标永远是渲染期的派生值，不进持久化数据。
 */

export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * 四边留白。
 *
 * 必须四边分开给，不能像早期那样用一个统一的 padding —— 因为节点不是对称的：
 * 贴纸浮在锚点**上方** 115px，标签在锚点**下方**，名字横向能铺到 140px 宽。
 * 用统一 padding 的结果就是贴在画布顶端的节点，贴纸被切掉一半。
 */
export interface CanvasInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ProjectedPoint {
  id: string;
  x: number;
  y: number;
}
/**
 * 默认留白，由 lib/nodeVisual.ts 的节点尺寸算出来。
 * 不在这里写死数字：贴纸多高、标签多宽只有 nodeVisual 知道，
 * 两边各写一份迟早会不同步（早期就因此出现过贴纸被画布顶边切掉的问题）。
 */
export const DEFAULT_INSETS: CanvasInsets = computeInsets(1);


/** 只有一个节点（或所有节点几乎重合）时没有边界可 fit，用这个固定缩放兜底 */
const SINGLE_NODE_SCALE = 20000;

/** 判定「几乎重合」的经纬度阈值，约等于 0.1 米量级 */
const DEGENERATE_EPS = 1e-6;

/** 两个锚点在画布上至少要拉开这么多像素 */
const MIN_NODE_GAP_PX = 46;

/**
 * 重叠节点微偏移（PRD 状态清单「极端数据 · 节点重叠」）
 * 逐个落点，发现和已落点距离小于阈值就沿圆周往外挪，角度用黄金角（约 137.5°）递增，
 * 这样连续几个重叠点会散成一朵花而不是排成一条线。纯视觉补偿，不改真实 lat/lng。
 */
function spreadOverlaps(points: readonly ProjectedPoint[]): ProjectedPoint[] {
  const GOLDEN_ANGLE = 2.399963;
  const placed: ProjectedPoint[] = [];

  for (const point of points) {
    let x = point.x;
    let y = point.y;
    let attempt = 0;

    while (attempt < 12) {
      const tooClose = placed.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_NODE_GAP_PX);
      if (!tooClose) {
        break;
      }
      attempt += 1;
      const angle = GOLDEN_ANGLE * attempt;
      const radius = MIN_NODE_GAP_PX * (0.7 + attempt * 0.25);
      x = point.x + Math.cos(angle) * radius;
      y = point.y + Math.sin(angle) * radius;
    }

    placed.push({ id: point.id, x, y });
  }

  return placed;
}

export function projectNodes(
  nodes: readonly TravelNode[],
  size: CanvasSize,
  insets: CanvasInsets = DEFAULT_INSETS,
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
    projection
      .center([first.lng, first.lat])
      .scale(SINGLE_NODE_SCALE)
      .translate([size.width / 2, size.height / 2]);
  } else {
    // 容器太小时留白会把可用区域压成负数，这里兜一下底，至少留 1px
    const right = Math.max(insets.left + 1, size.width - insets.right);
    const bottom = Math.max(insets.top + 1, size.height - insets.bottom);
    const multiPoint: GeoGeometryObjects = {
      type: 'MultiPoint',
      coordinates: nodes.map((n) => [n.lng, n.lat]),
    };
    projection.fitExtent(
      [
        [insets.left, insets.top],
        [right, bottom],
      ],
      multiPoint,
    );
  }

  const points: ProjectedPoint[] = [];
  for (const node of nodes) {
    const xy = projection([node.lng, node.lat]);
    // 投影可能返回 null（点落在投影可视范围外，例如极区），这类节点先跳过不渲染
    if (!xy) {
      continue;
    }
    points.push({ id: node.id, x: xy[0], y: xy[1] });
  }

  return spreadOverlaps(points);
}
