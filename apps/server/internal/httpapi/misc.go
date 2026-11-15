package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sort"
	"strings"

	"journal/internal/db"
	"journal/internal/domain"
)

// ---- search ----

type searchDayDTO struct {
	Date      string `json:"date"`
	StateID   string `json:"stateId"`
	Diary     string `json:"diary"`
	UpdatedAt int64  `json:"updatedAt"`
}

func (d *Deps) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(queryParam(r, "q"))
	typ := queryParam(r, "type")
	if typ != "entry" && typ != "diary" {
		typ = "all"
	}
	out := map[string]any{
		"keyword": q, "type": typ,
		"days": []searchDayDTO{}, "entries": []entryDTO{},
	}
	if q == "" {
		ok(w, out)
		return
	}
	ctx := r.Context()
	queries := d.q()
	userID := uid(r)
	if typ == "all" || typ == "diary" {
		rows, err := queries.SearchDaysByDiary(ctx, db.SearchDaysByDiaryParams{
			UserID: userID, Keyword: q,
		})
		if err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
		days := make([]searchDayDTO, 0, len(rows))
		for _, dr := range rows {
			sid := ""
			if dr.StateID != nil {
				sid = *dr.StateID
			}
			days = append(days, searchDayDTO{
				Date: dr.Date, StateID: sid, Diary: dr.Diary, UpdatedAt: dr.UpdatedAt,
			})
		}
		out["days"] = days
	}
	if typ == "all" || typ == "entry" {
		rows, err := queries.SearchEntries(ctx, db.SearchEntriesParams{
			UserID: userID, Keyword: q,
		})
		if err != nil {
			fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
			return
		}
		entries := make([]entryDTO, 0, len(rows))
		for _, e := range rows {
			entries = append(entries, entryFromSearch(e))
		}
		out["entries"] = entries
	}
	ok(w, out)
}

// ---- stats ----

func (d *Deps) statsMonth(w http.ResponseWriter, r *http.Request) {
	period := queryParam(r, "period")
	if period == "" {
		period = domain.PeriodOf(domain.Today())
	}
	if !domain.ValidatePeriod(period) {
		fail(w, http.StatusBadRequest, "VALIDATION", "period 必须是 YYYY-MM")
		return
	}
	first, last, err := domain.MonthBounds(period)
	if err != nil {
		fail(w, http.StatusBadRequest, "VALIDATION", "period 必须是 YYYY-MM")
		return
	}
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	entries, err := q.ListEntriesInRange(ctx, db.ListEntriesInRangeParams{
		UserID: userID, FromDate: first, ToDate: last,
	})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	dayRows, err := q.ListDayRowsInRange(ctx, db.ListDayRowsInRangeParams{
		UserID: userID, FromDate: first, ToDate: last,
	})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	facts := make([]domain.EntryFact, 0, len(entries))
	entryDates := map[string]bool{}
	var totalMin int64
	for _, e := range entries {
		facts = append(facts, domain.EntryFact{
			Date: e.Date, SubjectID: e.SubjectID, SubjectName: e.SubjectName,
			SubjectColor: e.SubjectColor, DurationMin: int(e.DurationMin),
		})
		entryDates[e.Date] = true
		totalMin += e.DurationMin
	}
	// recorded dates = day rows with content + entry dates
	recorded := map[string]bool{}
	for _, dr := range dayRows {
		if dr.StateID != nil || strings.TrimSpace(dr.Diary) != "" {
			recorded[dr.Date] = true
		}
	}
	for d := range entryDates {
		recorded[d] = true
	}
	// state breakdown needs state lookup per day row
	stateIDs := map[string]struct{}{}
	for _, dr := range dayRows {
		if dr.StateID != nil {
			stateIDs[*dr.StateID] = struct{}{}
		}
	}
	marks := []domain.StateMark{}
	for _, dr := range dayRows {
		if dr.StateID == nil {
			continue
		}
		if s, err := q.GetState(ctx, db.GetStateParams{ID: *dr.StateID, UserID: userID}); err == nil {
			marks = append(marks, domain.StateMark{
				StateID: s.ID, Label: s.Label, Color: s.Color,
			})
		}
	}
	_ = stateIDs
	// daily series
	dailyMap := map[string]*struct {
		min   int64
		count int64
	}{}
	for _, f := range facts {
		a := dailyMap[f.Date]
		if a == nil {
			a = &struct {
				min   int64
				count int64
			}{}
			dailyMap[f.Date] = a
		}
		a.min += int64(f.DurationMin)
		a.count++
	}
	daily := make([]map[string]any, 0, len(dailyMap))
	for date, a := range dailyMap {
		daily = append(daily, map[string]any{
			"date": date, "totalMin": a.min, "entryCount": a.count,
		})
	}
	sort.Slice(daily, func(i, j int) bool { return daily[i]["date"].(string) < daily[j]["date"].(string) })
	recordedDates := make([]string, 0, len(recorded))
	for d := range recorded {
		recordedDates = append(recordedDates, d)
	}
	ok(w, map[string]any{
		"period": period, "totalMin": totalMin, "entryCount": len(entries),
		"daysRecorded":     len(recordedDates),
		"subjectBreakdown": domain.SubjectBreakdown(facts),
		"stateBreakdown":   domain.StateBreakdown(marks),
		"daily":            daily,
	})
}

