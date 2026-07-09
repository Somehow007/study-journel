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
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* 弹窗面板 */}
      <form
        onSubmit={handleSubmit}
        className="glass animate-slide-up relative w-full max-w-md rounded-2xl p-6 shadow-4"
        style={{
          background: 'var(--color-card)',
          backdropFilter: 'blur(20px) saturate(1.2)',
        }}
      >
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-card)] hover:text-[var(--color-text)]"
        >
          <X size={18} />
        </button>

        <h3 className="mb-5 text-lg font-semibold text-[var(--color-text)]">
          {item ? '编辑学习记录' : '添加学习记录'}
        </h3>

        {/* 学科/项目名称 */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-[var(--color-text-soft)]">项目 / 学科</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="如：React 组件设计"
            autoFocus
            className="w-full rounded-md px-3 py-2 text-sm outline-none transition-all focus:shadow-2"
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-line)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        {/* 时长 */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-[var(--color-text-soft)]">时长</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="24"
              value={hours || ''}
              onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
              className="w-20 rounded-md px-3 py-2 text-center font-mono text-sm outline-none transition-all focus:shadow-2"
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-line)',
                color: 'var(--color-text)',
              }}
            />
            <span className="text-sm text-[var(--color-text-soft)]">小时</span>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes || ''}
              onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
              placeholder="0"
              className="w-20 rounded-md px-3 py-2 text-center font-mono text-sm outline-none transition-all focus:shadow-2"
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-line)',
                color: 'var(--color-text)',
              }}
            />
            <span className="text-sm text-[var(--color-text-soft)]">分钟</span>
          </div>
        </div>

        {/* 备注 */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm text-[var(--color-text-soft)]">备注</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="简短写点什么…"
            className="w-full rounded-md px-3 py-2 text-sm outline-none transition-all focus:shadow-2"
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-line)',
              color: 'var(--color-text)',
            }}
          />
        </div>

        {/* 颜色选择 */}
        <div className="mb-6">
          <label className="mb-1.5 block text-sm text-[var(--color-text-soft)]">标记颜色</label>
          <div className="flex gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full transition-all"
                style={{
                  background: c,
                  boxShadow: color === c
                    ? `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 0 2px var(--color-card), 0 0 0 4px ${c}`
                    : 'inset 0 1px 0 rgba(255,255,255,0.4)',
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
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
            className="rounded-full px-4 py-2 text-sm font-medium text-[var(--color-text-soft)] transition-all hover:text-[var(--color-text)]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!subject.trim()}
            className="rounded-full px-5 py-2 text-sm font-medium text-white transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(160deg, #FFD66B, #FFA51F)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 8px rgba(255,185,56,0.3)',
            }}
          >
            {item ? '保存' : '添加'}
          </button>
        </div>
      </form>
    </div>
  );
}
