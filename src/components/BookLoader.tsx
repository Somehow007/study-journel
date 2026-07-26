import { useState, useEffect } from 'react';
import Flower from './Flower';
import { MOOD_CONFIGS } from '../lib/constants';

interface BookLoaderProps {
  onComplete?: () => void;
}

/**
 * 花开加载仪式（v5.0 §5.8）：晨雾底中央一朵开心金小花 bloom-in 绽开，
 * 下方衬线「等一朵花开…」；900ms 后整体淡出并回调 onComplete。
 * 每会话只播一次（sessionStorage 'study-journal-loaded' 由 App.tsx 控制）。
 */
export default function BookLoader({ onComplete }: BookLoaderProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 900);
    const t2 = setTimeout(() => onComplete?.(), 900 + 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-300 ease-out"
      style={{
        background: 'linear-gradient(170deg, var(--bg-start) 0%, var(--bg-mid) 45%, var(--bg-end) 100%)',
        opacity: fading ? 0 : 1,
      }}
    >
      <div className="animate-bloom-in">
        <Flower mood={MOOD_CONFIGS.happy} size={64} />
      </div>
      <p className="mt-6 font-serif text-body text-[var(--ink-soft)]">
        等一朵花开…
      </p>
    </div>
  );
}
