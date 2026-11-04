# V8 Lockdown — backend hardening session report (2026-11-04, night)

**Mandate (Brett, ~00:24 PT, follow-on to the vision-queue
run):** *"lets enhance backend code for over n out. add security
measures to protect peoples accounts and info. create a well
documented firewall to keep the process of bug takeover
limited. if there is anyway to enhance the in game at all with
backend or if it already has it, focus on making that better as
well."*

This un-parked the Lockdown spec written in
`docs/sessions/v7-midday-2026-10-30-report.md` (7 items with
acceptance tests). All 7 are closed below: items 1–6 in code,
item 7 as design-only, exactly as specced. One pen (Coordinator)
on the tree throughout; the client build is untouched — **the
live game remains V7.9 / v0.7.9**, and every client perf number
in the vision-night report stands unchanged.

---

## 1. Audit first — the backend as it actually exists

**Architecture.** Two halves, honestly different in maturity:

- *Static client* — GitHub Pages serves the game; single-player
  progression/meta (credits, emblems, daily rewards) live in the
  player's browser localStorage. **There are no accounts, no
  passwords, no emails, no payment data — nothing personal is
  collected anywhere.** "Protect peoples accounts and info"
  therefore means, today: protect the *match* (room codes,
  display identity, in-match integrity) and build the account
  layer's design before building the layer.
- *Match server* (`net/`) — a Node process: hand-rolled RFC 6455
  WebSocket transport → GameServer (rooms, protocol validation,
  per-session server-computed XP) → authoritative headless sim.
  Clients send intent only; the protocol has **no message type
  that carries an outcome** (damage/kills/positions/score), and
  the sim validates movement/fire/hit plausibility against the
  same tables the client uses.

**Already strong (verified in code, not assumed):** strict
protocol validators with no coercion; per-type message size
caps; input rate cap (40/s, transport); chat rate cap +
control-character stripping; server-stamped chat identity;
hello-first + hello/idle timeouts; slow-reader cut; localhost
default bind with TLS at the tunnel; control characters
rejected in display names; handler faults isolated per
connection.

**Found wanting (the honest list):**

1. **No connection or room caps.** Any number of sockets could
   be opened; every room ever created lived — with its whole
   headless sim — until process restart. A churn attack (or a
   buggy client) grows memory/CPU without bound. *(Fixed, §2.1.)*
2. **No rate cap on non-input messages.** Hello/ping/signal
   could be sent at line rate; signal relays up-to-16 KB
   payloads to another player — an amplification lever.
   *(Fixed, §2.2.)*
3. **Refused claims were silent.** Invalid inputs were dropped
   with an error reply but never counted or logged anywhere —
   an attack (or a broken client build) was indistinguishable
   from quiet. *(Fixed, §2.3.)*
4. **Re-hello silently re-identified a connection.** A second
   `hello` replaced the player record wholesale — new name, new
   loadout — while chat stamps and XP key off that record.
   *(Fixed, §2.4.)*
5. **Signal size mismatch across layers.** GameServer allows
   signal messages to 16,384 B, but the transport's frame
   decoder was capped at 4,096 B — so **legitimate voice
   signaling with a real-world SDP (>4 KB is normal) was killed
   at the frame layer over real sockets.** A correctness bug
   wearing a security costume. *(Fixed, §2.5 — this is also the
   night's clearest in-game improvement.)*
6. **No Origin check on upgrade.** Any website could open a
   socket to the server from a visitor's browser (cross-site
   WebSocket hijacking). Low blast radius today (no cookies/
   tokens to ride), account-sized tomorrow. *(Fixed, §2.6.)*
7. **The status JSON listed live room codes.** Room codes are
   join keys; the health endpoint handed them to anyone who
   could reach the HTTP port (including through a mis-routed
   tunnel). *(Fixed, §2.7.)*
8. **No accounts / session verification** — `hello.session` is
   shape-checked only. Known, documented since M3 (boot banner,
   README, MULTIPLAYER §11 risk 4), and deliberately NOT
   stubbed further: Stage 2 is designed in this pass (§3),
   implemented in its own update.

## 2. Measures implemented (spec items 1–6 + finding 7)

All limits live in `net/protocol.js` `LIMITS` (one source).
Local commit **479b3e4**; pushed via the Contents API and
verified byte-identical against the repo (see §6).

### 2.1 Connection + room caps, empty-room GC (item 1)
- Transport refuses upgrades past **64 concurrent connections**
  or **8 per source IP** (503 at handshake, before any state).
- GameServer refuses new rooms past **32** (`createRoom` →
  null; join gets a `server_full` error). Existing rooms are
  never affected.
