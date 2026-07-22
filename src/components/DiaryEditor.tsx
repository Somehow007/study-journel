import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { marked } from 'marked';
import { Eye, Pencil } from 'lucide-react';

// 配置 marked：安全模式 + 基础排版
marked.setOptions({
  breaks: true,       // GFM 换行
  gfm: true,          // GitHub Flavored Markdown
});

interface DiaryEditorProps {
  value: string;
  onChange: (text: string) => void;
  mood: string | null;
}

export default function DiaryEditor({ value, onChange, mood: _mood }: DiaryEditorProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [isPreview, setIsPreview] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external value changes
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setDisplayValue(text);
      setSaveStatus('saving');

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(text);
        setSaveStatus('saved');
        const now = new Date();
        setLastSavedTime(
          `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        );
        // 2s 后恢复 idle
        setTimeout(() => setSaveStatus('idle'), 2000);
      }, 1500);
    },
    [onChange],
  );

  // Render markdown to HTML (memoized, only when previewing)
  const renderedHtml = useMemo(() => {
    if (!displayValue) return '';
    try {
      return marked.parse(displayValue) as string;
    } catch {
      return '<p>渲染出错</p>';
    }
  }, [displayValue]);

  return (
    <div className="relative">
      <div className="card diary-paper relative rounded-lg">
        {/* 工具栏 — 卡片顶部，不遮挡正文 */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-2">
          <span className="font-sans text-caption text-[var(--ink-faint)]">
            {isPreview ? '预览' : '编辑'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsPreview(false)}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                !isPreview
                  ? 'bg-[var(--paper)] text-[var(--ink)]'
                  : 'text-[var(--ink-faint)] hover:bg-[var(--paper)] hover:text-[var(--ink-soft)]'
              }`}
              title="编辑"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setIsPreview(true)}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                isPreview
                  ? 'bg-[var(--paper)] text-[var(--ink)]'
                  : 'text-[var(--ink-faint)] hover:bg-[var(--paper)] hover:text-[var(--ink-soft)]'
              }`}
              title="预览"
            >
              <Eye size={14} />
            </button>
          </div>
        </div>

        {isPreview ? (
          <div
            className="diary-content min-h-[200px] p-4 font-serif text-diary text-[var(--ink)]"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={displayValue}
            onChange={handleChange}
            placeholder="随手写点什么… 支持 Markdown。今天窗外是什么天气？"
            className="min-h-[200px] w-full resize-none bg-transparent p-4 font-serif text-diary text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
          />
        )}
      </div>

      {/* 保存状态指示 — 右下角 */}
      <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
        {saveStatus === 'saving' && (
          <span className="font-sans text-caption text-[var(--ink-faint)]">保存中…</span>
        )}
        {saveStatus === 'saved' && (
          <div className="animate-fade-in flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: 'var(--pine)', animation: 'save-pulse 200ms ease-out' }}
            />
            <span className="font-sans text-caption text-[var(--pine)]">已保存 {lastSavedTime}</span>
          </div>
        )}
        {saveStatus === 'idle' && displayValue && lastSavedTime && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pine)', opacity: 0.5 }} />
            <span className="font-sans text-caption text-[var(--ink-faint)]">已保存 {lastSavedTime}</span>
          </div>
        )}
      </div>
    </div>
  );
}
