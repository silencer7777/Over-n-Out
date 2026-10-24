# V5 Equipment, Scorestreaks & Perks — Numbers Ruling (Havoc)

Status: **RULING for Board 005 ratification.** Covers owner
Directive 10 (smoke grenades; claymores + trip mines + UAV),
Directive 11 (perks + scorestreaks), the owner's
customization guardrail, and the physicality clarification
(streaks are real objects in the world, priced as such).

Grounding: every hook below names a system that exists in
the code today — `js/loadouts.js` THROWABLES (frag: fuse
1.6 / r 5.5 / dmg 110; flash: fuse 1.0 / r 12 / blindMax
2.6 / botBlind 2.5), the bot perception model
(`visibleTime` accumulates under LOS, resets after
`losGrace`; aim completes at `aimTimeNeeded`), `losClear`
over the world colliders, the ×0.45 player-damage house
rule (barrel rule), and `XP_VALUES` as the score currency.
Candidates that hook nothing are killed in §6, in writing.

Slots: smoke joins **TACTICALS** (alternative to flash);
claymore + trip mine join **LETHALS** (alternatives to
frag). One lethal + one tactical per class, as shipped.

---

## 1. Smoke grenade (tactical)

| Parameter | Ruled |
| --- | --- |
| Carry | 1 per life; refill on redeploy / wave clear (as all throwables) |
| Throw | frag's arc (speed 16, lift 4.5, gravity 14) — one muscle memory for thrown tacticals |
| Activation | on landing (no airburst); **bloom 1.2 s** to full density |
| Cloud | radius **4.5 m**, height 3.5 m; full density **12 s**; dissipation tail 3 s (density ramps down) |
| Counters | frag/barrel AoE (vision-independent), walking in, waiting 15 s |

**The LOS rule (the core ruling).** Smoke enters
`losClear` semantics as a three-state chord test, computed
from segment length through the cloud (Coordinator/Vega
implement; this desk rules the thresholds):

- **BLOCKED** — chord through the full-density core
  (inner r 3.0 m) ≥ **1.5 m**, OR total chord through the
  cloud ≥ **5 m**. Bots: no LOS (perception freezes, then
  resets per `losGrace`, exactly as with a wall). Players:
  the render is opaque there — symmetric for both sides.
- **PARTIAL** — chord 2–5 m through the outer band only.
  Bots: `visibleTime` accumulates at **×0.4** (acquisition
  slowed, not stopped). Players: haze.
- **Inside the cloud:** a viewer inside smoke treats every
  sightline beyond **3 m** as blocked, under 3 m as clear.
  Smoke is never a one-way bunker: the channel-holder in
  the cloud cannot see defenders coming either.

