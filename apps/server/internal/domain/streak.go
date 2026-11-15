package domain

// CountStreak returns the consecutive recorded-day streak ending at today.
// Per docs/data-model.md §5: count back from today; when today has no record,
// the streak is counted from yesterday instead (an un-logged today does not
// break the streak). Returns 0 when neither today nor yesterday is recorded.
//
// recorded may be unordered and contain duplicates; entries that are not valid
// dates are ignored.
func CountStreak(recorded []string, today string) int {
	set := make(map[string]struct{}, len(recorded))
	for _, d := range recorded {
		if ValidateDate(d) {
			set[d] = struct{}{}
		}
	}
	if _, ok := set[today]; !ok {
		yesterday, err := AddDays(today, -1)
		if err != nil {
			return 0
		}
		if _, ok := set[yesterday]; !ok {
			return 0
		}
		today = yesterday
	}
	cursor := today
	streak := 0
	for {
		if _, ok := set[cursor]; !ok {
			return streak
		}
		streak++
		next, err := AddDays(cursor, -1)
		if err != nil {
			return streak
		}
		cursor = next
	}
}
