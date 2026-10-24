# Backend — placeholder

Stage 1 ships the game fully client-side (plus the static file server in
`../server/`). This folder is where the real backend lands in Stage 2/3:

- `auth` — handled by Firebase Auth / Supabase (managed, secure by default)
- `api` — profile + progress endpoints (server-validated writes only)
- `store` — Stripe Checkout sessions + signed webhook fulfillment

Design rules live in `../docs/ROADMAP.md` under "Standing security rules."
Nothing here accepts payments or stores credentials yet — by design.
