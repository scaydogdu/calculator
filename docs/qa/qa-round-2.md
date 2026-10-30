# QA Round 2: 19f31fd (branch `codex/fullstack-calculator`, keypad redesign)

**Result: FAIL (0 blockers, 2 majors, 2 minors).** Every round-1 finding is fixed and all 26 keypad acceptance tests pass in the browser. The two majors are keyboard-accessibility defects, and one of them traces back to the QA spec itself (see the first finding).

Environment: Docker image rebuilt from `19f31fd` and run on `:18080`. Browser: the Claude desktop built-in browser at 1024×768 and 375×812, in light and dark mode. Input was real mouse clicks and real key presses (`keydown`). State was read from the DOM, and API calls were captured by wrapping `fetch`.

## Automated checks (re-run by QA)

| Check | Result |
|---|---|
| `go vet`, `go test ./...` | pass |
| `npm run lint`, `npm run typecheck` | pass |
| `vitest --coverage` | 83/83 passed. Lines 99.2%, statements 98.0%, branches 96.9% |
| `qa/api_contract_test.sh` against the rebuilt container | 40/40 |
| README curl examples, run against the container | all 6 outputs match the README verbatim |

## Round-1 findings: all fixed

| Round-1 finding | Status | Evidence |
|---|---|---|
| [Blocker] No keypad | Fixed | 4-column keypad matching the spec layout. All 22 keys have correct accessible names. |
| [Major] Stale result after a failed submit | Fixed (by design) | Keypad input can't be malformed, and a new digit clears an old result or error (K10, K19). |
| [Minor] Large integers not trimmed to 12 digits | Fixed | `999999999999999 × 999999999999999` shows `1e+30` |
| [Minor] Long values wrap mid-number | Fixed | 15-digit entry shrinks to a 24px font and stays on one line at 375px. Results are 37.5px, on one line. |
| [Minor] Raw backend error strings | Fixed | "You can't divide by zero.", "Square root needs a number of 0 or more.", "That result is too large to show.", "Couldn't reach the calculator service. Try again." |

## Keypad acceptance K1–K26: 26/26 pass

| # | Observed (expression / value / error) |
|---|---|
| K1 | `` / `0` |
| K2 (mouse) | `2 + 3 =` / `5`; after `+` the Add key has `aria-pressed="true"` |
| K3 (mouse) | `5 ×` after `×`, then `5 × 4 =` / `20`. API calls: add [2,3], then multiply [5,4] |
| K4 | `2 ×` / `2`, Multiply pressed |
| K5 | `2 +` / `2`, 0 API calls |
| K6 (`r`) | `√9 =` / `3` |
| K7 | `15% of 200 =` / `30` |
| K8 (Enter) | `2 ^ 10 =` / `1024` |
| K9 | `1 ÷ 0` / `0` / "You can't divide by zero." |
| K10 | `` / `7`, error cleared |
| K11–K13 | `0.5`, `1.2`, `7` |
| K14–K16 | `12`, `0`, and backspace after a result leaves `5` |
| K17 | `-5`, `5`, and `0` stays `0` |
| K18 | 15 digits accepted, the 16th ignored |
| K19–K20 | `7` (new calculation); `5 × 2 =` / `10` |
| K21–K22 | AC resets. With a 1.5 s delayed response: the display shows "Calculating…" and the calculator has `aria-busy`, a digit pressed while pending is ignored, AC (key or click) aborts, and the late response is ignored. |
| K23 (backend stopped) | `2 + 3` / `3` / "Couldn't reach the calculator service. Try again." |
| K24–K26 | `√-4` with the negative-sqrt message; `2 ^ 1024` with the overflow message; `0.1 + 0.2 =` / `0.3` |

Exploratory cases, all passing: `(1 ÷ 3) × 3 =` gives `1` (unrounded results are reused when chaining); `2 + 3 = =` stays `5`; `.` after a result gives `0.`; an operator after an error continues from `0` (`0 + 2 =` / `2`).

## Findings

