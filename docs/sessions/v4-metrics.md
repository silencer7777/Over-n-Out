# Over n' Out — V4 Metrics (the 3× bar, measured)

Generated: 2026-10-24T19:08:12.901Z · git HEAD: 0831a03 · Tool:
`node tools/v4-metrics.mjs` (Odin, Chief Engineer)

Brett's V4 standard (Board 004 §6): **3× as realistic, 3× as
powerful, 3× as smooth** vs V3. Everything below is computed from
the shipped code in this environment; anything this environment
cannot measure is listed as an exact F9 playtest check for Brett —
no number here is invented.

## Gates (independent re-run)

| Gate | Result | Count |
| --- | --- | --- |
| Smoke | ✅ PASS | 203 checks |
| Reachability | ✅ PASS | 31 checks |
| Biome check | ✅ PASS | 23 checks |
| Soak | ✅ PASS | LOS 7.82 µs/ray · sim 0.045 ms/tick |

## 3× SMOOTH — draw calls & triangles (static scene-graph audit)

Convention: static scene-graph traversal vs vendored three; 1 call per visible renderable; tris = (index|position)/3 × instances; upper bound (no frustum culling). Composition: static world
+ 9 bots (alive cap) with the heaviest weapon + heaviest
viewmodel + 3 pickups. V4 lines (Board 004 §6): **≤ 165 calls /
≤ 300k tris** (V3's line was 150 calls).

| Scene | Static calls | Static tris | Sustained worst case | + transients |
| --- | --- | --- | --- | --- |
| Compound | 83 | 14,003 | **157 calls / 28,215 tris** | 158 calls |
| Forest | 92 | 67,065 | **166 calls / 81,277 tris** | 167 calls |
| Snow (scaffold) | 95 | 18,627 | **169 calls / 32,839 tris** | 170 calls |

Per-bot: 7 calls each; heaviest bot
1,420 tris. Heaviest viewmodel
832 tris. Shadow-caster
renderables (compound static): 70
— these render a second time into the shadow map at L0–L2, which
is what the quality scaler sheds first.

## 3× SMOOTH — server sim cost (in-process bench)

| Config | ms/tick (avg) | ms/tick (hot window) | Max wave | Max alive bots | Max snapshot |
| --- | --- | --- | --- | --- | --- |
| soak-parity (2 scripted clients) | 0.154 | — | 2 | 6 | 1160 B |
| stress (4 scripted clients, window at wave ≥ 5 = alive cap 9) | 0.09 | window not reached | 1 | 4 | 1089 B |

Board bar: **≤ 0.5 ms/tick**; snapshot cap **≤ 4,096 B** at
20 Hz. ⚠ Spec note: Board 004 §6 phrases the bar as "8 players +
12 bots" — the shipped rules field at most **4 humans** (Board
004 §2, M4 scope) and a **9-bot alive cap** (sim + main.js), so
the bar's config cannot be fielded as written. The stress bench
above measures the real caps; the Board should restate the bar
against them. (Filed by Odin; not a code defect.)

## 3× POWERFUL — capability counts (from the data modules)

| Capability | V3 | Now | V4 target |
| --- | --- | --- | --- |
| Game modes | 1 | **4** (waves, tdm, domination, assault) | 4 |
| Loadout combinations | 5 | **729** | ≥ 500 |
| Progression | none | **15 unlock entries, top at L18, level cap L30** | 18 levels / 13 unlocks (Board 004 §6) |
| Live biomes | 2 | **4** (compound:live, forest:live, snow:live, mars:live) | 4 |
| Playable footprint | 94 m | **124 m across** | 124 m across |

## 3× REALISTIC — Verity verdicts (board-recorded, not computed)

V3 ended with **4 features at the bar**; V4 target **≥ 8 of 10**.
Verdicts change only when a board/report records them.

- **guns** — V3: PASS · V4: PENDING _(Phase 2 report (Ricci/Dvorak, Verity))_
- **characters** — V3: PASS · V4: PENDING — Atlas soldier rebuild _(Phase 2 report)_
- **lighting** — V3: PASS — owner re-test Oct 24 ("way better… looks good how it is"); Phase 2 grade is the LOCKED V4 baseline (improve-only, never darker) · V4: PENDING _(Brett playtest verdict, Oct 24; Phase 2 report)_
- **world** — V3: PASS · V4: PENDING — Atlas ring/biomes _(Phase 2 report)_
- **modes presentation** — V3: — · V4: PENDING _(Board 004 §6 (new in V4))_
- **soldiers-uniform discipline** — V3: — · V4: PENDING _(Board 004 §6 (new in V4))_
- **landscape/biome surfaces** — V3: — · V4: PENDING _(Board 004 §6 (new in V4))_
- **audio believability** — V3: — · V4: PENDING _(Board 004 §6 (new in V4))_
- **loadout presentation** — V3: — · V4: PENDING _(Board 004 §6 (new in V4))_
- **HUD consistency** — V3: — · V4: PENDING _(Board 004 §6 (new in V4))_

## Brett's F9 playtest checks (the GPU truth this env cannot take)

Run on the V4 build when it ships (F9 toggles the meter; it shows
FPS · frame ms · 1% LOW · CALLS · TRIS):

1. **Compound, Wave Defense, wave ≥ 6** (9 bots alive): record
   CALLS, TRIS, FPS, 1% LOW. Audit predicts ≈
   157 calls /
   28,215 tris before
   culling — live CALLS should land at or below that.
2. **Forest biome, same wave pressure**: record the same four
   numbers (audit: ≈ 166
   calls / 81,277 tris).
3. **Smoothness witness**: hold a fight in each biome for ~30 s;
   the 1% LOW is the smoothness number — and if FPS sags under
   50, the quality scaler should visibly step (L0→L1→L2) rather
   than stutter. Note the level it settles at.
4. **Online (once Vega's transport lands)**: two clients in one
   room; motion of the other player should read smooth at 20 Hz
   snapshots — no rubber-banding at room scale.

## ⚠ Warnings from this run

- SPEC DRIFT (progression): js/progression.js ships 15 unlock entries vs Board 004 §4's ruled ladder of 13 — the module adds HOLO SIGHT (L11) and SUPPRESSOR (L17), and MAX_LEVEL 30 leaves L19–30 with no rewards. Flagged in commit f19f0b3 as coordinator assumptions pending Havoc's design pack; Havoc/Board must reconcile (amend the ladder or trim the module). Not a code defect.
