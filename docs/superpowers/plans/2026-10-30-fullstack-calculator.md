# Full-Stack Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A calculator with a Go REST microservice that does all the arithmetic and validation, and a React + TypeScript frontend that calls it. It ships with unit tests, coverage reports, a README, CI and a single-container Dockerfile.

**Architecture:** The Go backend uses only the standard library (`net/http` 1.22+ method patterns, `log/slog`). It has three layers: a pure domain package (`internal/calculator`), an HTTP transport package (`internal/httpapi`) and a thin `cmd/server` entry point with a testable `run()` and graceful shutdown. The frontend is a Vite React-TS app. A typed API client sits in `src/api`, and one feature folder (`src/features/calculator`) holds the UI, validation, formatting and a request hook. The backend is the single source of truth for the math. The frontend checks only that the inputs are numbers. In dev, Vite proxies `/api` to Go. In production, Go serves the built SPA from `STATIC_DIR`, so the app is always same-origin and needs no CORS.

**Tech Stack:** Go (latest stable, stdlib only), React 19, TypeScript, Vite, Vitest, React Testing Library, user-event, @vitest/coverage-v8, Docker (distroless), GitHub Actions.

---

## Research notes (best practices adopted)

| Source | What we take |
|---|---|
| golang-standards/project-layout | `cmd/` + `internal/` only. The guide itself says the full layout is overkill for small services, so no `/pkg`. |
| Mat Ryer, "How I write HTTP services in Go after 13 years" | `NewServer(deps) http.Handler`, all routes in one `routes.go`, handler maker funcs, JSON encode helpers in one place, `run(ctx, getenv, stdout) error` + `signal.NotifyContext` graceful shutdown, an end-to-end test that calls `run()` and polls `/healthz`. |
| bulletproof-react | Feature folder (`src/features/calculator`), a separate API layer (`src/api`), no barrel files, one-way imports (shared → features → app). |
| Similar public submissions (Juanchiz1, portella94, Melvin0406 `calculator-go-react`) | One `POST /api/v1/calculate` endpoint with `{operation, operands}`, a single error envelope for every non-2xx response, `percentage` defined explicitly as "a% of b", edge cases written down and tested, prompts recorded in `docs/prompts.md`. |

## Key design decisions (copy these into the README)

1. **One endpoint, operation in the body** (`POST /api/v1/calculate`), not `/add`, `/divide`, … A new operation is one map entry, and the client stays generic.
2. **`operands: number[]` with per-operation arity.** `sqrt` takes 1 and the rest take 2. Sending the wrong count is a 400 error, not silently ignored.
3. **Error envelope** `{"error":{"code","message"}}`. `400` = malformed request (bad JSON, unknown field, unknown operation, wrong arity). `422` = well-formed but mathematically undefined (division by zero, √ of a negative number, overflow/NaN). `405`/`404` under `/api/` also return JSON.
4. **Strict decoding.** `DisallowUnknownFields`, a 1 MiB body limit, rejection of trailing data, and `"5"` (a string) rejected as an operand.
5. **Non-finite results are errors** (`1e308*10`, `(-8)^0.5`), because JSON cannot encode `Inf`/`NaN`.
6. **The backend returns raw float64. The frontend formats it for display** (12 significant digits), because formatting is a presentation concern.
7. **Frontend inputs are `type="text" inputMode="decimal"`**, not `type="number"`, so that invalid input reaches our validator and gets a clear message instead of being silently turned into `""`.
8. **No CORS.** The app is same-origin in dev (Vite proxy) and in prod (Go serves the SPA).
9. **Stdlib only on the backend.** Go 1.22+ routing removes the need for chi/gin, and having zero dependencies keeps the review surface small.

## File structure

```
calculator/
├── .github/workflows/ci.yml          CI: go vet/test/race/cover + npm lint/typecheck/test/coverage + docker build
├── .gitignore
├── .dockerignore
├── Dockerfile                        node build → go build → distroless (one container, port 8080)
├── Makefile                          test, coverage, run-backend, run-frontend, docker
├── README.md
├── docs/
│   ├── coverage.md                   coverage summary (generated numbers pasted in)
│   ├── prompts.md                    AI prompts used
│   └── superpowers/plans/…           this plan
├── backend/
│   ├── go.mod
│   ├── cmd/server/main.go            main() + run(): config, server, graceful shutdown
│   ├── cmd/server/main_test.go       end-to-end test through run()
│   └── internal/
│       ├── calculator/calculator.go       domain: Operation, Calculate, typed errors
│       ├── calculator/calculator_test.go
│       └── httpapi/
│           ├── server.go             NewServer + middleware (logging, recover)
│           ├── routes.go             every route in one place
│           ├── respond.go            writeJSON / writeError + error envelope types
│           ├── calculate.go          POST /api/v1/calculate handler + error mapping
│           ├── calculate_test.go
│           └── server_test.go        health, 404, 405, recover, static
└── frontend/                         (scaffolded by create-vite, then edited)
    ├── vite.config.ts                proxy + vitest config
    └── src/
        ├── main.tsx, App.tsx, index.css
        ├── test/setup.ts
        ├── api/calculator.ts (+ .test.ts)          typed fetch client, ApiError
        └── features/calculator/
            ├── operations.ts (+ .test.ts)          operation metadata (label, symbol, arity)
            ├── validation.ts (+ .test.ts)          parseOperand, validateInputs
            ├── format.ts (+ .test.ts)              formatNumber, formatExpression
            ├── useCalculation.ts (+ .test.tsx)     request state + stale-response guard
            ├── NumberField.tsx                     accessible labelled input with error
            └── Calculator.tsx (+ .test.tsx)        the form
```

---

### Task 0: Tooling and repository scaffold

**Files:**
- Create: `calculator/.gitignore`, `calculator/backend/go.mod`

- [ ] **Step 1: Install Go** (it is not on this machine; Node 22, Docker and gh are)

