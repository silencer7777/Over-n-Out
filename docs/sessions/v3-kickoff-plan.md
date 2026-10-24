# Over n' Out — V3 Kickoff Plan

**Date:** Oct 24, 2026 · **Co-chairs:** Dominic "Apex" Cross (Studio CEO) +
Aurelia "Overlord" Kane (Division Zero) · **Gate:** OPEN — Brett approved
v3 after v0.2 "ARSENAL" shipped live and he playtested it.

**Mobilization: 83 seats** — 33 studio (docs/TEAM.md) + 20 Division Zero
(docs/V3-PLAN.md) + 30 Team Lumen (docs/GRAPHICS-TEAM.md). Division Zero
has read the first team's full record (session-001, board-meeting-001,
MULTIPLAYER.md) per the standing learn-first order.

## The vital task (Board Meeting 002)

**"Make v3 look and feel like a new game without breaking what works."**
Every seat attacks a different slice of that one task. The four fixes
Brett named personally from his v0.2 playtest are the phase's critical
path; everything else in Phase 1 exists to support or protect them.

## Phase 1 — THIS SESSION: feel, light, story, frame-rate, foundations

### Brett's four fixes (critical path)

| # | Fix | Owner(s) | Files |
|---|-----|----------|-------|
| 1 | Lighting rework — moodier, believable dusk; Verity sign-off | Mira "Golden Hour" Castellanos + Petra "Photon" Ilves + Ezra "Emissive" Vance | `js/world.js` (lighting/sky/fog only); exposure value spec'd for `main.js` |
| 2 | Controls / movement / jumping overhaul | Jamal "Stride" Carter + Tanya "Trigger" Ruiz + Anders "Bedrock" Lindqvist; Liv "Latency" Strand on input latency | `js/player.js` |
| 3 | Storyline context | Clara "Herald" Jensen + Eli "Ledger" Brooks + Maya "Lens" Ibrahim | `docs/STORY.md`, `js/story.js`, menu/HUD via Lens + integrator |
| 4 | Graphics batch 1 + frame-rate management | Team Lumen (below) | `js/perfmeter.js`, `js/quality.js`, `js/world.js` pass 2, `tools/smoke.mjs` budget checks |

Fix 2 detail (Stride's spec): mouse-look smoothing (frame-rate
independent, ~35 ms time constant — no perceptible lag), a sensitivity
setting (menu slider, persisted), acceleration/deceleration curves
(wish-velocity approach; top speeds unchanged: walk 5.6 / sprint 9.2),
coyote time 0.10 s, jump input buffering 0.12 s, variable jump height
(release-to-cut ×0.5), landing recovery feel (existing dip kept).
**Hard constraint:** jump velocity 9.5 / gravity 24 stay — held-jump apex
remains ≈1.88 m — and Hawkeye re-runs the reachability audit against
the new code (every route step from Board 001: 0.575 stair rises vs 0.6
step tolerance; 1.15 m crate-hop gaps vs apex). Any apex change must be
re-tuned until every route passes; the numbers are recorded in the
phase report.

Fix 4 detail (Team Lumen):
- FPS/frame-time meter on F9 — Nadia "Hertz" Kaminski (+ Gwen "Graph"
  Talbot): fps, frame ms, 1% low, draw calls, triangles (live from
  `renderer.info`).
- Baseline budget table for the current build, per GRAPHICS-TEAM.md:
  60 fps on a mid-range laptop, frame ≤16.7 ms, draw calls <150,
  triangles <250k — code-derived counts now, live-verified via the meter.
- Dynamic quality scaling v1 — Amara "Throttle" Diallo: EMA frame-time;
  sustained <50 fps steps quality down (pixel ratio → shadow size →
  shadows off), headroom >58 fps for 6 s steps back up; hysteresis +
  cooldown so it never oscillates or stutters mid-frame. Jun "Sixty"
  Nakamura holds the veto.
- One visible graphics upgrade batch — Ivy "Texture" Svoboda + Rhea
  "Refraction" Kapoor + Ada "Pipeline" Nowak: procedural surface
  richness (crate/wall canvas textures, ground bump detail), batching/
  culling wins, every change carrying a frame-cost note.

### Multiplayer foundation (Division Zero)

