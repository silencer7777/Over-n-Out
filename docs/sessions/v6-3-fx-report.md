# V6-3 FX + AUDIO REPORT — per-gun gunshot signatures (Oct 25, 2026)

**Owner order (Directive V6-3):** "Enhance all FX including the bullet
sounds. Make the shots sound more like actual gun shots according to the
gun model."

**Scope discipline:** all landed work is in `js/audio.js` (commit
`1f312cf`). No other pen's surface was touched — world/biomes/
mapbuilders/bots/player untouched; `js/main.js` read-only this wave
(hooks it needs are spec'd in §4 for Vega). `js/weapons.js` untouched:
the per-class `sound` ids already keyed everything, so **zero balance
surface was exposed** — no damage/rate/spread number moved, and no new
fields were needed in the weapon table.

## 1. What was wrong with the old shots

The V5-era synth built each shot from a lowpassed noise burst + a
**triangle tone sliding 150→60 Hz** + a sine thump. The audible pitch
slide is precisely what makes a synthesized shot read as "pew" instead
of "gunshot": a real report has no tone at its centre — it is a
supersonic **crack transient**, a broadband **blast**, and a low
**body**, followed by the action cycling and the sound slapping back
off the environment. V6-3 rebuilds every shot as exactly those five
layers, voiced per gun from `SHOT_DESCRIPTORS`, with **per-shot
micro-variation** (±5–15% on frequencies, durations, gains) so
sustained automatic fire no longer sounds like a looped sample.

## 2. Per-weapon sound design

Layers: **snap** = highpassed noise transient (dur / cutoff / gain) ·
**blast** = noise through a lowpass sweeping from→to over dur ·
**body** = sine drop (freq→to) + bandpassed noise ·
**mech** = action tick(s) after the shot · **tail** = quiet lowpassed
slapback repeat(s).

| Gun (id) | Snap | Blast | Body | Mech | Tail | Character |
|---|---|---|---|---|---|---|
| **AR** (`crack`) | 18 ms · 1.7 kHz · 0.85 | 0.11 s · 6.8k→420 Hz | 115→48 Hz + 260 Hz noise | bolt tick @45 ms | 1 slap @110 ms (0.07) | The reference rifle crack: bright snap, midweight body, short outdoor slap |
| **SMG** (`rattle`) | 12 ms · 2.1 kHz · 0.62 | 0.065 s · 7.6k→650 Hz | 135→65 Hz, light | bolt tick @30 ms | faint @90 ms (0.05) | Fast, light, papery pops — the brightest blast and the least body, so a 36-round mag reads as a rattle, not a cannon |
| **Shotgun** (`boom`) | 20 ms · 1.2 kHz · 0.70 (buried) | 0.30 s · 3.4k→85 Hz | 78→27 Hz, heaviest (0.55) + 150 Hz noise | **pump: ticks @340 ms + @500 ms** | 1 slap @150 ms (0.12, 500 Hz) | Deep boom with a long low collapse, then you hear the pump rack back and forth inside its 0.85 s cycle |
| **DMR** (`thunder`) | 26 ms · 2.0 kHz · 0.95 (longest, loudest snap) | 0.19 s · 5.6k→300 Hz | 92→34 Hz, heavy | bolt tick @70 ms | **two slaps @100 ms (0.14) + @210 ms (0.07)** | The sniper slot: a long hard crack and the report rolling back off the range twice |
| **Pistol** (`pop`) | 14 ms · 1.9 kHz · 0.70 | 0.06 s · 6.2k→550 Hz | 128→58 Hz, light | slide tick @40 ms | faint @80 ms (0.05) | A dry snap — short everything, no drama, unmistakably a sidearm |

**Enemy fire** (`enemyShot`) keeps the Session-1 distance model
bit-for-bit in its gain/cutoff math (that tuning is law), and gains:
(a) micro-variation on pitch/duration, (b) a **near-range snap layer**
per class whose gain falls as (1−t)^1.5 — a close bot cracks, a
distant one stays a dull thud, which is how real fire localises.
Heavy classes keep their low body sine through the distance filter.

## 3. Supporting foley (same pass)

- **Reload** — the two square blips are gone. Magazine sequence
  scheduled on the audio clock: release tick → mag sliding out →
  seating thunk → charge rack → bolt-home tick (~0.65 s). `reload()`
  now accepts an **optional sound id**: `'boom'` swaps in
  shell-insert ticks (×4) + a late pump rack, timed to the shotgun's
  2.4 s reload. Callers pass nothing today and get the magazine
  sequence (see §4, hook 1, to enable the shotgun variant).
- **Dry fire** (`empty()`) — the 1400 Hz beep is now a metallic
  striker **click** (highpassed noise + resonant tick): an empty gun,
  not a UI sound.
- **Hit marker** (`hit()`) — tick + sine ping at the same pitch
  centre; less arcade, still instant. **Kill confirm** keeps its
  520→780 motif on triangle instead of square. **Headshot ping
  deliberately unchanged** (it was already distinct and liked).
- **Explosion** — main burst + sub thump unchanged, plus four
  randomised debris-crackle ticks across the following half second.
- **Smoke deploy** — NEW `smokeDeploy()`: canister pop + venting
  hiss. main.js already probed for this method (guarded fallback to
  `throwWhoosh`), so smoke grenades sound right with **zero caller
  changes**.
- **Unchanged, deliberately:** ambient wind bed, flashbang + duck,
  throw whoosh, pickup, hurt, wave fanfare.

## 4. Visual FX — state of the art + hooks for Vega

Audit finding: **the viewmodel muzzle flash lives in player.js**
(one fixed 0.22 m plane + PointLight for every gun); tracers and
`spawnExplosionVisual` live in main.js; **there is no impact visual
at all** — a hit currently shows only a tracer line, the hitmarker,
and sound. None of those files are this wave's pen, so:

- **DELIVERED (audio.js): `MUZZLE_FLASH_PROFILES`** — per-class
  flash table (scale / color / decay / light peak), crack row =
  today's exact values. **Hook 1 (player.js kick path):** look the
  profile up by `weapon.sound` wherever flash opacity/intensity are
  set (~player.js:377–380): `flash.scale.setScalar(0.22 * p.scale)`,
  material color `p.color`, decay `p.decay`, light `26 → p.light`.
  Result: shotgun blooms wide orange and lingers, SMG snaps small
  and fast, DMR burns blue-white.
- **Hook 2 (main.js reload(), one line):** pass the id —
  `sfx.reload(weapon.sound)` — to enable the shotgun shell-foley.
- **Hook 3 — impact feedback (main.js shoot(), at `hit.point`):**
  spec a pooled burst system, ONE shared `THREE.Points` (256 points,
  1 draw call total, zero shadow casters): on a world hit spawn
  5–8 points with gravity and 120–200 ms life, coloured by surface
  family (reuse proctex families: concrete grey, dirt brown, metal
  sparks orange); on a bot hit, 3–4 darker red-brown points. All
  state in preallocated Float32Arrays, ring-cursor like the tracer
  pool — no per-hit allocation, no new steady-state calls.
- **Hook 4 — tracer readability (main.js):** keep the 32-line pool
  (fat lines would need non-vendored addons); instead grade life
  per class — DMR 0.09 s (long visible streak), AR 0.05 (current),
  SMG 0.035 — and fade opacity across life instead of a hard cut.
  Zero new calls.
- **Bot muzzle flashes:** bots have no world-model flash today;
  adding one belongs with the characters pass (Atlas) — enemy
  *sound* now carries class + distance in the meantime.
- **smokevisual.js: untouched.** It is the newest, Odin-ruled FX
  module (5 calls/volume, quality-shedding); Brett's complaint was
  not smoke, and churning it risks a perf veto for no asked gain.

## 5. Perf + gates

- WebAudio cost per shot ≈ 17–23 short-lived nodes (vs ~13 before);
  all stop within ≤0.85 s (the shotgun's pump tick is the longest
  tail). No loops, no new steady-state nodes, no visual draw calls
  added at all.
- **Headless audio check** (mock AudioContext, /tmp/audio-check.mjs):
  210 `shot()` calls (all ids + fallback paths ×30), 56 `enemyShot`
  calls across distances incl. NaN/200 clamps, every other method,
  and a no-context Sfx — **zero exceptions**, 4,191 nodes created.
- **Smoke: PASSED** on the landed tree (includes the F3 audio pins).
- js/lighting.js: zero diff (integrity untouched). No console errors
  in any path testable headlessly; the served build is the same
  module graph smoke already loads.

## 6. What only Brett's ears can judge

Synthesis can be verified to *run*; only the owner can verify it
*convinces*. Listening checklist, in order of risk:

1. **AR full-auto** — does the variation read as "real gun" or still
   synthetic? (Knob: snap gain / variation amounts in `shot()`.)
2. **Shotgun pump timing** — ticks at 340/500 ms; should feel like
   the pump, not a second sound effect. (Knob: mechDelay/mech2Delay.)
3. **DMR double slapback** — epic or echo-y? (Knob: tailGain/tail2Gain.)
4. **Dry-fire click vs hit tick** — still instantly distinguishable
   in a fight? The beep is gone; if the click gets lost, the fix is
   gain, not a return to the beep.
5. **Overall loudness balance** vs the old build — layers sum under
   the same 0.35 master; heavy guns should feel bigger without
   being louder.

Every one of those is a one-number edit in the descriptor tables —
that is what the tables are for.
