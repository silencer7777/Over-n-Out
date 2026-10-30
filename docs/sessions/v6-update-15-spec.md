# V6 Update 15 — Spec: Attack Dogs (Scorestreak, New AI Actor Class)

Board: evening build session, Thu Oct 29, 2026 (Coordinator).
Ground: ledger count 14 (U14 landed + pushed + live-verified);
tree clean at `55c2a2a`; Watch 19:07 all-pass, live = HEAD U14.
Queue head since U12/U13/U14 landings: **attack dogs** — Brett's
Oct 28 scorestreak phasing ("dogs later as the AI work
allows"). This is that later update. Movement follow-ups stay
queued behind it. Scopes CONFIRMED by Brett — untouched.
**To use the scope: HOLD right mouse button** (touch: ADS).

Perf baseline (U14): sustained calls 134/147/146/148 (bar
165), forest 281,526/300k tris, shadow est. 199/200.

## Items (owner + acceptance)

- **U15-01 Streak def** (Ghost + Havoc numbers): `dogs` joins
  the ladder at **1200** (between lightning 1100 and precision
  1300), duration 40 s. `DOG_SPEC` in js/streaks.js: pack of
  **3**, hp **60**/dog, speed **5.4**, bite **20** dmg, bite
  range **1.7 m**, bite cooldown **0.9 s**, radius 0.35.
  Loadouts STREAK_IDS gains `dogs` (combination count is
  computed, not hardcoded). Acceptance: smoke ST1 named
  re-pin; pure ready/activate tests in mobile-check T12.
- **U15-02 Dog actor** (Atlas/Ghost): `createDogActor()` in
  js/equipment.js — procedural merged body (1 call) + wagging
  tail (1 call) = 2 calls/dog, transient only while a pack is
  active; tan working-dog coat, dark vest, collar. Run bob +
  body rock + lunge in `update(dt, move, lunge)`. No shadow
  caster change to static maps (actor is dynamic, like bots).
- **U15-03 Solo pack brain** (Ghost): main.js spawns 3 dogs
  at the caller, they seek the nearest living hostile bot,
  move with `collide()` + `groundHeightAt` (no clipping, no
  out-of-bounds — bounds clamp inside collide), bite on
  cooldown (`bot.damage` → `onBotKilled` credit path), heel
  to the player when no target lives, separate from each
  other. Dogs take strike-blast damage (precisionBlast loop)
  and despawn at duration end (expireStreaks hook) or death.
  Acceptance: T12 source pins + smoke green; behaviour is
  deterministic except spawn phase offsets.
- **U15-04 Sim pack (server-authoritative)** (Vega/Lockdown):
  net/sim.js `match.dogs` — spawn validated in callStreak
  (selection/gift/meter/one-pack-per-owner, exactly like
  sentries), stepDogs moves with the sim's own collide +
  ground height, bites bots (damageBot, kill event via
  'dogs', owner credited — streak feed follows the kill
  event) and enemy players (damagePlayerSim). Blast damage
  via blastEntities. Snapshot carries `snap.dogs` compact
  arrays while a pack lives. Acceptance: ws-soak + smoke
  green; T12 pins the sim paths.
- **U15-05 Witness + gates** (Sentry/Harbor): build witness
  14 → 15 (named re-pin, T7). All five gates green on tree +
  snapshot; push live + byte-verify under the Oct 28 law.

## Security / anti-glitch (standing priority)

- Dogs exist only through the validated streak path — the
  client asserts nothing; the sim prices, spawns, moves, and
  bites. One active pack per owner (gift + meter paths both
  guarded), so no pack duplication.
- Movement is collider- and bounds-clamped on both runtimes:
  dogs cannot clip walls or leave the ±80 arena.
- Bite damage is a fixed table value (DOG_SPEC), server-side
  online; kill credit flows through the existing kill-event
  feed (no new economy surface, no double-count path).
- **Named remainder:** dog hit volumes vs direct gunfire are
  NOT wired this update (dogs take blast damage; bots target
  soldiers, not dogs) — same posture as their targeting.
  Spec'd here, logged for a later V6 update. Stage 2 signed
  sessions remain open; hardening not certified complete.

## Out of scope

Movement follow-ups, new meta, client puppet rendering of
streak entities online (pre-existing posture — sentries ride
snapshots the same way), V7 (never without Brett's word).
