# OVER N' OUT — Roadmap

Built in stages. Each stage ships something real before the next begins.

## ✅ Stage 1 — Playable core (v0.1, done Oct 23, 2026)
- Browser FPS: pointer-lock aim, WASD + sprint + jump, hitscan rifle, reload
- Enemy bots: advance / strafe / burst fire with real line-of-sight checks
- Wave system, HUD (health / ammo / kills), death + redeploy, pause
- Synthesized sound effects (WebAudio, zero asset files)
- Zero-dependency Node server; vendored Three.js (works offline)
- Guardian: smoke suite + GitHub Actions CI + scheduled checks

Next polish queue: hit feedback tuning, bot variety, second map, mobile touch controls.
*(Superseded in part by v0.2 below: hit feedback tuning shipped in
Session 1 Batch 1 + the arsenal pass, and bot variety has started via
weapons. Second map and mobile touch controls remain queued.)*

## ✅ v0.2 — Arsenal update (done Oct 23, 2026)
- **5-weapon system from one data table** (`js/weapons.js`): Assault
  Rifle / SMG / Shotgun / DMR / Pistol — damage, fire interval, mag
  size, falloff and spread live in the table, not in the shooting code.
- **Menu loadout picker + in-game switching:** pick your starting
  weapon in the menu, switch any time with keys **1–5**; HUD shows
  the current weapon name.
- **Bots armed from the same table:** bots draw their weapons from
  `js/weapons.js` too, so bot variety and player balance can never
  drift apart — and the table is the shared data the future
  authoritative server will validate hits against.
- **Session 1 Batch 1 realism work** (Phase 0 below): dusk sky, sun
  disc and shadows; spread bloom + distance damage falloff; sprint
  FOV kick + landing dip; bot aim-up delay, burst shaping, moving-
  target penalty and damage flinch; distance-attenuated, layered
  audio with a distinct headshot confirm. Full detail:
  `docs/sessions/session-001.md`.
- **Multiplayer groundwork (design only):** `docs/MULTIPLAYER.md` —
  authoritative-server design, WebSocket protocol sketch and the
  migration path for the v3 milestone (Stage 4). No networking built.

## 🔜 Stage 2 — Accounts & cloud saves
- Auth via a managed provider (Firebase Auth or Supabase) — Google + social
  sign-in, email/password with proper hashing handled by the provider.
  **We never hand-roll password storage.**
- Player profile: callsign, level/XP, stats, settings — saved server-side.
- Security rules: a player can only read/write their own save. All progress
  writes validated on the server (never trust the client with XP/money).

## 🔜 Stage 3 — Store & monetization
- Cosmetic-only shop (gun skins, outfits, banners) — no pay-to-win.
- Payments via **Stripe Checkout**: card data never touches our server
  (keeps us out of PCI scope). Webhook-verified fulfillment only — an item
  is granted when Stripe's signed webhook says the payment cleared,
  never because the client claims it paid.
- Prices, refunds, and taxes configured in Stripe; test mode first.

## 🔜 Stage 4 — Multiplayer — **the v3 milestone**
**Online multiplayer is the next major version (v3).** The full design
— goals/non-goals, authoritative-server model, WebSocket protocol,
state-sync, anti-cheat rules, and the staged migration path from the
current code — lives in `docs/MULTIPLAYER.md`. Design only for now;
no networking is built yet.
- Real-time matches via an authoritative server (WebSocket). The server
  owns positions and hit validation — the only sane anti-cheat baseline.