```bash
brew install go
go version
```
Expected: `go version go1.2x.x darwin/arm64`. Use that `1.2x` in `go.mod` and in the Dockerfile's `golang:` tag.

- [ ] **Step 2: Initialise the repository**

```bash
cd /Users/aydogdu/Documents/Claud/calculator
git init -b main
mkdir -p backend && cd backend && go mod init github.com/aydogdu/calculator/backend
```

- [ ] **Step 3: Write `.gitignore`**

```gitignore
# Go
backend/coverage.out
backend/coverage.html
backend/server
# Node
frontend/node_modules/
frontend/dist/
frontend/coverage/
# OS / editors
.DS_Store
.idea/
.vscode/
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: initialise repository"
```

---

### Task 1: Domain — `calculator` package (TDD)

**Files:**
- Create: `backend/internal/calculator/calculator.go`
- Test: `backend/internal/calculator/calculator_test.go`

- [ ] **Step 1: Write the failing test**

```go
package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestCalculate(t *testing.T) {
	tests := []struct {
		name     string
		op       Operation
		operands []float64
		want     float64
		wantErr  error
	}{
		{"add", Add, []float64{2, 3}, 5, nil},
		{"add negatives", Add, []float64{-2, -3.5}, -5.5, nil},
		{"subtract", Subtract, []float64{10, 4}, 6, nil},
		{"multiply", Multiply, []float64{6, 7}, 42, nil},
		{"multiply by zero", Multiply, []float64{6, 0}, 0, nil},
		{"divide", Divide, []float64{12, 4}, 3, nil},
		{"divide fraction", Divide, []float64{1, 4}, 0.25, nil},
		{"divide by zero", Divide, []float64{1, 0}, 0, ErrDivisionByZero},
		{"zero divided by zero", Divide, []float64{0, 0}, 0, ErrDivisionByZero},
		{"power", Power, []float64{2, 10}, 1024, nil},
		{"power negative exponent", Power, []float64{2, -1}, 0.5, nil},
		{"power of negative to fraction is NaN", Power, []float64{-8, 0.5}, 0, ErrNonFinite},
		{"sqrt", Sqrt, []float64{16}, 4, nil},
		{"sqrt zero", Sqrt, []float64{0}, 0, nil},
		{"sqrt negative", Sqrt, []float64{-1}, 0, ErrNegativeSqrt},
		{"percentage", Percentage, []float64{15, 200}, 30, nil},
		{"overflow", Multiply, []float64{math.MaxFloat64, 10}, 0, ErrNonFinite},
		{"unknown operation", Operation("modulo"), []float64{1, 2}, 0, ErrUnknownOperation},
		{"empty operation", Operation(""), []float64{1, 2}, 0, ErrUnknownOperation},
		{"too few operands", Add, []float64{1}, 0, ErrOperandCount},
		{"too many operands", Sqrt, []float64{1, 2}, 0, ErrOperandCount},
		{"nil operands", Add, nil, 0, ErrOperandCount},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Calculate(tt.op, tt.operands)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Calculate(%q, %v) error = %v, want %v", tt.op, tt.operands, err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("Calculate(%q, %v) = %v, want %v", tt.op, tt.operands, got, tt.want)
			}
		})
	}
}

func TestErrorMessagesAreDescriptive(t *testing.T) {
	_, err := Calculate(Add, []float64{1})
	if got, want := err.Error(), "wrong number of operands: add takes 2, got 1"; got != want {
		t.Errorf("error = %q, want %q", got, want)
	}
	_, err = Calculate("modulo", []float64{1, 2})
	if got, want := err.Error(), `unknown operation: "modulo"`; got != want {
		t.Errorf("error = %q, want %q", got, want)
	}
}
```

- [ ] **Step 2: Run the test and check that it fails**

Run: `cd backend && go test ./internal/calculator/`
Expected: FAIL, `undefined: Operation` (compile error).

- [ ] **Step 3: Implement**

```go
// Package calculator holds the arithmetic and its domain rules. It knows
// nothing about HTTP or JSON.
package calculator

import (
	"errors"
	"fmt"
	"math"
)

// Operation names an arithmetic operation.
type Operation string

const (
	Add        Operation = "add"
	Subtract   Operation = "subtract"
	Multiply   Operation = "multiply"
	Divide     Operation = "divide"
	Power      Operation = "power"
	Sqrt       Operation = "sqrt"
	Percentage Operation = "percentage" // a percent of b: (a / 100) * b
)

var (
	ErrUnknownOperation = errors.New("unknown operation")
	ErrOperandCount     = errors.New("wrong number of operands")
	ErrDivisionByZero   = errors.New("division by zero")
	ErrNegativeSqrt     = errors.New("square root of a negative number")
	ErrNonFinite        = errors.New("result is not a finite number")
)

type spec struct {
	arity int
	apply func(x []float64) (float64, error)
}

var operations = map[Operation]spec{
	Add:      {2, func(x []float64) (float64, error) { return x[0] + x[1], nil }},
	Subtract: {2, func(x []float64) (float64, error) { return x[0] - x[1], nil }},
	Multiply: {2, func(x []float64) (float64, error) { return x[0] * x[1], nil }},
	Divide: {2, func(x []float64) (float64, error) {
		if x[1] == 0 {
			return 0, ErrDivisionByZero
		}
		return x[0] / x[1], nil
	}},
	Power: {2, func(x []float64) (float64, error) { return math.Pow(x[0], x[1]), nil }},
	Sqrt: {1, func(x []float64) (float64, error) {
		if x[0] < 0 {
			return 0, ErrNegativeSqrt
		}
		return math.Sqrt(x[0]), nil
	}},
	Percentage: {2, func(x []float64) (float64, error) { return x[0] / 100 * x[1], nil }},
}

// Calculate applies op to operands. Errors wrap one of the Err* values above.
func Calculate(op Operation, operands []float64) (float64, error) {
	s, ok := operations[op]
	if !ok {
		return 0, fmt.Errorf("%w: %q", ErrUnknownOperation, op)
	}
	if len(operands) != s.arity {
		return 0, fmt.Errorf("%w: %s takes %d, got %d", ErrOperandCount, op, s.arity, len(operands))
	}
	result, err := s.apply(operands)
	if err != nil {
		return 0, err
	}
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrNonFinite
	}
	return result, nil
}
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `go test ./internal/calculator/ -cover`
Expected: `ok … coverage: 100.0% of statements`

- [ ] **Step 5: Commit**

```bash
git add backend && git commit -m "feat(backend): calculator domain with typed errors"
```

---

### Task 2: HTTP transport — respond helpers, calculate handler, routes, server

**Files:**
- Create: `backend/internal/httpapi/respond.go`, `calculate.go`, `routes.go`, `server.go`
- Test: `backend/internal/httpapi/calculate_test.go`, `backend/internal/httpapi/server_test.go`

- [ ] **Step 1: Write the failing handler test** (`calculate_test.go`)

```go
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
		{"null operand", `{"operation":"add","operands":[null,2]}`, 400, 0, "invalid_json"},
		{"number out of float64 range", `{"operation":"add","operands":[1e400,2]}`, 400, 0, "invalid_json"},
		{"unknown field", `{"operation":"add","operands":[1,2],"extra":true}`, 400, 0, "invalid_json"},
		{"trailing data", `{"operation":"add","operands":[1,2]}{}`, 400, 0, "invalid_json"},
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
```

- [ ] **Step 2: Write the failing server test** (`server_test.go`)

```go
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
```

- [ ] **Step 3: Run the tests and check that they fail**

Run: `go test ./internal/httpapi/`
Expected: FAIL, `undefined: NewServer`.

- [ ] **Step 4: Implement `respond.go`**

```go
package httpapi

