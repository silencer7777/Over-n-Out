# V6 Update 7 — Report & Scorecard

**Built and PUSHED LIVE Wed Oct 28, 2026** under Brett's new
release law (04:01am): automatic build + push for the rest of
V6, no per-push permission; V7 untouched. Commits `2808fd3`
(code) + `96d7723` (spec/ledger/re-pin) on top of `a8b6944`.
Spec: `docs/sessions/v6-update-07-spec.md`.

## HOW TO USE THE SCOPES (plain words, for Brett)

- **Aim:** HOLD the **right mouse button**. Your gun raises and
  you look through its sight. Let go to drop back to hip fire.
  On phone/tablet: tap the **ADS** button (it stays on until
  you tap it again).
- **Every gun has a sight now — from level 1, no unlock
  needed.** A gun with nothing fitted aims through its **iron
  sights** (a front post you line up on the target, slight
  1.15× zoom). The **DMR comes with a built-in 5× sniper
  scope** — just hold right mouse.
- **Better optics** unlock as you level and are fitted in the
  **Loadout** screen (optic slot, per gun):
  - **RED DOT** (level 2, all guns) — small ring + red dot,
    1.35×. Fast, close range.
  - **MID SCOPE 3×** (level 7, AR + DMR) — round scope view,
    plain crosshair. Medium range. (This replaces the old
    "SCOPE 4×", which was really only 2.4× — the label lied;
    now the name is the zoom.)
  - **HOLOGRAPHIC** (level 11, all guns) — rectangular window
    with a glowing ring-and-dot, 1.6×. Close-medium.
  - **SNIPER SCOPE 5×** (level 19, DMR) — tight scope view
    with mil-dots under the crosshair for judging drop/distance;
    same 5× as the DMR's built-in glass but steadier aim.
- **Which sight am I on?** The sight picture itself looks
  different per kind, and a label under it names it
  (e.g. "MID SCOPE · 3×").
- **First-time help:** the first time you play, a hint chip
  under the crosshair says "HOLD RIGHT MOUSE TO AIM DOWN
  SIGHTS" until you aim once; then it never shows again. The
  Options → Controls list says the same thing.

## Diagnosis (why the scope "didn't work")

1. A fresh player owns no optic (unlock-gated), so ADS = iron:
   `adsZoom 1`, no FOV change.
2. Iron sights rendered **no picture at all** — the overlay
   gate suppressed kind 'iron' outright. Holding right mouse
   just centred the gun. Brett's report was accurate.
3. The one magnified attachment was labeled "SCOPE 4×" but
   delivered 2.4×, and a single tube kind covered everything.
