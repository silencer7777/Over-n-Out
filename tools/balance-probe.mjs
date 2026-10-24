// Balance probe (Havoc, Gameplay) — MEASURED balance baseline tool.
//
// Drives net/sim.js headlessly (no server, no DOM) with scripted
// players so weapon/bot numbers can be measured, not vibes:
//
//   A. TTK per weapon — a stationary turret player with perfect
//      chest tracking fires one weapon; per-bot time from first
//      hit to kill, hits-to-kill, and engagement distance are
//      recorded from sim events. Barrel-assisted kills are counted
//      separately and excluded from weapon TTK.
//   B. Time-to-down — a passive player (never fires, never moves)
//      vs waves 1/3/5/7: how long a full bot wave takes to down a
//      stationary 100 HP target, spawn + approach included.
//   C. Wave pacing — the same turret with the AR across seeds:
//      per-wave durations, waves survived, total kills.
//
// Determinism: every run is seeded (mulberry32 inside the sim), so
// numbers in docs/sessions/v4-balance-baseline.md reproduce with
//   node tools/balance-probe.mjs
// Exit 0 always (it is a measuring instrument, not a gate).
import { createMatch, addSimPlayer, startWaveSim, stepMatch, losClear, EYE } from '../net/sim.js';
import { WEAPON_ORDER, getWeapon } from '../js/weapons.js';
import { SPAWN_POINTS } from '../js/worlddata.js';

const DT = 1 / 30;
const NEUTRAL_KEYS = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };

function makeInput(yaw, pitch, fire, weaponIdx) {
  return { t: 'input', seq: 0, keys: { ...NEUTRAL_KEYS }, yaw, pitch, fire, reload: false, weapon: weaponIdx };
}

function aimAt(px, py, pz, bot) {
  const dx = bot.pos.x - px, dz = bot.pos.z - pz;
  const dy = (bot.pos.y + 1.1) - (py + EYE);
  return {
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.max(-1.45, Math.min(1.45, Math.atan2(dy, Math.hypot(dx, dz)))),
  };
}

function nearestBot(match, p) {
  let best = null, bd = Infinity;
  for (const b of match.bots) {
    if (b.dead) continue;
    const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

// Human-like target discipline: engage the nearest bot the player
// can actually SEE (eye -> chest line clear). Bots approach on
// straight lines and can wedge behind geometry; a human stops
// shooting a wall, so the probe does too. (Wedge behaviour itself
// is reported as a finding, not gamed around.)
function visibleTarget(match, p) {
  let best = null, bd = Infinity;
  for (const b of match.bots) {
    if (b.dead) continue;
    const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
    if (d >= bd) continue;
    if (losClear(p.pos.x, p.pos.y + EYE, p.pos.z, b.pos.x, b.pos.y + 1.1, b.pos.z)) { bd = d; best = b; }
  }
  return best;
}

const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

// ----------------------------------------------------------------
// A. TTK per weapon
// ----------------------------------------------------------------
function ttkRun(weaponId, seed, burstDiscipline = false, maxTicks = 30 * 120, killQuota = 30) {
  const m = createMatch(seed);
  const p = addSimPlayer(m, 'probe', 'PROBE');
  startWaveSim(m, []);
  const wIdx = WEAPON_ORDER.indexOf(weaponId) + 1;
  const auto = getWeapon(weaponId).auto;
  const perBot = new Map(); // id -> {firstHit, hits, barrel}
  const kills = [];         // {ttk (s), hits, dist}
  let barrelKills = 0, tick = 0;

  while (m.state !== 'over' && tick < maxTicks && kills.length + barrelKills < killQuota + 10 && kills.length < killQuota) {
    tick++;
    const bot = visibleTarget(m, p);
    if (bot) {
      const { yaw, pitch } = aimAt(p.pos.x, p.pos.y, p.pos.z, bot);
      // Sustained: hold the trigger. Burst-disciplined (autos):
      // release while bloom is high, like a player managing spread.
      let fire = auto ? true : (tick % 2 === 0); // pulse semi-autos
      if (burstDiscipline && auto && p.bloom > 0.4) fire = false;
      p.input = makeInput(yaw, pitch, fire, wIdx);
    } else {
      p.input = makeInput(0, 0, false, wIdx);
    }
    const evs = [];
    stepMatch(m, DT, evs);
    for (const ev of evs) {
      if (ev.kind === 'hit' && ev.by === 'probe') {
        let rec = perBot.get(ev.target);
        if (!rec) {
          const b = m.bots.find(x => x.id === ev.target);
          const dist = b ? Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) : NaN;
          rec = { firstHit: tick, hits: 0, dist };
          perBot.set(ev.target, rec);
        }
        rec.hits++;
      } else if (ev.kind === 'kill') {
        const rec = perBot.get(ev.target);
        if (ev.by === 'explosion') {
          barrelKills++;
          perBot.delete(ev.target);
        } else if (ev.by === 'probe' && rec) {
          const b = m.bots.find(x => x.id === ev.target);
          const distKill = b ? Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) : rec.dist;
          kills.push({ ttk: (tick - rec.firstHit) / 30, hits: rec.hits, dist: rec.dist, distKill });
          perBot.delete(ev.target);
        }
      }
    }
  }
  return { kills, barrelKills, shots: p.shots, hitPulls: p.hits, wave: m.wave, simSeconds: tick / 30 };
}

