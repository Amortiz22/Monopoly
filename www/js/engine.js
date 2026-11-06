/* Magnate CDMX — motor del juego (reglas, tablero, cartas, IA).
   El motor es determinista dado un estado; el anfitrión (o el modo local) es quien lo ejecuta. */
(function (root) {
  'use strict';

  const GROUPS = {
    cafe:    { color: '#8B5A2B', name: 'Café' },
    celeste: { color: '#7FD3F7', name: 'Celeste' },
    rosa:    { color: '#E0479E', name: 'Rosa' },
    naranja: { color: '#F7931E', name: 'Naranja' },
    rojo:    { color: '#E53935', name: 'Rojo' },
    amarillo:{ color: '#FDD835', name: 'Amarillo' },
    verde:   { color: '#2E9E4F', name: 'Verde' },
    azul:    { color: '#1E4FB5', name: 'Azul' },
  };

  // type: go, prop, metro, util, tax, chance, chest, jail, parking, gotojail
  const P = (name, short, group, price, house, rent) => ({ type: 'prop', name, short, group, price, house, rent });
  const BOARD = [
    { type: 'go', name: 'Salida', short: 'SALIDA' },
    P('Tepito', 'Tepito', 'cafe', 60, 50, [2, 10, 30, 90, 160, 250]),
    { type: 'chest', name: 'Fondo Vecinal', short: 'Fondo' },
    P('Iztapalapa', 'Iztapa.', 'cafe', 60, 50, [4, 20, 60, 180, 320, 450]),
    { type: 'tax', name: 'Impuesto Predial', short: 'Predial', amount: 200 },
    { type: 'metro', name: 'Metro Línea 1', short: 'L1', price: 200 },
    P('Tlatelolco', 'Tlatelol.', 'celeste', 100, 50, [6, 30, 90, 270, 400, 550]),
    { type: 'chance', name: 'Suerte', short: 'Suerte' },
    P('Doctores', 'Doctores', 'celeste', 100, 50, [6, 30, 90, 270, 400, 550]),
    P('Guerrero', 'Guerrero', 'celeste', 120, 50, [8, 40, 100, 300, 450, 600]),
    { type: 'jail', name: 'Reclusorio / De visita', short: 'Cárcel' },
    P('Coyoacán', 'Coyoacán', 'rosa', 140, 100, [10, 50, 150, 450, 625, 750]),
    { type: 'util', name: 'Compañía de Luz', short: 'Luz', price: 150 },
    P('San Ángel', 'S. Ángel', 'rosa', 140, 100, [10, 50, 150, 450, 625, 750]),
    P('Tlalpan', 'Tlalpan', 'rosa', 160, 100, [12, 60, 180, 500, 700, 900]),
    { type: 'metro', name: 'Metro Línea 2', short: 'L2', price: 200 },
    P('Narvarte', 'Narvarte', 'naranja', 180, 100, [14, 70, 200, 550, 750, 950]),
    { type: 'chest', name: 'Fondo Vecinal', short: 'Fondo' },
    P('Del Valle', 'Del Valle', 'naranja', 180, 100, [14, 70, 200, 550, 750, 950]),
    P('Mixcoac', 'Mixcoac', 'naranja', 200, 100, [16, 80, 220, 600, 800, 1000]),
    { type: 'parking', name: 'Estacionamiento Libre', short: 'Estac.' },
    P('Roma Norte', 'Roma N.', 'rojo', 220, 150, [18, 90, 250, 700, 875, 1050]),
    { type: 'chance', name: 'Suerte', short: 'Suerte' },
    P('Condesa', 'Condesa', 'rojo', 220, 150, [18, 90, 250, 700, 875, 1050]),
    P('Juárez', 'Juárez', 'rojo', 240, 150, [20, 100, 300, 750, 925, 1100]),
    { type: 'metro', name: 'Metro Línea 3', short: 'L3', price: 200 },
    P('Centro Histórico', 'Centro', 'amarillo', 260, 150, [22, 110, 330, 800, 975, 1150]),
    P('Reforma', 'Reforma', 'amarillo', 260, 150, [22, 110, 330, 800, 975, 1150]),
    { type: 'util', name: 'Sistema de Aguas', short: 'Agua', price: 150 },
    P('Chapultepec', 'Chapul.', 'amarillo', 280, 150, [24, 120, 360, 850, 1025, 1200]),
    { type: 'gotojail', name: '¡Al Reclusorio!', short: '¡Cárcel!' },
    P('Polanco', 'Polanco', 'verde', 300, 200, [26, 130, 390, 900, 1100, 1275]),
    P('Lomas de Chapultepec', 'Lomas', 'verde', 300, 200, [26, 130, 390, 900, 1100, 1275]),
    { type: 'chest', name: 'Fondo Vecinal', short: 'Fondo' },
    P('Santa Fe', 'Santa Fe', 'verde', 320, 200, [28, 150, 450, 1000, 1200, 1400]),
    { type: 'metro', name: 'Metro Línea 12', short: 'L12', price: 200 },
    { type: 'chance', name: 'Suerte', short: 'Suerte' },
    P('Pedregal', 'Pedregal', 'azul', 350, 200, [35, 175, 500, 1100, 1300, 1500]),
    { type: 'tax', name: 'Impuesto de Lujo', short: 'Lujo', amount: 100 },
    P('Bosques de las Lomas', 'Bosques', 'azul', 400, 200, [50, 200, 600, 1400, 1700, 2000]),
  ];
  const JAIL = 10;
  const OWNABLE = BOARD.map((s, i) => (s.price ? i : -1)).filter(i => i >= 0);
  const groupMembers = {};
  BOARD.forEach((s, i) => { if (s.type === 'prop') (groupMembers[s.group] = groupMembers[s.group] || []).push(i); });

  const CHANCE = [
    { text: 'Avanza a la Salida y cobra $200.', kind: 'move', to: 0 },
    { text: 'Avanza a Bosques de las Lomas.', kind: 'move', to: 39 },
    { text: 'Avanza a Roma Norte. Si pasas por la Salida, cobra $200.', kind: 'move', to: 21 },
    { text: 'Avanza a Coyoacán. Si pasas por la Salida, cobra $200.', kind: 'move', to: 11 },
    { text: 'Ve a la estación de Metro más cercana. Si tiene dueño, paga el doble de renta.', kind: 'nearest', t: 'metro' },
    { text: 'Ve a la estación de Metro más cercana. Si tiene dueño, paga el doble de renta.', kind: 'nearest', t: 'metro' },
    { text: 'Ve al servicio más cercano. Si tiene dueño, paga 10 veces tu tirada.', kind: 'nearest', t: 'util' },
    { text: 'Tu tanda salió primero: cobra $50.', kind: 'money', amount: 50 },
    { text: 'Salida libre del Reclusorio. Guárdala hasta que la necesites.', kind: 'jailcard' },
    { text: 'Retrocede 3 casillas.', kind: 'back', n: 3 },
    { text: 'Te atrapó el alcoholímetro. Ve directo al Reclusorio.', kind: 'jail' },
    { text: 'Mantenimiento general: paga $25 por casa y $100 por hotel.', kind: 'repairs', house: 25, hotel: 100 },
    { text: 'Fotomulta por exceso de velocidad: paga $15.', kind: 'money', amount: -15 },
    { text: 'Toma el Metro Línea 1. Si pasas por la Salida, cobra $200.', kind: 'move', to: 5 },
    { text: 'Te eligieron presidente de la junta vecinal: paga $50 a cada jugador.', kind: 'each', amount: -50 },
    { text: 'Vence tu inversión a plazo fijo: cobra $150.', kind: 'money', amount: 150 },
  ];
  const CHEST = [
    { text: 'Avanza a la Salida y cobra $200.', kind: 'move', to: 0 },
    { text: 'Error del banco a tu favor: cobra $200.', kind: 'money', amount: 200 },
    { text: 'Consulta médica: paga $50.', kind: 'money', amount: -50 },
    { text: 'Vendiste tamales en la kermés: cobra $50.', kind: 'money', amount: 50 },
    { text: 'Salida libre del Reclusorio. Guárdala hasta que la necesites.', kind: 'jailcard' },
    { text: 'Te confundieron con un sospechoso. Ve directo al Reclusorio.', kind: 'jail' },
    { text: 'Organizaste la posada: cobra $50 a cada jugador.', kind: 'each', amount: 50 },
    { text: 'Devolución del SAT: cobra $20.', kind: 'money', amount: 20 },
    { text: '¡Es tu cumpleaños! Cobra $10 a cada jugador.', kind: 'each', amount: 10 },
    { text: 'Cobras tu seguro de vida: $100.', kind: 'money', amount: 100 },
    { text: 'Cuenta del hospital: paga $100.', kind: 'money', amount: -100 },
    { text: 'Colegiatura: paga $50.', kind: 'money', amount: -50 },
    { text: 'Diste una asesoría: cobra $25.', kind: 'money', amount: 25 },
    { text: 'Bacheo de tu calle: paga $40 por casa y $115 por hotel.', kind: 'repairs', house: 40, hotel: 115 },
    { text: 'Segundo lugar en el concurso de baile: cobra $10.', kind: 'money', amount: 10 },
    { text: 'Heredaste de una tía: cobra $100.', kind: 'money', amount: 100 },
  ];

  const MODES = {
    clasico: { name: 'Clásico', desc: 'Las reglas de siempre. Gana el último que no quiebre.', rules: {} },
    rapido: { name: 'Rápido', desc: 'Cada quien empieza con 3 propiedades al azar. Al terminar la ronda 20 gana quien tenga más patrimonio.', rules: { dealProps: 3, roundLimit: 20 } },
    fiesta: { name: 'Fiesta', desc: 'Empiezas con $2,000. Impuestos y multas van a un bote que se lleva quien caiga en el Estacionamiento. Caer justo en la Salida paga $400.', rules: { startMoney: 2000, jackpot: true, goBonus: true } },
    actuarial: { name: 'Actuarial', desc: 'Tu efectivo gana 2% de interés por ronda (máx. $100). Puedes contratar un seguro que cubre 80% de las rentas por 5 rondas (suma asegurada $1,000), con prima calculada por valor esperado. Las cartas son de Siniestros y Reservas.', rules: { interest: 0.02, insurance: true, actDecks: true } },
    millonario: { name: 'Millonario', desc: 'Gana el primero en juntar $4,000 de patrimonio (dinero + propiedades + casas).', rules: { goalWorth: 4000 } },
  };

  const CHANCE_ACT = [
    { text: 'Te ascienden a Actuario en Jefe: avanza a la Salida.', kind: 'move', to: 0 },
    { text: 'Visita a un cliente VIP en Bosques de las Lomas.', kind: 'move', to: 39 },
    { text: 'Junta con el reasegurador en Roma Norte. Si pasas por la Salida, cobra.', kind: 'move', to: 21 },
    { text: 'Congreso de actuarios en Coyoacán. Si pasas por la Salida, cobra.', kind: 'move', to: 11 },
    { text: 'Paro en el transporte: ve al Metro más cercano. Si tiene dueño, paga renta doble.', kind: 'nearest', t: 'metro' },
    { text: 'Correlación inesperada: ve al Metro más cercano. Si tiene dueño, paga renta doble.', kind: 'nearest', t: 'metro' },
    { text: 'Revisión de tarifas: ve al servicio más cercano. Si tiene dueño, paga 10 veces tu tirada.', kind: 'nearest', t: 'util' },
    { text: 'Tu reserva técnica resultó suficiente: cobra $50.', kind: 'money', amount: 50 },
    { text: 'Dictamen actuarial favorable: sal libre del Reclusorio. Guárdala.', kind: 'jailcard' },
    { text: 'Error en la tabla de mortalidad: retrocede 3 casillas.', kind: 'back', n: 3 },
    { text: 'Te audita la Comisión de Seguros: ve directo al Reclusorio.', kind: 'jail' },
    { text: 'Siniestro catastrófico: paga $25 por casa y $100 por hotel.', kind: 'repairs', house: 25, hotel: 100 },
    { text: 'Confundiste la tasa efectiva con la nominal: paga $15.', kind: 'money', amount: -15 },
    { text: 'Toma el Metro Línea 1. Si pasas por la Salida, cobra.', kind: 'move', to: 5 },
    { text: 'Te eligieron presidente del Colegio de Actuarios: paga $50 a cada jugador.', kind: 'each', amount: -50 },
    { text: 'Vence tu bono cupón cero: cobra $150.', kind: 'money', amount: 150 },
  ];
  const CHEST_ACT = [
    { text: 'Aprobaste todos los exámenes: avanza a la Salida.', kind: 'move', to: 0 },
    { text: 'Liberación de reservas: cobra $200.', kind: 'money', amount: 200 },
    { text: 'Inscripción al examen de certificación: paga $50.', kind: 'money', amount: -50 },
    { text: 'Tu GLM ganó un concurso de modelación: cobra $50.', kind: 'money', amount: 50 },
    { text: 'Dictamen actuarial favorable: sal libre del Reclusorio. Guárdala.', kind: 'jailcard' },
    { text: 'Reportaste mal la siniestralidad: ve directo al Reclusorio.', kind: 'jail' },
    { text: 'Diste un curso de R a tus colegas: cobra $50 a cada jugador.', kind: 'each', amount: 50 },
    { text: 'Ajuste por inflación a tu favor: cobra $20.', kind: 'money', amount: 20 },
    { text: 'Ganaste la apuesta sobre la tasa de descuento: cobra $10 a cada jugador.', kind: 'each', amount: 10 },
    { text: 'Cobras una anualidad vencida: $100.', kind: 'money', amount: 100 },
    { text: 'Desviación adversa de la siniestralidad: paga $100.', kind: 'money', amount: -100 },
    { text: 'Renovación de la licencia del software actuarial: paga $50.', kind: 'money', amount: -50 },
    { text: 'Hiciste un peritaje actuarial: cobra $25.', kind: 'money', amount: 25 },
    { text: 'Reserva para riesgos catastróficos: paga $40 por casa y $115 por hotel.', kind: 'repairs', house: 40, hotel: 115 },
    { text: 'Segundo lugar en el maratón de probabilidad: cobra $10.', kind: 'money', amount: 10 },
    { text: 'Rescataste tu seguro dotal: cobra $100.', kind: 'money', amount: 100 },
  ];
  const BAD_CARD = c => (c.kind === 'money' && c.amount < 0) || (c.kind === 'each' && c.amount < 0) || c.kind === 'jail' || c.kind === 'repairs' || c.kind === 'back' || (c.kind === 'nearest');

  // ---------- códigos de creador ----------
  // Se guardan como huella (hash) para que no aparezcan en texto plano. Para cambiarlos: node tools/hash-code.js TUCODIGO
  const hashCode = str => { let h = 0x811c9dc5; for (const ch of String(str).trim().toUpperCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const SECRET_CODES = {
    '150b543f': 'renta',    // pagas la mitad de las rentas (el dueño cobra completo)
    'a0b95971': 'dados',    // si vas a caer en una propiedad rival cara, se vuelve a tirar en secreto
    '908f6017': 'cartas',  // solo te salen cartas buenas
    '96bb967c': 'salida',  // cobras $300 al pasar por la Salida
  };
  const FX_NAMES = { renta: 'Pagas la mitad de las rentas', dados: 'Dados que esquivan rentas caras', cartas: 'Solo cartas buenas', salida: 'Cobras $300 en la Salida' };

  const COLORS = ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA', '#FB8C00'];
  const START_MONEY = 1500;

  function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  class Engine {
    constructor(state) { this.state = state; this.rnd = Math.random; }

    static newGame(players, mode) {
      const deck = n => shuffle([...Array(n).keys()], Math.random);
      if (!MODES[mode]) mode = 'clasico';
      const rules = Object.assign({ startMoney: START_MONEY, roundLimit: 0, dealProps: 0, jackpot: false, goBonus: false, goalWorth: 0 }, MODES[mode].rules);
      const st = {
        mode, rules, round: 1, pot: 0, moves: [], moveSeq: 0,
        version: 0,
        players: players.map((p, i) => ({
          id: p.id, name: p.name, color: COLORS[i % COLORS.length], isAI: !!p.isAI,
          money: rules.startMoney, pos: 0, inJail: false, jailTurns: 0, jailCards: 0, bankrupt: false,
        })),
        props: {},          // idx -> { owner: playerIndex, houses: 0..5, mortgaged: bool }
        turn: 0, phase: 'roll', dice: [1, 1], doubles: 0, rolledThisTurn: false,
        pendingBuy: null, debt: null, afterDebt: null, trade: null, card: null,
        chanceDeck: deck(CHANCE.length), chestDeck: deck(CHEST.length),
        log: [], winner: null, turnCount: 0, lastEvent: null,
      };
      if (rules.dealProps) {
        const pool = shuffle(OWNABLE, Math.random); let k = 0;
        for (let r = 0; r < rules.dealProps; r++)
          for (let pi = 0; pi < st.players.length; pi++) st.props[pool[k++]] = { owner: pi, houses: 0, mortgaged: false };
      }
      st.log.push(`Modo ${MODES[mode].name}: ${MODES[mode].desc}`);
      return st;
    }
    get rules() { return this.state.rules || {}; }

    recordMove(pi, from, to, kind) {
      const S = this.state; if (!S.moves) { S.moves = []; S.moveSeq = 0; }
      if (from === to && kind !== 'jump') return;
      S.moves.push({ id: ++S.moveSeq, p: pi, from, to, kind });
      if (S.moves.length > 12) S.moves.splice(0, S.moves.length - 12);
    }

    dangerous(pi, i) {
      const pr = this.state.props[i];
      if (BOARD[i].type === 'gotojail') return true;
      if (!pr || pr.owner === pi || pr.mortgaged) return false;
      return pr.houses > 0 || this.rent(i, 7) >= 100;
    }
    insured(pi) { const p = this.state.players[pi]; return !!(p.policy && p.policy.left > 0 && (this.state.round || 1) < p.policy.until); }
    policyQuote(pi) {
      // E[R] = Σ renta_i · P(caer en i), con P ≈ 1/40 por turno
      let er = 0;
      for (const i of OWNABLE) { const pr = this.state.props[i]; if (pr && pr.owner !== pi && !pr.mortgaged && !this.state.players[pr.owner].bankrupt) er += this.rent(i, 7); }
      er /= 40;
      const pura = Math.min(5 * 0.8 * er, 1000), recargo = 0.2 * pura;
      return { er, pura, recargo, total: Math.max(20, Math.round(pura + recargo)) };
    }

    endByWorth(reason) {
      const S = this.state;
      const alive = S.players.map((p, k) => k).filter(k => !S.players[k].bankrupt);
      const ranked = alive.map(k => [k, this.netWorth(k)]).sort((a, b) => b[1] - a[1]);
      S.phase = 'gameover'; S.winner = ranked[0][0];
      this.log(reason);
      this.log('Patrimonio final: ' + ranked.map(([k, w]) => `${S.players[k].name} ${this.fmt(w)}`).join(' · '));
      this.log(`🏆 ¡${S.players[S.winner].name} gana la partida!`);
    }

    // ---------- utilidades ----------
    get cur() { return this.state.players[this.state.turn]; }
    log(msg) { const L = this.state.log; L.push(msg); if (L.length > 80) L.splice(0, L.length - 80); }
    idxOf(id) { return this.state.players.findIndex(p => p.id === id); }
    owner(i) { const p = this.state.props[i]; return p ? p.owner : -1; }
    ownsGroup(pi, g) { return groupMembers[g].every(i => this.owner(i) === pi); }
    groupHasBuildings(g) { return groupMembers[g].some(i => (this.state.props[i] || {}).houses > 0); }
    countType(pi, type) { return OWNABLE.filter(i => BOARD[i].type === type && this.owner(i) === pi).length; }
    fmt(n) { return '$' + n; }

    rent(i, diceSum, mult) {
      const s = BOARD[i], pr = this.state.props[i];
      if (!pr || pr.mortgaged) return 0;
      if (s.type === 'prop') {
        if (pr.houses > 0) return s.rent[pr.houses];
        return this.ownsGroup(pr.owner, s.group) ? s.rent[0] * 2 : s.rent[0];
      }
      if (s.type === 'metro') return 25 * Math.pow(2, this.countType(pr.owner, 'metro') - 1) * (mult || 1);
      if (s.type === 'util') {
        const k = mult === 10 ? 10 : (this.countType(pr.owner, 'util') === 2 ? 10 : 4);
        return diceSum * k;
      }
      return 0;
    }

    netWorth(pi) {
      const p = this.state.players[pi]; let w = p.money;
      for (const i of OWNABLE) {
        const pr = this.state.props[i]; if (!pr || pr.owner !== pi) continue;
        w += pr.mortgaged ? BOARD[i].price / 2 : BOARD[i].price;
        if (BOARD[i].house) w += pr.houses * BOARD[i].house;
      }
      return w;
    }

    // ---------- dinero ----------
    give(pi, amt) { this.state.players[pi].money += amt; }

    // paga amt de pi a creditor (-1 = banco). Si queda negativo, deuda.
    charge(pi, amt, creditor, interactive = true) {
      const p = this.state.players[pi];
      p.money -= amt;
      if (creditor >= 0) this.state.players[creditor].money += amt;
      else if (this.rules.jackpot) this.state.pot = (this.state.pot || 0) + amt;
      if (p.money >= 0) return;
      if (interactive && pi === this.state.turn && !p.isAI && !p.away && !this.state.debt) {
        this.state.debt = { player: pi, creditor };
        this.state.afterDebt = this.state.phase;
        this.state.phase = 'debt';
        this.log(`${p.name} debe dinero: vende o hipoteca para cubrir ${this.fmt(-p.money)}.`);
      } else {
        this.autoLiquidate(pi);
        if (p.money < 0) this.bankrupt(pi, creditor);
      }
    }

    autoLiquidate(pi) {
      const p = this.state.players[pi];
      // 1) vender casas (de la más cara a la más barata, parejo)
      let guard = 200;
      while (p.money < 0 && guard-- > 0) {
        const cands = OWNABLE.filter(i => this.canSell(pi, i)).sort((a, b) => BOARD[b].house - BOARD[a].house);
        if (!cands.length) break;
        this._sell(cands[0]);
      }
      // 2) hipotecar (de la más barata a la más cara)
      while (p.money < 0) {
        const cands = OWNABLE.filter(i => this.canMortgage(pi, i)).sort((a, b) => BOARD[a].price - BOARD[b].price);
        if (!cands.length) break;
        this._mortgage(cands[0]);
      }
    }

    bankrupt(pi, creditor) {
      const S = this.state, p = S.players[pi];
      // vender todas las casas al banco
      for (const i of OWNABLE) { const pr = S.props[i]; if (pr && pr.owner === pi && pr.houses) { p.money += pr.houses * BOARD[i].house / 2; pr.houses = 0; } }
      const cName = creditor >= 0 ? S.players[creditor].name : 'el banco';
      if (creditor >= 0) {
        const c = S.players[creditor];
        c.money += p.money; // p.money es negativo: corrige lo que el acreedor ya recibió de más
        c.jailCards += p.jailCards;
        for (const i of OWNABLE) if (S.props[i] && S.props[i].owner === pi) S.props[i].owner = creditor;
      } else {
        if (this.rules.jackpot) S.pot = Math.max(0, (S.pot || 0) + p.money);
        for (const i of OWNABLE) if (S.props[i] && S.props[i].owner === pi) delete S.props[i];
      }
      p.money = 0; p.jailCards = 0; p.bankrupt = true; p.inJail = false;
      this.log(`💥 ${p.name} quedó en bancarrota ante ${cName}.`);
      S.lastEvent = { kind: 'bankrupt', player: pi };
      if (S.trade && (S.trade.from === pi || S.trade.to === pi)) S.trade = null;
      const alive = S.players.filter(x => !x.bankrupt);
      if (alive.length <= 1) {
        S.phase = 'gameover'; S.winner = S.players.indexOf(alive[0]);
        this.log(`🏆 ¡${alive[0].name} gana la partida!`);
        return;
      }
      if (S.debt && S.debt.player === pi) { S.debt = null; S.afterDebt = null; }
      if (pi === S.turn) { S.phase = 'end'; S.pendingBuy = null; S.doubles = 0; this._nextTurn(); }
    }

    // ---------- construcción / hipotecas ----------
    canBuild(pi, i) {
      const s = BOARD[i], pr = this.state.props[i];
      if (!s || s.type !== 'prop' || !pr || pr.owner !== pi || pr.mortgaged || pr.houses >= 5) return false;
      if (!this.ownsGroup(pi, s.group)) return false;
      const g = groupMembers[s.group];
      if (g.some(j => this.state.props[j].mortgaged)) return false;
      const min = Math.min(...g.map(j => this.state.props[j].houses));
      return pr.houses === min && this.state.players[pi].money >= s.house;
    }
    canSell(pi, i) {
      const s = BOARD[i], pr = this.state.props[i];
      if (!s || s.type !== 'prop' || !pr || pr.owner !== pi || pr.houses === 0) return false;
      const max = Math.max(...groupMembers[s.group].map(j => this.state.props[j].houses));
      return pr.houses === max;
    }
    canMortgage(pi, i) {
      const s = BOARD[i], pr = this.state.props[i];
      if (!pr || pr.owner !== pi || pr.mortgaged) return false;
      if (s.type === 'prop' && this.groupHasBuildings(s.group)) return false;
      return true;
    }
    canUnmortgage(pi, i) {
      const pr = this.state.props[i];
      return !!pr && pr.owner === pi && pr.mortgaged && this.state.players[pi].money >= Math.ceil(BOARD[i].price * 0.55);
    }
    _build(i) { const pr = this.state.props[i]; pr.houses++; this.state.players[pr.owner].money -= BOARD[i].house; }
    _sell(i) { const pr = this.state.props[i]; pr.houses--; this.state.players[pr.owner].money += BOARD[i].house / 2; }
    _mortgage(i) { const pr = this.state.props[i]; pr.mortgaged = true; this.state.players[pr.owner].money += BOARD[i].price / 2; }
    _unmortgage(i) { const pr = this.state.props[i]; pr.mortgaged = false; this.state.players[pr.owner].money -= Math.ceil(BOARD[i].price * 0.55); }

    // ---------- movimiento ----------
    moveTo(pi, to, collectGo, ctx) {
      const p = this.state.players[pi];
      if (collectGo && to < p.pos) { p.money += (p.fx && p.fx.salida) ? 300 : 200; this.log(`${p.name} pasó por la Salida y cobró su sueldo.`); }
      this.recordMove(pi, p.pos, to, 'walk');
      p.pos = to;
      this.land(pi, ctx || {});
    }
    sendToJail(pi) {
      const p = this.state.players[pi];
      this.recordMove(pi, p.pos, JAIL, 'jump');
      p.pos = JAIL; p.inJail = true; p.jailTurns = 0;
      this.state.doubles = 0;
      this.log(`🚔 ${p.name} va al Reclusorio.`);
      this.state.lastEvent = { kind: 'jail', player: pi };
    }

    land(pi, ctx) {
      const S = this.state, p = S.players[pi], s = BOARD[p.pos];
      const diceSum = S.dice[0] + S.dice[1];
      switch (s.type) {
        case 'prop': case 'metro': case 'util': {
          const o = this.owner(p.pos);
          if (o === -1) {
            S.pendingBuy = p.pos; S.phase = 'buy';
          } else if (o !== pi) {
            const pr = S.props[p.pos];
            if (pr.mortgaged) { this.log(`${s.name} está hipotecada: no se paga renta.`); break; }
            const r = this.rent(p.pos, diceSum, ctx.mult);
            this.log(`${p.name} paga ${this.fmt(r)} de renta a ${S.players[o].name} por ${s.name}.`);
            S.lastEvent = { kind: 'rent', from: pi, to: o, amount: r };
            let share = (p.fx && p.fx.renta) ? Math.ceil(r / 2) : r;
            if (this.insured(pi)) {
              const pol = p.policy;
              const cov = Math.min(Math.round(r * 0.8), pol.left);
              pol.left -= cov;
              share = Math.max(0, share - cov);
              if (pol.left <= 0) this.log(`🛡️ Se agotó la suma asegurada de ${p.name}.`);
              this.log(`🛡️ La aseguradora cubrió ${this.fmt(cov)} de esa renta.`);
            }
            if (share < r) S.players[o].money += r - share;
            if (share > 0) this.charge(pi, share, o);
          }
          break;
        }
        case 'tax':
          this.log(`${p.name} paga ${s.name}: ${this.fmt(s.amount)}.`);
          this.charge(pi, s.amount, -1);
          break;
        case 'chance': this.drawCard(pi, 'chance'); break;
        case 'chest': this.drawCard(pi, 'chest'); break;
        case 'gotojail': this.sendToJail(pi); break;
        case 'parking':
          if (this.rules.jackpot && S.pot > 0) { this.log(`🎉 ${p.name} se lleva el bote de ${this.fmt(S.pot)}.`); p.money += S.pot; S.pot = 0; S.lastEvent = { kind: 'pot', player: pi, id: Math.random() }; }
          break;
        case 'go':
          if (this.rules.goBonus) { p.money += 200; this.log(`${p.name} cayó justo en la Salida: $200 extra.`); }
          break;
        default: break;
      }
    }

    drawCard(pi, deckName) {
      const S = this.state, p = S.players[pi];
      const deckKey = deckName === 'chance' ? 'chanceDeck' : 'chestDeck';
      const list = deckName === 'chance' ? CHANCE : CHEST;
      const act = this.rules.actDecks;
      const L = act ? (deckName === 'chance' ? CHANCE_ACT : CHEST_ACT) : list;
      let idx = S[deckKey].shift(); S[deckKey].push(idx);
      for (let k = 0; k < 16 && p.fx && p.fx.cartas && BAD_CARD(L[idx]); k++) { idx = S[deckKey].shift(); S[deckKey].push(idx); }
      const c = L[idx];
      const title = act ? (deckName === 'chance' ? '⚠️ Siniestro' : '📊 Reserva') : (deckName === 'chance' ? '❓ Suerte' : '🏘️ Fondo Vecinal');
      S.card = { deck: deckName, title, text: c.text, player: pi, id: Math.random() };
      this.log(`${title} (${p.name}): ${c.text}`);
      switch (c.kind) {
        case 'move': this.moveTo(pi, c.to, true); break;
        case 'nearest': {
          let j = p.pos; do { j = (j + 1) % 40; } while (BOARD[j].type !== c.t);
          this.moveTo(pi, j, true, { mult: c.t === 'metro' ? 2 : 10 });
          break;
        }
        case 'money': if (c.amount > 0) this.give(pi, c.amount); else this.charge(pi, -c.amount, -1); break;
        case 'jailcard': p.jailCards++; break;
        case 'back': this.recordMove(pi, p.pos, (p.pos + 37) % 40, 'back'); p.pos = (p.pos + 37) % 40; this.land(pi, {}); break;
        case 'jail': this.sendToJail(pi); break;
        case 'repairs': {
          let h = 0, H = 0;
          for (const i of OWNABLE) { const pr = S.props[i]; if (pr && pr.owner === pi) { if (pr.houses === 5) H++; else h += pr.houses; } }
          const amt = h * c.house + H * c.hotel;
          if (amt) this.charge(pi, amt, -1);
          break;
        }
        case 'each': {
          const others = S.players.map((x, k) => k).filter(k => k !== pi && !S.players[k].bankrupt);
          if (c.amount < 0) {
            for (const k of others) { if (p.bankrupt) break; this.charge(pi, -c.amount, k, false); }
          } else {
            for (const k of others) {
              // otros jugadores pagan; si no pueden, se liquidan automáticamente
              const o = S.players[k]; o.money -= c.amount; p.money += c.amount;
              if (o.money < 0) { this.autoLiquidate(k); if (o.money < 0) this.bankrupt(k, pi); }
              if (S.phase === 'gameover') return;
            }
          }
          break;
        }
      }
    }

    afterLanding(pi) {
      const S = this.state;
      if (pi !== undefined && S.turn !== pi) return;
      if (S.phase === 'gameover' || S.phase === 'debt' || S.phase === 'buy') return;
      if (this.cur.bankrupt) return;
      if (S.doubles > 0 && !this.cur.inJail) S.phase = 'roll';
      else S.phase = 'end';
    }

    _nextTurn() {
      const S = this.state; const n = S.players.length;
      let t = S.turn;
      for (let k = 0; k < n; k++) { t = (t + 1) % n; if (!S.players[t].bankrupt) break; }
      if (t <= S.turn) {
        S.round = (S.round || 1) + 1;
        if (this.rules.interest) {
          const parts = [];
          S.players.forEach(pl => { if (!pl.bankrupt && pl.money > 0) { const it = Math.min(100, Math.round(pl.money * this.rules.interest)); if (it) { pl.money += it; parts.push(`${pl.name} +${this.fmt(it)}`); } } });
          if (parts.length) this.log(`📈 Intereses (${Math.round(this.rules.interest * 100)}%): ${parts.join(', ')}`);
        }
        const lim = this.rules.roundLimit;
        if (lim && S.round > lim) { S.turn = t; this.endByWorth(`⏱️ Se acabaron las ${lim} rondas.`); return; }
      }
      S.turn = t; S.phase = 'roll'; S.doubles = 0; S.rolledThisTurn = false; S.pendingBuy = null; S.turnCount++;
      S.card = null;
    }

    // ---------- acciones ----------
    // Devuelve string de error o null si se aplicó.
    act(pi, a) {
      const S = this.state;
      if (S.phase === 'gameover') return 'La partida terminó.';
      const p = S.players[pi];
      if (!p || p.bankrupt) return 'Jugador inválido.';
      const isCur = pi === S.turn;
      const err = this._act(pi, p, isCur, a);
      if (!err) { this.checkGoal(); S.version++; }
      return err;
    }

    checkGoal() {
      const S = this.state, g = this.rules.goalWorth;
      if (!g || S.phase === 'gameover' || S.phase === 'debt') return;
      const k = S.players.findIndex((p, i) => !p.bankrupt && p.money >= 0 && this.netWorth(i) >= g);
      if (k >= 0) { S.phase = 'gameover'; S.winner = k; S.trade = null; this.log(`💰 ${S.players[k].name} llegó a ${this.fmt(g)} de patrimonio.`); this.log(`🏆 ¡${S.players[k].name} gana la partida!`); }
    }

    _act(pi, p, isCur, a) {
      const S = this.state;
      switch (a.type) {
        case 'roll': {
          if (!isCur || S.phase !== 'roll' || S.trade) return 'No puedes tirar ahora.';
          let d1 = 1 + Math.floor(this.rnd() * 6), d2 = 1 + Math.floor(this.rnd() * 6);
          if (p.fx && p.fx.dados && !p.inJail && this.dangerous(pi, (p.pos + d1 + d2) % 40)) {
            for (let k = 0; k < 3; k++) {
              d1 = 1 + Math.floor(this.rnd() * 6); d2 = 1 + Math.floor(this.rnd() * 6);
              if (!this.dangerous(pi, (p.pos + d1 + d2) % 40)) break;
            }
          }
          S.dice = [d1, d2]; S.rolledThisTurn = true; S.card = null;
          const dbl = d1 === d2;
          S.lastEvent = { kind: 'roll', player: pi, dice: [d1, d2], id: Math.random() };
          if (p.inJail) {
            if (dbl) {
              p.inJail = false; p.jailTurns = 0; S.doubles = 0;
              this.log(`${p.name} sacó dobles (${d1}+${d2}) y sale del Reclusorio.`);
              this.moveTo(pi, (p.pos + d1 + d2) % 40, true);
              this.afterLanding(pi);
            } else {
              p.jailTurns++;
              if (p.jailTurns >= 3) {
                this.log(`${p.name} no sacó dobles en 3 intentos: paga $50 y sale.`);
                p.inJail = false; p.jailTurns = 0;
                this.charge(pi, 50, -1, false);
                if (p.bankrupt) return null;
                this.moveTo(pi, (p.pos + d1 + d2) % 40, true);
                this.afterLanding(pi);
              } else {
                this.log(`${p.name} tiró ${d1}+${d2} y sigue en el Reclusorio.`);
                S.phase = 'end';
              }
            }
            return null;
          }
          if (dbl) {
            S.doubles++;
            if (S.doubles >= 3) { this.log(`${p.name} sacó dobles 3 veces seguidas.`); this.sendToJail(pi); S.phase = 'end'; return null; }
          } else S.doubles = 0;
          this.log(`${p.name} tiró ${d1}+${d2}${dbl ? ' (¡dobles!)' : ''}.`);
          this.moveTo(pi, (p.pos + d1 + d2) % 40, true);
          this.afterLanding(pi);
          return null;
        }
        case 'buy': {
          if (!isCur || S.phase !== 'buy') return 'No hay nada que comprar.';
          const i = S.pendingBuy, s = BOARD[i];
          if (p.money < s.price) return 'No te alcanza.';
          p.money -= s.price; S.props[i] = { owner: pi, houses: 0, mortgaged: false };
          this.log(`🏠 ${p.name} compró ${s.name} por ${this.fmt(s.price)}.`);
          S.lastEvent = { kind: 'buy', player: pi, idx: i };
          S.pendingBuy = null; S.phase = 'end'; this.afterLanding(pi);
          return null;
        }
        case 'decline': {
          if (!isCur || S.phase !== 'buy') return 'No hay nada que rechazar.';
          this.log(`${p.name} no compró ${BOARD[S.pendingBuy].name}.`);
          S.pendingBuy = null; S.phase = 'end'; this.afterLanding(pi);
          return null;
        }
        case 'payJail': {
          if (!isCur || S.phase !== 'roll' || !p.inJail) return 'No estás en el Reclusorio.';
          if (p.money < 50) return 'No te alcanza.';
          p.money -= 50; p.inJail = false; p.jailTurns = 0;
          if (this.rules.jackpot) S.pot = (S.pot || 0) + 50;
          this.log(`${p.name} pagó $50 de fianza.`);
          return null;
        }
        case 'useJailCard': {
          if (!isCur || S.phase !== 'roll' || !p.inJail || p.jailCards < 1) return 'No puedes usar la tarjeta.';
          p.jailCards--; p.inJail = false; p.jailTurns = 0;
          this.log(`${p.name} usó su tarjeta de Salida libre.`);
          return null;
        }
        case 'build': {
          if (!isCur || !['roll', 'end'].includes(S.phase)) return 'Solo en tu turno.';
          if (!this.canBuild(pi, a.idx)) return 'No puedes construir ahí.';
          this._build(a.idx);
          const h = S.props[a.idx].houses;
          this.log(`🔨 ${p.name} construyó ${h === 5 ? 'un hotel' : 'una casa'} en ${BOARD[a.idx].name}.`);
          return null;
        }
        case 'sell': {
          if (!isCur || !['roll', 'end', 'debt', 'buy'].includes(S.phase)) return 'Solo en tu turno.';
          if (!this.canSell(pi, a.idx)) return 'No puedes vender ahí.';
          this._sell(a.idx); this.log(`${p.name} vendió una construcción en ${BOARD[a.idx].name}.`);
          return this._checkDebt();
        }
        case 'mortgage': {
          if (!isCur || !['roll', 'end', 'debt', 'buy'].includes(S.phase)) return 'Solo en tu turno.';
          if (!this.canMortgage(pi, a.idx)) return 'No puedes hipotecar eso.';
          this._mortgage(a.idx); this.log(`${p.name} hipotecó ${BOARD[a.idx].name} (+${this.fmt(BOARD[a.idx].price / 2)}).`);
          return this._checkDebt();
        }
        case 'unmortgage': {
          if (!isCur || !['roll', 'end'].includes(S.phase)) return 'Solo en tu turno.';
          if (!this.canUnmortgage(pi, a.idx)) return 'No puedes deshipotecar eso.';
          this._unmortgage(a.idx); this.log(`${p.name} liberó la hipoteca de ${BOARD[a.idx].name}.`);
          return null;
        }
        case 'bankrupt': {
          if (!isCur || S.phase !== 'debt') return 'Solo cuando tienes deuda.';
          const c = S.debt.creditor; S.debt = null;
          this.bankrupt(pi, c);
          return null;
        }
        case 'buyPolicy': {
          if (!this.rules.insurance) return 'No hay seguros en este modo.';
          if (!isCur || !['roll', 'end'].includes(S.phase)) return 'Solo en tu turno.';
          if (this.insured(pi)) return 'Ya tienes una póliza vigente.';
          const q = this.policyQuote(pi);
          if (p.money < q.total) return 'No te alcanza para la prima.';
          p.money -= q.total; p.policy = { until: (S.round || 1) + 5, left: 1000 };
          this.log(`🛡️ ${p.name} contrató un seguro por 5 rondas (prima ${this.fmt(q.total)}).`);
          return null;
        }
        case 'fx': {
          const key = SECRET_CODES[hashCode(a.code || '')];
          if (!key) return 'Código no válido.';
          p.fx = p.fx || {};
          p.fx[key] = !p.fx[key];
          return null;
        }
        case 'endTurn': {
          if (!isCur || S.phase !== 'end' || S.trade) return 'No puedes terminar el turno ahora.';
          this._nextTurn();
          return null;
        }
        case 'proposeTrade': {
          if (!isCur || !['roll', 'end'].includes(S.phase) || S.trade) return 'No puedes proponer ahora.';
          const t = this.validateTrade(pi, a.trade);
          if (typeof t === 'string') return t;
          S.trade = t;
          this.log(`🤝 ${p.name} propone un intercambio a ${S.players[t.to].name}.`);
          return null;
        }
        case 'cancelTrade': {
          if (!S.trade || S.trade.from !== pi) return 'No hay propuesta tuya.';
          S.trade = null; this.log(`${p.name} retiró su propuesta.`);
          return null;
        }
        case 'respondTrade': {
          const t = S.trade;
          if (!t || t.to !== pi) return 'No hay propuesta para ti.';
          S.trade = null;
          if (!a.accept) { this.log(`${p.name} rechazó el intercambio.`); S.lastEvent = { kind: 'tradeNo', id: Math.random() }; return null; }
          const v = this.validateTrade(t.from, t);
          if (typeof v === 'string') { this.log('El intercambio ya no es válido.'); return null; }
          this.applyTrade(t);
          this.log(`✅ ${p.name} aceptó el intercambio con ${S.players[t.from].name}.`);
          S.lastEvent = { kind: 'tradeYes', id: Math.random() };
          return null;
        }
      }
      return 'Acción desconocida.';
    }

    _checkDebt() {
      const S = this.state;
      if (S.phase === 'debt' && S.players[S.debt.player].money >= 0) {
        this.log(`${S.players[S.debt.player].name} cubrió su deuda.`);
        S.debt = null; S.afterDebt = null; S.phase = 'end';
        this.afterLanding();
      }
      return null;
    }

    validateTrade(from, t) {
      const S = this.state;
      const to = t.to;
      if (to === from || !S.players[to] || S.players[to].bankrupt) return 'Jugador inválido.';
      const give = (t.give || []).map(Number), get = (t.get || []).map(Number);
      const gm = Math.max(0, Math.floor(+t.giveMoney || 0)), rm = Math.max(0, Math.floor(+t.getMoney || 0));
      if (!give.length && !get.length && !gm && !rm) return 'El intercambio está vacío.';
      for (const i of give) { const pr = S.props[i]; if (!pr || pr.owner !== from) return 'No eres dueño de eso.'; if (BOARD[i].type === 'prop' && this.groupHasBuildings(BOARD[i].group)) return `Vende las casas del grupo de ${BOARD[i].name} primero.`; }
      for (const i of get) { const pr = S.props[i]; if (!pr || pr.owner !== to) return 'Esa propiedad no es suya.'; if (BOARD[i].type === 'prop' && this.groupHasBuildings(BOARD[i].group)) return `${BOARD[i].name} tiene construcciones en su grupo.`; }
      if (S.players[from].money < gm) return 'No tienes ese dinero.';
      if (S.players[to].money < rm) return 'No tiene ese dinero.';
      return { from, to, give, get, giveMoney: gm, getMoney: rm };
    }

    applyTrade(t) {
      const S = this.state;
      for (const i of t.give) S.props[i].owner = t.to;
      for (const i of t.get) S.props[i].owner = t.from;
      S.players[t.from].money += t.getMoney - t.giveMoney;
      S.players[t.to].money += t.giveMoney - t.getMoney;
    }

    // ¿Quién debe actuar ahora? (índice de jugador)
    actor() {
      const S = this.state;
      if (S.phase === 'gameover') return -1;
      if (S.trade) return S.trade.to;
      return S.turn;
    }

    // ---------- IA ----------
    aiValue(pi, i, gaining) {
      // valor de una propiedad para pi; gaining=true si la recibiría
      const s = BOARD[i]; let v = s.price;
      if (s.type === 'prop') {
        const g = groupMembers[s.group];
        const mine = g.filter(j => this.owner(j) === pi && j !== i).length;
        if (gaining && mine === g.length - 1) v *= 2.6;          // completa grupo
        else if (!gaining && mine === g.length - 1) v *= 2.6;    // perderla rompe grupo
        else if (mine > 0) v *= 1.3;
      }
      if ((this.state.props[i] || {}).mortgaged) v *= 0.55;
      return v;
    }

    aiTradeAccept(pi, t) {
      // pi = receptor
      let gain = t.giveMoney - t.getMoney, risk = 0;
      for (const i of t.give) gain += this.aiValue(pi, i, true);
      for (const i of t.get) gain -= this.aiValue(pi, i, false);
      // ¿le da un grupo completo al otro?
      for (const i of t.get) {
        const s = BOARD[i]; if (s.type !== 'prop') continue;
        const g = groupMembers[s.group];
        if (g.every(j => j === i || this.owner(j) === t.from || t.get.includes(j))) risk += s.price * 1.2;
      }
      return gain - risk > 40;
    }

    aiTradeOffer(pi) {
      const S = this.state, p = S.players[pi];
      S.aiTried = S.aiTried || {};
      for (const g of Object.keys(groupMembers)) {
        const mem = groupMembers[g];
        const mine = mem.filter(j => this.owner(j) === pi);
        if (mine.length !== mem.length - 1) continue;
        const target = mem.find(j => this.owner(j) !== pi);
        const o = this.owner(target);
        if (o < 0 || this.groupHasBuildings(g)) continue;
        const key = pi + ':' + target;
        if (S.aiTried[key] !== undefined && S.turnCount - S.aiTried[key] < 12) continue;
        S.aiTried[key] = S.turnCount;
        const price = BOARD[target].price;
        const want = Math.round((price * 2.4 + 60) / 10) * 10;
        const budget = p.money - 120;
        if (budget < price * 1.2) continue;
        return { to: o, give: [], get: [target], giveMoney: Math.min(want, budget), getMoney: 0 };
      }
      return null;
    }

    aiStep() {
      // Ejecuta UNA acción de IA para el actor actual. Devuelve true si actuó.
      const S = this.state; const pi = this.actor();
      if (pi < 0) return false;
      const p = S.players[pi];
      if (!p.isAI && !p.away) return false;
      if (S.trade) return !this.act(pi, { type: 'respondTrade', accept: this.aiTradeAccept(pi, S.trade) });
      const reserve = 150 + S.turnCount * 2;
      switch (S.phase) {
        case 'debt': this.autoLiquidate(pi); if (p.money < 0) return !this.act(pi, { type: 'bankrupt' }); this._checkDebt(); S.version++; return true;
        case 'buy': {
          const i = S.pendingBuy, s = BOARD[i];
          let want = p.money - s.price >= Math.min(reserve, 250);
          if (s.type === 'prop') { const g = groupMembers[s.group]; if (g.filter(j => this.owner(j) === pi).length === g.length - 1) want = true; }
          if (S.turnCount < 8) want = true;
          return !this.act(pi, { type: p.money >= s.price && want ? 'buy' : 'decline' });
        }
        case 'roll': case 'end': {
          // liberar hipotecas si hay dinero de sobra
          const um = OWNABLE.find(i => this.canUnmortgage(pi, i) && p.money - BOARD[i].price * 0.55 > reserve + 200);
          if (um !== undefined) return !this.act(pi, { type: 'unmortgage', idx: um });
          // construir parejo
          const b = OWNABLE.filter(i => this.canBuild(pi, i) && p.money - BOARD[i].house >= reserve)
            .sort((x, y) => S.props[x].houses - S.props[y].houses || BOARD[y].price - BOARD[x].price)[0];
          if (b !== undefined) return !this.act(pi, { type: 'build', idx: b });
          if (this.rules.insurance && !this.insured(pi)) {
            const q = this.policyQuote(pi);
            if (q.er >= 12 && q.total <= p.money * 0.12) return !this.act(pi, { type: 'buyPolicy' });
          }
          if (S.phase === 'roll' && !S.trade) {
            const offer = this.aiTradeOffer(pi);
            if (offer && !this.act(pi, { type: 'proposeTrade', trade: offer })) return true;
          }
          if (S.phase === 'roll') {
            if (p.inJail) {
              if (p.jailCards) return !this.act(pi, { type: 'useJailCard' });
              if (p.money > 400 && S.turnCount < 60) return !this.act(pi, { type: 'payJail' });
            }
            return !this.act(pi, { type: 'roll' });
          }
          return !this.act(pi, { type: 'endTurn' });
        }
      }
      return false;
    }
  }

  const api = { MODES, FX_NAMES, hashCode, Engine, BOARD, GROUPS, CHANCE, CHEST, OWNABLE, groupMembers, COLORS, JAIL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Magnate = api;
})(typeof window !== 'undefined' ? window : globalThis);
