# ASSAULT 0.16 — Diagnostic (Training, Wed Oct 28, 2026)

**Tree:** `d4ea353` (clean at session start; BUILD U10). **Staff:**
Training Lead (ran the drill), REVIEWER (recent record), COACH
(drill design + grading). **Drill:** FIX PRACTICE, per the Sun
Oct 25 focus list — "ASSAULT 0.16, diagnostic-first … do not tune
numbers blind."

## Verdict: MEASUREMENT-INVALID

The headline claim "ASSAULT is attacker-brutal — 0.16 attacker win
rate (rig first battery, Oct 25)" is **not a measurement of mode
balance**. On the two elevated-ring maps the bot instrument cannot
satisfy the channel condition at all; on the two ground-ring maps
the wins and near-wins are substantially produced by friendly
bots, not the scripted attacker the matrix purports to profile.
**No Havoc pack number is proven wrong in either direction** —
not the 45 s channel, not defender growth 4→8 per 25%, not the
defender respawn 6 s +2 s per 25%, not the 2%/s decay. **No
numbers were tuned.** One instrument defect was found and fixed
(§7). The precise unblocks for Havoc/Rig are in §8; a ready-to-
adopt TEST CRAFT spec for Fri Oct 30 is in §9.

## 1. Segmented matrix — the pooled rate decomposes by map

Stock VM2 instrument (`rig/vm2-balance/botmatch.mjs`, unmodified
game code), identical design to Oct 25: 4 profiles × 4 maps ×
seeds 11/23, one scripted player per match. Raw JSONL:
`scratch/assault-diag/results/matrix-v2-postfix-driver.jsonl`.

| Map | Ring height | Oct 25 (8903c76) | Today (d4ea353) | channelMax today |
|---|---|---|---|---|
| compound | y = 4.6 (tower L2) | 0/8, channel 0 in all | **0/8** | **0 in all 8** |
| snow | y = 4.6 (L2 console) | 0/8, channel 0 in all | **0/8** | 0–49.5 (partials bot-made, §4) |
| forest | y = 0 (mast) | 0/8, channel 0 in all | 1/8 | up to 100; losses peaked 84 / 60.2 / 54.2 |
| mars | y = 0 (uplink) | 5/8 | 6/8 | 60.2–100 |
| **Pooled** | | **0.16 (5/32)** | **0.22 (7/32)** | |

The pooled rate moved 0.16 → 0.22 entirely because forest/mars
moved. The elevated half of the matrix was a structural zero in
October and is a structural zero now. A pooled assault rate
across reachable and unreachable objectives measures the
instrument, not the mode (Lesson 21).

## 2. Ring trace — the mechanism, proven per-tick

`scratch/assault-diag/trace.mjs` is a verbatim copy of the rig
driver's match loop plus read-only per-tick ring telemetry (no
sim mutation, no rng consumption). Every trace case first
asserts parity with the stock botmatch — ticks, result, kills,
deaths, final channel (and, after the §7 fix, channelMax):
**26/26 cases parity OK** (`results/trace-main.txt`,
`results/trace-ext.txt`).

The sim's channel condition (`net/sim.js` `stepAssault`):
`hypot(x,z) < radius AND |y − target.y| < 3.2`. Compound/snow
targets sit at y = 4.6; `groundHeightAt` steps up at most 0.6,
so the ring is reachable only via the stair routes — which the
driver never takes (it steers in 2D at the target's XZ; jump
bursts only when stuck). Findings, mobile/AR:

- **Compound, 8/8 seeds (11–97): nobody is ever in the ring.**
  Player, friendly bots, defenders: 0.0 s in-ring and 0.0 s even
  XZ-in-ring, every seed. Player's closest XZ approach:
  8.0–21.8 m. channelMax 0 in 8/8 trace seeds (and in all 8
  matrix matches — 4 profiles × 2 seeds).
- **Snow, 8/8 seeds: the scripted player is never in the ring.**
  Seed 11 is the direct proof of the elevation gate: the player
  stands XZ-in-ring for **65 s at y = 0** against target y = 4.6
  (|Δy| = 4.6 > 3.2) — XZ satisfied, channel impossible.
  Friendly bots occasionally appear in-ring at y = 4.6 (seed 31:
  4.2 s → channelMax 9.3; seed 79: 1.8 s → 4.1) via elevated
  spawn/lane-reset placement — brief, never a win.
