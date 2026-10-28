# V6 Update 10 — Spec: Minimap + Objective Guidance + Hardening Slice

Board: Coordinator (chair) · Lens (HUD/UI) · Uplink/Vega (online) ·
Lockdown + Aegis + Pipeline (security) · Odin (perf veto) ·
Havoc (numbers — none changed) · Sentry (gates)

## Why this update (grounding)

- Landed count is **9** (ledger). Brett's re-test verdicts on U9
  (build stamp / rotation / death fall) are still owed — nothing
  in this update touches those systems, so it cannot mask them.
- Queue head per Brett's Oct 28 04:29 spec (MEMORY directive,
  outranks the ledger table): **a MAP (minimap)**, and in
  DOMINATION **capture points on it** (lettered markers coloured
  by owning team — MERIDIAN cyan / KESTREL red / neutral) plus
  **in-world objective guidance** (direction + distance) so every
  player knows where to go. Must work on all devices and respect
  perf budgets.
- Watch write-up (guardian.log, Oct 28 05:07 PT) addressed to
  build sessions: (1) `net/game-server.js` defaults to bind
  0.0.0.0 plain ws:// — not localhost-behind-tunnel / WSS-only
  per the Oct 28 hardening order; (2) `index.html` has no CSP.
  Both are in scope under the standing security priority.

## Items (owner + acceptance)

- **U10-01 Minimap (Lens, Odin perf-cleared).** A north-up 2D
  canvas in the HUD (`#minimap`, 148px desktop / smaller on
  touch), mapping the playable bounds (±80, `BOUNDS`) to the
  square. Player = centre arrow rotated by yaw; living bots =
  dots (friendly cyan `TEAM.you`, hostile red `TEAM.kestrel`);
  Domination zones = lettered circles (A/B/C) coloured by owner
  (cyan / red / neutral grey) at true radius scale; Assault =
  the relay point marker. Dots are clamped to the map edge
  (anti-glitch: nothing off-map leaks a position). Redraw is
  throttled (~8 Hz) and is plain 2D canvas — **zero new THREE
  draw calls, zero shadow casters**; Odin's budgets untouched.
  Acceptance: pure mapping helpers in `js/minimap.js` are
  unit-pinned (mobile-check T8); markup/CSS wiring pinned;
  minimap hidden outside live states (it lives inside `#hud`).
- **U10-02 Objective guidance (Lens + Trigger).** A HUD pill
  (`#objective-guide`) under the objective line: an arrow
  rotated to the target's bearing **relative to the player's
  facing**, the target letter/name, distance in metres, and the
  verb (CAPTURE / DEFEND / CHANNEL). Domination target = nearest
  zone not owned by MERIDIAN (CAPTURE); if all zones are held,
  the nearest held zone (DEFEND). Assault target = the Carrier
  relay (CHANNEL). Waves/TDM = no pill. Solo reads `M.zones`;
  online merges snapshot zone owners onto the mode table's
  coordinates by id. Acceptance: `guidanceFor()` pure-function
  pins (ahead = 0 rad, east-of-north-facing = +90°, distance
  exact); wiring pins in mobile-check T8.
- **U10-03 Secured ports (Lockdown + Pipeline).**
  `net/game-server.js` default bind **127.0.0.1** (was 0.0.0.0)
  in both the factory default and the direct-run env fallback;
  reaching beyond localhost is now an explicit `HOST=` opt-in
  the operator must type. Boot log states the posture: plain ws
  on localhost ONLY, TLS/WSS is terminated by the tunnel
  (cloudflared) in front of it — exactly Brett's runbook shape.
  `net/README.md` gains the hardening section: the bind rule,
  the tunnel rule (no raw public ports), and host firewall
  rules (deny inbound 8081 except loopback; tunnel egress only).
  Acceptance: source pins in smoke (default host literal);
  ws-soak still green (it binds its own test server — if it
  relied on the old default, it is re-pinned by name here).
- **U10-04 CSP (Aegis).** `index.html` gains a
  Content-Security-Policy meta: `default-src 'self'`,
  `object-src 'none'`, `base-uri 'self'`, script/style/img/
  font/connect sources restricted to self + the ws/wss/https
  transports the online client legitimately uses.
  `'unsafe-inline'` is kept for script/style **honestly**: the
  importmap is inline by spec and HUD code sets inline styles;
  removing it needs a nonce/hash build step this repo does not
  have. The meta still blocks external script origins, plugins,
  and base-tag hijack. Acceptance: meta present (smoke pin);
  all gates green; no game behaviour change.
- **U10-05 Build witness bump (Sentry).** Build 9 → 10 in the
  four mirrored places (menu stamp, ono-build meta, `?v=10`
  assets, `BUILD_NO`). mobile-check T7 re-pinned 9 → 10 —
  **named re-pin, witness-only**.

## Out of scope / deferred

- Scenery/mountains (queue 5) and meta systems (queue 6) —
  next sessions. Characters/movement got their slices in
  U7/U9 and await Brett's verdicts before more spend.
- Stage-2 session verification (signed tokens) — still the
  named open hardening item; too large for this slice, stays
  in the ledger as the blocker to "public" hosting.

## Perf baseline (pre-build, v6-metrics on U9 tree)

Calls 131/144/143/145 (compound/forest/snow/mars, bar 165);
forest tris ≈266k/300k after U9; shadow est. 199/200 (binding).
This update adds **no** THREE geometry: expected Δ0 everywhere.