import (
	"encoding/json"
	"net/http"
)

type errorResponse struct {
	Error apiError `json:"error"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v) // the client is gone if this fails; nothing useful to do
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{Error: apiError{Code: code, Message: message}})
}
```

- [ ] **Step 5: Implement `calculate.go`**

```go
package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/aydogdu/calculator/backend/internal/calculator"
)

const maxBodyBytes = 1 << 20

// Operands are pointers so that a JSON null element is detected. Decoding
// null into a plain float64 silently leaves 0.
type calculateRequest struct {
	Operation calculator.Operation `json:"operation"`
	Operands  []*float64           `json:"operands"`
}

type calculateResponse struct {
	Operation calculator.Operation `json:"operation"`
	Operands  []float64            `json:"operands"`
	Result    float64              `json:"result"`
}

func handleCalculate() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req calculateRequest
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil || dec.More() {
			writeError(w, http.StatusBadRequest, "invalid_json",
				`request body must be a JSON object like {"operation":"add","operands":[1,2]}`)
			return
		}

		operands := make([]float64, len(req.Operands))
		for i, v := range req.Operands {
			if v == nil {
				writeError(w, http.StatusBadRequest, "invalid_json", "operands must be numbers, not null")
				return
			}
			operands[i] = *v
		}

		result, err := calculator.Calculate(req.Operation, operands)
		if err != nil {
			status, code := classify(err)
			writeError(w, status, code, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, calculateResponse{Operation: req.Operation, Operands: operands, Result: result})
	})
}

// classify maps domain errors to an HTTP status and a stable machine-readable code.
func classify(err error) (int, string) {
	switch {
	case errors.Is(err, calculator.ErrUnknownOperation):
		return http.StatusBadRequest, "unknown_operation"
	case errors.Is(err, calculator.ErrOperandCount):
		return http.StatusBadRequest, "invalid_operands"
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusUnprocessableEntity, "division_by_zero"
	case errors.Is(err, calculator.ErrNegativeSqrt):
		return http.StatusUnprocessableEntity, "negative_sqrt"
	case errors.Is(err, calculator.ErrNonFinite):
		return http.StatusUnprocessableEntity, "result_out_of_range"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}
```

Note: if `dec.More()` returns true for `{...}{}`, the request is rejected as trailing data. A body of `{...}  ` (whitespace only after the object) passes.

- [ ] **Step 6: Implement `routes.go`**

```go
package httpapi

import (
	"log/slog"
	"net/http"
)

func addRoutes(mux *http.ServeMux, logger *slog.Logger, staticDir string) {
	mux.Handle("POST /api/v1/calculate", handleCalculate())
	mux.Handle("/api/v1/calculate", handleMethodNotAllowed(http.MethodPost))
	mux.Handle("GET /healthz", handleHealth())
	mux.Handle("/api/", handleNotFound())
	if staticDir != "" {
		logger.Info("serving static files", "dir", staticDir)
		mux.Handle("GET /", http.FileServer(http.Dir(staticDir)))
	}
}

func handleHealth() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
}

func handleMethodNotAllowed(allow string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Allow", allow)
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "use "+allow)
	})
}

func handleNotFound() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", "no such endpoint")
	})
}
```

- [ ] **Step 7: Implement `server.go`**

```go
// Package httpapi exposes the calculator over HTTP/JSON.
package httpapi

import (
	"log/slog"
	"net/http"
	"time"
)

// NewServer returns the application's root handler. If staticDir is not
// empty, the built frontend is served from it.
func NewServer(logger *slog.Logger, staticDir string) http.Handler {
	mux := http.NewServeMux()
	addRoutes(mux, logger, staticDir)
	var h http.Handler = mux
	h = withRecover(logger, h)
	h = withLogging(logger, h)
	return h
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func withLogging(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		logger.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status, "duration", time.Since(start))
	})
}

func withRecover(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				logger.Error("panic", "value", v, "path", r.URL.Path)
				writeError(w, http.StatusInternalServerError, "internal_error", "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
```

- [ ] **Step 8: Run the tests and check that they pass**

Run: `go test ./internal/... -race -cover`
Expected: both packages `ok`. httpapi coverage should be about 95% or higher.

- [ ] **Step 9: Commit**

```bash
git add backend && git commit -m "feat(backend): HTTP API with JSON error envelope"
```

---

### Task 3: Entry point — `run()` with graceful shutdown + end-to-end test

**Files:**
- Create: `backend/cmd/server/main.go`
- Test: `backend/cmd/server/main_test.go`

- [ ] **Step 1: Write the failing test**

```go
package main

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestRunServesAPIAndShutsDown(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	port := freePort(t)
	getenv := func(k string) string {
		if k == "PORT" {
			return port
		}
		return ""
	}
	errCh := make(chan error, 1)
	go func() { errCh <- run(ctx, getenv, io.Discard) }()

	base := "http://127.0.0.1:" + port
	waitForReady(t, base+"/healthz")

	resp, err := http.Post(base+"/api/v1/calculate", "application/json",
		strings.NewReader(`{"operation":"multiply","operands":[6,7]}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var body struct{ Result float64 }
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || body.Result != 42 {
		t.Fatalf("result = %v (err %v), want 42", body.Result, err)
	}

	cancel()
	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("run returned %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("server did not shut down")
	}
}

