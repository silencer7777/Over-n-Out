// v4-metrics.mjs — the 3× bar, made measurable (Odin, Chief
// Engineer). Board 004 §6 translated Brett's V4 standard — "3× as
// realistic, 3× as powerful, 3× as smooth" vs V3 — into checkable
// targets. This harness COMPUTES every target that is computable
// in a headless Node environment and reports the rest as explicit
// playtest checks for Brett (F9) — it never invents a number.
//
// What is measured, and how:
//  - Draw calls / triangles: the REAL js modules are imported
//    against the VENDORED three.js (tools/three-vendor-loader.mjs)
//    and the built scene graphs are traversed. Convention: one
//    draw call per visible renderable (Mesh / InstancedMesh /
//    Points / Line / Sprite), InstancedMesh = 1 call regardless
//    of instance count; triangles = geometry index/position
//    counts × instance count (Points/Lines contribute 0 tris).
//    This is a STATIC UPPER BOUND — frustum culling lowers the
//    live renderer count, which is why Brett's F9 numbers remain
//    the ground truth this audit is reconciled against.
//  - Sim cost: the real GameServer + LoopbackTransport + sim are
//    driven in-process (soak-style scripted clients), reporting
//    ms/tick for a 2-client config and a 4-client stress config,
//    plus max snapshot size vs the Board's ≤ 4 KB protocol cap.
//  - Gates: smoke / reachability / biome-check / soak are run as
//    subprocesses and their pass state + counts recorded.
//  - Capability counts (modes, loadout combinations, progression
//    depth, live biomes, footprint) are read from the shipped
//    data modules themselves — never from commit messages.
//  - Realism verdicts are NOT computed: they are board-recorded
//    (Phase 2 report + Board 004 §6) and carried in the table
//    below with sources. Verdict changes require a board/report.
//
// Outputs: docs/sessions/v4-metrics.json + docs/sessions/v4-metrics.md
// Exit code: 0 unless the harness itself fails to measure (budget
// breaches are reported as ⚠ lines, not crashes — the veto is
// exercised by the Chief Engineer in prose, not by tooling).

import { register } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

register('./three-vendor-loader.mjs', import.meta.url);

const ROOT = new URL('..', import.meta.url).pathname;
const out = { generatedAt: new Date().toISOString(), sections: {}, warnings: [] };
const warn = (m) => { out.warnings.push(m); console.error('⚠ ' + m); };
const ok = (m) => console.log('✓ ' + m);

// ---------- DOM shim (world.js paints canvas textures) ----------
const gradStub = { addColorStop() {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => {
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => gradStub;
    return () => undefined;
  },
  set: () => true,
});
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }),
};

// ---------- helpers ----------
function auditGraph(root) {
  let calls = 0, tris = 0, shadowCasters = 0, instancedMeshes = 0, renderables = 0;
  root.traverse((o) => {
    const renderable = o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine || o.isSprite;
    if (!renderable || o.visible === false) return;
    // three.js skips material.visible === false at render time
    // (e.g. biomes.js tree hit-proxies) — no draw call is issued.
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    if (mats.length && mats.every((m) => m.visible === false)) return;
    renderables++;
    calls++;
    if (o.castShadow) shadowCasters++;
    if (o.isInstancedMesh) instancedMeshes++;
    if (o.isPoints || o.isLine) return; // points/lines: a call, no triangles
    const g = o.geometry;
    if (!g) return;
    const idx = g.getIndex ? g.getIndex() : null;
    const pos = g.getAttribute ? g.getAttribute('position') : null;
    const triCount = idx ? idx.count / 3 : (pos ? pos.count / 3 : 0);
    tris += triCount * (o.isInstancedMesh ? (o.count || 0) : 1);
  });
  return { calls, tris: Math.round(tris), shadowCasters, instancedMeshes, renderables };
}

