# Calculator

![CI](https://github.com/scaydogdu/calculator/actions/workflows/ci.yml/badge.svg)

A Go REST API with a React + TypeScript calculator. The backend performs arithmetic and validates mathematical domains; the frontend manages keypad input, requests and result formatting. No database is required.

## Setup and run

Requirements: Go 1.27+, Node.js 22.12 or newer, and npm. `.nvmrc` selects the Node 22.23.2 version used by CI and Docker; Node 24 is also supported.

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

[docs/openapi.yaml](docs/openapi.yaml) defines requests, responses and examples for `POST /api/v1/calculate` and `GET /healthz`. For example, using its `add` example:

```bash
curl http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","operands":[2,3]}'
```

```json
{"operation":"add","operands":[2,3],"result":5}
```

Supported operations: `add`, `subtract`, `multiply`, `divide`, `power`, `sqrt`, and `percentage`. Square root takes one operand; the others take two. Percentage means **a% of b**, `(a / 100) * b`.

Errors use `{"error":{"code":"...","message":"..."}}`: 400 for invalid requests, 404 for unknown API routes, 405 for unsupported calculation methods, **413 `request_too_large` for bodies over 1 MiB**, 422 for mathematical domain errors or overflow, and 500 for unexpected failures. Unknown fields, null operands, numeric strings and trailing JSON are rejected.

## Tests and checks

```bash
make test
make coverage
bash qa/api_contract_test.sh http://localhost:8080
```

The API contract script requires curl and jq. Coverage reports are written to `backend/coverage.html` and `frontend/coverage/index.html`. Frontend coverage must reach 95% lines, statements and functions, and 90% branches.

From `frontend`, run desktop/mobile Chromium regressions:

```bash
npx playwright install chromium
npm run test:e2e
```

This builds the frontend and starts Go on port 18080; keep that port free. Set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:18080` to test an existing production container instead.

CI runs Go vet, Staticcheck, govulncheck, race tests, frontend lint/type checking, production dependency audit, coverage and builds. It then starts the image, checks health, runs the API contract suite and browser tests. Failed browser checks retain traces/screenshots. Dependabot checks Go, npm and GitHub Actions dependencies weekly.

## Design decisions

- A pure reducer owns keypad input and left-to-right chaining: `2 + 3 × 4 =` gives `20`. Unrounded backend results are retained for subsequent operations; display formatting uses 12 significant digits for fractional or large values.
- TanStack Query mutations coordinate requests without retries or offline queuing. A transport helper enforces a 20-second deadline. AC and unmount abort requests; cancelled or superseded responses cannot update the display.
- IEEE-754 float64 is used throughout. Non-real and non-finite results are rejected; this is not arbitrary-precision decimal arithmetic.
- Buttons support keyboard activation and retain focus while busy. Digits, operators, Enter/`=`, Backspace, Escape/Delete and `r` (square root) have shortcuts. Only AC is active while a request is pending.
- Go uses the standard library for routing, JSON and logging. It bounds request bodies and read/write/idle time, shuts down gracefully, and disables directory listings.
- Production responses include `nosniff`, a same-origin Content Security Policy and `strict-origin-when-cross-origin` referrer policy. Development uses Vite's separate server.

Historical verification records and screenshots are in [docs/qa](docs/qa/README.md). AI usage is documented in [docs/prompts.md](docs/prompts.md).
