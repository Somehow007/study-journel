import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getRecordsByYear } from '../lib/api';
import { useApiQuery } from '../lib/useApiQuery';
import { MONTH_LABELS } from '../lib/constants';
import { totalDuration, formatDuration, formatDate } from '../lib/dateUtils';
import { useAllMoodConfigs } from '../lib/moodUtils';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import { ChevronLeft, ChevronRight, BookOpen, Clock, Flame } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

export default function AnnualReview() {
  const [searchParams] = useSearchParams();
  const now = new Date();
  const initialYear = parseInt(searchParams.get('year') ?? '') || now.getFullYear();
  const [viewYear, setViewYear] = useState(initialYear);

  const { data: records, loading, error, refresh } = useApiQuery(
    () => getRecordsByYear(viewYear),
    [viewYear],
  );
  const allMoods = useAllMoodConfigs();
  const allMoodKeys = useMemo(() => new Set(allMoods.map((m) => m.type)), [allMoods]);
  const moodCfgMap = useMemo(() => {
    const map = new Map<string, (typeof allMoods)[0]>();
    for (const cfg of allMoods) map.set(cfg.type, cfg);
    return map;
  }, [allMoods]);

  const isCurrentYear = viewYear === now.getFullYear();
  const prevYear = () => setViewYear((v) => v - 1);
  const nextYear = () => setViewYear((v) => v + 1);

  const stats = useMemo(() => {
    if (!records || records.length === 0) {
      return {
        totalDays: 0,
        totalMin: 0,
        topMood: null as string | null,
        mostConsistentMonth: null as { month: number; ratio: number } | null,
        longestStreak: 0,
        monthlyData: [] as { month: number; label: string; days: number; hours: number; topMoodType: string | null }[],
        subjectData: [] as { name: string; hours: number; color: string }[],
      };
    }

    const totalDays = records.length;
    const totalMin = records.reduce((sum, r) => sum + totalDuration(r.learnings), 0);

    const moodCount: Record<string, number> = {};
    for (const r of records) {
      if (r.mood && allMoodKeys.has(r.mood)) {
        moodCount[r.mood] = (moodCount[r.mood] || 0) + 1;
      }
    }
    let topMood: string | null = null;
    let topMoodCount = 0;
    for (const [mood, count] of Object.entries(moodCount)) {
      if (count > topMoodCount) {
        topMoodCount = count;
        topMood = mood;
      }
    }

    const monthlyBuckets: Record<number, { days: number; min: number; moods: Record<string, number> }> = {};
    for (let m = 0; m < 12; m++) monthlyBuckets[m] = { days: 0, min: 0, moods: {} };

    for (const r of records) {
      const month = parseInt(r.date.split('-')[1], 10) - 1;
      monthlyBuckets[month].days++;
      monthlyBuckets[month].min += totalDuration(r.learnings);
      if (r.mood) {
        monthlyBuckets[month].moods[r.mood] = (monthlyBuckets[month].moods[r.mood] || 0) + 1;
      }
    }

    const monthlyData = Object.entries(monthlyBuckets).map(([m, data]) => {
      let topMoodType: string | null = null;
      let topCount = 0;
      for (const [mood, count] of Object.entries(data.moods)) {
        if (count > topCount) {
          topCount = count;
          topMoodType = mood;
        }
      }
      return {
        month: parseInt(m),
        label: MONTH_LABELS[parseInt(m)],
        days: data.days,
        hours: Math.round((data.min / 60) * 10) / 10,
        topMoodType,
      };
    });

    let mostConsistentMonth: { month: number; ratio: number } | null = null;
    for (const [m, data] of Object.entries(monthlyBuckets)) {
      const monthIdx = parseInt(m);
      const daysInMonth = new Date(viewYear, monthIdx + 1, 0).getDate();
      if (isCurrentYear && monthIdx > now.getMonth()) continue;
      const ratio = data.days / daysInMonth;
      if (!mostConsistentMonth || ratio > mostConsistentMonth.ratio) {
        mostConsistentMonth = { month: monthIdx, ratio };
      }
    }

    const dateSet = new Set(records.map((r) => r.date));
    let longestStreak = 0;
    let currentStreak = 0;
    const yearStart = new Date(viewYear, 0, 1);
    const yearEnd = isCurrentYear ? new Date() : new Date(viewYear, 11, 31);
    for (let d = new Date(yearStart); d <= yearEnd; d.setDate(d.getDate() + 1)) {
      const ds = formatDate(d);
      if (dateSet.has(ds)) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    const subjectMap: Record<string, { min: number; color: string }> = {};
    for (const r of records) {
      for (const l of r.learnings) {
        if (!subjectMap[l.subject]) subjectMap[l.subject] = { min: 0, color: l.color };
        subjectMap[l.subject].min += l.durationMin;
      }
    }
    const subjectData = Object.entries(subjectMap)
      .map(([name, { min, color }]) => ({ name, hours: Math.round((min / 60) * 10) / 10, color }))
      .sort((a, b) => b.hours - a.hours);

    return { totalDays, totalMin, topMood, mostConsistentMonth, longestStreak, monthlyData, subjectData };
  }, [records, viewYear, isCurrentYear, allMoodKeys]);

  const topMoodConfig = stats.topMood ? moodCfgMap.get(stats.topMood) ?? null : null;
  const hasData = stats.totalDays > 0;
  const chartGridColor = 'color-mix(in srgb, var(--hairline) 70%, transparent)';
  const chartTextColor = 'var(--ink-faint)';

  if (loading && !records) return <QueryLoading />;
  if (error && !records) return <QueryError message={error.message} onRetry={refresh} />;

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-display text-[var(--ink)]">年度回顾</h1>
          <p className="mt-1 font-sans text-caption text-[var(--ink-soft)]">{viewYear} 年的学习与心情</p>
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
                <div className="font-mono text-num-lg text-[var(--ink)]">{formatDuration(stats.totalMin)}</div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">总学习时长</div>
              </div>
            </div>
            <div className="card flex items-center gap-3 rounded-xl p-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: topMoodConfig ? topMoodConfig.tint : 'color-mix(in srgb, var(--brand) 12%, transparent)' }}
              >
                {topMoodConfig ? (
                  <span className="h-3 w-3 rounded-full" style={{ background: topMoodConfig.solid }} />
                ) : (
                  <span className="font-mono text-num text-[var(--ink-faint)]">-</span>
                )}
              </div>
              <div>
                <div className="font-sans text-h2 text-[var(--ink)]">
                  {topMoodConfig ? topMoodConfig.label : '-'}
                </div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">最常心情</div>
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
                const cfg = m.topMoodType ? moodCfgMap.get(m.topMoodType) : undefined;
                return (
                  <div key={m.month} className="rounded-xl p-3 transition-all hover:bg-[var(--paper)]">
                    <div className="mb-1 font-sans text-caption text-[var(--ink-soft)]">{m.label}</div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: cfg ? cfg.solid : 'var(--keyline)' }}
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
