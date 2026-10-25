# V6-3 MENU REPORT — Start-menu declutter (Directive V6-3, Vega)

Owner order (Brett, Oct 25): "Start Menu is looking nice but make it
more user friendly. It's looking slightly cluttered. Keep all the
option just make a secondary page if need be."

**Result: the menu is now two pages. Nothing was removed.** Page 1
is the play path and nothing else; page 2 ("MORE OPTIONS") holds
the settings depth, the story transmission, and the controls
reference. Both pages live in the one served HTML document (page 2
starts with the global `.hidden` class), so every smoke-pinned id
is still served and every behaviour contract is untouched.

Commits: `3a3d61a` (index.html), `0dea40d` (css/style.css),
main.js wiring (see git log). Local only — nothing pushed.

## New information architecture

**Page 1 — `#menu-page-main` (the play path, top → bottom):**
title + version tag → `#menu-msg` (context line) → `#results`
(post-match only) → `#profile-line` (level/XP) → MISSION select +
goal line → LEVEL select → LOADOUT (class tabs, weapon row,
attachment pickers, gear line) → ONLINE panel (callsign / room /
server, JOIN ONLINE, status) → **▶ DEPLOY** → ⚙ MORE OPTIONS
button → fine print.

Changes of position only: LEVEL moved up beside MISSION (mission
setup reads as one block), and the three blocks that made the page
feel crowded — story, sensitivity, controls grid — left page 1.

**Page 2 — `#menu-page-more` (secondary):**
"MORE OPTIONS" title → story transmission → mouse sensitivity
slider → controls reference grid → **← BACK TO DEPLOY**.

**Navigation law:** MORE OPTIONS is one tap/click from page 1;
BACK TO DEPLOY is at the foot of page 2 (and the page is short —
no hunting). Every return to the menu lands on page 1:
`showMenuPage('main')` runs in the solo match-end, desktop pause,
touch pause, and leave-online paths, so RESUME / REDEPLOY and the
after-action results are always front and center. Page switches
reset the menu scroll to the top.

**Mobile:** identical structure; both nav buttons join the
touch-mode 44px-min-height list (they already clear it on desktop
padding), the menu keeps its scroll + safe-area behaviour, and the
M1 touch contract is untouched (touch layer, DEPLOY flow, pause
semantics all unchanged).

## Option inventory — before → after (self-audit)

Mechanical audit (old vs new index.html): **ids lost: none; ids
gained: only the 4 page/nav ids** (`menu-page-main`,
`menu-page-more`, `menu-more-btn`, `menu-back-btn`); select
options lost: none; controls cells lost: none; `data-weapon` set
identical (`ar,smg,shotgun,dmr,pistol`); input ids lost: none.

| # | Option / element (before) | After |
|---|---|---|
| 1 | Title + version tag | Page 1, unchanged |
| 2 | `#menu-msg` context line | Page 1, unchanged |
| 3 | Story transmission (`#story-panel` / `#story-text`) | **Page 2** |
| 4 | After-action results (`#results` / `#results-body`) | Page 1, unchanged (post-match only) |
| 5 | Profile line (level · XP) | Page 1, unchanged |
| 6 | MISSION select (4 modes) + `#mode-goal` | Page 1, unchanged |
| 7 | LOADOUT: class tabs (`#class-tabs`), 5 weapon buttons, attachment pickers (`#att-pickers`), `#gear-line` | Page 1, markup byte-stable inside its wrapper |
| 8 | Mouse sensitivity (`#sens-slider` + `#sens-val`) | **Page 2** (the controls grid's "slider above" note is still literally true — the slider sits above the grid there) |
| 9 | LEVEL select (4 maps) | Page 1, moved up beside MISSION |
| 10 | ONLINE: `#online-name`, `#online-room`, `#online-url`, JOIN ONLINE, `#online-status` | Page 1, unchanged |
| 11 | ▶ DEPLOY / RESUME / REDEPLOY (`#play-btn`, label state machine) | Page 1, unchanged |
| 12 | Controls reference (13 cells) | **Page 2**, all 13 cells |
| 13 | Fine print (desktop + phone note) | Page 1, unchanged |
| — | ⚙ MORE OPTIONS / ← BACK TO DEPLOY | **New** (page 1 / page 2) |

## Gates

- **Smoke: PASSED** — includes C4 (exactly 5 `data-weapon`), M7 /
  M9 / M10 (every pinned id still in the served HTML), M8 ('v0.6'),
  m2 HUD defaults.
- **Mobile-check: PASSED, 40/40 assertions** (grep count of ✓ = 40)
  — the M1 synthetic-touch suite is unregressed.
- Option self-audit: see above — zero losses, mechanically proven.

## Deliberately left

- **HUD untouched** — out of this surface's scope; the touch-mode
  keyboard-legend hints in the HUD remain the known M2 cosmetic
  item from the mobile milestone, unchanged here.
- **Pause opens on page 1 by design.** A player who pauses to
  tweak sensitivity is two taps from the slider (MORE → slider)
  and two back (BACK → RESUME) — inside the ≤2-tap reachability
  the directive set, with DEPLOY never buried.
- No visual restyle of the blocks themselves (colours, fonts,
  button skins unchanged) — this wave was structure and
  hierarchy only, per "looking nice, just cluttered."
