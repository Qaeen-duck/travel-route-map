import { useEffect, useRef, useState } from 'react';
import { amapAdapter } from '@/adapters/amapAdapter';
import { PoiSearchError } from '@/adapters/poiSearchAdapter';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PoiCandidate } from '@/types/poi';

/** PRD 第六章：输入后 400ms 防抖再发请求 */
const DEBOUNCE_MS = 400;

interface Props {
  onPicked: (candidate: PoiCandidate) => void;
}

/**
 * 地点搜索框（PRD F2.1 / AC-3）
 * 状态覆盖：空闲 / 加载中（骨架屏）/ 有结果 / 无结果 / 出错（带重试）
 */
export default function PoiSearchBox({ onPicked }: Props) {
  const [keyword, setKeyword] = useState('');
  const [candidates, setCandidates] = useState<PoiCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  /** 手动重试用的计数器，加一就重新触发下面那个 effect */
  const [retryTick, setRetryTick] = useState(0);

  const debouncedKeyword = useDebouncedValue(keyword, DEBOUNCE_MS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = debouncedKeyword.trim();
    if (trimmed.length === 0) {
      setCandidates([]);
      setError(null);
      setLoading(false);
      return;
    }

    // 用户继续打字时，上一次没回来的请求要中断，避免旧结果覆盖新结果
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    amapAdapter
      .search(trimmed, controller.signal)
      .then((list) => {
        setCandidates(list);
        setLoading(false);
      })
      .catch((err: unknown) => {
        // 主动取消不是错误，静默忽略
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setCandidates([]);
        setLoading(false);
        if (err instanceof PoiSearchError) {
          setError({ message: err.message, retryable: err.retryable });
        } else {
          setError({ message: '地点搜索出问题了，请稍后重试。', retryable: true });
        }
      });

    return () => controller.abort();
  }, [debouncedKeyword, retryTick]);

  function handlePick(candidate: PoiCandidate): void {
    onPicked(candidate);
    setKeyword('');
    setCandidates([]);
    inputRef.current?.focus();
  }

  const showPanel = keyword.trim().length > 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setKeyword('');
            }
          }}
          placeholder="搜索地点，如：西湖"
          className="w-full rounded-md border border-softbrown/50 bg-wash px-3 py-2 text-sm text-inkbrown outline-none placeholder:text-inkbrown/40 focus:border-terracotta"
        />
        {loading ? (
          <span
            aria-label="搜索中"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-softbrown/30 border-t-terracotta"
          />
        ) : null}
      </div>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-softbrown/40 bg-cream shadow-lg">
          {/* 加载中：骨架屏（PRD 状态清单要求，不要空白闪烁） */}
          {loading ? (
            <ul className="space-y-2 p-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="space-y-1">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-softbrown/20" />
                  <div className="h-2 w-1/3 animate-pulse rounded bg-softbrown/10" />
                </li>
              ))}
            </ul>
          ) : null}

          {/* 错误态：提示 + 重试 */}
          {!loading && error ? (
            <div className="p-3 text-sm text-inkbrown">
              <p className="mb-2">{error.message}</p>
              {error.retryable ? (
                <button
                  type="button"
                  className="rounded border border-softbrown px-3 py-1 text-xs hover:bg-wash"
                  onClick={() => setRetryTick((t) => t + 1)}
                >
                  重试
                </button>
              ) : null}
            </div>
          ) : null}

          {/* 无结果 */}
          {!loading && !error && candidates.length === 0 ? (
            <p className="p-3 text-sm text-inkbrown/60">没有找到这个地点，换个说法试试？</p>
          ) : null}

          {/* 候选列表：名称 + 区县，用于消歧（AC-3） */}
          {!loading && !error && candidates.length > 0 ? (
            <ul>
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(c)}
                    className="block w-full px-3 py-2 text-left hover:bg-wash"
                  >
                    <span className="text-sm text-inkbrown">{c.name}</span>
                    <span className="ml-2 text-xs text-inkbrown/50">{c.district || c.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
