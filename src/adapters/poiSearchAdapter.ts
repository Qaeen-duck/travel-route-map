import type { PoiCandidate } from '@/types/poi';

/**
 * POI 搜索适配器接口（PRD 决策 5）
 *
 * 为什么要多这一层抽象而不直接在组件里 fetch 高德：
 * 1) PRD 第九章开放项 1 明确写了「POI 搜索服务具体选型待定」，境外还可能换 Nominatim。
 *    有了这个接口，换源只需要新增一个实现文件，UI 和 store 完全不动。
 * 2) 便于测试：将来写单测时可以塞一个假的 adapter，不用真的打网络。
 * 3) 强制各家服务商的差异（字段名、错误码、坐标系）都收敛在 adapter 内部消化。
 */
export interface PoiSearchAdapter {
  /** 服务商标识，用于错误提示和日志 */
  readonly name: string;
  /**
   * 关键词搜索。
   * @param keyword 用户输入的关键词
   * @param signal 用于取消请求（用户快速改输入时要能中断上一次）
   * @throws PoiSearchError 网络失败、配额超限、Key 无效等
   */
  search(keyword: string, signal?: AbortSignal): Promise<PoiCandidate[]>;
}

/** 搜索失败的统一错误类型，message 是给用户看的人话 */
export class PoiSearchError extends Error {
  /** 是否值得让用户点「重试」（网络抖动值得，Key 配错了不值得） */
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'PoiSearchError';
    this.retryable = retryable;
  }
}
