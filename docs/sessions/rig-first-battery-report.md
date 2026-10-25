# RIG FIRST BATTERY — consolidated report (Oct 25, 2026, ~2:39–2:45am PT)

Owner authorization: "Go ahead and run it once it's done. I'm going to
be sleeping." Run unattended by the Rig Engineer seat. Nothing pushed;
no game code edited. Full per-VM outputs: `rig/reports/` (dated
2026-10-25, suffix `8903c76`).

## What was tested

- **Commit `8903c7663e706c393ba5f2c95538920aafc41fd0`** — HEAD at run
  time, the last stable committed tree. It contains the whole V6-3
  wave (two-page menu, per-gun FX/audio, human-like characters +
  movement smoothing, Stage-1 enterable HQ + vivid + weather) on top of
  Update 2, plus the rig itself (rig commit touches no game code).
- Battery window: 09:39:13–09:44:49 UTC, ~5.6 minutes wall, all five
  VMs + the swarm, sequential on a 2-core box shared with the studio.

## Results at a glance

| Environment | Verdict | Headline numbers |
|---|---|---|
| VM1 Stability | **STABLE** | 16/16 runs passed: smoke (264 checks), biome (50), reachability (36), map reachability, soak ×10, ws-soak ×2 |
| VM2 Balance | **DONE — 2 drift flags for Havoc** | Probe: 5 weapons measured. Matrix: 96/96 matches, 0 errors |
| VM3 Compatibility | **COMPATIBLE** | 6/6 device profiles (routes + touch contract), mobile-check 40/40 |
| VM4 Comparative | **REGRESSION (mechanical) — read the diagnosis** | A/B Update 2 → battery tree; bars all hold; see below |
| VM5 Backup | **RESTORE PROVEN** | Battery-tree snapshot: 135 files checksummed; drill 135/135 + restored smoke PASS |
| Swarm | **DONE** | 60 matches at validated max P=4: 48 completed, 10 hit cap (all waves), 2 ended early, **0 errors, 0 crashes, 1,752 bot lives** |

## VM1 — Stability

16/16 green on the battery tree, including ten consecutive soaks and
two WebSocket soaks. The V6-3 wave (menu, FX, characters, interiors)
holds the full gate suite with no flakes. One earlier flake is
explained and handled under "Findings" (fixed port 8199).

## VM2 — Balance (probe + 96-match matrix)

**Probe (compound, turret TTK) vs the V5 baseline:**

| Weapon | TTK now | V5 baseline | Hits/kill now | Call |
|---|---|---|---|---|
| AR | 0.40s | 0.53s | 3.7 (was 3.8) | **DRIFT — faster** |
| SMG | 3.37s | 2.43s | 7.4 | **DRIFT — slower** |
| Shotgun | 6.20s | 8.47s (wall-clock) | 11.9 (was 13.1) | in band |
| DMR | 0.60s | 0.60s | 2.0 | exact |
| Pistol | 2.33s | — | 5.4 (was 5.7) | in band |

Diagnosis, verified in git: **`js/weapons.js` has not changed at all
since the V5 baseline tree** — not one commit. What changed is
`js/bots.js` (V6-3: human-like soldiers + bot movement smoothing,
`4a71a54`). The probe kills moving bots, so TTK moved because the
*targets* move differently — smoother bot motion makes the SMG's
spread cost more time and exposes bots to the AR sooner. This is a
measurement of the movement change, not a weapon-data regression.
Havoc's call whether the new effective TTKs are the feel he wants.

