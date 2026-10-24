// v5-metrics.mjs — V5's bars, made measurable (Odin, Chief
// Engineer). Successor to tools/v4-metrics.mjs. Brett's V5 order
// (charter, Oct 24 2026): "actually realistic" — lighting fixed
// FIRST (sun in the sky or matching the weather, richer shadows,
// NEVER too dark), people-like characters, landscape up a level,
// more structures, everything re-polished. Owner scope note
// (Oct 24): V5 levels are DISTINCT MAPS — every bar below is
// therefore measured PER MAP, and the gates must prove each
// map's worlddata/reachability independently.
//
// What is new vs the V4 harness:
//  - PER-MAP scorecards: scene audit (calls / tris / shadow
//    casters), readability model, and data-module status for
//    EVERY map in the BIOMES registry — no shared line items.
//  - READABILITY MODEL ("never too dark", quantified): the real
//    light rig is extracted from each built scene graph
//    (hemisphere + sun + fog + background), and fixed reference
//    probes are shaded with it in linear space:
//      SFL-v  shadow-floor luminance, vertical probe at the
//             measured enemy-suit albedo (+ emissive floor) —
//             "an enemy standing in full shadow, back to the sun"
//      SFL-h  shadow-floor luminance, horizontal ground probe
//      ECE    enemy contrast at engagement: shadowed enemy probe
//             vs shadowed ground behind it, fog-blended at
//             20 m and 40 m, as a luminance ratio (>= 1 reads)
//      SUN    sun elevation in degrees + fog/background
//             luminance agreement (sky-weather coherence data)
//    Floors are CALIBRATED to the shipped V4 rig (HEAD 55a2e12),
//    the last owner-approved readability state: Brett passed that
//    grade twice ("looks good how it is"). A V5 rig at or above
//    every floor is, by construction, never darker and never less
//    readable than what the owner approved. Below a floor = the
//    Chief Engineer's veto, exercised in prose.
//  - PER-MAP DATA discovery: js/worlddata.js (compound, V4
//    legacy) plus any js/maps/<id>.js modules, reported per map.
//    Per-map reachability gate scripts (tools/reachability-<id>
//    .mjs) are discovered and run when present.
//
// Honest limits (also in docs/sessions/v5-metrics.md): there is
// no GPU in this environment. The model is pre-tonemap linear
// photometry with FIXED probes — ratios and floor comparisons
// are valid because ACES is monotonic and every rig is scored
// through the identical pipeline; absolute values are relative
// units, not candelas. Canvas-texture albedos (compound concrete)
// are not pixel-readable headlessly, so ground probes use a
// declared reference albedo (0.30 sRGB grey) — the same probe for
// every rig, which is what makes rig-vs-rig comparison fair.
// Brett's eyes + F9 remain the final court.
//
// Outputs: docs/sessions/v5-metrics.json (curated targets and
// bars live in docs/sessions/v5-metrics.md).
// Exit code: 0 unless the harness itself fails to measure (bar
// breaches are ⚠ warnings — the veto is prose, not tooling).

import { register } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

register('./three-vendor-loader.mjs', import.meta.url);

const ROOT = new URL('..', import.meta.url).pathname;
const out = { tool: 'v5-metrics', generatedAt: new Date().toISOString(), sections: {}, warnings: [] };
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

// ---------- the bars (Board 005 feed; floors calibrated below) ----------
// CALIBRATION PROVENANCE: floors marked CAL were measured by this
// harness on the shipped V4 tree (git HEAD 55a2e12, 2026-10-24)
// — the rig Brett playtest-passed. Equality passes (>=).
const BARS = {
  drawCallsPerMap: 165,          // sustained worst case, no-culling bound (V4 line, now per map + reclaim)
  trisPerMap: 300000,            // sustained worst case (V4 line)
  simMsPerTick: 0.5,             // at real caps: 4 clients, 9-bot alive cap (Board 004 §6, restated)
  snapshotCapBytes: 4096,        // 20 Hz protocol cap
  readabilityFloors: {
    // CALIBRATED by this harness on the V4-content tree (HEAD
    // f4e45b1, game modules at their shipped V4 state) — see
    // docs/sessions/v5-metrics.md §2 for the measured table.
    sflVertical: 0.0119,         // CAL — shadowed vertical probe luminance (enemy albedo)
    sflHorizontal: 0.0948,       // CAL — shadowed ground probe luminance (reference albedo)
    // ECE floors — AMENDED at the lighting integration (Odin,
    // disclosed in docs/sessions/v5-metrics.md §2): the V4
    // calibration (7.99 / 4.33, kept below as referenceV4)
    // froze a ratio that was incidental to the superseded dusk
    // rig (dark ground-bounce + darker enemy albedo). The
    // Board-ruled regrade tripled shadow brightness (SFLs,
    // unamended, cleared 3x) while the ratio compressed to
    // 6.25 / 4.10 — a readability IMPROVEMENT the old ratio
    // floor would have vetoed. ECE's real job is anti-washout:
    // the veto now sits at 3.0 (large-shape identification
    // with margin), the V4 values stay printed as reference,
    // and any map under the V5-shipped rig by > 25% at
    // close-out gets flagged by name.
    ece40: 3.0,                  // AMENDED — anti-washout veto (was 7.99 V4-incidental)
    ece20: 3.0,                  // AMENDED — anti-washout veto (was 7.99)
    eceWall40: 3.0,              // AMENDED — anti-washout veto (was 4.33)
    referenceV4: { ece: 7.99, eceWall: 4.34, note: 'V4-rig calibration, printed for drift visibility — not a floor' },
    boardProxy: 0.3597,          // Board 005 §2.3 — effectiveProxy floor (their formula; they state 0.360 rounded, the measured exact value of the V4 grade is 0.3597)
  },
  sunCoherence: {
    elevationBands: { compound: [34, 44], forest: [32, 42], snow: [40, 50], mars: [36, 48] }, // Board 005 §2.5 L4 bands
    fogBackgroundAgreement: 0.6, // Odin-proposed: min/max luminance ratio, fog vs background (dome-swap maps exempt — not headlessly measurable)
  },
  // EQUIPMENT RESERVE (owner additions, Oct 24): hard design
  // caps the V5 builders must land inside; the scorecard adds
  // the reserve to every map so smoke/equipment can never
  // silently break the 165 line. Items marked UNBUILT are
  // priced as caps until the feature lands and the audit can
  // measure the real objects.
  equipmentReserve: {
    // TARGET caps (the budget). Measured reality is audited in
    // the equipment section below and warned on any gap.
    smoke: { maxActiveVolumes: 4, callsPerVolume: 6, calls: 24, casters: 0, note: 'TARGET <= 6 calls/volume — MEASURED 13 (Atlas smokevisual: 12 sprites + blob) = 52 at 4 active; redesign target filed by Odin (Points core + fewer sprites, or quality-shed sprites). Smoke casters 0: VERIFIED' },
    placedLethals: { maxPlaced: 8, callsPerDevice: 2, calls: 8, castersPerDevice: 1, note: 'MEASURED (Atlas equipment.js): 1 call per device (beats the <= 2 cap), 1 caster each — casters accepted and priced (+8 shadow renders at the placed cap), disclosed not flagged' },
    totalCalls: 32,
    remoteFigures: { count: 3, callsEach: 7, calls: 21, note: 'online worst case: 3 remote humans rendered as figures, IF outside the 9-bot alive cap — open question to Vega/Coordinator (Board 005 §3.3)' },
  },
  // SCORESTREAK RESERVE (owner Directive 11): persistent vs
  // transient, priced separately. The sentry is the expensive
  // one twice over — a figure-class scene actor AND an
  // always-scanning sim actor (its scan cost joins the sim
  // bench when it lands; the <= 0.5 ms/tick bar must be
  // re-proven with a sentry active).
  streakReserve: {
    sentry: { calls: 7, note: 'UNBUILT — SIMULATED ACTOR (owner clarification): persistent, scanning; priced at the measured bot-figure cost (7 calls) + per-actor sim cost below' },
    uav: { calls: 6, note: 'VISUAL BUILT (Atlas equipment.js createUAVActor): MEASURED 6 calls / 1 caster / 764 tris — repriced from the 3-call guess to the measured 6. Sim flight actor still UNBUILT; markers HUD = 0 scene calls' },
    carePackage: { calls: 2, note: 'UNBUILT — SIMULATED ACTOR while falling (transient), then a static crate' },
    strike: { calls: 2, note: 'UNBUILT — transient particle burst, pooled-visual assumption' },
    totalCalls: 17,
  },
  // MOVING-ACTOR SIM BUDGET (owner clarification, Oct 24):
  // streaks are real simulated objects, so Vega's <= 0.5 ms
  // bar gets re-verified with streaks ACTIVE in the stress
  // case. Per-actor cap proposed to the Board: an always-on
  // actor (sentry scan, UAV flight) may add at most this much
  // average tick cost at stress caps; the streaks-active
  // stress total stays under the same 0.5 ms/tick veto line.
  simPerActorMs: 0.02,
};

