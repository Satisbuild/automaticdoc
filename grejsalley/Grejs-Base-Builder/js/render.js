'use strict';
/* =====================================================================
   GREJS BASE BUILDER - render.js
   Camera, isometric math, drawing primitives (textured prisms, tiled
   roofs, cylinders, soft shadows), the island ground, water, clouds,
   lighting and the particle/effects system.

   World units: a tile is 64x32 px at zoom 1. iso(x,y) = top corner of
   tile (x,y). Heights (z) are world pixels, drawn upward.
   ===================================================================== */
const TW = 64, THT = 32, HW = 32, HH = 16;
const CRX = 45.25, CRY = 22.63;     // radius-1 circle in iso
const iso = (x, y) => [(x - y) * HW, (x + y) * HH];
const canvas = $('#game'), ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
const cam = { x: 0, y: 640, z: 1, tz: null, ax: 0, ay: 0, vx: 0, vy: 0, shake: 0 };
const OUT = 'rgba(30,16,4,.55)';
const HI = 'rgba(255,255,255,.38)';
const hiQ = () => SET.quality !== 'low';

/* =====================================================================
   CAMERA - smooth zoom toward a target and momentum after panning
   ===================================================================== */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, hiQ() ? 2 : 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  vignette = null;
  clampCam();
}
window.addEventListener('resize', resize);
function minZoom() { return Math.max(0.28, Math.min(W / 2900, H / 1500)); }
function clampCam() {
  cam.z = clamp(cam.z, minZoom(), 2.6);
  cam.x = clamp(cam.x, -1500, 1500);
  cam.y = clamp(cam.y, -100, 1400);
}
function screenToWorld(sx, sy) { return [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y]; }
function worldToTile(wx, wy) { return [(wx / HW + wy / HH) / 2, (wy / HH - wx / HW) / 2]; }
function screenToTile(sx, sy) { const w = screenToWorld(sx, sy); return worldToTile(w[0], w[1]); }
function setZoomAround(sx, sy, z) {
  const [wx, wy] = screenToWorld(sx, sy);
  cam.z = clamp(z, minZoom(), 2.6);
  cam.x = wx - (sx - W / 2) / cam.z; cam.y = wy - (sy - H / 2) / cam.z;
  clampCam();
}
/* animated zoom (mouse wheel / buttons) */
function zoomTo(sx, sy, f) {
  const base = cam.tz != null ? cam.tz : cam.z;
  cam.tz = clamp(base * f, minZoom(), 2.6); cam.ax = sx; cam.ay = sy;
}
function camUpdate(dt) {
  if (cam.tz != null) {
    const k = 1 - Math.exp(-dt * 13);
    const z = cam.z + (cam.tz - cam.z) * k;
    setZoomAround(cam.ax, cam.ay, z);
    if (Math.abs(cam.tz - cam.z) < 0.0008) { setZoomAround(cam.ax, cam.ay, cam.tz); cam.tz = null; }
  }
  if (Math.abs(cam.vx) + Math.abs(cam.vy) > 2) {
    cam.x += cam.vx * dt; cam.y += cam.vy * dt;
    const d = Math.exp(-dt * 5.5);
    cam.vx *= d; cam.vy *= d;
    clampCam();
  } else { cam.vx = cam.vy = 0; }
  if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 30);
}
function applyCam(c) {
  const sh = cam.shake > 0 && SET.shake ? cam.shake : 0;
  const ox = sh ? (Math.random() - .5) * sh : 0, oy = sh ? (Math.random() - .5) * sh : 0;
  c.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (W / 2 - (cam.x + ox) * cam.z), DPR * (H / 2 - (cam.y + oy) * cam.z));
  c.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in c) c.imageSmoothingQuality = 'high';
}

/* =====================================================================
   PRIMITIVES (local coords: origin = footprint top corner)
   ===================================================================== */
const Pt = (tx, ty, z) => [(tx - ty) * HW, (tx + ty) * HH - (z || 0)];
function path(c, pts) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
}
function poly(c, pts, fill, stroke, lw) {
  path(c, pts);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.1; c.lineJoin = 'round'; c.stroke(); }
}
function line(c, a, b, col, lw) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.strokeStyle = col; c.lineWidth = lw || 1; c.stroke(); }
const lp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/* Soft shadow of a convex polygon: stacked layers grown/shrunk around the
   centre, so the middle is darkest and the edge fades out. No canvas
   shadow/filter tricks, so it looks the same in every browser. */
let SPR_R = 2;
function softShadow(c, pts, blur, alpha) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  let rad = 1;
  for (const p of pts) rad = Math.max(rad, Math.hypot(p[0] - cx, (p[1] - cy) * 2));
  const steps = 6, spread = blur / rad;
  c.save();
  c.fillStyle = 'rgba(0,0,0,' + (alpha / steps * 1.45) + ')';
  for (let i = 0; i < steps; i++) {
    const k = 1 + spread * (1 - 2 * i / (steps - 1));
    c.beginPath();
    pts.forEach((p, j) => { const x = cx + (p[0] - cx) * k, y = cy + (p[1] - cy) * k; if (j) c.lineTo(x, y); else c.moveTo(x, y); });
    c.closePath(); c.fill();
  }
  c.restore();
}
/* convex hull (monotone chain) - used to merge shapes into one shadow */
function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
function softShadowShapes(c, shapes, blur, alpha) {
  for (const s of shapes) softShadow(c, s, blur, alpha);
}

