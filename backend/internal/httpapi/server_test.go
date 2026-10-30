package httpapi

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestHealth(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestServer().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK || rec.Body.String() != "{\"status\":\"ok\"}\n" {
		t.Errorf("got %d %q", rec.Code, rec.Body)
	}
}

func TestMethodNotAllowed(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestServer().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/calculate", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
	if got := rec.Header().Get("Allow"); got != http.MethodPost {
		t.Errorf("Allow = %q, want POST", got)
	}
	var body errorResponse
	decode(t, rec, &body)
	if body.Error.Code != "method_not_allowed" {
		t.Errorf("code = %q", body.Error.Code)
	}
}

func TestUnknownAPIRouteIsJSON404(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestServer().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/nope", nil))
	var body errorResponse
	decode(t, rec, &body)
	if rec.Code != http.StatusNotFound || body.Error.Code != "not_found" {
		t.Errorf("got %d %+v", rec.Code, body)
	}
}

func TestRecoverMiddleware(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	h := withRecover(logger, http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") }))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	var body errorResponse
	decode(t, rec, &body)
	if rec.Code != http.StatusInternalServerError || body.Error.Code != "internal_error" {
		t.Errorf("got %d %+v", rec.Code, body)
	}
}

func TestServesStaticFiles(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<h1>hi</h1>"), 0o644); err != nil {
		t.Fatal(err)
	}
	srv := NewServer(slog.New(slog.NewTextHandler(io.Discard, nil)), dir)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusOK || rec.Body.String() != "<h1>hi</h1>" {
		t.Errorf("got %d %q", rec.Code, rec.Body)
	}
}
