import type { ReactNode } from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../lib/queries';
import { parseDate, getWeekdayChinese } from '../lib/dateUtils';
import { QueryEmpty, QueryError, QueryLoading } from '../components/QueryState';

type SearchType = 'all' | 'diary' | 'entry';
const TYPE_CHIPS: { key: SearchType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'diary', label: '日记' },
  { key: 'entry', label: '学习记录' },
];
const ROTATIONS = [-0.6, 0.4, -0.3];

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
        className="nb-hit-mark"
      >
        {remaining.slice(matchIdx, matchIdx + kw.length)}
      </mark>,
    );
    remaining = remaining.slice(matchIdx + kw.length);
  }
  return <>{parts}</>;
}

function HitCard({
  date,
  tag,
  tagColor,
  text,
  keyword,
  rotate,
  onOpen,
}: {
  date: string;
  tag: string;
  tagColor?: string;
  text: string;
  keyword: string;
  rotate: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="nb-hit-card"
      style={{ transform: `rotate(${rotate}deg)` }}
      onClick={onOpen}
    >
      <span className="nb-hit-head">
        <span className="nb-mono">{formatSearchDate(date)}</span>
        <span className="nb-hit-tag" style={tagColor ? { color: tagColor } : undefined}>
          {tag}
        </span>
      </span>
      <span className="nb-note nb-hit-note">{highlightSnippet(text, keyword)}</span>
    </button>
  );
}

export default function Search() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState<SearchType>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isPending, isFetching, error, refetch } = useSearch(debounced, type);

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

  // 结果卡片统一序列（先日记后条目），旋转角按序循环
  const hits = useMemo(
    () => [
      ...dayHits.map((h) => ({ kind: 'day' as const, hit: h })),
      ...entryHits.map((e) => ({ kind: 'entry' as const, hit: e })),
    ],
    [dayHits, entryHits],
  );

  return (
    <div className="nb-book nb-single">
      <div className="nb-page single nb-gridbg">
        <div className="nb-date">
          <span className="nb-date-num">搜索</span>
          <span className="nb-date-meta">日记、学科、备注</span>
        </div>

        <div className="nb-search-bar">
          <span className="nb-search-label">查：</span>
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={handleInput}
            placeholder="日记、科目或备注…"
            className="nb-field nb-search-input"
          />
          {hasSearched && !loading && total > 0 && (
            <span className="nb-search-count nb-mono">共 {total} 处</span>
          )}
        </div>

        <div className="nb-search-types">
          {TYPE_CHIPS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`nb-chip${type === t.key ? ' on' : ''}`}
              onClick={() => setType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!hasSearched ? (
          <QueryEmpty title="输入关键词开始搜索" hint="会同时匹配日记、学科名称和备注" />
        ) : loading ? (
          <QueryLoading />
        ) : error ? (
          <QueryError message={error.message} onRetry={() => void refetch()} />
        ) : total === 0 ? (
          <QueryEmpty title="没有找到相关记录" hint="换个关键词试试？" />
        ) : (
          <div className="nb-hit-grid">
            {hits.map((h, idx) =>
              h.kind === 'day' ? (
                <HitCard
                  key={`d-${h.hit.date}`}
                  date={h.hit.date}
                  tag="日记"
                  text={h.hit.diary}
                  keyword={debounced}
                  rotate={ROTATIONS[idx % 3]}
                  onOpen={() => navigate(`/day/${h.hit.date}`)}
                />
              ) : (
                <HitCard
                  key={`e-${h.hit.id}`}
                  date={h.hit.date}
                  tag={`条目 · ${h.hit.subjectName}`}
                  tagColor={h.hit.subjectColor}
                  text={
                    h.hit.note && h.hit.note !== (h.hit.title || h.hit.subjectName)
                      ? `${h.hit.title || h.hit.subjectName} · ${h.hit.note}`
                      : h.hit.title || h.hit.subjectName
                  }
                  keyword={debounced}
                  rotate={ROTATIONS[idx % 3]}
                  onOpen={() => navigate(`/day/${h.hit.date}`)}
                />
              ),
            )}
          </div>
        )}

        <p className="nb-search-foot">会同时匹配日记、学科名称和备注。</p>
      </div>
    </div>
  );
}
