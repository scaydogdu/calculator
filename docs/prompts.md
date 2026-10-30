# AI assistance and selected prompts

Built with AI assistance (Codex implementation, Claude review); ~6 hours elapsed.

Selected excerpts from the development prompts:

> Follow TDD exactly as written, and make one commit per task with the commit messages given.

> Don’t change the API contract (endpoint, field names, error codes, status codes): QA tests it independently with qa/api_contract_test.sh and docs/qa/acceptance-checklist.md.

> Read docs/qa/qa-round-2.md and fix the two majors and two minors with TDD, writing a failing component test for each major first.

> Type `9 + 16 √x =` and you get `4` instead of `13`.

These requests guided implementation, independent QA and regression fixes. Setup, design decisions and validation commands are in the [README](../README.md); measured coverage is in the [coverage summary](coverage.md).
