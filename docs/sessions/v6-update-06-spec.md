# V6 Update 6 — Brett's Spec, Board Diagnosis & Command List

Session: Oct 27, 2026 (Coordinator). Update 5 is LIVE (local HEAD
100e0eb, live files byte-exact). BUNDLED update under Brett's
Oct 27 directive (bundling allowed; scorecard required; V7 gate
stands — this is the second of the 5+ V6 updates he ordered).
Lighting is LOCKED — no item touches js/lighting.js, light rigs,
profiles or grades. Ballistics/tracer visuals are APPROVED by
Brett ("bullets are looking good"; Update 5 verdict repeated) —
no item touches them.

## Brett's Update 5 verdicts (steering, verbatim intent)

- Theme music GOOD. Countdown GOOD (10 s stands; green numerals
  approved as the DEFAULT for everyone — U6-05 adds the personal
  color choice, default stays green).
- Theme music has a fuzzy BUZZ in the background. FIX IT (U6-03).
- Firing feels really fast. Shooting must MATCH THE STATS —
  base and with attachments (U6-04, correctness, top priority).
- Scopes must actually work as scopes (U6-01).
- Guns must look like what they are (U6-02, identity round 2).
- Bots more realistic (U6-06). Team matches need clear named
  teams (U6-07). Empty lobbies must backfill with bots (U6-08).
- Start menu is dull — lively, modern, inviting (U6-09).
- Added mid-flight: stances (U6-10), bigger bushes + more cover
  (U6-11), bigger map + bigger buildings (U6-12), realism
  continuation (U6-13), text chat (U6-14), voice chat (U6-15).

## OWNER OVERRIDE (Brett, Oct 27, 2026, verbatim)

> "Override all possibilities. Proceed with extensive build.
> But within proper limits. Permission to continue upgrade."

Effect: the deferral fallbacks in this spec are OVERRIDDEN.
U6-12 ships the FULL expansion (ground/bounds/warehouse AND
the HQ/Ops footprint enlargement with its route re-derivation
— D7(c) is cancelled as a deferral and becomes build scope);
U6-14 and U6-15 ship in full, sequenced chat-then-voice only
as build order, never as descope. What is NOT overridden
("within proper limits"): all four gates green; Odin's
budgets (≤165 calls, ≤300k tris, shadow ≤200); hit-core and
balance integrity (deviations measured + reported, never
silent); the protocol extension done openly with named
re-pins; license-clean/procedural only; lighting LOCKED;
local commits only, nothing pushed. Physical limits (e.g.
WebRTC NAT pairs without TURN) are surfaced with evidence,
never faked and never used to shrink anything else.

## PRIORITY WEIGHTING (Brett, Oct 27, 2026, final word)

> "really focus on characters, the guns, make them look as
> real as possible and make the scopes usable like I said."

HEADLINE items, in order: **character realism** (U6-06's
visual side + the U5-05 follow-through — a deep pass, not
just behaviour), **gun identity/realism** (U6-02), **usable
scopes** (U6-01). These get the deepest passes and FIRST
claim on the perf budget (Odin arbitrates; budgets still
bind). If trade-offs are forced anywhere, these three win
and the trade-off is named in the scorecard. "As real as
possible" within the standing limits: procedural only, hit
cores byte-identical, per-bot budget discipline — realism
through form, proportion, and surface.

## Diagnosis (board-style, evidence first)

### D1 — Fire-rate fidelity (U6-04): frame-boundary reset
Both firing loops (solo `js/main.js` tick; authoritative
`net/sim.js` stepPlayer) and both bot cadence timers
(`js/bots.js`, sim bots) share one pattern: on firing,
`fireCooldown = weapon.interval` — the negative remainder
(overshoot past zero) is DISCARDED, and the next shot can only
leave on a frame/tick boundary. Measured consequence (probe,
D1 table in the report): the cadence quantizes to whole
frames — at 60 Hz the AR fires 8.57/s against a table 8.70/s,
the pistol 4.62 vs 4.76; at the sim's 30 Hz tick the AR drops
to 7.50/s (−13.8%). The guns have NEVER fired at their table
rates; the rate a player gets depends on their display's
refresh rate, which is precisely "not matching the stats."
Fix = carry-remainder accumulator in all four loops
(`fireCooldown += interval`, clamped to ≥ −interval so a
hitched frame can never burst), preserving first-shot-immediacy
and the semi-auto edge rules. Attachments were audited clean:
`effectiveWeapon()` applies each interval multiplier exactly
once from the immutable base row (long×1.05, short×0.92 are
the only interval mods) — no compounding, no double-apply.
Bots get the same fix against `bot.shotInterval`.

