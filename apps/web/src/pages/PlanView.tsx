import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoalFormModal from '../components/GoalFormModal';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import { useApp } from '../context/AppContext';
import { createGoal, formatPeriod } from '../lib/goalApi';
import { useGoalsByPeriod, useSubjects, invalidateAll, qk } from '../lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { showToast } from '../lib/toast';
import { daysInMonth, progressCells } from '../lib/domain';
import { MONTH_LABELS } from '../lib/constants';
import type { GoalSummary } from '../lib/types/api';

function Meter({ percent, total = 25 }: { percent: number; total?: number }) {
  return (
    <span className="nb-meter">
      {progressCells(percent, total).map((f, i) => (
        <span key={i} className={f ? 'f' : ''} />
      ))}
    </span>
  );
}

function GoalRow({ goal, subjectColor }: { goal: GoalSummary; subjectColor?: string }) {
  const isCount = goal.type === 'COUNT';
  const val = isCount
    ? goal.totalValue
      ? `${goal.actualValue} / ${goal.totalValue}${goal.unit ? ` ${goal.unit}` : ''}`
      : `${Math.round(goal.percent)}%`
    : goal.totalValue
      ? `${goal.actualValue} / ${goal.totalValue} 项`
      : `${Math.round(goal.percent)}%`;
  const daily = goal.suggestedDaily ?? goal.plannedDaily;
  const weekly =
    goal.suggestedWeekly ?? goal.plannedWeekly ?? (daily != null ? daily * 7 : null);
  return (
    <div className="nb-goal">
      <span className="flex min-w-0 items-baseline gap-2">
        {goal.subjectName && (
          <span className="nb-subj" style={{ color: subjectColor ?? 'var(--ink-soft)' }}>
            {goal.subjectName}
          </span>
        )}
        <Link
          to={`/plan/${goal.id}`}
          className="truncate hover:underline"
          style={{ color: 'inherit', fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 17 }}
        >
          {goal.title}
        </Link>
      </span>
      <span className="nb-goal-val">{val}</span>
      <Meter percent={goal.percent} />
      {isCount && (
        <div className="nb-goal-meta">
          <span>
            建议每日 <b>{daily ?? '—'}</b>
          </span>
          <span>
            建议每周 <b>{weekly ?? '—'}</b>
          </span>
          {goal.remainingDays != null && (
            <span>
              剩 <b>{goal.remainingDays}</b> 天
            </span>
          )}
          {goal.remaining != null && !goal.reached && (
            <span>
              还差 <b>{goal.remaining}{goal.unit ? ` ${goal.unit}` : ''}</b>
            </span>
          )}
          {goal.reached && (
            <span style={{ marginLeft: 'auto', color: 'var(--brand)' }}>✓ 已达标</span>
          )}
        </div>
      )}
      {goal.note && <small>{goal.note}</small>}
    </div>
  );
}

