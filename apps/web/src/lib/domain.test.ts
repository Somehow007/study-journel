// domain-cases.json 双端对齐测试 —— 与 apps/server/internal/domain/domain_test.go
// 跑同一份 testdata/domain-cases.json，fn 分发与输出塑形保持一致。
import { describe, expect, it } from 'vitest';
import rawCases from '../../../../testdata/domain-cases.json';
import {
  addDays,
  asOfForPeriod,
  buildWeeks,
  countStreak,
  dailySeries,
  dayTotal,
  daysBetween,
  examCountdown,
  goalProgressChecklist,
  goalProgressCount,
  monthBounds,
  paceCount,
  percent,
  phaseFraction,
  phaseTicks,
  previewCountSplit,
  remainingDays,
  remainingWeeks,
  shiftDateToPeriod,
  stateBreakdown,
  subjectBreakdown,
  suggestedQuota,
  validateDate,
  weekStartOf,
  weeksIntersecting,
} from './domain';
import type { EntryFact, StateMark } from './domain';

interface DomainCase {
  name: string;
  fn: string;
  input: unknown;
  want: unknown;
}

const cases = (rawCases as unknown as { cases: DomainCase[] }).cases;

// ─── 与 Go jsonEqual 对齐的比较器（float 容差 1e-4）──────────────

function jsonEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-4;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as Record<string, unknown>);
    const bk = Object.keys(b as Record<string, unknown>);
    if (ak.length !== bk.length) return false;
    return ak.every((k) =>
      jsonEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return a === b;
}

// ─── 与 Go runDomainCase 对齐的 fn 分发 + 输出塑形 ──────────────

function runCase(c: DomainCase): unknown {
  switch (c.fn) {
    case 'streak': {
      const i = c.input as { dates: string[]; today: string };
      return { days: countStreak(i.dates, i.today) };
    }
    case 'dayTotal': {
      const i = c.input as { durations: number[] };
      return { total: dayTotal(i.durations) };
    }
    case 'percent': {
      const i = c.input as { actual: number; target: number };
      return { percent: percent(i.actual, i.target) };
    }
    case 'suggestedQuota': {
      const i = c.input as { remaining: number; slots: number };
      return { quota: suggestedQuota(i.remaining, i.slots) };
    }
    case 'goalProgressCount': {
      const i = c.input as {
        target: number;
        actual: number;
        period: string;
        asOf: string;
        weekStartsOn: number;
      };
      return goalProgressCount(i.target, i.actual, i.period, i.asOf, i.weekStartsOn);
    }
    case 'paceCount': {
      const i = c.input as { target: number; actual: number; period: string; today: string };
      return { pace: paceCount(i.target, i.actual, i.period, i.today) };
    }
    case 'goalProgressChecklist': {
      const i = c.input as { done: number; total: number };
      const p = goalProgressChecklist(i.done, i.total);
      return {
        actual: p.actual,
        total: p.total,
        percent: p.percent,
        reached: p.reached,
        remaining: p.remaining,
      };
    }
    case 'previewCountSplit': {
      const i = c.input as { target: number; period: string; weekStartsOn: number };
      const r = previewCountSplit(i.target, i.period, i.weekStartsOn);
      return { days: r.days, plannedDaily: r.plannedDaily, plannedWeekly: r.plannedWeekly };
    }
    case 'weeksIntersecting': {
      const i = c.input as { period: string; weekStartsOn: number };
      return weeksIntersecting(i.period, i.weekStartsOn);
    }
    case 'weekStartOf': {
      const i = c.input as { date: string; weekStartsOn: number };
      return { weekStart: weekStartOf(i.date, i.weekStartsOn) };
    }
    case 'buildWeeks': {
      const i = c.input as {
        period: string;
        target: number;
        weekStartsOn: number;
        items: { date: string; value: number }[];
      };
      return buildWeeks(i.period, i.target, i.items, i.weekStartsOn);
    }
    case 'remainingDays': {
      const i = c.input as { asOf: string; period: string };
      return { days: remainingDays(i.asOf, i.period) };
    }
    case 'remainingWeeks': {
      const i = c.input as { asOf: string; period: string; weekStartsOn: number };
      return { weeks: remainingWeeks(i.asOf, i.period, i.weekStartsOn) };
    }
    case 'asOfForPeriod': {
      const i = c.input as { period: string; today: string };
      return asOfForPeriod(i.period, i.today);
    }
    case 'shiftDateToPeriod': {
      const i = c.input as { date: string; fromPeriod: string; toPeriod: string };
      return shiftDateToPeriod(i.date, i.fromPeriod, i.toPeriod);
    }
    case 'examCountdown': {
      const i = c.input as { examDate: string; today: string };
      return { days: examCountdown(i.examDate, i.today) };
    }
    case 'phaseFraction': {
      const i = c.input as { phaseStart: string; examDate: string; today: string };
      return { fraction: phaseFraction(i.phaseStart, i.examDate, i.today) };
    }
    case 'phaseTicks': {
      const i = c.input as { phaseStart: string; examDate: string; n: number };
      return phaseTicks(i.phaseStart, i.examDate, i.n);
    }
    case 'subjectBreakdown': {
      const i = c.input as { entries: EntryFact[] };
      return subjectBreakdown(i.entries);
    }
    case 'dailySeries': {
      const i = c.input as { entries: EntryFact[] };
      return dailySeries(i.entries);
    }
    case 'stateBreakdown': {
      const i = c.input as { marks: StateMark[] };
      return stateBreakdown(i.marks);
    }
    default:
      throw new Error(`unknown fn ${c.fn}`);
  }
}

// batch：input 为数组时逐元素执行，want 同为数组（对齐 Go runPossiblyBatch）。
function runPossiblyBatch(c: DomainCase): unknown {
  if (!Array.isArray(c.input)) return runCase(c);
  const wants = c.want as unknown[];
  if (!Array.isArray(wants) || wants.length !== c.input.length) {
    throw new Error(`${c.name}: batch input/want length mismatch`);
  }
  return c.input.map((raw, idx) =>
    runCase({ name: `${c.name}[${idx}]`, fn: c.fn, input: raw, want: wants[idx] }),
  );
}

describe('domain-cases.json（与 Go internal/domain 同一份用例）', () => {
  expect(cases.length).toBeGreaterThan(0);
  for (const c of cases) {
    it(c.name, () => {
      const got = runPossiblyBatch(c);
      expect(jsonEqual(got, c.want)).toBe(true);
    });
  }
});

// ─── 额外的 TS 侧护栏（用例未覆盖的边界）────────────────────────

describe('domain 边界护栏', () => {
  it('validateDate 拒绝非法日期', () => {
    expect(validateDate('2026-02-30')).toBe(false);
    expect(validateDate('2026-13-01')).toBe(false);
    expect(validateDate('2026-11-15')).toBe(true);
  });
  it('addDays/daysBetween 跨月跨年', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-11-01', '2026-11-30')).toBe(29);
    expect(monthBounds('2026-02')).toEqual(['2026-02-01', '2026-02-28']);
  });
});
