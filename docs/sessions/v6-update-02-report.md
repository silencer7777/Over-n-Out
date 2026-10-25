# V6 Update 2 — Vegetation + Buildings Parity: Snow Station, Mars Uplink

Filed by Atlas (worlds & soldiers, builder). Budget read from Odin's
harness (`tools/v6-metrics.mjs`, headless-stub estimate, baseline =
3d385d8 / Update 1 landed state, `--compare` mode).

## What changed

**Shared kit (commit 553e9ad):** `js/proctex.js` gains three guarded
canvas painters in the house pattern — `makeSnowTexture()` (snowpack
with drift shading + sparkle glints), `makeIceTexture()` (pale blue
masses + hairline crack network), `makeRegolithTexture()` (rust strata
bands, pebbles, heavy speckle). `js/biomes.js` cannot import the kit
(import law: three only), so the painters are inlined there in the
established way.

**Snow Station — client path, `js/biomes.js` (0ed4e0d):** drift mounds
go smooth-shaded at 10×8 with the snowpack texture; ice rocks gain the
crack-network ice texture (they KEEP their crystalline facets — see
flags); the blanket carries snow at ground scale; the buried dome
re-reads as a habitat dome (smooth + metal-panel surface, still exactly
4 parts per the biome contract). **Snow-loaded pines: a stand of 30
conifers** planted after the shipped scatter from a separately seeded
stream (`SNOW_SEED + 4242` — zero consumption from the shipped stream),
tapered bark trunks, four tiered foliage masses per tree wearing the
shared foliage texture, **plus a snowpack cap on every tier** — the
"snow-loaded" read. 100% per-instance colour on trunks, foliage and
caps; every pine carries its standard trunk collider + hit proxy.

**Snow Station — layout path, `js/mapbuilders.js` (d96e74c):** solids
re-bucketed per surface family (plank huts/crates, standing-seam roofs,
snowpack drift ridge, panelled tower metal) — geometry byte-identical.
Facade pass: door frames + roof fascia for all three huts + the depot
shed ride in ONE merged plank trim mesh; hut windows re-read as glass
(warm-lit emissive ×4, dark ×2 — the flat yellow boxes are gone);
comms-tower extras panelled; the layout dome wears habitat paneling
with a snowpack skirt ring; the snowcat gains a windshield; layout
drifts go smooth + textured + per-instance tint; ice discs
crack-textured.

**Mars Uplink — client path, `js/biomes.js` (c2ac69c):** the rock
family (40 rocks, 9 crater-rim rocks, 3 mesas) goes smooth displaced
spheres (10×8; mesas 12×9) with the regolith surface — ground-scale
tiling on blanket + crater bowl, rock-scale on the rocks themselves;
mesas gain per-instance tints from a dedicated rng (the shipped stream
is untouched). The uplink spire base wears habitat paneling — still
exactly 6 parts per the biome contract.

**Mars Uplink — layout path (febfa93):** solids re-bucketed (regolith
terraces/skirts + panelled metal); the spire is panelled and its tip
splits into a true emissive housing; **habitat paneling** on the
cluster (tubes, rings, tanks) plus five warm-lit window strips flush
with the shells in one merged mesh; crater disc regolith-textured;
rim/mesas/rocks match the client's smooth regolith treatment.

## Before → after (harness, sustained window)

| Scene | Calls | Tris | Flat share | Textured share |
|---|---|---|---|---|
| Snow station (client) | 127 → **130** | 45,100 → **77,720** | 0.338 → **0.105** | 0.489 → **0.825** |
| Mars uplink (client) | 130 → **130** | 44,788 → **48,470** | 0.336 → **0.182** | 0.494 → **0.676** |
| Snow station (layout) | 92 → **99** (static 18 → 25) | 24,170 → **27,678** | 0.390 → **0** | 0 → **0.684** |
| Mars uplink (layout) | 90 → **92** (static 16 → 18) | 22,084 → **27,492** | 0.338 → **0** | 0 → **0.715** |

Shadow-pass estimates (§2.6): snow client 185 calls / 31,374 tris →
**191 calls / 63,994 tris** (the pine stand casts — inside the 200-call
mobile bar, the tightest line in this update; advisory 340 holds);
mars client 191 / 31,342 → **191 calls / 35,024 tris** (+0 calls —
densification added no casters); snow layout 129 / 17,146 → 143 /
20,654; mars layout 126 / 15,454 → 129 / 20,782.

## Score against Board 006 bars

