package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"journal/internal/db"
	"journal/internal/domain"
)

// ---- days ----

type dayMarkDTO struct {
	Date         string    `json:"date"`
	StateID      string    `json:"stateId"`
	State        *stateDTO `json:"state,omitempty"`
	TotalMin     int64     `json:"totalMin"`
	EntryCount   int64     `json:"entryCount"`
	DiaryPreview string    `json:"diaryPreview"`
	TaskDone     int64     `json:"taskDone"`
	TaskTotal    int64     `json:"taskTotal"`
}

func truncateRunes(s string, n int) string {
	s = strings.TrimSpace(s)
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)
	return string(r[:n]) + "…"
}

// listDays serves GET /days?from=&to= — the shared calendar aggregation.
func (d *Deps) listDays(w http.ResponseWriter, r *http.Request) {
	from, to := queryParam(r, "from"), queryParam(r, "to")
	if from == "" || to == "" || !domain.ValidateDate(from) || !domain.ValidateDate(to) {
		fail(w, http.StatusBadRequest, "VALIDATION", "from/to 必须是 YYYY-MM-DD")
		return
	}
	if from > to {
		from, to = to, from
	}
	if days, _ := domain.DaysBetween(from, to); days > 400 {
		fail(w, http.StatusBadRequest, "VALIDATION", "日期范围不能超过 400 天")
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	dayRows, err := q.ListDayRowsInRange(ctx, db.ListDayRowsInRangeParams{
		UserID: userID, FromDate: from, ToDate: to,
	})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	entryRows, err := q.ListEntriesInRange(ctx, db.ListEntriesInRangeParams{
		UserID: userID, FromDate: from, ToDate: to,
	})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	// per-date entry aggregates
	type agg struct {
		min   int64
		count int64
	}
	entriesByDate := map[string]*agg{}
	for _, e := range entryRows {
		a := entriesByDate[e.Date]
		if a == nil {
			a = &agg{}
			entriesByDate[e.Date] = a
		}
		a.min += e.DurationMin
		a.count++
	}
	// state lookup for labels/colors
	dayByDate := map[string]db.Day{}
	stateIDs := map[string]struct{}{}
	for _, dr := range dayRows {
		dayByDate[dr.Date] = dr
		if dr.StateID != nil {
			stateIDs[*dr.StateID] = struct{}{}
		}
	}
	states := map[string]db.State{}
	for id := range stateIDs {
		if s, err := q.GetState(ctx, db.GetStateParams{ID: id, UserID: userID}); err == nil {
			states[id] = s
		}
	}
	// task relevance per date across ACTIVE goals overlapping the range
	setting, _ := d.getSettingOrCreate(r)
	wso := int(setting.WeekStartsOn)
	goalRows, err := q.ListAllGoals(ctx, userID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	var activeGoals []db.Goal
	for _, g := range goalRows {
		if g.Status == "ARCHIVED" {
			continue
		}
		// goal period overlaps [from,to]?
		gFirst, gLast, err := domain.MonthBounds(g.Period)
		if err != nil || gLast < from || gFirst > to {
			continue
		}
		activeGoals = append(activeGoals, g)
	}
	type taskAgg struct{ done, total int64 }
	tasksByDate := map[string]*taskAgg{}
	if len(activeGoals) > 0 {
		activeSet := map[string]bool{}
		periods := map[string]bool{}
		for _, g := range activeGoals {
			activeSet[g.ID] = true
			periods[g.Period] = true
		}
		var taskRows []db.GoalTask
		for p := range periods {
			rows, err := q.ListTasksForUserPeriod(ctx, db.ListTasksForUserPeriodParams{
				UserID: userID, Period: p,
			})
			if err != nil {
				fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
				return
			}
			for _, t := range rows {
				if activeSet[t.GoalID] {
					taskRows = append(taskRows, t)
				}
			}
		}
		// iterate dates × tasks
		for date := from; ; {
			next, err := domain.AddDays(date, 1)
			if err != nil {
				break
			}
			for _, t := range taskRows {
				rel, err := domain.TaskRelevantOn(t.DoneAt != nil,
					derefStr(t.DueDate), derefStr(t.WeekStart), date, wso)
				if err != nil || !rel {
					continue
				}
				a := tasksByDate[date]
				if a == nil {
					a = &taskAgg{}
					tasksByDate[date] = a
				}
				a.total++
				if t.DoneAt != nil {
					a.done++
				}
			}
			if next > to {
				break
			}
			date = next
		}
	}
	// emit every date in range
	out := make([]dayMarkDTO, 0, 32)
	for date := from; ; {
		m := dayMarkDTO{Date: date}
		if dr, ok := dayByDate[date]; ok {
			if dr.StateID != nil {
				m.StateID = *dr.StateID
				if s, ok := states[*dr.StateID]; ok {
					so := stateOut(s)
					m.State = &so
				}
			}
			m.DiaryPreview = truncateRunes(dr.Diary, 40)
		}
		if a := entriesByDate[date]; a != nil {
			m.TotalMin = a.min
			m.EntryCount = a.count
		}
		if a := tasksByDate[date]; a != nil {
			m.TaskDone = a.done
			m.TaskTotal = a.total
		}
		out = append(out, m)
		next, err := domain.AddDays(date, 1)
		if err != nil || next > to {
			break
		}
		date = next
	}
	ok(w, out)
}

// dayDetail is GET/PATCH /days/{date}.
type dayDetailDTO struct {
	Date      string       `json:"date"`
	StateID   *string      `json:"stateId"`
	State     *stateDTO    `json:"state,omitempty"`
	Diary     string       `json:"diary"`
	UpdatedAt int64        `json:"updatedAt"`
	TotalMin  int64        `json:"totalMin"`
	Entries   []entryDTO   `json:"entries"`
	Tasks     []taskDTO    `json:"tasks"`
	Checkins  []checkinDTO `json:"checkins"`
}

// buildDayDetail assembles the day aggregate: day row + entries + relevant
// tasks + checkins dated on `date`.
func (d *Deps) buildDayDetail(r *http.Request, date string) (dayDetailDTO, error) {
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	out := dayDetailDTO{Date: date, Entries: []entryDTO{}, Tasks: []taskDTO{}, Checkins: []checkinDTO{}}
	day, err := q.GetDay(ctx, db.GetDayParams{UserID: userID, Date: date})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return out, err
	}
	if err == nil {
		out.StateID = day.StateID
		out.Diary = day.Diary
		out.UpdatedAt = day.UpdatedAt
		if day.StateID != nil {
			if s, err := q.GetState(ctx, db.GetStateParams{ID: *day.StateID, UserID: userID}); err == nil {
				so := stateOut(s)
				out.State = &so
			}
		}
	}
	entryRows, err := q.ListEntriesByDate(ctx, db.ListEntriesByDateParams{UserID: userID, Date: date})
	if err != nil {
		return out, err
	}
	for _, e := range entryRows {
		out.Entries = append(out.Entries, entryFromByDate(e))
		out.TotalMin += e.DurationMin
	}
	// tasks/checkins: ACTIVE goals of the period containing date
	period := domain.PeriodOf(date)
	goalRows, err := q.ListGoalsByPeriod(ctx, db.ListGoalsByPeriodParams{UserID: userID, Period: period})
	if err != nil {
		return out, err
	}
	setting, _ := d.getSettingOrCreate(r)
	wso := int(setting.WeekStartsOn)
	goalByID := map[string]db.Goal{}
	for _, g := range goalRows {
		goalByID[g.ID] = g
	}
	if len(goalRows) > 0 {
		taskRows, err := q.ListTasksForUserPeriod(ctx, db.ListTasksForUserPeriodParams{
			UserID: userID, Period: period,
		})
		if err != nil {
			return out, err
		}
		for _, t := range taskRows {
			g, okG := goalByID[t.GoalID]
			if !okG {
				continue
			}
			rel, err := domain.TaskRelevantOn(t.DoneAt != nil, derefStr(t.DueDate),
				derefStr(t.WeekStart), date, wso)
			if err != nil || !rel {
				continue
			}
			tt := taskOut(t)
			tt.GoalTitle = g.Title
			out.Tasks = append(out.Tasks, tt)
		}
		checkinRows, err := q.ListCheckinsByDate(ctx, db.ListCheckinsByDateParams{
			UserID: userID, CheckinDate: date, GoalPeriod: period,
		})
		if err != nil {
			return out, err
		}
		for _, c := range checkinRows {
			cc := checkinOut(c)
			if g, ok := goalByID[c.GoalID]; ok {
				cc.GoalTitle = g.Title
			}
			out.Checkins = append(out.Checkins, cc)
		}
	}
	sort.Slice(out.Tasks, func(i, j int) bool { return out.Tasks[i].Sort < out.Tasks[j].Sort })
	return out, nil
}

func (d *Deps) getDay(w http.ResponseWriter, r *http.Request) {
	date := chiURLDate(w, r)
	if date == "" {
		return
	}
	out, err := d.buildDayDetail(r, date)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, out)
}

