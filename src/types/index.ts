// 学习手帐 — 核心类型定义

/** 心情类型枚举 */
export type MoodType = 'happy' | 'calm' | 'sad' | 'inspired' | 'anxious' | 'tired';

/** 单条学习记录 */
export interface LearningItem {
  id: string;
  subject: string;
  durationMin: number;
  note: string;
  color: string;
}

/** 单日完整记录 */
export interface DayRecord {
  id?: number;
  date: string; // YYYY-MM-DD
  mood: MoodType | null;
  learnings: LearningItem[];
  diary: string;
  createdAt: number;
  updatedAt: number;
}

/** 心情配置（静态常量） */
export interface MoodConfig {
  type: MoodType;
  label: string;
  emoji: string;
  main: string;
  light: string;
  dark: string;
  soft: string;        // 浅色模式软底色
  softDark: string;    // 深色模式软底色
  glow: string;
  gradient: string;
}
