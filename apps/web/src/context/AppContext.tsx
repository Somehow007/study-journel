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
  THEME_CACHE_KEY,
  applyTheme,
  isThemeDark,
  pairedThemeId,
  readThemeCache,
  resolveThemeId,
  transitionTheme,
  writeThemeCache,
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
  const [theme, setThemeState] = useState<ThemeId>(readThemeCache);

  const setCurrentMonth = useCallback((year: number, month: number) => {
    setCurrentMonthState({ year, month });
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

  // 主题：cache 先行保证登录前首帧，settings 到达后服务端为准；写路径同步 PATCH
  const setTheme = useCallback(
    (id: ThemeId) => {
      writeThemeCache(id);
      transitionTheme(id);
      setThemeState(id);
      if (settings) updateSettings.mutate({ theme: id });
    },
    [settings, updateSettings],
  );

  const toggleTheme = useCallback(() => {
    const next = pairedThemeId(theme);
    if (next) setTheme(next);
  }, [theme, setTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 服务端主题同步：settings.theme 为准；未知值（DB 默认 graphite 等）回落 notebook，不回写
  const serverTheme = settings ? resolveThemeId(settings.theme) : null;
  useEffect(() => {
    if (!serverTheme || serverTheme === theme) return;
    writeThemeCache(serverTheme);
    applyTheme(serverTheme);
    setThemeState(serverTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverTheme]);

  // 跨标签页：另一窗口改了主题缓存时跟随（服务端值随后由 settings 同步校准）
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_CACHE_KEY) return;
      const next = resolveThemeId(event.newValue);
      applyTheme(next);
      setThemeState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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
