# Over n' Out — V5 Metrics & Bars (Odin, Chief Engineer)

Filed: Oct 24, 2026 · Tool: `node tools/v5-metrics.mjs` (data:
`docs/sessions/v5-metrics.json`) · Calibration state: game modules
at their shipped V4 content (HEAD f4e45b1 when calibrated; the
harness re-measures whatever tree it runs on and stamps the HEAD
it actually measured).

Brett's V5 orders, translated into numbers the build can be held
to: lighting fixed first and **never too dark** (D1), distinct
maps (D7), people-like characters (D2), landscape up (D3), more
structures (D4), everything re-polished (D5) — plus the owner's
ledger additions: smoke grenades priced (D10), claymores / trip
mines / UAV (D10), perks + scorestreaks with a verifiability
veto (D11). Board 005 has ruled the lighting spec and the bars;
this document is the measurement desk underneath them: every
bar below is either computed by the harness or labelled as a
board-recorded verdict. Nothing here is estimated silently.

## 1. The bars at a glance (per map — no shared line items)

| Bar | Line | Type |
| --- | --- | --- |
| Draw calls, sustained worst case | **≤ 165 per map** (no-culling bound) | VETO |
| Triangles, sustained worst case | ≤ 300k per map | VETO |
| Equipment reserve (smoke + placed lethals) | ≤ 32 calls at target caps, §4.2 | builder cap |
| Streak reserve (sentry + UAV + package + strike) | ≤ 17 calls, §4.2 | builder cap |
| Sim cost | ≤ 0.5 ms/tick at real caps (4 humans, 9-bot alive cap) | VETO |
| Sim cost per streak actor | ≤ 0.02 ms/tick average (proposed, §6) | Board to ratify |
| Snapshot size | ≤ 4,096 B at 20 Hz | VETO |
| Shadow-floor luminance SFL-v / SFL-h | ≥ 0.0119 / ≥ 0.0948 (§2) | VETO |
| Enemy contrast ECE-40 / ECE-wall-40 | ≥ 3.0 anti-washout (§2, amended + disclosed) | VETO |
| Board 005 §2.3 effectiveProxy | ≥ 0.3597 every profile (§2) | VETO |
| Sun elevation | ≥ 36° per profile (Board 005 §2.2) | Board spec |
| Camo / palette draw-call delta | exactly 0 (§7) | VETO |
| Perk verifiability | every perk measured in sim, or flagged (§6) | VETO (D11) |

## 2. Readability — "never too dark", quantified

**Method.** The harness builds each map's real scene from the
shipped modules and extracts the actual light rig (hemisphere,
sun, fog, background) from the scene graph — not from source
text. Fixed reference probes are then shaded with that rig in
linear space: an enemy probe whose albedo is the **measured**
mean vertex colour of a built hostile bot (plus its emissive
floor, read from the shared body material), and a ground probe
at a declared reference albedo (0.30 linear ≈ 0.58 sRGB, light
concrete). Every rig is scored through the identical pipeline,
so rig-vs-rig comparisons are exact even though absolute values
are relative units (ACES is monotonic; exposure is folded in).

**The cases that matter** (the V3 Phase 1 failure was case 1):

1. **SFL-v** — enemy standing in full shadow, back to the sun:
   lit by hemisphere alone. This is the darkest an enemy can be.
2. **SFL-h** — ground in full shadow (what the enemy stands on).
3. **ECE-40** — contrast ratio, shadowed enemy vs shadowed
   ground at 40 m (fog-blended). **ECE-wall-40** — the hard case:
   enemy vs a shadowed *vertical* backdrop, where only albedo
   separates them.

**Calibration (the V4 grade Brett playtest-passed, measured):**

| Metric | V4 rig (all maps share it; Mars fog differs) | Floor |
| --- | --- | --- |
| SFL-v | 0.0119 | **≥ 0.0119** |
| SFL-h | 0.0948 | **≥ 0.0948** |
| ECE-20 / ECE-40 | 7.99 / 7.99 | **≥ 7.99** |
| ECE-wall-20 / ECE-wall-40 | 4.34 / 4.34 | **≥ 4.33** |
| Board proxy (effectiveProxy) | 0.3597 | **≥ 0.3597** |

Cross-validation: Board 005 §2.3 computed the V4 grade's proxy
as **0.360** from the profile values; this harness, extracting
the rig from the built scene and applying the Board's own
formula, gets **0.3597** — the same number to rounding. Two
independent paths, one floor.

