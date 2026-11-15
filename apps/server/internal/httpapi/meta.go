package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"journal/internal/db"
	"journal/internal/domain"
)

// ---- settings ----

type settingDTO struct {
	ExamName     string  `json:"examName"`
	ExamDate     *string `json:"examDate"`
	PhaseStart   *string `json:"phaseStart"`
	DailyGoalMin int64   `json:"dailyGoalMin"`
	WeekStartsOn int64   `json:"weekStartsOn"`
	FocusMin     int64   `json:"focusMin"`
	BreakMin     int64   `json:"breakMin"`
	Theme        string  `json:"theme"`
	UpdatedAt    int64   `json:"updatedAt"`
}

func settingOut(s db.Setting) settingDTO {
	return settingDTO{ExamName: s.ExamName, ExamDate: s.ExamDate, PhaseStart: s.PhaseStart,
		DailyGoalMin: s.DailyGoalMin, WeekStartsOn: s.WeekStartsOn, FocusMin: s.FocusMin,
		BreakMin: s.BreakMin, Theme: s.Theme, UpdatedAt: s.UpdatedAt}
}

// getSettingOrCreate returns the user's setting row, creating it with column
// defaults on first access (idempotent).
func (d *Deps) getSettingOrCreate(r *http.Request) (db.Setting, error) {
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	s, err := q.GetSetting(ctx, userID)
	if err == nil {
		return s, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return db.Setting{}, err
	}
	now := nowMs()
	if err := q.CreateSetting(ctx, db.CreateSettingParams{
		UserID: userID, ExamName: "考研初试", DailyGoalMin: 360, WeekStartsOn: 1,
		FocusMin: 50, BreakMin: 10, Theme: "graphite", UpdatedAt: now,
	}); err != nil {
		return db.Setting{}, err
	}
	return q.GetSetting(ctx, userID)
}

func (d *Deps) getSettings(w http.ResponseWriter, r *http.Request) {
	s, err := d.getSettingOrCreate(r)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, settingOut(s))
}

type patchSettingsRequest struct {
	ExamName     optional[string] `json:"examName"`
	ExamDate     optional[string] `json:"examDate"`
	PhaseStart   optional[string] `json:"phaseStart"`
	DailyGoalMin optional[int64]  `json:"dailyGoalMin"`
	WeekStartsOn optional[int64]  `json:"weekStartsOn"`
	FocusMin     optional[int64]  `json:"focusMin"`
	BreakMin     optional[int64]  `json:"breakMin"`
	Theme        optional[string] `json:"theme"`
}

func validDateOrEmpty(s string) bool { return s == "" || domain.ValidateDate(s) }

