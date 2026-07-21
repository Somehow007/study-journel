import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SUBJECT_COLORS } from '../lib/constants';
import { nanoid } from 'nanoid';
import type { LearningItem } from '../types';

interface LearningFormModalProps {
  item: LearningItem | null;
  onConfirm: (item: LearningItem) => void;
  onClose: () => void;
}

export default function LearningFormModal({ item, onConfirm, onClose }: LearningFormModalProps) {
  const [subject, setSubject] = useState(item?.subject ?? '');
  const [hours, setHours] = useState(item ? Math.floor(item.durationMin / 60) : 0);
  const [minutes, setMinutes] = useState(item ? item.durationMin % 60 : 0);
  const [note, setNote] = useState(item?.note ?? '');
  const [color, setColor] = useState(item?.color ?? SUBJECT_COLORS[0]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    const result: LearningItem = {
      id: item?.id ?? nanoid(),
      subject: subject.trim(),
      durationMin: hours * 60 + minutes,
      note: note.trim(),
      color,
    };
    onConfirm(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* 背景遮罩 — ink 20% */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'rgba(43,35,24,0.20)' }}
        onClick={onClose}
      />

      {/* 弹窗面板 — L2 overlay + shadow-4 + r-xl + slide-up */}
      <form
        onSubmit={handleSubmit}
        className="overlay animate-slide-up relative w-full max-w-md rounded-xl p-6"
        style={{
          border: '1px solid var(--keyline)',
          boxShadow: 'var(--shadow-4)',
        }}
      >
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
        >
          <X size={18} />
        </button>

        <h3 className="mb-5 font-serif text-title text-[var(--ink)]">
          {item ? '编辑学习记录' : '添加学习记录'}
        </h3>

        {/* 学科/项目名称 */}
        <div className="mb-4">
          <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">项目 / 学科</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="如：React 组件设计"
            autoFocus
            className="card w-full rounded-md px-3 py-2 font-sans text-body text-[var(--ink)] outline-none transition-all focus:border-[var(--brand)]"
            style={{
              border: '1px solid var(--keyline)',
              boxShadow: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--brand)';
              e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--brand) 15%, transparent)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--keyline)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* 时长 */}
        <div className="mb-4">
          <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">时长</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="24"
              value={hours}
              onChange={(e) => setHours(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))}
              className="card w-20 rounded-md px-3 py-2 text-center font-mono text-num text-[var(--ink)] outline-none"
              style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
            />
            <span className="font-sans text-small text-[var(--ink-soft)]">小时</span>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
              className="card w-20 rounded-md px-3 py-2 text-center font-mono text-num text-[var(--ink)] outline-none"
              style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
            />
            <span className="font-sans text-small text-[var(--ink-soft)]">分钟</span>
          </div>
        </div>

        {/* 备注 */}
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

        {/* 颜色选择 — 16px 圆点，选中态外圈 2px 描边 */}
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

        {/* 操作按钮 */}
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
            disabled={!subject.trim()}
            className="rounded-md px-5 py-2 font-sans text-small text-white transition-all disabled:opacity-40"
            style={{ background: 'var(--brand)' }}
          >
            {item ? '保存' : '添加'}
          </button>
        </div>
      </form>
    </div>
  );
}
