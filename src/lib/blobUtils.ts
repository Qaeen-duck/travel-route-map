/**
 * Blob 与 data URL 的互转。
 *
 * 为什么两种形态都要留着：
 * - **Blob**：能直接存进 IndexedDB，是持久化的形态
 * - **blob URL**：`blob:http://...`，页面级临时凭证，刷新即失效，只用于渲染
 * - **data URL**：base64 字符串，百炼 API 要求图片以这种形式传入
 *
 * 早期版本内存里只留 blob URL，看着能用，但它**存进数据库毫无意义**（重开页面就是死链），
 * 这也是这轮改造的根本原因。
 */

/** data URL → Blob。用 fetch 解析比手写 atob 拆包更短也更不容易出错 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/** Blob → data URL（给需要 base64 的百炼 API 用） */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(blob);
  });
}

/** 字符串（如 SVG 源码）→ Blob */
export function textToBlob(text: string, mimeType: string): Blob {
  return new Blob([text], { type: mimeType });
}

/** 安全释放 blob URL，非 blob 协议的（data URL）不动 */
export function revokeIfBlobUrl(url: string | undefined): void {
  if (url !== undefined && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
