import { useState, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useExportData } from '../lib/queries';
import { findStateConfig, type StateConfig } from '../lib/stateUtils';
import { countStreak, todayLocal } from '../lib/domain';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import type { ExportData, JournalState } from '../lib/types/api';

const CN_DIGITS = '〇一二三四五六七八九';
function yearToCn(year: number): string {
  return String(year)
    .split('')
    .map((d) => CN_DIGITS[Number(d)] ?? d)
    .join('');
}

function hours1(min: number): number {
  return Math.round((min / 60) * 10) / 10;
}

interface YearStats {
  totalDays: number;
  totalMin: number;
  topStateId: string | null;
  longestStreak: number;
  monthlyData: { month: number; days: number; hours: number }[];
  /** 每月每日学习分钟：monthMins[m][d-1] */
  monthMins: number[][];
  subjectData: { name: string; hours: number; color: string; minutes: number }[];
}

function buildYearStats(data: ExportData, year: number, isCurrentYear: boolean): YearStats {
  const prefix = `${year}-`;
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));

  // 有记录日期 = day 行有 state/diary，或当日有 entries（与服务端 streak 口径一致）
  const recorded = new Set<string>();
  const stateIdByDate = new Map<string, string>();
  for (const d of data.days) {
    if (!d.date.startsWith(prefix)) continue;
    if (d.stateId || d.diary.trim()) {
      recorded.add(d.date);
      if (d.stateId) stateIdByDate.set(d.date, d.stateId);
    }
  }

  const entries = data.entries.filter((e) => e.date.startsWith(prefix));
  for (const e of entries) recorded.add(e.date);
  const totalMin = entries.reduce((sum, e) => sum + e.durationMin, 0);

  // 状态计数 → 最常状态
  const stateCount = new Map<string, number>();
  for (const [date, sid] of stateIdByDate) {
    if (recorded.has(date)) stateCount.set(sid, (stateCount.get(sid) ?? 0) + 1);
  }
  let topStateId: string | null = null;
  let topCount = 0;
  for (const [sid, count] of stateCount) {
    if (count > topCount) {
      topCount = count;
      topStateId = sid;
    }
  }

  // 月度桶 + 热力明细
  const monthMins: number[][] = Array.from({ length: 12 }, (_, m) =>
    Array.from({ length: new Date(year, m + 1, 0).getDate() }, () => 0),
  );
  const monthlyMin = Array.from({ length: 12 }, () => 0);
  const monthlyDays = Array.from({ length: 12 }, () => 0);
  for (const date of recorded) {
    monthlyDays[parseInt(date.slice(5, 7), 10) - 1]++;
  }
  for (const e of entries) {
    const m = parseInt(e.date.slice(5, 7), 10) - 1;
    const d = parseInt(e.date.slice(8, 10), 10) - 1;
    monthlyMin[m] += e.durationMin;
    if (monthMins[m] && d >= 0 && d < monthMins[m].length) monthMins[m][d] += e.durationMin;
  }

  const monthlyData = monthlyMin.map((min, m) => ({
    month: m,
    days: monthlyDays[m],
    hours: hours1(min),
  }));

  // 最长连续：年内记录日期 + 游标（当年→今天；往年→12-31）
  const cursor = isCurrentYear ? todayLocal() : `${year}-12-31`;
  const longestStreak = countStreak([...recorded].filter((d) => d.startsWith(prefix)), cursor);

  // 学科分布
  const subjMap = new Map<string, { name: string; color: string; minutes: number }>();
  for (const e of entries) {
    const subj = subjectById.get(e.subjectId);
    const key = e.subjectId;
    const cur = subjMap.get(key) ?? {
      name: subj?.name ?? '—',
      color: subj?.color ?? 'var(--keyline)',
      minutes: 0,
    };
    cur.minutes += e.durationMin;
    subjMap.set(key, cur);
  }
  const subjectData = [...subjMap.values()]
    .map((s) => ({ ...s, hours: hours1(s.minutes) }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    totalDays: recorded.size,
    totalMin,
    topStateId,
    longestStreak,
    monthlyData,
    monthMins,
    subjectData,
  };
}

function HeatMonth({
  year,
  month,
  minutes,
  hours,
  isCurrentYear,
  today,
}: {
  year: number;
  month: number; // 0-based
  minutes: number[];
  hours: number;
  isCurrentYear: boolean;
  today: string;
}) {
  const daysInMonth = minutes.length;
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: ReactNode[] = [];
  for (let i = 0; i < offset; i++) cells.push(<i key={`o${i}`} />);
  for (let d = 0; d < daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
    const future = isCurrentYear && date > today;
    const min = minutes[d];
    const bg = future || min <= 0
      ? 'transparent'
      : min < 200
        ? 'color-mix(in srgb, var(--ink) 20%, transparent)'
        : min < 340
          ? 'color-mix(in srgb, var(--ink) 53%, transparent)'
          : 'var(--ink)';
    cells.push(
      <i
        key={d}
        style={{
          background: bg,
          border: future ? '1px solid var(--hairline)' : '1px solid transparent',
        }}
      />,
    );
  }
  return (
    <div className="nb-heat-m">
      <div className="nb-heat-mh">
        {month + 1} 月 <span className="nb-mono">{hours ? `${hours}h` : ''}</span>
      </div>
      <div className="nb-heat-g">{cells}</div>
    </div>
  );
}

