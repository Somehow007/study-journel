package auth

import "testing"

func TestHashVerifyRoundTrip(t *testing.T) {
	hash, err := HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !VerifyPassword(hash, "correct horse battery staple") {
		t.Fatal("VerifyPassword rejected correct password")
	}
	if VerifyPassword(hash, "wrong password") {
		t.Fatal("VerifyPassword accepted wrong password")
	}
}

func TestVerifyPasswordMalformed(t *testing.T) {
	for _, bad := range []string{"", "plaintext", "$argon2id$bad", "$bcrypt$abc"} {
		if VerifyPassword(bad, "x") {
			t.Fatalf("VerifyPassword(%q) = true, want false", bad)
		}
	}
}

func TestHashPasswordUniqueSalts(t *testing.T) {
	a, _ := HashPassword("same")
	b, _ := HashPassword("same")
	if a == b {
		t.Fatal("two hashes of same password are identical; salt not random")
	}
}
