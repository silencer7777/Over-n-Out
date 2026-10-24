# Over n' Out — V4 Report (version 0.4.0-dev)

- **Date:** October 24, 2026 · **Coordinator:** V4 Coordinator (integration,
  systems, Board 004, this report)
- **Team:** Vega (online systems, `net/`), Atlas (worlds & soldiers),
  Odin (Chief Engineer — verification, 3× metrics, perf veto),
  Havoc (Gameplay Director — balance, mode design pack, progression ruling)
- **Status:** ALL WORK IS LOCAL COMMITS ONLY. Nothing has been pushed;
  the live site still serves V3 Phase 2. Brett approves the push
  separately — and the first online test night depends on it (see
  Decisions).
- **Final gates on the shipped tree:** smoke **203 checks PASS** ·
  reachability **21 PASS** · biome-check **23 PASS** · soak **PASS** ·
  ws-soak **27/27 PASS** (gated inside smoke). 37 `v4(` commits
  (36 build commits in the appendix + this report).

---

## 1. Scope-coverage ledger

### Mission items (original green-light)

| # | Item | Verdict |
|---|------|---------|
| 1 | Landscape realism + bigger worlds | **SHIPPED** (Atlas) — compound ±47→±62 with ruin line + Relay Tower/North Ridge/Depot Row/Motor Pool POIs; forest →±58 (84 trees/92 bushes, fallen relay mast POI); mode-ready worlddata (zones, assault target, pickup caches, transmission pads) |
| 1a | Snow FULL build (V3 deferral) | **SHIPPED** (Atlas) — blanket, 46 drifts/16 rocks, buried-dome POI, ice field; snowfall layer wired by Coordinator |
| 1b | Mars biome build (V3 deferral) | **SHIPPED** (Atlas) — regolith, crater, mesas, uplink spire; solo low-g variant (gravity ×0.38, jump ×0.62) wired by Coordinator at the physics site |
| 2 | Soldier characters | **SHIPPED** (Atlas) — ~45-part bots: camouflage discipline, faction rig/visor palettes (hostile + friendly slate/green), full kit (helmet + camo band + NVG mount, plate vest, pouches, pack + straps, chest radio, thigh holster, shin guards, elbow pads, gloves); same 3 merged meshes / 7 draw calls / hit cores; V3 emissive readability floor preserved. Player viewmodel arms in soldier sleeves/gloves (Coordinator) |
| 3 | All-features realism pass | **SHIPPED with verdicts** — §3 below. Guns pass 2 (receiver details, DMR bolt/windage, shotgun shell carrier, pistol serrations/safety), lighting untouched at the locked baseline, audio duck on flash, HUD consistency |
| 4 | Game modes with goals/objectives | **SHIPPED** — 4 modes (Wave Defense, Team Deathmatch, Domination, Relay Assault), each with menu goal line, Relay briefing, HUD objective tracking, explicit win/lose, scoring + post-match results. Solo full; online per §4 note |
| 5a | Online: hand-rolled RFC 6455 transport | **SHIPPED** (Vega) — zero dependencies, RFC-vector-verified, clean transport seam (a `ws` overrule is still a swap) |
| 5b | Online: authoritative sessions | **SHIPPED** (Vega) — rooms by 4-letter code, hello carries mode + loadout (server-validated against `js/loadouts.js`), bots fill empty slots, server-side XP tallied from sim events priced by `js/progression.js` XP_VALUES, single `results` event per match |
| 5c | Online: client join flow | **SHIPPED** (Coordinator) — menu panel (callsign/room/server), snapshot puppets + interpolation, own-position correction, event presentation, graceful fallback to solo; tunnel-URL normalization + remember-last (§5) |
| 5d | Hosting brief | **SHIPPED** (Vega) — `docs/sessions/v4-hosting-brief.md`; Brett has since DECIDED (§5) |

### Owner additions mid-build

