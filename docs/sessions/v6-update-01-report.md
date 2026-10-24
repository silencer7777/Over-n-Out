# V6 Update 1 — Coordinator's Integration Report (Vegetation + Buildings, Compound & Forest)

Filed: Oct 24, 2026 · Coordinator (integration) · Builder: Atlas
(sole pen, deconfliction ruling) · Measurement: Odin (chief pen,
`docs/sessions/v6-metrics.md`) + independent verifier
(clean-worktree) · Builder's detail: `docs/sessions/v6-update1-atlas-report.md`
· **Nothing pushed** — Update 1 ships in the next push, on Brett's tap.

## What changed

**Vegetation (both maps, both render paths).** Trees stopped
being lollipops: trunks are now tapered profile geometry (root
flare, seeded wobble, gentle lean) with smooth normals and a
procedural bark texture; canopies went from one displaced ball to
**6–7 jittered foliage masses per tree** in tiers, smooth-shaded,
with a leaf-cluster texture that has real alpha holes. Bushes are
2-mass. Per-instance colour variation now covers **100%** of
instanced vegetation (was 60%). Forest's rendered tree count rose
**84 → 116** with the shipped scatter byte-identical — a
separately-seeded supplemental stand planted after it under the
same clearances; the original 84 trees' and 47 bushes' colliders
prove equal to HEAD, in order.

**Buildings (Compound).** A facade pass in 5 merged meshes,
visual only, zero collider changes: parapet caps, corner boards +
45° chamfer strips on every primary corner, base skirts, header
bands, framed door gaps on the Ops Building and Comms Shed,
**9 windows in three emissive buckets** (warm-lit / cool-lit /
dark), roof fascia and standing-seam roof textures, tower fascia
+ mast crossarms, deck fascias, perimeter coping. Forest's cabin
gained a door frame, window band with mullions, and a brick
chimney; the relay shed an overhang + framed lit window. The
motor-pool wrecks picked up glass, door insets, grille, headlights
and mirrors **at +0 draw calls** (Update 14 props scope that rode
along — credited in the ledger).

**Craft notes.** `js/proctex.js` is the new procedural-surface
module (bark/foliage/plank/concrete/metal/roof/brick) serving
`world.js` + `mapbuilders.js`; `biomes.js` imports **only
'three'** per the import law — its painters are inlined. Cabin
window glass is deliberately visual-only: the east band is a
gameplay fire slot and bullets still pass it.

## Before / after (Odin's harness)

| Scene | Sustained calls | Sustained tris | Flat share | Textured share |
| --- | --- | --- | --- | --- |
| Compound | 113 → **119** (veto ≤165 ✓) | 31,347 → **40,476** (≤300k ✓) | — → 0.242 | 0.097 → **0.581** |
| Forest (client) | 122 → **128** ✓ | 84,409 → **206,302** ✓ | 0.92 → **0.031** | 0.022 → **0.945** |
| Forest (layout) | — → **98** ✓ | — → **165,444** ✓ | — → **0** | — → **0.979** |

Trees: Compound 7 (rebuilt in place), Forest client 84 → **116**,
Forest layout **110**. Foliage masses/tree: 4 → 6 (Compound),
6 → 7 (Forest). Shadow-pass estimate, Forest: 187 calls — priced
and published per §2.6, inside the ≤340 advisory and the ≤200
mobile bar.

## Score against Board 006

- **§2.1 Vegetation: MET.** Both baseline bar warnings
  (variation 60%, trees 84) are cleared. Canopy ≈1,120 tris/tree
  clears the ratified ≥1,000 (Addendum 1).
- **§2.2 Buildings: MET as written** (≥4 cues/structure, emissive
  window variation, ≥3 facade materials — 5 in use, solids
  byte-identical). **Partial** against the counts Addendum 1
  adopts forward (Compound ≥20 windows / ≥4 doors by Update 6;
  shipped 9 windows + framed door gaps).
- **Vetoes: HELD.** Calls 119/128 ≤ 165; tris ≤ 300k. Forest's
  206k is +6k over its 200k *planning* budget — accepted and
  dispositioned in Addendum 1; further Forest growth must name
  its offset.
- **Lighting: UNTOUCHED** — integrity hash matches baseline;
  the locked grade re-measured numerically identical.

## Gates — Coordinator's own run on the integrated tree

- **SMOKE PASSED** · **BIOME CHECK PASSED** · **REACHABILITY
  PASSED** · **MAP REACHABILITY PASSED** · **WS-SOAK PASSED**
- Builder's pre-commit run and the Chief's Patrol #1 concur
  (Patrol #1: §2.1 predicates flipped, NO VETO, one budget
  warning — the Forest tris line dispositioned above).

## What Brett should look at when he test-plays

1. **The trees, first** — walk the Compound treeline and any
   Forest lane: trunks should read bark-textured and tapered,
   canopies layered and irregular, no two trees the same colour.
   The flat-shaded "blocky" read should be gone (0.92 → 0.031).
2. **The Ops Building and Comms Shed** — parapets, corner trim,
   framed doors, lit windows in warm and cool glass. Do they
   read as *buildings* now?
3. **The wrecks in the motor pool** — glass, grilles, mirrors.
4. **F9 on Forest** — calls and FPS with the denser canopy
   (sustained 128 calls / shadow est. 187 headlessly; your
   phone/desktop reading is the final court, same as always).
5. Lighting should look **exactly as it did in V5** — it is
   locked and hash-verified untouched. If anything reads
   different, that's a bug report, not a change.

Next in the ledger: Update 2 (Snow/Mars parity) — or Brett's
playtest feedback re-sequences, as the loop prescribes.
