import { PALETTE } from '@/lib/palette';

/**
 * 手段 H1 · 色板参考图（PRD F3.7）
 *
 * 生成一张「温暖水彩组」九色色卡的 PNG，作为图生图的第二张输入图，
 * 让模型把输出色调拉向附录 A.1 定义的色域，压制「晴天/夜景/室内」照片带来的色彩漂移。
 *
 * 为什么在浏览器里现画而不是放一张静态图片文件：
 * 色值的唯一真源是 lib/palette.ts，现画能保证色卡永远和主题色一致 ——
 * 将来改一个 Hex，色卡自动跟着变，不会出现「代码改了、参考图还是老色」的不一致。
 * 而且省掉一个二进制资源文件，仓库更干净。
 *
 * 尺寸取 768x768：API 建议输入图边长在 384-2048 之间，取中间值足够表达色块。
 */

const CARD_SIZE = 768;
const GRID = 3; // 9 个颜色排成 3x3

let cached: string | null = null;

export function getPaletteRefDataUrl(): string {
  if (cached !== null) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('当前浏览器不支持绘制色板参考图');
  }

  const colors = [
    PALETTE.terracotta,
    PALETTE.sage,
    PALETTE.cream,
    PALETTE.skyblue,
    PALETTE.mustard,
    PALETTE.softbrown,
    PALETTE.inkbrown,
    PALETTE.wash,
    PALETTE.coral,
  ];

  const cell = CARD_SIZE / GRID;
  colors.forEach((color, index) => {
    const col = index % GRID;
    const row = Math.floor(index / GRID);
    ctx.fillStyle = color;
    ctx.fillRect(col * cell, row * cell, cell, cell);
  });

  cached = canvas.toDataURL('image/png');
  return cached;
}
