# V6 Update Ledger — Over n' Out (0.6.0-dev)

Opened: Oct 24, 2026, by Board Meeting 006. Owner law (V6 charter):
**V6 is a long-cycle polish version — a minimum of 20 updates land
under V6 before V7 may even be proposed.** The loop is: build update
→ gates green → Brett playtests → feedback → next update. Nothing
pushes without Brett's explicit tap. Local `v6(<area>):` commits
only. Lighting is LOCKED by the owner's play verdict ("probably
perfect") — no update in this ledger touches lighting code, profiles
or grades. No new gameplay systems.

**Owner directive (Brett, Oct 27, 2026) — V7 gate + update sizing:**
Brett wants **at least 5 more V6 updates from Update 4 onward**
before upgrading to V7, and V7 is reserved for **big-time upgrades
and changes** — it is proposed only on his explicit call, never
assumed. Each update from Update 5 on ships with a **before/after
progress scorecard** (scope delivered vs planned, files/lines
changed, perf-metric deltas, gate results, what visibly changed
in-game) so Brett can judge whether an update is big enough.
Updates may **bundle multiple ledger rows** when Brett wants more
per update. Update 5's focus specs come from Brett directly.

## Graphics track — the 20-update spine

| # | Update | Scope | Status |
|---|--------|-------|--------|
| 1 | Vegetation + buildings realism — Compound & Forest | Tapered textured trunks, layered irregular canopies, per-instance variation; rooflines/trim/doors/window grids/parapets/panel seams, beveled edges, procedural facade textures. Instancing/merging pays for all of it. (Atlas) | **LANDED Oct 24** (commits be2cb74, 21d2e7e, f9b1185 + report 45e3809) — awaiting Brett playtest; ships in the next push |
| 2 | Vegetation + buildings parity — Snow Station & Mars Uplink | Update 1's treatment carried to the remaining two maps (snow-loaded pines, station architecture; Mars habitat/industrial structures, rock forms). (Atlas) | **LANDED Oct 24** (commits 553e9ad, 0ed4e0d, c2ac69c, d96e74c, febfa93 + report) — awaiting Brett playtest; ships in the next push |
| 3 | Terrain & ground realness — all maps | Smooth-shaded undulation, blended ground materials (asphalt/concrete/grass/dirt/snow/rock), edge wear, instanced scatter (rocks, tufts, debris). (Atlas) | **LANDED Oct 27** (commits 9c2c854, 5a577d2, 8821c8e, 584f46a, 281e459 + report) — awaiting Brett playtest; ships in the next push |
| 4 | Soldiers & guns realism | Rounded, blended forms — capsule/sphere-blended limbs and kit, fabric-ish texture variation. Hit cores byte-identical (proof required); per-bot call budget held. (Atlas) | **LANDED Oct 27 in bundled Update 5** (commit 63a137f) — tapered leg overlays, cylinder forearms, rounded face; gun detail pass. Hit cores proven byte-identical (biome/smoke pins green); per-bot calls held at 7. See v6-update-05-report.md |
| 5 | Materials & finish pass | Texture resolution/atlas uplift, anisotropy, per-instance color-variation audit across all maps; no large flat-color surface survives on any map. (Atlas + Odin) | **LANDED Oct 27 in bundled Update 5** (commit 0b379f3) — floor grid removed at the source + flat deck/slab/pillar solids textured; the 4,240 m² strike is cleared on all live maps. Remnants (sun-disc, unwired layout ground) dispositioned in v6-update-05-report.md. Update 5 also bundled owner-spec items off-ledger: menu theme music, options menu, pre-match countdown, slide, 4 earnable camos |
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
- **Update 6 LANDED** (Oct 28, commits `17a2da0`…`66fb95a` on
  Update 5): Brett's 16-item bundled spec under his
  extensive-build directive. Headline (his priority): usable
  scopes (real ADS optic views, magnification = adsZoom stat),
  gun identity round 2, character realism (merged humanization,
  hit cores byte-identical). Correctness: U6-04 fire-rate root
  cause = discarded cooldown remainder quantizing shots to
  tick boundaries (AR 7.50/s vs 8.70 table at 30 Hz) — fixed at
  all six firing loops, probe §D proves ≤0.16% everywhere;
  U6-03 music buzz = triangle-wave partial beating, fixed in
  the tone bus, composition unchanged. World: bounds 62→80,
  four ring POIs, Ops 12×10, HQ 22.5×9 + service alley (wider
  draft caught interpenetrating Ops by the probes — corrected
  in design), map identities (yard/lanes/channels/canyon).
  Systems: stances (shared machine, 14/14), teams (MERIDIAN/
  KESTREL), solo backfill gap found + fixed, ASSAULT win rate
  measured unmoved (0/6 → 0/6). Comms: text chat (lobby +
  in-game) and WebRTC voice via a ruled protocol EXTENSION
  (MSG 8→10, version stays 1; N1 re-pinned + named; chat-check
  11/11). Menu redesigned (CSS only, all functions intact).
  Perf: compound 151 / forest 161 / snow 160 / mars 162 calls
  (bar 165), shadow est 199/200 — the binding constraint now.
  All four gates green. Report:
  `docs/sessions/v6-update-06-report.md`. **Not pushed —
  awaiting Brett's playtest + tap.** (Pushed live Oct 28 at
  Brett's tap, ~00:41.)
