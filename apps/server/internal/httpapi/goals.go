package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"sort"
	"strings"

	"journal/internal/db"
	"journal/internal/domain"
)

// ---- goals ----

type goalSummaryDTO struct {
	ID              string  `json:"id"`
	Period          string  `json:"period"`
	Title           string  `json:"title"`
	Type            string  `json:"type"`
	TargetValue     *int64  `json:"targetValue"`
	Unit            *string `json:"unit"`
	SubjectID       *string `json:"subjectId"`
	SubjectName     string  `json:"subjectName,omitempty"`
	Color           string  `json:"color"`
	Note            string  `json:"note"`
	SortOrder       int64   `json:"sortOrder"`
	Status          string  `json:"status"`
	CarriedFrom     *string `json:"carriedFrom"`
	Percent         int     `json:"percent"`
	Reached         bool    `json:"reached"`
	ActualValue     int     `json:"actualValue"`
	TotalValue      int     `json:"totalValue"`
	PlannedDaily    *int    `json:"plannedDaily"`
	PlannedWeekly   *int    `json:"plannedWeekly"`
	SuggestedDaily  *int    `json:"suggestedDaily"`
	SuggestedWeekly *int    `json:"suggestedWeekly"`
	Remaining       *int    `json:"remaining"`
	RemainingDays   *int    `json:"remainingDays"`
	Pace            *int    `json:"pace"` // COUNT: actual−均摊期望；CHECKLIST: −逾期任务数
	CreatedAt       int64   `json:"createdAt"`
	UpdatedAt       int64   `json:"updatedAt"`
}

type goalDetailDTO struct {
	goalSummaryDTO
	Tasks    []taskDTO             `json:"tasks"`
	Checkins []checkinDTO          `json:"checkins"`
	Weeks    []domain.WeekProgress `json:"weeks"`
}

type dayMarkAgg struct {
	Total int `json:"total"`
	Done  int `json:"done"`
}

type goalMonthDTO struct {
	Period       string                `json:"period"`
	MonthPercent int                   `json:"monthPercent"`
	ReachedCount int                   `json:"reachedCount"`
	GoalCount    int                   `json:"goalCount"`
	Goals        []goalSummaryDTO      `json:"goals"`
	DayMarks     map[string]dayMarkAgg `json:"dayMarks"`
}

func intPtr(v int) *int { return &v }

// goalColor resolves display color: explicit color > subject color > grey.
func goalColor(g db.Goal, subjectColor string) string {
	if g.Color != nil && *g.Color != "" {
		return *g.Color
	}
	if subjectColor != "" {
		return subjectColor
	}
	return "#8D919A"
}

// computeSummary builds the read-time progress fields for one goal. Callers
// fetch weekStartsOn/today once per request and pass them in.
func computeSummary(g db.Goal, wso int, today string,
	tasks []taskDTO, checkins []checkinDTO, subjectColor, subjectName string) goalSummaryDTO {
	out := goalSummaryDTO{
		ID: g.ID, Period: g.Period, Title: g.Title, Type: g.Type,
		TargetValue: g.TargetValue, Unit: g.Unit, SubjectID: g.SubjectID,
		SubjectName: subjectName, Color: goalColor(g, subjectColor), Note: g.Note,
		SortOrder: g.Sort, Status: g.Status, CarriedFrom: g.CarriedFrom,
		CreatedAt: g.CreatedAt, UpdatedAt: g.UpdatedAt,
	}
	asOf, err := domain.AsOfForPeriod(g.Period, today)
	if err != nil {
		asOf = today
	}
	if g.Type == "COUNT" {
		target := 0
		if g.TargetValue != nil {
			target = int(*g.TargetValue)
		}
		actual := 0
		for _, c := range checkins {
			actual += int(c.Quantity)
		}
		p, err := domain.GoalProgressCount(target, actual, g.Period, asOf, wso)
		if err != nil {
			p = domain.Progress{Actual: actual, Total: target}
		}
		out.ActualValue, out.TotalValue = p.Actual, p.Total
		out.Percent, out.Reached = p.Percent, p.Reached
		out.Remaining = intPtr(p.Remaining)
		out.RemainingDays = intPtr(p.RemainingDays)
		out.PlannedDaily = intPtr(p.PlannedDaily)
		out.PlannedWeekly = intPtr(p.PlannedWeekly)
		out.SuggestedDaily = intPtr(p.SuggestedDaily)
		out.SuggestedWeekly = intPtr(p.SuggestedWeekly)
		if pace, err := domain.PaceCount(target, actual, g.Period, asOf); err == nil {
			out.Pace = intPtr(pace)
		}
	} else {
		done, total, overdue := 0, len(tasks), 0
		for _, t := range tasks {
			if t.Done {
				done++
			}
			if od, err := domain.TaskOverdue(t.Done, derefStr(t.DueDate), derefStr(t.WeekStart), asOf); err == nil && od {
				overdue++
			}
		}
		out.Pace = intPtr(-overdue)
		p := domain.GoalProgressChecklist(done, total)
		out.ActualValue, out.TotalValue = p.Actual, p.Total
		out.Percent, out.Reached = p.Percent, p.Reached
		out.Remaining = intPtr(p.Remaining)
	}
	return out
}

