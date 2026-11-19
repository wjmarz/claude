# The Investor — visual upgrade and light depth (design)

## Intent
The game is presented to a class on a projector; the student clicks through
and explains each step. It should look polished and readable from the back of
the room, and be slightly deeper, without changing the original structure.

## Goals
- Projector-friendly look: dark navy "trading floor" theme, large high-contrast
  type, large choice buttons.
- Money bar on every screen (Cash / Invested / Total), with gains in green and
  losses in red, briefly animated when values change.
- Recap line at the top of each decision screen explaining what the previous
  choice did and why it matters (talking point for the presenter).
- Results screen chart: the player's total by stage vs. two benchmarks
  ("bought the index fund and held", "kept it all in savings").
- "Invest $2,000 more" is shown as unavailable when the player has under $2,000 cash.

## Non-goals / anti-goals
- No random events (presenter must be able to rehearse a predictable run).
- No new decisions or passages beyond the existing six; existing numbers and
  scoring unchanged.
- Must stay a normal Twine/Harlowe file the student can re-import and edit.
  No external CDNs (classroom network may block them).

## Approaches
1. Lessons + "what if" chart (chosen) — supports narration, makes takeaway visible.
2. Random market events — rejected: unpredictable in a live presentation.
3. Splitting money across options — rejected: more to explain, more clicking.

## How (builder's calls)
- Styling in the Twine story stylesheet; chart and money-bar animation via the
  story JavaScript, drawn as inline SVG (no libraries).
- Harlowe variables: `$history` (array of totals per stage), `$recap` (text).
- Benchmark lines computed from the game's fixed percentages.
