package domain

import "sort"

// EntryFact is one study entry flattened with its subject for aggregation.
// The API layer builds these from joined sqlc rows.
type EntryFact struct {
	Date         string `json:"date"`
	SubjectID    string `json:"subjectId"`
	SubjectName  string `json:"subjectName"`
	SubjectColor string `json:"subjectColor"`
	DurationMin  int    `json:"durationMin"`
}

// DayTotal sums entry durations for one day (docs/data-model.md §5 dayTotal).
func DayTotal(durations []int) int {
	total := 0
	for _, d := range durations {
		total += d
	}
	return total
}

// SubjectTotal aggregates minutes/count per subject.
type SubjectTotal struct {
	SubjectID  string `json:"subjectId"`
	Name       string `json:"name"`
	Color      string `json:"color"`
	Minutes    int    `json:"minutes"`
	EntryCount int    `json:"entryCount"`
}

// SubjectBreakdown groups entries by subject, sorted by minutes desc
// (ties: name asc) for stable stats display.
func SubjectBreakdown(entries []EntryFact) []SubjectTotal {
	byID := make(map[string]*SubjectTotal)
	order := make([]string, 0)
	for _, e := range entries {
		t, ok := byID[e.SubjectID]
		if !ok {
			t = &SubjectTotal{SubjectID: e.SubjectID, Name: e.SubjectName, Color: e.SubjectColor}
			byID[e.SubjectID] = t
			order = append(order, e.SubjectID)
		}
		t.Minutes += e.DurationMin
		t.EntryCount++
	}
	out := make([]SubjectTotal, 0, len(order))
	for _, id := range order {
		out = append(out, *byID[id])
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Minutes != out[j].Minutes {
			return out[i].Minutes > out[j].Minutes
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// DaySeries is the per-date total used by month/year stats and heatmaps.
type DaySeries struct {
	Date       string `json:"date"`
	Minutes    int    `json:"minutes"`
	EntryCount int    `json:"entryCount"`
}

// DailySeries groups entries by date, sorted ascending. Days without entries
// are absent (callers fill gaps for charts).
func DailySeries(entries []EntryFact) []DaySeries {
	byDate := make(map[string]*DaySeries)
	order := make([]string, 0)
	for _, e := range entries {
		d, ok := byDate[e.Date]
		if !ok {
			d = &DaySeries{Date: e.Date}
			byDate[e.Date] = d
			order = append(order, e.Date)
		}
		d.Minutes += e.DurationMin
		d.EntryCount++
	}
	out := make([]DaySeries, 0, len(order))
	for _, date := range order {
		out = append(out, *byDate[date])
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Date < out[j].Date })
	return out
}

// StateMark pairs a recorded date with its resolved state display info.
type StateMark struct {
	StateID string `json:"stateId"`
	Label   string `json:"label"`
	Color   string `json:"color"`
}

// StateTotal counts recorded days per state.
type StateTotal struct {
	StateID string `json:"stateId"`
	Label   string `json:"label"`
	Color   string `json:"color"`
	Count   int    `json:"count"`
}

// StateBreakdown counts days per state (only days with a state_id), sorted by
// count desc then label. marks is one entry per recorded day that has a state.
func StateBreakdown(marks []StateMark) []StateTotal {
	byID := make(map[string]*StateTotal)
	order := make([]string, 0)
	for _, m := range marks {
		t, ok := byID[m.StateID]
		if !ok {
			t = &StateTotal{StateID: m.StateID, Label: m.Label, Color: m.Color}
			byID[m.StateID] = t
			order = append(order, m.StateID)
		}
		t.Count++
	}
	out := make([]StateTotal, 0, len(order))
	for _, id := range order {
		out = append(out, *byID[id])
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Label < out[j].Label
	})
	return out
}
