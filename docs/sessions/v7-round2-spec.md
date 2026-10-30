# V7 ROUND 2 SPEC — Over n' Out (Brett's call, Oct 30, 2026, ~01:45 PT)

Brett's verdict on V7: "kinda let down" — the jump didn't FEEL
huge; the wins were under the hood. Round-2 orders: "Add
vehicles to the new upgrade... Let's try again and don't stop
working on it until 7am really" + "Figure the team can get a
lot done in that time" + "I wanna see what those results look
like." Coordinator owns the tree (one pen). Work in gated
slices; every slice pushes live on green gates; stop starting
new slices at 07:00 PT; final report
docs/sessions/v7-round2-report.md.

## R2-1 VEHICLES (headline — solo first, online only if it gates clean)

- js/vehicles.js: VEHICLE_SPEC with two distinct types —
  RUNNER QUAD (fast/light, hp 220, top 17.5 m/s, exposed:
  armor share 0.25) and PATROL TRUCK (heavy, hp 420, top
  13.5 m/s, armor share 0.55). Distinct accel/brake/turn.
- Physics (stepVehicle, dependency-injected world env so the
  sim can adopt it later): throttle/brake/reverse, drag,
  steering authority grows with speed and TIGHTENS at top
  speed, terrain following via groundHeightAt, world collision
  via collide(), impact detection (hard wall hits cost hull +
  speed), disabled state at hp 0.
- Actors: createVehicleActor — ONE merged vertex-colored mesh
  per vehicle (geo.js merge), castShadow FALSE (shadow budget
  is 199/200 — no new casters, no reclaim games), +1 draw call
  per vehicle. Procedural only (roster rule). Body pitch/roll
  sells accel/steer/speed; wheels are merged (no spin — noted
  as polish deferral).
- Spawning: 2 pads (1 quad + 1 truck) at fixed coords clear in
  all four maps' collider data (probed against every
  worlddata module's allColliders + groundHeightAt) and clear
  of solo dressing colliders (gates + metrics probe). Respawn
  fresh each match.
- Interaction: E key (desktop) / USE touch button (new
  TouchUI button + interact hook) — proximity prompt on the
  context line. While driving: stick/WASD drives (same input
  object), firing + streaks disabled, gun viewmodel hidden,
  HUD line shows name / km/h / hull %, exit places the player
  at the first clear side offset.
- Combat: run-over damage vs hostile bots (speed-scaled,
  per-bot 0.6 s immunity, kill credit through bot.damage +
  onBotKilled); incoming bot fire routes through the single
  damagePlayer chokepoint — while driving, the vehicle
  absorbs its armor share of every hit (quad 25% / truck
  55%), so the truck genuinely tanks.
- Online: NOT in this slice. Sim adoption is a separate slice
  (R2-5) attempted only if R2-1..R2-4 are landed and green
  with time to spare; otherwise reported as deferred, never
  faked.

## R2-2 DOGS GUNFIRE HIT VOLUMES (the V7 deferral)

- Sim (where hostile gunfire vs dogs actually exists):
  shootSim gains dog AABB tests (enemy team only) →
  damageDogSim + 'hit' event (hitmarker via online.js onHit).
  stepSentries target loop gains dogs (branch damage path to
  damageDogSim; no player-kill credit for a dog). stepBot
  target selection gains dogs as valid targets within 25 m
  with a low-profile hit-chance scale (×0.6) — bots can now
  counter a pack that's mauling them.
- Solo: shoot() target building gains dog hit meshes with
  userData.dogRef; the pellet loop scans past FRIENDLY dog
  hits (no friendly fire, U6-07 — shots continue to the first
  real target behind), and would damage an enemy dog via the
  existing damageDog() if one ever exists solo. (Solo spawns
  no hostile dogs today — the volume is structural there; the
  live threat paths are online, above.)
- Regression: Kennel (seat 87) pins — smoke T12 extension +
  soak: pack still spawns/bites/expires; a scripted player
  shot kills a 60 hp dog; a bot engages a dog in sim.

## R2-3 LANDSCAPE UPLIFTS — Forest (Fern, 53) / Snow (Drift, 55) / Mars (Dune, 57)

- Per map: +6 dressing pieces in the EXISTING instanced/
  merged vegetation path (+0 draw calls): Forest undergrowth
  bushes, Snow snow-loaded bushes, Mars rock/regolith
  clusters — each placed from the map's own scatter data
  contract (BUSH_SPOTS / DRIFT_SPOTS / ROCK_SPOTS style),
  colliders mirrored in the map's data module exactly like
  Compound ring bushes II (blocking rule: size >= threshold
  gets a collider box ±0.75·size, top 0.72·size).
- Safety net per map: biome-check, reachability-maps,
  sightline audit, metrics tri ledger (Forest headroom
  guarded first — tightest map, ~16k tris spare; a bush mass
  is ~200 tris, +6 = ~1.2k per map).
- Trees' direction untouched (Brett praised them).

## R2-4 MOVEMENT FEEL (Stride, 12) — only if R2-1..R2-3 landed

