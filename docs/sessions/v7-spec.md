# V7 SPEC — Over n' Out v0.7.0 (Brett's call, Oct 30, 2026, 00:32 PDT)

Owner directive, verbatim: "Fix the aiming and bullet spread add the
specs and make the attachents actually measure gun details like
whatever you attachments you add it increases accuracy. Push all
updates tonight and upgrade to version 7. Make it powerful, realistic
guns, better gameplay, fix all levels and upgrade landscape. Use all
sources to expand and make game as powerful as possible. Make version
7 a huge jump and have it ready by 7 am"

Deadline: live + byte-verified by 07:00 PT, Fri Oct 30, 2026.
Coordinator owns the tree (one pen). The Watch's d2d27c1 (dogs in
STREAK_CALL_IDS) rides this push. The 06:00 scheduled build slot
stands down in favor of V7.

## Diagnosis (why aiming/spread felt broken — measured in code)

1. **Solo ADS gave NO accuracy benefit without an optic.** In
   js/main.js shoot(), the ADS factor was the attachment multiplier
   `spreadAds` alone, which is 1.0 with no optic fitted — aiming
   changed only the zoom, never the cone.
2. **Online ADS was catastrophically wrong.** net/sim.js shootSim()
   used `weapon.spreadAds` (a multiplier, ~0.62–1.0) as the ABSOLUTE
   base spread in radians. Aiming with your class primary online
   meant a ~1.0 rad cone — shots went everywhere except the target.
   (Base-table weapons without an effective row had no spreadAds
   field and silently fell back — masking the bug.)
3. **Solo/sim divergence:** sim applied the movement penalty even
   while aiming; solo zeroed it. Same gun, two physics.
4. **Spread shape:** uniform per-axis cube offsets — square pattern,
   corners overweighted, no center density. Real cones cluster.
5. **No measured specs anywhere:** attachments existed (V4) as
   multipliers, but the gunsmith showed only prose benefit/tradeoff.
   No damage/RPM/accuracy/range/control numbers, no before→after.

## V7-1 BALLISTICS CORE (shared spec model)

- js/weapons.js gains per-weapon spec fields (bot block untouched):
  - `adsMult` — base ADS spread multiplier (iron sights): AR 0.32,
    SMG 0.45, shotgun 0.70, DMR 0.12, pistol 0.38.
  - `velocity` — muzzle velocity m/s (display spec + tracer travel
    feel): AR 880, SMG 420, shotgun 390, DMR 960, pistol 375.
  - `recoilV` / `recoilH` — per-shot camera kick components
    (vertical climb, horizontal wander); the existing scalar
    `recoil` stays as the viewmodel kick strength.
- js/weapons.js exports `coneOffset(rng, spread)` — center-weighted
  cone offsets (average of two uniforms per axis → triangular,
  dense at center), used by BOTH runtimes so solo and online shoot
  the same physics.
- Unified spread formula in both runtimes:
  `spread = (base + bloom*0.028 + movePenalty) * (aiming ? adsTotal : 1) * stanceMult`
  where movePenalty applies only when NOT aiming, and adsTotal =
  weapon.adsMult × attachment spreadAds multipliers.
- effectiveWeapon() composes: `w.adsMult` (base) stays visible;
  final `w.spreadAds` = adsMult × attachment product (the value both
  runtimes consume). No-optic guns now gain real ADS tightening.
- Recoil pattern: solo kick gains the V/H pattern (climb +
  seeded wander, recovering); sim is hitscan-server-side and does
  not render recoil (unchanged contract).

## V7-2 GUNSMITH SPECS (measured, with deltas)

- js/loadouts.js exports `specSheet(weaponRow, attachmentIds)`:
  measured numbers — damage, RPM (from interval), DPS, hip spread
  (deg), ADS spread (deg), effective range (falloff end, m),
  velocity (m/s), mag, reload (s), recoil index — plus 0–100
  display ratings DAMAGE / FIRE RATE / ACCURACY / RANGE / CONTROL
  computed from the measured numbers (documented scales).
- Gunsmith UI (main.js class editor): a spec panel under the
  attachment pickers — bars + numbers for the current build;
  changing any attachment select re-renders with per-stat delta
  arrows/values (▲/▼ with the numeric change) vs the build before
  the change. Accuracy rating RISES when a spread-tightening
  attachment goes on — Brett's exact ask, visible.
- Attachments gain two missing measured mods so every slot moves
  numbers: muzzle slot is the barrel slot today; add `velocity`
  mods where honest (long barrel +4% velocity, suppressor −3%).

## V7-3 GUN MODELS

- attachmentParts gains the three attachments with no visual today:
  compensator (ported muzzle block), angled grip (angled polymer
  grip), CQB stock (compact stock pad). Merged parts — +0 draw
  calls. Bot forms keep silhouette parts as before.
- Barrel length reads: long/short barrel shift the muzzle anchor
  so tracers/flash originate at the real muzzle.

## V7-4 MAPS + LANDSCAPE

- Audit: reachability + reachability-maps + sightline audit on all
  four maps; fix any OOB/clipping/spawn findings the tools surface.
- Bushes (Brett's standing queue item; trees keep their direction):
  raise bush instance counts inside the EXISTING vegetation
  InstancedMeshes (+0 draw calls) on maps with tri headroom;
  per-instance color/scale variation widened slightly.
- Shadow budget: 199/200 — no new casters; bush instances ride the
  existing vegetation mesh flags (no flag changes).

## V7-5 VERSION + SHIP

- package.json 0.7.0; menu stamp BUILD V7; version pins updated in
  smoke/mobile checks (build witness V7).
- Ledger: V7 landing entry (closes the V6 line at 15 + the Watch
  fix; the 20-update V6 floor is superseded by Brett's explicit
  V7 call — recorded, not hidden).
- Gates: smoke, biome-check, reachability, reachability-maps,
  mobile-check — all green on the git-archive snapshot before push.
- Push via gh_push_contents.py; Pages build; byte-exact live
  verification; docs/sessions/v7-report.md with the before/after
  scorecard.

## NOT in scope tonight (recorded, not dropped)
- Stage 2 signed session verification (known open item).
- Dogs direct-gunfire hit volumes (only if the night runs long and
  it gates green cleanly; blast damage already shipped in U15).
- Movement-feel second slice beyond the spread/ADS consistency fix.

## Priority order if the deadline tightens
1. Ballistics core + spread fix (V7-1) 2. Gunsmith specs/deltas
(V7-2) 3. Version bump + green push (V7-5) 4. Map fixes (V7-4
audit) 5. Landscape + gun-model polish (V7-3/4 uplift).
