/**
 * 白底抠图（PRD F3.8 的客户端实现）
 *
 * 背景：PRD F3.8 原本要求生成透明底 PNG，v1.2 因为要额外接抠图服务而降级成白底。
 * 但白底方图直接摆在米色画布上会露出一块白方块，很难看。
 * 这里用一个零成本的本地方案补上：把图片四周连通的白色区域变成透明。
 *
 * 为什么用「从边缘泛洪填充」而不是「所有白像素都变透明」：
 * 生成的贴纸自带一圈白色描边（就是那个 die-cut 小贴纸的边），
 * 简单按颜色阈值全局清除会把这圈描边一起吃掉，贴纸感就没了。
 * 泛洪只清除「从画面边缘能连通到」的白色，遇到描边外侧那道浅灰轮廓就会停下，
 * 描边因此得以保留。主体内部的白色（比如建筑墙面）也不受影响。
 *
 * 性能：先缩到 320px 再处理，约 10 万像素，一次几毫秒，且结果会被缓存。
 */

/** 处理尺寸。贴纸在画布上显示不到 100px，320 足够清晰且够快 */
const WORK_SIZE = 320;

/** 判定为「背景白」的阈值。生成图的白底很干净，取 234 能容忍轻微压缩噪点 */
const WHITE_THRESHOLD = 234;

/** 同一张图只抠一次 */
const cache = new Map<string, string>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

export async function cutoutWhiteBackground(src: string): Promise<string> {
  const cached = cache.get(src);
  if (cached !== undefined) {
    return cached;
  }

  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = WORK_SIZE;
  canvas.height = WORK_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return src;
  }

  // 等比缩放并居中，空出来的地方留白 —— 反正接下来要被抠掉
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WORK_SIZE, WORK_SIZE);
  const scale = Math.min(WORK_SIZE / img.width, WORK_SIZE / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  ctx.drawImage(img, (WORK_SIZE - drawW) / 2, (WORK_SIZE - drawH) / 2, drawW, drawH);

  const imageData = ctx.getImageData(0, 0, WORK_SIZE, WORK_SIZE);
  const data = imageData.data;
  const total = WORK_SIZE * WORK_SIZE;
  const visited = new Uint8Array(total);
  // 用定长数组当队列，避免 Array.shift 的 O(n) 开销
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isWhite = (index: number): boolean => {
    const offset = index * 4;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    return r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD;
  };

  const push = (index: number): void => {
    if (visited[index] === 1 || !isWhite(index)) {
      return;
    }
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  // 种子：四条边上的所有像素
  for (let x = 0; x < WORK_SIZE; x += 1) {
    push(x);
    push((WORK_SIZE - 1) * WORK_SIZE + x);
  }
  for (let y = 0; y < WORK_SIZE; y += 1) {
    push(y * WORK_SIZE);
    push(y * WORK_SIZE + WORK_SIZE - 1);
  }

  while (head < tail) {
    const index = queue[head] ?? 0;
    head += 1;
    const x = index % WORK_SIZE;
    const y = Math.floor(index / WORK_SIZE);
    if (x > 0) {
      push(index - 1);
    }
    if (x < WORK_SIZE - 1) {
      push(index + 1);
    }
    if (y > 0) {
      push(index - WORK_SIZE);
    }
    if (y < WORK_SIZE - 1) {
      push(index + WORK_SIZE);
    }
  }

  let clearedCount = 0;
  for (let i = 0; i < total; i += 1) {
    if (visited[i] === 1) {
      data[i * 4 + 3] = 0;
      clearedCount += 1;
    }
  }

  // 兜底：万一整张图被判成背景（比如模型返回了一张纯白图），退回原图，别给用户一片空白
  if (clearedCount > total * 0.98) {
    cache.set(src, src);
    return src;
  }

  ctx.putImageData(imageData, 0, 0);
  const result = canvas.toDataURL('image/png');
  cache.set(src, result);
  return result;
}
