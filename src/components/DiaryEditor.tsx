import { useRef, useState, useEffect, useCallback } from 'react';
import { MOOD_CONFIGS } from '../lib/constants';
import type { MoodType } from '../types';

interface DiaryEditorProps {
  value: string;
  onChange: (text: string) => void;
  mood: MoodType | null;
}

export default function DiaryEditor({ value, onChange, mood }: DiaryEditorProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 同步外部 value 变化
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // 组件卸载时清理定时器
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
        // 2 秒后恢复 idle
        setTimeout(() => setSaveStatus('idle'), 2000);
      }, 1500);
    },
    [onChange],
  );

  const moodConfig = mood ? MOOD_CONFIGS[mood] : null;
  const gradient = moodConfig
    ? moodConfig.gradient
    : 'linear-gradient(160deg, #FFD66B, #FFA51F)';

  return (
    <div className="relative">
      {/* 左侧心情渐变竖线 */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-lg"
        style={{ background: gradient }}
      />

      <div className="relative pl-5">
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={handleChange}
          placeholder="随手写点什么… 今天窗外是什么天气？"
          className="diary-paper min-h-[200px] w-full resize-none rounded-lg p-4 text-base leading-7 outline-none transition-all"
          style={{
            background: 'var(--color-card)',
            color: 'var(--color-text)',
            lineHeight: '28px',
          }}
        />

        {/* 保存状态指示 */}
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
          {saveStatus === 'saving' && (
            <span className="text-xs text-[var(--color-text-faint)]">保存中…</span>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-1.5 animate-fade-in">
              <span
                className="h-2 w-2 rounded-full bg-green-400"
                style={{ animation: 'save-pulse 300ms ease-out' }}
              />
              <span className="text-xs text-green-500/70">已保存</span>
            </div>
          )}
          {saveStatus === 'idle' && displayValue && (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400/50" />
              <span className="text-xs text-[var(--color-text-faint)]">已保存</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
