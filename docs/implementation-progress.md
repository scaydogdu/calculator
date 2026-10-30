# Implementation progress

Plan: docs/superpowers/plans/2026-10-30-fullstack-calculator.md

Task 0: Go 1.27.3 and Node 22.23.2 already installed. Initialized codex/fullstack-calculator in the requested directory.
Ruling: Work in the explicitly requested fresh directory on a feature branch; no separate worktree is needed because no existing implementation or branch needs protection. Cost if wrong: move checkout later.
Pre-flight: Domain -> HTTP error classification and arity match; HTTP -> client request/response fields match; client -> hook -> UI CalculateFn signature matches; metadata -> validation/format/UI operation IDs and arity match; Go version -> Docker/CI will use installed 1.27 series.
Ruling: Replace Decoder.More with a second Decode requiring io.EOF and reject null numeric values; More is not a trailing-document validator and Go silently converts null to zero. Cost if wrong: stricter malformed-input rejection.
Ruling: Original assignment prompt is not available in the supplied files; prompts documentation will label that gap instead of inventing text. Cost if wrong: original prompt must be added later.
Docker daemon is currently stopped. No GitHub publication is authorized; Task 12 remains pending.

Task 1: complete. Domain tests observed failing on missing Operation, then passing with 100% coverage.

Task 2 Ruling: GET / conflicts with methodless /api/ in ServeMux (reproduced panic in TestServesStaticFiles); use methodless root handler with the standard file server; an explicit GET/HEAD restriction remains deferred. Cost if wrong: root method handling requires explicit tests.
Task 2: complete. HTTP tests observed failing before implementation; all domain and HTTP tests now pass under race detection.
Task 3: complete. run() test first failed on missing run; then exposed the plan test leaving response bodies open at shutdown. Drained/closed responses before cancellation; go vet and all backend race tests pass.
Task 4 Ruling: current Vite scaffold uses TypeScript 7 and oxlint; use ESLint as specified and TypeScript 6 supported by typescript-eslint. Pin Vitest and coverage to the same 5.0.5 version. Cost if wrong: future tool upgrades need validation.
Task 4 Ruling: privileged login shell selected Node 23 instead of available Node 22; explicitly select Node 22 for npm commands. Cost if wrong: local shell still needs Node 22 in PATH.
Task 4: complete. Scaffold typecheck, production build, and empty test invocation passed on Node 22. npm audit reports zero vulnerabilities.
Task 5: RED verified; tests fail on missing feature modules.
Task 5: complete. Planned tests observed RED then GREEN; all frontend tests and typecheck pass.
Task 6: RED verified; tests fail on missing feature modules.
Task 6: complete. Planned tests observed RED then GREEN; all frontend tests and typecheck pass.
Task 7: RED verified; tests fail on missing feature modules.
Task 7: complete. Planned tests observed RED then GREEN; all frontend tests and typecheck pass.
Task 8: RED verified; tests fail on missing feature modules.
Task 8: complete. Planned tests observed RED then GREEN; all frontend tests and typecheck pass.
Task 8 verification limitation: local browser access was denied by browser permission policy; no browser screenshots or mobile/dark-mode checks were performed. Automated component tests, lint, typecheck and build pass. Independent QA API script passes 40/40 locally.
Task 9: complete. Docker build succeeded; container / returned 200 and power 2^10 returned 1024; independent API script 40 passed, 0 failed. User nonroot:nonroot; image 8,646,106 bytes; docker stop completed in 0.123 seconds. Host port 18080 used to avoid the local API on 8080. Docker Desktop started successfully after initial startup delay.
Task 10: complete. make test passed go vet/backend race, frontend lint/typecheck and 40 tests. make coverage: backend total 92.9%, domain 100.0%, HTTP 98.5%, cmd/server 72.7%; frontend lines 98.68%, statements 96.55%, branches 96.42%, functions 94.73%.
Task 11: README includes live API outputs and all design decisions; coverage.md contains fresh measured output; prompts.md quotes the available prompts and labels the missing original assignment. Task 12 intentionally not started.

## Task commit evidence

| Task | Commit | Verification |
|---|---|---|
| 0 | d25bfed | Go 1.27.3 already installed; initialized repository |
| 1 | ca1d898 | Domain RED missing Operation -> GREEN 100.0% coverage |
| 2 | a788c6c | HTTP RED missing NewServer -> GREEN race, 98.5% coverage |
| 3 | a19dab1 | Entry point RED missing run -> GREEN vet and all backend race tests |
| 4 | 10d702e | Typecheck, build, empty tests exit 0 |
| 5 | 4f5c698 | API RED missing module -> GREEN 5 passed |
| 6 | 4ea82e6 | Metadata/validation/format RED missing modules -> GREEN full suite 33 passed |
| 7 | 53eb3b5 | Hook RED missing module -> GREEN full suite 36 passed |
| 8 | f558bc6 | UI RED missing module -> GREEN 40 passed; lint/typecheck/build; browser check blocked |
| 9 | d01dab9 | Docker build, API 40 passed/0 failed, HTML200, nonroot, shutdown0.123s |
| 10 | 6740a9a | make test and make coverage passed |

QA ownership: `docs/qa/acceptance-checklist.md` content is unchanged from the initial repository snapshot. `qa/api_contract_test.sh` was supplied externally during implementation, remains untracked and unchanged, and was executed without modification.

Final review: independent read-only reviewer found no API contract drift, one important UI defect and one minor static-method mismatch.
Final: fixed stale result after operation change — deferred-response component test observed RED (old 16 + 3 = 19 output appeared after selecting sqrt), then GREEN; full suite 41/41, lint/typecheck/build passed. Folded fix into Task 8 to preserve one commit per task.
Final: minor (deferred): static root uses standard FileServer without an explicit GET/HEAD guard; calculation API method handling is correct. Execution record corrected to reflect actual behavior.
Final: Ruling: visual, mobile, dark-mode and real-browser accessibility checks cannot be judged after browser access was denied; keep them explicitly unverified. Cost if wrong: visual or browser-specific defects may remain.
Final: Ruling: hosted CI is unverified because publication is explicitly excluded; local equivalent checks and Docker ran. Cost if wrong: remote-only workflow issues may remain.
Final: Ruling: original assignment text remains unavailable; prompt record includes available prompts without reconstruction. Cost if wrong: historical prompt evidence needs supplying.

Task 11: complete. Fresh coverage and real API examples recorded; final make test, frontend build, rebuilt Docker and container acceptance checks passed. Task 12 remains unstarted.

Clean-clone verification: cloned committed repository into a temporary directory, npm ci reported zero vulnerabilities, make test passed all backend vet/race checks and 41 frontend tests, and npm run build passed. Final coverage after the regression fix is backend 92.9% statements and frontend 98.76% lines.
