// trace.mjs — ASSAULT ring diagnostic (training, Wed Oct 28, 2026).
//
// A faithful copy of rig/vm2-balance/driver.mjs runBotMatch (at
// d4ea353) with READ-ONLY per-tick ring telemetry added after each
// stepMatch. Telemetry consumes no sim rng and mutates no sim state,
// so a trace run must reproduce botmatch's outcome for the same
// config EXACTLY (ticks / result / kills / deaths / final channel) —
// trace-run.mjs asserts that parity before trusting any number.
//
// The question it answers: in ASSAULT bot matches, WHO satisfies the
// sim's channel condition (net/sim.js stepAssault inRing:
// hypot(x,z to target) < radius AND |y - target.y| < 3.2), for how
// long, and what actually caps the channel — absence, elevation, or
// contest.
//
// Usage (via trace-run.mjs, or directly):
//   node scratch/assault-diag/trace.mjs --map compound --seed 11 \
//        --profile mobile --weapon ar
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DT = 1 / 30;
const NEUTRAL = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };

export async function runTraceMatch({ root, modeId, mapId, seed = 1, maxTicks = 36000, players, ringStart = false }) {
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
  // DIAGNOSTIC ONLY (ringStart): place scripted players in the ring
  // at spawn and re-place on respawn. This isolates the HOLD question
  // (can attackers keep the ring for the channel vs the escalating
  // defence?) from the PATHING question (can the driver walk there?).
  // Setting pos consumes no sim rng. Never a balance measurement of
  // the full loop — the approach march is excluded by construction.
  let teleports = 0;
  const placeInRing = (p) => {
    const t = m.world.assaultTarget;
    if (!t) return;
    p.pos = { x: t.x, y: t.y, z: t.z };
    teleports++;
  };
  if (ringStart) for (const s of ps) placeInRing(s.p);

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

  // --- telemetry state (read-only w.r.t. the sim) ---
  const T = m.world.assaultTarget;
  const tr = {
    target: T ? { x: T.x, y: T.y, z: T.z, radius: T.radius } : null,
    playerRingTicks: 0, playerXZRingTicks: 0, friendlyBotRingTicks: 0,
    defenderRingTicks: 0, contestedTicks: 0, uncontestedAttackerTicks: 0,
    channelMax: 0, playerMaxY: -Infinity, playerMaxYinXZRing: -Infinity,
    attackerMaxYinXZRing: -Infinity, playerMinXZDist: Infinity,
    firstPlayerRingTick: null, firstAnyRingTick: null,
  };
  const inXZ = (pos) => T && Math.hypot(pos.x - T.x, pos.z - T.z) < (T.radius || 3);
  const inRing = (pos) => inXZ(pos) && Math.abs(pos.y - T.y) < 3.2;

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
    // --- telemetry sample (after the step, mirrors stepAssault's view) ---
    if (T && modeId === 'assault') {
      let pIn = false, fbIn = false, defIn = false;
      for (const s of ps) {
        const p = s.p;
        if (p.pos.y > tr.playerMaxY) tr.playerMaxY = p.pos.y;
        const d = Math.hypot(p.pos.x - T.x, p.pos.z - T.z);
        if (d < tr.playerMinXZDist) tr.playerMinXZDist = d;
        if (inXZ(p.pos)) {
          tr.playerXZRingTicks++;
          if (p.pos.y > tr.playerMaxYinXZRing) tr.playerMaxYinXZRing = p.pos.y;
          if (p.pos.y > tr.attackerMaxYinXZRing) tr.attackerMaxYinXZRing = p.pos.y;
        }
        if (p.alive && inRing(p.pos)) pIn = true;
      }
      for (const b of m.bots) {
        if (b.dead) continue;
        if (inXZ(b.pos) && b.pos.y > tr.attackerMaxYinXZRing && b.team === 'you') tr.attackerMaxYinXZRing = b.pos.y;
        if (!inRing(b.pos)) continue;
        if (b.team === 'you') fbIn = true; else defIn = true;
      }
      if (pIn) { tr.playerRingTicks++; if (tr.firstPlayerRingTick === null) tr.firstPlayerRingTick = ticks; }
      if (fbIn) tr.friendlyBotRingTicks++;
      if (defIn) tr.defenderRingTicks++;
      if ((pIn || fbIn) && defIn) tr.contestedTicks++;
      if ((pIn || fbIn) && !defIn) tr.uncontestedAttackerTicks++;
      if ((pIn || fbIn) && tr.firstAnyRingTick === null) tr.firstAnyRingTick = ticks;
      if (m.mode && m.mode.channel > tr.channelMax) tr.channelMax = +m.mode.channel.toFixed(1);
    }
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
      if (ringStart && !s.wasAlive && s.p.alive) placeInRing(s.p);
      s.wasAlive = s.p.alive;
    }
    if (modeEnd) break;
  }
  const botsAliveEnd = m.bots.filter(b => !b.dead).length;
  const secs = (n) => +(n / 30).toFixed(1);
  return {
    modeId, mapId, seed, ticks, simSeconds: +(ticks / 30).toFixed(1),
    wallMs: Date.now() - t0, peakBots, botDeaths, botsAliveEnd,
    modeEnd: modeEnd ? { result: modeEnd.result } : null,
    finalChannel: m.mode && m.mode.channel != null ? +m.mode.channel.toFixed(1) : null,
    players: ps.map(s => ({ id: s.cfg.id, profile: s.cfg.profile, weapon: s.cfg.weapon, kills: s.kills, deaths: s.deaths })),
    trace: {
      target: tr.target,
      channelMax: tr.channelMax,
      playerRingSeconds: secs(tr.playerRingTicks),
      playerXZRingSeconds: secs(tr.playerXZRingTicks),
      friendlyBotRingSeconds: secs(tr.friendlyBotRingTicks),
      defenderRingSeconds: secs(tr.defenderRingTicks),
      contestedSeconds: secs(tr.contestedTicks),
      uncontestedAttackerSeconds: secs(tr.uncontestedAttackerTicks),
      playerMaxY: +tr.playerMaxY.toFixed(2),
      playerMaxYinXZRing: tr.playerMaxYinXZRing === -Infinity ? null : +tr.playerMaxYinXZRing.toFixed(2),
      attackerMaxYinXZRing: tr.attackerMaxYinXZRing === -Infinity ? null : +tr.attackerMaxYinXZRing.toFixed(2),
      playerMinXZDistToTarget: +tr.playerMinXZDist.toFixed(1),
      firstPlayerRingSecond: tr.firstPlayerRingTick === null ? null : secs(tr.firstPlayerRingTick),
      firstAnyAttackerRingSecond: tr.firstAnyRingTick === null ? null : secs(tr.firstAnyRingTick),
      teleports,
    },
  };
}