- **Turret profiles incriminate attribution, not aim.** A
  stationary turret player "channels" 3.9–4.4% on snow and
  reaches channelMax 60.2 in a mars loss (matrix) — with zero
  player movement, every point of that is friendly bots.

## 3. Attacker-count segmentation — count is not the lever

Stock driver, 0/1/2/3 scripted mobile/AR attackers × 4 seeds
(11/23/31/41) (`results/count-main.txt`, `count-ext.txt`):

- **Compound: 16/16 losses, channelMax 0 at every count** —
  including the 0-attacker control. Tripling attacker firepower
  (kills 42 → 132) changes nothing. Whatever unblocks compound
  assault measurement, it is not attacker count.
- **Mars: count helps where the ring is reachable.** Wins at
  every count ≥ 1, faster with more attackers (seed 31:
  70.6 s → 53.6 s → 43.6 s for 1/2/3). The 0-attacker control is
  the telling case: friendly bots alone reach channelMax
  16.4–54.1 but **lose 4/4** (progress decays to 0) — bots can
  start a channel, they cannot finish one without a player.

## 4. Attribution — whose channel is it?

Ground-map wins are not necessarily the profile's work:

- Mars seed 23, mobile/AR (matrix win): scripted player ring
  time **0.0 s**, closest approach **78.3 m**; friendly bots
  channeled 40.3 s uncontested. The "mobile/AR win" is a bot win.
- Mars seed 11, turret/DMR (win): player ring 0.0 s; bots 31.1 s.
- Forest seed 23 (loss): player ring 0.0 s; bots channeled
  54.4 s uncontested, peaked at **channelMax 60.2**, then the
  channel was abandoned and decayed to a final 0.
- Mars seed 31/41 are the counterweight: there the player does
  channel personally (41.6 s / 38.4 s) and wins.

Any future VM2 assault reporting must record WHO satisfies the
objective condition (Lesson 23).

## 5. Ring-start probe — the hold phase, isolated and scoped

Diagnostic-only variant (`trace.mjs` `ringStart`): the scripted
attacker starts in the ring (and is re-placed on respawn). This
excludes approach/pathing **by construction** and answers only:
*can the 45 s channel be held once an attacker is in the ring?*

- Elevated maps, 8/8 cases (compound + snow × seeds 11/23/31/41):
  **win at exactly 45.0 s every time**, defender ring time 0.0 s
  in all 8. Forest/mars controls also win (36.9–56.3 s).
- Scoped reading: Havoc's escalation (defender growth, veteran
  shift, respawn growth) does **not** make a started channel
  unholdable in the sim. What this does NOT prove: that a real
  approach-and-hold is easy — at t = 0 the defenders must travel,
  and a human arriving at t ≈ 60 s faces a converged defence.
- Side observation for Havoc (§8, U2): within the channel window,
  defenders contest by fire, not by presence — defender ring
  time is ~0 in every ring-start case and contested time is ~0
  in nearly every trace (bot goal steering yields to the hunt
  vector at engagement range, `net/sim.js` `stepBot`).

## 6. What this diagnostic does NOT measure: solo play

The shipped solo assault (`js/main.js`) is a different game from
the sim's: the channel counts **only the human** (`youIn` from
`player.position`), defenders arrive via the wave spawner with
a different tier mix, and there is **no friendly squad** in
assault (the friendly-roster fill at `beginMatchSpawns` covers
TDM/Domination only). VM2 numbers — valid or not — never
described Brett's solo experience. Solo assault difficulty is
Brett's playtest call, as ever (Lesson 2).

## 7. Instrument fix landed (the day's FIX)

