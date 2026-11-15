// Package bootstrap holds the first-login seed data (builtin states and the
// four default subjects) shared by the HTTP ensureBootstrap middleware and
// cmd/import-mysite. Keeping one spec prevents the two paths drifting.
package bootstrap

import (
	"context"
	"database/sql"
	"errors"

	"journal/internal/db"
	"journal/internal/id"
)

// StateSeed is one builtin state row (builtin_key in docs/data-model.md §3).
type StateSeed struct {
	Key, Label, Color string
	Polarity, Sort    int64
}

// SubjectSeed is one default subject row.
type SubjectSeed struct {
	Name, Color string
}

// States are the six builtin states seeded for every user (考研语义标签).
var States = []StateSeed{
	{"inspired", "专注", "#D23B22", 1, 0},
	{"happy", "顺利", "#C2571A", 1, 1},
	{"calm", "平稳", "#1E4FA3", 0, 2},
	{"tired", "疲惫", "#8D919A", -1, 3},
	{"anxious", "焦虑", "#B07A12", -1, 4},
	{"sad", "低落", "#5E5A8C", -1, 5},
}

// Subjects are the four default subjects seeded only when the user has none.
var Subjects = []SubjectSeed{
	{"数学一", "#1E4FA3"},
	{"408", "#2F6B4F"},
	{"英语一", "#B07A12"},
	{"政治", "#D23B22"},
}

// EnsureStates creates any missing builtin states for userID and returns the
// builtin_key → state.id map. Idempotent: existing rows are reused.
func EnsureStates(ctx context.Context, q *db.Queries, userID string, now int64) (map[string]string, error) {
	ids := make(map[string]string, len(States))
	for _, s := range States {
		row, err := q.GetStateByBuiltinKey(ctx, db.GetStateByBuiltinKeyParams{
			UserID: userID, BuiltinKey: &s.Key,
		})
		if err == nil {
			ids[s.Key] = row.ID
			continue
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		sid, err := id.New()
		if err != nil {
			return nil, err
		}
		key := s.Key
		if err := q.CreateState(ctx, db.CreateStateParams{
			ID: sid, UserID: userID, BuiltinKey: &key, Label: s.Label,
			Color: s.Color, Polarity: s.Polarity, Sort: s.Sort,
			CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			return nil, err
		}
		ids[s.Key] = sid
	}
	return ids, nil
}

// EnsureSubjects creates the four default subjects iff the user has none.
func EnsureSubjects(ctx context.Context, q *db.Queries, userID string, now int64) error {
	count, err := q.CountSubjects(ctx, userID)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	for i, s := range Subjects {
		sid, err := id.New()
		if err != nil {
			return err
		}
		if err := q.CreateSubject(ctx, db.CreateSubjectParams{
			ID: sid, UserID: userID, Name: s.Name, Color: s.Color,
			Sort: int64(i), CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			return err
		}
	}
	return nil
}

// Ensure is the first-login bootstrap: builtin states plus default subjects
// (subjects only when the user has none). Idempotent.
func Ensure(ctx context.Context, q *db.Queries, userID string, now int64) error {
	if _, err := EnsureStates(ctx, q, userID, now); err != nil {
		return err
	}
	return EnsureSubjects(ctx, q, userID, now)
}
