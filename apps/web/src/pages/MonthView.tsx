import { useApp } from '../context/AppContext';
import { Link, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useDay, useDayMarks, useGoalsByPeriod } from '../lib/queries';
import { stateTextColor, useStateConfigs } from '../lib/stateUtils';
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
  const { data: goalMonth } = useGoalsByPeriod(period);
  const allStates = useStateConfigs();

  const todayStr = formatDate(new Date());
  const now = new Date();
  const isCurrentMonth = todayStr.startsWith(period);
  // 手机当日小计块：与今日页共用 day 缓存；只在当月拉取
  const { data: todayDay } = useDay(todayStr, isCurrentMonth);
  const todaySubjects = useMemo(() => {
    const seen = new Map<string, { name: string; color: string }>();
    for (const e of todayDay?.entries ?? []) {
      if (!seen.has(e.subjectId)) seen.set(e.subjectId, { name: e.subjectName, color: e.subjectColor });
    }
    return [...seen.values()];
  }, [todayDay]);

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
    const checklist = (goalMonth?.goals ?? []).filter((g) => g.type === 'CHECKLIST');
    return {
      done: checklist.reduce((s, g) => s + g.actualValue, 0),
      total: checklist.reduce((s, g) => s + g.totalValue, 0),
    };
  }, [goalMonth]);

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

        {/* 手机专用：日历下的当日小计（桌面右页已有本月小计，不重复） */}
        {isCurrentMonth && (
          <Link to={`/day/${todayStr}`} className="nb-mtoday">
            <span className="nb-sec">
              {todayStr.slice(5).replace('-', '.')} · 今天
              <span className="nb-sec-side nb-mono">
                {todayDay ? formatHM(todayDay.totalMin) : '—'}
              </span>
            </span>
            <span className="nb-mtoday-subj">
              {todaySubjects.length > 0
                ? todaySubjects.map((s) => (
                    <span key={s.name} style={{ color: s.color }}>
                      {s.name}
                    </span>
                  ))
                : todayDay && <span className="nb-mtoday-empty">今天还没有记录 · 去记一笔 →</span>}
            </span>
          </Link>
        )}
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
            <span style={{ color: stateTextColor(cfg) }}>{cfg.label}</span>
            <span className="nb-zheng" style={{ fontSize: 14 }}>
              {zheng(stateCounts.get(cfg.id) ?? 0) || '—'}
            </span>
          </div>
        ))}

        <div className="nb-sec">本月待办</div>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
          {/* 加载中与查询失败都显「—」，不把错误显示成真 0 */}
          {!goalMonth ? (
            '—'
          ) : (
            <>
              完成{' '}
              <b
                className="nb-hl"
                style={{ fontFamily: 'var(--font-num)', fontWeight: 700, fontSize: 17 }}
              >
                {taskTotals.done}
              </b>{' '}
              / {taskTotals.total} 项
            </>
          )}
        </p>
      </div>
    </div>
  );
}
