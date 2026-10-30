# Implementation progress

Plan: docs/superpowers/plans/2026-10-30-fullstack-calculator.md

Task 0: Go 1.27.3 and Node 22.23.2 already installed. Initialized codex/fullstack-calculator in the requested directory.
Ruling: Work in the explicitly requested fresh directory on a feature branch; no separate worktree is needed because no existing implementation or branch needs protection. Cost if wrong: move checkout later.
Pre-flight: Domain -> HTTP error classification and arity match; HTTP -> client request/response fields match; client -> hook -> UI CalculateFn signature matches; metadata -> validation/format/UI operation IDs and arity match; Go version -> Docker/CI will use installed 1.27 series.
Ruling: Replace Decoder.More with a second Decode requiring io.EOF and reject null numeric values; More is not a trailing-document validator and Go silently converts null to zero. Cost if wrong: stricter malformed-input rejection.
Ruling: Original assignment prompt is not available in the supplied files; prompts documentation will label that gap instead of inventing text. Cost if wrong: original prompt must be added later.
Docker daemon is currently stopped. No GitHub publication is authorized; Task 12 remains pending.

Task 1: complete. Domain tests observed failing on missing Operation, then passing with 100% coverage.

Task 2 Ruling: GET / conflicts with methodless /api/ in ServeMux (reproduced panic in TestServesStaticFiles); use methodless root handler and enforce GET/HEAD inside static handling. Cost if wrong: root method handling requires explicit tests.
Task 2: complete. HTTP tests observed failing before implementation; all domain and HTTP tests now pass under race detection.
Task 3: complete. run() test first failed on missing run; then exposed the plan test leaving response bodies open at shutdown. Drained/closed responses before cancellation; go vet and all backend race tests pass.
Task 4 Ruling: current Vite scaffold uses TypeScript 7 and oxlint; use ESLint as specified and TypeScript 6 supported by typescript-eslint. Pin Vitest and coverage to the same 5.0.5 version. Cost if wrong: future tool upgrades need validation.
Task 4 Ruling: privileged login shell selected Node 23 instead of available Node 22; explicitly select Node 22 for npm commands. Cost if wrong: local shell still needs Node 22 in PATH.
