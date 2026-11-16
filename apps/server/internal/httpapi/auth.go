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

type changePasswordRequest struct {
	OldPassword string `json:"oldPassword"`
	NewPassword string `json:"newPassword"`
}

// changePassword verifies the old password, rewrites the argon2id hash, and
// drops every other session of the user (keeps the current one).
func (d *Deps) changePassword(w http.ResponseWriter, r *http.Request) {
	var req changePasswordRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "BAD_REQUEST", "请求体不是合法 JSON")
		return
	}
	if req.OldPassword == "" || req.NewPassword == "" {
		fail(w, http.StatusBadRequest, "VALIDATION", "新旧密码不能为空")
		return
	}
	if !d.LoginLimiter.Allow("pw:" + clientIP(r)) {
		fail(w, http.StatusTooManyRequests, "RATE_LIMITED", "尝试过于频繁，请 10 分钟后再试")
		return
	}
	p := principalFrom(r.Context())
	if p == nil {
		fail(w, http.StatusUnauthorized, "UNAUTHORIZED", "未登录")
		return
	}
	user, err := auth.FindUserByID(r.Context(), d.DB, p.UserID)
	if err != nil {
		d.Logger.Error("change password lookup", "err", err)
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	if user == nil || !auth.VerifyPassword(user.PasswordHash, req.OldPassword) {
		fail(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "原密码错误")
		return
	}
	newLen := len([]rune(req.NewPassword))
	if newLen < 8 || newLen > 128 {
		fail(w, http.StatusBadRequest, "VALIDATION", "新密码长度需在 8–128 位之间")
		return
	}
	if req.NewPassword == req.OldPassword {
		fail(w, http.StatusBadRequest, "VALIDATION", "新密码不能与旧密码相同")
		return
	}
	if err := auth.UpdateUserPassword(r.Context(), d.DB, user.ID, req.NewPassword); err != nil {
		d.Logger.Error("change password update", "err", err)
		fail(w, http.StatusInternalServerError, "INTERNAL", "服务器内部错误")
		return
	}
	keep := ""
	if cookie, err := r.Cookie(SessionCookieName); err == nil {
		keep = cookie.Value
	}
	if err := auth.DeleteOtherSessions(r.Context(), d.DB, user.ID, keep); err != nil {
		// 密码已改成功；会话清理失败不阻断响应，仅记日志
		d.Logger.Error("delete other sessions", "err", err)
	}
	d.LoginLimiter.Reset("pw:" + clientIP(r))
	ok(w, map[string]any{"ok": true})
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
