// Phase A 临时验收脚本：dev server 截图（首页月历 + 今日页，浅/深色）
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://localhost:5199';

const today = new Date();
const fmt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

// 跳过首启加载动画
await page.addInitScript(() => sessionStorage.setItem('study-journal-loaded', '1'));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(__dirname, 'shots', 'dev-home-light.png') });
console.log('home light ok');

await page.goto(`${BASE}/day/${fmt}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(__dirname, 'shots', 'dev-today-light.png') });
console.log('today light ok');

// 深色模式
await page.evaluate(() => localStorage.setItem('study-journal-theme', 'dark'));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(__dirname, 'shots', 'dev-home-dark.png') });
console.log('home dark ok');

await page.goto(`${BASE}/day/${fmt}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(__dirname, 'shots', 'dev-today-dark.png') });
console.log('today dark ok');

await browser.close();
console.log('done.');
