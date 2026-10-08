'use strict';
/* =====================================================================
   GREJS BASE BUILDER - art-buildings.js
   Building art in the "Grejs Kingdom" style: front view, chunky dark
   outlines, strong gradients, rounded shapes, gold details, emblems and
   a soft oval shadow. (Cannon, Gold Mine and Gold Storage come from the
   preview.html design; everything else follows the same rules.)

   Art space: every building is drawn around its ground point (0,0) -
   x roughly -110..110, height upward (negative y). The sprite system
   scales that to the building's footprint. Parts that move (barrels,
   flags, fire, orbs) are drawn live with the same transform.
   Walls stay isometric so they can join up, with the same outlines.
   ===================================================================== */

const OL = '#2a190c';                 // outline colour
const GOLD = '#ffd23f';
const WALL_COLS = ['#a8743e', '#b07a45', '#cfc6b2', '#c2bfb8', '#e2bd52', '#a08ad8', '#8a9ac0', '#5a5a6e', '#cc5040', '#3a3450'];

/* ---- art helpers ------------------------------------------------------ */
function rrect(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function fs(c, fill, lw, stroke) {
  c.fillStyle = fill; c.fill();
  if (lw !== 0) { c.lineWidth = lw || 5; c.strokeStyle = stroke || OL; c.lineJoin = 'round'; c.stroke(); }
}
function vg(c, y0, y1, a, b, m) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); if (m) g.addColorStop(0.5, m); g.addColorStop(1, b); return g; }
function hg(c, x0, x1, a, b, m) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); if (m) g.addColorStop(0.45, m); g.addColorStop(1, b); return g; }
function dg(c, x0, y0, x1, y1, a, m, b) { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(0.45, m); g.addColorStop(1, b); return g; }
function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }
function ball(c, x, y, r, col, lw) {
  const g = c.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
  g.addColorStop(0, shade(col, 0.6)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.45));
  circle(c, x, y, r); fs(c, g, lw == null ? 3 : lw);
}
function shine(c, x, y, w, h, a) { rrect(c, x, y, w, h, Math.min(w, h) / 2); c.fillStyle = 'rgba(255,255,255,' + (a || 0.28) + ')'; c.fill(); }
function groundShadow(c, rx, ry) {
  c.save(); c.translate(8, 2); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
  g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(0.7, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; circle(c, 0, 0, rx); c.fill(); c.restore();
}
function clipRect(c, x, y, w, h, r, fn) { c.save(); rrect(c, x, y, w, h, r); c.clip(); fn(); c.restore(); }
function bricks(c, x, y, w, h, rh, cw) {
  c.strokeStyle = 'rgba(40,20,5,.22)'; c.lineWidth = 2;
  let row = 0;
  for (let yy = y + rh; yy < y + h; yy += rh, row++) {
    c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke();
    for (let xx = x + (row % 2 ? cw / 2 : 0); xx < x + w; xx += cw) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy - rh); c.stroke(); }
  }
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1.5;
  for (let yy = y + rh + 2; yy < y + h; yy += rh) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
}
function planks(c, x, y, w, h, pw, vertical) {
  c.strokeStyle = 'rgba(40,20,5,.28)'; c.lineWidth = 2.5;
  if (vertical) for (let xx = x + pw; xx < x + w; xx += pw) { c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + h); c.stroke(); }
  else for (let yy = y + pw; yy < y + h; yy += pw) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
  c.fillStyle = 'rgba(40,20,5,.35)';
  for (let yy = y + 6; yy < y + h; yy += pw * 2) for (let xx = x + 6; xx < x + w; xx += pw * 2) { circle(c, xx, yy, 1.6); c.fill(); }
}
/* triangle roof with shingle rows and an overhanging eave */
function roof(c, x0, x1, yb, yt, col, o) {
  o = o || {};
  const mx = (x0 + x1) / 2;
  c.beginPath(); c.moveTo(x0, yb); c.lineTo(mx, yt); c.lineTo(x1, yb); c.closePath();
  fs(c, dg(c, mx - 40, yt, mx + 40, yb, shade(col, 0.28), col, shade(col, -0.4)), 0);
  c.save(); c.beginPath(); c.moveTo(x0, yb); c.lineTo(mx, yt); c.lineTo(x1, yb); c.closePath(); c.clip();
  const rows = Math.max(3, Math.round((yb - yt) / 14));
  for (let i = 1; i < rows; i++) {
    const y = yt + (yb - yt) * i / rows, half = (x1 - x0) / 2 * i / rows;
    c.strokeStyle = 'rgba(30,10,0,.28)'; c.lineWidth = 2.5;
    c.beginPath();
    for (let x = mx - half; x < mx + half; x += 16) { c.moveTo(x, y); c.quadraticCurveTo(x + 8, y + 7, x + 16, y); }
    c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.moveTo(mx, yt + 6); c.lineTo(mx - (x1 - x0) * 0.32, yb - 4); c.lineTo(mx - (x1 - x0) * 0.22, yb - 4); c.closePath(); c.fill();
  c.restore();
  c.beginPath(); c.moveTo(x0, yb); c.lineTo(mx, yt); c.lineTo(x1, yb); c.closePath(); c.lineWidth = 5; c.strokeStyle = OL; c.lineJoin = 'round'; c.stroke();
  rrect(c, x0 - 6, yb - 4, x1 - x0 + 12, 12, 5); fs(c, vg(c, yb - 4, yb + 8, shade(col, -0.1), shade(col, -0.5)), 4);
  if (o.knob) ball(c, mx, yt - 6, 8, o.knob);
}
/* front-view cylinder (round towers, tanks) */
function cylinderF(c, cx, w, yb, yt, col, o) {
  o = o || {};
  const x0 = cx - w / 2, ry = w * 0.16;
  c.beginPath(); c.moveTo(x0, yt); c.lineTo(x0, yb); c.ellipse(cx, yb, w / 2, ry, 0, Math.PI, 0, true); c.lineTo(x0 + w, yt); c.closePath();
  fs(c, hg(c, x0, x0 + w, shade(col, 0.05), shade(col, -0.45), shade(col, 0.28)), 0);
  if (o.bricks) { c.save(); c.clip(); bricks(c, x0, yt, w, yb - yt + ry, 13, 26); c.restore(); }
  c.beginPath(); c.moveTo(x0, yt); c.lineTo(x0, yb); c.ellipse(cx, yb, w / 2, ry, 0, Math.PI, 0, true); c.lineTo(x0 + w, yt);
  c.lineWidth = 5; c.strokeStyle = OL; c.stroke();
  if (!o.noTop) { c.beginPath(); c.ellipse(cx, yt, w / 2, ry, 0, 0, Math.PI * 2); fs(c, vg(c, yt - ry, yt + ry, shade(col, 0.35), shade(col, -0.1)), 4); }
  shine(c, x0 + w * 0.16, yt + 8, w * 0.08, (yb - yt) * 0.7, 0.22);
}
function coneRoof(c, cx, w, yb, h, col, o) {
  const x0 = cx - w / 2, ry = w * 0.16;
  c.beginPath(); c.moveTo(x0, yb); c.ellipse(cx, yb, w / 2, ry, 0, Math.PI, 0, true); c.lineTo(cx, yb - h); c.closePath();
  fs(c, hg(c, x0, x0 + w, shade(col, 0.1), shade(col, -0.45), shade(col, 0.32)), 0);
  c.save(); c.clip();
  for (let i = 1; i < 6; i++) { const y = yb - h * i / 6, hw = w / 2 * (1 - i / 6); c.beginPath(); c.ellipse(cx, y, hw, ry * (1 - i / 6), 0, 0, Math.PI); c.strokeStyle = 'rgba(30,10,0,.25)'; c.lineWidth = 2.5; c.stroke(); }
  c.restore();
  c.beginPath(); c.moveTo(x0, yb); c.ellipse(cx, yb, w / 2, ry, 0, Math.PI, 0, true); c.lineTo(cx, yb - h); c.closePath(); c.lineWidth = 5; c.strokeStyle = OL; c.lineJoin = 'round'; c.stroke();
  if (o && o.knob) ball(c, cx, yb - h - 5, 7, o.knob);
}
function windowArch(c, x, y, w, h, glow) {
  c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath();
  fs(c, vg(c, y, y + h, glow ? '#fff3a8' : '#cfeeff', glow ? '#ff9a1a' : '#4a8ac0'), 4);
  c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.moveTo(x + w / 2, y + 3); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h * 0.55); c.lineTo(x + w, y + h * 0.55); c.stroke();
}
function doorArch(c, x, y, w, h, col) {
  c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath();
  fs(c, vg(c, y, y + h, shade(col || '#5a361c', 0.1), shade(col || '#5a361c', -0.55)), 5);
  c.save(); c.clip(); planks(c, x, y, w, h, 12, true); c.restore();
  ball(c, x + w * 0.75, y + h * 0.6, 3.5, GOLD, 1.5);
}
function emblem(c, x, y, r, col, draw) {
  circle(c, x, y, r + 4); fs(c, '#3a2410', 0);
  circle(c, x, y, r); fs(c, dg(c, x - r, y - r, x + r, y + r, shade(col, 0.5), col, shade(col, -0.45)), 4);
  if (draw) { c.save(); c.translate(x, y); draw(c, r); c.restore(); }
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - r * .35, y - r * .45, r * .35, r * .18, -0.5, 0, 7); c.fill();
}
const symCrown = (c, r) => { c.beginPath(); c.moveTo(-r * .6, r * .35); c.lineTo(-r * .6, -r * .35); c.lineTo(-r * .3, 0); c.lineTo(0, -r * .5); c.lineTo(r * .3, 0); c.lineTo(r * .6, -r * .35); c.lineTo(r * .6, r * .35); c.closePath(); fs(c, '#7a4a05', 0); };
const symSwords = (c, r) => { c.strokeStyle = '#f2f6fa'; c.lineWidth = r * .22; c.lineCap = 'round'; c.beginPath(); c.moveTo(-r * .55, -r * .55); c.lineTo(r * .55, r * .55); c.moveTo(r * .55, -r * .55); c.lineTo(-r * .55, r * .55); c.stroke(); c.strokeStyle = '#7a4a05'; c.lineWidth = r * .28; c.beginPath(); c.moveTo(-r * .35, r * .1); c.lineTo(-r * .1, r * .35); c.moveTo(r * .35, r * .1); c.lineTo(r * .1, r * .35); c.stroke(); };
const symText = t => (c, r) => { c.fillStyle = '#7a4a05'; c.font = 'bold ' + Math.round(r * 1.3) + 'px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, 0, 1); };
const symFlask = (c, r) => { c.beginPath(); c.moveTo(-r * .15, -r * .6); c.lineTo(r * .15, -r * .6); c.lineTo(r * .15, -r * .2); c.lineTo(r * .55, r * .5); c.lineTo(-r * .55, r * .5); c.lineTo(-r * .15, -r * .2); c.closePath(); fs(c, '#f2fbff', 2); c.beginPath(); c.moveTo(-r * .38, r * .2); c.lineTo(r * .38, r * .2); c.lineTo(r * .55, r * .5); c.lineTo(-r * .55, r * .5); c.closePath(); fs(c, '#4be36b', 0); };
const symDrop = col => (c, r) => { c.beginPath(); c.moveTo(0, -r * .6); c.quadraticCurveTo(r * .55, 0, r * .45, r * .25); c.arc(0, r * .25, r * .45, 0, Math.PI); c.quadraticCurveTo(-r * .55, 0, 0, -r * .6); fs(c, col, 2); };
function crystal(c, cx, cy, size, a, m, b) {
  const g = c.createLinearGradient(cx, cy - size, cx, cy + size); g.addColorStop(0, a); g.addColorStop(.35, m); g.addColorStop(1, b);
  c.beginPath(); c.moveTo(cx, cy - size); c.lineTo(cx + size * .55, cy); c.lineTo(cx, cy + size); c.lineTo(cx - size * .55, cy); c.closePath();
  fs(c, g, 3, shade(b, -0.3));
  c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.moveTo(cx, cy - size * .8); c.lineTo(cx + size * .2, cy - size * .1); c.lineTo(cx, cy); c.closePath(); c.fill();
}
function battlements(c, x, y, w, n, col, h) {
  const bw = w / (n * 2 - 1);
  for (let i = 0; i < n; i++) { rrect(c, x + i * bw * 2, y - (h || 16), bw, (h || 16) + 4, 3); fs(c, vg(c, y - 16, y, shade(col, 0.2), shade(col, -0.2)), 4); }
}
function stoneBlock(c, x, y, w, h, col, r) {
  rrect(c, x, y, w, h, r == null ? 12 : r);
  fs(c, dg(c, x, y, x + w, y + h, shade(col, 0.25), col, shade(col, -0.4)), 5);
  clipRect(c, x, y, w, h, r == null ? 12 : r, () => bricks(c, x, y, w, h, 15, 32));
}
function ingot(c, ix, iy, w, h) {
  const g = c.createLinearGradient(ix, iy, ix, iy + h); g.addColorStop(0, '#fff274'); g.addColorStop(.4, '#ffd028'); g.addColorStop(1, '#b36e00');
  rrect(c, ix, iy, w, h, 6); fs(c, g, 3, '#936000');
}
/* materials by level: wood -> stone -> stone & gold -> royal */
function mat(lv) {
  if (lv >= 9) return { wall: '#6a5a8e', roof: '#2e2448', trim: GOLD, wood: '#4a3a5a', glow: '#c58bff' };
  if (lv >= 7) return { wall: '#d4d8e0', roof: '#2f62c0', trim: GOLD, wood: '#6a4a2a', glow: '#ffe27a' };
  if (lv >= 4) return { wall: '#dccb9e', roof: '#c0412f', trim: '#c9a24a', wood: '#7a4a22', glow: '#ffe27a' };
  return { wall: '#c99a62', roof: '#a83c2a', trim: '#8a5a2b', wood: '#7a4a22', glow: '#ffe27a' };
}

/* =====================================================================
   BUILDINGS (art space, ground at y = 0)
   ===================================================================== */
const ART = {
  townhall(c, lv) {
    const m = mat(lv), tall = lv >= 7 ? 22 : 0;
    groundShadow(c, 125, 30);
    stoneBlock(c, -114, -44, 228, 46, '#9a958c', 14);
    if (lv >= 4) for (const x of [-92, 92]) { cylinderF(c, x, 50, -40, -178, shade(m.wall, -0.08), { bricks: true }); windowArch(c, x - 9, -140, 18, 26, true); coneRoof(c, x, 62, -178, 62, m.roof, { knob: m.trim }); }
    rrect(c, -86, -170, 172, 130, 12); fs(c, vg(c, -170, -40, shade(m.wall, 0.18), shade(m.wall, -0.3)), 5);
    clipRect(c, -86, -170, 172, 130, 12, () => (lv <= 2 ? planks(c, -86, -170, 172, 130, 14) : bricks(c, -86, -170, 172, 130, 15, 32)));
    windowArch(c, -66, -138, 28, 40, true); windowArch(c, 38, -138, 28, 40, true);
    doorArch(c, -26, -112, 52, 72);
    rrect(c, -94, -178, 188, 16, 6); fs(c, vg(c, -178, -162, shade(m.trim, 0.35), shade(m.trim, -0.35)), 4);
    roof(c, -116, 116, -168, -268 - tall, m.roof, { knob: m.trim });
    emblem(c, 0, -205 - tall * 0.4, 20, GOLD, symCrown);
    if (lv >= 9) crystal(c, 0, -300 - tall, 16, '#f2e0ff', '#c58bff', '#6a3ab0');
  },
  builderhut(c) {
    groundShadow(c, 90, 22);
    rrect(c, -68, -84, 136, 86, 10); fs(c, vg(c, -84, 2, '#d09a5a', '#7a4a22'), 5);
    clipRect(c, -68, -84, 136, 86, 10, () => planks(c, -68, -84, 136, 86, 14));
    doorArch(c, -20, -62, 40, 62);
    windowArch(c, 32, -66, 22, 28, true);
    rrect(c, 34, -170, 22, 60, 4); fs(c, vg(c, -170, -110, '#9a8a80', '#5a4a40'), 4);
    roof(c, -90, 90, -80, -160, '#c84a34');
    emblem(c, -42, -60, 12, '#c8d0d8', (c, r) => { rrect(c, -r * .55, -r * .5, r * 1.1, r * .4, 2); fs(c, '#5a5a6a', 0); rrect(c, -r * .12, -r * .2, r * .24, r * .85, 2); fs(c, '#8a5a2b', 0); });
  },
  goldmine(c, lv) {
    const dy = -105;
    groundShadow(c, 105, 27);
    c.save(); c.translate(0, dy);
    c.beginPath(); c.moveTo(-95, 100); c.lineTo(-75, 25); c.lineTo(-35, -10); c.lineTo(10, -55); c.lineTo(60, -5); c.lineTo(90, 100); c.closePath();
    fs(c, vg(c, -50, 110, '#7d6e60', '#2d2927', '#51463e'), 6, '#29231f');
    c.save(); c.clip(); c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 3; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-90 + i * 30, 100); c.lineTo(-60 + i * 25, 0); c.stroke(); } c.restore();
    c.fillStyle = '#191614'; c.beginPath(); c.arc(0, 65, 43, Math.PI, 0); c.lineTo(43, 105); c.lineTo(-43, 105); c.closePath(); c.fill();
    const wood = lv >= 6 ? '#8a8a9a' : '#70431f';
    c.strokeStyle = wood; c.lineWidth = 13; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(-47, 23); c.lineTo(-47, 106); c.moveTo(47, 23); c.lineTo(47, 106); c.stroke();
    c.lineWidth = 14; c.beginPath(); c.moveTo(-55, 24); c.lineTo(55, 24); c.stroke();
    c.strokeStyle = OL; c.lineWidth = 2; for (const x of [-53.5, 40.5]) c.strokeRect(x, 23, 13, 83); c.strokeRect(-55, 17, 110, 14);
    for (const [cx, cy, size] of [[-62, 58, 16], [65, 48, 20], [-35, -12, 13], [37, -18, 16], [5, -38, 17]]) crystal(c, cx, cy, size, '#fff37c', '#ffd12f', '#b97800');
    rrect(c, -105, 76, 55, 28, 6); fs(c, vg(c, 76, 104, '#8a5a34', '#4a2e18'), 4);
    for (const x of [-95, -60]) { ball(c, x, 106, 7, '#3a3a40', 3); }
    ball(c, -88, 68, 10, '#ffd43d', 2); ball(c, -72, 63, 12, '#ffdf55', 2); ball(c, -58, 69, 9, '#d99e12', 2);
    c.restore();
  },
  elixircollector(c, lv) {
    groundShadow(c, 100, 25);
    const wood = lv >= 6 ? '#8a8a9a' : '#7a4a22';
    c.lineCap = 'round';
    for (const [x0, x1] of [[-82, -38], [82, 38]]) { c.strokeStyle = OL; c.lineWidth = 18; c.beginPath(); c.moveTo(x0, -4); c.lineTo(x1, -190); c.stroke(); c.strokeStyle = wood; c.lineWidth = 11; c.beginPath(); c.moveTo(x0, -4); c.lineTo(x1, -190); c.stroke(); }
    rrect(c, -62, -62, 124, 62, 12); fs(c, vg(c, -62, 0, '#9aa6b4', '#4a5260'), 5);
    for (const x of [-48, -24, 0, 24, 48]) { ball(c, x, -50, 3, '#d8dee6', 1); }
    rrect(c, -14, -100, 28, 42, 6); fs(c, hg(c, -14, 14, '#7a8696', '#3a424e', '#b8c2ce'), 4);
    const g = c.createRadialGradient(-16, -150, 6, 0, -132, 54);
    g.addColorStop(0, '#ffd8ff'); g.addColorStop(0.45, '#e055ff'); g.addColorStop(1, '#6a0a8a');
    circle(c, 0, -134, 50); fs(c, g, 6);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-18, -156, 14, 8, -0.6, 0, 7); c.fill();
    rrect(c, -58, -196, 116, 18, 6); fs(c, vg(c, -196, -178, '#c8d0d8', '#5a6270'), 4);
    if (lv >= 5) { rrect(c, -60, -66, 120, 8, 3); fs(c, GOLD, 2); }
  },
  darkdrill(c, lv) {
    groundShadow(c, 100, 25);
    c.beginPath(); c.moveTo(-80, 0); c.lineTo(-50, -150); c.lineTo(50, -150); c.lineTo(80, 0); c.closePath();
    fs(c, hg(c, -80, 80, '#4a4258', '#1e1a28', '#6a6278'), 5);
    c.save(); c.clip(); for (let y = -130; y < 0; y += 28) { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(-90, y, 180, 6); } c.restore();
    for (const x of [-56, 56]) { c.beginPath(); c.moveTo(x - 10, -150); c.lineTo(x, -178); c.lineTo(x + 10, -150); c.closePath(); fs(c, '#c8d0d8', 3); }
    rrect(c, -60, -164, 120, 18, 6); fs(c, vg(c, -164, -146, '#8a8298', '#3a3248'), 4);
    ball(c, 0, -200, 34, '#4a2a8a', 5);
    c.fillStyle = 'rgba(200,170,255,.5)'; c.beginPath(); c.ellipse(-11, -213, 9, 5, -0.6, 0, 7); c.fill();
    emblem(c, 0, -60, 18, '#6a4ab0', symDrop('#1e1030'));
  },
  goldstorage(c, lv, fill) {
    const f = (fill || 0) / 4, m = mat(lv);
    c.save(); c.translate(0, -112);
    groundShadow2(c, 0, 115, 100, 23);
    rrect(c, -82, 0, 164, 105, 15); fs(c, vg(c, -10, 110, lv >= 7 ? '#eef0f4' : '#e0c58d', lv >= 7 ? '#8a94a2' : '#9a7242'), 6, '#604321');
    clipRect(c, -82, 0, 164, 105, 15, () => bricks(c, -82, 0, 164, 105, 18, 40));
    roof(c, -105, 105, 2, -68, lv >= 7 ? m.roof : '#8f3d2f');
    c.strokeStyle = lv >= 4 ? '#c9a24a' : '#714721'; c.lineWidth = 13;
    c.beginPath(); c.moveTo(-74, 14); c.lineTo(-30, 40); c.moveTo(74, 14); c.lineTo(30, 40); c.moveTo(-74, 92); c.lineTo(-30, 70); c.moveTo(74, 92); c.lineTo(30, 70); c.stroke();
    rrect(c, -28, 23, 56, 80, 9); fs(c, dg(c, -28, 20, 28, 100, '#4a2f1b', '#36230f', '#1f160e'), 5, '#2b1b0f');
    emblem(c, 0, 50, 17, '#ffd437', symText('$'));
    const n = Math.round(f * 5);
    const spots = [[-57, 88], [-20, 94], [18, 88], [-38, 74], [0, 79]];
    for (let i = 0; i < n; i++) ingot(c, spots[i][0], spots[i][1], 35, 20);
    if (f > 0) { c.fillStyle = 'rgba(255,214,50,' + (0.12 + f * 0.12) + ')'; circle(c, 0, 55, 46); c.fill(); }
    c.restore();
  },
  elixirstorage(c, lv, fill) { tank(c, lv, fill, '#c03ae0', '#ffb8ff', '#8a96a6', symDrop('#e055ff')); },
  darkstorage(c, lv, fill) { tank(c, lv, fill, '#3a2468', '#a080ff', '#4a4258', symDrop('#2a1450'), true); },
  armycamp(c, lv) {
    c.save(); c.scale(1, 0.5);
    const g = c.createRadialGradient(0, -40, 20, 0, -40, 150); g.addColorStop(0, '#d2aa74'); g.addColorStop(0.8, 'rgba(180,140,90,.6)'); g.addColorStop(1, 'rgba(180,140,90,0)');
    c.fillStyle = g; circle(c, 0, -40, 150); c.fill(); c.restore();
    const tc = lv >= 5 ? '#2f62c0' : '#c84a34';
    const tent = (x, y, s) => {
      c.save(); c.translate(x, y); c.scale(s, s);
      groundShadow(c, 50, 10);
      c.beginPath(); c.moveTo(-48, 0); c.lineTo(0, -80); c.lineTo(48, 0); c.closePath(); fs(c, dg(c, -40, -80, 40, 0, shade(tc, 0.3), tc, shade(tc, -0.45)), 5);
      c.beginPath(); c.moveTo(-14, 0); c.lineTo(0, -46); c.lineTo(14, 0); c.closePath(); fs(c, '#2a1408', 3);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -78); c.lineTo(-30, -4); c.stroke();
      c.restore();
    };
    tent(-70, -56, 0.8); tent(70, -56, 0.8); tent(0, -84, 0.75);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ball(c, Math.cos(a) * 30, -22 + Math.sin(a) * 12, 6, '#9aa3ad', 2); }
    for (const [x, y, w] of [[-80, -6, 50], [40, -2, 54]]) { rrect(c, x, y - 10, w, 14, 7); fs(c, vg(c, y - 10, y + 4, '#a0703a', '#5a3a18'), 4); }
    rrect(c, 88, -100, 8, 100, 3); fs(c, '#6a4a2a', 3);
  },
  barracks(c, lv) {
    const m = mat(lv);
    groundShadow(c, 110, 26);
    stoneBlock(c, -96, -40, 192, 42, '#9a958c');
    rrect(c, -84, -150, 168, 114, 10); fs(c, vg(c, -150, -36, shade(m.wall, 0.15), shade(m.wall, -0.35)), 5);
    clipRect(c, -84, -150, 168, 114, 10, () => (lv <= 3 ? planks(c, -84, -150, 168, 114, 16, true) : bricks(c, -84, -150, 168, 114, 15, 32)));
    battlements(c, -90, -150, 180, 5, shade(m.wall, -0.05), 18);
    doorArch(c, -30, -106, 60, 70, '#6a3a18');
    for (const x of [-68, 44]) windowArch(c, x, -128, 24, 32, true);
    c.fillStyle = shade(m.roof, -0.1); rrect(c, -70, -146, 140, 20, 6); fs(c, vg(c, -146, -126, shade(m.roof, 0.2), shade(m.roof, -0.3)), 4);
    emblem(c, 0, -170, 22, '#c84a34', symSwords);
  },
  darkbarracks(c, lv) {
    groundShadow(c, 110, 26);
    stoneBlock(c, -96, -40, 192, 42, '#3a3048');
    rrect(c, -84, -160, 168, 124, 10); fs(c, vg(c, -160, -36, '#5a4a70', '#241c34'), 5);
    clipRect(c, -84, -160, 168, 124, 10, () => bricks(c, -84, -160, 168, 124, 16, 34));
    for (let i = 0; i < 5; i++) { const x = -76 + i * 38; c.beginPath(); c.moveTo(x - 10, -160); c.lineTo(x, -196); c.lineTo(x + 10, -160); c.closePath(); fs(c, vg(c, -196, -160, '#e8eef5', '#7a8696'), 3); }
    c.beginPath(); c.moveTo(-30, -36); c.lineTo(-30, -84); c.arc(0, -84, 30, Math.PI, 0); c.lineTo(30, -36); c.closePath();
    fs(c, vg(c, -114, -36, '#e0a0ff', '#5a1a8a'), 5);
    for (const x of [-66, 44]) windowArch(c, x, -134, 22, 30, false);
    emblem(c, 0, -134, 18, '#a26bff', (c, r) => { circle(c, 0, -r * .1, r * .5); fs(c, '#f2f6fa', 0); c.fillStyle = '#2a1a3a'; circle(c, -r * .2, -r * .15, r * .13); c.fill(); circle(c, r * .2, -r * .15, r * .13); c.fill(); c.fillRect(-r * .25, r * .3, r * .5, r * .18); });
  },
  laboratory(c, lv) {
    groundShadow(c, 110, 26);
    stoneBlock(c, -96, -36, 192, 38, '#9a9aa8');
    rrect(c, -82, -128, 164, 96, 10); fs(c, vg(c, -128, -32, '#f2f4f8', '#9aa2ae'), 5);
    clipRect(c, -82, -128, 164, 96, 10, () => bricks(c, -82, -128, 164, 96, 16, 34));
    doorArch(c, -22, -96, 44, 62, '#2f5f9a');
    for (const x of [-66, 42]) windowArch(c, x, -112, 24, 30, false);
    // glass dome
    c.beginPath(); c.moveTo(-76, -128); c.bezierCurveTo(-76, -232, 76, -232, 76, -128); c.closePath();
    const g = c.createRadialGradient(-26, -196, 6, 0, -150, 100); g.addColorStop(0, '#f6feff'); g.addColorStop(0.45, '#8fdcff'); g.addColorStop(1, '#2a6aa0');
    fs(c, g, 5);
    c.strokeStyle = 'rgba(20,60,100,.45)'; c.lineWidth = 3;
    for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(k * 140, -128); c.quadraticCurveTo(k * 90, -200, 0, -206); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(-30, -184, 16, 8, -0.6, 0, 7); c.fill();
    rrect(c, -86, -134, 172, 12, 5); fs(c, vg(c, -134, -122, '#d8dee6', '#6a7480'), 4);
    emblem(c, 0, -150, 17, '#7fd4ff', symFlask);
    rrect(c, 56, -168, 14, 46, 4); fs(c, hg(c, 56, 70, '#8a96a6', '#3a424e', '#c8d0d8'), 3);
  },
  spellfactory(c, lv) {
    groundShadow(c, 95, 24);
    stoneBlock(c, -84, -32, 168, 34, '#7a6a9a');
    cylinderF(c, 0, 128, -30, -168, '#9a88c8', { bricks: true });
    windowArch(c, -14, -132, 28, 38, false);
    doorArch(c, -22, -82, 44, 52, '#4a2a6a');
    rrect(c, -70, -176, 140, 14, 6); fs(c, vg(c, -176, -162, '#fff2a0', '#b88a10'), 4);
    coneRoof(c, 0, 156, -170, 92, '#7a3ad0', { knob: GOLD });
  },
  blacksmith(c, lv) {
    groundShadow(c, 112, 26);
    stoneBlock(c, -96, -36, 192, 38, '#7a6a5a');
    rrect(c, 30, -210, 44, 120, 6); fs(c, vg(c, -210, -90, '#a26a4a', '#5a3424'), 5);
    clipRect(c, 30, -210, 44, 120, 6, () => bricks(c, 30, -210, 44, 120, 12, 22));
    rrect(c, 24, -218, 56, 14, 4); fs(c, '#4a3a30', 4);
    rrect(c, -86, -122, 172, 88, 10); fs(c, vg(c, -122, -34, '#a8988a', '#5a4c40'), 5);
    clipRect(c, -86, -122, 172, 88, 10, () => bricks(c, -86, -122, 172, 88, 15, 30));
    c.beginPath(); c.moveTo(-60, -34); c.lineTo(-60, -70); c.arc(-15, -70, 45, Math.PI, 0); c.lineTo(30, -34); c.closePath();
    const fg = c.createRadialGradient(-15, -50, 6, -15, -60, 60); fg.addColorStop(0, '#fff2a0'); fg.addColorStop(0.4, '#ff8a1a'); fg.addColorStop(1, '#6a1a04');
    fs(c, fg, 5);
    roof(c, -104, 104, -118, -176, '#5a4034');
    // anvil
    c.save(); c.translate(-70, -6);
    rrect(c, -30, -32, 60, 14, 5); fs(c, vg(c, -32, -18, '#9aa3ad', '#3a424e'), 4);
    c.beginPath(); c.moveTo(30, -32); c.quadraticCurveTo(46, -30, 44, -22); c.lineTo(30, -20); c.closePath(); fs(c, '#6a727e', 3);
    rrect(c, -12, -20, 24, 20, 3); fs(c, '#3a424e', 4);
    c.restore();
  },
  altar(c) {
    groundShadow(c, 100, 24);
    rrect(c, -96, -30, 192, 32, 14); fs(c, vg(c, -30, 2, '#cfc6b2', '#7a7262'), 5);
    rrect(c, -74, -54, 148, 28, 12); fs(c, vg(c, -54, -26, '#e8e0cc', '#9a9280'), 5);
    rrect(c, -78, -58, 156, 9, 4); fs(c, vg(c, -58, -49, '#fff2a0', '#b88a10'), 3);
    for (const x of [-60, -20, 20, 60]) { rrect(c, x - 5, -22, 10, 12, 3); fs(c, '#7fd4ff', 2); }
  },
  cannon(c, lv) {
    const dy = -92;
    groundShadow(c, 82, 22);
    c.save(); c.translate(0, dy);
    rrect(c, -65, 25, 130, 60, 16);
    fs(c, dg(c, -65, 20, 65, 85, lv >= 7 ? '#c8d0d8' : '#7b8997', lv >= 7 ? '#7a8696' : '#4a5661', '#252d35'), 6, '#1d242b');
    if (lv >= 4) { rrect(c, -65, 25, 130, 12, 6); fs(c, vg(c, 25, 37, '#ffe27a', '#b8860b'), 3); }
    for (const wx of [-52, 52]) {
      circle(c, wx, 78, 27); fs(c, '#252525', 4, '#111');
      c.strokeStyle = '#5e5e5e'; c.lineWidth = 7; circle(c, wx, 78, 18); c.stroke();
      c.strokeStyle = '#222'; c.lineWidth = 4; c.beginPath(); c.moveTo(wx - 13, 78); c.lineTo(wx + 13, 78); c.moveTo(wx, 65); c.lineTo(wx, 91); c.stroke();
      ball(c, wx, 78, 5, '#d7a63a', 2);
    }
    rrect(c, -25, -20, 50, 60, 14); fs(c, dg(c, -20, -20, 30, 40, '#ffd45a', '#d99b24', '#7e4c08'), 5, '#583706');
    shine(c, -15, -12, 8, 40, 0.25);
    emblem(c, 0, 18, 13, '#f8d34e', symText('C'));
    c.restore();
  },
  archertower(c, lv) {
    const m = mat(lv), wood = lv >= 6 ? '#bdb6a6' : '#8a5a2b';
    groundShadow(c, 95, 24);
    if (lv >= 6) { c.beginPath(); c.moveTo(-70, 0); c.lineTo(-52, -180); c.lineTo(52, -180); c.lineTo(70, 0); c.closePath(); fs(c, vg(c, -180, 0, shade(wood, 0.15), shade(wood, -0.35)), 5); c.save(); c.clip(); bricks(c, -75, -180, 150, 180, 16, 32); c.restore(); }
    else {
      c.lineCap = 'round';
      for (const [x0, x1] of [[-66, -48], [66, 48]]) { c.strokeStyle = OL; c.lineWidth = 20; c.beginPath(); c.moveTo(x0, -2); c.lineTo(x1, -180); c.stroke(); c.strokeStyle = wood; c.lineWidth = 13; c.beginPath(); c.moveTo(x0, -2); c.lineTo(x1, -180); c.stroke(); }
      for (const y of [-50, -118]) { c.strokeStyle = OL; c.lineWidth = 12; c.beginPath(); c.moveTo(-60, y); c.lineTo(60, y - 40); c.moveTo(60, y); c.lineTo(-60, y - 40); c.stroke(); c.strokeStyle = shade(wood, -0.15); c.lineWidth = 7; c.beginPath(); c.moveTo(-60, y); c.lineTo(60, y - 40); c.moveTo(60, y); c.lineTo(-60, y - 40); c.stroke(); }
    }
    rrect(c, -82, -200, 164, 26, 6); fs(c, vg(c, -200, -174, shade(wood, 0.2), shade(wood, -0.35)), 5);
    clipRect(c, -82, -200, 164, 26, 6, () => planks(c, -82, -200, 164, 26, 20, true));
    for (let i = 0; i < 6; i++) { rrect(c, -80 + i * 30, -228, 14, 30, 3); fs(c, vg(c, -228, -198, shade(wood, 0.2), shade(wood, -0.3)), 3); }
    if (lv >= 4) { for (const x of [-76, 70]) { rrect(c, x, -270, 8, 72, 2); fs(c, '#5a3a20', 2); } roof(c, -96, 96, -266, -320, m.roof, { knob: m.trim }); }
  },
  mortar(c, lv) {
    groundShadow(c, 100, 25);
    const bag = lv >= 5 ? '#b4b8c0' : '#d8c48e';
    c.save(); c.scale(1, 0.55); c.fillStyle = '#241a12'; circle(c, 0, -50, 70); c.fill(); c.restore();
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) {
      const x = -88 + row * 16 + i * 35, y = -22 - row * 20;
      rrect(c, x, y, 38, 24, 11); fs(c, vg(c, y, y + 24, shade(bag, 0.2), shade(bag, -0.35)), 4);
      c.strokeStyle = 'rgba(60,40,10,.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 19, y + 3); c.lineTo(x + 19, y + 21); c.stroke();
    }
  },
  airdefense(c, lv) {
    groundShadow(c, 100, 25);
    const col = lv >= 5 ? '#6a7a8e' : '#a9b0bc';
    stoneBlock(c, -88, -34, 176, 36, '#8a8a9a');
    c.beginPath(); c.moveTo(-70, -32); c.lineTo(-46, -170); c.lineTo(46, -170); c.lineTo(70, -32); c.closePath();
    fs(c, hg(c, -70, 70, shade(col, 0.05), shade(col, -0.45), shade(col, 0.3)), 5);
    c.save(); c.clip();
    for (let i = -4; i < 6; i++) { c.fillStyle = i % 2 ? '#c8402f' : '#f2f2f2'; c.beginPath(); c.moveTo(-90 + i * 34, -32); c.lineTo(-70 + i * 34, -32); c.lineTo(-20 + i * 34, -170); c.lineTo(-40 + i * 34, -170); c.closePath(); c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1; }
    for (let y = -60; y > -170; y -= 30) for (let x = -50; x <= 50; x += 25) { ball(c, x, y, 2.5, '#e8eef5', 1); }
    c.restore();
    rrect(c, -58, -182, 116, 16, 6); fs(c, vg(c, -182, -166, '#e85a48', '#8a1a10'), 4);
  },
  wizardtower(c, lv) {
    groundShadow(c, 95, 24);
    stoneBlock(c, -84, -32, 168, 34, '#9a9aa8');
    cylinderF(c, 0, 118, -30, -196, lv >= 5 ? '#a492d4' : '#e0cc9a', { bricks: true });
    windowArch(c, -14, -160, 28, 40, true);
    doorArch(c, -22, -82, 44, 52, '#4a2a6a');
    rrect(c, -66, -204, 132, 14, 6); fs(c, vg(c, -204, -190, '#fff2a0', '#b88a10'), 4);
    coneRoof(c, 0, 150, -198, 104, '#6a2ec8', { knob: GOLD });
    for (const [x, y] of [[-26, -238], [20, -262], [4, -224]]) { c.fillStyle = '#fff6a0'; c.beginPath(); for (let k = 0; k < 5; k++) { const a = k * 1.2566 - 1.57; c.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); c.lineTo(x + Math.cos(a + .628) * 2.5, y + Math.sin(a + .628) * 2.5); } c.closePath(); c.fill(); }
  },
  xbow(c, lv) {
    groundShadow(c, 105, 26);
    stoneBlock(c, -96, -80, 192, 82, '#8a8a9a');
    battlements(c, -96, -80, 192, 6, '#9a9aaa', 18);
    rrect(c, -98, -84, 196, 10, 4); fs(c, vg(c, -84, -74, '#fff2a0', '#b88a10'), 3);
  },
  infernotower(c, lv) {
    groundShadow(c, 80, 20);
    stoneBlock(c, -72, -30, 144, 32, '#3a2a2a');
    c.beginPath(); c.moveTo(-60, -28); c.lineTo(-40, -170); c.lineTo(40, -170); c.lineTo(60, -28); c.closePath();
    fs(c, hg(c, -60, 60, '#5a4040', '#1e1414', '#7a5a5a'), 5);
    c.save(); c.clip(); bricks(c, -62, -170, 124, 142, 16, 30); c.restore();
    rrect(c, -50, -180, 100, 14, 5); fs(c, vg(c, -180, -166, '#ff9a3a', '#7a2a08'), 4);
    rrect(c, -36, -250, 72, 74, 22); fs(c, 'rgba(255,190,120,.25)', 5);
    rrect(c, -46, -262, 92, 16, 6); fs(c, vg(c, -262, -246, '#5a4040', '#1e1414'), 4);
    for (const x of [-38, 30]) { rrect(c, x, -252, 8, 76, 3); fs(c, '#3a2a2a', 3); }
  },
  eagleartillery(c, lv) {
    groundShadow(c, 125, 30);
    stoneBlock(c, -118, -100, 236, 102, '#a4a09a');
    battlements(c, -118, -100, 236, 7, '#b4b0aa', 20);
    rrect(c, -120, -104, 240, 10, 4); fs(c, vg(c, -104, -94, '#fff2a0', '#b88a10'), 3);
    doorArch(c, -30, -70, 60, 70, '#3a2410');
    emblem(c, -80, -56, 16, GOLD, symCrown); emblem(c, 80, -56, 16, GOLD, symCrown);
  },
  monolith(c, lv) {
    groundShadow(c, 75, 18);
    stoneBlock(c, -66, -28, 132, 30, '#2a2438');
    c.beginPath(); c.moveTo(-42, -26); c.lineTo(-30, -300); c.lineTo(30, -300); c.lineTo(42, -26); c.closePath();
    fs(c, hg(c, -42, 42, '#3e3656', '#120e1c', '#5a5276'), 5);
    c.beginPath(); c.moveTo(-34, -298); c.lineTo(0, -346); c.lineTo(34, -298); c.closePath(); fs(c, hg(c, -34, 34, '#4a4266', '#18142a', '#6a628a'), 5);
    shine(c, -24, -290, 6, 250, 0.12);
  },
  bossfortress(c, lv) {
    groundShadow(c, 128, 30);
    stoneBlock(c, -118, -44, 236, 46, '#2a2030');
    for (const x of [-94, 94]) { cylinderF(c, x, 54, -40, -200, '#4a4058', { bricks: true }); coneRoof(c, x, 66, -200, 70, '#8a1a2a', { knob: '#ff3a3a' }); }
    rrect(c, -80, -180, 160, 140, 10); fs(c, vg(c, -180, -40, '#4a4060', '#1a1424'), 5);
    clipRect(c, -80, -180, 160, 140, 10, () => bricks(c, -80, -180, 160, 140, 16, 34));
    battlements(c, -84, -180, 168, 5, '#3a3048', 20);
    c.beginPath(); c.moveTo(-34, -40); c.lineTo(-34, -94); c.arc(0, -94, 34, Math.PI, 0); c.lineTo(34, -40); c.closePath();
    fs(c, vg(c, -128, -40, '#ff8a6a', '#6a0a0a'), 5);
    c.strokeStyle = '#1a1010'; c.lineWidth = 4; for (const x of [-22, -8, 8, 22]) { c.beginPath(); c.moveTo(x, -126); c.lineTo(x, -40); c.stroke(); }
    emblem(c, 0, -152, 18, '#8a1a2a', symText('☠'));
  },
  hiddentrap(c, lv, fill, revealed) {
    if (!revealed) { c.save(); c.scale(1, 0.5); circle(c, 0, -10, 62); fs(c, vg(c, -70, 50, '#6a6a7a', '#3a3a48'), 5); c.restore(); for (const x of [-30, 0, 30]) { rrect(c, x - 4, -22, 8, 22, 3); fs(c, '#2a2a34', 0); } return; }
    groundShadow(c, 80, 20);
    stoneBlock(c, -66, -26, 132, 28, '#4a4a58');
    rrect(c, -18, -190, 36, 166, 8); fs(c, hg(c, -18, 18, '#8a8a9a', '#3a3a48', '#b8bcc8'), 5);
    for (const y of [-60, -95, -130, -165]) { c.beginPath(); c.ellipse(0, y, 42 - (y + 60) * -0.12, 9, 0, 0, 7); fs(c, vg(c, y - 9, y + 9, '#ffe27a', '#b8860b'), 4); }
    ball(c, 0, -212, 24, '#7fd4ff', 5);
  },
  bomb(c) { groundShadow(c, 40, 10); ball(c, 0, -30, 28, '#2a2a34', 5); rrect(c, 8, -66, 10, 12, 3); fs(c, '#8a8a9a', 3); c.strokeStyle = '#ffcf3a'; c.lineWidth = 4; c.beginPath(); c.moveTo(13, -66); c.quadraticCurveTo(26, -80, 18, -92); c.stroke(); },
  giantbomb(c) { groundShadow(c, 70, 16); ball(c, 0, -56, 54, '#2a2a34', 6); rrect(c, 18, -122, 18, 18, 4); fs(c, '#8a8a9a', 4); c.strokeStyle = '#ffcf3a'; c.lineWidth = 6; c.beginPath(); c.moveTo(27, -122); c.quadraticCurveTo(48, -146, 34, -160); c.stroke(); },
  springtrap(c) { groundShadow(c, 50, 12); for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(0, -10 - i * 12, 34, 9, 0, 0, 7); c.lineWidth = 6; c.strokeStyle = OL; c.stroke(); c.lineWidth = 3.5; c.strokeStyle = '#c8d0d8'; c.stroke(); } rrect(c, -44, -70, 88, 16, 5); fs(c, vg(c, -70, -54, '#c08a52', '#6a4220'), 4); },
  airbomb(c) { groundShadow(c, 40, 10); ball(c, 0, -46, 26, '#d0402f', 5); c.beginPath(); c.moveTo(-14, -24); c.lineTo(14, -24); c.lineTo(22, -2); c.lineTo(-22, -2); c.closePath(); fs(c, '#7a1a10', 4); },
  freezetrap(c) { groundShadow(c, 40, 10); crystal(c, 0, -46, 44, '#ffffff', '#bdf3ff', '#2a8ac0'); crystal(c, -24, -22, 22, '#ffffff', '#bdf3ff', '#2a8ac0'); crystal(c, 22, -24, 24, '#ffffff', '#bdf3ff', '#2a8ac0'); },
};
ART.kingaltar = ART.queenaltar = ART.wardenaltar = ART.championaltar = ART.altar;
function groundShadow2(c, x, y, rx, ry) { c.save(); c.translate(x, y); groundShadow(c, rx, ry); c.restore(); }
/* glass tank used by the elixir and dark elixir storages */
function tank(c, lv, fill, liquid, light, metal, sym, dark) {
  const f = (fill || 0) / 4, trim = lv >= 5 ? GOLD : metal;
  groundShadow(c, 105, 26);
  rrect(c, -92, -40, 184, 42, 14); fs(c, vg(c, -40, 2, shade(metal, 0.25), shade(metal, -0.4)), 5);
  for (let i = -3; i <= 3; i++) ball(c, i * 26, -20, 3.5, '#e8eef5', 1);
  // glass body
  const x0 = -70, y0 = -206, w = 140, h = 170;
  rrect(c, x0, y0, w, h, 46); fs(c, 'rgba(210,235,255,.28)', 0);
  if (f > 0) clipRect(c, x0, y0, w, h, 46, () => {
    const top = y0 + h - h * 0.92 * f;
    c.fillStyle = vg(c, top, y0 + h, light, shade(liquid, -0.35), liquid); c.fillRect(x0, top, w, h);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(0, top, w / 2, 8, 0, 0, 7); c.fill();
    for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(255,255,255,.35)'; circle(c, -40 + i * 20, top + 30 + (i % 3) * 30, 4 + (i % 2) * 2); c.fill(); }
  });
  rrect(c, x0, y0, w, h, 46);
  const gl = c.createLinearGradient(x0, 0, x0 + w, 0);
  gl.addColorStop(0, 'rgba(255,255,255,.05)'); gl.addColorStop(0.18, 'rgba(255,255,255,.5)'); gl.addColorStop(0.3, 'rgba(255,255,255,.06)'); gl.addColorStop(0.85, 'rgba(255,255,255,.04)'); gl.addColorStop(0.94, 'rgba(255,255,255,.28)'); gl.addColorStop(1, 'rgba(255,255,255,.05)');
  fs(c, gl, 6);
  for (const y of [-160, -100]) { rrect(c, x0 - 6, y, w + 12, 12, 5); fs(c, vg(c, y, y + 12, shade(trim, 0.4), shade(trim, -0.35)), 4); }
  rrect(c, -50, -224, 100, 26, 12); fs(c, vg(c, -224, -198, shade(metal, 0.35), shade(metal, -0.35)), 5);
  if (dark) for (const x of [-40, 0, 40]) { c.beginPath(); c.moveTo(x - 8, -224); c.lineTo(x, -248); c.lineTo(x + 8, -224); c.closePath(); fs(c, '#c8d0d8', 3); }
  else ball(c, 0, -234, 12, light, 4);
  emblem(c, 0, -62, 18, trim === GOLD ? GOLD : '#d8dee6', sym);
}

