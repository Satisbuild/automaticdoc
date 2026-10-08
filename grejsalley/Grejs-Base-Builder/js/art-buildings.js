'use strict';
/* =====================================================================
   GREJS BASE BUILDER - art-buildings.js
   Every building is drawn procedurally once per (type, level, variant)
   into an offscreen sprite with its soft cast shadow; moving parts
   (turrets, flags, flames, orbs) are drawn live on top.
   ===================================================================== */

const WALL_COLS = ['#9a6a38', '#a8743e', '#c9c2b2', '#b9b6b0', '#d9b44a', '#9a86d0', '#7a8ab0', '#4a4a5a', '#c24a3a', '#2e2a3e'];
const TH_BODY = ['#c08a52', '#c08a52', '#c9c2b2', '#bdb8ae', '#e2cc96', '#e2cc96', '#9a9ab0', '#7a6a8a', '#5a4a7a', '#3e3252'];
const TH_ROOF = ['#c8402f', '#c8402f', '#c8402f', '#2f6fd0', '#2f6fd0', '#7a3ad0', '#7a3ad0', '#34344a', '#d2462f', '#e8b830'];
const GOLD = '#e8b830';

/* approximate heights for cast shadows */
const BH = { townhall: 80, builderhut: 34, goldmine: 48, elixircollector: 50, darkdrill: 50, goldstorage: 34, elixirstorage: 46, darkstorage: 50, armycamp: 16,
  barracks: 50, darkbarracks: 54, laboratory: 46, spellfactory: 56, blacksmith: 48, altar: 16, cannon: 22, archertower: 78, mortar: 18, airdefense: 46,
  wizardtower: 68, xbow: 26, infernotower: 46, eagleartillery: 36, monolith: 80, bossfortress: 90, hiddentrap: 30 };

function door(c, faceAt, u0, u1, z0, h, col) {
  const a = faceAt(u0, z0), b = faceAt(u1, z0), m = faceAt((u0 + u1) / 2, z0 + h + 4);
  const at = faceAt(u0, z0 + h), bt = faceAt(u1, z0 + h);
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(bt[0], bt[1]); c.quadraticCurveTo(m[0], m[1] - 3, at[0], at[1]); c.closePath();
  c.fillStyle = col || '#5a3418'; c.fill(); c.strokeStyle = 'rgba(20,10,0,.7)'; c.lineWidth = 1.6; c.stroke();
  line(c, faceAt((u0 + u1) / 2, z0), faceAt((u0 + u1) / 2, z0 + h + 2), 'rgba(0,0,0,.35)');
  c.fillStyle = '#e8b830'; const k = faceAt(u1 - (u1 - u0) * 0.25, z0 + h * 0.45); c.beginPath(); c.arc(k[0], k[1], 1.2, 0, 7); c.fill();
}
function windowAt(c, faceAt, u0, u1, z0, z1, glow) {
  const pts = [faceAt(u0, z0), faceAt(u1, z0), faceAt(u1, z1), faceAt(u0, z1)];
  poly(c, pts, '#3a2410');
  const ip = [faceAt(u0 + 0.04, z0 + 1.2), faceAt(u1 - 0.04, z0 + 1.2), faceAt(u1 - 0.04, z1 - 1.2), faceAt(u0 + 0.04, z1 - 1.2)];
  const g = c.createLinearGradient(0, ip[2][1], 0, ip[0][1]);
  g.addColorStop(0, glow ? '#fff1a8' : '#bfe4ff'); g.addColorStop(1, glow ? '#ffb030' : '#5aa0d0');
  poly(c, ip, g);
  line(c, faceAt((u0 + u1) / 2, z0 + 1), faceAt((u0 + u1) / 2, z1 - 1), '#3a2410', 1.2);
  line(c, faceAt(u0, (z0 + z1) / 2), faceAt(u1, (z0 + z1) / 2), '#3a2410', 1.2);
  poly(c, pts, null, 'rgba(20,10,0,.7)', 1.2);
}
const LF = y => (u, z) => Pt(u, y, z);     // left face at y
const RF = x => (u, z) => Pt(x, u, z);     // right face at x
function shield(c, x, y, k, col) {
  c.save(); c.translate(x, y); c.scale(k, k);
  c.beginPath(); c.moveTo(-6, -7); c.lineTo(6, -7); c.lineTo(6, 1); c.quadraticCurveTo(6, 6, 0, 9); c.quadraticCurveTo(-6, 6, -6, 1); c.closePath();
  c.fillStyle = col; c.fill(); c.strokeStyle = '#3a2410'; c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = '#e8eef5'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-3.5, -4); c.lineTo(3.5, 4); c.moveTo(3.5, -4); c.lineTo(-3.5, 4); c.stroke();
  c.restore();
}

