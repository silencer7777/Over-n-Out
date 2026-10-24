# Board Meeting 003 — Minutes

**Date:** Oct 24, 2026 · **Co-chairs:** Dominic "Apex" Cross (Studio CEO) +
Aurelia "Overlord" Kane (Division Zero) · **Called by:** Brett — full V3
scope re-confirmed, nothing dropped; Phase 1 playtest feedback tabled
(movement ✅, lighting ❌).

**Attending:** all three teams — 83 seats, one vital task.

## The vital task

**"Make it real, make it readable, make it playable together — without
spending the frame budget."** Brett's Phase 2 priorities in his order:
guns → characters → landscape/levels → fun features → forest → M1 →
snow. Every item below carries one named owner and a resolution or an
honest deferral. Nothing was silently dropped.

## Vital issues

1. **Gun models must read as real guns** (Brett, headline focus).
   *Owner: Silvio "Silhouette" Ricci.* **RESOLVED** — js/gunmodels.js:
   one part list per class (AR 26 parts, SMG 17, shotgun 13, DMR 24,
   pistol 11) — receiver, barrel, muzzle device, magazine (curved AR /
   straight SMG+DMR / tube shotgun), stock, grip, trigger guard, optic
   or irons, rail, charging handle. Viewmodel merges per material
   (≤5 meshes, real metalness split); bot guns merge to ONE
   vertex-coloured mesh — same draw call as the old box. Verity
   sign-off on silhouettes.
2. **Character realism** (Brett).
   *Owner: Ricci + Pavel "Polygon" Dvorak.* **RESOLVED** — bots rebuilt
   from ~35 shaped parts (legs/boots/knee pads; torso + plate vest +
   pouches + arms + backpack + antenna; head + helmet + jaw guard),
   merged into the same 3 hit meshes. Draw calls per bot unchanged (7);
   hit volumes preserved exactly.
3. **Lighting still fails the playtest** (Brett, live V3 session:
   "barely see the enemies", shadows too heavy). Movement praised —
   no changes there, and none were made.
   *Owner: Mira "Golden Hour" Castellanos.* **RESOLVED (pending
   Brett's re-test)** — hemisphere fill 0.60 → 0.95 (the shadow-lift
   lever in this renderer), sun 1.75 → 1.85, exposure 0.95 → 1.10,
   bot emissive readability floor 0x180505 + lifted suit reds at zero
   draw calls. Verity's readability bar re-derived: hostile
   identifiable at 40 m in full shadow (fog still starts at 42 m —
   0% blend at 40 m; shadowed luminance up ~58% on fill, ~83%
   combined with exposure). Sun angle/colour/fog unchanged: brighter
   visibility, same golden-hour mood. Final verdict belongs to
   Brett's next playtest — no automation here can see it.
4. **Course expansion: add floor levels/routes** (Brett).
   *Owner: Hugo "Mason" Brandt.* **RESOLVED** — west deck (10×20, top
   2.3, mirrors east) + Stair C + deck cover + 10th spawn point.
   Hawkeye's gate extended, not waived: Stair C route row + source
   pins; gate now 15 checks / 6 routes, all PASS. Jump constants
   untouched.
5. **Fun features — board picks, tight set** (Brett).
   *Owner: Felix "Ember" Novak.* **RESOLVED, five shipped:** explosive
   barrels (chain reactions, radius falloff, pooled blast visuals),
   health/ammo pickups (deterministic drop cadence — no RNG droughts),
   kill-confirm hitmarker, Relay streak callouts (story.js), weapon
   inspect (F). Each smoke-covered (F1–F5). Cut by the board: slide
   mechanic (movement is Brett-approved as-is — do not touch),
   grenades (a second explosive system before barrels are
   playtested), killcam (scope).
6. **Forest full build** (Phase 1 deferral).
   *Owners: Ivanova / Reed / Lindholm.* **RESOLVED** — 46 trees in 6
   bands (2 interior groves break the long sightlines), layered
   two-tier canopies (6 blobs/tree), roots + branches, 52 bushes with
   world-rule gameplay (30 blocking). Machine-verified:
   tools/biome-check.mjs, 15/15 — counts, spawn/structure clearances,
   ≥3.09 m separation, index-exact reversibility.
7. **M1 headless sim** (Phase 1 deferral).
   *Owner: Dmitri "Mainframe" Volkov.* **RESOLVED** — net/sim.js:
   player physics + bot AI faithfully ported, wave director as a pure
   step over one match state, server raycast vs analytic hit volumes
   + worlddata AABBs, seeded determinism. Soak (Voss): 10/10 — waves
   progress, kills resolve, bot-vs-nobody clean, LOS 2.7 µs/ray,
   0.04 ms/tick vs the 33.3 ms budget. §11 risk 1 (bot AI server
   cost) is RETIRED with numbers.
