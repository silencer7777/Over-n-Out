# Over n' Out — Evening Build Session, Thu Nov 5, 2026, 19:53 PT

Coordinator session. This is a STAND-DOWN / VERIFICATION session,
not a new update. No game code was changed and nothing was pushed
by this session.

## Why no new update was built

- This schedule's body still carries the old Oct 28 V6-only law
  ("V7 is NOT authorized", build the next V6 update, stop at
  V6=20). That law is superseded by Brett himself: on Oct 30
  ~00:32 PT he explicitly called V7, V7 shipped ~00:50 PT, and
  the V7 line has shipped under the green-gates auto-push law
  since. V6 closed at **15 updates, not 20**. Protocol step 1:
  Brett's newest specs outrank the schedule body/ledger.
- The AM (06:00 PT) and midday (13:53 PT) sessions today already
  verified the overnight Job 2 train V7.22–V7.28 live and stood
  down pending Brett's playtest verdicts. Nothing has changed
  since midday except:
  - HEAD is now `8d04d45` — the midday stand-down report commit
    itself (docs only; no game code, still 0.7.28 / BUILD V7.28).
  - Watch rotation at 19:07 PT today (Swing shift — Commander
    Nightowl + Ravi Sniffer / Lena Firewall / Elif Sonar):
    all-pass, live integrity BYTE SIZE MATCH, security sweep on
    chat/voice/netcode clean, no write-up addressed to build
    sessions outstanding, no Medic fixes.
- Those seven Job 2 slices (V7.22–V7.28) remain
  **un-playtested**. Building a V7.29 on top of them before
  Brett's verdicts would break the standing pattern every
  session since Oct 30 has followed: his playtest verdicts
  set the focus queue. No new Brett directive is outstanding.
  Also still pending Brett's decision: whether lost content
  (Quarry, Harbor, Compound tunnels, weather) is rebuilt or
  left behind, and the Stage 2 decisions (guests on/off,
  callsign changes, open signup vs invite code).

## Grounding (protocol step 1)

- Working tree at start: CLEAN. HEAD `8d04d45`
  (midday stand-down docs) on `9745ff6` (training re-baseline)
  on `9d643d1` (AM stand-down docs) on `ba51e75` (V7.28 code).
  Version 0.7.28, BUILD V7.28.
- Ledger (`docs/sessions/v6-update-ledger.md`): V6 closed at
  15; V7 + V7.1–V7.5 + Job 2 V7.22–V7.28 all recorded LANDED
  + PUSHED LIVE. Roster: 88 seats + 10-bot Watch, FINAL.
- Latest Watch rotation (19:07 PT Nov 5, Swing shift):
  all-pass — guardian.sh SMOKE PASSED, standalone smoke
  PASSED, mobile-check PASSED (incl. T17 fire-to-ADS).
  Syntax clean, 0 TODO/FIXME, imports resolve. Security:
  no eval/document.write/Function, no committed secrets,
  CSP meta present (object-src none, base-uri self), chat
  textContent-only, validateChat 1–240 chars, game-server
  localhost default 127.0.0.1, WSS/TLS tunnel only, no raw
  public ports, LIMITS 4096B msg / 16384B signal, violation
  logging, server-authoritative movement (STANCE speed),
  fire cadence (weapon.interval), server falloff damage;
  collide bounds clamp + push-out, no new OOB/clipping/
  stuck/slide findings. Known open unchanged: Stage 2
  signed sessions designed only; host firewall checklist
  is Brett's Mac half.

## Verification (this session, on local HEAD 8d04d45)

All ELEVEN gates re-run this session via
`tools/gates-parallel.sh`, all PASS, exit 0:

- tools/smoke.mjs — PASS
- tools/biome-check.mjs — PASS
- tools/reachability.mjs — PASS
- tools/reachability-maps.mjs — PASS
- tools/mobile-check.mjs — PASS
- tools/drivecam-check.mjs — PASS
- tools/bridge-check.mjs — PASS
- tools/tripwire-check.mjs — PASS
- tools/characters-check.mjs — PASS
- tools/zone-reachability.mjs — PASS (48/48 class gate)
- tools/stepdown-check.mjs — PASS (SD1–SD3)

