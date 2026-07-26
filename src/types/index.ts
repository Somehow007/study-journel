// 学习手帐 — 核心类型定义 (v5.0 花期 Blossom)

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
  mood: string | null;  // 内置 MoodType 或自定义心情的 nanoid
  learnings: LearningItem[];
  diary: string;
  createdAt: number;
  updatedAt: number;
}

/** 深色模式三档色 */
export interface MoodDarkColors {
  solid: string;
  ink: string;
  tint: string;
}

/** 心情配置（花园三档色：solid/ink/tint + 深色模式）
 * 内置 6 种的 type 为 MoodType 字面量，自定义心情的 type 为 nanoid 字符串。 */
export interface MoodConfig {
  type: string;                   // 内置 MoodType | 自定义 nanoid
  label: string;
  emoji: string;                  // 降级为辅助场景（自定义心情表达、空状态文案）
  flower?: string;                // 花名（如「向日葵金」）；自定义心情没有
  solid: string;                  // 花瓣实色：盖花态/图表/选择器选中
  ink: string;                    // 深调：tint 底上的文字
  tint: string;                   // 浅底：大面积铺垫
  dark: MoodDarkColors;           // 深色模式三档
}

/** 自定义心情存储（三档色结构） */
export interface CustomMoodConfig {
  id: string;                     // nanoid
  label: string;
  emoji: string;
  solid: string;
  ink: string;
  tint: string;
  dark: MoodDarkColors;
  createdAt: number;
}