func TestRunFailsOnBadPort(t *testing.T) {
	getenv := func(k string) string {
		if k == "PORT" {
			return "not-a-port"
		}
		return ""
	}
	if err := run(context.Background(), getenv, io.Discard); err == nil {
		t.Fatal("expected an error")
	}
}

func freePort(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	return strconv.Itoa(l.Addr().(*net.TCPAddr).Port)
}

func waitForReady(t *testing.T, url string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if resp, err := http.Get(url); err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("%s not ready", url)
}
```

- [ ] **Step 2: Run the test and check that it fails**

Run: `go test ./cmd/server/`
Expected: FAIL, `undefined: run`.

- [ ] **Step 3: Implement**

```go
// Command server runs the calculator HTTP API.
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/aydogdu/calculator/backend/internal/httpapi"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, os.Getenv, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// run starts the server and blocks until ctx is cancelled or the server fails.
func run(ctx context.Context, getenv func(string) string, stdout io.Writer) error {
	logger := slog.New(slog.NewJSONHandler(stdout, nil))
	port := getenv("PORT")
	if port == "" {
		port = "8080"
	}
	srv := &http.Server{
		Addr:              net.JoinHostPort("", port),
		Handler:           httpapi.NewServer(logger, getenv("STATIC_DIR")),
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}
	logger.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
```

- [ ] **Step 4: Run all backend checks**

```bash
go vet ./... && go test ./... -race -cover
```
Expected: three `ok` lines, and no output from vet.

- [ ] **Step 5: Smoke test by hand**

```bash
go run ./cmd/server &
curl -s -X POST localhost:8080/api/v1/calculate -d '{"operation":"divide","operands":[1,0]}'
kill %1
```
Expected: `{"error":{"code":"division_by_zero","message":"division by zero"}}`

- [ ] **Step 6: Commit**

```bash
git add backend && git commit -m "feat(backend): server entry point with graceful shutdown"
```

---

### Task 4: Frontend scaffold + test tooling

**Files:**
- Create: `frontend/` (create-vite), `frontend/src/test/setup.ts`
- Modify: `frontend/vite.config.ts`, `frontend/package.json` scripts, `frontend/src/App.tsx`, `frontend/src/index.css`
- Delete: `frontend/src/App.css`, `frontend/src/assets/`, `frontend/public/vite.svg`

- [ ] **Step 1: Scaffold and install dependencies**

```bash
cd /Users/aydogdu/Documents/Claud/calculator
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
rm -rf src/App.css src/assets public/vite.svg
```

- [ ] **Step 2: Replace `vite.config.ts`**

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8080' },
  },
  test: {
    environment: 'jsdom',
    globals: true, // lets Testing Library register automatic cleanup
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
    },
  },
});
```

- [ ] **Step 3: Write `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add scripts to `package.json`** (keep the `dev`, `build`, `lint` and `preview` scripts that the scaffold generated)

```json
"test": "vitest run",
"test:watch": "vitest",
"coverage": "vitest run --coverage",
"typecheck": "tsc -b"
```

- [ ] **Step 5: Replace `src/App.tsx` with a stub so the build stays green until Task 8**

```tsx
export default function App() {
  return (
    <main className="app">
      <h1>Calculator</h1>
    </main>
  );
}
```
Also remove the `App.css` import if `main.tsx` has one, and empty `src/index.css` (it is rewritten in Task 8).

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run build && npm test -- --passWithNoTests`
Expected: all three succeed.

- [ ] **Step 7: Commit**

```bash
git add frontend && git commit -m "chore(frontend): scaffold Vite React-TS with Vitest"
```

---

### Task 5: API client (TDD)

**Files:**
- Create: `frontend/src/api/calculator.ts`
- Test: `frontend/src/api/calculator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, calculate } from './calculator';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('calculate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the operation and returns the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ operation: 'add', operands: [2, 3], result: 5 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(calculate('add', [2, 3])).resolves.toEqual({ operation: 'add', operands: [2, 3], result: 5 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/calculate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ operation: 'add', operands: [2, 3] }) }),
    );
  });

  it('throws ApiError carrying the server error code and message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: 'division_by_zero', message: 'division by zero' } }, 422),
    ));

    const error = await calculate('divide', [1, 0]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'division_by_zero', message: 'division by zero', status: 422 });
  });

  it('falls back to a generic error when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })));
    await expect(calculate('add', [1, 2])).rejects.toMatchObject({ code: 'unknown_error', status: 502 });
  });

  it('reports network failures as ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(calculate('add', [1, 2])).rejects.toMatchObject({
      code: 'network_error',
      message: 'Could not reach the calculator service.',
    });
  });

  it('rethrows aborts unchanged', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
    await expect(calculate('add', [1, 2], controller.signal)).rejects.toBe(abortError);
  });
});
```

- [ ] **Step 2: Run the test and check that it fails**

Run: `npm test -- src/api`
Expected: FAIL, cannot resolve `./calculator`.

- [ ] **Step 3: Implement**

```ts
export type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'sqrt' | 'percentage';

export interface CalculateResponse {
  operation: Operation;
  operands: number[];
  result: number;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export type CalculateFn = (operation: Operation, operands: number[], signal?: AbortSignal) => Promise<CalculateResponse>;

export const calculate: CalculateFn = async (operation, operands, signal) => {
  let response: Response;
  try {
    response = await fetch('/api/v1/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, operands }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError('network_error', 'Could not reach the calculator service.', 0);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ErrorBody | null)?.error;
    throw new ApiError(
      error?.code ?? 'unknown_error',
      error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
    );
  }
  return body as CalculateResponse;
};
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `npm test -- src/api`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api && git commit -m "feat(frontend): typed API client with ApiError"
```

---

### Task 6: Operation metadata, validation and formatting (TDD)

**Files:**
- Create: `frontend/src/features/calculator/operations.ts`, `validation.ts`, `format.ts`
- Test: `operations.test.ts`, `validation.test.ts`, `format.test.ts` (same folder)

- [ ] **Step 1: Write the failing tests**

`operations.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { OPERATIONS, getOperation } from './operations';

describe('operations', () => {
  it('covers every backend operation once', () => {
    expect(OPERATIONS.map((o) => o.id)).toEqual(['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt', 'percentage']);
  });

  it('marks sqrt as unary and the rest as binary', () => {
    expect(getOperation('sqrt').arity).toBe(1);
    expect(OPERATIONS.filter((o) => o.arity === 2)).toHaveLength(6);
  });
});
```

`validation.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { parseOperand, validateInputs } from './validation';

describe('parseOperand', () => {
  it.each([
    ['42', 42], ['-3.5', -3.5], ['+7', 7], ['.5', 0.5], ['5.', 5], ['1e3', 1000], ['  8  ', 8],
  ])('accepts %j', (raw, value) => {
    expect(parseOperand(raw)).toEqual({ ok: true, value });
  });

  it('asks for a number when empty', () => {
    expect(parseOperand('   ')).toEqual({ ok: false, error: 'Enter a number.' });
  });

  it.each(['abc', '1,5', '0x10', '1e', '--1', 'Infinity', '1e999'])('rejects %j', (raw) => {
    expect(parseOperand(raw)).toEqual({ ok: false, error: 'Not a valid number.' });
  });
});

describe('validateInputs', () => {
  it('returns both operands for binary operations', () => {
    expect(validateInputs(2, '2', '3')).toEqual({ ok: true, operands: [2, 3] });
  });

  it('ignores the second input for unary operations', () => {
    expect(validateInputs(1, '9', 'junk')).toEqual({ ok: true, operands: [9] });
  });

  it('reports an error per field', () => {
    expect(validateInputs(2, 'x', '')).toEqual({
      ok: false,
      errors: { a: 'Not a valid number.', b: 'Enter a number.' },
    });
  });
});
```

`format.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { formatExpression, formatNumber } from './format';

describe('formatNumber', () => {
  it.each([
    [5, '5'], [0.1 + 0.2, '0.3'], [1 / 3, '0.333333333333'], [-2.5, '-2.5'], [1e21, '1e+21'],
  ])('formats %d as %s', (n, s) => {
    expect(formatNumber(n)).toBe(s);
  });
});

describe('formatExpression', () => {
  it('formats binary operations with their symbol', () => {
    expect(formatExpression('divide', [12, 4], 3)).toBe('12 ÷ 4 = 3');
  });
  it('formats sqrt', () => {
    expect(formatExpression('sqrt', [16], 4)).toBe('√16 = 4');
  });
  it('formats percentage', () => {
    expect(formatExpression('percentage', [15, 200], 30)).toBe('15% of 200 = 30');
  });
});
```

- [ ] **Step 2: Run the tests and check that they fail**

Run: `npm test -- src/features`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `operations.ts`**

```ts
import type { Operation } from '../../api/calculator';

export interface OperationInfo {
  id: Operation;
  label: string;
  symbol: string;
  arity: 1 | 2;
}

export const OPERATIONS: readonly OperationInfo[] = [
  { id: 'add', label: 'Add', symbol: '+', arity: 2 },
  { id: 'subtract', label: 'Subtract', symbol: '−', arity: 2 },
  { id: 'multiply', label: 'Multiply', symbol: '×', arity: 2 },
  { id: 'divide', label: 'Divide', symbol: '÷', arity: 2 },
  { id: 'power', label: 'Power', symbol: '^', arity: 2 },
  { id: 'sqrt', label: 'Square root', symbol: '√', arity: 1 },
  { id: 'percentage', label: 'Percent of', symbol: '%', arity: 2 },
];

export function getOperation(id: Operation): OperationInfo {
  const info = OPERATIONS.find((o) => o.id === id);
  if (!info) throw new Error(`Unknown operation: ${id}`);
  return info;
}
```

- [ ] **Step 4: Implement `validation.ts`**

```ts
export type ParseResult = { ok: true; value: number } | { ok: false; error: string };
export type FieldErrors = { a?: string; b?: string };
export type ValidationResult = { ok: true; operands: number[] } | { ok: false; errors: FieldErrors };

// Plain decimal or scientific notation. Rejects hex, commas and "Infinity",
// which Number() would otherwise accept or misread.
const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

export function parseOperand(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, error: 'Enter a number.' };
  const value = Number(trimmed);
  if (!NUMBER_PATTERN.test(trimmed) || !Number.isFinite(value)) {
    return { ok: false, error: 'Not a valid number.' };
  }
  return { ok: true, value };
}

export function validateInputs(arity: 1 | 2, a: string, b: string): ValidationResult {
  const operands: number[] = [];
  const errors: FieldErrors = {};

  const first = parseOperand(a);
  if (first.ok) operands.push(first.value);
  else errors.a = first.error;

  if (arity === 2) {
    const second = parseOperand(b);
    if (second.ok) operands.push(second.value);
    else errors.b = second.error;
  }

  return errors.a || errors.b ? { ok: false, errors } : { ok: true, operands };
}
```

- [ ] **Step 5: Implement `format.ts`**

```ts
import type { Operation } from '../../api/calculator';
import { getOperation } from './operations';

// Twelve significant digits hide float noise such as 0.1 + 0.2 = 0.30000000000000004.
export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(12)));
}

export function formatExpression(operation: Operation, operands: number[], result: number): string {
  const [x, y] = operands.map(formatNumber);
  const r = formatNumber(result);
  switch (operation) {
    case 'sqrt':
      return `√${x} = ${r}`;
    case 'percentage':
      return `${x}% of ${y} = ${r}`;
    default:
      return `${x} ${getOperation(operation).symbol} ${y} = ${r}`;
  }
}
```

- [ ] **Step 6: Run the tests and check that they pass**

Run: `npm test -- src/features`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features && git commit -m "feat(frontend): operation metadata, input validation, result formatting"
```

---

### Task 7: `useCalculation` hook (TDD)

**Files:**
- Create: `frontend/src/features/calculator/useCalculation.ts`
- Test: `frontend/src/features/calculator/useCalculation.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateResponse } from '../../api/calculator';
import { useCalculation } from './useCalculation';

