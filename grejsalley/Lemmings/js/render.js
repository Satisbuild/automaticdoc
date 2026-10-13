/* GrejsAlley Lemmings — render.js
 * Canvas rendering: parallax background, pixel terrain (colorized per theme),
 * hazards, hatch/exit, lemmings (drawn procedurally), particles and minimap.
 */
(function (GL) {
  'use strict';
  const { hash2, noise1, noise2 } = GL.noise;
  const MAT = GL.MAT;

  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

  // Lemming palette (the "grejs" look: orange beanie, teal jumper)
  const LC = {
    hat: '#ff8a1f', hatDark: '#d4610b', pom: '#fff4e0', skin: '#ffd2a6', skinDark: '#e9a978',
    shirt: '#1fb5a5', shirtDark: '#148a7e', pants: '#2f3e74', shoe: '#2a1d16', eye: '#1b1b2a',
    outline: 'rgba(20,14,30,.55)',
  };

  class Renderer {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = Object.assign({ minimap: null, fx: true }, opts || {});
      this.dpr = 1;
      this.W = 1; this.H = 1;
      this.cam = { x: 0, y: 0, z: 2 };
      this.particles = [];
      this.ambient = [];
      this.time = 0;
      this.shake = 0;
      this.flash = 0;
      this.game = null;
    }

    /* ----------------------------- setup ----------------------------- */
    setGame(game) {
      this.game = game;
      this.themeId = GL.themeOf(game.def);
      this.theme = GL.THEMES[this.themeId];
      const T = game.terrain;
      this.terrainCanvas = makeCanvas(T.w, T.h);
      this.shadowCanvas = makeCanvas(T.w, T.h);
      this.tctx = this.terrainCanvas.getContext('2d');
      this.sctx = this.shadowCanvas.getContext('2d');
      this.timg = this.tctx.createImageData(T.w, T.h);
      // Remember the original top surfaces: only those get grass/snow, so
      // freshly dug faces look like bare earth.
      this.surf = new Uint8Array(T.w * T.h);
      for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) {
        if (T.data[y * T.w + x] !== MAT.DIRT) continue;
        for (let k = 1; k <= this.theme.topDepth; k++) if (!T.solid(x, y - k) || y - k < 0) { this.surf[y * T.w + x] = 1; break; }
      }
      this.simg = this.sctx.createImageData(T.w, T.h);
      this.paintTerrain(0, 0, T.w - 1, T.h - 1);
      this.particles.length = 0;
      this.initAmbient();
      this.resize();
      this.resetCamera();
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * this.dpr)), h = Math.max(1, Math.round(r.height * this.dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      this.W = w; this.H = h;
      if (this.game) { this.updateZoomLimits(); this.clampCamera(); }
    }

    updateZoomLimits() {
      const T = this.game.terrain;
      const fitH = this.H / T.h, fitW = this.W / T.w;
      this.minZ = Math.min(fitH, Math.max(fitW, fitH * 0.35));
      this.fitZ = fitH;
      this.maxZ = Math.max(fitH * 2.2, 6 * this.dpr);
      this.cam.z = Math.max(this.minZ, Math.min(this.maxZ, this.cam.z));
    }

    resetCamera() {
      const g = this.game;
      this.updateZoomLimits();
      // Fill the height, but on tall/narrow (portrait) screens keep enough of
      // the level visible horizontally to plan ahead.
      this.cam.z = Math.max(this.minZ, Math.min(this.fitZ, this.W / 240));
      const e = g.entrances[0];
      this.centerOn(e.x + 60, g.terrain.h / 2);
    }

    centerOn(x, y) {
      this.cam.x = x - this.W / this.cam.z / 2;
      this.cam.y = y - this.H / this.cam.z / 2;
      this.clampCamera();
    }

    clampCamera() {
      const T = this.game.terrain, z = this.cam.z;
      const vw = this.W / z, vh = this.H / z;
      if (vw >= T.w) this.cam.x = (T.w - vw) / 2;
      else this.cam.x = Math.max(0, Math.min(T.w - vw, this.cam.x));
      if (vh >= T.h) this.cam.y = (T.h - vh) / 2;
      else this.cam.y = Math.max(0, Math.min(T.h - vh, this.cam.y));
    }

    zoomAt(sx, sy, factor) {
      const before = this.screenToLevel(sx, sy);
      this.cam.z = Math.max(this.minZ, Math.min(this.maxZ, this.cam.z * factor));
      this.cam.x = before.x - sx * this.dpr / this.cam.z;
      this.cam.y = before.y - sy * this.dpr / this.cam.z;
      this.clampCamera();
    }

    // CSS pixel coords inside the canvas -> level coords
    screenToLevel(sx, sy) {
      return { x: sx * this.dpr / this.cam.z + this.cam.x, y: sy * this.dpr / this.cam.z + this.cam.y };
    }

    /* ------------------------- terrain painting ------------------------- */
    paintTerrain(x0, y0, x1, y1) {
      const T = this.game.terrain, th = this.theme, seed = this.game.level.seed;
      const W = T.w, D = T.data, td = this.timg.data, sd = this.simg.data;
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(T.h - 1, y1);
      const blades = this.themeId === 'hills' || this.themeId === 'caves';
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * W + x, o = i * 4, m = D[i];
          let c = null, a = 255;
          if (m === MAT.AIR) {
            // Decorative grass blades / moss just above dirt surfaces (no collision).
            if (blades) {
              const bh = hash2(x, 7, seed) < 0.55 ? 1 + ((hash2(x, 9, seed) * 3) | 0) : 0;
              for (let k = 1; k <= bh; k++) {
                const below = y + k < T.h ? D[(y + k) * W + x] : 0;
                if (below === MAT.DIRT && this.surf[(y + k) * W + x]) { c = mix(th.top[0], th.top[1], k / 3 + hash2(x, y, 3) * 0.3); a = 230; break; }
                if (below !== MAT.AIR) break;
              }
            }
            if (!c) { td[o + 3] = 0; sd[o + 3] = 0; continue; }
          } else if (m === MAT.DIRT) {
            c = dirtColor(x, y, T, th, seed, this.surf[i]);
          } else if (m === MAT.STEEL) {
            c = steelColor(x, y, T, th);
          } else {
            c = brickColor(x, y, T, th);
          }
          td[o] = c[0]; td[o + 1] = c[1]; td[o + 2] = c[2]; td[o + 3] = a;
          sd[o] = 10; sd[o + 1] = 6; sd[o + 2] = 20; sd[o + 3] = m === MAT.AIR ? 0 : 90;
        }
      }
      this.tctx.putImageData(this.timg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
      this.sctx.putImageData(this.simg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    }

    flushTerrain() {
      const d = this.game.terrain.dirty;
      if (!d) return;
      this.game.terrain.dirty = null;
      this.paintTerrain(d.x0 - 4, d.y0 - 4, d.x1 + 4, d.y1 + 4);
    }

    /* ------------------------------ particles ----------------------------- */
    handleEvents(events) {
      const th = this.theme;
      const dirt = () => rgb(th.dirt[(Math.random() * th.dirt.length) | 0]);
      for (const e of events) {
        switch (e.type) {
          case 'dig': this.burst(e.x + (e.lem ? e.lem.dir * 4 : 0), e.y - 3, 4, dirt, 0.8, 0.25); break;
          case 'brick': this.burst(e.x + (e.lem ? e.lem.dir * 3 : 0), e.y - 1, 2, () => rgb(th.brick[0]), 0.4, 0.15); break;
          case 'explode':
            this.burst(e.x, e.y - 5, 34, dirt, 2.6, 0.55);
            this.burst(e.x, e.y - 5, 14, () => ['#fff3b0', '#ffb347', '#ff6b3d'][(Math.random() * 3) | 0], 2.2, 0.2, 'spark');
            this.particles.push({ x: e.x, y: e.y - 5, vx: 0, vy: 0, life: 1, max: 1, kind: 'ring', size: 1 });
            this.shake = Math.max(this.shake, 6); this.flash = 0.35;
            break;
          case 'saved': this.burst(e.x, e.y - 8, 12, () => ['#ffe28a', '#8affc1', '#ff9be0', '#9fd6ff'][(Math.random() * 4) | 0], 1.2, 0.08, 'spark'); break;
          case 'splat': this.burst(e.x, e.y - 2, 14, () => ['#ffffff', '#ffd2a6', '#ff8a1f'][(Math.random() * 3) | 0], 1.3, 0.3, 'puff'); break;
          case 'drown': this.burst(e.x, e.y - 3, 12, () => 'rgba(190,230,255,.9)', 1.3, 0.3); break;
          case 'burn': this.burst(e.x, e.y - 3, 14, () => ['#ffd36b', '#ff7b2e', '#ff4b2b'][(Math.random() * 3) | 0], 1.2, -0.05, 'spark'); break;
          case 'die': if (e.cause === 'fell') break; this.burst(e.x, e.y - 4, 8, () => '#ffffff', 1, 0.1, 'puff'); break;
          case 'steel': this.burst(e.x + (e.lem ? e.lem.dir * 4 : 0), e.y - 5, 6, () => '#fff8c0', 1.4, 0.2, 'spark'); break;
          case 'assign': this.particles.push({ x: e.x, y: e.y - 5, vx: 0, vy: 0, life: 0.45, max: 0.45, kind: 'ping', size: 1 }); break;
        }
      }
    }

    burst(x, y, n, colorFn, speed, grav, kind) {
      if (!this.opts.fx) n = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
        const life = 0.4 + Math.random() * 0.6;
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.6, grav, life, max: life, color: colorFn(), kind: kind || 'chunk', size: kind === 'puff' ? 1.6 : 1 });
      }
      if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    }

    updateParticles(dt) {
      const ps = this.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        p.x += p.vx * dt * 30; p.y += p.vy * dt * 30;
        if (p.grav !== undefined) p.vy += p.grav * dt * 30;
        if (p.kind === 'puff') { p.vx *= 0.92; p.vy *= 0.92; }
      }
      this.shake = Math.max(0, this.shake - dt * 30);
      this.flash = Math.max(0, this.flash - dt);
    }

    initAmbient() {
      this.ambient.length = 0;
      const n = this.opts.fx ? 36 : 0;
      for (let i = 0; i < n; i++) this.ambient.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), p: Math.random() * 6.28 });
    }

    /* -------------------------------- draw -------------------------------- */
    draw(dt, alpha, ui) {
      const g = this.game; if (!g) return;
      const ctx = this.ctx, z = this.cam.z;
      this.time += dt;
      this.updateParticles(dt);
      this.flushTerrain();

      let sx = 0, sy = 0;
      if (this.shake > 0 && this.opts.fx) { sx = (Math.random() - 0.5) * this.shake * this.dpr; sy = (Math.random() - 0.5) * this.shake * this.dpr; }

      this.drawBackground(ctx);
      ctx.save();
      ctx.translate(sx, sy);
      const ox = -this.cam.x * z, oy = -this.cam.y * z;
      const T = g.terrain;
      ctx.imageSmoothingEnabled = false;

      this.drawHazards(ctx, ox, oy, z, false);
      // terrain shadow + terrain
      const sh = Math.max(1, Math.round(1.5 * this.dpr));
      ctx.drawImage(this.shadowCanvas, ox + sh, oy + sh, T.w * z, T.h * z);
      ctx.drawImage(this.terrainCanvas, ox, oy, T.w * z, T.h * z);

      for (const e of g.entrances) this.drawHatch(ctx, e, ox, oy, z, g.hatchOpen);
      for (const e of g.exits) this.drawExit(ctx, e, ox, oy, z);

      // lemmings
      const hover = ui && ui.hover;
      for (const L of g.lemmings) {
        if (!L.alive) continue;
        let lx = L.x, ly = L.y;
        if (Math.abs(L.x - L.px) <= 3 && Math.abs(L.y - L.py) <= 4) { lx = L.px + (L.x - L.px) * alpha; ly = L.py + (L.y - L.py) * alpha; }
        this.drawLemming(ctx, L, ox + (lx + 0.5) * z, oy + ly * z, z);
      }
      this.drawHazards(ctx, ox, oy, z, true);
      this.drawParticles(ctx, ox, oy, z);

      if (hover && hover.alive) this.drawSelector(ctx, hover, ox, oy, z, ui.canAssign);
      ctx.restore();

      this.drawAmbient(ctx, dt);
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,240,200,${this.flash * 0.5})`; ctx.fillRect(0, 0, this.W, this.H); }
      // dark edges outside the level (bottom = the void)
      const bottom = oy + T.h * z;
      if (bottom < this.H) {
        const gr = ctx.createLinearGradient(0, bottom, 0, this.H);
        gr.addColorStop(0, 'rgba(8,6,16,.0)'); gr.addColorStop(0.3, 'rgba(8,6,16,.75)'); gr.addColorStop(1, 'rgba(8,6,16,.95)');
        ctx.fillStyle = gr; ctx.fillRect(0, bottom, this.W, this.H - bottom);
      }
    }

    drawBackground(ctx) {
      const th = this.theme, W = this.W, H = this.H, d = this.dpr;
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.55, th.sky[1]); sky.addColorStop(1, th.sky[2]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      const camPx = this.cam.x * this.cam.z / d; // camera in CSS px
      if (th.sun) {
        const s = th.sun, x = W * s.x - camPx * 0.04 * d, y = H * s.y;
        const gl = ctx.createRadialGradient(x, y, 0, x, y, s.r * 3.2 * d);
        gl.addColorStop(0, s.glow); gl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - s.r * 4 * d, y - s.r * 4 * d, s.r * 8 * d, s.r * 8 * d);
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x, y, s.r * d, 0, 7); ctx.fill();
      }
      if (this.themeId === 'caves') {
        // faint glowing stars/crystals in the dark
        for (let i = 0; i < 60; i++) {
          const x = ((hash2(i, 1, 5) * W * 1.5 - camPx * 0.05 * d) % W + W) % W, y = hash2(i, 2, 5) * H * 0.7;
          ctx.fillStyle = `rgba(160,220,255,${0.15 + 0.25 * Math.sin(this.time * 1.5 + i)})`;
          ctx.fillRect(x, y, 2 * d, 2 * d);
        }
      }
      if (th.clouds) {
        for (let i = 0; i < 6; i++) {
          const w = (60 + hash2(i, 3, 1) * 80) * d;
          const span = W + w * 2;
          const x = (((hash2(i, 4, 1) * span + this.time * (6 + i * 2) * d - camPx * 0.06 * d) % span) + span) % span - w;
          const y = (0.06 + hash2(i, 5, 1) * 0.3) * H;
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          ctx.beginPath();
          ctx.ellipse(x, y, w * 0.5, w * 0.16, 0, 0, 7);
          ctx.ellipse(x - w * 0.2, y + w * 0.02, w * 0.25, w * 0.13, 0, 0, 7);
          ctx.ellipse(x + w * 0.15, y - w * 0.06, w * 0.24, w * 0.16, 0, 0, 7);
          ctx.fill();
        }
      }
      for (const layer of th.layers) this.drawLayer(ctx, layer, camPx);
    }

    drawLayer(ctx, L, camPx) {
      const W = this.W, H = this.H, d = this.dpr;
      const off = camPx * L.factor;
      const step = 4 * d;
      const hAt = u => {
        if (L.factory) {
          const b = Math.floor(u / 46);
          const bh = 0.5 + hash2(b, 1, L.seed) * 0.9;
          return H * (L.base - L.amp * 2.2 * bh);
        }
        let n = noise1(u * L.freq, L.seed) * 0.65 + noise1(u * L.freq * 2.3, L.seed + 1) * 0.35;
        if (L.peaks) n = Math.pow(n, 1.6) * 1.4;
        return H * (L.base - L.amp * n);
      };
      ctx.fillStyle = L.color;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + step; x += step) ctx.lineTo(x, hAt(x / d + off));
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // snow caps on mountain peaks
      if (L.snowcaps) {
        ctx.fillStyle = L.snowcaps;
        ctx.beginPath();
        for (let x = 0; x <= W + step; x += step) {
          const y = hAt(x / d + off);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (let x = W + step; x >= 0; x -= step) {
          const y = hAt(x / d + off);
          ctx.lineTo(x, Math.max(y, Math.min(y + 8 * d, H * (L.base - L.amp * 0.5))));
        }
        ctx.closePath(); ctx.fill();
      }

      // silhouettes of props along the layer
      const u0 = off, u1 = off + W / d;
      const spacing = L.factory ? 46 : 38;
      for (let k = Math.floor(u0 / spacing) - 1; k <= Math.ceil(u1 / spacing) + 1; k++) {
        const r = hash2(k, 11, L.seed);
        const u = k * spacing + hash2(k, 12, L.seed) * spacing * 0.6;
        const x = (u - off) * d, y = hAt(u) + 1 * d;
        if (L.trees && r < 0.5) {
          const s = (6 + hash2(k, 13, L.seed) * 6) * d;
          ctx.fillStyle = L.trees;
          ctx.fillRect(x - s * 0.12, y - s * 1.4, s * 0.24, s * 1.4);
          ctx.beginPath(); ctx.arc(x, y - s * 1.6, s * 0.8, 0, 7); ctx.fill();
        } else if (L.pines && r < 0.6) {
          const s = (8 + hash2(k, 13, L.seed) * 8) * d;
          ctx.fillStyle = L.pines;
          ctx.beginPath(); ctx.moveTo(x, y - s * 2.2); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x - s * 0.7, y); ctx.closePath(); ctx.fill();
        } else if (L.cacti && r < 0.35) {
          const s = (6 + hash2(k, 13, L.seed) * 6) * d;
          ctx.fillStyle = L.cacti;
          roundRectPath(ctx, x - s * 0.18, y - s * 1.8, s * 0.36, s * 1.8, s * 0.18); ctx.fill();
          roundRectPath(ctx, x - s * 0.7, y - s * 1.3, s * 0.3, s * 0.7, s * 0.15); ctx.fill();
          ctx.fillRect(x - s * 0.7, y - s * 0.75, s * 0.6, s * 0.22);
          roundRectPath(ctx, x + s * 0.4, y - s * 1.5, s * 0.3, s * 0.8, s * 0.15); ctx.fill();
          ctx.fillRect(x + s * 0.1, y - s * 0.85, s * 0.6, s * 0.22);
        } else if (L.pyramids && r < 0.18) {
          const s = (30 + hash2(k, 13, L.seed) * 30) * d;
          ctx.fillStyle = L.pyramids;
          ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 1.1, y + 4 * d); ctx.lineTo(x - s * 1.1, y + 4 * d); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,.08)';
          ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 1.1, y + 4 * d); ctx.lineTo(x + s * 0.15, y + 4 * d); ctx.closePath(); ctx.fill();
        } else if (L.factory && r < 0.45) {
          const s = 6 * d;
          ctx.fillStyle = L.color;
          ctx.fillRect(x, y - s * 4.5, s * 1.1, s * 4.5);
          if (this.opts.fx) {
            const t = this.time;
            for (let j = 0; j < 3; j++) {
              const ph = (t * 0.25 + j / 3 + r) % 1;
              ctx.fillStyle = `rgba(200,190,210,${0.25 * (1 - ph)})`;
              ctx.beginPath(); ctx.arc(x + s * 0.55 + ph * 14 * d, y - s * 4.8 - ph * 30 * d, (3 + ph * 8) * d, 0, 7); ctx.fill();
            }
          }
        }
        if (L.lights && r > 0.5) {
          const on = Math.sin(this.time * 2 + k) > -0.2;
          ctx.fillStyle = on ? L.lights : 'rgba(255,211,107,.25)';
          ctx.fillRect(x, y + 6 * d, 3 * d, 3 * d);
          ctx.fillRect(x + 8 * d, y + 6 * d, 3 * d, 3 * d);
        }
        if (L.crystals && r < 0.3) {
          const s = (3 + r * 8) * d, gl = 0.5 + 0.5 * Math.sin(this.time * 2 + k);
          ctx.fillStyle = `rgba(125,227,255,${0.25 + gl * 0.35})`;
          ctx.beginPath(); ctx.moveTo(x, y - s * 2.4); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x - s * 0.6, y); ctx.closePath(); ctx.fill();
        }
        if (L.stalactites && r < 0.7) {
          const s = (10 + r * 40) * d;
          ctx.fillStyle = L.color;
          ctx.beginPath(); ctx.moveTo(x - s * 0.18, 0); ctx.lineTo(x + s * 0.18, 0); ctx.lineTo(x, s * 1.3); ctx.closePath(); ctx.fill();
        }
        if (L.pipes && r < 0.25) {
          ctx.fillStyle = 'rgba(0,0,0,.18)';
          ctx.fillRect(x, y - 30 * d, 5 * d, 30 * d);
          ctx.fillRect(x, y - 30 * d, 20 * d, 5 * d);
        }
      }
    }

    drawAmbient(ctx, dt) {
      const kind = this.theme.ambient, W = this.W, H = this.H, d = this.dpr, t = this.time;
      for (const a of this.ambient) {
        if (kind === 'snow') {
          a.y += dt * 0.05 * a.s; a.x += Math.sin(t + a.p) * dt * 0.01;
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          ctx.beginPath(); ctx.arc(a.x * W, a.y * H, (1 + a.s) * d, 0, 7); ctx.fill();
        } else if (kind === 'leaves') {
          a.y += dt * 0.03 * a.s; a.x += dt * 0.02 + Math.sin(t * 1.3 + a.p) * dt * 0.01;
          ctx.save(); ctx.translate(a.x * W, a.y * H); ctx.rotate(t * a.s + a.p);
          ctx.fillStyle = a.s > 1 ? 'rgba(120,190,80,.6)' : 'rgba(240,170,60,.55)';
          ctx.beginPath(); ctx.ellipse(0, 0, 3 * d, 1.5 * d, 0, 0, 7); ctx.fill(); ctx.restore();
        } else if (kind === 'glow') {
          a.x += Math.sin(t * 0.5 + a.p) * dt * 0.01; a.y += Math.cos(t * 0.4 + a.p) * dt * 0.01;
          ctx.fillStyle = `rgba(160,255,200,${0.25 + 0.3 * Math.sin(t * 2 + a.p)})`;
          ctx.beginPath(); ctx.arc(a.x * W, a.y * H, 1.6 * d, 0, 7); ctx.fill();
        } else if (kind === 'dust') {
          a.x += dt * 0.04 * a.s; a.y += Math.sin(t + a.p) * dt * 0.005;
          ctx.fillStyle = 'rgba(255,240,210,.35)';
          ctx.fillRect(a.x * W, a.y * H, 2 * d, 1 * d);
        } else if (kind === 'smoke') {
          a.y -= dt * 0.012 * a.s; a.x += dt * 0.006;
          ctx.fillStyle = 'rgba(255,200,150,.18)';
          ctx.fillRect(a.x * W, a.y * H, 1.5 * d, 1.5 * d);
        }
        if (a.y > 1.05) { a.y = -0.05; a.x = Math.random(); }
        if (a.y < -0.05) { a.y = 1.05; a.x = Math.random(); }
        if (a.x > 1.05) a.x = -0.05;
        if (a.x < -0.05) a.x = 1.05;
      }
    }

    drawHazards(ctx, ox, oy, z, front) {
      const t = this.time;
      for (const h of this.game.hazards) {
        const c = GL.HAZARD_COLORS[h.type] || GL.HAZARD_COLORS.water;
        const x = ox + h.x * z, y = oy + h.y * z, w = h.w * z, hh = h.h * z;
        if (!front) {
          const gr = ctx.createLinearGradient(0, y, 0, y + hh);
          gr.addColorStop(0, c.a); gr.addColorStop(1, c.b);
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.moveTo(x, y + hh);
          for (let i = 0; i <= 24; i++) {
            const px = x + (w * i) / 24;
            ctx.lineTo(px, y + Math.sin(t * 2.4 + i * 0.9 + h.x) * z * 0.7);
          }
          ctx.lineTo(x + w, y + hh); ctx.closePath(); ctx.fill();
          if (h.type !== 'water') {
            // glow for lava / acid
            ctx.fillStyle = h.type === 'lava' ? 'rgba(255,140,60,.18)' : 'rgba(160,255,90,.14)';
            ctx.fillRect(x, y - 6 * z, w, 6 * z);
          }
        } else {
          // surface highlight + bubbles drawn above lemmings sinking in
          ctx.strokeStyle = c.top; ctx.lineWidth = Math.max(1, z * 0.6);
          ctx.beginPath();
          for (let i = 0; i <= 24; i++) {
            const px = x + (w * i) / 24, py = y + Math.sin(t * 2.4 + i * 0.9 + h.x) * z * 0.7;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
          if (h.type !== 'water') {
            for (let i = 0; i < Math.max(2, h.w / 12); i++) {
              const ph = (t * (0.5 + hash2(i, 1, h.x)) + hash2(i, 2, h.x)) % 1;
              const bx = x + hash2(i, 3, h.x) * w, by = y + (1 - ph) * Math.min(hh, 10 * z);
              ctx.fillStyle = c.top; ctx.globalAlpha = 1 - ph;
              ctx.beginPath(); ctx.arc(bx, by, z * (0.6 + ph), 0, 7); ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    drawHatch(ctx, e, ox, oy, z, open) {
      const th = this.theme;
      const x = ox + e.x * z, y = oy + e.y * z;
      const w = 22 * z, h = 9 * z, top = y - 18 * z;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      roundRectPath(ctx, x - w / 2 + z, top + z, w, h, 2 * z); ctx.fill();
      ctx.fillStyle = th.hatch;
      roundRectPath(ctx, x - w / 2, top, w, h, 2 * z); ctx.fill();
      ctx.fillStyle = th.hatchTrim;
      ctx.fillRect(x - w / 2, top + h - 2 * z, w, 1.4 * z);
      ctx.fillRect(x - w / 2 + 2 * z, top + 1.5 * z, w - 4 * z, 1 * z);
      // opening (dark) + two flaps
      const ow = 14 * z;
      ctx.fillStyle = '#120d1c';
      ctx.fillRect(x - ow / 2, top + h - 0.6 * z, ow, 2 * z);
      const ang = open * Math.PI * 0.36;
      ctx.fillStyle = th.hatchTrim;
      ctx.save(); ctx.translate(x - ow / 2, top + h + 0.6 * z); ctx.rotate(ang); ctx.fillRect(0, 0, ow * 0.3, 1.4 * z); ctx.restore();
      ctx.save(); ctx.translate(x + ow / 2, top + h + 0.6 * z); ctx.rotate(-ang); ctx.fillRect(-ow * 0.3, 0, ow * 0.3, 1.4 * z); ctx.restore();
      // little hinge lights
      ctx.fillStyle = open >= 1 ? '#8affc1' : '#ffcf4a';
      ctx.beginPath(); ctx.arc(x - w / 2 + 2.5 * z, top + h / 2, z * 0.9, 0, 7); ctx.arc(x + w / 2 - 2.5 * z, top + h / 2, z * 0.9, 0, 7); ctx.fill();
      ctx.restore();
    }

    drawExit(ctx, e, ox, oy, z) {
      const th = this.theme, t = this.time;
      const x = ox + e.x * z, y = oy + e.y * z;
      const w = 16 * z, h = 18 * z;
      ctx.save();
      // glow
      const gr = ctx.createRadialGradient(x, y - h * 0.45, 0, x, y - h * 0.45, h * 1.2);
      gr.addColorStop(0, hexA(th.exit.glow, 0.45 + 0.15 * Math.sin(t * 3)));
      gr.addColorStop(1, hexA(th.exit.glow, 0));
      ctx.fillStyle = gr; ctx.fillRect(x - h * 1.3, y - h * 1.8, h * 2.6, h * 2);
      // frame
      ctx.fillStyle = th.exit.frame;
      archPath(ctx, x, y, w + 4 * z, h + 3 * z); ctx.fill();
      // interior
      const ig = ctx.createLinearGradient(0, y - h, 0, y);
      ig.addColorStop(0, '#fffbe0'); ig.addColorStop(1, th.exit.glow);
      ctx.fillStyle = ig;
      archPath(ctx, x, y, w - 2 * z, h - 2 * z); ctx.fill();
      // swirl dots inside
      for (let i = 0; i < 5; i++) {
        const a = t * 2 + i * 1.26, r = (3 + i * 0.8) * z;
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.6, y - h * 0.45 + Math.sin(a) * r * 0.5, z * 0.7, 0, 7); ctx.fill();
      }
      // flag
      ctx.fillStyle = '#3b2c26';
      ctx.fillRect(x - 0.5 * z, y - h - 12 * z, 1.2 * z, 10 * z);
      ctx.fillStyle = th.exit.flag;
      ctx.beginPath();
      const fw = Math.sin(t * 6) * z;
      ctx.moveTo(x + 0.7 * z, y - h - 12 * z);
      ctx.quadraticCurveTo(x + 5 * z, y - h - 11 * z + fw, x + 9 * z, y - h - 10 * z);
      ctx.lineTo(x + 0.7 * z, y - h - 7 * z);
      ctx.closePath(); ctx.fill();
      // torches
      for (const s of [-1, 1]) {
        const tx = x + s * (w / 2 + 3 * z), ty = y - h * 0.55;
        ctx.fillStyle = '#4a3326'; ctx.fillRect(tx - 0.6 * z, ty, 1.2 * z, 5 * z);
        const fl = 1 + 0.25 * Math.sin(t * 14 + s * 3);
        ctx.fillStyle = '#ffb347';
        ctx.beginPath(); ctx.ellipse(tx, ty - 1.2 * z, 1.3 * z, 2.2 * z * fl, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath(); ctx.ellipse(tx, ty - 0.8 * z, 0.6 * z, 1.1 * z * fl, 0, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    drawParticles(ctx, ox, oy, z) {
      for (const p of this.particles) {
        const a = Math.max(0, p.life / p.max);
        const x = ox + p.x * z, y = oy + p.y * z;
        if (p.kind === 'ring') {
          const r = (1 - a) * 16 * z;
          ctx.strokeStyle = `rgba(255,230,160,${a})`; ctx.lineWidth = 2 * z * a + 0.5;
          ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
        } else if (p.kind === 'ping') {
          const r = (1 - a) * 9 * z + 3 * z;
          ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = z * 0.8;
          ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
        } else if (p.kind === 'puff') {
          ctx.globalAlpha = a * 0.8;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(x, y, z * (1 + (1 - a) * 2) * p.size, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (p.kind === 'spark') {
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.fillRect(x - z * 0.6, y - z * 0.6, z * 1.2, z * 1.2);
          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = Math.min(1, a * 1.5);
          ctx.fillStyle = p.color;
          ctx.fillRect(x - z * 0.5, y - z * 0.5, z, z);
          ctx.globalAlpha = 1;
        }
      }
    }

    drawSelector(ctx, L, ox, oy, z, ok) {
      const x = ox + (L.x + 0.5) * z, y = oy + (L.y - 5.5) * z;
      const s = 8 * z, k = 3 * z;
      ctx.strokeStyle = ok ? '#ffffff' : 'rgba(255,120,120,.9)';
      ctx.lineWidth = Math.max(1.5, z * 0.5);
      ctx.beginPath();
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const cx = x + dx * s, cy = y + dy * s;
        ctx.moveTo(cx, cy - dy * k); ctx.lineTo(cx, cy); ctx.lineTo(cx - dx * k, cy);
      }
      ctx.stroke();
    }

    /* ----------------------------- lemmings ----------------------------- */
    drawLemming(ctx, L, x, y, z) {
      const st = L.state, t = L.anim;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(z, z);
      let dir = L.dir;
      let alpha = 1, scale = 1, sink = 0;
      if (st === 'exiting') { const k = L.t / 12; scale = 1 - k * 0.7; alpha = 1 - k * 0.6; ctx.translate(0, -k * 6); }
      if (st === 'drowning') sink = Math.min(9, L.t * 0.45);
      ctx.globalAlpha = alpha;

      // soft contact shadow
      if (st !== 'falling' && st !== 'climbing' && st !== 'drowning') {
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.beginPath(); ctx.ellipse(0, 0.2, 3, 0.8, 0, 0, 7); ctx.fill();
      }
      if (st === 'splatting') { this.drawSplat(ctx, L); ctx.restore(); return; }

      if (sink) {
        ctx.beginPath(); ctx.rect(-8, -20, 16, 20); ctx.clip(); // hide what is below the surface
        ctx.translate(0, sink);
      }
      ctx.scale(dir * scale, scale);

      if (L.umbrella && st === 'falling') this.drawUmbrella(ctx, t);

      const pose = poseFor(L);
      drawBody(ctx, pose, L);

      ctx.restore();

      // bomb countdown above the head (not mirrored)
      if (L.bomb > 0 && L.active) {
        const n = Math.ceil(L.bomb / GL.CONST.TPS);
        const fs = Math.max(11 * this.dpr, z * 5);
        ctx.save();
        ctx.font = `900 ${fs}px "Trebuchet MS", system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.lineWidth = fs * 0.22; ctx.strokeStyle = '#1a1020';
        const urgent = L.bomb < GL.CONST.TPS && (L.bomb >> 2) % 2;
        ctx.strokeText(n, x, y - 12.5 * z);
        ctx.fillStyle = urgent ? '#ff5a4a' : '#fff3b0';
        ctx.fillText(n, x, y - 12.5 * z);
        ctx.restore();
      }
    }

    drawUmbrella(ctx, t) {
      const sw = Math.sin(t * 0.25) * 0.15;
      ctx.save();
      ctx.rotate(sw);
      ctx.strokeStyle = '#3b2c26'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0.6, -6); ctx.lineTo(0.6, -15.5); ctx.stroke();
      const cols = ['#ff5d5d', '#fff4e0', '#ff5d5d', '#fff4e0', '#ff5d5d', '#fff4e0'];
      for (let i = 0; i < 6; i++) {
        const a0 = Math.PI + (i / 6) * Math.PI, a1 = Math.PI + ((i + 1) / 6) * Math.PI;
        ctx.fillStyle = cols[i];
        ctx.beginPath(); ctx.moveTo(0.6, -15.5);
        ctx.arc(0.6, -15.5, 6.5, a0, a1);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.35;
      ctx.beginPath(); ctx.arc(0.6, -15.5, 6.5, Math.PI, 0); ctx.stroke();
      ctx.restore();
    }

    drawSplat(ctx, L) {
      const k = Math.min(1, L.t / 6);
      ctx.globalAlpha = 1 - Math.max(0, (L.t - 8) / 8);
      ctx.fillStyle = LC.shirt;
      ctx.beginPath(); ctx.ellipse(0, -0.8, 2.5 + k * 2, 1.2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = LC.hat;
      ctx.beginPath(); ctx.ellipse(1.5 + k, -1.5, 1.8, 1.1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = LC.pom;
      ctx.beginPath(); ctx.arc(3 + k, -2.3, 0.6, 0, 7); ctx.fill();
      // little stars
      ctx.fillStyle = '#fff3b0';
      for (let i = 0; i < 3; i++) {
        const a = L.t * 0.4 + i * 2.1;
        ctx.fillRect(Math.cos(a) * 3 - 0.4, -5 + Math.sin(a) * 1.2, 0.8, 0.8);
      }
    }

    /* ------------------------------ minimap ------------------------------ */
    drawMinimap(mc) {
      const g = this.game; if (!g || !mc) return;
      const r = mc.getBoundingClientRect();
      const d = this.dpr, w = Math.round(r.width * d), h = Math.round(r.height * d);
      if (!w || !h) return;
      if (mc.width !== w || mc.height !== h) { mc.width = w; mc.height = h; }
      const c = mc.getContext('2d'), T = g.terrain;
      const s = Math.min(w / T.w, h / T.h);
      const ox = (w - T.w * s) / 2, oy = (h - T.h * s) / 2;
      c.clearRect(0, 0, w, h);
      c.fillStyle = 'rgba(10,8,22,.75)'; c.fillRect(0, 0, w, h);
      c.imageSmoothingEnabled = true;
      c.drawImage(this.terrainCanvas, ox, oy, T.w * s, T.h * s);
      for (const hz of g.hazards) {
        c.fillStyle = (GL.HAZARD_COLORS[hz.type] || GL.HAZARD_COLORS.water).a;
        c.fillRect(ox + hz.x * s, oy + hz.y * s, hz.w * s, hz.h * s);
      }
      for (const e of g.exits) { c.fillStyle = '#ffe28a'; c.fillRect(ox + e.x * s - 2 * d, oy + e.y * s - 5 * d, 4 * d, 5 * d); }
      c.fillStyle = '#8affc1';
      for (const L of g.lemmings) if (L.alive) c.fillRect(ox + L.x * s - d, oy + L.y * s - 2 * d, 2 * d, 2 * d);
      const vw = this.W / this.cam.z, vh = this.H / this.cam.z;
      c.strokeStyle = '#ffffff'; c.lineWidth = d;
      c.strokeRect(ox + Math.max(0, this.cam.x) * s, oy + Math.max(0, this.cam.y) * s, Math.min(T.w, vw) * s, Math.min(T.h, vh) * s);
      this.mini = { ox, oy, s, d };
    }

    minimapToLevel(mx, my) {
      const m = this.mini; if (!m) return null;
      return { x: (mx * m.d - m.ox) / m.s, y: (my * m.d - m.oy) / m.s };
    }
  }

  /* ------------------------- per-pixel terrain colors ------------------------- */
  function dirtColor(x, y, T, th, seed, surf) {
    // distance to the surface above (air)
    let d = 0;
    for (let k = 1; k <= th.topDepth + 2; k++) { if (!T.solid(x, y - k) || y - k < 0) { d = k; break; } }
    const n = noise2(x / 7, y / 5, seed), f = hash2(x, y, seed);
    let c = mix(th.dirt[1], th.dirt[2], n);
    if (f > 0.86) c = mix(c, th.dirt[0], 0.6);
    // strata bands
    const band = Math.sin(y * 0.33 + noise2(x / 20, y / 20, seed + 1) * 4);
    if (band > 0.72) c = mix(c, th.strata, 0.45);
    // pebbles
    if (hash2(x >> 2, y >> 2, seed + 5) > 0.93 && f > 0.4) c = shade(c, 1.15);
    if (d && d <= th.topDepth && surf) {
      c = mix(th.top[0], th.top[1], (d === 1 ? 0.8 : 0.2) + f * 0.2);
    } else if (d === th.topDepth + 1) {
      c = mix(c, th.edge, 0.35);
    } else if (d === 1) {
      c = mix(c, [255, 255, 255], 0.14);     // freshly cut face
    }
    // bottom / side edges
    if (!T.solid(x, y + 1)) c = mix(c, th.edge, 0.55);
    else if (!T.solid(x - 1, y)) c = shade(c, 1.08);
    else if (!T.solid(x + 1, y)) c = shade(c, 0.85);
    // gentle depth darkening
    return shade(c, 0.94 + f * 0.1);
  }

  function steelColor(x, y, T, th) {
    const px = x % 14, py = y % 9;
    let c = mix(th.steel[0], th.steel[1], py / 12);
    if (px === 0 || py === 0) c = th.steel[1];
    else if (px === 1 || py === 1) c = th.steel[2];
    if ((px === 3 || px === 11) && (py === 3 || py === 6)) c = shade(th.steel[1], 0.8);
    if (!T.solid(x, y - 1)) c = th.steel[2];
    if (!T.solid(x, y + 1)) c = shade(th.steel[1], 0.75);
    if (!T.solid(x - 1, y) || !T.solid(x + 1, y)) c = shade(c, 0.85);
    return c;
  }

  function brickColor(x, y, T, th) {
    const row = y % 2;
    let c = row ? th.brick[1] : th.brick[0];
    if ((x + (y >> 1) * 3) % 6 === 0) c = shade(th.brick[1], 0.85);
    if (!T.solid(x, y - 1)) c = mix(th.brick[0], [255, 255, 255], 0.25);
    return c;
  }

  /* ------------------------------ lemming poses ------------------------------ */
  // A pose describes limb endpoints in local units (facing right, y up = negative).
  function poseFor(L) {
    const t = L.anim, st = L.state;
    const p = {
      lean: 0, bodyY: 0, headX: 0.3,
      legL: [-1, 0], legR: [1, 0],
      armL: [-1.2, -3.8], armR: [1.2, -3.8],
      tool: null, face: 'side', mouth: 0,
    };
    if (st === 'walking') {
      const s = Math.sin(t * 0.9);
      p.legL = [s * 1.7, 0]; p.legR = [-s * 1.7, 0];
      p.armL = [-s * 1.4, -3.7]; p.armR = [s * 1.4, -3.7];
      p.bodyY = Math.abs(Math.cos(t * 0.9)) * -0.35;
    } else if (st === 'falling') {
      if (L.umbrella) {
        p.armL = [0.2, -9.2]; p.armR = [1, -9.2];
        p.legL = [-0.8, 0.4]; p.legR = [0.9, 0.2];
      } else {
        const s = Math.sin(t * 1.6);
        p.armL = [-2.6, -9 + s]; p.armR = [2.6, -9 - s];
        p.legL = [-1.6, 0.3 + s * 0.4]; p.legR = [1.6, 0.3 - s * 0.4];
        p.mouth = 1;
      }
    } else if (st === 'climbing') {
      const s = Math.sin(t * 0.7);
      p.lean = -0.25; p.headX = 0.8;
      p.armL = [1.8, -9 + s * 1.5]; p.armR = [1.8, -8 - s * 1.5];
      p.legL = [1.4, -0.6 - s]; p.legR = [1.2, 0.2 + s];
    } else if (st === 'building') {
      const ph = (L.t % 12) / 12;
      p.lean = 0.12;
      p.armR = [2.6, -4.6 + Math.sin(ph * 6.28) * 1.2]; p.armL = [1.8, -3.8];
      p.legL = [-1, 0]; p.legR = [1.2, 0];
      p.tool = 'brick';
    } else if (st === 'shrugging') {
      p.armL = [-2.6, -7.5]; p.armR = [2.6, -7.5]; p.face = 'front';
    } else if (st === 'blocking') {
      p.face = 'front'; p.headX = 0;
      p.armL = [-4, -6.2]; p.armR = [4, -6.2];
      p.legL = [-1.8, 0]; p.legR = [1.8, 0];
    } else if (st === 'bashing') {
      const ph = Math.sin(t * 0.8);
      p.lean = 0.15;
      p.armR = [2.8 + ph * 0.8, -5 + ph * 1.2]; p.armL = [2.2, -4.5];
      p.legL = [-1.4, 0]; p.legR = [1.4, 0];
      p.tool = 'pick'; p.toolAng = -0.6 + ph * 0.9;
    } else if (st === 'mining') {
      const ph = ((L.t % 6) / 6);
      p.lean = 0.22;
      p.armR = [2.4, -6.5 + ph * 4]; p.armL = [1.8, -5.5 + ph * 3];
      p.legL = [-1.4, 0]; p.legR = [1.4, 0];
      p.tool = 'pick'; p.toolAng = -1.6 + ph * 2.2;
    } else if (st === 'digging') {
      const ph = Math.sin(t * 1.1);
      p.face = 'front'; p.headX = 0; p.bodyY = ph * 0.4;
      p.armL = [-1.6, -2.8 + ph]; p.armR = [1.6, -2.8 - ph];
      p.legL = [-1.6, 0]; p.legR = [1.6, 0];
      p.tool = 'shovel';
    } else if (st === 'exiting') {
      p.armL = [-2.6, -9]; p.armR = [2.6, -9]; p.face = 'front'; p.mouth = 2;
    } else if (st === 'drowning') {
      const s = Math.sin(t * 1.4);
      p.armL = [-2.4, -9.5 + s]; p.armR = [2.4, -9.5 - s]; p.face = 'front'; p.mouth = 1;
    }
    return p;
  }

  function drawBody(ctx, p, L) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.translate(0, p.bodyY);
    ctx.rotate(p.lean);
    const hipY = -3.3, shoulderY = -6.2;
    const front = p.face === 'front';

    // legs
    ctx.strokeStyle = LC.pants; ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.moveTo(-0.5, hipY); ctx.lineTo(p.legL[0], p.legL[1] - 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0.5, hipY); ctx.lineTo(p.legR[0], p.legR[1] - 0.4); ctx.stroke();
    ctx.fillStyle = LC.shoe;
    ctx.beginPath(); ctx.ellipse(p.legL[0] + 0.3, p.legL[1] - 0.3, 0.9, 0.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.legR[0] + 0.3, p.legR[1] - 0.3, 0.9, 0.5, 0, 0, 7); ctx.fill();

    // back arm
    ctx.strokeStyle = LC.shirtDark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-0.2, shoulderY + 0.3); ctx.lineTo(p.armL[0], p.armL[1]); ctx.stroke();

    // torso
    ctx.fillStyle = LC.shirt;
    roundRectPath(ctx, -1.7, shoulderY - 0.6, 3.4, 3.8, 1.2); ctx.fill();
    ctx.fillStyle = LC.shirtDark;
    ctx.fillRect(-1.7, hipY - 0.6, 3.4, 0.7);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(-1.1, shoulderY - 0.2, 0.7, 2.2);

    // tool behind the front hand
    if (p.tool) drawTool(ctx, p, L);

    // front arm + hand
    ctx.strokeStyle = LC.shirt; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0.2, shoulderY + 0.3); ctx.lineTo(p.armR[0], p.armR[1]); ctx.stroke();
    ctx.fillStyle = LC.skin;
    ctx.beginPath(); ctx.arc(p.armR[0], p.armR[1], 0.55, 0, 7); ctx.arc(p.armL[0], p.armL[1], 0.5, 0, 7); ctx.fill();

    // head
    const hx = p.headX, hy = -8.6;
    ctx.fillStyle = LC.skin;
    ctx.beginPath(); ctx.arc(hx, hy, 1.95, 0, 7); ctx.fill();
    // beanie
    ctx.fillStyle = LC.hat;
    ctx.beginPath(); ctx.arc(hx, hy - 0.15, 2.1, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = LC.hatDark;
    ctx.fillRect(hx - 2.15, hy - 0.5, 4.3, 0.7);
    ctx.fillStyle = LC.pom;
    ctx.beginPath(); ctx.arc(hx - (front ? 0 : 0.9), hy - 2.4, 0.75, 0, 7); ctx.fill();
    // face
    ctx.fillStyle = LC.eye;
    if (front) {
      ctx.beginPath(); ctx.arc(hx - 0.7, hy + 0.5, 0.3, 0, 7); ctx.arc(hx + 0.7, hy + 0.5, 0.3, 0, 7); ctx.fill();
      if (L.state === 'blocking') {
        ctx.strokeStyle = LC.eye; ctx.lineWidth = 0.3;
        ctx.beginPath(); ctx.moveTo(hx - 1.2, hy - 0.1); ctx.lineTo(hx - 0.3, hy + 0.2); ctx.moveTo(hx + 1.2, hy - 0.1); ctx.lineTo(hx + 0.3, hy + 0.2); ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.arc(hx + 1.05, hy + 0.4, 0.32, 0, 7); ctx.fill();
    }
    if (p.mouth) {
      ctx.fillStyle = '#7a2a2a';
      ctx.beginPath(); ctx.ellipse(hx + (front ? 0 : 0.9), hy + 1.3, 0.45, p.mouth === 2 ? 0.3 : 0.45, 0, 0, 7); ctx.fill();
    }
    // cheek
    ctx.fillStyle = 'rgba(255,120,120,.35)';
    ctx.beginPath(); ctx.arc(hx + (front ? 1.1 : 0.3), hy + 0.9, 0.45, 0, 7); ctx.fill();
  }

  function drawTool(ctx, p, L) {
    ctx.save();
    if (p.tool === 'pick') {
      ctx.translate(p.armR[0], p.armR[1]);
      ctx.rotate(p.toolAng || 0);
      ctx.strokeStyle = '#7a5232'; ctx.lineWidth = 0.55;
      ctx.beginPath(); ctx.moveTo(-0.6, 0.4); ctx.lineTo(2.8, -1.4); ctx.stroke();
      ctx.strokeStyle = '#c9d2de'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(1.6, -3.2); ctx.quadraticCurveTo(3.2, -1.4, 3.6, 0.6); ctx.stroke();
    } else if (p.tool === 'shovel') {
      ctx.strokeStyle = '#7a5232'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(0, -5.4); ctx.lineTo(0, 0.5); ctx.stroke();
      ctx.fillStyle = '#c9d2de';
      roundRectPath(ctx, -1, -0.2 + p.bodyY, 2, 1.8, 0.5); ctx.fill();
    } else if (p.tool === 'brick') {
      const ph = (L.t % 12) / 12;
      if (ph < 0.6) {
        ctx.fillStyle = '#d9a066';
        ctx.fillRect(p.armR[0] - 0.2, p.armR[1] - 0.9, 2.2, 1);
      }
    }
    ctx.restore();
  }

  /* --------------------------------- helpers --------------------------------- */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function archPath(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2, y - h + w / 2);
    ctx.arc(x, y - h + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  GL.Renderer = Renderer;
  GL.LEMMING_COLORS = LC;
  GL.drawLemmingIcon = function (ctx, size, state) {
    // Small helper used by the menu to draw a lemming at a given size.
    const fake = { state: state || 'walking', anim: 3, t: 3, dir: 1, umbrella: false };
    ctx.save(); ctx.translate(size / 2, size * 0.92); ctx.scale(size / 13, size / 13);
    drawBody(ctx, poseFor(fake), fake);
    ctx.restore();
  };
})(window.GL = window.GL || {});