- Start with co-op waves (this game's bots become the shared enemy),
  then PvP modes.

## 🔜 Stage 5 — Unity mobile port
- Rebuild the client in Unity for iOS/Android app stores, reusing the
  Stage 2–3 backend (accounts, saves, store) unchanged.
- Apple Developer ($99/yr) + Google Play ($25 one-time) accounts required;
  review timelines apply.

## Standing security rules
1. Secrets live in environment variables / the vault — never in git.
2. No card data, no raw passwords, ever, on our servers.
3. Every money/XP change is server-validated.
4. Dependencies pinned; CI green before anything ships.

---

# Studio Program (2-year horizon)

Adopted Studio Session 1 (Oct 23, 2026). This is the studio's long-horizon
enhancement program, run in batches by the roster in `docs/TEAM.md`. It sits
alongside the staged product roadmap above: Stages 2–5 remain the product
spine; this program is the craft track that makes each stage feel real.
Everything stays procedural (code-generated assets only), dependency-free
unless the CTO seat signs off, and smoke-green at every step.

## Phase 0 — Feel & believability (months 0–3) · *Batch 1 starts here*
*Status: ✅ shipped in Session 1 Batch 1 / v0.2 (Oct 23, 2026) — see
`docs/sessions/session-001.md` and the v0.2 section above.*
- ✅ **Graphics:** dusk atmosphere pass — layered fog, gradient sky with sun
  disc, shadow-casting sun light, horizon silhouettes, ground wear detail.
- ✅ **Gameplay feel:** bloom-style spread that grows under sustained fire and
  recovers, distance damage falloff, sprint FOV kick, landing dip.
- ✅ **Bot intelligence:** aim-up reaction delay scaled by difficulty, burst
  accuracy that tightens across a burst and degrades against a strafing
  target, damage flinch.
- ✅ **Audio:** distance-attenuated enemy fire, ambient wind bed, layered
  gunshot (crack + body + sub), distinct headshot confirm.
- ✅ **QA:** smoke suite gains security lint (no external calls, no `eval`)
  and server-header checks.

## Phase 1 — Depth (months 3–6)
*Status: not started — except the Gameplay weapon item, which shipped
early and expanded in v0.2 as the full 5-weapon arsenal (see above).*
- **Graphics:** dynamic sky cycle (dusk → night), light pools from emissive
  fixtures, impact decals/scorch marks, particle impacts and muzzle smoke.
- **Gameplay:** second weapon profile (burst SMG), ADS (aim-down-sights)
  with spread tightening, crouch/slide-lite movement, reload stages.
- **Bots:** roles (rusher / holder / flanker), cover-seeking, retreat at
  low HP, coordinated wave compositions instead of uniform spawns.
- **Audio:** occlusion-lite (muffled fire through walls), directional
  hit-direction cues, adaptive music bed (synth pads that tense in combat).
- **World:** second arena variant, destructible-lite props (crates that
  splinter and stop blocking after HP), richer cover language.

## Phase 2 — Systems (months 6–12, overlaps Stage 2)
- **Backend/security:** accounts + cloud saves ship (Stage 2) behind
  managed auth; server-side validation of every progress write; rate
  limiting and abuse logging on the API; CSP tightened and audited.
- **Gameplay:** XP/level curve, per-weapon stats tracking, settings
  (sensitivity, FOV, volume) persisted to the save.
- **Bots:** difficulty director that reads player performance and tunes
  wave pressure; named elite bots with distinct silhouettes.
- **QA:** automated playtest harness (headless bot-vs-bot soak runs),
  performance budget gate in CI (frame time + asset weight).

## Phase 3 — Social & store readiness (months 12–18, overlaps Stage 3)
- **Store:** cosmetic-only catalog, Stripe Checkout with webhook-verified
  fulfillment; skins applied via a material-swap system built in Phase 1.
- **Graphics:** cosmetic material pipeline (camos/finishes as procedural
  textures), menu/showroom scene for owned items.
- **Security:** purchase-flow threat review, replay protection on webhooks,
  save-tamper detection (signed snapshots).

## Phase 4 — Multiplayer & mobile prep (months 18–24, overlaps Stages 4–5)
- **Multiplayer:** authoritative-server co-op waves prototype; bots become
  the shared enemy; client prediction only after the server owns truth.
- **Mobile:** touch-control scheme prototyped in the browser build;
  performance tiers so the same code base informs the Unity port.
- **Audio:** full mix pass — loudness targets, per-channel buses,
  accessibility options (visual hit indicators, subtitle-lite cues).

## Program rules
- One batch per studio session; every batch lists its files up front and
  no two squads share a file.
- Anything that can't keep the smoke suite green is reverted, not forced.
- Realism never outruns performance: Feather (Performance) reviews every
  graphics batch against a mid-tier laptop budget.
