# V4 Mode Design Pack (Havoc, Gameplay Director)

Status: **DESIGN OF RECORD for the Coordinator's mode
implementation.** Rules and numbers here are ruled; where a
number came from measurement it cites the baseline
(`v4-balance-baseline.md`); where it is judgment, it says so.
XP values live in `v4-progression-curve.md`; attachment stats
live in `js/loadouts.js` as ratified in §5 of this pack.

Solo honesty rule (Board 004): TDM and Domination solo are
*operators vs a Kestrel squad* — full mode rules against bots,
never dressed up as PvP. Online, the same rules carry humans.

Shared rules, all modes: bots are 100 HP; player damage to
players (online friendly/foe) uses the barrel rule (×0.45 of
bot-scale damage) wherever a system deals player damage;
respawns never place a player inside enemy LOS if a safe
spawn exists in the set.

---

## 1. WAVE DEFENSE (formalized from the shipped game)

- **Goal:** hold Outpost Meridian. **Victory: clear wave 10.**
  Then the run offers ENDLESS (waves 11+, mix per §6) or end.
- **Loop:** Relay briefs the wave → Kestrels converge from the
  ring spawns → fight, reposition, use barrels/pickups →
  wave clears (+25 HP, co-op partners redeploy, throwables
  refill) → next wave steps the count (4 + 2n, cap 9 alive)
  and the tier mix (§6).
- **Lose:** solo — you fall. Co-op — all operators down at
  once (existing redeploy rule covers the rest).
- **Target length:** victory run **14–18 min** (150 kills at a
  competent solo pace of ~4 s/kill including traversal, per
  baseline §1 TTKs); a typical run ends waves 4–6 at 6–9 min.
- **Briefing/HUD:** existing `briefingForWave` lines; HUD
  objective `SURVIVE — WAVE N`; endless: `ENDLESS — HOW LONG
  CAN MERIDIAN HOLD?`

## 2. TEAM DEATHMATCH

- **Goal:** first team to **30 kills**.
- **Loop:** spawn → hunt the mid lanes → trade kills → the
  score race tightens → at 29–29 the next kill wins
  (**sudden-death flavor is just the rule: first to 30 ends
  it instantly**).
- **Teams/fill:** 4 v 4. Humans fill first; bots fill empty
  seats. Enemy squad: Standard tier + **1 Veteran captain**
  per 4. Friendly fill: Standard. Online mixes humans freely;
  bots backfill disconnected seats after 10 s.
- **Scoring:** team score = kills. Personal scoreboard:
  kills / deaths / **assists** (≥ 40% of the victim's HP
  dealt within 5 s of the kill — also the XP rule).
- **Respawn:** 3 s, fixed team spawn set.
- **Target length:** **6–8 min** (8 combatants at baseline
  TTKs produce a kill every ~7–9 s; 30 kills needs ~50 total).
- **Briefing (Relay):** "RELAY — Kestrel squad's hunting in
  packs now. First to thirty. Drop them first."
- **HUD objective:** `FIRST TO 30 — US n · THEM m`.

## 3. DOMINATION

- **Goal:** first team to **200 points**. Zones **A** (north
  deck), **B** (rooftop), **C** (relay tower) each pay
  **1 pt / 2 s** to their holder.
- **Loop:** sprint a zone → stand the capture (4 s
  uncontested; progress pauses while contested) → defend or
  rotate → the map's three heights (deck / roof / tower)
  create the counter-sniping triangle the bigger map was
  built for.
- **Teams/fill:** 4 v 4 as TDM. Bot brains weight **60%
  objective** (move to / capture / defend a held or
  capturable zone), 40% roam-hunt. Bot tier: Standard/Veteran
  70/30 on the enemy side.
- **Respawn:** 3 s at fixed team spawns. (Owned-zone-adjacent
  spawns were considered and deferred — predictability is the
  fairness lever in V4; Brett taste question, §9.)
- **Target length:** **4–7 min** — a solid 2-zone hold ends
  it in ~3.5 min (a stomp *should* be short); a contested
  1.5-zone average runs ~5–6 min.
- **Briefing (Relay):** "RELAY — three points keep this
  compound breathing. Take them. Hold them."
- **HUD objective:** `FIRST TO 200` + A/B/C pips lit by
  holder, your team's score first.

## 4. RELAY ASSAULT (the Carrier-relay attack/defend)

Canon: the tower relay **is** the Carrier uplink (STORY.md).
The human team always attacks in V4 (defenders are the
Kestrel squad) — stated plainly, per the solo-honesty rule.

- **Goal:** get an operator into the relay ring on the tower
  and **hold the channel to 100% before the 6:00 timer dies.**
- **Channel:** base rate 2.2%/s (≈ 45 s held solo); each
  additional channeler in the ring adds ×0.5 rate, capped ×2.
  Channeling = standing in the ring; taking damage does not
  break the channel (position is the contest, not poise).
  **Progress decays at 2%/s** while nobody channels — push,
  fall back, keep most of it.