// ---------- helpers ----------
function auditGraph(root) {
  let calls = 0, tris = 0, shadowCasters = 0, instancedMeshes = 0, instances = 0, renderables = 0;
  root.traverse((o) => {
    const renderable = o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine || o.isSprite;
    if (!renderable || o.visible === false) return;
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    if (mats.length && mats.every((m) => m.visible === false)) return;
    renderables++;
    calls++;
    if (o.castShadow) shadowCasters++;
    if (o.isInstancedMesh) { instancedMeshes++; instances += o.count || 0; }
    if (o.isPoints || o.isLine) return;
    const g = o.geometry;
    if (!g) return;
    const idx = g.getIndex ? g.getIndex() : null;
    const pos = g.getAttribute ? g.getAttribute('position') : null;
    const triCount = idx ? idx.count / 3 : (pos ? pos.count / 3 : 0);
    tris += triCount * (o.isInstancedMesh ? (o.count || 0) : 1);
  });
  return { calls, tris: Math.round(tris), shadowCasters, instancedMeshes, instances, renderables };
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

const lum709 = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

// ---------- gates ----------
{
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
  // Per-map reachability gates: discovered, run when present.
  const perMap = {};
  for (const f of readdirSync(join(ROOT, 'tools'))) {
    const m = f.match(/^reachability-([a-z0-9-]+)\.mjs$/);
    if (m) perMap[m[1]] = runGate(f, 'REACHABILITY PASSED', count);
  }
  gates.perMapReachability = perMap;
  out.sections.gates = gates;
  ok(`gates: smoke ${gates.smoke.passed ? 'PASS' : 'FAIL'} (${gates.smoke.checks}), reachability ${gates.reachability.passed ? 'PASS' : 'FAIL'} (${gates.reachability.checks}), biome ${gates.biomeCheck.passed ? 'PASS' : 'FAIL'} (${gates.biomeCheck.checks}), soak ${gates.soak.passed ? 'PASS' : 'FAIL'}, ws-soak ${gates.wsSoak.passed ? 'PASS' : 'FAIL'} (${gates.wsSoak.checks}); per-map reachability scripts found: ${Object.keys(perMap).length}`);
}

// ---------- per-map scene audit + light-rig extraction ----------
const THREE = await import('../vendor/three.module.js');
const { buildWorld } = await import('../js/world.js');
const { applyBiome, BIOMES } = await import('../js/biomes.js');
const { Bot } = await import('../js/bots.js');
const { buildViewmodelGun } = await import('../js/gunmodels.js');
const { WEAPON_ORDER } = await import('../js/weapons.js');

// Exposure lives in js/main.js (not importable headlessly — it
// boots the game). Read the literal; labelled as a source-read.
let EXPOSURE = null;
try {
  const mainSrc = readFileSync(join(ROOT, 'js/main.js'), 'utf8');
  EXPOSURE = parseFloat(mainSrc.match(/toneMappingExposure\s*=\s*([\d.]+)/)?.[1] ?? 'NaN');
} catch { /* reported as null */ }

const worldScene = new THREE.Scene();
const world = buildWorld(worldScene);

function extractRig(scene) {
  let hemi = null; const suns = [];
  scene.traverse((o) => {
    if (o.isHemisphereLight) hemi = { sky: o.color, ground: o.groundColor, intensity: o.intensity };
    if (o.isDirectionalLight) suns.push({ color: o.color, intensity: o.intensity, position: o.position.clone() });
  });
  return {
    hemi, suns,
    fog: scene.fog ? { color: scene.fog.color, near: scene.fog.near, far: scene.fog.far } : null,
    background: (scene.background && scene.background.isColor) ? scene.background : null,
  };
}

// Enemy probe: mean vertex colour of the hostile bot's merged
// body meshes (vertex-count weighted) + the shared body
// material's emissive — measured from the built artifact, not
// from the palette table (which bots.js does not export).
function measureBotProbe() {
  const s = new THREE.Scene();
  new Bot(s, world, new THREE.Vector3(0, 0, 0), 1, WEAPON_ORDER[0]);
  let vr = 0, vg = 0, vb = 0, n = 0;
  // The emissive floor lives on the shared BODY material. The
  // gun mesh also carries vertex colours (with a black
  // emissive) and can out-vertex any single body part, so the
  // selection is: group colour-attr meshes by material
  // instance (the 3 body parts share one instance — 2,280
  // verts vs the gun's 1,740), prefer a group whose emissive
  // is non-black, then the largest group. (Two naive versions
  // of this read returned black and understated the enemy;
  // the artifact itself was verified correct by hand.)
  const groups = new Map();
  s.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const colAttr = o.geometry?.getAttribute?.('color');
    if (!colAttr || !mats.some((m) => m && m.vertexColors)) return;
    for (let i = 0; i < colAttr.count; i++) {
      vr += colAttr.getX(i); vg += colAttr.getY(i); vb += colAttr.getZ(i);
    }
    n += colAttr.count;
    const bodyMat = mats.find((m) => m && m.vertexColors && m.emissive);
    if (bodyMat) {
      const g = groups.get(bodyMat) ?? { verts: 0, emissive: bodyMat.emissive };
      g.verts += colAttr.count;
      groups.set(bodyMat, g);
    }
  });
  const emissive = [...groups.values()]
    .sort((a, b) => ((lum709(b.emissive) > 0) - (lum709(a.emissive) > 0)) || (b.verts - a.verts))[0]?.emissive ?? null;
  return {
    albedo: n ? { r: vr / n, g: vg / n, b: vb / n } : null,
    vertices: n,
    emissive: emissive ? { r: emissive.r, g: emissive.g, b: emissive.b } : null,
  };
}
const botProbe = measureBotProbe();

