// Package httpapi wires the chi router, JSON envelope, middleware and handlers.
package httpapi

import (
	"encoding/json"
	"net/http"
)

// envelope is the unified response shape: success {code:"0",data},
// failure {code:"<nonzero>",message} — same contract as the legacy
// mysite Result<T> the frontend already unwraps (docs/architecture.md §6).
type envelope struct {
	Code    string `json:"code"`
	Message string `json:"message,omitempty"`
	Data    any    `json:"data,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func ok(w http.ResponseWriter, data any) {
	writeJSON(w, http.StatusOK, envelope{Code: "0", Data: data})
}

func fail(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, envelope{Code: code, Message: message})
}
