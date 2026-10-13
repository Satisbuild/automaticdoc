/* =====================================================================
 * GREJS TANKS - utils.js
 * Shared helpers: math, seeded random, noise, colors, DOM helpers.
 * All modules attach themselves to the global namespace `GT`
 * (plain scripts, so the game also works from file:// without a server).
 * ===================================================================== */
(function () {
  'use strict';
  const GT = (window.GT = window.GT || {});
  const U = (GT.U = {});

  /* ---------- math ---------- */
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.deg = (r) => (r * 180) / Math.PI;
  U.rad = (d) => (d * Math.PI) / 180;
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.easeOut = (t) => 1 - Math.pow(1 - t, 3);
  U.sign = (v) => (v < 0 ? -1 : 1);

  /* ---------- hashing & seeded RNG ---------- */
  U.hashStr = function (s) {
    let h = 2166136261 >>> 0;
    s = String(s);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  /** mulberry32 seeded random generator with helpers */
  U.rng = function (seed) {
    let a = seed >>> 0;
    const f = function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    f.shuffle = (arr) => {
      const r = arr.slice();
      for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
      }
      return r;
    };
    return f;
  };

  /** 1D value noise (smooth), seeded. Returns function(x) -> [-1,1] */
  U.noise1D = function (seed, period) {
    const r = U.rng(seed);
    const N = 512;
    const vals = new Float32Array(N);
    for (let i = 0; i < N; i++) vals[i] = r() * 2 - 1;
    return function (x) {
      const p = x / period;
      const i = Math.floor(p);
      const t = U.smooth(p - i);
      const a = vals[((i % N) + N) % N];
      const b = vals[(((i + 1) % N) + N) % N];
      return a + (b - a) * t;
    };
  };

  /** fast integer hash -> [0,1) for per-pixel noise */
  U.hash2 = function (x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  /* ---------- colors ---------- */
  U.hexToRgb = function (hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map((v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  /** lighten (amt>0) or darken (amt<0) a hex color, amt in [-1,1] */
  U.shade = function (hex, amt) {
    const [r, g, b] = U.hexToRgb(hex);
    if (amt >= 0) return U.rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    return U.rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  };
  U.mix = function (h1, h2, t) {
    const a = U.hexToRgb(h1), b = U.hexToRgb(h2);
    return U.rgbToHex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t));
  };
  U.rgba = function (hex, a) {
    const [r, g, b] = U.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  /* ---------- formatting ---------- */
  U.fmt = function (n) {
    n = Math.round(n || 0);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };
  U.todayKey = function () {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  U.deepClone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- DOM ---------- */
  U.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  U.isTouch = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
})();

