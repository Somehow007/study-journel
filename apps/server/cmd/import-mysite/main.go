// Command import-mysite migrates the legacy mysite MySQL sj_* tables into
// the SQLite v3 journal database (docs/data-model.md §6, roadmap M4-1).
//
//	import-mysite -db journal.db [-user NAME] [-dry-run] [-force]
//	import-mysite -mysql-dsn 'user:pass@tcp(host:port)/mysite' ...
//
// MySQL connection: -mysql-dsn wins; otherwise -mysql-host/-port/-user/-db
// plus password from -mysql-password or JOURNAL_MYSQL_PASSWORD. For the
// production rehearsal the binary is cross-compiled and run on the server
// against the dockerized MySQL (see deploy/CUTOVER.md).
package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"journal/db/migrations"
	"journal/internal/auth"
	"journal/internal/bootstrap"
	internaldb "journal/internal/db"
	"journal/internal/importer"
	"journal/internal/migrate"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	fs := flag.NewFlagSet("import-mysite", flag.ContinueOnError)
	dbPath := fs.String("db", envOr("JOURNAL_DB", "journal.db"), "sqlite 目标库路径")
	username := fs.String("user", "", "新库用户名（缺省：全库仅 1 用户时自动取）")
	sourceUID := fs.Int64("source-user-id", 0, "只迁移该 mysite user_id 的数据（多用户时必填）")
	dryRun := fs.Bool("dry-run", false, "只读 MySQL + 试算转换，不写 SQLite")
	force := fs.Bool("force", false, "目标库非空时强制重迁（先 VACUUM INTO 备份）")
	backup := fs.String("backup", "", "-force 时备份文件路径（缺省 <db>.bak-<ts>）")

	mysqlDSN := fs.String("mysql-dsn", "", "完整 MySQL DSN（优先于分项参数）")
	mysqlHost := fs.String("mysql-host", "127.0.0.1", "MySQL host")
	mysqlPort := fs.Int("mysql-port", 3306, "MySQL port")
	mysqlUser := fs.String("mysql-user", "root", "MySQL user")
	mysqlDB := fs.String("mysql-db", "mysite", "MySQL database")
	mysqlPass := fs.String("mysql-password", os.Getenv("JOURNAL_MYSQL_PASSWORD"), "MySQL password（或 JOURNAL_MYSQL_PASSWORD）")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	ctx := context.Background()

	dsn := *mysqlDSN
	if dsn == "" {
		dsn = fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&timeout=15s",
			*mysqlUser, *mysqlPass, *mysqlHost, *mysqlPort, *mysqlDB)
	}
	mysqlDBConn, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Error("mysql open", "err", err)
		return 1
	}
	defer mysqlDBConn.Close()
	mysqlDBConn.SetMaxOpenConns(4)
	if err := mysqlDBConn.PingContext(ctx); err != nil {
		log.Error("mysql ping", "err", err)
		return 1
	}

	src, err := importer.LoadSource(ctx, mysqlDBConn)
	if err != nil {
		log.Error("读取 sj_* 失败", "err", err)
		return 1
	}
	log.Info("sj_* 快照",
		"users", src.UserIDs, "days", len(src.DayRecords), "items", len(src.Items),
		"moods", len(src.CustomMoods), "goals", len(src.Goals),
		"tasks", len(src.Tasks), "checkins", len(src.Checkins))

	if len(src.UserIDs) > 1 {
		if *sourceUID == 0 {
			log.Error("sj_* 含多个 user_id，必须用 -source-user-id 指定", "ids", src.UserIDs)
			return 2
		}
	}
	if *sourceUID != 0 {
		if !src.FilterUser(*sourceUID) {
			log.Error("-source-user-id 无对应数据", "id", *sourceUID)
			return 1
		}
		log.Info("已按 user_id 过滤", "id", *sourceUID)
	}

	// resolve target user (needed even for dry-run? no — dry-run skips sqlite)
	var userID string
	if !*dryRun {
		sqlDB, err := internaldb.Open(*dbPath)
		if err != nil {
			log.Error("open sqlite", "err", err)
			return 1
		}
		defer sqlDB.Close()
		if err := migrate.Up(sqlDB, migrations.FS); err != nil {
			log.Error("migrate", "err", err)
			return 1
		}
		userID, err = resolveUser(ctx, sqlDB, *username)
		if err != nil {
			log.Error("解析目标用户", "err", err)
			return 1
		}
		log.Info("目标用户", "username", *username, "id", userID, "db", *dbPath)

		// default force-backup next to the db file (not the cwd)
		backupPath := *backup
		if *force && backupPath == "" {
			backupPath = fmt.Sprintf("%s.bak-%s", *dbPath, time.Now().Format("20060102-150405"))
		}
		conv, err := importer.Apply(ctx, sqlDB, src, userID, *force, backupPath, log)
		if err != nil {
			log.Error("写入失败", "err", err)
			return 1
		}
		rep, err := importer.Reconcile(ctx, sqlDB, src, userID, conv)
		if err != nil {
			log.Error("对账失败", "err", err)
			return 1
		}
		fmt.Print(rep.Format())
		if !rep.OK {
			return 1
		}
		return 0
	}

	// dry-run: preview conversion without touching sqlite. Builtin mood
	// resolution only needs key membership — placeholder ids suffice.
	previewIDs := map[string]string{}
	for _, s := range bootstrap.States {
		previewIDs[s.Key] = "<" + s.Key + ">"
	}
	conv, err := importer.Convert(src, previewIDs, "dry-run", time.Now().UnixMilli())
	if err != nil {
		log.Error("试算转换失败", "err", err)
		return 1
	}
	rep := importer.DryRunReport(src, conv)
	fmt.Print(rep.Format())
	return 0
}

// resolveUser maps -user (username) to the v3 user id; when omitted, the
// single existing user is used.
func resolveUser(ctx context.Context, sqlDB *sql.DB, username string) (string, error) {
	if username != "" {
		u, err := auth.FindUserByUsername(ctx, sqlDB, strings.TrimSpace(username))
		if err != nil {
			return "", err
		}
		if u == nil {
			return "", fmt.Errorf("用户 %q 不存在（先 journal-server create-user）", username)
		}
		return u.ID, nil
	}
	rows, err := sqlDB.QueryContext(ctx, `SELECT id FROM user`)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return "", err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	switch len(ids) {
	case 0:
		return "", fmt.Errorf("目标库无用户（先 journal-server create-user）")
	case 1:
		return ids[0], nil
	default:
		return "", fmt.Errorf("目标库有 %d 个用户，请用 -user 指定", len(ids))
	}
}
