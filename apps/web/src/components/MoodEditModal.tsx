import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { addCustomMood, updateCustomMood, deleteCustomMood } from '../lib/api';
import { useCustomMoodConfigs, isMoodLabelDuplicate, generateMoodPalette } from '../lib/moodUtils';
import { MOOD_CONFIGS, SUBJECT_COLORS } from '../lib/constants';
import { showToast } from '../lib/toast';
import { askConfirm } from '../lib/confirm';
import type { CustomMoodConfig } from '../types';
import Sheet, { useSheetClose } from './ui/Sheet';
import { Pressable } from './ui/Pressable';

interface MoodEditModalProps {
  onClose: () => void;
  editMood?: CustomMoodConfig | null;
}

const EMOJI_PRESETS = ['😊', '🥰', '😎', '🤩', '🥳', '😌', '🤔', '😤', '😢', '😡', '🥺', '😴', '🤗', '💪', '🎉', '🌈', '⭐', '🔥', '💜', '🍀'];

function CloseButton() {
  const close = useSheetClose();
  return (
    <Pressable
      variant="icon"
      onClick={close}
      className="flex items-center justify-center rounded-full text-[var(--ink-faint)]"
      aria-label="关闭"
    >
      <X size={18} />
    </Pressable>
  );
}

export default function MoodEditModal({ onClose, editMood }: MoodEditModalProps) {
  const customMoodConfigs = useCustomMoodConfigs();

  const [emoji, setEmoji] = useState(editMood?.emoji ?? '😊');
  const [label, setLabel] = useState(editMood?.label ?? '');
  const [color, setColor] = useState(editMood?.solid ?? SUBJECT_COLORS[0]);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const palette = generateMoodPalette(color);
  const builtinLabels = Object.values(MOOD_CONFIGS).map((m) => m.label);
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

    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  }, [label, emoji, color, palette, isEditing, editMood, customMoodConfigs, builtinLabels, onClose]);

  const handleDelete = useCallback(async () => {
    if (!editMood) return;
    const confirmed = await askConfirm({
      title: '删除心情',
      message: `确定要删除「${editMood.label}」心情吗？`,
      confirmLabel: '删除',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteCustomMood(editMood.id);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败');
    }
  }, [editMood, onClose]);

  return (
    <Sheet title={isEditing ? '编辑心情' : '添加心情'} onClose={onClose}>
      <MoodEditBody
        emoji={emoji}
        setEmoji={setEmoji}
        label={label}
        setLabel={setLabel}
        color={color}
        setColor={setColor}
        error={error}
        setError={setError}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        submitting={submitting}
        isEditing={isEditing}
        onSave={() => void handleSave()}
        onDelete={() => void handleDelete()}
      />
    </Sheet>
  );
}

function MoodEditBody({
  emoji,
  setEmoji,
  label,
  setLabel,
  color,
  setColor,
  error,
  setError,
  showEmojiPicker,
  setShowEmojiPicker,
  submitting,
  isEditing,
  onSave,
  onDelete,
}: {
  emoji: string;
  setEmoji: (v: string) => void;
  label: string;
  setLabel: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  error: string;
  setError: (v: string) => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (v: boolean) => void;
  submitting: boolean;
  isEditing: boolean;
  onSave: () => void;
  onDelete: () => void;
}) {
  const close = useSheetClose();
  return (
    <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-sans text-h2 text-[var(--ink)]">{isEditing ? '编辑心情' : '添加心情'}</h3>
        <CloseButton />
      </div>

      <div className="mb-4">
        <label className="mb-2 block font-sans text-small text-[var(--ink-soft)]">图标</label>
        <div className="relative">
          <Pressable
            variant="icon"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
            style={{ background: color, color: 'white' }}
          >
            {emoji}
          </Pressable>
          {showEmojiPicker && (
            <div
              className="absolute left-0 top-14 z-10 rounded-lg border border-[var(--keyline)] bg-[var(--overlay)] p-3"
              style={{ boxShadow: 'var(--shadow-4)' }}
            >
              <div className="grid grid-cols-5 gap-1">
                {EMOJI_PRESETS.map((e) => (
                  <Pressable
                    key={e}
                    variant="icon"
                    onClick={() => {
                      setEmoji(e);
                      setShowEmojiPicker(false);
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-lg ${
                      emoji === e ? 'ring-2 ring-[var(--brand)]' : ''
                    }`}
                  >
                    {e}
                  </Pressable>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mb-4 font-sans text-small text-[var(--ink-faint)]">
        自定义心情会以通用花型渲染，保留你选择的图标与颜色。
      </p>

      <div className="mb-4">
        <label className="mb-2 block font-sans text-small text-[var(--ink-soft)]">名称</label>
        <input
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setError('');
          }}
          placeholder="如：兴奋、感恩、期待…"
          maxLength={6}
          className="card w-full rounded-md px-3 py-2.5 font-sans text-body text-[var(--ink)] outline-none"
          style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
          autoFocus
        />
        {error && <p className="mt-1 font-sans text-caption text-[var(--danger)]">{error}</p>}
      </div>

      <div className="mb-5">
        <label className="mb-2 block font-sans text-small text-[var(--ink-soft)]">颜色</label>
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
                outline: color === c ? '2px solid var(--ink)' : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      </div>

      <div className="mb-5 rounded-lg p-3" style={{ background: 'var(--paper)' }}>
        <p className="mb-2 font-sans text-caption text-[var(--ink-faint)]">预览</p>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: color }}>
            <span className="text-lg" style={{ color: 'white' }}>
              {emoji}
            </span>
          </div>
          <span className="font-sans text-small text-[var(--ink)]">{label || '心情名称'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {isEditing ? (
          <Pressable
            variant="pill"
            onClick={onDelete}
            className="px-3 py-2 font-sans text-small text-[var(--danger)]"
          >
            删除
          </Pressable>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Pressable
            variant="pill"
            onClick={close}
            className="rounded-full px-4 py-2 font-sans text-small text-[var(--ink-soft)]"
          >
            取消
          </Pressable>
          <Pressable
            onClick={onSave}
            disabled={submitting}
            className="rounded-md px-4 font-sans text-small text-[var(--text-inverse)]"
            style={{ background: 'var(--brand)' }}
          >
            {submitting ? '保存中…' : isEditing ? '保存' : '添加'}
          </Pressable>
        </div>
      </div>
    </div>
  );
}
