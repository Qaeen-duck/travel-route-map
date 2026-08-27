import { PALETTE } from '@/lib/palette';

/**
 * 内置图标库（PRD F4）
 *
 * 定位（PRD 假设 3）：MVP 阶段的**占位素材**，不是最终美术资源。
 *
 * 为什么自己写 SVG 而不用 feather / lucide 这类开源图标库：
 * 那些是「等宽线性描边」风格，正好踩在附录 A.2 的反例上（矢量扁平化、几何硬边），
 * 和 AI 生成的水彩贴纸摆在同一张地图上会非常割裂。
 * 自己画虽然到不了水彩质感，但能保证两件事：
 *   1) 全部只用附录 A.1 的九个色值，色系跟整张图统一
 *   2) 实心色块 + 圆润轮廓，比线性图标更接近贴纸的视觉重量
 *
 * 实际用途还有一个（也是这轮加它的主因）：
 * 有了免费图标，就能摆出十几个节点的完整路线去调 P0-5 的导出布局，
 * 不必为了看整图效果反复消耗付费的生成额度。
 */

export type IconCategory = '自然' | '美食' | '交通' | '地标' | '其他';

export const ICON_CATEGORIES: readonly IconCategory[] = ['自然', '美食', '交通', '地标', '其他'];

export interface LibraryIcon {
  id: string;
  name: string;
  category: IconCategory;
  /** SVG 内容（不含最外层 svg 标签，viewBox 统一 0 0 100 100） */
  body: string;
}

const C = PALETTE;