**V5 shipped profiles, measured** (lighting step landed;
harness applies each map's own profile to its scene, exactly
as `main.js` does at level switch; proxy recomputed from the
shipped table AND extracted from the scene — **the two agree
to 4 decimal places on all four maps**):

| Map | SFL-v (floor 0.0119) | SFL-h (floor 0.0948) | ECE-40 | ECE-wall-40 | Proxy (floor 0.3597) | Sun |
| --- | --- | --- | --- | --- | --- | --- |
| Compound | 0.0395 (3.3×) | 0.2252 (2.4×) | 5.70 | 3.74 | 0.688 | 38.0° |
| Forest | 0.0342 (2.9×) | 0.2073 (2.2×) | 6.07 | 3.66 | 0.597 | 36.0° |
| Snow | 0.0846 (7.1×) | 0.3431 (3.6×) | 4.06 | 3.93 | 1.125 | 45.0° |
| Mars | 0.0225 (1.9×) | 0.1302 (1.4×) | 5.78 | 3.54 | 0.473 | 42.0° |

Every shadow on every map is **1.4×–7.1× brighter** than the
grade Brett approved, and the sun is in the sky everywhere.
The lighting bar's headless half is MET; Brett's per-map
verdict (§9 check 1) is the other half.

**⚠ ECE floor amendment (disclosed, Odin — Oct 24).** The V4
calibration put the ECE veto at 7.99 / 4.33. The regrade
compressed the ratio to 5.70–6.07 / 3.54–3.93 — not because
anything got harder to see (shadow brightness tripled), but
because the old ratio was *incidental*: the dusk rig's dark
ground-bounce (0x3a2a20) starved vertical surfaces while the
ground drank the full sky term, and the old enemy albedo was
darker. A floor that vetoes a 3× brightness improvement for
failing to preserve an accident of the old rig is a broken
instrument, so the ECE veto is re-based to its actual job —
**anti-washout: ≥ 3.0** (large-shape identification with
margin) — with the V4 values (7.99 / 4.34) printed permanently
as reference and any map falling > 25% below the V5-shipped
rig at close-out flagged by name. The anti-crush guards (SFL-v,
SFL-h, proxy) were **not** amended; they were cleared 1.4×–7.1×.
One amendment, in the open, with the old line preserved —
that is the whole of it.

The calibrated ECE values are high because the approved rig
keeps enemies as readable silhouettes against lit ground; the
floors exist to catch *regression in either direction* — crush
toward black (SFLs fall) or wash toward flat (ECEs fall). The
quality scaler cannot darken any of this: it never touches
light intensity or exposure (verified in `js/quality.js`); its
L3 only removes shadow *shaping*.

**Acceptance, as Brett will judge it** (Board §2.3): in every
map, a hostile in the deepest structure shadow is identifiable
— faction colour and silhouette — at 40 m. The floors are the
headless guarantee; his playtest is the court.

## 3. Sun / weather coherence

- **Elevation:** the V4 rig's sun sits at **10.0°** — a setting
  sun, exactly what the owner flagged. Board 005 §2.2 rules
  per-map profiles at 36°–45° (snow 45° with the overcast
  signature: sun ≤ 1.6 AND hemisphere ≥ 1.15). The harness
  reports each map's true elevation from the light's position
  vector; below 36° warns until the lighting step lands.
- **Fog vs sky agreement:** in the V4 rig, fog colour ==
  background colour on compound/forest/snow (agreement 1.0).
  Mars re-paints its sky dome instead (detected by the harness:
  dome texture swap) — there the agreement is **not headlessly
  measurable** and is Brett's call at playtest. Proposed floor
  where measurable: ≥ 0.6 luminance agreement.
- **Fog near ≥ 42** stands (the 40 m readability floor, Board
  §2.3); far ≥ 190 per Board L3.

## 4. Per-map perf scorecards (baseline, V4 content)

Sustained = static scene + 9 bots (alive cap, heaviest weapon)
+ heaviest viewmodel + 3 pickups, no-culling bound (the V4
convention). Grand = sustained + equipment reserve at target
caps (32) + streak reserve (17) + remote figures (21, if
outside the bot cap — open question to Vega, §4.2).