const BD = {
  townhall(c, s, lv) {
    const body = tier(lv, TH_BODY), roof = tier(lv, TH_ROOF), trim = lv >= 7 ? GOLD : shade(body, 0.3);
    prism(c, 0.2, 0.2, 3.8, 3.8, 0, 7, '#9a958c', { tex: 'stone', seed: 3 });
    if (lv >= 4) { cyl(c, 0.75, 0.75, 0.46, 7, 50, shade(body, -0.05), { tex: 'stone' }); cone(c, 0.75, 0.75, 0.6, 50, 24, roof, { tiles: true }); }
    prism(c, 0.55, 0.55, 3.45, 3.45, 7, 38, body, { tex: lv <= 2 ? 'plank' : 'brick', seed: lv });
    door(c, LF(3.45), 1.55, 2.45, 7, 15, lv >= 7 ? '#4a2a10' : '#6a3a18');
    windowAt(c, LF(3.45), 0.8, 1.2, 24, 32, true); windowAt(c, LF(3.45), 2.8, 3.2, 24, 32, true);
    for (const y of [1.0, 2.4]) windowAt(c, RF(3.45), y, y + 0.5, 16, 28, true);
    prism(c, 0.42, 0.42, 3.58, 3.58, 36, 41, trim);
    pyramid(c, 0.3, 0.3, 3.7, 3.7, 41, lv >= 7 ? 40 : 32, roof);
    // dormer window on the roof
    const dp = Pt(2.6, 3.0, 50);
    c.fillStyle = shade(body, 0.1); c.fillRect(dp[0] - 6, dp[1] - 8, 12, 9); c.strokeStyle = OUT; c.strokeRect(dp[0] - 6, dp[1] - 8, 12, 9);
    c.fillStyle = '#ffe27a'; c.fillRect(dp[0] - 3.5, dp[1] - 6, 7, 5);
    if (lv >= 4) for (const [x, y] of [[0.75, 3.25], [3.25, 3.25], [3.25, 0.75]]) { cyl(c, x, y, 0.46, 7, 50, shade(body, -0.05), { tex: 'stone' }); windowAt(c, (u, z) => Pt(x + 0.3, y + 0.3 + (u - 0.5) * 0.4, z), 0.35, 0.65, 30, 38, true); cone(c, x, y, 0.6, 50, 24, roof, { tiles: true }); }
    if (lv >= 9) { const a = Pt(2, 2, 41 + 40); sphere(c, a[0], a[1] - 5, 6, '#ffd23f', '#ffd23f'); }
  },
  builderhut(c, s) {
    prism(c, 0.1, 0.1, 1.9, 1.9, 0, 3, '#9a8a6a');
    prism(c, 0.3, 0.3, 1.7, 1.7, 3, 19, WOOD, { tex: 'logs' });
    door(c, LF(1.7), 0.75, 1.2, 3, 10);
    windowAt(c, RF(1.7), 0.7, 1.15, 9, 15, true);
    prism(c, 1.25, 0.45, 1.5, 0.7, 19, 34, '#8a7a70', { tex: 'brick' });
    pyramid(c, 0.15, 0.15, 1.85, 1.85, 19, 16, '#d0503a');
  },
  goldmine(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 3, '#8a6a40');
    cone(c, 1.35, 1.25, 1.15, 3, 26, '#8a6a4a');
    poly(c, [Pt(1.6, 2.15, 3), Pt(2.25, 1.85, 3), Pt(2.1, 1.75, 18), Pt(1.55, 2.05, 18)], '#1a1008', OUT);
    const wood = lv >= 6 ? '#8a8a9a' : WOOD;
    prism(c, 1.5, 2.0, 1.65, 2.15, 3, 22, wood); prism(c, 2.2, 1.65, 2.35, 1.8, 3, 22, wood);
    prism(c, 1.45, 1.6, 2.4, 2.2, 22, 25, shade(wood, -0.1));
    for (let i = 0; i < 9; i++) { const p = Pt(2.1 + (i % 3) * 0.18, 2.4 + Math.floor(i / 3) * 0.12, 3 + (i % 2) * 2); sphere(c, p[0], p[1], 2.4, '#ffd23f'); }
    prism(c, 0.4, 2.3, 1.1, 2.75, 3, 9, '#6a5a50', { tex: 'plank' });
    for (const k of [0.55, 0.95]) { const p = Pt(k, 2.75, 3); c.fillStyle = '#2a2a34'; c.beginPath(); c.ellipse(p[0], p[1], 3, 2, 0, 0, 7); c.fill(); }
    for (let i = 0; i < 5; i++) { const p = Pt(0.55 + i * 0.12, 2.5, 10); sphere(c, p[0], p[1], 2.2, '#ffd23f'); }
  },
  elixircollector(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 3, '#8a7a9a', { tex: 'stone' });
    cyl(c, 1.5, 1.5, 0.95, 3, 14, lv >= 6 ? '#8a8aa0' : '#a0703a', { tex: lv >= 6 ? 'stone' : 'brick', bands: [13] });
    for (const [x, y] of [[0.75, 1.5], [2.25, 1.5]]) prism(c, x - 0.12, y - 0.12, x + 0.12, y + 0.12, 14, 46, '#6a6a7a', { tex: 'metal' });
    prism(c, 0.55, 1.32, 2.45, 1.68, 46, 50, '#5a5a6a');
    const p = Pt(1.5, 1.5, 31);
    c.save(); c.globalAlpha = 0.9;
    const g = c.createRadialGradient(p[0] - 6, p[1] - 6, 2, p[0], p[1], 18);
    g.addColorStop(0, '#ffd0ff'); g.addColorStop(0.5, '#d64bff'); g.addColorStop(1, '#6a0a8a');
    c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], 17, 0, 7); c.fill(); c.restore();
    c.strokeStyle = OUT; c.lineWidth = 1; c.beginPath(); c.arc(p[0], p[1], 17, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.65)'; c.beginPath(); c.ellipse(p[0] - 7, p[1] - 8, 5, 3, -0.6, 0, 7); c.fill();
  },
  darkdrill(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 3, '#3a3048', { tex: 'stone' });
    prism(c, 0.55, 0.55, 2.45, 2.45, 3, 16, '#4a4258', { tex: 'metal' });
    for (const [x, y] of [[0.7, 0.7], [2.3, 0.7], [0.7, 2.3], [2.3, 2.3]]) prism(c, x - 0.08, y - 0.08, x + 0.08, y + 0.08, 16, 44, '#6a6278', { tex: 'metal' });
    cone(c, 1.5, 1.5, 0.75, 16, 22, '#8a8298');
    const p = Pt(1.5, 1.5, 44); sphere(c, p[0], p[1], 9, '#3a2468', '#a080ff');
  },
  goldstorage(c, s, lv, fill) {
    const f = (fill || 0) / 4;
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 3, '#8a7a5a', { tex: 'stone' });
    prism(c, 0.35, 0.35, 2.65, 2.65, 3, 22, lv >= 6 ? '#8a8a9a' : WOOD, { tex: lv >= 6 ? 'metal' : 'plank', top: '#3a2410' });
    for (const z of [8, 17]) prism(c, 0.33, 0.33, 2.67, 2.67, z, z + 2.2, lv >= 4 ? GOLD : '#5a5a6a');
    if (f > 0) {
      cone(c, 1.5, 1.5, 0.95, 22, 4 + f * 12, '#f0c030');
      for (let i = 0; i < 6 + f * 12; i++) { const a = i * 2.4, rr = (i % 4) * 0.2; const p = Pt(1.5 + Math.cos(a) * rr, 1.5 + Math.sin(a) * rr, 22 + (4 + f * 12) * (1 - rr / 0.9) * 0.6); c.fillStyle = '#ffe27a'; c.beginPath(); c.ellipse(p[0], p[1], 3, 1.6, 0, 0, 7); c.fill(); c.strokeStyle = '#b8740a'; c.lineWidth = 0.8; c.stroke(); }
    }
  },
  elixirstorage(c, s, lv, fill) {
    const f = (fill || 0) / 4;
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 3, '#8a7a9a', { tex: 'stone' });
    const metal = lv >= 5 ? GOLD : '#8a8a9a';
    cyl(c, 1.5, 1.5, 1.1, 3, 10, '#6a6a7a', { tex: 'stone' });
    // glass back wall, liquid, then glass front with reflections
    const p = Pt(1.5, 1.5, 0), rx = 0.98 * CRX, ry = 0.98 * CRY;
    c.fillStyle = 'rgba(200,230,255,.25)'; c.fillRect(p[0] - rx, p[1] - 40, rx * 2, 30);
    if (f > 0) cyl(c, 1.5, 1.5, 0.96, 10, 10 + 28 * f, '#b02ad8', { top: '#f39cff' });
    c.save();
    const gl = c.createLinearGradient(p[0] - rx, 0, p[0] + rx, 0);
    gl.addColorStop(0, 'rgba(255,255,255,.08)'); gl.addColorStop(0.22, 'rgba(255,255,255,.55)'); gl.addColorStop(0.32, 'rgba(255,255,255,.1)'); gl.addColorStop(0.8, 'rgba(255,255,255,.05)'); gl.addColorStop(0.92, 'rgba(255,255,255,.3)'); gl.addColorStop(1, 'rgba(255,255,255,.05)');
    c.fillStyle = gl; c.beginPath(); c.ellipse(p[0], p[1] - 10, rx, ry, 0, 0, Math.PI); c.lineTo(p[0] - rx, p[1] - 40); c.ellipse(p[0], p[1] - 40, rx, ry, 0, Math.PI, 0, true); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(40,20,60,.5)'; c.lineWidth = 1; c.stroke();
    c.restore();
    for (const [x, y] of [[0.55, 2.45], [2.45, 2.45], [2.45, 0.55]]) prism(c, x - 0.07, y - 0.07, x + 0.07, y + 0.07, 10, 40, metal);
    cyl(c, 1.5, 1.5, 1.08, 38, 42, metal, { top: shade(metal, 0.1) });
    cone(c, 1.5, 1.5, 0.75, 42, 9, metal);
    const tp = Pt(1.5, 1.5, 53); sphere(c, tp[0], tp[1], 3.5, '#f39cff', '#d64bff');
  },
  darkstorage(c, s, lv, fill) {
    const f = (fill || 0) / 4;
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 3, '#3a3048', { tex: 'stone' });
    cyl(c, 1.5, 1.5, 1.12, 3, 9, '#2a2438', { tex: 'stone' });
    if (f > 0) cyl(c, 1.5, 1.5, 0.98, 9, 9 + 24 * f, '#3a2468', { top: '#8a60e0' });
    c.save(); c.globalAlpha = 0.25; cyl(c, 1.5, 1.5, 1.02, 9, 34, '#c0b0ff', { noTop: true }); c.restore();
    for (const z of [9, 21, 33]) cyl(c, 1.5, 1.5, 1.12, z, z + 3, '#4a4258', { noTop: z !== 33 });
    cone(c, 1.5, 1.5, 0.75, 36, 14, '#2a2438', { tiles: true });
  },
  armycamp(c, s, lv) {
    const p0 = Pt(2, 2, 0);
    const g = c.createRadialGradient(p0[0], p0[1], 10, p0[0], p0[1], 90);
    g.addColorStop(0, '#c8a070'); g.addColorStop(1, 'rgba(160,128,80,.0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(p0[0], p0[1], 88, 44, 0, 0, 7); c.fill();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const p = Pt(2 + Math.cos(a) * 0.5, 2 + Math.sin(a) * 0.5, 2); sphere(c, p[0], p[1], 3.4, '#9aa3ad'); }
    for (const [x, y, rot] of [[1.2, 2.9, 0], [2.9, 1.2, 1]]) prism(c, rot ? x - 0.12 : x - 0.4, rot ? y - 0.4 : y - 0.12, rot ? x + 0.12 : x + 0.4, rot ? y + 0.4 : y + 0.12, 0, 5, '#8a5a2b', { tex: 'logs' });
    const tc = lv >= 5 ? '#2f6fd0' : '#c8402f';
    for (const [x, y] of [[0.85, 0.85], [3.15, 0.85], [0.85, 3.15]]) {
      pyramid(c, x - 0.55, y - 0.55, x + 0.55, y + 0.55, 0, 24, tc, { tiles: false });
      poly(c, [Pt(x - 0.2, y + 0.55, 0), Pt(x + 0.2, y + 0.55, 0), Pt(x, y + 0.42, 14)], '#3a2410');
    }
    prism(c, 3.0, 2.85, 3.5, 3.0, 0, 16, '#8a5a2b', { tex: 'plank' });
    for (let i = 0; i < 3; i++) { const p = Pt(3.1 + i * 0.15, 3.05, 6); line(c, p, [p[0] + 1, p[1] - 14], '#c8d0d8', 2); }
  },
  barracks(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#9a958c', { tex: 'stone' });
    const body = lv >= 7 ? '#9a9ab0' : lv >= 4 ? '#d2c08e' : WOOD;
    prism(c, 0.4, 0.4, 2.6, 2.6, 4, 27, body, { tex: lv >= 4 ? 'brick' : 'logs', seed: 5 });
    door(c, LF(2.6), 1.1, 1.9, 4, 13);
    windowAt(c, RF(2.6), 0.9, 1.3, 13, 21, true); windowAt(c, RF(2.6), 1.7, 2.1, 13, 21, true);
    pyramid(c, 0.25, 0.25, 2.75, 2.75, 27, 24, lv >= 7 ? '#2f6fd0' : ROOF);
    const p = Pt(2.6, 1.5, 24); shield(c, p[0], p[1] + 6, 0.9, lv >= 7 ? '#2f6fd0' : '#c8402f');
  },
  darkbarracks(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#3a3048', { tex: 'stone' });
    prism(c, 0.4, 0.4, 2.6, 2.6, 4, 28, '#4a4258', { tex: 'stone', seed: 9 });
    door(c, LF(2.6), 1.1, 1.9, 4, 13, '#2a1a3a');
    for (const y of [0.9, 1.7]) windowAt(c, RF(2.6), y, y + 0.4, 13, 21, false);
    pyramid(c, 0.25, 0.25, 2.75, 2.75, 28, 28, '#2a2438');
    for (const [x, y] of [[0.4, 2.6], [2.6, 2.6], [2.6, 0.4]]) { const p = Pt(x, y, 28); c.fillStyle = '#c8d0d8'; c.beginPath(); c.moveTo(p[0] - 2.5, p[1]); c.lineTo(p[0], p[1] - 12); c.lineTo(p[0] + 2.5, p[1]); c.fill(); }
  },
  laboratory(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#9a9aa8', { tex: 'stone' });
    prism(c, 0.45, 0.45, 2.55, 2.55, 4, 24, '#d4d8de', { tex: 'brick', seed: 2 });
    door(c, LF(2.55), 1.2, 1.8, 4, 11, '#3a5a8a');
    for (const y of [0.9, 1.9]) windowAt(c, RF(2.55), y, y + 0.35, 11, 19, false);
    prism(c, 0.4, 0.4, 2.6, 2.6, 24, 27, '#8a96a6');
    const p = Pt(1.5, 1.5, 27);
    c.beginPath(); c.ellipse(p[0], p[1], 34, 17, 0, Math.PI, 0); c.ellipse(p[0], p[1], 34, 17, 0, 0, Math.PI); c.closePath();
    c.beginPath(); c.moveTo(p[0] - 34, p[1]); c.bezierCurveTo(p[0] - 34, p[1] - 40, p[0] + 34, p[1] - 40, p[0] + 34, p[1]); c.ellipse(p[0], p[1], 34, 17, 0, 0, Math.PI); c.closePath();
    const g = c.createRadialGradient(p[0] - 12, p[1] - 22, 2, p[0], p[1] - 10, 42); g.addColorStop(0, '#f2fdff'); g.addColorStop(0.5, '#7fd4ff'); g.addColorStop(1, '#2a6aa0');
    c.fillStyle = g; c.fill(); c.strokeStyle = OUT; c.stroke();
    for (const a of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(p[0] + a * 60, p[1] + Math.abs(a) * 4); c.quadraticCurveTo(p[0] + a * 40, p[1] - 30, p[0], p[1] - 30); c.strokeStyle = 'rgba(40,70,100,.45)'; c.lineWidth = 1.2; c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(p[0] - 14, p[1] - 18, 7, 3.5, -0.5, 0, 7); c.fill();
    prism(c, 2.15, 0.55, 2.4, 0.8, 24, 42, '#7a8a9a', { tex: 'metal' });
  },
  spellfactory(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#7a6a9a', { tex: 'stone' });
    cyl(c, 1.5, 1.5, 1.0, 4, 32, '#9a8ac0', { tex: 'stone', bands: [30], bandCol: GOLD });
    windowAt(c, (u, z) => Pt(1.5 + 0.7, 1.5 + 0.7 + (u - 0.5) * 0.5, z), 0.3, 0.7, 14, 24, false);
    cone(c, 1.5, 1.5, 1.15, 32, 22, '#7a3ad0', { tiles: true });
  },
  blacksmith(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#7a6a5a', { tex: 'stone' });
    prism(c, 0.45, 0.45, 2.55, 2.55, 4, 20, '#8a7a6a', { tex: 'stone', seed: 4 });
    prism(c, 1.9, 0.5, 2.4, 1.0, 20, 48, '#7a5a4a', { tex: 'brick' });
    c.save(); c.shadowColor = '#ff8a2a'; c.shadowBlur = 12 * SPR_R;
    door(c, LF(2.55), 0.9, 2.0, 4, 9, '#ff7a1a');
    c.restore();
    pyramid(c, 0.35, 0.35, 2.65, 2.65, 20, 12, '#4a3a30');
    prism(c, 2.75, 1.25, 3.05, 1.75, 3, 9, '#4a4a58', { tex: 'metal' });
    prism(c, 2.68, 1.15, 3.12, 1.85, 9, 12, '#5a5a6a');
  },
  altar(c, s) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#9a9aa8', { tex: 'stone' });
    cyl(c, 1.5, 1.5, 1.2, 4, 10, '#c2baa8', { tex: 'stone' });
    cyl(c, 1.5, 1.5, 0.95, 10, 14, '#ddd4c0', { bands: [12], bandCol: GOLD });
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; const p = Pt(1.5 + Math.cos(a) * 1.05, 1.5 + Math.sin(a) * 1.05, 4); c.fillStyle = '#7fd4ff'; c.beginPath(); c.arc(p[0], p[1] - 3, 2, 0, 7); c.fill(); }
  },
  cannon(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#9a958c', { tex: 'stone' });
    const col = lv >= 7 ? '#8a8a9a' : lv >= 4 ? STONE : WOOD;
    prism(c, 0.55, 0.55, 2.45, 2.45, 4, 14, col, { tex: lv >= 4 ? 'stone' : 'plank', seed: 6 });
    if (lv >= 6) prism(c, 0.5, 0.5, 2.5, 2.5, 13, 15.5, GOLD);
  },
  archertower(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#9a958c', { tex: 'stone' });
    const w = lv >= 6 ? '#bdb8ae' : WOOD;
    if (lv >= 6) prism(c, 0.65, 0.65, 2.35, 2.35, 4, 46, w, { tex: 'stone', seed: lv });
    else {
      for (const [x, y] of [[0.7, 0.7], [2.1, 0.7], [0.7, 2.1], [2.1, 2.1]]) prism(c, x, y, x + 0.22, y + 0.22, 4, 46, w, { tex: 'logs' });
      for (const z of [16, 30]) { line(c, Pt(0.8, 2.3, z), Pt(2.2, 2.3, z + 10), shade(w, -0.3), 3); line(c, Pt(2.3, 0.8, z), Pt(2.3, 2.2, z + 10), shade(w, -0.4), 3); }
    }
    prism(c, 0.5, 0.5, 2.5, 2.5, 46, 50, shade(w, -0.1), { topTex: 'plank' });
    for (let i = 0; i < 5; i++) { prism(c, 0.5 + i * 0.45, 2.35, 0.65 + i * 0.45, 2.5, 50, 57, shade(w, 0.05)); prism(c, 2.35, 0.5 + i * 0.45, 2.5, 0.65 + i * 0.45, 50, 57, shade(w, 0.05)); }
    if (lv >= 4) {
      for (const [x, y] of [[0.55, 2.45], [2.45, 2.45], [2.45, 0.55]]) prism(c, x - 0.05, y - 0.05, x + 0.05, y + 0.05, 50, 70, '#5a3a20');
      pyramid(c, 0.4, 0.4, 2.6, 2.6, 70, 16, lv >= 8 ? '#2f6fd0' : ROOF);
    }
  },
  mortar(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#9a958c', { tex: 'stone' });
    const bag = lv >= 5 ? '#a9adb5' : '#d2be8a';
    const p0 = Pt(1.5, 1.5, 4);
    c.fillStyle = '#2a2018'; c.beginPath(); c.ellipse(p0[0], p0[1], 44, 22, 0, 0, 7); c.fill();
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + ring * 0.22;
      const x = p0[0] + Math.cos(a) * 46, y = p0[1] + Math.sin(a) * 23 - ring * 6;
      c.fillStyle = shade(bag, Math.sin(a) * 0.15 - 0.05); c.strokeStyle = OUT; c.lineWidth = 1;
      c.beginPath(); c.ellipse(x, y, 9, 5.5, a, 0, 7); c.fill(); c.stroke();
    }
  },
  airdefense(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#8a8a9a', { tex: 'stone' });
    const col = lv >= 5 ? '#6a7a8a' : '#a9adb5';
    prism(c, 0.55, 0.55, 2.45, 2.45, 4, 18, col, { tex: 'stone' });
    prism(c, 0.75, 0.75, 2.25, 2.25, 18, 36, shade(col, -0.05), { tex: 'metal' });
    prism(c, 0.6, 0.6, 2.4, 2.4, 34, 38, '#c8402f');
    for (let i = 0; i < 4; i++) { const p = Pt(0.75 + i * 0.5, 2.25, 26); c.fillStyle = i % 2 ? '#ffd23f' : '#2a2a34'; c.fillRect(p[0] - 3, p[1] - 3, 6, 6); }
  },
  wizardtower(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#9a9aa8', { tex: 'stone' });
    cyl(c, 1.5, 1.5, 0.98, 4, 38, lv >= 5 ? '#9a8ac0' : '#d2c08e', { tex: 'stone', bands: [36], bandCol: GOLD });
    windowAt(c, (u, z) => Pt(1.5 + 0.69, 1.5 + 0.69 + (u - 0.5) * 0.5, z), 0.3, 0.7, 18, 28, true);
    door(c, (u, z) => Pt(1.5 + (u - 0.5) * 0.6, 1.5 + 0.98, z), 0.25, 0.75, 4, 10, '#4a2a6a');
    cone(c, 1.5, 1.5, 1.18, 38, 30, '#7a3ad0', { tiles: true });
  },
  xbow(c, s, lv) {
    prism(c, 0.1, 0.1, 2.9, 2.9, 0, 4, '#6a6a7a', { tex: 'stone' });
    prism(c, 0.45, 0.45, 2.55, 2.55, 4, 16, '#7a7a8a', { tex: 'stone' });
    prism(c, 0.4, 0.4, 2.6, 2.6, 15, 18, GOLD);
  },
  infernotower(c, s, lv) {
    prism(c, 0.05, 0.05, 1.95, 1.95, 0, 4, '#3a2a2a', { tex: 'stone' });
    cyl(c, 1, 1, 0.72, 4, 30, '#4a3838', { tex: 'stone' });
    cyl(c, 1, 1, 0.8, 30, 34, '#2a1a1a', { bands: [32], bandCol: '#ff7a1a' });
  },
  eagleartillery(c, s, lv) {
    prism(c, 0.1, 0.1, 3.9, 3.9, 0, 5, '#7a7a8a', { tex: 'stone' });
    prism(c, 0.4, 0.4, 3.6, 3.6, 5, 24, '#b4b1aa', { tex: 'stone', seed: 8 });
    prism(c, 0.35, 0.35, 3.65, 3.65, 22, 26, GOLD);
    for (let i = 0; i < 6; i++) { prism(c, 0.35 + i * 0.58, 3.45, 0.6 + i * 0.58, 3.65, 26, 32, '#b4b1aa'); prism(c, 3.45, 0.35 + i * 0.58, 3.65, 0.6 + i * 0.58, 26, 32, '#b4b1aa'); }
  },
  monolith(c, s, lv) {
    prism(c, 0.05, 0.05, 1.95, 1.95, 0, 5, '#2a2438', { tex: 'stone' });
    prism(c, 0.5, 0.5, 1.5, 1.5, 5, 64, '#2e2840', { tex: 'stone', seed: 13 });
    pyramid(c, 0.5, 0.5, 1.5, 1.5, 64, 16, '#3a3050', { tiles: false });
  },
  bossfortress(c, s, lv) {
    prism(c, 0.1, 0.1, 3.9, 3.9, 0, 6, '#2a2030', { tex: 'stone' });
    cyl(c, 0.6, 0.6, 0.5, 6, 54, '#4a4058', { tex: 'stone' }); cone(c, 0.6, 0.6, 0.64, 54, 24, '#8a1a2a', { tiles: true });
    prism(c, 0.4, 0.4, 3.6, 3.6, 6, 38, '#3a3048', { tex: 'stone', seed: 17 });
    poly(c, [Pt(1.6, 3.6, 6), Pt(2.4, 3.6, 6), Pt(2.4, 3.6, 24), Pt(2, 3.6, 30), Pt(1.6, 3.6, 24)], '#ff3a3a', OUT);
    for (let i = 0; i < 6; i++) { prism(c, 0.4 + i * 0.55, 3.4, 0.62 + i * 0.55, 3.6, 38, 45, '#4a4058'); prism(c, 3.4, 0.4 + i * 0.55, 3.6, 0.62 + i * 0.55, 38, 45, '#4a4058'); }
    pyramid(c, 0.9, 0.9, 3.1, 3.1, 38, 42, '#1a1020');
    for (const [x, y] of [[3.4, 0.6], [0.6, 3.4], [3.4, 3.4]]) { cyl(c, x, y, 0.5, 6, 54, '#4a4058', { tex: 'stone' }); cone(c, x, y, 0.64, 54, 24, '#8a1a2a', { tiles: true }); }
  },
  hiddentrap(c, s, lv, fill, revealed) {
    if (!revealed) { const p = Pt(1, 1, 0); c.beginPath(); c.ellipse(p[0], p[1], 24, 12, 0, 0, Math.PI * 2); c.fillStyle = '#4a4a58'; c.fill(); c.strokeStyle = OUT; c.stroke(); for (const a of [-12, 0, 12]) line(c, [p[0] + a, p[1] - 8], [p[0] + a, p[1] + 8], 'rgba(0,0,0,.4)', 2); return; }
    prism(c, 0.05, 0.05, 1.95, 1.95, 0, 4, '#4a4a58', { tex: 'metal' });
    cyl(c, 1, 1, 0.4, 4, 30, '#6a6a7a', { tex: 'stone' });
    for (const z of [10, 17, 24]) cyl(c, 1, 1, 0.55, z, z + 2.5, GOLD);
    const p = Pt(1, 1, 36); sphere(c, p[0], p[1], 8, '#7fd4ff', '#7fd4ff');
  },
  bomb(c) { const p = Pt(0.5, 0.5, 6); sphere(c, p[0], p[1], 7, '#2a2a34'); c.strokeStyle = '#ffcf3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(p[0] + 3, p[1] - 6); c.quadraticCurveTo(p[0] + 8, p[1] - 9, p[0] + 6, p[1] - 12); c.stroke(); },
  giantbomb(c) { const p = Pt(1, 1, 11); sphere(c, p[0], p[1], 13, '#2a2a34'); c.strokeStyle = '#ffcf3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(p[0] + 6, p[1] - 11); c.quadraticCurveTo(p[0] + 14, p[1] - 16, p[0] + 10, p[1] - 20); c.stroke(); },
  springtrap(c) { const p = Pt(0.5, 0.5, 0); for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(p[0], p[1] - i * 3, 11, 5, 0, 0, Math.PI * 2); c.strokeStyle = '#9aa3ad'; c.lineWidth = 2; c.stroke(); } prism(c, 0.15, 0.15, 0.85, 0.85, 12, 14, '#a0703a', { topTex: 'plank' }); },
  airbomb(c) { const p = Pt(0.5, 0.5, 9); sphere(c, p[0], p[1], 7, '#c0392b'); poly(c, [[p[0] - 3, p[1] + 5], [p[0] + 3, p[1] + 5], [p[0] + 5, p[1] + 11], [p[0] - 5, p[1] + 11]], '#7a1a10', OUT); },
  freezetrap(c) { const p = Pt(0.5, 0.5, 0); poly(c, [[p[0], p[1] - 22], [p[0] + 8, p[1] - 8], [p[0], p[1] + 2], [p[0] - 8, p[1] - 8]], '#bdf3ff', '#2a6a9a'); poly(c, [[p[0], p[1] - 22], [p[0] + 8, p[1] - 8], [p[0], p[1] - 9]], '#e8fbff'); },
};
BD.kingaltar = BD.queenaltar = BD.wardenaltar = BD.championaltar = BD.altar;

