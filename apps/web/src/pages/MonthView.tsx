import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useDayMarks } from '../lib/queries';
import { useStateConfigs } from '../lib/stateUtils';
import { formatPeriod } from '../lib/goalApi';
import { monthBounds } from '../lib/domain';
import { formatDate } from '../lib/dateUtils';
import { EN_MONTHS, MONTH_LABELS } from '../lib/constants';
import CalGrid from '../components/CalGrid';
import { QueryError, QueryLoading } from '../components/QueryState';

/** 「正」字 tally：每 5 天一「正」，余数 用 一/丅/下/止 */
function zheng(n: number): string {
  if (n <= 0) return '';
  return '正'.repeat(Math.floor(n / 5)) + ['', '一', '丅', '下', '止'][n % 5];
}

export default function MonthView() {
  const navigate = useNavigate();
  const { currentMonth, setCurrentMonth, dailyGoalMin } = useApp();
  const { year, month } = currentMonth;

  const period = formatPeriod(year, month);
  const [from, to] = monthBounds(period);
  const { data: marks, isPending, error, refetch } = useDayMarks(from, to);
  const allStates = useStateConfigs();

  const todayStr = formatDate(new Date());
  const now = new Date();

  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setCurrentMonth(d.getFullYear(), d.getMonth());
  };

  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setCurrentMonth(d.getFullYear(), d.getMonth());
  };

  const goToday = () => {
    setCurrentMonth(now.getFullYear(), now.getMonth());
    navigate(`/day/${todayStr}`);
  };

  const summary = useMemo(() => {
    const list = marks ?? [];
    const recorded = list.filter(
      (m) => m.stateId || m.totalMin > 0 || m.entryCount > 0 || m.diaryPreview,
    );
    const totalMin = list.reduce((sum, m) => sum + m.totalMin, 0);
    const longest = list.reduce<(typeof list)[number] | null>(
      (best, m) => (best == null || m.totalMin > best.totalMin ? m : best),
      null,
    );
    return {
      days: recorded.length,
      totalMin,
      qualified: dailyGoalMin > 0 ? list.filter((m) => m.totalMin >= dailyGoalMin).length : 0,
      longest,
    };
  }, [marks, dailyGoalMin]);

  const stateCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of marks ?? []) {
      if (m.stateId) map.set(m.stateId, (map.get(m.stateId) ?? 0) + 1);
    }
    return map;
  }, [marks]);

  const taskTotals = useMemo(() => {
    const list = marks ?? [];
    return {
      done: list.reduce((s, m) => s + m.taskDone, 0),
      total: list.reduce((s, m) => s + m.taskTotal, 0),
    };
  }, [marks]);

  const formatHM = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  if (isPending && !marks) return <QueryLoading />;
  if (error && !marks) return <QueryError message={error.message} onRetry={() => void refetch()} />;

  const avgMin = summary.days > 0 ? Math.round(summary.totalMin / summary.days) : 0;
  const longestLabel = summary.longest
    ? `${formatHM(summary.longest.totalMin)} · ${summary.longest.date.slice(5).replace('-', '.')}`
    : '—';

  const sumRows: [string, string][] = [
    ['记录天数', `${summary.days} 天`],
    ['学习时长', formatHM(summary.totalMin)],
    ['日均', summary.days > 0 ? formatHM(avgMin) : '—'],
    ['达标天数', dailyGoalMin > 0 ? `${summary.qualified} / ${summary.days}` : '—'],
    ['最长单日', longestLabel],
  ];

  return (
    <div className="nb-book nb-side300">
      {/* 左页：月份大标题 + 翻页 + 大月历 */}
      <div className="nb-page l nb-gridbg">
        <div className="nb-date">
          <span className="nb-date-num">{MONTH_LABELS[month]}</span>
          <span className="nb-date-meta">
            {EN_MONTHS[month]} · {year}
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
            <button type="button" className="nb-btn r" onClick={goToday}>
              回到今天
            </button>
          </span>
        </div>

        <div style={{ marginTop: 22 }}>
          <CalGrid period={period} marks={marks} highlightDate={todayStr} heightClass="h112" />
        </div>
        <p className="nb-cal-hint">
          底部横线长度 = 当日时长 / 8h · 右上角为当日状态 · 点格子进入当天
          {(marks?.length ?? 0) === 0 ? ' · 这个月还没有记录' : ''}
        </p>
      </div>

      {/* 右页：本月小计 + 状态图例 + 本月待办 */}
      <div className="nb-page r nb-gridbg nb-narrow">
        <div className="nb-sec" style={{ marginTop: 6 }}>
          本月小计
        </div>
        <table className="nb-table">
          <tbody>
            {sumRows.map(([k, v]) => (
              <tr key={k}>
                <td
                  style={{
                    fontFamily: 'var(--font-title)',
                    color: 'var(--ink-soft)',
                    fontSize: 13,
                  }}
                >
                  {k}
                </td>
                <td className="nb-m" style={{ width: 'auto', whiteSpace: 'nowrap' }}>
                  {v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="nb-sec">状态图例</div>
        {allStates.map((cfg) => (
          <div className="nb-legend" key={cfg.id}>
            <span style={{ color: cfg.ink }}>{cfg.label}</span>
            <span className="nb-zheng" style={{ fontSize: 14 }}>
              {zheng(stateCounts.get(cfg.id) ?? 0) || '—'}
            </span>
          </div>
        ))}

        <div className="nb-sec">本月待办</div>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
          完成{' '}
          <b
            className="nb-hl"
            style={{ fontFamily: 'var(--font-num)', fontWeight: 700, fontSize: 17 }}
          >
            {taskTotals.done}
          </b>{' '}
          / {taskTotals.total} 项
        </p>
      </div>
    </div>
  );
}
