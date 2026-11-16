import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  completeGoalTask,
  deleteCheckIn,
  getGoal,
  uncompleteGoalTask,
  upsertCheckIn,
} from '../lib/goalApi';
import { showToast } from '../lib/toast';
import { useTodayGoals, qk, invalidateAll } from '../lib/queries';
import { Link } from 'react-router-dom';
import GoalCompleteSheet, { type GoalCompleteValues } from './GoalCompleteSheet';
import { Pressable } from './ui/Pressable';
import { QueryError } from './QueryState';
import type { GoalCheckin, GoalTask, TodayGoalItem, TodayGoals } from '../lib/types/api';

interface TodayGoalsSectionProps {
  date: string;
}

function patchItems(
  data: TodayGoals | undefined,
  goalId: string,
  updater: (item: TodayGoalItem) => TodayGoalItem,
): TodayGoals | undefined {
  if (!data) return data;
  return {
    ...data,
    items: data.items.map((item) => (item.goalId === goalId ? updater(item) : item)),
  };
}

export default function TodayGoalsSection({ date }: TodayGoalsSectionProps) {
  const qc = useQueryClient();
  const { data, isPending, error, refetch } = useTodayGoals(date);
  const [sheet, setSheet] = useState<
    | { item: TodayGoalItem; mode: 'count' }
    | { item: TodayGoalItem; mode: 'task'; task: GoalTask }
    | null
  >(null);

  const items = data?.items ?? [];
  const doneCount = items.filter((i) => i.reached).length;

  const setTodayData = (updater: (cur: TodayGoals | undefined) => TodayGoals | undefined) => {
    qc.setQueryData<TodayGoals | undefined>(qk.todayGoals(date), updater);
  };

  /** 写操作后刷新全部查询，并取回目标最新 percent 用于「达标」提示 */
  const afterWrite = async (goalId: string, before: number) => {
    invalidateAll(qc);
    try {
      const detail = await getGoal(goalId);
      if (before < 100 && detail.percent >= 100) showToast('这颗开了', 'success');
    } catch {
      /* percent 只是锦上添花，失败不阻塞 */
    }
  };

  const handleConfirm = async (values: GoalCompleteValues) => {
    if (!sheet) return;
    const before = sheet.item.percent;
    const goalId = sheet.item.goalId;
    try {
      if (sheet.mode === 'count') {
        setTodayData((cur) =>
          patchItems(cur, goalId, (item) => ({
            ...item,
            todayCheckin: {
              id: item.todayCheckin?.id ?? `tmp-${Date.now()}`,
              goalId: item.goalId,
              date,
              quantity: values.quantity ?? item.suggestedToday ?? 1,
              note: values.note ?? '',
              entryId: null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } satisfies GoalCheckin,
          })),
        );
        await upsertCheckIn(goalId, date, {
          quantity: values.quantity ?? sheet.item.suggestedToday ?? 1,
          note: values.note,
          durationMin: values.durationMin,
          createEntry: values.createEntry,
          date,
        });
      } else {
        setTodayData((cur) =>
          patchItems(cur, goalId, (item) => ({
            ...item,
            todayTasks: item.todayTasks.map((task) =>
              task.id === sheet.task.id ? { ...task, done: true } : task,
            ),
          })),
        );
        await completeGoalTask(sheet.task.id, {
          durationMin: values.durationMin,
          reflection: values.note,
          createEntry: values.createEntry,
          date,
        });
      }
      setSheet(null);
      await afterWrite(goalId, before);
    } catch (err) {
      invalidateAll(qc);
      showToast(err instanceof Error ? err.message : '保存失败');
    }
  };

  return (
    <div>
      <div className="nb-sec">
        待办
        {items.length > 0 ? (
          <Link to="/plan" className="nb-sec-side">
            来自月计划 · {doneCount} / {items.length} →
          </Link>
        ) : (
          <Link to="/plan" className="nb-sec-side red">
            去制定 →
          </Link>
        )}
      </div>

      {isPending && !data ? (
        <div className="animate-pulse space-y-2 py-2" aria-busy="true">
          <div className="h-4 w-2/3 bg-[var(--hairline)]" />
          <div className="h-4 w-1/2 bg-[var(--hairline)]" />
        </div>
      ) : error && !data ? (
        <QueryError message={error.message} onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <p className="py-1 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          今天没有待办任务
        </p>
      ) : (
        items.map((item) => {
          const pct = Math.min(100, Math.max(0, item.percent));
          const filled = Math.round(pct / 5);
          const taskDone = item.todayTasks.filter((t) => t.done).length;
          return (
            <div className="nb-goal" key={item.goalId}>
              <span className="flex min-w-0 items-baseline gap-2">
                <i
                  aria-hidden
                  className="flex-none self-center"
                  style={{ width: 8, height: 8, background: item.color }}
                />
                <Link
                  to={`/plan/${item.goalId}`}
                  className="truncate hover:underline"
                  style={{ color: 'inherit' }}
                >
                  {item.title}
                </Link>
              </span>
              <span className="nb-goal-val">{item.percent}%</span>
              <span className="nb-meter">
                {Array.from({ length: 20 }, (_, i) => (
                  <span key={i} className={i < filled ? 'f' : ''} />
                ))}
              </span>
              <small>
                {item.type === 'COUNT'
                  ? `今日建议 ${item.suggestedToday ?? 0} ${item.unit || ''}`
                  : `${taskDone} / ${item.todayTasks.length} 项今日任务`}
              </small>

              {item.type === 'COUNT' && (
                <div
                  className="flex items-center justify-between gap-3"
                  style={{ gridColumn: '1 / 3', paddingBottom: 8 }}
                >
                  <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                    {item.todayCheckin
                      ? `今天已记 ${item.todayCheckin.quantity} ${item.unit || ''}`
                      : ''}
                    {item.remaining != null && !item.reached ? `还剩 ${item.remaining}` : ''}
                  </span>
                  {item.todayCheckin ? (
                    <button
                      type="button"
                      className="nb-btn"
                      onClick={() => {
                        setTodayData((cur) =>
                          patchItems(cur, item.goalId, (it) => ({ ...it, todayCheckin: null })),
                        );
                        void deleteCheckIn(item.goalId, date)
                          .then(() => invalidateAll(qc))
                          .catch((err) => {
                            invalidateAll(qc);
                            showToast(err instanceof Error ? err.message : '取消失败');
                          });
                      }}
                    >
                      取消
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="nb-btn p"
                      onClick={() => setSheet({ item, mode: 'count' })}
                    >
                      完成
                    </button>
                  )}
                </div>
              )}

              {item.type === 'CHECKLIST' && (
                <div style={{ gridColumn: '1 / 3' }}>
                  {item.todayTasks.map((task) => (
                    <Pressable
                      key={task.id}
                      className={`nb-todo${task.done ? ' on' : ''}`}
                      aria-label={task.done ? '取消完成' : '标记完成'}
                      onClick={() => {
                        if (task.done) {
                          setTodayData((cur) =>
                            patchItems(cur, item.goalId, (it) => ({
                              ...it,
                              todayTasks: it.todayTasks.map((t) =>
                                t.id === task.id ? { ...t, done: false } : t,
                              ),
                            })),
                          );
                          void uncompleteGoalTask(task.id)
                            .then(() => invalidateAll(qc))
                            .catch((err) => {
                              invalidateAll(qc);
                              showToast(err instanceof Error ? err.message : '更新失败');
                            });
                          return;
                        }
                        setSheet({ item, mode: 'task', task });
                      }}
                    >
                      <span className={`nb-box${task.done ? ' on' : ''}`} />
                      <span>
                        {task.title}
                        {task.dueDate && task.dueDate < date && !task.done ? (
                          <span
                            className="ml-1.5 text-[12px]"
                            style={{ color: 'var(--ink-faint)' }}
                          >
                            过期
                          </span>
                        ) : null}
                      </span>
                    </Pressable>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

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
          defaultDurationMin={0}
          defaultNote={
            sheet.mode === 'count' ? sheet.item.todayCheckin?.note ?? '' : sheet.task.reflection ?? ''
          }
          onConfirm={handleConfirm}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
