package httpapi

import (
	"database/sql"
	"errors"
	"net/http"

	"journal/internal/db"
	"journal/internal/domain"
)

// ---- checkins ----

type checkinRequest struct {
	Quantity    int64            `json:"quantity"`
	Note        optional[string] `json:"note"`
	EntryID     optional[string] `json:"entryId"`
	DurationMin optional[int64]  `json:"durationMin"`
	CreateEntry optional[bool]   `json:"createEntry"`
	Date        string           `json:"date"`
}

func (d *Deps) putCheckin(w http.ResponseWriter, r *http.Request) {
	goalID, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	date := chiURLParam(r, "date")
	if !domain.ValidateDate(date) {
		fail(w, http.StatusBadRequest, "VALIDATION", "date 必须是 YYYY-MM-DD")
		return
	}
	g, okG := d.requireGoal(w, r, goalID)
	if !okG {
		return
	}
	var req checkinRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Quantity < 1 || req.Quantity > 100000 {
		fail(w, http.StatusBadRequest, "VALIDATION", "quantity 需在 1–100000")
		return
	}
	note := ""
	if req.Note.Set && req.Note.Val != nil {
		note = *req.Note.Val
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	// entry link resolution
	var entryID *string
	wantEntry := req.CreateEntry.Set && req.CreateEntry.Val != nil && *req.CreateEntry.Val
	if wantEntry {
		entryDate := req.Date
		if entryDate == "" {
			entryDate = date // 默认落在打卡日，而不是调用当天
		}
		eid, okE := d.maybeCreateEntry(w, r, g,
			"打卡 · "+g.Title, entryDate, durPtr(req.DurationMin), "goal")
		if !okE {
			return
		}
		entryID = &eid
	} else if req.EntryID.Set {
		if req.EntryID.Val != nil && *req.EntryID.Val != "" {
			eid := *req.EntryID.Val
			if _, err := q.GetEntry(ctx, db.GetEntryParams{ID: eid, UserID: userID}); errors.Is(err, sql.ErrNoRows) {
				fail(w, http.StatusBadRequest, "VALIDATION", "entryId 不存在")
				return
			} else if err != nil {
				fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
				return
			}
			entryID = &eid
		}
	}
	now := nowMs()
	cur, err := q.GetCheckin(ctx, db.GetCheckinParams{GoalID: goalID, Date: date, UserID: userID})
	switch {
	case err == nil:
		if err := q.UpdateCheckin(ctx, db.UpdateCheckinParams{
			Quantity: req.Quantity, Note: note, EntryID: entryID,
			UpdatedAt: now, ID: cur.ID,
		}); err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
	case errors.Is(err, sql.ErrNoRows):
		cid, err := nid()
		if err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
		if err := q.CreateCheckin(ctx, db.CreateCheckinParams{
			ID: cid, GoalID: goalID, Date: date, Quantity: req.Quantity, Note: note,
			EntryID: entryID, CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
	default:
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	// touch goal.updated_at so list ordering reflects activity
	_ = q.TouchGoal(ctx, db.TouchGoalParams{ID: goalID, UserID: userID, UpdatedAt: now})
	cur2, err := q.GetCheckin(ctx, db.GetCheckinParams{GoalID: goalID, Date: date, UserID: userID})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, checkinOut(cur2))
}

func (d *Deps) deleteCheckin(w http.ResponseWriter, r *http.Request) {
	goalID, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	date := chiURLParam(r, "date")
	if !domain.ValidateDate(date) {
		fail(w, http.StatusBadRequest, "VALIDATION", "date 必须是 YYYY-MM-DD")
		return
	}
	if _, okG := d.requireGoal(w, r, goalID); !okG {
		return
	}
	ctx := r.Context()
	q := d.q()
	cur, err := q.GetCheckin(ctx, db.GetCheckinParams{GoalID: goalID, Date: date, UserID: uid(r)})
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "打卡不存在")
		return
	}
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	if err := q.DeleteCheckin(ctx, cur.ID); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}

	ok(w, map[string]bool{"deleted": true})
}
