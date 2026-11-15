# 📔 学习手帐 — 网站集成与 MySQL 存储方案 v2.0

> 前置文档：《学习手帐 开发设计文档 v4.0》（视觉与交互规范，是本方案前端部分的设计依据）
> 目标：将学习手帐从「纯前端 + IndexedDB」演进为「个人网站子路由 + Spring Boot + MySQL」，数据按 `user_id` 隔离，先自用、预留多用户。
> **总原则：体验优先。** 不以「改动最小」为约束——借集成之机把 v4.0 视觉系统整体落地、把后端化带来的体验升级一次做透，前端该重写就重写。

---

## 1. 现状盘点

**当前形态**：纯前端 SPA（React 18 + Vite + TS），数据存浏览器 IndexedDB（Dexie.js），无后端。UI 仍是 v3.x「柔彩果冻风」，v4.0「纸上手帐·编辑风」已定稿但尚未实施（设计文档 P3 阶段）。

**数据层边界清晰**：全部持久化操作集中在 `src/lib/db.ts`，只有 8 个文件直接依赖它。这意味着**前端可以放心推倒重写**——重写后的页面只需面对同一组数据操作接口，底层是 IndexedDB 还是 HTTP 对页面代码无感。

**数据模型**（`src/types/index.ts`）：
- `DayRecord`：date（YYYY-MM-DD 字符串）、mood、learnings[]（内嵌数组）、diary（Markdown）、createdAt/updatedAt
- `CustomMoodConfig`：nanoid、label、emoji、三档色（solid/ink/tint + dark）

**结论**：这次集成不是「旧 UI + 换个存储」，而是三件事一起做——**v4.0 视觉落地 + API 数据层 + 体验升级清单**，产出一个新版前端，直接部署进网站。

---

## 2. 目标架构

```
┌───────────────────────── 个人网站 ─────────────────────────┐
│                                                           │
│  yoursite.com/journal/*  ← 手帐前端（v4.0 新版构建产物）    │
│        │                                                  │
│        ▼  /api/journal/**（同源请求，携带网站登录态）        │
│  Spring Boot 后端（新增 journal 模块/包）                   │
│        │                                                  │
│        ▼                                                  │
│  MySQL（网站现有库中新增 3 张 sj_ 前缀表）                  │
└───────────────────────────────────────────────────────────┘
```

- **前端**：新版手帐独立开发、独立构建，产物部署在网站的 `/journal` 路径下（详见第 7 节）。
- **后端**：在网站现有 Spring Boot 工程里新增 `journal` 包，与网站其它业务代码保持模块边界。
- **数据库**：网站现有 MySQL 库中新建表，`sj_` 前缀避免冲突。
- **登录态**：第一阶段先用配置的默认 `user_id`（如 `1`）跑通全链路；网站用户体系打通后从登录态解析真实 `user_id`，表结构与 API 不变。

---

## 3. MySQL 表设计

统一约定：`utf8mb4` / InnoDB；时间字段用 `BIGINT` 存 Unix 毫秒（与前端 `createdAt/updatedAt: number` 一致，避免时区换算）；`date` 存 `CHAR(10)` 字符串 `'YYYY-MM-DD'`（手帐的日期是「用户视角的日历日」，不带时区语义，不要用 `DATETIME`）。

### 3.1 单日记录表 `sj_day_record`

