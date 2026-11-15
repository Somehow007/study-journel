package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"journal/db/migrations"
	"journal/internal/auth"
	internaldb "journal/internal/db"
	"journal/internal/migrate"
)

func newTestEnv(t *testing.T) (*Deps, http.Handler) {
	t.Helper()
	sqlDB, err := internaldb.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	if err := migrate.Up(sqlDB, migrations.FS); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	deps := NewDeps(sqlDB, slog.New(slog.NewTextHandler(io.Discard, nil)), false)
	return deps, NewRouter(deps)
}

func doJSON(t *testing.T, h http.Handler, method, path, body, cookie string) *httptest.ResponseRecorder {
	t.Helper()
	var rdr io.Reader
	if body != "" {
		rdr = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, rdr)
	req.RemoteAddr = "198.51.100.7:12345"
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decodeEnvelope(t *testing.T, rec *httptest.ResponseRecorder) envelope {
	t.Helper()
	var env envelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("response not JSON envelope: %v body=%s", err, rec.Body.String())
	}
	return env
}

func sessionCookie(rec *httptest.ResponseRecorder) string {
	for _, c := range rec.Result().Cookies() {
		if c.Name == SessionCookieName {
			return c.Name + "=" + c.Value
		}
	}
	return ""
}

func TestHealth(t *testing.T) {
	_, h := newTestEnv(t)
	rec := doJSON(t, h, "GET", "/api/health", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	env := decodeEnvelope(t, rec)
	if env.Code != "0" {
		t.Fatalf("code = %q", env.Code)
	}
	data, _ := json.Marshal(env.Data)
	if !bytes.Contains(data, []byte(`"ok":true`)) {
		t.Fatalf("data = %s", data)
	}
}

func TestAuthFlow(t *testing.T) {
	deps, h := newTestEnv(t)
	ctx := context.Background()
	if _, err := auth.CreateUser(ctx, deps.DB, "alice", "s3cret-pass"); err != nil {
		t.Fatalf("create user: %v", err)
	}

	// 未登录访问受保护路由 → 401
	rec := doJSON(t, h, "GET", "/api/v1/auth/me", "", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("me without cookie status = %d", rec.Code)
	}

	// 错误密码 → 401
	rec = doJSON(t, h, "POST", "/api/v1/auth/login",
		`{"username":"alice","password":"nope"}`, "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("login wrong password status = %d", rec.Code)
	}

	// 正确登录 → 200 + Set-Cookie
	rec = doJSON(t, h, "POST", "/api/v1/auth/login",
		`{"username":"alice","password":"s3cret-pass"}`, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", rec.Code, rec.Body.String())
	}
	env := decodeEnvelope(t, rec)
	if env.Code != "0" {
		t.Fatalf("login code = %q", env.Code)
	}
	cookie := sessionCookie(rec)
	if cookie == "" {
		t.Fatal("login did not set sj_session cookie")
	}

	// 带 cookie 访问 me → 200
	rec = doJSON(t, h, "GET", "/api/v1/auth/me", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("me status = %d", rec.Code)
	}
	env = decodeEnvelope(t, rec)
	data, _ := json.Marshal(env.Data)
	if !bytes.Contains(data, []byte(`"username":"alice"`)) {
		t.Fatalf("me data = %s", data)
	}

	// 登出 → 再访问 me → 401
	rec = doJSON(t, h, "POST", "/api/v1/auth/logout", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("logout status = %d", rec.Code)
	}
	rec = doJSON(t, h, "GET", "/api/v1/auth/me", "", cookie)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("me after logout status = %d", rec.Code)
	}
}

func TestLoginRateLimit(t *testing.T) {
	_, h := newTestEnv(t)
	var last *httptest.ResponseRecorder
	for i := 0; i < 5; i++ {
		last = doJSON(t, h, "POST", "/api/v1/auth/login",
			`{"username":"ghost","password":"x"}`, "")
		if last.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d status = %d, want 401", i+1, last.Code)
		}
	}
	last = doJSON(t, h, "POST", "/api/v1/auth/login",
		`{"username":"ghost","password":"x"}`, "")
	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("6th attempt status = %d, want 429", last.Code)
	}
}

func TestUnknownRouteJSON(t *testing.T) {
	_, h := newTestEnv(t)
	rec := doJSON(t, h, "GET", "/api/v1/nope", "", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rec.Code)
	}
	if env := decodeEnvelope(t, rec); env.Code == "0" {
		t.Fatal("404 should not return success envelope")
	}
}
