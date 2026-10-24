// Biome check (Terraform/Ivanova + Patel): exercise the REAL
// js/biomes.js placement code headlessly (via tools/three-stub.mjs)
// and machine-verify the guarantees the game relies on:
//   - forest full build: >= 40 trees / >= 45 bushes placed
//   - snow scaffold: >= 20 drifts placed
//   - every placed trunk/drift keeps the spawn clearance (>= 3.6 m
//     from all 10 bot spawn points) and stays out of the course
//     structures (decks, stairs, central ground, corridor)
//   - tree self-separation holds (>= 3.09 m pairwise)
//   - gameplay colliders are tracked exactly (trees + big bushes)
//   - clearBiome() restores colliders/shootables index-exactly
// Exit 1 on any failure, 0 with 'BIOME CHECK PASSED' otherwise.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);

const src = readFileSync(join(ROOT, 'js/biomes.js'), 'utf8');
const stubUrl = pathToFileURL(join(ROOT, 'tools/three-stub.mjs')).href;
const tmp = join(ROOT, 'tools/.biomes-check-tmp.mjs');
writeFileSync(tmp, src.replace("from 'three'", `from '${stubUrl}'`));
let biomes;
try {
  biomes = await import(pathToFileURL(tmp).href);
} finally {
  try { unlinkSync(tmp); } catch {}
}
const { applyBiome, clearBiome, BIOMES } = biomes;

const SPAWNS = [[-42, -42], [42, -42], [-42, 42], [42, 42], [0, -44], [0, 44], [13, -30], [34, -20], [-34, -20], [-5, -34], [0, -58], [0, 58]];
const STRUCTS = [
  [-16, 16, -40, -24], [29, 39, -26, -6], [-39, -29, -26, -6],
  [-13, -9, -25.5, -18.5], [32, 37, -7, -0.5], [-37, -32, -7, -0.5],
  [-14, 14, -12, 20], [-2.5, 2.5, -62, 62],
  // V4 ring POIs (Atlas) — biome dressing must never land on them.
  [33, 47, -61, -47], [-52, -36, -61.6, -52], [-61, -51.4, -13.1, 21.1], [37, 59, 43, 60],
];
function makeCtx() {
  return {
    scene: { added: [], add(g) { this.added.push(g); }, remove(g) { const i = this.added.indexOf(g); if (i !== -1) this.added.splice(i, 1); } },
    colliders: [], shootables: [],
  };
}
function centerOf(box) { return [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2]; }
function assertClear(centers, label) {
  let bad = 0;
  for (const [x, z] of centers) {
    for (const [sx, sz] of SPAWNS) if (Math.hypot(x - sx, z - sz) < 3.59) { bad++; fail(`${label} at (${x.toFixed(1)},${z.toFixed(1)}) inside spawn clearance of (${sx},${sz})`); }
    for (const [x0, x1, z0, z1] of STRUCTS) if (x > x0 && x < x1 && z > z0 && z < z1) { bad++; fail(`${label} at (${x.toFixed(1)},${z.toFixed(1)}) inside structure rect [${x0},${x1},${z0},${z1}]`); }
  }
  if (!bad) ok(`${label}: all ${centers.length} placements clear of spawns + structures`);
}

// ---- registry ----
if (BIOMES.find(b => b.id === 'forest')?.status === 'live') ok('B0 forest registry status is live (full build)');
else fail('B0 forest registry status → ' + BIOMES.find(b => b.id === 'forest')?.status);
if (BIOMES.find(b => b.id === 'snow')?.status === 'live') ok('B0 snow registry status is live (V4 full build)');
else fail('B0 snow registry status → ' + BIOMES.find(b => b.id === 'snow')?.status);
if (BIOMES.find(b => b.id === 'mars')?.status === 'live') ok('B0 mars registry status is live (V4 full build)');
else fail('B0 mars registry status → ' + BIOMES.find(b => b.id === 'mars')?.status);

