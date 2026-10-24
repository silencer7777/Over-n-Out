# Board Meeting 002 — Minutes

**Date:** Oct 24, 2026 · **Co-chairs:** Dominic "Apex" Cross (Studio CEO) +
Aurelia "Overlord" Kane (Division Zero) · **Called by:** Brett, opening
the v3 gate after playtesting v0.2 "ARSENAL" live.

**Attending:** all three teams — the 33-seat studio (docs/TEAM.md),
Division Zero's 20 (docs/V3-PLAN.md), Team Lumen's 30
(docs/GRAPHICS-TEAM.md). 83 seats, one vital task.

## The vital task

**"Make v3 look and feel like a new game without breaking what works."**

Brett's four playtest fixes are the critical path. Every seat attacked
a different slice of the same task; resolutions below. Full detail:
docs/sessions/v3-phase-1-report.md.

## Vital issues

1. **Lighting reads wrong** (Brett, playtest). Flat purple wash, sun too
   high/bright for the dusk the sky promises.
   *Owner: Mira "Golden Hour" Castellanos.* **RESOLVED** — sun to
   exactly 10° at deeper amber (0xff8f3c, 1.75), slate-blue fill
   (0x6f83b0/0.60), fog unified to the sky (0x352130, 42→138), exposure
   1.1 → 0.95. Verity's readability floor proven arithmetically: 0% fog
   blend at 40 m. Live visual confirmation rides on Brett's v0.3
   playtest — the one check no automation here can make.
2. **Controls iffy; movement and jumping feel off** (Brett, playtest).
   *Owner: Jamal "Stride" Carter.* **RESOLVED** — look smoothing,
   sensitivity setting, wish-velocity accel curves, coyote 0.10 s, jump
   buffer 0.12 s, release-to-cut variable jump. Jump constants
   untouched (9.5/24, apex 1.8802 m) and Hawkeye's new reachability
   gate re-derived every Board 001 route from the shipped code:
   13/13 checks, all 5 routes PASS.
