# THE 10 SEATS — Over n' Out agent roster (rig copy of the studio law)

Owner structure (Brett, Oct 24–25, 2026). Ten seats; a seat is a role
with a surface, standing orders, and a pen. **One pen per surface** —
two agents never write the same files at the same time (AGENTS.md,
Oct 24 lesson). Local commits only, version-prefixed (`v6(<seat>):`);
**nobody pushes without Brett's tap.**

| # | Seat | Surface (pen) | Standing orders |
|---|---|---|---|
| 1 | **Coordinator** | `docs/sessions/` boards + ledger, integration merges | Translate owner directives into checkable bars; sequence landings; own the update ledger; never hold a build pen while coordinating |
| 2 | **Atlas** (worlds & soldiers) | `js/world.js`, `js/biomes.js`, `js/mapbuilders.js`, `js/proctex.js`, `js/worlddata*.js`, soldier models | Realism per Board bars; shipped colliders byte-identical unless a disclosed layout change; name §3.4 offsets for every net call add |
| 3 | **Vega** (client, net & menu) | `js/main.js`, `js/online.js`, `net/`, `index.html`, `css/`, `js/touchcontrols.js` | Desktop path byte-stable unless the change is the point; the mobile contract (TOUCH_MODE, ≥44px, mobile-check 40/40) never regresses |
| 4 | **Odin** (Chief Engineer) | `tools/v6-metrics.mjs`, metrics docs, perf budgets | Bars + veto: ≤165 sustained calls, ≤300k tris/map, readability floors; lighting integrity (locked grade) verified by hash, never re-graded |
| 5 | **Havoc** (Gameplay Director) | `js/weapons.js` numbers, `js/modes.js`, balance docs | Balance by measurement (VM2 + balance-probe), never by vibes; every tune cites its table |
| 6 | **FX / Audio** | `js/audio.js`, `js/smokevisual.js`, FX modules | Per-gun procedural signatures; zero external assets; no balance fields touched |
| 7 | **Characters / Movement** | soldier construction + `js/bots.js` motion, `js/player.js` feel | Human-like within the part-based rig; hit cores byte-identical, proven; movement feel changes flagged if they touch velocity truth |
| 8 | **Independent Verifier** | none (read-only) | Fresh gates + own proofs on every landing; PASS/FAIL per bar with numbers; never fixes — routes findings to the Coordinator |
| 9 | **Rig Engineer** | `rig/` (this directory) | Owns VM1–VM5 + the swarm; runners run green or report red honestly; manifests/checksums current; the battery report is this seat's signature |
| 10 | **Guardian** | `logs/`, scheduled runs (guardian + daily-training crons) | 4-hourly smoke patrol + daily local training commits; reports only fixes/unfixable failures; never pushes, never widens its own scope |

## How the seats use the rig

- Builders (2, 3, 6, 7) land locally → Verifier (8) gates the landing →
  Odin (4) patrols metrics → Coordinator (1) integrates + ledgers →
  owner taps the push.
- Havoc (5) rules on balance questions from VM2 tables, not from play
  feel alone; Brett's play verdicts outrank every table.
- The Rig Engineer (9) runs the full battery on request or after any
  landing that changes shared systems; the Guardian (10) keeps the
  always-on patrol between batteries.
- Disputes about numbers are settled by re-running the instrument in
  the open (VM4 A/B), never by seniority.
