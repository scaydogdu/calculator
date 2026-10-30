package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestServer() http.Handler {
	return NewServer(slog.New(slog.NewTextHandler(io.Discard, nil)), "")
}

func TestCalculate(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantResult float64 // checked when wantStatus == 200
		wantCode   string  // checked otherwise
	}{
		{"add", `{"operation":"add","operands":[2,3]}`, 200, 5, ""},
		{"divide", `{"operation":"divide","operands":[7,2]}`, 200, 3.5, ""},
		{"sqrt", `{"operation":"sqrt","operands":[16]}`, 200, 4, ""},
		{"percentage", `{"operation":"percentage","operands":[15,200]}`, 200, 30, ""},
		{"division by zero", `{"operation":"divide","operands":[1,0]}`, 422, 0, "division_by_zero"},
		{"negative sqrt", `{"operation":"sqrt","operands":[-4]}`, 422, 0, "negative_sqrt"},
		{"overflow", `{"operation":"multiply","operands":[1e308,10]}`, 422, 0, "result_out_of_range"},
		{"unknown operation", `{"operation":"modulo","operands":[1,2]}`, 400, 0, "unknown_operation"},
		{"missing operation", `{"operands":[1,2]}`, 400, 0, "unknown_operation"},
		{"wrong arity", `{"operation":"add","operands":[1]}`, 400, 0, "invalid_operands"},
		{"missing operands", `{"operation":"add"}`, 400, 0, "invalid_operands"},
		{"malformed json", `{"operation":`, 400, 0, "invalid_json"},
		{"empty body", ``, 400, 0, "invalid_json"},
		{"string operand", `{"operation":"add","operands":["1",2]}`, 400, 0, "invalid_json"},
		{"number out of float64 range", `{"operation":"add","operands":[1e400,2]}`, 400, 0, "invalid_json"},
		{"unknown field", `{"operation":"add","operands":[1,2],"extra":true}`, 400, 0, "invalid_json"},
		{"trailing data", `{"operation":"add","operands":[1,2]}{}`, 400, 0, "invalid_json"},
		{"null body", `null`, 400, 0, "invalid_json"},
		{"null operand", `{"operation":"add","operands":[null,2]}`, 400, 0, "invalid_json"},
		{"trailing closing brace", `{"operation":"add","operands":[1,2]}}`, 400, 0, "invalid_json"},
		{"array body", `[]`, 400, 0, "invalid_json"},
		{"trailing whitespace", "{\"operation\":\"add\",\"operands\":[1,2]}  ", 200, 3, ""},
		{"oversize whitespace", `{"operation":"add","operands":[1,2]}` + strings.Repeat(" ", 1<<20), 413, 0, "request_too_large"},
	}
	srv := newTestServer()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			srv.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tt.wantStatus, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}
			if tt.wantStatus == http.StatusOK {
				var got calculateResponse
				decode(t, rec, &got)
				if got.Result != tt.wantResult {
					t.Errorf("result = %v, want %v", got.Result, tt.wantResult)
				}
				return
			}
			var got errorResponse
			decode(t, rec, &got)
			if got.Error.Code != tt.wantCode {
				t.Errorf("code = %q, want %q", got.Error.Code, tt.wantCode)
			}
			if got.Error.Message == "" {
				t.Error("message is empty")
			}
		})
	}
}

func TestCalculateEchoesRequest(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(`{"operation":"power","operands":[2,8]}`))
	rec := httptest.NewRecorder()
	newTestServer().ServeHTTP(rec, req)
	if got, want := strings.TrimSpace(rec.Body.String()), `{"operation":"power","operands":[2,8],"result":256}`; got != want {
		t.Errorf("body = %s, want %s", got, want)
	}
}

func decode(t *testing.T, rec *httptest.ResponseRecorder, v any) {
	t.Helper()
	if err := json.NewDecoder(rec.Body).Decode(v); err != nil {
		t.Fatalf("decode response: %v", err)
	}
}

func TestMathFailureMessagesDistinguishNonRealAndOverflow(t *testing.T) {
	for _, test := range []struct{ body, message string }{
		{`{"operation":"power","operands":[-8,0.5]}`, "This calculation has no real-number result."},
		{`{"operation":"multiply","operands":[1e308,10]}`, "That result is too large to show."},
	} {
		rec := httptest.NewRecorder()
		newTestServer().ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(test.body)))
		var body errorResponse
		decode(t, rec, &body)
		if rec.Code != 422 || body.Error.Code != "result_out_of_range" || body.Error.Message != test.message {
			t.Fatalf("got %d %+v, want specific message %q", rec.Code, body, test.message)
		}
	}
}

func TestOversizeMessagesIdentifyTheBodyLimit(t *testing.T) {
	for _, knownLength := range []bool{true, false} {
		for _, body := range []string{
			strings.Repeat(" ", maxBodyBytes+1) + `{"operation":"add","operands":[1,2]}`,
			`{"operation":"add","operands":[1,2]}` + strings.Repeat(" ", maxBodyBytes+1),
		} {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(body))
			if !knownLength {
				req.ContentLength = -1
			}
			rec := httptest.NewRecorder()
			newTestServer().ServeHTTP(rec, req)
			var got errorResponse
			decode(t, rec, &got)
			if rec.Code != 413 || got.Error.Code != "request_too_large" || got.Error.Message != "Request body exceeds the 1 MiB limit." {
				t.Fatalf("got %d %+v, want limit explanation", rec.Code, got)
			}
		}
	}
}
