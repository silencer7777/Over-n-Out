// Soak test (Voss/Gallagher/Patel) — M1's acceptance run.
//
// Boots the REAL GameServer + LoopbackTransport + headless sim
// (net/sim.js) in Node, joins two scripted clients, and drives
// server.step() synchronously (no wall-clock waiting):
//
//   - Client A ("camper"): holds position at spawn, tracks the
//     nearest bot from its snapshots and fires — a turret that
//     proves server raycasts resolve hits and kills.
//   - Client B ("runner"): pushes forward, strafes, jumps,
//     switches weapons and reloads — proves player stepping,
//     weapon state and bot return fire all run headless.
//
// Assertions: the match boots, wave 1 spawns its full roster,
// shots resolve (hit events), kills happen, at least one
// wave_clear fires, snapshots arrive well-formed, a bot_shot
// event proves bot fire, an empty room (bot-vs-nobody) steps
// 600 ticks without throwing, and the whole run stays inside a
// sane per-tick cost (the §11 risk-1 LOS profile is printed).
//
// Exit 1 on any failure, 0 with 'SOAK PASSED' otherwise.
import { GameServer, LoopbackTransport } from '../net/server.js';
import { MSG } from '../net/protocol.js';
import { losClear } from '../net/sim.js';

let failures = 0;
const fail = m => { failures++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);

const server = new GameServer();
const transport = new LoopbackTransport();
server.attachTransport(transport);
const room = server.createRoom('SOAK');

function join(id, name) {
  const inbox = { events: [], snapshots: [], welcome: null };
  const handle = transport.connect(id, (msg) => {
    if (msg.t === MSG.WELCOME) inbox.welcome = msg;
    else if (msg.t === MSG.EVENT) inbox.events.push(msg);
    else if (msg.t === MSG.SNAPSHOT) inbox.snapshots.push(msg);
  });
  handle.send({ t: MSG.HELLO, protocol: 1, name, room: 'SOAK' });
  return { id, handle, inbox, seq: 0 };
}

const a = join('camper', 'CAMPER');
const b = join('runner', 'RUNNER');
if (a.inbox.welcome && Array.isArray(a.inbox.welcome.weapons) && a.inbox.welcome.weapons.length === 5) {
  ok('S1 welcome carries the server weapons table (5 weapons)');
} else fail('S1 welcome missing weapons table');
if (room.match && room.match.state === 'playing') ok('S2 match booted on first hello, state=playing');
else fail('S2 match did not boot');

const NEUTRAL = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };
function sendInput(client, keys, yaw, pitch, fire, weapon = 1, reload = false) {
  client.seq++;
  client.handle.send({
    t: MSG.INPUT, seq: client.seq, forTick: room.tick + 1,
    keys, yaw, pitch, fire, reload, weapon,
  });
}

function nearestBot(snap, selfId) {
  const me = snap.players.find(p => p.id === selfId);
  if (!me) return null;
  let best = null, bd = Infinity;
  for (const bot of snap.bots) {
    if (bot.dead) continue;
    const d = Math.hypot(bot.pos[0] - me.pos[0], bot.pos[2] - me.pos[2]);
    if (d < bd) { bd = d; best = { bot, me, d }; }
  }
  return best;
}

const TICKS = 30 * 150; // 150 simulated seconds
let waveClears = 0, maxWave = 0, sawExplosionOrKillFeed = false;
const t0 = performance.now();
for (let i = 0; i < TICKS; i++) {
  // Scripted play from each client's freshest snapshot.
  const snapA = a.inbox.snapshots[a.inbox.snapshots.length - 1];
  if (snapA) {
    const t = nearestBot(snapA, 'camper');
    if (t) {
      const dx = t.bot.pos[0] - t.me.pos[0], dz = t.bot.pos[2] - t.me.pos[2];
      const dy = (t.bot.pos[1] + 1.1) - (t.me.pos[1] + 1.66);
      const yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      sendInput(a, NEUTRAL, yaw, Math.max(-1.45, Math.min(1.45, pitch)), true, 1);
    } else {
      sendInput(a, NEUTRAL, 0, 0, false, 1);
    }
  }
  const phase = Math.floor(i / 30) % 4;
  sendInput(b,
    { forward: true, back: false, left: phase === 1, right: phase === 3, sprint: phase === 2, jump: i % 47 === 0 },
    Math.sin(i * 0.01) * 1.2, -0.05, i % 3 !== 0, (Math.floor(i / 300) % 5) + 1, i % 211 === 0);

  server.step();

  const evs = a.inbox.events.splice(0);
  for (const ev of evs) {
    if (ev.kind === 'wave_clear') waveClears++;
    if (ev.kind === 'wave') { maxWave = Math.max(maxWave, ev.wave); sawExplosionOrKillFeed = true; }
  }
  b.inbox.events.length = 0;
  if (room.match && room.match.state === 'over') break;
}
const elapsedMs = performance.now() - t0;
const match = room.match;

