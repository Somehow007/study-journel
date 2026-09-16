import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/** 每日学习目标默认值（分钟）与合法区间 */
const DEFAULT_DAILY_GOAL_MIN = 240; // 4h
const GOAL_MIN_LIMITS = { min: 15, max: 960 };
const GOAL_STORAGE_KEY = 'study-journal-daily-goal-min';
const JOURNAL_THEME_KEY = 'study-journal-theme';
const BLOG_THEME_KEY = 'mysite_theme_v2';

function readBlogThemeId(): string | null {
  try {
    const raw = localStorage.getItem(BLOG_THEME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'string' ? parsed : raw;
  } catch {
    try {
      return localStorage.getItem(BLOG_THEME_KEY);
    } catch {
      return null;
    }
  }
}

/** 博客主题：id 含 dark 或为 aurora → 深色，其余浅色 */
export function isBlogThemeDark(id: string | null): boolean {
  if (!id) return false;
  return id.includes('dark') || id === 'aurora';
}

function resolveInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem(JOURNAL_THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  const blogId = readBlogThemeId();
  if (blogId) return isBlogThemeDark(blogId) ? 'dark' : 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface AppContextValue {
  currentMonth: { year: number; month: number };
  setCurrentMonth: (year: number, month: number) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  dailyGoalMin: number;
  setDailyGoalMin: (min: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [currentMonth, setCurrentMonthState] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(resolveInitialTheme);

  const setCurrentMonth = useCallback((year: number, month: number) => {
    setCurrentMonthState({ year, month });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(JOURNAL_THEME_KEY, next);
      return next;
    });
  }, []);

  const [dailyGoalMin, setDailyGoalMinState] = useState<number>(() => {
    const stored = parseInt(localStorage.getItem(GOAL_STORAGE_KEY) ?? '', 10);
    if (Number.isFinite(stored) && stored >= GOAL_MIN_LIMITS.min && stored <= GOAL_MIN_LIMITS.max) {
      return stored;
    }
    return DEFAULT_DAILY_GOAL_MIN;
  });

  const setDailyGoalMin = useCallback((min: number) => {
    const clamped = Math.min(GOAL_MIN_LIMITS.max, Math.max(GOAL_MIN_LIMITS.min, Math.round(min)));
    setDailyGoalMinState(clamped);
    localStorage.setItem(GOAL_STORAGE_KEY, String(clamped));
  }, []);

  return (
    <AppContext.Provider
      value={{ currentMonth, setCurrentMonth, theme, toggleTheme, dailyGoalMin, setDailyGoalMin }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
