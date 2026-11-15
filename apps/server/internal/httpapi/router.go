package httpapi

import (
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"journal/internal/auth"
)

// NewRouter builds the HTTP handler: public /api/health, public auth
// endpoints, and /api/v1/* behind the session middleware.
func NewRouter(d *Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RealIP)
	r.Use(requestLogger(d.Logger))
	r.Use(recoverer(d.Logger))

	r.NotFound(func(w http.ResponseWriter, _ *http.Request) {
		fail(w, http.StatusNotFound, "NOT_FOUND", "接口不存在")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, _ *http.Request) {
		fail(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "请求方法不允许")
	})

	r.Get("/api/health", d.health)

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/login", d.login)
		r.Post("/auth/logout", d.logout)
		r.With(requireAuth(d.DB)).Get("/auth/me", d.me)
	})

	return r
}

// NewDeps is a convenience for tests and main: wires a limiter if absent.
func NewDeps(db *sql.DB, logger *slog.Logger, cookieSecure bool) *Deps {
	return &Deps{
		DB:           db,
		Logger:       logger,
		CookieSecure: cookieSecure,
		LoginLimiter: auth.NewLoginRateLimiter(),
	}
}
