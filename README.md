# Calculator

![CI](https://github.com/aydogdu/calculator/actions/workflows/ci.yml/badge.svg)

A full-stack calculator with a Go REST service and a React + TypeScript interface. Go performs all arithmetic and mathematical validation; the frontend records keypad input and formats results. The production image serves both layers from the same origin. GitHub publication and hosted CI have not been performed; the badge will become active after publication.

## Features

Addition, subtraction, multiplication, division, powers, square roots, and percentages. **Percentage means “a% of b”: `(a / 100) * b`.** The interface has a display and a four-column keypad with digits, decimal point, `AC`, backspace, sign toggle, operators and `=`. It supports desktop keyboard input, loading states, readable errors and light/dark system themes. Entries accept at most 15 digits and one decimal point, without leading zeros. Square root evaluates the displayed number; percentages mean “a% of b”.

Operations chain from left to right through the service: `2 + 3 × 4 =` first requests addition, then multiplies the returned `5` by `4` to display `20`. Entering digits after a result or error starts a fresh calculation. While a request is pending, only `AC` is active; it aborts the request and ignores any late response.

| Keyboard | Action |
|---|---|
| `0`–`9` | Enter digits |
| `.` or `,` | Decimal point |
| `+`, `-`, `*` or `x`, `/`, `^`, `%` | Add, subtract, multiply, divide, power, percent of |
| `Enter` or `=` | Equals |
| `Backspace` | Remove the last entered digit |
| `Escape` or `Delete` | All clear |
| `r` | Square root |

Ctrl/Meta shortcuts are left to the browser. Keys have accessible names, the selected operator exposes `aria-pressed`, values use a live `<output>`, and errors use `role="alert"`. Keys are at least 56px tall. The card is at most 360px wide, with long values shrinking and staying on one line.

Screenshot capture remains pending: a saved browser permission blocks access to the local app. No browser screenshot or visual mobile/dark-mode validation is claimed for the keypad redesign.

## Prerequisites

- Go 1.27+ (verified with 1.27.3); backend uses only the standard library.
- Node.js 22.12+ in the 22 series, or a supported newer LTS release, and npm (verified with Node 22.23.2).
- Docker, optional, for the single-container build.

## Run with Docker

From the repository root:

```bash
docker build -t calculator . && docker run --rm -p 8080:8080 calculator
```

Open http://localhost:8080. The final image uses distroless and runs as `nonroot:nonroot`. Stop with Ctrl+C; SIGTERM also triggers graceful shutdown.

## Run locally

Terminal 1, from the repository root:

```bash
make run-backend
```

Terminal 2, from the repository root:

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to Go on port 8080. For reproducible installs after cloning, use `npm ci` instead of `npm install`.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Go HTTP listening port |
| `STATIC_DIR` | empty | Directory containing the frontend build; empty means API only |

For a local production build without Docker:

```bash
cd frontend && npm ci && npm run build
cd ../backend && STATIC_DIR=../frontend/dist go run ./cmd/server
```

Then open http://localhost:8080.

## API

`POST /api/v1/calculate` takes a JSON object:

```json
{"operation":"add","operands":[2,3]}
```

A successful response (`200`, `Content-Type: application/json`) echoes the operation and operands with the raw float64 result:

```json
{"operation":"add","operands":[2,3],"result":5}
```

| Operation | Arity | Formula |
|---|---|---|
| `add` | 2 | a + b |
| `subtract` | 2 | a − b |
| `multiply` | 2 | a × b |
| `divide` | 2 | a ÷ b |
| `power` | 2 | a raised to b |
| `sqrt` | 1 | √a |
| `percentage` | 2 | (a / 100) × b |

Errors use `{"error":{"code":"...","message":"..."}}`.

| Status | Codes |
|---|---|
| 400 | `invalid_json`, `unknown_operation`, `invalid_operands` |
| 404 | `not_found` for unknown `/api/` routes |
| 405 | `method_not_allowed`; calculate endpoint includes `Allow: POST` |
| 422 | `division_by_zero`, `negative_sqrt`, `result_out_of_range` |
| 500 | `internal_error` |

Unknown fields, numeric strings, null operand elements, non-object bodies, trailing data, out-of-float64-range JSON numbers and requests over 1 MiB are rejected. Missing/unknown operations and wrong operand counts are request errors. A well-formed calculation that is mathematically undefined is a 422 error.

`GET /healthz` returns `{"status":"ok"}`.

### Examples captured from the running service

```bash
curl -s -X POST localhost:8080/api/v1/calculate -H 'Content-Type: application/json' -d '{"operation":"add","operands":[2,3]}'
```

HTTP 200:

```json
{"operation":"add","operands":[2,3],"result":5}
```

```bash
curl -s -X POST localhost:8080/api/v1/calculate -H 'Content-Type: application/json' -d '{"operation":"sqrt","operands":[144]}'
```

HTTP 200:

```json
{"operation":"sqrt","operands":[144],"result":12}
```

```bash
curl -s -X POST localhost:8080/api/v1/calculate -H 'Content-Type: application/json' -d '{"operation":"percentage","operands":[15,200]}'
```

HTTP 200:

```json
{"operation":"percentage","operands":[15,200],"result":30}
```

```bash
curl -s -X POST localhost:8080/api/v1/calculate -H 'Content-Type: application/json' -d '{"operation":"divide","operands":[1,0]}'
```

HTTP 422:

```json
{"error":{"code":"division_by_zero","message":"division by zero"}}
```

```bash
curl -s -X POST localhost:8080/api/v1/calculate -H 'Content-Type: application/json' -d '{"operation":"add","operands":["1",2]}'
```

HTTP 400:

```json
{"error":{"code":"invalid_json","message":"request body must be a JSON object like {\"operation\":\"add\",\"operands\":[1,2]}"}}
```

```bash
curl -s localhost:8080/healthz
```

HTTP 200:

```json
{"status":"ok"}
```

## Tests and coverage

```bash
make test
make coverage
```

`make test` runs Go vet/race tests and frontend lint/typecheck/tests. CI also builds the production frontend and Docker image. Coverage reports are written to `backend/coverage.html` and `frontend/coverage/index.html`; see [measured coverage](docs/coverage.md).

The independent acceptance suite can be run against a local service or container without modifying it:

```bash
bash qa/api_contract_test.sh http://localhost:8080
```

The `qa/` directory is maintained separately by QA and may be supplied alongside this checkout. The script requires curl and jq. Both local API and container runs passed all 40 checks. Keypad reducer acceptance K1–K26 and component click/keyboard/error/abort tests are automated. Browser validation remains blocked by a saved local-browser permission; mobile, dark-mode, visual layout and screenshot checks remain unverified. See [execution record](docs/implementation-progress.md).

## Project structure

```text
calculator/
├── .github/workflows/ci.yml
├── .gitignore, .dockerignore
├── Dockerfile
├── Makefile
├── README.md
├── docs/
│   ├── coverage.md
│   ├── prompts.md
│   ├── implementation-progress.md
│   ├── qa/acceptance-checklist.md
│   └── superpowers/plans/2026-10-30-fullstack-calculator.md
├── backend/
│   ├── go.mod
│   ├── cmd/server/main.go, main_test.go
│   └── internal/
│       ├── calculator/calculator.go, calculator_test.go
│       └── httpapi/
│           ├── server.go, server_test.go
│           ├── routes.go, respond.go
│           └── calculate.go, calculate_test.go
└── frontend/
    ├── package.json, package-lock.json
    ├── vite.config.ts, eslint.config.js, tsconfig*.json
    ├── index.html
    └── src/
        ├── main.tsx, App.tsx, index.css
        ├── test/setup.ts
        ├── api/calculator.ts, calculator.test.ts
        └── features/calculator/
            ├── operations.ts, operations.test.ts
            ├── keypadReducer.ts, keypadReducer.test.ts
            ├── keys.ts, Keypad.tsx, Display.tsx
            ├── format.ts, format.test.ts
            ├── useCalculation.ts, useCalculation.test.tsx
            └── Calculator.tsx, Calculator.test.tsx
```

## Design decisions and assumptions

1. One endpoint carries the operation in its body; the API client stays generic.
2. `operands: number[]` has operation-specific arity: square root takes one, the others two. Extra operands are rejected.
3. Every API error uses one envelope. Status 400 means a malformed request; 422 means mathematically undefined; API 404/405 responses are JSON.
4. Strict JSON decoding rejects unknown fields, trailing data and numeric strings, and enforces a 1 MiB limit. Null numeric elements are also rejected.
5. Non-finite results (`Inf`/`NaN`) are errors, because JSON cannot represent them.
6. The backend returns raw float64 and the reducer retains unrounded results for later operations, including after Equals or a sign change. Formatting affects display only. The frontend formats fractional and large integer-valued results to 12 significant digits to hide floating-point noise. Integers with magnitude below 1e15 retain their normal representation.
7. A pure keypad reducer restricts input to digits, one decimal point and at most 15 digits, with no leading zeros. The removed text fields and form validator are no longer needed: keypad input cannot contain malformed numeric text. The backend still validates every request, operand count and mathematical domain. The frontend performs no arithmetic; it records pending requests and uses returned results for chaining.
8. No CORS is needed: Vite proxies in development and Go serves the built frontend in production.
9. Go's standard library supplies routing, JSON and structured logging, keeping backend dependencies at zero.

Arithmetic follows IEEE-754 float64 semantics; it is not arbitrary-precision decimal arithmetic. Authentication, rate limiting and calculation history are out of scope. No database is needed. The server allows up to ten seconds for graceful shutdown.

## AI usage

See the [prompt record](docs/prompts.md) and [implementation plan](docs/superpowers/plans/2026-10-30-fullstack-calculator.md). The prompt record identifies unavailable historical prompts instead of reconstructing them.
