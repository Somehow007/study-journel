import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecordsByMonth } from '../lib/db';
import { MONTH_LABELS } from '../lib/constants';
import { totalDuration, formatDuration } from '../lib/dateUtils';
import { MOOD_CONFIGS } from '../lib/constants';
import { useApp } from '../context/AppContext';
import MoodSeal from '../assets/moods';
import { ChevronLeft, ChevronRight, BookOpen, Clock, Heart, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const isDark = theme === 'dark';
  const navigate = useNavigate();
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
        dailyData: [] as { day: number; dateStr: string; hours: number; mood: MoodType | null }[],
        subjectData: [] as { name: string; hours: number; color: string }[],
      };
    }

    const totalDays = records.length;
    const totalMin = records.reduce((sum, r) => sum + totalDuration(r.learnings), 0);

    // Most frequent mood（跳过旧数据中的未知心情值，如已删除的自定义心情）
    const moodCount: Record<string, number> = {};
    for (const r of records) {
      if (r.mood && MOOD_CONFIGS[r.mood]) {
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
      return { day, dateStr: r.date, hours: Math.round(hours * 10) / 10, mood: r.mood };
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
  const chartGridColor = 'color-mix(in srgb, var(--hairline) 60%, transparent)';
  const chartTextColor = 'var(--ink-faint)';

  return (
    <div className="animate-fade-up" style={{ maxWidth: '880px', margin: '0 auto' }}>
      {/* 页面标题 + 月份切换 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-h1 text-[var(--ink)]">
            统计
          </h1>
          <button
            onClick={() => navigate(`/annual?year=${viewYear}`)}
            className="pill-dashed flex items-center gap-1.5 px-3 py-1.5 font-sans text-caption text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
          >
            <TrendingUp size={14} />
            年度回顾
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-serif text-h2 text-[var(--ink)] min-w-[100px] text-center">
            {viewYear}年 {MONTH_LABELS[viewMonth]}
          </span>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {hasData ? (
        <>
          {/* 月度摘要卡片 */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card flex items-center gap-3 rounded-lg p-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}
              >
                <BookOpen size={20} style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <div className="font-mono text-num-lg text-[var(--ink)]">
                  {stats.totalDays}
                </div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">学习天数</div>
              </div>
            </div>

            <div className="card flex items-center gap-3 rounded-lg p-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--pine) 12%, transparent)' }}
              >
                <Clock size={20} style={{ color: 'var(--pine)' }} />
              </div>
              <div>
                <div className="font-mono text-num-lg text-[var(--ink)]">
                  {formatDuration(stats.totalMin)}
                </div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">总学习时长</div>
              </div>
            </div>

            <div className="card flex items-center gap-3 rounded-lg p-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  background: stats.topMood
                    ? `${isDark ? MOOD_CONFIGS[stats.topMood].dark.tint : MOOD_CONFIGS[stats.topMood].tint}`
                    : 'color-mix(in srgb, var(--brand) 12%, transparent)',
                }}
              >
                {stats.topMood ? (
                  <MoodSeal moodType={stats.topMood} size={20} tone="seal" />
                ) : (
                  <Heart size={20} style={{ color: 'var(--ink-faint)' }} />
                )}
              </div>
              <div>
                <div className="font-mono text-num-lg text-[var(--ink)]">
                  {stats.topMood ? MOOD_CONFIGS[stats.topMood].emoji : '-'}
                </div>
                <div className="font-sans text-caption text-[var(--ink-soft)]">
                  {stats.topMood ? `最常${MOOD_CONFIGS[stats.topMood].label}` : '无记录'}
                </div>
              </div>
            </div>
          </div>

          {/* 图表区 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 每日学习时长柱状图 — 印刷图表风 */}
            <div className="card rounded-lg p-5">
              <h3 className="mb-4 font-sans text-small text-[var(--ink-soft)]">每日学习时长</h3>
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
                        background: 'color-mix(in srgb, var(--card) 96%, transparent)',
                        border: '1px solid var(--keyline)',
                        borderRadius: '10px',
                        fontSize: '13px',
                        color: 'var(--ink)',
                      }}
                      formatter={(value) => [`${value}h`, '学习时长']}
                      labelFormatter={(day) => `${viewYear}年${viewMonth + 1}月${day}日`}
                    />
                    <Bar
                      dataKey="hours"
                      shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { mood: MoodType | null } }) => {
                        const { x = 0, y = 0, width = 0, height = 0, payload } = props;
                        const moodCfg = payload?.mood ? MOOD_CONFIGS[payload.mood] : null;
                        const barColor = moodCfg
                          ? (isDark ? moodCfg.dark.solid : moodCfg.solid)
                          : isDark ? 'rgba(240,231,213,0.70)' : 'rgba(43,35,24,0.70)';
                        return (
                          <rect x={x} y={y} width={width - 2} height={height} fill={barColor} rx={4} ry={4} />
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[220px] items-center justify-center font-sans text-small text-[var(--ink-faint)]">
                  本月无学习记录
                </div>
              )}
            </div>

            {/* 学科分布环形图 */}
            <div className="card rounded-lg p-5">
              <h3 className="mb-4 font-sans text-small text-[var(--ink-soft)]">学科分布</h3>
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
                          style={{ background: entry.color }}
                        />
                        <span className="font-sans text-small text-[var(--ink)]">{entry.name}</span>
                        <span className="font-mono text-caption text-[var(--ink-soft)]">{entry.hours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center font-sans text-small text-[var(--ink-faint)]">
                  本月无学习记录
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* 空状态 — 印刷图表占位 */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full card"
          >
            <TrendingUp size={28} className="text-[var(--ink-faint)]" />
          </div>
          <h2 className="font-serif text-h2 text-[var(--ink-soft)]">
            这里会随着时间长出果实
          </h2>
          <p className="mt-2 max-w-xs font-sans text-small text-[var(--ink-faint)]">
            坚持记录一周后，就能看到第一份统计报告
          </p>
          {/* 虚线占位图表 */}
          <div className="mt-6 flex items-end gap-4" style={{ height: '80px' }}>
            {[60, 120, 80, 150, 100].map((h, i) => (
              <div
                key={i}
                className="w-8 rounded-t-sm border border-dashed border-[var(--hairline)]"
                style={{ height: `${h * 0.4}px` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