3. **No storyline context** (Brett). Who am I, what is this place, why
   do they keep coming?
   *Owner: Clara "Herald" Jensen.* **RESOLVED** — canon in
   docs/STORY.md (Cpl. Rhea "Relay" Calder, Outpost Meridian, the
   Carrier); delivered in-game as menu transmission panel, per-wave
   briefings, a persistent HUD objective line, and death/wave-clear
   context lines (Maya "Lens" Ibrahim's surfaces, Anders "Bedrock"
   Lindqvist's wiring).
4. **Graphics need a massive upgrade — without costing frames** (Brett).
   *Owners: Vivian "Lumen" Hart + Jun "Sixty" Nakamura.* **RESOLVED
   for Phase 1 scope** — F9 frame-time meter (Kaminski), dynamic
   quality scaling v1 (Diallo), procedural crate/wall textures + ground
   bump + static-mesh matrix freeze (Svoboda/Kapoor/Nowak), baseline
   budget table recorded (≈105–135 draw calls vs <150 budget; ≈12k
   triangles vs <250k). Live fps numbers await the first metered
   playtest — no WebGL in the test environment, stated plainly.
5. **New code must not reopen the security class Board 001 closed.**
   *Owner: Grace "Aegis" Liu.* **RESOLVED, no findings** — the js/
   zero-external-calls lint now covers 10 modules including all four
   new ones; story text flows through textContent only; the net/
   skeleton opens no sockets and validates every message shape
   (§7.6 rules in net/protocol.js).
6. **Session process hazard: squad files landed after their handoffs,
   twice** (quality.js, net/server.js), and one early commit message
   carries a pre-verification count (biomes: 13 trees claimed, 12
   verified at runtime).
   *Owner: Apex (process).* **RESOLVED** — every commit after the
   catch was verified against on-disk content (syntax + demo + SHA)
   before landing; the verified biome count (12 trees / 18 bushes) is
   the record in the phase report and these minutes.
7. **M1 headless sim did not fit Phase 1.**
   *Owner: Dmitri "Mainframe" Volkov.* **DEFERRED BY DESIGN** — M0
   shipped complete (protocol, server skeleton, loopback, demo,
   weapons-in-Node). The M1 delta is a precise, owned task list in
   net/README.md (Bot sim/puppet split — Sato/Vega; wave director as
   pure step — Brooks/Fischer; analytic hit volumes — Delgado/Volkov;
   world-data extraction — Brandt/Sayeed; Node soak — Voss/Gallagher/
   Patel). Scheduled Phase 2.
8. **§10.1 WebSocket decision still open** (hand-rolled RFC 6455 vs
   the `ws` dependency).
   *Owners: Victor "Vault" Hale + Brett.* **DEFERRED** — not a Phase 1
   blocker; the M0 skeleton is transport-agnostic so either answer
   drops into the same seam. Must be recorded before Phase 3.
9. **Forest is a scaffold, not a biome yet.** Canopy crowns are
   simplified, underbrush has no colliders/LOS behaviour.
   *Owners: Vera "Terraform" Ivanova + Silas "Timberline" Reed.*
   **DEFERRED to Phase 2** with the full-build scope (layered canopy,
   bush gameplay per the world.js rule, sightline tuning vs the F9
   meter's live numbers).
10. **Snow and Mars not started.**
    *Owners: Hana "Blizzard" Kimura / Yara "Dune" Haddad.*
    **SCHEDULED** — Phase 2 (snow build starts) and Phase 3 (Mars),
    per the kickoff plan. Registry entries with their names are
    already in js/biomes.js and the (disabled) menu options.
11. **Carried watches from Board 001, still open:** stair step margin
    (0.6 tolerance vs 0.575 rise — a 0.025 margin, unchanged by v3;
    Hawkeye), rooftop DMR nest, slow north-corridor spawn.
    *Owner: Walter "Hawkeye" Boone.* **OPEN** until Brett's v0.3
    playtest rules on them.
12. **Draw calls approach budget at the alive cap** (≈135 of <150,
    bots at 7–8 calls each are the largest consumer).
    *Owners: Jun "Sixty" Nakamura + Leo "Feather" Park.* **WATCH** —
    bot mesh batching/instancing is the named Phase 2 candidate if a
    metered playtest shows pressure.

## Seat assignments (this phase)

- **Studio:** Apex (chair/process), Vault (dependency veto — none
  exercised), Verity (realism sign-off), Trigger (gameplay review),
  Lockdown (net validation review), Sentry (QA spec), Bedrock
  (integration), Stride (movement), Ballistic (hit-volume spec for
  M1), Hunter/Ghost (M1 bot-split spec), Echo (no audio changes —
  descriptor tables carried), Pipeline (server review), Aegis
  (security review), Feather (perf co-review), Mason (world-data
  spec), Lens (UI), Ledger (story systems + M1 wave spec), Wrench
  (tooling), Tripwire (smoke + reachability implementation), Herald
  (story canon + records), Hawkeye (reachability gate), Bullseye
  (regression), Sprout (minutes filing). Juniors on standby — none
  activated.
- **Division Zero:** Overlord (co-chair), Mainframe (net lead), Sync
  (protocol + sync model), Uplink (multiplayer direction), Terraform
  (biome seam), Canopy (forest vegetation), Timberline (forest
  biome), Backbone/Firewall Prime/Gatekeeper/Loadout/Oracle (M1–M4
  planning seats; Oracle owns the Phase 2 soak), Blizzard/Permafrost/
  Whiteout (snow — scheduled), Dune/Crater/Low-G (Mars — scheduled),
  Pathfinder (navigation spec), Overclock (streaming review).
- **Team Lumen:** Lumen (graphics direction), Raytrace (technique
  approval), Golden Hour (lighting), Sixty (frame-rate chief/veto),
  Pipeline (batching), Vista (environment composition), Photon +
  Emissive (lighting squad), Umbra (shadow review), Bloom (grade
  review), Terra/Verdant (terrain/foliage review), Cumulus (sky
  review), Texture (textures), Occlusion (culling review), Refraction
  (materials), Silhouette (model review), Hertz (meter), Profiler
  (GPU cost review), Throttle (quality scaling), Vsync (smoothness
  review), Budget (draw-call accounting), Overdraw (overdraw review),
  Latency (input-latency budget for the movement overhaul), Nebula/
  Polygon/Tint (art support), Watchdog/Graph/Regression (perf QA —
  live verification pending first metered playtest).

## Adjournment

Phase 1 closes when the chairs' verification is on the final tree:
smoke 103/103 and reachability 13/13, both re-run by the chair after
the last commit. Nothing pushes to GitHub without Brett's approval —
the live site still runs v0.2.
