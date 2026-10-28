# V6 Update 9 — SPEC (rotation hardening + de-blockify + real death fall)

Owner order (Brett, Oct 28, 04:41 playtest of live Update 8 on
his iPhone): "Device rotation is not working check everything.
Also, people still look very blocking and when they fall it's
not realistic. Go ahead and fix it." Built and pushed live under
the Oct 28 auto-push law (gates green → push, no tap). This
build jumps the queue ahead of Brett's 04:29 minimap/Domination
spec at his direct order; the minimap spec stands next.

## U9-01 — Rotation: check everything, harden everything

Diagnosis checklist (in order):
a) **Stale build / service worker:** repo swept — NO service
   worker, no cache manifest, no manifest.json exists. Live
   bytes re-verified at build start: index.html, style.css,
   main.js, touchcontrols.js, bots.js all byte-size-exact vs
   the U8 tree, rotate-prompt present in served HTML. Pages
   serves `Cache-Control: max-age=600` — combined with Brett
   testing at 04:41, ~2 min after the U8 deploy landed
   (Last-Modified 04:38:20 PT), a cached pre-U8 page on his
   phone is a live suspect. There was NO way for Brett (or us)
   to tell which build his phone was running — the missing
   witness is itself a defect. Fixed by (d).
b) **iOS Safari reality:** fit path re-audited. CSS holds no
   100vh traps (percent heights throughout); the landscape
   query matches iPhone landscape heights. Gaps found: the
   touch layer re-fed its viewport width on `resize` only;
   no `pageshow`/bfcache refit; no matchMedia orientation
   trigger; the orientationchange refit series ended at
   250 ms (iOS URL-bar settle can run longer).
c) **CSS geometry locks:** none found — #menu is fixed
   inset-0, canvas is renderer-sized, no portrait lock in CSS.
d) **Build stamp (the cache witness):** menu footer gains a
   discreet `BUILD U9 · v0.6.0-dev` stamp + a
   `<meta name="ono-build" content="9">` token.

Hardening shipped:
- **Self-update check:** at boot (and on a bfcache `pageshow`)
  main.js fetches index.html with `cache: 'no-store'`, reads
  the served ono-build number, and if the server is NEWER than
  the running build, reloads ONCE (sessionStorage-guarded,
  fully try/caught, never blocks boot). A stale tab now heals
  itself into the current build.
- **Entry-asset cache-bust:** style.css and main.js load with
  `?v=9`, so a new build's two rotation-critical files can
  never be served from an old cache entry.
- **Redundant rotation triggers:** fitRenderer now also fires
  on matchMedia('(orientation: portrait)') change,
  screen.orientation change, and pageshow; the
  orientationchange series extends to rAF + 120/300/600 ms.
- **Touch layer:** orientationchange joins resize for the
  stick viewport re-feed.

Honest remainder (stated in the report): if the stamp reads
U9 and rotation still doesn't respond, the remaining suspect
is device-side — iOS Rotation Lock, or a portrait-locked
in-app browser. The report gives Brett the 5-second checks.

## U9-02 — Soldiers: de-blockify (visual only)

The three hit-core part lines stay byte-identical in source
(legs/torso/head cores — proof: source assertion + headless
geometry audit + raycast samples vs the U8 baseline). Draw
calls per bot UNCHANGED (3 merged meshes + visor + gun +
sprites as shipped). Changes, all dressing over the cores:
- **Legs:** hip-joint spheres (the leg meets the pelvis in a
  ball, not a shelf), calf masses behind the shins, ankle/
  thigh/shin cylinder segments 9 → 11.
- **Torso:** a tapered, z-flattened ribcage mass over the core
  (barrel chest — the flat slab sides die), the plate vest
  front becomes a curved molded plate (scaled sphere in the
  old envelope), the backpack becomes a rounded pack (same
  envelope), deltoids and neck gain segments.
- **Head:** face sphere 10×8 → 14×10; the helmet dome becomes
  a true sphere dome (was a squat cylinder); the square brim
  becomes a round disc; the jaw guard becomes a curved shell
  in the old envelope; ears gain segments.

## U9-03 — Death: articulated collapse, not a plank

The old fall rotated the whole root around the feet at
constant speed, then sank the body 0.7 m through the floor.
Replaced with a procedural collapse in Bot.update's dead
branch (corpse lifetime 1.5 s UNCHANGED — sim parity):
- **Direction:** damage() takes an optional shot direction
  (the gunfire funnel passes the ray direction); the body
  falls along the bullet's travel, with a deterministic
  per-bot variation from construction state (scanPhase —
  no Math.random in the death path). No direction (frag,
  barrel) → falls away from facing with the same variation.
  Headshots buckle faster.
- **Buckle (0–0.28 s):** hips drop ~6 cm, legs lag a few
  degrees at the hip (knee-bend read), torso starts to pitch,
  head begins to loll.
- **Collapse (to ~1.1 s):** the whole body tips around the
  HIP point (not the feet) while the hip sinks 0.88 → 0.16 m,
  so legs and torso come down on opposite sides of the hip
  and the body ends flat, resting on its gear — no floor
  clipping, no sinking. Torso pitches ahead of the root
  (α ≈ 0.55 rad at the hip pivot), the head lolls further
  with a slight roll, the gun droops in the grip and settles.
- **Settle (one, soft):** a single small overshoot + hip dip
  around t ≈ 1.0–1.25 s, then stillness. HP sprites and the
  team marker hide at death (a floating diamond over a corpse
  broke the read).
- Player death view: first-person — there is no player body
  to articulate; out of scope, noted honestly.

## Gates + proof

All five gates green on tree AND snapshot. Proof extras:
headless geometry audit (U8 baseline vs U9, real three via
the vendor loader): core-corner multisets intact, raycast
samples at core centres compared, per-bot tri delta counted;
a headless death run asserting the collapse reaches near-flat
and removal still lands at 1.5 s. mobile-check gains a T7
block (stamp + self-update + redundant triggers + touch
orientation listener); smoke gains D-pins (death articulation
present; the three hit-core lines byte-identical).
