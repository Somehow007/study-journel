# 本地数据库工具查看线上 SQLite（TablePlus 等）

> 2026-11-16 整理。适用：想在本地用 TablePlus / DB Browser / DataGrip 直接查看手帐线上库。

## 原理（先读这个）

SQLite 是**文件型**数据库，没有 TCP 服务端口，TablePlus 没法像连 MySQL 那样"连"远程库。
可行路径 = **服务器上产出一致性快照 → scp 拷回本地 → GUI 打开本地文件**。

线上库：`/var/lib/journal/journal.db`（WAL 模式，`www-data:www-data`）。
服务：`journal.service` → `127.0.0.1:8090`（nginx `/journal/api/` 反代）。

## 步骤

### 1. SSH 到服务器（与部署同一入口）

```bash
ssh ubuntu@<服务器>          # 或 root@，需要 sudo 权限
```

### 2. 产出快照（两选一）

**A. 用现成的每日备份**（cron 03:15 已装，`/var/backups/journal/`，留 14 天）：

```bash
ls -lt /var/backups/journal/ | head -5
# 例：journal-20261116-0315.db
```

**B. 手动打当下最新快照**（推荐，不等 cron）：

```bash
sudo /opt/journal/journal-server backup \
  -db /var/lib/journal/journal.db \
  -out /tmp/journal-snap.db
sudo chmod 644 /tmp/journal-snap.db   # 让 ubuntu 用户可读以便 scp
```

`backup` 子命令走 `VACUUM INTO`，产出**一致性单文件**（含 WAL 里未落盘的数据），不需要停服务。

### 3. 拷回本地

```bash
# 用 cron 快照：
scp ubuntu@<服务器>:/var/backups/journal/journal-20261116-0315.db ~/Downloads/journal.db

# 用手动快照：
scp ubuntu@<服务器>:/tmp/journal-snap.db ~/Downloads/journal.db
```

> `/var/backups/journal/` 与 `/var/lib/journal/` 的文件属主是 `www-data`/`root`，
> `ls`/`scp` 可能要 `sudo cp` 到家目录中转：
> `ssh ubuntu@<服务器> 'sudo cp /var/backups/journal/journal-XXX.db ~ && sudo chown $USER ~/*.db'`

### 4. TablePlus 打开

1. TablePlus → 左上角 **+**（新建连接）或 **File → Open**
2. 数据库类型选 **SQLite**
3. 文件路径选刚才下载的 `.db` → **Test / Connect**
4. 左侧出现 `day`/`entry`/`subject`/`state`/`goal` 等表，双击浏览

其他 GUI 同理：本质都是"打开一个本地 .db 文件"。

## 注意事项

- **不要 scp 活库文件**（`journal.db` 本体）：WAL 模式下最新写入在 `journal.db-wal` 里，
  只拷 `.db` 会丢最近的数据，且拷贝瞬间可能撞上写锁。要么 `VACUUM INTO` 快照，要么三个文件一起拷且趁低峰。
- **单向快照**：本地 GUI 里改的数据不会回服务器；本地只做查看/分析最安全。
  确需写回：停 `journal.service` → 替换文件 → 启动（有风险，先 `journal-server backup` 留底）。
- 快照文件含全部数据（含密码哈希、会话 token 哈希），按隐私文件对待；
  本项目内已存的 `backups/*.db` 已被 `.gitignore` 排除，不会误提交。
- 临时手动快照记得服务器上删掉：`ssh ubuntu@<服务器> 'sudo rm /tmp/journal-snap.db'`

## 已有产物（2026-11-16）

- `backups/journal-prod-20261116.db`：线上整库快照（TablePlus 直接打开这个文件即可）
- `backups/diary-export-20261116.json`：日记-only 导出（date/state/diary，4 篇，已剔除学习时长/科目/目标）
