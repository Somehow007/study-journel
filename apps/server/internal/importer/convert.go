package importer

import (
	"fmt"
	"sort"
	"strings"

	"journal/internal/db"
	"journal/internal/domain"
	"journal/internal/id"
)

// Converted is the v3 row set produced from a Source snapshot, ready to be
// inserted in FK order: states → subjects → days → entries → goals → tasks →
// checkins. All rows belong to userID.
type Converted struct {
	States   []db.CreateStateParams
	Subjects []db.CreateSubjectParams
	Days     []db.CreateDayParams
	Entries  []db.CreateEntryParams
	Goals    []db.CreateGoalParams
	Tasks    []db.CreateTaskParams
	Checkins []db.CreateCheckinParams

	Warnings []string
	Skipped  map[string]int
}

func (c *Converted) warn(format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	for _, w := range c.Warnings {
		if w == msg {
			return
		}
	}
	if len(c.Warnings) < 50 {
		c.Warnings = append(c.Warnings, msg)
	}
}

func (c *Converted) skip(kind string) { c.Skipped[kind]++ }

type subjectAcc struct {
	id, name, color string
	sort            int64
	badColors       int
}

// Convert maps the sj_* snapshot to v3 rows (docs/data-model.md §6).
// builtinIDs is the builtin_key → state.id map returned by
// bootstrap.EnsureStates (must be called first so mood references resolve).
func Convert(src *Source, builtinIDs map[string]string, userID string, now int64) (*Converted, error) {
	c := &Converted{Skipped: map[string]int{}}

	// ---- 1. custom moods → states (id preserved, only solid → color) ----
	validMoodIDs := map[string]bool{}
	for i, m := range src.CustomMoods {
		label := strings.TrimSpace(m.Label)
		if label == "" {
			c.warn("自定义心情 %s 标签为空，已跳过", m.ID)
			c.skip("custom_mood_empty_label")
			continue
		}
		color := domain.NormalizeColor(m.Solid)
		if color == "" {
			color = "#8D919A"
			c.warn("自定义心情 %s 颜色非法 %q，使用默认色", m.ID, m.Solid)
		}
		created := m.CreatedAt
		if created <= 0 {
			created = now
		}
		c.States = append(c.States, db.CreateStateParams{
			ID: m.ID, UserID: userID, Label: label, Color: color,
			Polarity: 0, Sort: int64(i), CreatedAt: created, UpdatedAt: created,
		})
		validMoodIDs[m.ID] = true
	}

	// ---- 2. records → days; items → entries + subjects ----
	recByID := map[int64]*SjDayRecord{}
	validRec := map[int64]bool{}
	for i := range src.DayRecords {
		r := &src.DayRecords[i]
		if !domain.ValidateDate(r.Date) {
			c.warn("日记录 %d 日期非法 %q，整条跳过（含其条目）", r.ID, r.Date)
			c.skip("day_record_bad_date")
			continue
		}
		recByID[r.ID] = r
		validRec[r.ID] = true
	}

	// items ordered by (record date, item id) so the latest use wins subject color
	items := append([]SjLearningItem(nil), src.Items...)
	sort.SliceStable(items, func(i, j int) bool {
		ri, rj := recByID[items[i].RecordID], recByID[items[j].RecordID]
		di, dj := "", ""
		if ri != nil {
			di = ri.Date
		}
		if rj != nil {
			dj = rj.Date
		}
		if di != dj {
			return di < dj
		}
		return items[i].ID < items[j].ID
	})

	subjects := map[string]*subjectAcc{}
	var subjectList []*subjectAcc
	subjectName := func(raw string) string {
		name := strings.TrimSpace(raw)
		if name == "" {
			return "未命名"
		}
		return name
	}

	entryIDs := map[string]bool{}
	seenClientID := map[string]bool{}
	dayDates := map[string]bool{}

	// entries need subjects resolved first; do a pre-pass over items to build
	// subject rows, then emit entries in the same loop order below.
	type pendingEntry struct {
		it   SjLearningItem
		rec  *SjDayRecord
		subj *subjectAcc
	}
	var pending []pendingEntry

	for _, it := range items {
		rec := recByID[it.RecordID]
		if rec == nil || !validRec[it.RecordID] {
			c.skip("item_orphan_record")
			continue
		}
		if it.DurationMin < 1 || it.DurationMin > 1440 {
			c.warn("条目 %d（%s）时长非法 %d，已跳过", it.ID, rec.Date, it.DurationMin)
			c.skip("item_bad_duration")
			continue
		}
		name := subjectName(it.Subject)
		if strings.TrimSpace(it.Subject) == "" {
			c.skip("item_empty_subject")
		}
		acc := subjects[name]
		if acc == nil {
			acc = &subjectAcc{name: name, color: "#8D919A"}
			subjects[name] = acc
			subjectList = append(subjectList, acc)
		}
		if col := domain.NormalizeColor(it.Color); col != "" {
			acc.color = col // items are date-ordered: latest valid color wins
		} else {
			acc.badColors++
		}
		pending = append(pending, pendingEntry{it: it, rec: rec, subj: acc})
	}
	if n := c.Skipped["item_empty_subject"]; n > 0 {
		c.warn("%d 个条目科目为空，归入「未命名」", n)
	}

	// emit subjects (first-seen order) — need ids before entries
	for i, acc := range subjectList {
		acc.sort = int64(i)
		sid, err := id.New()
		if err != nil {
			return nil, err
		}
		acc.id = sid
		if acc.badColors > 0 {
			c.warn("科目「%s」有 %d 个条目颜色非法，取最近有效色", acc.name, acc.badColors)
		}
		c.Subjects = append(c.Subjects, db.CreateSubjectParams{
			ID: acc.id, UserID: userID, Name: acc.name, Color: acc.color,
			Sort: acc.sort, CreatedAt: now, UpdatedAt: now,
		})
	}

	for _, p := range pending {
		eid := p.it.ClientID
		if eid == "" {
			var err error
			eid, err = id.New()
			if err != nil {
				return nil, err
			}
			c.warn("条目 %d client_id 为空，已生成新 id（任务/打卡关联将丢失）", p.it.ID)
		}
		if seenClientID[eid] {
			return nil, fmt.Errorf("client_id 重复: %s（条目 %d）", eid, p.it.ID)
		}
		seenClientID[eid] = true
		entryIDs[eid] = true
		note := p.it.Note
		title := domain.EntryTitle("", note, p.subj.name)
		if title == "" {
			title = p.subj.name
		}
		c.Entries = append(c.Entries, db.CreateEntryParams{
			ID: eid, UserID: userID, Date: p.rec.Date, SubjectID: p.subj.id,
			Title: title, Note: note, DurationMin: p.it.DurationMin,
			Source: "import", Sort: p.it.SortOrder,
			CreatedAt: p.rec.CreatedAt, UpdatedAt: p.rec.UpdatedAt,
		})
	}

	// ---- 3. records → days ----
	for i := range src.DayRecords {
		r := &src.DayRecords[i]
		if !validRec[r.ID] {
			continue
		}
		if dayDates[r.Date] {
			c.warn("日期 %s 存在重复日记录，保留首条", r.Date)
			c.skip("day_record_dup_date")
			continue
		}
		dayDates[r.Date] = true
		var stateID *string
		if mood := strings.TrimSpace(r.Mood.String); mood != "" {
			if sid, ok := builtinIDs[mood]; ok {
				stateID = &sid
			} else if validMoodIDs[mood] {
				sid := mood // custom mood keeps its nanoid as state.id
				stateID = &sid
			} else {
				c.warn("日记录 %d（%s）心情 %q 无法解析，state 置空", r.ID, r.Date, mood)
				c.skip("day_mood_unresolved")
			}
		}
		diary := r.Diary.String
		c.Days = append(c.Days, db.CreateDayParams{
			UserID: userID, Date: r.Date, StateID: stateID, Diary: diary,
			CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		})
	}

	// ---- 4. goals → goal (+subject match by color) ----
	keptGoals := map[string]bool{}
	colorIndex := map[string][]*subjectAcc{}
	for _, acc := range subjectList {
		colorIndex[acc.color] = append(colorIndex[acc.color], acc)
	}

	for _, g := range src.Goals {
		period := g.Period
		if !domain.ValidatePeriod(period) {
			c.warn("目标 %s period 非法 %q，跳过（含其子任务/打卡）", g.ID, g.Period)
			c.skip("goal_bad_period")
			continue
		}
		title := strings.TrimSpace(g.Title)
		if title == "" {
			c.warn("目标 %s 标题为空，跳过", g.ID)
			c.skip("goal_empty_title")
			continue
		}
		goalType := strings.ToUpper(strings.TrimSpace(g.Type))
		if goalType != "COUNT" && goalType != "CHECKLIST" {
			c.warn("目标 %s type 非法 %q，跳过", g.ID, g.Type)
			c.skip("goal_bad_type")
			continue
		}
		var target *int64
		if goalType == "COUNT" {
			if g.TargetValue.Valid && g.TargetValue.Int64 > 0 {
				t := g.TargetValue.Int64
				target = &t
			} else {
				c.warn("COUNT 目标 %s target_value 缺失/非法，置空", g.ID)
			}
		}
		var unit *string
		if g.Unit.Valid && strings.TrimSpace(g.Unit.String) != "" {
			u := strings.TrimSpace(g.Unit.String)
			unit = &u
		}
		// color → subject match (exact normalized color; ties → lowest sort)
		var subjectID *string
		var color *string
		if col := domain.NormalizeColor(g.Color); col != "" {
			if cands := colorIndex[col]; len(cands) > 0 {
				sid := cands[0].id
				subjectID = &sid
			} else {
				color = &col
			}
		} else if strings.TrimSpace(g.Color) != "" {
			c.warn("目标 %s 颜色非法 %q，置空", g.ID, g.Color)
		}
		status := g.Status
		if status != "ARCHIVED" {
			if status != "ACTIVE" {
				c.warn("目标 %s status 非法 %q，按 ACTIVE 处理", g.ID, g.Status)
			}
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
		keptGoals[g.ID] = true
		c.Goals = append(c.Goals, db.CreateGoalParams{
			ID: g.ID, UserID: userID, Period: period, SubjectID: subjectID,
			Title: title, Type: goalType, TargetValue: target, Unit: unit,
			Color: color, Note: g.Note, Sort: g.SortOrder, Status: status,
			CreatedAt: created, UpdatedAt: updated,
		})
	}

	// ---- 5. tasks ----
	for _, t := range src.Tasks {
		if !keptGoals[t.GoalID] {
			c.skip("task_orphan_goal")
			continue
		}
		title := strings.TrimSpace(t.Title)
		if title == "" {
			c.warn("子任务 %s 标题为空，跳过", t.ID)
			c.skip("task_empty_title")
			continue
		}
		var dueDate, weekStart *string
		if t.DueDate.Valid && strings.TrimSpace(t.DueDate.String) != "" {
			if domain.ValidateDate(t.DueDate.String) {
				d := t.DueDate.String
				dueDate = &d
			} else {
				c.warn("子任务 %s due_date 非法 %q，置空", t.ID, t.DueDate.String)
			}
		}
		if t.WeekStart.Valid && strings.TrimSpace(t.WeekStart.String) != "" {
			if domain.ValidateDate(t.WeekStart.String) {
				w := t.WeekStart.String
				weekStart = &w
			} else {
				c.warn("子任务 %s week_start 非法 %q，置空", t.ID, t.WeekStart.String)
			}
		}
		if dueDate != nil && weekStart != nil {
			c.warn("子任务 %s due_date/week_start 同存，保留 due_date", t.ID)
			weekStart = nil
		}
		var doneAt *int64
		if t.Done == 1 {
			if t.DoneAt.Valid {
				d := t.DoneAt.Int64
				doneAt = &d
			} else {
				d := t.UpdatedAt
				doneAt = &d
			}
		}
		var entryID *string
		if t.LearningClientID.Valid && t.LearningClientID.String != "" {
			if entryIDs[t.LearningClientID.String] {
				e := t.LearningClientID.String
				entryID = &e
			} else {
				c.skip("task_entry_unresolved")
			}
		}
		reflection := ""
		if t.Reflection.Valid {
			reflection = t.Reflection.String
		}
		created := t.CreatedAt
		if created <= 0 {
			created = now
		}
		updated := t.UpdatedAt
		if updated <= 0 {
			updated = now
		}
		c.Tasks = append(c.Tasks, db.CreateTaskParams{
			ID: t.ID, GoalID: t.GoalID, Title: title, DueDate: dueDate,
			WeekStart: weekStart, DoneAt: doneAt, Reflection: reflection,
			EntryID: entryID, Sort: t.SortOrder, CreatedAt: created, UpdatedAt: updated,
		})
	}
	if n := c.Skipped["task_entry_unresolved"]; n > 0 {
		c.warn("%d 个子任务 learning_client_id 未匹配到条目，entry_id 置空", n)
	}

	// ---- 6. checkins ----
	for _, k := range src.Checkins {
		if !keptGoals[k.GoalID] {
			c.skip("checkin_orphan_goal")
			continue
		}
		if !domain.ValidateDate(k.Date) {
			c.warn("打卡 %s 日期非法 %q，跳过", k.ID, k.Date)
			c.skip("checkin_bad_date")
			continue
		}
		if k.Quantity < 1 {
			c.warn("打卡 %s quantity 非法 %d，跳过", k.ID, k.Quantity)
			c.skip("checkin_bad_quantity")
			continue
		}
		var entryID *string
		if k.LearningClientID.Valid && k.LearningClientID.String != "" {
			if entryIDs[k.LearningClientID.String] {
				e := k.LearningClientID.String
				entryID = &e
			} else {
				c.skip("checkin_entry_unresolved")
			}
		}
		created := k.CreatedAt
		if created <= 0 {
			created = now
		}
		updated := k.UpdatedAt
		if updated <= 0 {
			updated = now
		}
		c.Checkins = append(c.Checkins, db.CreateCheckinParams{
			ID: k.ID, GoalID: k.GoalID, Date: k.Date, Quantity: k.Quantity,
			Note: k.Note, EntryID: entryID, CreatedAt: created, UpdatedAt: updated,
		})
	}
	if n := c.Skipped["checkin_entry_unresolved"]; n > 0 {
		c.warn("%d 个打卡 learning_client_id 未匹配到条目，entry_id 置空", n)
	}

	return c, nil
}
