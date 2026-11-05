# Over n' Out — Evening Build Session, Wed Nov 4, 2026, 19:53 PT

Coordinator session. STAND-DOWN / VERIFICATION — no game code
changed, nothing pushed by this session. Headline finding:
**BUILD V7.21 is live and byte-verified, and today's full
directive train (V7.16–V7.21) is complete.**

## Why no new update was built

- The schedule body still carries the stale Oct 28 V6-only law
  ("V7 is NOT authorized", next V6 update, stop at V6=20). It is
  superseded, as every session since Oct 30 has recorded: Brett
  called V7 explicitly on Oct 30, V6 closed at 15, and the V7
  line has shipped under the same green-gates auto-push law
  since. Protocol step 1: Brett's newest specs outrank the
  schedule body/ledger.
- Brett's Nov 4 directives were answered TODAY, in full:
  - "You can't see" driving trucks → **V7.16 driving chase
    camera** (shared poseDriveRig pose, collision pull-in,
    on-foot eye restored on exit).
  - ADS rule change (firing automatically aims down the sight)
    → **V7.17 auto-ADS on fire** (resolveAim composites manual /
    touch / firing channels; hints + controls text updated).
  - "Upgrade everything else" + the ~17:04–17:11 directive
    batch (expand maps, water + bridges, rooftops, props,
    clan wars / trip wires / passages, real characters) →
    **V7.18** second-ring expansion (Compound 160 m → 208 m,
    reservoir + causeway bridge, East Depot rooftop warehouse,
    Gate Warden statue, South Service Passage), **V7.19** trip
    wires proven (new tripwire-check gate) + clan groundwork,
    **V7.20** 15-operator roster, **V7.21** Forest/Snow/Mars
    data expansion (124 m → 168 m, SE knoll / drift ridge /
    NE solar ring) + Lessons 34–39 + EXPANSION-PATTERN.md.
- Those six slices landed and pushed live TODAY and are
  **un-playtested**. Building a V7.22 on top of them before
  Brett's verdicts would break the standing pattern every
  session since Oct 30 has followed: his playtest verdicts set
  the focus queue.
- No new Brett directive and no Watch write-up addressed to
  build sessions is outstanding. Latest Watch rotation
  (19:07 PT today, Swing shift): all-pass, live byte-identical
  to HEAD, no Medic fixes, tree clean.

## Grounding (protocol step 1)

- Working tree at start and end: CLEAN. HEAD f31823e
  (V7.21 data-maps expansion) on top of 7b044a2 (V7.20
  operators), 3f01a74 (V7.19), 59c0628 (V7.18), 59536df
  (V7.17 auto-ADS), 6e5fea9 (V7.16 drivecam). Version 0.7.21,
  BUILD V7.21.
- Roster: 88 seats + 10-bot Watch, FINAL per Brett Oct 30.
- Lockdown backend pass verified intact by Watch 19:07:
  localhost bind, WSS via tunnel only, caps (64 conns / 8 per
  IP / 32 rooms, 4,096 B messages, input 40/s, non-input
  20/s), Origin allowlist, violation logging,
  server-authoritative speed / fire-rate / damage.

## Verification (this session, on local HEAD f31823e)

All NINE gates re-run this session via
tools/gates-parallel.sh, all PASS, exit 0:

- tools/smoke.mjs — PASS
- tools/biome-check.mjs — PASS
- tools/reachability.mjs — PASS
- tools/reachability-maps.mjs — PASS
- tools/mobile-check.mjs — PASS (T1–T17 incl. V7.17 auto-ADS
  truth table, touch ADS/USE, drive/vehicle pins)
- tools/drivecam-check.mjs — PASS (DC1–DC4)
- tools/bridge-check.mjs — PASS (BC1–BC6)
- tools/tripwire-check.mjs — PASS (TW1–TW5)
- tools/characters-check.mjs — PASS (CH1–CH5)

