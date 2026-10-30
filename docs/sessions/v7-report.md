# V7 REPORT — Over n' Out v0.7.0 (landed Oct 30, 2026, ~00:50 PT)

Brett's call (Oct 30, 00:32 PDT): fix aiming and bullet spread,
add the specs, make attachments actually change measured stats,
realistic guns, better gameplay, fix all levels, upgrade the
landscape, push everything tonight, V7 live by 07:00.

**Result: V7 is LIVE and byte-verified ~6 hours early.**
Live: https://silencer7777.github.io/Over-n-Out/ — BUILD V7 ·
v0.7.0. Pages build 1326551169 "built" (commit 666a5786722c).

## What was actually wrong with aiming (found in code, fixed)

1. **Online aiming was broken at the root.** The authoritative
   sim read `weapon.spreadAds` — a multiplier like 0.85 — as an
   ABSOLUTE spread in radians. Aiming your class primary online
   scattered shots across ~1 radian. Solo masked it; online was
   unplayable-precise nowhere. Fixed: one unified formula in
   both runtimes.
2. **Solo aiming gave no accuracy without an optic.** The ADS
   factor was attachments-only (1.0 bare). Now every weapon has
   a base `adsMult` (iron-sight tightening): AR 0.32, SMG 0.45,
   shotgun 0.70, DMR 0.12, pistol 0.38 — attachments stack on
   top. Hold-right-click ADS itself is untouched, per standing
   directive.
3. **Solo/sim divergence:** the sim charged the movement
   penalty while aiming; solo didn't. Same gun, two physics —
   now one formula, verbatim, in `js/main.js` and `net/sim.js`.
4. **Square spread:** per-axis uniform offsets filled a cube.
   Replaced with a shared center-weighted cone
   (`coneOffset` in js/weapons.js): ~49% of shots land in the
   inner half-radius vs ~25% before — shots cluster on the
   point of aim like a real cone.

## Scorecard — scope

| Planned (v7-spec) | Delivered |
|---|---|
| V7-1 Ballistics core: spec model (damage/RPM/spread hip+ADS/recoil pattern/falloff/velocity), unified formula, cone | ✅ All of it. weapons.js gains adsMult/velocity/recoilV/recoilH per weapon; recoil is now a learnable pattern (vertical climb + bounded horizontal wander, attachments scale all of it) |
| V7-2 Gunsmith specs: measured numbers + bars + before→after deltas | ✅ Spec panel in the class editor: DAMAGE / FIRE RATE / ACCURACY / RANGE / CONTROL bars with numbers, a measured line (hip° / ADS° / full-dmg range / velocity / mag / reload / zoom / DPS), and ▲/▼ rating deltas on every attachment swap. Barrel attachments gained honest velocity mods (long +4%, suppressor −3%, short −6%) |
| V7-3 Gun models: attachments visible | ✅ The last 3 invisible attachments modeled (compensator, angled grip, CQB stock), merged parts, +0 draw calls. Deferred: barrel-length muzzle-anchor shift (cosmetic tracer origin) |
| V7-4 Maps: audit all levels + landscape/bushes | ✅ Audit: reachability, reachability-maps, sightline audit all clean — no OOB/clipping/spawn findings to fix. Landscape: Compound ring bushes II (+6 bushes, colliders mirrored in worlddata). Deferred: per-map bush uplifts on Forest/Snow/Mars (blind placement + collider-sync risk; now standing tasks of the new map crews, seats 50–57) |
| V7-5 Version + ship | ✅ v0.7.0, BUILD V7 witness, ledger + this report |
| Stretch: dogs gunfire hit-volumes; movement locomotion slice | ⏸ Deferred per spec priority order (dogs keep shipped blast damage; locomotion unchanged). Not regressions — recorded, owned by seats 87 / queue |

Files changed: 20 files, +740 / −138 lines total; game code
+263 / −28 (js/, net/, index.html, css/, package.json).
Commits: 2c37103 (ballistics) · 33d6fc5 (gunsmith) · f1d016e
(roster) · 683df11 (gun models + bushes) · 97f4d83 (version +
gate runner) · 80e02e3 (training) · 7ab83d7 (metrics) — on top
of the Watch's d2d27c1 (dogs protocol fix), which rode along.

