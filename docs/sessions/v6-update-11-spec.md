# V6 Update 11 — Spec: Background Mountains & Horizon Depth

Board meeting, Wed Oct 28, 2026 (13:53 PT midday build session,
Coordinator chairing). Full relevant squads convened per Brett's
Oct 28 full-capacity order: Atlas (worlds) + Underbrush
(vegetation/environment, reporting to Mason), Forge + Prism
(engine/graphics), Odin + Feather (perf veto), Lockdown + Aegis
(hardening review), Sentry + Tripwire (gates), Harbor (device
matrix / release), Longshot (scopes — queue item 1 is CLOSED by
Brett's U8 verdict "works and is pretty cool", no scope work
this update), Laurel (meta — next in queue, not this update).

## Ground state at session start

- Tree clean at `b338187`; landed V6 count = **10**.
- Watch 13:07 PT rotation: all-pass (294 guardian checks, smoke
  + mobile green, live integrity identical to HEAD, no security
  findings; standing gap unchanged: Stage 2 signed sessions).
- Queue (Brett, Oct 28, priority order): scopes ✓ closed,
  bushes ✓ U7, characters (U9 pass landed, awaiting Brett's
  re-test verdicts before more spend), movement (U7 slice),
  **scenery realism + background mountains outside the playable
  bounds ← THIS UPDATE (queue item 5)**, meta systems next.

## The finding that shapes the update (Atlas + Underbrush)

The horizon dressing in `js/world.js` is two flat-colour
silhouette ridge rings (circles at r 100 and r 124, MeshBasic,
no vertex variation). They were placed for the OLD arena —
the code comment still reads "well clear of the arena corner
at ~71", i.e. the ±50 arena. Since U6-12 the playable bounds
are **±80 (corner at ~113.1)**: a circle of r 100 passes
through the playable square at its diagonals (e.g. the point
(70.7, 70.7) lies inside ±80), and r 124 clears the corner by
only ~11 units of radial distance. The near curtain can cut
across the expanded corner/ring sightlines, and both rings
read flat — no crest shading, no peaks, no foothill layer —
against the V5 daytime skies. That is the scenery-realism gap
Brett's queue item 5 names.

## Scope (numbered, owner + acceptance)

- **U11-01 Horizon rings re-based outside the bounds**
  (Atlas/Underbrush, Forge reviews). Replace the two ridge
  rings with FOUR vertex-coloured rings, every point of every
  ring outside the ±80 square (minimum radius after bump +
  hash swing > corner 113.1 — foothill base 122, min ~115.8):
  foothills r 122 (low, h ~5), near r 132,
  mid r 152, far r 178. Acceptance: radii + names present in
  world.js (`horizon-foothill/-near/-mid/-far`); no collider,
  shootable, spawn, or worlddata change (visual only).
- **U11-02 Vertex-colour crest shading** (Prism). Ridge strips
  get per-vertex colours: dark base → lighter crest with a
  deterministic per-vertex jitter, `MeshBasicMaterial
  vertexColors, fog:false` (the established silhouette read;
  atmospheric pre-lightening now lives in the gradient instead
  of a second flat tone). Acceptance: geometry carries a
  `color` attribute; material is vertex-coloured; Δ shadow
  casters = 0 (Basic materials never cast).
- **U11-03 Distant mountain peaks** (Atlas). One merged
  BufferGeometry of ~18 irregular peaks at r 195–225, heights
  ~34–58, apex vertices coloured pale (snow/light cap read),
  flanks in the far-ridge family. ONE draw call total.
  Acceptance: mesh named `horizon-peaks`; peaks deterministic
  (hash-seeded, same recipe style as the ridges); inside the
  r 300 sky dome, clear of the sun disc path radius (255) at
  their tops only visually — no gameplay surface touched.
- **U11-04 Build witness 11** (Harbor). BUILD U11 stamp,
  ono-build meta 11, `?v=11` entry assets, `BUILD_NO` 11.
  mobile-check T7 re-pin 10 → 11 (**named re-pin,
  witness-only**, same as U9/U10).
- **U11-05 Gate pins** (Sentry/Tripwire). smoke gains an H1
  source pin: horizon mesh names present in world.js and the
  old sub-corner radii (`ridgeRing(124` / `ridgeRing(100`)
  absent. No other re-pins expected; any that appear get
  named in the report.
- **U11-06 Hardening slice** (Lockdown/Aegis). Anti-glitch:
  the horizon is visual-only and stays that way — no
  colliders/shootables added, nothing to stand on, clip
  through, or duplicate from; radii re-based so the scenery
  cannot intersect playable space (the U11-01 fix IS the
  anti-glitch item). Server authority / rate / size caps:
  unchanged, re-verified by the W-suite inside smoke.
  **Still open (named):** Stage 2 signed sessions — hardening
  NOT certified complete by Lockdown + Odin.

## Perf baseline (pre-build, v6-metrics at HEAD)

Sustained calls 131/144/143/145 (compound/forest/snow/mars,
bar 165); forest tris 264,884 (bar 300k); shadow estimate
199/200 (binding). Budget for this update: **+3 calls/map max**
(4 rings + peaks − 2 old rings = +3), **< +1k tris/map**,
**shadow Δ0** (all new meshes MeshBasic, castShadow off).

## Gates + release

All five gates green on tree AND on the git-archive snapshot
(smoke, biome-check, reachability, reachability-maps,
mobile-check), then push live under Brett's Oct 28 auto-push
law and byte-verify key files (index.html, js/main.js,
js/world.js). No V7 anything. Count after landing: **11**.
