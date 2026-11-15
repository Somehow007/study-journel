import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GoalCompleteSheet, { type GoalCompleteValues } from '../components/GoalCompleteSheet';
import GoalProgressBar from '../components/GoalProgressBar';
import { QueryError, QueryLoading } from '../components/QueryState';
import {
  addGoalTask,
  carryOverGoal,
  completeGoalTask,
  deleteCheckIn,
  deleteGoal,
  deleteGoalTask,
  getGoal,
  upsertCheckIn,
} from '../lib/goalApi';
import { formatDate } from '../lib/dateUtils';
import { showToast } from '../lib/toast';
import { askConfirm } from '../lib/confirm';
import { useApiQuery } from '../lib/useApiQuery';
import type { GoalCheckIn, GoalTask } from '../types/goal';

function daysInPeriod(period: string): string[] {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${period}-${String(i + 1).padStart(2, '0')}`);
}

function taskWhen(task: GoalTask): string {
  if (task.dueDate) return task.dueDate.slice(5).replace('-', '/');
  if (task.weekStart) {
    const end = new Date(task.weekStart);
    end.setDate(end.getDate() + 6);
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    return `${task.weekStart.slice(5).replace('-', '/')}–${mm}/${dd}`;
  }
  return '本月随时';
}

export default function GoalDetail() {
  const { goalId } = useParams<{ goalId: string }>();
  const navigate = useNavigate();
  const { data: goal, loading, error, refresh } = useApiQuery(
    () => (goalId ? getGoal(goalId) : Promise.reject(new Error('missing id'))),
    [goalId],
  );

  const [taskTitle, setTaskTitle] = useState('');
  const [taskBind, setTaskBind] = useState<'none' | 'date' | 'week'>('none');
  const [taskDate, setTaskDate] = useState(formatDate(new Date()));
  const [sheet, setSheet] = useState<
    | { mode: 'count'; date: string; checkin?: GoalCheckIn | null; suggested: number }
    | { mode: 'task'; task: GoalTask }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  const checkinMap = useMemo(() => {
    const map = new Map<string, GoalCheckIn>();
    goal?.checkins.forEach((c) => map.set(c.date, c));
    return map;
  }, [goal]);

  if (!goalId) return null;
  if (loading && !goal) return <QueryLoading />;
  if (error && !goal) return <QueryError message={error.message} onRetry={refresh} />;
  if (!goal) return null;

  const unit = goal.unit || '';
  const days = daysInPeriod(goal.period);
  const today = formatDate(new Date());

  const toastIfReached = (before: number, after: number) => {
    if (before < 100 && after >= 100) {
      showToast('这颗开了', 'success');
    }
  };

  const handleAddTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    try {
      await addGoalTask(goal.id, {
        title,
        dueDate: taskBind === 'date' ? taskDate : null,
        weekStart: taskBind === 'week' ? taskDate : null,
      });
      setTaskTitle('');
      setTaskBind('none');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '添加失败');
    }
  };

  const handleDelete = async () => {
    const confirmed = await askConfirm({
      title: '删除目标',
      message: `删除目标「${goal.title}」？进度会一并清掉。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteGoal(goal.id);
      navigate('/plan');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleCarryOver = async () => {
    setBusy(true);
    try {
      const next = await carryOverGoal(goal.id);
      showToast('已结转到下月', 'success');
      navigate(`/plan/${next.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '结转失败');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteConfirm = async (values: GoalCompleteValues) => {
    const before = goal.percent;
    try {
      if (sheet?.mode === 'count') {
        const updated = await upsertCheckIn(goal.id, sheet.date, {
          id: sheet.checkin?.id,
          quantity: values.quantity ?? 1,
          durationMin: values.durationMin,
          note: values.note,
          syncLearning: values.syncLearning,
        });
        toastIfReached(before, updated.percent);
      } else if (sheet?.mode === 'task') {
        const updated = await completeGoalTask(goal.id, sheet.task.id, {
          done: true,
          durationMin: values.durationMin,
          reflection: values.note,
          syncLearning: values.syncLearning,
          date: today,
        });
        toastIfReached(before, updated.percent);
      }
      setSheet(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败');
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/plan')}
        className="mb-4 inline-flex items-center gap-1 font-sans text-small text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        <ArrowLeft size={16} />
        月计划
      </button>

      <header className="mb-6">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: goal.color }} />
              <h1 className="font-sans text-h1 text-[var(--ink)]">{goal.title}</h1>
            </div>
            {goal.note && (
              <p className="mt-2 font-sans text-small text-[var(--ink-soft)]">{goal.note}</p>
            )}
          </div>
          <span className="shrink-0 font-mono text-num-lg text-[var(--ink)]">{goal.percent}%</span>
        </div>
        <GoalProgressBar percent={goal.percent} color={goal.color} reached={goal.reached} />
        <p className="mt-3 font-sans text-small text-[var(--ink-soft)]">
          {goal.type === 'COUNT'
            ? `已完成 ${goal.actualValue} / ${goal.totalValue} ${unit}`
            : `已完成 ${goal.actualValue} / ${goal.totalValue} 项`}
        </p>
      </header>

      {goal.type === 'COUNT' && (
        <>
          <section className="card mb-6 rounded-xl p-5">
            <p className="font-sans text-small text-[var(--ink-faint)]">按剩余追赶</p>
            <p className="mt-1 font-sans text-title text-[var(--ink)]">
              今日建议 {goal.suggestedDaily ?? 0} {unit}
              <span className="mx-2 text-[var(--ink-faint)]">·</span>
              本周建议 {goal.suggestedWeekly ?? 0} {unit}
            </p>
            <p className="mt-1.5 font-sans text-caption text-[var(--ink-faint)]">
              计划节奏 {goal.plannedDaily}
              {unit}/天 · {goal.plannedWeekly} {unit}/周
            </p>
          </section>

          {goal.weeks.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 font-sans text-h2 text-[var(--ink)]">每周进度</h2>
              <div className="flex flex-col gap-2">
                {goal.weeks.map((week, idx) => {
                  const pct = week.planned > 0 ? Math.min(100, Math.round((week.actual / week.planned) * 100)) : 0;
                  return (
                    <div key={week.weekStart} className="card rounded-lg px-4 py-3">
                      <div className="mb-2 flex items-center justify-between font-sans text-caption text-[var(--ink-soft)]">
                        <span>第 {idx + 1} 周</span>
                        <span className="font-mono">
                          {week.actual}/{week.planned} {unit}
                        </span>
                      </div>
                      <GoalProgressBar percent={pct} color={goal.color} reached={week.actual >= week.planned} />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="mb-6">
            <h2 className="mb-3 font-sans text-h2 text-[var(--ink)]">打卡日历</h2>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((date) => {
                const checkin = checkinMap.get(date);
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => {
                      if (checkin) {
                        void (async () => {
                          const ok = await askConfirm({
                            title: '取消打卡',
                            message: `取消 ${date.slice(8)} 日的打卡？`,
                            confirmLabel: '取消打卡',
                            danger: true,
                          });
                          if (!ok) return;
                          void deleteCheckIn(goal.id, date).catch((err) =>
                            showToast(err instanceof Error ? err.message : '取消失败'),
                          );
                        })();
                        return;
                      }
                      setSheet({
                        mode: 'count',
                        date,
                        checkin: null,
                        suggested: goal.suggestedDaily ?? 1,
                      });
                    }}
                    className="flex flex-col items-center rounded-md py-2 font-mono text-caption transition-colors hover:bg-[var(--paper)]"
                    style={{
                      background: checkin ? `${goal.color}22` : isToday ? 'var(--brand-soft)' : undefined,
                      color: checkin ? goal.color : 'var(--ink-soft)',
                      fontWeight: checkin || isToday ? 600 : 400,
                    }}
                  >
                    <span>{Number(date.slice(8))}</span>
                    {checkin && <span className="mt-0.5 text-[10px]">{checkin.quantity}</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 font-sans text-caption text-[var(--ink-faint)]">点日期打卡，点已打卡的日子可取消</p>
          </section>
        </>
      )}

      {goal.type === 'CHECKLIST' && (
        <section className="mb-6">
          <h2 className="mb-3 font-sans text-h2 text-[var(--ink)]">小目标</h2>
          <div className="card mb-4 rounded-xl p-4">
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAddTask();
              }}
              placeholder="加一条小目标，例如：学完知识库文件上传"
              className="mb-3 w-full bg-transparent font-sans text-body text-[var(--ink)] outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              {(['none', 'date', 'week'] as const).map((bind) => (
                <button
                  key={bind}
                  type="button"
                  onClick={() => setTaskBind(bind)}
                  className="rounded-full px-3 py-1 font-sans text-caption"
                  style={
                    taskBind === bind
                      ? { background: 'var(--brand-soft)', color: 'var(--brand)' }
                      : { color: 'var(--ink-faint)', border: '1px solid var(--keyline)' }
                  }
                >
                  {bind === 'none' ? '本月随时' : bind === 'date' ? '某日' : '某周'}
                </button>
              ))}
              {taskBind !== 'none' && (
                <input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="rounded-md px-2 py-1 font-mono text-caption text-[var(--ink)]"
                  style={{ border: '1px solid var(--keyline)' }}
                />
              )}
              <button
                type="button"
                onClick={() => void handleAddTask()}
                disabled={!taskTitle.trim()}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-sans text-small text-[var(--text-inverse)] disabled:opacity-40"
                style={{ background: 'var(--brand)' }}
              >
                <Plus size={14} />
                添加
              </button>
            </div>
          </div>

          {goal.tasks.length === 0 ? (
            <p className="py-8 text-center font-sans text-body text-[var(--ink-faint)]">还没有小目标，先拆一条</p>
          ) : (
            <div className="card divide-y divide-[var(--hairline)] rounded-xl">
              {goal.tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 px-4 py-3">
                  <button
                    type="button"
                    aria-label={task.done ? '取消完成' : '标记完成'}
                    onClick={() => {
                      if (task.done) {
                        void completeGoalTask(goal.id, task.id, { done: false }).catch((err) =>
                          showToast(err instanceof Error ? err.message : '更新失败'),
                        );
                        return;
                      }
                      setSheet({ mode: 'task', task });
                    }}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      borderColor: task.done ? goal.color : 'var(--keyline)',
                      background: task.done ? goal.color : 'transparent',
                    }}
                  >
                    {task.done && (
                      <span className="block h-1.5 w-2.5 -translate-y-px rotate-[-50deg] border-b-2 border-l-2 border-white" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-sans text-body text-[var(--ink)]"
                      style={{ textDecoration: task.done ? 'line-through' : undefined, opacity: task.done ? 0.55 : 1 }}
                    >
                      {task.title}
                    </p>
                    <p className="mt-0.5 font-sans text-caption text-[var(--ink-faint)]">
                      {taskWhen(task)}
                      {task.durationMin ? ` · ${task.durationMin} 分钟` : ''}
                    </p>
                    {task.reflection && (
                      <p className="mt-1 font-sans text-caption text-[var(--ink-soft)]">{task.reflection}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void deleteGoalTask(goal.id, task.id).catch((err) =>
                        showToast(err instanceof Error ? err.message : '删除失败'),
                      );
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-faint)] hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2 pb-8">
        <button
          type="button"
          onClick={() => void handleCarryOver()}
          disabled={busy}
          className="rounded-full border border-[var(--keyline)] px-4 py-2 font-sans text-small text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          结转到下月
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="rounded-full border border-red-200 px-4 py-2 font-sans text-small text-red-400 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
        >
          删除目标
        </button>
      </div>

      {sheet && (
        <GoalCompleteSheet
          mode={sheet.mode}
          title={sheet.mode === 'count' ? `${goal.title} · ${sheet.date}` : sheet.task.title}
          unit={goal.unit}
          defaultQuantity={sheet.mode === 'count' ? (sheet.checkin?.quantity ?? sheet.suggested) : undefined}
          defaultDurationMin={
            sheet.mode === 'count' ? sheet.checkin?.durationMin ?? 0 : sheet.task.durationMin ?? 0
          }
          defaultNote={sheet.mode === 'count' ? sheet.checkin?.note ?? '' : sheet.task.reflection ?? ''}
          onConfirm={handleCompleteConfirm}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
