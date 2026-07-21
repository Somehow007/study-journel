import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecordsByMonth } from '../lib/db';
import { getCalendarDays, isToday, formatDate, totalDuration } from '../lib/dateUtils';
import { MOOD_CONFIGS, WEEKDAY_LABELS, MONTH_LABELS } from '../lib/constants';
import MoodSeal from '../assets/moods';
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

  // English month name for Caveat subtitle
  const engMonth = new Date(year, month, 1).toLocaleString('en-US', { month: 'long' });

  return (
    <div className="animate-fade-up" style={{ maxWidth: '1040px', margin: '0 auto' }}>
      {/* 页眉：衬线大标题 + Caveat 拉丁小注 */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-display text-[var(--ink)] leading-none">
            {MONTH_LABELS[month]}
          </h1>
          <p className="font-hand text-caption text-[var(--ink-faint)] mt-1">
            {engMonth} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 左箭头 — 圆形线框 */}
          <button
            onClick={prevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <ChevronLeft size={18} />
          </button>
          {/* 今天 — 朱红描边胶囊 */}
          <button
            onClick={goToday}
            className="rounded-full border border-[var(--brand)] px-4 py-1.5 text-small text-[var(--brand)] transition-all hover:bg-[var(--brand)] hover:text-white"
          >
            今天
          </button>
          {/* 右箭头 */}
          <button
            onClick={nextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 缝线分隔 */}
      <div className="stitched mb-4" />

      {/* 星期标题 */}
      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1.5 text-center font-sans text-caption text-[var(--ink-soft)]"
          >
            {label}
          </div>
        ))}
      </div>
      {/* 通长 hairline 分隔 */}
      <div className="mb-1" style={{ height: '1px', background: 'var(--hairline)' }} />

      {/* 日历网格 — 整版印刷格 */}
      <div
        className="card overflow-hidden"
        style={{ borderRadius: '14px' }}
      >
        <div className="grid grid-cols-7">
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
      </div>

      {/* 图例 */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 font-sans text-caption text-[var(--ink-faint)]">
        {Object.entries(MOOD_CONFIGS).map(([type, config]) => (
          <span key={type} className="flex items-center gap-1.5">
            <MoodSeal moodType={type as MoodType} size={16} tone="line" />
            {config.label}
          </span>
        ))}
        <span className="ml-2">刻度满格 = 6h</span>
      </div>

      {/* 空状态引导 */}
      {!hasAnyRecord && (
        <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
          <p className="font-serif text-h2 text-[var(--ink-soft)]">
            今天想记录什么心情呢？
          </p>
          <p className="mt-2 font-sans text-small text-[var(--ink-faint)]">
            点击今天的格子，盖下第一枚章
          </p>
          <div className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ border: '1.5px solid var(--brand)', transform: 'rotate(-4deg)' }}>
            <span className="font-mono text-caption text-[var(--brand)]" style={{ fontWeight: 600 }}>
              {new Date().getDate()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
