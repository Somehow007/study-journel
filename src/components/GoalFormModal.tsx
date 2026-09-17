import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { SUBJECT_COLORS } from '../lib/constants';
import { previewCountSplit } from '../lib/goalApi';
import type { GoalType } from '../types/goal';

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

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="overlay animate-slide-up relative w-full max-w-md rounded-t-2xl md:rounded-xl"
        style={{
          border: '1px solid var(--keyline)',
          boxShadow: 'var(--shadow-4)',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="px-6 pb-6 pt-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-faint)] hover:bg-[var(--paper)]"
          >
            <X size={18} />
          </button>
          <h3 className="mb-5 font-sans text-title text-[var(--ink)]">新的月目标</h3>

          <div className="mb-4 flex gap-2">
            {(
              [
                ['COUNT', '数量型'],
                ['CHECKLIST', '清单型'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className="flex-1 rounded-full px-3 py-2 font-sans text-small transition-all"
                style={
                  type === value
                    ? { background: 'var(--brand-soft)', color: 'var(--brand)', fontWeight: 500 }
                    : { border: '1px solid var(--keyline)', color: 'var(--ink-soft)' }
                }
              >
                {label}
              </button>
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
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-4 w-4 rounded-full transition-all"
                style={{
                  background: c,
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--keyline)] px-4 py-2 font-sans text-small text-[var(--ink-soft)]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="rounded-md px-5 py-2 font-sans text-small text-[var(--text-inverse)] disabled:opacity-40"
              style={{ background: 'var(--brand)' }}
            >
              {submitting ? '保存中…' : '创建'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
