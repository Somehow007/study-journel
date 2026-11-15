import { useState } from 'react';
import { useStateConfig } from '../lib/stateUtils';
import { parseDate, formatDuration } from '../lib/dateUtils';
import { WEEKDAY_LABELS } from '../lib/constants';
import { useIsDark } from '../lib/useIsDark';

interface DateCardProps {
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  /** day.stateId —— v3 状态 id；null = 未选择状态 */
  stateId: string | null;
  totalMin: number;
  /** 服务端预览文本（diaryPreview），非完整日记 */
  diary: string;
  goalMin: number;
  taskTotal?: number;
  taskDone?: number;
  onClick: () => void;
}

export default function DateCard({
  day,
  dateStr,
  isCurrentMonth,
  isToday,
  isFuture,
  stateId,
  totalMin,
  diary,
  goalMin,
  taskTotal = 0,
  taskDone = 0,
  onClick,
}: DateCardProps) {
  const [hovered, setHovered] = useState(false);
  const isDark = useIsDark();
  const stateConfig = useStateConfig(stateId);

  const hasRecord = Boolean(stateId || totalMin > 0 || diary);
  const hasTasks = taskTotal > 0;
  const tasksDone = hasTasks && taskDone >= taskTotal;
  const pct = goalMin > 0 ? Math.min(100, (totalMin / goalMin) * 100) : 100;
  const barWidth = totalMin > 0 ? Math.max(pct, 3) : 0;
  const barColor = stateConfig ? (isDark ? stateConfig.dark.solid : stateConfig.color) : 'var(--brand)';
  const goalReached = totalMin > 0 && pct >= 100;
  const dotColor = stateConfig
    ? isDark
      ? stateConfig.dark.solid
      : stateConfig.color
    : 'var(--keyline)';

  const dateObj = parseDate(dateStr);
  const weekday = WEEKDAY_LABELS[(dateObj.getDay() + 6) % 7];
  const showTooltip = hovered && (hasRecord || hasTasks);

  return (
    <div className="relative">
      {showTooltip && (
        <div
          className="animate-fade-in absolute bottom-full left-1/2 z-30 mb-3 hidden w-48 -translate-x-1/2 rounded-xl px-4 py-3 md:block"
          style={{
            background: 'var(--overlay)',
            border: '1px solid var(--keyline)',
            boxShadow: 'var(--shadow-2)',
            pointerEvents: 'none',
          }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-caption text-[var(--ink-faint)]">
              {dateObj.getMonth() + 1}/{dateObj.getDate()} · {weekday}
            </span>
            {stateConfig && (
              <span className="font-sans text-caption" style={{ color: stateConfig.color }}>
                {stateConfig.label}
              </span>
            )}
          </div>
          {totalMin > 0 && (
            <div className="font-mono text-caption text-[var(--ink-soft)]">
              学习 {Math.floor(totalMin / 60)}h {String(totalMin % 60).padStart(2, '0')}m
              <span className="text-[var(--ink-faint)]"> / 目标 {formatDuration(goalMin)}</span>
            </div>
          )}
          {diary && (
            <p className="mt-1.5 line-clamp-2 font-sans text-caption leading-relaxed text-[var(--ink-soft)]">
              {diary}
            </p>
          )}
          {hasTasks && (
            <div className="mt-1.5 font-mono text-caption text-[var(--ink-faint)]">
              任务 {taskDone}/{taskTotal}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="pressable-card group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-md md:rounded-lg"
        style={{
          background: isToday ? 'var(--brand-soft)' : undefined,
          opacity: isFuture && !hasRecord ? 0.45 : 1,
        }}
      >
        <span className="flex h-[52px] w-full flex-col items-center justify-center gap-1 px-1 md:hidden">
          <span
            className="font-mono text-[11px] leading-none"
            style={{
              color: isToday ? 'var(--brand)' : isCurrentMonth ? 'var(--ink-soft)' : 'var(--ink-faint)',
              fontWeight: isToday ? 600 : 400,
            }}
          >
            {day}
          </span>
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: hasRecord ? dotColor : 'transparent', border: hasRecord ? undefined : '1px dashed var(--keyline)' }}
            aria-hidden="true"
          />
          {hasTasks && (
            <span
              className="h-1 w-1 rounded-full"
              style={{
                background: tasksDone ? 'var(--brand)' : 'transparent',
                boxShadow: tasksDone ? undefined : 'inset 0 0 0 1px var(--brand)',
              }}
              aria-hidden="true"
            />
          )}
        </span>

        <span className="relative hidden min-h-[96px] w-full flex-col items-center px-2.5 pb-3 pt-2 md:flex">
          <span
            className="absolute left-2.5 top-2 font-mono text-[11.5px] leading-4"
            style={{
              color: isToday ? 'var(--brand)' : isCurrentMonth ? 'var(--ink-soft)' : 'var(--ink-faint)',
              fontWeight: isToday ? 600 : 400,
            }}
          >
            {day}
          </span>
          <span className="mt-5 flex flex-1 items-center justify-center">
            <span
              className="h-3 w-3 rounded-full"
              style={{
                background: hasRecord ? dotColor : 'transparent',
                border: hasRecord ? undefined : '1.5px dashed var(--keyline)',
                boxShadow: hasRecord && stateConfig ? `0 0 0 4px ${isDark ? stateConfig.dark.tint : stateConfig.tint}` : undefined,
              }}
              aria-hidden="true"
            />
          </span>
          {totalMin > 0 && (
            <div
              className="absolute inset-x-2.5 bottom-2 h-[4px] rounded-full"
              style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}
              aria-label={`学习时长进度 ${Math.round(pct)}%`}
            >
              <div
                className="h-full origin-left rounded-full"
                style={{
                  width: `${barWidth}%`,
                  background: barColor,
                }}
              />
              {goalReached && (
                <span
                  className="absolute right-0 top-1/2 h-[6px] w-[6px] -translate-y-1/2 translate-x-1/2 rounded-full"
                  style={{ background: 'var(--brand)', boxShadow: '0 0 0 1.5px var(--card)' }}
                />
              )}
            </div>
          )}
          {hasTasks && (
            <span
              className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
              style={{
                background: tasksDone ? 'var(--brand)' : 'transparent',
                boxShadow: tasksDone ? undefined : 'inset 0 0 0 1px var(--brand)',
              }}
              aria-hidden="true"
            />
          )}
        </span>
      </button>
    </div>
  );
}
