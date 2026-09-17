import { nanoid } from 'nanoid';
import type {
  CheckInPayload,
  CompleteTaskPayload,
  GoalCreatePayload,
  GoalDetail,
  GoalMonth,
  GoalTask,
  TodayGoals,
} from '../types/goal';
import { apiFetch } from './http';
import { emitJournalChanged } from './journalEvents';

function periodParam(period: string): string {
  return encodeURIComponent(period);
}

export async function getGoalsByPeriod(period: string): Promise<GoalMonth> {
  return apiFetch<GoalMonth>(`/goals?period=${periodParam(period)}`);
}

export async function getTodayGoals(date: string): Promise<TodayGoals> {
  return apiFetch<TodayGoals>(`/goals/today?date=${encodeURIComponent(date)}`);
}

export async function getGoal(id: string): Promise<GoalDetail> {
  return apiFetch<GoalDetail>(`/goals/${encodeURIComponent(id)}`);
}

export async function createGoal(payload: GoalCreatePayload): Promise<GoalDetail> {
  const data = await apiFetch<GoalDetail>('/goals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  emitJournalChanged();
  return data;
}

export async function updateGoal(
  id: string,
  patch: { title?: string; targetValue?: number; unit?: string; color?: string; note?: string; status?: string },
): Promise<GoalDetail> {
  const data = await apiFetch<GoalDetail>(`/goals/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  emitJournalChanged();
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  await apiFetch<void>(`/goals/${encodeURIComponent(id)}`, { method: 'DELETE' });
  emitJournalChanged();
}

export async function addGoalTask(
  goalId: string,
  task: { title: string; dueDate?: string | null; weekStart?: string | null },
): Promise<GoalDetail> {
  const data = await apiFetch<GoalDetail>(`/goals/${encodeURIComponent(goalId)}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      id: nanoid(),
      title: task.title,
      dueDate: task.dueDate ?? '',
      weekStart: task.weekStart ?? '',
    }),
  });
  emitJournalChanged();
  return data;
}

export async function updateGoalTask(
  goalId: string,
  taskId: string,
  task: Pick<GoalTask, 'title'> & { dueDate?: string | null; weekStart?: string | null; sortOrder?: number },
): Promise<GoalDetail> {
  const data = await apiFetch<GoalDetail>(
    `/goals/${encodeURIComponent(goalId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        title: task.title,
        dueDate: task.dueDate ?? '',
        weekStart: task.weekStart ?? '',
        sortOrder: task.sortOrder,
      }),
    },
  );
  emitJournalChanged();
  return data;
}

export async function deleteGoalTask(goalId: string, taskId: string): Promise<GoalDetail> {
  const data = await apiFetch<GoalDetail>(
    `/goals/${encodeURIComponent(goalId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE' },
  );
  emitJournalChanged();
  return data;
}

export async function completeGoalTask(
  goalId: string,
  taskId: string,
  payload: CompleteTaskPayload = {},
): Promise<GoalDetail> {
  const data = await apiFetch<GoalDetail>(
    `/goals/${encodeURIComponent(goalId)}/tasks/${encodeURIComponent(taskId)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  emitJournalChanged();
  return data;
}

export async function upsertCheckIn(
  goalId: string,
  date: string,
  payload: CheckInPayload,
): Promise<GoalDetail> {
  const data = await apiFetch<GoalDetail>(
    `/goals/${encodeURIComponent(goalId)}/checkins/${encodeURIComponent(date)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ id: payload.id ?? nanoid(), ...payload }),
    },
  );
  emitJournalChanged();
  return data;
}

export async function deleteCheckIn(goalId: string, date: string): Promise<GoalDetail> {
  const data = await apiFetch<GoalDetail>(
    `/goals/${encodeURIComponent(goalId)}/checkins/${encodeURIComponent(date)}`,
    { method: 'DELETE' },
  );
  emitJournalChanged();
  return data;
}

export async function carryOverGoal(goalId: string): Promise<GoalDetail> {
  const data = await apiFetch<GoalDetail>(`/goals/${encodeURIComponent(goalId)}/carry-over`, {
    method: 'POST',
  });
  emitJournalChanged();
  return data;
}

export function formatPeriod(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/** 创建数量型目标时的日/周配额预览（按整月均分） */
export function previewCountSplit(target: number, period: string): {
  days: number;
  plannedDaily: number;
  plannedWeekly: number;
} {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m || target < 1) {
    return { days: 0, plannedDaily: 0, plannedWeekly: 0 };
  }
  const days = new Date(y, m, 0).getDate();
  const weeks = Math.max(1, Math.ceil(days / 7));
  return {
    days,
    plannedDaily: Math.ceil(target / days),
    plannedWeekly: Math.ceil(target / weeks),
  };
}
