# Over n' Out — Training Log

One dated entry per daily training session: drill run, who graded it,
result, metrics before/after when measured, commits made.
Local `training:` commits only — never pushed; Brett approves pushes.

---

## Sun Oct 25, 2026 — CONSOLIDATE (first session on record)

**Staff:** Training Lead (ran the session), REVIEWER (recent record,
read-only), COACH (drill design + grading, read-only first pass).

**Pre-checks:** Tree clean on `main` at `bde7c5d` before the session, so a
full session was allowed. Sunday rule applies regardless: no code changes.
`docs/training/` did not exist — this session creates both records from
scratch; there were no prior lessons to prune, so the prune rules and a
retired/stale section were established in `LESSONS.md` instead.

**Drill run:** Consolidation only.
- REVIEWER audited: git log (161 commits total; 140 on Oct 24, 16 on
  Oct 25), guardian summaries Oct 24 03:22 → Oct 25 07:22 PDT (all-pass,
  check count 103 → 141 → 253 → 264, 0 failures, no Medic assignments),
  the V6 ledger, and the rig first battery report.
- COACH designed the consolidation: 14 evidence-cited lessons in 4 groups,
  prune rules, and next week's focus list (below).
- LEAD created `docs/training/LESSONS.md` (14 lessons + prune rules +
  retired/stale audit) and this log. No game code was touched.

**What the record shows (Reviewer findings, condensed):**
- Nothing broke in the gates. The struggles were scale and collisions:
  the fixed-port smoke hazard, the Oct 24 one-pen collision (now
  Lesson 3), and Forest budget pressure (tightest map, below).
- A balance break the rig proved: Assault attacker win rate 0.16
  (5/32 bot matches, VM2) — Havoc's call, not tuned blind.
- TTK drift is movement-driven, not weapon data: `js/weapons.js` is
  unchanged since V5; V6-3 bot smoothing (`4a71a54`) moved the targets.
- An instrument flaw: VM4 mechanically flagged REGRESSION on all 4 maps
  for the owner-ordered HQ (calls −1/map, tris +7,566/map identical ×4).
- Playtest debt: Updates 1–2 and the whole V6-3 wave (HQ interiors,
  per-gun audio, two-page menu, characters/movement) await Brett's
  verdicts; foundational docs (ROADMAP, MULTIPLAYER, V3-PLAN,
  GRAPHICS-TEAM, TEAM) have drifted behind the code — itemised in the
  retired/stale section of `LESSONS.md`, not edited today.

**Metrics (unchanged by this session — no code changes):**
- Guardian/smoke: 264 checks, 0 failures (07:22 PDT run).
- Rig battery on `8903c76`: VM1 STABLE 16/16; VM2 96/96 matches, 0 errors;
  VM3 6/6 profiles, mobile-check 40/40; VM5 RESTORE PROVEN (135/135);
  swarm P=4, 60 matches, 1,752 bot lives, ~26 concurrent bots.
- Graphics post-V6-3: Compound 118 calls / 48,042 tris, Forest 127 /
  213,868, Snow 129 / 85,286, Mars 129 / 56,036 — all under the
  165-call / 300k-tri vetoes.

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the end-state tree.

**Grade:** Coach provisional grade was PASS-ready pending file creation
and the smoke run; final grade recorded below after Coach's check of
the actual files.
- Final grade: **PASS** (Coach grading pass on the actual files — all 5
  criteria met, no defects; provisional grade was PASS-ready).

**Commits:** one local commit, `training: consolidate — first lessons
playbook + training log (Sun Oct 25)`. Not pushed.

### Next week's focus (Mon Oct 26 – Sun Nov 1, 2026)

| Day | Drill | Concrete target |
|---|---|---|
| Mon Oct 26 — CODE QUALITY | De-duplicate one weather painter copy: V6-3 weather landed snow/dust streaks in both `proctex` and `biomes` copies "in step" — audit that pair, align one shared definition if safe. Refactor lands only if full smoke stays green and v6-metrics shares are unchanged. |
| Tue Oct 27 — BUILD TECHNIQUE | Scratch-only prototype: falling precipitation frame hook for `js/main.js`, as specced by Atlas in the V6-3 Atlas report. Team Lumen criteria judge it; only a proven win merges later. |
| Wed Oct 28 — FIX PRACTICE | ASSAULT 0.16, diagnostic-first: re-run the VM2 matrix segmented by map/attacker count and write Havoc a precise unblock (defender growth, 45s channel, respawn distance) — do not tune numbers blind. Fallback if Havoc is unavailable: `js/bots.js` lane-reset parity write-up. |
| Thu Oct 29 — EFFICIENCY | Measure smoke/guardian trend (3 timed smoke runs, median) and per-map calls/tris; optimize only the port-8199 wait path or the VM4 §3.4-offset "paid for" check, if the data shows it saves repeat runs. |
| Fri Oct 30 — TEST CRAFT | Extend the soak rig: one per-mode end-condition script (start with TDM, 24/24 in the swarm) driving a match to `mode_end` over sockets. New check must pass on the current tree. |
| Sat Oct 31 — REALISM | Verity-led desk review of one awaiting-playtest area: HQ interiors (Ops 3-room + HQ 6-room/stairwell). Brett's verdict is still the court — land at most one small in-budget fix (≤+0 calls via existing buckets), gates green. |
| Sun Nov 1 — CONSOLIDATE | Re-baseline decision point: if Brett/Havoc have ruled on V6-3 feel, update Lesson 8 and the TTK baseline; prune per the LESSONS.md rules; sequence V6 Update 3 (Terrain & ground, all maps). |

Standing backlog behind that week, in order: Mobile M2 (DPR ≤2, mobile
quality tier, shadow-map size as resolution knob only); online client
rendering of V5 snapshot fields (UAV markers, equipment arrays);
shotgun `reload(soundId)` caller hook in `main.js`; §2.5 flat
ground-plane strike binding at Update 5.

---

## Mon Oct 26, 2026 — CODE QUALITY

**Staff:** Training Lead (ran the session), REVIEWER (recent record,
read-only), COACH (drill design + grading; grading pass independently
re-verified the diff and rebuilt the opcode proof clean-room).

**Pre-checks:** Tree clean on `main` at `6e47d84` before the session —
full session allowed. Guardian 07:22 PDT: 264 checks, 0 failures,
SMOKE PASSED, no Medic assignments, HEAD clean. Nothing landed since
Sunday's consolidation commit, so the record review was short.

