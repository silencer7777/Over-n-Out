# Over n' Out — V3 Phase 2 Report

**Date:** Oct 24, 2026 · **Co-chairs:** Dominic "Apex" Cross (Studio CEO) +
Aurelia "Overlord" Kane (Division Zero) · **Version:** 0.3.0-dev ·
**Status: PHASE 2 COMPLETE — all gates green. Nothing pushed; Phase 2
is local commits only, on top of the live Phase 1 build.**

Brett's scope ledger for V3 was re-confirmed in full this phase —
nothing dropped. Coverage per line is in the ledger table below;
anything not finished is named **DEFERRED WITH OWNER**, never silent.

## Scope ledger — coverage

| # | Ledger line | Status |
|---|---|---|
| 1 | Gun models that read as real guns (5 classes, viewmodel + bot-held) | ✅ SHIPPED |
| 1 | Character realism (proportions, gear, materials) | ✅ SHIPPED |
| 2 | Landscape + floor levels: course updated AND added | ✅ SHIPPED (west deck + Stair C; gate extended) |
| 2 | Landscaping refresh across biomes | ✅ SHIPPED (forest full build; snow scaffold) |
| 3 | Fun features (board-chosen, smoke-covered, budget-checked) | ✅ SHIPPED (5 features) |
| 4 | Forest full build | ✅ SHIPPED |
| 4 | Snow full build | ⏳ SCAFFOLD SHIPPED — full build DEFERRED WITH OWNER (Kimura, Phase 3) |
| 4 | Mars planetary landscapes | ⏳ DESIGN GROUNDWORK ONLY — DEFERRED WITH OWNER (Haddad, Phase 3) |
| 5 | Multiplayer M1 headless sim + soak test | ✅ SHIPPED (soak 10/10) |
| 5 | M2+ per MULTIPLAYER.md | ⏳ SEQUENCED — M2 is Phase 3's head; M3 gated on Brett's §10.1 call |
| 5 | §10.1 WebSocket brief to Board 003 | ✅ PREPARED — decision stays Brett's |
| 6 | Phase 1 follow-through: movement | ✅ CONFIRMED BY BRETT ("already a big improvement") — untouched this phase, by order |
| 6 | Phase 1 follow-through: lighting + enemy readability | ✅ FIX SHIPPED — verdict pending Brett's re-test |
| 6 | Board 001/002 carried watches ruled at Board 003 | ✅ RULED (stair margin accepted/closed; DMR nest + north-corridor narrowed, carried to Board 004 with the playtest) |
| 7 | Performance budgets bind everything; deltas reported | ✅ HELD (table below) |

## Realism pass — what changed (Brett's headline focus)

### Guns (Ricci / Dvorak; Kapoor materials; Verity sign-off)

New module **js/gunmodels.js**: one part list per weapon, both build
flavours batching from it. Every class now has the parts a real gun
has — receiver, barrel, muzzle device, magazine, stock, grip,
trigger guard, sights/optic, rail, charging handle:

| Weapon | Parts | Signature details | Viewmodel meshes | Tris (model) |
|---|---|---|---|---|
| AR | 26 | **curved** 3-segment magazine, muzzle brake + ring, gas block/front post, railed handguard, optic with glass lens + tinted rear ring, charging handle, butt pad | 5 | 492 |
| SMG | 17 | suppressor, straight long magazine, vertical foregrip, wire stock (twin struts), side charging handle | 3 | 304 |
| Shotgun | 13 | pump action (pump grip + ribs), barrel + **magazine tube**, bead sight, wood furniture | 4 | 228 |
| DMR | 24 | heavy barrel + brake, full scope (tube/bell/glass/mounts/turret), bipod, cheek-riser stock, straight 10-round mag | 5 | 624 |
| Pistol | 11 | slide + serrations, frame, barrel, hammer, iron sights, tinted mag baseplate | 4 | 168 |

