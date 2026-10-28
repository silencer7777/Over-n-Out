// ============================================================
// STANCE (V6 Update 6, U6-10) — crouch + prone, shared by the
// solo client (js/player.js) and the authoritative sim
// (net/sim.js) so the rules can never diverge.
//
// Havoc's key reconciliation (the CoD pattern):
//   sprint + tap C/Ctrl  -> SLIDE (unchanged from U5 — the
//                           slide consumes the press)
//   tap C/Ctrl           -> crouch toggle (stand<->crouch;
//                           from prone, a tap rises to crouch)
//   double-tap C/Ctrl    -> prone
//   hold C/Ctrl >= 0.28s -> prone
//   Z                    -> prone toggle (dedicated key)
//   slide ends           -> you are crouched (U5 already dipped
//                           the camera; now it's a real stance)
//   jump or sprint       -> stands you up
//
// Numbers (Havoc): eye height / ground-speed multiplier /
// spread multiplier / bot hit-chance multiplier per stance.
// Collision is UNCHANGED: the player capsule and the step/jump
// reachability model do not shrink — stance is posture (eye,
// speed, steadiness, profile), not a smaller box. That keeps
// every reachability proof honest by construction.
// ============================================================

export const STANCE = {
  stand:  { eye: 1.66, speed: 1.00, spread: 1.00, hit: 1.00 }, // eye = the shipped EYE constant in player.js
  crouch: { eye: 1.05, speed: 0.55, spread: 0.85, hit: 0.90 },
  prone:  { eye: 0.55, speed: 0.22, spread: 0.65, hit: 0.75 },
};
export const STANCE_HOLD_S = 0.28;    // hold C/Ctrl this long -> prone
export const STANCE_DOUBLE_TAP_S = 0.32; // second tap inside this window -> prone

export function createStanceState() {
  return {
    stance: 'stand',
    t: 0,               // local clock (accumulates dt)
    holdT: 0,           // how long the stance key has been held
    prevHeld: false,
    prevProne: false,
    holdConsumed: false, // this press already produced prone (or a slide)
    lastTapT: -10,
  };
}

// Advance the stance state machine by dt. o:
//   held         stance key (C/Ctrl) currently held
//   proneHeld    dedicated prone key (Z) currently held
//   tapRequest   one-frame tap from the touch CROUCH button
//   jumpPressed  jump edge this frame
//   sprintActive sprint input with movement intent
//   slideStarted a slide began this frame (consumes the press)
//   slideEnded   a slide finished this frame (-> crouch)
export function stepStance(st, o, dt) {
  st.t += dt;
  if (o.slideStarted) {
    // The press became a slide (U5's rule wins) — it must not
    // ALSO toggle a stance on release.
    st.holdConsumed = true;
  }
  if (o.slideEnded) st.stance = 'crouch'; // a slide always ends in a crouch

  // Dedicated prone key: edge toggles prone.
  const proneEdge = !!o.proneHeld && !st.prevProne;
  st.prevProne = !!o.proneHeld;
  if (proneEdge) st.stance = st.stance === 'prone' ? 'stand' : 'prone';

  // Touch CROUCH button = a synthetic tap.
  if (o.tapRequest) tapAction(st);

  // Jump / sprint stand you up.
  if (o.jumpPressed && st.stance !== 'stand') st.stance = 'stand';
  if (o.sprintActive && st.stance !== 'stand') st.stance = 'stand';

  const held = !!o.held;
  if (held && !st.prevHeld) {
    st.holdT = 0;
    st.holdConsumed = !!o.slideStarted; // a press that became a slide is spent
  }
  if (held) {
    st.holdT += dt;
    if (st.holdT >= STANCE_HOLD_S && !st.holdConsumed) {
      st.stance = 'prone';
      st.holdConsumed = true;
    }
  } else if (st.prevHeld) {
    // Release: a short, unconsumed press is a tap.
    if (!st.holdConsumed && st.holdT < STANCE_HOLD_S) tapAction(st);
    st.holdT = 0;
    st.holdConsumed = false;
  }
  st.prevHeld = held;
  return st.stance;
}

function tapAction(st) {
  if (st.t - st.lastTapT < STANCE_DOUBLE_TAP_S) {
    st.stance = 'prone';
  } else if (st.stance === 'stand') {
    st.stance = 'crouch';
  } else if (st.stance === 'crouch') {
    st.stance = 'stand';
  } else {
    st.stance = 'crouch'; // prone -> crouch on a single tap
  }
  st.lastTapT = st.t;
}
