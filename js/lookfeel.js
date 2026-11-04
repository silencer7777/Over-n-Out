// lookfeel.js — the look-smoothing integrator (V7.15, DOM-free
// so tools/mobile-check.mjs can prove its cross-refresh
// behavior against the EXACT shipped math).
//
// V7.15 (playtest fix: "looking around is really smooth and
// consistent") — what was inconsistent in the old in-player
// code, in plain terms:
//   1. The U7-03 error-adaptive rate multiplied the approach
//      rate by up to x2.6 based on the CURRENT angular error.
//      The same hand movement therefore got a different camera
//      response depending on how much error happened to be
//      sampled that frame: slow pans trailed, then the camera
//      SURGED as error grew. Maneuver-dependent, frame-sampled
//      gain is the opposite of consistent.
//   2. At high adaptive rates the single-step exponential at
//      30 Hz lands measurably off the 120 Hz path (the step is
//      too coarse for the rate), so phone (60 Hz), desktop
//      (120 Hz+) and a struggling 30 Hz device all felt
//      slightly different games.
// Fixes here: the adaptive term is capped at +50% (flicks
// still catch up faster than fine aim — the U7-03 intent —
// but the response can no longer surge), the ADS precision
// multiplier (x1.5) is unchanged, and the approach is
// INTEGRATED IN SUBSTEPS of at most 1/240 s, which makes the
// discrete trajectory land on the same curve at 20/30/60/120
// Hz and under jittered frame times. Sensitivity meaning is
// untouched: look() targets accumulate exactly as before, and
// the base rate is the shipped 30 (the ~35 ms settle).

export const LOOK_RATE = 30;          // base approach rate (1/s)
export const LOOK_ADAPT_MAX = 0.5;    // adaptive cap: +50% (was +160%)
export const LOOK_ADAPT_GAIN = 0.9;   // per radian of angular error
export const LOOK_ADS_MULT = 1.5;     // ADS precision multiplier (U7-03)
export const LOOK_SUBSTEP = 1 / 240;  // integration substep ceiling (s)

// Approach rate for a given angular error (radians) and aim
// state. Pure function of state — never of frame timing.
export function lookRateFor(angErr, aiming) {
  return LOOK_RATE * (1 + Math.min(LOOK_ADAPT_MAX, angErr * LOOK_ADAPT_GAIN)) * (aiming ? LOOK_ADS_MULT : 1);
}

// Advance (yaw, pitch) toward (targetYaw, targetPitch) by dt
// seconds of look time. Yaw error wraps to the short arc;
// pitch does not wrap (look() clamps it to +/-1.45). Returns
// [yaw, pitch]. dt <= 0 is a no-op.
export function stepLookAngles(yaw, pitch, targetYaw, targetPitch, dt, aiming) {
  if (!(dt > 0)) return [yaw, pitch];
  let remaining = dt;
  while (remaining > 1e-9) {
    const h = Math.min(remaining, LOOK_SUBSTEP);
    let dYaw = targetYaw - yaw;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    const dPitch = targetPitch - pitch;
    const k = 1 - Math.exp(-lookRateFor(Math.hypot(dYaw, dPitch), aiming) * h);
    yaw += dYaw * k;
    pitch += dPitch * k;
    remaining -= h;
  }
  return [yaw, pitch];
}

// The exact frame-rate-independent ease factor the cosmetic
// camera relaxations (leans, sway, ADS blend, FOV) use:
// 1 - exp(-rate * dt). (They previously used min(1, dt * rate),
// a linear approximation whose effective time constant drifts
// with frame rate.)
export function easeK(rate, dt) {
  return 1 - Math.exp(-rate * Math.max(0, dt));
}
