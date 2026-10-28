# V6 Update 7 — Spec

**Ordered:** Brett, Wed Oct 28, 2026 (~04:01am), under the new
release law: **build AND push live on green gates, no per-push
permission, for the rest of V6. V7 is not authorized.** The
lighting lock is **lifted** by the same directive ("adjust
accordingly and properly"); Odin's budgets still bind.
Cross-device law: PC / laptop / tablet / phone must all stay
playable — `mobile-check` is a push gate, not a courtesy.

## Diagnosis — why Brett "still can't use the scope"

Read from the live build (eb903a6), not assumed:

1. **A fresh player has no optic at all.** Optics are unlock-gated
   attachments (RED DOT L2, SCOPE L7, HOLO L11). With none fitted,
   ADS = iron: `adsZoom 1` — no zoom, no FOV change.
2. **Iron sights render no sight picture.** `main.js` explicitly
   suppresses the optic overlay for `adsKind === 'iron'`
   (`player.adsKind !== 'iron'` in the gate), so holding right
   mouse just nudges the gun toward centre. Nothing on screen
   reads as "a scope" — Brett is right.
3. **The one magnified attachment lies on its label:** "SCOPE 4×"
   delivers `adsZoom 2.4`. There is also no mid-range vs
   high-power distinction — one tube kind ('scope') covers all
   magnified aiming.
4. **No discovery surface.** The controls list carries one line
   ("RIGHT-CLICK Aim down sights") among sixteen, doesn't say
   HOLD, and nothing in-game ever prompts the player to aim.
5. Touch ADS exists (toggle button → `input.aim`, same player
   path) but inherits the same iron invisibility.

## U7-01 — Scope / ADS rework (TOP PRIORITY)

Sight taxonomy — five distinct kinds, each a real ADS view:

| Kind | Zoom | View | Available |
|---|---|---|---|
| `iron` | 1.15× | Open: DOM rear-wing + front-post silhouette at bottom centre, viewmodel stays up | **Every gun, no unlock, no attachment** |
| `reddot` | 1.35× | Open: small ring + red dot, faint glass | Attachment, all guns (unlock L2) |
| `holo` | 1.6× | Open: rectangular window + ring-and-dot reticle | Attachment, all guns (unlock L11) |
| `mid` | 3× | Tube: wide aperture, plain crosshair | Attachment `scope` renamed MID SCOPE 3×, AR/DMR (unlock L7) |
| `sniper` | 5× | Tube: tight aperture, mil-dot crosshair | DMR **built-in** (no attachment) + attachment for DMR (unlock L19) |

Rules:
- **Every gun gets a working baseline sight.** `effectiveWeapon`:
  no optic fitted → DMR 5× (its built-in glass), everything else
  1.15× (iron). A fitted optic always wins. `spreadAds` for the
  baselines stays 1.0 — zoom is FOV/feel, never a hidden accuracy
  buff; attachment `spreadAds` values are unchanged.
- The `scope` attachment keeps its id (saves/progression safe);
  only its name, benefit text and `adsZoom 2.4 → 3.0` change.
  New attachment `sniper` (DMR only): adsZoom 5, spreadAds 0.62,
  moveAds 0.85 — the fitted upgrade over the DMR's built-in 5×
  glass is the steadier spread, stated on the card.
- `player.adsKind`: sniper-fit → `sniper`; scope-fit → `mid`;
  holo; reddot; DMR bare → `sniper`; else `iron`. Viewmodel hides
  inside **magnified** tubes only (mid/sniper, blend > 0.55).
- Overlay shows for **every** kind while aiming (iron included);
  the HUD crosshair hides whenever a sight picture is up (the
  sight IS the crosshair). Sight label (name + zoom) renders for
  every kind — the player can always see which sight they're on.
- **Discovery:** (a) controls line rewritten — "RIGHT-CLICK
  (HOLD) — Aim down sights — every gun has a sight; fit optics
  in the Loadout"; (b) a one-time in-match hint chip
  ("HOLD RIGHT MOUSE TO AIM DOWN SIGHTS" / touch: "TAP ADS TO
  AIM DOWN SIGHTS") shown until the player's first ADS, then
  never again (localStorage `ono-ads-hint`); (c) the report
  carries a plain-words HOW TO section for Brett.
- **Mobile:** the touch ADS toggle already drives `input.aim`;
  verified by code path + mobile-check. The same five pictures
  render (CSS is vmin-based).
- Gunmodels: a `sniper` fit on the DMR adds a longer tube +
  bigger objective bell at the existing optic anchor (merged
  geometry, +0 calls). Mid keeps the shipped `scope` tube model.

Acceptance: a level-1 player with any gun holds right mouse and
sees a sight picture + label within the ~150 ms raise; DMR bare
scopes at 5×; each kind's picture is visually distinct;
fire-rate §D pins and hit cores untouched.

## U7-02 — Bushes enhancement (Atlas)

Trees are Brett-approved — their technique (two overlapping
smooth masses, per-instance colour lerp) is the template. Bushes
get a **third mass**: a low, wide skirt (flattened, offset by a
locally-seeded PRNG so the shipped scatter streams stay
byte-identical) folded into the SAME InstancedMesh in both
`world.js` (compound) and `biomes.js` (forest). Denser,
ground-hugging, more natural silhouette. No new placements
(collider counts and T2/B-pins untouched), +0 draw calls, +0
casters (the mesh already casts; instance count is not a call).

## U7-03 — Movement feel, first slice (Havoc lane)

Feel only — walk 5.6 / sprint 9.2, jump constants, stance
numbers and accel base rates are Havoc's and do not change.

- **Look:** the fixed-rate look smoothing (rate 30) becomes
  error-adaptive: big flicks catch up faster (rate scales with
  wrapped angular error, capped ×2.6), fine corrections keep the
  shipped settle, and ADS multiplies the rate ×1.5 for precision.
  Sensitivity targets are untouched — only the approach changes.
- **Locomotion:** a soft-start ramp on ground INPUT accel only
  (rate ×0.7 → ×1.0 across the first 100 ms of a fresh input
  push). Stops keep the full stop rate — responsive brakes,
  gliding starts. Analytic delta reported (time-to-90% walk
  ≈ 0.140 s → ≈ 0.147 s).

## U7-04 — Lighting & shadows, first pass under the lifted lock (Odin)

Found defect, by measurement: **the sun's shadow camera covers
±72 (compound) / ±68 (other maps) but U6-12 grew the playable
bounds to ±80** — the four ring POIs sit outside the shadow
camera and render shadowless. Fixes:

- `shadowExtent` → **86** in all four profiles (bounds + margin);
  main.js boot fit aligned to 86 so the pre-apply frame matches.
  4096 map over 172 m ≈ 4.2 cm/texel — still finer than the
  shipped 3.5 cm at ±72/4096. No new casters; the shadow-pass
  call estimate does not move.
- `normalBias` 0.5 → 0.35 in main.js boot config: the shipped
  value was tuned for a smaller map; at the new extent it
  over-offsets (light leaking under walls/props). Bias
  −0.0002 unchanged.
- Shadow-readability lifts inside the smoke L-suite rules
  (floor 0.36, elevation bands, snow overcast signature all
  re-judged by the suite): forest hemi 1.00 → 1.04, mars hemi
  1.00 → 1.06 (mars had the thinnest proxy, 0.473).

## Ledger duty

Write Brett's remaining-V6 focus queue into
`docs/sessions/v6-update-ledger.md` (characters realism;
scenery + background mountains/landscaping for depth; emblems +
special badges; daily rewards; tier packages; special offers —
in-game currency only), the release-law change, the lifted
lighting lock, and Update 7's landing entry.

## Gates (all green before push)

smoke · biome-check · reachability · reachability-maps ·
mobile-check. Then snapshot → gates again → push via the
Contents API script → Pages build → byte-size verification of
index.html, js/main.js, js/player.js, js/world.js + update files.
Any red gate = no push, tree left clean, blocker reported.
