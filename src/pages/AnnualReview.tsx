import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecordsByYear } from '../lib/db';
import { MONTH_LABELS } from '../lib/constants';
import { totalDuration, formatDuration, formatDate } from '../lib/dateUtils';
import { useAllMoodConfigs } from '../lib/moodUtils';
import { useApp } from '../context/AppContext';
import MoodFlower from '../components/MoodFlower';
import { ChevronLeft, ChevronRight, BookOpen, Clock, Heart, Flame } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function AnnualReview() {
  const { theme } = useApp();
  const isDark = theme === 'dark';
  const [searchParams] = useSearchParams();
  const now = new Date();
  const initialYear = parseInt(searchParams.get('year') ?? '') || now.getFullYear();
  const [viewYear, setViewYear] = useState(initialYear);

  const records = useLiveQuery(() => getRecordsByYear(viewYear), [viewYear]);
  const allMoods = useAllMoodConfigs();
  const allMoodKeys = useMemo(() => new Set(allMoods.map((m) => m.type)), [allMoods]);
  const moodCfgMap = useMemo(() => {
    const map = new Map<string, typeof allMoods[0]>();
    for (const cfg of allMoods) map.set(cfg.type, cfg);
    return map;
  }, [allMoods]);

  const isCurrentYear = viewYear === now.getFullYear();

  const prevYear = () => setViewYear(v => v - 1);
  const nextYear = () => setViewYear(v => v + 1);

  const stats = useMemo(() => {
    if (!records || records.length === 0) {
      return {
        totalDays: 0,
        totalMin: 0,
        topMood: null as string | null,
        mostConsistentMonth: null as { month: number; ratio: number } | null,
        longestStreak: 0,
        monthlyData: [] as { month: number; label: string; days: number; hours: number; topMoodLabel: string; topMoodEmoji: string; topMoodType: string | null }[],
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
      if (count > topMoodCount) { topMoodCount = count; topMood = mood; }
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
      let topMoodLabel = '-';
      let topMoodEmoji = '';
      let topMoodType: string | null = null;
      let topCount = 0;
      for (const [mood, count] of Object.entries(data.moods)) {
        if (count > topCount) {
          topCount = count;
          const cfg = moodCfgMap.get(mood);
          if (cfg) {
            topMoodLabel = cfg.label;
            topMoodEmoji = cfg.emoji;
            topMoodType = mood;
          }
        }
      }
      return {
        month: parseInt(m),
        label: MONTH_LABELS[parseInt(m)],
        days: data.days,
        hours: Math.round(data.min / 6) / 10,
        topMoodLabel,
        topMoodEmoji,
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

    const dateSet = new Set(records.map(r => r.date));
    let longestStreak = 0;
    let currentStreak = 0;
    const yearStart = new Date(viewYear, 0, 1);
    const yearEnd = isCurrentYear ? new Date() : new Date(viewYear, 11, 31);
    for (let d = new Date(yearStart); d <= yearEnd; d.setDate(d.getDate() + 1)) {
      const ds = formatDate(d); // 本地时区格式化，与 record.date 口径一致
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
      .map(([name, { min, color }]) => ({ name, hours: Math.round(min / 6) / 10, color }))
      .sort((a, b) => b.hours - a.hours);

    return { totalDays, totalMin, topMood, mostConsistentMonth, longestStreak, monthlyData, subjectData };
  }, [records, viewYear, isCurrentYear, allMoodKeys, moodCfgMap]);

  const topMoodConfig = stats.topMood ? moodCfgMap.get(stats.topMood) ?? null : null;
  const hasData = stats.totalDays > 0;
  const chartGridColor = 'color-mix(in srgb, var(--hairline) 60%, transparent)';
  const chartTextColor = 'var(--ink-faint)';

  return (
    <div className="animate-fade-up" style={{ maxWidth: '880px', margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-h1 text-[var(--ink)]">年度回顾</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={prevYear}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-serif text-h2 text-[var(--ink)] min-w-[80px] text-center">
            {viewYear}年
          </span>
          <button
            onClick={nextYear}
            disabled={isCurrentYear}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
              isCurrentYear
                ? 'border-[var(--hairline)] text-[var(--ink-faint)] opacity-30 cursor-not-allowed'
                : 'border-[var(--keyline)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
            }`}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="card flex items-center gap-3 rounded-lg p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>
                <BookOpen size={20} style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <div className="font-mono text-num-lg text-[var(--ink)]">{stats.totalDays}</div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">学习天数</div>
              </div>
            </div>
            <div className="card flex items-center gap-3 rounded-lg p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--pine) 12%, transparent)' }}>
                <Clock size={20} style={{ color: 'var(--pine)' }} />
              </div>
              <div>
                <div className="font-mono text-num-lg text-[var(--ink)]">{formatDuration(stats.totalMin)}</div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">总学习时长</div>
              </div>
            </div>
            <div className="card flex items-center gap-3 rounded-lg p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: topMoodConfig ? (isDark ? `${topMoodConfig.dark.tint}` : `${topMoodConfig.tint}`) : 'color-mix(in srgb, var(--brand) 12%, transparent)' }}>
                {stats.topMood ? <MoodFlower moodType={stats.topMood} size={20} tone="seal" /> : <Heart size={20} style={{ color: 'var(--ink-faint)' }} />}
              </div>
              <div>
                <div className="font-mono text-num-lg text-[var(--ink)]">{topMoodConfig?.emoji ?? '-'}</div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">{topMoodConfig ? `最常${topMoodConfig.label}` : '无记录'}</div>
              </div>
            </div>
            <div className="card flex items-center gap-3 rounded-lg p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--brand-ink) 12%, transparent)' }}>
                <Flame size={20} style={{ color: 'var(--brand-ink)' }} />
              </div>
              <div>
                <div className="font-mono text-num-lg text-[var(--ink)]">{stats.longestStreak}</div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">最长连续天数</div>
              </div>
            </div>
          </div>

          {/* Charts row 1 */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card rounded-lg p-5">
              <h3 className="mb-4 font-sans text-small text-[var(--ink-soft)]">月度学习时长</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTextColor }} axisLine={{ stroke: chartGridColor }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartTextColor }} axisLine={false} tickLine={false} unit="h" />
                  <Tooltip
                    contentStyle={{
                      background: 'color-mix(in srgb, var(--card) 96%, transparent)',
                      border: '1px solid var(--keyline)',
                      borderRadius: '10px',
                      fontSize: '13px',
                      color: 'var(--ink)',
                    }}
                    formatter={(value) => [`${value}h`, '学习时长']}
                  />
                  <Bar dataKey="hours" fill="color-mix(in srgb, var(--ink) 70%, transparent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card rounded-lg p-5">
              <h3 className="mb-4 font-sans text-small text-[var(--ink-soft)]">年度学科分布</h3>
              {stats.subjectData.length > 0 ? (
                <div className="flex items-center">
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie data={stats.subjectData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="hours" stroke="none">
                        {stats.subjectData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2">
                    {stats.subjectData.slice(0, 6).map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} />
                        <span className="font-sans text-small text-[var(--ink)]">{entry.name}</span>
                        <span className="font-mono text-caption text-[var(--ink-soft)]">{entry.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center font-sans text-small text-[var(--ink-faint)]">暂无学习记录</div>
              )}
            </div>
          </div>

          {/* Monthly breakdown */}
          <div className="card mb-6 rounded-lg p-5">
            <h3 className="mb-4 font-sans text-small text-[var(--ink-soft)]">月度总览</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {stats.monthlyData.map((m) => (
                <div key={m.month} className="rounded-md p-3 transition-all hover:bg-[var(--paper)]">
                  <div className="mb-1 font-sans text-caption text-[var(--ink-soft)]">{m.label}</div>
                  <div className="flex items-center gap-2">
                    {m.topMoodType ? (
                      <MoodFlower moodType={m.topMoodType} size={18} tone="line" />
                    ) : (
                      <span className="text-lg opacity-20">·</span>
                    )}
                    <div>
                      <div className="font-mono text-num text-[var(--ink)]">{m.hours}h</div>
                      <div className="font-sans text-caption text-[var(--ink-faint)]">{m.days} 天</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="card mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-3xl">🌳</span>
          </div>
          <h2 className="font-serif text-h2 text-[var(--ink-soft)]">
            {viewYear}年还没有记录
          </h2>
          <p className="mt-2 max-w-xs font-sans text-small text-[var(--ink-faint)]">
            {isCurrentYear ? '从今天开始记录，年末时这里会变成一棵繁茂的大树' : '查看其他年份吧'}
          </p>
        </div>
      )}
    </div>
  );
}
