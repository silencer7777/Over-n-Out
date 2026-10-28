// voice.js — VOICE CHAT (U6-15): WebRTC peer audio in a mesh.
//
// Rooms cap at 4 humans, so a full mesh is at most 3 peer
// connections per player. Signaling (offer/answer/ice) rides
// the game server's MSG.SIGNAL relay via the callbacks main.js
// supplies — this module opens no socket of its own and uses
// no external service.
//
// NOTE ON ICE SERVERS: RTCPeerConnection is configured with
// NO iceServers (pure host candidates). That keeps the
// no-external-services law absolute — no STUN, no TURN. The
// cost is the honest NAT limit from the spec: pairs separated
// by strict NATs will not connect (same-LAN / same-NAT /
// permissive-NAT pairs will). When a pair fails, the peer is
// reported 'unavailable' and the UI says so — never silent.
//
// Audience: setAudience('team'|'all'|'off') filters which
// roster peers get connections (main.js supplies each peer's
// team via the roster). Mic: 'ptt' (push-to-talk, key handled
// by main.js calling setTalking(bool)) or 'open' (always live
// while audience != off). Per-peer mute/volume apply to the
// peer's audio element and persist via the prefs callbacks.

export class VoiceChat {
  // opts: { sendSignal(to, kind, data), onPeerState(id, state, name),
  //         getPrefs(name) -> {muted, volume}, }
  constructor(opts) {
    this.opts = opts || {};
    this.peers = new Map();      // id -> { pc, audio, name, state, iceQueue: [] }
    this.roster = new Map();     // id -> { name, team }
    this.myId = null;
    this.audience = 'off';       // 'team' | 'all' | 'off'
    this.micMode = 'ptt';        // 'ptt' | 'open'
    this.talking = false;
    this.stream = null;
    this.myTeam = null;
  }

  setIdentity(myId, myTeam) { this.myId = myId; this.myTeam = myTeam; }

  async setAudience(aud, micMode) {
    this.audience = aud;
    if (micMode) this.micMode = micMode;
    if (aud === 'off') { this._teardownAll(); this._stopMic(); return; }
    await this._ensureMic();
    this._syncPeers();
  }

  setMicMode(mode) {
    this.micMode = mode;
    this._applyTalkGate();
  }

  setTalking(on) {
    this.talking = !!on;
    this._applyTalkGate();
  }

  _applyTalkGate() {
    if (!this.stream) return;
    const live = this.audience !== 'off' && (this.micMode === 'open' || this.talking);
    for (const track of this.stream.getAudioTracks()) track.enabled = live;
  }

  async _ensureMic() {
    if (this.stream) { this._applyTalkGate(); return true; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._applyTalkGate();
      // Peers created before the mic arrived need the track.
      for (const p of this.peers.values()) this._attachLocalTracks(p);
      return true;
    } catch {
      // Mic denied/unavailable: voice becomes receive-only and
      // the state callback says so — not a silent failure.
      this.opts.onPeerState?.(null, 'mic-unavailable', null);
      return false;
    }
  }

  _stopMic() {
    if (this.stream) { for (const t of this.stream.getTracks()) t.stop(); this.stream = null; }
  }

  // The room roster (humans only), from the latest snapshot.
  setRoster(entries, myTeam) {
    this.roster = new Map(entries.map(e => [e.id, e]));
    if (myTeam !== undefined) this.myTeam = myTeam;
    if (this.audience !== 'off') this._syncPeers();
  }

  _wanted(id) {
    if (this.audience === 'off' || id === this.myId) return false;
    const peer = this.roster.get(id);
    if (!peer) return false;
    if (this.audience === 'all') return true;
    return peer.team === this.myTeam; // 'team'
  }

  _syncPeers() {
    for (const id of this.roster.keys()) {
      if (this._wanted(id) && !this.peers.has(id)) this._createPeer(id, true);
      if (!this._wanted(id) && this.peers.has(id)) this._dropPeer(id);
    }
    for (const id of [...this.peers.keys()]) {
      if (!this.roster.has(id)) this._dropPeer(id);
    }
  }

