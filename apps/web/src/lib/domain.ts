// 领域纯函数 —— internal/domain 的 TS 镜像（docs/data-model.md §5）。
// 仅用于展示预览；业务计算的唯一权威在 apps/server/internal/domain。
// 两侧由 testdata/domain-cases.json 同一组用例钉死（lib/domain.test.ts）。
//
// 日期约定与 Go 一致：YYYY-MM-DD 字符串（用户本地日历日），所有日历运算
// 在 UTC 零点上进行，结果不依赖宿主时区；非法日期（如 2026-02-30）拒绝。

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_RE = /^\d{4}-\d{2}$/;
const DAY_MS = 86_400_000;

interface Ymd {
  y: number;
  m: number;
  d: number;
}

/** 校验并解析 YYYY-MM-DD；非法返回 null（对齐 Go ValidateDate + ParseDate）。 */
function parseYmd(s: string): Ymd | null {
  if (!DATE_RE.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

function msOf(s: string): number {
  const p = parseYmd(s);
  if (!p) throw new Error(`invalid date ${JSON.stringify(s)}, want YYYY-MM-DD`);
  return Date.UTC(p.y, p.m - 1, p.d);
}

function fmt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function validateDate(s: string): boolean {
  return parseYmd(s) !== null;
}

export function validatePeriod(s: string): boolean {
  if (!PERIOD_RE.test(s)) return false;
  const m = Number(s.slice(5, 7));
  return m >= 1 && m <= 12;
}

/** "YYYY-MM" → [year, month]；非法抛错（对齐 Go ParsePeriod）。 */
export function parsePeriod(s: string): [number, number] {
  if (!validatePeriod(s)) throw new Error(`invalid period ${JSON.stringify(s)}, want YYYY-MM`);
  return [Number(s.slice(0, 4)), Number(s.slice(5, 7))];
}

/** 日期的 "YYYY-MM" 前缀（对齐 Go PeriodOf）。 */
export function periodOf(date: string): string {
  return date.length >= 7 ? date.slice(0, 7) : date;
}

/** 下一个周期（"2026-12" → "2027-01"）。 */
export function nextPeriod(p: string): string {
  const [y, m] = parsePeriod(p);
  const t = new Date(Date.UTC(y, m, 1)); // month is 0-based; m(1-12) → next month first day
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}`;
}

/** date 前后 n 天（n 可为负）。 */
export function addDays(date: string, n: number): string {
  return fmt(msOf(date) + n * DAY_MS);
}

/** from→to 的整天数（to<from 为负）。 */
export function daysBetween(from: string, to: string): number {
  return Math.round((msOf(to) - msOf(from)) / DAY_MS);
}

/** "2026-11-15" ∈ "2026-11"（对齐 Go DateInPeriod）。 */
export function dateInPeriod(date: string, period: string): boolean {
  return date.length >= 7 && date.slice(0, 7) === period;
}

/** 周期的首尾日期。 */
export function monthBounds(period: string): [string, string] {
  const [y, m] = parsePeriod(period);
  const first = `${y}-${pad2(m)}-01`;
  const lastMs = Date.UTC(y, m, 0); // day 0 of next month = last day of m
  return [first, fmt(lastMs)];
}

/** 周期天数。 */
export function daysInMonth(period: string): number {
  const [first, last] = monthBounds(period);
  return Math.round((msOf(last) - msOf(first)) / DAY_MS) + 1;
}

/** JS getUTCDay (0=Sun) → ISO 星期 (Mon=1..Sun=7)。 */
function isoWeekday(ms: number): number {
  const wd = new Date(ms).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** date 所在周的起始日；weekStartsOn 为 ISO 星期 1=Mon..7=Sun。 */
export function weekStartOf(date: string, weekStartsOn: number): string {
  if (weekStartsOn < 1 || weekStartsOn > 7) {
    throw new Error(`week_starts_on must be 1..7, got ${weekStartsOn}`);
  }
  const back = (((isoWeekday(msOf(date)) - weekStartsOn) % 7) + 7) % 7;
  return addDays(date, -back);
}

export interface Week {
  start: string;
  end: string;
}

/** 与周期月份相交的全部周（按 weekStartsOn），按时间升序，至少一周。 */
export function weeksIntersecting(period: string, weekStartsOn: number): Week[] {
  const [first, last] = monthBounds(period);
  const lastMs = msOf(last);
  let wsMs = msOf(weekStartOf(first, weekStartsOn));
  const out: Week[] = [];
  while (wsMs <= lastMs) {
    out.push({ start: fmt(wsMs), end: fmt(wsMs + 6 * DAY_MS) });
    wsMs += 7 * DAY_MS;
  }
  return out;
}

/** today 钳制进周期：之前→1 号，之后→月末，之内→today。 */
export function asOfForPeriod(period: string, today: string): string {
  const [first, last] = monthBounds(period);
  if (!validateDate(today)) throw new Error(`invalid date ${JSON.stringify(today)}`);
  if (today < first) return first;
  if (today > last) return last;
  return today;
}

/** asOf 到月末（含）的天数；asOf 晚于月末 → 0；早于月初 → 钳到 1 号。 */
export function remainingDays(asOf: string, period: string): number {
  const [first, last] = monthBounds(period);
  if (asOf > last) return 0;
  const from = asOf < first ? first : asOf;
  return Math.round((msOf(last) - msOf(from)) / DAY_MS) + 1;
}

/** 剩余区间 [max(asOf,月初), 月末] 碰到的不同周数（按 weekStartsOn）。 */
export function remainingWeeks(asOf: string, period: string, weekStartsOn: number): number {
  const weeks = weeksIntersecting(period, weekStartsOn);
  const [first, last] = monthBounds(period);
  const from = asOf < first ? first : asOf;
  if (from > last) return 0;
  let count = 0;
  for (const w of weeks) {
    if (w.start <= last && w.end >= from) count++;
  }
  return count;
}

/** 日期属于 fromPeriod 时平移到 toPeriod（月内日钳到目标月长度）；否则原样返回。 */
export function shiftDateToPeriod(date: string, fromPeriod: string, toPeriod: string): string {
  if (date === '') return '';
  if (!dateInPeriod(date, fromPeriod)) return date;
  if (!validatePeriod(toPeriod)) throw new Error(`invalid period ${JSON.stringify(toPeriod)}`);
  const [y, m] = parsePeriod(toPeriod);
  const day = Number(date.slice(8, 10));
  const lastDay = Number(fmt(Date.UTC(y, m, 0)).slice(8, 10));
  return `${y}-${pad2(m)}-${pad2(Math.min(day, lastDay))}`;
}

/** 本机日历日 YYYY-MM-DD（仅展示预览用；业务权威在服务端 domain.Today）。 */
export function todayLocal(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

// ─── 基础计算 ────────────────────────────────────────

/** Σ durations（dayTotal）。 */
export function dayTotal(durations: number[]): number {
  return durations.reduce((s, d) => s + d, 0);
}

/** 进度百分比：四舍五入、封顶 100、target<=0 → 0（对齐 Go Percent）。 */
export function percent(actual: number, target: number): number {
  if (target <= 0) return 0;
  const p = Math.round((actual * 100) / target);
  return Math.min(100, Math.max(0, p));
}

/** 建议配额：remaining<=0→0；slots<=0→remaining；否则向上取整。 */
export function suggestedQuota(remaining: number, slots: number): number {
  if (remaining <= 0) return 0;
  if (slots <= 0) return remaining;
  return Math.ceil(remaining / slots);
}

// ─── 目标进度 ────────────────────────────────────────

export interface Progress {
  actual: number;
  total: number;
  percent: number;
  reached: boolean;
  remaining: number;
  remainingDays: number;
  remainingWeeks: number;
  plannedDaily: number;
  plannedWeekly: number;
  suggestedDaily: number;
  suggestedWeekly: number;
}

/** COUNT 目标进度（asOf 需已用 asOfForPeriod 钳制）。 */
export function goalProgressCount(
  target: number,
  actual: number,
  period: string,
  asOf: string,
  weekStartsOn: number,
): Progress {
  const days = daysInMonth(period);
  const weeks = weeksIntersecting(period, weekStartsOn).length || 1;
  const remDays = remainingDays(asOf, period);
  const remWeeks = remainingWeeks(asOf, period, weekStartsOn);
  const remaining = Math.max(0, target - actual);
  return {
    actual,
    total: target,
    percent: percent(actual, target),
    reached: target > 0 && actual >= target,
    remaining,
    remainingDays: remDays,
    remainingWeeks: remWeeks,
    plannedDaily: suggestedQuota(target, days),
    plannedWeekly: suggestedQuota(target, weeks),
    suggestedDaily: suggestedQuota(remaining, remDays),
    suggestedWeekly: suggestedQuota(remaining, remWeeks),
  };
}

/** COUNT 目标节奏：actual − floor(target × 今天之前已过天数 / 当月天数)；今天不计入期望，已过天数钳到 [0, 当月天数]（对齐 Go PaceCount）。 */
export function paceCount(target: number, actual: number, period: string, today: string): number {
  const days = daysInMonth(period);
  const elapsed = Math.max(0, Math.min(daysBetween(monthBounds(period)[0], today), days));
  return actual - Math.floor((Math.max(0, target) * elapsed) / days);
}

/** CHECKLIST 目标进度（计划字段恒 0，与 Go 一致）。 */
export function goalProgressChecklist(done: number, total: number): Progress {
  const remaining = Math.max(0, total - done);
  return {
    actual: done,
    total,
    percent: percent(done, total),
    reached: total > 0 && done === total,
    remaining,
    remainingDays: 0,
    remainingWeeks: 0,
    plannedDaily: 0,
    plannedWeekly: 0,
    suggestedDaily: 0,
    suggestedWeekly: 0,
  };
}

export interface DatedValue {
  date: string;
  value: number;
}

export interface WeekRow {
  weekStart: string;
  weekEnd: string;
  actual: number;
  planned: number;
}

/** COUNT 目标逐周实际 vs 计划。 */
export function buildWeeks(
  period: string,
  targetValue: number,
  items: DatedValue[],
  weekStartsOn: number,
): WeekRow[] {
  const weeks = weeksIntersecting(period, weekStartsOn);
  const planned = suggestedQuota(targetValue, weeks.length);
  return weeks.map((w) => ({
    weekStart: w.start,
    weekEnd: w.end,
    actual: items.reduce((s, it) => (it.date >= w.start && it.date <= w.end ? s + it.value : s), 0),
    planned,
  }));
}

/** 新建 COUNT 目标弹窗预览：月天数 + 日/周均摊（周数用 WeeksIntersecting）。 */
export function previewCountSplit(
  target: number,
  period: string,
  weekStartsOn: number,
): { days: number; plannedDaily: number; plannedWeekly: number } {
  if (target < 1) throw new Error('target must be >= 1');
  const days = daysInMonth(period);
  const weeks = weeksIntersecting(period, weekStartsOn).length || 1;
  return {
    days,
    plannedDaily: suggestedQuota(target, days),
    plannedWeekly: suggestedQuota(target, weeks),
  };
}

// ─── 连续天数 ────────────────────────────────────────

/**
 * 连续记录天数（v3 语义）：从今天向前数；今天无记录则从昨天起算
 * （今天没记不算断签）。today 或 yesterday 都无记录 → 0。
 * recorded 可无序/含重复/含非法日期（非法忽略）。
 */
export function countStreak(recorded: string[], today: string): number {
  const set = new Set<string>();
  for (const d of recorded) {
    if (validateDate(d)) set.add(d);
  }
  let cursor = today;
  if (!set.has(cursor)) {
    let yesterday: string;
    try {
      yesterday = addDays(today, -1);
    } catch {
      return 0;
    }
    if (!set.has(yesterday)) return 0;
    cursor = yesterday;
  }
  let streak = 0;
  for (;;) {
    if (!set.has(cursor)) return streak;
    streak++;
    let next: string;
    try {
      next = addDays(cursor, -1);
    } catch {
      return streak;
    }
    cursor = next;
  }
}

// ─── 任务相关性 ──────────────────────────────────────

/**
 * 任务是否应出现在给定日期（对齐 Go TaskRelevantOn / 旧 isTodayTask）：
 * done：仅 dueDate 当天或 weekStart 所在周；
 * undone：dueDate 当天、已逾期（dueDate<date）、或 weekStart 所在周；
 * 两者皆空的任务不做日期过滤（只计入清单总数）。
 */
export function taskRelevantOn(
  done: boolean,
  dueDate: string,
  weekStart: string,
  date: string,
  weekStartsOn: number,
): boolean {
  if (!validateDate(date)) throw new Error(`invalid date ${JSON.stringify(date)}`);
  const ws = weekStartOf(date, weekStartsOn);
  if (done) {
    return date === dueDate || (weekStart !== '' && ws === weekStart);
  }
  if (date === dueDate) return true;
  if (dueDate !== '' && dueDate < date) return true;
  return weekStart !== '' && ws === weekStart;
}

// ─── 考试 / 阶段 ─────────────────────────────────────

/** 距考试整天数（已过为负）。 */
export function examCountdown(examDate: string, today: string): number {
  return daysBetween(today, examDate);
}

/** 阶段进度 [0,1]：phaseStart 前 0、examDate 后 1、中间线性；退化区间 exam<=start 时 exam 前 0、exam 起 1。 */
export function phaseFraction(phaseStart: string, examDate: string, today: string): number {
  if (!validateDate(phaseStart) || !validateDate(examDate) || !validateDate(today)) {
    throw new Error('phase/exam/today must be YYYY-MM-DD');
  }
  const total = daysBetween(phaseStart, examDate);
  const elapsed = daysBetween(phaseStart, today);
  if (total <= 0) return elapsed >= 0 ? 1 : 0;
  const frac = elapsed / total;
  return Math.min(1, Math.max(0, frac));
}

/** n 个均布刻度（含两端）；n<=0 → []；n==1 → [phaseStart]。 */
export function phaseTicks(phaseStart: string, examDate: string, n: number): string[] {
  if (n <= 0) return [];
  if (!validateDate(phaseStart) || !validateDate(examDate)) {
    throw new Error('phaseStart/examDate must be YYYY-MM-DD');
  }
  if (n === 1) return [phaseStart];
  const total = daysBetween(phaseStart, examDate);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    // Go math.Round：四舍五入、半值远离零（与 JS Math.round 的 .5 方向不同）
    const x = (i * total) / (n - 1);
    const offset = x < 0 ? -Math.round(-x) : Math.round(x);
    out.push(addDays(phaseStart, offset));
  }
  return out;
}

// ─── 统计分解 ────────────────────────────────────────

export interface EntryFact {
  date: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  durationMin: number;
}

export interface SubjectTotal {
  subjectId: string;
  name: string;
  color: string;
  minutes: number;
  entryCount: number;
}

/** 按科目聚合分钟/条数；minutes 降序、name 升序。 */
export function subjectBreakdown(entries: EntryFact[]): SubjectTotal[] {
  const byId = new Map<string, SubjectTotal>();
  for (const e of entries) {
    let t = byId.get(e.subjectId);
    if (!t) {
      t = { subjectId: e.subjectId, name: e.subjectName, color: e.subjectColor, minutes: 0, entryCount: 0 };
      byId.set(e.subjectId, t);
    }
    t.minutes += e.durationMin;
    t.entryCount += 1;
  }
  return [...byId.values()].sort((a, b) =>
    b.minutes !== a.minutes ? b.minutes - a.minutes : a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
}

export interface DaySeriesPoint {
  date: string;
  minutes: number;
  entryCount: number;
}

/** 按日期聚合分钟/条数，日期升序；无记录日缺席（图表自行补齐）。 */
export function dailySeries(entries: EntryFact[]): DaySeriesPoint[] {
  const byDate = new Map<string, DaySeriesPoint>();
  for (const e of entries) {
    let d = byDate.get(e.date);
    if (!d) {
      d = { date: e.date, minutes: 0, entryCount: 0 };
      byDate.set(e.date, d);
    }
    d.minutes += e.durationMin;
    d.entryCount += 1;
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface StateMark {
  stateId: string;
  label: string;
  color: string;
}

export interface StateTotal {
  stateId: string;
  label: string;
  color: string;
  count: number;
}

/** 按状态计天数（仅有 state 的记录日）；count 降序、label 升序。 */
export function stateBreakdown(marks: StateMark[]): StateTotal[] {
  const byId = new Map<string, StateTotal>();
  for (const m of marks) {
    let t = byId.get(m.stateId);
    if (!t) {
      t = { stateId: m.stateId, label: m.label, color: m.color, count: 0 };
      byId.set(m.stateId, t);
    }
    t.count += 1;
  }
  return [...byId.values()].sort((a, b) =>
    b.count !== a.count ? b.count - a.count : a.label < b.label ? -1 : a.label > b.label ? 1 : 0,
  );
}

/** 进度格：percent(0-100) → total 个布尔格，前 filled 个为满（nb-meter 用）。 */
export function progressCells(percent: number, total = 20): boolean[] {
  const pct = Math.min(100, Math.max(0, percent));
  const filled = Math.round((pct / 100) * total);
  return Array.from({ length: total }, (_, i) => i < filled);
}
