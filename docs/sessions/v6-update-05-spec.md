# V6 Update 5 — Brett's Spec, Board Diagnosis & Command List

Session: Oct 27, 2026 (Coordinator). Update 4 is LIVE (remote HEAD
631ebf52, live files byte-exact). This is a BUNDLED update under
Brett's Oct 27 directive (bundling allowed; scorecard required).
Lighting is LOCKED — no item below touches js/lighting.js, light
rigs, profiles or grades. Ballistics/tracer visuals are APPROVED
by Brett ("bullets are looking good") — no item touches them.

## Brett's playtest verdicts (steering, verbatim intent)

- Buildings look great — a great addition to the maps. KEEP GOING.
- Bullets look good. DO NOT TOUCH.
- Landscape/terrain direction approved. KEEP UPGRADING.
- A grid is visible on the floors. REMOVE OR COVER IT.
- Everything still reads robotic/blocky. WANTS SMOOTHNESS.
- Characters still read Roblox, not CoD. Make them look like PEOPLE.
- Guns need to look more like real guns.
- Movement can be enhanced — smoother, plus ONE new way to move.
- Wants a full options menu (start menu + in-game, anytime):
  controls, screen, movement, audio.
- Wants a pre-match countdown/prep: 10, 9, 8 … GO (TDM-style).
- Wants earnable gun camo designs.
- Wants theme music on the start menu.

## Diagnosis (board-style, evidence first)

