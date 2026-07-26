import { useMoodConfig } from '../lib/moodUtils';
import Flower from './Flower';

interface MoodFlowerProps {
  moodType: string;
  size?: number;
  /** @deprecated 兼容旧 MoodSeal 调用签名，已忽略（v5.0 统一由 Flower 渲染） */
  tone?: 'line' | 'seal';
  className?: string;
}

/**
 * 过渡包装：按 moodType 字符串解析心情配置并渲染花朵，
 * 用于替代旧 src/assets/moods 的 emoji 印章（MoodSeal）。
 * 后续阶段重写各页面时应改为直接使用 <Flower mood={...} />。
 */
export default function MoodFlower({ moodType, size = 24, className = '' }: MoodFlowerProps) {
  const config = useMoodConfig(moodType);
  if (!config) return null;
  return <Flower mood={config} size={size} variant="head" className={className} />;
}
