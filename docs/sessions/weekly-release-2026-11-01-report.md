# Over n' Out — Weekly Release Report, week of Oct 26 – Nov 1, 2026

Weekly release assembly (Sun Nov 1, 2026, 18:53 PT). HEAD at assembly:
83753c1 (clean tree, v0.7.5 / BUILD V7.5). No prior weekly report exists
in docs/sessions/, so this roll-up covers everything landed since the
previous Sunday slot (Oct 25, 18:53 PT) — 92 commits local.

## IMPORTANT — the schedule body's premise is superseded

This job's body still carries the Oct 28 law ("V6 only, V7 is NOT
authorized, V6 count vs the 20 milestone"). That law was superseded by
Brett himself: on Oct 30 ~00:32 PT he explicitly called V7, V7 shipped
~00:50 PT, and Round 2 shipped V7.1–V7.5 the same night. The V6 line
therefore closed at **15 updates, not 20** — not because the milestone
was hit, but because Brett's explicit V7 call overrode the 20-update
floor (recorded in the ledger's V7 landing entry). No V7 step in this
report was started by this job; this job only certified, caught up the
push, and rolled up the scorecard. Nothing beyond V7.5 has been built —
V7.5 playtest verdicts are still owed by Brett.

## Updates included this week (one line each)

V6 line (closed at 15):
- U3 Terrain & ground realness (ledger row 3, Oct 27) — ground-blend
  overlay on Compound, Forest floor blanket + mounds + stones, Mars
  pebbles, Snow drift mottling; visual only, colliders unchanged.
- U5 bundled (Oct 27–28) — soldiers & guns realism (rows 4) + materials
  & finish pass (row 5, floor grid removed, flat strike cleared) +
  menu theme music, options menu, pre-match countdown, slide, 4 camos.
- U6 (Oct 28) — Brett's 16-item bundle: usable scopes, gun identity 2,
  character realism, fire-rate root-cause fix, music buzz fix, map
  expansion to ±80 with 4 ring POIs, stances, teams, text chat +
  WebRTC voice, menu redesign.
- U7 (Oct 28) — scope rework (5 sight kinds: iron/red dot/holo/mid 3×/
  sniper 5×), bush grounding mass, movement-feel slice, shadow camera
  fix under the lifted lighting lock.
- U8 (Oct 28) — mobile landscape hotfix: automatic re-fit on flip,
  rotate prompt, GO LANDSCAPE button, landscape-phone layout grid.
- U9 (Oct 28) — rotation/cache hardening + BUILD stamp, soldier
  de-blockify over byte-identical hit cores, articulated death fall.
- U10 (Oct 28) — north-up minimap + objective guidance pill; hardening:
  game-server localhost default bind, CSP meta, firewall runbook.
- U11 (Oct 28) — horizon & mountains re-based outside the ±80 bounds
  (4 ridge rings + merged distant peaks), +3 calls/+360 tris per map.
- U12 (Oct 28–29) — minimap enemies only when they fire (2.5 s reveal),
  Lightning Strike streak, character realism pass 3, gun silhouette
  pass, menu grid removed.
- U13 (Oct 29) — meta phase 1: 8 emblems, 8 badges, 7-day daily
  rewards in Meridian Credits (in-game only), SERVICE RECORD panel.
- U14 (Oct 29) — meta phase 2: tier packages, special offers with daily
  featured 30% off, 6 shop emblems, badges 8→10, SUPPLY shop UI.
- U15 (Oct 30) — attack dogs scorestreak (pack of 3, 1200 pts, 40 s),
  solo brain + server-authoritative sim pack.
- Watch fix (Oct 30) — dogs added to STREAK_CALL_IDS (online dogs were
  being rejected).

V7 line (Brett's explicit Oct 30 call):
- V7 (Oct 30, v0.7.0) — unified ballistics core (fixes online ADS
  spread bug), gunsmith measured spec panel, last 3 attachments
  modeled, Compound ring bushes II, roster final at 88 + Watch.
- V7.1 — drivable vehicles solo: RUNNER QUAD + PATROL TRUCK, shared
  physics, run-over credit, vehicle HUD.
- V7.2 — dogs take direct gunfire (sim raycasts/sentries/bots + solo
  wiring); the V7 deferral, closed.
- V7.3 — landscape uplifts: Forest +6 bushes (98), Snow +6 drifts (52),
  Mars +6 rocks (46), all castShadow OFF, pads kept clear.
- V7.4 — vehicle feel: procedural engine loop, speed FOV bloom,
  minimap vehicle squares; R2-4 movement made a measured no-ship call.
- V7.5 (v0.7.5, BUILD V7.5) — online vehicles: server-authoritative
  sim vehicles, snapshot carriage, client prediction + correction.
  Round 2 closed with no deferrals left.

Post-V7.5 local landings (pushed by this weekly catch-up, see below):
- Watch security fix — hello display names reject control characters
  (net/protocol.js) + smoke N15 pins for it.
- Training realism — HQ interior window-light panels in js/world.js
  (+48 tris, +0 draw calls, no new shadow casters).
- Training consolidation (Lessons corrections + Nov 1 re-baseline),
  VM2 balance reporter per-map assault + channelMax, and the Oct 30 –
  Nov 1 stand-down verification reports (docs only).

## Certification (this job, on a clean git-archive snapshot of HEAD)

All five gates green on the snapshot of 83753c1:
- tools/smoke.mjs — SMOKE PASSED
- tools/biome-check.mjs — BIOME CHECK PASSED
- tools/reachability.mjs — REACHABILITY PASSED
- tools/reachability-maps.mjs — MAP REACHABILITY PASSED
- tools/mobile-check.mjs — PASSED (all synthetic-touch scenarios,
  incl. touch ADS, dogs, vehicles + USE)

The version is certified: v0.7.5 / BUILD V7.5 at HEAD 83753c1.

## Perf position (measured on the snapshot, tools/v6-metrics.mjs)

- Sustained calls: Compound 134 / Forest 148 / Snow 147 / Mars 149 —
  budget ≤165/map, all inside.
- Tris: Compound 93,100 / Forest 285,774 / Snow 131,408 / Mars
  115,930 — budget ≤300k, all inside (Forest headroom 14,226).
- Shadow: caster count held at 199/200 (vehicle and dog actors are
  castShadow-false by design). The metrics harness's per-map
  shadow-pass estimates (189–214) are its known stale-baseline
  warning context, per the Nov 1 training re-baseline / Lesson 7
  correction — the binding caster budget is the 199/200 figure.
- Soldier: 8 calls / 6,008 tris per bot, flat-shaded share 0.

## Live check + catch-up push

Pre-push live check (https://silencer7777.github.io/Over-n-Out/):
- index.html 13,913 B — sha256-exact vs snapshot ✓
- js/main.js 159,289 B — sha256-exact vs snapshot ✓
- js/world.js 87,440 B live vs 88,607 B local — MISMATCH (the unpushed
  training window-light panels)
- (also differing, beyond the three key files: net/protocol.js
  16,293 live vs 16,731 local — the Watch hello fix; tools/smoke.mjs
  82,619 live vs 84,166 local — its N15 pins)

PUSH RESULT: Catch-up push executed under the Oct 28 auto-push authorization (gates green): python3 gh_push_contents.py silencer7777 Over-n-Out main <snapshot> "V6 weekly catch-up" — PUSH COMPLETE, 14 files pushed (js/world.js, net/protocol.js, tools/smoke.mjs, rig/vm2-balance/run.mjs, docs/training/LESSONS.md, docs/training/TRAINING-LOG.md, scratch results, and the 7 stand-down session reports), 0 failures; all other files skipped as unchanged.
POST-PUSH VERIFICATION: Post-push: origin/main js/world.js is 88,607 B, sha256-exact vs the snapshot; net/protocol.js 16,731 B and tools/smoke.mjs 84,166 B match local. GitHub Pages had already flipped at re-check: live index.html 13,913 B sha-exact ✓, js/main.js 159,289 B sha-exact ✓, js/world.js 88,607 B sha-exact ✓. Live now matches local HEAD on all key files. Game: https://silencer7777.github.io/Over-n-Out/ (BUILD V7.5).
