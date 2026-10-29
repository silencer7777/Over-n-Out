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
  // U6-14/U6-15 PROTOCOL EXTENSION (Vega ruling, Update 6):
  // CHAT and SIGNAL are added as an EXTENSION, not a version
  // bump — PROTOCOL_VERSION stays 1. Justification: §5 already
  // drops unknown types for forward compatibility, so an old
  // peer ignores chat/signal traffic harmlessly; neither type
  // carries an outcome (chat is presentation, signal is WebRTC
  // negotiation between clients — the server relays both
  // verbatim after strict validation and owns no result from
  // either). The smoke N1 pin is re-derived in the same commit
  // and the change is named in the Update 6 report.
  CHAT: 'chat',
  SIGNAL: 'signal',
});

// Chat channels (U6-14): 'lobby' = the room you are connected
// to, out of match (the start-menu chatroom rides the default
// LOBBY room); 'team' = your side only; 'all' = the whole room.
export const CHAT_CHANNELS = Object.freeze(['lobby', 'team', 'all']);
export const CHAT_MAX_CHARS = 240;

// WebRTC signal kinds (U6-15): the three negotiation steps of
// a peer connection, relayed client -> client via the server.
export const SIGNAL_KINDS = Object.freeze(['offer', 'answer', 'ice']);

const KNOWN_TYPES = new Set(Object.values(MSG));

