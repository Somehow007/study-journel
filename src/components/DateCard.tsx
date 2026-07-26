import { useMoodConfig } from '../lib/moodUtils';
import { durationProgress } from '../lib/dateUtils';
import { useApp } from '../context/AppContext';
import MoodFlower from './MoodFlower';
import { useState } from 'react';

interface DateCardProps {
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  mood: string | null;
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
  const moodConfig = useMoodConfig(mood);
  const progress = durationProgress(totalMin);

  const isDark = theme === 'dark';

  // Get mood colors for current theme
  const tintColor = moodConfig
    ? (isDark ? moodConfig.dark.tint : moodConfig.tint)
    : null;
  const solidColor = moodConfig
    ? (isDark ? moodConfig.dark.solid : moodConfig.solid)
    : null;
  const isDimmed = !isCurrentMonth;

  return (
    <div className="relative">
      {/* Tooltip — L2 overlay */}
      {hovered && (mood || totalMin > 0 || diary) && (
        <div
          className="animate-fade-in overlay absolute bottom-full left-1/2 z-30 mb-2 w-44 -translate-x-1/2 rounded-md px-3 py-2"
          style={{ pointerEvents: 'none', boxShadow: 'var(--shadow-3)' }}
        >
          {moodConfig && (
            <div className="mb-1 flex items-center gap-1.5">
              {mood && <MoodFlower moodType={mood} size={16} tone="seal" />}
              <span className="text-small text-[var(--ink)]">{moodConfig.label}</span>
            </div>
          )}
          {totalMin > 0 && (
            <div className="font-mono text-caption text-[var(--ink-soft)]">
              学习 {Math.floor(totalMin / 60)}h {totalMin % 60}m
            </div>
          )}
          {diary && (
            <div className="mt-1 line-clamp-2 text-caption text-[var(--ink-soft)]">{diary}</div>
          )}
        </div>
      )}

      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="group relative flex w-full flex-col items-center justify-between transition-colors duration-150"
        style={{
          minHeight: '104px',
          padding: '8px 6px',
          background: isDimmed
            ? 'var(--paper)'
            : hovered && tintColor
              ? tintColor + '66'  // ~40% opacity for tint on hover
              : hovered
                ? 'color-mix(in srgb, var(--ink) 4%, transparent)'
                : 'transparent',
          opacity: isDimmed ? 0.5 : 1,
          borderRight: '1px solid var(--hairline)',
          borderBottom: '1px solid var(--hairline)',
        }}
      >
        {/* Date number — top-left */}
        <span className="absolute left-1.5 top-1.5 font-mono text-caption" style={{ lineHeight: '16px' }}>
          {isToday ? (
            <span
              className="relative inline-flex h-[22px] w-[22px] items-center justify-center"
              style={{
                /* Vermillion seal ring around today's date — non-perfect circle with slight rotation */
                border: '1.5px solid var(--brand)',
                borderRadius: '50%',
                transform: 'rotate(-4deg)',
                color: 'var(--brand)',
                fontWeight: 600,
              }}
            >
              {day}
            </span>
          ) : (
            <span style={{ color: isDimmed ? 'var(--ink-faint)' : 'var(--ink-soft)' }}>
              {day}
            </span>
          )}
        </span>

        {/* Mood seal — center */}
        <div className="flex flex-1 items-center justify-center">
          {moodConfig ? (
            <span
              className="inline-block transition-transform duration-150"
              style={{ transform: hovered ? 'scale(1.15)' : 'scale(1)' }}
            >
              {mood && (
                <MoodFlower
                  moodType={mood}
                  size={24}
                  tone="line"
                />
              )}
            </span>
          ) : (
            <span className="text-caption text-[var(--ink-faint)] opacity-20">·</span>
          )}
        </div>

        {/* Learning duration bar — bottom */}
        <div className="w-full px-1">
          <div
            className="h-[2px] w-full rounded-full"
            style={{ background: 'var(--hairline)' }}
          >
            {totalMin > 0 ? (
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(progress * 100, 100)}%`,
                  background: solidColor || 'rgba(43,35,24,0.30)',
                }}
              />
            ) : null}
          </div>
        </div>
      </button>
    </div>
  );
}
