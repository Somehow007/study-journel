import { useActiveStateConfigs } from '../lib/stateUtils';
import { useIsDark } from '../lib/useIsDark';

interface MoodSelectorProps {
  /** 当前选中的 stateId（day.stateId）；null = 未选择 */
  selected: string | null;
  /** 再次点选已选状态 → null（取消当天状态） */
  onSelect: (stateId: string | null) => void;
}

export default function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  const isDark = useIsDark();
  const states = useActiveStateConfigs();

  return (
    <div className="flex flex-wrap gap-2">
      {states.map((config) => {
        const isSelected = selected === config.id;
        const solid = isDark ? config.dark.solid : config.color;
        const tint = isDark ? config.dark.tint : config.tint;
        const ink = isDark ? config.dark.ink : config.ink;

        return (
          <button
            key={config.id}
            type="button"
            onClick={() => onSelect(isSelected ? null : config.id)}
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
