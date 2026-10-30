# Coverage report

Measured 2026-10-30 using `make coverage` with Go 1.27.3, Node 22.23.2 and Vitest 5.0.5. All 83 frontend tests passed after the keypad redesign. Coverage is measured, not an enforced CI threshold.

## Backend

```text
ok  	github.com/aydogdu/calculator/backend/cmd/server	(cached)	coverage: 72.7% of statements
ok  	github.com/aydogdu/calculator/backend/internal/calculator	(cached)	coverage: 100.0% of statements
ok  	github.com/aydogdu/calculator/backend/internal/httpapi	(cached)	coverage: 98.5% of statements
total:										(statements)		92.9%
```

```text
github.com/aydogdu/calculator/backend/cmd/server/main.go:20:			main			0.0%
github.com/aydogdu/calculator/backend/cmd/server/main.go:30:			run			94.1%
github.com/aydogdu/calculator/backend/internal/calculator/calculator.go:58:	Calculate		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/calculate.go:25:		handleCalculate		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/calculate.go:59:		classify		85.7%
github.com/aydogdu/calculator/backend/internal/httpapi/respond.go:17:		writeJSON		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/respond.go:23:		writeError		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/routes.go:8:		addRoutes		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/routes.go:19:		handleHealth		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/routes.go:25:		handleMethodNotAllowed	100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/routes.go:32:		handleNotFound		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/server.go:12:		NewServer		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/server.go:26:		WriteHeader		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/server.go:31:		withLogging		100.0%
github.com/aydogdu/calculator/backend/internal/httpapi/server.go:40:		withRecover		100.0%
total:										(statements)		92.9%
```

The domain is fully covered. `main()` is not called directly because it installs process-level signal handling and can exit the test process; the real server is exercised through `run()` with an HTTP request and graceful cancellation. Default-port configuration and shutdown timeout/error paths are not all exercised. HTTP's default classification of an unexpected domain error is defensive and unexercised; all currently emitted domain errors are covered.

## Frontend

Keypad redesign measured with `npm run coverage`: 83 tests passed, including K1–K26, component click/keyboard/error/abort coverage, raw-result continuation and sign consistency regressions.

```text
% Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   98.01 |    96.93 |   96.55 |    99.2 |
 src               |       0 |      100 |       0 |       0 |
  App.tsx          |       0 |      100 |       0 |       0 | 4
 ...res/calculator |    98.5 |    96.77 |     100 |     100 |
  keypadReducer.ts |   97.77 |    95.45 |     100 |     100 | 50,75,81
  operations.ts    |   83.33 |       50 |     100 |     100 | 22
-------------------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 98.01% ( 148/151 )
Branches     : 96.93% ( 158/163 )
Functions    : 96.55% ( 28/29 )
Lines        : 99.2% ( 124/125 )
================================================================================
```

All calculator feature source lines are covered; overall frontend line coverage is 99.2%. The uncovered top-level App.tsx wrapper only mounts Calculator. Remaining defensive branches include an invalid programmatic digit action, zero-sign handling in a cached result and the unknown-operation metadata guard. Main DOM bootstrap, test setup and test files are excluded. Fully covered files may be omitted from Vitest's compact text table; consult the HTML report for complete per-file details.

Open `backend/coverage.html` and `frontend/coverage/index.html` after running `make coverage`. Generated reports are ignored by Git. Backend coverage above is the unchanged backend's prior measured result. Browser screenshots and mobile/dark-mode visual QA remain blocked by a saved permission for the local app; coverage does not establish visual correctness.
