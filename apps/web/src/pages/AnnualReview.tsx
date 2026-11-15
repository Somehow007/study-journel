import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useExportData } from '../lib/queries';
import { findStateConfig, type StateConfig } from '../lib/stateUtils';
import { countStreak, todayLocal } from '../lib/domain';
import { MONTH_LABELS } from '../lib/constants';
import { formatDuration as fmtMin } from '../lib/dateUtils';
import { useIsDark } from '../lib/useIsDark';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import { ChevronLeft, ChevronRight, BookOpen, Clock, Flame } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type { ExportData, JournalState } from '../lib/types/api';

interface YearStats {
  totalDays: number;
  totalMin: number;
  topStateId: string | null;
  mostConsistentMonth: { month: number; ratio: number } | null;
  longestStreak: number;
  monthlyData: { month: number; label: string; days: number; hours: number; topStateId: string | null }[];
  subjectData: { name: string; hours: number; color: string; minutes: number }[];
}

function buildYearStats(data: ExportData, year: number, isCurrentYear: boolean, now: Date): YearStats {
  const prefix = `${year}-`;
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));

  // 有记录日期 = day 行有 state/diary，或当日有 entries（与服务端 streak 口径一致）
  const recorded = new Set<string>();
  const stateIdByDate = new Map<string, string>();
  for (const d of data.days) {
    if (!d.date.startsWith(prefix)) continue;
    if (d.stateId || d.diary.trim()) {
      recorded.add(d.date);
      if (d.stateId) stateIdByDate.set(d.date, d.stateId);
    }
  }

  const entries = data.entries.filter((e) => e.date.startsWith(prefix));
  for (const e of entries) recorded.add(e.date);
  const totalMin = entries.reduce((sum, e) => sum + e.durationMin, 0);

  // 状态计数 → 最常状态
  const stateCount = new Map<string, number>();
  for (const [date, sid] of stateIdByDate) {
    if (recorded.has(date)) stateCount.set(sid, (stateCount.get(sid) ?? 0) + 1);
  }
  let topStateId: string | null = null;
  let topCount = 0;
  for (const [sid, count] of stateCount) {
    if (count > topCount) {
      topCount = count;
      topStateId = sid;
    }
  }

  // 月度桶
  const buckets: { days: number; min: number; states: Map<string, number> }[] = Array.from(
    { length: 12 },
    () => ({ days: 0, min: 0, states: new Map<string, number>() }),
  );
  for (const date of recorded) {
    const m = parseInt(date.slice(5, 7), 10) - 1;
    buckets[m].days++;
  }
  for (const e of entries) {
    const m = parseInt(e.date.slice(5, 7), 10) - 1;
    buckets[m].min += e.durationMin;
  }
  for (const [date, sid] of stateIdByDate) {
    const m = parseInt(date.slice(5, 7), 10) - 1;
    buckets[m].states.set(sid, (buckets[m].states.get(sid) ?? 0) + 1);
  }

  const monthlyData = buckets.map((b, m) => {
    let mTop: string | null = null;
    let mTopCount = 0;
    for (const [sid, count] of b.states) {
      if (count > mTopCount) {
        mTopCount = count;
        mTop = sid;
      }
    }
    return {
      month: m,
      label: MONTH_LABELS[m],
      days: b.days,
      hours: Math.round((b.min / 60) * 10) / 10,
      topStateId: mTop,
    };
  });

  let mostConsistentMonth: { month: number; ratio: number } | null = null;
  for (let m = 0; m < 12; m++) {
    if (isCurrentYear && m > now.getMonth()) continue;
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const ratio = buckets[m].days / daysInMonth;
    if (!mostConsistentMonth || ratio > mostConsistentMonth.ratio) {
      mostConsistentMonth = { month: m, ratio };
    }
  }

  // 最长连续：年内记录日期 + 游标（当年→今天；往年→12-31）
  const cursor = isCurrentYear ? todayLocal() : `${year}-12-31`;
  const longestStreak = countStreak([...recorded].filter((d) => d.startsWith(prefix)), cursor);

  // 学科分布
  const subjMap = new Map<string, { name: string; color: string; minutes: number }>();
  for (const e of entries) {
    const subj = subjectById.get(e.subjectId);
    const key = e.subjectId;
    const cur = subjMap.get(key) ?? {
      name: subj?.name ?? '—',
      color: subj?.color ?? 'var(--keyline)',
      minutes: 0,
    };
    cur.minutes += e.durationMin;
    subjMap.set(key, cur);
  }
  const subjectData = [...subjMap.values()]
    .map((s) => ({ ...s, hours: Math.round((s.minutes / 60) * 10) / 10 }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    totalDays: recorded.size,
    totalMin,
    topStateId,
    mostConsistentMonth,
    longestStreak,
    monthlyData,
    subjectData,
  };
}