### D1 — The floor grid (item U5-02): THREE stacked causes, all in
the compound ground tile (js/world.js, ground block)
1. **A literal painted grid**: the ground canvas paints white
   grid lines every 64 px ("Painted grid + center circle,
   original character, kept"), then tiles it 10×10 over the
   136 m plane → a visible line grid every ~1.7 m, plus a
   repeated green center circle every 13.6 m.
2. **Per-tile edge darkening**: a dark strokeRect vignette baked
   into the same tile repeats as a second, larger grid of dark
   seams every 13.6 m.
3. **Form-board lines** in proctex makeConcreteTexture (hard
   lines every 64 px + fixed tie-hole dots) repeat as stripes on
   the building floors/walls that use it (world.js HQ material,
   mapbuilders palette).
Biome blankets (forest/snow/mars) paint blotch/speckle only — no
lines — and are NOT a cause. Fix = remove all periodic line/dot
features from the repeating painters; make blotches wrap-safe so
tile edges vanish; keep variation in the non-repeating
world-space overlay (Update 4) where it belongs.

### D2 — Blocky/robotic read (items U5-03/04/05)
- §2.5 flat-surface strikes (metrics, HEAD 9a8fffe): one merged
  untextured bucket ≈ **4,240 m² on every live map** (the
  deck/slab/pillar solids flush through flat colour materials),
  plus the unwired layout ground box ≈ 33,925 m² (projection
  only — layouts are not playable yet; same fix pattern when
  they wire in, noted as deferred).
- Bots are V6-3 rounded at torso/head, but **legs are still bare
  boxes** and **forearms are still boxes** — the silhouette
  breaks at the limbs. Hit cores (leg/torso/head boxes) are
  byte-identical by ledger law and STAY; the fix is rounded
  overlays/blends merged into the same 3 meshes.
- Guns are detailed but uniformly hard-edged: no gas system on
  the AR, no handguard venting, thin DMR handguard, pistol slide
  reads flat from the side.

### D3 — Baseline perf (tools/v6-metrics.mjs @ 9a8fffe)
compound 119 calls / 48,044 tris · forest 131 / 217,758 ·
snow 130 / 85,288 · mars 131 / 65,138 · shadow est ≤192 ·
soldier 7 calls / 2,056 tris per bot (worst weapon 2,308) ·
viewmodel worst 832 tris · camos 5, zero-delta proven.
Bars (Odin veto): ≤165 calls/map, ≤300k tris, shadow ≤200.

## The command list (owner + acceptance per item)

**U5-01 — Theme music, start menu.** Owner: Echo (audio).
Original procedural WebAudio composition in the Sfx idiom (minor
-key looped motif: bass + pad + sparse lead + soft percussion,
scheduled lookahead). No files, no dependencies, nothing
copyrighted. Menu-only: starts on first user interaction
(autoplay law), stops when a match deploys (GO), restarts on
return to menu. Music volume + mute live in options (U5-08).
*Acceptance:* music audible in menu after first click/keypress;
silent in-match; volume slider + mute act live; no console
errors with audio unavailable.

**U5-02 — Kill the floor grid.** Owner: Atlas.
Per D1: strip the painted grid, repeating center circle and
per-tile edge darkening from the compound ground tile; wrap-safe
blotch painting so the repeat itself disappears; strip form-
board lines + fixed tie holes from proctex concrete.
*Acceptance:* no periodic line/dot feature remains in any
repeating floor painter (code-audited); ground reads continuous
at spawn on all maps; smoke F/T pins unchanged; SOLIDS 147.

**U5-03 — Realism continuation: no flat surfaces.** Owner:
Atlas + Odin. Give the flat deck/slab/pillar materials the
(de-gridded) procedural concrete texture so the 4,240 m² merged
bucket is textured on every map; materials/finish audit on the
compound solids.
*Acceptance:* v6-metrics §2.5 strike on live maps cleared (or
reduced to named remnants); calls/tris inside bars.

**U5-04 — Smoothness pass.** Owner: Atlas.
Bevel/round the cheap offenders: bot limbs (U5-05), gun edges
(U5-06), and smooth-shading where boxes meet ground (world
props already smooth from U4). Movement-feel smoothing rides
U5-07a. *Acceptance:* per-item checks below; flat-shaded share
does not regress on any map.

**U5-05 — Characters: people, not blocks.** Owner: Atlas.
Tapered-cylinder thigh + shin overlays over the leg cores,
cylinder forearms (matching V6-3 tapered upper arms), rounded
face mass over the head core, hip/pelvis blend. HARD LAW: hit
cores byte-identical (leg/torso/head boxes untouched — proof =
the boxes' specs unchanged in source + biome/smoke hit pins
green); same 3 merged meshes + visor + gun (per-bot calls stay
7); camo zero-delta matrix re-proven by metrics.
*Acceptance:* metrics soldier line: calls still 7; tris priced
in the scorecard; G5/bot pins green.

**U5-06 — Guns: real-gun detail + finish.** Owner: Atlas.
AR gas tube + handguard vents; DMR handguard vents + barrel
fluting rings; SMG stock/brace tidy + receiver pin detail;
shotgun heat-shield holes row; pistol slide top serrations +
frame rail. Muzzles byte-identical (flash position law);
attachments anchors untouched.
*Acceptance:* G1–G5 pins green; viewmodel/bot tris priced;
muzzle vectors unchanged in source.

**U5-07 — Movement.** Owner: Havoc (spec) + Stride (feel).
(a) Smoother feel: ground accel 40→36, stop 55→46, air accel
9→10.5 — top speeds (5.6/9.2) and ALL jump constants untouched
(reachability pins are law). (b) ONE new move: **SLIDE**
(Havoc's pick — the CoD-family standard). Sprint (hSpeed > 6) +
C/Ctrl, grounded: 0.55 s slide, entry speed 10.6 decaying to
6.4, direction locked with light steering, camera dips to
~1.02 m eye, jump cancels. Exactly one addition — nothing else
new. *Acceptance:* reachability + reachability-maps green
(jump model untouched); slide cannot fire from stand/walk/air;
slide state resets on respawn.

**U5-08 — Options menu (start + in-game pause, anytime).**
Owner: Lens + Coordinator. Settings persist in the profile
(progression.js settings, sanitized): sensitivity (exists),
invert-Y, FOV 60–100, music volume, SFX volume, quality mode
(auto/high/medium/low → QualityScaler manual override),
sprint hold/toggle, slide key hint. Page-2 becomes the OPTIONS
page; a dedicated ⚙ OPTIONS button on page 1 reaches it from
both the start menu and the pause overlay. Pause-menu edits
apply live (sensitivity already does; Havoc's class-edit rule
is about loadouts, not settings).
*Acceptance:* every control round-trips through a reload
(profile persistence); sanitize repairs bad values; smoke
served-id checks still pass; no V6-3 menu option lost.

**U5-09 — Pre-match countdown.** Owner: Havoc (spec) +
Coordinator. On DEPLOY: state 'countdown', 10 → 0 on the wave
banner with tick tones (final = GO), look-around allowed,
movement/fire locked (zero input), bots/waves spawn AT GO.
Pause during countdown resumes into the countdown. Solo modes
only (online keeps its server flow). Subsequent waves do NOT
re-count. *Acceptance:* no bot exists before GO; player cannot
move/fire during countdown; GO starts the exact pre-U5 spawn
paths; endMatch/pause/resume flows green.

**U5-10 — Earnable camos.** Owner: Ledger + Atlas.
FOUR new designs in camo.js (MIRAGE digital, TIGER stripe,
CRIMSON, MERIDIAN GOLD) on the prestige track at L21/23/25/28
(zero power, existing ruling); the PG7 smoke pin is re-pinned
11 → 15 prestige entries as a ruled change. ALSO wire the
player's own camo through: class camo picker in the loadout
(locked rows show their level), viewmodel gun + arms rebuilt
with the deployed class's camo (they silently defaulted to
woodland until now). *Acceptance:* isCamoUnlocked gates the
picker; metrics camo matrix re-proves zero-delta at 9 camos;
choosing a camo changes the held gun + arms, never faction
readability (bots' contract untouched).

## Process law (standing)
License-clean patterns only; procedural/original assets; no new
dependencies; local commits only — NOTHING pushes without
Brett's tap. Gates at the end: smoke, biome-check,
reachability, reachability-maps — all green — plus a metrics
before/after for the scorecard.
