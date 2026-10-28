# V6 Update 10 — Report: Minimap + Objective Guidance + Hardening Slice

Built Wed Oct 28, 2026 (06:00 PT build session, Coordinator).
Commits: `aa1e12c` spec · `544c057` code · this report.
**Pushed live + verified** under the Oct 28 auto-push law.
**The landed V6 count is now 10.**

## What shipped

- **U10-01 Minimap (Brett's Oct 28 04:29 spec).** A north-up
  map in the top-left of the HUD on every device. You are the
  white arrow in the middle area (it turns as you turn);
  teammates are cyan dots, enemies red dots. In DOMINATION the
  capture points A / B / C appear as lettered circles coloured
  by who owns them — cyan = MERIDIAN (you), red = KESTREL,
  grey = nobody yet — drawn at their true size. In RELAY
  ASSAULT the relay point is marked. The map is a flat 2D
  canvas repainted ~8×/second: it costs **zero** 3D draw calls.
  On phones it sits below the pause/streak buttons and shrinks
  in landscape so it never crowds the thumb controls.
- **U10-02 Objective guidance.** A pill under the objective
  line tells you where to go: an arrow that rotates with your
  facing, plus plain text — e.g. **CAPTURE B · ROOFTOP · 42M**.
  Domination: it points at the nearest point you don't own;
  when your team holds all three it switches to DEFEND the
  nearest held point. Assault: **CHANNEL · CARRIER RELAY**.
  Wave Defense / TDM show no pill (there is no point to walk
  to). Online matches get the same pill: the snapshot's zone
  owners are merged onto the mode table's coordinates.
- **U10-03 Secured ports (Watch finding 1, Oct 28 05:07).**
  The multiplayer server now binds **127.0.0.1 by default**
  (was 0.0.0.0) in both the factory default and the direct-run
  path; anything wider needs the operator to type `HOST=`
  themselves, and the boot log says which posture you're in.
  `net/README.md` now documents the runbook: localhost bind,
  WSS terminated by the tunnel (no raw public ports, never
  port-forward 8081), and host-firewall rules (deny inbound
  8081 from non-loopback). ws-soak already bound localhost
  explicitly in its tests, so **no re-pin was needed there**
  (the spec allowed for one; it wasn't required).
- **U10-04 CSP (Watch finding 2).** `index.html` carries a
  Content-Security-Policy meta: self-only sources,
  `object-src 'none'`, `base-uri 'self'`, connect limited to
  self + ws/wss/https (the transports online play uses).
  Honest limit, stated in the spec: `'unsafe-inline'` stays
  for script/style because the importmap is inline by spec
  and the HUD sets inline styles; removing it needs a
  nonce/hash build step this repo doesn't have. External
  script origins, plugins and base-tag hijack are blocked.
- **U10-05 Build witness 10.** Menu stamp BUILD U10,
  ono-build meta 10, `?v=10` assets, `BUILD_NO` 10.
  mobile-check T7 re-pinned 9 → 10 (**named re-pin,
  witness-only**).

## Security items shipped (standing hardening priority)

Localhost-default bind · tunnel/WSS posture documented +
firewall rules in the runbook · CSP meta · minimap dots
clamped to the playable bounds (no off-map position leak).
Server authority / rate / size caps were already in code and
are re-verified by the W-suite inside smoke. **Still open
(named, not hidden):** Stage 2 signed session verification —
until it lands, the tunnel + localhost posture is what keeps
the server private; Lockdown + Odin have **not** certified
the hardening pass complete.

## Before / after scorecard

| Measure | Before (U9) | After (U10) | Note |
|---|---|---|---|
| Scope vs plan | — | 5/5 items | spec `aa1e12c` |
| Sustained calls (compound/forest/snow/mars) | 131/144/143/145 | 131/144/143/145 | Δ0 — 2D canvas only |
| Tris (forest, heaviest) | 264,884 | 264,884 | Δ0 |
| Shadow estimate | 199/200 | 199/200 | Δ0, still the binding budget |
| Gates (tree) | green | smoke ✓ biome ✓ reachability ✓ maps ✓ mobile ✓ | mobile-check 47 → 62 checks (T8) |
| Gates (snapshot) | — | all five green | re-run on the pushed archive |
| Live verification | — | byte-size exact on key files | see below |
| Hit/balance integrity | — | untouched | no weapon/bot/core file changed |
| Re-pins | — | 1 named (T7 witness 9→10) | ws-soak needed none |

Files changed: `js/minimap.js` (new, 117 lines), `js/main.js`,
`index.html`, `css/style.css`, `net/game-server.js`,
`net/README.md`, `tools/smoke.mjs` (M11), `tools/mobile-check.mjs`
(T7 re-pin + T8), spec + this report + ledger.

## Playtest asks for Brett

1. **Build stamp first:** menu footer should read **BUILD U10**
   — if it still says U9, the phone is holding a cached page
   (his U9 rotation re-test is still owed and still wanted).
2. Domination: does the pill + map make the points obvious?
   The arrow should swing as you turn and the distance count
   down as you approach.
3. Any mode: do the red/cyan dots read clearly at a glance?

Queue after U10: scenery realism + background mountains
(queue 5), then meta systems (queue 6). Characters/movement
await Brett's U9 verdicts before more spend.

## Addendum — push incident (same session, on the record)

The first push attempt was interrupted by a service restart
mid-run; it had already landed index/css/docs on the remote
(the successful push's SHA-skip list proves it) but not
js/main.js or js/minimap.js. A retry against the /tmp
snapshot then silently walked an empty directory (the
restart had wiped /tmp) and printed PUSH COMPLETE with zero
files — caught because the per-file output was empty and a
remote read showed minimap.js missing. The snapshot was
rebuilt from git HEAD under ~/workspace, all five gates
re-run green on it, and the push completed for real
(6 files pushed, the rest SHA-verified unchanged). Live
verification: the Contents API blob-SHA match on every file,
plus live content reads — js/minimap.js served in full and
matching, js/main.js serving the U10 import and
`BUILD_NO = 10`. (The page-fetch cache still held a pre-push
copy of the rendered index at last check — a fetch-cache
lag, not a Pages state: minimap.js exists only in U10 and
is being served.)