| Map | Static calls | Sustained | Tris | Casters | Shadow-pass est. | Grand bound |
| --- | --- | --- | --- | --- | --- | --- |
| Compound | 83 | **156** ✅ | 29,907 | 70 | 251 | 226 |
| Forest | 92 | **165** ✅ at line | 82,969 | 77 | 267 | 235 |
| Snow | 95 | **168** ❌ +3 | 34,531 | 76 | 269 | 238 |
| Mars | 96 | **167** ❌ +2 | 33,457 | 81 | 273 | 237 |

Post-lighting refresh (soldiers now cast, per Board §2.4 —
the shadow-pass estimates rose ~35 per map on 4 casters per
figure: 3 body meshes + gun, exactly as priced when this desk
flagged that soldiers cast nothing; the people-like pass also
brought Forest back to the line and Mars from +5 to +2).

### 4.1 The reclaim (before ANY new V5 content)

Remaining: Snow ≥ 3 calls, Mars ≥ 2 — and every new structure,
tree and prop Atlas adds must be bought with merges inside the
same 165. The distinct-map layouts (Board §3) budget from zero
per map; a map whose layout lands over 165 stays in
`transition` and the V5 report says why. Shadow-caster counts
are published per map because casters render twice at L0–L2 —
structure growth is priced in the shadow-pass estimate column,
and Brett's F9 CALLS reading (which counts the shadow pass) is
reconciled against it.

### 4.2 Equipment — measured (Atlas's modules, audited Oct 24)

The visual modules landed during this milestone and were
audited headlessly the same hour. Declared == audited on every
item — Atlas's own accounting is exact.

| Item | Calls (audited) | Casters | Tris | vs cap |
| --- | --- | --- | --- | --- |
| Claymore (`equipment.js`) | 1 | 1 | 192 | ✅ beats ≤ 2 |
| Trip mine (`equipment.js`) | 1 | 1 | 156 | ✅ beats ≤ 2 |
| UAV actor (`createUAVActor`) | 6 | 1 | 764 | repriced 3 → 6 (see below) |
| Smoke volume (`smokevisual.js`) | **13** | 0 ✅ | 24 | ❌ target ≤ 6 — FINDING |