- **Viewmodel** (player.js): parts merged **per material** — gunmetal
  (metalness 0.85), steel barrel (0.90), matte polymer, optic glass,
  wood — so metal shades like metal at arm's length. Muzzle
  flash/light now sit at each model's true muzzle. Old build: 5 plain
  boxes + no per-class silhouette.
- **Bot-held**: same part lists merged into **ONE vertex-coloured
  mesh** per bot (geometry cached per class) — the silhouette reads
  at range, tint rides receiver/accent parts. Draw calls per bot gun:
  1 → **1 (Δ 0)**.
- Frame cost: viewmodel ≤5 meshes vs 5 boxes before (**Δ ≈ 0**);
  triangles +~0.5k on screen. The realism came from geometry and
  materials, not from draw calls.

### Characters (Ricci / Dvorak; Verity sign-off)

Bots rebuilt from **~35 shaped parts**: legs + boots + knee pads +
thigh blocks; torso + plate vest (front/back) + 3 magazine pouches +
collar guard + shoulders/pads + arms posed to the gun + backpack +
antenna; head + helmet (dome/brim) + jaw guard + balaclava. Humanoid
proportions ~1.85 m; hostile red discipline kept (lifted one step for
dusk — see lighting). Parts merge into the **same 3 hit meshes**
(legs/torso/head) the raycast has always used — hit volumes are the
exact v0.2 boxes; gear sits on them, never inside the aim silhouette.

- Draw calls per bot: 7 → **7 (Δ 0)**. Triangles per bot: ~120 → 580–
  1,040 by weapon (≈ +6k at the 9-bot cap, vs the 250k budget).

### Lighting + enemy readability (Castellanos / Ilves; Verity ruling)

Brett's live playtest verdict on Phase 1: movement ✅, lighting ❌ —
too dark, enemies barely visible, shadows too heavy. The fix targets
the actual mechanism (in this renderer, shadow darkness = weakness
of non-directional light):

| Setting | Phase 1 | Phase 2 | Note |
|---|---|---|---|
| Hemisphere fill | 0x6f83b0/0x2e231c @ **0.60** | 0x8296bd/0x3a2a20 @ **0.95** | shadowed surfaces +58% ambient |
| Sun | 0xff8f3c @ 1.75, 10° | 0xff8f3c @ **1.85**, 10° | modeling kept, angle/colour unchanged |
| Exposure | 0.95 | **1.10** | overall +16% |
| Fog | 0x352130, 42→138 | unchanged | 0% blend at 40 m preserved |
| Bot emissive floor | none | **0x180505** on the shared body material | bots never crush to black in shadow; Δ 0 calls |
| Bot suit reds | 0x7a2e2e / 0x5f2323 | **0x8c3636 / 0x6e2a2a** | hostile reads at range |

**Verity readability criteria, re-derived at the higher bar:** a
hostile (1.85 m) must be identifiable at **40 m in full shadow**.
Shadowed-area luminance is up ~58% (fill) × ~16% (exposure) ≈ **×1.83
vs the Phase 1 grade**, fog still contributes 0% blend at 40 m, and
the emissive floor guarantees a minimum separation from black.
Combined shadow-visibility lift ≈ ×1.83. **Verified by derivation,
not by eyes** — there is no WebGL in the test environment; the
acceptance verdict is Brett's next playtest, and Board 003 recorded
it as RESOLVED PENDING RE-TEST, honestly.

## Landscape + floor levels (Brandt / Sayeed; Hawkeye gate)

- **NEW: west deck** — 10×20 platform, top 2.3, mirroring the east
  deck, with **Stair C** (same 0.575 rise), a deck cover crate, and a
  **10th spawn point** on it. The compound is now symmetric E/W with
  three mid decks + rooftop.
- Reachability gate **extended**: Stair C route row + two source
  pins (stair call + deck solid must exist in shipped source). Gate:
  **15 checks, 6 routes, all PASS**. Jump constants untouched.
- Landscaping refresh: forest full build (below); compound barrels
  placed (fun features); biome clearance data synced to the new
  geometry (west deck/stairs/barrels in biomes.js CLEAR sets).

