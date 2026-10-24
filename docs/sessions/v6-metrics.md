# V6 Metrics — the V5 graphics baseline, the bars, and the patrol log

**Author:** Odin, Chief Engineer. **Instrument:** `tools/v6-metrics.mjs`
(machine output: `docs/sessions/v6-metrics.json`, regenerated per patrol run).
**Charter:** `v6-charter-2026-10-24.md` + Board Meeting 006. Brett's order:
graphics first — "pretty blocky… smoothness and realness… trees like trees,
buildings like actual buildings… par and then some." Lighting is **locked**
by his play verdict on live V5; this document does not grade it, it only
proves it untouched.

## 0. Baseline provenance

Measured **clean-worktree at HEAD `c7f13d0`** (tree CLEAN stamp in the JSON).
At that HEAD every graphics module (`js/world.js`, `js/biomes.js`,
`js/mapbuilders.js`, `js/bots.js`, `js/geo.js`) is byte-identical to live
V5 (`3d60275`); the intervening commits are the 0.6.0-dev version bump,
Board 006, the mobile touch layer, and this harness. So the numbers below
**are** the V5 graphics baseline, measured on the final shipped V5 code —
not copied from the stale mid-flight `v5-metrics.json` snapshot.

Two scene families are measured per map, because they are both real:

- **client** — `buildWorld` + `applyBiome`: what Brett's browser renders
  today (maps.js still flags forest/snow/mars `layout: 'transition'`).
- **layout** — `buildMapLayout` distinct scenes: data-true, gated, **not yet
  client-wired**. Bars bind on client now and on layouts the day the
  Coordinator's wiring lands; patrol tracks both so the flip can't smuggle
  a perf regression in.

Sustained accounting is V5's formula, unchanged for line continuity:
static + 9 bots (worst weapon) + worst viewmodel + pickup allowance.
Grand worst case adds the equipment reserve (32) + streak reserve (17) +
remote figures (21). No-culling bound throughout — frustum culling only
helps in the real renderer. There is no GPU here: counts are exact,
frame-times are not claimed. Brett's eyes + F9 remain the final court.

## 1. The V5 baseline (measured)

### 1.1 Client scenes — what ships today

| Map | Sustained calls | Sustained tris | Static calls/tris | Instanced share | Flat-shaded share | Textured share | Casters | Shadow pass (calls/tris) | Textures | Grand worst |
|---|---|---|---|---|---|---|---|---|---|---|
| Compound | **113** | **31,347** | 39 / 15,443 | 0.658 | 0.658 | 0.097 | 24 | 162 / 18,630 | 5 uniq, ~2.2 MB | 183 |
| Forest | **122** | **84,409** | 48 / 68,505 | 0.920 | 0.920 | 0.022 | 31 | 178 / 62,872 | 5 uniq, ~2.2 MB | 192 |
| Snow | **121** | **35,971** | 47 / 20,067 | 0.713 | 0.702 | 0.074 | 30 | 176 / 22,702 | 5 uniq, ~2.2 MB | 191 |
| Mars | **124** | **35,659** | 50 / 19,755 | 0.704 | 0.704 | 0.076 | 33 | 182 / 22,670 | 5 uniq, ~5.0 MB | 194 |

The baseline in one sentence: **calls are nowhere near the line, tris are
nowhere near the line — the "blocky" is shading and texture starvation.**
65–92% of every map's triangles are flat-shaded; 90%+ of Compound and 98%
of Forest render with no texture at all. The only textures in the game are
the shared world set (512² concrete, 256² ×2, 128², a 4×512 gradient; Mars
adds a 1024×512 dome). That is the realness gap, quantified.

### 1.2 Layout scenes (pre-wiring projections)

| Map | Sustained calls | Sustained tris | Static calls/tris | Instanced share | Flat share | Textured share | Shadow pass (calls/tris) | Textures |
|---|---|---|---|---|---|---|---|---|
| Forest | 92 | 76,028 | 18 / 60,124 | 0.980 | 0.929 | 0.000 | 129 / 68,688 | 0 |
| Snow | 92 | 24,170 | 18 / 8,266 | 0.782 | 0.390 | 0.000 | 129 / 17,146 | 0 |
| Mars | 90 | 22,084 | 16 / 6,180 | 0.765 | 0.338 | 0.000 | 126 / 15,454 | 0 |

Note Forest layout's shadow **tris** (68,688) exceed its static tris —
the canopy casts, so the shadow pass re-renders nearly the whole forest.
Caster tris are the shadow budget; watch them, not just caster counts.

### 1.3 Vegetation scorecard — Forest client (Update 1's target)

84 trees, 92 bushes. Per-set (all instanced, all `flatShading: true`,
all untextured):

