'use strict';
/* =====================================================================
   GREJS BASE BUILDER - art-units.js
   Troops, heroes, portraits, spell/equipment icons and avatars.
   Units are drawn live every frame (chibi style, outlined, shaded).
   ===================================================================== */

const UO = 'rgba(25,12,4,.85)';   // unit outline
const LOOK = {
  grejswarrior: { sz: 1, body: '#8a5a2b', skin: '#f2c08a', hair: '#ffd23f', hat: 'hair', wpn: 'sword', stache: true, pants: '#5a3a1a', belt: '#3a2410' },
  archer: { sz: 0.95, body: '#e04fa8', skin: '#f2c08a', hair: '#e04fa8', hat: 'hood', wpn: 'bow', pants: '#6a2a5a', hairCol: '#ff7ac0' },
  giant: { sz: 1.7, body: '#d98c4a', skin: '#f2b07a', hair: '#8a5a2b', hat: 'bald', wpn: 'fist', pants: '#6a4a2a', belt: '#3a2410' },
  goblin: { sz: 0.82, body: '#7a5a2a', skin: '#6bd14b', hat: 'ears', wpn: 'sack', pants: '#4a3a1a' },
  wallbreaker: { sz: 0.85, body: '#e8eef5', skin: '#e8eef5', hat: 'skull', wpn: 'bomb', pants: '#c8d0d8' },
  wizard: { sz: 1.05, body: '#4f7bff', skin: '#f2c08a', hat: 'wizard', hatCol: '#2a4ab0', wpn: 'staff', robe: true, belt: '#ffd23f' },
  heavyknight: { sz: 1.55, body: '#5d6d8a', skin: '#5d6d8a', hat: 'horns', wpn: 'greatsword', armor: true, pants: '#3a4a6a' },
  darkknight: { sz: 1.35, body: '#3c2f5c', skin: '#f2c08a', hair: '#ff6a3a', hat: 'hair', wpn: 'axe', armor: true, pants: '#2a2040' },
  golemite: { sz: 0.9, special: 'golem' },
  golem: { sz: 1.9, special: 'golem' },
  shadowrider: { sz: 1.1, special: 'rider', body: '#6b3fa0', mount: '#2b2440' },
  hograider: { sz: 1.15, special: 'rider', body: '#b5651d', mount: '#e8a090' },
  balloon: { sz: 1.2, special: 'balloon' },
  healer: { sz: 1.1, special: 'healer' },
  dragon: { sz: 1.6, special: 'dragon' },
  batswarm: { sz: 0.9, special: 'bats' },
  grejskongen: { sz: 1.55, body: '#7a2a8a', skin: '#f2c08a', hair: '#ffd23f', hat: 'crown', wpn: 'sword', stache: true, cape: '#c8402f', pants: '#4a1a5a', belt: '#ffd23f', armor: true },
  skyttedronningen: { sz: 1.4, body: '#ff5fb0', skin: '#f2c08a', hair: '#8a2a5a', hat: 'crown', wpn: 'bow', cape: '#7a1a4a', pants: '#5a1a3a', hairCol: '#a03a7a' },
  denstorevagt: { sz: 1.45, body: '#7ad7ff', skin: '#f2c08a', hair: '#ffffff', hat: 'wizard', hatCol: '#2a8ac0', wpn: 'staff', beard: true, robe: true, belt: '#ffd23f' },
  denkongeligekriger: { sz: 1.5, body: '#ff7a3a', skin: '#f2c08a', hair: '#3a2410', hat: 'helmet', wpn: 'spear', armor: true, cape: '#8a2a0a', pants: '#5a2a0a', belt: '#ffd23f' },
};
function unitShadow(c, rx, ry) {
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(0,0,0,.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.save(); c.scale(1, ry / rx); c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fill(); c.restore();
}
function ell(c, x, y, rx, ry, fill, lw) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fillStyle = fill; c.fill();
  if (lw !== 0) { c.strokeStyle = UO; c.lineWidth = lw || 1.1; c.stroke(); }
}
function drawUnitShape(c, id, x, y, face, t, atk, scale, flash) {
  const L = LOOK[id] || LOOK.grejswarrior;
  const k = (scale || 1) * L.sz;
  c.save();
  c.translate(x, y);
  if (face < 0) c.scale(-1, 1);
  if (L.special) { special(c, L, k, t, atk); if (flash) flashOver(c, k); c.restore(); return; }
  unitShadow(c, 9 * k, 4 * k);
  const walk = t * 10 + x * 0.13;
  const bob = Math.abs(Math.sin(walk)) * 1.6 * k;
  const st = Math.sin(walk);
  c.translate(0, -bob);
  const lunge = atk ? 3 * k : 0;
  const lw = Math.max(0.8, 1.1 * Math.min(1.4, k));
  // cape behind
  if (L.cape) {
    const g = c.createLinearGradient(-8 * k, -18 * k, 4 * k, 0); g.addColorStop(0, shade(L.cape, 0.2)); g.addColorStop(1, shade(L.cape, -0.35));
    c.fillStyle = g; c.beginPath(); c.moveTo(-3 * k, -17 * k); c.quadraticCurveTo(-12 * k, -6 * k + st * k, -9 * k, -1 * k); c.lineTo(3 * k, -3 * k); c.closePath(); c.fill(); c.strokeStyle = UO; c.lineWidth = lw; c.stroke();
  }
  // back arm
  c.save(); c.translate(-4 * k, -13 * k); c.rotate(0.4 + st * 0.5);
  c.fillStyle = shade(L.body, -0.25); c.beginPath(); c.ellipse(0, 3 * k, 2 * k, 4 * k, 0, 0, 7); c.fill(); c.strokeStyle = UO; c.lineWidth = lw; c.stroke();
  ell(c, 0, 7 * k, 1.8 * k, 1.8 * k, L.skin, lw);
  c.restore();
  // legs + boots
  const legCol = L.pants || shade(L.body, -0.4);
  for (const side of [-1, 1]) {
    const sw = st * side * 2.2 * k;
    c.fillStyle = legCol; c.beginPath(); c.roundRect ? c.roundRect(side * 2.6 * k - 1.6 * k + sw * .4, -7 * k, 3.2 * k, 6 * k, 1 * k) : c.rect(side * 2.6 * k - 1.6 * k + sw * .4, -7 * k, 3.2 * k, 6 * k);
    c.fill(); c.strokeStyle = UO; c.lineWidth = lw; c.stroke();
    ell(c, side * 2.6 * k + sw * .4 + 0.8 * k, -0.6 * k, 2.4 * k, 1.5 * k, '#3a2410', lw);
  }
  // body
  const g = c.createLinearGradient(-7 * k, -18 * k, 6 * k, -4 * k);
  g.addColorStop(0, shade(L.body, 0.3)); g.addColorStop(0.55, L.body); g.addColorStop(1, shade(L.body, -0.3));
  c.fillStyle = g; c.strokeStyle = UO; c.lineWidth = lw;
  c.beginPath();
  if (L.robe) { c.moveTo(-5 * k + lunge * .3, -17 * k); c.lineTo(5 * k + lunge * .3, -17 * k); c.lineTo(7 * k, -2 * k); c.quadraticCurveTo(0, 0, -7 * k, -2 * k); c.closePath(); }
  else c.ellipse(lunge * .3, -10.5 * k, 6.2 * k, 6.8 * k, 0, 0, 7);
  c.fill(); c.stroke();
  if (L.armor) { c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.ellipse(lunge * .3 - 1.5 * k, -13 * k, 3 * k, 2 * k, -0.4, 0, 7); c.fill(); }
  if (L.belt) { c.fillStyle = L.belt; c.fillRect(-6 * k + lunge * .3, -8.5 * k, 12 * k, 1.8 * k); c.fillStyle = '#ffd23f'; c.fillRect(-1 * k + lunge * .3, -8.8 * k, 2.2 * k, 2.4 * k); }
  // head
  const hx = lunge * .45, hy = -21 * k;
  const hg = c.createRadialGradient(hx - 2 * k, hy - 2.5 * k, 0.5 * k, hx, hy, 6.2 * k);
  hg.addColorStop(0, shade(L.skin, 0.25)); hg.addColorStop(1, shade(L.skin, -0.18));
  c.fillStyle = hg; c.beginPath(); c.arc(hx, hy, 5.8 * k, 0, 7); c.fill(); c.strokeStyle = UO; c.lineWidth = lw; c.stroke();
  if (L.hat !== 'skull' && L.hat !== 'horns') {
    ell(c, hx + 2.6 * k, hy - 0.6 * k, 1.5 * k, 1.8 * k, '#fff', 0.6);
    ell(c, hx + 0.2 * k, hy - 0.6 * k, 1.3 * k, 1.7 * k, '#fff', 0.6);
    c.fillStyle = '#1a1010'; c.beginPath(); c.arc(hx + 2.9 * k, hy - 0.4 * k, 0.8 * k, 0, 7); c.arc(hx + 0.5 * k, hy - 0.4 * k, 0.75 * k, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,110,110,.35)'; c.beginPath(); c.arc(hx + 3.6 * k, hy + 2 * k, 1.2 * k, 0, 7); c.fill();
  } else if (L.hat === 'skull') {
    c.fillStyle = '#1a1010'; c.beginPath(); c.arc(hx + 2.4 * k, hy - 0.5 * k, 1.3 * k, 0, 7); c.arc(hx - 0.2 * k, hy - 0.5 * k, 1.2 * k, 0, 7); c.fill();
    c.fillRect(hx + 0.4 * k, hy + 2.2 * k, 2.6 * k, 0.8 * k);
  }
  if (L.stache) { c.fillStyle = L.hair || '#3a2410'; c.beginPath(); c.ellipse(hx + 1.6 * k, hy + 2.2 * k, 3.2 * k, 1.1 * k, 0, 0, 7); c.fill(); }
  if (L.beard) { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(hx - 3.5 * k, hy + 1 * k); c.lineTo(hx + 5 * k, hy + 1 * k); c.quadraticCurveTo(hx + 2 * k, hy + 12 * k, hx + 0.5 * k, hy + 10 * k); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.stroke(); }
  hat(c, L, k, hx, hy, lw);
  weapon(c, L, k, lunge, t, atk, lw);
  if (flash) flashOver(c, k);
  c.restore();
}
/* hit flash: a short white glow over the unit (no compositing tricks that leak onto the ground) */
function flashOver(c, k) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55; c.drawImage(glowSprite('#ffffff'), -11 * k, -32 * k, 22 * k, 30 * k); c.restore(); }
function hat(c, L, k, x, y, lw) {
  c.strokeStyle = UO; c.lineWidth = lw || 1;
  switch (L.hat) {
    case 'hair':
      c.fillStyle = L.hair; c.beginPath(); c.arc(x, y - 1.2 * k, 6 * k, Math.PI * 1.02, Math.PI * 1.98); c.quadraticCurveTo(x + 4 * k, y - 4 * k, x - 6 * k, y - 0.5 * k); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x - 6 * k, y - 1 * k); c.quadraticCurveTo(x - 9 * k, y + 4 * k, x - 5 * k, y + 5 * k); c.lineTo(x - 4 * k, y); c.fill(); break;
    case 'hood': c.fillStyle = L.hair; c.beginPath(); c.moveTo(x - 6.5 * k, y + 3 * k); c.quadraticCurveTo(x - 4 * k, y - 11 * k, x + 4 * k, y - 8 * k); c.quadraticCurveTo(x + 7 * k, y - 4 * k, x + 6.5 * k, y - 1 * k); c.lineTo(x + 4 * k, y - 3 * k); c.lineTo(x - 3 * k, y - 3 * k); c.lineTo(x - 3.5 * k, y + 3 * k); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = L.hairCol || shade(L.hair, 0.3); c.fillRect(x - 3 * k, y - 4 * k, 6.5 * k, 1.4 * k); break;
    case 'wizard': c.fillStyle = L.hatCol; c.beginPath(); c.ellipse(x, y - 3 * k, 8.5 * k, 2.4 * k, 0, 0, 7); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x - 5 * k, y - 4 * k); c.lineTo(x + 5 * k, y - 4 * k); c.quadraticCurveTo(x + 1 * k, y - 12 * k, x - 4 * k, y - 18 * k); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(x - 0.5 * k, y - 8 * k, 1.2 * k, 0, 7); c.fill(); break;
    case 'crown': c.fillStyle = L.hair; c.beginPath(); c.arc(x, y - 1 * k, 6 * k, Math.PI, 0); c.fill(); c.stroke();
      { const g = c.createLinearGradient(x, y - 12 * k, x, y - 4 * k); g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#d09a10'); c.fillStyle = g; }
      c.beginPath(); c.moveTo(x - 5.5 * k, y - 4.5 * k); c.lineTo(x - 5.5 * k, y - 11 * k); c.lineTo(x - 2.8 * k, y - 7.5 * k); c.lineTo(x, y - 12.5 * k); c.lineTo(x + 2.8 * k, y - 7.5 * k); c.lineTo(x + 5.5 * k, y - 11 * k); c.lineTo(x + 5.5 * k, y - 4.5 * k); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ff3a5a'; c.beginPath(); c.arc(x, y - 6.5 * k, 1.2 * k, 0, 7); c.fill(); break;
    case 'helmet': { const g = c.createLinearGradient(x - 6 * k, y - 8 * k, x + 6 * k, y); g.addColorStop(0, '#f2f6fa'); g.addColorStop(1, '#8a96a6'); c.fillStyle = g; }
      c.beginPath(); c.arc(x, y - 0.5 * k, 6.4 * k, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(x + 6 * k, y + 1 * k); c.lineTo(x - 6 * k, y + 1 * k); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ff3a3a'; c.beginPath(); c.moveTo(x - 1 * k, y - 6.5 * k); c.quadraticCurveTo(x - 6 * k, y - 13 * k, x - 9 * k, y - 8 * k); c.quadraticCurveTo(x - 5 * k, y - 9 * k, x + 1 * k, y - 5 * k); c.fill(); break;
    case 'horns': { const g = c.createLinearGradient(x - 6 * k, y - 6 * k, x + 6 * k, y + 6 * k); g.addColorStop(0, '#7a8aaa'); g.addColorStop(1, '#2a3a5a'); c.fillStyle = g; }
      c.beginPath(); c.arc(x, y, 6.2 * k, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#e8eef5';
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(x + sd * 5 * k, y - 3 * k); c.quadraticCurveTo(x + sd * 11 * k, y - 6 * k, x + sd * 9 * k, y - 13 * k); c.quadraticCurveTo(x + sd * 8 * k, y - 7 * k, x + sd * 3 * k, y - 5 * k); c.closePath(); c.fill(); c.stroke(); }
      c.save(); c.shadowColor = '#7fd4ff'; c.shadowBlur = 4; c.fillStyle = '#7fd4ff'; c.fillRect(x - 1 * k, y - 1 * k, 5.5 * k, 1.6 * k); c.restore(); break;
    case 'ears': c.fillStyle = L.skin;
      for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(x + sd * 4.5 * k, y - 1 * k); c.lineTo(x + sd * 11 * k, y - 5 * k); c.lineTo(x + sd * 4.5 * k, y - 4.5 * k); c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = '#2a1a0a'; c.beginPath(); c.arc(x, y - 3 * k, 5 * k, Math.PI * 1.15, Math.PI * 1.85); c.fill(); break;
    case 'bald': c.fillStyle = L.hair; c.beginPath(); c.ellipse(x - 4.5 * k, y + 0.5 * k, 1.5 * k, 3 * k, 0, 0, 7); c.fill(); break;
  }
}
function weapon(c, L, k, lunge, t, atk, lw) {
  const sw = atk ? -1.0 : 0.25 + Math.sin(t * 10) * 0.08;
  c.save(); c.translate(4.5 * k + lunge, -12 * k); c.rotate(sw);
  c.strokeStyle = UO; c.lineWidth = lw || 1;
  const metal = (x, y, w, h) => { const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c8d0d8'); g.addColorStop(1, '#7a8696'); c.fillStyle = g; c.fillRect(x, y, w, h); c.strokeRect(x, y, w, h); };
  switch (L.wpn) {
    case 'sword': metal(-0.2 * k, -14 * k, 2.6 * k, 13 * k); c.fillStyle = '#c8962a'; c.fillRect(-2.5 * k, -1.5 * k, 7 * k, 2 * k); c.strokeRect(-2.5 * k, -1.5 * k, 7 * k, 2 * k); c.fillStyle = '#5a3a20'; c.fillRect(0, 0.5, 2 * k, 3 * k); break;
    case 'greatsword': metal(-0.5 * k, -22 * k, 3.6 * k, 21 * k); c.fillStyle = '#3a4a6a'; c.fillRect(-3 * k, -1.5 * k, 8.5 * k, 2.2 * k); break;
    case 'axe': c.fillStyle = '#8a5a2b'; c.fillRect(0, -15 * k, 2.2 * k, 17 * k); c.strokeRect(0, -15 * k, 2.2 * k, 17 * k);
      { const g = c.createLinearGradient(1 * k, -15 * k, 12 * k, -5 * k); g.addColorStop(0, '#f2f6fa'); g.addColorStop(1, '#7a8696'); c.fillStyle = g; }
      c.beginPath(); c.moveTo(1 * k, -15 * k); c.quadraticCurveTo(14 * k, -12 * k, 1 * k, -4 * k); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(1 * k, -15 * k); c.quadraticCurveTo(-11 * k, -12 * k, 1 * k, -4 * k); c.closePath(); c.fill(); c.stroke(); break;
    case 'bow': c.rotate(-sw * 0.5); c.strokeStyle = '#6a3a1a'; c.lineWidth = 2.4 * k; c.beginPath(); c.arc(0, 0, 7.5 * k, -1.25, 1.25); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(Math.cos(-1.25) * 7.5 * k, Math.sin(-1.25) * 7.5 * k); c.lineTo(atk ? -4 * k : -0.5 * k, 0); c.lineTo(Math.cos(1.25) * 7.5 * k, Math.sin(1.25) * 7.5 * k); c.stroke();
      if (!atk) { c.strokeStyle = '#f7e6c4'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-1 * k, 0); c.lineTo(9 * k, 0); c.stroke(); } break;
    case 'staff': c.fillStyle = '#7a4a1a'; c.fillRect(0, -17 * k, 2.2 * k, 24 * k); c.strokeRect(0, -17 * k, 2.2 * k, 24 * k);
      { const gc = L.body === '#7ad7ff' ? '#7ad7ff' : '#ff8a2a'; c.save(); c.shadowColor = gc; c.shadowBlur = atk ? 14 : 6; sphere(c, 1.1 * k, -19 * k, 3.4 * k, gc); c.restore(); } break;
    case 'spear': c.fillStyle = '#7a4a1a'; c.fillRect(0, -22 * k, 2 * k, 30 * k); c.strokeRect(0, -22 * k, 2 * k, 30 * k);
      { const g = c.createLinearGradient(-2 * k, 0, 4 * k, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, '#8a96a6'); c.fillStyle = g; }
      c.beginPath(); c.moveTo(-2 * k, -22 * k); c.lineTo(1 * k, -30 * k); c.lineTo(4 * k, -22 * k); c.closePath(); c.fill(); c.stroke();
      c.rotate(-sw); c.fillStyle = '#c8402f'; c.beginPath(); c.ellipse(-8 * k, 4 * k, 4 * k, 6 * k, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(-8 * k, 4 * k, 1.5 * k, 0, 7); c.fill(); break;
    case 'fist': ell(c, 1 * k, -1 * k, 3.6 * k, 3.6 * k, '#f2b07a'); break;
    case 'sack': c.rotate(-sw); ell(c, -10 * k, 4 * k, 4.6 * k, 4 * k, '#c8a060'); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(-10 * k, 0.5 * k, 1.5 * k, 0, 7); c.fill(); break;
    case 'bomb': c.rotate(-sw); sphere(c, 0, -2 * k, 4.8 * k, '#2a2a34'); c.fillStyle = '#ffcf3a'; c.fillRect(1 * k, -9.5 * k, 1.5 * k, 3 * k); glowAt(c, 1.8 * k, -10 * k, 4 * k, '#ff8a2a', 0.6 + 0.4 * Math.sin(t * 20)); break;
  }
  c.restore();
}
function special(c, L, k, t, atk) {
  const bob = Math.sin(t * 4) * 2;
  if (L.special === 'golem') {
    unitShadow(c, 13 * k, 5.5 * k);
    const step = Math.sin(t * 6) * 1.5 * k;
    sphere(c, -5 * k, -4 * k + step, 4 * k, '#7a8a6a'); sphere(c, 5 * k, -4 * k - step, 4 * k, '#7a8a6a');
    sphere(c, 0, -13 * k, 10 * k, '#8a9a7a');
    sphere(c, -9 * k, -12 * k, 4.5 * k, '#7a8a6a'); sphere(c, 10 * k + (atk ? 3 * k : 0), -12 * k, 5 * k, '#7a8a6a');
    c.strokeStyle = 'rgba(40,50,30,.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4 * k, -20 * k); c.lineTo(-1 * k, -15 * k); c.lineTo(-3 * k, -9 * k); c.stroke();
    glowAt(c, 2 * k, -16 * k, 3.2 * k, '#c6ff3a', 0.9); glowAt(c, -3 * k, -16 * k, 3.2 * k, '#c6ff3a', 0.9);
  } else if (L.special === 'rider') {
    unitShadow(c, 12 * k, 4.5 * k);
    const leg = Math.sin(t * 14) * 2.2 * k;
    c.fillStyle = shade(L.mount, -0.35); c.strokeStyle = UO; c.lineWidth = 1;
    for (const [lx, d] of [[-7, 1], [-4, -1], [4, 1], [7, -1]]) { c.fillRect(lx * k - 1.2 * k, -6 * k + leg * d, 2.4 * k, 6 * k); }
    sphere(c, 0, -9 * k, 8.5 * k, L.mount); sphere(c, 9 * k, -12 * k, 5 * k, L.mount);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(11 * k, -13.5 * k, 1.2 * k, 0, 7); c.fill();
    if (L.mount === '#e8a090') { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(12 * k, -10 * k); c.lineTo(16 * k, -12 * k); c.lineTo(13 * k, -9 * k); c.fill(); }
    const bg = c.createLinearGradient(-5 * k, -24 * k, 4 * k, -12 * k); bg.addColorStop(0, shade(L.body, 0.3)); bg.addColorStop(1, shade(L.body, -0.3));
    c.fillStyle = bg; c.beginPath(); c.ellipse(-1 * k, -19 * k, 4.4 * k, 5.6 * k, 0, 0, 7); c.fill(); c.strokeStyle = UO; c.stroke();
    ell(c, 0, -27 * k, 4 * k, 4 * k, '#f2c08a');
    c.fillStyle = '#1a1010'; c.beginPath(); c.arc(1.6 * k, -27.5 * k, 0.8 * k, 0, 7); c.fill();
    c.strokeStyle = '#c8d0d8'; c.lineWidth = 2.2 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(3 * k, -20 * k); c.lineTo(11 * k + (atk ? 4 * k : 0), -25 * k + (atk ? 7 * k : 0)); c.stroke();
  } else if (L.special === 'balloon') {
    unitShadow(c, 10 * k, 4 * k);
    c.translate(0, -50 + bob);
    const g = c.createRadialGradient(-5 * k, -20 * k, 2, 0, -14 * k, 14 * k);
    g.addColorStop(0, '#ff8a7a'); g.addColorStop(0.6, '#c8302b'); g.addColorStop(1, '#6a1010');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, -14 * k, 12 * k, 13 * k, 0, 0, 7); c.fill(); c.strokeStyle = UO; c.lineWidth = 1.2; c.stroke();
    for (const a of [-0.5, 0, 0.5]) { c.beginPath(); c.ellipse(0, -14 * k, 12 * k * Math.abs(Math.cos(a + 1.57)) + 0.5, 13 * k, 0, -1.57, 1.57); c.strokeStyle = 'rgba(0,0,0,.2)'; c.stroke(); }
    c.fillStyle = '#ffd23f'; c.fillRect(-12 * k, -15 * k, 24 * k, 2 * k);
    c.strokeStyle = '#3a2410'; c.lineWidth = 1; c.beginPath(); c.moveTo(-8 * k, -4 * k); c.lineTo(-4 * k, 4 * k); c.moveTo(8 * k, -4 * k); c.lineTo(4 * k, 4 * k); c.stroke();
    prismLite(c, -5.5 * k, 3 * k, 11 * k, 6 * k, '#8a5a2b');
    ell(c, 0, 1.5 * k, 2.5 * k, 2.5 * k, '#e8eef5', 0.8);
    if (atk) sphere(c, 0, 14 * k, 3.5 * k, '#2a2a34');
  } else if (L.special === 'healer') {
    unitShadow(c, 9 * k, 3.5 * k);
    c.translate(0, -38 + bob);
    glowAt(c, 0, -10 * k, 20 * k, '#fff6c0', 0.35);
    const fl = Math.sin(t * 10) * 5;
    c.fillStyle = 'rgba(255,255,255,.95)'; c.strokeStyle = 'rgba(120,120,160,.5)'; c.lineWidth = 1;
    for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * 9 * k, -11 * k - fl, 9 * k, 4.5 * k, sd * 0.5, 0, 7); c.fill(); c.stroke(); }
    const g = c.createLinearGradient(-5 * k, -14 * k, 5 * k, 2 * k); g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#e8c870');
    c.fillStyle = g; c.beginPath(); c.moveTo(-5 * k, -12 * k); c.lineTo(5 * k, -12 * k); c.lineTo(7 * k, 2 * k); c.lineTo(-7 * k, 2 * k); c.closePath(); c.fill(); c.strokeStyle = UO; c.stroke();
    ell(c, 0, -17 * k, 4.4 * k, 4.4 * k, '#f2c08a');
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0, -19 * k, 4.6 * k, Math.PI, 0); c.fill();
    c.strokeStyle = '#ffd23f'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, -24 * k, 4.5 * k, 1.5 * k, 0, 0, 7); c.stroke();
  } else if (L.special === 'dragon') {
    unitShadow(c, 18 * k, 6 * k);
    c.translate(0, -44 + bob);
    const fl = Math.sin(t * 6) * 7;
    const wing = (sd) => {
      const g = c.createLinearGradient(0, -6 * k, sd * 18 * k, -20 * k); g.addColorStop(0, '#2f8f5f'); g.addColorStop(1, '#5fdf9f');
      c.fillStyle = g; c.beginPath(); c.moveTo(sd * 2 * k, -6 * k); c.quadraticCurveTo(sd * 10 * k, -26 * k - fl, sd * 20 * k, -20 * k - fl); c.quadraticCurveTo(sd * 14 * k, -12 * k, sd * 6 * k, 0); c.closePath(); c.fill(); c.strokeStyle = UO; c.lineWidth = 1.1; c.stroke();
    };
    wing(-1);
    c.fillStyle = '#3fbf8f'; c.beginPath(); c.moveTo(-6 * k, 2 * k); c.quadraticCurveTo(-18 * k, 8 * k, -22 * k, -1 * k); c.lineTo(-19 * k, 0); c.lineTo(-8 * k, -2 * k); c.fill(); c.strokeStyle = UO; c.stroke();
    sphere(c, 0, 0, 9.5 * k, '#3fbf8f');
    c.fillStyle = '#e8f0a0'; c.beginPath(); c.ellipse(1 * k, 4 * k, 6 * k, 3.5 * k, 0, 0, 7); c.fill();
    sphere(c, 11 * k, -7 * k, 6 * k, '#4fcf9f');
    c.fillStyle = '#fff'; c.beginPath(); c.arc(13 * k, -9 * k, 1.8 * k, 0, 7); c.fill(); c.fillStyle = '#1a1010'; c.beginPath(); c.arc(13.6 * k, -9 * k, 0.9 * k, 0, 7); c.fill();
    c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(9 * k, -12 * k); c.lineTo(8 * k, -17 * k); c.lineTo(11 * k, -12.5 * k); c.fill();
    wing(1);
    if (atk) { c.save(); c.translate(17 * k, -5 * k); c.rotate(-1.4); fire(c, 0, 0, t, 0.5); c.restore(); }
  } else if (L.special === 'bats') {
    unitShadow(c, 10 * k, 3.5 * k);
    for (let i = 0; i < 3; i++) {
      const ox = [-7, 7, 0][i] * k, oy = -28 - [0, 3, 10][i] + Math.sin(t * 8 + i * 2) * 3;
      const fl = Math.sin(t * 22 + i) * 4;
      c.fillStyle = '#2b2440'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(ox, oy); c.quadraticCurveTo(ox - 5 * k, oy - 6 - fl, ox - 10 * k, oy - 3 - fl); c.lineTo(ox - 6 * k, oy + 1); c.lineTo(ox - 3 * k, oy + 3); c.lineTo(ox + 3 * k, oy + 3); c.lineTo(ox + 6 * k, oy + 1); c.lineTo(ox + 10 * k, oy - 3 - fl); c.quadraticCurveTo(ox + 5 * k, oy - 6 - fl, ox, oy); c.fill(); c.stroke();
      glowAt(c, ox - 1.5, oy - 0.5, 2.5, '#ff3a3a', 1); glowAt(c, ox + 1.5, oy - 0.5, 2.5, '#ff3a3a', 1);
    }
  }
}
function prismLite(c, x, y, w, h, col) {
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, shade(col, 0.2)); g.addColorStop(1, shade(col, -0.3));
  c.fillStyle = g; c.fillRect(x, y, w, h); c.strokeStyle = UO; c.lineWidth = 1; c.strokeRect(x, y, w, h);
  c.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + w * i / 4, y); c.lineTo(x + w * i / 4, y + h); c.stroke(); }
}
const isAirLook = id => { const s = (LOOK[id] || {}).special; return s === 'balloon' || s === 'healer' || s === 'dragon' || s === 'bats'; };