Live integrity: a fetch of
https://silencer7777.github.io/Over-n-Out/ this session shows
the menu footer "BUILD V7.21 · v0.7.21", version line
"TACTICAL BROWSER FPS · v0.7.21", and the updated controls
lines ("CLICK Fire — firing auto-aims down the sight for as
long as you shoot"; "RIGHT-CLICK (HOLD) Aim down sights
without firing — every gun has a sight"). Local sizes match
the Watch's 19:07 byte-identical (sha256/cmp) check exactly:
index.html 15,656 B, js/main.js 172,067 B, js/world.js
106,187 B vs local HEAD f31823e — live serves BUILD V7.21,
no drift/tampering.

Perf: Δ0 — no code changed. Budgets held at last measure
(V7.21 report): client sustained calls 147–162/map (bar 165),
Forest layout projection 268.1k tris (bar 300k), shadow
casters 199/200.

Device status: desktop + tablet/mobile verified by gates
(mobile-check green; touch controls incl. ADS/USE passing).
Scopes, in player words: just fire — firing auto-aims down
the sight for as long as you shoot; HOLD right mouse button
to aim down sights without firing. Iron 1.15× on every gun,
plus red dot, holo, mid scope, sniper scope per loadout.

## Playtest verdicts now owed (Brett's next move)

1. V7.16 drivecam: can you see while driving now? Chase-cam
   distance / pull-in feel, truck especially.
2. V7.17 auto-ADS: firing snaps to the sight — right feel, or
   should hip-fire stay hip?
3. V7.18 expansion: drive the bridge, wade the reservoir,
   climb the depot stairs AND the east crate-hop to the roof,
   run the south passage, find the Gate Warden statue; phone
   smoothness at 208 m.
4. V7.19: set a clan tag in RECORD (callsign shows [TAG]),
   plant a TRIP MINE in the passage / on the bridge.
5. V7.20: LOADOUT → OPERATOR picker; squads no longer clones.
6. V7.21: online Forest/Snow/Mars at 168 m — SE knoll and
   drift ridge as high ground.
Plus still owed from earlier: V7.6–V7.15 items (look
smoothness, clouds, menu tabs, gunshots/tracers) and online
vehicle prediction feel.

## Team meeting — next-update candidates (specced, NOT built)

Re-affirmed from the shipped reports; none starts without
Brett's direction or playtest verdicts:

1. Ten-map pipeline step 1 (docs/EXPANSION-PATTERN.md):
   layout graph as data — the generator that makes new maps
   cheap. Owner: Mason/Atlas, Odin perf veto.
2. Biome dressing scatter into the V7.18 ring (follow-up named
   in the V7.18 report — the ring reads barer under
   forest/snow/mars dressing). Owner: Underbrush + map crews.
3. Second ring vehicle pad pair — proposal only, if playtest
   says the ring feels empty (V7.18 report; no speed changes).
4. True below-grade tunnels — blocked on the floorsAt layered-
   floor contract change specced in the V7.19 report.

## Still open (unchanged, not regressions)

1. Stage 2 signed sessions — designed only
   (docs/STAGE2-SESSIONS.md); Brett's three decisions pending:
   guests on/off, callsign changes, open signup vs invite
   code. Clan wars proper unlock with it (V7.19 §9).
2. Host firewall checklist (docs/FIREWALL.md) — Brett's Mac
   half.
3. Deferred: distinct-layout client wiring (M2), movement
   locomotion slice, Mac-hosted multiplayer.

## Scorecard

- Planned (stale body): next V6 update. Delivered (Brett's
  current law): ground + full 9-gate verification of landed
  V7.21, live byte-integrity confirmed, today's directive
  train (V7.16–V7.21) confirmed complete and live.
- Game code shipped: none (correctly — stand-down).
  Gates: 9/9 green on HEAD f31823e. Push: none by this
  session; live was already byte-identical to HEAD.
- Security items shipped this session: none in code; Lockdown
  posture re-verified intact via Watch 19:07 sweep (backend /
  voice-signaling deep pass, no regressions).
- This report is a local docs commit only, to ship with the
  next gated push, same as prior stand-down reports.
