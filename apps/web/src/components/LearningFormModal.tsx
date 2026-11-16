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
const DURATION_PRESETS = [
  { label: '25m', hours: 0, minutes: 25 },
  { label: '45m', hours: 0, minutes: 45 },
  { label: '1h', hours: 1, minutes: 0 },
];

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
      className="absolute right-3 top-3 flex items-center justify-center text-[var(--ink-faint)]"
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
  const modalTitle = item ? '编辑学习记录' : '补一条学习';
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

  const applyPreset = (h: number, m: number) => {
    setHours(h);
    setMinutes(m);
    setDurationError('');
  };

  return (
    <Sheet title={modalTitle} onClose={onClose} as="form" onSubmit={() => void handleSubmit()}>
      <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
        <CloseButton />
        <div className="nb-dialog-h mb-5 pr-8">{modalTitle}</div>

        <label className="nb-flab">科目</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`nb-chip${subjectChoice === s.id ? ' on' : ''}`}
              onClick={() => setSubjectChoice(s.id)}
            >
              {s.name}
            </button>
          ))}
          <button
            type="button"
            className={`nb-chip nb-chip-dash${isNewSubject ? ' on' : ''}`}
            onClick={() => setSubjectChoice(NEW_SUBJECT)}
          >
            其他…
          </button>
        </div>

        {isNewSubject && (
          <>
            <label className="nb-flab">新科目名称</label>
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="如：考研政治"
              autoFocus
              className="nb-field mb-4"
            />
            <label className="nb-flab">科目颜色</label>
            <div className="mb-5 flex flex-wrap gap-2">
              {SUBJECT_COLORS.map((c) => (
                <Pressable
                  key={c}
                  variant="icon"
                  onClick={() => setNewSubjectColor(c)}
                  aria-label={`颜色 ${c}`}
                  className="nb-swatch"
                  style={{
                    background: c,
                    borderColor: newSubjectColor === c ? 'var(--brand)' : 'var(--ink)',
                  }}
                />
              ))}
            </div>
          </>
        )}

        <label className="nb-flab">内容（可选）</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="留空则用科目名"
          className="nb-field mb-5"
        />

        <label className="nb-flab">时长</label>
        <div className="mb-2 flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="24"
            value={hours}
            onChange={(e) => {
              setHours(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)));
              setDurationError('');
            }}
            className="nb-field num nb-dur"
            aria-label="小时"
          />
          <span className="nb-dur-unit">h</span>
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(e) => {
              setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)));
              setDurationError('');
            }}
            className="nb-field num nb-dur"
            aria-label="分钟"
          />
          <span className="nb-dur-unit">m</span>
          <span className="ml-3 flex gap-2">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="nb-chip"
                onClick={() => applyPreset(p.hours, p.minutes)}
              >
                {p.label}
              </button>
            ))}
          </span>
        </div>
        {durationError && (
          <p className="mb-3 text-[12px]" style={{ color: 'var(--danger)' }}>
            {durationError}
          </p>
        )}

        <label className="nb-flab">备注</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="错题、卡点、明天要补的…"
          rows={3}
          className="nb-note nb-note-input w-full resize-none bg-transparent outline-none placeholder:text-[var(--ink-faint)]"
        />

        <div className="mt-6 flex justify-end gap-2">
          <SheetCancel />
          <button
            type="submit"
            disabled={!subjectReady || durationMin < 1 || submitting}
            className="nb-btn p"
          >
            {submitting ? '保存中…' : item ? '保存' : '记下'}
          </button>
        </div>
      </div>
    </Sheet>
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
