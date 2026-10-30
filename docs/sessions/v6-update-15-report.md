# V6 Update 15 — Report: Attack Dogs (Scorestreak, New AI Actor Class)

Built Thu Oct 29, 2026 (19:53 PT evening build session,
Coordinator; sole builder on the tree per the one-pen rule).
Commits: `54db3f0` spec · `16acfb7` code · this report.
**Pushed live + verified** under the Oct 28 auto-push law.
**The landed V6 count is now 15.**

Queue taken: attack dogs — Brett's Oct 28 scorestreak
phasing ("dogs later as the AI work allows"), queue head
since U12. Meta phases 1–2 (U13/U14) landed in between, as
queued. Scopes are untouched and confirmed working —
**HOLD right mouse button** to aim down sight (touch: ADS
button). Dogs are a class streak: pick ATTACK DOGS in your
class's streak slots, earn 1200 score, press X.

## What shipped

- **U15-01 Streak def** (Ghost/Havoc): `dogs` on the ladder
  at **1200** (lightning 1100 < dogs 1200 < precision 1300),
  40 s duration. `DOG_SPEC` in js/streaks.js — one shared
  source for both runtimes: pack of **3**, hp **60**, speed
  **5.4**, bite **20** dmg at **1.7 m** every **0.9 s**.
- **U15-02 Dog actor** (Atlas): `createDogActor()` in
  js/equipment.js — procedural merged body (tan coat, dark
  working vest, collar, pricked ears; legs in mid-stride)
  + a wagging tail = **2 draw calls per dog, transient**
  (only while a pack lives; zero static map cost). Run bob,
  body rock, and a bite lunge animate the pose.
- **U15-03 Solo pack brain** (Ghost): main.js spawns the
  pack at the caller; dogs seek the nearest living hostile
  bot, move with `collide()` + `groundHeightAt` (no wall
  clipping, no leaving the arena), bite through the normal
  `bot.damage` → `onBotKilled` path, heel to the player when
  nothing hostile lives, and keep separation so they don't
  stack. Strike blasts damage dogs; the pack despawns when
  the 40 s streak expires, on death, and on match reset.
- **U15-04 Sim pack** (Vega/Lockdown): net/sim.js runs the
  same brain server-authoritatively — spawn only through
  the validated callStreak path, sim collide/ground height,
  bites damage bots (kill event `via: 'dogs'`, owner
  credited; the streak feed follows the kill event) and
  enemy players. `snap.dogs` carries the pack while it
  lives; blast damage flows through blastEntities.
  **Verified live-fire in a headless sim run:** pack spawned
  (3 dogs, snapshot-carried), heeled, expired at 40 s; in a
  wave run the pack scored **6 dog kills in 40 s** against
  wave-1 bots — potent at this tier, as a 1200-cost streak
  should be; Havoc may tune bite damage if later waves feel
  trivialised (no numbers moved silently — these are the
  spec'd values).

## Security items shipped (standing hardening priority)

- **Server authority:** online, the client asserts nothing —
  the sim prices, spawns, moves, and bites from DOG_SPEC.
- **Anti-duplication:** one active pack per owner on every
  path (timed-streak active list + the sim's gift guard +
  the solo spawn clearing any prior pack first).
- **Anti-glitch:** dog movement is collider- and
  bounds-clamped on BOTH runtimes; dogs cannot clip walls,
  escape the ±80 arena, or stack inside each other.
- **Named remainder (not hidden):** dogs take blast damage
  but not direct gunfire yet, and bots don't target dogs —
  the hit-volume wiring is spec'd in the U15 spec for a
  later V6 update. Stage 2 signed session verification
  still open — hardening not certified complete.

## Before / after scorecard

| Measure | Before (U14) | After (U15) | Note |
|---|---|---|---|
| Scope vs plan | — | 5/5 items shipped whole | movement follow-ups remain queued, stated in spec |
| Sustained calls (compound/forest/snow/mars) | 134/147/146/148 | identical | Δ0 static — dogs are dynamic actors (2 calls/dog, pack-active only), bar 165 |
| Tris / shadow | forest 281,526/300k; shadow 199/200 | identical statics | no meshes added to any map; dog bodies are transient actors like bots |
| Gates (tree) | green | smoke ✓ (ST1 named re-pin) biome ✓ reachability ✓ maps ✓ mobile ✓ (incl. new T12 ×19) + ws-soak ✓ + soak ✓ | 2 named re-pins: ST1 ladder (dogs 1200), T7 witness 14→15 |
| Gates (snapshot) | — | all five green | re-run on the pushed git-archive snapshot |
| Live verification | — | byte-exact | index 13,716 B (BUILD U15), main.js 139,553 B, world.js 87,158 B, streaks.js 6,006 B, equipment.js 19,282 B — all = snapshot; `ATTACK DOGS` present in live streaks.js |
| Hit/balance integrity | — | one new table, disclosed | DOG_SPEC is new (no existing weapon/hit-core/XP numbers moved); sim play-test: 6 dog kills / 40 s vs wave 1 |
| Re-pins | — | 2 named (ST1, T7) | plus new T12 pins |

## Playtest asks for Brett

1. **Build stamp first:** menu footer should read
   **BUILD U15**.
2. **Set a class with ATTACK DOGS** in one of the 3 streak
   slots (loadout screen), earn 1200 score in a match, press
   **X** — 3 dogs should pour in, hunt on their own, and
   heel back to you when the wave thins out.
3. Dogs last **40 seconds** — watch the pack work a wave,
   and tell us if the bite feels too strong/weak; Havoc
   tunes from your verdict, one number at a time.

Queue after U15: movement-feel follow-ups (walking
locomotion + look smoothness, second slice), dog gunfire
hit-volumes, and Brett's verdicts on U13–U15.
