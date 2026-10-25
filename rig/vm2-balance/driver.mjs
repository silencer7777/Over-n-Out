// driver.mjs — shared headless match driver for VM2 + the swarm.
//
// Drives net/sim.js directly (the balance-probe pattern): scripted
// players with two behaviour profiles against the sim's own bot fill.
//  - turret: stationary, perfect chest tracking, LOS-gated (probe method)
//  - mobile: seeks an objective (domination zone / assault ring / nearest
//    enemy), stops inside weapon range, tracks and fires; jump/strafe
//    burst when stuck.
// Imports the game modules from an arbitrary root (a rig worktree), so
// the same driver tests any pinned commit.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DT = 1 / 30;
const NEUTRAL = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };

export async function runBotMatch({ root, modeId, mapId, seed = 1, maxTicks = 36000, players }) {
  const sim = await import(pathToFileURL(join(root, 'net/sim.js')).href);
  const wpn = await import(pathToFileURL(join(root, 'js/weapons.js')).href);
  const { createMatch, addSimPlayer, startWaveSim, stepMatch, losClear, EYE } = sim;
  const { WEAPON_ORDER, getWeapon } = wpn;

  const m = createMatch(seed, { modeId, mapId });
  const mk = (yaw, pitch, fire, wi, keys, reload = false) => ({
    t: 'input', seq: 0, keys: { ...NEUTRAL, ...(keys || {}) }, yaw, pitch, fire, reload, weapon: wi,
  });
  const ps = players.map(cfg => {
    const p = addSimPlayer(m, cfg.id, cfg.id.toUpperCase());
    p.weaponId = cfg.weapon;
    return { cfg, p, kills: 0, deaths: 0, wasAlive: true, lastPos: { x: p.pos.x, z: p.pos.z }, stuckT: 0, strafeDir: 1 };
  });
  if (modeId === 'waves') startWaveSim(m, []);

  const aimAt = (p, b) => {
    const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z;
    const dy = (b.pos.y + 1.1) - (p.pos.y + EYE);
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.max(-1.45, Math.min(1.45, Math.atan2(dy, Math.hypot(dx, dz)))) };
  };
  const nearestBot = (p, needLos) => {
    let best = null, bd = Infinity;
    for (const b of m.bots) {
      if (b.dead) continue;
      const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      if (d >= bd) continue;
      if (needLos && !losClear(p.pos.x, p.pos.y + EYE, p.pos.z, b.pos.x, b.pos.y + 1.1, b.pos.z)) continue;
      bd = d; best = b;
    }
    return best;
  };

  let modeEnd = null, waveClears = 0, peakBots = 0, botDeaths = 0, ticks = 0;
  const t0 = Date.now();
  while (m.state !== 'over' && ticks < maxTicks) {
    ticks++;
    for (const s of ps) {
      const { p, cfg } = s;
      const wi = WEAPON_ORDER.indexOf(cfg.weapon) + 1;
      if (!p.alive) { p.input = mk(0, 0, false, wi); continue; }
      const reload = p.mags[cfg.weapon] === 0;
      const wRow = getWeapon(cfg.weapon);
      if (cfg.profile === 'turret') {
        const b = nearestBot(p, true);
        if (b) {
          const a = aimAt(p, b);
          p.input = mk(a.yaw, a.pitch, wRow.auto ? true : (ticks % 2 === 0), wi, null, reload);
        } else p.input = mk(p.yaw, p.pitch, false, wi, null, reload);
      } else { // mobile
        let goal = null, stopDist = 14;
        if (modeId === 'domination') {
          let bd = Infinity;
          for (const z of (m.mode.zones || [])) {
            if (z.owner === 'you') continue;
            const d = Math.hypot(z.x - p.pos.x, z.z - p.pos.z);
            if (d < bd) { bd = d; goal = { x: z.x, z: z.z }; stopDist = Math.max(2, z.radius * 0.6); }
          }
        }
        if (!goal && modeId === 'assault' && m.world.assaultTarget) {
          const t = m.world.assaultTarget;
          goal = { x: t.x, z: t.z }; stopDist = Math.max(2, t.radius * 0.5);
        }
        const enemy = nearestBot(p, false);
        if (!goal && enemy) { goal = { x: enemy.pos.x, z: enemy.pos.z }; stopDist = wRow.bot.range * 0.7; }
        const vis = nearestBot(p, true);
        let keys = {}, yaw = p.yaw, pitch = p.pitch, fire = false;
        if (goal) {
          const dx = goal.x - p.pos.x, dz = goal.z - p.pos.z;
          yaw = Math.atan2(-dx, -dz);
          if (Math.hypot(dx, dz) > stopDist) keys.forward = true;
        }
        if (vis) {
          const a = aimAt(p, vis);
          yaw = a.yaw; pitch = a.pitch;
          const d = Math.hypot(vis.pos.x - p.pos.x, vis.pos.z - p.pos.z);
          if (d <= wRow.bot.range * 1.15) { fire = wRow.auto ? true : (ticks % 2 === 0); keys.forward = false; }
        }
        if (ticks % 30 === 0) {
          const moved = Math.hypot(p.pos.x - s.lastPos.x, p.pos.z - s.lastPos.z);
          s.stuckT = (keys.forward && moved < 0.3) ? s.stuckT + 1 : 0;
          s.lastPos = { x: p.pos.x, z: p.pos.z };
          if (s.stuckT >= 2) s.strafeDir *= -1;
        }
        if (s.stuckT >= 2) { keys.jump = true; if (s.strafeDir > 0) keys.right = true; else keys.left = true; }
        p.input = mk(yaw, pitch, fire, wi, keys, reload);
      }
    }
    const evs = [];
    stepMatch(m, DT, evs);
    let aliveBots = 0;
    for (const b of m.bots) if (!b.dead) aliveBots++;
    if (aliveBots > peakBots) peakBots = aliveBots;
    for (const ev of evs) {
      if (ev.kind === 'kill') {
        const s = ps.find(x => x.cfg.id === ev.by);
        if (s) s.kills++;
        if (!ps.some(x => x.cfg.id === ev.target)) botDeaths++;
      } else if (ev.kind === 'wave_clear') waveClears++;
      else if (ev.kind === 'mode_end') modeEnd = ev;
    }
    for (const s of ps) {
      if (s.wasAlive && !s.p.alive) s.deaths++;
      s.wasAlive = s.p.alive;
    }
    if (modeEnd) break;
  }
  const botsAliveEnd = m.bots.filter(b => !b.dead).length;
  return {
    modeId, mapId, seed, ticks, simSeconds: +(ticks / 30).toFixed(1),
    wallMs: Date.now() - t0, peakBots, botDeaths, botsAliveEnd,
    botLives: botDeaths + botsAliveEnd, waveClears,
    modeEnd: modeEnd ? { result: modeEnd.result, scoreYou: modeEnd.scoreYou, scoreThem: modeEnd.scoreThem } : null,
    finalScore: m.mode ? {
      scoreYou: m.mode.scoreYou, scoreThem: m.mode.scoreThem,
      channel: m.mode.channel != null ? +m.mode.channel.toFixed(1) : undefined,
    } : null,
    players: ps.map(s => ({ id: s.cfg.id, profile: s.cfg.profile, weapon: s.cfg.weapon, kills: s.kills, deaths: s.deaths })),
    state: m.state, endedByCap: ticks >= maxTicks && !modeEnd,
  };
}