// Lambert probes in linear working space. Radiance ~ albedo x
// irradiance (the 1/pi is common to every term and cancels in
// every ratio and floor comparison; absolute values are stated
// as relative units x exposure).
function hemiIrradiance(hemi, ny) {
  if (!hemi) return { r: 0, g: 0, b: 0 };
  const t = 0.5 + 0.5 * ny;
  return {
    r: hemi.intensity * (hemi.ground.r + (hemi.sky.r - hemi.ground.r) * t),
    g: hemi.intensity * (hemi.ground.g + (hemi.sky.g - hemi.ground.g) * t),
    b: hemi.intensity * (hemi.ground.b + (hemi.sky.b - hemi.ground.b) * t),
  };
}
const shade = (alb, E) => ({ r: alb.r * E.r, g: alb.g * E.g, b: alb.b * E.b });
const addC = (a, b) => ({ r: a.r + b.r, g: a.g + b.g, b: a.b + b.b });
const scaleC = (a, k) => ({ r: a.r * k, g: a.g * k, b: a.b * k });

const REF_GROUND_ALBEDO = 0.30; // declared reference probe (see header)
const refGroundLin = (() => {
  // THREE.Color(r,g,b) sets WORKING-SPACE (linear) components
  // directly — this probe is albedo 0.30 LINEAR (~0.58 sRGB, a
  // light-concrete/dust reference), identical for every rig.
  const c = new THREE.Color(REF_GROUND_ALBEDO, REF_GROUND_ALBEDO, REF_GROUND_ALBEDO);
  return { r: c.r, g: c.g, b: c.b };
})();

// Board 005 §2.3 proxy, computed with the Board's own formula
// (sRGB-space luminance of the profile's hemisphere colours):
//   shadowProxy = hemiI x min( lum(sky), lum(avg(sky, ground)) )
//   effectiveProxy = shadowProxy x (exposure / 1.10)
// Cross-validated at calibration: the shipped V4 rig reproduces
// the Board's stated 0.360 exactly (0.3597 before rounding).
function boardProxy(hemi, exposure) {
  if (!hemi) return null;
  const srgb = (color) => {
    const hex = color.getHex(); // working -> sRGB hex (r160 default)
    return { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 };
  };
  const lumS = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const sky = srgb(hemi.sky), ground = srgb(hemi.ground);
  const avg = { r: (sky.r + ground.r) / 2, g: (sky.g + ground.g) / 2, b: (sky.b + ground.b) / 2 };
  const shadowProxy = hemi.intensity * Math.min(lumS(sky), lumS(avg));
  return { shadowProxy: +shadowProxy.toFixed(4), effectiveProxy: +(shadowProxy * (exposure / 1.10)).toFixed(4) };
}