// loadGoalBundle fetches tasks+checkins for every goal in a period (the
// underlying queries join through goal for user isolation), grouped by goal id.
func (d *Deps) loadGoalBundle(r *http.Request, userID, period string) (
	map[string][]taskDTO, map[string][]checkinDTO, error) {
	tasksByGoal := map[string][]taskDTO{}
	checkinsByGoal := map[string][]checkinDTO{}
	ctx := r.Context()
	q := d.q()
	taskRows, err := q.ListTasksForUserPeriod(ctx, db.ListTasksForUserPeriodParams{
		UserID: userID, Period: period,
	})
	if err != nil {
		return nil, nil, err
	}
	for _, t := range taskRows {
		tasksByGoal[t.GoalID] = append(tasksByGoal[t.GoalID], taskOut(t))
	}
	checkinRows, err := q.ListCheckinsForUserPeriod(ctx, db.ListCheckinsForUserPeriodParams{
		UserID: userID, Period: period,
	})
	if err != nil {
		return nil, nil, err
	}
	for _, c := range checkinRows {
		checkinsByGoal[c.GoalID] = append(checkinsByGoal[c.GoalID], checkinOut(c))
	}
	for _, ts := range tasksByGoal {
		sort.Slice(ts, func(i, j int) bool { return ts[i].Sort < ts[j].Sort })
	}
	return tasksByGoal, checkinsByGoal, nil
}

// subjectInfo resolves subject name/color for a goal's subject_id.
func (d *Deps) subjectInfo(r *http.Request, subjectID *string) (name, color string) {
	if subjectID == nil {
		return "", ""
	}
	s, err := d.q().GetSubject(r.Context(), db.GetSubjectParams{ID: *subjectID, UserID: uid(r)})
	if err != nil {
		return "", ""
	}
	return s.Name, s.Color
}

