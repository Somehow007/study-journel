/**
 * 手帐数据层（v3 /api/v1）—— days/entries/subjects/states/settings/
 * search/stats/streak/export/import。写操作后由调用方经 TanStack Query
 * invalidate 刷新（不再走事件总线）。
 */
import { apiFetch } from './http';
import type {
  DayDetail,
  DayMark,
  Entry,
  EntryPatch,
  EntryRequest,
  ExportData,
  ImportResult,
  JournalState,
  SearchResult,
  Setting,
  SettingsPatch,
  StatePatch,
  StateRequest,
  StatsHeatmapCell,
  StatsMonth,
  StatsYear,
  StreakResult,
  Subject,
  SubjectPatch,
  SubjectRequest,
} from './types/api';

const enc = encodeURIComponent;

// ─── 日 ──────────────────────────────────────────────

/** 单日聚合标记（GET /days?from&to，含 taskDone/taskTotal） */
export async function listDayMarks(from: string, to: string): Promise<DayMark[]> {
  return apiFetch<DayMark[]>(`/days?from=${enc(from)}&to=${enc(to)}`);
}

/** 单日详情（state/diary/entries/tasks/checkins） */
export async function getDay(date: string): Promise<DayDetail> {
  return apiFetch<DayDetail>(`/days/${enc(date)}`);
}

/** patch 语义：出现的字段才更新；stateId 传 null 清除 */
export async function patchDay(date: string, patch: { stateId?: string | null; diary?: string }): Promise<DayDetail> {
  return apiFetch<DayDetail>(`/days/${enc(date)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteDay(date: string): Promise<void> {
  await apiFetch<unknown>(`/days/${enc(date)}`, { method: 'DELETE' });
}

// ─── 条目（学习记录）─────────────────────────────────

export async function createEntry(req: EntryRequest): Promise<Entry> {
  return apiFetch<Entry>('/entries', { method: 'POST', body: JSON.stringify(req) });
}

export async function updateEntry(id: string, patch: EntryPatch): Promise<Entry> {
  return apiFetch<Entry>(`/entries/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteEntry(id: string): Promise<void> {
  await apiFetch<unknown>(`/entries/${enc(id)}`, { method: 'DELETE' });
}

export async function reorderEntries(date: string, ids: string[]): Promise<void> {
  await apiFetch<unknown>('/entries/reorder', {
    method: 'POST',
    body: JSON.stringify({ date, ids }),
  });
}

// ─── 科目 / 状态字典 ─────────────────────────────────

export async function listSubjects(): Promise<Subject[]> {
  return apiFetch<Subject[]>('/subjects');
}

export async function createSubject(req: SubjectRequest): Promise<Subject> {
  return apiFetch<Subject>('/subjects', { method: 'POST', body: JSON.stringify(req) });
}

export async function updateSubject(id: string, patch: SubjectPatch): Promise<Subject> {
  return apiFetch<Subject>(`/subjects/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function archiveSubject(id: string): Promise<void> {
  await apiFetch<unknown>(`/subjects/${enc(id)}/archive`, { method: 'POST' });
}

export async function listStates(): Promise<JournalState[]> {
  return apiFetch<JournalState[]>('/states');
}

export async function createState(req: StateRequest): Promise<JournalState> {
  return apiFetch<JournalState>('/states', { method: 'POST', body: JSON.stringify(req) });
}

export async function updateState(id: string, patch: StatePatch): Promise<JournalState> {
  return apiFetch<JournalState>(`/states/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function archiveState(id: string): Promise<void> {
  await apiFetch<unknown>(`/states/${enc(id)}/archive`, { method: 'POST' });
}

// ─── 设置 ────────────────────────────────────────────

export async function getSettings(): Promise<Setting> {
  return apiFetch<Setting>('/settings');
}

export async function patchSettings(patch: SettingsPatch): Promise<Setting> {
  return apiFetch<Setting>('/settings', { method: 'PATCH', body: JSON.stringify(patch) });
}

// ─── 搜索 / 统计 / 连续 ──────────────────────────────

export async function searchJournal(keyword: string, type: 'all' | 'entry' | 'diary' = 'all'): Promise<SearchResult> {
  return apiFetch<SearchResult>(`/search?q=${enc(keyword)}&type=${type}`);
}

export async function statsMonth(period: string): Promise<StatsMonth> {
  return apiFetch<StatsMonth>(`/stats/month?period=${enc(period)}`);
}

export async function statsYear(year: number): Promise<StatsYear> {
  return apiFetch<StatsYear>(`/stats/year?year=${year}`);
}

export async function statsHeatmap(from: string, to: string): Promise<StatsHeatmapCell[]> {
  return apiFetch<StatsHeatmapCell[]>(`/stats/heatmap?from=${enc(from)}&to=${enc(to)}`);
}

export async function getStreak(): Promise<StreakResult> {
  return apiFetch<StreakResult>('/streak');
}

// ─── 导出 / 导入 ─────────────────────────────────────

/** v3 全量导出（裸 JSON 非包络；apiFetch 透传） */
export async function exportAllData(): Promise<ExportData> {
  return apiFetch<ExportData>('/export');
}

/** 导入 v3 原生 / v2{records,customMoods} / v1 数组（服务端兼容） */
export async function importData(data: unknown): Promise<ImportResult> {
  return apiFetch<ImportResult>('/import', { method: 'POST', body: JSON.stringify(data) });
}
