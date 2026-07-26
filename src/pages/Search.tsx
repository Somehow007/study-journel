import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, ArrowRight } from 'lucide-react';
import { searchDiary } from '../lib/db';
import { formatDuration, totalDuration, parseDate, getWeekdayChinese } from '../lib/dateUtils';
import { useAllMoodConfigs } from '../lib/moodUtils';
import { useIsDark } from '../lib/useIsDark';
import Flower from '../components/Flower';
import type { DayRecord, MoodConfig } from '../types';

/** 紧凑日期：2026.07.26 星期一 */
function formatSearchDate(dateStr: string): string {
  const date = parseDate(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d} ${getWeekdayChinese(date)}`;
}

/** Highlight keyword matches in text */
function highlightSnippet(text: string, keyword: string): React.ReactNode {
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  const idx = lower.indexOf(kw);

  if (idx === -1) return text;

  const contextStart = Math.max(0, idx - 40);
  const contextEnd = Math.min(text.length, idx + kw.length + 40);

  let snippet = text.slice(contextStart, contextEnd);
  if (contextStart > 0) snippet = '…' + snippet;
  if (contextEnd < text.length) snippet = snippet + '…';

  const parts: React.ReactNode[] = [];
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
      </mark>
    );
    remaining = remaining.slice(matchIdx + kw.length);
  }

  return <>{parts}</>;
}

export default function Search() {
  const navigate = useNavigate();
  const isDark = useIsDark();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<DayRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
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
      return;
    }
    setHasSearched(true);
    const found = await searchDiary(kw.trim());
    setResults(found);
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-h1 text-ink">搜索</h1>
        <p className="mt-1 font-displaylatin italic text-caption text-ink-faint">
          find a day.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <SearchIcon
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={handleInput}
            placeholder="搜索日记内容…"
            className="card w-full rounded-xl py-3.5 pl-11 pr-4 font-sans text-body text-ink outline-none placeholder:text-ink-faint transition-all focus:border-brand focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand)_15%,transparent)]"
            style={{ boxShadow: 'none' }}
          />
        </div>
      </div>

      {/* Results */}
      {!hasSearched ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <Flower size={48} />
          </div>
          <h2 className="font-serif text-h2 text-ink-soft">
            输入关键词开始搜索
          </h2>
          <p className="mt-2 max-w-xs font-sans text-small text-ink-faint">
            搜索你写过的日记内容，支持任意关键词
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <Flower size={48} />
          </div>
          <h2 className="font-serif text-h2 text-ink-soft">
            没有找到相关的日子
          </h2>
          <p className="mt-2 font-sans text-small text-ink-faint">
            换个关键词试试？
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 font-sans text-caption text-ink-faint">
            找到 {results.length} 条记录
          </p>
          <div className="space-y-3">
            {results.map((record) => {
              const moodConfig = record.mood ? (moodCfgMap.get(record.mood) ?? null) : null;
              return (
                <button
                  key={record.date}
                  onClick={() => navigate(`/day/${record.date}`)}
                  className="card group w-full rounded-xl p-4 text-left transition-shadow"
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-1)'; }}
                >
                  <div className="mb-2 flex items-center gap-3">
                    {moodConfig ? (
                      <Flower mood={moodConfig} size={20} variant="head" />
                    ) : (
                      <Flower size={20} variant="head" />
                    )}
                    <span className="font-mono text-num text-ink">
                      {formatSearchDate(record.date)}
                    </span>
                    {moodConfig && (
                      <span
                        className="rounded-full px-2 py-0.5 font-sans text-caption"
                        style={{
                          background: isDark ? moodConfig.dark.tint : moodConfig.tint,
                          color: isDark ? moodConfig.dark.ink : moodConfig.ink,
                        }}
                      >
                        {moodConfig.flower ?? moodConfig.label}
                      </span>
                    )}
                    {record.learnings.length > 0 && (
                      <span className="ml-auto font-mono text-caption text-ink-faint">
                        {formatDuration(totalDuration(record.learnings))}
                      </span>
                    )}
                    <ArrowRight
                      size={16}
                      className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                  <p className="line-clamp-3 font-serif text-small leading-relaxed text-ink-soft">
                    {highlightSnippet(record.diary, keyword)}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
