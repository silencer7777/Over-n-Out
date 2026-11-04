# Over n' Out — Vision Queue Night Run, Wed Nov 4, 2026 (from ~00:05 PT)

Coordinator session. Brett's go-order (Nov 3, 2026, ~20:32 PT):
run the VISION QUEUE as automatic updates through the night,
pushing live on green gates. Sequenced by Brett to start only
after his Facebook deletion sweep finished — it finished at
12:04 AM PT Nov 4, and this run started on that clearance. This
superseded the Nov 2–3 stand-down posture for these queue items.
One pen on the tree throughout (Coordinator only, per the Oct 24
one-pen lesson).

Queue order (Brett's standing order, Oct 28): (1) characters
more realistic · (2) enhance bushes (trees untouched) · (3)
movement feel — walking locomotion + look-around · (4) scenery
realism + background depth · (5) meta systems.

## Grounding

- Working tree at start: CLEAN. HEAD f056ea4 (evening Nov 3
  stand-down report on top of d9ec36f), version 0.7.5,
  BUILD V7.5 live and byte-verified.
- Baseline perf (v6-metrics, HEAD f056ea4): calls 134 / 148 /
  147 / 149 per map (budget ≤165); tris 93,100 / 285,774 /
  131,408 / 115,930 (budget ≤300k; Forest headroom 14,226 the
  tightest); static casters 30 / 38 / 40 / 40; soldier 8 calls /
  6,008 tris per bot.
- **FACADE_ANCHORS decision:** the unpushed training commit
  5f67863 (world.js table refactor, zero geometry moved) RODE
  WITH THE FIRST PUSH (V7.6), exactly as the Nov 2–3 stand-down
  reports promised ("ships with the next gated push"). Verified
  in that step: live world.js 91,895 B, byte-identical to local.
- **Push route:** plain `git push` has no credential helper in
  this environment ("could not read Username"). Pushes ran
  through the GitHub Contents API helper — the Round 2 pipeline
  — one commit per changed file on the remote, and every push
  was audited by fetching the live Pages files and sha256-
  comparing them against the local tree (Bytewise's rule).
- Version pins moved deliberately with each bump, the repo's
  established practice: smoke M6 package.json pin and
  mobile-check T7 build-stamp witness re-pinned per slice.

## Slice 1 — V7.6 · Characters: kit completion (queue 1)

Commit `5da792f` — js/bots.js (+ version bump files).

The soldier was already ~45 parts deep (V3–U12 passes). What
was genuinely missing, fixed inside the SAME merged meshes
(+0 draw calls, hit cores byte-identical):
- **Right headset cup** — the left cup shipped alone in V5; the
  right ear was a bare skin sphere. Pair complete (+ boom mic
  already on the left).
- **Helmet chin straps** (both sides, brim to jaw) and an **NVG
  counterweight pouch** on the helmet rear.
- **Dump pouch** on the rear belt and a **hydration tube** from
  the pack over the right shoulder to the chest strap.
- **Holster thigh strap** — the drop-leg rig is strapped to the
  leg now, not floating beside it.

Gates: 5/5 green (guardian/smoke, biome, reachability,
reachability-maps, mobile-check).
Scorecard: soldier 6,008 → 6,104 tris/bot (+96), calls/bot
unchanged (8); map tris +864 each (the 9-bot sustained scene);
calls Δ0; casters Δ0. Live: byte-verified after push (bots.js
55,412 B; world.js 91,895 B incl. 5f67863; BUILD V7.6 stamp).

## Slice 2 — V7.7 · Bushes (queue 2)

Commit `56e90e2` — js/mapbuilders.js, js/world.js (+ bump).

- **Biome maps (Forest/Snow/Mars):** their bushes were still
  the V6 two-blob form — the compound map got its grounding
  skirt in U7-02 and the biomes never did. Each bush gains a
  **low, wide skirt mass** (low-detail twin InstancedMesh,
  canopyGeometry 7×5) placed with the U7-02 locally-seeded
  PRNG discipline, so the shared rng() stream — and every
  placement downstream of it — is byte-untouched. Both
  existing masses gain a **whisper of tilt** (±0.08 rad, same
  local PRNG) so clumps lean like grown shrubs. The skirt does
  NOT cast (castShadow=false by design): the two masses above
  it already cast the bush's shadow and the caster ledger is
  untouched. Trees were not touched, per Brett's direction.
- **Compound:** a **fourth mass — a sunlit crown puff** high on
  each bush, in the same InstancedMesh (count ×3 → ×4), same
  local PRNG stream continued. Colliders unchanged.

Gates: 5/5 green.
Scorecard: +3,640 tris per map per the metrics ledger
(compound crowns 26 × 140; biome skirts 65 × 56 in the shared
sustained scene); compound 97,604 · Forest 290,278 · Snow
135,912 · Mars 120,434 tris — all ≤300k; sustained calls Δ0;
casters Δ0 (30/38/40/40). Live: byte-verified (world.js
92,735 B, mapbuilders.js 38,203 B; BUILD V7.7 stamp).

## Slice 3 — V7.8 · Movement feel (queue 3)

Commit `b336670` — js/player.js (+ bump).

The locomotion stack was already deep (wish-velocity accel,
U7-03 soft-start + error-adaptive look smoothing, eased bob,
strafe lean, view-model sway). Two cosmetic layers were
missing; both are eased, capped at the strafe lean's family
scale, and touch no sim value, sensitivity, or top speed:
- **Look lean:** camera roll INTO a fast turn, measured from
  the SMOOTHED yaw rate (raw mouse jitter never reaches it),
  capped ±0.010 rad (~0.6°), damped to 35% while aiming —
  the look-around half of the queue item.
- **Run lean:** at a full sprint (the FOV kick's own trigger:
  sprint + hSpeed > 6 + grounded, never while aiming) the
  camera tips 0.006 rad forward — the lean-into-the-run that
  pairs with the kick — the walking/running half.

Session honesty note: the look-lean block was first pasted
into `look()` (where `dt`/`input` don't exist) by a two-match
edit; it was caught on immediate re-read, removed, and placed
in `update()` after the smoothing block before any gate ran.
Gates: 5/5 green. Scorecard: perf Δ0 exactly (calls and tris
identical to V7.7 on every map). Live: byte-verified
(player.js matched local; BUILD V7.8 stamp).

## Slice 4 — V7.9 · Scenery depth (queue 4)

Commit `680a4fa` — js/world.js (+ bump). Compound horizon
(the U11 system; the biome maps have no horizon rig of their
own — their sustained scenes share this dressing per the
metrics ledger):

- **Ridge rings gain a mid-slope row:** each ring was a
  two-row curtain (base + crest vertices). A third row at 55%
  height, pulled inward as the slope rises, carries a
  base→mid→crest terrain gradient — the rings now shade like
  mountainsides. Silhouette outlines unchanged; same four
  meshes, same hash family.
- **New conifer tree-line ring** at r ≈ 117.5, between the
  playable corner (~113.1) and the foothill ring: a jagged,
  hash-spiked near-black-green silhouette so the depth reads
  arena → forest edge → foothills → ridges → peaks. ONE new
  mesh (+1 call, compound), visual only — no colliders, no
  shootables, castShadow off.

Gates: 5/5 green.
Scorecard: compound 135 calls (+1, the tree line) / 98,436
tris (+832: mid rows 576 + tree line 256); Forest 149 /
291,110 · Snow 148 / 136,744 · Mars 150 / 121,266 (the +1/+832
appears in every map's sustained ledger via the shared
horizon rig); casters Δ0. Live: byte-verified — see final
hashes below.

## Queue 5 — Meta systems: AUDITED, already shipped

No code changed, deliberately. Emblems (8 level + 6 shop),
special badges, daily rewards with streak math, tier packages
(FIELD/RANGER/COMMAND), and special offers with a daily
featured rotation (30% off via priceFor/featuredOfferId) all
shipped in V6 Updates 13/14 (js/meta.js) and are fully wired
in main.js — Service Record panel, emblem pickers, daily
claim button, SUPPLY shop UI, guarded purchaseItem (credits
never negative, idempotent grants). Building more tonight
would have invented scope Brett didn't ask for; the queue
item stands complete as shipped.

## Final state

- **Live: BUILD V7.9 · v0.7.9** at
  https://silencer7777.github.io/Over-n-Out/ — HEAD 680a4fa.
- Closing gates on HEAD: guardian SMOKE PASSED (all sub-gates),
  mobile-check all scenarios pass, biome + both reachability
  suites green.
- Live-integrity, final (sha256 prefixes, live == local):
  index.html 13,913 B `a61d1702…` · js/main.js 159,289 B
  `12cad582…` · js/world.js 95,225 B `a671ddf6…` ·
  js/player.js 31,210 B `39ee70b0…` · js/mapbuilders.js
  39,382 B `dc8ed479…` · js/bots.js 55,412 B `e386a167…`.
- **Total delta vs the v0.7.5 baseline:** calls +1 per map
  (135/149/148/150, budget ≤165); tris +5,336 per map
  (98,436 / 291,110 / 136,744 / 121,266, budget ≤300k —
  Forest headroom 8,890 is now the number to guard);
  soldier +96 tris/bot at unchanged 8 calls; **shadow casters
  Δ0 on every map** (199/200 discipline held — nothing new
  casts).
- Never-regress ledger: minimap fire-reveal rule untouched
  (minimap.js unmodified); scorestreak ladder untouched
  (streaks.js unmodified); ADS still hold-right-click;
  start-menu grid still removed; mobile playable per
  mobile-check at every slice.
- Security: no hardening surface touched, no new network
  calls from game code (smoke lint green), Lockdown pass
  left exactly as spec'd, per the night brief.
- Known remote oddity, stated plainly: the remote blob of
  docs/sessions/v6-metrics.json differs from the local HEAD
  copy — a pre-existing divergence from an earlier
  archive-snapshot push. It is a metrics artifact, not a game
  file; tonight's measurements were taken with the tool and
  the file restored to HEAD after each run, per prior
  practice. No game byte is affected.

## For Brett's playtest (priority order)

1. **Movement feel (V7.8)** — flick turns and sprint. If the
   look lean reads backwards or too strong/weak, it's a
   one-line strength (or one-character sign) tweak.
2. **Bushes (V7.7)** — Forest first: do the bushes read
   grounded and grown now? Compound crowns second.
3. **Scenery (V7.9)** — Compound at dusk: tree line + ridge
   shading depth.
4. **Soldiers (V7.6)** — kit completion at range (subtle by
   design: headset pair, straps, tube, pouch).
5. Still owed from before tonight, unchanged: ADS tightness,
   gunsmith phone readability, recoil feel, online dogs,
   online vehicle prediction.
