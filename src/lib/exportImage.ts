import Konva from 'konva';
import { ICON_LIBRARY, iconToDataUrl } from '@/lib/iconLibrary';
import {
  DOT_RADIUS,
  LABEL_FONT_SIZE,
  LABEL_OFFSET,
  LABEL_WIDTH,
  STICKER_GAP,
  STICKER_SIZE,
  computeInsets,
} from '@/lib/nodeVisual';
import { PALETTE } from '@/lib/palette';
import { projectNodes } from '@/lib/projection';
import { cutoutWhiteBackground } from '@/lib/stickerCutout';
import type { NodeAssets } from '@/store/assetStore';
import type { ExportRatio, TravelNode } from '@/types/project';

/**
 * 导出成图（PRD F8）
 *
 * 最关键的一条是 F8.2：**画布内容绝不做几何拉伸，只靠补白凑目标比例**。
 * 实现上的保证有两层：
 *   1) 节点位置依然由 projectNodes 算，而 fitExtent 是**等比**缩放 + 居中，
 *      横竖比例不同只会改变整体缩放倍数，不会改变节点之间的方向和相对距离（AC-13）。
 *   2) 三种比例只改「画布多大、内容区多高」，从不改 x/y 的缩放比。
 *
 * 另一条是导出**完全无视屏幕上的缩放和平移状态**。用户放大到 300% 去看某个贴纸，
 * 再点导出，出来的图和 100% 时一模一样 —— 视图状态是「怎么看」，不是「是什么」。
 *
 * 技术选型：没有用 PRD 决策 7 里提的 html-to-image / html2canvas，改为
 * 用 Konva 在离屏重新画一遍。原因是画布本身就是 Konva 渲染的，
 * 截 DOM 反而要处理 canvas 元素嵌套、字体、devicePixelRatio 一堆问题；
 * 直接用同一套绘制逻辑重画，产出更可控，也能针对导出单独调排版（比如放大字号）。
 * 这点与 PRD 决策 7 的措辞有出入，已在交付说明中报备。
 */

/** 各比例的基础画布尺寸（CSS 像素），实际输出再乘 pixelRatio */
const RATIO_SIZES: Record<ExportRatio, { width: number; height: number }> = {
  '3:4': { width: 900, height: 1200 },
  '1:1': { width: 1080, height: 1080 },
  '4:3': { width: 1200, height: 900 },
};

/** 导出图里节点整体放大的倍数，让贴纸在大画布上不至于显得太小 */
const NODE_SCALE = 1.25;

/** 页边距 */
const MARGIN = 48;

/** 顶部标题区高度 */
const HEADER_HEIGHT = 150;

/** 底部装饰区高度 */
const FOOTER_HEIGHT = 96;

