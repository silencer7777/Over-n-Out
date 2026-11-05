# Stage 2 — Accounts & Signed Sessions (DESIGN ONLY)

*Written 2026-11-04 for the Lockdown pass, spec item 7
(`docs/sessions/v7-midday-2026-10-30-report.md`): "design +
threat model in the session doc; implementation is its own
later update." **No code in this update implements any of this.**
`hello.session` remains shape-checked only, and every surface
that says so (boot banner, `net/README.md`, MULTIPLAYER.md §11
risk 4) keeps saying so until the implementation update lands
and is verified.*

---

## 1. What exists today (honest baseline)

- **No accounts.** A player is a display name a client asserts
  in `hello` (1–24 chars, control characters rejected) plus a
  server-assigned connection id (`w7`, `w8`, …).
- **No persistence.** Rooms, XP tallies, and results live in
  server memory for the length of a match. Meta/progression
  (credits, emblems, daily rewards) live client-side in
  localStorage and are therefore client-trusted *by design* —
  acceptable for single-player, meaningless to protect online
  until identity exists.
- **The room code is the only access control** for online play
  (4 chars, treated as a join key — see `docs/FIREWALL.md` §1).
- Lockdown (2026-11-04) fixed identity *within* a connection
  (re-hello refused, chat stamps server-side), but nothing
  binds identity *across* connections.

## 2. Threat model

