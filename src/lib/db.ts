import Dexie, { type Table } from 'dexie';

/**
 * 图片资产的本地数据库（PRD 决策 1 存储策略 / 附录 B.3）
 *
 * 分工说明 —— 项目里有两套持久化，是按数据特性分的，不是随手乱放：
 * - **矢量数据**（地点/坐标/日期/顺序）→ localStorage，见 lib/localProject.ts
 *   只有几 KB，同步 API，能在开发者工具里直接肉眼查看，调试方便
 * - **图片二进制**（照片 / 图标）→ IndexedDB，就是这里
 *   单张几百 KB 到几 MB，localStorage 的 5MB 上限根本装不下，而且它只能存字符串
 *
 * 主键设计成 `工程id::节点id::类型`，好处是按工程隔离，
 * 导入别人的工程 JSON 时不会串图，将来做多工程管理也不用改表结构。
 *
 * 注意：IndexedDB 绑定在「这台电脑的这个浏览器」，不会跟着导出的 JSON 走。
 * 换设备、发给别人打开，图片依然会丢 —— 这是 v1.2 决策 3 已接受的边界。
 */

export type AssetKind = 'photo' | 'icon';

export interface AssetRecord {
  /** `${projectId}::${nodeId}::${kind}` */
  id: string;
  projectId: string;
  nodeId: string;
  kind: AssetKind;
  blob: Blob;
  updatedAt: number;
}

class TravelMapDb extends Dexie {
  assets!: Table<AssetRecord, string>;

  constructor() {
    super('travel-route-map');
    // 索引：主键 id，另外按 projectId / nodeId 建索引，方便批量读取和删除
    this.version(1).stores({ assets: 'id, projectId, nodeId' });
  }
}

const db = new TravelMapDb();

export function assetKey(projectId: string, nodeId: string, kind: AssetKind): string {
  return `${projectId}::${nodeId}::${kind}`;
}

/**
 * 所有数据库操作都包一层「失败不抛」。
 * 无痕模式、磁盘满、用户禁用存储，都会让 IndexedDB 挂掉，
 * 但这些情况下产品应该降级成「这次会话能用、只是刷新后丢」，而不是白屏。
 */
async function safe<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch {
    return fallback;
  }
}

export async function putAsset(record: AssetRecord): Promise<boolean> {
  return safe(async () => {
    await db.assets.put(record);
    return true;
  }, false);
}

export async function getProjectAssets(projectId: string): Promise<AssetRecord[]> {
  return safe(() => db.assets.where('projectId').equals(projectId).toArray(), []);
}

export async function deleteNodeAssets(projectId: string, nodeId: string): Promise<void> {
  await safe(async () => {
    await db.assets.bulkDelete([
      assetKey(projectId, nodeId, 'photo'),
      assetKey(projectId, nodeId, 'icon'),
    ]);
    return true;
  }, false);
}

export async function deleteProjectAssets(projectId: string): Promise<void> {
  await safe(async () => {
    await db.assets.where('projectId').equals(projectId).delete();
    return true;
  }, false);
}

/** 清掉除当前工程以外的所有图片，避免导入过很多工程后垃圾越积越多 */
export async function pruneOtherProjects(keepProjectId: string): Promise<void> {
  await safe(async () => {
    await db.assets.where('projectId').notEqual(keepProjectId).delete();
    return true;
  }, false);
}