// ---- forest ----
{
  const ctx = makeCtx();
  const baseC = ctx.colliders.length, baseS = ctx.shootables.length;
  const g = applyBiome('forest', ctx);
  if (!g) fail('B1 forest applyBiome returned null');
  else {
    const { treeCount, bushCount, bushColliderCount, addedColliders, addedShootables } = g.userData;
    const mastMeshes = g.userData.mastMeshCount || 0;
    // V4 floors (Atlas): the ±62 forest targets 84 trees / 92 bushes.
    if (treeCount >= 70) ok(`B1 forest trees placed: ${treeCount} (>= 70 V4 floor)`);
    else fail(`B1 forest trees placed: ${treeCount} (expected >= 70)`);
    if (bushCount >= 80) ok(`B2 forest bushes placed: ${bushCount} (>= 80 V4 floor)`);
    else fail(`B2 forest bushes placed: ${bushCount} (expected >= 80)`);
    if (addedShootables.length === treeCount + mastMeshes) ok(`B3 forest hit-proxies tracked: ${addedShootables.length} === treeCount + mast meshes`);
    else fail(`B3 forest hit-proxies: ${addedShootables.length} !== treeCount ${treeCount} + mast ${mastMeshes}`);
    if (addedColliders.length === treeCount + bushColliderCount + 1) ok(`B4 forest colliders tracked: ${addedColliders.length} === trees ${treeCount} + bush ${bushColliderCount} + mast 1`);
    else fail(`B4 forest colliders: ${addedColliders.length} !== ${treeCount} + ${bushColliderCount} + 1 (mast)`);
    if (g.userData.mastPoi && g.userData.mastPoi.x === -16 && g.userData.mastPoi.z === 56 && mastMeshes === 4) {
      ok('B14 forest fallen-mast POI present at (-16, 56) with 4 tracked meshes + collider');
    } else fail(`B14 forest mast POI → ${JSON.stringify(g.userData.mastPoi)} meshes=${mastMeshes}`);
    if (bushColliderCount > 0) ok(`B5 forest bush gameplay live: ${bushColliderCount} blocking bushes`);
    else fail('B5 forest bush gameplay: 0 blocking bushes (expected > 0)');
    const treeCenters = addedColliders.slice(0, treeCount).map(centerOf);
    assertClear(treeCenters, 'B6 forest trunk');
    let minSep = Infinity;
    for (let i = 0; i < treeCenters.length; i++) for (let j = i + 1; j < treeCenters.length; j++) {
      minSep = Math.min(minSep, Math.hypot(treeCenters[i][0] - treeCenters[j][0], treeCenters[i][1] - treeCenters[j][1]));
    }
    if (minSep >= 3.09) ok(`B7 forest tree separation min ${minSep.toFixed(2)} m >= 3.09`);
    else fail(`B7 forest tree separation min ${minSep.toFixed(2)} m < 3.09`);
    clearBiome(ctx, g);
    if (ctx.colliders.length === baseC && ctx.shootables.length === baseS && ctx.scene.added.length === 0) ok('B8 clearBiome(forest) restores arrays + scene exactly');
    else fail(`B8 clearBiome(forest): colliders ${ctx.colliders.length}, shootables ${ctx.shootables.length}, scene ${ctx.scene.added.length}`);
  }
}

// ---- snow ----
{
  const ctx = makeCtx();
  const g = applyBiome('snow', ctx);
  if (!g) fail('B9 snow applyBiome returned null');
  else {
    const { driftCount, rockCount, addedColliders } = g.userData;
    // V4 floors (Atlas): full build targets 46 drifts / 16 rocks.
    if (driftCount >= 40) ok(`B9 snow drifts placed: ${driftCount} (>= 40 V4 floor)`);
    else fail(`B9 snow drifts placed: ${driftCount} (expected >= 40)`);
    if (rockCount >= 14) ok(`B10 snow ice rocks placed: ${rockCount} (>= 14 V4 floor)`);
    else fail(`B10 snow ice rocks placed: ${rockCount} (expected >= 14)`);
    if (g.userData.snowOverlay === true && g.userData.domePoi?.x === 52 && g.userData.domePoi?.z === -52
      && g.userData.domeMeshCount === 4 && g.userData.iceDiscs === 5) {
      ok('B15 snow full build present: blanket overlay + buried dome POI (4 meshes) + 5 ice discs');
    } else fail(`B15 snow full build → overlay=${g.userData.snowOverlay} dome=${JSON.stringify(g.userData.domePoi)} meshes=${g.userData.domeMeshCount} ice=${g.userData.iceDiscs}`);
    assertClear(addedColliders.map(centerOf), 'B11 snow drift collider');
    clearBiome(ctx, g);
    if (ctx.colliders.length === 0 && ctx.scene.added.length === 0) ok('B12 clearBiome(snow) restores exactly');
    else fail('B12 clearBiome(snow) did not restore');
  }
}

