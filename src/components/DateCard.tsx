import { MOOD_CONFIGS } from '../lib/constants';
import { durationProgress } from '../lib/dateUtils';
import { useApp } from '../context/AppContext';
import type { MoodType } from '../types';
import { useState } from 'react';

interface DateCardProps {
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  mood: MoodType | null;
  totalMin: number;
  diary: string;
  onClick: () => void;
}

export default function DateCard({
  day,
  isCurrentMonth,
  isToday,
  mood,
  totalMin,
  diary,
  onClick,
}: DateCardProps) {
  const [hovered, setHovered] = useState(false);
  const { theme } = useApp();
  const moodConfig = mood ? MOOD_CONFIGS[mood] : null;
  const progress = durationProgress(totalMin);

  // 浅色模式用 soft，深色模式用 softDark
  const softColor = moodConfig
    ? (theme === 'dark' ? moodConfig.softDark : moodConfig.soft)
    : null;

  const cardStyle: React.CSSProperties = isToday
    ? { animation: 'today-glow 3s ease-in-out infinite' }
    : {};

  return (
    <div className="relative">
      {/* Tooltip */}
      {hovered && (mood || totalMin > 0) && (
        <div
          className="glass animate-fade-in absolute bottom-full left-1/2 z-30 mb-2 w-44 -translate-x-1/2 rounded-xl px-3 py-2 shadow-3"
          style={{ pointerEvents: 'none' }}
        >
          {moodConfig && (
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-base">{moodConfig.emoji}</span>
              <span className="text-sm font-medium text-[var(--color-text)]">{moodConfig.label}</span>
            </div>
          )}
          {totalMin > 0 && (
            <div className="font-mono text-xs text-[var(--color-text-soft)]">
              学习 {Math.floor(totalMin / 60)}h {totalMin % 60}m
            </div>
          )}
          {diary && (
            <div className="mt-1 line-clamp-2 text-xs text-[var(--color-text-soft)]">{diary}</div>
          )}
        </div>
      )}

      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`group relative flex aspect-square w-full flex-col items-center justify-between overflow-hidden rounded-lg p-1.5 transition-all duration-200 hover:scale-105 ${
          isCurrentMonth ? '' : 'opacity-40'
        }`}
        style={{
          background: softColor
            ? `linear-gradient(160deg, ${softColor}, ${softColor})`
            : 'var(--color-card)',
          border: '1px solid var(--color-line)',
          backdropFilter: 'blur(12px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
          boxShadow: isToday
            ? '0 0 24px rgba(255,185,56,0.20)'
            : '0 2px 8px rgba(155,140,120,0.08), 0 1px 3px rgba(155,140,120,0.05)',
          ...cardStyle,
        }}
      >
        {/* 日期数字 */}
        <span
          className={`self-end font-mono text-[10px] leading-none md:text-xs ${
            isToday
              ? 'font-bold text-brand'
              : isCurrentMonth
                ? 'text-[var(--color-text-soft)]'
                : 'text-[var(--color-text-faint)]'
          }`}
        >
          {day}
        </span>

        {/* 心情 emoji */}
        <div className="flex flex-1 items-center justify-center">
          {moodConfig ? (
            <span
              className="text-lg transition-transform duration-200 group-hover:scale-110 md:text-2xl"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))' }}
            >
              {moodConfig.emoji}
            </span>
          ) : isToday ? (
            <span className="text-lg opacity-20 md:text-2xl">·</span>
          ) : (
            <span className="text-sm text-[var(--color-text-faint)] opacity-30 md:text-lg">·</span>
          )}
        </div>

        {/* 学习时长进度条 */}
        <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'rgba(189,178,168,0.2)' }}>
          {totalMin > 0 ? (
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress * 100}%`,
                background: moodConfig
                  ? moodConfig.gradient
                  : 'linear-gradient(90deg, #FFD66B, #FFA51F)',
                boxShadow: moodConfig ? `0 0 8px ${moodConfig.glow}` : 'none',
              }}
            />
          ) : (
            <div
              className="h-full w-full rounded-full"
              style={{
                borderTop: '1px dashed rgba(189,178,168,0.3)',
                background: 'transparent',
              }}
            />
          )}
        </div>
      </button>
    </div>
  );
}
