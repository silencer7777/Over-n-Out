// chat.js — MENU LOBBY CHAT CLIENT (U6-14a).
//
// The start-menu chatroom: a lightweight second socket to the
// same game server the ONLINE panel points at. It says hello
// with no room code, which lands it in the server's default
// 'LOBBY' room, and exchanges channel:'lobby' chat lines with
// everyone else sitting in that lobby.
//
// Honest scope (stated in the spec): the chatroom lives on
// whatever server the player points at — it is live when a
// server is up (Brett's hosted sessions). There is no always-on
// hosted lobby in this update.
//
// SECURITY: rendering is the caller's job and must be
// textContent-only (main.js does exactly that). This module
// never builds HTML from message text. It is the second module
// permitted a socket (the menu counterpart to js/online.js'
// scoped exception): the URL comes from the player's own
// SERVER field via OnlineSession.normalizeUrl — nothing is
// hardcoded.

export class LobbyChat {
  // hooks: { onLine({name, text, from, self}), onStatus(text) }
  constructor(hooks) {
    this.hooks = hooks || {};
    this.ws = null;
    this.playerId = null;
    this.name = null;
    this.connected = false;
  }

  connect(url, name) {
    this.close();
    this.name = name;
    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try { ws = new WebSocket(url); } catch { reject(new Error('bad server address')); return; }
      this.ws = ws;
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; try { ws.close(); } catch {} reject(new Error('server did not answer in time')); }
      }, 6000);
      ws.onopen = () => {
        ws.send(JSON.stringify({ t: 'hello', protocol: 1, name, room: null }));
      };
      ws.onmessage = (m) => {
        let msg;
        try { msg = JSON.parse(m.data); } catch { return; }
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'welcome') {
          this.playerId = msg.playerId;
          this.connected = true;
          if (!settled) { settled = true; clearTimeout(timeout); resolve(msg); }
          return;
        }
        if (msg.t === 'error') {
          this.hooks.onStatus?.('Server: ' + (msg.message || msg.code || 'error'));
          if (!settled) { settled = true; clearTimeout(timeout); reject(new Error(msg.message || 'server refused')); }
          return;
        }
        if (msg.t === 'chat' && msg.channel === 'lobby') {
          this.hooks.onLine?.({ name: msg.name, text: msg.text, from: msg.from, self: msg.from === this.playerId });
        }
      };
      ws.onclose = () => {
        const was = this.connected;
        this.connected = false;
        if (!settled) { settled = true; clearTimeout(timeout); reject(new Error('connection closed')); }
        else if (was) this.hooks.onStatus?.('Lobby chat disconnected.');
      };
    });
  }

  send(text) {
    if (!this.connected || !this.ws || this.ws.readyState !== 1) return false;
    try { this.ws.send(JSON.stringify({ t: 'chat', channel: 'lobby', text })); return true; } catch { return false; }
  }

  close() {
    try { this.ws?.close(); } catch {}
    this.ws = null;
    this.connected = false;
    this.playerId = null;
  }
}
