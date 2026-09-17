import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import {
  type ThemeId,
  BLOG_THEME_KEY,
  applyTheme,
  isThemeDark,
  pairedThemeId,
  parseStoredThemeId,
  readStoredThemeId,
  transitionTheme,
  writeStoredThemeId,
} from '../lib/theme';

/** 每日学习目标默认值（分钟）与合法区间 */
const DEFAULT_DAILY_GOAL_MIN = 240; // 4h
const GOAL_MIN_LIMITS = { min: 15, max: 960 };
const GOAL_STORAGE_KEY = 'study-journal-daily-goal-min';

interface AppContextValue {
  currentMonth: { year: number; month: number };
  setCurrentMonth: (year: number, month: number) => void;
  theme: ThemeId;
  isDark: boolean;
  setTheme: (id: ThemeId) => void;
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
  const [theme, setThemeState] = useState<ThemeId>(readStoredThemeId);

  const setCurrentMonth = useCallback((year: number, month: number) => {
    setCurrentMonthState({ year, month });
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    writeStoredThemeId(id);
    transitionTheme(id);
    setThemeState(id);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = pairedThemeId(prev);
      if (!next) return prev;
      writeStoredThemeId(next);
      transitionTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== BLOG_THEME_KEY) return;
      const next = parseStoredThemeId(event.newValue);
      if (!next) return;
      applyTheme(next);
      setThemeState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
      value={{
        currentMonth,
        setCurrentMonth,
        theme,
        isDark: isThemeDark(theme),
        setTheme,
        toggleTheme,
        dailyGoalMin,
        setDailyGoalMin,
      }}
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
