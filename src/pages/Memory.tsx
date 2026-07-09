import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getRecordsByMonth, db } from '../lib/db';
import { formatDate, formatFullDate, totalDuration } from '../lib/dateUtils';
import { MOOD_CONFIGS, MONTH_LABELS } from '../lib/constants';
import { useApp } from '../context/AppContext';
import { hexToRgba } from '../lib/colorUtils';
import { ChevronLeft, ChevronRight, LayoutGrid, Clock } from 'lucide-react';
import type { DayRecord } from '../types';

type MemoryTab = 'gallery' | 'timeline';

/** Generate calendar weeks for a contribution-style grid */
function getMonthWeeks(year: number, month: number) {
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Start from Monday of the week containing the 1st
  const startDate = new Date(year, month, 1);
  const startDayOfWeek = startDate.getDay(); // 0=Sunday
  startDate.setDate(startDate.getDate() - (startDayOfWeek === 0 ? 6 : startDayOfWeek - 1));

  // End on Sunday of the week containing the last day
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

  // Timeline data - all records, ordered by date desc
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

  return (
    <div className="animate-fade-up">
      {/* 页面标题 + 标签切换 */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-hand text-2xl font-semibold text-[var(--color-text)]">
          回忆
        </h1>
        {/* Tab switcher */}
        <div className="flex items-center gap-1 rounded-full p-1" style={{ background: 'var(--color-card)', border: '1px solid var(--color-line)' }}>
          <button
            onClick={() => { setTab('gallery'); setSelectedDate(null); }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              tab === 'gallery'
                ? 'glass text-[var(--color-text)] shadow-2'
                : 'text-[var(--color-text-soft)]'
            }`}
          >
            <LayoutGrid size={16} />
            画廊
          </button>
          <button
            onClick={() => { setTab('timeline'); setSelectedDate(null); }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              tab === 'timeline'
                ? 'glass text-[var(--color-text)] shadow-2'
                : 'text-[var(--color-text-soft)]'
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
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-soft)] transition-all hover:bg-[var(--color-card)] hover:text-[var(--color-text)] hover:shadow-2"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-hand text-xl font-medium text-[var(--color-text)] min-w-[120px] text-center">
              {viewYear}年 {MONTH_LABELS[viewMonth]}
            </span>
            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-soft)] transition-all hover:bg-[var(--color-card)] hover:text-[var(--color-text)] hover:shadow-2"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 心情矩阵 */}
          {hasGalleryData ? (
            <>
              {/* 星期标题 */}
              <div className="mb-1 flex justify-center gap-1">
                {['一', '', '三', '', '五', '', '日'].map((label, i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center text-xs text-[var(--color-text-faint)]"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* 贡献矩阵 */}
              <div className="flex flex-col items-center gap-1">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex gap-1">
                    {week.map((day) => {
                      const record = galleryMap.get(day.dateStr);
                      const moodConfig = record?.mood ? MOOD_CONFIGS[record.mood] : null;
                      const isSelected = selectedDate === day.dateStr;

                      return (
                        <button
                          key={day.dateStr}
                          onClick={() => setSelectedDate(isSelected ? null : day.dateStr)}
                          className={`relative h-8 w-8 rounded-sm transition-all duration-200 ${
                            !day.isCurrentMonth ? 'opacity-20' : ''
                          }`}
                          style={{
                            background: moodConfig
                              ? `linear-gradient(160deg, ${moodConfig.light}, ${moodConfig.dark})`
                              : 'transparent',
                            border: moodConfig
                              ? 'none'
                              : `1px dashed ${theme === 'dark' ? 'rgba(189,178,168,0.2)' : 'rgba(189,178,168,0.3)'}`,
                            boxShadow: moodConfig
                              ? `inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.06)`
                              : 'none',
                            transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                            zIndex: isSelected ? 10 : 0,
                            outline: isSelected ? `2px solid var(--color-text)` : 'none',
                            outlineOffset: '2px',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.transform = 'scale(1.2)';
                              if (moodConfig) {
                                e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.06), 0 0 12px ${moodConfig.glow}`;
                              }
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.transform = 'scale(1)';
                              if (moodConfig) {
                                e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.06)`;
                              }
                            }
                          }}
                          title={day.dateStr}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* 选中的日期详情卡片 */}
              {selectedRecord && selectedDate && (
                <div className="mt-6 animate-fade-in">
                  <div className="glass mx-auto max-w-md rounded-xl p-4 shadow-3">
                    <div className="mb-2 flex items-center gap-2">
                      {selectedRecord.mood && (
                        <span className="text-2xl">{MOOD_CONFIGS[selectedRecord.mood].emoji}</span>
                      )}
                      <span className="font-hand text-lg font-medium text-[var(--color-text)]">
                        {formatFullDate(selectedDate)}
                      </span>
                      {selectedRecord.mood && (
                        <span className="text-sm text-[var(--color-text-soft)]">
                          · {MOOD_CONFIGS[selectedRecord.mood].label}
                        </span>
                      )}
                    </div>
                    {selectedRecord.learnings.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {selectedRecord.learnings.map((l) => (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              background: hexToRgba(l.color, theme === 'dark' ? 0.25 : 0.15),
                              color: l.color,
                            }}
                          >
                            {l.subject}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="font-mono text-sm text-[var(--color-text-soft)]">
                      学习 {Math.floor(totalDuration(selectedRecord.learnings) / 60)}h {totalDuration(selectedRecord.learnings) % 60}m
                    </div>
                    {selectedRecord.diary && (
                      <p className="mt-2 line-clamp-3 text-sm text-[var(--color-text-soft)]">
                        {selectedRecord.diary}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 图例 */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--color-text-faint)]">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm border border-dashed" style={{ borderColor: 'var(--color-line)' }} />
                  未记录
                </span>
                {Object.values(MOOD_CONFIGS).map((m) => (
                  <span key={m.type} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ background: m.gradient, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                    />
                    {m.emoji} {m.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ boxShadow: '0 0 24px rgba(255,185,56,0.15)', background: 'var(--color-card)' }}
              >
                <span className="text-3xl" style={{ animation: 'breath 2s ease-in-out infinite' }}>🌱</span>
              </div>
              <h2 className="font-hand text-xl text-[var(--color-text-soft)]">
                还没有记忆呢
              </h2>
              <p className="mt-2 max-w-xs text-sm text-[var(--color-text-faint)]">
                每天记录一点点，这里会慢慢变成你的心情花园
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
              {/* 垂直中线 */}
              <div
                className="absolute left-4 top-0 h-full w-0.5"
                style={{
                  background: `linear-gradient(180deg, transparent 0%, ${theme === 'dark' ? '#4A443C' : '#D5CCC0'} 5%, ${theme === 'dark' ? '#4A443C' : '#D5CCC0'} 95%, transparent 100%)`,
                }}
              />

              <div className="flex flex-col gap-6">
                {allRecords!.map((record) => {
                  const moodConfig = record.mood ? MOOD_CONFIGS[record.mood] : null;
                  return (
                    <div key={record.date} className="animate-fade-up relative pl-10">
                      {/* 时间线节点 */}
                      <div
                        className="absolute left-0 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-2"
                        style={{
                          background: moodConfig
                            ? `linear-gradient(160deg, ${moodConfig.light}, ${moodConfig.dark})`
                            : 'var(--color-card)',
                          border: moodConfig ? 'none' : '1px solid var(--color-line)',
                          boxShadow: moodConfig
                            ? `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 12px ${moodConfig.glow}`
                            : '0 1px 3px rgba(0,0,0,0.06)',
                        }}
                      >
                        {moodConfig ? (
                          <span className="text-sm">{moodConfig.emoji}</span>
                        ) : (
                          <span className="text-xs text-[var(--color-text-faint)]">·</span>
                        )}
                      </div>

                      {/* 日期卡片 */}
                      <div
                        className="glass group rounded-xl p-4 shadow-2 transition-all duration-250 hover:-translate-x-1 hover:shadow-3"
                        style={{
                          borderLeft: moodConfig ? `4px solid ${moodConfig.main}` : undefined,
                        }}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="font-hand text-lg font-medium text-[var(--color-text)]">
                            {formatFullDate(record.date)}
                          </span>
                          {moodConfig && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{
                              background: theme === 'dark'
                                ? hexToRgba(moodConfig.softDark, 0.6)
                                : hexToRgba(moodConfig.soft, 0.6),
                              color: moodConfig.main,
                            }}>
                              {moodConfig.emoji} {moodConfig.label}
                            </span>
                          )}
                        </div>

                        {/* 学习记录标签 */}
                        {record.learnings.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {record.learnings.map((l) => (
                              <span
                                key={l.id}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  background: hexToRgba(l.color, theme === 'dark' ? 0.25 : 0.15),
                                  color: l.color,
                                }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: l.color, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }}
                                />
                                {l.subject} · {Math.floor(l.durationMin / 60)}h {l.durationMin % 60}m
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 日记摘录 */}
                        {record.diary && (
                          <p className="line-clamp-3 text-sm text-[var(--color-text-soft)]">
                            {record.diary}
                          </p>
                        )}

                        {/* 总时长 */}
                        {record.learnings.length > 0 && (
                          <div className="mt-2 font-mono text-xs text-[var(--color-text-faint)]">
                            共学习 {Math.floor(totalDuration(record.learnings) / 60)}h {totalDuration(record.learnings) % 60}m
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 底部萌芽 */}
              <div className="relative mt-8 flex justify-center pl-10">
                <span className="text-2xl" style={{ animation: 'breath 2s ease-in-out infinite' }}>🌱</span>
              </div>
            </div>
          ) : (
            /* 空状态 */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ boxShadow: '0 0 24px rgba(255,185,56,0.15)', background: 'var(--color-card)' }}
              >
                <span className="text-3xl" style={{ animation: 'breath 2s ease-in-out infinite' }}>🌱</span>
              </div>
              <h2 className="font-hand text-xl text-[var(--color-text-soft)]">
                时间轴上还空空的
              </h2>
              <p className="mt-2 max-w-xs text-sm text-[var(--color-text-faint)]">
                从今天开始，让每一天都有迹可循
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
