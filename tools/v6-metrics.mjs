// v6-metrics.mjs — V6's bars, made measurable (Odin, Chief
// Engineer). Successor to tools/v5-metrics.mjs. Brett's V6 order
// (charter, Oct 24 2026): "just a better version of 5" — GRAPHICS
// FIRST. His play verdict on live V5: lighting "way better
// already and is probably perfect" (LIGHTING IS LOCKED by play
// verdict — this harness does NOT re-grade lighting; it carries
// an integrity check that the locked code is untouched), and
// graphics are "pretty blocky" — he wants "smoothness and
// realness… trees like trees, buildings like actual buildings…
// par and then some." Board 006 translated that into checkable
// detail bars (§2) and perf bars (§2.6); this harness measures
// them. Minimum 20 updates land under V6 before V7 may be
// proposed; this tool is the patrol instrument for every one.
//
// What is new vs the V5 harness:
//  - GRAPHICS DETAIL AUDIT per map, on BOTH scene families:
//    the CLIENT path (buildWorld + applyBiome — what Brett's
//    browser renders today) and the LAYOUT path (buildMapLayout
//    distinct scenes — data-true, not yet client-wired for
//    forest/snow/mars at baseline; maps.js still flags them
//    'transition'). Per scene: draw calls, triangles, vertices,
//    shadow casters + caster tris (the shadow pass renders them
//    again), instanced-mesh share of static tris, flat-shaded
//    tri share (the faceted "blocky" read, quantified), textured
//    tri share, texture inventory (unique count, resolutions,
//    texels, estimated VRAM), untextured surface area (Board
//    §2.5 strike), instanced-mesh inventory with primitive
//    segment parameters (trunk/canopy segment density), and the
//    top renderables by tris.
//  - VEGETATION SCORECARD (Board §2.1 predicates): tree count,
//    foliage masses per tree, trunk taper/smooth-shading/bark
//    texture, foliage texture presence, per-instance colour
//    variation coverage on instanced vegetation.
//  - SOLDIERS: per-soldier calls/tris/verts/casters + flat-share
//    (Update 4's "part-kit read" quantified); camo zero-delta
//    proof carried from V5 (standing veto).
//  - LIGHTING INTEGRITY (replaces the V5 readability model):
//    sha256 of js/lighting.js + the exposure and shadow-map
//    literals in js/main.js, compared against the values
//    recorded at the V6 baseline. A mismatch warns LIGHTING
//    TOUCHED — the grade is locked by the owner's play verdict
//    and only Brett unlocks it. No floors, no proxies, no
//    re-grading: that court has adjourned.
//  - MOBILE STRIKE DATA (Board 006 Addendum A): quality-tier
//    source-read (DPR caps, shadow sizes per tier) so the
//    mobile target can be struck from evidence.
//
// Carried from V5 unchanged in method: gates (smoke /
// reachability / per-map reachability / biome-check / ws-soak /
// soak parse), sustained-accounting formula (static + 9 bots +
// worst viewmodel + pickup allowance), equipment + streak
// reserves in the grand worst case, equipment audit, sim bench,
// capabilities. Continuity is deliberate: V5's lines stay
// comparable across the version boundary.
//
// Honest limits (also in docs/sessions/v6-metrics.md): there is
// no GPU in this environment. Draw calls / tris / textures are
// exact counts of the built scene graphs (no-culling bound —
// frustum culling only helps in the real renderer). Surface
// areas are computed from geometry and ignore per-instance
// scale (instance scales run ~0.7–1.5, so read areas as
// ±half-an-order, fine for a 25 m² strike). Texture dimensions
// are the canvas sizes the painters assign — identical in the
// browser; VRAM assumes RGBA8 + full mip chain. Brett's eyes +
// F9 on his own hardware remain the final court (Board §2.6).
//
// Usage: node tools/v6-metrics.mjs [--fast] [--compare <old.json>]
//   --fast     skip gates + sim bench (scene audits only)
//   --compare  add per-map call/tri/shadow deltas vs a prior
//              v6-metrics.json (the patrol diff)
// Outputs: docs/sessions/v6-metrics.json (curated bars and the
// baseline narrative live in docs/sessions/v6-metrics.md).
// Exit code: 0 unless the harness itself fails to measure (bar
// breaches are ⚠ warnings — the veto is prose, not tooling).

import { register } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

register('./three-vendor-loader.mjs', import.meta.url);

const ROOT = new URL('..', import.meta.url).pathname;
const FAST = process.argv.includes('--fast');
const cmpIdx = process.argv.indexOf('--compare');
const COMPARE = cmpIdx >= 0 ? process.argv[cmpIdx + 1] : null;
const out = { tool: 'v6-metrics', generatedAt: new Date().toISOString(), sections: {}, warnings: [] };
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

// ---------- the bars (Board 006; strikes published in v6-metrics.md) ----------
const BARS = {
  drawCallsPerMap: 165,          // §2.6 VETO — sustained worst case, no-culling bound (V5 line, held)
  trisPerMap: 300000,            // §2.6 VETO — sustained worst case (V5 line, held; baseline publishes no evidence to move it)
  shadowPassCallsWarn: 340,      // advisory — shadow pass ≈ a second scene render; casters render twice (§2.6: priced first)
  textureVramWarnMB: 256,        // advisory — mobile-safe texture ceiling (RGBA8 + mips)
  forestInstancedShareMin: 0.5,  // §3 strategy — vegetation detail must be instancing-bought, not mesh-bought
  untexturedMeshStrikeM2: 25,    // §2.5 STRIKE (Odin, this baseline) — no single untextured static mesh > 25 m² survives Update 5
  simMsPerTick: 0.5,             // carried V5 bar (Board 004 §6)
  snapshotCapBytes: 4096,        // carried V5 protocol cap
  equipmentReserve: {            // carried V5 (measured in V5, held as caps)
    totalCalls: 32,
    smoke: { maxActiveVolumes: 4, callsPerVolume: 6, calls: 24 },
    remoteFigures: { count: 3, callsEach: 7, calls: 21 },
  },
  streakReserve: { totalCalls: 17, uav: { calls: 6 } },
};

