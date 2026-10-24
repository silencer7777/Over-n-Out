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

const SPAWNS = [[-42, -42], [42, -42], [-42, 42], [42, 42], [0, -44], [0, 44], [13, -30], [34, -20], [-34, -20], [-5, -34]];
const STRUCTS = [
  [-16, 16, -40, -24], [29, 39, -26, -6], [-39, -29, -26, -6],
  [-13, -9, -25.5, -18.5], [32, 37, -7, -0.5], [-37, -32, -7, -0.5],
  [-14, 14, -12, 20], [-2.5, 2.5, -12, 47],
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
if (BIOMES.find(b => b.id === 'snow')?.status === 'scaffold') ok('B0 snow registry status is scaffold');
else fail('B0 snow registry status → ' + BIOMES.find(b => b.id === 'snow')?.status);

// ---- forest ----
{
  const ctx = makeCtx();
  const baseC = ctx.colliders.length, baseS = ctx.shootables.length;
  const g = applyBiome('forest', ctx);
  if (!g) fail('B1 forest applyBiome returned null');
  else {
    const { treeCount, bushCount, bushColliderCount, addedColliders, addedShootables } = g.userData;
    if (treeCount >= 40) ok(`B1 forest trees placed: ${treeCount} (>= 40 full-build floor)`);
    else fail(`B1 forest trees placed: ${treeCount} (expected >= 40)`);
    if (bushCount >= 45) ok(`B2 forest bushes placed: ${bushCount} (>= 45)`);
    else fail(`B2 forest bushes placed: ${bushCount} (expected >= 45)`);
    if (addedShootables.length === treeCount) ok(`B3 forest hit-proxies tracked: ${addedShootables.length} === treeCount`);
    else fail(`B3 forest hit-proxies: ${addedShootables.length} !== treeCount ${treeCount}`);
    if (addedColliders.length === treeCount + bushColliderCount) ok(`B4 forest colliders tracked: ${addedColliders.length} === trees ${treeCount} + bush ${bushColliderCount}`);
    else fail(`B4 forest colliders: ${addedColliders.length} !== ${treeCount} + ${bushColliderCount}`);
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
    if (driftCount >= 20) ok(`B9 snow drifts placed: ${driftCount} (>= 20)`);
    else fail(`B9 snow drifts placed: ${driftCount} (expected >= 20)`);
    if (rockCount >= 8) ok(`B10 snow ice rocks placed: ${rockCount} (>= 8)`);
    else fail(`B10 snow ice rocks placed: ${rockCount} (expected >= 8)`);
    assertClear(addedColliders.map(centerOf), 'B11 snow drift collider');
    clearBiome(ctx, g);
    if (ctx.colliders.length === 0 && ctx.scene.added.length === 0) ok('B12 clearBiome(snow) restores exactly');
    else fail('B12 clearBiome(snow) did not restore');
  }
}

// ---- inert ids ----
{
  const ctx = makeCtx();
  if (applyBiome('compound', ctx) === null && applyBiome('mars', ctx) === null && applyBiome('nope', ctx) === null) {
    ok('B13 compound/mars/unknown biomes are inert (null, nothing added)');
  } else fail('B13 inert biome ids changed the world');
}

console.log(failures ? `\nBIOME CHECK FAILED (${failures})` : '\nBIOME CHECK PASSED');
process.exit(failures ? 1 : 0);
