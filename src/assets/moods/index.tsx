import { useMoodConfig } from '../../lib/moodUtils';

interface MoodSealProps {
  moodType: string;
  size?: number;
  tone?: 'line' | 'seal';  // 保留兼容，不再区分
  className?: string;
}

export default function MoodSeal({ moodType, size = 24, className = '' }: MoodSealProps) {
  const config = useMoodConfig(moodType);
  if (!config) return null;

  const emojiSize = Math.round(size * 0.85);

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size, fontSize: emojiSize, lineHeight: 1 }}
    >
      {config.emoji}
    </span>
  );
}
