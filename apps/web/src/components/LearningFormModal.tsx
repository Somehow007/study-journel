import { useState } from 'react';
import { X } from 'lucide-react';
import { SUBJECT_COLORS } from '../lib/constants';
import type { Entry, Subject } from '../lib/types/api';
import Sheet, { useSheetClose } from './ui/Sheet';
import { Pressable } from './ui/Pressable';

/** 表单产出：已有科目 → subjectId；新建科目 → newSubjectName/newSubjectColor（由页面先建科目再建条目） */
export interface EntryDraft {
  subjectId: string;
  newSubjectName?: string;
  newSubjectColor?: string;
  title: string;
  note: string;
  durationMin: number;
}

const NEW_SUBJECT = '__new__';

interface LearningFormModalProps {
  /** 编辑模式：传入 Entry；新增模式：null */
  item: Entry | null;
  /** 未归档科目列表 */
  subjects: Subject[];
  onConfirm: (draft: EntryDraft) => void | Promise<void>;
  onClose: () => void;
}

function CloseButton() {
  const close = useSheetClose();
  return (
    <Pressable
      variant="icon"
      onClick={close}
      className="absolute right-3 top-3 flex items-center justify-center rounded-full text-[var(--ink-faint)]"
      aria-label="关闭"
    >
      <X size={18} />
    </Pressable>
  );
}

export default function LearningFormModal({ item, subjects, onConfirm, onClose }: LearningFormModalProps) {
  const [subjectChoice, setSubjectChoice] = useState(item?.subjectId ?? '');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0]);
  const [title, setTitle] = useState(item?.title ?? '');
  const [hours, setHours] = useState(item ? Math.floor(item.durationMin / 60) : 0);
  const [minutes, setMinutes] = useState(item ? item.durationMin % 60 : 30);
  const [note, setNote] = useState(item?.note ?? '');
  const [durationError, setDurationError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isNewSubject = subjectChoice === NEW_SUBJECT;
  const durationMin = hours * 60 + minutes;
  const modalTitle = item ? '编辑学习记录' : '添加学习记录';
  const subjectReady = isNewSubject ? newSubjectName.trim().length > 0 : subjectChoice.length > 0;

  const handleSubmit = async () => {
    if (!subjectReady) return;
    if (durationMin < 1) {
      setDurationError('时长至少 1 分钟');
      return;
    }
    setDurationError('');
    setSubmitting(true);
    try {
      await onConfirm({
        subjectId: isNewSubject ? '' : subjectChoice,
        newSubjectName: isNewSubject ? newSubjectName.trim() : undefined,
        newSubjectColor: isNewSubject ? newSubjectColor : undefined,
        title: title.trim(),
        note: note.trim(),
        durationMin,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'card w-full rounded-md px-3 py-2 font-sans text-body text-[var(--ink)] outline-none transition-all focus:border-[var(--brand)]';
  const inputStyle = { border: '1px solid var(--keyline)', boxShadow: 'none' } as const;

  return (
    <Sheet title={modalTitle} onClose={onClose} as="form" onSubmit={() => void handleSubmit()}>
      <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
        <CloseButton />
        <h3 className="mb-5 font-sans text-title text-[var(--ink)]">{modalTitle}</h3>

        <div className="mb-4">
          <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">科目</label>
          <select
            value={subjectChoice}
            onChange={(e) => setSubjectChoice(e.target.value)}
            className={inputCls}
            style={inputStyle}
          >
            {!item && <option value="" disabled>选择科目…</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW_SUBJECT}>＋ 新建科目</option>
          </select>
        </div>

        {isNewSubject && (
          <>
            <div className="mb-4">
              <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">新科目名称</label>
              <input
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="如：考研政治"
                autoFocus
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">科目颜色</label>
              <div className="flex gap-2">
                {SUBJECT_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    variant="icon"
                    onClick={() => setNewSubjectColor(c)}
                    aria-label={`颜色 ${c}`}
                    className="h-8 w-8 rounded-full"
                    style={{
                      background: c,
                      outline: newSubjectColor === c ? `2px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mb-4">
          <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">标题（可选）</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="留空则用科目名"
            className={inputCls}
            style={inputStyle}
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
              style={inputStyle}
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
              style={inputStyle}
            />
            <span className="font-sans text-small text-[var(--ink-soft)]">分钟</span>
          </div>
          {durationError && (
            <p className="mt-1.5 font-sans text-caption text-[var(--danger)]">{durationError}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block font-sans text-small text-[var(--ink-soft)]">备注</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="简短写点什么…"
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div className="flex justify-end gap-2">
          <SheetCancel />
          <Pressable
            type="submit"
            disabled={!subjectReady || durationMin < 1 || submitting}
            className="rounded-md px-5 font-sans text-small text-[var(--text-inverse)]"
            style={{ background: 'var(--brand)' }}
          >
            {submitting ? '保存中…' : item ? '保存' : '添加'}
          </Pressable>
        </div>
      </div>
    </Sheet>
  );
}

function SheetCancel() {
  const close = useSheetClose();
  return (
    <Pressable
      variant="pill"
      onClick={close}
      className="rounded-full border border-[var(--keyline)] px-4 py-2 font-sans text-small text-[var(--ink-soft)]"
    >
      取消
    </Pressable>
  );
}