func chiURLDate(w http.ResponseWriter, r *http.Request) string {
	date := chiURLParam(r, "date")
	if !domain.ValidateDate(date) {
		fail(w, http.StatusBadRequest, "VALIDATION", "date 必须是 YYYY-MM-DD")
		return ""
	}
	return date
}

func chiURLParam(r *http.Request, name string) string {
	return chi.URLParam(r, name)
}

// need chi import — placeholder to satisfy compiler until import added below.

type patchDayRequest struct {
	StateID optional[string] `json:"stateId"`
	Diary   optional[string] `json:"diary"`
}

func (d *Deps) patchDay(w http.ResponseWriter, r *http.Request) {
	date := chiURLDate(w, r)
	if date == "" {
		return
	}
	var req patchDayRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	day, err := q.GetDay(ctx, db.GetDayParams{UserID: userID, Date: date})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	var stateID *string
	diary := ""
	if err == nil {
		stateID = day.StateID
		diary = day.Diary
	}
	if req.StateID.Set {
		if req.StateID.Val == nil || *req.StateID.Val == "" {
			stateID = nil
		} else {
			sid := *req.StateID.Val
			if _, err := q.GetState(ctx, db.GetStateParams{ID: sid, UserID: userID}); errors.Is(err, sql.ErrNoRows) {
				fail(w, http.StatusBadRequest, "VALIDATION", "stateId 不存在")
				return
			} else if err != nil {
				fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
				return
			}
			stateID = &sid
		}
	}
	if req.Diary.Set && req.Diary.Val != nil {
		diary = *req.Diary.Val
	} else if req.Diary.Set {
		diary = ""
	}
	now := nowMs()
	if err == nil {
		if err := q.UpdateDay(ctx, db.UpdateDayParams{
			UserID: userID, Date: date, StateID: stateID, Diary: diary, UpdatedAt: now,
		}); err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
	} else if stateID != nil || strings.TrimSpace(diary) != "" {
		if err := q.CreateDay(ctx, db.CreateDayParams{
			UserID: userID, Date: date, StateID: stateID, Diary: diary,
			CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
	}
	out, err := d.buildDayDetail(r, date)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, out)
}

func (d *Deps) deleteDay(w http.ResponseWriter, r *http.Request) {
	date := chiURLDate(w, r)
	if date == "" {
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	tx, err := d.DB.BeginTx(ctx, nil)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	defer tx.Rollback()
	qt := q.WithTx(tx)
	if err := qt.DeleteEntriesByDate(ctx, db.DeleteEntriesByDateParams{UserID: userID, Date: date}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	if err := qt.DeleteDay(ctx, db.DeleteDayParams{UserID: userID, Date: date}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	if err := tx.Commit(); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, map[string]bool{"deleted": true})
}

// ---- entries ----

type entryRequest struct {
	Date        string           `json:"date"`
	SubjectID   optional[string] `json:"subjectId"`
	Subject     string           `json:"subject"`
	Title       optional[string] `json:"title"`
	Note        optional[string] `json:"note"`
	DurationMin optional[int64]  `json:"durationMin"`
	Source      optional[string] `json:"source"`
	Sort        optional[int64]  `json:"sort"`
}

var entrySources = map[string]bool{"manual": true, "focus": true, "goal": true, "import": true}

// resolveSubjectID maps subjectId (preferred) or subject name to a subject row.
// Names are trimmed, matched case-sensitively, and created on miss (legacy
// get-or-create semantics). Returns "" with a written error on failure.
func (d *Deps) resolveSubjectID(w http.ResponseWriter, r *http.Request, subjectID string, subjectName string, colorHint string) (string, bool) {
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	if subjectID != "" {
		if _, err := q.GetSubject(ctx, db.GetSubjectParams{ID: subjectID, UserID: userID}); errors.Is(err, sql.ErrNoRows) {
			fail(w, http.StatusBadRequest, "VALIDATION", "subjectId 不存在")
			return "", false
		} else if err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return "", false
		}
		return subjectID, true
	}
	name := strings.TrimSpace(subjectName)
	if name == "" {
		fail(w, http.StatusBadRequest, "VALIDATION", "subjectId 或 subject 必填")
		return "", false
	}
	if s, err := q.GetSubjectByName(ctx, db.GetSubjectByNameParams{UserID: userID, Name: name}); err == nil {
		return s.ID, true
	} else if !errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return "", false
	}
	// create with optional color hint
	color := "#8D919A"
	if validColor(colorHint) {
		color = strings.ToUpper(colorHint)
	}
	sort, _ := q.NextSubjectSort(ctx, userID)
	sid, err := nid()
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return "", false
	}
	now := nowMs()
	if err := q.CreateSubject(ctx, db.CreateSubjectParams{
		ID: sid, UserID: userID, Name: name, Color: color, Sort: sort,
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		// raced create — fall back to existing
		if s, err2 := q.GetSubjectByName(ctx, db.GetSubjectByNameParams{UserID: userID, Name: name}); err2 == nil {
			return s.ID, true
		}
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return "", false
	}
	return sid, true
}

// entryTitle derives a title: explicit > first line of note > subject name.
func entryTitle(explicit, note, subjectName string) string {
	if t := strings.TrimSpace(explicit); t != "" {
		return t
	}
	if i := strings.IndexByte(note, '\n'); i >= 0 {
		if t := strings.TrimSpace(note[:i]); t != "" {
			return t
		}
		return strings.TrimSpace(subjectName)
	}
	if t := strings.TrimSpace(note); t != "" {
		return t
	}
	return strings.TrimSpace(subjectName)
}

func (d *Deps) createEntry(w http.ResponseWriter, r *http.Request) {
	var req entryRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if !domain.ValidateDate(req.Date) {
		fail(w, http.StatusBadRequest, "VALIDATION", "date 必须是 YYYY-MM-DD")
		return
	}
	if !req.DurationMin.Set || req.DurationMin.Val == nil || *req.DurationMin.Val < 1 || *req.DurationMin.Val > 1440 {
		fail(w, http.StatusBadRequest, "VALIDATION", "durationMin 需在 1–1440")
		return
	}
	subjectID := ""
	if req.SubjectID.Set && req.SubjectID.Val != nil {
		subjectID = *req.SubjectID.Val
	}
	subjID, okS := d.resolveSubjectID(w, r, subjectID, req.Subject, "")
	if !okS {
		return
	}
	source := "manual"
	if req.Source.Set && req.Source.Val != nil {
		if !entrySources[*req.Source.Val] {
			fail(w, http.StatusBadRequest, "VALIDATION", "source 不合法")
			return
		}
		source = *req.Source.Val
	}
	ctx := r.Context()
	q := d.q()
	// subject name for title fallback
	subj, err := q.GetSubject(ctx, db.GetSubjectParams{ID: subjID, UserID: uid(r)})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	note := ""
	if req.Note.Set && req.Note.Val != nil {
		note = *req.Note.Val
	}
	title := entryTitle(derefOpt(req.Title), note, subj.Name)
	if title == "" {
		title = subj.Name
	}
	sort := int64(0)
	if req.Sort.Set && req.Sort.Val != nil {
		sort = *req.Sort.Val
	}
	eid, err := nid()
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	now := nowMs()
	if err := q.CreateEntry(ctx, db.CreateEntryParams{
		ID: eid, UserID: uid(r), Date: req.Date, SubjectID: subjID, Title: title,
		Note: note, DurationMin: *req.DurationMin.Val, Source: source, Sort: sort,
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	e, err := q.GetEntry(ctx, db.GetEntryParams{ID: eid, UserID: uid(r)})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, entryFromGet(e))
}

func derefOpt[T any](o optional[T]) string {
	if o.Val == nil {
		return ""
	}
	if s, ok := any(*o.Val).(string); ok {
		return s
	}
	return ""
}

func (d *Deps) updateEntry(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	var req entryRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	cur, err := q.GetEntry(ctx, db.GetEntryParams{ID: id, UserID: userID})
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "条目不存在")
		return
	}
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	date := cur.Date
	if req.Date != "" {
		if !domain.ValidateDate(req.Date) {
			fail(w, http.StatusBadRequest, "VALIDATION", "date 必须是 YYYY-MM-DD")
			return
		}
		date = req.Date
	}
	subjectID := cur.SubjectID
	if req.SubjectID.Set {
		if req.SubjectID.Val == nil || *req.SubjectID.Val == "" {
			fail(w, http.StatusBadRequest, "VALIDATION", "subjectId 不能为空")
			return
		}
		subjectID = *req.SubjectID.Val
	} else if req.Subject != "" {
		if sid, okS := d.resolveSubjectID(w, r, "", req.Subject, ""); okS {
			subjectID = sid
		} else {
			return
		}
	}
	if _, err := q.GetSubject(ctx, db.GetSubjectParams{ID: subjectID, UserID: userID}); errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusBadRequest, "VALIDATION", "subjectId 不存在")
		return
	} else if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	title := cur.Title
	if req.Title.Set {
		if req.Title.Val == nil {
			title = ""
		} else {
			title = strings.TrimSpace(*req.Title.Val)
		}
	}
	note := cur.Note
	if req.Note.Set {
		if req.Note.Val == nil {
			note = ""
		} else {
			note = *req.Note.Val
		}
	}
	if title == "" {
		subj, _ := q.GetSubject(ctx, db.GetSubjectParams{ID: subjectID, UserID: userID})
		title = entryTitle("", note, subj.Name)
		if title == "" {
			title = subj.Name
		}
	}
	dur := cur.DurationMin
	if req.DurationMin.Set {
		if req.DurationMin.Val == nil || *req.DurationMin.Val < 1 || *req.DurationMin.Val > 1440 {
			fail(w, http.StatusBadRequest, "VALIDATION", "durationMin 需在 1–1440")
			return
		}
		dur = *req.DurationMin.Val
	}
	source := cur.Source
	if req.Source.Set && req.Source.Val != nil {
		if !entrySources[*req.Source.Val] {
			fail(w, http.StatusBadRequest, "VALIDATION", "source 不合法")
			return
		}
		source = *req.Source.Val
	}
	sort := cur.Sort
	if req.Sort.Set && req.Sort.Val != nil {
		sort = *req.Sort.Val
	}
	if err := q.UpdateEntry(ctx, db.UpdateEntryParams{
		ID: id, UserID: userID, Date: date, SubjectID: subjectID, Title: title,
		Note: note, DurationMin: dur, Source: source, Sort: sort, UpdatedAt: nowMs(),
	}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	e, _ := q.GetEntry(ctx, db.GetEntryParams{ID: id, UserID: userID})
	ok(w, entryFromGet(e))
}

