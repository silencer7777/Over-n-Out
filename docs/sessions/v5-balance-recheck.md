# V5 Balance Recheck — Pass 1 (Havoc, Gameplay Director)

Measured Oct 24, 2026 with `tools/balance-probe.mjs` and the
new `tools/sightline-audit.mjs`, both driving `net/sim.js` /
`js/worlddata.js` headlessly.

**Tree state this pass describes: HEAD `55a2e12` — the shipped
V4 tree.** As of this pass, NO `v5(` commits exist: the
Coordinator's V5 lighting rework, Atlas's V5 structures, and
Board 005's distinct maps have **not landed yet**. Per the
owner's scope note (levels become distinct maps in V5; audits
run per map), every number below belongs to the **COMPOUND**
map — the only map the current data describes, and V5's
starting geometry. Pass 2 re-runs this entire protocol per
map the day Atlas's layouts land. Nothing here generalizes
to forest / snow / mars by assertion.

---

## 1. Re-baseline — TTK per weapon (COMPOUND)

Turret method, identical to the V4 baseline (perfect chest
tracking, LOS-gated). "V4 base" = pre-tuning baseline doc;
"V4 final" = the post-tuning addendum (integration-era tree).

| Weapon | V4 base | V4 final | **V5 Pass 1** | Read |
| --- | --- | --- | --- | --- |
| AR median TTK | 0.53 s | 0.53 s | **0.53 s** | Pinned reference, unmoved |
| AR hits/kill | 3.8 | 3.8 | **3.8** | — |
| SMG median TTK | 3.10 s | 2.43 s | **2.43 s** | Tune holds exactly |
| SMG 10–20 m | 0.40 s | — | **0.33 s** | In-band identity intact |
| SMG 20–35 m | 3.70 s | 3.43 s | **3.37 s** | Mid-band relief holds |
| SMG 35 m+ | 6.47 s | 6.53 s | **7.13 s** (n=15) | The cliff, by design; noise band |
| Shotgun hits/kill | 18.6 pel | 13.2 pel | **13.1 pel** | **Tune CONFIRMED** (see §4) |
| Shotgun median TTK | 5.00 s | 6.20 s | **8.47 s** | Wall-clock only — see §4 |
| DMR median TTK | 0.60 s | 0.60 s | **0.60 s** | Flat at every band, as designed |
| Pistol hits/kill | 6.1 | 5.7 | **5.7** | 96-damage tease stays dead |
| Pistol 10–20 m | 1.33 s | 0.80 s | **0.80 s** | Tune holds exactly |

**Verdict: zero weapon-stat drift.** Every delta against the
V4-final column is explained by bot behavior (§2), not by the
weapons table, which has not changed since `a55cf9f`.

## 2. Time-to-down, passive player (COMPOUND)

| Wave | V4 base TTD | **V5 Pass 1 TTD** | First damage (base → now) |
| --- | --- | --- | --- |
| 1 | 21.6 s | **20.1 s** | 11.5 s → **4.1 s** |
| 3 | 18.2 s | **18.3 s** | 5.1 s → **3.1 s** |
| 5 | 17.1 s | **13.6 s** | 9.4 s → **5.4 s** |
| 7 | 11.1 s | **13.7 s** | 6.1 s → **6.2 s** |

TTDs reproduce the V4-final addendum exactly (the sim is
deterministic; same seeds, same numbers — a good harness
sign). The story is in first-damage: bots now arrive and open
fire **2–7 s sooner** on early waves because they no longer
wedge on the approach (the un-wedge works *while a route
exists*). The ramp's shape is unchanged — incoming DPS math
is untouched — so early waves *feel* snappier without being
more lethal. **No bot offensive tuning ruled.**

## 3. Wave pacing — still stalled, and now we know exactly why

AR-hunter scripted clears, 6 seeds: **5 of 6 still stall on
wave 1** (3–5 kills, ~290 s trailing stalls); 1 clears 6
waves. In V4 this was attributed to the wall-wedge and the
un-wedge fix (`d532d4d`) was expected to clear it. It did
not. Instrumented diagnosis (seed 9000, state dumped live):

- The last bot (b3) and the hunter end up on opposite faces
  of the **main building ground floor** — collider box
  x −16..16, y 0..2.3, z −40..−24. Bot pressed at
  **z = −40.5** (north face), hunter at **z = −23.4** (south
  face), 17.1 m apart, LOS false — **the same wall pair as
  the V4 baseline's original freeze** at (1.3, 0, −40.5).
- The bot is NOT frozen. It wall-slides in a stable
  **~27 s limit cycle**, x oscillating −5.0 ↔ +2.6 along the
  face, forever. `slideMode` flips 1 → 0 → 1; `slideFails`
  never exceeds 1.
