# Over n' Out — V3 Phase 1 Report

**Date:** Oct 24, 2026 · **Co-chairs:** Dominic "Apex" Cross (Studio CEO) +
Aurelia "Overlord" Kane (Division Zero) · **Version:** 0.3.0-dev ·
**Status: PHASE 1 COMPLETE — all gates green. Nothing pushed; the live
site still runs v0.2 until Brett approves.**

83 seats mobilized (33 studio + 20 Division Zero + 30 Team Lumen).
11 worker squads ran in 3 waves, one file owner per area, every commit
verified against on-disk content by the chair before landing.

## Fix 1 — Lighting rework (Castellanos + Ilves + Vance; Verity sign-off)

Moodier, believable dusk, achieved through colour and contrast rather
than hiding the arena. Exposure (in main.js) set by the integrator per
Castellanos's spec.

| Item | Before (v0.2) | After (v0.3) |
|---|---|---|
| Sun elevation | ~12.3° | exactly 10.00° (same azimuth) |
| Sun colour / intensity | 0xffa860 / 2.0 | 0xff8f3c / 1.75 |
| Sun disc colour | 0xffdca8 | 0xffbf6e |
| Hemisphere sky / ground | 0x8a6fc0 / 0x33221a | 0x6f83b0 / 0x2e231c (cooler slate) |
| Hemisphere intensity | 0.85 | 0.60 |
| Fog | 0x4a3448, 45→150 | 0x352130, 42→138 (= scene.background) |
| Sky zenith / horizon | #130f33 / #f7b267 | #0a0d26 / #ffb056 (deeper, richer, tighter band) |
| Tone exposure | 1.1 | 0.95 |

Readability floor (Verity): fog starts at 42 → a hostile at 40 m has
0% fog blend; far plane 138 keeps cross-arena sightlines. A single
SUN_POS now drives light, disc and glow so picture and light agree.

## Fix 2 — Controls / movement / jumping (Carter + Ruiz + Lindqvist; Strand)

- **Look:** sensitivity setting (public `player.sensitivity`, menu
  slider 0.4–2.5, persisted in localStorage) + frame-rate-independent
  smoothing, k = 1 − exp(−30·dt), ~33 ms time constant (Latency's
  budget: no perceptible lag). Targets accumulate raw deltas; pitch
  clamp ±1.45 preserved.
- **Movement:** wish-velocity accel/decel curves — ground 40/s with
  input, 55/s stopping, air 9/s. Top speeds unchanged exactly:
  walk 5.6, sprint 9.2 (harness-verified, no overshoot).
- **Jump:** coyote time 0.10 s; input buffer 0.12 s; variable height —
  release while rising (vel.y > 2) cuts velocity ×0.5 once per jump.
  Tap-jump apex ≈0.58 m; **held-jump apex unchanged: analytic
  1.8802 m** (JUMP_VELOCITY 9.5 / GRAVITY 24, exported constants;
  integration order preserved byte-for-byte from v0.2).
