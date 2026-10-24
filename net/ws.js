// ws.js — OVER N' OUT hand-rolled WebSocket (RFC 6455).
//
// Division Zero — Vega (online systems), implementing the §10.1
// decision: Board Meeting 003 recommended (a) hand-rolled RFC 6455
// over (b) the `ws` dependency; Board Meeting 004 ruled we PROCEED
// with (a) — zero new dependencies, studio rule intact. Brett may
// still overrule to `ws`; this module is the whole cost of that
// swap, because it hides behind the transport seam (net/ws-transport.js
// is the only consumer server-side).
//
// What lives here (no sockets — pure framing, so it unit-tests
// without I/O):
//   - computeAcceptKey(): the Sec-WebSocket-Accept handshake hash.
//   - encodeFrame(): one frame -> Buffer (server or client style).
//   - FrameDecoder: streaming byte parser. Feed it chunks; it calls
//     back with COMPLETE messages (fragmentation reassembled,
//     control frames surfaced immediately, per RFC 6455 §5).
//     Enforces the wire rules a hostile peer hopes we skip:
//     masking direction, RSV bits zero, control frames whole and
//     <= 125 bytes, length encodings honest, UTF-8 validity of
//     text, and a hard cap on assembled message size.
//   - WsClient: a minimal client (masked frames, handshake verify)
//     for headless tests — Node has no built-in WebSocket *server*
//     and the test suite should not depend on the client global's
//     availability either. Browsers use their native client
//     against the same server code.
//
// Protocol errors are reported via onProtocolError(closeCode, why)
// exactly once; after that the decoder is dead and further bytes
// are ignored. The transport owns turning that into a close frame.

import { createHash, randomBytes } from 'node:crypto';

export const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export const OPCODE = Object.freeze({
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa,
});

export const CLOSE_CODE = Object.freeze({
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL: 1002,
  UNSUPPORTED: 1003,
  INVALID_DATA: 1007,
  POLICY: 1008,
  TOO_BIG: 1009,
  INTERNAL: 1011,
});

// Sec-WebSocket-Accept = base64(sha1(key + GUID)) — RFC 6455 §4.2.2.
// The RFC's own worked example is pinned in tools/ws-soak.mjs.
export function computeAcceptKey(secWebSocketKey) {
  return createHash('sha1').update(String(secWebSocketKey) + WS_GUID).digest('base64');
}

function applyMask(payload, maskKey) {
  const out = Buffer.allocUnsafe(payload.length);
  for (let i = 0; i < payload.length; i++) out[i] = payload[i] ^ maskKey[i & 3];
  return out;
}

