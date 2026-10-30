# Coverage report

Measured 2026-10-30 using `make coverage` with Go 1.27.3, Node 22.23.2 and Vitest 5.0.5. All 41 frontend tests passed. Coverage is measured, not an enforced CI threshold.

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

```text
% Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.73 |    96.42 |      95 |   98.76 |                   
 src               |       0 |      100 |       0 |       0 |                   
  App.tsx          |       0 |      100 |       0 |       0 | 4                 
 ...res/calculator |   97.33 |    95.83 |     100 |     100 |                   
  operations.ts    |   83.33 |       50 |     100 |     100 | 22                
  ...alculation.ts |   95.23 |    83.33 |     100 |     100 | 26                
-------------------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 96.73% ( 89/92 )
Branches     : 96.42% ( 54/56 )
Functions    : 95% ( 19/20 )
Lines        : 98.76% ( 80/81 )
================================================================================
```

The report includes all source modules except the DOM bootstrap (`main.tsx`), test setup and test files. Fully covered files may be omitted from Vitest's compact text table; consult the HTML report for complete per-file details. The top-level `App.tsx` wrapper is not rendered directly by the component tests. The unknown-operation metadata guard is unreachable for the typed valid operation union. The request hook's aborted-rejection branch is not separately covered; stale successful responses are covered.

Open `backend/coverage.html` and `frontend/coverage/index.html` after running `make coverage`. Generated report files are ignored by Git. Browser visual and mobile QA could not run because local-browser permission was denied; coverage does not establish visual correctness.