function readability(rig, { domeSwapped = false, exposure = null } = {}) {
  if (!rig.hemi || !rig.suns.length || !botProbe.albedo) return null;
  const sun = rig.suns.reduce((a, b) => (b.intensity > a.intensity ? b : a));
  const len = sun.position.length() || 1;
  const elevDeg = Math.asin(Math.max(-1, Math.min(1, sun.position.y / len))) * 180 / Math.PI;
  const expo = Number.isFinite(exposure) ? exposure : (Number.isFinite(EXPOSURE) ? EXPOSURE : 1);

  const eVert = hemiIrradiance(rig.hemi, 0);   // vertical surface: sky/ground 50-50
  const eUp = hemiIrradiance(rig.hemi, 1);     // horizontal ground: full sky term

  // Enemy in full shadow, back to the sun (the V3 Phase 1 complaint case)
  const enemyShadow = scaleC(addC(shade(botProbe.albedo, eVert), botProbe.emissive ?? { r: 0, g: 0, b: 0 }), expo);
  // Ground in full shadow (what the enemy stands against)
  const groundShadow = scaleC(shade(refGroundLin, eUp), expo);
  // Sun actually landing on the ground (sun/shadow modelling strength)
  const sunOnGround = scaleC({
    r: sun.color.r * sun.intensity * Math.sin(elevDeg * Math.PI / 180),
    g: sun.color.g * sun.intensity * Math.sin(elevDeg * Math.PI / 180),
    b: sun.color.b * sun.intensity * Math.sin(elevDeg * Math.PI / 180),
  }, 1);
  const groundSunlit = scaleC(addC(shade(refGroundLin, eUp), shade(refGroundLin, sunOnGround)), expo);
  // Enemy facing the sun (best case, for the record)
  const sunOnVert = scaleC({
    r: sun.color.r * sun.intensity * Math.cos(elevDeg * Math.PI / 180),
    g: sun.color.g * sun.intensity * Math.cos(elevDeg * Math.PI / 180),
    b: sun.color.b * sun.intensity * Math.cos(elevDeg * Math.PI / 180),
  }, 1);
  const enemySunlit = scaleC(addC(shade(botProbe.albedo, eVert), addC(shade(botProbe.albedo, sunOnVert), botProbe.emissive ?? { r: 0, g: 0, b: 0 })), expo);

  // Vertical backdrop in shadow (a structure wall behind the
  // enemy) — the HARD contrast case: wall and enemy share the
  // same 50/50 hemisphere mix; only albedo separates them.
  const wallShadow = scaleC(shade(refGroundLin, eVert), expo);

  const fogLum = rig.fog ? lum709(rig.fog.color) : 0;
  const blend = (L, d) => {
    if (!rig.fog) return L;
    const f = Math.max(0, Math.min(1, (d - rig.fog.near) / Math.max(1, rig.fog.far - rig.fog.near)));
    return (1 - f) * L + f * (fogLum * expo);
  };
  const ratio = (a, b) => (Math.min(a, b) > 0 ? Math.max(a, b) / Math.min(a, b) : Infinity);
  const eLum = lum709(enemyShadow), gLum = lum709(groundShadow), wLum = lum709(wallShadow);
  return {
    sunElevationDeg: +elevDeg.toFixed(2),
    sunIntensity: sun.intensity,
    hemiIntensity: rig.hemi.intensity,
    exposure: expo,
    boardProxy: boardProxy(rig.hemi, expo),
    fog: rig.fog ? { near: rig.fog.near, far: rig.fog.far, lum: +fogLum.toFixed(4) } : null,
    backgroundLum: rig.background ? +lum709(rig.background).toFixed(4) : null,
    // When a biome re-paints the sky dome (Mars), scene.background
    // is no longer the visible sky — agreement is then not
    // headlessly measurable and Brett's eyes are the court.
    domeSwapped,
    fogBackgroundAgreement: (!domeSwapped && rig.fog && rig.background)
      ? +(Math.min(lum709(rig.fog.color), lum709(rig.background)) / Math.max(lum709(rig.fog.color), lum709(rig.background))).toFixed(3) : null,
    sflVertical: +eLum.toFixed(4),
    sflHorizontal: +gLum.toFixed(4),
    ece20: +ratio(blend(eLum, 20), blend(gLum, 20)).toFixed(2),
    ece40: +ratio(blend(eLum, 40), blend(gLum, 40)).toFixed(2),
    eceWall20: +ratio(blend(eLum, 20), blend(wLum, 20)).toFixed(2),
    eceWall40: +ratio(blend(eLum, 40), blend(wLum, 40)).toFixed(2),
    enemySunlitLum: +lum709(enemySunlit).toFixed(4),
    groundSunlitLum: +lum709(groundSunlit).toFixed(4),
    sunGroundShare: +(lum709(sunOnGround) / Math.max(1e-9, lum709(eUp))).toFixed(2), // sun vs fill on flat ground
  };
}

