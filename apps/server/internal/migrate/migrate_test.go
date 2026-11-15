package migrate

import (
	"database/sql"
	"path/filepath"
	"testing"
	"testing/fstest"

	"journal/db/migrations"
	internaldb "journal/internal/db"
)

func openTempDB(t *testing.T) *sql.DB {
	t.Helper()
	sqlDB, err := internaldb.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	return sqlDB
}

func userVersion(t *testing.T, sqlDB *sql.DB) int {
	t.Helper()
	var v int
	if err := sqlDB.QueryRow("PRAGMA user_version").Scan(&v); err != nil {
		t.Fatalf("read user_version: %v", err)
	}
	return v
}

func TestUpAppliesBundledMigrationsIdempotently(t *testing.T) {
	sqlDB := openTempDB(t)

	if err := Up(sqlDB, migrations.FS); err != nil {
		t.Fatalf("first Up: %v", err)
	}
	if err := Up(sqlDB, migrations.FS); err != nil {
		t.Fatalf("second Up: %v", err)
	}
	if got := userVersion(t, sqlDB); got != 1 {
		t.Fatalf("user_version = %d, want 1", got)
	}

	for _, table := range []string{"user", "session", "setting"} {
		var name string
		err := sqlDB.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?", table,
		).Scan(&name)
		if err != nil {
			t.Fatalf("table %s missing: %v", table, err)
		}
	}

	// 基础表可写（user_id 外键 + setting 默认值）
	if _, err := sqlDB.Exec(
		"INSERT INTO user (id, username, password_hash, created_at) VALUES ('u1','alice','h',1)",
	); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	if _, err := sqlDB.Exec(
		"INSERT INTO setting (user_id, updated_at) VALUES ('u1', 1)",
	); err != nil {
		t.Fatalf("insert setting: %v", err)
	}
	var theme string
	if err := sqlDB.QueryRow("SELECT theme FROM setting WHERE user_id='u1'").Scan(&theme); err != nil {
		t.Fatalf("read setting: %v", err)
	}
	if theme != "graphite" {
		t.Fatalf("theme = %q, want graphite", theme)
	}
}

func TestUpAppliesInOrderAndSkipsApplied(t *testing.T) {
	fsys := fstest.MapFS{
		"0002_b.sql": {Data: []byte("CREATE TABLE t_b (id TEXT);")},
		"0001_a.sql": {Data: []byte("CREATE TABLE t_a (id TEXT);")},
		"notes.txt":  {Data: []byte("not sql")},
	}
	sqlDB := openTempDB(t)

	if err := Up(sqlDB, fsys); err != nil {
		t.Fatalf("Up: %v", err)
	}
	if got := userVersion(t, sqlDB); got != 2 {
		t.Fatalf("user_version = %d, want 2", got)
	}
	for _, table := range []string{"t_a", "t_b"} {
		var name string
		if err := sqlDB.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?", table,
		).Scan(&name); err != nil {
			t.Fatalf("table %s missing: %v", table, err)
		}
	}
	// 幂等：再跑不报错、版本不变
	if err := Up(sqlDB, fsys); err != nil {
		t.Fatalf("second Up: %v", err)
	}
	if got := userVersion(t, sqlDB); got != 2 {
		t.Fatalf("user_version after rerun = %d, want 2", got)
	}
}

func TestUpRollsBackFailedMigration(t *testing.T) {
	fsys := fstest.MapFS{
		"0001_bad.sql": {Data: []byte("CREATE TABLE ok_table (id TEXT); THIS IS NOT SQL;")},
	}
	sqlDB := openTempDB(t)

	if err := Up(sqlDB, fsys); err == nil {
		t.Fatal("expected error for bad migration")
	}
	if got := userVersion(t, sqlDB); got != 0 {
		t.Fatalf("user_version = %d after failed migration, want 0", got)
	}
	var name string
	if err := sqlDB.QueryRow(
		"SELECT name FROM sqlite_master WHERE type='table' AND name='ok_table'",
	).Scan(&name); err == nil {
		t.Fatal("failed migration left table behind; want rollback")
	}
}
