import type { LearningItem } from '../types';
import { X } from 'lucide-react';

interface LearningRecordCardProps {
  item: LearningItem;
  onEdit: () => void;
  onDelete: () => void;
}

/** 分钟转 Xh YYm（统一两位分钟） */
export function formatDurationHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function LearningRecordCard({ item, onEdit, onDelete }: LearningRecordCardProps) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="group flex w-full items-center gap-3.5 px-1 py-3.5 text-left transition-colors hover:bg-[var(--paper)] sm:py-3"
    >
      {/* 学科色点 10px */}
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: item.color }}
      />

      {/* 学科名 + 备注 */}
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="font-sans text-title text-[var(--ink)]">{item.subject}</span>
        {item.note && (
          <span className="hidden truncate font-sans text-small text-[var(--ink-soft)] sm:block">
            {item.note}
          </span>
        )}
      </div>

      {/* 时长 */}
      <span className="shrink-0 font-mono text-num text-[var(--ink)]">
        {formatDurationHM(item.durationMin)}
      </span>

      {/* 删除按钮：hover 显示，触屏常显 */}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--ink-faint)] opacity-0 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 touch-visible"
        role="button"
        aria-label="删除"
      >
        <X size={16} strokeWidth={1.75} />
      </span>
    </button>
  );
}