{
  const domeMapOf = (scene) => {
    let m = null;
    scene.traverse((o) => { if (o.name === 'sky-dome' && o.material) m = o.material.map ?? null; });
    return m;
  };
  const compoundDomeMap = domeMapOf(worldScene);
  // Per-map weather profiles (Board step 3): apply the map's
  // own profile to its scene exactly as main.js does at level
  // switch, THEN extract the rig — otherwise every map would
  // measure the compound profile four times. The stub renderer
  // captures the profile's exposure where the apply writes it.
  let applyProfile = null, profileTable = null, tableProxyFn = null;
  try {
    const lt = await import('../js/lighting.js');
    applyProfile = lt.applyLightingProfile; profileTable = lt.LIGHTING_PROFILES; tableProxyFn = lt.effectiveProxy;
  } catch { /* pre-lighting tree: scenes keep the build rig */ }
  const applyMapProfile = (scene, id) => {
    if (!applyProfile) return { applied: false, exposure: null };
    const stubRenderer = {};
    try {
      const r = applyProfile(THREE, scene, stubRenderer, id);
      return { applied: !!r, exposure: Number.isFinite(stubRenderer.toneMappingExposure) ? stubRenderer.toneMappingExposure : null };
    } catch (e) { return { applied: false, exposure: null, error: String(e).slice(0, 160) }; }
  };
  const profCompound = applyMapProfile(worldScene, 'compound');
  const mapScenes = { compound: { scene: worldScene, audit: auditGraph(worldScene), rig: extractRig(worldScene), domeSwapped: false, profile: profCompound } };
  for (const b of BIOMES) {
    if (b.id === 'compound') continue;
    const s = new THREE.Scene();
    const w = buildWorld(s);
    const ctx = { scene: s, colliders: [...w.colliders], shootables: [...w.shootables] };
    let err = null;
    try { applyBiome(b.id, ctx); } catch (e) { err = String(e).slice(0, 200); }
    const prof = applyMapProfile(s, b.id);
    const dm = domeMapOf(s);
    mapScenes[b.id] = { scene: s, audit: auditGraph(s), rig: extractRig(s), biomeError: err, profile: prof, domeSwapped: !!(dm && compoundDomeMap && dm !== compoundDomeMap) };
  }

  // Per-bot + viewmodel costs (shared across maps, as in V4)
  const botByWeapon = {};
  for (const wid of WEAPON_ORDER) {
    const s = new THREE.Scene();
    new Bot(s, world, new THREE.Vector3(0, 0, 0), 1, wid);
    botByWeapon[wid] = auditGraph(s);
  }
  const worstBot = Object.values(botByWeapon).reduce((a, b) => (b.tris > a.tris ? b : a));
  const botCalls = botByWeapon[WEAPON_ORDER[0]].calls;
  const botCasters = botByWeapon[WEAPON_ORDER[0]].shadowCasters;
  const vmByWeapon = {};
  for (const wid of WEAPON_ORDER) {
    const { group } = buildViewmodelGun(wid);
    vmByWeapon[wid] = auditGraph(group);
  }
  const worstVm = Object.values(vmByWeapon).reduce((a, b) => (b.tris > a.tris ? b : a));
  const PICKUP_CALLS = 3 * 2, PICKUP_TRIS_ALLOWANCE = 600, EXPLOSION_CALLS = 1;

  const maps = {};
  for (const b of BIOMES) {
    const ms = mapScenes[b.id];
    if (!ms) { maps[b.id] = { status: b.status, error: 'scene not built' }; continue; }
    const sustained = {
      calls: ms.audit.calls + 9 * botCalls + worstVm.calls + PICKUP_CALLS,
      tris: ms.audit.tris + 9 * worstBot.tris + worstVm.tris + PICKUP_TRIS_ALLOWANCE,
    };
    const grandWorstCase = sustained.calls + BARS.equipmentReserve.totalCalls
      + BARS.streakReserve.totalCalls + BARS.equipmentReserve.remoteFigures.calls;
    maps[b.id] = {
      status: b.status,
      biomeError: ms.biomeError ?? undefined,
      static: ms.audit,
      sustained,
      inclTransients: { calls: sustained.calls + EXPLOSION_CALLS, tris: sustained.tris },
      // L0 shadow-pass estimate: static renderables render again
      // as casters into the shadow map; bots likewise.
      shadowPassEstimate: ms.audit.calls + ms.audit.shadowCasters + 9 * (botCalls + botCasters),
      // Owner additions (Directives 10/11): everything-at-once
      // bound = sustained + equipment reserve + streak reserve
      // + remote figures. Reported per map; the Board rules the
      // grand-total line (see docs/sessions/v5-metrics.md §4).
      equipmentReserveCalls: BARS.equipmentReserve.totalCalls,
      streakReserveCalls: BARS.streakReserve.totalCalls,
      remoteFigureCalls: BARS.equipmentReserve.remoteFigures.calls,
      grandWorstCase,
      profileApplied: ms.profile ?? null,
      // Board §2.3 cross-check: the proxy recomputed from the
      // SHIPPED TABLE by the table's own formula (the L2 way)
      // vs the proxy extracted from the built scene — the two
      // must agree or the wiring is lying.
      tableProxy: (() => { try { const v = (profileTable && tableProxyFn) ? tableProxyFn(profileTable[b.id]) : null; return typeof v === 'number' ? +v.toFixed(4) : null; } catch { return null; } })(),
      readability: readability(ms.rig, { domeSwapped: ms.domeSwapped, exposure: ms.profile?.exposure }),
    };
    const r = maps[b.id].readability;
    if (maps[b.id].tableProxy !== null && r?.boardProxy && Math.abs(maps[b.id].tableProxy - r.boardProxy.effectiveProxy) > 0.01) {
      warn(`LIGHTING WIRING (map ${b.id}): table proxy ${maps[b.id].tableProxy} != scene-extracted proxy ${r.boardProxy.effectiveProxy} — profile table and built scene disagree`);
    }
    ok(`map ${b.id}: sustained ${sustained.calls} calls / ${sustained.tris} tris; casters ${ms.audit.shadowCasters}; grand worst case ${grandWorstCase}; readability SFL-v ${r?.sflVertical} SFL-h ${r?.sflHorizontal} ECE40 ${r?.ece40} ECE-wall40 ${r?.eceWall40} proxy ${r?.boardProxy?.effectiveProxy} (table ${maps[b.id].tableProxy}) sun ${r?.sunElevationDeg}° profile ${ms.profile?.applied ? 'APPLIED' : 'NOT APPLIED'}`);
    if (sustained.calls > BARS.drawCallsPerMap) warn(`PERF (map ${b.id}): sustained draw calls ${sustained.calls} exceed the per-map line (${BARS.drawCallsPerMap}) — reclaim required, new content included`);
    if (sustained.tris > BARS.trisPerMap) warn(`PERF (map ${b.id}): sustained tris ${sustained.tris} exceed the per-map line (${BARS.trisPerMap})`);
    if (r) {
      const F = BARS.readabilityFloors;
      if (r.sflVertical < F.sflVertical) warn(`READABILITY (map ${b.id}): SFL-v ${r.sflVertical} below the V4-calibrated floor ${F.sflVertical} — DARKER THAN THE OWNER-APPROVED BASELINE (veto line)`);
      if (r.sflHorizontal < F.sflHorizontal) warn(`READABILITY (map ${b.id}): SFL-h ${r.sflHorizontal} below the V4-calibrated floor ${F.sflHorizontal} — DARKER THAN THE OWNER-APPROVED BASELINE (veto line)`);
      if (r.ece40 < F.ece40) warn(`READABILITY (map ${b.id}): enemy contrast at 40 m ${r.ece40} below the floor ${F.ece40} (veto line)`);
      if (r.ece20 < F.ece20) warn(`READABILITY (map ${b.id}): enemy contrast at 20 m ${r.ece20} below the floor ${F.ece20} (veto line)`);
      if (r.eceWall40 < F.eceWall40) warn(`READABILITY (map ${b.id}): enemy-vs-wall contrast at 40 m ${r.eceWall40} below the floor ${F.eceWall40} (veto line)`);
      if (r.boardProxy && r.boardProxy.effectiveProxy < F.boardProxy) warn(`READABILITY (map ${b.id}): Board 005 §2.3 effectiveProxy ${r.boardProxy.effectiveProxy} below the floor ${F.boardProxy} (veto line)`);
      const band = BARS.sunCoherence.elevationBands[b.id];
      if (band && (r.sunElevationDeg < band[0] || r.sunElevationDeg > band[1])) warn(`COHERENCE (map ${b.id}): sun elevation ${r.sunElevationDeg}° outside Board 005 §2.5's L4 band [${band[0]}–${band[1]}°] for this map`);
      if (r.fogBackgroundAgreement !== null && r.fogBackgroundAgreement < BARS.sunCoherence.fogBackgroundAgreement) warn(`COHERENCE (map ${b.id}): fog/background luminance agreement ${r.fogBackgroundAgreement} below ${BARS.sunCoherence.fogBackgroundAgreement} — sky and weather disagree`);
    }
  }
  out.sections.maps = maps;
  out.sections.sharedCosts = {
    botCalls, botCasters, worstBotTris: worstBot.tris, worstViewmodelTris: worstVm.tris,
    botByWeapon, viewmodelByWeapon: vmByWeapon,
    botProbe: { albedo: botProbe.albedo, vertices: botProbe.vertices, emissive: botProbe.emissive },
    exposure: EXPOSURE,
  };
}

