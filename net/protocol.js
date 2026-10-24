// protocol.js — OVER N' OUT multiplayer wire protocol (M0).
//
// Pure, dependency-free, Node-safe: no imports, no DOM, no I/O.
// This module is the shared contract from docs/MULTIPLAYER.md §5:
// both the future client transport and the authoritative server
// validate against these exact shapes, so a message that fails
// validation here can never reach the simulation.
//
// Design rules honoured (MULTIPLAYER.md §5, §7):
//   - Every message is a plain JSON object with a `t` (type) field.
//   - The protocol has NO message type that carries an outcome
//     (damage, kills, hits, positions, score). Clients send intent
//     (`input`) only; the server owns every result (§7.1).
//   - Unknown `t` values are not known types (isKnownType) — callers
//     ignore/drop them for forward compatibility (§5).

export const PROTOCOL_VERSION = 1;

export const MSG = Object.freeze({
  HELLO: 'hello',
  WELCOME: 'welcome',
  ERROR: 'error',
  INPUT: 'input',
  SNAPSHOT: 'snapshot',
  EVENT: 'event',
  PING: 'ping',
  PONG: 'pong',
});

const KNOWN_TYPES = new Set(Object.values(MSG));

// True only for the MSG values above. Anything else — including
// undefined, non-strings, and near-misses like 'Hello' — is false.
export function isKnownType(t) {
  return typeof t === 'string' && KNOWN_TYPES.has(t);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// validateHello(msg) -> { ok, errors[] }
//
// The handshake (MULTIPLAYER.md §5.1). A client must send this first:
//   { t: 'hello', protocol: 1, name: 'BRETT', room: 'A1B2' | null }
// - protocol must equal PROTOCOL_VERSION exactly (skew is refused
//   here, not silently desynced later).
// - name is the requested display callsign: a string of 1–24 chars.
//   (Identity itself comes from the Stage 2 session token — §7.5 —
//   never from this field; M0 validates shape only.)
// - room is null (join/create the default room) or a 4-char string
//   room code. Anything else (missing, wrong length, non-string)
//   is an error.
export function validateHello(msg) {
  const errors = [];
  if (!isPlainObject(msg)) {
    return { ok: false, errors: ['hello message must be an object'] };
  }
  if (msg.t !== MSG.HELLO) {
    errors.push(`t must be '${MSG.HELLO}'`);
  }
  if (msg.protocol !== PROTOCOL_VERSION) {
    errors.push(`protocol must be ${PROTOCOL_VERSION}`);
  }
  if (typeof msg.name !== 'string' || msg.name.length < 1 || msg.name.length > 24) {
    errors.push('name must be a string of 1-24 characters');
  }
  const roomOk =
    msg.room === null || (typeof msg.room === 'string' && msg.room.length === 4);
  if (!roomOk) {
    errors.push('room must be null or a 4-character string');
  }
  return { ok: errors.length === 0, errors };
}

// validateInput(msg) -> { ok, errors[] }
//
// The only gameplay message a client ever sends (MULTIPLAYER.md
// §5.2) — a sample of intent, validated per §7.6:
//   { t: 'input', seq, keys: { forward, back, left, right, sprint,
//     jump }, yaw, pitch, fire, reload, weapon }
// - seq: per-client monotonically increasing counter; must be a
//   non-negative integer (the server tolerates gaps, §5.2 — it does
//   not require seq to be consecutive, only well-formed).
// - keys: an object whose six movement fields are STRICTLY boolean
//   (truthy numbers/strings are rejected — no coercion, §7.6).
// - yaw / pitch: finite numbers; pitch is clamped by Player.look()
//   today to ±1.45 rad, and an input outside that range is invalid
//   here rather than trusted (§7.3).
// - fire / reload: strictly boolean. Fire is a held state; the
//   server derives shots from it + the weapons table, so a client
//   cannot fire faster than the table allows (§5.2).
// - weapon: requested/current slot, an integer 1–5 (the v0.2
//   arsenal size). Switch validity (owned slot) is a sim concern
//   for M1, not a shape concern here.
export function validateInput(msg) {
  const errors = [];
  if (!isPlainObject(msg)) {
    return { ok: false, errors: ['input message must be an object'] };
  }
  if (msg.t !== MSG.INPUT) {
    errors.push(`t must be '${MSG.INPUT}'`);
  }
  if (!Number.isInteger(msg.seq) || msg.seq < 0) {
    errors.push('seq must be a non-negative integer');
  }
  if (!isPlainObject(msg.keys)) {
    errors.push('keys must be an object');
  } else {
    for (const field of ['forward', 'back', 'left', 'right', 'sprint', 'jump']) {
      if (typeof msg.keys[field] !== 'boolean') {
        errors.push(`keys.${field} must be a boolean`);
      }
    }
  }
  if (typeof msg.yaw !== 'number' || !Number.isFinite(msg.yaw)) {
    errors.push('yaw must be a finite number');
  }
  if (typeof msg.pitch !== 'number' || !Number.isFinite(msg.pitch)) {
    errors.push('pitch must be a finite number');
  } else if (msg.pitch < -1.45 || msg.pitch > 1.45) {
    errors.push('pitch must be within ±1.45 radians');
  }
  if (typeof msg.fire !== 'boolean') {
    errors.push('fire must be a boolean');
  }
  if (typeof msg.reload !== 'boolean') {
    errors.push('reload must be a boolean');
  }
  if (!Number.isInteger(msg.weapon) || msg.weapon < 1 || msg.weapon > 5) {
    errors.push('weapon must be an integer 1-5');
  }
  return { ok: errors.length === 0, errors };
}

// Per-connection limits (MULTIPLAYER.md §4, §7.6). The server
// enforces these; they live here so client and server share one
// source. A legitimate `input` is ~200 bytes, so the 4 KB cap costs
// nothing and closes the giant-message hole by construction.
export const LIMITS = Object.freeze({
  MAX_MESSAGE_BYTES: 4096,
  INPUT_MAX_PER_SEC: 40,
  IDLE_TIMEOUT_MS: 10000,
});