`rig/vm2-balance/driver.mjs`: `runBotMatch` now tracks and
returns `finalScore.channelMax` — peak channel at any tick.
End-state channel alone hid real progress behind the 2%/s
decay (forest loss peaking 84 → final 55.9; forest 60.2 → 0;
snow 49.5 → 0; mars 60.2 → 0). Additive only: re-running the
full 32-match matrix with the fixed driver produced **zero
diffs on every pre-existing gameplay field** vs the pre-fix run
(`wallMs` excepted — nondeterministic timing on all rows)
(`results/matrix-v1-*` vs `matrix-v2-*`). No game code changed;
no sim behaviour changed; both consumers (VM2, swarm worker)
read named fields only. Scope note (Coach grading deduction):
the VM2 *reporter* (`rig/vm2-balance/run.mjs`) is NOT yet
patched — its by-mode table still pools assault across maps
and ignores `channelMax`. The field is landed; adopting it in
the reporter is §9 item 1, due Fri Oct 30.

## 8. Unblocks — for Havoc / Rig, in order

- **U1 (Rig — the measurement unblock).** Teach the VM2 driver
  vertical access: waypoint routes up the compound tower stairs
  and the snow L2 (human routes exist; reachability proves
  them), **or** adopt the ring-start variant (§5) as a
  maintained VM2 case so hold-balance is measured separately
  from pathing. Until one lands: never report a pooled assault
  win rate; report per-map, with channelMax.
- **U2 (Havoc — a design question, not a bug claim).** Should
  defenders contest a running channel by *presence* (entering
  the ring pauses it) rather than only by fire? Today presence-
  contest is ~never exercised by bot defenders. If presence is
  intended, that is a bot-AI change in a regular update, with
  this diagnostic as its before-measurement.
- **U3 (Havoc — bot channel discipline).** Friendly bots start
  channels they cannot finish (mars 0-attacker channelMax
  reached 54.1 in the session's 4-seed control and 64.1 in
  Coach's independent 4-seed grading sweep — bots start, they
  never finish;
  forest peaks 60–84% then decays out). If "bots alone must
  never win assault" is the intent, current behaviour is close
  to correct and only needs a pin (§9), not a fix.

## 9. Friday TEST CRAFT adoption spec (ready to adopt Fri Oct 30)

1. VM2 assault reporting: per-map rows with `channelMax`
  (field landed §7); pooled assault rate removed or footnoted
  as instrument-limited until U1 lands.
2. One maintained ring-start case per elevated map
  (compound, snow; seeds 11/23): pass = win with channelMax
  100 and defender ring time recorded (any value — it is a
  measurement pin, not a balance gate).
3. One 0-attacker mars control (seed 11): pass = loss with
  channelMax < 100 (bots alone never finish — U3's pin).
4. Trace telemetry (`scratch/assault-diag/trace.mjs`) promoted
  or re-implemented in the rig with the parity assertion kept:
  a telemetry copy that cannot reproduce botmatch proves
  nothing (Lesson 16's pattern, applied to drivers).

## 10. Staff-claim corrections (Lesson 17, applied in-session)

- REVIEWER's "spawns re-picked in U7 (`2808fd3`)" — **not
  verified**: that commit touches no spawn/map/sim file. The
  broader point stands on U6 evidence (teams/backfill U6-07/08,
  stances U6-10, expansion U6-12 all post-date the Oct 25
  battery and change what a rerun measures).
- REVIEWER's "compound attacker reaches the tower footprint in
  XZ" — **not reproduced**: parity-checked traces show compound
  XZ-ring time 0.0 s in 8/8 seeds (closest 8.0 m). The XZ-without-
  Y proof case is **snow** seed 11 (65 s). Mechanism identical;
  the map attribution in the drill record is snow's.
- REVIEWER's forest seed 23 "channelMax ~60%, decayed to 0" —
  **corroborated exactly** (60.2 → 0; friendly bots, 54.4 s).

## Evidence index

All under `scratch/assault-diag/`: `trace.mjs` (telemetry copy +
ring-start), `trace-run.mjs` / `trace-ext-run.mjs` (26 parity-
checked traces), `count-run.mjs` / `count-ext-run.mjs` (count
segmentation + 0-attacker control), `ringstart-run.mjs` /
`ringstart-ext-run.mjs` (12 ring-start cases), `results/` (raw
JSONL/text for every number above). Oct 25 comparison data:
`rig/reports/2026-10-25-vm2-balance-8903c76.json`.
