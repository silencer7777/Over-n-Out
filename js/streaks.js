// ============================================================
// streaks.js — SCORESTREAK LADDER (V5, owner Directive 11).
// Numbers: Havoc (v5-equipment-and-streaks-ruling §6), ratified
// by Board 005 Addendum 3. Owner execution standard: EVERY
// streak is a REAL OBJECT in the world — this module holds the
// shared truth (thresholds, drone flight math) the client
// renders and the sim arbitrates. DOM-free, THREE-free.
//
// Meter rules (Havoc §6): ONE score meter per player, fed by
// XP events at their XP values (streak XP bonuses feed 0).
// Death does NOT reset it. Calling a streak SPENDS its cost.
// Exactly 3 streaks selected per class (loadouts validates).
// World-presence specs: docs/sessions/board-meeting-005.md
// Addendum 2 (as amended by Addendum 3).
// ============================================================
import { XP_VALUES } from './progression.js';

export const STREAKS = [
  { id: 'uav', name: 'UAV', cost: 500, duration: 24,
    blurb: 'A drone flies the circuit for 24 s, pinging enemy positions every 3 s.' },
  { id: 'cuav', name: 'COUNTER-UAV', cost: 650, duration: 20,
    blurb: 'A drone denies the enemy sweep picture for 20 s.' },
  { id: 'package', name: 'CARE PACKAGE', cost: 800, duration: 0,
    blurb: 'A crate falls on your position: full resupply + a rolled streak. Anyone can claim it.' },
  { id: 'sentry', name: 'SENTRY GUN', cost: 1050, duration: 45, hp: 100,
    blurb: 'A placed auto-turret, 45 s battery. Flash does not blind it; smoke blocks it.' },
  { id: 'precision', name: 'PRECISION STRIKE', cost: 1300, duration: 0, warn: 2.5, radius: 7, damage: 130,
    blurb: 'A strike on your aim point after a 2.5 s warning. Solid cover negates it.' },
];
export function getStreak(id) {
  return STREAKS.find(s => s.id === id) || null;
}

// The UAV drone (Addendum 2/3): a physical airframe on a
// deterministic circuit — client and sim compute the SAME
// position from (centre, phase, t): no netcode for the path.
export const UAV_SPEC = {
  altitude: 28, orbitRadius: 30, speed: 14,   // ~13.5 s per circuit
  pingEvery: 3, linger: 1.2, hp: 150, denialXp: 75, duration: 24,
};
export const CUAV_SPEC = { altitude: 34, hp: 150, duration: 20 };
export const PACKAGE_SPEC = {
  dropAltitude: 30, crateHp: 60, claimTime: 1.5,
  roll: [['uav', 50], ['cuav', 30], ['sentry', 20]],   // weighted %
};
export const SENTRY_SPEC = {
  hp: 100, battery: 45, range: 25, deployTime: 0.7,
  aimTimeNeeded: 0.55, scanDegPerSec: 30,
};

// position on the circuit at time t (seconds since launch).
// baseY = ground height at the orbit centre; y is absolute.
export function dronePositionAt(cx, cz, baseY, spec, phase, t) {
  const a = phase + (spec.speed / spec.orbitRadius) * t;
  return {
    x: cx + Math.cos(a) * spec.orbitRadius,
    y: baseY + spec.altitude,
    z: cz + Math.sin(a) * spec.orbitRadius,
    heading: a + Math.PI / 2,
  };
}

// Meter feeds: XP event kind -> streak points (Havoc §6:
// score sources are XP events at value; the streak-bonus XP
// sources — uavDenial etc. — feed ZERO by design).
export const STREAK_FEED = {
  kill: XP_VALUES.kill, assist: XP_VALUES.assist,
  capture: XP_VALUES.capture, channelTick: XP_VALUES.channelTick,
  waveClear: XP_VALUES.waveClear,
  uavDenial: 0, precisionMulti: 0, flawlessWave: 0,
};
export function streakFeedFor(kind) {
  return STREAK_FEED[kind] || 0;
}

// ------------------------------------------------------------
// Per-player streak state (a plain object; the client owns one
// for the local player solo, the sim owns one per player
// online). Death never touches score (Havoc §6) — there is
// deliberately no onDeath reset here.
// ------------------------------------------------------------
export function createStreakState(selectedIds) {
  return { selected: [...selectedIds], score: 0, active: [] };
}

export function feedStreak(state, points) {
  if (points > 0) state.score += points;
  return state;
}

// Ready = selected, affordable, and not already airborne/placed.
export function streakReady(state, id) {
  const s = getStreak(id);
  return !!s && state.selected.includes(id) && state.score >= s.cost
    && !state.active.some(a => a.id === id);
}

// The lowest-cost ready streak (what the streak key calls).
export function nextReadyStreak(state) {
  return state.selected
    .map(getStreak)
    .filter(s => s && streakReady(state, s.id))
    .sort((a, b) => a.cost - b.cost)[0] || null;
}

// Spend + register. Timed streaks (duration > 0) join
// state.active; instant streaks (package, precision) return an
// activation the caller executes in the world. Null = refused.
export function activateStreak(state, id, now) {
  if (!streakReady(state, id)) return null;
  const s = getStreak(id);
  state.score -= s.cost;
  const act = { id, startedAt: now, endsAt: s.duration > 0 ? now + s.duration : now };
  if (s.duration > 0) state.active.push(act);
  return act;
}

export function expireStreaks(state, now) {
  const ended = state.active.filter(a => now >= a.endsAt);
  state.active = state.active.filter(a => now < a.endsAt);
  return ended;
}
