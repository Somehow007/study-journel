package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"journal/internal/db"
	"journal/internal/id"
)

// optional[T] distinguishes absent / explicit null / value in PATCH bodies:
// absent → Set=false; null → Set=true, Val=nil; value → Set=true, Val=&v.
type optional[T any] struct {
	Set bool
	Val *T
}

func (o *optional[T]) UnmarshalJSON(b []byte) error {
	o.Set = true
	if string(b) == "null" {
		return nil
	}
	var v T
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	o.Val = &v
	return nil
}

func (d *Deps) q() *db.Queries { return db.New(d.DB) }

func uid(r *http.Request) string { return principalFrom(r.Context()).UserID }

func nowMs() int64 { return time.Now().UnixMilli() }

func nid() (string, error) { return id.New() }

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	if err := dec.Decode(v); err != nil {
		fail(w, http.StatusBadRequest, "BAD_REQUEST", "请求体不是合法 JSON")
		return false
	}
	return true
}

func urlID(w http.ResponseWriter, r *http.Request, name string) (string, bool) {
	v := chi.URLParam(r, name)
	if v == "" {
		fail(w, http.StatusNotFound, "NOT_FOUND", "资源不存在")
		return "", false
	}
	return v, true
}

func queryParam(r *http.Request, name string) string {
	return r.URL.Query().Get(name)
}

func parseIntQuery(r *http.Request, name string, def int64) int64 {
	if s := r.URL.Query().Get(name); s != "" {
		if n, err := strconv.ParseInt(s, 10, 64); err == nil {
			return n
		}
	}
	return def
}

// strPtr / intPtr helpers for nullable DTO fields.
func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// journalRoutes mounts every authenticated business endpoint. All routes sit
// behind requireAuth + ensureBootstrap (first-login seeds).
func (d *Deps) journalRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(requireAuth(d.DB), d.ensureBootstrap)

		r.Get("/settings", d.getSettings)
		r.Patch("/settings", d.patchSettings)

		r.Get("/subjects", d.listSubjects)
		r.Post("/subjects", d.createSubject)
		r.Patch("/subjects/{id}", d.updateSubject)
		r.Post("/subjects/{id}/archive", d.archiveSubject)

		r.Get("/states", d.listStates)
		r.Post("/states", d.createState)
		r.Patch("/states/{id}", d.updateState)
		r.Post("/states/{id}/archive", d.archiveState)

		r.Get("/days", d.listDays)
		r.Get("/days/{date}", d.getDay)
		r.Patch("/days/{date}", d.patchDay)
		r.Delete("/days/{date}", d.deleteDay)

		r.Post("/entries", d.createEntry)
		r.Patch("/entries/{id}", d.updateEntry)
		r.Delete("/entries/{id}", d.deleteEntry)
		r.Post("/entries/reorder", d.reorderEntries)

		r.Get("/goals", d.listGoals)
		r.Post("/goals", d.createGoal)
		r.Get("/goals/today", d.todayGoals)
		r.Get("/goals/{id}", d.getGoal)
		r.Patch("/goals/{id}", d.updateGoal)
		r.Delete("/goals/{id}", d.deleteGoal)
		r.Post("/goals/{id}/carry-over", d.carryOverGoal)

		r.Post("/goals/{id}/tasks", d.createTask)
		r.Patch("/tasks/{id}", d.updateTask)
		r.Delete("/tasks/{id}", d.deleteTask)
		r.Post("/tasks/{id}/complete", d.completeTask)
		r.Post("/tasks/{id}/uncomplete", d.uncompleteTask)

		r.Put("/goals/{id}/checkins/{date}", d.putCheckin)
		r.Delete("/goals/{id}/checkins/{date}", d.deleteCheckin)

		r.Get("/search", d.search)
		r.Get("/stats/month", d.statsMonth)
		r.Get("/stats/year", d.statsYear)
		r.Get("/stats/heatmap", d.statsHeatmap)
		r.Get("/streak", d.streak)
		r.Get("/export", d.exportData)
		r.Post("/import", d.importData)
	})
}

// ---- first-login bootstrap seeds (idempotent) ----

var builtinStates = []struct {
	key, label, color string
	polarity, sort    int64
}{
	{"inspired", "专注", "#D23B22", 1, 0},
	{"happy", "顺利", "#C2571A", 1, 1},
	{"calm", "平稳", "#1E4FA3", 0, 2},
	{"tired", "疲惫", "#8D919A", -1, 3},
	{"anxious", "焦虑", "#B07A12", -1, 4},
	{"sad", "低落", "#5E5A8C", -1, 5},
}

var seedSubjects = []struct{ name, color string }{
	{"数学一", "#1E4FA3"},
	{"408", "#2F6B4F"},
	{"英语一", "#B07A12"},
	{"政治", "#D23B22"},
}

func (d *Deps) ensureBootstrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		userID := uid(r)
		q := d.q()
		bs, err1 := q.CountBuiltinStates(ctx, userID)
		sc, err2 := q.CountSubjects(ctx, userID)
		if err1 != nil || err2 != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
		if bs >= int64(len(builtinStates)) && sc > 0 {
			next.ServeHTTP(w, r)
			return
		}
		tx, err := d.DB.BeginTx(ctx, nil)
		if err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
		defer tx.Rollback()
		qt := q.WithTx(tx)
		now := nowMs()
		if bs < int64(len(builtinStates)) {
			for _, s := range builtinStates {
				if _, err := qt.GetStateByBuiltinKey(ctx, db.GetStateByBuiltinKeyParams{UserID: userID, BuiltinKey: &s.key}); err == nil {
					continue
				} else if !errors.Is(err, sql.ErrNoRows) {
					fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
					return
				}
				sid, err := nid()
				if err != nil {
					fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
					return
				}
				if err := qt.CreateState(ctx, db.CreateStateParams{
					ID: sid, UserID: userID, BuiltinKey: &s.key, Label: s.label,
					Color: s.color, Polarity: s.polarity, Sort: s.sort,
					CreatedAt: now, UpdatedAt: now,
				}); err != nil {
					fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
					return
				}
			}
		}
		if sc == 0 {
			for i, s := range seedSubjects {
				sid, err := nid()
				if err != nil {
					fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
					return
				}
				if err := qt.CreateSubject(ctx, db.CreateSubjectParams{
					ID: sid, UserID: userID, Name: s.name, Color: s.color,
					Sort: int64(i), CreatedAt: now, UpdatedAt: now,
				}); err != nil {
					fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
					return
				}
			}
		}
		if err := tx.Commit(); err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
		next.ServeHTTP(w, r)
	})
}
