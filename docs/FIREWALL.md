# OVER N' OUT — Firewall & Host Security Specification

*Written 2026-11-04 for the Lockdown pass (Brett's backend order).
Companion to `docs/MULTIPLAYER.md` (§7 anti-cheat, §9 hosting,
§11 risks) and the posture summary in `net/README.md`. Where this
document and older notes disagree, this document wins — it
describes the system as it actually runs today.*

---

## 1. The shape of the thing being protected

```
 player's browser
   │  https://silencer7777.github.io/Over-n-Out/   (static client)
   │  wss://<tunnel-host>/play                      (match traffic)
   ▼
 cloudflared tunnel  ── outbound-only connection from the host;
   │                    terminates TLS; the host opens NO inbound port
   ▼
 127.0.0.1:8081  net/game-server.js   (plain ws, loopback only)
   ├─ WebSocketTransport  (net/ws-transport.js) — frames, caps, Origin
   └─ GameServer          (net/server.js)       — rooms, protocol, sim
        └─ net/sim.js — the authoritative simulation
```

Facts the firewall exists to protect:

- **There are no accounts and no stored player data today.**
  Identity is a self-asserted display name per connection;
  progression/meta live in the player's own browser
  (localStorage). The server keeps only in-memory match state,
  which evaporates when the process stops. Stage 2 (accounts +
  signed sessions) is designed in `docs/STAGE2-SESSIONS.md` and
  is NOT implemented — nothing in this document pretends
  otherwise.
- **The room code is the join key.** A 4-character code is the
  only thing standing between a stranger and a private match.
  It is therefore treated as a secret in every surface below
  (the status JSON stopped listing codes in the Lockdown pass).
- **The sim is server-authoritative.** Clients send intent
  (`input`) only; the protocol has no message that carries an
  outcome. A hostile client can waste resources, but it cannot
  forge a kill, a position, or XP. The firewall's job is to
  bound the resource waste and the blast radius of bugs.

## 2. Principles

1. **No raw public ports.** The game server binds loopback.
   The only path in is the tunnel, which is an *outbound*
   connection from the host — a port scan of the host finds
   nothing.
2. **TLS only, terminated at the tunnel.** Players always use
   `wss://`. Plain `ws://` exists only between cloudflared and
   `127.0.0.1:8081` on the same machine.
3. **Default-deny at every layer.** Host firewall denies inbound
   by default; the upgrade handler refuses anything that is not
   `GET /play` with a valid WebSocket handshake; the protocol
   refuses unknown message types; the sim refuses implausible
   claims.
4. **Every layer caps something.** No layer trusts the layer
   above it to have limited the load (see §4).
5. **A crash must be cheap.** The process holds no persistent
   state, so a watchdog restart loses only in-flight matches.
   State that cannot be rebuilt is never kept only in memory —
   today there is no such state, by design.

## 3. Port & protocol table (host)

| Port | Proto | Bind | Direction | Verdict | Why |
|---|---|---|---|---|---|
| 8081 | TCP | 127.0.0.1 | inbound (loopback) | **ALLOW loopback only** | The game server (ws + status HTTP). Deny from every non-loopback interface. |
| 8080 | TCP | 127.0.0.1 | inbound (loopback) | **ALLOW loopback only, optional** | `server/server.js` local dev static server. Not part of public play. |
| 7844 | TCP/UDP | — | **outbound** to Cloudflare edge | ALLOW | cloudflared tunnel (QUIC). Falls back to 443/TCP if UDP is blocked. |
| 443 | TCP | — | outbound | ALLOW | Tunnel fallback, GitHub, updates. |
| 80, 443 | TCP | — | **inbound** | **DENY** | Nothing on the host serves public HTTP. The site is GitHub Pages; the tunnel needs no inbound listener. |
| *all others* | any | any | inbound | **DENY (default)** | Default-deny closes the table. |

Rules that follow from the table:

- **Never port-forward 8081 (or 8080) on the router.** Not
  "temporarily", not for a test. The tunnel is the test path.
- **Never run the game server with `HOST=0.0.0.0`** for public
  play. That env var exists for trusted-LAN playtests and the
  boot log says so every time.
- The tunnel ingress should route **only `/play`** to
  `localhost:8081`. Do not route `/` to the game server from a
  public hostname; the status JSON is a host-local health check
  (it no longer lists room codes — defense in depth, not a
  reason to publish it).

## 4. The in-process firewall (application layer)

The host firewall keeps strangers off the machine; these limits
keep a *connected* client — hostile or just buggy — from taking
over the process. All numbers live in `net/protocol.js` `LIMITS`
(one source, shared by every layer).

| Limit | Value | Enforced in | Failure mode |
|---|---|---|---|
| Concurrent connections | 64 total | transport, at upgrade | 503 at handshake |
| Connections per source IP | 8 | transport, at upgrade | 503 at handshake |
| Origin check | allowlist, else same-host | transport, at upgrade | 403 at handshake |
| Hello deadline | 5 s | transport sweeper | close 1008 |
| Idle timeout | 10 s silent | transport sweeper | close 1008 |
| Frame/message size | 16,384 B decoder cap | transport decoder | close 1009 |
| Message size (non-signal) | 4,096 B | GameServer | error `too_large` |
| Signal size | 16,384 B, fields bounded | GameServer + validators | error `bad_signal`/`too_large` |
| Input rate | 40 /s per connection | transport | close 1008 |
| Non-input message rate | 20 /s per player | GameServer | error `rate_limited`, dropped |
| Chat rate | 5 per 4 s per player | GameServer | error `chat_rate`, dropped |
| Rooms | 32 per process | GameServer | error `server_full` on join |
| Empty-room lifetime | 60 s (LOBBY exempt) | GameServer tick | room + sim reaped |
| Outbound buffer (slow client) | 4 MB | transport | close 1008 |
| Re-hello on one connection | refused | GameServer | error `already_hello` |

Anti-cheat observability: every refused message is **counted**
per player (`GameServer.violations`) and the first 5 per player
are **logged** as `[violation] player=… room=… kind=…` lines.
The log budget exists because an unbounded log is itself a
disk-fill attack — counting continues silently after it.

Per-connection state isolation: each connection owns its frame
decoder, rate windows, and player record; a fault in handling
one client's message closes **that** connection (the transport
catches handler faults) and cannot corrupt another player's
state. The sim steps from server-owned state only.

