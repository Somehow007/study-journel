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
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 sm:gap-3.5">
      {allMoods.map((config) => {
        const moodType = config.type;
        const isSelected = selected === moodType;

        const tint = isDark ? config.dark.tint : config.tint;
        const solid = isDark ? config.dark.solid : config.solid;
        const ink = isDark ? config.dark.ink : config.ink;
        const isCustom = !config.flower;
        // 深色未选磁贴用极淡白底（mockup #dark .mood-btn:not(.selected)）
        const tileBg = isSelected ? solid : isDark ? 'rgba(255,255,255,0.045)' : tint;
        // 未选花名：浅=ink/deep，深=solid（deep 在暗底太暗）
        const nameColor = isSelected ? '#FFFFFF' : isDark ? solid : ink;

        return (
          <button
            key={moodType}
            onClick={() => onSelect(moodType)}
            className={`group flex flex-col items-center gap-2 rounded-2xl px-1 pb-3 pt-4 transition-all duration-150 ${
              isSelected ? 'animate-bloom-in' : 'hover:-translate-y-0.5'
            }`}
            style={{
              background: tileBg,
              transform: isSelected ? 'scale(1.07)' : undefined,
              boxShadow: isSelected ? '0 4px 14px rgba(44,50,42,0.14)' : 'none',
            }}
          >
            {isCustom ? (
              <span className="text-2xl leading-none" style={{ color: isSelected ? '#FFFFFF' : ink }}>
                {config.emoji}
              </span>
            ) : (
              <span className="inline-block transition-transform duration-150 group-hover:scale-[1.08]">
                <Flower mood={config} size={34} variant="head" selected={isSelected} />
              </span>
            )}

            {/* 花名 / 心情名（磁贴内） */}
            <span
              className="max-w-full truncate px-1 font-sans text-caption font-medium"
              style={{ color: nameColor }}
            >
              {config.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
