/**
 * 轻量数据变更事件总线。
 *
 * 替代 Dexie useLiveQuery 的自动响应能力：api.ts 的写操作（upsert/delete/import/心情 CRUD）
 * 成功后调用 emitJournalChanged()，所有挂载中的 useApiQuery 订阅者自动重新拉取，
 * 页面代码的响应式体验与原来 IndexedDB 版本一致。
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeJournal(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitJournalChanged(): void {
  listeners.forEach((listener) => listener());
}
