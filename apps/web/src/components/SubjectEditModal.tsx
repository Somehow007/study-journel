import { useState } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { createSubject, updateSubject, archiveSubject } from '../lib/api';
import { useSubjects, invalidateAll } from '../lib/queries';
import { SUBJECT_COLORS } from '../lib/constants';
import { showToast } from '../lib/toast';
import { askConfirm } from '../lib/confirm';
import type { Subject } from '../lib/types/api';
import Sheet, { useSheetClose } from './ui/Sheet';
import { Pressable } from './ui/Pressable';

interface SubjectEditModalProps {
  onClose: () => void;
  editSubject?: Subject | null;
}

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

export default function SubjectEditModal({ onClose, editSubject }: SubjectEditModalProps) {
  const qc = useQueryClient();
  const { data: subjects } = useSubjects();

  const [name, setName] = useState(editSubject?.name ?? '');
  const [color, setColor] = useState(editSubject?.color ?? SUBJECT_COLORS[0]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!editSubject;
  const modalTitle = isEditing ? '编辑科目' : '添加科目';

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('请输入科目名称');
      return;
    }
    const others = (subjects ?? []).filter((s) => s.id !== editSubject?.id);
    if (others.some((s) => s.archivedAt == null && s.name === trimmed)) {
      setError('该科目名称已存在');
      return;
    }
    if (others.some((s) => s.archivedAt != null && s.name === trimmed)) {
      setError('存在已归档的同名科目，请先在设置页恢复');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && editSubject) {
        await updateSubject(editSubject.id, { name: trimmed, color });
      } else {
        await createSubject({ name: trimmed, color });
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
    if (!editSubject) return;
    const confirmed = await askConfirm({
      title: '删除科目',
      message: `确定要删除「${editSubject.name}」吗？历史学习记录仍会保留该科目。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await archiveSubject(editSubject.id);
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
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="如：数学一、英语二、自定义…"
          maxLength={50}
          className="nb-field mb-1"
          autoFocus
        />
        {error && <p className="mb-4 text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}

        <label className="nb-flab">颜色</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
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
          <span>{name.trim() || '科目名称'}</span>
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
