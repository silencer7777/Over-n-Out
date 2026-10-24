# V4 Progression Curve — Design Pack & Ladder Ruling (Havoc, Gameplay Director)

Status: **RULING — the Coordinator aligns `js/progression.js` to
this document.** It rules on the spec drift Odin flagged
(`docs/sessions/v4-metrics.md`): the module ships 15 unlock
entries vs Board 004 §4's 13, and `MAX_LEVEL` 30 leaves L19–30
empty. Both are resolved below — the module's shape stays; four
XP values change and prestige entries are added.

## 1. The curve — ADOPTED as shipped

`xpForLevel(n) = round(400 · (n−1)^1.6)` **cumulative** XP to
reach level n, exactly as `js/progression.js` implements it. I
measured the pace against the balance baseline's match profiles
(XP computed with the §2 values):

| Match profile (Wave Defense) | XP earned | Level reached |
| --- | --- | --- |
| Short run — down on wave 3 (~22 kills) | ≈ 2,600 | **4** |
| Solid run — down on wave 5–6 (~50 kills) | ≈ 6,100 | **6** |
| Full victory — wave 10 cleared (150 kills) | ≈ 17,600 | **11** |

Full cumulative table (increments grow gently — no wall):

| Lvl | Cum. XP | +XP | Lvl | Cum. XP | +XP | Lvl | Cum. XP | +XP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 400 | 400 | 12 | 18,548 | 2,624 | 22 | 52,193 | 3,920 |
| 3 | 1,213 | 813 | 13 | 21,318 | 2,770 | 23 | 56,226 | 4,033 |
| 4 | 2,320 | 1,107 | 14 | 24,231 | 2,913 | 24 | 60,370 | 4,144 |
| 5 | 3,676 | 1,356 | 15 | 27,281 | 3,050 | 25 | 64,625 | 4,255 |
| 6 | 5,253 | 1,577 | 16 | 30,465 | 3,184 | 26 | 68,986 | 4,361 |
| 7 | 7,032 | 1,779 | 17 | 33,779 | 3,314 | 27 | 73,454 | 4,468 |
| 8 | 8,999 | 1,967 | 18 | 37,220 | 3,441 | 28 | 78,026 | 4,572 |
| 9 | 11,143 | 2,144 | 19 | 40,785 | 3,565 | 29 | 82,701 | 4,675 |
| 10 | 13,454 | 2,311 | 20 | 44,470 | 3,685 | 30 | 87,478 | 4,777 |
| 11 | 15,924 | 2,470 | 21 | 48,273 | 3,803 | | | |

Why this pace is right for V4: the owner's brief is *generous
early, no grind*. A first short match already pays out three
unlocks (red dot, extended mag, class slot 2) — the new player
touches every progression system in session one. The power
ladder completes at L18 ≈ 37.2k XP ≈ 6–7 solid runs (or ~2
victories + change): brisk, earned, done. The single stretch
knob, if Brett's playtest says it feels too fast, is the `400`
coefficient (×1.75 → 700 keeps L2 inside match one and stretches
L18 to ≈ 65k). **Ruled: ship 400.**

## 2. XP sources — ruled values

`js/progression.js` `XP_VALUES` aligns to this table (changes
marked ◆; everything else is adopted as shipped):

| Source | XP | Notes |
| --- | --- | --- |
| kill | 100 | any weapon, frag, barrel chain — the event pays, not the tool |
| headshot | +25 | bonus on top of the kill |
| assist ◆ NEW | 40 | dealt ≥ 40% of the victim's HP within 5 s of the kill, not the killer |
| waveClear | 150 | Wave Defense, per wave (endless waves keep paying) |
| matchWin | 300 | any mode |
| matchLoss ◆ NEW | 100 | any mode — a played match is never a zero |
| capture ◆ 50 → **100** | 100 | Domination zone flip to your team — an objective flip is worth a kill; 50 taught players to farm kills instead of playing the point |
| channelTick | 5 / s | Relay Assault — accrues only to players inside the channel zone while the channel advances (≈ 45 s solo channel ≈ 225 XP) |
| streak3 | 30 | streak milestones ride the existing callouts |
| streak5 | 75 | |
| streak8 ◆ NEW | 150 | deep streaks get a beat past the callout cap |

Guardrails: XP never buys power mid-match (unlocks apply
between matches, at the menu — a level-up during a match changes
nothing until redeploy at the earliest, and class edits stay
menu-only). Online XP is server-computed from sim events
(Board 004 §4) — these values are the server's table too.