- **Update 7 LANDED + PUSHED LIVE** (Oct 28, commits `2808fd3`
  + `96d7723`, first build under the Oct 28 auto-push law —
  no tap needed or taken): **U7-01 scope rework** (Brett:
  "still can't use the scope" — root causes: no baseline sight,
  iron overlay suppressed outright, "SCOPE 4×" really 2.4×, no
  in-game teaching). Five kinds now — iron 1.15× (every gun,
  level 1), reddot 1.35×, holo 1.6× window, MID SCOPE 3×
  (honest rename), SNIPER 5× (DMR built-in + L19 fit) — each a
  distinct picture, label names kind + zoom, one-time ADS hint
  chip + rewritten controls line, touch ADS verified.
  **U7-02 bushes:** third grounding skirt mass in both bush
  systems (local PRNG — shared scatter streams byte-untouched,
  no re-pins). **U7-03 movement feel slice:** error-adaptive
  look smoothing + locomotion soft-start, Havoc numbers held.
  **U7-04 lighting (lock lifted):** shadow camera 72/68 → 86
  (the ±80 ring POIs were shadowless), normalBias 0.35, forest
  /mars hemi lifts. Perf: calls Δ0 on all maps (131/144/143/
  145, v6-metrics instrument), tris +2.8k–15.7k (skirts only),
  shadow est. Δ0. Fire-rate §D exact. **One named re-pin:**
  smoke PG2 ladder 26 → 27 (sniper rung). All five gates green
  on tree + snapshot; live byte-verified (10 files exact).
  Report: `docs/sessions/v6-update-07-report.md`. **The count
  is now 7. Awaiting Brett's playtest verdicts — scopes first.**
- **Update 8 LANDED + PUSHED LIVE** (Oct 28, slim hotfix,
  commits `af33e54` spec + `aeca7a6` code + this landing):
  Brett's 04:27 playtest verdicts — scopes CONFIRMED ("works
  and is pretty cool", queue item 1 closed); mobile portrait
  too cramped → landscape, then refined 04:30: **automatic on
  flip, from game start, no manual step**. Shipped: boot-bound
  `fitRenderer()` (resize + orientationchange immediate/rAF/
  250 ms + visualViewport) so flips re-fit in menu and
  mid-match; a touch+portrait rotate prompt (pure CSS gate,
  non-blocking, CSS icon); a GO LANDSCAPE button (menu + touch
  pill via a new TouchCore orient hook) doing fullscreen +
  `orientation.lock('landscape')` where supported and a safe
  no-op on iOS; and a landscape-phone layout query
  (≤520px height) re-seating the touch cluster into a
  pairwise-checked non-overlap grid + HUD re-seats — portrait
  CSS untouched. mobile-check gained T6 (7 assertions, 47
  total); no re-pins. Perf Δ0 on every map (calls 131/144/
  143/145; tris and shadow estimates identical to U7). All
  five gates green on tree + snapshot; live byte-verified.
  Report: `docs/sessions/v6-update-08-report.md`. **The count
  is now 8.** Queue head for the coming sessions: characters
  realism, then Brett's 04:29 minimap + Domination guidance
  spec (see the MEMORY directive), scenery/mountains, meta.
