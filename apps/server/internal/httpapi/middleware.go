package httpapi

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"journal/internal/auth"
)

// SessionCookieName is the cookie carrying the session token.
const SessionCookieName = "sj_session"

type ctxKey struct{}

// principal is the authenticated user attached to the request context.
type principal struct {
	UserID   string
	Username string
}

func principalFrom(ctx context.Context) *principal {
	p, _ := ctx.Value(ctxKey{}).(*principal)
	return p
}

// statusWriter captures the response status for request logging.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func requestLogger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
			defer func() {
				log.Info("request",
					"method", r.Method,
					"path", r.URL.Path,
					"status", sw.status,
					"dur_ms", time.Since(start).Milliseconds(),
					"remote", r.RemoteAddr,
				)
			}()
			next.ServeHTTP(sw, r)
		})
	}
}

func recoverer(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.Error("panic",
						"err", rec,
						"path", r.URL.Path,
						"stack", string(debug.Stack()),
					)
					fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// requireAuth resolves the sj_session cookie into a principal. Requests
// without a valid, unexpired session get 401.
func requireAuth(db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil || cookie.Value == "" {
				fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "未登录")
				return
			}
			su, err := auth.FindSession(r.Context(), db, cookie.Value)
			if err != nil {
				fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
				return
			}
			if su == nil {
				fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "登录已过期")
				return
			}
			ctx := context.WithValue(r.Context(), ctxKey{}, &principal{
				UserID:   su.UserID,
				Username: su.Username,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
