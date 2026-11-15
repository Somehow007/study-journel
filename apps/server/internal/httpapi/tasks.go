package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"journal/internal/db"
	"journal/internal/domain"
)

// ---- tasks ----

type taskRequest struct {
	Title       string           `json:"title"`
	DueDate     optional[string] `json:"dueDate"`
	WeekStart   optional[string] `json:"weekStart"`
	Reflection  optional[string] `json:"reflection"`
	EntryID     optional[string] `json:"entryId"`
	Sort        optional[int64]  `json:"sort"`
	DurationMin optional[int64]  `json:"durationMin"`
	CreateEntry optional[bool]   `json:"createEntry"`
	Date        string           `json:"date"`
}

func optDate(p optional[string]) *string {
	if !p.Set {
		return nil
	}
	return p.Val
}

func validOptDate(p optional[string]) bool {
	if !p.Set || p.Val == nil || *p.Val == "" {
		return true
	}
	return domain.ValidateDate(*p.Val)
}

func (d *Deps) createTask(w http.ResponseWriter, r *http.Request) {
	goalID, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	g, okG := d.requireGoal(w, r, goalID)
	if !okG {
		return
	}
	var req taskRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	title := strings.TrimSpace(req.Title)
	if title == "" || len([]rune(title)) > 200 {
		fail(w, http.StatusBadRequest, "VALIDATION", "title 必填且不超过 200 字")
		return
	}
	if !validOptDate(req.DueDate) || !validOptDate(req.WeekStart) {
		fail(w, http.StatusBadRequest, "VALIDATION", "dueDate/weekStart 必须是 YYYY-MM-DD")
		return
	}
	var due, ws *string
	if req.DueDate.Set {
		if req.DueDate.Val != nil && *req.DueDate.Val != "" {
			due = req.DueDate.Val
		}
	}
	if req.WeekStart.Set {
		if req.WeekStart.Val != nil && *req.WeekStart.Val != "" {
			ws = req.WeekStart.Val
		}
	}
	sort := int64(0)
	if req.Sort.Set && req.Sort.Val != nil {
		sort = *req.Sort.Val
	} else {
		sort, _ = d.q().NextTaskSort(r.Context(), goalID)
	}
	tid, err := nid()
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	now := nowMs()
	if err := d.q().CreateTask(r.Context(), db.CreateTaskParams{
		ID: tid, GoalID: g.ID, Title: title, DueDate: due, WeekStart: ws,
		Reflection: "", Sort: sort, CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	t, _ := d.q().GetTask(r.Context(), db.GetTaskParams{ID: tid, UserID: uid(r)})
	ok(w, taskOut(t))
}

func (d *Deps) updateTask(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	ctx := r.Context()
	q := d.q()
	cur, err := q.GetTask(ctx, db.GetTaskParams{ID: id, UserID: uid(r)})
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "子任务不存在")
		return
	}
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	var req taskRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	title := cur.Title
	if strings.TrimSpace(req.Title) != "" {
		title = strings.TrimSpace(req.Title)
		if len([]rune(title)) > 200 {
			fail(w, http.StatusBadRequest, "VALIDATION", "title 过长")
			return
		}
	}
	if !validOptDate(req.DueDate) || !validOptDate(req.WeekStart) {
		fail(w, http.StatusBadRequest, "VALIDATION", "dueDate/weekStart 必须是 YYYY-MM-DD")
		return
	}
	due := cur.DueDate
	if req.DueDate.Set {
		due = nil
		if req.DueDate.Val != nil && *req.DueDate.Val != "" {
			due = req.DueDate.Val
		}
	}
	ws := cur.WeekStart
	if req.WeekStart.Set {
		ws = nil
		if req.WeekStart.Val != nil && *req.WeekStart.Val != "" {
			ws = req.WeekStart.Val
		}
	}
	reflection := cur.Reflection
	if req.Reflection.Set {
		if req.Reflection.Val == nil {
			reflection = ""
		} else {
			reflection = *req.Reflection.Val
		}
	}
	entryID := cur.EntryID
	if req.EntryID.Set {
		entryID = nil
		if req.EntryID.Val != nil && *req.EntryID.Val != "" {
			eid := *req.EntryID.Val
			if _, err := q.GetEntry(ctx, db.GetEntryParams{ID: eid, UserID: uid(r)}); errors.Is(err, sql.ErrNoRows) {
				fail(w, http.StatusBadRequest, "VALIDATION", "entryId 不存在")
				return
			} else if err != nil {
				fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
				return
			}
			entryID = &eid
		}
	}
	sort := cur.Sort
	if req.Sort.Set && req.Sort.Val != nil {
		sort = *req.Sort.Val
	}
	if err := q.UpdateTask(ctx, db.UpdateTaskParams{
		ID: id, Title: title, DueDate: due, WeekStart: ws, DoneAt: cur.DoneAt,
		Reflection: reflection, EntryID: entryID, Sort: sort, UpdatedAt: nowMs(),
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	t, _ := q.GetTask(ctx, db.GetTaskParams{ID: id, UserID: uid(r)})
	ok(w, taskOut(t))
}

func (d *Deps) deleteTask(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	if _, err := d.q().GetTask(r.Context(), db.GetTaskParams{ID: id, UserID: uid(r)}); errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "子任务不存在")
		return
	} else if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	if err := d.q().DeleteTask(r.Context(), id); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, map[string]bool{"deleted": true})
}

