import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { getRecordsByMonth } from '../lib/db';
import { MONTH_LABELS } from '../lib/constants';
import { totalDuration, formatDuration } from '../lib/dateUtils';
import { useAllMoodConfigs } from '../lib/moodUtils';
import { useApp } from '../context/AppContext';
import Flower from '../components/Flower';
import BouquetPoster from '../components/BouquetPoster';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';

export default function Stats() {
  const { theme } = useApp();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const records = useLiveQuery(() => getRecordsByMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const allMoods = useAllMoodConfigs();
  const moodCfgMap = useMemo(() => {
    const map = new Map<string, typeof allMoods[0]>();
    for (const cfg of allMoods) map.set(cfg.type, cfg);
    return map;
  }, [allMoods]);

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

  const stats = useMemo(() => {
    if (!records || records.length === 0) {
      return {
        totalDays: 0,
        totalMin: 0,
        topMood: null as string | null,
        dailyData: [] as { day: number; dateStr: string; hours: number; mood: string | null }[],
        subjectData: [] as { name: string; hours: number; color: string; min: number }[],
      };
    }

    const totalDays = records.filter((r) => r.mood || r.learnings.length > 0 || r.diary).length;
    const totalMin = records.reduce((sum, r) => sum + totalDuration(r.learnings), 0);

    const moodCount: Record<string, number> = {};
    for (const r of records) {
      if (r.mood && moodCfgMap.has(r.mood)) {
        moodCount[r.mood] = (moodCount[r.mood] || 0) + 1;
      }
    }
    let topMood: string | null = null;
    let topCount = 0;
    for (const [mood, count] of Object.entries(moodCount)) {
      if (count > topCount) {
        topCount = count;
        topMood = mood;
      }
    }

    const dailyData = records
      .map((r) => ({
        day: parseInt(r.date.split('-')[2], 10),
        dateStr: r.date,
        hours: Math.round((totalDuration(r.learnings) / 60) * 10) / 10,
        mood: r.mood,
      }))
      .sort((a, b) => a.day - b.day);

    const subjectMap: Record<string, { min: number; color: string }> = {};
    for (const r of records) {
      for (const l of r.learnings) {
        if (!subjectMap[l.subject]) subjectMap[l.subject] = { min: 0, color: l.color };
        subjectMap[l.subject].min += l.durationMin;
      }
    }
    const subjectData = Object.entries(subjectMap)
      .map(([name, { min, color }]) => ({ name, hours: Math.round((min / 60) * 10) / 10, color, min }))
      .sort((a, b) => b.min - a.min);

    return { totalDays, totalMin, topMood, dailyData, subjectData };
  }, [records, moodCfgMap]);

  const hasData = stats.totalDays > 0;
  const chartGridColor = 'color-mix(in srgb, var(--hairline) 70%, transparent)';
  const chartTextColor = 'var(--ink-faint)';

  const topMoodCfg = stats.topMood ? moodCfgMap.get(stats.topMood) : undefined;

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-h1 text-[var(--ink)]">统计</h1>
          <p className="mt-1 font-sans text-caption text-[var(--ink-soft)]">
            {viewYear} 年 {viewMonth + 1} 月 · 截至今日 ·{' '}
            <span className="font-displaylatin italic text-[var(--ink-faint)]">the month, counted.</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/annual?year=${viewYear}`)}
            className="pill-dashed inline-flex items-center gap-1.5 px-3 py-1.5 font-sans text-caption text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
          >
            <TrendingUp size={14} strokeWidth={1.75} />
            年度回顾
          </button>
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <span className="min-w-[110px] text-center font-serif text-h2 text-[var(--ink)]">
            {viewYear}年 {MONTH_LABELS[viewMonth]}
          </span>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Summary cards */}
          {/* Summary cards（mockup .stat-card：标签在上、大数值在下，无图标圆） */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card rounded-xl px-[32px] py-[28px]">
              <div className="mb-3 font-serif text-[14px] text-[var(--ink-soft)]">总学习天数</div>
              <div className="font-mono text-num-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
                {stats.totalDays}
                <small className="ml-1 font-sans text-[14px] font-medium text-[var(--ink-faint)]">天</small>
              </div>
            </div>

            <div className="card rounded-xl px-[32px] py-[28px]">
              <div className="mb-3 font-serif text-[14px] text-[var(--ink-soft)]">总学习时长</div>
              <div className="font-mono text-num-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
                {formatDuration(stats.totalMin)}
              </div>
            </div>

            <div className="card rounded-xl px-[32px] py-[28px]">
              <div className="mb-3 font-serif text-[14px] text-[var(--ink-soft)]">最常心情</div>
              {topMoodCfg ? (
                <div className="flex items-center gap-3">
                  <Flower mood={topMoodCfg} size={34} variant="head" />
                  <span className="font-serif text-[22px] font-semibold text-[var(--ink)]">
                    {topMoodCfg.label}
                  </span>
                </div>
              ) : (
                <div className="font-serif text-[22px] font-semibold text-[var(--ink-faint)]">-</div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_1fr]">
            <div className="card rounded-xl p-5">
              <div className="mb-1">
                <h2 className="font-serif text-h2 text-[var(--ink)]">每日学习时长</h2>
                <p className="font-sans text-caption text-[var(--ink-faint)]">近 {stats.dailyData.length} 天 · 柱色随当日心情</p>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={chartGridColor} />
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
                      background: 'var(--card)',
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
                    shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { mood: string | null; hours: number } }) => {
                      const { x = 0, y = 0, width = 0, height = 0, payload } = props;
                      // 空日：基线处 hairline 小刻度（mockup .bar.empty）
                      if (!payload?.hours) {
                        return <rect x={x + width / 2 - 4} y={y + height - 4} width={8} height={4} rx={2} fill="var(--hairline)" />;
                      }
                      const moodCfg = payload?.mood ? moodCfgMap.get(payload.mood) : undefined;
                      const barColor = moodCfg
                        ? (isDark ? moodCfg.dark.solid : moodCfg.solid)
                        : 'var(--hairline)';
                      return <rect x={x + width / 2 - 8} y={y} width={16} height={height} fill={barColor} rx={6} ry={6} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card rounded-xl p-5">
              <div className="mb-1">
                <h2 className="font-serif text-h2 text-[var(--ink)]">学科分布</h2>
                <p className="font-sans text-caption text-[var(--ink-faint)]">本月 · 按学习时长</p>
              </div>
              {stats.subjectData.length > 0 ? (
                <div className="flex items-center gap-6">
                  {/* 环形图：固定尺寸 + HTML 中心字（比 Recharts Label/viewBox 更稳，深浅通用） */}
                  <div className="relative h-[150px] w-[150px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.subjectData}
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={66}
                          paddingAngle={2}
                          dataKey="hours"
                          stroke="none"
                        >
                          {stats.subjectData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-[17px] font-semibold leading-none text-[var(--ink)]">
                        {formatDuration(stats.totalMin)}
                      </span>
                      <span className="mt-1 font-sans text-[10.5px] leading-none text-[var(--ink-faint)]">总计</span>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {stats.subjectData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} />
                        <span
                          className="min-w-0 flex-1 truncate font-sans text-small text-[var(--ink)]"
                          title={entry.name}
                        >
                          {entry.name}
                        </span>
                        <span className="shrink-0 font-mono text-caption text-[var(--ink-soft)]">{formatDuration(entry.min)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[150px] items-center justify-center font-sans text-small text-[var(--ink-faint)]">
                  本月无学习记录
                </div>
              )}
            </div>
          </div>

          {/* Bouquet poster */}
          <BouquetPoster year={viewYear} month={viewMonth} records={records || []} moodMap={moodCfgMap} />
        </>
      ) : (
        /* Empty state */
        <div className="card flex flex-col items-center justify-center rounded-xl py-16 text-center">
          <Flower size={64} variant="head" />
          <h2 className="mt-6 font-serif text-h2 text-[var(--ink-soft)]">这里会随着时间长出果实</h2>
          <p className="mt-2 max-w-xs font-sans text-small text-[var(--ink-faint)]">
            坚持记录一周后，就能看到第一份统计报告
          </p>
          <div className="mt-6 flex items-end gap-4" style={{ height: '80px' }}>
            {[60, 120, 80, 150, 100].map((h, i) => (
              <div
                key={i}
                className="w-8 rounded-t-md border border-dashed border-[var(--hairline)]"
                style={{ height: `${h * 0.4}px` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
