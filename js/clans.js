// ============================================================
// clans.js — CLAN IDENTITY GROUNDWORK (V7.19, Item 5c).
//
// What exists today (honest scope): a clan is a NAME + TAG the
// player keeps in their local profile. The tag rides the online
// hello as a structured field (net/protocol.js shape-checks it,
// the sim stores it on the player record) and prefixes the
// display callsign everywhere names already flow (chat,
// scoreboard, killfeed) — "[TAG] Name".
//
// What this is NOT: a clan registry. There are no accounts yet
// (docs/STAGE2-SESSIONS.md), so tags are self-asserted — anyone
// can type any tag. Clan ownership, membership, invites and war
// records need Stage 2 signed sessions; §9 of that doc is the
// spec. Nothing here pretends otherwise.
//
// Pure module (no DOM, no THREE): client, sim and checks share
// these exact rules — the Lockdown posture (never trust a
// client-asserted string) starts with one sanitizer.
// ============================================================

export const CLAN_NAME_MAX = 24;
export const CLAN_TAG_MIN = 2;
export const CLAN_TAG_MAX = 5;

// Tag: 2-5 chars, letters/digits, stored uppercase. Anything
// else sanitizes to '' (no clan) rather than being half-kept.
export function sanitizeClanTag(raw) {
  if (typeof raw !== 'string') return '';
  const t = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CLAN_TAG_MAX);
  return t.length >= CLAN_TAG_MIN ? t : '';
}

// Clan name: printable, no brackets (they belong to the tag
// format), single-spaced, capped at the callsign length.
export function sanitizeClanName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, CLAN_NAME_MAX);
}

export function sanitizeClan(raw) {
  if (!raw || typeof raw !== 'object') return { name: '', tag: '' };
  return { name: sanitizeClanName(raw.name), tag: sanitizeClanTag(raw.tag) };
}

export function hasClan(clan) {
  return !!clan && typeof clan.tag === 'string' && clan.tag.length >= CLAN_TAG_MIN;
}

// The display form: "[TAG] Name", composed inside the 24-char
// callsign cap the protocol already enforces.
export function taggedCallsign(name, clan) {
  const n = (typeof name === 'string' && name.trim()) ? name.trim() : 'PLAYER';
  if (!hasClan(clan)) return n.slice(0, 24);
  return `[${clan.tag}] ${n}`.slice(0, 24);
}

// Same clan = same non-empty tag (case-insensitive by
// construction — tags sanitize to uppercase). This is the
// grouping Stage 2 team assignment will key on.
export function sameClan(a, b) {
  return hasClan(a) && hasClan(b) && a.tag === b.tag;
}
