# Coverage report

Measured 2026-10-30 after the ten review fixes, using `make coverage` with Go 1.27.3, Node 22.23.2 and Vitest 5.0.5. All 113 frontend tests passed. Coverage includes live feature code; the obsolete form formatter and duplicate request-hook UI state and their obsolete tests have been removed.

## Backend

```text
ok  	github.com/aydogdu/calculator/backend/cmd/server	11.599s	coverage: 72.7% of statements
ok  	github.com/aydogdu/calculator/backend/internal/calculator	0.555s	coverage: 100.0% of statements
ok  	github.com/aydogdu/calculator/backend/internal/httpapi	1.432s	coverage: 93.8% of statements
total:										(statements)		90.9%
```

```text
github.com/aydogdu/calculator/backend/cmd/server/main.go:20:			main			0.0%
github.com/aydogdu/calculator/backend/cmd/server/main.go:30:			run			94.1%
github.com/aydogdu/calculator/backend/internal/calculator/calculator.go:65:	Calculate		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/calculate.go:26:		handleCalculate		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/calculate.go:70:		classify		85.7%
github.com/aydogdu/calculator/backend/internal/httpapi/calculate.go:87:		writeDecodeError	100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/respond.go:17:		writeJSON		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/respond.go:23:		writeError		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/routes.go:10:		addRoutes		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/routes.go:21:		handleHealth		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/routes.go:27:		handleMethodNotAllowed	100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/routes.go:34:		handleNotFound		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/routes.go:43:		Open			72.2%
github.com/aydogdu/calculator/backend/internal/httpapi/server.go:12:		NewServer		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/server.go:26:		WriteHeader		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/server.go:31:		withLogging		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/server.go:40:		withRecover		100.0%
total:										(statements)		90.9%
```

The domain is fully covered. Tests exercise the real run() server, including a slow TCP request body that must be bounded by the request timeout. main() process signal/exit plumbing and defensive static-filesystem error branches are not fully covered.

## Frontend

```text
% Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   98.08 |    97.26 |   96.87 |   99.21 |
 src               |       0 |      100 |       0 |       0 |
  App.tsx          |       0 |      100 |       0 |       0 | 4
 ...res/calculator |   98.51 |    96.87 |     100 |     100 |
  Calculator.tsx   |     100 |    96.96 |     100 |     100 | 18
  keypadReducer.ts |   98.18 |    96.52 |     100 |     100 | 56,81-83,87
  operations.ts    |   83.33 |       50 |     100 |     100 | 22
-------------------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 98.08% ( 154/157 )
Branches     : 97.26% ( 213/219 )
Functions    : 96.87% ( 31/32 )
Lines        : 99.21% ( 127/128 )
================================================================================
```

Feature lines are covered by reducer, component, request-lifetime and API-boundary behavior tests. The top-level App.tsx wrapper is not directly rendered. Remaining uncovered branches include defensive invalid-digit/operation handling and a legacy generic non-finite message fallback. DOM bootstrap, setup and test files are excluded from coverage. Generated HTML reports live at backend/coverage.html and frontend/coverage/index.html.

The rebuilt review Docker image passed the unchanged independent API script (40/40). Additional live checks confirmed exact 7% and 29% of 100 responses, non-real error wording, descriptive body-limit rejection, blocked assets directory listing and normal root/JS delivery. Earlier visual browser QA evidence remains in docs/qa/qa-round-3.md; no new browser validation is claimed for these review fixes.