## 3. The unlock ladder — RULING on the drift

**HOLO SIGHT (L11) — ADOPTED.** The optic slot becomes a
range-band toolbox, not a power ladder: red dot (close/fast),
holo (mid/balanced), scope (long/slow). Unlock order is about
variety, not strength — holo arriving after the scope is fine
because neither dominates: scope owns 35 m+, holo owns 10–30 m
with a wider picture and no tracking penalty beyond ×0.95 aim
movement. Shipped stats stand (`spreadAds 0.80, adsZoom 1.6,
moveAds 0.95`).

**SUPPRESSOR (L17) — ADOPTED** as the final power unlock.
Shipped stat trade stands (`falloffMin ×1.15, falloffEnd ×0.92`
— reach shrinks, far damage holds). One addition is RULED: the
suppressor's identity is stealth, so the module gains a data
flag and the client/net honor it —

- `stealth: true` on the suppressor entry in `js/loadouts.js`;
- suppressed shots render **no tracer to enemies** online and a
  minimal muzzle flash (which also protects the shooter's own
  sight picture under the locked dusk lighting grade);
- future hook, NOT V4: if bot audio-alerting is ever built,
  suppressed shots alert at 40% radius. Bots today acquire by
  sight only — this pack does not pretend otherwise.

**Final ladder (15 power/convenience unlocks, L2–L18):**
L2 red dot · L3 extended mag · L4 class slot 2 · L5 laser ·
L6 foregrip · L7 scope 4× · L8 class slot 3 · L9 long barrel ·
L10 fast mag · L11 holo sight · L12 class slot 4 · L14 tactical
stock · L16 short barrel · L17 suppressor · L18 class slot 5.
Weapons, frag and flash are never gated (Board 004 §4 stands).

## 4. L19–30 — prestige track ADOPTED (no empty levels)

`MAX_LEVEL` 30 stands, and the tail is filled with **prestige
rewards only — zero power past L18, by rule.** The module adds
seven entries of a new kind, `'prestige'`, which
`unlocksBetween()` already surfaces in the post-match summary:

| Level | Kind | Reward |
| --- | --- | --- |
| 20 | title | WATCHKEEPER (profile + scoreboard) |
| 22 | tint | EMBER tracers (profile-level tracer tint override) |
| 24 | title | SIGNAL VETERAN |
| 26 | tint | FROST tracers |
| 27 | title | TOWER WARDEN |
| 29 | tint | VOID tracers |
| 30 | title | MERIDIAN MASTER — hard cap; profile shows MAX RANK |

Tracer tints are data-only (the weapons table already carries
`tracerColor`; the profile tint overrides it for the owner's
own shots). Titles are strings on the profile. Neither touches
a fight — that's the point: past L18 you play for standing,
not stats, so the grind question answers itself (there is
nothing to grind *for* but the badge). At the §1 pace, L30
(87,478 XP) lands after roughly 15 solid sessions — a real
tail, honestly finite.

## 5. Coordinator alignment spec (js/progression.js)

1. `XP_VALUES`: `capture: 100`; add `assist: 40`,
   `matchLoss: 100`, `streak8: 150`. No other value changes.
2. `UNLOCKS`: unchanged (15 entries as shipped — this pack
   ratifies them).
3. Add a `PRESTIGE` export shaped like `UNLOCKS`
   (`{ level, kind: 'prestige', id, label }`) with the §4 rows;
   `unlocksBetween()` returns power + prestige unlocks in level
   order; `isAttachmentUnlocked` / `unlockedClassSlots` ignore
   prestige (they already filter by kind — keep it that way).
4. `js/loadouts.js`: add `stealth: true` to the suppressor
   entry (§3). No stat changes.
5. Header comment in progression.js: replace "coordinator
   assumptions… flagged for retune by HAVOC" with a pointer to
   this document (numbers ruled, Havoc, Oct 24 2026).
6. Smoke: pin the ladder length (15 + 7 prestige) and the four
   changed/new XP values so the ruling can't drift silently.

## 6. Note for the 3× ledger

Board 004 §6 wrote the progression target as "18 levels / 13
unlocks" before the module existed. Under this ruling the
shipped truth is **30 levels / 15 unlocks + 7 prestige
rewards** — the Board should restate the 3×-powerful line to
match (same treatment Odin already filed for the sim-cost bar).
The capability grew; the paperwork should say so.

— Havoc, Gameplay Director AI. Numbers measured where the sim
allows (see `v4-balance-baseline.md`); the rest is design, and
it is labeled as such.
