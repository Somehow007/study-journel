import type { ReactNode } from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, ArrowRight } from 'lucide-react';
import { useSearch } from '../lib/queries';
import { useStateConfigs, type StateConfig } from '../lib/stateUtils';
import { formatDuration, parseDate, getWeekdayChinese } from '../lib/dateUtils';
import { useIsDark } from '../lib/useIsDark';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';
import { Pressable } from '../components/ui/Pressable';
import type { Entry, SearchDayHit } from '../lib/types/api';

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

function StateChip({ cfg, isDark }: { cfg: StateConfig; isDark: boolean }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 font-sans text-caption"
      style={{
        background: isDark ? cfg.dark.tint : cfg.tint,
        color: isDark ? cfg.dark.ink : cfg.ink,
      }}
    >
      {cfg.label}
    </span>
  );
}

function DiaryHitCard({
  hit,
  cfg,
  isDark,
  keyword,
  onOpen,
}: {
  hit: SearchDayHit;
  cfg: StateConfig | null;
  isDark: boolean;
  keyword: string;
  onOpen: () => void;
}) {
  return (
    <Pressable variant="card" onClick={onOpen} className="card group w-full rounded-xl p-4 text-left">
      <div className="mb-2 flex items-center gap-3">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{
            background: cfg ? (isDark ? cfg.dark.solid : cfg.color) : 'var(--keyline)',
          }}
        />
        <span className="font-mono text-num text-ink">{formatSearchDate(hit.date)}</span>
        {cfg && <StateChip cfg={cfg} isDark={isDark} />}
        <ArrowRight size={16} className="ml-auto text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="line-clamp-3 font-sans text-small leading-relaxed text-ink-soft">
        {highlightSnippet(hit.diary, keyword)}
      </p>
    </Pressable>
  );
}

function EntryHitCard({
  entry,
  keyword,
  onOpen,
}: {
  entry: Entry;
  keyword: string;
  onOpen: () => void;
}) {
  const title = entry.title || entry.subjectName;
  const hitText = entry.note && entry.note !== title ? `${title} · ${entry.note}` : title;
  return (
    <Pressable variant="card" onClick={onOpen} className="card group w-full rounded-xl p-4 text-left">
      <div className="mb-2 flex items-center gap-3">
        <span className="font-mono text-num text-ink">{formatSearchDate(entry.date)}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--keyline)] px-2 py-0.5 font-sans text-caption text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.subjectColor }} />
          {entry.subjectName}
        </span>
        <span className="ml-auto font-mono text-caption text-ink-faint">
          {formatDuration(entry.durationMin)}
        </span>
        <ArrowRight size={16} className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="line-clamp-2 font-sans text-small leading-relaxed text-ink-soft">
        {highlightSnippet(hitText, keyword)}
      </p>
    </Pressable>
  );
}

export default function Search() {
  const navigate = useNavigate();
  const isDark = useIsDark();
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isPending, isFetching, error, refetch } = useSearch(debounced);
  const stateConfigs = useStateConfigs();
  const cfgById = useMemo(() => {
    const map = new Map<string, StateConfig>();
    for (const c of stateConfigs) map.set(c.id, c);
    return map;
  }, [stateConfigs]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(value.trim()), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasSearched = debounced.length > 0;
  const dayHits = data?.days ?? [];
  const entryHits = data?.entries ?? [];
  const total = dayHits.length + entryHits.length;
  const loading = hasSearched && (isPending || (isFetching && !data));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="font-sans text-h1 text-ink">搜索</h1>
        <p className="mt-1 font-sans text-caption text-ink-faint">日记、科目、备注</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={handleInput}
            placeholder="搜索日记、科目或备注…"
            className="card w-full rounded-xl py-3.5 pl-11 pr-4 font-sans text-body text-ink outline-none placeholder:text-ink-faint transition-all focus:border-brand"
            style={{ boxShadow: 'none' }}
          />
        </div>
      </div>

      {!hasSearched ? (
        <QueryEmpty title="输入关键词开始搜索" hint="会同时匹配日记、科目名称和备注" />
      ) : loading ? (
        <QueryLoading />
      ) : error ? (
        <QueryError message={error.message} onRetry={() => void refetch()} />
      ) : total === 0 ? (
        <QueryEmpty title="没有找到相关记录" hint="换个关键词试试？" />
      ) : (
        <div className="space-y-6">
          <p className="font-sans text-caption text-ink-faint">找到 {total} 条记录</p>

          {dayHits.length > 0 && (
            <section>
              <h2 className="mb-3 font-sans text-small text-ink-faint">日记</h2>
              <div className="space-y-3">
                {dayHits.map((hit) => (
                  <DiaryHitCard
                    key={`d-${hit.date}`}
                    hit={hit}
                    cfg={cfgById.get(hit.stateId) ?? null}
                    isDark={isDark}
                    keyword={debounced}
                    onOpen={() => navigate(`/day/${hit.date}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {entryHits.length > 0 && (
            <section>
              <h2 className="mb-3 font-sans text-small text-ink-faint">学习记录</h2>
              <div className="space-y-3">
                {entryHits.map((entry) => (
                  <EntryHitCard
                    key={entry.id}
                    entry={entry}
                    keyword={debounced}
                    onOpen={() => navigate(`/day/${entry.date}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
