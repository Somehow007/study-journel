package importer

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"journal/db/migrations"
	"journal/internal/auth"
	internaldb "journal/internal/db"
	"journal/internal/migrate"
)

func ns(s string) sql.NullString { return sql.NullString{String: s, Valid: s != ""} }
func ni(n int64) sql.NullInt64   { return sql.NullInt64{Int64: n, Valid: true} }

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	sqlDB, err := internaldb.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	if err := migrate.Up(sqlDB, migrations.FS); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return sqlDB
}

func testUser(t *testing.T, sqlDB *sql.DB) string {
	t.Helper()
	u, err := auth.CreateUser(context.Background(), sqlDB, "mig", "pw-123456")
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	return u.ID
}

var builtinIDs = map[string]string{
	"inspired": "b-inspired", "happy": "b-happy", "calm": "b-calm",
	"tired": "b-tired", "anxious": "b-anxious", "sad": "b-sad",
}

// fixtureSource builds a snapshot exercising every mapping rule.
func fixtureSource() *Source {
	return &Source{
		CustomMoods: []SjCustomMood{
			{ID: "moodCustom1", UserID: 7, Label: "  番茄钟  ", Solid: "#a1b2c3", CreatedAt: 1000},
			{ID: "moodEmpty", UserID: 7, Label: "   ", Solid: "#000000", CreatedAt: 1001},
		},
		DayRecords: []SjDayRecord{
			{ID: 1, UserID: 7, Date: "2026-11-01", Mood: ns("happy"), Diary: ns("# 周一\n好"), CreatedAt: 100, UpdatedAt: 200},
			{ID: 2, UserID: 7, Date: "2026-11-02", Mood: ns("moodCustom1"), Diary: sql.NullString{}, CreatedAt: 300, UpdatedAt: 400},
			{ID: 3, UserID: 7, Date: "2026-11-03", Mood: ns("nonexistent"), Diary: ns(""), CreatedAt: 500, UpdatedAt: 600},
			{ID: 4, UserID: 7, Date: "bad-date", Mood: sql.NullString{}, Diary: ns("x"), CreatedAt: 700, UpdatedAt: 800},
		},
		Items: []SjLearningItem{
			// record 1: two subjects; 数学一 appears twice → latest color wins
			{ID: 11, RecordID: 1, ClientID: "itemA", Subject: " 数学一 ", DurationMin: 90, Note: "张宇18讲\n第3讲", Color: "#111111", SortOrder: 0},
			{ID: 12, RecordID: 1, ClientID: "itemB", Subject: "数学一", DurationMin: 30, Note: "错题", Color: "#222222", SortOrder: 1},
			{ID: 13, RecordID: 1, ClientID: "itemC", Subject: "英语", DurationMin: 45, Note: "", Color: "bad", SortOrder: 2},
			// record 2: synced-by-goal item (client_id == task id)
			{ID: 14, RecordID: 2, ClientID: "taskSync1", Subject: "政治", DurationMin: 60, Note: "肖1000", Color: "#333333", SortOrder: 0},
			// orphan record (id 99 doesn't exist) + bad duration + orphan via bad record 4
			{ID: 15, RecordID: 99, ClientID: "orphan", Subject: "x", DurationMin: 10, Note: "", Color: "#000000", SortOrder: 0},
			{ID: 16, RecordID: 1, ClientID: "badDur", Subject: "数学一", DurationMin: 0, Note: "", Color: "#000000", SortOrder: 3},
			{ID: 17, RecordID: 4, ClientID: "badRec", Subject: "数学一", DurationMin: 10, Note: "", Color: "#000000", SortOrder: 0},
		},
		Goals: []SjGoal{
			{ID: "goalCount", UserID: 7, Period: "2026-11", Title: "数学一 300 题", Type: "COUNT",
				TargetValue: ni(300), Unit: ns("题"), Color: "#222222", Note: "", SortOrder: 0,
				Status: "ACTIVE", CreatedAt: 1000, UpdatedAt: 1000},
			{ID: "goalList", UserID: 7, Period: "2026-11", Title: "英语作文", Type: "CHECKLIST",
				Color: "#abcdef", Note: "", SortOrder: 1, Status: "ARCHIVED",
				CreatedAt: 1000, UpdatedAt: 1000},
			{ID: "goalBad", UserID: 7, Period: "11月", Title: "坏 period", Type: "COUNT",
				TargetValue: ni(1), Color: "#000000", Note: "", SortOrder: 2,
				Status: "ACTIVE", CreatedAt: 1000, UpdatedAt: 1000},
		},
		Tasks: []SjGoalTask{
			// done task synced to item "taskSync1"? no — learning_client_id links by value
			{ID: "taskDone", GoalID: "goalList", Title: "写一篇", DueDate: ns("2026-11-05"),
				Done: 1, DoneAt: sql.NullInt64{}, Reflection: ns("还行"),
				LearningClientID: ns("taskSync1"), SortOrder: 0, CreatedAt: 1000, UpdatedAt: 2000},
			{ID: "taskBoth", GoalID: "goalList", Title: "双日期", DueDate: ns("2026-11-06"),
				WeekStart: ns("2026-11-02"), Done: 0, SortOrder: 1, CreatedAt: 1000, UpdatedAt: 1000},
			{ID: "taskOrphan", GoalID: "goalBad", Title: "孤儿", SortOrder: 0, CreatedAt: 1, UpdatedAt: 1},
		},
		Checkins: []SjGoalCheckin{
			{ID: "chk1", GoalID: "goalCount", Date: "2026-11-10", Quantity: 50,
				Note: "", LearningClientID: sql.NullString{}, CreatedAt: 1000, UpdatedAt: 1000},
			{ID: "chkBad", GoalID: "goalCount", Date: "2026-11-11", Quantity: 0,
				Note: "", CreatedAt: 1000, UpdatedAt: 1000},
		},
		UserIDs: []int64{7},
	}
}

