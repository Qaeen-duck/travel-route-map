import { parseProjectFile, serializeProject } from '@/lib/projectIo';
import type { TravelProject } from '@/types/project';

/**
 * 矢量工程数据的本地缓存（PRD 第十章 P0-6）
 *
 * 用 localStorage 而不是 IndexedDB —— 这是对 PRD 决策 1 的一个有依据的选择：
 * 决策 1 原文是「localStorage 或 IndexedDB（推荐 IndexedDB，因为照片 base64 体积大）」，
 * 而 v1.2 已经把图片从工程数据里拿掉了，推荐 IndexedDB 的那个理由不再成立。
 * 现在要存的只有名称/坐标/日期/顺序，一条路线几 KB，
 * localStorage 同步、零依赖、能在开发者工具里直接看到内容，明显更合适。
 * 图片依然走 IndexedDB，见 lib/db.ts。
 *
 * 读取时复用 parseProjectFile 做校验和自愈：本地数据同样可能因为版本升级或
 * 手工篡改而损坏，没理由比用户上传的文件更信任它。
 */

const STORAGE_KEY = 'travel-route-map:project';

/** 保存。失败不抛异常，返回 false 由调用方决定要不要提示用户 */
export function saveProjectLocal(project: TravelProject): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeProject(project));
    return true;
  } catch {
    // 配额满、无痕模式禁用存储等
    return false;
  }
}

/** 读取。任何异常或校验不通过都当作「没有缓存」，绝不让坏数据把应用卡死 */
export function loadProjectLocal(): TravelProject | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null || raw.length === 0) {
    return null;
  }
  const result = parseProjectFile(raw);
  return result.ok ? result.project : null;
}

export function clearProjectLocal(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略：清不掉也不影响用户继续用
  }
}