func (d *Deps) patchSettings(w http.ResponseWriter, r *http.Request) {
	var req patchSettingsRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	cur, err := d.getSettingOrCreate(r)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	out := settingOut(cur)
	if req.ExamName.Set && req.ExamName.Val != nil {
		v := strings.TrimSpace(*req.ExamName.Val)
		if len([]rune(v)) > 50 {
			fail(w, http.StatusBadRequest, "VALIDATION", "examName 过长")
			return
		}
		out.ExamName = v
	}
	for _, p := range []struct {
		name string
		f    optional[string]
		dst  **string
	}{
		{"examDate", req.ExamDate, &out.ExamDate},
		{"phaseStart", req.PhaseStart, &out.PhaseStart},
	} {
		if p.f.Set {
			if p.f.Val == nil {
				*p.dst = nil
			} else {
				v := strings.TrimSpace(*p.f.Val)
				if !validDateOrEmpty(v) {
					fail(w, http.StatusBadRequest, "VALIDATION", p.name+" 必须是 YYYY-MM-DD 或 null")
					return
				}
				if v == "" {
					*p.dst = nil
				} else {
					*p.dst = &v
				}
			}
		}
	}
	ranges := []struct {
		name string
		f    optional[int64]
		dst  *int64
		min  int64
		max  int64
	}{
		{"dailyGoalMin", req.DailyGoalMin, &out.DailyGoalMin, 1, 1440},
		{"weekStartsOn", req.WeekStartsOn, &out.WeekStartsOn, 1, 7},
		{"focusMin", req.FocusMin, &out.FocusMin, 1, 240},
		{"breakMin", req.BreakMin, &out.BreakMin, 1, 240},
	}
	for _, p := range ranges {
		if p.f.Set {
			if p.f.Val == nil || *p.f.Val < p.min || *p.f.Val > p.max {
				fail(w, http.StatusBadRequest, "VALIDATION", p.name+" 超出允许范围")
				return
			}
			*p.dst = *p.f.Val
		}
	}
	if req.Theme.Set && req.Theme.Val != nil {
		v := strings.TrimSpace(*req.Theme.Val)
		if len([]rune(v)) > 30 {
			fail(w, http.StatusBadRequest, "VALIDATION", "theme 过长")
			return
		}
		out.Theme = v
	}
	out.UpdatedAt = nowMs()
	if err := d.q().UpdateSetting(r.Context(), db.UpdateSettingParams{
		UserID: uid(r), ExamName: out.ExamName, ExamDate: out.ExamDate,
		PhaseStart: out.PhaseStart, DailyGoalMin: out.DailyGoalMin,
		WeekStartsOn: out.WeekStartsOn, FocusMin: out.FocusMin, BreakMin: out.BreakMin,
		Theme: out.Theme, UpdatedAt: out.UpdatedAt,
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, out)
}

// ---- subjects ----

type subjectRequest struct {
	Name  string           `json:"name"`
	Color optional[string] `json:"color"`
	Sort  optional[int64]  `json:"sort"`
}

func (d *Deps) listSubjects(w http.ResponseWriter, r *http.Request) {
	rows, err := d.q().ListSubjects(r.Context(), uid(r))
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	out := make([]subjectDTO, 0, len(rows))
	for _, s := range rows {
		out = append(out, subjectOut(s))
	}
	ok(w, out)
}

func (d *Deps) createSubject(w http.ResponseWriter, r *http.Request) {
	var req subjectRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len([]rune(name)) > 50 {
		fail(w, http.StatusBadRequest, "VALIDATION", "name 必填且不超过 50 字")
		return
	}
	color := "#8D919A"
	if req.Color.Set && req.Color.Val != nil {
		if !domain.ValidColor(*req.Color.Val) {
			fail(w, http.StatusBadRequest, "VALIDATION", "color 必须是 #RRGGBB")
			return
		}
		color = strings.ToUpper(*req.Color.Val)
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	if _, err := q.GetSubjectByName(ctx, db.GetSubjectByNameParams{UserID: userID, Name: name}); err == nil {
		fail(w, http.StatusConflict, "CONFLICT", "同名科目已存在")
		return
	}
	sort := int64(0)
	if req.Sort.Set && req.Sort.Val != nil {
		sort = *req.Sort.Val
	} else if n, err := q.NextSubjectSort(ctx, userID); err == nil {
		sort = n
	}
	sid, err := nid()
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	now := nowMs()
	if err := q.CreateSubject(ctx, db.CreateSubjectParams{
		ID: sid, UserID: userID, Name: name, Color: color, Sort: sort,
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		fail(w, http.StatusConflict, "CONFLICT", "同名科目已存在")
		return
	}
	s, err := q.GetSubject(ctx, db.GetSubjectParams{ID: sid, UserID: userID})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, subjectOut(s))
}

func (d *Deps) updateSubject(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	var req subjectRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	cur, err := q.GetSubject(ctx, db.GetSubjectParams{ID: id, UserID: userID})
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "科目不存在")
		return
	}
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	name := cur.Name
	if strings.TrimSpace(req.Name) != "" {
		name = strings.TrimSpace(req.Name)
		if len([]rune(name)) > 50 {
			fail(w, http.StatusBadRequest, "VALIDATION", "name 过长")
			return
		}
	}
	color := cur.Color
	if req.Color.Set {
		if req.Color.Val == nil || !domain.ValidColor(*req.Color.Val) {
			fail(w, http.StatusBadRequest, "VALIDATION", "color 必须是 #RRGGBB")
			return
		}
		color = strings.ToUpper(*req.Color.Val)
	}
	sort := cur.Sort
	if req.Sort.Set && req.Sort.Val != nil {
		sort = *req.Sort.Val
	}
	if err := q.UpdateSubject(ctx, db.UpdateSubjectParams{
		ID: id, UserID: userID, Name: name, Color: color, Sort: sort, UpdatedAt: nowMs(),
	}); err != nil {
		fail(w, http.StatusConflict, "CONFLICT", "同名科目已存在")
		return
	}
	s, _ := q.GetSubject(ctx, db.GetSubjectParams{ID: id, UserID: userID})
	ok(w, subjectOut(s))
}

