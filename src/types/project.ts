/**
 * 工程数据结构 —— 严格对应 PRD 第八章「决策 1」里的 JSON schema。
 *
 * 两条硬约束在这里体现：
 * 1) 字段名沿用 PRD 里的 snake_case，不转驼峰。
 *    理由：导出的 .json 必须和 PRD 文档里写的长得一模一样，中间少一层映射层，
 *    也少一处未来云端 API 对不上字段的风险。代价是和 JS 惯例不一致，可接受。
 * 2) 只存 lat/lng，不存像素坐标（决策 2）。像素坐标由 lib/projection.ts 每次渲染时算。
 */

/** 当前工程文件的 schema 版本。导入时严格比对这个值。 */
export const SCHEMA_VERSION = '1.0';

/** 节点图标类型（PRD F2.2 icon_type 枚举） */
export type IconType = 'ai_generated' | 'user_photo' | 'library_icon' | 'text_only';

/** 导出比例（PRD F8.1 三种预设） */
export type ExportRatio = '3:4' | '1:1' | '4:3';

/** 旅行日期范围，YYYY-MM-DD */
export interface DateRange {
  start: string;
  end: string;
}

/** 工程元信息 */
export interface ProjectMeta {
  id: string;
  name: string;
  date_range: DateRange;
  /** ISO 8601 带时区 */
  created_at: string;
  updated_at: string;
}

/** 单个旅行节点（PRD F2.2） */
export interface TravelNode {
  id: string;
  /** POI 名称，≤ 30 字（F2.4） */
  poi_name: string;
  /** 真实纬度，来自 POI 搜索，用户不可手改（F2.2） */
  lat: number;
  /** 真实经度 */
  lng: number;
  /** 到达日期 YYYY-MM-DD，必须落在 project.date_range 内（F2.4） */
  visit_date: string;
  /** 用户原图：base64 / blob URL / 未来 CDN URL；无照片为 null */
  user_photo: string | null;
  icon_type: IconType;
  /** 当前使用的图标资源；未生成时为 null */
  icon_asset: string | null;
  /** 备注，≤ 100 字（F2.4） */
  note: string;
}

/** 导出设置（PRD 决策 1） */
export interface ExportSettings {
  last_used_ratio: ExportRatio;
  /** 用户在导出前改过的标题；未改为 null，此时取 project.name */
  title_override: string | null;
}

/** 一份完整工程 = 一个 JSON 文件的全部内容 */
export interface TravelProject {
  schema_version: string;
  project: ProjectMeta;
  nodes: TravelNode[];
  /** 连线顺序，元素是 node.id（F6.1 / F6.2） */
  route_order: string[];
  export_settings: ExportSettings;
}
