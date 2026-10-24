# Board Meeting 001 — Minutes

**Date:** Oct 23, 2026 · **Chair:** Dominic "Apex" Cross (CEO) ·
**Co-chair:** Elena "Verity" Marsh (Chief Realism Director)
**Vital task on the table:** *Ship v2 — weapons system with player + bot
selection, realism batch, zero critical bugs.*
**Outcome:** v2 ships. Every critical below is resolved; the smoke suite
is green at 60 checks. Nothing pushed — Brett approves pushes.

## Vital issues

### Critical — all resolved

1. **Playtest: platforms unreachable, leading nowhere** (raised by Brett
   hands-on). Jump apex was 1.47 m; the lowest structure stood 2.2 m.
   Owners: Hugo "Mason" Brandt (course), Derek "Forge" Malone + Anders
   "Bedrock" Lindqvist (engine), Jamal "Stride" Carter (jump tuning),
   Tomás "Hunter" Vega (bot floors), Walter "Hawkeye" Boone (verify).
   **Resolution:** 3-floor course (decks 2.3 m, rooftop 4.6 m) with two
   walkable stair stacks + crate-hop alternates per level; height-aware
   `groundHeightAt` + `collide(feetY)`; jump retuned to 9.5/24 (apex
   ≈1.88 m); bots floor-aware; Hawkeye's route audit: all PASS.
2. **Weapons table consumed nowhere** — `main.js`/`bots.js` still
   hardcoded the v0.1 rifle. Owners: Tanya "Trigger" Ruiz (player),
   Kenji "Ghost" Sato (bots); implemented by Bedrock + Hunter.
   **Resolution:** both shooters read the table at runtime; dead
   constants grep-verified gone; AR row pinned by a smoke regression
   check to the v0.1 values.
3. **Bot weapon ranges were dead values** — engagement was gated at a
   hardcoded 42 regardless of weapon. Owner: Ghost/Hunter.
   **Resolution:** range, burst, cadence, damage all read from each
   weapon's `bot` block.
4. **DMR spawn-sniping** — range 60 + fixed spawns + 0.32 s high-wave
   aim-up = hits from spawn with no warning. Owner: Hunter.
   **Resolution:** 2.2× aim-up, 55 m first-engage cap, 38 m standoff
   movement, 1.2 s spawn-cooldown floor, concurrent-DMR caps.
5. **SMG burst-accuracy inversion** — the Session 1 accuracy array gave
   the SMG's last three shots peak accuracy. Owner: Hunter.
   **Resolution:** 5-step decaying shape [0.6, 0.85, 1.0, 0.92, 0.78].
6. **Bot line-of-sight cost** — 540 raycasts/s at 9 bots, ~32× the
   player's load. Owner: Ghost (design), Hunter (implementation).
   **Resolution:** LOS staggered to ~20 Hz per bot with cached results.
7. **Tracer material leak** — a material created per shot, never
   disposed. Owner: Felix "Ember" Novak (area), implemented by Bedrock.
   **Resolution:** 32-slot pre-allocated tracer pool; zero per-shot
   geometry/material allocation; ≤3 tracers per shotgun pull.
8. **Static-server allowlist bypass (encoded slashes)** —
   `/js/%2e%2e%2fserver%2fserver.js` served full repo internals
   (source, `package.json`, `.git/config`) despite the Session 1
   allowlist. Found live by Grace "Aegis" Liu. Owner: Sam "Pipeline"
   Ortiz; fix executed by the chair; sign-off Priya "Lockdown" Nair.
   **Resolution:** the server authorizes the *resolved* path relative
   to ROOT; three new smoke probes cover `%2e%2e%2f` under each public
   prefix; bypass verified closed live, legitimate routes unaffected.
   *Process note:* this was a defect in the chair's own Session 1 fix —
   the string-prefix check ran before path normalization.
9. **`docs/MULTIPLAYER.md` missing.** Owner: Sofia "Uplink" Petrova.
   **Resolution:** created and verified line-by-line against the code
   (665 lines): authoritative-server design, protocol sketch, state
   sync, anti-cheat, M0–M4 migration with a loopback transport.
