import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeJournal } from './journalEvents';

interface ApiQueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  /** 手动重新拉取 */
  refresh: () => void;
}

/**
 * 替代 dexie-react-hooks 的 useLiveQuery：
 * - 挂载时与 deps 变化时拉取
 * - 订阅 journalEvents 数据变更总线：任何写操作成功后自动重新拉取
 * - 首次 / deps 变化显示 loading；后台刷新（tick）不把页面打回骨架屏
 */
export function useApiQuery<T>(fetcher: () => Promise<T>, deps: unknown[]): ApiQueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const depsKey = JSON.stringify(deps);
  const prevDepsKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const depsChanged = prevDepsKey.current !== depsKey;
    prevDepsKey.current = depsKey;
    if (depsChanged) {
      setLoading(true);
    }
    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [depsKey, tick]);

  useEffect(() => subscribeJournal(() => setTick((t) => t + 1)), []);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refresh };
}
