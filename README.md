# OVER N' OUT 🎖️

A tactical browser FPS, built in public and in stages — starting as a fast,
playable wave-defense shooter and growing, release by release, toward a full
game with accounts, cloud-saved progress, and a cosmetic store.

**Not affiliated with Call of Duty or Activision.** Original name, original
code, original assets. Gameplay *inspired by* the genre's best.

## ▶ Play it (v0.2)

**What's new in v0.2 “ARSENAL”:** a 5-weapon system (Assault Rifle, SMG,
Shotgun, DMR, Pistol) driven by one data table in `js/weapons.js` — pick
your starting weapon in the menu loadout, switch in-game with keys 1–5,
and face bots armed from the same table. Plus the Session 1 realism pass:
dusk sky and shadows, smarter bots, distance-aware audio. Multiplayer
groundwork is designed in `docs/MULTIPLAYER.md` (v3).

You need Node 18+ (nothing to install — zero dependencies):

```bash
node server/server.js
# then open http://localhost:8080
```

**Controls:** WASD move · mouse aim · click fire · Shift sprint · Space jump · R reload · **1–5 switch weapon**.
Survive escalating waves of hostiles in the compound. Headshots do double damage.

## 📁 Layout

| Path | What |
|---|---|
| `index.html`, `css/` | Menu, HUD, styling |
| `js/main.js` | Game loop, waves, shooting, state |
| `js/player.js` | FPS controls, movement physics, view-model gun |
| `js/weapons.js` | The arsenal — one data table for all player + bot weapons |
| `js/bots.js` | Enemy AI (advance / strafe / burst fire, line-of-sight) |
| `js/world.js` | Arena, lighting, collision |
| `js/audio.js` | Synthesized WebAudio SFX (no audio files) |
| `vendor/` | Three.js r160 (vendored — the game works offline) |
| `server/` | Zero-dependency Node static server |
| `backend/` | Where auth / saves / store API will live (see its README) |
| `tools/` | Smoke tests + the code-guardian script |
| `docs/ROADMAP.md` | The staged plan |

## 🛡️ Code guardian

`npm test` runs syntax checks on every module, boots the server, and fetches
the key routes. The same suite runs on GitHub (Actions CI) on every push, and
on a schedule locally via `tools/guardian.sh` (results in `logs/guardian.log`).

## 🗺️ Where this is going

See `docs/ROADMAP.md` — Stage 2 is accounts + cloud saves, Stage 3 is the
store, Stage 4 is multiplayer, Stage 5 is the Unity mobile port.
