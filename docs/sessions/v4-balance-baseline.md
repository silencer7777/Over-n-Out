# V4 Balance Baseline — Measured, Pre-Tuning (Havoc, Gameplay Director)

Measured Oct 24, 2026 with `tools/balance-probe.mjs`
(commit `b659017`) driving `net/sim.js` headlessly at 30 Hz.
**Every number in §1–§3 was measured on the pre-tuning tree**
(weapons table exactly as V3 shipped). Tuning ruled from this
baseline is in §5; post-tuning re-measurement lands as an
addendum in the tuning commit, so the before/after is auditable.

Method, honestly: scripted players, not humans. A stationary
turret with perfect chest tracking and LOS-gated fire (it does
not shoot through walls) for TTK; a passive player for
time-to-down; a closing "hunter" for wave pacing. Perfect aim
makes TTK a *floor* — human TTK is longer; what transfers is
the **ranking between weapons and range bands**, which is what
tuning decisions need. Bots are 100 HP, players 100 HP.

## 1. Time-to-kill per weapon (first hit → kill)

| Weapon | Median TTK | Hits/kill | Pull hit rate | TTK by kill distance |
| --- | --- | --- | --- | --- |
| AR | **0.53 s** | 3.8 | 77% | 10–20 m: **0.27 s** · 35 m+: 0.53 s |
| SMG | 3.10 s | 7.3 | 24% | 10–20 m: **0.40 s** · 20–35 m: 3.70 s · 35 m+: 6.47 s |
| Shotgun | 5.00 s | 18.6 pellets | 87% | all kills finished 10–20 m: 5.00 s |
| DMR | **0.60 s** | 2.0 | 96% | **0.60 s at every band** |
| Pistol | 2.40 s | 6.1 | 84% | 10–20 m: 1.33 s · 20–35 m: 2.60 s · 35 m+: 2.93 s |

Analytic cross-check (perfect hits, body, falloff-adjusted) —
agrees with the sim, so the sim is believed: AR 3 hits ≤ 25 m /
4 hits at 40–60 m / 6 at ≥ 90 m · SMG 5 hits ≤ 12 m / 13 at
≥ 45 m · shotgun 112/pull ≤ 4 m (one pull) degrading to ~32
dmg/pull at 15 m · DMR 2 body shots at any range, 1 headshot
at any range · pistol 5 hits ≤ 15 m — **4 × 24 = 96: the
four-hit tease** (see §5).

Findings:
- **AR is the healthy reference** (and smoke-pinned — it does
  not move). Burst discipline changes nothing for it: bloom
  decays (2.2/s) faster than its cadence feeds it.
- **SMG is two weapons.** Inside 20 m it's a 0.40 s hose —
  exactly its identity. Past 20 m, sustained fire pins bloom at
  max (spread 0.037 rad) and TTK falls off a cliff (3.7–6.5 s,
  24% pull hit rate). Burst discipline does *not* rescue
  out-of-band fights (pooled burst median was worse, 3.83 s —
  pausing just fires fewer lottery tickets). The cliff is the
  design working; the bloom pin is harsher than it needs to be.
- **Shotgun's mid-band is anemic.** Zero kills finished inside
  10 m (bots die on approach or hold their own ranges), and at
  10–20 m it needs ~19 pellet hits / 5.0 s: per-pellet falloff
  (start 4 m, floor 0.15 at 20 m) guts the pull to ~32 damage
  at 15 m. Point-blank (112/pull) is untouched by this — the
  hole is specifically 8–18 m, where a shotgun should still
  end fights in 2 pulls.
- **DMR is flat and honest:** 2 body shots everywhere, 1
  headshot everywhere, 0.60 s — its cadence *is* its balance.
  Note for the record: at 35 m+ its body-shot TTK (0.60 s) ties
  the AR's (0.53 s). The DMR's identity is the one-shot
  headshot and per-hit punch, not body-shot DPS. Accepted.
- **Pistol has the 96-damage tease.** 4 perfect hits leave a
  bot at 4 HP; it takes 5 (measured 6.1 with real spread). A
  sidearm that almost-four-taps feels broken even when the
  fifth shot is fast.

## 2. Incoming damage — time-to-down, passive player

Stationary, never fires, wave started at the stated number
(approach + spawn flow included; 4 seeds each, downed 4/4):

| Wave | Median first damage | Median time-to-down |
| --- | --- | --- |
| 1 | 11.5 s | **21.6 s** |
| 3 | 5.1 s | 18.2 s |
| 5 | 9.4 s | 17.1 s |
| 7 | 6.1 s | **11.1 s** |

One AR bot at 15 m deals ≈ 3.1 DPS to a stationary target on
paper (burst shape × hit-chance × 8.5 avg damage over a
~2.5 s cycle); the measured TTDs are what focus fire from a
wave does to that. The ramp 21.6 → 11.1 s across waves 1–7 is
sane: a passive player is meat by wave 7, a moving, shooting
player is playing a different game entirely (flinch resets,
the moving-target factor, and +25 HP per wave clear all push
the other way). **No bot offensive tuning is ruled from
this baseline** — the difficulty tiers in the mode pack shape
offense per context instead.

## 3. Wave pacing — and the wall-wedge finding

