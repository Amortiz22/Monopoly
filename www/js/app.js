/* Magnate CDMX — interfaz y control de sesión (local / anfitrión / invitado). */
(function () {
  'use strict';
  const { Engine, BOARD, GROUPS, OWNABLE, groupMembers, MODES, FX_NAMES } = window.Magnate;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Math.round(n).toLocaleString('es-MX');
  const money2 = n => '$' + (+n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
  };
  let token = store.get('magnate-token', null);
  if (!token) { token = 'u' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); store.set('magnate-token', token); }

  const BOT_NAMES = ['Doña Lupe', 'El Güero', 'La Jefa', 'Don Chuy', 'Tía Mary', 'El Profe'];
  const myName = () => ($('#in-name').value.trim() || 'Yo').slice(0, 14);

  // ---------------- Sesión ----------------
  let G = null; // { mode, engine, state, host, client, lobby, leaveTimers }
  let aiTimer = null;
  let seen = { roll: null, card: null, trade: null, turn: null, version: -1, ev: null };

  function show(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); closeModal(); }
  function toast(msg, ms = 2200) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms);
  }

  const S = () => G && (G.engine ? G.engine.state : G.state);
  function meIdx() {
    const st = S(); if (!st) return -1;
    if (G.mode === 'local') {
      const a = G.engine.actor();
      if (a >= 0 && !st.players[a].isAI) return a;
      if (st.trade && !st.players[st.trade.from].isAI) return st.trade.from;
      const cur = st.players[st.turn];
      if (!cur.isAI) return st.turn;
      return st.players.findIndex(p => !p.isAI && !p.bankrupt);
    }
    return st.players.findIndex(p => p.id === token);
  }

  function dispatch(a) {
    if (!G) return;
    if (G.mode === 'client') {
      if (!G.client.send({ t: 'act', a })) toast('Sin conexión con el anfitrión…');
      return;
    }
    let idx = meIdx();
    if (G.mode === 'local' && a.type === 'cancelTrade') idx = S().trade ? S().trade.from : idx;
    applyAction(idx, a, null);
  }

  function applyAction(idx, a, fromId) {
    const err = G.engine.act(idx, a);
    if (err) { if (fromId) G.host.send(fromId, { t: 'err', msg: err }); else toast(err); return; }
    changed();
  }

  function changed() {
    const st = S();
    if (G.mode === 'local') store.set('magnate-save', st.phase === 'gameover' ? null : st);
    if (G.mode === 'host') G.host.broadcast({ t: 'state', s: st });
    render();
    scheduleAI();
  }

  function scheduleAI() {
    clearTimeout(aiTimer);
    if (!G || !G.engine || anim.busy) return;
    const st = G.engine.state, a = G.engine.actor();
    if (a < 0) return;
    const p = st.players[a];
    if (!p.isAI && !p.away) return;
    const delay = st.phase === 'roll' && !st.trade ? 900 : 700;
    aiTimer = setTimeout(() => { if (G && G.engine && G.engine.aiStep()) changed(); }, delay);
  }

  // ---------------- Modos ----------------
  const MODE_TAG = { clasico: 'Hasta quebrar', rapido: '20 rondas', fiesta: 'Con bote', millonario: 'Meta $4,000', actuarial: 'Interés y seguros' };
  let soloMode = store.get('magnate-mode', 'clasico');
  function renderModes(boxSel, descSel, current, onPick) {
    const box = $(boxSel);
    box.innerHTML = Object.entries(MODES).map(([k, m]) => `<button data-m="${k}" class="${k === current ? 'on' : ''}">${m.name}<small>${MODE_TAG[k]}</small></button>`).join('');
    $(descSel).textContent = MODES[current] ? MODES[current].desc : '';
    box.querySelectorAll('button').forEach(b => b.onclick = () => onPick(b.dataset.m));
  }
  function pickSolo(m) { soloMode = m; store.set('magnate-mode', m); renderModes('#solo-modes', '#solo-mdesc', m, pickSolo); }
  pickSolo(MODES[soloMode] ? soloMode : 'clasico');

  // ---------------- Inicio ----------------
  $('#in-name').value = store.get('magnate-name', '');
  $('#in-name').addEventListener('change', () => store.set('magnate-name', $('#in-name').value.trim()));
  function refreshHome() {
    const sv = store.get('magnate-save', null);
    $('#btn-continue').classList.toggle('hidden', !(sv && sv.players));
  }
  refreshHome();

  $$('[data-back]').forEach(b => b.onclick = () => show('scr-home'));
  $$('.seg').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  }));
  const segVal = id => +$(id + ' .on').dataset.n;

  $('#btn-solo').onclick = () => { store.set('magnate-name', $('#in-name').value.trim()); show('scr-solo'); };
  $('#btn-solo-start').onclick = () => {
    const bots = segVal('#seg-bots'), locals = segVal('#seg-local');
    if (bots + locals + 1 > 6) { toast('Máximo 6 jugadores en total.'); return; }
    const players = [{ id: token, name: myName() }];
    for (let i = 0; i < locals; i++) players.push({ id: 'local' + i, name: 'Jugador ' + (i + 2) });
    const names = shuffleArr(BOT_NAMES);
    for (let i = 0; i < bots; i++) players.push({ id: 'bot' + i, name: names[i], isAI: true });
    G = { mode: 'local', engine: new Engine(Engine.newGame(players, soloMode)) };
    startGame();
  };
  $('#btn-continue').onclick = () => {
    const sv = store.get('magnate-save', null); if (!sv) return;
    G = { mode: 'local', engine: new Engine(sv) };
    startGame();
  };
  function shuffleArr(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------------- Sala: anfitrión ----------------
  $('#btn-host').onclick = () => {
    store.set('magnate-name', $('#in-name').value.trim());
    if (!window.Peer && !window.__FakePeer) { toast('No se pudo cargar el módulo de red.'); return; }
    G = { mode: 'host', lobby: [{ id: token, name: myName(), isAI: false }], leaveTimers: {}, gameMode: soloMode };
    $('#lobby-title').textContent = 'Tu sala';
    $('#join-box').classList.add('hidden'); $('#code-box').classList.remove('hidden'); $('#host-ctrls').classList.remove('hidden');
    $('#mode-box').classList.remove('hidden');
    $('#room-code').textContent = '·····';
    $('#lobby-status').textContent = 'Conectando…';
    show('scr-lobby');
    G.host = new Net.Host({
      onOpen: code => { $('#room-code').textContent = code; $('#lobby-status').textContent = 'Esperando a tus amigos…'; },
      onError: err => { $('#lobby-status').textContent = 'Error de red: ' + (err.type || err.message || err); },
      onHello: (id, name) => hostHello(id, name),
      onLeave: id => hostLeave(id),
      onAction: (id, a) => {
        if (!G.engine) return;
        const idx = G.engine.idxOf(id); if (idx < 0) return;
        applyAction(idx, a, id);
      },
    });
    G.host.start();
    renderLobby();
  };

  function hostHello(id, name) {
    if (G.engine) {
      const idx = G.engine.idxOf(id);
      if (idx < 0) { G.host.send(id, { t: 'err', msg: 'La partida ya empezó.', fatal: true }); return; }
      clearTimeout(G.leaveTimers[id]);
      const p = G.engine.state.players[idx];
      if (p.away) { p.away = false; G.engine.log(`${p.name} regresó.`); }
      G.host.send(id, { t: 'state', s: G.engine.state });
      changed();
      return;
    }
    const ex = G.lobby.find(p => p.id === id);
    if (ex) ex.name = name;
    else {
      if (G.lobby.length >= 6) { G.host.send(id, { t: 'err', msg: 'La sala está llena.', fatal: true }); return; }
      G.lobby.push({ id, name, isAI: false });
      toast(name + ' entró a la sala');
    }
    renderLobby();
  }
  function hostLeave(id) {
    if (!G.engine) { G.lobby = G.lobby.filter(p => p.id !== id); renderLobby(); return; }
    const idx = G.engine.idxOf(id); if (idx < 0) return;
    const p = G.engine.state.players[idx];
    toast(p.name + ' se desconectó');
    clearTimeout(G.leaveTimers[id]);
    G.leaveTimers[id] = setTimeout(() => {
      if (!G || !G.engine || G.host.isConnected(id)) return;
      p.away = true; G.engine.log(`${p.name} se desconectó; la computadora juega por él/ella.`);
      changed();
    }, 20000);
    render();
  }

  function pickHost(m) { G.gameMode = m; store.set('magnate-mode', m); renderLobby(); }
  function renderLobby() {
    const list = G.lobby || [];
    if (G.mode === 'host') renderModes('#host-modes', '#host-mdesc', G.gameMode, pickHost);
    if (G.mode === 'client' && G.gameMode && MODES[G.gameMode]) {
      $('#mode-box').classList.remove('hidden');
      $('#host-modes').innerHTML = `<button class="on" disabled>${MODES[G.gameMode].name}<small>${MODE_TAG[G.gameMode]}</small></button>`;
      $('#host-mdesc').textContent = MODES[G.gameMode].desc + ' (lo elige el anfitrión)';
    }
    $('#lobby-players').innerHTML = list.map((p, i) =>
      `<li><span class="pdot" style="background:${Magnate.COLORS[i]}"></span>${esc(p.name)}${p.id === token ? ' <small>(tú)</small>' : ''}${p.isAI ? ' <small>🤖</small>' : ''}${i === 0 && G.mode !== 'local' ? ' <small>👑 anfitrión</small>' : ''}</li>`).join('');
    if (G.mode === 'host') $('#btn-start').disabled = list.length < 2;
    if (G.mode === 'host' && !G.engine && G.host) G.host.broadcast({ t: 'lobby', players: list, mode: G.gameMode });
  }
  $('#btn-add-ai').onclick = () => {
    if (G.lobby.length >= 6) return toast('Máximo 6 jugadores.');
    const used = G.lobby.map(p => p.name);
    const name = BOT_NAMES.find(n => !used.includes(n)) || 'Bot';
    G.lobby.push({ id: 'bot' + Math.random().toString(36).slice(2, 7), name, isAI: true });
    renderLobby();
  };
  $('#btn-rm-ai').onclick = () => {
    const i = G.lobby.map(p => p.isAI).lastIndexOf(true);
    if (i >= 0) { G.lobby.splice(i, 1); renderLobby(); }
  };
  $('#btn-start').onclick = () => {
    if (G.lobby.length < 2) return;
    G.engine = new Engine(Engine.newGame(G.lobby, G.gameMode));
    startGame();
  };
  $('#btn-share').onclick = async () => {
    const code = $('#room-code').textContent;
    const text = `¡Juguemos Magnate CDMX (modo ${MODES[G.gameMode].name})! Abre la app, toca "Unirme" y escribe el código: ${code}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Copiado'); } } catch (e) { }
  };

  // ---------------- Sala: invitado ----------------
  $('#btn-join').onclick = () => {
    store.set('magnate-name', $('#in-name').value.trim());
    G = { mode: 'client', lobby: [] };
    $('#lobby-title').textContent = 'Unirme a sala';
    $('#join-box').classList.remove('hidden'); $('#code-box').classList.add('hidden'); $('#host-ctrls').classList.add('hidden'); $('#mode-box').classList.add('hidden');
    $('#lobby-status').textContent = ''; $('#lobby-players').innerHTML = '';
    $('#in-code').value = store.get('magnate-lastcode', '');
    show('scr-lobby');
  };
  $('#in-code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('#btn-join-go').onclick = () => {
    const code = $('#in-code').value.trim().toUpperCase();
    if (code.length !== 5) return toast('El código tiene 5 caracteres.');
    if (!window.Peer && !window.__FakePeer) { toast('No se pudo cargar el módulo de red.'); return; }
    store.set('magnate-lastcode', code);
    if (G.client) G.client.close();
    $('#lobby-status').textContent = 'Buscando la sala…';
    G.client = new Net.Client({
      onStatus: ok => {
        G.connected = ok;
        if (ok) { $('#lobby-status').textContent = 'Conectado. Esperando a que el anfitrión inicie…'; $('#join-box').classList.add('hidden'); }
        else $('#lobby-status').textContent = 'Conexión perdida. Reintentando…';
        const d = $('#net-dot'); if (d) d.classList.toggle('off', !ok);
      },
      onError: err => { $('#lobby-status').textContent = err.message || ('Error: ' + err.type); if (G.state) toast('Reconectando…'); },
      onMessage: msg => clientMsg(msg),
    });
    G.client.join(code, myName(), token);
  };
  function clientMsg(msg) {
    if (msg.t === 'lobby') { G.lobby = msg.players; G.gameMode = msg.mode; renderLobby(); }
    else if (msg.t === 'state') {
      const first = !G.state; G.state = msg.s;
      if (first || !$('#scr-game').classList.contains('active')) startGame(); else render();
    } else if (msg.t === 'err') {
      toast(msg.msg);
      if (msg.fatal) { G.client.close(); $('#lobby-status').textContent = msg.msg; $('#join-box').classList.remove('hidden'); }
    }
  }
  $('#btn-lobby-back').onclick = () => { leaveSession(); show('scr-home'); };

  // reenviar la lista del lobby periódicamente (por si algún mensaje se perdió)
  setInterval(() => { if (G && G.mode === 'host' && !G.engine && G.host) G.host.broadcast({ t: 'lobby', players: G.lobby, mode: G.gameMode }); }, 2500);

  function leaveSession() {
    clearTimeout(aiTimer);
    if (G) { if (G.host) G.host.close(); if (G.client) G.client.close(); }
    G = null; refreshHome();
  }

  // ---------------- Animación de fichas ----------------
  const anim = { disp: [], seen: 0, queue: [], busy: false, t: null };
  function resetAnim(st) {
    clearTimeout(anim.t);
    anim.disp = st.players.map(p => p.pos); anim.seen = st.moveSeq || 0; anim.queue = []; anim.busy = false;
  }
  function syncAnim(st) {
    for (const m of (st.moves || [])) if (m.id > anim.seen) { anim.queue.push(m); anim.seen = m.id; }
    if (!anim.busy && anim.queue.length) runAnim();
    if (!anim.busy) anim.disp = st.players.map(p => p.pos);
  }
  function runAnim() {
    const m = anim.queue.shift();
    if (!m || !G) {
      anim.busy = false;
      if (G) { const st = S(); if (st) anim.disp = st.players.map(p => p.pos); render(); scheduleAI(); }
      return;
    }
    anim.busy = true;
    const steps = [];
    if (m.kind === 'jump') steps.push(m.to);
    else { let x = m.from; const dir = m.kind === 'back' ? 39 : 1; while (x !== m.to && steps.length < 40) { x = (x + dir) % 40; steps.push(x); } }
    if (!steps.length) { runAnim(); return; }
    const dt = steps.length > 12 ? 120 : 185;
    let k = 0;
    const tick = () => {
      if (!G) { anim.busy = false; return; }
      anim.disp[m.p] = steps[k++];
      const last = k >= steps.length;
      renderTokens(m.p, last ? 'land' : 'hop');
      blip(last ? 330 : 520 + k * 12);
      anim.t = setTimeout(last ? runAnim : tick, last ? 320 : dt);
    };
    tick();
  }
  // sonido corto por salto
  let actx = null;
  function blip(freq) {
    if (!store.get('magnate-sound', true)) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.09);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.1);
    } catch (e) { }
  }
  function renderTokens(moving, cls) {
    const st = S(); if (!st) return;
    $$('#board .cell').forEach(el => {
      const i = +el.dataset.i;
      let has = false;
      el.querySelector('.toks').innerHTML = st.players.map((p, k) => {
        if (p.bankrupt || anim.disp[k] !== i) return '';
        if (k === moving) has = true;
        const c = k === moving ? cls : (k === st.turn && !anim.busy ? 'cur' : '');
        return `<span class="tok ${c} ${p.inJail && !anim.busy ? 'jailed' : ''}" style="background:${p.color}">${esc(p.name[0].toUpperCase())}</span>`;
      }).join('');
      el.classList.toggle('hopping', has);
    });
  }

  // ---------------- Juego ----------------
  function startGame() {
    seen = { roll: null, card: null, trade: null, turn: null, version: -1, ev: null };
    resetAnim(S());
    buildBoard();
    show('scr-game');
    $('#net-dot').classList.toggle('hidden', G.mode === 'local');
    $('#net-dot').classList.remove('off');
    try { history.pushState({ g: 1 }, ''); } catch (e) { }
    changed();
  }
  window.addEventListener('popstate', () => {
    if ($('#scr-game').classList.contains('active')) { try { history.pushState({ g: 1 }, ''); } catch (e) { } if (!$('#modal').classList.contains('hidden')) closeModal(); else openMenu(); }
  });

  // posición (fila, columna) de cada casilla en la cuadrícula 11x11
  function cellPos(i) {
    if (i <= 10) return [10, 10 - i];
    if (i <= 20) return [10 - (i - 10), 0];
    if (i <= 30) return [0, i - 20];
    return [i - 30, 10];
  }
  function cellSide(i) { if (i % 10 === 0) return 'corner'; if (i < 10) return 'bottom'; if (i < 20) return 'left'; if (i < 30) return 'top'; return 'right'; }
  const ICON = { go: '➜', chance: '❓', chest: '🏘️', tax: '💸', metro: 'Ⓜ', util: null, jail: '🔒', parking: '🅿️', gotojail: '🚓' };

  function buildBoard() {
    const b = $('#board'); b.innerHTML = '';
    BOARD.forEach((s, i) => {
      const [r, c] = cellPos(i);
      const d = document.createElement('div');
      d.className = `cell ${cellSide(i)} t-${s.type}`;
      d.style.gridRow = r + 1; d.style.gridColumn = c + 1;
      d.dataset.i = i;
      const actd = (S().rules || {}).actDecks;
      let icon = s.type === 'util' ? (i === 12 ? '💡' : '💧') : ICON[s.type];
      let short = s.short;
      if (actd && s.type === 'chance') { icon = '⚠️'; short = 'Siniestro'; }
      if (actd && s.type === 'chest') { icon = '📊'; short = 'Reserva'; }
      d.innerHTML =
        (s.type === 'prop' ? `<div class="cbar" style="background:${GROUPS[s.group].color}"><div class="houses"></div></div>` : '') +
        `<div class="cin">${icon ? `<div class="ic">${icon}</div>` : ''}<div class="nm">${esc(short)}</div>${s.price ? `<div class="pr">$${s.price}</div>` : ''}</div>` +
        `<div class="own"></div><div class="toks"></div>`;
      d.onclick = () => openProp(i);
      b.appendChild(d);
    });
    const center = document.createElement('div');
    center.className = 'center';
    center.innerHTML = `<div class="brand">MAGNATE<span>CDMX</span></div>
      <div class="dice"><div class="die" id="d1"></div><div class="die" id="d2"></div></div>
      <div class="minfo" id="minfo"></div>
      <div class="card hidden" id="card"></div>
      <div class="feed" id="feed"></div>`;
    b.appendChild(center);
  }

  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieHTML = n => Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[n].includes(k) ? 'p' : ''}"></i>`).join('');

  function render() {
    const st = S(); if (!st) return;
    const me = meIdx();
    const cur = st.players[st.turn];

    // casillas
    $$('#board .cell').forEach(el => {
      const i = +el.dataset.i, pr = st.props[i];
      const own = el.querySelector('.own');
      el.classList.toggle('mort', !!(pr && pr.mortgaged));
      el.classList.toggle('owned', !!pr);
      own.style.background = pr ? st.players[pr.owner].color : 'transparent';
      const h = el.querySelector('.houses');
      if (h) h.innerHTML = pr && pr.houses ? (pr.houses === 5 ? '<b class="hotel"></b>' : '<b></b>'.repeat(pr.houses)) : '';
    });
    if (anim.disp.length !== st.players.length) resetAnim(st);
    syncAnim(st);
    if (!anim.busy) renderTokens(-1);

    // dados
    const ev = st.lastEvent || {};
    $('#d1').innerHTML = dieHTML(st.dice[0]); $('#d2').innerHTML = dieHTML(st.dice[1]);
    if (ev.kind === 'roll' && ev.id !== seen.roll) {
      seen.roll = ev.id; $$('.die').forEach(d => { d.classList.remove('rolling'); void d.offsetWidth; d.classList.add('rolling'); });
    }
    // carta
    const card = $('#card');
    if (st.card && st.card.id !== seen.card && !anim.busy) {
      seen.card = st.card.id;
      card.className = 'card ' + st.card.deck;
      card.innerHTML = `<b>${esc((st.card.title || (st.card.deck === 'chance' ? '❓ Suerte' : '🏘️ Fondo Vecinal')).toUpperCase())}</b><p>${esc(st.card.text)}</p>`;
      clearTimeout(card._h); card._h = setTimeout(() => card.classList.add('hidden'), 4500);
    }
    if (!st.card) card.classList.add('hidden');
    // info del modo
    const R = st.rules || {}, info = [];
    if (R.roundLimit) info.push(`⏱️ Ronda ${Math.min(st.round || 1, R.roundLimit)}/${R.roundLimit}`);
    if (R.jackpot) info.push(`🎉 Bote ${money(st.pot || 0)}`);
    if (R.goalWorth) info.push(`💰 Meta ${money(R.goalWorth)}`);
    if (R.interest) info.push(`📈 Interés ${Math.round(R.interest * 100)}% por ronda`);
    $('#minfo').innerHTML = info.map(x => `<span>${x}</span>`).join('');
    $('#btn-ins').classList.toggle('hidden', !R.insurance);
    // feed
    $('#feed').innerHTML = st.log.slice(-3).map(l => `<div>${esc(l)}</div>`).join('');

    // barra superior
    $('#turn-label').innerHTML = st.phase === 'gameover'
      ? '🏆 Fin de la partida'
      : `<span class="pdot" style="background:${cur.color}"></span>Turno de <b>${esc(cur.name)}</b>${st.turn === me && G.mode !== 'local' ? ' (tú)' : ''}`;

    // jugadores
    $('#players').innerHTML = st.players.map((p, k) => `
      <div class="pchip ${k === st.turn ? 'cur' : ''} ${p.bankrupt ? 'out' : ''}">
        <span class="pdot" style="background:${p.color}"></span>
        <div><div class="pn">${esc(p.name)}${k === me && G.mode !== 'local' ? ' ·tú' : ''} ${p.isAI ? '🤖' : ''}${p.away ? '📴' : ''}${p.inJail ? '🔒' : ''}${p.jailCards ? '🎫' : ''}${p.policy && p.policy.left > 0 && (st.round || 1) < p.policy.until ? '🛡️' : ''}</div>
        <div class="pm">${p.bankrupt ? 'Quebró' : money(p.money)}</div>${!p.bankrupt && ((st.rules || {}).goalWorth || (st.rules || {}).roundLimit) ? `<div class="pw">patrimonio ${money(new Engine(st).netWorth(k))}</div>` : ''}</div>
      </div>`).join('');

    renderActions(st, me);

    // nuevo turno propio: vibrar
    const turnKey = st.turn + ':' + st.turnCount;
    if (turnKey !== seen.turn) {
      seen.turn = turnKey;
      if (G.mode !== 'local' && st.turn === me && st.phase !== 'gameover') { try { navigator.vibrate && navigator.vibrate(120); } catch (e) { } toast('¡Es tu turno!'); }
      if (G.mode === 'local' && !cur.isAI && st.players.filter(p => !p.isAI).length > 1) toast(`Turno de ${cur.name}`);
    }
    // propuesta de intercambio entrante
    const tkey = st.trade ? JSON.stringify(st.trade) : null;
    if (tkey !== seen.trade) {
      seen.trade = tkey;
      if (st.trade && st.trade.to === me && !st.players[me].isAI) openTradeIncoming();
      else if (!st.trade && $('#sheet').dataset.kind === 'tradeIn') closeModal();
    }
    // refrescar hoja abierta
    const kind = $('#sheet').dataset.kind;
    if (!$('#modal').classList.contains('hidden')) {
      if (kind === 'prop') openProp(+$('#sheet').dataset.i, true);
      if (kind === 'mine') openMine(true);
      if (kind === 'log') openLog();
      if (kind === 'ins') openInsurance();
    }
    if (st.phase === 'gameover' && seen.ev !== 'over') { seen.ev = 'over'; if (G.mode === 'local') store.del('magnate-save'); }
  }

  function renderActions(st, me) {
    const A = $('#actions');
    const cur = st.players[st.turn];
    const mine = st.turn === me;
    const btn = (label, a, cls = '', dis = false) => `<button class="btn ${cls}" ${dis ? 'disabled' : ''} data-a='${JSON.stringify(a)}'>${label}</button>`;
    let h = '';
    if (anim.busy) {
      A.innerHTML = `<div class="msg dim">${esc(cur.name)} avanza…</div>`;
      return;
    }
    if (st.phase === 'gameover') {
      const w = st.players[st.winner];
      h = `<div class="msg big">🏆 ¡${esc(w.name)} gana!</div><button class="btn primary" id="btn-again">Volver al inicio</button>`;
    } else if (st.trade) {
      const t = st.trade;
      if (t.to === me) h = `<div class="msg">${esc(st.players[t.from].name)} te propone un intercambio.</div><button class="btn primary" id="btn-see-trade">Ver propuesta</button>`;
      else if (t.from === me) h = `<div class="msg">Esperando respuesta de ${esc(st.players[t.to].name)}…</div>${btn('Retirar propuesta', { type: 'cancelTrade' })}`;
      else h = `<div class="msg">${esc(st.players[t.from].name)} negocia con ${esc(st.players[t.to].name)}…</div>`;
    } else if (!mine) {
      h = `<div class="msg">${cur.isAI || cur.away ? '🤖 ' : '⏳ '}${esc(cur.name)} está jugando…</div>`;
    } else if (st.phase === 'roll') {
      const p = cur;
      if (p.inJail) {
        h = `<div class="msg">Estás en el Reclusorio (intento ${p.jailTurns + 1} de 3).</div><div class="row">` +
          btn('🎲 Tirar por dobles', { type: 'roll' }, 'primary') + btn('Pagar $50', { type: 'payJail' }, '', p.money < 50) +
          (p.jailCards ? btn('Usar tarjeta 🎫', { type: 'useJailCard' }) : '') + `</div>`;
      } else h = `${st.doubles ? '<div class="msg">¡Dobles! Tira otra vez.</div>' : ''}` + btn('🎲 Tirar dados', { type: 'roll' }, 'primary huge');
    } else if (st.phase === 'buy') {
      const s = BOARD[st.pendingBuy], can = cur.money >= s.price;
      h = `<div class="buy"><span class="sw" style="background:${s.group ? GROUPS[s.group].color : '#666'}"></span><div><b>${esc(s.name)}</b><br><small>Precio ${money(s.price)} · tienes ${money(cur.money)}</small></div></div>
        <div class="row">${btn('Comprar', { type: 'buy' }, 'primary', !can)}${btn('No comprar', { type: 'decline' })}</div>
        ${can ? '' : '<div class="hint">No te alcanza: puedes hipotecar en «Mis propiedades».</div>'}`;
    } else if (st.phase === 'debt') {
      h = `<div class="msg warn">Debes ${money(-cur.money)}. Vende casas o hipoteca.</div><div class="row"><button class="btn primary" id="btn-debt-props">Mis propiedades</button>${btn('Declararme en quiebra', { type: 'bankrupt' }, 'danger')}</div>`;
    } else if (st.phase === 'end') {
      h = btn('Terminar turno ➜', { type: 'endTurn' }, 'primary huge');
    }
    A.innerHTML = h;
    A.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const a = JSON.parse(b.dataset.a);
      if (a.type === 'bankrupt' && !confirm2('¿Seguro? Perderás la partida.', () => dispatch(a))) return;
      dispatch(a);
    });
    const again = $('#btn-again'); if (again) again.onclick = () => { leaveSession(); show('scr-home'); };
    const see = $('#btn-see-trade'); if (see) see.onclick = openTradeIncoming;
    const dp = $('#btn-debt-props'); if (dp) dp.onclick = () => openMine();
  }

  // confirmación propia (los diálogos nativos se ven mal en WebView)
  function confirm2(text, yes) {
    openSheet('confirm', `<p class="ctext">${esc(text)}</p><div class="row"><button class="btn danger" id="c-yes">Sí</button><button class="btn" id="c-no">Cancelar</button></div>`);
    $('#c-yes').onclick = () => { closeModal(); yes(); };
    $('#c-no').onclick = closeModal;
    return false;
  }

  // ---------------- Hojas modales ----------------
  function openSheet(kind, html, extra = {}) {
    const sh = $('#sheet'); sh.dataset.kind = kind; Object.assign(sh.dataset, extra);
    sh.innerHTML = `<div class="grab"></div>` + html;
    $('#modal').classList.remove('hidden');
  }
  function closeModal() { $('#modal').classList.add('hidden'); $('#sheet').dataset.kind = ''; }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

  function propActions(st, me, i) {
    const pr = st.props[i]; if (!pr || pr.owner !== me || st.turn !== me) return '';
    const e = new Engine(st);
    const ph = st.phase, b = [];
    if (['roll', 'end'].includes(ph) && !st.trade) {
      if (e.canBuild(me, i)) b.push(`<button class="btn primary" data-pa="build" data-i="${i}">Construir (${money(BOARD[i].house)})</button>`);
      if (e.canUnmortgage(me, i)) b.push(`<button class="btn" data-pa="unmortgage" data-i="${i}">Deshipotecar (${money(Math.ceil(BOARD[i].price * 0.55))})</button>`);
    }
    if (['roll', 'end', 'debt', 'buy'].includes(ph) && !st.trade) {
      if (e.canSell(me, i)) b.push(`<button class="btn" data-pa="sell" data-i="${i}">Vender casa (+${money(BOARD[i].house / 2)})</button>`);
      if (e.canMortgage(me, i)) b.push(`<button class="btn" data-pa="mortgage" data-i="${i}">Hipotecar (+${money(BOARD[i].price / 2)})</button>`);
    }
    return b.join('');
  }
  function wirePA() { $$('#sheet [data-pa]').forEach(x => x.onclick = () => dispatch({ type: x.dataset.pa, idx: +x.dataset.i })); }

  function openProp(i, refresh) {
    const st = S(), s = BOARD[i], pr = st.props[i], me = meIdx();
    if (!s.price) {
      const desc = {
        go: 'Cobras $200 cada vez que pasas o caes aquí.', chance: 'Toma una carta de Suerte.', chest: 'Toma una carta del Fondo Vecinal.',
        tax: `Pagas ${money(s.amount || 0)} al banco.`, jail: 'Si solo caes aquí, estás de visita.', parking: 'Descansa. No pasa nada.',
        gotojail: 'Vas directo al Reclusorio sin cobrar la Salida.'
      }[s.type];
      if (!refresh) openSheet('info', `<h3>${esc(s.name)}</h3><p>${desc}</p>`);
      return;
    }
    let body = '';
    if (s.type === 'prop') {
      const labels = ['Renta', 'Con 1 casa', 'Con 2 casas', 'Con 3 casas', 'Con 4 casas', 'Con hotel'];
      body = `<table class="rt">${s.rent.map((r, k) => `<tr class="${pr && pr.houses === k ? 'on' : ''}"><td>${labels[k]}</td><td>${money(r)}</td></tr>`).join('')}</table>
        <p class="small">Grupo completo sin casas: renta doble. Casa: ${money(s.house)} · Hotel: 4 casas + ${money(s.house)}</p>`;
    } else if (s.type === 'metro') {
      body = `<table class="rt"><tr><td>1 línea</td><td>$25</td></tr><tr><td>2 líneas</td><td>$50</td></tr><tr><td>3 líneas</td><td>$100</td></tr><tr><td>4 líneas</td><td>$200</td></tr></table>`;
    } else body = `<p>Con 1 servicio: 4 × los dados.<br>Con ambos: 10 × los dados.</p>`;
    const owner = pr ? `<p>Dueño: <span class="pdot" style="background:${st.players[pr.owner].color}"></span><b>${esc(st.players[pr.owner].name)}</b>${pr.mortgaged ? ' · <i>hipotecada</i>' : ''}</p>` : '<p>Sin dueño</p>';
    const head = s.type === 'prop' ? `<div class="phead" style="background:${GROUPS[s.group].color}">${esc(s.name)}</div>` : `<h3>${esc(s.name)}</h3>`;
    const html = `${head}<p>Precio ${money(s.price)} · Hipoteca ${money(s.price / 2)}</p>${owner}${body}<div class="col">${propActions(st, me, i)}</div>`;
    openSheet('prop', html, { i });
    wirePA();
  }

  function openMine(refresh) {
    const st = S(), me = meIdx(); if (me < 0) return;
    const p = st.players[me];
    const mine = OWNABLE.filter(i => st.props[i] && st.props[i].owner === me);
    const rows = mine.map(i => {
      const s = BOARD[i], pr = st.props[i];
      const col = s.group ? GROUPS[s.group].color : '#555';
      const tag = pr.mortgaged ? '<i>hipotecada</i>' : pr.houses === 5 ? '🏨 hotel' : pr.houses ? '🏠'.repeat(pr.houses) : '';
      return `<div class="mrow"><span class="sw" style="background:${col}"></span><div class="mn" data-open="${i}">${esc(s.name)}<br><small>${tag}</small></div><div class="mb">${propActions(st, me, i)}</div></div>`;
    }).join('') || '<p class="small">Aún no tienes propiedades.</p>';
    openSheet('mine', `<h3>Mis propiedades</h3><p>${esc(p.name)} · ${money(p.money)} · patrimonio ${money(new Engine(st).netWorth(me))}</p>${rows}`);
    wirePA();
    $$('#sheet [data-open]').forEach(x => x.onclick = () => openProp(+x.dataset.open));
  }

  function openLog() {
    const st = S();
    openSheet('log', `<h3>Historial</h3><div class="log">${st.log.slice().reverse().map(l => `<div>${esc(l)}</div>`).join('')}</div>`);
  }

  function openMenu() {
    const extra = G.mode === 'host' && G.host && G.host.code ? `<p>Código de sala: <b class="mono">${G.host.code}</b></p>` : '';
    const note = G.mode === 'host' ? '<p class="small">Eres el anfitrión: si sales, la partida termina para todos.</p>' : G.mode === 'local' ? '<p class="small">La partida se guarda sola; puedes continuarla desde el inicio.</p>' : '';
    const st = S(), md = MODES[st.mode || 'clasico'];
    const snd = store.get('magnate-sound', true);
    openSheet('menu', `<h3>Menú</h3><p>Modo <b>${md.name}</b>: ${md.desc}</p>${extra}${note}<div class="col"><button class="btn" id="m-sound">Sonido: ${snd ? 'sí 🔊' : 'no 🔇'}</button><button class="btn" id="m-rules">Cómo se juega</button><button class="btn danger" id="m-exit">Salir al inicio</button><button class="btn" id="m-close">Seguir jugando</button></div>`);
    $('#m-close').onclick = closeModal;
    $('#m-sound').onclick = () => { store.set('magnate-sound', !snd); openMenu(); };
    $('#m-rules').onclick = openRules;
    $('#m-exit').onclick = () => { leaveSession(); show('scr-home'); };
  }
  function openRules() {
    openSheet('rules', `<h3>Cómo se juega</h3><div class="rules">
      <p>Tira los dados y avanza. Si caes en una propiedad sin dueño, puedes comprarla. Si tiene dueño, le pagas renta.</p>
      <p>Junta todas las colonias de un color para cobrar renta doble y poder construir casas (máximo 4) y luego un hotel. Se construye parejo dentro del grupo.</p>
      <p>Las líneas del Metro cobran más mientras más tengas. Luz y Agua cobran según los dados.</p>
      <p>Sacar dobles te da otro tiro; tres dobles seguidos te mandan al Reclusorio. Para salir: saca dobles, paga $50 o usa una tarjeta.</p>
      <p>Si te falta dinero, vende casas o hipoteca. Si aun así no alcanza, quiebras. Gana el último que quede en pie.</p>
      <p>En tu turno puedes proponer intercambios de propiedades y dinero.</p>
      ${(S().rules || {}).insurance ? '<p><b>Seguro:</b> en tu turno, toca «Seguro» para contratar una póliza que cubre 80% de tus rentas por 5 rondas (suma asegurada $1,000). La prima es el valor esperado de lo que cubre, más 20% de recargo.</p>' : ''}
      <p><b>Modos:</b> ${Object.values(MODES).map(m => `<b>${m.name}</b>: ${m.desc}`).join('<br>')}</p></div>`);
  }

  $('#btn-menu').onclick = openMenu;
  $('#btn-myprops').onclick = () => openMine();
  $('#btn-log').onclick = openLog;
  $('#btn-trade').onclick = () => openTradeComposer();
  $('#btn-ins').onclick = () => openInsurance();

  // ---------------- Seguro (modo actuarial) ----------------
  function openInsurance() {
    const st = S(), me = meIdx(); if (me < 0) return;
    const e = new Engine(st), p = st.players[me], q = e.policyQuote(me);
    const active = e.insured(me);
    const myTurn = st.turn === me && ['roll', 'end'].includes(st.phase) && !st.trade;
    openSheet('ins', `<h3>🛡️ Seguro de rentas</h3>
      <p>Cubre el <b>80%</b> de cada renta que pagues durante <b>5 rondas</b>, hasta una suma asegurada de <b>$1,000</b>.</p>
      ${active ? `<p class="okbox">Póliza vigente hasta la ronda ${p.policy.until - 1}. Te quedan ${money(p.policy.left)} de suma asegurada.</p>` : ''}
      <table class="rt">
        <tr><td>Renta esperada por turno<br><small>E[R] = Σ rentaᵢ · P(caer en i), P ≈ 1/40</small></td><td>${money2(q.er)}</td></tr>
        <tr><td>Prima de riesgo<br><small>5 turnos × 80% × E[R], tope $1,000</small></td><td>${money2(q.pura)}</td></tr>
        <tr><td>Recargo de seguridad (20%)</td><td>${money2(q.recargo)}</td></tr>
        <tr class="on"><td><b>Prima total</b></td><td>${money(q.total)}</td></tr>
      </table>
      <p class="small">La prima se recalcula con las rentas actuales del tablero: entre más casas tengan tus rivales, más cara.</p>
      <button class="btn primary big" id="ins-buy" ${!myTurn || active || p.money < q.total ? 'disabled' : ''}>Contratar por ${money(q.total)}</button>
      ${!myTurn ? '<p class="small">Solo puedes contratar en tu turno.</p>' : ''}`);
    $('#ins-buy').onclick = () => { closeModal(); dispatch({ type: 'buyPolicy' }); };
  }

  // ---------------- Panel secreto del creador ----------------
  // Se abre tocando 5 veces seguidas el logo del centro del tablero.
  let secretTaps = [];
  document.addEventListener('click', e => {
    if (!e.target.closest('.brand')) return;
    const now = Date.now();
    secretTaps = secretTaps.filter(t => now - t < 3000); secretTaps.push(now);
    if (secretTaps.length >= 5) { secretTaps = []; openSecret(); }
  });
  function openSecret() {
    const st = S(), me = meIdx(); if (!st || me < 0) return;
    const fx = st.players[me].fx || {};
    const on = Object.keys(FX_NAMES).filter(k => fx[k]);
    openSheet('secret', `<h3>🔑</h3>
      <label class="field sm"><input id="sc-in" autocomplete="off" autocapitalize="characters" placeholder="Código"></label>
      <div class="row" style="margin-top:8px"><button class="btn primary" id="sc-go">Aplicar</button><button class="btn" id="sc-x">Cerrar</button></div>
      <div class="col">${on.map(k => `<div class="mrow"><div class="mn">✅ ${esc(FX_NAMES[k])}</div></div>`).join('') || '<p class="small">Ninguno activo. Escribe un código para activarlo; escríbelo otra vez para apagarlo.</p>'}</div>`);
    $('#sc-x').onclick = closeModal;
    $('#sc-go').onclick = () => {
      const code = $('#sc-in').value.trim(); if (!code) return;
      dispatch({ type: 'fx', code });
      setTimeout(() => { if ($('#sheet').dataset.kind === 'secret') openSecret(); }, 400);
    };
  }

  // ---------------- Intercambios ----------------
  function propLabel(st, i) {
    const s = BOARD[i], pr = st.props[i];
    const col = s.group ? GROUPS[s.group].color : '#555';
    return `<span class="sw" style="background:${col}"></span>${esc(s.name)}${pr.mortgaged ? ' <i>(hip.)</i>' : ''}`;
  }
  function openTradeComposer(target) {
    const st = S(), me = meIdx();
    if (me < 0 || st.turn !== me || !['roll', 'end'].includes(st.phase) || st.trade) { toast('Solo puedes proponer intercambios en tu turno.'); return; }
    const others = st.players.map((p, k) => k).filter(k => k !== me && !st.players[k].bankrupt);
    if (target === undefined) target = others[0];
    const tradable = pi => OWNABLE.filter(i => st.props[i] && st.props[i].owner === pi && !(BOARD[i].type === 'prop' && new Engine(st).groupHasBuildings(BOARD[i].group)));
    const list = (pi, name) => tradable(pi).map(i => `<label class="ck"><input type="checkbox" name="${name}" value="${i}">${propLabel(st, i)}</label>`).join('') || '<p class="small">Nada para intercambiar</p>';
    openSheet('trade', `<h3>Proponer intercambio</h3>
      <div class="seg wrap" id="t-who">${others.map(k => `<button data-k="${k}" class="${k === target ? 'on' : ''}"><span class="pdot" style="background:${st.players[k].color}"></span>${esc(st.players[k].name)}</button>`).join('')}</div>
      <div class="tcols">
        <div><p class="lbl">Tú das</p>${list(me, 'give')}<label class="field sm">Dinero<input type="number" id="t-gm" min="0" max="${st.players[me].money}" value="0" inputmode="numeric"></label></div>
        <div><p class="lbl">Tú pides</p>${list(target, 'get')}<label class="field sm">Dinero<input type="number" id="t-rm" min="0" max="${st.players[target].money}" value="0" inputmode="numeric"></label></div>
      </div>
      <button class="btn primary big" id="t-send">Enviar propuesta</button>`);
    $$('#t-who button').forEach(b => b.onclick = () => openTradeComposer(+b.dataset.k));
    $('#t-send').onclick = () => {
      const give = $$('#sheet input[name=give]:checked').map(x => +x.value);
      const get = $$('#sheet input[name=get]:checked').map(x => +x.value);
      const trade = { to: target, give, get, giveMoney: +$('#t-gm').value || 0, getMoney: +$('#t-rm').value || 0 };
      closeModal();
      dispatch({ type: 'proposeTrade', trade });
    };
  }
  function openTradeIncoming() {
    const st = S(), t = st.trade; if (!t) return;
    const side = (arr, m) => (arr.map(i => `<div>${propLabel(st, i)}</div>`).join('') + (m ? `<div>💵 ${money(m)}</div>` : '')) || '<div class="small">Nada</div>';
    openSheet('tradeIn', `<h3>${esc(st.players[t.from].name)} te propone</h3>
      <div class="tcols"><div><p class="lbl">Recibes</p>${side(t.give, t.giveMoney)}</div><div><p class="lbl">Entregas</p>${side(t.get, t.getMoney)}</div></div>
      <div class="row"><button class="btn primary" id="t-yes">Aceptar</button><button class="btn" id="t-no">Rechazar</button></div>`);
    $('#t-yes').onclick = () => { closeModal(); dispatch({ type: 'respondTrade', accept: true }); };
    $('#t-no').onclick = () => { closeModal(); dispatch({ type: 'respondTrade', accept: false }); };
  }

  // Exponer para pruebas
  window.__magnate = { get G() { return G; }, render, dispatch };
})();