export interface ExportInput {
  /** 已按 route_order 排好序的节点 */
  nodes: readonly TravelNode[];
  /** 会话内的图片资产 */
  assets: Readonly<Record<string, NodeAssets>>;
  /** 标题（用户可在导出前改，F8.3） */
  title: string;
  dateRangeText: string;
  ratio: ExportRatio;
  /** 2 或 3，对应 F8.4 的 2x / 3x 高清 */
  pixelRatio: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

/** 预加载所有节点的贴纸。加载失败的节点退回文字形态，不让一张坏图毁掉整次导出 */
async function preloadStickers(
  nodes: readonly TravelNode[],
  assets: Readonly<Record<string, NodeAssets>>,
): Promise<Map<string, HTMLImageElement>> {
  const result = new Map<string, HTMLImageElement>();
  await Promise.all(
    nodes.map(async (node) => {
      const url = assets[node.id]?.icon;
      if (url === undefined) {
        return;
      }
      try {
        const cut = await cutoutWhiteBackground(url);
        result.set(node.id, await loadImage(cut));
      } catch {
        // 忽略：这个节点导出成文字节点
      }
    }),
  );
  return result;
}

export async function renderMapToDataUrl(input: ExportInput): Promise<string> {
  const { width, height } = RATIO_SIZES[input.ratio];

  const stickers = await preloadStickers(input.nodes, input.assets);

  // 指南针装饰（附录 A.5）。用图标库里现成的，风格与节点图标一致
  const compassIcon = ICON_LIBRARY.find((i) => i.id === 'compass');
  const compass = compassIcon ? await loadImage(iconToDataUrl(compassIcon)).catch(() => null) : null;

  // 离屏容器：放在视口外，用完立刻销毁
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  document.body.appendChild(container);

  const stage = new Konva.Stage({ container, width, height });
  const layer = new Konva.Layer();
  stage.add(layer);

  try {
    // —— 背景（F7.3 纸张底色）——
    layer.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: PALETTE.wash }));

    // 细边框，让成图有「一张卡片」的完整感
    layer.add(
      new Konva.Rect({
        x: MARGIN / 2,
        y: MARGIN / 2,
        width: width - MARGIN,
        height: height - MARGIN,
        stroke: PALETTE.softbrown,
        strokeWidth: 1.5,
        opacity: 0.35,
        cornerRadius: 8,
      }),
    );

    // —— 顶部补白区：标题 + 日期（F8.3）——
    layer.add(
      new Konva.Text({
        x: MARGIN,
        y: MARGIN + 12,
        width: width - MARGIN * 2,
        align: 'center',
        text: input.title,
        fontSize: 40,
        fontStyle: 'bold',
        fontFamily: 'PingFang SC, system-ui, sans-serif',
        fill: PALETTE.inkbrown,
      }),
    );
    layer.add(
      new Konva.Text({
        x: MARGIN,
        y: MARGIN + 68,
        width: width - MARGIN * 2,
        align: 'center',
        text: input.dateRangeText,
        fontSize: 20,
        fontFamily: 'PingFang SC, system-ui, sans-serif',
        fill: PALETTE.softbrown,
      }),
    );
    // 标题下的小分隔线
    layer.add(
      new Konva.Line({
        points: [width / 2 - 40, MARGIN + 104, width / 2 + 40, MARGIN + 104],
        stroke: PALETTE.terracotta,
        strokeWidth: 2,
        lineCap: 'round',
      }),
    );

    // —— 内容区：地图本体 ——
    const contentTop = HEADER_HEIGHT;
    const contentHeight = height - HEADER_HEIGHT - FOOTER_HEIGHT;
    const contentWidth = width;

    // 节点位置照常由投影算，等比、居中，绝不拉伸（F8.2 / AC-13）
    const points = projectNodes(
      input.nodes,
      { width: contentWidth, height: contentHeight },
      computeInsets(NODE_SCALE),
    );
    const pointById = new Map(points.map((p) => [p.id, p]));

    // 路线连线（F6.3）
    const flat: number[] = [];
    for (const node of input.nodes) {
      const p = pointById.get(node.id);
      if (p) {
        flat.push(p.x, p.y + contentTop);
      }
    }
    if (flat.length >= 4) {
      layer.add(
        new Konva.Line({
          points: flat,
          stroke: PALETTE.softbrown,
          strokeWidth: 2.5,
          dash: [12, 9],
          lineCap: 'round',
          lineJoin: 'round',
          tension: 0.25,
        }),
      );
    }

    // 节点：与屏幕上完全相同的三层结构（贴纸 / 锚点 / 标签）
    const dotR = DOT_RADIUS * NODE_SCALE;
    const gap = STICKER_GAP * NODE_SCALE;
    const labelW = LABEL_WIDTH * NODE_SCALE;
    const labelSize = LABEL_FONT_SIZE * NODE_SCALE;

    input.nodes.forEach((node, index) => {
      const p = pointById.get(node.id);
      if (!p) {
        return;
      }
      const cx = p.x;
      const cy = p.y + contentTop;
      const sticker = stickers.get(node.id);

      if (sticker) {
        const ratio = sticker.width / sticker.height;
        const w = ratio >= 1 ? STICKER_SIZE * NODE_SCALE : STICKER_SIZE * NODE_SCALE * ratio;
        const h = ratio >= 1 ? (STICKER_SIZE * NODE_SCALE) / ratio : STICKER_SIZE * NODE_SCALE;
        layer.add(
          new Konva.Image({
            image: sticker,
            x: cx - w / 2,
            y: cy - (dotR + gap + h),
            width: w,
            height: h,
          }),
        );
      }

      layer.add(
        new Konva.Circle({
          x: cx,
          y: cy,
          radius: dotR,
          fill: index === 0 ? PALETTE.coral : PALETTE.terracotta,
          stroke: PALETTE.cream,
          strokeWidth: 2 * NODE_SCALE,
        }),
      );

      if (!sticker) {
        layer.add(
          new Konva.Text({
            x: cx - dotR,
            y: cy - labelSize * 0.4,
            width: dotR * 2,
            align: 'center',
            text: String(index + 1),
            fontSize: 11 * NODE_SCALE,
            fontStyle: 'bold',
            fill: PALETTE.cream,
          }),
        );
      }

      layer.add(
        new Konva.Text({
          x: cx - labelW / 2,
          y: cy + dotR + LABEL_OFFSET * NODE_SCALE,
          width: labelW,
          align: 'center',
          text: node.poi_name,
          fontSize: labelSize,
          fontFamily: 'PingFang SC, system-ui, sans-serif',
          fill: PALETTE.inkbrown,
        }),
      );
    });

    // —— 底部补白区：指南针 + 地点数（F8.3 装饰元素）——
    const footerY = height - FOOTER_HEIGHT;
    if (compass) {
      layer.add(
        new Konva.Image({
          image: compass,
          x: width / 2 - 22,
          y: footerY + 6,
          width: 44,
          height: 44,
          opacity: 0.75,
        }),
      );
    }
    layer.add(
      new Konva.Text({
        x: MARGIN,
        y: footerY + 56,
        width: width - MARGIN * 2,
        align: 'center',
        text: `共 ${input.nodes.length} 个地点`,
        fontSize: 16,
        fontFamily: 'PingFang SC, system-ui, sans-serif',
        fill: PALETTE.softbrown,
      }),
    );

    layer.draw();
    return stage.toDataURL({ pixelRatio: input.pixelRatio, mimeType: 'image/png' });
  } finally {
    stage.destroy();
    container.remove();
  }
}

/** 导出图的像素尺寸，用于界面上提示用户 */
export function getOutputSize(ratio: ExportRatio, pixelRatio: number): { w: number; h: number } {
  const base = RATIO_SIZES[ratio];
  return { w: base.width * pixelRatio, h: base.height * pixelRatio };
}