/* face with a vertical light->dark gradient (ambient occlusion at the base) */
function face(c, pts, col) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(col, 0.1)); g.addColorStop(0.7, col); g.addColorStop(1, shade(col, -0.22));
  poly(c, pts, g);
}
/* surface textures drawn along a face: (u along the face, z height) */
function tex(c, pts, kind, at, u0, u1, z0, z1, seed) {
  c.save(); path(c, pts); c.clip();
  const dark = 'rgba(30,15,5,.26)', light = 'rgba(255,255,255,.13)';
  let s = (seed || 7) * 9301;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  c.lineWidth = 1;
  if (kind === 'brick' || kind === 'stone') {
    const rh = kind === 'brick' ? 5 : 8, jw = kind === 'brick' ? 0.3 : 0.48;
    let row = 0;
    for (let z = z0 + rh; z < z1 + rh; z += rh, row++) {
      line(c, at(u0, z), at(u1, z), dark); line(c, at(u0, z - 1), at(u1, z - 1), light);
      for (let u = u0 + (row % 2 ? jw / 2 : 0) + (kind === 'stone' ? rnd() * 0.15 : 0); u < u1; u += jw * (kind === 'stone' ? 0.8 + rnd() * 0.5 : 1)) {
        line(c, at(u, z), at(u, Math.min(z1, z + rh)), dark);
      }
    }
  } else if (kind === 'plank') {
    for (let z = z0 + 4.5; z < z1; z += 4.5) { line(c, at(u0, z), at(u1, z), dark); line(c, at(u0, z - 1), at(u1, z - 1), light); }
    for (let u = u0 + 0.7; u < u1; u += 0.7) line(c, at(u, z0), at(u, z1), 'rgba(30,15,5,.15)');
  } else if (kind === 'logs') {
    for (let u = u0 + 0.2; u < u1; u += 0.2) { line(c, at(u, z0), at(u, z1), dark, 1.2); line(c, at(u + 0.03, z0), at(u + 0.03, z1), light); }
  } else if (kind === 'metal') {
    for (let u = u0 + 0.5; u < u1; u += 0.5) { line(c, at(u, z0), at(u, z1), dark); line(c, at(u + 0.02, z0), at(u + 0.02, z1), light); }
    c.fillStyle = 'rgba(255,255,255,.45)';
    for (let u = u0 + 0.12; u < u1; u += 0.25) for (const z of [z0 + 3, z1 - 3]) { const p = at(u, z); c.fillRect(p[0] - 0.8, p[1] - 0.8, 1.6, 1.6); }
  }
  c.restore();
}
/* box with optional textures, gradient faces, outline and edge highlight */
function prism(c, x0, y0, x1, y1, z0, z1, col, o) {
  o = typeof o === 'string' ? { top: o } : (o || {});
  const L = [Pt(x0, y1, z0), Pt(x1, y1, z0), Pt(x1, y1, z1), Pt(x0, y1, z1)];
  const R = [Pt(x1, y0, z0), Pt(x1, y1, z0), Pt(x1, y1, z1), Pt(x1, y0, z1)];
  const T = [Pt(x0, y0, z1), Pt(x1, y0, z1), Pt(x1, y1, z1), Pt(x0, y1, z1)];
  face(c, L, shade(col, -0.03));
  if (o.tex) tex(c, L, o.tex, (u, z) => Pt(u, y1, z), x0, x1, z0, z1, o.seed);
  face(c, R, shade(col, -0.32));
  if (o.tex) tex(c, R, o.tex, (u, z) => Pt(x1, u, z), y0, y1, z0, z1, (o.seed || 7) + 3);
  const tc = o.top || shade(col, 0.16);
  const g = c.createLinearGradient(T[0][0], T[0][1], T[2][0], T[2][1]);
  g.addColorStop(0, shade(tc, 0.14)); g.addColorStop(1, shade(tc, -0.05));
  poly(c, T, g);
  if (o.topTex === 'plank') { c.save(); path(c, T); c.clip(); for (let u = x0 + 0.25; u < x1; u += 0.25) line(c, Pt(u, y0, z1), Pt(u, y1, z1), 'rgba(30,15,5,.2)'); c.restore(); }
  if (o.topTex === 'tiles') { c.save(); path(c, T); c.clip(); for (let u = x0 + 0.5; u < x1; u += 0.5) line(c, Pt(u, y0, z1), Pt(u, y1, z1), 'rgba(0,0,0,.14)'); for (let v = y0 + 0.5; v < y1; v += 0.5) line(c, Pt(x0, v, z1), Pt(x1, v, z1), 'rgba(0,0,0,.14)'); c.restore(); }
  c.lineJoin = 'round';
  if (!o.noOutline) { poly(c, L, null, OUT, 1); poly(c, R, null, OUT, 1); poly(c, T, null, OUT, 1); }
  c.beginPath(); const a = Pt(x0, y1, z1), b = Pt(x1, y1, z1), d = Pt(x1, y0, z1);
  c.moveTo(a[0], a[1] + 0.8); c.lineTo(b[0], b[1] + 0.8); c.lineTo(d[0], d[1] + 0.8);
  c.strokeStyle = HI; c.lineWidth = 1; c.stroke();
}
/* tiled pyramid roof */
function pyramid(c, x0, y0, x1, y1, z0, h, col, o) {
  o = o || {};
  const ap = Pt((x0 + x1) / 2, (y0 + y1) / 2, z0 + h);
  const faces = [
    [Pt(x0, y0, z0), Pt(x1, y0, z0), 0.2], [Pt(x0, y0, z0), Pt(x0, y1, z0), 0.08],
    [Pt(x0, y1, z0), Pt(x1, y1, z0), -0.04], [Pt(x1, y0, z0), Pt(x1, y1, z0), -0.32],
  ];
  for (const [e0, e1, sh] of faces) {
    const col2 = shade(col, sh);
    const mid = lp(e0, e1, 0.5);
    const g = c.createLinearGradient(ap[0], ap[1], mid[0], mid[1]);
    g.addColorStop(0, shade(col2, 0.16)); g.addColorStop(1, shade(col2, -0.12));
    poly(c, [e0, e1, ap], g);
    if (o.tiles !== false) {
      c.save(); path(c, [e0, e1, ap]); c.clip();
      const n = Math.max(3, Math.round(h / 4.5));
      for (let k = 1; k < n; k++) { const p = lp(e0, ap, k / n), q = lp(e1, ap, k / n); line(c, p, q, 'rgba(0,0,0,.2)', 1.2); line(c, [p[0], p[1] + 1.2], [q[0], q[1] + 1.2], 'rgba(255,255,255,.1)'); }
      const m = 7;
      for (let k = 1; k < m; k++) { const p = lp(e0, e1, k / m); line(c, p, lp(p, ap, 0.9), 'rgba(0,0,0,.08)'); }
      c.restore();
    }
    poly(c, [e0, e1, ap], null, OUT, 1);
  }
  // ridges + eave trim
  for (const p of [Pt(x0, y1, z0), Pt(x1, y1, z0), Pt(x1, y0, z0)]) line(c, p, ap, 'rgba(255,255,255,.3)', 1.2);
  c.lineCap = 'round';
  line(c, Pt(x0, y1, z0), Pt(x1, y1, z0), shade(col, -0.45), 2);
  line(c, Pt(x1, y1, z0), Pt(x1, y0, z0), shade(col, -0.55), 2);
}
function cyl(c, cx, cy, r, z0, z1, col, o) {
  o = typeof o === 'string' ? { top: o } : (o || {});
  const p = Pt(cx, cy, 0), x = p[0], y = p[1], rx = r * CRX, ry = r * CRY;
  const g = c.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, shade(col, -0.05)); g.addColorStop(0.28, shade(col, 0.24)); g.addColorStop(0.55, shade(col, 0.04)); g.addColorStop(1, shade(col, -0.45));
  c.beginPath(); c.ellipse(x, y - z0, rx, ry, 0, 0, Math.PI); c.lineTo(x - rx, y - z1); c.ellipse(x, y - z1, rx, ry, 0, Math.PI, 0, true); c.closePath();
  c.fillStyle = g; c.fill();
  if (o.tex === 'stone' || o.tex === 'brick' || o.bands) {
    c.save(); c.clip();
    const rh = o.tex === 'brick' ? 5 : o.tex === 'stone' ? 8 : 0;
    if (rh) for (let z = z0 + rh, row = 0; z < z1; z += rh, row++) {
      c.beginPath(); c.ellipse(x, y - z, rx, ry, 0, 0, Math.PI); c.strokeStyle = 'rgba(30,15,5,.25)'; c.lineWidth = 1; c.stroke();
      for (let a = (row % 2) * 0.2 + 0.15; a < Math.PI; a += 0.4) { const jx = x + Math.cos(a) * rx, jy = y - z + Math.sin(a) * ry; line(c, [jx, jy], [jx, jy - rh], 'rgba(30,15,5,.2)'); }
    }
    if (o.bands) for (const z of o.bands) { c.beginPath(); c.ellipse(x, y - z, rx, ry, 0, 0, Math.PI); c.strokeStyle = o.bandCol || '#d9b44a'; c.lineWidth = 3; c.stroke(); }
    c.restore();
  }
  c.beginPath(); c.ellipse(x, y - z0, rx, ry, 0, 0, Math.PI); c.lineTo(x - rx, y - z1); c.ellipse(x, y - z1, rx, ry, 0, Math.PI, 0, true); c.closePath();
  c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
  if (o.noTop) return;
  const tg = c.createLinearGradient(x - rx, y - z1 - ry, x + rx, y - z1 + ry);
  const tc = o.top || shade(col, 0.2);
  tg.addColorStop(0, shade(tc, 0.18)); tg.addColorStop(1, shade(tc, -0.1));
  c.beginPath(); c.ellipse(x, y - z1, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = tg; c.fill(); c.strokeStyle = OUT; c.stroke();
  c.beginPath(); c.ellipse(x, y - z1, rx, ry, 0, 0.15, Math.PI - 0.15); c.strokeStyle = HI; c.lineWidth = 1; c.stroke();
}
function cone(c, cx, cy, r, z0, h, col, o) {
  o = o || {};
  const p = Pt(cx, cy, 0), x = p[0], y = p[1], rx = r * CRX, ry = r * CRY;
  const g = c.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, shade(col, 0.05)); g.addColorStop(0.3, shade(col, 0.3)); g.addColorStop(1, shade(col, -0.4));
  c.beginPath(); c.ellipse(x, y - z0, rx, ry, 0, 0, Math.PI); c.lineTo(x, y - z0 - h); c.closePath();
  c.fillStyle = g; c.fill();
  if (o.tiles) {
    c.save(); c.clip();
    for (let k = 1; k < 7; k++) { const kk = k / 7; c.beginPath(); c.ellipse(x, y - z0 - h * kk, rx * (1 - kk), ry * (1 - kk), 0, 0, Math.PI); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1.2; c.stroke(); }
    c.restore();
  }
  c.beginPath(); c.ellipse(x, y - z0, rx, ry, 0, 0, Math.PI); c.lineTo(x, y - z0 - h); c.closePath();
  c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
}
function sphere(c, x, y, r, col, glow) {
  if (glow) { c.save(); c.shadowColor = glow; c.shadowBlur = r * 1.6 * (c === ctx ? cam.z * DPR : SPR_R); }
  const g = c.createRadialGradient(x - r * .35, y - r * .4, r * .08, x, y, r);
  g.addColorStop(0, shade(col, 0.7)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.5));
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
  if (glow) c.restore();
  c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x - r * .35, y - r * .45, r * .25, r * .15, -0.6, 0, 7); c.fill();
}
/* ground slab with bevel */
function slab(c, s, col, kind) {
  prism(c, 0.05, 0.05, s - 0.05, s - 0.05, 0, 4, col, { tex: kind === 'dirt' ? null : 'stone', seed: s * 3 });
}
const WOOD = '#b07a45', STONE = '#b4b1aa', ROOF = '#c8402f';
function tier(lv, list) { return list[Math.min(list.length - 1, Math.max(0, lv - 1))]; }

