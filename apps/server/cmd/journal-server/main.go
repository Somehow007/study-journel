// Command journal-server runs the study-journal HTTP API and migrations.
//
//	journal-server [-addr 127.0.0.1:8090] [-db journal.db]
//	journal-server create-user -username NAME [-password PW] [-db journal.db]
package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"golang.org/x/term"

	"journal/db/migrations"
	"journal/internal/auth"
	internaldb "journal/internal/db"
	"journal/internal/httpapi"
	"journal/internal/migrate"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	switch strings.ToLower(os.Getenv(key)) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "create-user" {
		os.Exit(runCreateUser(os.Args[2:]))
	}
	os.Exit(runServe(os.Args[1:]))
}

func openAndMigrate(dbPath string, log *slog.Logger) (*sql.DB, error) {
	sqlDB, err := internaldb.Open(dbPath)
	if err != nil {
		return nil, err
	}
	if err := migrate.Up(sqlDB, migrations.FS); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	log.Info("database ready", "path", dbPath)
	return sqlDB, nil
}

func runServe(args []string) int {
	fs := flag.NewFlagSet("journal-server", flag.ContinueOnError)
	addr := fs.String("addr", envOr("JOURNAL_ADDR", "127.0.0.1:8090"), "listen address")
	dbPath := fs.String("db", envOr("JOURNAL_DB", "journal.db"), "sqlite database path")
	cookieSecure := fs.Bool("cookie-secure", envBool("JOURNAL_COOKIE_SECURE", false),
		"set Secure flag on session cookie (enable behind HTTPS)")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	sqlDB, err := openAndMigrate(*dbPath, log)
	if err != nil {
		log.Error("startup failed", "err", err)
		return 1
	}
	defer sqlDB.Close()

	deps := httpapi.NewDeps(sqlDB, log, *cookieSecure)
	srv := &http.Server{
		Addr:              *addr,
		Handler:           httpapi.NewRouter(deps),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()
	log.Info("listening", "addr", *addr)

	select {
	case <-ctx.Done():
		log.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Error("shutdown", "err", err)
			return 1
		}
		return 0
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			log.Error("serve", "err", err)
			return 1
		}
		return 0
	}
}

func runCreateUser(args []string) int {
	fs := flag.NewFlagSet("create-user", flag.ContinueOnError)
	dbPath := fs.String("db", envOr("JOURNAL_DB", "journal.db"), "sqlite database path")
	username := fs.String("username", "", "login username (required)")
	password := fs.String("password", "", "login password (prompted if empty)")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	name := strings.TrimSpace(*username)
	if name == "" {
		fmt.Fprintln(os.Stderr, "create-user: 需要 -username")
		return 2
	}
	pw := *password
	if pw == "" {
		var err error
		pw, err = promptPasswordTwice()
		if err != nil {
			fmt.Fprintf(os.Stderr, "create-user: 读取密码失败: %v\n", err)
			return 1
		}
	}
	if pw == "" {
		fmt.Fprintln(os.Stderr, "create-user: 密码不能为空")
		return 2
	}

	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	sqlDB, err := openAndMigrate(*dbPath, log)
	if err != nil {
		log.Error("startup failed", "err", err)
		return 1
	}
	defer sqlDB.Close()

	ctx := context.Background()
	existing, err := auth.FindUserByUsername(ctx, sqlDB, name)
	if err != nil {
		log.Error("lookup user", "err", err)
		return 1
	}
	if existing != nil {
		fmt.Fprintf(os.Stderr, "create-user: 用户名 %q 已存在\n", name)
		return 1
	}
	u, err := auth.CreateUser(ctx, sqlDB, name, pw)
	if err != nil {
		log.Error("create user", "err", err)
		return 1
	}
	fmt.Printf("已创建用户 %s (id=%s)\n", u.Username, u.ID)
	return 0
}

func promptPasswordTwice() (string, error) {
	read := func(prompt string) (string, error) {
		fmt.Fprint(os.Stderr, prompt)
		if term.IsTerminal(int(os.Stdin.Fd())) {
			b, err := term.ReadPassword(int(os.Stdin.Fd()))
			fmt.Fprintln(os.Stderr)
			return string(b), err
		}
		// 非终端（管道/CI）：退化为普通读取
		var line string
		_, err := fmt.Fscanln(os.Stdin, &line)
		return line, err
	}
	first, err := read("密码: ")
	if err != nil {
		return "", err
	}
	second, err := read("确认密码: ")
	if err != nil {
		return "", err
	}
	if first != second {
		return "", fmt.Errorf("两次输入不一致")
	}
	return first, nil
}
