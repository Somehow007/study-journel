import { useToasts } from '../lib/toast';

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
          className="pointer-events-auto rounded-lg px-4 py-2 font-sans text-small shadow-2"
          style={{
            background: t.type === 'error' ? '#FEF2F2' : 'var(--card)',
            color: t.type === 'error' ? '#B91C1C' : 'var(--ink)',
            border: `1px solid ${t.type === 'error' ? '#FECACA' : 'var(--keyline)'}`,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