/* =====================================================================
   GLOW SPRITES (cached radial gradients for particles and lights)
   ===================================================================== */
const GLOW = new Map();
function glowSprite(col, soft) {
  const key = col + (soft ? ':s' : '');
  let cv = GLOW.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (soft) { g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(0.5, rgba(col, 0.28)); g.addColorStop(1, rgba(col, 0)); }
  else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, rgba(col, 0.95)); g.addColorStop(0.5, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0)); }
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  GLOW.set(key, cv);
  return cv;
}
function glowAt(c, x, y, r, col, alpha) {
  c.globalAlpha = alpha == null ? 1 : alpha;
  c.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
  c.globalAlpha = 1;
}

/* =====================================================================
   GROUND - a procedural island per theme, rendered once
   ===================================================================== */
const GM = 8;   // decorative margin in tiles
let ground = null;
function seaFor(theme) {
  const n = theme.name || '';
  if (/Volcano|Inferno/.test(n)) return { deep: '#7a1a08', shallow: '#e0501a', foam: '#ffd27a', lava: true };
  if (/Shadow|Citadel|Endgame|Crystal/.test(n)) return { deep: '#120a26', shallow: '#3a2a70', foam: '#a080ff' };
  if (/Frozen/.test(n)) return { deep: '#2a6aa0', shallow: '#8fd0f0', foam: '#ffffff' };
  if (/Toxic|Swamp/.test(n)) return { deep: '#2a3a14', shallow: '#6a8a2a', foam: '#d0ff6a' };
  if (/Sky|Celestial/.test(n)) return { deep: '#6aa8e0', shallow: '#cfeeff', foam: '#ffffff' };
  return { deep: '#0f5a9a', shallow: '#3ab0d8', foam: '#ffffff' };
}
function makeGround(theme) {
  const sc = hiQ() ? 0.75 : 0.5;
  const N = D.GRID + 2 * GM;
  const offX = N * HW, offY = GM * 2 * HH;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(N * TW * sc); cv.height = Math.ceil(N * THT * sc + 80 * sc);
  const c = cv.getContext('2d');
  c.scale(sc, sc); c.translate(offX, offY);
  let seed = 1234 + (theme.name || '').length * 77;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const P = (x, y) => iso(x, y);
  const name = theme.name || '';
  const dark = /Shadow|Citadel|Endgame|Volcano|Inferno/.test(name);
  const snow = /Frozen|Celestial/.test(name);
  const desert = /Desert|Ruins|Pirate/.test(name);
  // island outline with a wobbly coast
  const pts = [];
  const lo = -GM + 1.5, hi = D.GRID + GM - 1.5;
  const edge = (x0, y0, x1, y1) => {
    for (let i = 0; i < 40; i++) {
      const tt = i / 40, wob = Math.sin(i * 0.7 + x0 + y0) * 0.5 + (r() - .5) * 0.6;
      pts.push(P(x0 + (x1 - x0) * tt + (y1 !== y0 ? wob : 0), y0 + (y1 - y0) * tt + (x1 !== x0 ? wob : 0)));
    }
  };
  edge(lo, lo, hi, lo); edge(hi, lo, hi, hi); edge(hi, hi, lo, hi); edge(lo, hi, lo, lo);
  const beach = snow ? '#eef6ff' : dark ? '#4a3434' : '#ecd9a0';
  // cliff
  c.save(); c.translate(0, 26);
  const cg = c.createLinearGradient(0, -200, 0, D.GRID * THT + 300);
  cg.addColorStop(0, shade(beach, -0.45)); cg.addColorStop(1, shade(beach, -0.65));
  poly(c, pts, cg);
  c.restore();
  for (let k = 1; k <= 3; k++) { c.save(); c.translate(0, k * 7); poly(c, pts, null, 'rgba(0,0,0,.12)', 2); c.restore(); }
  // beach (wet sand darker at the edge)
  poly(c, pts, beach);
  c.save(); path(c, pts); c.clip();
  c.lineWidth = 34; c.strokeStyle = rgba(shade(beach, -0.18), 0.5); path(c, pts); c.stroke();
  c.lineWidth = 12; c.strokeStyle = rgba(shade(beach, -0.28), 0.5); path(c, pts); c.stroke();
  for (let i = 0; i < 900; i++) { const p = P(lo + r() * (hi - lo), lo + r() * (hi - lo)); c.fillStyle = rgba(shade(beach, r() < .5 ? -0.15 : 0.2), 0.6); c.fillRect(p[0], p[1], 1.5, 1.5); }
  c.restore();
  // grass area
  const g0 = -GM + 3, g1 = D.GRID + GM - 3;
  const gp = [];
  for (const p of pts) { const tx = (p[0] / HW + p[1] / HH) / 2, ty = (p[1] / HH - p[0] / HW) / 2; gp.push(P(clamp(tx, g0, g1) + (r() - .5) * .3, clamp(ty, g0, g1) + (r() - .5) * .3)); }
  c.save(); c.translate(0, 6); c.globalAlpha = 0.25; poly(c, gp, '#000'); c.restore();
  poly(c, gp, theme.ground);
  c.save(); path(c, gp); c.clip();
  // big soft colour variation
  const hiCol = shade(theme.ground, 0.16), loCol = shade(theme.ground, -0.16);
  for (let i = 0; i < 520; i++) {
    const p = P(g0 + r() * (g1 - g0), g0 + r() * (g1 - g0)), rad = 40 + r() * 150;
    const gg = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad);
    const col = r() < 0.5 ? hiCol : loCol;
    gg.addColorStop(0, rgba(col, 0.16)); gg.addColorStop(1, rgba(col, 0));
    c.fillStyle = gg; c.fillRect(p[0] - rad, p[1] - rad, rad * 2, rad * 2);
  }
  // very subtle tile rhythm on the play area (helps building placement)
  c.fillStyle = 'rgba(0,0,0,.035)';
  for (let y = 0; y < D.GRID; y++) for (let x = 0; x < D.GRID; x++) {
    if ((x + y) % 2) continue;
    path(c, [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)]); c.fill();
  }
  // grass blades
  const blades = [shade(theme.ground, 0.28), shade(theme.ground, -0.25), shade(theme.ground, 0.12), shade(theme.ground, -0.1)];
  c.lineCap = 'round';
  for (let i = 0; i < (hiQ() ? 9000 : 4000); i++) {
    const p = P(g0 + r() * (g1 - g0), g0 + r() * (g1 - g0));
    c.strokeStyle = blades[i % 4]; c.lineWidth = 1.2;
    const lean = (r() - .5) * 3, h = 3 + r() * 4;
    c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[0] + lean * .3, p[1] - h * .6, p[0] + lean, p[1] - h); c.stroke();
  }
  // flower clusters, clover, pebbles
  const flowerCols = snow ? ['#ffffff', '#bdf3ff'] : dark ? ['#a26bff', '#ff5a3a', theme.accent] : ['#ffffff', '#ffd23f', '#ff8ab0', '#b38bff', theme.accent];
  for (let i = 0; i < 220; i++) {
    const cx = g0 + r() * (g1 - g0), cy = g0 + r() * (g1 - g0), col = flowerCols[i % flowerCols.length];
    for (let k = 0; k < 3 + r() * 6; k++) {
      const p = P(cx + (r() - .5) * 1.2, cy + (r() - .5) * 1.2);
      c.strokeStyle = shade(theme.ground, -0.2); c.lineWidth = 1; line(c, p, [p[0], p[1] - 4], shade(theme.ground, -0.25));
      c.fillStyle = col; c.beginPath(); c.arc(p[0], p[1] - 5, 2.2, 0, 7); c.fill();
      c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(p[0], p[1] - 5, 0.8, 0, 7); c.fill();
    }
  }
  for (let i = 0; i < 260; i++) {
    const p = P(g0 + r() * (g1 - g0), g0 + r() * (g1 - g0)), s = 1.5 + r() * 3;
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(p[0] + 1, p[1] + 1, s * 1.3, s * .7, 0, 0, 7); c.fill();
    c.fillStyle = dark ? '#6a5a6a' : '#b8b4aa'; c.beginPath(); c.ellipse(p[0], p[1], s * 1.2, s * .7, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(p[0] - s * .3, p[1] - s * .2, s * .5, s * .25, 0, 0, 7); c.fill();
  }
  c.restore();
  // props on the margin (never on the 40x40 build grid)
  const props = [];
  for (let i = 0; i < 520; i++) {
    const tx = g0 + 0.6 + r() * (g1 - g0 - 1.2), ty = g0 + 0.6 + r() * (g1 - g0 - 1.2);
    if (tx > -0.8 && tx < D.GRID + 0.8 && ty > -0.8 && ty < D.GRID + 0.8) continue;
    props.push([tx, ty, r(), r()]);
  }
  props.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  const leaf = dark ? '#3a2a4a' : snow ? '#5a8a6a' : desert ? '#5a9a3a' : shade(theme.ground, -0.18);
  for (const [tx, ty, k, k2] of props) {
    const p = P(tx, ty);
    if (k < 0.16) rock(c, p[0], p[1], 7 + k2 * 12, dark ? '#5a4a5a' : '#a8a49c');
    else if (k < 0.34) bush(c, p[0], p[1], 7 + k2 * 6, leaf, snow);
    else if (desert && k < 0.62) palm(c, p[0], p[1], 0.8 + k2 * 0.5);
    else if (k < 0.62 || snow) pine(c, p[0], p[1], 0.8 + k2 * 0.6, dark ? '#2a2038' : snow ? '#3f6a5a' : shade(theme.ground, -0.42), snow);
    else oak(c, p[0], p[1], 0.8 + k2 * 0.6, leaf, dark);
  }
  ground = { cv: cv, sc: sc, offX: offX, offY: offY, theme: theme, sea: seaFor(theme), coast: pts };
  clouds = null;
}
function treeShadow(c, x, y, rx) {
  const g = c.createRadialGradient(x + rx * .5, y + 2, 0, x + rx * .5, y + 2, rx * 1.4);
  g.addColorStop(0, 'rgba(0,0,0,.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(x + rx * .5, y + 2, rx * 1.4, rx * .6, 0, 0, 7); c.fill();
}
function oak(c, x, y, k, col, dark) {
  treeShadow(c, x, y, 20 * k);
  const tg = c.createLinearGradient(x - 4 * k, 0, x + 4 * k, 0); tg.addColorStop(0, '#8a5a30'); tg.addColorStop(1, '#4a2a12');
  c.fillStyle = tg; c.beginPath(); c.moveTo(x - 4 * k, y); c.lineTo(x - 2.5 * k, y - 22 * k); c.lineTo(x + 2.5 * k, y - 22 * k); c.lineTo(x + 4 * k, y); c.closePath(); c.fill();
  const blobs = [[-9, -26, 11], [9, -27, 11], [0, -36, 13], [-4, -21, 9], [7, -20, 9]];
  for (const [bx, by, br] of blobs) {
    const cx = x + bx * k, cy = y + by * k, rr = br * k;
    const g = c.createRadialGradient(cx - rr * .4, cy - rr * .5, rr * .1, cx, cy, rr);
    g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.6, col); g.addColorStop(1, shade(col, -0.4));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.fill();
  }
  c.fillStyle = rgba(shade(col, 0.5), .35);
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x + (i * 7 % 18 - 9) * k, y - (30 + i * 3 % 10) * k, 1.8 * k, 0, 7); c.fill(); }
  if (!dark && k > 1.15) { c.fillStyle = '#ff5a4a'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + (i * 11 % 20 - 10) * k, y - (22 + i * 5 % 14) * k, 1.8 * k, 0, 7); c.fill(); } }
}
function pine(c, x, y, k, col, snow) {
  treeShadow(c, x, y, 16 * k);
  c.fillStyle = '#5a3a1a'; c.fillRect(x - 2.5 * k, y - 10 * k, 5 * k, 10 * k);
  for (let j = 0; j < 3; j++) {
    const w = (17 - j * 4) * k, yb = y - (8 + j * 12) * k, yt = yb - 20 * k;
    const g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, shade(col, 0.28)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.4));
    c.fillStyle = g; c.beginPath(); c.moveTo(x - w, yb); c.quadraticCurveTo(x, yb + 5 * k, x + w, yb); c.lineTo(x, yt); c.closePath(); c.fill();
    if (snow) { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(x - w * .45, yt + 9 * k); c.lineTo(x, yt); c.lineTo(x + w * .45, yt + 9 * k); c.quadraticCurveTo(x, yt + 6 * k, x - w * .45, yt + 9 * k); c.fill(); }
  }
}
function palm(c, x, y, k) {
  treeShadow(c, x, y, 18 * k);
  c.strokeStyle = '#8a5a2b'; c.lineWidth = 5 * k; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8 * k, y - 22 * k, x + 4 * k, y - 46 * k); c.stroke();
  for (let a = 0; a < 7; a++) {
    const ang = a / 7 * Math.PI * 2;
    const g = c.createLinearGradient(x, y - 46 * k, x + Math.cos(ang) * 22 * k, y - 46 * k);
    g.addColorStop(0, '#3f9a3a'); g.addColorStop(1, '#2a6a2a');
    c.fillStyle = g; c.beginPath(); c.ellipse(x + 4 * k + Math.cos(ang) * 12 * k, y - 46 * k + Math.sin(ang) * 4 * k + 3 * k, 14 * k, 4 * k, ang, 0, 7); c.fill();
  }
}
function bush(c, x, y, s, col, snow) {
  treeShadow(c, x, y, s);
  for (const [bx, by, br] of [[-0.6, -0.6, 0.75], [0.6, -0.55, 0.7], [0, -1.05, 0.8]]) {
    const cx = x + bx * s, cy = y + by * s, rr = br * s;
    const g = c.createRadialGradient(cx - rr * .4, cy - rr * .5, 1, cx, cy, rr);
    g.addColorStop(0, shade(col, 0.4)); g.addColorStop(1, shade(col, -0.35));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.fill();
  }
  if (snow) { c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(x, y - s * 1.6, s * .6, s * .25, 0, 0, 7); c.fill(); }
}
function rock(c, x, y, s, col) {
  treeShadow(c, x, y, s);
  const pts = [[x - s, y], [x - s * .7, y - s * .7], [x - s * .1, y - s], [x + s * .7, y - s * .6], [x + s, y]];
  poly(c, pts, shade(col, -0.15), OUT, 1);
  poly(c, [[x - s * .7, y - s * .7], [x - s * .1, y - s], [x + s * .7, y - s * .6], [x + s * .1, y - s * .35]], shade(col, 0.2));
  poly(c, [[x + s * .1, y - s * .35], [x + s * .7, y - s * .6], [x + s, y]], shade(col, -0.35));
}