func TestConvertMapping(t *testing.T) {
	src := fixtureSource()
	conv, err := Convert(src, builtinIDs, "u1", 99999)
	if err != nil {
		t.Fatalf("convert: %v", err)
	}

	// custom mood → 1 state (empty label skipped); id preserved
	if len(conv.States) != 1 || conv.States[0].ID != "moodCustom1" {
		t.Fatalf("states = %+v", conv.States)
	}
	if conv.States[0].Color != "#A1B2C3" || conv.States[0].Label != "番茄钟" {
		t.Fatalf("state fields = %+v", conv.States[0])
	}

	// subjects: 数学一/英语/政治, first-seen order; 数学一 latest valid color #222222
	if len(conv.Subjects) != 3 {
		t.Fatalf("subjects = %+v", conv.Subjects)
	}
	math := conv.Subjects[0]
	if math.Name != "数学一" || math.Color != "#222222" {
		t.Fatalf("math subject = %+v", math)
	}
	eng := conv.Subjects[1]
	if eng.Name != "英语" || eng.Color != "#8D919A" { // 'bad' color → default
		t.Fatalf("eng subject = %+v", eng)
	}

	// days: 3 valid records (bad-date skipped); moods resolved
	if len(conv.Days) != 3 {
		t.Fatalf("days = %+v", conv.Days)
	}
	if conv.Days[0].StateID == nil || *conv.Days[0].StateID != "b-happy" {
		t.Fatalf("day1 state = %+v", conv.Days[0].StateID)
	}
	if conv.Days[1].StateID == nil || *conv.Days[1].StateID != "moodCustom1" {
		t.Fatalf("day2 state = %+v", conv.Days[1].StateID)
	}
	if conv.Days[2].StateID != nil { // unresolved mood → NULL
		t.Fatalf("day3 state should be nil")
	}

	// entries: itemA/itemB/itemC/taskSync1 = 4 (orphan/badDur/badRec skipped)
	if len(conv.Entries) != 4 {
		t.Fatalf("entries = %d", len(conv.Entries))
	}
	eA := conv.Entries[0]
	if eA.Title != "张宇18讲" || eA.Note != "张宇18讲\n第3讲" || eA.Source != "import" {
		t.Fatalf("entryA = %+v", eA)
	}
	if eA.SubjectID != math.ID || eA.DurationMin != 90 {
		t.Fatalf("entryA subject/dur = %+v", eA)
	}
	eC := conv.Entries[2]
	if eC.Title != "英语" { // empty note → subject name
		t.Fatalf("entryC title = %q", eC.Title)
	}

	// goals: goalBad skipped (bad period) → 2 goals; taskOrphan skipped
	if len(conv.Goals) != 2 {
		t.Fatalf("goals = %+v", conv.Goals)
	}
	gCount := conv.Goals[0]
	if gCount.SubjectID == nil || *gCount.SubjectID != math.ID {
		t.Fatalf("goalCount should link math by color #222222, got %+v", gCount.SubjectID)
	}
	if gCount.Color != nil {
		t.Fatalf("matched goal should have color NULL")
	}
	if gCount.TargetValue == nil || *gCount.TargetValue != 300 || gCount.Unit == nil {
		t.Fatalf("goalCount target/unit = %+v", gCount)
	}
	gList := conv.Goals[1]
	if gList.Color == nil || *gList.Color != "#ABCDEF" { // no subject has this color → keep
		t.Fatalf("goalList color = %+v", gList.Color)
	}
	if gList.Status != "ARCHIVED" || gList.Type != "CHECKLIST" {
		t.Fatalf("goalList = %+v", gList)
	}

	// tasks: taskDone+taskBoth kept; done_at falls back to updated_at=2000
	if len(conv.Tasks) != 2 {
		t.Fatalf("tasks = %+v", conv.Tasks)
	}
	if conv.Tasks[0].DoneAt == nil || *conv.Tasks[0].DoneAt != 2000 {
		t.Fatalf("taskDone doneAt = %+v", conv.Tasks[0].DoneAt)
	}
	if conv.Tasks[0].EntryID == nil || *conv.Tasks[0].EntryID != "taskSync1" {
		t.Fatalf("taskDone entry link = %+v", conv.Tasks[0].EntryID)
	}
	if conv.Tasks[1].WeekStart != nil || conv.Tasks[1].DueDate == nil {
		t.Fatalf("taskBoth should keep due_date only")
	}

	// checkins: chkBad (quantity 0) skipped → 1
	if len(conv.Checkins) != 1 || conv.Checkins[0].ID != "chk1" {
		t.Fatalf("checkins = %+v", conv.Checkins)
	}
}

