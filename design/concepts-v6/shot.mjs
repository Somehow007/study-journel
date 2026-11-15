// 用法：node design/concepts-v6/shot.mjs a-graphite [b-notebook ...]   → shots/<concept>/<page>-desktop|mobile.png
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const PAGES = ['today','calendar','plan','goal','memory','stats','annual','search','settings','login','learn-form','goal-form','focus'];
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1980, height: 1100 }, deviceScaleFactor: 2 });
for (const n of process.argv.slice(2)) {
  mkdirSync(`design/concepts-v6/shots/${n}`, { recursive: true });
  for (const p of PAGES) {
    await page.goto(pathToFileURL(resolve(`design/concepts-v6/${n}.html`)).href + `?page=${p}`);
    await page.waitForTimeout(200);
    if (await page.evaluate(() => document.body.dataset.skip === '1')) continue;
    await page.locator('#desk').screenshot({ path: `design/concepts-v6/shots/${n}/${p}-desktop.png` });
    if (await page.locator('#mobile').count()) await page.locator('#mobile').screenshot({ path: `design/concepts-v6/shots/${n}/${p}-mobile.png` });
    console.log('✓', n, p);
  }
}
await browser.close();
