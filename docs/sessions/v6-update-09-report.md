# V6 Update 9 — REPORT (rotation hardening + de-blockify + real death fall)

Owner order (Brett, Oct 28, 04:41, playtesting live Update 8 on
his iPhone): "Device rotation is not working check everything.
Also, people still look very blocking and when they fall it's
not realistic. Go ahead and fix it." Built and pushed live
under the Oct 28 auto-push law (gates green → push, no tap).
This build jumped the queue ahead of Brett's 04:29 minimap /
Domination-guidance spec at his direct order; **the minimap
spec stands next.**

Commits: `e3a23dc` spec + `b229788` code + this landing.
Metrics at `b229788`, tree clean.

## Scorecard — planned vs shipped

| Spec item | Verdict |
|---|---|
| U9-01a stale-build sweep (SW / cache / live bytes) | **DONE** — no SW, no manifest; live bytes re-verified exact at build start (see diagnosis) |
| U9-01b iOS fit-path audit + redundant triggers | **SHIPPED** — matchMedia orientation + screen.orientation + pageshow triggers added; orientationchange series extended to 600 ms; touch layer re-feeds on orientationchange |
| U9-01c CSS geometry locks | **DONE** — none found (percent heights, no 100vh traps, #menu fixed inset-0) |
| U9-01d build stamp (cache witness) | **SHIPPED** — menu footer `BUILD U9 · v0.6.0-dev` + `ono-build` meta + `?v=9` on the two rotation-critical entry assets |
| U9-01 self-update reload (fetch served build, reload once) | **CUT — by our own security lint.** The smoke security lint enforces the hardening law (zero network calls from game code; exceptions are named transport modules only). The lint failed the build on `fetch(` in main.js, and the lint outranks the convenience: the block was removed, not exempted. The stamp + versioned assets are the shipped witness; if a future update wants the self-heal, it goes through a named, reviewed lint exception like online.js/chat.js got — not a quiet carve-out. |
| U9-02 de-blockify, hit cores byte-identical, calls held | **SHIPPED + PROVEN** (below) |
| U9-03 articulated death, 1.5 s corpse, deterministic | **SHIPPED + PROVEN** (below) — mechanism grew two proof-driven additions the spec sketch didn't have (hip floor + pivot migration; front-fall shoulder redirect) |

## Item 1 — Rotation: what was actually wrong

Checked in the order the brief demanded:

**a) Stale build — the prime suspect, and it still is.** The
repo contains **no service worker, no cache manifest, no
manifest.json** — nothing pins an old build in code. The live
U8 bytes were re-verified during this build: index.html,
style.css, main.js, touchcontrols.js, bots.js all byte-exact
vs the U8 tree, `rotate-prompt` present in the served HTML,
Last-Modified **04:38:20 PT** — and Brett's "not working"
report came at **04:41, about two minutes after the deploy
landed**. Pages serves `Cache-Control: max-age=600`. The
strongest-supported story: his phone was still holding the
pre-U8 page (cached HTML, or simply the tab opened before the
deploy) — the rotation code he was testing wasn't on his
phone yet. There was also **no way for him or us to tell
which build his phone was running**. That missing witness was
a defect in itself; it's fixed: the menu footer now reads
**BUILD U9 · v0.6.0-dev**, and `style.css`/`main.js` load
with `?v=9` so a new build's rotation-critical files can
never be served from a stale cache entry.

**b) iOS Safari reality — real gaps found and closed.** The
U8 fit path listened to resize / orientationchange /
visualViewport, but: the **touch layer only re-fed its
viewport width on `resize`** (a rotation that iOS reports
primarily as orientationchange left the sticks measuring the
old width); there was **no `pageshow` refit** (returning to
the tab from bfcache never re-fit); **no matchMedia
orientation trigger**; and the **orientationchange refit
series stopped at 250 ms** while iOS URL-bar settle can run
longer. All closed: fitRenderer now also fires on
`matchMedia('(orientation: portrait)')` change,
`screen.orientation` change, and `pageshow`; the
orientationchange series runs rAF + 120/300/600 ms; the touch
layer re-feeds on `orientationchange` too. The fit response
is now redundant across five signals — at least one always
lands on iOS.

