import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { addCustomMood, updateCustomMood, deleteCustomMood } from '../lib/db';
import { useCustomMoodConfigs, isMoodLabelDuplicate, generateMoodPalette } from '../lib/moodUtils';
import { MOOD_CONFIGS, SUBJECT_COLORS } from '../lib/constants';
import { useApp } from '../context/AppContext';
import type { CustomMoodConfig } from '../types';

interface MoodEditModalProps {
  onClose: () => void;
  editMood?: CustomMoodConfig | null;
}

const EMOJI_PRESETS = ['😊', '🥰', '😎', '🤩', '🥳', '😌', '🤔', '😤', '😢', '😡', '🥺', '😴', '🤗', '💪', '🎉', '🌈', '⭐', '🔥', '💜', '🍀'];

export default function MoodEditModal({ onClose, editMood }: MoodEditModalProps) {
  const { theme } = useApp();
  const customMoodConfigs = useCustomMoodConfigs();

  const [emoji, setEmoji] = useState(editMood?.emoji ?? '😊');
  const [label, setLabel] = useState(editMood?.label ?? '');
  const [color, setColor] = useState(editMood?.main ?? SUBJECT_COLORS[0]);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const palette = generateMoodPalette(color);
  const builtinLabels = Object.values(MOOD_CONFIGS).map(m => m.label);

  const isEditing = !!editMood;

  const handleSave = useCallback(async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError('请输入心情名称');
      return;
    }

    if (isMoodLabelDuplicate(trimmed, builtinLabels, customMoodConfigs, editMood?.id)) {
      setError('该心情名称已存在');
      return;
    }

    const config: Omit<CustomMoodConfig, 'createdAt'> = {
      id: editMood?.id ?? `mood_${nanoid(8)}`,
      label: trimmed,
      emoji,
      main: color,
      ...palette,
    };

    if (isEditing && editMood) {
      await updateCustomMood(editMood.id, config);
    } else {
      await addCustomMood(config);
    }

    onClose();
  }, [label, emoji, color, palette, isEditing, editMood, customMoodConfigs, builtinLabels, onClose]);

  const handleDelete = useCallback(async () => {
    if (!editMood) return;
    const confirmed = window.confirm(
      `确定要删除"${editMood.label}"心情吗？`
    );
    if (!confirmed) return;
    await deleteCustomMood(editMood.id);
    onClose();
  }, [editMood, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="glass mx-4 w-full max-w-sm rounded-2xl p-6 shadow-4 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-hand text-xl font-semibold text-[var(--color-text)]">
            {isEditing ? '编辑心情' : '添加心情'}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-card)] hover:text-[var(--color-text)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Emoji picker */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-[var(--color-text-soft)]">图标</label>
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all hover:shadow-2"
              style={{
                background: palette.gradient,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 12px ${palette.glow}`,
              }}
            >
              {emoji}
            </button>
            {showEmojiPicker && (
              <div className="absolute left-0 top-14 z-10 rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-3 shadow-4">
                <div className="grid grid-cols-5 gap-1">
                  {EMOJI_PRESETS.map((e) => (
                    <button
                      key={e}
                      onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all hover:bg-[var(--color-card)] hover:shadow-2 ${
                        emoji === e ? 'ring-2 ring-brand' : ''
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Label input */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-[var(--color-text-soft)]">名称</label>
          <input
            type="text"
            value={label}
            onChange={(e) => { setLabel(e.target.value); setError(''); }}
            placeholder="如：兴奋、感恩、期待…"
            maxLength={6}
            className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition-all focus:border-brand focus:shadow-2"
            autoFocus
          />
          {error && (
            <p className="mt-1 text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Color picker */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-[var(--color-text-soft)]">颜色</label>
          <div className="flex gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-8 w-8 rounded-full transition-all duration-200"
                style={{
                  background: c,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                  transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  outline: color === c ? `2px solid ${theme === 'dark' ? '#F5EDDA' : '#2D2620'}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mb-5 rounded-xl p-3" style={{ background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)' }}>
          <p className="mb-2 text-xs text-[var(--color-text-faint)]">预览</p>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                background: palette.gradient,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 12px ${palette.glow}`,
              }}
            >
              <span className="text-lg" style={{ filter: 'brightness(0) invert(1)' }}>{emoji}</span>
            </div>
            <span className="text-sm font-medium text-[var(--color-text)]">{label || '心情名称'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          {isEditing ? (
            <button
              onClick={handleDelete}
              className="px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:text-red-500"
            >
              删除
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-soft)] transition-all hover:bg-[var(--color-card)]"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:shadow-2"
              style={{
                background: palette.gradient,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              {isEditing ? '保存' : '添加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
