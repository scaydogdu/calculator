package httpapi

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSecurityHeadersOnStaticAndAPIResponses(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<!doctype html><h1>Calculator</h1>"), 0600); err != nil {
		t.Fatal(err)
	}
	server := NewServer(slog.New(slog.NewTextHandler(io.Discard, nil)), dir)
	for _, path := range []string{"/", "/healthz", "/missing.js", "/api/missing"} {
		t.Run(path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			server.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
			if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
				t.Errorf("nosniff = %q", got)
			}
			if got := rec.Header().Get("Referrer-Policy"); got != "strict-origin-when-cross-origin" {
				t.Errorf("referrer policy = %q", got)
			}
			policy := rec.Header().Get("Content-Security-Policy")
			for _, directive := range []string{"default-src 'self'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"} {
				if !strings.Contains(policy, directive) {
					t.Errorf("CSP missing %q: %q", directive, policy)
				}
			}
			if strings.Contains(policy, "unsafe-inline") || strings.Contains(policy, "unsafe-eval") {
				t.Errorf("unexpected unsafe CSP: %q", policy)
			}
		})
	}
}