- **Update 9 LANDED + PUSHED LIVE** (Oct 28, commits `e3a23dc`
  spec + `b229788` code + this landing): Brett's 04:41
  playtest order — rotation not working on his iPhone,
  soldiers still "very blocking", death fall not realistic.
  Jumped the queue ahead of the minimap spec at his direct
  order. **Rotation:** no service worker/manifest exists;
  live U8 bytes re-verified exact, Last-Modified 04:38:20 PT
  vs his 04:41 report — a cached pre-U8 page is the prime
  suspect, and there was no way to tell which build his phone
  ran. Shipped: menu-footer **BUILD U9 stamp** + ono-build
  meta + `?v=9` entry assets (the cache witness), redundant
  iOS fit triggers (matchMedia orientation, screen.orientation,
  pageshow, orientationchange series to 600 ms), touch layer
  re-feeds viewport on orientationchange (it only listened to
  resize). A fetch-based self-update reload was built and
  **CUT by the smoke security lint** (zero-network-calls
  hardening law) — removed, not exempted. Honest remainder:
  stamp reads U9 + still no rotation → device-side (Rotation
  Lock / in-app browser); Brett's 5-second checks are in the
  report. **Characters:** de-blockified over byte-identical
  hit cores (hip-joint spheres, calf masses, ribcage barrel,
  molded vest plate, rounded pack, true helmet dome + round
  brim, curved jaw shell; segments up across legs/head/neck).
  Proof: core-corner multisets intact (min copies 4/4/4) and
  six raycast samples byte-identical vs the U8 baseline
  ([miss, 4.6875, 4.804, 4.57, 4.6382, 4.4778]). Cost stated:
  +1,392 tris/bot (2,970 → 4,362 metrics basis), calls held
  at 8/bot, maps' statics Δ0, forest ≈266,276/300k.
  **Death:** the feet-pivot plank is replaced by a procedural
  articulated collapse — shot-direction falls with seeded
  variation (no Math.random in the death path), front falls
  twisted onto a shoulder (the merged gun arm cannot fold),
  buckle → hip-pivot tip on a leg-geometry hip floor → late
  pivot migration onto the contact surface, head loll, gun
  droop, one soft settle; HP/marker hide at death; corpse
  lifetime exactly 1.5 s (removal frame 90 verified). Vertex
  audit: rest-pose lowest vertex −0.096…+0.133 m across 24
  randomized falls (baseline was −0.41 m at rest). New pins:
  smoke D9 ×2, mobile-check T7 ×5; **no re-pins**. All five
  gates green on tree + snapshot; live byte-verified.
  Report: `docs/sessions/v6-update-09-report.md`. **The
  count is now 9.** Queue head: Brett's minimap + Domination
  guidance spec, then scenery/mountains, meta systems.
- **Update 10 LANDED + PUSHED LIVE** (Oct 28, commits
  `aa1e12c` spec + `544c057` code + this landing): Brett's
  04:29 minimap spec, queue head since U8. **Minimap:**
  north-up 2D-canvas HUD map (all devices; touch placement
  below the left-edge buttons, shrinks in landscape), player
  = white facing arrow, bots = cyan/red team dots, Domination
  zones A/B/C as lettered circles coloured by owner
  (MERIDIAN cyan / KESTREL red / neutral grey) at true radius,
  Assault relay marked; dots clamped to ±80 (anti-glitch).
  **Guidance pill:** relative-bearing arrow + CAPTURE /
  DEFEND / CHANNEL + target name + distance in metres, solo
  from `M.zones`, online from snapshot owners merged onto
  mode-table coordinates. Math is pure in `js/minimap.js`,
  pinned by mobile-check T8 (15 checks). **Hardening slice
  (Watch 05:07 findings):** game-server default bind
  0.0.0.0 → **127.0.0.1** (factory + direct-run; `HOST=` is
  the explicit opt-in; boot log states posture), net/README
  runbook (localhost bind, WSS via tunnel only, firewall:
  deny inbound 8081 non-loopback), CSP meta on index.html
  (self-only, object-src none; `'unsafe-inline'` kept and
  documented — importmap + inline styles). Build witness
  9 → 10 (mobile-check T7 **named re-pin**, witness-only;
  ws-soak needed no re-pin — it already bound localhost).
  Smoke M11 pins the new ids/CSP/bind. Perf **Δ0 everywhere**
  (calls 131/144/143/145, forest 264,884 tris, shadow
  199/200) — the map is 2D canvas, no THREE cost. All five
  gates green on tree + snapshot; live byte-verified.
  Report: `docs/sessions/v6-update-10-report.md`. **The
  count is now 10.** Still open: Stage 2 signed sessions
  (hardening not certified complete); Brett's U9 re-test
  verdicts. Queue head: scenery/mountains, then meta.
- **Update 11 LANDED + PUSHED LIVE** (Oct 28, commits
  `a051032` spec + `695134e` code + this landing): queue item
  5 — scenery realism + background mountains. **Finding:**
  the two flat silhouette ridge rings (r 100 / r 124) were
  placed for the old ±50 arena (corner ~71); since U6-12 the
  bounds are ±80 (corner ~113.1), so the r 100 circle crossed
  the playable square at its diagonals. **Shipped:** four
  vertex-coloured ridge rings re-based outside the bounds
  (foothill 122 / near 132 / mid 152 / far 178; minimum radius
  after bump+hash swing ~115.8 > 113.1), dark base → lighter
  crest with deterministic jitter, plus ONE merged distant-
  peak range (18 summits, r 195–225, heights ~34–58, pale
  apex caps). Visual only — no colliders/shootables; the
  re-basing is this update's anti-glitch item. Build witness
  11 (mobile-check T7 **named re-pin**, witness-only); smoke
  gained H1 pins (horizon names present, old radii absent,
  vertex colours present). Perf: client static calls +3/map
  exactly as budgeted (48/61/60/62 → 51/64/63/65, bar 165),
  tris +360/map, shadow casters Δ0 (estimate stays 199/200).
  All five gates green on tree + snapshot; live byte-verified
  (BUILD U11 stamp, `BUILD_NO = 11`, world.js 87,158 B exact;
  Pages flipped ~2 min after push, remote verified via
  Contents API in the interim). Report:
  `docs/sessions/v6-update-11-report.md`. **The count is
  now 11.** Still open: Stage 2 signed sessions (hardening
  not certified complete); Brett's U9 re-test verdicts.
  Queue head: meta systems (emblems + badges first).