// ---------- lighting integrity (Board V6-1b: LOCKED by play verdict) ----------
// Recorded at the V6 baseline (HEAD e807560; js/lighting.js is
// byte-identical to live V5 HEAD 3d60275). Any drift means the
// locked grade was touched — warn, never silently re-grade.
const LIGHTING_BASELINE = {
  lightingJsSha256_16: 'a40a3f79c85670a6',
  exposureLiteral: 1.10,         // js/main.js toneMappingExposure source-read
  shadowMapSize: 4096,           // js/main.js shadow.mapSize source-read
};

// ---------- helpers ----------
function triArea(pos, i0, i1, i2) {
  const ax = pos.getX(i0), ay = pos.getY(i0), az = pos.getZ(i0);
  const bx = pos.getX(i1) - ax, by = pos.getY(i1) - ay, bz = pos.getZ(i1) - az;
  const cx = pos.getX(i2) - ax, cy = pos.getY(i2) - ay, cz = pos.getZ(i2) - az;
  const ux = by * cz - bz * cy, uy = bz * cx - bx * cz, uz = bx * cy - by * cx;
  return 0.5 * Math.sqrt(ux * ux + uy * uy + uz * uz);
}
function geomTris(g) {
  if (!g) return 0;
  const idx = g.getIndex ? g.getIndex() : null;
  const pos = g.getAttribute ? g.getAttribute('position') : null;
  return idx ? idx.count / 3 : (pos ? pos.count / 3 : 0);
}
function geomArea(g) {
  if (!g) return 0;
  const pos = g.getAttribute ? g.getAttribute('position') : null;
  if (!pos) return 0;
  const idx = g.getIndex ? g.getIndex() : null;
  let area = 0;
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i + 2 < n; i += 3) {
    area += triArea(pos, idx ? idx.getX(i) : i, idx ? idx.getX(i + 1) : i + 1, idx ? idx.getX(i + 2) : i + 2);
  }
  return area;
}
const SEG_PARAMS = ['radiusTop', 'radiusBottom', 'height', 'radialSegments', 'heightSegments', 'widthSegments', 'radius', 'detail', 'width', 'depth'];
function segParams(g) {
  const p = g?.parameters;
  if (!p) return null;
  const o = {};
  for (const k of SEG_PARAMS) if (typeof p[k] === 'number') o[k] = Math.round(p[k] * 100) / 100;
  return Object.keys(o).length ? o : null;
}
const matsOf = (o) => (Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []));

// Extended scene audit: V5's counts plus the V6 detail facts.
function auditGraphX(root, { records = false } = {}) {
  let calls = 0, tris = 0, verts = 0, shadowCasters = 0, casterTris = 0;
  let instancedMeshes = 0, instances = 0, instancedTris = 0, flatTris = 0, texturedTris = 0, renderables = 0;
  let largestUntextured = null; // { tris, area, geo, name }
  let strikeCandidate = null;
  const recs = [];
  root.traverse((o) => {
    const renderable = o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine || o.isSprite;
    if (!renderable || o.visible === false) return;
    const mats = matsOf(o);
    if (mats.length && mats.every((m) => m.visible === false)) return;
    renderables++;
    calls++;
    const count = o.isInstancedMesh ? (o.count || 0) : 1;
    if (o.isInstancedMesh) { instancedMeshes++; instances += count; }
    if (o.castShadow) shadowCasters++;
    if (o.isPoints || o.isLine) return;
    const g = o.geometry;
    if (!g) return;
    const tEach = geomTris(g);
    const t = tEach * count;
    tris += t;
    const pos = g.getAttribute ? g.getAttribute('position') : null;
    if (pos) verts += pos.count * count;
    if (o.castShadow) casterTris += t;
    if (o.isInstancedMesh) instancedTris += t;
    const flat = mats.some((m) => m && m.flatShading);
    const textured = mats.some((m) => m && m.map);
    if (flat) flatTris += t;
    if (textured) texturedTris += t;
    // §2.5 strike candidates: largest single untextured surfaces.
    // BackSide-only renderables (sky domes) are excluded — a
    // gradient backdrop is not a flat-colour surface. The strike
    // itself is scoped to surfaces a player can stand next to
    // (<= 50,000 m²); backdrop-scale geometry (the 263k m²
    // horizon disc) is recorded separately, not strike-tested.
    if (!textured && !o.isInstancedMesh && !mats.every((m) => m && m.side === 2)) {
      const area = geomArea(g);
      const rec = { tris: Math.round(t), area: Math.round(area * 10) / 10, geo: g.type ?? 'BufferGeometry', name: o.name || undefined };
      if (!largestUntextured || area > largestUntextured.area) largestUntextured = rec;
      if (area <= 50000 && (!strikeCandidate || area > strikeCandidate.area)) strikeCandidate = rec;
    }
    if (records) {
      recs.push({
        kind: o.isInstancedMesh ? 'instanced' : 'mesh',
        geo: g.type ?? 'BufferGeometry',
        params: segParams(g),
        count, trisEach: Math.round(tEach), tris: Math.round(t),
        flat, textured, castShadow: !!o.castShadow,
        instanceColor: o.isInstancedMesh ? !!o.instanceColor : undefined,
        name: o.name || undefined,
      });
    }
  });
  const r = {
    calls, tris: Math.round(tris), verts, shadowCasters, casterTris: Math.round(casterTris),
    instancedMeshes, instances, instancedTris: Math.round(instancedTris),
    instancedShare: tris > 0 ? +(instancedTris / tris).toFixed(3) : 0,
    flatTris: Math.round(flatTris), flatShare: tris > 0 ? +(flatTris / tris).toFixed(3) : 0,
    texturedTris: Math.round(texturedTris), texturedShare: tris > 0 ? +(texturedTris / tris).toFixed(3) : 0,
    largestUntexturedMesh: largestUntextured,
    strikeCandidateMesh: strikeCandidate,
    renderables,
  };
  if (records) r.records = recs;
  return r;
}

