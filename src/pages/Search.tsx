import type { ReactNode } from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, ArrowRight } from 'lucide-react';
import { searchDiary } from '../lib/api';
import { formatDuration, totalDuration, parseDate, getWeekdayChinese } from '../lib/dateUtils';
import { useAllMoodConfigs } from '../lib/moodUtils';
import { useIsDark } from '../lib/useIsDark';
import { QueryEmpty, QueryLoading } from '../components/QueryState';
import type { DayRecord, MoodConfig } from '../types';

function formatSearchDate(dateStr: string): string {
  const date = parseDate(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d} ${getWeekdayChinese(date)}`;
}

function highlightSnippet(text: string, keyword: string): ReactNode {
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  const idx = lower.indexOf(kw);
  if (idx === -1) return text;

  const contextStart = Math.max(0, idx - 40);
  const contextEnd = Math.min(text.length, idx + kw.length + 40);
  let snippet = text.slice(contextStart, contextEnd);
  if (contextStart > 0) snippet = '…' + snippet;
  if (contextEnd < text.length) snippet = snippet + '…';

  const parts: ReactNode[] = [];
  let remaining = snippet;
  let key = 0;
  while (remaining.length > 0) {
    const matchIdx = remaining.toLowerCase().indexOf(kw);
    if (matchIdx === -1) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    if (matchIdx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, matchIdx)}</span>);
    }
    parts.push(
      <mark
        key={key++}
        className="rounded-sm px-0.5 text-ink"
        style={{ background: 'color-mix(in srgb, var(--brand) 20%, transparent)' }}
      >
        {remaining.slice(matchIdx, matchIdx + kw.length)}
      </mark>,
    );
    remaining = remaining.slice(matchIdx + kw.length);
  }
  return <>{parts}</>;
}

function matchesKw(text: string | undefined, keyword: string): boolean {
  return Boolean(text && text.toLowerCase().includes(keyword.toLowerCase()));
}

export default function Search() {
  const navigate = useNavigate();
  const isDark = useIsDark();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<DayRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);
  const allMoods = useAllMoodConfigs();
  const moodCfgMap = useMemo(() => {
    const map = new Map<string, MoodConfig>();
    for (const cfg of allMoods) map.set(cfg.type, cfg);
    return map;
  }, [allMoods]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }
    setHasSearched(true);
    setLoading(true);
    try {
      const found = await searchDiary(kw.trim());
      setResults(found);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setKeyword(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(value), 300);
    },
    [doSearch],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="animate-fade-up mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="font-sans text-h1 text-ink">搜索</h1>
        <p className="mt-1 font-sans text-caption text-ink-faint">日记、学科、备注</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={handleInput}
            placeholder="搜索日记、学科或备注…"
            className="card w-full rounded-xl py-3.5 pl-11 pr-4 font-sans text-body text-ink outline-none placeholder:text-ink-faint transition-all focus:border-brand"
            style={{ boxShadow: 'none' }}
          />
        </div>
      </div>

      {!hasSearched ? (
        <QueryEmpty title="输入关键词开始搜索" hint="会同时匹配日记、学科名称和备注" />
      ) : loading ? (
        <QueryLoading />
      ) : results.length === 0 ? (
        <QueryEmpty title="没有找到相关记录" hint="换个关键词试试？" />
      ) : (
        <>
          <p className="mb-3 font-sans text-caption text-ink-faint">找到 {results.length} 条记录</p>
          <div className="space-y-3">
            {results.map((record) => {
              const moodConfig = record.mood ? (moodCfgMap.get(record.mood) ?? null) : null;
              const hitLearnings = record.learnings.filter(
                (l) => matchesKw(l.subject, keyword) || matchesKw(l.note, keyword),
              );
              return (
                <button
                  key={record.date}
                  onClick={() => navigate(`/day/${record.date}`)}
                  className="card group w-full rounded-xl p-4 text-left transition-shadow hover:shadow-2"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: moodConfig
                          ? isDark
                            ? moodConfig.dark.solid
                            : moodConfig.solid
                          : 'var(--keyline)',
                      }}
                    />
                    <span className="font-mono text-num text-ink">{formatSearchDate(record.date)}</span>
                    {moodConfig && (
                      <span
                        className="rounded-full px-2 py-0.5 font-sans text-caption"
                        style={{
                          background: isDark ? moodConfig.dark.tint : moodConfig.tint,
                          color: isDark ? moodConfig.dark.ink : moodConfig.ink,
                        }}
                      >
                        {moodConfig.label}
                      </span>
                    )}
                    {record.learnings.length > 0 && (
                      <span className="ml-auto font-mono text-caption text-ink-faint">
                        {formatDuration(totalDuration(record.learnings))}
                      </span>
                    )}
                    <ArrowRight size={16} className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  {record.diary && matchesKw(record.diary, keyword) && (
                    <p className="line-clamp-3 font-sans text-small leading-relaxed text-ink-soft">
                      {highlightSnippet(record.diary, keyword)}
                    </p>
                  )}
                  {hitLearnings.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {hitLearnings.map((l) => (
                        <span
                          key={l.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--keyline)] px-2 py-0.5 font-sans text-caption text-ink-soft"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                          {highlightSnippet(`${l.subject}${l.note ? ` · ${l.note}` : ''}`, keyword)}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