4. Nothing in-game taught the control (one buried line in the
   controls list, which didn't even say HOLD).

## Scorecard — planned vs shipped

| Item | Verdict |
|---|---|
| **U7-01 Scope/ADS rework** | **SHIPPED, full.** Five kinds (iron 1.15× / reddot 1.35× / holo 1.6× / mid 3× / sniper 5×), each a distinct picture: iron = DOM post + rear wings; reddot = open ring + dot; holo = rectangular window + ring-and-dot; mid = 64 vmin tube + crosshair; sniper = tighter 54 vmin tube + dotted horizontal + mil dots. Baseline rule in `effectiveWeapon` (no optic → DMR 5× built-in, else 1.15× iron; fitted optic wins; baseline `spreadAds` stays 1.0 — zoom never smuggles accuracy). Overlay now shows for every kind; HUD crosshair hides under any sight picture; label names kind + zoom for all. Sniper gun model (long tube, big bell, sunshade) in viewmodel + world guns. Discovery: one-time hint chip (localStorage-retired), rewritten controls line. |
| **U7-02 Bushes** | **SHIPPED.** Third grounding "skirt" mass per bush in the same InstancedMesh in both systems (compound `world.js`, forest/snow/mars layouts `biomes.js`) — denser, ground-hugging silhouettes in the approved tree technique. Variation from a locally-seeded PRNG: the shared scatter streams are byte-untouched (biome-check B-pins green, no re-pins). No new placements, colliders unchanged, +0 draw calls, +0 casters. |
| **U7-03 Movement feel (first slice)** | **SHIPPED.** Look: error-adaptive smoothing (rate ×(1 + min(1.6, err·2.2)), ADS ×1.5) — flicks catch up, fine aim keeps the shipped settle; sensitivity/targets untouched. Locomotion: 100 ms smootherstep soft-start on ground input accel (×0.7→×1.0); stops and air unchanged. Analytic cost: time-to-90% walk ≈ 0.140 s → ≈ 0.147 s. Walk 5.6 / sprint 9.2 and all Havoc numbers held. |
| **U7-04 Lighting & shadows (first pass, lock lifted)** | **SHIPPED.** Root defect found by measurement: shadow camera ±72 (compound) / ±68 (others) vs playable bounds ±80 since U6-12 — **the four ring POIs rendered shadowless**. All profiles → `shadowExtent` 86; boot fit aligned; `normalBias` 0.5 → 0.35 (leak under walls at the new extent); forest hemi 1.00 → 1.04, mars 1.00 → 1.06 (shadow-readability lifts, smoke L-suite re-judged green: floor, elevation bands, snow overcast signature all hold). No new casters. |
| **Ledger duty** | **DONE.** Oct 28 directives section added: release law, lifted lighting lock, cross-device law, and the remaining-V6 focus queue (characters realism; scenery + background mountains; emblems/badges; daily rewards; tier packages; special offers — in-game currency only). |

## Perf — before / after (tools/v6-metrics.mjs, same instrument both sides)

| Map | Calls before → after | Tris before → after | Shadow-pass est. before → after |
|---|---|---|---|
| compound | 131 → **131** | 58,562 → 61,362 (+2,800 bush skirts) | 186 → **186** |
| forest | 144 → **144** | 236,676 → 252,356 (+15,680 skirts) | 207 → **207** |
| snow | 143 → **143** | 96,030 → 98,830 (+2,800) | 208 → **208** |
| mars | 145 → **145** | 80,552 → 83,352 (+2,800) | 210 → **210** |

Zero new draw calls anywhere; soldier 8 calls / 2,970 tris
unchanged; viewmodel worst 1,000 tris unchanged per the
instrument. Tris stay ≤ 252k vs the 300k cap. The shadow
position did not move because the fix is a camera-frustum fit,
not new casters — and the frustum now actually covers the
playable map (texel density 3.5 → 4.2 cm at the 4096 map).
Metrics warnings: the pre-existing set (sun-disc flat strikes,
soldier §2.4 bar note) plus **LIGHTING TOUCHED**, which is the
suite noticing profile drift — minuted here as **authorized**:
Brett lifted the lighting lock on Oct 28 and directed that
lighting/shadows be "adjusted accordingly and properly."

## Integrity

- **Fire-rate fidelity: exact.** balance-probe §D re-run:
  autos ≤ 0.16% of table at sim + client 60/120/144 Hz; semis
  hold their bounds.
- **Hit cores:** untouched (no soldier/world-geometry changes
  beyond foliage instances; biome + smoke pins green).
- **Re-pins: exactly one, named** — smoke **PG2**: unlock
  ladder 26 → **27 rungs** for the new SNIPER SCOPE 5×
  attachment (L19). No other pin moved; in particular no biome
  scatter pins (the skirt PRNG is local by design).
- Balance side effects, declared: the old `scope` attachment's
  zoom 2.4× → 3.0× (its label now tells the truth); baseline
  iron/DMR zooms are FOV-only (spreadAds 1.0). ASSAULT/bot
  behaviour untouched this update.

## Gates & push verification

Working tree AND git-archive snapshot of HEAD, all green:
smoke ✓ · biome-check ✓ · reachability ✓ ·
reachability-maps ✓ · mobile-check ✓ (synthetic touch: ADS
toggle engages/reports `input.aim` — the same state the new
overlay reads; T-suite passes).

Push: Contents API `deployed: 200`, all Update 7 files in the
updated list. Live byte sizes vs snapshot — **all exact**:
index.html 11,363 · js/main.js 119,503 · js/player.js 28,560 ·
js/world.js 83,481 · js/loadouts.js 17,656 · js/lighting.js
11,284 · js/biomes.js 74,293 · js/gunmodels.js 29,887 ·
js/progression.js 13,980 · css/style.css 31,722.

## Device status (Brett's cross-device law)

- **PC / laptop:** the build Brett playtests; all gates cover
  this path. **Phone / tablet:** mobile-check green; the touch
  ADS toggle drives the same `input.aim` → player → overlay
  path, and the hint chip shows its touch wording
  ("TAP ADS TO AIM DOWN SIGHTS") on touch devices. Sight
  pictures are vmin-based CSS — they scale to any screen.
  On-device verdict still comes from Brett's phone, as always.

## Deferred (honest)

- Characters realism, scenery + background mountains, and the
  meta systems (emblems/badges, daily rewards, tier packages,
  special offers) are **not** in this update — they are queued
  in the ledger for the next automated sessions, per Brett's
  priority order.
- Movement feel is a first slice: stance/slide feel and
  gamepad look are later slices.
- The iron picture is a DOM silhouette (like every sight
  picture here), not a 3D-modeled sight — chosen so all five
  kinds read instantly at any resolution.
