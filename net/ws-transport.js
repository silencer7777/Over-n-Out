// ws-transport.js — OVER N' OUT WebSocket transport (M3/M4).
//
// Division Zero — Vega (online systems). The real-socket sibling
// of LoopbackTransport: it plugs into GameServer.attachTransport()
// through exactly the same seam (setServerHandler + deliver /
// sendTo + disconnect) and adds one additive convention —
// setDisconnectHandler(fn) — so closing a socket IS leaving
// (§5.6) without GameServer knowing sockets exist.
//
// Connection-layer rules live HERE, not in GameServer routing
// (MULTIPLAYER.md §5.1/§5.5/§7.6 — the server.js comment has
// pointed at this layer since M0):
//   - Upgrade only on the /play path; anything else is refused
//     before a socket exists.
//   - First message must be `hello`, inside helloTimeoutMs, or
//     the connection closes (1002). A hello GameServer refuses
//     gets its `error` reply delivered; the client may retry
//     inside the same deadline.
//   - Any message after helloTimeoutMs counts as liveness; a
//     connection silent for idleTimeoutMs (LIMITS) is closed.
//   - Message size is capped at the decoder (LIMITS.MAX_MESSAGE_
//     BYTES, close 1009) — GameServer's own cap stays as the
//     second line for loopback/direct callers.
//   - Malformed JSON closes (1007) after an `error` reply.
//   - `input` messages are rate-limited per connection
//     (LIMITS.INPUT_MAX_PER_SEC, sliding 1 s window, close 1008).
//   - Slow clients: if a socket's unsent buffer passes
//     SLOW_CLIENT_BYTES the connection closes (1008) instead of
//     buffering a dead reader forever. Snapshots are state, not
//     a log — a client that cannot keep up cannot play.
//   - WS ping frames are answered with pong frames at this layer
//     (RFC MUST); protocol `ping` MESSAGES still route to
//     GameServer for `pong` (§5.5) — two different pings, both
//     honoured.
//
// Nothing here starts anything on import: attach() an http.Server
// or call listen() explicitly (net/game-server.js does).

import { createServer } from 'node:http';
import { LIMITS } from './protocol.js';
import { FrameDecoder, encodeFrame, computeAcceptKey, OPCODE, CLOSE_CODE } from './ws.js';

const PLAY_PATH = '/play';
const SLOW_CLIENT_BYTES = 4 * 1024 * 1024;

export class WebSocketTransport {
  constructor({
    helloTimeoutMs = 5000,
    idleTimeoutMs = LIMITS.IDLE_TIMEOUT_MS,
    inputMaxPerSec = LIMITS.INPUT_MAX_PER_SEC,
    maxPayload = LIMITS.MAX_MESSAGE_BYTES,
    path = PLAY_PATH,
  } = {}) {
    this.helloTimeoutMs = helloTimeoutMs;
    this.idleTimeoutMs = idleTimeoutMs;
    this.inputMaxPerSec = inputMaxPerSec;
    this.maxPayload = maxPayload;
    this.path = path;
    /** @type {Map<string, object>} clientId -> connection */
    this.connections = new Map();
    this._serverHandler = null;
    this._disconnectHandler = null;
    this._nextId = 1;
    this._sweeper = setInterval(() => this._sweep(), 500);
    if (this._sweeper.unref) this._sweeper.unref();
  }

  // --- the seam (LoopbackTransport-compatible) -------------------