func (d *Deps) listGoals(w http.ResponseWriter, r *http.Request) {
	period := queryParam(r, "period")
	if period == "" {
		period = domain.PeriodOf(domain.Today())
	}
	if !domain.ValidatePeriod(period) {
		fail(w, http.StatusBadRequest, "VALIDATION", "period 必须是 YYYY-MM")
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	goalRows, err := q.ListGoalsByPeriod(ctx, db.ListGoalsByPeriodParams{UserID: userID, Period: period})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	tasksByGoal, checkinsByGoal, err := d.loadGoalBundle(r, userID, period)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	summaries := make([]goalSummaryDTO, 0, len(goalRows))
	dayMarks := map[string]dayMarkAgg{}
	percentSum, reachedCount := 0, 0
	setting, _ := d.getSettingOrCreate(r)
	wso, today := int(setting.WeekStartsOn), domain.Today()
	for _, g := range goalRows {
		tasks := tasksByGoal[g.ID]
		checkins := checkinsByGoal[g.ID]
		sname, scolor := d.subjectInfo(r, g.SubjectID)
		sum := computeSummary(g, wso, today, tasks, checkins, scolor, sname)
		summaries = append(summaries, sum)
		percentSum += sum.Percent
		if sum.Reached {
			reachedCount++
		}
		// dayMarks: COUNT → one mark per checkin (done); CHECKLIST → per task
		// anchored at dueDate else weekStart, done = task.done.
		if g.Type == "COUNT" {
			for _, c := range checkins {
				m := dayMarks[c.Date]
				m.Total++
				m.Done++
				dayMarks[c.Date] = m
			}
		} else {
			for _, t := range tasks {
				anchor := ""
				if t.DueDate != nil && *t.DueDate != "" {
					anchor = *t.DueDate
				} else if t.WeekStart != nil && *t.WeekStart != "" {
					anchor = *t.WeekStart
				}
				if anchor == "" {
					continue
				}
				m := dayMarks[anchor]
				m.Total++
				if t.Done {
					m.Done++
				}
				dayMarks[anchor] = m
			}
		}
	}
	monthPercent := 0
	if len(summaries) > 0 {
		monthPercent = int(float64(percentSum)/float64(len(summaries)) + 0.5)
	}
	ok(w, goalMonthDTO{
		Period: period, MonthPercent: monthPercent, ReachedCount: reachedCount,
		GoalCount: len(summaries), Goals: summaries, DayMarks: dayMarks,
	})
}

type goalRequest struct {
	ID          optional[string] `json:"id"`
	Period      string           `json:"period"`
	Title       string           `json:"title"`
	Type        string           `json:"type"`
	TargetValue optional[int64]  `json:"targetValue"`
	Unit        optional[string] `json:"unit"`
	SubjectID   optional[string] `json:"subjectId"`
	Color       optional[string] `json:"color"`
	Note        optional[string] `json:"note"`
	Sort        optional[int64]  `json:"sort"`
	Status      optional[string] `json:"status"`
}

func (d *Deps) validateGoalInput(w http.ResponseWriter, r *http.Request, req *goalRequest,
	title, goalType string, target *int64, unit, color, note *string) bool {
	if strings.TrimSpace(title) == "" || len([]rune(title)) > 100 {
		fail(w, http.StatusBadRequest, "VALIDATION", "title 必填且不超过 100 字")
		return false
	}
	if goalType != "COUNT" && goalType != "CHECKLIST" {
		fail(w, http.StatusBadRequest, "VALIDATION", "type 只能是 COUNT/CHECKLIST")
		return false
	}
	if goalType == "COUNT" {
		if target == nil || *target < 1 || *target > 1000000 {
			fail(w, http.StatusBadRequest, "VALIDATION", "COUNT 目标需要 1–1000000 的 targetValue")
			return false
		}
	}
	if unit != nil && len([]rune(*unit)) > 20 {
		fail(w, http.StatusBadRequest, "VALIDATION", "unit 过长")
		return false
	}
	if color != nil && *color != "" && !domain.ValidColor(*color) {
		fail(w, http.StatusBadRequest, "VALIDATION", "color 必须是 #RRGGBB")
		return false
	}
	if note != nil && len([]rune(*note)) > 2000 {
		fail(w, http.StatusBadRequest, "VALIDATION", "note 过长")
		return false
	}
	return true
}

func optStr(req optional[string]) *string {
	if !req.Set {
		return nil
	}
	return req.Val
}

func (d *Deps) createGoal(w http.ResponseWriter, r *http.Request) {
	var req goalRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if !domain.ValidatePeriod(req.Period) {
		fail(w, http.StatusBadRequest, "VALIDATION", "period 必须是 YYYY-MM")
		return
	}
	goalType := strings.ToUpper(strings.TrimSpace(req.Type))
	title := strings.TrimSpace(req.Title)
	var target *int64
	if req.TargetValue.Set {
		target = req.TargetValue.Val
	}
	unit := optStr(req.Unit)
	color := optStr(req.Color)
	note := optStr(req.Note)
	if !d.validateGoalInput(w, r, &req, title, goalType, target, unit, color, note) {
		return
	}
	if goalType == "CHECKLIST" {
		target = nil
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	// subjectId verify
	var subjectID *string
	if req.SubjectID.Set && req.SubjectID.Val != nil && *req.SubjectID.Val != "" {
		sid := *req.SubjectID.Val
		if _, err := q.GetSubject(ctx, db.GetSubjectParams{ID: sid, UserID: userID}); errors.Is(err, sql.ErrNoRows) {
			fail(w, http.StatusBadRequest, "VALIDATION", "subjectId 不存在")
			return
		} else if err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
		subjectID = &sid
	}
	if color != nil && *color != "" {
		c := strings.ToUpper(*color)
		color = &c
	}
	var noteStr string
	if note != nil {
		noteStr = *note
	}
	var unitStr, colorStr *string
	if unit != nil && *unit != "" {
		unitStr = unit
	}
	if color != nil && *color != "" {
		colorStr = color
	}
	gid := ""
	if req.ID.Set && req.ID.Val != nil && *req.ID.Val != "" {
		gid = *req.ID.Val
	} else {
		var err error
		gid, err = nid()
		if err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
	}
	if _, err := q.GetGoal(ctx, db.GetGoalParams{ID: gid, UserID: userID}); err == nil {
		fail(w, http.StatusConflict, "CONFLICT", "目标 id 已存在")
		return
	}
	sort := int64(0)
	if req.Sort.Set && req.Sort.Val != nil {
		sort = *req.Sort.Val
	} else if n, err := q.NextGoalSort(ctx, db.NextGoalSortParams{UserID: userID, Period: req.Period}); err == nil {
		sort = n
	}
	now := nowMs()
	if err := q.CreateGoal(ctx, db.CreateGoalParams{
		ID: gid, UserID: userID, Period: req.Period, SubjectID: subjectID, Title: title,
		Type: goalType, TargetValue: target, Unit: unitStr, Color: colorStr,
		Note: noteStr, Sort: sort, Status: "ACTIVE", CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		fail(w, http.StatusConflict, "CONFLICT", "目标创建失败")
		return
	}
	d.goalDetail(w, r, gid)
}

func (d *Deps) requireGoal(w http.ResponseWriter, r *http.Request, id string) (db.Goal, bool) {
	g, err := d.q().GetGoal(r.Context(), db.GetGoalParams{ID: id, UserID: uid(r)})
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "目标不存在")
		return db.Goal{}, false
	}
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return db.Goal{}, false
	}
	return g, true
}

