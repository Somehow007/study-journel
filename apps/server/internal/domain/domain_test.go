package domain

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"
)

// domainCasesPath locates the repo-root testdata/domain-cases.json shared with
// the frontend vitest suite (docs/architecture.md §2).
func domainCasesPath(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	// apps/server/internal/domain → repo root is four levels up.
	return filepath.Join(filepath.Dir(file), "..", "..", "..", "..", "testdata", "domain-cases.json")
}

type domainCase struct {
	Name  string          `json:"name"`
	Fn    string          `json:"fn"`
	Input json.RawMessage `json:"input"`
	Want  json.RawMessage `json:"want"`
}

type casesFile struct {
	Cases []domainCase `json:"cases"`
}

// jsonNorm marshals v through JSON so ints/floats/structs all compare in the
// same representation the want side decodes to.
func jsonNorm(t *testing.T, v any) any {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal result: %v", err)
	}
	var out any
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal normalized: %v", err)
	}
	return out
}

func jsonEqual(a, b any) bool {
	switch av := a.(type) {
	case float64:
		bv, ok := b.(float64)
		return ok && math.Abs(av-bv) < 1e-4
	case []any:
		bv, ok := b.([]any)
		if !ok || len(av) != len(bv) {
			return false
		}
		for i := range av {
			if !jsonEqual(av[i], bv[i]) {
				return false
			}
		}
		return true
	case map[string]any:
		bv, ok := b.(map[string]any)
		if !ok || len(av) != len(bv) {
			return false
		}
		for k, v := range av {
			w, ok := bv[k]
			if !ok || !jsonEqual(v, w) {
				return false
			}
		}
		return true
	default:
		return reflect.DeepEqual(a, b)
	}
}

func runDomainCase(t *testing.T, c domainCase) any {
	t.Helper()
	switch c.Fn {
	case "streak":
		var in struct {
			Dates []string `json:"dates"`
			Today string   `json:"today"`
		}
		decodeCaseInput(t, c, &in)
		return map[string]any{"days": CountStreak(in.Dates, in.Today)}

	case "dayTotal":
		var in struct {
			Durations []int `json:"durations"`
		}
		decodeCaseInput(t, c, &in)
		return map[string]any{"total": DayTotal(in.Durations)}

	case "percent":
		var in struct {
			Actual int `json:"actual"`
			Target int `json:"target"`
		}
		decodeCaseInput(t, c, &in)
		return map[string]any{"percent": Percent(in.Actual, in.Target)}

	case "suggestedQuota":
		var in struct {
			Remaining int `json:"remaining"`
			Slots     int `json:"slots"`
		}
		decodeCaseInput(t, c, &in)
		return map[string]any{"quota": SuggestedQuota(in.Remaining, in.Slots)}

	case "goalProgressCount":
		var in struct {
			Target       int    `json:"target"`
			Actual       int    `json:"actual"`
			Period       string `json:"period"`
			AsOf         string `json:"asOf"`
			WeekStartsOn int    `json:"weekStartsOn"`
		}
		decodeCaseInput(t, c, &in)
		p, err := GoalProgressCount(in.Target, in.Actual, in.Period, in.AsOf, in.WeekStartsOn)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		return p

	case "goalProgressChecklist":
		var in struct {
			Done  int `json:"done"`
			Total int `json:"total"`
		}
		decodeCaseInput(t, c, &in)
		p := GoalProgressChecklist(in.Done, in.Total)
		return map[string]any{
			"actual": p.Actual, "total": p.Total, "percent": p.Percent,
			"reached": p.Reached, "remaining": p.Remaining,
		}

	case "previewCountSplit":
		var in struct {
			Target       int    `json:"target"`
			Period       string `json:"period"`
			WeekStartsOn int    `json:"weekStartsOn"`
		}
		decodeCaseInput(t, c, &in)
		days, pd, pw, err := PreviewCountSplit(in.Target, in.Period, in.WeekStartsOn)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		return map[string]any{"days": days, "plannedDaily": pd, "plannedWeekly": pw}

	case "weeksIntersecting":
		var in struct {
			Period       string `json:"period"`
			WeekStartsOn int    `json:"weekStartsOn"`
		}
		decodeCaseInput(t, c, &in)
		weeks, err := WeeksIntersecting(in.Period, in.WeekStartsOn)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		out := make([]map[string]string, 0, len(weeks))
		for _, w := range weeks {
			out = append(out, map[string]string{"start": w.Start, "end": w.End})
		}
		return out

	case "weekStartOf":
		var in struct {
			Date         string `json:"date"`
			WeekStartsOn int    `json:"weekStartsOn"`
		}
		decodeCaseInput(t, c, &in)
		ws, err := WeekStartOf(in.Date, in.WeekStartsOn)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		return map[string]any{"weekStart": ws}

	case "buildWeeks":
		var in struct {
			Period       string       `json:"period"`
			Target       int          `json:"target"`
			WeekStartsOn int          `json:"weekStartsOn"`
			Items        []DatedValue `json:"items"`
		}
		decodeCaseInput(t, c, &in)
		weeks, err := BuildWeeks(in.Period, in.Target, in.Items, in.WeekStartsOn)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		return weeks

	case "remainingDays":
		var in struct {
			AsOf   string `json:"asOf"`
			Period string `json:"period"`
		}
		decodeCaseInput(t, c, &in)
		d, err := RemainingDays(in.AsOf, in.Period)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		return map[string]any{"days": d}

	case "remainingWeeks":
		var in struct {
			AsOf         string `json:"asOf"`
			Period       string `json:"period"`
			WeekStartsOn int    `json:"weekStartsOn"`
		}
		decodeCaseInput(t, c, &in)
		w, err := RemainingWeeks(in.AsOf, in.Period, in.WeekStartsOn)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		return map[string]any{"weeks": w}

	case "asOfForPeriod":
		var in struct {
			Period string `json:"period"`
			Today  string `json:"today"`
		}
		decodeCaseInput(t, c, &in)
		d, err := AsOfForPeriod(in.Period, in.Today)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		return d

	case "shiftDateToPeriod":
		var in struct {
			Date       string `json:"date"`
			FromPeriod string `json:"fromPeriod"`
			ToPeriod   string `json:"toPeriod"`
		}
		decodeCaseInput(t, c, &in)
		d, err := ShiftDateToPeriod(in.Date, in.FromPeriod, in.ToPeriod)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		return d

	case "examCountdown":
		var in struct {
			ExamDate string `json:"examDate"`
			Today    string `json:"today"`
		}
		decodeCaseInput(t, c, &in)
		d, err := ExamCountdown(in.ExamDate, in.Today)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		return map[string]any{"days": d}

	case "phaseFraction":
		var in struct {
			PhaseStart string `json:"phaseStart"`
			ExamDate   string `json:"examDate"`
			Today      string `json:"today"`
		}
		decodeCaseInput(t, c, &in)
		f, err := PhaseFraction(in.PhaseStart, in.ExamDate, in.Today)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		return map[string]any{"fraction": f}

	case "phaseTicks":
		var in struct {
			PhaseStart string `json:"phaseStart"`
			ExamDate   string `json:"examDate"`
			N          int    `json:"n"`
		}
		decodeCaseInput(t, c, &in)
		ticks, err := PhaseTicks(in.PhaseStart, in.ExamDate, in.N)
		if err != nil {
			t.Fatalf("%s: %v", c.Name, err)
		}
		if ticks == nil {
			return []string{}
		}
		return ticks

	case "subjectBreakdown":
		var in struct {
			Entries []EntryFact `json:"entries"`
		}
		decodeCaseInput(t, c, &in)
		return SubjectBreakdown(in.Entries)

	case "dailySeries":
		var in struct {
			Entries []EntryFact `json:"entries"`
		}
		decodeCaseInput(t, c, &in)
		return DailySeries(in.Entries)

	case "stateBreakdown":
		var in struct {
			Marks []StateMark `json:"marks"`
		}
		decodeCaseInput(t, c, &in)
		return StateBreakdown(in.Marks)

	default:
		t.Fatalf("unknown fn %q", c.Fn)
		return nil
	}
}

