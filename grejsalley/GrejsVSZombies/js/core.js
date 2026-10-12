'use strict';
/* =====================================================================
   GREJS VS ZOMBIES - core.js
   Fælles hjælpefunktioner (matematik, tilfældighed, DOM) og tegnekittet,
   som alle planter, zombier, bosser og baggrunde tegnes med.
   Al grafik i spillet tegnes i koden - der er ingen billedfiler.
   ===================================================================== */
window.GVZ = window.GVZ || {};

GVZ.U = (function () {
  const U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeInCubic = (t) => t * t * t;
  U.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  U.easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  U.easeOutElastic = (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1);

  /* Seedet tilfældighed (mulberry32) - bruges til baner og daglige udfordringer */
  U.rng = function (seed) {
    let a = seed >>> 0;
    const f = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    return f;
  };
  U.hashStr = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.dayKey = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  U.fmt = (n) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  U.fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  U.$ = (s, root) => (root || document).querySelector(s);
  U.$$ = (s, root) => Array.from((root || document).querySelectorAll(s));
  U.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Farver */
  const rgbCache = new Map();
  U.rgb = function (hex) {
    let v = rgbCache.get(hex);
    if (v) return v;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
    return v;
  };
  U.mix = function (a, b, t) {
    const A = U.rgb(a), B = U.rgb(b);
    const r = Math.round(A[0] + (B[0] - A[0]) * t), g = Math.round(A[1] + (B[1] - A[1]) * t), bl = Math.round(A[2] + (B[2] - A[2]) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  };
  U.rgba = function (hex, a) { const c = U.rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  U.shade = (hex, amt) => (amt >= 0 ? U.mix(hex, '#ffffff', amt) : U.mix(hex, '#000000', -amt));

  U.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  return U;
})();

/* =====================================================================
   Tegnekit. Alle figurer bruger A.k(farve), så hele figuren kan tones
   (hvidt hit-flash, blå frost, grøn gift, sort forkulning) uden
   dyre offscreen-buffere.
   ===================================================================== */
GVZ.A = (function () {
  const U = GVZ.U;
  const A = {};
  A.INK = '#2a1b12';
  A.LW = 3;
  let tintCol = null, tintAmt = 0;
  const kc = new Map();
  A.setTint = function (col, amt) { tintCol = amt > 0.01 ? col : null; tintAmt = amt; };
  A.clearTint = function () { tintCol = null; tintAmt = 0; };
  A.k = function (hex) {
    if (!tintCol) return hex;
    const key = hex + tintCol + ((tintAmt * 24) | 0);
    let v = kc.get(key);
    if (!v) {
      v = U.mix(hex, tintCol, Math.round(tintAmt * 24) / 24);
      if (kc.size > 6000) kc.clear();
      kc.set(key, v);
    }
    return v;
  };
  const k = A.k;
  A.ink = () => k(A.INK);

  A.fillStroke = function (ctx, fill, lw) {
    if (fill) { ctx.fillStyle = typeof fill === 'string' ? k(fill) : fill; ctx.fill(); }
    if (lw !== 0) { ctx.lineWidth = lw || A.LW; ctx.strokeStyle = k(A.INK); ctx.stroke(); }
  };
  A.circ = function (ctx, x, y, r, fill, lw) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    A.fillStroke(ctx, fill, lw);
  };
  A.ell = function (ctx, x, y, rx, ry, rot, fill, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
    A.fillStroke(ctx, fill, lw);
  };
  A.rrect = function (ctx, x, y, w, h, r, fill, lw) {
    U.roundRect(ctx, x, y, w, h, r);
    A.fillStroke(ctx, fill, lw);
  };
  A.poly = function (ctx, pts, fill, lw, open) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    if (!open) ctx.closePath();
    A.fillStroke(ctx, fill, lw);
  };
  /* Lodret gradient (top -> bund) */
  A.vg = function (ctx, y0, y1, c0, c1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, k(c0)); g.addColorStop(1, k(c1));
    return g;
  };
  A.rg = function (ctx, x, y, r, c0, c1, ox, oy) {
    const g = ctx.createRadialGradient(x + (ox || -r * 0.35), y + (oy || -r * 0.35), r * 0.1, x, y, r);
    g.addColorStop(0, k(c0)); g.addColorStop(1, k(c1));
    return g;
  };
  /* Skinnende kugle med highlight */
  A.ball = function (ctx, x, y, r, light, dark, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = A.rg(ctx, x, y, r, light, dark);
    ctx.fill();
    if (lw !== 0) { ctx.lineWidth = lw || A.LW; ctx.strokeStyle = k(A.INK); ctx.stroke(); }
    A.shine(ctx, x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.16);
  };
  A.shine = function (ctx, x, y, rx, ry, a) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + (a == null ? 0.55 : a) + ')';
    ctx.fill();
  };
  A.shadow = function (ctx, x, y, rx, ry, a) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,' + (a == null ? 0.25 : a) + ')';
    ctx.fill();
  };
  A.glow = function (ctx, x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.rgba(col, a == null ? 0.6 : a));
    g.addColorStop(1, U.rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  A.star = function (ctx, x, y, r1, r2, n, rot, fill, lw) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (rot || 0) + (i * Math.PI) / n - Math.PI / 2;
      const r = i % 2 ? r2 : r1;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    A.fillStroke(ctx, fill, lw);
  };
  /* Blad med midterribbe. ang = retning fra roden */
  A.leaf = function (ctx, x, y, len, wid, ang, fill, rib) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
    ctx.fillStyle = A.vg(ctx, -wid, wid, U.shade(fill, 0.18), U.shade(fill, -0.18));
    ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = k(A.INK); ctx.stroke();
    if (rib !== false) {
      ctx.beginPath(); ctx.moveTo(len * 0.1, 0); ctx.quadraticCurveTo(len * 0.5, -wid * 0.12, len * 0.85, 0);
      ctx.lineWidth = 1.5; ctx.strokeStyle = k(U.shade(fill, -0.35)); ctx.stroke();
    }
    ctx.restore();
  };
  /* Stængel fra (x0,y0) til (x1,y1) med bue */
  A.stem = function (ctx, x0, y0, x1, y1, bend, w, col) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1);
    ctx.lineCap = 'round';
    ctx.lineWidth = w + 5; ctx.strokeStyle = k(A.INK); ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = k(col || '#4c9a2a'); ctx.stroke();
    ctx.lineWidth = Math.max(1, w * 0.3); ctx.strokeStyle = k(U.shade(col || '#4c9a2a', 0.3));
    ctx.beginPath(); ctx.moveTo(x0 - w * 0.2, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + bend - w * 0.2, (y0 + y1) / 2, x1 - w * 0.2, y1); ctx.stroke();
    ctx.lineCap = 'butt';
  };
  /* Øje. look: -1..1, blink 0..1 (1 = lukket) */
  A.eye = function (ctx, x, y, r, lookX, lookY, blink, opts) {
    opts = opts || {};
    const ry = r * (1 - U.clamp(blink || 0, 0, 1) * 0.92);
    ctx.beginPath(); ctx.ellipse(x, y, r * (opts.wide || 0.85), Math.max(0.6, ry), 0, 0, Math.PI * 2);
    ctx.fillStyle = k(opts.white || '#ffffff'); ctx.fill();
    ctx.lineWidth = opts.lw || 2.2; ctx.strokeStyle = k(A.INK); ctx.stroke();
    if (ry > r * 0.25) {
      const pr = r * (opts.pupil || 0.5);
      const px = x + (lookX || 0) * r * 0.32, py = y + (lookY || 0) * r * 0.3;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(x, y, r * (opts.wide || 0.85), ry, 0, 0, Math.PI * 2); ctx.clip();
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = k(opts.pupilCol || '#1b120c'); ctx.fill();
      ctx.beginPath(); ctx.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
    }
    if (opts.brow) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.9, y - r * 1.15 + opts.brow * r * 0.4);
      ctx.lineTo(x + r * 0.9, y - r * 1.15 - opts.brow * r * 0.4);
      ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
    }
  };
  A.mouth = function (ctx, x, y, w, type, open) {
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.5; ctx.strokeStyle = k(A.INK);
    if (type === 'smile') {
      ctx.beginPath(); ctx.arc(x, y - w * 0.3, w * 0.5, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    } else if (type === 'grin' || type === 'open') {
      const h = w * (0.3 + (open || 0) * 0.45);
      ctx.beginPath(); ctx.moveTo(x - w * 0.5, y - h * 0.2);
      ctx.quadraticCurveTo(x, y + h * 1.4, x + w * 0.5, y - h * 0.2);
      ctx.closePath();
      ctx.fillStyle = k('#5a1d1d'); ctx.fill(); ctx.stroke();
      if (type === 'grin') {
        ctx.beginPath(); ctx.ellipse(x, y + h * 0.65, w * 0.2, h * 0.25, 0, 0, Math.PI * 2);
        ctx.fillStyle = k('#e0566b'); ctx.fill();
      }
    } else if (type === 'o') {
      ctx.beginPath(); ctx.ellipse(x, y, w * 0.22, w * (0.22 + (open || 0) * 0.15), 0, 0, Math.PI * 2);
      ctx.fillStyle = k('#4a1616'); ctx.fill(); ctx.stroke();
    } else if (type === 'frown') {
      ctx.beginPath(); ctx.arc(x, y + w * 0.35, w * 0.4, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke();
    } else if (type === 'flat') {
      ctx.beginPath(); ctx.moveTo(x - w * 0.35, y); ctx.lineTo(x + w * 0.35, y); ctx.stroke();
    } else if (type === 'teeth') {
      const h = w * (0.35 + (open || 0) * 0.4);
      U.roundRect(ctx, x - w * 0.5, y - h / 2, w, h, 4);
      ctx.fillStyle = k('#3b1010'); ctx.fill(); ctx.stroke();
      ctx.fillStyle = k('#f3ead2');
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x - w * 0.42 + i * w * 0.22, y - h / 2 + 1, w * 0.14, h * 0.32);
        ctx.fillRect(x - w * 0.31 + i * w * 0.22, y + h / 2 - h * 0.3 - 1, w * 0.14, h * 0.3);
      }
    }
    ctx.lineCap = 'butt';
  };
  /* Små stråler (lys) */
  A.rays = function (ctx, x, y, r0, r1, n, rot, col, a) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = U.rgba(col, a == null ? 0.35 : a);
    for (let i = 0; i < n; i++) {
      ctx.rotate((Math.PI * 2) / n);
      ctx.beginPath(); ctx.moveTo(r0, -r0 * 0.25); ctx.lineTo(r1, 0); ctx.lineTo(r0, r0 * 0.25); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };
  /* Teksturprikker (bruges på stof, bark, sten) */
  A.speckle = function (ctx, x, y, w, h, n, col, seed, size) {
    const r = GVZ.U.rng(seed || 7);
    ctx.fillStyle = k(col);
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(x + r() * w, y + r() * h, (size || 1.6) * (0.5 + r()), 0, Math.PI * 2); ctx.fill();
    }
  };
  return A;
})();
