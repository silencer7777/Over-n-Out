# V6 MOBILE — TRY-IT GUIDE (Directive V6-2, Vega)

**Status: built locally, NOT pushed.** This goes live only when the
Coordinator lands it and Brett taps the push. Once live, the SAME
link you already use is the mobile game — no install, no app store:

**https://silencer7777.github.io/Over-n-Out/**

## On your iPhone (Safari)

1. Open the link above in Safari. Landscape is best (rotate the
   phone) — the game handles either, mid-match too.
2. The menu works by tap: pick MISSION, class/weapon, LEVEL as
   usual. Everything tappable is at least 44px tall now.
3. Tap **▶ DEPLOY**. No pointer lock, no extra step — the match
   starts and the touch controls appear.
4. Fight the match (control map below). When you die or the match
   ends, the controls vanish and the menu comes back on its own.
5. Pause any time with the **II** button (top-left). RESUME is the
   big green button in the menu.

Tip: for the full-screen feel, tap Safari's **aA** button →
**Hide Toolbar**, or Add to Home Screen and launch it from there —
same page, more screen.

## Control map

```
  [II] pause        top-right: WAVE / KILLS / HOSTILES
  [STREAK]           (ammo count sits just under them)

  LEFT THUMB anywhere on the left half of the screen:
      press + drag = virtual stick (appears where you touch)
      push it all the way to the edge = SPRINT

  RIGHT THUMB drag anywhere not on a button = LOOK / AIM

  Right-side buttons (top → bottom):
      FLASH   tactical throwable (tap)
      FRAG    lethal throwable (tap)      [sits left of FLASH]
      ADS     aim down sights (tap = on/off, stays lit while on)
      RLD     reload (tap)
      JUMP    (tap/hold)
      FIRE    the big gold one — HOLD to fire

  Bottom-center: [AR] [SMG] [SG] [DMR] [PST] — tap to switch
  weapon; the lit slot is the one in your hands.
```

Notes that matter:
- FIRE is hold-to-fire for the auto weapons; for the DMR/pistol
  each press is one shot, same as a mouse click.
- ADS is a **toggle** (mobile standard), not hold. While ADS is
  on you can't sprint — same rule as desktop.
- The stick is dynamic: it appears wherever your left thumb lands
  on the left half, so there's nothing to hunt for.
- Sound unlocks on your first tap (iOS rule) — DEPLOY counts.

## What to check on the first run (report back)

1. Does DEPLOY start the match instantly, controls visible?
2. Stick feel: can you walk, strafe diagonally, and sprint by
   pushing the stick to its rim?
3. Look feel: is a full swipe across the right side roughly a
   180° turn? Too fast/slow is a one-number change (look scale).
4. Can you hold FIRE + drag look with the same thumb's side of
   the screen while the left thumb keeps you moving?
5. Frame rate: tap F9's job is desktop-only — just tell us if it
   feels smooth or choppy, and on which map. The game starts one
   quality tier lower on phones and steps itself up or down.

## Known limits of this milestone

- **Solo is the proven path.** Online (JOIN ONLINE) also skips
  pointer lock on touch and the same controls feed it, but it has
  not been verified end-to-end on a phone yet — milestone 2.
- HUD hint text still shows the keyboard legends ("R — RELOAD",
  "FRAG [G]") on touch devices. Cosmetic; queued for milestone 2.
- Final proof is your phone: the input state machine is verified
  headlessly (tools/mobile-check.mjs, 40 assertions), and layout /
  perf are set from the iPhone 17 Pro's specs — but only a real
  Safari run confirms WebGL + touch together.
