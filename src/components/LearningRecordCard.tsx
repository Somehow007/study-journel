import { MOOD_CONFIGS } from '../lib/constants';
import { formatDuration } from '../lib/dateUtils';
import type { LearningItem, MoodType } from '../types';
import { Pencil, Trash2 } from 'lucide-react';

interface LearningRecordCardProps {
  item: LearningItem;
  mood: MoodType | null;
  onEdit: () => void;
  onDelete: () => void;
}

export default function LearningRecordCard({ item, mood, onEdit, onDelete }: LearningRecordCardProps) {
  const moodConfig = mood ? MOOD_CONFIGS[mood] : null;
  const gradient = moodConfig
    ? moodConfig.gradient
    : 'linear-gradient(160deg, #FFD66B, #FFA51F)';

  return (
    <div
      className="group glass animate-card-pop relative flex flex-col gap-1 rounded-lg p-4 shadow-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3"
      style={{ paddingLeft: '20px' }}
    >
      {/* 左侧心情渐变竖线 */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-lg"
        style={{ background: gradient }}
      />

      {/* 学科标记点 + 名称 */}
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            background: item.color,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
          }}
        />
        <span className="text-lg font-semibold text-[var(--color-text)]">{item.subject}</span>
      </div>

      {/* 时长 */}
      <div className="font-mono text-sm text-[var(--color-text-soft)]">
        {formatDuration(item.durationMin)}
      </div>

      {/* 备注 */}
      {item.note && (
        <p className="text-sm text-[var(--color-text-soft)]">{item.note}</p>
      )}

      {/* 操作按钮 */}
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          onClick={onEdit}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-card)] hover:text-[var(--color-text)]"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-faint)] transition-colors hover:bg-red-500/10 hover:text-red-400"
          aria-label="删除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