func TestApplyAndReconcile(t *testing.T) {
	sqlDB := testDB(t)
	uid := testUser(t, sqlDB)
	src := fixtureSource()

	conv, err := Apply(context.Background(), sqlDB, src, uid, false, "", nil)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	rep, err := Reconcile(context.Background(), sqlDB, src, uid, conv)
	if err != nil {
		t.Fatalf("reconcile: %v", err)
	}
	// raw old counts include skipped rows → diffs expected & explained by Skipped
	// (orphan_record=2: record 99 missing + record 4 bad-date)
	if rep.Skipped["item_orphan_record"] != 2 || rep.Skipped["item_bad_duration"] != 1 {
		t.Fatalf("skipped = %+v", rep.Skipped)
	}

	// spot-check via sqlc-backed raw queries
	var dayCount, stateCount, subjCount int64
	sqlDB.QueryRow(`SELECT COUNT(*) FROM day WHERE user_id=?`, uid).Scan(&dayCount)
	sqlDB.QueryRow(`SELECT COUNT(*) FROM state WHERE user_id=?`, uid).Scan(&stateCount)
	sqlDB.QueryRow(`SELECT COUNT(*) FROM subject WHERE user_id=?`, uid).Scan(&subjCount)
	if dayCount != 3 || stateCount != 7 || subjCount != 3 {
		t.Fatalf("counts day=%d state=%d subj=%d", dayCount, stateCount, subjCount)
	}

	// task entry link resolved
	var entryRef *string
	sqlDB.QueryRow(`SELECT entry_id FROM goal_task WHERE id='taskDone'`).Scan(&entryRef)
	if entryRef == nil || *entryRef != "taskSync1" {
		t.Fatalf("taskDone entry_id = %v", entryRef)
	}
}

