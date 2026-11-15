import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { useDayMarks, useStatsMonth, useStates } from '../lib/queries';
import { findStateConfig, type StateConfig } from '../lib/stateUtils';
import { formatPeriod } from '../lib/goalApi';
import { monthBounds } from '../lib/domain';
import { formatDuration, formatDate } from '../lib/dateUtils';
import { MONTH_LABELS } from '../lib/constants';
import { useIsDark } from '../lib/useIsDark';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import type { JournalState } from '../lib/types/api';

export default function Stats() {
  const isDark = useIsDark();
  const navigate = useNavigate();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const period = formatPeriod(viewYear, viewMonth);
  const [from, to] = monthBounds(period);
  const { data: stats, isPending, error, refetch } = useStatsMonth(period);
  const { data: marks } = useDayMarks(from, to);
  const { data: states } = useStates();

  // 当月每个有记录日期的 stateId → 供柱状图着色
  const stateIdByDate = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of marks ?? []) map.set(m.date, m.stateId);
    return map;
  }, [marks]);

  const stateCfgById = useMemo(() => {
    const list: JournalState[] = states ?? [];
    const map = new Map<string, StateConfig>();
    for (const s of list) {
      const cfg = findStateConfig(list, s.id);
      if (cfg) map.set(s.id, cfg);
    }
    return map;
  }, [states]);

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

  const chartData = useMemo(() => {
    return (stats?.daily ?? []).map((d) => ({
      day: parseInt(d.date.slice(8), 10),
      dateStr: d.date,
      hours: Math.round((d.totalMin / 60) * 10) / 10,
      stateId: stateIdByDate.get(d.date) ?? null,
    }));
  }, [stats, stateIdByDate]);

  const subjectData = useMemo(
    () =>
      (stats?.subjectBreakdown ?? []).map((s) => ({
        name: s.name,
        color: s.color,
        min: s.minutes,
        hours: Math.round((s.minutes / 60) * 10) / 10,
      })),
    [stats],
  );

  const topState = stats?.stateBreakdown?.[0] ?? null;
  const topStateCfg = topState ? stateCfgById.get(topState.stateId) : undefined;

  const totalDays = stats?.daysRecorded ?? 0;
  const totalMin = stats?.totalMin ?? 0;
  const hasData = totalDays > 0 || (stats?.entryCount ?? 0) > 0 || totalMin > 0;
  const chartGridColor = 'color-mix(in srgb, var(--hairline) 70%, transparent)';
  const chartTextColor = 'var(--ink-faint)';

  if (isPending && !stats) return <QueryLoading />;
  if (error && !stats) return <QueryError message={error.message} onRetry={() => void refetch()} />;

  return (
    <div>
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
                {totalDays}
                <small className="ml-1 font-sans text-[14px] font-medium text-[var(--ink-faint)]">天</small>
              </div>
            </div>
            <div className="card rounded-xl px-[32px] py-[28px]">
              <div className="mb-3 font-sans text-[14px] text-[var(--ink-soft)]">总学习时长</div>
              <div className="font-mono text-num-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
                {formatDuration(totalMin)}
              </div>
            </div>
            <div className="card rounded-xl px-[32px] py-[28px]">
              <div className="mb-3 font-sans text-[14px] text-[var(--ink-soft)]">最常状态</div>
              {topState ? (
                <div className="flex items-center gap-3">
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{
                      background: topStateCfg
                        ? isDark
                          ? topStateCfg.dark.solid
                          : topStateCfg.color
                        : topState.color,
                    }}
                  />
                  <span className="font-sans text-[22px] font-semibold text-[var(--ink)]">
                    {topState.label}
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
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                      const item = data as { payload?: { dateStr?: string } };
                      const dateStr = item.payload?.dateStr;
                      if (dateStr) navigate(`/day/${dateStr}`);
                    }}
                    shape={(props: {
                      x?: number;
                      y?: number;
                      width?: number;
                      height?: number;
                      payload?: { stateId: string | null; hours: number; dateStr: string };
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
                      const cfg = payload?.stateId ? stateCfgById.get(payload.stateId) : undefined;
                      const barColor = cfg
                        ? isDark
                          ? cfg.dark.solid
                          : cfg.color
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
              {subjectData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="relative h-[150px] w-[150px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={subjectData}
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={66}
                          paddingAngle={2}
                          dataKey="hours"
                          stroke="none"
                        >
                          {subjectData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-[17px] font-semibold leading-none text-[var(--ink)]">
                        {formatDuration(totalMin)}
                      </span>
                      <span className="mt-1 font-sans text-[10.5px] leading-none text-[var(--ink-faint)]">总计</span>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {subjectData.map((entry) => (
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
          hint="记下第一天后，这里会出现时长与状态统计"
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
