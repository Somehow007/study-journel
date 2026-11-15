/**
 * TanStack Query 封装 —— queryKey 常量 + useQuery 薄封装 + 全量失效助手。
 * 写操作后调用 invalidateAll()（对齐旧 emitJournalChanged 全量刷新语义；
 * RQ 只重取活跃查询，单用户小数据量下开销可忽略）。
 */
import { keepPreviousData, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  getDay,
  getSettings,
  getStreak,
  listDayMarks,
  listStates,
  listSubjects,
  searchJournal,
  statsMonth,
  statsYear,
  exportAllData,
} from './api';
import { getGoal, getGoalsByPeriod, getTodayGoals } from './goalApi';
import { fetchMe } from './auth';
import type {
  DayDetail,
  DayMark,
  ExportData,
  GoalDetail,
  GoalMonth,
  JournalState,
  SearchResult,
  Setting,
  StatsMonth,
  StatsYear,
  StreakResult,
  Subject,
  TodayGoals,
  User,
} from './types/api';

export const qk = {
  me: ['me'] as const,
  settings: ['settings'] as const,
  subjects: ['subjects'] as const,
  states: ['states'] as const,
  day: (date: string) => ['day', date] as const,
  days: (from: string, to: string) => ['days', from, to] as const,
  goals: (period: string) => ['goals', period] as const,
  goal: (id: string) => ['goal', id] as const,
  todayGoals: (date: string) => ['today-goals', date] as const,
  search: (keyword: string, type: string) => ['search', keyword, type] as const,
  statsMonth: (period: string) => ['stats', 'month', period] as const,
  statsYear: (year: number) => ['stats', 'year', year] as const,
  streak: ['streak'] as const,
  exportAll: ['export'] as const,
};

// ─── hooks ───────────────────────────────────────────

export function useMe(): UseQueryResult<User | null> {
  return useQuery({ queryKey: qk.me, queryFn: fetchMe, staleTime: 60_000, retry: 1 });
}

export function useSettings(enabled = true): UseQueryResult<Setting> {
  return useQuery({ queryKey: qk.settings, queryFn: getSettings, enabled });
}

export function useSubjects(enabled = true): UseQueryResult<Subject[]> {
  return useQuery({ queryKey: qk.subjects, queryFn: listSubjects, enabled });
}

export function useStates(enabled = true): UseQueryResult<JournalState[]> {
  return useQuery({ queryKey: qk.states, queryFn: listStates, enabled });
}

export function useDay(date: string, enabled = true): UseQueryResult<DayDetail> {
  return useQuery({ queryKey: qk.day(date), queryFn: () => getDay(date), enabled });
}

export function useDayMarks(from: string, to: string, enabled = true): UseQueryResult<DayMark[]> {
  return useQuery({ queryKey: qk.days(from, to), queryFn: () => listDayMarks(from, to), enabled });
}

export function useGoalsByPeriod(period: string, enabled = true): UseQueryResult<GoalMonth> {
  return useQuery({ queryKey: qk.goals(period), queryFn: () => getGoalsByPeriod(period), enabled });
}

export function useGoal(id: string, enabled = true): UseQueryResult<GoalDetail> {
  return useQuery({ queryKey: qk.goal(id), queryFn: () => getGoal(id), enabled });
}

export function useTodayGoals(date: string, enabled = true): UseQueryResult<TodayGoals> {
  return useQuery({ queryKey: qk.todayGoals(date), queryFn: () => getTodayGoals(date), enabled });
}

export function useSearch(keyword: string, type: 'all' | 'entry' | 'diary' = 'all'): UseQueryResult<SearchResult> {
  const q = keyword.trim();
  return useQuery({
    queryKey: qk.search(q, type),
    queryFn: () => searchJournal(q, type),
    enabled: q.length > 0,
    // 搜索输入抖动时保留上一份结果，避免每次击键闪烁 loading
    placeholderData: keepPreviousData,
  });
}

export function useStatsMonth(period: string, enabled = true): UseQueryResult<StatsMonth> {
  return useQuery({ queryKey: qk.statsMonth(period), queryFn: () => statsMonth(period), enabled });
}

export function useStatsYear(year: number, enabled = true): UseQueryResult<StatsYear> {
  return useQuery({ queryKey: qk.statsYear(year), queryFn: () => statsYear(year), enabled });
}

export function useStreak(enabled = true): UseQueryResult<StreakResult> {
  return useQuery({ queryKey: qk.streak, queryFn: getStreak, enabled });
}

export function useExportData(enabled = true): UseQueryResult<ExportData> {
  return useQuery({ queryKey: qk.exportAll, queryFn: exportAllData, enabled, staleTime: 30_000 });
}

// ─── 失效 ────────────────────────────────────────────

/** 写操作后调用：失效全部查询（活跃查询自动重取） */
export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

/** 便捷版：拿到 queryClient 后直接失效（供非 hook 场景/回调使用） */
export function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries();
}