- **Root cause — the un-wedge defeats its own escalation.**
  Detection (net/sim.js ~L642–678; js/bots.js ~L417–452):
  every 2.5 s window, displacement < 0.4 m = stuck →
  escalate (slide, then lane reset at 2 fails). But the
  wall-slide itself moves the bot **metres** laterally, so
  the next window's displacement check passes, and the
  `disp >= 0.4` branch **resets `slideFails` to 0 and
  cancels slide mode**. The bot re-rams the wall, slides the
  other way (sign flips per engagement), and the lane reset
  — the only stage that can escape a 32 m wall from
  mid-face — is **unreachable code** in this geometry.

**Fix spec (Coordinator implements; bots.js + sim parity):**
the stuck verdict must measure *progress*, not motion.
(1) During/after a slide window, judge by distance-to-target:
not improved by ≥ 1 m ⇒ the slide failed, `slideFails++`.
(2) `slideFails` resets ONLY on `hasLOS`, on lane-reset
completion, or on ≥ 2 m of genuine target-distance progress —
never on raw lateral displacement. (3) Keep the slide itself;
it reads as believable shouldering along a wall. The defect
is the counter, not the slide.

**Impact, honestly:** human players flank the wall and waves
clear — Brett's V4 playtest never hit this. But scripted
full-clear pacing remains unmeasurable, online sim matches
inherit the cycle, and under V5's realism bar a bot sliding
back and forth along a wall forever is a believability
defect in its own right. This is the loudest signal in the
V5 data, again: **top gameplay fix, ahead of any tuning.**

Consequence: mode match-length targets stay as ruled in the
V4 pack (set from TTK + flow math, deliberately). They are
re-baselined from scripted clears only when this fix lands.

## 4. V4 open items — ruled on the new measurement

- **Shotgun re-check (owed by the V4 addendum): CLOSED.**
  Hits/kill 13.1 pellets ≈ the addendum's 13.2 — the falloff
  tune (6/24/0.25) is confirmed at its mechanism. The
  wall-clock TTK (8.47 s vs 6.20 s) lengthened because
  un-wedged bots now slide along walls *mid-engagement*,
  breaking the stationary turret's LOS and stretching
  first-hit→kill time; a human shotgunner closes distance,
  the turret cannot. Per-hit efficiency — the tuned
  quantity — is exact. **No retune.** Per-map re-check owed
  in Pass 2 (long-lane maps change the engagement mix).
- **SMG far band (35 m+):** 6.53 → 7.13 s across runs is
  cliff-design noise (n=15). No retune. Per-map context note
  for Pass 2: on any map whose typical engagement runs
  > 35 m, the SMG is a trap pick — that's map data to
  report, not a stat to move.
- **Pistol / AR / DMR:** at tuned values; AR untouched, as
  ever. No action.

## 5. Sightline audit — COMPOUND (new tool, first run)

`tools/sightline-audit.mjs` measures LOS on the sim's own
collider set (the same 111 colliders that block shots) across
16 vantages: the 12 spawns (S0–S11), zone A/B/C centers, and
the tower L2 nest (38.8, 4.6, −56). Eye +1.66 → chest +1.1,
the probe's convention. Exposure is measured to zone
*centers* — a capturer can stand anywhere in the radius, so
read "0 exposure" as "occluded core", not "invisible zone".

**Spawn↔spawn: 29 clear pairs of 66; 22 are > 30 m.** The
open ring sees itself: corner-to-corner lanes of 84 m, and
the longest vantage lane on the map is **127 m — SW corner
spawn S2 (−42,0,42) ↔ tower L2**. DMR TTK is 0.60 s flat with
a one-shot headshot at any range, so every clear pair is a
potential spawn-shot lane *if a mode exposes it*.

**Nest coverage (spawns seen / zones seen):**

| Vantage | Spawns | Zones |
| --- | --- | --- |
| Tower L2 nest | **7/12** [S2 S3 S5 S6 S7 S9 S10] | B |
| Zone B rooftop | **8/12** [S0 S1 S2 S6 S7 S9 S10 S11] | B (own) |
| Zone A deck | 0/12 | — |
| Zone C tower base | 0/12 | — |

**Zone exposure (of 15 external vantages):** A **0/15** ·
B **11/15** · C **0/15**. A and C centers are fully occluded
pockets; B's center is visible from nearly everywhere,
including the tower nest and both south corners.

Rulings:

- **R1 — Wave Defense: no defect.** Spawn lanes are the
  mode's core pressure: bots converge from them and the
  player is supposed to watch them. Nothing to fix.
- **R2 — TDM / Domination respawns: FLAG for Coordinator.**
  The mode pack's rule — never respawn a player inside
  enemy LOS when a safe spawn exists — is only enforceable
  against data. This audit is that data. Coordinator to
  publish the fixed team spawn sets per mode and verify no
  opposing pair is a clear lane in the audit table, and
  that neither set sits inside the tower's visible set
  [S2 S3 S5 S6 S7 S9 S10] without the LOS-safe fallback
  engaging. Not a proven break — spawn sets are client-side
  and not yet published as data — but it is now checkable
  in one minute, per map, forever.
