export type GoalType = 'COUNT' | 'CHECKLIST';
export type GoalStatus = 'ACTIVE' | 'ARCHIVED';

export interface GoalTask {
  id: string;
  goalId: string;
  title: string;
  dueDate: string | null;
  weekStart: string | null;
  done: boolean;
  doneAt: number | null;
  durationMin: number | null;
  reflection: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface GoalCheckIn {
  id: string;
  goalId: string;
  date: string;
  quantity: number;
  durationMin: number | null;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface WeekProgress {
  weekStart: string;
  weekEnd: string;
  actual: number;
  planned: number;
}

export interface DayMark {
  total: number;
  done: number;
}

export interface GoalSummary {
  id: string;
  period: string;
  title: string;
  type: GoalType;
  targetValue: number | null;
  unit: string | null;
  color: string;
  note: string;
  sortOrder: number;
  status: GoalStatus;
  percent: number;
  reached: boolean;
  actualValue: number;
  totalValue: number;
  plannedDaily: number | null;
  plannedWeekly: number | null;
  suggestedDaily: number | null;
  suggestedWeekly: number | null;
  remaining: number | null;
  remainingDays: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface GoalDetail extends GoalSummary {
  tasks: GoalTask[];
  checkins: GoalCheckIn[];
  weeks: WeekProgress[];
}

export interface GoalMonth {
  period: string;
  monthPercent: number;
  reachedCount: number;
  goalCount: number;
  goals: GoalSummary[];
  dayMarks: Record<string, DayMark>;
}

export interface TodayGoalItem {
  goalId: string;
  title: string;
  type: GoalType;
  color: string;
  percent: number;
  reached: boolean;
  unit: string | null;
  targetValue: number | null;
  actualValue: number | null;
  remaining: number | null;
  suggestedToday: number | null;
  todayCheckin: GoalCheckIn | null;
  todayTasks: GoalTask[];
}

export interface TodayGoals {
  date: string;
  items: TodayGoalItem[];
}

export interface GoalCreatePayload {
  id: string;
  period: string;
  title: string;
  type: GoalType;
  targetValue?: number;
  unit?: string;
  color: string;
  note?: string;
}

export interface CompleteTaskPayload {
  done?: boolean;
  durationMin?: number;
  reflection?: string;
  syncLearning?: boolean;
  date?: string;
}

export interface CheckInPayload {
  id?: string;
  quantity: number;
  durationMin?: number;
  note?: string;
  syncLearning?: boolean;
}
