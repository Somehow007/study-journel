import Dexie, { type Table } from 'dexie';
import type { DayRecord, CustomMoodConfig } from '../types';

/** 学习手帐 IndexedDB 数据库 */
export class StudyJournalDB extends Dexie {
  records!: Table<DayRecord, number>;
  customMoods!: Table<CustomMoodConfig, string>;

  constructor() {
    super('StudyJournalDB');
    this.version(1).stores({
      records: '++id, date, mood, updatedAt',
    });
    this.version(2).stores({
      records: '++id, date, mood, updatedAt',
      customMoods: 'id, createdAt',
    });
    // v3: 修补 v2 中遗漏的 createdAt 索引（若已有 v2 数据库则需此升级）
    this.version(3).stores({
      records: '++id, date, mood, updatedAt',
      customMoods: 'id, createdAt',
    });
  }
}

export const db = new StudyJournalDB();

// 启动时显式打开一次：若浏览器残留更高版本的同名库（VersionError）或被其他标签页阻塞，
// 会在控制台给出明确错误，而不是让所有读写静默失败（表现为"点击无反应"）
db.on('blocked', () => {
  console.warn('[StudyJournalDB] 数据库升级被其他打开的标签页阻塞，请关闭其他标签页后刷新');
});
db.open().catch((err) => {
  console.error('[StudyJournalDB] 数据库打开失败（可能本地存在更高版本的同名库，需清除站点数据）：', err);
});

// ─── 记录操作 ────────────────────────────────────────

/** 按 date 字符串获取单日记录 */
export async function getRecordByDate(date: string): Promise<DayRecord | undefined> {
  return db.records.where('date').equals(date).first();
}

/** 获取某月所有记录 */
export async function getRecordsByMonth(year: number, month: number): Promise<DayRecord[]> {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const all = await db.records.where('date').startsWith(prefix).toArray();
  return all;
}

/** 获取某年所有记录 */
export async function getRecordsByYear(year: number): Promise<DayRecord[]> {
  const prefix = `${year}-`;
  return db.records.where('date').startsWith(prefix).toArray();
}

/** 创建或更新单日记录 */
export async function upsertRecord(date: string, patch: Partial<DayRecord>): Promise<void> {
  const existing = await getRecordByDate(date);
  const now = Date.now();

  if (existing) {
    await db.records.update(existing.id!, {
      ...patch,
      updatedAt: now,
    });
  } else {
    const newRecord: DayRecord = {
      date,
      mood: null,
      learnings: [],
      diary: '',
      createdAt: now,
      updatedAt: now,
      ...patch,
    };
    await db.records.add(newRecord);
  }
}

/** 删除单日记录 */
export async function deleteRecord(date: string): Promise<void> {
  const existing = await getRecordByDate(date);
  if (existing) {
    await db.records.delete(existing.id!);
  }
}

// ─── 自定义心情操作 ──────────────────────────────────

/** 获取所有自定义心情（按创建时间排序） */
export async function getCustomMoods(): Promise<CustomMoodConfig[]> {
  return db.customMoods.orderBy('createdAt').toArray();
}

/** 添加自定义心情，返回 moodId */
export async function addCustomMood(config: Omit<CustomMoodConfig, 'createdAt'>): Promise<{ moodId: string }> {
  const now = Date.now();
  const record: CustomMoodConfig = {
    ...config,
    createdAt: now,
  };
  await db.customMoods.add(record);
  return { moodId: config.id };
}

/** 更新自定义心情 */
export async function updateCustomMood(moodId: string, patch: Partial<CustomMoodConfig>): Promise<void> {
  const existing = await db.customMoods.where('id').equals(moodId).first();
  if (existing) {
    await db.customMoods.update(moodId, patch);
  }
}

/** 删除自定义心情 */
export async function deleteCustomMood(moodId: string): Promise<void> {
  await db.customMoods.delete(moodId);
}

// ─── 导出/导入 ───────────────────────────────────────

interface ExportData {
  version: 2;
  exportedAt: string;
  records: DayRecord[];
  customMoods: CustomMoodConfig[];
}

/** 导出全部数据（含自定义心情） */
export async function exportAllData(): Promise<ExportData> {
  const [records, customMoods] = await Promise.all([
    db.records.toArray(),
    db.customMoods.toArray(),
  ]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    records,
    customMoods,
  };
}

/** 导入数据（覆盖模式，兼容 v1 和 v2 格式） */
export async function importData(data: ExportData | DayRecord[]): Promise<void> {
  await db.transaction('rw', db.records, db.customMoods, async () => {
    // 兼容 v1 格式（纯 records 数组）
    if (Array.isArray(data)) {
      await db.records.clear();
      await db.records.bulkAdd(data);
      return;
    }

    await db.records.clear();
    await db.records.bulkAdd(data.records);
    if (data.customMoods && data.customMoods.length > 0) {
      await db.customMoods.clear();
      await db.customMoods.bulkAdd(data.customMoods);
    }
  });
}

// ─── 搜索 ────────────────────────────────────────────

/** 搜索日记内容（diary 非索引字段，用 filter 全表扫描，数据量小可接受） */
export async function searchDiary(keyword: string): Promise<DayRecord[]> {
  const lower = keyword.toLowerCase();
  const all = await db.records
    .filter((r) => !!r.diary && r.diary.toLowerCase().includes(lower))
    .toArray();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}