// True only for the MSG values above. Anything else — including
// undefined, non-strings, and near-misses like 'Hello' — is false.
export function isKnownType(t) {
  return typeof t === 'string' && KNOWN_TYPES.has(t);
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// The default mode id (js/modes.js MODE_ORDER[0]) — the formalized
// wave game every room runs unless a hello names another mode.
// Mode ids are owned by js/modes.js (Board 004 §1); this module
// validates their SHAPE, the server checks membership.
export const DEFAULT_MODE = 'waves';
const MODE_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
export function isValidModeId(v) {
  return typeof v === 'string' && MODE_ID_PATTERN.test(v);
}

// The default map id (Board 005 §3: map ids are compound /
// forest / snow / mars; js/worlddata.js is the Compound map's
// data). Same shape discipline as mode ids — this module checks
// SHAPE, the server checks membership against the sim's world
// registry (bad_map mirrors bad_mode, Board 005 §3.3).
export const DEFAULT_MAP = 'compound';
export function isValidMapId(v) {
  return typeof v === 'string' && MODE_ID_PATTERN.test(v);
}

// Placed-equipment kinds a client may request on an input sample
// (Directive 10). The sim owns placement validation, counts per
// life, triggers and destruction — this list is only the wire
// vocabulary. ('tripmine' is the ratified id — js/loadouts.js
// LETHALS; an earlier draft called it 'mine'.)
export const PLACE_KINDS = Object.freeze(['claymore', 'tripmine']);

// Scorestreak ids a client may request on an input sample
// (Directive 11). Mirrors js/loadouts.js STREAK_IDS; the sim
// owns selection / meter / active-instance validation.
export const STREAK_CALL_IDS = Object.freeze(['uav', 'cuav', 'package', 'sentry', 'lightning', 'precision']); // U12: lightning is a legal server-validated streak call

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
//
// Optional fields (V4 carriage — all shape-checked here, all
// content-checked by the server against the data modules):
// - session: the Stage 2 signed session token (§5.1). A string of
//   at most 1024 chars. Shape only — Stage 2 verification does not
//   exist yet, and net/README.md says so in plain language.
// - mode: a mode id from js/modes.js (e.g. 'waves', 'tdm'). The
//   first hello to a fresh room sets the room's mode; later hellos
//   join the room's mode whatever they ask for (welcome reports
//   the room's actual mode).
// - loadout: ONE class object ({ name, primary, attachments,
//   tactical, lethal }) — the class the player spawns with,
//   validated server-side by js/loadouts.js validateClass()
//   (Board 004 §3: the server validates against the same tables
//   before the sim sees it).
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
  if (msg.session !== undefined &&
      (typeof msg.session !== 'string' || msg.session.length > 1024)) {
    errors.push('session must be a string of at most 1024 characters');
  }
  if (msg.mode !== undefined && !isValidModeId(msg.mode)) {
    errors.push('mode must be a mode id (lowercase, 1-32 chars)');
  }
  if (msg.map !== undefined && !isValidMapId(msg.map)) {
    errors.push('map must be a map id (lowercase, 1-32 chars)');
  }
  if (msg.loadout !== undefined && !isPlainObject(msg.loadout)) {
    errors.push('loadout must be a class object');
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
  // Optional throw edges (Board 004 §3): the class's tactical /
  // lethal are thrown on the sample where the key was pressed —
  // same edge discipline as reload. Optional, but strictly
  // boolean when present; the sim owns counts and effects.
  if (msg.lethal !== undefined && typeof msg.lethal !== 'boolean') {
    errors.push('lethal must be a boolean when present');
  }
  if (msg.tactical !== undefined && typeof msg.tactical !== 'boolean') {
    errors.push('tactical must be a boolean when present');
  }
  // Optional stance fields (V6 Update 6, U6-10): held-state
  // booleans like aim — stance (C/Ctrl held) and prone (Z held).
  // The sim's shared stance machine (js/stance.js) derives
  // taps/holds/double-taps from the held stream, so no edge
  // claims travel the wire. Strictly boolean when present.
  if (msg.stance !== undefined && typeof msg.stance !== 'boolean') {
    errors.push('stance must be a boolean when present');
  }
  if (msg.prone !== undefined && typeof msg.prone !== 'boolean') {
    errors.push('prone must be a boolean when present');
  }
  // Optional placed-equipment edge (Directive 10): names WHAT to
  // place on this sample; the sim validates surface / facing /
  // count-per-life from authoritative state — the sample claims
  // nothing about where the equipment lands.
  if (msg.place !== undefined && !PLACE_KINDS.includes(msg.place)) {
    errors.push('place must be one of: ' + PLACE_KINDS.join(', '));
  }
  // Optional scorestreak edge (Directive 11): request activation
  // of a scorestreak the player has earned. `streak` names the
  // ladder id; `streakX`/`streakZ` optionally name the target
  // point for a precision strike (finite numbers, clamped by
  // the sim to the map bounds — the sample claims a request,
  // never an outcome). The sim tracks the meter and decides.
  if (msg.streak !== undefined && !STREAK_CALL_IDS.includes(msg.streak)) {
    errors.push('streak must be one of: ' + STREAK_CALL_IDS.join(', '));
  }
  if (msg.streakX !== undefined && (typeof msg.streakX !== 'number' || !Number.isFinite(msg.streakX))) {
    errors.push('streakX must be a finite number when present');
  }
  if (msg.streakZ !== undefined && (typeof msg.streakZ !== 'number' || !Number.isFinite(msg.streakZ))) {
    errors.push('streakZ must be a finite number when present');
  }
  // Legacy alias: request the UAV specifically. Strictly
  // boolean when present.
  if (msg.uav !== undefined && typeof msg.uav !== 'boolean') {
    errors.push('uav must be a boolean when present');
  }
  if (!Number.isInteger(msg.weapon) || msg.weapon < 1 || msg.weapon > 5) {
    errors.push('weapon must be an integer 1-5');
  }
  return { ok: errors.length === 0, errors };
}

// validateChat(msg) -> { ok, errors[] }  (U6-14)
//
// A chat line: { t: 'chat', channel, text }. The client claims
// words, never identity — the server stamps `from`/`name` from
// its own player record when relaying, so a forged name field
// in the payload is ignored by construction (it is not even
// read). Text is shape-checked here (string, 1..CHAT_MAX_CHARS
// after trim); the server additionally strips control
// characters before relay and rate-limits per player. Rendering
// is textContent-only on every client (no HTML path exists).
export function validateChat(msg) {
  const errors = [];
  if (!isPlainObject(msg)) {
    return { ok: false, errors: ['chat message must be an object'] };
  }
  if (msg.t !== MSG.CHAT) {
    errors.push(`t must be '${MSG.CHAT}'`);
  }
  if (!CHAT_CHANNELS.includes(msg.channel)) {
    errors.push('channel must be one of: ' + CHAT_CHANNELS.join(', '));
  }
  if (typeof msg.text !== 'string' || msg.text.trim().length < 1 || msg.text.length > CHAT_MAX_CHARS) {
    errors.push(`text must be a string of 1-${CHAT_MAX_CHARS} characters`);
  }
  return { ok: errors.length === 0, errors };
}

// validateSignal(msg) -> { ok, errors[] }  (U6-15)
//
// A WebRTC negotiation relay: { t: 'signal', to, kind, data }.
// `to` is the target playerId (a string of at most 64 chars —
// the server checks it names a player in the sender's room and
// refuses self-relay). `data` is the opaque RTC payload, capped
// per kind: an SDP blob (offer/answer) or one ICE candidate.
// The server relays the payload verbatim and interprets none
// of it; no outcome can ride it (it can only negotiate audio
// between two browsers).
export function validateSignal(msg) {
  const errors = [];
  if (!isPlainObject(msg)) {
    return { ok: false, errors: ['signal message must be an object'] };
  }
  if (msg.t !== MSG.SIGNAL) {
    errors.push(`t must be '${MSG.SIGNAL}'`);
  }
  if (typeof msg.to !== 'string' || msg.to.length < 1 || msg.to.length > 64) {
    errors.push('to must be a player id string of 1-64 characters');
  }
  if (!SIGNAL_KINDS.includes(msg.kind)) {
    errors.push('kind must be one of: ' + SIGNAL_KINDS.join(', '));
  }
  if (!isPlainObject(msg.data)) {
    errors.push('data must be an object');
  } else if (msg.kind === 'offer' || msg.kind === 'answer') {
    if (typeof msg.data.sdp !== 'string' || msg.data.sdp.length < 1 || msg.data.sdp.length > 12000) {
      errors.push('data.sdp must be a string of 1-12000 characters');
    }
  } else if (msg.kind === 'ice') {
    if (typeof msg.data.candidate !== 'string' || msg.data.candidate.length > 1024) {
      errors.push('data.candidate must be a string of at most 1024 characters');
    }
    if (msg.data.sdpMid !== undefined && (typeof msg.data.sdpMid !== 'string' || msg.data.sdpMid.length > 64)) {
      errors.push('data.sdpMid must be a string of at most 64 characters when present');
    }
  }
  return { ok: errors.length === 0, errors };
}

// Per-connection limits (MULTIPLAYER.md §4, §7.6). The server
// enforces these; they live here so client and server share one
// source. A legitimate `input` is ~200 bytes, so the 4 KB cap costs
// nothing and closes the giant-message hole by construction.
// SIGNAL_MAX_BYTES is the one exception: an SDP offer is
// legitimately several KB, so signal messages get a larger cap
// (validateSignal still bounds every field inside).
// CHAT_RATE: at most 5 chat messages per 4 s per player,
// enforced by the server (U6-14 practical law).
export const LIMITS = Object.freeze({
  MAX_MESSAGE_BYTES: 4096,
  SIGNAL_MAX_BYTES: 16384,
  INPUT_MAX_PER_SEC: 40,
  IDLE_TIMEOUT_MS: 10000,
  CHAT_MAX_PER_WINDOW: 5,
  CHAT_WINDOW_MS: 4000,
});
