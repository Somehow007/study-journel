import { useState } from 'react';
import { X } from 'lucide-react';
import Sheet, { useSheetClose } from './ui/Sheet';
import { Pressable } from './ui/Pressable';

export interface GoalCompleteValues {
  quantity?: number;
  durationMin?: number;
  note?: string;
  /** 勾选后服务端同步生成一条关联学习条目（entry.source='goal'） */
  createEntry: boolean;
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

function CloseButton() {
  const close = useSheetClose();
  return (
    <Pressable
      variant="icon"
      onClick={close}
      className="absolute right-3 top-3 flex items-center justify-center text-[var(--ink-faint)]"
      aria-label="关闭"
    >
      <X size={18} />
    </Pressable>
  );
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
  const [createEntry, setCreateEntry] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const durationMin = hours * 60 + minutes;

  const handleSubmit = async () => {
    if (mode === 'count' && quantity < 1) {
      setError('完成数量至少为 1');
      return;
    }
    if (createEntry && durationMin < 1) {
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
        createEntry,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet title="记下完成" onClose={onClose} as="form" onSubmit={() => void handleSubmit()}>
      <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
        <CloseButton />
        <div className="nb-dialog-h mb-1 pr-8">记下完成</div>
        <p className="mb-4 font-sans text-caption text-[var(--ink-faint)]">{title}</p>

        {mode === 'count' && (
          <>
            <label className="nb-flab">
              今天完成了多少{unit ? `（${unit}）` : ''}
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="nb-field num mb-4"
            />
          </>
        )}

        <label className="nb-flab">时长（可选）</label>
        <div className="mb-4 flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={24}
            value={hours}
            onChange={(e) => setHours(Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0)))}
            className="nb-field num nb-dur"
            aria-label="小时"
          />
          <span className="nb-dur-unit">h</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
            className="nb-field num nb-dur"
            aria-label="分钟"
          />
          <span className="nb-dur-unit">m</span>
        </div>

        <label className="nb-flab">感想（可选）</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="写一句今天的收获"
          className="nb-note nb-note-input mb-4 w-full resize-none bg-transparent outline-none placeholder:text-[var(--ink-faint)]"
        />

        <label className="mb-4 flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
          <input
            type="checkbox"
            checked={createEntry}
            onChange={(e) => setCreateEntry(e.target.checked)}
            className="h-4 w-4"
            style={{ accentColor: 'var(--brand)' }}
          />
          同时记为今日学习时长
        </label>

        {error && (
          <p className="mb-3 text-[12px]" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <SheetCancel />
          <button type="submit" disabled={submitting} className="nb-btn p">
            {submitting ? '保存中…' : '完成'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function SheetCancel() {
  const close = useSheetClose();
  return (
    <Pressable variant="pill" onClick={close} className="nb-btn">
      取消
    </Pressable>
  );
}