| Set | Count | Tris each | Segments | Instance colour |
|---|---|---|---|---|
| Trunk (Cylinder) | 84 (×1/tree) | 28 | rTop 0.18 / rBottom 0.36, **7 radial**, 1 height | yes |
| Roots (Cone) | 252 (×3/tree) | 15 | 5 radial | **no** |
| Branches (Cylinder) | 252 (×3/tree) | 20 | 5 radial | **no** |
| Canopy blobs (Sphere) | 504 (×6/tree) | 70 | 7 × 6 | yes |
| Bush blobs (Sphere) | 92 | 70 | 7 × 6 | yes |

Predicates at baseline: tapered ✓ · smooth-shaded ✗ · bark texture ✗ ·
foliage texture ✗ · colour coverage **0.60** (Board: 1.00) · tree count
**84** (Board floor: 110 — the layout forest already holds 110; the
client forest does not). Vegetation ≈ 630 tris/tree all-in.
Compound has no biome vegetation group — its trees live in `buildWorld`
(the patrol below shows Atlas treating them via the same proctex kit).

### 1.4 Soldiers, equipment, sim, gates

- **Soldier:** 7 calls / 1,356 tris / 4,052 verts per bot (worst weapon
  1,608 tris), flat share **0.000** — soldiers are already smooth-shaded;
  Update 4 is about forms, not facets. Viewmodel worst 832 tris.
- **Camo:** 5 camos × 2 factions, **zero-delta PROVEN** (7 calls /
  1,356 tris everywhere); palette delta 0/0.
- **Equipment:** claymore 1 call/192 tris, tripmine 1/156, UAV 6/764,
  smoke 5 calls/volume, 0 smoke casters — declared == audited, all
  inside reserves.
- **Gates at baseline:** smoke PASS (251), reachability PASS (38),
  biome PASS (50), soak PASS (LOS 8.53 µs/ray, sim 0.068 ms/tick),
  ws-soak PASS (27), 1 per-map reachability script.
- **Sim bench:** standard 0.08 ms/tick, snapshots ≤ 948 B; stress
  0.099 ms/tick avg, max snapshot 1,329 B (cap 4,096). The stress
  window at wave ≥ 5 did not arm (bench room peaked at 3 alive
  bots — carried V5 bench behaviour), so the average is the quoted
  figure; both are 5× under the 0.5 ms/tick bar.
- **Lighting integrity:** `js/lighting.js` sha256₁₆ `a40a3f79c85670a6`,
  exposure literal 1.10, shadow map 4096 — **matches the recorded
  baseline; the lock holds.** Any future drift warns LIGHTING
  TOUCHED in the harness output.
- **Capabilities:** version 0.6.0-dev · 26,244,000 loadout
  combinations · 5 camos · 4 modes · registry: compound `distinct`,
  forest/snow/mars `transition`.

## 2. The bars for Update 1+ (struck by Odin, under Board 006)

### 2.1 Perf vetoes (§2.6 — held at the V5 lines)

| Bar | Line | Baseline headroom (worst map) |
|---|---|---|
| Sustained draw calls / map | **≤ 165** (veto) | 124 → 41 spare (Mars client) |
| Sustained tris / map | **≤ 300,000** (veto) | 84,409 → 3.6× (Forest client) |
| Shadow pass | published every update; advisory at **340 calls**; caster **tris** reported alongside | 182 calls / 68,688 tris worst |
| Texture VRAM / map | advisory **256 MB** (RGBA8 + mips) | ~5 MB — 50× spare; spend it |
| Sim | ≤ 0.5 ms/tick; snapshots ≤ 4,096 B | 0.099 / 1,329 B |

The 300k tri line is **held, not raised**: the baseline publishes no
evidence that 60 fps needs more, and Board §3's offset rule (no net new
call without a named offset in the ledger) governs the call budget.
Detail must be bought with instancing and merging — the baseline proves
the technique (Forest layout: 60k tris in 18 static calls).

### 2.2 The §2.5 strike (the threshold Board 006 left blank)

**Struck: 25 m².** After Update 5, no single untextured static mesh with
a surface area over **25 m²** may survive on any map — it gets a
procedural texture, a blend, or a breakup. Scoping, disclosed: sky domes
(BackSide) and backdrop-scale geometry (> 50,000 m² — the 263,123 m²
horizon disc) are excluded from the strike test and recorded
separately; areas are geometry-computed and ignore per-instance scale
(±half an order — fine at this threshold). Baseline offenders the
strike is aimed at: the client scenes' shared 3,815.5 m² untextured
merged mesh (348 tris, all four maps) and the layout ground slabs
(33,924.8 m² BoxGeometry, all three layouts — Update 3's blended
ground materials are the expected kill).

### 2.3 Detail bars (Board §2.1/§2.2 predicates — harness-measured)

