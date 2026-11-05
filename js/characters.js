// ============================================================
// characters.js — THE OPERATOR ROSTER (V7.20, Item 9).
//
// Fifteen distinct playable characters: name, role, and a real
// OUTFIT — a uniform (js/camo.js pattern) plus a kit colour
// story (gear / webbing / boots) plus a skin tone. Characters
// are VISUAL IDENTITY ONLY: every operator shares the same
// hitbox class, stats and cost. That is not a compromise, it
// is the architecture's law — the soldier rig is shared and
// the metrics CAMO VETO pins palette swaps at Δ0 draw calls /
// Δ0 tris, so a 15-operator match costs exactly what a
// 1-operator match costs per soldier (8 calls / ~6.1k tris).
//
// Faction readability stays law: the faction fields (chest
// rig, visor, armband, shoulder pads) come from the TEAM
// palette and are never part of an outfit — friend-vs-hostile
// reads at distance no matter who you play as.
//
// Pure module: client, bots, puppets, sim and checks all read
// the same roster.
// ============================================================

import { CAMO_IDS } from './camo.js';

// Kit colour stories (gear = vest/pack cloth, gearLight =
// pouches/straps, dark = arms/webbing, boot = boots).
export const KIT_STORIES = {
  olive: { gear: 0x4c5537, gearLight: 0x5d6845, dark: 0x2c3122, boot: 0x23261c },
  black: { gear: 0x1d1f22, gearLight: 0x2c2e33, dark: 0x101214, boot: 0x0c0d0f },
  tan: { gear: 0x8a7350, gearLight: 0x9c8460, dark: 0x4a3d2c, boot: 0x5c4a33 },
  slate: { gear: 0x3d4753, gearLight: 0x4e5a68, dark: 0x232a33, boot: 0x14181d },
  rust: { gear: 0x6e4630, gearLight: 0x81553c, dark: 0x3c2718, boot: 0x241a12 },
};

// The roster. camo = uniform pattern (js/camo.js); kit = the
// gear story above; skin = one of the human range the bots
// already roll from. Every (camo, kit, skin) triple is unique.
export const ROSTER = [
  { id: 'reyes', name: 'REYES', role: 'Pointman', camo: 'woodland', kit: 'olive', skin: 0xa9745a, blurb: 'Woodland uniform, olive kit — Meridian standard issue, worn like he means it.' },
  { id: 'okafor', name: 'OKAFOR', role: 'Breacher', camo: 'urban', kit: 'black', skin: 0x7c4b32, blurb: 'Urban greys with blacked-out kit — built for doorways and bad rooms.' },
  { id: 'lindqvist', name: 'LINDQVIST', role: 'Pathfinder', camo: 'arctic', kit: 'slate', skin: 0xe0bda0, blurb: 'Arctic whites over slate kit — Snow Station’s own, cold hands, steady aim.' },
  { id: 'haddad', name: 'HADDAD', role: 'Scout', camo: 'desert', kit: 'tan', skin: 0x8a5a3b, blurb: 'Desert pattern with sun-bleached tan kit — disappears at forty metres.' },
  { id: 'kowalski', name: 'KOWALSKI', role: 'Night Operator', camo: 'night', kit: 'black', skin: 0xc9a189, blurb: 'Night uniform, black kit, no shine anywhere — a rumour with a rifle.' },
  { id: 'tran', name: 'TRAN', role: 'Marksman', camo: 'mirage', kit: 'tan', skin: 0xa9745a, blurb: 'Mirage pattern and tan kit — patient, still, and then exactly loud enough.' },
  { id: 'duarte', name: 'DUARTE', role: 'Jungle Fighter', camo: 'tiger', kit: 'olive', skin: 0x8a5a3b, blurb: 'Tiger stripe with olive kit — old-school pattern, new-school discipline.' },
  { id: 'volkov', name: 'VOLKOV', role: 'Heavy', camo: 'crimson', kit: 'rust', skin: 0xe0bda0, blurb: 'Crimson uniform, rust-red kit — wants to be seen coming. That’s the point.' },
  { id: 'amari', name: 'AMARI', role: 'Veteran', camo: 'gold', kit: 'black', skin: 0x7c4b32, blurb: 'Gold prestige pattern with black kit — earned every thread of it.' },
  { id: 'haugen', name: 'HAUGEN', role: 'Rifleman', camo: 'woodland', kit: 'black', skin: 0xe0bda0, blurb: 'Woodland cloth under black kit — forest colours, night manners.' },
  { id: 'frost', name: 'FROST', role: 'Winter Assault', camo: 'arctic', kit: 'black', skin: 0xc9a189, blurb: 'Arctic uniform, black kit — the storm front of Snow Station.' },
  { id: 'ibrahim', name: 'IBRAHIM', role: 'Desert Rat', camo: 'desert', kit: 'olive', skin: 0x7c4b32, blurb: 'Desert pattern with olive kit — carries more water than ammo. Almost.' },
  { id: 'novak', name: 'NOVAK', role: 'City Runner', camo: 'urban', kit: 'slate', skin: 0xa9745a, blurb: 'Urban pattern, slate kit — concrete is just another kind of cover.' },
  { id: 'mercer', name: 'MERCER', role: 'Ghost', camo: 'night', kit: 'slate', skin: 0x8a5a3b, blurb: 'Night cloth with slate kit — checks corners the way you check mirrors.' },
  { id: 'santos', name: 'SANTOS', role: 'Ambusher', camo: 'tiger', kit: 'black', skin: 0xc9a189, blurb: 'Tiger stripe under black kit — the bush you walk past once.' },
];

export const CHARACTER_IDS = ROSTER.map(c => c.id);
export const DEFAULT_CHARACTER = 'reyes';

const BY_ID = new Map(ROSTER.map(c => [c.id, c]));
export function getCharacter(id) { return BY_ID.get(id) || BY_ID.get(DEFAULT_CHARACTER); }
export function isCharacterId(id) { return typeof id === 'string' && BY_ID.has(id); }

// The outfit as palette overrides — ONLY palette fields, so the
// CAMO VETO (Δ0 calls / Δ0 tris per identity) holds by
// construction. Faction fields are never in here.
export function characterOutfit(id) {
  const c = getCharacter(id);
  const kit = KIT_STORIES[c.kit] || KIT_STORIES.olive;
  return { camoId: c.camo, skin: c.skin, gear: kit.gear, gearLight: kit.gearLight, dark: kit.dark, boot: kit.boot };
}

// Roster sanity (checked by tools/characters-check.mjs): the
// roster is only worth shipping if every entry is real.
export function rosterProblems() {
  const problems = [];
  if (ROSTER.length !== 15) problems.push(`roster has ${ROSTER.length} characters, expected 15`);
  const ids = new Set(), triples = new Set();
  for (const c of ROSTER) {
    if (ids.has(c.id)) problems.push(`duplicate id ${c.id}`);
    ids.add(c.id);
    if (!CAMO_IDS.includes(c.camo)) problems.push(`${c.id}: unknown camo ${c.camo}`);
    if (!KIT_STORIES[c.kit]) problems.push(`${c.id}: unknown kit ${c.kit}`);
    const triple = `${c.camo}|${c.kit}|${c.skin.toString(16)}`;
    if (triples.has(triple)) problems.push(`${c.id}: outfit triple duplicates another character`);
    triples.add(triple);
  }
  return problems;
}
