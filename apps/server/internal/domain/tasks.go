package domain

import "fmt"

// TaskRelevantOn reports whether a goal task should surface on the given
// calendar date — the server-side port of the legacy isTodayTask rule:
//
//	done:   visible only on its dueDate or inside its weekStart week
//	undone: visible on dueDate, when overdue (dueDate < date), or inside its
//	       weekStart week; a task with neither dueDate nor weekStart is never
//	       date-scoped (it only counts toward checklist totals)
//
// dueDate/weekStart are "" when NULL. weekStartsOn follows setting.week_starts_on.
func TaskRelevantOn(done bool, dueDate, weekStart, date string, weekStartsOn int) (bool, error) {
	if !ValidateDate(date) {
		return false, fmt.Errorf("invalid date %q", date)
	}
	ws, err := WeekStartOf(date, weekStartsOn)
	if err != nil {
		return false, err
	}
	if done {
		return date == dueDate || (weekStart != "" && ws == weekStart), nil
	}
	if date == dueDate {
		return true, nil
	}
	if dueDate != "" && dueDate < date {
		return true, nil
	}
	return weekStart != "" && ws == weekStart, nil
}
