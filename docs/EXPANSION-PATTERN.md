# The Expansion Pattern + Map Pipeline (V7.18/V7.21, Item 10/11)

How maps get bigger in this engine without breaking the phone
rule or the budgets — the recipe both expansion slices used,
written down so the next map (and the ten-map programme) starts
from it instead of rediscovering it.

## The shape of a map here

- **Data module** (`js/worlddata*.js`): BOUNDS, SPAWN_POINTS,
  SOLIDS (+ STRUCTURE_STYLE tags on the distinct maps), EXTRA,
  BARRELS, MODE_ZONES, ASSAULT_TARGET, PICKUP_CACHES,
  TRANSMISSIONS, allColliders(), groundHeightAt(). Pure data +
  seeded scatter; no THREE, no DOM.
- **The compound is special**: its visuals are hand-authored in
  js/world.js and worlddata.js is a hand-maintained
  TRANSCRIPTION (smoke T1/T2 counts pin the mirror). Every
  geometry change lands in both files in the same commit.
- **Distinct maps** (forest/snow/mars) render their data via
  js/mapbuilders.js from STRUCTURE_STYLE — new S() rows render
  automatically. Their client wiring is the M2 loopback
  (pre-existing 'transition' state); the sim adopts their data
  today.
- **Registration**: js/maps.js (id, data module, layout flag,
  biome profile key). The PLAY picker reads the registry —
  a new map appears by registering, not by menu surgery.

## The expansion recipe (proven twice)

1. Grow BOUNDS; move the perimeter to the new edge; demote the
   old wall line to a ruin line with road gaps (the world reads
   as grown, and every old route survives).
2. Push spawns out with the bounds; keep objectives in the
   core (ring = maneuver + landmarks, core = objectives).
3. Author ring content as merged boxes GROUPED BY MATERIAL
   (Lesson 35) — one merged mesh per material per map area.
4. Extend seeded scatter rects/stands to the new field and
   raise counts ~proportionally (density falloff is fine —
   dressing thins with distance, sight-lines stay readable).
5. Add ONE signature structure set per map in its own style
   vocabulary (knoll/shelter, drift ridge, solar posts) using
   proven shapes (0.575 terraces, posts + slab roofs).
6. Re-derive every fixture from the data (bounds pins are
   named re-pins; grids read BOUNDS — Lesson 38).
7. Prove it: full gate suite + reachability at the new size +
   a traversal probe for anything new a player can cross,
   climb, or drive (Lesson 36).
8. Measure: v6-metrics before/after per map — calls ≤165,
   tris ≤300k, casters ≤200, sim ≤0.5 ms/tick. If a map can't
   hold budget at target size, shrink the map before touching
   the phone profile (owner's hierarchy).

## The ten-map pipeline (Item 11 — specced, not yet built)

A new map is a data module + a biome profile + registration.
To make the tenth cheaper than the second, the pipeline work
is, in order:

1. **Layout graph as data**: promote the S()-authoring pattern
   into a small generator (compounds = walled rectangles with
   door gaps + roof plates; lanes = barrier rows; high ground =
   terrace stacks) so a map's skeleton is a page of declarative
   rows, not hand-placed boxes. The compound's districts
   (V7.18) are the reference shapes.
2. **Biome profile table**: sky/fog/lighting profile key +
   scatter vocabulary (trees/drifts/rocks) + structure style
   set — the three distinct maps are the three worked examples.
3. **Topology variety is a checklist, not a hope**: each new
   map declares its topology (chokepoint / open / vertical /
   water) in its module header; no two shipped maps share a
   skeleton (review against the registry before building).
4. **Gates are the acceptance**: a map ships when the full
   suite passes with it registered — smoke contract,
   biome-check, reachability-maps (auto-covers every data
   module), mobile-check, and its traversal probes.
5. Water/bridges/roofs/props enter through the same data rows
   (bridge = ramp/deck/rail solids; water = visual plane +
   wading contract; roofs = plate + stair/crate-hop routes).

Status at V7.21: existing four maps expanded (compound
160→208 m; forest/snow/mars data 124→168 m). New maps shipped:
**0 of 10** — the pipeline above is the build order for the
next world session; nothing was padded into the registry to
fake the count.