export default function AnnualReview() {
  const isDark = useIsDark();
  const [searchParams] = useSearchParams();
  const now = new Date();
  const initialYear = parseInt(searchParams.get('year') ?? '') || now.getFullYear();
  const [viewYear, setViewYear] = useState(initialYear);

  const { data: exportData, isPending, error, refetch } = useExportData();

  const isCurrentYear = viewYear === now.getFullYear();
  const prevYear = () => setViewYear((v) => v - 1);
  const nextYear = () => setViewYear((v) => v + 1);

  const stats = useMemo<YearStats | null>(() => {
    if (!exportData) return null;
    return buildYearStats(exportData, viewYear, isCurrentYear, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportData, viewYear, isCurrentYear]);

  const stateList: JournalState[] = exportData?.states ?? [];
  const cfgMap = useMemo(() => {
    const map = new Map<string, StateConfig>();
    for (const s of stateList) {
      const cfg = findStateConfig(stateList, s.id);
      if (cfg) map.set(s.id, cfg);
    }
    return map;
  }, [stateList]);

  const topStateCfg = stats?.topStateId ? cfgMap.get(stats.topStateId) : undefined;
  const hasData = (stats?.totalDays ?? 0) > 0;
  const chartGridColor = 'color-mix(in srgb, var(--hairline) 70%, transparent)';
  const chartTextColor = 'var(--ink-faint)';

  if (isPending && !exportData) return <QueryLoading />;
  if (error && !exportData) return <QueryError message={error.message} onRetry={() => void refetch()} />;
  if (!stats) return null;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-display text-[var(--ink)]">年度回顾</h1>
          <p className="mt-1 font-sans text-caption text-[var(--ink-soft)]">{viewYear} 年的学习与状态</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={prevYear}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)]"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <span className="min-w-[80px] text-center font-sans text-h2 text-[var(--ink)]">{viewYear}年</span>
          <button
            onClick={nextYear}
            disabled={isCurrentYear}
            className={`flex h-8 w-8 items-center justify-center rounded-full border ${
              isCurrentYear
                ? 'cursor-not-allowed border-[var(--hairline)] text-[var(--ink-faint)] opacity-30'
                : 'border-[var(--keyline)] text-[var(--ink-soft)]'
            }`}
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="card flex items-center gap-3 rounded-xl p-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}
              >
                <BookOpen size={20} strokeWidth={1.75} style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <div className="font-mono text-num-lg text-[var(--ink)]">{stats.totalDays}</div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">学习天数</div>
              </div>
            </div>
            <div className="card flex items-center gap-3 rounded-xl p-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--pine) 12%, transparent)' }}
              >
                <Clock size={20} strokeWidth={1.75} style={{ color: 'var(--pine)' }} />
              </div>
              <div>
                <div className="font-mono text-num-lg text-[var(--ink)]">{fmtMin(stats.totalMin)}</div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">总学习时长</div>
              </div>
            </div>
            <div className="card flex items-center gap-3 rounded-xl p-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: topStateCfg ? topStateCfg.tint : 'color-mix(in srgb, var(--brand) 12%, transparent)' }}
              >
                {topStateCfg ? (
                  <span className="h-3 w-3 rounded-full" style={{ background: topStateCfg.color }} />
                ) : (
                  <span className="font-mono text-num text-[var(--ink-faint)]">-</span>
                )}
              </div>
              <div>
                <div className="font-sans text-h2 text-[var(--ink)]">
                  {topStateCfg ? topStateCfg.label : '-'}
                </div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">最常状态</div>
              </div>
            </div>
            <div className="card flex items-center gap-3 rounded-xl p-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
              >
                <Flame size={20} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="font-mono text-num-lg text-[var(--ink)]">{stats.longestStreak}</div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">最长连续天数</div>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card rounded-xl p-5">
              <h2 className="mb-1 font-sans text-h2 text-[var(--ink)]">月度学习时长</h2>
              <p className="mb-4 font-sans text-caption text-[var(--ink-faint)]">全年 12 个月</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTextColor }} axisLine={{ stroke: chartGridColor }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartTextColor }} axisLine={false} tickLine={false} unit="h" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--keyline)',
                      borderRadius: '10px',
                      fontSize: '13px',
                      color: 'var(--ink)',
                    }}
                    formatter={(value) => [`${value}h`, '学习时长']}
                  />
                  <Bar dataKey="hours" fill="color-mix(in srgb, var(--brand) 70%, transparent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card rounded-xl p-5">
              <h2 className="mb-1 font-sans text-h2 text-[var(--ink)]">年度学科分布</h2>
              <p className="mb-4 font-sans text-caption text-[var(--ink-faint)]">按学习时长</p>
              {stats.subjectData.length > 0 ? (
                <div className="flex items-center">
                  <ResponsiveContainer width="55%" height={220}>
                    <PieChart>
                      <Pie data={stats.subjectData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2} dataKey="hours" stroke="none">
                        {stats.subjectData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-1 flex-col gap-2">
                    {stats.subjectData.slice(0, 6).map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} />
                        <span className="flex-1 truncate font-sans text-small text-[var(--ink)]">{entry.name}</span>
                        <span className="font-mono text-caption text-[var(--ink-soft)]">{entry.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[220px] items-center justify-center font-sans text-small text-[var(--ink-faint)]">
                  暂无学习记录
                </div>
              )}
            </div>
          </div>

          <div className="card rounded-xl p-5">
            <h2 className="mb-4 font-sans text-h2 text-[var(--ink)]">月度总览</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {stats.monthlyData.map((m) => {
                const cfg = m.topStateId ? cfgMap.get(m.topStateId) : undefined;
                const dotColor = cfg ? (isDark ? cfg.dark.solid : cfg.color) : 'var(--keyline)';
                return (
                  <div key={m.month} className="rounded-xl p-3 transition-all hover:bg-[var(--paper)]">
                    <div className="mb-1 font-sans text-caption text-[var(--ink-soft)]">{m.label}</div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: dotColor }}
                      />
                      <div>
                        <div className="font-mono text-num text-[var(--ink)]">{m.hours}h</div>
                        <div className="font-sans text-caption text-[var(--ink-faint)]">{m.days} 天</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <QueryEmpty
          title={`${viewYear}年还没有记录`}
          hint={isCurrentYear ? '从今天开始记录，年末时这里会汇总全年数据' : '查看其他年份吧'}
        />
      )}
    </div>
  );
}