| # | Threat | Today | With Stage 2 |
|---|---|---|---|
| T1 | **Impersonation** — join as "BRETT" (or a friend's callsign) | Trivially possible | Token's subject IS the callsign; `hello.name` ignored or must match |
| T2 | **Room infiltration** — guess/brute a room code | 4-char space, join attempts uncapped by identity; creation capped (32) and codes unlisted | Login rate limits + optional room passwords for private rooms (later delta) |
| T3 | **Session theft** — steal a token, replay it | Nothing to steal | HTTPS/WSS only; 24 h expiry; token bound to nothing else, so theft = 24 h of impersonation — accepted at this scale, rotation on login shortens it |
| T4 | **Token forgery** — mint a valid-looking token | n/a | HMAC-SHA256 with a server-only secret; constant-time verify; unknown alg/kid refused |
| T5 | **Credential stuffing / guessing** at login | n/a | scrypt hashes; per-IP + per-account attempt caps with backoff; generic "nope" errors (no user-existence oracle) |
| T6 | **Account enumeration** via signup/login errors | n/a | Identical error text and timing shape for unknown-user vs wrong-passphrase |
| T7 | **Server file theft** — the account store leaks | n/a | Store holds salted scrypt hashes + callsigns only. No emails, no real names, no payment data — there is nothing else to leak |
| T8 | **Reconnect seat theft** — grab a dropped player's seat | Seat frees on disconnect; anyone can take the name | The 30 s grace seat (§5) is reclaimable ONLY by the same token subject |

Out of scope by design: real-money purchases (never), email
verification/password reset by mail (no emails collected — a
lost passphrase means a lost account, stated plainly at signup),
multi-device sync, moderation tooling.

## 3. Account model

The minimum that makes identity mean something, and nothing
more:

- **Callsign** — unique, 3–16 chars, `[A-Za-z0-9_-]`, reserved
  list (server/admin/system names) refused. This is the public
  identity everywhere (chat stamps, results, Service Record).
- **Passphrase** — ≥10 chars. Stored as **scrypt**
  (`node:crypto`, zero new dependencies — the repo's standing
  rule) with a per-account 16-byte random salt and parameters
  recorded alongside the hash so they can be raised later.
- **Store** — one JSON file on the host
  (`~/.overnout/accounts.json`, mode `0600`), atomic-rename
  writes, loaded at boot. At playtest scale (tens of accounts)
  a database is ceremony; the file format is a deliberate,
  documented stepping-stone, and the access layer is one module
  so a later SQLite swap touches one file.

## 4. Session token

- **Issuance:** `POST`-equivalent over the socket — a `login`
  message (new MSG type, protocol extension like chat/signal,
  version stays 1) carrying `{ callsign, passphrase }`, answered
  by `session { token, expiresAt }` or a generic `error`.
  Login is attempted over `wss://` only in public hosting (the
  tunnel guarantees it); the server cannot see the transport's
  TLS, so the *deployment rule* carries this — the runbook
  already forbids raw-port public play.
- **Format:** `v1.<base64url(payload)>.<base64url(sig)>` where
  payload is `{ sub: callsign, iat, exp }` and sig is
  HMAC-SHA256 over `v1.<payload>` with the server secret.
  Fits the existing `hello.session` shape (≤1024 chars) with
  room to spare.
- **Secret:** `ONO_SESSION_SECRET` env, ≥32 random bytes,
  generated once by the host operator, stored outside the repo
  (password manager / host keychain), rotatable by restart
  (rotation invalidates all live tokens — acceptable, players
  log in again).
- **Lifetime:** 24 h. No refresh token in v1 of Stage 2; a new
  login mints a new token.
- **Verification (in `GameServer` HELLO, before room join):**
  parse → constant-time HMAC compare → expiry check → the
  player record's name is **set from `sub`**, overriding/
  ignoring `hello.name`. A hello with no token still works in
  **guest mode** (name suffixed `-G` by the server? — open
  question §7) ONLY on servers booted with
  `ONO_ALLOW_GUESTS=1`; the public default is token-required.

## 5. Reconnect grace (MULTIPLAYER.md §11 risk 5, resolved by this design)

With identity bound to a token, the seat can survive a blink:
on disconnect, the sim seat is held **30 s**, frozen and
invulnerable; a new connection whose token subject matches the
seat rebinds it (position/HP/ammo intact) — and ONLY that
subject can (threat T8). Without a token there is nothing to
rebind *to*, which is why this was undecidable before Stage 2.

## 6. What Stage 2 unlocks (and what it must not smuggle in)

- **Server-side meta persistence becomes sound:** credits,
  emblems, badges, daily-reward state keyed by callsign in the
  account store's sibling file. Until identity exists,
  persisting progression server-side would just preserve
  whoever-asserted-it-first garbage — which is why the Lockdown
  pass deliberately did NOT build it.
- **Violation history per account** (the Lockdown counters are
  per-connection today) → repeat-offender kicks become possible
  in a later moderation delta. Not in this design's build scope.
- **No store/checkout changes.** In-game currency only, forever
  per Brett's standing rule.

## 7. Open questions for Brett before implementation

1. Guests: allowed on the public server at all, or accounts
   only once Stage 2 exists? (Design leans: guests OFF by
   default, ON for playtest nights via env flag.)
2. Callsign changes: never, or once per account? (Leans: never
   in v1 — keeps chat/results history coherent.)
3. Signup openness: anyone with the tunnel address, or an
   invite code the host hands out? (Leans: invite code —
   matches the private-tunnel posture.)

## 9. Clan wars — the missing piece (V7.19 groundwork note)

Shipped in V7.19 (account-independent groundwork, js/clans.js):
clan name + tag in the local profile (sanitized), tag shown
with callsigns everywhere names flow ([TAG] Name), the tag
riding the hello as a structured `clan` field (protocol
shape-checked), and the sim storing `clanTag` on the player
record. A PLAY-tab CLAN WAR entry point exists and tells the
player the truth: wars unlock with accounts.

What real clan wars still need, and only Stage 2 provides:

- **Clan registry** (server-side, keyed by account id, never by
  callsign string): clan record { id, name, tag, founder,
  created }, tag uniqueness enforced at creation. Today any
  client can assert any tag — display-only, by design.
- **Membership**: roles (leader/officer/member), invites and
  join/leave, one clan per account. Persistence rides the same
  account store as §6's meta persistence.
- **War records**: clan-vs-clan match results keyed by clan id
  (wins/losses, war history). A war MATCH also needs the sim to
  field two human teams — today every human plays team 'you'
  against Kestrel bots (co-op architecture); team assignment by
  clanTag at addSimPlayer is the seam V7.19 left for it, and
  bot-fill/win-condition rules for a human 'kestrel' side are
  part of that build, not a flag flip.
- **Which open decision unblocks what**: §7 Q1 (guests) decides
  whether a guest connection may carry a clan tag into a war
  room at all (design leans no — membership is an account
  property). Q2 (callsign changes) does NOT block clan wars:
  membership keys on account id, so callsigns may change freely
  underneath. Q3 (invite code) does not block either — clan
  invites are a separate flow from server signup — but the
  invite-code mechanism, if chosen, is the natural transport
  for clan invites too. The true gate is the Stage 2 build
  itself (signed sessions + account store), not any single
  answer in §7.

## 8. Acceptance sketch for the implementation update

Token forgery probe (bad sig → `bad_session`), expired token
refused, name-spoof probe (hello.name ≠ sub → server uses sub),
login rate-limit probe, grace-rebind probe (T8: a *different*
account cannot take the held seat), guest-mode flag probe, and
the full existing gate suite green. Estimated build: one
sitting, server-only — the client gains a login form and stores
the token in sessionStorage (never localStorage; a stolen-tab
token dies with the tab).