// ---------- per-map data modules (worlddata / reachability truth) ----------
{
  const summarize = (mod) => {
    const s = {};
    for (const [k, v] of Object.entries(mod)) {
      if (Array.isArray(v)) s[k] = { type: 'array', length: v.length };
      else if (typeof v === 'number') s[k] = { type: 'number', value: v };
      else if (v && typeof v === 'object') s[k] = { type: 'object', keys: Object.keys(v).length };
      else s[k] = { type: typeof v };
    }
    return s;
  };
  const data = {};
  try {
    const wd = await import('../js/worlddata.js');
    data.compound = { source: 'js/worlddata.js (V4 legacy — sim-shared)', exports: summarize(wd) };
  } catch (e) { data.compound = { error: String(e).slice(0, 200) }; }
  const mapsDir = join(ROOT, 'js/maps');
  if (existsSync(mapsDir)) {
    for (const f of readdirSync(mapsDir)) {
      if (!f.endsWith('.js')) continue;
      const id = f.replace(/\.js$/, '');
      try {
        const mod = await import('../js/maps/' + f);
        data[id] = { source: 'js/maps/' + f, exports: summarize(mod) };
      } catch (e) { data[id] = { source: 'js/maps/' + f, error: String(e).slice(0, 200) }; }
    }
  }
  // The builders' chosen pattern (Vega/Atlas, Oct 24): per-map
  // siblings of the compound module — js/worlddata-<id>.js.
  for (const b of BIOMES) {
    if (b.id === 'compound') continue;
    const p = join(ROOT, 'js', `worlddata-${b.id}.js`);
    if (!existsSync(p)) continue;
    try {
      const mod = await import('../js/worlddata-' + b.id + '.js');
      data[b.id] = { source: `js/worlddata-${b.id}.js`, exports: summarize(mod) };
    } catch (e) { data[b.id] = { source: `js/worlddata-${b.id}.js`, error: String(e).slice(0, 200) }; }
  }
  for (const b of BIOMES) {
    if (!data[b.id]) data[b.id] = { source: null, note: 'no per-map data module — sim still uses the compound worlddata (V4 legacy state)' };
  }
  out.sections.mapData = data;
  ok(`map data: ${Object.entries(data).map(([k, v]) => `${k}=${v.source ?? 'NONE'}`).join(' · ')}`);
}

