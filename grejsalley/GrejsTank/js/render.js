/* =====================================================================
 * GREJS TANKS - render.js
 * All procedural vector art: tanks (chassis / turret / barrel / tracks
 * / decorations), projectiles, world decorations, skies, parallax
 * backgrounds and world thumbnails. No image files required.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const U = GT.U;
  let OUT = '#1d1a26';
  const OUT_INK = '#1d1a26', OUT_TANK = 'rgba(16,14,12,0.62)';
  const TAU = Math.PI * 2;

  const R = (GT.Render = {});

  /* ---------- geometry tables ---------- */
  const PIVOT_Y = { box: -26, wedge: -27, round: -25, long: -25, hex: -26, heavy: -30, low: -21 };
  const BARREL_LEN = { single: 32, thick: 29, long: 42, double: 30, pod: 22, dish: 24, short: 20, rail: 36, coil: 30, drill: 31 };
  R.PIVOT_Y = PIVOT_Y;
  R.BARREL_LEN = BARREL_LEN;

  /** local muzzle offset: returns world position of the muzzle */
  R.muzzle = function (tank, aimDeg) {
    const v = tank.vis, s = tank.scale;
    const py = (PIVOT_Y[v.chassis] || -26) - 5 + (v.move === 'hover' ? -7 : 0);
    const ct = Math.cos(tank.tilt), st = Math.sin(tank.tilt);
    const px = tank.x + (0 * ct - py * st) * s;
    const pyw = tank.y + (0 * st + py * ct) * s;
    const a = U.rad(aimDeg);
    const L = (BARREL_LEN[v.barrel] || 30) * s;
    return { x: px + Math.cos(a) * L, y: pyw - Math.sin(a) * L, px, py: pyw };
  };

  let FL = 0; // current flash amount while drawing a tank
  // GRADE: while a tank is drawn every colour is pulled toward a muted,
  // olive-grey military palette (keeps the hue, loses the toy saturation)
  let GRADE = 0;
  const gradeCache = {};
  function grade(c) {
    if (typeof c !== 'string' || c[0] !== '#') return c;
    let v = gradeCache[c];
    if (v === undefined) {
      const [r, g, b] = U.hexToRgb(c);
      const l = r * 0.3 + g * 0.59 + b * 0.11, k = 0.52, d = 0.88;
      v = gradeCache[c] = U.rgbToHex((r + (l * 1.03 - r) * k) * d, (g + (l * 1.0 - g) * k) * d, (b + (l * 0.84 - b) * k) * d);
    }
    return v;
  }
  const col = (c) => {
    if (GRADE) c = grade(c);
    return FL > 0 ? U.mix(c, '#ffffff', FL) : c;
  };
  // U.shade / U.mix parse strings, so cache them - they run many times per frame
  const shadeCache = {};
  function sh(c, k) {
    const key = c + '|' + k;
    let v = shadeCache[key];
    if (v === undefined) v = shadeCache[key] = U.shade(c, k);
    return v;
  }
  const mixCache = {};
  function mx(a, b, k) {
    const key = a + b + k;
    let v = mixCache[key];
    if (v === undefined) v = mixCache[key] = U.mix(a, b, k);
    return v;
  }
  const C = (c, k) => col(k ? sh(c, k) : c);

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  R.rrect = rrect;
  function fillStroke(ctx, fill, lw) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw || 1.5;
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }
  /** rolled-steel plate: bright top edge, body colour, dark underside */
  function metal(ctx, y0, y1, c) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, C(c, 0.5));
    g.addColorStop(0.14, C(c, 0.2));
    g.addColorStop(0.45, C(c));
    g.addColorStop(0.82, C(c, -0.24));
    g.addColorStop(1, C(c, -0.45));
    return g;
  }
  /** cylinder shading across local y (barrels, tubes, shells) */
  function cyl(ctx, r, c, y) {
    y = y || 0;
    const g = ctx.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, C(c, -0.3));
    g.addColorStop(0.2, C(c, 0.55));
    g.addColorStop(0.42, C(c, 0.12));
    g.addColorStop(0.78, C(c, -0.28));
    g.addColorStop(1, C(c, -0.6));
    return g;
  }
  function bolt(ctx, x, y, r) {
    r = r || 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(x + 0.25, y + 0.3, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col('#dedad2');
    ctx.beginPath();
    ctx.arc(x - 0.1, y - 0.1, r * 0.7, 0, TAU);
    ctx.fill();
  }
  /** engraved panel line: dark groove with a lit lower lip */
  function seam(ctx, x0, y0, x1, y1) {
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(x0 + 0.7, y0 + 0.5);
    ctx.lineTo(x1 + 0.7, y1 + 0.5);
    ctx.stroke();
  }
  /** inner bevel: lit top edges, shadowed lower edges (shape() rebuilds the path) */
  function bevel(ctx, shape, lw) {
    ctx.lineWidth = lw || 1.4;
    ctx.save();
    ctx.translate(0, 1.1);
    shape();
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(0, -1.1);
    shape();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- per-tank weathering (seeded, cached) ---------- */
  const wearCache = {};
  function wearOf(v) {
    const key = v.body + v.accent + v.chassis + v.turret;
    if (wearCache[key]) return wearCache[key];
    const r = U.rng(U.hashStr(key));
    const w = { scratch: [], chips: [], mud: [], scorch: [], camo: [] };
    for (let i = 0; i < 7; i++) {
      const x = r.range(-24, 22), y = r.range(-24, -14), a = r.range(-0.5, 0.5), l = r.range(2, 5);
      w.scratch.push([x, y, x + Math.cos(a) * l, y + Math.sin(a) * l]);
    }
    for (let i = 0; i < 4; i++) w.chips.push([r.range(-24, 24), r.range(-25, -13), r.range(0.35, 0.8), r.range(0, 3)]);
    for (let i = 0; i < 9; i++) w.mud.push([r.range(-26, 26), r.range(-1.6, -0.6), r.range(1.5, 3.5), r.range(0.6, 1.1)]);
    for (let i = 0; i < 5; i++) w.scorch.push([r.range(-20, 20), r.range(-24, -14), r.range(3, 5.5)]);
    for (let i = 0; i < 4; i++) w.camo.push([r.range(-24, 22), r.range(-24, -15), r.range(4, 8), r.range(2, 3.5), r.range(-0.4, 0.4)]);
    return (wearCache[key] = w);
  }

  /* ---------- running gear ---------- */
  const WHEELS = { heavy: 6, long: 6, low: 4 };
  function roadWheel(ctx, x, y, r, ph) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = C('#1f1e24');
    ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0.2, x, y, r * 0.85);
    g.addColorStop(0, C('#c4c1cc'));
    g.addColorStop(0.55, C('#74717e'));
    g.addColorStop(1, C('#383640'));
    ctx.beginPath();
    ctx.arc(x, y, r * 0.78, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.52, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = C('#3f3d47');
    ctx.beginPath();
    ctx.arc(x, y, r * 0.27, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C('#dcd9e2');
    const a0 = ph / (0.6 * r);
    for (let k = 0; k < 5; k++) {
      const a = a0 + (k * TAU) / 5;
      ctx.fillRect(x + Math.cos(a) * r * 0.42 - 0.35, y + Math.sin(a) * r * 0.42 - 0.35, 0.7, 0.7);
    }
  }
  function sprocket(ctx, x, y, r, ph) {
    const a0 = ph / (0.6 * r);
    ctx.beginPath();
    for (let k = 0; k < 22; k++) {
      const a = a0 + (k * TAU) / 22;
      const rr = k % 2 ? r : r * 0.8;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = C('#4b4954');
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.2, x, y, r * 0.7);
    g.addColorStop(0, C('#b9b6c2'));
    g.addColorStop(1, C('#4a4853'));
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = C('#2a2930');
    for (let k = 0; k < 6; k++) {
      const a = a0 + (k * TAU) / 6;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.38, y + Math.sin(a) * r * 0.38, r * 0.1, 0, TAU);
      ctx.fill();
    }
  }
  function drawTracks(ctx, v, o) {
    const ph = o.phase || 0;
    const n = WHEELS[v.chassis] || 5;
    const sp = v.chassis === 'long' || v.chassis === 'heavy' ? 27 : 25;
    const belt = () => {
      ctx.beginPath();
      ctx.moveTo(-sp + 2, 0);
      ctx.lineTo(sp - 2, 0);
      ctx.quadraticCurveTo(sp + 5.5, -0.5, sp + 5.5, -7.5);
      ctx.quadraticCurveTo(sp + 4.5, -14, sp - 1, -14);
      ctx.lineTo(-sp + 1, -14);
      ctx.quadraticCurveTo(-sp - 4.5, -14, -sp - 5.5, -7.5);
      ctx.quadraticCurveTo(-sp - 5.5, -0.5, -sp + 2, 0);
      ctx.closePath();
    };
    belt();
    const bg = ctx.createLinearGradient(0, -14, 0, 0);
    bg.addColorStop(0, C('#4a4851'));
    bg.addColorStop(0.5, C('#2b2a30'));
    bg.addColorStop(1, C('#1d1c21'));
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    // inner cavity the wheels run in
    rrect(ctx, -sp - 2.5, -11.6, sp * 2 + 5, 9.8, 4.8);
    ctx.fillStyle = C('#141318');
    ctx.fill();
    // individual track links on the lower and upper run
    const off = ((ph % 4) + 4) % 4;
    ctx.fillStyle = C('#5b5964');
    for (let x = -sp + off; x < sp - 1; x += 4) ctx.fillRect(x, -1.7, 2.4, 1.6);
    for (let x = -sp + (4 - off); x < sp - 1; x += 4) ctx.fillRect(x, -13.6, 2.4, 1.5);
    ctx.fillStyle = C('#9a97a4');
    for (let x = -sp + off; x < sp - 1; x += 4) ctx.fillRect(x + 0.7, -1.9, 1, 0.5);
    for (let x = -sp + (4 - off); x < sp - 1; x += 4) ctx.fillRect(x + 0.7, -13.7, 1, 0.5);
    // return rollers
    ctx.fillStyle = C('#56545f');
    for (const x of [-sp * 0.5, 0, sp * 0.5]) {
      ctx.beginPath();
      ctx.arc(x, -11.4, 1.4, 0, TAU);
      ctx.fill();
    }
    // road wheels, drive sprocket (rear) and idler (front)
    const step = (sp * 2 - 10) / (n - 1);
    for (let i = 0; i < n; i++) roadWheel(ctx, -sp + 5 + i * step, -5.4, 4.5, ph);
    sprocket(ctx, -sp - 0.5, -7.6, 4, ph);
    roadWheel(ctx, sp + 1, -7.6, 3.9, ph);
    // dust film on the lower wheel rims
    const dg = ctx.createLinearGradient(0, -6, 0, 0);
    dg.addColorStop(0, 'rgba(120,96,64,0)');
    dg.addColorStop(1, 'rgba(120,96,64,0.35)');
    ctx.fillStyle = dg;
    ctx.fillRect(-sp - 2, -6, sp * 2 + 4, 4.5);
    // caked mud
    ctx.fillStyle = 'rgba(110,86,56,0.6)';
    for (const [x, y, rx, ry] of wearOf(v).mud) {
      if (Math.abs(x) > sp + 3) continue;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
      ctx.fill();
    }
  }
  function drawWheels(ctx, v, o) {
    const big = v.move === 'bigwheels';
    const r = big ? 9.5 : 8;
    const xs = big ? [-19, 0, 19] : [-18, 18];
    const ph = o.phase || 0;
    rrect(ctx, -25, -15, 50, 6, 3);
    ctx.fillStyle = C('#2a2930');
    ctx.fill();
    for (const x of xs) {
      const cy = -r + 0.5;
      ctx.strokeStyle = C('#3d3b45');
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x * 0.6, -13);
      ctx.stroke();
      // tyre with rolling tread blocks
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, TAU);
      ctx.fillStyle = C('#232228');
      ctx.fill();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      const a0 = ph / (0.6 * r);
      ctx.strokeStyle = C('#4a4852');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = a0 + (k * TAU) / 16;
        ctx.moveTo(x + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
        ctx.lineTo(x + Math.cos(a) * (r - 0.4), cy + Math.sin(a) * (r - 0.4));
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.8, Math.PI * 1.05, Math.PI * 1.6);
      ctx.stroke();
      // rim
      const g = ctx.createRadialGradient(x - r * 0.25, cy - r * 0.3, 0.3, x, cy, r * 0.6);
      g.addColorStop(0, C('#d4d1da'));
      g.addColorStop(0.6, C('#8a8794'));
      g.addColorStop(1, C('#4a4853'));
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.56, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = C('#3a3842');
      for (let k = 0; k < 5; k++) {
        const a = a0 + (k * TAU) / 5;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32, r * 0.08, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.14, 0, TAU);
      ctx.fillStyle = C('#e2dfe8');
      ctx.fill();
      // mudguard
      ctx.lineCap = 'round';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, cy, r + 2.4, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      ctx.strokeStyle = C(v.body, -0.18);
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x, cy, r + 3, Math.PI * 1.15, Math.PI * 1.5);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }
  function drawHover(ctx, v, o) {
    const t = o.t || 0;
    for (const x of [-16, 16]) {
      const fl = 0.85 + 0.15 * Math.sin(t * 23 + x);
      const g = ctx.createRadialGradient(x, -2, 1, x, -2, 16);
      g.addColorStop(0, 'rgba(230,255,255,' + 0.95 * fl + ')');
      g.addColorStop(0.35, 'rgba(120,230,255,' + 0.55 * fl + ')');
      g.addColorStop(1, 'rgba(60,170,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, -1 + Math.sin(t * 8 + x) * 1, 16, 6.5, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190,250,255,0.45)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = -2; k <= 2; k++) {
        const xx = x + k * 3;
        ctx.moveTo(xx, -4);
        ctx.lineTo(xx + Math.sin(t * 30 + k) * 0.8, 1 + ((t * 40 + k * 7) % 4));
      }
      ctx.stroke();
      const hp = () => rrect(ctx, x - 10, -11.5, 20, 7.5, 3.5);
      hp();
      ctx.fillStyle = metal(ctx, -11.5, -4, '#4a4858');
      ctx.fill();
      ctx.save();
      hp();
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x - 6 + k * 3.4, -8.5, 1.6, 3.5);
      ctx.fillStyle = 'rgba(140,240,255,0.7)';
      ctx.fillRect(x - 9, -5.4, 18, 1);
      ctx.restore();
      hp();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = OUT;
      ctx.stroke();
    }
  }
  function drawMove(ctx, v, o) {
    if (v.move === 'wheels' || v.move === 'bigwheels') return drawWheels(ctx, v, o);
    if (v.move === 'hover') return drawHover(ctx, v, o);
    drawTracks(ctx, v, o);
  }

  /* ---------- hull ---------- */
  const HULL = {
    box: [-27, -11, -27, -22, -23, -27, 20, -27, 28, -20, 28, -11],
    wedge: [-27, -11, -26, -24, -10, -28, 14, -28, 30, -16, 28, -11],
    long: [-31, -11, -31, -24, -28, -26, 26, -26, 32, -18, 31, -11],
    hex: [-29, -11, -25, -26, 24, -26, 29, -11],
    heavy: [-30, -10, -30, -27, -22, -31, 21, -31, 31, -23, 31, -10],
    low: [-29, -11, -27, -19, -19, -22, 21, -22, 31, -14, 29, -11]
  };
  const HX = { box: [-27, 28, -27], wedge: [-27, 30, -28], long: [-31, 32, -26], hex: [-29, 29, -26], heavy: [-30, 31, -31], low: [-29, 31, -22], round: [-28, 28, -26] };
  function hullPath(ctx, v) {
    const p = HULL[v.chassis];
    if (p) return poly(ctx, p);
    ctx.beginPath();
    ctx.moveTo(-28, -11);
    ctx.bezierCurveTo(-31, -31, 31, -31, 28, -11);
    ctx.closePath();
  }
  function scorchMarks(ctx, v, dmg) {
    if (!(dmg > 0.2)) return;
    const n = Math.min(5, Math.ceil((dmg - 0.2) * 7));
    const sc = wearOf(v).scorch;
    for (let i = 0; i < n; i++) {
      const [x, y, r] = sc[i];
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
      g.addColorStop(0, 'rgba(18,12,8,0.85)');
      g.addColorStop(0.45, 'rgba(30,20,12,0.5)');
      g.addColorStop(1, 'rgba(30,20,12,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.6, 0, TAU);
      ctx.fill();
      // torn bare metal at the impact point
      ctx.fillStyle = 'rgba(205,200,190,0.75)';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.28, 0, TAU);
      ctx.fill();
      if (dmg > 0.55) {
        ctx.strokeStyle = 'rgba(10,6,4,0.8)';
        ctx.lineWidth = 0.45;
        ctx.beginPath();
        for (let k = 0; k < 2; k++) {
          const a = k * 2.6 + i;
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.5);
          ctx.lineTo(x + Math.cos(a + 0.4) * r * 1.1, y + Math.sin(a + 0.4) * r * 0.8);
        }
        ctx.stroke();
      }
    }
  }
  function drawHull(ctx, v, o) {
    const b = v.body, a = v.accent;
    const [x0, x1, top] = HX[v.chassis] || HX.box;
    const W = x1 - x0;
    const wear = wearOf(v);
    const shape = () => hullPath(ctx, v);
    shape();
    ctx.fillStyle = metal(ctx, top - 3, -10, b);
    ctx.fill();
    ctx.save();
    shape();
    ctx.clip();
    // tonal camouflage patches
    ctx.fillStyle = C(b, -0.14);
    ctx.globalAlpha = 0.55;
    for (const [x, y, rx, ry, rot] of wear.camo) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // lower hull falls into shadow
    const lg = ctx.createLinearGradient(0, -19, 0, -10);
    lg.addColorStop(0, 'rgba(0,0,0,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = lg;
    ctx.fillRect(x0 - 4, -19, W + 8, 10);
    // accent band with pinstripes
    const by = Math.round((top - 10) / 2) - 1;
    ctx.fillStyle = C(a);
    ctx.fillRect(x0 - 4, by, W + 8, 3.4);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x0 - 4, by, W + 8, 0.7);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(x0 - 4, by + 3.4, W + 8, 0.7);
    // armour plate seams
    seam(ctx, x0 + W * 0.32, top, x0 + W * 0.32, -15);
    seam(ctx, x0 + W * 0.64, top, x0 + W * 0.64, -15);
    seam(ctx, x0, -15.5, x1, -15.5);
    switch (v.chassis) {
      case 'hex': {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let row = 0; row < 3; row++) {
          for (let k = -6; k <= 6; k++) {
            const cx = k * 4.6 + (row % 2) * 2.3, cy = -23 + row * 3.9;
            for (let s = 0; s <= 6; s++) {
              const an = (s * TAU) / 6 + Math.PI / 6;
              const px = cx + Math.cos(an) * 2.5, py = cy + Math.sin(an) * 2.5;
              s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
          }
        }
        ctx.stroke();
        break;
      }
      case 'round':
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 0.7;
        for (const yy of [-20, -16]) {
          ctx.beginPath();
          ctx.moveTo(-30, yy);
          ctx.quadraticCurveTo(0, yy - 3, 30, yy);
          ctx.stroke();
        }
        break;
      case 'heavy':
        // explosive reactive armour bricks
        for (let x = -19; x < 18; x += 7) {
          rrect(ctx, x, -27.5, 6.2, 4.4, 0.8);
          ctx.fillStyle = metal(ctx, -27.5, -23, sh(b, -0.06));
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 0.6;
          ctx.stroke();
          bolt(ctx, x + 3.1, -25.3, 0.5);
        }
        break;
      case 'long':
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        rrect(ctx, -4, -24.5, 22, 4, 1);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.6;
        for (let x = -2; x < 17; x += 3) {
          ctx.beginPath();
          ctx.moveTo(x, -24);
          ctx.lineTo(x, -21);
          ctx.stroke();
        }
        break;
      case 'low':
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        for (let k = 0; k < 3; k++) {
          poly(ctx, [10 + k * 3, -18, 12 + k * 3, -18, 10.5 + k * 3, -15, 8.5 + k * 3, -15]);
          ctx.fill();
        }
        break;
      case 'wedge':
        // sloped glacis plate catches the light
        poly(ctx, [14, -28, 30, -16, 26, -15, 11, -26]);
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.fill();
        break;
    }
    // engine deck grille (rear)
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    for (let k = 0; k < 5; k++) ctx.fillRect(x0 + 4 + k * 2.1, top + 1.6, 1.1, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let k = 0; k < 5; k++) ctx.fillRect(x0 + 5.1 + k * 2.1, top + 1.6, 0.4, 3);
    // weathering: dust on the lower hull, scratches, paint chips, rust run
    const dg = ctx.createLinearGradient(0, -17, 0, -10);
    dg.addColorStop(0, 'rgba(120,95,60,0)');
    dg.addColorStop(1, 'rgba(120,95,60,0.4)');
    ctx.fillStyle = dg;
    ctx.fillRect(x0 - 4, -17, W + 8, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    for (const s of wear.scratch) {
      ctx.moveTo(s[0], s[1]);
      ctx.lineTo(s[2], s[3]);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,196,186,0.5)';
    for (const [x, y, r, k] of wear.chips) {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.6, k, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(140,70,30,0.28)';
    ctx.fillRect(x0 + W * 0.32 + 1, -15, 0.9, 4);
    scorchMarks(ctx, v, o.dmg);
    bevel(ctx, shape, 1.5);
    ctx.restore();
    shape();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    // rivets along the lower seam
    for (let x = x0 + 4; x < x1 - 4; x += 5.5) bolt(ctx, x, -13.2, 0.6);
    // headlight & tow hook
    const hx = x1 - 6;
    rrect(ctx, hx, -21, 3.6, 2.8, 0.8);
    ctx.fillStyle = C('#2b2a30');
    ctx.fill();
    const lg2 = ctx.createLinearGradient(hx, -21, hx + 3.6, -18);
    lg2.addColorStop(0, '#fffbe0');
    lg2.addColorStop(1, '#d8b54a');
    ctx.fillStyle = lg2;
    ctx.fillRect(hx + 0.6, -20.4, 2.4, 1.6);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(x0 - 0.5, -12.5, 1.7, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
    // storage box on the hull side
    if (v.chassis !== 'round' && v.chassis !== 'low') {
      const tb = () => rrect(ctx, x0 + W * 0.36, -22, 8.5, 3.8, 0.8);
      tb();
      ctx.fillStyle = metal(ctx, -22, -18, sh(b, -0.12));
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.fillStyle = C('#c9c4b8');
      ctx.fillRect(x0 + W * 0.36 + 3.6, -21, 1.3, 1.4);
    }
    // heavy armour: bolted side skirts over the upper track run
    if (v.chassis === 'heavy') {
      for (let k = 0; k < 5; k++) {
        const px = -32 + k * 12.8;
        const sk = () => poly(ctx, [px, -17.5, px + 12.4, -17.5, px + 12.4, -8.2, px + 1.2, -7.6, px, -9]);
        sk();
        ctx.fillStyle = metal(ctx, -17.5, -7.5, sh(a, 0.05));
        ctx.fill();
        ctx.save();
        sk();
        ctx.clip();
        ctx.fillStyle = 'rgba(96,74,48,0.4)';
        ctx.fillRect(px, -11, 13, 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(px, -17);
        ctx.lineTo(px + 12.4, -17);
        ctx.stroke();
        ctx.restore();
        sk();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        bolt(ctx, px + 1.8, -15.8, 0.55);
        bolt(ctx, px + 10.6, -15.8, 0.55);
        bolt(ctx, px + 6.2, -10.4, 0.55);
      }
    }
  }

  /* ---------- turret ---------- */
  const TURRET = {
    box: (c) => poly(c, [-13, 1, -12.5, -9, -9.5, -12, 7, -12, 13, -6, 13, 1]),
    angled: (c) => poly(c, [-14, 1, -11.5, -9.5, -7, -12, 6, -12, 15, -4, 14, 1]),
    twin: (c) => {
      c.beginPath();
      c.arc(0, 0, 13, Math.PI, 0);
      c.closePath();
    },
    orb: (c) => {
      c.beginPath();
      c.arc(0, -4, 11, 0, TAU);
    },
    tower: (c) => rrect(c, -10, -18, 20, 19, 3),
    flat: (c) => rrect(c, -15, -7, 30, 8, 4),
    dome: (c) => {
      c.beginPath();
      c.arc(0, 0, 11.5, Math.PI, 0);
      c.closePath();
    }
  };
  const TTOP = { box: -12, angled: -12, twin: -13, orb: -15, tower: -18, flat: -7, dome: -11.5 };
  function periscope(ctx, x, y) {
    rrect(ctx, x, y, 3, 1.8, 0.4);
    ctx.fillStyle = C('#2a2930');
    ctx.fill();
    ctx.fillStyle = '#7fd4ff';
    ctx.fillRect(x + 0.5, y + 0.4, 2, 0.9);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(x + 0.6, y + 0.4, 0.6, 0.5);
  }
  function hatch(ctx, x, y, r, c) {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.45, 0, 0, TAU);
    ctx.fillStyle = metal(ctx, y - r * 0.45, y + r * 0.45, c);
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y - 0.2, r * 0.6, r * 0.22, 0, Math.PI, TAU);
    ctx.stroke();
  }
  function drawTurret(ctx, v, o) {
    const type = TURRET[v.turret] ? v.turret : 'dome';
    const shape = () => TURRET[type](ctx);
    const b = sh(v.body, 0.06), a = v.accent;
    const top = TTOP[type];
    const t = o.t || 0;
    // turret ring shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0.6, 12, 1.6, 0, 0, TAU);
    ctx.fill();
    // whip antenna at the rear (sways while idle)
    if (type !== 'orb') {
      const ax = type === 'flat' ? -11 : type === 'tower' ? -7 : -8.5;
      const ay = type === 'flat' ? -6 : type === 'tower' ? -17 : top + 2.5;
      const sway = Math.sin(t * 2.3) * 1.6 + Math.sin(t * 5.1) * 0.5;
      ctx.strokeStyle = C('#2c2b31');
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax - 1.5 + sway * 0.3, ay - 12, ax - 3 + sway, ay - 24);
      ctx.stroke();
      ctx.fillStyle = C('#2c2b31');
      ctx.beginPath();
      ctx.arc(ax - 3 + sway, ay - 24, 0.9, 0, TAU);
      ctx.fill();
      rrect(ctx, ax - 1.5, ay - 1.6, 3, 2.2, 0.6);
      ctx.fillStyle = C('#3a3942');
      ctx.fill();
    }
    // rear stowage rack
    if (type === 'box' || type === 'angled' || type === 'tower') {
      const rx = type === 'tower' ? -14 : -17.5;
      ctx.strokeStyle = C('#34323b');
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.rect(rx, top + 3, 5, 7);
      for (let k = 1; k < 3; k++) {
        ctx.moveTo(rx, top + 3 + k * 2.3);
        ctx.lineTo(rx + 5, top + 3 + k * 2.3);
      }
      ctx.stroke();
      ctx.fillStyle = C('#6b6450');
      ctx.fillRect(rx + 0.5, top + 5.6, 4, 2);
    }
    shape();
    ctx.fillStyle = metal(ctx, top - 1, 1, b);
    ctx.fill();
    ctx.save();
    shape();
    ctx.clip();
    // volume: rear falls into shade, front catches light
    const hg = ctx.createLinearGradient(-15, 0, 15, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0.3)');
    hg.addColorStop(0.45, 'rgba(0,0,0,0)');
    hg.addColorStop(0.8, 'rgba(255,255,255,0.1)');
    hg.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = hg;
    ctx.fillRect(-16, top - 2, 32, 22);
    if (type === 'box' || type === 'angled' || type === 'tower' || type === 'flat') {
      const yb = type === 'tower' ? -12 : type === 'flat' ? -4 : -7.5;
      ctx.fillStyle = C(a);
      ctx.fillRect(-16, yb, 32, 2.4);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-16, yb, 32, 0.6);
      seam(ctx, 3, top, 3, 1);
    }
    if (type === 'tower') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      for (let k = 0; k < 3; k++) ctx.fillRect(-6 + k * 5, -16, 3.2, 1.2);
    }
    if (type === 'flat') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let k = 0; k < 4; k++) ctx.fillRect(-11 + k * 2.2, -6, 1.1, 2.4);
    }
    const sc = wearOf(v).scratch;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(sc[i][0] * 0.4, sc[i][1] * 0.4 + 2);
      ctx.lineTo(sc[i][2] * 0.4, sc[i][3] * 0.4 + 2);
    }
    ctx.stroke();
    if (o.dmg > 0.5) {
      const g = ctx.createRadialGradient(4, top + 4, 0, 4, top + 4, 6);
      g.addColorStop(0, 'rgba(18,12,8,0.8)');
      g.addColorStop(1, 'rgba(18,12,8,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-4, top - 2, 16, 14);
    }
    bevel(ctx, shape, 1.3);
    ctx.restore();
    shape();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    switch (type) {
      case 'box':
      case 'angled': {
        // commander's cupola with periscopes
        const cx = type === 'box' ? -5 : -3;
        rrect(ctx, cx - 4, -15.2, 8, 3.6, 1.4);
        ctx.fillStyle = metal(ctx, -15.2, -11.6, sh(b, -0.05));
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        periscope(ctx, cx - 2.5, -14.6);
        hatch(ctx, cx + 1, -15.6, 2.4, sh(b, -0.1));
        // smoke grenade dischargers
        ctx.fillStyle = C('#3b3a42');
        for (let k = 0; k < 3; k++) {
          ctx.save();
          ctx.translate(type === 'box' ? 8 + k * 1.6 : 7 + k * 1.8, -11.4 + k * 1.3);
          ctx.rotate(-0.6);
          ctx.fillRect(0, -0.7, 3, 1.4);
          ctx.restore();
        }
        if (type === 'angled') {
          rrect(ctx, 2, -15, 5.5, 3.2, 0.8);
          fillStroke(ctx, metal(ctx, -15, -11.8, '#4a4856'), 0.9);
          ctx.fillStyle = '#ff5a3d';
          ctx.beginPath();
          ctx.arc(6.3, -13.4, 0.9, 0, TAU);
          ctx.fill();
        }
        if (v.chassis === 'heavy' && type === 'box') {
          // roof machine gun
          ctx.fillStyle = C('#2c2b31');
          ctx.fillRect(-5, -18.4, 9, 1.2);
          ctx.fillRect(-6.5, -18.8, 3.2, 2.2);
          ctx.fillRect(-5, -17.4, 1, 2.2);
        }
        break;
      }
      case 'twin':
        hatch(ctx, -6, -11.5, 4, a);
        periscope(ctx, 2, -12.4);
        periscope(ctx, 5.5, -11);
        break;
      case 'orb': {
        // collar ring and energy core
        rrect(ctx, -9, 3, 18, 3.4, 1.5);
        fillStroke(ctx, metal(ctx, 3, 6.4, '#4a4856'), 1);
        const pulse = 0.55 + 0.45 * Math.sin(t * 4);
        const g = ctx.createRadialGradient(0, -4, 1, 0, -4, 9);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, col(a));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = pulse;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, -4, 9, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(0, -4, 10.5, 3.2, Math.sin(t * 1.5) * 0.3, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(-4, -9, 3, 1.6, -0.5, 0, TAU);
        ctx.fill();
        break;
      }
      case 'tower':
        rrect(ctx, -11.5, -19.6, 23, 2.6, 1);
        fillStroke(ctx, metal(ctx, -19.6, -17, sh(b, -0.1)), 0.9);
        // optical rangefinder ends
        for (const x of [-12.5, 12.5]) {
          ctx.beginPath();
          ctx.arc(x, -9, 1.8, 0, TAU);
          fillStroke(ctx, metal(ctx, -11, -7, '#4a4856'), 0.8);
        }
        periscope(ctx, 3, -16.2);
        break;
      case 'flat':
        hatch(ctx, -3, -7.2, 3.6, sh(b, -0.08));
        periscope(ctx, 5, -8.5);
        break;
      default:
        hatch(ctx, -3, -9.6, 3.4, sh(b, -0.12));
        periscope(ctx, 2.5, -11);
        bolt(ctx, -9, -3, 0.6);
        bolt(ctx, 9, -3, 0.6);
    }
  }

  /* ---------- barrel (drawn in rotated frame, +x = aim direction) ---------- */
  function tube(ctx, x0, x1, r, c, y) {
    y = y || 0;
    rrect(ctx, x0, y - r, x1 - x0, r * 2, Math.min(r * 0.5, 1.2));
    ctx.fillStyle = cyl(ctx, r, c, y);
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = OUT;
    ctx.stroke();
  }
  function brake(ctx, x0, x1, r, y) {
    y = y || 0;
    tube(ctx, x0, x1, r, '#4b4a53', y);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const n = x1 - x0 > 7 ? 3 : 2;
    for (let k = 0; k < n; k++) ctx.fillRect(x0 + 1.4 + k * ((x1 - x0 - 2.4) / n), y - r + 0.7, 1.1, r * 2 - 1.4);
    ctx.fillStyle = '#121116';
    ctx.beginPath();
    ctx.ellipse(x1, y, 0.9, r * 0.55, 0, 0, TAU);
    ctx.fill();
  }
  function sleeve(ctx, xs, r, y) {
    y = y || 0;
    ctx.lineWidth = 0.7;
    for (const x of xs) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(x + 0.7, y - r);
      ctx.lineTo(x + 0.7, y + r);
      ctx.stroke();
    }
  }
  function mantlet(ctx, r, c) {
    rrect(ctx, -1.5, -r, 9, r * 2, 2);
    ctx.fillStyle = cyl(ctx, r, c);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    bolt(ctx, 1.5, -r + 1.4, 0.55);
    bolt(ctx, 1.5, r - 1.4, 0.55);
  }
  function muzzleFlash(ctx, L, k, big) {
    const s = big ? 1.45 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(L, 0);
    const g = ctx.createRadialGradient(5 * s, 0, 0, 5 * s, 0, 15 * s);
    g.addColorStop(0, 'rgba(255,255,235,' + k + ')');
    g.addColorStop(0.35, 'rgba(255,205,90,' + 0.85 * k + ')');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(7 * s, 0, 16 * s, 7 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,246,200,' + k + ')';
    const f = 0.8 + Math.random() * 0.4;
    poly(ctx, [0, -2.6 * s, 24 * s * f, 0, 0, 2.6 * s]);
    ctx.fill();
    poly(ctx, [1, -1.5, 4 * s, -10 * s * f, 3.5 * s, -1]);
    ctx.fill();
    poly(ctx, [1, 1.5, 4 * s, 10 * s * f, 3.5 * s, 1]);
    ctx.fill();
    ctx.restore();
  }
  function drawBarrel(ctx, v, o) {
    const gun = mx(v.body, '#4a4858', 0.55), a = v.accent;
    const ph = o.phase || 0;
    const t = o.t || 0;
    switch (v.barrel) {
      case 'thick':
        mantlet(ctx, 6.2, sh(v.body, -0.1));
        tube(ctx, 4, 21, 4.2, gun);
        sleeve(ctx, [11, 16], 4.2);
        brake(ctx, 21, 29, 5.4);
        break;
      case 'long':
        mantlet(ctx, 4, sh(v.body, -0.1));
        tube(ctx, 4, 35, 2.2, gun);
        tube(ctx, 18, 24, 3, gun);
        sleeve(ctx, [11, 29], 2.2);
        brake(ctx, 35, 42, 3.2);
        break;
      case 'double':
        mantlet(ctx, 7.5, sh(v.body, -0.1));
        for (const y of [-4.5, 4.5]) {
          tube(ctx, 4, 26, 2.4, gun, y);
          sleeve(ctx, [12, 18], 2.4, y);
          brake(ctx, 26, 30, 3, y);
        }
        break;
      case 'pod': {
        const pd = () => rrect(ctx, -3, -8, 23, 16, 3);
        pd();
        ctx.fillStyle = metal(ctx, -8, 8, sh(v.body, -0.2));
        ctx.fill();
        ctx.save();
        pd();
        ctx.clip();
        ctx.fillStyle = col(a);
        ctx.fillRect(2, -8, 3, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(-3, 4, 23, 4);
        ctx.restore();
        pd();
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        for (const y of [-4.5, 0, 4.5]) {
          ctx.beginPath();
          ctx.arc(20, y, 2.3, 0, TAU);
          ctx.fillStyle = '#121116';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(20.4, y, 1.5, 0, TAU);
          ctx.fillStyle = col('#e53935');
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(20, y - 1, 0.8, 0.6);
        }
        bolt(ctx, 8, -6, 0.6);
        bolt(ctx, 14, -6, 0.6);
        break;
      }
      case 'dish': {
        tube(ctx, 0, 18, 2.2, '#5a5866');
        ctx.beginPath();
        ctx.ellipse(20, 0, 4, 10, 0, 0, TAU);
        fillStroke(ctx, metal(ctx, -10, 10, '#a9a6b6'), 1.4);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(20.5, 0, 2.6, 7.5, 0, 0, TAU);
        ctx.stroke();
        const pulse = 0.75 + 0.25 * Math.sin(t * 9);
        const g = ctx.createRadialGradient(22, 0, 0, 22, 0, 11);
        g.addColorStop(0, 'rgba(255,255,255,' + 0.95 * pulse + ')');
        g.addColorStop(0.4, U.rgba(sh(a, 0.3), 0.6 * pulse));
        g.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(23, 0, 11, 0, TAU);
        ctx.fill();
        break;
      }
      case 'short':
        mantlet(ctx, 6.6, sh(v.body, -0.1));
        tube(ctx, 4, 14, 5, gun);
        sleeve(ctx, [9], 5);
        brake(ctx, 14, 20, 6.4);
        break;
      case 'rail': {
        for (const y of [-4.5, 4.5]) {
          rrect(ctx, 0, y - 1.5, 35, 3, 1);
          ctx.fillStyle = cyl(ctx, 1.5, '#5d5b69', y);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = OUT;
          ctx.stroke();
        }
        for (const x of [4, 13, 22, 31]) {
          rrect(ctx, x, -6.6, 2.4, 13.2, 0.8);
          fillStroke(ctx, metal(ctx, -6.6, 6.6, '#3c3a46'), 0.8);
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = col(a);
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 10);
        ctx.fillRect(2, -1.4, 32, 2.8);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2, -0.4, 32, 0.8);
        ctx.restore();
        break;
      }
      case 'coil': {
        tube(ctx, 0, 26, 2.5, '#5a5866');
        ctx.lineWidth = 2;
        for (const x of [7, 12.5, 18]) {
          ctx.strokeStyle = col('#7a4a1a');
          ctx.beginPath();
          ctx.ellipse(x, 0, 2, 6, 0, 0, TAU);
          ctx.stroke();
          ctx.strokeStyle = col('#f0a656');
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(x - 0.4, 0, 1.6, 5.4, 0, Math.PI * 0.9, Math.PI * 1.6);
          ctx.stroke();
          ctx.lineWidth = 2;
        }
        const g = ctx.createRadialGradient(28, 0, 0, 28, 0, 7);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, '#fff6b0');
        g.addColorStop(1, 'rgba(255,240,140,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(28, 0, 7, 0, TAU);
        ctx.fill();
        if (Math.sin(t * 13) > 0.3) {
          ctx.strokeStyle = 'rgba(220,240,255,0.9)';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(28, 0);
          for (let k = 1; k < 4; k++) ctx.lineTo(28 + k * 2.4, (Math.random() - 0.5) * 5);
          ctx.stroke();
        }
        break;
      }
      case 'drill': {
        tube(ctx, 0, 8, 3.2, '#5a5866');
        poly(ctx, [6, -7.5, 31, 0, 6, 7.5]);
        const dg = ctx.createLinearGradient(0, -7.5, 0, 7.5);
        dg.addColorStop(0, col('#7d7b89'));
        dg.addColorStop(0.3, col('#f0eef6'));
        dg.addColorStop(0.6, col('#a9a7b6'));
        dg.addColorStop(1, col('#55535f'));
        fillStroke(ctx, dg, 1.4);
        ctx.save();
        poly(ctx, [6, -7.5, 31, 0, 6, 7.5]);
        ctx.clip();
        ctx.strokeStyle = 'rgba(40,38,48,0.7)';
        ctx.lineWidth = 1.6;
        const off = (ph * 1.5) % 6;
        for (let x = 2 + off; x < 32; x += 6) {
          ctx.beginPath();
          ctx.moveTo(x, -8);
          ctx.lineTo(x + 4, 8);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      default: // single
        mantlet(ctx, 4.4, sh(v.body, -0.1));
        tube(ctx, 4, 25, 2.6, gun);
        tube(ctx, 14, 19, 3.3, gun);
        sleeve(ctx, [9.5, 22], 2.6);
        brake(ctx, 25, 32, 3.7);
    }
    if (o.recoil > 0.5 && !o.noFlash) {
      const L = BARREL_LEN[v.barrel] || 30;
      muzzleFlash(ctx, L, U.clamp((o.recoil - 0.5) / 0.5, 0, 1), v.barrel === 'thick' || v.barrel === 'short' || v.barrel === 'double');
    }
  }

  /* ---------- decorations ---------- */
  function drawDeco(ctx, v, o, py) {
    const t = o.t || 0;
    for (const d of v.deco || []) {
      switch (d) {
        case 'antenna': {
          const sw = Math.sin(t * 2.1 + 1) * 1.5;
          ctx.strokeStyle = col('#2c2b31');
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-18, py + 2);
          ctx.quadraticCurveTo(-20, py - 8, -23 + sw, py - 17);
          ctx.stroke();
          const on = Math.sin(t * 5) > 0;
          ctx.beginPath();
          ctx.arc(-23 + sw, py - 18, 1.8, 0, TAU);
          ctx.fillStyle = on ? '#ff4d4d' : '#8a2020';
          ctx.fill();
          if (on) {
            ctx.fillStyle = 'rgba(255,80,80,0.3)';
            ctx.beginPath();
            ctx.arc(-23 + sw, py - 18, 4, 0, TAU);
            ctx.fill();
          }
          break;
        }
        case 'hazard':
          ctx.beginPath();
          ctx.arc(-15, -18, 5.5, 0, TAU);
          fillStroke(ctx, metal(ctx, -23.5, -12.5, '#ffd600'), 1.2);
          ctx.fillStyle = OUT;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.moveTo(-15, -18);
            ctx.arc(-15, -18, 4.5, (k * TAU) / 3 - 0.5, (k * TAU) / 3 + 0.5);
            ctx.closePath();
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(-15, -18, 1.2, 0, TAU);
          ctx.fillStyle = col('#ffd600');
          ctx.fill();
          break;
        case 'cross':
          ctx.beginPath();
          ctx.arc(-15, -18, 5.5, 0, TAU);
          fillStroke(ctx, metal(ctx, -23.5, -12.5, '#ffffff'), 1.2);
          ctx.fillStyle = '#e53935';
          ctx.fillRect(-16.6, -21.5, 3.2, 7);
          ctx.fillRect(-18.5, -19.6, 7, 3.2);
          break;
        case 'star':
          ctx.beginPath();
          for (let k = 0; k < 10; k++) {
            const r = k % 2 ? 2.4 : 5.5, a = -Math.PI / 2 + (k * Math.PI) / 5;
            ctx.lineTo(-15 + Math.cos(a) * r, -18 + Math.sin(a) * r);
          }
          ctx.closePath();
          fillStroke(ctx, metal(ctx, -23.5, -12.5, '#ffe14d'), 1);
          break;
        case 'spikes':
          for (const [x, y, dx] of [[29, -13, 7], [29, -19, 6], [-29, -14, -6]]) {
            poly(ctx, [x, y - 2.5, x + dx, y, x, y + 2.5]);
            const g = ctx.createLinearGradient(0, y - 2.5, 0, y + 2.5);
            g.addColorStop(0, col('#f4f4fa'));
            g.addColorStop(1, col('#7d7e88'));
            fillStroke(ctx, g, 1);
          }
          break;
        case 'exhaust': {
          rrect(ctx, -27, py - 6, 5, 9, 1.5);
          const eg = ctx.createLinearGradient(-27, 0, -22, 0);
          eg.addColorStop(0, col('#3a3842'));
          eg.addColorStop(0.4, col('#8a8794'));
          eg.addColorStop(1, col('#3a3842'));
          fillStroke(ctx, eg, 1.2);
          ctx.fillStyle = '#16141a';
          ctx.beginPath();
          ctx.ellipse(-24.5, py - 6, 2, 0.8, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(20,16,14,0.45)';
          ctx.fillRect(-26.5, py - 5.5, 4, 2);
          break;
        }
        case 'crystals':
          for (const [x, h, c1] of [[-21, 12, '#c9f3ff'], [-16, 8, '#9be7ff']]) {
            poly(ctx, [x - 3, py + 3, x, py + 3 - h, x + 3, py + 3]);
            const g = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
            g.addColorStop(0, col('#ffffff'));
            g.addColorStop(1, col(c1));
            fillStroke(ctx, g, 1);
          }
          break;
        case 'lights':
          for (let k = 0; k < 3; k++) {
            const on = Math.sin(t * 6 + k * 2) > 0;
            ctx.beginPath();
            ctx.arc(-14 + k * 10, -14, 1.8, 0, TAU);
            ctx.fillStyle = on ? '#fffb8a' : '#55503a';
            ctx.fill();
            if (on) {
              ctx.fillStyle = 'rgba(255,250,140,0.3)';
              ctx.beginPath();
              ctx.arc(-14 + k * 10, -14, 4, 0, TAU);
              ctx.fill();
            }
          }
          break;
        case 'patches':
          for (const [x, y, w, h, c1] of [[4, -22, 8, 6, '#9e9e9e'], [-20, -17, 6, 5, '#6d4c41']]) {
            rrect(ctx, x, y, w, h, 0.6);
            fillStroke(ctx, metal(ctx, y, y + h, c1), 0.8);
            bolt(ctx, x + 1, y + 1, 0.45);
            bolt(ctx, x + w - 1, y + h - 1, 0.45);
          }
          break;
        case 'canisters':
          for (const x of [-24, -18]) {
            rrect(ctx, x, py - 4, 5, 10, 2);
            const g = ctx.createLinearGradient(x, 0, x + 5, 0);
            g.addColorStop(0, col('#3fae22'));
            g.addColorStop(0.4, col('#b6ff8a'));
            g.addColorStop(1, col('#2f8a18'));
            fillStroke(ctx, g, 1);
            ctx.fillStyle = col('#3a3842');
            ctx.fillRect(x + 0.5, py - 4.5, 4, 1.4);
          }
          break;
        case 'camo':
          ctx.fillStyle = col(sh(v.body, -0.35));
          for (const [x, y, r] of [[-14, -18, 4], [6, -21, 3.5], [16, -16, 3]]) {
            ctx.beginPath();
            ctx.ellipse(x, y, r * 1.4, r, 0.3, 0, TAU);
            ctx.fill();
          }
          break;
        case 'core': {
          const p = 0.6 + 0.4 * Math.sin(t * 5);
          const g = ctx.createRadialGradient(8, -18, 0, 8, -18, 7);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.5, col(v.accent));
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = p;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(8, -18, 7, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'tail':
          ctx.strokeStyle = col(sh(v.body, -0.2));
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-26, -20);
          ctx.quadraticCurveTo(-40, -44, -20, -50 + Math.sin(t * 3) * 2);
          ctx.stroke();
          ctx.lineCap = 'butt';
          poly(ctx, [-20, -56, -12, -49, -21, -45]);
          fillStroke(ctx, col(v.accent), 1.2);
          break;
        case 'bomb': {
          ctx.beginPath();
          ctx.arc(-14, py - 3, 6, 0, TAU);
          const g = ctx.createRadialGradient(-16, py - 5, 0.5, -14, py - 3, 6);
          g.addColorStop(0, col('#6a6872'));
          g.addColorStop(1, col('#18171c'));
          fillStroke(ctx, g, 1.2);
          ctx.fillStyle = Math.sin(t * 12) > 0 ? '#ffec3d' : '#ff5722';
          ctx.beginPath();
          ctx.arc(-11, py - 10, 2, 0, TAU);
          ctx.fill();
          break;
        }
        case 'visor':
          ctx.fillStyle = '#ff2a2a';
          ctx.shadowColor = '#ff2a2a';
          ctx.shadowBlur = 6;
          ctx.fillRect(2, py - 8, 7, 2.2);
          ctx.shadowBlur = 0;
          break;
      }
    }
  }

  function drawTurretDeco(ctx, v, o) {
    for (const d of v.deco || []) {
      if (d === 'crown') {
        poly(ctx, [-8, -12, -9, -21, -4.5, -16, 0, -23, 4.5, -16, 9, -21, 8, -12]);
        fillStroke(ctx, metal(ctx, -23, -12, '#ffd54a'), 1.2);
        for (const x of [-4.5, 0, 4.5]) {
          ctx.fillStyle = x ? '#e53935' : '#42a5f5';
          ctx.beginPath();
          ctx.arc(x, -14, 1, 0, TAU);
          ctx.fill();
        }
      } else if (d === 'horns') {
        for (const sx of [-1, 1]) {
          poly(ctx, [9 * sx, -8, 18 * sx, -20, 6 * sx, -12]);
          const g = ctx.createLinearGradient(0, -20, 0, -8);
          g.addColorStop(0, col('#fffdf4'));
          g.addColorStop(1, col('#b8ad90'));
          fillStroke(ctx, g, 1);
        }
      }
    }
  }

  /**
   * Draw a tank.
   * o: {x, y, tilt, aim(deg), recoil, phase, flash, scale, t, frozen, facing, alpha, dmg (0..1), jolt}
   */
  function drawTankRaw(ctx, v, o) {
    const s = o.scale || 1;
    FL = U.clamp(o.flash || 0, 0, 1);
    const facing = o.facing || (o.aim > 90 ? -1 : 1);
    const py = PIVOT_Y[v.chassis] || -26;
    const t = o.t || 0;
    const hoverOff = v.move === 'hover' ? -7 + Math.sin(t * 3) * 1.5 : 0;
    // idle engine rumble & hit jolt
    const rumble = t && v.move !== 'hover' ? Math.sin(t * 41) * 0.16 : 0;
    const jolt = o.jolt ? Math.sin(t * 75) * o.jolt * 1.8 : 0;
    ctx.save();
    ctx.translate(o.x + jolt * s, o.y);
    ctx.rotate(o.tilt || 0);
    ctx.scale(s, s);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.lineJoin = 'round';
    // soft contact shadow
    ctx.save();
    if (o.noShadow) ctx.globalAlpha = 0;
    ctx.scale(1, 0.15);
    const sg = ctx.createRadialGradient(0, 4, 3, 0, 4, 36);
    sg.addColorStop(0, 'rgba(0,0,0,0.42)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 4, 36, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(facing, 1);
    drawMove(ctx, v, o);
    ctx.translate(0, hoverOff + rumble);
    drawHull(ctx, v, o);
    drawDeco(ctx, v, o, py);
    ctx.restore();

    // barrel (unmirrored, rotated to world aim)
    ctx.save();
    ctx.translate(0, py - 5 + hoverOff + rumble);
    ctx.rotate(-U.rad(o.aim == null ? 45 : o.aim) - (o.tilt || 0));
    ctx.translate(-(o.recoil || 0) * 7, 0);
    drawBarrel(ctx, v, o);
    ctx.restore();

    ctx.save();
    ctx.scale(facing, 1);
    ctx.translate(0, py + hoverOff + rumble);
    drawTurret(ctx, v, o);
    drawTurretDeco(ctx, v, o);
    ctx.restore();

    if (o.frozen) {
      rrect(ctx, -34, py - 20, 68, -py + 22, 8);
      const ig = ctx.createLinearGradient(0, py - 20, 0, 2);
      ig.addColorStop(0, 'rgba(235,252,255,0.75)');
      ig.addColorStop(1, 'rgba(150,215,245,0.55)');
      ctx.fillStyle = ig;
      ctx.fill();
      ctx.strokeStyle = 'rgba(240,252,255,0.95)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-26, py - 12);
      ctx.lineTo(-14, py - 16);
      ctx.moveTo(10, py - 14);
      ctx.lineTo(24, py - 8);
      ctx.moveTo(-6, py - 4);
      ctx.lineTo(4, py - 10);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [x, y] of [[-20, py - 8], [16, py - 2], [0, py - 15]]) {
        poly(ctx, [x, y - 2.5, x + 0.8, y, x, y + 2.5, x - 0.8, y]);
        ctx.fill();
      }
    }
    ctx.restore();
    FL = 0;
  }

  /* ---------- weathering pass ----------
   * The tank is painted into an offscreen canvas at screen resolution,
   * then dust, grime streaks, scratches and mud are laid over its pixels
   * only (source-atop), and the result is placed back into the scene. */
  const GU = 6; // grime texture pixels per tank unit
  let grimeTex = null;
  function grimeTexture() {
    if (grimeTex) return grimeTex;
    const S = 140 * GU;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const r = U.rng(4242);
    // big soft blotches of dirt and faded paint
    for (let i = 0; i < 260; i++) {
      const x = r() * S, y = r() * S, rad = r.range(2, 9) * GU;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() < 0.7;
      g.addColorStop(0, dark ? 'rgba(28,22,14,' + r.range(0.12, 0.28) + ')' : 'rgba(225,215,190,' + r.range(0.05, 0.12) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // fine dust speckle
    for (let i = 0; i < 26000; i++) {
      const x = r() * S, y = r() * S;
      c.fillStyle = r() < 0.75 ? 'rgba(20,16,10,' + r.range(0.08, 0.3) + ')' : 'rgba(240,230,205,' + r.range(0.05, 0.16) + ')';
      c.fillRect(x, y, r.range(0.8, 2.2), r.range(0.8, 2.2));
    }
    // rain / rust streaks running down
    for (let i = 0; i < 520; i++) {
      const x = r() * S, y = r() * S, L = r.range(3, 14) * GU;
      const g = c.createLinearGradient(0, y, 0, y + L);
      const rust = r() < 0.35;
      g.addColorStop(0, rust ? 'rgba(110,58,24,0.26)' : 'rgba(18,14,10,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x, y, r.range(0.6, 1.8) * GU * 0.5, L);
    }
    // bright scratches / chipped paint edges
    c.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const x = r() * S, y = r() * S, a = r.range(-0.6, 0.6) + (r() < 0.5 ? 0 : Math.PI / 2), L = r.range(0.8, 3.5) * GU;
      c.strokeStyle = 'rgba(235,228,210,' + r.range(0.12, 0.3) + ')';
      c.lineWidth = r.range(0.5, 1.2);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
      c.stroke();
    }
    return (grimeTex = cv);
  }
  let tankBuf = null;
  R.GRIT = true;
  R.drawTank = function (ctx, v, o) {
    const m = ctx.getTransform ? ctx.getTransform() : null;
    const ws = m ? Math.hypot(m.a, m.b) : 1; // device px per world unit
    const s = o.scale || 1;
    const k = ws * s; // device px per tank unit
    if (!R.GRIT || o.noGrit || !m || m.b || m.c || k * 150 > 2400) {
      GRADE = R.GRIT && !o.noGrit ? 1 : 0;
      OUT = GRADE ? OUT_TANK : OUT_INK;
      drawTankRaw(ctx, v, o);
      GRADE = 0;
      OUT = OUT_INK;
      return;
    }
    // tank-local box: x -75..75, y -110..30 (barrel, antennas, hover, tilt)
    const BX = 75, BY = 110, BW = 150, BH = 140;
    const pw = Math.ceil(BW * k) + 2, ph = Math.ceil(BH * k) + 2;
    if (!tankBuf) tankBuf = document.createElement('canvas');
    if (tankBuf.width < pw || tankBuf.height < ph) {
      tankBuf.width = Math.max(tankBuf.width, pw);
      tankBuf.height = Math.max(tankBuf.height, ph);
    }
    const b = tankBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.globalAlpha = 1;
    b.clearRect(0, 0, pw, ph);
    b.setTransform(ws, 0, 0, ws, 0, 0);
    GRADE = 1;
    OUT = OUT_TANK;
    drawTankRaw(b, v, Object.assign({}, o, { x: BX * s, y: BY * s, noShadow: true, alpha: null }));
    GRADE = 0;
    OUT = OUT_INK;
    // weathering on the tank pixels only
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-atop';
    const tex = grimeTexture();
    const seed = Math.abs(U.hashStr(v.body + v.chassis + v.turret)) | 0;
    const ox = (seed % 60) * GU, oy = ((seed >> 6) % 40) * GU;
    b.drawImage(tex, ox, oy, BW * GU * 0.85, BH * GU * 0.85, 0, 0, pw, ph);
    // mud and dust kicked up on the running gear and lower hull
    const gy = BY * k;
    const mg = b.createLinearGradient(0, gy - 22 * k, 0, gy + 2 * k);
    mg.addColorStop(0, 'rgba(70,52,30,0)');
    mg.addColorStop(0.55, 'rgba(70,52,30,0.18)');
    mg.addColorStop(1, 'rgba(58,42,24,0.5)');
    b.fillStyle = mg;
    b.fillRect(0, gy - 22 * k, pw, 26 * k);
    // cool sky light from above, warm bounce from below = less flat
    const lg = b.createLinearGradient(0, gy - 70 * k, 0, gy);
    lg.addColorStop(0, 'rgba(200,215,255,0.10)');
    lg.addColorStop(0.5, 'rgba(0,0,0,0)');
    lg.addColorStop(1, 'rgba(0,0,0,0.18)');
    b.fillStyle = lg;
    b.fillRect(0, 0, pw, ph);
    b.globalCompositeOperation = 'source-over';
    // shadow + composite into the scene
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(o.x, o.y);
    ctx.save();
    ctx.rotate(o.tilt || 0);
    ctx.scale(s, 0.15 * s);
    const sg = ctx.createRadialGradient(0, 4, 3, 0, 4, 40);
    sg.addColorStop(0, 'rgba(0,0,0,0.55)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 4, 40, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.translate(-BX * s, -BY * s);
    ctx.scale(1 / ws, 1 / ws);
    ctx.drawImage(tankBuf, 0, 0, pw, ph, 0, 0, pw, ph);
    ctx.restore();
  };

  /** draw a tank centered into a canvas (garage / cards) */
  R.tankPreview = function (canvas, v, opt) {
    opt = opt || {};
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const s = opt.scale || Math.min(W / 90, H / 62) * (opt.zoom || 1);
    const gy = H * (opt.ground || 0.8);
    if (opt.platform) R.drawPedestal(ctx, W, H, gy, opt.t || 0);
    R.drawTank(ctx, v, { x: W / 2, y: gy, aim: opt.aim == null ? 25 : opt.aim, scale: s, t: opt.t || 0, phase: opt.phase || 0, facing: opt.facing || 1 });
    if (opt.dark) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(15,12,25,0.88)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  /* ================================================================
   * Ammunition art - shared by projectiles in flight and weapon icons.
   * Drawn in a local frame: nose points along +x, sz = calibre.
   * ================================================================ */
  function ammoKind(w) {
    if (w.id === 'firecracker') return 'cracker';
    if (w.sprite) return w.sprite;
    if (w.type === 'mines') return 'mine';
    if (w.type === 'laser') return 'laser';
    if (w.type === 'dirt') return 'dirt';
    if (w.type === 'marker') return 'flare';
    if (w.glow) return 'orb';
    if (w.freeze) return 'cryo';
    if (w.poison) return 'toxic';
    if (w.burn) return 'incendiary';
    if ((w.size || 5) <= 3) return 'pellet';
    if ((w.size || 5) >= 7) return 'heavy';
    return 'shell';
  }
  R.ammoKind = ammoKind;
  const ROUND = { bomb: 1, mine: 1, meteor: 1, orb: 1, dirt: 1, pellet: 1 };
  function outline(ctx, sz) {
    ctx.lineWidth = Math.max(0.6, sz * 0.13);
    ctx.strokeStyle = 'rgba(22,18,28,0.9)';
    ctx.stroke();
  }
  function shellShape(ctx, sz, L, R0) {
    const xb = -L * 0.55, xn = L * 0.08, xt = L * 0.45;
    ctx.beginPath();
    ctx.moveTo(xb, -R0 * 0.93);
    ctx.lineTo(xn, -R0);
    ctx.bezierCurveTo(xn + (xt - xn) * 0.55, -R0, xt - R0 * 0.25, -R0 * 0.4, xt, 0);
    ctx.bezierCurveTo(xt - R0 * 0.25, R0 * 0.4, xn + (xt - xn) * 0.55, R0, xn, R0);
    ctx.lineTo(xb, R0 * 0.93);
    ctx.closePath();
    return { xb, xn, xt };
  }
  function drawShell(ctx, sz, body, bands, heavy) {
    const L = sz * (heavy ? 3.1 : 3.4), R0 = sz * (heavy ? 0.7 : 0.62);
    const { xb, xn, xt } = shellShape(ctx, sz, L, R0);
    ctx.fillStyle = cyl(ctx, R0, body);
    ctx.fill();
    outline(ctx, sz);
    ctx.save();
    shellShape(ctx, sz, L, R0);
    ctx.clip();
    // copper driving band(s)
    ctx.fillStyle = cyl(ctx, R0, '#c87a3e');
    ctx.fillRect(xb + L * 0.09, -R0, L * 0.09, R0 * 2);
    if (heavy) ctx.fillRect(xb + L * 0.22, -R0, L * 0.05, R0 * 2);
    // painted identification bands
    bands.forEach((b, i) => {
      ctx.fillStyle = cyl(ctx, R0, b);
      ctx.fillRect(xn - L * (0.16 - i * 0.1), -R0, L * 0.06, R0 * 2);
    });
    if (heavy) {
      ctx.fillStyle = 'rgba(20,18,14,0.6)';
      ctx.fillRect(xb + L * 0.36, -R0 * 0.2, L * 0.16, R0 * 0.16);
      ctx.fillRect(xb + L * 0.36, R0 * 0.12, L * 0.11, R0 * 0.14);
    }
    // fuze
    ctx.fillStyle = cyl(ctx, R0 * 0.5, '#5e5a52');
    ctx.fillRect(xt - L * 0.12, -R0, L * 0.2, R0 * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(xb, -R0, L * 0.035, R0 * 2);
    ctx.restore();
  }
  function fins(ctx, x, r, span, len, c) {
    for (const s of [-1, 1]) {
      poly(ctx, [x, s * r * 0.6, x + len, s * r * 0.6, x + len * 0.15, s * (r + span), x - len * 0.25, s * (r + span)]);
      ctx.fillStyle = cyl(ctx, span * 0.5, c, s * (r + span * 0.5));
      ctx.fill();
      outline(ctx, r);
    }
  }
  function flame(ctx, x, sz, k, cool) {
    const len = sz * (2.4 + Math.random() * 1.4) * k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x, 0, x - len, 0);
    g.addColorStop(0, cool ? 'rgba(200,240,255,1)' : 'rgba(255,255,220,1)');
    g.addColorStop(0.3, cool ? 'rgba(90,170,255,0.9)' : 'rgba(255,190,60,0.9)');
    g.addColorStop(1, cool ? 'rgba(40,80,255,0)' : 'rgba(255,70,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, -sz * 0.45);
    ctx.quadraticCurveTo(x - len * 0.5, -sz * 0.6, x - len, 0);
    ctx.quadraticCurveTo(x - len * 0.5, sz * 0.6, x, sz * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawAmmo(ctx, kind, sz, w, t, inFlight) {
    const c1 = w.color || '#ffe08a';
    switch (kind) {
      case 'heavy':
        drawShell(ctx, sz, '#6f7746', ['#f2c23a', '#f2c23a'], true);
        break;
      case 'pellet': {
        const g = ctx.createRadialGradient(-sz * 0.35, -sz * 0.35, sz * 0.1, 0, 0, sz);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, '#c9c6cf');
        g.addColorStop(1, '#4a4853');
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();
        outline(ctx, sz);
        break;
      }
      case 'rocket': {
        const L = sz * 4.2, R0 = sz * 0.5;
        const xb = -L * 0.5, xn = L * 0.22, xt = L * 0.5;
        if (inFlight) flame(ctx, xb - sz * 0.2, sz, 1, w.trail === 'glow');
        // nozzle
        poly(ctx, [xb + 1, -R0 * 0.75, xb - sz * 0.45, -R0 * 0.95, xb - sz * 0.45, R0 * 0.95, xb + 1, R0 * 0.75]);
        ctx.fillStyle = cyl(ctx, R0, '#3c3a42');
        ctx.fill();
        outline(ctx, sz);
        fins(ctx, xb + sz * 0.1, R0, sz * 0.75, sz * 1.1, c1);
        rrect(ctx, xb, -R0, xn - xb, R0 * 2, R0 * 0.3);
        ctx.fillStyle = cyl(ctx, R0, '#e9e7ef');
        ctx.fill();
        outline(ctx, sz);
        ctx.fillStyle = cyl(ctx, R0, '#2c2b31');
        ctx.fillRect(xb + L * 0.3, -R0, L * 0.05, R0 * 2);
        ctx.fillStyle = cyl(ctx, R0, c1);
        ctx.fillRect(xb + L * 0.45, -R0, L * 0.08, R0 * 2);
        // nose cone
        ctx.beginPath();
        ctx.moveTo(xn, -R0);
        ctx.quadraticCurveTo(xt - sz * 0.2, -R0 * 0.8, xt, 0);
        ctx.quadraticCurveTo(xt - sz * 0.2, R0 * 0.8, xn, R0);
        ctx.closePath();
        ctx.fillStyle = cyl(ctx, R0, c1);
        ctx.fill();
        outline(ctx, sz);
        // centre fin seen edge-on
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(xb - sz * 0.1, -sz * 0.12, sz * 1.1, sz * 0.24);
        break;
      }
      case 'cracker': {
        const L = sz * 3.6, R0 = sz * 0.62;
        // burning fuse with sparks
        ctx.strokeStyle = '#3a2a18';
        ctx.lineWidth = Math.max(0.6, sz * 0.16);
        ctx.beginPath();
        ctx.moveTo(-L / 2, 0);
        ctx.quadraticCurveTo(-L / 2 - sz * 0.8, -sz * 0.9, -L / 2 - sz * 1.4, -sz * 0.4);
        ctx.stroke();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fx = -L / 2 - sz * 1.4, fy = -sz * 0.4;
        const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, sz * 1.3);
        fg.addColorStop(0, 'rgba(255,255,220,1)');
        fg.addColorStop(0.4, 'rgba(255,190,60,0.8)');
        fg.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(fx, fy, sz * 1.3, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#fff3a0';
        ctx.lineWidth = Math.max(0.5, sz * 0.1);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = k * 1.05 + (t || 0) * 20, l = sz * (0.8 + ((k * 37 + Math.floor((t || 0) * 30)) % 7) / 6);
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx + Math.cos(a) * l, fy + Math.sin(a) * l);
        }
        ctx.stroke();
        ctx.restore();
        // paper tube
        rrect(ctx, -L / 2, -R0, L, R0 * 2, R0 * 0.25);
        ctx.fillStyle = cyl(ctx, R0, '#e3262e');
        ctx.fill();
        outline(ctx, sz);
        ctx.save();
        rrect(ctx, -L / 2, -R0, L, R0 * 2, R0 * 0.25);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,220,90,0.9)';
        ctx.lineWidth = sz * 0.22;
        ctx.beginPath();
        for (let x = -L / 2 - R0; x < L / 2; x += sz * 0.9) {
          ctx.moveTo(x, R0);
          ctx.lineTo(x + R0 * 1.2, -R0);
        }
        ctx.stroke();
        ctx.fillStyle = cyl(ctx, R0, '#ffd23f');
        ctx.fillRect(-L / 2, -R0, sz * 0.45, R0 * 2);
        ctx.fillRect(L / 2 - sz * 0.45, -R0, sz * 0.45, R0 * 2);
        ctx.restore();
        break;
      }
      case 'bomb': {
        const r = sz;
        ctx.fillStyle = cyl(ctx, r * 0.5, '#44434b');
        poly(ctx, [-r * 0.6, -r * 0.4, -r * 1.75, -r * 0.85, -r * 1.75, r * 0.85, -r * 0.6, r * 0.4]);
        ctx.fill();
        outline(ctx, sz);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = r * 0.12;
        ctx.beginPath();
        ctx.moveTo(-r * 1.7, 0);
        ctx.lineTo(-r * 0.7, 0);
        ctx.stroke();
        const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
        g.addColorStop(0, '#9a98a4');
        g.addColorStop(0.45, '#4c4a55');
        g.addColorStop(1, '#1c1b21');
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fillStyle = g;
        ctx.fill();
        outline(ctx, sz);
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.clip();
        ctx.fillStyle = cyl(ctx, r, c1);
        ctx.fillRect(-r * 0.25, -r, r * 0.4, r * 2);
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.32, r * 0.18, -0.6, 0, TAU);
        ctx.fill();
        break;
      }
      case 'mine': {
        const r = sz * 1.3;
        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = metal(ctx, -r, 0, '#4a4954');
        ctx.fill();
        outline(ctx, sz);
        ctx.fillStyle = '#26252b';
        ctx.fillRect(-r * 1.15, -r * 0.12, r * 2.3, r * 0.24);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = Math.max(0.5, sz * 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.65, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        const on = Math.sin((t || 0) * 8) > 0;
        ctx.fillStyle = on ? '#ff2a2a' : '#5a1010';
        ctx.beginPath();
        ctx.arc(0, -r * 0.55, sz * 0.38, 0, TAU);
        ctx.fill();
        if (on) {
          ctx.fillStyle = 'rgba(255,60,60,0.35)';
          ctx.beginPath();
          ctx.arc(0, -r * 0.55, sz * 1.1, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'drill': {
        const L = sz * 3.4;
        rrect(ctx, -L * 0.5, -sz * 0.75, L * 0.35, sz * 1.5, sz * 0.2);
        ctx.fillStyle = cyl(ctx, sz * 0.75, '#4c4a56');
        ctx.fill();
        outline(ctx, sz);
        ctx.fillStyle = cyl(ctx, sz * 0.75, c1 === '#c9c9d6' ? '#ffb300' : c1);
        ctx.fillRect(-L * 0.42, -sz * 0.75, sz * 0.4, sz * 1.5);
        poly(ctx, [-L * 0.15, -sz * 0.85, L * 0.5, 0, -L * 0.15, sz * 0.85]);
        const dg = ctx.createLinearGradient(0, -sz * 0.85, 0, sz * 0.85);
        dg.addColorStop(0, '#77757f');
        dg.addColorStop(0.3, '#f4f2fa');
        dg.addColorStop(0.65, '#a5a3b0');
        dg.addColorStop(1, '#4c4a55');
        ctx.fillStyle = dg;
        ctx.fill();
        outline(ctx, sz);
        ctx.save();
        poly(ctx, [-L * 0.15, -sz * 0.85, L * 0.5, 0, -L * 0.15, sz * 0.85]);
        ctx.clip();
        ctx.strokeStyle = 'rgba(40,38,48,0.65)';
        ctx.lineWidth = Math.max(0.6, sz * 0.22);
        const off = ((t || 0) * sz * 12) % (sz * 0.9);
        for (let x = -L * 0.2 + off; x < L * 0.5; x += sz * 0.9) {
          ctx.beginPath();
          ctx.moveTo(x, -sz);
          ctx.lineTo(x + sz * 0.6, sz);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'nuke': {
        const L = sz * 3.2, R0 = sz * 0.95;
        fins(ctx, -L * 0.5, R0 * 0.5, sz * 0.7, sz * 1.1, '#55574a');
        ctx.beginPath();
        ctx.ellipse(0, 0, L * 0.5, R0, 0, 0, TAU);
        ctx.fillStyle = cyl(ctx, R0, '#6b6f52');
        ctx.fill();
        outline(ctx, sz);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, L * 0.5, R0, 0, 0, TAU);
        ctx.clip();
        ctx.fillStyle = cyl(ctx, R0, '#ffd600');
        ctx.fillRect(-sz * 0.6, -R0, sz * 1.2, R0 * 2);
        ctx.fillStyle = '#1d1c18';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, R0 * 0.75, (k * TAU) / 3 - 0.5 - Math.PI / 2, (k * TAU) / 3 + 0.5 - Math.PI / 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#ffd600';
        ctx.beginPath();
        ctx.arc(0, 0, R0 * 0.18, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(L * 0.15, -R0 * 0.55, L * 0.2, R0 * 0.15, 0, 0, TAU);
        ctx.fill();
        break;
      }
      case 'meteor': {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const ag = ctx.createRadialGradient(0, 0, sz * 0.5, 0, 0, sz * 2.2);
        ag.addColorStop(0, 'rgba(255,170,60,0.75)');
        ag.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 2.2, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * TAU, r = sz * (0.8 + 0.25 * Math.sin(k * 2.3));
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        const mg = ctx.createRadialGradient(-sz * 0.3, -sz * 0.3, 0, 0, 0, sz);
        mg.addColorStop(0, '#8a6a55');
        mg.addColorStop(1, '#2e1f18');
        ctx.fillStyle = mg;
        ctx.fill();
        outline(ctx, sz);
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = Math.max(0.6, sz * 0.12);
        ctx.beginPath();
        ctx.moveTo(-sz * 0.5, sz * 0.1);
        ctx.lineTo(-sz * 0.1, -sz * 0.2);
        ctx.lineTo(sz * 0.2, sz * 0.15);
        ctx.lineTo(sz * 0.5, -sz * 0.25);
        ctx.moveTo(-sz * 0.1, -sz * 0.2);
        ctx.lineTo(-sz * 0.2, -sz * 0.6);
        ctx.stroke();
        break;
      }
      case 'orb': {
        const tt = t || 0;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 2.6);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, U.rgba(c1, 0.95));
        g.addColorStop(1, U.rgba(c1, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 2.6, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = U.rgba(sh(c1, 0.4), 0.85);
        ctx.lineWidth = Math.max(0.6, sz * 0.14);
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.ellipse(0, 0, sz * 1.5, sz * 0.55, tt * (k ? -3 : 2.4) + k * 1.2, 0, TAU);
          ctx.stroke();
        }
        if (w.chain || w.emp) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = Math.max(0.5, sz * 0.1);
          ctx.beginPath();
          for (let k = 0; k < 3; k++) {
            let a = k * 2.1 + Math.floor(tt * 14), x = 0, y = 0;
            ctx.moveTo(0, 0);
            for (let j = 0; j < 3; j++) {
              a += (((k * 13 + j * 7 + Math.floor(tt * 14)) % 5) - 2) * 0.3;
              x += Math.cos(a) * sz * 0.7;
              y += Math.sin(a) * sz * 0.7;
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.55, 0, TAU);
        ctx.fill();
        break;
      }
      case 'cryo': {
        poly(ctx, [-sz * 1.6, 0, -sz * 0.2, -sz * 0.95, sz * 1.8, 0, -sz * 0.2, sz * 0.95]);
        const g = ctx.createLinearGradient(0, -sz, 0, sz);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.45, '#bff0ff');
        g.addColorStop(1, '#4aa8d8');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = Math.max(0.6, sz * 0.12);
        ctx.strokeStyle = '#2a6f99';
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(-sz * 1.6, 0);
        ctx.lineTo(sz * 1.8, 0);
        ctx.moveTo(-sz * 0.2, -sz * 0.95);
        ctx.lineTo(-sz * 0.2, sz * 0.95);
        ctx.stroke();
        break;
      }
      case 'toxic': {
        const L = sz * 2.8, R0 = sz * 0.75;
        rrect(ctx, -L / 2, -R0, L, R0 * 2, R0 * 0.6);
        const g = ctx.createLinearGradient(0, -R0, 0, R0);
        g.addColorStop(0, '#d9ffb0');
        g.addColorStop(0.35, c1);
        g.addColorStop(1, '#2c7a12');
        ctx.fillStyle = g;
        ctx.fill();
        outline(ctx, sz);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (const [bx, by, br] of [[-0.2, 0.2, 0.18], [0.15, -0.1, 0.12], [0.3, 0.3, 0.1]]) {
          ctx.beginPath();
          ctx.arc(bx * L, by * R0 * 2, br * sz * 1.6, 0, TAU);
          ctx.fill();
        }
        for (const x of [-L / 2, L / 2 - sz * 0.5]) {
          rrect(ctx, x, -R0 * 1.08, sz * 0.5, R0 * 2.16, sz * 0.12);
          ctx.fillStyle = cyl(ctx, R0, '#55535f');
          ctx.fill();
          outline(ctx, sz);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(-L * 0.35, -R0 * 0.7, L * 0.6, R0 * 0.22);
        break;
      }
      case 'incendiary':
        drawShell(ctx, sz, '#8e2a1c', ['#ffb000'], true);
        break;
      case 'dirt': {
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU, r = sz * (0.85 + 0.2 * Math.sin(k * 3.1));
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        const g = ctx.createRadialGradient(-sz * 0.3, -sz * 0.35, 0, 0, 0, sz);
        g.addColorStop(0, sh(c1, 0.3));
        g.addColorStop(1, sh(c1, -0.45));
        ctx.fillStyle = g;
        ctx.fill();
        outline(ctx, sz);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (const [x, y] of [[0.3, 0.2], [-0.4, 0.3], [0.1, -0.4]]) {
          ctx.beginPath();
          ctx.arc(x * sz, y * sz, sz * 0.12, 0, TAU);
          ctx.fill();
        }
        ctx.strokeStyle = '#5cc45a';
        ctx.lineWidth = Math.max(0.6, sz * 0.12);
        ctx.beginPath();
        for (let k = -1; k <= 1; k++) {
          ctx.moveTo(k * sz * 0.2, -sz * 0.8);
          ctx.lineTo(k * sz * 0.35, -sz * 1.3);
        }
        ctx.stroke();
        break;
      }
      case 'flare': {
        const L = sz * 3, R0 = sz * 0.55;
        rrect(ctx, -L / 2, -R0, L, R0 * 2, R0 * 0.3);
        ctx.fillStyle = cyl(ctx, R0, c1);
        ctx.fill();
        outline(ctx, sz);
        ctx.fillStyle = cyl(ctx, R0, '#f4f4f4');
        ctx.fillRect(-L * 0.15, -R0, L * 0.12, R0 * 2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(L / 2, 0, 0, L / 2, 0, sz * 1.4);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.3, 'rgba(255,90,90,0.9)');
        g.addColorStop(1, 'rgba(255,30,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(L / 2, 0, sz * 1.4, 0, TAU);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'laser': {
        const L = sz * 3;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgba(c1, 0.6);
        ctx.lineWidth = sz * 0.9;
        ctx.beginPath();
        ctx.moveTo(L * 0.3, 0);
        ctx.lineTo(L * 1.2, 0);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = sz * 0.3;
        ctx.stroke();
        ctx.restore();
        rrect(ctx, -L / 2, -sz * 0.7, L * 0.8, sz * 1.4, sz * 0.3);
        ctx.fillStyle = cyl(ctx, sz * 0.7, '#5a5866');
        ctx.fill();
        outline(ctx, sz);
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = cyl(ctx, sz * 0.85, c1);
          ctx.fillRect(-L * 0.35 + k * sz * 0.8, -sz * 0.85, sz * 0.35, sz * 1.7);
        }
        ctx.beginPath();
        ctx.ellipse(L * 0.3, 0, sz * 0.3, sz * 0.75, 0, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        break;
      }
      default: // shell
        drawShell(ctx, sz, '#9aa1aa', [c1 === '#ffe08a' ? '#e8b830' : c1], false);
    }
  }

  /* ================================================================
   * Projectiles
   * ================================================================ */
  R.drawProjectile = function (ctx, p, t) {
    const w = p.w;
    const kind = p.kind || (p.kind = ammoKind(w));
    const sz = (w.size || 5) * (p.sizeMul || 1);
    // motion streak from recent positions
    if (kind !== 'mine') {
      const h = p._h || (p._h = []);
      const lx = h[h.length - 2], ly = h[h.length - 1];
      if (lx === undefined || Math.abs(lx - p.x) + Math.abs(ly - p.y) > 0.5) {
        h.push(p.x, p.y);
        if (h.length > 32) h.splice(0, 2);
      }
      if (h.length >= 6) {
        const glow = w.glow || kind === 'orb';
        const rgb = glow ? U.hexToRgb(w.color || '#ffffff').join(',') : kind === 'rocket' ? '230,225,215' : '255,248,225';
        ctx.lineCap = 'round';
        for (let i = 2; i < h.length; i += 2) {
          const k = i / h.length;
          ctx.strokeStyle = 'rgba(' + rgb + ',' + (glow ? 0.55 : 0.32) * k + ')';
          ctx.lineWidth = sz * (glow ? 1.2 : 0.75) * k;
          ctx.beginPath();
          ctx.moveTo(h[i - 2], h[i - 1]);
          ctx.lineTo(h[i], h[i + 1]);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.lineJoin = 'round';
    if (kind === 'cracker' || kind === 'dirt') ctx.rotate((t || 0) * 9);
    else if (kind === 'bomb' && (w.type === 'bounce' || w.type === 'roll')) ctx.rotate((t || 0) * 7);
    else if (!ROUND[kind] || kind === 'bomb') ctx.rotate(Math.atan2(p.vy, p.vx));
    drawAmmo(ctx, kind, sz, w, t, true);
    ctx.restore();
  };

  /* ================================================================
   * Weapon icons: small illustrations used across the UI
   * ================================================================ */
  const ICON_SZ = { shell: 22, heavy: 21, pellet: 12, rocket: 17, cracker: 18, bomb: 24, mine: 24, drill: 21, nuke: 20, meteor: 26, orb: 17, cryo: 21, toxic: 22, incendiary: 21, dirt: 28, flare: 15, laser: 18 };
  const iconCache = {};
  R.weaponIcon = function (w) {
    if (!w) return '';
    if (iconCache[w.id]) return iconCache[w.id];
    const S = 96;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    c.lineJoin = 'round';
    const kind = ammoKind(w);
    const base = ICON_SZ[kind] || 15;
    const n = Math.min(w.count || 1, 5);
    const ang = ROUND[kind] ? 0 : -0.62;
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = S;
    const tc = tmp.getContext('2d');
    tc.lineJoin = 'round';
    const one = (x, y, sz, a) => {
      tc.save();
      tc.translate(x, y);
      tc.rotate(a);
      drawAmmo(tc, kind, sz, w, 0.35, kind === 'rocket');
      tc.restore();
    };
    if (n > 1) {
      const sz = base * (n > 3 ? 0.5 : 0.62);
      const px = -Math.sin(ang), py = Math.cos(ang);
      const gap = ROUND[kind] ? sz * 2.1 : sz * 1.5;
      for (let i = 0; i < n; i++) {
        const k = i - (n - 1) / 2;
        const zig = ROUND[kind] ? (i % 2 ? sz : -sz) : -Math.abs(k) * 4;
        one(S / 2 + px * k * gap + zig, S / 2 + py * k * gap, sz, ang + k * 0.1);
      }
    } else one(S / 2, S / 2, base, ang);
    // type flourishes
    tc.save();
    tc.lineCap = 'round';
    if (w.type === 'cluster' || w.type === 'split') {
      tc.fillStyle = w.color;
      tc.strokeStyle = 'rgba(22,18,28,0.9)';
      tc.lineWidth = 1.5;
      for (const [x, y] of [[74, 26], [82, 40], [64, 16]]) {
        tc.beginPath();
        tc.arc(x, y, 4.5, 0, TAU);
        tc.fill();
        tc.stroke();
      }
    }
    if (w.type === 'bounce' || w.type === 'roll') {
      tc.strokeStyle = 'rgba(255,255,255,0.75)';
      tc.lineWidth = 2.5;
      tc.setLineDash([4, 5]);
      tc.beginPath();
      if (w.type === 'bounce') {
        tc.moveTo(8, 70);
        tc.quadraticCurveTo(20, 30, 32, 66);
      } else {
        tc.moveTo(10, 62);
        tc.lineTo(26, 62);
        tc.moveTo(14, 48);
        tc.lineTo(28, 48);
      }
      tc.stroke();
      tc.setLineDash([]);
    }
    if (w.type === 'homing' || w.type === 'marker') {
      tc.strokeStyle = '#ff4d5a';
      tc.lineWidth = 3;
      tc.beginPath();
      tc.arc(76, 20, 10, 0, TAU);
      tc.moveTo(76, 6);
      tc.lineTo(76, 12);
      tc.moveTo(76, 28);
      tc.lineTo(76, 34);
      tc.moveTo(62, 20);
      tc.lineTo(68, 20);
      tc.moveTo(84, 20);
      tc.lineTo(90, 20);
      tc.stroke();
    }
    if (w.type === 'rain') {
      tc.fillStyle = w.color;
      for (const [x, y] of [[30, 74], [46, 82], [62, 76], [76, 86]]) {
        tc.beginPath();
        tc.moveTo(x, y - 7);
        tc.quadraticCurveTo(x + 4, y, x, y + 2);
        tc.quadraticCurveTo(x - 4, y, x, y - 7);
        tc.fill();
      }
    }
    if (w.type === 'mines' && kind !== 'mine') {
      tc.translate(70, 78);
      drawAmmo(tc, 'mine', 7, w, 0.1);
    }
    tc.restore();
    // backdrop glow in the weapon colour, then the art with a drop shadow
    const g = c.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S * 0.48);
    g.addColorStop(0, U.rgba(w.color && w.color.length >= 4 ? w.color : '#ffffff', 0.4));
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    c.shadowColor = 'rgba(0,0,0,0.55)';
    c.shadowBlur = 5;
    c.shadowOffsetY = 3;
    c.drawImage(tmp, 0, 0);
    return (iconCache[w.id] = cv.toDataURL());
  };

  /* ================================================================
   * Decorations (pre-rendered sprites, anchor bottom-center)
   * ================================================================ */
  const DECO = {
    tree(c, th) {
      c.fillStyle = '#6b4a2b';
      c.fillRect(-4, -34, 8, 34);
      for (const [x, y, r, k] of [[0, -48, 20, 0], [-13, -38, 14, -0.08], [13, -38, 14, -0.08], [0, -60, 14, 0.12]]) {
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fillStyle = U.shade('#4caf50', k);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.25)';
        c.lineWidth = 2;
        c.stroke();
      }
      return [60, 84];
    },
    pine(c) {
      c.fillStyle = '#5d4027';
      c.fillRect(-3, -14, 6, 14);
      for (let i = 0; i < 3; i++) {
        poly(c, [-18 + i * 3, -12 - i * 16, 0, -38 - i * 16, 18 - i * 3, -12 - i * 16]);
        c.fillStyle = U.shade('#2e7d32', i * 0.08);
        c.fill();
      }
      return [40, 76];
    },
    bush(c) {
      for (const [x, y, r] of [[-9, -8, 9], [8, -9, 10], [0, -14, 10]]) {
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fillStyle = '#43a047';
        c.fill();
      }
      c.fillStyle = '#e53935';
      c.beginPath();
      c.arc(4, -14, 2, 0, TAU);
      c.arc(-7, -9, 2, 0, TAU);
      c.fill();
      return [44, 26];
    },
    flower(c) {
      c.strokeStyle = '#2e7d32';
      c.lineWidth = 2;
      for (const [x, h, col] of [[-5, 14, '#ff5c8a'], [3, 18, '#ffd23f'], [9, 12, '#7cc8ff']]) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, -h);
        c.stroke();
        c.fillStyle = col;
        c.beginPath();
        c.arc(x, -h, 3.5, 0, TAU);
        c.fill();
      }
      return [30, 24];
    },
    rock(c, th) {
      poly(c, [-16, 0, -13, -11, -3, -16, 10, -13, 16, 0]);
      c.fillStyle = th && th.terrain.soil ? U.mix(th.terrain.soil[1], '#888888', 0.5) : '#888';
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 2;
      c.stroke();
      return [36, 20];
    },
    cactus(c) {
      c.fillStyle = '#43a047';
      c.strokeStyle = '#1b5e20';
      c.lineWidth = 2;
      rrect(c, -5, -46, 10, 46, 5);
      c.fill();
      c.stroke();
      rrect(c, -17, -32, 7, 18, 3.5);
      c.fill();
      c.stroke();
      c.fillRect(-12, -18, 8, 5);
      rrect(c, 10, -38, 7, 20, 3.5);
      c.fill();
      c.stroke();
      c.fillRect(4, -22, 8, 5);
      return [40, 50];
    },
    skull(c) {
      c.fillStyle = '#f2ead3';
      c.beginPath();
      c.arc(0, -9, 8, 0, TAU);
      c.fill();
      c.fillRect(-5, -4, 10, 5);
      c.fillStyle = '#333';
      c.beginPath();
      c.arc(-3, -9, 2, 0, TAU);
      c.arc(3, -9, 2, 0, TAU);
      c.fill();
      return [22, 20];
    },
    dead_tree(c) {
      c.strokeStyle = '#4a3a2a';
      c.lineCap = 'round';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -40);
      c.stroke();
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, -24);
      c.lineTo(-14, -38);
      c.moveTo(0, -32);
      c.lineTo(12, -48);
      c.moveTo(-8, -32);
      c.lineTo(-12, -46);
      c.stroke();
      return [40, 54];
    },
    lava_rock(c) {
      poly(c, [-18, 0, -14, -16, -2, -22, 12, -15, 18, 0]);
      c.fillStyle = '#2a1e1c';
      c.fill();
      c.strokeStyle = '#ff5a1a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-8, -3);
      c.lineTo(-4, -12);
      c.lineTo(2, -8);
      c.lineTo(6, -17);
      c.stroke();
      return [40, 26];
    },
    vent(c) {
      poly(c, [-16, 0, -8, -14, 8, -14, 16, 0]);
      c.fillStyle = '#3a2a28';
      c.fill();
      c.fillStyle = '#ff7a1a';
      c.beginPath();
      c.ellipse(0, -14, 8, 3, 0, 0, TAU);
      c.fill();
      return [36, 20];
    },
    pine_snow(c) {
      c.fillStyle = '#5d4027';
      c.fillRect(-3, -14, 6, 14);
      for (let i = 0; i < 3; i++) {
        poly(c, [-18 + i * 3, -12 - i * 16, 0, -38 - i * 16, 18 - i * 3, -12 - i * 16]);
        c.fillStyle = '#2e6b4a';
        c.fill();
        poly(c, [-8 + i * 1.5, -26 - i * 16, 0, -38 - i * 16, 8 - i * 1.5, -26 - i * 16]);
        c.fillStyle = '#ffffff';
        c.fill();
      }
      return [40, 76];
    },
    ice_crystal(c) {
      c.fillStyle = 'rgba(190,240,255,0.9)';
      c.strokeStyle = '#6fc7e8';
      c.lineWidth = 1.5;
      for (const [x, h, w] of [[-8, 26, 6], [2, 38, 8], [11, 20, 5]]) {
        poly(c, [x - w, 0, x - w * 0.6, -h * 0.8, x, -h, x + w * 0.6, -h * 0.8, x + w, 0]);
        c.fill();
        c.stroke();
      }
      return [36, 42];
    },
    snowman(c) {
      c.fillStyle = '#fff';
      c.strokeStyle = '#9ec3dd';
      c.lineWidth = 1.5;
      for (const [y, r] of [[-10, 10], [-26, 7.5], [-38, 5.5]]) {
        c.beginPath();
        c.arc(0, y, r, 0, TAU);
        c.fill();
        c.stroke();
      }
      c.fillStyle = '#ff8a3d';
      poly(c, [2, -38, 9, -37, 2, -36]);
      c.fill();
      c.fillStyle = '#222';
      c.fillRect(-6, -48, 12, 3);
      c.fillRect(-4, -54, 8, 7);
      return [26, 58];
    },
    palm(c) {
      c.strokeStyle = '#8d6e3f';
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(6, -30, 2, -60);
      c.stroke();
      c.fillStyle = '#2e9e4f';
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.55;
        c.save();
        c.translate(2, -60);
        c.rotate(a);
        c.beginPath();
        c.ellipse(20, 0, 22, 5, 0.25, 0, TAU);
        c.fill();
        c.restore();
      }
      return [90, 90];
    },
    jungle_tree(c) {
      c.fillStyle = '#5b3b22';
      c.fillRect(-5, -50, 10, 50);
      for (const [x, y, r, k] of [[0, -62, 24, 0], [-18, -52, 16, -0.1], [18, -52, 16, -0.1], [0, -78, 16, 0.1]]) {
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fillStyle = U.shade('#1f8a3b', k);
        c.fill();
      }
      c.strokeStyle = '#2f6b2f';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-12, -48);
      c.quadraticCurveTo(-16, -24, -10, -12);
      c.stroke();
      return [76, 100];
    },
    fern(c) {
      c.strokeStyle = '#3a9a4a';
      c.lineWidth = 3;
      c.lineCap = 'round';
      for (let k = -2; k <= 2; k++) {
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(k * 8, -16, k * 14, -8 - Math.abs(k) * 2);
        c.stroke();
      }
      return [40, 22];
    },
    mushroom(c) {
      c.fillStyle = '#f5ecd8';
      c.fillRect(-3, -12, 6, 12);
      c.fillStyle = '#e53935';
      c.beginPath();
      c.arc(0, -12, 10, Math.PI, 0);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(-4, -16, 1.8, 0, TAU);
      c.arc(4, -15, 1.5, 0, TAU);
      c.fill();
      return [24, 24];
    },
    ruin(c) {
      c.fillStyle = '#8a8378';
      c.strokeStyle = '#4a453e';
      c.lineWidth = 2;
      poly(c, [-22, 0, -22, -50, -14, -58, -8, -46, -8, 0]);
      c.fill();
      c.stroke();
      poly(c, [4, 0, 4, -32, 12, -28, 20, -36, 20, 0]);
      c.fill();
      c.stroke();
      c.fillStyle = '#2a2622';
      c.fillRect(-18, -40, 6, 8);
      c.fillRect(9, -22, 6, 7);
      return [50, 62];
    },
    tire(c) {
      c.beginPath();
      c.arc(0, -11, 11, 0, TAU);
      c.fillStyle = '#222';
      c.fill();
      c.beginPath();
      c.arc(0, -11, 5, 0, TAU);
      c.fillStyle = '#555';
      c.fill();
      return [26, 24];
    },
    wreck(c) {
      poly(c, [-30, 0, -26, -14, -8, -18, 4, -26, 18, -24, 30, -10, 28, 0]);
      c.fillStyle = '#5d4a3a';
      c.fill();
      c.strokeStyle = '#2a211a';
      c.lineWidth = 2;
      c.stroke();
      c.strokeStyle = '#3a3030';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(4, -22);
      c.lineTo(28, -34);
      c.stroke();
      return [66, 40];
    },
    barrel_deco(c) {
      rrect(c, -8, -20, 16, 20, 3);
      c.fillStyle = '#8a3a2a';
      c.fill();
      c.fillStyle = '#5a241a';
      c.fillRect(-8, -15, 16, 2);
      c.fillRect(-8, -6, 16, 2);
      return [20, 22];
    },
    sign(c) {
      c.fillStyle = '#6b4a2b';
      c.fillRect(-2, -30, 4, 30);
      c.fillStyle = '#ffd600';
      poly(c, [0, -46, 12, -32, 0, -18, -12, -32]);
      c.fill();
      c.fillStyle = '#222';
      c.font = 'bold 14px sans-serif';
      c.textAlign = 'center';
      c.fillText('!', 0, -27);
      return [30, 50];
    },
    moon_rock(c) {
      poly(c, [-14, 0, -11, -9, 0, -13, 10, -9, 14, 0]);
      c.fillStyle = '#9ea1ab';
      c.fill();
      c.fillStyle = '#7d808a';
      c.beginPath();
      c.arc(-3, -7, 2.5, 0, TAU);
      c.fill();
      return [32, 16];
    },
    antenna(c) {
      c.strokeStyle = '#bbb';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -50);
      c.moveTo(-10, 0);
      c.lineTo(0, -30);
      c.lineTo(10, 0);
      c.stroke();
      c.fillStyle = '#ddd';
      c.beginPath();
      c.ellipse(0, -52, 12, 5, -0.4, 0, TAU);
      c.fill();
      c.fillStyle = '#ff3d3d';
      c.beginPath();
      c.arc(0, -56, 2, 0, TAU);
      c.fill();
      return [30, 62];
    },
    dome(c) {
      c.fillStyle = 'rgba(180,220,255,0.55)';
      c.beginPath();
      c.arc(0, 0, 28, Math.PI, 0);
      c.fill();
      c.strokeStyle = '#dde';
      c.lineWidth = 2;
      c.stroke();
      c.beginPath();
      c.moveTo(-28, 0);
      c.lineTo(28, 0);
      c.stroke();
      return [62, 32];
    },
    flag(c) {
      c.strokeStyle = '#ccc';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -44);
      c.stroke();
      c.fillStyle = '#c8102e';
      c.fillRect(0, -44, 22, 15);
      c.fillStyle = '#fff';
      c.fillRect(6, -44, 3, 15);
      c.fillRect(0, -38, 22, 3);
      return [30, 48];
    },
    flag_enemy(c) {
      c.strokeStyle = '#444';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -44);
      c.stroke();
      c.fillStyle = '#1b1b1b';
      c.fillRect(0, -44, 22, 15);
      c.fillStyle = '#ff1744';
      c.beginPath();
      c.arc(11, -36.5, 4, 0, TAU);
      c.fill();
      return [30, 48];
    },
    pipe(c) {
      c.fillStyle = '#7d8796';
      c.strokeStyle = '#3a404a';
      c.lineWidth = 2;
      rrect(c, -30, -16, 60, 12, 5);
      c.fill();
      c.stroke();
      rrect(c, 18, -40, 10, 30, 4);
      c.fill();
      c.stroke();
      return [64, 44];
    },
    crate(c) {
      c.fillStyle = '#b07a3a';
      c.strokeStyle = '#5a3a1a';
      c.lineWidth = 2;
      c.fillRect(-12, -24, 24, 24);
      c.strokeRect(-12, -24, 24, 24);
      c.beginPath();
      c.moveTo(-12, -24);
      c.lineTo(12, 0);
      c.moveTo(12, -24);
      c.lineTo(-12, 0);
      c.stroke();
      return [28, 28];
    },
    lamp(c) {
      c.fillStyle = '#555';
      c.fillRect(-2, -56, 4, 56);
      c.fillRect(-2, -56, 16, 3);
      c.fillStyle = '#fff3a8';
      c.beginPath();
      c.arc(13, -51, 4, 0, TAU);
      c.fill();
      return [34, 60];
    },
    chimney(c) {
      c.fillStyle = '#6d5a4a';
      c.fillRect(-9, -70, 18, 70);
      c.fillStyle = '#c62828';
      c.fillRect(-9, -64, 18, 5);
      c.fillRect(-9, -50, 18, 5);
      return [22, 74];
    },
    windmill(c, th, t) {
      c.fillStyle = '#eee';
      poly(c, [-8, 0, -4, -46, 4, -46, 8, 0]);
      c.fill();
      c.strokeStyle = '#999';
      c.lineWidth = 1.5;
      c.stroke();
      c.strokeStyle = '#fff';
      c.lineWidth = 4;
      for (let k = 0; k < 3; k++) {
        const a = 0.3 + (k * TAU) / 3;
        c.beginPath();
        c.moveTo(0, -46);
        c.lineTo(Math.cos(a) * 26, -46 + Math.sin(a) * 26);
        c.stroke();
      }
      return [60, 76];
    },
    spikes_deco(c) {
      c.fillStyle = '#3a3a3a';
      for (let k = -2; k <= 2; k++) {
        poly(c, [k * 8 - 4, 0, k * 8, -18 - (k % 2 ? 0 : 6), k * 8 + 4, 0]);
        c.fill();
      }
      return [44, 26];
    }
  };

  /** leafy blob lit from the upper left */
  function foliage(c, x, y, r, col) {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, U.shade(col, 0.28));
    g.addColorStop(0.65, col);
    g.addColorStop(1, U.shade(col, -0.3));
    c.fillStyle = g;
    c.beginPath();
    for (let k = 0; k <= 14; k++) {
      const a = (k / 14) * TAU, rr = r * (0.9 + 0.1 * Math.sin(k * 2.7 + x));
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.fill();
  }
  function bark(c, x0, y0, w, h, col) {
    const g = c.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, U.shade(col, 0.2));
    g.addColorStop(0.5, col);
    g.addColorStop(1, U.shade(col, -0.4));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x0 - 1.5, y0 + h);
    c.lineTo(x0 + 0.5, y0);
    c.lineTo(x0 + w - 0.5, y0);
    c.lineTo(x0 + w + 1.5, y0 + h);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 0.8;
    c.beginPath();
    for (let y = y0 + 4; y < y0 + h - 2; y += 6) {
      c.moveTo(x0 + 1.5, y);
      c.lineTo(x0 + w * 0.5, y + 2);
    }
    c.stroke();
  }
  function pineTier(c, i, col, snow) {
    const w = 19 - i * 3.2, yb = -12 - i * 15, yt = -40 - i * 15;
    c.beginPath();
    c.moveTo(-w, yb);
    for (let k = 1; k < 6; k++) c.lineTo(-w + (k * 2 * w) / 6, yb + (k % 2 ? 2.5 : 0));
    c.lineTo(w, yb);
    c.lineTo(0, yt);
    c.closePath();
    const g = c.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, U.shade(col, 0.22));
    g.addColorStop(0.5, col);
    g.addColorStop(1, U.shade(col, -0.35));
    c.fillStyle = g;
    c.fill();
    if (snow) {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(-w * 0.55, yt + (yb - yt) * 0.55);
      c.quadraticCurveTo(-w * 0.2, yt + (yb - yt) * 0.62, 0, yt + (yb - yt) * 0.5);
      c.quadraticCurveTo(w * 0.25, yt + (yb - yt) * 0.6, w * 0.5, yt + (yb - yt) * 0.52);
      c.lineTo(0, yt);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(160,200,230,0.6)';
      c.fillRect(-w * 0.9, yb - 1.5, w * 1.8, 1.5);
    }
  }
  const DECO_NEW = {
    tree(c) {
      bark(c, -4, -38, 8, 38, '#6b4a2b');
      c.strokeStyle = '#5a3d22';
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(0, -26);
      c.lineTo(-10, -36);
      c.moveTo(1, -30);
      c.lineTo(11, -40);
      c.stroke();
      for (const [x, y, r, k] of [[-13, -38, 14, -0.1], [13, -39, 14, -0.12], [0, -48, 19, 0], [-6, -60, 13, 0.06], [8, -59, 12, 0.08]]) foliage(c, x, y, r, U.shade('#4caf50', k));
      c.fillStyle = 'rgba(255,255,255,0.12)';
      for (const [x, y] of [[-8, -56], [-14, -42], [4, -52]]) {
        c.beginPath();
        c.ellipse(x, y, 4, 2.4, -0.5, 0, TAU);
        c.fill();
      }
      return [60, 84];
    },
    pine(c) {
      bark(c, -3, -16, 6, 16, '#5d4027');
      for (let i = 0; i < 3; i++) pineTier(c, i, U.shade('#2e7d32', i * 0.07), false);
      return [40, 76];
    },
    pine_snow(c) {
      bark(c, -3, -16, 6, 16, '#5d4027');
      for (let i = 0; i < 3; i++) pineTier(c, i, '#2e6b4a', true);
      return [40, 76];
    },
    bush(c) {
      for (const [x, y, r, k] of [[-10, -8, 9, -0.1], [9, -9, 10, -0.06], [0, -14, 11, 0.04], [-3, -6, 8, -0.15]]) foliage(c, x, y, r, U.shade('#43a047', k));
      for (const [x, y] of [[4, -16], [-8, -10], [9, -7], [-1, -9]]) {
        c.fillStyle = '#c62828';
        c.beginPath();
        c.arc(x, y, 2.2, 0, TAU);
        c.fill();
        c.fillStyle = '#ff8a80';
        c.beginPath();
        c.arc(x - 0.6, y - 0.6, 0.8, 0, TAU);
        c.fill();
      }
      return [44, 26];
    },
    rock(c, th) {
      const base = th && th.terrain.soil ? U.mix(th.terrain.soil[1], '#8a8884', 0.55) : '#888888';
      poly(c, [-17, 0, -14, -11, -4, -17, 9, -14, 17, -4, 16, 0]);
      const g = c.createLinearGradient(-10, -17, 10, 0);
      g.addColorStop(0, U.shade(base, 0.3));
      g.addColorStop(1, U.shade(base, -0.35));
      c.fillStyle = g;
      c.fill();
      // facets
      poly(c, [-4, -17, 9, -14, 3, -8, -6, -9]);
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fill();
      poly(c, [9, -14, 17, -4, 16, 0, 5, 0, 3, -8]);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-6, -9);
      c.lineTo(-9, -3);
      c.moveTo(3, -8);
      c.lineTo(5, 0);
      c.stroke();
      c.fillStyle = 'rgba(90,140,60,0.55)';
      c.beginPath();
      c.ellipse(-8, -12, 4, 1.8, -0.4, 0, TAU);
      c.fill();
      return [36, 20];
    },
    cactus(c) {
      const part = (x, y, w, h) => {
        R.rrect(c, x, y, w, h, w / 2);
        const g = c.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, '#7bd36b');
        g.addColorStop(0.45, '#43a047');
        g.addColorStop(1, '#1f6a28');
        c.fillStyle = g;
        c.fill();
        c.strokeStyle = 'rgba(20,70,25,0.6)';
        c.lineWidth = 0.8;
        c.beginPath();
        for (let k = 1; k < 3; k++) {
          c.moveTo(x + (w * k) / 3, y + w / 2);
          c.lineTo(x + (w * k) / 3, y + h - 2);
        }
        c.stroke();
        c.fillStyle = '#f4f0d8';
        for (let yy = y + 4; yy < y + h - 3; yy += 5) {
          c.fillRect(x - 1, yy, 1.5, 0.6);
          c.fillRect(x + w - 0.5, yy + 2, 1.5, 0.6);
        }
      };
      part(-17, -32, 7, 18);
      part(-12, -19, 8, 6);
      part(10, -38, 7, 20);
      part(4, -23, 8, 6);
      part(-5, -46, 10, 46);
      c.fillStyle = '#ff5c8a';
      c.beginPath();
      c.arc(0, -46, 2.5, 0, TAU);
      c.fill();
      return [40, 50];
    },
    palm(c) {
      c.lineCap = 'round';
      for (let k = 0; k < 12; k++) {
        const u = k / 12, x = Math.sin(u * 1.6) * 5, y = -u * 60;
        c.fillStyle = k % 2 ? '#8d6e3f' : '#7a5c32';
        c.beginPath();
        c.ellipse(x + 1, y - 2.5, 3.6 - u, 3, 0, 0, TAU);
        c.fill();
      }
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * 0.5;
        c.save();
        c.translate(2, -60);
        c.rotate(a);
        const g = c.createLinearGradient(0, -5, 0, 5);
        g.addColorStop(0, '#5ed27a');
        g.addColorStop(1, '#1e7a3a');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(14, -7, 28, 4);
        c.quadraticCurveTo(14, 3, 0, 0);
        c.fill();
        c.strokeStyle = 'rgba(0,60,20,0.5)';
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(14, -3, 28, 4);
        c.stroke();
        c.restore();
      }
      c.fillStyle = '#6b4a2b';
      for (const [x, y] of [[0, -57], [4, -56], [2, -54]]) {
        c.beginPath();
        c.arc(x, y, 2.4, 0, TAU);
        c.fill();
      }
      return [90, 90];
    },
    jungle_tree(c) {
      bark(c, -5, -54, 10, 54, '#5b3b22');
      for (const [x, y, r, k] of [[-19, -52, 16, -0.12], [19, -53, 16, -0.12], [0, -64, 24, 0], [-9, -80, 15, 0.08], [10, -79, 14, 0.1]]) foliage(c, x, y, r, U.shade('#1f8a3b', k));
      c.strokeStyle = '#2f6b2f';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-12, -48);
      c.quadraticCurveTo(-16, -24, -10, -12);
      c.moveTo(12, -46);
      c.quadraticCurveTo(15, -30, 11, -22);
      c.stroke();
      return [76, 100];
    },
    crate(c) {
      const g = c.createLinearGradient(-12, -24, 12, 0);
      g.addColorStop(0, '#d39a52');
      g.addColorStop(1, '#8a5a26');
      c.fillStyle = g;
      c.fillRect(-12, -24, 24, 24);
      c.strokeStyle = '#5a3a1a';
      c.lineWidth = 2;
      c.strokeRect(-12, -24, 24, 24);
      c.strokeStyle = 'rgba(90,58,26,0.5)';
      c.lineWidth = 0.8;
      for (let y = -18; y < 0; y += 6) {
        c.beginPath();
        c.moveTo(-12, y);
        c.lineTo(12, y);
        c.stroke();
      }
      c.strokeStyle = '#6a4420';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(-11, -23);
      c.lineTo(11, -1);
      c.stroke();
      c.fillStyle = '#c9c4b8';
      for (const [x, y] of [[-10, -22], [10, -22], [-10, -2], [10, -2]]) c.fillRect(x - 1, y - 1, 2, 2);
      return [28, 28];
    },
    barrel_deco(c) {
      R.rrect(c, -8, -20, 16, 20, 3);
      const g = c.createLinearGradient(-8, 0, 8, 0);
      g.addColorStop(0, '#5a241a');
      g.addColorStop(0.35, '#b44a32');
      g.addColorStop(1, '#4a1c12');
      c.fillStyle = g;
      c.fill();
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(-8, -15, 16, 2);
      c.fillRect(-8, -6, 16, 2);
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(-5, -19, 2, 18);
      c.fillStyle = 'rgba(120,70,30,0.6)';
      c.fillRect(2, -13, 1.5, 6);
      c.fillStyle = '#3a1810';
      c.beginPath();
      c.ellipse(0, -20, 8, 2, 0, 0, TAU);
      c.fill();
      return [20, 22];
    }
  };
  Object.assign(DECO, DECO_NEW);

  const spriteCache = {};
  const DECO_RES = 2;
  R.decoSprite = function (type, theme) {
    const key = type + '_' + (theme ? theme.id : 0);
    if (spriteCache[key]) return spriteCache[key];
    const fn = DECO[type] || DECO.rock;
    const cv = document.createElement('canvas');
    cv.width = 120 * DECO_RES;
    cv.height = 120 * DECO_RES;
    const c = cv.getContext('2d');
    c.scale(DECO_RES, DECO_RES);
    c.translate(60, 110);
    c.lineJoin = 'round';
    const size = fn(c, theme) || [40, 40];
    c.lineCap = 'butt';
    // global light from the upper left
    c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(-size[0] / 2, -size[1], size[0] / 2, 0);
    g.addColorStop(0, 'rgba(255,248,225,0.22)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,30,0.22)');
    c.fillStyle = g;
    c.fillRect(-60, -110, 120, 120);
    // grade props into the scene: less toy saturation, tinted by the world light
    try {
      const tint = (theme && theme.art && theme.art.tint) || [1, 1, 1];
      const id = c.getImageData(0, 0, cv.width, cv.height), px = id.data;
      for (let i = 0; i < px.length; i += 4) {
        if (!px[i + 3]) continue;
        const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
        px[i] = (px[i] + (l - px[i]) * 0.3) * tint[0] * 0.92;
        px[i + 1] = (px[i + 1] + (l - px[i + 1]) * 0.3) * tint[1] * 0.92;
        px[i + 2] = (px[i + 2] + (l - px[i + 2]) * 0.3) * tint[2] * 0.92;
      }
      c.putImageData(id, 0, 0);
    } catch (e) {
      /* tainted canvas: keep the ungraded sprite */
    }
    // soft contact shadow underneath
    c.globalCompositeOperation = 'destination-over';
    const sg = c.createRadialGradient(0, 0, 1, 0, 0, size[0] * 0.55);
    sg.addColorStop(0, 'rgba(0,0,0,0.35)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sg;
    c.save();
    c.scale(1, 0.18);
    c.beginPath();
    c.arc(0, 0, size[0] * 0.55, 0, TAU);
    c.fill();
    c.restore();
    c.globalCompositeOperation = 'source-over';
    spriteCache[key] = { canvas: cv, ax: 60, ay: 110, w: size[0], h: size[1] };
    return spriteCache[key];
  };

  /* ================================================================
   * Sky, parallax landscape, clouds
   * ================================================================ */
  function floraOf(world) {
    const d = world.deco || [];
    if (d.includes('palm')) return 'palm';
    if (d.includes('pine_snow')) return 'pine';
    if (d.includes('cactus')) return 'cactus';
    if (d.includes('tree') || d.includes('pine')) return 'forest';
    if (d.includes('ice_crystal')) return 'crystal';
    if (d.includes('dead_tree')) return 'dead';
    if (d.includes('lamp') || d.includes('pipe') || d.includes('chimney')) return 'city';
    return 'none';
  }
  /** one silhouette of background flora, base at (x, y), height ~ 40*s */
  function flora(c, kind, x, y, s, color, r) {
    c.fillStyle = color;
    c.strokeStyle = color;
    switch (kind) {
      case 'pine':
      case 'forest':
        if (kind === 'forest' && r() < 0.55) {
          c.fillRect(x - 1.5 * s, y - 14 * s, 3 * s, 14 * s);
          for (const [dx, dy, rr] of [[0, -26, 11], [-8, -18, 8], [8, -19, 8.5], [0, -34, 8]]) {
            c.beginPath();
            c.arc(x + dx * s, y + dy * s, rr * s, 0, TAU);
            c.fill();
          }
        } else {
          c.fillRect(x - 1.2 * s, y - 8 * s, 2.4 * s, 8 * s);
          for (let i = 0; i < 3; i++) poly(c, [x - (11 - i * 2.5) * s, y - (6 + i * 10) * s, x, y - (26 + i * 10) * s, x + (11 - i * 2.5) * s, y - (6 + i * 10) * s]), c.fill();
        }
        break;
      case 'palm':
        c.lineWidth = 2.6 * s;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 6 * s, y - 22 * s, x + 2 * s, y - 42 * s);
        c.stroke();
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI / 2 + (k - 2.5) * 0.6;
          c.beginPath();
          c.ellipse(x + 2 * s + Math.cos(a) * 11 * s, y - 42 * s + Math.sin(a) * 6 * s + 4 * s, 13 * s, 3 * s, a, 0, TAU);
          c.fill();
        }
        break;
      case 'cactus':
        R.rrect(c, x - 2.5 * s, y - 28 * s, 5 * s, 28 * s, 2.5 * s);
        c.fill();
        R.rrect(c, x - 9 * s, y - 20 * s, 4 * s, 11 * s, 2 * s);
        c.fill();
        c.fillRect(x - 7 * s, y - 11 * s, 6 * s, 3 * s);
        R.rrect(c, x + 5 * s, y - 24 * s, 4 * s, 12 * s, 2 * s);
        c.fill();
        c.fillRect(x + 1 * s, y - 14 * s, 6 * s, 3 * s);
        break;
      case 'dead':
        c.lineWidth = 2.2 * s;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y - 26 * s);
        c.moveTo(x, y - 14 * s);
        c.lineTo(x - 9 * s, y - 24 * s);
        c.moveTo(x, y - 19 * s);
        c.lineTo(x + 8 * s, y - 30 * s);
        c.stroke();
        break;
      case 'crystal':
        for (const [dx, h, w] of [[-4, 22, 4], [2, 32, 5], [8, 16, 3.5]]) {
          poly(c, [x + (dx - w) * s, y, x + dx * s, y - h * s, x + (dx + w) * s, y]);
          c.fill();
        }
        break;
      case 'city': {
        const w = r.range(14, 30) * s, h = r.range(20, 60) * s;
        c.fillRect(x, y - h, w, h + 10);
        if (r() < 0.4) c.fillRect(x + w * 0.4, y - h - 14 * s, 3 * s, 14 * s);
        c.fillStyle = 'rgba(255,220,130,0.35)';
        for (let wy = y - h + 4 * s; wy < y - 4 * s; wy += 7 * s) for (let wx = x + 3 * s; wx < x + w - 3 * s; wx += 6 * s) if (r() < 0.35) c.fillRect(wx, wy, 2.5 * s, 3.5 * s);
        break;
      }
    }
  }

  R.buildBackground = function (world, W, H, seed) {
    const layers = [];
    const r = U.rng(seed || 1);
    const art = world.art || {};
    const fog = art.fog || (world.sky ? world.sky[1] : '#888888');
    const kind0 = floraOf(world);
    const cool = ['leaves', 'snow', 'rain', 'clouds'].includes(world.ambient);
    const make = (color, base, amp, per, factor, o) => {
      o = o || {};
      const kind = o.kind || kind0;
      const cw = Math.ceil(W * factor + 2200);
      const cv = document.createElement('canvas');
      cv.width = cw;
      cv.height = H;
      const c = cv.getContext('2d');
      const n = U.noise1D(r.int(1, 1e6), per);
      const n2 = U.noise1D(r.int(1, 1e6), per / 3);
      const n3 = U.noise1D(r.int(1, 1e6), per / 10);
      const ridge = (x) => base + n(x) * amp + n2(x) * amp * 0.3 + (o.jagged ? (Math.abs(n3(x)) - 0.3) * amp * 0.45 : n3(x) * amp * 0.05);
      const body = () => {
        c.beginPath();
        c.moveTo(0, H);
        for (let x = 0; x <= cw; x += 6) c.lineTo(x, ridge(x));
        c.lineTo(cw, H);
        c.closePath();
      };
      const top = base - amp * 1.4;
      const g = c.createLinearGradient(0, top, 0, H);
      g.addColorStop(0, U.shade(color, 0.1));
      g.addColorStop(0.3, color);
      g.addColorStop(1, U.mix(color, fog, o.fogK || 0.4));
      body();
      c.fillStyle = g;
      c.fill();
      c.save();
      body();
      c.clip();
      // soft sunlit band that follows the ridgeline
      c.lineJoin = 'round';
      for (let i = 1; i <= 6; i++) {
        c.strokeStyle = 'rgba(255,250,235,' + (0.05 - i * 0.006) + ')';
        c.lineWidth = 4;
        c.beginPath();
        for (let x = 0; x <= cw; x += 6) c.lineTo(x, ridge(x) + i * 3.5);
        c.stroke();
      }
      if (o.snow) {
        c.fillStyle = U.rgba(U.mix('#ffffff', fog, 0.25), 0.8);
        c.beginPath();
        c.moveTo(0, 0);
        for (let x = 0; x <= cw; x += 8) c.lineTo(x, base - amp * 0.62 + n3(x) * amp * 0.12 + n2(x) * amp * 0.08);
        c.lineTo(cw, 0);
        c.closePath();
        c.fill();
      }
      // haze settles in the valleys
      const hz = c.createLinearGradient(0, base, 0, H);
      hz.addColorStop(0, U.rgba(fog, 0));
      hz.addColorStop(1, U.rgba(fog, o.haze || 0.35));
      c.fillStyle = hz;
      c.fillRect(0, base - amp, cw, H);
      c.restore();
      // rim light on the ridge
      c.strokeStyle = 'rgba(' + (art.rim || '255,255,255') + ',' + (o.rim || 0.14) + ')';
      c.lineWidth = 1.5;
      c.beginPath();
      for (let x = 0; x <= cw; x += 6) c.lineTo(x, ridge(x) + 0.8);
      c.stroke();
      if (o.trees && kind !== 'none') {
        const tc = U.shade(color, o.treeShade == null ? -0.14 : o.treeShade);
        for (let x = r.range(0, 40); x < cw; x += r.range(o.trees[0], o.trees[1])) {
          if (kind === 'city' && r() < 0.5) continue;
          const cluster = kind === 'forest' || kind === 'pine' ? r.int(1, 3) : 1;
          for (let k = 0; k < cluster; k++) {
            const xx = x + k * r.range(6, 12) * o.ts;
            flora(c, kind, xx, ridge(xx) + 3, o.ts * r.range(0.7, 1.15), tc, r);
          }
        }
      }
      if (o.extra) o.extra(c, cw);
      // drifting mist bank settling at the foot of this range
      if (o.mist) {
        const y0 = base - amp * 0.25, y1 = base + amp * 1.6;
        const mg = c.createLinearGradient(0, y0, 0, y1);
        mg.addColorStop(0, U.rgba(fog, 0));
        mg.addColorStop(0.45, U.rgba(fog, o.mist));
        mg.addColorStop(1, U.rgba(fog, o.mist * 0.5));
        c.fillStyle = mg;
        c.fillRect(0, y0, cw, y1 - y0);
        c.fillStyle = U.rgba(fog, o.mist * 0.5);
        for (let x = r.range(0, 200); x < cw; x += r.range(140, 320)) {
          c.beginPath();
          c.ellipse(x, base + amp * r.range(0.1, 0.5), r.range(120, 260), r.range(10, 22), 0, 0, TAU);
          c.fill();
        }
      }
      layers.push({ canvas: cv, factor });
    };
    if (art.ranges) {
      for (const L of art.ranges) make(L.color, H * L.base, L.amp, L.per, L.factor, L);
    } else if (world.factory) {
      make(U.mix(world.hills[0], fog, 0.5), H * 0.42, 120, 480, 0.12, { jagged: true, fogK: 0.6 });
      // skyline of factories
      make(world.hills[0], H * 0.5, 30, 400, 0.25, {
        extra: (c, cw) => {
          c.fillStyle = U.shade(world.hills[0], -0.1);
          for (let x = 0; x < cw; x += r.range(60, 140)) {
            const h = r.range(80, 220), w = r.range(40, 90);
            c.fillRect(x, H * 0.5 - h, w, h + 200);
            if (r() < 0.5) {
              const sx = x + w * 0.3, sh0 = H * 0.5 - h - r.range(40, 90);
              c.fillRect(sx, sh0, 10, 100);
              // smoke plume from the stack
              for (let k = 0; k < 6; k++) {
                c.fillStyle = 'rgba(150,150,150,' + (0.25 - k * 0.035) + ')';
                c.beginPath();
                c.arc(sx + 5 + k * 9, sh0 - 8 - k * 10, 7 + k * 3, 0, TAU);
                c.fill();
              }
              c.fillStyle = U.shade(world.hills[0], -0.1);
            }
          }
        }
      });
      make(world.hills[1], H * 0.62, 25, 250, 0.5, {
        extra: (c, cw) => {
          c.fillStyle = world.hills[1];
          for (let x = 0; x < cw; x += r.range(90, 180)) {
            const h = r.range(60, 150), w = r.range(50, 110);
            c.fillRect(x, H * 0.62 - h, w, h + 100);
            c.fillStyle = 'rgba(255,220,120,0.35)';
            for (let wy = H * 0.62 - h + 10; wy < H * 0.62 - 10; wy += 18) for (let wx = x + 6; wx < x + w - 8; wx += 14) if (r() < 0.4) c.fillRect(wx, wy, 6, 8);
            c.fillStyle = world.hills[1];
          }
        }
      });
    } else if (world.hills) {
      make(U.mix(world.hills[0], fog, 0.4), H * 0.4, 150, 520, 0.12, { jagged: true, snow: cool, fogK: 0.45, rim: 0.2, haze: 0.3 });
      make(world.hills[0], H * 0.47, 100, 340, 0.25, { trees: [14, 34], ts: 0.75, haze: 0.18, fogK: 0.25 });
      make(world.hills[1], H * 0.57, 66, 220, 0.5, { trees: [26, 80], ts: 1.15, rim: 0.16, haze: 0.1, fogK: 0.15 });
    }
    return layers;
  };

  R.drawSky = function (ctx, world, cw, ch, t, camX) {
    const s0 = world.sky[0], s1 = world.sky[1];
    const art = world.art || {};
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    if (art.sky) {
      // painted dusk: several bands, the warmest right at the horizon
      const n = art.sky.length - 1;
      art.sky.forEach((c, i) => g.addColorStop(Math.pow(i / n, 0.85) * 0.8, c));
      g.addColorStop(1, art.sky[n]);
    } else {
      g.addColorStop(0, sh(s0, -0.15));
      g.addColorStop(0.4, mx(s0, s1, 0.4));
      g.addColorStop(0.78, s1);
      g.addColorStop(1, sh(s1, 0.12));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
    if (art.stars) {
      const r = U.rng(7);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 70; i++) {
        const x = (((r() * cw * 1.3 - (camX || 0) * 0.02) % cw) + cw) % cw, y = r() * r() * ch * 0.4;
        ctx.globalAlpha = (0.15 + 0.5 * Math.abs(Math.sin(t * (0.4 + r()) + i))) * (1 - y / (ch * 0.4));
        ctx.fillRect(x, y, 1.4, 1.4);
      }
      ctx.globalAlpha = 1;
    }
    if (world.skyStars || world.id === 10 || world.id === 21) {
      const r = U.rng(99);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 160; i++) {
        const x = (r() * cw * 1.3 - (camX || 0) * 0.03) % cw;
        const y = r() * ch * 0.7;
        ctx.globalAlpha = world.id === 10 ? 0.25 : 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + r()) + i));
        const big = r() < 0.15;
        ctx.fillRect((x + cw) % cw, y, big ? 2 : 1.2, big ? 2 : 1.2);
      }
      ctx.globalAlpha = 1;
    }
    const s = world.sun;
    if (s) {
      const sx = cw * s.x - (camX || 0) * 0.02, sy = ch * s.y, sr = s.r * Math.min(1.4, ch / 700);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // wide atmospheric glow
      const gg = ctx.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 5);
      gg.addColorStop(0, U.rgba(s.color, 0.5));
      gg.addColorStop(0.3, U.rgba(s.color, 0.16));
      gg.addColorStop(1, U.rgba(s.color, 0));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 5, 0, TAU);
      ctx.fill();
      // low sun: a wide horizontal glow smeared along the horizon
      if (s.band) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(1, 0.22);
        const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 0.7);
        bg.addColorStop(0, U.rgba(s.color, s.band));
        bg.addColorStop(1, U.rgba(s.color, 0));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(0, 0, cw * 0.7, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      // slowly turning light rays
      if (!s.planet && !s.noRays) {
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.015);
        ctx.fillStyle = U.rgba(s.color, 0.04);
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * TAU, w = 0.05 + (k % 3) * 0.025, L = sr * (5 + (k % 4) * 1.6);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a - w) * sr * 1.1, Math.sin(a - w) * sr * 1.1);
          ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
          ctx.lineTo(Math.cos(a + w) * sr * 1.1, Math.sin(a + w) * sr * 1.1);
          ctx.fill();
        }
      }
      ctx.restore();
      if (s.planet) {
        const pg = ctx.createRadialGradient(sx - sr * 0.4, sy - sr * 0.4, sr * 0.1, sx, sy, sr);
        pg.addColorStop(0, sh(s.color, 0.45));
        pg.addColorStop(0.7, s.color);
        pg.addColorStop(1, sh(s.color, -0.35));
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(60,160,90,0.8)';
        ctx.beginPath();
        ctx.ellipse(sx - sr * 0.3, sy - sr * 0.1, sr * 0.45, sr * 0.3, 0.4, 0, TAU);
        ctx.ellipse(sx + sr * 0.35, sy + sr * 0.35, sr * 0.3, sr * 0.2, -0.3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(sx - sr * 0.1, sy - sr * 0.55, sr * 0.5, sr * 0.08, 0.1, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,20,0.4)';
        ctx.beginPath();
        ctx.arc(sx + sr * 0.35, sy, sr, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        ctx.strokeStyle = U.rgba(sh(s.color, 0.5), 0.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, sr + 1.5, Math.PI * 0.6, Math.PI * 1.4);
        ctx.stroke();
      } else {
        const dg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
        dg.addColorStop(0, s.flat ? sh(s.color, 0.35) : '#ffffff');
        dg.addColorStop(0.55, sh(s.color, s.flat ? 0.15 : 0.4));
        dg.addColorStop(1, s.color);
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
      }
    }
    // horizon glow
    const hg = ctx.createLinearGradient(0, ch * 0.45, 0, ch);
    hg.addColorStop(0, U.rgba(s ? s.color : s1, 0));
    hg.addColorStop(1, U.rgba(s ? s.color : s1, 0.16));
    ctx.fillStyle = hg;
    ctx.fillRect(0, ch * 0.45, cw, ch * 0.55);
  };

  /** puffy, lit clouds (pre-rendered per world) */
  const cloudCache = {};
  function cloudSprite(world, v) {
    const key = world.id + '_' + v;
    if (cloudCache[key]) return cloudCache[key];
    const cv = document.createElement('canvas');
    cv.width = 300;
    cv.height = 130;
    const c = cv.getContext('2d');
    const base = world.clouds;
    const shade = mx(base, world.sky[0], 0.42);
    const lobes = [];
    const rr0 = U.rng(world.id * 97 + v * 13 + 5);
    for (let i = 0; i < 18; i++) {
      const u = rr0();
      const hump = Math.sin(Math.PI * u);
      lobes.push([40 + u * 220, 94 - hump * (22 + rr0() * 16) + rr0() * 6, 14 + hump * (14 + rr0() * 14)]);
    }
    // one solid silhouette...
    c.fillStyle = base;
    for (const [x, y, rad] of lobes) {
      c.beginPath();
      c.arc(x, y, rad, 0, TAU);
      c.fill();
    }
    // ...lit as a single mass: bright crown, shaded belly
    c.globalCompositeOperation = 'source-atop';
    const vg = c.createLinearGradient(0, 30, 0, 115);
    vg.addColorStop(0, mx(base, '#ffffff', 0.6));
    vg.addColorStop(0.45, base);
    vg.addColorStop(1, shade);
    c.fillStyle = vg;
    c.fillRect(0, 0, 300, 130);
    for (const [x, y, rad] of lobes) {
      const g = c.createRadialGradient(x - rad * 0.25, y - rad * 0.45, 0, x - rad * 0.25, y - rad * 0.45, rad * 0.9);
      g.addColorStop(0, 'rgba(255,255,255,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x - rad * 0.25, y - rad * 0.45, rad * 0.9, 0, TAU);
      c.fill();
    }
    // flatten & soften the base
    c.globalCompositeOperation = 'destination-out';
    const fg = c.createLinearGradient(0, 96, 0, 124);
    fg.addColorStop(0, 'rgba(0,0,0,0)');
    fg.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = fg;
    c.fillRect(0, 96, 300, 34);
    return (cloudCache[key] = cv);
  }

  /** clouds drifting in screen space (far layer + near layer) */
  R.drawClouds = function (ctx, world, cw, ch, t, camX) {
    if (!world.clouds) return;
    const r = U.rng(world.id * 31);
    const dim = world.id === 3 || world.id === 10;
    for (let layer = 0; layer < 2; layer++) {
      const n = layer ? (world.seaOfClouds ? 7 : 5) : 4;
      const par = layer ? 0.08 : 0.04;
      for (let i = 0; i < n; i++) {
        const sp = (6 + r() * 14) * (layer ? 1 : 0.5);
        const w = (80 + r() * 160) * (layer ? 1 : 0.6);
        const span = cw + 500;
        const x = ((((r() * span + t * sp - (camX || 0) * par) % span) + span) % span) - 250;
        const y = ch * (layer ? 0.08 + r() * 0.3 : 0.05 + r() * 0.22);
        const sp2 = cloudSprite(world, (i + layer * 3) % 5);
        const sc = w / 220;
        ctx.globalAlpha = dim ? 0.35 : layer ? 0.92 : 0.6;
        ctx.drawImage(sp2, x - 150 * sc, y - 92 * sc, 300 * sc, 130 * sc);
      }
    }
    ctx.globalAlpha = 1;
  };

  /** thumbnail for world-map cards */
  R.worldThumb = function (world, W, H) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d');
    R.drawSky(c, world, W, H, 1, 0);
    R.drawClouds(c, world, W, H, 0, 0);
    const r = U.rng(world.id * 17);
    const fog = world.sky[1];
    const kind = floraOf(world);
    const hill = (color, base, amp, per, jag, trees) => {
      const n = U.noise1D(r.int(1, 1e5), per), n3 = U.noise1D(r.int(1, 1e5), per / 8);
      const yy = (x) => base + n(x) * amp + (jag ? (Math.abs(n3(x)) - 0.3) * amp * 0.5 : 0);
      const g = c.createLinearGradient(0, base - amp, 0, H);
      g.addColorStop(0, U.shade(color, 0.1));
      g.addColorStop(1, U.mix(color, fog, 0.4));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) c.lineTo(x, yy(x));
      c.lineTo(W, H);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.15)';
      c.lineWidth = 1.2;
      c.beginPath();
      for (let x = 0; x <= W; x += 4) c.lineTo(x, yy(x) + 0.6);
      c.stroke();
      if (trees && kind !== 'none') {
        const s = H / 300;
        for (let x = r() * 30; x < W; x += r.range(18, 50) * s * 2) flora(c, kind, x, yy(x) + 2, s * r.range(0.7, 1.1), U.shade(color, -0.14), r);
      }
    };
    if (world.hills) {
      hill(U.mix(world.hills[0], fog, 0.45), H * 0.44, H * 0.14, W * 0.5, true, false);
      hill(world.hills[0], H * 0.53, H * 0.1, W * 0.4, false, true);
      hill(world.hills[1], H * 0.63, H * 0.07, W * 0.25, false, true);
    }
    const T = world.terrain;
    const n = U.noise1D(world.id * 7, W * 0.3);
    const top = (x) => (world.seaOfClouds ? H * 0.72 + n(x) * H * 0.06 : H * 0.74 + n(x) * H * 0.1);
    if (world.seaOfClouds) {
      for (const [x0, w0] of [[0.05, 0.3], [0.4, 0.2], [0.68, 0.3]]) {
        const cx = W * (x0 + w0 / 2), hw = (W * w0) / 2;
        const ig = c.createLinearGradient(0, H * 0.68, 0, H);
        ig.addColorStop(0, T.soil[0]);
        ig.addColorStop(1, T.soil[2]);
        c.fillStyle = ig;
        c.beginPath();
        c.moveTo(cx - hw, H * 0.7);
        c.quadraticCurveTo(cx, H * 1.05, cx + hw, H * 0.7);
        c.fill();
        c.fillStyle = T.top;
        R.rrect(c, cx - hw, H * 0.675, hw * 2, 6, 3);
        c.fill();
      }
    } else {
      const g = c.createLinearGradient(0, H * 0.65, 0, H);
      g.addColorStop(0, T.soil[0]);
      g.addColorStop(1, T.soil[2]);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= W; x += 3) c.lineTo(x, top(x));
      c.lineTo(W, H);
      c.fill();
      // strata and pebbles
      c.save();
      c.clip();
      c.strokeStyle = 'rgba(0,0,0,0.12)';
      c.lineWidth = Math.max(1, H / 120);
      for (let k = 1; k < 4; k++) {
        c.beginPath();
        for (let x = 0; x <= W; x += 6) c.lineTo(x, top(x) + H * 0.06 * k + n(x * 3 + k * 99) * 4);
        c.stroke();
      }
      c.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 40; i++) {
        const x = r() * W;
        c.beginPath();
        c.ellipse(x, top(x) + H * 0.04 + r() * H * 0.2, 1 + r() * 2.5, 0.8 + r() * 1.5, 0, 0, TAU);
        c.fill();
      }
      c.restore();
      c.strokeStyle = T.top;
      c.lineWidth = Math.max(4, H / 50);
      c.beginPath();
      for (let x = 0; x <= W; x += 3) c.lineTo(x, top(x) + 2);
      c.stroke();
      c.strokeStyle = T.top2 || U.shade(T.top, 0.25);
      c.lineWidth = Math.max(1.5, H / 160);
      c.beginPath();
      for (let x = 0; x <= W; x += 3) c.lineTo(x, top(x));
      c.stroke();
    }
    // decorations
    for (let i = 0; i < 4; i++) {
      const sp = R.decoSprite(world.deco[i % world.deco.length], world);
      const x = W * (0.15 + i * 0.22 + r() * 0.05);
      const s = (H / 260) * 0.8;
      c.drawImage(sp.canvas, x - sp.ax * s, top(x) - sp.ay * s + 3, 120 * s, 120 * s);
    }
    if (world.hazard && (world.hazard.type === 'lava' || world.hazard.type === 'acid' || world.hazard.type === 'swamp')) {
      const hg = c.createLinearGradient(0, H * 0.93, 0, H);
      hg.addColorStop(0, U.shade(world.hazard.color, 0.35));
      hg.addColorStop(1, U.shade(world.hazard.color, -0.3));
      c.fillStyle = hg;
      c.fillRect(0, H * 0.94, W, H * 0.06);
    }
    // gentle vignette
    const vg = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.28)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
    return cv;
  };
})();

