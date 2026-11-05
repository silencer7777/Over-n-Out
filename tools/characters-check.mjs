// Characters check (V7.20, Item 9) — the operator roster:
//   CH1 roster integrity: 15 characters, unique ids, real camos
//       and kit stories, unique outfit triples (js/characters.js
//       rosterProblems is the single source of the rules)
//   CH2 the cost law: an outfit is PALETTE FIELDS ONLY — the
//       CAMO VETO (palette swaps cost Δ0 calls / Δ0 tris) holds
//       by construction; no outfit may carry a geometry key
//   CH3 profile: a valid operator survives sanitizeProfile, a
//       bogus one falls back to the default
//   CH4 hello: the character field is shape-checked; the sim
//       validates ids against the roster before storing
//   CH5 wiring: bots take a character, solo spawns rotate the
//       roster, sim bots rotate deterministically, puppets
//       re-skin from the snapshot char field
// Exit 1 on any failure.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);

const CH = await import(join(ROOT, 'js/characters.js'));
const P = await import(join(ROOT, 'js/progression.js'));
const PROTO = await import(join(ROOT, 'net/protocol.js'));

// CH1
{
  const problems = CH.rosterProblems();
  if (problems.length === 0)
    ok(`CH1 roster: 15 distinct operators (${CH.ROSTER.map(c => c.name).join(', ')}) — unique ids, real camos/kits, unique outfit triples`);
  else fail(`CH1 roster problems: ${problems.join('; ')}`);
}

// CH2
{
  const PALETTE_KEYS = new Set(['camoId', 'skin', 'gear', 'gearLight', 'dark', 'boot']);
  let bad = null;
  for (const c of CH.ROSTER) {
    const o = CH.characterOutfit(c.id);
    for (const k of Object.keys(o)) if (!PALETTE_KEYS.has(k)) bad = `${c.id}.${k}`;
    if (typeof o.skin !== 'number' || typeof o.gear !== 'number') bad = `${c.id} non-colour outfit value`;
  }
  // every character shares the default's hitbox class by
  // construction: characters.js exports no geometry at all.
  const src = readFileSync(join(ROOT, 'js/characters.js'), 'utf8');
  const buildsGeometry = ['BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'mergeColoredParts', 'THREE.'].some(t => src.includes(t));
  if (!bad && !buildsGeometry)
    ok('CH2 cost law: outfits are palette fields only (no geometry anywhere in the roster module) — 15 operators cost the same per soldier as 1');
  else fail(`CH2 cost law → ${bad || 'geometry crept into characters.js'}`);
}

// CH3
{
  const good = P.sanitizeProfile({ character: 'volkov' });
  const badP = P.sanitizeProfile({ character: 'not-a-person' });
  const fresh = P.createProfile();
  if (good.character === 'volkov' && badP.character === CH.DEFAULT_CHARACTER && fresh.character === CH.DEFAULT_CHARACTER)
    ok('CH3 profile: operator choice persists through sanitize; unknown ids fall back to REYES');
  else fail(`CH3 profile → good ${good.character}, bad ${badP.character}, fresh ${fresh.character}`);
}

// CH4
{
  const okHello = PROTO.validateHello({ t: 'hello', protocol: 1, name: 'BRETT', room: null, character: 'volkov' });
  const badHello = PROTO.validateHello({ t: 'hello', protocol: 1, name: 'BRETT', room: null, character: 'x'.repeat(21) });
  const sim = readFileSync(join(ROOT, 'net/sim.js'), 'utf8');
  if (okHello.ok && !badHello.ok && sim.includes("characterId: isCharacterId(characterId) ? characterId : ''"))
    ok('CH4 hello character: shape-checked at the handshake; the sim stores only real roster ids');
  else fail(`CH4 hello → ok ${okHello.ok}, bad ${badHello.ok}, sim pin ${sim.includes('isCharacterId(characterId)')}`);
}

// CH5
{
  const bots = readFileSync(join(ROOT, 'js/bots.js'), 'utf8');
  const main = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
  const sim = readFileSync(join(ROOT, 'net/sim.js'), 'utf8');
  const online = readFileSync(join(ROOT, 'js/online.js'), 'utf8');
  const checks = {
    botParam: bots.includes('characterId = null') && bots.includes('characterOutfit(characterId)'),
    soloRotation: main.includes('CHARACTER_IDS[spawnBot._charSeq'),
    simRotation: sim.includes('CHARACTER_IDS[botNum % CHARACTER_IDS.length]'),
    snapshotChar: sim.includes('char: p.characterId || null') && sim.includes('char: b.characterId || null'),
    puppetSkin: online.includes('buildPuppetMesh(friendly, ent.weapon, ent.char || null)') && online.includes('pup.charId !== (ent.char || null)'),
    picker: main.includes('renderCharacterPicker()') && main.includes("character: profile.character"),
  };
  const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  if (bad.length === 0)
    ok('CH5 wiring: LOADOUT picker -> profile -> hello -> sim record -> snapshot -> puppet palette; solo + sim bots rotate the same roster');
  else fail(`CH5 wiring missing: ${bad.join(', ')}`);
}

if (failures) { console.error(`characters-check: ${failures} FAIL`); process.exit(1); }
console.log('characters-check: all pass');
