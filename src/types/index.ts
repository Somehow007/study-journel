// 学习手帐 — 核心类型定义 (v4.0 纸上手帐·编辑风)

/** 心情类型枚举 */
export type MoodType = 'happy' | 'calm' | 'sad' | 'inspired' | 'anxious' | 'tired';

/** 配色主题枚举（与 index.css 中 data-palette 对应） */
export type PaletteType = 'coral' | 'teal' | 'violet';

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

/** 心情配置（v4.0 矿物三档色：solid/ink/tint + 深色模式）
 * 内置 6 种的 type 为 MoodType 字面量，自定义心情的 type 为 nanoid 字符串。 */
export interface MoodConfig {
  type: string;                   // 内置 MoodType | 自定义 nanoid
  label: string;
  emoji: string;                  // 降级为辅助场景（tooltip、空状态文案）；自定义心情为主要表达方式
  solid: string;                  // 饱和实色：印章态/图表/刻度条
  ink: string;                    // 深调：tint 底上的文字与图标
  tint: string;                   // 淡底：大面积铺垫
  dark: MoodDarkColors;           // 深色模式三档
}

/** 自定义心情存储（v4.0 对齐三档色结构） */
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