  setServerHandler(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('WebSocketTransport.setServerHandler: handler must be a function');
    }
    this._serverHandler = handler;
  }

  // Additive seam convention: GameServer registers this to learn
  // a player left when their socket closes (§5.6).
  setDisconnectHandler(handler) {
    this._disconnectHandler = typeof handler === 'function' ? handler : null;
  }

  deliver(clientId, msg) {
    const conn = this.connections.get(clientId);
    if (!conn) return false;
    return this._sendText(conn, JSON.stringify(msg));
  }

  sendTo(clientId, msg) {
    return this.deliver(clientId, msg);
  }

  disconnect(clientId) {
    const conn = this.connections.get(clientId);
    if (conn) this._close(conn, CLOSE_CODE.NORMAL, 'server disconnect');
  }

  // --- socket lifecycle ------------------------------------------

  // Attach to an existing http.Server's 'upgrade' event.
  attach(httpServer) {
    httpServer.on('upgrade', (req, socket, head) => this._onUpgrade(req, socket, head));
    return this;
  }

  // Convenience: own http server (health JSON on plain requests).
  listen(port, host, onRequest) {
    const server = createServer(onRequest || ((req, res) => {
      res.writeHead(426, { 'Content-Type': 'text/plain' });
      res.end('Upgrade Required: connect a WebSocket client to ' + this.path);
    }));
    this.attach(server);
    server.listen(port, host);
    return server;
  }

  close() {
    clearInterval(this._sweeper);
    for (const conn of [...this.connections.values()]) {
      this._close(conn, CLOSE_CODE.GOING_AWAY, 'transport closing');
    }
  }

  _onUpgrade(req, socket, head) {
    const refuse = (status, why) => {
      try {
        socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      } catch {}
      socket.destroy();
      void why;
    };
    let pathname = '/';
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch {}
    if (pathname !== this.path) return refuse('404 Not Found');
    if ((req.method || '') !== 'GET') return refuse('405 Method Not Allowed');
    const upgrade = String(req.headers.upgrade || '').toLowerCase();
    const connection = String(req.headers.connection || '').toLowerCase();
    const key = req.headers['sec-websocket-key'];
    const version = String(req.headers['sec-websocket-version'] || '');
    if (upgrade !== 'websocket' || !connection.split(',').map(s => s.trim()).includes('upgrade')) {
      return refuse('400 Bad Request');
    }
    if (typeof key !== 'string' || key.length === 0) return refuse('400 Bad Request');
    if (version !== '13') return refuse('426 Upgrade Required');

    const accept = computeAcceptKey(key);
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.setNoDelay(true);

    const clientId = 'w' + this._nextId++;
    const conn = {
      id: clientId,
      socket,
      bornAt: Date.now(),
      lastSeen: Date.now(),
      helloSeen: false,
      closeSent: false,
      gone: false,
      inputWindow: [],
      decoder: null,
    };
    conn.decoder = new FrameDecoder({
      expectMask: true,                    // clients must mask (§5.1)
      maxPayload: this.maxPayload,
      onText: (text) => this._onText(conn, text),
      onPing: (payload) => { this._sendFrame(conn, OPCODE.PONG, payload); conn.lastSeen = Date.now(); },
      onPong: () => { conn.lastSeen = Date.now(); },
      onClose: (code, reason) => {
        // Echo the close (RFC §5.5.1) if we haven't, then drop.
        // _teardown ends the socket: a peer that sent a close
        // frame (or just vanished) otherwise leaves the socket
        // half-open in CLOSE_WAIT — 'close' never fires, the
        // connection leaks, and httpServer.close() hangs waiting
        // for it (found by tools/ws-soak.mjs, first run).
        if (!conn.closeSent) this._sendCloseFrame(conn, code, '');
        this._teardown(conn);
        void reason;
      },
      onProtocolError: (code, why) => {
        this._sendError(conn, 'protocol', why);
        this._close(conn, code, why);
      },
    });
    this.connections.set(clientId, conn);
    socket.on('data', (chunk) => { try { conn.decoder.push(chunk); } catch { this._close(conn, CLOSE_CODE.INTERNAL, 'decoder fault'); } });
    socket.on('end', () => this._teardown(conn));   // peer half-closed without a close frame
    socket.on('close', () => this._teardown(conn));
    socket.on('error', () => this._teardown(conn));
    if (head && head.length) conn.decoder.push(head);
  }

  _onText(conn, text) {
    if (conn.gone) return;
    conn.lastSeen = Date.now();
    let msg;
    try { msg = JSON.parse(text); }
    catch {
      this._sendError(conn, 'bad_message', 'message is not valid JSON');
      return this._close(conn, CLOSE_CODE.INVALID_DATA, 'malformed JSON');
    }
    if (!conn.helloSeen) {
      if (!msg || msg.t !== 'hello') {
        this._sendError(conn, 'protocol', 'hello must be the first message');
        return this._close(conn, CLOSE_CODE.PROTOCOL, 'hello must be the first message');
      }
      conn.helloSeen = true;
    }
    if (msg && msg.t === 'input') {
      const now = Date.now();
      conn.inputWindow = conn.inputWindow.filter(t => now - t < 1000);
      conn.inputWindow.push(now);
      if (conn.inputWindow.length > this.inputMaxPerSec) {
        this._sendError(conn, 'rate_limited', `input exceeds ${this.inputMaxPerSec}/s`);
        return this._close(conn, CLOSE_CODE.POLICY, 'input rate limit');
      }
    }
    if (this._serverHandler) {
      try { this._serverHandler(conn.id, msg); }
      catch { this._close(conn, CLOSE_CODE.INTERNAL, 'server handler fault'); }
    }
  }

  _sweep() {
    const now = Date.now();
    for (const conn of this.connections.values()) {
      if (!conn.helloSeen && now - conn.bornAt > this.helloTimeoutMs) {
        this._sendError(conn, 'protocol', 'hello timeout');
        this._close(conn, CLOSE_CODE.POLICY, 'hello timeout');
      } else if (now - conn.lastSeen > this.idleTimeoutMs) {
        this._close(conn, CLOSE_CODE.POLICY, 'idle timeout');
      }
    }
  }

  // --- sending ----------------------------------------------------

  _sendFrame(conn, opcode, payload) {
    if (conn.gone || conn.socket.destroyed) return false;
    try {
      conn.socket.write(encodeFrame({ opcode, payload }));
      return true;
    } catch { return false; }
  }

  _sendText(conn, text) {
    if (conn.gone || conn.socket.destroyed) return false;
    if (conn.socket.writableLength > SLOW_CLIENT_BYTES) {
      this._close(conn, CLOSE_CODE.POLICY, 'slow client');
      return false;
    }
    return this._sendFrame(conn, OPCODE.TEXT, Buffer.from(text));
  }

  _sendError(conn, code, message) {
    // Best-effort protocol error (MSG.ERROR shape) before closing.
    this._sendText(conn, JSON.stringify({ t: 'error', code, message }));
  }

  _sendCloseFrame(conn, code, reason) {
    if (conn.closeSent) return;
    conn.closeSent = true;
    const reasonBuf = Buffer.from(String(reason || '').slice(0, 120));
    const payload = Buffer.allocUnsafe(2 + reasonBuf.length);
    payload.writeUInt16BE(code, 0);
    reasonBuf.copy(payload, 2);
    this._sendFrame(conn, OPCODE.CLOSE, payload);
  }

  _close(conn, code, reason) {
    this._sendCloseFrame(conn, code, reason);
    try { conn.socket.end(); } catch {}
    // A peer that never answers the close handshake must not pin
    // the connection open; force-drop shortly after.
    setTimeout(() => { try { conn.socket.destroy(); } catch {} }, 250).unref?.();
    this._teardown(conn);
  }

  _teardown(conn) {
    if (conn.gone) return;
    conn.gone = true;
    this.connections.delete(conn.id);
    // End our side too — see the onClose note: a half-open
    // socket is a leak, not a connection. Harmless when the
    // socket is already closed (the 'close'-event path).
    try { conn.socket.end(); } catch {}
    if (this._disconnectHandler) {
      try { this._disconnectHandler(conn.id); } catch {}
    }
  }
}
