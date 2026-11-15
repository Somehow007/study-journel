// Package importer migrates the legacy mysite MySQL sj_* tables into the
// SQLite v3 schema (docs/data-model.md §6). It is exercised by
// cmd/import-mysite and covered by importer_test.go.
package importer

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"journal/internal/bootstrap"
	"journal/internal/db"
)

// businessTables lists every v3 business table in FK-safe delete order
// (children before parents). user/session/setting are never touched.
var businessTables = []string{
	"focus_session", "goal_checkin", "goal_task", "goal", "score",
	"entry", "day", "subject", "state",
}

// Apply writes src into target for userID inside one transaction. The target
// must be migrated already. A non-empty target is refused unless force is
// set, in which case the DB is first backed up (VACUUM INTO backupPath) and
// all business rows are wiped (user/session/setting preserved).
func Apply(ctx context.Context, target *sql.DB, src *Source, userID string,
	force bool, backupPath string, log *slog.Logger) (*Converted, error) {

	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	empty, err := targetEmpty(ctx, target, userID)
	if err != nil {
		return nil, err
	}
	if !empty {
		if !force {
			return nil, fmt.Errorf("目标库已有业务数据；确认重迁请加 -force（会先自动备份）")
		}
		if backupPath == "" {
			backupPath = fmt.Sprintf("%s.bak-%s", "journal", time.Now().Format("20060102-150405"))
		}
		if err := backupDB(ctx, target, backupPath); err != nil {
			return nil, fmt.Errorf("备份失败: %w", err)
		}
		log.Info("force 模式：已备份并清空业务表", "backup", backupPath)
		if err := wipeBusiness(ctx, target); err != nil {
			return nil, fmt.Errorf("清空业务表失败: %w", err)
		}
	}

	now := time.Now().UnixMilli()
	q := db.New(target)
	tx, err := target.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	qt := q.WithTx(tx)

	builtinIDs, err := bootstrap.EnsureStates(ctx, qt, userID, now)
	if err != nil {
		return nil, fmt.Errorf("内置状态种子: %w", err)
	}

	conv, err := Convert(src, builtinIDs, userID, now)
	if err != nil {
		return nil, err
	}

	for _, s := range conv.States {
		if err := qt.CreateState(ctx, s); err != nil {
			return nil, fmt.Errorf("state %s: %w", s.ID, err)
		}
	}
	for _, s := range conv.Subjects {
		if err := qt.CreateSubject(ctx, s); err != nil {
			return nil, fmt.Errorf("subject %s: %w", s.Name, err)
		}
	}
	for _, d := range conv.Days {
		if err := qt.CreateDay(ctx, d); err != nil {
			return nil, fmt.Errorf("day %s: %w", d.Date, err)
		}
	}
	for _, e := range conv.Entries {
		if err := qt.CreateEntry(ctx, e); err != nil {
			return nil, fmt.Errorf("entry %s: %w", e.ID, err)
		}
	}
	for _, g := range conv.Goals {
		if err := qt.CreateGoal(ctx, g); err != nil {
			return nil, fmt.Errorf("goal %s: %w", g.ID, err)
		}
	}
	for _, t := range conv.Tasks {
		if err := qt.CreateTask(ctx, t); err != nil {
			return nil, fmt.Errorf("task %s: %w", t.ID, err)
		}
	}
	for _, c := range conv.Checkins {
		if err := qt.CreateCheckin(ctx, c); err != nil {
			return nil, fmt.Errorf("checkin %s: %w", c.ID, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return conv, nil
}

// targetEmpty reports whether the user has any business rows. Checked per
// table with user scoping where the column exists.
func targetEmpty(ctx context.Context, target *sql.DB, userID string) (bool, error) {
	queries := []struct {
		name string
		sql  string
	}{
		{"subject", `SELECT COUNT(*) FROM subject WHERE user_id = ?`},
		{"state", `SELECT COUNT(*) FROM state WHERE user_id = ?`},
		{"day", `SELECT COUNT(*) FROM day WHERE user_id = ?`},
		{"entry", `SELECT COUNT(*) FROM entry WHERE user_id = ?`},
		{"focus_session", `SELECT COUNT(*) FROM focus_session WHERE user_id = ?`},
		{"score", `SELECT COUNT(*) FROM score WHERE user_id = ?`},
		{"goal", `SELECT COUNT(*) FROM goal WHERE user_id = ?`},
		{"goal_task", `SELECT COUNT(*) FROM goal_task t JOIN goal g ON t.goal_id = g.id WHERE g.user_id = ?`},
		{"goal_checkin", `SELECT COUNT(*) FROM goal_checkin c JOIN goal g ON c.goal_id = g.id WHERE g.user_id = ?`},
	}
	for _, tq := range queries {
		var n int64
		if err := target.QueryRowContext(ctx, tq.sql, userID).Scan(&n); err != nil {
			return false, fmt.Errorf("count %s: %w", tq.name, err)
		}
		if n > 0 {
			return false, nil
		}
	}
	return true, nil
}

// backupDB writes a consistent snapshot via VACUUM INTO (safe under WAL).
func backupDB(ctx context.Context, target *sql.DB, path string) error {
	if strings.Contains(path, "'") {
		return fmt.Errorf("backup path 含单引号: %s", path)
	}
	_, err := target.ExecContext(ctx, fmt.Sprintf("VACUUM INTO '%s'", path))
	return err
}

// wipeBusiness deletes all business rows in FK-safe order. Runs in one tx.
func wipeBusiness(ctx context.Context, target *sql.DB) error {
	tx, err := target.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// self-FK (goal.carried_from) and cross-row refs are checked at commit.
	if _, err := tx.ExecContext(ctx, "PRAGMA defer_foreign_keys=ON"); err != nil {
		return err
	}
	for _, table := range businessTables {
		if _, err := tx.ExecContext(ctx, "DELETE FROM "+table); err != nil {
			return fmt.Errorf("delete %s: %w", table, err)
		}
	}
	return tx.Commit()
}
