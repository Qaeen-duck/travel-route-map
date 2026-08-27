import {
  SCHEMA_VERSION,
  type ExportRatio,
  type IconType,
  type TravelNode,
  type TravelProject,
} from '@/types/project';

/**
 * 工程 JSON 的导出 / 导入 / 校验 / 自愈（PRD F1.3 / F1.4 / AC-14 / AC-15）
 *
 * 设计要点：
 * 1) 校验失败一律返回「人话」错误文案，不把 schema_version、route_order 这类
 *    技术字段名甩给用户看（女王 2026-08-09 追加要求）。
 * 2) route_order 与 nodes 不一致时不报错，而是「自愈」：以 nodes 为准，
 *    缺的按到达日期补到末尾，多余的丢弃，并用 notices 告知用户做了什么修复。
 * 3) 这里不依赖任何 React / store，纯数据层，方便未来搬到云端做服务端校验。
 */

export interface ImportSuccess {
  ok: true;
  project: TravelProject;
  /** 自愈动作说明，给用户看的提示，可为空数组 */
  notices: string[];
}

export interface ImportFailure {
  ok: false;
  /** 面向普通用户的错误文案 */
  message: string;
}

export type ImportResult = ImportSuccess | ImportFailure;

const ICON_TYPES: readonly IconType[] = ['ai_generated', 'user_photo', 'library_icon', 'text_only'];
const EXPORT_RATIOS: readonly ExportRatio[] = ['3:4', '1:1', '4:3'];

const BROKEN_FILE_MSG =
  '这个文件读不出来，可能不是从本工具导出的工程文件。请选择之前点「导出工程」下载的那个 .json 文件。';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * 路线顺序自愈（PRD F1.4 与 F6.1 交界处的数据自愈规则）
 * 规则：以 nodes 为唯一真源
 *   - route_order 里指向不存在节点的 id → 丢弃
 *   - 重复 id → 只保留第一次出现
 *   - nodes 里有但 route_order 没有的 → 按到达日期升序（同日按其在 nodes 中的先后）补到末尾
 */
export function healRouteOrder(
  nodes: readonly TravelNode[],
  rawOrder: readonly string[],
): { order: string[]; notices: string[] } {
  const notices: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  const seen = new Set<string>();
  const order: string[] = [];
  let droppedCount = 0;

  for (const id of rawOrder) {
    if (!nodeIds.has(id) || seen.has(id)) {
      droppedCount += 1;
      continue;
    }
    seen.add(id);
    order.push(id);
  }

  const missing = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => !seen.has(node.id))
    .sort((a, b) => {
      if (a.node.visit_date === b.node.visit_date) {
        return a.index - b.index; // 同日期保持原有先后（PRD F6.1）
      }
      return a.node.visit_date < b.node.visit_date ? -1 : 1;
    })
    .map(({ node }) => node.id);

  order.push(...missing);

  if (droppedCount > 0) {
    notices.push(`有 ${droppedCount} 条失效的路线顺序记录已被清理。`);
  }
  if (missing.length > 0) {
    notices.push(`有 ${missing.length} 个地点没有排进路线，已按到达日期补到了路线末尾。`);
  }

  return { order, notices };
}

/** 校验并解析一个节点；失败时返回人话原因 */
function parseNode(raw: unknown, indexForHuman: number): { ok: true; node: TravelNode } | { ok: false; message: string } {
  const where = `第 ${indexForHuman} 个地点`;
  if (!isRecord(raw)) {
    return { ok: false, message: `${where}的信息损坏了，无法恢复这份工程。` };
  }
  if (!isNonEmptyString(raw['id'])) {
    return { ok: false, message: `${where}缺少标识信息，无法恢复这份工程。` };
  }
  if (!isNonEmptyString(raw['poi_name'])) {
    return { ok: false, message: `${where}没有名称，无法恢复这份工程。` };
  }
  if (!isFiniteNumber(raw['lat']) || !isFiniteNumber(raw['lng'])) {
    return { ok: false, message: `${where}「${String(raw['poi_name'])}」缺少位置信息，无法恢复这份工程。` };
  }
  if (!isDateString(raw['visit_date'])) {
    return { ok: false, message: `${where}「${String(raw['poi_name'])}」的到达日期不正确，无法恢复这份工程。` };
  }

  const rawIconType = raw['icon_type'];
  const iconType: IconType =
    typeof rawIconType === 'string' && (ICON_TYPES as readonly string[]).includes(rawIconType)
      ? (rawIconType as IconType)
      : 'text_only'; // 图标类型无法识别时降级为纯文字节点，保证一定能出图（PRD F4 兜底思路）

  return {
    ok: true,
    node: {
      id: raw['id'],
      poi_name: raw['poi_name'],
      lat: raw['lat'],
      lng: raw['lng'],
      visit_date: raw['visit_date'],
      user_photo: null,
      icon_type: iconType,
      icon_asset: null,
      note: typeof raw['note'] === 'string' ? raw['note'] : '',
    },
  };
}

