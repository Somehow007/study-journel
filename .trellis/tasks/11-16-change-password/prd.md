# 修改密码接口（auth change-password）

## 问题 / 目标

M4-3 上线时建了临时简单凭据（admin / 简单密码），**当前没有任何改密途径**——`create-user` 是 CLI 一次性建号，登录后无法自助改密。需要补 `POST /api/v1/auth/password`（或类似）让登录用户改密。

## 消费点（命中 AGENTS §2.1 鉴权面，先列后动）

- 路由：`apps/server/internal/httpapi/` auth 路由组（login/logout/me 旁）
- 领域：`apps/server/internal/auth/`（password.go argon2id 哈希、user.go）
- 前端：登录后入口——设置页或顶栏菜单（apps/web 目前页面结构待查，无独立设置页则最小入口：登录态下某处表单）
- session：改密后是否踢旧会话（建议：改密成功后清其他 session 或要求重新登录，防盗用后旧 cookie 续命）

## 方案（草案，开工时再定）

- `POST /api/v1/auth/password` body `{oldPassword, newPassword}`：校验旧密码 → argon2id 重哈希写库 → 删该用户其他 session（保留当前或全踢均可，倾向全踢要求重登）
- 前端最小入口：若无设置页，先在登录后可见处加改密表单（哪怕临时页），不做多余导航
- 校验：新密码长度下限（≥8？）、不能与旧相同、限流复用 login 的限流器

## 验收

- `./scripts/verify.sh` 绿；httptest 覆盖：旧密码错 401/业务码、新旧相同拒绝、成功后旧密码登录失败
- 真实环境：改密 → 旧 cookie 失效（按所选 session 策略）→ 新密码登录成功

## 备注

- 来源：2026-11-16 M4-3 上线临时凭据，owner 要求「后面记得给修改密码的接口」
- 优先级：低-中——临时密码够用一阵，但公网暴露的登录口不该长期用弱密码