// Texture inventory of a scene: unique textures by identity,
// with the canvas dimensions the painters assigned.
const TEX_PROPS = ['map', 'alphaMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'bumpMap'];
function textureAudit(root) {
  const tex = new Map(); // uuid -> record
  const mats = new Set();
  root.traverse((o) => {
    for (const m of matsOf(o)) {
      if (!m || mats.has(m.uuid)) continue;
      mats.add(m.uuid);
      for (const p of TEX_PROPS) {
        const t = m[p];
        if (t && t.isTexture) {
          const img = t.image ?? {};
          const w = typeof img.width === 'number' ? img.width : null;
          const h = typeof img.height === 'number' ? img.height : null;
          const prev = tex.get(t.uuid) ?? { w, h, texels: (w && h) ? w * h : null, slots: [] };
          if (!prev.slots.includes(p)) prev.slots.push(p);
          tex.set(t.uuid, prev);
        }
      }
    }
  });
  const list = [...tex.values()];
  const totalTexels = list.reduce((a, t) => a + (t.texels ?? 0), 0);
  const byRes = {};
  for (const t of list) { const k = t.w ? `${t.w}x${t.h}` : 'unknown'; byRes[k] = (byRes[k] ?? 0) + 1; }
  return {
    uniqueTextures: list.length,
    materials: mats.size,
    totalTexels,
    estVramMB: Math.round(totalTexels * 4 * (4 / 3) / 1e6 * 10) / 10, // RGBA8 + mip chain
    byResolution: byRes,
    textures: list.sort((a, b) => (b.texels ?? 0) - (a.texels ?? 0)).slice(0, 24),
  };
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
if (FAST) {
  out.sections.gates = { skipped: '--fast' };
  ok('gates: SKIPPED (--fast)');
} else {
  const count = (s) => (s.match(/✓/g) || []).length;
  const gates = {
    smoke: runGate('smoke.mjs', 'SMOKE PASSED', count),
    reachability: runGate('reachability.mjs', 'REACHABILITY PASSED',
      (s) => count(s) + (s.match(/^\s+PASS\s/gm) || []).length),
    biomeCheck: runGate('biome-check.mjs', 'BIOME CHECK PASSED', count),
    wsSoak: runGate('ws-soak.mjs', 'WS SOAK PASSED', count),
  };
  const soakRaw = (() => {
    try {
      return execFileSync(process.execPath, [join(ROOT, 'tools/soak.mjs')], { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
    } catch (e) { return e.stdout?.toString() || ''; }
  })();
  gates.soak = {
    passed: soakRaw.includes('SOAK PASSED'),
    losUsPerRay: parseFloat(soakRaw.match(/S9 LOS profile: ([\d.]+) µs/)?.[1] ?? 'NaN'),
    simMsPerTick: parseFloat(soakRaw.match(/S10 sim cost: ([\d.]+) ms/)?.[1] ?? 'NaN'),
  };
  const perMap = {};
  for (const f of readdirSync(join(ROOT, 'tools'))) {
    const m = f.match(/^reachability-([a-z0-9-]+)\.mjs$/);
    if (m) perMap[m[1]] = runGate(f, 'REACHABILITY PASSED', count);
  }
  gates.perMapReachability = perMap;
  out.sections.gates = gates;
  ok(`gates: smoke ${gates.smoke.passed ? 'PASS' : 'FAIL'} (${gates.smoke.checks}), reachability ${gates.reachability.passed ? 'PASS' : 'FAIL'} (${gates.reachability.checks}), biome ${gates.biomeCheck.passed ? 'PASS' : 'FAIL'} (${gates.biomeCheck.checks}), soak ${gates.soak.passed ? 'PASS' : 'FAIL'}, ws-soak ${gates.wsSoak.passed ? 'PASS' : 'FAIL'} (${gates.wsSoak.checks}); per-map reachability scripts found: ${Object.keys(perMap).length}`);
}

// ---------- lighting integrity (LOCKED by owner play verdict — confirm untouched, never re-grade) ----------
{
  const li = { baseline: LIGHTING_BASELINE };
  try {
    const bytes = readFileSync(join(ROOT, 'js/lighting.js'));
    li.lightingJsSha256_16 = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  } catch { li.lightingJsSha256_16 = null; }
  const mainSrc = (() => { try { return readFileSync(join(ROOT, 'js/main.js'), 'utf8'); } catch { return ''; } })();
  li.exposureLiteral = parseFloat(mainSrc.match(/toneMappingExposure\s*=\s*([\d.]+)/)?.[1] ?? 'NaN');
  li.shadowMapSize = +(mainSrc.match(/shadow\.mapSize\.set\((\d+),\s*\1\)/)?.[1] ?? NaN);
  try {
    const lt = await import('../js/lighting.js');
    li.profileMaps = Object.keys(lt.LIGHTING_PROFILES ?? lt.PROFILES ?? {});
  } catch { li.profileMaps = null; }
  li.untouched = li.lightingJsSha256_16 === LIGHTING_BASELINE.lightingJsSha256_16
    && li.exposureLiteral === LIGHTING_BASELINE.exposureLiteral
    && li.shadowMapSize === LIGHTING_BASELINE.shadowMapSize;
  out.sections.lightingIntegrity = li;
  ok(`lighting integrity: js/lighting.js sha ${li.lightingJsSha256_16} (baseline ${LIGHTING_BASELINE.lightingJsSha256_16}), exposure literal ${li.exposureLiteral}, shadow map ${li.shadowMapSize} — ${li.untouched ? 'UNTOUCHED (lock holds)' : 'CHANGED'}`);
  if (!li.untouched) warn('LIGHTING TOUCHED: js/lighting.js hash, the exposure literal, or the shadow-map size differs from the V6 baseline — the grade is LOCKED by the owner\'s play verdict (Board V6-1b); only a Brett-reported lighting problem unlocks it. If this drift is a resolution-knob change for mobile (shadow size only, Addendum A), minute it as such; profiles/grades must not move.');
}

// ---------- scene construction (client path + layout path) ----------
const THREE = await import('../vendor/three.module.js');
const { buildWorld } = await import('../js/world.js');
const { applyBiome, BIOMES } = await import('../js/biomes.js');
const { Bot } = await import('../js/bots.js');
const { buildViewmodelGun } = await import('../js/gunmodels.js');
const { WEAPON_ORDER } = await import('../js/weapons.js');
let buildMapLayout = null;
try { ({ buildMapLayout } = await import('../js/mapbuilders.js')); } catch { /* pre-layout tree */ }

const worldScene = new THREE.Scene();
const world = buildWorld(worldScene);

// Per-bot + viewmodel costs first (the sustained formula needs them)
const botByWeapon = {};
for (const wid of WEAPON_ORDER) {
  const s = new THREE.Scene();
  new Bot(s, world, new THREE.Vector3(0, 0, 0), 1, wid);
  botByWeapon[wid] = auditGraphX(s);
}
const worstBot = Object.values(botByWeapon).reduce((a, b) => (b.tris > a.tris ? b : a));
const botBase = botByWeapon[WEAPON_ORDER[0]];
const vmByWeapon = {};
for (const wid of WEAPON_ORDER) {
  const { group } = buildViewmodelGun(wid);
  vmByWeapon[wid] = auditGraphX(group);
}
const worstVm = Object.values(vmByWeapon).reduce((a, b) => (b.tris > a.tris ? b : a));
const PICKUP_CALLS = 3 * 2, PICKUP_TRIS_ALLOWANCE = 600, EXPLOSION_CALLS = 1;

const sustainedOf = (a) => ({
  calls: a.calls + 9 * botBase.calls + worstVm.calls + PICKUP_CALLS,
  tris: a.tris + 9 * worstBot.tris + worstVm.tris + PICKUP_TRIS_ALLOWANCE,
});
const shadowPassOf = (a) => a.calls + a.shadowCasters + 9 * (botBase.calls + botBase.shadowCasters);
const shadowTrisOf = (a) => a.casterTris + 9 * botBase.casterTris;

// Vegetation scorecard (Board §2.1) for a named group inside a scene.
function vegScorecard(scene, groupName) {
  const group = scene.getObjectByName ? scene.getObjectByName(groupName) : null;
  if (!group) return null;
  const audit = auditGraphX(group, { records: true });
  const inst = audit.records.filter((r) => r.kind === 'instanced');
  const trees = group.userData?.treeCount ?? group.userData?.trees ?? null;
  const bushes = group.userData?.bushCount ?? null;
  const canopy = inst.length ? inst.reduce((a, b) => (b.count > a.count ? b : a)) : null;
  const trunk = trees
    ? (inst.find((r) => r.geo === 'CylinderGeometry' && r.count === trees) ?? null)
    : (inst.filter((r) => r.geo === 'CylinderGeometry').sort((a, b) => (b.params?.height ?? 0) - (a.params?.height ?? 0))[0] ?? null); // no userData count (layouts): the TALLEST cylinder is the trunk set, not stumps/discs
  const coloured = inst.filter((r) => r.instanceColor);
  return {
    group: groupName,
    trees, bushes,
    groupTris: audit.tris, groupCalls: audit.calls,
    instancedSets: inst.map((r) => ({ geo: r.geo, params: r.params, count: r.count, trisEach: r.trisEach, tris: r.tris, flat: r.flat, textured: r.textured, instanceColor: r.instanceColor })),
    foliageMassesPerTree: (canopy && trees) ? +(canopy.count / trees).toFixed(2) : null,
    vegetationTrisPerTree: trees ? Math.round(inst.reduce((a, r) => a + r.tris, 0) / trees) : null,
    trunk: trunk ? {
      params: trunk.params,
      tapered: !!(trunk.params && trunk.params.radiusTop < trunk.params.radiusBottom),
      smoothShaded: !trunk.flat,
      barkTextured: trunk.textured,
    } : null,
    foliage: canopy ? { textured: canopy.textured, flatShaded: canopy.flat, trisEach: canopy.trisEach, params: canopy.params } : null,
    instanceColorCoverage: inst.length ? +(coloured.length / inst.length).toFixed(2) : null,
  };
}

function scoreScene(id, scene, kind) {
  const audit = auditGraphX(scene, { records: true });
  const textures = textureAudit(scene);
  const sustained = sustainedOf(audit);
  const entry = {
    kind, // 'client' | 'layout'
    static: (({ records, ...rest }) => rest)(audit),
    topInstanced: audit.records.filter((r) => r.kind === 'instanced').sort((a, b) => b.tris - a.tris).slice(0, 12),
    topMeshes: audit.records.filter((r) => r.kind === 'mesh').sort((a, b) => b.tris - a.tris).slice(0, 8),
    textures,
    sustained,
    inclTransients: { calls: sustained.calls + EXPLOSION_CALLS, tris: sustained.tris },
    shadowPassEstimate: shadowPassOf(audit),
    shadowTrisEstimate: shadowTrisOf(audit),
    equipmentReserveCalls: BARS.equipmentReserve.totalCalls,
    streakReserveCalls: BARS.streakReserve.totalCalls,
    remoteFigureCalls: BARS.equipmentReserve.remoteFigures.calls,
    grandWorstCase: sustained.calls + BARS.equipmentReserve.totalCalls + BARS.streakReserve.totalCalls + BARS.equipmentReserve.remoteFigures.calls,
    vegetation: vegScorecard(scene, kind === 'client' ? `biome-${id}` : `map-${id}`),
  };
  const tag = kind === 'layout' ? `LAYOUT ${id} (pre-wiring projection)` : `map ${id}`;
  ok(`${tag}: sustained ${sustained.calls} calls / ${sustained.tris} tris; static ${audit.calls} calls / ${audit.tris} tris (instanced share ${audit.instancedShare}, flat share ${audit.flatShare}, textured share ${audit.texturedShare}); casters ${audit.shadowCasters} (shadow pass est. ${entry.shadowPassEstimate} calls / ${entry.shadowTrisEstimate} tris); textures ${textures.uniqueTextures} unique, ${textures.totalTexels} texels, ~${textures.estVramMB} MB; grand worst case ${entry.grandWorstCase}`);
  if (sustained.calls > BARS.drawCallsPerMap) warn(`PERF VETO LINE (${tag}): sustained draw calls ${sustained.calls} exceed the per-map line (${BARS.drawCallsPerMap}) — reclaim required; detail must be rebought with instancing/merging (Board §3), new content included`);
  if (sustained.tris > BARS.trisPerMap) warn(`PERF VETO LINE (${tag}): sustained tris ${sustained.tris} exceed the per-map line (${BARS.trisPerMap})`);
  if (entry.shadowPassEstimate > BARS.shadowPassCallsWarn) warn(`SHADOW PASS (${tag}): estimate ${entry.shadowPassEstimate} calls exceeds the advisory ${BARS.shadowPassCallsWarn} — caster growth is priced here first (Board §2.6); check castShadow on new detail before it lands`);
  if (textures.estVramMB > BARS.textureVramWarnMB) warn(`TEXTURES (${tag}): estimated ${textures.estVramMB} MB exceeds the ${BARS.textureVramWarnMB} MB mobile-safe advisory`);
  if (id === 'forest' && audit.instancedShare < BARS.forestInstancedShareMin) warn(`INSTANCING (${tag}): static instanced share ${audit.instancedShare} below ${BARS.forestInstancedShareMin} — vegetation detail must be instancing-bought (Board §3.1)`);
  if (audit.strikeCandidateMesh && audit.strikeCandidateMesh.area > BARS.untexturedMeshStrikeM2) warn(`FLAT SURFACE STRIKE (${tag}): largest in-scope untextured static mesh ≈ ${audit.strikeCandidateMesh.area} m² (${audit.strikeCandidateMesh.geo}${audit.strikeCandidateMesh.name ? ' "' + audit.strikeCandidateMesh.name + '"' : ''}) exceeds the §2.5 strike (${BARS.untexturedMeshStrikeM2} m², binds at Update 5) — ${audit.strikeCandidateMesh.tris} tris of flat colour`);
  const veg = entry.vegetation;
  if (veg && (id === 'forest' || id === 'compound')) {
    if (veg.trunk && (!veg.trunk.smoothShaded || !veg.trunk.barkTextured)) warn(`UPDATE 1 BAR (§2.1, ${tag}): trunk is ${veg.trunk.smoothShaded ? 'smooth-shaded' : 'FLAT-SHADED'} and ${veg.trunk.barkTextured ? 'bark-textured' : 'UNTEXTURED'} — Board requires tapered + smooth-shaded + procedural bark texture; baseline state recorded, Atlas's Update 1 must flip it`);
    if (veg.foliage && !veg.foliage.textured) warn(`UPDATE 1 BAR (§2.1, ${tag}): foliage material carries NO procedural texture — Board requires foliage texture with alpha variation after Update 1 (Compound/Forest)`);
    if (veg.instanceColorCoverage !== null && veg.instanceColorCoverage < 1) warn(`UPDATE 1 BAR (§2.1, ${tag}): per-instance colour variation on ${Math.round(veg.instanceColorCoverage * 100)}% of instanced vegetation sets — Board requires 100% (no clone-read trees)`);
    if (veg.trees !== null && veg.trees < 110 && id === 'forest') warn(`UPDATE 1 BAR (§2.1, ${tag}): tree count ${veg.trees} below the Board floor of 110 for Forest`);
  }
  return entry;
}

{
  const maps = {};
  const clientScenes = { compound: worldScene };
  for (const b of BIOMES) {
    if (b.id === 'compound') continue;
    const s = new THREE.Scene();
    const w = buildWorld(s);
    const ctx = { scene: s, colliders: [...w.colliders], shootables: [...w.shootables] };
    try { applyBiome(b.id, ctx); } catch (e) { ok(`map ${b.id}: applyBiome threw ${String(e).slice(0, 120)}`); }
    clientScenes[b.id] = s;
  }
  for (const b of BIOMES) {
    maps[b.id] = { status: b.status, client: scoreScene(b.id, clientScenes[b.id], 'client') };
  }
  // Layout path (distinct maps; compound stays with buildWorld by design)
  if (buildMapLayout) {
    for (const id of ['forest', 'snow', 'mars']) {
      const s = new THREE.Scene();
      let L = null;
      try { L = buildMapLayout(id, s); } catch (e) { ok(`layout ${id}: buildMapLayout threw ${String(e).slice(0, 120)}`); }
      if (L && maps[id]) maps[id].layout = scoreScene(id, s, 'layout');
    }
  }
  out.sections.maps = maps;
  out.sections.sharedCosts = {
    botCalls: botBase.calls, botCasters: botBase.shadowCasters, botTris: botBase.tris, botVerts: botBase.verts,
    botFlatShare: botBase.flatShare, worstBotTris: worstBot.tris, worstViewmodelTris: worstVm.tris,
    botByWeapon, viewmodelByWeapon: vmByWeapon,
  };
  ok(`soldier: ${botBase.calls} calls / ${botBase.tris} tris / ${botBase.verts} verts per bot (worst weapon ${worstBot.tris} tris), flat-shaded share ${botBase.flatShare}; viewmodel worst ${worstVm.tris} tris`);
}

// ---------- soldiers, guns, camos (Update 4 holds these bars) ----------
{
  const { buildBotGun } = await import('../js/gunmodels.js');
  const gunTris = {}, gunCalls = {};
  for (const wid of WEAPON_ORDER) {
    const g = buildBotGun(wid);
    const a = auditGraphX(g?.group ?? g);
    gunTris[wid] = a.tris; gunCalls[wid] = a.calls;
  }
  // Palette + camo zero-delta proof (the real V5 method):
  // hostile vs friendly palettes run the SAME builders, and
  // every camo in js/camo.js × every faction must audit
  // identical — palette swaps are free or they are vetoed.
  const perTeam = {};
  for (const team of ['hostile', 'friendly']) {
    const s = new THREE.Scene();
    new Bot(s, world, new THREE.Vector3(0, 0, 0), 1, WEAPON_ORDER[0], team);
    perTeam[team] = auditGraphX(s);
  }
  const paletteDelta = { calls: perTeam.friendly.calls - perTeam.hostile.calls, tris: perTeam.friendly.tris - perTeam.hostile.tris };
  if (paletteDelta.calls !== 0 || paletteDelta.tris !== 0) warn(`CAMO VETO: palette swap changed soldier cost (Δ ${paletteDelta.calls} calls / ${paletteDelta.tris} tris) — palette swaps must be free`);
  let camoVariants = null;
  try {
    const { CAMO_IDS } = await import('../js/camo.js');
    const rows = [];
    let vBase = null, vPass = true;
    for (const team of ['hostile', 'friendly']) for (const camo of CAMO_IDS) {
      const s = new THREE.Scene();
      new Bot(s, world, new THREE.Vector3(0, 0, 0), 1, 'ar', team, camo);
      const a = auditGraphX(s);
      rows.push({ team, camo, calls: a.calls, tris: a.tris });
      if (!vBase) vBase = a;
      if (a.calls !== vBase.calls || a.tris !== vBase.tris) vPass = false;
    }
    camoVariants = { camoCount: CAMO_IDS.length, rows, pass: vPass, baseCalls: vBase?.calls ?? null, baseTris: vBase?.tris ?? null };
    if (!vPass) warn('CAMO VETO: a camo variant changed draw calls/tris vs the base variant — palette swaps must be free (standing veto)');
    else ok(`camo variants: ${CAMO_IDS.length} camos × 2 factions all identical (${vBase.calls} calls / ${vBase.tris} tris) — zero-delta PROVEN`);
  } catch (e) { warn(`camo variant matrix unavailable: ${String(e).slice(0, 120)}`); }
  if (botBase.calls > 7) warn(`SOLDIER BAR (§2.4): bot costs ${botBase.calls} calls > 7 — Update 4 must hold ≤7 calls per bot while smoothing the kit read`);
  out.sections.soldiers = {
    perBot: { calls: botBase.calls, tris: botBase.tris, verts: botBase.verts, casters: botBase.shadowCasters, casterTris: botBase.casterTris, flatShare: botBase.flatShare },
    gunTris, gunCalls, paletteDelta: { perTeam, delta: paletteDelta }, camoVariants,
  };
  ok(`soldiers: per-bot ${botBase.calls} calls / ${botBase.tris} tris / flat share ${botBase.flatShare}; palette delta ${paletteDelta.calls}/${paletteDelta.tris} (must be 0/0)`);

  // Equipment audit (the real V5 method): Atlas's visual
  // modules self-declare their draw calls; audit the real
  // builders and hold them to the reserve caps. Declared ==
  // audited is itself checked.
  try {
    const eqMod = await import('../js/equipment.js');
    const smMod = await import('../js/smokevisual.js');
    const build = (make) => { const s = new THREE.Scene(); const r = make(s); if (r) s.add(r.group ?? r); return auditGraphX(s); };
    const eq = {};
    eq.claymore = build(() => eqMod.buildEquipmentMesh('claymore'));
    eq.tripmine = build(() => eqMod.buildEquipmentMesh('tripmine'));
    eq.uav = build(() => eqMod.createUAVActor());
    eq.smoke = build((s) => { smMod.spawnSmoke(s, new THREE.Vector3(0, 0, 0)); return null; });
    eq.declared = { ...(eqMod.EQUIPMENT_DRAW_CALLS ?? {}), smoke: smMod.SMOKE_DRAW_CALLS };
    out.sections.equipment = eq;
    ok(`equipment audit: claymore ${eq.claymore.calls} call/${eq.claymore.tris} tris, tripmine ${eq.tripmine.calls}/${eq.tripmine.tris}, uav ${eq.uav.calls}/${eq.uav.tris}, smoke ${eq.smoke.calls} calls/volume (declared: ${JSON.stringify(eq.declared)})`);
    for (const k of ['claymore', 'tripmine', 'uav', 'smoke']) {
      if (eq.declared[k] !== undefined && eq[k] && eq.declared[k] !== eq[k].calls) warn(`EQUIPMENT (${k}): declared ${eq.declared[k]} calls != audited ${eq[k].calls} — the module's own accounting is wrong`);
    }
    if (eq.smoke.shadowCasters > 0) warn(`SMOKE: volume casts shadows (${eq.smoke.shadowCasters} casters) — smoke must never cast`);
    if (eq.smoke.calls > BARS.equipmentReserve.smoke.callsPerVolume) warn(`SMOKE: ${eq.smoke.calls} calls/volume exceeds the ${BARS.equipmentReserve.smoke.callsPerVolume}-call reserve cap — at ${BARS.equipmentReserve.smoke.maxActiveVolumes} active that is ${eq.smoke.calls * BARS.equipmentReserve.smoke.maxActiveVolumes} calls of transient`);
    if (eq.uav.calls > BARS.streakReserve.uav.calls) warn(`UAV: ${eq.uav.calls} calls exceeds the repriced reserve ${BARS.streakReserve.uav.calls}`);
  } catch (e) { warn(`equipment audit failed: ${String(e).slice(0, 160)}`); }
}

// ---------- sim bench (the real V5 bench, carried verbatim in method; skipped with --fast) ----------
if (FAST) {
  out.sections.simBench = { skipped: '--fast' };
  ok('sim bench: SKIPPED (--fast)');
} else {
  const { GameServer, LoopbackTransport } = await import('../net/server.js');
  const { MSG } = await import('../net/protocol.js');
  function bench({ clients, maxTicks, label, windowWave = null, windowTicks = 1500 }) {
    const server = new GameServer();
    const transport = new LoopbackTransport();
    server.attachTransport(transport);
    const room = server.createRoom('ODIN'); // room codes are exactly 4 chars in the protocol
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
      snapshotCapBytes: BARS.snapshotCapBytes, snapshotWithinCap: maxSnapBytes <= BARS.snapshotCapBytes,
    };
  }
  // Crash-tolerant, as in V5: a metrics run at an integration
  // point must survive a mid-refactor sim. Record the crash as
  // data; never let stale numbers pose as fresh ones.
  let standard = null, stress = null;
  try {
    standard = bench({ clients: 2, maxTicks: 4500, label: 'soak-parity (2 scripted clients)' });
    stress = bench({ clients: 4, maxTicks: 20000, label: 'stress (4 scripted clients, window at wave >= 5 = alive cap 9)', windowWave: 5, windowTicks: 1200 });
  } catch (e) {
    out.sections.simBench = { error: String(e).slice(0, 300), note: 'sim bench crashed — NO sim numbers this run (absent, not stale)' };
    warn(`SIM BENCH CRASHED: ${String(e).slice(0, 160)} — sim numbers absent this run`);
  }
  if (standard && stress) {
    for (const b of [standard, stress]) {
      if (b.sanity.welcomesReceived !== b.clients || !b.sanity.matchBooted || b.sanity.snapshotsReceived === 0) {
        warn(`sim bench "${b.label}" sanity FAILED (welcomes ${b.sanity.welcomesReceived}/${b.clients}, matchBooted ${b.sanity.matchBooted}, snapshots ${b.sanity.snapshotsReceived}) — its cost numbers are not trustworthy`);
      }
    }
    out.sections.simBench = { standard, stress, bar: `<= ${BARS.simMsPerTick} ms/tick at real caps (4 humans, 9-bot alive cap)` };
    ok(`sim bench: standard ${standard.msPerTickAvg} ms/tick (max snapshot ${standard.maxSnapshotBytes} B); stress ${stress.msPerTickAvg} ms/tick avg, window ${stress.windowMsPerTick} ms/tick, max alive bots ${stress.maxAliveBots}, max snapshot ${stress.maxSnapshotBytes} B`);
    if (!stress.snapshotWithinCap) warn(`stress max snapshot ${stress.maxSnapshotBytes} B exceeds the ${BARS.snapshotCapBytes} B protocol cap`);
    if ((stress.windowMsPerTick ?? stress.msPerTickAvg) > BARS.simMsPerTick) warn(`sim cost ${stress.windowMsPerTick ?? stress.msPerTickAvg} ms/tick exceeds the ${BARS.simMsPerTick} bar`);
  }
}

// ---------- shadow config + quality tiers (mobile strike data, Addendum A) ----------
{
  const mainSrc = (() => { try { return readFileSync(join(ROOT, 'js/main.js'), 'utf8'); } catch { return ''; } })();
  const qualitySrc = (() => { try { return readFileSync(join(ROOT, 'js/quality.js'), 'utf8'); } catch { return ''; } })();
  const shadows = {
    typeLine: mainSrc.match(/shadowMap\.type\s*=\s*THREE\.(\w+)/)?.[1] ?? null,
    mapSize: +(mainSrc.match(/shadow\.mapSize\.set\((\d+),\s*\1\)/)?.[1] ?? NaN),
    cameraBounds: (mainSrc.match(/shadow\.camera\.(left|right|top|bottom)\s*=\s*(-?[\d.]+)/g) ?? []).map((s) => s.replace(/\s+/g, '')),
    normalBias: mainSrc.match(/shadow\.normalBias\s*=\s*([\d.]+)/)?.[1] ?? null,
  };
  // quality.js tiers are code, not data: DPR caps live in the
  // header spec + scaler, shadow sizes in `size = N;` branches
  // (L0/L1 4096, L2 2048, L3 size stays 0 = off). Source-read.
  const caps = [...qualitySrc.matchAll(/pixelRatio\s*=\s*(?:min\(devicePixelRatio,\s*)?([\d.]+)\)?/g)].map((m) => +m[1]);
  const tierSizes = [...new Set([...qualitySrc.matchAll(/size = (\d+);/g)].map((m) => +m[1]))];
  const tiers = { dprCapsByLevel: caps, shadowSizesFound: tierSizes, note: 'L0/L1 shadow 4096, L2 2048, L3 off (size 0) per quality.js branches; touch starts at L1 (Vega, Directive V6-2)' };
  // anisotropy: the §2.5/Update-5 dial — measure its presence, don't assume
  let anisotropySet = false;
  for (const f of readdirSync(join(ROOT, 'js'))) {
    if (!f.endsWith('.js')) continue;
    if (/\.anisotropy\s*=|maxAnisotropy/.test(readFileSync(join(ROOT, 'js', f), 'utf8'))) { anisotropySet = true; break; }
  }
  out.sections.shadowConfig = { ...shadows, qualityTiers: tiers, anisotropySetAnywhere: anisotropySet };
  ok(`shadow config: ${shadows.typeLine}, map ${shadows.mapSize}, quality DPR caps [${caps.join(', ')}], shadow sizes [${tierSizes.join(', ')}]; anisotropy ${anisotropySet ? 'set somewhere in js/' : 'NOT SET anywhere in js/ (Update 5 dial)'}`);
}

// ---------- capabilities (carried V5) ----------
{
  const caps = {};
  caps.packageVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  if (caps.packageVersion !== '0.7.0') warn(`version is ${caps.packageVersion}, V7 target is 0.7.0 (Coordinator's bump)`);
  caps.losProfileUsPerRay = out.sections.gates?.soak?.losUsPerRay ?? null; // soak S9; LOS code lives in js/bots.js + net/sim.js (no standalone module)
  const lo = await import('../js/loadouts.js');
  caps.loadoutCombinations = lo.countLoadoutCombinations();
  caps.camoCount = lo.CAMOS ? lo.CAMOS.length : null;
  const mp = await import('../js/maps.js');
  caps.mapRegistry = Object.fromEntries((mp.MAPS ?? []).map((m) => [m.id, { layout: m.layout ?? null }]));
  const mapFiles = readdirSync(join(ROOT, 'js')).filter((f) => /^map-.*\.js$/.test(f));
  caps.mapDataModules = mapFiles;
  const dataFiles = readdirSync(join(ROOT, 'js')).filter((f) => /data\.js$/.test(f));
  caps.dataModules = dataFiles;
  const modes = await import('../js/modes.js').catch(() => null);
  caps.modeCount = modes?.MODES ? modes.MODES.length : null;
  caps.modeIds = modes?.MODES ? modes.MODES.map((m) => m.id) : null;
  out.sections.capabilities = caps;
  ok(`capabilities: version ${caps.packageVersion}, loadout combinations ${caps.loadoutCombinations.toLocaleString('en-US')}, camos ${caps.camoCount}, modes ${caps.modeCount} [${(caps.modeIds ?? []).join(', ')}], map layouts ${JSON.stringify(caps.mapRegistry)}`);
}

// ---------- patrol diff (--compare) ----------
if (COMPARE) {
  try {
    const prev = JSON.parse(readFileSync(COMPARE, 'utf8'));
    const deltas = {};
    for (const [id, cur] of Object.entries(out.sections.maps ?? {})) {
      const old = prev.sections?.maps?.[id];
      if (!old) continue;
      const d = {};
      for (const kind of ['client', 'layout']) {
        if (!cur[kind] || !old[kind]) continue;
        d[kind] = {
          sustainedCalls: cur[kind].sustained.calls - old[kind].sustained.calls,
          sustainedTris: cur[kind].sustained.tris - old[kind].sustained.tris,
          staticCalls: cur[kind].static.calls - old[kind].static.calls,
          staticTris: cur[kind].static.tris - old[kind].static.tris,
          shadowPass: cur[kind].shadowPassEstimate - old[kind].shadowPassEstimate,
          shadowTris: cur[kind].shadowTrisEstimate - old[kind].shadowTrisEstimate,
          instancedShare: +(cur[kind].static.instancedShare - old[kind].static.instancedShare).toFixed(3),
          flatShare: +(cur[kind].static.flatShare - old[kind].static.flatShare).toFixed(3),
        };
        ok(`compare ${id}/${kind}: sustained ${d[kind].sustainedCalls >= 0 ? '+' : ''}${d[kind].sustainedCalls} calls / ${d[kind].sustainedTris >= 0 ? '+' : ''}${d[kind].sustainedTris} tris; shadow pass ${d[kind].shadowPass >= 0 ? '+' : ''}${d[kind].shadowPass} calls; instanced share Δ ${d[kind].instancedShare}, flat share Δ ${d[kind].flatShare}`);
      }
      deltas[id] = d;
    }
    out.sections.compare = { against: COMPARE, againstHead: prev.head ?? null, deltas };
  } catch (e) { warn(`--compare failed: ${String(e).slice(0, 140)}`); }
}

// ---------- stamp + write ----------
try {
  out.head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  out.treeClean = dirty.length === 0;
  if (!out.treeClean) warn(`tree is DIRTY at measurement time — numbers describe the working tree, not HEAD (${out.head})`);
} catch { out.head = 'unknown'; }
out.bars = BARS;
writeFileSync(join(ROOT, 'docs/sessions/v6-metrics.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\nMETRICS WRITTEN: docs/sessions/v6-metrics.json (HEAD ${out.head}, tree ${out.treeClean ? 'CLEAN' : 'DIRTY — numbers describe the working tree'})`);
console.log(`WARNINGS: ${out.warnings.length}`);
for (const w of out.warnings) console.log('  ⚠ ' + w);
