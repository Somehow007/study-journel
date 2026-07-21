import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecordsByMonth, db } from '../lib/db';
import { formatDate, formatFullDate, totalDuration, parseDate } from '../lib/dateUtils';
import { MONTH_LABELS } from '../lib/constants';
import { useAllMoodConfigs } from '../lib/moodUtils';
import { useApp } from '../context/AppContext';
import MoodSeal from '../assets/moods';
import { ChevronLeft, ChevronRight, LayoutGrid, Clock } from 'lucide-react';
import type { DayRecord } from '../types';

type MemoryTab = 'gallery' | 'timeline';

/** Generate calendar weeks for a contribution-style grid (starting Monday) */
function getMonthWeeks(year: number, month: number) {
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  const startDate = new Date(year, month, 1);
  const startDayOfWeek = startDate.getDay(); // 0=Sunday
  startDate.setDate(startDate.getDate() - (startDayOfWeek === 0 ? 6 : startDayOfWeek - 1));

  const endDate = new Date(year, month, daysInMonth);
  const endDayOfWeek = endDate.getDay();
  endDate.setDate(endDate.getDate() + (endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek));

  const weeks: { date: Date; day: number; isCurrentMonth: boolean; dateStr: string }[][] = [];
  let current = new Date(startDate);
  let week: typeof weeks[0] = [];

  while (current <= endDate) {
    week.push({
      date: new Date(current),
      day: current.getDate(),
      isCurrentMonth: current.getMonth() === month && current.getFullYear() === year,
      dateStr: formatDate(current),
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
    current.setDate(current.getDate() + 1);
  }
  if (week.length > 0) weeks.push(week);

  return weeks;
}

export default function Memory() {
  const { theme } = useApp();
  const isDark = theme === 'dark';
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [tab, setTab] = useState<MemoryTab>('gallery');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Gallery data
  const galleryRecords = useLiveQuery(() => getRecordsByMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const galleryMap = useMemo(() => {
    const map = new Map<string, DayRecord>();
    if (galleryRecords) {
      for (const r of galleryRecords) map.set(r.date, r);
    }
    return map;
  }, [galleryRecords]);

  const weeks = useMemo(() => getMonthWeeks(viewYear, viewMonth), [viewYear, viewMonth]);

  // Timeline data
  const allRecords = useLiveQuery(() => db.records.orderBy('date').reverse().toArray(), []);

  const selectedRecord = selectedDate ? galleryMap.get(selectedDate) : null;

  const prevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
    setSelectedDate(null);
  };

  const nextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
    setSelectedDate(null);
  };

  const hasGalleryData = (galleryRecords?.length ?? 0) > 0;
  const hasTimelineData = (allRecords?.length ?? 0) > 0;
  const allMoods = useAllMoodConfigs();
  const moodCfgMap = useMemo(() => {
    const map = new Map<string, typeof allMoods[0]>();
    for (const cfg of allMoods) map.set(cfg.type, cfg);
    return map;
  }, [allMoods]);

  return (
    <div className="animate-fade-up" style={{ maxWidth: '880px', margin: '0 auto' }}>
      {/* 页面标题 + Tab 切换 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-h1 text-[var(--ink)]">
          回忆
        </h1>
        {/* Tab switcher — caption + vermillion underline */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setTab('gallery'); setSelectedDate(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-sans text-small transition-colors border-b-2 ${
              tab === 'gallery'
                ? 'text-[var(--ink)] border-[var(--brand)]'
                : 'text-[var(--ink-soft)] border-transparent hover:text-[var(--ink)]'
            }`}
          >
            <LayoutGrid size={16} />
            画廊
          </button>
          <button
            onClick={() => { setTab('timeline'); setSelectedDate(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-sans text-small transition-colors border-b-2 ${
              tab === 'timeline'
                ? 'text-[var(--ink)] border-[var(--brand)]'
                : 'text-[var(--ink-soft)] border-transparent hover:text-[var(--ink)]'
            }`}
          >
            <Clock size={16} />
            时间轴
          </button>
        </div>
      </div>

      {/* ========== 画廊模式 ========== */}
      {tab === 'gallery' && (
        <>
          {/* 月份导航 */}
          <div className="mb-5 flex items-center justify-center gap-4">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-serif text-h2 text-[var(--ink)] min-w-[120px] text-center">
              {viewYear}年 {MONTH_LABELS[viewMonth]}
            </span>
            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] transition-all hover:border-[var(--ink)] hover:text-[var(--ink)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 印章矩阵 */}
          {hasGalleryData ? (
            <>
              {/* 星期标题 */}
              <div className="mb-1 flex justify-center gap-1.5">
                {['一', '', '三', '', '五', '', '日'].map((label, i) => (
                  <div
                    key={i}
                    className="flex h-7 w-7 items-center justify-center font-sans text-caption text-[var(--ink-faint)]"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* 印章矩阵 */}
              <div className="flex flex-col items-center gap-1.5">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex gap-1.5">
                    {week.map((day) => {
                      const record = galleryMap.get(day.dateStr);
                      const moodConfig = record?.mood ? (moodCfgMap.get(record.mood) ?? null) : null;
                      const isSelected = selectedDate === day.dateStr;
                      const tintColor = moodConfig
                        ? (isDark ? moodConfig.dark.tint : moodConfig.tint)
                        : null;

                      return (
                        <button
                          key={day.dateStr}
                          onClick={() => setSelectedDate(isSelected ? null : day.dateStr)}
                          className={`relative flex h-7 w-7 items-center justify-center rounded-sm transition-all duration-150 ${
                            !day.isCurrentMonth ? 'opacity-20' : ''
                          }`}
                          style={{
                            background: tintColor || 'transparent',
                            border: moodConfig
                              ? 'none'
                              : `1px dashed var(--hairline)`,
                            transform: isSelected ? 'scale(1.3)' : 'scale(1)',
                            zIndex: isSelected ? 10 : 0,
                            outline: isSelected ? '2px solid var(--ink)' : 'none',
                            outlineOffset: '2px',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.transform = 'scale(1.15)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.transform = 'scale(1)';
                            }
                          }}
                          title={day.dateStr}
                        >
                          {moodConfig && record?.mood && (
                            <MoodSeal moodType={record.mood} size={16} tone="line" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* 选中日期详情卡 */}
              {selectedRecord && selectedDate && (
                <div className="mt-6 animate-fade-in">
                  <div className="card mx-auto max-w-md rounded-lg p-4" style={{ boxShadow: 'var(--shadow-2)' }}>
                    <div className="mb-2 flex items-center gap-2">
                      {selectedRecord.mood && (
                        <MoodSeal moodType={selectedRecord.mood} size={28} tone="seal" />
                      )}
                      <span className="font-serif text-title text-[var(--ink)]">
                        {formatFullDate(selectedDate)}
                      </span>
                      {selectedRecord.mood && moodCfgMap.get(selectedRecord.mood) && (
                        <span className="font-sans text-small text-[var(--ink-soft)]">
                          · {moodCfgMap.get(selectedRecord.mood)!.label}
                        </span>
                      )}
                    </div>
                    {selectedRecord.learnings.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {selectedRecord.learnings.map((l) => (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-caption"
                            style={{
                              background: `${l.color}1A`,
                              color: l.color,
                            }}
                          >
                            {l.subject}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="font-mono text-small text-[var(--ink-soft)]">
                      学习 {Math.floor(totalDuration(selectedRecord.learnings) / 60)}h {totalDuration(selectedRecord.learnings) % 60}m
                    </div>
                    {selectedRecord.diary && (
                      <p className="mt-2 line-clamp-3 font-serif text-small text-[var(--ink-soft)]">
                        {selectedRecord.diary}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 图例 */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 font-sans text-caption text-[var(--ink-faint)]">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-[var(--hairline)]" />
                  未记录
                </span>
                {allMoods.map((config) => (
                  <span key={config.type} className="flex items-center gap-1">
                    <MoodSeal moodType={config.type} size={14} />
                    {config.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex flex-wrap justify-center gap-2">
                {allMoods.slice(0, 4).map((config) => (
                  <span
                    key={config.type}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[var(--hairline)]"
                  />
                ))}
              </div>
              <h2 className="font-serif text-h2 text-[var(--ink-soft)]">
                还没有记忆
              </h2>
              <p className="mt-2 max-w-xs font-sans text-small text-[var(--ink-faint)]">
                每天盖一枚章，这里会长成你的心情花园
              </p>
            </div>
          )}
        </>
      )}

      {/* ========== 时间轴模式 ========== */}
      {tab === 'timeline' && (
        <>
          {hasTimelineData ? (
            <div className="relative mx-auto max-w-2xl">
              {/* 垂直纵线 — hairline */}
              <div
                className="absolute left-[60px] top-0 h-full w-px"
                style={{ background: 'var(--hairline)' }}
              />

              <div className="flex flex-col gap-6">
                {allRecords!.map((record) => {
                  const moodConfig = record.mood ? (moodCfgMap.get(record.mood) ?? null) : null;
                  const solidColor = moodConfig
                    ? (isDark ? moodConfig.dark.solid : moodConfig.solid)
                    : null;
                  const dateParts = record.date.split('-');
                  const dayLabel = `${parseInt(dateParts[1])}/${parseInt(dateParts[2])}`;
                  const weekday = ['日', '一', '二', '三', '四', '五', '六'][parseDate(record.date).getDay()];

                  return (
                    <div key={record.date} className="animate-fade-up relative flex items-start gap-4">
                      {/* 左列：等宽日期 */}
                      <div className="w-[60px] shrink-0 text-right pr-4">
                        <div className="font-mono text-num text-[var(--ink)]">{dayLabel}</div>
                        <div className="font-sans text-caption text-[var(--ink-faint)]">{weekday}</div>
                      </div>

                      {/* 时间线节点 — 6px solid 圆点 */}
                      <div
                        className="absolute left-[60px] top-1.5 z-10 h-[6px] w-[6px] -translate-x-1/2 rounded-full"
                        style={{ background: solidColor || 'var(--ink-faint)' }}
                      />

                      {/* 右列：记录卡片 */}
                      <div
                        className="card flex-1 rounded-lg p-4 transition-shadow"
                        style={{ boxShadow: 'var(--shadow-1)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-1)'; }}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          {moodConfig && record.mood && (
                            <MoodSeal moodType={record.mood} size={20} tone="seal" />
                          )}
                          <span className="font-serif text-title text-[var(--ink)]">
                            {formatFullDate(record.date)}
                          </span>
                          {moodConfig && (
                            <span
                              className="inline-block rounded-full px-2 py-0.5 font-sans text-caption"
                              style={{
                                background: isDark ? `${moodConfig.dark.tint}99` : `${moodConfig.tint}99`,
                                color: isDark ? moodConfig.dark.solid : moodConfig.solid,
                              }}
                            >
                              {moodConfig.label}
                            </span>
                          )}
                        </div>

                        {/* 学习记录标签 */}
                        {record.learnings.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {record.learnings.map((l) => (
                              <span
                                key={l.id}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-caption"
                                style={{
                                  background: `${l.color}1A`,
                                  color: l.color,
                                }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: l.color }}
                                />
                                {l.subject} · {Math.floor(l.durationMin / 60)}h {l.durationMin % 60}m
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 日记摘录 */}
                        {record.diary && (
                          <p className="line-clamp-3 font-serif text-small text-[var(--ink-soft)]">
                            {record.diary}
                          </p>
                        )}

                        {/* 总时长 */}
                        {record.learnings.length > 0 && (
                          <div className="mt-2 font-mono text-caption text-[var(--ink-faint)]">
                            共学习 {Math.floor(totalDuration(record.learnings) / 60)}h {totalDuration(record.learnings) % 60}m
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 h-px w-32" style={{ background: 'var(--hairline)' }} />
              <h2 className="font-serif text-h2 text-[var(--ink-soft)]">
                时间轴上还空空的
              </h2>
              <p className="mt-2 max-w-xs font-sans text-small text-[var(--ink-faint)]">
                从今天开始，让每一天都有迹可循
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
