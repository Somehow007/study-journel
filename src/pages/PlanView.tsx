import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GoalFormModal from '../components/GoalFormModal';
import GoalProgressBar from '../components/GoalProgressBar';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import { useApp } from '../context/AppContext';
import { createGoal, formatPeriod, getGoalsByPeriod } from '../lib/goalApi';
import { showToast } from '../lib/toast';
import { useApiQuery } from '../lib/useApiQuery';
import { MONTH_LABELS } from '../lib/constants';
import type { GoalSummary } from '../types/goal';

function ProgressRing({ percent, color }: { percent: number; color: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, percent)) / 100);
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24" aria-label={`本月完成度 ${percent}%`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--hairline)" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="55"
        textAnchor="middle"
        fill="var(--ink)"
        fontSize="18"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {percent}%
      </text>
    </svg>
  );
}

function GoalCard({ goal, onClick }: { goal: GoalSummary; onClick: () => void }) {
  const caption =
    goal.type === 'COUNT'
      ? `已完成 ${goal.actualValue} / ${goal.totalValue} ${goal.unit || ''}`
      : `已完成 ${goal.actualValue} / ${goal.totalValue} 项`;
  return (
    <button
      type="button"
      onClick={onClick}
      className="card w-full rounded-xl p-5 text-left transition-all hover:border-[var(--brand)]"
      style={{
        border: goal.reached ? `1px solid ${goal.color}` : undefined,
        boxShadow: goal.reached ? `0 0 0 3px color-mix(in srgb, ${goal.color} 18%, transparent)` : undefined,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: goal.color }} />
            <h3 className="truncate font-sans text-title text-[var(--ink)]">{goal.title}</h3>
          </div>
          <p className="mt-1.5 font-sans text-caption text-[var(--ink-faint)]">
            {goal.type === 'COUNT' ? '数量型' : '清单型'} · {caption}
          </p>
        </div>
        <span className="shrink-0 font-mono text-num text-[var(--ink)]">{goal.percent}%</span>
      </div>
      <GoalProgressBar percent={goal.percent} color={goal.color} reached={goal.reached} />
      {goal.type === 'COUNT' && goal.suggestedDaily != null && !goal.reached && (
        <p className="mt-3 font-sans text-caption text-[var(--ink-faint)]">
          今日建议 {goal.suggestedDaily} {goal.unit || ''} · 本周建议 {goal.suggestedWeekly} {goal.unit || ''}
        </p>
      )}
    </button>
  );
}

export default function PlanView() {
  const navigate = useNavigate();
  const { currentMonth, setCurrentMonth } = useApp();
  const { year, month } = currentMonth;
  const period = formatPeriod(year, month);
  const [showForm, setShowForm] = useState(false);

  const { data, loading, error, refresh } = useApiQuery(() => getGoalsByPeriod(period), [period]);

  const now = useMemo(() => new Date(), []);

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setCurrentMonth(d.getFullYear(), d.getMonth());
  };
  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setCurrentMonth(d.getFullYear(), d.getMonth());
  };

  if (loading && !data) return <QueryLoading />;
  if (error && !data) return <QueryError message={error.message} onRetry={refresh} />;

  const goals = data?.goals ?? [];
  const monthPercent = data?.monthPercent ?? 0;
  const reachedCount = data?.reachedCount ?? 0;

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-h1 text-[var(--ink)]">{MONTH_LABELS[month]}计划</h1>
          <p className="mt-1.5 font-sans text-caption text-[var(--ink-faint)]">{year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentMonth(now.getFullYear(), now.getMonth())}
            className="rounded-full border border-[var(--brand)] px-4 py-1.5 font-sans text-small text-[var(--brand)] hover:bg-[var(--brand)] hover:text-[var(--text-inverse)]"
          >
            本月
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <section className="card mb-6 flex items-center gap-5 rounded-xl p-5 sm:p-6">
        <ProgressRing percent={monthPercent} color="var(--brand)" />
        <div>
          <p className="font-sans text-small text-[var(--ink-faint)]">本月完成度</p>
          <p className="mt-1 font-sans text-h2 text-[var(--ink)]">
            {reachedCount}/{data?.goalCount ?? 0} 项目标达标
          </p>
          <p className="mt-1.5 font-sans text-caption text-[var(--ink-faint)]">进度按各目标百分比平均</p>
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-sans text-h2 text-[var(--ink)]">目标</h2>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--keyline)] px-3 py-1.5 font-sans text-small text-[var(--ink-soft)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
        >
          <Plus size={14} strokeWidth={1.75} />
          添加
        </button>
      </div>

      {goals.length === 0 ? (
        <QueryEmpty
          title="这个月还没有目标"
          hint="定一个可衡量的月目标，拆到每天，完成就能看见进度。"
          action={
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-md px-4 py-2 font-sans text-small text-[var(--text-inverse)]"
              style={{ background: 'var(--brand)' }}
            >
              制定本月目标
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onClick={() => navigate(`/plan/${goal.id}`)} />
          ))}
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