10. **Step tolerance vs stair rise** — stairs rise 0.575; the tolerance
    shipped at 0.55 would have walled every staircase. Flagged by
    Mason. Owner: Forge (chair's ruling). **Resolution:** tolerance
    widened to 0.6 in both `groundHeightAt` and `collide` before the
    course ever shipped broken. **Standing warning (Hawkeye):** the
    margin is 0.025 — never reduce the tolerance or raise step height
    without re-cutting both together.

### Major — resolved unless marked

11. **Burst shape inverts single-shot weapons** (Verity/Ghost).
    Hunter: burst-1 weapons fire at a flat 0.95 + per-weapon hit
    scalars (DMR 1.9× only at ≥25 m). Resolved.
12. **Bot damage flat with distance** (Verity). Hunter: bot rolls now
    take the weapon's falloff curve. Resolved.
13. **One standoff profile for every weapon** (Verity/Ghost). Hunter:
    per-weapon movement table (shotgun closes at 1.22× speed; DMR
    holds 24–48 m). Resolved.
14. **Aim-up and flinch calibre-blind** (Verity/Ghost). Hunter:
    per-weapon aim multipliers, damage-scaled flinch (0.15–0.35 s),
    pre-shot flinch refund (cooldown ≤0.4 s), burst-1 weapons keep
    half their aim through a flinch. Resolved.
15. **All five weapons sounded identical** (Verity/Ghost). Nina "Echo"
    Kowalski: descriptor tables parameterise player and enemy fire;
    the AR 'crack' remains the exact default. Resolved.
16. **Sun at a ~50° midday angle inside a dusk sky** (Verity).
    Iris "Prism" Chen: sun lowered to 12.3° on the same azimuth —
    light, disc, glow moved together — and warmed to match. Resolved.
17. **Shotgun frame spike + hot-loop allocations** (Feather).
    Bedrock/Hunter: target list built once per pull, hoisted temp
    vectors, one sound/hitmarker per pull. Resolved.
18. **Bot fire must stay abstract** (Feather guardrail). Held: no
    per-shot raycasts or tracers for bots. Resolved (rule in force).
19. **Bot class fuses simulation and presentation** (Uplink) — v3's
    critical path. **Partial:** v2 lands all bot weapon state as plain
    data fields; the sim/puppet split itself is scheduled at v3
    M1–M2 in `docs/MULTIPLAYER.md` §8. Not a v2 blocker.
20. **`matchState` grouping seam** (Uplink). **Resolved for v2** by
    chair's ruling: existing globals stay (inventoried in
    MULTIPLAYER.md §6.1), all new weapon state is grouped (`mags`
    map + grouped fields); full grouping lands with the M2 loopback
    refactor, where the design doc already schedules it.

### Minor — resolved, accepted, or noted

21. **Fog eats DMR range** (Verity). Prism: fog 38→118 became 45→150.
    Resolved.
22. **Shotgun reload plausibility** (Verity). Owner: Rosa "Ballistic"
    Delgado. **Accepted:** treated as a mag-fed gun; balance is tuned
    around 2.4 s; playtest note filed. Deliberately unchanged.
23. **Audio distance curve / SMG spread nits** (Verity). Owners: Echo /
    Ballistic. **Accepted** as playtest notes; unchanged to preserve
    the briefed feel.
24. **Loadout `data-weapon` not canonicalized** (Aegis). A tampered
    attribute could key `mags` by a raw id → NaN HUD. Owner: Trigger;
    fix by chair: `getWeapon(...).id` at the click handler,
    `startRun`, and `switchWeapon`. Resolved.
25. **The codebase's only `innerHTML`** (Aegis; pre-existing, internal
    numbers only, not exploitable). Owner: Maya "Lens" Ibrahim; fix
    by chair: death message rebuilt with DOM APIs. Resolved — no
    `innerHTML` sinks with dynamic data remain.
26. **Prototype-key bracket lookups** in audio/bot tables (Aegis).
    Owner: Echo. **No fix required:** keys are canonicalized weapon
    ids only; switch to `Object.hasOwn`/Map if a key ever becomes
    external data.
27. **v2 test gaps** (Sentry). Owner: Dev "Tripwire" Patel.
    **Resolved:** 28 new checks (weapons import/contract/numerics,
    button↔id contract, version, DOM ids, AR pin) + 3 bypass probes;
    suite at 60 checks, all green.
28. **Rooftop DMR nest + slow north-corridor spawn** (Hawkeye).
    Owner: Ghost (balance watch). **Accepted:** mitigations verified
    (slowest aim-up in the game, two same-level counters, exposed
    faces); revisit after Brett's playtest.
29. **WebSocket implementation decision** — hand-rolled RFC 6455 vs
    the `ws` dependency (Uplink). Owner: Victor "Vault" Hale.
    **Deferred** to v3 planning; blocks nothing in v2. Also deferred:
    v3 hosting/region (Vault, with Brett).
