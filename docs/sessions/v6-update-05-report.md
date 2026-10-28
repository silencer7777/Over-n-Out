# V6 Update 5 — Brett's Spec Update (BUNDLED) — Report + Scorecard

Built: Oct 27, 2026 (Coordinator session). Spec:
docs/sessions/v6-update-05-spec.md (diagnosis D1–D3 + command
list U5-01…U5-10). **Local commits only — NOT pushed.** Brett
taps the push. Lighting untouched (integrity hash a40a3f79c85670a6
verified by metrics, before and after). Ballistics/tracers
untouched (Brett: "bullets are looking good").

Commits: `5756be3` spec · `0b379f3` surfaces (grid + flat
texture) · `63a137f` soldiers + guns · `70f0b25` movement +
audio · `ca0253c` systems (options/countdown/camos) · this
report + ledger + metrics.

## SCORECARD — planned vs shipped

| Item | Verdict | What shipped |
|---|---|---|
| U5-01 Theme music | SHIPPED | Original WebAudio loop (D minor, 96 BPM: pad triads Dm/Dm/B♭/A, sub-bass roots, sparse pentatonic lead, soft kick/hat) on a dedicated music bus in Sfx. Starts on first gesture in menu, ducks under the countdown, stops at GO, returns at match end / pause. Volume in options. |
| U5-02 Floor grid | SHIPPED | Root cause found (below) and removed at the source — no cover-up decals needed. |
| U5-03 Realism / flat surfaces | SHIPPED | Deck/slab/pillar solids now wear the shared procedural concrete: the 4,240 m² untextured merged bucket is GONE from every live map. Remnants dispositioned below. |
| U5-04 Smoothness | SHIPPED | Via U5-05 limb/head rounding, U5-06 gun detail, U5-07a feel retune. Map flat-shaded shares did not regress (compound .230→.230, forest .041, snow .103, mars .138→.138). |
| U5-05 Characters | SHIPPED | Tapered thigh + shin overlays, cylinder forearms, hip mass, rounded face mass — same 3 merged meshes, per-bot calls still 7. Hit cores byte-identical (the leg/torso/head box specs are unchanged in source; every hit pin green). |
| U5-06 Guns | SHIPPED | AR gas tube + 8 handguard vents; SMG receiver pin + mag-release paddle; shotgun perforated heat shield; DMR handguard vents + barrel fluting rings; pistol slide-top serrations + frame rail. Muzzle vectors unchanged. |
| U5-07 Movement | SHIPPED | (a) Feel: ground accel 40→36, stop 55→46, air accel 9→10.5 — top speeds and all jump constants untouched. (b) ONE new verb: SLIDE (sprint + C/Ctrl, 0.55 s, 10.6→6.4 decay, locked direction + light steering, camera dips to ~1.02 m, jump/edge cancels). |
| U5-08 Options menu | SHIPPED | Profile settings extended + sanitized: sensitivity, invert-Y, FOV 60–100, graphics quality (auto/high/medium/low via a new QualityScaler manual override), sprint hold/toggle, menu-music volume, SFX volume, fullscreen toggle. ⚙ OPTIONS button on page 1; the same page serves the pause overlay, edits apply live and survive reload. No V6-3 menu option lost. |
| U5-09 Countdown | SHIPPED | DEPLOY → 10…1 on the banner with tick tones → GO! Look-around only (zeroed input), nothing spawns before GO; the pre-U5 spawn paths run at GO verbatim. Pause mid-countdown resumes into the countdown. Solo modes; later waves don't re-count. |
| U5-10 Earnable camos | SHIPPED | 4 new designs (MIRAGE DIGITAL L21, TIGER STRIPE L23, CRIMSON L25, MERIDIAN GOLD L28) on the prestige track, zero power; PG7 pin re-pinned 11→15 as a ruled change. Plus the missing wire: a camo picker in the loadout (locked rows show their level) and the player's viewmodel gun + arms now actually build with the class camo (they silently defaulted to woodland before). Loadout combinations 26,244,000 → 47,239,200. |

Deferred, with reasons:
- **Layout ground box strike (33,925 m²)** — exists only in the
  pre-wiring projections for the unwired forest/snow/mars
  layouts (not playable yet). The fix is this update's texture
  treatment, applied when the layouts wire in.
- **Sun-disc strike (1,503 m²)** — the sky's sun sphere is the
  largest remaining "untextured" mesh. It is an emissive sky
  element inside the LOCKED lighting presentation; texturing a
  sun is neither possible nor desirable. Named, not chased.
- **Slide on touch controls** — desktop C/Ctrl ships; a touch
  slide button belongs to the mobile track (the countdown is
  view-only on touch until GO; desktop look-around works).
- **Slide in online** — the verb runs through the shared Player
  class locally; the authoritative sim doesn't model it yet
  (Vega's lane, future session).

## Floor-grid root cause (D1, for the record)
Three periodic features stacked in the compound ground tile:
(1) a literally painted white grid every 64 px, tiled 10×10 →
lines every ~1.7 m (plus a green center circle repeating every
13.6 m); (2) a per-tile edge-darkening vignette → a second grid
of dark seams every 13.6 m; (3) form-board lines + fixed
tie-hole dots in proctex concrete striping the building floors.
All removed; blotches are now wrap-painted (±tile offsets) so
the repeat itself has no seam. Biome blankets were never a
cause (aperiodic painters).

## Perf — before → after (tools/v6-metrics.mjs)
| Map | Calls | Tris | Shadow est. calls | Textures |
|---|---|---|---|---|
| compound | 119 → 119 | 48,044 → 53,522 | 171 → 171 | 11 → 12 (~5.3 → ~5.7 MB) |
| forest | 131 → 131 | 217,758 → 223,236 | 190 → 190 | 15 → 16 (~8.8 → ~9.2 MB) |
| snow | 130 → 130 | 85,288 → 90,766 | 191 → 191 | 18 → 19 (~7.8 → ~8.1 MB) |
| mars | 131 → 131 | 65,138 → 70,616 | 192 → 192 | 14 → 15 (~9.2 → ~9.5 MB) |
**Zero new draw calls on any map; zero shadow-budget cost.** The
uniform +5,478 tris/map is the shared soldier+gun content the
harness fields: per-bot 2,056 → 2,622 tris (worst weapon 2,308 →
2,898), viewmodel worst 832 → 1,000 tris — the price of the
human/gun pass, far inside Odin's bars (≤165 calls, ≤300k tris,
shadow ≤200). Camo matrix re-proven at 9 camos × 2 factions:
identical 7 calls / 2,622 tris — zero-delta holds.

## Gates (final tree)
- `node tools/smoke.mjs` — **SMOKE PASSED** (PG7 re-pin is the
  only pin change, a ruled change per U5-10)
- `node tools/biome-check.mjs` — **PASSED** (hit cores proven)
- `node tools/reachability.mjs` — **PASSED**
- `node tools/reachability-maps.mjs` — **PASSED**

## Files changed (build commits)
spec +182 · world.js/proctex.js (surfaces) +51/−34 ·
bots.js/gunmodels.js +25/−2 · player.js/main.js/audio.js
(movement+audio) +192/−11 · progression.js/camo.js/quality.js/
player.js/main.js/index.html/style.css/smoke.mjs (systems)
+289/−40 · this report + ledger + metrics.json.

## Awaiting Brett
1. **Playtest** — floors (is the grid gone everywhere you saw
   it?), soldier read at distance, gun read in hand, slide feel,
   countdown length (10 s is your spec — say the word if it
   should shrink), menu theme (too much? too quiet?), options
   completeness.
2. **Push tap** — Update 5 is local-only, like always.