- Rooms that sit empty for **60 s are reaped** with their sims
  on the tick loop (the default LOBBY room is exempt). Room
  state no longer accumulates across a long hosting session.
- *Acceptance:* smoke **N18** (cap), **N21** (GC + LOBBY
  exempt), ws-soak **C10** (per-IP refusal over real sockets).

### 2.2 General rate cap for non-input messages (item 2)
20/s per player for hello/ping/chat/signal combined, enforced
in `GameServer.handleMessage`; over-rate messages are dropped
with a `rate_limited` error and counted as violations. Input
keeps its dedicated 40/s transport cap; chat keeps its tighter
5-per-4 s cap.
*Acceptance:* smoke **N19** (19 pongs through — hello consumed
one slot — then drops).

### 2.3 Anti-cheat violation logging (item 3)
Every refused claim (bad input/hello/chat/signal, oversize,
unknown/unexpected type, bad mode/map/loadout, rate trips,
re-hello) increments a per-player counter
(`GameServer.violations`); the first 5 per player also emit a
`[violation] player=… room=… kind=…` log line through an
injectable logger. The budget is deliberate: an unbounded log
is a disk-fill attack, so counting continues silently after it.
*Acceptance:* smoke **N20** (9 violations counted, exactly 5
lines); visible live in ws-soak output (the C8 bad-loadout
probe now logs its `[violation]` line).

### 2.4 Re-hello identity (item 4)
A second hello on a connection that already holds a named
player record is refused (`already_hello`); the original name/
loadout/record are untouched. (A nameless stub from the
forgiving loopback input path is not an identity and does not
trip this.) Reconnect = new connection — and, post-Stage-2, a
token-bound seat (§3).
*Acceptance:* smoke **N17**.

### 2.5 Signal size reconciliation (item 5)
One number, both layers: the transport decoder cap is now
`LIMITS.SIGNAL_MAX_BYTES` (16,384) — the largest legal message.
GameServer still enforces 4,096 for every non-signal type, so
nothing widens: a 16 KB non-signal message is refused one layer
up, before it is trusted. **Side effect that matters in game:
voice-chat SDP negotiation larger than 4 KB now survives the
wire** (see finding 5).
*Acceptance:* smoke **N16** (transport/LIMITS agreement pin).
ws-soak **C2** was recalibrated from a 5,000-char to a
17,000-char payload: its intent (oversized → close 1009) is
unchanged, but the payload must exceed the reconciled cap —
recorded here so the test change is never mistaken for a
weakening.

### 2.6 Origin check on upgrade (item 6)
If an `Origin` header is present it must be allowlisted
(`ONO_ALLOWED_ORIGINS`, comma-separated, wired through
`net/game-server.js`) or — with no allowlist — match the
connection's Host. Otherwise 403 at handshake. No-Origin
clients (tools, native) are unaffected: browsers always send
Origin on WebSocket upgrades, so absence is never a browser
attack. For public playtests the correct allowlist value is
the Pages origin, `https://silencer7777.github.io`.
*Acceptance:* ws-soak **C9** (cross-origin 403; allowlisted
and no-Origin 101).

### 2.7 Status JSON room-code leak (audit finding, no spec item)
`net/game-server.js` status output now reports room mode/map/
player counts and a total player count — **no codes**. Health
checks lose nothing; join keys stop leaking.

## 3. Stage 2 — designed, not built (item 7)

`docs/STAGE2-SESSIONS.md`: threat model T1–T8, a minimal
account model (callsign + scrypt-hashed passphrase,
`node:crypto` only, per the zero-dependency rule), HMAC-SHA256
session tokens that fit the existing `hello.session` field,
24 h expiry, name bound to the token subject, login rate
limits, and the **30 s reconnect grace** the token finally
makes decidable (MULTIPLAYER §11 risk 5). Three questions are
Brett's before implementation (guests on/off, callsign changes,
invite-code signup). **No code pretends to be Stage 2** — the
boot banner still warns, accurately.

## 4. The documented firewall

`docs/FIREWALL.md` (new), cross-linked from `docs/MULTIPLAYER.md`
§13 and `net/README.md`:

- Architecture + what the firewall protects (incl. the honest
  "no accounts exist yet" framing and room-code-as-secret).
- Five principles (no raw public ports; TLS at the tunnel only;
  default-deny per layer; every layer caps something; crashes
  must be cheap).
- **Port/protocol table:** 8081 loopback-only ALLOW, 8080
  loopback optional, tunnel egress 7844/443 ALLOW, all other
  inbound DENY — plus the never-port-forward and never-route-`/`
  rules.