func (d *Deps) statsYear(w http.ResponseWriter, r *http.Request) {
	year := int(queryParamInt(r, "year", 0))
	if year < 2000 || year > 2100 {
		year = mustAtoi(domain.Today()[:4])
	}
	from := sprintfYear(year, "-01-01")
	to := sprintfYear(year, "-12-31")
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	entries, err := q.ListEntriesInRange(ctx, db.ListEntriesInRangeParams{
		UserID: userID, FromDate: from, ToDate: to,
	})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	facts := make([]domain.EntryFact, 0, len(entries))
	monthMap := map[string]*struct {
		min   int64
		count int64
	}{}
	var totalMin int64
	for _, e := range entries {
		facts = append(facts, domain.EntryFact{
			Date: e.Date, SubjectID: e.SubjectID, SubjectName: e.SubjectName,
			SubjectColor: e.SubjectColor, DurationMin: int(e.DurationMin),
		})
		totalMin += e.DurationMin
		m := e.Date[:7]
		a := monthMap[m]
		if a == nil {
			a = &struct {
				min   int64
				count int64
			}{}
			monthMap[m] = a
		}
		a.min += e.DurationMin
		a.count++
	}
	months := make([]map[string]any, 0, 12)
	for m := 1; m <= 12; m++ {
		p := sprintfYear(year, "-") + pad2(m)
		a := monthMap[p]
		row := map[string]any{"period": p, "totalMin": int64(0), "entryCount": int64(0)}
		if a != nil {
			row["totalMin"] = a.min
			row["entryCount"] = a.count
		}
		months = append(months, row)
	}
	ok(w, map[string]any{
		"year": year, "totalMin": totalMin, "entryCount": len(entries),
		"subjectBreakdown": domain.SubjectBreakdown(facts),
		"months":           months,
	})
}

func (d *Deps) statsHeatmap(w http.ResponseWriter, r *http.Request) {
	from, to := queryParam(r, "from"), queryParam(r, "to")
	if from == "" || to == "" || !domain.ValidateDate(from) || !domain.ValidateDate(to) {
		fail(w, http.StatusBadRequest, "VALIDATION", "from/to 必须是 YYYY-MM-DD")
		return
	}
	if from > to {
		from, to = to, from
	}
	if days, _ := domain.DaysBetween(from, to); days > 800 {
		fail(w, http.StatusBadRequest, "VALIDATION", "日期范围不能超过 800 天")
		return
	}
	rows, err := d.q().ListEntriesInRange(r.Context(), db.ListEntriesInRangeParams{
		UserID: uid(r), FromDate: from, ToDate: to,
	})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	type cell struct {
		Min   int64 `json:"totalMin"`
		Count int64 `json:"entryCount"`
	}
	m := map[string]*cell{}
	for _, e := range rows {
		c := m[e.Date]
		if c == nil {
			c = &cell{}
			m[e.Date] = c
		}
		c.Min += e.DurationMin
		c.Count++
	}
	out := make([]map[string]any, 0, len(m))
	for date, c := range m {
		out = append(out, map[string]any{
			"date": date, "totalMin": c.Min, "entryCount": c.Count,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i]["date"].(string) < out[j]["date"].(string) })
	ok(w, out)
}