export const ICON_LIBRARY: readonly LibraryIcon[] = [
  // —— 自然 ——
  {
    id: 'mountain',
    name: '山',
    category: '自然',
    body: `<path d="M8 78 L38 30 L56 56 L68 40 L92 78 Z" fill="${C.sage}"/><path d="M38 30 L51 50 L25 50 Z" fill="${C.cream}"/>`,
  },
  {
    id: 'tree',
    name: '树',
    category: '自然',
    body: `<rect x="46" y="58" width="8" height="26" rx="3" fill="${C.softbrown}"/><circle cx="36" cy="52" r="15" fill="${C.sage}"/><circle cx="64" cy="52" r="15" fill="${C.sage}"/><circle cx="50" cy="40" r="20" fill="${C.sage}"/>`,
  },
  {
    id: 'wave',
    name: '海浪',
    category: '自然',
    body: `<path d="M8 56c8-11 16-11 24 0s16 11 24 0 16-11 24 0v24H8z" fill="${C.skyblue}"/><path d="M8 70c8-9 16-9 24 0s16 9 24 0 16-9 24 0v14H8z" fill="${C.softbrown}" opacity="0.35"/>`,
  },
  {
    id: 'sun',
    name: '太阳',
    category: '自然',
    body: `<circle cx="50" cy="50" r="19" fill="${C.mustard}"/><g stroke="${C.mustard}" stroke-width="7" stroke-linecap="round"><path d="M50 13v10M50 77v10M13 50h10M77 50h10M24 24l7 7M69 69l7 7M76 24l-7 7M31 69l-7 7"/></g>`,
  },
  {
    id: 'flower',
    name: '花',
    category: '自然',
    body: `<g fill="${C.coral}"><circle cx="50" cy="30" r="14"/><circle cx="69" cy="44" r="14"/><circle cx="62" cy="67" r="14"/><circle cx="38" cy="67" r="14"/><circle cx="31" cy="44" r="14"/></g><circle cx="50" cy="50" r="11" fill="${C.mustard}"/>`,
  },

  // —— 美食 ——
  {
    id: 'plate',
    name: '餐盘',
    category: '美食',
    body: `<circle cx="50" cy="52" r="33" fill="${C.cream}"/><circle cx="50" cy="52" r="33" fill="none" stroke="${C.softbrown}" stroke-width="4"/><circle cx="50" cy="52" r="17" fill="${C.terracotta}" opacity="0.55"/>`,
  },
  {
    id: 'coffee',
    name: '咖啡',
    category: '美食',
    body: `<path d="M70 42h9a10 10 0 0 1 0 20h-9" fill="none" stroke="${C.softbrown}" stroke-width="5"/><path d="M22 34h48v26a20 20 0 0 1-20 20H42a20 20 0 0 1-20-20z" fill="${C.cream}" stroke="${C.softbrown}" stroke-width="4"/><path d="M28 46h36v14a14 14 0 0 1-14 14h-8a14 14 0 0 1-14-14z" fill="${C.softbrown}"/>`,
  },
  {
    id: 'icecream',
    name: '冰淇淋',
    category: '美食',
    body: `<path d="M50 90 L33 46h34z" fill="${C.mustard}"/><circle cx="40" cy="40" r="14" fill="${C.coral}"/><circle cx="60" cy="40" r="14" fill="${C.cream}"/><circle cx="50" cy="28" r="15" fill="${C.terracotta}"/>`,
  },
  {
    id: 'noodle',
    name: '面碗',
    category: '美食',
    body: `<g stroke="${C.mustard}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M38 46c0-11 4-17 10-19M54 46c0-13 6-17 12-19"/></g><path d="M18 50h64c0 20-14 34-32 34S18 70 18 50z" fill="${C.terracotta}"/><rect x="13" y="44" width="74" height="8" rx="4" fill="${C.cream}"/>`,
  },

  // —— 交通 ——
  {
    id: 'plane',
    name: '飞机',
    category: '交通',
    body: `<path d="M50 8c4 0 7 6 7 16v14l30 17v8l-30-9v16l10 9v6l-17-5-17 5v-6l10-9V54l-30 9v-8l30-17V24c0-10 3-16 7-16z" fill="${C.skyblue}"/>`,
  },
  {
    id: 'train',
    name: '火车',
    category: '交通',
    body: `<rect x="24" y="22" width="52" height="46" rx="11" fill="${C.terracotta}"/><rect x="32" y="32" width="36" height="17" rx="4" fill="${C.cream}"/><rect x="30" y="56" width="40" height="6" rx="3" fill="${C.cream}" opacity="0.7"/><circle cx="36" cy="76" r="8" fill="${C.inkbrown}"/><circle cx="64" cy="76" r="8" fill="${C.inkbrown}"/>`,
  },
  {
    id: 'boat',
    name: '船',
    category: '交通',
    body: `<path d="M46 18l26 40H46z" fill="${C.cream}"/><path d="M40 24L20 58h20z" fill="${C.skyblue}"/><path d="M12 62h76l-11 20H23z" fill="${C.terracotta}"/>`,
  },
  {
    id: 'bike',
    name: '自行车',
    category: '交通',
    body: `<g fill="none" stroke="${C.softbrown}" stroke-width="5" stroke-linecap="round"><circle cx="27" cy="64" r="16"/><circle cx="73" cy="64" r="16"/><path d="M27 64l15-26h17l14 26M42 38h15"/></g>`,
  },

  // —— 地标 ——
  {
    id: 'building',
    name: '楼房',
    category: '地标',
    body: `<rect x="26" y="22" width="48" height="62" rx="5" fill="${C.terracotta}"/><g fill="${C.cream}"><rect x="34" y="32" width="11" height="11" rx="2"/><rect x="55" y="32" width="11" height="11" rx="2"/><rect x="34" y="50" width="11" height="11" rx="2"/><rect x="55" y="50" width="11" height="11" rx="2"/></g><rect x="43" y="66" width="14" height="18" rx="2" fill="${C.softbrown}"/>`,
  },
  {
    id: 'temple',
    name: '寺庙',
    category: '地标',
    body: `<path d="M50 12l40 22H10z" fill="${C.terracotta}"/><rect x="20" y="34" width="60" height="7" rx="3" fill="${C.softbrown}"/><path d="M50 42l30 17H20z" fill="${C.terracotta}"/><rect x="28" y="59" width="44" height="25" fill="${C.cream}"/><rect x="43" y="66" width="14" height="18" rx="2" fill="${C.softbrown}"/>`,
  },
  {
    id: 'bridge',
    name: '桥',
    category: '地标',
    body: `<rect x="8" y="76" width="84" height="7" rx="3" fill="${C.skyblue}"/><path d="M10 68c16-26 64-26 80 0" fill="none" stroke="${C.softbrown}" stroke-width="7"/><g stroke="${C.softbrown}" stroke-width="4" stroke-linecap="round"><path d="M27 60v18M50 52v26M73 60v18"/></g>`,
  },
  {
    id: 'tower',
    name: '塔',
    category: '地标',
    body: `<path d="M50 10l6 18H44z" fill="${C.mustard}"/><path d="M44 28h12l9 56H35z" fill="${C.terracotta}"/><rect x="29" y="50" width="42" height="8" rx="3" fill="${C.cream}"/><rect x="33" y="68" width="34" height="7" rx="3" fill="${C.cream}"/>`,
  },

  // —— 其他 ——
  {
    id: 'camera',
    name: '相机',
    category: '其他',
    body: `<rect x="36" y="20" width="28" height="13" rx="5" fill="${C.softbrown}"/><rect x="12" y="30" width="76" height="50" rx="9" fill="${C.softbrown}"/><circle cx="50" cy="55" r="19" fill="${C.cream}"/><circle cx="50" cy="55" r="11" fill="${C.skyblue}"/><circle cx="76" cy="41" r="4" fill="${C.mustard}"/>`,
  },
  {
    id: 'footprint',
    name: '脚印',
    category: '其他',
    body: `<g fill="${C.softbrown}"><ellipse cx="36" cy="42" rx="11" ry="17" transform="rotate(-14 36 42)"/><ellipse cx="63" cy="63" rx="11" ry="17" transform="rotate(10 63 63)"/></g>`,
  },
  {
    id: 'compass',
    name: '指南针',
    category: '其他',
    body: `<circle cx="50" cy="50" r="34" fill="${C.cream}"/><circle cx="50" cy="50" r="34" fill="none" stroke="${C.softbrown}" stroke-width="5"/><path d="M64 36L45 45l-9 19 19-9z" fill="${C.terracotta}"/><circle cx="50" cy="50" r="4" fill="${C.inkbrown}"/>`,
  },
  {
    id: 'tent',
    name: '帐篷',
    category: '其他',
    body: `<path d="M50 18L88 82H12z" fill="${C.sage}"/><path d="M50 46l17 36H33z" fill="${C.cream}"/>`,
  },
  {
    id: 'star',
    name: '星星',
    category: '其他',
    body: `<path d="M50 12l11 25 27 3-20 18 6 27-24-14-24 14 6-27-20-18 27-3z" fill="${C.mustard}"/>`,
  },
];

/**
 * 转成可以直接当图片用的 data URL。
 * 用 SVG data URL 而不是先转 PNG：矢量图放大不糊，导出高清图（F8.4 的 2x/3x）时更清晰，
 * 而且 SVG data URL 画进 canvas 不会污染画布，不影响 P0-5 导出。
 */
export function iconToDataUrl(icon: LibraryIcon): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">${icon.body}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
