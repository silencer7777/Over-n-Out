// online.js — ONLINE SESSION CLIENT (V4, Coordinator integration).
//
// The browser half of docs/sessions/v4-net-contract.md. Vega owns
// net/ (transport, GameServer, sim); this module consumes Vega's
// protocol exactly as specified there: hello (with mode + loadout
// extensions), 30 Hz input samples (intent only — never outcomes),
// 20 Hz snapshots rendered with interpolation, events presented
// through hooks main.js supplies (tracers, hitmarkers, explosions,
// flash, mode end).
//
// SECURITY: this is the ONE module under js/ permitted to open a
// network socket — the scoped exception Board Meeting 004 §2
// recorded against the §1b lint. The URL is built from the page's
// own location or an address the player typed; no address is
// hardcoded, and no other file gains network surface.

import * as THREE from 'three';
import { mergeColoredParts, roundedPrismGeometry } from './geo.js';
import { getWeapon } from './weapons.js';
import { createVehicleActor } from './equipment.js'; // R2-5: online vehicle actors
import { getCharacter, isCharacterId, KIT_STORIES } from './characters.js';
import { getCamo } from './camo.js';
import { VEHICLE_SPEC } from './vehicles.js';
import { getEmote } from './emotes.js'; // V7.27: puppet emote gestures

// --- puppet figures ------------------------------------------------
// One merged mesh per remote entity (1 draw call), in the soldier
// visual language: camo kit + helmet; HOSTILE = crimson visor,
// FRIENDLY = sky visor (the readability rule from the soldier pass:
// faction reads at distance, in shadow, by the visor + silhouette).
const PUPPET_COLORS = {
  suit: 0x55613f, suitDark: 0x424c33, gear: 0x2e3238, dark: 0x23272c,
  skin: 0xc9a189, boot: 0x14161a, hostileVisor: 0xff2d20, friendlyVisor: 0x53c7ff,
};
function buildPuppetMesh(friendly, weaponId, charId = null) {
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // V7.20: a roster character re-skins the puppet (uniform +
  // kit + skin from js/characters.js); the visor stays faction
  // (readability law). Palette-only — same parts, same cost.
  let C = PUPPET_COLORS;
  if (charId && isCharacterId(charId)) {
    const ch = getCharacter(charId), kit = KIT_STORIES[ch.kit], uni = getCamo(ch.camo).uniform;
    C = { ...PUPPET_COLORS, suit: uni.camo, suitDark: uni.camoDark, gear: kit.gear, dark: kit.dark, skin: ch.skin, boot: kit.boot };
  }
  const parts = [];
  const P = (geo, color, x, y, z) => parts.push({ geo, color, x, y, z });
  P(roundedPrismGeometry(0.60, 0.66, 0.36, 0.13), C.suit, 0, 0.93, 0); // torso (V7.34 REBUILD: rounded-corner shell — puppets were raw boxes throughout, the blockiest figures in the game)
  P(box(0.50, 0.40, 0.10), C.gear, 0, 0.98, 0.18);           // chest rig
  P(box(0.44, 0.50, 0.16), C.gear, 0, 0.95, -0.22);          // pack
  P(new THREE.CylinderGeometry(0.085, 0.075, 0.55, 12), C.suit, -0.36, 0.92, 0); // arms (V7.34: tapered cylinders, not slabs)
  P(new THREE.CylinderGeometry(0.085, 0.075, 0.55, 12), C.suit, 0.36, 0.92, 0);
  P(new THREE.SphereGeometry(0.185, 18, 12), C.skin, 0, 1.42, 0); // head (V7.34: a sphere, not a cube)
  P(new THREE.CylinderGeometry(0.205, 0.215, 0.15, 20), C.gear, 0, 1.60, 0); // helmet (V7.34: round shell over the sphere)
  P(box(0.26, 0.06, 0.02), friendly ? C.friendlyVisor : C.hostileVisor, 0, 1.44, 0.178); // visor (V7.34: re-seated on the head sphere)
  const tint = getWeapon(weaponId).tint;
  P(box(0.07, 0.11, 0.62), tint, 0.18, 1.02, -0.28);         // gun body (weapon-tinted)
  P(box(0.04, 0.04, 0.30), C.dark, 0.18, 1.06, -0.70);       // barrel
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1, emissive: 0x180505 });
  const body = new THREE.Mesh(mergeColoredParts(parts), mat);
  body.frustumCulled = false;
  // V7.31 WALK CYCLE: puppets were one merged mesh — remote
  // players GLIDED. The legs are now separate hip-pivot meshes
  // (same split as the solo bots, V7.29), swung by the update
  // loop from the puppet's actual interpolated travel. +2 draw
  // calls per remote entity; puppets are not part of the solo
  // per-map budget, and the geometry is unchanged.
  const HIP_Y = 0.62;
  const group = new THREE.Group();
  group.add(body);
  for (const s of [-1, 1]) {
    const lp = [];
    const LP = (geo, color, x, y, z) => lp.push({ geo, color, x, y, z });
    LP(roundedPrismGeometry(0.21, 0.62, 0.24, 0.08), C.suitDark, s * 0.11, 0.31, 0); // leg (V7.34 REBUILD: rounded-corner shell; the old 0.30-wide boxes overlapped at the inner thigh)
    LP(roundedPrismGeometry(0.22, 0.16, 0.30, 0.06), C.boot, s * 0.11, 0.08, -0.02); // boot (V7.34: rounded shell, seated on the ground plane)
    const legGeo = mergeColoredParts(lp);
    legGeo.translate(-s * 0.11, -HIP_Y, 0);
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(s * 0.11, HIP_Y, 0);
    leg.frustumCulled = false;
    group.add(leg);
    if (s < 0) group.userData.legL = leg; else group.userData.legR = leg;
  }
  group.frustumCulled = false;
  return group;
}

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();

