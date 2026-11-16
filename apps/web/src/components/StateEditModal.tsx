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
      className="absolute right-3 top-3 flex items-center justify-center text-[var(--ink-faint)]"
      aria-label="关闭"
    >
      <X size={18} />
    </Pressable>
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

export default function StateEditModal({ onClose, editState }: StateEditModalProps) {
  const qc = useQueryClient();
  const { data: states } = useStates();

  const [label, setLabel] = useState(editState?.label ?? '');
  const [color, setColor] = useState(editState?.color ?? SUBJECT_COLORS[0]);
  const [polarity, setPolarity] = useState<StatePolarity>(editState?.polarity ?? 0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!editState;
  const modalTitle = isEditing ? '编辑状态' : '添加状态';

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
    <Sheet title={modalTitle} onClose={onClose}>
      <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
        <CloseButton />
        <div className="nb-dialog-h mb-5 pr-8">{modalTitle}</div>

        <label className="nb-flab">名称</label>
        <input
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setError('');
          }}
          placeholder="如：专注、疲惫、感恩…"
          maxLength={12}
          className="nb-field mb-1"
          autoFocus
        />
        {error && <p className="mb-4 text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}

        <label className="nb-flab">极性</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {POLARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`nb-chip${polarity === opt.value ? ' on' : ''}`}
              onClick={() => setPolarity(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="nb-flab">颜色</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <Pressable
              key={c}
              variant="icon"
              onClick={() => setColor(c)}
              aria-label={`颜色 ${c}`}
              className="nb-swatch"
              style={{
                background: c,
                borderColor: color === c ? 'var(--brand)' : 'var(--ink)',
              }}
            />
          ))}
        </div>

        <label className="nb-flab">预览</label>
        <div className="nb-split mb-5">
          <span className="nb-swatch" style={{ background: color, flex: 'none' }} />
          <span>{label || '状态名称'}</span>
        </div>

        <div className={`mt-6 flex gap-2 ${isEditing ? 'items-center justify-between' : 'justify-end'}`}>
          {isEditing && (
            <button type="button" className="nb-btn r" onClick={() => void handleDelete()}>
              删除
            </button>
          )}
          <span className="flex gap-2">
            <SheetCancel />
            <button type="button" className="nb-btn p" onClick={() => void handleSave()} disabled={submitting}>
              {submitting ? '保存中…' : isEditing ? '保存' : '添加'}
            </button>
          </span>
        </div>
      </div>
    </Sheet>
  );
}
