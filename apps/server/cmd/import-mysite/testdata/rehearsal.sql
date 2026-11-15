-- import-mysite 本地演练数据（scratch 库 sj_rehearsal，不污染 mysite.sj_*）
-- 覆盖：内置/自定义/空/非法 mood；科目去重+最新色；note 首行→title；
-- COUNT/CHECKLIST 目标；goal→subject 颜色匹配；task done 回退/双日期互斥/
-- learning_client_id→entry；checkin quantity 校验；坏 period/孤儿行；
-- 第二 user_id（验证 -source-user-id 守卫）。
-- 执行：docker exec -i mysite-mysql mysql -uroot -p<PW> sj_rehearsal < rehearsal.sql

SET NAMES utf8mb4;

-- 自定义心情：1 正常 / 1 空标签（跳过）/ 1 非法颜色（回退默认）
INSERT INTO sj_custom_mood (id, user_id, label, emoji, solid, ink, tint, dark_colors, created_at) VALUES
('cmMood001', 1, '番茄钟', '🍅', '#AA1122', '#111111', '#EEEEEE', '{}', 1700000000000),
('cmMood002', 1, '',        '❓', '#000000', '#111111', '#EEEEEE', '{}', 1700000001000),
('cmMood003', 1, '坏色',     '🎨', 'reddish', '#111111', '#EEEEEE', '{}', 1700000002000);

-- 日记录：内置 mood / 自定义 mood / NULL / 非法 mood / 第二用户
INSERT INTO sj_day_record (id, user_id, `date`, mood, diary, created_at, updated_at) VALUES
(1, 1, '2026-10-01', 'happy',    '# 十月\n第一天',        1767225600000, 1767312000000),
(2, 1, '2026-10-02', 'cmMood001', NULL,                  1767312000000, 1767398400000),
(3, 1, '2026-10-03', NULL,        '无心情日记',           1767398400000, 1767484800000),
(4, 1, '2026-10-04', 'bogusMood', '',                     1767484800000, 1767571200000),
(5, 1, '2026-10-05', 'tired',     NULL,                   1767571200000, 1767657600000),
(6, 1, '2026-11-10', 'calm',      '# 备考',               1768032000000, 1768118400000),
(8, 1, '2026-11-05', NULL,        NULL,                   1767657600000, 1767744000000),
(7, 2, '2026-10-01', 'sad',       '别人的日记',           1767225600000, 1767225600000);

-- 学习条目（record_id → 上表 id）
INSERT INTO sj_learning_item (id, record_id, client_id, subject, duration_min, note, color, sort_order) VALUES
(11, 1, 'cliA',     '数学一', 120, '张宇基础30讲\n第1-3讲', '#3B5BDB', 0),
(12, 1, 'cliB',     '数学一',  60, '错题本',              '#3B5BDB', 1),
(13, 2, 'cliC',     '英语一',  45, '',                    '#FAB005', 0),
(14, 3, 'cliD',     '   ',     30, '随手记',              '#000000', 0),
(15, 4, 'cliE',     '政治',     0, '坏时长',              '#000000', 0),
(16, 5, 'cliF',     '408',     90, '数据结构',            '#2F9E44', 0),
(17, 5, 'cliG',     '408',     30, '组成原理',            '#2F9E44', 1),
(18, 6, 'chk1',     '政治',     40, '肖1000 day10',       '#D6336C', 0),   -- checkin chk1 同步条目
(19, 8, 'tDone',    '英语一',  50, '写作模板',            '#FAB005', 0),   -- task tDone 同步条目
(20, 7, 'u9item',   '别人的',   10, 'u2条目',             '#111111', 0);   -- user_id=2，经 record 7

-- 月计划目标
INSERT INTO sj_goal (id, user_id, period, title, type, target_value, unit, color, note, sort_order, status, created_at, updated_at) VALUES
('gMath', 1, '2026-10', '数学一1000题',  'COUNT',     1000, '题',   '#3B5BDB', '',      0, 'ACTIVE',   1760000000000, 1760000000000),
('gEng',  1, '2026-10', '英语作文20篇',  'CHECKLIST', NULL,  NULL,  '#123456', 'note',  1, 'ACTIVE',   1760000000000, 1760000000000),
('gNov',  1, '2026-11', '十一月清单',    'CHECKLIST', NULL,  NULL,  '#abcdef', '',      0, 'ACTIVE',   1761000000000, 1761000000000),
('gBad',  1, '2026-13', '坏月份',        'COUNT',        5, NULL,  '#000000', '',      2, 'ACTIVE',   1760000000000, 1760000000000),
('gOld',  1, '2026-09', '九月目标',      'COUNT',       10, '套',   '#000000', '',      0, 'ARCHIVED', 1758000000000, 1758000000000),
('gU2',   2, '2026-10', '别人目标',      'COUNT',        3, '题',   '#111111', '',      0, 'ACTIVE',   1760000000000, 1760000000000);

-- 清单子任务
INSERT INTO sj_goal_task (id, goal_id, title, due_date, week_start, done, done_at, duration_min, reflection, learning_client_id, sort_order, created_at, updated_at) VALUES
('tDone',  'gNov', '写一篇作文',        '2026-11-05', NULL,         1, NULL,         50, '写完了',   'tDone', 0, 1761000000000, 1762000000000),
('tWeek',  'gNov', '每周一练',          NULL,         '2026-11-02', 0, NULL,         NULL, '',       NULL,    1, 1761000000000, 1761000000000),
('tBoth',  'gNov', '双绑任务',          '2026-11-06', '2026-11-02', 0, NULL,         NULL, '',       NULL,    2, 1761000000000, 1761000000000),
('tOrph',  'gBad', '孤儿任务',          NULL,         NULL,         0, NULL,         NULL, '',       NULL,    0, 1761000000000, 1761000000000),
('tEmpty', 'gNov', '',                  NULL,         NULL,         0, NULL,         NULL, '',       NULL,    3, 1761000000000, 1761000000000);

-- 数量打卡
INSERT INTO sj_goal_checkin (id, goal_id, `date`, quantity, duration_min, note, learning_client_id, created_at, updated_at) VALUES
('chk1',    'gMath', '2026-11-10', 50, 40, '',      'chk1', 1762000000000, 1762000000000),
('chkBad',  'gMath', '2026-11-11',  0, NULL, '',    NULL,   1762000000000, 1762000000000),
('chkOrph', 'gBad',  '2026-11-12',  5, NULL, '',    NULL,   1762000000000, 1762000000000),
('chkU2',   'gU2',   '2026-10-20',  2, NULL, '',    NULL,   1762000000000, 1762000000000);