/** 主入口：把上传文件的文本内容解析成工程对象 */
export function parseProjectFile(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: BROKEN_FILE_MSG };
  }

  if (!isRecord(raw)) {
    return { ok: false, message: BROKEN_FILE_MSG };
  }

  // —— 版本校验（F1.4）——
  const version = raw['schema_version'];
  if (!isNonEmptyString(version)) {
    return { ok: false, message: BROKEN_FILE_MSG };
  }
  if (version !== SCHEMA_VERSION) {
    return {
      ok: false,
      message: `这份工程文件是用另一个版本的工具保存的（文件版本 ${version}，当前支持 ${SCHEMA_VERSION}），暂时打不开。请用导出它的那个版本继续编辑。`,
    };
  }

  // —— 工程基本信息 ——
  const projectRaw = raw['project'];
  if (!isRecord(projectRaw)) {
    return { ok: false, message: BROKEN_FILE_MSG };
  }
  if (!isNonEmptyString(projectRaw['name'])) {
    return { ok: false, message: '这份工程文件缺少旅行名称，无法恢复。' };
  }
  const dateRangeRaw = projectRaw['date_range'];
  if (!isRecord(dateRangeRaw) || !isDateString(dateRangeRaw['start']) || !isDateString(dateRangeRaw['end'])) {
    return { ok: false, message: '这份工程文件的旅行日期不完整，无法恢复。' };
  }

  // —— 节点列表 ——
  const nodesRaw = raw['nodes'];
  if (!Array.isArray(nodesRaw)) {
    return { ok: false, message: BROKEN_FILE_MSG };
  }
  const nodes: TravelNode[] = [];
  for (let i = 0; i < nodesRaw.length; i += 1) {
    const parsed = parseNode(nodesRaw[i], i + 1);
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }
    nodes.push(parsed.node);
  }

  // 同 id 去重：保留第一个，避免后续渲染和排序出现幽灵节点
  const notices: string[] = [];
  const uniqueNodes: TravelNode[] = [];
  const seenIds = new Set<string>();
  for (const node of nodes) {
    if (seenIds.has(node.id)) {
      notices.push(`有重复的地点「${node.poi_name}」，已自动合并。`);
      continue;
    }
    seenIds.add(node.id);
    uniqueNodes.push(node);
  }

  // —— 路线顺序自愈 ——
  const rawOrder = Array.isArray(raw['route_order'])
    ? raw['route_order'].filter((v): v is string => typeof v === 'string')
    : [];
  const healed = healRouteOrder(uniqueNodes, rawOrder);
  notices.push(...healed.notices);

  // —— 导出设置（缺失就给默认值，不阻断导入）——
  const exportRaw = isRecord(raw['export_settings']) ? raw['export_settings'] : {};
  const ratioRaw = exportRaw['last_used_ratio'];
  const ratio: ExportRatio =
    typeof ratioRaw === 'string' && (EXPORT_RATIOS as readonly string[]).includes(ratioRaw)
      ? (ratioRaw as ExportRatio)
      : '3:4';

  const nowIso = new Date().toISOString();

  const project: TravelProject = {
    schema_version: SCHEMA_VERSION,
    project: {
      id: isNonEmptyString(projectRaw['id']) ? projectRaw['id'] : createId('proj'),
      name: projectRaw['name'],
      date_range: { start: dateRangeRaw['start'], end: dateRangeRaw['end'] },
      created_at: isNonEmptyString(projectRaw['created_at']) ? projectRaw['created_at'] : nowIso,
      updated_at: nowIso,
    },
    nodes: uniqueNodes,
    route_order: healed.order,
    export_settings: {
      last_used_ratio: ratio,
      title_override: asNullableString(exportRaw['title_override']),
    },
  };

  return { ok: true, project, notices };
}

/** 生成一个短 id。crypto.randomUUID 在 Chrome/Edge/Safari 最新版都有（PRD 假设 5） */
export function createId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
  return `${prefix}_${uuid.slice(0, 8)}`;
}

/** 序列化成带缩进的 JSON 文本，缩进是为了用户能直接打开文件肉眼检查（AC-14） */
export function serializeProject(project: TravelProject): string {
  return JSON.stringify(project, null, 2);
}

/** 触发浏览器下载。不经服务器，符合 PRD「纯前端」定位 */
export function downloadProjectJson(project: TravelProject): void {
  const text = serializeProject(project);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = project.project.name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || 'travel-map';
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // 立刻释放，避免大 base64 照片长期占内存
  URL.revokeObjectURL(url);
}

/** 读取用户选择的文件为文本 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'utf-8');
  });
}
