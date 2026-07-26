interface SproutBadgeProps {
  days: number;
}

export default function SproutBadge({ days }: SproutBadgeProps) {
  if (days <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-caption animate-fade-in"
      style={{ background: 'color-mix(in srgb, var(--pine) 12%, transparent)', color: 'var(--pine)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 20C12 20 12 14 12 12C12 9 14 6 17 5C17 5 16 9 15 11C15 11 19 10 21 7C21 7 19 13 12 14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 20C12 20 12 16 10 14C8 12 5 12 3 13C3 13 6 15 9 15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-mono">连续 {days} 天</span>
    </span>
  );
}
