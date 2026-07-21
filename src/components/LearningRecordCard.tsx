import { formatDuration } from '../lib/dateUtils';
import type { LearningItem } from '../types';
import { Pencil, Trash2 } from 'lucide-react';

interface LearningRecordCardProps {
  item: LearningItem;
  onEdit: () => void;
  onDelete: () => void;
}

export default function LearningRecordCard({ item, onEdit, onDelete }: LearningRecordCardProps) {
  return (
    <div
      className="group flex items-center gap-3 px-2 py-2.5 transition-colors duration-150"
      style={{ borderBottom: '1px solid var(--hairline)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--paper)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* 学科色圆点 */}
      <span
        className="h-[10px] w-[10px] shrink-0 rounded-full"
        style={{ background: item.color }}
      />

      {/* 学科名 + 备注 */}
      <div className="flex-1 min-w-0">
        <span className="font-sans text-title text-[var(--ink)]">{item.subject}</span>
        {item.note && (
          <span className="ml-2 font-sans text-small text-[var(--ink-soft)]">{item.note}</span>
        )}
      </div>

      {/* 时长 */}
      <span className="font-mono text-num text-[var(--ink-soft)] shrink-0">
        {formatDuration(item.durationMin)}
      </span>

      {/* 操作按钮 — hover 时显示 */}
      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <button
          onClick={onEdit}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--card)] hover:text-[var(--ink)]"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-red-500/10 hover:text-red-400"
          aria-label="删除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
