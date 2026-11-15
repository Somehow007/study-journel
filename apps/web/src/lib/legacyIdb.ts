/**
 * 一次性读取旧版浏览器 IndexedDB（StudyJournalDB，Dexie v1–v3）中的数据，
 * 用于把第一期历史记录迁移到 v3 服务端。用原生 IndexedDB 读取，不引入 Dexie。
 *
 * 对象库：records（DayRecord[]）、customMoods（CustomMoodConfig[]）。
 * 库不存在 / 无对应对象库 / 为空 → 返回空数组（调用方据此提示「没有可迁移的数据」）。
 */
const DB_NAME = 'StudyJournalDB';
const STORE_NAMES = ['records', 'customMoods'] as const;

export interface LegacyIdbData {
  records: unknown[];
  customMoods: unknown[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('无法打开本地旧数据库'));
    req.onblocked = () =>
      reject(new Error('本地旧数据库被其他标签页占用，请关闭后重试'));
  });
}

function getAll(db: IDBDatabase, store: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(store)) {
      resolve([]);
      return;
    }
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** 读取旧库全部记录；库不存在时直接返回空（不创建空库）。 */
export async function readLegacyIdb(): Promise<LegacyIdbData> {
  // indexedDB.databases() 可选：先探测库是否存在，避免 open() 顺手建一个空库
  if (typeof indexedDB.databases === 'function') {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === DB_NAME)) {
      return { records: [], customMoods: [] };
    }
  }
  const db = await openDb();
  try {
    const [records, customMoods] = await Promise.all([
      getAll(db, 'records'),
      getAll(db, 'customMoods'),
    ]);
    return { records, customMoods };
  } finally {
    db.close();
  }
}

export { STORE_NAMES };
