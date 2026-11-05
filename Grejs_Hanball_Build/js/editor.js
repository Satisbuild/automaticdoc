// Al interaktion på selve banen: vælg, flyt, tegn pile, zoom. Virker med mus, pen og touch via pointer-events.
(function (root) {
  'use strict';
  const G = root.GHB;
  const App = G.App;
  const DRAG_PX = 5;
  const MIN_LINE = 0.5; // meter

  const Editor = {};
  const pointers = new Map();
  let gesture = null;
  let pinch = null;
  let shownDragHint = false;

  const worldOf = (s) => App.view.toWorld(s);
  const screenOf = (e) => {
    const r = App.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const tolerance = (e, base) => base + (e.pointerType === 'touch' ? 8 : 0);
  const clampInView = (p) => App.view.clamp(G.clampToWorld(p));

  // ---------- Træfprøver (i skærmkoordinater) ----------

  function pose() { return G.poseAt(App.doc, App.compiled(), App.stepIndex, App.t); }
  function info() { return App.compiled()[App.stepIndex]; }

  function hitPlayer(s, e, excludeId) {
    const view = App.view;
    const r = view.playerRadius + tolerance(e, 2);
    const positions = pose().players;
    let best = null;
    let bestD = Infinity;
    App.doc.players.forEach((p) => {
      if (p.id === excludeId) return;
      const w = positions[p.id];
      if (!view.contains(w)) return;
      const q = view.toScreen(w);
      const d = Math.hypot(q.x - s.x, q.y - s.y);
      if (d <= r && d < bestD) { best = p; bestD = d; }
    });
    return best;
  }

  // Modtager af en aflevering: spilleren selv eller skyggen, hvis spilleren er på vej et andet sted hen.
  function hitReceiver(s, e) {
    const direct = hitPlayer(s, e);
    if (direct) return direct;
    const ghost = hitGhost(s, e);
    return ghost ? App.player(ghost.playerId) : null;
  }

  function hitGhost(s, e) {
    const view = App.view;
    const r = view.playerRadius + tolerance(e, 2);
    const moves = info().moves;
    const ids = Object.keys(moves);
    for (let i = 0; i < ids.length; i += 1) {
      const q = view.toScreen(moves[ids[i]].to);
      if (Math.hypot(q.x - s.x, q.y - s.y) <= r) return { playerId: ids[i], line: moves[ids[i]].line };
    }
    return null;
  }

  function hitBall(s, e) {
    if (!App.doc.ball.onCourt) return false;
    const q = App.view.toScreen(pose().ball.pos);
    return Math.hypot(q.x - s.x, q.y - s.y) <= App.view.ballRadius + tolerance(e, 3);
  }

  function selectedLineGeometry() {
    if (!App.selection || App.selection.kind !== 'line') return null;
    const line = App.currentStep().lines.find((l) => l.id === App.selection.id);
    if (!line || line.type === 'free') return null;
    const path = G.linePath(line, info());
    return path ? { line, path } : null;
  }

  function hitHandle(s, e) {
    const sel = selectedLineGeometry();
    if (!sel) return null;
    const r = tolerance(e, 11);
    const end = App.view.toScreen(sel.path.to);
    if (Math.hypot(end.x - s.x, end.y - s.y) <= r) return { kind: 'end', line: sel.line };
    const mid = App.view.toScreen(G.curveMid(sel.path.from, sel.path.to, sel.line.bend));
    if (Math.hypot(mid.x - s.x, mid.y - s.y) <= r) return { kind: 'bend', line: sel.line };
    return null;
  }

  function hitLine(s, e) {
    const view = App.view;
    const tol = tolerance(e, 8);
    const c = info();
    const check = (line) => {
      const path = G.linePath(line, c);
      if (!path) return false;
      return G.distToPolyline(s, path.points.map(view.toScreen)) <= tol + line.width;
    };
    const own = App.currentStep().lines.slice().reverse().find(check);
    if (own) return own;
    for (let i = 0; i < App.doc.steps.length; i += 1) {
      if (i === App.stepIndex) continue;
      const hit = App.doc.steps[i].lines.find((l) => l.type === 'free' && l.allSteps && check(l));
      if (hit) return hit;
    }
    return null;
  }

  // ---------- Oprettelse af pile ----------

  function moveLineOf(pid) {
    return App.currentStep().lines.find((l) => G.isMove(l) && l.player === pid) || null;
  }

  function setMove(player, to, type, bend) {
    App.mutate(() => {
      const step = App.currentStep();
      const existing = moveLineOf(player.id);
      if (existing) step.lines = step.lines.filter((l) => l !== existing);
      const line = G.createLine(type, { player: player.id, to: G.pt(to), bend: bend || 0 });
      step.lines.push(line);
      App.selection = { kind: 'line', id: line.id };
    });
  }

  // Bolden kan kun afleveres af den, der har den. I første trin giver vi bolden til spilleren, man tegner fra.
  function ballLineOrigin(player) {
    const c = info();
    if (!App.doc.ball.onCourt) {
      if (!player) return { error: 'Sæt først bolden på banen.' };
      App.pushUndo();
      App.doc.ball = { onCourt: true, x: player.x, y: player.y, holder: player.id };
      App.softChange();
      return { from: G.attach(App.compiled()[App.stepIndex].start[player.id]) };
    }
    if (!player || c.ballEnd.holder === player.id) return { from: { x: c.ballEnd.x, y: c.ballEnd.y } };
    if (App.stepIndex === 0 && !App.currentStep().lines.some(G.isBallLine)) {
      App.pushUndo();
      App.doc.ball.holder = player.id;
      App.softChange();
      return { from: G.attach(App.compiled()[0].start[player.id]) };
    }
    const holder = App.player(c.ballEnd.holder);
    return { error: holder ? 'Det er ' + holder.label + ', der har bolden i dette trin.' : 'Bolden ligger frit i dette trin – start pilen fra bolden.' };
  }

  function addBallLine(type, world, targetId) {
    App.mutate(() => {
      const props = { to: G.pt(world) };
      if (type === 'pass' && targetId) props.toPlayer = targetId;
      const line = G.createLine(type, props);
      App.currentStep().lines.push(line);
      App.selection = { kind: 'line', id: line.id };
    });
  }

  function typeForPlayer(player) {
    return player.team === 'defense' ? 'defense' : 'run';
  }

  // ---------- Pointer ned ----------

  function onDown(e) {
    if (!App.view) return;
    App.canvas.setPointerCapture(e.pointerId);
    const s = screenOf(e);
    pointers.set(e.pointerId, s);

    if (pointers.size === 2) {
      cancelGesture();
      const pts = [...pointers.values()];
      pinch = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom: App.zoom, mid: midpoint(pts) };
      return;
    }
    if (pointers.size > 2) return;

    if (App.presenting) { gesture = { kind: 'presentTap', start: s, moved: false }; return; }
    if (e.button === 1) { startPan(s); return; }
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (!App.isEditable()) {
      // Under afspilning må banen ikke kunne ændres. Første tryk går tilbage til trinnet.
      const i = App.stepIndex;
      App.selectStep(i);
      App.toast('Afspilningen er stoppet – du kan redigere trin ' + (i + 1) + '.');
      return;
    }

    const w = worldOf(s);
    switch (App.tool) {
      case 'select': downSelect(e, s); break;
      case 'run':
      case 'defense': downMoveTool(e, s, w); break;
      case 'pass':
      case 'shot': downBallTool(e, s, w); break;
      case 'free': startFree(s, w); break;
      default: break;
    }
  }

  function startPan(s) {
    gesture = { kind: 'pan', start: s, panX: App.panX, panY: App.panY, moved: false };
  }

  function downSelect(e, s) {
    const handle = hitHandle(s, e);
    if (handle) {
      gesture = { kind: handle.kind === 'end' ? 'lineEnd' : 'lineBend', line: handle.line, start: s, moved: false };
      return;
    }
    if (hitBall(s, e)) {
      App.selection = { kind: 'ball' };
      App.uiChange();
      gesture = { kind: 'ball', start: s, moved: false, created: null };
      return;
    }
    const player = hitPlayer(s, e);
    if (player) {
      App.selection = { kind: 'player', id: player.id };
      App.uiChange();
      gesture = { kind: 'player', player, start: s, moved: false, grab: dragOffset(s, player), created: false };
      return;
    }
    const ghost = hitGhost(s, e);
    if (ghost) {
      App.selection = { kind: 'line', id: ghost.line.id };
      App.uiChange();
      gesture = { kind: 'lineEnd', line: ghost.line, start: s, moved: false };
      return;
    }
    const line = hitLine(s, e);
    if (line) {
      App.selection = { kind: 'line', id: line.id };
      App.uiChange();
      if (line.type === 'free') gesture = { kind: 'moveFree', line, start: s, last: worldOf(s), moved: false };
      return;
    }
    App.selection = null;
    App.uiChange();
    if (App.zoom > 1) startPan(s);
  }

  function dragOffset(s, player) {
    const q = App.view.toScreen(pose().players[player.id]);
    return { x: q.x - s.x, y: q.y - s.y };
  }

  function downMoveTool(e, s, w) {
    const player = hitPlayer(s, e);
    if (player) {
      App.selection = { kind: 'player', id: player.id };
      App.uiChange();
      gesture = { kind: 'drawMove', player, start: s, moved: false, type: App.tool };
      return;
    }
    gesture = { kind: 'tapTarget', start: s, world: w, moved: false };
  }

  function downBallTool(e, s, w) {
    const player = hitPlayer(s, e);
    const fromBall = hitBall(s, e);
    gesture = { kind: 'drawBall', start: s, world: w, moved: false, type: App.tool, pressedPlayer: player, pressedBall: fromBall, origin: null };
  }

  function startFree(s, w) {
    gesture = { kind: 'free', start: s, points: [G.pt(clampInView(w))], moved: false };
  }

  // ---------- Pointer flyt ----------

  function onMove(e) {
    if (!pointers.has(e.pointerId)) { updateCursor(e); return; }
    const s = screenOf(e);
    pointers.set(e.pointerId, s);

    if (pinch && pointers.size >= 2) {
      const pts = [...pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = midpoint(pts);
      App.panX += mid.x - pinch.mid.x;
      App.panY += mid.y - pinch.mid.y;
      pinch.mid = mid;
      App.setZoom(pinch.zoom * (d / pinch.dist), mid.x, mid.y);
      return;
    }
    if (!gesture) return;

    if (!gesture.moved && Math.hypot(s.x - gesture.start.x, s.y - gesture.start.y) < DRAG_PX) return;
    const first = !gesture.moved;
    gesture.moved = true;
    const w = clampInView(worldOf(s));

    switch (gesture.kind) {
      case 'pan':
        App.panX = gesture.panX + s.x - gesture.start.x;
        App.panY = gesture.panY + s.y - gesture.start.y;
        App.requestRender();
        break;
      case 'player': movePlayer(first, s); break;
      case 'ball': moveBall(first, w, e, s); break;
      case 'lineEnd': moveLineEnd(first, w, e, s); break;
      case 'lineBend': moveBend(first, w); break;
      case 'moveFree': moveFree(first, w); break;
      case 'drawMove': updateMoveDraft(w); break;
      case 'drawBall': updateBallDraft(first, w, e, s); break;
      case 'free': {
        const pts = gesture.points;
        const last = pts[pts.length - 1];
        if (G.dist(last, w) >= 0.12 && pts.length < G.LIMITS.pointsPerStroke) pts.push(G.pt(w));
        setFreeDraft(pts);
        break;
      }
      default: break;
    }
  }

  function midpoint(pts) { return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }; }

  function movePlayer(first, s) {
    const player = gesture.player;
    const w = clampInView(worldOf({ x: s.x + gesture.grab.x, y: s.y + gesture.grab.y }));
    if (App.stepIndex === 0) {
      if (first) App.pushUndo();
      player.x = G.round2(w.x);
      player.y = G.round2(w.y);
      App.softChange();
      return;
    }
    // Fra trin 2 og frem er spillerens placering bestemt af tidligere trin. Et træk bliver derfor en bevægelse.
    let line = moveLineOf(player.id);
    if (first) {
      App.pushUndo();
      if (!line) {
        line = G.createLine(typeForPlayer(player), { player: player.id, to: G.pt(w) });
        App.currentStep().lines.push(line);
        gesture.created = true;
        if (!shownDragHint) {
          shownDragHint = true;
          App.toast('Fra trin 2 bliver et træk til en løbepil. Spillerens start rettes i trin 1.');
        }
      }
    }
    line.to = G.pt(w);
    App.softChange();
  }

  function moveBall(first, w, e, s) {
    const target = hitReceiver(s, e);
    App.target = target ? target.id : null;
    if (App.stepIndex === 0 && !App.currentStep().lines.some(G.isBallLine)) {
      if (first) App.pushUndo();
      App.doc.ball.holder = null;
      App.doc.ball.x = G.round2(w.x);
      App.doc.ball.y = G.round2(w.y);
      App.softChange();
      return;
    }
    // Ellers er et træk i bolden en aflevering i dette trin.
    const lines = App.currentStep().lines.filter(G.isBallLine);
    let line = lines[lines.length - 1];
    if (first) {
      App.pushUndo();
      if (!line) {
        line = G.createLine('pass', { to: G.pt(w) });
        App.currentStep().lines.push(line);
        gesture.created = true;
      }
      gesture.line = line;
    }
    line = gesture.line;
    line.to = G.pt(w);
    line.toPlayer = null;
    if (line.type === 'pass' && target) line.toPlayer = target.id;
    App.softChange();
  }

  function moveLineEnd(first, w, e, s) {
    if (first) App.pushUndo();
    const line = gesture.line;
    line.to = G.pt(w);
    if (G.isBallLine(line) && line.type === 'pass') {
      const target = hitReceiver(s, e);
      line.toPlayer = target ? target.id : null;
      App.target = target ? target.id : null;
    }
    App.softChange();
  }

  function moveBend(first, w) {
    if (first) App.pushUndo();
    const line = gesture.line;
    const path = G.linePath(line, info());
    if (!path) return;
    const bend = G.bendFromPoint(path.from, path.to, w);
    line.bend = Math.abs(bend) < 0.15 ? 0 : G.round2(bend);
    App.softChange();
  }

  function moveFree(first, w) {
    if (first) App.pushUndo();
    const dx = w.x - gesture.last.x;
    const dy = w.y - gesture.last.y;
    gesture.last = w;
    gesture.line.points = gesture.line.points.map((p) => G.pt(G.clampToWorld({ x: p.x + dx, y: p.y + dy })));
    App.softChange();
  }

  function setDraft(from, to, type, trimAround) {
    const def = G.LINE_TYPES[type];
    App.draftDraw = (ctx) => {
      const view = App.view;
      const s = G.lineScale(view);
      G.drawArrow(ctx, [view.toScreen(from), view.toScreen(to)], {
        color: def.color, width: def.width * s, dash: def.dash, dashScale: s,
        trim: trimAround ? view.playerRadius + 2 : 0, trimAround: trimAround ? view.toScreen(trimAround) : null,
      });
    };
    App.requestRender();
  }

  function setFreeDraft(points) {
    const def = G.LINE_TYPES.free;
    App.draftDraw = (ctx) => {
      const view = App.view;
      G.drawArrow(ctx, points.map(view.toScreen), { color: def.color, width: def.width * G.lineScale(view), dash: [], dashScale: 1, arrow: false });
    };
    App.requestRender();
  }

  function updateMoveDraft(w) {
    gesture.to = w;
    setDraft(info().start[gesture.player.id], w, gesture.type);
  }

  function updateBallDraft(first, w, e, s) {
    if (first) {
      if (!gesture.pressedBall && !gesture.pressedPlayer) {
        App.toast('Start pilen fra bolden eller fra den spiller, der har den.');
        gesture = { kind: 'ignored', start: s, moved: true };
        return;
      }
      const origin = ballLineOrigin(gesture.pressedBall ? null : gesture.pressedPlayer);
      if (origin.error) {
        App.toast(origin.error, 'error');
        gesture = { kind: 'ignored', start: s, moved: true };
        return;
      }
      gesture.origin = origin.from;
    }
    const target = gesture.type === 'pass' ? hitReceiver(s, e) : null;
    App.target = target ? target.id : null;
    gesture.targetId = target ? target.id : null;
    const to = target ? G.attach(info().end[target.id]) : w;
    gesture.to = w;
    setDraft(gesture.origin, to, gesture.type, target ? info().end[target.id] : null);
  }

  // ---------- Pointer op ----------

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      return;
    }
    const g = gesture;
    gesture = null;
    if (!g) return;
    App.draftDraw = null;
    const s = screenOf(e);
    const w = clampInView(worldOf(s));

    switch (g.kind) {
      case 'presentTap':
        if (!g.moved && App.onPresentTap) App.onPresentTap();
        break;
      case 'player': endPlayer(g); break;
      case 'ball': endBall(g); break;
      case 'lineEnd':
      case 'lineBend':
      case 'moveFree':
        if (g.moved) App.uiChange();
        break;
      case 'drawMove':
        if (g.moved && g.to && G.dist(info().start[g.player.id], g.to) >= MIN_LINE) {
          const replaced = moveLineOf(g.player.id);
          setMove(g.player, g.to, g.type, 0);
          if (replaced) App.toast(g.player.label + ' havde allerede en bevægelse i dette trin. Den er erstattet.');
        }
        break;
      case 'tapTarget':
        endTapMove(g, w);
        break;
      case 'drawBall':
        if (g.moved) {
          if (G.dist(g.origin, g.to) >= MIN_LINE || g.targetId) addBallLine(g.type, g.to, g.targetId);
        } else {
          endTapBall(g, e, s, w);
        }
        break;
      case 'free':
        if (g.points.length >= 2) {
          App.mutate(() => {
            const line = G.createLine('free', { points: g.points });
            App.currentStep().lines.push(line);
            App.selection = { kind: 'line', id: line.id };
          });
        }
        break;
      default: break;
    }
    App.target = null;
    App.requestRender();
  }

  function endPlayer(g) {
    if (!g.moved) return;
    if (App.stepIndex > 0) {
      // Slippes spilleren tæt på sit udgangspunkt, er der ingen bevægelse.
      const line = moveLineOf(g.player.id);
      if (line && G.dist(info().start[g.player.id], line.to) < MIN_LINE) {
        App.currentStep().lines = App.currentStep().lines.filter((l) => l !== line);
        App.softChange();
      }
    }
    App.uiChange();
  }

  function endBall(g) {
    if (!g.moved) return;
    const target = App.target;
    if (App.stepIndex === 0 && !g.line) {
      if (target) App.doc.ball.holder = target;
      App.softChange();
    } else if (g.line) {
      const path = G.linePath(g.line, App.compiled()[App.stepIndex]);
      if (path && !g.line.toPlayer && G.dist(path.from, path.to) < MIN_LINE) {
        App.currentStep().lines = App.currentStep().lines.filter((l) => l !== g.line);
        App.softChange();
      }
    }
    App.uiChange();
  }

  function endTapMove(g, w) {
    if (g.moved) return;
    const sel = App.selection && App.selection.kind === 'player' ? App.player(App.selection.id) : null;
    if (!sel) {
      App.toast('Tryk først på en spiller – eller træk direkte fra spilleren.');
      return;
    }
    if (G.dist(info().start[sel.id], w) >= MIN_LINE) setMove(sel, w, App.tool, 0);
  }

  // Et tryk uden træk: aflevering fra boldens plads til den spiller eller det sted, der trykkes på.
  function endTapBall(g, e, s, w) {
    const c = info();
    const player = g.pressedPlayer;
    if (!App.doc.ball.onCourt) {
      if (player) {
        App.pushUndo();
        App.doc.ball = { onCourt: true, x: player.x, y: player.y, holder: player.id };
        App.selection = { kind: 'ball' };
        App.softChange();
        App.uiChange();
      } else {
        App.toast('Sæt først bolden på banen.');
      }
      return;
    }
    if (g.pressedBall) return;
    if (player && c.ballEnd.holder === player.id) return;
    if (G.dist({ x: c.ballEnd.x, y: c.ballEnd.y }, w) < MIN_LINE && !player) return;
    addBallLine(g.type, w, player && g.type === 'pass' ? player.id : null);
  }

  function cancelGesture() {
    gesture = null;
    App.draftDraw = null;
    App.target = null;
    App.requestRender();
  }

  // ---------- Markør, hjul, tastatur ----------

  function updateCursor(e) {
    if (!App.view) return;
    const canvas = App.canvas;
    if (App.presenting) { canvas.style.cursor = ''; return; }
    if (App.tool !== 'select') { canvas.style.cursor = 'crosshair'; return; }
    const s = screenOf(e);
    const over = hitHandle(s, e) || hitBall(s, e) || hitPlayer(s, e) || hitGhost(s, e);
    canvas.style.cursor = over ? 'grab' : hitLine(s, e) ? 'pointer' : 'default';
  }

  function onWheel(e) {
    e.preventDefault();
    if (App.presenting || !App.view) return;
    const s = screenOf(e);
    App.setZoom(App.zoom * Math.exp(-e.deltaY * 0.0014), s.x, s.y);
  }

  // Slip fra spillerlisten på banen
  Editor.dropPosition = function (clientX, clientY) {
    if (!App.view) return null;
    const r = App.canvas.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    const w = App.view.toWorld({ x: clientX - r.left, y: clientY - r.top });
    return App.view.contains(w) ? clampInView(w) : null;
  };

  Editor.playerNear = function (world) {
    const r = App.view ? App.view.playerRadius / App.view.scale + 0.2 : 1;
    const positions = pose().players;
    let found = null;
    App.doc.players.forEach((p) => { if (G.dist(positions[p.id], world) <= r) found = p; });
    return found;
  };

  // Pil-taster med Shift flytter det valgte præcist.
  Editor.nudge = function (dx, dy) {
    const sel = App.selection;
    if (!sel || !App.isEditable()) return false;
    const by = (p) => G.pt(clampInView({ x: p.x + dx, y: p.y + dy }));
    if (sel.kind === 'player') {
      const player = App.player(sel.id);
      if (!player) return false;
      if (App.stepIndex === 0) {
        App.pushUndo();
        Object.assign(player, by(player));
      } else {
        const line = moveLineOf(player.id);
        if (!line) { App.toast('Fra trin 2 flyttes en spiller ved at tegne en pil.'); return true; }
        App.pushUndo();
        line.to = by(line.to);
      }
      App.softChange();
      return true;
    }
    if (sel.kind === 'line') {
      const found = App.findLine(sel.id);
      if (!found || found.line.type === 'free' || found.line.toPlayer) return false;
      App.pushUndo();
      found.line.to = by(found.line.to);
      App.softChange();
      return true;
    }
    return false;
  };

  Editor.isBusy = () => !!gesture;

  Editor.init = function (canvas) {
    App.canvas = canvas;
    App.ctx = canvas.getContext('2d');
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', (e) => {
      pointers.delete(e.pointerId);
      pinch = null;
      cancelGesture();
    });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    new ResizeObserver(() => App.draw()).observe(canvas);
  };

  G.Editor = Editor;
})(window);
