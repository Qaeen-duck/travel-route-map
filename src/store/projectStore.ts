import { create } from 'zustand';
import { createId, healRouteOrder } from '@/lib/projectIo';
import { SCHEMA_VERSION, type TravelNode, type TravelProject } from '@/types/project';

/**
 * 全局唯一 store —— PRD 决策 1 的落地：
 * 「前端只做 读对象 → 渲染 / 改对象 → 写对象，不要把状态散落到组件内部 state」
 *
 * 为什么用 Zustand 而不是 Redux / Context：
 * 1) 本项目状态模型极简 —— 就一个 project 对象。Redux 的 action/reducer/middleware
 *    三件套在这里是纯负担，样板代码会比业务代码还多。
 * 2) Zustand 的 store 就是普通对象 + setter，天然贴合「整份 JSON 进出」的模型。
 *    P0-6 接 IndexedDB 时只要在外面挂一个 subscribe 做持久化，业务代码零改动。
 * 3) 比 Context 好在：组件可按字段订阅，改一个节点不会让整棵树重渲染。
 *    画布上会有几十个 Konva 节点，这个性能差异是实打实的。
 */

interface ProjectState {
  project: TravelProject;
  /** 最近一次导入产生的提示（数据自愈说明），展示后由 UI 清空 */
  notices: string[];

  /** 整份替换（导入 JSON 用） */
  loadProject: (project: TravelProject, notices?: string[]) => void;
  /** 追加节点，同时排进路线 */
  addNode: (node: TravelNode) => void;
  /** 删除节点，路线顺序同步清理 */
  removeNode: (nodeId: string) => void;
  /** 手动指定路线顺序（P0-2 侧边栏拖拽会用） */
  setRouteOrder: (order: string[]) => void;
  clearNotices: () => void;
}

/** 任何写操作都刷新 updated_at */
function touch(project: TravelProject): TravelProject {
  return {
    ...project,
    project: { ...project.project, updated_at: new Date().toISOString() },
  };
}

/**
 * P0-1 的硬编码测试数据：杭州三个真实景点。
 * 选它们是因为三点不共线且拉得开，能一眼看出投影方向对不对 ——
 * 灵隐寺在西湖西边偏北，雷峰塔在西湖南边偏东，画布上必须呈现同样的相对方位。
 * P0-2 接入 POI 搜索后这份假数据会删掉。
 */
function createSampleProject(): TravelProject {
  const nowIso = new Date().toISOString();
  const nodes: TravelNode[] = [
    {
      id: 'node_xihu',
      poi_name: '西湖',
      lat: 30.2401,
      lng: 120.1445,
      visit_date: '2026-07-20',
      user_photo: null,
      icon_type: 'text_only',
      icon_asset: null,
      note: '断桥残雪',
    },
    {
      id: 'node_lingyin',
      poi_name: '灵隐寺',
      lat: 30.2417,
      lng: 120.101,
      visit_date: '2026-07-21',
      user_photo: null,
      icon_type: 'text_only',
      icon_asset: null,
      note: '',
    },
    {
      id: 'node_leifeng',
      poi_name: '雷峰塔',
      lat: 30.2313,
      lng: 120.1487,
      visit_date: '2026-07-22',
      user_photo: null,
      icon_type: 'text_only',
      icon_asset: null,
      note: '日落',
    },
  ];

  return {
    schema_version: SCHEMA_VERSION,
    project: {
      id: createId('proj'),
      name: '杭州三日游（测试数据）',
      date_range: { start: '2026-07-20', end: '2026-07-22' },
      created_at: nowIso,
      updated_at: nowIso,
    },
    nodes,
    route_order: nodes.map((n) => n.id),
    export_settings: { last_used_ratio: '3:4', title_override: null },
  };
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: createSampleProject(),
  notices: [],

  loadProject: (project, notices = []) => set({ project, notices }),

  addNode: (node) =>
    set((state) => {
      const nodes = [...state.project.nodes, node];
      const healed = healRouteOrder(nodes, state.project.route_order);
      return { project: touch({ ...state.project, nodes, route_order: healed.order }) };
    }),

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
}));
