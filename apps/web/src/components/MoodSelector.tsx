import { useActiveStateConfigs } from '../lib/stateUtils';

interface MoodSelectorProps {
  /** 当前选中的 stateId（day.stateId）；null = 未选择 */
  selected: string | null;
  /** 再次点选已选状态 → null（取消当天状态） */
  onSelect: (stateId: string | null) => void;
}

/** 状态选择：SPEC-B 一排宋体文字，选中 = 红字 700 + 红色椭圆圈（nb-state） */
export default function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  const states = useActiveStateConfigs();

  return (
    <div className="nb-states">
      {states.map((config) => {
        const isSelected = selected === config.id;
        return (
          <button
            key={config.id}
            type="button"
            className={`nb-state${isSelected ? ' on' : ''}`}
            onClick={() => onSelect(isSelected ? null : config.id)}
          >
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
