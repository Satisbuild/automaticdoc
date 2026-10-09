'use strict';
/* =====================================================================
   SUPER GREJS - util.js
   Små hjælpefunktioner og sikker localStorage.
   ===================================================================== */
SG.util = (function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n, w) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

  // Deterministisk støj til tiles, så grafikken ikke "flimrer" mellem frames.
  function hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const store = {
    get(key, dflt) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? dflt : JSON.parse(v);
      } catch (e) {
        return dflt;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignorér */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignorér */ }
    },
  };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return c;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const f = v => clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255);
    return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join('');
  }

  return { clamp, lerp, sign, approach, rand, randi, pick, overlap, esc, pad, hash2, mulberry32, store, makeCanvas, shade, mix, hexToRgb };
})();
