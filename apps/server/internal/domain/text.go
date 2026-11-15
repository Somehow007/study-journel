package domain

import "strings"

// ValidColor reports whether s is a #RRGGBB hex color (either case).
func ValidColor(s string) bool {
	if len(s) != 7 || s[0] != '#' {
		return false
	}
	for _, c := range s[1:] {
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F') {
			return false
		}
	}
	return true
}

// NormalizeColor uppercases a valid #RRGGBB color; invalid input → "".
func NormalizeColor(s string) string {
	if !ValidColor(s) {
		return ""
	}
	return strings.ToUpper(s)
}

// EntryTitle derives an entry title: explicit > first line of note >
// subject name. The note itself is stored whole; display layers dedupe.
func EntryTitle(explicit, note, subjectName string) string {
	if t := strings.TrimSpace(explicit); t != "" {
		return t
	}
	if i := strings.IndexByte(note, '\n'); i >= 0 {
		if t := strings.TrimSpace(note[:i]); t != "" {
			return t
		}
		return strings.TrimSpace(subjectName)
	}
	if t := strings.TrimSpace(note); t != "" {
		return t
	}
	return strings.TrimSpace(subjectName)
}
