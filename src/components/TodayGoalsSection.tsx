import { useState } from 'react';
import { completeGoalTask, deleteCheckIn, getTodayGoals, upsertCheckIn } from '../lib/goalApi';
import { showToast } from '../lib/toast';
import { useApiQuery } from '../lib/useApiQuery';
import { useNavigate } from 'react-router-dom';
import GoalCompleteSheet, { type GoalCompleteValues } from './GoalCompleteSheet';
import GoalProgressBar from './GoalProgressBar';
import { Pressable } from './ui/Pressable';
import { QueryError } from './QueryState';
import type { GoalCheckIn, GoalTask, TodayGoalItem, TodayGoals } from '../types/goal';

interface TodayGoalsSectionProps {
  date: string;
}

function patchItems(data: TodayGoals | undefined, goalId: string, updater: (item: TodayGoalItem) => TodayGoalItem): TodayGoals | undefined {
  if (!data) return data;
  return {
    ...data,
    items: data.items.map((item) => (item.goalId === goalId ? updater(item) : item)),
  };
}

export default function TodayGoalsSection({ date }: TodayGoalsSectionProps) {
  const navigate = useNavigate();
  const { data, error, refresh, setData } = useApiQuery(() => getTodayGoals(date), [date]);
  const [sheet, setSheet] = useState<
    | { item: TodayGoalItem; mode: 'count' }
    | { item: TodayGoalItem; mode: 'task'; task: GoalTask }
    | null
  >(null);

  const items = data?.items ?? [];
  if (error) {
    return (
      <section className="card mb-6 rounded-xl p-6">
        <h2 className="mb-2 font-sans text-h2 text-[var(--ink)]">今日任务</h2>
        <QueryError message={error.message} onRetry={refresh} />
      </section>
    );
  }
  if (items.length === 0) {
    return (
      <section className="card mb-6 rounded-xl p-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-sans text-h2 text-[var(--ink)]">今日任务</h2>
          <Pressable
            variant="pill"
            onClick={() => navigate('/plan')}
            className="font-sans text-caption text-[var(--brand)]"
          >
            去制定
          </Pressable>
        </div>
        <p className="font-sans text-body text-[var(--ink-faint)]">今天没有待办任务</p>
      </section>
    );
  }

  const handleConfirm = async (values: GoalCompleteValues) => {
    if (!sheet) return;
    const before = sheet.item.percent;
    const prev = data;
    try {
      if (sheet.mode === 'count') {
        setData((cur) =>
          patchItems(cur, sheet.item.goalId, (item) => ({
            ...item,
            todayCheckin: {
              id: item.todayCheckin?.id ?? 'optimistic',
              goalId: item.goalId,
              date,
              quantity: values.quantity ?? item.suggestedToday ?? 1,
              durationMin: values.durationMin ?? null,
              note: values.note ?? '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } satisfies GoalCheckIn,
          })),
        );
        const updated = await upsertCheckIn(sheet.item.goalId, date, {
          id: sheet.item.todayCheckin?.id,
          quantity: values.quantity ?? sheet.item.suggestedToday ?? 1,
          durationMin: values.durationMin,
          note: values.note,
          syncLearning: values.syncLearning,
        });
        if (before < 100 && updated.percent >= 100) showToast('这颗开了', 'success');
      } else {
        setData((cur) =>
          patchItems(cur, sheet.item.goalId, (item) => ({
            ...item,
            todayTasks: item.todayTasks.map((task) =>
              task.id === sheet.task.id ? { ...task, done: true } : task,
            ),
          })),
        );
        const updated = await completeGoalTask(sheet.item.goalId, sheet.task.id, {
          done: true,
          durationMin: values.durationMin,
          reflection: values.note,
          syncLearning: values.syncLearning,
          date,
        });
        if (before < 100 && updated.percent >= 100) showToast('这颗开了', 'success');
      }
      setSheet(null);
    } catch (err) {
      setData(prev);
      showToast(err instanceof Error ? err.message : '保存失败');
    }
  };

  return (
    <section className="card mb-6 rounded-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-sans text-h2 text-[var(--ink)]">今日任务</h2>
        <Pressable
          variant="pill"
          onClick={() => navigate('/plan')}
          className="font-sans text-caption text-[var(--brand)]"
        >
          月计划
        </Pressable>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.goalId}>
            <Pressable
              onClick={() => navigate(`/plan/${item.goalId}`)}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 font-sans text-title text-[var(--ink)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                {item.title}
              </span>
              <span className="font-mono text-caption text-[var(--ink-faint)]">{item.percent}%</span>
            </Pressable>
            <GoalProgressBar percent={item.percent} color={item.color} reached={item.reached} />

            {item.type === 'COUNT' && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="font-sans text-small text-[var(--ink-soft)]">
                  {item.todayCheckin
                    ? `今天已记 ${item.todayCheckin.quantity} ${item.unit || ''}`
                    : `今日建议 ${item.suggestedToday ?? 0} ${item.unit || ''}`}
                  {item.remaining != null && !item.reached ? ` · 还剩 ${item.remaining}` : ''}
                </p>
                {item.todayCheckin ? (
                  <Pressable
                    variant="pill"
                    onClick={() => {
                      const prev = data;
                      setData((cur) =>
                        patchItems(cur, item.goalId, (it) => ({ ...it, todayCheckin: null })),
                      );
                      void deleteCheckIn(item.goalId, date).catch((err) => {
                        setData(prev);
                        showToast(err instanceof Error ? err.message : '取消失败');
                      });
                    }}
                    className="rounded-full border border-[var(--keyline)] px-3 py-1 font-sans text-caption text-[var(--ink-soft)]"
                  >
                    取消
                  </Pressable>
                ) : (
                  <Pressable
                    variant="pill"
                    onClick={() => setSheet({ item, mode: 'count' })}
                    className="rounded-full px-3 py-1 font-sans text-caption text-[var(--text-inverse)]"
                    style={{ background: item.color }}
                  >
                    完成
                  </Pressable>
                )}
              </div>
            )}

            {item.type === 'CHECKLIST' && (
              <ul className="mt-3 space-y-2">
                {item.todayTasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2.5">
                    <Pressable
                      variant="icon"
                      aria-label={task.done ? '取消完成' : '标记完成'}
                      onClick={() => {
                        if (task.done) {
                          const prev = data;
                          setData((cur) =>
                            patchItems(cur, item.goalId, (it) => ({
                              ...it,
                              todayTasks: it.todayTasks.map((t) =>
                                t.id === task.id ? { ...t, done: false } : t,
                              ),
                            })),
                          );
                          void completeGoalTask(item.goalId, task.id, { done: false }).catch((err) => {
                            setData(prev);
                            showToast(err instanceof Error ? err.message : '更新失败');
                          });
                          return;
                        }
                        setSheet({ item, mode: 'task', task });
                      }}
                      className="mt-0.5 flex shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor: task.done ? item.color : 'var(--keyline)',
                        background: task.done ? item.color : 'transparent',
                      }}
                    >
                      {task.done && (
                        <span className="block h-1.5 w-2.5 -translate-y-px rotate-[-50deg] border-b-2 border-l-2 border-white" />
                      )}
                    </Pressable>
                    <span
                      className="font-sans text-small text-[var(--ink)]"
                      style={{ textDecoration: task.done ? 'line-through' : undefined, opacity: task.done ? 0.55 : 1 }}
                    >
                      {task.title}
                      {task.dueDate && task.dueDate < date && !task.done ? (
                        <span className="ml-1 text-[var(--ink-faint)]">过期</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {sheet && (
        <GoalCompleteSheet
          mode={sheet.mode}
          title={sheet.mode === 'count' ? sheet.item.title : sheet.task.title}
          unit={sheet.item.unit}
          defaultQuantity={
            sheet.mode === 'count'
              ? sheet.item.todayCheckin?.quantity ?? sheet.item.suggestedToday ?? 1
              : undefined
          }
          defaultDurationMin={
            sheet.mode === 'count'
              ? sheet.item.todayCheckin?.durationMin ?? 0
              : sheet.task.durationMin ?? 0
          }
          defaultNote={
            sheet.mode === 'count' ? sheet.item.todayCheckin?.note ?? '' : sheet.task.reflection ?? ''
          }
          onConfirm={handleConfirm}
          onClose={() => setSheet(null)}
        />
      )}
    </section>
  );
}