func (d *Deps) streak(w http.ResponseWriter, r *http.Request) {
	today := domain.Today()
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	dayRows, err := q.ListRecordedDayDates(ctx, db.ListRecordedDayDatesParams{
		UserID: userID, Today: today,
	})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	entryDates, err := q.ListEntryDates(ctx, db.ListEntryDatesParams{
		UserID: userID, Today: today,
	})
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	recorded := make([]string, 0, len(dayRows)+len(entryDates))
	for _, dr := range dayRows {
		if dr.StateID != nil || strings.TrimSpace(dr.Diary) != "" {
			recorded = append(recorded, dr.Date)
		}
	}
	recorded = append(recorded, entryDates...)
	ok(w, map[string]any{"streak": domain.CountStreak(recorded, today), "today": today})
}

func queryParamInt(r *http.Request, name string, def int64) int64 {
	return parseIntQuery(r, name, def)
}

func mustAtoi(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	return n
}

func sprintfYear(year int, suffix string) string {
	// cheap zero-padded year prefix; suffix includes leading '-'
	return itoa(year) + suffix
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [12]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

func pad2(n int) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

// ---- export / import ----

func (d *Deps) exportData(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := d.q()
	userID := uid(r)
	setting, _ := d.getSettingOrCreate(r)
	subjects, err := q.ListSubjects(ctx, userID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	states, err := q.ListStates(ctx, userID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	days, err := q.ListAllDayRows(ctx, userID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	entries, err := q.ListAllEntries(ctx, userID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	goals, err := q.ListAllGoals(ctx, userID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	tasks, err := q.ListAllTasksForUser(ctx, userID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	checkins, err := q.ListAllCheckinsForUser(ctx, userID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	tasksByGoal := map[string][]db.GoalTask{}
	for _, t := range tasks {
		tasksByGoal[t.GoalID] = append(tasksByGoal[t.GoalID], t)
	}
	checkinsByGoal := map[string][]db.GoalCheckin{}
	for _, c := range checkins {
		checkinsByGoal[c.GoalID] = append(checkinsByGoal[c.GoalID], c)
	}
	type expDay struct {
		Date    string  `json:"date"`
		StateID *string `json:"stateId"`
		Diary   string  `json:"diary"`
	}
	type expEntry struct {
		ID          string `json:"id"`
		Date        string `json:"date"`
		SubjectID   string `json:"subjectId"`
		Title       string `json:"title"`
		Note        string `json:"note"`
		DurationMin int64  `json:"durationMin"`
		Source      string `json:"source"`
		Sort        int64  `json:"sort"`
		CreatedAt   int64  `json:"createdAt"`
		UpdatedAt   int64  `json:"updatedAt"`
	}
	type expTask struct {
		ID         string  `json:"id"`
		Title      string  `json:"title"`
		DueDate    *string `json:"dueDate"`
		WeekStart  *string `json:"weekStart"`
		DoneAt     *int64  `json:"doneAt"`
		Reflection string  `json:"reflection"`
		EntryID    *string `json:"entryId"`
		Sort       int64   `json:"sort"`
		CreatedAt  int64   `json:"createdAt"`
		UpdatedAt  int64   `json:"updatedAt"`
	}
	type expCheckin struct {
		ID        string  `json:"id"`
		Date      string  `json:"date"`
		Quantity  int64   `json:"quantity"`
		Note      string  `json:"note"`
		EntryID   *string `json:"entryId"`
		CreatedAt int64   `json:"createdAt"`
		UpdatedAt int64   `json:"updatedAt"`
	}
	type expGoal struct {
		ID          string       `json:"id"`
		Period      string       `json:"period"`
		Title       string       `json:"title"`
		Type        string       `json:"type"`
		TargetValue *int64       `json:"targetValue"`
		Unit        *string      `json:"unit"`
		SubjectID   *string      `json:"subjectId"`
		Color       *string      `json:"color"`
		Note        string       `json:"note"`
		Sort        int64        `json:"sort"`
		Status      string       `json:"status"`
		CarriedFrom *string      `json:"carriedFrom"`
		CreatedAt   int64        `json:"createdAt"`
		UpdatedAt   int64        `json:"updatedAt"`
		Tasks       []expTask    `json:"tasks"`
		Checkins    []expCheckin `json:"checkins"`
	}
	expDays := make([]expDay, 0, len(days))
	for _, dr := range days {
		expDays = append(expDays, expDay{Date: dr.Date, StateID: dr.StateID, Diary: dr.Diary})
	}
	expEntries := make([]expEntry, 0, len(entries))
	for _, e := range entries {
		expEntries = append(expEntries, expEntry{
			ID: e.ID, Date: e.Date, SubjectID: e.SubjectID, Title: e.Title, Note: e.Note,
			DurationMin: e.DurationMin, Source: e.Source, Sort: e.Sort,
			CreatedAt: e.CreatedAt, UpdatedAt: e.UpdatedAt,
		})
	}
	expGoals := make([]expGoal, 0, len(goals))
	for _, g := range goals {
		eg := expGoal{
			ID: g.ID, Period: g.Period, Title: g.Title, Type: g.Type,
			TargetValue: g.TargetValue, Unit: g.Unit, SubjectID: g.SubjectID,
			Color: g.Color, Note: g.Note, Sort: g.Sort, Status: g.Status,
			CarriedFrom: g.CarriedFrom, CreatedAt: g.CreatedAt, UpdatedAt: g.UpdatedAt,
			Tasks: []expTask{}, Checkins: []expCheckin{},
		}
		for _, t := range tasksByGoal[g.ID] {
			eg.Tasks = append(eg.Tasks, expTask{
				ID: t.ID, Title: t.Title, DueDate: t.DueDate, WeekStart: t.WeekStart,
				DoneAt: t.DoneAt, Reflection: t.Reflection, EntryID: t.EntryID,
				Sort: t.Sort, CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt,
			})
		}
		for _, c := range checkinsByGoal[g.ID] {
			eg.Checkins = append(eg.Checkins, expCheckin{
				ID: c.ID, Date: c.Date, Quantity: c.Quantity, Note: c.Note,
				EntryID: c.EntryID, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt,
			})
		}
		expGoals = append(expGoals, eg)
	}
	payload := map[string]any{
		"version": 3, "exportedAt": nowMs(),
		"settings": settingOut(setting),
		"subjects": subjects, "states": states,
		"days": expDays, "entries": expEntries, "goals": expGoals,
	}
	w.Header().Set("Content-Disposition", `attachment; filename="study-journey-export.json"`)
	// export is a file download, not an envelope-wrapped API response
	writeJSON(w, http.StatusOK, payload)
}

// ---- import ----

const maxImportBytes = 64 << 20

type importLearning struct {
	ID          string `json:"id"`
	Subject     string `json:"subject"`
	SubjectID   string `json:"subjectId"`
	DurationMin int64  `json:"durationMin"`
	Note        string `json:"note"`
	Color       string `json:"color"`
}

type importRecord struct {
	Date      string           `json:"date"`
	Mood      string           `json:"mood"`
	StateID   string           `json:"stateId"`
	Diary     string           `json:"diary"`
	Learnings []importLearning `json:"learnings"`
	Entries   []importLearning `json:"entries"`
}

type importCustomMood struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Color string `json:"color"`
	Solid string `json:"solid"`
}

type importSubject struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
	Sort  int64  `json:"sort"`
}

type importState struct {
	ID         string `json:"id"`
	BuiltinKey string `json:"builtinKey"`
	Label      string `json:"label"`
	Color      string `json:"color"`
	Polarity   int64  `json:"polarity"`
	Sort       int64  `json:"sort"`
}

type importDay struct {
	Date    string  `json:"date"`
	StateID *string `json:"stateId"`
	Diary   string  `json:"diary"`
}

type importEntry struct {
	ID          string `json:"id"`
	Date        string `json:"date"`
	SubjectID   string `json:"subjectId"`
	Title       string `json:"title"`
	Note        string `json:"note"`
	DurationMin int64  `json:"durationMin"`
	Source      string `json:"source"`
	Sort        int64  `json:"sort"`
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
}

type importTask struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	DueDate    *string `json:"dueDate"`
	WeekStart  *string `json:"weekStart"`
	Done       *bool   `json:"done"`
	DoneAt     *int64  `json:"doneAt"`
	Reflection string  `json:"reflection"`
	EntryID    *string `json:"entryId"`
	Sort       int64   `json:"sort"`
	CreatedAt  int64   `json:"createdAt"`
	UpdatedAt  int64   `json:"updatedAt"`
}

type importCheckin struct {
	ID        string  `json:"id"`
	Date      string  `json:"date"`
	Quantity  int64   `json:"quantity"`
	Note      string  `json:"note"`
	EntryID   *string `json:"entryId"`
	CreatedAt int64   `json:"createdAt"`
	UpdatedAt int64   `json:"updatedAt"`
}

type importGoal struct {
	ID          string          `json:"id"`
	Period      string          `json:"period"`
	Title       string          `json:"title"`
	Type        string          `json:"type"`
	TargetValue *int64          `json:"targetValue"`
	Unit        *string         `json:"unit"`
	SubjectID   *string         `json:"subjectId"`
	Color       *string         `json:"color"`
	Note        string          `json:"note"`
	Sort        int64           `json:"sort"`
	Status      string          `json:"status"`
	CarriedFrom *string         `json:"carriedFrom"`
	CreatedAt   int64           `json:"createdAt"`
	UpdatedAt   int64           `json:"updatedAt"`
	Tasks       []importTask    `json:"tasks"`
	Checkins    []importCheckin `json:"checkins"`
}

type importSetting struct {
	ExamName     *string `json:"examName"`
	ExamDate     *string `json:"examDate"`
	PhaseStart   *string `json:"phaseStart"`
	DailyGoalMin *int64  `json:"dailyGoalMin"`
	WeekStartsOn *int64  `json:"weekStartsOn"`
	FocusMin     *int64  `json:"focusMin"`
	BreakMin     *int64  `json:"breakMin"`
	Theme        *string `json:"theme"`
}

type importPayload struct {
	Version     *int               `json:"version"`
	Settings    *importSetting     `json:"settings"`
	Subjects    []importSubject    `json:"subjects"`
	States      []importState      `json:"states"`
	Days        []importDay        `json:"days"`
	Entries     []importEntry      `json:"entries"`
	Goals       []importGoal       `json:"goals"`
	Records     []importRecord     `json:"records"`
	CustomMoods []importCustomMood `json:"customMoods"`
}

type importStats struct {
	Days     int   `json:"days"`
	Entries  int   `json:"entries"`
	Minutes  int64 `json:"minutes"`
	Subjects int   `json:"subjects"`
	States   int   `json:"states"`
	Goals    int   `json:"goals"`
	Tasks    int   `json:"tasks"`
	Checkins int   `json:"checkins"`
}

func (d *Deps) importData(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxImportBytes))
	if err != nil {
		fail(w, http.StatusBadRequest, "BAD_REQUEST", "请求体过大或不可读")
		return
	}
	trimmed := strings.TrimSpace(string(body))
	ctx := r.Context()
	userID := uid(r)
	tx, err := d.DB.BeginTx(ctx, nil)
	if err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	defer tx.Rollback()
	q := d.q().WithTx(tx)
	now := nowMs()
	stats := importStats{}

	if strings.HasPrefix(trimmed, "[") {
		// v1: bare array of day records
		var records []importRecord
		if err := json.Unmarshal(body, &records); err != nil {
			fail(w, http.StatusBadRequest, "BAD_REQUEST", "v1 导入格式错误")
			return
		}
		if err := d.importRecords(ctx, q, userID, records, nil, now, &stats); err != nil {
			fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
			return
		}
	} else {
		var p importPayload
		if err := json.Unmarshal(body, &p); err != nil {
			fail(w, http.StatusBadRequest, "BAD_REQUEST", "导入格式错误")
			return
		}
		isV3 := p.Version != nil && *p.Version == 3
		if !isV3 && len(p.Records) == 0 && len(p.CustomMoods) == 0 {
			fail(w, http.StatusBadRequest, "BAD_REQUEST", "无法识别的导入格式（需要 version:3 / records / 数组）")
			return
		}
		// subject/state id maps: file id → db id
		subjectMap := map[string]string{}
		stateMap := map[string]string{}

		if isV3 {
			// settings
			if p.Settings != nil {
				if err := d.importSettings(ctx, q, userID, p.Settings, now); err != nil {
					fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
					return
				}
			}
			// subjects
			for _, s := range p.Subjects {
				name := strings.TrimSpace(s.Name)
				if name == "" {
					continue
				}
				color := s.Color
				if !validColor(color) {
					color = "#8D919A"
				}
				dbID, err := d.upsertSubjectByFile(ctx, q, userID, s, now, subjectMap)
				if err != nil {
					fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
					return
				}
				subjectMap[s.ID] = dbID
				stats.Subjects++
			}
			// states
			for _, s := range p.States {
				dbID, err := d.upsertStateByFile(ctx, q, userID, s, now, stateMap)
				if err != nil {
					fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
					return
				}
				stateMap[s.ID] = dbID
				stats.States++
			}
			// days
			for _, dd := range p.Days {
				if !domain.ValidateDate(dd.Date) {
					fail(w, http.StatusBadRequest, "IMPORT_FAILED", "day.date 非法: "+dd.Date)
					return
				}
				var sid *string
				if dd.StateID != nil && *dd.StateID != "" {
					if mapped, ok := stateMap[*dd.StateID]; ok {
						sid = &mapped
					} else if _, err := q.GetState(ctx, db.GetStateParams{ID: *dd.StateID, UserID: userID}); err == nil {
						v := *dd.StateID
						sid = &v
					}
				}
				stats.Days++
				stats.Minutes += 0
				if err := upsertDayRow(ctx, q, userID, dd.Date, sid, dd.Diary, now); err != nil {
					fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
					return
				}
			}
			// entries
			for _, e := range p.Entries {
				if !domain.ValidateDate(e.Date) || e.DurationMin < 1 {
					fail(w, http.StatusBadRequest, "IMPORT_FAILED", "entry 非法: "+e.ID)
					return
				}
				subjID := e.SubjectID
				if mapped, ok := subjectMap[e.SubjectID]; ok {
					subjID = mapped
				}
				if err := upsertEntryRow(ctx, q, userID, e, subjID, now); err != nil {
					fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
					return
				}
				stats.Entries++
				stats.Minutes += e.DurationMin
			}
			// goals (+tasks+checkins nested)
			goalIDMap := map[string]string{}
			for _, g := range p.Goals {
				gid, err := d.upsertGoalByFile(ctx, q, userID, g, now, subjectMap, stateMap, goalIDMap)
				if err != nil {
					fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
					return
				}
				goalIDMap[g.ID] = gid
				stats.Goals++
			}
			for _, g := range p.Goals {
				gid := goalIDMap[g.ID]
				for _, t := range g.Tasks {
					if err := d.upsertTaskByFile(ctx, q, userID, gid, t, now); err != nil {
						fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
						return
					}
					stats.Tasks++
				}
				for _, c := range g.Checkins {
					if err := d.upsertCheckinByFile(ctx, q, userID, gid, c, now); err != nil {
						fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
						return
					}
					stats.Checkins++
				}
			}
		} else {
			// v2: records + customMoods (+ optional goals in old shape)
			// 1) customMoods → states (builtin_key NULL, id preserved)
			for _, m := range p.CustomMoods {
				if m.ID == "" || strings.TrimSpace(m.Label) == "" {
					continue
				}
				color := m.Color
				if color == "" {
					color = m.Solid
				}
				if !validColor(color) {
					color = "#8D919A"
				}
				// id conflict → keep existing, map anyway
				if _, err := q.GetState(ctx, db.GetStateParams{ID: m.ID, UserID: userID}); err == nil {
					stateMap[m.ID] = m.ID
					continue
				}
				sort, _ := q.NextStateSort(ctx, userID)
				if err := q.CreateState(ctx, db.CreateStateParams{
					ID: m.ID, UserID: userID, Label: strings.TrimSpace(m.Label),
					Color: strings.ToUpper(color), Polarity: 0, Sort: sort,
					CreatedAt: now, UpdatedAt: now,
				}); err != nil {
					fail(w, http.StatusBadRequest, "IMPORT_FAILED", "customMood 创建失败: "+m.ID)
					return
				}
				stateMap[m.ID] = m.ID
				stats.States++
			}
			// 2) goals (old field names are a subset of importGoal)
			goalIDMap := map[string]string{}
			for _, g := range p.Goals {
				gid, err := d.upsertGoalByFile(ctx, q, userID, g, now, subjectMap, stateMap, goalIDMap)
				if err != nil {
					fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
					return
				}
				goalIDMap[g.ID] = gid
				stats.Goals++
			}
			for _, g := range p.Goals {
				gid := goalIDMap[g.ID]
				for _, t := range g.Tasks {
					if err := d.upsertTaskByFile(ctx, q, userID, gid, t, now); err != nil {
						fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
						return
					}
					stats.Tasks++
				}
				for _, c := range g.Checkins {
					if err := d.upsertCheckinByFile(ctx, q, userID, gid, c, now); err != nil {
						fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
						return
					}
					stats.Checkins++
				}
			}
			// 3) records → days + entries
			if err := d.importRecords(ctx, q, userID, p.Records, stateMap, now, &stats); err != nil {
				fail(w, http.StatusBadRequest, "IMPORT_FAILED", err.Error())
				return
			}
		}
	}
	if err := tx.Commit(); err != nil {
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	ok(w, map[string]any{"imported": true, "stats": stats})
}

// importRecords converts legacy/v2 day records into day + entry rows.
// mood resolves: builtin_key → that state; otherwise must be an existing
// state id (custom moods are imported before records) — unknown mood fails
// the whole batch, matching the legacy import validation.
func (d *Deps) importRecords(ctx context.Context, q *db.Queries, userID string,
	records []importRecord, stateMap map[string]string, now int64, stats *importStats) error {
	for _, rec := range records {
		if !domain.ValidateDate(rec.Date) {
			return errors.New("record.date 非法: " + rec.Date)
		}
		// resolve mood → state_id
		var stateID *string
		mood := rec.Mood
		if mood == "" {
			mood = rec.StateID
		}
		if mood != "" {
			resolved := ""
			// 1) builtin_key match
			if s, err := q.GetStateByBuiltinKey(ctx, db.GetStateByBuiltinKeyParams{
				UserID: userID, BuiltinKey: &mood,
			}); err == nil {
				resolved = s.ID
			} else if mapped, ok := stateMap[mood]; ok {
				resolved = mapped
			} else if _, err := q.GetState(ctx, db.GetStateParams{ID: mood, UserID: userID}); err == nil {
				resolved = mood
			} else {
				return errors.New("未知心情/状态: " + mood + "（日期 " + rec.Date + "）")
			}
			stateID = &resolved
		}
		stats.Days++
		if err := upsertDayRow(ctx, q, userID, rec.Date, stateID, rec.Diary, now); err != nil {
			return err
		}
		// learnings (v1/v2) or entries (tolerant) → entry rows
		items := rec.Learnings
		if len(items) == 0 {
			items = rec.Entries
		}
		for i, it := range items {
			dur := it.DurationMin
			if dur < 1 || dur > 1440 {
				continue
			}
			var subjID string
			if it.SubjectID != "" {
				if mapped, ok := subjectByIDOrName(ctx, q, userID, it.SubjectID, it.Subject, it.Color, now); ok {
					subjID = mapped
				}
			} else {
				if mapped, ok := subjectByIDOrName(ctx, q, userID, "", it.Subject, it.Color, now); ok {
					subjID = mapped
				}
			}
			if subjID == "" {
				return errors.New("条目缺少可用科目: " + rec.Date)
			}
			note := it.Note
			title := entryTitle("", note, subjName(ctx, q, userID, subjID))
			eid := it.ID
			if eid == "" {
				var err error
				eid, err = nid()
				if err != nil {
					return err
				}
			}
			if err := upsertEntryRow(ctx, q, userID, importEntry{
				ID: eid, Date: rec.Date, SubjectID: subjID, Title: title, Note: note,
				DurationMin: dur, Source: "import", Sort: int64(i),
				CreatedAt: now, UpdatedAt: now,
			}, subjID, now); err != nil {
				return err
			}
			stats.Entries++
			stats.Minutes += dur
		}
	}
	return nil
}
