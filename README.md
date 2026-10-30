# Calculator

![CI](https://github.com/scaydogdu/calculator/actions/workflows/ci.yml/badge.svg)

A Go REST API with a React + TypeScript calculator. The backend performs arithmetic and validates mathematical domains; the frontend manages keypad input, requests and result formatting. No database is required.

## Setup and run

Requirements: Go 1.27.3+, Node.js 22.12 or newer, and npm. `.nvmrc` selects the Node 22.23.2 version used by CI and Docker; Node 24 is also supported.

From the repository root, start the API:

```bash
make run-backend
```

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to Go on port 8080.

For a production container:

```bash
docker build -t calculator .
docker run --rm -p 8080:8080 calculator
```

Open http://localhost:8080. The image serves both layers from one origin and runs as a non-root user. Stop with Ctrl+C.

| Server variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP listening port |
| `STATIC_DIR` | empty | Frontend build directory; empty serves only the API |

Without Docker, run `npm run build` from `frontend`, then `STATIC_DIR=../frontend/dist go run ./cmd/server` from `backend`.

## API

[docs/openapi.yaml](docs/openapi.yaml) defines requests, responses and examples for `POST /api/v1/evaluate`, `POST /api/v1/calculate` and `GET /healthz`. Evaluate a chained expression:

```bash
curl http://localhost:8080/api/v1/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"operands":[2,3,4],"operators":["add","multiply"]}'
```

```json
{"operands":[2,3,4],"operators":["add","multiply"],"result":14}
```

Both endpoints return the request fields plus `result`. `/evaluate` handles ordered binary expressions; a single operand needs no operators (omitted/null operators normalize to `[]`). To preserve existing API clients, `/calculate` remains the single-operation endpoint, including square root, for example `{"operation":"sqrt","operands":[144]}` returns `{"operation":"sqrt","operands":[144],"result":12}`. Supported operations: `add`, `subtract`, `multiply`, `divide`, `power`, `sqrt`, and `percentage`. Square root takes one operand; the others take two. Percentage means **a% of b**, `(a / 100) * b`.

Errors use `{"error":{"code":"...","message":"..."}}`: 400 for `invalid_json`, `unknown_field`, `unknown_operation`, `invalid_operands` or `invalid_expression`, 404 for unknown API routes, 405 for unsupported calculation methods, **413 `request_too_large` for bodies over 1 MiB**, 422 for `division_by_zero`, `negative_sqrt`, `non_real_result` or `result_overflow`, and 500 for unexpected failures. Unknown fields, null operands, numeric strings and trailing JSON are rejected.

## Tests and checks

```bash
make test
make coverage
bash qa/api_contract_test.sh http://localhost:8080
```

The API contract script requires curl and jq. The committed [coverage summary](docs/coverage.md) records measured results and reproduction commands. Generated reports are written to `backend/coverage.html` and `frontend/coverage/index.html`. Frontend coverage must reach 95% lines, statements and functions, and 90% branches.

From `frontend`, run desktop/mobile Chromium regressions:

```bash
npx playwright install chromium
npm run test:e2e
```

This builds the frontend and starts Go on port 18080; keep that port free. Set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:18080` to test an existing production container instead.

CI runs Go vet, Staticcheck, govulncheck, race tests, frontend lint/type checking, production dependency audit, coverage and builds. It then starts the image, checks health, runs the API contract suite and browser tests. Failed browser checks retain traces/screenshots. Dependabot checks Go, npm and GitHub Actions dependencies weekly.

## Design decisions

- A pure reducer records the expression until Equals; Go evaluates powers first (right associative), then multiplication/division/percent-of, then addition/subtraction (left associative): `2 + 3 × 4 = 14`, `2 ^ 3 ^ 2 = 512`. Expressions allow up to 128 operands. Square root applies immediately to the displayed operand. After an operator, that is the selected preceding operand: `9 + √x` becomes `3 +`, and `9 + √x 4 =` gives `7`. To take the root of a new right operand, enter it first: `9 + 16 √x = 13`. Signed operands are shown in parentheses: `(-2) ^ 2 = 4`. Unrounded backend results are retained for subsequent operations; fractional or large results use 12 significant digits. Rounded whole-number digits are shown in scientific notation, for example `-1.76366841446e+13`; exact integers below 1e15 retain all their digits.
- A synchronous ref holds the latest pure-reducer snapshot so rapid input events cannot read stale state; React state renders that same component-local snapshot.
- Input events call one controller hook directly. It applies pure keypad transitions and sends each submitted calculation to the backend using native `fetch`, without caching or automatic retries. One request controller enforces a 20-second deadline, aborts on AC/unmount and ignores late replies. Offline requests fail instead of being queued.
- IEEE-754 float64 is used throughout. Non-real and non-finite results are rejected; this is not arbitrary-precision decimal arithmetic.
- Buttons support keyboard activation and retain focus while busy. Digits, operators, Enter/`=`, Backspace, Escape/Delete and `r` (square root) have shortcuts. Input entered while a request is pending is queued and replayed in order after success; `2 + 3 = × 2 =` gives `10` even when typed quickly. AC immediately cancels the request and clears queued input. Errors, timeouts and unmounting also discard queued input. Long numbers shrink to fit narrow displays, keeping every typed digit visible without horizontal scrolling.
- Go uses the standard library for routing, JSON and logging. The minimum version and container build use the patched Go 1.27.3 release. It bounds request bodies and read/write/idle time, shuts down gracefully, and disables directory listings.
- Production responses include `nosniff`, a same-origin Content Security Policy and `strict-origin-when-cross-origin` referrer policy. Development uses Vite's separate server.

AI attribution and selected prompt excerpts are in [docs/prompts.md](docs/prompts.md).
