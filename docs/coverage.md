# Coverage summary

Measured on 2026-10-30 after the handler split and queued-input changes, using `go test ./... -race -coverprofile=coverage.out` and `npm run coverage`.

## Backend

| Package | Statement coverage |
|---|---:|
| Arithmetic and expression evaluation | 98.4% |
| HTTP API and middleware | 95.1% |
| Server entry point | 72.7% |
| **Total** | **93.4%** |

Backend tests passed with the race detector. They cover arithmetic and domain errors, request validation, response codes/messages, static serving, request limits and graceful shutdown.

## Frontend

**110 tests passed across 7 test files**, including the 26 table-driven keypad acceptance cases and queued-input lifecycle regressions.

| Metric | Coverage |
|---|---:|
| Lines | 99.32% (147/148) |
| Statements | 98.83% (170/172) |
| Branches | 97.81% (179/183) |
| Functions | 96.87% (31/32) |

All configured coverage thresholds passed: 95% lines, statements and functions; 90% branches. Tests exercise the API client, reducer, request lifecycle, keyboard interaction and error handling. The top-level `App` wrapper is not directly rendered; DOM bootstrap and test/setup files are excluded. Coverage measures automated test execution, not exhaustive browser behavior.

## Reproduce

From the repository root after installing the documented prerequisites and frontend dependencies:

```bash
make test
make coverage
npm run build --prefix frontend
```

Generated reports are available locally at `backend/coverage.html` and `frontend/coverage/index.html`. They stay out of Git; this summary provides the reviewer-visible results. Regenerate the measurements after changing application code.
