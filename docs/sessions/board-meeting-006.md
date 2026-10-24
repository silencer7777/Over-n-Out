# Board Meeting 006 — V6 Scope Ruling (Detail Bars, Instancing Strategy, Mobile Track)

Convened: Oct 24, 2026. Chair: Dominic "Apex" Cross. Present:
Coordinator, Atlas (graphics realism lead), Odin (Chief Engineer,
perf veto armed). Vega on call (respawned as mobile owner under
Directive V6-2 — see Addendum A); Havoc on call. Called by the
owner's V6 green-light minutes after V5 went live. Local commits
only; Brett approves every push.

## Owner directives (binding)

- **V6-1 — "A better version of 5."** V6 is a long-cycle polish
  version: graphics-first, **minimum 20 updates** before V7 may be
  proposed (ledger: `docs/sessions/v6-update-ledger.md`). The loop
  is build → gates → Brett playtests → feedback → next update.
- **V6-1a — The complaint and the bar.** Graphics are *"pretty
  blocky"*; the owner wants **smoothness and realness**: *"trees
  like trees, buildings like actual buildings… detailed enough to
  look like the real thing,"* graphics *"par and then some."* §2
  translates this into checkable bars.
- **V6-1b — LIGHTING IS LOCKED.** The owner's playtest verdict on
  live V5: lighting is *"way better already and is probably
  perfect."* No V6 work touches the lighting system, profiles or
  grades. This lock is a PLAY verdict — it supersedes every
  metric-only lock before it. Only a Brett-reported lighting
  problem unlocks it.
- **V6-1c — No new gameplay systems.** No modes, weapons, perks,
  streaks or maps. V5 maintenance items (online snapshot rendering,
  bots.js lane-reset parity, per-mode end soaks) may be scheduled
  between graphics updates and never displace them.
