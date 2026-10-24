// ============================================================
// maps.js — LEVEL REGISTRY (V5, Board 005 §3).
// Owner: Coordinator. One row per level: its own worlddata
// module (layout, terrain, structures, spawns, mode zones —
// Directive 7: a level is a distinct MAP, not a re-light) and
// its lighting profile id (js/lighting.js).
//
// layout: 'distinct' only when layout + data + gates are all
// green (Board 005 §3.4); 'transition' is scored plainly in
// the V5 report. Data modules: Atlas (744f8ca) — all four
// follow the worlddata.js export contract exactly.
// ============================================================
import * as CompoundData from './worlddata.js';
import * as ForestData from './worlddata-forest.js';
import * as SnowData from './worlddata-snow.js';
import * as MarsData from './worlddata-mars.js';

export const MAPS = [
  { id: 'compound', name: 'COMPOUND', layout: 'distinct', data: CompoundData, lighting: 'compound' },
  { id: 'forest', name: 'FOREST', layout: 'transition', data: ForestData, lighting: 'forest' },
  { id: 'snow', name: 'SNOW STATION', layout: 'transition', data: SnowData, lighting: 'snow' },
  { id: 'mars', name: 'MARS UPLINK', layout: 'transition', data: MarsData, lighting: 'mars' },
];
export const MAP_IDS = MAPS.map(m => m.id);
export const DEFAULT_MAP_ID = 'compound';

export function getMap(id) {
  return MAPS.find(m => m.id === id) || MAPS[0];
}
export function getMapData(id) {
  return getMap(id).data;
}
export function isMapId(id) {
  return MAP_IDS.includes(id);
}

// ------------------------------------------------------------
// Fixed team spawn sets (Board 005 Addendum 3, accepting
// Havoc's sightline flags R2/R4 — tools/sightline-audit.mjs).
// The Relay Tower L2 nest (38.8, 4.6, -56) sees compound
// spawns S2 S3 S5 S6 S7 S9 S10 and zone B (11/15 fishbowl);
// A and C read 0/15. Team games therefore spawn on FIXED sets
// instead of the shared pool, and Relay Assault attackers
// stage from the tower-UNSEEN set.
// ------------------------------------------------------------
export const TEAM_SPAWNS = {
  compound: {
    // Split so neither team's set is tower-visible as a whole:
    // alpha holds the unseen north/west, bravo the south/east.
    alpha: [0, 1, 4, 8, 11],
    bravo: [2, 3, 5, 6, 7, 9, 10],
  },
};
export const ASSAULT_ATTACKER_SPAWNS = {
  compound: [0, 1, 4, 8, 11],   // the tower-unseen set (R4)
};