export default function AnnualReview() {
  const [searchParams] = useSearchParams();
  const now = new Date();
  const initialYear = parseInt(searchParams.get('year') ?? '') || now.getFullYear();
  const [viewYear, setViewYear] = useState(initialYear);

  const { data: exportData, isPending, error, refetch } = useExportData();

  const isCurrentYear = viewYear === now.getFullYear();
  const today = todayLocal();
  const prevYear = () => setViewYear((v) => v - 1);
  const nextYear = () => setViewYear((v) => v + 1);

  const stats = useMemo<YearStats | null>(() => {
    if (!exportData) return null;
    return buildYearStats(exportData, viewYear, isCurrentYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportData, viewYear, isCurrentYear]);

  const stateList: JournalState[] = exportData?.states ?? [];
  const cfgMap = useMemo(() => {
    const map = new Map<string, StateConfig>();
    for (const s of stateList) {
      const cfg = findStateConfig(stateList, s.id);
      if (cfg) map.set(s.id, cfg);
    }
    return map;
  }, [stateList]);

  const topStateCfg = stats?.topStateId ? cfgMap.get(stats.topStateId) : undefined;
  const hasData = (stats?.totalDays ?? 0) > 0;
  const subjectTotal = (stats?.subjectData ?? []).reduce((s, x) => s + x.minutes, 0);
  const maxMonthH = Math.max(...(stats?.monthlyData.map((m) => m.hours) ?? [0]), 0.1);

  if (isPending && !exportData) return <QueryLoading />;
  if (error && !exportData) return <QueryError message={error.message} onRetry={() => void refetch()} />;
  if (!stats) return null;

  if (!hasData) {
    return (
      <div className="nb-book nb-single">
        <div className="nb-page single nb-gridbg">
          <div className="nb-date">
            <span className="nb-date-num">{yearToCn(viewYear)}</span>
            <span className="nb-date-meta">
              年度回顾
              <br />
              ANNUAL REVIEW
            </span>
            <span style={{ marginLeft: 'auto' }}>
              <span className="nb-pager">
                <button type="button" onClick={prevYear} aria-label="上一年">
                  ‹
                </button>
                <b>{viewYear}</b>
                <button
                  type="button"
                  onClick={nextYear}
                  disabled={isCurrentYear}
                  aria-label="下一年"
                >
                  ›
                </button>
              </span>
            </span>
          </div>
          <QueryEmpty
            title={`${viewYear}年还没有记录`}
            hint={isCurrentYear ? '从今天开始记录，年末时这里会汇总全年数据' : '查看其他年份吧'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="nb-book">
      {/* 左页：年度数字 + 月度柱图 + 学科分布 */}
      <div className="nb-page l nb-gridbg">
        <div className="nb-date">
          <span className="nb-date-num">{yearToCn(viewYear)}</span>
          <span className="nb-date-meta">
            年度回顾
            <br />
            ANNUAL REVIEW
          </span>
          <span style={{ marginLeft: 'auto' }}>
            <span className="nb-pager">
              <button type="button" onClick={prevYear} aria-label="上一年">
                ‹
              </button>
              <b>{viewYear}</b>
              <button
                type="button"
                onClick={nextYear}
                disabled={isCurrentYear}
                aria-label="下一年"
              >
                ›
              </button>
            </span>
          </span>
        </div>

        <div className="nb-kv" style={{ marginTop: 22 }}>
          <div>
            <small>总时长</small>
            <b>{hours1(stats.totalMin)} h</b>
          </div>
          <div>
            <small>学习天数</small>
            <b>{stats.totalDays} 天</b>
          </div>
          <div>
            <small>最长连续</small>
            <b>{stats.longestStreak} 天</b>
          </div>
          <div>
            <small>最常状态</small>
            <b style={{ fontSize: 20 }}>{topStateCfg?.label ?? '—'}</b>
          </div>
        </div>

        <div className="nb-sec">月度学习时长</div>
        <div className="nb-ybars">
          {stats.monthlyData.map((m) => (
            <div className="nb-ybar-col" key={m.month}>
              <span className="nb-ybar-val">{m.hours ? m.hours : ''}</span>
              <div
                className="nb-ybar"
                style={{
                  height: `${(m.hours / maxMonthH) * 180}px`,
                  background: m.hours > 0 && m.hours === maxMonthH ? 'var(--brand)' : 'var(--ink)',
                }}
              />
            </div>
          ))}
        </div>
        <div className="nb-ymonths">
          {stats.monthlyData.map((m) => (
            <span key={m.month}>{m.month + 1}</span>
          ))}
        </div>

        <div className="nb-sec">年度学科分布</div>
        {stats.subjectData.length === 0 ? (
          <p className="nb-empty-hint">全年无学习记录</p>
        ) : (
          <table className="nb-table">
            <tbody>
              {stats.subjectData.map((s) => {
                const pct = subjectTotal > 0 ? (s.minutes / subjectTotal) * 100 : 0;
                const cells = Array.from({ length: 20 }, (_, i) => i < Math.round((pct / 100) * 20));
                return (
                  <tr key={s.name}>
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
                    <td className="nb-m">{s.hours} h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 右页：12 个月热力格 */}
      <div className="nb-page r nb-gridbg">
        <div className="nb-sec" style={{ marginTop: 4 }}>
          全年 12 个月<span className="nb-sec-side">格子越深学得越久</span>
        </div>
        <div className="nb-heat-grid">
          {stats.monthlyData.map((m) => (
            <HeatMonth
              key={m.month}
              year={viewYear}
              month={m.month}
              minutes={stats.monthMins[m.month]}
              hours={m.hours}
              isCurrentYear={isCurrentYear}
              today={today}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
