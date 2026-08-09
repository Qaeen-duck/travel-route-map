/**
 * 附录 A.1 色板的 JS 侧副本。
 * 为什么要有这份重复：Konva 画在 canvas 上，吃不到 Tailwind 的 class，只能传具体色值。
 * 所以 CSS 变量管 DOM、这份常量管画布，两边值必须一致，改色时两处一起改。
 */
export const PALETTE = {
  terracotta: '#C97A5E',
  sage: '#87A96B',
  cream: '#F5E6D3',
  skyblue: '#A8C5D6',
  mustard: '#D4A94A',
  softbrown: '#8B6F47',
  inkbrown: '#5A4A3A',
  wash: '#F9F3E9',
  coral: '#E89B7A',
} as const;

export type PaletteKey = keyof typeof PALETTE;