const sum: CalculateResponse = { operation: 'add', operands: [2, 3], result: 5 };

describe('useCalculation', () => {
  it('goes from loading to success', async () => {
    const calculate = vi.fn().mockResolvedValue(sum);
    const { result } = renderHook(() => useCalculation(calculate));

    act(() => void result.current.run('add', [2, 3]));
    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'success', result: sum }));
  });

  it('exposes ApiError messages and hides unexpected ones', async () => {
    const calculate = vi.fn()
      .mockRejectedValueOnce(new ApiError('division_by_zero', 'division by zero', 422))
      .mockRejectedValueOnce(new Error('kaboom'));
    const { result } = renderHook(() => useCalculation(calculate));

    await act(() => result.current.run('divide', [1, 0]));
    expect(result.current.state).toEqual({ status: 'error', message: 'division by zero' });

    await act(() => result.current.run('divide', [1, 0]));
    expect(result.current.state).toEqual({ status: 'error', message: 'Something went wrong. Please try again.' });
  });

  it('ignores a slow earlier response once a newer request was made', async () => {
    let resolveFirst!: (r: CalculateResponse) => void;
    const calculate = vi.fn()
      .mockImplementationOnce(() => new Promise<CalculateResponse>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(sum);
    const { result } = renderHook(() => useCalculation(calculate));

    act(() => void result.current.run('multiply', [9, 9]));
    await act(() => result.current.run('add', [2, 3]));
    await act(async () => resolveFirst({ operation: 'multiply', operands: [9, 9], result: 81 }));

    expect(result.current.state).toEqual({ status: 'success', result: sum });
    expect(calculate.mock.calls[0][2].aborted).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and check that it fails**

Run: `npm test -- useCalculation`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type CalculateFn, type CalculateResponse, type Operation } from '../../api/calculator';

export type CalculationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: CalculateResponse }
  | { status: 'error'; message: string };

export function useCalculation(calculate: CalculateFn) {
  const [state, setState] = useState<CalculationState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(
    async (operation: Operation, operands: number[]) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ status: 'loading' });
      try {
        const result = await calculate(operation, operands, controller.signal);
        if (!controller.signal.aborted) setState({ status: 'success', result });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
        });
      }
    },
    [calculate],
  );

  return { state, run };
}
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `npm test -- useCalculation`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features && git commit -m "feat(frontend): useCalculation hook with stale-response guard"
```

---

### Task 8: Calculator UI + responsive styling (TDD)

**Files:**
- Create: `frontend/src/features/calculator/NumberField.tsx`, `Calculator.tsx`
- Test: `frontend/src/features/calculator/Calculator.test.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/index.html` (`<title>Calculator</title>`)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type CalculateFn } from '../../api/calculator';
import { Calculator } from './Calculator';

function setup(calculate: CalculateFn) {
  const user = userEvent.setup();
  render(<Calculator calculate={calculate} />);
  return user;
}

describe('Calculator', () => {
  it('sends the operands to the API and shows the result', async () => {
    const calculate = vi.fn().mockResolvedValue({ operation: 'add', operands: [2, 3], result: 5 });
    const user = setup(calculate);

    await user.type(screen.getByLabelText('First number'), '2');
    await user.type(screen.getByLabelText('Second number'), '3');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(await screen.findByText('2 + 3 = 5')).toBeInTheDocument();
    expect(calculate).toHaveBeenCalledWith('add', [2, 3], expect.any(AbortSignal));
  });

  it('shows field errors and does not call the API for invalid input', async () => {
    const calculate = vi.fn();
    const user = setup(calculate);

    await user.type(screen.getByLabelText('First number'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('Not a valid number.')).toBeInTheDocument();
    expect(screen.getByText('Enter a number.')).toBeInTheDocument();
    expect(screen.getByLabelText('First number')).toHaveAttribute('aria-invalid', 'true');
    expect(calculate).not.toHaveBeenCalled();
  });

  it('shows the API error message', async () => {
    const calculate = vi.fn().mockRejectedValue(new ApiError('division_by_zero', 'division by zero', 422));
    const user = setup(calculate);

    await user.type(screen.getByLabelText('First number'), '1');
    await user.click(screen.getByRole('radio', { name: 'Divide' }));
    await user.type(screen.getByLabelText('Second number'), '0');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('division by zero');
  });

  it('uses a single input for square root', async () => {
    const calculate = vi.fn().mockResolvedValue({ operation: 'sqrt', operands: [16], result: 4 });
    const user = setup(calculate);

    await user.click(screen.getByRole('radio', { name: 'Square root' }));
    expect(screen.queryByLabelText('Second number')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Number'), '16');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(await screen.findByText('√16 = 4')).toBeInTheDocument();
    expect(calculate).toHaveBeenCalledWith('sqrt', [16], expect.any(AbortSignal));
  });
});
```