## 5. Host firewall — rule examples

### macOS (Brett's host) — pf

macOS's Application Firewall (System Settings → Network →
Firewall) should be **on**, with stealth mode enabled. For an
explicit port rule, `pf` is the precise tool. Example anchor
(`/etc/pf.anchors/overnout`, loaded from `/etc/pf.conf` with
`anchor "overnout"` + `load anchor "overnout" from "/etc/pf.anchors/overnout"`):

```
# Over n' Out: the game server is loopback-only. Even if a
# process binds 8081 on a LAN interface by mistake, the LAN
# never reaches it.
block in quick on en0 proto tcp to port 8081
block in quick on en1 proto tcp to port 8081
```

(Adjust interfaces to the machine's — `ifconfig` lists them;
Wi-Fi is usually `en0` on a laptop.) Verify with
`sudo pfctl -a overnout -s rules`.

### Linux — ufw

```sh
sudo ufw default deny incoming
sudo ufw deny in 8081
sudo ufw deny in 8080
# outbound (incl. the tunnel) stays allowed by default
```

### Windows — Defender Firewall

Inbound rule: block TCP 8081 and 8080 from Remote Address =
any non-loopback range (or simply never create an allow rule —
Windows' default for an unlisted app is to prompt; choose
"Cancel / block" for `node.exe` on Public networks).

### Router

- No port forwards to the host at all (see §3).
- UPnP off, if the router allows it — a forwarded port nobody
  remembers creating defeats every rule above.

## 6. Watchdog & restart behaviour

- Run the server under a supervisor that restarts it on crash:
  macOS `launchd` (`KeepAlive` true), Linux `systemd`
  (`Restart=on-failure`), or `pm2`. Restart is safe by design:
  §2.5 — no persistent state exists to corrupt.
- The tick loop already refuses to burst catch-up ticks after a
  stall (it re-anchors), so a GC pause or a suspended laptop
  does not teleport the sim on resume.
- Health check: the supervisor (or a human) can poll
  `curl http://localhost:8081/` — 200 + `status: "up"` means the
  process is alive. A scheduled probe that says `hello` and
  asserts a `welcome` is the stronger check MULTIPLAYER.md §9
  asks for.

## 7. Anti-takeover rationale (why this limits a "bug takeover")

A takeover attempt — hostile client, or a buggy client behaving
like one — has four levers. Each is bounded:

1. **Fork-bomb by connection.** Capped at 64 sockets, 8 per IP,
   each with a 5 s hello deadline and a 10 s idle timeout.
   Sockets that do nothing die on their own.
2. **State exhaustion by rooms.** Capped at 32 rooms; empty
   rooms are reaped after 60 s. Before the Lockdown pass, every
   room ever created lived (with its sim) until process exit —
   that leak is closed.
3. **CPU/bandwidth flooding by message.** Per-type size caps,
   40/s input, 20/s everything else, 5-per-4 s chat, and a
   slow-reader cut at 4 MB of unsent buffer. The largest legal
   message is a 16 KB voice-signaling payload, rate-capped like
   everything else.
4. **Identity confusion.** One connection = one identity, fixed
   at first hello (re-hello refused). Chat stamps come from the
   server's record, never the payload. Room codes no longer
   leak through the status endpoint.

What remains honestly open (see `docs/STAGE2-SESSIONS.md`):
identity is self-asserted, so a determined human can still join
a room whose code they know under any display name. That is a
*community* risk at playtest scale, mitigated by keeping the
tunnel address and room codes unlisted — it becomes an
*account* problem only when accounts exist, which is exactly
what Stage 2 is for. **Until Stage 2 lands, this server is for
localhost / LAN / private-tunnel playtests, not the open
internet** — the boot banner says so, and this document does
not soften it.

## 8. Host-side checklist (Brett's Mac — do these at the Mac)

These cannot be done from the repo; they are the operator's
half of this specification.

- [ ] macOS Firewall **on** + stealth mode on (System Settings
      → Network → Firewall → Options).
- [ ] pf anchor above installed (or Little Snitch / LuLu rule
      denying inbound 8081), verified with `pfctl`.
- [ ] Router: zero port forwards to the Mac; UPnP off.
- [ ] cloudflared is a **named** tunnel whose ingress maps only
      `/play` → `http://localhost:8081` (plus a 404 catch-all).
- [ ] Hosting env: `HOST` unset (binds 127.0.0.1), and for
      public-page playtests
      `ONO_ALLOWED_ORIGINS=https://silencer7777.github.io`.
- [ ] Server runs under a supervisor with restart-on-crash
      (launchd `KeepAlive`), logs going to a file that rotates.
- [ ] macOS and Node kept updated; the server runs as Brett's
      normal user, never `sudo`.
