import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { getRecordsByMonth } from '../lib/api';
import { useApiQuery } from '../lib/useApiQuery';
import { MONTH_LABELS } from '../lib/constants';
import { totalDuration, formatDuration, formatDate } from '../lib/dateUtils';
import { useAllMoodConfigs } from '../lib/moodUtils';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import { useIsDark } from '../lib/useIsDark';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';

export default function Stats() {
  const isDark = useIsDark();
  const navigate = useNavigate();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const { data: records, loading, error, refresh } = useApiQuery(
    () => getRecordsByMonth(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const allMoods = useAllMoodConfigs();
  const moodCfgMap = useMemo(() => {
    const map = new Map<string, (typeof allMoods)[0]>();
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

  if (loading && !records) return <QueryLoading />;
  if (error && !records) return <QueryError message={error.message} onRetry={refresh} />;

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-sans text-h1 text-[var(--ink)]">统计</h1>
          <p className="mt-1 font-sans text-caption text-[var(--ink-soft)]">
            {viewYear} 年 {viewMonth + 1} 月
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
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)]"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <span className="min-w-[110px] text-center font-sans text-h2 text-[var(--ink)]">
            {viewYear}年 {MONTH_LABELS[viewMonth]}
          </span>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)]"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card rounded-xl px-[32px] py-[28px]">
              <div className="mb-3 font-sans text-[14px] text-[var(--ink-soft)]">总学习天数</div>
              <div className="font-mono text-num-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
                {stats.totalDays}
                <small className="ml-1 font-sans text-[14px] font-medium text-[var(--ink-faint)]">天</small>
              </div>
            </div>
            <div className="card rounded-xl px-[32px] py-[28px]">
              <div className="mb-3 font-sans text-[14px] text-[var(--ink-soft)]">总学习时长</div>
              <div className="font-mono text-num-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
                {formatDuration(stats.totalMin)}
              </div>
            </div>
            <div className="card rounded-xl px-[32px] py-[28px]">
              <div className="mb-3 font-sans text-[14px] text-[var(--ink-soft)]">最常心情</div>
              {topMoodCfg ? (
                <div className="flex items-center gap-3">
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ background: isDark ? topMoodCfg.dark.solid : topMoodCfg.solid }}
                  />
                  <span className="font-sans text-[22px] font-semibold text-[var(--ink)]">
                    {topMoodCfg.label}
                  </span>
                </div>
              ) : (
                <div className="font-sans text-[22px] font-semibold text-[var(--ink-faint)]">-</div>
              )}
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_1fr]">
            <div className="card rounded-xl p-5">
              <div className="mb-1">
                <h2 className="font-sans text-h2 text-[var(--ink)]">每日学习时长</h2>
                <p className="font-sans text-caption text-[var(--ink-faint)]">点击柱状图进入当天</p>
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
                    cursor="pointer"
                    onClick={(data) => {
                      const item = data as { dateStr?: string; payload?: { dateStr?: string } };
                      const dateStr = item.payload?.dateStr ?? item.dateStr;
                      if (dateStr) navigate(`/day/${dateStr}`);
                    }}
                    shape={(props: {
                      x?: number;
                      y?: number;
                      width?: number;
                      height?: number;
                      payload?: { mood: string | null; hours: number; dateStr: string };
                    }) => {
                      const { x = 0, y = 0, width = 0, height = 0, payload } = props;
                      const go = () => {
                        if (payload?.dateStr) navigate(`/day/${payload.dateStr}`);
                      };
                      if (!payload?.hours) {
                        return (
                          <rect
                            x={x + width / 2 - 4}
                            y={y + height - 4}
                            width={8}
                            height={4}
                            rx={2}
                            fill="var(--hairline)"
                            onClick={go}
                            style={{ cursor: 'pointer' }}
                          />
                        );
                      }
                      const moodCfg = payload?.mood ? moodCfgMap.get(payload.mood) : undefined;
                      const barColor = moodCfg
                        ? isDark
                          ? moodCfg.dark.solid
                          : moodCfg.solid
                        : 'var(--brand)';
                      return (
                        <rect
                          x={x + width / 2 - 8}
                          y={y}
                          width={16}
                          height={height}
                          fill={barColor}
                          rx={6}
                          ry={6}
                          onClick={go}
                          style={{ cursor: 'pointer' }}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card rounded-xl p-5">
              <div className="mb-1">
                <h2 className="font-sans text-h2 text-[var(--ink)]">学科分布</h2>
                <p className="font-sans text-caption text-[var(--ink-faint)]">本月 · 按学习时长</p>
              </div>
              {stats.subjectData.length > 0 ? (
                <div className="flex items-center gap-6">
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
                        <span className="min-w-0 flex-1 truncate font-sans text-small text-[var(--ink)]" title={entry.name}>
                          {entry.name}
                        </span>
                        <span className="shrink-0 font-mono text-caption text-[var(--ink-soft)]">
                          {formatDuration(entry.min)}
                        </span>
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
        </>
      ) : (
        <QueryEmpty
          title="这个月还没有记录"
          hint="记下第一天后，这里会出现时长与心情统计"
          action={
            <button
              type="button"
              onClick={() => navigate(`/day/${formatDate(new Date())}`)}
              className="rounded-md px-4 py-2 font-sans text-small text-[var(--text-inverse)]"
              style={{ background: 'var(--brand)' }}
            >
              去记第一天
            </button>
          }
        />
      )}
    </div>
  );
}
