import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { PaletteType } from '../types';

interface AppContextValue {
  /** 当前查看的月份 */
  currentMonth: { year: number; month: number };
  setCurrentMonth: (year: number, month: number) => void;
  /** 主题 */
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  /** 配色主题 */
  palette: PaletteType;
  setPalette: (palette: PaletteType) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [currentMonth, setCurrentMonthState] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('study-journal-theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [palette, setPaletteState] = useState<PaletteType>(() => {
    const stored = localStorage.getItem('study-journal-palette');
    if (stored === 'coral' || stored === 'teal' || stored === 'violet') return stored;
    return 'coral';
  });

  const setCurrentMonth = useCallback((year: number, month: number) => {
    setCurrentMonthState({ year, month });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('study-journal-theme', next);
      return next;
    });
  }, []);

  const setPalette = useCallback((next: PaletteType) => {
    setPaletteState(next);
    localStorage.setItem('study-journal-palette', next);
  }, []);

  return (
    <AppContext.Provider
      value={{ currentMonth, setCurrentMonth, theme, toggleTheme, palette, setPalette }}
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
