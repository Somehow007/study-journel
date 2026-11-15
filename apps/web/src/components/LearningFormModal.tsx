import { useState } from 'react';
import { X } from 'lucide-react';
import { SUBJECT_COLORS } from '../lib/constants';
import { nanoid } from 'nanoid';
import type { LearningItem } from '../types';
import Sheet, { useSheetClose } from './ui/Sheet';
import { Pressable } from './ui/Pressable';

interface LearningFormModalProps {
  item: LearningItem | null;
  onConfirm: (item: LearningItem) => void | Promise<void>;
  onClose: () => void;
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

export default function LearningFormModal({ item, onConfirm, onClose }: LearningFormModalProps) {
  const [subject, setSubject] = useState(item?.subject ?? '');
  const [hours, setHours] = useState(item ? Math.floor(item.durationMin / 60) : 0);
  const [minutes, setMinutes] = useState(item ? item.durationMin % 60 : 30);
  const [note, setNote] = useState(item?.note ?? '');
  const [color, setColor] = useState(item?.color ?? SUBJECT_COLORS[0]);
  const [durationError, setDurationError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const durationMin = hours * 60 + minutes;
  const title = item ? '编辑学习记录' : '添加学习记录';

  const handleSubmit = async () => {
    if (!subject.trim()) return;
    if (durationMin < 1) {
      setDurationError('时长至少 1 分钟');
      return;
    }
    setDurationError('');
    setSubmitting(true);
    try {
      await onConfirm({
        id: item?.id ?? nanoid(),
        subject: subject.trim(),
        durationMin,
        note: note.trim(),
        color,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet title={title} onClose={onClose} as="form" onSubmit={() => void handleSubmit()}>
      <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
        <CloseButton />
        <h3 className="mb-5 font-sans text-title text-[var(--ink)]">{title}</h3>

        <div className="mb-4">
          <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">项目 / 学科</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="如：React 组件设计"
            autoFocus
            className="card w-full rounded-md px-3 py-2 font-sans text-body text-[var(--ink)] outline-none transition-all focus:border-[var(--brand)]"
            style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">时长</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="24"
              value={hours}
              onChange={(e) => {
                setHours(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)));
                setDurationError('');
              }}
              className="card w-20 rounded-md px-3 py-2 text-center font-mono text-num text-[var(--ink)] outline-none"
              style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
            />
            <span className="font-sans text-small text-[var(--ink-soft)]">小时</span>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => {
                setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)));
                setDurationError('');
              }}
              className="card w-20 rounded-md px-3 py-2 text-center font-mono text-num text-[var(--ink)] outline-none"
              style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
            />
            <span className="font-sans text-small text-[var(--ink-soft)]">分钟</span>
          </div>
          {durationError && (
            <p className="mt-1.5 font-sans text-caption text-[var(--danger)]">{durationError}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">备注</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="简短写点什么…"
            className="card w-full rounded-md px-3 py-2 font-sans text-body text-[var(--ink)] outline-none"
            style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
          />
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">标记颜色</label>
          <div className="flex gap-2">
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
        </div>

        <div className="flex justify-end gap-2">
          <SheetCancel />
          <Pressable
            type="submit"
            disabled={!subject.trim() || durationMin < 1 || submitting}
            className="rounded-md px-5 font-sans text-small text-[var(--text-inverse)]"
            style={{ background: 'var(--brand)' }}
          >
            {submitting ? '保存中…' : item ? '保存' : '添加'}
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
