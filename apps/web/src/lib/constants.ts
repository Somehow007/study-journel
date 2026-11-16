/** 共享常量（v3：内置状态来自服务端种子，MOOD_CONFIGS 已移除） */

/** 科目/状态取色板（SPEC-B §1.2 前 4 位为考研四科默认色，后 4 位为自定义扩展色） */
export const SUBJECT_COLORS: string[] = [
  '#1E4FA3', // 数学一
  '#2F6B4F', // 408
  '#B07A12', // 英语一
  '#D23B22', // 政治
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

/** 月份英文缩写（格纸 meta 行用） */
export const EN_MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];
