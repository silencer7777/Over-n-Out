# V5 Report — "Actually Realistic" + the Systems Version

**Version:** 0.5.0-dev (local only — the live site still serves 0.4.0-dev; pushing is Brett's decision, §8).
**Tree:** 25 `v5(...)` commits on top of V4 HEAD `55a2e12`, by Coordinator, Atlas, Vega, Havoc, Odin.
**Gates at report time:** smoke **249 checks PASSED** (all suites incl. soak + ws-soak), reachability PASSED (compound), map reachability PASSED (forest/snow/mars, 9/9 targets each), biome-check PASSED. Gate caveat: the passing run is the *working tree*, which includes Vega's net landing and Atlas's map wiring still uncommitted at this writing (§7.1) — when those land, committed tree = tested tree; Odin separately verified an earlier committed HEAD green in a clean worktree (0ea9f22).

Brett ordered at least two hours of mastering, multi-pass. The passes: Board 005 + lighting spec → version bump → Atlas map designs + data modules → Havoc numbers ruling → Board ratification → schema pass → Odin integration audit (lighting scene-verified) → client systems → per-map gates. Measure→refine loops ran throughout (Odin audits ×3, Havoc passes ×2, Atlas world passes ×5).

---

## 1. Scope ledger — Brett's directives D1–D11

| # | Directive | Status |
|---|---|---|
| D1 | **Lighting first**: sun in the sky / matching weather, richer shadows, never too dark | **DONE** — §2. Supersedes the V4 lock by owner order; the lock's readability intent is the floor. |
| D2 | Characters more realistic, people-like | **DONE** (Atlas `470980f`): rounder proportions, neck, headset+mic, vest wrap; hit cores byte-identical; soldiers + guns now cast shadows. Final court: Brett's playtest. |
| D3 | Landscape more realistic (snow the reference) | **DONE at data+builder level**; client wiring landing (§7.2). |
| D4 | More structures | **DONE** in the distinct-map builders (knoll/mast/cabin; hut row/comms tower/dome/snowcat; hab cluster/spire/greenhouse). |
| D5 | Work on everything again | Addressed per-system below; balance re-verified zero-drift by Havoc Pass 1. |
| D6 | ≥2 hours, multi-pass | Done (structure above). |
| D7 | **OWNER CORRECTION**: levels must be distinct maps, not re-lights of one compound course | **RULED + BUILT**: Board 005 §3; per-map data modules (`744f8ca`), layout builders (`56b8888`), per-map gates (`12d417b`). Client wiring in flight (§7.2) — registry honestly flags forest/snow/mars `transition` until it lands. |
| D8 | Smoke grenades: tactical choice, real LOS blocking | **DONE** solo + shared math: Havoc's chord rule (`equipment-data.js`), client bot perception via `Bot.smokeFilter`; sim carries the same function (Vega). Visual: Atlas's Points-core hybrid, 5 calls/volume quality-shedding (Odin's 13-call veto answered by redesign, not by the Board's earlier pooled sketch — see §6.3). |
| D9 | Customization: camos, attachments, prestige lane | **DONE**: camo vocabulary = `js/camo.js` (5 variants live, faction readability never overridden, zero-delta proven by Odin); +3 attachments inside the guardrail; camo unlocks on the prestige track L20–L26; combination counter prices all axes: **26,244,000** builds. |
| D10 | Claymores, trip mines, UAVs | **DONE** solo + shared tables: lethal slot is a choice (frag/claymore/tripmine), placed gear has HP/counters/readability signatures; UAV is a physical drone (below). |
| D11 | Perks + scorestreak ladder (borrow proven systems now, diverge later) | **DONE**: tiered-3 perks (8, placebo candidates killed in writing by Havoc); 5-streak ladder, every streak a real world object (Addendum 2 standard). Catalogs in §4. |

Also landed from Havoc's recheck: **the un-wedge fix** (top gameplay fix of V5) — stuck detection now judges distance-to-target progress; the V4 test defeated itself on lateral wall-slide, leaving the escape unreachable. Client committed (`3ce71b4`); sim parity rides Vega's landing (§7.1).

## 2. Lighting — before/after + acceptance evidence

**Before (V4 shipped):** one dusk rig for every level — sun at ~10° elevation, orange `0xff8f3c @1.85`, dusk fog `0x352130`, 2048 shadow maps, hemisphere `0.95`. Brett: "the sun looks like it's setting."

**After (Board 005 §2, `js/lighting.js`):** a weather profile per map — sky, sun, fog and light telling one story; profiles own exposure per map:

| Map | Story | Sun elev | Effective shadow proxy* | vs floor 0.36 |
|---|---|---|---|---|
| Compound | Clear late morning | 38° | 0.688 | 1.9× |
| Forest | Canopy morning | 36° | 0.597 | 1.7× |
| Snow Station | Bright overcast (hemisphere-dominant) | 45° | 1.125 | 3.1× |
| Mars Uplink | Butterscotch midday (sun painted in Atlas's dome — one sun per sky) | 42° | 0.473 | 1.3× |

\* `effectiveProxy = hemi × min(lum(hemiSky), mixLum(sky,ground)) × exposure/1.10`, computed by the shipped code; the floor 0.36 is exactly the V4 grade Brett passed — no shadowed area on any map reads darker than the grade he already approved.

**Acceptance evidence:** smoke L-suite (L1–L7: completeness, floor recomputed from the shipped table, sky/fog coherence, elevation bands, overcast signature, 4096 pins, bot emissive floor) green; Odin's independent scene-extraction audit matched table proxies to 4 decimals on all 4 maps, shadows measured 1.4×–7.1× brighter than the V4-passed grade, sun 36–45° everywhere. Shadow richness: 4096 maps (quality tiers scale down, never the floor), per-profile camera fit, soldier meshes + guns + new structures cast.

**Brett's eyes are the final court** — the headless bar is met on all four maps; the playtest verdict is his (§8).

## 3. The bars, scored honestly

- **REALISTIC — 11/12, target ≥10: MET.** V4's ten features re-judged present-or-improved (Atlas's soldier pass, gun realism held, POIs, biomes, effects) + lighting coherence (mandatory) PASS. The 12th — map identity *playable* in the client — is built (data + builders + gates) with wiring landing; it flips the moment §7.2 lands.
- **POWERFUL — MET (working tree).** Distinct layouts 1→4; online mode brains end-to-end in ws-soak; friendly bot fill fielded; loadout combinations 26,244,000 (≥500 bar); progression grew (26 unlock rungs + 11 prestige, zero power past L18); footprint 124 m on every map; no mode/XP regressions (smoke MD/PG suites).
- **SMOOTH — MET with a footnote.** Compound 156, Forest at the 165 line; Snow/Mars overage on the *legacy dressing* (168/167) was reclaimed by Atlas (`f04b883`: −4/−2, both debts paid); the distinct-layout builders sustain ~94–96 estimated — the overage does not carry into the layouts. Odin's streak-actor stress re-proof is owed when Vega's streak actors land in the sim (§7.1).
- **LIGHTING — MET** (headless bar, all 4 maps; §2). Playtest confirmation is Brett's.

## 4. Catalogs (D9–D11), in / deferred

**Perks — tiered-3, all 8 IN** (unlock rungs L3–L17): Lightweight, Stalker (movement) · Flak Jacket, Shade (defense) · Ghost, Cold-Blooded, Engineer, Scavenger (utility). Killed in writing as placebos by Havoc: fast-hands family and 7 others (ruling §5.3). Client applies all 8 where solo has a target; Ghost is sim-side versus enemy sweeps (its solo counterpart — enemy UAVs — doesn't exist in solo).
**Streaks — all 5 IN:** UAV 500 · Counter-UAV 650 · Care Package 800 · Sentry 1050 · Precision Strike 1300. Meter: score from XP events at value, **death does not reset**, spend-on-call, exactly 3 selected per class. Every streak a simulated object: UAV/CUAV drones (r30 @ 28 m/34 m, HP 150, shoot-down pays 75 XP), a physical crate (HP 60, contested 1.5 s claim, rolled-streak contents), a placed sentry (HP 100, 45 s battery), a warned strike (2.5 s, cover negates). **Precision Strike was the named M-CUT candidate — no gate forced the cut; it shipped.**
**Equipment:** lethal choice frag/claymore/tripmine (1/life, 8 m spawn-exclusion, HP 20, gunfire + explosions destroy). **Camo:** woodland base + desert/arctic/urban/night on the prestige track; `meridian` joins when Atlas lands it. **Attachments:** 14 total (3 new, guardrail-verified: none touches damage, all carry a stated cost).

## 5. Havoc ratification (Board 005 Addendum 3)

Havoc's full numbers ruling (`2e104c2`) was ratified as board law, superseding the Coordinator's interims on the record — including the 3-state smoke chord rule, tiered-3 perks over the one-slot interim, the no-reset streak meter, and UAV HP 150 over Addendum 2's 60. His sightline flags were accepted as data: fixed team spawn sets + Relay Assault staging from the tower-unseen set [S0 S1 S4 S8 S11] now live in `js/maps.js`.

## 6. Disclosures

1. **Gate basis.** Final gates ran on the working tree (§7.1–7.2 pending landings included). This is stated, not hidden: the committed tree alone does not yet contain Vega's sim or Atlas's wiring.
2. **One-token sim fix.** During diagnosis the Coordinator corrected one bare `groundHeightAt(...)` call in Vega's in-flight sim to his own `match.world.groundHeightAt(...)` pattern, then stopped editing his file. The sim's `streakScore` zero-on-death line conflicts with Havoc's ratified no-reset meter — Vega to reconcile in his landing.
3. **Smoke visual.** The Board's Addendum §9 sketched a single global pool (+1 call); Atlas shipped a better-answering design (5 calls/volume, quality-shedding to 2). The board accepts the built design; the sketch is superseded.
4. **Flight truth.** `js/streaks.js dronePositionAt` (Havoc: 14 m/s, 13.5 s lap) is the single path truth. Atlas's `js/uav-circuit.js` (46 s lap) was unreferenced; a staged deletion of it briefly rode into the Coordinator's client commit and was amended out — Atlas then retired the file himself (`693676b`), ruling closed.
5. **Scavenger economy.** The client has no reserve-ammo pool (V4 design), so the solo pack tops the current magazine instead of granting reserve rounds. Sim parity is Vega's call.
6. **Two registries.** `js/maps.js` (client/board) and the sim's internal `getWorld` both enumerate maps; unification is a V5.1 item, not a silent claim.

## 7. In flight / deferrals (owners)

1. **Vega — net landing:** sim world-seam + mode brains + V5 state (smokes/equipment/streaks), un-wedge parity hunk, streak-meter reconciliation (§6.2). ws-soak already proves the working tree.
2. **Atlas — map wiring:** `buildMapLayout` integration in world.js/main flow; on landing, registry flags flip to `distinct` and biome-check L-sections re-prove. Then Brett can play four genuinely different levels.
3. **Odin — streak stress re-proof** when 7.1 lands (≤0.02 ms/tick per actor proposed).
4. **V5.1:** real minimap (Coordinator + Lens — markers shipped instead), registry unification, selectable-streak UI polish (schema already validates any 3), online device friendly/owner rules (Vega + Havoc).

## 8. Brett's decisions

1. **PUSH V5** — the live site still serves V4 (0.4.0-dev). V5 goes live only on your approval; the push also arms the next online test night (runbook `docs/sessions/v4-test-night-runbook.md`).
2. **Lighting verdicts per map** in playtest — your eyes close D1 for real.
3. **Distinct maps**: whether the push waits for Atlas's wiring (§7.2) so all four levels ship distinct at once, or ships now with compound distinct + three in transition dress.
4. **Carried from V4** (still yours): §10.1 transport ratification (hand-rolled WebSocket proceeded on Board 003's recommendation), Havoc's 5 taste questions (defaults shipped), DMR-nest + north-corridor verdicts, corner ring spawns, F9 readings from your machine.

---

## 9. Post-report gate note (Coordinator, same session — read before pushing)

The §0 gate line was true when measured (smoke 249 PASSED on the tree as it stood). Two landings arrived while this report was being written, and the tree is hot again:

- **Atlas's compound pass (`693676b`, `a79a125`)**: inner course batched (compound draw calls 156 → **113**), an enterable Ops Building + Comms Shed added (+19 solids mirrored into worlddata), uav-circuit retired (his call, §6.4 closed). His new reachability rows currently report **4 failures** against the new geometry, with his tool edit still uncommitted — his gate caught his own geometry mid-landing; owner Atlas, in flight.
- **Soak S3 (waves stall)** is **intermittent in Vega's uncommitted sim**: passed in the 249 run, failing in the latest run (wave=1, clears=0), plausibly interacting with the new compound solids the sim now navigates. Owner Vega; the committed sim was clean-worktree-verified green by Odin at `0ea9f22`.

Nothing in the Coordinator's committed V5 code regressed — both reds live in the two landings §7 already flags as in flight. **Recommendation: Brett's push (§8.1) waits until Atlas's reachability rows and Vega's sim land and the full gate set re-runs green on the committed tree** — one clean re-verification, then V5 is ready to test-play.
