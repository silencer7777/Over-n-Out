# V6 Update 4 — Terrain & Ground Realness (ledger row 3)

Landed: Oct 27, 2026 (Coordinator session, Atlas surface). Local
commits only — **not pushed**; ships in the next push on Brett's
tap. Awaiting Brett playtest.

Commits: `9c2c854` (compound overlay), `5a577d2` (forest floor),
`8821c8e` (mars pebbles + snow mottling), `584f46a` (§2.1 mound
colours), `281e459` (pebble smooth-shading fix).

## Scope

Ledger row 3 as written: *smooth-shaded undulation, blended
ground materials (asphalt/concrete/grass/dirt/snow/rock), edge
wear, instanced scatter (rocks, tufts, debris) — all maps.*
Graphics-first polish only. No gameplay systems, no lighting
change (integrity untouched — no lighting file opened), no
gun-audio knobs, no ASSAULT balance. Every addition is visual
only: **zero new colliders, zero new shootables, zero spawn or
height-contract changes** — SOLIDS stays 147 (smoke T1 unmoved),
reachability suites pass unchanged.

## What was built

**Compound (shared base, `js/world.js`) — ground-blend overlay.**
The floor was one tiled concrete texture repeated 10×10. It now
wears a world-space painted alpha overlay (512² over the full
136 m plane, deliberately NOT tiled — every mark sits where it
was painted): layered dirt blobs hugging the outer ~12 m rim
(edge wear, darker toward the rim), the two gate lanes and the
cross lane scuffed down to dirt, 36 bare-earth mottles across
the field, gravel speckle concentrated in the rim band. One
mesh at y 0.012 under the shipped puddles (0.015), `depthWrite`
off, receives shadow. On biome maps the overlay is covered by
the biome blanket (top y 0.04) and never seen — its +1 call
there is the shared-base cost, named per §3.4 below.

**Forest (`js/biomes.js`) — the missing blanket + undulation +
stones.** Snow and Mars have worn full ground overlays since
V4; the forest still showed the compound's concrete slab under
its trees. Now it has the same construction (one r 90 cylinder,
group child only) wearing a new blended painter: moss-grass
base, bare-earth / dark-moss / dry-grass patches, 2,100
leaf-litter flecks, grass speckle, soil noise (repeat 20,
bump-mapped like the compound slab). Undulation: 12 smooth
mounds (displaced spheres, instanced) in the r 67–86 ring —
outside the ±62 bounds, backdrop only — each verified ≥5 m
from every trunk, ≥3 m from every bush, ≥8 m from the fallen
mast, clear of every CLEAR_RECT. Scatter: 56 instanced floor
stones on the bands (the world.js landscaping-rock idiom).
All forest additions run on their own rng streams
(FOREST_SEED + 9001 / + 9107) planted after every shipped
scatter: the byte-identical tree/bush placement cannot
re-roll (biome-check B3/B4/B6/B7 all pass unmodified).

**Mars (`js/biomes.js`) — pebble field.** The regolith blanket
read smooth between the big rocks; 130 instanced pebbles
(smooth displaced spheres in the U2 rock family's language,
regolith texture, rust instance colours) now give the ground
boot-level grain across all bands. Own stream (MARS_SEED +
777), `marsClear`-checked, no colliders.

**Snow (`js/biomes.js` + `js/proctex.js`) — drift mottling.**
A snowfield's one material is its fiction, and U2/V6-3 already
gave it grain, scour streaks and glints; the remaining flatness
was scale. Both mirror snow painters gain — appended last, in
step, so every upstream rng draw is unchanged — nine broad
blue-grey deep-drift masses per tile. No new meshes.

## Performance (harness, `tools/v6-metrics.mjs`)

| Map | Calls before → after (veto 165) | Tris before → after (veto 300k) | Shadow est. calls (mobile bar 200) |
|---|---|---|---|
| Compound | 118 → 119 | 48,042 → 48,044 | 171 |
| Forest | 127 → 131 | 213,868 → 217,758 | 190 |
| Snow | 129 → 130 | 85,286 → 85,288 | 191 |
| Mars | 129 → 131 | 56,036 → 65,138 | 192 |

Shadow-pass **tris are byte-identical on every map** (forest
185,724 before and after): every new mesh has `castShadow`
off — the shadow budget had no room and got none of the bill.
Mars flat-shaded share *improved* 0.176 → 0.138 and textured
share 0.675 → 0.744 (an interim flat-shaded pebble build read
0.276 and was corrected to smooth displaced spheres before
landing — see `281e459`). Forest flat share 0.031 → 0.041
(the stones, same flat-shaded idiom as the shipped base
rocks). Textures: +3 unique on forest (overlay + 2 floor
instances), forest VRAM ~4.6 → ~8.8 MB — the one real mobile
cost of this update, recorded honestly; still ~15 textures
total, and M2 (mobile perf defaults) remains the place to
price it on-device.

**§3.4 offset accounting.** Net sustained calls: compound +1,
forest +4, snow +1, mars +2. The compound overlay is one draw
for the entire ground-blend program (vs +1 per decal patch);
the forest blanket is one draw replacing a full-map wrong
surface; mounds (12) and stones (56) and pebbles (130) are one
InstancedMesh each — unmerged, the same dressing would cost
198 draws. Post-add headroom vs the 165 veto: ≥34 calls on
every map.

**Warnings disposition.** The metrics run's §2.1 warning
(forest instanced-variation 86% < 100%) was introduced by the
uncoloured mound set and fixed in `584f46a` — mounds now carry
per-instance colour; the warning is gone. The seven §2.5
flat-surface strikes are unchanged and pre-existing: the
client candidate is the shared-base untextured merged bucket
(~4,240 m²) and the layout candidate is the layout ground box
(~33,925 m²). Both are **Update 5's** struck scope ("no large
flat-color surface survives") — this update did not chase
them early, and the layout ground boxes were left untouched
for the same reason.

## Gates (final tree, HEAD `281e459` + docs)

- `node tools/smoke.mjs` — **SMOKE PASSED** (no re-pins needed;
  T1 SOLIDS 147 unmoved).
- `node tools/biome-check.mjs` — **BIOME CHECK PASSED**.
- `node tools/reachability.mjs` — **REACHABILITY PASSED**.
- `node tools/reachability-maps.mjs` — **MAP REACHABILITY
  PASSED**.

## Awaiting Brett

1. **Playtest** — compound: does the rim/lane dirt read as wear
   or as mess? Forest: floor blend under the trees, mound ring
   at the edges. Mars: pebble density. Snow: drift depth.
2. **Push tap** — Updates 1–3 + this update are all local;
   nothing in V6 has been pushed since the mobile M1 snapshot
   except what Brett already tapped.
