# Over n' Out — Midday Build Session, Fri Oct 30, 2026, 13:53 PT

Coordinator session. This is a STAND-DOWN / VERIFICATION session,
not a new update. No game code was changed and nothing was pushed.

## Why no new update was built

- This schedule's body still carries the old Oct 28 V6-only law
  ("V7 is NOT authorized"). That law is superseded: Brett called
  V7 explicitly on Oct 30 (~00:32 PT), V7 shipped ~00:50, and
  Round 2 shipped V7.1–V7.5 the same night (vehicles solo +
  online, dogs under direct gunfire, landscape uplifts, vehicle
  feel). The session protocol itself says Brett's newest specs
  in MEMORY outrank the ledger/schedule body.
- The ledger's V7 landing entry states: "The 06:00 scheduled
  build slot stands down: the V7 tree is landed and clean; no
  V6 U16 is to be started." Round 2 closed with no deferrals
  left. The same stand-down applies here.
- What is actually owed next is Brett's playtest, not more code:
  V7/V7.5 verdicts on (1) online driving feel / prediction,
  (2) ADS tightness, (3) gunsmith panel readability, (4) recoil
  feel, (5) online dogs. Building an unrequested V7.6 on top of
  un-playtested V7.5 would violate the focus queue, which is
  set by Brett's verdicts.

## Grounding (protocol step 1)

- Working tree at start: CLEAN. HEAD dfb142e (training commits
  on top of the Watch hello control-character fix 4c9f53d, on
  top of V7.5 8108416/6c457b4/0f239ca).
- Roster: 88 seats + 10-bot Watch, FINAL per Brett Oct 30.
- Latest Watch rotation (13:07 PT, Day shift): all-pass, live
  byte-identical, no new findings. Known Stage 2 hardening
  opens unchanged (see next-update spec below).

## Verification (this session, on local HEAD)

All five gates re-run on the tree, all green:

- tools/smoke.mjs — SMOKE PASSED
- tools/biome-check.mjs — BIOME CHECK PASSED
- tools/reachability.mjs — REACHABILITY PASSED
- tools/reachability-maps.mjs — MAP REACHABILITY PASSED
- tools/mobile-check.mjs — all synthetic-touch scenarios pass
  (T1–T13, incl. touch ADS, dogs, vehicles + USE)

Live check (this session, ~13:54 PT): GitHub Pages sizes match
local HEAD byte-for-byte in size —
index.html 13,913 B, js/main.js 159,289 B, js/world.js 87,440 B —
consistent with the Watch's 13:07 sha256 byte-identical result.
Game: https://silencer7777.github.io/Over-n-Out/ (BUILD V7.5)

Perf: unchanged, no delta. Calls ≤149/map (budget 165),
Forest tris 285,726 (budget 300k), shadow casters 199/200 held
(vehicle actors are castShadow-false by design).

Device status: desktop + tablet/mobile verified by gates
(mobile-check green, touch controls incl. ADS/USE passing).
Scopes note (standing requirement): aim with HOLD right mouse
button — iron 1.15× on every gun, red dot, holo, mid scope,
sniper scope per loadout.

## Team meeting — next-update spec (NOT built this session)

Owner candidate: Lockdown (Backend & Security), with Odin perf
veto. This is the standing security priority from the schedule
body and every Watch write-up since 08:07. Acceptance per item:

1. Connection + room caps on the game server, with cleanup of
   idle/empty rooms. Acceptance: cap enforced + smoke pin.
2. General rate cap for non-input messages (hello/ping/voice/
   signal), matching the existing input 40/s and chat caps.
   Acceptance: over-rate frames dropped/closed per LIMITS +
   smoke pin.
3. Anti-cheat violation logging (dropped invalid claims are
   counted/logged server-side, not silent). Acceptance: log
   line on an invalid movement/fire claim in a probe.
4. Re-hello identity: a mid-session re-hello must not silently
   rename/re-identify a connected player. Acceptance: second
   hello rejected or ignored + smoke pin.
5. Signal size mismatch: reconcile the 16,384 B signal limit
   with the 4,096 B transport maxPayload — one number, both
   layers. Acceptance: LIMITS and transport agree + pin.
6. WebSocket Origin check on upgrade. Acceptance: cross-origin
   upgrade rejected in a probe.
7. Stage 2 signed sessions: spec only this update (design +
   threat model in the session doc); implementation is its
   own later update. Acceptance: design doc filed, no code
   pretending to be signed sessions.

Deferred by Brett's design (unchanged): movement locomotion
slice, Mac-hosted multiplayer test night (deferred to his
days off). No item above starts until Brett's V7.5 playtest
verdicts land or he directs the hardening pass — his call
outranks this spec.

## Scorecard

- Planned: ground, verify landed V7.5, convene team, spec next
  update. Delivered: all of it. Game code shipped: none
  (correctly — stand-down). Gates: 5/5 green. Push: none.
- Security items shipped this session: none in code; the
  hardening backlog is itemized above with acceptance tests,
  carried from the Watch's verified write-ups.
