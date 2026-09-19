import { useToasts } from '../lib/toast';
import { Pressable } from './ui/Pressable';

export default function ToastHost() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4"
      style={{ top: 'calc(52px + env(safe-area-inset-top, 0px))' }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-item pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-2 font-sans text-small shadow-2"
          style={{
            background: t.type === 'error' ? 'var(--danger-subtle)' : 'var(--success-subtle)',
            color: t.type === 'error' ? 'var(--danger)' : 'var(--pine)',
            border: `1px solid ${t.type === 'error' ? 'var(--danger)' : 'var(--pine)'}`,
          }}
        >
          <span>{t.message}</span>
          {t.onRetry && (
            <Pressable
              variant="pill"
              onClick={t.onRetry}
              className="min-h-0 rounded-full px-2 py-0.5 font-sans text-caption"
              style={{ color: 'inherit', border: '1px solid currentColor' }}
            >
              重试
            </Pressable>
          )}
        </div>
      ))}
    </div>
  );
}