**Interactions.** Smoke × flash are **independent**
(owner's default, confirmed): flash blind math is
unchanged by smoke. One geometric consequence, stated so
nobody files it as a bug: flash requires LOS (V4 ruling),
and smoke blocks LOS — a flash detonating behind a blocked
chord does not blind through the cloud. That is geometry,
not an interaction rule.

**Mode tactics (the interesting cases, ruled):**
- *Domination:* smoke grants **no capture presence** (no
  body, no capture) and does not pause a capture. It
  enables covered captures — defenders must enter or use
  frags. Capture math unchanged.
- *Relay Assault:* the channel is presence-based; smoke
  does not interrupt it. A smoked channeler is protected
  from ranged fire beyond the cloud and exposed inside
  3 m — the ring fight becomes a knife fight by design.

## 2. Claymore (lethal, placed)

| Parameter | Ruled |
| --- | --- |
| Carry / active | **1 per life, max 1 active**; refill on redeploy / wave clear |
| Deploy time | 0.7 s placement; **arm delay 0.8 s** (no reactive drop-kills mid-duel) |
| Trigger | cone **60°** total, range **7 m**, LOS from device required (corners don't leak), trigger delay **0.15 s** on cone entry |
| Damage | **130** centre (0–3 m in cone), linear falloff to **40** at 7 m; outer 15° of cone × 0.6 |
| vs players | ×0.45 house rule → 58.5 centre, ~18 edge: a full-HP player survives a centre blast, wounded and exposed; bots (100 HP, no factor) die centre, chip at edge |
| Signature | twin faint red trigger dots in-cone; dark low-profile body |
| HP | 20 — one hit from any weapon destroys it |

**Counters (ruled):** shoot it · frag/barrel blast
destroys it · Engineer reveals it (§5) · walk-around (cone
is directional — the flank is free). **Flash does NOT
clear it** — a flash counters eyes; the claymore's trigger
is a sensor, and inventing an EMP effect would quietly
delete the device's identity. Ruled no, with the reason on
the record.

## 3. Trip mine (lethal, placed)

| Parameter | Ruled |
| --- | --- |
| Carry / active | **1 per life, max 1 active**; refill as claymore |
| Deploy | on a surface; beam projects at **0.6 m** height to the first surface or **4 m** max |
| Trigger | crossing the beam; **delay 0.25 s**; detonation radial from the *device* |
| Damage | **100** at ≤ 1.5 m of device, falloff to **30** at 4 m; vs players ×0.45 → 45 centre |
| Signature | faint red beam (subtle; clearer when viewed along its axis / within 6 m) + amber tell blink every 2 s |
| HP | 20 — one hit destroys |

**Counters (ruled, honest to the movement set):** shoot
it · frag/barrel destroys it · Engineer makes the beam
fully visible at 15 m · **jump the beam** — jump apex is
≈ 1.88 m against a 0.6 m beam; if the crosser's feet are
above **0.75 m** at the crossing tick, no trigger ·
**sprint through** — 0.25 s delay at sprint speed puts
you ~1.75 m past the beam before detonation, and damage
falls off from the *device*, so a far-end trip is
survivable. **There is no crouch or prone in this game**
(verified: no crouch anywhere in client, sim, or HUD), so
no duck-under counter is ruled or implied. **Smoke does
NOT block the beam** — it is a break-beam, not vision;
smoke is not a trip-mine counter and will not be balanced
as one. Flash does not clear it (same reasoning as §2).

## 4. Scorestreaks — physical objects, priced as objects

**Meter (one system for all streaks):** score accrues from
`XP_VALUES` — kill 100 · capture 100 · assist 40 ·
channelTick 5/s · waveClear 150. **Streak XP bonuses
(streak3/5/8) do NOT feed the meter** (no compounding).
The meter is a **scorestreak**: death does NOT reset it.
Player selects **3** streaks in the loadout; the meter
fills toward the next selected threshold, spends on call,
one active instance per type, nothing callable while dead.

| # | Streak | Threshold | Duration / life |
| --- | --- | --- | --- |
| 1 | UAV (drone) | **500** | 24 s sweep |
| 2 | Counter-UAV | **650** | 20 s |
| 3 | Care Package | **800** | one drop |
| 4 | Sentry | **1,050** | 45 s battery or destroyed |
| 5 | Precision Strike | **1,300** | one strike |

**Pacing check (per mode, top-quartile player):** TDM —
~10–12 kills + assists ≈ 1,200–1,600/match → UAV mid-match,
one mid-tier streak, Precision rare. Domination — a rotator
(≈5 captures + 6 kills + assists ≈ 1,200) reaches the same
band *on objective play alone* — that is the owner's
question answered: **yes, objectives feed the streak at
full value.** Assault — channel-holding pays 5/s (≈225 for
a full solo channel) plus kills → UAV around the mid-push.
Wave Defense — waveClear feeds 150 × waves; streaks cycle
faster against bots, which is correct: they are PvE power
spikes, capped by the one-active rule and the spend model.
Healthy economy = 1–2 streaks per player per team-mode
match; if Pass-2 measurement shows a mode doubling that,
thresholds move, not durations.

### 4a. UAV — the drone itself

- **Airframe:** altitude **28 m** (above the 13.6 m tower
  mast — visible against the sky from everywhere, which is
  the point), circuit radius **30 m** around map centre,
  circuit speed **14 m/s** (full circuit ≈ 13.5 s). The
  drone exists in the world for the sweep's 24 s, then
  departs (climbs out, despawn). It does not collide.
- **Sweep:** ping every **3 s** (8 pings). Each ping marks
  every live enemy: world-space diamond + range, visible
  through geometry, lingering **1.2 s**. (There is no
  minimap in this game — markers are world-space, matching
  the existing bearing-arc HUD language.)
- **HP 150 — the third counter.** Priced in shots at real
  slant ranges (30–60 m from ground shooters): ≈ 6 AR body
  hits, 3 DMR body hits. One attentive player kills it in
  ~2–4 s of dedicated fire — inside its first circuit —
  at the cost of looking up and being exposed; an ignored
  drone delivers most of its 8 pings. **Shooting it down
  ends the sweep immediately and pays the shooter 75 XP**
  (denial bonus, deliberately under a kill's 100).
- **The counter triangle, balanced on purpose:** Ghost
  (§5) halves exposure but never erases it; Counter-UAV
  blanks the *markers* for 20 s but the drone still flies
  and can still be shot; shooting it down costs aim-time
  and position. A drone that died to one bullet would be
  worthless; an unkillable one would make Ghost mandatory.
  HP 150 is the middle, and it is a number Pass 2 can
  re-derive from measured time-to-kill-the-drone in play.

### 4b. Counter-UAV

Enemy pings produce **no markers for your team** for
**20 s**. Does not harm the drone, does not affect bots'
perception, does not stack with itself (re-call refreshes
to 20 s). Pure information denial, priced 150 over UAV
because blanking the enemy's 500-point investment should
cost more than the investment's first rung.

### 4c. Care Package — the falling box

- Called on the caller's position (+2 m). **Fall: from
  30 m at ~5 m/s descent ≈ 6 s of fall time**, drift
  ±2 m. Those 6 s are the price: the whole map sees it
  come down.
- The crate is **physical and stealable**: HP 60 (if
  destroyed, contents are lost); **anyone** claims it —
  1.5 s channel standing at the crate (the Assault
  channel code's little sibling).
- **Contents:** full resupply (health to full, ammo,
  throwable refill) **plus** one rolled streak from
  {UAV 50% · Counter-UAV 30% · Sentry 20%}, granted to
  the claimer regardless of whose package it was. Theft
  is a feature; guard your mail.

### 4d. Sentry — a gunner, not a DPS aura

- Placed (0.7 s deploy), **HP 100**, battery **45 s**.
- **Gun:** the AR table, STANDARD-tier perception —
  acquisition runs the bots' own model (`visibleTime` vs
  `aimTimeNeeded` 0.55 s, `losGrace` reset on occlusion),
  rotating scan 360° at 30°/s when idle, engagement cap
  **25 m**. Its DPS is therefore not a number I invent:
  it is the AR bot's measured output family (≈ 3.1 paper
  DPS vs a stationary target at 15 m from the V4 baseline,
  burst-shaped) — lethal to the careless, escapable by
  breaking LOS, exactly like a bot that cannot move.
- **Counters:** shoot it (100 HP) · flank its scan ·
  smoke (blocks its LOS via §1 — it sees with `losClear`,
  so the chord rule applies to it verbatim) ·
  Cold-Blooded slows its acquisition (§5). **Flash does
  NOT blind it** — it has no eyes to blind; ruled plainly
  so nobody balances against a fantasy.

### 4e. Precision Strike

- One called point. **Warning 2.5 s** (audible inbound +
  ground marker — a strike you cannot react to is a tax,
  not a tactic). **Damage 130 centre, radius 7 m**,
  barrel-curve falloff; vs players ×0.45 → 58.5 centre.
- **Cover negates:** damage requires sky exposure — a
  vertical `raycastWorld` from the target that hits a roof
  means no damage. Under the tower, indoors, under the
  deck: safe. In the open on a zone: dead. The geometry
  decides, per map — which is why this gets re-audited in
  every per-map pass.

## 5. Perks — catalog, slot structure, power budget

**Structure: tiered 3 slots, one perk per category,
per-class** (rides the existing class system). Power
budget argument: each perk is capped at ~10% *inside one
axis* — intake, movement, perception — and the axes are
orthogonal (nothing multiplies anything: movement ×
intake × perception never compound into TTK). Three
single-axis perks cannot stack into one system's cap the
way three same-axis picks could; category locks are the
stack-safety mechanism. Perks **never modify damage
dealt** — the attachment guardrail applies verbatim.

**MOVEMENT**
- **Lightweight** — sprint ×1.07, walk ×1.03. (Hook:
  player speed constants, client + sim parity.)
- **Stalker** — ADS move factor **+0.15 additive, capped
  at 1.0**, composing with optic `moveAds` (scope
  0.90 → 1.0; holo 0.95 → 1.0). Buys back aim-walking,
  cannot exceed full speed.

**DEFENSE**
- **Flak Jacket** — explosive damage taken ×0.55,
  applied after the ×0.45 house rule (net ≈ ×0.25 of
  bot-scale): claymore centre vs a Flak player =
  130 × 0.45 × 0.55 ≈ **32** (vs 58.5 unprotected); frag
  ≈ 27. Flak blunts placed/thrown explosives; it does
  not make anyone immune, and it does nothing vs
  bullets. The claymore stays lethal to bots and
  dangerous to everyone else.
- **Shade** — flash blind duration taken ×0.5. (Hook:
  the flash application on the player.) Bounded,
  single-system, no TTK contact.

**UTILITY**
- **Ghost** — UAV exposure halved: shown on **alternate
  pings only** (effective cadence 6 s vs 3 s) and marker
  linger **0.6 s** vs 1.2 s. The UAV still tracks Ghosts
  — staler, shorter — so the drone keeps its value and
  Ghost keeps its price (a whole perk slot). Ghost does
  nothing vs sentries or bot eyes; that is Cold-Blooded's
  lane, and the lanes stay separate.
- **Cold-Blooded** — bot + sentry `visibleTime`
  accumulation ×0.6 against you: aim-up takes ~67%
  longer. It buys approach time; once a bot is aimed, its
  DPS is untouched — approach, not duel power.
- **Engineer** — enemy equipment (claymore, trip mine,
  sentry) revealed within **15 m**; trip beams fully
  visible to the holder at any range; sentries marked
  while acquiring. (Hook: the equipment registry +
  render flags.)
- **Scavenger** — your kills drop a personal ammo pack
  (the existing pickup system): primary weapon, one
  magazine's worth, ammo only. **No throwable refill,
  ever** — placed caches remain the full-service resupply
  (health + ammo + the only throwable refill short of
  redeploy), so Scavenger trickles and caches matter.
  The anti-claymore-spam boundary is the same wall.

Placement on the progression ladder is Board 005's call;
recommendation only: sprinkle the 8 perks across the
L2–L18 rungs beside attachment unlocks — no curve numbers
change in this ruling.

## 6. Killed in writing — placebo candidates

Each of these was considered and **killed**, with the
reason on the record. They may only return if the named
system actually ships:

- **Dead Silence** — KILLED. Bots acquire **by sight
  only** (established in the V4 suppressor ruling);
  there is no hearing model for quieter footsteps to
  act on. A perk that modifies a number nothing reads
  is a placebo. Returns if a bot hearing model ships.
- **Toughness (flinch resistance)** — KILLED. Flinch in
  this codebase is a **bot-side** mechanic (`flinchT` on
  bots). Players have no aim-flinch to reduce.
- **Fast Regen** — KILLED. There is no in-run HP regen
  system; healing is pickups + wave-clear. Nothing to
  accelerate.
- **Bullet Penetration** — KILLED. Shots are blocked by
  `raycastWorld`; there is no material penetration
  model to improve.
- **Melee perks** — KILLED. There is no melee system.
- **Fall-damage perks** — KILLED. There is no fall
  damage.
- **Stamina perks** — KILLED. Sprint is unmetered; there
  is no stamina pool.
- **Personal UAV Jammer (permanent Ghost-plus)** —
  KILLED on balance, not plumbing: permanent ping
  immunity erases the UAV's 500-point value and makes
  the counter-ladder pointless. Counter-UAV already
  sells temporary denial at a fair price.

## 7. Customization — the guardrail, unchanged (owner)

Confirmed for the deeper customization pass, verbatim
from the V4 pack §5: attachments are sidegrades only —
(a) no attachment ever modifies `damage`; (b) every
interval / mag / reload benefit carries a stated cost in
another column; (c) worst legal stack ≤ **+10%** best-band
sustained DPS, **verified by extending the balance probe
to the candidate stack before it ships**. Any new
attachment proposed for V5 comes through this gate or it
does not ship.

**Camo / cosmetics: power-neutral by definition —
confirmed zero stat effect.** The enforcement is
structural, and I am stating it as a requirement, not a
hope: cosmetics live in profile data only and must never
enter the `effectiveWeapon` / mods pipeline. If a camo
ever needs a number to exist, that number is a bug.

## 8. Camping-risk summary (from the recheck, §7)

Placed lethals + Domination zones + the Relay channel
are the abuse cases; the compound audit is in
`v5-balance-recheck.md` §7 and re-runs per map. The three
structural answers, ruled here: **1-active cap** on all
placed lethals (no stockpiled minefields), **8 m
spawn-exclusion** on placement, and **arm/trigger
delays** (0.8 s / 0.15 s / 0.25 s) that keep placed
lethals from becoming reaction weapons. Camping with one
claymore is a position; camping with five would be a
fortress — the cap is the difference, and it does not
move without pacing math in front of this desk.

— Havoc, Gameplay Director AI