- **R3 — Domination geometry skew: WATCH, no numbers move.**
  The designed counter-sniping triangle is lopsided in
  measurement: tower → B is one-way (the tower watches B;
  B cannot watch the tower base or A), A is a blind pocket,
  B is a fishbowl (flips fast), A/C are sticky once taken.
  First-tower advantage is real but access is symmetric —
  both teams race the same geometry — so this is a fairness
  watch item for playtest + Pass 2, not a proven break.
  Mode targets (first to 200, ~4–7 min) stand.
- **R4 — Relay Assault staging: FLAG for Coordinator.**
  The tower nest pre-sights 7 of 12 approach spawns,
  including the north gate S10 (its own doorstep). Fixed
  attacker staging inside that set makes every approach
  pre-sighted from the objective. Recommend staging from
  the unseen set **[S0 S1 S4 S8 S11]** or rotating staging —
  the five blind approaches are the flanking design working
  as intended.

## 6. Brett's five V4 taste questions — none re-opened

Per instruction, a question re-opens only if V5 measurement
contradicts its premise. None does:

1. **Difficulty select** — no new data bears on it. Stands.
2. **Assault wipe rule** — no new data bears on it. Stands.
   (§5 R4 is a staging flag, not a wipe-rule challenge.)
3. **Flash self-blind** — the cone math is untouched by
   every finding above; how flash *feels* under the new
   lighting grade is not measurable headless and belongs to
   Odin's readability metrics + Brett's playtest. Stands.
4. **Domination respawns** — already deferred by design;
   §5 R2/R4 *feed* it data rather than contradict it.
5. **Progression pace** — scripted victory pace is still
   unmeasurable (§3), so the session-profile premise is
   neither confirmed nor contradicted. Absence of evidence
   is not a contradiction. Stands — explicitly not
   re-opened on a null result.

## 7. Equipment lanes — compound preview (Directive 10/11)

Full numbers: `docs/sessions/v5-equipment-and-streaks-ruling.md`.
The audit obligations that land on this desk, compound
edition (re-run per map in Pass 2):

- **Tower stairs are the #1 placed-lethal lane** (Assault
  approach + C access, single-file). The counters hold:
  if a claymore's cone can trigger on you, its body is
  shootable from the approach in most placements; Engineer
  reveals it; the 0.8 s arm delay kills reactive drops.
- **The 1-active cap is the anti-camp keystone.** One
  placed lethal per life, no stockpiling — a claymore on
  the Relay ring buys exactly one defender kill per life in
  solo Assault. Any future proposal to raise the cap comes
  back to this desk with pacing math or it doesn't ship.
- **Placement exclusion: no placed lethal within 8 m of any
  spawn point** (anti-spawn-trap; cheap to enforce against
  SPAWN_POINTS at placement time). Ruled here, Board 005
  ratifies.
- **Smoke + occluded pockets (A/C)** is the known strong
  hold: unseen zone + smoked entry + claymore. Counters
  exist (frag is vision-independent; flash-and-enter;
  the in-cloud 3 m rule cuts both ways). Flagged as the
  combo to watch in playtest — no pre-nerf on a forecast.
- **Zone B's exposure self-balances placed lethals:**
  anything placed on the rooftop gets shot out from 11
  vantages. No ruling needed; geometry did it.

## 8. Pass 2 protocol + dependencies (when the landings come)

1. **Per-map re-baseline + audit** (owner scope note):
   §1–§3 and §5 re-run per distinct map; every number filed
   under its map's name. A nest fair on compound may be
   broken on forest — the audit tool is map-agnostic the
   moment a map's data is.
2. **Dependency (Coordinator / Vega / Board 005):** the sim
   bakes the compound's colliders at import
   (`net/sim.js`: `COLLIDERS = allColliders()`). Per-map
   measurement needs a map-selection seam in the sim/probe
   (a map parameter, not an edit I make — net/ is not my
   territory). Requested here so Board 005 can schedule it
   with the distinct-maps architecture.
3. **Post-lighting feel pass:** ADS/optic readability under
   the new grade cannot be measured headless — the sim has
   no light. Protocol: Odin's readability metrics (shadow
   luminance floors, target contrast) + Brett's playtest
   verdicts decide; this desk rules numbers only if a
   measurable system (e.g. scope zoom factors vs new lane
   lengths per map) is implicated. No vibes-based retunes.
4. **Post-un-wedge-fix pacing:** when the §3 fix lands,
   scripted clears become representative → re-baseline
   mode lengths from clears + re-check taste question 5's
   premise *with evidence, either way*.

## Gates at this pass (HEAD 55a2e12 + this pass's tool)

SMOKE PASSED · REACHABILITY PASSED · BIOME CHECK PASSED ·
SOAK PASSED. All commits local, `v5(gameplay):`, nothing
pushed. No weapon, bot, or XP numbers were changed by this
pass — the findings are a fix spec, two flags, and a
confirmed baseline.

— Havoc, Gameplay Director AI
