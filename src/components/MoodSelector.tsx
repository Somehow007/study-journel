import { useAllMoodConfigs } from '../lib/moodUtils';
import { useIsDark } from '../lib/useIsDark';

interface MoodSelectorProps {
  selected: string | null;
  onSelect: (mood: string) => void;
}

export default function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  const isDark = useIsDark();
  const allMoods = useAllMoodConfigs();

  return (
    <div className="flex flex-wrap gap-2">
      {allMoods.map((config) => {
        const isSelected = selected === config.type;
        const solid = isDark ? config.dark.solid : config.solid;
        const tint = isDark ? config.dark.tint : config.tint;
        const ink = isDark ? config.dark.ink : config.ink;

        return (
          <button
            key={config.type}
            type="button"
            onClick={() => onSelect(config.type)}
            className="pressable-pill inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-sans text-small"
            style={{
              background: isSelected ? solid : tint,
              borderColor: isSelected ? 'transparent' : 'var(--keyline)',
              color: isSelected ? 'var(--text-inverse)' : ink,
            }}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: isSelected ? 'var(--text-inverse)' : solid }}
              aria-hidden="true"
            />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
