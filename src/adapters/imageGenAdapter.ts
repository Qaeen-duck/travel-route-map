/**
 * 图片生成适配器接口（PRD 决策 6）
 *
 * 和 poiSearchAdapter 同样的思路：把服务商差异关在门里。
 * PRD 决策 6 明确要求「预留 SD 实现，便于未来切换或多路灾备」，
 * 所以 UI 层只认这个接口，不认任何百炼特有的字段。
 */

export interface GenerateIconInput {
  /** POI 名称，作为文字条件 */
  poiName: string;
  /** 用户照片的 data URL；为 null 时走文生图补充路径（PRD F3.1） */
  photoDataUrl: string | null;
  /** 色板参考图 data URL（手段 H1）；文生图路径下忽略 */
  paletteRefDataUrl: string;
  /** 取消信号 —— PRD F3.4 要求生成中可取消 */
  signal?: AbortSignal;
}

export interface GenerateIconResult {
  /** 已取回本地的图片二进制。调用方自己决定是渲染成 blob URL 还是存进 IndexedDB */
  blob: Blob;
  /** 服务商返回的原始远端链接，仅用于排查问题；24 小时后失效 */
  remoteUrl: string;
}

export interface ImageGenAdapter {
  readonly name: string;
  /** 当前使用的模型标识，展示在界面上便于排查 */
  readonly model: string;
  generateIcon(input: GenerateIconInput): Promise<GenerateIconResult>;
}

/** 生成失败的统一错误，message 是给用户看的人话 */
export class ImageGenError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'ImageGenError';
    this.retryable = retryable;
  }
}
