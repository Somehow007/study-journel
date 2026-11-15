// Package migrate applies numbered SQL migrations tracked by PRAGMA user_version.
package migrate

import (
	"database/sql"
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strconv"
)

var namePattern = regexp.MustCompile(`^(\d+)_.*\.sql$`)

// Up applies every *.sql file in fsys whose numeric prefix is greater than the
// database's current user_version, in filename order. Each migration body runs
// in a single transaction together with the user_version bump, so a rerun is a
// no-op and a failed migration leaves the version untouched.
func Up(db *sql.DB, fsys fs.FS) error {
	names, err := fs.Glob(fsys, "*.sql")
	if err != nil {
		return fmt.Errorf("list migrations: %w", err)
	}
	sort.Strings(names)

	var current int
	if err := db.QueryRow("PRAGMA user_version").Scan(&current); err != nil {
		return fmt.Errorf("read user_version: %w", err)
	}

	for _, name := range names {
		m := namePattern.FindStringSubmatch(name)
		if m == nil {
			return fmt.Errorf("migration %q does not match NNNN_name.sql", name)
		}
		version, err := strconv.Atoi(m[1])
		if err != nil {
			return fmt.Errorf("migration %q: %w", name, err)
		}
		if version <= current {
			continue
		}
		body, err := fs.ReadFile(fsys, name)
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}
		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("begin %s: %w", name, err)
		}
		if _, err := tx.Exec(string(body)); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply %s: %w", name, err)
		}
		if _, err := tx.Exec(fmt.Sprintf("PRAGMA user_version = %d", version)); err != nil {
			tx.Rollback()
			return fmt.Errorf("set user_version for %s: %w", name, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit %s: %w", name, err)
		}
		current = version
	}
	return nil
}
