import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { MOOD_CONFIGS } from '../lib/constants';

type LoaderPhase = 'idle' | 'flip' | 'flash' | 'done';

interface BookLoaderProps {
  onComplete?: () => void;
  lastMood?: string | null;
}

export default function BookLoader({ onComplete, lastMood }: BookLoaderProps) {
  const { theme } = useApp();
  const isDark = theme === 'dark';
  const [phase, setPhase] = useState<LoaderPhase>('idle');

  // Flash color: mood tint (replaces v3.x glow); custom moods fall back to brand tint
  const moodCfg = lastMood ? MOOD_CONFIGS[lastMood as keyof typeof MOOD_CONFIGS] : undefined;
  const tintColor = moodCfg
    ? (isDark ? moodCfg.dark.tint : moodCfg.tint)
    : undefined;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('flip'), 100);
    const t2 = setTimeout(() => setPhase('flash'), 500);
    const t3 = setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, 700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  const phasesExcludingDone = phase as Exclude<LoaderPhase, 'done'>;
  const transform = phasesExcludingDone === 'flash' ? 'rotateY(-90deg)' : 'rotateY(0deg)';
  const animation = phasesExcludingDone === 'flip' ? 'book-flip 400ms ease-in-out forwards' : 'none';
  const opacity = phasesExcludingDone === 'flash' ? 0 : 1;
  const transition = phasesExcludingDone === 'flash' ? 'opacity 200ms ease-out' : 'none';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: isDark
          ? 'linear-gradient(170deg, #23201A 0%, #211D17 45%, #1F1B15 100%)'
          : 'linear-gradient(170deg, #F7F3EA 0%, #F5F0E6 45%, #F2ECDF 100%)',
        perspective: '1000px',
      }}
    >
      {/* Book cover — card style with keyline */}
      <div
        className="relative h-48 w-36"
        style={{
          transformStyle: 'preserve-3d',
          transformOrigin: 'left center',
          animation,
          transform,
          opacity,
          transition,
        }}
      >
        {/* Cover — paper card with keyline + vermillion seal logo */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-lg"
          style={{
            background: isDark ? 'var(--card)' : 'var(--card)',
            border: '1px solid var(--keyline)',
            backfaceVisibility: 'hidden',
            boxShadow: 'var(--shadow-4)',
          }}
        >
          <span className="text-4xl">📔</span>
          <span className="mt-2 font-serif text-title text-[var(--ink)]">
            手帐
          </span>
          <span className="font-hand text-caption text-[var(--ink-faint)]">Study Journal</span>
          <div
            className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 opacity-15"
            style={{ background: 'var(--hairline)' }}
          />
          {/* 朱红印章小 logo — bottom */}
          <div
            className="absolute bottom-4 right-4 h-5 w-5 rounded-full"
            style={{ background: 'var(--brand)' }}
          />
        </div>
      </div>

      {/* Flash overlay — mood tint color */}
      {phase === 'flash' && (
        <div
          className="animate-fade-in pointer-events-none absolute inset-0"
          style={{
            background: tintColor || 'color-mix(in srgb, var(--brand) 12%, transparent)',
            animation: 'book-flash 200ms ease-out forwards',
          }}
        />
      )}

      {/* Loading text — serif */}
      <p
        className="absolute bottom-20 font-serif text-body text-[var(--ink-faint)]"
      >
        {phase === 'flip' ? '翻开今天的一页…' : '正在打开…'}
      </p>

      <style>{`
        @keyframes book-flip {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(-90deg); }
        }
        @keyframes book-flash {
          0% { opacity: 0.6; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
