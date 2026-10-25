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
| 1 | Vegetation + buildings realism — Compound & Forest | Tapered textured trunks, layered irregular canopies, per-instance variation; rooflines/trim/doors/window grids/parapets/panel seams, beveled edges, procedural facade textures. Instancing/merging pays for all of it. (Atlas) | **LANDED Oct 24** (commits be2cb74, 21d2e7e, f9b1185 + report 45e3809) — awaiting Brett playtest; ships in the next push |
| 2 | Vegetation + buildings parity — Snow Station & Mars Uplink | Update 1's treatment carried to the remaining two maps (snow-loaded pines, station architecture; Mars habitat/industrial structures, rock forms). (Atlas) | **LANDED Oct 24** (commits 553e9ad, 0ed4e0d, c2ac69c, d96e74c, febfa93 + report) — awaiting Brett playtest; ships in the next push |
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
| M1 | **Solo fully playable on iPhone** | Touch input layer (`js/touchcontrols.js`: joystick + push-to-sprint, drag look, FIRE/JUMP/ADS/RELOAD/switch/throwable/streak/pause feeding the same input state as keyboard/mouse; pointer lock skipped on touch) + responsive shell (≥44px targets, safe-area insets, touch-action none, orientation/resize, WebAudio unlock on first tap). Done = Brett opens the Pages link on his iPhone 17 Pro in Safari and completes a wave/match solo. Desktop path untouched. (Vega) | **PUSHED Oct 24** (owner tap — see Landing log) — Pages flip pending scheduled confirmation (~3:15pm PT); M1 completes on Brett's on-device verdict |
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

## Coordination notes

- **One pen per tree (Oct 24):** Update 1 has a single builder
  (Coordinator's Atlas) as sole writer on `js/world.js`,
  `js/biomes.js`, `js/mapbuilders.js`. A second Atlas detected the
  overlap and stood down with zero writes; he serves as
  **independent verifier** — gates + metrics + diff review of the
  Update 1 landing against Board 006, fixes routed back through
  the Coordinator to the builder.
- **Scope overlap, noted not blocked:** the in-flight Update 1
  `world.js` work already includes **wreck-vehicle detail** —
  Update 14 (props & clutter) scope landing early inside Update 1.
  Harmless and credited here; Update 14's slot re-scopes when its
  turn comes.

## Landing log

- **0.6.0-dev** — version bump (package.json + menu tag + smoke
  M6/M8 pins, one commit + M8 literal fix). Tree green.
- **Board 006** — detail bars ruled; this ledger opened.
- **Update 1 LANDED** (Oct 24): vegetation + buildings, Compound &
  Forest. Compound 113→119 calls / 31.3k→40.5k tris; Forest client
  122→128 calls / 84.4k→206.3k tris (vetoes held; +6k over
  Forest's 200k planning budget, dispositioned in Board 006
  Addendum 1); flat-shaded share 0.92→0.031; rendered Forest trees
  84→116 (shipped scatter byte-identical + separately-seeded
  supplemental stand); instance-colour variation 60%→100%.
  Coordinator's gate run on the integrated tree: smoke, biome,
  reachability, map-reachability, ws-soak ALL PASS. Board 006
  Addendum 1 ratifies the struck thresholds (incl. §2.5 = 25 m² by
  Update 5, mobile bar struck) and scores U1: §2.1 MET, §2.2 MET
  as written / partial vs the counts adopted forward (≥20 windows
  / ≥4 doors by Update 6). Report:
  `docs/sessions/v6-update-01-report.md`. Not pushed — ships in
  the next push on Brett's tap.
- **§3.4 amendment** (Oct 24, parent amendment per the independent
  verifier's finding — the verifier passed every bar except this
  documentation item): Update 1's net **+6 sustained calls per map**
  (Compound 113→119, Forest 122→128) are **offset** by call-avoidance
  inside the same landing — the 7th canopy mass and 2nd bush mass
  folded into the existing vegetation InstancedMeshes at +0 calls,
  and the entire Compound facade program merged into 5 meshes
  instead of per-cue meshes; unmerged, that detail would have cost
  well over the +6 added. Post-add headroom vs the 165 veto:
  Compound 119/165, Forest 128/165.
- **Mobile M1 PUSHED** — owner tap ("Push mobile live now," Oct 24):
  `git archive HEAD` snapshot of HEAD 9ddc0d0 (v0.6.0-dev, the
  committed/gated tree incl. Vega's touch landing) pushed via the
  Contents API; remote main = 722365ec; `js/touchcontrols.js`
  verified present remotely (13,636 B); smoke re-run on the
  snapshot PASSED before the push. Atlas's uncommitted Update 1
  files (`js/world.js`, `js/proctex.js`) deliberately EXCLUDED —
  Update 1 ships in the next push once integrated. Pages
  confirmation check scheduled ~3:15pm PT; Brett gets the live
  ping + iPhone try-it steps from that check.
- **Update 2 LANDED** (Oct 24): vegetation + buildings parity,
  Snow Station & Mars Uplink, both render paths. SNOW client:
  127→130 calls / 45.1k→77.7k tris; flat share 0.338→0.105,
  textured 0.489→0.825; **30 snow-loaded pines** (separately
  seeded stand, SNOW_SEED+4242 — shipped scatter proven
  exact-float identical, pines append after it); drifts smooth +
  snowpack texture; habitat dome panelled. MARS client: 130→130
  calls / 44.8k→48.5k tris; flat 0.336→0.182, textured
  0.494→0.676; rock family smooth + regolith (colliders proven
  exact-float identical, 27/27). Layouts: snow static 18→25
  calls, flat 0.390→0, textured 0→0.684 (plank huts, standing-seam
  roofs, hut facade pass with emissive glass); mars static 16→18,
  flat 0.338→0, textured 0→0.715 (habitat paneling + window
  strips, emissive spire tip). Vetoes held everywhere;
  shadow-pass estimates published per §2.6: snow client 191 calls
  / 64.0k tris (mobile bar 200 holds), mars client 191 / 35.0k.
  **§3.4 offsets:** snow client's net +3 calls are the pine
  stand's three InstancedMeshes — the instancing conversion
  itself (30 trees × 9 parts = 270 parts in 3 calls, where
  unmerged parts would cost ~270); all densification folded into
  pre-existing InstancedMeshes at +0 (Mars client net +0 calls).
  Layout adds are merged-mesh consolidations: three huts' + the
  depot's trim and glass ride in 3 meshes total; Mars's tip and
  window programs are one merged mesh each. Report:
  `docs/sessions/v6-update-02-report.md`. Not pushed — ships in
  the next push on Brett's tap.
