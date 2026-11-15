package auth

import (
	"sync"
	"time"
)

// LoginRateLimiter is an in-memory fixed-window limiter: at most maxAttempts
// login attempts per key (client IP) per window. Single-user app, so the map
// stays tiny; entries are pruned lazily on access.
type LoginRateLimiter struct {
	mu       sync.Mutex
	window   time.Duration
	max      int
	attempts map[string][]time.Time
}

func NewLoginRateLimiter() *LoginRateLimiter {
	return &LoginRateLimiter{
		window:   10 * time.Minute,
		max:      5,
		attempts: make(map[string][]time.Time),
	}
}

// Allow records an attempt for key and reports whether it is within the limit.
func (l *LoginRateLimiter) Allow(key string) bool {
	now := time.Now()
	cutoff := now.Add(-l.window)

	l.mu.Lock()
	defer l.mu.Unlock()

	kept := l.attempts[key][:0]
	for _, t := range l.attempts[key] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= l.max {
		l.attempts[key] = kept
		return false
	}
	l.attempts[key] = append(kept, now)
	return true
}

// Reset clears the attempt history for key after a successful login.
func (l *LoginRateLimiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, key)
}
