// Tegner banen, pile, spillere og bold på et canvas. Samme kode bruges på skærmen, til PNG, print og miniaturer.
(function (root) {
  'use strict';
  const G = root.GHB;

  const VIEWS = {
    // Fuld bane: målene til venstre og højre.
    full: { minX: -2.8, maxX: 42.8, minY: -1.6, maxY: 21.6, rotated: false },
    // Halv bane: målet øverst, som på en taktiktavle. Venstre fløj står til venstre set i angrebsretningen.
    half: { minX: 18.6, maxX: 42.8, minY: -1.6, maxY: 21.6, rotated: true },
  };

  // Afbildning fra bane (meter) til skærm (pixels). Zoom og panorering lægges oven på "fit".
  function makeView(mode, width, height, zoom, panX, panY) {
    const v = VIEWS[mode];
    const worldW = v.rotated ? v.maxY - v.minY : v.maxX - v.minX;
    const worldH = v.rotated ? v.maxX - v.minX : v.maxY - v.minY;
    const z = zoom || 1;
    const scale = Math.min(width / worldW, height / worldH) * z;
    const ox = (width - worldW * scale) / 2 + (panX || 0);
    const oy = (height - worldH * scale) / 2 + (panY || 0);
    const view = { mode, def: v, width, height, scale, ox, oy };
    if (v.rotated) {
      // skærm x = y - minY, skærm y = maxX - x
      view.matrix = [0, -scale, scale, 0, ox - v.minY * scale, oy + v.maxX * scale];
      view.toScreen = (p) => ({ x: ox + (p.y - v.minY) * scale, y: oy + (v.maxX - p.x) * scale });
      view.toWorld = (s) => ({ x: v.maxX - (s.y - oy) / scale, y: v.minY + (s.x - ox) / scale });
    } else {
      view.matrix = [scale, 0, 0, scale, ox - v.minX * scale, oy - v.minY * scale];
      view.toScreen = (p) => ({ x: ox + (p.x - v.minX) * scale, y: oy + (p.y - v.minY) * scale });
      view.toWorld = (s) => ({ x: v.minX + (s.x - ox) / scale, y: v.minY + (s.y - oy) / scale });
    }
    view.contains = (p) => p.x >= v.minX && p.x <= v.maxX && p.y >= v.minY && p.y <= v.maxY;
    view.clamp = (p) => ({ x: G.clamp(p.x, v.minX, v.maxX), y: G.clamp(p.y, v.minY, v.maxY) });
    view.playerRadius = Math.max(12, 0.62 * scale);
    view.ballRadius = Math.max(7, 0.3 * scale);
    return view;
  }

  // ---------- Banen ----------

  function drawGoalEnd(ctx, goalX, dir, lw) {
    // dir = -1: målet til højre (banen ligger mod mindre x). dir = 1: målet til venstre.
    const postA = 8.5;
    const postB = 11.5;

    const arcPath = (r) => {
      // To kvartcirkler om stolperne, forbundet af en lige linje parallelt med mållinjen.
      ctx.beginPath();
      if (dir === -1) {
        ctx.arc(goalX, postA, r, -Math.PI / 2, -Math.PI, true);
        ctx.lineTo(goalX - r, postB);
        ctx.arc(goalX, postB, r, Math.PI, Math.PI / 2, true);
      } else {
        ctx.arc(goalX, postA, r, -Math.PI / 2, 0, false);
        ctx.lineTo(goalX + r, postB);
        ctx.arc(goalX, postB, r, 0, Math.PI / 2, false);
      }
    };

    // Målfelt: lysere flade og hvid 6-meter-linje.
    arcPath(6);
    ctx.closePath();
    ctx.fillStyle = '#3f8fe0';
    ctx.fill();
    arcPath(6);
    ctx.lineWidth = lw;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Frikastlinje (9 m) stiplet. Klippes af sidelinjerne via banens clip.
    ctx.save();
    ctx.setLineDash([0.42, 0.34]);
    arcPath(9);
    ctx.stroke();
    ctx.restore();

    // Straffekastmærke (7 m): 1 meter lang streg.
    ctx.beginPath();
    ctx.moveTo(goalX + dir * 7, 9.5);
    ctx.lineTo(goalX + dir * 7, 10.5);
    ctx.lineWidth = lw * 1.1;
    ctx.stroke();

    // Målmandens begrænsningslinje (4 m).
    ctx.beginPath();
    ctx.moveTo(goalX + dir * 4, 9.925);
    ctx.lineTo(goalX + dir * 4, 10.075);
    ctx.stroke();
    ctx.lineWidth = lw;
  }

  function drawGoalFrame(ctx, goalX, dir, lw) {
    const back = goalX - dir * G.COURT.goalDepth;
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(Math.min(goalX, back), 8.5, G.COURT.goalDepth, 3);
    // Målnet
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = lw * 0.4;
    ctx.beginPath();
    for (let i = 1; i < 6; i += 1) {
      ctx.moveTo(goalX, 8.5 + i * 0.5);
      ctx.lineTo(back, 8.5 + i * 0.5);
    }
    for (let i = 1; i < 3; i += 1) {
      const x = goalX - dir * (i / 3) * G.COURT.goalDepth;
      ctx.moveTo(x, 8.5);
      ctx.lineTo(x, 11.5);
    }
    ctx.stroke();
    // Stolper og overligger i røde og hvide felter
    ctx.lineWidth = lw * 1.5;
    ctx.beginPath();
    ctx.moveTo(goalX, 8.5);
    ctx.lineTo(back, 8.5);
    ctx.lineTo(back, 11.5);
    ctx.lineTo(goalX, 11.5);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([0.2, 0.2]);
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lw;
  }

  function drawCourt(ctx, view) {
    ctx.save();
    ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix(view.matrix)));
    const lw = Math.max(0.07, 1.5 / view.scale);
    const halfOnly = view.mode === 'half';
    const x0 = halfOnly ? 20 : 0;

    // Spilleflade
    ctx.fillStyle = '#2470c2';
    ctx.fillRect(x0, 0, 40 - x0, 20);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, 40 - x0, 20);
    ctx.clip();
    ctx.lineJoin = 'round';
    drawGoalEnd(ctx, 40, -1, lw);
    if (!halfOnly) drawGoalEnd(ctx, 0, 1, lw);
    ctx.restore();

    // Yderlinjer og midterlinje
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lw * 1.2;
    ctx.strokeRect(x0, 0, 40 - x0, 20);
    ctx.lineWidth = lw * 1.2;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(20, 20);
    ctx.stroke();
    // Udskiftningsmærker (4,5 m fra midterlinjen)
    ctx.lineWidth = lw;
    ctx.beginPath();
    [15.5, 24.5].forEach((x) => {
      if (x < x0) return;
      ctx.moveTo(x, -0.3);
      ctx.lineTo(x, 0.3);
    });
    ctx.stroke();

    drawGoalFrame(ctx, 40, -1, lw);
    if (!halfOnly) drawGoalFrame(ctx, 0, 1, lw);
    ctx.restore();
  }

  // ---------- Pile ----------

  function linePath(line, info) {
    // Returnerer punkterne for en pil i det valgte trin (verdenskoordinater).
    if (line.type === 'free') return { points: line.points, from: line.points[0], to: line.points[line.points.length - 1] };
    if (G.isMove(line)) {
      const m = info.movesByLine[line.id];
      if (!m) return null;
      return { points: G.sampleCurve(m.from, m.ctrl, m.to), from: m.from, to: m.to, trimEnd: true, trimAround: m.to };
    }
    const ev = info.ballEvents.find((e) => e.line.id === line.id);
    if (!ev) return null;
    return {
      points: G.sampleCurve(ev.from, ev.ctrl, ev.to), from: ev.from, to: ev.to, trimEnd: !!ev.toPlayer,
      trimAround: ev.toPlayer ? { x: ev.to.x - G.BALL_OFFSET.x, y: ev.to.y - G.BALL_OFFSET.y } : null,
    };
  }

  function drawArrow(ctx, screenPts, opts) {
    if (screenPts.length < 2) return;
    const color = opts.color;
    const width = opts.width;
    let pts = screenPts;
    // Pilespidsen må ikke gemme sig under spilleren, den peger på: stop, hvor linjen rammer spillerens cirkel.
    if (opts.trim) {
      const c = opts.trimAround || pts[pts.length - 1];
      const inside = (p) => Math.hypot(p.x - c.x, p.y - c.y) <= opts.trim;
      const hit = pts.findIndex(inside);
      if (hit === 0) return;
      if (hit > 0) {
        let a = pts[hit - 1];
        let b = pts[hit];
        for (let i = 0; i < 10; i += 1) {
          const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          if (inside(m)) b = m; else a = m;
        }
        pts = pts.slice(0, hit).concat([a]);
      }
    }

    const head = Math.max(11, width * 3.6);
    const tip = pts[pts.length - 1];
    let back = pts[pts.length - 2];
    for (let i = pts.length - 2; i >= 0; i -= 1) {
      back = pts[i];
      if (Math.hypot(tip.x - back.x, tip.y - back.y) >= head * 0.8) break;
    }
    const ang = Math.atan2(tip.y - back.y, tip.x - back.x);

    ctx.save();
    ctx.lineCap = opts.dash && opts.dash.length ? 'butt' : 'round';
    ctx.lineJoin = 'round';
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    };
    if (opts.halo) {
      trace();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = width + 7;
      ctx.stroke();
    }
    // Mørk kant, så linjen altid kan ses mod både bane og linjer.
    trace();
    ctx.strokeStyle = 'rgba(8,20,40,0.45)';
    ctx.lineWidth = width + 2;
    ctx.setLineDash((opts.dash || []).map((d) => d * opts.dashScale));
    ctx.stroke();
    trace();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);

    if (opts.arrow !== false) {
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x - head * Math.cos(ang - 0.42), tip.y - head * Math.sin(ang - 0.42));
      ctx.lineTo(tip.x - head * 0.72 * Math.cos(ang), tip.y - head * 0.72 * Math.sin(ang));
      ctx.lineTo(tip.x - head * Math.cos(ang + 0.42), tip.y - head * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(8,20,40,0.45)';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function lineScale(view) {
    return G.clamp(view.scale / 26, 0.7, 2.2);
  }

  function drawLine(ctx, view, line, info, opts) {
    const path = linePath(line, info);
    if (!path) return;
    const def = G.LINE_TYPES[line.type];
    const s = lineScale(view);
    drawArrow(ctx, path.points.map(view.toScreen), {
      color: line.color,
      width: line.width * s,
      dash: def.dash,
      dashScale: s,
      trim: path.trimEnd ? view.playerRadius + 2 : 0,
      trimAround: path.trimAround ? view.toScreen(path.trimAround) : null,
      arrow: line.type === 'free' ? line.arrow : true,
      halo: opts && opts.selected,
    });
  }

  // ---------- Spillere og bold ----------

  function playerColor(doc, player) {
    return player.color || doc.colors[player.team] || G.DEFAULT_COLORS.attack;
  }

  function textOn(hex) {
    const n = parseInt(hex.slice(1), 16);
    const l = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
    return l > 0.62 ? '#0b1220' : '#ffffff';
  }

  function drawPlayer(ctx, view, doc, player, p, opts) {
    const o = opts || {};
    const s = view.toScreen(p);
    const r = view.playerRadius;
    const color = playerColor(doc, player);
    ctx.save();
    if (o.ghost) ctx.globalAlpha = 0.42;

    if (o.selected) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(253,224,71,0.35)';
      ctx.fill();
    }
    if (!o.ghost) {
      ctx.beginPath();
      ctx.arc(s.x, s.y + r * 0.1, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.11);
    ctx.strokeStyle = o.selected ? '#fde047' : o.target ? '#34d399' : '#ffffff';
    if (o.selected || o.target) ctx.lineWidth = Math.max(3, r * 0.17);
    if (o.ghost) ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    const fg = textOn(color);
    const mode = doc.labelMode;
    const main = mode === 'number' ? (player.number || player.label) : player.label;
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fit = main.length > 3 ? 0.62 : main.length === 3 ? 0.74 : 0.9;
    ctx.font = '700 ' + (r * fit) + 'px system-ui, "Segoe UI", Roboto, sans-serif';
    if (mode === 'both' && player.number) {
      ctx.fillText(main, s.x, s.y - r * 0.2);
      ctx.font = '700 ' + (r * 0.58) + 'px system-ui, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(player.number, s.x, s.y + r * 0.46);
    } else {
      ctx.fillText(main, s.x, s.y + r * 0.04);
    }

    if (player.name && !o.ghost) {
      const fs = Math.max(10, r * 0.62);
      ctx.font = '600 ' + fs + 'px system-ui, "Segoe UI", Roboto, sans-serif';
      const tw = ctx.measureText(player.name).width;
      ctx.fillStyle = 'rgba(8,20,40,0.72)';
      const bx = s.x - tw / 2 - 4;
      const by = s.y + r + 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, tw + 8, fs + 5, 4);
      else ctx.rect(bx, by, tw + 8, fs + 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(player.name, s.x, by + (fs + 5) / 2 + 0.5);
    }
    ctx.restore();
  }

  function drawBall(ctx, view, p, opts) {
    const o = opts || {};
    const s = view.toScreen(p);
    const r = view.ballRadius;
    ctx.save();
    if (o.ghost) ctx.globalAlpha = 0.45;
    if (o.selected) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(253,224,71,0.45)';
      ctx.fill();
    }
    ctx.translate(s.x, s.y);
    ctx.beginPath();
    ctx.arc(0, r * 0.14, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.rotate(o.spin || 0);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fffbe8');
    g.addColorStop(0.7, '#fde68a');
    g.addColorStop(1, '#f59e0b');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.strokeStyle = '#7c2d12';
    ctx.stroke();
    // Syninger, der giver håndboldens karakteristiske panelmønster
    ctx.save();
    ctx.clip();
    ctx.lineWidth = Math.max(0.8, r * 0.1);
    for (let i = 0; i < 3; i += 1) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.5, r * 0.2, r * 1.05, r * 0.05);
      ctx.moveTo(r * 0.55, r * 0.13);
      ctx.quadraticCurveTo(r * 0.75, r * 0.55, r * 0.7, r * 0.95);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  function drawHandle(ctx, view, p, kind) {
    const s = view.toScreen(p);
    ctx.save();
    ctx.beginPath();
    ctx.arc(s.x, s.y, kind === 'bend' ? 7 : 8, 0, Math.PI * 2);
    ctx.fillStyle = kind === 'bend' ? '#0ea5e9' : '#fde047';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0b1220';
    ctx.stroke();
    ctx.restore();
  }

  // ---------- Hele scenen ----------

  // opts: stepIndex, t, ended, animating, showLines, selection, target, draft, hideGhosts, spin
  function drawScene(ctx, view, doc, compiled, opts) {
    const o = opts || {};
    const stepIndex = G.clamp(o.stepIndex || 0, 0, compiled.length - 1);
    const info = compiled[stepIndex];
    const t = o.t || 0;
    const pose = G.poseAt(doc, compiled, stepIndex, t);
    const sel = o.selection || null;

    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, view.width, view.height);
    drawCourt(ctx, view);

    // Alt, der ligger uden for den valgte visning (fx anden banehalvdel), klippes væk.
    ctx.save();
    const a = view.toScreen({ x: view.def.minX, y: view.def.minY });
    const b = view.toScreen({ x: view.def.maxX, y: view.def.maxY });
    ctx.beginPath();
    ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    ctx.clip();

    if (o.showLines !== false) {
      // Friehåndstegninger markeret "vis i alle trin"
      doc.steps.forEach((step, i) => {
        if (i === stepIndex) return;
        step.lines.forEach((l) => {
          if (l.type === 'free' && l.allSteps) drawLine(ctx, view, l, info, { selected: sel && sel.kind === 'line' && sel.id === l.id });
        });
      });
      const step = doc.steps[stepIndex];
      if (!o.ended) {
        ctx.save();
        if (o.animating) ctx.globalAlpha = 0.38;
        step.lines.forEach((l) => drawLine(ctx, view, l, info, { selected: sel && sel.kind === 'line' && sel.id === l.id }));
        ctx.restore();
      } else {
        step.lines.forEach((l) => { if (l.type === 'free') drawLine(ctx, view, l, info); });
      }
    }

    // Skygger viser, hvor spillerne ender i det aktuelle trin.
    if (!o.animating && !o.ended && !o.hideGhosts && o.showLines !== false) {
      doc.players.forEach((p) => {
        const m = info.moves[p.id];
        if (m) drawPlayer(ctx, view, doc, p, m.to, { ghost: true });
      });
    }

    if (o.draft) o.draft(ctx);

    // Spillere: den valgte tegnes sidst, så markeringen altid ses.
    const ordered = doc.players.slice().sort((p, q) => {
      const ps = sel && sel.kind === 'player' && sel.id === p.id ? 1 : 0;
      const qs = sel && sel.kind === 'player' && sel.id === q.id ? 1 : 0;
      return ps - qs;
    });
    ordered.forEach((p) => {
      drawPlayer(ctx, view, doc, p, pose.players[p.id], {
        selected: sel && sel.kind === 'player' && sel.id === p.id,
        target: o.target === p.id,
      });
    });

    if (doc.ball.onCourt) {
      drawBall(ctx, view, pose.ball.pos, {
        selected: sel && sel.kind === 'ball',
        spin: pose.ball.flying ? pose.ball.flying * Math.PI * 4 : 0,
      });
    }

    // Håndtag på den valgte pil
    if (sel && sel.kind === 'line' && !o.animating && !o.ended) {
      const line = doc.steps[stepIndex].lines.find((l) => l.id === sel.id);
      if (line && line.type !== 'free') {
        const path = linePath(line, info);
        if (path) {
          drawHandle(ctx, view, G.curveMid(path.from, path.to, line.bend), 'bend');
          drawHandle(ctx, view, path.to, 'end');
        }
      }
    }
    ctx.restore();
  }

  // Tegner et enkelt trin til et selvstændigt canvas (PNG, print, miniaturer).
  function renderToCanvas(doc, stepIndex, widthPx, opts) {
    const o = opts || {};
    const def = VIEWS[doc.court];
    const worldW = def.rotated ? def.maxY - def.minY : def.maxX - def.minX;
    const worldH = def.rotated ? def.maxX - def.minX : def.maxY - def.minY;
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = Math.round(widthPx * worldH / worldW);
    const ctx = canvas.getContext('2d');
    const view = makeView(doc.court, canvas.width, canvas.height);
    if (o.small) { view.playerRadius = Math.max(4, view.playerRadius); view.ballRadius = Math.max(2.5, view.ballRadius); }
    drawScene(ctx, view, doc, G.compile(doc), { stepIndex, t: 0 });
    return canvas;
  }

  Object.assign(G, { VIEWS, makeView, drawScene, renderToCanvas, drawArrow, linePath, lineScale, drawPlayer, drawBall, playerColor });
})(window);
