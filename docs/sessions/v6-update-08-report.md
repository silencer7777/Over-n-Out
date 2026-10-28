# V6 Update 8 — REPORT (slim hotfix: mobile landscape)

Built and pushed live Wed Oct 28, 2026 under the Oct 28
auto-push law (gates green → push, no tap). Trigger: Brett's
04:27 playtest of live Update 7 — scopes confirmed ("works and
is pretty cool", focus-queue item 1 closed), mobile portrait
too cramped, landscape switching requested "real quick".
Refined 04:30: landscape must be **automatic** — the game
adjusts the moment the phone flips, from game start, no manual
step. That refinement is the design centre of this build.

Commits: `af33e54` (spec) + `aeca7a6` (code) on Update 7's
`a5a478b`.

## Scorecard — planned vs shipped

| Item | Verdict |
|------|---------|
| U8-01 Rotate prompt (touch + portrait, non-blocking, CSS icon) | SHIPPED as specced |
| U8-02 Landscape button (menu + in-game pill; fullscreen + orientation lock; safe iOS no-op) | SHIPPED as specced |
| U8-03 Automatic resize (boot-bound fitRenderer; orientationchange re-fits) | SHIPPED — and strengthened per the 04:30 refinement: listeners register at module load, so flips re-fit in the menu before any match starts, not only in-game |
| U8-04 Landscape-phone layout grid (no overlaps, portrait untouched) | SHIPPED as specced |

4/4. Nothing deferred inside this update's scope.

## What shipped, per item

- **U8-01** — `#rotate-prompt` pill (index.html) shown by one
  CSS rule: `@media (orientation: portrait)` +
  `body.touch-mode`. Desktop/non-touch can never match the body
  class; the prompt is `pointer-events: none`, sits at the top
  safe-area, and vanishes on rotation because the media query
  stops matching. Icon is a CSS phone outline inside a spinning
  arc (reduced-motion disables the spin). No images, no emoji,
  no JS state.
- **U8-02** — `goLandscape()` in main.js: requests fullscreen
  on the document element, then attempts
  `screen.orientation.lock('landscape')`, every step
  feature-detected with rejections swallowed, ending in a
  deferred refit. Two entries: the menu's GO LANDSCAPE button
  (rendered only under `body.touch-mode`) and a LANDSCAPE pill
  in the touch layer (new TouchCore `pressOrient` hook → main),
  placed on the left edge below PAUSE/STREAK. On iOS Safari —
  Brett's iPhone — element fullscreen and orientation lock do
  not exist, so the button is a harmless no-op there and the
  U8-01 prompt does the guiding; on Android Chrome the same tap
  goes fullscreen and locks wide. No error paths reach the
  player.
- **U8-03** — the old inline resize listener became
  `fitRenderer()` (identical math: aspect + setSize), now also
  driven by `orientationchange` (immediate + rAF + 250 ms —
  mobile browsers fire it before dimensions settle) and by
  `visualViewport` resize where available. Because the binding
  is at module top level, **starting in landscape works, and
  flipping in the menu or mid-match re-fits immediately** —
  the automatic behaviour Brett asked for at 04:30. Desktop
  computes the same values on the same events as before.
- **U8-04** — one query, `@media (orientation: landscape) and
  (max-height: 520px)`, touch-mode scoped (desktop windows
  never match the body class; portrait is not in the query at
  all). The nine touch buttons re-seat from the portrait stack
  (bottom offsets up to 282px) into a compact right-edge grid;
  every pair was centre-distance checked against summed radii
  (tightest pair: FIRE↔ADS at 89px vs 75px required). HUD:
  ammo moves to the lower-left above a narrowed health block,
  score-line tucks under the stats stack, gear/streak lines
  rise above the lowered slots bar, chat box lifts clear of
  the ammo block, objective narrows to 40vw.

## Gates

Tree AND git-archive snapshot, all green: smoke (SMOKE
PASSED), biome-check, reachability, reachability-maps,
mobile-check — now 47 assertions including the new **T6**
block (orient hook fires exactly once; prompt + button markup
present; prompt gated to touch + portrait; landscape query
present; orientation lock + orientationchange fit wired in
main). No re-pins: no existing pin moved.

## Perf (v6-metrics, same instrument as the U7 report)

Δ0 everywhere, as designed — this update adds no scene
content: calls 131/144/143/145 (compound/forest/snow/mars,
cap 165), tris identical to Update 7 (forest 252,356 worst,
cap 300k), shadow estimates identical. Two DOM nodes and one
button are the entire runtime cost.

## Device status

- **Phone/tablet:** mobile-check green incl. T6. The flip path
  is code-verified end to end: orientationchange →
  fitRenderer (boot-bound) + CSS orientation queries re-lay
  HUD, touch grid and prompt instantly; the touch layer's own
  resize listener already re-feeds the stick viewport width.
  Brett's on-device verdict is the final proof, as always —
  he is on iOS, where landscape is automatic on flip and the
  button is (by platform design) a no-op extra.
- **PC/laptop:** sizing math unchanged; added listeners do not
  alter desktop values; all gates green.

## Push verification

Snapshot of final HEAD → gates re-run on the snapshot (all
green) → pushed via the Contents API as "V6 Update 8" → live
files byte-size-exact vs snapshot: index.html, css/style.css,
js/main.js, js/touchcontrols.js (sizes in the landing entry).
