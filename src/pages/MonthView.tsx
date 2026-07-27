import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { getRecordsByMonth } from '../lib/api';
import { useApiQuery } from '../lib/useApiQuery';
import { getCalendarDays, isToday, formatDate, totalDuration, parseDate, formatDuration } from '../lib/dateUtils';
import { WEEKDAY_LABELS, MONTH_LABELS } from '../lib/constants';
import { useAllMoodConfigs } from '../lib/moodUtils';
import DateCard from '../components/DateCard';
import Flower from '../components/Flower';

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
}

export default function MonthView() {
  const navigate = useNavigate();
  const { currentMonth, setCurrentMonth, dailyGoalMin } = useApp();
  const { year, month } = currentMonth;

  const { data: records } = useApiQuery(() => getRecordsByMonth(year, month), [year, month]);

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
  const firstDay = new Date(year, month, 1);
  const weekNum = getWeekNumber(firstDay);

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-h1 text-[var(--ink)]">
            {MONTH_LABELS[month]}日历
          </h1>
          <p className="mt-1.5 font-sans text-caption text-[var(--ink-faint)]">
            {year} · 第 {weekNum} 周 ·{' '}
            <span className="font-displaylatin italic">{ENGLISH_MONTHS[month]} calendar</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <button
            onClick={goToday}
            className="rounded-full border border-[var(--accent)] px-4 py-1.5 font-sans text-small text-[var(--accent)] transition-all hover:bg-[var(--accent)] hover:text-white"
          >
            今天
          </button>
          <button
            onClick={nextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* 月历卡：白卡包裹 周标 + 网格 + 图例（紧凑档：整屏免滚动，padding 22/28/16） */}
      <div className="card rounded-xl px-[28px] pt-[22px] pb-[16px]">
        {/* Weekday labels：ink-faint，周标与网格间无分隔线 */}
        <div className="grid grid-cols-7 pb-2">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center font-sans text-caption text-[var(--ink-faint)]">
              {label}
            </div>
          ))}
        </div>

        {/* Calendar grid — 独立圆角格（gap 8px 紧凑档） */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const record = recordMap.get(day.dateStr);
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
                onClick={() => navigate(`/day/${day.dateStr}`)}
              />
            );
          })}
        </div>

        {/* Legend + summary：顶分隔线（紧凑档 mt 16 / pt 12） */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-3">
          <div className="flex flex-wrap items-center gap-3 font-sans text-caption text-[var(--ink-faint)]">
            {allMoods.map((config) => (
              <span key={config.type} className="flex items-center gap-1.5">
                <Flower mood={config} size={16} variant="head" />
                <span>{config.label}</span>
              </span>
            ))}
          </div>
          <span className="font-sans text-caption text-[var(--ink-faint)]">
            本月 {summary.count} 朵 · 共 {formatHM(summary.totalMin)} · 进度条以每日目标 {formatDuration(dailyGoalMin)} 为满格
          </span>
        </div>
      </div>

      {/* Empty state */}
      {(records?.length ?? 0) === 0 && (
        <div className="mt-10 flex flex-col items-center justify-center py-6 text-center">
          <Flower size={64} variant="head" className="mb-3" />
          <p className="font-serif text-h2 text-[var(--ink-soft)]">今天想记录什么心情呢？</p>
          <p className="mt-2 font-sans text-small text-[var(--ink-faint)]">
            点击今天的格子，盖下第一朵花
          </p>
        </div>
      )}
    </div>
  );
}
