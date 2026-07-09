import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { MoodConfig, CustomMoodConfig } from '../types';

/**
 * 将 CustomMoodConfig 转为 MoodConfig 格式，用于统一渲染
 */
export function customToMoodConfig(cm: CustomMoodConfig): MoodConfig {
  return {
    type: cm.id as MoodConfig['type'],
    label: cm.label,
    emoji: cm.emoji,
    main: cm.main,
    light: cm.light,
    dark: cm.dark,
    soft: cm.soft,
    softDark: cm.softDark,
    glow: cm.glow,
    gradient: cm.gradient,
  };
}

/**
 * React Hook：获取所有自定义心情（转为 MoodConfig 格式）
 */
export function useCustomMoodConfigs(): MoodConfig[] {
  const customMoods = useLiveQuery(() => db.customMoods.orderBy('createdAt').toArray(), []);
  if (!customMoods || customMoods.length === 0) return [];
  return customMoods.map(customToMoodConfig);
}

/**
 * 检查心情名称是否已存在（内置 + 自定义，大小写不敏感）
 */
export function isMoodLabelDuplicate(
  label: string,
  builtinLabels: string[],
  customMoods: MoodConfig[],
  excludeId?: string,
): boolean {
  const lower = label.trim().toLowerCase();

  for (const l of builtinLabels) {
    if (l.toLowerCase() === lower) return true;
  }

  for (const cm of customMoods) {
    if (excludeId && cm.type === excludeId) continue;
    if (cm.label.toLowerCase() === lower) return true;
  }

  return false;
}

/** Generate full mood palette from a single main color */
export function generateMoodPalette(main: string): {
  light: string; dark: string; soft: string; softDark: string; glow: string; gradient: string;
} {
  const r = parseInt(main.slice(1, 3), 16);
  const g = parseInt(main.slice(3, 5), 16);
  const b = parseInt(main.slice(5, 7), 16);

  const lighten = (v: number, amount: number) => Math.min(255, Math.round(v + (255 - v) * amount));
  const darken = (v: number, amount: number) => Math.max(0, Math.round(v * (1 - amount)));

  const light = `#${lighten(r, 0.35).toString(16).padStart(2, '0')}${lighten(g, 0.35).toString(16).padStart(2, '0')}${lighten(b, 0.35).toString(16).padStart(2, '0')}`;
  const dark = `#${darken(r, 0.3).toString(16).padStart(2, '0')}${darken(g, 0.3).toString(16).padStart(2, '0')}${darken(b, 0.3).toString(16).padStart(2, '0')}`;
  const soft = `#${lighten(r, 0.65).toString(16).padStart(2, '0')}${lighten(g, 0.65).toString(16).padStart(2, '0')}${lighten(b, 0.65).toString(16).padStart(2, '0')}`;
  const softDark = `#${darken(r, 0.7).toString(16).padStart(2, '0')}${darken(g, 0.7).toString(16).padStart(2, '0')}${darken(b, 0.7).toString(16).padStart(2, '0')}`;
  const glow = `rgba(${r},${g},${b},0.20)`;
  const gradient = `linear-gradient(160deg, ${light}, ${dark})`;

  return { light, dark, soft, softDark, glow, gradient };
}
