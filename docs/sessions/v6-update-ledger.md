# V6 Update Ledger — Over n' Out (0.6.0-dev)

Opened: Oct 24, 2026, by Board Meeting 006. Owner law (V6 charter):
**V6 is a long-cycle polish version — a minimum of 20 updates land
under V6 before V7 may even be proposed.** The loop is: build update
→ gates green → Brett playtests → feedback → next update. Nothing
pushes without Brett's explicit tap. Local `v6(<area>):` commits
only. Lighting is LOCKED by the owner's play verdict ("probably
perfect") — no update in this ledger touches lighting code, profiles
or grades. No new gameplay systems.

## Graphics track — the 20-update spine

| # | Update | Scope | Status |
|---|--------|-------|--------|
| 1 | Vegetation + buildings realism — Compound & Forest | Tapered textured trunks, layered irregular canopies, per-instance variation; rooflines/trim/doors/window grids/parapets/panel seams, beveled edges, procedural facade textures. Instancing/merging pays for all of it. (Atlas) | **IN FLIGHT** |
| 2 | Vegetation + buildings parity — Snow Station & Mars Uplink | Update 1's treatment carried to the remaining two maps (snow-loaded pines, station architecture; Mars habitat/industrial structures, rock forms). (Atlas) | queued |
| 3 | Terrain & ground realness — all maps | Smooth-shaded undulation, blended ground materials (asphalt/concrete/grass/dirt/snow/rock), edge wear, instanced scatter (rocks, tufts, debris). (Atlas) | queued |
| 4 | Soldiers & guns realism | Rounded, blended forms — capsule/sphere-blended limbs and kit, fabric-ish texture variation. Hit cores byte-identical (proof required); per-bot call budget held. (Atlas) | queued |
| 5 | Materials & finish pass | Texture resolution/atlas uplift, anisotropy, per-instance color-variation audit across all maps; no large flat-color surface survives on any map. (Atlas + Odin) | queued |
| 6 | Compound detail deepening II | Set dressing, props, signage, interior detail — sequenced by Brett's Update 1–5 playtest feedback. | planned slot |
| 7 | Forest detail deepening II | Undergrowth density, species variety, fallen-tree and stream detail. | planned slot |
| 8 | Snow detail deepening II | Snow sparkle, drift sculpting, ice and station wear. | planned slot |
| 9 | Mars detail deepening II | Regolith variation, rock sculpting, dust wear on structures. | planned slot |
| 10 | Vegetation III | Canopy density/variety uplift; wind-sway as a stretch goal only if Odin's perf bar holds. | planned slot |
| 11 | Buildings III | Signage, fixtures, emissive-only lighting props (grade locked — emissive materials only, no light changes). | planned slot |
| 12 | Horizon & distance dressing | Distant silhouettes and horizon detail so map edges stop reading empty (no lighting change). | planned slot |
| 13 | Ground FX surfaces | Puddles/wet-look, worn paths, track marks where each map's fiction calls for them. | planned slot |
| 14 | Prop & clutter pass | Crates, barriers, machinery, cables — modeled detail on the small stuff players stand next to. | planned slot |
| 15 | Viewmodel & gun detail II | Second pass on first-person weapons if Update 4 leaves headroom. | planned slot |
| 16 | Smoothness engineering | LOD/instancing refinement driven by Brett's F9 readings from live playtests. | planned slot |
| 17 | Texture resolution uplift II | Atlas rebake at higher resolution wherever the F9 budget allows. | planned slot |
| 18 | Playtest-driven polish I | Scope set by Brett's feedback at the time — his notes outrank this table. | planned slot |
| 19 | Playtest-driven polish II | Scope set by Brett's feedback at the time. | planned slot |
| 20 | V6 consolidation & certification | Full-gate certification pass on the finished V6; the "V6 is done" candidate. V7 remains Brett's call, never assumed. | planned slot |
| 21+ | Overflow | The 20 are a floor, not a ceiling — updates continue while Brett keeps finding things he wants better. | open |

Entries 6+ are planned slots, deliberately not over-specified:
each cycle re-sequences from Brett's playtest feedback, which
outranks this table. Only Update 1 is scoped in detail today
(Board 006 §2 bars).

## Mobile track — first-class, parallel (Directive V6-2)

Owner order (Oct 24, 2026): one build, both platforms — the same
GitHub Pages URL plays on desktop AND phone, no install. Mobile
entries run on their own M-numbering and do **not** substitute for
graphics-track updates; the tracks land independently and the
Coordinator sequences merges (Vega: input/HUD; Atlas: world assets;
Coordinator owns any `js/main.js` merge).

| # | Milestone | Scope | Status |
|---|-----------|-------|--------|
| M1 | **Solo fully playable on iPhone** | Touch input layer (`js/touchcontrols.js`: joystick + push-to-sprint, drag look, FIRE/JUMP/ADS/RELOAD/switch/throwable/streak/pause feeding the same input state as keyboard/mouse; pointer lock skipped on touch) + responsive shell (≥44px targets, safe-area insets, touch-action none, orientation/resize, WebAudio unlock on first tap). Done = Brett opens the Pages link on his iPhone 17 Pro in Safari and completes a wave/match solo. Desktop path untouched. (Vega) | **IN FLIGHT** |
| M2 | Mobile perf defaults measured | DPR cap ≤2, lower starting quality tier on mobile GPUs, shadow-map size as render-resolution knob only (lighting grade LOCKED) — landed and measured against Odin's mobile bar (Board 006 Addendum A). | queued |
| M3 | On-device polish | HUD/menu adjustments from Brett's hands-on iPhone test of M1/M2. | queued |

## Maintenance lane (charter-sanctioned, never displaces graphics)

Carried V5 items, scheduled by the Coordinator between updates
only when they cost the graphics mission nothing:

- Online client rendering of V5 snapshot fields (UAV markers,
  equipment arrays) — Coordinator/Vega.
- `js/bots.js` lane-reset parity with the sim's S3 fix — Coordinator/Atlas.
- Per-mode end-condition soak scripts (TDM/Domination/Relay Assault
  driven to `mode_end` over sockets) — Vega.

## Landing log

- **0.6.0-dev** — version bump (package.json + menu tag + smoke
  M6/M8 pins, one commit + M8 literal fix). Tree green.
- **Board 006** — detail bars ruled; this ledger opened.
