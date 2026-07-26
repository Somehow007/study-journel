import type { MoodConfig, MoodType } from '../types';

/** 心情配置表 — 花园六色 · 浅色模式 + 深色模式（v5.0 花期）
 *  每种心情 = 一种花 + 三档色：solid（花瓣实色/选中态/图表）、
 *  ink（深调，tint 底上的文字）、tint（浅底，大面积铺垫）。 */
export const MOOD_CONFIGS: Record<MoodType, MoodConfig> = {
  happy: {
    type: 'happy',
    label: '开心',
    emoji: '😊',
    flower: '向日葵金',
    solid: '#F0B429',
    ink: '#8A6410',
    tint: '#FBF1D6',
    dark: { solid: '#F5C35A', ink: '#F0DCA8', tint: '#3A3016' },
  },
  calm: {
    type: 'calm',
    label: '平静',
    emoji: '☁️',
    flower: '绣球蓝',
    solid: '#6C9BD1',
    ink: '#33597F',
    tint: '#E3EDF7',
    dark: { solid: '#8FB6DE', ink: '#CFE2F2', tint: '#1E2A38' },
  },
  sad: {
    type: 'sad',
    label: '低落',
    emoji: '🌧️',
    flower: '薰衣草紫',
    solid: '#9B8FC9',
    ink: '#584E85',
    tint: '#ECE8F5',
    dark: { solid: '#B3A8D9', ink: '#DCD6F0', tint: '#262238' },
  },
  inspired: {
    type: 'inspired',
    label: '灵感',
    emoji: '💡',
    flower: '樱粉',
    solid: '#E58AAE',
    ink: '#8F3E61',
    tint: '#FAE6EF',
    dark: { solid: '#EEA3C0', ink: '#F6D3E2', tint: '#38202C' },
  },
  anxious: {
    type: 'anxious',
    label: '焦虑',
    emoji: '⚡',
    flower: '虞美人橙',
    solid: '#E98A5F',
    ink: '#8F4B28',
    tint: '#FBE8DE',
    dark: { solid: '#F0A077', ink: '#F6DAC8', tint: '#382518' },
  },
  tired: {
    type: 'tired',
    label: '疲惫',
    emoji: '😴',
    flower: '鼠尾草绿',
    solid: '#93A693',
    ink: '#556352',
    tint: '#E8ECE4',
    dark: { solid: '#A9BCA9', ink: '#D8E2D4', tint: '#242C22' },
  },
};

/** 心情顺序列表 */
export const MOOD_LIST: MoodType[] = ['happy', 'calm', 'sad', 'inspired', 'anxious', 'tired'];

/** 学科标记点色板（8 色，花园色板） */
export const SUBJECT_COLORS: string[] = [
  '#F0B429', // 向日葵金
  '#6C9BD1', // 绣球蓝
  '#9B8FC9', // 薰衣草紫
  '#E58AAE', // 樱粉
  '#E98A5F', // 虞美人橙
  '#93A693', // 鼠尾草绿
  '#57A773', // 亮绿
  '#4A7BA6', // 黛蓝
];

/** 星期中文标签（周一起始） */
export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

/** 月份中文标签 */
export const MONTH_LABELS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];