| Item | Verdict |
|------|---------|
| Personal loadouts (5 classes, attachments, tactical + lethal) | **SHIPPED** — 11 attachments as multiplier sidegrades (729 class combinations computed), frag (AoE falloff on the barrel model, players ×0.45 incl. thrower, no cooking) + flashbang (2.6 s × view-angle × distance, LOS required), attachments render as named parts on viewmodel + bot guns at +0 draw calls, loadout UI with level locks, server validates online |
| Progression / level-ups | **SHIPPED** — 30 levels, curve `round(400·(n−1)^1.6)`, 15 power unlocks (top at L18) + 7 prestige rewards L20–30 (titles/tints, ZERO power past L18), post-match XP summary, profile `ono-profile-v1` with V3 sensitivity migration — no save wipes. Online XP is server-computed per session and shown in results; it is **not** merged into the local profile (accounts are the future seam) |
| Bigger maps as a named workstream | **SHIPPED** — see item 1; reachability gate extended to all new areas (21 checks) and green |
| Difficulty tiers (Havoc pack) | **SHIPPED** — Recruit/Standard/Veteran/Elite on existing AI knobs (HP never scales), wave-band mixes, TDM Veteran captain |
| Bot un-wedge (Havoc queue #1) | **SHIPPED** — stuck detection (intent + no LOS + <0.4 m over 2.5 s) → wall-slide → lane reset, in client/sim parity |
| Transmissions (exploration rewards) | **SHIPPED** — 3 Relay pads (tower L2, ridge terrace, motor pool), walk-on playback, recovery count in the summary |
| Test-night runbook | **SHIPPED** — `docs/sessions/v4-test-night-runbook.md` |

### Deferred, with owners (nothing silently dropped)

| Item | Owner | Reason |
|------|-------|--------|
| Sim-side mode state machines for TDM/Domination/Assault **online** (score races, capture, channel win conditions inside `net/sim.js`) | Vega — V4.1 | Vega's delivered stack closed on transport + sessions + wave sim + full carriage (mode id, objectives slot, XP, results). Online Wave Defense plays end-to-end; the other modes join, present objectives, and play as sessions, but their win conditions are not yet simulated server-side. Solo enforces all four fully |
| Friendly-bot AI fill in solo TDM/Domination (4v4 with bot teammates) | Atlas (AI retarget) + Coordinator (wiring) — V4.1 | Atlas's friendly bots ship with palette + constructor ready, but `Bot.update` targeting is player-centric ("visual only" per his spec). Solo TDM/DOM is 1 operator vs the Kestrel roster; online fills with humans + hostile bots |
| Accounts / cloud saves (Stage 2 auth) | Roadmap | Board-ruled future seam. **Until it lands, hosted instances stay invite-only** — session tokens are shape-checked only |
| Mars spire mesh reclaim (6 meshes vs 2) | Coordinator/Odin — tools-side | A three-stub fidelity gap; cosmetic perf only, Mars is not over budget |
| Forest/snow draw-call countermeasures | Atlas + Odin (veto call) | See §4 — worst-case upper bound sits 1–5 calls over the line |
| M2 full loopback refactor (one code path solo/online) | Uplink seat — roadmap | Parity today is by shared data tables + mirrored rules, per Board 004 |

---

## 2. What makes this a new generation (not a reskin)

Systems that **did not exist in V3**: (1) four game modes with goals,
win/lose conditions and scoring; (2) real online sessions — a
hand-rolled WebSocket server running authoritative matches other
people join by room code; (3) create-a-class loadouts — 5 classes,
11 attachments, frag + flash; (4) progression — XP, 30 levels,
unlocks, prestige; (5) two whole biomes completed (snow, Mars) and
every map expanded; (6) soldiers as uniformed figures with faction
discipline; (7) exploration transmissions. Version stepped
0.3.0-dev → **0.4.0-dev**; V3 settings migrate forward, nothing wiped.

## 3. Per-feature realism verdicts (Verity bar, board-recorded here)

| Feature | Verdict | Basis |
|---------|---------|-------|
| Guns | **PASS** | Named real parts per class + pass 2 (ejection port, mag release, selector, bolt handle, shell carrier…); attachments visibly render; Δ0 draw calls |
| Characters / soldiers | **PASS** | Atlas soldier pass: camo + faction palettes + full kit, proportions/hit cores unchanged, readability floor kept |
| Soldier uniform discipline | **PASS** | Hostile vs friendly read by rig/visor colour at distance; emissive floor prevents shadow crush |
| Lighting | **PASS** | **Unchanged from the owner-approved Phase 2 grade** — hemisphere 0.95, sun 1.85, exposure 1.10, emissive floor 0x180505. No V4 commit touched a lighting value; improve-only rule honored by construction |
| World / landscape | **PASS** | Ring expansions, POIs/landmarks for navigation-by-sight, biome surfaces per biome (drifts, regolith, crater) |
| Biome surfaces | **PASS** | Snow blanket + ice field; Mars regolith/mesas; forest density doubled-down with ring tree-lines |
| Modes presentation | **PASS** | Goal line in menu, Relay briefing per mode, live objective HUD, results screen — one fiction, four games |
| Audio believability | **PASS** | Flash bang now ducks the master bus ~1.2 s; throw whoosh; suppressed fire reads quieter (flash dim 0.3 + no tracer) |
| Loadout presentation | **PASS** | Menu class tabs + per-slot pickers with level locks; chosen parts visible on the gun in hand and on bots |
| HUD consistency | **PASS** | Score line, gear HUD, gold headshot tick, directional damage arc — same visual language as the V3 HUD |

**3× REALISTIC score: 10 of 10 features at the bar** (V3 ended at 4).
Target was ≥8 — **MET**, with lighting held at the locked baseline
rather than re-graded.

## 4. Performance (Odin's harness, final HEAD — `docs/sessions/v4-metrics.md`)

Static scene-graph audit, sustained worst case (9 bots, heaviest
viewmodel, no frustum culling — an upper bound; live play culls):

| Scene | Draw calls | Line | Tris | Verdict |
|-------|-----------|------|------|---------|
| Compound | 157 | ≤165 | 28,215 | ✅ under |
| Forest | 166 | ≤165 | 81,277 | ⚠️ +1 over (upper bound) |
| Snow | 169 (+1 snowfall in play) | ≤165 | 32,839 | ⚠️ +4–5 over (upper bound) |
| Mars | not in harness table | — | — | 4 live biomes confirmed |

Triangles are far under the 300k line everywhere. **3× SMOOTH:**
server sim **0.088–0.121 ms/tick** vs the 0.5 ms bar (**PASS**, ~4×
headroom at the real caps of 4 humans + 9 bots); snapshot 1,785 B of
the 4,096 B cap (watch item); draw calls **PARTIAL** — compound
under, forest/snow marginally over the no-culling bound after
Atlas's expansions. Odin's conditional veto remains armed on this;
the reclaim path is ring-density merging (Atlas). GPU truth is
Brett's F9 check (metrics file lists the exact four readings to
take). Two stale harness texts are noted for Odin: the progression
"spec drift" warning (superseded — Havoc adopted the 15-rung ladder
+ prestige in `1c73c29`) and the "Snow (scaffold)" scene label.