/* cast shadow (light from the top-left) + contact shadow */
function castShadow(c, s, h) {
  const m = 0.12;
  const T = Pt(m, m), R = Pt(s - m, m), B = Pt(s - m, s - m), L = Pt(m, s - m);
  const ox = h * 0.62, oy = h * 0.2, sh = s > 2 ? 0.82 : 0.7;
  const cx = (T[0] + B[0]) / 2 + ox, cy = (T[1] + B[1]) / 2 + oy;
  const off = p => [cx + (p[0] - (T[0] + B[0]) / 2) * sh, cy + (p[1] - (T[1] + B[1]) / 2) * sh];
  softShadow(c, hull([T, R, B, L, off(T), off(R), off(B), off(L)]), 9, 0.34);
  const e = -0.05;
  softShadow(c, [Pt(e, e), Pt(s - e, e), Pt(s - e, s - e), Pt(e, s - e)], 4, 0.3);
}

/* Building sprites are rendered once per (type, level, variant). */
const SPR = new Map();
function spriteR() { return hiQ() ? 2 : 1; }
function makeSprite(key, s, hmax, extra, draw) {
  let sp = SPR.get(key);
  if (sp) return sp;
  const R = spriteR(), padL = 16, padR = 80 + extra, padT = 12, padB = 34;
  const wpx = 2 * s * HW + padL + padR, hpx = s * THT + hmax + padT + padB;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(wpx * R); cv.height = Math.ceil(hpx * R);
  const c = cv.getContext('2d');
  SPR_R = R;
  c.scale(R, R); c.translate(padL + s * HW, padT + hmax);
  draw(c);
  sp = { cv: cv, ax: padL + s * HW, ay: padT + hmax, R: R, w: wpx, h: hpx };
  SPR.set(key, sp);
  return sp;
}
function spriteFor(t, lv, fill, revealed) {
  const s = D.bdef(t).size;
  return makeSprite(t + ':' + lv + ':' + (fill || 0) + ':' + (revealed ? 1 : 0), s, 130, 0, c => {
    const def = D.bdef(t);
    if (def.cat !== 'trap' && !(t === 'hiddentrap' && !revealed)) castShadow(c, s, BH[def.cat === 'hero' ? 'altar' : t] || 26);
    (BD[t] || BD.cannon)(c, s, lv, fill, revealed);
  });
}
function wallSprite(lv, mask) {
  return makeSprite('wall:' + lv + ':' + mask, 2, 50, 0, c => {
    const col = tier(lv, WALL_COLS);
    // shadow
    softShadowShapes(c, [[Pt(0.1, 0.1), Pt(0.9, 0.1), [Pt(0.9, 0.9)[0] + 12, Pt(0.9, 0.9)[1] + 4], [Pt(0.1, 0.9)[0] + 12, Pt(0.1, 0.9)[1] + 4]]].concat(mask & 1 ? [[Pt(0.6, 0.3), Pt(1.4, 0.3), [Pt(1.4, 0.7)[0] + 10, Pt(1.4, 0.7)[1] + 3], [Pt(0.6, 0.7)[0] + 10, Pt(0.6, 0.7)[1] + 3]]] : []).concat(mask & 2 ? [[Pt(0.3, 0.6), Pt(0.7, 0.6), [Pt(0.7, 1.4)[0] + 10, Pt(0.7, 1.4)[1] + 3], [Pt(0.3, 1.4)[0] + 10, Pt(0.3, 1.4)[1] + 3]]] : []), 4, 0.3);
    if (lv <= 2) {
      // wooden palisade
      const log = (x0, y0, x1, y1, z0, z1) => prism(c, x0, y0, x1, y1, z0, z1, col, { tex: 'logs' });
      if (mask & 2) { log(0.42, 0.6, 0.58, 1.4, 5, 8); log(0.42, 0.6, 0.58, 1.4, 14, 17); }
      if (mask & 1) { log(0.6, 0.42, 1.4, 0.58, 5, 8); log(0.6, 0.42, 1.4, 0.58, 14, 17); }
      prism(c, 0.32, 0.32, 0.68, 0.68, 0, 20, col, { tex: 'logs' });
      pyramid(c, 0.32, 0.32, 0.68, 0.68, 20, 7, shade(col, 0.1), { tiles: false });
      return;
    }
    const capCol = lv >= 5 ? GOLD : shade(col, 0.18);
    if (mask & 2) { prism(c, 0.28, 0.6, 0.72, 1.4, 0, 15, col, { tex: 'stone', seed: lv }); prism(c, 0.24, 0.6, 0.76, 1.4, 15, 18, capCol); }
    if (mask & 1) { prism(c, 0.6, 0.28, 1.4, 0.72, 0, 15, col, { tex: 'stone', seed: lv + 1 }); prism(c, 0.6, 0.24, 1.4, 0.76, 15, 18, capCol); }
    prism(c, 0.14, 0.14, 0.86, 0.86, 0, 20, col, { tex: 'stone', seed: lv + 2 });
    prism(c, 0.1, 0.1, 0.9, 0.9, 20, 24, capCol);
    if (lv >= 7) { const p = Pt(0.5, 0.5, 24); c.fillStyle = '#d8dee6'; c.strokeStyle = OUT; c.beginPath(); c.moveTo(p[0] - 4, p[1]); c.lineTo(p[0], p[1] - 12); c.lineTo(p[0] + 4, p[1]); c.closePath(); c.fill(); c.stroke(); }
    if (lv >= 9) { c.save(); c.shadowColor = '#c080ff'; c.shadowBlur = 6 * SPR_R; line(c, Pt(0.14, 0.86, 10), Pt(0.86, 0.86, 10), '#c080ff', 1.5); line(c, Pt(0.86, 0.86, 10), Pt(0.86, 0.14, 10), '#a060e0', 1.5); c.restore(); }
  });
}
function rubbleSprite(s) {
  return makeSprite('rubble:' + s, s, 24, 0, c => {
    const p0 = Pt(s / 2, s / 2);
    const rr = s * 24;
    c.save(); c.scale(1, 0.5);
    const g = c.createRadialGradient(p0[0], p0[1] * 2, 2, p0[0], p0[1] * 2, rr);
    g.addColorStop(0, 'rgba(30,18,8,.55)'); g.addColorStop(0.6, 'rgba(50,34,18,.3)'); g.addColorStop(1, 'rgba(50,34,18,0)');
    c.fillStyle = g; c.beginPath(); c.arc(p0[0], p0[1] * 2, rr, 0, 7); c.fill(); c.restore();
    let seed = s * 97;
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 4 + s * 2; i++) { const p = Pt(0.3 + r() * (s - 0.6), 0.3 + r() * (s - 0.6), 2); line(c, p, [p[0] + (r() - .5) * 20, p[1] - r() * 8], '#3a2410', 3); }
    for (let i = 0; i < 8 + s * 6; i++) {
      const p = Pt(0.25 + r() * (s - 0.5), 0.25 + r() * (s - 0.5), r() * 5), sz = 3 + r() * 5;
      const col = ['#8a8a92', '#9a8a7a', '#6a6a72', '#a89a88'][i % 4];
      poly(c, [[p[0] - sz, p[1]], [p[0] - sz * .3, p[1] - sz * .9], [p[0] + sz, p[1] - sz * .4], [p[0] + sz * .4, p[1] + sz * .4]], col, OUT, 0.8);
      poly(c, [[p[0] - sz * .3, p[1] - sz * .9], [p[0] + sz, p[1] - sz * .4], [p[0] + sz * .1, p[1] - sz * .3]], shade(col, 0.25));
    }
  });
}
function blit(c, sp, wx, wy, alpha) {
  if (alpha != null) c.globalAlpha = alpha;
  c.drawImage(sp.cv, wx - sp.ax, wy - sp.ay, sp.w, sp.h);
  if (alpha != null) c.globalAlpha = 1;
}