func decodeCaseInput(t *testing.T, c domainCase, v any) {
	t.Helper()
	if err := json.Unmarshal(c.Input, v); err != nil {
		t.Fatalf("%s: bad input: %v", c.Name, err)
	}
}

// runPossiblyBatch handles cases whose input is a JSON array: each element is
// an independent input and want must be an array of the same length.
func runPossiblyBatch(t *testing.T, c domainCase) any {
	t.Helper()
	trimmed := c.Input
	for len(trimmed) > 0 && (trimmed[0] == ' ' || trimmed[0] == '\n' || trimmed[0] == '\t') {
		trimmed = trimmed[1:]
	}
	if len(trimmed) == 0 || trimmed[0] != '[' {
		return runDomainCase(t, c)
	}
	var inputs []json.RawMessage
	if err := json.Unmarshal(c.Input, &inputs); err != nil {
		t.Fatalf("%s: bad batch input: %v", c.Name, err)
	}
	var wants []json.RawMessage
	if err := json.Unmarshal(c.Want, &wants); err != nil {
		t.Fatalf("%s: bad batch want: %v", c.Name, err)
	}
	if len(inputs) != len(wants) {
		t.Fatalf("%s: batch input/want length mismatch %d vs %d", c.Name, len(inputs), len(wants))
	}
	out := make([]any, 0, len(inputs))
	for _, raw := range inputs {
		sub := domainCase{Name: c.Name, Fn: c.Fn, Input: raw}
		out = append(out, jsonNorm(t, runDomainCase(t, sub)))
	}
	return out
}

func TestDomainCases(t *testing.T) {
	raw, err := os.ReadFile(domainCasesPath(t))
	if err != nil {
		t.Fatalf("read domain-cases.json: %v", err)
	}
	var file casesFile
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatalf("parse domain-cases.json: %v", err)
	}
	if len(file.Cases) == 0 {
		t.Fatal("domain-cases.json has no cases")
	}
	for _, c := range file.Cases {
		c := c
		t.Run(c.Name, func(t *testing.T) {
			got := jsonNorm(t, runPossiblyBatch(t, c))
			var want any
			if err := json.Unmarshal(c.Want, &want); err != nil {
				t.Fatalf("bad want JSON: %v", err)
			}
			if !jsonEqual(got, want) {
				gotJSON, _ := json.Marshal(got)
				wantJSON, _ := json.Marshal(want)
				t.Fatalf("mismatch\n got: %s\nwant: %s", gotJSON, wantJSON)
			}
		})
	}
}