Hunter runs (AR, closes on targets, 300 s cap, 6 seeds):
2 runs cleared 2 waves (23 kills), 1 cleared 1 (13 kills),
**3 stalled on wave 1 with 4–5 kills and trailing stalls of
166–294 s**. Diagnosis (seed 9043, dumped live): the last two
AR bots froze at (1.3, 0, −40.5), the player froze at
(1.4, 0, −23.4) — **17.1 m apart, on opposite faces of the
same building line, LOS false, both ramming the wall forever**
(bot burst cooldown free-running to −34 s; they never fire,
never strafe — 17.1 m is just outside their 16 m strafe band,
and closing is geometrically blocked).

Root cause: bot movement is straight-line + `collide()` slide
with **no stuck detection**. Any bot whose target crosses a
building can wedge permanently. In human play the operator
hunts them down, so waves still clear — but "last two bots
are standing against a wall somewhere" is a real pacing and
believability defect, and it makes scripted full-clear pacing
unrepresentative.

Consequences, ruled here:
- Mode match-length targets (mode design pack) are set from
  §1 TTK + spawn/objective flow math, **not** from scripted
  full clears. Re-baseline pacing after the un-wedge lands.
- The un-wedge behavior is specified in the mode pack §6
  (stuck detector → wall-slide → lane reset). Owner of the
  fix: Coordinator (bots.js + sim port stay in parity).

## 4. Server cost cross-check (Odin's harness, HEAD 46733a8)

From `docs/sessions/v4-metrics.md` — the numbers my balance
work budgets against:

| Metric | Measured | Board bar | Verdict |
| --- | --- | --- | --- |
| Sim cost, stress (4 clients, 9 bots, wave ≥ 5) | **0.121 ms/tick** hot window | ≤ 0.5 ms/tick | ✅ 4× headroom |
| Sim cost, soak parity | 0.042 ms/tick | — | consistent with V3's 0.04 |
| Snapshot size, max | **1,785 B** | ≤ 4,096 B | ✅ |
| Draw calls, worst scene | 145 (forest) | ≤ 165 | ✅ |
| Gates at that HEAD | smoke 152 · reachability 21 · biome 15 · soak PASS | all green | ✅ |

Balance relevance: there is ~4× sim headroom, so difficulty
tiers and mode logic may spend ticks on smarter bot behavior
(the un-wedge, objective play) without threatening the
smoothness bar. Spend it on bots, not on bigger radii.

## 5. Tuning ruled from this baseline

Applied in the follow-up `v4(gameplay):` tuning commit,
weapons table only, AR untouched (pinned reference):

1. **Pistol damage 24 → 25.** Four hits now kill inside
   falloff range (4 × 25 = 100). The tease is the bug.
2. **SMG bloomRate 1.6 → 1.3.** Softens the sustained-fire
   spread pin past 20 m without touching its close-range
   identity (0.40 s at 10–20 m is bloom-independent) and
   without making it the best bloom in class — it stays the
   worst, just less punishing.
3. **Shotgun falloff 4/20/0.15 → 6/24/0.25** (start/end/
   floor). A 15 m pull rises from ~32 to ~48 expected damage
   (2–3 pulls to kill in the 8–18 m band); point-blank is
   unchanged (falloff starts later, damage per pellet same).

Explicitly **not** tuned: the DMR (identity verified in §1),
every `bot` block (§2's ramp is sane; tiers shape offense
instead), and barrels (95 @ 6.5 m — the consistency anchor the
frag grenade's 110 @ 5.5 m was ruled against in Board 004).

## 6. Addendum — post-tuning re-measurement (same commit)

Re-ran the probe after the tuning landed. Disclosure: the
Coordinator's full integration (`7394156`) landed between the
baseline run and this one, so kill counts and §§2–3 context
shifted with the world — **the per-weapon mechanics below are
the tuning signal**; §2/§3 deltas are confounded and are
reported, not claimed.

| Weapon | Before → after | Read |
| --- | --- | --- |
| Pistol | hits/kill 6.1 → **5.7** · 10–20 m TTK 1.33 s → **0.80 s** | The fix working where it was aimed: 4-hit kills inside falloff range |
| SMG | pull hit rate 24% → **29%** · median TTK 3.10 s → **2.43 s** · 20–35 m 3.70 → 3.43 s · 35 m+ 6.47 → 6.53 s | Mid-band relief, far band unchanged — the cliff stays a cliff, by design |
| Shotgun | hits/kill 18.6 → **13.2 pellets** · median TTK 5.00 → 6.20 s | Pellet efficiency up ~29% (the tune's mechanism); the TTK delta is one pump cycle (0.85 s quantum) on n≈20 — noise, not regression. Verdict: keep, re-check on the post-un-wedge baseline |
| AR / DMR | unchanged numbers, unchanged TTK (0.53 / 0.60 s) | reference + identity intact |
| §2 TTD | 21.6/18.2/17.1/11.1 → 20.1/18.3/13.6/13.7 s (W1/3/5/7) | Bot blocks untouched; ramp shape holds (integration-era world) |
| §3 pacing | stalls persist (5 of 6 runs) | The wedge is now the loudest signal in the data — §6 of the mode pack (un-wedge) is the top gameplay fix for the Coordinator |

— Havoc, Gameplay Director AI
