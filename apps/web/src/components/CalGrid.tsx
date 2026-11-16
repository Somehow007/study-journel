import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { stateTextColor, useStateConfigs } from '../lib/stateUtils';
import { formatDate, getCalendarDays } from '../lib/dateUtils';
import { WEEKDAY_LABELS } from '../lib/constants';
import type { DayMark } from '../lib/types/api';

export type CalHeight = 'h60' | 'h72' | 'h86' | 'h112';

interface CalGridProps {
  /** YYYY-MM：决定展示哪一月 */
  period: string;
  /** 当月 DayMark（页面已取数则传入，避免重复请求） */
  marks?: DayMark[];
  /** 高亮格（.today 描边）：今日页传查看日期，日历页传真实今天 */
  highlightDate: string;
  /** 格子高度档，默认 h72；手机端统一压到 56px */
  heightClass?: CalHeight;
}

/**
 * nb-cal 月历格：日期 + 右上状态 + 左下时长 + 底部时长条（宽=时长/8h）。
 * 点格进入当天。今日页右栏小日历与日历页大月历共用。
 */
export default function CalGrid({ period, marks, highlightDate, heightClass = 'h72' }: CalGridProps) {
  const navigate = useNavigate();
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7)); // 1-based
  const stateConfigs = useStateConfigs();
  const realToday = formatDate(new Date());

  const markMap = useMemo(
    () => new Map((marks ?? []).map((m) => [m.date, m])),
    [marks],
  );
  const cfgById = useMemo(
    () => new Map(stateConfigs.map((c) => [c.id, c])),
    [stateConfigs],
  );
  const days = useMemo(() => getCalendarDays(year, month - 1), [year, month]);

  const monthStart = `${period}-01`;

  return (
    <div className={`nb-cal ${heightClass}`}>
      {WEEKDAY_LABELS.map((w) => (
        <div key={w} className="nb-cal-wk">
          {w}
        </div>
      ))}
      {days.map((d) => {
        if (!d.isCurrentMonth) {
          // 仅渲染月初前的补位空格；月末后补位直接省略
          return d.dateStr < monthStart ? <div key={d.dateStr} /> : null;
        }
        const mark = markMap.get(d.dateStr);
        const cfg = mark?.stateId ? cfgById.get(mark.stateId) : undefined;
        const isFuture = d.dateStr > realToday;
        const cls = [
          'nb-cal-cell',
          d.dateStr === highlightDate ? 'today' : '',
          isFuture ? 'future' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={d.dateStr}
            type="button"
            className={cls}
            onClick={() => navigate(`/day/${d.dateStr}`)}
            aria-label={d.dateStr}
          >
            <span className="nb-cal-d">{d.day}</span>
            {cfg && !isFuture && (
              <span className="nb-cal-state" style={{ color: stateTextColor(cfg) }}>
                {cfg.label}
              </span>
            )}
            {!isFuture && mark && mark.totalMin > 0 && (
              <>
                <span className="nb-cal-dur">
                  {(mark.totalMin / 60).toFixed(1)}
                  <small style={{ fontSize: 10, color: 'var(--ink-faint)' }}>h</small>
                </span>
                <span
                  className="nb-cal-bar"
                  style={{ width: `${Math.min(1, mark.totalMin / 480) * 80}%` }}
                />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
