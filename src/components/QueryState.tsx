import type { ReactNode } from 'react';
import { Pressable } from './ui/Pressable';

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryLoading() {
  return (
    <div className="animate-pulse space-y-3 py-8" aria-busy="true">
      <div className="h-8 w-40 rounded bg-[var(--hairline)]" />
      <div className="h-40 rounded-xl bg-[var(--hairline)]" />
      <div className="h-24 rounded-xl bg-[var(--hairline)]" />
    </div>
  );
}

export function QueryError({ message, onRetry }: QueryErrorProps) {
  return (
    <div className="card rounded-xl px-6 py-10 text-center">
      <p className="font-sans text-body text-[var(--ink-soft)]">{message || '加载失败，请稍后重试'}</p>
      {onRetry && (
        <Pressable
          onClick={onRetry}
          className="mt-4 rounded-md px-4 py-2 font-sans text-small text-[var(--text-inverse)]"
          style={{ background: 'var(--brand)' }}
        >
          重试
        </Pressable>
      )}
    </div>
  );
}

export function QueryEmpty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="h-12 w-12 rounded-full border-2 border-dashed"
        style={{ borderColor: 'var(--keyline)' }}
        aria-hidden="true"
      />
      <h2 className="mt-4 font-sans text-h2 text-[var(--ink-soft)]">{title}</h2>
      {hint && <p className="mt-2 max-w-xs font-sans text-small text-[var(--ink-faint)]">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