// ---- mars (V4 full build) ----
{
  const ctx = makeCtx();
  const g = applyBiome('mars', ctx);
  if (!g) fail('B16 mars applyBiome returned null');
  else {
    const { rockCount, addedColliders } = g.userData;
    if (rockCount >= 36) ok(`B16 mars rust rocks placed: ${rockCount} (>= 36)`);
    else fail(`B16 mars rust rocks placed: ${rockCount} (expected >= 36)`);
    if (g.userData.regolithOverlay === true && g.userData.craterPoi?.x === -30 && g.userData.craterPoi?.z === 52
      && g.userData.craterRocks === 9 && g.userData.mesaCount === 3
      && g.userData.spirePoi?.x === 50 && g.userData.spirePoi?.z === -52 && g.userData.spireMeshCount === 6) {
      ok('B17 mars POIs present: regolith blanket + crater (9 rim rocks) + 3 mesas + uplink spire (6 meshes)');
    } else fail(`B17 mars POIs → overlay=${g.userData.regolithOverlay} crater=${JSON.stringify(g.userData.craterPoi)}/${g.userData.craterRocks} mesas=${g.userData.mesaCount} spire=${JSON.stringify(g.userData.spirePoi)}/${g.userData.spireMeshCount}`);
    if (typeof g.userData.dressingApplied === 'boolean') {
      ok(`B18 mars sky/fog dressing guarded (applied=${g.userData.dressingApplied} in headless context — must be false here)`);
      if (g.userData.dressingApplied !== false) fail('B18 mars dressing applied in a headless context — guards are wrong');
    } else fail('B18 mars dressingApplied flag missing');
    assertClear(addedColliders.map(centerOf), 'B19 mars collider');
    clearBiome(ctx, g);
    if (ctx.colliders.length === 0 && ctx.shootables.length === 0 && ctx.scene.added.length === 0) ok('B20 clearBiome(mars) restores arrays + scene exactly');
    else fail(`B20 clearBiome(mars): colliders ${ctx.colliders.length}, shootables ${ctx.shootables.length}, scene ${ctx.scene.added.length}`);
  }
}

// ---- inert ids ----
{
  const ctx = makeCtx();
  if (applyBiome('compound', ctx) === null && applyBiome('nope', ctx) === null) {
    ok('B13 compound/unknown biomes are inert (null, nothing added)');
  } else fail('B13 inert biome ids changed the world');
}

