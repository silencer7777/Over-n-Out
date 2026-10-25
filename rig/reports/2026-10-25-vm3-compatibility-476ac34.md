# VM3 Compatibility — 2026-10-25

- Commit: `476ac34a46896acb31af1e1175f20217a90dea9a` — v6(docs): Update 2 landed — ledger entry (before/after per map + §3.4 offsets named) + Update 2 report
- Server: the commit's own `server/server.js` on port 9056; routes per profile: /, /js/main.js, /js/touchcontrols.js, /js/online.js, /css/style.css
- Touch suite: tools/mobile-check.mjs — 40 assertions passed, 0 failed (PASS)
- Verdict: **COMPATIBLE** (6/6 profiles passed)

| Profile | Viewport | Routes | Touch detected | Expected | Result |
|---|---|---|---|---|---|
| desktop-1920 | 1920x1080 | OK | false | false | PASS |
| laptop-1366 | 1366x768 | OK | false | false | PASS |
| touch-laptop-1440 | 1440x900 | OK | false | false | PASS |
| iphone-17-pro | 390x844 | OK | true | true | PASS |
| android-phone | 412x915 | OK | true | true | PASS |
| tablet-1180 | 820x1180 | OK | true | true | PASS |

> Honest limit: this VM proves the served build and the touch/input
> contracts per profile class. It does not render — real layout, GPU and
> thumb truth remain Brett's devices (the M1 rule from the V6 charter).
