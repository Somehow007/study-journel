package importer

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"

	"journal/internal/bootstrap"
)

// Stats is the aggregate snapshot used for old-vs-new reconciliation.
type Stats struct {
	Days       int64
	Entries    int64
	Minutes    int64
	Subjects   int64
	States     int64
	Goals      int64
	Tasks      int64
	Checkins   int64
	CheckinQty int64
	// DayMinutes maps YYYY-MM-DD → summed duration_min (entries only).
	DayMinutes map[string]int64
}

// MetricResult is one old-vs-new comparison line.
type MetricResult struct {
	Name string
	Old  int64
	New  int64
	OK   bool
}

// Report is the migration reconciliation output.
type Report struct {
	Metrics  []MetricResult
	DayDiffs []string
	Warnings []string
	Skipped  map[string]int
	Planned  map[string]int64 // converted row counts (dry-run / pre-write view)
	OK       bool
}

// SourceStats aggregates the legacy snapshot the same way the old system
// counted it: raw row counts and raw duration sums (skipped rows still count
// on the old side, so any drop surfaces as a diff).
func SourceStats(src *Source) Stats {
	st := Stats{DayMinutes: map[string]int64{}}
	recDate := map[int64]string{}
	for _, r := range src.DayRecords {
		st.Days++
		recDate[r.ID] = r.Date
	}
	for _, it := range src.Items {
		st.Entries++
		st.Minutes += it.DurationMin
		if d := recDate[it.RecordID]; d != "" {
			st.DayMinutes[d] += it.DurationMin
		}
	}
	names := map[string]bool{}
	for _, it := range src.Items {
		n := strings.TrimSpace(it.Subject)
		if n == "" {
			n = "未命名"
		}
		names[n] = true
	}
	st.Subjects = int64(len(names))
	st.States = int64(len(bootstrap.States)) // builtin states are always ensured
	for _, m := range src.CustomMoods {
		if strings.TrimSpace(m.Label) != "" {
			st.States++
		}
	}
	st.Goals = int64(len(src.Goals))
	st.Tasks = int64(len(src.Tasks))
	st.Checkins = int64(len(src.Checkins))
	for _, c := range src.Checkins {
		st.CheckinQty += c.Quantity
	}
	return st
}

