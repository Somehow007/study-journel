package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// argon2id parameters (RFC 9106 first recommended profile).
const (
	argonTime    = 3
	argonMemory  = 64 * 1024 // KiB
	argonThreads = 4
	argonKeyLen  = 32
	saltLen      = 16
)

var b64 = base64.RawURLEncoding

// HashPassword returns a self-describing PHC-style argon2id hash:
//
//	$argon2id$v=19$m=65536,t=3,p=4$<salt>$<key>
func HashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads,
		b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// dummyHash lets login verify a real argon2id hash even when the username
// does not exist, keeping response time uniform against enumeration.
var dummyHash = mustHash("journal-dummy-password")

// DummyHash returns the throwaway hash used for unknown usernames.
func DummyHash() string { return dummyHash }

func mustHash(pw string) string {
	h, err := HashPassword(pw)
	if err != nil {
		panic(err)
	}
	return h
}

// VerifyPassword reports whether password matches the PHC hash. It returns
// false for malformed hashes instead of erroring.
func VerifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	// ["", "argon2id", "v=19", "m=...,t=...,p=...", salt, key]
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false
	}
	var memory, iterations, threads int
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &threads); err != nil {
		return false
	}
	salt, err := b64.DecodeString(parts[4])
	if err != nil {
		return false
	}
	want, err := b64.DecodeString(parts[5])
	if err != nil || len(want) == 0 {
		return false
	}
	key := argon2.IDKey([]byte(password), salt, uint32(iterations), uint32(memory), uint8(threads), uint32(len(want)))
	return subtle.ConstantTimeCompare(key, want) == 1
}