// goalDetail writes the full GoalDetail response for goal id.
func (d *Deps) goalDetail(w http.ResponseWriter, r *http.Request, id string) {
	g, okG := d.requireGoal(w, r, id)
	if !okG {
		return
	}
	tasks, checkins, err := d.loadGoalBundle(r, uid(r), g.Period)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ts := tasks[g.ID]
	cs := checkins[g.ID]
	sname, scolor := d.subjectInfo(r, g.SubjectID)
	setting, _ := d.getSettingOrCreate(r)
	sum := computeSummary(g, int(setting.WeekStartsOn), domain.Today(), ts, cs, scolor, sname)
	detail := goalDetailDTO{
		goalSummaryDTO: sum, Tasks: ts, Checkins: cs, Weeks: []domain.WeekProgress{},
	}
	if g.Type == "COUNT" {
		target := 0
		if g.TargetValue != nil {
			target = int(*g.TargetValue)
		}
		items := make([]domain.DatedValue, 0, len(cs))
		for _, c := range cs {
			items = append(items, domain.DatedValue{Date: c.Date, Value: int(c.Quantity)})
		}
		setting, _ := d.getSettingOrCreate(r)
		weeks, err := domain.BuildWeeks(g.Period, target, items, int(setting.WeekStartsOn))
		if err == nil {
			detail.Weeks = weeks
		}
	}
	ok(w, detail)
}

func (d *Deps) getGoal(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	d.goalDetail(w, r, id)
}

