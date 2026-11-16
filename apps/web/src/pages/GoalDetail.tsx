import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import GoalCompleteSheet, { type GoalCompleteValues } from '../components/GoalCompleteSheet';
import { Pressable } from '../components/ui/Pressable';
import { QueryError, QueryLoading } from '../components/QueryState';
import {
  addGoalTask,
  carryOverGoal,
  completeGoalTask,
  deleteCheckIn,
  deleteGoal,
  deleteGoalTask,
  getGoal,
  uncompleteGoalTask,
  upsertCheckIn,
} from '../lib/goalApi';
import { useGoal, invalidateAll } from '../lib/queries';
import { progressCells, weekStartOf } from '../lib/domain';
import { useApp } from '../context/AppContext';
import { formatDate, getCalendarDays, taskWhenLabel } from '../lib/dateUtils';
import { WEEKDAY_LABELS } from '../lib/constants';
import { showToast } from '../lib/toast';
import { askConfirm } from '../lib/confirm';
import type { GoalCheckin, GoalTask } from '../lib/types/api';

export default function GoalDetail() {
  const { goalId } = useParams<{ goalId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { settings } = useApp();
  const weekStartsOn = settings?.weekStartsOn ?? 1;
  const { data: goal, isPending, error, refetch } = useGoal(goalId ?? '', !!goalId);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskBind, setTaskBind] = useState<'none' | 'date' | 'week'>('none');
  const [taskDate, setTaskDate] = useState(formatDate(new Date()));
  const [quickQty, setQuickQty] = useState('');
  const [sheet, setSheet] = useState<
    | { mode: 'count'; date: string; checkin?: GoalCheckin | null; suggested: number }
    | { mode: 'task'; task: GoalTask }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  const checkinMap = useMemo(() => {
    const map = new Map<string, GoalCheckin>();
    // CHECKLIST 目标服务端返回 checkins: null
    (goal?.checkins ?? []).forEach((c) => map.set(c.date, c));
    return map;
  }, [goal]);

  if (!goalId) return null;
  if (isPending && !goal) return <QueryLoading />;
  if (error && !goal) return <QueryError message={error.message} onRetry={() => void refetch()} />;
  if (!goal) return null;

  const unit = goal.unit || '';
  const itemUnit = goal.type === 'CHECKLIST' ? '项' : unit;
  const year = Number(goal.period.slice(0, 4));
  const month = Number(goal.period.slice(5, 7)); // 1-based
  const calDays = getCalendarDays(year, month - 1);
  const monthStart = `${goal.period}-01`;
  const today = formatDate(new Date());
  const typeLabel = goal.type === 'COUNT' ? '数量型' : '清单型';

  const refresh = () => invalidateAll(qc);

  /** 写操作后取回最新 percent，跨过 100 时提示「这颗开了」 */
  const toastIfReached = async (goalId: string, before: number) => {
    try {
      const detail = await getGoal(goalId);
      if (before < 100 && detail.percent >= 100) {
        showToast('这颗开了', 'success');
      }
    } catch {
      /* percent 只是锦上添花 */
    }
    refresh();
  };

  const handleAddTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    try {
      await addGoalTask(goal.id, {
        title,
        dueDate: taskBind === 'date' ? taskDate : undefined,
        // 服务端按「weekStart 当天所在周」匹配，需归一化为周起始日
        weekStart: taskBind === 'week' ? weekStartOf(taskDate, weekStartsOn) : undefined,
      });
      setTaskTitle('');
      setTaskBind('none');
      refresh();
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
        await upsertCheckIn(goal.id, sheet.date, {
          quantity: values.quantity ?? 1,
          note: values.note,
          durationMin: values.durationMin,
          createEntry: values.createEntry,
          date: sheet.date,
        });
      } else if (sheet?.mode === 'task') {
        await completeGoalTask(sheet.task.id, {
          durationMin: values.durationMin,
          reflection: values.note,
          createEntry: values.createEntry,
          date: today,
        });
      }
      setSheet(null);
      await toastIfReached(goal.id, before);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleUncheckTask = (task: GoalTask) => {
    void uncompleteGoalTask(task.id)
      .then(refresh)
      .catch((err) => showToast(err instanceof Error ? err.message : '更新失败'));
  };

  const handleDeleteTask = (task: GoalTask) => {
    void deleteGoalTask(task.id)
      .then(refresh)
      .catch((err) => showToast(err instanceof Error ? err.message : '删除失败'));
  };

  const handleDeleteCheckin = (date: string) => {
    void (async () => {
      const ok = await askConfirm({
        title: '取消打卡',
        message: `取消 ${date.slice(8)} 日的打卡？`,
        confirmLabel: '取消打卡',
        danger: true,
      });
      if (!ok) return;
      try {
        await deleteCheckIn(goal.id, date);
        refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : '取消失败');
      }
    })();
  };

  const openCountSheet = (date: string, checkin: GoalCheckin | null, suggested: number) => {
    setSheet({ mode: 'count', date, checkin, suggested });
  };

  const remaining = goal.remaining ?? Math.max(0, goal.totalValue - goal.actualValue);
  const heroCells = progressCells(goal.percent, 40);

  return (
    <div className="nb-book">
      {/* 左页：标题 / 大数字 / KV / 每周进度 / 备注 / 操作 */}
      <div className="nb-page l nb-gridbg">
        <button type="button" className="nb-back" onClick={() => navigate('/plan')}>
          ‹ 计划 / {typeLabel}
        </button>

        <div className="nb-hero">
          <h1 className="nb-hero-title">{goal.title}</h1>
          <div className="nb-hero-row">
            <span className="nb-hero-num">{goal.actualValue}</span>
            <span className="nb-hero-den">
              / {goal.totalValue}
              {itemUnit ? ` ${itemUnit}` : ''}
            </span>
            <span className="nb-stamp">{goal.percent}%</span>
          </div>
          <div className="nb-meter nb-meter-hero">
            {heroCells.map((f, i) => (
              <span key={i} className={f ? 'f' : ''} />
            ))}
          </div>
        </div>

        <div className="nb-kv">
          <div>
            <small>剩余</small>
            <b>
              {remaining}
              {itemUnit ? ` ${itemUnit}` : ''}
            </b>
          </div>
          <div>
            <small>剩余天数</small>
            <b>{goal.remainingDays != null ? `${goal.remainingDays} 天` : '—'}</b>
          </div>
          <div>
            <small>计划日均</small>
            <b>
              {goal.plannedDaily != null
                ? `${goal.plannedDaily}${unit || itemUnit}`
                : '—'}
            </b>
          </div>
          <div>
            <small>按剩余追赶</small>
            <b style={{ color: 'var(--brand)' }}>
              {goal.suggestedDaily != null
                ? `${goal.suggestedDaily}${unit || itemUnit}/天`
                : '—'}
            </b>
          </div>
        </div>

        {goal.type === 'COUNT' && (goal.weeks ?? []).length > 0 && (
          <>
            <div className="nb-sec">
              每周进度
              <span className="nb-sec-side">实际 / 计划</span>
            </div>
            <table className="nb-table">
              <tbody>
                {(goal.weeks ?? []).map((week, idx) => {
                  const pct =
                    week.planned > 0
                      ? Math.min(100, Math.round((week.actual / week.planned) * 100))
                      : 0;
                  const cells = progressCells(pct, 15);
                  return (
                    <tr key={week.weekStart}>
                      <td className="nb-ww">第 {idx + 1} 周</td>
                      <td>
                        <div className="nb-meter">
                          {cells.map((f, i) => (
                            <span key={i} className={f ? 'f' : ''} />
                          ))}
                        </div>
                      </td>
                      <td className="nb-m nb-ww-val">
                        {week.actual} / {week.planned}
                        {unit ? ` ${unit}` : ''}
                        {week.actual >= week.planned && week.planned > 0 && (
                          <span style={{ color: 'var(--brand)' }}> ✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {goal.note && (
          <>
            <div className="nb-sec">备注</div>
            <div className="nb-note">{goal.note}</div>
          </>
        )}

        <div className="nb-actions">
          <button
            type="button"
            className="nb-btn"
            onClick={() => void handleCarryOver()}
            disabled={busy}
          >
            结转下月
          </button>
          <button
            type="button"
            className="nb-btn r"
            style={{ marginLeft: 'auto' }}
            onClick={() => void handleDelete()}
          >
            删除目标
          </button>
        </div>
      </div>

      {/* 右页：COUNT=盖章打卡日历 / CHECKLIST=小目标清单 */}
      <div className="nb-page r nb-gridbg">
        {goal.type === 'COUNT' ? (
          <>
            <div className="nb-sec">
              打卡日历
              <span className="nb-sec-side">点日期打卡，点已打卡的日子可取消</span>
            </div>
            <div className="nb-cal h86">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="nb-cal-wk">
                  {w}
                </div>
              ))}
              {calDays.map((d) => {
                if (!d.isCurrentMonth) {
                  return d.dateStr < monthStart ? <div key={d.dateStr} /> : null;
                }
                const checkin = checkinMap.get(d.dateStr);
                const isToday = d.dateStr === today;
                const isFuture = d.dateStr > today;
                if (isFuture) {
                  return (
                    <div key={d.dateStr} className="nb-cal-cell nb-cal-checkin future">
                      <span className="nb-cal-d">{Number(d.dateStr.slice(8))}</span>
                    </div>
                  );
                }
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    className={`nb-cal-cell nb-cal-checkin${isToday ? ' today' : ''}`}
                    onClick={() => {
                      if (checkin) {
                        handleDeleteCheckin(d.dateStr);
                        return;
                      }
                      openCountSheet(d.dateStr, null, goal.suggestedDaily ?? 1);
                    }}
                  >
                    <span className="nb-cal-d">{Number(d.dateStr.slice(8))}</span>
                    {checkin && <span className="nb-stamp-circle">{checkin.quantity}</span>}
                  </button>
                );
              })}
            </div>

            <div className="nb-checkin-bar">
              <span className="nb-checkin-label">今日 {today.slice(5).replace('-', '.')} 打卡</span>
              <input
                className="nb-field num nb-checkin-qty"
                value={quickQty}
                onChange={(e) => setQuickQty(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder={String(goal.suggestedDaily ?? 1)}
              />
              <span className="nb-checkin-unit">{unit || '题'}</span>
              <button
                type="button"
                className="nb-btn p"
                style={{ marginLeft: 'auto' }}
                onClick={() =>
                  openCountSheet(
                    today,
                    checkinMap.get(today) ?? null,
                    Number(quickQty) || goal.suggestedDaily || 1,
                  )
                }
              >
                盖章
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="nb-sec">小目标</div>
            <div className="nb-taskform">
              <input
                className="nb-field"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAddTask();
                }}
                placeholder="加一条小目标，例如：学完知识库文件上传"
              />
              <div className="nb-taskform-row">
                {(['none', 'date', 'week'] as const).map((bind) => (
                  <button
                    key={bind}
                    type="button"
                    className={`nb-chip${taskBind === bind ? ' on' : ''}`}
                    onClick={() => setTaskBind(bind)}
                  >
                    {bind === 'none' ? '本月随时' : bind === 'date' ? '某日' : '某周'}
                  </button>
                ))}
                {taskBind !== 'none' && (
                  <input
                    type="date"
                    className="nb-field nb-task-date"
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                  />
                )}
                <button
                  type="button"
                  className="nb-btn p"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => void handleAddTask()}
                  disabled={!taskTitle.trim()}
                >
                  添加
                </button>
              </div>
            </div>

            {(goal.tasks ?? []).length === 0 ? (
              <p className="nb-empty-hint">还没有小目标，先拆一条</p>
            ) : (
              (goal.tasks ?? []).map((task) => (
                <div key={task.id} className="nb-taskrow">
                  <Pressable
                    className="nb-taskcheck"
                    aria-label={task.done ? '取消完成' : '标记完成'}
                    onClick={() => {
                      if (task.done) {
                        handleUncheckTask(task);
                        return;
                      }
                      setSheet({ mode: 'task', task });
                    }}
                  >
                    <span className={`nb-box${task.done ? ' on' : ''}`} />
                  </Pressable>
                  <div className="nb-taskbody">
                    <p className={task.done ? 'done' : undefined}>{task.title}</p>
                    <p className="nb-taskmeta">
                      {taskWhenLabel(task)}
                      {task.doneAt ? ` · 完成于 ${formatDate(new Date(task.doneAt))}` : ''}
                    </p>
                    {task.reflection && <p className="nb-taskrefl">{task.reflection}</p>}
                  </div>
                  <button
                    type="button"
                    className="nb-taskdel"
                    aria-label="删除小目标"
                    onClick={() => handleDeleteTask(task)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {sheet && (
        <GoalCompleteSheet
          mode={sheet.mode}
          title={sheet.mode === 'count' ? `${goal.title} · ${sheet.date}` : sheet.task.title}
          unit={goal.unit}
          defaultQuantity={
            sheet.mode === 'count' ? (sheet.checkin?.quantity ?? sheet.suggested) : undefined
          }
          defaultDurationMin={0}
          defaultNote={
            sheet.mode === 'count' ? (sheet.checkin?.note ?? '') : sheet.task.reflection ?? ''
          }
          onConfirm={handleCompleteConfirm}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
