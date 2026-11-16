import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExportData, useStates } from '../lib/queries';
import { findStateConfig, stateTextColor, type StateConfig } from '../lib/stateUtils';
import { parseDate, formatDuration } from '../lib/dateUtils';
import { WEEKDAY_LABELS } from '../lib/constants';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import type { ExportData, JournalState } from '../lib/types/api';

const DIARY_ONLY_KEY = 'study-journal-memory-diary-only';

function readDiaryOnly(): boolean {
  try {
    return localStorage.getItem(DIARY_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*`~\-|[\](){}>]/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

interface MemEntry {
  id: string;
  subjectName: string;
  subjectColor: string;
  durationMin: number;
}

interface MemItem {
  date: string;
  stateId: string | null;
  diary: string;
  entries: MemEntry[];
  totalMin: number;
}

/** 由 v3 导出数据派生「按日」视图：day 行（state/diary）+ 当日 entries */
function buildMemItems(data: ExportData): MemItem[] {
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  const dayByDate = new Map(data.days.map((d) => [d.date, d]));
  const entriesByDate = new Map<string, MemEntry[]>();
  for (const e of data.entries) {
    const subj = subjectById.get(e.subjectId);
    const list = entriesByDate.get(e.date) ?? [];
    list.push({
      id: e.id,
      subjectName: subj?.name ?? '—',
      subjectColor: subj?.color ?? 'var(--keyline)',
      durationMin: e.durationMin,
    });
    entriesByDate.set(e.date, list);
  }

  const dates = new Set<string>();
  for (const d of data.days) {
    if (d.stateId || d.diary.trim()) dates.add(d.date);
  }
  for (const e of data.entries) dates.add(e.date);

  const items: MemItem[] = [];
  for (const date of dates) {
    const day = dayByDate.get(date);
    const entries = entriesByDate.get(date) ?? [];
    items.push({
      date,
      stateId: day?.stateId ?? null,
      diary: day?.diary ?? '',
      entries,
      totalMin: entries.reduce((sum, e) => sum + e.durationMin, 0),
    });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export default function Memory() {
  const navigate = useNavigate();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [diaryOnly, setDiaryOnly] = useState(readDiaryOnly);

  const { data: exportData, isPending, error, refetch } = useExportData();
  const { data: states } = useStates();

  const items = useMemo(() => {
    if (!exportData) return [] as MemItem[];
    return buildMemItems(exportData).filter((r) => r.date.startsWith(`${viewYear}-`));
  }, [exportData, viewYear]);

  const stateCfgMap = useMemo(() => {
    const map = new Map<string, StateConfig>();
    const list: JournalState[] = states ?? exportData?.states ?? [];
    for (const s of list) {
      const cfg = findStateConfig(list, s.id);
      if (cfg) map.set(s.id, cfg);
    }
    return map;
  }, [states, exportData]);

  const visible = useMemo(
    () => (diaryOnly ? items.filter((r) => r.diary.trim()) : items),
    [items, diaryOnly],
  );

  const toggleDiaryOnly = () => {
    setDiaryOnly((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DIARY_ONLY_KEY, next ? '1' : '0');
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  };

  if (isPending && !exportData) return <QueryLoading />;
  if (error && !exportData) return <QueryError message={error.message} onRetry={() => void refetch()} />;

  return (
    <div className="nb-book nb-single">
      <div className="nb-page single nb-gridbg nb-memory">
        <div className="nb-date nb-memory-head">
          <span className="nb-date-num">时光</span>
          <span className="nb-date-meta">按时间线回顾每一天</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 18, alignItems: 'center' }}>
            <button
              type="button"
              className={`nb-chip${diaryOnly ? ' on' : ''}`}
              onClick={toggleDiaryOnly}
              aria-pressed={diaryOnly}
            >
              只看有想法
            </button>
            <span className="nb-pager">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                aria-label="上一年"
              >
                ‹
              </button>
              <b>{viewYear}</b>
              <button
                type="button"
                onClick={() => setViewYear((y) => Math.min(now.getFullYear(), y + 1))}
                disabled={viewYear >= now.getFullYear()}
                aria-label="下一年"
              >
                ›
              </button>
            </span>
          </span>
        </div>

        {visible.length === 0 ? (
          <QueryEmpty
            title={diaryOnly ? '这一年还没有写过今日想法' : '这一年还没有记录'}
            hint={
              diaryOnly
                ? '关掉「只看有想法」，可以回顾状态和学习记录'
                : '从今天开始写，这里会按时间线排开'
            }
          />
        ) : (
          visible.map((record) => {
            const cfg = record.stateId ? stateCfgMap.get(record.stateId) : undefined;
            const date = parseDate(record.date);
            const weekdayIndex = (date.getDay() + 6) % 7;
            const weekday = `周${WEEKDAY_LABELS[weekdayIndex]}`;
            const diaryText = record.diary ? stripMarkdown(record.diary) : '';
            // 当日去重科目（保持出现顺序）
            const subs: { name: string; color: string }[] = [];
            const seen = new Set<string>();
            for (const e of record.entries) {
              if (!seen.has(e.subjectName)) {
                seen.add(e.subjectName);
                subs.push({ name: e.subjectName, color: e.subjectColor });
              }
            }
            return (
              <button
                key={record.date}
                type="button"
                className="nb-mem-item"
                onClick={() => navigate(`/day/${record.date}`)}
              >
                <span className="nb-mem-date">
                  <b>
                    {String(date.getMonth() + 1).padStart(2, '0')}.{String(date.getDate()).padStart(2, '0')}
                  </b>
                  <span>{weekday}</span>
                </span>
                <span className="nb-mem-body">
                  <span className="nb-mem-meta">
                    {cfg && (
                      <span
                        className="nb-mem-state"
                        style={{ color: stateTextColor(cfg) }}
                      >
                        {cfg.label}
                      </span>
                    )}
                    {record.totalMin > 0 && (
                      <span className="nb-mem-dur">{formatDuration(record.totalMin)}</span>
                    )}
                    {subs.map((s) => (
                      <span key={s.name} className="nb-mem-subj" style={{ color: s.color }}>
                        {s.name}
                      </span>
                    ))}
                  </span>
                  {diaryText ? (
                    <span className="nb-note nb-mem-note">{diaryText}</span>
                  ) : (
                    <span className="nb-mem-empty">（这天没写想法）</span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
