/* GrejsAlley Lemmings — level.js
 * Terrain (pixel material grid) and the level builder that turns a level
 * definition from levels-data.js into playable terrain.
 * No DOM access here, so the simulation can also run headless (tools/verify.js).
 */
(function (GL) {
  'use strict';

  // Terrain materials. Everything that is not AIR is solid for collisions.
  const AIR = 0, DIRT = 1, STEEL = 2, BRICK = 3;
  GL.MAT = { AIR, DIRT, STEEL, BRICK };
  const MAT_CODES = { a: AIR, air: AIR, d: DIRT, dirt: DIRT, s: STEEL, steel: STEEL, b: BRICK, brick: BRICK };

  /* ---------- deterministic noise helpers (also used by the renderer) ---------- */
  function hash2(x, y, seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((seed | 0) + 1, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise1(x, seed) {
    const i = Math.floor(x), f = x - i;
    return hash2(i, 0, seed) * (1 - smooth(f)) + hash2(i + 1, 0, seed) * smooth(f);
  }
  function noise2(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
    const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  GL.noise = { hash2, noise1, noise2 };

  /* ---------------------------------- Terrain ---------------------------------- */
  class Terrain {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.data = new Uint8Array(w * h);
      this.dirty = null; // {x0,y0,x1,y1} union of changed area since last render
    }
    // Outside the left/right edges counts as steel (the level has walls),
    // above the top is air and below the bottom is air (lemmings fall out).
    get(x, y) {
      if (x < 0 || x >= this.w) return STEEL;
      if (y < 0 || y >= this.h) return AIR;
      return this.data[y * this.w + x];
    }
    solid(x, y) { return this.get(x, y) !== AIR; }
    isSteel(x, y) {
      if (y < 0 || y >= this.h || x < 0 || x >= this.w) return false;
      return this.data[y * this.w + x] === STEEL;
    }
    set(x, y, m) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.data[y * this.w + x] = m;
    }
    markDirty(x0, y0, x1, y1) {
      x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0);
      x1 = Math.min(this.w - 1, x1 | 0); y1 = Math.min(this.h - 1, y1 | 0);
      if (x1 < x0 || y1 < y0) return;
      const d = this.dirty;
      if (!d) this.dirty = { x0, y0, x1, y1 };
      else { d.x0 = Math.min(d.x0, x0); d.y0 = Math.min(d.y0, y0); d.x1 = Math.max(d.x1, x1); d.y1 = Math.max(d.y1, y1); }
    }
    // Remove diggable material (dirt + brick) inside a rectangle (inclusive coords).
    // Returns how many pixels were removed.
    eraseRect(x0, y0, x1, y1) {
      if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
      let n = 0;
      for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) {
        for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) {
          const i = y * this.w + x, m = this.data[i];
          if (m === DIRT || m === BRICK) { this.data[i] = AIR; n++; }
        }
      }
      if (n) this.markDirty(x0, y0, x1, y1);
      return n;
    }
    eraseCircle(cx, cy, r) {
      let n = 0;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > r * r) continue;
          if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
          const i = y * this.w + x, m = this.data[i];
          if (m === DIRT || m === BRICK) { this.data[i] = AIR; n++; }
        }
      }
      if (n) this.markDirty(cx - r, cy - r, cx + r, cy + r);
      return n;
    }
    // Any steel inside the rectangle?
    steelIn(x0, y0, x1, y1) {
      if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.isSteel(x, y)) return true;
      return false;
    }
    // Any diggable material inside the rectangle?
    diggableIn(x0, y0, x1, y1) {
      if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
      for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) {
        for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) {
          const m = this.data[y * this.w + x];
          if (m === DIRT || m === BRICK) return true;
        }
      }
      return false;
    }
    // Place a builder brick: only fills air.
    placeBrick(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      const i = y * this.w + x;
      if (this.data[i] !== AIR) return false;
      this.data[i] = BRICK;
      this.markDirty(x, y, x, y);
      return true;
    }
  }
  GL.Terrain = Terrain;

  /* ------------------------------- shape painter ------------------------------- */
  // Shapes in level data:
  //  ['rect', x, y, w, h, mat]
  //  ['poly', [[x,y],...], mat]
  //  ['ellipse', cx, cy, rx, ry, mat]
  //  ['blob', cx, cy, rx, ry, mat, seed]          noisy, natural-looking rock
  //  ['land', x0, x1, bottom, [[x,y],...], mat, rough]  ground with a smooth surface line
  //  ['ceil', x0, x1, [[x,y],...], mat, rough]          cave ceiling, filled from the top down
  // mat: 'd' dirt (diggable), 's' steel, 'b' brick, 'a' air (carves a hole)
  function matOf(code, def) {
    if (code === undefined || code === null) return def;
    const m = MAT_CODES[code];
    if (m === undefined) throw new Error('Ukendt materiale: ' + code);
    return m;
  }

  function paintShape(T, s, seed) {
    const type = s[0];
    if (type === 'rect') {
      const [, x, y, w, h, mc] = s, m = matOf(mc, DIRT);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) T.set(xx, yy, m);
    } else if (type === 'ellipse' || type === 'blob') {
      const [, cx, cy, rx, ry, mc, sd] = s, m = matOf(mc, DIRT);
      const bs = (sd || 0) + seed;
      for (let yy = Math.floor(cy - ry - 3); yy <= cy + ry + 3; yy++) {
        for (let xx = Math.floor(cx - rx - 3); xx <= cx + rx + 3; xx++) {
          const dx = (xx - cx) / rx, dy = (yy - cy) / ry;
          let lim = 1;
          if (type === 'blob') {
            const a = Math.atan2(dy, dx);
            lim = 0.86 + 0.24 * noise1((a + Math.PI) * 2.2, bs) + 0.06 * noise1((a + Math.PI) * 9, bs + 7);
          }
          if (dx * dx + dy * dy <= lim * lim) T.set(xx, yy, m);
        }
      }
    } else if (type === 'poly') {
      const pts = s[1], m = matOf(s[2], DIRT);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      for (let yy = Math.floor(minY); yy <= maxY; yy++) {
        for (let xx = Math.floor(minX); xx <= maxX; xx++) {
          if (pointInPoly(xx + 0.5, yy + 0.5, pts)) T.set(xx, yy, m);
        }
      }
    } else if (type === 'land') {
      const [, x0, x1, bottom, pts, mc, rough] = s, m = matOf(mc, DIRT);
      const r = rough === undefined ? 1 : rough;
      for (let xx = x0; xx < x1; xx++) {
        let top = surfaceAt(pts, xx);
        if (r > 0) top += Math.round((noise1(xx / 7, seed + 3) - 0.5) * 2 * r);
        for (let yy = Math.max(0, top); yy < bottom; yy++) T.set(xx, yy, m);
      }
    } else if (type === 'ceil') {
      const [, x0, x1, pts, mc, rough] = s, m = matOf(mc, DIRT);
      const r = rough === undefined ? 1 : rough;
      for (let xx = x0; xx < x1; xx++) {
        let bot = surfaceAt(pts, xx);
        if (r > 0) bot += Math.round((noise1(xx / 5, seed + 11) - 0.5) * 2 * r);
        for (let yy = 0; yy < bot; yy++) T.set(xx, yy, m);
      }
    } else {
      throw new Error('Ukendt terræn-form: ' + type);
    }
  }

  // Cosine-interpolated surface through control points (sorted by x).
  function surfaceAt(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (x <= b[0]) {
        const t = (x - a[0]) / Math.max(1, b[0] - a[0]);
        const k = (1 - Math.cos(t * Math.PI)) / 2;
        return Math.round(a[1] + (b[1] - a[1]) * k);
      }
    }
    return pts[pts.length - 1][1];
  }

  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // Snap a point down to the first solid surface (used for exits).
  function snapToGround(T, x, y) {
    let yy = Math.max(0, y - 12);
    while (yy < T.h && !T.solid(x, yy)) yy++;
    return yy;
  }

  /* ------------------------------- level builder ------------------------------- */
  // Builds a fresh, mutable level instance from a definition. Called on every
  // (re)start so terrain changes from the previous attempt are discarded.
  function build(def) {
    const T = new Terrain(def.w, def.h);
    const seed = def.seed || (def.id ? hashStr(def.id) : 1);
    for (const s of def.terrain) paintShape(T, s, seed);
    T.dirty = null;

    const entrances = (def.entrances || [def.entrance]).map(e => ({ x: e.x, y: e.y, dir: e.dir || 1 }));
    const exits = (def.exits || [def.exit]).map(e => ({ x: e.x, y: snapToGround(T, e.x, e.y) }));
    const hazards = (def.hazards || []).map(h => ({ type: h.type || 'water', x: h.x, y: h.y, w: h.w, h: h.h }));
    return { def, terrain: T, entrances, exits, hazards, seed };
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) % 100000;
  }

  // Basic sanity checks so a broken level definition gives a clear error.
  function validate(def) {
    const errs = [];
    if (!def.id) errs.push('mangler id');
    if (!(def.w > 0 && def.h > 0)) errs.push('ugyldig størrelse');
    if (!(def.count > 0)) errs.push('count skal være > 0');
    if (!(def.required > 0 && def.required <= def.count)) errs.push('required skal være mellem 1 og count');
    if (!def.entrance && !def.entrances) errs.push('mangler indgang');
    if (!def.exit && !def.exits) errs.push('mangler udgang');
    if (!Array.isArray(def.terrain)) errs.push('mangler terrain');
    return errs;
  }

  GL.Level = { build, validate, surfaceAt, paintShape };
})(typeof window !== 'undefined' ? (window.GL = window.GL || {}) : (globalThis.GL = globalThis.GL || {}));