- **Defenders (bots):** 4 Standard at start; +1 defender per
  25% channel (max 8); past 50% the mix shifts Veteran-heavy.
  Defender respawns at the tower ring: 6 s, +2 s per 25%
  channel (the deeper the channel, the longer Kestrel's
  rebuild — the comeback lever runs *against* the defenders'
  numbers but *for* their respawn math… attackers also bleed
  time; this is the tension that makes minute 5 feel like
  minute 5).
- **Attacker respawn:** 4 s at staging, timer running.
- **Lose:** timer reaches 0 — or **full team wipe** (Board
  004): every attacker down at the same moment ends it.
  **Solo carve-out, ruled:** a lone operator redeploys on the
  4 s rule instead — with decay eating the channel, a solo
  death is already expensive; instant-loss solo would make
  the mode a no-mistakes exam. (Brett taste question, §9.)
- **Loop:** stage → breach the tower stairs (the closed
  stair-margin ruling covers the geometry) → plant in the
  ring → hold against escalating waves-in-miniature →
  100%: the sign-off Relay never sent, sent by you.
- **Target length:** **5–6 min** — the timer is the length;
  successful runs land 3.5–5.5 min.
- **Briefing (Relay):** "RELAY — that tower is the Carrier's
  throat. Get me to the relay. Keep me alive."
- **HUD objective:** `CHANNEL THE RELAY — nn%` + timer.

---

## 5. Attachments — shipped table RATIFIED (with one addition)

I audited `js/loadouts.js` `ATTACHMENTS` against the balance
guardrail. **Verdict: adopt as shipped, no stat changes.**
The table is structurally power-creep-safe:

- **No attachment modifies damage.** Per-hit power cannot
  creep; the only DPS levers are interval / mag / reload.
- Worst legal stacks vs the guardrail (best-band sustained
  DPS ≤ +10%, always paired with costs): SMG + short barrel
  (interval ×0.92 ≈ +8.7% rate, paid with hip spread ×1.15
  and falloff ×0.80) and AR + extended mag (sustained ≈ +7%
  over long fights, paid with reload ×1.15). Both inside the
  line, both taxed. Optics trade accuracy for zoom/movement,
  never DPS.
- The optic trio reads clean: red dot (L2, `spreadAds 0.85`,
  1.35× zoom, no cost — the designated onboarding gift), holo
  (L11, `0.80`, 1.6×, aim-move ×0.95), scope (L7, AR/DMR only,
  `0.70`, 2.4× FOV factor, aim-move ×0.90). Range bands, not
  ranks.
- **Addition ruled (from the progression pack):** suppressor
  gains `stealth: true` — no enemy-visible tracer online,
  minimal muzzle flash. Its stat trade (`falloffMin ×1.15`,
  `falloffEnd ×0.92`) stands.

Guardrail for any future attachment (Coordinator enforces):
(a) never touch `damage`; (b) any interval/mag/reload benefit
carries a cost in another column; (c) net best-band sustained
DPS ≤ +10%, verified by extending the balance probe to the
candidate stack before it ships.

## 6. Bot difficulty tiers

Tiers shape **offense and nerve only — HP stays 100 at every
tier** (difficulty you can feel in their aim, never in their
sponginess). A tier sets per-bot multipliers on the sim's
existing knobs: effective difficulty `d` (drives hit-chance
and `aimTimeNeeded = max(0.25, 0.55/d) · aimMult`), burst
cooldown, move speed, and flash-blind duration (§7).

| Tier | Name | d mult | Aim time | Burst CD | Speed | Flash blind |
| --- | --- | --- | --- | --- | --- | --- |
| RECRUIT | Cold Boot | ×0.65 | ×1.35 | ×1.30 | ×0.92 | 3.0 s |
| STANDARD | Guard | ×1.00 | ×1.00 | ×1.00 | ×1.00 | 2.5 s |
| VETERAN | Directed | ×1.20 | ×0.85 | ×0.85 | ×1.05 | 2.2 s |
| ELITE | Full Lock | ×1.40 | ×0.70* | ×0.75 | ×1.10 | 1.8 s |

*The 0.25 s aim floor stands even for Elite. Elite weapon
mix prefers DMR/SMG. Effective `d` = ambient (wave scaling,
`min(1 + 0.06·wave, 1.7)` in Wave Defense; 1.0 baseline in
the round modes) × tier multiplier, clamped [0.5, 2.0].

**Wave Defense mix by band** (the ambient scalar still
ramps underneath):

| Waves | Recruit | Standard | Veteran | Elite |
| --- | --- | --- | --- | --- |
| 1–2 | 80% | 20% | — | — |
| 3–4 | 30% | 60% | 10% | — |
| 5–6 | 10% | 60% | 30% | — |
| 7–8 | — | 50% | 40% | 10% |
| 9–10 | — | 35% | 45% | 20% |
| 11+ endless | — | 25% | 45% | 30% |

