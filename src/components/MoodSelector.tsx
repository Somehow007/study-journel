import { useAllMoodConfigs } from '../lib/moodUtils';
import { useIsDark } from '../lib/useIsDark';
import Flower from './Flower';

interface MoodSelectorProps {
  selected: string | null; // 内置 MoodType 或自定义 nanoid
  onSelect: (mood: string) => void;
}

export default function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  const isDark = useIsDark();
  const allMoods = useAllMoodConfigs();

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-3.5">
      {allMoods.map((config) => {
        const moodType = config.type;
        const isSelected = selected === moodType;

        const tint = isDark ? config.dark.tint : config.tint;
        const solid = isDark ? config.dark.solid : config.solid;
        const ink = isDark ? config.dark.ink : config.ink;
        const isCustom = !config.flower;

        return (
          <button
            key={moodType}
            onClick={() => onSelect(moodType)}
            className={`group flex flex-col items-center gap-2 rounded-xl py-3 transition-colors sm:py-2.5 ${
              isSelected ? 'animate-bloom-in' : ''
            }`}
          >
            {/* 圆底 56px：未选 tint，选中 solid */}
            <span
              className="relative flex h-14 w-14 items-center justify-center rounded-full transition-all duration-150"
              style={{
                background: isSelected ? solid : tint,
                boxShadow: isSelected ? '0 4px 14px rgba(44,50,42,0.14)' : 'none',
              }}
            >
              {isCustom ? (
                <span className="text-xl leading-none" style={{ color: ink }}>
                  {config.emoji}
                </span>
              ) : (
                <span className="inline-block transition-transform duration-150 group-hover:scale-[1.08]">
                  <Flower
                    mood={config}
                    size={28}
                    variant="head"
                    selected={isSelected}
                  />
                </span>
              )}
            </span>

            {/* 花名 / 心情名 */}
            <span
              className="max-w-full truncate px-1 font-sans text-caption"
              style={{ color: ink }}
            >
              {config.flower ?? config.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
