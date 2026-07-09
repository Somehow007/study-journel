import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { MOOD_CONFIGS } from '../lib/constants';
import type { MoodType } from '../types';

type LoaderPhase = 'idle' | 'flip' | 'flash' | 'done';

interface BookLoaderProps {
  onComplete?: () => void;
  lastMood?: MoodType | null;
}

export default function BookLoader({ onComplete, lastMood }: BookLoaderProps) {
  const { theme } = useApp();
  const [phase, setPhase] = useState<LoaderPhase>('idle');

  const flashColor = lastMood
    ? MOOD_CONFIGS[lastMood].glow
    : 'rgba(255,185,56,0.30)';

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

  // Return null after done to unmount
  if (phase === 'done') return null;

  const phasesExcludingDone = phase as Exclude<LoaderPhase, 'done'>;

  const transform =
    phasesExcludingDone === 'flash' ? 'rotateY(-90deg)' : 'rotateY(0deg)';

  const animation =
    phasesExcludingDone === 'flip' ? 'book-flip 400ms ease-in-out forwards' : 'none';

  const opacity = phasesExcludingDone === 'flash' ? 0 : 1;
  const transition = phasesExcludingDone === 'flash' ? 'opacity 200ms ease-out' : 'none';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: theme === 'dark'
          ? 'linear-gradient(160deg, #1A1714 0%, #221E18 40%, #1E1A14 100%)'
          : 'linear-gradient(160deg, #FBF6EE 0%, #FFF0E0 40%, #FCE8D8 100%)',
        perspective: '1000px',
      }}
    >
      {/* Book cover */}
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
        {/* Cover */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-lg shadow-4"
          style={{
            background: theme === 'dark'
              ? 'rgba(55,50,42,0.95)'
              : 'rgba(255,253,249,0.95)',
            border: '1px solid var(--color-line)',
            backfaceVisibility: 'hidden',
          }}
        >
          <span className="text-4xl">📔</span>
          <span className="mt-2 font-hand text-base text-[var(--color-text-soft)]">
            学习手帐
          </span>
          <div
            className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 opacity-20"
            style={{ background: 'var(--color-line)' }}
          />
        </div>
      </div>

      {/* Flash overlay */}
      {phase === 'flash' && (
        <div
          className="animate-fade-in pointer-events-none absolute inset-0"
          style={{
            background: flashColor,
            animation: 'book-flash 200ms ease-out forwards',
          }}
        />
      )}

      {/* Loading text */}
      <p
        className="absolute bottom-20 font-hand text-base text-[var(--color-text-faint)]"
        style={{
          animation: 'breath 2s ease-in-out infinite',
        }}
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