export default function PlanView() {
  const navigate = useNavigate();
  const { currentMonth, setCurrentMonth } = useApp();
  const { year, month } = currentMonth;
  const period = formatPeriod(year, month);
  const [showForm, setShowForm] = useState(false);

  const qc = useQueryClient();
  const { data, isPending, error, refetch } = useGoalsByPeriod(period);
  const { data: subjects } = useSubjects();

  const now = useMemo(() => new Date(), []);

  const subjectColorById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects ?? []) map.set(s.id, s.color);
    return map;
  }, [subjects]);

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setCurrentMonth(d.getFullYear(), d.getMonth());
  };
  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setCurrentMonth(d.getFullYear(), d.getMonth());
  };
  const backToThisMonth = () => setCurrentMonth(now.getFullYear(), now.getMonth());

  if (isPending && !data) return <QueryLoading />;
  if (error && !data) return <QueryError message={error.message} onRetry={() => void refetch()} />;

  const goals = data?.goals ?? [];
  const monthPercent = data?.monthPercent ?? 0;
  const reachedCount = data?.reachedCount ?? 0;
  const goalCount = data?.goalCount ?? 0;

  const countGoals = goals.filter((g) => g.type === 'COUNT');
  const checklistGoals = goals.filter((g) => g.type === 'CHECKLIST');
  const carriedGoals = goals.filter((g) => g.carriedFrom != null);

  const dim = daysInMonth(period);
  const curPeriod = formatPeriod(now.getFullYear(), now.getMonth());
  const remainText =
    period === curPeriod
      ? `剩余 ${dim - now.getDate() + 1} 天`
      : period > curPeriod
        ? `整月 ${dim} 天`
        : '已结束';

  const carriedSrc = carriedGoals[0]?.carriedFrom;
  const carriedLabel =
    carriedSrc && /^\d{4}-\d{2}$/.test(carriedSrc) ? `结转自 ${carriedSrc}` : '结转自上月';

  const openForm = () => setShowForm(true);

  const completionBox = (
    <div className="nb-pbox">
      <div>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 13, color: 'var(--ink-soft)' }}>
          本月完成度
        </div>
        <div className="nb-pbox-num">
          {Math.round(monthPercent)}
          <small>%</small>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Meter percent={monthPercent} />
        <div className="nb-pbox-cap">
          进度按各目标百分比平均 · 达标 {reachedCount} / {goalCount}
        </div>
      </div>
    </div>
  );

  const empty = goals.length === 0;

  return (
    <div className={empty ? 'nb-book nb-single' : 'nb-book'}>
      {/* 左页：完成度 + 数量型目标 + 结转 */}
      <div className="nb-page l nb-gridbg">
        <div className="nb-date">
          <span className="nb-date-num">{MONTH_LABELS[month]}计划</span>
          <span className="nb-date-meta">
            {period}
            <br />
            {remainText}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
            <span className="nb-pager">
              <button type="button" onClick={prevMonth} aria-label="上个月">
                ‹
              </button>
              <b>{period.replace('-', '.')}</b>
              <button type="button" onClick={nextMonth} aria-label="下个月">
                ›
              </button>
            </span>
            <button type="button" className="nb-btn r" onClick={backToThisMonth}>
              本月
            </button>
          </span>
        </div>

        {completionBox}

        {empty ? (
          <QueryEmpty
            title="这个月还没有目标"
            hint="定一个可衡量的月目标，拆到每天，完成就能看见进度。"
            action={
              <button type="button" className="nb-btn p" onClick={openForm}>
                制定本月目标
              </button>
            }
          />
        ) : (
          <>
            <div className="nb-sec">
              数量型
              <button type="button" className="nb-sec-side red" onClick={openForm}>
                + 新目标
              </button>
            </div>
            {countGoals.length === 0 ? (
              <p className="py-1 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                这个月还没有数量型目标
              </p>
            ) : (
              countGoals.map((g) => (
                <GoalRow key={g.id} goal={g} subjectColor={subjectColorById.get(g.subjectId ?? '')} />
              ))
            )}
            {carriedGoals.length > 0 && (
              <div className="nb-rollover">
                {carriedLabel}：{carriedGoals.map((g) => `「${g.title}」`).join('、')}
              </div>
            )}
          </>
        )}
      </div>

      {/* 右页：清单型目标（有目标才渲染） */}
      {!empty && (
        <div className="nb-page r nb-gridbg">
          <div className="nb-sec" style={{ marginTop: 4 }}>
            清单型
            <button type="button" className="nb-sec-side red" onClick={openForm}>
              + 新目标
            </button>
          </div>
          {checklistGoals.length === 0 ? (
            <p className="py-1 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              这个月还没有清单型目标
            </p>
          ) : (
            checklistGoals.map((g) => (
              <GoalRow key={g.id} goal={g} subjectColor={subjectColorById.get(g.subjectId ?? '')} />
            ))
          )}
        </div>
      )}

      {showForm && (
        <GoalFormModal
          period={period}
          onClose={() => setShowForm(false)}
          onSubmit={async (payload) => {
            try {
              const created = await createGoal(payload);
              setShowForm(false);
              showToast('目标已种下', 'success');
              invalidateAll(qc);
              void qc.invalidateQueries({ queryKey: qk.goals(period) });
              navigate(`/plan/${created.id}`);
            } catch (err) {
              showToast(err instanceof Error ? err.message : '创建失败');
            }
          }}
        />
      )}
    </div>
  );
}
