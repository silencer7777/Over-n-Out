# V6 Update 12 — Spec: Brett's Post-U11 Playtest Directives

Board meeting, Wed Oct 28, 2026 (19:53 PT evening build session,
Coordinator chairing). Full relevant squads convened per Brett's
Oct 28 full-capacity order: Apex + Vault + Verity (executive),
Trigger + Longshot (gameplay/optics), Atlas (worlds & soldiers),
Forge + Prism (engine/graphics), Lockdown + Aegis (hardening),
Havoc (balance numbers), Laurel (meta/streaks), Analog (input),
Sentry + Tripwire (gates), Harbor (device matrix / release),
Underbrush (environment — no scope this update, standing by).

## Ground state at session start

- Tree clean at `90ca1bf`; landed V6 count = **11** (BUILD U11).
- Watch 19:07 PT rotation: all-pass — guardian battery green,
  live integrity byte-identical to HEAD (index 12,644 B,
  main.js 128,256 B, world.js 87,158 B), no security findings.
  Standing gap unchanged: Stage 2 signed sessions — hardening
  NOT certified complete.
- **Brett's newest specs outrank the ledger queue.** His
  post-U11 playtest directives (Oct 28, ~14:15, after seeing
  U11 live: "this is looking great!") are, in his order:
  (1) MINIMAP RULE CHANGE — enemies must NOT always show; an
  enemy dot appears only when that enemy fires (teammates
  unchanged); (2) SCORESTREAKS — start adding them, phased
  (care packages, UAV, lightning strike, attack dogs, similar;
  dogs later as the AI work allows); (3) CHARACTERS still too
  blocky — realism is queue head again, read as actual
  soldiers; (4) GUNS realism pass — current models "look like
  Legos put together", build shaped real-gun silhouettes;
  (5) START MENU — remove the grid outlines; (6) ADS
  reconfirmed — HOLD right mouse button stays exactly as is.
- Note on (2): UAV + care package + sentry + precision strike
  already shipped in V5. The genuinely new named item that can
  land whole this update is the **lightning strike**; attack
  dogs are AI work and are specced/phased, not faked.

## Scope (numbered, owner + acceptance)

- **U12-01 Minimap rule change** (Trigger + Lens; Havoc
  numbers). `js/minimap.js` gains the pure reveal rule:
  `ENEMY_REVEAL_SECONDS = 2.5` and
  `enemyDotVisible(team, shotAgeSec)` — friendly always true,
  hostile true only while shotAge ≤ 2.5 s. `js/bots.js`: each
  bot carries `shotAge` (starts Infinity, ages by dt, resets
  to 0 on every actual shot fired in the burst loop — firing,
  hit or miss, is what gives a shooter away). `js/main.js`
  `drawMinimap` draws hostile dots only when the rule passes;
  friendly dots and the player arrow are unchanged.
  Acceptance: mobile-check T9 pins the rule (friendly always,
  hostile hidden at Infinity / 2.6 s, shown at 0 / 2.5 s);
  bots.js sets `shotAge = 0` in the firing block; main.js
  consults `enemyDotVisible`. UAV world markers (3D pings)
  are a different, already-paid-for system and are untouched.
- **U12-02 Lightning Strike scorestreak** (Laurel + Havoc;
  Lockdown reviews the server path). New ladder entry in
  `js/streaks.js`: `lightning`, cost **1100** (between sentry
  1050 and precision 1300), warn **1.0 s** (vs precision's
  2.5 s — that speed is its identity), radius **5**, damage
  **150**, instant. Wiring, all of it real:
  - `js/loadouts.js`: STREAK_IDS gains 'lightning';
    combination count uses the true C(n,3) instead of the
    hardcoded C(5,3)=10.
  - Solo (`js/main.js`): launchStreak branch mirroring
    precision (aim-point raycast, strike marker, callout
    "LIGHTNING STRIKE INBOUND"); the scheduled blast is
    generalised to carry its streak id and blast spec.
  - Online: `net/protocol.js` STREAK_CALL_IDS gains
    'lightning' (server-validated like every streak call);
    `net/sim.js` callStreak schedules it through the same
    strikes list, and stepStrikes resolves the blast from the
    strike's own streak def (event kind `lightning_strike`).
  Acceptance: smoke ST1 extended (named pin update: ladder
  gains lightning 1100, ids still match loadouts); solo +
  sim paths both execute it; no other streak's numbers move.
  **Attack dogs: phased, not this update** — they need bot-AI
  work (a new AI actor class); Laurel + Ghost spec them for a
  later V6 update. Saying so plainly, per Brett's own phasing.