## Scorecard — measured numbers

Ballistics (specSheet, computed from the shipped tables):
- AR stock: hip 0.17°, ADS 0.055°, 522 RPM, range 90 m,
  velocity 880 m/s, accuracy rating 96, control 64.
- AR + holo + foregrip + long barrel: ADS 0.040°,
  accuracy 97, range 113 m (rating 64→81), control 71,
  velocity 915 m/s, RPM 497 (the tradeoff shows too).
- Online ADS cone for a bare AR: ~1.0 rad (bug) → 0.00096 rad.
- spec-audit (new tool): every weapon × every single
  attachment — ADS < hip everywhere, zero display drift, all
  15 attachments move at least one measured number.

Perf (tools/v6-metrics.mjs on the V7 tree; U15 baseline in
parentheses where the tool is stable):
- Draw calls: 134 / 147 / 146 / 148 per map (unchanged, ≤165 ✅)
- Tris: Compound 93,052 (was 89,452; +3,600 = the 18 new bush
  masses, ≤300k ✅); Forest 284,046 (≤300k ✅, still the
  tightest map); Snow/Mars read 130,520 / 115,042 this run —
  the tool's sustained-tri sampling varies between runs on
  untouched maps, so no delta is claimed for them beyond
  "within budget."
- Shadow: no new caster nodes added anywhere (bushes ride the
  existing vegetation InstancedMesh; gun parts merge into
  existing material meshes).

Gates (on the git-archive snapshot, via the new
tools/gates-parallel.sh): smoke ✅ · biome-check ✅ ·
reachability ✅ · reachability-maps ✅ · mobile-check ✅ ·
spec-audit ✅. Push audit: re-running the push helper
reported 205/205 files skip-unchanged (remote == snapshot).
Live byte verification: index.html 13,741 B, js/main.js
143,087 B, js/world.js 87,440 B, js/weapons.js, js/loadouts.js
— sha256-identical live vs snapshot.

## Team (Brett's Oct 30, 00:35 order)

- **Roster FINAL: 88 seats + 10-bot Watch.** 50 new seats
  (39–88) in 13 task squads added to docs/TEAM.md — ballistics
  testers per weapon class, attachment balance auditors, a
  fix+landscape owner per map, gun detailers, device testers,
  perf accountants (calls/tris/shadow), anti-glitch patrol,
  gunsmith UI checkers, bot-AI tuners, sound/feel, accessibility,
  U13–U15 regression hunters, live-integrity verifier. Each:
  name, role, ONE standing task, named lead. Brett's words
  recorded at the top of TEAM.md: "that's it for the team."
- **Upgrade Cycle 1 (efficiency):** gate battery measured
  serial 12.6 s → adopted tools/gates-parallel.sh (two lanes,
  12.1 s, all green ×2). Real finding: naive parallelism
  false-fails via biome-check's shared temp file — laned
  around, logged as the lesson.
- **Upgrade Cycle 2 (capability):** built tools/spec-audit.mjs
  (seat 73's instrument) — the gunsmith's promises are now a
  0.1 s deterministic audit, first run fully clean. Both
  cycles logged in docs/training/TRAINING-LOG.md.
- The 06:00 scheduled build slot stands down (ledger-noted);
  the hourly Watch patrols a landed, clean tree.

## Brett's playtest asks (when you next play)
1. ADS feel: bare guns should now visibly tighten — does the
   AR at 0.32× feel right, or too tight/loose?
2. Gunsmith: swap a foregrip/holo on and off — the CONTROL /
   ACCURACY deltas are the new language; do the numbers read
   clearly at phone size?
3. Recoil pattern: climb + slight wander — pull-down should
   group shots again. Too much wander? Havoc tunes from you.
4. Dogs online: the Watch's protocol fix rode this push —
   attack dogs now work in online play too.
