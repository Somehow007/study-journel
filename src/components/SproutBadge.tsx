interface SproutBadgeProps {
  days: number;
}

/** 连续天数文字徽章（不再使用新芽植物隐喻） */
export default function SproutBadge({ days }: SproutBadgeProps) {
  if (days <= 0) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 font-sans text-caption animate-fade-in"
      style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
    >
      连续 {days} 天
    </span>
  );
}
