// v6 概念稿共用假数据：考研日常。心情 key 与后端一致（happy/calm/sad/inspired/anxious/tired），只换语义与配色。
window.STATES = {
  inspired:{label:'专注'}, happy:{label:'顺利'}, calm:{label:'平稳'},
  tired:{label:'疲惫'}, anxious:{label:'焦虑'}, sad:{label:'低落'},
};
window.EXAM = { name:'2027 考研初试', date:'2027.12.18', left:398 };
window.SUBJECTS = { math:'数学一', cs:'408', eng:'英语一', pol:'政治' };
window.TODAY = {
  date:'11.15', dateCn:'11月15日', week:'SUN', weekCn:'周日', state:'inspired', streak:23, goalMin:360,
  learnings:[
    {k:'math', t:'多元函数微分学', n:'张宇 18 讲 · 第 9 讲；1000 题 9.1–9.30', m:150},
    {k:'cs',   t:'B 树 / B+ 树',   n:'王道数据结构 7.4；手推插入删除各 2 遍', m:90},
    {k:'eng',  t:'2012 真题 Text 2', n:'精读 + 长难句 6 句 + 单词 Unit 23', m:60},
    {k:'pol',  t:'马原 · 认识论',  n:'肖秀荣精讲精练 第 3 章', m:45},
  ],
  tasks:[
    {k:'math', t:'1000 题 第 9 章 30 题', done:true},
    {k:'eng',  t:'单词 Unit 23 复习',      done:true},
    {k:'cs',   t:'王道 7.4 课后选择题',    done:false},
    {k:'pol',  t:'1000 题 马原 第 3 章',   done:false},
  ],
  diary:'B+ 树删除合并那块终于理顺了，下午卡在方向导数的几何意义，晚上重看了一遍讲义。明天先把 408 课后题补完。',
};
window.GOALS = [
  {k:'math', t:'张宇 1000 题 · 基础篇', v:612, total:1000, u:'题', hint:'日均 26 题可达成'},
  {k:'cs',   t:'王道 408 一轮',         v:19,  total:32,   u:'章', hint:'本周还需 3 章'},
  {k:'eng',  t:'英一真题 2005–2015',    v:7,   total:11,   u:'套', hint:'每周 2 套'},
  {k:'pol',  t:'精讲精练 · 马原',       v:6,   total:9,    u:'章', hint:'领先计划 1 章'},
];
// 11 月：1–15 已过
const st=['calm','inspired','tired','happy','inspired','anxious','calm','inspired','happy','tired','inspired','sad','calm','happy','inspired'];
const mn=[300,410,180,360,450,240,330,420,390,150,480,120,310,370,345];
window.MONTH = Array.from({length:30},(_,i)=>i<15?{d:i+1,state:st[i],min:mn[i],today:i===14}:{d:i+1,future:true});
window.MONTH_OFFSET = 6; // 2026-11-01 是周日（周一开头时偏移 6）
// 近 26 周热力：分钟
let s=7; const rnd=()=>{s=(s*9301+49297)%233280;return s/233280};
window.HEAT = Array.from({length:26*7},(_,i)=>{const r=rnd(); if(i===26*7-1) return 345; return r<0.1?0:Math.round(40+r*440)});
window.WEEK = [{d:'一',m:420},{d:'二',m:390},{d:'三',m:150},{d:'四',m:480},{d:'五',m:120},{d:'六',m:310},{d:'日',m:345}];
window.fmt = m => `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;
window.totalMin = TODAY.learnings.reduce((a,b)=>a+b.m,0);

// ===== v6.1 扩展：全部页面假数据 =====
window.SUBJECT_KEYS = ['math','cs','eng','pol'];
window.PAGES = [
  ['today','今日','TodayDetail.tsx'],['calendar','日历','MonthView.tsx + DateCard.tsx'],['plan','计划','PlanView.tsx'],
  ['goal','目标详情','GoalDetail.tsx'],['memory','时光','Memory.tsx'],['stats','统计','Stats.tsx'],['annual','年度回顾','AnnualReview.tsx'],
  ['search','搜索','Search.tsx'],['settings','设置','Settings.tsx'],['login','登录','LoginPage.tsx'],
  ['learn-form','记一条（弹层）','LearningFormModal.tsx'],['goal-form','新建目标（弹层）','GoalFormModal.tsx'],
];
// 计划页：本月目标（COUNT / CHECKLIST）
window.PLAN = {
  period:'2026-11', avg:63,
  goals:[
    {id:'g1',k:'math',type:'COUNT',t:'张宇 1000 题 · 基础篇',v:612,total:1000,u:'题',daily:26,remainDays:15,status:'落后 18 题'},
    {id:'g2',k:'cs',type:'CHECKLIST',t:'王道 408 一轮',v:19,total:32,u:'章',status:'本周 3 章',
      tasks:[{t:'7.3 树形查找 · 课后题',done:true,due:'11.13'},{t:'7.4 B 树 / B+ 树',done:true,due:'11.15'},{t:'7.4 课后选择题',done:false,due:'11.15'},{t:'7.5 散列表',done:false,due:'11.17'},{t:'8.1–8.3 插入 / 交换排序',done:false,week:'11.16 周'}]},
    {id:'g3',k:'eng',type:'COUNT',t:'英一真题 2005–2015',v:7,total:11,u:'套',daily:null,weekly:2,remainDays:15,status:'按计划'},
    {id:'g4',k:'pol',type:'CHECKLIST',t:'精讲精练 · 马原',v:6,total:9,u:'章',status:'领先 1 章',
      tasks:[{t:'第 3 章 认识论',done:true,due:'11.15'},{t:'第 4 章 唯物史观',done:false,due:'11.20'}]},
  ],
};
// 目标详情：COUNT 型（张宇 1000 题）
window.GOAL = {
  ...PLAN.goals[0], plannedDaily:33, suggestedDaily:26, remaining:388, note:'基础篇必须 11 月底前刷完，12 月进强化。',
  checkins: Object.fromEntries([[1,40],[2,35],[3,0],[4,42],[5,50],[6,20],[7,38],[8,45],[9,40],[10,15],[11,55],[12,0],[13,48],[14,44],[15,30]].map(([d,q])=>[d,q])),
  weeks:[{w:'10.27–11.02',a:75,p:66},{w:'11.03–11.09',a:250,p:231},{w:'11.10–11.16',a:192,p:231},{w:'11.17–11.23',a:0,p:182},{w:'11.24–11.30',a:0,p:182}],
};
// 时光：倒序时间线
window.MEMORY = [
  {date:'11.15',w:'周日',state:'inspired',min:345,subs:['math','cs','eng','pol'],diary:'B+ 树删除合并那块终于理顺了，下午卡在方向导数的几何意义，晚上重看了一遍讲义。'},
  {date:'11.14',w:'周六',state:'happy',min:370,subs:['math','cs','eng'],diary:'1000 题第 8 章全对，奖励自己一杯咖啡。'},
  {date:'11.13',w:'周五',state:'calm',min:310,subs:['math','pol'],diary:''},
  {date:'11.12',w:'周四',state:'sad',min:120,subs:['eng'],diary:'状态很差，阅读错了 4 道。早点睡，明天重来。'},
  {date:'11.11',w:'周三',state:'inspired',min:480,subs:['math','cs','eng','pol'],diary:'一天 8 小时，第一次满格。图书馆闭馆才走。'},
  {date:'11.10',w:'周二',state:'tired',min:150,subs:['cs'],diary:''},
];
// 统计（本月）
window.STATS = {
  month:'11 月', totalMin:5120, days:15, avgMin:341, topState:'inspired', longest:23,
  subjects:[{k:'math',m:2280},{k:'cs',m:1420},{k:'eng',m:860},{k:'pol',m:560}],
  states:{inspired:5,happy:3,calm:3,tired:2,anxious:1,sad:1},
};
window.ANNUAL = {
  year:2026, totalH:1046, days:268, longest:31, topState:'calm',
  months:[42,38,65,80,96,104,128,131,118,112,85,0].map((h,i)=>({m:i+1,h,future:i===11})),
  subjects:[{k:'math',h:420},{k:'cs',h:300},{k:'eng',h:210},{k:'pol',h:116}],
};
window.SEARCH = { q:'B+ 树', results:[
  {date:'2026.11.15',state:'inspired',hit:'subject',k:'cs',text:'<mark>B+ 树</mark> / B 树 — 王道数据结构 7.4；手推插入删除各 2 遍'},
  {date:'2026.11.15',state:'inspired',hit:'diary',text:'<mark>B+ 树</mark>删除合并那块终于理顺了，下午卡在方向导数的几何意义…'},
  {date:'2026.11.13',state:'calm',hit:'note',k:'cs',text:'7.3 树形查找课后题，预习 <mark>B+ 树</mark>的定义'},
]};
window.SETTINGS = { dailyGoal:360, examDate:'2027-12-18', examName:'2027 考研初试',
  customStates:[{label:'摆烂',color:'#8A8F98'},{label:'冲刺',color:'#FF6A2B'}] };
// 统计 / 年度 共用：科目合计
window.sumMin = arr => arr.reduce((a,b)=>a+(b.m??b.h??0),0);
window.getPage = () => new URLSearchParams(location.search).get('page') || 'today';