// TargetStats reads the same aggregates back from the v3 database.
func TargetStats(ctx context.Context, target *sql.DB, userID string) (Stats, error) {
	st := Stats{DayMinutes: map[string]int64{}}
	queries := []struct {
		dst  *int64
		sql  string
		args []any
	}{
		{&st.Days, `SELECT COUNT(*) FROM day WHERE user_id = ?`, []any{userID}},
		{&st.Subjects, `SELECT COUNT(*) FROM subject WHERE user_id = ?`, []any{userID}},
		{&st.States, `SELECT COUNT(*) FROM state WHERE user_id = ?`, []any{userID}},
		{&st.Goals, `SELECT COUNT(*) FROM goal WHERE user_id = ?`, []any{userID}},
		{&st.Tasks, `SELECT COUNT(*) FROM goal_task t JOIN goal g ON t.goal_id = g.id WHERE g.user_id = ?`, []any{userID}},
		{&st.Checkins, `SELECT COUNT(*) FROM goal_checkin c JOIN goal g ON c.goal_id = g.id WHERE g.user_id = ?`, []any{userID}},
		{&st.CheckinQty, `SELECT COALESCE(SUM(c.quantity),0) FROM goal_checkin c JOIN goal g ON c.goal_id = g.id WHERE g.user_id = ?`, []any{userID}},
	}
	for _, q := range queries {
		if err := target.QueryRowContext(ctx, q.sql, q.args...).Scan(q.dst); err != nil {
			return st, fmt.Errorf("stats: %w", err)
		}
	}
	var entries, minutes int64
	if err := target.QueryRowContext(ctx,
		`SELECT COUNT(*), COALESCE(SUM(duration_min),0) FROM entry WHERE user_id = ?`,
		userID).Scan(&entries, &minutes); err != nil {
		return st, fmt.Errorf("stats entry: %w", err)
	}
	st.Entries, st.Minutes = entries, minutes
	rows, err := target.QueryContext(ctx,
		`SELECT date, COALESCE(SUM(duration_min),0) FROM entry WHERE user_id = ? GROUP BY date`, userID)
	if err != nil {
		return st, fmt.Errorf("stats day minutes: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var d string
		var m int64
		if err := rows.Scan(&d, &m); err != nil {
			return st, err
		}
		st.DayMinutes[d] = m
	}
	return st, rows.Err()
}

// Reconcile compares the legacy snapshot against the migrated database and
// returns the full report. OK is true only when every metric matches and no
// per-day minute differs.
func Reconcile(ctx context.Context, target *sql.DB, src *Source, userID string,
	conv *Converted) (*Report, error) {

	old := SourceStats(src)
	new, err := TargetStats(ctx, target, userID)
	if err != nil {
		return nil, err
	}

	rep := &Report{OK: true}
	if conv != nil {
		rep.Warnings = conv.Warnings
		rep.Skipped = conv.Skipped
		rep.Planned = map[string]int64{
			"states": int64(len(conv.States)), "subjects": int64(len(conv.Subjects)),
			"days": int64(len(conv.Days)), "entries": int64(len(conv.Entries)),
			"goals": int64(len(conv.Goals)), "tasks": int64(len(conv.Tasks)),
			"checkins": int64(len(conv.Checkins)),
		}
	}

	pairs := []struct {
		name string
		o, n int64
	}{
		{"days", old.Days, new.Days},
		{"entries", old.Entries, new.Entries},
		{"minutes", old.Minutes, new.Minutes},
		{"subjects", old.Subjects, new.Subjects},
		{"states", old.States, new.States},
		{"goals", old.Goals, new.Goals},
		{"tasks", old.Tasks, new.Tasks},
		{"checkins", old.Checkins, new.Checkins},
		{"checkin_quantity", old.CheckinQty, new.CheckinQty},
	}
	for _, p := range pairs {
		m := MetricResult{Name: p.name, Old: p.o, New: p.n, OK: p.o == p.n}
		if !m.OK {
			rep.OK = false
		}
		rep.Metrics = append(rep.Metrics, m)
	}

	// per-day minutes: union of dates, report every mismatch (capped)
	dates := map[string]bool{}
	for d := range old.DayMinutes {
		dates[d] = true
	}
	for d := range new.DayMinutes {
		dates[d] = true
	}
	var sorted []string
	for d := range dates {
		sorted = append(sorted, d)
	}
	sort.Strings(sorted)
	for _, d := range sorted {
		om, nm := old.DayMinutes[d], new.DayMinutes[d]
		if om != nm {
			rep.OK = false
			if len(rep.DayDiffs) < 30 {
				rep.DayDiffs = append(rep.DayDiffs,
					fmt.Sprintf("%s: old=%d new=%d", d, om, nm))
			}
		}
	}
	if len(rep.DayDiffs) == 30 {
		rep.DayDiffs = append(rep.DayDiffs, "…（更多日期差异已省略）")
	}
	return rep, nil
}

// DryRunReport builds a report without a database: old-side raw stats vs the
// planned (converted) row counts, so operators can preview drops before the
// real run. Per-day minutes and DB-side metrics are not comparable here.
func DryRunReport(src *Source, conv *Converted) *Report {
	old := SourceStats(src)
	rep := &Report{OK: true, Warnings: conv.Warnings, Skipped: conv.Skipped}
	rep.Planned = map[string]int64{
		"states": int64(len(conv.States)), "subjects": int64(len(conv.Subjects)),
		"days": int64(len(conv.Days)), "entries": int64(len(conv.Entries)),
		"goals": int64(len(conv.Goals)), "tasks": int64(len(conv.Tasks)),
		"checkins": int64(len(conv.Checkins)),
	}
	planned := Stats{
		Days: int64(len(conv.Days)), Entries: int64(len(conv.Entries)),
		Subjects: int64(len(conv.Subjects)), States: int64(len(bootstrap.States)) + int64(len(conv.States)),
		Goals: int64(len(conv.Goals)), Tasks: int64(len(conv.Tasks)),
		Checkins: int64(len(conv.Checkins)),
	}
	for _, e := range conv.Entries {
		planned.Minutes += e.DurationMin
	}
	for _, c := range conv.Checkins {
		planned.CheckinQty += c.Quantity
	}
	pairs := []struct {
		name string
		o, n int64
	}{
		{"days", old.Days, planned.Days},
		{"entries", old.Entries, planned.Entries},
		{"minutes", old.Minutes, planned.Minutes},
		{"subjects", old.Subjects, planned.Subjects},
		{"states", old.States, planned.States},
		{"goals", old.Goals, planned.Goals},
		{"tasks", old.Tasks, planned.Tasks},
		{"checkins", old.Checkins, planned.Checkins},
		{"checkin_quantity", old.CheckinQty, planned.CheckinQty},
	}
	for _, p := range pairs {
		m := MetricResult{Name: p.name, Old: p.o, New: p.n, OK: p.o == p.n}
		if !m.OK {
			rep.OK = false
		}
		rep.Metrics = append(rep.Metrics, m)
	}
	return rep
}

// Format renders the report for humans (stdout of cmd/import-mysite).
func (r *Report) Format() string {
	var b strings.Builder
	b.WriteString("== 对账报告 ==\n")
	for _, m := range r.Metrics {
		mark := "OK  "
		if !m.OK {
			mark = "DIFF"
		}
		fmt.Fprintf(&b, "  [%s] %-16s old=%d new=%d\n", mark, m.Name, m.Old, m.New)
	}
	if len(r.DayDiffs) > 0 {
		b.WriteString("逐日分钟差异:\n")
		for _, d := range r.DayDiffs {
			b.WriteString("  " + d + "\n")
		}
	}
	if len(r.Skipped) > 0 {
		keys := make([]string, 0, len(r.Skipped))
		for k := range r.Skipped {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		b.WriteString("跳过明细:\n")
		for _, k := range keys {
			fmt.Fprintf(&b, "  %s: %d\n", k, r.Skipped[k])
		}
	}
	if len(r.Warnings) > 0 {
		b.WriteString("告警:\n")
		for _, w := range r.Warnings {
			b.WriteString("  - " + w + "\n")
		}
	}
	if r.OK {
		b.WriteString("结论: 对账一致 ✓\n")
	} else {
		b.WriteString("结论: 存在差异 ✗（见上）\n")
	}
	return b.String()
}
