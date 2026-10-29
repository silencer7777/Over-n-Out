# V6 Update 13 — Spec: Meta Systems Phase 1 (Emblems, Badges, Daily Rewards)

Board meeting, Thu Oct 29, 2026 (06:00 PT morning build session,
Coordinator chairing). Full relevant squads convened per Brett's
Oct 28 full-capacity order: Apex + Vault + Verity (executive),
Laurel (meta — owner this update), Lockdown + Aegis (economy /
hardening), Ledger (systems), Lens (menu UI), Analog (input —
no scope, standing by), Trigger (gameplay — no balance scope),
Sentry + Tripwire (gates), Harbor (device matrix / release),
Ghost (attack dogs — phased, see below).

## Ground state at session start

- Tree clean at `f59c031`; landed V6 count = **12** (BUILD U12).
- Watch 05:07 PT rotation (Oct 29): all-pass — guardian green,
  live integrity byte-identical to HEAD, no security findings.
  Standing gap unchanged: Stage 2 signed sessions — hardening
  NOT certified complete.
- Brett's newest specs: his post-U11 directives shipped in U12
  (minimap fire-reveal, Lightning Strike, character pass 3, gun
  pass, menu grid removal). No new playtest verdicts since U12.
- Ledger queue head after U12: attack dogs (AI actor class),
  meta systems (emblems + badges first), movement follow-ups.
  This session takes **meta phase 1** — it is the named queue
  head ("emblems + badges first" in the U11 landing entry) and
  lands whole in one update. **Attack dogs stay phased** to a
  later V6 update (new AI actor class — Ghost's squad; not
  faked here), exactly the phasing Brett set in U12.

## Scope (numbered, owner + acceptance)

- **U13-01 New pure module `js/meta.js`** (Laurel + Ledger).
  No DOM, no THREE, no imports — same discipline as camo.js /
  minimap.js so headless tools pin it directly.
  - `EMBLEMS`: 8 emblems (id, name, glyph, unlock level).
    `meridian-star` (★) is the level-1 default everyone has;
    the rest earn at levels 3/5/8/12/16/20/25. Glyphs are plain
    text symbols — procedural/original, no assets.
  - `BADGES`: 8 special badges earned from lifetime stats +
    level: first-blood (1 kill), centurion (100 kills),
    veteran (10 matches), victor (5 wins), champion
    (25 wins), marksman (500 kills), high-command
    (level 20), completionist (50 matches).
    `evaluateBadges(meta, level)` is pure and idempotent —
    it returns only NEWLY earned badge ids.
  - `DAILY_REWARDS`: 7-day cycle of **Meridian Credits (MC)**,
    in-game currency only: [50, 75, 100, 125, 150, 200, 300].
    `claimDailyReward(meta, dateStr)` is pure on an injected
    `YYYY-MM-DD` string: same-day re-claim is refused
    (anti-duplication), a consecutive day advances the streak
    (wrapping 7→1), a gap resets to day 1. **No real-money
    purchases, no external payments — ever (Brett's law).**
  - Economy guards (Lockdown): `addCredits` clamps to a
    1,000,000 cap and never goes negative on bad input;
    `spendCredits` refuses insufficient funds and never
    overdraws. These are the foundation tier packages /
    special offers (phased to U14+) will spend through.
  Acceptance: mobile-check T10 pins emblem/badge/daily/economy
  behaviour incl. double-claim refusal and streak wrap.

- **U13-02 Profile meta block** (Ledger; Lockdown reviews).
  `js/progression.js`: profile gains
  `meta: { credits, emblem, badges: [], daily: { lastClaim,
  streakDay }, stats: { matches, wins, kills } }`.
  `createProfile` defaults it; `sanitizeProfile` repairs it —
  credits clamped 0..1,000,000, emblem validated against the
  emblem table (unknown → default), badges filtered to known
  ids (deduped, capped), daily date shape-checked, stats
  clamped to non-negative integers. Existing saved profiles
  migrate losslessly (missing meta → defaults; xp/classes/
  settings untouched).
  Acceptance: smoke PG9 pins default + sanitize + migration.

- **U13-03 Menu meta panel + wiring** (Lens + Laurel).
  `index.html` gains a SERVICE RECORD panel on menu page 1:
  `#meta-line` (emblem glyph + name · credits · badge count),
  `#emblem-pickers` (one button per emblem; locked ones show
  their level and cannot be selected — the camo-picker
  pattern), `#badge-line` (earned badge names, or a plain
  "no badges yet" line), `#daily-btn` + `#daily-line`
  (claim today's reward; after claiming, the button disables
  and the line names the amount + streak day).
  `js/main.js`: `renderMetaPanel()` renders all of it from the
  profile (textContent / DOM APIs only — no innerHTML);
  selecting an emblem persists immediately; the daily button
  claims with the player's LOCAL date and persists.
  Solo `endMatch` records the match into meta stats
  (matches +1, wins +1 on a win, kills += match kills),
  evaluates badges, persists, and adds `BADGE EARNED: …`
  lines to the after-action results. Online results are
  server-settled and are NOT double-counted here (named).
  Acceptance: smoke M11 gains the four new ids; T10 pins the
  main.js wiring strings; panel works with mouse + touch
  (native buttons, ≥ existing menu button sizing).

- **U13-04 Build witness 13** (Harbor). BUILD_NO 12→13,
  ono-build meta 13, `?v=13` assets, menu stamp BUILD U13.
  mobile-check T7 named re-pin (witness-only), as every update.

- **U13-05 Hardening slice** (Lockdown + Aegis). This update's
  anti-glitch/security work is the economy itself: daily
  rewards cannot be claimed twice for one date (the claim is
  a pure function of the stored last-claim date — replays,
  including a hand-edited same-day state, refuse), credits
  can never go negative or past the cap through the public
  functions, badge evaluation is idempotent (no duplicate
  badge farming by re-settling a match), and all meta values
  are re-sanitized on every load/save. No new endpoints, no
  new message types, no network calls. Stage 2 signed
  sessions remain open — hardening still NOT certified.

## Phased, not in this update (stated plainly)

- **Tier packages + special offers** — U14+; they will spend
  through U13's guarded `spendCredits`, in-game currency only.
- **Attack dogs** — later V6 update (new AI actor class).
- **Movement-feel follow-ups** — later V6 update.

## Perf baseline (recorded at meeting, from the U12 report)

Sustained calls 134/147/146/148 (compound/forest/snow/mars) vs
bar 165; forest sustained tris 281,526/300k; shadow estimate
199/200 (binding). U13 is data + DOM only: **zero new render
cost budgeted** — no meshes, no casters, calls/tris Δ0.

## Gates + push

All five gates green on tree, then on the git-archive
snapshot, then push under the Oct 28 auto-push law and
byte-verify live (index.html, js/main.js, js/world.js +
js/meta.js, js/progression.js). ADS is untouched; the standing
instruction stands: **HOLD right mouse button** to aim down
sight (touch: ADS button).
