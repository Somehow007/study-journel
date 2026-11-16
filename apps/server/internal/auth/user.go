package auth

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"journal/internal/id"
)

// User mirrors the user table (docs/data-model.md §3).
type User struct {
	ID           string
	Username     string
	PasswordHash string
	CreatedAt    int64
}

var ErrUserExists = errors.New("username already exists")

// FindUserByUsername returns nil, nil when no user matches.
func FindUserByUsername(ctx context.Context, db *sql.DB, username string) (*User, error) {
	var u User
	err := db.QueryRowContext(ctx,
		"SELECT id, username, password_hash, created_at FROM user WHERE username = ?", username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// FindUserByID returns the user (with password hash) or nil, nil when missing.
func FindUserByID(ctx context.Context, db *sql.DB, id string) (*User, error) {
	var u User
	err := db.QueryRowContext(ctx,
		"SELECT id, username, password_hash, created_at FROM user WHERE id = ?", id,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// UpdateUserPassword replaces the argon2id hash for userID.
func UpdateUserPassword(ctx context.Context, db *sql.DB, userID, password string) error {
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx,
		"UPDATE user SET password_hash = ? WHERE id = ?", hash, userID)
	return err
}

// CreateUser inserts a new account and its default setting row.
func CreateUser(ctx context.Context, db *sql.DB, username, password string) (*User, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}
	uid, err := id.New()
	if err != nil {
		return nil, err
	}
	now := time.Now().UnixMilli()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx,
		"INSERT INTO user (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
		uid, username, hash, now,
	); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx,
		"INSERT INTO setting (user_id, updated_at) VALUES (?, ?)", uid, now,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &User{ID: uid, Username: username, PasswordHash: hash, CreatedAt: now}, nil
}