- **Reachability re-audit (Hawkeye's new gate, tools/reachability.mjs):**
  constants re-derived from the shipped source; discrete-apex sim
  1.8017 m vs the 1.15 m crate-hop + 0.45 margin gate; step tolerance
  0.6 > stair rise 0.575. **All 5 routes PASS** (Stair A, Stair B,
  crate hop, deck stairs, deck crate hop). 13/13 checks.

## Fix 3 — Storyline context (Jensen + Brooks + Ibrahim; wiring Lindqvist)

- **Canon — docs/STORY.md:** Cpl. Rhea "Relay" Calder, sole remaining
  operator of Outpost Meridian, holds the compound against the
  compound's own mothballed Kestrel Dynamics auto-security units,
  reactivated in escalating waves by a rogue carrier signal ("the
  Carrier") as its lock strengthens. If the relay falls, the Carrier
  gets a broadcast tower. "Over n' Out" is the sign-off Calder never
  sends — the channel stays open.
- **In-game (text/UI only):** menu transmission panel (premise);
  per-wave briefing line under the wave banner (bands escalate:
  wave 1 "first units waking up" → wave 6+ "Signal peak. Elite units,
  full lock-on"); persistent HUD objective line; wave-clear context
  line; death-screen context line appended to the death message.
  All text via textContent/DOM APIs — the no-innerHTML rule holds.

## Fix 4 — Graphics batch 1 + frame-rate management (Team Lumen)

- **FPS meter (Kaminski + Talbot) — js/perfmeter.js:** F9 toggles
  (default off); fps (EMA), frame ms, ~1% low, draw calls and
  triangles read live from renderer.info; text refresh throttled to
  250 ms; zero hot-path allocation.
- **Dynamic quality scaling v1 (Diallo; Nakamura's veto rules) —
  js/quality.js:** EMA frame-time (α=0.05); step down at <50 fps
  sustained 2 s, step up at >58 fps sustained 6 s, 2.5 s cooldown,
  dead band between — no oscillation, no mid-frame changes.
  L0: pixelRatio min(dpr,2), shadows 2048 · L1: pr 1.5, shadows 2048 ·
  L2: pr 1.25, shadows 1024 · L3: pr 1.0, shadows off. Shadow resizes
  dispose + null the map so they actually take effect.
- **Visible batch (Svoboda + Kapoor + Nowak) — world.js pass 2:**
  seeded procedural canvas textures for crates (planks/frame/nails,
  256², both crate tones preserved as multipliers) and walls (2×2
  concrete panels, seams, grime, 256²); ground gains bumpMap from its
  existing texture (bumpScale 0.04, zero extra upload); ~39 static
  solids get matrixAutoUpdate = false. One-time GPU cost ≈0.65 MiB;
  per-frame saving ≈2,340 matrix compositions/sec at 60 fps, offset by
  one map sample on crate/wall fragments.
- **Baseline budget (code-derived; live numbers await the first
  metered playtest — no WebGL in the test environment):**

| Metric | Budget | Baseline |
|---|---|---|
| Frame rate | 60 fps / ≤16.7 ms | managed by scaler; meter verifies live |
| Draw calls | < 150 | ≈105–115 in-wave; ≈135 at the 9-bot cap (bots 7–8 each — the largest consumer) |
| Triangles | < 250k | ≈12k — per-pixel cost dominates (DPR≤2, 2048 PCFSoft shadows, ACES), which is what the scaler steps |

## Multiplayer foundation (Volkov + Fischer + Petrova) — M0 COMPLETE

- **net/protocol.js:** PROTOCOL_VERSION 1; frozen MSG (8 types);
  validateHello / validateInput implementing §5 shapes + §7.6 rules
  (strict booleans, pitch ±1.45, weapon 1–5, seq); LIMITS (4 KB /
  40 per-sec / 10 s idle). Pure, zero imports.
- **net/server.js:** GameServer (rooms, 30 Hz tick, snapshotRate 20,
  validated routing, 4-player room cap, §8.2 sim landing zone marked)
  + LoopbackTransport; import-safe; **no sockets** — §10.1
  (hand-rolled vs `ws`) remains Brett/Vault's open decision and the
  skeleton is transport-agnostic.
- **Verified:** demo `node net/server.js` exits 0 (welcome/pong,
  input stored, tick 3 @ ~120 ms); weapons table imports in Node
  (5 weapons) — M0's shared-data requirement proven.
- **M1 did not fit this phase — by design, not by slippage.** The
  precise delta is filed in net/README.md with owners (Bot sim/puppet
  split; wave director as pure step; analytic hit volumes; DOM-free
  world-data extraction; Node soak test). Single-player is untouched
  by all of it.

## Biomes (Ivanova + Lindholm + Reed) — scaffold shipped

js/biomes.js registry: compound (live, default) · forest (scaffold) ·
snow (planned — Kimura) · mars (planned — Haddad). Forest behind the
menu theater selector: 12 trees + 18 underbrush bushes (instanced,
world.js visual language), 1 collider + 1 hit-proxy per tree, all
placement machine-verified clear of decks/stairs/hops/cover/central
ground/sightline corridor and ≥3.6 m from all 9 spawns; clearBiome
restores the collider/shootable arrays index-exactly. Phase 2 owes:
layered canopy density, underbrush gameplay (colliders/LOS per the
world.js bush rule), sightline tuning.

## Verification (chair, final tree)

- `node tools/smoke.mjs` — **103/103 checks, SMOKE PASSED** (syntax
  ×16, js/ security lint ×10, weapons contract + AR pin, story section
  S1–S7, net section N1–N8, new routes + HTML ids, headers, traversal
  probes ×5 blocked).
- `node tools/reachability.mjs` — **13/13, REACHABILITY PASSED.**
- Working tree clean; every Phase 1 commit below verified on disk.

## Commits (local only — 14)

2e753c7 kickoff + 0.3.0-dev · 9b1c289 perf meter · 7439fbc lighting ·
887af3b movement · 04f159b movement completion · 92e4b20 story ·
51baad0 + 731a794 net M0 · 96b1ceb UI · 25e5acd quality scaling ·
15e1195 graphics batch · 00ef9c7 biomes · e17c490 integration ·
8786cac QA gates · (this report + Board 002 minutes)

## Honest blockers & limits

- **Feel is verified by harness and math, not by hands.** Look
  smoothing, jump cut and the new grade need Brett's playtest; the
  Board 001 watches (rooftop DMR nest, stair margin, north-corridor
  spawn) stay open until then.
- **No live fps/draw-call capture exists yet** — the baseline table is
  code-derived; the F9 meter's first real numbers come from Brett's
  next session (Watchdog/Graph/Talbot's live pass is queued on it).
- **§10.1 WebSocket decision is open** (Brett/Vault) — gates Phase 3
  sockets, nothing in Phase 1.
- **M1 (headless sim) not started** — owned, specced, Phase 2.
- **Forest is a scaffold** — density and underbrush gameplay are
  Phase 2, named as such everywhere it appears (registry, menu).

## Phase 2 proposal

1. **Forest full build** (Reed/Lindholm/Ivanova + Occlusion): layered
   canopy, underbrush gameplay, sightline tuning against live meter
   numbers; bot draw-call batching evaluated by Nakamura/Feather if
   the cap pressure is real.
2. **M1 headless sim** (Volkov/Fischer + Sato/Vega + Brooks): the
   net/README.md delta, ending in Voss's Node soak test (bot LOS cost
   profiled — §11 risk 1).
3. **Snow biome build starts** (Kimura/Solberg/Rahman) on the proven
   biome seam.
4. **Playtest gate:** Brett plays v0.3 (lighting grade, movement feel,
   story tone, forest) → Board 003 rules on the carried watches and
   the §10.1 decision before Phase 3 opens.
