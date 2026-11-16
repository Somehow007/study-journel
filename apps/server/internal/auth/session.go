package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"time"
)

// SessionTTL is the absolute session lifetime (no sliding renewal in M1).
const SessionTTL = 30 * 24 * time.Hour

// SessionUser is the principal resolved from a session cookie.
type SessionUser struct {
	UserID   string
	Username string
}

// NewSessionToken returns the cookie token (32 random bytes, base64url) and
// its sha256 hex digest, which is what the session table stores. The digest
// is always computed over the token string itself (see hashToken) so lookup
// and deletion recompute the same value.
func NewSessionToken() (token, tokenHash string, err error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	token = base64.RawURLEncoding.EncodeToString(raw)
	return token, hashToken(token), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// CreateSession persists a session for userID and returns the cookie token.
func CreateSession(ctx context.Context, db *sql.DB, userID, userAgent string) (string, time.Time, error) {
	token, hash, err := NewSessionToken()
	if err != nil {
		return "", time.Time{}, err
	}
	if len(userAgent) > 512 {
		userAgent = userAgent[:512]
	}
	now := time.Now()
	expires := now.Add(SessionTTL)
	if _, err := db.ExecContext(ctx,
		"INSERT INTO session (id, user_id, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?, ?)",
		hash, userID, expires.UnixMilli(), now.UnixMilli(), userAgent,
	); err != nil {
		return "", time.Time{}, err
	}
	return token, expires, nil
}

// FindSession resolves a cookie token to its user, or nil when the token is
// unknown or expired. Expired rows are deleted lazily on lookup.
func FindSession(ctx context.Context, db *sql.DB, token string) (*SessionUser, error) {
	var su SessionUser
	var expiresAt int64
	err := db.QueryRowContext(ctx,
		`SELECT s.user_id, u.username, s.expires_at
		 FROM session s JOIN user u ON u.id = s.user_id
		 WHERE s.id = ?`, hashToken(token),
	).Scan(&su.UserID, &su.Username, &expiresAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if expiresAt <= time.Now().UnixMilli() {
		_, _ = db.ExecContext(ctx, "DELETE FROM session WHERE id = ?", hashToken(token))
		return nil, nil
	}
	return &su, nil
}

// DeleteSession removes the session for token, if any.
func DeleteSession(ctx context.Context, db *sql.DB, token string) error {
	_, err := db.ExecContext(ctx, "DELETE FROM session WHERE id = ?", hashToken(token))
	return err
}

// DeleteOtherSessions removes every session of userID except the one
// identified by keepToken (raw cookie value). keepToken="" deletes all.
func DeleteOtherSessions(ctx context.Context, db *sql.DB, userID, keepToken string) error {
	if keepToken == "" {
		_, err := db.ExecContext(ctx, "DELETE FROM session WHERE user_id = ?", userID)
		return err
	}
	_, err := db.ExecContext(ctx,
		"DELETE FROM session WHERE user_id = ? AND id != ?", userID, hashToken(keepToken))
	return err
}
