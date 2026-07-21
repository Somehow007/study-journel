import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { MoodConfig, CustomMoodConfig, MoodDarkColors } from '../types';

/**
 * 将 CustomMoodConfig 转为 MoodConfig 格式，用于统一渲染
 */
export function customToMoodConfig(cm: CustomMoodConfig): MoodConfig {
  return {
    type: cm.id as MoodConfig['type'],
    label: cm.label,
    emoji: cm.emoji,
    solid: cm.solid,
    ink: cm.ink,
    tint: cm.tint,
    dark: cm.dark,
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

/** Generate full mood palette from a single main (solid) color — v4.0 three-tone system */
export function generateMoodPalette(solid: string): {
  ink: string; tint: string; dark: MoodDarkColors;
} {
  const r = parseInt(solid.slice(1, 3), 16);
  const g = parseInt(solid.slice(3, 5), 16);
  const b = parseInt(solid.slice(5, 7), 16);

  // ink: darker, muted version for text/icons on tint backgrounds
  const darken = (v: number, amount: number) => Math.max(0, Math.round(v * (1 - amount)));
  const ink = `#${darken(r, 0.45).toString(16).padStart(2, '0')}${darken(g, 0.45).toString(16).padStart(2, '0')}${darken(b, 0.45).toString(16).padStart(2, '0')}`;

  // tint: very light version for large area backgrounds
  const lightenToTint = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.78));
  const tint = `#${lightenToTint(r).toString(16).padStart(2, '0')}${lightenToTint(g).toString(16).padStart(2, '0')}${lightenToTint(b).toString(16).padStart(2, '0')}`;

  // dark mode: brighten solid, lighten ink, darken tint
  const brighten = (v: number, amount: number) => Math.min(255, Math.round(v + (255 - v) * amount));
  const darkSolid = `#${brighten(r, 0.15).toString(16).padStart(2, '0')}${brighten(g, 0.15).toString(16).padStart(2, '0')}${brighten(b, 0.15).toString(16).padStart(2, '0')}`;

  const lightenForDarkInk = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.7));
  const darkInk = `#${lightenForDarkInk(r).toString(16).padStart(2, '0')}${lightenForDarkInk(g).toString(16).padStart(2, '0')}${lightenForDarkInk(b).toString(16).padStart(2, '0')}`;

  const veryDarken = (v: number) => Math.max(0, Math.round(v * 0.18));
  const darkTint = `#${veryDarken(r).toString(16).padStart(2, '0')}${veryDarken(g).toString(16).padStart(2, '0')}${veryDarken(b).toString(16).padStart(2, '0')}`;

  return {
    ink,
    tint,
    dark: { solid: darkSolid, ink: darkInk, tint: darkTint },
  };
}
