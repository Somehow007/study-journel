import type { Entry } from '../lib/types/api';
import { X } from 'lucide-react';
import { Pressable } from './ui/Pressable';

interface LearningRecordCardProps {
  item: Entry;
  onEdit: () => void;
  onDelete: () => void;
}

/** 分钟转 Xh YYm（统一两位分钟） */
export function formatDurationHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** 学习条目 = nb-table 行：科目（彩字）/ 内容+备注 / 时长+删除 */
export default function LearningRecordCard({ item, onEdit, onDelete }: LearningRecordCardProps) {
  const heading = item.title || item.note || item.subjectName;
  const note = item.note && item.note !== heading ? item.note : null;
  return (
    <tr>
      <td className="nb-k" style={{ color: item.subjectColor }}>
        {item.subjectName}
      </td>
      <td>
        <button type="button" onClick={onEdit} className="block w-full text-left">
          <b>{heading}</b>
          {note && <small>{note}</small>}
        </button>
      </td>
      <td className="nb-m">
        <span className="inline-flex items-center justify-end gap-2">
          {formatDurationHM(item.durationMin)}
          <Pressable
            variant="icon"
            onClick={onDelete}
            aria-label={`删除 ${heading}`}
            className="nb-row-del text-[var(--ink-faint)] hover:text-[var(--danger)]"
          >
            <X size={14} strokeWidth={1.75} />
          </Pressable>
        </span>
      </td>
    </tr>
  );
}