/* ---- live parts of buildings (turrets, flags, glows) ------------------ */
function aimVec(b) {
  const a = b.aim != null ? b.aim : (performance.now() / 4000 + (b.i || 0) * 1.3) % (Math.PI * 2);
  return [Math.cos(a), Math.sin(a)];
}
/* a shaded barrel from base toward the aim direction */
function barrel(c, x, y, dx, dy, len, w, col, tipCol) {
  const ex = x + (dx - dy) * len * 0.75, ey = y + (dx + dy) * len * 0.38;
  const nx = -(ey - y), ny = ex - x, nl = Math.hypot(nx, ny) || 1;
  const ox = nx / nl * w / 2, oy = ny / nl * w / 2;
  const g = c.createLinearGradient(x + ox, y + oy, x - ox, y - oy);
  g.addColorStop(0, shade(col, 0.45)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.5));
  c.beginPath(); c.moveTo(x + ox, y + oy); c.lineTo(ex + ox * 0.85, ey + oy * 0.85); c.lineTo(ex - ox * 0.85, ey - oy * 0.85); c.lineTo(x - ox, y - oy); c.closePath();
  c.fillStyle = g; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
  c.fillStyle = tipCol || shade(col, -0.3); c.beginPath(); c.ellipse(ex, ey, w * 0.55, w * 0.42, Math.atan2(ey - y, ex - x), 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#0a0a10'; c.beginPath(); c.ellipse(ex, ey, w * 0.3, w * 0.22, Math.atan2(ey - y, ex - x), 0, 7); c.fill();
  return [ex, ey];
}
function drawLive(c, b, t, ox, oy) {
  const s = b.s;
  const at = (tx, ty, z) => [ox + (tx - ty) * HW, oy + (tx + ty) * HH - (z || 0)];
  switch (b.t) {
    case 'townhall': {
      const top = at(2, 2, 41 + (b.lv >= 7 ? 40 : 32));
      flag(c, top[0], top[1], t, b.lv >= 10 ? '#c8402f' : '#ffd23f', 1.1);
      if (b.lv >= 4) for (const [x, y] of [[3.25, 3.25]]) { const p = at(x, y, 74); flag(c, p[0], p[1], t + 1, '#ffffff', 0.6); }
      break;
    }
    case 'barracks': case 'darkbarracks': { const top = at(1.5, 1.5, 27 + 24); flag(c, top[0], top[1], t, b.t === 'barracks' ? '#ffd23f' : '#a080ff', 0.75); break; }
    case 'cannon': {
      const [dx, dy] = aimVec(b), base = at(1.5, 1.5, 18);
      for (const k of [-1, 1]) { const w = at(1.5 - (dy) * 0.35 * k, 1.5 + (dx) * 0.35 * k, 12); c.fillStyle = '#5a3a20'; c.beginPath(); c.ellipse(w[0], w[1], 6, 6, 0, 0, 7); c.fill(); c.strokeStyle = '#2a1a0a'; c.lineWidth = 1.5; c.stroke(); }
      const r = b.recoil > 0 ? b.recoil * 4 : 0;
      sphere(c, base[0], base[1], 9, '#3a3a48');
      const tip = barrel(c, base[0] - (dx - dy) * r, base[1] - (dx + dy) * r * 0.5, dx, dy, 28, 11, b.lv >= 6 ? '#5a5a6a' : '#3a3a48', b.lv >= 6 ? GOLD : null);
      if (b.recoil > 0.6) glowAt(c, tip[0], tip[1], 16, '#ffb040', b.recoil);
      break;
    }
    case 'xbow': {
      const [dx, dy] = aimVec(b), base = at(1.5, 1.5, 20);
      sphere(c, base[0], base[1], 8, '#5a5a6a');
      const tip = barrel(c, base[0], base[1] - 4, dx, dy, 34, 7, '#6a4a2a', GOLD);
      const px = -(dx + dy) * 18, py = (dx - dy) * 9, mx = base[0] + (tip[0] - base[0]) * 0.55, my = base[1] - 4 + (tip[1] - base[1] + 4) * 0.55;
      c.strokeStyle = '#3a2410'; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(mx + px, my + py); c.quadraticCurveTo(tip[0], tip[1], mx - px, my - py); c.stroke();
      c.strokeStyle = '#e8eef5'; c.lineWidth = 1; c.beginPath(); c.moveTo(mx + px, my + py); c.lineTo(base[0] - (dx - dy) * (b.recoil > 0 ? 0 : 6), base[1] - 4); c.lineTo(mx - px, my - py); c.stroke();
      break;
    }
    case 'eagleartillery': case 'bossfortress': {
      const [dx, dy] = aimVec(b), big = b.t === 'eagleartillery';
      const base = at(s / 2, s / 2, big ? 32 : 82);
      sphere(c, base[0], base[1], big ? 16 : 11, big ? '#8a8a9a' : '#5a1a2a');
      const tip = barrel(c, base[0], base[1] - 4, dx, dy, big ? 46 : 30, big ? 16 : 11, big ? '#6a6a7a' : '#3a1a24', GOLD);
      if (big) { c.fillStyle = '#7a4a1a'; c.beginPath(); c.arc(base[0] - 6, base[1] - 18, 7, 0, 7); c.fill(); c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(base[0] - 1, base[1] - 19); c.lineTo(base[0] + 7, base[1] - 17); c.lineTo(base[0] - 1, base[1] - 15); c.fill(); }
      else glowAt(c, base[0], base[1] - 18, 12, '#ff3a3a', 0.6 + 0.4 * Math.sin(t * 4));
      if (b.recoil > 0.6) glowAt(c, tip[0], tip[1], 24, '#ffb040', b.recoil);
      break;
    }
    case 'archertower': {
      const p = at(1.5, 1.5, 50);
      drawUnitShape(c, 'archer', p[0], p[1], b.aim != null && Math.cos(b.aim) - Math.sin(b.aim) < 0 ? -1 : 1, t * 0.3, b.recoil > 0 ? 1 : 0, 1.0);
      break;
    }
    case 'mortar': {
      const [dx, dy] = aimVec(b), base = at(1.5, 1.5, 6);
      const r = b.recoil > 0 ? b.recoil * 3 : 0;
      sphere(c, base[0], base[1], 12, '#4a4a58');
      barrel(c, base[0] + (dx - dy) * 2, base[1] - 4 + r, dx * 0.35, dy * 0.35 - 0.9, 26, 18, '#3a3a48');
      break;
    }
    case 'airdefense': {
      const [dx, dy] = aimVec(b), base = at(1.5, 1.5, 38);
      sphere(c, base[0], base[1], 7, '#5a5a6a');
      for (let k = -1; k <= 1; k += 2) {
        const ox2 = -(dx + dy) * 8 * k, oy2 = (dx - dy) * 4 * k;
        barrel(c, base[0] + ox2, base[1] + oy2 - 4, dx * 0.7, dy * 0.7 - 0.5, 22, 8, '#c8402f', '#ffd23f');
      }
      break;
    }
    case 'wizardtower': { const p = at(1.5, 1.5, 76 + Math.sin(t * 2 + b.i) * 3); glowAt(c, p[0], p[1], 20, '#c24bff', 0.7); sphere(c, p[0], p[1], 6, '#e080ff'); break; }
    case 'spellfactory': {
      const p = at(1.5, 1.5, 66 + Math.sin(t * 2) * 4);
      glowAt(c, p[0], p[1], 28, '#c24bff', 0.8);
      sphere(c, p[0], p[1], 9, '#d070ff');
      for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; c.fillStyle = '#fff'; c.beginPath(); c.arc(p[0] + Math.cos(a) * 16, p[1] + Math.sin(a) * 6, 1.6, 0, 7); c.fill(); }
      break;
    }
    case 'infernotower': {
      const p = at(1, 1, 42);
      glowAt(c, p[0], p[1], 34, '#ff7a1a', 0.7 + Math.sin(t * 9) * 0.1);
      fire(c, p[0], p[1] + 6, t, 0.9);
      break;
    }
    case 'monolith': {
      for (const z of [16, 30, 44, 58]) { const p = at(1.5, 1.0, z); glowAt(c, p[0], p[1], 9, '#7fd4ff', 0.5 + 0.5 * Math.sin(t * 2.5 + z)); }
      const top = at(1, 1, 84); glowAt(c, top[0], top[1], 22, '#7fd4ff', 0.5 + 0.3 * Math.sin(t * 2));
      break;
    }
    case 'elixircollector': {
      const p = at(1.5, 1.5, 31);
      for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; c.fillStyle = 'rgba(255,220,255,' + (0.7 * (1 - k)) + ')'; c.beginPath(); c.arc(p[0] - 6 + i * 6, p[1] + 10 - k * 22, 2 + k * 1.5, 0, 7); c.fill(); }
      glowAt(c, p[0], p[1], 24, '#d64bff', 0.25 + 0.1 * Math.sin(t * 3 + b.i));
      break;
    }
    case 'darkdrill': { const p = at(1.5, 1.5, 44); glowAt(c, p[0], p[1], 18, '#a080ff', 0.35 + 0.15 * Math.sin(t * 3)); break; }
    case 'goldmine': {
      const p = at(1.9, 1.9, 26); const a = t * 2;
      c.save(); c.translate(p[0], p[1] - 4);
      c.strokeStyle = '#5a3a20'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, 9, 0, 7); c.stroke();
      for (let k = 0; k < 4; k++) { const aa = a + k * Math.PI / 2; line(c, [0, 0], [Math.cos(aa) * 9, Math.sin(aa) * 9], '#5a3a20', 2); }
      c.restore();
      if (Math.sin(t * 3 + b.i) > 0.97) { const q = at(2.3, 2.6, 6); glowAt(c, q[0], q[1], 8, '#fff6a0', 1); }
      break;
    }
    case 'armycamp': { const p = at(2, 2, 2); glowAt(c, p[0], p[1] - 6, 40, '#ff8a2a', 0.45 + 0.1 * Math.sin(t * 11)); fire(c, p[0], p[1], t, 1.1); const q = at(3.3, 3.0, 16); flag(c, q[0], q[1], t, '#ffd23f', 0.6); break; }
    case 'blacksmith': { const p = at(1.5, 2.6, 8); glowAt(c, p[0], p[1], 26, '#ff7a1a', 0.45 + 0.15 * Math.sin(t * 7)); break; }
    case 'kingaltar': case 'queenaltar': case 'wardenaltar': case 'championaltar': {
      const p = at(1.5, 1.5, 14);
      if (b.hero) { glowAt(c, p[0], p[1] - 8, 30, (LOOK[b.hero] || {}).body || '#ffd23f', 0.3); drawUnitShape(c, b.hero, p[0], p[1], 1, t * 0.25, 0, 1.35); }
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; const q = at(1.5 + Math.cos(a) * 1.05, 1.5 + Math.sin(a) * 1.05, 7); glowAt(c, q[0], q[1], 7, '#7fd4ff', 0.5 + 0.5 * Math.sin(t * 2 + i)); }
      break;
    }
    case 'hiddentrap': {
      if (b.revealed && b.zap > 0) { const p = at(1, 1, 36); c.save(); c.shadowColor = '#7fd4ff'; c.shadowBlur = 12; c.strokeStyle = '#e8fbff'; c.lineWidth = 2; c.beginPath(); c.moveTo(p[0], p[1]); for (let k = 0; k < 4; k++) c.lineTo(p[0] + rand(-14, 14), p[1] + rand(-14, 6)); c.stroke(); c.restore(); }
      break;
    }
  }
}
function flag(c, x, y, t, col, sc) {
  sc = sc || 1;
  c.strokeStyle = '#3a2410'; c.lineWidth = 2 * sc; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 26 * sc); c.stroke();
  c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x, y - 27 * sc, 1.8 * sc, 0, 7); c.fill();
  c.beginPath(); c.moveTo(x, y - 25 * sc);
  for (let i = 1; i <= 6; i++) { const u = i / 6; c.lineTo(x + 18 * sc * u, y - 25 * sc + Math.sin(t * 6 - u * 4 + x) * 2.5 * sc * u); }
  for (let i = 6; i >= 0; i--) { const u = i / 6; c.lineTo(x + 18 * sc * u, y - 15 * sc + Math.sin(t * 6 - u * 4 + x) * 2.5 * sc * u + u * 1.5 * sc); }
  c.closePath();
  const g = c.createLinearGradient(x, 0, x + 18 * sc, 0); g.addColorStop(0, shade(col, -0.15)); g.addColorStop(0.5, shade(col, 0.15)); g.addColorStop(1, shade(col, -0.2));
  c.fillStyle = g; c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.8; c.stroke();
}
function fire(c, x, y, t, sc) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const f = 1 + Math.sin(t * 13 + k * 2) * 0.18;
    const g = c.createLinearGradient(x, y, x, y - 24 * sc);
    g.addColorStop(0, ['#ff3a0a', '#ff8a1a', '#ffd04a'][k]); g.addColorStop(1, 'rgba(255,140,30,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x - (9 - k * 2.5) * sc, y); c.bezierCurveTo(x - (9 - k * 2.5) * sc, y - 10 * sc, x + Math.sin(t * 8 + k) * 3 * sc, y - (24 - k * 5) * f * sc, x, y - (26 - k * 6) * f * sc);
    c.bezierCurveTo(x + Math.sin(t * 7 + k) * 3 * sc, y - (20 - k * 5) * f * sc, x + (9 - k * 2.5) * sc, y - 10 * sc, x + (9 - k * 2.5) * sc, y); c.closePath(); c.fill();
  }
  c.restore();
}