### [Major] Enter on a focused key runs `=` instead of pressing that key
- **Checklist:** 5.12 (keyboard only)
- **Repro:** Tab to the `8` key and press Enter. Nothing is entered: the display stays `0`, because Enter was treated as `=` with no operator. Space on the same key does enter `8`. A screen-reader or keyboard user who presses Enter on `7`, `+` or `AC` gets `=` instead.
- **Expected:** a focused `<button>` activates on both Enter and Space (WAI-ARIA button pattern). The Enter-means-`=` shortcut should apply only when focus isn't on a key.
- **Location:** `frontend/src/features/calculator/Calculator.tsx:46-51` (document `keydown` maps Enter to `equals` and calls `preventDefault()`), and `keys.ts:47`.
- **Root cause:** the QA spec (`2026-10-30-keypad-ui.md`, keyboard table) told the implementer to `preventDefault` on Enter. That was a QA spec error; the implementation followed it faithfully.
- **Fix:** at the top of `onKeyDown`, add `if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement) return;` so the browser's native button activation runs. Add a component test: Tab or focus the `7` button, `user.keyboard('{Enter}')`, and expect the value to be `7`.

### [Major] Keyboard focus is lost after every calculation
- **Checklist:** 5.12 / 5.13
- **Repro:** focus the `=` key, press `2 + 3`, then Space. The result shows `5`, but `document.activeElement` is now `<body>`. A keyboard user has to Tab through the keypad from the start after every calculation. The same thing happens to whichever key has focus when a request starts.
- **Location:** `frontend/src/features/calculator/Keypad.tsx:21`. The `disabled={busy && key.action.type !== 'clear'}` attribute disables the focused button while the request is pending, and the browser drops its focus.
- **Fix:** don't use the `disabled` attribute while busy. Use `aria-disabled={busy && key.action.type !== 'clear' ? true : undefined}`, plus a dimmed style. The reducer already ignores every action except `clear` while pending, so behaviour doesn't change. Add a component test: click `=` while an API response is pending and expect the `=` button to still be `document.activeElement` after it resolves.

### [Minor] In light mode, digit keys don't look like buttons
- **Checklist:** 5.14 / 5.15 (affordance)
- **Repro:** in light mode, keys 0–9 and `.` have a `#fff` background, a transparent border and no shadow, on a `#fff` card. They read as plain numbers, not tappable keys. In dark mode the tiles are visible.
- **Location:** `frontend/src/index.css:6` (`--digit: #fff`) and `:50` (`.key-digit`)
- **Fix:** give digits a subtle fill one step off the card (for example `#f3f4f6`), or a 1px `--border` hairline, so all 22 keys read as one grid.

### [Minor] The README still says browser validation was never done
- **Location:** `README.md:25` and `README.md:190`
- **Fix:** replace those notes with a link to `docs/qa/qa-round-2.md`, and add the screenshot once the two majors are fixed. Also commit `qa/` and `docs/qa/`, which are still untracked, so reviewers can run the contract test themselves.

## Passed (non-functional)

| Area | Evidence |
|---|---|
| Accessibility semantics | `<output aria-live="polite">` for the value, `role="alert"` for errors, a `section` labelled "Calculator" with `aria-busy` while pending, `aria-pressed` on the active operator, all 22 keys named |
| Tab order | AC → ⌫ → % → ÷ → √x → xʸ → ± → × → 7 → 8 … (row order) |
| Mobile 375px | no horizontal or vertical scroll (scrollWidth 375, scrollHeight 812), smallest key 56px |
| Contrast, light | digits 16.1, functions 5.5, operators 13.8, `=` 5.9, expression 6.3 (all ≥ 4.5 AA) |
| Contrast, dark | digits 11.5, functions 5.9, operators 9.2, `=` 9.3, error text 8.4 |
| Console | only browser-native "Failed to load resource" lines for the deliberate 422s and the stopped backend, with no app errors or React warnings |

## Open after this round
- Task 12 (publish to GitHub and check hosted CI) hasn't started and needs your go-ahead.
- `docs/prompts.md` still lacks the original assignment prompt. QA can supply the exact text.
