import { create } from 'zustand';
import { createId, healRouteOrder } from '@/lib/projectIo';
import { SCHEMA_VERSION, type DateRange, type ExportSettings, type TravelNode, type TravelProject } from '@/types/project';

/**
 * 全局唯一 store —— PRD 决策 1 的落地：
 * 「前端只做 读对象 → 渲染 / 改对象 → 写对象，不要把状态散落到组件内部 state」
 *
 * 为什么用 Zustand 而不是 Redux / Context：
 * 1) 状态模型极简，就一个 project 对象。Redux 三件套在这里样板代码比业务代码还多。
 * 2) store 就是普通对象 + setter，天然贴合「整份 JSON 进出」。
 * 3) 比 Context 强在能按字段订阅，改一个节点不会让整棵树重渲染。
 *
 * 注意（v1.2 决策 3）：这个 store 里的数据是**会被导出成 JSON 的矢量数据**。
 * 图片资产一律不放这里，放 store/assetStore.ts，那份只活在会话内存。
 */

interface ProjectState {
  project: TravelProject;
  /** 最近一次导入产生的提示（数据自愈 / 图片丢失说明），展示后由 UI 清空 */
  notices: string[];

  loadProject: (project: TravelProject, notices?: string[]) => void;
  /** 修改旅行名称 / 日期范围（PRD F1.1） */
  updateTripMeta: (patch: { name?: string; date_range?: DateRange }) => void;
  addNode: (node: TravelNode) => void;
  /** 局部更新一个节点（P0-3 用来切换 icon_type） */
  updateNode: (
    nodeId: string,
    patch: Partial<Pick<TravelNode, 'icon_type' | 'poi_name' | 'note'>>,
  ) => void;
  removeNode: (nodeId: string) => void;
  setRouteOrder: (order: string[]) => void;
  clearNotices: () => void;
  updateExportSettings: (patch: Partial<ExportSettings>) => void;
}

/** 任何写操作都刷新 updated_at */
function touch(project: TravelProject): TravelProject {
  return {
    ...project,
    project: { ...project.project, updated_at: new Date().toISOString() },
  };
}

/** 取本地日期的 YYYY-MM-DD。不能用 toISOString()，那个会转成 UTC，东八区凌晨会串到前一天 */
export function todayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 把新节点按 visit_date 插进现有路线的正确位置（PRD F6.1）。
 * 不用「push 到末尾再整体排序」，因为那会冲掉用户之后手动拖拽出来的顺序。
 * 这里只找第一个日期比它晚的位置插进去，同一天的排在已有的后面，其余相对顺序不动。
 */
function insertByVisitDate(
  order: readonly string[],
  nodes: readonly TravelNode[],
  newNode: TravelNode,
): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const next = [...order];
  const insertAt = next.findIndex((id) => {
    const node = byId.get(id);
    return node !== undefined && node.visit_date > newNode.visit_date;
  });
  if (insertAt === -1) {
    next.push(newNode.id);
  } else {
    next.splice(insertAt, 0, newNode.id);
  }
  return next;
}

/** 空工程。进入后是空状态引导（PRD 状态清单第一行），由用户自己搜索添加地点。 */
function createEmptyProject(): TravelProject {
  const nowIso = new Date().toISOString();
  const today = todayLocalDate();
  return {
    schema_version: SCHEMA_VERSION,
    project: {
      id: createId('proj'),
      name: '我的旅行',
      date_range: { start: today, end: today },
      created_at: nowIso,
      updated_at: nowIso,
    },
    nodes: [],
    route_order: [],
    export_settings: { last_used_ratio: '3:4', title_override: null },
  };
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: createEmptyProject(),
  notices: [],

  loadProject: (project, notices = []) => set({ project, notices }),

  updateTripMeta: (patch) =>
    set((state) => ({
      project: touch({
        ...state.project,
        project: {
          ...state.project.project,
          ...(patch.name === undefined ? {} : { name: patch.name }),
          ...(patch.date_range === undefined ? {} : { date_range: patch.date_range }),
        },
      }),
    })),

  addNode: (node) =>
    set((state) => {
      const nodes = [...state.project.nodes, node];
      const order = insertByVisitDate(state.project.route_order, nodes, node);
      return { project: touch({ ...state.project, nodes, route_order: order }) };
    }),

  updateNode: (nodeId, patch) =>
    set((state) => ({
      project: touch({
        ...state.project,
        nodes: state.project.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
      }),
    })),

  removeNode: (nodeId) =>
    set((state) => {
      const nodes = state.project.nodes.filter((n) => n.id !== nodeId);
      const healed = healRouteOrder(nodes, state.project.route_order);
      return { project: touch({ ...state.project, nodes, route_order: healed.order }) };
    }),

  setRouteOrder: (order) =>
    set((state) => {
      const healed = healRouteOrder(state.project.nodes, order);
      return { project: touch({ ...state.project, route_order: healed.order }) };
    }),

  clearNotices: () => set({ notices: [] }),

  /** 记住用户最后用的导出比例和自定义标题（PRD 决策1 的 export_settings） */
  updateExportSettings: (patch) =>
    set((state) => ({
      project: touch({
        ...state.project,
        export_settings: { ...state.project.export_settings, ...patch },
      }),
    })),
}));
