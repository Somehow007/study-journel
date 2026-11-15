package domain

import "fmt"

// Percent mirrors legacy GoalProgress.percent: rounded, capped at 100,
// target<=0 → 0.
func Percent(actual, target int) int {
	if target <= 0 {
		return 0
	}
	p := int(float64(actual)*100/float64(target) + 0.5)
	if p > 100 {
		p = 100
	}
	if p < 0 {
		p = 0
	}
	return p
}

// SuggestedQuota mirrors legacy GoalProgress.suggestedQuota:
// remaining<=0 → 0; slots<=0 → remaining; else ceil(remaining/slots).
func SuggestedQuota(remaining, slots int) int {
	if remaining <= 0 {
		return 0
	}
	if slots <= 0 {
		return remaining
	}
	return (remaining + slots - 1) / slots
}

// Progress is the read-time computed goal progress (never persisted).
// Plan/suggestion fields are only meaningful for COUNT goals; for CHECKLIST
// they stay 0 and the API layer emits null (same as the legacy DTO).
type Progress struct {
	Actual    int  `json:"actual"`  // COUNT: Σ checkin quantity；CHECKLIST: done 任务数
	Total     int  `json:"total"`   // COUNT: targetValue；CHECKLIST: 任务总数
	Percent   int  `json:"percent"` // 0–100
	Reached   bool `json:"reached"`
	Remaining int  `json:"remaining"`

	RemainingDays   int `json:"remainingDays"`   // COUNT only
	RemainingWeeks  int `json:"remainingWeeks"`  // COUNT only
	PlannedDaily    int `json:"plannedDaily"`    // ceil(target / daysInMonth)
	PlannedWeekly   int `json:"plannedWeekly"`   // ceil(target / weeksIntersectingMonth)
	SuggestedDaily  int `json:"suggestedDaily"`  // ceil(remaining / remainingDays)
	SuggestedWeekly int `json:"suggestedWeekly"` // ceil(remaining / remainingWeeks)
}

// GoalProgressCount computes progress for a COUNT goal.
// actual = Σ checkin quantities in the period; asOf should already be clamped
// via AsOfForPeriod; weekStartsOn is setting.week_starts_on (1=Mon..7=Sun).
func GoalProgressCount(target, actual int, period, asOf string, weekStartsOn int) (Progress, error) {
	p := Progress{Actual: actual, Total: target}
	p.Percent = Percent(actual, target)
	p.Reached = target > 0 && actual >= target
	p.Remaining = target - actual
	if p.Remaining < 0 {
		p.Remaining = 0
	}

	days, err := DaysInMonth(period)
	if err != nil {
		return p, err
	}
	weeks, err := WeeksIntersecting(period, weekStartsOn)
	if err != nil {
		return p, err
	}
	p.RemainingDays, err = RemainingDays(asOf, period)
	if err != nil {
		return p, err
	}
	p.RemainingWeeks, err = RemainingWeeks(asOf, period, weekStartsOn)
	if err != nil {
		return p, err
	}

	weeksInMonth := len(weeks)
	if weeksInMonth < 1 {
		weeksInMonth = 1
	}
	p.PlannedDaily = SuggestedQuota(target, days)
	p.PlannedWeekly = SuggestedQuota(target, weeksInMonth)
	p.SuggestedDaily = SuggestedQuota(p.Remaining, p.RemainingDays)
	p.SuggestedWeekly = SuggestedQuota(p.Remaining, p.RemainingWeeks)
	return p, nil
}

// GoalProgressChecklist computes progress for a CHECKLIST goal.
// done/total are task counts; plan fields stay zero (API emits null).
func GoalProgressChecklist(done, total int) Progress {
	p := Progress{Actual: done, Total: total}
	p.Percent = Percent(done, total)
	p.Reached = total > 0 && done == total
	p.Remaining = total - done
	if p.Remaining < 0 {
		p.Remaining = 0
	}
	return p
}

// DatedValue is a (date → quantity) pair used by week/month aggregations.
type DatedValue struct {
	Date  string `json:"date"`
	Value int    `json:"value"`
}

// WeekProgress is one row of the per-week actual-vs-plan table (COUNT goals).
type WeekProgress struct {
	WeekStart string `json:"weekStart"`
	WeekEnd   string `json:"weekEnd"`
	Actual    int    `json:"actual"`
	Planned   int    `json:"planned"`
}

// BuildWeeks returns per-week actual (Σ quantities whose date falls inside
// the week) vs planned (targetValue spread evenly over weeksIntersecting).
// Mirrors legacy JournalGoalServiceImpl.buildWeeks.
func BuildWeeks(period string, targetValue int, items []DatedValue, weekStartsOn int) ([]WeekProgress, error) {
	weeks, err := WeeksIntersecting(period, weekStartsOn)
	if err != nil {
		return nil, err
	}
	planned := SuggestedQuota(targetValue, len(weeks))
	out := make([]WeekProgress, 0, len(weeks))
	for _, w := range weeks {
		actual := 0
		for _, it := range items {
			if it.Date >= w.Start && it.Date <= w.End {
				actual += it.Value
			}
		}
		out = append(out, WeekProgress{
			WeekStart: w.Start,
			WeekEnd:   w.End,
			Actual:    actual,
			Planned:   planned,
		})
	}
	return out, nil
}

// PreviewCountSplit is the create-goal dialog preview: days in month and the
// even daily/weekly quotas. Weekly uses WeeksIntersecting (same rule the
// server later applies as plannedWeekly) — the legacy frontend's ceil(days/7)
// was an approximation and is intentionally not preserved.
func PreviewCountSplit(target int, period string, weekStartsOn int) (days, plannedDaily, plannedWeekly int, err error) {
	if target < 1 {
		return 0, 0, 0, fmt.Errorf("target must be >= 1")
	}
	days, err = DaysInMonth(period)
	if err != nil {
		return 0, 0, 0, err
	}
	weeks, err := WeeksIntersecting(period, weekStartsOn)
	if err != nil {
		return 0, 0, 0, err
	}
	weeksInMonth := len(weeks)
	if weeksInMonth < 1 {
		weeksInMonth = 1
	}
	return days, SuggestedQuota(target, days), SuggestedQuota(target, weeksInMonth), nil
}