### D2 — The music buzz (U6-03)
The theme's pad and bass are `triangle` oscillators. A raw
WebAudio triangle is not a pure tone: it carries odd harmonics
(1/n²), and the pad plays D-minor triads whose upper partials
beat against each other in the 1–4 kHz band — a faint fuzzy
halo sitting behind an otherwise clean mix. Two aggravators:
(1) the bass attacks at 5 ms with NO release shaping on a
triangle at 55–73 Hz, so every bass note starts with a click /
thock that repeats 3× per bar; (2) three pad tones start
sample-simultaneously each bar with 400 ms attacks but no
stagger or detune spread, so their partial collisions are
periodic — the ear locks onto the beating as a constant
"background buzz." Fix (composition UNCHANGED — same notes,
same rhythm, same volumes): lowpass the music bus (2.8 kHz,
gentle slope) so triangle partial hash above the musical band
is rolled off; give pads a sine+triangle blend (sine carrier
for body, triangle at −12 dB for warmth) and ±4-cent stagger;
bass gets a 12 ms attack and a shaped release. Acceptance is
structural: the buzz sources (unfiltered triangle partials,
click attacks, synchronous pad starts) are removed in code,
auditable in source; the chord chart, lead, kick and hat are
byte-for-byte the U5 composition.

### D3 — Scopes today (U6-01)
ADS currently only scales FOV (`baseFov / adsZoom`) and moves
the viewmodel to center. The optic models on the guns are
decorative: there is no sight picture — no tube, no reticle,
no magnified optic view — so a SCOPE 4× "aims" exactly like
irons, just narrower. The reddot's 1.35× and scope's 2.4× are
FOV numbers with no visual difference. Fix: a real optic
layer — DOM/CSS scope overlay per optic class (red dot: open
reflex frame + dot; holo: ring + dot; scope 4×: circular tube
with mil crosshair + edge blackout), shown only while ADS with
that optic fitted; zoom eases (already in player.js) with the
overlay fading in at the end of the raise; viewmodel gun dips
below the sight line while scoped with the 4× (standard FPS
practice) and stays for reflex sights. Magnification = the
attachment's adsZoom stat, unchanged. Irons (no optic) keep
today's centered-gun ADS.

### D4 — Gun identity (U6-02)
After U5's detail pass the guns share one silhouette family:
similar receiver lengths, similar barrels — at a glance (the
viewmodel is small) an SMG reads as a short AR and the DMR as
a long AR. Identity is SHAPE: AR = mid barrel + carry-handle
line + standard mag curve; SMG = compact body, long straight
stick mag, short barrel, wire stock; shotgun = fat pump tube
under a thick barrel, tube magazine, no box mag; DMR = long
heavy barrel, big scope rail mass, short 10-round mag, bipod
nubs; pistol = slide-over-frame proportions (already closest).
Fix in gunmodels.js builders only; muzzle anchor vectors and
attachment anchors are interfaces — unchanged.

### D5 — Teams & backfill, current truth (U6-07, U6-08)
The sim already has the bones: players are team 'you', enemies
'kestrel'; team modes field `botRoster` per side with friendly-
bot backfill in the sim (net/sim.js roster lane), and solo TDM
respawns a continuous roster. What's missing is IDENTITY: no
team names or colors anywhere a player looks — the HUD
score-line doesn't name the sides, solo bots wear faction camo
but nothing labels friend vs foe in the HUD/results, and the
online scoreboard has no team grouping. And the backfill
guarantee is unproven at the edges: a solo player in an online
room depends on the server starting team-mode rosters with
zero other humans (needs a headless proof), and mid-match
leaves are handled by roster respawn only if the lane is armed
for that mode. U6-07 names the teams — MERIDIAN (player side,
cyan) vs KESTREL (enemy, red) — in HUD score-line, results,
online roster and in-world nameplate tint. U6-08 proves the
sim roster lane headlessly (1 human → full rosters both sides;
human leaves → refilled) and closes the solo-client gap if
the solo TDM/DOM roster lacks friendly bots.

