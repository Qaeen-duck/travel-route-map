import { create } from 'zustand';
import { blobToDataUrl, revokeIfBlobUrl } from '@/lib/blobUtils';
import {
  assetKey,
  deleteNodeAssets,
  deleteProjectAssets,
  getProjectAssets,
  pruneOtherProjects,
  putAsset,
} from '@/lib/db';

/**
 * 图片资产 store（v1.2 决策 3 + P0-6 持久化）
 *
 * 和 projectStore 分开，是为了让「什么会被导出进 JSON」一目了然：
 * - projectStore → 矢量数据，会进 JSON
 * - assetStore   → 图片，永远不进 JSON，只落 IndexedDB
 *
 * 内存里两种图各存各的形态，是被用途逼出来的：
 * - photo 存 **data URL**：因为百炼 API 要求 base64 输入，转来转去不如直接留着
 * - icon  存 **blob URL**：只用于渲染，blob URL 比超长 base64 字符串省内存得多
 * 数据库里统一存 Blob，读出来时再按上面的规则各自转换。
 */

export interface NodeAssets {
  photo?: string;
  icon?: string;
}

interface AssetState {
  /** 当前工程 id，决定读写落在哪个命名空间下 */
  projectId: string | null;
  assets: Record<string, NodeAssets>;
  /** 是否已完成首次从数据库恢复。恢复完成前不要触发自动保存，避免用空数据覆盖 */
  ready: boolean;
  /** IndexedDB 不可用时（无痕模式等）为 true，界面据此提示用户 */
  persistenceUnavailable: boolean;

  hydrate: (projectId: string) => Promise<void>;
  setPhoto: (nodeId: string, blob: Blob) => Promise<void>;
  setIcon: (nodeId: string, blob: Blob) => Promise<void>;
  dropNode: (nodeId: string) => Promise<void>;
  /** 换工程或清空重来时调用 */
  resetForProject: (projectId: string) => Promise<void>;
}

/** 释放一批 blob URL，防止切换工程时内存越用越多 */
function revokeAll(assets: Record<string, NodeAssets>): void {
  for (const value of Object.values(assets)) {
    revokeIfBlobUrl(value.icon);
  }
}

export const useAssetStore = create<AssetState>((set, get) => ({
  projectId: null,
  assets: {},
  ready: false,
  persistenceUnavailable: false,

  hydrate: async (projectId) => {
    revokeAll(get().assets);
    set({ projectId, assets: {}, ready: false });

    const records = await getProjectAssets(projectId);
    const next: Record<string, NodeAssets> = {};

    for (const record of records) {
      const entry = next[record.nodeId] ?? {};
      if (record.kind === 'icon') {
        entry.icon = URL.createObjectURL(record.blob);
      } else {
        // photo 转回 data URL：生成接口要 base64，这里一次性转好，省得每次生成再转
        entry.photo = await blobToDataUrl(record.blob);
      }
      next[record.nodeId] = entry;
    }

    // 顺手清掉其他工程遗留的图片，避免反复导入后数据库越堆越大
    await pruneOtherProjects(projectId);

    set({ assets: next, ready: true });
  },

  setPhoto: async (nodeId, blob) => {
    const projectId = get().projectId;
    const dataUrl = await blobToDataUrl(blob);
    set((state) => ({
      assets: { ...state.assets, [nodeId]: { ...state.assets[nodeId], photo: dataUrl } },
    }));
    if (projectId === null) {
      return;
    }
    const ok = await putAsset({
      id: assetKey(projectId, nodeId, 'photo'),
      projectId,
      nodeId,
      kind: 'photo',
      blob,
      updatedAt: Date.now(),
    });
    if (!ok) {
      set({ persistenceUnavailable: true });
    }
  },

  setIcon: async (nodeId, blob) => {
    const projectId = get().projectId;
    const url = URL.createObjectURL(blob);
    set((state) => {
      // 覆盖旧图标前先释放，否则反复「重新生成」会把内存堆满
      revokeIfBlobUrl(state.assets[nodeId]?.icon);
      return { assets: { ...state.assets, [nodeId]: { ...state.assets[nodeId], icon: url } } };
    });
    if (projectId === null) {
      return;
    }
    const ok = await putAsset({
      id: assetKey(projectId, nodeId, 'icon'),
      projectId,
      nodeId,
      kind: 'icon',
      blob,
      updatedAt: Date.now(),
    });
    if (!ok) {
      set({ persistenceUnavailable: true });
    }
  },

  dropNode: async (nodeId) => {
    const projectId = get().projectId;
    set((state) => {
      revokeIfBlobUrl(state.assets[nodeId]?.icon);
      const nextAssets = { ...state.assets };
      delete nextAssets[nodeId];
      return { assets: nextAssets };
    });
    if (projectId !== null) {
      await deleteNodeAssets(projectId, nodeId);
    }
  },

  resetForProject: async (projectId) => {
    const previous = get().projectId;
    revokeAll(get().assets);
    if (previous !== null) {
      await deleteProjectAssets(previous);
    }
    set({ projectId, assets: {}, ready: true });
  },
}));
