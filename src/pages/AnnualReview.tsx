import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecordsByYear } from '../lib/db';
import { MONTH_LABELS } from '../lib/constants';
import { totalDuration, formatDuration } from '../lib/dateUtils';
import { MOOD_CONFIGS } from '../lib/constants';
import { useApp } from '../context/AppContext';
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
  const [searchParams] = useSearchParams();
  const now = new Date();
  const initialYear = parseInt(searchParams.get('year') ?? '') || now.getFullYear();
  const [viewYear, setViewYear] = useState(initialYear);


  const records = useLiveQuery(() => getRecordsByYear(viewYear), [viewYear]);

  const isCurrentYear = viewYear === now.getFullYear();

  const prevYear = () => setViewYear(v => v - 1);
  const nextYear = () => setViewYear(v => v + 1);

  // Compute yearly stats
  const stats = useMemo(() => {
    if (!records || records.length === 0) {
      return {
        totalDays: 0,
        totalMin: 0,
        topMood: null as string | null,
        mostConsistentMonth: null as { month: number; ratio: number } | null,
        longestStreak: 0,
        monthlyData: [] as { month: number; label: string; days: number; hours: number; topMoodLabel: string; topMoodEmoji: string }[],
        subjectData: [] as { name: string; hours: number; color: string }[],


      };
    }

    const totalDays = records.length;
    const totalMin = records.reduce((sum, r) => sum + totalDuration(r.learnings), 0);

    // Most frequent mood
    const moodCount: Record<string, number> = {};
    for (const r of records) {
      if (r.mood) {
        moodCount[r.mood] = (moodCount[r.mood] || 0) + 1;
      }
    }
    let topMood: string | null = null;
    let topMoodCount = 0;
    for (const [mood, count] of Object.entries(moodCount)) {
      if (count > topMoodCount) { topMoodCount = count; topMood = mood; }
    }

    // Monthly breakdown
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
      let topCount = 0;
      for (const [mood, count] of Object.entries(data.moods)) {
        if (count > topCount) {
          topCount = count;
          const cfg = MOOD_CONFIGS[mood as keyof typeof MOOD_CONFIGS] ?? MOOD_CONFIGS.happy;
          topMoodLabel = cfg.label;
          topMoodEmoji = cfg.emoji;
        }
      }
      return {
        month: parseInt(m),
        label: MONTH_LABELS[parseInt(m)],
        days: data.days,
        hours: Math.round(data.min / 6) / 10,
        topMoodLabel,
        topMoodEmoji,
      };
    });

    // Most consistent month (highest ratio of days with records)
    let mostConsistentMonth: { month: number; ratio: number } | null = null;
    for (const [m, data] of Object.entries(monthlyBuckets)) {
      const monthIdx = parseInt(m);
      const daysInMonth = new Date(viewYear, monthIdx + 1, 0).getDate();
      // For current year, only count completed months
      if (isCurrentYear && monthIdx > now.getMonth()) continue;
      const ratio = data.days / daysInMonth;
      if (!mostConsistentMonth || ratio > mostConsistentMonth.ratio) {
        mostConsistentMonth = { month: monthIdx, ratio };
      }
    }

    // Longest learning streak
    const dateSet = new Set(records.map(r => r.date));
    let longestStreak = 0;
    let currentStreak = 0;
    // Iterate all dates in the year
    const yearStart = new Date(viewYear, 0, 1);
    const yearEnd = isCurrentYear ? new Date() : new Date(viewYear, 11, 31);
    for (let d = new Date(yearStart); d <= yearEnd; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      if (dateSet.has(ds)) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Subject distribution (yearly)
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
  }, [records, viewYear, isCurrentYear]);

  const topMoodConfig = stats.topMood ? MOOD_CONFIGS[stats.topMood as keyof typeof MOOD_CONFIGS] : null;
  const hasData = stats.totalDays > 0;
  const chartGridColor = theme === 'dark' ? 'rgba(155,140,120,0.15)' : 'rgba(200,190,180,0.3)';
  const chartTextColor = theme === 'dark' ? '#8A7F75' : '#948A80';

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-hand text-2xl font-semibold text-[var(--color-text)]">
          年度回顾
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={prevYear}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-soft)] transition-all hover:bg-[var(--color-card)] hover:text-[var(--color-text)] hover:shadow-2"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-hand text-lg font-medium text-[var(--color-text)] min-w-[80px] text-center">
            {viewYear}年
          </span>
          <button
            onClick={nextYear}
            disabled={isCurrentYear}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
              isCurrentYear
                ? 'text-[var(--color-text-faint)] opacity-30 cursor-not-allowed'
                : 'text-[var(--color-text-soft)] hover:bg-[var(--color-card)] hover:text-[var(--color-text)] hover:shadow-2'
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
            <div className="glass flex items-center gap-3 rounded-xl p-4 shadow-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(255,185,56,0.15)' }}>
                <BookOpen size={20} className="text-brand" />
              </div>
              <div>
                <div className="font-mono text-xl font-semibold text-[var(--color-text)]">{stats.totalDays}</div>
                <div className="text-xs text-[var(--color-text-soft)]">学习天数</div>
              </div>
            </div>
            <div className="glass flex items-center gap-3 rounded-xl p-4 shadow-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(77,184,229,0.15)' }}>
                <Clock size={20} style={{ color: '#4DB8E5' }} />
              </div>
              <div>
                <div className="font-mono text-xl font-semibold text-[var(--color-text)]">{formatDuration(stats.totalMin)}</div>
                <div className="text-xs text-[var(--color-text-soft)]">总学习时长</div>
              </div>
            </div>
            <div className="glass flex items-center gap-3 rounded-xl p-4 shadow-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: topMoodConfig ? `rgba(${parseInt(topMoodConfig.main.slice(1,3),16)},${parseInt(topMoodConfig.main.slice(3,5),16)},${parseInt(topMoodConfig.main.slice(5,7),16)},0.15)` : 'rgba(255,185,56,0.15)' }}>
                <Heart size={20} style={{ color: topMoodConfig?.main ?? 'var(--color-text-faint)' }} />
              </div>
              <div>
                <div className="font-mono text-xl font-semibold text-[var(--color-text)]">{topMoodConfig?.emoji ?? '-'}</div>
                <div className="text-xs text-[var(--color-text-soft)]">{topMoodConfig ? `最常${topMoodConfig.label}` : '无记录'}</div>
              </div>
            </div>
            <div className="glass flex items-center gap-3 rounded-xl p-4 shadow-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(232,118,196,0.15)' }}>
                <Flame size={20} style={{ color: '#E876C4' }} />
              </div>
              <div>
                <div className="font-mono text-xl font-semibold text-[var(--color-text)]">{stats.longestStreak}</div>
                <div className="text-xs text-[var(--color-text-soft)]">最长连续天数</div>
              </div>
            </div>
          </div>

          {/* Charts row 1 */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Monthly study hours bar chart */}
            <div className="glass rounded-xl p-5 shadow-2">
              <h3 className="mb-4 text-sm font-medium text-[var(--color-text-soft)]">月度学习时长</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: chartTextColor }}
                    axisLine={{ stroke: chartGridColor }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chartTextColor }}
                    axisLine={false}
                    tickLine={false}
                    unit="h"
                  />
                  <Tooltip
                    contentStyle={{
                      background: theme === 'dark' ? 'rgba(35,31,26,0.95)' : 'rgba(255,253,249,0.95)',
                      border: '1px solid var(--color-line)',
                      borderRadius: '12px',
                      fontSize: '13px',
                      color: 'var(--color-text)',
                    }}
                    formatter={(value) => [`${value}h`, '学习时长']}
                  />
                  <Bar dataKey="hours" fill={theme === 'dark' ? 'url(#yearBarDark)' : 'url(#yearBar)'} radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="yearBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFD66B" />
                      <stop offset="100%" stopColor="#FFA51F" />
                    </linearGradient>
                    <linearGradient id="yearBarDark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFDA80" />
                      <stop offset="100%" stopColor="#FFB53A" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Subject donut */}
            <div className="glass rounded-xl p-5 shadow-2">
              <h3 className="mb-4 text-sm font-medium text-[var(--color-text-soft)]">年度学科分布</h3>
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
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }} />
                        <span className="text-sm text-[var(--color-text)]">{entry.name}</span>
                        <span className="font-mono text-xs text-[var(--color-text-soft)]">{entry.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-[var(--color-text-faint)]">暂无学习记录</div>
              )}
            </div>
          </div>

          {/* Monthly breakdown table */}
          <div className="glass mb-6 rounded-xl p-5 shadow-2">
            <h3 className="mb-4 text-sm font-medium text-[var(--color-text-soft)]">月度总览</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {stats.monthlyData.map((m) => (
                <div key={m.month} className="rounded-lg p-3 transition-all hover:shadow-2" style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                  <div className="mb-1 text-xs font-medium text-[var(--color-text-soft)]">{m.label}</div>
                  <div className="flex items-center gap-2">
                    {m.topMoodEmoji ? (
                      <span className="text-lg">{m.topMoodEmoji}</span>
                    ) : (
                      <span className="text-lg opacity-20">·</span>
                    )}
                    <div>
                      <div className="font-mono text-sm font-semibold text-[var(--color-text)]">{m.hours}h</div>
                      <div className="text-[10px] text-[var(--color-text-faint)]">{m.days} 天</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ boxShadow: '0 0 24px rgba(255,185,56,0.15)', background: 'var(--color-card)' }}>
            <span className="text-3xl" style={{ animation: 'breath 2s ease-in-out infinite' }}>🌳</span>
          </div>
          <h2 className="font-hand text-xl text-[var(--color-text-soft)]">
            {viewYear}年还没有记录
          </h2>
          <p className="mt-2 max-w-xs text-sm text-[var(--color-text-faint)]">
            {isCurrentYear ? '从今天开始记录，年末时这里会变成一棵繁茂的大树' : '查看其他年份吧'}
          </p>
        </div>
      )}
    </div>
  );
}