/* =====================================================================
   PORTRAITS / ICONS (cached canvases for the UI)
   ===================================================================== */
const PORT = new Map();
function portrait(id, size) {
  const key = id + ':' + size;
  if (PORT.has(key)) return PORT.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d');
  if (D && D.sdef(id)) { spellIcon(c, id, size); PORT.set(key, cv); return cv; }
  const L = LOOK[id] || {};
  const air = isAirLook(id);
  // soft backdrop
  const bg = c.createRadialGradient(size / 2, size * 0.4, 2, size / 2, size / 2, size * 0.6);
  bg.addColorStop(0, 'rgba(255,255,255,.18)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = bg; c.fillRect(0, 0, size, size);
  const sc = size / 64;
  const big = L.sz || 1;
  const scale = sc * 1.95 / Math.max(1, big * 0.8);
  c.translate(size / 2, size * 0.9);
  drawUnitShape(c, id, 0, air ? (L.special === 'balloon' ? 40 : L.special === 'dragon' ? 34 : 26) * scale : 0, 1, 0.3, 0, scale);
  PORT.set(key, cv);
  return cv;
}
function spellIcon(c, id, size) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  const col = D.sdef(id).color;
  const r = size * 0.38, x = size / 2, y = size / 2, k = size / 64;
  c.drawImage(glowSprite(col), 0, 0, size, size);
  const g = c.createRadialGradient(x - r * .3, y - r * .4, r * .1, x, y, r);
  g.addColorStop(0, shade(col, 0.6)); g.addColorStop(0.6, col); g.addColorStop(1, shade(col, -0.5));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2 * k; c.stroke();
  c.strokeStyle = '#fff'; c.lineWidth = size / 14; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  if (id === 'lightning') { c.moveTo(x + 4 * k, y - 16 * k); c.lineTo(x - 6 * k, y + 2 * k); c.lineTo(x + 4 * k, y + 2 * k); c.lineTo(x - 4 * k, y + 16 * k); }
  else if (id === 'heal') { c.moveTo(x, y - 12 * k); c.lineTo(x, y + 12 * k); c.moveTo(x - 12 * k, y); c.lineTo(x + 12 * k, y); }
  else if (id === 'rage') { c.moveTo(x - 10 * k, y + 8 * k); c.lineTo(x, y - 12 * k); c.lineTo(x + 10 * k, y + 8 * k); c.moveTo(x - 6 * k, y + 2 * k); c.lineTo(x + 6 * k, y + 2 * k); }
  else if (id === 'freeze') { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.moveTo(x - Math.cos(a) * 13 * k, y - Math.sin(a) * 13 * k); c.lineTo(x + Math.cos(a) * 13 * k, y + Math.sin(a) * 13 * k); } }
  else if (id === 'poison') { c.arc(x - 4 * k, y - 2 * k, 5 * k, 0, 7); c.moveTo(x + 11 * k, y + 6 * k); c.arc(x + 6 * k, y + 6 * k, 5 * k, 0, 7); }
  else if (id === 'invisibility') { c.arc(x, y, 9 * k, Math.PI * 0.15, Math.PI * 1.85); }
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(x - r * .35, y - r * .5, r * .3, r * .15, -0.5, 0, 7); c.fill();
}
function equipIcon(id, size) {
  const key = 'eq:' + id + ':' + size;
  if (PORT.has(key)) return PORT.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d'), e = D.edef(id), k = size / 64, x = size / 2, y = size / 2;
  c.drawImage(glowSprite(e.color, true), 0, 0, size, size);
  c.strokeStyle = UO; c.lineWidth = 2;
  const grad = (col) => { const g = c.createLinearGradient(x - 16 * k, y - 16 * k, x + 16 * k, y + 16 * k); g.addColorStop(0, shade(col, 0.4)); g.addColorStop(1, shade(col, -0.35)); return g; };
  if (id === 'giantgauntlet') { c.fillStyle = grad(e.color); c.fillRect(x - 12 * k, y - 8 * k, 24 * k, 20 * k); c.strokeRect(x - 12 * k, y - 8 * k, 24 * k, 20 * k); for (let i = 0; i < 4; i++) { c.fillRect(x - 12 * k + i * 6 * k, y - 16 * k, 5 * k, 9 * k); c.strokeRect(x - 12 * k + i * 6 * k, y - 16 * k, 5 * k, 9 * k); } c.fillStyle = '#ffd23f'; c.fillRect(x - 12 * k, y + 6 * k, 24 * k, 3 * k); }
  else if (id === 'invisibilityvial' || id === 'healingrune') { c.fillStyle = 'rgba(232,244,255,.9)'; c.beginPath(); c.moveTo(x - 4 * k, y - 18 * k); c.lineTo(x + 4 * k, y - 18 * k); c.lineTo(x + 4 * k, y - 8 * k); c.lineTo(x + 13 * k, y + 12 * k); c.lineTo(x - 13 * k, y + 12 * k); c.lineTo(x - 4 * k, y - 8 * k); c.closePath(); c.fill(); c.stroke(); c.fillStyle = grad(e.color); c.fillRect(x - 11 * k, y + 2 * k, 22 * k, 9 * k); if (id === 'healingrune') { c.strokeStyle = '#fff'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x, y - 2 * k); c.lineTo(x, y + 10 * k); c.moveTo(x - 6 * k, y + 4 * k); c.lineTo(x + 6 * k, y + 4 * k); c.stroke(); } }
  else if (id === 'thunderorb') { sphere(c, x, y, 15 * k, e.color, e.color); c.strokeStyle = '#fff'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(x + 3 * k, y - 10 * k); c.lineTo(x - 4 * k, y + 1 * k); c.lineTo(x + 3 * k, y + 1 * k); c.lineTo(x - 3 * k, y + 11 * k); c.stroke(); }
  else if (id === 'ragecrown') { c.fillStyle = grad('#ffd23f'); c.beginPath(); c.moveTo(x - 16 * k, y + 10 * k); c.lineTo(x - 16 * k, y - 8 * k); c.lineTo(x - 8 * k, y); c.lineTo(x, y - 14 * k); c.lineTo(x + 8 * k, y); c.lineTo(x + 16 * k, y - 8 * k); c.lineTo(x + 16 * k, y + 10 * k); c.closePath(); c.fill(); c.stroke(); sphere(c, x, y + 4 * k, 4 * k, e.color); }
  else if (id === 'shadowcloak') { c.fillStyle = grad(e.color); c.beginPath(); c.moveTo(x, y - 16 * k); c.quadraticCurveTo(x + 18 * k, y, x + 12 * k, y + 16 * k); c.lineTo(x - 12 * k, y + 16 * k); c.quadraticCurveTo(x - 18 * k, y, x, y - 16 * k); c.fill(); c.stroke(); }
  PORT.set(key, cv);
  return cv;
}
function buildingIcon(t, lv, size) {
  const key = 'b:' + t + ':' + lv + ':' + size;
  if (PORT.has(key)) return PORT.get(key);
  const sp = t === 'wall' ? wallSprite(lv, 3) : spriteFor(t, lv, 3, true);
  const cv = document.createElement('canvas'); cv.width = size * 2; cv.height = Math.round(size * 1.4);
  const c = cv.getContext('2d');
  // crop: ignore most of the shadow margin on the right
  const sw = sp.w - 60, sc = Math.min(cv.width / sw, cv.height / sp.h) * 0.98;
  c.drawImage(sp.cv, 0, 0, sw * sp.R, sp.cv.height, (cv.width - sw * sc) / 2, (cv.height - sp.h * sc) / 2, sw * sc, sp.h * sc);
  PORT.set(key, cv);
  return cv;
}

