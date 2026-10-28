# V6 Update 8 — SPEC (slim hotfix: mobile landscape)

Owner order (Brett, Oct 28, 04:27 PT, playtest of live Update 7):
"On mobile it's hard to play. I need to be able to switch it to
landscape. Update it real quick." Scope verdict in the same
message: "The scope works and is pretty cool" — focus-queue
item 1 (scope rework) is CONFIRMED closed by the player.

This is a slim, single-issue update under the Oct 28 auto-push
law. Owners: Analog (input layer, under Trigger) + Lens
(HUD/menu CSS) + Harbor (device verification). Perf budget:
ZERO added render cost — DOM/CSS/events only.

**Refinement (Brett, 04:30, mid-build): landscape must be
AUTOMATIC** — "as soon as the game starts, when I flip my
phone it will adjust accordingly." The resize path is bound
from boot (menu included, not only in-match), orientation
media queries re-lay the HUD/touch grid with no JS state, and
the U8-02 button is demoted to an optional extra (fullscreen +
lock where supported). The prompt stays as a friendly nudge;
portrait remains playable, just cramped.

## Items

- **U8-01 Rotate prompt.** On touch devices (body.touch-mode)
  held in portrait, a non-blocking pill at top-center reads
  "ROTATE YOUR DEVICE / LANDSCAPE PLAYS BEST" with a CSS-drawn
  rotate icon (no emoji, no images). Pure CSS gate:
  `@media (orientation: portrait)` + touch-mode body class —
  it can never appear on desktop/non-touch, appears over menu
  and in-game, and vanishes the moment the device rotates.
  pointer-events: none — it never blocks a tap.
  Acceptance: markup + CSS gates present; mobile-check T6 pins
  the wiring.
- **U8-02 Landscape button.** Two entries to one action
  (`goLandscape()` in main.js): a "GO LANDSCAPE" button in the
  start menu (touch devices only) and a LANDSCAPE pill in the
  in-game touch layer (new TouchCore `orient` hook → main).
  The action requests fullscreen on the document element, then
  attempts `screen.orientation.lock('landscape')` (Android
  Chrome). Every step is feature-detected and failure-swallowed:
  on iOS Safari (no element fullscreen on iPhone, no
  orientation lock) the button simply does no harm and the
  U8-01 prompt guides the physical rotation. No dead ends, no
  errors.
  Acceptance: hook fires exactly once per tap (mobile-check
  T6); all platform calls guarded.
- **U8-03 Resize correctness.** main.js's resize path becomes
  one `fitRenderer()` (camera aspect + renderer size, same
  math) driven by `resize`, `orientationchange` (immediate +
  rAF + 250 ms deferred re-fits, because mobile browsers fire
  the event before the new dimensions settle), and
  `visualViewport` resize where available. Desktop computes
  byte-identical values on the events it already had.
  Acceptance: gates green; fit function is the single sizing
  path.
- **U8-04 Landscape layout.** One media query —
  `@media (orientation: landscape) and (max-height: 520px)`,
  touch-mode scoped — compresses the right-hand touch cluster
  into a verified non-overlapping grid (centre-distance checked
  against summed radii for all 9 buttons), tightens the slots
  bar, and re-seats HUD readouts (ammo to lower-left above the
  health block, score under the stats stack, chat raised) so
  nothing overlaps at phone landscape heights (~360–430 px).
  Portrait CSS is untouched — no portrait regression.
  Acceptance: geometry table in the report; mobile-check green.

## Out of scope (deferred, per the slim order)

Characters realism (queue head now that scopes are confirmed),
scenery/mountains, meta systems, gamepad — the coming sessions'
work. No balance, hit, or lighting changes. No new files, no
new dependencies, no new draw calls.