func (d *Deps) archiveSubject(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	if _, err := q.GetSubject(ctx, db.GetSubjectParams{ID: id, UserID: userID}); errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "科目不存在")
		return
	} else if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	n := nowMs()
	if err := q.SetSubjectArchived(ctx, db.SetSubjectArchivedParams{
		ID: id, UserID: userID, ArchivedAt: &n, UpdatedAt: n,
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	s, _ := q.GetSubject(ctx, db.GetSubjectParams{ID: id, UserID: userID})
	ok(w, subjectOut(s))
}

// ---- states ----

type stateRequest struct {
	Label    string           `json:"label"`
	Color    optional[string] `json:"color"`
	Polarity optional[int64]  `json:"polarity"`
	Sort     optional[int64]  `json:"sort"`
}

func (d *Deps) listStates(w http.ResponseWriter, r *http.Request) {
	rows, err := d.q().ListStates(r.Context(), uid(r))
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	out := make([]stateDTO, 0, len(rows))
	for _, s := range rows {
		out = append(out, stateOut(s))
	}
	ok(w, out)
}

func (d *Deps) createState(w http.ResponseWriter, r *http.Request) {
	var req stateRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	label := strings.TrimSpace(req.Label)
	if label == "" || len([]rune(label)) > 20 {
		fail(w, http.StatusBadRequest, "VALIDATION", "label 必填且不超过 20 字")
		return
	}
	color := "#8D919A"
	if req.Color.Set {
		if req.Color.Val == nil || !domain.ValidColor(*req.Color.Val) {
			fail(w, http.StatusBadRequest, "VALIDATION", "color 必须是 #RRGGBB")
			return
		}
		color = strings.ToUpper(*req.Color.Val)
	}
	polarity := int64(0)
	if req.Polarity.Set && req.Polarity.Val != nil {
		if *req.Polarity.Val < -1 || *req.Polarity.Val > 1 {
			fail(w, http.StatusBadRequest, "VALIDATION", "polarity 只能是 -1/0/1")
			return
		}
		polarity = *req.Polarity.Val
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	sort := int64(0)
	if req.Sort.Set && req.Sort.Val != nil {
		sort = *req.Sort.Val
	} else if n, err := q.NextStateSort(ctx, userID); err == nil {
		sort = n
	}
	sid, err := nid()
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	now := nowMs()
	if err := q.CreateState(ctx, db.CreateStateParams{
		ID: sid, UserID: userID, Label: label, Color: color, Polarity: polarity,
		Sort: sort, CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	s, _ := q.GetState(ctx, db.GetStateParams{ID: sid, UserID: userID})
	ok(w, stateOut(s))
}

func (d *Deps) updateState(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	var req stateRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	cur, err := q.GetState(ctx, db.GetStateParams{ID: id, UserID: userID})
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "状态不存在")
		return
	}
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	label := cur.Label
	if strings.TrimSpace(req.Label) != "" {
		label = strings.TrimSpace(req.Label)
		if len([]rune(label)) > 20 {
			fail(w, http.StatusBadRequest, "VALIDATION", "label 过长")
			return
		}
	}
	color := cur.Color
	if req.Color.Set {
		if req.Color.Val == nil || !domain.ValidColor(*req.Color.Val) {
			fail(w, http.StatusBadRequest, "VALIDATION", "color 必须是 #RRGGBB")
			return
		}
		color = strings.ToUpper(*req.Color.Val)
	}
	polarity := cur.Polarity
	if req.Polarity.Set && req.Polarity.Val != nil {
		if *req.Polarity.Val < -1 || *req.Polarity.Val > 1 {
			fail(w, http.StatusBadRequest, "VALIDATION", "polarity 只能是 -1/0/1")
			return
		}
		polarity = *req.Polarity.Val
	}
	sort := cur.Sort
	if req.Sort.Set && req.Sort.Val != nil {
		sort = *req.Sort.Val
	}
	if err := q.UpdateState(ctx, db.UpdateStateParams{
		ID: id, UserID: userID, Label: label, Color: color, Polarity: polarity,
		Sort: sort, UpdatedAt: nowMs(),
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	s, _ := q.GetState(ctx, db.GetStateParams{ID: id, UserID: userID})
	ok(w, stateOut(s))
}

func (d *Deps) archiveState(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	if _, err := q.GetState(ctx, db.GetStateParams{ID: id, UserID: userID}); errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "状态不存在")
		return
	} else if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	n := nowMs()
	if err := q.SetStateArchived(ctx, db.SetStateArchivedParams{
		ID: id, UserID: userID, ArchivedAt: &n, UpdatedAt: n,
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	s, _ := q.GetState(ctx, db.GetStateParams{ID: id, UserID: userID})
	ok(w, stateOut(s))
}
