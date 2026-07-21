import { useRef, useState, useCallback } from 'react';
import { formatDuration } from '../lib/dateUtils';
import type { LearningItem } from '../types';
import { Pencil, Trash2 } from 'lucide-react';

interface LearningRecordCardProps {
  item: LearningItem;
  onEdit: () => void;
  onDelete: () => void;
}

/** Minimum horizontal swipe distance (px) to trigger delete */
const SWIPE_THRESHOLD = 80;

export default function LearningRecordCard({ item, onEdit, onDelete }: LearningRecordCardProps) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeConfirmed, setSwipeConfirmed] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipeConfirmed(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Only track horizontal swipe (ignore vertical scroll)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      // Clamp: only allow left swipe, max 120px
      const offset = Math.max(-120, Math.min(0, dx));
      setSwipeOffset(offset);
      if (offset < -SWIPE_THRESHOLD) {
        setSwipeConfirmed(true);
      } else {
        setSwipeConfirmed(false);
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeConfirmed) {
      onDelete();
    }
    setSwipeOffset(0);
    setSwipeConfirmed(false);
  }, [swipeConfirmed, onDelete]);

  return (
    <div className="relative overflow-hidden"
      style={{ borderBottom: '1px solid var(--hairline)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe background — red delete hint */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end px-4 transition-opacity duration-150"
        style={{
          background: 'rgba(239, 68, 68, 0.15)',
          opacity: swipeConfirmed ? 1 : 0,
        }}
      >
        <span className="font-sans text-small text-red-400">松手删除</span>
      </div>

      <div
        className="group flex items-center gap-3 px-2 py-2.5 transition-transform duration-150"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 200ms ease-out' : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--paper)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {/* 学科色圆点 */}
        <span
          className="h-[10px] w-[10px] shrink-0 rounded-full"
          style={{ background: item.color }}
        />

        {/* 学科名 + 备注 */}
        <div className="flex-1 min-w-0">
          <span className="font-sans text-title text-[var(--ink)]">{item.subject}</span>
          {item.note && (
            <span className="ml-2 font-sans text-small text-[var(--ink-soft)]">{item.note}</span>
          )}
        </div>

        {/* 时长 */}
        <span className="font-mono text-num text-[var(--ink-soft)] shrink-0">
          {formatDuration(item.durationMin)}
        </span>

        {/* 操作按钮 — hover 时显示；触屏设备始终可见 */}
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 touch-visible">
          <button
            onClick={onEdit}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--card)] hover:text-[var(--ink)]"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-red-500/10 hover:text-red-400"
            aria-label="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