Mode mixes: TDM/Domination/Assault as written in §§2–4.
**Player-facing difficulty (menu spec):** NORMAL = tables as
written · HARD = mix shifted one tier up, global d +0.1 ·
STORY = one tier down, d −0.15, aim ×1.2. Whether STORY
ships in V4 is Brett's call (§9); the data shape supports it
either way.

**Un-wedge behavior (spec — fixes the baseline §3 finding;
Coordinator implements in `bots.js` + sim, parity kept):**
a bot with move intent and no LOS whose net displacement over
a rolling 2.5 s window is < 0.4 m is *stuck*: (1) wall-slide
— strafe perpendicular toward the side that reduces
distance-to-target, alternating sides every 2.5 s; (2) after
two failed slides, lane reset — route to the nearest spawn
point (spawn lanes are verified open) and re-approach. No
teleports; the slide reads as a bot shouldering along a wall,
which is believable, and the reset uses the same lanes waves
arrive by.

## 7. Grenade & flash — final tuning

Shipped `THROWABLES` values are adopted; the rulings below
complete them (Coordinator implements the player-facing
rules; numbers are data, in `js/loadouts.js`):

**Frag** — fuse **1.6 s fixed, no cooking** (a fixed fuse is
what keeps it from becoming an airburst delete button); arc
as shipped (speed 16, lift 4.5, gravity 14); **110 centre
damage**, radius **5.5 m**, falloff on the barrel curve
`(1 − (d/r)·0.6)` → ≈ 74 at 3 m, 44 at the edge. Vs bots that
is a one-shot at ground zero and a finisher inside 3 m — it
out-punches a barrel (95 @ 6.5 m) in a tighter circle, which
is correct: it's a limited resource (1 per life, refilled on
redeploy and wave clear) and the barrel is free but fixed and
chainable by either side. **Players take ×0.45 of frag damage
(barrel rule), thrower included** — max self-damage 49.5: a
mistake you survive and learn from, not a respawn tax.

**Flash** — fuse **1.0 s**; radius **12 m**, LOS required.
Player blind duration = `blindMax 2.6 s × angle × distance`:
angle factor from the victim's view — ≤ 45°: 1.0 · 45–90°:
0.55 · 90–135°: 0.25 · > 135°: 0.08 (afterimage only);
distance factor 1.0 at ≤ 6 m decaying linearly to 0.45 at
12 m. Render: white overlay whose peak and decay track the
computed duration, plus a 1.2 s tinnitus duck on the audio
side (feel item for the Coordinator's audio pass — the flash
you *hear* sells the one you see). Bots: blind seconds by
tier (§6 table — Recruit 3.0 → Elite 1.8), burst cleared on
blind, `visibleTime` reset to 0 on expiry so they re-acquire
instead of resuming mid-burst. Your own flash follows the
same cone math for you — looking at it is looking at it
(Brett taste confirm, §9).

## 8. Hit feedback — timing targets

Punch without noise; every signal under a quarter-second
except the kill confirm, which earns its dwell.

| Signal | Timing | Status |
| --- | --- | --- |
| Hitmarker | same frame as the hit solo; online, rendered on the server hit event — target ≤ 120 ms at reference ping; visible 90 ms | shipped — keep |
| Headshot tick | marker variant (smaller, gold X) + higher tick, 120 ms | **ADD** — ties to the sim's head flag and the headshot XP callout |
| Kill confirm | red, larger, 220 ms, scale-pop 120 ms | shipped (Phase 2 fun set) — keep |
| Damage direction | arc segment at the screen edge on the shooter's bearing, 600 ms fade | **ADD** — baseline §2 says a passive player dies in 11–22 s without ever knowing from where; direction is the fairness lever |
| Streak callouts | 2/3/4/5 inside the existing 5 s window | shipped — keep; XP milestones extend to 8 (progression pack) |
| Hit-stop | **none on hits** — frozen frames fight the smoothness bar | ruled out |

## 9. Open questions for Brett (taste, not math)

1. **Difficulty select:** ship NORMAL-only in V4, or add the
   STORY/HARD ladder (§6) now?
2. **Relay Assault wipe rule:** full-team-wipe = loss stands
   for teams; solo gets the redeploy carve-out (§4). Accept,
   or should wipes never end it (timer only)?
3. **Flash self-blind:** your own flash blinds you by the
   same cone math (§7) — no friendly exemption. Confirm?
4. **Domination spawns:** fixed team spawns (ruled for V4)
   vs owned-zone-adjacent spawns — preference for V4.1?
5. **Progression pace:** the ladder is brisk by ruling (full
   power at L18 ≈ 6–7 solid runs; prestige cap ≈ 15
   sessions). Ship brisk, or stretch the curve (coefficient
   400 → 700) before launch?

— Havoc, Gameplay Director AI