// encodeFrame({ opcode, payload, fin, mask, maskKey }) -> Buffer.
// Server frames are unmasked; client frames MUST be masked
// (RFC 6455 §5.3) — `mask: true` generates a random key unless one
// is supplied (tests pin one for determinism).
export function encodeFrame({ opcode, payload = Buffer.alloc(0), fin = true, mask = false, maskKey = null }) {
  if (!Buffer.isBuffer(payload)) payload = Buffer.from(payload);
  const len = payload.length;
  let headerLen = 2;
  if (len >= 126 && len <= 0xffff) headerLen += 2;
  else if (len > 0xffff) headerLen += 8;
  if (mask) headerLen += 4;
  const frame = Buffer.allocUnsafe(headerLen + len);
  frame[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0f);
  let off = 1;
  if (len < 126) {
    frame[off++] = (mask ? 0x80 : 0x00) | len;
  } else if (len <= 0xffff) {
    frame[off++] = (mask ? 0x80 : 0x00) | 126;
    frame.writeUInt16BE(len, off); off += 2;
  } else {
    frame[off++] = (mask ? 0x80 : 0x00) | 127;
    frame.writeBigUInt64BE(BigInt(len), off); off += 8;
  }
  if (mask) {
    const key = maskKey || randomBytes(4);
    key.copy(frame, off); off += 4;
    applyMask(payload, key).copy(frame, off);
  } else {
    payload.copy(frame, off);
  }
  return frame;
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

// FrameDecoder — streaming parser for one connection.
//
//   new FrameDecoder({
//     expectMask,          // true on the server (clients must mask),
//                          // false in a client (servers must not)
//     maxPayload,          // cap on one frame AND on the assembled
//                          // message (fragmentation included)
//     onMessage(opcode, payloadBuffer),  // TEXT or BINARY, complete
//     onText(string),                    // convenience, if provided
//     onPing(payload), onPong(payload),
//     onClose(code, reason),
//     onProtocolError(closeCode, why),
//   })
//
// .push(chunk) consumes bytes. .dead after a protocol error or a
// close frame: further pushes are no-ops.
export class FrameDecoder {
  constructor({
    expectMask = true,
    maxPayload = 16384,
    onMessage = null,
    onText = null,
    onPing = null,
    onPong = null,
    onClose = null,
    onProtocolError = null,
  } = {}) {
    this.expectMask = expectMask;
    this.maxPayload = maxPayload;
    this.onMessage = onMessage;
    this.onText = onText;
    this.onPing = onPing;
    this.onPong = onPong;
    this.onClose = onClose;
    this.onProtocolError = onProtocolError;
    this._buf = Buffer.alloc(0);
    this._fragOpcode = -1;          // -1 = no fragmented message open
    this._fragParts = [];
    this._fragBytes = 0;
    this.dead = false;
  }

  _fail(code, why) {
    if (this.dead) return;
    this.dead = true;
    if (this.onProtocolError) this.onProtocolError(code, why);
  }

  push(chunk) {
    if (this.dead || !chunk || chunk.length === 0) return;
    this._buf = this._buf.length ? Buffer.concat([this._buf, chunk]) : chunk;
    this._drain();
  }

  _drain() {
    while (!this.dead) {
      const frame = this._tryParseFrame();
      if (!frame) return;                       // need more bytes
      if (frame.error) return this._fail(frame.error.code, frame.error.why);
      this._dispatch(frame);
    }
  }

  // Returns null when the buffer holds less than one full frame.
  _tryParseFrame() {
    const buf = this._buf;
    if (buf.length < 2) return null;
    const b0 = buf[0], b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const rsv = b0 & 0x70;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = 2;

    if (rsv !== 0) return { error: { code: CLOSE_CODE.PROTOCOL, why: 'RSV bits set (no extensions negotiated)' } };
    if (![0, 1, 2, 8, 9, 10].includes(opcode)) {
      return { error: { code: CLOSE_CODE.PROTOCOL, why: `unknown opcode ${opcode}` } };
    }
    const isControl = opcode >= 0x8;
    if (isControl && !fin) return { error: { code: CLOSE_CODE.PROTOCOL, why: 'control frame fragmented' } };
    if (masked !== this.expectMask) {
      return { error: { code: CLOSE_CODE.PROTOCOL, why: this.expectMask ? 'client frame not masked' : 'server frame masked' } };
    }

    if (len === 126) {
      if (buf.length < off + 2) return null;
      len = buf.readUInt16BE(off); off += 2;
      if (len < 126) return { error: { code: CLOSE_CODE.PROTOCOL, why: 'non-minimal length encoding (16-bit)' } };
    } else if (len === 127) {
      if (buf.length < off + 8) return null;
      const big = buf.readBigUInt64BE(off); off += 8;
      if (big <= 0xffffn) return { error: { code: CLOSE_CODE.PROTOCOL, why: 'non-minimal length encoding (64-bit)' } };
      if (big > BigInt(this.maxPayload)) {
        // Fail fast: never wait for (or buffer) a payload we will
        // refuse anyway.
        return { error: { code: CLOSE_CODE.TOO_BIG, why: `frame length ${big} exceeds cap ${this.maxPayload}` } };
      }
      len = Number(big);
    }
    if (isControl && len > 125) return { error: { code: CLOSE_CODE.PROTOCOL, why: 'control frame payload > 125' } };
    if (len > this.maxPayload) return { error: { code: CLOSE_CODE.TOO_BIG, why: `frame length ${len} exceeds cap ${this.maxPayload}` } };

    let maskKey = null;
    if (masked) {
      if (buf.length < off + 4) return null;
      maskKey = buf.subarray(off, off + 4); off += 4;
    }
    if (buf.length < off + len) return null;
    let payload = buf.subarray(off, off + len);
    if (masked) payload = applyMask(payload, maskKey);
    this._buf = buf.subarray(off + len);
    return { fin, opcode, payload };
  }

  _dispatch({ fin, opcode, payload }) {
    switch (opcode) {
      case OPCODE.PING:
        if (this.onPing) this.onPing(payload);
        return;
      case OPCODE.PONG:
        if (this.onPong) this.onPong(payload);
        return;
      case OPCODE.CLOSE: {
        let code = CLOSE_CODE.NORMAL;
        let reason = '';
        if (payload.length === 1) {
          return this._fail(CLOSE_CODE.PROTOCOL, 'close frame payload of 1 byte');
        }
        if (payload.length >= 2) {
          code = payload.readUInt16BE(0);
          try { reason = utf8.decode(payload.subarray(2)); }
          catch { return this._fail(CLOSE_CODE.INVALID_DATA, 'close reason is not valid UTF-8'); }
        }
        this.dead = true;
        if (this.onClose) this.onClose(code, reason);
        return;
      }
      case OPCODE.CONTINUATION: {
        if (this._fragOpcode === -1) {
          return this._fail(CLOSE_CODE.PROTOCOL, 'continuation frame with no message open');
        }
        this._fragParts.push(payload);
        this._fragBytes += payload.length;
        if (this._fragBytes > this.maxPayload) {
          return this._fail(CLOSE_CODE.TOO_BIG, `fragmented message exceeds cap ${this.maxPayload}`);
        }
        if (fin) {
          const full = Buffer.concat(this._fragParts, this._fragBytes);
          const op = this._fragOpcode;
          this._fragOpcode = -1; this._fragParts = []; this._fragBytes = 0;
          this._emitMessage(op, full);
        }
        return;
      }
      default: { // TEXT or BINARY
        if (this._fragOpcode !== -1) {
          return this._fail(CLOSE_CODE.PROTOCOL, 'new message started before fragmented message finished');
        }
        if (!fin) {
          this._fragOpcode = opcode;
          this._fragParts = [payload];
          this._fragBytes = payload.length;
          return;
        }
        this._emitMessage(opcode, payload);
      }
    }
  }

  _emitMessage(opcode, payload) {
    if (opcode === OPCODE.TEXT) {
      let text;
      try { text = utf8.decode(payload); }
      catch { return this._fail(CLOSE_CODE.INVALID_DATA, 'text message is not valid UTF-8'); }
      if (this.onText) this.onText(text);
      else if (this.onMessage) this.onMessage(opcode, payload);
    } else if (this.onMessage) {
      this.onMessage(opcode, payload);
    }
  }
}

// ------------------------------------------------------------------
// WsClient — minimal RFC 6455 client for headless tests/tools.
// ws:// only (TLS is the browser's / a production proxy's job; the
// soak runs on localhost by design).
//
//   const c = await WsClient.connect('ws://127.0.0.1:8081/play');
//   c.onText = (s) => { ... };  c.onClose = (code, reason) => { ... };
//   c.send('{"t":"ping"}');  c.ping();  c.close();
// ------------------------------------------------------------------
export class WsClient {
  static connect(urlString, { timeoutMs = 5000 } = {}) {
    return new Promise((resolve, reject) => {
      let url;
      try { url = new URL(urlString); } catch { return reject(new Error('WsClient: bad URL')); }
      if (url.protocol !== 'ws:') return reject(new Error('WsClient: only ws:// is supported'));
      // Lazy imports kept out of the module top so the framing half
      // of this file stays importable in any context.
      import('node:net').then(({ connect }) => {
        const host = url.hostname;
        const port = Number(url.port) || 80;
        const path = (url.pathname || '/') + (url.search || '');
        const key = randomBytes(16).toString('base64');
        const socket = connect(port, host);
        const client = new WsClient(socket);
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) { settled = true; socket.destroy(); reject(new Error('WsClient: handshake timeout')); }
        }, timeoutMs);
        if (timer.unref) timer.unref();

        let head = Buffer.alloc(0);
        const onData = (chunk) => {
          head = Buffer.concat([head, chunk]);
          const end = head.indexOf('\r\n\r\n');
          if (end === -1) {
            if (head.length > 16384) { settled = true; clearTimeout(timer); socket.destroy(); reject(new Error('WsClient: oversized handshake response')); }
            return;
          }
          socket.off('data', onData);
          const headerText = head.subarray(0, end).toString('latin1');
          const rest = head.subarray(end + 4);
          const statusLine = headerText.split('\r\n')[0] || '';
          const acceptMatch = /^sec-websocket-accept:\s*(\S+)\s*$/im.exec(headerText);
          if (!/ 101\b/.test(statusLine) || !acceptMatch || acceptMatch[1] !== computeAcceptKey(key)) {
            settled = true; clearTimeout(timer); socket.destroy();
            return reject(new Error(`WsClient: handshake refused (${statusLine || 'no status'})`));
          }
          settled = true; clearTimeout(timer);
          client._arm();
          if (rest.length) client.decoder.push(rest);
          resolve(client);
        };
        socket.on('data', onData);
        socket.on('error', (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } });
        socket.on('connect', () => {
          socket.write(
            `GET ${path} HTTP/1.1\r\n` +
            `Host: ${host}:${port}\r\n` +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            `Sec-WebSocket-Key: ${key}\r\n` +
            'Sec-WebSocket-Version: 13\r\n\r\n',
          );
        });
        client._handshakeSocket = socket;
      }).catch(reject);
    });
  }

  constructor(socket) {
    this.socket = socket;
    this.onText = null;
    this.onClose = null;
    this.closed = false;
    this.decoder = new FrameDecoder({
      expectMask: false,               // servers must not mask (§5.1)
      maxPayload: 1024 * 1024,         // snapshots are a few KB; 1 MB is generous
      onText: (text) => { if (this.onText) this.onText(text); },
      onPing: (payload) => { this._sendFrame(OPCODE.PONG, payload); },
      onClose: (code, reason) => this._finish(code, reason),
      onProtocolError: (code, why) => this._finish(code, why),
    });
  }

  _arm() {
    this.socket.on('data', (chunk) => this.decoder.push(chunk));
    this.socket.on('close', () => this._finish(1006, 'socket closed'));
    this.socket.on('error', () => this._finish(1006, 'socket error'));
  }

  _finish(code, reason) {
    if (this.closed) return;
    this.closed = true;
    try { this.socket.destroy(); } catch {}
    if (this.onClose) this.onClose(code, reason);
  }

  _sendFrame(opcode, payload) {
    if (this.closed) return false;
    const body = typeof payload === 'string' ? Buffer.from(payload) : payload;
    try {
      this.socket.write(encodeFrame({ opcode, payload: body, mask: true }));
      return true;
    } catch { return false; }
  }

  send(text) { return this._sendFrame(OPCODE.TEXT, String(text)); }
  ping(payload = Buffer.alloc(0)) { return this._sendFrame(OPCODE.PING, payload); }

  close(code = CLOSE_CODE.NORMAL, reason = '') {
    if (this.closed) return;
    const reasonBuf = Buffer.from(String(reason).slice(0, 120));
    const payload = Buffer.allocUnsafe(2 + reasonBuf.length);
    payload.writeUInt16BE(code, 0);
    reasonBuf.copy(payload, 2);
    this._sendFrame(OPCODE.CLOSE, payload);
    // Give the close frame a tick to leave before dropping the socket.
    setTimeout(() => this._finish(code, reason), 10).unref?.();
  }
}
