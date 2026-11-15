// Package domain holds the journal's pure business calculations — the single
// authoritative implementation (docs/data-model.md §5, docs/architecture.md §2).
// The frontend mirrors the display-preview subset in src/lib/domain.ts and both
// sides are pinned by the shared testdata/domain-cases.json.
//
// Conventions: dates are "YYYY-MM-DD" strings (user's local calendar day, no
// timezone math); periods are "YYYY-MM"; all calendar math runs on UTC-midnight
// time.Time values so results never depend on the host timezone.
package domain

import (
	"fmt"
	"regexp"
	"time"
)

var (
	dateRE   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	periodRE = regexp.MustCompile(`^\d{4}-\d{2}$`)
)

const dateLayout = "2006-01-02"

// ValidateDate reports whether s is a well-formed, real calendar date.
func ValidateDate(s string) bool {
	if !dateRE.MatchString(s) {
		return false
	}
	_, err := time.Parse(dateLayout, s)
	return err == nil
}

// ValidatePeriod reports whether s is a well-formed "YYYY-MM" period.
func ValidatePeriod(s string) bool {
	if !periodRE.MatchString(s) {
		return false
	}
	_, err := time.Parse("2006-01", s)
	return err == nil
}

// ParseDate parses "YYYY-MM-DD" into a UTC-midnight time.Time.
func ParseDate(s string) (time.Time, error) {
	if !ValidateDate(s) {
		return time.Time{}, fmt.Errorf("invalid date %q, want YYYY-MM-DD", s)
	}
	return time.Parse(dateLayout, s)
}

// ParsePeriod parses "YYYY-MM" into (year, month).
func ParsePeriod(s string) (int, int, error) {
	if !ValidatePeriod(s) {
		return 0, 0, fmt.Errorf("invalid period %q, want YYYY-MM", s)
	}
	var y, m int
	if _, err := fmt.Sscanf(s, "%d-%d", &y, &m); err != nil {
		return 0, 0, err
	}
	return y, m, nil
}

func formatDate(t time.Time) string { return t.UTC().Format(dateLayout) }

// PeriodOf returns the "YYYY-MM" prefix of a date string.
func PeriodOf(date string) string {
	if len(date) >= 7 {
		return date[:7]
	}
	return date
}

// NextPeriod returns the period after p ("2026-12" → "2027-01").
func NextPeriod(p string) (string, error) {
	y, m, err := ParsePeriod(p)
	if err != nil {
		return "", err
	}
	t := time.Date(y, time.Month(m)+1, 1, 0, 0, 0, 0, time.UTC)
	return t.Format("2006-01"), nil
}

// AddDays returns the date n days after date (n may be negative).
func AddDays(date string, n int) (string, error) {
	t, err := ParseDate(date)
	if err != nil {
		return "", err
	}
	return formatDate(t.AddDate(0, 0, n)), nil
}

// DaysBetween returns whole days from→to (negative when to < from).
func DaysBetween(from, to string) (int, error) {
	a, err := ParseDate(from)
	if err != nil {
		return 0, err
	}
	b, err := ParseDate(to)
	if err != nil {
		return 0, err
	}
	return int(b.Sub(a).Hours() / 24), nil
}

// DateInPeriod mirrors the legacy startsWith check: "2026-11-15" in "2026-11".
func DateInPeriod(date, period string) bool {
	return len(date) >= 7 && date[:7] == period
}

// MonthBounds returns the first and last date of a period.
func MonthBounds(period string) (first, last string, err error) {
	y, m, err := ParsePeriod(period)
	if err != nil {
		return "", "", err
	}
	start := time.Date(y, time.Month(m), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, -1)
	return formatDate(start), formatDate(end), nil
}

// DaysInMonth returns the number of days in a period.
func DaysInMonth(period string) (int, error) {
	first, last, err := MonthBounds(period)
	if err != nil {
		return 0, err
	}
	a, _ := ParseDate(first)
	b, _ := ParseDate(last)
	return int(b.Sub(a).Hours()/24) + 1, nil
}

// isoWeekday maps Go's Weekday (Sun=0) to ISO numbering (Mon=1..Sun=7).
func isoWeekday(t time.Time) int {
	wd := int(t.Weekday())
	if wd == 0 {
		return 7
	}
	return wd
}

