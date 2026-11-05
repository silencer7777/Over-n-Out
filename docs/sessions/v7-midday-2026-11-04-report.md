# Over n' Out — Midday Build Session, Wed Nov 4, 2026, 13:53 PT

Coordinator session. STAND-DOWN / VERIFICATION — no game code
changed, nothing pushed by this session. One headline finding:
**the GitHub Pages deployment of V7.15 has landed.**

## Headline: live is now BUILD V7.15 (Pages incident resolved)

- This morning (~09:35 PT) live still served V7.13 while
  V7.14+V7.15 sat correct on remote main — Pages builds had
  errored in a burst (see v7.15-look-smoothness-report.md).
- Watch rotations 10:07, 11:07, 12:07 and 13:07 PT all report
  live BYTE-IDENTICAL (cmp) to local HEAD b360c91:
  index.html 14,819 B, js/main.js 165,945 B, js/world.js
  96,716 B — live serves BUILD V7.15, no drift/tampering.
- This session independently confirmed: local HEAD sizes match
  those exact numbers, and a live fetch of
  https://silencer7777.github.io/Over-n-Out/ shows the menu
  footer "BUILD V7.15 · v0.7.15", version line "TACTICAL
  BROWSER FPS · v0.7.15", and the controls line "RIGHT-CLICK
  (HOLD) Aim down sights — every gun has a sight".
- Brett's tell from this morning is satisfied: the menu footer
  reading BUILD V7.15 means the queued build deployed.

## Why no new update was built

- The schedule body still carries the stale Oct 28 V6-only law.
  It is superseded, as the AM session recorded: Brett called V7
  explicitly on Oct 30, V6 closed at 15, and V7.1–V7.15 have
  shipped since. Protocol step 1: Brett's newest specs outrank
  the schedule body/ledger.
- The Nov 4 playtest fix train (V7.10 touch rotate, V7.11
  gunshots, V7.12 traveling tracers, V7.13 menu tabs, V7.14
  procedural clouds, V7.15 look smoothness) shipped today in
  direct response to Brett's playtest asks. It is now live in
  full and **un-playtested**. Building a V7.16 on top of it
  before Brett's verdicts would violate the focus queue, which
  his verdicts set.
- No new Brett directive and no Watch write-up addressed to
  build sessions is outstanding (Watch 13:07 PT: all-pass,
  no Medic fixes, tree clean).

## Grounding (protocol step 1)

- Working tree at start and end: CLEAN. HEAD b360c91
  (docs: V7.15 report) on top of a01694a (V7.15 look),
  53e67d7 (V7.14 clouds), b37d551 (V7.13 tabs), 8e4523d
  (V7.12 tracers), 1db281c (V7.11 gunshots), 0e8b92d
  (V7.10 touch rotate). Version 0.7.15, BUILD V7.15.
- Roster: 88 seats + 10-bot Watch, FINAL per Brett Oct 30.
- Lockdown backend pass (Nov 4) verified intact by Watch:
  localhost bind, WSS via tunnel only, caps (64 conns / 8 per
  IP / 32 rooms, 4096 B msg, input 40/s), Origin allowlist,
  violation logging, server-authoritative speed/fire/damage.

## Verification (this session, on local HEAD b360c91)

All five gates re-run this session, all green, exit 0:

- tools/smoke.mjs — SMOKE PASSED
- tools/biome-check.mjs — BIOME CHECK PASSED
- tools/reachability.mjs — REACHABILITY PASSED
- tools/reachability-maps.mjs — MAP REACHABILITY PASSED
- tools/mobile-check.mjs — PASSED, all synthetic-touch
  scenarios (T1–T16 incl. touch ADS, V7.13 tabs T15,
  V7.15 look T16)

Perf: Δ0 — no code changed. Budgets held at last measure:
sustained calls ≤165/map, tris ≤300k, shadow casters 199/200.

Device status: desktop + tablet/mobile verified by gates
(mobile-check green; touch controls incl. ADS/USE passing).
Scopes: HOLD right mouse button to aim down sights — iron
1.15× on every gun, plus red dot, holo, mid scope, sniper
scope per loadout.

## Playtest verdicts now owed (Brett's next move)

Priority re-test list for the fix train, per its reports:
1. V7.15 look: slow pan (one steady rate, no swell), fast 180
   flick (no trailing whip), same drag = same turn on phone
   AND desktop; ADS small correction should feel tight.
2. V7.10 rotate on iPhone (menu footer should read V7.15).
3. V7.11 gunshots / V7.12 tracers feel.
4. V7.13 menu tabs, V7.14 clouds.
Plus still owed from earlier: V7.6–V7.9 items and online
vehicle prediction feel (AM report list stands).

## Still open (unchanged, not regressions)

1. Stage 2 signed sessions — designed only
   (docs/STAGE2-SESSIONS.md); Brett's three decisions pending:
   guests on/off, callsign changes, open signup vs invite code.
2. Host firewall checklist (docs/FIREWALL.md) — Brett's Mac half.
3. Deferred slices: movement locomotion, Mac-hosted multiplayer.

## Scorecard

- Planned (stale body): next V6 update. Delivered (Brett's
  current law): ground + full verification of landed V7.15,
  confirmation that the Pages deployment finally landed.
- Game code shipped: none (correctly — stand-down).
  Gates: 5/5 green on HEAD b360c91. Push: none by this session;
  live was already byte-identical to HEAD.
- Security items shipped this session: none in code; Lockdown
  posture re-verified intact via Watch 13:07 sweep.
- This report is a local docs commit only, to ship with the
  next gated push, same as prior stand-down reports.