  _createPeer(id, initiator) {
    const info = this.roster.get(id) || {};
    const pc = new RTCPeerConnection({ iceServers: [] });
    const peer = { pc, audio: null, name: info.name || 'PLAYER', state: 'connecting', iceQueue: [] };
    this.peers.set(id, peer);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.opts.sendSignal?.(id, 'ice', {
          candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid || undefined,
          sdpMLineIndex: e.candidate.sdpMLineIndex || undefined,
        });
      }
    };
    pc.ontrack = (e) => {
      if (!peer.audio) {
        peer.audio = new Audio();
        peer.audio.autoplay = true;
        this._applyPrefs(id, peer);
      }
      peer.audio.srcObject = e.streams[0];
    };
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') { peer.state = 'connected'; this.opts.onPeerState?.(id, 'connected', peer.name); }
      else if (s === 'failed') { peer.state = 'unavailable'; this.opts.onPeerState?.(id, 'unavailable', peer.name); }
      else if (s === 'disconnected') {
        // Transient on many networks; give it a grace period
        // before declaring the pair unavailable.
        setTimeout(() => {
          if (peer.pc.iceConnectionState === 'disconnected' || peer.pc.iceConnectionState === 'failed') {
            peer.state = 'unavailable'; this.opts.onPeerState?.(id, 'unavailable', peer.name);
          }
        }, 4000);
      }
    };
    this._attachLocalTracks(peer);
    if (initiator) {
      pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
        this.opts.sendSignal?.(id, 'offer', { sdp: pc.localDescription.sdp });
      }).catch(() => { peer.state = 'unavailable'; this.opts.onPeerState?.(id, 'unavailable', peer.name); });
    }
    this.opts.onPeerState?.(id, 'connecting', peer.name);
    return peer;
  }

  _attachLocalTracks(peer) {
    if (!this.stream) return;
    const have = new Set(peer.pc.getSenders().map(s => s.track).filter(Boolean));
    for (const track of this.stream.getTracks()) {
      if (!have.has(track)) peer.pc.addTrack(track, this.stream);
    }
  }

  async handleSignal(from, kind, data) {
    if (this.audience === 'off') return;
    let peer = this.peers.get(from);
    if (!peer) {
      if (kind !== 'offer') return; // answers/ice for unknown peers are stale
      peer = this._createPeer(from, false);
    }
    const pc = peer.pc;
    try {
      if (kind === 'offer') {
        await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        for (const c of peer.iceQueue.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.opts.sendSignal?.(from, 'answer', { sdp: pc.localDescription.sdp });
      } else if (kind === 'answer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        for (const c of peer.iceQueue.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      } else if (kind === 'ice') {
        const cand = { candidate: data.candidate, sdpMid: data.sdpMid ?? null, sdpMLineIndex: data.sdpMLineIndex ?? null };
        if (pc.remoteDescription) await pc.addIceCandidate(cand).catch(() => {});
        else peer.iceQueue.push(cand);
      }
    } catch { /* a failed negotiation surfaces via iceconnectionstate */ }
  }

  _applyPrefs(id, peer) {
    if (!peer.audio) return;
    const prefs = this.opts.getPrefs?.(peer.name) || {};
    peer.audio.muted = !!prefs.muted;
    peer.audio.volume = typeof prefs.volume === 'number' ? Math.max(0, Math.min(1, prefs.volume)) : 1;
  }

  refreshPrefs() { for (const [id, p] of this.peers) this._applyPrefs(id, p); }
  peerStates() { return [...this.peers.entries()].map(([id, p]) => ({ id, name: p.name, state: p.state })); }

  _dropPeer(id) {
    const p = this.peers.get(id);
    if (!p) return;
    try { p.pc.close(); } catch {}
    if (p.audio) { p.audio.srcObject = null; }
    this.peers.delete(id);
    this.opts.onPeerState?.(id, 'gone', p.name);
  }

  _teardownAll() { for (const id of [...this.peers.keys()]) this._dropPeer(id); }

  close() {
    this._teardownAll();
    this._stopMic();
    this.roster.clear();
  }
}