// ----------------------------------------------------------------
// B. Time-to-down of a passive player
// ----------------------------------------------------------------
function ttdRun(wave, seed, maxTicks = 30 * 180) {
  const m = createMatch(seed);
  const p = addSimPlayer(m, 'probe', 'PROBE');
  m.wave = wave - 1;
  startWaveSim(m, []);
  let tick = 0, firstDamageTick = -1;
  let prevHp = p.hp;
  while (m.state !== 'over' && tick < maxTicks) {
    tick++;
    p.input = makeInput(0, 0, false, 1);
    stepMatch(m, DT, []);
    if (firstDamageTick < 0 && p.hp < prevHp) firstDamageTick = tick;
    prevHp = p.hp;
  }
  return {
    downed: m.state === 'over',
    ttd: tick / 30,
    firstDamage: firstDamageTick < 0 ? NaN : firstDamageTick / 30,
  };
}

// ----------------------------------------------------------------
// C. Wave pacing (AR hunter — closes on targets like a player;
// a stationary turret under-measures multi-level waves because
// straight-line bots wedge on geometry. Stalls are still counted.)
// ----------------------------------------------------------------
function pacingRun(seed, maxTicks = 30 * 300) {
  const m = createMatch(seed);
  const p = addSimPlayer(m, 'probe', 'PROBE');
  startWaveSim(m, []);
  let tick = 0, waveStart = 0, stalledSeconds = 0, lastKillTick = 0;
  let pushTicks = 0, pushStartDist = Infinity, sidesteps = 0, teleports = 0;
  const waveDurations = [];
  while (m.state !== 'over' && tick < maxTicks) {
    tick++;
    const vis = visibleTarget(m, p);
    const nb = nearestBot(m, p);
    if (vis) {
      pushTicks = 0; sidesteps = 0;
      const { yaw, pitch } = aimAt(p.pos.x, p.pos.y, p.pos.z, vis);
      const d = Math.hypot(vis.pos.x - p.pos.x, vis.pos.z - p.pos.z);
      const inp = makeInput(yaw, pitch, true, 1);
      if (d > 14) inp.keys.forward = true; // keep closing while firing
      p.input = inp;
    } else if (nb) {
      const { yaw, pitch } = aimAt(p.pos.x, p.pos.y, p.pos.z, nb);
      const inp = makeInput(yaw, pitch, false, 1);
      inp.keys.forward = true;
      inp.keys.sprint = true;
      // Anti-stall: pushing without closing distance = wedged on
      // geometry. Sidestep like a player would; if two sidesteps
      // fail, reposition to a spawn point (disclosed in the doc —
      // pacing = engagement time + traversal, scripted agents
      // cannot use the stair routes).
      const dNow = Math.hypot(nb.pos.x - p.pos.x, nb.pos.z - p.pos.z);
      if (pushTicks === 0) pushStartDist = dNow;
      pushTicks++;
      if (pushTicks > 120 && dNow > pushStartDist - 2) {
        if (sidesteps < 2) {
          if (pushTicks < 165) inp.keys[sidesteps % 2 ? 'left' : 'right'] = true;
          else { sidesteps++; pushTicks = 0; }
        } else {
          const sp = SPAWN_POINTS[teleports % SPAWN_POINTS.length];
          p.pos.x = sp[0]; p.pos.z = sp[2]; p.pos.y = sp[1]; p.vel.x = 0; p.vel.z = 0;
          teleports++; sidesteps = 0; pushTicks = 0;
        }
      }
      p.input = inp;
    } else p.input = makeInput(0, 0, false, 1);
    const evs = [];
    stepMatch(m, DT, evs);
    for (const ev of evs) {
      if (ev.kind === 'wave_clear') waveDurations.push((tick - waveStart) / 30);
      if (ev.kind === 'wave') waveStart = tick;
      if (ev.kind === 'kill') lastKillTick = tick;
    }
  }
  stalledSeconds = (tick - lastKillTick) / 30;
  return {
    survivedSeconds: tick / 30,
    wavesCleared: waveDurations.length,
    waveDurations,
    kills: m.kills,
    finalWave: m.wave,
    endedByDeath: m.state === 'over',
    stalledSeconds,
    teleports,
  };
}