func (d *Deps) deleteEntry(w http.ResponseWriter, r *http.Request) {
	id, okID := urlID(w, r, "id")
	if !okID {
		return
	}
	if err := d.q().DeleteEntry(r.Context(), db.DeleteEntryParams{ID: id, UserID: uid(r)}); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, map[string]bool{"deleted": true})
}

type reorderRequest struct {
	Date string   `json:"date"`
	IDs  []string `json:"ids"`
}

func (d *Deps) reorderEntries(w http.ResponseWriter, r *http.Request) {
	var req reorderRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if !domain.ValidateDate(req.Date) {
		fail(w, http.StatusBadRequest, "VALIDATION", "date 必须是 YYYY-MM-DD")
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	rows, err := q.ListEntriesByDate(ctx, db.ListEntriesByDateParams{UserID: userID, Date: req.Date})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	allowed := map[string]bool{}
	for _, e := range rows {
		allowed[e.ID] = true
	}
	tx, err := d.DB.BeginTx(ctx, nil)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	defer tx.Rollback()
	qt := q.WithTx(tx)
	now := nowMs()
	for i, eid := range req.IDs {
		if !allowed[eid] {
			continue
		}
		if err := qt.SetEntrySort(ctx, db.SetEntrySortParams{
			ID: eid, UserID: userID, Sort: int64(i), UpdatedAt: now,
		}); err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	out := make([]entryDTO, 0, len(rows))
	rows2, _ := q.ListEntriesByDate(ctx, db.ListEntriesByDateParams{UserID: userID, Date: req.Date})
	for _, e := range rows2 {
		out = append(out, entryFromByDate(e))
	}
	ok(w, out)
}
