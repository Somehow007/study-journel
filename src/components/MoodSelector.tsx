import { MOOD_CONFIGS, MOOD_LIST } from '../lib/constants';
import { useApp } from '../context/AppContext';
import MoodSeal from '../assets/moods';
import type { MoodType } from '../types';

interface MoodSelectorProps {
  selected: MoodType | null;
  onSelect: (mood: MoodType) => void;
}

export default function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  const { theme } = useApp();
  const isDark = theme === 'dark';

  return (
    <div className="flex flex-wrap items-center gap-3 md:gap-4">
      {MOOD_LIST.map((moodType) => {
        const config = MOOD_CONFIGS[moodType];
        const isSelected = selected === moodType;

        // Colors for current theme
        const tintColor = isDark ? config.dark.tint : config.tint;
        const solidColor = isDark ? config.dark.solid : config.solid;

        return (
          <button
            key={moodType}
            onClick={() => onSelect(moodType)}
            className="group relative flex flex-col items-center gap-1.5"
            style={{ animation: isSelected ? 'stamp-in 140ms cubic-bezier(0.2,0.9,0.3,1)' : 'none' }}
          >
            {/* Seal circle — 44px */}
            <span
              className="relative flex h-[44px] w-[44px] items-center justify-center rounded-full transition-all duration-150"
              style={{
                background: isSelected ? solidColor : 'transparent',
                border: isSelected
                  ? `2px solid ${solidColor}`
                  : `1.5px solid var(--hairline)`,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = tintColor;
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--hairline)';
                }
              }}
            >
              <MoodSeal
                moodType={moodType}
                size={isSelected ? 24 : 22}
                tone={isSelected ? 'seal' : 'line'}
                className="transition-transform duration-150 group-hover:scale-110"
              />
            </span>
            {/* Label */}
            <span className="font-sans text-caption text-[var(--ink-faint)] transition-colors group-hover:text-[var(--ink-soft)]">
              {config.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
