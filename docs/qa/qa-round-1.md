# QA Round 1 — 5293eca (branch `codex/fullstack-calculator`)

**Result: FAIL — 1 blocker, 1 major, 3 minors**

### [Blocker] The UI isn't a calculator: there's no keypad (requirement "Intuitive UI for entering input and displaying results")
- **Raised by:** product owner, confirmed by QA.
- **Problem:** the UI is two text boxes, seven radio buttons and a "Calculate" button. Users expect a display and a keypad with 0–9, `.`, `+ − × ÷`, `=`, `AC`, backspace and `±`, plus `√`, `xʸ` and `%`, and keyboard input on desktop. Without a keypad, the app reads as a form-filling exercise.
- **Fix:** rebuild the UI from `docs/superpowers/plans/2026-10-30-keypad-ui.md` (spec + acceptance tests K1–K26). The redesign also covers the major and the three minor findings below, so fix them as part of it rather than separately. QA round 2 runs K1–K26 in the browser.

Environment: Docker image `calculator:latest` (built 2026-10-30 17:49, matches the code at HEAD), run on `:18080`. Browser: Claude desktop built-in browser at 1024×768 desktop and 375×812 mobile, in light and dark mode. Results were read from the DOM; screenshots were for layout only.

## Findings

### [Major] A stale result or error stays visible after a submit that fails validation
- **Checklist:** 5.8 / 5.11
- **Repro A:** Divide, 12 and 4, Calculate. The page shows `12 ÷ 4 = 3`. Change the first number to `12x` and Calculate. "Not a valid number." appears under the field, **and `12 ÷ 4 = 3` is still shown as the result**.
- **Repro B:** Divide, 1 and 0, Calculate. The alert `division by zero` appears. Change the first number to `x` and Calculate. The field error appears **and the `division by zero` alert stays**.
- **Evidence (DOM):** `{"field":"Not a valid number.","output":"12 ÷ 4 = 3","alert":null}` and `{"alertText":"division by zero", fieldError present}`
- **Location:** `frontend/src/features/calculator/Calculator.tsx:21-26`. The validation-failure branch returns without touching the calculation state. A request still in flight would also land after the failed submit.
- **Suggested fix:** add `reset()` to `useCalculation` that aborts any in-flight request and sets `{ status: 'idle' }`, and call it in the `!validated.ok` branch. Add a component test that runs a successful calculation, then submits invalid input and asserts the output is empty and no alert is shown.

### [Minor] Large integer-valued results are not trimmed to 12 significant digits
- **Checklist:** 5.2 (formatting)
- **Repro:** Add `123456789012345678901234567890.123` and `0.000000123456789`. The page shows `1.2345678901234568e+29 + 1.23456789e-7 = 1.2345678901234568e+29`, with 17 significant digits.
- **Location:** `frontend/src/features/calculator/format.ts:6`. `Number.isInteger(1.2e29)` is true, so the 12-digit rounding is skipped.
- **Suggested fix:** `Number.isInteger(n) && Math.abs(n) < 1e15 ? String(n) : String(Number(n.toPrecision(12)))`, plus a test case `[1.2345678901234568e29, '1.23456789012e+29']`.

### [Minor] Long results break mid-number on mobile
- **Checklist:** 5.14
- **Repro:** at 375px with the input above, the result wraps as `1.2345678901234568e+2` / `9 + …`.
- **Location:** `frontend/src/index.css:93` (`overflow-wrap: anywhere`)
- **Suggested fix:** use `overflow-wrap: break-word`, which breaks at spaces first. With the formatting fix above, each number fits on one line at 375px.

### [Minor] API error messages reach users as raw lowercase backend strings
- **Checklist:** 5.3 / 5.5 / 5.7 (UX polish)
- **Repro:** the alerts read `division by zero`, `square root of a negative number` and `result is not a finite number`. These are accurate but read like log lines, and "not a finite number" means little to most users.
- **Location:** `frontend/src/features/calculator/useCalculation.ts` (message taken from `ApiError.message`)
- **Suggested fix:** map the known `ApiError.code` values to UI copy, for example `division_by_zero` → "You can't divide by zero.", `negative_sqrt` → "Square root needs a number of 0 or more.", `result_out_of_range` → "The result is too large to show." Fall back to the server message for unknown codes, and update the tests.

## Passed

| # | Scenario | Evidence |
|---|---|---|
| 3 | API contract | `qa/api_contract_test.sh` 40/40, three runs in a row |
| 5.1 | 2 + 3 | `2 + 3 = 5` |
| 5.2 | 0.1 + 0.2 | `0.1 + 0.2 = 0.3` |
| 5.3 | 1 ÷ 0 | alert `division by zero`, no crash |
| 5.4 | √ | second input removed, label "Number", `√16 = 4` |
| 5.5 | √-4 | alert `square root of a negative number` |
| 5.6 | 15 % of 200 | `15% of 200 = 30` |
| 5.7 | 2 ^ 1024 | overflow alert |
| 5.8 | Empty inputs | "Enter a number." on both fields, `aria-invalid="true"`, `aria-describedby="a-error"`, 0 requests |
| 5.9 | `abc`, `1,5`, `0x10`, `Infinity` | "Not a valid number.", 0 requests |
| 5.10 | Backend stopped | "Could not reach the calculator service.", button resets |
| 5.11 | Slow 9×9 then fast 9+9 | final `9 + 9 = 18`; button "Calculating…" and disabled while pending |
| 5.12 | Keyboard | Tab order: a → operations → b → Calculate; arrows move through the radios; Enter submits (`7 ÷ 2 = 3.5`); 2px focus outline on radios |
| 5.13 | Semantics | `lang="en"`, one `h1`, `main`, fieldset with legend "Operation", `output aria-live="polite"`, `role="alert"`, every radio labelled |
| 5.14 | 375px | no horizontal scroll (scrollWidth 375), 4-column grid, smallest tap target 48px |
| 5.15 | Contrast | light: ≥ 5.5:1 for all text; dark: ≥ 6.5:1; error text 5.6 (light) / 7.0 (dark), all above WCAG AA |
| 5.16 | Console | only browser-native "Failed to load resource" lines for the intentional 422s and the stopped backend; no app errors or React warnings |
| 6.2 | Non-root | `User=nonroot:nonroot` |

## Not covered this round
- 5.x against the Vite dev server (`npm run dev`). Only the production build in Docker was tested.
- 7.2 hosted CI and 8.x docs review (README curl outputs vs reality). Planned for round 2.
- The `qa/` folder is still untracked. It should be committed as part of the deliverable.
