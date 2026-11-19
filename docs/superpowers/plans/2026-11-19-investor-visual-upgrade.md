# The Investor — Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `The Investor.html` projector-friendly and slightly deeper (recaps, money bar, results chart) without changing its six passages or numbers.

**Architecture:** All changes live inside the Twine 2 / Harlowe 3.3.9 file: passage text, the story stylesheet (`#twine-user-stylesheet`) and story JavaScript (`#twine-user-script`). A `footer`-tagged passage renders the money bar after each passage body (so it shows post-calculation values); CSS moves it to the top. Passages print data into `data-*` attributes; the story JavaScript reads them to animate the bar and draw an inline-SVG chart.

**Tech Stack:** Twine 2.12 / Harlowe 3.3.9, plain CSS, vanilla JS + inline SVG, Playwright (pre-installed) for tests.

**Spec:** `docs/superpowers/specs/2026-11-19-investor-visual-upgrade-design.md`

## Global Constraints

- Keep the six passages (Start, Choice1, Market, Opportunity, Final Choice, Ending), their choices, percentages and score changes.
- No external network resources (no CDNs, no web fonts).
- Passage text inside `<tw-passagedata>` must be HTML-escaped (`&` `<` `>` `"`) so Twine re-imports cleanly.
- Readable on a projector: body text ≥ 28px and choice buttons ≥ 24px at 1920×1080; no horizontal scroll at 1280×720.
- No random elements; same clicks always give the same result.

## Review Focus

- Undo (Harlowe's ↶ button) after a choice: the money bar and history must reflect the restored state, not double-append. (Covered in Task 1 test `undo keeps history length`.)
- Clicking "Play again" then playing a second run: history and recap reset. (Task 1 test `replay resets`.)
- Savings route on the market-drop screen: Invest $2,000 is available and works (cash 10000 → 8000). (Task 1 route D.)
- Projector at 1280×720: last choice button visible without scrolling the page sideways. (Task 2 test.)
- Totals with commas (e.g. "$11,200") in the bar and chart labels, not "$11200". (Task 2/3 tests.)

---

### Task 1: Passage logic — recaps, history, $2,000 fix, test harness

**Files:**
- Modify: `The Investor.html` (passages 1–6)
- Create: `tests/play-investor.js` (Node + Playwright, run with `node tests/play-investor.js`, exits non-zero on failure)

**Interfaces:**
- Produces: Harlowe vars `$history` (array of totals: Start, after crash, after hype, year 5), `$recap` (string, "" on Start). Ending renders `<div class="chart" data-path="v1,v2,v3,v4"></div>`.
- Produces: helper `play(route: number[]) -> {text, errors, page}` in the test file, where indexes pick among the choice links of each of the 4 decision screens.

- [ ] **Step 1: Write failing tests** — routes and expected final totals:
  - A `[1,1,1,0]` index/hold/stay/stay invested → `$11,200`, data-path `10000,8000,8000,11200`
  - B `[2,0,2,2]` savings/sell/cash/sell all → `$10,500`
  - C `[0,1,0,1]` one company/hold/chase/move savings → `$8,840`; on its Market screen the $2,000 option shows "Not enough cash" and is not a link
  - D `[2,2,1,0]` savings/invest $2,000/stay/stay invested → `$11,200`
  - every route: zero `tw-error` elements, zero page errors; Market screen shows a recap sentence (`.recap` non-empty)
  - `undo keeps history length`: route A to Ending, press undo, redo choice → data-path still has 4 values
  - `replay resets`: after Ending click "Play again" → Start has no `.recap`
- [ ] **Step 2: Run** `node tests/play-investor.js` → FAIL (no `.recap`, no `.chart`).
- [ ] **Step 3: Implement** — Start sets `$history to (a: 10000)` and `$recap to ""`; each choice link sets `$recap` to a one-sentence explanation before `(go-to:)`; Market appends total after the drop, Final Choice appends at top, Ending appends at top; decision passages begin with `(if: $recap is not "")[<div class="recap">$recap</div>]`; Market wraps the $2,000 link in `(if: $cash >= 2000)` with an `(else:)` disabled `<span class="choice disabled">`.
- [ ] **Step 4: Run** tests → PASS.
- [ ] **Step 5: Commit** `feat: add recaps, money history and $2,000 guard`.

### Task 2: Projector theme and money bar

**Files:**
- Modify: `The Investor.html` (stylesheet, script, new passage `MoneyBar` tagged `footer`)
- Modify: `tests/play-investor.js`

**Interfaces:**
- Consumes: `$cash`, `$invested`.
- Produces: `<div class="money-bar" data-cash data-invested>` rendered by `MoneyBar` (hidden on Start); JS `formatMoney(n: number) -> string` ("$11,200"), reused by Task 3.

- [ ] **Step 1: Tests** — at 1920×1080 on Market (route A): `.money-bar` Total text is `$8,000`, Invested shows a red "down" state class; choice buttons computed font-size ≥ 24px, body ≥ 28px; at 1280×720 `document.documentElement.scrollWidth <= 1280`; Start has no visible `.money-bar`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — dark navy theme (system font stack), links styled as full-width buttons, footer bar pinned to top via flex `order`; JS MutationObserver on `tw-story` compares new bar values to previous ones, counts numbers up over ~600ms and adds `up`/`down` classes.
- [ ] **Step 4: Run** → PASS. Take 1920×1080 screenshots of each screen and look at them.
- [ ] **Step 5: Commit** `feat: projector theme and money bar`.

### Task 3: Results chart

**Files:** Modify `The Investor.html` (script, stylesheet); `tests/play-investor.js`.

**Interfaces:** Consumes `.chart[data-path]` (Task 1), `formatMoney` (Task 2).

- [ ] **Step 1: Tests** — on Ending (route A): `.chart svg` exists with 3 `polyline`s of 4 points each; legend contains "Your path", "Index fund & hold", "All savings"; final-value label reads `$11,200`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `drawChart(el: Element)` — benchmark series fixed: index & hold `10000,8000,8000,11200`; all savings `10000,10000,10000,10500`; x labels `Start, Crash, Hype, Year 5`; player's line thick and bright, benchmarks dashed and muted.
- [ ] **Step 4: Run** → PASS; screenshot Ending and review.
- [ ] **Step 5: Commit** `feat: results chart comparing strategies`, push branch.
