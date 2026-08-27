/**
 * 图片文件处理：校验、读取、缩放、下载
 *
 * 边界来自两处：
 * - PRD F2.4：单张 ≤ 10MB，支持 JPG/PNG/HEIC
 * - 百炼 API：输入图建议边长 384-2048 像素，大小 ≤ 10MB
 * 所以上传后要先把大图缩到 2048 以内，否则又慢又可能被 API 拒。
 */

/** PRD F2.4 的体积上限 */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** 百炼 API 建议的输入图最长边上限 */
const MAX_EDGE_PX = 2048;

/** 百炼 API 建议的输入图最短边下限 */
const MIN_EDGE_PX = 384;

/**
 * 允许的图片类型。
 * HEIC 是 iPhone 默认格式，PRD F2.4 要求支持，但浏览器 <canvas> 基本解不了它，
 * 而且百炼 API 的输入格式列表里也没有 HEIC。这里先放行选择（不拦），
 * 真正解码失败时给出明确提示，让用户去导出 JPG —— 详见 PRD 报备。
 */
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];

export interface PhotoCheckFailure {
  ok: false;
  message: string;
}

export interface PhotoCheckSuccess {
  ok: true;
  file: File;
}

/** 上传前拦截（PRD 状态清单：照片过大要在上传前拦住） */
export function checkPhotoFile(file: File): PhotoCheckSuccess | PhotoCheckFailure {
  if (file.size > MAX_PHOTO_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, message: `这张照片有 ${mb}MB，超过 10MB 了，换一张小一点的吧。` };
  }
  if (file.type.length > 0 && !ACCEPTED_MIME.includes(file.type)) {
    return { ok: false, message: '这个格式的图片暂时用不了，请选择 JPG 或 PNG 照片。' };
  }
  return { ok: true, file };
}

/**
 * 把文件读成 data URL，并在超过尺寸上限时等比缩放。
 * 输出统一为 JPEG（质量 0.92）——因为照片转 PNG 体积会暴涨，
 * 而这张图只是喂给 API 当输入，不需要无损。
 */
export function fileToScaledDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const longEdge = Math.max(img.width, img.height);
      const shortEdge = Math.min(img.width, img.height);
      if (shortEdge < MIN_EDGE_PX) {
        reject(new Error(`这张照片太小了（最短边只有 ${shortEdge} 像素），生成效果会很差，换一张清晰的吧。`));
        return;
      }

      const scale = longEdge > MAX_EDGE_PX ? MAX_EDGE_PX / longEdge : 1;
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('当前浏览器无法处理这张图片。'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // HEIC 基本会走到这里
      reject(new Error('这张照片打不开，如果是 iPhone 拍的 HEIC 格式，请先转成 JPG 再上传。'));
    };

    img.src = objectUrl;
  });
}

/**
 * 把远端图片经开发代理取回，转成可持久化的 Blob。
 *
 * 两个目的：
 * 1) 百炼返回的 OSS 链接 24 小时后失效，必须立刻取回来
 * 2) 同源 blob 不会污染 canvas，保证 P0-5 能正常导出 PNG
 */
export async function fetchImageAsBlob(remoteUrl: string): Promise<Blob> {
  const response = await fetch(`/imgproxy?url=${encodeURIComponent(remoteUrl)}`);
  if (!response.ok) {
    throw new Error('图片下载失败');
  }
  return response.blob();
}

/** 触发浏览器下载一张图片（生成结果的「保存到本地」按钮用） */
export function downloadImage(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
