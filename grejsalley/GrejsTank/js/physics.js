/* =====================================================================
 * GREJS TANKS - physics.js
 * Destructible bitmap terrain (Uint8 mask + canvas), procedural
 * terrain generation from level templates, and shared ballistic
 * helpers used by projectiles and the AI solver.
 *
 * Mask values: 0 = air, 1 = destructible ground, 2 = indestructible
 * (metal / bedrock). The destructible layer is painted on `canvas`,
 * the hard layer on `hardCanvas` so carving never erases metal.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const U = GT.U;

  const Physics = (GT.Physics = {
    GRAVITY: 520, // world units / s^2
    WIND_ACC: 7, // acceleration per wind point
    SPEED_BASE: 10.2 // launch speed = power% * tankPower * SPEED_BASE / 100 * 100
  });

  /* ================================================================
   * Terrain
   * ================================================================ */
  /** tiling 256x256 value-noise texture with cell size s (cached) */
  const noiseTiles = {};
  function noiseTile(s, seed) {
    const key = s + '_' + seed;
    if (noiseTiles[key]) return noiseTiles[key];
    const N = 256, cells = Math.max(2, Math.round(N / s));
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = U.hash2((i % cells) + seed * 977, ((i / cells) | 0) + seed * 389);
    const out = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      const gy = (y / N) * cells, iy = Math.floor(gy), fy = U.smooth(gy - iy), y1 = (iy + 1) % cells;
      for (let x = 0; x < N; x++) {
        const gx = (x / N) * cells, ix = Math.floor(gx), fx = U.smooth(gx - ix), x1 = (ix + 1) % cells;
        const a = grid[iy * cells + ix], b = grid[iy * cells + x1], c = grid[y1 * cells + ix], d = grid[y1 * cells + x1];
        out[y * N + x] = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
      }
    }
    return (noiseTiles[key] = out);
  }

  class Terrain {
    constructor(W, H, theme) {
      this.W = W;
      this.H = H;
      this.theme = theme;
      this.mask = new Uint8Array(W * H);
      this.canvas = document.createElement('canvas');
      this.canvas.width = W;
      this.canvas.height = H;
      this.ctx = this.canvas.getContext('2d');
      this.hardCanvas = document.createElement('canvas');
      this.hardCanvas.width = W;
      this.hardCanvas.height = H;
      this.hctx = this.hardCanvas.getContext('2d');
      this.hasHard = false;
      this.heights = new Float32Array(W);
      this.dirtPattern = null;
      this.ver = 0;
    }

    isSolid(x, y) {
      x = x | 0;
      y = y | 0;
      if (x < 0 || x >= this.W || y < 0 || y >= this.H) return false;
      return this.mask[y * this.W + x] !== 0;
    }

    /** first solid y at or below fromY in column x (or H+200 if none) */
    surfaceY(x, fromY) {
      x = U.clamp(x | 0, 0, this.W - 1);
      let y = Math.max(0, fromY | 0);
      const W = this.W, m = this.mask;
      for (; y < this.H; y++) if (m[y * W + x]) return y;
      return this.H + 200;
    }

    /** first solid point along segment, sampled every `step` units */
    rayHit(x0, y0, x1, y1, step) {
      const d = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.ceil(d / (step || 3)));
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        if (this.isSolid(x, y)) return { x, y, t };
      }
      return null;
    }

    /** approximate surface normal at a point (points toward air) */
    normalAt(x, y) {
      let nx = 0, ny = 0;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const dx = Math.cos(a), dy = Math.sin(a);
        if (!this.isSolid(x + dx * 7, y + dy * 7)) {
          nx += dx;
          ny += dy;
        }
      }
      const l = Math.hypot(nx, ny);
      if (l < 0.001) return { x: 0, y: -1 };
      return { x: nx / l, y: ny / l };
    }

    /** remove ground in a circle. Returns number of pixels removed. */
    carve(cx, cy, r, scorch) {
      if (r <= 0) return 0;
      const W = this.W, H = this.H, m = this.mask;
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
      const r2 = r * r;
      let removed = 0;
      for (let y = y0; y <= y1; y++) {
        const dy = y - cy, row = y * W;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          if (dx * dx + dy * dy <= r2 && m[row + x] === 1) {
            m[row + x] = 0;
            removed++;
          }
        }
      }
      if (!removed) return 0;
      this.ver++;
      const c = this.ctx;
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
      if (scorch !== false && r > 8) {
        c.globalCompositeOperation = 'source-atop';
        const g = c.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.35);
        g.addColorStop(0, 'rgba(25,15,8,0.65)');
        g.addColorStop(1, 'rgba(25,15,8,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      return removed;
    }

    /** add ground (dirt bomb) in a circle where there is air */
    addDirt(cx, cy, r) {
      this.ver++;
      const W = this.W, H = this.H, m = this.mask;
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
      const r2 = r * r;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy <= r2 && m[y * W + x] === 0) m[y * W + x] = 1;
        }
      }
      const c = this.ctx;
      c.save();
      c.globalCompositeOperation = 'destination-over';
      c.fillStyle = this.dirtPattern || this.theme.terrain.soil[0];
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    /* ------------------------------------------------------------
     * Procedural generation
     * ------------------------------------------------------------ */
    generate(level) {
      const W = this.W, H = this.H;
      const r = U.rng(level.seed);
      const n1 = U.noise1D(level.seed + 11, 300);
      const n2 = U.noise1D(level.seed + 23, 95);
      const n3 = U.noise1D(level.seed + 37, 28);
      const amp = level.amp || 70;
      const base = level.base || H * 0.64;
      const h = this.heights;
      const cx = W / 2;
      const gauss = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
      const t = level.template;
      const peak = level.peak || 260;

      for (let x = 0; x < W; x++) {
        let y = base + n1(x) * amp + n2(x) * amp * 0.35 + n3(x) * 5;
        switch (t) {
          case 'flat':
            y = base + n1(x) * amp * 0.4 + n3(x) * 4;
            break;
          case 'hill':
            y -= peak * gauss(x, cx, W * 0.14);
            break;
          case 'mountain':
            y -= peak * 1.35 * gauss(x, cx, W * 0.085) + 40 * gauss(x, cx, W * 0.2);
            break;
          case 'valley':
            y += peak * 0.8 * gauss(x, cx, W * 0.17);
            y -= 60 * (gauss(x, W * 0.15, W * 0.1) + gauss(x, W * 0.85, W * 0.1));
            break;
          case 'twin_peaks':
            y -= peak * gauss(x, W * 0.37, W * 0.07) + peak * 0.9 * gauss(x, W * 0.63, W * 0.07);
            break;
          case 'cliffs': {
            const s1 = Math.tanh((x - W * 0.33) / 14), s2 = Math.tanh((x - W * 0.68) / 14);
            y += (level.flip ? -1 : 1) * (s1 * 90 - s2 * 60) - 40;
            break;
          }
          case 'plateaus': {
            const q = Math.round(n1(x * 0.8) * 3) * 65;
            y = base + q + n3(x) * 4;
            break;
          }
          case 'stairs': {
            const steps = 6;
            const i = Math.floor((x / W) * steps);
            const dir = level.flip ? -1 : 1;
            y = base + 120 - dir * (i - steps / 2) * 45 + n3(x) * 4;
            break;
          }
          case 'canyon':
            y += 360 * Math.max(0, Math.min(1, (70 - Math.abs(x - cx)) / 22 + 0.5)) * 1;
            break;
          case 'islands':
            y = H + 300; // no ground at all
            break;
          case 'bunker':
          case 'tunnels':
            y -= peak * 0.55 * gauss(x, cx, W * 0.2);
            break;
          case 'fortress':
            y -= 150 * gauss(x, W * 0.8, W * 0.12);
            break;
        }
        h[x] = y;
      }
      // smoothing pass for plateaus/stairs so edges are steep but not vertical noise
      if (t === 'plateaus' || t === 'stairs') {
        const tmp = Float32Array.from(h);
        for (let x = 0; x < W; x++) {
          let s = 0, c = 0;
          for (let k = -6; k <= 6; k++) {
            const xx = U.clamp(x + k, 0, W - 1);
            s += tmp[xx];
            c++;
          }
          h[x] = s / c;
        }
      }
      // flatten spawn pads so tanks start level
      const spawns = [level.spawns.player].concat(level.spawns.enemies);
      if (t !== 'islands') {
        for (const s of spawns) {
          const sx = s.x | 0;
          const target = h[U.clamp(sx, 0, W - 1)];
          for (let x = sx - 60; x <= sx + 60; x++) {
            if (x < 0 || x >= W) continue;
            const k = 1 - U.smooth(U.clamp((Math.abs(x - sx) - 28) / 32, 0, 1));
            h[x] = U.lerp(h[x], target, k);
          }
        }
      }
      // clamp heights
      const minY = H * 0.2, maxY = t === 'canyon' ? H - 40 : H * 0.93;
      for (let x = 0; x < W; x++) h[x] = U.clamp(h[x], minY, t === 'islands' ? H + 300 : maxY);

      // fill mask
      const m = this.mask;
      for (let x = 0; x < W; x++) {
        const top = Math.ceil(h[x]);
        for (let y = Math.max(0, top); y < H; y++) m[y * W + x] = 1;
      }

      // bedrock floor (not in sky worlds)
      if (!level.void) {
        for (let y = H - 22; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = 2;
      }

      const f = level.features || {};
      // floating islands (sky world / platforms)
      if (t === 'islands') {
        for (const s of spawns) this._island(s.x, s.y || r.range(430, 650), r.range(200, 290), r.range(60, 110), r);
        const extra = r.int(3, 6);
        for (let i = 0; i < extra; i++) {
          const x = r.range(W * 0.2, W * 0.8);
          if (spawns.some((s) => Math.abs(s.x - x) < 200)) continue;
          this._island(x, r.range(300, 700), r.range(110, 220), r.range(40, 80), r);
        }
      }
      if (f.platforms) {
        for (let i = 0; i < f.platforms; i++) {
          const x = r.range(W * 0.25, W * 0.75);
          const gy = h[x | 0];
          this._island(x, Math.min(gy - 170, r.range(280, 460)), r.range(90, 160), r.range(26, 44), r);
        }
      }
      // tunnels through hills
      if (f.tunnels) {
        for (let i = 0; i < f.tunnels; i++) {
          let x = r.range(W * 0.28, W * 0.4);
          let y = h[x | 0] + r.range(50, 110);
          const len = r.range(W * 0.25, W * 0.42);
          const rad = r.range(22, 30);
          let a = r.range(-0.2, 0.2);
          for (let d = 0; d < len; d += 6) {
            this._carveMask(x, y, rad);
            a += r.range(-0.08, 0.08);
            a = U.clamp(a, -0.35, 0.35);
            x += Math.cos(a) * 6;
            y += Math.sin(a) * 6;
            if (y > H - 60) y = H - 60, a = -0.2;
          }
        }
      }
      // deep pits between tanks
      if (f.pits) {
        const made = [];
        for (let i = 0; i < f.pits * 4 && made.length < f.pits; i++) {
          const x = r.range(W * 0.25, W * 0.75);
          if (spawns.some((s) => Math.abs(s.x - x) < 130) || made.some((p) => Math.abs(p - x) < 180)) continue;
          made.push(x);
          const w = r.range(34, 55);
          const depth = r.range(170, 300);
          for (let y = h[x | 0] - 20; y < h[x | 0] + depth; y += 8) this._carveMask(x + Math.sin(y * 0.03) * 8, y, w);
        }
      }
      // underground caves
      if (f.caves) {
        for (let i = 0; i < f.caves; i++) {
          const x = r.range(W * 0.2, W * 0.8);
          const y = h[x | 0] + r.range(90, 190);
          for (let k = 0; k < 6; k++) this._carveMask(x + r.range(-60, 60), y + r.range(-25, 25), r.range(25, 45));
        }
      }
      // pre-made craters (wasteland)
      if (f.craters) {
        for (let i = 0; i < f.craters; i++) {
          const x = r.range(W * 0.1, W * 0.9);
          if (spawns.some((s) => Math.abs(s.x - x) < 90)) continue;
          this._carveMask(x, h[x | 0] - 5, r.range(30, 70));
        }
      }
      // bunker: carve a cave around an enemy spawn with an opening toward the player
      if (f.bunker && level.spawns.enemies.length) {
        const e = level.spawns.enemies[0];
        const ex = e.x | 0;
        // raise a mound over the enemy
        for (let x = ex - 150; x < ex + 150; x++) {
          if (x < 0 || x >= W) continue;
          const k = Math.cos(((x - ex) / 150) * Math.PI * 0.5);
          const top = Math.ceil(h[x] - 120 * k);
          for (let y = Math.max(0, top); y < h[x]; y++) m[y * W + x] = 1;
          h[x] = Math.min(h[x], top);
        }
        const floor = h[ex] + 120 - 10;
        for (let k = -50; k <= 50; k += 6) this._carveMask(ex + k, floor - 34, 34);
        // opening toward the player side
        const dir = level.spawns.player.x < ex ? -1 : 1;
        for (let k = 0; k < 150; k += 6) this._carveMask(ex + dir * (40 + k), floor - 36 - k * 0.15, 28);
        e.y = floor - 30;
      }
      // metal blocks & girders (industrial)
      if (f.metal) {
        for (let i = 0; i < f.metal; i++) {
          const x = r.range(W * 0.3, W * 0.7) | 0;
          if (spawns.some((s) => Math.abs(s.x - x) < 120)) continue;
          const gy = this.surfaceY(x, 0);
          if (r() < 0.55) this._metalRect(x - 14, gy - r.range(80, 160), 28, 200); // pillar
          else this._metalRect(x - 70, gy - r.range(160, 260), 140, 16); // girder
        }
      }
      this.paint(level);
    }

    _carveMask(cx, cy, rad) {
      const W = this.W, H = this.H, m = this.mask;
      const r2 = rad * rad;
      for (let y = Math.max(0, (cy - rad) | 0); y <= Math.min(H - 1, (cy + rad) | 0); y++)
        for (let x = Math.max(0, (cx - rad) | 0); x <= Math.min(W - 1, (cx + rad) | 0); x++)
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2 && m[y * W + x] === 1) m[y * W + x] = 0;
    }
    _metalRect(x0, y0, w, hh) {
      const W = this.W, H = this.H, m = this.mask;
      for (let y = Math.max(0, y0 | 0); y < Math.min(H, (y0 + hh) | 0); y++)
        for (let x = Math.max(0, x0 | 0); x < Math.min(W, (x0 + w) | 0); x++) m[y * W + x] = 2;
    }
    _island(cx, topY, w, thick, r) {
      const W = this.W, H = this.H, m = this.mask;
      const n = U.noise1D(r.int(1, 1e6), 22);
      for (let x = Math.max(0, (cx - w / 2) | 0); x < Math.min(W, (cx + w / 2) | 0); x++) {
        const k = (x - cx) / (w / 2);
        const edge = Math.sqrt(Math.max(0, 1 - k * k));
        const top = topY + (1 - edge) * 26 + n(x) * 3;
        const bot = topY + 10 + thick * Math.pow(edge, 0.7) * (0.8 + 0.4 * Math.abs(n(x + 500)));
        for (let y = Math.max(0, top | 0); y < Math.min(H, bot | 0); y++) m[y * W + x] = 1;
      }
    }

    /** topmost solid y per column, cached until the ground changes */
    tops() {
      if (this._tops && this._topsVer === this.ver) return this._tops;
      const W = this.W, H = this.H, m = this.mask;
      const a = this._tops || (this._tops = new Int16Array(W));
      for (let x = 0; x < W; x++) {
        let y = 0;
        while (y < H && !m[y * W + x]) y++;
        a[x] = y;
      }
      this._topsVer = this.ver;
      return a;
    }

    /** paint the mask into textured canvases */
    paint() {
      const W = this.W, H = this.H, m = this.mask;
      const T = this.theme.terrain;
      const tr = U.hexToRgb(T.top);
      const snowy = tr[0] > 215 && tr[1] > 225 && tr[2] > 225;
      const grassy = !snowy && tr[1] > tr[0] + 15 && tr[1] > tr[2];
      const sandy = !grassy && !snowy && tr[0] > 200 && tr[1] > 165;
      this.style = grassy ? 'grass' : snowy ? 'snow' : sandy ? 'sand' : 'rock';
      const top = U.hexToRgb(T.top), top2 = U.hexToRgb(T.top2 || U.shade(T.top, 0.25));
      const edge = U.hexToRgb(U.shade(T.top, -0.35));
      const s0 = U.hexToRgb(T.soil[0]), s1 = U.hexToRgb(T.soil[1]), s2 = U.hexToRgb(T.soil[2]);
      const speck = U.hexToRgb(T.speck || U.shade(T.soil[0], 0.2));
      const metal = U.hexToRgb(T.metal || '#7c8594');
      const bed = U.hexToRgb(T.bedrock || '#2b2522');
      const img = this.ctx.createImageData(W, H);
      const hard = this.hctx.createImageData(W, H);
      const d = img.data, hd = hard.data;
      const topDepth = T.topDepth || 10;
      const art = this.theme.art || {};
      const tint = art.tint || null; // scene light colour multiplier [r,g,b]
      const DEEP = art.deep == null ? 0.35 : art.deep;
      const colN = U.noise1D(77, 40);
      const NA = noiseTile(16, 1), NB = noiseTile(5, 2);
      let anyHard = false;
      for (let x = 0; x < W; x++) {
        let depth = -1;
        const gd = topDepth + ((U.hash2(x, 1) * 4) | 0) + colN(x) * 3;
        const bandOff = colN(x + 999) * 14;
        const blade = (U.hash2(x, 7) - 0.5) * 26;
        for (let y = 0; y < H; y++) {
          const idx = y * W + x;
          const v = m[idx];
          if (!v) {
            depth = -1;
            continue;
          }
          depth = depth < 0 ? 0 : depth + 1;
          const p = idx * 4;
          const ti = ((y & 255) << 8) | (x & 255);
          const na = NA[ti], nb = NB[((y >> 1 & 255) << 8) | ((x >> 1) & 255)];
          const nz = (U.hash2(x, y) - 0.5) * 14 + (nb - 0.5) * 16;
          if (v === 2) {
            anyHard = true;
            let c;
            if (y >= H - 22) {
              c = bed;
              const k = (U.hash2(x >> 2, y >> 2) - 0.5) * 30 + (na - 0.5) * 20;
              hd[p] = c[0] + k; hd[p + 1] = c[1] + k; hd[p + 2] = c[2] + k;
            } else {
              // riveted steel plates with bevelled edges and streaky wear
              c = metal;
              const gx = x % 36, gy = y % 36;
              let k = nz * 0.35 + (na - 0.5) * 18 + (gy < 2 || gx < 2 ? -40 : 0) + (gy === 2 || gx === 2 ? 26 : 0) + (gy > 33 || gx > 33 ? -18 : 0) + (gy < 6 ? 14 : 0);
              if ((gx === 6 || gx === 30) && (gy === 6 || gy === 30)) k += 50;
              if ((gx === 7 || gx === 31) && (gy === 7 || gy === 31)) k -= 30;
              k += (U.hash2(x, y >> 3) - 0.5) * 10;
              hd[p] = c[0] + k; hd[p + 1] = c[1] + k; hd[p + 2] = c[2] + k + 6;
            }
            hd[p + 3] = 255;
            continue;
          }
          let R, G, B;
          if (depth < gd) {
            const c = depth < 2 ? top2 : depth >= gd - 2 ? edge : top;
            let k = nz;
            if (grassy) k += blade * (1 - depth / gd) + (depth < 4 ? 8 : 0);
            else if (sandy) k += Math.sin(x * 0.32 + y * 0.9 + na * 6) * 7;
            else if (snowy) k = k * 0.4 + (depth > gd * 0.6 ? -14 : 6);
            R = c[0] + k; G = c[1] + k; B = c[2] + (snowy ? k * 0.3 + 6 : k * 0.6);
          } else {
            const dd = depth - gd;
            const tt = Math.min(1, dd / 320);
            let a, b, k;
            if (tt < 0.5) { a = s0; b = s1; k = tt * 2; } else { a = s1; b = s2; k = (tt - 0.5) * 2; }
            R = a[0] + (b[0] - a[0]) * k; G = a[1] + (b[1] - a[1]) * k; B = a[2] + (b[2] - a[2]) * k;
            // strata: wavy sediment layers of different tone with thin lighter seams
            const sy = (y + bandOff + (na - 0.5) * 40) * 0.05;
            const sv = Math.sin(sy);
            const band = sv > 0.55 ? (sandy ? -7 : -14) : sv < -0.75 ? (sandy ? 4 : 9) : 0;
            const seamL = Math.abs(sv - 0.55) < 0.05 ? 10 : 0;
            const blot = (na - 0.5) * (sandy ? 14 : 26);
            R += nz + band + seamL + blot; G += nz + band + seamL + blot * 0.9; B += nz * 0.8 + band + seamL * 0.7 + blot * 0.7;
            if (U.hash2(x >> 1, y >> 1) < 0.006) { R = speck[0]; G = speck[1]; B = speck[2]; }
            // ambient occlusion right under the topsoil
            if (dd < 7) { const o = 0.72 + dd * 0.04; R *= o; G *= o; B *= o; }
            // deep ground sinks into shadow so the surface reads first
            const deep = 1 - DEEP * Math.min(1, dd / 300);
            R *= deep; G *= deep; B *= deep;
          }
          if (tint) { R *= tint[0]; G *= tint[1]; B *= tint[2]; }
          // cave ceilings and overhangs are in shadow
          if (y + 1 < H && !m[idx + W]) { R *= 0.62; G *= 0.62; B *= 0.62; }
          else if (y + 3 < H && !m[idx + W * 3]) { R *= 0.82; G *= 0.82; B *= 0.82; }
          d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
        }
      }
      this.ctx.putImageData(img, 0, 0);
      if (anyHard) {
        this.hctx.putImageData(hard, 0, 0);
        this.hasHard = true;
      }
      this._decorate(T, topDepth);
      // dirt pattern for dirt bombs
      const pc = document.createElement('canvas');
      pc.width = pc.height = 48;
      const px = pc.getContext('2d');
      px.fillStyle = T.soil[0];
      px.fillRect(0, 0, 48, 48);
      for (let i = 0; i < 90; i++) {
        px.fillStyle = Math.random() < 0.5 ? U.shade(T.soil[0], -0.15) : U.shade(T.soil[0], 0.12);
        px.fillRect(Math.random() * 48, Math.random() * 48, 2, 2);
      }
      this.dirtPattern = this.ctx.createPattern(pc, 'repeat');
    }

    /** stones, roots and surface vegetation painted over the soil texture */
    _decorate(T, topDepth) {
      const W = this.W, H = this.H, m = this.mask, c = this.ctx;
      const r = U.rng(W * 131 + H * 7 + (T.soil[0].charCodeAt(1) || 0));
      const tops = this.tops();
      const solid = (x, y) => x >= 0 && x < W && y >= 0 && y < H && m[(y | 0) * W + (x | 0)] === 1;
      c.save();
      c.globalCompositeOperation = 'source-atop';
      // embedded stones and pebbles
      const stoneBase = U.mix(T.soil[1], '#8c8a86', 0.55);
      const nStones = Math.round((W * H) / 5200);
      for (let i = 0; i < nStones; i++) {
        const x = r() * W, y = r() * H;
        if (!solid(x, y) || !solid(x, y - topDepth - 6)) continue;
        const rr = r.range(1, r() < 0.08 ? 5.5 : 2.8);
        const rot = r.range(0, 3);
        const tone = U.shade(stoneBase, r.range(-0.2, 0.08));
        const g = c.createRadialGradient(x - rr * 0.35, y - rr * 0.4, rr * 0.1, x, y, rr * 1.1);
        g.addColorStop(0, U.shade(tone, 0.2));
        g.addColorStop(0.7, tone);
        g.addColorStop(1, U.shade(tone, -0.4));
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.beginPath();
        c.ellipse(x + 0.6, y + 0.8, rr * 1.25, rr * 0.85, rot, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(x, y, rr * 1.2, rr * 0.8, rot, 0, Math.PI * 2);
        c.fill();
      }
      // roots reaching down from the grass
      if (this.style === 'grass') {
        c.strokeStyle = U.rgba(U.shade(T.soil[0], -0.35), 0.75);
        c.lineCap = 'round';
        for (let x = r.range(5, 40); x < W; x += r.range(18, 60)) {
          const y0 = tops[x | 0] + topDepth;
          if (y0 > H - 40 || !solid(x, y0 + 4)) continue;
          for (let k = 0; k < r.int(1, 3); k++) {
            let px = x, py = y0, a = Math.PI / 2 + r.range(-0.7, 0.7);
            c.lineWidth = r.range(0.8, 1.8);
            c.beginPath();
            c.moveTo(px, py);
            const len = r.range(12, 46);
            for (let s = 0; s < len; s += 4) {
              a += r.range(-0.35, 0.35);
              px += Math.cos(a) * 4;
              py += Math.sin(a) * 4;
              c.lineTo(px, py);
            }
            c.stroke();
          }
        }
      }
      c.restore();
      // surface fringe on every upward-facing ground edge
      if (this.style !== 'grass' && this.style !== 'snow') return;
      const cols = this.style === 'grass'
        ? [U.shade(T.top, -0.28), T.top, T.top2 || U.shade(T.top, 0.25)]
        : ['#e8f4ff', '#ffffff', '#d6ebfa'];
      const paths = [new Path2D(), new Path2D(), new Path2D()];
      for (let x = 0; x < W; x++) {
        for (let y = 1; y < H - 22; y++) {
          if (m[y * W + x] !== 1 || m[(y - 1) * W + x]) continue;
          if (this.style === 'grass') {
            const n = 1 + ((U.hash2(x, y) * 2) | 0);
            for (let k = 0; k < n; k++) {
              const h = 2 + U.hash2(x + k * 31, y) * 5;
              const lean = (U.hash2(x, y + k) - 0.5) * 3;
              const pth = paths[((U.hash2(x * 3 + k, y) * 3) | 0)];
              pth.moveTo(x - 0.6, y + 1.5);
              pth.quadraticCurveTo(x + lean * 0.4, y - h * 0.5, x + lean, y - h);
              pth.lineTo(x + 0.6, y + 1.5);
            }
          } else if (x % 3 === 0) {
            // soft snow lip
            const pth = paths[(U.hash2(x, y) * 3) | 0];
            pth.moveTo(x - 2, y + 1);
            pth.quadraticCurveTo(x, y - 2 - U.hash2(x, y) * 1.5, x + 2, y + 1);
          }
        }
      }
      for (let i = 0; i < 3; i++) {
        c.fillStyle = cols[i];
        c.fill(paths[i]);
      }
    }
  }
  GT.Terrain = Terrain;

  /* ================================================================
   * Ballistic simulation (used by AI and aim preview)
   * opts: {x,y,vx,vy,g,wind,terrain,tanks,ignore,maxT,ghost,collect}
   * returns {x,y,t,tank,path,out}
   * ================================================================ */
  Physics.simulate = function (o) {
    const dt = 1 / 60;
    let x = o.x, y = o.y, vx = o.vx, vy = o.vy;
    const g = o.g, wa = o.wind || 0;
    const T = o.terrain;
    const path = o.collect ? [] : null;
    const maxT = o.maxT || 9;
    let t = 0;
    while (t < maxT) {
      vy += g * dt;
      vx += wa * dt;
      const nx = x + vx * dt, ny = y + vy * dt;
      // tank collision (sampled at segment end and middle)
      if (o.tanks) {
        for (const tk of o.tanks) {
          if (!tk.alive || tk === o.ignore) continue;
          if (GT.Physics.hitTank(tk, nx, ny) || GT.Physics.hitTank(tk, (x + nx) / 2, (y + ny) / 2)) {
            return { x: nx, y: ny, t, tank: tk, path };
          }
        }
      }
      if (!(o.ghost && vy < 0)) {
        const hit = T.rayHit(x, y, nx, ny, 4);
        if (hit) return { x: hit.x, y: hit.y, t, tank: null, path };
      }
      x = nx;
      y = ny;
      t += dt;
      if (path) path.push(x, y);
      if (x < -250 || x > T.W + 250 || y > T.H + 60) return { x, y, t, tank: null, path, out: true };
    }
    return { x, y, t, tank: null, path, out: true };
  };

  /** point inside tank hitbox (ellipse around hull) */
  Physics.hitTank = function (tk, px, py) {
    const s = tk.scale;
    const hw = 30 * s, hh = 19 * s;
    const cx = tk.x, cy = tk.y - 15 * s;
    const dx = (px - cx) / hw, dy = (py - cy) / hh;
    return dx * dx + dy * dy <= 1;
  };

  /** distance from point to tank hull surface (0 when inside) */
  Physics.distToTank = function (tk, px, py) {
    const s = tk.scale;
    const cx = tk.x, cy = tk.y - 15 * s;
    const d = Math.hypot(px - cx, py - cy);
    return Math.max(0, d - 22 * s);
  };
})();

