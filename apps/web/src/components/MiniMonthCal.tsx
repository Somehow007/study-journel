import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDayMarks } from '../lib/queries';
import { useStateConfigs } from '../lib/stateUtils';
import { monthBounds } from '../lib/domain';
import { formatDate, getCalendarDays } from '../lib/dateUtils';
import { WEEKDAY_LABELS } from '../lib/constants';

interface MiniMonthCalProps {
  /** YYYY-MM-DD：决定展示哪一月；格子点击进入当天 */
  date: string;
}

/**
 * 月内小日历（nb-cal）：格子 = 日期 + 右上状态 + 左下时长 + 底部时长条。
 * 今日页右页"本月"用；日历页后续可复用。
 */
export default function MiniMonthCal({ date }: MiniMonthCalProps) {
  const navigate = useNavigate();
  const period = date.slice(0, 7);
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7)); // 1-based
  const [from, to] = monthBounds(period);
  const { data: marks } = useDayMarks(from, to, true);
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
    <div className="nb-cal">
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
          d.dateStr === date ? 'today' : '',
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
            {d.day}
            {cfg && !isFuture && (
              <span className="nb-cal-state" style={{ color: cfg.ink }}>
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
