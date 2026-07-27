/**
 * 手帐数据层（HTTP 版）——第二期后端化后的主存储。
 *
 * 函数签名与原 lib/db.ts（IndexedDB 版）保持一致，页面切换 import 来源即可，
 * 对页面代码无感。写操作成功后通过 emitJournalChanged() 通知 useApiQuery 刷新。
 *
 * 后端：Spring Boot journal 模块，前缀 /api/journal，ADMIN 可访问，
 * user_id 由服务端从博客 JWT 解析（前端不传）。
 */
import type { CustomMoodConfig, DayRecord } from '../types';
import { apiFetch } from './http';
import { emitJournalChanged } from './journalEvents';

/** 导出/导入数据格式（与 db.ts 的 ExportData 一致，v2） */
export interface ExportData {
  version: number;
  exportedAt: string;
  records: DayRecord[];
  customMoods: CustomMoodConfig[];
}

/** 导入结果 */
export interface ImportResult {
  recordsImported: number;
  moodsImported: number;
}

// ─── 记录操作 ────────────────────────────────────────

/** 按 date 字符串获取单日记录 */
export async function getRecordByDate(date: string): Promise<DayRecord | undefined> {
  const data = await apiFetch<DayRecord | null>(`/records/${encodeURIComponent(date)}`);
  return data ?? undefined;
}

/** 获取某月所有记录 */
export async function getRecordsByMonth(year: number, month: number): Promise<DayRecord[]> {
  const mm = `${year}-${String(month + 1).padStart(2, '0')}`;
  return apiFetch<DayRecord[]>(`/records?month=${mm}`);
}

/** 获取某年所有记录 */
export async function getRecordsByYear(year: number): Promise<DayRecord[]> {
  return apiFetch<DayRecord[]>(`/records?year=${year}`);
}

/** 获取全部记录（按 date 升序） */
export async function getAllRecords(): Promise<DayRecord[]> {
  return apiFetch<DayRecord[]>('/records');
}

/**
 * 创建或更新单日记录（patch 语义，与 db.ts 一致）：
 * patch 中出现的字段才更新；learnings 出现即全量替换当日清单。
 */
export async function upsertRecord(date: string, patch: Partial<DayRecord>): Promise<void> {
  const body: Record<string, unknown> = {};
  if ('mood' in patch) body.mood = patch.mood;
  if ('diary' in patch) body.diary = patch.diary;
  if ('learnings' in patch && patch.learnings) body.learnings = patch.learnings;
  await apiFetch<DayRecord>(`/records/${encodeURIComponent(date)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  emitJournalChanged();
}

/** 删除单日记录 */
export async function deleteRecord(date: string): Promise<void> {
  await apiFetch<void>(`/records/${encodeURIComponent(date)}`, { method: 'DELETE' });
  emitJournalChanged();
}

// ─── 自定义心情操作 ──────────────────────────────────

/** 获取所有自定义心情（按创建时间排序） */
export async function getCustomMoods(): Promise<CustomMoodConfig[]> {
  return apiFetch<CustomMoodConfig[]>('/moods/custom');
}

/** 添加自定义心情，返回 moodId */
export async function addCustomMood(config: Omit<CustomMoodConfig, 'createdAt'>): Promise<{ moodId: string }> {
  await apiFetch<CustomMoodConfig>('/moods/custom', {
    method: 'POST',
    body: JSON.stringify(config),
  });
  emitJournalChanged();
  return { moodId: config.id };
}

/** 更新自定义心情（保持 db.ts 的部分 patch 语义：先读后合并再整体提交） */
export async function updateCustomMood(moodId: string, patch: Partial<CustomMoodConfig>): Promise<void> {
  const moods = await getCustomMoods();
  const current = moods.find((m) => m.id === moodId);
  if (!current) return;
  const merged: Omit<CustomMoodConfig, 'createdAt'> = {
    id: moodId,
    label: patch.label ?? current.label,
    emoji: patch.emoji ?? current.emoji,
    solid: patch.solid ?? current.solid,
    ink: patch.ink ?? current.ink,
    tint: patch.tint ?? current.tint,
    dark: patch.dark ?? current.dark,
  };
  await apiFetch<CustomMoodConfig>(`/moods/custom/${encodeURIComponent(moodId)}`, {
    method: 'PUT',
    body: JSON.stringify(merged),
  });
  emitJournalChanged();
}

/** 删除自定义心情 */
export async function deleteCustomMood(moodId: string): Promise<void> {
  await apiFetch<void>(`/moods/custom/${encodeURIComponent(moodId)}`, { method: 'DELETE' });
  emitJournalChanged();
}

// ─── 导出/导入 ───────────────────────────────────────

/** 导出全部数据（服务端数据，保持 v2 JSON 格式） */
export async function exportAllData(): Promise<ExportData> {
  return apiFetch<ExportData>('/export');
}

/** 导入数据（兼容 v1 纯数组 / v2 含 customMoods），服务端按日期幂等 upsert */
export async function importData(data: ExportData | DayRecord[]): Promise<ImportResult> {
  const result = await apiFetch<ImportResult>('/import', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  emitJournalChanged();
  return result;
}

// ─── 搜索 ────────────────────────────────────────────

/** 搜索日记内容（服务端 LIKE，按 updatedAt 倒序） */
export async function searchDiary(keyword: string): Promise<DayRecord[]> {
  return apiFetch<DayRecord[]>(`/search?keyword=${encodeURIComponent(keyword)}`);
}