// ============================================================
// L-series — DISTINCT-MAP LAYOUTS (V5, Atlas; Board 005 §3.2:
// biome-check converts to per-map layout checks as maps land).
// The dressing B-sections above still guard the transition
// state; these sections guard the layouts themselves, built
// with the REAL three via the vendor loader (mapbuilders.js
// uses geo.js merges the stub can't serve). A map's registry
// flag flips to distinct only with its L-section green.
// ============================================================
{
  const { register } = await import('node:module');
  register(join(ROOT, 'tools/three-vendor-loader.mjs'), import.meta.url);
  const THREE = await import(pathToFileURL(join(ROOT, 'vendor/three.module.js')).href);
  const { buildMapLayout, LAYOUT_IDS } = await import(pathToFileURL(join(ROOT, 'js/mapbuilders.js')).href);

  if (LAYOUT_IDS.join(',') === 'forest,snow,mars') ok('L0 layout ids: forest, snow, mars');
  else fail('L0 layout ids → ' + LAYOUT_IDS.join(','));

  for (const id of LAYOUT_IDS) {
    const D = await import(pathToFileURL(join(ROOT, `js/worlddata-${id}.js`)).href);
    const tag = 'L-' + id;
    // Data contract (Board §3.2 shape, compound-identical).
    const contractOk = D.BOUNDS === 62 && D.SPAWN_POINTS.length === 8
      && D.SOLIDS.length > 0 && D.STRUCTURE_STYLE.length === D.SOLIDS.length
      && D.MODE_ZONES.A && D.MODE_ZONES.B && D.MODE_ZONES.C && D.ASSAULT_TARGET
      && D.PICKUP_CACHES.length === 2 && D.TRANSMISSIONS.length === 3 && D.BARRELS.length >= 1;
    if (contractOk) ok(`${tag} data contract complete (solids ${D.SOLIDS.length}, extra ${D.EXTRA_COLLIDERS.length}, all ${D.allColliders().length})`);
    else fail(`${tag} data contract incomplete`);
    // Barrels have matching EXTRA colliders (the compound rule).
    let barrelOk = true;
    for (const b of D.BARRELS) {
      const hit = D.EXTRA_COLLIDERS.some(e => Math.abs((e.min[0] + e.max[0]) / 2 - b.x) < 0.01 && Math.abs((e.min[2] + e.max[2]) / 2 - b.z) < 0.01 && Math.abs(e.max[1] - 1.12) < 0.01);
      if (!hit) { barrelOk = false; fail(`${tag} barrel (${b.x},${b.z}) lacks its EXTRA collider`); }
    }
    if (barrelOk) ok(`${tag} every barrel has its collider`);
    // Spawns stand on honest ground.
    let spawnOk = true;
    for (const [sx, sy, sz] of D.SPAWN_POINTS) {
      if (D.groundHeightAt(sx, sz, 0) > 0.001) { spawnOk = false; fail(`${tag} spawn (${sx},${sz}) not on ground floor`); }
      for (const e of D.EXTRA_COLLIDERS) {
        if (sx > e.min[0] && sx < e.max[0] && sz > e.min[2] && sz < e.max[2]) { spawnOk = false; fail(`${tag} spawn (${sx},${sz}) inside an EXTRA collider`); }
      }
    }
    if (spawnOk) ok(`${tag} all 8 spawns on open ground`);
    // Zones/assault: the floor at the centre is within the
    // game's own capture tolerance (|pos.y - zone.y| < 3.2).
    let zoneOk = true;
    for (const [k, zn] of [...Object.entries(D.MODE_ZONES), ['assault', D.ASSAULT_TARGET]]) {
      const floor = D.groundHeightAt(zn.x, zn.z, zn.y);
      if (!(floor > zn.y - 3.2 && floor <= zn.y + 0.601)) { zoneOk = false; fail(`${tag} zone ${k} floor ${floor} vs zone y ${zn.y}`); }
    }
    if (zoneOk) ok(`${tag} zone/assault floors agree with their y (capture tolerance)`);
    // Layout builds and mirrors the data exactly.
    const scene = new THREE.Scene();
    const L = buildMapLayout(id, scene);
    if (!L) { fail(`${tag} buildMapLayout returned null`); continue; }
    if (L.colliders.length === D.allColliders().length) ok(`${tag} layout colliders == data (${L.colliders.length})`);
    else fail(`${tag} layout colliders ${L.colliders.length} != data ${D.allColliders().length}`);
    const explosive = L.shootables.filter(s => s.userData && s.userData.explosive).length;
    if (explosive === D.BARRELS.length) ok(`${tag} explosive shootables == barrels (${explosive})`);
    else fail(`${tag} explosive shootables ${explosive} != barrels ${D.BARRELS.length}`);
    // Static draw-call budget: layouts must stay lean (the
    // reclaim lives here — measured builds run 16-18).
    let calls = 0;
    L.group.traverse(o => {
      if ((o.isMesh || o.isInstancedMesh) && o.visible !== false && !(o.material && o.material.visible === false)) calls++;
    });
    if (calls <= 40) ok(`${tag} layout static draw calls: ${calls} (<= 40 layout budget)`);
    else fail(`${tag} layout static draw calls: ${calls} (> 40)`);
    // Per-map scatter floors.
    if (id === 'forest') {
      if (D.TREE_SPOTS.length >= 100 && D.TREE_COLLIDERS.length === D.TREE_SPOTS.length) ok(`${tag} tree scatter ${D.TREE_SPOTS.length} with 1:1 trunk colliders`);
      else fail(`${tag} tree scatter ${D.TREE_SPOTS.length} / colliders ${D.TREE_COLLIDERS.length}`);
      let proxies = 0;
      L.group.traverse(o => { if (o.isMesh && o.material && o.material.visible === false) proxies++; });
      if (proxies === D.TREE_SPOTS.length) ok(`${tag} trunk bullet proxies == trees (${proxies})`);
      else fail(`${tag} trunk proxies ${proxies} != trees ${D.TREE_SPOTS.length}`);
    }
    if (id === 'snow' && !(D.DRIFT_SPOTS.length >= 40)) fail(`${tag} drift scatter ${D.DRIFT_SPOTS.length} (< 40)`);
    if (id === 'snow' && D.DRIFT_SPOTS.length >= 40) ok(`${tag} drift scatter ${D.DRIFT_SPOTS.length}`);
    if (id === 'mars' && !(D.ROCK_SPOTS.length >= 36)) fail(`${tag} rock scatter ${D.ROCK_SPOTS.length} (< 36)`);
    if (id === 'mars' && D.ROCK_SPOTS.length >= 36) ok(`${tag} rock scatter ${D.ROCK_SPOTS.length}`);
  }
  if (buildMapLayout('compound', new THREE.Scene()) === null) ok('L9 compound id stays with buildWorld (null layout)');
  else fail('L9 compound id must not build a layout');
}

console.log(failures ? `\nBIOME CHECK FAILED (${failures})` : '\nBIOME CHECK PASSED');
process.exit(failures ? 1 : 0);
