/** 日期工具函数 */

/** 格式化为 YYYY-MM-DD */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 从 YYYY-MM-DD 解析为 Date 对象 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 获取中文星期 */
export function getWeekdayChinese(date: Date): string {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return weekdays[date.getDay()];
}

/** 格式化完整日期：2026年7月5日 星期六 */
export function formatFullDate(dateStr: string): string {
  const date = parseDate(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${getWeekdayChinese(date)}`;
}

/** 获取某月日历网格数据（含前后月补位） */
export function getCalendarDays(year: number, month: number): {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  dateStr: string;
}[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // ISO Monday-first: convert JS day (0=Sun) to Monday=0..Sunday=6
  const jsDay = firstDay.getDay();
  const startWeekday = jsDay === 0 ? 6 : jsDay - 1;
  const daysInMonth = lastDay.getDate();

  const days: { date: Date; day: number; isCurrentMonth: boolean; dateStr: string }[] = [];

  // 前面补位（上月末尾几天）
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({
      date: d,
      day: d.getDate(),
      isCurrentMonth: false,
      dateStr: formatDate(d),
    });
  }

  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    days.push({
      date,
      day: d,
      isCurrentMonth: true,
      dateStr: formatDate(date),
    });
  }

  // 后面补位到 42 格（6 行）
  while (days.length < 42) {
    const lastDate = days[days.length - 1].date;
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 1);
    days.push({
      date: nextDate,
      day: nextDate.getDate(),
      isCurrentMonth: false,
      dateStr: formatDate(nextDate),
    });
  }

  return days;
}

/** 是否为今天 */
export function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

/** 分钟转可读时长 — v4.0: Xh Ym 格式 */
export function formatDuration(min: number): string {
  if (min === 0) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** 计算学习记录总时长（分钟） */
export function totalDuration(learnings: { durationMin: number }[]): number {
  return learnings.reduce((sum, l) => sum + l.durationMin, 0);
}