- **Vetoes:** every map ≤ 165 sustained calls AND ≤ 300k tris —
  snow 130 / 77.7k, mars 130 / 48.5k. Planning budgets (120k each)
  hold with wide margins. ✓
- **§2.1 vegetation treatment:** Snow now carries the full Update 1
  treatment (tapered smooth bark-textured trunks, foliage texture with
  alpha cut-out, 100% instance colour). Foliage texture with `alphaTest`
  now ships on all four maps. Mars grows nothing — its rock family
  carries the equivalent geometry/texture bars instead. ✓
- **§2.2 building cues:** Snow huts read door + frame, window glass,
  shaped roofline (fascia + standing seams), plank wall surface, stove
  chimney — ≥4 cues; the Mars habitat reads panel seams + rivets,
  window strips, ring frames, tank caps; the spire reads panelled with
  a lit tip. ✓
- **§2.3 per-instance colour:** 100% on the pine stand, layout drifts,
  rim and mesa tints added where the layout lacked them. Layout flat
  share is now **0 on both maps** — every layout surface is textured.
  ✓
- **§3.4 offsets (named, per the Update 1 verifier's lesson):** snow
  client's net **+3 calls** are the pine stand's three InstancedMeshes
  — the instancing conversion itself: 30 trees × 9 parts (trunk + 4
  foliage + 4 snow caps) = 270 parts in 3 calls where unmerged parts
  would cost ~270. All densification folds into pre-existing
  InstancedMeshes at +0 (Mars client net **+0 calls**). Layout adds
  (snow +7 static, mars +2) are merged-mesh consolidations: three huts'
  + the depot's trim and glass ride in 3 meshes total; Mars's tip and
  window programs are one merged mesh each.
- **Byte-identity:** proven by direct comparison against the baseline
  module — Snow's shipped colliders are an exact-float PREFIX of the
  new array (pines append after); Mars's 27 colliders are exact-float
  identical in order; shootable counts match the plan (+30 proxies on
  snow, equal on mars); L-gates confirm layout colliders == data on
  both maps. `js/lighting.js`, `js/main.js` and all four worlddata
  modules: 0-line diff. Lighting integrity hash verified UNTOUCHED by
  the harness. ✓

## Gates

- `tools/smoke.mjs` — PASSED
- `tools/biome-check.mjs` — PASSED (50 checks; B15 dome parts, B17
  spire parts, B11 pine clearance all hold)
- `tools/reachability.mjs` — PASSED
- `tools/reachability-maps.mjs` — PASSED
- `tools/v6-metrics.mjs --compare` — all gates green (soak + ws-soak
  PASS). The only warnings are the §2.5 flat-surface strikes (the
  shared Compound merged mesh on the client paths; the layout ground
  slabs) — they bind at **Update 5**, and ground/terrain is Update 3's
  slot. Not this update's scope.
- Byte-identity proof (baseline vs current biomes, collider arrays) —
  PASSED (see above)

## What Brett should look at

- **Snow pines:** are the snow caps reading as snow-loaded branches,
  and does the stand feel like a forest edge rather than a plantation?
  Density (30) and placement are tunable in one seeded block.
- **Snow huts:** windows now glow warm on two huts and sit dark on the
  third — reads as lived-in vs empty. The roofs have standing seams.
- **Mars habitat:** panelled tubes with lit window strips; the spire
  tip now actually emits. Rocks and mesas are rounded, strata-banded
  regolith instead of faceted blobs.
- **Snow shadow cost doubled** (31k → 64k tris) — that's the pine
  stand casting real shadows. If the phone dips on Snow, the dynamic
  scaler is the intended answer; Odin's patrol will confirm.

## Flags / honest leftovers

- **The 7 shared Compound trees** still wear compound (green) foliage
  when they appear inside Snow/Mars client dressing — re-dressing
  shared `world.js` trees per-biome would need clearBiome restore
  machinery; a deepening candidate (U8/U9), not hidden.
- **Ice rocks keep their facets by design** — crystalline is the ice
  read; they carry the crack texture. A small, deliberate flat residue.
- **Client flat-share floor** is set by the shared Compound base
  (0.242) until Update 5's strike clears it — biome-owned surfaces on
  Snow/Mars are done.
- **Layout ground slabs + snow blanket** stay flat colour — terrain is
  Update 3 / the §2.5 strike binds at Update 5.
- **Mars solar panels and the layout greenhouse** were left as-is
  (panels already read as dark glass + frame; the greenhouse dome
  reads translucent) — candidates for U9/U14 polish.
- **Dynamic snowfall** still needs a `main.js` frame hook (specced
  since V4) — not faked here; it is not Atlas's surface.
