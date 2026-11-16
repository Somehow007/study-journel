import { useMemo } from 'react';
import { useStates } from './queries';
import { useApp } from '../context/AppContext';
import type { ThemeId } from './theme';
import type { JournalState } from './types/api';

/** 深色模式三档色（由主色派生） */
export interface StateDarkColors {
  solid: string;
  ink: string;
  tint: string;
}

/**
 * 状态展示配置 —— v3 state 只存主色（color），
 * ink/tint/dark 由 generateMoodPalette 现算（AGENTS §3：颜色只存主色）。
 * 字段名沿用旧 MoodConfig 形状，组件渲染层改动最小。
 */
export interface StateConfig {
  id: string;                  // state.id —— day.stateId 引用的键
  builtinKey: string | null;   // 内置态非空；自定义态为 null
  label: string;
  color: string;               // 主色 = solid
  polarity: number;            // -1 消极 / 0 中性 / 1 积极
  ink: string;
  tint: string;
  dark: StateDarkColors;
}

/** 由主色生成完整调色板（ink 深调 / tint 浅底 / dark 三档） */
export function generateMoodPalette(solid: string): {
  ink: string;
  tint: string;
  dark: StateDarkColors;
} {
  const r = parseInt(solid.slice(1, 3), 16);
  const g = parseInt(solid.slice(3, 5), 16);
  const b = parseInt(solid.slice(5, 7), 16);

  const darken = (v: number, amount: number) => Math.max(0, Math.round(v * (1 - amount)));
  const ink = `#${darken(r, 0.45).toString(16).padStart(2, '0')}${darken(g, 0.45).toString(16).padStart(2, '0')}${darken(b, 0.45).toString(16).padStart(2, '0')}`;

  const lightenToTint = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.78));
  const tint = `#${lightenToTint(r).toString(16).padStart(2, '0')}${lightenToTint(g).toString(16).padStart(2, '0')}${lightenToTint(b).toString(16).padStart(2, '0')}`;

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

/** SPEC-B §2 内置态精确调色板：concept → builtinKey → 明暗两套 ink/tint/dark */
interface StatePaletteSpec {
  ink: string;
  tint: string;
  dark: StateDarkColors;
}

const CONCEPT_STATE_PALETTES: Record<string, Record<string, StatePaletteSpec>> = {
  notebook: {
    inspired: { ink: '#9C2814', tint: '#F8E1DB', dark: { solid: '#FF7A5C', ink: '#FFC2B3', tint: '#3A1F1A' } },
    happy: { ink: '#8A3C10', tint: '#F7E6D8', dark: { solid: '#F29A5E', ink: '#F8D2B5', tint: '#38261A' } },
    calm: { ink: '#163A78', tint: '#DEE6F4', dark: { solid: '#7FA2E6', ink: '#C9D7F4', tint: '#1C2740' } },
    tired: { ink: '#5C616B', tint: '#ECEBE6', dark: { solid: '#8A92A2', ink: '#C9CDD5', tint: '#252B38' } },
    anxious: { ink: '#7A540C', tint: '#F4EAD2', dark: { solid: '#E0B356', ink: '#F1DCAE', tint: '#352C18' } },
    sad: { ink: '#403D63', tint: '#E6E4EF', dark: { solid: '#A29DD6', ink: '#D3D0EE', tint: '#262438' } },
  },
};

/** theme → 概念键（notebook-dark → notebook），调色板按概念查 */
function conceptOf(theme: ThemeId): string {
  return theme.replace(/-dark$/, '');
}

export function stateToConfig(s: JournalState, theme: ThemeId = 'notebook'): StateConfig {
  const spec = s.builtinKey
    ? CONCEPT_STATE_PALETTES[conceptOf(theme)]?.[s.builtinKey]
    : undefined;
  if (spec) {
    return {
      id: s.id,
      builtinKey: s.builtinKey,
      label: s.label,
      color: s.color,
      polarity: s.polarity,
      ink: spec.ink,
      tint: spec.tint,
      dark: spec.dark,
    };
  }
  const palette = generateMoodPalette(s.color);
  return {
    id: s.id,
    builtinKey: s.builtinKey,
    label: s.label,
    color: s.color,
    polarity: s.polarity,
    ink: palette.ink,
    tint: palette.tint,
    dark: palette.dark,
  };
}

function isActive(s: JournalState): boolean {
  return s.archivedAt == null;
}

/** 全部状态（含已归档）→ 展示/历史渲染用；归档态历史日仍要显示颜色 */
export function useStateConfigs(): StateConfig[] {
  const { data: states } = useStates();
  const { theme } = useApp();
  return useMemo(() => (states ?? []).map((s) => stateToConfig(s, theme)), [states, theme]);
}

/** 未归档状态 → 选择器用 */
export function useActiveStateConfigs(): StateConfig[] {
  const { data: states } = useStates();
  const { theme } = useApp();
  return useMemo(
    () => (states ?? []).filter(isActive).map((s) => stateToConfig(s, theme)),
    [states, theme],
  );
}

/** 自定义状态（builtinKey == null 且未归档）→ 设置页管理 */
export function useCustomStateConfigs(): StateConfig[] {
  const { data: states } = useStates();
  const { theme } = useApp();
  return useMemo(
    () => (states ?? []).filter((s) => isActive(s) && s.builtinKey == null).map((s) => stateToConfig(s, theme)),
    [states, theme],
  );
}

/** 按 stateId 查配置（day.stateId / mark.stateId 引用；含归档态） */
export function useStateConfig(stateId: string | null | undefined): StateConfig | null {
  const configs = useStateConfigs();
  return useMemo(() => configs.find((c) => c.id === stateId) ?? null, [configs, stateId]);
}

/** 同步查找（非 hook 上下文；states 需调用方自备，含归档态） */
export function findStateConfig(
  states: JournalState[] | undefined,
  stateId: string | null | undefined,
  theme: ThemeId = 'notebook',
): StateConfig | null {
  if (!stateId) return null;
  const s = (states ?? []).find((x) => x.id === stateId);
  return s ? stateToConfig(s, theme) : null;
}

/** 标签查重（仅未归档态，大小写不敏感；排除自身） */
export function isStateLabelDuplicate(
  label: string,
  states: JournalState[] | undefined,
  excludeId?: string,
): boolean {
  const lower = label.trim().toLowerCase();
  return (states ?? [])
    .filter(isActive)
    .some((s) => s.id !== excludeId && s.label.toLowerCase() === lower);
}
