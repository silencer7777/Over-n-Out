# V6 Update 6 — Report & Scorecard

**Build:** local commits `17a2da0` → `66fb95a` on top of Update 5
(`100e0eb`). **NOT PUSHED** — nothing goes live without Brett's tap.
**Scope:** 16 items (U6-01…U6-16) under Brett's extensive-build
directive ("Override all possibilities. Proceed with extensive
build. But within proper limits."), with his priority weighting:
characters, guns, and scopes are the headline items and got the
deepest passes. **All four gates green** (below). Lighting LOCKED
and untouched; bullets/tracers untouched per Brett's approval.

## Scorecard — planned vs shipped

| Item | Verdict | What shipped |
|---|---|---|
| U6-01 Usable scopes | ✅ SHIPPED | Real ADS optic views: DOM sight picture per optic kind (scope tube w/ mil-dots + magnification label, holo ring+dot, reddot ring+dot), magnification = the attachment's `adsZoom` stat (1.35 / 1.6 / 2.4) via the FOV ease, ~150 ms raise (`aimBlend`), viewmodel hidden inside the true scope, DMR's built-in optic works with no attachment. Unscoped play unchanged. |
| U6-02 Gun identity rd. 2 | ✅ SHIPPED | Silhouette-first pass on all 5 classes (AR railed handguard + crane stock, SMG ring sight + magwell, shotgun ghost ring + fat tube, DMR free-float handguard, pistol duty slide + beavertail). Muzzle vectors/anchors byte-unchanged. |
| U6-03 Music buzz | ✅ SHIPPED | Root cause fixed (below); composition byte-unchanged. |
| U6-04 Fire-rate fidelity | ✅ SHIPPED | Root cause fixed (below); permanent measurement lives in `tools/balance-probe.mjs` §D. Autos ≤0.16% of table everywhere; semis HOLD. |
| U6-05 Countdown colour | ✅ SHIPPED | Options swatches (green/cyan/amber/magenta/white), persisted + sanitized; **default stays green #39ff6a for everyone** (Brett's ruling). |
| U6-06 Bot realism | ✅ SHIPPED | Behaviour: per-bot temperament + aim jitter (deterministic in sim — see lesson below), strafe reversals 0.7–1.6 s, burst-pause variance. Visual: humanized merged soldier (nose/jaw/ears, MOLLE rows, drop-leg pouch, ankle taper; hit cores byte-identical) + visor scan sway. ASSAULT measured: **no win-rate shift** (below). |
| U6-07 Teams | ✅ SHIPPED | MERIDIAN (cyan) vs KESTREL (red), named in modes.js as one source; team-coloured score lines + results text in solo and online; in-world team markers + friendly/hostile palettes; no friendly fire either side. |
| U6-08 Bot backfill | ✅ SHIPPED + PROVEN | Sim lane pre-existing, now proven by `tools/backfill-check.mjs` (lone host fields full sides; host-leave tops back up; wipe refills; 4 humans → 0 friendly bots). The SOLO gap was real (team modes spawned hostiles only) — fixed: friendlies spawn, hunt, score, and respawn; zones count them. |
| U6-09 Menu redesign | ✅ SHIPPED | CSS/procedural only: animated aurora wash + light sweep + tactical grid over the live scene, sheened gradient title, update chips, glass cards (loadout/online/chat/results), breathing hero DEPLOY, reduced-motion guard. **Every existing id/function verified by the smoke served-id checks; mobile rules untouched.** |
| U6-10 Stances | ✅ SHIPPED | Full stance system via one shared machine (`js/stance.js`): stand/crouch/prone with Havoc's numbers (eye 1.66/1.05/0.55; speed ×1/×0.55/×0.22; spread ×1/×0.85/×0.65; hit-chance ×1/×0.90/×0.75). CoD-pattern keys: sprint+tap C/Ctrl = slide, tap = crouch, hold (0.28 s) or double-tap or Z = prone; slide lands in crouch; touch CROUCH button. `tools/stance-check.mjs` 14/14. Solo + sim wired identically. |
| U6-11 Bigger bushes + cover | ✅ SHIPPED | Compound bushes grew 35–45% (all 20 block now, was 8) + 6 ring bushes; forest bushes 0.8–1.45 m → 1.15–1.95 m (all 92 block); new cover across the ring (warehouse crates, jersey barriers ×10, solar slabs, depot). Colliders + B-pins re-derived from the build, never fudged. |
| U6-12 Expansion | ✅ SHIPPED (with one designed correction) | Ground 136→176 m, bounds 62→80, perimeter at ±81; four ring POIs (Warehouse NE, Fuel Depot NW, Solar Field SW, Landing Pad SE); Ops 10×8→12×10; HQ 20×9→22.5×9 westward + the 1.35 m HQ/Ops service alley (see spec as-built note: the first, wider HQ draft interpenetrated Ops — probes caught it, design corrected, not shipped broken). |
| U6-13 Realism continuation | ✅ SHIPPED | §2.5 flat-surface law held on all new geometry (textured mats only — warehouse canopy wears the roof texture, slabs the deck texture); metrics show **no new flat-surface strikes**; textures +1/map (bar: +2). |
| U6-14 Text chat | ✅ SHIPPED | Menu lobby chatroom (LOBBY room channel via the existing SERVER field) + in-game mini chat (ENTER, TEAM/ALL toggle, history, per-player mute persisted). Strict validation (240-char cap, channel enum), server control-strip + 5-per-4 s rate limit, server-stamped identity (forged names ignored), textContent-only rendering. Proven by `tools/chat-check.mjs` (11/11). |
| U6-15 Voice chat | ✅ SHIPPED (physics limit stated) | WebRTC mesh (≤4 humans), TEAM/ALL/off audience + PTT (hold V) / open-mic in Options, per-player mute/volume persisted, roster-driven from snapshots. Signaling rides the protocol extension. ICE failure surfaces **"VOICE UNAVAILABLE"** in the peer list + a chat notice — never silent. No STUN/TURN (repo law: no external services), so strict-NAT pairs will not connect — that's the stated limit, not a bug. Menu-lobby voice is out of scope by design (voice is an in-match system). |
| U6-16 Map identity | ✅ SHIPPED | Compound = **the yard** (warehouse/decks/alley fight). Forest = **the lanes** (two thicket walls, 30 bushes, gated crossings + the fallen-mast clearing). Snow = **the channels** (4 drift-mound ridges + buried dome + ice discs). Mars = **the canyon** (two rock corridor walls with gates + SE crater bowl + mesas + uplink spire). Identity is geometry; lighting untouched; zones/spawns re-proven per map (reachability-maps green). |

## Root causes, by name

**U6-03 (music buzz):** raw WebAudio **triangle-wave oscillators**
(pad + bass) — their odd-harmonic partials beat in the 1–4 kHz
band. Aggravators: 5 ms bass attacks clicking at 55–73 Hz, and
three pad tones starting sample-simultaneously (no stagger/
detune). **Fix:** a 2.8 kHz lowpass on the music tone bus only
(hat/kick keep the direct path — the hat IS HF content), pad
rebuilt as sine body + triangle at −12 dB with ±4-cent stagger,
bass attack 5→12 ms. The composition Brett approved (D minor,
96 BPM, Dm/Dm/B♭/A, lead chart, kick/hat) is byte-unchanged.

**U6-04 (fire rate):** every firing loop shared one pattern —
on firing, `fireCooldown = weapon.interval` **discarded the
negative remainder**, quantizing shots to frame/tick boundaries.
At the sim's 30 Hz the barrel attachments' interval mods
vanished entirely (AR measured 7.50/s base AND shortbarrel AND
longbarrel vs table 8.70/9.45/8.28). **Fix:** carry-remainder
accumulator (`fireCooldown += interval`, clamped) at all six
firing sites (solo shooter + sentry, sim shooter + sentry +
bots), tagged `U6-04 CADENCE`. `effectiveWeapon()` audited
clean — the table was never wrong; the loops were.

### Fire-rate measurement (tools/balance-probe.mjs §D, permanent)

| Weapon | Config | Table | SIM | Client 60 Hz | 120 Hz | 144 Hz |
|---|---|---|---|---|---|---|
| AR | base | 8.70 | 8.70 (0.05%) | 8.70 | 8.70 | 8.70 |
| AR | longbarrel | 8.28 | 8.28 (0.06%) | 8.28 | 8.28 | 8.28 |
| AR | shortbarrel | 9.45 | 9.47 (0.16%) | 9.46 | 9.46 | 9.46 |
| SMG | base | 15.38 | 15.40 (0.10%) | 15.39 | 15.39 | 15.39 |
| SMG | shortbarrel | 16.72 | 16.73 (0.07%) | 16.73 | 16.73 | 16.73 |

Semis (per-shot minimum gap bound = interval − 2 ticks; the
accumulator banks a late shot's lateness as credit, so the
long-run rate is exact and no shot can arrive a full tick
early): shotgun 1.18/1.12 → 1.18/1.13 HOLDS · DMR 1.82/1.73 →
1.83/1.73 HOLDS · pistol 4.76/5.18 → 4.77/5.18 HOLDS.
**Zero unexplained deviation.**

## Balance measurement (U6-06 law: measure, never silently rebalance)

ASSAULT bot-match win rate, identical instrument before/after
(rig driver, mobile AR, compound, 6 seeds): **0/6 attacker wins
before → 0/6 after** (attacker fights — 62→68 kills on seed 11 —
but the scripted attacker never channels; a driver trait, not a
combat shift). No mode was rebalanced. **Lesson recorded:** the
sim is seed-deterministic and scenario gates ride the exact
match.rng sequence — bot personality derived from match.rng
halved the soak camper's output and failed the soak; personality
is now derived from spawn ordinal (zero stream cost), soak green
(camper 46 hits / 12 kills vs 34/10 baseline).

## Perf — before (100e0eb) → after (Odin bars: ≤165 calls, ≤300k tris, shadow ≤200)

| Map | Calls | Tris | Textures |
|---|---|---|---|
| compound | 119 → **151** | 53,522 → 62,498 | 18 → 19 |
| forest | 131 → **161** | 223,236 → 242,898 | 21 → 22 |
| snow | 130 → **160** | 90,766 → 92,290 | 20 → 21 |
| mars | 131 → **162** | 70,616 → 73,354 | 20 → 21 |

Shadow estimate 192 → **199** (≤200 — the binding constraint
now; any future shadow caster needs a reclaim first). Soldier:
7 → **8 draw calls/bot** (the U6-07 team marker — a named,
deliberate cost; tris/bot unchanged). Headline items' budget
claim, per Brett's priority: scopes are DOM (zero scene cost),
gun/character realism rides merged geometry (zero added calls
per gun; soldier detail inside the existing merged mesh).

## Gates

- `tools/smoke.mjs` — **SMOKE PASSED** (incl. soak + ws-soak)
- `tools/biome-check.mjs` — **PASSED** (48 checks)
- `tools/reachability.mjs` — **REACHABILITY PASSED**
- `tools/reachability-maps.mjs` — **MAP REACHABILITY PASSED**
- Also green: `stance-check` 14/14 · `backfill-check` all ·
  `chat-check` 11/11 · `balance-probe` §D (above)

## Every re-pin, named

1. **Protocol (Vega ruling):** MSG 8 → 10 types (CHAT, SIGNAL),
   PROTOCOL_VERSION **stays 1** (extension, not bump — §5 drops
   unknown types for old peers; neither type carries an outcome).
   Smoke N1 re-derived; new N13 (validateChat) / N14
   (validateSignal) pins added.
2. **Smoke T1/T2:** SOLIDS 147 → 178 (+31 ring solids; Ops/HQ
   growth is count-neutral), EXTRA 22 → 37 (bushes 8 → 20,
   depot tanks +3). Compositions stated in the pin comments.
3. **Biome B4:** forest collider formula gains `thicketCount`
   (30) — the lane walls' tracked colliders.
4. **Reachability:** bounds pins 62 → 80 (both sources); V5 Ops
   source pins → the grown strings; Ops door/roof-chain probes
   re-derived (east-door plane x −26.15; roof chain relocated
   WEST, probes mirrored); HQ west-growth + warehouse/ring/
   solar probes added.
5. **Security lint:** the WebSocket exception extends by
   exactly one file — js/chat.js (menu chatroom transport,
   same discipline as js/online.js; named in the lint comment).

## Deferrals / stated limits (nothing silently dropped)

- **Voice + strict NAT:** no STUN/TURN exists in this build
  (repo law). Pairs that can't connect get an explicit
  "VOICE UNAVAILABLE" — see U6-15.
- **Menu chatroom** is live only when a game server is up
  (Brett's hosted sessions) — no always-on hosted lobby.
- **HQ south growth:** geometrically impossible (ruin line) —
  rejected in design, recorded in spec + world.js.
- **Rooftop block** not enlarged (HQ + Ops grew instead).
- **Sim players have no slide** (never did), so the stance
  machine's slide interplay is solo-only; sim bots don't take
  stances (players do, both lanes); sim shot eye origin is
  unchanged (stance affects speed/spread/hit-chance, measured).
- **Voice peer names** come from chat stamps; a player who
  never chats shows as PLAYER + id fragment (snapshots carry
  no names — a future Vega field would polish this).
- Touch: slide button remains as shipped in U5 (the CROUCH
  touch button drives the stance tap path).

## Awaiting Brett

Playtest verdicts: scope feel per optic (raise speed, tube
size), gun/character read at distance, music (buzz gone?),
stance keys (C hold vs Z), alley + warehouse fights, thicket
lanes / drift channels / canyon gates, menu look. Then his tap
to push — **nothing is live yet.**
