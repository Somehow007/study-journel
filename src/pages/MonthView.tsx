import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { getRecordsByMonth } from '../lib/api';
import { formatPeriod, getGoalsByPeriod } from '../lib/goalApi';
import { useApiQuery } from '../lib/useApiQuery';
import { getCalendarDays, isToday, formatDate, totalDuration, parseDate, formatDuration } from '../lib/dateUtils';
import { WEEKDAY_LABELS, MONTH_LABELS } from '../lib/constants';
import { useAllMoodConfigs } from '../lib/moodUtils';
import { useIsDark } from '../lib/useIsDark';
import DateCard from '../components/DateCard';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import { Pressable } from '../components/ui/Pressable';

export default function MonthView() {
  const navigate = useNavigate();
  const isDark = useIsDark();
  const { currentMonth, setCurrentMonth, dailyGoalMin } = useApp();
  const { year, month } = currentMonth;

  const { data: records, loading, error, refresh } = useApiQuery(
    () => getRecordsByMonth(year, month),
    [year, month],
  );
  const period = formatPeriod(year, month);
  const { data: goalMonth } = useApiQuery(() => getGoalsByPeriod(period), [period]);

  const recordMap = useMemo(() => {
    const map = new Map<string, { mood: string | null; totalMin: number; diary: string }>();
    if (records) {
      for (const r of records) {
        map.set(r.date, {
          mood: r.mood,
          totalMin: totalDuration(r.learnings),
          diary: r.diary,
        });
      }
    }
    return map;
  }, [records]);

  const days = getCalendarDays(year, month);
  const todayStr = formatDate(new Date());
  const now = new Date();

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setCurrentMonth(d.getFullYear(), d.getMonth());
  };

  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setCurrentMonth(d.getFullYear(), d.getMonth());
  };

  const goToday = () => {
    setCurrentMonth(now.getFullYear(), now.getMonth());
    navigate(`/day/${todayStr}`);
  };

  const summary = useMemo(() => {
    if (!records) return { count: 0, totalMin: 0 };
    const count = records.filter((r) => r.mood || r.learnings.length > 0 || r.diary).length;
    const totalMin = records.reduce((sum, r) => sum + totalDuration(r.learnings), 0);
    return { count, totalMin };
  }, [records]);

  const formatHM = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  const allMoods = useAllMoodConfigs();

  if (loading && !records) return <QueryLoading />;
  if (error && !records) return <QueryError message={error.message} onRetry={refresh} />;

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-h1 text-[var(--ink)]">{MONTH_LABELS[month]}日历</h1>
          <p className="mt-1.5 font-sans text-caption text-[var(--ink-faint)]">{year}</p>
        </div>
        <div className="flex items-center gap-2">
          <Pressable
            variant="icon"
            onClick={prevMonth}
            aria-label="上个月"
            className="flex items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)]"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </Pressable>
          <Pressable
            variant="pill"
            onClick={goToday}
            className="rounded-full border border-[var(--brand)] px-4 py-1.5 font-sans text-small text-[var(--brand)]"
          >
            今天
          </Pressable>
          <Pressable
            variant="icon"
            onClick={nextMonth}
            aria-label="下个月"
            className="flex items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)]"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </Pressable>
        </div>
      </div>

      <div className="card rounded-xl px-3 pt-3 pb-3 md:px-[28px] md:pt-[22px] md:pb-[16px]">
        <div className="grid grid-cols-7 pb-2">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center font-sans text-caption text-[var(--ink-faint)]">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {days.map((day) => {
            const record = recordMap.get(day.dateStr);
            const mark = goalMonth?.dayMarks?.[day.dateStr];
            const d = parseDate(day.dateStr);
            const isFuture = d > now;
            return (
              <DateCard
                key={day.dateStr}
                day={day.day}
                dateStr={day.dateStr}
                isCurrentMonth={day.isCurrentMonth}
                isToday={isToday(day.dateStr)}
                isFuture={isFuture}
                mood={record?.mood ?? null}
                totalMin={record?.totalMin ?? 0}
                diary={record?.diary ?? ''}
                goalMin={dailyGoalMin}
                taskTotal={mark?.total ?? 0}
                taskDone={mark?.done ?? 0}
                onClick={() => navigate(`/day/${day.dateStr}`)}
              />
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-3">
          <div className="flex flex-wrap items-center gap-3 font-sans text-caption text-[var(--ink-faint)]">
            {allMoods.map((config) => (
              <span key={config.type} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: isDark ? config.dark.solid : config.solid }}
                />
                <span>{config.label}</span>
              </span>
            ))}
          </div>
          <span className="font-sans text-caption text-[var(--ink-faint)]">
            本月 {summary.count} 天 · 共 {formatHM(summary.totalMin)} · 进度条以每日目标 {formatDuration(dailyGoalMin)} 为满格
          </span>
        </div>
      </div>

      {(records?.length ?? 0) === 0 && (
        <QueryEmpty
          title="这个月还没有记录"
          hint="点击今天的格子，开始写第一条"
        />
      )}
    </div>
  );
}
