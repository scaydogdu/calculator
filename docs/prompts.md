# AI-assisted development: selected prompts

AI assistance was used for planning, implementation, test design and review. The excerpts below focus on the engineering work; they are shortened for readability, with machine-specific paths omitted. Outcome notes are summaries, not additional prompts.

## Project brief

Build a full-stack calculator with a React frontend and a Go REST API. Prioritize correctness, readable code, testable architecture and clear documentation. Required operations are addition, subtraction, multiplication and division; power, square root, percentage and Docker deployment are optional extensions.

## 1. Planning

> first step is to check github repositories for best practices and then come up with a plan.

The resulting [implementation plan](superpowers/plans/2026-10-30-fullstack-calculator.md) separates arithmetic, HTTP handling, frontend API access and UI state, with tests and validation steps for each task.

## 2. Implementation with TDD and a stable API contract

> Implement docs/superpowers/plans/2026-10-30-fullstack-calculator.md … task by task, in order. Follow TDD exactly as written, and make one commit per task with the commit messages given. Don’t change the API contract (endpoint, field names, error codes, status codes): QA tests it independently with qa/api_contract_test.sh and docs/qa/acceptance-checklist.md. Don’t edit anything under `qa/` or `docs/qa/`.

Implemented the Go arithmetic and HTTP layers, React API client and interface, tests, Docker image and CI. Input validation covers malformed JSON, operand counts, division by zero, negative square roots and non-finite results. The independent contract suite checks the service through HTTP.

## 3. Keypad UI redesign

> Read docs/qa/qa-round-1.md, then implement docs/superpowers/plans/2026-10-30-keypad-ui.md with TDD (reducer tests K1–K26 first). It replaces the Task 8 form UI and covers all round-1 findings. Don’t change the backend or `src/api`. Don’t edit `qa/` or `docs/qa/`. Commit when lint, typecheck, tests, build and the contract script all pass, and report the SHA.

Replaced the form with a display and keypad driven by a pure reducer. Tests cover input editing, operation chaining, decimal handling, keyboard shortcuts, errors and cancellation. Arithmetic remains on the backend; the frontend retains raw results for continuation and formats them for display.

## 4. QA-driven accessibility fixes

> Read docs/qa/qa-round-2.md and fix the two majors and two minors with TDD, writing a failing component test for each major first. Note that the Enter rule in docs/superpowers/plans/2026-10-30-keypad-ui.md has been corrected. Don’t touch the backend, `src/api`, `qa/` or `docs/qa/`.

Added failing component regressions before fixing native Enter/Space activation and focus retention during requests. Improved light-mode key visibility. Independent [QA round 3](qa/qa-round-3.md) records browser verification and screenshots for that revision.

## 5. Correctness and resilience review

Selected excerpts from the whole-codebase review:

> Type `9 + 16 √x =` and you get `4` instead of `13`.

> If the server answers with a page that isn’t data (a misconfigured proxy, for example), the screen stays on “Calculating…” until you press AC.

> 7% of 100 returns `7.000000000000001`, and 29% of 100 returns `28.999999999999996`.

Regression tests drove fixes for unary operations inside binary expressions, malformed response handling and percentage evaluation. The broader review also addressed sign editing, error descriptions, request-body timeouts, static directory listings and unused code. Existing API status and error codes were preserved.

Further testing exposed an indefinitely pending request. A 20-second client deadline now releases the keypad and displays a retry message. Tests cover cancellation, late responses, successful retry and timer cleanup.

## Validation and supporting records

The workflow used failing regressions followed by implementation and passing checks. Validation includes Go vet/race tests, frontend lint/typecheck/tests, production builds, coverage measurement, Docker checks and the independent API contract suite.

- [README: setup, API examples and design decisions](../README.md)
- [Measured test coverage](coverage.md)
- [Implementation history](implementation-progress.md)
- [Independent QA reports](qa/qa-round-3.md)
