import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 渲染 mockup.html 各 section 为截图，便于与 walk-*.png 逐屏对比
const url = pathToFileURL(resolve('design/mockup.html')).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
await page.goto(url);
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(1200); // 等 Google Fonts 到位

const sections = ['board', 'today', 'garden', 'timeline', 'stats', 'dark'];
for (const id of sections) {
  const el = page.locator(`#${id}`);
  await el.screenshot({ path: `design/shots/mock-${id}.png` });
  console.log(`✓ mock-${id}`);
}
// 移动端：截手机壳
const phone = page.locator('#mobile .phone');
await phone.screenshot({ path: 'design/shots/mock-mobile.png' });
console.log('✓ mock-mobile');

await browser.close();
console.log('done');
