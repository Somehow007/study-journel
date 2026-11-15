import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useDayMarks, useGoalsByPeriod } from '../lib/queries';
import { useStateConfigs } from '../lib/stateUtils';
import { formatPeriod } from '../lib/goalApi';
import { monthBounds } from '../lib/domain';
import { getCalendarDays, isToday, formatDate, parseDate, formatDuration } from '../lib/dateUtils';
import { WEEKDAY_LABELS, MONTH_LABELS } from '../lib/constants';
import { useIsDark } from '../lib/useIsDark';
import DateCard from '../components/DateCard';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import { Pressable } from '../components/ui/Pressable';

export default function MonthView() {
  const navigate = useNavigate();
  const isDark = useIsDark();
  const { currentMonth, setCurrentMonth, dailyGoalMin } = useApp();
  const { year, month } = currentMonth;

  const period = formatPeriod(year, month);
  const [from, to] = monthBounds(period);
  const { data: marks, isPending, error, refetch } = useDayMarks(from, to);
  const { data: goalMonth } = useGoalsByPeriod(period);
  const allStates = useStateConfigs();

  const markMap = useMemo(() => {
    const map = new Map((marks ?? []).map((m) => [m.date, m]));
    return map;
  }, [marks]);

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
    const list = marks ?? [];
    const count = list.filter(
      (m) => m.stateId || m.totalMin > 0 || m.entryCount > 0 || m.diaryPreview,
    ).length;
    const totalMin = list.reduce((sum, m) => sum + m.totalMin, 0);
    return { count, totalMin };
  }, [marks]);

  const formatHM = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  if (isPending && !marks) return <QueryLoading />;
  if (error && !marks) return <QueryError message={error.message} onRetry={() => void refetch()} />;

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
            const mark = markMap.get(day.dateStr);
            const goalMark = goalMonth?.dayMarks?.[day.dateStr];
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
                stateId={mark?.stateId ?? null}
                totalMin={mark?.totalMin ?? 0}
                diary={mark?.diaryPreview ?? ''}
                goalMin={dailyGoalMin}
                taskTotal={goalMark?.total ?? mark?.taskTotal ?? 0}
                taskDone={goalMark?.done ?? mark?.taskDone ?? 0}
                onClick={() => navigate(`/day/${day.dateStr}`)}
              />
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-3">
          <div className="flex flex-wrap items-center gap-3 font-sans text-caption text-[var(--ink-faint)]">
            {allStates.map((config) => (
              <span key={config.id} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: isDark ? config.dark.solid : config.color }}
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

      {(marks?.length ?? 0) === 0 && (
        <QueryEmpty
          title="这个月还没有记录"
          hint="点击今天的格子，开始写第一条"
        />
      )}
    </div>
  );
}
