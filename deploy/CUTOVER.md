# M4-3 / M4-4 切换与回滚 runbook

一次性上线操作记录。**所有写生产数据的步骤都需 owner 当场确认**；
执行前把 `SERVER` 换成真实 SSH 目标（不写进任何提交）：

```bash
export SERVER=user@host        # 部署服务器
export JOURNAL_SERVER=$SERVER  # deploy.sh 用
```

服务器上 MySQL 在 docker（`mysite-mysql`，127.0.0.1:3306），
root 口令从服务器 `docker/.env` 的 `MYSQL_ROOT_PASSWORD` 读取（不落地到本仓库）。

## 阶段 0 · 前置检查（切换当天）

```bash
ssh $SERVER 'ls /opt/journal /var/lib/journal; systemctl is-active journal || true'
ssh $SERVER 'curl -sf http://127.0.0.1:8090/api/health'
```

Go 服务未部署过则先跑阶段 1 的 `--skip-web`。

## 阶段 1 · Go 服务上线（不影响线上）

```bash
./deploy/deploy.sh --skip-web        # 构建+推二进制+systemd+健康检查
```

预期：`/opt/journal/{journal-server,import-mysite}`、`journal.service` active、
`127.0.0.1:8090/api/health` 返回 `{"code":"0","data":{"ok":true}}`。
此步只新增服务，不改 nginx、不动旧前端，旧链路完全不受影响。

## 阶段 2 · 建账号 + 数据迁移

```bash
# 2.1 建手帐账号（交互式输两次密码；在服务器上以 www-data 跑）
ssh -t $SERVER 'sudo -u www-data /opt/journal/journal-server create-user \
  -username <登录名> -db /var/lib/journal/journal.db'

# 2.2 MySQL 侧冷备份（永久归档，迁移前必须）
ssh $SERVER 'docker exec mysite-mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction mysite \
  sj_day_record sj_learning_item sj_custom_mood sj_goal sj_goal_task sj_goal_checkin \
  | gzip > ~/sj-mysql-backup-$(date +%Y%m%d-%H%M%S).sql.gz'

# 2.3 迁移 dry-run（只读 MySQL，不写 SQLite；看 skipped/warnings）
ssh $SERVER 'sudo -u www-data /opt/journal/import-mysite \
  -db /var/lib/journal/journal.db \
  -mysql-host 127.0.0.1 -mysql-port 3306 -mysql-user root \
  -mysql-password "$MYSQL_ROOT_PASSWORD" -mysql-db mysite \
  -user <登录名> -dry-run'

# 2.4 正式迁移（要求逐项对账全等，差异非零退出）
ssh $SERVER 'sudo -u www-data /opt/journal/import-mysite \
  -db /var/lib/journal/journal.db \
  -mysql-host 127.0.0.1 -mysql-port 3306 -mysql-user root \
  -mysql-password "$MYSQL_ROOT_PASSWORD" -mysql-db mysite \
  -user <登录名>'
```

- `-source-user-id`：旧库数字 `user_id`；源库含多个 user_id 时必填（真实源只有一个则可省略）。
- 目标库非空会拒绝；要重跑先 `journal-server backup` 或加 `-force`（自动备份）。
- 对账输出逐项 `old/new`；出现 `结论: 存在差异` 时先查 skipped/warnings，
  确认差异均为脏数据后才允许继续。

## 阶段 3 · nginx 切流（旧前端仍在跑，不受影响）

```bash
# 3.1 把 deploy/nginx/journal-api.conf 的 location 块贴进 mysite.conf
#     的 443 与 8080 两个 server 块（/journal/ 静态块附近）
ssh $SERVER 'sudo nginx -t && sudo systemctl reload nginx'

# 3.2 验证 API 已通（此时前端还是旧版，不会调它，无副作用）
ssh $SERVER 'curl -sf http://127.0.0.1:8080/journal/api/health'
curl -s https://<域名>/journal/api/v1/auth/me   # 期望 401 JSON
```

## 阶段 4 · 推新前端（真正切流）

```bash
./deploy/deploy.sh --skip-go     # 构建 VITE_API_BASE=/journal/api + 备份旧前端 + rsync
```

旧前端已自动备份为 `/var/www/journal.bak-<ts>.tar.gz`。

## 阶段 5 · 冒烟（M4-3 验收）

- [ ] `https://<域名>/journal/` 打开登录页，账号密码登录成功
- [ ] 今日页数据 = 迁移结果（学习时长/打卡/目标与旧版一致）
- [ ] 新增一条学习记录 → 保存 → 刷新仍在（验证写路径 + SQLite）
- [ ] 月历/打卡/计划/导出各走一遍
- [ ] 旧 `/api/journal/*` 仍可访问（只读回退基线，14 天观察期）

## 阶段 6 · SQLite 日备（上线后）

```bash
ssh $SERVER 'sudo mkdir -p /var/backups/journal'
```

```cron
# crontab -e（服务器；backup 用 VACUUM INTO 一致性快照，不停服务）
15 3 * * * /opt/journal/journal-server backup -db /var/lib/journal/journal.db \
  -out /var/backups/journal/journal-$(date +\%Y\%m\%d-%H\%M).db && \
  find /var/backups/journal -name 'journal-*.db' -mtime +14 -delete
```

---

# M4-4 回滚预案（≤5 分钟）

触发条件：新站登录/读写异常且无法快速修复。
回滚 = nginx 摘掉 `/journal/api/` + 前端还原旧包。Go 服务可留着不管
（无人调用即无影响），也可 `sudo systemctl stop journal`。

```bash
# R1. 注释/删除 mysite.conf 中 /journal/api/ location 块（两个 server 块都要）
ssh $SERVER 'sudo vi /etc/nginx/sites-enabled/mysite.conf'   # 或 sed 删块

# R2. 校验并 reload（旧前端立即恢复走 /api/journal → 8081）
ssh $SERVER 'sudo nginx -t && sudo systemctl reload nginx'

# R3. 还原旧前端（deploy.sh 阶段 4 留的 tar 包）
ssh $SERVER 'ls -t /var/www/journal.bak-*.tar.gz | head -1'
ssh $SERVER 'sudo tar -xzf /var/www/journal.bak-<ts>.tar.gz -C /var/www \
  && sudo chown -R www-data:www-data /var/www/journal'

# R4. 验证旧链路
curl -s https://<域名>/journal/ | head        # 旧版 HTML
ssh $SERVER 'curl -sf http://127.0.0.1:8080/api/journal/...'  # 旧 API 仍在
```

**回滚后注意**：切流期间在新站产生的写入留在 SQLite，不会回流 MySQL；
再次上线前需决定如何处理这段增量（重跑迁移会拒绝非空库，
用 `journal-server backup` + 人工核对，或接受丢弃——切换窗口应尽量短）。

---

# 观察期（14 天）与收尾

- 旧 `/api/journal` 保留只读：不再有新写入需求；Spring 侧不再发布手帐前端。
- **不要**在观察期内跑 mysite `deploy/server-deploy.sh`（其 journal 段仍按
  旧结构构建，会覆盖 `/var/www/journal`）——M5 清理时再改。
- 观察期无异常 → M5：mysite 删 `journal/` 包与 `sj_*` 表、nginx 8081 journal 段、
  本仓库 CHANGES/MAP 归档 M4。