/* ---- water, foam, clouds, lighting --------------------------------- */
function drawSea(c, t) {
  const sea = ground ? ground.sea : seaFor({});
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(sea.deep, 0.15)); g.addColorStop(1, shade(sea.deep, -0.2));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  applyCam(c);
  if (!ground) return;
  // shallow water around the island + foam lines
  const coast = ground.coast;
  c.save();
  c.lineJoin = 'round';
  c.strokeStyle = rgba(sea.shallow, 0.55); c.lineWidth = 140; path(c, coast); c.stroke();
  c.strokeStyle = rgba(sea.shallow, 0.6); c.lineWidth = 60; path(c, coast); c.stroke();
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
  c.strokeStyle = rgba(sea.foam, 0.35 + 0.25 * pulse); c.lineWidth = 10 + 10 * pulse; path(c, coast); c.stroke();
  c.setLineDash([18, 26]); c.lineDashOffset = -t * 18;
  c.strokeStyle = rgba(sea.foam, 0.45); c.lineWidth = 3; c.save(); c.translate(0, 0); c.scale(1.03, 1.03); c.translate(0, -18); path(c, coast); c.stroke(); c.restore();
  c.setLineDash([]);
  c.restore();
  // sparkles / waves
  c.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const wx = ((i * 739) % 4600) - 2300, wy = ((i * 431) % 2600) - 640;
    const a = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7);
    const dx = Math.sin(t * 0.4 + i) * 14;
    c.strokeStyle = rgba(sea.foam, 0.28 * a); c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(wx - 20 + dx, wy); c.quadraticCurveTo(wx + dx, wy - 6 * a, wx + 20 + dx, wy); c.stroke();
    if (sea.lava && i % 3 === 0) glowAt(c, wx + dx, wy, 26, '#ffb030', 0.25 * a);
  }
}
function drawGround(c) {
  if (!ground) return;
  c.drawImage(ground.cv, -ground.offX, -ground.offY, ground.cv.width / ground.sc, ground.cv.height / ground.sc);
}
let clouds = null;
function drawClouds(c, t) {
  if (!hiQ()) return;
  if (!clouds) { clouds = []; for (let i = 0; i < 7; i++) clouds.push({ x: rand(-1800, 1800), y: rand(-200, 1500), r: rand(220, 420), v: rand(10, 22) }); }
  c.save();
  for (const cl of clouds) {
    const x = ((cl.x + t * cl.v + 2200) % 4400) - 2200, y = cl.y + Math.sin(t * 0.05 + cl.r) * 30;
    c.globalAlpha = 0.11;
    c.drawImage(glowSprite('#0a1a30', true), x - cl.r, y - cl.r * 0.55, cl.r * 2, cl.r * 1.1);
  }
  c.restore();
}
let vignette = null;
function drawPost(c, theme) {
  if (!hiQ()) return;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!vignette) {
    vignette = document.createElement('canvas'); vignette.width = 512; vignette.height = 512;
    const v = vignette.getContext('2d');
    const g = v.createRadialGradient(256, 230, 120, 256, 256, 380);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,6,20,.42)');
    v.fillStyle = g; v.fillRect(0, 0, 512, 512);
    const s = v.createLinearGradient(0, 0, 512, 512);
    s.addColorStop(0, 'rgba(255,236,190,.14)'); s.addColorStop(0.5, 'rgba(255,236,190,0)');
    v.fillStyle = s; v.fillRect(0, 0, 512, 512);
  }
  c.drawImage(vignette, 0, 0, W, H);
}

