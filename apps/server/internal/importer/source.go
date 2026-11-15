package importer

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
)

// Source row types mirror the mysite MySQL sj_* tables
// (mysite docker/init/schema.sql §14–19). Only columns needed for the v3
// mapping are loaded; discarded legacy fields (emoji/ink/tint/dark_colors,
// task/checkin duration_min) are not selected.

type SjCustomMood struct {
	ID        string
	UserID    int64
	Label     string
	Solid     string
	CreatedAt int64
}

type SjDayRecord struct {
	ID        int64
	UserID    int64
	Date      string
	Mood      sql.NullString
	Diary     sql.NullString
	CreatedAt int64
	UpdatedAt int64
}

type SjLearningItem struct {
	ID          int64
	RecordID    int64
	ClientID    string
	Subject     string
	DurationMin int64
	Note        string
	Color       string
	SortOrder   int64
}

type SjGoal struct {
	ID          string
	UserID      int64
	Period      string
	Title       string
	Type        string
	TargetValue sql.NullInt64
	Unit        sql.NullString
	Color       string
	Note        string
	SortOrder   int64
	Status      string
	CreatedAt   int64
	UpdatedAt   int64
}

type SjGoalTask struct {
	ID               string
	GoalID           string
	Title            string
	DueDate          sql.NullString
	WeekStart        sql.NullString
	Done             int64
	DoneAt           sql.NullInt64
	Reflection       sql.NullString
	LearningClientID sql.NullString
	SortOrder        int64
	CreatedAt        int64
	UpdatedAt        int64
}

type SjGoalCheckin struct {
	ID               string
	GoalID           string
	Date             string
	Quantity         int64
	Note             string
	LearningClientID sql.NullString
	CreatedAt        int64
	UpdatedAt        int64
}

// Source is the full sj_* snapshot. All slices are sorted deterministically
// so conversion output is stable.
type Source struct {
	CustomMoods []SjCustomMood
	DayRecords  []SjDayRecord
	Items       []SjLearningItem
	Goals       []SjGoal
	Tasks       []SjGoalTask
	Checkins    []SjGoalCheckin
	// UserIDs lists the distinct sj user_id values seen on user-owned rows
	// (day_record / custom_mood / goal). >1 means -source-user-id is required.
	UserIDs []int64
}

// LoadSource reads all six sj_* tables. The connection must be read-only in
// practice; only SELECTs are issued.
func LoadSource(ctx context.Context, db *sql.DB) (*Source, error) {
	s := &Source{}
	var err error
	if s.CustomMoods, err = loadCustomMoods(ctx, db); err != nil {
		return nil, err
	}
	if s.DayRecords, err = loadDayRecords(ctx, db); err != nil {
		return nil, err
	}
	if s.Items, err = loadItems(ctx, db); err != nil {
		return nil, err
	}
	if s.Goals, err = loadGoals(ctx, db); err != nil {
		return nil, err
	}
	if s.Tasks, err = loadTasks(ctx, db); err != nil {
		return nil, err
	}
	if s.Checkins, err = loadCheckins(ctx, db); err != nil {
		return nil, err
	}
	seen := map[int64]bool{}
	for _, r := range s.DayRecords {
		seen[r.UserID] = true
	}
	for _, m := range s.CustomMoods {
		seen[m.UserID] = true
	}
	for _, g := range s.Goals {
		seen[g.UserID] = true
	}
	for id := range seen {
		s.UserIDs = append(s.UserIDs, id)
	}
	sort.Slice(s.UserIDs, func(i, j int) bool { return s.UserIDs[i] < s.UserIDs[j] })
	return s, nil
}

// FilterUser narrows the snapshot to one legacy user_id: day records and
// custom moods filter directly; items follow their record; tasks/checkins
// follow their goal. Returns false when the id has no rows at all.
func (s *Source) FilterUser(uid int64) bool {
	records := s.DayRecords[:0]
	recIDs := map[int64]bool{}
	for _, r := range s.DayRecords {
		if r.UserID == uid {
			records = append(records, r)
			recIDs[r.ID] = true
		}
	}
	s.DayRecords = records

	moods := s.CustomMoods[:0]
	for _, m := range s.CustomMoods {
		if m.UserID == uid {
			moods = append(moods, m)
		}
	}
	s.CustomMoods = moods

	goals := s.Goals[:0]
	goalIDs := map[string]bool{}
	for _, g := range s.Goals {
		if g.UserID == uid {
			goals = append(goals, g)
			goalIDs[g.ID] = true
		}
	}
	s.Goals = goals

	items := s.Items[:0]
	for _, it := range s.Items {
		if recIDs[it.RecordID] {
			items = append(items, it)
		}
	}
	s.Items = items

	tasks := s.Tasks[:0]
	for _, t := range s.Tasks {
		if goalIDs[t.GoalID] {
			tasks = append(tasks, t)
		}
	}
	s.Tasks = tasks

	checks := s.Checkins[:0]
	for _, c := range s.Checkins {
		if goalIDs[c.GoalID] {
			checks = append(checks, c)
		}
	}
	s.Checkins = checks

	return len(s.DayRecords)+len(s.CustomMoods)+len(s.Goals) > 0
}

