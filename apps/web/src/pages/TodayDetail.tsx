import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  createEntry,
  createSubject,
  deleteEntry,
  patchDay,
  updateEntry,
} from '../lib/api';
import { useDay, useStreak, useSubjects, qk, invalidateAll } from '../lib/queries';
import { useStateConfig, useStateConfigs } from '../lib/stateUtils';
import { showToast } from '../lib/toast';
import MoodSelector from '../components/MoodSelector';
import LearningRecordCard, { formatDurationHM } from '../components/LearningRecordCard';
import LearningFormModal, { type EntryDraft } from '../components/LearningFormModal';
import DiaryEditor from '../components/DiaryEditor';
import SproutBadge from '../components/SproutBadge';
import TodayGoalsSection from '../components/TodayGoalsSection';
import { QueryError, QueryLoading } from '../components/QueryState';
import { Pressable } from '../components/ui/Pressable';
import type { DayDetail, Entry } from '../lib/types/api';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const QUOTES = [
  '记下今天，明天才有据可查。',
  '进度不靠感觉，靠一条条记录。',
  '短短几分钟，也值得写下来。',
  '连续比完美更重要。',
  '把心情和学习放在同一页。',
  '不必每天都盛满，写下来就好。',
  '台账属于愿意打开它的人。',
  '今天的一行字，是明天的线索。',
];

function dailyQuote(dateStr: string): string {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0;
  return QUOTES[hash % QUOTES.length];
}

