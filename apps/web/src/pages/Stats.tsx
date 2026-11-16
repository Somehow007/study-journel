import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDayMarks, useStatsMonth, useStates } from '../lib/queries';
import { findStateConfig, type StateConfig } from '../lib/stateUtils';
import { formatPeriod } from '../lib/goalApi';
import { monthBounds } from '../lib/domain';
import { formatDuration, formatDate, getCalendarDays } from '../lib/dateUtils';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import type { JournalState } from '../lib/types/api';

/** 「正」字 tally：每 5 天一「正」，余数 用 一/丅/下/止 */
function zheng(n: number): string {
  if (n <= 0) return '';
  return '正'.repeat(Math.floor(n / 5)) + ['', '一', '丅', '下', '止'][n % 5];
}

export default function Stats() {
  const navigate = useNavigate();
  const { dailyGoalMin } = useApp();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const period = formatPeriod(viewYear, viewMonth);
  const [from, to] = monthBounds(period);
  const { data: stats, isPending, error, refetch } = useStatsMonth(period);
  const { data: marks } = useDayMarks(from, to);
  const { data: states } = useStates();

  const prevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
  };

  const nextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
  };

  const stateCfgById = useMemo(() => {
    const list: JournalState[] = states ?? [];
    const map = new Map<string, StateConfig>();
    for (const s of list) {
      const cfg = findStateConfig(list, s.id);
      if (cfg) map.set(s.id, cfg);
    }
    return map;
  }, [states]);

  const today = formatDate(new Date());

  /** 当月全部日期 → totalMin（marks 全量覆盖，缺日补 0） */
  const days = useMemo(() => {
    const markMap = new Map((marks ?? []).map((m) => [m.date, m.totalMin]));
    const calDays = getCalendarDays(viewYear, viewMonth).filter((d) => d.isCurrentMonth);
    return calDays.map((d) => ({
      dateStr: d.dateStr,
      day: d.day,
      min: markMap.get(d.dateStr) ?? 0,
      isToday: d.dateStr === today,
      isFuture: d.dateStr > today,
    }));
  }, [marks, viewYear, viewMonth, today]);

  const maxDayMin = useMemo(() => Math.max(0, ...days.map((d) => d.min)), [days]);
  const scaleMax = Math.max(dailyGoalMin, maxDayMin, 1);

  /** 最长连续学习天数（totalMin>0） */
  const longestStreak = useMemo(() => {
    let best = 0;
    let cur = 0;
    for (const d of days) {
      if (d.min > 0) {
        cur += 1;
        best = Math.max(best, cur);
      } else {
        cur = 0;
      }
    }
    return best;
  }, [days]);

  const totalDays = stats?.daysRecorded ?? 0;
  const totalMin = stats?.totalMin ?? 0;
  const avgMin = totalDays > 0 ? Math.round(totalMin / totalDays) : 0;
  const subjectTotal = (stats?.subjectBreakdown ?? []).reduce((a, s) => a + s.minutes, 0);
  const hasData = totalDays > 0 || (stats?.entryCount ?? 0) > 0 || totalMin > 0;

  const goalPct = Math.min(100, (dailyGoalMin / scaleMax) * 100);

  if (isPending && !stats) return <QueryLoading />;
  if (error && !stats) return <QueryError message={error.message} onRetry={() => void refetch()} />;

  return (
    <div className={hasData ? 'nb-book' : 'nb-book nb-single'}>
      {/* 左页：KV + 每日时长柱状 */}
      <div className="nb-page l nb-gridbg">
        <div className="nb-date">
          <span className="nb-date-num">统计</span>
          <span className="nb-date-meta">
            {viewYear} 年 {viewMonth + 1} 月
            <br />
            按学习时长
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="nb-chip on" style={{ cursor: 'default' }}>
              月
            </span>
            <button
              type="button"
              className="nb-chip"
              onClick={() => navigate(`/annual?year=${viewYear}`)}
            >
              年度
            </button>
            <span className="nb-pager">
              <button type="button" onClick={prevMonth} aria-label="上个月">
                ‹
              </button>
              <b>{period.replace('-', '.')}</b>
              <button type="button" onClick={nextMonth} aria-label="下个月">
                ›
              </button>
            </span>
          </span>
        </div>

        {!hasData ? (
          <QueryEmpty
            title="这个月还没有记录"
            hint="记下第一天后，这里会出现时长与状态统计"
            action={
              <button
                type="button"
                className="nb-btn p"
                onClick={() => navigate(`/day/${today}`)}
              >
                去记第一天
              </button>
            }
          />
        ) : (
          <>
            <div className="nb-kv" style={{ marginTop: 22 }}>
              <div>
                <small>总时长</small>
                <b>{formatDuration(totalMin)}</b>
              </div>
              <div>
                <small>学习天数</small>
                <b>{totalDays} 天</b>
              </div>
              <div>
                <small>日均</small>
                <b>{formatDuration(avgMin)}</b>
              </div>
              <div>
                <small>最长连续</small>
                <b>{longestStreak} 天</b>
              </div>
            </div>

            <div className="nb-sec">
              每日学习时长
              <span className="nb-sec-side">
                红线 = 每日目标 {formatDuration(dailyGoalMin)} · 点柱进入当天
              </span>
            </div>
            <div className="nb-bars">
              <div
                className="nb-bars-goal"
                style={{ bottom: `${goalPct}%` }}
                title={`每日目标 ${formatDuration(dailyGoalMin)}`}
              />
              {days.map((d) => {
                const pct = d.min > 0 ? (d.min / scaleMax) * 100 : 0;
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    className="nb-bar-col"
                    onClick={() => navigate(`/day/${d.dateStr}`)}
                    aria-label={`${d.dateStr} ${formatDuration(d.min)}`}
                  >
                    {!d.isFuture && d.min > 0 && (
                      <span
                        className={`nb-bar${d.isToday ? ' today' : ''}`}
                        style={{ height: `${Math.max(4, pct)}%` }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="nb-bars-labels">
              {days.map((d) => (
                <span key={d.dateStr} className="nb-bar-label">
                  {d.day === 1 || d.day % 5 === 0 ? d.day : ''}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 右页：学科分布 + 状态记数 */}
      {hasData && (
        <div className="nb-page r nb-gridbg">
          <div className="nb-sec" style={{ marginTop: 4 }}>
            学科分布
            <span className="nb-sec-side nb-mono">{formatDuration(totalMin)}</span>
          </div>
          {(stats?.subjectBreakdown ?? []).length === 0 ? (
            <p className="nb-empty-hint">本月无学习记录</p>
          ) : (
            <table className="nb-table">
              <thead>
                <tr>
                  <th className="nb-k">科目</th>
                  <th>占比</th>
                  <th className="nb-m" style={{ textAlign: 'right' }}>
                    时长
                  </th>
                </tr>
              </thead>
              <tbody>
                {(stats?.subjectBreakdown ?? []).map((s) => {
                  const pct = subjectTotal > 0 ? (s.minutes / subjectTotal) * 100 : 0;
                  const cells = Array.from({ length: 20 }, (_, i) => i < Math.round((pct / 100) * 20));
                  return (
                    <tr key={s.subjectId}>
                      <td className="nb-k" style={{ color: s.color, paddingTop: 12 }}>
                        {s.name}
                      </td>
                      <td>
                        <div className="nb-meter">
                          {cells.map((f, i) => (
                            <span key={i} className={f ? 'f' : ''} />
                          ))}
                        </div>
                        <small>{Math.round(pct)}%</small>
                      </td>
                      <td className="nb-m">{formatDuration(s.minutes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="nb-sec">状态记数</div>
          {(stats?.stateBreakdown ?? []).length === 0 ? (
            <p className="nb-empty-hint">本月没有状态记录</p>
          ) : (
            <table className="nb-table">
              <tbody>
                {(stats?.stateBreakdown ?? []).map((s) => {
                  const cfg = stateCfgById.get(s.stateId);
                  const neg = cfg ? cfg.polarity < 0 : false;
                  return (
                    <tr key={s.stateId}>
                      <td
                        className="nb-k"
                        style={{
                          width: 90,
                          color: neg ? 'var(--ink-faint)' : 'var(--brand)',
                          fontWeight: 700,
                        }}
                      >
                        {s.label}
                      </td>
                      <td>
                        <span className="nb-zheng">{zheng(s.count) || '—'}</span>
                      </td>
                      <td className="nb-m">{s.count} 天</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