**c) CSS** — no rule locks playfield geometry in landscape;
no change needed (the ≤520px landscape query behaves at
iPhone landscape heights; verified in the audit).

**Honest remainder:** if Brett's menu stamp reads **BUILD
U9** and rotation *still* doesn't respond, the code side is
exhausted and the remaining suspect is device-side. His
5-second checks: (1) read the stamp in the menu footer and
tell us what it says; (2) Control Center → Rotation Lock
OFF (the lock icon un-highlighted); (3) open the game link
directly in Safari — an in-app browser (Messages/Facebook
webview) can hold its own portrait lock that no web page can
override.

## Item 2 — Soldiers: de-blockify, cores proven

All changes are dressing **over** the hit cores — the three
HIT CORE part lines in bots.js are byte-identical in source
(new smoke pin D9 asserts exactly that), and the headless
proof (below) confirms behavior, not just text.

- **Legs:** hip-joint spheres (the leg balls into the pelvis
  — no shelf joint), calf masses behind the shins, thigh /
  shin cylinders 9 → 11 segments, ankle 8 → 10.
- **Torso:** a tapered, flattened ribcage barrel over the
  core (the flat slab sides die), the vest front becomes a
  curved molded plate (scaled sphere inside the old slab's
  envelope), the backpack becomes a rounded pack (same
  envelope), neck 8 → 12 segments, deltoids 8×6 → 10×8.
- **Head:** face sphere 10×8 → 14×10, helmet dome becomes a
  true sphere dome (was a squat cylinder), the square brim
  becomes a round disc, the jaw guard becomes a curved shell
  in the old envelope, ears 6×5 → 8×6.

**Hit-core proof (headless, real three via the vendor
loader, U8 baseline tree vs U9 tree):**
- Core-corner multiset check: minimum copies of every core
  corner = **4 in legs, torso, and head — identical to
  baseline** (cores intact inside the merged geometry).
- Six raycast samples at the core faces (chest front/back,
  pelvis back, head front, shin front + a deliberate
  between-the-legs miss): **[miss, 4.6875, 4.804, 4.57,
  4.6382, 4.4778] — byte-identical old vs new.** Hitboxes
  did not move a micron.

**Cost, stated plainly:** per-bot triangles 2,182 → 3,574
body-only (+1,392, +63.8%); per metrics (gun + visor
included) 2,970 → 4,362. Draw calls per bot **unchanged at
8** — the smoothing is vertex density inside the same three
merged meshes, not new meshes.

## Item 3 — Death: the plank is gone

The old fall rotated the whole body around its feet at
constant speed, then sank it 0.7 m. The replacement
(`_setupDeath` + `_updateCorpse` in bots.js; corpse lifetime
**exactly 1.5 s — removal verified at frame 90**, sim
untouched, net/sim.js has its own death state and was not
modified):

- **Direction:** `damage()` takes the shot's travel
  direction (the gunfire funnel passes the ray direction;
  barrel and frag kills pass victim-minus-source; bot-vs-bot
  passes shooter→target). The fall runs along the shot, with
  deterministic per-bot variation (seeded from construction
  state — **no Math.random anywhere in the death path**):
  a ±26° sweep, ~1-in-3 sideways crumple, headshots buckle
  in 0.16 s vs 0.28 s and skip the crumple.
- **Front-fall redirect:** the rifle arm reaches ~0.6 m
  ahead of the chest and is merged into the torso — it
  cannot fold, so a straight face-first fall would spear it
  through the floor. Falls into the front hemisphere are
  twisted ~66° onto a shoulder, and the front component is
  capped at 0.35 — the body always pivots over a shoulder or
  the arm, never straight over the face.
