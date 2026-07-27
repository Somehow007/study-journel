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
 * - 订阅 journalEvents 数据变更总线：任何写操作（upsert/delete/import/心情 CRUD）
 *   成功后自动重新拉取，页面响应式体验与原 IndexedDB 版一致
 */
export function useApiQuery<T>(fetcher: () => Promise<T>, deps: unknown[]): ApiQueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  // fetcher 每次渲染可能是新闭包，用 ref 持有最新版，避免把 fetcher 放进依赖触发循环
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => subscribeJournal(() => setTick((t) => t + 1)), []);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refresh };
}
