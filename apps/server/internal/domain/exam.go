package domain

import (
	"fmt"
	"math"
)

// ExamCountdown returns whole days from today until examDate (negative when
// the exam is in the past).
func ExamCountdown(examDate, today string) (int, error) {
	return DaysBetween(today, examDate)
}

// PhaseFraction returns exam progress in [0,1]: 0 before phaseStart, 1 at or
// after examDate, linear in between. Degenerate ranges (exam <= start) return
// 0 before exam and 1 from exam onward.
func PhaseFraction(phaseStart, examDate, today string) (float64, error) {
	if !ValidateDate(phaseStart) || !ValidateDate(examDate) || !ValidateDate(today) {
		return 0, fmt.Errorf("phase/exam/today must be YYYY-MM-DD")
	}
	total, err := DaysBetween(phaseStart, examDate)
	if err != nil {
		return 0, err
	}
	elapsed, err := DaysBetween(phaseStart, today)
	if err != nil {
		return 0, err
	}
	if total <= 0 {
		if elapsed >= 0 {
			return 1, nil
		}
		return 0, nil
	}
	frac := float64(elapsed) / float64(total)
	if frac < 0 {
		return 0, nil
	}
	if frac > 1 {
		return 1, nil
	}
	return frac, nil
}

// PhaseTicks returns n dates evenly spaced from phaseStart to examDate,
// inclusive of both endpoints (n>=2). n<=0 → nil; n==1 → [phaseStart].
// Used by timeline/ruler UIs that label tick positions.
func PhaseTicks(phaseStart, examDate string, n int) ([]string, error) {
	if n <= 0 {
		return nil, nil
	}
	if !ValidateDate(phaseStart) || !ValidateDate(examDate) {
		return nil, fmt.Errorf("phaseStart/examDate must be YYYY-MM-DD")
	}
	if n == 1 {
		return []string{phaseStart}, nil
	}
	total, err := DaysBetween(phaseStart, examDate)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, n)
	for i := 0; i < n; i++ {
		offset := int(math.Round(float64(i) * float64(total) / float64(n-1)))
		d, err := AddDays(phaseStart, offset)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, nil
}