/* =====================================================================
   SPRITES - rendered once per (type, level, variant)
   ===================================================================== */
const SPR = new Map();
function spriteR() { return hiQ() ? 2 : 1; }
/* art scale: how many world px one art unit is, per footprint size */
function artK(s) { return s === 1 ? 0.34 : s * 64 * 0.8 / 220; }
function makeSprite(key, s, hmax, draw) {
  let sp = SPR.get(key);
  if (sp) return sp;
  const R = spriteR(), padX = 30, padT = 12, padB = 24;
  const wpx = 2 * s * HW + padX * 2, hpx = s * THT + hmax + padT + padB;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(wpx * R); cv.height = Math.ceil(hpx * R);
  const c = cv.getContext('2d');
  SPR_R = R;
  c.scale(R, R); c.translate(padX + s * HW, padT + hmax);
  draw(c);
  sp = { cv: cv, ax: padX + s * HW, ay: padT + hmax, R: R, w: wpx, h: hpx };
  SPR.set(key, sp);
  return sp;
}
/* stone pad under a building, keeps the grid readable */
function pad(c, s, col) {
  const m = 0.08;
  const pts = [Pt(m, m), Pt(s - m, m), Pt(s - m, s - m), Pt(m, s - m)];
  const g = c.createLinearGradient(0, pts[0][1], 0, pts[2][1]);
  g.addColorStop(0, shade(col, 0.18)); g.addColorStop(1, shade(col, -0.18));
  poly(c, pts, g, OL, 2);
  poly(c, [Pt(m + .12, m + .12), Pt(s - m - .12, m + .12), Pt(s - m - .12, s - m - .12), Pt(m + .12, s - m - .12)], null, 'rgba(255,255,255,.18)', 1.5);
}
const PADS = { goldmine: '#9a7a50', armycamp: null, builderhut: '#a89a7a', elixircollector: '#9a8aa8', darkdrill: '#4a4058', darkstorage: '#4a4058', darkbarracks: '#4a4058', monolith: '#3a3448', infernotower: '#4a3838', bossfortress: '#3a3040' };
function spriteFor(t, lv, fill, revealed) {
  const def = D.bdef(t), s = def.size;
  return makeSprite(t + ':' + lv + ':' + (fill || 0) + ':' + (revealed ? 1 : 0), s, 210, c => {
    const trap = def.cat === 'trap' || (t === 'hiddentrap' && !revealed);
    if (!trap && PADS[t] !== null) pad(c, s, PADS[t] || '#a8a49a');
    c.save(); c.translate(0, s * HH); const k = artK(s); c.scale(k, k);
    (ART[t] || ART.cannon)(c, lv, fill, revealed);
    c.restore();
  });
}
function wallSprite(lv, mask) {
  return makeSprite('wall:' + lv + ':' + mask, 2, 60, c => {
    const col = tier(lv, WALL_COLS);
    const o = { tex: lv <= 2 ? 'logs' : 'stone', seed: lv, ol: OL, lw: 1.6 };
    softShadow(c, [Pt(0.1, 0.1), Pt(0.9, 0.1), [Pt(0.9, 0.9)[0] + 10, Pt(0.9, 0.9)[1] + 4], [Pt(0.1, 0.9)[0] + 10, Pt(0.1, 0.9)[1] + 4]], 3, 0.3);
    if (lv <= 2) {
      if (mask & 2) { prism(c, 0.42, 0.6, 0.58, 1.4, 5, 9, col, o); prism(c, 0.42, 0.6, 0.58, 1.4, 14, 18, col, o); }
      if (mask & 1) { prism(c, 0.6, 0.42, 1.4, 0.58, 5, 9, col, o); prism(c, 0.6, 0.42, 1.4, 0.58, 14, 18, col, o); }
      prism(c, 0.3, 0.3, 0.7, 0.7, 0, 22, col, o);
      pyramid(c, 0.3, 0.3, 0.7, 0.7, 22, 8, shade(col, 0.1), { tiles: false });
      return;
    }
    const capCol = lv >= 5 ? GOLD : shade(col, 0.2);
    const cap = { ol: OL, lw: 1.6 };
    if (mask & 2) { prism(c, 0.26, 0.6, 0.74, 1.4, 0, 16, col, o); prism(c, 0.22, 0.6, 0.78, 1.4, 16, 20, capCol, cap); }
    if (mask & 1) { prism(c, 0.6, 0.26, 1.4, 0.74, 0, 16, col, o); prism(c, 0.6, 0.22, 1.4, 0.78, 16, 20, capCol, cap); }
    prism(c, 0.12, 0.12, 0.88, 0.88, 0, 22, col, o);
    prism(c, 0.08, 0.08, 0.92, 0.92, 22, 27, capCol, cap);
    if (lv >= 7) { const p = Pt(0.5, 0.5, 27); c.beginPath(); c.moveTo(p[0] - 5, p[1]); c.lineTo(p[0], p[1] - 14); c.lineTo(p[0] + 5, p[1]); c.closePath(); fs(c, '#e8eef5', 1.5); }
    if (lv >= 9) { line(c, Pt(0.12, 0.88, 11), Pt(0.88, 0.88, 11), '#c080ff', 2); line(c, Pt(0.88, 0.88, 11), Pt(0.88, 0.12, 11), '#a060e0', 2); }
  });
}
function rubbleSprite(s) {
  return makeSprite('rubble:' + s, s, 60, c => {
    c.save(); c.translate(0, s * HH); const k = artK(s); c.scale(k, k);
    c.save(); c.scale(1, 0.32);
    const g = c.createRadialGradient(0, 0, 10, 0, 0, 125);
    g.addColorStop(0, 'rgba(30,18,8,.6)'); g.addColorStop(0.7, 'rgba(50,34,18,.3)'); g.addColorStop(1, 'rgba(50,34,18,0)');
    c.fillStyle = g; circle(c, 0, 0, 125); c.fill(); c.restore();
    let seed = s * 97;
    const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    c.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const x = -70 + r() * 140, y = -14 + r() * 20, a = (r() - .5) * 1.6; c.save(); c.translate(x, y); c.rotate(a); rrect(c, -30, -6, 60, 12, 4); fs(c, vg(c, -6, 6, '#8a5a2b', '#3a2410'), 3); c.restore(); }
    for (let i = 0; i < 14; i++) {
      const x = -80 + r() * 160, y = -4 - r() * 26 + Math.abs(x) * 0.12, sz = 10 + r() * 14;
      const col = ['#9a9aa2', '#a89a88', '#7a7a82', '#b8aa98'][i % 4];
      c.beginPath(); c.moveTo(x - sz, y); c.lineTo(x - sz * .4, y - sz * .9); c.lineTo(x + sz * .7, y - sz * .7); c.lineTo(x + sz, y); c.closePath();
      fs(c, vg(c, y - sz, y, shade(col, 0.25), shade(col, -0.35)), 3);
    }
    c.restore();
  });
}
function blit(c, sp, wx, wy, alpha) {
  if (alpha != null) c.globalAlpha = alpha;
  c.drawImage(sp.cv, wx - sp.ax, wy - sp.ay, sp.w, sp.h);
  if (alpha != null) c.globalAlpha = 1;
}

