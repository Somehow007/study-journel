package domain

import "testing"

func TestTaskRelevantOn(t *testing.T) {
	// weekStartsOn=1 (Monday). 2026-11-16 is a Monday.
	cases := []struct {
		name                     string
		done                     bool
		dueDate, weekStart, date string
		wso                      int
		want                     bool
	}{
		{"undone due today", false, "2026-11-18", "", "2026-11-18", 1, true},
		{"undone overdue", false, "2026-11-10", "", "2026-11-18", 1, true},
		{"undone future due", false, "2026-11-25", "", "2026-11-18", 1, false},
		{"undone in own week", false, "", "2026-11-16", "2026-11-19", 1, true},
		{"undone other week", false, "", "2026-11-09", "2026-11-19", 1, false},
		{"undone no schedule", false, "", "", "2026-11-19", 1, false},
		{"done on dueDate", true, "2026-11-10", "", "2026-11-10", 1, true},
		{"done not on dueDate", true, "2026-11-10", "", "2026-11-18", 1, false},
		{"done in week", true, "", "2026-11-16", "2026-11-19", 1, true},
		{"done week other", true, "", "2026-11-09", "2026-11-19", 1, false},
		{"sunday week wso=7", false, "", "2026-11-15", "2026-11-18", 7, true}, // week starting Sun 11-15
	}
	for _, c := range cases {
		got, err := TaskRelevantOn(c.done, c.dueDate, c.weekStart, c.date, c.wso)
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if got != c.want {
			t.Errorf("%s: got %v want %v", c.name, got, c.want)
		}
	}
}
