package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"journal/internal/db"
	"journal/internal/domain"
)

// upsertDayRow inserts or fully replaces a day row (import semantics).
func upsertDayRow(ctx context.Context, q *db.Queries, userID, date string,
	stateID *string, diary string, now int64) error {
	if _, err := q.GetDay(ctx, db.GetDayParams{UserID: userID, Date: date}); err == nil {
		return q.UpdateDay(ctx, db.UpdateDayParams{
			UserID: userID, Date: date, StateID: stateID, Diary: diary, UpdatedAt: now,
		})
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	return q.CreateDay(ctx, db.CreateDayParams{
		UserID: userID, Date: date, StateID: stateID, Diary: diary,
		CreatedAt: now, UpdatedAt: now,
	})
}

// upsertEntryRow inserts or replaces an entry by id (import semantics).
func upsertEntryRow(ctx context.Context, q *db.Queries, userID string,
	e importEntry, subjectID string, now int64) error {
	source := e.Source
	if !entrySources[source] {
		source = "import"
	}
	title := strings.TrimSpace(e.Title)
	if title == "" {
		title = subjName(ctx, q, userID, subjectID)
	}
	created := e.CreatedAt
	if created <= 0 {
		created = now
	}
	updated := e.UpdatedAt
	if updated <= 0 {
		updated = now
	}
	if _, err := q.GetEntry(ctx, db.GetEntryParams{ID: e.ID, UserID: userID}); err == nil {
		return q.UpdateEntry(ctx, db.UpdateEntryParams{
			ID: e.ID, UserID: userID, Date: e.Date, SubjectID: subjectID,
			Title: title, Note: e.Note, DurationMin: e.DurationMin,
			Source: source, Sort: e.Sort, UpdatedAt: updated,
		})
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	return q.CreateEntry(ctx, db.CreateEntryParams{
		ID: e.ID, UserID: userID, Date: e.Date, SubjectID: subjectID,
		Title: title, Note: e.Note, DurationMin: e.DurationMin,
		Source: source, Sort: e.Sort, CreatedAt: created, UpdatedAt: updated,
	})
}

// subjectByIDOrName resolves an entry's subject: explicit id first, then
// get-or-create by trimmed name (legacy import semantics). colorHint seeds
// the color only when the subject is created.
func subjectByIDOrName(ctx context.Context, q *db.Queries, userID, id, name,
	colorHint string, now int64) (string, bool) {
	if id != "" {
		if _, err := q.GetSubject(ctx, db.GetSubjectParams{ID: id, UserID: userID}); err == nil {
			return id, true
		}
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return "", false
	}
	if s, err := q.GetSubjectByName(ctx, db.GetSubjectByNameParams{UserID: userID, Name: name}); err == nil {
		return s.ID, true
	}
	color := "#8D919A"
	if validColor(colorHint) {
		color = strings.ToUpper(colorHint)
	}
	sort, _ := q.NextSubjectSort(ctx, userID)
	sid, err := nid()
	if err != nil {
		return "", false
	}
	if err := q.CreateSubject(ctx, db.CreateSubjectParams{
		ID: sid, UserID: userID, Name: name, Color: color, Sort: sort,
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		if s, err2 := q.GetSubjectByName(ctx, db.GetSubjectByNameParams{UserID: userID, Name: name}); err2 == nil {
			return s.ID, true
		}
		return "", false
	}
	return sid, true
}

func subjName(ctx context.Context, q *db.Queries, userID, subjectID string) string {
	if subjectID == "" {
		return ""
	}
	s, err := q.GetSubject(ctx, db.GetSubjectParams{ID: subjectID, UserID: userID})
	if err != nil {
		return ""
	}
	return s.Name
}

// ---- v3 dictionary upserts (file id → db id mapping) ----

func (d *Deps) upsertSubjectByFile(ctx context.Context, q *db.Queries, userID string,
	s importSubject, now int64, subjectMap map[string]string) (string, error) {
	// already mapped?
	if s.ID != "" {
		if dbID, ok := subjectMap[s.ID]; ok {
			return dbID, nil
		}
		if _, err := q.GetSubject(ctx, db.GetSubjectParams{ID: s.ID, UserID: userID}); err == nil {
			return s.ID, nil
		}
	}
	// UNIQUE(user_id,name) conflict → reuse existing row
	if existing, err := q.GetSubjectByName(ctx, db.GetSubjectByNameParams{
		UserID: userID, Name: strings.TrimSpace(s.Name),
	}); err == nil {
		return existing.ID, nil
	}
	color := s.Color
	if !validColor(color) {
		color = "#8D919A"
	}
	sort := s.Sort
	id := s.ID
	if id == "" {
		var err error
		id, err = nid()
		if err != nil {
			return "", err
		}
	}
	if err := q.CreateSubject(ctx, db.CreateSubjectParams{
		ID: id, UserID: userID, Name: strings.TrimSpace(s.Name),
		Color: strings.ToUpper(color), Sort: sort, CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		// PK collision with another user's row → retry with fresh id
		id2, err2 := nid()
		if err2 != nil {
			return "", err
		}
		if err3 := q.CreateSubject(ctx, db.CreateSubjectParams{
			ID: id2, UserID: userID, Name: strings.TrimSpace(s.Name),
			Color: strings.ToUpper(color), Sort: sort, CreatedAt: now, UpdatedAt: now,
		}); err3 != nil {
			return "", err3
		}
		id = id2
	}
	return id, nil
}

func (d *Deps) upsertStateByFile(ctx context.Context, q *db.Queries, userID string,
	s importState, now int64, stateMap map[string]string) (string, error) {
	if s.ID != "" {
		if dbID, ok := stateMap[s.ID]; ok {
			return dbID, nil
		}
		if _, err := q.GetState(ctx, db.GetStateParams{ID: s.ID, UserID: userID}); err == nil {
			return s.ID, nil
		}
	}
	// builtin_key is globally unique per user → map to the seeded row
	if s.BuiltinKey != "" {
		if existing, err := q.GetStateByBuiltinKey(ctx, db.GetStateByBuiltinKeyParams{
			UserID: userID, BuiltinKey: &s.BuiltinKey,
		}); err == nil {
			return existing.ID, nil
		}
	}
	label := strings.TrimSpace(s.Label)
	if label == "" {
		return "", errors.New("state.label 为空: " + s.ID)
	}
	color := s.Color
	if !validColor(color) {
		color = "#8D919A"
	}
	polarity := s.Polarity
	if polarity < -1 || polarity > 1 {
		polarity = 0
	}
	var builtinKey *string
	if s.BuiltinKey != "" {
		builtinKey = &s.BuiltinKey
	}
	id := s.ID
	if id == "" {
		var err error
		id, err = nid()
		if err != nil {
			return "", err
		}
	}
	sort := s.Sort
	create := func(sid string) error {
		return q.CreateState(ctx, db.CreateStateParams{
			ID: sid, UserID: userID, BuiltinKey: builtinKey, Label: label,
			Color: strings.ToUpper(color), Polarity: polarity, Sort: sort,
			CreatedAt: now, UpdatedAt: now,
		})
	}
	if err := create(id); err != nil {
		id2, err2 := nid()
		if err2 != nil {
			return "", err
		}
		if err3 := create(id2); err3 != nil {
			return "", err3
		}
		id = id2
	}
	return id, nil
}

func (d *Deps) importSettings(ctx context.Context, q *db.Queries, userID string,
	s *importSetting, now int64) error {
	cur, err := q.GetSetting(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		if err := q.CreateSetting(ctx, db.CreateSettingParams{
			UserID: userID, ExamName: "考研初试", DailyGoalMin: 360, WeekStartsOn: 1,
			FocusMin: 50, BreakMin: 10, Theme: "graphite", UpdatedAt: now,
		}); err != nil {
			return err
		}
		cur, err = q.GetSetting(ctx, userID)
	}
	if err != nil {
		return err
	}
	if s.ExamName != nil {
		cur.ExamName = *s.ExamName
	}
	if s.ExamDate != nil {
		cur.ExamDate = s.ExamDate
	}
	if s.PhaseStart != nil {
		cur.PhaseStart = s.PhaseStart
	}
	if s.DailyGoalMin != nil {
		cur.DailyGoalMin = *s.DailyGoalMin
	}
	if s.WeekStartsOn != nil {
		cur.WeekStartsOn = *s.WeekStartsOn
	}
	if s.FocusMin != nil {
		cur.FocusMin = *s.FocusMin
	}
	if s.BreakMin != nil {
		cur.BreakMin = *s.BreakMin
	}
	if s.Theme != nil {
		cur.Theme = *s.Theme
	}
	return q.UpdateSetting(ctx, db.UpdateSettingParams{
		UserID: userID, ExamName: cur.ExamName, ExamDate: cur.ExamDate,
		PhaseStart: cur.PhaseStart, DailyGoalMin: cur.DailyGoalMin,
		WeekStartsOn: cur.WeekStartsOn, FocusMin: cur.FocusMin, BreakMin: cur.BreakMin,
		Theme: cur.Theme, UpdatedAt: now,
	})
}

// remapSubject applies the file→db subject map; falls back to the raw id.
func remapSubject(subjectMap map[string]string, id *string) *string {
	if id == nil || *id == "" {
		return id
	}
	if mapped, ok := subjectMap[*id]; ok {
		return &mapped
	}
	return id
}

func (d *Deps) upsertGoalByFile(ctx context.Context, q *db.Queries, userID string,
	g importGoal, now int64, subjectMap, stateMap, goalIDMap map[string]string) (string, error) {
	if g.ID != "" {
		if mapped, ok := goalIDMap[g.ID]; ok {
			return mapped, nil
		}
	}
	period := g.Period
	if !domain.ValidatePeriod(period) {
		return "", errors.New("goal.period 非法: " + g.ID)
	}
	title := strings.TrimSpace(g.Title)
	if title == "" {
		return "", errors.New("goal.title 为空: " + g.ID)
	}
	goalType := strings.ToUpper(strings.TrimSpace(g.Type))
	if goalType != "COUNT" && goalType != "CHECKLIST" {
		return "", errors.New("goal.type 非法: " + g.ID)
	}
	var target *int64
	if goalType == "COUNT" && g.TargetValue != nil && *g.TargetValue > 0 {
		target = g.TargetValue
	}
	subjectID := remapSubject(subjectMap, g.SubjectID)
	if subjectID != nil {
		if _, err := q.GetSubject(ctx, db.GetSubjectParams{ID: *subjectID, UserID: userID}); err != nil {
			subjectID = nil
		}
	}
	var unit, color *string
	if g.Unit != nil && *g.Unit != "" {
		u := *g.Unit
		unit = &u
	}
	if g.Color != nil && validColor(*g.Color) {
		c := strings.ToUpper(*g.Color)
		color = &c
	}
	status := g.Status
	if status != "ARCHIVED" {
		status = "ACTIVE"
	}
	created := g.CreatedAt
	if created <= 0 {
		created = now
	}
	updated := g.UpdatedAt
	if updated <= 0 {
		updated = now
	}
	id := g.ID
	if id == "" {
		var err error
		id, err = nid()
		if err != nil {
			return "", err
		}
	}
	if _, err := q.GetGoal(ctx, db.GetGoalParams{ID: id, UserID: userID}); err == nil {
		if err := q.UpdateGoal(ctx, db.UpdateGoalParams{
			ID: id, UserID: userID, SubjectID: subjectID, Title: title,
			TargetValue: target, Unit: unit, Color: color, Note: g.Note,
			Sort: g.Sort, Status: status, UpdatedAt: updated,
		}); err != nil {
			return "", err
		}
		return id, nil
	}
	if g.CarriedFrom != nil {
		if mapped, ok := goalIDMap[*g.CarriedFrom]; ok {
			cf := mapped
			g.CarriedFrom = &cf
		} else {
			// carried_from may point outside this file → keep only if it exists
			if _, err := q.GetGoal(ctx, db.GetGoalParams{ID: *g.CarriedFrom, UserID: userID}); err != nil {
				g.CarriedFrom = nil
			}
		}
	}
	if err := q.CreateGoal(ctx, db.CreateGoalParams{
		ID: id, UserID: userID, Period: period, SubjectID: subjectID, Title: title,
		Type: goalType, TargetValue: target, Unit: unit, Color: color,
		Note: g.Note, Sort: g.Sort, Status: status, CarriedFrom: g.CarriedFrom,
		CreatedAt: created, UpdatedAt: updated,
	}); err != nil {
		id2, err2 := nid()
		if err2 != nil {
			return "", err
		}
		if err3 := q.CreateGoal(ctx, db.CreateGoalParams{
			ID: id2, UserID: userID, Period: period, SubjectID: subjectID, Title: title,
			Type: goalType, TargetValue: target, Unit: unit, Color: color,
			Note: g.Note, Sort: g.Sort, Status: status, CarriedFrom: g.CarriedFrom,
			CreatedAt: created, UpdatedAt: updated,
		}); err3 != nil {
			return "", err3
		}
		id = id2
	}
	return id, nil
}

func (d *Deps) upsertTaskByFile(ctx context.Context, q *db.Queries, userID, goalID string,
	t importTask, now int64) error {
	title := strings.TrimSpace(t.Title)
	if title == "" {
		return errors.New("task.title 为空: " + t.ID)
	}
	// doneAt: explicit, else done=true → createdAt/now
	var doneAt *int64
	if t.DoneAt != nil {
		doneAt = t.DoneAt
	} else if t.Done != nil && *t.Done {
		if t.CreatedAt > 0 {
			doneAt = &t.CreatedAt
		} else {
			doneAt = &now
		}
	}
	created := t.CreatedAt
	if created <= 0 {
		created = now
	}
	updated := t.UpdatedAt
	if updated <= 0 {
		updated = now
	}
	// entryId kept only when it resolves to a real entry of this user
	// (goal_task.entry_id has an FK; dangling refs would fail the import)
	var entryID *string
	if t.EntryID != nil && *t.EntryID != "" {
		if _, err := q.GetEntry(ctx, db.GetEntryParams{ID: *t.EntryID, UserID: userID}); err == nil {
			eid := *t.EntryID
			entryID = &eid
		}
	}
	id := t.ID
	if id == "" {
		var err error
		id, err = nid()
		if err != nil {
			return err
		}
	}
	// tasks have no user_id; ownership is via goalID (already user-scoped)
	if _, err := q.GetTask(ctx, db.GetTaskParams{ID: id, UserID: userID}); err == nil {
		return q.UpdateTask(ctx, db.UpdateTaskParams{
			ID: id, Title: title, DueDate: t.DueDate, WeekStart: t.WeekStart,
			DoneAt: doneAt, Reflection: t.Reflection, EntryID: entryID,
			Sort: t.Sort, UpdatedAt: updated,
		})
	}
	create := func(tid string) error {
		return q.CreateTask(ctx, db.CreateTaskParams{
			ID: tid, GoalID: goalID, Title: title, DueDate: t.DueDate,
			WeekStart: t.WeekStart, DoneAt: doneAt, Reflection: t.Reflection,
			EntryID: entryID, Sort: t.Sort, CreatedAt: created, UpdatedAt: updated,
		})
	}
	if err := create(id); err != nil {
		id2, err2 := nid()
		if err2 != nil {
			return err
		}
		if err3 := create(id2); err3 != nil {
			return err3
		}
	}
	return nil
}

func (d *Deps) upsertCheckinByFile(ctx context.Context, q *db.Queries, userID,
	goalID string, c importCheckin, now int64) error {
	if !domain.ValidateDate(c.Date) || c.Quantity < 1 {
		return errors.New("checkin 非法: " + c.ID)
	}
	created := c.CreatedAt
	if created <= 0 {
		created = now
	}
	updated := c.UpdatedAt
	if updated <= 0 {
		updated = now
	}
	var entryID *string
	if c.EntryID != nil && *c.EntryID != "" {
		if _, err := q.GetEntry(ctx, db.GetEntryParams{ID: *c.EntryID, UserID: userID}); err == nil {
			eid := *c.EntryID
			entryID = &eid
		}
	}
	cur, err := q.GetCheckin(ctx, db.GetCheckinParams{GoalID: goalID, Date: c.Date, UserID: userID})
	if err == nil {
		return q.UpdateCheckin(ctx, db.UpdateCheckinParams{
			Quantity: c.Quantity, Note: c.Note, EntryID: entryID,
			UpdatedAt: updated, ID: cur.ID,
		})
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	id := c.ID
	if id == "" {
		var err2 error
		id, err2 = nid()
		if err2 != nil {
			return err2
		}
	}
	return q.CreateCheckin(ctx, db.CreateCheckinParams{
		ID: id, GoalID: goalID, Date: c.Date, Quantity: c.Quantity, Note: c.Note,
		EntryID: entryID, CreatedAt: created, UpdatedAt: updated,
	})
}
