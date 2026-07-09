import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecordsByMonth } from '../lib/db';
import { MONTH_LABELS } from '../lib/constants';
import { totalDuration, formatDuration } from '../lib/dateUtils';
import { MOOD_CONFIGS } from '../lib/constants';
import { useApp } from '../context/AppContext';
import { ChevronLeft, ChevronRight, BookOpen, Clock, Heart } from 'lucide-react';
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
import type { MoodType } from '../types';

export default function Stats() {
  const { theme } = useApp();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const records = useLiveQuery(() => getRecordsByMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
  };

  const nextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
  };

  // Compute stats
  const stats = useMemo(() => {
    if (!records || records.length === 0) {
      return {
        totalDays: 0,
        totalMin: 0,
        topMood: null as MoodType | null,
        dailyData: [] as { day: number; dateStr: string; hours: number }[],
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
    let topMood: MoodType | null = null;
    let topMoodCount = 0;
    for (const [mood, count] of Object.entries(moodCount)) {
      if (count > topMoodCount) {
        topMoodCount = count;
        topMood = mood as MoodType;
      }
    }

    // Daily duration data for bar chart
    const dailyData = records.map((r) => {
      const day = parseInt(r.date.split('-')[2], 10);
      const hours = totalDuration(r.learnings) / 60;
      return { day, dateStr: r.date, hours: Math.round(hours * 10) / 10 };
    }).sort((a, b) => a.day - b.day);

    // Subject distribution for donut chart
    const subjectMap: Record<string, { min: number; color: string }> = {};
    for (const r of records) {
      for (const l of r.learnings) {
        if (!subjectMap[l.subject]) {
          subjectMap[l.subject] = { min: 0, color: l.color };
        }
        subjectMap[l.subject].min += l.durationMin;
      }
    }
    const subjectData = Object.entries(subjectMap)
      .map(([name, { min, color }]) => ({ name, hours: Math.round(min / 6) / 10, color }))
      .sort((a, b) => b.hours - a.hours);

    return { totalDays, totalMin, topMood, dailyData, subjectData };
  }, [records]);

  const hasData = stats.totalDays > 0;
  const chartGridColor = theme === 'dark' ? 'rgba(155,140,120,0.15)' : 'rgba(200,190,180,0.3)';
  const chartTextColor = theme === 'dark' ? '#8A7F75' : '#948A80';

  return (
    <div className="animate-fade-up">
      {/* 页面标题 + 月份切换 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-hand text-2xl font-semibold text-[var(--color-text)]">
          统计
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-soft)] transition-all hover:bg-[var(--color-card)] hover:text-[var(--color-text)] hover:shadow-2"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-hand text-lg font-medium text-[var(--color-text)] min-w-[100px] text-center">
            {viewYear}年 {MONTH_LABELS[viewMonth]}
          </span>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-soft)] transition-all hover:bg-[var(--color-card)] hover:text-[var(--color-text)] hover:shadow-2"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {hasData ? (
        <>
          {/* 月度摘要卡片 */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div
              className="glass flex items-center gap-3 rounded-xl p-4 shadow-2"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'rgba(255,185,56,0.15)' }}
              >
                <BookOpen size={20} className="text-brand" />
              </div>
              <div>
                <div className="font-mono text-xl font-semibold text-[var(--color-text)]">
                  {stats.totalDays}
                </div>
                <div className="text-xs text-[var(--color-text-soft)]">学习天数</div>
              </div>
            </div>

            <div
              className="glass flex items-center gap-3 rounded-xl p-4 shadow-2"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: `rgba(77,184,229,0.15)` }}
              >
                <Clock size={20} style={{ color: '#4DB8E5' }} />
              </div>
              <div>
                <div className="font-mono text-xl font-semibold text-[var(--color-text)]">
                  {formatDuration(stats.totalMin)}
                </div>
                <div className="text-xs text-[var(--color-text-soft)]">总学习时长</div>
              </div>
            </div>

            <div
              className="glass flex items-center gap-3 rounded-xl p-4 shadow-2"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  background: stats.topMood
                    ? `rgba(${parseInt(MOOD_CONFIGS[stats.topMood].main.slice(1,3),16)},${parseInt(MOOD_CONFIGS[stats.topMood].main.slice(3,5),16)},${parseInt(MOOD_CONFIGS[stats.topMood].main.slice(5,7),16)},0.15)`
                    : 'rgba(255,185,56,0.15)',
                }}
              >
                <Heart size={20} style={{ color: stats.topMood ? MOOD_CONFIGS[stats.topMood].main : 'var(--color-text-faint)' }} />
              </div>
              <div>
                <div className="font-mono text-xl font-semibold text-[var(--color-text)]">
                  {stats.topMood ? MOOD_CONFIGS[stats.topMood].emoji : '-'}
                </div>
                <div className="text-xs text-[var(--color-text-soft)]">
                  {stats.topMood ? `最常${MOOD_CONFIGS[stats.topMood].label}` : '无记录'}
                </div>
              </div>
            </div>
          </div>

          {/* 图表区 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 每日学习时长柱状图 */}
            <div className="glass rounded-xl p-5 shadow-2">
              <h3 className="mb-4 text-sm font-medium text-[var(--color-text-soft)]">每日学习时长</h3>
              {stats.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: chartTextColor }}
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
                      labelFormatter={(day) => `${viewYear}年${viewMonth + 1}月${day}日`}
                    />
                    <Bar
                      dataKey="hours"
                      fill={theme === 'dark' ? 'url(#barGradientDark)' : 'url(#barGradient)'}
                      radius={[4, 4, 0, 0]}
                    />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFD66B" />
                        <stop offset="100%" stopColor="#FFA51F" />
                      </linearGradient>
                      <linearGradient id="barGradientDark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFDA80" />
                        <stop offset="100%" stopColor="#FFB53A" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-[var(--color-text-faint)]">
                  本月无学习记录
                </div>
              )}
            </div>

            {/* 学科分布环形图 */}
            <div className="glass rounded-xl p-5 shadow-2">
              <h3 className="mb-4 text-sm font-medium text-[var(--color-text-soft)]">学科分布</h3>
              {stats.subjectData.length > 0 ? (
                <div className="flex items-center">
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats.subjectData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="hours"
                        stroke="none"
                      >
                        {stats.subjectData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="flex flex-col gap-2">
                    {stats.subjectData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: entry.color, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }}
                        />
                        <span className="text-sm text-[var(--color-text)]">{entry.name}</span>
                        <span className="font-mono text-xs text-[var(--color-text-soft)]">{entry.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-[var(--color-text-faint)]">
                  本月无学习记录
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* 空状态 */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ boxShadow: '0 0 24px rgba(255,185,56,0.15)', background: 'var(--color-card)' }}
          >
            <span className="text-3xl" style={{ animation: 'breath 2s ease-in-out infinite' }}>📊</span>
          </div>
          <h2 className="font-hand text-xl text-[var(--color-text-soft)]">
            这里会随着时间长出果实
          </h2>
          <p className="mt-2 max-w-xs text-sm text-[var(--color-text-faint)]">
            坚持记录一周后，就能看到第一份统计报告
          </p>
          {/* 虚线占位图表 */}
          <div className="mt-6 flex gap-4">
            {[60, 120, 80, 150, 100].map((h, i) => (
              <div
                key={i}
                className="w-8 rounded-t-sm border border-dashed"
                style={{
                  height: `${h * 0.4}px`,
                  borderColor: 'var(--color-line)',
                  background: 'transparent',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