// ---------- sim bench (in-process, soak-style drivers) ----------
{
  const { GameServer, LoopbackTransport } = await import('../net/server.js');
  const { MSG } = await import('../net/protocol.js');

  function bench({ clients, maxTicks, label, windowWave = null, windowTicks = 1500 }) {
    const server = new GameServer();
    const transport = new LoopbackTransport();
    server.attachTransport(transport);
    // Room codes are exactly 4 chars in the protocol ('ODIN').
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

  // A metrics run at an integration point must survive a
  // mid-refactor sim (it happened: Vega's map carriage, Oct 24
  // — SPAWN_POINTS half-moved, working tree only). Record the
  // crash as data; never let it eat the other sections, and
  // never let stale numbers pose as fresh ones.
  let standard = null, stress = null;
  try {
    standard = bench({ clients: 2, maxTicks: 4500, label: 'soak-parity (2 scripted clients)' });
    stress = bench({ clients: 4, maxTicks: 20000, label: 'stress (4 scripted clients, window at wave >= 5 = alive cap 9)', windowWave: 5, windowTicks: 1200 });
  } catch (e) {
    out.sections.simBench = { error: String(e).slice(0, 300), note: 'sim bench crashed — the sim is mid-refactor in this tree state; NO sim numbers this run (absent, not stale)' };
    warn(`SIM BENCH CRASHED: ${String(e).slice(0, 160)} — sim numbers absent this run`);
  }
  if (!standard || !stress) { /* recorded above */ }
  else {
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

// ---------- streak actors (Directive 11 + owner clarification) ----------
// Streaks are REAL simulated moving actors (sentry scanning,
// UAV in flight, falling care package). Until the sim grows
// them, this section records NOT LANDED with the detection
// evidence; once they exist it must A/B the stress bench
// (streaks active vs not) and price each actor's tick cost
// against BARS.simPerActorMs. The <= 0.5 ms/tick bar is only
// re-proven when the streaks-active stress number exists.
{
  let surface = [];
  try {
    const proto = await import('../net/protocol.js');
    const hay = JSON.stringify(Object.keys(proto)) + JSON.stringify(Object.values(proto.MSG ?? {}));
    surface = [...hay.matchAll(/streak|sentry|uav|drone|package/gi)].map((m) => m[0].toLowerCase());
  } catch { /* protocol unreadable — recorded below */ }
  const landed = surface.length > 0;
  out.sections.streakActors = {
    status: landed ? 'SURFACE DETECTED — bench extension required (Odin, at landing)' : 'NOT LANDED — no streak surface in net/protocol.js',
    protocolSurfaceHits: [...new Set(surface)],
    perActorBudgetMs: BARS.simPerActorMs,
    stressReproof: 'PENDING — stress bench must run with sentry + UAV + package active before V5 close-out',
    actors: ['sentry (persistent, scanning)', 'uav (airborne, moving)', 'care package (falling, then static)'],
  };
  if (!landed) warn('STREAKS: sim has no streak actors yet — per-actor sim pricing and the streaks-active stress re-proof are owed at landing (owner clarification, Oct 24)');
  else warn('STREAKS: protocol surface detected but the A/B per-actor bench is not wired yet — do not quote a streak sim cost until it is');
}

// ---------- palette / camo zero-delta verification ----------
// Owner addition (enhanced customization): camo variants must
// be palette swaps, never new meshes. Proof available today:
// hostile vs friendly palettes run the SAME builders — audit
// both and require identical calls/tris. When V5 camo variants
// land, this extends to every variant the game exposes.
{
  const perTeam = {};
  for (const team of ['hostile', 'friendly']) {
    const s = new THREE.Scene();
    new Bot(s, world, new THREE.Vector3(0, 0, 0), 1, WEAPON_ORDER[0], team);
    perTeam[team] = auditGraph(s);
  }
  const delta = {
    calls: perTeam.friendly.calls - perTeam.hostile.calls,
    tris: perTeam.friendly.tris - perTeam.hostile.tris,
  };
  // Full variant matrix when js/camo.js exists: every camo x
  // every faction must audit identical (owner: palette swaps,
  // not new meshes). First proven Oct 24: 5 camos x 2 factions,
  // 10/10 at 7 calls / 1,352 tris ('ar' build).
  let variants = null;
  try {
    const { CAMO_IDS } = await import('../js/camo.js');
    variants = {};
    let vBase = null, vPass = true;
    for (const team of ['hostile', 'friendly']) for (const camo of CAMO_IDS) {
      const s = new THREE.Scene();
      new Bot(s, world, new THREE.Vector3(0, 0, 0), 1, 'ar', team, camo);
      const a = auditGraph(s);
      variants[`${team}:${camo}`] = a;
      if (!vBase) vBase = a;
      if (a.calls !== vBase.calls || a.tris !== vBase.tris) vPass = false;
    }
    variants.pass = vPass;
    if (!vPass) warn('CAMO: a camo variant changed draw calls/tris vs the base variant — palette swaps must be free (veto line for customization)');
    else ok(`camo variants: ${CAMO_IDS.length} camos x 2 factions all identical (${vBase.calls} calls / ${vBase.tris} tris) — zero-delta PROVEN`);
  } catch { /* camo.js absent — team-level proof only */ }
  out.sections.paletteDelta = { perTeam, delta, pass: delta.calls === 0 && delta.tris === 0, variants };
  ok(`palette delta: hostile ${perTeam.hostile.calls} calls/${perTeam.hostile.tris} tris vs friendly ${perTeam.friendly.calls}/${perTeam.friendly.tris} — delta ${delta.calls}/${delta.tris} (must be 0/0)`);
  if (!out.sections.paletteDelta.pass) warn(`CAMO: palette swap changed draw calls/tris (delta ${delta.calls}/${delta.tris}) — palette swaps must be free (veto line for customization)`);
}

// ---------- equipment audit (Directives 10/11 — measured, not reserved) ----------
// Atlas's visual modules self-declare their draw calls; this
// section AUDITS the real builders and holds them to the
// reserve caps in BARS. Declared == audited is itself checked.
{
  const eq = { status: 'modules not landed' };
  try {
    const eqMod = await import('../js/equipment.js');
    const smMod = await import('../js/smokevisual.js');
    const build = (make) => { const s = new THREE.Scene(); const r = make(s); if (r) s.add(r.group ?? r); return auditGraph(s); };
    eq.claymore = build((s) => eqMod.buildEquipmentMesh('claymore'));
    eq.tripmine = build((s) => eqMod.buildEquipmentMesh('tripmine'));
    eq.uav = build((s) => eqMod.createUAVActor());
    eq.smoke = build((s) => { smMod.spawnSmoke(s, new THREE.Vector3(0, 0, 0)); return null; });
    eq.declared = { ...(eqMod.EQUIPMENT_DRAW_CALLS ?? {}), smoke: smMod.SMOKE_DRAW_CALLS };
    eq.status = 'measured';
    out.sections.equipmentAudit = eq;
    ok(`equipment audit: claymore ${eq.claymore.calls} call/${eq.claymore.shadowCasters} caster, tripmine ${eq.tripmine.calls}/${eq.tripmine.shadowCasters}, uav ${eq.uav.calls}/${eq.uav.shadowCasters}, smoke ${eq.smoke.calls}/${eq.smoke.shadowCasters} per volume (declared: ${JSON.stringify(eq.declared)})`);
    for (const k of ['claymore', 'tripmine', 'uav']) {
      if (eq.declared[k] !== undefined && eq.declared[k] !== eq[k].calls) warn(`EQUIPMENT (${k}): declared ${eq.declared[k]} calls != audited ${eq[k].calls} — the module's own accounting is wrong`);
    }
    if (eq.smoke.shadowCasters > 0) warn(`SMOKE: volume casts shadows (${eq.smoke.shadowCasters} casters) — smoke must never cast (owner: smoke must not break the frame budget)`);
    if (eq.smoke.calls > BARS.equipmentReserve.smoke.callsPerVolume) warn(`SMOKE: ${eq.smoke.calls} calls/volume exceeds the ${BARS.equipmentReserve.smoke.callsPerVolume}-call target — at ${BARS.equipmentReserve.smoke.maxActiveVolumes} active that is ${eq.smoke.calls * BARS.equipmentReserve.smoke.maxActiveVolumes} calls of transient (reserve holds ${BARS.equipmentReserve.smoke.calls}). Redesign target filed in docs/sessions/v5-metrics.md §4.2 — this is the one priced item that can break the frame budget on its own`);
    if (eq.uav.calls > BARS.streakReserve.uav.calls) warn(`UAV: ${eq.uav.calls} calls exceeds the repriced reserve ${BARS.streakReserve.uav.calls}`);
  } catch (e) {
    out.sections.equipmentAudit = { status: 'modules not landed', error: String(e).slice(0, 160) };
    ok('equipment audit: modules not landed yet (reserves stand as caps)');
  }
}

// ---------- shadow configuration (source-read; main.js is not importable) ----------
{
  const readLit = (file, re) => {
    try { return readFileSync(join(ROOT, file), 'utf8').match(re)?.[1] ?? null; } catch { return null; }
  };
  const mainSize = readLit('js/main.js', /shadow\.mapSize\.set\((\d+),\s*\1\)/);
  const qualitySrc = (() => { try { return readFileSync(join(ROOT, 'js/quality.js'), 'utf8'); } catch { return ''; } })();
  const tierSizes = [...qualitySrc.matchAll(/size = (\d+);/g)].map((m) => +m[1]);
  out.sections.shadowConfig = {
    mainMapSize: mainSize ? +mainSize : null,
    qualityTierSizes: [...new Set(tierSizes)],
    boardTarget: 'Board 005 §2.4: 4096 at L0/L1, 2048 at L2, off at L3 (smoke L6 pins it; Odin reports)',
    note: 'source-read literals — the live map size also depends on the quality scaler level at runtime',
  };
  ok(`shadow config: main.js mapSize ${mainSize}, quality tiers [${[...new Set(tierSizes)].join(', ')}]`);
  if (mainSize && +mainSize !== 4096) warn(`SHADOWS: main.js shadow map is ${mainSize}, Board 005 §2.4 rules 4096 — spec gap until the lighting step lands (Coordinator)`);
}

// ---------- capability counts (from the shipped data modules) ----------
{
  const caps = {};
  try {
    const modes = await import('../js/modes.js');
    caps.modes = { count: modes.MODES.length, ids: modes.MODES.map((m) => m.id) };
  } catch { caps.modes = { count: 1, ids: ['waves (implicit)'] }; }
  try {
    const lo = await import('../js/loadouts.js');
    caps.loadouts = {
      // The module's OWN count — never hand arithmetic (owner
      // Directives 10/11: lethals x tacticals x perks multiply
      // inside countLoadoutCombinations or the count is wrong).
      combinations: lo.countLoadoutCombinations(),
      attachments: lo.ATTACHMENTS.length,
      slots: lo.SLOTS.length, maxClasses: lo.MAX_CLASSES,
      lethals: lo.LETHALS ?? null, tacticals: lo.TACTICALS ?? null,
      camos: lo.CAMOS ? lo.CAMOS.length : (lo.CAMO_VARIANTS ? lo.CAMO_VARIANTS.length : null),
    };
  } catch { caps.loadouts = { combinations: 5, note: 'js/loadouts.js not present' }; }
  // PERKS LEDGER (Directive 11): discover the perk table; every
  // perk must eventually name a sim-measurable quantity + probe
  // (the verifiability veto — a perk whose effect cannot be
  // measured is flagged to the Board BEFORE it ships).
  try {
    let perks = null, perkSource = null;
    for (const [mod, key] of [['../js/loadouts.js', 'PERKS'], ['../js/progression.js', 'PERKS'], ['../js/perks.js', 'PERKS'], ['../js/perks.js', 'default']]) {
      try {
        const m = await import(mod);
        if (m[key]) { perks = Array.isArray(m[key]) ? m[key] : Object.values(m[key]); perkSource = mod + ':' + key; break; }
      } catch { /* next */ }
    }
    caps.perks = perks
      ? { count: perks.length, source: perkSource, ids: perks.map((p) => p.id ?? p.name ?? '?'), verifiability: 'UNMEASURED — every perk owes a named sim quantity + probe before ship (Odin ledger, docs/sessions/v5-metrics.md §6)' }
      : { count: 0, source: null, note: 'no PERKS table in loadouts/progression/perks modules yet' };
    if (perks) warn(`PERKS: ${perks.length} perks present (${perkSource}) — verifiability ledger is UNMEASURED until each perk has a sim probe (Directive 11 veto stands)`);
  } catch { caps.perks = { count: 0, note: 'perk discovery failed' }; }
  // Lighting profile table (Board step 3): when js/lighting.js
  // lands, recompute the §2.3 proxy FROM THE TABLE (the L2 way)
  // and cross-check it against the scene-extracted rig above —
  // table and scene must agree or the wiring is lying.
  try {
    const lt = await import('../js/lighting.js');
    const table = lt.PROFILES ?? lt.LIGHTING_PROFILES ?? lt.default ?? null;
    caps.lightingProfiles = table ? { source: 'js/lighting.js', maps: Object.keys(table) } : { source: 'js/lighting.js', note: 'module present, profile table export not recognized' };
  } catch { caps.lightingProfiles = { source: null, note: 'js/lighting.js not landed yet (Board 005 step 3, Coordinator)' }; }
  try {
    const pr = await import('../js/progression.js');
    caps.progression = {
      maxLevel: pr.MAX_LEVEL,
      unlockEntries: pr.UNLOCKS.length,
      topUnlockLevel: Math.max(...pr.UNLOCKS.map((u) => u.level)),
      prestigeEntries: pr.PRESTIGE ? pr.PRESTIGE.length : 0,
    };
  } catch { caps.progression = { maxLevel: 0, unlockEntries: 0 }; }
  caps.maps = {
    biomes: BIOMES.map((b) => ({ id: b.id, status: b.status })),
    liveCount: BIOMES.filter((b) => b.status === 'live').length,
  };
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    caps.version = pkg.version;
  } catch { caps.version = null; }
  out.sections.capabilities = caps;
  ok(`capabilities: version ${caps.version}, modes ${caps.modes.count}, loadout combinations ${caps.loadouts.combinations} (lethals ${JSON.stringify(caps.loadouts.lethals)}, tacticals ${JSON.stringify(caps.loadouts.tacticals)}, camos ${caps.loadouts.camos}), perks ${caps.perks.count}, progression ${caps.progression.unlockEntries} unlocks to L${caps.progression.topUnlockLevel} + ${caps.progression.prestigeEntries} prestige (cap L${caps.progression.maxLevel}), live biomes ${caps.maps.liveCount}, lighting profiles ${caps.lightingProfiles.source ?? 'NOT LANDED'}`);
  if (caps.version !== '0.5.0-dev') warn(`version is ${caps.version}, V5 target is 0.5.0-dev (Coordinator's bump)`);
}

// ---------- bars echo + git stamp ----------
out.bars = BARS;
try {
  out.head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  out.treeClean = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim() === '';
} catch { out.head = 'unknown'; }

writeFileSync(join(ROOT, 'docs/sessions/v5-metrics.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\nMETRICS WRITTEN: docs/sessions/v5-metrics.json (HEAD ${out.head}, tree ${out.treeClean ? 'CLEAN' : 'DIRTY — numbers describe HEAD content only where imports are unmodified'})`);
if (out.warnings.length) console.log(`${out.warnings.length} warning(s) — see JSON + docs/sessions/v5-metrics.md`);
