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
import { mergeColoredParts } from './geo.js';
import { getWeapon } from './weapons.js';

// --- puppet figures ------------------------------------------------
// One merged mesh per remote entity (1 draw call), in the soldier
// visual language: camo kit + helmet; HOSTILE = crimson visor,
// FRIENDLY = sky visor (the readability rule from the soldier pass:
// faction reads at distance, in shadow, by the visor + silhouette).
const PUPPET_COLORS = {
  suit: 0x55613f, suitDark: 0x424c33, gear: 0x2e3238, dark: 0x23272c,
  skin: 0xc9a189, boot: 0x14161a, hostileVisor: 0xff2d20, friendlyVisor: 0x53c7ff,
};
function buildPuppetMesh(friendly, weaponId) {
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const C = PUPPET_COLORS;
  const parts = [];
  const P = (geo, color, x, y, z) => parts.push({ geo, color, x, y, z });
  P(box(0.30, 0.62, 0.20), C.suitDark, -0.11, 0.31, 0);       // legs
  P(box(0.30, 0.62, 0.20), C.suitDark, 0.11, 0.31, 0);
  P(box(0.34, 0.16, 0.24), C.boot, -0.11, 0.05, -0.02);       // boots
  P(box(0.34, 0.16, 0.24), C.boot, 0.11, 0.05, -0.02);
  P(box(0.56, 0.62, 0.32), C.suit, 0, 0.93, 0);              // torso
  P(box(0.50, 0.40, 0.10), C.gear, 0, 0.98, 0.18);           // chest rig
  P(box(0.44, 0.50, 0.16), C.gear, 0, 0.95, -0.22);          // pack
  P(box(0.16, 0.55, 0.16), C.suit, -0.36, 0.92, 0);          // arms
  P(box(0.16, 0.55, 0.16), C.suit, 0.36, 0.92, 0);
  P(box(0.30, 0.30, 0.30), C.skin, 0, 1.42, 0);              // head
  P(box(0.36, 0.14, 0.36), C.gear, 0, 1.60, 0);             // helmet
  P(box(0.26, 0.06, 0.02), friendly ? C.friendlyVisor : C.hostileVisor, 0, 1.44, 0.155); // visor
  const tint = getWeapon(weaponId).tint;
  P(box(0.07, 0.11, 0.62), tint, 0.18, 1.02, -0.28);         // gun body (weapon-tinted)
  P(box(0.04, 0.04, 0.30), C.dark, 0.18, 1.06, -0.70);       // barrel
  const mesh = new THREE.Mesh(
    mergeColoredParts(parts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.1, emissive: 0x180505 })
  );
  mesh.frustumCulled = false;
  return mesh;
}

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();

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
        if (msg.t === 'snapshot') { this.latest = msg; this._syncPuppets(msg); return; }
        if (msg.t === 'event') { this._onEvent(msg); return; }
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
        pup.mesh.geometry.dispose();
        pup.mesh.material.dispose();
        this.puppets.delete(key);
      }
    }
  }

  _upsert(key, friendly, ent) {
    let pup = this.puppets.get(key);
    if (!pup || pup.weaponId !== ent.weapon) {
      if (pup) { this.scene.remove(pup.mesh); pup.mesh.geometry.dispose(); pup.mesh.material.dispose(); }
      pup = { mesh: buildPuppetMesh(friendly, ent.weapon), weaponId: ent.weapon, friendly };
      pup.mesh.position.set(ent.pos[0], ent.pos[1], ent.pos[2]);
      this.scene.add(pup.mesh);
      this.puppets.set(key, pup);
    }
    pup.tx = ent.pos[0]; pup.ty = ent.pos[1]; pup.tz = ent.pos[2];
    pup.tyaw = ent.yaw;
    pup.mesh.visible = ent.alive !== false && !ent.dead;
  }

  // Called by main each frame while online: advance interpolation
  // and return the server's record of THIS player (for position
  // correction + HUD), or null before the first snapshot.
  update(dt) {
    const k = 1 - Math.exp(-12 * dt);
    for (const pup of this.puppets.values()) {
      const m = pup.mesh;
      m.position.x += (pup.tx - m.position.x) * k;
      m.position.y += (pup.ty - m.position.y) * k;
      m.position.z += (pup.tz - m.position.z) * k;
      let dy = pup.tyaw - m.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      m.rotation.y += dy * k;
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
    this.latest = null;
  }
}