- **Update 12 LANDED + PUSHED LIVE** (Oct 28, commits
  `fda1286` spec + `c85498f` code + this landing): Brett's
  post-U11 playtest directives (~14:15) — they outranked the
  ledger queue (meta). **Minimap rule change (his #1):**
  enemy dots no longer always show — a hostile dot appears
  only when that enemy fires, for a 2.5 s reveal (pure rule
  in js/minimap.js, bot `shotAge` clock, drawMinimap gate;
  friendlies unchanged; also an information-leak fix).
  **Scorestreaks phase 1 (his #2):** LIGHTNING STRIKE added
  whole — 1100 pts, warn 1.0 s, radius 5, damage 150 —
  loadout-selectable (combination count now true C(6,3)),
  solo-executable, and server-authoritative online
  (protocol enum + sim strike path generalised per-def).
  UAV/care package already shipped V5; **attack dogs phased
  to a later V6 update** (new AI actor class — Brett's own
  "dogs later" phasing). **Characters pass 3 (his #3):**
  segment uplifts across legs/arms/torso/head + bicep, boot-
  collar and waist-sash overlays inside existing envelopes;
  hit cores byte-identical (D9 ✓), calls held 8/bot, cost
  +1,646 tris/bot (4,362 → 6,008) disclosed. **Guns (his
  #4):** 16-seg barrels, chamfered receivers + pistol slide,
  tapered AR/DMR muzzle brakes (straight tubes removed), AR
  angled foregrip; merged, +0 calls, muzzle vectors
  unchanged. **Menu (his #5):** the #menu::after grid
  gradients removed (aurora + sweep stay), CSS-only. ADS
  untouched per his reconfirmation. Build witness 12
  (mobile-check T7 **named re-pin**; smoke ST1 named pin
  update for the ladder; new mobile-check T9 ×11). Perf:
  sustained calls Δ0 (134/147/146/148, bar 165), static tris
  Δ0, forest sustained 281,526/300k (headroom 18,474 — the
  bot spend, disclosed), shadow casters Δ0. All five gates
  green on tree + snapshot (+ ws-soak, soak); live
  byte-verified (8 key files exact). Report:
  `docs/sessions/v6-update-12-report.md`. **The count is
  now 12.** Still open: Stage 2 signed sessions (hardening
  not certified complete). Queue head: attack dogs (AI),
  meta systems (emblems + badges), movement follow-ups.

- **Update 13 LANDED + PUSHED LIVE** (Oct 29, commits
  `f4e25d5` spec + `73d7231` code + this landing): queue head
  — **meta systems phase 1** (Laurel). **New pure module
  `js/meta.js`:** 8 emblems earned by level (★ MERIDIAN STAR
  L1 → ◆ VOID DIAMOND L25), 8 special badges from lifetime
  stats + level (FIRST BLOOD 1 kill … HIGH COMMAND L20),
  7-day daily-reward cycle paying **Meridian Credits**
  (50/75/100/125/150/200/300 MC — in-game currency only, no
  real-money ever). **Profile meta block** (credits / emblem /
  badges / daily / stats) sanitized + clamped on load/save;
  pre-U13 profiles migrate losslessly (smoke PG9). **SERVICE
  RECORD menu panel:** emblem picker (locked show level),
  badge line, CLAIM DAILY REWARD button (disables after
  claiming, names streak day); solo endMatch records stats
  and reports `BADGE EARNED:` lines (online server-settled,
  not double-counted). **Economy hardening:** same-day
  re-claim refused (pure on stored last-claim date), wallet
  capped 1,000,000 + spend refuses overdraw, badge evaluation
  idempotent. Build witness 13 (mobile-check T7 **named
  re-pin**; new T10 ×27, smoke PG9). Perf **Δ0 everywhere**
  (calls 134/147/146/148, forest 281,526 tris, shadow
  199/200) — data + DOM only. All five gates green on tree +
  snapshot; live byte-verified (6 key files exact).
  Report: `docs/sessions/v6-update-13-report.md`. **The
  count is now 13.** Still open: Stage 2 signed sessions
  (hardening not certified complete). Queue head: meta
  phase 2 (tier packages + special offers spending MC),
  attack dogs (AI), movement follow-ups.

## Owner directives (Brett, Oct 28, 2026) — release law, lighting lock lifted, focus queue

**Release law — CHANGED (Oct 28, ~04:01, supersedes the tap
era in the header above):** for the REST OF V6, build sessions
**build AND push live automatically, right away, no permission
needed per push.** Auto-push only when all gates are green
(smoke, biome-check, reachability, reachability-maps,
mobile-check); a red-gated build never pushes. **V7 is NOT
included** — going into V7 still waits for Brett's explicit
word ("going into 7 I'll let you know"). The V7 gate stands:
≥5 more V6 updates from Update 4 onward AND the charter's
20-update floor. Once the V6 count hits 20, sessions stop and
the phase change awaits Brett.

**Lighting lock — LIFTED (Oct 28):** "Adjust lighting and
shadows accordingly and properly." Lighting/shadow work is
permitted again for the V6 remainder, adjusted properly;
Odin's perf budgets still bind (sustained calls ≤165/map,
tris ≤300k, mobile shadow ≤200). Update 7's first pass found
the shadow camera (±72/±68) smaller than the ±80 playable
bounds — profiles now fit ±86.

**Cross-device law (Oct 28):** every update must actually be
applied live, and the game must stay playable on PC, laptop,
tablet and mobile phone. `mobile-check` green + touch controls
(incl. ADS) verified is a push requirement.

**Remaining-V6 focus queue (Brett, Oct 28, priority order) —
automated sessions inherit this:**
1. **Scope rework** — true ADS with distinct scope kinds
   usable on every gun + plain instructions. → **Update 7**
   (five kinds: iron / red dot / holo / mid 3× / sniper 5×;
   every gun has a baseline sight; in-game hint).
2. **Bushes enhancement** — trees are approved; bushes were
   the ask. → **Update 7** (third grounding mass, both bush
   systems). More dressing passes may follow.
3. **Characters more realistic** — next character pass after
   U6's humanization (hit cores stay byte-identical, per-bot
   budget held).
4. **Movement feel** — walking locomotion AND look-around /
   mouse-look. → **Update 7 first slice** (adaptive look
   smoothing + locomotion soft-start; Havoc's numbers held).
5. **Scenery realism + background** — scenery realism plus
   background mountains / landscaping OUTSIDE the playable
   bounds, for depth.
6. **Meta systems** (spread across updates): emblems +
   special badges; daily rewards; tier packages; special
   offers — **in-game currency only, NO real-money purchases.**

## Directive V6-3 wave (Oct 25) — Atlas (worlds)

- **Stage 1 ENTERABLE INTERIORS LANDED** (commits 0a9068d,
  90e0c1f; local only, not pushed). Two deliverables on the
  Compound:
  - **Ops Building → 3-room interior** (append-only): two
    partition walls with 1.4 m door gaps carve the shipped shell
    into west office / NE comms / SE storage. Every shipped solid
    byte-identical; partitions are ordinary wallMat solids,
    mirrored 1:1 in worlddata (SOLIDS 111 → 115).
  - **HQ — NEW two-story enterable** in the SW inner court
    (footprint x −22..−2, z 37.5..46.5; the court was verified
    empty — no collider/spawn/zone touched it; **new construction,
    not a replacement**). Ground floor: bunk room (stair along
    its north wall) / NE ops / SE entry, doors S (1.6 m) + N
    (1.4 m). Upper floor: overwatch / NE / SE rooms on the plate
    (top 3.125), partitions mirrored, railing-guarded stairwell,
    roof lid 6.25. 6 rooms + stairwell; interior cover crates
    collider-true on both floors. Facade program rides the U1
    merged meshes: 11 windows + 2 framed doors + parapet + corner
    boards + floor band. Compound facade totals now **20 windows
    / 4 framed doors — the Board's Update-6 lines, met in V6-3**.
  - **The kit** (in-code, world.js HQ block): `wallRun` plan per
    level with its OWN openings (doors are a ground-floor plan
    feature; upper floors run continuous), `floorPlate` segments
    around stairwell holes, `stairRun` at the shipped 0.575 rise
    with the top step widened into a flush landing, `railing`
    solids on well edges. Pitch 3.125 (2.875 walls + 0.25 slab).
    Levels stack by repeating the plan at yBase += 3.125 — a slim
    tower is a small plan repeated, a wide block is this plan
    repeated; **10 stories needs no new primitive** (Stage 2+).
  - **§3.4 offsets:** all 36 new solids ride EXISTING material
    buckets (wallMat/deckMat/slabMat/crateMat/roofTexMat) → **+0
    draw calls**; the HQ facade rides the five merged U1 meshes →
    +0. The wave's one net call change is **−1**: the shipped
    2-mesh puddle pair became one merged mesh (see Weather).
    SOLIDS 111 → 147 total (T1 re-pinned per commit).
  - **Disclosure:** the HQ footprint joined landscaping
    `clearRects`; the rejection-sampled tuft/rock scatter
    reshuffles (decor only — tufts/rocks carry no colliders and
    no data mirror). One soft bush (−18, 36) now sits against the
    HQ's north wall; it clears the wall face and is unchanged.
  - **Gates:** reachability gained floor-aware indoor probes —
    Ops route (S door → SE → NE → west office), HQ ground rooms,
    HQ stair chain 0 → 0.575 → 1.15 → 1.725 → 2.3 → 2.875 →
    plate 3.125, upper rooms/gaps/railing/well-drop/roof-lid,
    spawn (0, 44) clear. All green; V5 probes unchanged.
- **VIVID PASS LANDED** (12d388b): saturation on surfaces only —
  compound ground slate, steel-blue walls/decks, amber/steel
  crates, saturated canopy + tuft greens, warmer bark; proctex
  brick/metal/roof/foliage painters; biome forest/pine/ice/Mars
  rust families; layout bucket palettes (earth/timber/crate/
  metal/regolith). **Lighting integrity: sha a40a3f79c85670a6,
  exposure 1.10, shadow 4096 — UNTOUCHED (harness-verified).**
- **WEATHER READS LANDED** (8234293): visuals only. Compound
  puddles 2 → 7 in ONE merged mesh (net −1 call, the §3.4
  offset named above), darker/wetter; all biome clients inherit
  (shared base). Snow: wind-scour streaks + glints 70 → 140 in
  the snowpack painter (proctex + biomes local in step). Mars:
  wind-blown dust streaks in the regolith painter (both copies).
  Falling precip needs a main.js frame hook — specced for Vega
  in the Atlas report, not faked on this surface.
- **Metrics (harness, this wave):** compound 119 → **118 calls**
  / 40,476 → **48,042 tris** (flat 0.242 → 0.23); forest 128 →
  **127** / 206,302 → **213,868**; snow 130 → **129** / 77,720 →
  **85,286** (shadow est. 191 → **190**); mars 130 → **129** /
  48,470 → **56,036** (shadow est. 191 → **190**). The +7,566
  tris on every client is the HQ in the shared base (identical
  delta ×4 — proof of source). All sustained calls ≤ 129 vs the
  165 veto; all tris ≤ 300k (forest 213.9k = 86k headroom; the
  forest *planning* line is exceeded by shared-base content, not
  forest dressing). Layouts: geometry untouched (palette only).
  §2.5 flat-surface strikes: unchanged pre-existing warnings
  (ground-plane mesh), binding at Update 5 as scheduled.

## Update 4 (wave) — Terrain & ground realness (ledger row 3)

- **LANDED Oct 27** (commits 9c2c854, 5a577d2, 8821c8e,
  584f46a, 281e459; local only, not pushed). Report:
  `docs/sessions/v6-update-04-report.md`.
  - **Compound:** world-space painted ground-blend overlay
    (one mesh, not tiled) — dirt rim wear, gate-lane wear,
    bare-earth mottling over the concrete slab. Visual only.
  - **Forest:** the missing ground blanket (r 90, blended
    grass/bare-earth/leaf-litter painter — the concrete slab
    no longer shows under the trees) + 12 smooth perimeter
    mounds (r 67–86, outside bounds, trunk/bush/mast-clear)
    + 56 instanced floor stones. Own rng streams; shipped
    scatter byte-identical (B3/B4/B6/B7 pass unmodified).
  - **Mars:** 130 instanced smooth pebbles across the bands.
  - **Snow:** deep-drift mottling appended in step in both
    mirror snow painters; no new meshes.
  - **Zero gameplay change:** no colliders, no shootables, no
    spawns, SOLIDS still 147; smoke / biome-check /
    reachability / map-reachability ALL PASS, no re-pins.
  - **Metrics:** compound 118 → 119 calls, forest 127 → 131,
    snow 129 → 130, mars 129 → 131 (veto 165); tris ≤ 217.8k
    (veto 300k); shadow-pass est ≤ 192 calls (mobile bar 200)
    with shadow tris byte-identical — every new mesh is
    castShadow-off. Mars flat share improved 0.176 → 0.138.
    §3.4 offsets: one draw per program (overlay / blanket /
    each InstancedMesh) vs 198 unmerged draws for the same
    dressing. §2.5 strikes unchanged — Update 5's scope, as
    scheduled (client merged bucket + layout ground boxes).

---

## Rig — the test infrastructure (Oct 25, 2026, Rig Engineer, owner order)

The owner commissioned five test environments + a 10-agent roster + a
100-bot test team, all in-repo under `rig/` ("all files kept together").
Honest construction, stated to the owner up front: the "VMs" are five
isolated worktree-sandbox environments with dedicated runners (not OS
VMs), and the "100 bots" are a parallel-match soak swarm (the sim
fields ≤9 bots/match; the swarm runs many matches at once and reports
bot lives + concurrent-bot ceiling, never a bare "100").

- **VM1 Stability** (`rig/vm1-stability/`) — full gate suite + repeated
  soak/ws-soak on a pinned commit. Proof-of-life on 476ac34: 6/6 PASS.
- **VM2 Balance** (`rig/vm2-balance/`) — balance-probe TTK vs the V5
  baseline + bot-vs-field win-rate matrix (round modes × maps × weapon
  profiles, shared `driver.mjs`).
- **VM3 Compatibility** (`rig/vm3-compatibility/`) — the commit's real
  server across 6 device profiles + mobile-check. Proof-of-life on
  476ac34: 6/6 profiles, mobile-check 40/40.
- **VM4 Comparative** (`rig/vm4-comparative/`) — v6-metrics A/B between
  two commits with bar-based verdicts (≤165 calls, ≤300k tris).
- **VM5 Backup** (`rig/vm5-backup/`) — git-archive snapshot + per-file
  sha256 manifest in `rig/backups/` (archives stay in scratch) +
  restore drill. Proof on 476ac34: 101 files checksummed, drill
  RESTORE PROVEN (archive hash ✓, 101/101 files ✓, restored smoke ✓).
- **Swarm** (`rig/swarm/`) — parallel headless matches (2 scripted
  players + bot fill each). Validated on this 2-core box: P=2/3/4 all
  clean (0 errors, 0 crashes); **P=4 is the validated max** (≈32
  concurrent bots + 8 scripted); scales with cores.
- **Roster** — the 10 seats with surfaces + one-pen rule:
  `rig/agents/ROSTER.md`.
- **Found on day one (rig-relevant):** tools/smoke.mjs boots on FIXED
  port 8199; a restore-drill smoke failed once under a port collision
  and passed identically on re-run. Rig runners that invoke smoke now
  wait for port 8199 (`riglib.waitForPortFree`) and the drill retries
  once, on the record. Worth a Vega look when convenient.
- Full first battery (owner-authorized unattended run, Oct 25):
  `docs/sessions/rig-first-battery-report.md` + dated outputs in
  `rig/reports/`. Rig commits are local `v6(rig):`; nothing pushed.

- **Update 14 LANDED + PUSHED LIVE** (Oct 29, commits
  `d29c8b3` spec + `79c185d` code + this landing): queue head
  — **meta systems phase 2** (Laurel). **Tier packages:**
  FIELD PACK 150 MC / RANGER PACK 450 MC / COMMAND PACK
  900 MC. **Special offers:** MEDIC KIT 250 / ACE KIT 350 /
  FLARE KIT 550 MC, one **featured per day** (pure date
  rotation) at 30% off (floor(price × 0.7)); packages never
  discounted. Every item grants one of **6 shop emblems**
  (cosmetic only — no XP, camos, or power; in-game currency
  only, no real-money ever). **Profile owned block:**
  sanitized (known ids, deduped, cap 6); a shop emblem worn
  without owning its item resets to default on load;
  pre-U14 profiles migrate losslessly (smoke PG10). **SUPPLY
  shop UI** in the SERVICE RECORD panel (package/offer
  pickers, featured line, shop emblems in the emblem
  picker). **Economy hardening:** owned check precedes any
  charge (no re-buy), discount is a pure date function,
  wallet cannot overdraw. Badges 8 → 10 (OUTFITTER,
  QUARTERMASTER). Build witness 14 (mobile-check T7 **named
  re-pin**; T10 badge-count **named re-pin** 8→10; new
  T11 ×36, smoke PG10). Perf **Δ0 everywhere** (calls
  134/147/146/148, forest 281,526 tris, shadow 199/200) —
  data + DOM only. All five gates green on tree + snapshot;
  live byte-verified (6 key files exact; Pages flipped
  ~7 min after push). Report:
  `docs/sessions/v6-update-14-report.md`. **The count is
  now 14.** Still open: Stage 2 signed sessions (hardening
  not certified complete). Queue head: attack dogs (AI),
  movement follow-ups.
- **Update 15 LANDED + PUSHED LIVE** (Oct 29, commits
  `54db3f0` spec + `16acfb7` code + this landing): queue head
  — **attack dogs** (Ghost + Vega), Brett's phased
  scorestreak expansion phase 2. **Ladder:** `dogs` at
  **1200** (between lightning 1100 and precision 1300),
  40 s; `DOG_SPEC` shared by both runtimes — pack of **3**,
  hp **60**, speed **5.4**, bite **20** dmg / **1.7 m** /
  **0.9 s**. **Actor:** `createDogActor()` — merged body +
  wagging tail, 2 calls/dog transient only. **Solo brain:**
  seek nearest hostile, collide-true movement, bite via
  `bot.damage`, heel when idle, strike-blast damage, expiry
  cleanup. **Sim:** server-authoritative pack (validated
  callStreak spawn, sim collide, kill events `via: 'dogs'`
  crediting the owner, blastEntities damage, `snap.dogs`
  carriage) — headless-verified: spawn/heel/40 s expiry +
  **6 dog kills in 40 s** vs wave 1. **Anti-duplication:**
  one active pack per owner on every path. **Named
  remainder:** no direct-gunfire hit volumes on dogs yet
  (blast only) — spec'd for a later V6 update. Build
  witness 15 (mobile-check T7 **named re-pin**; smoke ST1
  **named re-pin** for the ladder; new T12 ×19). Perf
  **Δ0 statics** (calls 134/147/146/148, forest 281,526
  tris, shadow 199/200). All five gates green on tree +
  snapshot (+ ws-soak, soak); live byte-verified (5 key
  files exact, BUILD U15 stamp, ATTACK DOGS live). Report:
  `docs/sessions/v6-update-15-report.md`. **The count is
  now 15.** Still open: Stage 2 signed sessions (hardening
  not certified complete). Queue head: movement-feel
  follow-ups, dog gunfire hit-volumes.
- **VERSION 7 LANDED + PUSHED LIVE** (Oct 30, ~00:50 PT —
  six hours ahead of Brett's 07:00 deadline; his explicit V7
  call of Oct 30 00:32 PDT supersedes the V6 20-update floor
  and the V6-only release policy; the V6 line closes at 15
  updates + the Watch's dogs-protocol fix d2d27c1, which rode
  this push). Spec: `docs/sessions/v7-spec.md`; report +
  scorecard: `docs/sessions/v7-report.md`. Contents:
  ballistics core (per-weapon spec model — adsMult / velocity
  / recoilV / recoilH; unified spread formula in solo + sim,
  fixing the sim's ADS-reads-multiplier-as-radians bug and
  solo's no-tightening-without-an-optic gap; center-weighted
  cone shared by both runtimes; recoil pattern), gunsmith
  measured spec panel with per-change deltas (specSheet),
  last three invisible attachments modeled (compensator,
  angled grip, CQB stock — merged, +0 calls), Compound ring
  bushes II (+6, colliders mirrored), roster FINAL at 88
  seats + Watch, two team-upgrade cycles (training log).
  Version 0.7.0, witness BUILD V7. All five gates green on
  the git-archive snapshot; push via gh_push_contents
  (205/205 files byte-identical on re-push audit); Pages
  build 1326551169 "built"; live byte-verified (index
  13,741 B, main.js 143,087 B, world.js 87,440 B, weapons.js,
  loadouts.js — sha256-exact vs the gated snapshot).
  **The 06:00 scheduled build slot stands down: the V7 tree
  is landed and clean; no V6 U16 is to be started.** Still
  open (unchanged, not regressions): Stage 2 signed
  sessions; dogs direct-gunfire hit volumes (deferred from
  V7 per spec); movement-feel locomotion slice.

## V7.1 — Round 2 slice 1: DRIVABLE VEHICLES (Oct 30, ~02:35 PT)

Brett's round-2 headline order. **v0.7.1, BUILD V7.1, live
byte-verified** (index + all nine slice files sha256-exact
vs the gated snapshot; Pages serves BUILD V7.1).

- NEW js/vehicles.js (THREE-free spec + physics, streaks.js
  pattern): RUNNER QUAD (220 hp, 17.5 m/s, armor share 0.25)
  + PATROL TRUCK (420 hp, 13.5 m/s, armor 0.55, run-over 110).
  Speed-sensitive steering that tightens at the top end,
  brake-then-reverse, impact hull damage, disabled wrecks.
- Pads (−4, 30) + (−12, 30) probed clear in ALL FOUR maps'
  data (VH5 re-proves every smoke run — the first quad pick
  (5, 30) sat inside a snow-drift collider; caught by test).
- Actors in equipment.js createVehicleActor: ONE merged mesh
  per vehicle, castShadow FALSE (budget stays 199/200),
  terrain pitch/roll + accel squat. +2 draw calls in-match,
  ~+1k tris; per-map sustained calls unchanged (134/147).
- Integration (main.js): E / touch USE (T13) enter-exit;
  driving steps INSTEAD of player.update (firing, streaks,
  gear locked); the rider rig rides the vehicle so bots
  engage it and damagePlayer splits fire by armor share;
  run-over kills credit through bot.damage + onBotKilled;
  #vehicle-hud speed/hull readout; spawn/clear ride
  beginMatchSpawns/resetV5Match; death force-exits.
- Tests: smoke VH1–VH6 (real physics: parked no-turn,
  throttle clamp, reverse clamp, impact math, pad clearance
  ×4 maps, wiring) + mobile T13. All five gates green on
  tree AND snapshot; spec-audit clean. Push note: the
  contents push returned one HTTP 409 at the very end;
  post-push audit showed every file byte-exact on remote +
  Pages — no partial state.
- Solo only by design this slice: online vehicles are R2-5
  (stretch) through the sim's existing patterns, or they
  don't ship — never a parallel trust path.
