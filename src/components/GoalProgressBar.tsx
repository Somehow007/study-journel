interface GoalProgressBarProps {
  percent: number;
  color: string;
  reached?: boolean;
}

export default function GoalProgressBar({ percent, color, reached }: GoalProgressBarProps) {
  const width = percent > 0 ? Math.max(percent, 3) : 0;
  return (
    <div
      className="relative h-[6px] overflow-visible rounded-full"
      style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}
      aria-label={`进度 ${percent}%`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.min(100, width)}%`, background: color }}
      />
      {reached && (
        <span
          className="absolute right-0 top-1/2 h-[8px] w-[8px] -translate-y-1/2 translate-x-1/2 rounded-full"
          style={{ background: color, boxShadow: '0 0 0 2px var(--card)' }}
        />
      )}
    </div>
  );
}