Update 1 exit, Compound + Forest, both scene families where present:
tapered + smooth-shaded + bark-textured trunks; ≥ 3 foliage masses per
tree; foliage texture with alpha variation; instance-colour coverage
**1.00** on instanced vegetation; Forest ≥ 110 trees; ≥ 3 procedural
facade canvas materials across the two maps. (Architecture cue counts
per structure — §2.2's ≥ 4 cues, zero naked boxes — are verified by
Atlas/Verity review, not by this harness; the harness measures the
texture/material facts underneath them.) Anisotropy: **absent
everywhere in `js/` at baseline** — Update 5 sets it on ground
textures to the renderer's practical max.

### 2.4 Mobile strike (Addendum A)

The interim bar (DPR ≤ 2; shadow-map size is a resolution knob only;
grade locked) is already the shipped behaviour — L0 caps DPR at 2 and
Vega's touch start is L1 (DPR ≤ 1.5). **Struck target: mobile plays
under the same content bars as desktop (§2.1 — same 165 calls /
300k tris content), and what flexes is resolution only:** touch starts
at L1 on strong GPUs (as shipped) and the scaler may fall to L2
(DPR 1.25, shadow 2048) or L3 (shadows off) — never to reduced
content, never to a touched grade. Any map that only fits mobile by
cutting content has failed the desktop bar first.

## 3. Patrol log

### Patrol #1 — Atlas, Update 1 (in flight, uncommitted, Oct 24)

Measured on the working tree (HEAD `45e3809` + Atlas's uncommitted
`world.js`/`biomes.js`/`mapbuilders.js` + new `js/proctex.js`) with
`--compare` against this baseline. Gates on the WIP tree: **all PASS**
(smoke 253). Lighting integrity: **untouched**.

**§2.1 predicates flipped on Forest (client AND layout):** trees
84 → **116** ✓ · trunk tapered 0.20/0.44, **10 radial segs, smooth ✓,
bark texture ✓** · canopy **7 blobs/tree at 140 tris** (10×8), smooth ✓,
foliage texture ✓ · roots/branches now textured + coloured ·
**instance-colour coverage 1.00** ✓ · textured tri share 0.022 →
**0.945** · flat share 0.920 → **0.031**. Compound: +6 calls /
+9,129 tris, flat share 0.658 → 0.242, textured share 0.097 → 0.581,
textures 5 → 10 — buildings mid-treatment, on trajectory for §2.2.

**Perf accounting — NO VETO. One budget warning:**

| Scene | Δ calls | Sustained now | Δ tris | Sustained now | Shadow pass now |
|---|---|---|---|---|---|
| Forest client | +6 | 128 / 165 ✓ | +121,893 | **206,302 / 300k** | 187 calls / **178,512 tris** |
| Forest layout | +6 | 98 ✓ | +89,416 | 165,444 ✓ | — |
| Compound client | +6 | 119 ✓ | +9,129 | 40,476 ✓ | 171 / 27,302 |
| Snow/Mars client | +6 | ≤ 130 ✓ | +9,129 | ≤ 45,100 ✓ | — |
| Snow/Mars layout | 0 | — | 0 | — | Update 2 territory |

The +6-call uniformity is the proctex dressing done right — detail
bought with instancing (instanced share rose on every touched scene),
exactly per §3. **The warning:** Update 1 alone spent 41% of Forest
client's *entire* tri budget (84k → 206k) and nearly tripled its
shadow-pass tris (62,872 → 178,512 — the 140-tri canopies cast).
Forest client has **≈ 94k tris left for Updates 3 + 5 combined**
before the 300k veto line, and its shadow pass is now the heaviest
render on the map. That is affordable **if it is budgeted from here**:
further Forest detail must arrive with offsets (canopy LOD via
Update 16, shadow-caster discipline on small scatter), and F9 on
Brett's hardware + the iPhone are the courts that confirm the spend.
Snow/Mars (Update 2) should expect the same per-map accounting
before landing, not after.

## 4. Method notes & disclosures

- The harness took four fix rounds to reach module truth (bot-gun
  builder is `buildBotGun`; camos live in `js/camo.js`/`loadouts.js`;
  the sim bench API is `GameServer` + `attachTransport`; there is no
  `js/los.js`). Each round is a `v6(chief):` commit saying what was
  wrong. The scene audits were unaffected — rounds touched only the
  soldiers/equipment/sim/capabilities sections.
- A Coordinator scaffold of this harness (a renamed V5 copy) was in
  the tree when Odin started; it was replaced wholesale — nothing of
  it survives except the gates/soak approach, which V6 deliberately
  carries.
- Vegetation "trunk" detection: by userData tree count where the
  builder records one (biomes), else the tallest instanced cylinder
  (layouts). Snow/Mars scorecard "trunk" rows describe terrain
  dressing (ice discs, mesas), not trees.
- `docs/sessions/v6-metrics.json` in this commit is the **baseline**
  run (HEAD `c7f13d0`, CLEAN). Patrol runs regenerate it in place;
  whoever patrols last leaves the freshest numbers — the bars and
  this narrative change only by a minuted `v6(chief):` edit.