## Fun features (Novak / Laurent / Jensen / Echo — Board 003 picks)

1. **Explosive barrels** — 5 rust-red drums (merged 1-mesh each),
   shootable + collidable; radius 6.5 m, 95 dmg with distance
   falloff, chain reactions (90 ms), pooled additive blast visuals,
   synthesized explosion SFX. Player takes 45% falloff damage —
   standing next to one is a decision.
2. **Health/ammo pickups** — deterministic cadence (every 4th kill:
   health +40; every 4th+2: full ammo refill), max 3 active, 20 s
   life, bob/spin presentation, pickup SFX.
3. **Kill-confirm hitmarker** — kills upgrade the hitmarker (red,
   larger, longer) on top of the existing hit/headshot feedback.
4. **Relay streak callouts** — story.js streakLine(): chained kills
   (5 s window) earn Relay's voice at 2/3/4/5+.
5. **Weapon inspect (F)** — 1.15 s viewmodel inspect animation.
   Board cuts (scope discipline): slide mechanic (movement is
   Brett-approved — untouched), grenades, killcam.

## Biomes (Ivanova / Reed / Lindholm; Kimura / Solberg)

- **Forest — FULL BUILD:** 46 trees across 6 bands (3 wall
  tree-lines, south edge, **2 interior groves** breaking the long
  sightlines), layered **two-tier canopies** (6 blobs/tree), root
  flares + branches, **52 underbrush bushes with gameplay** (≥1.1 m
  blocks movement per the world.js rule — 30 blocking; shots pass).
  Instanced throughout: the whole forest is ~6 draw calls.
  Machine-verified by tools/biome-check.mjs (15/15): counts,
  spawn/structure clearances, ≥3.09 m tree separation, index-exact
  clearBiome reversibility.
- **Snow — SCAFFOLD:** 26 drifts + 10 ice rocks behind the selector
  (now enabled), drift colliders for large drifts, same clearance
  discipline, reversible. Full build (terrain levels, snowfall,
  ice) — **DEFERRED WITH OWNER: Kimura, Phase 3** per Brett's
  priority order.
- **Mars — DESIGN GROUNDWORK ONLY** (Board 003 item 9): seam deltas
  identified (per-biome scene-dressing hook; low-g as a sim-constants
  variant gated by reachability). **DEFERRED WITH OWNER: Haddad,
  Phase 3.**

## Multiplayer M1 (Volkov / Fischer / Sato / Vega / Brooks / Delgado)

- **net/sim.js** — headless authoritative sim: player stepping
  ported from Player.update()'s physics (identical constants —
  movement Brett approved is the movement the server runs), bot AI
  ported from Bot.update() (identical tables/formulas; targeting =
  nearest living player, §11 Q6 leaning), wave director as pure
  steps over one serialisable match state, **server raycast for
  every shot** vs analytic hit volumes + worlddata AABBs, barrel
  explosions, co-op redeploy at wave start, run-over when the team
  is down. Seeded RNG — soak runs are reproducible.
- **js/worlddata.js** — DOM-free world extraction: 45 solids, 16
  extra colliders, 10 spawns. *Honest partial:* a pinned
  transcription (smoke T1–T5); buildWorld() consuming it is M2.
- **GameServer** — matches boot on first hello, events deliver
  immediately, snapshots at 20 Hz, welcome carries the weapons
  table, `step()`/`removePlayer()` public.
- **Soak (Voss) — 10/10 PASSED:** 150 simulated seconds, two
  scripted clients: wave 2 reached with a wave_clear, 853 shots /
  48 pulls hit / 12 kills, 2,999 snapshots; bot-vs-nobody 600 ticks
  clean. **§11 risk 1 retired with numbers:** LOS raycast 2.7 µs,
  whole-sim cost 0.04 ms/tick vs the 33.3 ms budget.
- **§10.1 brief** — Board 003 minutes carry the full options/
  tradeoffs table; board recommends (a) hand-rolled RFC 6455.
  **Decision needed from Brett** (ratify or overrule) before M3.