/* ---- avatars (12 procedural faces) ------------------------------------ */
const AV = [
  ['#ff9b3d', 'crown', '#ffd23f'], ['#45b8ff', 'hood', '#e04fa8'], ['#5dd23b', 'hair', '#8a5a2b'], ['#a26bff', 'wizard', '#2a4ab0'],
  ['#ff5a4a', 'helmet', '#c8d0d8'], ['#ffd23f', 'horns', '#3a4a6a'], ['#3fbf8f', 'ears', '#5bd14b'], ['#2a2a3a', 'hair', '#ff6a3a'],
  ['#7fd4ff', 'crown', '#8a2a5a'], ['#d64bff', 'bald', '#3a2410'], ['#c8b48a', 'skull', '#e8eef5'], ['#ff7a3a', 'wizard', '#7a1a4a'],
];
function drawAvatar(cv, n) {
  const c = cv.getContext('2d'), s = cv.width, a = AV[(n | 0) % AV.length];
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, s, s);
  const g = c.createRadialGradient(s * .4, s * .3, 2, s / 2, s / 2, s * .75); g.addColorStop(0, shade(a[0], 0.4)); g.addColorStop(1, shade(a[0], -0.4));
  c.fillStyle = g; c.fillRect(0, 0, s, s);
  for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(255,255,255,.06)'; c.beginPath(); c.moveTo(s / 2, s * 0.55); c.arc(s / 2, s * 0.55, s, i * 0.785, i * 0.785 + 0.39); c.fill(); }
  const k = s / 22;
  const L = { skin: a[1] === 'ears' ? '#6bd14b' : a[1] === 'skull' ? '#e8eef5' : '#f2c08a', hair: a[2], hat: a[1], hatCol: a[2], hairCol: shade(a[2], 0.3) };
  c.save(); c.translate(s / 2, s * 0.62);
  c.fillStyle = shade(a[0], -0.25); c.strokeStyle = UO; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, s * 0.42, s * 0.36, s * 0.3, 0, 0, 7); c.fill(); c.stroke();
  const hg = c.createRadialGradient(-2 * k, -2.5 * k, 0.5 * k, 0, 0, 6 * k); hg.addColorStop(0, shade(L.skin, 0.25)); hg.addColorStop(1, shade(L.skin, -0.2));
  c.fillStyle = hg; c.beginPath(); c.arc(0, 0, 5.6 * k, 0, 7); c.fill(); c.stroke();
  if (a[1] !== 'skull' && a[1] !== 'horns') {
    for (const ex of [-2, 2]) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex * k, -0.6 * k, 1.4 * k, 1.8 * k, 0, 0, 7); c.fill(); c.fillStyle = '#1a1010'; c.beginPath(); c.arc(ex * k + 0.3 * k, -0.4 * k, 0.8 * k, 0, 7); c.fill(); }
    c.strokeStyle = '#6a2a1a'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 1.8 * k, 1.8 * k, 0.3, Math.PI - 0.3); c.stroke();
  } else if (a[1] === 'skull') { c.fillStyle = '#1a1010'; c.beginPath(); c.arc(-2 * k, -0.5 * k, 1.3 * k, 0, 7); c.arc(2 * k, -0.5 * k, 1.3 * k, 0, 7); c.fill(); }
  if (n % 3 === 0) { c.fillStyle = a[2]; c.beginPath(); c.ellipse(0, 2.4 * k, 3.4 * k, 1.1 * k, 0, 0, 7); c.fill(); }
  hat(c, L, k, 0, 0, 1.4);
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.strokeRect(1, 1, s - 2, s - 2);
}
