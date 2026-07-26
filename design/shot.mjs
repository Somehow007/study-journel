import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shotsDir = path.join(__dirname, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });

const screens = ['board', 'today', 'garden', 'timeline', 'stats', 'dark', 'mobile'];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 1200 },
  deviceScaleFactor: 2,
});

await page.goto('file://' + path.join(__dirname, 'mockup.html'));

// 等字体加载完成
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2000);

// 确认关键字体确实加载成功
const fontCheck = await page.evaluate(() => ({
  serif: document.fonts.check('16px "Noto Serif SC"'),
  mono: document.fonts.check('16px "IBM Plex Mono"'),
  fraunces: document.fonts.check('italic 16px "Fraunces"'),
}));
console.log('fonts:', JSON.stringify(fontCheck));
if (!fontCheck.serif || !fontCheck.mono || !fontCheck.fraunces) {
  console.error('字体未加载成功，放弃截图');
  await browser.close();
  process.exit(1);
}

for (const id of screens) {
  const el = await page.$('#' + id);
  if (!el) { console.error('找不到 section #' + id); continue; }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await el.screenshot({ path: path.join(shotsDir, id + '.png') });
  console.log('shot:', id + '.png');
}

await browser.close();
console.log('done.');
