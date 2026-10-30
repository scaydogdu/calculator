# Coverage summary

Measured on 2026-10-30 with `make coverage`, against application revision `5839cdc` plus the accompanying error-message cleanup.

## Backend

| Package | Statement coverage |
|---|---:|
| Arithmetic and expression evaluation | 98.4% |
| HTTP API and middleware | 94.9% |
| Server entry point | 72.7% |
| **Total** | **93.2%** |

Backend tests passed with the race detector. They cover arithmetic and domain errors, request validation, response codes/messages, static serving, request limits and graceful shutdown.

## Frontend

**78 tests passed across 7 test files.**

| Metric | Coverage |
|---|---:|
| Lines | 99.28% (139/140) |
| Statements | 98.78% (162/164) |
| Branches | 97.82% (180/184) |
| Functions | 96.77% (30/31) |

All configured coverage thresholds passed: 95% lines, statements and functions; 90% branches. Tests exercise the API client, reducer, request lifecycle, keyboard interaction and error handling. The top-level `App` wrapper is not directly rendered; DOM bootstrap and test/setup files are excluded. Coverage measures automated test execution, not exhaustive browser behavior.

## Reproduce

From the repository root after installing the documented prerequisites and frontend dependencies:

```bash
make test
make coverage
npm run build --prefix frontend
```

Generated reports are available locally at `backend/coverage.html` and `frontend/coverage/index.html`. They stay out of Git; this summary provides the reviewer-visible results. Regenerate the measurements after changing application code.
