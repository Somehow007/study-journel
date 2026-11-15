/**
 * 连续记录天数（与 GET /api/journal/streak 一致）。
 * 入参：有任意记录（心情/学习/日记）的 YYYY-MM-DD 日期数组（可无序、可重复）。
 * 规则：从今天向前回溯；今天无记录则返回 0（不从昨天起算）。
 * 跨月/跨年由 Date 进位自然处理。纯函数。
 */
export function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const recorded = new Set(dates);

  const fmt = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!recorded.has(fmt(cursor))) return 0;

  let streak = 0;
  while (recorded.has(fmt(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
