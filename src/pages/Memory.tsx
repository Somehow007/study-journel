import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { parseDate, totalDuration, formatDuration } from '../lib/dateUtils';
import { WEEKDAY_LABELS } from '../lib/constants';
import { useAllMoodConfigs } from '../lib/moodUtils';
import { useIsDark } from '../lib/useIsDark';
import Flower from '../components/Flower';
import type { DayRecord } from '../types';

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*`~\-|[\](){}>]/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function Memory() {
  const isDark = useIsDark();
  const allRecords = useLiveQuery(() => db.records.orderBy('date').reverse().toArray(), []);
  const allMoods = useAllMoodConfigs();
  const moodCfgMap = useMemo(() => {
    const map = new Map<string, typeof allMoods[0]>();
    for (const cfg of allMoods) map.set(cfg.type, cfg);
    return map;
  }, [allMoods]);

  return (
    <div className="animate-fade-up" style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* 页眉 */}
      <header className="mb-8">
        <h1 className="font-serif text-h1 text-[var(--ink)]">时光</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3">
          <span className="font-sans text-caption text-[var(--ink-soft)]">每一天都留了一朵花</span>
          <span className="font-displaylatin italic text-caption text-[var(--ink-faint)]">
            pressed flowers, kept days.
          </span>
        </div>
      </header>

      {allRecords && allRecords.length > 0 ? (
        <div className="relative flex flex-col gap-[26px]">
          {/* 时间轴纵线 */}
          <div
            className="absolute left-[78px] top-0 bottom-0 w-px"
            style={{ background: 'var(--hairline)' }}
            aria-hidden="true"
          />

          {allRecords.map((record, i) => {
            const cfg = record.mood ? moodCfgMap.get(record.mood) : undefined;
            const date = parseDate(record.date);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const weekdayIndex = (date.getDay() + 6) % 7;
            const weekday = `周${WEEKDAY_LABELS[weekdayIndex]}`;
            const dayLabel = `${month}/${day}`;
            const delay = `${Math.min(i, 12) * 60}ms`;

            return (
              <article
                key={record.date}
                className="animate-fade-up relative flex items-start"
                style={{ animationDelay: delay }}
              >
                {/* 左列：日期 */}
                <div className="w-14 shrink-0 pt-[22px] pr-4 text-right">
                  <div className="font-mono text-num text-[var(--ink)]">{dayLabel}</div>
                  <div className="mt-0.5 font-sans text-caption text-[var(--ink-faint)]">{weekday}</div>
                </div>

                {/* 时间轴节点 */}
                <div className="relative z-10 w-11 shrink-0 flex justify-center pt-[22px]">
                  <span
                    className="block h-2 w-2 rounded-full"
                    style={
                      cfg
                        ? {
                            background: isDark ? cfg.dark.solid : cfg.solid,
                            boxShadow: `0 0 0 4px ${isDark ? cfg.dark.tint : cfg.tint}`,
                          }
                        : { background: 'var(--keyline)' }
                    }
                    aria-hidden="true"
                  />
                </div>

                {/* 记录卡 */}
                <div
                  className="card flex-1 rounded-xl px-[28px] py-5 transition-shadow duration-200"
                  style={{ boxShadow: 'var(--shadow-1)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-1)';
                  }}
                >
                  {/* 首行：花头 + 心情胶囊 + 学科胶囊 */}
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      {cfg ? (
                        <Flower mood={cfg} size={24} variant="head" />
                      ) : (
                        <Flower mood={null} size={24} />
                      )}
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
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: l.color }}
                              aria-hidden="true"
                            />
                            <span>{l.subject}</span>
                            <span className="font-mono text-caption text-[var(--ink-faint)]">
                              {formatDuration(l.durationMin)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 日记摘录 */}
                  {record.diary && (
                    <p className="line-clamp-3 font-serif text-small leading-[1.8] text-[var(--ink-soft)]">
                      {stripMarkdown(record.diary)}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* 空状态 */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Flower mood={null} size={64} />
          <h2 className="mt-6 font-serif text-h2 text-[var(--ink-soft)]">
            还没有记忆。每天种一朵花，这里会长成你的小径
          </h2>
        </div>
      )}
    </div>
  );
}
