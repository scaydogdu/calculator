package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLoggingMatchesCommittedStatus(t *testing.T) {
	tests := []struct {
		name    string
		handler http.HandlerFunc
		want    int
	}{
		{"implicit OK", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok")); w.WriteHeader(500) }, 200},
		{"first final status", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(201); w.WriteHeader(500) }, 201},
		{"informational then final", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(103); w.WriteHeader(202) }, 202},
		{"panic after body", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("partial")); panic("boom") }, 200},
		{"panic before headers", func(http.ResponseWriter, *http.Request) { panic("boom") }, 500},
		{"invalid status before headers", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(42) }, 500},
		{"empty response", func(http.ResponseWriter, *http.Request) {}, 200},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var logs bytes.Buffer
			logger := slog.New(slog.NewJSONHandler(&logs, nil))
			server := httptest.NewServer(withLogging(logger, withRecover(logger, tt.handler)))
			defer server.Close()
			resp, err := server.Client().Get(server.URL)
			if err != nil {
				t.Fatal(err)
			}
			_, err = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			if err != nil {
				t.Fatal(err)
			}
			if resp.StatusCode != tt.want {
				t.Fatalf("HTTP status = %d, want %d", resp.StatusCode, tt.want)
			}
			decoder := json.NewDecoder(&logs)
			for {
				var entry struct {
					Msg    string `json:"msg"`
					Status int    `json:"status"`
				}
				if err := decoder.Decode(&entry); err != nil {
					t.Fatalf("missing request log: %v", err)
				}
				if entry.Msg == "request" {
					if entry.Status != tt.want {
						t.Errorf("logged status = %d, want %d", entry.Status, tt.want)
					}
					break
				}
			}
		})
	}
}
