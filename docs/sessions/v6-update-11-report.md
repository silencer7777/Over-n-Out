# V6 Update 11 — Report: Background Mountains & Horizon Depth

Built Wed Oct 28, 2026 (13:53 PT midday build session,
Coordinator). Commits: `a051032` spec · `695134e` code · this
report. **Pushed live + verified** under the Oct 28 auto-push
law. **The landed V6 count is now 11.**

## What shipped

- **U11-01/02 Horizon re-based + crest shading (queue item 5).**
  The background outside the arena is now FOUR layered mountain
  rings instead of two flat curtains: low foothills, then near,
  mid, and far ridges, each shaded dark at the base rising to a
  lighter crest, so the skyline reads as lit mountains with
  depth. Just as important, the rings were **moved out**: the
  old near ring sat on a circle of radius 100, placed back when
  the arena corner was ~71 units out — since the U6 expansion
  the playable square is ±80 (corner ~113), so that old circle
  actually crossed the playable corners diagonally. Every new
  ring's closest point now stays beyond the corner (foothill
  minimum ~115.8), so the scenery can never cut through the
  playing field again.
- **U11-03 Distant peaks.** Behind the rings stands a range of
  18 tall summits (heights ~34–58) with pale caps — one merged
  mesh, one draw call — giving the horizon a real mountain
  silhouette on every map (the horizon lives in the shared
  world build, so Compound, Forest, Snow, and Mars all get it).
- **U11-04 Build witness 11.** Menu stamp BUILD U11, ono-build
  meta 11, `?v=11` assets, `BUILD_NO` 11. mobile-check T7
  re-pinned 10 → 11 (**named re-pin, witness-only**).
- **U11-05 Gate pins.** smoke gained the H1 suite (3 checks):
  the five horizon mesh names present, the pre-U11 sub-corner
  radii (`ridgeRing(100` / `ridgeRing(124`) absent, vertex
  colours present.

## Security items shipped (standing hardening priority)

Anti-glitch: the horizon remains visual-only — no colliders,
no shootables, nothing standable or clippable — and the
re-basing removes the one case where scenery geometry could
intersect playable space. Server authority / rate / size caps
unchanged and re-verified by the W-suite inside smoke.
**Still open (named, not hidden):** Stage 2 signed session
verification — Lockdown + Odin have **not** certified the
hardening pass complete.

## Before / after scorecard

| Measure | Before (U10) | After (U11) | Note |
|---|---|---|---|
| Scope vs plan | — | 6/6 items | spec `a051032` (foothill radius corrected 118 → 122 in the code commit to guarantee corner clearance after bump/hash swing) |
| Client static calls (compound/forest/snow/mars) | 48/61/60/62 | 51/64/63/65 | +3/map exactly as budgeted (4 rings + peaks − 2 old rings); bar 165, sustained totals ≈134/147/146/148 |
| Client static tris | 30,908 / 221,902 / 68,376 / 52,898 | 31,268 / 222,262 / 68,736 / 53,258 | +360/map; bar 300k |
| Shadow casters (per client map) | 30/38/40/40 | 30/38/40/40 | Δ0 — all horizon meshes are non-casting Basic; shadow estimate stays 199/200 |
| Gates (tree) | green | smoke ✓ (incl. new H1 ×3) biome ✓ reachability ✓ maps ✓ mobile ✓ | mobile-check T7 named re-pin only |
| Gates (snapshot) | — | all five green | re-run on the pushed git-archive snapshot |
| Live verification | — | byte-exact | index stamp BUILD U11 served; js/main.js `BUILD_NO = 11` served; js/world.js 87,158 B = snapshot, `horizon-peaks` present. Pages took ~2 min to flip after the push (remote repo verified at 87,158 B via the Contents API in the interim) |
| Hit/balance integrity | — | untouched | no weapon/bot/core/worlddata file changed; SOLIDS unchanged |
| Re-pins | — | 1 named (T7 witness 10→11) | plus new H1 pins, no existing pin moved |

Files changed: `js/world.js` (horizon block), `js/main.js`
(witness), `index.html`, `tools/smoke.mjs` (H1),
`tools/mobile-check.mjs` (T7 re-pin), spec + metrics + this
report + ledger.

## Playtest asks for Brett

1. **Build stamp first:** menu footer should read
   **BUILD U11**.
2. Look outward from a corner and from the ring POIs: the
   skyline should now layer foothills → ridges → capped peaks,
   and no dark curtain should cross the arena corners.
3. Scopes unchanged this update — how to use them, as always:
   **HOLD right mouse button** to aim down sight (touch: ADS
   button). Your U9 rotation/ soldier re-test verdicts are
   still owed whenever you're ready.

Queue after U11: meta systems (queue item 6 — emblems +
special badges first, Laurel owning, in-game currency only),
then characters/movement follow-ups pending Brett's verdicts.
