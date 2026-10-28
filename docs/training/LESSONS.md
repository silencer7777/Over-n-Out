# Over n' Out — Team Lessons (durable playbook)

Created Sun Oct 25, 2026, in the first daily-training CONSOLIDATE session.
Each lesson is one or two lines: the pattern, why it works, where it applies,
with a source commit/report. No lesson without evidence.

## Prune rules (future Sundays are mechanical)

- **Superseded by owner lock:** any pre-V6 lighting-tuning lesson is deleted,
  replaced by Lesson 1.
- **Superseded by measurement:** any weapon-strength lesson based on pre-V6-3
  TTK is stale until Havoc accepts/rejects the new movement feel and VM2
  re-baselines.
- **Stale snapshots expire:** lessons cite a commit/report, or they expire in
  2 weeks. Do not copy numbers from mid-flight metrics files; V6 metrics were
  re-measured on a clean tree (`c7f13d0`) for exactly this reason.
- **Contradicted, not silently deleted:** correct in place with date + new
  evidence.
- **Duplicates / single incidents:** merge duplicates; a one-off flake with a
  landed fix stays only as its durable pattern, not as an incident diary.
  Incident detail belongs in `TRAINING-LOG.md`, not here.

## A. Owner law / scope

1. **Lighting is locked, not a tuning knob.** Brett's verdict is "perfect";
   prove it untouched by hash/exposure/shadow in every graphics landing
   (sha `a40a3f79c85670a6`, exposure 1.10, shadow 4096). Vivid/weather work
   happens on surfaces only. (Ledger; V6-3 Atlas report, `2029d96`)
2. **Playtest feedback outranks the ledger table.** Ledger slots 6+ are
   deliberately under-specified; re-sequence each cycle from Brett. Applies
   to V6 Updates 3–20 planning. (`docs/sessions/v6-update-ledger.md`)
3. **One pen per working tree.** A second writer on the same surface stands
   down with zero writes and becomes independent verifier — it prevented
   `world.js` corruption in Update 1. Applies to all parallel builders.
   (Ledger coordination notes, Oct 24)

## B. Performance pays for realism

4. **Instancing/merging pays for detail.** 30 snow pines = 270 parts in 3
   InstancedMesh calls; the HQ facade rides 5 merged U1 meshes at +0 calls.
   Never add per-cue meshes. (Update 2, `0ed4e0d`; V6-3 HQ, `90e0c1f`)
5. **Name the §3.4 offset in the same landing.** Every net call/tri increase
   states what merging avoided and the headroom vs the 165-call / 300k-tri
   vetoes — unnamed cost reads as a leak. (Board 006 §3.4; VM4 finding)
6. **Identical delta across all maps = shared-base source.** +7,566 tris ×4
   proved the HQ, not per-map dressing. Read the delta pattern before
   hunting map code. (Rig first battery, `bde7c5d`)
7. **Caster tris are the shadow budget, not just caster counts.** Forest
   shadow tris can exceed static tris; Forest is the tightest map
   (127 calls / 213,868 tris post-V6-3). Applies to Updates 5/7/10.
   (V6 metrics; ledger)

## C. Measurement honesty

8. **A balance probe measures the whole system, not one table.** TTK moved
   (AR 0.53s→0.40s, SMG 2.43s→3.37s) with zero `js/weapons.js` change since
   V5 — V6-3 bot-movement smoothing moved the targets. Check `git log` on
   all contributors before re-tuning weapons. (VM2, `bde7c5d`; `4a71a54`)
9. **Report bot numbers honestly, never as headline counts.** The swarm is
   "~26 concurrent bots, 1,752 bot lives at P=4 on 2 cores", not "100 bots".
   Applies to all rig/swarm reporting. (Rig first battery)
10. **A gate rule that can't tell a feature from a leak will flag features.**
    VM4's ">2% cost, no audit-visible gain" rule flagged the owner-ordered
    HQ on all 4 maps while calls fell −1/map. Fix the instrument; don't
    paper over the verdict. (Rig first battery, VM4 section)
11. **Fixed ports are a collision hazard.** `tools/smoke.mjs` boots on fixed
    port 8199; overlapping battery/guardian/builder smokes collide. Rig
    runners wait for port-free and retry once until smoke takes a random
    port. (Rig report, Findings-4)
21. **Never pool a win rate across unlike objectives.** ASSAULT's pooled
    0.16 mixed two ground-ring maps with two elevated-ring maps the
    bot driver cannot climb to — the pooled number measured the
    instrument, not the mode. Segment by map/objective first; a
    structural zero is a finding, not a balance datum. (Training,
    Oct 28, 2026: compound channelMax 0 in 8/8 matrix matches
    (4 profiles × 2 seeds) + 8/8 trace seeds; pooled rate moved
    0.16→0.22 on forest/mars alone)
22. **A decaying progress metric must be reported as its peak.**
    End-state channel hid real progress behind the 2%/s decay
    (peaks of 84 / 60.2 / 49.5 all read as final 0–55.9). Any
    progress value that decays gets a `channelMax`-style
    max-over-time field, or partial progress reads as "never
    happened." (Training, Oct 28, 2026; field landed in
    `rig/vm2-balance/driver.mjs`, 32/32 field-identical rerun)
