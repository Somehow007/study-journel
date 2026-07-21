import type { MoodConfig, MoodType, PaletteType } from '../types';

/** 心情配置表 — 明快六色 · 浅色模式 + 深色模式（三套配色主题共用） */
export const MOOD_CONFIGS: Record<MoodType, MoodConfig> = {
  happy: {
    type: 'happy',
    label: '开心',
    emoji: '😊',
    solid: '#F4A62A',
    ink: '#8A5A0A',
    tint: '#FDEFCE',
    dark: { solid: '#F7BC57', ink: '#F5DCA8', tint: '#3A2E16' },
  },
  calm: {
    type: 'calm',
    label: '平静',
    emoji: '☁️',
    solid: '#3AA7D9',
    ink: '#1A6488',
    tint: '#DBEFF8',
    dark: { solid: '#5FBEE6', ink: '#C9E9F7', tint: '#1B2F38' },
  },
  sad: {
    type: 'sad',
    label: '低落',
    emoji: '🌧️',
    solid: '#9487D8',
    ink: '#4E4483',
    tint: '#E7E4F7',
    dark: { solid: '#AB9FE4', ink: '#DED9F6', tint: '#262338' },
  },
  inspired: {
    type: 'inspired',
    label: '灵感',
    emoji: '💡',
    solid: '#E56AA0',
    ink: '#8E2F5C',
    tint: '#FBDEEA',
    dark: { solid: '#EF85B5', ink: '#F9D3E4', tint: '#37202B' },
  },
  anxious: {
    type: 'anxious',
    label: '焦虑',
    emoji: '⚡',
    solid: '#F0833E',
    ink: '#8F4511',
    tint: '#FDE5D4',
    dark: { solid: '#F89A5F', ink: '#FADCC6', tint: '#3A2517' },
  },
  tired: {
    type: 'tired',
    label: '疲惫',
    emoji: '😴',
    solid: '#7E8FA8',
    ink: '#45536B',
    tint: '#E3E9F1',
    dark: { solid: '#98A8BF', ink: '#D4DDE9', tint: '#232A36' },
  },
};

/** 心情顺序列表 */
export const MOOD_LIST: MoodType[] = ['happy', 'calm', 'sad', 'inspired', 'anxious', 'tired'];

/** 学科标记点预设颜色（8 色：心情 solid 六色 + 松绿 + 黛蓝） */
export const SUBJECT_COLORS: string[] = [
  '#F4A62A', // 明黄
  '#3AA7D9', // 天青
  '#9487D8', // 藤紫
  '#E56AA0', // 樱粉
  '#F0833E', // 蜜柑橙
  '#7E8FA8', // 灰蓝
  '#3D9B6A', // 松绿
  '#4A7BA6', // 黛蓝
];

/** 配色主题元信息（设置页选项 UI 用；实际色值见 index.css 的 data-palette 变量块） */
export interface PaletteMeta {
  id: PaletteType;
  label: string;
  hint: string;
  /** 选项色板预览：纸底 / 品牌色 */
  swatch: { paper: string; brand: string };
}

export const PALETTES: PaletteMeta[] = [
  { id: 'coral', label: '珊瑚', hint: '暖白纸 × 珊瑚红', swatch: { paper: '#FBF9F6', brand: '#F4645B' } },
  { id: 'teal', label: '青碧', hint: '冷白纸 × 青绿', swatch: { paper: '#F5F8F7', brand: '#0E9F8A' } },
  { id: 'violet', label: '蓝紫', hint: '冷灰纸 × 蓝紫', swatch: { paper: '#F7F7FA', brand: '#6C5CE7' } },
];

/** 星期中文标签 */
export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/** 月份中文标签 */
export const MONTH_LABELS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];