// WeekStartOf returns the start date of the week containing date, where
// weekStartsOn is ISO weekday 1=Monday..7=Sunday (setting.week_starts_on).
func WeekStartOf(date string, weekStartsOn int) (string, error) {
	if weekStartsOn < 1 || weekStartsOn > 7 {
		return "", fmt.Errorf("week_starts_on must be 1..7, got %d", weekStartsOn)
	}
	t, err := ParseDate(date)
	if err != nil {
		return "", err
	}
	back := (isoWeekday(t) - weekStartsOn + 7) % 7
	return formatDate(t.AddDate(0, 0, -back)), nil
}

// Week is a 7-day span [Start, Start+6].
type Week struct {
	Start string
	End   string
}

// WeeksIntersecting returns every week (per weekStartsOn) that intersects the
// period's month, in chronological order. Always at least one week.
func WeeksIntersecting(period string, weekStartsOn int) ([]Week, error) {
	first, last, err := MonthBounds(period)
	if err != nil {
		return nil, err
	}
	lastT, _ := ParseDate(last)
	ws, err := WeekStartOf(first, weekStartsOn)
	if err != nil {
		return nil, err
	}
	wsT, _ := ParseDate(ws)
	var out []Week
	for !wsT.After(lastT) {
		out = append(out, Week{Start: formatDate(wsT), End: formatDate(wsT.AddDate(0, 0, 6))})
		wsT = wsT.AddDate(0, 0, 7)
	}
	return out, nil
}

// AsOfForPeriod clamps today into the period: before month → day 1,
// after month → last day, inside → today.
func AsOfForPeriod(period, today string) (string, error) {
	first, last, err := MonthBounds(period)
	if err != nil {
		return "", err
	}
	if !ValidateDate(today) {
		return "", fmt.Errorf("invalid date %q", today)
	}
	switch {
	case today < first:
		return first, nil
	case today > last:
		return last, nil
	default:
		return today, nil
	}
}

// RemainingDays counts days from asOf through month end, inclusive.
// Returns 0 when asOf is past the month end; asOf before month start clamps to day 1.
func RemainingDays(asOf, period string) (int, error) {
	first, last, err := MonthBounds(period)
	if err != nil {
		return 0, err
	}
	if asOf > last {
		return 0, nil
	}
	from := asOf
	if from < first {
		from = first
	}
	a, err := ParseDate(from)
	if err != nil {
		return 0, err
	}
	b, err := ParseDate(last)
	if err != nil {
		return 0, err
	}
	return int(b.Sub(a).Hours()/24) + 1, nil
}

// RemainingWeeks counts distinct weeks (per weekStartsOn) touched by the
// remaining range [max(asOf, monthStart), monthEnd].
func RemainingWeeks(asOf, period string, weekStartsOn int) (int, error) {
	weeks, err := WeeksIntersecting(period, weekStartsOn)
	if err != nil {
		return 0, err
	}
	first, last, err := MonthBounds(period)
	if err != nil {
		return 0, err
	}
	from := asOf
	if from < first {
		from = first
	}
	if from > last {
		return 0, nil
	}
	count := 0
	for _, w := range weeks {
		// week [w.Start, w.End] intersects [from, last] iff w.Start <= last && w.End >= from
		if w.Start <= last && w.End >= from {
			count++
		}
	}
	return count, nil
}

// ShiftDateToPeriod moves a date into another period when it belongs to
// fromPeriod; the day-of-month is clamped to the target month's length.
// Dates outside fromPeriod (or empty) pass through unchanged.
func ShiftDateToPeriod(date, fromPeriod, toPeriod string) (string, error) {
	if date == "" {
		return "", nil
	}
	if !DateInPeriod(date, fromPeriod) {
		return date, nil
	}
	if !ValidatePeriod(toPeriod) {
		return "", fmt.Errorf("invalid period %q", toPeriod)
	}
	y, m, err := ParsePeriod(toPeriod)
	if err != nil {
		return "", err
	}
	day := 0
	if _, err := fmt.Sscanf(date[8:], "%d", &day); err != nil {
		return "", fmt.Errorf("invalid date %q", date)
	}
	// last day of target month
	lastT := time.Date(y, time.Month(m)+1, 0, 0, 0, 0, 0, time.UTC)
	if day > lastT.Day() {
		day = lastT.Day()
	}
	return fmt.Sprintf("%04d-%02d-%02d", y, m, day), nil
}

// Today returns the server's local calendar date (YYYY-MM-DD). The journal is
// single-user/self-hosted, so server-local == user-local in practice — same
// assumption the legacy Java backend made with LocalDate.now().
func Today() string {
	return time.Now().Format(dateLayout)
}