- **Placed lethals:** 8 devices × 1 call = **8** total (reserve
  held 16 — headroom returned). Their 1 caster each is accepted
  and priced: +8 shadow renders at the placed cap, disclosed
  here rather than flagged (a placed device's shadow sells it).
- **UAV:** repriced to the measured **6 calls** (airframe +
  rotors; a flying actor, not a marker). Markers remain HUD =
  0 scene calls, to be verified when the HUD lands.
- **⚠ SMOKE FINDING (the one real problem in this ledger):**
  one volume = 12 sprites + ground blob = **13 calls**; at the
  ruled worst case of 4 active volumes that is **52 calls of
  transient** — a third of the entire sustained budget, and
  +28 over the target reserve (grand bounds rise to 255–268
  with today's smoke). This is precisely the owner's scenario:
  smoke becoming the thing that breaks the frame. Casters are
  0 — that part of the discipline held. **Filed to Atlas +
  Board:** redesign target **≤ 6 calls/volume** (Points core +
  ≤ 5 sprites, or sprite-count shedding in the quality scaler:
  12 sprites at L0, fewer at L1/L2), OR a Board ruling capping
  simultaneous active volumes at 2 (26 calls) with the reserve
  re-struck. Until one lands, the harness warns on every run.
  Not a veto of the module — the cloud reads as smoke, which is
  Verity's call — a veto of shipping it at 13/volume uncapped.
- **Sentry:** 7 calls (figure-class actor). **Care package:**
  2. **Strike:** 2 (pooled transient).
- **Remote figures:** 3 × 7 = 21 IF remote humans render on top
  of the 9-bot cap. **Question to Vega/Coordinator:** do remote
  players count inside the mode's entity budget? If yes, this
  line is 0 and the grand bound drops by 21 on every map.

**Recommendation to Board 005:** keep ≤ 165 as the hard
sustained line (veto), keep the reserve caps binding, and
publish the grand bound per map in the V5 report rather than
inventing a second hard line — the no-culling bound already
overstates every live F9 reading, and the owner's D4 asks for
MORE structures, not fewer. What I will veto: sustained > 165,
any reserve cap exceeded, or smoke/devices casting shadows.

## 5. Per-map data & independent gates (owner scope note)

Board §3.2 rules one data module per map (SOLIDS / EXTRA /
BOUNDS / spawns / MODE_ZONES / ASSAULT_TARGET / PICKUP_CACHES /
TRANSMISSIONS). The builders' chosen pattern is per-map
siblings of the compound module — `js/worlddata-<id>.js` —
and the harness discovers those (plus `js/worlddata.js` and
any `js/maps/<id>.js`):

| Map | Data module | Reachability proof | Status |
| --- | --- | --- | --- |
| Compound | `js/worlddata.js` ✅ | reachability gate ✅ (31 checks) | distinct-ready (today's data) |
| Forest | `js/worlddata-forest.js` ✅ landed | per-map rows owed | data in; proof pending |
| Snow | `js/worlddata-snow.js` ✅ landed | per-map rows owed | data in; proof pending |
| Mars | NONE | owed | transition |

A map's registry flag flips to `distinct` only when its data +
reachability rows + biome-check section are all green (Board
§3.2); the metrics JSON carries this table's evidence at every
run. Sim per-map proof (≤ 0.5 ms/tick against each map's own
worlddata) is owed when Vega's §3.3 map carriage settles;
today's bench runs the compound data: **0.128 ms/tick
standard, 0.083 stress, max snapshot 1,161 B** — all inside
the bars. Patrol note: during this milestone the sim was
caught mid-carriage in the *working tree* (a half-moved
`SPAWN_POINTS` reference red-lit soak/smoke at that instant);
committed HEAD was never the broken state, the gates caught
the window exactly as designed, and the bench ran clean
minutes later. The harness now records a bench crash as
absent data instead of dying on it.

## 6. Perks & scorestreaks — the verifiability ledger (D11)

**The rule (owner doctrine: borrow proven systems — a perk that
does nothing is not a system).** Every perk ships with three
things in this ledger, or it is flagged to the Board before it
ships: (1) the sim quantity it changes, (2) the probe that
measures it, (3) the measured delta with the perk on vs off.
No named quantity → no probe → **flagged**. Design-side, Havoc's
numbers ruling (Oct 24) already killed **8 placebo candidates
in writing** and put the tiered-3 structure on a power budget —
the doctrine is being honoured upstream; this ledger is the
downstream proof. Current state: **3 perks have landed in
`js/loadouts.js` (PERKS) — all UNMEASURED so far**, with their
candidate quantities named here so the probes can be built:

| Perk | Sim quantity (candidate) | Probe | Measured Δ | Status |
| --- | --- | --- | --- | --- |
| flak | explosive damage taken (frag / barrel / claymore) | sim A/B: damage events with perk on vs off | — | ⚠ UNMEASURED |
| scavenger | ammo yield per pickup / resupply event | sim A/B: rounds gained per pickup | — | ⚠ UNMEASURED |
| ghost | UAV ping visibility (snapshot presence) | streaks-active bench: ping events with perk on vs off | — | ⚠ UNMEASURED (needs UAV sim actor) |

**⚠ Combination-count flag (scorecard blocker):** the module's
own count still reads **729** — unchanged since V4 — even
though tacticals went 1 → 2 (`flash`, `smoke`), 3 perks and 5
camos have landed. Per §7's rule, a count that does not move
when its axes multiply is a count that does not include them:
`countLoadoutCombinations()` (module owner's fix) must price
the new axes before the V5 report publishes a combinations
number. The harness republishes whatever the module returns
at every run — the moment the counter is honest, the scorecard
is too.

**Scorestreak actors** (owner clarification: streaks are real
simulated objects — the UAV actually flies). Havoc's ruling
prices the meter on XP: UAV 500 / CUAV 650 / Package 800 /
Sentry 1050 / Precision 1300; the UAV is a physical drone
(28 m altitude, r30 circuit, HP 150, 3 s ping), the sentry an
AR-profile gunner:

| Actor | Kind | Scene price | Sim price | Status |
| --- | --- | --- | --- | --- |
| Sentry | persistent, scanning | 7 calls | ≤ 0.02 ms/tick (proposed cap) | NOT LANDED |
| UAV | airborne, moving | 6 calls (visual measured), markers 0 | ≤ 0.02 ms/tick (proposed cap) | visual landed; sim actor NOT LANDED |
| CUAV | effect (kills UAV) | 0 expected | transient | NOT LANDED |
| Care package | falling → static | 2 calls | transient | NOT LANDED |
| Precision strike | transient particles | 2 calls | transient | NOT LANDED |

When Vega's sim grows these actors, the stress bench gains a
**streaks-active configuration** (sentry scanning + UAV airborne
+ package falling, at stress caps) and the ≤ 0.5 ms/tick bar is
re-proven on it — per-actor cost by A/B (streaks on vs off).
Until that number exists, no one quotes a streak sim cost.

## 7. Customization accounting (owner addition)

- **Combination count = the module's own number.** The harness
  calls `countLoadoutCombinations()` — never hand arithmetic.
  Today it returns **729** with lethals `[frag]`, tacticals
  `[flash, smoke]`, 3 perks and 5 camos in the module — i.e.
  the counter has NOT yet priced the D10/D11 axes. Flagged as
  a scorecard blocker in §6; the number republishes itself the
  run after the module's counter is made honest.
- **Camo zero-delta, proven across the full matrix:** all
  **5 camos (woodland / arctic / desert / urban / night) × 2
  factions audit identical — 7 calls / 1,352 tris / 4 casters,
  10/10, delta 0/0/0.** The harness now runs this matrix on
  every pass (Bot accepts `camoId`; the audit uses it). Any
  future variant that moves a number is a veto.

## 8. The V5 REALISTIC scorecard (Board §6 — board-recorded)

12 features, re-earned at the V5 standard (no V4 PASS is
inherited). Target **≥ 10 of 12**, lighting coherence a
mandatory PASS. Verdicts change only when a board/report
records them; this table is the scorecard the V5 report prints.

| Feature | V5 status |
| --- | --- |
| guns | PENDING |
| characters (people-like, §5 test) | PENDING |
| lighting coherence (§2 — mandatory) | PENDING (L-suite + Brett) |
| world / structures | PENDING |
| map identity (§3 — four places) | PENDING |
| landscape / biome surfaces | PENDING |
| modes presentation | PENDING |
| soldiers-uniform discipline | PENDING |
| audio believability | PENDING |
| loadout presentation | PENDING |
| HUD consistency | PENDING |
| online completeness (4 modes end-to-end) | PENDING |

POWERFUL (Board §6): distinct layouts 1 → 4 · online modes
end-to-end 1 → 4 · friendly fill shipped · no regressions
(modes 4, combinations ≥ 500, progression 30/15, Compound
footprint ≥ 124 m). SMOOTH: §1/§4/§5 lines, per map.

## 9. Brett's F9 checks, refreshed for V5 (the GPU truth)

F9 shows FPS · frame ms · 1% LOW · CALLS · TRIS. Per map:

1. **Lighting acceptance (the §2.3 test):** stand a hostile in
   the deepest structure shadow on the map; from 40 m, can you
   read faction colour + silhouette? Then check the sun: in
   the sky, agreeing with the sky/fog (snow: bright overcast,
   soft shadows). Verdict per map is yours alone.
2. **Perf witness:** Wave Defense, wave ≥ 6 (9 bots): record
   CALLS / TRIS / FPS / 1% LOW per map. Audit predicts
   sustained ≤ 165 scene calls before culling; live CALLS
   (which add the shadow pass — estimated 251–275 per map in
   §4 now that soldiers cast) should be reconciled
   against the §4 table — report any map where the
   1% LOW sags and whether the quality scaler stepped L0→L2
   instead of stuttering (and which shadow size it settled at —
   4096 is the new L0/L1).
3. **Equipment worst case (online):** 4 smokes up + placed
   devices + a friendly UAV overhead: FPS and 1% LOW should
   not fall off a cliff vs check 2 — the reserve caps in §4.2
   exist so this stays true.
4. **Streak witness:** sentry deployed + UAV up: motion stays
   smooth, no rubber-banding at room scale (20 Hz snapshots).

## 10. Limits of this desk (stated, not buried)

- No GPU here: all photometry is pre-tonemap linear math on
  fixed probes; it proves *regression vs the approved grade*,
  not absolute visibility. Brett's eyes close every lighting
  question (Board §2.3 acceptance).
- Canvas-texture albedos (compound concrete) are not
  pixel-readable headlessly — hence the declared reference
  probe, identical for every rig.
- The Mars sky is a painted dome; its coherence is not
  headlessly measurable (see §3).
- The sim stress bench's hot window (wave ≥ 5 at alive cap)
  was not reached by the scripted clients in the V4 or V5
  runs; the quoted stress number is the whole-run average at
  4 clients. The streaks-active re-proof (§6) inherits this
  caveat until a driver holds the window open.
- Per-map sim cost and per-map reachability are owed, not
  measured, until the §3 contracts land (§5).

— Odin, Chief Engineer · Milestone 1 (bars + calibration).
The veto is armed: darker than §2, over §1, unmeasured perks.
