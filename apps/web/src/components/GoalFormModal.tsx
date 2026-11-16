import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { SUBJECT_COLORS } from '../lib/constants';
import { previewCountSplit } from '../lib/domain';
import { useSubjects } from '../lib/queries';
import { useApp } from '../context/AppContext';
import type { GoalSummary, GoalType } from '../lib/types/api';
import Sheet, { useSheetClose } from './ui/Sheet';
import { Pressable } from './ui/Pressable';

interface GoalFormModalProps {
  period: string;
  /** 传入即编辑模式：预填字段、类型锁定（已有任务/打卡不可换型），颜色仅在改动时提交 */
  initial?: GoalSummary;
  onClose: () => void;
  onSubmit: (payload: {
    id: string;
    period: string;
    title: string;
    type: GoalType;
    targetValue?: number;
    unit?: string;
    subjectId?: string;
    color?: string;
    note?: string;
  }) => Promise<void>;
}

const NO_SUBJECT = '__none__';

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

export default function GoalFormModal({ period, initial, onClose, onSubmit }: GoalFormModalProps) {
  const { settings } = useApp();
  const weekStartsOn = settings?.weekStartsOn ?? 1;
  const { data: subjects } = useSubjects();
  const activeSubjects = useMemo(
    () => (subjects ?? []).filter((s) => s.archivedAt == null),
    [subjects],
  );

  const editing = initial != null;
  const [type, setType] = useState<GoalType>(initial?.type ?? 'COUNT');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [targetValue, setTargetValue] = useState(initial?.targetValue ?? 300);
  const [unit, setUnit] = useState(initial ? (initial.unit ?? '') : '词');
  const [subjectChoice, setSubjectChoice] = useState(initial?.subjectId ?? NO_SUBJECT);
  const [color, setColor] = useState(initial?.color ?? SUBJECT_COLORS[0]);
  const [colorTouched, setColorTouched] = useState(false);
  const [note, setNote] = useState(initial?.note ?? '');
  const [submitting, setSubmitting] = useState(false);

  const subjectId = subjectChoice === NO_SUBJECT ? '' : subjectChoice;

  const preview = useMemo(
    () => (type === 'COUNT' ? previewCountSplit(targetValue, period, weekStartsOn) : null),
    [type, targetValue, period, weekStartsOn],
  );

  const handleSubjectChange = (id: string) => {
    setSubjectChoice(id);
    const subject = activeSubjects.find((s) => s.id === id);
    if (subject) {
      setColor(subject.color);
      setColorTouched(true);
    }
  };

  const pickColor = (c: string) => {
    setColor(c);
    setColorTouched(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (type === 'COUNT' && (!targetValue || targetValue < 1)) return;
    setSubmitting(true);
    try {
      await onSubmit({
        id: initial?.id ?? nanoid(),
        period,
        title: title.trim(),
        type,
        targetValue: type === 'COUNT' ? targetValue : undefined,
        unit: type === 'COUNT' ? unit.trim() || '个' : undefined,
        subjectId: subjectId || undefined,
        color: !editing || colorTouched ? color : undefined,
        note: note.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      title={editing ? '编辑目标' : '立一个月目标'}
      onClose={onClose}
      as="form"
      onSubmit={() => void handleSubmit()}
    >
      <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
        <CloseButton />
        <div className="nb-dialog-h mb-5 pr-8">
          {editing ? '编辑目标' : `立一个 ${period.slice(5)} 月目标`}
        </div>

        <label className="nb-flab">类型</label>
        <div className="mb-5 flex flex-wrap gap-2">
          {(
            [
              ['COUNT', '数量型 · 刷题 / 单词 / 套卷'],
              ['CHECKLIST', '清单型 · 章节 / 知识点'],
            ] as const
          )
            .filter(([value]) => !editing || value === type)
            .map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`nb-chip${type === value ? ' on' : ''}`}
                onClick={() => setType(value)}
              >
                {label}
              </button>
            ))}
        </div>

        <label className="nb-flab">标题</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === 'COUNT' ? '如：张宇 1000 题 · 基础篇' : '如：学完 RAG 知识库搭建'}
          autoFocus
          className="nb-field mb-5"
        />

        {type === 'COUNT' ? (
          <div className="mb-5 grid grid-cols-[1fr_120px] gap-5">
            <div>
              <label className="nb-flab">目标数量</label>
              <input
                type="number"
                min={1}
                value={targetValue}
                onChange={(e) => setTargetValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="nb-field num"
              />
            </div>
            <div>
              <label className="nb-flab">单位</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="题"
                className="nb-field"
              />
            </div>
          </div>
        ) : (
          <p className="nb-flab-hint mb-5">
            建好大目标后，再拆成若干小任务，完成即可勾选。
          </p>
        )}

        {activeSubjects.length > 0 && (
          <>
            <label className="nb-flab">科目（可选）</label>
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={`nb-chip nb-chip-dash${subjectChoice === NO_SUBJECT ? ' on' : ''}`}
                onClick={() => handleSubjectChange(NO_SUBJECT)}
              >
                不关联
              </button>
              {activeSubjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`nb-chip${subjectChoice === s.id ? ' on' : ''}`}
                  onClick={() => handleSubjectChange(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </>
        )}

        {type === 'COUNT' && preview && preview.days > 0 && (
          <div className="nb-split">
            拆分：日均 <b className="nb-hl">{preview.plannedDaily}</b> {unit.trim() || '个'} · 每周{' '}
            {preview.plannedWeekly} {unit.trim() || '个'} · 共 {preview.days} 天
          </div>
        )}

        <label className="nb-flab">说明（可选）</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="这个月想怎么推进"
          className="nb-field mb-5"
        />

        <label className="nb-flab">标记颜色</label>
        <div className="mb-6 flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickColor(c)}
              aria-label={`颜色 ${c}`}
              className="nb-swatch"
              style={{
                background: c,
                borderColor: color === c ? 'var(--brand)' : 'var(--ink)',
              }}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <SheetCancel />
          <button type="submit" disabled={!title.trim() || submitting} className="nb-btn p">
            {submitting ? '保存中…' : editing ? '保存' : '立下'}
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