function runGate(script, passMarker, countChecks) {
  try {
    const stdout = execFileSync(process.execPath, [join(ROOT, 'tools', script)], {
      cwd: ROOT, encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { passed: stdout.includes(passMarker), checks: countChecks(stdout), tail: stdout.trim().split('\n').slice(-2).join(' | ') };
  } catch (e) {
    return { passed: false, checks: countChecks(e.stdout?.toString() || ''), error: (e.stderr?.toString() || e.message).slice(0, 300) };
  }
}

// ---------- gates ----------
{
  const smoke = runGate('smoke.mjs', 'SMOKE PASSED', (s) => (s.match(/✓/g) || []).length);
  const reach = runGate('reachability.mjs', 'REACHABILITY PASSED', (s) => (s.match(/✓/g) || []).length + (s.match(/^\s+PASS\s/gm) || []).length);
  const biome = runGate('biome-check.mjs', 'BIOME CHECK PASSED', (s) => (s.match(/✓/g) || []).length);
  const soakRaw = (() => {
    try {
      return execFileSync(process.execPath, [join(ROOT, 'tools/soak.mjs')], { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
    } catch (e) { return e.stdout?.toString() || ''; }
  })();
  const soak = {
    passed: soakRaw.includes('SOAK PASSED'),
    losUsPerRay: parseFloat(soakRaw.match(/S9 LOS profile: ([\d.]+) µs/)?.[1] ?? 'NaN'),
    simMsPerTick: parseFloat(soakRaw.match(/S10 sim cost: ([\d.]+) ms/)?.[1] ?? 'NaN'),
  };
  out.sections.gates = { smoke, reachability: reach, biomeCheck: biome, soak };
  ok(`gates: smoke ${smoke.passed ? 'PASS' : 'FAIL'} (${smoke.checks} checks), reachability ${reach.passed ? 'PASS' : 'FAIL'} (${reach.checks}), biome ${biome.passed ? 'PASS' : 'FAIL'} (${biome.checks}), soak ${soak.passed ? 'PASS' : 'FAIL'} (LOS ${soak.losUsPerRay} µs/ray, sim ${soak.simMsPerTick} ms/tick)`);
}

// ---------- scene audit (draw calls / triangles) ----------
{
  const THREE = await import('../vendor/three.module.js');
  const { buildWorld } = await import('../js/world.js');
  const { applyBiome, BIOMES } = await import('../js/biomes.js');
  const { Bot } = await import('../js/bots.js');
  const { buildViewmodelGun } = await import('../js/gunmodels.js');
  const { WEAPON_ORDER } = await import('../js/weapons.js');

  const worldScene = new THREE.Scene();
  const world = buildWorld(worldScene);
  const compound = auditGraph(worldScene);

  const biomeAudits = {};
  for (const b of BIOMES) {
    if (b.id === 'compound') continue;
    const s = new THREE.Scene();
    const w = buildWorld(s);
    const ctx = { scene: s, colliders: [...w.colliders], shootables: [...w.shootables] };
    const placed = applyBiome(b.id, ctx);
    biomeAudits[b.id] = placed ? auditGraph(s) : null;
  }

  // Per-bot cost, by weapon (fresh scene per bot; world shared).
  const botByWeapon = {};
  for (const wid of WEAPON_ORDER) {
    const s = new THREE.Scene();
    new Bot(s, world, new THREE.Vector3(0, 0, 0), 1, wid);
    botByWeapon[wid] = auditGraph(s);
  }
  const worstBot = Object.values(botByWeapon).reduce((a, b) => (b.tris > a.tris ? b : a));
  const botCalls = botByWeapon[WEAPON_ORDER[0]].calls; // 7 for every weapon (3 hit meshes + visor + gun + 2 sprites)

  // Viewmodel cost, by weapon (worst = the one Brett holds).
  const vmByWeapon = {};
  for (const wid of WEAPON_ORDER) {
    const { group } = buildViewmodelGun(wid);
    vmByWeapon[wid] = auditGraph(group);
  }
  const worstVm = Object.values(vmByWeapon).reduce((a, b) => (b.tris > a.tris ? b : a));

  // Pickups: main.js makePickupMesh = group of 2 meshes, cap 3
  // active (read from js/main.js — not importable headlessly).
  const PICKUP_CALLS = 3 * 2, PICKUP_TRIS_ALLOWANCE = 600; // 3 × (base + lid), small geoms
  const EXPLOSION_CALLS = 1; // pooled blast visual, transient (Phase 2 accounting)

  const compose = (staticAudit) => {
    const sustained = {
      calls: staticAudit.calls + 9 * botCalls + worstVm.calls + PICKUP_CALLS,
      tris: staticAudit.tris + 9 * worstBot.tris + worstVm.tris + PICKUP_TRIS_ALLOWANCE,
    };
    return { static: staticAudit, sustained, inclTransients: { calls: sustained.calls + EXPLOSION_CALLS, tris: sustained.tris } };
  };

  out.sections.sceneAudit = {
    convention: 'static scene-graph traversal vs vendored three; 1 call per visible renderable; tris = (index|position)/3 × instances; upper bound (no frustum culling)',
    compound: compose(compound),
    forest: biomeAudits.forest ? compose(biomeAudits.forest) : null,
    snow: biomeAudits.snow ? compose(biomeAudits.snow) : null,
    botByWeapon, worstBotTris: worstBot.tris, botCalls,
    viewmodelByWeapon: vmByWeapon, worstViewmodelTris: worstVm.tris,
    budgets: { v4CallsLine: 165, v4TrisLine: 300000, v3CallsLineWas: 150 },
  };
  const c = out.sections.sceneAudit.compound.sustained;
  ok(`scene audit: compound sustained worst case ${c.calls} calls / ${c.tris} tris (9 bots + viewmodel + pickups); forest ${out.sections.sceneAudit.forest?.sustained.calls} calls; snow ${out.sections.sceneAudit.snow?.sustained.calls} calls`);
  if (c.calls > 165) warn(`compound sustained draw calls ${c.calls} exceed the V4 line (165)`);
}

// ---------- sim bench (in-process, soak-style drivers) ----------
{
  const { GameServer, LoopbackTransport } = await import('../net/server.js');
  const { MSG } = await import('../net/protocol.js');
  const { NEUTRAL_INPUT } = await import('../net/sim.js');

  function bench({ clients, maxTicks, label, windowWave = null, windowTicks = 1500 }) {
    const server = new GameServer();
    const transport = new LoopbackTransport();
    server.attachTransport(transport);
    // NB: room codes are exactly 4 chars in the protocol — a longer
    // code silently lands clients in 'LOBBY' instead (found by this
    // bench's first run; asserted below via welcome/snapshot counts).
    const room = server.createRoom('ODIN');
    const boxes = [], handles = [];
    let snapshotsReceived = 0;
    for (let i = 0; i < clients; i++) {
      const inbox = { snapshots: [], welcome: null };
      const h = transport.connect('p' + i, (msg) => {
        if (msg.t === MSG.SNAPSHOT) { inbox.snapshots.push(msg); snapshotsReceived++; }
        else if (msg.t === MSG.WELCOME) inbox.welcome = msg;
      });
      h.send({ t: MSG.HELLO, protocol: 1, name: 'P' + i, room: 'ODIN' });
      boxes.push(inbox); handles.push(h);
    }
    let seq = 0, maxSnapBytes = 0, maxAlive = 0, maxWave = 0;
    let wStart = null, wTick0 = 0, windowMsPerTick = null;
    const t0 = performance.now();
    let ticksRun = 0;
    for (let i = 0; i < maxTicks; i++) {
      for (let c = 0; c < clients; c++) {
        const inbox = boxes[c];
        if (inbox.snapshots.length > 4) inbox.snapshots.splice(0, inbox.snapshots.length - 1);
        const snap = inbox.snapshots[inbox.snapshots.length - 1];
        let yaw = 0, pitch = 0, fire = false;
        if (snap) {
          maxSnapBytes = Math.max(maxSnapBytes, JSON.stringify(snap).length);
          const me = snap.players.find((p) => p.id === 'p' + c);
          const bot = snap.bots.find((b) => !b.dead);
          if (me && bot) {
            const dx = bot.pos[0] - me.pos[0], dz = bot.pos[2] - me.pos[2];
            const dy = (bot.pos[1] + 1.1) - (me.pos[1] + 1.66);
            yaw = Math.atan2(-dx, -dz);
            pitch = Math.max(-1.45, Math.min(1.45, Math.atan2(dy, Math.hypot(dx, dz))));
            fire = true;
          }
        }
        seq++;
        // Soak-runner movement pattern: stationary clients get shot
        // and end the match early, which truncates the cost window.
        const phase = Math.floor(i / 30) % 4;
        const keys = { forward: true, back: false, left: phase === 1, right: phase === 3, sprint: phase === 2, jump: i % 47 === 0 };
        handles[c].send({ t: MSG.INPUT, seq, forTick: room.tick + 1, keys, yaw, pitch, fire, reload: i % 211 === 0, weapon: 1 });
      }
      server.step();
      ticksRun = room.tick;
      const m = room.match;
      if (m) {
        maxWave = Math.max(maxWave, m.wave);
        maxAlive = Math.max(maxAlive, m.bots.filter((b) => !b.dead).length);
        if (windowWave !== null && wStart === null && m.wave >= windowWave) { wStart = performance.now(); wTick0 = room.tick; }
        if (wStart !== null && windowMsPerTick === null && room.tick - wTick0 >= windowTicks) {
          windowMsPerTick = (performance.now() - wStart) / (room.tick - wTick0);
        }
        if (m.state === 'over') break;
      }
    }
    const totalMs = performance.now() - t0;
    return {
      label, clients, ticks: ticksRun,
      sanity: {
        welcomesReceived: boxes.filter((b) => b.welcome).length,
        matchBooted: !!(room.match && room.match.state),
        snapshotsReceived,
      },
      msPerTickAvg: +(totalMs / Math.max(1, ticksRun)).toFixed(3),
      windowMsPerTick: windowMsPerTick === null ? null : +windowMsPerTick.toFixed(3),
      maxWave, maxAliveBots: maxAlive, maxSnapshotBytes: maxSnapBytes,
      snapshotCapBytes: 4096, snapshotWithinCap: maxSnapBytes <= 4096,
    };
  }

  const standard = bench({ clients: 2, maxTicks: 4500, label: 'soak-parity (2 scripted clients)' });
  const stress = bench({ clients: 4, maxTicks: 20000, label: 'stress (4 scripted clients, window at wave ≥ 5 = alive cap 9)', windowWave: 5, windowTicks: 1200 });
  for (const b of [standard, stress]) {
    if (b.sanity.welcomesReceived !== b.clients || !b.sanity.matchBooted || b.sanity.snapshotsReceived === 0) {
      warn(`sim bench "${b.label}" sanity FAILED (welcomes ${b.sanity.welcomesReceived}/${b.clients}, matchBooted ${b.sanity.matchBooted}, snapshots ${b.sanity.snapshotsReceived}) — its cost numbers are not trustworthy`);
    }
  }
  out.sections.simBench = { standard, stress, boardBar: '≤ 0.5 ms/tick (Board 004 §6)' };
  ok(`sim bench: standard ${standard.msPerTickAvg} ms/tick (max snapshot ${standard.maxSnapshotBytes} B); stress ${stress.msPerTickAvg} ms/tick avg, window ${stress.windowMsPerTick} ms/tick, max alive bots ${stress.maxAliveBots}, max snapshot ${stress.maxSnapshotBytes} B`);
  if (!stress.snapshotWithinCap) warn(`stress max snapshot ${stress.maxSnapshotBytes} B exceeds the 4 KB protocol cap`);
}

// ---------- capability counts (from the shipped data modules) ----------
{
  const caps = {};
  try {
    const modes = await import('../js/modes.js');
    caps.modes = { count: modes.MODES.length, ids: modes.MODES.map((m) => m.id), target: 4 };
  } catch { caps.modes = { count: 1, ids: ['waves (implicit, pre-js/modes.js)'], target: 4 }; }
  try {
    const lo = await import('../js/loadouts.js');
    caps.loadouts = {
      combinations: lo.countLoadoutCombinations(),
      attachments: lo.ATTACHMENTS.length,
      slots: lo.SLOTS.length, maxClasses: lo.MAX_CLASSES,
      lethals: lo.LETHALS, tacticals: lo.TACTICALS, target: 500,
    };
  } catch { caps.loadouts = { combinations: 5, note: 'js/loadouts.js not present — V3 baseline (weapons only)', target: 500 }; }
  try {
    const pr = await import('../js/progression.js');
    caps.progression = {
      maxLevel: pr.MAX_LEVEL,
      unlockEntries: pr.UNLOCKS.length,
      topUnlockLevel: Math.max(...pr.UNLOCKS.map((u) => u.level)),
      classSlotsAtMax: pr.unlockedClassSlots(pr.MAX_LEVEL),
      targetNote: 'Board 004 §6: 18 levels / 13 unlocks',
    };
  } catch { caps.progression = { maxLevel: 0, unlockEntries: 0, note: 'js/progression.js not present — V3 baseline' }; }
  const { BIOMES } = await import('../js/biomes.js');
  const { BOUNDS } = await import('../js/worlddata.js');
  caps.maps = {
    biomes: BIOMES.map((b) => ({ id: b.id, status: b.status })),
    liveCount: BIOMES.filter((b) => b.status === 'live').length,
    footprintAcrossM: BOUNDS * 2, targetFootprintAcrossM: 124, targetLive: 4,
  };
  out.sections.capabilities = caps;
  ok(`capabilities: modes ${caps.modes.count}, loadout combinations ${caps.loadouts.combinations}, progression ${caps.progression.unlockEntries} unlock entries to L${caps.progression.topUnlockLevel} (cap L${caps.progression.maxLevel}), live biomes ${caps.maps.liveCount}, footprint ${caps.maps.footprintAcrossM} m`);
  if (caps.progression.unlockEntries && caps.progression.unlockEntries !== 13) {
    warn(`SPEC DRIFT (progression): js/progression.js ships ${caps.progression.unlockEntries} unlock entries vs Board 004 §4's ruled ladder of 13 — the module adds HOLO SIGHT (L11) and SUPPRESSOR (L17), and MAX_LEVEL ${caps.progression.maxLevel} leaves L${caps.progression.topUnlockLevel + 1}–${caps.progression.maxLevel} with no rewards. Flagged in commit f19f0b3 as coordinator assumptions pending Havoc's design pack; Havoc/Board must reconcile (amend the ladder or trim the module). Not a code defect.`);
  }
}

// ---------- realism verdicts (board-recorded, NOT computed) ----------
// Sources: V3 Phase 2 report (guns/characters/lighting/world PASS at
// the V3 bar) + Board 004 §6 (the 10-feature V4 table, target ≥ 8
// PASS). V4 verdicts stay PENDING until a board/report records
// them — this table changes only with a cited source.
out.sections.realismVerdicts = {
  target: '≥ 8 of 10 features PASS (Board 004 §6)',
  features: [
    { id: 'guns', v3: 'PASS', v4: 'PENDING', source: 'Phase 2 report (Ricci/Dvorak, Verity)' },
    { id: 'characters', v3: 'PASS', v4: 'PENDING — Atlas soldier rebuild', source: 'Phase 2 report' },
    { id: 'lighting', v3: 'PASS — owner re-test Oct 24 ("way better… looks good how it is"); Phase 2 grade is the LOCKED V4 baseline (improve-only, never darker)', v4: 'PENDING', source: 'Brett playtest verdict, Oct 24; Phase 2 report' },
    { id: 'world', v3: 'PASS', v4: 'PENDING — Atlas ring/biomes', source: 'Phase 2 report' },
    { id: 'modes presentation', v3: '—', v4: 'PENDING', source: 'Board 004 §6 (new in V4)' },
    { id: 'soldiers-uniform discipline', v3: '—', v4: 'PENDING', source: 'Board 004 §6 (new in V4)' },
    { id: 'landscape/biome surfaces', v3: '—', v4: 'PENDING', source: 'Board 004 §6 (new in V4)' },
    { id: 'audio believability', v3: '—', v4: 'PENDING', source: 'Board 004 §6 (new in V4)' },
    { id: 'loadout presentation', v3: '—', v4: 'PENDING', source: 'Board 004 §6 (new in V4)' },
    { id: 'HUD consistency', v3: '—', v4: 'PENDING', source: 'Board 004 §6 (new in V4)' },
  ],
  v3PassCount: 4,
};

// ---------- git stamp ----------
try {
  out.head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
} catch { out.head = 'unknown'; }

// ---------- write outputs ----------
writeFileSync(join(ROOT, 'docs/sessions/v4-metrics.json'), JSON.stringify(out, null, 2) + '\n');

const S = out.sections;
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : n);
const md = `# Over n' Out — V4 Metrics (the 3× bar, measured)

Generated: ${out.generatedAt} · git HEAD: ${out.head} · Tool:
\`node tools/v4-metrics.mjs\` (Odin, Chief Engineer)

Brett's V4 standard (Board 004 §6): **3× as realistic, 3× as
powerful, 3× as smooth** vs V3. Everything below is computed from
the shipped code in this environment; anything this environment
cannot measure is listed as an exact F9 playtest check for Brett —
no number here is invented.

## Gates (independent re-run)

| Gate | Result | Count |
| --- | --- | --- |
| Smoke | ${S.gates.smoke.passed ? '✅ PASS' : '❌ FAIL'} | ${S.gates.smoke.checks} checks |
| Reachability | ${S.gates.reachability.passed ? '✅ PASS' : '❌ FAIL'} | ${S.gates.reachability.checks} checks |
| Biome check | ${S.gates.biomeCheck.passed ? '✅ PASS' : '❌ FAIL'} | ${S.gates.biomeCheck.checks} checks |
| Soak | ${S.gates.soak.passed ? '✅ PASS' : '❌ FAIL'} | LOS ${S.gates.soak.losUsPerRay} µs/ray · sim ${S.gates.soak.simMsPerTick} ms/tick |

## 3× SMOOTH — draw calls & triangles (static scene-graph audit)

Convention: ${S.sceneAudit.convention}. Composition: static world
\+ 9 bots (alive cap) with the heaviest weapon + heaviest
viewmodel + 3 pickups. V4 lines (Board 004 §6): **≤ 165 calls /
≤ 300k tris** (V3's line was 150 calls).

| Scene | Static calls | Static tris | Sustained worst case | + transients |
| --- | --- | --- | --- | --- |
| Compound | ${S.sceneAudit.compound.static.calls} | ${fmt(S.sceneAudit.compound.static.tris)} | **${S.sceneAudit.compound.sustained.calls} calls / ${fmt(S.sceneAudit.compound.sustained.tris)} tris** | ${S.sceneAudit.compound.inclTransients.calls} calls |
| Forest | ${S.sceneAudit.forest?.static.calls} | ${fmt(S.sceneAudit.forest?.static.tris)} | **${S.sceneAudit.forest?.sustained.calls} calls / ${fmt(S.sceneAudit.forest?.sustained.tris)} tris** | ${S.sceneAudit.forest?.inclTransients.calls} calls |
| Snow (scaffold) | ${S.sceneAudit.snow?.static.calls} | ${fmt(S.sceneAudit.snow?.static.tris)} | **${S.sceneAudit.snow?.sustained.calls} calls / ${fmt(S.sceneAudit.snow?.sustained.tris)} tris** | ${S.sceneAudit.snow?.inclTransients.calls} calls |

Per-bot: ${S.sceneAudit.botCalls} calls each; heaviest bot
${fmt(S.sceneAudit.worstBotTris)} tris. Heaviest viewmodel
${fmt(S.sceneAudit.worstViewmodelTris)} tris. Shadow-caster
renderables (compound static): ${S.sceneAudit.compound.static.shadowCasters}
— these render a second time into the shadow map at L0–L2, which
is what the quality scaler sheds first.

## 3× SMOOTH — server sim cost (in-process bench)

| Config | ms/tick (avg) | ms/tick (hot window) | Max wave | Max alive bots | Max snapshot |
| --- | --- | --- | --- | --- | --- |
| ${S.simBench.standard.label} | ${S.simBench.standard.msPerTickAvg} | — | ${S.simBench.standard.maxWave} | ${S.simBench.standard.maxAliveBots} | ${S.simBench.standard.maxSnapshotBytes} B |
| ${S.simBench.stress.label} | ${S.simBench.stress.msPerTickAvg} | ${S.simBench.stress.windowMsPerTick ?? 'window not reached'} | ${S.simBench.stress.maxWave} | ${S.simBench.stress.maxAliveBots} | ${S.simBench.stress.maxSnapshotBytes} B |

Board bar: **≤ 0.5 ms/tick**; snapshot cap **≤ 4,096 B** at
20 Hz. ⚠ Spec note: Board 004 §6 phrases the bar as "8 players +
12 bots" — the shipped rules field at most **4 humans** (Board
004 §2, M4 scope) and a **9-bot alive cap** (sim + main.js), so
the bar's config cannot be fielded as written. The stress bench
above measures the real caps; the Board should restate the bar
against them. (Filed by Odin; not a code defect.)

## 3× POWERFUL — capability counts (from the data modules)

| Capability | V3 | Now | V4 target |
| --- | --- | --- | --- |
| Game modes | 1 | **${S.capabilities.modes.count}** (${S.capabilities.modes.ids.join(', ')}) | 4 |
| Loadout combinations | 5 | **${fmt(S.capabilities.loadouts.combinations)}** | ≥ 500 |
| Progression | none | **${S.capabilities.progression.unlockEntries} unlock entries, top at L${S.capabilities.progression.topUnlockLevel}, level cap L${S.capabilities.progression.maxLevel}** | 18 levels / 13 unlocks (Board 004 §6) |
| Live biomes | 2 | **${S.capabilities.maps.liveCount}** (${S.capabilities.maps.biomes.map((b) => b.id + ':' + b.status).join(', ')}) | 4 |
| Playable footprint | 94 m | **${S.capabilities.maps.footprintAcrossM} m across** | 124 m across |

## 3× REALISTIC — Verity verdicts (board-recorded, not computed)

V3 ended with **4 features at the bar**; V4 target **≥ 8 of 10**.
Verdicts change only when a board/report records them.

${S.realismVerdicts.features.map((f) => `- **${f.id}** — V3: ${f.v3} · V4: ${f.v4} _(${f.source})_`).join('\n')}

## Brett's F9 playtest checks (the GPU truth this env cannot take)

Run on the V4 build when it ships (F9 toggles the meter; it shows
FPS · frame ms · 1% LOW · CALLS · TRIS):

1. **Compound, Wave Defense, wave ≥ 6** (9 bots alive): record
   CALLS, TRIS, FPS, 1% LOW. Audit predicts ≈
   ${S.sceneAudit.compound.sustained.calls} calls /
   ${fmt(S.sceneAudit.compound.sustained.tris)} tris before
   culling — live CALLS should land at or below that.
2. **Forest biome, same wave pressure**: record the same four
   numbers (audit: ≈ ${S.sceneAudit.forest?.sustained.calls}
   calls / ${fmt(S.sceneAudit.forest?.sustained.tris)} tris).
3. **Smoothness witness**: hold a fight in each biome for ~30 s;
   the 1% LOW is the smoothness number — and if FPS sags under
   50, the quality scaler should visibly step (L0→L1→L2) rather
   than stutter. Note the level it settles at.
4. **Online (once Vega's transport lands)**: two clients in one
   room; motion of the other player should read smooth at 20 Hz
   snapshots — no rubber-banding at room scale.

${out.warnings.length ? '## ⚠ Warnings from this run\n\n' + out.warnings.map((w) => '- ' + w).join('\n') + '\n' : ''}`;
writeFileSync(join(ROOT, 'docs/sessions/v4-metrics.md'), md);
console.log('\nMETRICS WRITTEN: docs/sessions/v4-metrics.json + docs/sessions/v4-metrics.md');