30. **Process incidents, honestly recorded:** Aegis's first security
    dispatch was lost to an infrastructure error and re-run against
    the finished tree (her findings above are from the re-run); a
    stale server process on the smoke port caused one phantom failure
    during Session 1 verification (ephemeral-port fix carried to the
    next batch's list).

## Per-seat assignments (all 33 seats)

1. **Dominic "Apex" Cross (CEO, chair)** — chaired the meeting and
   session; froze the API/DOM contracts; step-tolerance and seam
   rulings; executed the server + canonicalization fixes; commits,
   minutes, and this report.
2. **Victor "Vault" Hale (CTO)** — security sign-off and performance
   budget enforcement (co-played by the chair); owns the deferred
   WebSocket and hosting decisions.
3. **Elena "Verity" Marsh (Chief Realism Director, co-chair)** —
   realism gate for v2: audited the table and Batch 1, made the
   shotgun/DMR value pass in `weapons.js`, filed the realism issues.
4. **Derek "Forge" Malone (Engine Lead)** — height-engine slice:
   co-designed the `groundHeightAt`/`collide(feetY)` contract and the
   step-tolerance ruling.
5. **Tanya "Trigger" Ruiz (Gameplay Lead)** — player-side weapons
   integration ownership (loadout, switching, HUD data flow).
6. **Kenji "Ghost" Sato (AI Lead)** — bot weapon design: distribution
   rule with caps, movement/fairness tables, DPS guardrails.
7. **Priya "Lockdown" Nair (Backend & Security Lead)** — secure-calls
   review ownership; sign-off on the resolved-path server fix.
8. **Owen "Sentry" Gallagher (QA Lead)** — v2 test-gap analysis:
   prioritized check list for the smoke suite.
9. **Sofia "Uplink" Petrova (Multiplayer Director)** — owns
   `docs/MULTIPLAYER.md`: verified the design, added the per-weapon
   ammo state and the `matchState` seam requirement.
10. **Anders "Bedrock" Lindqvist (Principal Engine Engineer)** — the
    hardest problem: weapons integration into `main.js`/`player.js`,
    tracer pool, height-aware player physics.
11. **Iris "Prism" Chen (Graphics Senior)** — Session 1 graphics;
    lowered the sun to 12.3° and retuned fog for the DMR.
12. **Jamal "Stride" Carter (Movement Senior)** — jump tuning:
    velocity 9.5 / gravity 24 (apex ≈1.88 m) ratified for the course.
13. **Rosa "Ballistic" Delgado (Weapons Senior)** — authored the
    5-weapon data table in `js/weapons.js`.
14. **Tomás "Hunter" Vega (Bot AI Senior)** — Session 1 bot realism;
    v2 bot build: weapons, weapon-aware movement, floors, LOS
    stagger, per-weapon visuals.
15. **Nina "Echo" Kowalski (Audio Senior)** — Session 1 audio;
    per-weapon sound identity via descriptor tables.
16. **Sam "Pipeline" Ortiz (Backend Senior)** — static-server
    ownership: Session 1 allowlist; Board 001 resolved-path fix
    under his ownership.
17. **Grace "Aegis" Liu (Security Senior)** — v2 security review;
    found and proved the critical allowlist bypass.
18. **Leo "Feather" Park (Performance Senior)** — v2 performance
    risks and the 2.0 ms weapons frame budget; mitigation list.
19. **Hugo "Mason" Brandt (World Developer)** — the multi-floor
    course, height API implementation, and the landscaping pass.
20. **Maya "Lens" Ibrahim (HUD/UI Developer)** — loadout picker, HUD
    weapon name, v0.2 tag, switch-weapon controls entry.
21. **Felix "Ember" Novak (Effects Developer)** — effects ownership:
    tracer-pool requirement adopted into the engine pass.
22. **Zoe "Pivot" Laurent (Animation-Feel Developer)** — feel input
    to flinch behaviour and view-model response (kickback scaling).
23. **Eli "Ledger" Brooks (Systems Developer)** — wave/difficulty
    systems review behind Ghost's weapon caps.
24. **Ruth "Wrench" Callahan (Tools Developer)** — tooling health;
    carries the smoke ephemeral-port item into the next batch.
25. **Dev "Tripwire" Patel (Test Automation Developer)** —
    implemented the v2 smoke expansion (28 checks + AR pin).
26. **Clara "Herald" Jensen (Docs Developer)** — drafted
    `docs/MULTIPLAYER.md` and the ROADMAP v0.2/v3 updates.
27. **Benny "Rookie One" Cole (Junior Developer)** — junior support
    pool; on call for guided fixes (none activated this session).
28. **Alina "Rookie Two" Kim (Junior Developer)** — junior support
    pool; on call for guided fixes (none activated this session).
29. **Deshawn "Rookie Three" Miles (Junior Developer)** — junior
    support pool; constants/content passes on standby.
30. **Petra "Rookie Four" Nagy (Junior Developer)** — junior support
    pool; cleanup passes on standby.
31. **Walter "Hawkeye" Boone (QA Tester)** — reachability audit:
    every route, spawn, and cover placement verified; audio
    signature dispute settled.
32. **Ingrid "Bullseye" Falk (QA Tester)** — regression verification
    against the expanded smoke suite (60 checks green).
33. **Tim "Sprout" Nguyen (Studio Intern)** — session records:
    minutes and report filed under `docs/sessions/`.
