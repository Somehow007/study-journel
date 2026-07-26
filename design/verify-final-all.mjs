import { chromium } from 'playwright';

// 收尾全站走查：种子数据 → 浅色 7 路由 → 深色 4 路由 → 移动端
// 前置：dev server 已在 http://localhost:5173 运行

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });

// 心情磁贴文案已改为短标签（开心/平静/…），种子脚本按可见文案点击
const MOODS = ['开心', '平静', '低落', '灵感', '焦虑', '疲惫'];
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => {
  const d = new Date(2026, 6, 26); // 2026-07-26 本地
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

async function capture(name) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `design/shots/${name}.png`, fullPage: true });
  console.log(`✓ ${name}`);
}

async function seedMood(dateStr, moodName) {
  await page.goto(`http://localhost:5173/day/${dateStr}`);
  await page.waitForTimeout(900);
  await page.locator('button').filter({ hasText: moodName }).first().click();
  await page.waitForTimeout(400);
}

async function seedLearning(subject, hours, minutes, colorIndex = 0) {
  await page.locator('button').filter({ hasText: '添加' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('input[type="text"]').first().fill(subject);
  await page.locator('input[type="number"]').nth(0).fill(String(hours));
  await page.locator('input[type="number"]').nth(1).fill(String(minutes));
  await page.locator('form button.h-4.w-4').nth(colorIndex).click(); // 选标记色，确保环形图多色分段
  await page.waitForTimeout(150);
  await page.locator('button').filter({ hasText: '添加' }).last().click();
  await page.waitForTimeout(400);
}

// ---- 种子数据：过去 6 天每天一个心情，其中 3 天加学习记录；今天完整种子 ----
for (let i = 6; i >= 1; i--) {
  await seedMood(day(i), MOODS[i % MOODS.length]);
  if (i === 5) await seedLearning('TypeScript 泛型', 1, 40, 2);
  if (i === 3) await seedLearning('Vite 插件', 0, 50, 6);
  if (i === 1) {
    await seedLearning('React 性能优化', 2, 10, 1);
    await seedLearning('虚拟列表实践', 2, 5, 3); // 合计 4h15m，越过默认目标 4h → 花田可见「达成果实」
    await page.locator('textarea').fill('把列表虚拟化换成自己的实现，滚动顺滑了很多。');
    await page.waitForTimeout(1800);
  }
}

// 今天
await page.goto(`http://localhost:5173/day/${day(0)}`);
await page.waitForTimeout(1200);
await page.locator('button').filter({ hasText: '开心' }).first().click();
await page.waitForTimeout(500);
await seedLearning('React 组件设计', 2, 30, 0);
await page.locator('textarea').fill('下午把 useReducer 的思路理顺了，像给一团毛线找到了线头。傍晚下了十分钟太阳雨，窗外的绣球蓝得很好看。');
await page.waitForTimeout(2000);

// ---- 浅色模式：全部路由 ----
await page.goto(`http://localhost:5173/day/${day(0)}`);
await capture('walk-today-light');
await page.goto('http://localhost:5173/');
await capture('walk-garden-light');
await page.goto('http://localhost:5173/memory');
await capture('walk-memory-light');
await page.goto('http://localhost:5173/stats');
await capture('walk-stats-light');
await page.goto('http://localhost:5173/annual');
await capture('walk-annual-light');
await page.goto('http://localhost:5173/search');
await capture('walk-search-light');
await page.goto('http://localhost:5173/settings');
await capture('walk-settings-light');

// ---- 深色模式：核心路由 ----
await page.goto('http://localhost:5173/');
await page.waitForTimeout(600);
await page.locator('button').filter({ hasText: '深色模式' }).first().click();
await page.waitForSelector('html.dark', { timeout: 5000 });
await capture('walk-garden-dark');
await page.goto(`http://localhost:5173/day/${day(0)}`);
await capture('walk-today-dark');
await page.goto('http://localhost:5173/memory');
await capture('walk-memory-dark');
await page.goto('http://localhost:5173/stats');
await capture('walk-stats-dark');

// ---- 移动端 ----
const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
await mobile.goto(`http://localhost:5173/day/${day(0)}`);
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: 'design/shots/walk-mobile-today.png', fullPage: true });
console.log('✓ walk-mobile-today');
await mobile.goto('http://localhost:5173/');
await mobile.waitForTimeout(1200);
await mobile.screenshot({ path: 'design/shots/walk-mobile-garden.png', fullPage: true });
console.log('✓ walk-mobile-garden');

await browser.close();
console.log('done');
