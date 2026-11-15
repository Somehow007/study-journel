package httpapi

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"journal/internal/auth"
)

// Deps carries the shared dependencies handlers need.
type Deps struct {
	DB           *sql.DB
	Logger       *slog.Logger
	CookieSecure bool
	LoginLimiter *auth.LoginRateLimiter
}

const maxBodyBytes = 8 << 10

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// userPublic is the user shape exposed to clients.
type userPublic struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

func (d *Deps) health(w http.ResponseWriter, _ *http.Request) {
	ok(w, map[string]any{"ok": true})
}

func (d *Deps) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		fail(w, http.StatusBadRequest, "BAD_REQUEST", "用户名和密码不能为空")
		return
	}

	ip := clientIP(r)
	if !d.LoginLimiter.Allow(ip) {
		fail(w, http.StatusTooManyRequests, "RATE_LIMITED", "尝试过于频繁，请 10 分钟后再试")
		return
	}

	user, err := auth.FindUserByUsername(r.Context(), d.DB, req.Username)
	if err != nil {
		d.Logger.Error("login lookup", "err", err)
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	// Verify against a real hash even for unknown users to keep timing uniform.
	hash := auth.DummyHash()
	if user != nil {
		hash = user.PasswordHash
	}
	if !auth.VerifyPassword(hash, req.Password) || user == nil {
		fail(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "用户名或密码错误")
		return
	}
	d.LoginLimiter.Reset(ip)

	token, expires, err := auth.CreateSession(r.Context(), d.DB, user.ID, r.UserAgent())
	if err != nil {
		d.Logger.Error("create session", "err", err)
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	setSessionCookie(w, token, expires, d.CookieSecure)
	ok(w, userPublic{ID: user.ID, Username: user.Username})
}

func (d *Deps) logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(SessionCookieName); err == nil && cookie.Value != "" {
		if err := auth.DeleteSession(r.Context(), d.DB, cookie.Value); err != nil {
			d.Logger.Error("delete session", "err", err)
		}
	}
	clearSessionCookie(w, d.CookieSecure)
	ok(w, map[string]any{"ok": true})
}

func (d *Deps) me(w http.ResponseWriter, r *http.Request) {
	p := principalFrom(r.Context())
	if p == nil {
		fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "未登录")
		return
	}
	ok(w, userPublic{ID: p.UserID, Username: p.Username})
}

func setSessionCookie(w http.ResponseWriter, token string, expires time.Time, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		MaxAge:   int(auth.SessionTTL.Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
	})
}

func clearSessionCookie(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Now().Add(-time.Hour),
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
	})
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
