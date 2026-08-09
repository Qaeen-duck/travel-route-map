/**
 * POI 搜索候选项 —— 与具体服务商无关的中立结构。
 * 高德、百度、Nominatim 的原始返回格式各不相同，各自的 adapter 负责翻译成这个形状，
 * UI 层只认这个类型，这样换数据源时 UI 一行都不用改（PRD 决策 5）。
 */
export interface PoiCandidate {
  /** 服务商给的唯一标识，用于列表 key 和去重 */
  id: string;
  /** POI 名称，如「西湖」 */
  name: string;
  /** 所在城市 / 区县，用于消歧（AC-3 要求候选项必须能区分同名地点） */
  district: string;
  /** 详细地址，可能为空 */
  address: string;
  lat: number;
  lng: number;
}
