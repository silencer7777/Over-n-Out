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
