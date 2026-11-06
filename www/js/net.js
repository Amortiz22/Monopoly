/* Red: conexión directa entre teléfonos con PeerJS (WebRTC).
   El anfitrión ejecuta el motor; los invitados envían acciones y reciben el estado. */
(function (root) {
  'use strict';
  const PREFIX = 'magnate-cdmx-v1-';
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const makeCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

  // Permite inyectar un Peer falso para pruebas
  const PeerImpl = () => root.__FakePeer || root.Peer;

  class Host {
    constructor(handlers) { this.h = handlers; this.conns = new Map(); this.peer = null; this.code = null; }
    start(attempt = 0) {
      this.code = makeCode();
      const Peer = PeerImpl();
      const peer = new Peer(PREFIX + this.code, { debug: 0 });
      this.peer = peer;
      peer.on('open', () => this.h.onOpen && this.h.onOpen(this.code));
      peer.on('connection', conn => this._wire(conn));
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { } });
      peer.on('error', err => {
        if (err.type === 'unavailable-id' && attempt < 5) { peer.destroy(); this.start(attempt + 1); return; }
        this.h.onError && this.h.onError(err);
      });
    }
    _wire(conn) {
      conn.on('data', msg => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'hello') {
          const id = String(msg.token || '').slice(0, 40);
          if (!id) return;
          const old = this.conns.get(id); if (old && old !== conn) try { old.close(); } catch (e) { }
          this.conns.set(id, conn); conn._pid = id;
          this.h.onHello && this.h.onHello(id, String(msg.name || 'Invitado').slice(0, 14));
        } else if (msg.t === 'act' && conn._pid) {
          this.h.onAction && this.h.onAction(conn._pid, msg.a);
        }
      });
      const gone = () => {
        if (conn._pid && this.conns.get(conn._pid) === conn) { this.conns.delete(conn._pid); this.h.onLeave && this.h.onLeave(conn._pid); }
      };
      conn.on('close', gone); conn.on('error', gone);
    }
    send(id, msg) { const c = this.conns.get(id); if (c && c.open !== false) try { c.send(msg); } catch (e) { } }
    broadcast(msg) { for (const id of this.conns.keys()) this.send(id, msg); }
    isConnected(id) { return this.conns.has(id); }
    close() { try { this.peer && this.peer.destroy(); } catch (e) { } }
  }

  class Client {
    constructor(handlers) { this.h = handlers; this.peer = null; this.conn = null; this.closed = false; this.retry = null; }
    join(code, name, token) {
      this.code = code.toUpperCase().trim(); this.name = name; this.token = token;
      const Peer = PeerImpl();
      this.peer = new Peer({ debug: 0 });
      this.peer.on('open', () => this._connect());
      this.peer.on('disconnected', () => { if (!this.closed) try { this.peer.reconnect(); } catch (e) { } });
      this.peer.on('error', err => {
        if (err.type === 'peer-unavailable') { this.h.onError && this.h.onError({ type: 'no-room', message: 'No se encontró la sala. Revisa el código.' }); this._schedule(); return; }
        this.h.onError && this.h.onError(err);
        this._schedule();
      });
    }
    _connect() {
      if (this.closed) return;
      const conn = this.peer.connect(PREFIX + this.code, { reliable: true });
      this.conn = conn;
      conn.on('open', () => { this.h.onStatus && this.h.onStatus(true); conn.send({ t: 'hello', name: this.name, token: this.token }); });
      conn.on('data', msg => this.h.onMessage && this.h.onMessage(msg));
      conn.on('close', () => { if (this.conn === conn) { this.h.onStatus && this.h.onStatus(false); this._schedule(); } });
      conn.on('error', () => { });
    }
    _schedule() {
      if (this.closed || this.retry) return;
      this.retry = setTimeout(() => { this.retry = null; if (this.peer && !this.peer.destroyed && this.peer.open) this._connect(); else if (this.peer && this.peer.disconnected) { try { this.peer.reconnect(); } catch (e) { } } }, 3000);
    }
    send(msg) { if (this.conn && this.conn.open) { this.conn.send(msg); return true; } return false; }
    close() { this.closed = true; clearTimeout(this.retry); try { this.peer && this.peer.destroy(); } catch (e) { } }
  }

  root.Net = { Host, Client, makeCode };
})(typeof window !== 'undefined' ? window : globalThis);
