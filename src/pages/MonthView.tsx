import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecordsByMonth } from '../lib/db';
import { getCalendarDays, isToday, formatDate, totalDuration } from '../lib/dateUtils';
import { MOOD_CONFIGS, WEEKDAY_LABELS, MONTH_LABELS } from '../lib/constants';
import DateCard from '../components/DateCard';
import type { MoodType } from '../types';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

export default function MonthView() {
  const navigate = useNavigate();
  const { currentMonth, setCurrentMonth } = useApp();
  const { year, month } = currentMonth;

  const records = useLiveQuery(() => getRecordsByMonth(year, month), [year, month]);

  const recordMap = useMemo(() => {
    const map = new Map<string, { mood: MoodType | null; totalMin: number; diary: string }>();
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
  const hasAnyRecord = (records?.length ?? 0) > 0;

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setCurrentMonth(d.getFullYear(), d.getMonth());
  };

  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setCurrentMonth(d.getFullYear(), d.getMonth());
  };

  const goToday = () => {
    const now = new Date();
    setCurrentMonth(now.getFullYear(), now.getMonth());
    navigate(`/day/${todayStr}`);
  };

  return (
    <div className="animate-fade-up">
      {/* 顶部导航 */}
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-hand text-2xl font-semibold text-[var(--color-text)]">
          {year}年 {MONTH_LABELS[month]}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-soft)] transition-all hover:bg-[var(--color-card)] hover:text-[var(--color-text)] hover:shadow-2"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToday}
            className="pill-dashed px-4 py-1.5 text-sm font-medium text-[var(--color-text-soft)] transition-all hover:text-[var(--color-text)] hover:shadow-2"
          >
            今天
          </button>
          <button
            onClick={nextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-soft)] transition-all hover:bg-[var(--color-card)] hover:text-[var(--color-text)] hover:shadow-2"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="mb-5 h-px bg-[var(--color-line)]" />

      {/* 星期标题 */}
      <div className="mb-1.5 grid grid-cols-7 gap-1 md:gap-2">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-xs md:text-sm font-medium text-[var(--color-text-soft)]">
            {label}
          </div>
        ))}
      </div>

      {/* 日历网格 */}
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {days.map((day) => {
          const record = recordMap.get(day.dateStr);
          const isTodayCard = isToday(day.dateStr);
          return (
            <DateCard
              key={day.dateStr}
              day={day.day}
              dateStr={day.dateStr}
              isCurrentMonth={day.isCurrentMonth}
              isToday={isTodayCard}
              mood={record?.mood ?? null}
              totalMin={record?.totalMin ?? 0}
              diary={record?.diary ?? ''}
              onClick={() => navigate(`/day/${day.dateStr}`)}
            />
          );
        })}
      </div>

      {/* 空状态引导 */}
      {!hasAnyRecord && (
        <div className="mt-6 flex justify-center">
          <p className="font-hand text-lg text-[var(--color-text-faint)]" style={{ animation: 'breath 2s ease-in-out infinite' }}>
            今天想记录什么心情呢？点击今天的卡片开始吧 ✨
          </p>
        </div>
      )}

      {/* 图例 */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--color-text-faint)]">
        {Object.values(MOOD_CONFIGS).map((m) => (
          <span key={m.type} className="flex items-center gap-1.5">
            <span>{m.emoji}</span>
            {m.label}
          </span>
        ))}
        <span className="text-[var(--color-text-faint)]">底部细条 = 学习时长</span>
      </div>
    </div>
  );
}
