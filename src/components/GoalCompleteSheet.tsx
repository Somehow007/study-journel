import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export interface GoalCompleteValues {
  quantity?: number;
  durationMin?: number;
  note?: string;
  syncLearning: boolean;
}

interface GoalCompleteSheetProps {
  mode: 'count' | 'task';
  title: string;
  unit?: string | null;
  defaultQuantity?: number;
  defaultDurationMin?: number;
  defaultNote?: string;
  onConfirm: (values: GoalCompleteValues) => Promise<void>;
  onClose: () => void;
}

export default function GoalCompleteSheet({
  mode,
  title,
  unit,
  defaultQuantity = 0,
  defaultDurationMin = 0,
  defaultNote = '',
  onConfirm,
  onClose,
}: GoalCompleteSheetProps) {
  const [quantity, setQuantity] = useState(defaultQuantity > 0 ? defaultQuantity : 1);
  const [hours, setHours] = useState(defaultDurationMin ? Math.floor(defaultDurationMin / 60) : 0);
  const [minutes, setMinutes] = useState(defaultDurationMin ? defaultDurationMin % 60 : 0);
  const [note, setNote] = useState(defaultNote);
  const [syncLearning, setSyncLearning] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const durationMin = hours * 60 + minutes;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'count' && quantity < 1) {
      setError('完成数量至少为 1');
      return;
    }
    if (syncLearning && durationMin < 1) {
      setError('同步到今日学习需要填写时长');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onConfirm({
        quantity: mode === 'count' ? quantity : undefined,
        durationMin: durationMin >= 1 ? durationMin : undefined,
        note: note.trim() || undefined,
        syncLearning,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="journal-sheet fixed inset-0 z-[60] flex items-end justify-center md:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="overlay journal-sheet-panel animate-slide-up relative"
      >
        <div className="flex justify-center pt-2 md:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-[var(--keyline)]" />
        </div>
        <div className="px-5 pb-2 pt-3 md:px-6 md:pt-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-faint)] hover:bg-[var(--paper)]"
          >
            <X size={18} />
          </button>
          <h3 className="mb-1 font-sans text-title text-[var(--ink)]">记下完成</h3>
          <p className="mb-4 font-sans text-caption text-[var(--ink-faint)]">{title}</p>

          {mode === 'count' && (
            <div className="mb-4">
              <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">
                今天完成了多少{unit ? `（${unit}）` : ''}
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="card w-full rounded-md px-3 py-2 font-mono text-num text-[var(--ink)] outline-none"
                style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
              />
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">时长（可选）</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0)))}
                className="card w-20 rounded-md px-3 py-2 text-center font-mono text-num text-[var(--ink)] outline-none"
                style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
              />
              <span className="font-sans text-small text-[var(--ink-soft)]">小时</span>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                className="card w-20 rounded-md px-3 py-2 text-center font-mono text-num text-[var(--ink)] outline-none"
                style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
              />
              <span className="font-sans text-small text-[var(--ink-soft)]">分钟</span>
            </div>
          </div>

          <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">感想（可选）</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="写一句今天的收获"
            className="card mb-3 w-full rounded-md px-3 py-2 font-sans text-body text-[var(--ink)] outline-none"
            style={{ border: '1px solid var(--keyline)', boxShadow: 'none', resize: 'none' }}
          />

          <label className="mb-4 flex items-center gap-2 font-sans text-small text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={syncLearning}
              onChange={(e) => setSyncLearning(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            同步时长到今日学习
          </label>

          {error && <p className="mb-3 font-sans text-caption text-red-500">{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--keyline)] py-2.5 font-sans text-small text-[var(--ink-soft)]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md py-2.5 font-sans text-small text-[var(--text-inverse)] disabled:opacity-40"
              style={{ background: 'var(--brand)' }}
            >
              {submitting ? '保存中…' : '完成'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