Live integrity: the served page at
https://silencer7777.github.io/Over-n-Out/ fetched this
session shows "TACTICAL BROWSER FPS · v0.7.28",
"BUILD V7.28 · v0.7.28", and the current controls lines
("CLICK Fire — firing auto-aims down the sight for as long
as you shoot"; "RIGHT-CLICK (HOLD) Aim down sights without
firing — every gun has a sight"). Live byte sizes match
local HEAD exactly: index.html 16,649 B, js/main.js
187,823 B, js/world.js 108,370 B — live serves BUILD
V7.28, no drift/tampering.

Perf: Δ0 — no code changed. Last measured baseline
(Training re-baseline, Nov 5, on V7.28): all five client
maps at 147–162 sustained calls (bar ≤165; Mars 162 is
closest, Forest 161 with 292,578 tris / 300k bar, 7,422 tris
headroom); shadow discipline held. Named wall: further
elevation dressing on Forest/Snow/Mars needs a call reclaim
first (splitting an InstancedMesh to shed shadow tris costs
+1 call per split — Lesson 40).

Device status: desktop + tablet/mobile verified by gates
(mobile-check green; touch controls incl. ADS / auto-ADS
T17 / USE / EMOTE passing). Scopes, in player words: just
fire — firing auto-aims down the sight for as long as you
shoot; HOLD right mouse button to aim down sights without
firing. Optics: iron 1.15× on every gun, PINPOINT DOT
1.25×, red dot 1.35×, holo 1.6×, MERIDIAN OPTIC 2×, mid
scope 3×, sniper 5×, LONGRANGE 8× (DMR, L24).

Security items shipped this session: none in code; the
Lockdown posture re-verified intact via Watch 19:07 and
this session's smoke run.

## Playtest verdicts now owed (Brett's next move — unchanged)

1. Domination C (Compound Relay Tower + dressed maps):
   confirm C captures standing on the point.
2. V7.23 scopes: three new optics; sniper 5× untouched.
3. V7.24 South Outpost roof climb; drums/trunks solid.
4. V7.25 Meridian Orbital (fifth map), solo + online.
5. V7.26 modes: MOVING CLAIM first (online); other four solo.
6. V7.27 emotes: B + 1–6, EMOTE touch button.
7. V7.28 step-down: stair descents walk, not micro-fall.
Plus V7.16–V7.21 verdicts still owed, the lost-content
rebuild decision, and the Stage 2 three decisions.

## Team meeting — next-update candidates (specced, NOT built)

None starts without Brett's direction or playtest verdicts:

1. §3 elevation remainder (Forest/Snow/Mars) — bound by the
   160–162/165 call wall; a reclaim pass must come first.
   Owner: Atlas/map crews, Odin veto.
2. Ten-map pipeline follow-ups (docs/EXPANSION-PATTERN.md).
3. Stage 2 signed sessions — designed only in
   `docs/STAGE2-SESSIONS.md`. Three decisions are Brett's:
   guests on/off, callsign changes allowed?, open signup vs
   invite code. No code until he calls it.
4. Host firewall half — `docs/FIREWALL.md` Mac checklist is
   Brett's to do. Not done, flagged as not-done.

## Scorecard

- Planned (stale body): next V6 update. Delivered (Brett's
  current law): ground, full 11-gate verification of landed
  V7.28 at HEAD 8d04d45, live integrity confirmed, Job 2
  train (V7.22–V7.28) confirmed complete and live for the
  third session today.
- Game code shipped: none (correctly — stand-down).
  Gates: 11/11 green. Push: none by this session; live was
  already identical to HEAD's code.
- This report is a local docs commit only, to ship with the
  next gated push, same as the prior stand-down reports.
