import {
  ImageGenError,
  type GenerateIconInput,
  type GenerateIconResult,
  type ImageGenAdapter,
} from '@/adapters/imageGenAdapter';
import { fetchImageAsBlob } from '@/lib/imageFile';
import { buildImg2ImgPrompt, buildText2ImgPrompt, NEGATIVE_PROMPT } from '@/lib/iconPrompt';

/**
 * 阿里云百炼 · 千问图像生成与编辑 3.0 实现
 *
 * 几个关键决定，都是读官方文档后定的：
 *
 * 1) 走「同步接口」multimodal-generation/generation，不走异步任务轮询。
 *    同一份文档里另有一个 image-generation/generation 端点强制异步（要轮询 task_id），
 *    对我们没必要 —— 单张图生成十几秒，同步等待更简单，状态机也少一半分支。
 *
 * 2) 用旧域名 dashscope.aliyuncs.com。文档推荐迁移到 {WorkspaceId}.cn-beijing.maas.aliyuncs.com，
 *    但那需要用户再去控制台查一个「业务空间 ID」填进环境变量。文档明确写了旧域名仍可正常使用，
 *    MVP 阶段少一个配置项就少一个出错点。
 *
 * 3) prompt_extend 显式关掉（默认是 true）。
 *    开启后模型会自动改写我们的提示词 —— 而 F3.9 的全部意义就是「prompt 固化，用户和模型都别乱改」。
 *    让它改写等于亲手打开风格漂移的闸门，与手段 H3 直接冲突，所以必须关。
 *
 * 4) 每次生成都用随机 seed，让「重新生成」真的能出不一样的结果（F3.5）。
 */

const API_PATH = '/dashscope/api/v1/services/aigc/multimodal-generation/generation';
const MODEL = 'qwen-image-3.0';

/** PRD 第六章：≥30 秒未返回视为失败 */
const TIMEOUT_MS = 30000;

/** 附录 A.4 建议尺寸。API 支持 512*512 至 2048*2048 */
const OUTPUT_SIZE = '1024*1024';

/**
 * 文生图路径是否也把色卡当参考图传进去（手段 H1 覆盖到无照片场景）。
 * 首轮实测发现不传色卡时文生图色调明显跑偏，故默认开启。
 * 若模型误把色块本身画进画面，改成 false 即退回纯 prompt 文字约束。
 */
const SEND_PALETTE_REF_IN_TEXT2IMG = false;

interface DashscopeContentItem {
  image?: string;
  text?: string;
}

interface DashscopeResponse {
  output?: {
    choices?: Array<{
      finish_reason?: string;
      message?: { role?: string; content?: DashscopeContentItem[] };
    }>;
  };
  code?: string;
  message?: string;
  request_id?: string;
}

/** 把百炼错误码翻译成用户能看懂的话 */
function translateError(code: string, rawMessage: string): ImageGenError {
  const normalized = code.toLowerCase();
  if (normalized.includes('apikey') || normalized.includes('unauthorized')) {
    return new ImageGenError('图片生成服务的密钥无效，请检查配置。', false);
  }
  if (normalized.includes('throttl') || normalized.includes('limit') || normalized.includes('flow')) {
    return new ImageGenError('生成请求太密集了，等几秒再试一次。', true);
  }
  if (normalized.includes('quota') || normalized.includes('balance') || normalized.includes('arrear')) {
    return new ImageGenError('图片生成的额度用完了，需要去阿里云百炼充值后才能继续。', false);
  }
  if (normalized.includes('datainspection') || normalized.includes('content')) {
    // 内容审核不通过：换张照片就行，不是系统坏了
    return new ImageGenError('这张照片没能通过内容审核，换一张试试。', false);
  }
  return new ImageGenError(`图片生成失败了（${rawMessage || code || '未知原因'}），可以再试一次。`, true);
}

export const dashscopeAdapter: ImageGenAdapter = {
  name: '阿里云百炼',
  model: MODEL,

  async generateIcon(input: GenerateIconInput): Promise<GenerateIconResult> {
    const apiKey = import.meta.env['VITE_DASHSCOPE_API_KEY'];
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      throw new ImageGenError('图片生成服务还没配置好，暂时无法生成图标。', false);
    }

    // 有照片走图生图（主路径），没照片走文生图（补充路径）—— PRD F3.1
    const isImg2Img = input.photoDataUrl !== null;
    const prompt = isImg2Img
      ? buildImg2ImgPrompt(input.poiName)
      : buildText2ImgPrompt(input.poiName);

    // 图片顺序对应 prompt 里的「图一 / 图二」，不能随便调换。
    // 有照片：图一=照片，图二=色卡；无照片：图一=色卡。
    //
    // 首轮实测教训：文生图路径原本不传色卡，导致 H1 色板一致性手段对它完全失效，
    // 出来的图色调明显偏离附录 A.1。现在两条路径都带色卡。
    // 如果发现模型把色块本身画进了画面，把下面这个开关关掉即可退回纯文字约束。
    const content: DashscopeContentItem[] = [];
    if (input.photoDataUrl !== null) {
      content.push({ image: input.photoDataUrl });
      content.push({ image: input.paletteRefDataUrl });
    } else if (SEND_PALETTE_REF_IN_TEXT2IMG) {
      content.push({ image: input.paletteRefDataUrl });
    }
    content.push({ text: prompt });

    const body = {
      model: MODEL,
      input: { messages: [{ role: 'user', content }] },
      parameters: {
        negative_prompt: NEGATIVE_PROMPT,
        size: OUTPUT_SIZE,
        n: 1,
        prompt_extend: false,
        watermark: false,
        seed: Math.floor(Math.random() * 2147483647),
      },
    };

    // 自带超时，同时保留外部取消能力
    const timeoutController = new AbortController();
    const timer = window.setTimeout(() => timeoutController.abort(), TIMEOUT_MS);
    const onExternalAbort = () => timeoutController.abort();
    input.signal?.addEventListener('abort', onExternalAbort);

    try {
      const response = await fetch(API_PATH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: timeoutController.signal,
      });

      const data = (await response.json()) as DashscopeResponse;

      // 失败时百炼把错误放在顶层 code / message
      if (!response.ok || (data.code !== undefined && data.code.length > 0)) {
        throw translateError(data.code ?? '', data.message ?? '');
      }

      const remoteUrl = data.output?.choices?.[0]?.message?.content?.[0]?.image;
      if (typeof remoteUrl !== 'string' || remoteUrl.length === 0) {
        throw new ImageGenError('生成服务没有返回图片，请再试一次。', true);
      }

      // 决策 3：链接 24 小时失效，必须立刻取回本地
      const blob = await fetchImageAsBlob(remoteUrl);
      return { blob, remoteUrl };
    } catch (error) {
      if (error instanceof ImageGenError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        // 区分「用户点了取消」和「超时」：前者交给调用方静默处理
        if (input.signal?.aborted === true) {
          throw error;
        }
        throw new ImageGenError('生成等了 30 秒还没结果，先取消了，可以再试一次。', true);
      }
      throw new ImageGenError('生成图标时出问题了，请再试一次。', true);
    } finally {
      window.clearTimeout(timer);
      input.signal?.removeEventListener('abort', onExternalAbort);
    }
  },
};
