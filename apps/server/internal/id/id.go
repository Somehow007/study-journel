// Package id generates URL-safe nanoid-compatible identifiers (21 chars).
package id

import (
	"crypto/rand"
	"math/big"
)

const (
	length   = 21
	alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"
)

// New returns a random 21-character ID from the URL-safe alphabet, matching
// the format of the nanoid(21) IDs used by the legacy sj_* data.
func New() (string, error) {
	out := make([]byte, length)
	max := big.NewInt(int64(len(alphabet)))
	for i := range out {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		out[i] = alphabet[n.Int64()]
	}
	return string(out), nil
}