Dmitri "Mainframe" Volkov + Lena "Sync" Fischer + Sofia "Uplink"
Petrova, per docs/MULTIPLAYER.md §8.4: **M0** — protocol message
definitions + validation (`net/protocol.js`, §5/§7.6 rules), an
authoritative-server skeleton with rooms/tick/transport interface and
a loopback transport (`net/server.js`) — **not wired into gameplay**,
no sockets (the §10.1 hand-rolled-vs-`ws` decision is still Brett/
Vault's; the skeleton is transport-agnostic so either answer drops
in). Weapons-table-in-Node is already proven by the smoke suite.
Honest delta if M1 (headless sim) doesn't fit this phase: it goes in
`net/README.md` as a precise task list, not a shrug.

### Biome scaffold

Vera "Terraform" Ivanova + Freya "Canopy" Lindholm + Silas "Timberline"
Reed: `js/biomes.js` registry + seam. 'compound' = current arena
(default). 'forest' = first-pass scaffold behind the menu selector,
only if the four fixes are green. Snow and Mars are registry entries
marked planned with owners (below) — not built this phase.

### Integration

Anders "Bedrock" Lindqvist (integrator) + Maya "Lens" Ibrahim (DOM):
Lens owns `index.html` + `css/style.css` (story panel, briefing +
objective elements, sensitivity slider, biome selector, version tag
v0.3); Bedrock owns `js/main.js` wiring (story triggers, sensitivity →
player, meter + scaler instantiation, biome switching, Mira's
exposure value). DOM contract is fixed in advance (element ids) so
the two work in parallel without collisions.

### QA gates (all must pass before Phase 1 closes)

- Smoke suite green, extended: story module loads, net protocol
  imports, new js routes served, version 0.3.0-dev, v0.3 tag.
- Hawkeye reachability gate (tools/reachability.mjs): apex + step
  tolerance re-derived from the shipped constants; all Board 001
  routes pass.
- Jun "Sixty" Nakamura's performance review of every graphics change.
- Elena "Verity" Marsh's realism sign-off on the lighting rework.
- Board Meeting 002 minutes filed with the vital-issues list.

## Phase 2 — Biomes + headless sim

- Forest biome full build (Reed + Lindholm + Ivanova): dense cover,
  underbrush, low sightlines, on the `js/biomes.js` seam.
- M1 headless sim (Volkov + Fischer + Kenji "Ghost" Sato): Bot sim/
  puppet split, wave director as pure sim step, analytic hit volumes,
  Node soak test (MULTIPLAYER.md §8.4 step 2, §11 risk 1).
- Snow biome build starts (Hana "Blizzard" Kimura + Ingrid
  "Permafrost" Solberg + Nadia "Whiteout" Rahman).
- Gate: forest playable end-to-end; sim soak green; smoke green.

## Phase 3 — Mars + loopback

- Mars biome (Yara "Dune" Haddad + Mateo "Crater" Alvarez + Orion
  "Low-G" Blake): regolith, craters, low-g feel variant.
- M2 loopback refactor (Petrova + Lindqvist): `matchState` grouping,
  transport interface, LocalTransport; single-player must feel
  identical — the regression gate for the whole stage.
- §10.1 decision must be recorded by now (Vault + Brett).
- Gate: all three biomes selectable; loopback single-player
  indistinguishable from Phase 1 feel.

## Phase 4 — Online (v3 ship point)

- M3 socket + room of one (Whitfield + Menon): real transport, dev
  sessions local-only until Stage 2 auth lands (MULTIPLAYER.md §11
  risk 4 — a shipped stub is a vulnerability, not a shortcut).
- M4 co-op 2–4 players: shared waves, team-down run end, redeploy at
  wave start (Tessa "Loadout" Marchetti + Dario "Gatekeeper" Fontaine
  + Selene "Oracle" Voss load tests with bot players first).
- Gate: Brett + a second human complete a co-op run over the wire.

## Storyline arc (Herald, full text in docs/STORY.md)

The player is the last relay operator of Outpost Meridian; a rogue
carrier signal ("the Carrier") keeps reactivating the compound's
mothballed auto-security units in escalating waves. "Over n' Out" is
the sign-off the operator never gets to send — the channel stays open.
v3 arc hook: the signal has a source, and the biomes are the road to
it — forest relay → snow station → Mars uplink.

## Open decisions (not Phase 1 blockers)

- WebSocket: hand-rolled RFC 6455 vs the `ws` dependency (§10.1) —
  Vault recommends recording the call before Phase 3; Brett has the
  final say under the CTO sign-off rule.
- Game-server hosting (§9) — needed at Phase 4, not before.
- Stage 2 (accounts) ordering vs M3 sessions (§11 risk 4).