export default function TodayDetail() {
  const { date } = useParams<{ date: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Entry | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  const { data: day, isPending, error, refetch } = useDay(date ?? '', !!date);
  const { data: streakResult } = useStreak();
  const { data: subjects } = useSubjects();
  const activeSubjects = useMemo(
    () => (subjects ?? []).filter((s) => s.archivedAt == null),
    [subjects],
  );

  const stateId = day?.stateId ?? null;
  const entries = day?.entries ?? [];
  const diary = day?.diary ?? '';
  const totalMin = day?.totalMin ?? 0;

  const stateConfig = useStateConfig(stateId);
  const allStates = useStateConfigs();

  const dateObj = useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [date]);

  const formattedDate = dateObj
    ? `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`
    : date || '';
  const weekday = dateObj ? `星期${WEEKDAYS[dateObj.getDay()]}` : '';
  const quote = date ? dailyQuote(date) : '';
  const streak = streakResult?.streak ?? 0;

  /** day 相关局部失效：明细 + 月历 marks + 统计 + 搜索（不动 goals/today-goals） */
  const refreshDayRelated = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['day'] });
    void qc.invalidateQueries({ queryKey: ['days'] });
    void qc.invalidateQueries({ queryKey: ['stats'] });
    void qc.invalidateQueries({ queryKey: ['search'] });
  }, [qc]);

  const saveDayPatch = useCallback(
    async (patch: { stateId?: string | null; diary?: string }) => {
      if (!date) return;
      const key = qk.day(date);
      const prev = qc.getQueryData<DayDetail>(key);
      qc.setQueryData<DayDetail>(key, (cur) => (cur ? { ...cur, ...patch } : cur));
      try {
        await patchDay(date, patch);
        setWriteError(null);
        refreshDayRelated();
      } catch (err) {
        qc.setQueryData(key, prev);
        const message = err instanceof Error ? err.message : '保存失败';
        setWriteError(message);
        showToast(message, 'error', { onRetry: () => void saveDayPatch(patch) });
        throw err;
      }
    },
    [date, qc, refreshDayRelated],
  );

  const handleStateSelect = useCallback(
    async (id: string | null) => {
      try {
        await saveDayPatch({ stateId: id });
      } catch {
        /* toast already shown */
      }
    },
    [saveDayPatch],
  );

  const resolveSubjectId = useCallback(
    async (draft: EntryDraft): Promise<string> => {
      if (draft.subjectId) return draft.subjectId;
      const created = await createSubject({
        name: draft.newSubjectName ?? '',
        color: draft.newSubjectColor,
      });
      return created.id;
    },
    [],
  );

  const handleAddEntry = useCallback(
    async (draft: EntryDraft) => {
      if (!date) return;
      const subjectId = await resolveSubjectId(draft);
      await createEntry({
        date,
        subjectId,
        title: draft.title || undefined,
        note: draft.note,
        durationMin: draft.durationMin,
      });
      invalidateAll(qc);
      setShowForm(false);
      setEditingItem(null);
    },
    [date, qc, resolveSubjectId],
  );

  const handleUpdateEntry = useCallback(
    async (draft: EntryDraft) => {
      if (!editingItem) return;
      const subjectId = await resolveSubjectId(draft);
      await updateEntry(editingItem.id, {
        subjectId,
        title: draft.title,
        note: draft.note,
        durationMin: draft.durationMin,
      });
      invalidateAll(qc);
      setEditingItem(null);
      setShowForm(false);
    },
    [editingItem, qc, resolveSubjectId],
  );

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      try {
        // 乐观移除；失败时失效该日查询回滚
        if (date) {
          qc.setQueryData<DayDetail>(qk.day(date), (cur) =>
            cur ? { ...cur, entries: cur.entries.filter((e) => e.id !== id) } : cur,
          );
        }
        await deleteEntry(id);
        invalidateAll(qc);
      } catch (err) {
        if (date) qc.invalidateQueries({ queryKey: qk.day(date) });
        const message = err instanceof Error ? err.message : '删除失败';
        showToast(message, 'error');
      }
    },
    [date, qc],
  );

  const handleDiarySave = useCallback(
    (text: string) => saveDayPatch({ diary: text }),
    [saveDayPatch],
  );

  const openAdd = useCallback(() => {
    setEditingItem(null);
    setShowForm(true);
  }, []);

  if (!date) return null;
  if (isPending && !day) return <QueryLoading />;
  if (error && !day) {
    return <QueryError message={error.message} onRetry={() => void refetch()} />;
  }

  return (
    <div>
      <header className="mb-6">
        <div className="mb-1 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-sans text-h1 text-[var(--ink)]">{formattedDate}</h1>
            <p className="mt-2 font-sans text-caption text-[var(--ink-faint)]">{weekday}</p>
          </div>
          <SproutBadge days={streak} />
        </div>

        <div
          className="mt-4 border-l-[3px] py-1.5 pl-[22px] pr-3"
          style={{ borderColor: 'var(--brand)' }}
        >
          <p className="font-sans text-[17px] leading-relaxed text-[var(--ink-soft)]">「{quote}」</p>
          <p className="mt-1.5 font-sans text-caption text-[var(--ink-faint)]">每日一句</p>
        </div>
      </header>

      {writeError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 font-sans text-small text-red-600 dark:bg-red-950/40 dark:text-red-300">
          {writeError}
        </p>
      )}

      <section className="card mb-6 rounded-xl p-6 sm:p-8">
        <h2 className="mb-3 font-sans text-h2 text-[var(--ink)]">今天是什么状态？</h2>
        <MoodSelector selected={stateId} onSelect={handleStateSelect} />
        <p className="mt-4 font-sans text-caption text-[var(--ink-faint)]">
          {stateConfig ? `已记：${stateConfig.label}` : allStates.length > 0 ? '点选状态，记下今天' : '还没有可选状态'}
        </p>
      </section>

      {date && <TodayGoalsSection date={date} />}

      <section className="card mb-6 rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sans text-h2 text-[var(--ink)]">今日学习</h2>
          <Pressable
            variant="pill"
            onClick={openAdd}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--keyline)] px-3 py-1.5 font-sans text-small text-[var(--ink-soft)]"
          >
            <Plus size={14} strokeWidth={1.75} />
            添加
          </Pressable>
        </div>

        {entries.length === 0 ? (
          <Pressable
            onClick={openAdd}
            className="w-full rounded-lg border border-dashed border-[var(--hairline)] py-8 text-center"
          >
            <span className="font-sans text-body text-[var(--ink-faint)]">＋ 记下今天的第一段学习</span>
          </Pressable>
        ) : (
          <div>
            {entries.map((item, idx) => (
              <div
                key={item.id}
                className={idx < entries.length - 1 ? 'border-b border-[var(--hairline)]' : ''}
              >
                <LearningRecordCard
                  item={item}
                  onEdit={() => {
                    setEditingItem(item);
                    setShowForm(true);
                  }}
                  onDelete={() => {
                    void handleDeleteEntry(item.id);
                  }}
                />
              </div>
            ))}
            <div className="flex items-center justify-end gap-2.5 pt-5">
              <span className="font-sans text-small text-[var(--ink-soft)]">合计</span>
              <span className="font-mono text-num-lg text-[var(--ink)]">{formatDurationHM(totalMin)}</span>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-sans text-h2 text-[var(--ink)]">今日想法</h2>
        <DiaryEditor value={diary} onSave={handleDiarySave} />
      </section>

      {showForm && (
        <LearningFormModal
          item={editingItem}
          subjects={activeSubjects}
          onConfirm={editingItem ? handleUpdateEntry : handleAddEntry}
          onClose={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}
