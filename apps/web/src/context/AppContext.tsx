import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useMe, useSettings, qk } from '../lib/queries';
import { patchSettings } from '../lib/api';
import { showToast } from '../lib/toast';
import type { Setting, SettingsPatch, User } from '../lib/types/api';

/** 每日学习目标默认值（分钟）与合法区间（服务端 1–1440，UI 沿用旧区间） */
const DEFAULT_DAILY_GOAL_MIN = 360; // 与服务端 setting 默认一致
const GOAL_MIN_LIMITS = { min: 15, max: 960 };
const GOAL_STORAGE_KEY = 'study-journal-daily-goal-min';
/** 首登迁移完成标记：localStorage 旧 dailyGoalMin → setting 只上报一次 */
const SETTINGS_MIGRATED_KEY = 'study-journal-settings-migrated';

interface AppContextValue {
  /** undefined=会话判定中；null=未登录；User=已登录 */
  user: User | null | undefined;
  settings: Setting | undefined;
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
  const qc = useQueryClient();
  const meQuery = useMe();
  const user = meQuery.isPending ? undefined : (meQuery.data ?? null);

  // settings 仅登录后拉取（避免登录页触发 401）
  const settingsQuery = useSettings(user != null);
  const settings = settingsQuery.data;

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

  // settings 写入：乐观更新 + 失败回滚
  const updateSettings = useMutation({
    mutationFn: (patch: SettingsPatch) => patchSettings(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: qk.settings });
      const prev = qc.getQueryData<Setting>(qk.settings);
      if (prev) qc.setQueryData<Setting>(qk.settings, { ...prev, ...patch });
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.settings, ctx.prev);
      showToast('设置保存失败', 'error');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.settings });
    },
  });

  const setDailyGoalMin = useCallback(
    (min: number) => {
      const clamped = Math.min(GOAL_MIN_LIMITS.max, Math.max(GOAL_MIN_LIMITS.min, Math.round(min)));
      updateSettings.mutate({ dailyGoalMin: clamped });
    },
    [updateSettings],
  );

  // 首登迁移：localStorage 旧 dailyGoalMin → 服务端 setting（一次性）
  useEffect(() => {
    if (!settings || localStorage.getItem(SETTINGS_MIGRATED_KEY)) return;
    localStorage.setItem(SETTINGS_MIGRATED_KEY, '1');
    const legacy = parseInt(localStorage.getItem(GOAL_STORAGE_KEY) ?? '', 10);
    if (
      Number.isFinite(legacy) &&
      legacy >= GOAL_MIN_LIMITS.min &&
      legacy <= GOAL_MIN_LIMITS.max &&
      legacy !== settings.dailyGoalMin
    ) {
      updateSettings.mutate({ dailyGoalMin: legacy });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const dailyGoalMin = settings?.dailyGoalMin ?? DEFAULT_DAILY_GOAL_MIN;

  return (
    <AppContext.Provider
      value={{
        user,
        settings,
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
