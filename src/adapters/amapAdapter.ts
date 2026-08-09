import { PoiSearchError, type PoiSearchAdapter } from '@/adapters/poiSearchAdapter';
import type { PoiCandidate } from '@/types/poi';

/**
 * 高德实现（境内）
 *
 * 用「输入提示 inputtips」而不是「搜索POI 2.0」的原因：
 * 官方文档写明搜索 POI 2.0「目前面向企业开发者试用阶段」，个人 Key 调不通。
 * inputtips 是 v3 老接口，个人开发者可用，而且它的返回天然带 district（区县），
 * 正好满足 AC-3「候选项要含名称 + 所在城市，便于消歧」。
 *
 * 请求走 /amap 前缀，由 Vite dev server 代理到 restapi.amap.com（见 vite.config.ts）。
 */

/** 高德 inputtips 单条返回。location 在没有坐标时会是空数组 []，所以类型是联合 */
interface AmapTip {
  id?: string;
  name?: string;
  district?: string;
  address?: string | string[];
  location?: string | string[];
}

interface AmapInputTipsResponse {
  /** "1" 成功，"0" 失败 */
  status?: string;
  info?: string;
  infocode?: string;
  tips?: AmapTip[];
}

/** 请求超时。PRD 第六章要求搜索 500ms 内出结果，8 秒还没回来肯定是出问题了 */
const REQUEST_TIMEOUT_MS = 8000;

/** 高德把 address 这类字段在「无值」时返回空数组而不是空字符串，这里统一成字符串 */
function normalizeText(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

/** location 形如 "120.144500,30.240100"，拆成数字；拆不出来返回 null */
function parseLocation(value: string | string[] | undefined): { lng: number; lat: number } | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const parts = value.split(',');
  const lngRaw = parts[0];
  const latRaw = parts[1];
  if (lngRaw === undefined || latRaw === undefined) {
    return null;
  }
  const lng = Number.parseFloat(lngRaw);
  const lat = Number.parseFloat(latRaw);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  return { lng, lat };
}

/** 把高德的错误码翻译成用户能看懂的话 */
function translateAmapError(infocode: string, info: string): PoiSearchError {
  switch (infocode) {
    case '10001':
      return new PoiSearchError('地图服务的密钥无效，请检查配置后重试。', false);
    case '10003':
    case '10004':
    case '10019':
    case '10020':
      return new PoiSearchError('今天的地点搜索次数用完了，请明天再试。', false);
    case '10009':
    case '10010':
      return new PoiSearchError('地图服务拒绝了这次请求，可能是访问限制设置有问题。', false);
    default:
      return new PoiSearchError(`地点搜索失败了（${info || '未知原因'}），请稍后重试。`, true);
  }
}

export const amapAdapter: PoiSearchAdapter = {
  name: '高德地图',

  async search(keyword: string, signal?: AbortSignal): Promise<PoiCandidate[]> {
    const key = import.meta.env['VITE_AMAP_KEY'];
    if (typeof key !== 'string' || key.length === 0) {
      throw new PoiSearchError('地图服务还没配置好，暂时无法搜索地点。', false);
    }

    const trimmed = keyword.trim();
    if (trimmed.length === 0) {
      return [];
    }

    // 自带一个超时闹钟，同时又要能被外部的 signal 取消，所以把两个信号合并
    const timeoutController = new AbortController();
    const timer = window.setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
    const onExternalAbort = () => timeoutController.abort();
    signal?.addEventListener('abort', onExternalAbort);

    const params = new URLSearchParams({
      key,
      keywords: trimmed,
      datatype: 'poi', // 只要 POI，不要公交站和道路
    });

    try {
      const response = await fetch(`/amap/v3/assistant/inputtips?${params.toString()}`, {
        signal: timeoutController.signal,
      });

      if (!response.ok) {
        throw new PoiSearchError('地点搜索没能连上服务器，请检查网络后重试。', true);
      }

      const data = (await response.json()) as AmapInputTipsResponse;

      if (data.status !== '1') {
        throw translateAmapError(data.infocode ?? '', data.info ?? '');
      }

      const tips = data.tips ?? [];
      const candidates: PoiCandidate[] = [];
      for (const tip of tips) {
        const location = parseLocation(tip.location);
        // 没有坐标的提示项（比如纯行政区名）直接丢掉 —— PRD F2.2 要求节点必须有真实经纬度
        if (!location || !tip.name) {
          continue;
        }
        candidates.push({
          id: tip.id ?? `${tip.name}-${location.lng},${location.lat}`,
          name: tip.name,
          district: tip.district ?? '',
          address: normalizeText(tip.address),
          lat: location.lat,
          lng: location.lng,
        });
      }
      return candidates;
    } catch (error) {
      if (error instanceof PoiSearchError) {
        throw error;
      }
      // 外部主动取消（用户又改了输入）不算错误，交给调用方按 AbortError 静默处理
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw new PoiSearchError('地点搜索出问题了，请稍后重试。', true);
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  },
};