func TestApplyRefusesNonEmpty(t *testing.T) {
	sqlDB := testDB(t)
	uid := testUser(t, sqlDB)
	src := fixtureSource()
	if _, err := Apply(context.Background(), sqlDB, src, uid, false, "", nil); err != nil {
		t.Fatalf("first apply: %v", err)
	}
	// second apply without force → refuse
	if _, err := Apply(context.Background(), sqlDB, src, uid, false, "", nil); err == nil {
		t.Fatal("expected non-empty refusal")
	}
	// with force → backup + wipe + reimport
	backup := filepath.Join(t.TempDir(), "pre.db")
	if _, err := Apply(context.Background(), sqlDB, src, uid, true, backup, nil); err != nil {
		t.Fatalf("force apply: %v", err)
	}
	var n int64
	sqlDB.QueryRow(`SELECT COUNT(*) FROM entry WHERE user_id=?`, uid).Scan(&n)
	if n != 4 {
		t.Fatalf("entries after reimport = %d", n)
	}
	// backup file is a valid sqlite with the pre-wipe data
	bak, err := sql.Open("sqlite", backup)
	if err != nil {
		t.Fatalf("open backup: %v", err)
	}
	defer bak.Close()
	var bn int64
	bak.QueryRow(`SELECT COUNT(*) FROM entry`).Scan(&bn)
	if bn != 4 {
		t.Fatalf("backup entries = %d", bn)
	}
}

func TestForceWipeScopesToUser(t *testing.T) {
	sqlDB := testDB(t)
	uid := testUser(t, sqlDB)
	other, err := auth.CreateUser(context.Background(), sqlDB, "other", "pw-123456")
	if err != nil {
		t.Fatalf("create other: %v", err)
	}
	// other user owns one business row; a -force reimport for uid must not touch it
	if _, err := sqlDB.Exec(
		`INSERT INTO subject (id,user_id,name,color,sort,created_at,updated_at)
		 VALUES ('sub-other', ?, 'other-科目', '#000000', 0, 1, 1)`, other.ID); err != nil {
		t.Fatalf("seed other: %v", err)
	}
	src := fixtureSource()
	if _, err := Apply(context.Background(), sqlDB, src, uid, false, "", nil); err != nil {
		t.Fatalf("first apply: %v", err)
	}
	if _, err := Apply(context.Background(), sqlDB, src, uid, true,
		filepath.Join(t.TempDir(), "pre.db"), nil); err != nil {
		t.Fatalf("force apply: %v", err)
	}
	var n int64
	sqlDB.QueryRow(`SELECT COUNT(*) FROM subject WHERE user_id=?`, other.ID).Scan(&n)
	if n != 1 {
		t.Fatalf("other user's subject was wiped: %d", n)
	}
}

func TestFilterUser(t *testing.T) {
	src := fixtureSource()
	// inject a second user's rows
	src.DayRecords = append(src.DayRecords, SjDayRecord{ID: 50, UserID: 9, Date: "2026-11-05"})
	src.CustomMoods = append(src.CustomMoods, SjCustomMood{ID: "m9", UserID: 9, Label: "x", Solid: "#111111"})
	src.Goals = append(src.Goals, SjGoal{ID: "g9", UserID: 9, Period: "2026-11", Title: "g9", Type: "COUNT", TargetValue: ni(1)})
	src.UserIDs = []int64{7, 9}

	if src.FilterUser(7) != true {
		t.Fatal("filter 7 should match")
	}
	if len(src.DayRecords) != 4 || len(src.CustomMoods) != 2 || len(src.Goals) != 3 {
		t.Fatalf("after filter: %d/%d/%d", len(src.DayRecords), len(src.CustomMoods), len(src.Goals))
	}
	// items of user 9's record 50 don't exist; goals/tasks filtered by goal
	src2 := fixtureSource()
	src2.DayRecords = append(src2.DayRecords, SjDayRecord{ID: 50, UserID: 9, Date: "2026-11-05"})
	src2.Items = append(src2.Items, SjLearningItem{ID: 60, RecordID: 50, ClientID: "u9item", Subject: "s", DurationMin: 5, Color: "#111111"})
	src2.FilterUser(7)
	for _, it := range src2.Items {
		if it.ClientID == "u9item" {
			t.Fatal("user9 item leaked")
		}
	}
}

func TestDryRunReport(t *testing.T) {
	src := fixtureSource()
	conv, err := Convert(src, builtinIDs, "u1", time.Now().UnixMilli())
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	rep := DryRunReport(src, conv)
	if !rep.OK { // dry-run OK reflects planned==raw only when nothing skipped;
		// fixture has skips → expect DIFF entries but report still renders
	}
	if len(rep.Metrics) != 9 {
		t.Fatalf("metrics = %d", len(rep.Metrics))
	}
	if rep.Planned["entries"] != 4 {
		t.Fatalf("planned entries = %d", rep.Planned["entries"])
	}
}
