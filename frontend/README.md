# Calculator frontend

React and TypeScript interface for the Go calculator API. The keypad uses a pure reducer for input transitions and an event-driven hook for requests, cancellation and the 20-second deadline.

From this directory:

```bash
npm ci
npm run dev
```

Start the Go service on port 8080 in a separate terminal. Vite serves the frontend on port 5173 and proxies `/api` to the service.

```bash
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
```

See the [project README](../README.md) for backend setup, Docker, browser tests, API examples and design decisions, and the [coverage summary](../docs/coverage.md) for measured results.
