# Board Meeting 005 — V5 Scope Ruling (Lighting Spec, Distinct Maps, Realism Bars)

Convened: Oct 24, 2026. Chair: Dominic "Apex" Cross. Present: full
studio + Division Zero + Team Lumen leadership + the five agents
(Coordinator, Vega, Atlas, Odin, Havoc). Called by the owner's V5
green-light — *"v5 will be more realistic… fix the lighting issue
again… the sun looks like its setting, it should be in the sky or
matching the weather… we don't ever want it too dark"* — and by the
owner's scope correction minutes later (Directive 7 below). Local
commits only; Brett approves every push.

## Owner directives (binding)

- **D1 — Lighting first.** Fix the lighting again, before anything
  else. More structures → more shadows; the sun must be **in the
  sky or matching the weather**; **never too dark** — lighting is
  correct, or adjusts, so players can always see. Ruled as THE
  LIGHTING SPEC in §2.
- **D2 — Characters more realistic, more people-like.** Proportions,
  posture, kit — human first, soldier second. (Atlas; §5.)
- **D3 — Landscape more realistic.** Snow is the owner's reference
  for "looking great"; every other landscape comes up to that level
  and beyond. (Atlas; §5.)
- **D4 — More structures and stuff** across the worlds (also feeds
  D1's shadow richness).
- **D5 — Work on everything again.** A full clear-better-version
  pass at the higher standard; nothing is exempt from re-examination.
- **D6 — Time.** At least 2 hours mastering V5: multiple deepening
  passes with measure → refine loops, milestone reports per pass.
  No one-shot declarations of done.
- **D7 — LEVELS ARE DISTINCT MAPS, NOT RE-LIGHTS** (owner
  correction, Oct 24, 2026): *"when changing the levels all it
  really does is change the lighting — I want the entire level
  changed, different landscape entirely."* The owner is correct:
  the four V4 biomes dress ONE shared compound course (same
  solids/layout, different lighting/props). Ruled as the DISTINCT
  MAPS programme in §3.

**On the V4 lighting lock:** Board 004 §7 locked the Phase 2 dusk
grade (hemisphere 0.95, sun 1.85 @ ~10° elevation, exposure 1.10)
as improve-only. **D1 supersedes that lock by the owner's own
order** — the grade is reopened. What carries forward is the
lock's INTENT, hardened into the floor in §2.3: readability,
never darker, enemies readable in shadow. The V4 grade's measured
shadow brightness becomes the numeric floor no V5 profile may
fall below.

## 2. THE LIGHTING SPEC — RULED (Prism + Forge; Verity sign-off; Odin measures)

### 2.1 The coherence rule

Per map, **sky, sun, fog and light tell ONE story**. A single
weather profile per map drives every element from one data table
(`js/lighting.js`, Coordinator-owned): sun direction/colour/
intensity, hemisphere colours/intensity, fog colour + range,
background, sky-dome gradient, sun disc + glow, star visibility,
renderer exposure. The visible sun disc sits exactly where the
light comes from (one shared sun vector — the V3 discipline,
kept). No element may be tuned in isolation ever again: a change
to any profile value re-runs the §2.4 acceptance tests.

### 2.2 Weather profiles — RULED

| Map | Weather story | Sun elev. | Sun | Hemisphere | Fog |
| --- | --- | --- | --- | --- | --- |
| **Compound** | Clear late morning | 38° | 0xffeecf @ 2.6 | 0xbfd6e8 / 0x8a7a63 @ 1.05 | 0xcfdde8, 42–220 |
| **Forest** | Canopy morning | 36° | 0xfff0d6 @ 2.5 | 0xbcd8c8 / 0x5d6b45 @ 1.00 | 0xc3d5c0, 42–200 |
| **Snow Station** | Bright overcast (weather-matched) | 45° | 0xf4f7fa @ 1.35, diffused | 0xe8eef2 / 0xdfe8ee @ 1.25 | 0xe6edf2, 42–210 |
| **Mars Uplink** | Butterscotch midday | 42° | 0xffe9c4 @ 2.4 | 0xd9a06b / 0x7a4a2e @ 1.00 | 0x9a5f36, 42–200 |

- The setting sun is gone everywhere: minimum elevation 36° in
  every profile — the sun is **in the sky**.
- Snow is the weather-matched case the owner named: an overcast
  sky means a weak, diffuse key light and a dominant hemisphere
  (the overcast signature: sun ≤ 1.6 AND hemisphere ≥ 1.15) —
  soft, shallow shadows and the brightest shadow floor of any
  map, which is what snow glare actually looks like.
- Mars fog colour in the profile is exactly Atlas's dressing
  value (0x9a5f36) so profile and dressing never fight. Mars's
  sun lives in Atlas's dome painting, so the profile HIDES the
  disc/glow meshes on Mars (`disc: false`) — one sun per sky.
  (Coordination note to Atlas: repaint the dome sun at the 42°
  elevation family in the Mars map pass; non-blocking.)
- Stars: hidden in every V5 profile (daytime skies). The star
  field mesh stays in the rig for future night work.
- Per-profile exposure: compound 1.10, forest 1.08, snow 1.08,
  mars 1.06 — inside the ruled band [1.0, 1.15], folded into the
  floor test (§2.3) so no profile can buy brightness on paper
  and lose it in the tonemapper.

### 2.3 The NEVER-TOO-DARK floor — quantified

The V3 Phase 1 failure was shadow crush: surfaces in shadow went
unreadable. In this renderer a shadowed surface is lit by the
hemisphere light alone, so the floor is a hemisphere-luminance
proxy, computable headlessly from the profile table:

```
lum(hex)        = 0.2126·r + 0.7152·g + 0.0722·b   (sRGB 0..1)
mixLum(profile) = lum(per-channel average of hemi sky + ground)
shadowProxy     = hemiIntensity × min( lum(hemiSky), mixLum )
effectiveProxy  = shadowProxy × (exposure / 1.10)
```

**FLOOR: effectiveProxy ≥ 0.36 for every profile** — the exact
value of the V4 Phase-2 grade Brett playtest-passed
(hemi 0x8296bd/0x3a2a20 @ 0.95, exposure 1.10 → proxy 0.360).
Ruled profile values measure: compound 0.688 (1.9× floor),
forest 0.597 (1.7×), snow 1.125 (3.1×), mars 0.473 (1.3×). [Correction, Coordinator: the forest/snow figures first printed here were hand-computed; the values above are the code-computed effectiveProxies from js/lighting.js, and Odin's scene-extraction audit (0ea9f22) independently matched the shipped tables to 4 decimals.]
The formula ships in `js/lighting.js`; the smoke L-suite (§2.5)
recomputes it from the shipped table — the floor cannot drift
silently. Two supporting floors stand unchanged: fog near ≥ 42
(the 40 m readability floor) and the bot emissive floor
0x180505 in `js/bots.js` (enemies never crush to black, even
inside a building shadow).

**Acceptance test (the floor, stated as Brett will judge it):**
in every map, a hostile standing in the deepest structure
shadow on the map is identifiable — faction rig colour and
silhouette readable — at 40 m. The proxy + fog/emissive floors
are the headless guarantee; Brett's playtest is the court.

### 2.4 Shadow richness — RULED

More structures (D4) only read as realism if their shadows land:

- Shadow map **4096** at quality L0/L1 (was 2048), 2048 at L2,
  off at L3 — the quality scaler stays the safety valve; only
  its tier sizes change (one scoped Coordinator edit to
  `js/quality.js`, scaler logic untouched).
- Shadow camera fits the map: ortho half-extent comes from the
  profile (compound 72, others 68 — covers the ±62 ring plus a
  13.6 m tower's ~17 m shadow throw at 38°), near 1, far 300,
  bias −0.0002, normalBias 0.5 (acne control at map scale).
- Caster discipline (spec to Atlas, his files): every structure
  mesh casts; **soldier meshes cast** (grounded figures, moving
  shadows sell people); instanced vegetation keeps casting.
- Softness honesty: PCFSoft stays; at 4096 over ~144 m a texel
  is ~3.5 cm — shadows will be defined, not mushy. No fake blur.

### 2.5 Acceptance tests — smoke L-suite (Coordinator lands; Odin re-runs)

- **L1** A complete profile exists for all 4 map ids.
- **L2** effectiveProxy ≥ 0.36 for every profile (recomputed
  from the shipped table by the shipped formula).
- **L3** Coherence: fog near ≥ 42, far ≥ 190; fog colour ==
  profile horizon colour == profile background.
- **L4** Sun elevation inside the ruled band per map
  (compound 34–44°, forest 32–42°, snow 40–50° + overcast
  signature, mars 36–48°).
- **L5** Wiring: world.js names the rig (sun-light, hemi-light,
  sun-disc, sun-glow, star-field) and the dusk grade literals
  are gone; main.js imports and applies `applyLightingProfile`.
- **L6** Shadow pins: 4096 present in main.js + quality tiers.
- **L7** Bot emissive floor pin (0x180505) intact in bots.js.

## 3. DISTINCT MAPS — RULED (Vista + Terra + Mason; Uplink for sim; Odin for budgets)

The owner is right about V4: one course, four dressings. V5
makes each level a place of its own.

### 3.1 The ruling

- **Each level = a distinct map**: its own layout, terrain
  character, structures, spawn set, and mode zones. The compound
  course (decks, rooftop, ruin line, Relay Tower ring) belongs
  to the **Compound** level ONLY.
- Map ids are unchanged (compound / forest / snow / mars) — the
  menu, profiles and saves keep their keys; what changes is
  what an id MEANS: a place, not a paint job.
- **Forest** becomes a forest map: terrain-led layout, the
  fallen relay mast as its landmark, cover from terrain and
  timber structures — not crates on the compound floor.
- **Snow Station** becomes a station map: the buried dome is
  the centre of a station layout (outbuildings, ice-field
  approaches), not dressing on the compound.
- **Mars Uplink** becomes an uplink map: crater + spire in a
  layout built around them (mesa lanes, regolith fields).
- Each map authors its own Domination A/B/C and Relay Assault
  target from its own landmarks (Atlas authors; Havoc checks
  pacing per map — sightlines change balance).

### 3.2 Architecture + contracts

- **Per-map worlddata.** One data module per map exporting the
  established shape (SOLIDS / EXTRA / BOUNDS / spawns /
  MODE_ZONES / ASSAULT_TARGET / PICKUP_CACHES / TRANSMISSIONS),
  values transcribed from that map's build exactly as the
  compound's were. The compound's data is today's
  `js/worlddata.js`, values unchanged — it becomes the Compound
  map's data, not the world's.
- **Map registry (Coordinator owns `js/maps.js`).** MAPS table:
  id, display name, layout status, worlddata key, lighting
  profile id. `getMapData(mapId)` is the single selection point
  for client and (per §3.3) sim. Menu selection flows through
  the registry; the selector's visible label becomes LEVEL
  (the `biome-select` id is pinned by smoke M9 and stays).
- **Solo plumbing (Coordinator).** Selecting a level rebuilds
  the scene content for that map and swaps worlddata in the
  same step — geometry and data can never disagree. Until a
  map's distinct layout lands (§3.4), its registry entry is
  flagged `layout: 'transition'` and it plays the V4 dressing
  behaviour; the V5 report scores each map's status plainly.
  No silent substitutions: a map is 'distinct' in the registry
  only when its own layout + data + gates are all green.
- **Reachability per map.** `tools/reachability.mjs` gains a
  per-map table (spawn→POI routes, stair math under the 0.575
  closed ruling). A map's rows must pass for its registry flag
  to flip. `tools/biome-check.mjs` converts its per-biome
  sections to per-map layout checks as each map lands.
- **Per-map perf budgets (Odin).** The V4 lines apply PER MAP:
  draw calls ≤ 165 (no-culling upper bound), tris ≤ 300k, sim
  tick ≤ 0.5 ms at real caps against that map's worlddata.
  The V4 forest/snow overage is subsumed: their distinct
  layouts budget from zero instead of inheriting compound cost.

### 3.3 Sim contract — spec to Vega (her territory, his build order)

- `hello` gains an optional `map` field (map id string). A
  room's map is fixed by its first hello — the same pattern as
  mode. Unknown map → error `bad_map`, mirroring `bad_mode`.
- The sim loads worlddata by the room's map via the registry
  contract (§3.2) — client and sim can never play different
  geometry. Snapshot shape is unchanged.
- Lands with Vega's V5 mode-brains work (TDM / Domination /
  Relay Assault win-condition state machines — carried V4
  deferral), so online plays the same distinct maps solo does.

### 3.4 Build order for the maps (Atlas)

Forest first (terrain-led, the largest identity change), then
Snow Station, then Mars Uplink. Each lands as: layout build →
worlddata → reachability rows → biome-check conversion →
registry flag flip, all gates green, or the map stays in
transition with the reason in the V5 report (the M-CUT
discipline of Board 004 §1 applies per map).

## 4. Carried V5 scope (from V4 deferrals)

- **Online mode brains** (Vega): sim-side TDM / Domination /
  Relay Assault state machines; online Wave Defense is already
  end-to-end. Lands with §3.3 map carriage.
- **Friendly-bot AI fill**, solo + online (Atlas AI retarget +
  Havoc tiers + Coordinator wiring).
- **Perf reclaim** — folded into §3.2 per-map budgets.

## 5. Characters + landscape bars (Atlas; Havoc verifies feel)

- **People-like test:** a bot at 20 m reads as a PERSON first
  (head/torso/limb proportions, posture, natural stance) and a
  soldier second (kit on a human frame). Hit cores stay as
  shipped — proportions change inside them, not the contract.
- **Landscape test:** each map's terrain has a height story
  (not a flat floor with props), surfaces carry per-map
  material character, and Brett's snow reference — "looking
  great" — is the floor every other map is judged against.
- **Sightline consequence (Havoc):** new structures + higher
  sun change every engagement range. Havoc re-runs the balance
  probe per map after layouts land and re-tunes by the numbers;
  the V4 baseline is the comparison, not the assumption.

## 6. The V5 bars — translated into checkable targets (Apex + Verity + Sixty; Odin verifies)

**REALISTIC** — Verity verdicts, 12 features: V4's ten
re-judged at the V5 standard, plus **lighting coherence** (§2 —
sun/sky/fog/weather agree per map, floor-tested) and **map
identity** (§3 — four places, not four paints). Target:
**≥ 10 of 12 PASS**, with lighting coherence a mandatory PASS
(L-suite green + Brett's verdict). A V4 PASS is not inherited;
it is re-earned.

**POWERFUL** — capability counts, V4 → V5 targets: distinct
layouts 1 → **4** · online modes end-to-end 1 → **4** ·
friendly fill absent → **shipped** · and NO regressions:
modes 4, loadout combinations ≥ 500 (729 shipped), progression
30 levels / 15 unlocks, footprint ≥ 124 m on the Compound.

**SMOOTH** — per map (§3.2): draw calls ≤ 165 upper bound,
tris ≤ 300k, sim ≤ 0.5 ms at real caps, snapshot ≤ 4 KB.
Quality scaler holds L0→L2 steps in Brett's F9 check.

**LIGHTING** (new first-class bar, per D1): L-suite green;
per-profile effectiveProxy table published in the V5 report;
shadow map 4096 shipped; Brett's per-map verdict — "never too
dark" — closes it.

## 7. Build order (passes; milestone report at each pass)

1. Board 005 + charter Directive 7 (Coordinator).
2. Version **0.5.0-dev** — one clean commit: package.json,
   index.html tag, smoke M6/M8 pins move together (Coordinator).
3. **Lighting core** (Coordinator): `js/lighting.js` profiles +
   rig naming in world.js + main.js wiring + §2.4 shadows +
   L-suite. Gates green.
4. **Map plumbing** (Coordinator): `js/maps.js` registry +
   selection flow + LEVEL label; Compound registered distinct
   with today's data.
5. **Distinct maps** (Atlas, §3.4 order) — Coordinator
   integrates each as it lands green.
6. **Online completion** (Vega): mode brains + §3.3 map carriage.
7. **Friendly fill** (Atlas + Havoc + Coordinator).
8. **Re-measure pass** (Havoc per map; Odin verification +
   metrics refresh; Coordinator refines profiles if the numbers
   or Brett's eyes demand it — the D6 refine loop).
9. **V5 report** (Coordinator): scope ledger incl. the D7
   owner correction credited as such, lighting before/after
   with acceptance evidence, bars scored honestly, deferrals
   with owners, Brett's decisions.

## 8. Decisions Brett owns at V5 close

1. **PUSH V5** (the live site keeps serving V4 until he says go).
2. Per-map lighting verdicts (the acceptance test of §2.3).
3. Carried V4 items still his: §10.1 ratification, Havoc's 5
   taste questions, DMR-nest / north-corridor / corner-spawn
   verdicts, F9 readings.

Signed: Apex (chair), Vault, Verity, Forge, Prism, Uplink,
Lockdown, Vista, Terra, Mason, Sixty, Budget, Sentry.

---

## ADDENDUM — Owner additions D8–D11 (Oct 24, 2026, post-ruling)

Four further owner directives landed minutes into the build.
They are ruled here so the build order in §7 absorbs them
without re-opening the settled sections. Owner's doctrine for
D11, recorded verbatim in spirit: *borrow proven systems from
Call of Duty and other shooters now; later versions diverge
into Over n' Out's own identity* — the Meridian/Relay fiction,
transmissions and prestige titles already are that identity.

## 9. Smoke grenades (D8) — RULED (Trigger + Ballistic; Havoc numbers; Odin perf)

- **The tactical slot becomes a CHOICE:** per class,
  `tactical ∈ {flash, smoke}` in `js/loadouts.js` (THROWABLES
  gains smoke; `validateLoadout` accepts both). HUD/count rules
  mirror flash exactly: 1 tactical per life, refilled on
  redeploy and wave clear; gear HUD shows `SMOKE [T] ×1`.
- **Smoke is a system, not a sprite.** Shared state (client
  solo + sim): `smokes: [{x, y, z, r, bornAt, fullAt,
  expiresAt}]`. A sightline is BLOCKED when the segment passes
  within the smoke's current effective radius of its centre
  during its full-density phase; bloom/fade phases scale the
  effective radius linearly (deterministic — same rule both
  sides of the wire). Bullets pass through smoke; only VISION
  is blocked. What that buys, honestly: bot perception
  (`losClear` in the sim; the mirrored check client-side)
  fails through smoke, so bots lose targets — crossing open
  ground, breaking a nest's lane, and covering a Relay Assault
  channel are real plays, not theatre. The channel still needs
  a body on it; smoke hides the body from bot eyes.
- **Interim numbers (Coordinator assumptions, flagged for
  Havoc to rule over):** 0.8 s post-throw delay, 1.2 s bloom to
  full, radius 4.5 m, 12 s full duration, 2 s fade.
- **Sim carriage (spec to Vega):** the sim owns active smokes;
  its LOS test consults them for bot perception AND for
  player-shot adjudication of bot visibility events. Smoke
  state rides snapshots compactly (position + phase), never
  per-particle.
- **Client visual (Odin-priced):** ONE global instanced pool
  (256 soft billboards) renders ALL active smokes — **+1 draw
  call total**, pooled, no per-smoke meshes. Density is
  visual-only; the blocking truth is the state above, so a
  thin-looking edge still blocks exactly as the sim says.

## 10. Enhanced customization (D9) — RULED (exact list; Atlas variants; Havoc ladder)

- **Camo patterns — 6, procedural, zero draw-call delta**
  (palette/canvas-pattern swaps on existing materials):
  `woodland` (default, the V4 discipline), `desert`, `arctic`,
  `urban`, `nightops`, `meridian` (faction crimson/gold).
  Each exists as a WEAPON camo and a CHARACTER camo (Atlas
  authors the palette variants on his soldier system; the
  player's viewmodel arms follow character camo — Coordinator
  wiring). **Faction readability is never overridden:** rig /
  visor faction colours stay as shipped regardless of camo;
  camo dresses the cloth and the gun, not the IFF signals.
- **Unlock lane:** camos are PRESTIGE-track cosmetics (zero
  power, per the L19–30 rule). Coordinator proposal for
  Havoc's ladder ruling: desert L20, arctic L22, urban L24,
  nightops L26, meridian L29, interleaved with the shipped
  titles/tints — Havoc owns the final table.
- **Profile + UI:** `profile.camo = { weapon, character }`
  (global per profile — identity, not per-class; per-class
  camo is a V5.1 consideration). Menu pickers show lock state
  from the prestige track. Online: `hello` carries both ids;
  the server validates against the camo table (unknown →
  default) and puppets wear the owner's character camo.
- **Attachments +3** (power track; multiplier sidegrades; the
  guardrail stands — nothing touches `damage`, worst stack
  ≤ +10%): `angled foregrip` (underbarrel: adsTime ×0.85,
  hipSpread ×1.10) · `compensator` (barrel: recoil ×0.88,
  bloomRate ×1.08) · `padded stock` (stock: adsMove ×1.15,
  adsTime ×1.08). Numbers are Coordinator proposals; Havoc
  rules finals. Attachment count 11 → 14; the combinations
  figure is recomputed in the V5 report.

## 11. Equipment + UAV (D10) — RULED (Coordinator systems; Vega server truth)

- **The lethal slot becomes a CHOICE:** per class,
  `lethal ∈ {frag, claymore, tripmine}`; 1 lethal per life,
  as today. Shared DOM-free module **`js/equipment.js`**
  (Coordinator): the EQUIPMENT table + pure placement/trigger
  logic, consumed by the client and mirrored by the sim —
  the weapons/modes parity discipline.
- **CLAYMORE:** placed on a flat surface (ground or deck top,
  not walls/stairs), facing = placement yaw. Arms in 1.0 s.
  Trigger: a hostile enters the 60° cone, 0.5–6 m, with LOS
  to the device's front. Damage 130 at centre → 30 at cone
  edge. HP 20.
- **TRIP MINE:** placed on a flat surface; projects its beam
  horizontally along facing to the first solid, max 8 m.
  Arms in 1.2 s. Trigger: a hostile crosses the beam
  (≤ 0.4 m, torso band 0.3–1.6 m). Damage 110 centre, 3.5 m
  spherical falloff (the small-frag model). HP 20.
- **Readability — no invisible deaths (owner's rule):** the
  claymore body is full-size with a blinking red LED (1.5 s
  cadence) and a marked front face; the trip beam is VISIBLE
  (thin red line, soft pulse). A careful player can spot,
  avoid, or destroy both. Destroyed-by-gunfire equipment does
  NOT detonate (counter-play is rewarded); explosions in
  radius DO chain-detonate enemy equipment. Owner hears a cue
  on trigger/destroy. Triggers are hostile-only; blast obeys
  the frag player rule (players ×0.45, incl. the owner).
- **Placement input:** the lethal key places instead of
  throws when the class lethal is a device (same input edge
  online — Vega carries the placement yaw in the lethal
  event). Placed state persists per match in world state,
  client + sim; devices are snapshot-carried by id.
- **UAV — scorestreak #1 (see §12 for the ladder).** Interim
  threshold 500 streak score (Havoc rules). On activation, a
  sweep runs 12 s: every 2.5 s a ping reveals every hostile's
  position to the owner's HUD as a world-space diamond marker
  (screen-clamped at edges; markers ignore walls — that is
  the UAV's job) plus an audible ping cadence. An actual
  drone model flies the circuit overhead (Atlas) — the
  fiction is physical. Online truth is the server's: during a
  sweep the server includes hostile positions ONLY in the
  owner's snapshot events (anti-cheat shape: nobody else
  receives them). **Smoke does NOT block UAV** — radar is not
  eyes; the counter-play triangle stays clean: smoke beats
  vision, Ghost (§12) beats UAV, Counter-UAV beats sweeps.
- **Minimap: RULED OUT of V5.** No minimap exists today;
  building one is a HUD system of its own. Markers ship;
  minimap is a named V5.1 deferral (owner: Coordinator +
  Lens seat; Odin prices it when scoped).

## 12. Perks + scorestreaks (D11) — RULED (Coordinator systems; Havoc every number)

### 12.1 Perks — ONE slot per class for V5

Conservative start, per the owner's framing: **one perk per
class** (`class.perk ∈ PERKS ∪ {null}`; validated, persisted,
server-checked in `hello`). Tiered 3-slot is the CoD-classic
stretch — deferred to V5.1 with an owner (Coordinator), not
silently absorbed. **No placebo rule:** a perk ships only if
it hooks a real system in the shared stats path (client + sim
identical numbers from `js/loadouts.js`).

| Perk | Hook (real system) | Ruled effect (Havoc tunes) | Status |
| --- | --- | --- | --- |
| **Lightweight** | movement model | sprint speed ×1.08, sprint-to-fire ×0.75 | **IN** |
| **Scavenger** | pickup system | kills drop an ammo pack; walk-over restores 30% reserve | **IN** |
| **Ghost** | UAV sweeps (§11) | carrier never appears on enemy sweep markers | **IN** (online/UAV-facing; menu says so plainly) |
| **Flak Jacket** | explosive damage path | explosive damage taken ×0.55 (frag/clay/trip/barrel) | **IN** |
| **Fast Hands** | reload/swap/place timers | reload ×0.80, swap ×0.70, place ×0.60 | **IN** |
| **Awareness** | bot perception | no honest hook exists yet — a HUD system, not a stat | **DEFERRED V5.1** (owner: Coordinator + Ghost seat) |

### 12.2 Scorestreak ladder — fixed order for V5

Streak score feeds from kills + objective events (the
XP_VALUES sources; Havoc aligns the two economies) and
**resets on death — classic, affirmed with reasons:** streaks
price as skill rewards, and sweeps stay rare enough to
matter. Each earned streak is usable once per life; key **X**
activates the next earned, unused streak. Selectable streak
loadouts are a V5.1 consideration (owner: Coordinator).

| # | Streak | Threshold (Havoc rules) | Effect | Status |
| --- | --- | --- | --- | --- |
| 1 | **UAV** | 500 | §11 sweep + drone | **IN** |
| 2 | **Counter-UAV** | 650 | 20 s: enemy sweeps return nothing for your team AND hostile bot perception accumulates ×0.75 (sensor jam — the sim's perception IS the sensor model) | **IN** |
| 3 | **Care Package** | 800 | flare-marked drop lands at nearest valid ground ≤ 6 m: full ammo + health pack + throwable refill (the pickup system, delivered) | **IN** |
| 4 | **Sentry Gun** | — | placeable auto-turret | **DEFERRED V5.1** (owner: Coordinator + Ghost seat — biggest build; D10's placed-object plumbing proves first) |
| 5 | **Precision Strike** | — | called-lane area denial | **DEFERRED V5.1** (owner: Havoc — needs targeting UI + denial balance) |

Online, streak state is server truth (Vega): the input
message gains an optional `streak` edge; the sim validates
score, unused state and life state before anything fires.

## 13. Build-order amendment (supersedes §7 where they differ)

Schema first, so Vega's validator never chases a moving
target: **(a)** loadouts schema widening — tactical choice
(§9), lethal choice (§11), perk slot (§12.1), +3 attachments
(§10), camo table (§10) — lands as ONE early Coordinator
commit, flagged in its message for Vega + Havoc; **(b)**
smoke system; **(c)** equipment system (`js/equipment.js` +
client/sim plumbing); **(d)** streak state + UAV/Counter-UAV/
Care Package; **(e)** customization plumbing (profile.camo,
pickers, hello carriage; Atlas's variants land in his pass).
Steps 3–8 of §7 stand; these insert as step 3b–3e, after the
lighting core (D1 remains first) and alongside map plumbing.

Signed for the addendum: Apex (chair), Verity, Trigger,
Ballistic, Uplink, Lockdown, Ledger, Budget, Sentry.

---

## ADDENDUM 2 — The world-presence standard (owner clarification on D11, Oct 24, 2026)

The owner's execution standard, recorded as the board's rule
for every streak from here on: *"with those scorestreaks means
we have to add those things as well — a UAV scorestreak needs
an actually flying [UAV] and so on and so on."* **No streak is
a HUD effect with a name. If it isn't in the world — physical,
simulated, counterable — it isn't in the game.** Each ruled-in
streak carries a world-presence spec below. The owner also
re-confirmed the D6 time standard (≥ 2 hours, multi-pass) in
the same message; it stands as ordered.

### UAV drone — world-presence spec (Atlas builds; Vega carries; Havoc numbers)

- **Physical form:** a quad-rotor drone, procedural (~10 merged
  parts + rotor blur disc, 1–2 draw calls), team-coloured nav
  lights (white strobe + red port light, 1 s blink) — visible
  against the V5 daytime skies by design. It is a fair target,
  not a hidden one.
- **Where / how it moves:** on activation it launches from the
  owner's position, climbs to a **28 m loiter orbit** over the
  map centre (radius ~35 m, ~14 m/s, banked turns), and flies
  the circuit for the sweep's 12 s, then departs and despawns.
  The flight path is a deterministic function of sim time
  (phase from the activation tick) — **the sim owns the truth**;
  snapshots carry `uav: {active, x, y, z}` and clients render
  the model at the carried position, interpolated like any
  puppet. Solo runs the same function locally.
- **Destructible — RULED IN** (Havoc's numbers): **HP 60**,
  a normal hitscan target in world state. Destroyed → the
  sweep ends immediately, the wreck falls and despawns on
  impact. The counter-play is now threefold, all real:
  **Ghost** (never appear), **Counter-UAV** (jam the feed),
  **shoot it down** (end it for everyone).
- **Sound:** rotor hum on the existing distance-audio model —
  you can hear a sweep overhead before you see the markers.

### Counter-UAV — world-presence spec

- **Physical form:** a second drone airframe, visually
  distinct (amber strobes, darker body), launched the same
  way, loitering higher (**34 m**) on an opposite-phase
  circuit for its 20 s. While it flies, its jammer is
  whole-map — stated plainly, and that is exactly why it is
  **destructible too (HP 60)**: shooting it down ends the jam
  early. Effect per §12.2 (enemy sweeps blind + hostile bot
  perception ×0.75) applies only while the airframe lives.

### Care Package — world-presence spec

- **Physical form:** a supply drone (the UAV airframe with a
  slung crate) flies in from the map edge at 20 m to the
  flare-marked point, releases the crate from ~8 m; the crate
  falls, lands with team-coloured flare smoke, and sits in the
  world as a real object for 45 s. Contents per §12.2 (ammo +
  health + throwable refill).
- **Contested, honestly:** ANY player can take the contents;
  the crate has HP 40 and can be destroyed (contents lost).
  The owner's team gets a HUD marker on it — the enemy just
  gets eyes. A package is a fight waiting to happen, which is
  the point of dropping one.

### Deferred streaks — presence notes for V5.1

- **Sentry Gun:** a placed physical turret (the D10 equipment
  plumbing is its foundation) — when it lands, it lands as an
  object with a body, a sensor arc and HP, never as a stat.
- **Precision Strike:** a called aircraft pass over a marked
  lane — a plane model, a visible run-in, a dodgeable window;
  the delay between call and impact is its counter-play.

Signed for Addendum 2: Apex (chair), Verity, Uplink, Vista,
Ledger, Ballistic, Sentry.

---

## ADDENDUM 3 — Ratification of Havoc's numbers ruling (Oct 24, 2026)

Havoc's `docs/sessions/v5-equipment-and-streaks-ruling.md` is
**RATIFIED** as the governing numbers/design package for
D8–D11. Where §§9–12 above (Coordinator's interim rulings)
differ, HAVOC'S RULING SUPERSEDES — the V4 discipline: the
Gameplay Director owns the numbers; coordinator assumptions
were flagged as provisional for exactly this moment. The
supersessions, on the record:

- **Smoke:** the LOS rule is Havoc's THREE-STATE chord test
  (blocked: ≥1.5 m chord through the r3.0 core, or ≥5 m total;
  partial: 2–5 m outer band, bot acquisition ×0.4; inside the
  cloud, sightlines beyond 3 m blocked) — not §9's binary
  radius test. Bloom 1.2 s, full density 12 s, tail 3 s.
  Flash-behind-smoke does not blind (geometry, not an
  interaction). Smoke grants no Domination capture presence.
- **Claymore:** range 7 m (not 6), arm 0.8 s, trigger delay
  0.15 s, edge falloff to 40 with outer-cone ×0.6. Flash does
  NOT clear placed equipment (sensors, not eyes) — ruled no
  with reasons; §11's generic wording is narrowed to match.
- **Trip mine:** beam 4 m at 0.6 m height (not 8 m torso
  band), delay 0.25 s, damage 100→30 from the device.
  Counters are jump (feet > 0.75 m at crossing) and
  sprint-through; there is NO crouch in this game and none
  is implied. Smoke does not block the beam.
- **Streak meter:** death does **NOT** reset it (§12.2's
  classic reset is superseded) — it is a scorestreak:
  XP_VALUES feed it (streak XP bonuses excluded), the player
  SELECTS 3 streaks in the loadout, the meter spends on call,
  one active instance per type. Thresholds: UAV **500** ·
  Counter-UAV **650** · Care Package **800** · Sentry
  **1,050** · Precision Strike **1,300**.
- **UAV:** 24 s sweep (not 12), ping 3 s, markers linger
  1.2 s, circuit r30 at 28 m / 14 m/s, **HP 150** (not 60 —
  priced in shots: ~6 AR / 3 DMR body hits; a one-bullet
  drone would be worthless, an unkillable one would make
  Ghost mandatory). Shooting it down pays the shooter 75 XP.
- **Counter-UAV:** Havoc's EFFECT stands verbatim (20 s of
  marker denial; does not harm the drone; does not touch
  bot perception — §12.2's sensor-jam addition is RETRACTED).
  Per Addendum 2's world-presence standard it still flies as
  a physical airframe (amber strobes, 34 m, opposite phase),
  HP 150 like its sibling; destroying it ends the denial
  early. Presence is the owner's rule; the effect is Havoc's.
- **Care Package:** crate HP 60, fall ≈6 s from 30 m, claim =
  1.5 s channel by ANY player; contents = full resupply PLUS
  a rolled streak (UAV 50% / Counter-UAV 30% / Sentry 20%).
- **Sentry + Precision Strike: IN for V5** (reversing §12.2's
  deferrals on the strength of Havoc's designs — the sentry
  is the bots' own perception/AR model standing still, not a
  new AI; the strike is a warning + sky-exposure raycast).
  Build order UAV → Counter-UAV → Package → Sentry →
  Precision; if a gate forces a cut, **Precision Strike is
  the named M-CUT candidate** (owner: Havoc), decided in the
  open, never silently.
- **Perks: TIERED 3** (one per category — MOVEMENT / DEFENSE
  / UTILITY), superseding §12.1's one-slot start, on Havoc's
  power-budget argument (orthogonal axes, category locks are
  the stack-safety). The catalog is his 8: Lightweight,
  Stalker, Flak Jacket, Shade, Ghost (HALVED exposure —
  alternate pings, 0.6 s linger; not §11's full immunity),
  Cold-Blooded, Engineer, Scavenger (dropped pack, one mag,
  ammo only — no throwable refill, ever). Fast Hands is NOT
  in the catalog and does not ship. His 8 written placebo
  kills (Dead Silence, Toughness, Fast Regen, Penetration,
  Melee, Fall, Stamina, permanent jammer) are adopted as
  board law: **a system that doesn't exist can't be buffed.**
- **Perk unlock rungs (Coordinator's call, Havoc's frame:**
  sprinkle L2–L18): L3 Lightweight · L5 Flak Jacket ·
  L7 Ghost · L9 Stalker · L11 Shade · L13 Cold-Blooded ·
  L15 Engineer · L17 Scavenger.
- **Placement law (Havoc §8):** 1-active cap on placed
  lethals, 8 m spawn-exclusion, arm/trigger delays as ruled.
- **Camo vocabulary:** the single source is Atlas's landed
  `js/camo.js` — CAMO_IDS {woodland, arctic, desert, urban,
  night}, default woodland (§10's 'nightops' is his 'night').
  'Meridian' joins when Atlas lands it as the prestige
  capstone; validation reads camo.js, so it self-enrolls.
  Loadouts' camo field is per-CLASS (as Vega's scaffolding
  already shaped it), not per-profile — §10 is amended:
  simpler, and it makes online puppets per-class correct.
- **Smoke visual:** Odin's audit priced a per-volume sprite
  design at 13 calls/volume (52 at 4 active). §9's ruling
  already answers it: ONE global instanced pool, +1 draw
  call total, is the shipped architecture — the audit's cap
  filing is satisfied by the ruling, and Atlas's smoke
  workstream builds to the pool spec, not per-volume sprites.
- **Sightline flags (Havoc recheck §5):** R2 — Coordinator
  publishes fixed team spawn sets per mode as data and
  verifies them against the audit table (tower-visible set
  [S2 S3 S5 S6 S7 S9 S10]); R4 — Relay Assault attacker
  staging comes from the tower-UNSEEN set [S0 S1 S4 S8 S11].
  Both land with the maps/modes plumbing (§7 step 4) and are
  re-run per map by Havoc's Pass 2 protocol.

Signed for Addendum 3: Apex (chair), Verity, Ballistic
(Havoc's desk), Uplink, Ledger, Sentry — Coordinator records.
