import { useEffect, useState } from 'react';

/**
 * 防抖 Hook：值稳定 delay 毫秒后才对外抛出新值。
 * 用于 PRD 第六章「POI 搜索输入 → 400ms 防抖 → 触发请求」，
 * 避免用户每敲一个字就打一次高德接口，既省配额也省得候选列表乱跳。
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    // 值在 delay 内又变了就取消上一次，重新计时
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
