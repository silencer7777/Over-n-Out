// game-server.js — OVER N' OUT online server entrypoint (M3/M4).
//
// Division Zero — Vega (online systems). Run it:
//
//   node net/game-server.js            # ws://127.0.0.1:8081/play (localhost only)
//   PORT=9000 HOST=0.0.0.0 node net/game-server.js   # explicit opt-in: beyond localhost
//
// HARDENING (V6 Update 10, Brett's Oct 28 order): the default
// bind is LOCALHOST. The public face is the tunnel in front of
// this process (cloudflared), which terminates TLS — players
// reach wss://<tunnel-host>/play and the tunnel forwards to
// this plain-ws localhost port. There are no raw public ports:
// never port-forward 8081, and keep the host firewall denying
// inbound 8081 from non-loopback (see net/README.md).
//
// This is the process a host runs (see docs/sessions/
// v4-hosting-brief.md). GitHub Pages serves the static client;
// this serves the matches: GameServer (net/server.js) behind
// WebSocketTransport (net/ws-transport.js, hand-rolled RFC 6455).
// Plain HTTP requests get a small JSON status — hosts and humans
// can health-check the process without a WebSocket client.
//
// SECURITY POSTURE — READ BEFORE EXPOSING THIS TO ANYONE:
// hello session tokens are SHAPE-CHECKED ONLY. Stage 2 (accounts
// & signed sessions) does not exist yet, so this build verifies
// nothing about who a player is (MULTIPLAYER.md §11 risk 4: "a
// stub that ships is a vulnerability, not a shortcut"). Run it on
// localhost / a trusted LAN / a private tunnel for playtests.
// Do NOT expose it to the public internet until Stage 2 session
// verification lands. The boot log says this too, every time.
//
// Importing this module never listens: the boot runs only when
// the file is executed directly.

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { GameServer } from './server.js';
import { WebSocketTransport } from './ws-transport.js';
import { PROTOCOL_VERSION } from './protocol.js';

export function createOnlineServer({ port = 8081, host = '127.0.0.1' } = {}) {
  const game = new GameServer();
  const transport = new WebSocketTransport();
  game.attachTransport(transport);

  const httpServer = createServer((req, res) => {
    const body = JSON.stringify({
      name: "Over n' Out — game server",
      protocol: PROTOCOL_VERSION,
      status: 'up',
      rooms: [...game.rooms.values()].map(r => ({
        code: r.code, mode: r.mode, map: r.map, players: r.players.size, state: r.state,
      })),
      playPath: transport.path,
      note: 'WebSocket clients connect at ws://<host>' + transport.path + ' — see net/README.md',
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  });
  transport.attach(httpServer);

  return {
    game, transport, httpServer,
    listen() {
      return new Promise((resolve) => httpServer.listen(port, host, () => resolve(httpServer.address())));
    },
    async close() {
      game.stop();
      transport.close();
      await new Promise((resolve) => httpServer.close(() => resolve()));
    },
  };
}

const isDirectRun = (() => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  const port = Number(process.env.PORT) || 8081;
  const host = process.env.HOST || '127.0.0.1'; // U10: localhost by default; HOST= is the operator's explicit opt-in
  const { game, httpServer, close } = createOnlineServer({ port, host });
  game.start();
  httpServer.listen(port, host, () => {
    const addr = httpServer.address();
    console.log(`[game-server] Over n' Out online server → ws://${addr.address}:${addr.port}/play`);
    console.log(`[game-server] status JSON → http://${addr.address}:${addr.port}/`);
    console.log('[game-server] rooms are created by hello; tick 30 Hz, snapshots 20 Hz.');
    console.log('[game-server] ⚠ DEV AUTH: session tokens are shape-checked only (Stage 2 pending).');
    console.log('[game-server] ⚠ Localhost / LAN / private tunnel ONLY — do not expose publicly yet.');
    if (host === '127.0.0.1' || host === '::1') {
      console.log('[game-server] posture: bound to localhost — public play goes through the TLS tunnel (wss://), never a raw port.');
    } else {
      console.log(`[game-server] ⚠ HOST=${host} binds beyond localhost (explicit opt-in) — Stage 2 auth is still pending; a tunnel is strongly preferred.`);
    }
  });
  let closing = false;
  const shutdown = async (sig) => {
    if (closing) return;
    closing = true;
    console.log(`[game-server] ${sig} — shutting down`);
    await close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
