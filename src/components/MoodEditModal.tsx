import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { addCustomMood, updateCustomMood, deleteCustomMood } from '../lib/api';
import { useCustomMoodConfigs, isMoodLabelDuplicate, generateMoodPalette } from '../lib/moodUtils';
import { MOOD_CONFIGS, SUBJECT_COLORS } from '../lib/constants';
import { showToast } from '../lib/toast';
import type { CustomMoodConfig } from '../types';

interface MoodEditModalProps {
  onClose: () => void;
  editMood?: CustomMoodConfig | null;
}

const EMOJI_PRESETS = ['😊', '🥰', '😎', '🤩', '🥳', '😌', '🤔', '😤', '😢', '😡', '🥺', '😴', '🤗', '💪', '🎉', '🌈', '⭐', '🔥', '💜', '🍀'];

export default function MoodEditModal({ onClose, editMood }: MoodEditModalProps) {
  const customMoodConfigs = useCustomMoodConfigs();

  const [emoji, setEmoji] = useState(editMood?.emoji ?? '😊');
  const [label, setLabel] = useState(editMood?.label ?? '');
  const [color, setColor] = useState(editMood?.solid ?? SUBJECT_COLORS[0]);
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
      solid: color,
      ...palette,
    };

    try {
      if (isEditing && editMood) {
        await updateCustomMood(editMood.id, config);
      } else {
        await addCustomMood(config);
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      setError(message);
      showToast(message);
    }
  }, [label, emoji, color, palette, isEditing, editMood, customMoodConfigs, builtinLabels, onClose]);

  const handleDelete = useCallback(async () => {
    if (!editMood) return;
    const confirmed = window.confirm(
      `确定要删除"${editMood.label}"心情吗？`
    );
    if (!confirmed) return;
    try {
      await deleteCustomMood(editMood.id);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败');
    }
  }, [editMood, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'color-mix(in srgb, var(--ink) 20%, transparent)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="overlay mx-4 w-full max-w-sm rounded-xl p-6 animate-fade-up"
        style={{ border: '1px solid var(--keyline)', boxShadow: 'var(--shadow-4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-serif text-h2 text-[var(--ink)]">
            {isEditing ? '编辑心情' : '添加心情'}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Emoji picker */}
        <div className="mb-4">
          <label className="mb-2 block font-sans text-small text-[var(--ink-soft)]">图标</label>
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all"
              style={{
                background: color,
                color: 'white',
              }}
            >
              {emoji}
            </button>
            {showEmojiPicker && (
              <div className="absolute left-0 top-14 z-10 rounded-lg border border-[var(--keyline)] bg-[var(--overlay)] p-3" style={{ boxShadow: 'var(--shadow-4)' }}>
                <div className="grid grid-cols-5 gap-1">
                  {EMOJI_PRESETS.map((e) => (
                    <button
                      key={e}
                      onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                      className={`flex h-8 w-8 items-center justify-center rounded-md text-lg transition-all hover:bg-[var(--paper)] ${
                        emoji === e ? 'ring-2 ring-[var(--brand)]' : ''
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

        <p className="mb-4 font-sans text-small text-[var(--ink-faint)]">
          自定义心情会以通用花型渲染，保留你选择的图标与颜色。
        </p>

        {/* Label input */}
        <div className="mb-4">
          <label className="mb-2 block font-sans text-small text-[var(--ink-soft)]">名称</label>
          <input
            type="text"
            value={label}
            onChange={(e) => { setLabel(e.target.value); setError(''); }}
            placeholder="如：兴奋、感恩、期待…"
            maxLength={6}
            className="card w-full rounded-md px-3 py-2.5 font-sans text-body text-[var(--ink)] outline-none"
            style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
            autoFocus
          />
          {error && (
            <p className="mt-1 font-sans text-caption text-red-400">{error}</p>
          )}
        </div>

        {/* Color picker — mineral 8-color */}
        <div className="mb-5">
          <label className="mb-2 block font-sans text-small text-[var(--ink-soft)]">颜色</label>
          <div className="flex gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-8 w-8 rounded-full transition-all duration-200"
                style={{
                  background: c,
                  transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  outline: color === c ? `2px solid var(--ink)` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mb-5 rounded-lg p-3" style={{ background: 'var(--paper)' }}>
          <p className="mb-2 font-sans text-caption text-[var(--ink-faint)]">预览</p>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: color }}
            >
              <span className="text-lg" style={{ color: 'white' }}>{emoji}</span>
            </div>
            <span className="font-sans text-small text-[var(--ink)]">{label || '心情名称'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          {isEditing ? (
            <button
              onClick={handleDelete}
              className="px-3 py-2 font-sans text-small text-red-400 transition-colors hover:text-red-500"
            >
              删除
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-4 py-2 font-sans text-small text-[var(--ink-soft)] transition-all hover:text-[var(--ink)]"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="rounded-md px-4 py-2 font-sans text-small text-white transition-all"
              style={{ background: 'var(--brand)' }}
            >
              {isEditing ? '保存' : '添加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
