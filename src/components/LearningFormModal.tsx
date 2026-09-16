import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { SUBJECT_COLORS } from '../lib/constants';
import { nanoid } from 'nanoid';
import type { LearningItem } from '../types';

interface LearningFormModalProps {
  item: LearningItem | null;
  onConfirm: (item: LearningItem) => void | Promise<void>;
  onClose: () => void;
}

export default function LearningFormModal({ item, onConfirm, onClose }: LearningFormModalProps) {
  const [subject, setSubject] = useState(item?.subject ?? '');
  const [hours, setHours] = useState(item ? Math.floor(item.durationMin / 60) : 0);
  const [minutes, setMinutes] = useState(item ? item.durationMin % 60 : 30);
  const [note, setNote] = useState(item?.note ?? '');
  const [color, setColor] = useState(item?.color ?? SUBJECT_COLORS[0]);
  const [durationError, setDurationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const durationMin = hours * 60 + minutes;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 80) onClose();
    else setDragY(0);
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
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div
          className="flex justify-center pt-2 md:hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="h-1 w-10 rounded-full bg-[var(--keyline)]" />
        </div>

        <div className="px-6 pb-6 pt-3 md:pt-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>

          <h3 className="mb-5 font-sans text-title text-[var(--ink)]">
            {item ? '编辑学习记录' : '添加学习记录'}
          </h3>

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
              <p className="mt-1.5 font-sans text-caption text-red-500">{durationError}</p>
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
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--keyline)] px-4 py-2 font-sans text-small text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!subject.trim() || durationMin < 1 || submitting}
              className="rounded-md px-5 py-2 font-sans text-small text-white transition-all disabled:opacity-40"
              style={{ background: 'var(--brand)' }}
            >
              {submitting ? '保存中…' : item ? '保存' : '添加'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