23. **Attribute the objective before crediting the profile.** In
    bot-vs-field instruments, record WHO satisfies the objective
    condition — a stationary turret "winning" assault and a mobile
    profile winning from 78 m away both proved friendly bots did
    the channeling. A win rate without attribution is a claim
    about the wrong agent. (Training, Oct 28, 2026; trace
    player-vs-bot ring seconds)

## D. Build discipline

12. **Hit cores are law.** Soldier rounding mostly inscribes the old
    silhouette; variation is colour/skin/wear only — no per-bot geometry or
    scale. Proof is required for any soldier/gun change. (V6-3 chars
    report, `c165ce4`; ledger Update 4)
13. **One data table, both sides.** Player and bots draw from
    `js/weapons.js`, so balance cannot drift and the server validates
    against the same table. Never hard-code weapon stats in shooting code.
    (ROADMAP v0.2; weapons system)
14. **Append-only / byte-identical shipped geometry where possible, and
    green-or-revert.** HQ/Ops interiors kept every shipped solid
    exact-float identical (SOLIDS 111→147, all on existing material
    buckets at +0 calls); anything that can't keep smoke / biome /
    reachability / soak / ws-soak green is reverted, not forced.
    (V6-3 Atlas report; studio standing rules)
15. **Self-contained copies in `biomes.js` are intentional, not
    duplication debt.** `tools/biome-check.mjs` copies that one file
    into `tools/` and rewrites only its `three` import, so a bare
    `import './proctex.js'` breaks the B-suite inside smoke.
    De-duplicate painter bodies + factories only in a regular change
    that first teaches the harness the second specifier — never by
    bare import in a training session. (Training audit, Oct 26, 2026)
16. **A seeded painter refactor is proven by its op trace, not by
    green gates.** Record the ordered canvas ops (recording-context
    harness, real THREE) before/after; identical trace = refactor,
    any delta = repaint. RNG call order/count is part of the recipe.
    Metrics shares derive from `material.map` presence and cannot
    detect a texture change. (Training, Oct 26, 2026: 4,026 ops,
    0 diff, both files)
17. **Verify a staff report against the tree before acting on it.**
    This session's Reviewer report asserted a dirty tree, missing
    smoke tooling and differing streak parameters — every load-bearing
    claim was contradicted by direct checks (clean `git status`,
    textual diff, op traces). A confident report is a lead, not
    evidence. (Training, Oct 26, 2026)
18. **Anchor a generalisation to the shipped system it replaces.**
    The precip prototype generalised the shipped snow-only system,
    so its snow profile kept the exact shipped fall band
    (2.2–3.4 m/s quantised) and every spec delta (box, count,
    camera centre) was declared in the header — a prototype that
    silently redesigns the live feel proves nothing about the
    merge. (Training, Oct 27, 2026; probe G1/G2)
19. **Probe assertions must match the real vendored API — and scan
    code, not comments.** `PointsMaterial.lights` is `undefined`
    in the vendored THREE (unlit by construction), so asserting
    `=== false` failed a correct prototype; a forbidden-token scan
    over raw source flagged header comments naming the banned
    tokens. Strip comments, check the real build, fix the probe —
    never bend the code to a wrong assertion. (Training,
    Oct 27, 2026: first probe run 6 failures, all probe-side)
20. **Wrap into a half-open interval, or a tolerance will hide the
    seam.** The precip recycle wraps offsets into the camera box,
    but a particle landing exactly at the ≥ boundary sits a hair
    outside the stated band — invisible while the probe allows
    1e-4 slack. Bounds proofs should use the same interval the
    code claims, with zero tolerance at the seam. (Coach grading
    deduction, Training, Oct 27, 2026)

## Retired / do not carry forward (corrected Oct 25, 2026, Reviewer audit)

These stale statements exist in older docs and must NOT be treated as
current truth. They are recorded here so future sessions don't relearn them;
the source docs themselves are flagged for a future docs fix, not edited
on a CONSOLIDATE day.

- "Lighting is off / needs a rework" (`GRAPHICS-TEAM.md` first assignment)
  — superseded by the locked grade in Lesson 1.
- "Multiplayer is design only, no networking built" (`ROADMAP.md` Stage 4,
  `MULTIPLAYER.md` header) — networking, modes, loadouts and progression
  shipped in V3–V5.
- "V3 is QUEUED, do not start" (`V3-PLAN.md` title) — V3 opened Oct 24;
  the same file's 83-seat header vs 53-seat mobilization total also
  contradicts itself (Team Lumen's 30 omitted in the second count).
- "Second map / mobile touch remain queued" (`ROADMAP.md` Stage 1 note)
  — there are 4 maps; mobile M1 was pushed Oct 24.
- "Mobile try-it is built locally, NOT pushed" (`v6-mobile-tryit.md`)
  — the ledger records M1 PUSHED Oct 24 (remote `722365ec`); the ledger
  is later and more specific.
- "`studio(<area>):` commit labels" (`TEAM.md`) — actual practice since
  V4 is `v4():` / `v6(worlds|chars|fx|menu|rig):` / `training:`.
- Ledger spine table alone understates V6-3: Update 4 (soldiers/guns) and
  Update 13 (ground FX/puddles) read queued/planned, but V6-3 already
  landed soldier re-forms/movement and the puddle/weather pass as a
  Directive wave outside the 20-update spine — read the V6-3 ledger
  section alongside the table.
