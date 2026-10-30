# QA Acceptance Checklist

Codex implements the plan in `docs/superpowers/plans/2026-10-30-fullstack-calculator.md`. Claude runs QA against that plan and the assignment brief, and this file is what QA checks. Each item has a **how** (the command or check) and passes only with evidence: command output, a screenshot, or a file:line reference.

Severity used in QA reports: **Blocker** (requirement unmet, wrong result, crash), **Major** (edge case wrong, contract drift, missing test for key logic), **Minor** (style, docs, UX polish).

## 1. Repository and build hygiene

| # | Check | How |
|---|---|---|
| 1.1 | Repo layout matches the plan (`backend/cmd`, `backend/internal/{calculator,httpapi}`, `frontend/src/{api,features/calculator}`) | `tree -I node_modules` |
| 1.2 | No build artefacts or secrets committed (`node_modules`, `dist`, `coverage*`, `.env`) | `git ls-files \| grep -E 'node_modules\|dist/\|coverage\|\.env'` is empty |
| 1.3 | Backend has zero third-party deps | `backend/go.mod` has no `require` block |
| 1.4 | Clean clone builds | fresh `git clone` → `make test` passes |
| 1.5 | Small, conventional commits | `git log --oneline` |

## 2. Backend: static checks and unit tests

| # | Check | How |
|---|---|---|
| 2.1 | `gofmt` clean | `gofmt -l backend` is empty |
| 2.2 | `go vet` clean | `cd backend && go vet ./...` |
| 2.3 | Tests pass with the race detector | `go test ./... -race -count=1` |
| 2.4 | Coverage: `calculator` 100%, `httpapi` ≥ 90%, total ≥ 85% | `go test ./... -cover` |
| 2.5 | Tests are table-driven and use `errors.Is`, not string matching, for error kinds | code read |
| 2.6 | `main.go` stays thin, and `run()` is covered by an e2e test with graceful shutdown | code read + test output |

## 3. Backend: API contract (black-box)

Run `qa/api_contract_test.sh` against a running server, locally on `:8080` and in the Docker container. It covers:

- All 7 operations return the correct `result` and echo `operation` and `operands`.
- Float behaviour: `0.1+0.2` returns the raw float64. Formatting is the frontend's job.
- `422` errors: `division_by_zero` (including `0/0`), `negative_sqrt`, `result_out_of_range` (overflow, `(-8)^0.5`).
- `400` errors: `invalid_json` (malformed, empty body, string operand, `1e400`, unknown field, trailing data, array body), `unknown_operation` (missing or unknown op), `invalid_operands` (wrong arity, missing operands).
- `405` with `Allow: POST` on `GET /api/v1/calculate`, and a JSON `404` for unknown `/api/*` routes.
- A body over 1 MiB is rejected with `400`, not processed.
- Every error response has the shape `{"error":{"code":string,"message":non-empty}}` and `Content-Type: application/json`.
- `GET /healthz` returns `{"status":"ok"}`.

## 4. Frontend: static checks and unit tests

| # | Check | How |
|---|---|---|
| 4.1 | Lint, typecheck and build clean | `npm run lint && npm run typecheck && npm run build` |
| 4.2 | Tests pass | `npm test` |
| 4.3 | Coverage ≥ 90% lines on `src/api` and `src/features` | `npm run coverage` |
| 4.4 | No `any`, no `@ts-ignore`, no barrel files, no cross-layer imports (shared code must not import `features`) | `grep -rnE ': any\b\|@ts-ignore\|as any' src` + read |
| 4.5 | Tests query by role and label (Testing Library best practice), not by class or test id | code read |

## 5. Frontend: behaviour in the browser (manual, run by Claude in the browser pane)

Run with the backend on `:8080` and `npm run dev` on `:5173`, and again against the Docker image on `:8080`.

| # | Scenario | Expected |
|---|---|---|
| 5.1 | 2 + 3 → Calculate | `2 + 3 = 5` |
| 5.2 | 0.1 + 0.2 | `0.1 + 0.2 = 0.3` (formatted) |
| 5.3 | 1 ÷ 0 | alert: `division by zero`, page does not crash |
| 5.4 | √ selected | second input hidden, first labelled "Number"; √16 → `√16 = 4` |
| 5.5 | √ of -4 | alert with the negative sqrt message |
| 5.6 | 15 % of 200 | `15% of 200 = 30` |
| 5.7 | 2 ^ 1024 | overflow alert (`result_out_of_range` message) |
| 5.8 | Empty inputs → Calculate | "Enter a number." under each field, no network request |
| 5.9 | `abc`, `1,5`, `0x10` | "Not a valid number.", no network request |
| 5.10 | Backend stopped | "Could not reach the calculator service." (or the proxy's 5xx message), no blank screen |
| 5.11 | Fast double submit / switching operations mid-request | the last request wins, no stale result |
| 5.12 | Keyboard only: Tab through the fields, arrow keys across the operation radios, Enter submits | works, focus ring visible |
| 5.13 | Screen-reader semantics | inputs labelled, `aria-invalid` and `aria-describedby` on error, result in `aria-live` output, error is `role="alert"` |
| 5.14 | 375px mobile width | no horizontal scroll, tap targets ≥ 44px, 4-column operation grid |
| 5.15 | Dark mode | readable contrast, nothing invisible |
| 5.16 | No console errors or warnings during the above | `read_console_messages` |

## 6. Docker

| # | Check | How |
|---|---|---|
| 6.1 | Image builds from a clean checkout | `docker build -t calculator .` |
| 6.2 | Runs as non-root, distroless | `docker inspect` → `User` is `nonroot` |
| 6.3 | One container serves both the UI and the API | `curl localhost:8080/` returns 200 HTML; the API contract script passes against it |
| 6.4 | Image size is reasonable (< 30 MB) | `docker images calculator` |
| 6.5 | Stops cleanly on SIGTERM within 10 s | `time docker stop` |

## 7. CI

| # | Check | How |
|---|---|---|
| 7.1 | The workflow runs backend, frontend and docker jobs on push and PR | read `.github/workflows/ci.yml` |
| 7.2 | The workflow is green on GitHub after push | `gh run list --limit 1` |

## 8. Documentation (assignment deliverables)

| # | Check | How |
|---|---|---|
| 8.1 | README has setup instructions, how to run the frontend and backend, and the Docker steps | read |
| 8.2 | README API examples are copy-pasteable and their outputs match reality | run each curl and compare |
| 8.3 | README lists the design decisions and assumptions (percentage definition, status codes, float handling, no CORS, stdlib only) | read |
| 8.4 | `docs/coverage.md` numbers match a fresh `make coverage` run | compare |
| 8.5 | `docs/prompts.md` lists the prompts used, Codex prompts included | read |
| 8.6 | Commands in the README work verbatim from a fresh clone | run them |

## QA report format (per review round)

```
Round N — <commit sha>
Result: PASS | FAIL (x blockers, y majors, z minors)

[Blocker] 5.3 Division by zero shows blank screen
  Repro: …
  Evidence: …
  Location: frontend/src/features/calculator/Calculator.tsx:42
  Suggested fix: …
```