- **Buckle → collapse:** hips drop ~6 cm while the legs lag
  at the hip; then the body tips around the **hip point**
  (not the feet) toward ~87°. Two geometry guards, both
  found by failing vertex audits and fixed on evidence:
  a **hip floor** — the hip cannot sink below
  `R·cos(β − ψ)` from the boot's leading-corner geometry,
  so the feet never drive through the floor mid-fall; and
  **pivot migration** — late in the fall the effective pivot
  slides from the hip to the body's contact point in the
  fall direction (pack 0.43 behind, vest ahead, side kit at
  the flanks), so the body comes to rest **on** the surface
  it landed on instead of through it.
- **Articulation:** the torso pitches ahead of the root
  early (chest leads) then resolves to a slight arch; the
  head lolls (0.34 rad + a seeded roll) at the neck pivot;
  the gun droops ~0.5 rad in the grip; **one** soft settle
  bump at ~1.12–1.37 s, then stillness. HP bar and team
  marker hide at death — a floating diamond over a corpse
  broke the read.
- **Vertex audit (every vertex of all three meshes, sampled
  through the fall):** at **rest**, the lowest vertex across
  24 randomized falls (back / side / redirected-front /
  diagonal / headshot classes) sits between **−0.096 m and
  +0.133 m** — bodies rest on their gear. (Pre-fix baseline:
  **−0.41 m at rest**, −0.59 m mid-fall — the corpse visibly
  sunk and speared.) Mid-fall transients are brief
  contact-grazes (worst −0.216 m for a few frames on the gun
  arm during the fastest part of a shoulder fall; typical
  ≥ −0.14 m). Stated honestly: a rigid merged mesh cannot
  fold an arm or bend a whip antenna — what the audit now
  guarantees is that the *final pose* and the *read* are a
  body on the ground, not a plank in it.
- **Player death view:** player.js has no death camera/body
  (first-person; death is a respawn flow) — nothing existed
  to articulate. Out of scope, not invented.

## Perf (v6-metrics at `b229788`, clean tree)

| Measure | U8 | U9 | Bar |
|---|---|---|---|
| Draw calls / map | 131 / 144 / 143 / 145 | **identical** (statics Δ0, bots still 8 calls) | ≤165 |
| Tris / bot (metrics basis) | 2,970 | **4,362** (+1,392 — the smoothing, stated in Item 2) | — |
| Tris, forest (worst map, 10-bot basis) | 252,356 | **≈266,276** | ≤300k (33.7k headroom) |
| Static maps (all four) | — | calls / tris / casters **byte-identical** (48/61/60/62 calls) | — |
| Shadow casters | unchanged counts everywhere (bots still 4 each) | **Δ0** | ≤200 mobile |

No reclaims were needed: the delta is vertices, not calls,
and the worst map holds 88.8% of the tri bar.

## Gates & new pins

All five gates green on the tree (and on the push snapshot —
see below): smoke (incl. the security lint that cut the
self-update), biome-check, reachability, reachability-maps,
mobile-check.

- **mobile-check T7 (new, 5 assertions):** build stamp
  present, ono-build meta, build number exposed, redundant
  iOS fit triggers, touch orientationchange re-feed.
- **smoke D9 (new, 2 pins):** death articulation machinery
  present (buckle + hip floor + pivot migration); the three
  hit-core part lines byte-identical.
- **Re-pins: none.** No existing pin moved.

## Deferrals (honest)

- **Minimap + Domination guidance** — Brett's 04:29 spec,
  queued next by his order.
- **Fetch-based self-update** — cut by the security lint
  (above); revivable only as a named lint exception.
- Characters/movement/scenery/meta focus queue continues
  per the ledger directives.

## Push verification

Pushed via the Contents-API pipeline under the Oct 28
auto-push law; snapshot gates green; live byte-verification
of all touched files (index.html, js/main.js, js/bots.js,
js/touchcontrols.js) plus the served BUILD U9 stamp — filled
in the ledger landing entry.
