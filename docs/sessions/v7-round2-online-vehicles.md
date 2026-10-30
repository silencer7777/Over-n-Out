# Over n' Out — V7 Round 2, FINAL slice: ONLINE VEHICLES (R2-5) — v0.7.5 / BUILD V7.5

Written Fri Oct 30, 2026, ~03:00 PT (Coordinator, final
Round-2 slice; Brett's standing order: work until 07:00 PT,
gated slices push live as they pass). This closes the last
Round-2 deferral: the design written at 04:10 PT in
`docs/sessions/v7-round2-spec.md` (R2-5) is now built,
gated, and live. Solo vehicles shipped in V7.1; this slice
takes them online — server-authoritative, on the same
shared physics, with no new trust paths.

## What shipped

**Protocol (net/protocol.js).** `interact` joins the input
frame as an optional edge — strictly boolean when present,
exactly the lethal/tactical precedent in `validateInput`.
No protocol version bump: frames without the field stay
valid.

**Sim (net/sim.js).**
- Vehicles spawn per match from `VEHICLE_PADS` on every map
  and mode (v1 RUNNER QUAD, v2 PATROL TRUCK), stepped by the
  shared THREE-free `stepVehicle` — the sim bridges its own
  `collide(pos, radius, feetY, world)` into the vehicles.js
  env, so vehicles obey the same colliders and compound
  bounds as players.
- Enter/exit are server-validated from the interact edge:
  nearest non-disabled, unoccupied vehicle within 3.5 m and
  |Δy| < 3; exit mirrors the solo offsets (right, left,
  rear — first clear landing wins) and emits `veh_enter` /
  `veh_exit` (wired to the killfeed + announcer lines).
- Driving REPLACES the walker: WASD steps the vehicle, the
  player rides at its pose (yaw = heading), and
  firing/throws/placing/streak-calls are server-ignored —
  the solo lockout. Player yaw in the snapshot stays the
  vehicle heading; pitch stays free-look.
- `damagePlayerSim` splits incoming damage by the spec's
  `armorShare` AT ENTRY (before flak): the hull takes its
  share through `damageVehicle` (a disabling hit emits
  `veh_down`), the remainder hits the driver; a disabled
  wreck stops absorbing. Dogs bite the split like any other
  damage — one 20-dmg bite in the truck = 11 hull + 9 player.
- Run-overs: a driven, non-disabled vehicle above 3.5 m/s
  damages enemy bots in contact (spec radius + 0.55),
  scaled by speed, credited to the driver (`via: 'vehicle'`,
  streak credit through the kill ledger), with a 0.6 s
  per-target immunity and speed scrub per hit. Drivers
  cannot run over players (snapshot ricochet posture stands)
  — the same call the design made.
- Death and respawn free the vehicle (it stays where it
  died, driverless); a disabled wreck keeps its driver
  seated until they E out — a wreck is cover, not a trap.

**Snapshot.** `players[]` entries gain `veh` (vehicle id or
null); a new `snap.vehicles` carries rows of `[id, specId,
x, y, z, heading, speed, hp, disabled, driverId]` whenever
the match has vehicles. Clients never assert vehicle state.

**Client (js/online.js, js/main.js).**
- `OnlineSession` syncs `snap.vehicles` into
  `createVehicleActor` models — **castShadow false by
  design, so the 199/200 shadow budget is untouched** —
  interpolated with the puppets' rule. The DRIVER's vehicle
  is exempt: `main.js` predicts it locally with the shared
  physics and feeds the pose through `setOwnVehicle()`.
- Prediction + correction per the standing player rule:
  step locally every frame, snap beyond 3 m, blend 0.25
  beyond 0.3 m (heading on the shortest arc); hull/disabled
  sync from the row every snapshot.
- KeyE and the touch USE button set the `interact` edge that
  rides `buildOnlineSample` (both the live sample and the
  chat-open neutral sample carry the field). While driving,
  the local walker stands down (the countdown's neutral
  input), the gun hides, and the solo drive presentation
  runs on the predicted state: seat camera + impact shake,
  speed FOV bloom, procedural engine loop, hull HUD,
  context line. Prompts, the ENTER offer (≤ 3.0 m), and the
  minimap vehicle squares all reuse the solo language —
  online, the squares come from the session's snapshot
  fleet, with the white outline on the vehicle you drive.
- `leaveOnline` tears the drive state down cleanly (engine
  off, gun back, HUD hidden).

## Proof

- **OV0–OV8** in `tools/smoke.mjs`: protocol strictness;
  enter gating (proximity, occupancy); wreck refusal; drive
  (quad peaks at exactly 17.5 m/s, bounds stop it, impacts
  scar the hull, rider glued); armor split + driver-death
  freeing; run-over credit; exit placement; snapshot
  carriage; client wiring pins.
- **End-to-end probe** through the real `GameServer` +
  `LoopbackTransport`: hello → wire `interact` → `veh_enter`
  event → snapshot shows v1 driverId p1 at full hull →
  1.2 s of wire forward input drives z 30 → 18.9 at
  17.5 m/s → wire `interact` → `veh_exit`, driverless.
- **Gates on the git-archive snapshot of the shipped
  commit: all five PASS** (smoke, biome-check,
  reachability, reachability-maps, mobile-check) and
  `tools/spec-audit.mjs` is clean.
- **Perf:** no new shadow casters (199/200 held); vehicle
  actors exist only mid-match (same as solo); no metric
  moved — the render battery in smoke is unchanged.
- **VH7 named re-pin:** the minimap pin followed the shared
  `mapVehicles` projection (solo + online fleets through one
  loop); the pin also witnesses `session.vehicleView()`.

## Honest limits

- Screenshots remain impossible in this environment
  (headless Node only). Proof = live stamp + tests + the
  playtest checklist below.
- The client prediction is validated by construction (same
  physics + correction rule as the proven player path) and
  by the sim tests; its *feel* over a real network (latency,
  jitter) can only be judged on the multiplayer test night.
- Two players racing for the same vehicle: the server's
  edge order decides; the loser simply stays on foot (their
  client never entered — verified in OV1).
- Vehicle-vs-vehicle collisions are not modeled (vehicles
  pass through each other); with two vehicles per match this
  is a feel item for a later round, not a correctness hole.

## Playtest asks (online — needs the test-night host)

1. Drive the quad online: does the prediction feel tight —
   any rubber-banding on turns or wall taps?
2. Truck armor: does the 55% split feel fair when a bot
   pack focuses you?
3. Run over a bot online — hitmarker + killfeed credit land?
4. Get shot out (or wrecked) and E out of the wreck — clean?
5. Watch a teammate drive: does their vehicle move smoothly?
6. Minimap: your vehicle outlined white; wrecks grey.
