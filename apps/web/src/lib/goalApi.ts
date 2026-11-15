/**
 * 目标数据层（v3 /api/v1）—— goals/tasks/checkins。
 * 注意与旧版差异：task/checkin 写操作返回自身 DTO（不再返回整个 GoalDetail），
 * 调用方经 TanStack Query invalidate 刷新；complete/uncomplete 拆分；
 * syncLearning → createEntry（服务端生成 entry 并回填 entry_id）。
 */
import { apiFetch } from './http';
import type {
  CheckinRequest,
  CompleteTaskRequest,
  GoalDetail,
  GoalMonth,
  GoalPatch,
  GoalRequest,
  GoalTask,
  GoalCheckin,
  TaskPatch,
  TaskRequest,
  TodayGoals,
} from './types/api';

const enc = encodeURIComponent;

export async function getGoalsByPeriod(period: string): Promise<GoalMonth> {
  return apiFetch<GoalMonth>(`/goals?period=${enc(period)}`);
}

export async function getTodayGoals(date: string): Promise<TodayGoals> {
  return apiFetch<TodayGoals>(`/goals/today?date=${enc(date)}`);
}

export async function getGoal(id: string): Promise<GoalDetail> {
  return apiFetch<GoalDetail>(`/goals/${enc(id)}`);
}

export async function createGoal(payload: GoalRequest): Promise<GoalDetail> {
  return apiFetch<GoalDetail>('/goals', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateGoal(id: string, patch: GoalPatch): Promise<GoalDetail> {
  return apiFetch<GoalDetail>(`/goals/${enc(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

/** 归档（软删除），历史数据保留 */
export async function deleteGoal(id: string): Promise<void> {
  await apiFetch<unknown>(`/goals/${enc(id)}`, { method: 'DELETE' });
}

/** 结转到下一周期，返回新目标详情 */
export async function carryOverGoal(id: string): Promise<GoalDetail> {
  return apiFetch<GoalDetail>(`/goals/${enc(id)}/carry-over`, { method: 'POST' });
}

// ─── 任务 ────────────────────────────────────────────

export async function addGoalTask(goalId: string, task: TaskRequest): Promise<GoalTask> {
  return apiFetch<GoalTask>(`/goals/${enc(goalId)}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export async function updateGoalTask(taskId: string, patch: TaskPatch): Promise<GoalTask> {
  return apiFetch<GoalTask>(`/tasks/${enc(taskId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteGoalTask(taskId: string): Promise<void> {
  await apiFetch<unknown>(`/tasks/${enc(taskId)}`, { method: 'DELETE' });
}

/** 完成任务；createEntry=true 时服务端按 durationMin 生成学习条目并回填 entryId */
export async function completeGoalTask(taskId: string, payload: CompleteTaskRequest = {}): Promise<GoalTask> {
  return apiFetch<GoalTask>(`/tasks/${enc(taskId)}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uncompleteGoalTask(taskId: string): Promise<GoalTask> {
  return apiFetch<GoalTask>(`/tasks/${enc(taskId)}/uncomplete`, { method: 'POST' });
}

// ─── 打卡 ────────────────────────────────────────────

export async function upsertCheckIn(goalId: string, date: string, payload: CheckinRequest): Promise<GoalCheckin> {
  return apiFetch<GoalCheckin>(`/goals/${enc(goalId)}/checkins/${enc(date)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteCheckIn(goalId: string, date: string): Promise<void> {
  await apiFetch<unknown>(`/goals/${enc(goalId)}/checkins/${enc(date)}`, { method: 'DELETE' });
}

export function formatPeriod(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}
