import { useRef, useState, useEffect, useCallback } from 'react';
import type { MoodType } from '../types';

interface DiaryEditorProps {
  value: string;
  onChange: (text: string) => void;
  mood: MoodType | null;
}

export default function DiaryEditor({ value, onChange, mood: _mood }: DiaryEditorProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
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

  return (
    <div className="relative">
      <div className="card diary-paper relative rounded-lg">
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={handleChange}
          placeholder="随手写点什么… 今天窗外是什么天气？"
          className="min-h-[200px] w-full resize-none bg-transparent p-4 font-serif text-diary text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
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