- **Standing law carried in full:** hit cores byte-identical;
  procedural assets only; zero new dependencies; sustained draw
  calls ≤ 165/map (Odin's veto); local `v6(<area>):` commits only.

## 2. THE DETAIL BARS — RULED (Atlas builds, Odin measures, Verity's eye is Brett's at playtest)

"Par and then some" is not a bar until it is checkable. Each bar
below is a predicate Odin's harness (`tools/v6-metrics.mjs`) either
already measures or is extended to measure in the V6 baseline;
where a threshold is marked *(strike)*, Odin's v6-metrics doc
publishes the number and this board ratifies it by Addendum 1 if
it differs from the draft here.

### 2.1 Vegetation (Update 1, headline)

- Every tree on a shipping map is a **tapered trunk** (≥ 2 distinct
  radii along its height, smooth-shaded, procedural bark texture)
  carrying **≥ 3 foliage masses** — jittered, irregular canopy
  blobs at varied offsets/scales; no single-ball canopies remain.
- Foliage material carries a **procedural texture with alpha
  variation**; no flat-color foliage material ships on
  Compound/Forest after Update 1 (all four maps after Update 2).
- **Per-instance color variation** (instanceColor or equivalent)
  on 100% of instanced vegetation — no two adjacent trees read as
  clones.
- Counts may rise, calls may not: Forest holds **≥ 110 trees**;
  vegetation draw calls per map stay within the §3 strategy.
- Collision truth unchanged: trunk positions/radii byte-identical
  in worlddata; canopy is visual only.

### 2.2 Buildings & structures (Update 1)

- **Zero naked boxes** on Compound/Forest: every structure carries
  **≥ 4 architecture cues** from {roofline/overhang, trim, door,
  window grid, parapet, panel seams} and **beveled edges** on its
  primary volumes.
- Window grids carry **per-window emissive variation** (materials
  only — the locked lighting grade is untouched).
- ≥ 3 procedural facade materials in use across the two maps
  (concrete / brick / metal panel), canvas-generated like all
  studio assets.
- Solids/colliders byte-identical — this is a visual rebuild over
  the same gameplay truth.

### 2.3 Terrain & ground (Update 3, bars set now)

- Ground reads **smooth-shaded** at play distance — no faceted
  low-poly read; undulation comes from geometry + normals, not
  from flat-shaded triangles.
- **≥ 3 blended ground materials per map** (from asphalt /
  concrete / grass / dirt / snow / rock as the map's fiction
  dictates), with edge wear at material boundaries.
- Scatter (rocks, tufts, debris) exists on every map and is
  **instanced** — scatter is bought by the §3 strategy, never by
  raw meshes.

### 2.4 Soldiers & guns (Update 4, bars set now)

- The part-kit read dies: limbs and kit are **rounded/blended
  forms** (capsule/sphere-blended), fabric-ish texture variation
  on uniforms, smooth shading throughout.
- **Hit cores byte-identical** — proven by the same audit method
  as V5 (cores compared byte-for-byte before/after), and the
  per-bot budget holds: **≤ 7 calls per bot**, camo matrix delta
  stays 0 (V5 proof reruns).

### 2.5 Materials & finish (Update 5, bars set now)

- Procedural canvas textures on **all primary surfaces**; no
  large flat-color surface (> *(strike)* m²) survives on any map.
- Texture atlasing where it cuts material count; anisotropy at
  the renderer's practical max for ground textures.
- Per-instance color variation audited across ALL instanced sets,
  not just vegetation.

### 2.6 Smoothness — the perf bars (Odin, veto armed)

- **Sustained draw calls ≤ 165 per map** (no-culling bound, the
  V5 convention) — VETO.
- **Sustained tris ≤ 300k per map** — VETO, held at the V5 line
  unless Odin's baseline publishes evidence for a different
  number, ratified by addendum.
- Shadow-pass estimates are published per map with every update
  (casters render twice; detail growth is priced there first).
- The final court is **Brett's F9 readings on his own hardware**
  during playtest — headless numbers earn the update a playtest,
  they do not pass it.

## 3. THE INSTANCING / MERGING STRATEGY — RULED

Detail is bought with structure, never with draw calls:

1. **InstancedMesh** for every repeated scatter family (trees,
   bushes, rocks, tufts, debris, props): one call per family per
   map, per-instance color via instanceColor.
2. **Merged static geometry per material** for structures: a
   building's same-material parts land as one mesh; facade detail
   comes from texture + merged trim geometry, not mesh count.
3. **Texture atlasing** to collapse material count before any new
   material is admitted.
4. **The offset rule:** no update may add a net draw call to a map
   without naming its offset (a merge or instancing conversion in
   the same update) in its ledger entry.
5. **LOD is the last resort**, admitted only where instancing and
   merging cannot hold the line, and minuted when used.

## 4. Cadence

Update 1 (vegetation + buildings, Compound & Forest) is the
highest-visibility pass and lands first (charter cadence note).
Snow/Mars parity is Update 2. The ledger
(`docs/sessions/v6-update-ledger.md`) is the living record; each
landing appends its metrics and Brett's playtest verdict when it
arrives.

## Addendum A — Directive V6-2: MOBILE TRACK (owner order, Oct 24, 2026)

Owner: *"make it so I can instantly play on mobile… I want it to
be for web and mobile."* Ruled: **one build, both platforms** —
the same GitHub Pages URL plays on desktop and phone; no install,
no separate app, no mobile-only pivot.

- **Owner: Vega.** New module `js/touchcontrols.js` preferred
  (touch input feeding the same input state as keyboard/mouse;
  pointer lock skipped on touch) + responsive menus/HUD (≥ 44px
  targets, safe-area insets, touch-action none, orientation/resize
  handling, WebAudio unlock on first tap). Desktop path untouched.
- **Milestone M1:** solo fully playable on Brett's **iPhone 17 Pro
  in Safari** — open link → move/look/shoot/jump/ADS/reload/switch
  → complete a wave/match. Tracked as first-class entries in the
  update ledger (M-series); mobile milestones do not substitute
  for graphics updates.
- **Sequencing:** Vega's surfaces (input, HUD, small `main.js`
  hooks) are disjoint from Atlas's (world assets). Landings are
  sequenced by the Coordinator, who **owns any `js/main.js`
  merge** between the two.
- **Mobile perf bar (Odin to strike in v6-metrics; interim bar
  ruled here from the charter):** devicePixelRatio cap **≤ 2**;
  lower starting quality tier on mobile GPUs; **shadow-map size
  is a render-resolution knob only** — sizes may drop on mobile,
  the locked lighting GRADE, profiles and floors do not change.
  Odin publishes the measured mobile target (sustained calls /
  quality tier) with the V6 baseline; a delta from this interim
  bar is ratified by Addendum 1.

## Sign-off

Board 006 rules the V6 bars as above. Atlas builds Update 1
against §2.1/§2.2; Odin's v6-metrics baseline + struck thresholds
land as the measurement companion to this ruling; Vega builds M1
against Addendum A. The Coordinator integrates, keeps the tree
green, and writes each update's report. Nothing pushes without
Brett's tap.