- Small, measured, reversible: walking locomotion + look
  polish that does NOT touch top speeds, jump constants, or
  reachability (all pinned). Candidates: bob envelope on
  walk start/stop already exists (V6-3); scope to (a) a
  strafe-lean gain pass within existing clamps, (b) landing
  dip recovery curve check. If nothing measures better, ship
  nothing and say so — no churn for its own sake.

## R2-5 ONLINE VEHICLES (stretch — only on a clean runway)

- Sim: vehicle states in match, validated input (throttle/
  steer from the existing input frame), stepVehicle with the
  sim's own collide/ground env, snapshot carriage, client
  actors from snapshot. If any gate resists, STOP, leave solo
  vehicles as the shipped truth, report plainly.

## Versioning + gates (every slice)

- v0.7.1 / BUILD V7.1, then .2/.3…; pins re-pinned per stamp
  (smoke M-series, mobile-check T7 named witnesses).
- Five gates green on the git-archive snapshot before every
  push (tools/gates-parallel.sh) + spec-audit + soak where a
  slice touches sim/streaks. Push via gh_push_contents.py,
  Pages build, byte-exact live verification (Bytewise, 88).
- Screenshots: NO browser/renderer exists in this environment
  (all tooling is headless Node with THREE stubs; no chromium
  binary) — visual proof = live build stamps + the concrete
  in-game checklist in the report (where to stand, what to
  look at), stated honestly rather than faked.

## R2-5 DESIGN (deferred — written 04:10 PT, Coordinator)

Online vehicles were NOT attempted in round 2: the recon
below priced the full build at 2.5–3.5 h against ~2.75 h of
safe window, and the round's law is that nothing half-wired
ships. The design is complete and ready for a future build:

- PROTOCOL: one optional edge on the input sample —
  `interact` (strictly boolean when present), following the
  lethal/tactical/place precedent in net/protocol.js
  validateInput. No version bump (same as the streak edge).
- SIM: match.vehicles spawned at createMatch from
  VEHICLE_PADS (probed clear against every worlddata
  allColliders() superset, so clear in the sim's
  SOLIDS+EXTRA subset too). stepVehicles(match, dt, events)
  runs after stepDogs in stepMatch's order. Env adapter:
  { colliders: match.world.colliders, bounds:
  match.world.bounds, groundHeightAt:
  match.world.groundHeightAt, collide: (pos, r, c, b, fy) =>
  collide(pos, r, fy, match.world) } — the sim's collide has
  the (pos, radius, feetY, world) signature (sim.js:209).
  js/vehicles.js stepVehicle drops in unchanged — that is
  why the physics was built THREE-free with an injected env.
- ENTER/EXIT: stepPlayer consumes input.interact as an edge
  (prevInteract): not driving → nearest non-disabled vehicle
  within 3.5 m becomes p.vehicleId (event veh_enter);
  driving → exit at the first clear side offset via the sim
  collide (event veh_exit). Death/respawn clears vehicleId.
  While p.vehicleId: stepPlayer's movement block is replaced
  by stepping the vehicle from keys (throttle fwd−back,
  steer right−left); p.pos = vehicle pos, p.yaw = heading;
  firing, throws, place, and streak edges are server-ignored
  (mirror the solo lockout).
- COMBAT: damagePlayerSim applies the armor split at entry
  (dmg × armorShare to the hull via damageVehicle, rest to
  the player; veh_down event at disable). Run-over in
  stepVehicles: driven vehicles with |speed| > 3.5 damage
  enemy BOTS in radius (damageBot + kill event via
  'vehicle') — players are all team 'you' in the current
  mode set, so player-vs-player run-over does not arise.
  Dogs biting a driver flow through damagePlayerSim and
  split automatically.
- SNAPSHOT: snap.vehicles (only while any exist):
  [id, specId, r1 x/y/z, heading, r1 speed, hp, disabled,
  driverId|null]; players[] entries gain veh: vehicleId.
- CLIENT: online.js upserts vehicle actors from
  snap.vehicles (createVehicleActor, interpolation like
  puppets). For the DRIVER's own vehicle: local prediction —
  step the shared state with the local env each frame in
  main.js's online branch, correct toward the server pose
  with the existing rule (snap > 3 m, blend 0.25 > 0.3 m);
  camera/HUD reuse the solo stepDrive presentation (engine
  audio + FOV + #vehicle-hud fed from the local state).
  Interact input: KeyE / touch USE set an edgeInteract flag
  in state 'online', carried by buildOnlineSample.
- TESTS BEFORE PUSH: protocol pin (interact optional
  boolean); DG-style sim tests (enter requires proximity +
  rejects a disabled wreck; drive steps + collides; armor
  split math through damagePlayerSim; run-over kills a bot
  and credits the driver; exit places the player clear);
  soak + ws-soak unchanged-green; smoke source pins for the
  client wiring. Estimated: sim+protocol ~1 h, client ~1 h,
  tests/debugging ~1 h.