/* =====================================================================
   LIVE PARTS - drawn every frame in the same art space
   ===================================================================== */
function aimVec(b) {
  const a = b.aim != null ? b.aim : (performance.now() / 4000 + (b.i || 0) * 1.3) % (Math.PI * 2);
  return [Math.cos(a), Math.sin(a)];
}
/* screen-space angle + foreshortening of a tile-space aim direction */
function aimScreen(b) {
  const [dx, dy] = aimVec(b);
  const sx = dx - dy, sy = (dx + dy) * 0.5;
  return { ang: Math.atan2(sy, sx), fore: 0.55 + 0.45 * Math.abs(sx) / (Math.hypot(sx, sy) || 1), sx: sx };
}
/* a chunky barrel pointing along `ang` from (px,py) */
function barrelF(c, px, py, ang, len, w, col, ringCol, recoil) {
  c.save(); c.translate(px, py); c.rotate(ang);
  const back = recoil ? recoil * 10 : 0;
  rrect(c, -16 - back, -w / 2, len, w, 10); fs(c, vg(c, -w / 2, w / 2, shade(col, 0.5), shade(col, -0.5), col), 6, '#182026');
  rrect(c, len - 30 - back, -w / 2 - 5, 20, w + 10, 6); fs(c, vg(c, -w / 2, w / 2, shade(ringCol, 0.4), shade(ringCol, -0.4)), 4);
  c.fillStyle = '#0a0a10'; c.beginPath(); c.ellipse(len - 16 - back, 0, 5, w * 0.32, 0, 0, 7); c.fill();
  shine(c, -6 - back, -w / 2 + 4, len - 36, 5, 0.25);
  c.restore();
}
function drawLive(c, b, t, ox, oy) {
  const s = b.s;
  const k = artK(s);
  c.save(); c.translate(ox, oy + s * HH); c.scale(k, k);
  switch (b.t) {
    case 'townhall': flagF(c, 0, -268 - (b.lv >= 7 ? 22 : 0) - 14, t, b.lv >= 10 ? '#c8402f' : GOLD, 1.4); if (b.lv >= 4) for (const x of [-92, 92]) flagF(c, x, -246, t + x, '#ffffff', 0.9); break;
    case 'barracks': flagF(c, 0, -194, t, GOLD, 1.2); break;
    case 'darkbarracks': glowAt(c, 0, -70, 60, '#c080ff', 0.35 + 0.15 * Math.sin(t * 3)); break;
    case 'builderhut': if (Math.random() < 0.04 && hiQ()) smokeAt(ox, oy + s * HH, k, 45, -175); break;
    case 'cannon': {
      const a = aimScreen(b);
      barrelF(c, 0, -100, a.ang, 95 * a.fore, 36, b.lv >= 7 ? '#8a96a6' : '#4a5661', b.lv >= 4 ? GOLD : '#d7a63a', b.recoil);
      ball(c, 0, -100, 15, '#3a424e', 5);
      if (b.recoil > 0.6) glowAt(c, Math.cos(a.ang) * 80 * a.fore, -100 + Math.sin(a.ang) * 80 * a.fore, 40, '#ffb040', b.recoil);
      break;
    }
    case 'xbow': {
      const a = aimScreen(b);
      c.save(); c.translate(0, -110); c.rotate(a.ang);
      rrect(c, -30, -10, 120 * a.fore, 20, 8); fs(c, vg(c, -10, 10, '#a06a3a', '#4a2a10'), 5);
      const bx = 40 * a.fore;
      c.strokeStyle = OL; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx - 10, -70); c.quadraticCurveTo(bx + 34, 0, bx - 10, 70); c.stroke();
      c.strokeStyle = '#7a4a1a'; c.lineWidth = 8; c.beginPath(); c.moveTo(bx - 10, -70); c.quadraticCurveTo(bx + 34, 0, bx - 10, 70); c.stroke();
      c.strokeStyle = '#f2f2f2'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(bx - 10, -70); c.lineTo(b.recoil > 0 ? bx - 6 : -20, 0); c.lineTo(bx - 10, 70); c.stroke();
      if (!(b.recoil > 0.3)) { rrect(c, -20, -4, 110 * a.fore, 8, 3); fs(c, vg(c, -4, 4, '#ffe27a', '#b8860b'), 2); }
      c.restore();
      ball(c, 0, -110, 14, '#5a5a6a', 5);
      break;
    }
    case 'eagleartillery': {
      const a = aimScreen(b);
      barrelF(c, 0, -150, a.ang, 140 * a.fore, 50, '#6a6a7a', GOLD, b.recoil);
      ball(c, 0, -150, 30, '#8a8a9a', 6);
      ball(c, -6, -190, 22, '#8a5a2b', 5);
      c.beginPath(); c.moveTo(10, -196); c.lineTo(34, -188); c.lineTo(10, -180); c.closePath(); fs(c, GOLD, 4);
      circle(c, 0, -196, 4); fs(c, '#1a1010', 0);
      if (b.recoil > 0.6) glowAt(c, Math.cos(a.ang) * 120 * a.fore, -150 + Math.sin(a.ang) * 120 * a.fore, 60, '#ffb040', b.recoil);
      break;
    }
    case 'bossfortress': {
      const a = aimScreen(b);
      barrelF(c, 0, -210, a.ang, 90 * a.fore, 34, '#3a1a24', '#ff3a3a', b.recoil);
      ball(c, 0, -210, 22, '#5a1a2a', 5);
      glowAt(c, 0, -90, 70, '#ff3a3a', 0.35 + 0.2 * Math.sin(t * 4));
      break;
    }
    case 'archertower': {
      const face = b.aim != null && Math.cos(b.aim) - Math.sin(b.aim) < 0 ? -1 : 1;
      drawUnitShape(c, 'archer', 0, -200, face, t * 0.3, b.recoil > 0 ? 1 : 0, 1.0 / k);
      break;
    }
    case 'mortar': {
      const a = aimScreen(b);
      const tilt = clamp(a.sx * 0.35, -0.5, 0.5);
      c.save(); c.translate(0, -60); c.rotate(-Math.PI / 2 + tilt);
      const r = b.recoil > 0 ? b.recoil * 8 : 0;
      rrect(c, -10 - r, -26, 76, 52, 18); fs(c, vg(c, -26, 26, '#7a8492', '#1e242c', '#3a424e'), 6);
      rrect(c, 46 - r, -31, 22, 62, 8); fs(c, vg(c, -31, 31, '#ffe27a', '#8a5a05'), 4);
      c.fillStyle = '#0a0a10'; c.beginPath(); c.ellipse(64 - r, 0, 8, 18, 0, 0, 7); c.fill();
      c.restore();
      ball(c, 0, -52, 18, '#4a5260', 5);
      break;
    }
    case 'airdefense': {
      const a = aimScreen(b);
      c.save(); c.translate(0, -196);
      rrect(c, -44, -16, 88, 32, 10); fs(c, vg(c, -16, 16, '#9aa6b4', '#3a424e'), 5);
      for (const yy of [-30, 0]) for (const xx of [-24, 24]) {
        c.save(); c.translate(xx * Math.cos(a.ang * 0.3), yy); c.rotate(-0.5 + a.sx * 0.15);
        rrect(c, -10, -34, 20, 46, 9); fs(c, vg(c, -34, 12, '#f2f2f2', '#9aa3ad'), 4);
        c.beginPath(); c.moveTo(-10, -30); c.quadraticCurveTo(0, -52, 10, -30); c.closePath(); fs(c, '#d0402f', 4);
        c.restore();
      }
      c.restore();
      break;
    }
    case 'wizardtower': { const y = -330 + Math.sin(t * 2 + b.i) * 8; glowAt(c, 0, y, 50, '#c24bff', 0.75); ball(c, 0, y, 14, '#e080ff', 4); break; }
    case 'spellfactory': {
      const y = -300 + Math.sin(t * 2) * 10;
      glowAt(c, 0, y, 70, '#c24bff', 0.8); ball(c, 0, y, 22, '#d070ff', 5);
      for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.57; ball(c, Math.cos(a) * 40, y + Math.sin(a) * 12, 4, '#ffffff', 0); }
      break;
    }
    case 'infernotower': { glowAt(c, 0, -214, 80, '#ff7a1a', 0.7 + Math.sin(t * 9) * 0.1); fire(c, 0, -180, t, 2.4); break; }
    case 'monolith': {
      for (const y of [-80, -130, -180, -230]) { const a = 0.5 + 0.5 * Math.sin(t * 2.5 + y); glowAt(c, 0, y, 24, '#7fd4ff', a); rrect(c, -8, y - 10, 16, 20, 4); fs(c, 'rgba(160,230,255,' + (0.4 + a * 0.6) + ')', 0); }
      glowAt(c, 0, -346, 50, '#7fd4ff', 0.5 + 0.3 * Math.sin(t * 2));
      break;
    }
    case 'elixircollector': {
      glowAt(c, 0, -134, 70, '#e055ff', 0.25 + 0.1 * Math.sin(t * 3 + b.i));
      for (let i = 0; i < 4; i++) { const p = (t * 0.6 + i / 4) % 1; circle(c, -18 + i * 12, -104 - p * 50, 3 + p * 3); c.fillStyle = 'rgba(255,230,255,' + (0.75 * (1 - p)) + ')'; c.fill(); }
      break;
    }
    case 'darkdrill': glowAt(c, 0, -200, 60, '#a080ff', 0.35 + 0.15 * Math.sin(t * 3)); break;
    case 'goldmine': {
      for (const [x, y] of [[-62, -47], [65, -57], [5, -143]]) { const a = Math.sin(t * 3 + x); if (a > 0.85) glowAt(c, x, y, 24, '#fff6a0', (a - 0.85) * 6); }
      break;
    }
    case 'armycamp': { glowAt(c, 0, -40, 90, '#ff8a2a', 0.45 + 0.1 * Math.sin(t * 11)); fire(c, 0, -22, t, 1.8); flagF(c, 92, -100, t, GOLD, 0.9); break; }
    case 'blacksmith': { glowAt(c, -15, -60, 70, '#ff7a1a', 0.45 + 0.15 * Math.sin(t * 7)); if (Math.random() < 0.05 && hiQ()) smokeAt(ox, oy + s * HH, k, 52, -220); break; }
    case 'kingaltar': case 'queenaltar': case 'wardenaltar': case 'championaltar': {
      for (const x of [-60, -20, 20, 60]) glowAt(c, x, -16, 18, '#7fd4ff', 0.5 + 0.5 * Math.sin(t * 2 + x));
      if (b.hero) { glowAt(c, 0, -110, 80, (LOOK[b.hero] || {}).body || GOLD, 0.25); drawUnitShape(c, b.hero, 0, -58, 1, t * 0.25, 0, 1.4 / k); }
      break;
    }
    case 'hiddentrap': {
      if (b.revealed) { glowAt(c, 0, -212, 50, '#7fd4ff', 0.5 + 0.2 * Math.sin(t * 5)); if (b.zap > 0) { c.strokeStyle = '#e8fbff'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, -212); for (let i = 0; i < 4; i++) c.lineTo(rand(-60, 60), -212 + rand(-40, 60)); c.stroke(); } }
      break;
    }
  }
  c.restore();
}
function smokeAt(wx, wy, k, ax, ay) { part({ x: wx + ax * k, y: wy + ay * k, z: 0, vz: 16, vx: rand(4, 12), life: 2.6, max: 2.6, size: 5, col: '#c8c8c8', kind: 'smoke', drag: 1 }); }
/* waving flag in art space (big units) */
function flagF(c, x, y, t, col, sc) {
  c.save(); c.translate(x, y); c.scale(sc, sc);
  rrect(c, -3, -60, 6, 62, 3); fs(c, '#5a3a20', 3);
  ball(c, 0, -63, 5, GOLD, 2);
  c.beginPath(); c.moveTo(3, -58);
  for (let i = 1; i <= 8; i++) { const u = i / 8; c.lineTo(3 + 46 * u, -58 + Math.sin(t * 6 - u * 4 + x) * 5 * u); }
  for (let i = 8; i >= 0; i--) { const u = i / 8; c.lineTo(3 + 46 * u, -30 + Math.sin(t * 6 - u * 4 + x) * 5 * u + u * 3); }
  c.closePath();
  fs(c, hg(c, 3, 50, shade(col, -0.15), shade(col, -0.25), shade(col, 0.25)), 3);
  c.restore();
}
function flag(c, x, y, t, col, sc) { c.save(); c.translate(x, y); c.scale((sc || 1) * 0.4, (sc || 1) * 0.4); flagF(c, 0, 0, t, col, 1); c.restore(); }
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