// ----------------------------------------------------------------
// Report
// ----------------------------------------------------------------
console.log('=== A. TTK PER WEAPON (turret, chest tracking, 5 seeds each) ===');
for (const wid of WEAPON_ORDER) {
  const allKills = [], burstKills = [];
  let barrelKills = 0, shots = 0, hitPulls = 0;
  for (let s = 0; s < 5; s++) {
    const r = ttkRun(wid, 1000 + s * 17 + wid.length * 131, false);
    allKills.push(...r.kills);
    barrelKills += r.barrelKills;
    shots += r.shots; hitPulls += r.hitPulls;
    if (getWeapon(wid).auto) {
      const rb = ttkRun(wid, 1000 + s * 17 + wid.length * 131, true);
      burstKills.push(...rb.kills);
    }
  }
  const bands = { '0-10m': [], '10-20m': [], '20-35m': [], '35m+': [] };
  for (const k of allKills) {
    const d = k.distKill;
    const b = d < 10 ? '0-10m' : d < 20 ? '10-20m' : d < 35 ? '20-35m' : '35m+';
    bands[b].push(k.ttk);
  }
  const bandStr = Object.entries(bands)
    .map(([b, xs]) => xs.length ? `${b}: ${median(xs).toFixed(2)}s (n=${xs.length})` : `${b}: —`)
    .join(' · ');
  const burstStr = burstKills.length
    ? ` · burst-disciplined medianTTK=${median(burstKills.map(k => k.ttk)).toFixed(2)}s (n=${burstKills.length})`
    : '';
  console.log(`${wid.padEnd(8)} kills=${allKills.length} barrelKills=${barrelKills} ` +
    `medianTTK=${median(allKills.map(k => k.ttk)).toFixed(2)}s meanHitsToKill=${mean(allKills.map(k => k.hits)).toFixed(1)} ` +
    `pullHitRate=${shots ? (100 * hitPulls / shots).toFixed(0) : 0}%${burstStr}`);
  console.log(`         ${bandStr}`);
}

console.log('\n=== B. TIME-TO-DOWN, PASSIVE PLAYER (4 seeds each) ===');
for (const w of [1, 3, 5, 7]) {
  const runs = [0, 1, 2, 3].map(s => ttdRun(w, 5000 + s * 31 + w * 7));
  const ttds = runs.filter(r => r.downed).map(r => r.ttd);
  const fds = runs.map(r => r.firstDamage).filter(x => !Number.isNaN(x));
  console.log(`wave ${w}: downed ${ttds.length}/4 · median TTD=${ttds.length ? median(ttds).toFixed(1) + 's' : 'survived'} · median first-damage at ${fds.length ? median(fds).toFixed(1) + 's' : '—'}`);
}

console.log('\n=== C. WAVE PACING (AR hunter, 6 seeds, 300 s cap) ===');
{
  const runs = [0, 1, 2, 3, 4, 5].map(s => pacingRun(9000 + s * 43));
  const allDur = runs.flatMap(r => r.waveDurations.map((d, i) => ({ wave: i + 1, d })));
  const byWave = {};
  for (const { wave, d } of allDur) (byWave[wave] = byWave[wave] || []).push(d);
  for (const [w, ds] of Object.entries(byWave)) {
    console.log(`wave ${w}: median clear ${median(ds).toFixed(1)}s (n=${ds.length})`);
  }
  for (const [i, r] of runs.entries()) {
    console.log(`seed run ${i + 1}: survived ${r.survivedSeconds.toFixed(0)}s · waves cleared ${r.wavesCleared} · kills ${r.kills} · final wave ${r.finalWave} · died=${r.endedByDeath} · trailing stall ${r.stalledSeconds.toFixed(0)}s · repositions=${r.teleports}`);
  }
}