- [ ] **Step 2: Run the test and check that it fails**

Run: `npm test -- Calculator`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `NumberField.tsx`**

```tsx
interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function NumberField({ id, label, value, onChange, error }: NumberFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Implement `Calculator.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { calculate as apiCalculate, type CalculateFn, type Operation } from '../../api/calculator';
import { formatExpression } from './format';
import { NumberField } from './NumberField';
import { OPERATIONS, getOperation } from './operations';
import { useCalculation } from './useCalculation';
import { validateInputs, type FieldErrors } from './validation';

interface CalculatorProps {
  calculate?: CalculateFn;
}

export function Calculator({ calculate = apiCalculate }: CalculatorProps) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [operation, setOperation] = useState<Operation>('add');
  const [errors, setErrors] = useState<FieldErrors>({});
  const { state, run } = useCalculation(calculate);
  const { arity } = getOperation(operation);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = validateInputs(arity, a, b);
    if (!validated.ok) {
      setErrors(validated.errors);
      return;
    }
    setErrors({});
    void run(operation, validated.operands);
  }

  return (
    <form className="calculator" onSubmit={handleSubmit} noValidate>
      <NumberField id="a" label={arity === 1 ? 'Number' : 'First number'} value={a} onChange={setA} error={errors.a} />

      <fieldset className="operations">
        <legend>Operation</legend>
        {OPERATIONS.map((op) => (
          <label key={op.id} className="operation" title={op.label}>
            <input
              type="radio"
              name="operation"
              value={op.id}
              checked={operation === op.id}
              onChange={() => setOperation(op.id)}
              aria-label={op.label}
            />
            <span aria-hidden="true">{op.symbol}</span>
          </label>
        ))}
      </fieldset>

      {arity === 2 && <NumberField id="b" label="Second number" value={b} onChange={setB} error={errors.b} />}

      <button type="submit" disabled={state.status === 'loading'}>
        {state.status === 'loading' ? 'Calculating…' : 'Calculate'}
      </button>

      <output className="result" aria-live="polite">
        {state.status === 'success' &&
          formatExpression(state.result.operation, state.result.operands, state.result.result)}
      </output>
      {state.status === 'error' && <p role="alert" className="error">{state.message}</p>}
    </form>
  );
}
```

- [ ] **Step 5: Replace `App.tsx`**

```tsx
import { Calculator } from './features/calculator/Calculator';

