# V4 Net Contract — what the Coordinator's systems need from net/

Filed by: V4 Coordinator (systems/integration). Owner of net/:
**Vega**. This is a SPEC, not an edit — everything below is a
request routed through the parent agent, per the territory rules
in Board Meeting 004 (Addendum 1). Protocol stays at 8 message
types (smoke N1 pins the count) and version 1: every extension
rides INSIDE the existing message shapes as optional fields.

## 1. hello extensions (both OPTIONAL; absence = current behavior)

```json
{ "t": "hello", "protocol": 1, "name": "BRETT", "room": "A1B2",
  "mode": "domination",
  "loadout": { "name": "CLASS 1", "primary": "ar",
               "attachments": ["reddot", "extmag"],
               "tactical": "flash", "lethal": "frag" } }
```

- `mode`: one of `js/modes.js` MODE_ORDER ('waves' | 'tdm' |
  'domination' | 'assault'). The FIRST hello in a room sets the
  room's mode; later hellos join that mode (welcome should report
  the room's actual mode so a client that asked for another mode
  learns the truth). Default 'waves' = today's behavior exactly.
- `loadout`: a class object in the shape of `validateClass()` in
  `js/loadouts.js` (DOM-free, importable server-side). The server
  VALIDATES against the same tables; an invalid loadout is
  refused or sanitized — never trusted. The sim player then uses
  `effectiveWeapon(getWeapon(cls.primary), cls.attachments)` for
  mag/reload/interval/spread/falloff, carries 1 lethal + 1
  tactical, and spawns with the class primary (weapon switching
  within a match: keep the current 1–5 behavior for bots parity;
  if the sim restricts the player to their class primary, say so
  in welcome — client will grey out the other slots online).

## 2. input extensions (all OPTIONAL booleans; absent = false)

```json
{ "t": "input", "seq": 12, "keys": { ... }, "yaw": 0, "pitch": 0,
  "fire": true, "reload": false, "weapon": 1,
  "aim": true, "throwLethal": false, "throwTactical": false }
```

- `aim`: held state. While aiming, spread uses the weapon's
  `spreadAds` multiplier from effectiveWeapon() (attachments);
  movement uses `moveAds`. No new fire rules.
- `throwLethal` / `throwTactical`: EDGE booleans (true for one
  input sample). The sim spawns the throwable from
  `js/loadouts.js` THROWABLES (frag: fuse 1.6 s, radius 5.5 m,
  110 centre damage with the barrel-style falloff; flash: fuse
  1.0 s, radius 12 m). Resolution is server-side ONLY: frag
  damages bots/players/barrels by distance; flash blinds bots
  (2.5 s: no fire, visibleTime reset) and any player whose view
  direction faces the burst within radius + LOS — the server
  computes a blind duration 0..blindMax and tells that client via
  an event (see §4); rendering the white-out is client-side.
- Counts: 1 lethal + 1 tactical per life; refilled on redeploy /
  wave clear (waves mode) or respawn (other modes).
- validateInput should accept these fields as optional booleans
  and reject non-boolean values when present (same strictness as
  the existing fields).

## 3. Mode state machines in the sim

Shared definitions: `js/modes.js` (targets, zones, timers). The
sim owns the state; the client renders it. Required behavior:

- **waves**: today's director, unchanged, plus: clearing wave 10
  emits ONE `mode_end` event with result 'win' (endless play
  continues; the run's XP settles there and at `run_over`).
- **tdm**: continuous bot roster (botRoster = 6 alive, respawned
  from spawn points 2.5 s after death), no waves. Team score:
  player-side kills vs player deaths. A downed player respawns
  after respawnDelay at the run spawn (0, 34) with full hp +
  refilled throwables. First to targetKills (30) -> `mode_end`.
- **domination**: zones from modes.js (A/B/C with x/z/y/radius).
  Owner per zone: 'you' | 'kestrel' | null. A zone flips after
  captureSeconds of uncontested presence (players for 'you',
  bots for 'kestrel'; both present = contested, no progress).
  Score ticks every tickSeconds: +tickPoints per held zone to
  the owning side. Bot roster 6 continuous + player respawns as
  TDM. First to targetScore (200) -> `mode_end`.
- **assault**: one channel point (modes.js `point`). Channel
  progress accumulates while >= 1 living player is inside and
  no bot is inside; pauses (does not reset) otherwise. Waves of
  defenders spawn on the existing director cadence. Timer counts
  down from timeLimit (360 s); channel 100% -> `mode_end` 'win';
  timer 0 or team wipe -> `mode_end` 'lose'.

## 4. snapshot + event surface the client consumes

- `snapshot.match` gains: `mode` (id), `scoreYou`, `scoreThem`,
  `zones` (domination: [{ id, owner, progress 0..1 }]), `channel`
  (assault: 0..100), `timeLeft` (assault seconds), `phase`
  ('playing' | 'over'). Existing fields stay.
- New event kinds (inside the existing `event` message):
  - `{ kind: 'throwable', id, by, x, y, z, vx, vy, vz }` on throw
    (client renders the arc; the fuse outcome arrives as below).
  - `{ kind: 'frag_explode', x, y, z }` and
    `{ kind: 'flash_explode', x, y, z, blind: <seconds, per
    recipient> }` — blind is computed per recipient; send each
    client its own value (or 0).
  - `{ kind: 'mode_score', scoreYou, scoreThem }` on score change
    (also covered by snapshots; events give the HUD its pop).
  - `{ kind: 'mode_end', result: 'win'|'lose', scoreYou,
    scoreThem, xp: { <playerId>: totalXp }, xpBySource:
    { <playerId>: { kill: n, ... } } }` — XP computed SERVER-side
    from `js/progression.js` XP_VALUES against sim events (kills,
    headshots, wave clears, captures, channel seconds, win). The
    client displays it in the post-match summary and persists the
    solo profile only from its own solo matches; online XP stays
    server-reported per session (accounts are a future seam).

## 5. What the client guarantees

- js/online.js sends hello with mode + the ACTIVE class loadout
  from the local profile, inputs at 30 Hz with the §2 fields,
  renders snapshot.match via the same objectiveText() the solo
  HUD uses, and falls back to solo on any transport failure.
- The client never sends outcomes — inputs only, as today.

Numbers in modes.js / loadouts.js / progression.js are
coordinator assumptions pending HAVOC's design pack; if Havoc
retunes, only those tables change — this contract's SHAPES are
stable. Questions -> parent agent.
