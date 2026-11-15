import { useState } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { createState, updateState, archiveState } from '../lib/api';
import { useStates, invalidateAll } from '../lib/queries';
import { isStateLabelDuplicate } from '../lib/stateUtils';
import { SUBJECT_COLORS } from '../lib/constants';
import { showToast } from '../lib/toast';
import { askConfirm } from '../lib/confirm';
import type { JournalState, StatePolarity } from '../lib/types/api';
import Sheet, { useSheetClose } from './ui/Sheet';
import { Pressable } from './ui/Pressable';

interface StateEditModalProps {
  onClose: () => void;
  editState?: JournalState | null;
}

const POLARITY_OPTIONS: { value: StatePolarity; label: string }[] = [
  { value: 1, label: '积极' },
  { value: 0, label: '中性' },
  { value: -1, label: '消极' },
];

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

export default function StateEditModal({ onClose, editState }: StateEditModalProps) {
  const qc = useQueryClient();
  const { data: states } = useStates();

  const [label, setLabel] = useState(editState?.label ?? '');
  const [color, setColor] = useState(editState?.color ?? SUBJECT_COLORS[0]);
  const [polarity, setPolarity] = useState<StatePolarity>(editState?.polarity ?? 0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!editState;

  const handleSave = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError('请输入状态名称');
      return;
    }
    if (isStateLabelDuplicate(trimmed, states, editState?.id)) {
      setError('该状态名称已存在');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && editState) {
        await updateState(editState.id, { label: trimmed, color, polarity });
      } else {
        await createState({ label: trimmed, color, polarity });
      }
      invalidateAll(qc);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      setError(message);
      showToast(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editState) return;
    const confirmed = await askConfirm({
      title: '删除状态',
      message: `确定要删除「${editState.label}」吗？历史记录仍会保留该状态标记。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await archiveState(editState.id);
      invalidateAll(qc);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <Sheet title={isEditing ? '编辑状态' : '添加状态'} onClose={onClose}>
      <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-sans text-h2 text-[var(--ink)]">{isEditing ? '编辑状态' : '添加状态'}</h3>
          <CloseButton />
        </div>

        <div className="mb-4">
          <label className="mb-2 block font-sans text-small text-[var(--ink-soft)]">名称</label>
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setError('');
            }}
            placeholder="如：专注、疲惫、感恩…"
            maxLength={12}
            className="card w-full rounded-md px-3 py-2.5 font-sans text-body text-[var(--ink)] outline-none"
            style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
            autoFocus
          />
          {error && <p className="mt-1 font-sans text-caption text-[var(--danger)]">{error}</p>}
        </div>

        <div className="mb-4">
          <label className="mb-2 block font-sans text-small text-[var(--ink-soft)]">极性</label>
          <div className="flex gap-2">
            {POLARITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                variant="pill"
                onClick={() => setPolarity(opt.value)}
                className="flex-1 rounded-full border px-3 py-2 font-sans text-small"
                style={
                  polarity === opt.value
                    ? { background: 'var(--brand-soft)', borderColor: 'var(--brand)', color: 'var(--brand)', fontWeight: 500 }
                    : { borderColor: 'var(--keyline)', color: 'var(--ink-soft)' }
                }
              >
                {opt.label}
              </Pressable>
            ))}
          </div>
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
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: color }} />
            <span className="font-sans text-small text-[var(--ink)]">{label || '状态名称'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {isEditing ? (
            <Pressable
              variant="pill"
              onClick={() => void handleDelete()}
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
              onClick={onClose}
              className="rounded-full px-4 py-2 font-sans text-small text-[var(--ink-soft)]"
            >
              取消
            </Pressable>
            <Pressable
              onClick={() => void handleSave()}
              disabled={submitting}
              className="rounded-md px-4 font-sans text-small text-[var(--text-inverse)]"
              style={{ background: 'var(--brand)' }}
            >
              {submitting ? '保存中…' : isEditing ? '保存' : '添加'}
            </Pressable>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