export default function App() {
  return (
    <main className="app">
      <h1>Calculator</h1>
      <Calculator />
    </main>
  );
}
```

- [ ] **Step 6: Replace `index.css`** (mobile-first, light and dark)

```css
:root {
  --bg: #f4f5f7;
  --surface: #ffffff;
  --text: #1c1e21;
  --muted: #5f6670;
  --border: #d3d7dc;
  --accent: #2f5bea;
  --accent-text: #ffffff;
  --danger: #c62828;
  --radius: 10px;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--text);
  background: var(--bg);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #15171a;
    --surface: #1f2226;
    --text: #e8eaed;
    --muted: #a0a6ad;
    --border: #3a3f45;
    --accent: #7c9bff;
    --accent-text: #0e1116;
    --danger: #ff8a80;
  }
}

*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--bg); }

.app { max-width: 28rem; margin: 0 auto; padding: 1.5rem 1rem; }
.app h1 { font-size: 1.5rem; margin: 0 0 1rem; }

.calculator {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.field { display: grid; gap: 0.35rem; }
.field label, .operations legend { font-size: 0.875rem; color: var(--muted); }
.field input {
  font: inherit;
  font-size: 1.25rem;
  padding: 0.6rem 0.75rem;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.field input[aria-invalid='true'] { border-color: var(--danger); }
.field-error, .error { margin: 0; color: var(--danger); font-size: 0.875rem; }

.operations {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  border: 0;
}
.operations legend { margin-bottom: 0.35rem; padding: 0; }
.operation {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 3rem;
  font-size: 1.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
}
.operation input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.operation:has(input:checked) { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
.operation:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }

button[type='submit'] {
  font: inherit;
  font-weight: 600;
  min-height: 3rem;
  color: var(--accent-text);
  background: var(--accent);
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;
}
button[type='submit']:disabled { opacity: 0.6; cursor: progress; }

.result { min-height: 2rem; font-size: 1.5rem; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

@media (min-width: 40rem) {
  .app { padding-top: 4rem; }
}
```

- [ ] **Step 7: Run all frontend checks**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: everything green. If ESLint flags `react-refresh/only-export-components`, it is a false positive because these files only export components.

- [ ] **Step 8: Check in the browser**: start the backend with `go run ./cmd/server` and the frontend with `npm run dev`. Open http://localhost:5173 and test add, divide by zero, sqrt, and bad input at 375px and desktop widths. Take a screenshot.

- [ ] **Step 9: Commit**

```bash
git add frontend && git commit -m "feat(frontend): calculator UI with validation and responsive layout"
```

---

### Task 9: Docker (single container)

**Files:**
- Create: `Dockerfile`, `.dockerignore`

- [ ] **Step 1: Write `Dockerfile`** (set the `golang:` tag to the Go version from Task 0)

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine AS api
WORKDIR /src
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=api /out/server /server
COPY --from=web /web/dist /static
ENV PORT=8080 STATIC_DIR=/static
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/server"]
```

- [ ] **Step 2: Write `.dockerignore`**

```
**/node_modules
frontend/dist
frontend/coverage
backend/coverage.*
.git
docs
```

- [ ] **Step 3: Build and smoke test**

```bash
docker build -t calculator .
docker run --rm -d -p 8080:8080 --name calc calculator
curl -s -X POST localhost:8080/api/v1/calculate -d '{"operation":"power","operands":[2,10]}'
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/
docker stop calc
```
Expected: `{"operation":"power","operands":[2,10],"result":1024}`, then `200`.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore && git commit -m "build: single-container Dockerfile"
```

---

### Task 10: Makefile + CI

**Files:**
- Create: `Makefile`, `.github/workflows/ci.yml`

- [ ] **Step 1: Write `Makefile`** (recipes are indented with tabs)

```make
.PHONY: test coverage run-backend run-frontend docker

test:
	cd backend && go vet ./... && go test ./... -race
	cd frontend && npm run lint && npm run typecheck && npm test

coverage:
	cd backend && go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out | tail -1 && go tool cover -html=coverage.out -o coverage.html
	cd frontend && npm run coverage

run-backend:
	cd backend && go run ./cmd/server

run-frontend:
	cd frontend && npm run dev

docker:
	docker build -t calculator . && docker run --rm -p 8080:8080 calculator
```

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version-file: backend/go.mod }
      - run: go vet ./...
      - run: go test ./... -race -coverprofile=coverage.out
      - run: go tool cover -func=coverage.out

  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run coverage
      - run: npm run build

  docker:
    runs-on: ubuntu-latest
    needs: [backend, frontend]
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t calculator .
```

- [ ] **Step 3: Verify locally**

Run: `make test && make coverage`
Expected: everything green, and coverage totals printed for both layers.

- [ ] **Step 4: Commit**

```bash
git add Makefile .github && git commit -m "ci: Makefile targets and GitHub Actions workflow"
```

---

### Task 11: Documentation — README, coverage report, prompts

**Files:**
- Create: `README.md`, `docs/coverage.md`, `docs/prompts.md`

- [ ] **Step 1: Write `README.md`** with these sections in this order:
  1. **Title + one-paragraph summary** and the CI badge (`![CI](https://github.com/<owner>/calculator/actions/workflows/ci.yml/badge.svg)`, with the owner filled in after Task 12).
  2. **Features**: the seven operations, with `percentage` defined as "a% of b".
  3. **Prerequisites**: Go 1.2x+, Node 22+, Docker (optional).
  4. **Run with Docker**: `docker build -t calculator . && docker run --rm -p 8080:8080 calculator`, then open http://localhost:8080.
  5. **Run locally**: terminal 1 `make run-backend` (`:8080`), terminal 2 `cd frontend && npm install && npm run dev` (`:5173`, with `/api` proxied).
  6. **Configuration table**: `PORT` (default `8080`), `STATIC_DIR` (default empty, which means API only).
  7. **API**: request/response schema; an operations table (name, arity, formula); a status/code table (`400 invalid_json | unknown_operation | invalid_operands`, `405 method_not_allowed`, `404 not_found`, `422 division_by_zero | negative_sqrt | result_out_of_range`, `500 internal_error`); and the curl examples below, each with its real output pasted from a run:
     ```bash
     curl -s -X POST localhost:8080/api/v1/calculate -H 'Content-Type: application/json' -d '{"operation":"add","operands":[2,3]}'
     curl -s -X POST localhost:8080/api/v1/calculate -d '{"operation":"sqrt","operands":[144]}'
     curl -s -X POST localhost:8080/api/v1/calculate -d '{"operation":"percentage","operands":[15,200]}'
     curl -s -X POST localhost:8080/api/v1/calculate -d '{"operation":"divide","operands":[1,0]}'
     curl -s -X POST localhost:8080/api/v1/calculate -d '{"operation":"add","operands":["1",2]}'
     curl -s localhost:8080/healthz
     ```
  8. **Tests and coverage**: `make test`, `make coverage`, where the reports are written (`backend/coverage.html`, `frontend/coverage/index.html`), and a link to `docs/coverage.md`.
  9. **Project structure**: the tree from this plan.
  10. **Design decisions and assumptions**: the 9 decisions at the top of this plan, plus these assumptions: float64 semantics (IEEE-754), no auth or rate limiting (out of scope), and no calculation history (YAGNI).
  11. **AI usage**: link to `docs/prompts.md` and this plan.

- [ ] **Step 2: Write `docs/coverage.md`**: run `make coverage`, then paste the `go tool cover -func` total, the per-package `go test -cover` lines and the Vitest coverage text table. Explain any uncovered lines (for example `main()` itself, which `run()` tests cover in its place).

- [ ] **Step 3: Write `docs/prompts.md`**: record each prompt given to the AI, verbatim and in order. Start with the original assignment prompt and "first step is to check github repositories for best practices and then come up with a plan.", then add one line per prompt on what it produced.

- [ ] **Step 4: Commit**

```bash
git add README.md docs && git commit -m "docs: README, coverage report, prompts"
```

---

### Task 12: Publish to GitHub (ask the user first — this publishes code)

- [ ] **Step 1: Confirm the repo name and visibility with the user**, then:

```bash
gh repo create calculator --public --source . --remote origin --push
```

- [ ] **Step 2: Check that CI passes** with `gh run list --limit 1`, then fix the README badge owner and push again.

---

## Self-review

- **Spec coverage:** the four operations and all three optional ones are in Task 1. The intuitive UI, validation, error handling and responsive layout are in Tasks 6–8. The REST endpoints, validation and edge cases (div/0, invalid data, overflow) are in Task 2. JSON results are in Task 2. Unit tests for both layers are in Tasks 1–3 and 5–8. The coverage report is in Tasks 10–11. The README with setup, how to run, API examples and design decisions is in Task 11. The Dockerfile is in Task 9. Prompts are in Task 11. The Git repository is set up in Tasks 0 and 12.
- **Type consistency:** `CalculateFn(operation, operands, signal?)` is used the same way in the client, the hook and the component. The `FieldErrors {a, b}` keys match the `NumberField` ids. The error codes in `classify` match the tests and the README table.
- **Time budget:** the backend (Tasks 1–3) is about 60 min, the frontend (Tasks 4–8) about 75 min, and Docker, CI and docs (Tasks 9–11) about 45 min. That fits in about 3 hours.
