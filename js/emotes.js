// emotes.js — EMOTES (V7.27, Job 2 §7): the Over n' Out
// signal-gesture set. Pure data + lookups, shared by the solo
// client, the online client, and the server (which owns the
// allowlist check — a client can only ever name an id that
// exists here).
//
// An emote is presentation only: a first-person gun gesture, a
// third-person puppet gesture, and a radio callout line. It
// carries no outcome — no damage, no score, no state — which
// is exactly why it is safe to relay.
//
// Names and callouts are original Over n' Out (§5): Meridian
// signal culture, not borrowed emote wheels.

export const EMOTES = [
  { id: 'salute', name: 'MERIDIAN SALUTE', callout: 'o7 — Meridian!', gun: 'salute', puppet: 'bow', dur: 1.2 },
  { id: 'wave', name: 'SKY WAVE', callout: 'Up here — eyes on me!', gun: 'wave', puppet: 'wiggle', dur: 1.2 },
  { id: 'point', name: 'MARK IT', callout: 'Mark it — there!', gun: 'point', puppet: 'hop', dur: 0.9 },
  { id: 'cheer', name: 'SIGNAL UP', callout: 'Signal up! We hold!', gun: 'cheer', puppet: 'cheer', dur: 1.2 },
  { id: 'static', name: 'PURE STATIC', callout: 'Nothing but static, friend.', gun: 'static', puppet: 'spin', dur: 1.3 },
  { id: 'dip', name: 'DIP OUT', callout: 'Respect. Dip out.', gun: 'dip', puppet: 'deepbow', dur: 1.3 },
];

export const EMOTE_IDS = EMOTES.map(e => e.id);

export function getEmote(id) {
  return EMOTES.find(e => e.id === id) || null;
}

export function isEmoteId(id) {
  return typeof id === 'string' && EMOTE_IDS.includes(id);
}
