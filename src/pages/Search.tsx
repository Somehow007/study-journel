import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, ArrowRight } from 'lucide-react';
import { searchDiary } from '../lib/db';
import { formatFullDate, formatDuration, totalDuration } from '../lib/dateUtils';
import { MOOD_CONFIGS } from '../lib/constants';
import type { DayRecord } from '../types';

/** Highlight keyword matches in text */
function highlightSnippet(text: string, keyword: string): React.ReactNode {
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  const idx = lower.indexOf(kw);

  if (idx === -1) return text;

  // Get ~40 chars before and after the match
  const contextStart = Math.max(0, idx - 40);
  const contextEnd = Math.min(text.length, idx + kw.length + 40);

  let snippet = text.slice(contextStart, contextEnd);
  if (contextStart > 0) snippet = '…' + snippet;
  if (contextEnd < text.length) snippet = snippet + '…';

  // Split on keyword and intersperse <mark> elements
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
      <mark key={key++} className="rounded-sm bg-brand/30 px-0.5 text-[var(--color-text)]">
        {remaining.slice(matchIdx, matchIdx + kw.length)}
      </mark>
    );
    remaining = remaining.slice(matchIdx + kw.length);
  }

  return <>{parts}</>;
}

export default function Search() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<DayRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);
  // Auto-focus search input
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

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="animate-fade-up mx-auto max-w-2xl">
      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <SearchIcon
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
          />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={handleInput}
            placeholder="搜索日记内容…"
            className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] py-3 pl-11 pr-4 text-base text-[var(--color-text)] outline-none transition-all placeholder:text-[var(--color-text-faint)] focus:border-brand focus:shadow-2"
            style={{ background: 'var(--color-card)' }}
          />
        </div>
      </div>

      {/* Results */}
      {!hasSearched ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ boxShadow: '0 0 24px rgba(255,185,56,0.15)', background: 'var(--color-card)' }}
          >
            <SearchIcon size={28} className="text-[var(--color-text-faint)]" />
          </div>
          <h2 className="font-hand text-xl text-[var(--color-text-soft)]">
            输入关键词开始搜索
          </h2>
          <p className="mt-2 max-w-xs text-sm text-[var(--color-text-faint)]">
            搜索你写过的日记内容，支持任意关键词
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-hand text-lg text-[var(--color-text-soft)]">
            没有找到包含「{keyword}」的日记
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-faint)]">
            试试其他关键词？
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-[var(--color-text-faint)]">
            找到 {results.length} 条记录
          </p>
          <div className="space-y-3">
            {results.map((record) => {
              const moodConfig = record.mood ? MOOD_CONFIGS[record.mood] : null;
              return (
                <button
                  key={record.date}
                  onClick={() => navigate(`/day/${record.date}`)}
                  className="glass group w-full rounded-xl p-4 text-left shadow-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    {moodConfig && (
                      <span className="text-lg">{moodConfig.emoji}</span>
                    )}
                    <span className="font-hand text-base font-medium text-[var(--color-text)]">
                      {formatFullDate(record.date)}
                    </span>
                    {moodConfig && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{
                        background: `rgba(${parseInt(moodConfig.main.slice(1,3),16)},${parseInt(moodConfig.main.slice(3,5),16)},${parseInt(moodConfig.main.slice(5,7),16)},0.12)`,
                        color: moodConfig.main,
                      }}>
                        {moodConfig.label}
                      </span>
                    )}
                    {record.learnings.length > 0 && (
                      <span className="font-mono text-xs text-[var(--color-text-faint)]">
                        {formatDuration(totalDuration(record.learnings))}
                      </span>
                    )}
                    <ArrowRight size={16} className="ml-auto text-[var(--color-text-faint)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-[var(--color-text-soft)]">
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
