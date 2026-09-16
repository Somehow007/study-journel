interface BookLoaderProps {
  onComplete?: () => void;
}

import { useState, useEffect } from 'react';

export default function BookLoader({ onComplete }: BookLoaderProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 600);
    const t2 = setTimeout(() => onComplete?.(), 600 + 280);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-300 ease-out"
      style={{ background: 'var(--paper)', opacity: fading ? 0 : 1 }}
    >
      <div
        className="h-8 w-8 animate-pulse rounded-full"
        style={{ background: 'var(--brand-soft)', border: '2px solid var(--brand)' }}
      />
      <p className="mt-5 font-sans text-body text-[var(--ink-soft)]">加载中…</p>
    </div>
  );
}