**Matrix (bot-vs-field, team win rate for the profile's side):**

| Profile | Win rate | K / D | | Mode | Team win rate |
|---|---|---|---|---|---|
| mobile/AR | 0.67 | 794 / 21 | | TDM | 0.91 |
| mobile/SMG | 0.58 | 647 / 30 | | Domination | 0.66 |
| mobile/shotgun | 0.54 | 467 / 74 | | **Assault** | **0.16** |
| turret/DMR | 0.50 | 524 / 11 | | | |

Finding for Havoc: **Assault is attacker-brutal in bot matches —
5 wins in 32.** The channel ring sits against respawning defenders and
defenders grow with channel progress; a lone attacker profile almost
never holds it. Only 1 of 96 matches hit the tick cap (TDM/compound/
shotgun, 29–24 when time ran out — nearly finished).

## VM3 — Compatibility

6/6 profiles served correctly (desktop 1920, laptop 1366, touch
laptop 1440 — correctly *not* touch mode — iPhone 17 Pro class,
Android phone, tablet) and the touch suite passed 40/40 on the battery
tree. Same honest limit as always: this proves served build + input
contracts, not rendered layout — the phone verdict is still Brett's.

## VM4 — Comparative (Update 2 `476ac34` → battery tree `8903c76`)

The instrument's mechanical verdict is **REGRESSION on all four maps**,
and here is exactly what that does and does not mean:

- Draw calls went **down** 1 per map (119→118 compound, 130→129
  snow/mars, 128→127 forest). All bars hold everywhere: worst map is
  forest at 127 calls / 213,868 tris (bars: 165 / 300,000).
- Tris went **up +7,566 per map, identical on all four** — the
  enterable HQ building from the Stage-1 interiors directive, which
  lives in the shared base every map carries. Atlas's own ledger entry
  documents this exact delta and its §3.4 offset.
- The verdict fired because the rule is "cost up >2% with no
  audit-visible quality gain," and building interiors don't move the
  audit's flat/textured shares. **The cost was ordered by the owner
  (enterable buildings) and is inside budget on every bar** — but the
  rule as written cannot tell a feature from a leak. Reported, not
  papered over: recommendation to Odin/Coordinator is to let §3.4
  named offsets satisfy the "paid for" test in VM4's rule. Until then,
  expect VM4 to flag any shared-base feature the same way.

## VM5 — Backup + restore

Battery-tree snapshot created (`rig/backups/2026-10-25-8903c76/`):
archive 3,215,360 bytes, sha256 `2b2a87e247f0139a…` (full value in the
manifest), 135 files individually checksummed, metrics + ledger
captured. Restore drill: **PROVEN** — archive hash ✓, 135/135 files ✓,
restored tree boots and passes its own smoke (21.0s). A backup of
Update 2 (`476ac34`, 101 files) was also taken and drill-proven
earlier tonight.

## Swarm — the 100-bot team, honestly counted

Max validated parallelism on this machine: **P=4 workers** (validated
at P=2, 3 and 4 with zero errors/crashes and memory recovered after
each run). Sustained block: 4 × 15 = **60 matches in 40.3 seconds**:

- 48 completed, 2 ended early (waves defeats), 10 hit the 20-minute
  sim cap — **all 10 were waves matches**, where two durable scripted
  players can hold mid-waves indefinitely; the sim was still fighting
  (kills kept accruing), it just never concluded. TDM went 24/24.
- **1,752 bot lives simulated** in the block; **2,356** across all of
  tonight's swarm runs (122 + 164 + 318 in validation + 1,752 here). Concurrent ceiling: ~26 bots alive at once
  (4 matches × ~6.4 average peak) + 8 scripted players. Reaching a
  true ~100 concurrent bots needs ~13–16 parallel matches — more
  cores than this box has; the swarm scales linearly when they exist.

## Findings worth the studio's attention

1. **Assault attacker win rate 16%** in bot matches (VM2) — balance
   question for Havoc, measured not vibes.
2. **TTK drift is bot-movement-driven** (VM2) — weapons data untouched
   since V5; re-baseline the probe numbers against the V6-3 movement
   if Havoc accepts the new feel.
3. **VM4's "paid for" test needs §3.4 offsets** — otherwise every
   shared-base feature reads as a regression (see VM4 section).
4. **smoke.mjs boots on fixed port 8199** — two overlapping smokes
   (battery vs guardian cron vs a builder's gate) can collide; the
   rig now waits for the port and the restore drill retries once, on
   the record. A random-port smoke would remove the hazard at the
   source (Vega's surface, when convenient).
5. Waves matches with strong defenders don't conclude — relevant to
   any future "endless mode" tuning; the sim itself never errored or
   crashed in 174 matches tonight (96 matrix + 78 swarm).

## Limits (unchanged, restated)

Worktree sandboxes, not OS VMs; headless contracts, not rendered
truth; bot profiles are instruments, not players; Brett's ears, eyes
and phone remain the confirming courts for FX, graphics and feel.

*Rig Engineer seat — Oct 25, 2026. Reports: `rig/reports/`. Ledger:
Rig section appended to `docs/sessions/v6-update-ledger.md`. All rig
commits local (`v6(rig):`); nothing pushed.*