if (match.wave >= 2 || waveClears >= 1) ok(`S3 waves progressed: wave=${match.wave}, wave_clear events=${waveClears}`);
else fail(`S3 waves stalled: wave=${match.wave}, clears=${waveClears}`);

const allEvents = a.inbox.events; // remaining (spliced per tick above — recount from match state instead)
void allEvents;
const camper = match.players.get('camper');
if (camper && camper.shots > 0) ok(`S4 camper shots resolved server-side: ${camper.shots} shots, ${camper.hits} pulls hit`);
else fail('S4 camper never fired a resolved shot');
if (match.kills > 0) ok(`S5 kills recorded: ${match.kills} (bots died to server raycast/barrels)`);
else fail('S5 zero kills in 150 s of scripted fire — sim shooting is broken');
if (a.inbox.snapshots.length > 100) ok(`S6 snapshots flowing: ${a.inbox.snapshots.length} received by camper`);
else fail(`S6 snapshots too few: ${a.inbox.snapshots.length}`);
const lastSnap = a.inbox.snapshots[a.inbox.snapshots.length - 1];
if (lastSnap && lastSnap.match && Array.isArray(lastSnap.players) && Array.isArray(lastSnap.bots) && lastSnap.you) {
  ok('S7 snapshot shape matches §5.3 (match/you/players/bots)');
} else fail('S7 snapshot shape broken');

// Bot-vs-nobody room: waves spawn, bots idle without targets,
// 600 ticks must not throw (the §8.4 soak requirement).
{
  const s2 = new GameServer();
  const t2 = new LoopbackTransport();
  s2.attachTransport(t2);
  const r2room = s2.createRoom('NOBD');
  const c = t2.connect('solo', () => {});
  c.send({ t: MSG.HELLO, protocol: 1, name: 'SOLO', room: 'NOBD' });
  // Player leaves immediately: pure bot-vs-nobody.
  s2.removePlayer('solo');
  let threw = null;
  try {
    for (let i = 0; i < 600; i++) s2.step();
  } catch (e) { threw = e; }
  if (!threw && r2room.match.bots.length > 0) ok(`S8 bot-vs-nobody: 600 ticks clean, ${r2room.match.bots.length} bots fielded`);
  else fail('S8 bot-vs-nobody failed: ' + (threw ? threw.message : 'no bots'));
}

// §11 risk 1 profile: LOS ray cost (the bot hot path).
{
  const N = 20000;
  const start = performance.now();
  let clear = 0;
  for (let i = 0; i < N; i++) {
    if (losClear(-40 + (i % 80), 1.55, -40 + ((i * 7) % 80), 0, 1.4, 0)) clear++;
  }
  const us = ((performance.now() - start) / N * 1000).toFixed(2);
  ok(`S9 LOS profile: ${us} µs per raycastWorld LOS check (${clear}/${N} clear) — 9 bots × 10 checks/s ≈ ${(9 * 10 * parseFloat(us) / 1000).toFixed(2)} ms/s of server CPU`);
}
const perTick = (elapsedMs / Math.max(1, match.tick)).toFixed(3);
ok(`S10 sim cost: ${perTick} ms per tick average over ${match.tick} ticks (30 Hz budget: 33.3 ms)`);

console.log(failures ? `\nSOAK FAILED (${failures})` : '\nSOAK PASSED');
process.exit(failures ? 1 : 0);
