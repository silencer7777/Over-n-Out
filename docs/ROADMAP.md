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

## 🔜 Stage 4 — Multiplayer
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
