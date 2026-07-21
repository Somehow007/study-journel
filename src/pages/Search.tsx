import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, ArrowRight } from 'lucide-react';
import { searchDiary } from '../lib/db';
import { formatFullDate, formatDuration, totalDuration } from '../lib/dateUtils';
import { MOOD_CONFIGS } from '../lib/constants';
import MoodSeal from '../assets/moods';
import type { DayRecord } from '../types';

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
      <mark key={key++} className="rounded-sm px-0.5 text-[var(--ink)]" style={{ background: 'color-mix(in srgb, var(--brand) 20%, transparent)' }}>
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
      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <SearchIcon
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]"
          />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={handleInput}
            placeholder="搜索日记内容…"
            className="card w-full rounded-lg py-3 pl-11 pr-4 font-sans text-body text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] transition-all focus:border-[var(--brand)]"
            style={{ border: '1px solid var(--keyline)', boxShadow: 'none' }}
          />
        </div>
      </div>

      {/* Results */}
      {!hasSearched ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="card mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <SearchIcon size={28} className="text-[var(--ink-faint)]" />
          </div>
          <h2 className="font-serif text-h2 text-[var(--ink-soft)]">
            输入关键词开始搜索
          </h2>
          <p className="mt-2 max-w-xs font-sans text-small text-[var(--ink-faint)]">
            搜索你写过的日记内容，支持任意关键词
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-serif text-h2 text-[var(--ink-soft)]">
            没有找到包含「{keyword}」的日记
          </p>
          <p className="mt-2 font-sans text-small text-[var(--ink-faint)]">
            试试其他关键词？
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 font-sans text-caption text-[var(--ink-faint)]">
            找到 {results.length} 条记录
          </p>
          <div className="space-y-3">
            {results.map((record) => {
              const moodConfig = record.mood ? MOOD_CONFIGS[record.mood] : null;
              return (
                <button
                  key={record.date}
                  onClick={() => navigate(`/day/${record.date}`)}
                  className="card group w-full rounded-lg p-4 text-left transition-shadow"
                  style={{ boxShadow: 'var(--shadow-1)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-1)'; }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {moodConfig && record.mood && (
                      <MoodSeal moodType={record.mood} size={18} tone="seal" />
                    )}
                    <span className="font-serif text-title text-[var(--ink)]">
                      {formatFullDate(record.date)}
                    </span>
                    {moodConfig && (
                      <span
                        className="rounded-full px-2 py-0.5 font-sans text-caption"
                        style={{
                          background: `${moodConfig.solid}1A`,
                          color: moodConfig.solid,
                        }}
                      >
                        {moodConfig.label}
                      </span>
                    )}
                    {record.learnings.length > 0 && (
                      <span className="font-mono text-caption text-[var(--ink-faint)]">
                        {formatDuration(totalDuration(record.learnings))}
                      </span>
                    )}
                    <ArrowRight size={16} className="ml-auto text-[var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="line-clamp-3 font-serif text-small leading-relaxed text-[var(--ink-soft)]">
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
