# M7 新功能补齐（B 版内）

## 问题 / 目标

roadmap M7「新功能补齐」。对照 SPEC-B / 原型逐项核对后，倒计时（顶栏 D-xxx 印章）、正字统计、快捷时长 chips 已在 M6 落地；剩余缺口：

1. **科目预设/科目管理**：后端 subjects CRUD+archive 全有、种子 4 科、记一条可内联建；但设置页没有原型里的「科目预设」行，也无改名/换色/归档/恢复入口。
2. **热力图**：`GET /stats/heatmap` + 前端 `statsHeatmap()`/`StatsHeatmapCell` 已就绪但**零消费**；AnnualReview 的 12 迷你月热力格是另一套（export 全量派生），不覆盖「连续长区间日粒度」。
3. **unarchive**：subjects/states 只能归档不能恢复（`SetSubjectArchived`/`SetStateArchived` 支持 NULL，但无路由）。
4. **设置补齐**：`weekStartsOn` API 可写且影响目标周拆分/每周进度，但设置页无 UI。
5. **改密接口**：`.trellis/tasks/11-16-change-password` 已有任务卡（公网登录口长期弱密码），纳入本里程碑。

明确不做：专注计时（C 版/M10）、score 成绩表（data-model 标注后续）、阶段刻度/本周柱（A 版特性）、科目排序 UI（sort 字段保留，原型无此交互）。

## 消费点（命中 AGENTS §2 时必填）

### 科目/状态字典（§2.3 契约与领域层）

- 调用方：`rg listSubjects|archiveSubject|updateSubject|createSubject` → `lib/api.ts`（TodayDetail 内联建科目、GoalFormModal 选科目、queries.ts `useSubjects`）；`archiveState` → Settings/StateEditModal。
- 影响面：新增 `unarchiveSubject`/`unarchiveState`（api.ts）、新组件 `SubjectEditModal.tsx`、Settings.tsx 加行；后端 `meta.go` 加 2 路由 + handler（复用 `SetSubjectArchived`/`SetStateArchived` 传 nil）。
- 已知约束：`UNIQUE(user_id,name)` 含归档行 → 归档后同名不能再建（名字被占），UI 在重名时提示「已归档同名科目，请先恢复」；entries/goals 引用 subject_id 不受影响（ListSubjects 含归档行，条目仍能解析名称/颜色）。

### 热力图（§2.3 API client/types）

- 调用方：`statsHeatmap` 现零调用；新增 `useHeatmap`（queries.ts）+ `LearningHeatmap` 组件，Stats.tsx 左页挂载。
- 影响面：`lib/api.ts`/`types/api.ts` 已有定义不改；`queries.ts` 加 qk+hook；`journal-b.css` 加 `nb-heatmap*` 样式；不改后端。

### 修改密码（§2.1 鉴权与会话）

- 调用方：`rg requireAuth|SessionCookieName|auth/` → router.go 路由、middleware.go principal、auth.go login/logout/me。
- 影响面：`internal/auth/{user,session}.go` 加 `FindUserByID`/`UpdateUserPassword`/`DeleteOtherSessions`；`httpapi/auth.go` 加 handler；router.go 挂 `POST /auth/password`（requireAuth）；前端 `lib/auth.ts` 加 `changePassword`，Settings 加行+`PasswordEditModal`。
- 会话策略：**改密成功保留当前会话、删除该用户其他所有会话**（防盗用 cookie 续命且不踢自己）。
- 限流：复用 `LoginLimiter`，key 加 `pw:` 前缀独立计数（5 次/10 分钟/IP），不与登录互相占额。
- 校验：新密码 ≥8 字符、≠旧密码；旧密码错 → 401 `INVALID_CREDENTIALS`；未登录 → 401 `UNAUTHORIZED`（requireAuth）。

### 设置补齐

- `weekStartsOn` chips → `patchSettings`（AppContext 已有）；不动 focusMin/breakMin（专注未做）、phaseStart（phaseTicks 未启用）。

## 方案

按关注点拆 commit：

1. `feat(server)`：subjects/states `POST /{res}/{id}/unarchive`（归档标记置 NULL）+ httptest。
2. `feat(web)`：设置页「科目预设」行（原型 chip 排+「+ 添加」）→ `SubjectEditModal`（名称/8 色 nb-swatch/预览/删除=归档）；已归档科目折叠区带「恢复」。
3. `feat(web)`：设置页状态区补「已归档」恢复列表（对称补齐）。
4. `feat(web)`：统计页左栏底部「近 26 周学习热力」——`statsHeatmap` 取数，7 行×N 列周列网格（列起点按 `weekStartsOn`），深浅=当日时长/每日目标四档，今天红框，点格进 `/day/:date`。
5. `feat(web)`：设置页「每周起始」行（周一~周日 7 chip）。
6. `feat(server)`+`feat(web)`：`POST /auth/password` + 设置页「账号安全」修改密码弹层。

热力图位置评估（设计决策）：候选 Stats 右栏 / AnnualReview / 今日页 / 月历页。AnnualReview 已有 12 迷你月热力格（SPEC-B 指定，不动）；今日页右栏目标列表长度不定、且按日回看语义含糊；月历右栏仅 300px 宽放不下周列网格。**选 Stats 左栏底部**：统计页本就是量化页，月柱图（30 天粒度）自然延伸到 26 周粒度；左栏是图表栏、右栏是分布表，热力图属图表；26 周≈半年与考研备考节奏匹配，免分页。

## 验收

- `./scripts/verify.sh` 全绿（web typecheck+build；server gofmt/vet/test）。
- httptest：unarchive 往返；改密（旧密码错/新旧相同/成功后旧密码登录失败/其他会话失效当前会话存活）。
- 页面走查 1440+390：设置页新行与弹层、统计页热力图、修改密码流程。
- 手帐 `.trellis/CHANGES.md` 逐工作流追加；完成后归档本目录 + roadmap M7 状态更新。