func (d *Deps) updateGoal(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	g, okG := d.requireGoal(w, r, id)
	if !okG {
		return
	}
	var req goalRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Period != "" && req.Period != g.Period {
		fail(w, http.StatusBadRequest, "VALIDATION", "period 不可修改（请结转到下期）")
		return
	}
	title := g.Title
	if strings.TrimSpace(req.Title) != "" {
		title = strings.TrimSpace(req.Title)
	}
	goalType := g.Type
	if req.Type != "" {
		goalType = strings.ToUpper(strings.TrimSpace(req.Type))
	}
	var target *int64 = g.TargetValue
	if req.TargetValue.Set {
		target = req.TargetValue.Val
	}
	unit := g.Unit
	if req.Unit.Set {
		unit = req.Unit.Val
		if unit != nil && *unit == "" {
			unit = nil
		}
	}
	color := g.Color
	if req.Color.Set {
		color = req.Color.Val
		if color != nil {
			if *color == "" {
				color = nil
			} else {
				c := strings.ToUpper(*color)
				color = &c
			}
		}
	}
	noteStr := g.Note
	if req.Note.Set {
		if req.Note.Val == nil {
			noteStr = ""
		} else {
			noteStr = *req.Note.Val
		}
	}
	if goalType == "CHECKLIST" {
		target = nil
	}
	var unitV, colorV, noteV *string
	if unit != nil {
		unitV = unit
	}
	if color != nil {
		colorV = color
	}
	noteV = &noteStr
	subjectID := g.SubjectID
	if req.SubjectID.Set {
		subjectID = req.SubjectID.Val
		if subjectID != nil && *subjectID == "" {
			subjectID = nil
		}
	}
	if subjectID != nil {
		if _, err := d.q().GetSubject(r.Context(), db.GetSubjectParams{ID: *subjectID, UserID: uid(r)}); errors.Is(err, sql.ErrNoRows) {
			fail(w, http.StatusBadRequest, "VALIDATION", "subjectId 不存在")
			return
		}
	}
	status := g.Status
	if req.Status.Set && req.Status.Val != nil {
		st := strings.ToUpper(*req.Status.Val)
		if st != "ACTIVE" && st != "ARCHIVED" {
			fail(w, http.StatusBadRequest, "VALIDATION", "status 只能是 ACTIVE/ARCHIVED")
			return
		}
		status = st
	}
	sort := g.Sort
	if req.Sort.Set && req.Sort.Val != nil {
		sort = *req.Sort.Val
	}
	// reuse create-time validation on merged values
	var unitS, colorS, noteS *string
	if unitV != nil {
		unitS = unitV
	}
	if colorV != nil {
		colorS = colorV
	}
	noteS = noteV
	if !d.validateGoalInput(w, r, &req, title, goalType, target, unitS, colorS, noteS) {
		return
	}
	if err := d.q().UpdateGoal(r.Context(), db.UpdateGoalParams{
		ID: id, UserID: uid(r), SubjectID: subjectID, Title: title,
		TargetValue: target, Unit: unitV, Color: colorV, Note: noteStr,
		Sort: sort, Status: status, UpdatedAt: nowMs(),
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	d.goalDetail(w, r, id)
}

func (d *Deps) deleteGoal(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	g, okG := d.requireGoal(w, r, id)
	if !okG {
		return
	}
	// soft delete: archive keeps checkin/task history (v3 GoalStatus model)
	if g.Status != "ARCHIVED" {
		if err := d.q().UpdateGoal(r.Context(), db.UpdateGoalParams{
			ID: id, UserID: uid(r), SubjectID: g.SubjectID, Title: g.Title,
			TargetValue: g.TargetValue, Unit: g.Unit, Color: g.Color, Note: g.Note,
			Sort: g.Sort, Status: "ARCHIVED", UpdatedAt: nowMs(),
		}); err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
	}
	ok(w, map[string]bool{"deleted": true})
}

func (d *Deps) carryOverGoal(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	g, okG := d.requireGoal(w, r, id)
	if !okG {
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	next, err := domain.NextPeriod(g.Period)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	tx, err := d.DB.BeginTx(ctx, nil)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	defer tx.Rollback()
	qt := q.WithTx(tx)
	newID, err := nid()
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	sort, _ := qt.NextGoalSort(ctx, db.NextGoalSortParams{UserID: userID, Period: next})
	now := nowMs()
	if err := qt.CreateGoal(ctx, db.CreateGoalParams{
		ID: newID, UserID: userID, Period: next, SubjectID: g.SubjectID, Title: g.Title,
		Type: g.Type, TargetValue: g.TargetValue, Unit: g.Unit, Color: g.Color,
		Note: g.Note, Sort: sort, Status: "ACTIVE", CarriedFrom: &g.ID,
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	// CHECKLIST: carry over undone tasks with shifted dates
	if g.Type == "CHECKLIST" {
		taskRows, err := qt.ListTasksByGoal(ctx, g.ID)
		if err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
		for _, t := range taskRows {
			if t.DoneAt != nil {
				continue
			}
			var due, ws *string
			if t.DueDate != nil && *t.DueDate != "" {
				if shifted, err := domain.ShiftDateToPeriod(*t.DueDate, g.Period, next); err == nil {
					due = &shifted
				}
			}
			if t.WeekStart != nil && *t.WeekStart != "" {
				if shifted, err := domain.ShiftDateToPeriod(*t.WeekStart, g.Period, next); err == nil {
					ws = &shifted
				}
			}
			tid, err := nid()
			if err != nil {
				fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
				return
			}
			if err := qt.CreateTask(ctx, db.CreateTaskParams{
				ID: tid, GoalID: newID, Title: t.Title, DueDate: due, WeekStart: ws,
				Reflection: "", Sort: t.Sort, CreatedAt: now, UpdatedAt: now,
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
	d.goalDetail(w, r, newID)
}

func (d *Deps) todayGoals(w http.ResponseWriter, r *http.Request) {
	date := queryParam(r, "date")
	if date == "" {
		date = domain.Today()
	}
	if !domain.ValidateDate(date) {
		fail(w, http.StatusBadRequest, "VALIDATION", "date 必须是 YYYY-MM-DD")
		return
	}
	period := domain.PeriodOf(date)
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	goalRows, err := q.ListGoalsByPeriod(ctx, db.ListGoalsByPeriodParams{UserID: userID, Period: period})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	tasksByGoal, checkinsByGoal, err := d.loadGoalBundle(r, userID, period)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	setting, _ := d.getSettingOrCreate(r)
	wso := int(setting.WeekStartsOn)
	type item struct {
		GoalID         string      `json:"goalId"`
		Title          string      `json:"title"`
		Type           string      `json:"type"`
		Color          string      `json:"color"`
		Percent        int         `json:"percent"`
		Reached        bool        `json:"reached"`
		Unit           *string     `json:"unit"`
		TargetValue    *int64      `json:"targetValue"`
		ActualValue    *int        `json:"actualValue"`
		Remaining      *int        `json:"remaining"`
		SuggestedToday *int        `json:"suggestedToday"`
		Pace           *int        `json:"pace"`
		TodayCheckin   *checkinDTO `json:"todayCheckin"`
		TodayTasks     []taskDTO   `json:"todayTasks"`
	}
	items := []item{}
	for _, g := range goalRows {
		tasks := tasksByGoal[g.ID]
		checkins := checkinsByGoal[g.ID]
		sname, scolor := d.subjectInfo(r, g.SubjectID)
		sum := computeSummary(g, wso, date, tasks, checkins, scolor, sname)
		it := item{
			GoalID: g.ID, Title: g.Title, Type: g.Type, Color: sum.Color,
			Percent: sum.Percent, Reached: sum.Reached, Unit: g.Unit,
			TargetValue: g.TargetValue, TodayTasks: []taskDTO{},
		}
		av := sum.ActualValue
		it.ActualValue = &av
		it.Remaining = sum.Remaining
		it.SuggestedToday = sum.SuggestedDaily
		it.Pace = sum.Pace
		for i := range checkins {
			if checkins[i].Date == date {
				c := checkins[i]
				it.TodayCheckin = &c
				break
			}
		}
		for _, t := range tasks {
			rel, err := domain.TaskRelevantOn(t.Done, derefStr(t.DueDate),
				derefStr(t.WeekStart), date, wso)
			if err == nil && rel {
				tt := t
				tt.GoalTitle = g.Title
				it.TodayTasks = append(it.TodayTasks, tt)
			}
		}
		items = append(items, it)
	}
	ok(w, map[string]any{"date": date, "items": items})
}