- **U12-03 Characters realism, pass 3** (Atlas + Verity).
  Hit cores stay byte-identical (smoke D9 pins the three core
  part lines — they do not move). The blocky read dies
  further by curvature, not by new boxes:
  - Segment uplifts on existing overlay parts: thigh/shin
    tapered cylinders 11→14, arms 9→13, gloves 7×5→10×8,
    helmet dome 14×10→18×12, face 14×10→18×12, helmet brim
    16→24, calf/hip spheres +2 width segs.
  - New overlay parts INSIDE existing envelopes (no
    silhouette or hit change): bicep masses on both upper
    arms, boot ankle collars, a tapered waist sash between
    pelvis and ribcage.
  Acceptance: D9 core lines untouched; per-bot calls held at
  8 (team marker incl.); per-bot tris measured by
  v6-metrics and reported; forest total stays ≤300k.
- **U12-04 Guns realism pass** (Ballistic + Silhouette;
  Verity sign-off). The Lego read is flat slabs + polygonal
  barrels. Fixes, all merged (+0 draw calls, both flavours —
  viewmodel per-material and bot single-mesh share buildParts):
  - `cylZ` default segments 12→16, `cylY` 10→14: barrels,
    suppressors, tubes and muzzle devices read round.
  - Chamfered receivers: thin 45°-rotated edge strips along
    the AR / SMG / DMR / pistol receiver top edges — the
    slab silhouette gains a machined bevel line.
  - Tapered muzzle devices: a tapered cylinder (new `cylZT`
    helper) on AR + DMR muzzle brakes.
  - AR gains an angled foregrip under the handguard (the
    held silhouette reads as a gripped rifle, not a plank).
  Acceptance: smoke G1–G5 structural pins hold; gun tri
  deltas measured/reported; muzzle vectors unchanged (they
  are gameplay truth — tracers start there).
- **U12-05 Start menu grid removal** (Lens). Brett: remove
  the grid outlines from the menu design. `css/style.css`
  `#menu::after` loses its two repeating-linear-gradient
  grid layers; the soft light sweep layer, the aurora
  (`#menu::before`), title sheen and glass cards stay —
  only the grid goes. Acceptance: the grid gradient strings
  are absent from the stylesheet (pinned in mobile-check
  T9); menu functions/ids untouched (CSS-only change).
- **U12-06 Build witness 12** (Harbor). BUILD_NO 11→12,
  ono-build meta 12, `?v=12` assets, menu stamp BUILD U12.
  mobile-check T7 named re-pin (witness-only), as every
  update.
- **U12-07 Hardening slice** (Lockdown + Aegis). This
  update's anti-glitch/security work: the minimap change is
  itself an information-leak fix (enemy positions no longer
  broadcast continuously — the map now leaks only a 2.5 s
  firing reveal, clamped as before); the new streak call is
  server-authoritative end-to-end (protocol enum, sim-priced
  meter spend via the shared streak state, target clamped to
  bounds in the sim, blast gated by the sky-exposure raycast).
  No new endpoints, no new message types. Stage 2 signed
  sessions remain open — hardening still NOT certified.

## Perf baseline (recorded at meeting, v6-metrics on U11 tree)

Client static calls 51/64/63/65 (compound/forest/snow/mars),
sustained ≈134/147/146/148 vs bar 165; shadow estimate
199/200 (binding — this update adds NO shadow casters: bots
and guns already cast, segment uplifts add no casters);
forest total ≈266k/300k at U9 accounting. U12 spend is
budgeted to bot/gun geometry only (tris, measured after),
draw calls Δ0 everywhere.

## Gates + push

All five gates green on tree, then on the git-archive
snapshot, then push under the Oct 28 auto-push law and
byte-verify live (index.html, js/main.js, js/world.js +
js/minimap.js, js/bots.js, js/gunmodels.js, js/streaks.js).
ADS is untouched by this update; the standing instruction
stands: **HOLD right mouse button** to aim down sight.
