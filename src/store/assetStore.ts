import { create } from 'zustand';

/**
 * 会话内图片资产存储（PRD 决策 3 · v1.2 修订版）
 *
 * 这里刻意和 projectStore 分开，是为了让「什么会被导出」这件事在架构上一目了然：
 * - projectStore  → 会被序列化进 JSON 的矢量数据
 * - assetStore    → 只活在当前会话内存里的图片，永不进 JSON
 *
 * 关掉浏览器就没了，这是 v1.2 明确接受的副作用。
 * 将来要做持久化，只需要把这个 store 的读写换成 IndexedDB，projectStore 一行都不用动。
 *
 * 存的是 blob URL / data URL 字符串，都是同源资源，画进 canvas 不会污染画布。
 */

export interface NodeAssets {
  /** 用户上传的原始照片（已缩放的 data URL），可作为图标直接使用（F3.5 用我的原图） */
  photo?: string;
  /** AI 生成的图标（blob URL） */
  icon?: string;
}

interface AssetState {
  /** key 是节点 id */
  assets: Record<string, NodeAssets>;

  setPhoto: (nodeId: string, dataUrl: string) => void;
  setIcon: (nodeId: string, blobUrl: string) => void;
  clearIcon: (nodeId: string) => void;
  /** 节点被删除时把它的图片一起清掉，顺手释放 blob URL 占的内存 */
  dropNode: (nodeId: string) => void;
}

/** blob URL 用完要显式释放，否则整张图会一直占着内存直到刷新 */
function revokeIfBlob(url: string | undefined): void {
  if (url !== undefined && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export const useAssetStore = create<AssetState>((set) => ({
  assets: {},

  setPhoto: (nodeId, dataUrl) =>
    set((state) => ({
      assets: { ...state.assets, [nodeId]: { ...state.assets[nodeId], photo: dataUrl } },
    })),

  setIcon: (nodeId, blobUrl) =>
    set((state) => {
      // 覆盖旧图标前先释放它，避免反复「重新生成」把内存堆满
      revokeIfBlob(state.assets[nodeId]?.icon);
      return {
        assets: { ...state.assets, [nodeId]: { ...state.assets[nodeId], icon: blobUrl } },
      };
    }),

  clearIcon: (nodeId) =>
    set((state) => {
      const current = state.assets[nodeId];
      if (!current) {
        return state;
      }
      revokeIfBlob(current.icon);
      const next = { ...current };
      delete next.icon;
      return { assets: { ...state.assets, [nodeId]: next } };
    }),

  dropNode: (nodeId) =>
    set((state) => {
      const current = state.assets[nodeId];
      revokeIfBlob(current?.icon);
      const nextAssets = { ...state.assets };
      delete nextAssets[nodeId];
      return { assets: nextAssets };
    }),
}));
