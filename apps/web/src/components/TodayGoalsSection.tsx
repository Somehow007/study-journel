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

type TodoRow =
  | { kind: 'count'; key: string; item: TodayGoalItem }
  | { kind: 'task'; key: string; item: TodayGoalItem; task: GoalTask };

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
  const rows: TodoRow[] = items.flatMap((item): TodoRow[] =>
    item.type === 'CHECKLIST'
      ? item.todayTasks.map((task) => ({ kind: 'task', key: task.id, item, task }))
      : [{ kind: 'count', key: item.goalId, item }],
  );
  const doneRows = rows.filter((row) =>
    row.kind === 'count' ? row.item.todayCheckin != null : row.task.done,
  ).length;

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

  const handleCountToggle = (item: TodayGoalItem) => {
    if (item.todayCheckin) {
      setTodayData((cur) =>
        patchItems(cur, item.goalId, (it) => ({ ...it, todayCheckin: null })),
      );
      void deleteCheckIn(item.goalId, date)
        .then(() => invalidateAll(qc))
        .catch((err) => {
          invalidateAll(qc);
          showToast(err instanceof Error ? err.message : '取消失败');
        });
      return;
    }
    setSheet({ item, mode: 'count' });
  };

  const handleTaskToggle = (item: TodayGoalItem, task: GoalTask) => {
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
  };

  return (
    <div>
      <div className="nb-sec">
        待办
        {rows.length > 0 ? (
          <Link to="/plan" className="nb-sec-side">
            来自月计划 · {doneRows} / {rows.length} →
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
      ) : rows.length === 0 ? (
        <p className="py-1 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          今天没有待办任务
        </p>
      ) : (
        rows.map((row) => {
          const { item } = row;
          if (row.kind === 'count') {
            const checkin = item.todayCheckin;
            const on = checkin != null;
            return (
              <Pressable
                key={row.key}
                className={`nb-todo${on ? ' on' : ''}`}
                aria-label={on ? '取消打卡' : '记一笔'}
                onClick={() => handleCountToggle(item)}
              >
                <span className={`nb-box${on ? ' on' : ''}`} />
                <span>
                  {on
                    ? `${item.title} · 已记 ${checkin.quantity} ${item.unit || ''}`
                    : `${item.title} · 今日 ${item.suggestedToday ?? 0} ${item.unit || ''}`}
                </span>
                <em />
              </Pressable>
            );
          }
          const { task } = row;
          const on = task.done;
          return (
            <Pressable
              key={row.key}
              className={`nb-todo${on ? ' on' : ''}`}
              aria-label={on ? '取消完成' : '标记完成'}
              onClick={() => handleTaskToggle(item, task)}
            >
              <span className={`nb-box${on ? ' on' : ''}`} />
              <span>
                {task.title}
                {task.dueDate && task.dueDate < date && !task.done ? (
                  <span className="ml-1.5 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                    过期
                  </span>
                ) : null}
              </span>
              <em>{item.title}</em>
            </Pressable>
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
