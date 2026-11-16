// 视觉对照种子：数据仿 design/concepts-v6/data.js（考研 4 科），日期相对「今天」生成。
// 用法：API=http://127.0.0.1:8091/api/v1 USER=visual PASS=visual1234 node seed.mjs  → stdout 打印 COUNT 目标 id
// 只能对一次性临时库跑（会写入大量数据）；绝不能指向 8090 / 真实 journal.db。
const B = process.env.API ?? 'http://127.0.0.1:8091/api/v1';
if (/:8090\b/.test(B)) throw new Error('拒绝对 8090（开发/真实库）灌种子');
let cookie = '';
async function req(m, p, body) {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json(); if (j.code !== '0') throw new Error(`${m} ${p} ${JSON.stringify(j)}`); return j.data;
}
const pad = (n) => String(n).padStart(2, '0');
const now = new Date(); const Y = now.getFullYear(), M = now.getMonth() + 1, D = now.getDate();
const period = `${Y}-${pad(M)}`; const day = (d) => `${period}-${pad(d)}`;
const shiftMonth = (k) => { const t = new Date(Y, M - 1 + k, 1); return [t.getFullYear(), t.getMonth() + 1, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()]; };

await req('POST', '/auth/login', { username: process.env.USER_NAME ?? 'visual', password: process.env.PASS ?? 'visual1234' });
const ex = new Date(Y + 1, 11, 18);
await req('PATCH', '/settings', { examName: `${Y + 1} 考研初试`, examDate: `${ex.getFullYear()}-12-18`, theme: 'notebook' });
const S = Object.fromEntries((await req('GET', '/subjects')).map((s) => [s.name, s.id]));
const ST = Object.fromEntries((await req('GET', '/states')).map((s) => [s.builtinKey, s.id]));
const k = { math: S['数学一'], cs: S['408'], eng: S['英语一'], pol: S['政治'] };
const st = ['calm','inspired','tired','happy','inspired','anxious','calm','inspired','happy','tired','inspired','sad','calm','happy','inspired'];
const mn = [300,410,180,360,450,240,330,420,390,150,480,120,310,370,345];
const todayRows = [['math','多元函数微分学','张宇 18 讲 · 第 9 讲；1000 题 9.1–9.30',150],['cs','B 树 / B+ 树','王道数据结构 7.4；手推插入删除各 2 遍',90],['eng','2012 真题 Text 2','精读 + 长难句 6 句 + 单词 Unit 23',60],['pol','马原 · 认识论','肖秀荣精讲精练 第 3 章',45]];
const diaries = ['1000 题第 8 章全对，奖励自己一杯咖啡。','状态很差，阅读错了 4 道。早点睡，明天重来。','一天 8 小时，第一次满格。图书馆闭馆才走。'];
for (let d = 1; d <= D; d++) {
  const i = (d - 1) % 15, date = day(d);
  const diary = d === D ? 'B+ 树删除合并那块终于理顺了，下午卡在方向导数的几何意义，晚上重看了一遍讲义。明天先把 408 课后题补完。' : d % 3 === 0 ? diaries[d % diaries.length] : undefined;
  await req('PATCH', `/days/${date}`, { stateId: ST[st[i]], ...(diary ? { diary } : {}) });
  if (d === D) { for (const [s, t, n, m] of todayRows) await req('POST', '/entries', { date, subjectId: k[s], title: t, note: n, durationMin: m }); continue; }
  let left = mn[i]; const ks = ['math','cs','eng','pol'], sp = [.42,.25,.18,.15], tt = ['1000 题','王道 408','真题精读','精讲精练'];
  for (let j = 0; j < 4; j++) { const m = j < 3 ? Math.round(mn[i] * sp[j]) : left; left -= m; await req('POST', '/entries', { date, subjectId: k[ks[j]], title: tt[j], durationMin: m }); }
}
// 往前 5 个月稀疏数据：喂热力图 / 年度回顾
for (let back = 1; back <= 5; back++) {
  const [y, m, dim] = shiftMonth(-back);
  for (let d = 1; d <= dim; d++) { if ((d + back) % 6 === 0) continue;
    const date = `${y}-${pad(m)}-${pad(d)}`;
    await req('POST', '/entries', { date, subjectId: k.math, title: '1000 题', durationMin: 100 + (d * 37 + back * 11) % 200 });
    await req('POST', '/entries', { date, subjectId: [k.cs, k.eng, k.pol][d % 3], title: '复习', durationMin: 50 + (d * 53) % 130 }); }
}
const dueIn = (n) => day(Math.min(Math.max(1, D + n), new Date(Y, M, 0).getDate()));
const g1 = await req('POST', '/goals', { period, title: '张宇 1000 题 · 基础篇', type: 'COUNT', targetValue: 1000, unit: '题', subjectId: k.math });
const q = [40,35,0,42,50,20,38,45,40,15,55,0,48,44,30];
for (let d = 1; d <= D; d++) if (q[(d - 1) % 15]) await req('PUT', `/goals/${g1.id}/checkins/${day(d)}`, { quantity: q[(d - 1) % 15], date: day(d) });
const g2 = await req('POST', '/goals', { period, title: '王道 408 一轮', type: 'CHECKLIST', subjectId: k.cs });
for (const [t, n, done] of [['7.3 树形查找 · 课后题',-2,1],['7.4 B 树 / B+ 树',0,1],['7.4 课后选择题',0,0],['7.5 散列表',2,0],['8.1–8.3 插入 / 交换排序',5,0]]) {
  const x = await req('POST', `/goals/${g2.id}/tasks`, { title: t, dueDate: dueIn(n) }); if (done) await req('POST', `/tasks/${x.id}/complete`, { date: dueIn(n) }); }
const g3 = await req('POST', '/goals', { period, title: '英一真题 2005–2015', type: 'COUNT', targetValue: 11, unit: '套', subjectId: k.eng });
for (let d = 2; d <= D; d += 2) await req('PUT', `/goals/${g3.id}/checkins/${day(d)}`, { quantity: 1, date: day(d) });
const g4 = await req('POST', '/goals', { period, title: '精讲精练 · 马原', type: 'CHECKLIST', subjectId: k.pol });
for (const [t, n, done] of [['第 3 章 认识论',-1,1],['第 4 章 唯物史观',4,0]]) {
  const x = await req('POST', `/goals/${g4.id}/tasks`, { title: t, dueDate: dueIn(n) }); if (done) await req('POST', `/tasks/${x.id}/complete`, { date: dueIn(n) }); }
console.log(g1.id);
