export type ThemeId = 'notebook' | 'notebook-dark'

export interface ThemeMeta {
  id: ThemeId
  name: string
  group: string
  hasDarkVariant: boolean
  darkVariant?: ThemeId
  lightVariant?: ThemeId
  preview: { bg: string; accent: string }
}

/**
 * journal 主题体系（M6 B 格纸先行）：
 * - setting.theme 存概念短 id（notebook / notebook-dark），DOM data-theme = `journal-${id}`
 * - 与博客 key（mysite_theme_v2）完全脱钩；localStorage 仅作登录前首帧缓存
 */
export const THEME_CACHE_KEY = 'study-journal-theme'
const DEFAULT_THEME: ThemeId = 'notebook'

export const THEME_REGISTRY: ThemeMeta[] = [
  {
    id: 'notebook',
    name: '格纸 · 米白',
    group: 'notebook',
    hasDarkVariant: true,
    darkVariant: 'notebook-dark',
    preview: { bg: '#F3F1EA', accent: '#D23B22' },
  },
  {
    id: 'notebook-dark',
    name: '格纸 · 夜间墨蓝',
    group: 'notebook',
    hasDarkVariant: true,
    lightVariant: 'notebook',
    preview: { bg: '#141B29', accent: '#FF7A5C' },
  },
]

const THEME_IDS = new Set<string>(THEME_REGISTRY.map((t) => t.id))

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && THEME_IDS.has(value)
}

export function isThemeDark(id: ThemeId): boolean {
  return id.includes('dark')
}

/** setting.theme / 缓存值 → ThemeId；未知值（含 DB 默认 graphite）回落默认 */
export function resolveThemeId(raw: string | null | undefined): ThemeId {
  return isThemeId(raw) ? raw : DEFAULT_THEME
}

export function readThemeCache(): ThemeId {
  try {
    return resolveThemeId(localStorage.getItem(THEME_CACHE_KEY))
  } catch {
    return DEFAULT_THEME
  }
}

export function writeThemeCache(id: ThemeId) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, id)
  } catch {
    /* ignore */
  }
}

export function applyTheme(id: ThemeId) {
  if (typeof document === 'undefined') return
  const dark = isThemeDark(id)
  document.documentElement.setAttribute('data-theme', `journal-${id}`)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function transitionTheme(id: ThemeId) {
  if (typeof document === 'undefined') {
    applyTheme(id)
    return
  }
  document.documentElement.classList.add('theme-transitioning')
  applyTheme(id)
  window.setTimeout(() => {
    document.documentElement.classList.remove('theme-transitioning')
  }, 400)
}

export function getThemeMeta(id: ThemeId): ThemeMeta | undefined {
  return THEME_REGISTRY.find((t) => t.id === id)
}

export function pairedThemeId(id: ThemeId): ThemeId | null {
  const meta = getThemeMeta(id)
  return meta?.darkVariant ?? meta?.lightVariant ?? null
}

export const THEME_PICKER_ITEMS = THEME_REGISTRY

export function isPickerThemeActive(current: ThemeId, item: ThemeMeta): boolean {
  return current === item.id
}