**Target (from Sunday's focus list):** audit the duplicated V6-3
weather painters — snow/dust streaks landed "in step" in both
`js/proctex.js` (canonical) and `js/biomes.js` (local copies) — and
align one shared definition if safe.

**Audit findings (from actual diffs + op traces, not comments):**
- The streak blocks are textually identical across the pair, and a
  recording-canvas trace (stub `document`, real THREE via the vendor
  loader; 4,026 ordered ops per file over the snow + regolith
  painters) shows **zero differing ellipse ops** between the files.
- The full painters are NOT identical: all 1,891 differing trace
  lines are speckle `fillRect` alphas (proctex shared `speckle()`
  vs biomes inline ranges), and the factories differ
  (`canvasTexture` sets anisotropy 4; `procTexture` does not).
  Speckle was NOT touched — aligning it would be a repaint.
- A cross-file merge by import is unsafe in-session: `biomes.js`
  stays self-contained because `tools/biome-check.mjs` copies that
  single file into `tools/` and rewrites only its `three` import;
  an `import './proctex.js'` would resolve against `tools/` and
  break the B-suite inside smoke. The true merge (shared painter
  bodies + harness specifier fix + a speckle decision) is sequenced
  follow-up for a regular V6 change, not a training drill.
- Known drift outside today's scope, recorded not fixed: foliage
  vivid colour and the metal-panel scratch/speckle treatment have
  already diverged between the same pair of files.
- Process note: the REVIEWER report this session contained multiple
  factual errors (dirty tree, missing smoke tool, exported locals,
  differing streak parameters), each contradicted by direct checks.
  The Lead proceeded on tree-verified evidence only — now Lesson 17.

**Drill run (Coach fallback 4A — de-duplicate within each file):**
- `js/proctex.js`: extracted `windStreaks(c, S, rng, {n, rgb, rx,
  ry, bearing, jitter})`; `makeSnowTexture` (12×, white, bearing
  0.35) and `makeRegolithTexture` (9×, dust, bearing 0.5) now call
  it. Four hand-synced streak blocks → one definition per file.
- `js/biomes.js`: mirror `windStreaksLocal()` with the same body,
  called by both local painters; header comments now state why the
  mirror exists (self-containment) instead of only "kept in step".
- Exact RNG order preserved by construction (alpha, then ellipse
  x/y/rx/ry/bearing) and proven: **before/after op traces identical
  in both files (4,026 ops, empty diff)** — a refactor, not a
  repaint.

**Metrics before/after (identical):**
- Smoke: PASSED (264 checks) before and after.
- Biome-check standalone: PASSED before and after.
- v6-metrics per map: Compound 118 calls / 48,042 tris, Forest
  127 / 213,868, Snow 129 / 85,286, Mars 129 / 56,036; instanced /
  flat / textured shares unchanged on all maps; gates all PASS.
  (`v6-metrics.json` writer side-effect restored both runs; the
  commit carries only the two source files + these records.)
- Lighting untouched (no `lighting.js` change; Lesson 1 holds).

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the end-state
tree, after the refactor.

**Grade:** **PASS** (Coach grading pass — criteria (a)–(d) all met,
no auto-fail condition triggered; opcode proof reproduced
independently, not taken on the Lead's word).

**Commits:** one local commit, `training: code quality — windStreaks
helper dedups V6-3 weather streak painters (opcode-identical)`.
Not pushed.

**New lessons:** 15 (biomes self-containment is intentional), 16
(op-trace proof for seeded painters), 17 (verify staff reports
against the tree). Next session: Tue Oct 27 — BUILD TECHNIQUE,
scratch-only precipitation frame-hook prototype per Sunday's plan.

---

## Tue Oct 27, 2026 — BUILD TECHNIQUE

**Staff:** Training Lead (ran the session), REVIEWER (recent record,
read-only), COACH (drill design + independent grading pass on the
actual files, incl. a clean re-run of the probe).

**Pre-checks:** Tree clean on `main` at `b698378` before the session —
full session allowed. Guardian 14:24 UTC: 264 checks, 0 failures,
SMOKE PASSED, no Medic assignments. Baseline smoke (Lead, pre-drill):
PASSED, exit 0.

**Target (from Sunday's focus list):** scratch-only prototype of the
falling-precipitation frame hook for `js/main.js`, as specced by Atlas
in the V6-3 Atlas report (§3), judged by Team Lumen criteria; only a
proven win merges — and a merge is NOT part of a training session.

**Reviewer findings that shaped the drill (tree-verified by Lead):**
- A precipitation system already ships, snow-only, inside `main.js`:
  `syncSnowfall()` / `updateSnowfall(dt)` (~lines 363–412; 600 pts,
  60×25×60 box, fall band 2.2 + (i%5)×0.3, `performance.now` sway,
  `Math.random` seeding, centred on `player.position`, called only
  from the solo branch ~line 1620 — online play gets no snowfall).
  Atlas's V6-3 spec is therefore a GENERALISATION (all four maps,
  `weatherFx.update(dt, camera.position)`, ~900 pts, 44 m box,
  +1 call / ~0 tris / unlit / no shadows), not a greenfield build.
- No `weatherFx` / `WEATHER_FX` exists anywhere in `js/` or `tools/`.
- Drift risk in the spec itself: Sunday's focus table said "rain —
  pair with the new puddle sheet"; the report text spells it
  "puddle sheet" once and its ledger entry says "puddles" — the
  pairing phrase is "pair with the new puddles" (7 in one merged
  mesh). Read the ledger alongside the report (Lesson 14 pattern).

**Drill run (scratch-only — `js/` untouched, `git diff` empty):**
- `scratch/weather-fx/weather-fx.prototype.js` (237 lines):
  `createWeatherFx(scene, mapId, {seed})` → `{ points, positions,
  velocities, profile, mapId, update(dt, camPos), setMap(id),
  dispose() }`; `WEATHER_FX` table for snow/compound/forest/mars;
  seeded LCG (the `biomes.js` constants); accumulated internal clock
  for sway; per-particle base velocities + phases in preallocated
  typed arrays; dt clamped to [0, 0.05] (the main-loop clamp).
  Declared deltas vs the shipped snow, in the file header: box
  44×25×44 (Atlas's 44 m, shipped height kept); camera-relative Y
  band [camY−2, camY+23] so precip follows the player up the HQ
  stairs; count 900 (Atlas) vs shipped 600.
- Snow is a regression anchor, not a redesign: fall speeds are
  exactly the shipped quantised band 2.2 / 2.5 / 2.8 / 3.1 / 3.4.
  Rain (compound/forest): 11–15 m/s, near-vertical (|vx|/|vy| <
  0.15). Mars dust: 0.4–1.0 m/s fall, 4.5 m/s lateral drift
  (|vx|>|vy| for ≥90%).
- `scratch/weather-fx/weather-fx-probe.mjs` (223 lines): headless
  proof on the REAL vendored THREE via `tools/three-vendor-loader`
  (no stub). 66 checks across profiles, Lumen cost (one Points,
  position-only geometry, unlit, no shadow flags), determinism,
  camera-box recycling incl. a teleport to (100,12,−50), dt abuse
  (0 / 10 / 600 frames, no NaN), source discipline, per-profile
  velocities + a 1 s integration check, setMap dispose-once
  lifecycle (8/8 dispose events), and a perf micro-bench.

**Probe history (honest):** first run 66 checks / 6 failures — all
six were PROBE assertion defects, prototype code unchanged:
`PointsMaterial.lights` is `undefined` in the vendored THREE (unlit
by construction — asserting `=== false` was wrong); the
forbidden-token scan hit header comments naming the banned tokens
(scan code only); `update()`'s only `new` is `new TypeError` on the
missing-camera error path (strip it, require zero per-frame
allocation). Corrected probe: **66/66, PROBE PASSED**.

**Metrics:**
- Perf: 0.052 ms/update (Lead), 0.0773 ms/update (Coach re-run) —
  900 particles, both far under the 0.50 ms Lumen bar.
- Cost if merged: +1 draw call on compound/forest/mars (118→119 /
  127→128 / 129→130, all ≤165 veto), snow net 0 (replaces the
  shipped Points); 0 tris everywhere; Forest headroom preserved.
- Smoke: PASSED before and after; end-state run counts the 2 new
  scratch files in its syntax walk (264 → 266 ✓ lines).

**Grade:** **PASS** (Coach grading pass — all hard-fail checks ruled
out: no `js/` change, no lighting contact, exactly one Points,
no per-frame allocation, deterministic, count 900). Minor
deductions, none blocking:
1. ±half-span seam: the wrap leaves a particle landing exactly at
   ≥ boundary a hair outside the stated band; the probe's 1e-4
   tolerance masks it. Merge owes a half-open wrap (Lesson 20).
2. Cross-build tint determinism is probe-unproven: `build()` re-runs
   the seeded stream per map, so particle fields are per-map
   deterministic, but no check pins tint/field identity across a
   rebuild cycle — a merge-time test, not a scratch blocker.
3. Merge sequencing (for the regular V6 change, NOT today): Vega
   owns the one-line `main.js` hook (solo AND online branches —
   today's shipped snow is solo-only), Atlas owns the `WEATHER_FX`
   home in `biomes.js`, snow retires only in the same change that
   lands its replacement, and Brett's rain/dust playtest verdict
   is the court (Lesson 2). Online snow parity is a stated win.

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the end-state
tree, after the prototype + probe landed in `scratch/`.

**Commits:** one local commit, `training: build technique —
weather-fx precipitation prototype (scratch, probe 66/66)`.
Not pushed.

**New lessons:** 18 (anchor a generalisation to the shipped system
it replaces), 19 (probe assertions must match the real vendored
API + scan code, not comments), 20 (wrap into a half-open interval;
a tolerance can hide a seam). Next session: Wed Oct 28 — FIX
PRACTICE, ASSAULT 0.16 diagnostic-first per Sunday's focus list.

**Grading addendum (Coach's full written report, filed after the
commit above):** grade confirmed **PASS**; Coach's own probe re-run
measured 0.057 ms/update. Three further non-blocking deductions,
recorded for the merge change: (a) two trailing wrap-correction
`if` lines in `update()` are redundant after `wrapDelta` — remove
or justify at merge; (b) the initial particle field is built
around the origin and only camera-centres on the first `update()`
— the merge hook must call `update()` before first render (the
Atlas hook placement does); (c) the probe's comment-strip filter
is adequate for this file but fragile for trailing comments /
strings — the smoke-owned port at merge should strip more
robustly. Deduction 1 in the entry above (the ±half-span seam)
stands as the Lead's phrasing of the wrap-boundary concern from
the grading summary received in-session.
---

## Wed Oct 28, 2026 — FIX PRACTICE

**Staff:** Training Lead (ran the session), REVIEWER (recent record,
read-only), COACH (drill design per the Sunday focus list + grading
criteria; grading pass on the actual files recorded as an addendum
below).

**Pre-checks:** Tree clean on `main` at `d4ea353` (BUILD U10) —
full session allowed. Guardian 08:07 PDT Watch rotation: all-pass,
293 checks, SMOKE PASSED, live integrity byte-identical to local
HEAD, Stage 2 signed session verification still open (known, not
new). Baseline smoke (Lead, pre-drill): **PASSED, exit 0, 293
checks**.

**Target (from Sunday's focus list):** ASSAULT 0.16, diagnostic-
first: re-run the VM2 matrix segmented by map/attacker count and
write Havoc a precise unblock — do not tune numbers blind.
Full write-up: `docs/training/ASSAULT-DIAGNOSTIC.md`; raw evidence
in `scratch/assault-diag/results/`.

**Verdict on the claim: MEASUREMENT-INVALID.** The pooled 0.16
measures the instrument, not Havoc's mode numbers. No pack number
(45 s channel, defender growth 4→8/25%, defender respawn
6 s +2 s/25%, decay 2%/s) is proven wrong in either direction.
**No numbers were tuned.**

**What the diagnostic proved (all at `d4ea353`):**
- Segmented matrix (stock instrument, Oct-25 design): pooled
  0.22 (7/32) vs 0.16 — decomposition: compound 0/8 with
  channelMax 0 in all 8, snow 0/8, forest 1/8, mars 6/8. The
  pooled move came entirely from the ground-ring maps.
- Mechanism (code + per-tick trace, 26/26 parity-checked vs the
  stock botmatch): `stepAssault`'s ring needs |y − 4.6| < 3.2 on
  compound/snow; the 2D rig driver (and sim bots, same 0.6-step
  `groundHeightAt`) never take the stair routes. Compound: 0.0 s
  in-ring for ANYONE in 8/8 trace seeds. Snow: scripted player
  never in-ring in 8/8; seed 11 stands XZ-in-ring 65 s at y = 0 —
  the elevation gate, directly observed.
- Attacker count is not the lever: compound channelMax 0 at
  0/1/2/3 scripted attackers × 4 seeds (16/16 losses). Mars
  control: ≥1 attacker wins (faster with more); the 0-attacker
  control reaches 16–54% via friendly bots but loses 4/4.
- Attribution: several ground-map wins have ZERO scripted-player
  ring time (mars s23: player 78.3 m away, bots channeled 40.3 s;
  a stationary turret "wins" mars and "channels" 3.9–4.4% on
  snow) — VM2 assault outcomes substantially measure friendly-
  bot ring behaviour (Lesson 23).
- Hold phase, isolated by a scoped ring-start diagnostic
  (teleport-in, labelled, never a headline rate): elevated maps
  8/8 win at exactly 45.0 s, defender ring time 0.0 s — a started
  channel is holdable in the sim; defenders contest by fire, not
  presence (unblock U2 is a design question for Havoc).
- Solo caveat: `js/main.js` assault (player-only channel, wave-
  spawned defenders, no friendly squad) is a different game from
  the sim's; VM2 never described Brett's solo experience.

**The FIX that landed:** `rig/vm2-balance/driver.mjs` returns
`finalScore.channelMax` (peak channel at any tick) — end-state
channel hid decayed progress (peaks 84 / 60.2 / 49.5 read as
final 0–55.9). Additive only: full 32-match rerun vs the pre-fix
run shows **zero diffs on every pre-existing gameplay field**
(`wallMs` timing excepted). No game
code touched; perf budgets untouched (rig tooling only).

**Unblocks written for Havoc/Rig (diagnostic §8):** U1 teach the
driver vertical access (stair waypoints) or adopt ring-start as
a maintained VM2 case — until then, per-map reporting with
channelMax, never a pooled assault rate; U2 defender presence-
contest is a design decision, with this diagnostic as the
before-measurement; U3 friendly-bot channel discipline is close
to "bots alone never finish" already — pin it, don't fix it.
**Friday TEST CRAFT adoption spec** is written and ready
(diagnostic §9).

**Staff-claim corrections (Lesson 17):** Reviewer's "U7 spawn
re-pick" fails verification (`2808fd3` touches no spawn/map/sim
file; the point stands on U6 evidence instead); Reviewer's
compound XZ-footprint claim is not reproduced (compound XZ-ring
0.0 s in 8/8; the XZ-without-Y proof map is snow); Reviewer's
forest s23 channelMax ~60% is corroborated exactly (60.2 → 0).

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the
end-state tree (293 checks per the guardian's morning count;
both Coach grading passes also ran it PASSED, exit 0 — one
counts 294 ✓ lines, a counting-method difference only).

**Commits:** one local commit, `training: fix practice — assault
0.16 diagnostic (measurement-invalid, channelMax instrument fix,
no tuning)`. Not pushed.

**New lessons:** 21 (never pool a win rate across unlike
objectives), 22 (a decaying progress metric is reported as its
peak), 23 (attribute the objective before crediting the profile).
Next session: Thu Oct 29 — EFFICIENCY, per Sunday's focus list.

**Grading addendum (Coach's full written report, filed after the
entry above):** grade **PASS** — all 8 design-pass criteria
verified against the actual files, with independent re-runs:
trace parity re-run 4/4 (incl. a botmatch `channelMax`
cross-check: snow s31 trace 9.3 = stock 9.3); count cells
re-run matching (compound s31 ×{0,2,3} channelMax 0, mars s31
0-attacker 45.0 / final 0); post-fix matrix independently
diffed — 0 diffs on shared fields across all 32 rows; ring-start
re-runs win at exactly 45.0 s (compound/snow/mars s11); Coach's
own close-out smoke PASSED (293 checks). Verdict taxonomy
applied correctly; the `channelMax` diff ruled minimal and
sound (7 lines, return-shape only). Three minor deductions, none
blocking, all corrected in the record in-session: (1) the VM2
reporter `run.mjs` itself still pools assault by mode and
ignores `channelMax` — the diagnostic now states this scope
explicitly in §7; reporter adoption stays §9 item 1 for Friday.
(2) Coach's independent 4-seed 0-attacker mars sweep reached
channelMax 64.1 (seed 53), above this session's 54.1 sample cap
— diagnostic §8 U3 now cites both; the "bots start, never
finish" conclusion is unchanged. (3) Wording tightened where a
matrix cell spans profiles × seeds.

**Second grading pass (independent Coach re-grade of the same
files, filed with the follow-up corrections commit):** grade
**PASS** — verdict taxonomy, segmentation/sample sizes, trace
parity (26/26 re-counted), channelMax discipline, ring-start
scoping, and the U1–U3 unblocks all verified; the channelMax
fix ruled sound; no hard fail. Its three minor deductions and
their disposition: (1) "the log's commit claim is ahead of
reality" — true at grading time (files were uncommitted);
resolved by the session commit `af088ec` itself. (2) "Zero
diffs on every pre-existing field" was literally overstated —
`wallMs` differs on all rows (nondeterministic timing);
wording corrected to "every pre-existing gameplay field" in
the diagnostic and the entry above. (3) §1 presentation trims
— snow's channelMax range dropped its 0 values and forest's
loss peaks omitted 54.2; both corrected in the diagnostic.
Also carried forward from the REVIEWER report for Sunday's
CONSOLIDATE (not edited in a FIX PRACTICE session): Lesson 1's
lighting-lock statement is superseded by Brett's Oct 28 lock
lift (U7 lighting changes landed), and Lesson 7's Forest
snapshot numbers are stale post-U10 — both due for correction
under the playbook's own prune rules.

---

## Thu Oct 29, 2026 — EFFICIENCY

**Staff:** Training Lead (ran the session), REVIEWER (recent
record, read-only), COACH (drill design + independent grading
pass on the actual tree — re-ran smoke, re-planted the negative
test, phase-timed the suite, and re-measured the gate itself).

**Pre-checks:** Tree clean on `main` at `43113b8` (BUILD U13)
before the session — full session allowed. Guardian 15:10 UTC
Watch rotation: all-pass, SMOKE PASSED, live integrity
byte-identical to HEAD (U13), Stage 2 signed session
verification still open (known, not new).

**Target (from Sunday's focus list):** measure smoke/guardian
trend and per-map calls/tris; optimise only the port-8199 wait
path or the VM4 "paid for" check if the data shows it saves
repeat runs. Coach's design widened the target on evidence:
the wait is real but small; the serial syntax fan-out in
`tools/smoke.mjs` §1 is the largest single phase. VM4 was ruled
out in-session (its rule was already reframed in the Update-13
close-out; no VM4 code exists to optimise).

**Reviewer findings (tree-verified by Lead where load-bearing):**
- Nothing is red and nothing regressed: guardian at 82+ runs,
  recent all exit 0; U11/U12/U13 landed clean since Wednesday.
  The "355 checks" headline is a ✓-glyph line count; the suite's
  own distinct-check counter is 297 — figures must name their
  instrument.
- Under-tested / unmeasured, carried forward: VM2 reporter still
  pools assault and ignores `channelMax` (Wednesday §9, slated
  Fri Oct 30); ASSAULT U1–U3 unblocks open with Havoc; Stage 2
  signed sessions open; no per-phase timing existed for smoke
  before today.
- Per-map costs (two instruments, do not mix): v6-metrics STATIC
  audit — compound 51 calls / 31,268 tris, forest 64 / 222,262,
  snow 63 / 68,736, mars 65 / 53,258; sustained totals per the
  U13 report — 134 / 147 / 146 / 148 calls vs the 165 veto.
  Forest remains the perf risk: 193,712 shadow-caster tris
  (87% of its static tris; Lesson 7's warning stands, updated
  numbers). No game-code optimisation was attempted today —
  tooling only, per the drill.
- Carried to Sunday CONSOLIDATE (Reviewer, confirmed): Lesson 1
  (lighting lock lifted Oct 28 — restate or retire) and
  Lesson 7 (Forest snapshot stale post-U10/U11).

**Drill run (both changes in `tools/smoke.mjs` only):**
1. **Syntax phase, bounded-parallel:** the serial loop (81 files
   × copy to `.check.mjs` + `execFileSync node --check`, ~85–90 ms
   of process startup per spawn) now runs 4 bounded async workers
   (`execFile`); results are buffered and printed in original
   walk order. No file's check, message, or verdict changed.
2. **Boot wait, poll instead of sleep:** `wait(900)` replaced by
   a 50 ms poll of `GET /` until ok, 5 s deadline, breaking if
   the server process exits; if it never readies, the route loop
   fails and reports exactly as before. Port stays 8199; no
   check lines added or removed. Recorded as dead-time removal
   + robustness (the 900 ms false-fail cliff is gone), per
   Coach's instruction not to dress it as a standalone speed win.

**Measurements (the honest version — load drifted all session):**
- Server-ready time, three instruments: Lead 10 trials on
  dedicated ports, median 96 ms (min 93, max 293 first-spawn);
  Reviewer 30 trials on port 8199, median 165 ms; Coach grading
  pass 40 trials, median 49 ms. Reported as a range (49–165 ms
  medians); every instrument agrees the fixed 900 ms wait burned
  ~750 ms/run.
- Baselines moved with load: Lead session-start median-of-3
  7.89 s (quiet); Lead pre-drill median-of-5 13.47 s (loaded);
  Coach loaded medians 9.2–11.3 s. A single before/after would
  have measured the machine, not the change (Lesson 24).
- **Decisive test — interleaved A/B** (alternating runs, same
  path): mod 10.96 / base 12.43 / mod 10.53 / base 12.73 /
  mod 11.51 / base 14.54 → **base median-of-3 12.73 s, modified
  median-of-3 10.96 s, −1.77 s** (13.9% of the load-inflated
  median; paired deltas 1.47 / 2.20 / 3.03 s, modified faster
  3/3; the absolute saving exceeds Coach's 1.2 s gate
  calibration on the quiet baseline).
- Coach's independent re-measurement (median-of-4s, quieter
  machine): modified 8.63 s vs baseline 9.22 s (−0.59 s, −6.4%),
  and phase timing putting the syntax phase at 3.32 s of a
  9.87 s serial run (~34%). The improvement is real in every
  reading and smaller when the box is quiet — both facts are
  recorded; the saving scales with load because process-startup
  contention is what the parallel workers relieve.
- Attribution (Lead estimate, NOT independently verified —
  Coach's counter-measurement bounds the boot poll at ≤0.85 s):
  boot poll ≈0.75 s of the A/B delta; syntax parallel ≈1.0 s
  (scratch bench: serial 7.50 s vs parallel-4 median 6.50 s
  over 82 files under load; bench deleted, not in the change).

**Equivalence evidence:**
- Full stdout diff, baseline vs modified run: **byte-identical**,
  including syntax line order and all check counts.
- Negative test (run by Lead AND independently by Coach):
  planted `scratch/__training_broken.mjs` → exit 1,
  `SMOKE FAILED (1)`, exactly that file flagged with its parse
  error (path:line preserved), all other files passed; file
  removed after. Coach re-planted a different broken file with
  the same result (sole failure, attribution intact).
- Zero leftover `*.check.mjs` after passing and failing runs;
  `git status` shows only `tools/smoke.mjs` modified. No game
  code, no dependencies, no port change, perf budgets untouched.

**Corrections made in-session:** the change's first header
comment claimed the syntax loop was "~85% of total smoke
runtime" (an early estimate); Coach's phase timing says ~34%
on a quiet box. The comment was corrected before commit, and
the 85% figure is NOT carried into the lessons (Lesson 25 says
"largest single phase").

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the
end-state tree (81 syntax checks, no temp litter), after the
comment correction.

**Grade:** **PASS** (Coach grading pass — all six criteria
verified independently: output byte-identical, other sections
and port unchanged, concurrency bounded at 4 with drained
promises, negative test reproduced by Coach's own hand, no
litter after 5+ runs incl. one induced failure, tree scope
exactly one tooling file. The landing gate ruled satisfied on
its conjunctive reading: every component demonstrated, and the
paired A/B + absolute saving over the 1.2 s calibration carry
it. Two minor deductions, neither blocking: (1) the gate
arithmetic is load-sensitive — Coach's own medians show
−6.4%, so the −1.77 s headline must always travel with its
method, as recorded here; (2) the ~85% premise fraction was
wrong and stands corrected to ~34%.)

**Commits:** one local commit, `training: efficiency — parallel
syntax checks + poll-based server wait in smoke`. Not pushed.

**New lessons:** 24 (interleave the A/B when load drifts),
25 (parallelise a subprocess fan-out, but buffer the verdicts),
26 (a fixed sleep before a probe is dead time plus a false-fail
cliff). Next session: Fri Oct 30 — TEST CRAFT, VM2 reporter
adoption per the assault diagnostic §9 (per-map assault
reporting + `channelMax`), the spec already written Wednesday.

**Re-grade correction (second, independent Coach grading pass,
filed after the commit above — the PASS above was the first
grading pass): NEEDS WORK, one blocking defect.** Solo
behaviour re-verified byte-equivalent and the speed win
reproduced (Coach's own A/B: −1.48 s, 3/3 paired), and the gate
ruled satisfied on its calibration clause — but under
CONCURRENCY the change amplified a pre-existing collision:
both smoke versions name temps deterministically
(`<file>.check.mjs`) and unlink in `finally`, so overlapping
instances delete each other's temps. Baseline cost 1 false
failure in Coach's isolation test; the 4-worker version cost
12 and 44 (lockstep temp churn), and the walk snapshot could
pick a sibling's temps up as extra syntax lines. It fired for
real the same hour: **the 16:07 UTC guardian run exited 1,
`SMOKE FAILED (4)` — the first SMOKE FAILED in 83 guardian
entries** — all four "Cannot find module …check.mjs", during
this session's overlapping verification runs. Guardian re-ran
clean solo at 16:10 UTC, made no Medic edit (one-pen: training's
surface), and wrote the same prescription Coach did.

**Follow-up fix (second `training:` commit, same session):**
- Temp names unique per process: `<file>.<pid>.check.mjs`.
- The syntax walk now filters out `*.check.mjs`, so a temp
  artifact is never treated as a source file.
- Server section: if our server child died (a sibling owns
  port 8199), wait for the port to free (60 s cap) and respawn
  our own before printing any check line, instead of riding
  the sibling's server into its end-of-run kill (`ECONNRESET`
  cost 1 false failure per pair in the first fix attempt).
  Solo path unchanged apart from a 150 ms ownership settle.
- Re-verification: solo PASSED with stdout still byte-identical
  to the pre-drill baseline; negative test still exactly 1
  correctly-attributed failure; **concurrent pairs ×3: both
  instances PASSED in all 3 pairs, 81 syntax checks each, zero
  temp litter.** The re-grade's required trio is met; the
  session's final grade is PASS **as corrected** — the defect,
  the guardian red it caused, and the fix are the record, not
  a footnote.

**New lesson:** 27 (shared temp names + shared ports make
concurrent runs false-fail — and parallelism amplifies both).

---

## Fri Oct 30, 2026 — TEAM UPGRADE CYCLE 1 (efficiency pass, V7 night)

**Order:** Brett, Oct 30 00:35 PDT — upgrade the team at least
twice by morning, with measurable outcomes. Run by the Coordinator
inside the V7 build night (slices sequenced so the ship never
waited on training).

**Drill:** the five-gate release battery (smoke, biome-check,
reachability, reachability-maps, mobile-check) as an operator
workflow. Baseline serial run measured first.

**Measured results:**
- Serial battery: **12.6 s** wall, all green.
- Naive all-parallel runner: **12.4 s** — no wall-clock win
  (smoke is one CPU-bound long pole at ~11 s) — AND it produced a
  real false failure: biome-check's transient
  `tools/.biomes-check-tmp.mjs` was caught mid-flight by smoke's
  syntax sweep (✗ syntax). The shared-temp collision class of
  Lesson 27, one directory over.
- Adopted: `tools/gates-parallel.sh` — two lanes (lane 1: smoke
  then biome-check, sequential because they share the tools/
  temp space; lane 2: reachability + reachability-maps +
  mobile-check alongside). **12.1 s, all five PASS, twice
  consecutively.**

**Outcome (what got faster/safer):** gate verification for a build
is now ONE command with ONE verdict and a per-gate log for
triage (5 invocations + manual log-chasing → 1). The collision
mode is designed out, not lucked out. Lesson recorded: measure
before parallelizing; parallelize operator round-trips, not a
CPU-bound long pole; and any two tools that share a temp
directory are a sequential lane by definition.

**Commits:** `97f4d83` (runner + V7 version bump).

---

## Fri Oct 30, 2026 — TEAM UPGRADE CYCLE 2 (capability / role-sharpening pass, V7 night)

**Order:** same Brett directive — second distinct cycle.

**Drill:** sharpen the FINAL EXPANSION's new seats from
aspirational tasks into verifiable ones. Test case: seat 73
(Iris "Trueup" Nakamura, Spec Accuracy Checker) — her standing
task ("a displayed number that disagrees with specSheet() is a
release blocker") was prose until tonight. The cycle built her
instrument and ran it against the whole arsenal.

**Artifact:** `tools/spec-audit.mjs` — recomputes every build's
spec sheet from the tables and asserts the gunsmith's promises:
(1) ADS spread < hip spread for every weapon, stock and with
every single fitting attachment; (2) every attachment moves at
least one measured number on at least one weapon it fits (no
dead attachments); (3) panel numbers equal a hand recomputation
from the effective row (no display drift).

**Measured results:** first run — **all promises hold.** All 15
attachments move measured specs (optics on 1–5 weapons by fit,
magazines on 5, barrels on 3); zero sheet drift across all
weapon × single-attachment builds (5 weapons × up to 16 builds);
zero ADS≥hip violations. The audit now runs in seconds and is
the acceptance test every future attachment must pass before it
ships (Balance Audit seats 45–49 consume its output per slot).

**Outcome (what got sharper):** 50 new seats onboarded the same
night they were created (TEAM.md, commit `f1d016e`); the roster's
checking seats now hold instruments, not intentions — spec
checking went from "a person eyeballs the panel" to a 0.1 s
deterministic audit, and the perf accountants' ledgers are read
off `tools/v6-metrics.mjs` output in the V7 report scorecard.

**Commits:** `f1d016e` (roster), this log + `tools/spec-audit.mjs`.

---

## Fri Oct 30, 2026 — TEST CRAFT

**Staff:** Training Lead (ran the session), REVIEWER (recent
record, read-only), COACH (drill design; grading pass on the
actual files recorded below / as addendum).

**Pre-checks:** Tree clean on `main` at `4c9f53d` (V7.5 +
today's Watch fix) before the session — full session allowed.
Guardian 08:07 PDT Watch rotation: all-pass, SMOKE PASSED
(334 checks), live integrity byte-identical to HEAD, plus a
MEDIUM fix landed by the Watch itself: `validateHello` now
rejects control characters in the display name
(`net/protocol.js`, commit `4c9f53d`), verified by hand only.
Baseline smoke (Lead, pre-drill): **PASSED, exit 0**.
Backend-defense findings from the same rotation (no connection
caps, no general message rate limit, no violation logging,
signal size-cap mismatch, no Origin check) are build-session
work, NOT training scope — recorded here so they are not lost;
none was touched today.

**Targets (both promised/carried into today):**
1. Wednesday's §9 item 1 (repeated as Thursday's next-session
   line): adopt `channelMax` in the VM2 reporter — per-map
   assault rows, pooled assault rate removed or footnoted.
2. Coach's same-day addition, tree-verified by the Lead: the
   Watch's hello control-character fix shipped with NO smoke
   coverage — N3/N4/N9/N10 test valid/bad-protocol/rich/
   malformed-mode hellos, none touches a control character.
   An unpinned security fix is tomorrow's silent regression.

**Drill A — smoke pin N15 (`tools/smoke.mjs` only):**
- New check **N15** after N14 (no renumbering): `validateHello`
  must reject names containing `\n`, NUL, and DEL, and must
  still accept an ordinary spaced name (`'A B'` — space is not
  a control character). Header comment cites the Watch fix and
  states the threat honestly (display-spoof hygiene;
  textContent-only rendering means not XSS).
- Lead's pre-drill manual probe agreed: BRETT / 'A B' ok:true;
  `\n` / `\0` / `\x7f` / `\t` names ok:false.

**Drill B — VM2 reporter adoption (`rig/vm2-balance/run.mjs`
only; driver, botmatch, sim untouched):**
- `agg()` gains `channelMaxPeak` / `channelMaxMean` from
  `finalScore.channelMax`. Groups whose rows carry no such
  field (pre-Oct-28 reports, non-assault modes) return **null**,
  never a fabricated 0 (Lesson 29).
- New `byAssaultMap` aggregate + **B3 section** in the report:
  per-map assault rows with win rate and channelMax peak/mean.
  The B2 pooled assault row now carries a footnote in the
  report itself: instrument-limited, do not headline, report
  per map from B3 until unblock U1 lands (Lesson 21).
- `byAssaultMap` added to the JSON report payload alongside
  `byProfile` / `byMode`. §9 items 2–4 (ring-start cases,
  0-attacker control pin, trace promotion) were NOT adopted —
  they need the rig's maintained-case work, not a reporter
  change; they stay open for a future TEST CRAFT / rig session.

**Verification (all Lead-run, tree-evidenced):**
- Syntax: `node --check` clean on both edited files.
- Smoke post-drill: **exit 0, SMOKE PASSED, 335 ✓ lines** —
  exactly +1 over the guardian's 334, the delta is N15 alone.
- **Negative test:** the protocol regex was temporarily
  disabled → smoke exit 1, `SMOKE FAILED (1)`, sole failure
  `✗ N15 validateHello accepted a name containing a newline`;
  `net/protocol.js` restored via `git checkout` and verified
  clean (diff scope is exactly the two drill files).
- VM2 agg harness (synthetic, run from /tmp, not committed):
  mars rows peak 100 / mean 80.1; compound measured peak **0**
  stays distinct from an empty group's **null**; the Oct 25
  historical report's 32 assault rows (recorded before the
  field existed) aggregate to null channelMax **and reproduce
  the pooled win rate 0.16 exactly** — old reports stay
  readable and honest under the new reporter.
- Live end-to-end (current driver on HEAD, two botmatches):
  mars assault seed 11 — win, `channelMax 100`; compound
  assault seed 11 — lose, `channelMax 0` (the diagnostic's
  structural zero, now visible in the field the reporter
  consumes). A full 96-match VM2 run was not attempted
  in-session; the reporter change is aggregation-only and its
  inputs were proven at both ends.
- Perf budgets untouched; no game code, no dependencies,
  no network calls added.

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the
end-state tree (recorded after the final edits below).

**Grade:** **PASS** (Coach grading pass on the actual files —
independently re-ran smoke solo: exit 0, 335 ✓ lines, N15
immediately after N14 in stable order; direct `validateHello`
import test reproduced all four N15 behaviours; negative-test
logic verified by reconstruction in /tmp — disabling the
protocol branch flips `'A\nB'` to ok:true and trips N15's sole
fail path, and `net/protocol.js` is clean in git status; VM2
diff verified confined to `run.mjs` with null-not-0 handling).
Three deductions, all evidence-retention, none contradicting a
claim: (1) the guardian's 334 count has no in-tree source —
only the 335−1 arithmetic supports it; (2) the VM2 synthetic /
live numbers were not retained in-tree at grading time —
**since retained** at `scratch/training-testcraft-2026-10-30/
results.txt` (agg harness output, both botmatch JSON lines,
smoke + negative-test lines, validator probe); (3) the Lead's
negative-test full-smoke run was not witnessed — reconstructed
sound by the grader, and its output lines are in the same
retained results file.

**Commits:** one local commit, `training: test craft — smoke
N15 pins hello control-char fix; VM2 reporter per-map assault
+ channelMax (diagnostic §9.1)`. Not pushed.

**New lessons:** 28 (a hand-verified fix is unguarded until a
gate pins it), 29 (an absent field is not a measured zero).
Next session: Sat Oct 31 — REALISM, Verity-led review per
Sunday's focus list (HQ interiors desk review; at most one
small in-budget fix, gates green).

---

## Sat Oct 31, 2026 — REALISM

**Staff:** Training Lead (ran the session), REVIEWER (recent record
+ HQ/Ops desk audit, read-only), COACH (drill design; grading pass
on the actual files + a confirmation re-grade, both read-only).

**Pre-checks:** Tree clean on `main` at `ccf501b` before the
session — full session allowed. Guardian 08:07 PDT Watch rotation:
all-pass, SMOKE PASSED (335 checks), live integrity byte-identical
to HEAD, no Medic assignments. Known backend-defense opens
unchanged (conn/room caps, general rate cap, audit logging, signal
size mismatch, Origin check, Stage 2) — build-session scope, not
training's, and untouched today. Baseline smoke (Lead, on HEAD via
stash compare): **PASSED, exit 0, 335 ✓ lines**. Note: the day's
two stand-down session commits since Friday's TEST CRAFT touched
no game code, so the realism target carried in from Sunday's
focus list stands as planned.

**Target (Sunday focus list + Friday's next-session line):**
Verity-led desk review of the HQ interiors (Ops 3-room + HQ
6-room/stairwell) — headless, so code/data evidence only; Brett's
playtest verdict remains the court on whether it LOOKS right.
Screenshots are not feasible in this environment (standing fact
since the V7 night), so no visual claim is made or implied.

**Verity desk review — what the record shows (all file:line
verified by Reviewer, re-verified by Lead/Coach):**
- HQ solids (`js/world.js:647–733`, mirrored `worlddata.js:152–
  197`, SOLIDS 178 pin intact): 22.5×9 m, two floors, P1/P2
  partitions with 1.4 m gaps, stair run + railing, door gaps in
  the exterior walls only. Interior content is crates and nothing
  else — a room the code comments call a bunk room has no bunks,
  the NE "ops room" has no desk or console. By contrast the Comms
  Shed carries a PM wall panel + GC console screen
  (`world.js:961–962`) and the Relay Tower a GC screen (`:975`).
- The sharpest break: the HQ facade (`world.js:913–947`) places
  11 exterior windows in the GW/GC/GD glass buckets — the lit
  ones glow — but there is NO interior dressing anywhere in the
  HQ block: from inside, the wall faces at those exact x/y are
  plain wallMat. A room reads windowless from within while its
  windows burn outside.
- Ops Building (centre −32,44): its partitions (Stage 1,
  `world.js:632–635`) have NO facade dressing at all — no
  interior door frames on the partition gaps, unlike the HQ's
  framed exterior doors. Recorded as a NEW finding / future
  REALISM candidate; not today's fix (one unit per session).
- Deferred with reasons: stair handrail (Coach candidate 2 —
  sloped-rail geometry cannot be honestly verified headless);
  PM panel + screens console wall in the NE ops room (Coach
  candidate 1 — larger unit; the window panels below answer the
  more basic break first and the panel pattern remains available
  to a future session); partition door frames (candidate 3).

**The one improvement that landed (`js/world.js` facade block
only, +14 lines):** four interior window-light panels,
`BoxGeometry(0.94, 0.84, 0.05)` — the shipped pane size — pushed
into the EXISTING glass buckets at the interior faces of four
lit HQ windows, bucket matched to the exterior pane:
GW (−19, 1.70, 46.34) ground south / bunk room; GW (−11, 1.70,
37.66) ground north / NE ops room; GC (−19, 4.825, 46.34) upper
south / overwatch west; GW (−17, 4.825, 37.66) upper north /
stairwell light. Placement arithmetic: south inner face z 46.35,
panel spans 46.315–46.365 (15 mm embed, 35 mm proud); north
mirrored at 37.66 vs face 37.65; upper centres 4.825 = slab top
3.125 + the exterior panes' 1.70 centre height. One Lead
refinement on the Reviewer's set, recorded openly: its fourth
pane (−11 upper north) backs a GD DARK exterior pane, so it was
swapped for −17 upper north (exterior GW) — no lit panel backs
dark glass, and GD panes get none (Lesson 30). Visual only:
merged into the existing GW/GC meshes, which never cast
(`world.js` glass creation sets receiveShadow only) — no new
mesh, material, collider, or worlddata entry.

**Metrics before/after (§3.4 offset named, Lesson 5):**
- v6-metrics on HEAD: compound sustained 134 calls / 93,052
  tris, static 51 / 33,788, casters 30, shadow pass 189 calls /
  77,598 tris. After: **134 calls (Δ0) / 93,100 tris (+48 =
  4 panes × 12 tris, exactly)**, static 51 (Δ0) / 33,836 (+48),
  casters 30 (Δ0), shadow Δ0. Forest/snow/mars each +48 tris,
  +0 calls, casters Δ0 (the facade block rides the shared
  buildWorld). Offset: merging into the existing glass buckets
  avoided +4 meshes / +4 draw calls; headroom after — compound
  sustained 134 vs the 165 veto, 93,100 tris vs 300k, zero new
  shadow casters against the binding budget. `v6-metrics.json`
  writer side-effect restored on every run. The harness's
  pre-existing warnings (lighting hash vs the stale V6 baseline,
  sun-disc flat strike, soldier bar, version note) are unchanged
  and were not touched — the lighting-hash item is already
  queued for Sunday's CONSOLIDATE lesson correction.
- Smoke stdout before vs after: **byte-identical** (335 ✓,
  PASSED both) — verified by stash-compare and again on the
  final tree.

**Grading history (honest):** Coach's first grading pass ruled
**NEEDS WORK** on one blocking defect — C2–C8 all PASS with
metrics independently reproduced to the tri, geometry re-derived
flush with no crate/partition/door/stair conflicts, smoke
re-run solo green — but the landed code comment claimed the
upper panels sit at "slab 3.125 + 1.7" (= 4.825) while the code
used 4.83 (+1.705): a false arithmetic claim in the permanent
record (Lesson 19's exactitude rule). Correction: the code was
changed to the stated value (both upper panels y 4.83 → 4.825;
nothing else moved), smoke + metrics re-verified unchanged, and
Coach's confirmation re-grade on the committed-content tree
returned **FULL PASS — all eight criteria, no deductions
outstanding**, its own run reproducing 93,100 tris (+48).

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the
end-state tree (335 ✓ lines, stdout byte-identical to the HEAD
baseline).

**Grade:** **PASS** (Coach grading pass + confirmation re-grade
after the one-line arithmetic correction recorded above).

**Commits:** one local commit, `training: realism — HQ interior
window-light panels for lit windows (Verity review)`. Not pushed.

**New lessons:** 30 (a lit window must read from both faces —
interior panels in the same glass buckets, bucket-matched, dark
panes get none; state panel arithmetic exactly). Next session:
Sun Nov 1 — CONSOLIDATE (no code changes): re-baseline per
Sunday's plan, correct Lessons 1/7 stale statements, prune per
the playbook rules, and carry forward the Ops-interior dressing
finding + NE ops console-wall candidate.

**Post-close-out addendum (same day, after the commit above):**
Two items from the staff's full written reports arrived after
close-out and are recorded here so they are not lost:

1. **REVIEWER headline finding — the facade block is stale by
   one expansion (Lead-verified after close-out, Lesson 17).**
   U6-12 (`5e4438b`) grew Ops 10×8 → 12×10 and HQ west −22 →
   −24.5, but that commit touched ZERO facade coordinates
   (`git show 5e4438b -- js/world.js`, window/trim markers: 0
   hits), so parts of the facade still describe the pre-growth
   buildings: Ops north windows at z 39.97 vs the north wall's
   faces at 39.0/39.3 (~0.7 m inside the room, floating), with
   the same drift on Ops' south/west faces, corner boards, door
   frames and parapets; HQ west windows at x −22.19 vs the west
   wall at −24.5 (2.46 m inside the widened bunk/overwatch
   rooms), plus the west parapet, floor-line band and corner
   boards at −22-era x. HQ north/south/east facade DOES align
   (those walls did not move), which is why the drift hides.
   Today's landed panels are unaffected — all four sit on the
   aligned north/south faces, inside solid wall spans (Coach C2
   verified). Why it survived: facade geometry is visual-only,
   unmirrored, and NO gate pins a single window/trim coordinate
   — a candidate TEST CRAFT item (pin facade anchors the way T1
   pins SOLIDS). Priced follow-up (Reviewer): re-anchor the
   drifted sets by coordinate-only edits inside the existing
   merged meshes (+0 calls, +0 tris, no casters) — HQ west face
   is one training-sized slice (windows → x −24.69, parapet →
   −24.65, band → −24.66, corner boards → −24.5); Ops' four
   faces are a regular build session's job. This is the top
   candidate for the next REALISM session; it was NOT landed
   today (one unit per session, and the session had closed).
2. **Grading Coach's minor deduction, corrected:** the landed
   comment said the panels sit "at the same x/y as the exterior
   panes" — exact for the ground pair, imprecise for the upper
   pair (same x; centres 4.825 by design vs the panes' 4.6).
   The comment now states both numbers. A follow-up
   `training:` commit carries this comment correction plus this
   addendum (comment/docs only — no geometry changed; smoke
   re-run green before that commit, stdout unchanged).

---

## Sun Nov 1, 2026 — CONSOLIDATE

**Staff:** Training Lead (ran the session), REVIEWER (recent record,
read-only), COACH (consolidation plan + grading criteria; grading pass
on the actual files recorded below / as addendum).

**Pre-checks:** Tree clean on `main` at `9e746f6` before the session —
full session allowed; Sunday rule applies regardless: no code changes.
Guardian Nov 1 08:07 PT Watch rotation: all-pass, SMOKE PASSED
(335 checks), mobile-check T1–T13 pass, live integrity explained
(live world.js is origin/main V7.5; local diff is exactly the unpushed
Oct 31 training panels, awaiting a gated push). Since Saturday's
REALISM session only 3 commits landed, all docs-only stand-down
verifications — no code, no push.

**Drill run:** Consolidation only — `LESSONS.md` corrected under its
own prune rules (contradicted lessons corrected in place with date +
new evidence, never silently deleted):
- **Lesson 1 — CORRECTED (flagged 3 sessions running, since Oct 28).**
  "Lighting is locked" is false: Brett lifted the lock Oct 28 (U7 spec
  `96d7723`), and U7-04 landed (`2808fd3`/`ad081ab`). New baseline,
  tree-verified today: `js/lighting.js` sha `38cded1a06271631`,
  exposure per-profile (compound 1.10 / forest 1.08 / snow 1.08 /
  mars 1.06), shadowExtent 86 all profiles, normalBias 0.35
  (`js/main.js:69`), shadow map still 4096. Durable rule restated:
  lighting moves only on Brett's order, and every profile must clear
  SHADOW_FLOOR 0.36. The v6-metrics LIGHTING TOUCHED warning fires
  against the stale V6 baseline — expected, not a regression. The
  pre-U7 lock statement also added to the Retired section.
- **Lesson 7 — CORRECTED.** Durable pattern kept (caster tris are the
  shadow budget; Forest tightest); post-V6-3 snapshot (127 calls /
  213,868 tris) retired. Replacement figures are dated and
  instrument-named from the re-baseline below.
- **Lesson 8 — DEMOTED to historical, NOT re-baselined.** The Oct 25
  condition ("if Brett/Havoc have ruled") is unmet: no ruling on V6-3
  feel in the record, and the premise expired — V7 Slice A (`2c37103`)
  changed `js/weapons.js`. TTK re-baseline is OPEN, pending a post-V7
  VM2 re-run + Havoc ruling.
- **Lesson 11 — MERGED into Lesson 27** (duplicate under the prune
  rules). One-line pointer remains, stating plainly: smoke still uses
  fixed port 8199, a random port is still open, and Oct 29 mitigated —
  did not fix/randomise — the port.
- **Lesson 2 — SCOPE CORRECTED.** Pattern kept; the expired
  "V6 Updates 3–20" bound removed (V7 superseded the spine Oct 30).
- **Lesson 6 — KEPT + reinforced** with a second proof: Oct 31 facade
  panels +48 tris identical on all 4 maps, Δ0 calls/casters.
- All other lessons (4, 5, 9, 10, 12–30): no prune today. Warning
  noted for Sun Nov 8: Oct 25-cited snapshots hit the 2-week expiry.

**Re-baseline (Lead-measured today, `tools/v6-metrics.mjs` on HEAD
`9e746f6`; the harness's `v6-metrics.json` writer side-effect was
restored, as in prior sessions):**
- Smoke: 335 checks, PASSED (guardian + Lead close-out, below).
- Compound: sustained 134 calls / 93,100 tris; static 51 / 33,836.
- Forest: sustained 148 calls / 285,774 tris; static 65 / 226,510;
  38 casters; shadow-pass est. 211 calls / 250,088 tris.
- Snow: sustained 147 calls / 131,408 tris; static 64 / 72,144.
- Mars: sustained 149 calls / 115,930 tris; static 66 / 56,666.
- Lighting integrity line: sha `38cded1a06271631` vs stale baseline
  `a40a3f79c85670a6` — CHANGED, as expected post-U7 (see Lesson 1).

**Open items carried forward (unchanged, no new regressions):**
backend hardening list (conn/room caps, routing-layer rate caps,
Origin check, re-hello overwrite, audit log, signal size mismatch,
in-process WSS, Stage 2 signed sessions) — build-session scope, NOT
training; U6-12 facade drift (top REALISM candidate, priced below);
Ops interior dressing / NE ops console wall; ASSAULT U1–U3; VM2
reporter §9 items 2–4; playtest verdicts owed on V7/V7.5 (driving
feel first, then ADS tightness, gunsmith readability, recoil feel,
online dogs) — no verdicts in the record yet.

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** (335 ✓ lines) on
the end-state tree. Diff scope: `docs/training/` only.

**Grade:** **PASS** (Coach grading pass on the actual files — all
six criteria met, no blocking defects, no deductions; Coach
independently re-ran smoke solo: exit 0, SMOKE PASSED, 335 ✓
lines, tree clean of side-effects).

**Commits:** one local commit, `training: consolidate — correct
Lessons 1/7/8/11/2/6, Nov 1 re-baseline + next-week focus`.
Not pushed.

### Next week's focus (Mon Nov 2 – Sun Nov 8, 2026)

| Day | Drill | Concrete target |
|---|---|---|
| Mon Nov 2 — CODE QUALITY | `js/world.js` facade block: extract facade coordinates into a named anchor table/constants, zero geometry moved; proof = metrics identical (Lesson 16 pattern), smoke green. Prep for Wed + Fri. |
| Tue Nov 3 — BUILD TECHNIQUE | Weather-fx merge-prep, scratch only (do NOT merge in training): fix the half-open wrap (Lesson 20), pin cross-rebuild tint determinism, remove the 2 redundant wrap `if`s; re-run the 66-check probe. Merge itself is a regular build change (Vega: `main.js` hook; Atlas: `WEATHER_FX` home). |
| Wed Nov 4 — FIX PRACTICE | U6-12 facade drift, HQ west face slice only: windows → x −24.69, parapet → −24.65, band → −24.66, corner boards → −24.5. Coordinate-only in existing merged meshes, +0 calls / +0 tris / no casters, green-or-revert. Ops' four drifted faces are explicitly NOT this slice (build session). |
| Thu Nov 5 — EFFICIENCY | Re-baseline Forest shadow budget on the V7.5 tree (follow-through on today's Lesson 7 correction): static vs sustained + caster tris; optimise one caster bottleneck only if a merged/instanced win is measured, otherwise measurement-only is a pass (Lesson 24 if timing is claimed). |
| Fri Nov 6 — TEST CRAFT | Facade anchor gate pin: pin facade anchors the way T1 pins SOLIDS, with a negative test (shift one anchor → sole failure). Pin Wed's west face if it landed, else the aligned N/S/E anchors and log the gap. Queued behind it: VM2 §9 items 2–4 (ring-start cases, 0-attacker Mars control pin, trace promotion). |
| Sat Nov 7 — REALISM | Verity review: Ops interior dressing / NE ops console wall (PM panel + GC console pattern from Comms Shed / Relay Tower) + Ops partition door frames. At most one small unit, +0 calls via existing buckets; dress only interior/aligned surfaces — nothing on Ops' drifted exterior facade until the build session re-anchors it. Brett's playtest verdict is the court. |
| Sun Nov 8 — CONSOLIDATE | No code. Prune at the 2-week expiry line; review ASSAULT U1–U3 status without tuning; update Lesson 8 only if a Havoc ruling exists in the record by then. |

Explicitly NOT assigned to training next week: backend hardening
(build-session / Lockdown scope) — drills must not drift into it.

---

## Mon Nov 2, 2026 — CODE QUALITY

**Staff:** Training Lead (ran the session), REVIEWER (recent record,
read-only), COACH (drill design per the Nov 1 focus table; grading
pass on the actual files by a fresh Coach instance — the design
instance had closed before grading, so grading was independently
re-dispatched, not self-graded).

**Pre-checks:** Tree clean on `main` at `2ebffa3` before the
session — full session allowed. Guardian Nov 2 08:07 PT Watch
rotation: all-pass, SMOKE PASSED, live integrity byte-identical
to HEAD, no Medic assignments. Since Sunday's CONSOLIDATE only
docs-only stand-down commits landed — no code. Baseline (Lead):
smoke **PASSED, 335 checks, exit 0**; v6-metrics captured (below).

**Target (from Sunday's focus list):** `js/world.js` facade block —
extract facade coordinates into a named anchor table/constants,
zero geometry moved; proof = metrics identical (Lesson 16
pattern), smoke green. Prep for Wed Nov 4 (HQ west re-anchor)
+ Fri Nov 6 (anchor gate pin).

**Reviewer findings (tree-verified by Lead where load-bearing):**
- State of play: V7.5 is the last shipped build; since then only
  stand-down verifications and training commits. Playtest verdicts
  still owed (V7/V7.5 feel items); backend hardening + Stage 2
  signed sessions remain build-session/Lockdown scope, NOT
  training's — untouched today, as the focus table directs.
- Facade drift re-measured against the solids (not the stale
  comments): HQ solids centre is **-13.25, 42** (the facade header
  says -12 — stale), HQ west wall outer face **-24.5**; Ops is
  12×10 post-U6-12 (walls x -38..-26, z 39..49), so Ops anchors
  (e.g. north windows z 39.97 vs the wall at z 39) are likewise
  pre-growth — a build session's re-anchor, explicitly not a
  training slice. Wed's HQ-west targets confirmed from the solids:
  windows -24.69, parapet -24.65, band -24.66, corner boards -24.5.
- Under-tested, unchanged: facade geometry has NO gate pin (Fri's
  drill); ASSAULT U1–U3 open; VM2 §9 items 2–4 open.

**Drill run (`js/world.js` facade block only):**
- New **`FACADE_ANCHORS`** table (`Object.freeze`, array values
  frozen too) directly after the bucket declarations: shared
  heights (winY 1.7, hqUpperY 4.6, hqPanelY 4.825, commsY 1.5),
  Ops planes/centres (opsNorthZ/WestX/SouthZ + X/Z lists), HQ
  planes/centres (hqSouthZ/NorthZ/SouthX/NorthX, hqWestWinX +
  hqWestUpperWinX both -22.19, hqEastWinX, panel Z faces), Comms
  (commsNorthZ/X). Header comment states the zero-move proof, the
  Wed/Fri sequencing, and both drifts (HQ west + Ops pre-growth).
- All **20 `win()` calls** (Ops 7, HQ 11, Comms 2) and all **4
  interior panel pushes** (Oct 31) now read x/y/z from the table.
  Face strings, GW/GC/GD bucket assignments, and panel geometry
  sizes unchanged. **No `t_()` trim call touched** — one-off
  placements stay literal (Coach deduction 1, recorded below).
- One in-session correction (comments are claims, Oct 31 rule):
  the table's HQ comment cites the solids centre -13.25 with its
  source, not the stale -12 the old header carries.

**Metrics before/after (identical — the drill's whole point):**
- Smoke: PASSED, 335 checks, exit 0, before and after.
- v6-metrics, all four maps, every field: compound sustained
  134 calls / 93,100 tris, static 51 / 33,836, casters 30,
  shadow 189 / 77,598; forest 148 / 285,774, static 65 /
  226,510, casters 38, shadow 211 / 250,088; snow 147 /
  131,408, static 64 / 72,144, casters 40; mars 149 / 115,930,
  static 66 / 56,666, casters 40; instanced/flat/textured
  shares identical. (`v6-metrics.json` writer side-effect
  restored on every run.)
- Coach's stronger proof: both trees' facade geometry parsed
  into a (bucket, x, y, z, w, h, d) multiset — **+30 added /
  -0 removed / +0 net** (the 30 are table-construction entries,
  not geometry); parsed `win()` coordinate tuples identical.

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the
end-state tree (335 ✓ lines), after the records below were
written.

**Grade:** **PASS** (Coach grading pass — all 5 criteria PASS,
no auto-fail triggered, all 23 table values verified
value-identical against HEAD). Three deductions, none blocking:
(1) trim `t_()` literals still share plane values with the table
(39.97 ×13, 46.69 neighbours, 37.31 ×4, 53.47 ×3) — a Wed fix
that touches trim must hand-sync; accepted as the design's
stated scope boundary, build-session scope to fold in;
(2) anchored `win()` lines run to 298 chars vs the file's
~110-char style — an acceptability judgment, not a failure
(the table reads better than the calls now do);
(3) Lesson 31 wording: include the frozen-table + parsed-proof
clause — adopted verbatim in the lesson as filed.

**Commits:** one local commit, `training: code quality —
FACADE_ANCHORS table for world.js facade windows (zero geometry
moved)`. Not pushed.

**New lessons:** 31 (shared planes get a named anchor table
before anyone re-anchors them; keep it frozen; prove zero-move
parsed, not eyeballed). Next session: Tue Nov 3 — BUILD
TECHNIQUE, weather-fx merge-prep in scratch only (half-open
wrap fix, cross-rebuild tint pin, redundant wrap `if`s; 66-check
probe re-run) per Sunday's focus list.

---

## Tue Nov 3, 2026 — BUILD TECHNIQUE

**Staff:** Training Lead (ran the session), REVIEWER (recent record,
read-only), COACH (drill design + rubric per the Nov 1 focus table;
grading pass on the actual files by a fresh Coach instance —
recorded below).

**Pre-checks:** Tree clean on `main` at `b5579e7` before the
session — full session allowed. Guardian Nov 3 08:07 PT Watch
rotation: all-pass, SMOKE PASSED, mobile-check T1–T13 pass,
0 TODO/FIXME in game code, live integrity explained (live
`world.js` matches origin/main; the local diff is exactly the
unpushed Nov 2 training commit — not drift). Since Monday's CODE
QUALITY session only docs-only stand-down verifications landed —
no code. Baselines (Lead, personally run): probe **66/66, PROBE
PASSED** (0.052 ms/update); smoke **PASSED, exit 0**.

**Target (from Sunday's focus list):** weather-fx merge-prep,
scratch only — do NOT merge. Fix the half-open wrap (Lesson 20),
pin cross-rebuild tint determinism, remove the 2 redundant wrap
`if`s; re-run the 66-check probe. The merge itself stays a regular
build change (Vega: `main.js` hook; Atlas: `WEATHER_FX` home),
gated on Brett's playtest.

**Reviewer findings (tree-verified by Lead where load-bearing):**
- All three Oct 27 grading deductions were still open in the
  scratch, byte-for-byte the graded Oct 27 state: `wrapDelta`
  closed-interval (`>` at prototype:110), no probe check pins
  field/tint identity across a `setMap` rebuild (§H checks only
  that identity *changes*), and the trailing wrap `if`s at
  prototype:212-213 are provably dead (post-wrap, the `<`
  conditions can never fire; lower-bound only, asymmetric).
- Under-tested, unchanged: facade geometry has NO gate pin (Fri
  Nov 6 drill); the weather-fx probe is NOT wired into smoke (a
  merge owes a smoke-owned version); ASSAULT U1–U3, VM2 §9 items
  2–4, backend hardening (build/Lockdown scope, NOT training),
  U6-12 facade drift, and V7/V7.5 playtest verdicts all carried.

**Drill run (scratch-only — `scratch/weather-fx/`, `js/` diff
empty):**
- **Half-open wrap fixed** (`weather-fx.prototype.js`):
  `wrapDelta` upper branch `>` → `>=`, so offsets wrap into
  `[-span/2, +span/2)` — `+22 → -22`, `-22 → -22`, `±44 → 0`,
  `±66 → -22` at span 44. The y band was already half-open
  (`[yLo, yLo+25)`) and is pinned, not refactored (max fall step
  0.75 m ≪ 25, one correction suffices). Header + wrap comments
  state the interval exactly.
- **Redundant `if`s removed:** both trailing lower-bound-only
  corrections in `update()` deleted with the now-dead `halfW` /
  `halfD` locals; the recycle comment states why no second
  correction exists or is needed.
- **Probe strengthened** (`weather-fx-probe.mjs`): `inBox()` now
  asserts the strict half-open contract with **zero tolerance** —
  the 1e-4 slack that masked the seam survives nowhere in a
  bounds assertion (the probe is fully deterministic, so a
  strict pass is stable). New **§J (11 checks)** constructs the
  seam deterministically: sway-free compound, particle 0's
  velocity zeroed (the step adds exactly 0), camera (0,2,0) so
  yLo = 0 exactly, placements/expectations all exact-representable
  and asserted with `===`. New **§K (8 checks)** pins cross-rebuild
  determinism over full (`snow→compound→mars→forest→snow`) and
  short cycles: positions + velocities byte-identical to the
  pre-cycle snapshot AND to a fresh same-seed instance, tint
  pinned against the literal spec hexes (rain 0xafc4de, mars
  0xd8a37a, snow 0xeef4ff) plus snapshot size/opacity/flags, and
  profile deep-equality — all compared **pre-update**, because
  `elapsed` is instance-level, survives `setMap`, and drives sway,
  so any post-update rebuilt-vs-fresh comparison is confounded;
  post-update identity is covered only by **K8 twin-history**
  (identical setMap + dt sequences, 150 updates, byte-identical).

**Metrics:**
- Probe: **85 checks, 0 failures, PROBE PASSED** (66 original
  §A–§I, none removed or loosened, + 11 seam + 8 rebuild) —
  three consecutive green runs on the end-state scratch.
- Perf (§I): 0.044–0.045 ms/update on settled re-runs (one
  0.197 ms reading under shared-box load, reported per Lesson 24;
  all far under the 0.50 ms Lumen bar). Cost profile unchanged:
  one Points, 900 particles, position-only, unlit, no shadow
  flags — and nothing ships, so game budgets are untouched.
- Sensitivity (Coach rubric spot-checks, Lead-run, mutations
  reverted in-session): reverting `>=` → `>` fails **exactly**
  J1/J5/J7 and nothing else; perturbing the snow tint
  0xeef4ff → 0xeef4fe fails **exactly** K1/K5 and nothing else.
  Both pins can fail, and each fails only its own section.

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the
end-state tree, after the records below were written. Diff
scope: `scratch/weather-fx/` + `docs/training/` only;
`git diff -- js/` empty; `main.js` untouched.

**Grade:** **PASS** (fresh Coach grading pass on the actual
files, independently re-verified: probe re-run 85 checks /
0 failures, smoke re-run exit 0 SMOKE PASSED, `git diff -- js/`
empty, scope confined to `scratch/weather-fx/` +
`docs/training/`; all six rubric criteria PASS, no deductions
against the criteria. One minor records note — this entry's
Commits line was filed before the commit was made; resolved by
the commit below. The Coach also judged both mutation
signatures arithmetically exact from the probe code.)

**Commits:** one local commit, `training: build technique —
weather-fx merge-prep (half-open wrap, cross-rebuild pin, dead
wrap ifs removed)`. Not pushed.

**New lessons:** 32 (pin rebuild determinism pre-update against
literals + a fresh instance; `elapsed` survives rebuilds, so
post-update rebuilt-vs-fresh comparisons are confounded evidence;
twin-history is the valid post-update pin). Lesson 20 reinforced
with the landed fix. Next session: Wed Nov 4 — FIX PRACTICE,
U6-12 facade drift, HQ west face slice only (windows → −24.69,
parapet → −24.65, band → −24.66, corner boards → −24.5;
coordinate-only in existing merged meshes, +0 calls / +0 tris /
no casters, green-or-revert) per Sunday's focus list.

---

## Wed Nov 4, 2026 — FIX PRACTICE

**Staff:** Training Lead (ran the session), REVIEWER (recent record,
read-only), COACH (drill design + rubric; grading pass on the final
files by a fresh Coach instance — the design instance had closed
before grading — recorded below).

**Pre-checks:** Tree clean on `main` at `443c574` before the
session — full session allowed. Guardian Nov 4 08:07 PT Watch
rotation: all-pass, SMOKE PASSED, mobile-check T1–T13 pass, live
integrity byte-identical to HEAD, no Medic assignments. Baseline
smoke (Lead, pre-drill): **PASSED, exit 0, 341 checks** (up from
335 — the Lockdown pass added pins N16–N21). Baseline v6-metrics
captured (below); the harness's `v6-metrics.json` writer
side-effect was restored on every run, as in prior sessions.

**Target (from Sunday's Nov 1 focus list, repeated as Tuesday's
next-session line):** U6-12 facade drift, HQ west face slice
only — windows → x −24.69, parapet → −24.65, band → −24.66,
corner boards → −24.5. Coordinate-only in existing merged
meshes, +0 calls / +0 tris / no casters, green-or-revert. Ops'
four drifted faces are explicitly NOT this slice.

**Reviewer findings (tree-verified by Lead where load-bearing):**
- Since Tuesday's session: V7.6–V7.9 shipped and the Lockdown
  pass landed (`479b3e4`) — the Oct 30 backend-defence list
  (connection/room caps, non-input rate cap, violation logging,
  re-hello refusal, signal cap reconciliation, Origin check,
  status JSON room-code removal) is CLOSED by build-session
  work, not training. Still open, not regressions: Stage 2
  signed sessions (designed only, Brett's 3 decisions pending)
  and the host Mac firewall checklist (Brett's half).
- Ground truth for the fix: HQ west wall centre x −24.5,
  thickness 0.3 → outer face −24.65, inner face −24.35
  (`js/world.js:691,700`; mirrored `worlddata.js:163,167`).
  The drifted windows at −22.19 floated 2.16 m INSIDE the room
  from the inner face. Every target is exactly old value − 2.50
  (the U6-12 growth delta), cross-checked against the aligned
  faces (south windows = outer 46.65 + 0.04 = 46.69; parapet
  centres sit on outer faces; bands sit 0.01 proud; corner
  boards sit on wall centrelines).
- Under-tested, unchanged: facade geometry has NO gate pin —
  exactly why this drift survived since Oct 28; Friday Nov 6's
  TEST CRAFT anchor pin is the remedy. ASSAULT U1–U3, VM2 §9
  items 2–4, TTK re-baseline, and V7/V7.5–V7.9 playtest
  verdicts all remain open.
- Residual found, NOT in this slice (recorded, not improvised):
  the HQ north/south parapets (centre −12, length 20.6, spanning
  −22.3..−1.7) and floor-line bands (length 20.2) are also short
  at their west ends against the widened walls (−24.5..−2) and
  roof (−24.8..−1.7). Shifting them would break their correct
  east ends; lengthening is a separate scoping decision for a
  build session or a future drill.

**Drill run (`js/world.js` facade block only, closed list):**
- Via `FACADE_ANCHORS` (one line, two values): `hqWestWinX` and
  `hqWestUpperWinX` −22.19 → **−24.69**. No call-site edits:
  `win()`'s W-branch frame/sill/pane/mullion all take `cx`, so
  all sub-parts move together. Table stays frozen, no new keys.
- Hand-synced `t_()` literals (Lesson 31's predicted duty —
  trim is NOT table-sourced, and the log states so plainly):
  west parapet −22.15 → **−24.65**; west floor-line band
  −22.16 → **−24.66**; corner-board loop west pair −22 →
  **−24.5** (east pair −2 and all z untouched).
- `FACADE_ANCHORS` header rewritten to the landed state (the
  Oct 31 rule: a stale claim in the record is a defect): it now
  states the windows came from the table, the parapet/band/
  corners were hand-synced literals, and the table is the
  single source for west WINDOWS only — not the whole face.

**Proof (parsed, not eyeballed — Lesson 31):**
- Facade geometry multiset (bucket, x, y, z, w, h, d, colour,
  rotations — extracted by executing the facade bucket block
  against a stub THREE): **165 parts before and after; exactly
  12 parts differ, every one Δx = −2.50, Δy = Δz = Δsize =
  Δbucket = 0** — P ×8 (2 window frames + 2 sills via `win()`,
  1 parapet, 1 band, 2 corner boards), GC ×2 (ground west pane
  + mullion), GW ×2 (upper west pane + mullion). Every other
  part — all Ops, HQ N/S/E, Comms, interior panels — identical.
- v6-metrics before/after, every field identical (§3.4 offset
  named, Lesson 5: +0 calls / +0 tris / +0 casters, merged
  meshes unchanged in count): compound sustained 135 calls /
  98,436 tris, static 52 / 38,308, casters 30, shadow 190 /
  82,102; forest 149 / 291,110, static 66 / 230,982, casters
  38; snow 148 / 136,744, static 65 / 76,616, casters 40; mars
  150 / 121,266, static 67 / 61,138, casters 40. The harness's
  pre-existing warnings (lighting hash vs the stale V6
  baseline, sun-disc flat strike, soldier bar, version note)
  are unchanged and were not touched.

**Mid-session collision + stand-down + re-land (honest record):**
The first landing above was interrupted during the after-metrics
run: a second session put a V7.10 slice into the same tree
(touch rotate — `index.html`, `js/main.js`, `js/touchcontrols.js`,
`package.json`, `tools/mobile-check.mjs`, `tools/smoke.mjs`,
timestamps 17:01–17:02 UTC; the metrics gates line read smoke
FAIL (340) mid-race, that session's own smoke was in flight
minutes later, and no file overlapped `js/world.js`). Per the
one-pen rule the Lead stood down: saved the exact patch,
reverted `js/world.js`, and re-verified the facade multiset
byte-identical to HEAD. That session then committed its slice
(`0e8b92d studio(input): V7.10 touch rotate fix`) and the tree
went clean, so the Lead re-landed in-session: patch applied
byte-exact, multiset re-verified identical to the proven
after-state, metrics re-run green (gates smoke PASS 341) with
every map field identical to the morning baseline (the baseline
was captured on the V7.9 tree and the after-state on the V7.10
tree — V7.10 touched no scene geometry, so the comparison
holds). New Lesson 33.

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the
end-state tree (341 ✓ lines, same count as the morning
baseline), after the records below were written.

**Grade:** **PASS** (Coach grading pass on the final files —
all eight rubric criteria C1–C8 verified independently: the
working-tree `js/world.js` diff byte-identical to the saved
proven patch; exact values confirmed live; multiset proof and
metrics re-checked field-for-field; close-out smoke PASS at
the 341 baseline count; header rewrite honest about the
hand-sync. Coach's rulings: (b) the mid-session stand-down +
revert was CORRECT at the time — "a correct decision is not
retroactively wrong because the tree later freed up; the
sequence — prove, stand down, revert, re-land byte-exact,
re-verify — is Lesson 33 working as designed"; it also noted
V7.10's own report explicitly disclaimed the `world.js` edit,
confirming the two pens never entangled. (d) Friday Nov 6's
gate pin proceeds as planned, pinning the landed values
directly. One execution warning, acted on: a third session
(V7.11 gunshot re-voice) was in flight during grading, so this
commit is pathspec-scoped to `js/world.js` + `docs/training/`
only — by commit time V7.11 had itself landed (`1db281c`) and
the tree carried only the training files.)

**Commits:** one local commit, `training: fix practice — HQ
west facade re-anchored to post-U6-12 wall (12 parts, Δx −2.50)`.
Not pushed.

**New lessons:** 33 (a mid-session collision triggers the same
stand-down as a dirty start; a saved patch + parsed proof make
the re-land mechanical). Lesson 31's scope note updated to
record the west re-anchor as landed. Next session: Thu Nov 5 —
EFFICIENCY, Forest shadow-budget re-baseline per Sunday's focus
list. Friday Nov 6's anchor gate pin proceeds as planned — it
now has a landed west face to pin.

---

## Thu Nov 5, 2026 — EFFICIENCY

**Staff:** Training Lead (ran the session), REVIEWER (recent record,
read-only), COACH (drill design + rubric per the Nov 1 focus table;
grading pass on the final files recorded below).

**Pre-checks:** Tree clean on `main` at `9d643d1` (V7.28, docs on
`ba51e75`) before the session — full session allowed. (The
Reviewer's first `git status` caught a transient
`js/audio.js.<pid>.check.mjs` — the Lead's own baseline-smoke temp
under Lesson 27's per-process naming, gone on re-check; not active
development.) Guardian Nov 5 08:07 PT Watch rotation: all-pass,
SMOKE PASSED, mobile-check incl. T17 pass, 0 TODO/FIXME, live
integrity MATCH to V7.28, no Medic assignments. Baseline smoke
(Lead, pre-drill): **PASSED, exit 0, 370 checks** (up from 341 —
V7.22–V7.28 added the zone-reachability gate and new pins).

**Target (from Sunday's Nov 1 focus list):** re-baseline the
Forest shadow budget (follow-through on the Lesson 7 correction):
static vs sustained + caster tris; optimise one caster
bottleneck only if a merged/instanced win is measured, otherwise
measurement-only is a pass. The focus list's "V7.5 tree" label is
itself stale — the tree measured is V7.28, and the re-baseline
covers all five maps (V7.25 added Meridian Orbital), client and
layout paths separately.

**Reviewer findings (tree-verified by Lead where load-bearing):**
- Nothing is red. The real breaks since Wed were found by Job 2,
  not the guardian — a gate-coverage class: V7.22's unreachable
  Domination C / Snow A centre (new permanent zone-reachability
  gate, red 14 pre-fix → 48/48 post) and V7.24's client/sim
  collider mirror drifts (permanent mirror check, 308 boxes).
  A prior phantom V7.22–V7.28 report was lost/never on disk;
  Job 2 rebuilt that train for real — those commits exist here.
- What moved Forest: V7.18 second ring (solo Forest inherits the
  compound skeleton; ring statics merged by material, Lesson 35)
  and V7.21 data expansion (`worlddata-forest.js` BOUNDS 62→84,
  TREE_SPOTS 110→150, BUSH_SPOTS 90→120). In both Forest paths
  the trees/bushes cast (`biomes.js` trunk/canopy/bush IMs;
  `mapbuilders.js` layout equivalents), so V7.21 raises caster
  TRIS at flat caster count and flat calls — Lesson 7's trap.
- Under-tested / open, unchanged: no post-V7.21 caster-tris
  figure existed in-tree before today (this drill is that
  instrument); playtest verdicts owed on V7.16–V7.28; Stage 2
  signed sessions (Brett's 3 decisions) and the host Mac
  firewall checklist remain open; ASSAULT U1–U3, VM2 §9 items
  2–4, TTK re-baseline, and Ops' drifted faces carried.
  Fri Nov 6's facade anchor gate pin stands as planned.

**Measurement (Lead, `tools/v6-metrics.mjs` on HEAD `9d643d1`,
treeClean true; one full run + two `--fast` runs, all fields
identical across the three — counts are deterministic, no timing
is claimed, so no Lesson 24 A/B is owed; the harness's
`v6-metrics.json` writer side-effect was restored after every
run):**

Client path (sustained / static / casters / caster tris /
shadow-pass est. / headroom vs 165 calls + 300k tris):

| Map | Sustained | Static | Casters | Shadow est. | Headroom |
|---|---|---|---|---|---|
| compound | 147 / 99,904 | 64 / 39,776 | 37 / 28,630 | 209 / 83,350 | 18 calls / 200,096 |
| forest | 161 / 292,578 | 78 / 232,450 | 45 / 201,120 | 231 / 255,840 | **4 calls / 7,422** |
| snow | 160 / 138,212 | 77 / 78,084 | 47 / 65,546 | 232 / 120,266 | 5 calls / 161,788 |
| mars | 162 / 122,734 | 79 / 62,606 | 47 / 41,152 | 234 / 95,872 | **3 calls** / 177,266 |
| orbital | 156 / 101,302 | 73 / 41,174 | 43 / 29,616 | 224 / 84,336 | 9 calls / 198,698 |

Layout path (distinct scenes, not client-wired for these maps):
forest sustained 108 / 268,096, static 25 / 207,968, 16 casters /
197,608 caster tris, shadow 149 / 252,328; snow 108 / 74,238,
static 25 / 14,110, 19 / 10,930, shadow 152 / 65,650; mars
101 / 73,736, static 18 / 13,608, 12 / 10,742, shadow 138 /
65,462. Compound and orbital have no layout path in the harness.

**Comparison (dated, stale-by-design):** Lesson 7's Nov 1
snapshot (HEAD `9e746f6`) claimed Forest 148 / 285,774, static
65 / 226,510, 38 casters, shadow 211 / 250,088, headroom 17
calls / 14,226 tris. Wed Nov 4's baseline was already 149 /
291,110, casters 38. Today's rise is explained expansion cost,
not a leak (Lesson 5): V7.18's ring + V7.21's +40 trees / +30
bushes, all instanced — Forest's static instanced share is
0.949, and no map crosses a veto. But the headroom Lesson 7
quoted no longer exists: Forest has 4 calls / 7,422 tris, Mars
has 3 calls, and every client map sits at 147–162 calls. Any
future §3 work that spends calls needs a reclaim first — that
reclaim is build-session scope, not a training scramble.
Lesson 7 is corrected in place with today's snapshot, split
client vs layout and tightest-by-instrument (Forest on tris,
Mars on calls).

**Caster bottleneck ranking (Forest client, parsed
`topInstanced`/`topMeshes`, `castShadow: true` only):**
- Displaced-sphere foliage casters combined: 1,294 instances ×
  140 tris = **181,160 tris, 90.1%** of Forest's 201,120 caster
  tris — canopy 812 × 140 = 113,680 (56.5%, 116 trees × 7 masses,
  `biomes.js` canopy IM), bushes 276 × 140 = 38,640, shared-base
  spheres 104 × 140 = 14,560 and 42 × 140 = 5,880, thicket
  60 × 140 = 8,400 (30 thickets × 2 masses).
- Trunks: 116 × 100 = 11,600 (5.8%). All other casters combined
  (merged world meshes) are the remaining ~4%.

**Decision — measurement-only (PASS per the focus list), Coach
§3 rule applied as written:** the dominant group passes
dominance (56.5% ≥ 10%) but fails the mechanism and projection
conditions. The canopy is already ONE InstancedMesh at 1 draw
call — there is no regrouping that saves a tri, and
`castShadow` is per-mesh, not per-instance, so no sub-mesh
toggle exists; splitting the mesh to shed shadow tris would
cost +1 sustained call per split, spending the binding
constraint (4 calls of headroom) to relieve a non-binding one
(shadow-pass 231 vs the 340 advisory). The supplement and
second-ring foliage meshes already ship `castShadow = false`
by explicit build-session decision (comments at the R2 blocks
in `biomes.js`); every remaining caster is core canopy / bush /
thicket / trunk, and switching any whole mesh off is a visible
canopy-shadow loss — a Verity/Brett realism call, not an
efficiency win. A foliage segment cut (10×8 → lower) would be
a geometry/quality change, not a merged/instanced win, and is
likewise out of scope. No game code was edited; no optimisation
is claimed. New Lesson 40 records the per-mesh rule.

**Warnings, unchanged and not chased:** the harness's LIGHTING
TOUCHED warning fires against the stale V6 baseline — expected
post-U7, not a regression; no lighting was touched. (Staff-note
correction, Lesson 17: the Coach's plan cited the Nov 1
lighting sha `38cded1a…`; the tree-verified current sha is
`e2f31ad6b7e9b4e3` — V7.25 added the Orbital profile to
`js/lighting.js`. Lesson 1's sha is therefore stale and is
flagged for Sun Nov 8 CONSOLIDATE, not edited in an EFFICIENCY
session.) Sun-disc flat strike, soldier bar (8 vs 7 calls), and
the version note are pre-existing harness warnings, identical
in kind to prior sessions.

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the
end-state tree (370 ✓ lines, same count as the baseline), after
the records below were written. Diff scope: `docs/training/`
only; `git status` shows no other file.

**Grade:** **PASS** (Coach grading pass on the actual files —
all 8 rubric criteria C1–C8 PASS, no deductions; Coach
independently re-ran smoke exit 0 / 370 checks SMOKE PASSED
and v6-metrics --fast with every client/layout row
field-identical, canopy arithmetic verified 812×140=113,680=
56.5% of 201,120, v6-metrics.json restored, diff =
docs/training/ only).

**Commits:** one local commit, `training: efficiency — Forest
shadow-budget re-baseline on V7.28 (measurement-only, Lesson 7
corrected)`. Not pushed.

**New lessons:** 40 (`castShadow` is per-mesh, not per-instance;
an instanced caster is already the win — splitting it trades
the binding call budget for the non-binding shadow budget).
Lesson 7 corrected in place (Nov 5 snapshot, client/layout
split, tightest-by-instrument). Flagged for Sun Nov 8: Lesson
1's lighting sha (`e2f31ad6b7e9b4e3` current). Next session:
Fri Nov 6 — TEST CRAFT, facade anchor gate pin per Sunday's
focus list (pin the landed HQ west face; negative test: shift
one anchor → sole failure).

---

## Fri Nov 6, 2026 — TEST CRAFT (review-and-lessons-only)

**Staff:** Training Lead (ran the session), REVIEWER (recent
record, read-only), COACH (drill design + rubric C1–C8; grading
pass on the final files recorded below).

**Pre-checks — DIRTY TREE, session reclassified before any
edit:** Tree dirty on `main` at `920d3be` (V7.30) before the
session: ` M js/online.js` (+61/−14 — the V7.31 puppet walk
cycle in flight) and `?? docs/sessions/realism-shots/`.
Per the standing rule and Lesson 33, a dirty start means a
**review-and-lessons-only session — no code edits**, even
though today's planned drill (the facade anchor gate pin)
edits `tools/smoke.mjs`, not `online.js`: the pin's negative
test mutates `js/world.js`, and a build session has edited
`tools/smoke.mjs` mid-flight before (V7.10, Nov 4 record).
Guardian Nov 6 08:07 PT Watch rotation was itself
detection-only for the same reason (tree dirty, HEAD moved
mid-run), all-pass on V7.28, SMOKE PASSED, 0 TODO/FIXME, no
Medic assignments — and it predates V7.29/V7.30, which are
guardian-unseen as of this session.

**Mid-session movement (Lesson 33 again, from the other
side):** while this session ran, the build session committed
its own work as `7479ed5` (V7.31 puppets walk — the in-flight
`online.js` diff landed byte-for-byte by its own pen: the
commit's `online.js` change is the same 61/14 the start check
saw, across `index.html` / `js/main.js` / `js/online.js` /
`tools/mobile-check.mjs`). End-of-session `git status`
therefore differs from the start check — solely because the
other pen landed, not because training touched anything; the
untracked `docs/sessions/realism-shots/` remains. A tree
freeing up mid-session does not retroactively lift a
stand-down (Coach ruling, Nov 4): the pin was NOT attempted.

**Reviewer findings (tree-verified by Lead where
load-bearing):**
- Nothing is red. Since Thu Nov 5 (`9745ff6`): V7.29 walk
  cycle (`9d54395`), V7.30 recoil + shooting FX + security
  logs (`920d3be`), six iterations of the realism-shots
  evidence harness, and V7.31 (above). The struggles were
  instrument friction (realism-shots: /tmp-wiped browser
  binary, countdown waits, rAF warm-up), not gate breaks.
- The planned pin does not exist yet: `grep FACADE
  tools/smoke.mjs` = 0 hits. `FACADE_ANCHORS` sits at
  `js/world.js:929` (header at :914–928 states "Fri Nov 6
  pins these anchors in smoke"), and the landed HQ west
  values are in the tree: `hqWestWinX` / `hqWestUpperWinX`
  both −24.69 (:947), `hqWestZ 42`, `hqWestUpperZ 40`.
- Under-tested, new since Nov 5: V7.29's solo gait
  (`js/bots.js` LEG_HIP_Y 0.90, walkPhase cadence 2.42) has
  no smoke pin; V7.30's recoil split/cant (`js/player.js`)
  is unpinned (smoke checks weapon-data `recoil >= 0` only);
  `tools/security-log-check.mjs` (V7.30) is thorough but
  standalone — its own header says "NOT part of the
  11-gate release battery — run manually."
- Carried opens, unchanged: playtest verdicts owed on
  V7.16→; Stage 2 signed sessions (Brett's 3 decisions);
  host firewall Mac half; ASSAULT U1–U3; VM2 §9 items 2–4;
  TTK re-baseline; Ops drifted faces (build-session scope).

**Drill run — the facade anchor gate pin, designed to
landing-ready spec (no code written today):**

*Mechanism (decided, with alternatives rejected):*
`FACADE_ANCHORS` is a block-scoped `const` inside
`buildWorld()`; `js/world.js` exports only `buildWorld` and
`collide`, and the module imports THREE — it cannot be
imported like T1 imports `wd.SOLIDS`.
- **A — Source-text pin in `tools/smoke.mjs` (CHOSEN).** The
  established smoke pattern (G1–G5, D9, L5–L7 source
  contracts); zero product-code change; training-sized.
- B — Export the table from `world.js`: widens the module
  surface — a build-session decision, not a training pin.
  Rejected.
- C — Stub-THREE geometry multiset inside smoke: proves
  geometry, not the table; heavy/fragile in the gate. That
  proof already exists in the Nov 2/4 records. Rejected.

*FA1 — table pin.* New block in `tools/smoke.mjs`
immediately after §1h (T1–T5 worlddata, lines 573–613), own
`try/catch` ending `fail('FA facade anchor checks threw: '
+ e.message)`. New prefix FA (smoke already carries two
different N15s; no third collision). Extract the slice from
`const FACADE_ANCHORS = Object.freeze({` to its closing
`});`; assert the freeze is present; per key, extract and
compare — scalars `===`, arrays `JSON.stringify`; assert
the extracted key set equals the expected key set (a
renamed/dropped key fails, it does not silently unpin);
collect ALL mismatches into ONE fail line, so FA1 is exactly
one ✓/✗ line. Pin against literals, never self-consistency
(Lesson 32). Expected literals — the complete table as
re-derived from the live file today (Lesson 37: the landing
session re-verifies them against the live file first):
heights `winY 1.7, hqUpperY 4.6, hqPanelY 4.825, commsY
1.5`; Ops `opsNorthZ 39.97, opsWestX -37.04, opsSouthZ
48.04, opsNorthX [-35,-32,-29], opsWestZ [42,46],
opsSouthX [-34.5,-28.4]`; HQ `hqSouthZ 46.69, hqNorthZ
37.31, hqSouthX [-19,-5.5], hqNorthX [-17,-11], hqWestWinX
-24.69, hqEastWinX -1.81, hqWestUpperWinX -24.69, hqWestZ
42, hqWestUpperZ 40, hqEastZ 42, hqPanelSouthZ 46.34,
hqPanelNorthZ 37.66`; Comms `commsNorthZ 53.47,
commsNorthX [22.6,25.4]`. Header comment states the origin
(U6-12 drift survived because no gate pinned a facade
coordinate), the Wed Nov 4 landing (−22.19 → −24.69 = west
outer face −24.65 − 0.04), and the Lessons 28/31 basis.

*FA2 — west trim literals.* FA1 covers only table-sourced
windows + the 4 interior panels; the rest of the landed
west face is hand-synced `t_()` literals (Lesson 31 scope
note), so a "west face pinned" claim without FA2 would be
dishonest. FA2 source-asserts exactly (all verified live
today): west parapet `trimA, -24.65, 6.39, 42`
(`js/world.js:1019`); west floor-line band `trimB, -24.66,
3.02, 42` (:1028); corner-board loop (:1022) containing
`[-24.5, 37.5]` and `[-24.5, 46.5]`. Separate ID so a trim
failure never masquerades as a table failure.

*Scope honesty (part of the design, not a footnote):* the
pin is a **drift alarm, not a correctness proof** (Lesson
36). Ops anchors are pinned at their known pre-growth
values (`opsNorthZ 39.97` vs the wall at z 39): when the
build session re-anchors Ops, FA1's expected values change
in the same commit — a named re-pin, the T1 precedent
(Lesson 41). The pin proves no geometry, rendering, or
reachability — only that the named source values did not
move unannounced.

*Negative-test protocol (for the landing session):*
1. Solo smoke on the landed pin → PASS, count = baseline +2
   (FA1, FA2).
2. Mutate ONE anchor, key-targeted (`-24.69` occurs twice;
   a global replace invalidates the test):
   `hqWestWinX: -24.69 → -24.19`, nothing else.
3. Solo smoke → exit 1, `SMOKE FAILED (1)`, sole ✗ is FA1
   naming `hqWestWinX`, got −24.19 / expected −24.69.
4. Restore `git checkout -- js/world.js`; verify
   `git diff -- js/world.js` is empty; re-run smoke → PASS
   at the new count.
5. FA2 attribution: shift the parapet literal
   `-24.65 → -24.15` → sole failure FA2 only; restore as 4.
6. Retain evidence as `.txt` (never `.mjs` — the syntax
   walk would count it) at
   `scratch/training-testcraft-2026-11-06/results.txt`.

**Gap triage — ordered queue for the next clean TEST CRAFT
session(s):**
1. **Facade pin FA1/FA2** (above) — promised since Oct 31;
   closes the U6-12 drift class. Lands first, mechanically.
2. **Security-log wiring** — `tools/security-log-check.mjs`
   already exists and is thorough (sanitiser 512-cap, hash
   chain, restart resume, tamper `brokenAt`, rotation,
   `_viol` flattening); the gap is wiring, not design: add
   it to smoke §1i's subprocess list alongside the B/T/W
   suites. A textbook Lesson 28 case — a verified fix whose
   check sits outside the battery is unguarded.
3. **Walk-cycle pins** — for the landed V7.29 solo gait and
   (now landed) V7.31 puppet gait, designed from the landed
   files, not today's in-flight shape: the cadence `2.42`
   rad/m is a duplicated literal (`js/bots.js:936` and
   `js/online.js:362`), plus `HIP_Y 0.62`, `legL/legR`, and
   `disposePuppet`'s free-each-geometry-once /
   shared-material-once contract.
4. VM2 §9 items 2–4 — still open, still behind the above.

**Baseline smoke (Lead, personally run):** `node
tools/smoke.mjs` → **SMOKE PASSED, exit 0, 373 ✓ lines** —
with the caveat stated plainly: it ran on the dirty, moving
tree and straddled V7.31's landing (started at `920d3be` +
uncommitted V7.31, ended at `7479ed5`), so it is evidence
the tree was green around the session, not a HEAD-pure
baseline. The 370 → 373 rise vs Thu Nov 5 came from the
V7.29/V7.30 train, not from training (no training code
exists today).

**At close, a third pen is in flight:** after V7.31 landed,
the tree went dirty again behind this session — `js/world.js`
(V7.32 horizon shoulder ring) and `tools/realism-shots.mjs`
(pointer-lock look fix) are modified by the build session,
untouched by training. The training commit below is
pathspec-scoped to `docs/training/` only for exactly this
reason.

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the
end-state tree (373 ✓ lines, same count as the baseline),
after the records below were written — green even with the
V7.32 pen's in-flight `js/world.js` in the tree. Training's
own diff scope is `docs/training/` only; the tree also
carries the build session's V7.32 modifications and the
pre-existing untracked `docs/sessions/realism-shots/`,
neither of them training's.

**Grade:** **PASS** (Coach grading pass on the actual
files — all 8 rubric criteria C1–C8 PASS, no deductions.
Coach independently re-ran smoke: exit 0, 373 checks,
SMOKE PASSED, count reproduced even across V7.32's landing;
verified all 24 FA1 literal-map keys against the live table
and the FA2 literals at `js/world.js:1019/1022/1028`
field-for-field; C2 judged on intent as briefed — training's
diff is `docs/training/` only and the log states the tree's
movement honestly. Coach noted V7.32 landed as `74f06ee`
during grading, leaving the end status as training's two
files + the pre-existing untracked realism-shots dir. One
procedural note, not a deduction: land the scoped commit
exactly as specified — done below.)

**Commits:** one local commit, pathspec-scoped to
`docs/training/` only, `training: test craft — facade
anchor gate pin designed (FA1/FA2, review-only, dirty
tree)`. Not pushed.

**New lessons:** 41 (pinning known-stale values is a drift
alarm, not an endorsement — label it with its named re-pin
obligation, or don't pin it). Lesson 31's scope note
updated: the Fri Nov 6 gate pin was designed today and
deferred by the dirty tree, landing next clean session.
The Lesson 1 lighting-sha correction stays queued for Sun
Nov 8 CONSOLIDATE, as flagged Nov 5. Next session: Sat
Nov 7 — REALISM (Verity-led review; land at most one small
in-budget improvement, tree permitting). The FA1/FA2 pin
lands at the next clean TEST CRAFT opportunity, or sooner
if a clean day's drill is displaced by Brett's order.

---

## Sat Nov 7, 2026 — REALISM

**Staff:** Training Lead (ran the session), REVIEWER (recent
record, read-only), COACH (drill design; grading pass on the
actual files by a fresh Coach instance, recorded below).

**Pre-checks:** Tree clean on `main` at `21f2f78` (V7.34)
before the session — full session allowed, unlike Fri
Nov 6's dirty-tree stand-down. Guardian Nov 7 08:07 PST
Watch rotation: all-pass, SMOKE PASSED, mobile incl. T18,
characters-check CH6 pass, security-log-check ALL PASS,
live integrity byte-identical to HEAD, 0 TODO/FIXME, no
Medic assignments. Baseline smoke (Lead, pre-drill):
**PASSED, exit 0, 373 ✓ lines**. Baseline v6-metrics
(Lead, full run, side-effect restored): compound 147 /
99,832, forest 161 / 292,506, snow 160 / 138,140, mars
162 / 122,662, orbital 156 / 101,230 (sustained calls /
tris); casters 37 / 45 / 47 / 47 / 43; shadow-pass est.
218 / 83,152, 240 / 255,642, 241 / 120,068, 243 / 95,674,
233 / 84,138. Forest is tightest on tris (7,494 headroom),
Mars tightest on calls (3 headroom) — any drill is +0
calls by construction or it does not land.

**Target (Nov 1 focus table, carried verbatim):** Verity
review of Ops interior dressing / the NE ops console wall
+ Ops partition door frames — at most one small unit, +0
calls via existing buckets, interior/aligned surfaces
only, nothing on Ops' drifted exterior facade.

**Reviewer findings (tree-verified by Lead where
load-bearing):**
- Nothing is red. Since Fri's session: V7.29 walk, V7.30
  recoil/FX/security logs, V7.31 puppets walk, V7.32
  horizon shoulder rings, V7.33 iPhone rotate, V7.34
  character rebuild slice 1 — all gated green (11/11 per
  the V7.34 report). The struggle was instrument friction
  (realism-shots cannot turn the pointer-lock camera
  headless; no captured frame holds a soldier at readable
  range), not gate breaks.
- V7.34 slice 1 awaits Brett's playtest as its acceptance
  test; **slice 2 (joints / helmet-visor / proportions)
  is GATED on that verdict and was not proposed today.**
  Brett's V7.33 verdict stands: characters "still very
  blocky and unrealistic — getting better."
- Under-tested, unchanged: FA1/FA2 facade pin still
  absent from smoke (TEST CRAFT, designed Nov 6); the
  security-log check still standalone, not in the gate
  battery; walk cadence `2.42` still a duplicated
  unpinned literal (`bots.js` / `online.js`); V7.30
  recoil unpinned. Playtest debt V7.16–V7.34, Stage 2
  decisions, and the Mac firewall half all stand.

**Verity desk review — the break (headless evidence only;
no visual claim is made, Brett's playtest is the court):**
the HQ's ground-floor NE ops room (partitions P1 x −14,
P2 z 41; cell x −13.85…−2.15, z 37.65…40.85) is named an
ops room but contained exactly one collider crate
(−4.3, 39.2) and no console of any kind — while the
smaller, open-sided Comms Shed ships a PM wall panel +
GC console screen (`js/world.js` Comms block) and the
Relay Tower ships a GC console screen. The headquarters
ops room was the only ops/comms space with no console:
it read as a crate closet beside its own shed. The Coach
chose this unit over the runner-up (Ops partition door
frames, the Oct 31 finding — 6 trim boxes, +72 tris, all
caster tris) on cost: the console pattern is +24 tris /
+12 caster tris in existing buckets. Door frames are
deferred, not rejected — they are the next REALISM
candidate. Ops' drifted exterior planes remain a build
session's job (the facade header says so in code); no
Ops exterior coordinate moved today.

**The one improvement that landed (`js/world.js` facade
block only, +19 lines, 0 deletions):** the Comms Shed
console pattern copied 1:1 onto the HQ NE north wall's
interior face (z 37.65 = wall centre 37.5 + 0.15
half-thickness):
- PM panel `BoxGeometry(0.9, 0.6, 0.06)`, colour
  `0x8f979e`, at (−8, 1.4, 37.67) — spans z 37.64…37.70
  (0.01 embed, 0.05 proud, identical to Comms at its
  face 53.80).
- GC screen `BoxGeometry(0.6, 0.34, 0.05)`, colour
  `0xffffff`, at (−8, 1.45, 37.71) — spans z
  37.685…37.735 (0.015 seated into the panel front
  37.70; centre +0.04 from the panel's, as Comms);
  y 1.28…1.62 nested inside the panel's 1.10…1.70.
- Clearances, re-derived from the live file (Lesson
  37): panel x span −8.45…−7.55 — interior window
  panel at x −11 (span −11.47…−10.53) 2.08 m clear,
  north door gap (x −6.4…−5) 1.15 m clear, NE crate
  (x span −5.4…−3.2) 2.15 m clear. Visual only, merged
  into the existing PM/GC meshes: no new mesh, material,
  collider, or `worlddata.js` entry; SOLIDS pin
  untouched.

**Metrics before/after (§3.4 offset named, Lesson 5):**
merging into the existing PM/GC buckets avoided +2
meshes / +2 draw calls. After-state (Lead, `--fast` run,
side-effect restored): compound **147 / 99,856**,
forest **161 / 292,530**, snow **160 / 138,164**, mars
**162 / 122,686**, orbital **156 / 101,254** — on every
map **Δ calls 0, Δ tris exactly +24** (2 boxes × 12),
caster count Δ0, shadow-pass Δ **+12 tris / 0 calls**
(the panel mesh casts; glass never casts). Forest
headroom after: 4 calls / 7,470 tris.

**Geometry proof (Lesson 36 — counts alone do not
pass):** a source-parse multiset of the facade block
(every GW/GC/GD/PM push + `t_()` + `win()` statement,
normalized) went 92 parts → 94: **exactly +1 PM push
and +1 GC push at the designed values, 0 removed, 0
moved, 0 resized.** Smoke stdout after is
**byte-identical** to the baseline (373 ✓, PASSED
both) — no check added, removed, or renumbered.
Reachability standalone after: **PASSED**.

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on
the end-state tree (373 ✓ lines).

**Grade:** **PASS** (Coach grading pass on the actual
files — all six criteria C1–C6 PASS, no deductions.
Coach independently re-ran smoke (exit 0, 373 ✓),
v6-metrics `--fast` (every map's after-state reproduced
exactly), and reachability-maps (PASSED); re-derived
the multiset diff (insertion-only, exactly +1 PM +1 GC),
the placement arithmetic, and all three clearances
from the live file; and confirmed the v6-metrics.json
side-effect was restored. Procedural note only: the
records landed mid-grading and the commit below closes
the session exactly as logged — the Nov 6 sequencing.)

**Commits:** one local commit, `training: realism — HQ
NE ops room console wall (Comms Shed PM+GC pattern)`.
Not pushed.

**New lessons:** 42 (a named room is judged against the
game's own smallest furnished comparator — copy its
pattern 1:1; its arithmetic is the placement proof).
Next session: Sun Nov 8 — CONSOLIDATE (no code changes):
prune at the 2-week line, correct Lesson 1's lighting
sha (current `e2f31ad6b7e9b4e3`, flagged Nov 5), and
carry the Ops partition door frames forward as the
standing REALISM candidate behind Brett's V7.34
playtest verdict.

---

## Sun Nov 8, 2026 — CONSOLIDATE

**Staff:** Training Lead (ran the session), REVIEWER (recent
record, read-only), COACH (drill design + grading pass on the
actual files, read-only).

**Pre-checks:** Tree clean on `main` at `330dec0` before the
session — a full session was allowed, and Sunday's rule
applies regardless: no code changes. Guardian Nov 8 08:07 PT
Watch rotation: all-pass, SMOKE PASSED, security sweep clean,
0 TODO/FIXME, no Medic assignments; the live/world.js diff
vs origin is explained (unpushed Nov 7 training commit
`5fa7fb4`), not tampering.

**Drill run:** Consolidation only. No game or tool code was
touched; the end diff is `docs/training/` only.

**Reviewer findings (tree-verified by Lead where
load-bearing):**
- Nothing broke and no code landed since Nov 7's training
  commit: only three `docs(session)` commits (`92087a2`,
  `5d3971b`, `330dec0`) — a verification / recalibration hold.
- The struggle is a hold, not a failure: Brett's V7.34
  verdict was "NOT enough improvement"; slice 2 as specced
  (RB2-1..RB2-3) is SUPERSEDED and does not proceed; a re-spec
  waits on Brett's specifics, which he said he'd give after
  his shift and which were still owed at the AM Nov 8 report.
  Training schedules no slice-2 code (see the gate note in
  next week's table).
- Under-tested, all four verified still true today: FA1/FA2
  facade pin absent from smoke (0 hits; the table sits at
  `js/world.js:929`); `tools/security-log-check.mjs` thorough
  but still standalone — not in smoke's subprocess list nor
  the 11-gate battery; walk cadence `2.42` still duplicated
  and unpinned (`js/bots.js:934`, `js/online.js:362`); V7.30
  recoil split/cant in `js/player.js` still unpinned (smoke
  checks weapon-data `recoil >= 0` only).
- Carried opens, unchanged: playtest verdicts V7.16–V7.34,
  V7.32 walk visual confirmation, V7.33 iPhone retest,
  lost-content decision, Stage 2's three decisions, host
  firewall Mac half, ASSAULT U1–U3, VM2 §9 items 2–4, TTK
  re-baseline, Ops drifted exterior faces.

**Prune audit — Oct 25 cohort (Lessons 1–14) at the 2-week
line, per the playbook's own rules** (stale snapshots expire
in 2 weeks; lessons citing a commit/report survive;
contradicted lessons are corrected in place, not deleted;
duplicates merged):
- **Correct in place:** Lesson 1 (below), Lesson 12 (below).
- **Keep — durable pattern + citation, not snapshot-
  dependent:** Lessons 2, 3, 4, 5, 9, 10, 13, 14.
- **Keep — snapshot refreshed inside the window:** Lesson 6
  (reinforced Oct 31), Lesson 7 (corrected Nov 5; snapshot
  note added today, below).
- **Keep as explicitly historical:** Lesson 8 — its V6-3
  TTK numbers stay labelled historical-only; re-baseline is
  OPEN and nothing refreshes it without a post-V7 VM2
  re-run + Havoc ruling (none in the record).
- **Already merged:** Lesson 11 is a one-line pointer to
  Lesson 27 — kept as the pointer, no duplicate to prune.
- **Result: zero deletions.** No Oct 25 lesson is a pure
  uncited snapshot, and the grade does not require a
  deletion count.
- **Forward warning:** Lessons 15–17 (Oct 26) hit the line
  Nov 9 and Lessons 18–20 (Oct 27) on Nov 10 — flagged for
  the Sun Nov 15 CONSOLIDATE, not pruned early today. The
  Retired section stays intact (it is the anti-relearning
  record).

**Corrections landed in `LESSONS.md` (in place, dated):**
1. **Lesson 1 lighting sha** — flagged Nov 5, queued Nov 6
   and Nov 7, landed today: sha `38cded1a06271631` →
   `e2f31ad6b7e9b4e3` (full sha256 recorded; Lead- and
   Coach-verified against `sha256sum js/lighting.js`).
   Cause: V7.25 (`20d31b8`) added the Orbital profile.
   Sibling values re-verified against the live file, not
   blind-swapped: exposures are now FIVE profiles (compound
   1.10, forest 1.08, snow 1.08, mars 1.06, orbital 1.08),
   shadowExtent 86 on all, shadow map 4096, SHADOW_FLOOR
   0.36. The durable rule is unchanged: lighting moves
   only on Brett's order. Coach's grading flag, fixed
   in-session: the normalBias pin `js/main.js:69` was off
   by four lines — corrected to `:73`.
2. **Lesson 7 snapshot note** — the Nov 7 REALISM
   measurement supersedes the Nov 5 Forest sustained
   figure: 161 calls / 292,530 tris after the console-wall
   landing (baseline 292,506 + 24; headroom 4 calls /
   7,470 tris). The Nov 5 static/caster figures are now
   labelled dated, not current.
3. **Lesson 12 wording** — "soldier rounding mostly
   inscribes the old silhouette" no longer describes
   V7.34: the rounded shells ENVELOP the hit cores, the
   head ellipsoid is enlarged PAST the core, and buried
   in-core overlays were removed — while the hit cores
   themselves stay byte-identical (D9), which is the law
   the lesson states. (`5e76b3e`)
4. **Lesson 31 scope note** — "lands next clean session"
   retracted: Nov 7 was a clean full session and the pin
   did not land (that day was REALISM). The FA1/FA2 pin is
   queued for the next clean TEST CRAFT session —
   scheduled Fri Nov 13 in the table below.

**No new lesson today** — the playbook requires landed
evidence, and a consolidation produces none. The Ops
partition door frames stay a candidate, not a lesson.

**Metrics (unchanged by this session — no code changes):**
smoke 373 ✓ lines, PASSED, before and after (Coach's
independent run reproduced the count exactly; the delta
from earlier weeks is build-session work, not training).

**Close-out verification (Lead, personally run):**
`node tools/smoke.mjs` → **SMOKE PASSED, exit 0** on the
end-state tree (373 ✓ lines).

**Grade:** **PASS** (Coach grading pass on the actual
files — C1–C7 all PASS: scope docs-only, Lesson 1 values
verified line-by-line against the live tree, lesson-number
set identical to HEAD with zero deletions/renumbers, L7 /
L12 / L31 corrections matched to their evidence, Lesson 8
byte-identical, smoke re-run green at 373 ✓. Sole flag was
the `js/main.js:69` → `:73` pin, corrected above before
commit.)

**Commits:** one local commit, `training: consolidate —
Lesson 1 lighting sha + orbital profile, L7/L12/L31
corrections, Oct 25 prune audit (Sun Nov 8)`. Not pushed.

### Next week's focus (Mon Nov 9 – Sun Nov 15, 2026)

| Day | Drill | Concrete target |
|---|---|---|
| Mon Nov 9 — CODE QUALITY | Walk-cadence drift audit: the `2.42` rad/m cadence is a duplicated literal (`js/bots.js`, `js/online.js`). Single-source it only if zero-behaviour proof holds (smoke/gait identical), else document why not and convert it to a pin spec for Friday's queue. No behaviour change. |
| Tue Nov 10 — BUILD TECHNIQUE | Scratch/rig-only prototype for ASSAULT U1: stair-waypoint / vertical-access driver (or a maintained ring-start case) proving compound/snow ring entry in trace. Judged by rig criteria; no merge in training. |
| Wed Nov 11 — FIX PRACTICE | ASSAULT U1–U3 on Tuesday's evidence: land U1 as a maintained VM2 case if proven, otherwise a precise unblock write-up for Havoc/Rig. U2 (defender presence-contest) is a design decision — no blind tuning. U3 draft: pin "bots alone never finish." Also advances VM2 §9 item 2. |
| Thu Nov 12 — EFFICIENCY | TTK re-baseline, measurement-only: post-V7 VM2 re-run segmented by map with `channelMax`-aware reporting (Lessons 21/29); historical numbers stay historical; output is the Havoc ruling pack. No weapon edits without a ruling — measurement-only is a PASS. |
| Fri Nov 13 — TEST CRAFT | **FA1/FA2 facade anchor pin lands first** (landing-ready spec + negative-test protocol from Fri Nov 6: key-targeted `hqWestWinX -24.69 → -24.19` = sole FA1 failure; parapet `-24.65 → -24.15` = sole FA2 failure; evidence as `.txt` in `scratch/training-testcraft-2026-11-06/`). Ranked queue behind it: (2) security-log wiring into the smoke battery, (3) walk-cadence 2.42 pin if Monday didn't single-source it, (4) V7.30 recoil pin, (5) VM2 §9 items 3–4. A stretch item lands only as a separate commit if FA lands clean, otherwise it is #1 for Fri Nov 20. |
| Sat Nov 14 — REALISM | Ops partition door frames — the standing candidate carried from Oct 31 / Nov 7: Verity-led, 6 trim boxes / +72 tris (all caster) / +0 calls via existing buckets, interior partition gaps only, nothing on Ops' drifted exterior facade. Subordinate to Brett's V7.34 gate (below). |
| Sun Nov 15 — CONSOLIDATE | No code. Prune the Oct 26–27 cohort (Lessons 15–20) now at the line, grade the week's pins, update Lesson 8 only if a Havoc ruling is in the record, re-verify Lesson 1's sha, carry the unlanded TEST CRAFT queue forward ranked. |

**Gate — not scheduled code:** Brett's V7.34 playtest
specifics / slice 2 re-spec. Slice 2 as previously specced
is superseded; Brett said he'd describe what still looks
blocky after his shift. Training schedules no code for it
all week, and if his specifics land and an owner build
slice starts, Saturday's door-frame drill stands down on a
dirty/in-flight tree (Lesson 33) — the gate outranks the
candidate.
