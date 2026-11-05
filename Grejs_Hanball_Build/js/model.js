// Datamodel og beregninger. Ingen DOM her, så filen også kan testes i Node (tests/run-tests.js).
//
// Et system består af:
//   players   Spillerne med deres STARTposition (x, y i meter; banen er 40 x 20 m, målet angribes mod x = 40).
//   ball      Boldens startplacering (fri placering eller hos en spiller).
//   steps     Trin. Hvert trin har pile (lines). En løbepil flytter spilleren, en afleverings- eller skudpil
//             flytter bolden. Positioner gemmes ikke pr. trin: de beregnes af compile(), så en ændring i et
//             tidligt trin automatisk slår igennem i resten af sekvensen, og ingen kan "teleportere".
(function (root) {
  'use strict';

  const COURT = { width: 40, height: 20, goalWidth: 3, goalDepth: 1 };
  const FORMAT = 'grejs-handball-build';
  const FORMAT_VERSION = 1;

  const LINE_TYPES = {
    run: { label: 'Løbebane', color: '#34d399', width: 3, dash: [] },
    pass: { label: 'Aflevering', color: '#facc15', width: 3, dash: [10, 7] },
    shot: { label: 'Skud', color: '#f87171', width: 4.5, dash: [] },
    defense: { label: 'Forsvarsbevægelse', color: '#fb923c', width: 3, dash: [3, 6] },
    free: { label: 'Fri tegning', color: '#ffffff', width: 3, dash: [] },
  };

  const DEFAULT_COLORS = { attack: '#2563eb', defense: '#dc2626', gk: '#16a34a' };
  const DEFAULT_CATEGORIES = ['Angreb', 'Forsvar', 'Overgang', 'Kontra', 'Andet'];

  const LIMITS = {
    players: 60, steps: 200, linesPerStep: 80, pointsPerStroke: 1500,
    name: 120, description: 4000, note: 1000, label: 6, playerName: 40, number: 4, category: 40,
    minDuration: 0.2, maxDuration: 30, maxDelay: 30, minTime: 0.1,
  };

  const BALL_OFFSET = { x: 0.55, y: -0.55 };
  const PASS_TIME = 0.7;
  const SHOT_TIME = 0.45;

  let idCounter = 0;
  function uid(prefix) {
    idCounter += 1;
    return (prefix || 'id') + '_' + Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' ? String(v).slice(0, max) : '');
  const isColor = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const round2 = (v) => Math.round(v * 100) / 100;
  const pt = (p) => ({ x: round2(p.x), y: round2(p.y) });

  // Spillere og pile må ligge i det grønne område omkring banen, men ikke længere ude.
  const WORLD = { minX: -2.6, maxX: 42.6, minY: -1.5, maxY: 21.5 };
  function clampToWorld(p) {
    return { x: clamp(num(p.x, 20), WORLD.minX, WORLD.maxX), y: clamp(num(p.y, 10), WORLD.minY, WORLD.maxY) };
  }

  function createStep(partial) {
    return Object.assign({ id: uid('s'), note: '', duration: 1.5, lines: [] }, partial || {});
  }

  function createSystem(partial) {
    const now = Date.now();
    return Object.assign({
      id: uid('sys'),
      name: 'Nyt system',
      named: false,
      description: '',
      category: 'Angreb',
      createdAt: now,
      updatedAt: now,
      court: 'half',
      labelMode: 'label',
      colors: Object.assign({}, DEFAULT_COLORS),
      players: [],
      ball: { onCourt: false, x: 28, y: 10, holder: null },
      steps: [createStep()],
    }, partial || {});
  }

  function createPlayer(team, label, x, y, extra) {
    return Object.assign({
      id: uid('p'), team, label: str(label, LIMITS.label), name: '', number: '', color: null, x: round2(x), y: round2(y),
    }, extra || {});
  }

  function createLine(type, partial) {
    const def = LINE_TYPES[type];
    const base = { id: uid('l'), type, color: def.color, width: def.width };
    if (type === 'free') Object.assign(base, { points: [], arrow: false, allSteps: false });
    else Object.assign(base, { to: { x: 0, y: 0 }, bend: 0, delay: 0, time: null });
    if (type === 'run' || type === 'defense') base.player = null;
    if (type === 'pass' || type === 'shot') {
      base.toPlayer = null;
      base.time = type === 'pass' ? PASS_TIME : SHOT_TIME;
    }
    return Object.assign(base, partial || {});
  }

  const isMove = (line) => line.type === 'run' || line.type === 'defense';
  const isBallLine = (line) => line.type === 'pass' || line.type === 'shot';

  // ---------- Geometri ----------

  // Bue: bend er afstanden (meter) fra korden til buens midte. Gemmes relativt, så buen bevarer sin form,
  // også når spillerens startpunkt flyttes.
  function curveControl(from, to, bend) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    return { x: mx + nx * 2 * (bend || 0), y: my + ny * 2 * (bend || 0) };
  }

  function curveMid(from, to, bend) {
    return quad(from, curveControl(from, to, bend), to, 0.5);
  }

  function bendFromPoint(from, to, p) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    return (p.x - (from.x + to.x) / 2) * nx + (p.y - (from.y + to.y) / 2) * ny;
  }

  function quad(a, c, b, t) {
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    };
  }

  function sampleCurve(from, ctrl, to, n) {
    const out = [];
    const count = n || 28;
    for (let i = 0; i <= count; i += 1) out.push(quad(from, ctrl, to, i / count));
    return out;
  }

  function distToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function distToPolyline(p, points) {
    let best = Infinity;
    for (let i = 0; i < points.length - 1; i += 1) best = Math.min(best, distToSegment(p, points[i], points[i + 1]));
    return best;
  }

  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - (1 - t) * (1 - t);

  // ---------- Beregning af sekvensen ----------

  function attach(p) { return { x: p.x + BALL_OFFSET.x, y: p.y + BALL_OFFSET.y }; }

  function playerAt(stepInfo, pid, t) {
    const start = stepInfo.start[pid];
    const m = stepInfo.moves[pid];
    if (!m) return start;
    const p = clamp((t - m.delay) / m.time, 0, 1);
    if (p === 0) return m.from;
    if (p === 1) return m.to;
    return quad(m.from, m.ctrl, m.to, easeInOut(p));
  }

  function compile(doc) {
    const out = [];
    const pos = {};
    doc.players.forEach((p) => { pos[p.id] = { x: p.x, y: p.y }; });
    const exists = (pid) => Object.prototype.hasOwnProperty.call(pos, pid);
    let ball = { x: doc.ball.x, y: doc.ball.y, holder: doc.ball.holder && exists(doc.ball.holder) ? doc.ball.holder : null };

    doc.steps.forEach((step) => {
      const info = {
        id: step.id, start: Object.assign({}, pos), end: null, moves: {}, ballStart: Object.assign({}, ball),
        ballEvents: [], ballEnd: null, length: step.duration, movesByLine: {},
      };
      // Løb først, så afleveringer kan sigte efter en modtager, der er i bevægelse.
      step.lines.forEach((line) => {
        if (!isMove(line) || !exists(line.player) || info.moves[line.player]) return;
        const from = pos[line.player];
        const to = line.to;
        const m = {
          line, from, to, ctrl: curveControl(from, to, line.bend),
          delay: line.delay || 0,
          time: Math.max(LIMITS.minTime, line.time == null ? step.duration : line.time),
        };
        info.moves[line.player] = m;
        info.movesByLine[line.id] = m;
        info.length = Math.max(info.length, m.delay + m.time);
      });
      info.end = Object.assign({}, info.start);
      Object.keys(info.moves).forEach((pid) => { info.end[pid] = info.moves[pid].to; });

      // Boldens vej gennem trinnet. Hændelserne ligger i rækkefølge og overlapper aldrig.
      let cur = Object.assign({}, ball);
      let clock = 0;
      const ballLines = step.lines.filter((l) => isBallLine(l))
        .map((line, order) => ({ line, order }))
        .sort((a, b) => ((a.line.delay || 0) - (b.line.delay || 0)) || (a.order - b.order));
      ballLines.forEach(({ line }) => {
        if (!doc.ball.onCourt) return;
        const delay = Math.max(line.delay || 0, clock);
        const time = Math.max(LIMITS.minTime, line.time == null ? PASS_TIME : line.time);
        const from = cur.holder ? attach(playerAt(info, cur.holder, delay)) : { x: cur.x, y: cur.y };
        const targetOk = line.type === 'pass' && line.toPlayer && exists(line.toPlayer);
        const to = targetOk ? attach(playerAt(info, line.toPlayer, delay + time)) : line.to;
        const ev = { line, from, to, ctrl: curveControl(from, to, line.bend), delay, time, toPlayer: targetOk ? line.toPlayer : null, before: cur };
        info.ballEvents.push(ev);
        clock = delay + time;
        cur = targetOk ? { x: to.x, y: to.y, holder: line.toPlayer } : { x: to.x, y: to.y, holder: null };
        info.length = Math.max(info.length, clock);
      });
      info.ballEnd = cur;
      if (cur.holder) {
        const a = attach(info.end[cur.holder]);
        info.ballEnd = { x: a.x, y: a.y, holder: cur.holder };
      }

      out.push(info);
      Object.keys(info.moves).forEach((pid) => { pos[pid] = info.moves[pid].to; });
      ball = info.ballEnd;
    });
    return out;
  }

  function ballAt(info, t) {
    const atRest = (state, time) => (state.holder ? attach(playerAt(info, state.holder, time)) : { x: state.x, y: state.y });
    let state = info.ballStart;
    for (let i = 0; i < info.ballEvents.length; i += 1) {
      const ev = info.ballEvents[i];
      if (t < ev.delay) return { pos: atRest(state, t), holder: state.holder, flying: 0 };
      if (t < ev.delay + ev.time) {
        const p = (t - ev.delay) / ev.time;
        return { pos: quad(ev.from, ev.ctrl, ev.to, ev.line.type === 'shot' ? p : easeOut(p)), holder: null, flying: p };
      }
      state = ev.toPlayer ? { holder: ev.toPlayer } : { x: ev.to.x, y: ev.to.y, holder: null };
    }
    return { pos: atRest(state, t), holder: state.holder, flying: 0 };
  }

  // Tilstanden på et bestemt tidspunkt: trin + sekunder inde i trinnet.
  function poseAt(doc, compiled, stepIndex, t) {
    const info = compiled[clamp(stepIndex, 0, compiled.length - 1)];
    const players = {};
    doc.players.forEach((p) => { players[p.id] = playerAt(info, p.id, t) || { x: p.x, y: p.y }; });
    const ball = ballAt(info, t);
    return { players, ball };
  }

  function totalLength(compiled) {
    return compiled.reduce((sum, s) => sum + s.length, 0);
  }

  // Omregner mellem samlet tid (tidslinjens skyder) og trin + tid i trinnet.
  function locate(compiled, seconds) {
    let left = seconds;
    for (let i = 0; i < compiled.length; i += 1) {
      if (left < compiled[i].length) return { step: i, t: left };
      left -= compiled[i].length;
    }
    return { step: compiled.length - 1, t: compiled[compiled.length - 1].length };
  }

  function elapsedTo(compiled, step, t) {
    let sum = t;
    for (let i = 0; i < step; i += 1) sum += compiled[i].length;
    return sum;
  }

  // ---------- Ændringer, der skal holde data konsistent ----------

  function removePlayer(doc, pid) {
    const player = doc.players.find((p) => p.id === pid);
    if (!player) return;
    // Bolden skal blive liggende dér, hvor den er, når dens spiller forsvinder.
    if (doc.ball.holder === pid) {
      const a = attach(player);
      doc.ball.x = a.x;
      doc.ball.y = a.y;
      doc.ball.holder = null;
    }
    doc.players = doc.players.filter((p) => p.id !== pid);
    doc.steps.forEach((step) => {
      step.lines = step.lines.filter((l) => !(isMove(l) && l.player === pid));
      step.lines.forEach((l) => { if (l.toPlayer === pid) l.toPlayer = null; });
    });
  }

  function duplicateSystem(doc, name) {
    const copy = normalizeSystem(JSON.parse(JSON.stringify(doc)));
    copy.id = uid('sys');
    copy.name = name || (doc.name + ' (kopi)').slice(0, LIMITS.name);
    copy.createdAt = Date.now();
    copy.updatedAt = copy.createdAt;
    return copy;
  }

  // ---------- Kontrol af data udefra (import og LocalStorage) ----------
  // Alt coerces til forventede typer. Tekst vises kun via textContent/canvas, men længder og farver begrænses her.

  function normalizeLine(raw, playerIds) {
    if (!raw || typeof raw !== 'object' || !LINE_TYPES[raw.type]) return null;
    const type = raw.type;
    const line = createLine(type, { id: typeof raw.id === 'string' ? raw.id.slice(0, 60) : uid('l') });
    if (isColor(raw.color)) line.color = raw.color;
    line.width = clamp(num(raw.width, line.width), 1, 12);
    if (type === 'free') {
      const pts = Array.isArray(raw.points) ? raw.points.slice(0, LIMITS.pointsPerStroke) : [];
      line.points = pts.filter((p) => p && typeof p === 'object').map((p) => pt(clampToWorld(p)));
      if (line.points.length < 2) return null;
      line.arrow = !!raw.arrow;
      line.allSteps = !!raw.allSteps;
      return line;
    }
    line.to = pt(clampToWorld(raw.to || {}));
    line.bend = clamp(num(raw.bend, 0), -30, 30);
    line.delay = clamp(num(raw.delay, 0), 0, LIMITS.maxDelay);
    if (raw.time == null && isMove(line)) line.time = null;
    else line.time = clamp(num(raw.time, line.time == null ? PASS_TIME : line.time), LIMITS.minTime, LIMITS.maxDuration);
    if (isMove(line)) {
      if (!playerIds.has(raw.player)) return null;
      line.player = raw.player;
    } else {
      line.toPlayer = type === 'pass' && playerIds.has(raw.toPlayer) ? raw.toPlayer : null;
    }
    return line;
  }

  function normalizeSystem(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Filen indeholder ikke et system.');
    const doc = createSystem();
    if (typeof raw.id === 'string' && raw.id) doc.id = raw.id.slice(0, 60);
    doc.name = str(raw.name, LIMITS.name).trim() || 'Uden navn';
    doc.named = raw.named !== false;
    doc.description = str(raw.description, LIMITS.description);
    doc.category = str(raw.category, LIMITS.category).trim() || 'Andet';
    doc.createdAt = num(raw.createdAt, doc.createdAt);
    doc.updatedAt = num(raw.updatedAt, doc.updatedAt);
    doc.court = raw.court === 'full' ? 'full' : 'half';
    doc.labelMode = ['label', 'number', 'both'].includes(raw.labelMode) ? raw.labelMode : 'label';
    const colors = raw.colors && typeof raw.colors === 'object' ? raw.colors : {};
    Object.keys(DEFAULT_COLORS).forEach((k) => { doc.colors[k] = isColor(colors[k]) ? colors[k] : DEFAULT_COLORS[k]; });

    const seen = new Set();
    doc.players = (Array.isArray(raw.players) ? raw.players : []).slice(0, LIMITS.players)
      .filter((p) => p && typeof p === 'object')
      .map((p) => {
        const pos = clampToWorld(p);
        const player = createPlayer(['attack', 'defense', 'gk'].includes(p.team) ? p.team : 'attack', p.label, pos.x, pos.y);
        if (typeof p.id === 'string' && p.id && !seen.has(p.id)) player.id = p.id.slice(0, 60);
        seen.add(player.id);
        player.name = str(p.name, LIMITS.playerName);
        player.number = str(p.number, LIMITS.number);
        player.color = isColor(p.color) ? p.color : null;
        return player;
      });
    const ids = new Set(doc.players.map((p) => p.id));

    const ball = raw.ball && typeof raw.ball === 'object' ? raw.ball : {};
    const bp = clampToWorld(ball);
    doc.ball = { onCourt: !!ball.onCourt, x: bp.x, y: bp.y, holder: ids.has(ball.holder) ? ball.holder : null };

    const steps = (Array.isArray(raw.steps) ? raw.steps : []).slice(0, LIMITS.steps)
      .filter((s) => s && typeof s === 'object')
      .map((s) => {
        const step = createStep();
        if (typeof s.id === 'string' && s.id) step.id = s.id.slice(0, 60);
        step.note = str(s.note, LIMITS.note);
        step.duration = clamp(num(s.duration, 1.5), LIMITS.minDuration, LIMITS.maxDuration);
        const taken = new Set();
        step.lines = (Array.isArray(s.lines) ? s.lines : []).slice(0, LIMITS.linesPerStep)
          .map((l) => normalizeLine(l, ids))
          .filter((l) => {
            if (!l) return false;
            // Højst én bevægelse pr. spiller pr. trin.
            if (isMove(l)) { if (taken.has(l.player)) return false; taken.add(l.player); }
            return true;
          });
        return step;
      });
    doc.steps = steps.length ? steps : [createStep()];
    return doc;
  }

  const api = {
    COURT, FORMAT, FORMAT_VERSION, LINE_TYPES, DEFAULT_COLORS, DEFAULT_CATEGORIES, LIMITS, WORLD, BALL_OFFSET,
    uid, clamp, num, isColor, dist, round2, pt, clampToWorld,
    createStep, createSystem, createPlayer, createLine, isMove, isBallLine,
    curveControl, curveMid, bendFromPoint, quad, sampleCurve, distToPolyline, attach,
    compile, playerAt, ballAt, poseAt, totalLength, locate, elapsedTo,
    removePlayer, duplicateSystem, normalizeSystem,
  };
  root.GHB = Object.assign(root.GHB || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