- The **in-process firewall table** (every §2 limit, its value,
  its enforcer, its failure mode).
- Host rule examples: macOS **pf** anchor, Linux ufw, Windows
  Defender; router guidance (no forwards, UPnP off).
- Watchdog/restart behaviour (supervisor restart is safe —
  no persistent state; health via the status JSON).
- Anti-takeover rationale, lever by lever, and the **host-side
  checklist** (also §7 below) — the part only Brett can do at
  the Mac, flagged as not-done rather than dressed up as done.

## 5. Backend → in-game assessment

**Shipped (real in-game value):**
- *Voice signaling fixed* (§2.5): >4 KB SDP offers/answers no
  longer die at the frame layer — voice chat negotiation over
  real sockets works at real-world SDP sizes.
- *Long-session stability* (§2.1): room GC ends the slow
  memory/CPU growth that made an all-evening hosted session
  degrade; caps keep one bad actor from degrading everyone
  else's match.
- *Match privacy* (§2.7 + §2.6): private rooms stay private —
  codes don't leak via the health endpoint, and random websites
  can't socket in from a player's browser.

**Assessed and NOT built, with reasons:**
- *Server-side persistence of meta/progression* — unsound
  before identity: it would durably store whoever-asserted-it
  data and create a protection liability with no owner. Keys
  off Stage 2 (§3); the design reserves the slot.
- *Reconnect/resume* — same dependency; designed (§3, 30 s
  token-bound grace), not implementable honestly without
  tokens.
- *Per-room display-name uniqueness* — considered for
  impersonation within a room; chat/snapshot identity already
  carries the server playerId, and names remain cosmetic until
  Stage 2 binds them properly. Deferred to Stage 2 rather than
  half-fixed.
- *Latency/prediction changes* — none needed from the backend
  side tonight: tick (30 Hz), snapshots (20 Hz), interpolation
  budget, and the drift-tolerant loop were verified healthy by
  soak (sim cost 0.069 ms/tick vs a 33.3 ms budget).

## 6. Gates, pushes, verification

- guardian/smoke: **green** (new pins N16–N21 pass; the one
  initial failure — ws-soak C2 — is the recalibration in §2.5,
  after which the suite is fully green).
- mobile-check, biome-check, reachability, reachability-maps:
  **green** (client untouched; re-run for the record).
- chat-check, soak, ws-soak, `node net/server.js` demo: **pass**.
- Code push: commit **479b3e4**, six files
  (`net/protocol.js`, `net/server.js`, `net/ws-transport.js`,
  `net/game-server.js`, `tools/smoke.mjs`, `tools/ws-soak.mjs`)
  pushed via the Contents API; **byte-verified** against the
  repo — four files matched immediately on the raw CDN, the
  remaining two matched via the API blob SHA (raw-CDN cache
  lag, named so a future reader doesn't re-chase it).
- Process note, for the record: the first push attempt this
  session used the helper with a wrong argument shape (it
  takes a directory, not a file list) and pushed nothing while
  printing success. The verification step caught it — which is
  what the verification step is for. The helper's usage line is
  in its own header; future pushes should read it before, not
  after.

**Perf delta:** client — zero (no `js/` file touched; V7.9
numbers stand: calls ≤150/map, Forest tris 291,110, casters
199/200). Server — soak sim cost unchanged at 0.069 ms/tick;
per-message overhead added by the rate window + violation
accounting is two Map operations on non-input messages only.

## 7. For Brett — set up / decide first

**At the Mac (host-side firewall checklist, from
`docs/FIREWALL.md` §8 — none of this is done until you do it):**
1. macOS Firewall on + stealth mode.
2. pf anchor (or LuLu/Little Snitch rule) denying inbound 8081.
3. Router: confirm no port forwards to the Mac; UPnP off.
4. cloudflared named tunnel: ingress maps only `/play` →
   `localhost:8081`.
5. When you host a public-page playtest: start the server with
   `ONO_ALLOWED_ORIGINS=https://silencer7777.github.io`.
6. Run the server under launchd `KeepAlive` so a crash restarts
   it (safe — no state to lose but the match in flight).

**Decisions (Stage 2, `docs/STAGE2-SESSIONS.md` §7):** guests
allowed or accounts-only; callsign changes ever; open signup or
invite code. Implementation is one server-only sitting once
you call it.

**Playtest:** nothing new to click in the game itself — this
pass is invisible by design. If you run an online session, the
things now true behind it: your private room's code can't leak
from the status page, voice negotiation won't choke on large
SDP, and the host won't slow down over a long night.
