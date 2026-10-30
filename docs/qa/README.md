# QA history

These records describe earlier revisions; the current API contract is in [OpenAPI](../openapi.yaml).

Independent [QA round 2](qa-round-2.md) verified all K1–K26 in the browser, mobile layout at 375px, light/dark contrast and console behavior for commit `19f31fd`. Its two keyboard accessibility majors are covered by regression tests and fixed in this revision. [QA round 3](qa-round-3.md) verified the Enter/focus fixes and regression scenarios in the rebuilt container, with no remaining findings.

The committed `qa/` directory contains the contract script, which requires curl and jq. [QA round 2](qa-round-2.md) records browser K1–K26, mobile/light/dark checks, the rebuilt container’s 40/40 contract results and all six README API examples. The QA reports are preserved verbatim. [QA round 3](qa-round-3.md) records the completed browser rerun, desktop/mobile screenshots and successful verification of all round-2 fixes. The corrected Enter/focus behavior also has automated component regressions; see the [execution record](../implementation-progress.md) for implementation history.
