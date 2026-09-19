import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { SUBJECT_COLORS } from '../lib/constants';
import { previewCountSplit } from '../lib/goalApi';
import type { GoalType } from '../types/goal';
import Sheet, { useSheetClose } from './ui/Sheet';
import { Pressable } from './ui/Pressable';

interface GoalFormModalProps {
  period: string;
  onClose: () => void;
  onSubmit: (payload: {
    id: string;
    period: string;
    title: string;
    type: GoalType;
    targetValue?: number;
    unit?: string;
    color: string;
    note?: string;
  }) => Promise<void>;
}

function CloseButton() {
  const close = useSheetClose();
  return (
    <Pressable
      variant="icon"
      onClick={close}
      className="absolute right-3 top-3 flex items-center justify-center rounded-full text-[var(--ink-faint)]"
      aria-label="关闭"
    >
      <X size={18} />
    </Pressable>
  );
}

export default function GoalFormModal({ period, onClose, onSubmit }: GoalFormModalProps) {
  const [type, setType] = useState<GoalType>('COUNT');
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState(300);
  const [unit, setUnit] = useState('词');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const preview = useMemo(
    () => (type === 'COUNT' ? previewCountSplit(targetValue, period) : null),
    [type, targetValue, period],
  );

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (type === 'COUNT' && (!targetValue || targetValue < 1)) return;
    setSubmitting(true);
    try {
      await onSubmit({
        id: nanoid(),
        period,
        title: title.trim(),
        type,
        targetValue: type === 'COUNT' ? targetValue : undefined,
        unit: type === 'COUNT' ? unit.trim() || '个' : undefined,
        color,
        note: note.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet title="新的月目标" onClose={onClose} as="form" onSubmit={() => void handleSubmit()}>
      <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
        <CloseButton />
        <h3 className="mb-5 font-sans text-title text-[var(--ink)]">新的月目标</h3>

        <div className="mb-4 flex gap-2">
          {(
            [
              ['COUNT', '数量型'],
              ['CHECKLIST', '清单型'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              variant="pill"
              onClick={() => setType(value)}
              className="flex-1 rounded-full px-3 py-2 font-sans text-small"
              style={
                type === value
                  ? { background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 500 }
                  : { border: '1px solid var(--keyline)', color: 'var(--ink-soft)' }
              }
            >
              {label}
            </Pressable>
          ))}
        </div>

        <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">标题</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === 'COUNT' ? '如：学习单词' : '如：学完 RAG 知识库搭建'}
          autoFocus
          className="card mb-4 w-full rounded-md px-3 py-2 font-sans text-body text-[var(--ink)] outline-none focus:border-[var(--brand)]"
          style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
        />

        {type === 'COUNT' && (
          <>
            <div className="mb-3 flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">月目标</label>
                <input
                  type="number"
                  min={1}
                  value={targetValue}
                  onChange={(e) => setTargetValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="card w-full rounded-md px-3 py-2 font-mono text-num text-[var(--ink)] outline-none"
                  style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
                />
              </div>
              <div className="w-24">
                <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">单位</label>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="词"
                  className="card w-full rounded-md px-3 py-2 font-sans text-body text-[var(--ink)] outline-none"
                  style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
                />
              </div>
            </div>
            {preview && preview.days > 0 && (
              <p className="mb-4 font-sans text-caption text-[var(--ink-faint)]">
                本月 {preview.days} 天，约 {preview.plannedDaily} {unit || '个'}/天 · {preview.plannedWeekly}{' '}
                {unit || '个'}/周
              </p>
            )}
          </>
        )}

        {type === 'CHECKLIST' && (
          <p className="mb-4 font-sans text-caption text-[var(--ink-faint)]">
            建好大目标后，再拆成若干小任务，完成即可勾选。
          </p>
        )}

        <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">说明（可选）</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="这个月想怎么推进"
          className="card mb-4 w-full rounded-md px-3 py-2 font-sans text-body text-[var(--ink)] outline-none"
          style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
        />

        <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">标记颜色</label>
        <div className="mb-6 flex gap-2">
          {SUBJECT_COLORS.map((c) => (
            <Pressable
              key={c}
              variant="icon"
              onClick={() => setColor(c)}
              aria-label={`颜色 ${c}`}
              className="h-8 w-8 rounded-full"
              style={{
                background: c,
                outline: color === c ? `2px solid ${c}` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <SheetCancel />
          <Pressable
            type="submit"
            disabled={!title.trim() || submitting}
            className="rounded-md px-5 font-sans text-small text-[var(--text-inverse)]"
            style={{ background: 'var(--brand)' }}
          >
            {submitting ? '保存中…' : '创建'}
          </Pressable>
        </div>
      </div>
    </Sheet>
  );
}

function SheetCancel() {
  const close = useSheetClose();
  return (
    <Pressable
      variant="pill"
      onClick={close}
      className="rounded-full border border-[var(--keyline)] px-4 py-2 font-sans text-small text-[var(--ink-soft)]"
    >
      取消
    </Pressable>
  );
}