```sql
CREATE TABLE sj_day_record (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  date        CHAR(10)        NOT NULL COMMENT 'YYYY-MM-DD，用户本地日历日',
  mood        VARCHAR(32)     NULL     COMMENT '预设 6 种或自定义心情 id，NULL=未记录',
  diary       TEXT            NULL     COMMENT 'Markdown 原文',
  created_at  BIGINT          NOT NULL COMMENT 'Unix 毫秒',
  updated_at  BIGINT          NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_date (user_id, date),
  KEY idx_user_updated (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.2 学习条目表 `sj_learning_item`

`learnings` 从内嵌数组拆成独立表——既然上了 MySQL，就拿到关系型的好处：后续可以纯 SQL 做「按学科统计总时长」「年度学科分布」这类查询，也为更丰富的统计页打底。

```sql
CREATE TABLE sj_learning_item (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id    BIGINT UNSIGNED NOT NULL COMMENT '关联 sj_day_record.id',
  client_id    VARCHAR(21)     NOT NULL COMMENT '前端 nanoid，用于编辑时对齐条目',
  subject      VARCHAR(64)     NOT NULL,
  duration_min INT             NOT NULL,
  note         VARCHAR(512)    NOT NULL DEFAULT '',
  color        VARCHAR(7)      NOT NULL COMMENT '#RRGGBB',
  sort_order   INT             NOT NULL DEFAULT 0 COMMENT '当日清单内排序',
  PRIMARY KEY (id),
  KEY idx_record (record_id),
  CONSTRAINT fk_item_record FOREIGN KEY (record_id)
    REFERENCES sj_day_record (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.3 自定义心情表 `sj_custom_mood`

```sql
CREATE TABLE sj_custom_mood (
  id          VARCHAR(21)     NOT NULL COMMENT '前端 nanoid，直接作主键',
  user_id     BIGINT UNSIGNED NOT NULL,
  label       VARCHAR(16)     NOT NULL,
  emoji       VARCHAR(8)      NOT NULL DEFAULT '',
  solid       VARCHAR(7)      NOT NULL,
  ink         VARCHAR(7)      NOT NULL,
  tint        VARCHAR(7)      NOT NULL,
  dark_colors JSON            NOT NULL COMMENT '{"solid":"#…","ink":"#…","tint":"#…"}',
  created_at  BIGINT          NOT NULL,
  PRIMARY KEY (id),
  KEY idx_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3.4 字段映射说明

| 前端字段 | 落库方式 |
|---------|---------|
| `DayRecord.mood`（预设） | `sj_day_record.mood` 存枚举字符串，如 `'happy'` |
| `DayRecord.mood`（自定义） | 同上，存 `sj_custom_mood.id`（nanoid）。预设是固定单词、自定义是 nanoid，两者天然不碰撞，无需额外标记 |
| `LearningItem.id` | `sj_learning_item.client_id`，数据库主键与前端 id 解耦 |
| `MoodConfig.dark` | `sj_custom_mood.dark_colors` JSON 列 |

---

## 4. REST API 设计

统一前缀 `/api/journal`，请求/响应 JSON 与前端 TS 类型逐字段对齐（camelCase），前端拿到即用，不做数据转换。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/records/{date}` | 单日详情（含 learnings 数组） |
| GET | `/records?month=2026-07` | 按月查询（月历/画廊/统计） |
| GET | `/records?year=2026` | 按年查询（年度回顾） |
| PUT | `/records/{date}` | 创建或更新（upsert），body 为部分字段 |
| DELETE | `/records/{date}` | 删除整日记录 |
| GET | `/search?keyword=xxx` | 日记全文搜索，按 updatedAt 倒序 |
| GET | `/moods/custom` | 自定义心情列表 |
| POST | `/moods/custom` | 新增 |
| PUT | `/moods/custom/{id}` | 更新 |
| DELETE | `/moods/custom/{id}` | 删除 |
| POST | `/import` | 导入备份 JSON（兼容现有导出格式 v1/v2） |
| GET | `/export` | 导出全部数据（保持现有 JSON 格式） |

**关键接口示例**：

```http
PUT /api/journal/records/2026-07-18
Content-Type: application/json

{
  "mood": "inspired",
  "learnings": [
    { "id": "V1StGXR8_Z5j", "subject": "React 组件设计",
      "durationMin": 150, "note": "理解了 context 的坑", "color": "#5C93A8" }
  ],
  "diary": "今天把数据层抽象成了接口…"
}
```

服务端 upsert 逻辑：按 `(user_id, date)` 查唯一索引，存在则更新 `mood/diary/updated_at` 并**全量替换 learnings**（删旧插新，条目数量小，永远一致，省去 diff）；不存在则插入。响应返回完整 `DayRecord`。

**登录态**：请求走同源 cookie/session（网站已有认证机制）。`user_id` 在服务端从登录态解析，**禁止前端传 user_id**。第一阶段未接登录时用配置项 `journal.default-user-id: 1` 兜底。

---

## 5. Spring Boot 后端落地

在网站后端工程新增包（包名按网站实际根包）：

```
com.yoursite.journal/
├── controller/JournalController.java      // /api/journal/records、/search、/import、/export
├── controller/JournalMoodController.java  // /api/journal/moods/custom
├── service/JournalService.java            // upsert、按月/年查询、搜索
├── service/CustomMoodService.java
├── mapper/  (或 repository/)              // 跟网站现有 ORM 走，不另引一套
├── entity/DayRecordDO.java / LearningItemDO.java / CustomMoodDO.java
├── dto/DayRecordDTO.java                  // 与前端 DayRecord 逐字段对齐
└── config/JournalProperties.java          // default-user-id 等配置
```

约定：

- **ORM 跟网站现有栈走**（MyBatis-Plus 或 Spring Data JPA 均可，不要为手帐单独引入另一套）。
- **DTO 与 Entity 分开**：entity 用下划线列名，DTO 用 camelCase，直接序列化给前端。
- **事务**：`upsertRecord` 的「更新主表 + 全量替换 learnings」必须在一个 `@Transactional` 里。
- **校验**：`date` 格式 `^\d{4}-\d{2}-\d{2}$`、`durationMin > 0`、`mood` 合法性（预设枚举或属于该用户的自定义心情）由服务端 `@Valid` 校验。
- **搜索**：第一阶段 `LIKE '%keyword%'` 足够（个人数据量小）；不引入 ES。
- **用户隔离**：所有查询/写入强制带 `user_id` 条件，这是多用户预留的底线，Code Review 重点。

---

## 6. 体验升级清单（本方案的核心增量）

上了后端之后，下面这些体验是旧架构给不了或做不好的，按优先级落地：

| # | 体验项 | 说明 | 依赖 |
|---|--------|------|------|
| 1 | **跨设备同步** | 最大的体验升级：手机、电脑、平板打开都是同一份手帐，不再困在一个浏览器里 | 后端 API |
| 2 | **首屏按需加载** | 月历只拉当月数据（`/records?month=`），不再全量加载本地库；配合 v4.0 翻书加载仪式（设计文档 §4.7） | API 分页语义 |
| 3 | **保存状态可信化** | 日记/心情/学习条目全部乐观更新（UI 立即响应），后台写库；失败时信纸角落给出「保存失败，重试中」状态，不再静默丢内容 | http 层重试 |
| 4 | **服务端搜索** | 搜索走 `/search` 接口，未来数据量大了也不卡 | 后端 |
| 5 | **v4.0 动效体系** | 盖章 stamp-in、纸张落桌弹窗、月历格 tint 渐入等（设计文档 §5），全套替换掉 v3.x 果冻动效 | 前端重构 |
| 6 | **空状态与加载仪式** | 按设计文档 §4.6/§4.7 落地引导式空状态和翻书动画 | 前端重构 |
| 7 | **字体本地化** | Noto Serif SC / IBM Plex Mono 字体文件放自己服务器/CDN，解决 Google Fonts 国内加载慢导致的标题「变脸」 | 部署 |
| 8 | **移动端体验** | 底部标签导航、弹窗转底部抽屉、月历格压缩（设计文档 §6）——跨设备同步之后移动端是真的会用了，必须做好 | 前端重构 |

---

## 7. 前端重构方案

### 7.1 总体思路

**不做「旧页面换数据源」，直接按 v4.0 设计文档重写前端。** 改造清单和顺序以设计文档 §9.2（文件级改造清单）和 §9.3（迁移顺序）为准：

1. **token 层**：`index.css` / `tailwind.config.js` / `constants.ts` / `types` 全量对齐 v4.0（矿物三档色、印泥朱品牌色、三级表面、字号阶梯、新阴影/圆角）
2. **心情印章 SVG 组件** ×6（`src/assets/moods/`，24px 网格、1.75px stroke、line/seal 双态）
3. **月历页** → 手帐月计划格（共享 hairline、朱红今日圈、刻度条）
4. **今日详情页** → 手帐内页（和纸胶带页眉、账簿清单、衬线信纸）
5. **回忆/统计页** → 印章矩阵、时间轴、印刷图表风
6. **导航/弹窗/空状态/加载** 收尾，动效体系替换
7. **深浅双模式对比度验收**（正文 ≥7:1，辅助 ≥4.5:1）

### 7.2 数据层：HTTP 版 `api.ts`

新增 `src/lib/api.ts`，对外函数与 `db.ts` 同名同语义（`getRecordByDate` / `getRecordsByMonth` / `getRecordsByYear` / `upsertRecord` / `deleteRecord` / `searchDiary` / 自定义心情 CRUD / 导入导出）。重写后的页面直接消费它；签名对齐只是让重写顺畅的手段，不是约束——页面结构按 v4.0 需要怎么改就怎么改。

配套：

- 新增 `src/lib/http.ts`：fetch 封装（同源、`credentials: 'include'`、统一错误处理、401 跳网站登录页、写操作失败自动重试一次）
- `vite.config.ts` dev 代理：`/api → http://localhost:8080`（端口按网站后端实际）
- `lib/db.ts`（Dexie）**保留不删**：历史数据导出还要用到它，但它不再是主存储

### 7.3 集成进网站的构建与部署

```typescript
// vite.config.ts
export default defineConfig({ base: '/journal/' })
// main.tsx / App.tsx
<BrowserRouter basename="/journal">
```

部署方式二选一（按网站的部署形态）：

- **A. 网站是「前端静态站 + 后端 API」**（推荐）：手帐 `dist/` 拷到网站前端静态目录的 `/journal/` 下，Nginx `location /journal/ { try_files $uri /journal/index.html; }`，API 走网站现有 `/api` 反代。
- **B. 网站前端是 SPA 且要工程级整合**：手帐作为子包进网站前端 monorepo 挂 `/journal` 路由。整合深但构建耦合，个人项目不建议第一步做。

### 7.4 需要处理的细节

- **PWA**：当前项目带 Service Worker。集成后**先移除 PWA 注册**——子路径下 SW 作用域和缓存策略容易和主站打架，稳定后再评估是否在 `/journal` 作用域重新启用。
- **导航入口**：网站主导航加「手帐」入口指向 `/journal`；手帐内部导航按 v4.0「书脊」设计保留自己的体系。要不要套网站外框统一视觉，属于后续打磨项，不在本期。
- **深浅色主题**：v4.0 双模式跟随系统 + 手动切换，逻辑沿用现有实现。

---

## 8. 历史数据迁移

1. 后端实现 `POST /api/journal/import`，兼容现有导出格式（v1 纯数组 / v2 含 customMoods，逻辑参考 `db.ts` 的 `importData`）。
2. 打开当前手帐 → 设置页 → 导出 JSON。
3. 在新版手帐里走一次「导入」（`useDataIO.ts` 改为 POST 到 `/import`），服务端事务内批量插入并打 `user_id`。
4. 抽查几天数据无误后，浏览器 IndexedDB 保留一段时间作兜底备份。

**幂等要求**：导入按 `(user_id, date)` upsert，重复导入不产生重复数据。

---

## 9. 实施路线图

| 阶段 | 内容 | 产出 |
|------|------|------|
| P0 准备 | 确认网站后端 ORM、认证方式、静态资源部署方式；执行建表 SQL | 3 张 `sj_` 表 |
| P1 后端 | journal 包：entity/mapper/service/controller + upsert 事务 + 校验 + `/import` `/export` | API 全部可用（Postman 自测） |
| P2 前端重构 | v4.0 token 层 → 印章组件 → 月历/详情/回忆/统计重写 → 动效体系；同步接入 `api.ts`（第 6、7 节） | 新版手帐本地直连后端跑通 |
| P3 集成部署 | `base`/`basename`、移除 PWA、Nginx 子路径、字体本地化、网站导航入口 | yoursite.com/journal 可访问 |
| P4 迁移收尾 | 旧数据导出 → `/import` → 抽查；登录态打通（真实 user_id）；双模式对比度验收 | 正式切换完成 |

P1 与 P2 可并行：P2 前期（token 层、印章组件、纯视觉部分）不依赖后端，做到数据层时 P1 应已就绪。

## 10. 风险与注意点

- **日期语义**：`date` 全程按字符串处理，后端禁止任何 UTC 转换，否则跨时区「日记串天」。
- **用户隔离是底线**：所有 SQL 必须带 `user_id` 条件；给 `upsert`/`import` 写越权访问的测试用例。
- **离线能力回退**：上服务端后断网不可用。个人自用可接受；若在意，后续用保留的 Dexie 做「本地优先 + 后台同步」，是另一个专项，现在不做。
- **隐私变化**：日记从「不出浏览器」变成「存服务器数据库」，MySQL 备份策略要覆盖 `sj_` 表（跟网站现有备份一起走）。
- **防抖写库**：1.5s 防抖自动保存带来频繁小写入，对个人数据量毫无压力，配合乐观更新即可，不要加队列/缓存。
- **范围控制**：本期聚焦「v4.0 落地 + 后端化 + 第 6 节清单」。打印样式、手写体点缀等设计文档 P4 候选项依然推迟，不塞进这次。

---

**文档版本**：v2.0（体验优先版：合并 v4.0 视觉重构与后端化，移除「最小改动」约束）
**日期**：2026-07-18
**状态**：方案定稿，待 P0 确认网站侧细节后实施
