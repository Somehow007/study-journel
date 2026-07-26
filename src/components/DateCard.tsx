import { useState } from 'react';
import { useMoodConfig } from '../lib/moodUtils';
import { useApp } from '../context/AppContext';
import { parseDate, formatDuration } from '../lib/dateUtils';
import { WEEKDAY_LABELS } from '../lib/constants';
import Flower from './Flower';

interface DateCardProps {
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  mood: string | null;
  totalMin: number;
  diary: string;
  goalMin: number;
  onClick: () => void;
}

export default function DateCard({
  day,
  dateStr,
  isCurrentMonth,
  isToday,
  isFuture,
  mood,
  totalMin,
  diary,
  goalMin,
  onClick,
}: DateCardProps) {
  const [hovered, setHovered] = useState(false);
  const { theme } = useApp();
  const isDark = theme === 'dark';
  const moodConfig = useMoodConfig(mood);

  const hasRecord = mood || totalMin > 0 || diary;
  const stemNorm = Math.min(1, Math.max(0.08, totalMin / 360));

  // 学习时间进度条：以每日目标为满格，有学习记录的日子才出现；
  // 颜色随当日心情（无心情则松绿），深色模式取心情深色档
  const pct = goalMin > 0 ? Math.min(100, (totalMin / goalMin) * 100) : 100;
  const barWidth = totalMin > 0 ? Math.max(pct, 3) : 0; // 极短时长保底可见
  const barColor = moodConfig ? (isDark ? moodConfig.dark.solid : moodConfig.solid) : 'var(--pine)';
  const goalReached = totalMin > 0 && pct >= 100;

  const dateObj = parseDate(dateStr);
  const weekday = WEEKDAY_LABELS[(dateObj.getDay() + 6) % 7]; // 周一开头：getDay 0=日 → 6

  const showTooltip = hovered && hasRecord;

  return (
    <div className="relative">
      {/* Tooltip */}
      {showTooltip && (
        <div
          className="animate-fade-in absolute bottom-full left-1/2 z-30 mb-3 w-48 -translate-x-1/2 rounded-xl px-4 py-3"
          style={{ background: '#2C322A', boxShadow: '0 8px 24px rgba(44,50,42,0.25)', pointerEvents: 'none' }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-caption" style={{ color: '#B9C0AE' }}>
              {dateObj.getMonth() + 1}/{dateObj.getDate()} · {weekday}
            </span>
            {moodConfig && (
              <span className="font-sans text-caption" style={{ color: moodConfig.solid }}>
                {moodConfig.flower ?? moodConfig.label}
              </span>
            )}
          </div>
          {totalMin > 0 && (
            <div className="font-mono text-caption" style={{ color: '#B9C0AE' }}>
              学习 {Math.floor(totalMin / 60)}h {String(totalMin % 60).padStart(2, '0')}m
              <span style={{ color: '#8B937F' }}> / 目标 {formatDuration(goalMin)}</span>
            </div>
          )}
          {diary && (
            <p className="mt-1.5 line-clamp-2 font-serif text-caption leading-relaxed" style={{ color: '#DDE2D2' }}>
              {diary}
            </p>
          )}
          <span
            className="absolute left-1/2 top-full -translate-x-1/2"
            style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #2C322A' }}
          />
        </div>
      )}

      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="group relative flex w-full items-center justify-center overflow-hidden rounded-[14px] transition-all duration-150 hover:shadow-[var(--shadow-1)]"
        style={{
          minHeight: '84px',
          padding: '7px 10px',
          background: isToday
            ? 'rgba(252,232,220,0.55)'
            : hovered
              ? 'color-mix(in srgb, var(--ink) 3%, transparent)'
              : 'transparent',
          opacity: isFuture && !hasRecord ? 0.45 : 1,
        }}
      >
        {/* 今日标记：右上角手绘小太阳（杏橙， rays 略不规则）+ 蜜桃格底 + 杏橙日期数字。
            原整格手绘环在紧凑格（84px）里与底部进度条争空间、屡被裁切，弃用。
            入场 bloom-in，hover 时 rays 轻转 25°，像太阳转了一下 */}
        {isToday && (
          <svg
            className="pointer-events-none absolute right-2 top-1.5 h-4 w-4 animate-bloom-in transition-transform duration-300 group-hover:rotate-[25deg]"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4.6" fill="var(--accent)" />
            <g stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" fill="none">
              <path d="M12 2.6 L12 5.3" />
              <path d="M12 18.7 L12 21.3" />
              <path d="M2.7 12 L5.4 12" />
              <path d="M18.6 12 L21.2 12" />
              <path d="M5.2 5.5 L7.2 7.3" />
              <path d="M16.8 16.9 L18.9 18.6" />
              <path d="M18.8 5.3 L16.7 7.2" />
              <path d="M7.3 16.8 L5.4 18.8" />
            </g>
          </svg>
        )}

        {/* Date number */}
        <span className="absolute left-[10px] top-1.5 font-mono text-[11.5px] leading-4">
          <span
            style={{
              color: isToday ? 'var(--accent)' : isCurrentMonth ? 'var(--ink-soft)' : 'var(--ink-faint)',
              fontWeight: isToday ? 600 : 400,
            }}
          >
            {day}
          </span>
        </span>

        {/* Flower / empty ring */}
        <div className="flex items-center justify-center">
          <span
            className="inline-block transition-transform duration-150 group-hover:scale-[1.08]"
            style={{ opacity: isFuture && !hasRecord ? 0.5 : 1 }}
          >
            {moodConfig ? (
              <Flower mood={moodConfig} size={40} stem={stemNorm} />
            ) : (
              <Flower
                size={28}
                color={isToday ? 'var(--accent)' : undefined}
                variant="head"
              />
            )}
          </span>
        </div>

        {/* 学习时间进度条（仅当日有学习记录时出现；满格在末端结一枚杏橙小果实） */}
        {totalMin > 0 && (
          <div
            className="absolute inset-x-[10px] bottom-[6px] h-[4px] rounded-full transition-all duration-150 group-hover:h-[5px]"
            style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}
            aria-label={`学习时长进度 ${Math.round(pct)}%`}
          >
            <div
              className="h-full origin-left animate-bar-grow rounded-full"
              style={{
                width: `${barWidth}%`,
                background: barColor,
                animationDelay: `${Math.min(day, 31) * 14}ms`,
              }}
            />
            {goalReached && (
              <span
                className="absolute right-0 top-1/2 h-[7px] w-[7px] -translate-y-1/2 translate-x-1/2 rounded-full"
                style={{ background: 'var(--accent)', boxShadow: '0 0 0 1.5px var(--card)' }}
              />
            )}
          </div>
        )}
      </button>
    </div>
  );
}
