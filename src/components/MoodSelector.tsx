import { MOOD_CONFIGS, MOOD_LIST } from '../lib/constants';
import { useApp } from '../context/AppContext';
import type { MoodType } from '../types';
import { useState, useRef, useEffect } from 'react';

interface MoodSelectorProps {
  selected: MoodType | null;
  onSelect: (mood: MoodType) => void;
}

export default function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  const [ripples, setRipples] = useState<Record<string, boolean>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const { theme } = useApp();

  // 清理定时器
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  const handleSelect = (mood: MoodType) => {
    // 触发波纹动画
    setRipples((prev) => ({ ...prev, [mood]: true }));
    if (timersRef.current[mood]) clearTimeout(timersRef.current[mood]);
    timersRef.current[mood] = setTimeout(() => {
      setRipples((prev) => ({ ...prev, [mood]: false }));
    }, 400);
    onSelect(mood);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-3">
      {MOOD_LIST.map((moodType) => {
        const config = MOOD_CONFIGS[moodType];
        const isSelected = selected === moodType;
        const isRippling = ripples[moodType];
        const isEmpty = !selected;

        return (
          <button
            key={moodType}
            onClick={() => handleSelect(moodType)}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 md:h-[72px] md:w-[72px]"
            style={{
              background: isSelected
                ? config.gradient
                : 'transparent',
              border: isSelected
                ? 'none'
                : `1.5px dashed ${theme === 'dark' ? 'rgba(189,178,168,0.25)' : 'rgba(189,178,168,0.45)'}`,
              boxShadow: isSelected
                ? `inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.06), 0 0 24px ${config.glow}`
                : isEmpty && moodType === 'happy'
                  ? `0 0 16px rgba(255,185,56,0.12)`
                  : 'none',
              animation: isSelected
                ? 'jelly-bounce 220ms cubic-bezier(0.34,1.56,0.64,1)'
                : isEmpty && moodType === 'happy'
                  ? 'breath 2s ease-in-out infinite'
                  : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                const hoverColor = theme === 'dark' ? config.softDark : config.soft;
                e.currentTarget.style.background = hoverColor;
                e.currentTarget.style.boxShadow = `0 0 20px ${config.glow}`;
                e.currentTarget.style.borderColor = 'transparent';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.boxShadow = isEmpty && moodType === 'happy' ? '0 0 16px rgba(255,185,56,0.12)' : 'none';
                e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(189,178,168,0.25)' : 'rgba(189,178,168,0.4)';
              }
            }}
          >
            {/* 波纹效果 */}
            {isRippling && (
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  border: `2px solid ${config.main}`,
                  animation: 'ripple 400ms ease-out forwards',
                }}
              />
            )}
            <span
              className="text-2xl transition-all duration-200 md:text-3xl"
              style={{
                filter: isSelected
                  ? 'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                  : 'none',
                opacity: isSelected ? 0.95 : 0.8,
              }}
            >
              {config.emoji}
            </span>
            {/* 标签 */}
            <span
              className={`absolute -bottom-5 font-hand text-xs transition-colors ${
                isSelected ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'
              }`}
            >
              {config.label}
            </span>
          </button>
        );
      })}
      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