// V7.31: a puppet is a small Group (body + two leg meshes
// sharing one material) — disposal walks the group and frees
// each geometry once and the shared material once.
function disposePuppet(root) {
  const mats = new Set();
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) mats.add(o.material);
  });
  for (const m of mats) m.dispose();
}

export class OnlineSession {
  // hooks: { onStatus(text), onShot(ev), onBotShot(ev), onHit(ev),
  //   onKill(ev), onExplosion(x,z), onFlash(seconds), onWave(ev),
  //   onModeEnd(ev), onDisconnect(reason) }
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks || {};
    this.ws = null;
    this.playerId = null;
    this.room = null;
    this.mode = 'waves';
    this.latest = null;            // last snapshot
    this.puppets = new Map();      // entity id -> { mesh, tx,ty,tz, tyaw, friendly }
    // R2-5: vehicle actors synced from snap.vehicles —
    // id -> { actor, specId, display, tx,ty,tz, theading, driverId }.
    // The DRIVER's own vehicle is exempt from interpolation:
    // main.js predicts it locally and feeds the pose in through
    // setOwnVehicle() every frame.
    this.vehicleActors = new Map();
    this.ownVehicleId = null;
    this.ownVehicleState = null;
    this.groundHeightAt = null;    // set by main.js (actor terrain pitch/roll)
    this.seq = 0;
    this._inputAcc = 0;
    this._pingTimer = 0;
    this.connected = false;
  }

  // Default server address: the same host that served the page
  // (the game server serves the frontend too, per Vega's entry).
  // The transport upgrades ONLY on /play (net/ws-transport.js).
  static defaultUrl() {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return proto + location.host + '/play';
  }

  // Normalize whatever got pasted into the server field. Brett's
  // test-night flow (hosting decision, Oct 24): cloudflared prints
  // an https tunnel URL (a trycloudflare host) that CHANGES every
  // session — the field must accept it verbatim: https→wss,
  // a bare host gets the page's scheme, and the /play path is
  // appended when no path was given.
  static normalizeUrl(raw) {
    let u = String(raw || '').trim();
    if (!u) return OnlineSession.defaultUrl();
    u = u.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
    if (!/^wss?:\/\//i.test(u)) {
      u = (location.protocol === 'https:' ? 'wss://' : 'ws://') + u.replace(/^\/+/, '');
    }
    u = u.replace(/\/+$/, '');
    // Append /play when the URL is host-only (no path segment).
    const afterScheme = u.slice(u.indexOf('://') + 3);
    if (!afterScheme.includes('/')) u += '/play';
    return u;
  }

  connect(url, hello) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        reject(new Error('bad server address'));
        return;
      }
      this.ws = ws;
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; try { ws.close(); } catch {} reject(new Error('server did not answer in time')); }
      }, 6000);
      ws.onopen = () => {
        ws.send(JSON.stringify({ t: 'hello', protocol: 1, ...hello }));
      };
      ws.onmessage = (m) => {
        let msg;
        try { msg = JSON.parse(m.data); } catch { return; }
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'welcome') {
          this.playerId = msg.playerId;
          this.room = msg.room;
          if (msg.mode) this.mode = msg.mode;
          this.connected = true;
          if (!settled) { settled = true; clearTimeout(timeout); resolve(msg); }
          return;
        }
        if (msg.t === 'error') {
          this.hooks.onStatus?.('Server: ' + (msg.message || msg.code || 'error'));
          if (!settled) { settled = true; clearTimeout(timeout); reject(new Error(msg.message || 'server refused the join')); }
          return;
        }
        if (msg.t === 'snapshot') { this.latest = msg; this._syncPuppets(msg); this._syncVehicles(msg); return; }
        if (msg.t === 'event') { this._onEvent(msg); return; }
        // U6-14/U6-15: chat lines and voice signaling ride the
        // same socket (protocol extension) — routed to hooks.
        if (msg.t === 'chat') { this.hooks.onChat?.(msg); return; }
        // V7.27: emote relays — the puppet gesture plays here;
        // the callout line is main's (hooks.onEmote).
        if (msg.t === 'emote') {
          if (msg.from !== this.playerId) this.playPuppetEmote(msg.from, msg.emote);
          this.hooks.onEmote?.(msg);
          return;
        }
        if (msg.t === 'signal') { this.hooks.onSignal?.(msg); return; }
        if (msg.t === 'ping') { try { ws.send(JSON.stringify({ t: 'pong', id: msg.id ?? null })); } catch {} }
      };
      ws.onclose = () => {
        const was = this.connected;
        this.connected = false;
        if (!settled) { settled = true; clearTimeout(timeout); reject(new Error('connection closed')); }
        else if (was) this.hooks.onDisconnect?.('connection closed');
      };
    });
  }

  _onEvent(ev) {
    const h = this.hooks;
    switch (ev.kind) {
      case 'shot': h.onShot?.(ev); break;
      case 'bot_shot': h.onBotShot?.(ev); break;
      case 'hit': if (ev.by === this.playerId) h.onHit?.(ev); break;
      case 'kill': h.onKill?.(ev); break;
      case 'explosion': case 'frag_explode': h.onExplosion?.(ev.x, ev.z); break;
      case 'flash_explode': h.onFlash?.(Math.max(0, ev.blind || 0)); break;
      case 'wave': case 'wave_clear': h.onWave?.(ev); break;
      // Vega's server emits the final event as kind 'results'
      // ({ mode, wave, kills, xp: { pid: { gained, bySource } } });
      // 'mode_end' is accepted too for forward compatibility.
      case 'results': case 'mode_end': h.onModeEnd?.(ev); break;
      case 'player_down': h.onPlayerDown?.(ev); break;
      default: break;
    }
  }

  _syncPuppets(snap) {
    const seen = new Set();
    for (const p of snap.players || []) {
      if (p.id === this.playerId) continue;
      seen.add('p:' + p.id);
      this._upsert('p:' + p.id, true, p);
    }
    for (const b of snap.bots || []) {
      seen.add('b:' + b.id);
      this._upsert('b:' + b.id, false, b);
    }
    for (const [key, pup] of this.puppets) {
      if (!seen.has(key)) {
        this.scene.remove(pup.mesh);
        disposePuppet(pup.mesh);
        this.puppets.delete(key);
      }
    }
  }

  _upsert(key, friendly, ent) {
    let pup = this.puppets.get(key);
    if (!pup || pup.weaponId !== ent.weapon || pup.charId !== (ent.char || null)) {
      if (pup) { this.scene.remove(pup.mesh); disposePuppet(pup.mesh); }
      pup = { mesh: buildPuppetMesh(friendly, ent.weapon, ent.char || null), weaponId: ent.weapon, charId: ent.char || null, friendly, walkPhase: 0, walkAmp: 0, lx: ent.pos[0], lz: ent.pos[2] };
      pup.mesh.position.set(ent.pos[0], ent.pos[1], ent.pos[2]);
      this.scene.add(pup.mesh);
      this.puppets.set(key, pup);
    }
    pup.tx = ent.pos[0]; pup.ty = ent.pos[1]; pup.tz = ent.pos[2];
    pup.tyaw = ent.yaw;
    pup.mesh.visible = ent.alive !== false && !ent.dead;
  }

  // R2-5: vehicles from the snapshot — rows of [id, specId,
  // x, y, z, heading, speed, hp, disabled, driverId]. Actors
  // are the R2-1 createVehicleActor models (castShadow FALSE —
  // the 199/200 budget is untouched); motion interpolates like
  // the puppets.
  _syncVehicles(snap) {
    const seen = new Set();
    for (const row of snap.vehicles || []) {
      const [id, specId, x, y, z, heading, speed, hp, disabled, driverId] = row;
      seen.add(id);
      let va = this.vehicleActors.get(id);
      if (!va || va.specId !== specId) {
        if (va) this._removeVehicleActor(va);
        const actor = createVehicleActor(specId, (gx, gz, gy) => this.groundHeightAt ? this.groundHeightAt(gx, gz, gy) : (gy || 0));
        actor.group.position.set(x, y, z);
        this.scene.add(actor.group);
        va = {
          id, specId, actor, driverId: null,
          display: {
            spec: VEHICLE_SPEC[specId] || VEHICLE_SPEC.quad,
            pos: { x, y, z }, heading, speed, hp, disabled: !!disabled,
          },
          tx: x, ty: y, tz: z, theading: heading,
        };
        this.vehicleActors.set(id, va);
      }
      va.tx = x; va.ty = y; va.tz = z; va.theading = heading;
      va.driverId = driverId || null;
      va.display.speed = speed;
      va.display.hp = hp;
      va.display.disabled = !!disabled;
    }
    for (const [id, va] of this.vehicleActors) {
      if (!seen.has(id)) {
        this._removeVehicleActor(va);
        this.vehicleActors.delete(id);
      }
    }
  }

  _removeVehicleActor(va) {
    this.scene.remove(va.actor.group);
    va.actor.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  // R2-5: main.js feeds the locally predicted state of the
  // vehicle THIS player drives (null when on foot). update()
  // renders that vehicle from the prediction instead of the
  // snapshot interpolation.
  setOwnVehicle(id, state) {
    this.ownVehicleId = id || null;
    this.ownVehicleState = state || null;
  }

  // R2-5: read-only view for the minimap / prompts —
  // [{ id, driverId, state }] where state is the display state
  // the actor is rendering.
  vehicleView() {
    return [...this.vehicleActors.values()].map(va => ({ id: va.id, driverId: va.driverId, state: va.display }));
  }

  // Called by main each frame while online: advance interpolation
  // and return the server's record of THIS player (for position
  // correction + HUD), or null before the first snapshot.
  update(dt) {
    const k = 1 - Math.exp(-12 * dt);
    for (const pup of this.puppets.values()) {
      const m = pup.mesh;
      // V7.27: undo last frame's emote offsets before the
      // interpolation reads the mesh (offsets never accumulate
      // into the lerp), then re-apply fresh ones below.
      if (pup._emoteYaw) { m.rotation.y -= pup._emoteYaw; pup._emoteYaw = 0; }
      if (pup._emoteHop) { m.position.y -= pup._emoteHop; pup._emoteHop = 0; }
      m.position.x += (pup.tx - m.position.x) * k;
      m.position.y += (pup.ty - m.position.y) * k;
      m.position.z += (pup.tz - m.position.z) * k;
      let dy = pup.tyaw - m.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      m.rotation.y += dy * k;
      // V7.31 WALK CYCLE: swing the hip-pivot legs from the
      // puppet's actual interpolated travel (same 2.42 rad/m
      // cadence as the solo bots). Amplitude eases with speed —
      // a standing puppet's legs settle instead of freezing
      // mid-stride.
      const pdx = m.position.x - (pup.lx ?? m.position.x);
      const pdz = m.position.z - (pup.lz ?? m.position.z);
      pup.lx = m.position.x; pup.lz = m.position.z;
      const pDist = Math.hypot(pdx, pdz);
      const pSpeed = dt > 0 ? pDist / dt : 0;
      pup.walkPhase = (pup.walkPhase || 0) + pDist * 2.42;
      const targetAmp = m.visible ? 0.5 * Math.min(1, pSpeed / 6) : 0;
      pup.walkAmp = (pup.walkAmp || 0) + (targetAmp - (pup.walkAmp || 0)) * Math.min(1, dt * 10);
      const legL = m.userData.legL, legR = m.userData.legR;
      if (legL && legR) {
        const sw = Math.sin(pup.walkPhase) * pup.walkAmp;
        legL.rotation.x = sw;
        legR.rotation.x = -sw;
      }
      // V7.27 emote root motion (presentation only).
      if (pup.emoteT > 0) {
        pup.emoteT -= dt;
        const p = 1 - Math.max(0, pup.emoteT) / pup.emoteDur;
        const env = Math.sin(p * Math.PI);
        let yaw = 0, hop = 0, pitch = 0;
        switch (pup.emoteKind) {
          case 'bow': pitch = 0.38 * env; break;
          case 'deepbow': pitch = 0.62 * env; break;
          case 'wiggle': yaw = 0.4 * Math.sin(p * Math.PI * 4) * env; break;
          case 'spin': yaw = p * Math.PI * 2; break;
          case 'hop': hop = 0.22 * env; break;
          case 'cheer': hop = 0.34 * Math.abs(Math.sin(p * Math.PI * 2)); break;
          default: break;
        }
        m.rotation.y += yaw; pup._emoteYaw = yaw;
        m.position.y += hop; pup._emoteHop = hop;
        m.rotation.x = pitch;
        if (pup.emoteT <= 0) { pup.emoteKind = null; m.rotation.x = 0; }
      } else if (m.rotation.x !== 0) {
        m.rotation.x = 0;
      }
    }
    // R2-5: vehicle actors — interpolated toward the snapshot
    // pose, except the driver's own, which renders from the
    // local prediction main.js feeds in.
    for (const va of this.vehicleActors.values()) {
      const d = va.display;
      if (va.id === this.ownVehicleId && this.ownVehicleState) {
        const s = this.ownVehicleState;
        d.pos.x = s.pos.x; d.pos.y = s.pos.y; d.pos.z = s.pos.z;
        d.heading = s.heading; d.speed = s.speed; d.hp = s.hp; d.disabled = s.disabled;
      } else {
        d.pos.x += (va.tx - d.pos.x) * k;
        d.pos.y += (va.ty - d.pos.y) * k;
        d.pos.z += (va.tz - d.pos.z) * k;
        let dy = va.theading - d.heading;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        d.heading += dy * k;
      }
      va.actor.update(dt, d);
    }
    if (!this.latest) return null;
    return (this.latest.players || []).find(p => p.id === this.playerId) || null;
  }

  // 30 Hz input pump — main calls with its current sample builder
  // every frame; the throttle + seq live here.
  pumpInput(dt, buildSample) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) return;
    this._inputAcc += dt;
    this._pingTimer += dt;
    if (this._pingTimer > 4) {
      this._pingTimer = 0;
      try { this.ws.send(JSON.stringify({ t: 'ping', id: this.seq })); } catch {}
    }
    if (this._inputAcc < 1 / 30) return;
    this._inputAcc = 0;
    const sample = buildSample(++this.seq);
    try { this.ws.send(JSON.stringify(sample)); } catch {}
  }

  // U6-14: send a chat line on this session's socket. The
  // server stamps identity; the payload is words only.
  sendChat(channel, text) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) return false;
    try { this.ws.send(JSON.stringify({ t: 'chat', channel, text })); return true; } catch { return false; }
  }

  // V7.27: send an emote gesture (id from js/emotes.js; the
  // server allowlists and rate-limits it).
  sendEmote(emote) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) return false;
    try { this.ws.send(JSON.stringify({ t: 'emote', emote })); return true; } catch { return false; }
  }

  // V7.27: start a puppet's emote gesture (root motion — the
  // puppets are merged meshes; the update loop composes the
  // offset so interpolation is never contaminated).
  playPuppetEmote(playerId, emoteId) {
    const pup = this.puppets.get('p:' + playerId);
    if (!pup) return;
    const def = getEmote(emoteId);
    if (!def) return;
    pup.emoteKind = def.puppet;
    pup.emoteT = def.dur;
    pup.emoteDur = def.dur;
  }

  // U6-15: send a WebRTC signal relayed by the server.
  sendSignal(to, kind, data) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) return false;
    try { this.ws.send(JSON.stringify({ t: 'signal', to, kind, data })); return true; } catch { return false; }
  }

  close() {
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.connected = false;
    for (const pup of this.puppets.values()) {
      this.scene.remove(pup.mesh);
      pup.mesh.geometry.dispose();
      pup.mesh.material.dispose();
    }
    this.puppets.clear();
    // R2-5: vehicle actors leave with the session.
    for (const va of this.vehicleActors.values()) this._removeVehicleActor(va);
    this.vehicleActors.clear();
    this.ownVehicleId = null;
    this.ownVehicleState = null;
    this.latest = null;
  }
}
