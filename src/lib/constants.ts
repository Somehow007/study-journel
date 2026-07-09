import type { MoodConfig, MoodType } from '../types';

/** 心情配置表 — 浅色模式 */
export const MOOD_CONFIGS: Record<MoodType, MoodConfig> = {
  happy: {
    type: 'happy',
    label: '开心',
    emoji: '😊',
    main: '#FFB938',
    light: '#FFD66B',
    dark: '#FFA51F',
    soft: '#FFEAB0',
    softDark: '#3A2F1A',
    glow: 'rgba(255,185,56,0.20)',
    gradient: 'linear-gradient(160deg, #FFD66B, #FFA51F)',
  },
  calm: {
    type: 'calm',
    label: '平静',
    emoji: '☁️',
    main: '#4DB8E5',
    light: '#6ECBF5',
    dark: '#38A5D8',
    soft: '#C5E8F8',
    softDark: '#1A2C35',
    glow: 'rgba(77,184,229,0.20)',
    gradient: 'linear-gradient(160deg, #6ECBF5, #38A5D8)',
  },
  sad: {
    type: 'sad',
    label: '低落',
    emoji: '🌧️',
    main: '#9B7AD9',
    light: '#B394E8',
    dark: '#8360CA',
    soft: '#D5C5F5',
    softDark: '#2A2238',
    glow: 'rgba(155,122,217,0.20)',
    gradient: 'linear-gradient(160deg, #B394E8, #8360CA)',
  },
  inspired: {
    type: 'inspired',
    label: '灵感',
    emoji: '💡',
    main: '#E876C4',
    light: '#F59AD4',
    dark: '#D458B0',
    soft: '#F2C8E8',
    softDark: '#321E2B',
    glow: 'rgba(232,118,196,0.20)',
    gradient: 'linear-gradient(160deg, #F59AD4, #D458B0)',
  },
  anxious: {
    type: 'anxious',
    label: '焦虑',
    emoji: '⚡',
    main: '#FF7E5C',
    light: '#FF9C7E',
    dark: '#F56040',
    soft: '#FFCDBF',
    softDark: '#34211D',
    glow: 'rgba(255,126,92,0.20)',
    gradient: 'linear-gradient(160deg, #FF9C7E, #F56040)',
  },
  tired: {
    type: 'tired',
    label: '疲惫',
    emoji: '😴',
    main: '#B69A7E',
    light: '#C9B098',
    dark: '#A08263',
    soft: '#E5D0BC',
    softDark: '#2B2319',
    glow: 'rgba(182,154,126,0.18)',
    gradient: 'linear-gradient(160deg, #C9B098, #A08263)',
  },
};

/** 心情顺序列表 */
export const MOOD_LIST: MoodType[] = ['happy', 'calm', 'sad', 'inspired', 'anxious', 'tired'];

/** 学科标记点预设颜色（8 种果冻色） */
export const SUBJECT_COLORS: string[] = [
  '#FFB938', // 蜂蜜金
  '#4DB8E5', // 天空蓝
  '#9B7AD9', // 薰衣草紫
  '#E876C4', // 花瓣粉
  '#FF7E5C', // 珊瑚橙
  '#B69A7E', // 摩卡棕
  '#5BC690', // 薄荷绿
  '#E8A84B', // 杏黄
];

/** 星期中文标签 */
export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/** 月份中文标签 */
export const MONTH_LABELS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];
