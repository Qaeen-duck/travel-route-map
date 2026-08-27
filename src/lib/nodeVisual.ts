import type { CanvasInsets } from '@/lib/projection';

/**
 * 节点视觉尺寸 —— 屏幕画布和导出图共用的单一真源。
 *
 * 为什么必须共享：这些数字同时决定两件事
 *   1) MapNodeShape 画贴纸/锚点/标签的位置
 *   2) projectNodes 需要留出多少边距，才不会让贴纸被画布边缘切掉
 * 之前这两处各写各的，结果屏幕上贴顶端的节点贴纸被截断。
 * 导出图是另一套尺寸，如果再各写一遍，同样的 bug 一定会重演，所以收敛到这里。
 */

/** 路线锚点圆半径。这个点才是真实经纬度所在的位置 */
export const DOT_RADIUS = 9;

/** 贴纸显示边长 */
export const STICKER_SIZE = 96;

/** 贴纸底边与锚点之间的空隙 */
export const STICKER_GAP = 10;

/** 标签文本框宽度（居中对齐，实际占位是左右各一半） */
export const LABEL_WIDTH = 140;

/** 标签字号 */
export const LABEL_FONT_SIZE = 14;

/** 标签顶边与锚点的距离 */
export const LABEL_OFFSET = 6;

/**
 * 根据上面的尺寸算出投影需要的四边留白。
 *
 * scale 用于导出图：导出画布比屏幕大，节点也要按比例放大，留白跟着放大。
 * 额外的呼吸空间（+30 / +20）是为了让最外侧的节点不至于贴着边缘，纯观感。
 */
export function computeInsets(scale = 1): CanvasInsets {
  const top = (DOT_RADIUS + STICKER_GAP + STICKER_SIZE) * scale + 30 * scale;
  const bottom = (DOT_RADIUS + LABEL_OFFSET + LABEL_FONT_SIZE * 1.6) * scale + 20 * scale;
  const side = (LABEL_WIDTH / 2) * scale + 20 * scale;
  return { top, right: side, bottom, left: side };
}
