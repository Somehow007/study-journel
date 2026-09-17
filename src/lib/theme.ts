export type ThemeId =
  | 'classic-light'
  | 'classic-dark'
  | 'aurora'
  | 'rose-garden'
  | 'ocean-breeze'
  | 'warm-sunset'
  | 'liquid-glass'
  | 'liquid-glass-dark'

export interface ThemeMeta {
  id: ThemeId
  name: string
  group: string
  hasDarkVariant: boolean
  darkVariant?: ThemeId
  lightVariant?: ThemeId
  preview: { bg: string; accent: string }
}

export const BLOG_THEME_KEY = 'mysite_theme_v2'
const JOURNAL_THEME_KEY = 'study-journal-theme'
const DEFAULT_THEME: ThemeId = 'classic-light'

export const THEME_REGISTRY: ThemeMeta[] = [
  {
    id: 'classic-light',
    name: '经典·白',
    group: 'classic',
    hasDarkVariant: true,
    darkVariant: 'classic-dark',
    preview: { bg: '#F8F9FA', accent: '#4F46E5' },
  },
  {
    id: 'classic-dark',
    name: '经典·黑',
    group: 'classic',
    hasDarkVariant: true,
    lightVariant: 'classic-light',
    preview: { bg: '#0B0F19', accent: '#818CF8' },
  },
  {
    id: 'aurora',
    name: '极光紫夜',
    group: 'aurora',
    hasDarkVariant: false,
    preview: { bg: '#080D0E', accent: '#A655F6' },
  },
  {
    id: 'rose-garden',
    name: '玫瑰花园',
    group: 'rose',
    hasDarkVariant: false,
    preview: { bg: '#FFF5F7', accent: '#FD7397' },
  },
  {
    id: 'ocean-breeze',
    name: '海风青韵',
    group: 'ocean',
    hasDarkVariant: false,
    preview: { bg: '#F0FFFE', accent: '#01B8C2' },
  },
  {
    id: 'warm-sunset',
    name: '暖阳珊瑚',
    group: 'sunset',
    hasDarkVariant: false,
    preview: { bg: '#FFF8F0', accent: '#E88A5A' },
  },
  {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    group: 'glass',
    hasDarkVariant: true,
    darkVariant: 'liquid-glass-dark',
    preview: { bg: '#F2F2F7', accent: '#007AFF' },
  },
  {
    id: 'liquid-glass-dark',
    name: 'Liquid Glass·暗',
    group: 'glass',
    hasDarkVariant: true,
    lightVariant: 'liquid-glass',
    preview: { bg: '#000000', accent: '#0A84FF' },
  },
]

const THEME_IDS = new Set<string>(THEME_REGISTRY.map((t) => t.id))

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && THEME_IDS.has(value)
}

export function isThemeDark(id: ThemeId): boolean {
  return id.includes('dark') || id === 'aurora'
}

export function parseStoredThemeId(raw: string | null): ThemeId | null {
  if (!raw) return null
  let value = raw
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'string') value = parsed
  } catch {
    /* VueUse string serializer stores a bare id */
  }
  return isThemeId(value) ? value : null
}

export function readStoredThemeId(): ThemeId {
  try {
    localStorage.removeItem(JOURNAL_THEME_KEY)
  } catch {
    /* ignore */
  }
  try {
    const stored = parseStoredThemeId(localStorage.getItem(BLOG_THEME_KEY))
    if (stored) return stored
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

export function writeStoredThemeId(id: ThemeId) {
  localStorage.setItem(BLOG_THEME_KEY, id)
}

export function applyTheme(id: ThemeId) {
  if (typeof document === 'undefined') return
  const dark = isThemeDark(id)
  document.documentElement.setAttribute('data-theme', id)
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

/** Grid entries: hide classic-dark; keep both glass variants. */
export const THEME_PICKER_ITEMS = THEME_REGISTRY.filter(
  (t) => !t.id.includes('-dark') || t.group === 'glass',
)

export function isPickerThemeActive(current: ThemeId, item: ThemeMeta): boolean {
  if (current === item.id) return true
  if (item.darkVariant && current === item.darkVariant) {
    return !THEME_PICKER_ITEMS.some((t) => t.id === item.darkVariant)
  }
  return false
}