## 5. Hosting — DECIDED

Brett picked **Cloudflare quick tunnel from his Mac for test
nights**; Render free tier (Vega's recommendation) stays parked as
the always-on alternative. Shipped for it: the client's server field
accepts a pasted `https://….trycloudflare.com` URL verbatim
(converts to `wss://`, appends the `/play` upgrade path), remembers
the last address, and the runbook
(`docs/sessions/v4-test-night-runbook.md`) walks the Mac Terminal
steps. Realities: new URL every session; Mac stays awake/online;
invite-only by room code until Stage 2 auth exists. **A test night
requires the V4 push first** — the Mac clones from GitHub and
friends play the pushed Pages build.

## 6. Deviations & honest notes

- Solo TDM/Domination: no friendly bot fill (see deferrals) —
  scoreThem accrues via player deaths; rosters are 4 hostiles.
- Solo Relay Assault uses the wave director ("waves-in-miniature",
  the pack's own loop language) with the ruled solo carve-outs:
  death → 4 s redeploy, channel decays 2%/s unchannelled. The
  continuous defender-roster model is the online/sim form.
- Solo bot flash-blind is a freeze approximation; the sim's blind
  (burst clear + visible-time reset) is the online form.
- Assist XP (40) is online/co-op only — solo, the player is always
  the killer. Online XP is server-scored per session, not persisted
  to the local profile (accounts seam).
- Havoc's balance was implemented as ruled, including the three
  weapon retunes he landed himself (pistol 25, SMG bloom 1.3,
  shotgun falloff 6/24/0.25; AR pinned).

## 7. Decisions Brett still owns

1. **PUSH V4** — everything above is local. The push is also the
   gate for the first test night (§5).
2. **§10.1 ratification** — V4 proceeded on Board 003's
   recommendation (hand-rolled RFC 6455, zero deps; Vega's README
   records it as decided-by-build). Overruling to `ws` remains a
   transport swap, not a rewrite.
3. **Havoc's 5 taste questions** (ruled defaults already shipped;
   override any): difficulty select NORMAL-only vs STORY/HARD now;
   Assault solo redeploy carve-out; flash self-blind no-exemption;
   Domination zone-adjacent spawns in V4.1; progression pace —
   brisk (coefficient 400, shipped) vs stretched (700).
4. **Playtest verdicts still owed:** rooftop DMR nest and
   north-corridor spawn (Board 004 ruled what's ruleable; geometry
   unchanged pending his eyes); corner ring spawns were cut on
   measured ws-soak evidence — he can order them back alongside
   bot-pathing work.
5. **F9 checks** (metrics file): compound + forest readings at
   wave ≥6, the smoothness witness, and two-client online feel
   once a test night runs.

## Appendix — V4 build commits (36, oldest first)

Board/docs: `1bf0db5` Board 004 · `57ca8b8` Addendum 2 (Odin+Havoc) ·
`957ef1c` amendments (lighting locked, ladder reconciled).
Systems: `f19f0b3` data layer · `039d25a` briefings + net contract ·
`93e6ff2` 0.4.0-dev shell · `7394156` full client integration ·
`a8f3141` Havoc data alignment · `a5b4671` Havoc client mechanics ·
`d532d4d` un-wedge parity · `8475459` tunnel readiness ·
`28d4216` lint fix · `0831a03` Atlas integration batch.
Net (Vega): `3a8ec01` RFC 6455 core · `62e782c` WebSocketTransport ·
`e1281d7` session carriage · `6341f85` game-server entry ·
`86dbdc7` half-open fix · `eb3438c` ws-soak 27 · `c6c32d9` soak
determinism · `2054e90` smoke carriage · `9bc6a86` README ·
`b367a40` hosting brief.
Worlds (Atlas): `c209af9` compound ring · `7f1e7ec` forest ·
`7e9b69a` snow full · `a595b9f` Mars full · `6e0850e` soldiers.
Gameplay (Havoc): `b659017` balance probe · `c5f62aa` baseline ·
`7b27866` mode design pack · `1c73c29` progression ruling ·
`a55cf9f` weapon tuning.
Chief (Odin): `46733a8` metrics harness · `183a2e3` baseline.
Graphics: `e82c74a` guns pass 2.
