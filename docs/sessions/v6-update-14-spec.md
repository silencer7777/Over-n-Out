# V6 Update 14 — Spec: Meta Systems Phase 2 (Tier Packages + Special Offers)

Board meeting, Thu Oct 29, 2026 (13:53 PT midday build session,
Coordinator chairing). Full relevant squads convened per Brett's
Oct 28 full-capacity order: Apex + Vault + Verity (executive),
Laurel (meta — owner this update), Lockdown + Aegis (economy /
hardening), Ledger (systems), Lens (menu UI), Analog (input —
standing by), Trigger (gameplay — no balance scope), Sentry +
Tripwire (gates), Harbor (device matrix / release).

## Ground state at session start

- Tree clean at `1222f7a` (U13 landed + two training commits);
  landed V6 count = **13** (BUILD U13 live, byte-verified).
- Watch 13:07 PT rotation (Oct 29, day shift): all-pass —
  guardian green, live integrity byte-identical to HEAD, no
  security findings. Standing gap unchanged: Stage 2 signed
  sessions — hardening NOT certified complete.
- No new Brett playtest verdicts since U13. Ledger queue head
  after U13 (named in the U13 landing entry): **meta phase 2
  (tier packages + special offers spending MC)**, then attack
  dogs (AI), movement follow-ups. This session takes meta
  phase 2 whole. Attack dogs stay phased (new AI actor class).
- Scopes are confirmed working and untouched this update —
  **HOLD right mouse button** to aim down sight (touch: ADS).

## Design ruling (Laurel + Lockdown, Apex approved)

Everything MC can buy is **cosmetic and self-contained**: shop
emblems for the Service Record. No XP, no camos (the prestige
track stays level-earned), no power, no gameplay effect —
hit/balance integrity is therefore untouched by construction.
**In-game currency only — no real-money purchases or external
payments, ever (Brett's law).**

## Scope (numbered, owner + acceptance)

- **U14-01 Shop tables + purchase engine in `js/meta.js`**
  (Laurel + Ledger; Lockdown reviews). Pure, no DOM/THREE.
  - `SHOP_EMBLEMS`: 6 shop emblems (id, name, glyph, itemId) —
    three granted by packages, three by offers:
    field-chevron ❯❯ / ranger-star ✦ / command-banner ⚑
    (packages); medic-cross ✚ / ace ♠ / flare-star ✧ (offers).
    The level table `EMBLEMS` (8) is UNCHANGED; `getEmblem(id)`
    resolves level emblems, then shop emblems, then the default
    (T10 fallback pin holds); `isEmblemId` covers both tables.
  - `TIER_PACKAGES`: 3 one-time packages, always available:
    field-pack FIELD PACK 150 MC → field-chevron;
    ranger-pack RANGER PACK 450 MC → ranger-star;
    command-pack COMMAND PACK 900 MC → command-banner.
  - `SPECIAL_OFFERS`: 3 one-time offers: medic-kit 250 MC →
    medic-cross; ace-kit 350 MC → ace; flare-kit 550 MC →
    flare-star. **Featured rotation:** exactly one offer is
    featured per day, chosen purely from the injected date
    string (`dayNumber % 3`); the featured offer sells at
    30% off (price = floor(price × 0.7)). Packages are never
    discounted. `featuredOfferId(dateStr)` +
    `priceFor(itemId, dateStr)` are pure and deterministic.
  - `purchaseItem(meta, itemId, dateStr)` →
    `{ purchased, price, reason }`: refuses unknown items,
    already-owned items (anti-duplication — no charge), and
    insufficient funds (via the guarded `spendCredits` — can
    never overdraw). On success it charges the (possibly
    discounted) price and appends the item id to `meta.owned`.
  - Two new badges in `BADGES` (tests read `meta.owned`,
    guarded for fixtures without the field): **outfitter**
    OUTFITTER (own ≥1 shop item), **quartermaster**
    QUARTERMASTER (own all 3 tier packages). BADGES 8 → 10 —
    **named re-pin** (mobile-check T10 count; main.js badge
    line renders the count from BADGES.length, no hardcode).
  Acceptance: new mobile-check T11 pins tables, prices,
  featured rotation + discount math, purchase success /
  duplicate refusal / insufficient-funds refusal, and badge
  earning from ownership.

- **U14-02 Profile owned block** (Ledger; Lockdown reviews).
  `createMeta()` gains `owned: []`. `sanitizeProfile` repairs
  it: filtered to known shop item ids (packages + offers),
  deduped, capped at 6. A selected emblem that is a shop
  emblem whose granting item is NOT owned is reset to the
  default emblem (a hand-edited profile cannot wear an
  unearned shop emblem). Pre-U14 profiles migrate losslessly.
  Acceptance: smoke PG10 pins defaults + sanitize + the
  unearned-emblem reset + migration.

- **U14-03 Shop UI in the SERVICE RECORD panel** (Lens +
  Laurel). `index.html` meta panel gains: `#shop-line`
  (owned count), `#package-pickers` (one button per package:
  name + price MC; owned → `OWNED` disabled; clicking buys
  through `purchaseItem` with the player's LOCAL date,
  persists, re-renders, and reports the result on the line),
  `#offer-line` + `#offer-pickers` (all three offers shown;
  today's featured one is marked `★ FEATURED — 30% OFF` and
  shows the discounted price). The emblem picker additionally
  renders the 6 shop emblems: owned → selectable; unowned →
  locked, labelled with the granting item's name (never a
  level). All rendering via textContent / DOM APIs only.
  Acceptance: smoke M11 gains `shop-line`, `package-pickers`,
  `offer-line`, `offer-pickers`; T11 pins the main.js wiring
  strings; native buttons keep touch sizing.

- **U14-04 Build witness 14** (Harbor). BUILD_NO 13→14,
  ono-build meta 14, `?v=14` assets, menu stamp BUILD U14,
  menu chip "UPDATE 14 — LIVE BUILD". mobile-check T7 named
  re-pin (witness-only), as every update.

- **U14-05 Hardening slice** (Lockdown + Aegis). This update's
  anti-glitch/security work is economy duplication, again:
  one-time items cannot be re-bought (owned check precedes
  any charge), the featured discount is a pure function of
  the date (no client state to tamper with beyond the stored
  owned list, which sanitize re-validates every load), the
  wallet still cannot overdraw, and shop emblems cannot be
  worn unearned (sanitize reset). No new endpoints, message
  types, or network calls. Stage 2 signed sessions remain
  open — hardening still NOT certified complete.

## Phased, not in this update (stated plainly)

- **Attack dogs** — later V6 update (new AI actor class).
- **Movement-feel follow-ups** — later V6 update.
- No daily-reward or emblem/badge table changes beyond the
  two named badge additions.

## Perf baseline (recorded at meeting, from the U13 report)

Sustained calls 134/147/146/148 (compound/forest/snow/mars) vs
bar 165; forest sustained tris 281,526/300k; shadow estimate
199/200 (binding). U14 is data + DOM only: **zero new render
cost budgeted** — no meshes, no casters, calls/tris Δ0.

## Gates + push

All five gates green on tree, then on the git-archive
snapshot, then push under the Oct 28 auto-push law and
byte-verify live (index.html, js/main.js, js/world.js +
js/meta.js, js/progression.js). ADS is untouched; the standing
instruction stands: **HOLD right mouse button** to aim down
sight (touch: ADS button).