func loadCustomMoods(ctx context.Context, db *sql.DB) ([]SjCustomMood, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, user_id, label, solid, created_at
		FROM sj_custom_mood ORDER BY created_at, id`)
	if err != nil {
		return nil, fmt.Errorf("sj_custom_mood: %w", err)
	}
	defer rows.Close()
	var out []SjCustomMood
	for rows.Next() {
		var m SjCustomMood
		if err := rows.Scan(&m.ID, &m.UserID, &m.Label, &m.Solid, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("sj_custom_mood scan: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func loadDayRecords(ctx context.Context, db *sql.DB) ([]SjDayRecord, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, user_id, `+"`date`"+`, mood, diary, created_at, updated_at
		FROM sj_day_record ORDER BY `+"`date`"+`, id`)
	if err != nil {
		return nil, fmt.Errorf("sj_day_record: %w", err)
	}
	defer rows.Close()
	var out []SjDayRecord
	for rows.Next() {
		var r SjDayRecord
		if err := rows.Scan(&r.ID, &r.UserID, &r.Date, &r.Mood, &r.Diary, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, fmt.Errorf("sj_day_record scan: %w", err)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func loadItems(ctx context.Context, db *sql.DB) ([]SjLearningItem, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, record_id, client_id, subject, duration_min, note, color, sort_order
		FROM sj_learning_item ORDER BY record_id, sort_order, id`)
	if err != nil {
		return nil, fmt.Errorf("sj_learning_item: %w", err)
	}
	defer rows.Close()
	var out []SjLearningItem
	for rows.Next() {
		var it SjLearningItem
		if err := rows.Scan(&it.ID, &it.RecordID, &it.ClientID, &it.Subject,
			&it.DurationMin, &it.Note, &it.Color, &it.SortOrder); err != nil {
			return nil, fmt.Errorf("sj_learning_item scan: %w", err)
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

func loadGoals(ctx context.Context, db *sql.DB) ([]SjGoal, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, user_id, period, title, type, target_value, unit,
		color, note, sort_order, status, created_at, updated_at
		FROM sj_goal ORDER BY period, sort_order, id`)
	if err != nil {
		return nil, fmt.Errorf("sj_goal: %w", err)
	}
	defer rows.Close()
	var out []SjGoal
	for rows.Next() {
		var g SjGoal
		if err := rows.Scan(&g.ID, &g.UserID, &g.Period, &g.Title, &g.Type,
			&g.TargetValue, &g.Unit, &g.Color, &g.Note, &g.SortOrder,
			&g.Status, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, fmt.Errorf("sj_goal scan: %w", err)
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func loadTasks(ctx context.Context, db *sql.DB) ([]SjGoalTask, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, goal_id, title, due_date, week_start, done,
		done_at, reflection, learning_client_id, sort_order, created_at, updated_at
		FROM sj_goal_task ORDER BY goal_id, sort_order, id`)
	if err != nil {
		return nil, fmt.Errorf("sj_goal_task: %w", err)
	}
	defer rows.Close()
	var out []SjGoalTask
	for rows.Next() {
		var t SjGoalTask
		if err := rows.Scan(&t.ID, &t.GoalID, &t.Title, &t.DueDate, &t.WeekStart,
			&t.Done, &t.DoneAt, &t.Reflection, &t.LearningClientID, &t.SortOrder,
			&t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("sj_goal_task scan: %w", err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func loadCheckins(ctx context.Context, db *sql.DB) ([]SjGoalCheckin, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, goal_id, `+"`date`"+`, quantity, note,
		learning_client_id, created_at, updated_at
		FROM sj_goal_checkin ORDER BY goal_id, `+"`date`"+`, id`)
	if err != nil {
		return nil, fmt.Errorf("sj_goal_checkin: %w", err)
	}
	defer rows.Close()
	var out []SjGoalCheckin
	for rows.Next() {
		var c SjGoalCheckin
		if err := rows.Scan(&c.ID, &c.GoalID, &c.Date, &c.Quantity, &c.Note,
			&c.LearningClientID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("sj_goal_checkin scan: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
