import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getRecordsByYear } from '../lib/api';
import { useApiQuery } from '../lib/useApiQuery';
import { parseDate, formatDuration } from '../lib/dateUtils';
import { WEEKDAY_LABELS, MONTH_LABELS } from '../lib/constants';
import { useAllMoodConfigs } from '../lib/moodUtils';
import { useIsDark } from '../lib/useIsDark';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import type { DayRecord } from '../types';

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*`~\-|[\](){}>]/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupByMonth(records: DayRecord[]): { key: string; label: string; items: DayRecord[] }[] {
  const map = new Map<string, DayRecord[]>();
  for (const r of records) {
    const key = r.date.slice(0, 7);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const monthIdx = parseInt(key.slice(5, 7), 10) - 1;
      return { key, label: MONTH_LABELS[monthIdx] ?? key, items };
    });
}

export default function Memory() {
  const navigate = useNavigate();
  const isDark = useIsDark();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const { data: records, loading, error, refresh } = useApiQuery(
    async () => (await getRecordsByYear(viewYear)).slice().reverse(),
    [viewYear],
  );
  const allMoods = useAllMoodConfigs();
  const moodCfgMap = useMemo(() => {
    const map = new Map<string, (typeof allMoods)[0]>();
    for (const cfg of allMoods) map.set(cfg.type, cfg);
    return map;
  }, [allMoods]);

  const groups = useMemo(() => groupByMonth(records ?? []), [records]);

  if (loading && !records) return <QueryLoading />;
  if (error && !records) return <QueryError message={error.message} onRetry={refresh} />;

  return (
    <div className="animate-fade-up" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-h1 text-[var(--ink)]">时光</h1>
          <p className="mt-1 font-sans text-caption text-[var(--ink-soft)]">按时间线回顾每一天</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewYear((y) => y - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)]"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[64px] text-center font-sans text-small text-[var(--ink)]">{viewYear}</span>
          <button
            onClick={() => setViewYear((y) => Math.min(now.getFullYear(), y + 1))}
            disabled={viewYear >= now.getFullYear()}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--keyline)] text-[var(--ink-soft)] disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {groups.length > 0 ? (
        <div className="flex flex-col gap-10">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-4 font-sans text-title text-[var(--ink-soft)]">
                {viewYear} 年 {group.label}
              </h2>
              <div className="relative flex flex-col gap-[26px]">
                <div
                  className="absolute bottom-0 left-[78px] top-0 w-px"
                  style={{ background: 'var(--hairline)' }}
                  aria-hidden="true"
                />
                {group.items.map((record) => {
                  const cfg = record.mood ? moodCfgMap.get(record.mood) : undefined;
                  const date = parseDate(record.date);
                  const month = date.getMonth() + 1;
                  const day = date.getDate();
                  const weekdayIndex = (date.getDay() + 6) % 7;
                  const weekday = `周${WEEKDAY_LABELS[weekdayIndex]}`;
                  const dayLabel = `${month}/${day}`;
                  const solid = cfg ? (isDark ? cfg.dark.solid : cfg.solid) : 'var(--keyline)';
                  const tint = cfg ? (isDark ? cfg.dark.tint : cfg.tint) : 'transparent';

                  return (
                    <article key={record.date} className="relative flex items-start">
                      <div className="w-14 shrink-0 pt-[22px] pr-4 text-right">
                        <div className="font-mono text-num text-[var(--ink)]">{dayLabel}</div>
                        <div className="mt-0.5 font-sans text-caption text-[var(--ink-faint)]">{weekday}</div>
                      </div>
                      <div className="relative z-10 flex w-11 shrink-0 justify-center pt-[22px]">
                        <span
                          className="block h-2 w-2 rounded-full"
                          style={{ background: solid, boxShadow: cfg ? `0 0 0 4px ${tint}` : undefined }}
                          aria-hidden="true"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/day/${record.date}`)}
                        className="card flex-1 rounded-xl px-[28px] py-5 text-left transition-shadow duration-200 hover:shadow-2"
                        style={{ boxShadow: 'var(--shadow-1)' }}
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: solid }} />
                            {cfg && (
                              <span
                                className="inline-flex items-center rounded-full px-2.5 py-1 font-sans text-caption"
                                style={{
                                  background: isDark ? cfg.dark.tint : cfg.tint,
                                  color: isDark ? cfg.dark.ink : cfg.ink,
                                }}
                              >
                                {cfg.label}
                              </span>
                            )}
                          </div>
                          {record.learnings.length > 0 && (
                            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                              {record.learnings.map((l) => (
                                <span
                                  key={l.id}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--keyline)] bg-[var(--card)] px-2.5 py-1 font-sans text-caption text-[var(--ink-soft)]"
                                >
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                                  <span>{l.subject}</span>
                                  <span className="font-mono text-caption text-[var(--ink-faint)]">
                                    {formatDuration(l.durationMin)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {record.diary && (
                          <p className="line-clamp-3 font-sans text-small leading-[1.8] text-[var(--ink-soft)]">
                            {stripMarkdown(record.diary)}
                          </p>
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <QueryEmpty title="这一年还没有记录" hint="从今天开始写，这里会按月份排成时间线" />
      )}
    </div>
  );
}
