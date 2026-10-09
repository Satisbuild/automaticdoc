'use strict';
/* =====================================================================
   SUPER GREJS - renderer.js
   Tegner spilverdenen på canvas: himmel, parallax-lag, tiles,
   dekorationer, figurer, partikler, vejreffekter, mørke og overgange.
   Verden er altid 288 enheder høj; bredden følger skærmens format.
   ===================================================================== */
SG.renderer = (function () {
  const A = SG.art;
  const PH = SG.physics;
  const T = PH.T;
  const U = SG.util;
  const TILE = PH.TILE;
  const VIEW_H = 288;
  const MIN_W = 320, MAX_W = 720;

  let canvas, ctx;
  let cw = 0, ch = 0, scale = 1, offX = 0, offY = 0, viewW = 512;
  let darkCanvas = null;
  let bottomPad = 0; // andel af skærmhøjden reserveret til touchknapper
  const skyCache = new Map();

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d', { alpha: false });
    resize();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
    cw = w; ch = h;
    const availH = ch * (1 - bottomPad);
    scale = availH / VIEW_H;
    viewW = cw / scale;
    offX = 0; offY = 0;
    if (viewW < MIN_W) {
      scale = cw / MIN_W; viewW = MIN_W;
      offY = Math.max(0, (availH - VIEW_H * scale) / 2);
    } else if (viewW > MAX_W) {
      viewW = MAX_W;
      offX = (cw - MAX_W * scale) / 2;
    }
    ctx.imageSmoothingEnabled = false;
    return viewW;
  }

  const getViewW = () => viewW;
  // Touch: spillet tegnes over en bund-stribe, så knapperne ikke dækker verden
  function setBottomPad(f) { bottomPad = f; return resize(); }

  /* ---------------- Himmel og baggrund ---------------- */
  function sky(th) {
    let g = skyCache.get(th.name);
    if (!g) {
      g = U.makeCanvas(1, 288);
      const c = g.getContext('2d');
      const gr = c.createLinearGradient(0, 0, 0, 288);
      gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.6, th.sky[1]); gr.addColorStop(1, th.sky[2]);
      c.fillStyle = gr; c.fillRect(0, 0, 1, 288);
      skyCache.set(th.name, g);
    }
    return g;
  }

  function drawBackground(th, camX, camY, roomH) {
    ctx.drawImage(sky(th), 0, 0, 1, 288, 0, 0, viewW + 1, VIEW_H);
    const L = A.buildLayers(th);
    const baseY = roomH - VIEW_H - camY; // 0 når kameraet er i bunden af rummet
    [[L.far, 0.12, 0.25], [L.mid, 0.3, 0.45], [L.near, 0.55, 0.7]].forEach(([img, fx, fy]) => {
      const off = -((camX * fx) % A.BG_W + A.BG_W) % A.BG_W;
      const y = Math.round(baseY * fy);
      for (let x = off; x < viewW; x += A.BG_W) ctx.drawImage(img, Math.round(x), y, A.BG_W, A.BG_H);
    });
  }

  /* ---------------- Tiles ---------------- */
  const groundLike = c => c === T.GROUND || c === T.FAKE;

  function drawTiles(g, x0, x1, y0, y1, fakeAlpha) {
    const room = g.room, th = g.theme, t = g.t;
    const at = (x, y) => PH.tileAt(room, x, y);
    const qf = [0, 1, 2, 1][Math.floor(t * 5) % 4];
    const lf = Math.floor(t * 6) % 4;
    const cf = Math.floor(t * 14) % 4;
    for (let ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty >= room.h) continue;
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || tx >= room.w) continue;
        const c = room.tiles[ty * room.w + tx];
        if (c === T.EMPTY || c === T.HIDDEN) continue;
        let px = tx * TILE, py = ty * TILE;
        const idx = ty * room.w + tx;
        const bump = g.bumps.get(idx);
        if (bump) py -= Math.sin((1 - bump / 0.18) * Math.PI) * 5;
        let img = null;
        switch (c) {
          case T.GROUND: case T.FAKE: {
            const top = !groundLike(at(tx, ty - 1));
            const left = tx > 0 && !groundLike(at(tx - 1, ty));
            const right = tx < room.w - 1 && !groundLike(at(tx + 1, ty));
            img = A.groundTile(th, top, left, right, Math.floor(U.hash2(tx, ty, 7) * 4));
            if (c === T.FAKE && fakeAlpha < 1) {
              ctx.globalAlpha = fakeAlpha; ctx.drawImage(img, px, py, TILE, TILE); ctx.globalAlpha = 1; img = null;
            }
            break;
          }
          case T.BRICK: img = A.brickTile(th, tx + ty); break;
          case T.QBLOCK: img = A.qblockTile(qf, false); break;
          case T.USED: img = A.qblockTile(0, true); break;
          case T.HARD: img = A.hardTile(th); break;
          case T.PIPE_L: img = A.pipeTile(th, at(tx, ty - 1) === T.PIPE_L ? 'l' : 'tl'); break;
          case T.PIPE_R: img = A.pipeTile(th, at(tx, ty - 1) === T.PIPE_R ? 'r' : 'tr'); break;
          case T.SEMI: img = A.semiTile(th, at(tx - 1, ty) !== T.SEMI, at(tx + 1, ty) !== T.SEMI); break;
          case T.SPIKE: img = A.spikeTile('up'); break;
          case T.SPIKE_DOWN: img = A.spikeTile('down'); break;
          case T.LAVA: img = A.lavaTile(lf, at(tx, ty - 1) !== T.LAVA, false); break;
          case T.POISON: img = A.lavaTile(lf, at(tx, ty - 1) !== T.POISON, true); break;
          case T.ICE: img = A.iceTile(); break;
          case T.CONV_L: img = A.conveyorTile(cf, -1); break;
          case T.CONV_R: img = A.conveyorTile(cf, 1); break;
          case T.CRUMBLE: {
            img = A.crumbleTile(th);
            const cr = g.crumbles.get(idx);
            if (cr && cr.state === 'shake') px += Math.sin(t * 90) * 1;
            break;
          }
          case T.COIN: img = A.coinFrame(Math.floor(t * 8 + tx * 0.4) % 6); break;
        }
        if (img) ctx.drawImage(img, px, py, TILE, TILE);
      }
    }
  }

  function drawDecor(g, x0, x1) {
    const room = g.room;
    for (const d of room.decor) {
      if (d.x < x0 - 6 || d.x > x1 + 2) continue;
      const img = A.decor(d.kind, g.theme);
      const w = img.width / A.R, h = img.height / A.R;
      ctx.drawImage(img, d.x * TILE, (room.h - d.y) * TILE - h, w, h);
    }
  }

  function drawDoors(g) {
    const room = g.room;
    for (const d of room.doors) {
      const x = d.x * TILE, b = (room.h - d.y) * TILE;
      ctx.fillStyle = A.OUT; ctx.fillRect(x - 1, b - 30, TILE + 2, 30);
      ctx.fillStyle = '#7a4a24'; ctx.fillRect(x, b - 29, TILE, 29);
      ctx.fillStyle = '#a8703c'; ctx.fillRect(x + 2, b - 27, 5, 25); ctx.fillRect(x + 9, b - 27, 5, 25);
      ctx.fillStyle = '#ffc93c'; ctx.fillRect(x + 11, b - 15, 2, 2);
      ctx.fillStyle = A.OUT; ctx.beginPath(); ctx.arc(x + 8, b - 29, 9, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#7a4a24'; ctx.beginPath(); ctx.arc(x + 8, b - 29, 8, Math.PI, 0); ctx.fill();
      // Lille pil, så man kan se døren kan bruges
      const bob = Math.sin(g.t * 5) * 2;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.moveTo(x + 4, b - 46 + bob); ctx.lineTo(x + 12, b - 46 + bob); ctx.lineTo(x + 8, b - 41 + bob); ctx.fill();
    }
  }

  function drawWind(g) {
    for (const w of g.room.wind) {
      const x0 = w.x0 * TILE, x1 = (w.x1 + 1) * TILE;
      if (x1 < g.cam.x || x0 > g.cam.x + viewW) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const span = x1 - x0;
        const px = x0 + ((i * 97 + g.t * w.force * 2.2) % span + span) % span;
        const py = g.cam.y + 20 + ((i * 53) % (VIEW_H - 40));
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sign(w.force) * 14, py); ctx.stroke();
      }
    }
  }

  /* ---------------- Partikler ---------------- */
  function drawParticles(g) {
    for (const p of g.particles) {
      const a = Math.max(0, Math.min(1, p.life / (p.max || 1) * 1.5));
      ctx.globalAlpha = a;
      if (p.type === 'text') {
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = A.OUT; ctx.fillText(p.str, p.x + 1, p.y + 1);
        ctx.fillStyle = p.color; ctx.fillText(p.str, p.x, p.y);
      } else if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 0.5, p.y - 2, 1, 4); ctx.fillRect(p.x - 2, p.y - 0.5, 4, 1);
      } else if (p.type === 'shard') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        ctx.fillStyle = A.OUT; ctx.fillRect(-p.size / 2 - 0.5, -p.size / 2 - 0.5, p.size + 1, p.size + 1);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else if (p.type === 'puff') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.4 - a * 0.4), 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Vejr og stemning, tegnet i skærm-koordinater (ingen tilstand - kun tid)
  function drawAmbient(th, t, camX) {
    const kind = th.ambient;
    if (kind === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 70; i++) {
        const sp = 18 + (i % 5) * 7;
        const x = ((i * 137.5 + Math.sin(t + i) * 12 - camX * (0.3 + (i % 3) * 0.2)) % (viewW + 20) + viewW + 20) % (viewW + 20) - 10;
        const y = ((i * 61 + t * sp) % (VIEW_H + 10)) - 5;
        const s = 1 + (i % 3) * 0.6;
        ctx.fillRect(x, y, s, s);
      }
    } else if (kind === 'embers') {
      for (let i = 0; i < 40; i++) {
        const x = ((i * 97 - camX * 0.5 + Math.sin(t * 0.7 + i) * 10) % (viewW + 20) + viewW + 20) % (viewW + 20) - 10;
        const y = VIEW_H - ((i * 43 + t * (20 + (i % 4) * 8)) % (VIEW_H + 10));
        ctx.fillStyle = i % 3 ? 'rgba(255,140,40,.8)' : 'rgba(255,220,90,.9)';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    } else if (kind === 'fireflies') {
      for (let i = 0; i < 24; i++) {
        const x = ((i * 113 - camX * 0.4 + Math.sin(t * 0.6 + i * 2) * 26) % (viewW + 40) + viewW + 40) % (viewW + 40) - 20;
        const y = 70 + ((i * 71) % 180) + Math.cos(t * 0.8 + i) * 14;
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2 + i * 1.7));
        ctx.fillStyle = `rgba(200,255,120,${a * 0.3})`; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(230,255,160,${a})`; ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    } else if (kind === 'dust') {
      ctx.fillStyle = 'rgba(255,230,180,.35)';
      for (let i = 0; i < 30; i++) {
        const x = ((i * 89 - camX * 0.6 + t * 6) % (viewW + 20) + viewW + 20) % (viewW + 20) - 10;
        const y = ((i * 47 + Math.sin(t + i) * 8) % VIEW_H);
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (kind === 'smoke') {
      for (let i = 0; i < 10; i++) {
        const x = ((i * 157 - camX * 0.2) % (viewW + 120) + viewW + 120) % (viewW + 120) - 60;
        const y = 120 - ((t * 10 + i * 40) % 140);
        ctx.fillStyle = 'rgba(90,70,80,.12)';
        ctx.beginPath(); ctx.arc(x + Math.sin(t + i) * 10, y, 16 + (i % 3) * 6, 0, 7); ctx.fill();
      }
    } else if (kind === 'sparkle') {
      for (let i = 0; i < 26; i++) {
        const x = (i * 131) % viewW, y = (i * 59) % VIEW_H;
        const a = Math.max(0, Math.sin(t * 3 + i));
        ctx.fillStyle = `rgba(255,240,160,${a})`;
        ctx.fillRect(x, y - 1.5, 1, 3); ctx.fillRect(x - 1.5, y, 3, 1);
      }
    } else if (kind === 'wind') {
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      for (let i = 0; i < 12; i++) {
        const x = viewW - ((i * 173 + t * 120) % (viewW + 60));
        const y = 30 + (i * 37) % 200;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y - 4, x + 30, y); ctx.stroke();
      }
    }
  }

  /* ---------------- Mørke (Mørkeskoven) ---------------- */
  function drawDarkness(g, camX, camY) {
    if (!darkCanvas || darkCanvas.width !== cw || darkCanvas.height !== ch) darkCanvas = U.makeCanvas(cw, ch);
    const d = darkCanvas.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, cw, ch);
    d.fillStyle = 'rgba(3,5,14,0.93)';
    d.fillRect(0, 0, cw, ch);
    d.globalCompositeOperation = 'destination-out';
    const light = (x, y, r, k) => {
      const sx = offX + (x - camX) * scale, sy = offY + (y - camY) * scale, sr = r * scale;
      const gr = d.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr);
      gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = gr;
      d.beginPath(); d.arc(sx, sy, sr, 0, 7); d.fill();
    };
    const p = g.player;
    const flick = 1 + Math.sin(g.t * 9) * 0.02;
    light(p.cx, p.cy, (p.star > 0 ? 150 : 108) * flick, 1);
    light(p.cx + p.facing * 40, p.cy, 60, 0.6);
    for (const e of g.entities) {
      if (e.kind === 'proj') light(e.cx, e.cy, 46, 0.9);
      else if (e.kind === 'checkpoint' || e.kind === 'goal' || e.kind === 'crystal') light(e.cx, e.y + 10, 60, 0.8);
      else if (e instanceof SG.entities.Gloeder || e.kind === 'item') light(e.cx, e.cy, 36, 0.8);
      else if (e.isBoss) light(e.cx, e.cy, 70, 0.5);
    }
    for (const dc of g.room.decor) {
      if (dc.kind === 'lantern' || dc.kind === 'torch' || dc.kind === 'mushroom' || dc.kind === 'crystal') {
        light(dc.x * TILE + 8, (g.room.h - dc.y) * TILE - 12, 54, 0.85);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(darkCanvas, 0, 0);
  }

  /* ---------------- Hele scenen ---------------- */
  function draw(g) {
    if (!g || !g.room) return;
    const room = g.room, th = g.theme;
    let camX = g.cam.x, camY = g.cam.y;
    if (g.shakeAmp > 0) { camX += U.rand(-g.shakeAmp, g.shakeAmp); camY += U.rand(-g.shakeAmp, g.shakeAmp) * 0.6; }
    camX = Math.round(camX * scale) / scale;
    camY = Math.round(camY * scale) / scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    if (bottomPad > 0) {
      const y0 = offY + VIEW_H * scale;
      const gr = ctx.createLinearGradient(0, y0, 0, ch);
      gr.addColorStop(0, '#2a1d4a'); gr.addColorStop(1, '#140c26');
      ctx.fillStyle = gr; ctx.fillRect(0, y0, cw, ch - y0);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, y0, cw, Math.max(1, scale * 0.5));
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(offX, offY, viewW * scale, VIEW_H * scale); ctx.clip();

    // Baggrund i skærmkoordinater
    ctx.setTransform(scale, 0, 0, scale, offX, offY);
    drawBackground(th, camX, camY, room.h * TILE);

    // Verden
    ctx.setTransform(scale, 0, 0, scale, offX - camX * scale, offY - camY * scale);
    const x0 = Math.floor(camX / TILE) - 1, x1 = Math.ceil((camX + viewW) / TILE) + 1;
    const y0 = Math.floor(camY / TILE) - 1, y1 = Math.ceil((camY + VIEW_H) / TILE) + 1;
    drawDecor(g, x0, x1);
    drawDoors(g);
    drawWind(g);

    for (const e of g.entities) if (e.behind) e.draw(ctx, g);
    if (g.player.behind) g.player.draw(ctx, g.settings);

    // Falske vægge bliver gennemsigtige, når spilleren står i dem
    const p = g.player;
    const inFake = PH.tileAt(room, Math.floor(p.cx / TILE), Math.floor(p.cy / TILE)) === T.FAKE;
    drawTiles(g, x0, x1, y0, y1, inFake ? 0.35 : 1);

    const order = ['platform', 'spring', 'checkpoint', 'goal', 'misc', 'item', 'crystal', 'enemy'];
    for (const k of order) for (const e of g.entities) if (e.kind === k && !e.behind) e.draw(ctx, g);
    if (!p.behind) p.draw(ctx, g.settings);
    for (const e of g.entities) if ((e.kind === 'proj' || e.kind === 'hazard' || e.kind === 'fx') && !e.behind) e.draw(ctx, g);
    drawParticles(g);

    // Vejr
    ctx.setTransform(scale, 0, 0, scale, offX, offY);
    if (!room.dark) drawAmbient(th, g.t, camX);
    ctx.restore();

    if (room.dark) {
      drawDarkness(g, camX, camY);
      ctx.save();
      ctx.beginPath(); ctx.rect(offX, offY, viewW * scale, VIEW_H * scale); ctx.clip();
      ctx.setTransform(scale, 0, 0, scale, offX, offY);
      drawAmbient(th, g.t, camX);
      ctx.restore();
    }

    // Overgang (iris)
    if (g.transition) {
      const tr = g.transition;
      const k = tr.phase === 'out' ? 1 - tr.t / tr.dur : tr.t / tr.dur;
      iris(U.clamp(k, 0, 1), offX + (p.cx - camX) * scale, offY + (p.cy - camY) * scale);
    }
  }

  function iris(k, x, y) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const r = Math.hypot(cw, ch) * k;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2, true);
    ctx.fill('evenodd');
  }

  function black(alpha) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(0,0,0,${alpha == null ? 1 : alpha})`;
    ctx.fillRect(0, 0, cw, ch);
  }

  /* ---------------- Menu-baggrund ---------------- */
  // En levende scene bag menuerne: valgt tema, figuren løber, mønter svæver.
  function drawMenuScene(t, themeId, charId) {
    const th = A.themeFor(themeId || 'grass', false);
    const camX = t * 60;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.beginPath(); ctx.rect(offX, offY, viewW * scale, VIEW_H * scale); ctx.clip();
    ctx.setTransform(scale, 0, 0, scale, offX, offY);
    drawBackground(th, camX, 0, VIEW_H);
    // Jord
    const off = -(camX % TILE);
    for (let i = -1; i < viewW / TILE + 2; i++) {
      const x = off + i * TILE;
      ctx.drawImage(A.groundTile(th, true, false, false, (i + Math.floor(camX / TILE)) & 3), x, VIEW_H - 32, TILE, TILE);
      ctx.drawImage(A.groundTile(th, false, false, false, (i * 3 + Math.floor(camX / TILE)) & 3), x, VIEW_H - 16, TILE, TILE);
    }
    // Mønter
    for (let i = 0; i < 6; i++) {
      const x = ((i * 90 - camX * 1) % (viewW + 90) + viewW + 90) % (viewW + 90) - 45;
      ctx.drawImage(A.coinFrame(Math.floor(t * 8 + i) % 6), x, VIEW_H - 80 - (i % 3) * 22 + Math.sin(t * 3 + i) * 3, TILE, TILE);
    }
    // Figuren løber
    if (charId) {
      const pose = ['run0', 'run1', 'run2', 'run3'][Math.floor(t * 10) % 4];
      const s = SG.characters.frame(charId, pose, true, false).r;
      ctx.drawImage(s, Math.round(viewW * 0.66), VIEW_H - 32 - 32, 16, 32);
    }
    drawAmbient(th, t, camX);
    ctx.restore();
  }

  // Lille temabillede til verdenskortet
  function themePreview(c, themeId, fort) {
    const th = A.themeFor(themeId, fort);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const s = c.height / VIEW_H;
    g.setTransform(s, 0, 0, s, 0, 0);
    const w = c.width / s;
    g.drawImage(sky(th), 0, 0, 1, 288, 0, 0, w + 1, VIEW_H);
    const L = A.buildLayers(th);
    [L.far, L.mid, L.near].forEach(img => { for (let x = 0; x < w; x += A.BG_W) g.drawImage(img, x, 0, A.BG_W, A.BG_H); });
    for (let x = 0; x < w; x += TILE) {
      g.drawImage(A.groundTile(th, true, false, false, (x / TILE) & 3), x, VIEW_H - 32, TILE, TILE);
      g.drawImage(A.groundTile(th, false, false, false, (x / TILE + 1) & 3), x, VIEW_H - 16, TILE, TILE);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { init, resize, setBottomPad, draw, drawMenuScene, themePreview, black, get viewW() { return getViewW(); }, VIEW_H };
})();
