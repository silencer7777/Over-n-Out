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