/* =====================================================================
   EFFECTS - particles, flashes, rings, floating text
   ===================================================================== */
const FX = { parts: [], beams: [], texts: [], rings: [], flashes: [] };
function fxQuality() { return hiQ() ? 1 : 0.4; }
function part(o) {
  if (FX.parts.length >= 1600) return;
  FX.parts.push(Object.assign({ z: 0, vx: 0, vy: 0, vz: 0, g: 0, life: 1, max: 1, size: 3, col: '#fff', kind: 'dot', drag: 0.98, rot: Math.random() * 6, vr: (Math.random() - .5) * 10 }, o));
}
function burst(tx, ty, n, o) {
  const [wx, wy] = iso(tx, ty);
  n = Math.ceil(n * fxQuality());
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (o.speed || 60) * (0.4 + Math.random() * 0.8);
    part(Object.assign({}, o, { x: wx, y: wy, z: o.z || 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: (o.up || 0) * (0.5 + Math.random()), life: (o.life || 0.8) * (0.6 + Math.random() * 0.6), max: o.life || 0.8, col: Array.isArray(o.col) ? o.col[i % o.col.length] : o.col }));
  }
}
function flash(tx, ty, r, col, z, max) {
  const [wx, wy] = iso(tx, ty);
  FX.flashes.push({ x: wx, y: wy - (z || 0), r: r, col: col || '#ffd27a', t: 0, max: max || 0.28 });
}
function explosion(tx, ty, r, kind) {
  const big = r >= 1.5;
  const cols = kind === 'magic' ? ['#ff80ff', '#c24bff', '#ffffff'] : kind === 'lightning' ? ['#ffffff', '#7fd4ff', '#bfefff'] : kind === 'freeze' ? ['#e8fbff', '#bdf3ff'] : ['#ffe27a', '#ff9a2a', '#ff5a1a'];
  flash(tx, ty, (big ? 120 : 70) * Math.max(0.7, r * 0.6), cols[1] || cols[0], 10, big ? 0.35 : 0.22);
  burst(tx, ty, big ? 30 : 14, { col: cols, size: big ? 4.5 : 3.2, speed: 100 * r, up: 150, g: 300, life: 0.7, kind: 'spark' });
  if (kind !== 'freeze' && kind !== 'lightning') burst(tx, ty, big ? 10 : 5, { col: ['#ff9a2a', '#ffcf3a'], size: big ? 16 : 10, speed: 40 * r, up: 50, life: 0.45, kind: 'fire' });
  burst(tx, ty, big ? 14 : 6, { col: kind === 'magic' ? '#a080c0' : '#6a625a', size: big ? 16 : 10, speed: 30 * r, up: 30, life: 1.6, kind: 'smoke' });
  FX.rings.push({ tx: tx, ty: ty, r: r, t: 0, max: 0.4, col: cols[0] });
  if (big) cam.shake = Math.max(cam.shake, 10);
}
function floatText(tx, ty, txt, col, z) {
  const [wx, wy] = iso(tx, ty);
  if (FX.texts.length > 70) FX.texts.shift();
  FX.texts.push({ x: wx + rand(-6, 6), y: wy - (z || 30), txt: txt, col: col || '#fff', t: 0, max: 1.0 });
}
function updateFx(dt) {
  for (const p of FX.parts) {
    p.life -= dt;
    const dr = Math.pow(p.drag, dt * 60);
    p.vx *= dr; p.vy *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vz -= p.g * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
    if (p.z < 0 && p.g) { p.z = 0; p.vz *= -0.3; p.vx *= 0.55; p.vy *= 0.55; p.vr *= 0.5; }
    if (p.kind === 'smoke') { p.size += dt * 12; p.z += dt * 16; }
    if (p.kind === 'fire') { p.size *= Math.pow(0.4, dt); p.z += dt * 30; }
  }
  FX.parts = FX.parts.filter(p => p.life > 0);
  for (const r of FX.rings) r.t += dt;
  FX.rings = FX.rings.filter(r => r.t < r.max);
  for (const f of FX.flashes) f.t += dt;
  FX.flashes = FX.flashes.filter(f => f.t < f.max);
  for (const t of FX.texts) { t.t += dt; t.y -= dt * 38 * (1 - t.t / t.max); }
  FX.texts = FX.texts.filter(t => t.t < t.max);
  for (const b of FX.beams) b.t += dt;
  FX.beams = FX.beams.filter(b => b.t < b.max);
}
function drawParticles(c) {
  // soft, normal-blended first (smoke, debris, leaves)
  for (const p of FX.parts) {
    if (p.kind === 'spark' || p.kind === 'fire') continue;
    const a = clamp(p.life / p.max, 0, 1);
    if (p.kind === 'smoke') {
      c.globalAlpha = a * 0.7;
      const s = p.size * 2;
      c.drawImage(glowSprite(p.col, true), p.x - s, p.y - p.z - s, s * 2, s * 2);
    } else if (p.kind === 'debris') {
      c.globalAlpha = Math.min(1, a * 2);
      c.save(); c.translate(p.x, p.y - p.z); c.rotate(p.rot);
      c.fillStyle = p.col; c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.75);
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.25);
      c.restore();
    } else {
      c.globalAlpha = a; c.fillStyle = p.col;
      c.beginPath(); c.arc(p.x, p.y - p.z, p.size, 0, 7); c.fill();
    }
  }
  c.globalAlpha = 1;
  // rings
  for (const r of FX.rings) {
    const [wx, wy] = iso(r.tx, r.ty), k = r.t / r.max;
    c.globalAlpha = 1 - k; c.strokeStyle = r.col; c.lineWidth = 5 * (1 - k) + 1;
    c.beginPath(); c.ellipse(wx, wy, r.r * CRX * (0.3 + k), r.r * CRY * (0.3 + k), 0, 0, 7); c.stroke();
  }
  c.globalAlpha = 1;
  // additive glow pass: sparks, fire, flashes
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const p of FX.parts) {
    if (p.kind !== 'spark' && p.kind !== 'fire') continue;
    const a = clamp(p.life / p.max, 0, 1);
    const s = p.kind === 'fire' ? p.size * 2.2 : p.size * (2 + a * 2);
    c.globalAlpha = p.kind === 'fire' ? a * 0.9 : a;
    c.drawImage(glowSprite(p.col), p.x - s, p.y - p.z - s, s * 2, s * 2);
  }
  for (const f of FX.flashes) {
    const k = f.t / f.max;
    c.globalAlpha = (1 - k) * 0.9;
    const s = f.r * (0.6 + k * 0.6);
    c.drawImage(glowSprite(f.col), f.x - s, f.y - s * 0.75, s * 2, s * 1.5);
  }
  c.restore();
  c.globalAlpha = 1;
}
function drawTexts(c) {
  c.textAlign = 'center'; c.font = '17px "Lilita One", Impact, sans-serif'; c.lineWidth = 3.5; c.strokeStyle = 'rgba(0,0,0,.85)'; c.lineJoin = 'round';
  for (const t of FX.texts) {
    const k = t.t / t.max;
    c.globalAlpha = clamp(1 - k * k, 0, 1);
    const sc = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
    c.save(); c.translate(t.x, t.y); c.scale(sc, sc);
    c.strokeText(t.txt, 0, 0); c.fillStyle = t.col; c.fillText(t.txt, 0, 0);
    c.restore();
  }
  c.globalAlpha = 1;
}
/* ambient particles per theme: leaves, fireflies, embers or snow */
let ambientT = 0;
function ambient(dt, theme) {
  ambientT += dt;
  if (ambientT < 0.1 / fxQuality()) return;
  ambientT = 0;
  const n = theme.name || '';
  const tx = rand(-4, D.GRID + 4), ty = rand(-4, D.GRID + 4);
  const [wx, wy] = iso(tx, ty);
  if (/Frozen|Celestial/.test(n)) part({ x: wx, y: wy - 220, z: 0, vx: rand(-8, 8), vy: 30, life: 7, max: 7, size: 2.2, col: '#fff', drag: 1 });
  else if (/Volcano|Inferno|Citadel/.test(n)) part({ x: wx, y: wy, z: 0, vz: 30, vx: rand(-6, 6), life: 3, max: 3, size: 1.6, col: '#ff8a2a', kind: 'spark', drag: 1 });
  else if (/Dark Forest|Shadow|Swamp|Endgame|Crystal/.test(n)) part({ x: wx, y: wy, z: 20, vx: rand(-10, 10), vy: rand(-5, 5), vz: rand(-4, 4), life: 4, max: 4, size: 1.4, col: theme.accent || '#c6ff3a', kind: 'spark', drag: 1 });
  else if (Math.random() < 0.6) part({ x: wx, y: wy - 120, z: 0, vx: rand(12, 28), vy: 16, life: 6, max: 6, size: 3, col: ['#8fd36b', '#c8e86a', '#ffb0c8', '#ffd27a'][Math.floor(Math.random() * 4)], kind: 'debris', drag: 1, vr: rand(-3, 3) });
  else part({ x: wx, y: wy, z: 14, vx: rand(-6, 6), vy: rand(-3, 3), vz: rand(-2, 4), life: 3, max: 3, size: 1.1, col: '#fff6b0', kind: 'spark', drag: 1 });
}
