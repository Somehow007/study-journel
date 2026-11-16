import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useHeatmap } from '../lib/queries';
import { addDays, todayLocal, weekStartOf } from '../lib/domain';
import { formatDuration } from '../lib/dateUtils';

/** 展示周数：26 列 ≈ 半年，与考研备考节奏匹配 */
const WEEKS = 26;

/** 深浅档位 → ink 不透明度（level 1..5，0=无记录） */
const LEVEL_BG = [
  'transparent',
  'color-mix(in srgb, var(--ink) 16%, transparent)',
  'color-mix(in srgb, var(--ink) 34%, transparent)',
  'color-mix(in srgb, var(--ink) 58%, transparent)',
  'color-mix(in srgb, var(--ink) 82%, transparent)',
  'var(--ink)',
];

/**
 * 近 26 周学习热力图（GitHub 风周列网格，B 格纸化）。
 * 数据 = /stats/heatmap（仅含学习条目的日期）；深浅 = 当日时长 ÷ 每日目标，
 * 分 5 档；列起点按 setting.weekStartsOn 对齐；点格进入当天。
 */
export default function LearningHeatmap() {
  const navigate = useNavigate();
  const { dailyGoalMin, settings } = useApp();
  const weekStartsOn = settings?.weekStartsOn ?? 1;
  const today = todayLocal();
  const goalMin = dailyGoalMin > 0 ? dailyGoalMin : 360;

  // from = 当前周起点向前 25 周 → 恰好 26 列（最后一列为当周，含今天及未来空位）
  const from = useMemo(
    () => addDays(weekStartOf(today, weekStartsOn), -(WEEKS - 1) * 7),
    [today, weekStartsOn],
  );

  const { data: cells, isPending } = useHeatmap(from, today);

  const minByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cells ?? []) m.set(c.date, c.totalMin);
    return m;
  }, [cells]);

  const columns = useMemo(() => {
    const cols: { date: string | null; min: number }[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      const col: { date: string | null; min: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(from, w * 7 + d);
        col.push(
          date > today
            ? { date: null, min: 0 }
            : { date, min: minByDate.get(date) ?? 0 },
        );
      }
      cols.push(col);
    }
    return cols;
  }, [from, today, minByDate]);

  // 月标签：取每列首日（周起点）所在月，月变化处标注；与上一个标签相距不足 3 列时
  // 让位给新月份（首列常是只露一两周的残月，否则两个标签会粘连）
  const monthLabels = useMemo(() => {
    const labels: (string | null)[] = [];
    let prev = '';
    let lastIdx = -1;
    columns.forEach((col, i) => {
      const month = (col[0]?.date ?? '').slice(5, 7);
      if (month === prev) {
        labels.push(null);
        return;
      }
      if (lastIdx >= 0 && i - lastIdx < 3) labels[lastIdx] = null;
      labels.push(`${Number(month)}月`);
      prev = month;
      lastIdx = i;
    });
    return labels;
  }, [columns]);

  const levelOf = (min: number) => {
    if (min <= 0) return 0;
    return Math.min(5, Math.max(1, Math.ceil((min / goalMin) * 5)));
  };

  return (
    <div className="nb-heatmap">
      <div className="nb-sec">
        近 {WEEKS} 周学习热力
        <span className="nb-sec-side">
          深浅 = 当日时长 ÷ {formatDuration(goalMin)} · 点格进入当天
        </span>
      </div>
      {isPending ? (
        <p className="nb-empty-hint">载入中…</p>
      ) : (
        <>
          <div className="nb-heatmap-months" aria-hidden>
            {monthLabels.map((label, i) => (
              <span key={i}>{label ?? ''}</span>
            ))}
          </div>
          <div className="nb-heatmap-grid">
            {columns.flatMap((col, w) =>
              col.map((cell, d) => {
                if (!cell.date) {
                  return <i key={`${w}-${d}`} className="nb-heatmap-empty" />;
                }
                const lv = levelOf(cell.min);
                const label =
                  cell.min > 0 ? `${cell.date} · ${formatDuration(cell.min)}` : `${cell.date} · 无记录`;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    className={`nb-heatmap-cell${cell.date === today ? ' today' : ''}`}
                    style={{ background: LEVEL_BG[lv] }}
                    title={label}
                    aria-label={label}
                    onClick={() => navigate(`/day/${cell.date}`)}
                  />
                );
              }),
            )}
          </div>
          <div className="nb-heatmap-legend">
            <span>少</span>
            {LEVEL_BG.slice(1).map((bg, i) => (
              <i key={i} style={{ background: bg }} />
            ))}
            <span>多</span>
          </div>
        </>
      )}
    </div>
  );
}
