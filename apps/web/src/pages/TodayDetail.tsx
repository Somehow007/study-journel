import { Link, useParams } from 'react-router-dom';
import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  createEntry,
  createSubject,
  deleteEntry,
  patchDay,
  updateEntry,
} from '../lib/api';
import {
  useDay,
  useDayMarks,
  useGoalsByPeriod,
  useStreak,
  useSubjects,
  qk,
  invalidateAll,
} from '../lib/queries';
import { useApp } from '../context/AppContext';
import { showToast } from '../lib/toast';
import { monthBounds, progressCells } from '../lib/domain';
import { formatDuration, getWeekdayChinese } from '../lib/dateUtils';
import { EN_MONTHS, MONTH_LABELS } from '../lib/constants';
import MoodSelector from '../components/MoodSelector';
import LearningRecordCard, { formatDurationHM } from '../components/LearningRecordCard';
import LearningFormModal, { type EntryDraft } from '../components/LearningFormModal';
import DiaryEditor from '../components/DiaryEditor';
import CalGrid from '../components/CalGrid';
import TodayGoalsSection from '../components/TodayGoalsSection';
import { QueryError, QueryLoading } from '../components/QueryState';
import type { DayDetail, Entry } from '../lib/types/api';

export default function TodayDetail() {
  const { date } = useParams<{ date: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Entry | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  const { data: day, isPending, error, refetch } = useDay(date ?? '', !!date);
  const { data: streakResult } = useStreak();
  const { data: subjects } = useSubjects();
  const { dailyGoalMin } = useApp();
  const activeSubjects = useMemo(
    () => (subjects ?? []).filter((s) => s.archivedAt == null),
    [subjects],
  );

  const stateId = day?.stateId ?? null;
  const entries = day?.entries ?? [];
  const diary = day?.diary ?? '';
  const totalMin = day?.totalMin ?? 0;

  const period = date?.slice(0, 7) ?? '';
  const [markFrom, markTo] = period ? monthBounds(period) : ['', ''];
  const { data: marks } = useDayMarks(markFrom, markTo, !!period);
  const { data: monthGoals } = useGoalsByPeriod(period, !!period);

  const monthMeta = useMemo(() => {
    const list = marks ?? [];
    return {
      days: list.filter(
        (m) => m.totalMin > 0 || m.stateId != null || m.entryCount > 0 || m.diaryPreview,
      ).length,
      minutes: list.reduce((s, m) => s + m.totalMin, 0),
    };
  }, [marks]);

  const dateObj = useMemo(() => {
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [date]);

  const monthIdx = dateObj ? dateObj.getMonth() : 0;
  const dayNum = dateObj ? dateObj.getDate() : 0;
  const year = dateObj ? dateObj.getFullYear() : 0;
  const weekday = dateObj ? getWeekdayChinese(dateObj) : '';
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
      try {
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
      } catch (err) {
        const message = err instanceof Error ? err.message : '保存失败';
        showToast(message, 'error', { onRetry: () => void handleAddEntry(draft) });
      }
    },
    [date, qc, resolveSubjectId],
  );

  const handleUpdateEntry = useCallback(
    async (draft: EntryDraft) => {
      if (!editingItem) return;
      try {
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
      } catch (err) {
        const message = err instanceof Error ? err.message : '保存失败';
        showToast(message, 'error', { onRetry: () => void handleUpdateEntry(draft) });
      }
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

  const monthGoalsList = monthGoals?.goals ?? [];

  return (
    <div className="nb-book">
      {/* 左页：日期 / 状态 / 今日学习 / 待办 / 小结 */}
      <div className="nb-page l nb-gridbg">
        <div className="nb-date">
          <span className="nb-date-num">
            {monthIdx + 1}.{dayNum}
          </span>
          <span className="nb-date-meta">
            {weekday} · {year}
            <br />
            {streak > 0 ? `第 ${streak} 天连续` : '从这里开始记录'}
          </span>
          <div style={{ marginLeft: 'auto' }}>
            <MoodSelector selected={stateId} onSelect={handleStateSelect} />
          </div>
        </div>

        {writeError && (
          <p className="mt-3 text-[13px]" style={{ color: 'var(--brand)' }}>
            {writeError}
          </p>
        )}

        <div className="nb-sec">
          今日学习
          <button type="button" className="nb-sec-side red" onClick={openAdd}>
            + 补一条
          </button>
        </div>

        {entries.length === 0 ? (
          <button
            type="button"
            onClick={openAdd}
            className="w-full py-8 text-center text-[14px]"
            style={{
              border: '1px dashed var(--rule-dash)',
              color: 'var(--ink-faint)',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            ＋ 记下今天的第一段学习
          </button>
        ) : (
          <table className="nb-table">
            <tbody>
              {entries.map((item) => (
                <LearningRecordCard
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setEditingItem(item);
                    setShowForm(true);
                  }}
                  onDelete={() => {
                    void handleDeleteEntry(item.id);
                  }}
                />
              ))}
            </tbody>
          </table>
        )}

        <div className="nb-sum">
          合计
          <span
            className="nb-hl"
            style={{
              fontFamily: 'var(--font-num)',
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            {formatDurationHM(totalMin)}
          </span>
          {dailyGoalMin > 0 && <span>/ 目标 {formatDuration(dailyGoalMin)}</span>}
        </div>

        {date && <TodayGoalsSection date={date} />}

        <div className="nb-sec">
          今日小结
          <span className="nb-sec-side">Markdown</span>
        </div>
        <DiaryEditor value={diary} onSave={handleDiarySave} />
      </div>

      {/* 右页：本月小日历 + 本月目标 */}
      <div className="nb-page r nb-gridbg">
        <div className="nb-date">
          <span className="nb-date-num sm">{MONTH_LABELS[monthIdx]}</span>
          <span className="nb-date-meta">
            {EN_MONTHS[monthIdx]} · {year}
            <br />
            本月 {monthMeta.days} 天 · {formatDuration(monthMeta.minutes)}
          </span>
        </div>

        <div style={{ marginTop: 20 }}>
          <CalGrid period={period} marks={marks} highlightDate={date} heightClass="h72" />
        </div>

        <div className="nb-sec">
          本月目标
          <Link to="/plan" className="nb-sec-side">
            查看计划 →
          </Link>
        </div>

        {monthGoalsList.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
            本月还没有目标
          </p>
        ) : (
          monthGoalsList.map((g) => {
            const cells = progressCells(g.percent ?? 0);
            const val =
              g.type === 'COUNT' && g.totalValue
                ? `${g.actualValue}/${g.totalValue}${g.unit ? ` ${g.unit}` : ''}`
                : `${g.percent}%`;
            return (
              <div className="nb-goal" key={g.id}>
                <span className="flex min-w-0 items-baseline gap-2">
                  <i
                    aria-hidden
                    className="flex-none self-center"
                    style={{ width: 8, height: 8, background: g.color }}
                  />
                  <Link
                    to={`/plan/${g.id}`}
                    className="truncate hover:underline"
                    style={{ color: 'inherit' }}
                  >
                    {g.title}
                  </Link>
                </span>
                <span className="nb-goal-val">{val}</span>
                <span className="nb-meter">
                  {cells.map((f, i) => (
                    <span key={i} className={f ? 'f' : ''} />
                  ))}
                </span>
                <small>{g.note || (g.carriedFrom ? '含上月结转' : '')}</small>
              </div>
            );
          })
        )}
      </div>

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