8. **Snow** (Board 002 schedule).
   *Owner: Hana "Blizzard" Kimura.* **SCAFFOLD SHIPPED** — 26 drifts +
   10 ice rocks behind the selector, clearances verified, drift
   colliders live. Full build (terrain levels, snowfall, ice
   surfaces) is Phase 3 per Brett's priority order — DEFERRED WITH
   OWNER, not dropped.
9. **Mars planetary** (V3 plan).
   *Owner: Yara "Dune" Haddad.* **DESIGN GROUNDWORK ONLY** —
   DEFERRED WITH OWNER to Phase 3 per plan. Groundwork recorded:
   registry entry stands; biome seam proven by forest/snow; Mars
   deltas identified (palette/fog override per biome — the seam
   needs a scene-dressing hook applyBiome doesn't have yet; low-g
   movement is a sim-constants variant, NOT a client hack — Low-G
   Blake to spec against the reachability gate before any code).
10. **§10.1 WebSocket decision** (carried from Board 002).
    *Owners: Victor "Vault" Hale + Brett.* **BRIEF PREPARED — decision
    remains Brett's.** See the brief below. Board recommendation:
    **(a) hand-rolled RFC 6455**, recorded with Vault's reasoning;
    Brett ratifies or overrules before Phase 3 (M3) opens. M1/M2 do
    not depend on the answer.
11. **Carried watches from Board 001/002 — RULED ON:**
    - *Rooftop DMR nest* (Hawkeye): **STAYS OPEN, narrowed** — the
      west deck + Stair C now give the rooftop a second counter-angle
      (west-deck DMR sightline to the rooftop east parapet), and
      forest groves break two of its ground lanes. Re-test in Brett's
      next playtest; if it still camps, the fix is a rooftop cover
      shuffle, not a nerf.
    - *Stair margin 0.025* (0.6 tolerance vs 0.575 rise): **RULED
      ACCEPTED** — Stair C shipped on the same rise and the extended
      gate re-derives all three stair stacks from shipped constants;
      the margin is a property of the step rule, verified three
      phases running. Closed as a watch; the gate keeps guarding it.
    - *North-corridor spawn watch*: **STAYS OPEN** — no new evidence
      this phase (no live playtest of v0.3.0-dev forest build yet);
      forest corridor clearance is machine-verified (corridor rect is
      in CLEAR_RECTS), but feel is Brett's call. Carried to Board 004
      with the lighting verdict.
12. **Performance budget** (standing).
    *Owner: Jun "Sixty" Nakamura.* **HELD** — worst-case code-derived
    total ≈ 150 draw calls at the 9-bot cap with all Phase 2 features
    live (bot detail +0, bot guns +0, viewmodel +0, barrels +5,
    pickups ≤ +9 transient, explosion +1 transient) — at, not over,
    the <150 line, with dynamic quality scaling as the release valve.
    Triangles ≈ 21k vs 250k. Live F9 numbers still owed from Brett's
    next session; Watchdog/Graph remain on the hook for them.

## §10.1 WebSocket brief — for Brett's decision

**Question:** Node has no built-in WebSocket server. For M3 (socket +
room of one) we either hand-roll RFC 6455 framing on node:http's
upgrade event, or take the project's first dependency, `ws`.

| | (a) Hand-rolled RFC 6455 | (b) `ws` dependency |
|---|---|---|
| Code | ~150 lines: handshake accept, frame parse, ping/pong, close | `npm i ws`, ~20 lines of glue |
| Dependencies | **Zero — studio rule intact**; offline purity kept; nothing to pin/audit | First-ever dependency; needs pinning + CI install story; supply-chain surface (small, reputable) |
| Risk | Framing edge cases (fragmentation, masking, 64-bit lengths) — needs a fuzz pass; we own every bug | Battle-tested at huge scale; bugs are upstream's |
| Fit | Messages here are small JSON, one socket per player, low rates — well inside hand-rolled competence | Built for far heavier loads than v3 co-op will ever see |
| Reversibility | If it struggles, swapping to `ws` later touches only the transport class (the seam is transport-agnostic — proven by LoopbackTransport) | Removing a dependency later is equally possible but rarely done |

**Board recommendation: (a) hand-rolled**, Vault concurring — the
zero-dependency rule is load-bearing for this project's offline/
Pages story, traffic is tiny, and the seam makes the choice
reversible. **The decision is Brett's**: ratify (a), or overrule to
(b) — either way it gets recorded here and M3 builds on it. Nothing
in M1/M2 waits on this.

## Adjournment

Phase 2 closes on the chairs' verification of the final tree: smoke
141/141, reachability 15/15 (6 routes), biome check 15/15, soak
10/10. Nothing pushed — Brett approves every push.
