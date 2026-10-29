# V6 Update 12 — Report: Brett's Post-U11 Playtest Directives

Built Wed Oct 28, 2026 (19:53 PT evening build session,
Coordinator). Commits: `fda1286` spec · `c85498f` code · this
report. **Pushed live + verified** under the Oct 28 auto-push
law. **The landed V6 count is now 12.**

Brett's post-U11 directives (~14:15, after seeing U11 live)
outranked the ledger queue and set this update's whole scope:
minimap rule change, scorestreaks phased, characters realism,
gun realism, menu grid removal. ADS reconfirmed untouched —
**HOLD right mouse button** to aim down sight (touch: ADS
button), exactly as he likes it.

## What shipped

- **U12-01 Minimap rule change (his #1).** Enemies no longer
  always show on the minimap. A red enemy dot now appears
  **only when that enemy fires**, and stays for 2.5 seconds
  after the shot. Teammate (cyan) dots and your white arrow
  are unchanged. Implementation: the pure rule lives in
  `js/minimap.js` (`ENEMY_REVEAL_SECONDS = 2.5`,
  `enemyDotVisible(team, shotAgeSec)`), every bot carries a
  `shotAge` clock that resets to 0 on each actual shot fired
  (hit or miss — firing is what gives a shooter away), and
  `drawMinimap` consults the rule per dot. The UAV's 3D world
  ping markers are a separate, already-earned system and are
  untouched.
- **U12-02 Lightning Strike (his #2, phase 1).** UAV and care
  package already shipped in V5; the new named streak is in:
  **LIGHTNING STRIKE, 1100 points** (between Sentry 1050 and
  Precision 1300) — a strike on your aim point with only
  **1.0 s of warning** (precision gives 2.5 s), radius 5,
  damage 150. It is real everywhere: selectable in class
  loadouts (the combination counter now computes the true
  C(6,3) instead of the hardcoded C(5,3)), executable solo,
  and server-authoritative online — the protocol validates
  the call, the sim spends the meter from the shared streak
  state, clamps the target to the arena, and resolves the
  blast from the strike's own def behind the sky-exposure
  raycast. **Attack dogs are NOT in this update** — they need
  a new AI actor class (Ghost's squad); specced in the U12
  spec as a later V6 phase, exactly the phasing Brett set
  ("dogs later as the AI work allows"). No other streak's
  numbers moved.
- **U12-03 Characters realism, pass 3 (his #3).** The three
  hit-core part lines are byte-identical (smoke D9 proves it)
  and per-bot draw calls hold at 8. What changed is curvature:
  thigh/shin cylinders 11→14 segments, arms 9→13, ribcage
  12→16, neck 12→16, helmet dome and face 14×10→18×12,
  helmet brim 16→24, gloves 7×5→10×8, plus knee/hip/calf/
  ankle/backpack/jaw uplifts — and three new overlay masses
  inside the existing envelopes: bicep masses on both upper
  arms, boot collars over the ankle tapers, and a tapered
  waist sash between pelvis and ribcage (a waist, not stacked
  crates). Cost, stated plainly: **+1,646 tris per bot**
  (4,362 → 6,008; worst weapon pairing 6,376).
- **U12-04 Gun silhouette pass (his #4).** The Lego read was
  flat slabs + polygonal barrels. Barrels, suppressors, tubes
  and muzzle devices now build at 16 segments (was 12) so
  they read round; every receiver (AR/SMG/DMR/shotgun) and
  the pistol slide gain 45° chamfer strips along their top
  edges — a machined bevel line instead of a cast slab; the
  AR and DMR muzzle brakes are now **tapered** (narrowing to
  the muzzle, the old straight tubes removed); the AR gains
  an angled foregrip under the handguard. All parts join the
  same merged lists: **+0 draw calls** in both flavours (bot
  guns stay 1 call, viewmodel ≤6), muzzle vectors unchanged.
  Gun tris (bot flavour): AR 912 · SMG 636 · shotgun 588→740
  · DMR 1,280 · pistol 416.
- **U12-05 Menu grid removed (his #5).** The start menu's
  `#menu::after` grid — two repeating-linear-gradient layers —
  is gone, exactly as ordered. The aurora wash, the slow
  light sweep, title sheen and glass cards stay. CSS-only;
  no menu id, handler or layout moved.
- **U12-06 Build witness 12.** BUILD U12 stamp, ono-build
  meta 12, `?v=12` assets, `BUILD_NO = 12` (mobile-check T7
  named re-pin, witness-only).

## Security items shipped (standing hardening priority)

- The minimap change is an information-leak fix: continuous
  enemy positions were broadcast to every player's HUD; the
  map now leaks only a 2.5 s firing reveal (positions still
  clamped to the arena, as U10).
- Lightning Strike's online path trusts nothing: protocol
  enum validation, server-side meter spend, bounds-clamped
  target, sky-exposure-gated blast — the same authority
  pattern as precision, extended, no new endpoints or
  message types.
- Anti-glitch: new bot/gun geometry sits inside existing
  envelopes — no collider, shootable, spawn or worlddata
  change (SOLIDS unchanged); hit cores byte-identical.
- **Still open (named, not hidden):** Stage 2 signed session
  verification — Lockdown + Odin have **not** certified the
  hardening pass complete.

## Before / after scorecard

| Measure | Before (U11) | After (U12) | Note |
|---|---|---|---|
| Scope vs plan | — | 6/7 items shipped whole; U12-02 partial by design | attack dogs phased to a later V6 update (AI actor work), stated in spec + here |
| Sustained calls (compound/forest/snow/mars) | 134/147/146/148 | 134/147/146/148 | Δ0 — bar 165 |
| Client static tris | 31,268 / 222,262 / 68,736 / 53,258 | identical | world geometry untouched this update |
| Sustained tris (incl. bots) | forest ≈266k (U9 acct.) | forest 281,526 | bar 300k — headroom now 18,474; the bot spend is the cause, disclosed |
| Per-bot | 8 calls / 4,362 tris | 8 calls / 6,008 tris | calls held; +1,646 tris is the character pass |
| Shadow casters | — | Δ0 | no new meshes cast; segment uplifts add no casters |
| Gates (tree) | green | smoke ✓ (ST1 extended) biome ✓ reachability ✓ maps ✓ mobile ✓ (incl. new T9 ×11) + ws-soak ✓ soak ✓ | 2 named pin updates: T7 witness 11→12, ST1 ladder text |
| Gates (snapshot) | — | all five green | re-run on the pushed git-archive snapshot |
| Live verification | — | byte-exact | index 12,644 B (BUILD U12 stamp served), main.js 128,891 B, world.js 87,158 B, minimap.js 4,177 B, bots.js 54,284 B, gunmodels.js 31,520 B, streaks.js 5,425 B, style.css 38,541 B — all = snapshot; `enemyDotVisible` + LIGHTNING STRIKE confirmed in live bytes |
| Hit/balance integrity | — | hit cores byte-identical (D9 ✓); one balance addition, Havoc-ruled: lightning 1100/1.0 s/r5/150, all other streak numbers unmoved | fire-rate §D untouched |
| Re-pins | — | 2 named (T7 witness, ST1 ladder) | plus new T9 pins, no existing pin moved silently |

## Playtest asks for Brett

1. **Build stamp first:** menu footer should read
   **BUILD U12** — and the menu should have **no grid** on it
   now, just the aurora + sweep.
2. **Minimap:** sit quiet and watch — enemy red dots should
   only pop when an enemy is actually shooting, then fade
   ~2.5 s later. Teammates stay visible the whole time.
3. **Soldiers + guns at mid-range:** the curvature pass —
   do they read more like soldiers holding real rifles, or
   still too blocky? Your verdict sets the next pass's spend
   (forest tri headroom is now ~18k, so the next realism
   spend needs either restraint or a reclaim).
4. **Lightning Strike:** it's on the streak ladder at 1100 —
   pick it in a class, earn it, and call it on your aim
   point: 1 second of warning, tight, hard.
5. Scopes unchanged — **HOLD right mouse button** to aim
   down sight (touch: ADS button).

Queue after U12: attack dogs (AI actor, Ghost + Laurel),
meta systems (emblems + badges, Laurel), movement-feel
follow-ups, and Brett's verdicts on this pass.
