/* =====================================================================
 * GREJS TANKS - scenery.js
 * Painted-look scenery: garage hangar backdrop, display pedestal,
 * dusk skies, misty mountain ranges and framing foreground foliage.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const U = GT.U;
  const R = GT.Render;
  const TAU = Math.PI * 2;

  /* ================================================================
   * Garage
   * ================================================================ */
  /** steel display turntable with a cyan LED ring and a warm spotlight */
  R.drawPedestal = function (ctx, W, H, gy, t) {
    const rx = W * 0.4, ry = H * 0.07, th = H * 0.06;
    // spotlight cone from the ceiling lamp
    const cone = ctx.createLinearGradient(0, 0, 0, gy);
    cone.addColorStop(0, 'rgba(255,240,210,0)');
    cone.addColorStop(1, 'rgba(255,240,210,0.12)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(W / 2 - rx * 0.25, 0);
    ctx.lineTo(W / 2 + rx * 0.25, 0);
    ctx.lineTo(W / 2 + rx * 1.05, gy);
    ctx.lineTo(W / 2 - rx * 1.05, gy);
    ctx.closePath();
    ctx.fill();
    // cyan floor glow
    const fg = ctx.createRadialGradient(W / 2, gy + th, 2, W / 2, gy + th, rx * 1.3);
    fg.addColorStop(0, 'rgba(90,220,255,0.26)');
    fg.addColorStop(1, 'rgba(90,220,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(W / 2, gy + th, rx * 1.3, ry * 2.2, 0, 0, TAU);
    ctx.fill();
    // side band
    const sg = ctx.createLinearGradient(W / 2 - rx, 0, W / 2 + rx, 0);
    sg.addColorStop(0, '#1b1e23');
    sg.addColorStop(0.35, '#4a4f57');
    sg.addColorStop(0.55, '#5b616a');
    sg.addColorStop(1, '#16181c');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.ellipse(W / 2, gy + th, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(W / 2 - rx, gy);
    ctx.ellipse(W / 2, gy, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    // LED segments along the band
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(80,220,255,0.9)';
    ctx.shadowBlur = th * 0.7;
    ctx.lineWidth = Math.max(1.5, th * 0.2);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a0 = Math.PI * ((i + 0.2) / n), a1 = Math.PI * ((i + 0.8) / n);
      const pulse = 0.7 + 0.3 * Math.sin(t * 2 + i * 0.7);
      ctx.strokeStyle = 'rgba(120,235,255,' + 0.9 * pulse + ')';
      ctx.beginPath();
      ctx.ellipse(W / 2, gy + th * 0.5, rx * 0.995, ry, 0, a0, a1);
      ctx.stroke();
    }
    ctx.restore();
    // brushed steel top
    const tg = ctx.createRadialGradient(W / 2 - rx * 0.2, gy - ry * 0.4, 2, W / 2, gy, rx);
    tg.addColorStop(0, '#6d737c');
    tg.addColorStop(0.6, '#3c4148');
    tg.addColorStop(1, '#25282d');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.ellipse(W / 2, gy, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(1, W / 300);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    for (const k of [0.82, 0.55]) {
      ctx.beginPath();
      ctx.ellipse(W / 2, gy, rx * k, ry * k, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,235,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(W / 2, gy, rx * 0.86, ry * 0.86, 0, 0, TAU);
    ctx.stroke();
  };

  /** dark industrial hangar used behind the garage / weapons / tank select screens */
  R.garageBackdrop = function (W, H) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d');
    const r = U.rng(909);
    const floorY = H * 0.7;
    // back wall: corrugated steel in deep shadow
    const wg = c.createLinearGradient(0, 0, 0, floorY);
    wg.addColorStop(0, '#0b0d10');
    wg.addColorStop(0.5, '#1b1f25');
    wg.addColorStop(1, '#262a31');
    c.fillStyle = wg;
    c.fillRect(0, 0, W, floorY);
    for (let x = 0; x < W; x += 10) {
      c.fillStyle = 'rgba(255,255,255,' + (0.022 + 0.014 * Math.sin(x * 0.7)) + ')';
      c.fillRect(x, H * 0.16, 3, floorY - H * 0.16);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(x + 6, H * 0.16, 2, floorY - H * 0.16);
    }
    // big hangar windows letting in cold light
    for (let i = 0; i < 4; i++) {
      const x = W * (0.06 + i * 0.25), y = H * 0.22, w = W * 0.13, h = H * 0.24;
      const gg = c.createLinearGradient(0, y, 0, y + h);
      gg.addColorStop(0, 'rgba(120,150,190,0.2)');
      gg.addColorStop(1, 'rgba(60,80,110,0.06)');
      c.fillStyle = gg;
      c.fillRect(x, y, w, h);
      c.strokeStyle = 'rgba(0,0,0,0.65)';
      c.lineWidth = 5;
      c.strokeRect(x, y, w, h);
      c.lineWidth = 2;
      c.beginPath();
      for (let k = 1; k < 4; k++) {
        c.moveTo(x + (w * k) / 4, y);
        c.lineTo(x + (w * k) / 4, y + h);
      }
      c.moveTo(x, y + h / 2);
      c.lineTo(x + w, y + h / 2);
      c.stroke();
    }
    // steel columns
    for (let i = 0; i <= 4; i++) {
      const x = W * i * 0.25 - 24, w = 48;
      const g = c.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#15181c');
      g.addColorStop(0.4, '#3a3f47');
      g.addColorStop(1, '#111316');
      c.fillStyle = g;
      c.fillRect(x, 0, w, floorY);
      c.fillStyle = 'rgba(0,0,0,0.4)';
      for (let y = 30; y < floorY; y += 46) c.fillRect(x + 4, y, w - 8, 2);
      c.fillStyle = 'rgba(220,225,235,0.5)';
      for (let y = 34; y < floorY; y += 46) c.fillRect(x + 8, y, 2, 2), c.fillRect(x + w - 10, y, 2, 2);
    }
    // roof trusses
    const ty = H * 0.03, th = H * 0.09;
    c.strokeStyle = '#2b3036';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(0, ty);
    c.lineTo(W, ty);
    c.moveTo(0, ty + th);
    c.lineTo(W, ty + th);
    c.stroke();
    c.lineWidth = 4;
    c.beginPath();
    for (let x = 0; x < W; x += th) {
      c.moveTo(x, ty);
      c.lineTo(x + th, ty + th);
      c.moveTo(x + th, ty);
      c.lineTo(x, ty + th);
    }
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, ty - 3);
    c.lineTo(W, ty - 3);
    c.stroke();
    // concrete floor
    const fg = c.createLinearGradient(0, floorY, 0, H);
    fg.addColorStop(0, '#2c2f34');
    fg.addColorStop(1, '#131417');
    c.fillStyle = fg;
    c.fillRect(0, floorY, W, H - floorY);
    for (let i = 0; i < 3000; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.04)';
      c.fillRect(r() * W, floorY + r() * (H - floorY), r.range(1, 3), r.range(1, 2));
    }
    // floor joints in perspective
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.lineWidth = 2;
    c.beginPath();
    for (let k = -7; k <= 7; k++) {
      c.moveTo(W / 2 + k * W * 0.07, floorY);
      c.lineTo(W / 2 + k * W * 0.3, H);
    }
    c.moveTo(0, floorY + (H - floorY) * 0.35);
    c.lineTo(W, floorY + (H - floorY) * 0.35);
    c.stroke();
    // oil stains / wet patches
    for (let i = 0; i < 10; i++) {
      const x = r() * W, y = floorY + r.range(0.15, 0.9) * (H - floorY), rx = r.range(30, 130);
      const g = c.createRadialGradient(x, y, 2, x, y, rx);
      g.addColorStop(0, 'rgba(4,5,7,0.5)');
      g.addColorStop(1, 'rgba(4,5,7,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, rx, rx * 0.25, 0, 0, TAU);
      c.fill();
    }
    // hazard stripes at the wall base
    c.save();
    c.beginPath();
    c.rect(0, floorY - 10, W, 10);
    c.clip();
    c.fillStyle = '#b8901c';
    c.fillRect(0, floorY - 10, W, 10);
    c.fillStyle = '#17181b';
    for (let x = -20; x < W; x += 28) {
      c.beginPath();
      c.moveTo(x, floorY);
      c.lineTo(x + 14, floorY - 10);
      c.lineTo(x + 28, floorY - 10);
      c.lineTo(x + 14, floorY);
      c.fill();
    }
    c.restore();
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(0, floorY, W, 4);
    // hanging industrial lamps with light cones
    for (let i = 0; i < 5; i++) {
      const x = W * (0.1 + i * 0.2), y = H * (0.14 + (i % 2) * 0.04);
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = '#08090b';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, y - 12);
      c.stroke();
      c.fillStyle = '#2a2e34';
      c.beginPath();
      c.moveTo(x - 6, y - 14);
      c.lineTo(x + 6, y - 14);
      c.lineTo(x + 22, y);
      c.lineTo(x - 22, y);
      c.closePath();
      c.fill();
      c.globalCompositeOperation = 'lighter';
      const lg = c.createLinearGradient(0, y, 0, floorY + 60);
      lg.addColorStop(0, 'rgba(255,235,200,0.17)');
      lg.addColorStop(1, 'rgba(255,235,200,0)');
      c.fillStyle = lg;
      c.beginPath();
      c.moveTo(x - 18, y);
      c.lineTo(x + 18, y);
      c.lineTo(x + 180, floorY + 60);
      c.lineTo(x - 180, floorY + 60);
      c.closePath();
      c.fill();
      const bg = c.createRadialGradient(x, y + 2, 0, x, y + 2, 36);
      bg.addColorStop(0, 'rgba(255,248,225,1)');
      bg.addColorStop(0.25, 'rgba(255,230,180,0.55)');
      bg.addColorStop(1, 'rgba(255,220,160,0)');
      c.fillStyle = bg;
      c.fillRect(x - 36, y - 34, 72, 72);
      const pg = c.createRadialGradient(x, floorY + 40, 0, x, floorY + 40, 170);
      pg.addColorStop(0, 'rgba(255,230,190,0.09)');
      pg.addColorStop(1, 'rgba(255,230,190,0)');
      c.fillStyle = pg;
      c.beginPath();
      c.ellipse(x, floorY + 40, 170, 42, 0, 0, TAU);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    // vignette
    const vg = c.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, W * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
    return cv;
  };

  /* ================================================================
   * World art direction: painted skies + misty mountain ranges.
   * Applied on top of worlds.js so gameplay data stays untouched.
   *  sky   colour bands top -> horizon     fog  colour of the haze/mist
   *  rim   rgb of the light on ridgelines  fg   foreground foliage kind
   *  ranges: far -> near {color, base (0..1 of H), amp, per, factor,
   *          jagged, trees, ts, kind, mist, haze, fogK, rim}
   * ================================================================ */
  const ART = {
    1: { // Green Valley - golden late afternoon
      sky: ['#2c5a9c', '#5b8fcf', '#9fc3e3', '#f3dcae'], fog: '#cfdde3', rim: '255,236,190', fg: 'forest',
      tint: [1, 0.96, 0.9], deep: 0.45, terrain: { top: '#4f9a45', top2: '#86c25a', soil: ['#6e4a2e', '#523621', '#33221a'] },
      sun: { color: '#fff1c4', x: 0.78, y: 0.3, r: 52, noRays: true, band: 0.35 },
      ranges: [
        { color: '#7d98bf', base: 0.4, amp: 170, per: 300, factor: 0.06, jagged: true, fogK: 0.5, haze: 0.45, rim: 0.3, snow: true },
        { color: '#5f8794', base: 0.47, amp: 110, per: 260, factor: 0.14, fogK: 0.4, haze: 0.4, trees: [16, 38], ts: 0.7, mist: 0.35 },
        { color: '#46704f', base: 0.54, amp: 80, per: 210, factor: 0.26, fogK: 0.3, haze: 0.3, trees: [12, 30], ts: 1, mist: 0.28 },
        { color: '#2f5636', base: 0.61, amp: 50, per: 170, factor: 0.42, fogK: 0.2, haze: 0.2, trees: [10, 24], ts: 1.4, mist: 0.2 }
      ]
    },
    2: { // Desert War - burning dusk over the mesas
      sky: ['#2e2d63', '#6a4b80', '#c66f6a', '#f6b26e'], fog: '#e8a07a', rim: '255,200,140', stars: true,
      tint: [1, 0.86, 0.8],
      sun: { color: '#ffc47a', x: 0.24, y: 0.42, r: 70, noRays: true, band: 0.5, flat: true },
      ranges: [
        { color: '#a26a78', base: 0.42, amp: 150, per: 420, factor: 0.06, fogK: 0.5, haze: 0.45, rim: 0.3 },
        { color: '#a46a58', base: 0.5, amp: 90, per: 300, factor: 0.15, fogK: 0.4, haze: 0.35, trees: [40, 120], ts: 0.8, mist: 0.25 },
        { color: '#7d4f3c', base: 0.58, amp: 60, per: 220, factor: 0.3, fogK: 0.25, haze: 0.25, trees: [30, 90], ts: 1.2, mist: 0.2 }
      ]
    },
    4: { // Frozen Lands - pink polar twilight
      sky: ['#222c56', '#4a63a0', '#a3b4d8', '#f3d3dc'], fog: '#d9e2f1', rim: '255,225,235', stars: true, fg: 'pine',
      tint: [0.93, 0.92, 1],
      sun: { color: '#fff1ea', x: 0.3, y: 0.36, r: 44, noRays: true, band: 0.4 },
      ranges: [
        { color: '#a2b2d2', base: 0.4, amp: 190, per: 280, factor: 0.06, jagged: true, snow: true, fogK: 0.45, haze: 0.45, rim: 0.4 },
        { color: '#7f93ba', base: 0.48, amp: 120, per: 240, factor: 0.15, jagged: true, snow: true, fogK: 0.35, haze: 0.4, trees: [14, 34], ts: 0.7, mist: 0.35 },
        { color: '#5b7097', base: 0.56, amp: 70, per: 200, factor: 0.28, fogK: 0.25, haze: 0.3, trees: [10, 26], ts: 1.1, mist: 0.25 }
      ]
    },
    5: { // Jungle - purple dusk, misty peaks, low orange sun
      sky: ['#1d1a3c', '#3a2f66', '#6e4a82', '#c8707e', '#f4a466'], fog: '#c08aa2', rim: '255,180,130', stars: true, fg: 'jungle',
      clouds: '#c88e9e', tint: [0.84, 0.8, 0.96], deep: 0.5,
      terrain: { top: '#3d7a3c', top2: '#6fa04a', soil: ['#56392a', '#3a271c', '#21160f'] },
      sun: { color: '#ff9d5c', x: 0.8, y: 0.42, r: 64, noRays: true, band: 0.45, flat: true },
      ranges: [
        { color: '#77679f', base: 0.4, amp: 200, per: 260, factor: 0.06, jagged: true, fogK: 0.5, haze: 0.5, rim: 0.3 },
        { color: '#544f80', base: 0.47, amp: 130, per: 220, factor: 0.14, jagged: true, fogK: 0.4, haze: 0.45, trees: [16, 36], ts: 0.75, kind: 'palm', mist: 0.4 },
        { color: '#36405c', base: 0.54, amp: 80, per: 190, factor: 0.26, fogK: 0.3, haze: 0.35, trees: [12, 28], ts: 1.05, kind: 'palm', mist: 0.32 },
        { color: '#1f3333', base: 0.61, amp: 50, per: 150, factor: 0.42, fogK: 0.2, haze: 0.22, trees: [9, 22], ts: 1.45, kind: 'palm', mist: 0.22 }
      ]
    },
    6: { // Wasteland - dusty amber haze
      sky: ['#2f2a2c', '#5a4a44', '#9c7a5c', '#dcb27e'], fog: '#c4a07a', rim: '255,215,160',
      tint: [1, 0.92, 0.82],
      sun: { color: '#ffd8a0', x: 0.2, y: 0.34, r: 58, noRays: true, band: 0.4 },
      ranges: [
        { color: '#8a7462', base: 0.42, amp: 140, per: 380, factor: 0.06, jagged: true, fogK: 0.5, haze: 0.45 },
        { color: '#6a5848', base: 0.5, amp: 80, per: 260, factor: 0.16, fogK: 0.35, haze: 0.35, trees: [30, 90], ts: 0.9, mist: 0.3 },
        { color: '#4c4034', base: 0.58, amp: 50, per: 200, factor: 0.3, fogK: 0.25, haze: 0.25, trees: [24, 70], ts: 1.2, mist: 0.2 }
      ]
    },
    12: { fg: 'forest' },
    13: { fg: 'jungle' },
    15: { fg: 'jungle' },
    19: { fg: 'pine' }
  };
  for (const id in ART) {
    const w = GT.Worlds && GT.Worlds.get(+id);
    if (!w) continue;
    const a = ART[id];
    w.art = a;
    if (a.sun) w.sun = Object.assign({}, w.sun, a.sun);
    if (a.clouds) w.clouds = a.clouds;
    if (a.terrain) w.terrain = Object.assign({}, w.terrain, a.terrain);
  }

  /* ================================================================
   * Foreground foliage framing the battlefield (screen space)
   * ================================================================ */
  const FG = {
    jungle: { dark: '#0c1a14', mid: '#183224', light: '#2c5232', rim: '#e39a66', trunk: '#231b14', fronds: true, vines: true },
    forest: { dark: '#10220f', mid: '#20401f', light: '#3d6a32', rim: '#ffe2a0', trunk: '#2a2016', fronds: false, vines: false },
    pine: { dark: '#0e1a22', mid: '#1c2e3a', light: '#2e4656', rim: '#ffffff', trunk: '#20180f', pine: true }
  };
  const FW = 440, FH = 900;

  function broadLeaf(c, x, y, ang, len, wid, P, k) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    const g = c.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, P.dark);
    g.addColorStop(1, k > 0.6 ? P.light : P.mid);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(len * 0.25, -wid, len * 0.72, -wid * 0.95, len, 0);
    c.bezierCurveTo(len * 0.72, wid * 0.75, len * 0.25, wid * 0.85, 0, 0);
    c.fill();
    // sunset rim on the upper edge
    c.strokeStyle = U.rgba(P.rim, 0.22 * k);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(len * 0.1, -wid * 0.35);
    c.bezierCurveTo(len * 0.3, -wid * 0.95, len * 0.7, -wid * 0.9, len * 0.97, -wid * 0.04);
    c.stroke();
    // veins
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.5, -wid * 0.08, len, 0);
    for (let i = 1; i < 9; i++) {
      const px = (len * i) / 9;
      c.moveTo(px, 0);
      c.lineTo(px + len * 0.06, -wid * 0.7 * Math.sin((Math.PI * i) / 9));
      c.moveTo(px, 0);
      c.lineTo(px + len * 0.06, wid * 0.6 * Math.sin((Math.PI * i) / 9));
    }
    c.stroke();
    c.restore();
  }

  function frond(c, x, y, ang, len, P, r) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const pt = (t) => [x + dx * len * t, y + dy * len * t + len * 0.45 * t * t];
    c.strokeStyle = P.dark;
    c.lineCap = 'round';
    c.lineWidth = len * 0.016;
    c.beginPath();
    for (let t = 0; t <= 1.001; t += 0.05) {
      const [px, py] = pt(t);
      t ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.stroke();
    for (let t = 0.06; t < 0.98; t += 0.032) {
      const [px, py] = pt(t), [qx, qy] = pt(t + 0.01);
      const ta = Math.atan2(qy - py, qx - px);
      for (const side of [-1, 1]) {
        let la = ta + side * (0.85 + 0.25 * t);
        la += (Math.PI / 2 - la) * 0.3; // leaflets droop under their weight
        const L = len * 0.3 * (1 - t * 0.65) * r.range(0.85, 1.15);
        const w = L * 0.1;
        const ex = px + Math.cos(la) * L, ey = py + Math.sin(la) * L;
        const nx = -Math.sin(la) * w, ny = Math.cos(la) * w;
        c.fillStyle = r() < 0.25 ? P.light : r() < 0.5 ? P.mid : P.dark;
        c.beginPath();
        c.moveTo(px, py);
        c.quadraticCurveTo((px + ex) / 2 + nx, (py + ey) / 2 + ny, ex, ey);
        c.quadraticCurveTo((px + ex) / 2 - nx, (py + ey) / 2 - ny, px, py);
        c.fill();
      }
    }
  }

  function pineBranch(c, x, y, len, P, r) {
    c.strokeStyle = P.trunk;
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + len * 0.5, y + len * 0.05, x + len, y + len * 0.14);
    c.stroke();
    for (let t = 0.05; t < 1; t += 0.02) {
      const px = x + len * t, py = y + len * 0.14 * t * t;
      const L = 40 * (1 - t * 0.6);
      c.strokeStyle = r() < 0.3 ? P.light : r() < 0.6 ? P.mid : P.dark;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + L * 0.5, py + L * 0.8);
      c.moveTo(px, py);
      c.lineTo(px + L * 0.4, py - L * 0.5);
      c.stroke();
    }
    // snow resting on top
    c.fillStyle = 'rgba(240,246,255,0.92)';
    c.beginPath();
    for (let t = 0.04; t < 0.95; t += 0.06) {
      const px = x + len * t, py = y + len * 0.14 * t * t - 10;
      c.ellipse(px, py, 22 * (1 - t * 0.5), 6, 0.1, 0, TAU);
    }
    c.fill();
  }

  /** one side of the frame, drawn for the LEFT edge (mirrored for the right) */
  function buildFgSide(kind, seed) {
    const P = FG[kind];
    const cv = document.createElement('canvas');
    cv.width = FW;
    cv.height = FH;
    const c = cv.getContext('2d');
    const r = U.rng(seed);
    // tree trunk hugging the screen edge
    const tw = r.range(70, 100);
    const tg = c.createLinearGradient(0, 0, tw + 20, 0);
    tg.addColorStop(0, '#000000');
    tg.addColorStop(0.6, P.trunk);
    tg.addColorStop(1, U.shade(P.trunk, 0.18));
    c.fillStyle = tg;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(tw * 0.8, 0);
    c.bezierCurveTo(tw, FH * 0.3, tw * 0.75, FH * 0.6, tw + 40, FH);
    c.lineTo(0, FH);
    c.closePath();
    c.fill();
    // bark grooves + moss
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const x0 = r.range(8, tw * 0.75);
      c.beginPath();
      c.moveTo(x0, r.range(0, FH));
      c.lineTo(x0 + r.range(-6, 6), r.range(0, FH));
      c.stroke();
    }
    c.fillStyle = U.rgba(P.light, 0.45);
    for (let i = 0; i < 40; i++) {
      c.beginPath();
      c.ellipse(r.range(tw * 0.4, tw * 0.95), r.range(0, FH), r.range(3, 9), r.range(6, 18), 0, 0, TAU);
      c.fill();
    }
    if (P.pine) {
      for (let i = 0; i < 6; i++) pineBranch(c, tw * 0.7, r.range(-20, FH * 0.55), r.range(160, 300), P, r);
    }
    // hanging vines
    if (P.vines) {
      c.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const x0 = r.range(tw * 0.6, FW * 0.7), L = r.range(FH * 0.2, FH * 0.6);
        c.strokeStyle = P.dark;
        c.lineWidth = r.range(2, 4);
        c.beginPath();
        c.moveTo(x0, 0);
        c.bezierCurveTo(x0 + r.range(-40, 40), L * 0.4, x0 + r.range(-30, 30), L * 0.7, x0 + r.range(-20, 20), L);
        c.stroke();
        for (let y = 20; y < L; y += r.range(18, 34)) {
          const k = y / L;
          const vx = x0 + Math.sin(k * 3 + i) * 12;
          broadLeaf(c, vx, y, r() < 0.5 ? r.range(0.3, 1) : r.range(2.1, 2.8), r.range(18, 30), r.range(6, 9), P, r());
        }
      }
    }
    // canopy fronds from the top corner
    if (P.fronds) {
      for (let i = 0; i < 6; i++) frond(c, r.range(10, 60), r.range(-30, 60), r.range(-0.15, 0.9), r.range(260, 400), P, r);
    } else if (!P.pine) {
      for (let i = 0; i < 26; i++) broadLeaf(c, r.range(0, 220), r.range(-20, 140), r.range(0, 1.4), r.range(70, 130), r.range(22, 34), P, r());
    }
    // undergrowth: big leaves rising from the bottom corner
    if (!P.pine) {
      for (let i = 0; i < 14; i++) {
        const a = -r.range(0.25, 1.35);
        broadLeaf(c, r.range(-20, 140), FH + r.range(0, 30), a, r.range(170, 300), r.range(40, 66), P, r());
      }
      if (P.fronds) for (let i = 0; i < 3; i++) frond(c, r.range(0, 80), FH - r.range(80, 160), -r.range(0.6, 1.1), r.range(200, 280), P, r);
    } else {
      // snowy rocks
      c.fillStyle = P.mid;
      c.beginPath();
      c.ellipse(60, FH, 200, 90, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = 'rgba(240,246,255,0.95)';
      c.beginPath();
      c.ellipse(70, FH - 70, 150, 26, -0.1, Math.PI, 0);
      c.fill();
    }
    // a few glowing plants at the base (bioluminescent jungle)
    if (P.vines) {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x = r.range(40, 150), y = FH - r.range(60, 180);
        const g = c.createRadialGradient(x, y, 0, x, y, 26);
        g.addColorStop(0, 'rgba(255,170,90,0.9)');
        g.addColorStop(0.3, 'rgba(255,120,60,0.35)');
        g.addColorStop(1, 'rgba(255,120,60,0)');
        c.fillStyle = g;
        c.fillRect(x - 26, y - 26, 52, 52);
      }
      c.globalCompositeOperation = 'source-over';
    }
    return cv;
  }

  const fgCache = {};
  R.foreground = function (world) {
    const kind = world.art && world.art.fg;
    if (!kind || !FG[kind]) return null;
    if (!fgCache[kind]) fgCache[kind] = { left: buildFgSide(kind, 101), right: buildFgSide(kind, 202) };
    return fgCache[kind];
  };

  /** draw the frame in screen space; parallax a little faster than the world */
  R.drawForeground = function (ctx, world, cw, ch, camX, t) {
    // portrait phones keep the ground mid-screen: a frame would cover the tanks
    if (ch > cw * 1.1) return;
    const fg = R.foreground(world);
    if (!fg) return;
    const sc = Math.min(ch, cw * 1.05) / FH;
    const w = FW * sc, h = FH * sc;
    const px = U.clamp(-(camX || 0) * 0.02, -30, 30);
    const sway = Math.sin(t * 0.7) * 0.008;
    ctx.save();
    ctx.translate(-w * 0.12 + px, ch);
    ctx.rotate(sway);
    ctx.drawImage(fg.left, 0, -h, w, h);
    ctx.restore();
    ctx.save();
    ctx.translate(cw + w * 0.12 + px, ch);
    ctx.scale(-1, 1);
    ctx.rotate(-sway * 0.8);
    ctx.drawImage(fg.right, 0, -h, w, h);
    ctx.restore();
  };

  /** set the hangar image as a CSS variable once (used by several screens) */
  R.applyGarageBackdrop = function () {
    if (R._garageBgDone) return;
    R._garageBgDone = true;
    try {
      const url = R.garageBackdrop(1600, 900).toDataURL('image/jpeg', 0.82);
      document.documentElement.style.setProperty('--hangar', `url(${url})`);
    } catch (e) {
      /* canvas unavailable: CSS fallback colour stays */
    }
  };
})();