### D6 — Stances vs the slide (U6-10)
Today: C/Ctrl = slide when sprinting, nothing otherwise.
Havoc's reconciliation (CoD pattern): sprint + C/Ctrl TAP =
slide (unchanged); C/Ctrl while not sprinting = crouch toggle;
hold C/Ctrl ≥ 0.28 s from crouch (or double-tap C) = prone;
Space or a stance-up tap exits upward one level; prone blocks
sprint and slide; slide ends standing unless C held (ends in
crouch). Numbers (Havoc): eye 1.62 stand / 1.05 crouch /
0.55 prone; speed ×1.0 / ×0.55 / ×0.22 (prone crawl); spread
mult while stanced ×0.85 crouch / ×0.65 prone (stationary
bonus, mirrors the ADS philosophy); recoil taken ×0.9 / ×0.8.
Collision: player collision stays the XZ radius model;
"height" is honest where the game models height — eye height,
bot target height (solo bots aim at the player's eye line —
a proned player is a lower, harder target via the hit-chance
distance formula's height term… no: bots roll hit chance;
the honest hook is stance reduces bot hit chance ×0.9 crouch /
×0.75 prone, named as a stance rule, not hidden), and the
reachability step/jump model is UNCHANGED (stances never
raise step height; prone/crouch cannot pass under anything
the model doesn't already allow — no new gaps are opened).
Sim: input keys gain crouch/prone booleans (protocol
extension of the input vocabulary, validated strictly);
the sim applies eye/speed/spread multipliers to its players
and bot aim height follows the target's stance eye.

### D7 — Map & building expansion, priced (U6-12)
Ripples, honestly: bounds live in world.js (`bounds: 62`) and
worlddata.js (BOUNDS 62, smoke/reachability-pinned mirror);
the ground plane is 136 m (±68) — bounds cannot pass ±68
without new ground; biome blankets are r 90 (they already
overshoot any sane bound); spawn points and mode zones sit
inside ±62 and stay valid if the ring outside them is pure
expansion. Buildings: HQ/Ops interiors are pin-dense
(reachability routes thread their doors/stairs) — enlarging
THOSE footprints means re-deriving dozens of route pins.
Priced plan that keeps every gate green: (a) ground plane
136 → 176 m, bounds 62 → 80, perimeter wall ring at ±81,
rim dressing (Update 4 overlay + scatter) extended over the
new ring; (b) ONE new large building in the expansion ring —
a warehouse (18 × 11 m footprint, 4.2 m walls, two wide
doors, interior crate lanes) — new square footage bigger
than any existing interior, colliders registered through
SOLIDS/worlddata with pins re-derived from the build;
(c) [OVERRIDDEN Oct 27 — see OWNER OVERRIDE] the existing
HQ/Ops footprints ARE enlarged this update: walls move
outward on the same interior topology (door gaps, stair
chains and room partitions keep their relative layout,
translated to the larger shells), and every reachability
route pin that touches them is re-derived from the built
geometry and re-proven by the suites; (d) cover props (U6-11) seed the
new ring so it plays, not just exists. Perf price: ground
+1 texture repeat (no new calls), warehouse merged into the
solids buckets (+0 sustained calls), tris +~2k/map — inside
Odin's bars with the U6 additions totalled in the scorecard.

**AS-BUILT CORRECTIONS (during the build, all probe-proven):**
Ops grew +1 m on every side (10×8 → 12×10, doors unchanged).
HQ's westward growth as first drafted (−22 → −26, 24×9)
INTERPENETRATED Ops' grown east face and sealed its east
door lane — the reachability probes caught it before it
shipped. Final: HQ grows west to −24.5 (22.5×9), leaving a
1.35 m HQ/Ops SERVICE ALLEY (a real flank route, open both
ends); the Ops roof chain (1.15 → 2.3 → 3.45) relocated to
Ops' WEST exterior with mirrored probes; rooftop block not
enlarged (the two named buildings grew instead). Snow's
identity ridges ship as elliptical DRIFT MOUNDS (cylinder
geometry — biomes.js uses no BoxGeometry; the three-stub is
law). Perf as built: compound 151 calls (solids are NOT
call-merged the way D7 assumed — +1 call per solid), forest
161, snow 160, mars 162 — all inside ≤165; shadow est 199/200
is the binding constraint going forward.

### D8 — Baseline perf (tools/v6-metrics.mjs @ 100e0eb)
compound 119 calls / 53,522 tris · forest 131 / 223,236 ·
snow 130 / 90,766 · mars 131 / 70,616 · shadow est ≤192 ·
soldier 7 calls / 2,622 tris per bot (worst weapon 2,898) ·
viewmodel worst 1,000 tris · camos 9, zero-delta proven.
Bars (Odin veto): ≤165 calls/map, ≤300k tris, shadow ≤200.
Known warnings: 7 (sun-disc strikes ×4 + layout ground ×3 —
all dispositioned in U5's report; unchanged by this update
except where U6-12's ground rebuild touches the layout box —
it does not; layouts stay projections).

## The command list (owner + acceptance per item)

**U6-01 — Usable scopes.** Owner: Lens + Prism.
Per D3: optic overlay layer (reflex / holo / 4× tube) driven
by the deployed class's fitted optic; magnification = the
attachment's adsZoom (1.35 / 1.6 / 2.4), irons unchanged;
overlay appears only in ADS, fades with the raise; 4× hides
the viewmodel gun (sight picture replaces it), reflex/holo
keep it lowered. *Acceptance:* every optic in the loadout
table produces its own scoped view at its stat zoom (code-
audited mapping optic→overlay→adsZoom); unscoped and
no-optic play byte-identical in feel (spread/move rules
untouched); smoke served-id checks still pass.

**U6-02 — Gun identity, round 2.** Owner: Atlas.
Per D4: silhouette-first rebuilds in gunmodels.js — SMG
compact + stick mag + wire stock; shotgun pump + tube mag
(thicker barrel, no box mag); DMR long heavy barrel + short
mag + rail mass; AR keeps its U5 identity as the reference;
pistol slide/frame proportions. Viewmodel AND bot guns.
*Acceptance:* G1–G5 pins green; muzzle vectors + attachment
anchors unchanged in source; per-weapon tris priced (worst
weapon stays ≤ ~3.4k); each weapon's read is its class by
silhouette alone (report describes the five reads).

**U6-03 — Music buzz fix.** Owner: Echo.
Per D2: music-bus lowpass (2.8 kHz), pad sine+triangle blend
with ±4-cent stagger, bass attack 12 ms + shaped release.
Composition (chords, lead chart, rhythm, levels, tempo)
UNCHANGED. *Acceptance:* the three buzz sources named in D2
are absent in source; chord/lead/kick/hat code untouched;
music still starts/stops/ducks exactly as U5.

**U6-04 — Fire-rate fidelity.** Owner: Trigger + Sentry.
Per D1: carry-remainder accumulator in all four cadence
loops (solo player, sim player, solo bots, sim bots);
extend tools/balance-probe.mjs with a cadence section that
drives the sim + a client-loop replica at 30/60/120 Hz and
prints measured shots/sec for all 5 weapons — base, and with
longbarrel (×1.05) and shortbarrel (×0.92) — against the
effectiveWeapon table. *Acceptance:* measured == table
within ±1.5% at every driven rate, every weapon, every
configuration; the table prints in the report; zero
unexplained deviation (the residual is frame phase, ≤1
frame, and it averages out — the accumulator guarantees
the long-run rate is exact).

**U6-05 — Countdown color option.** Owner: Lens.
settings.countdownColor: a swatch row in options (green
default #39ff6a, plus cyan, amber, magenta, white); applies
to the countdown numerals + GO (the wave banner's countdown
presentation only — wave banners keep their look); everyone
ships green; persisted + sanitized like all settings.
*Acceptance:* round-trips through reload; default profile
renders the exact U5 green; smoke settings pins extended,
not loosened.

**U6-06 — Bot realism.** Owner: Ghost + Hunter.
Behaviour first: (a) reaction variance — aim-up time gets a
per-engagement jitter (±25%, seeded per bot) instead of a
metronome; (b) movement easing — bots accelerate/turn with
smoothed steering (no instant velocity snaps), strafe
reversals at human intervals (0.7–1.6 s) with ease-in/out;
(c) burst discipline variance — inter-burst pauses vary by
bot temperament (a per-bot 0.85–1.25 multiplier rolled at
spawn); (d) cheap visual: visor-scan micro-sway when a bot
has no LOS (head/visor yaw wanders ±0.2 rad slowly) — reads
as looking around, costs nothing. HARD LAW: hit cores/pins
unchanged; difficulty damage numbers unchanged (this is
texture of behaviour, not a buff/nerf — the aim TIME needed
keeps its mean; jitter is symmetric). *Acceptance:* smoke/
biome pins green; rig botmatch ASSAULT attacker win rate
measured before/after and REPORTED (target: no silent
shift — if it moves > ±0.05 the report says so plainly and
why); solo bots visibly less mechanical per the four named
mechanisms, each code-auditable.

**U6-07 — Teams.** Owner: Ledger (data) + Lens (HUD) + Vega
(online). Team table: MERIDIAN (player side, cyan #35c4ff)
vs KESTREL (red #ff5340) — names/colours in modes.js as the
one source; solo HUD score-line reads "MERIDIAN n — n
KESTREL" in team modes; results screen names the winner by
team; friendly bots in team modes are identifiable (cyan
nameplate strip + minimap-free rule: nameplates only where
the game already draws them); online: snapshot roster groups
by team with names/colours in the online panel + results;
enemy nameplates red, friendly cyan, in-world. Waves/assault
keep their framing (you + Meridian vs Kestrel waves) with
the score-line naming both sides where a score exists.
*Acceptance:* team names come from the one table (no
hardcoded duplicates); TDM/DOM solo and online both show
named, coloured teams in HUD + results; MD pins extended
for the team table.

**U6-08 — Bot backfill guarantee.** Owner: Vega + Sentry.
Per D5: (a) a headless proof (tools/backfill-check.mjs)
driving net/sim.js: room in TDM with ONE human → rosters
fill to botRoster per side within the roster lane's cadence
and kills score; human "leaves" (player removed) mid-match →
the 'you' roster refills; zero-human room is not required
(matches end with no humans — server lane, unchanged).
(b) Solo client: verify TDM/DOM field friendly bots; if
the solo roster is player-alone vs 4, add friendly roster
bots on the sim's proven pattern (roster lane mirrored in
main.js, friendly bots target Kestrel only — Bot gains a
team + target-acquisition against enemy bots, damage flows
through the existing bot.damage path). (c) A leaving
player's slot in online team modes refills via the same
roster lane (server-side proof in the same tool via sim).
*Acceptance:* backfill-check prints PASS lines for solo-
human fill, leave-refill, and (if built) the solo-client
roster fields both teams at botRoster size; gameplay
continues (score moves) with one human AFK in the proof.

**U6-09 — Start menu redesign.** Owner: Lens.
Lively, modern, inviting — CoD Mobile class — with repo
means only: animated layered gradient + slow panning
procedural backdrop treatment over the live scene, glass
panels, a bold condensed title lockup with animated sheen,
mode cards with hover lift, a hero DEPLOY button (pulse +
sheen), a live ticker line (rotating tips/mode blurbs),
season-style accent bar. EVERY existing function survives:
biome select, mode select + goal, class tabs, weapon row,
attachment pickers, gear line, profile line, camo picker,
options page + ⚙ button, online panel (name/room/server/
join/status), results block, sens slider — smoke's served-id
checks are the contract (M7–M10 id list must ALL still
pass). Mobile: the layout must not regress (panels stack,
≥44px targets intact). *Acceptance:* all served-id pins
green; no element removed; music still starts on first
gesture; countdown/pause flows unchanged.

**U6-10 — Stances: crouch + prone.** Owner: Havoc (numbers)
+ Stride (feel) + Vega (sim parity).
Per D6: stance state machine stand→crouch→prone with the
CoD key reconciliation (sprint+tap C/Ctrl = slide; tap =
crouch toggle; hold ≥0.28 s or double-tap = prone; jump/
stance-up exits upward; slide exit respects held C →
crouch). Havoc's numbers in D6 (eye heights, speed mults,
spread/recoil handling). Options expose: stance key
behaviour note + a "hold to prone" toggle (on = hold goes
prone, off = hold stays crouch, double-tap still prones).
Touch: a STANCE button cycles down/up beside the existing
touch verbs (mobile lane rides along, same input state).
Sim parity per D6 (input vocabulary extension, validated).
*Acceptance:* reachability suites green UNCHANGED (step/
jump model untouched — new smoke pins assert stance eye
heights + speed mults from the same constants the game
reads); slide still fires ONLY from sprint+tap; stance
persists correctly through respawn (resets to stand);
countdown/DOWN states force stand.

**U6-11 — Bigger bushes + more cover.** Owner: Atlas.
Forest bushes scale up: size band 0.8–1.45 → 1.15–1.95 m
(two-mass displaced-sphere build already smooth); the bush
collider rule (±0.75·size, top 0.72·size, blocks at ≥1.1 m)
re-derives honestly — B-suite pins (bush count, blocking
count, collider totals) are re-measured from the build and
re-pinned with the numbers printed in the report, never
fudged. Cover: a shared dressing set across all maps —
crates (1.1 m), barriers (1.0 m), a machinery block — placed
at named spots on the compound base (so every biome map
inherits them), clear of spawns/zones/assault staging and
of every reachability route; each registers as a world.js
solid + worlddata mirror (SOLIDS/EXTRA pins re-derived).
*Acceptance:* biome-check + smoke T-pins green at the
re-derived numbers; reachability suites green; cover count
per map printed (props are shared-base: same count on all
four maps, plus forest's bushes).

**U6-12 — Map + building expansion.** Owner: Mason + Atlas,
Odin pricing. Per D7: ground 136→176 m; bounds 62→80; wall
ring → ±81; Update-4 overlay + rim scatter extended;
warehouse (18×11 m, enterable, 2 doors, crate lanes) in
the NE expansion ring; AND the HQ + Ops footprints enlarged
on their existing interior topology (per the OWNER
OVERRIDE — D7(c) as a deferral is cancelled; the route
re-derivation is build scope, done and re-proven here).
worlddata mirrors (BOUNDS, SOLIDS if the warehouse adds
solids — it does, +its interior crates as EXTRA or solids
per the mirror's own rules) re-derived; sim worlds read
the same worlddata (bounds parity is a pin). Spawns/zones/
assault staging UNCHANGED (they're interior). *Acceptance:*
reachability + reachability-maps green at bounds 80;
smoke V4 bounds pin re-pinned 62→80 with this spec cited;
metrics show the expansion's price (calls/tris) inside
bars; the warehouse is enterable in the reachability
model's terms (its doors face open ground, interior floor
at ground height — route pins added for its doorway).

**U6-13 — Realism continuation.** Owner: Atlas + Verity.
On the expanded footprint: the new ring gets the full
treatment — ground wear lanes to the warehouse, rim rock/
vegetation scatter continuous with the maps' languages,
warehouse surfaces textured (no flat solids — §2.5 law),
cover props textured/worn, building trim on the warehouse
(roofline, door frames, vents) in the U1/U5 idiom. Existing
buildings keep their approved direction (U5 verdict) with
a finish pass on the warehouse-adjacent sightlines only —
no re-litigation of approved work. *Acceptance:* §2.5
strikes do not grow (sun-disc + layout remnants only, as
before); flat-shaded share does not regress on any map;
textures budget +≤2 per map.

**U6-14 — Text chat.** Owner: Vega + Aegis.
(a) Menu chatroom: a lobby panel in the start menu — when
the SERVER field has an address (or on JOIN), the client
opens the lobby channel on that server (a global room the
server hosts outside matches); message list + input +
callsign from the online panel. (b) In-game mini chat: a
compact overlay (last 5 lines, fading) + an input line
opened with T (Enter sends, Esc cancels) without leaving
pointer lock flow (lock exits to type — standard; game
input is inert while typing); channels TEAM / ALL chosen
per message (Tab toggles while composing; the sim's teams
define TEAM). LAW: protocol extension per U6-15's ruling
(MSG.CHAT); strict validation — 240-char cap, control-char
strip, server rate limit 5 msgs / 4 s per client, server
re-broadcasts only validated {from, channel, text, team};
clients render text via textContent ONLY (no innerHTML —
the security lint's spirit, asserted in code review + a
smoke grep pin); per-player mute (settings-persisted name
set) hides their text AND silences their voice (U6-15);
nothing persists server-side beyond the session.
*Acceptance:* two headless WS clients exchange lobby +
room chat through the real server in a check script;
oversize/rapid messages are dropped by the server (proven
in the same script); muted names render nothing.

**U6-15 — Voice chat.** Owner: Vega + Echo.
WebRTC peer mesh (rooms cap at 4 humans → ≤6 peer links),
signaling relayed by the game server over the EXISTING
socket using the protocol extension (MSG.SIGNAL: opaque
{to, kind, data} relay — server validates envelope only,
never the SDP semantics; per-pair rate-limited). Client:
js/voice.js — getUserMedia on explicit enable only (a
VOICE button + options: voice mode OFF / PUSH-TO-TALK /
OPEN MIC; channel TEAM / ALL switch; per-player volume +
mute in the online roster, sharing U6-14's mute set);
PTT key V (hold); mic capture stops when voice is off or
the session ends; remote audio through per-peer gain
nodes on a voice bus (own volume in options, rides the
master). HONEST LIMITS (in the UI + report): no STUN/TURN
in scope — peers behind symmetric NAT may fail to connect
audio; when a peer connection fails, the roster shows
"voice unavailable" for that player instead of silence
with no signal; text chat is unaffected. PROTOCOL RULING
(Vega): EXTENSION, not a version bump — protocol.js §5
already specifies unknown types are dropped by old peers,
so MSG grows 8 → 10 (CHAT, SIGNAL) with PROTOCOL_VERSION
staying 1; validateChat / validateSignal join the N-suite
philosophy (strict shapes, size caps); smoke pins N1
("exactly 8 types") re-derived to the new table and NAMED
in the report as a ruled change, like PG7 before it.
*Acceptance:* signaling relay proven headlessly (two WS
clients exchange offer/answer envelopes through the real
server; server rejects malformed/oversized signal
payloads); client code paths for capture/PTT/channel/
mute are present and settings-persisted; the NAT caveat
is printed in the options UI copy and the report. (Live
mic audio between two real browsers is Brett's test-night
check — it cannot be proven headlessly and the report
says so.)

**U6-16 — Map identity.** Owner: Atlas + Mason, Havoc
zones. Brett, verbatim: "make the maps unique very unique
design, make them so unique you actually feel like you are
playing different maps." Identity from GEOMETRY, materials
and dressing (lighting LOCKED); per-map budgets bind
individually; the U6-12 expansion is the canvas. Per-map
identity blocks:

- **COMPOUND — "the yard"** (identity: balanced industrial
  mid-range). Features: the new warehouse (U6-12) as its
  signature interior; long gate lanes vs tight HQ/Ops
  interiors = the two-tempo map; cover-dressed yards (U6-11);
  vertical = decks/tower (3 levels in play). Rhythm:
  lane pushes + interior fights.
- **FOREST — "the lanes"** (identity: close-quarters
  woodland). Features: thicket walls (scaled bushes + extra
  tree clusters) carve THREE approach lanes to a central
  clearing; the fallen-mast clearing is the landmark
  (open bowl, long sight into it, nowhere to hide inside);
  sightlines SHORT (≤35 m) except the clearing; vertical =
  ground only — the flat, fast, ambush map. Rhythm: lane
  control + clearing fights.
- **SNOW — "the channels"** (identity: drift-channel
  whiteout). Features: drift-ridge lines channel movement
  into two crossings + the buried-dome landmark at the
  center (POI exists; ridges make it a hold point); ice-disc
  field = the open, exposed rotation route (fast, no cover);
  sightlines LONG over the ice, broken in the channels;
  vertical = drift tops are dressing only (no new levels).
  Rhythm: channel holds + risky ice rotations.
- **MARS — "the canyon"** (identity: rock-corridor
  high-desert). Features: rock/mesa corridors form a canyon
  crossing mid-map; the crater bowl + uplink spire landmark
  (spires = the vertical read; crater rim = ring fights);
  sightlines LONGEST of the four down the canyon, dead
  inside the rocks; vertical = rim vs floor (2 levels).
  Rhythm: canyon duels + rim control.

Implementation truth: the solo biome builds (js/biomes.js)
already register their own colliders — identity is built
THERE (thicket walls, drift ridges, rock corridors as real
collider dressing in each biome's language, B-suite pins
re-derived honestly), on top of the shared compound base
whose own identity ships via U6-11/U6-12. The sim layouts
(worlddata-*.js) already carry distinct solids/zones per
map; Havoc re-verifies zones/staging per map against the
identity blocks (no zone moves unless a layout's own data
demands it — any move is named). *Acceptance:* each map's
identity features exist as colliders/dressing in its build
(biome-check userData + pins); sightline character differs
by construction (the report names the longest open line
per map from the built geometry); reachability-maps stays
green; per-map metrics inside bars.

## Process law (standing)
License-clean patterns only; procedural/original assets; no
new dependencies; Odin's veto armed (≤165 calls/map, ≤300k
tris, shadow ≤200 — every addition priced); local commits
only — NOTHING pushes without Brett's tap. Gates at the end:
smoke, biome-check, reachability, reachability-maps — all
green — plus metrics + balance-probe cadence + backfill
proofs for the scorecard.
