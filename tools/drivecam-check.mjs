// drivecam-check.mjs — DRIVING CAMERA PROOF (V7.16; promoted
// from the Nov 4 playtest diagnosis probes per the Item 10
// team upgrade: every harness this run creates joins the
// permanent gate suite).
//
// Brett's report: "fix the driving trucks — you can't see."
// Root cause, proven below with the REAL vehicle actors and
// the REAL vendored three (Mesh.raycast culls exactly like
// the rasterizer for FrontSide materials — probe-verified):
// the pre-V7.16 driver eye sat INSIDE the truck cab at
// rig-local (0, seatHeight, 0), 0.84 m behind the opaque
// windshield box at eye height — the windshield slab + hood
// filled the forward view and hid the road.
//
// Assertions:
//   DC1 geometry sane (verts, no NaN) for both vehicles.
//   DC2 DEFECT WITNESS: from the old in-cab eye, the truck's
//       level ray hits the vehicle < 1.5 m (the windshield);
//       the open quad's level ray does not (it was fine).
//   DC3 CHASE VIEW: from the shipped chase eye (spec
//       camBack/camLift + the poseDriveRig tilt formula) the
//       vehicle is IN frame low-centre (view-axis ray hits it
//       at driving distance), the view over it is clear (a
//       ray above the vehicle hits nothing of it for 25 m —
//       the road reads past it), and the vehicle fills a
//       sane share of the view grid (present, not a wall).
//   DC4 wiring pins: poseDriveRig + spec camera fields + the
//       on-foot eye restore on both exit paths.
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register(new URL('./three-vendor-loader.mjs', import.meta.url));
const THREE = await import('three');
const { createVehicleActor } = await import('../js/equipment.js');
const { VEHICLE_SPEC } = await import('../js/vehicles.js');

let failures = 0;
const ok = m => console.log('✓ ' + m);
const fail = m => { failures++; console.error('✗ ' + m); };
const chk = (cond, m) => (cond ? ok(m) : fail(m));

function rayHit(mesh, eye, pitch, yaw = 0, far = 40) {
  const rc = new THREE.Raycaster(); rc.far = far;
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();
  rc.set(eye, dir);
  const hits = rc.intersectObject(mesh, false);
  return hits.length ? hits[0].distance : Infinity;
}

for (const id of ['truck', 'quad']) {
  const spec = VEHICLE_SPEC[id];
  const actor = createVehicleActor(id, () => 0);
  actor.group.updateMatrixWorld(true);
  const mesh = actor.group.children[0];
  const pos = mesh.geometry.getAttribute('position');
  let nan = 0;
  for (let i = 0; i < pos.count; i++) if (!Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))) nan++;
  chk(pos.count > 500 && nan === 0, `DC1 ${id} geometry: ${pos.count} verts, ${nan} NaN`);

  // DC2 — the old eye.
  const oldEye = new THREE.Vector3(0, spec.seatHeight, 0);
  const oldHit = rayHit(mesh, oldEye, 0);
  if (id === 'truck') chk(oldHit < 1.5, `DC2 defect witness: old in-cab eye's level ray hits the windshield at ${oldHit.toFixed(2)} m (< 1.5)`);
  else chk(oldHit === Infinity, `DC2 quad control: old open-air eye's level ray is clear (${oldHit === Infinity ? 'no hit' : oldHit.toFixed(2)})`);

  // DC3 — the shipped chase view (mirrors poseDriveRig math).
  chk(spec.camBack > 3 && spec.camLift > 0.8, `DC3 ${id} spec carries a chase offset (back ${spec.camBack}, lift ${spec.camLift})`);
  const camY = spec.seatHeight + spec.camLift;
  const tilt = Math.atan2(camY - spec.seatHeight * 0.75, spec.camBack);
  const eye = new THREE.Vector3(0, camY, spec.camBack);
  const axisHit = rayHit(mesh, eye, -tilt);
  chk(axisHit > 3 && axisHit < 13, `DC3 ${id} view-axis ray meets the vehicle at ${axisHit.toFixed(2)} m (in frame, driving distance)`);
  const overHit = rayHit(mesh, eye, -tilt + 0.32, 0, 25);
  chk(overHit === Infinity, `DC3 ${id} view over the vehicle is clear for 25 m (road/environment reads past it)`);
  let selfHits = 0, total = 0;
  for (let xi = -8; xi <= 8; xi++) for (let yi = -6; yi <= 6; yi++) {
    total++;
    const d = rayHit(mesh, eye, -tilt + yi * 0.075, xi * 0.075, 14);
    if (d < 14) selfHits++;
  }
  const share = selfHits / total;
  chk(share > 0.03 && share < 0.45, `DC3 ${id} vehicle fills ${(share * 100).toFixed(0)}% of the chase view grid (present, not a wall; old truck eye was ~66%)`);
}

// DC4 — wiring.
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
chk(main.includes('function poseDriveRig') && main.includes('st.spec.camBack') && main.includes('st.spec.camLift'),
  'DC4 drive pose: poseDriveRig reads the spec chase offsets');
chk((main.match(/camera\.position\.set\(0, EYE, 0\)/g) || []).length >= 2,
  'DC4 both exit paths restore the on-foot eye (solo exitVehicle + online transition)');

console.log(failures ? `\nDRIVECAM CHECK FAILED (${failures})` : '\nDRIVECAM CHECK PASSED');
process.exit(failures ? 1 : 0);
