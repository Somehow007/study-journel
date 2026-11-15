// v3 API DTO 镜像 —— 手写对齐 apps/server/internal/httpapi/*.go 与 docs/data-model.md §3/§4。
// 约定：日期 YYYY-MM-DD 字符串；时间戳 Unix 毫秒；Go *T → `| null`；omitempty → `?`。

export interface User {
  id: string;
  username: string;
}

// ─── 字典 ────────────────────────────────────────────

export interface Subject {
  id: string;
  name: string;
  color: string;
  sort: number;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type StatePolarity = -1 | 0 | 1;

export interface JournalState {
  id: string;
  builtinKey: string | null;
  label: string;
  color: string;
  polarity: StatePolarity;
  sort: number;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Setting {
  examName: string;
  examDate: string | null;
  phaseStart: string | null;
  dailyGoalMin: number;
  weekStartsOn: number;
  focusMin: number;
  breakMin: number;
  theme: string;
  updatedAt: number;
}

// ─── 日 / 条目 ───────────────────────────────────────

export interface DayMark {
  date: string;
  stateId: string | null;
  state?: JournalState;
  totalMin: number;
  entryCount: number;
  diaryPreview: string;
  taskDone: number;
  taskTotal: number;
}

export interface DayDetail {
  date: string;
  stateId: string | null;
  state?: JournalState;
  diary: string;
  updatedAt: number;
  totalMin: number;
  entries: Entry[];
  tasks: GoalTask[];
  checkins: GoalCheckin[];
}

export interface Entry {
  id: string;
  date: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  title: string;
  note: string;
  durationMin: number;
  source: string;
  sort: number;
  createdAt: number;
  updatedAt: number;
}

// ─── 目标 / 任务 / 打卡 ──────────────────────────────

export type GoalType = 'COUNT' | 'CHECKLIST';
export type GoalStatus = 'ACTIVE' | 'ARCHIVED';

export interface GoalTask {
  id: string;
  goalId: string;
  goalTitle?: string;
  title: string;
  dueDate: string | null;
  weekStart: string | null;
  done: boolean;
  doneAt: number | null;
  reflection: string;
  entryId: string | null;
  sort: number;
  createdAt: number;
  updatedAt: number;
}

export interface GoalCheckin {
  id: string;
  goalId: string;
  goalTitle?: string;
  date: string;
  quantity: number;
  note: string;
  entryId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface WeekProgress {
  weekStart: string;
  weekEnd: string;
  actual: number;
  planned: number;
}

export interface GoalSummary {
  id: string;
  period: string;
  title: string;
  type: GoalType;
  targetValue: number | null;
  unit: string | null;
  subjectId: string | null;
  subjectName?: string;
  color: string;
  note: string;
  sortOrder: number;
  status: GoalStatus;
  carriedFrom: string | null;
  percent: number;
  reached: boolean;
  actualValue: number;
  totalValue: number;
  plannedDaily: number | null;
  plannedWeekly: number | null;
  suggestedDaily: number | null;
  suggestedWeekly: number | null;
  remaining: number | null;
  remainingDays: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface GoalDetail extends GoalSummary {
  tasks: GoalTask[];
  checkins: GoalCheckin[];
  weeks: WeekProgress[];
}

export interface GoalDayMark {
  total: number;
  done: number;
}

export interface GoalMonth {
  period: string;
  monthPercent: number;
  reachedCount: number;
  goalCount: number;
  goals: GoalSummary[];
  dayMarks: Record<string, GoalDayMark>;
}

export interface TodayGoalItem {
  goalId: string;
  title: string;
  type: GoalType;
  color: string;
  percent: number;
  reached: boolean;
  unit: string | null;
  targetValue: number | null;
  actualValue: number | null;
  remaining: number | null;
  suggestedToday: number | null;
  todayCheckin: GoalCheckin | null;
  todayTasks: GoalTask[];
}

export interface TodayGoals {
  date: string;
  items: TodayGoalItem[];
}

// ─── 搜索 / 统计 / 连续 ──────────────────────────────

export interface SearchDayHit {
  date: string;
  stateId: string;
  diary: string;
  updatedAt: number;
}

export interface SearchResult {
  keyword: string;
  type: string;
  days: SearchDayHit[];
  entries: Entry[];
}

export interface SubjectTotal {
  subjectId: string;
  name: string;
  color: string;
  minutes: number;
  entryCount: number;
}

export interface StateTotal {
  stateId: string;
  label: string;
  color: string;
  count: number;
}

export interface DaySeries {
  date: string;
  totalMin: number;
  entryCount: number;
}

export interface StatsMonth {
  period: string;
  totalMin: number;
  entryCount: number;
  daysRecorded: number;
  subjectBreakdown: SubjectTotal[];
  stateBreakdown: StateTotal[];
  daily: DaySeries[];
}

export interface StatsYear {
  year: number;
  totalMin: number;
  entryCount: number;
  subjectBreakdown: SubjectTotal[];
  months: { period: string; totalMin: number; entryCount: number }[];
}

export interface StatsHeatmapCell {
  date: string;
  totalMin: number;
  entryCount: number;
}

export interface StreakResult {
  streak: number;
  today: string;
}

// ─── 导出 / 导入 ─────────────────────────────────────

export interface ExportDay {
  date: string;
  stateId: string | null;
  diary: string;
}

export interface ExportEntry {
  id: string;
  date: string;
  subjectId: string;
  title: string;
  note: string;
  durationMin: number;
  source: string;
  sort: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExportTask {
  id: string;
  title: string;
  dueDate: string | null;
  weekStart: string | null;
  doneAt: number | null;
  reflection: string;
  entryId: string | null;
  sort: number;
  createdAt: number;
  updatedAt: number;
}

export interface ExportCheckin {
  id: string;
  date: string;
  quantity: number;
  note: string;
  entryId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ExportGoal {
  id: string;
  period: string;
  title: string;
  type: GoalType;
  targetValue: number | null;
  unit: string | null;
  subjectId: string | null;
  color: string | null;
  note: string;
  sort: number;
  status: GoalStatus;
  carriedFrom: string | null;
  createdAt: number;
  updatedAt: number;
  tasks: ExportTask[];
  checkins: ExportCheckin[];
}

export interface ExportData {
  version: 3;
  exportedAt: number;
  settings: Setting;
  subjects: Subject[];
  states: JournalState[];
  days: ExportDay[];
  entries: ExportEntry[];
  goals: ExportGoal[];
}

export interface ImportStats {
  days: number;
  entries: number;
  minutes: number;
  subjects: number;
  states: number;
  goals: number;
  tasks: number;
  checkins: number;
}

export interface ImportResult {
  imported: boolean;
  stats: ImportStats;
}

// ─── 请求体 ──────────────────────────────────────────

export interface PatchDayRequest {
  stateId?: string | null;
  diary?: string;
}

export interface EntryRequest {
  date: string;
  subjectId?: string;
  subject?: string;
  title?: string;
  note?: string;
  durationMin: number;
  source?: string;
  sort?: number;
}

export interface EntryPatch {
  date?: string;
  subjectId?: string;
  subject?: string;
  title?: string | null;
  note?: string;
  durationMin?: number;
  source?: string;
  sort?: number;
}

export interface GoalRequest {
  id?: string;
  period: string;
  title: string;
  type: GoalType;
  targetValue?: number;
  unit?: string;
  subjectId?: string;
  color?: string;
  note?: string;
  sort?: number;
  status?: GoalStatus;
}

export interface GoalPatch {
  title?: string;
  type?: GoalType;
  targetValue?: number | null;
  unit?: string | null;
  subjectId?: string | null;
  color?: string;
  note?: string;
  sort?: number;
  status?: GoalStatus;
}

export interface TaskRequest {
  title: string;
  dueDate?: string | null;
  weekStart?: string | null;
  reflection?: string;
  entryId?: string | null;
  sort?: number;
  durationMin?: number;
  createEntry?: boolean;
  date?: string;
}

export interface TaskPatch {
  title?: string;
  dueDate?: string | null;
  weekStart?: string | null;
  reflection?: string;
  entryId?: string | null;
  sort?: number;
}

export interface CompleteTaskRequest {
  durationMin?: number;
  reflection?: string;
  createEntry?: boolean;
  entryId?: string;
  date?: string;
}

export interface CheckinRequest {
  quantity: number;
  note?: string;
  entryId?: string | null;
  durationMin?: number;
  createEntry?: boolean;
  date?: string;
}

export interface SubjectRequest {
  name: string;
  color?: string;
  sort?: number;
}

export interface SubjectPatch {
  name?: string;
  color?: string;
  sort?: number;
}

export interface StateRequest {
  label: string;
  color?: string;
  polarity?: StatePolarity;
  sort?: number;
}

export interface StatePatch {
  label?: string;
  color?: string;
  polarity?: StatePolarity;
  sort?: number;
}

export interface SettingsPatch {
  examName?: string;
  examDate?: string | null;
  phaseStart?: string | null;
  dailyGoalMin?: number;
  weekStartsOn?: number;
  focusMin?: number;
  breakMin?: number;
  theme?: string;
}