## Performance — budget status (Nakamura / Ahn; code-derived)

| Metric | Budget | Phase 1 baseline | Phase 2 (code-derived) |
|---|---|---|---|
| Draw calls (in-wave, 9-bot cap) | < 150 | ≈ 135 | ≈ 150 worst case (barrels +5, pickups ≤ +9 transient, explosion +1 transient; guns/characters/lighting Δ 0) — **at the line, not over**; dynamic quality scaling is the release valve |
| Triangles | < 250k | ≈ 12k | ≈ 21k (bots ~9k, forest ~3k, guns ~1k, rest static) |
| Server sim | 33.3 ms/tick | — | **0.04 ms/tick** measured (soak) |

Live F9 numbers still come from Brett's next session — stated
plainly, as in Phase 1. If the meter shows pressure, Board 003's
named candidate is pickup-mesh merging (3 meshes → 1 per pickup).

## Verification (chair, final tree)

- `node tools/smoke.mjs` — **141/141, SMOKE PASSED** (incl. biome
  and soak as gated subprocess suites)
- `node tools/reachability.mjs` — **15/15, REACHABILITY PASSED** (6 routes)
- `node tools/biome-check.mjs` — **15/15, BIOME CHECK PASSED**
- `node tools/soak.mjs` — **10/10, SOAK PASSED**
- `node net/server.js` — demo exits 0 (welcome now carries weapons)
- Gun/bot runtime builds verified against vendored three (part
  counts, mesh counts, tris, damage path)

## Commits (local only — 8)

beb296d guns + characters · 40a0b84 world expansion + barrels ·
c9a1682 fun features · 1be4db4 forest + snow scaffold · 9c96f99 M1
sim + soak · 1c7110b lighting playtest fix · b27850c smoke 141 ·
(this report + Board 003 minutes + net/README M1 update)

## Honest blockers & limits

- **Lighting verdict is Brett's.** Numbers are derived, not seen.
  If his re-test still fails readability, Board 004's next lever is
  a restrained hostile rim-light pass (custom shader on the bot
  material) — held back this phase because it spends complexity
  before the cheap levers were tried.
- **Feel remains hand-verified only.** New deck routes, barrel
  lethality, pickup cadence, streak windows — all static-verified;
  Brett's playtest rules.
- **Draw calls sit at the budget line** in the worst case (see
  table). Not over — but Phase 3 features must bring their own
  batching, and Nakamura's veto is armed.
- **worlddata is a transcription**, pinned by smoke counts; a
  world.js geometry edit that forgets the mirror fails T1–T5, but
  the single-source refactor (M2) is the real fix.
- **Snow full build and Mars** are deferred with owners (above),
  per Brett's own priority order — sequenced, not dropped.

## Decisions Brett needs to make

1. **§10.1 WebSocket**: ratify the board's recommendation
   (hand-rolled RFC 6455, zero dependencies) or overrule to `ws`.
   Gates M3 only; M2 proceeds either way.
2. **Playtest verdicts** on the Phase 2 build when it suits him:
   lighting/readability re-test, rooftop DMR nest + north-corridor
   watches (Board 004), plus the new deck/barrels/pickups feel.
3. **Push approval**: Phase 2 is local-only until Brett says go,
   same as every phase.

## Phase 3 proposal

1. **M2 loopback refactor** (Volkov/Fischer + Sato/Brooks):
   buildWorld consumes worlddata; browser game talks to the sim
   via the transport seam; single-player must feel identical —
   the regression gate for the whole stage.
2. **Snow full build** (Kimura/Solberg/Rahman) on the proven seam.
3. **Mars build** (Haddad/Alvarez/Blake) incl. the per-biome
   dressing hook + low-g spec vs the reachability gate.
4. **M3 socket + room of one** — after Brett's §10.1 decision.
5. **Board 004**: playtest verdicts (lighting, DMR nest,
   north-corridor), F9 live numbers, Phase 3 go/no-go.
