# V6-3 — Characters + Movement (soldiers & motion pen)

**Directive:** V6-3 (Brett, Oct 25): "Work on the characters, make them
more human like. Also work on smoothness of movement."
**Surfaces owned:** `js/bots.js` (soldier models + bot motion),
`js/player.js` (player motion feel). `js/gunmodels.js` inspected —
not needed and **not touched** (viewmodel sway lives in player.js
pose math). No hook needed in `js/main.js` (Vega's pen).
**Base:** built on 59c6b3d (Vega's V6-3 menu landing); bots.js and
player.js were byte-identical between 476ac34 and 59c6b3d.
**Status:** local `v6(chars):` commits only — never pushed.

---

## 1. Soldier models — more human-like (js/bots.js)

The V5 soldier was well-proportioned but read as assembled kit:
sloped box shoulders, slab arms, cube gloves, a block neck ring.
V6-3 keeps the V5 skeleton and proportions and re-forms the parts
that read as blocks, using the same merged-part pipeline
(`mergeColoredParts`, smooth shading throughout — flat share stays 0):

| Part | Before (V5) | After (V6-3) |
|---|---|---|
| Deltoids | sloped box | ellipsoid (sphere, scaled) — a ball of muscle |
| Neck → shoulders | nothing (gap read) | **new** trapezius ellipsoid sloping neck into shoulders |
| Upper arms | box | tapered cylinder (thick at shoulder, slim at elbow) |
| Elbow pads | box | flattened dome sphere |
| Gloves | cube | rounded fist ellipsoid |
| Knee pads | box | dome sphere |
| Boot toes | box | rounded foot ellipsoid |
| Balaclava / neck ring | box slab | tapered round cylinder |
| Uniforms | flat vertex colour | procedural **fabric grain** texture on the shared body material (near-white weave + speckle, proctex-style guarded canvas; vertex colours multiply through, so palettes/camos keep their hue) |

Forearms deliberately stay boxes: their long axis runs along Z, and
a rotated cylinder's taper direction there risked a visibly wrong
limb for little gain at distance. Vest, pouches, straps, pack,
helmet, goggles and gun are unchanged.

**Silhouette discipline:** wherever a rounded part could poke past
the old block's reach, its scale was trimmed to match the old
extremes (boot-toe front −0.265 both versions; knee-pad front
−0.177 vs −0.175; deltoid outer reach 0.5475 vs 0.545, sole exactly
1.295). Rounding therefore mostly *inscribes* the old silhouette
instead of expanding it — see the hit proof in §3.

**Per-soldier variation — colour only.** Each bot now rolls:
- a skin tone from a 5-step human range (0xc9a189 … 0x7c4b32),
- a uniform wear jitter (×0.93–1.05 luminance on camo tones),
- a gear wear jitter (×0.95–1.04).

Geometry variation and height/build scaling were **rejected on
purpose**: any per-bot geometry or root-scale change moves the hit
volume per soldier, which the hit-core law forbids. Faction fields
(accent rig, armband, shoulder pads, visor) are never jittered —
friend/foe readability is law — and the composed palette is cloned
before mutation, so the shared palette/camo objects are never
written. Squadmates now read as different people in the same unit,
not clones.

## 2. Soldier metrics — before / after (tools/v6-metrics.mjs)

| | Before (476ac34) | After (V6-3) | Δ |
|---|---|---|---|
| Draw calls / bot | 7 | **7** | **0** |
| Tris / bot (AR) | 1,356 | 2,056 | +700 |
| Verts / bot | 4,052 | 6,152 | +2,100 |
| Worst-weapon tris | 1,608 | 2,308 | +700 |
| Flat-shaded share | 0 | 0 | 0 |
| Camo matrix (5 × 2 factions) | identical | **identical — zero-delta PROVEN** | 0 |
| Palette delta | 0/0 | 0/0 | — |

**Offset statement (§3.4):** the Board's per-bot budget is draw
calls — held at exactly 7, so no call offset is owed. The +700 tris
are the honest cost of rounded forms (spheres/cylinders instead of
12-tri boxes) inside the existing 3 merged meshes; at map level
this shows as +6,300 sustained tris on Compound/Forest (9 bots ×
700), far inside the 300k/map bar. The fabric texture is one shared
128² canvas on the shared material: +0 calls, one-time upload.

## 3. Hit-core statement (HARD LAW)

The three hit-core part definitions are **byte-identical** —
verified by `git diff`: no diff hunk touches the leg core
`_box(0.21, 0.78, 0.25)`, torso core `_box(0.66, 0.72, 0.38)` or
head core `_box(0.34, 0.36, 0.34)` lines, and `hitMeshes` is
unchanged.

Independent raycast proof (7,177 rays from front/back/left/right/
top against `hitMeshes`, baseline tree vs this tree):
- **21 rays (0.29%) change region classification — every one at a
  reshaped non-core kit silhouette**: deltoid/arm/knee/toe corners
  the rounding inscribed (15 torso→miss, 2 legs→miss, 2 head→miss
  at the balaclava ring corners), plus 2 miss→torso at the new
  trapezius/deltoid crown.
- **Zero gains into legs or head**; no core surface moved. The net
  effect is a slight *shrink* at kit corners, never an expansion
  of any core.
- 1,902 rays hit the same region in both trees; mean first-hit
  distance delta 5.8 mm (grazing rays meeting a curved surface
  instead of a flat face).

Honest scope note: total hit *volume* is not bit-identical — it
cannot be when kit parts change shape. What the law protects, the
three cores that define legs/torso/head damage regions, is
untouched and proven so two ways.

## 4. Bot movement smoothness (js/bots.js)

- **Facing:** the instant `rotation.y` snap is replaced by a
  rate-capped exponential turn on the shortest arc (rate 11/s,
  cap 10.5 rad/s). Bots swing around like bodies, not turrets.
  Facing is visual only — hit chance runs on distance + LOS.
- **Velocity easing:** bots previously applied full speed instantly
  in the move direction. Velocity now chases the desired velocity
  under the same vector-clamp law as the player (accel 15 start /
  20 stop / **30 while slideMode is engaged**, so un-wedge
  redirects stay decisive). Starts, stops and direction changes
  ramp over ~0.25–0.35 s.
- **Strafe:** direction flips ease through a blend (5/s) instead of
  reversing the velocity vector in one frame.
- **Flinch:** stored velocity bleeds off during a flinch (12/s), so
  a bot no longer resumes at full stored speed the frame it ends.
- **Stride bob + lean:** phase advances with actual velocity
  (2π per ~1.45 m — stride-matched); the whole kit (legs, torso,
  head, visor, gun, HP bars) rides a ±2 cm cycle dip through a
  constructor-registered offset list, with a subtle sway roll
  (±0.013 rad) and forward lean (0.045 rad at full speed), all
  eased. Root position — the sim/collision truth — never bobs.

**Un-wedge integrity:** the state machine, its counters, the
progress sampling and all three slideFails reset paths are
untouched, line for line. The wedge detector reads position
deltas, which still move every frame a slide is engaged (the
easing only relaxes *applied velocity*, and slide accel is the
highest of the three rates). Proof: soak + ws-soak PASS (§6).

## 5. Player movement smoothness (js/player.js) — feel only

No sim constant changed: walk 5.6 / sprint 9.2, GROUND_ACCEL_*,
AIR_ACCEL, LOOK_SMOOTHING_RATE 30, JUMP_VELOCITY 9.5, GRAVITY 24,
coyote/buffer/cut — all exactly as shipped.

- **Head-bob envelope:** bob previously snapped between full
  amplitude and zero at the 0.6 m/s threshold. Amplitude now runs
  through an eased envelope (9/s, floor 0.15 once moving); phase
  advances only while the envelope is open. Peaks unchanged
  (0.028 / 0.018).
- **Landing dip:** the recovery curve is now smootherstep (zero
  slope at both ends) and the dip value eases toward the curve
  (~45 ms attack), so touchdown no longer lands inside one frame.
  Depth formula and the 0.18 s window are the V5 numbers.
- **Strafe lean:** camera roll from lateral velocity, capped at
  ±0.011 rad (~0.6°), grounded only, eased at 8/s.
- **View-model look sway:** the gun lags smoothed look velocity by
  ≤2 cm horizontally / ≤1.2 cm vertically, eased at 10/s, damped
  to 35% while aiming — flicks feel weighty, ADS stays steady.
- **ADS transition asymmetry:** gun-pose lerp rate 18 → **22 in**
  (snap up to sights) / **14 out** (lower to hip).

## 6. Gates

Run in an isolated worktree at 59c6b3d with **only** this wave's
two files applied — the shared
tree currently has other pens mid-edit (Atlas worlds/weather, the
rig), and a main-tree smoke run crashed once in smoke's directory
walk on a sibling's transient `*.check.mjs` file appearing/
vanishing mid-walk (ENOENT, unrelated to these changes). In the
isolated tree, the harness's own gate battery reports:

- smoke **PASS** (253 checks)
- reachability **PASS** (38), biome **PASS** (50)
- soak **PASS**, ws-soak **PASS** (27) — bot behaviour / un-wedge
- v6-metrics --compare vs the 476ac34 baseline: soldier scorecard
  §2 above, camo zero-delta PROVEN, palette delta 0/0
- lighting integrity: sha matches baseline — **UNTOUCHED** (lock
  holds; not this pen's surface regardless)
- hit-core raycast proof: §3

Note: soak/ws-soak exercise `net/sim.js`, a separate server port
that this wave does not touch; the client-bot proof is smoke +
the metrics battery + the raycast probe.

## 7. Balance-adjacent flags (honest)

- **No velocity number changed anywhere.** Bot top speed is still
  `this.speed × moveCfg.speedMult`; player caps and jump/gravity
  are untouched. Nothing here needs Havoc re-balancing.
- One real behavioural consequence to name: eased bot velocity
  means a bot takes ~0.25–0.35 s to reach full speed and to stop.
  Time-to-position over long runs is unchanged; crossing a narrow
  gap on a short hop is marginally slower to *start*. This is the
  intended "body with mass" feel, flagged for Havoc's awareness —
  if playtest says bots feel sluggish off the mark, raise the
  start accel (15) before touching any speed.
- Client bots only: `net/sim.js` bots still move with the old
  instant application. Unifying them is a Vega/net call, not made
  here.

## 8. What remains — rig limits

- **No skeletal animation.** The rig is three merged part-meshes
  posed as a group. Arms do not swing and legs do not stride-cycle;
  bob + lean + roll is the ceiling of this architecture. True limb
  cycles would need per-limb meshes (+calls per bot, breaking the
  7-call budget) or a skinned rig (a new system — V7 territory,
  and the owner's call).
- **No height/build variation** — barred by the hit-volume law
  (§1). Variation is colour-space only.
- Amplitudes (bob 2 cm, lean, sway caps) are tuned by feel on
  paper; **Brett's playtest + F9 are the confirming court**, per
  charter. All are single-constant tweaks in `js/bots.js` /
  `js/player.js` if he wants them stronger or subtler.

## Files

- `js/bots.js` — soldier re-form + fabric + variation; bot facing/
  velocity/strafe easing, stride bob/lean.
- `js/player.js` — bob envelope, landing smoothing, strafe lean,
  look sway, ADS asymmetry. Feel state added to constructor +
  `reset()`.
- This report. Nothing else touched; `js/audio.js`,
  `js/world.js`, `js/biomes.js`, `js/mapbuilders.js`,
  `js/gunmodels.js`, `index.html` are other pens / untouched.
