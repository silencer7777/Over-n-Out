# V6 Update 14 — Report: Meta Systems Phase 2 (Tier Packages + Special Offers)

Built Thu Oct 29, 2026 (13:53 PT midday build session,
Coordinator; sole builder on the tree per the one-pen rule).
Commits: `d29c8b3` spec · `79c185d` code · this report.
**Pushed live + verified** under the Oct 28 auto-push law.
**The landed V6 count is now 14.**

Queue taken: meta systems phase 2 — the U13 landing entry's
named head ("tier packages + special offers, spending MC
through the guarded wallet"). Everything MC buys is cosmetic
(shop emblems) — no XP, no camos, no power. Scopes are
untouched and confirmed working — **HOLD right mouse
button** to aim down sight (touch: ADS button).

## What shipped

- **U14-01 Shop engine in `js/meta.js`** (Laurel + Ledger).
  `TIER_PACKAGES`: FIELD PACK 150 MC / RANGER PACK 450 MC /
  COMMAND PACK 900 MC. `SPECIAL_OFFERS`: MEDIC KIT 250 MC /
  ACE KIT 350 MC / FLARE KIT 550 MC. Each item grants one of
  6 new **shop emblems** (❯❯ FIELD CHEVRON, ✦ RANGER STAR,
  ⚑ COMMAND BANNER, ✚ MEDIC CROSS, ♠ ACE, ✧ FLARE STAR).
  One offer is **featured each day** (pure rotation from the
  date) at 30% off — price = floor(price × 0.7); packages are
  never discounted. `purchaseItem` refuses unknown items,
  already-owned items (checked BEFORE any charge), and
  insufficient funds. Two new badges: OUTFITTER (own any
  shop item) and QUARTERMASTER (own all 3 packages) —
  BADGES 8 → 10.
- **U14-02 Profile owned block** (Ledger). Profiles record
  owned shop items (sanitized: known ids only, deduped,
  capped at 6). A hand-edited profile wearing a shop emblem
  it doesn't own is reset to the default emblem on load.
  Pre-U14 profiles migrate losslessly (smoke PG10).
- **U14-03 SUPPLY shop UI** (Lens). The SERVICE RECORD panel
  gains a shop section: package buttons (price, or OWNED),
  offer buttons (today's featured offer marked ★ FEATURED —
  30% OFF at the discounted price), an owned count line, and
  the 6 shop emblems in the emblem picker — owned ones
  selectable, unowned ones labelled with the item that
  grants them. Buying reports its result on the shop line.

## Security items shipped (standing hardening priority)

- **Economy anti-duplication, round 2:** one-time items
  cannot be re-bought; the owned check precedes any charge.
- **Discount integrity:** the featured discount is a pure
  function of the date — no stored discount state to tamper
  with; the owned list is re-validated on every load/save.
- **Unearned-emblem guard:** sanitize resets a shop emblem
  whose granting item is not owned.
- The wallet still cannot overdraw (spendCredits guard).
- No new endpoints, message types, or network calls.
- **Still open (named, not hidden):** Stage 2 signed session
  verification — Lockdown + Odin have **not** certified the
  hardening pass complete.

## Before / after scorecard

| Measure | Before (U13) | After (U14) | Note |
|---|---|---|---|
| Scope vs plan | — | 5/5 items shipped whole | attack dogs + movement follow-ups phased by design, stated in spec |
| Sustained calls (compound/forest/snow/mars) | 134/147/146/148 | identical | Δ0 — data + DOM only, bar 165 |
| Tris / shadow | forest 281,526/300k; shadow 199/200 | identical | no meshes, no casters added |
| Gates (tree) | green | smoke ✓ (PG10 + M11 shop ids) biome ✓ reachability ✓ maps ✓ mobile ✓ (incl. new T11 ×36) | 2 named re-pins: T7 witness 13→14, T10 badge count 8→10 |
| Gates (snapshot) | — | all five green | re-run on the pushed git-archive snapshot |
| Live verification | — | byte-exact | index 13,716 B (BUILD U14 stamp served), main.js 135,977 B, world.js 87,158 B, meta.js 12,000 B, progression.js 16,033 B, style.css 39,013 B — all = snapshot; `purchaseItem` / `TIER_PACKAGES` confirmed in live meta.js. Pages flipped ~7 min after push (first checks served U13 bytes; re-check matched) |
| Hit/balance integrity | — | untouched | no weapon, hit-core, XP, or camo numbers moved; shop grants are cosmetic emblems only |
| Re-pins | — | 2 named (T7 witness, T10 badge count) | plus new PG10 / T11 pins |

## Playtest asks for Brett

1. **Build stamp first:** menu footer should read
   **BUILD U14**.
2. **Claim today's daily reward** first if you haven't —
   the cheapest package (FIELD PACK) costs 150 MC, about
   two days of daily rewards.
3. **SUPPLY section** (in SERVICE RECORD): today's featured
   offer shows ★ FEATURED — 30% OFF. Buying anything you own
   shows OWNED and can't be bought twice.
4. After a purchase, the granted emblem appears selectable
   in the emblem picker — and finishing a match with a shop
   item owned should earn the **OUTFITTER** badge.

Queue after U14: attack dogs (AI actor class, Ghost +
Laurel), movement-feel follow-ups, and Brett's verdicts on
the meta passes.
