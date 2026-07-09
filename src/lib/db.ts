import Dexie, { type Table } from 'dexie';
import type { DayRecord } from '../types';

/** 学习手帐 IndexedDB 数据库 */
export class StudyJournalDB extends Dexie {
  records!: Table<DayRecord, number>;

  constructor() {
    super('StudyJournalDB');
    this.version(1).stores({
      records: '++id, date, mood, updatedAt',
    });
  }
}

export const db = new StudyJournalDB();

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

/** 导出全部数据 */
export async function exportAllData(): Promise<DayRecord[]> {
  return db.records.toArray();
}

/** 导入数据（覆盖模式） */
export async function importData(records: DayRecord[]): Promise<void> {
  await db.transaction('rw', db.records, async () => {
    await db.records.clear();
    await db.records.bulkAdd(records);
  });
}
