package httpapi

import "journal/internal/db"

// ---- dictionary DTOs ----

type subjectDTO struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Color      string `json:"color"`
	Sort       int64  `json:"sort"`
	ArchivedAt *int64 `json:"archivedAt"`
	CreatedAt  int64  `json:"createdAt"`
	UpdatedAt  int64  `json:"updatedAt"`
}

func subjectOut(s db.Subject) subjectDTO {
	return subjectDTO{ID: s.ID, Name: s.Name, Color: s.Color, Sort: s.Sort,
		ArchivedAt: s.ArchivedAt, CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt}
}

type stateDTO struct {
	ID         string  `json:"id"`
	BuiltinKey *string `json:"builtinKey"`
	Label      string  `json:"label"`
	Color      string  `json:"color"`
	Polarity   int64   `json:"polarity"`
	Sort       int64   `json:"sort"`
	ArchivedAt *int64  `json:"archivedAt"`
	CreatedAt  int64   `json:"createdAt"`
	UpdatedAt  int64   `json:"updatedAt"`
}

func stateOut(s db.State) stateDTO {
	return stateDTO{ID: s.ID, BuiltinKey: s.BuiltinKey, Label: s.Label, Color: s.Color,
		Polarity: s.Polarity, Sort: s.Sort, ArchivedAt: s.ArchivedAt,
		CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt}
}

// ---- entries ----

type entryDTO struct {
	ID           string `json:"id"`
	Date         string `json:"date"`
	SubjectID    string `json:"subjectId"`
	SubjectName  string `json:"subjectName"`
	SubjectColor string `json:"subjectColor"`
	Title        string `json:"title"`
	Note         string `json:"note"`
	DurationMin  int64  `json:"durationMin"`
	Source       string `json:"source"`
	Sort         int64  `json:"sort"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}

func entryOut(id, date, subjectID, title, note, source, subjName, subjColor string,
	durMin, sort, createdAt, updatedAt int64) entryDTO {
	return entryDTO{ID: id, Date: date, SubjectID: subjectID, SubjectName: subjName,
		SubjectColor: subjColor, Title: title, Note: note, DurationMin: durMin,
		Source: source, Sort: sort, CreatedAt: createdAt, UpdatedAt: updatedAt}
}

func entryFromByDate(r db.ListEntriesByDateRow) entryDTO {
	return entryOut(r.ID, r.Date, r.SubjectID, r.Title, r.Note, r.Source,
		r.SubjectName, r.SubjectColor, r.DurationMin, r.Sort, r.CreatedAt, r.UpdatedAt)
}

func entryFromInRange(r db.ListEntriesInRangeRow) entryDTO {
	return entryOut(r.ID, r.Date, r.SubjectID, r.Title, r.Note, r.Source,
		r.SubjectName, r.SubjectColor, r.DurationMin, r.Sort, r.CreatedAt, r.UpdatedAt)
}

func entryFromAll(r db.ListAllEntriesRow) entryDTO {
	return entryOut(r.ID, r.Date, r.SubjectID, r.Title, r.Note, r.Source,
		r.SubjectName, r.SubjectColor, r.DurationMin, r.Sort, r.CreatedAt, r.UpdatedAt)
}

func entryFromGet(r db.GetEntryRow) entryDTO {
	return entryOut(r.ID, r.Date, r.SubjectID, r.Title, r.Note, r.Source,
		r.SubjectName, r.SubjectColor, r.DurationMin, r.Sort, r.CreatedAt, r.UpdatedAt)
}

func entryFromSearch(r db.SearchEntriesRow) entryDTO {
	return entryOut(r.ID, r.Date, r.SubjectID, r.Title, r.Note, r.Source,
		r.SubjectName, r.SubjectColor, r.DurationMin, r.Sort, r.CreatedAt, r.UpdatedAt)
}

// ---- tasks / checkins ----

type taskDTO struct {
	ID         string  `json:"id"`
	GoalID     string  `json:"goalId"`
	GoalTitle  string  `json:"goalTitle,omitempty"`
	Title      string  `json:"title"`
	DueDate    *string `json:"dueDate"`
	WeekStart  *string `json:"weekStart"`
	Done       bool    `json:"done"`
	DoneAt     *int64  `json:"doneAt"`
	Reflection string  `json:"reflection"`
	EntryID    *string `json:"entryId"`
	Sort       int64   `json:"sort"`
	CreatedAt  int64   `json:"createdAt"`
	UpdatedAt  int64   `json:"updatedAt"`
}

func taskOut(t db.GoalTask) taskDTO {
	return taskDTO{ID: t.ID, GoalID: t.GoalID, Title: t.Title, DueDate: t.DueDate,
		WeekStart: t.WeekStart, Done: t.DoneAt != nil, DoneAt: t.DoneAt,
		Reflection: t.Reflection, EntryID: t.EntryID, Sort: t.Sort,
		CreatedAt: t.CreatedAt, UpdatedAt: t.UpdatedAt}
}

type checkinDTO struct {
	ID        string  `json:"id"`
	GoalID    string  `json:"goalId"`
	GoalTitle string  `json:"goalTitle,omitempty"`
	Date      string  `json:"date"`
	Quantity  int64   `json:"quantity"`
	Note      string  `json:"note"`
	EntryID   *string `json:"entryId"`
	CreatedAt int64   `json:"createdAt"`
	UpdatedAt int64   `json:"updatedAt"`
}

func checkinOut(c db.GoalCheckin) checkinDTO {
	return checkinDTO{ID: c.ID, GoalID: c.GoalID, Date: c.Date, Quantity: c.Quantity,
		Note: c.Note, EntryID: c.EntryID, CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt}
}
