# V6 Update 13 — Report: Meta Systems Phase 1

Built Thu Oct 29, 2026 (06:00 PT morning build session,
Coordinator). Commits: `f4e25d5` spec · `73d7231` code · this
report. **Pushed live + verified** under the Oct 28 auto-push
law. **The landed V6 count is now 13.**

Queue taken: meta systems, phase 1 — the ledger's named head
("emblems + badges first"). Tier packages + special offers
are phased to U14+ and will spend through this update's
guarded wallet. Attack dogs stay phased (new AI actor class).
Scopes are untouched and confirmed working — **HOLD right
mouse button** to aim down sight (touch: ADS button).

## What shipped

- **U13-01 `js/meta.js` (new, pure).** Eight emblems earned by
  level (★ MERIDIAN STAR at L1 through ◆ VOID DIAMOND at L25),
  eight special badges earned from lifetime stats + level
  (FIRST BLOOD at 1 kill … HIGH COMMAND at level 20), and a
  7-day daily-reward cycle paying **Meridian Credits** —
  50/75/100/125/150/200/300 MC. In-game currency only; no
  real-money purchases or external payments anywhere.
- **U13-02 Profile meta block.** Every profile now carries
  `meta { credits, emblem, badges, daily, stats }`, sanitized
  and clamped on every load/save. Profiles saved before U13
  migrate losslessly — xp, classes and settings untouched
  (smoke PG9 proves defaults + repair + migration).
- **U13-03 SERVICE RECORD panel (menu page 1).** Shows your
  emblem + credits + badge count, an emblem picker (locked
  emblems show their level, the camo-picker pattern), your
  earned badge names, and a **CLAIM DAILY REWARD** button —
  after claiming it disables until tomorrow and names your
  streak day. Finishing a solo match records it into your
  lifetime stats and any new badge appears in the
  after-action results as `BADGE EARNED: …`. Online matches
  settle on the server and are not double-counted (named).

## Security items shipped (standing hardening priority)

- **Economy anti-duplication:** a daily reward cannot be
  claimed twice for one date — the claim is a pure function
  of the stored last-claim date; same-day replays refuse and
  pay nothing (mobile-check T10 pins it).
- **Guarded wallet:** credits clamp to a 1,000,000 cap,
  `spendCredits` refuses insufficient funds and can never
  overdraw — the foundation tier packages/offers will use.
- **Badge idempotence:** evaluation returns only newly
  earned badges, so re-settling can never farm duplicates.
- No new endpoints, message types, or network calls.
- **Still open (named, not hidden):** Stage 2 signed session
  verification — Lockdown + Odin have **not** certified the
  hardening pass complete.

## Before / after scorecard

| Measure | Before (U12) | After (U13) | Note |
|---|---|---|---|
| Scope vs plan | — | 5/5 items shipped whole | tier packages/offers + attack dogs phased by design, stated in spec |
| Sustained calls (compound/forest/snow/mars) | 134/147/146/148 | identical | Δ0 — data + DOM only, bar 165 |
| Tris / shadow | forest 281,526/300k; shadow 199/200 | identical | no meshes, no casters added |
| Gates (tree) | green | smoke ✓ (PG9 + M11 ids) biome ✓ reachability ✓ maps ✓ mobile ✓ (incl. new T10 ×27) | 1 named re-pin: T7 witness 12→13 |
| Gates (snapshot) | — | all five green | re-run on the pushed git-archive snapshot |
| Live verification | — | byte-exact | index 13,256 B (BUILD U13 stamp served), main.js 132,341 B, world.js 87,158 B, meta.js 7,158 B, progression.js 15,588 B, style.css 39,013 B — all = snapshot; `DAILY_REWARDS` confirmed in live meta.js |
| Hit/balance integrity | — | untouched | no weapon, hit-core, or XP numbers moved; meta rewards are cosmetic/economy only |
| Re-pins | — | 1 named (T7 witness) | plus new PG9 / T10 pins |

## Playtest asks for Brett

1. **Build stamp first:** menu footer should read
   **BUILD U13**.
2. **Service Record panel** (under your level line): tap
   **CLAIM DAILY REWARD** — you should get +50 MC and the
   button should grey out until tomorrow.
3. **Finish any solo match** with at least one kill — the
   results should show **BADGE EARNED: FIRST BLOOD**, and the
   panel should list it.
4. Emblems unlock as you level — the picker shows which
   level each one needs.

Queue after U13: meta phase 2 (tier packages + special
offers, spending MC through the guarded wallet), attack dogs
(AI actor, Ghost + Laurel), movement-feel follow-ups, and
Brett's verdicts on this pass.