// maybeCreateEntryForTask builds an entry row for task/checkin completion.
// Returns entry id or "" when not requested. durationMin required when creating.
func (d *Deps) maybeCreateEntry(w http.ResponseWriter, r *http.Request, g db.Goal,
	title, date string, durMin *int64, source string) (string, bool) {
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	var subjectID string
	if g.SubjectID != nil {
		subjectID = *g.SubjectID
	}
	if subjectID == "" {
		// fall back to first active subject so entry.subject_id stays valid
		subs, err := q.ListActiveSubjects(ctx, userID)
		if err != nil || len(subs) == 0 {
			fail(w, http.StatusBadRequest, "VALIDATION", "无法确定学习科目，无法生成条目")
			return "", false
		}
		subjectID = subs[0].ID
	}
	if _, err := q.GetSubject(ctx, db.GetSubjectParams{ID: subjectID, UserID: userID}); err != nil {
		fail(w, http.StatusBadRequest, "VALIDATION", "目标关联科目不可用")
		return "", false
	}
	if durMin == nil || *durMin < 1 || *durMin > 1440 {
		fail(w, http.StatusBadRequest, "VALIDATION", "createEntry 需要 1–1440 的 durationMin")
		return "", false
	}
	if date == "" {
		date = domain.Today()
	}
	if !domain.ValidateDate(date) {
		fail(w, http.StatusBadRequest, "VALIDATION", "date 必须是 YYYY-MM-DD")
		return "", false
	}
	eid, err := nid()
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return "", false
	}
	now := nowMs()
	if err := q.CreateEntry(ctx, db.CreateEntryParams{
		ID: eid, UserID: userID, Date: date, SubjectID: subjectID, Title: title,
		Note: "", DurationMin: *durMin, Source: source, Sort: 0,
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return "", false
	}
	return eid, true
}

func durPtr(p optional[int64]) *int64 {
	if !p.Set {
		return nil
	}
	return p.Val
}

func (d *Deps) completeTask(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	ctx := r.Context()
	q := d.q()
	cur, err := q.GetTask(ctx, db.GetTaskParams{ID: id, UserID: uid(r)})
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "子任务不存在")
		return
	}
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	var req taskRequest
	if r.ContentLength != 0 { // 空 body = 仅标记完成
		if !decodeJSON(w, r, &req) {
			return
		}
	}
	wantEntry := req.CreateEntry.Set && req.CreateEntry.Val != nil && *req.CreateEntry.Val
	if cur.DoneAt != nil {
		// 已完成：幂等返回；例外是「补建 entry」——done 但还没挂条目时允许补上
		if wantEntry && cur.EntryID == nil {
			g, okG := d.requireGoal(w, r, cur.GoalID)
			if !okG {
				return
			}
			eid, okE := d.maybeCreateEntry(w, r, g, cur.Title, req.Date, durPtr(req.DurationMin), "goal")
			if !okE {
				return
			}
			if err := q.UpdateTask(ctx, db.UpdateTaskParams{
				ID: id, Title: cur.Title, DueDate: cur.DueDate, WeekStart: cur.WeekStart,
				DoneAt: cur.DoneAt, Reflection: cur.Reflection, EntryID: &eid,
				Sort: cur.Sort, UpdatedAt: nowMs(),
			}); err != nil {
				fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
				return
			}
		}
		t, _ := q.GetTask(ctx, db.GetTaskParams{ID: id, UserID: uid(r)})
		ok(w, taskOut(t))
		return
	}
	now := nowMs()
	entryID := cur.EntryID
	reflection := cur.Reflection
	if req.Reflection.Set {
		if req.Reflection.Val == nil {
			reflection = ""
		} else {
			reflection = *req.Reflection.Val
		}
	}
	if wantEntry {
		g, okG := d.requireGoal(w, r, cur.GoalID)
		if !okG {
			return
		}
		eid, okE := d.maybeCreateEntry(w, r, g, cur.Title, req.Date, durPtr(req.DurationMin), "goal")
		if !okE {
			return
		}
		entryID = &eid
	} else if req.EntryID.Set {
		entryID = nil
		if req.EntryID.Val != nil && *req.EntryID.Val != "" {
			eid := *req.EntryID.Val
			if _, err := q.GetEntry(ctx, db.GetEntryParams{ID: eid, UserID: uid(r)}); errors.Is(err, sql.ErrNoRows) {
				fail(w, http.StatusBadRequest, "VALIDATION", "entryId 不存在")
				return
			} else if err != nil {
				fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
				return
			}
			entryID = &eid
		}
	}
	if err := q.UpdateTask(ctx, db.UpdateTaskParams{
		ID: id, Title: cur.Title, DueDate: cur.DueDate, WeekStart: cur.WeekStart,
		DoneAt: &now, Reflection: reflection, EntryID: entryID, Sort: cur.Sort,
		UpdatedAt: now,
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	t, _ := q.GetTask(ctx, db.GetTaskParams{ID: id, UserID: uid(r)})
	ok(w, taskOut(t))
}

func (d *Deps) uncompleteTask(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	ctx := r.Context()
	q := d.q()
	cur, err := q.GetTask(ctx, db.GetTaskParams{ID: id, UserID: uid(r)})
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "子任务不存在")
		return
	}
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	// 取消完成：断开 entry 引用，entry 本身保留（数据安全）
	if err := q.UpdateTask(ctx, db.UpdateTaskParams{
		ID: id, Title: cur.Title, DueDate: cur.DueDate, WeekStart: cur.WeekStart,
		DoneAt: nil, Reflection: cur.Reflection, EntryID: nil, Sort: cur.Sort,
		UpdatedAt: nowMs(),
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	t, _ := q.GetTask(ctx, db.GetTaskParams{ID: id, UserID: uid(r)})
	ok(w, taskOut(t))
}
