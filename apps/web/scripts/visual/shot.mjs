// 视觉对照截图 + 报告。用法：WEB=http://localhost:5176/journal OUT=/tmp/sj-visual GOAL=<COUNT目标id> node shot.mjs
// 产出：$OUT/impl/<page>-<desktop|mobile>.png 与 $OUT/report.html（左概念稿 / 右实现，同宽并排）。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const W = process.env.WEB ?? 'http://localhost:5176/journal';
const OUT = process.env.OUT ?? '/tmp/sj-visual';
const GOAL = process.env.GOAL; if (!GOAL) throw new Error('需要 GOAL=<COUNT 目标 id>');
const SHOTS = resolve(process.env.SHOTS ?? 'design/concepts-v6/shots/b-notebook');
const ONLY = process.env.PAGES ? process.env.PAGES.split(',') : null;
mkdirSync(`${OUT}/impl`, { recursive: true });
// 浏览器：PW_CHROMIUM_PATH > 本机 Chrome（与 design/concepts-v6/shot.mjs 同口径）> playwright 自带
const browser = process.env.PW_CHROMIUM_PATH
  ? await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH })
  : await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const today = (() => { const n = new Date(), p = (x) => String(x).padStart(2, '0'); return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`; })();
const PAGES = [
  ['calendar', '/'], ['today', `/day/${today}`], ['plan', '/plan'], ['goal', `/plan/${GOAL}`], ['memory', '/memory'],
  ['stats', '/stats'], ['annual', '/annual'], ['search', '/search', async (p) => { await p.locator('input').first().fill('B+'); await p.waitForTimeout(900); }],
  ['settings', '/settings'],
  ['learn-form', `/day/${today}`, async (p) => { await p.getByText(/补一条/).first().click(); await p.waitForTimeout(500); }],
  ['goal-form', '/plan', async (p) => { await p.getByText(/新目标/).first().click(); await p.waitForTimeout(500); }],
].filter(([n]) => !ONLY || ONLY.includes(n));
const MOBILE = ['calendar', 'today', 'plan', 'goal', 'memory', 'stats', 'learn-form'];
const errs = [], rows = [];
async function run(vw, vh, kind, list) {
  // 手机档按触屏设备开 context：命中 (hover: none) 规则，截图与真机一致（桌面悬停态不会混进来）
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, ...(kind === 'mobile' ? { hasTouch: true, isMobile: true } : {}) });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(`${kind} ${page.url()} ${e.message}`));
  await page.goto(W + '/', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  if (kind === 'desktop' && (!ONLY || ONLY.includes('login'))) { await page.screenshot({ path: `${OUT}/impl/login-desktop.png` }); rows.push(['login', kind]); }
  await page.locator('input').nth(0).fill(process.env.USER_NAME ?? 'visual');
  await page.locator('input[type=password]').fill(process.env.PASS ?? 'visual1234');
  await page.locator('button[type=submit]').first().click(); await page.waitForTimeout(1800);
  for (const [name, path, act] of list) {
    await page.goto(W + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    if (act) await act(page);
    // 横向溢出自检：任何页面都不允许出现横向滚动
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) errs.push(`${kind} ${name} 横向溢出 ${overflow}px`);
    await page.screenshot({ path: `${OUT}/impl/${name}-${kind}.png`, fullPage: kind === 'desktop' && !act });
    rows.push([name, kind]); console.log('✓', name, kind);
  }
  await ctx.close();
}
await run(1440, 960, 'desktop', PAGES);
await run(390, 844, 'mobile', PAGES.filter(([n]) => MOBILE.includes(n)));
await browser.close();
const cell = (src, w) => existsSync(src) ? `<img src="file://${src}" style="width:${w}px">` : `<div style="width:${w}px;color:#999">（概念稿无此图）</div>`;
writeFileSync(`${OUT}/report.html`, `<!doctype html><meta charset=utf-8><title>B 视觉对照</title><body style="font:14px sans-serif;background:#ddd">
${errs.length ? `<pre style="color:#b00">${errs.join('\n')}</pre>` : '<p>零 pageerror / 零横向溢出</p>'}
${rows.map(([n, k]) => { const w = k === 'desktop' ? 720 : 390; return `<h3>${n} · ${k}（左概念 / 右实现）</h3><div style="display:flex;gap:16px;align-items:flex-start">${cell(`${SHOTS}/${n}-${k}.png`, w)}${cell(`${OUT}/impl/${n}-${k}.png`, w)}</div>`; }).join('\n')}`);
console.log(errs.length ? `问题 ${errs.length} 条：\n${errs.join('\n')}` : '零 pageerror / 零横向溢出');
console.log(`报告：${OUT}/report.html`);
