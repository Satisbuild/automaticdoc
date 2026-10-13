/* =====================================================================
 * GREJS TANKS - particles.js
 * Pooled particle system: explosions, smoke, fire, sparks, debris,
 * dust, muzzle flashes, shockwave rings, floating damage text and
 * per-world ambient particles (snow, embers, leaves, sand, ...).
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const U = GT.U;

  const MAX = 1400;
  const TAU = Math.PI * 2;

  /* ---------- soft sprites (cached per colour): glow blobs and puffy smoke ---------- */
  const SPR = {};
  function sprite(color, kind, v) {
    const key = kind + color + (v || 0);
    let cv = SPR[key];
    if (cv) return cv;
    cv = document.createElement('canvas');
    const S = 64;
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    if (kind === 'glow') {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, U.rgba(U.shade(color, 0.45), 1));
      g.addColorStop(0.3, U.rgba(color, 0.75));
      g.addColorStop(0.65, U.rgba(color, 0.22));
      g.addColorStop(1, U.rgba(color, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
    } else {
      // billowing smoke: overlapping lobes lit from above
      const r = U.rng(U.hashStr(key));
      for (let i = 0; i < 10; i++) {
        const a = r() * TAU, d = r() * 10;
        const x = 32 + Math.cos(a) * d, y = 32 + Math.sin(a) * d * 0.8, rr = 9 + r() * 9;
        const g = c.createRadialGradient(x - rr * 0.3, y - rr * 0.4, rr * 0.1, x, y, rr);
        g.addColorStop(0, U.rgba(U.shade(color, 0.28), 0.95));
        g.addColorStop(0.55, U.rgba(color, 0.7));
        g.addColorStop(1, U.rgba(U.shade(color, -0.25), 0));
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, rr, 0, TAU);
        c.fill();
      }
    }
    SPR[key] = cv;
    return cv;
  }
  const isHex = (c) => typeof c === 'string' && c.charCodeAt(0) === 35;
  // rock chunk outline (unit radius)
  const CHUNK = [[1, 0], [0.45, 0.8], [-0.55, 0.9], [-1, 0.1], [-0.5, -0.85], [0.5, -0.7]];

  const P = (GT.Particles = {
    list: [],
    free: [],
    rings: [],
    texts: [],
    flashes: [],
    balls: [],
    arcs: [],
    quality: 1,
    wind: 0,

    reset() {
      this.list.length = 0;
      this.rings.length = 0;
      this.texts.length = 0;
      this.flashes.length = 0;
      this.balls.length = 0;
      this.arcs.length = 0;
    },
    setQuality(q) {
      this.quality = q === 'low' ? 0.45 : 1;
    },

    /** spawn one particle */
    add(o) {
      if (this.list.length >= MAX) return null;
      const p = this.free.pop() || {};
      p.x = o.x; p.y = o.y;
      p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.life = p.max = o.life || 1;
      p.size = o.size || 4;
      p.size2 = o.size2 != null ? o.size2 : p.size;
      p.color = o.color || '#fff';
      p.color2 = o.color2 || null;
      p.type = o.type || 'dot';
      p.grav = o.grav || 0;
      p.drag = o.drag != null ? o.drag : 0.98;
      p.rot = o.rot || Math.random() * 6.28;
      p.vr = o.vr || 0;
      p.alpha = o.alpha != null ? o.alpha : 1;
      p.add = !!o.add;
      p.bounce = o.bounce || 0;
      p.v = (Math.random() * 3) | 0;
      p.windK = o.windK != null ? o.windK : p.type === 'smoke' ? 1 : 0;
      this.list.push(p);
      return p;
    },

    n(count) {
      return Math.max(1, Math.round(count * this.quality));
    },

    /* ---------- composite emitters ---------- */
    /**
     * opt: colors, flash, ring, smoke, debris, kind ('he'|'fire'|'ice'|'toxic'|'energy'|'cracker'),
     *      ground (blast touches terrain), energy (arc colour)
     */
    explosion(x, y, r, opt) {
      opt = opt || {};
      const kind = opt.kind || 'he';
      const col = opt.colors || ['#fff6c2', '#ffc93c', '#ff7a1a', '#e2361b'];
      const k = U.clamp(r / 40, 0.5, 4);
      const sk = Math.sqrt(k);
      const ground = opt.ground !== false;
      // flash + layered fireball
      this.flashes.push({ x, y, r: r * 2.2, life: 0.2, max: 0.2, color: opt.flash || '#fff3c4' });
      this.balls.push({ x, y, r: r * 0.95, life: 0.42, max: 0.42, c: col });
      // shockwave
      this.rings.push({ x, y, r: r * 0.3, max: r * 2.2, life: 0.45, maxLife: 0.45, color: opt.ring || 'rgba(255,240,200,', w: 6 * Math.min(2, k) });
      if (r > 60) this.rings.push({ x, y, r: r * 0.2, max: r * 3.4, life: 0.8, maxLife: 0.8, color: 'rgba(255,255,255,', w: 3 });
      // rolling flames
      for (let i = 0, n = this.n(16 * k); i < n; i++) {
        const a = Math.random() * 6.28, s = U.rand(30, 200) * sk;
        this.add({ x: x + U.rand(-r, r) * 0.3, y: y + U.rand(-r, r) * 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50, life: U.rand(0.35, 0.8), size: U.rand(r * 0.3, r * 0.6), size2: r * 0.15, color: U.pick(col), type: 'fire', add: true, drag: 0.9, grav: -70 });
      }
      // sparks + slow glowing embers
      for (let i = 0, n = this.n(18 * k); i < n; i++) {
        const a = Math.random() * 6.28, s = U.rand(200, 640) * sk;
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 140, life: U.rand(0.3, 0.9), size: U.rand(1.2, 2.6), color: U.pick(['#ffffff', '#ffe28a', '#ffb347']), type: 'spark', add: true, drag: 0.97, grav: 520 });
      }
      for (let i = 0, n = this.n(8 * k); i < n; i++) {
        const a = -Math.PI / 2 + U.rand(-1.2, 1.2), s = U.rand(60, 220) * sk;
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(1, 2.2), size: U.rand(1.2, 2.2), color: U.pick(['#ffb347', '#ff7a1a', '#ffd35a']), type: 'ember', add: true, drag: 0.96, grav: 60, windK: 0.6 });
      }
      // billowing smoke column that drifts with the wind
      const smoke = opt.smoke ? [opt.smoke] : kind === 'toxic' ? ['#6f9a3a', '#89b84a', '#4f7a2a'] : kind === 'ice' ? ['#dff4ff', '#b8dcef', '#ffffff'] : kind === 'energy' ? ['#5a5470', '#6e6688'] : ['#3b3530', '#4d4640', '#2c2724', '#5e5650'];
      for (let i = 0, n = this.n(13 * k); i < n; i++) {
        const a = Math.random() * 6.28, s = U.rand(10, 80);
        this.add({ x: x + U.rand(-r, r) * 0.4, y: y + U.rand(-r, r) * 0.35, vx: Math.cos(a) * s, vy: Math.sin(a) * s - U.rand(40, 90), life: U.rand(1.5, 3.2), size: U.rand(r * 0.25, r * 0.45), size2: r * U.rand(0.8, 1.3), color: U.pick(smoke), type: 'smoke', drag: 0.95, grav: -26, alpha: kind === 'ice' ? 0.45 : 0.6 });
      }
      // rock chunks and soil (terrain coloured)
      const deb = opt.debris || ['#6b4a2b', '#4f3520', '#86603a'];
      if (ground) {
        for (let i = 0, n = this.n(16 * k); i < n; i++) {
          const a = -Math.PI / 2 + U.rand(-1.25, 1.25), s = U.rand(140, 540) * sk;
          this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.9, 2), size: U.rand(1.8, 5) * Math.min(1.6, sk), color: U.pick(deb), type: 'debris', drag: 0.99, grav: 900, vr: U.rand(-12, 12) });
        }
        // fine dirt spray
        for (let i = 0, n = this.n(14 * k); i < n; i++) {
          const a = -Math.PI / 2 + U.rand(-0.9, 0.9), s = U.rand(120, 420) * sk;
          this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.5, 1.1), size: U.rand(0.8, 1.6), color: U.pick(deb), type: 'dot', drag: 0.98, grav: 800 });
        }
        // dust wave rolling along the ground
        const dc = U.shade(deb[0], 0.25);
        for (let i = 0, n = this.n(10 * k); i < n; i++) {
          const dir = i % 2 ? 1 : -1;
          this.add({ x: x + dir * U.rand(0, r * 0.4), y: y + U.rand(-4, 6), vx: dir * U.rand(70, 260) * sk, vy: U.rand(-40, -8), life: U.rand(0.9, 1.7), size: U.rand(r * 0.18, r * 0.3), size2: r * U.rand(0.5, 0.8), color: dc, type: 'smoke', drag: 0.93, grav: -8, alpha: 0.5 });
        }
      }
      // weapon flavours
      switch (kind) {
        case 'fire':
          for (let i = 0, n = this.n(16 * k); i < n; i++) {
            this.add({ x: x + U.rand(-r, r) * 0.6, y: y + U.rand(-8, 4), vx: U.rand(-40, 40), vy: U.rand(-180, -60), life: U.rand(0.5, 1.2), size: U.rand(r * 0.15, r * 0.3), size2: 1, color: U.pick(['#ffd35a', '#ff8a1a', '#ff4d1a']), type: 'fire', add: true, drag: 0.94, grav: -90 });
          }
          for (let i = 0, n = this.n(14 * k); i < n; i++) {
            this.add({ x: x + U.rand(-r, r) * 0.5, y, vx: U.rand(-90, 90), vy: U.rand(-200, -60), life: U.rand(1.5, 3), size: U.rand(1, 2), color: U.pick(['#ffb347', '#ff6a1a']), type: 'ember', add: true, drag: 0.97, grav: 30, windK: 0.8 });
          }
          break;
        case 'ice':
          for (let i = 0, n = this.n(18 * k); i < n; i++) {
            const a = Math.random() * 6.28, s = U.rand(120, 420) * sk;
            this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 100, life: U.rand(0.7, 1.5), size: U.rand(2, 4.5), color: U.pick(['#ffffff', '#c9f3ff', '#8fdcff']), type: 'shard', drag: 0.98, grav: 600, vr: U.rand(-14, 14) });
          }
          for (let i = 0, n = this.n(16 * k); i < n; i++) {
            this.add({ x: x + U.rand(-r, r), y: y + U.rand(-r, r) * 0.6, vx: U.rand(-30, 30), vy: U.rand(-40, 10), life: U.rand(1, 2), size: U.rand(1, 2), color: '#ffffff', type: 'twinkle', add: true, drag: 0.97 });
          }
          break;
        case 'toxic':
          for (let i = 0, n = this.n(18 * k); i < n; i++) {
            const a = -Math.PI / 2 + U.rand(-1.4, 1.4), s = U.rand(100, 360) * sk;
            this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.7, 1.4), size: U.rand(1.5, 3.2), color: U.pick(['#c6ff4a', '#7dff4a', '#4fd12b']), type: 'drop', drag: 0.99, grav: 700 });
          }
          for (let i = 0, n = this.n(10 * k); i < n; i++) {
            this.add({ x: x + U.rand(-r, r) * 0.7, y: y + U.rand(-r, 0) * 0.5, vx: U.rand(-20, 20), vy: U.rand(-50, -15), life: U.rand(1.2, 2.4), size: U.rand(1.5, 3.5), color: '#d6ff9a', type: 'bubble', drag: 0.97, grav: -20 });
          }
          break;
        case 'energy':
          for (let i = 0; i < Math.ceil(5 * sk); i++) this.arcs.push({ x, y, r: r * U.rand(0.9, 1.6), life: U.rand(0.25, 0.5), max: 0.5, color: opt.energy || '#bfe6ff', seed: Math.random() * 1000 });
          this.rings.push({ x, y, r: r * 0.5, max: r * 1.6, life: 0.6, maxLife: 0.6, color: 'rgba(200,240,255,', w: 4 });
          break;
        case 'cracker': {
          const cc = ['#ff3b5c', '#ffd23f', '#4be36b', '#45b8ff', '#ff6ae0', '#ffffff'];
          for (let i = 0, n = this.n(36 * k); i < n; i++) {
            const a = Math.random() * 6.28, s = U.rand(120, 420) * sk;
            this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: U.rand(0.6, 1.4), size: U.rand(1.4, 2.6), color: U.pick(cc), type: 'crackle', add: true, drag: 0.94, grav: 160 });
          }
          for (let i = 0; i < 4; i++) {
            const a = Math.random() * 6.28, d = U.rand(r * 0.4, r * 1.1);
            this.flashes.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, r: r * 0.7, life: 0.12 + i * 0.07, max: 0.12 + i * 0.07, color: U.pick(cc) });
          }
          break;
        }
      }
    },

    /** shell striking armour: hot sparks and steel fragments */
    hit(x, y, colors) {
      this.flashes.push({ x, y, r: 26, life: 0.1, max: 0.1, color: '#fff8e0' });
      for (let i = 0, n = this.n(16); i < n; i++) {
        const a = Math.random() * 6.28, s = U.rand(160, 520);
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: U.rand(0.2, 0.55), size: U.rand(1, 2), color: U.pick(['#ffffff', '#fff2b0', '#ffc24a']), type: 'spark', add: true, drag: 0.95, grav: 500 });
      }
      const mc = colors || ['#6d6a74', '#8a8794', '#4a4853'];
      for (let i = 0, n = this.n(7); i < n; i++) {
        const a = -Math.PI / 2 + U.rand(-1.4, 1.4), s = U.rand(120, 340);
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.8, 1.5), size: U.rand(1.6, 3), color: U.pick(mc), type: 'metal', drag: 0.99, grav: 900, vr: U.rand(-18, 18) });
      }
    },

    muzzle(x, y, ang, big) {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      this.flashes.push({ x: x + dx * 10, y: y + dy * 10, r: big ? 54 : 34, life: 0.1, max: 0.1, color: '#fff2b0' });
      // forward fire jet
      for (let i = 0; i < this.n(big ? 16 : 10); i++) {
        const a = ang + U.rand(-0.3, 0.3), s = U.rand(100, 420);
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.08, 0.2), size: U.rand(4, 10), size2: 1, color: U.pick(['#fff4c0', '#ffc24a', '#ff8a2a']), type: 'fire', add: true, drag: 0.85 });
      }
      // muzzle-brake side jets and a forward smoke ring
      for (const side of [-1, 1]) {
        const a = ang + side * 1.45;
        for (let i = 0; i < this.n(big ? 6 : 4); i++) {
          const s = U.rand(40, 140);
          this.add({ x, y, vx: Math.cos(a) * s + dx * 30, vy: Math.sin(a) * s + dy * 30, life: U.rand(0.5, 1), size: U.rand(3, 6), size2: U.rand(10, 18), color: '#a29d96', type: 'smoke', alpha: 0.5, drag: 0.9, grav: -20 });
        }
      }
      for (let i = 0; i < this.n(big ? 12 : 7); i++) {
        const a = ang + U.rand(-0.5, 0.5), s = U.rand(30, 160);
        this.add({ x: x + dx * 6, y: y + dy * 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 15, life: U.rand(0.7, 1.5), size: U.rand(4, 8), size2: U.rand(16, 28), color: U.pick(['#8d8a86', '#a8a39d', '#6f6b67']), type: 'smoke', alpha: 0.45, drag: 0.92, grav: -25 });
      }
    },

    trail(x, y, kind, color) {
      switch (kind) {
        case 'smoke':
          this.add({ x, y, vx: U.rand(-10, 10), vy: U.rand(-10, 10), life: U.rand(0.6, 1.1), size: 3, size2: 12, color: U.pick(['#b4aea6', '#9d978f', '#c9c4bd']), type: 'smoke', alpha: 0.5, drag: 0.95, grav: -15 });
          if (Math.random() < 0.6) this.add({ x, y, vx: U.rand(-30, 30), vy: U.rand(-30, 30), life: 0.15, size: 5, size2: 1, color: '#ffb347', type: 'fire', add: true });
          break;
        case 'fire':
          this.add({ x, y, vx: U.rand(-25, 25), vy: U.rand(-40, 5), life: U.rand(0.25, 0.5), size: U.rand(5, 9), size2: 1, color: U.pick(['#ffd35a', '#ff7a1a', '#ff4d1a']), type: 'fire', add: true, grav: -80 });
          if (Math.random() < 0.3) this.add({ x, y, vx: U.rand(-15, 15), vy: U.rand(-30, -5), life: U.rand(0.6, 1), size: 3, size2: 10, color: '#4a4440', type: 'smoke', alpha: 0.4, grav: -20 });
          break;
        case 'glow':
          this.add({ x, y, vx: U.rand(-15, 15), vy: U.rand(-15, 15), life: U.rand(0.25, 0.45), size: U.rand(4, 7), size2: 1, color: color || '#7cf', type: 'fire', add: true });
          break;
        case 'ice':
          this.add({ x, y, vx: U.rand(-20, 20), vy: U.rand(-20, 20), life: U.rand(0.3, 0.6), size: U.rand(2, 4), color: U.pick(['#e8fbff', '#9be7ff', '#fff']), type: 'spark', add: true, grav: 60 });
          if (Math.random() < 0.4) this.add({ x, y, vx: U.rand(-10, 10), vy: U.rand(-10, 10), life: 0.8, size: 1.2, color: '#ffffff', type: 'twinkle', add: true });
          break;
        case 'toxic':
          this.add({ x, y, vx: U.rand(-15, 15), vy: U.rand(-15, 15), life: U.rand(0.4, 0.8), size: 3, size2: 9, color: U.pick(['#8cff4a', '#4fd12b']), type: 'smoke', alpha: 0.5 });
          if (Math.random() < 0.3) this.add({ x, y, vx: U.rand(-20, 20), vy: 0, life: 0.6, size: 1.6, color: '#9dff3a', type: 'drop', grav: 400 });
          break;
        case 'spark':
          this.add({ x, y, vx: U.rand(-60, 60), vy: U.rand(-60, 60), life: U.rand(0.1, 0.3), size: 2, color: color || '#bdf', type: 'spark', add: true });
          if (Math.random() < 0.5) this.add({ x, y, vx: U.rand(-90, 90), vy: U.rand(-90, 30), life: U.rand(0.2, 0.5), size: 1.2, color: U.pick(['#ffffff', '#ffd23f', color || '#ff8a3d']), type: 'crackle', add: true, grav: 200 });
          break;
        default:
          this.add({ x, y, life: 0.3, size: 2.5, size2: 0.5, color: color || 'rgba(255,255,255,0.7)', type: 'dot', alpha: 0.6 });
      }
    },

    sparks(x, y, color, count) {
      for (let i = 0; i < this.n(count || 10); i++) {
        const a = Math.random() * 6.28, s = U.rand(80, 360);
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.2, 0.6), size: U.rand(1.5, 3), color: color || '#ffe28a', type: 'spark', add: true, grav: 300 });
      }
    },

    dust(x, y, color, count) {
      for (let i = 0; i < this.n(count || 4); i++) {
        this.add({ x: x + U.rand(-8, 8), y, vx: U.rand(-50, 50), vy: U.rand(-40, -5), life: U.rand(0.5, 1), size: U.rand(3, 5), size2: U.rand(9, 16), color: color || '#b89a74', type: 'smoke', alpha: 0.45, drag: 0.92 });
      }
    },

    heal(x, y) {
      for (let i = 0; i < this.n(18); i++) {
        this.add({ x: x + U.rand(-30, 30), y: y + U.rand(-10, 10), vx: U.rand(-10, 10), vy: U.rand(-90, -40), life: U.rand(0.7, 1.3), size: U.rand(3, 6), color: U.pick(['#7dff9b', '#c6ffd2', '#3ee06a']), type: 'plus', add: true, drag: 0.97 });
      }
    },

    burst(x, y, colors, count, speed) {
      for (let i = 0; i < this.n(count || 20); i++) {
        const a = Math.random() * 6.28, s = U.rand(40, speed || 300);
        this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.4, 1), size: U.rand(2, 5), size2: 0.5, color: U.pick(colors), type: 'fire', add: true, drag: 0.94 });
      }
    },

    text(x, y, str, color, size, opt) {
      this.texts.push({ x, y, text: str, color: color || '#fff', size: size || 22, life: (opt && opt.life) || 1.3, max: (opt && opt.life) || 1.3, vy: -70, vx: U.rand(-15, 15) });
    },

    /** ambient particles in the visible area */
    ambient(kind, view, dt) {
      if (!kind || this.quality < 0.5) return;
      const rate = { snow: 40, embers: 22, leaves: 6, sand: 28, ash: 20, fireflies: 5, spores: 8, sparks: 7, stars: 3, clouds: 2, rain: 60 }[kind] || 0;
      let n = rate * dt;
      while (n > 0) {
        if (n < 1 && Math.random() > n) break;
        n -= 1;
        const x = view.x + Math.random() * view.w;
        const top = view.y - 20;
        switch (kind) {
          case 'snow':
            this.add({ x, y: top, vx: U.rand(-20, 20), vy: U.rand(30, 70), life: 12, size: U.rand(1.5, 3.5), color: '#ffffff', type: 'dot', alpha: 0.85, drag: 1, windK: 0.5 });
            break;
          case 'rain':
            this.add({ x, y: top, vx: -60, vy: 700, life: 3, size: 1, color: 'rgba(170,200,255,0.6)', type: 'streak', drag: 1 });
            break;
          case 'embers':
            this.add({ x, y: view.y + view.h + 10, vx: U.rand(-20, 20), vy: U.rand(-60, -20), life: U.rand(4, 9), size: U.rand(1.5, 3), color: U.pick(['#ffb347', '#ff6a1a', '#ffd35a']), type: 'ember', add: true, drag: 1, windK: 0.4 });
            break;
          case 'leaves':
            this.add({ x, y: top, vx: U.rand(-30, 30), vy: U.rand(25, 55), life: 14, size: U.rand(3, 5), color: U.pick(['#7cc243', '#a6d83b', '#e0b43a']), type: 'leaf', drag: 1, vr: U.rand(-3, 3), windK: 0.6 });
            break;
          case 'sand':
            this.add({ x: view.x - 10, y: view.y + Math.random() * view.h, vx: U.rand(120, 260), vy: U.rand(-10, 20), life: 8, size: U.rand(1, 2.2), color: U.pick(['#f3d9a0', '#e2c080']), type: 'dot', alpha: 0.6, drag: 1 });
            break;
          case 'ash':
            this.add({ x, y: top, vx: U.rand(-15, 15), vy: U.rand(15, 35), life: 16, size: U.rand(1.5, 3), color: U.pick(['#7b7570', '#58524d', '#9a938c']), type: 'dot', alpha: 0.7, drag: 1, windK: 0.5 });
            break;
          case 'fireflies':
          case 'spores':
            this.add({ x, y: view.y + view.h * U.rand(0.3, 0.9), vx: U.rand(-15, 15), vy: U.rand(-15, 5), life: U.rand(3, 6), size: U.rand(2, 3.5), color: kind === 'fireflies' ? '#f4ff8a' : '#b6ffcf', type: 'ember', add: true, drag: 1 });
            break;
          case 'sparks':
            this.add({ x, y: view.y + view.h * U.rand(0.2, 0.8), vx: U.rand(-80, 80), vy: U.rand(-120, -20), life: U.rand(0.5, 1.2), size: 2, color: '#ffd35a', type: 'spark', add: true, grav: 300 });
            break;
          case 'stars':
            this.add({ x, y: view.y + view.h * U.rand(0, 0.5), vx: -300, vy: 160, life: 0.6, size: 1.6, color: '#fff', type: 'streak', add: true, drag: 1 });
            break;
        }
      }
    },

    update(dt, terrain) {
      const L = this.list;
      const wind = this.wind;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.life -= dt;
        if (p.life <= 0) {
          L[i] = L[L.length - 1];
          L.pop();
          this.free.push(p);
          continue;
        }
        p.vy += p.grav * dt;
        if (p.windK) p.vx += wind * p.windK * dt;
        const dr = Math.pow(p.drag, dt * 60);
        p.vx *= dr;
        p.vy *= dr;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.type === 'leaf') p.vx += Math.sin(p.life * 2 + p.rot) * 20 * dt;
        // chunks bounce off terrain and settle
        if ((p.type === 'debris' || p.type === 'metal' || p.type === 'shard') && terrain && p.vy > 0 && terrain.isSolid(p.x | 0, p.y | 0)) {
          p.vy *= -0.35;
          p.vx *= 0.6;
          p.vr *= 0.5;
          p.y -= 2;
          if (Math.abs(p.vy) < 40) p.grav = 0, p.vy = 0, p.vx = 0, p.vr = 0;
        }
        if (p.type === 'drop' && terrain && terrain.isSolid(p.x | 0, p.y | 0)) p.life = Math.min(p.life, 0.05);
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.life -= dt;
        if (r.life <= 0) this.rings.splice(i, 1);
      }
      for (const arr of [this.flashes, this.balls, this.arcs]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          arr[i].life -= dt;
          if (arr[i].life <= 0) arr.splice(i, 1);
        }
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        t.y += t.vy * dt;
        t.x += t.vx * dt;
        t.vy *= Math.pow(0.96, dt * 60);
        if (t.life <= 0) this.texts.splice(i, 1);
      }
    },

    /** draw in world space (ctx already transformed to camera) */
    draw(ctx) {
      const L = this.list;
      // normal blend pass
      for (let i = 0; i < L.length; i++) {
        const p = L[i];
        if (p.add) continue;
        const t = 1 - p.life / p.max;
        const a = p.alpha * (p.type === 'smoke' ? (1 - t) * Math.min(1, t * 6 + 0.3) : Math.min(1, (p.life / p.max) * 2));
        if (a <= 0.01) continue;
        ctx.globalAlpha = a;
        const s = p.size + (p.size2 - p.size) * t;
        switch (p.type) {
          case 'smoke':
            if (isHex(p.color)) {
              const sp = sprite(p.color, 'smoke', p.v);
              const d = s * 2.6;
              ctx.drawImage(sp, p.x - d / 2, p.y - d / 2, d, d);
            } else {
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, Math.max(0.5, s), 0, 6.283);
              ctx.fill();
            }
            break;
          case 'debris':
          case 'metal':
          case 'shard': {
            const c = Math.cos(p.rot) * s, sn = Math.sin(p.rot) * s;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            if (p.type === 'debris') {
              for (let k = 0; k < 6; k++) {
                const [ux, uy] = CHUNK[k];
                ctx.lineTo(p.x + ux * c - uy * sn, p.y + ux * sn + uy * c);
              }
            } else {
              const e = p.type === 'shard' ? 0.35 : 0.5;
              ctx.moveTo(p.x + c * 1.3, p.y + sn * 1.3);
              ctx.lineTo(p.x - sn * e, p.y + c * e);
              ctx.lineTo(p.x - c, p.y - sn);
              ctx.lineTo(p.x + sn * e * 0.6, p.y - c * e * 0.6);
            }
            ctx.closePath();
            ctx.fill();
            // lit facet
            ctx.fillStyle = p.type === 'metal' && t < 0.25 ? 'rgba(255,170,60,0.8)' : 'rgba(255,255,255,0.28)';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + c * 0.9, p.y + sn * 0.9);
            ctx.lineTo(p.x + sn * 0.4, p.y - c * 0.4);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'leaf':
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, s, s * 0.45, 0, 0, 6.283);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(-s, 0);
            ctx.lineTo(s, 0);
            ctx.stroke();
            ctx.restore();
            break;
          case 'streak':
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
            ctx.stroke();
            break;
          case 'drop':
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, s * 0.7, s * 1.2, Math.atan2(p.vy, p.vx) - Math.PI / 2, 0, 6.283);
            ctx.fill();
            break;
          case 'bubble':
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.arc(p.x, p.y, s, 0, 6.283);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s * 0.4, s * 0.4);
            break;
          default:
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, s), 0, 6.283);
            ctx.fill();
        }
      }
      // additive pass
      ctx.globalCompositeOperation = 'lighter';
      // fireball cores
      for (const b of this.balls) {
        const k = 1 - b.life / b.max;
        const rad = b.r * (0.45 + 0.75 * U.easeOut(Math.min(1, k * 1.6)));
        const g = ctx.createRadialGradient(b.x, b.y - rad * 0.1, 0, b.x, b.y, rad);
        g.addColorStop(0, 'rgba(255,255,240,' + (1 - k) + ')');
        g.addColorStop(0.3, U.rgba(b.c[1] || '#ffc93c', 0.95 * (1 - k)));
        g.addColorStop(0.65, U.rgba(b.c[2] || '#ff7a1a', 0.6 * (1 - k)));
        g.addColorStop(1, U.rgba(b.c[3] || b.c[2] || '#e2361b', 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, rad, 0, 6.283);
        ctx.fill();
      }
      for (let i = 0; i < L.length; i++) {
        const p = L[i];
        if (!p.add) continue;
        const t = 1 - p.life / p.max;
        const s = p.size + (p.size2 - p.size) * t;
        let al = Math.min(1, (p.life / p.max) * 1.6) * p.alpha;
        switch (p.type) {
          case 'spark':
          case 'streak':
            ctx.globalAlpha = al;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = s;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            ctx.stroke();
            break;
          case 'plus':
            ctx.globalAlpha = al;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - s, p.y - s * 0.3, s * 2, s * 0.6);
            ctx.fillRect(p.x - s * 0.3, p.y - s, s * 0.6, s * 2);
            break;
          case 'fire':
            ctx.globalAlpha = al;
            if (isHex(p.color)) {
              const d = s * 2.8;
              ctx.drawImage(sprite(p.color, 'glow'), p.x - d / 2, p.y - d / 2, d, d);
            } else {
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, Math.max(0.5, s), 0, 6.283);
              ctx.fill();
            }
            break;
          case 'ember':
          case 'crackle':
          case 'twinkle': {
            const fl = p.type === 'crackle' ? (Math.random() < 0.35 ? 1.8 : 0.4) : p.type === 'twinkle' ? 0.5 + 0.5 * Math.sin(p.life * 22 + p.rot) : 0.7 + 0.3 * Math.sin(p.life * 15 + p.rot);
            ctx.globalAlpha = Math.min(1, al * fl);
            const d = s * 5;
            ctx.drawImage(sprite(isHex(p.color) ? p.color : '#ffd35a', 'glow'), p.x - d / 2, p.y - d / 2, d, d);
            if (p.type === 'twinkle') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(p.x - s * 2, p.y - 0.4, s * 4, 0.8);
              ctx.fillRect(p.x - 0.4, p.y - s * 2, 0.8, s * 4);
            }
            break;
          }
          default:
            ctx.globalAlpha = al;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, s), 0, 6.283);
            ctx.fill();
        }
      }
      // electric arcs
      for (const a of this.arcs) {
        const k = a.life / a.max;
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const r0 = U.rng(((a.seed + a.life * 40) | 0) + 1);
        let ang = r0() * TAU, x = a.x, y = a.y;
        ctx.moveTo(x, y);
        for (let j = 0; j < 7; j++) {
          ang += r0.range(-0.7, 0.7);
          const st = (a.r / 7) * r0.range(0.6, 1.3);
          x += Math.cos(ang) * st;
          y += Math.sin(ang) * st;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      for (const f of this.flashes) {
        const k = f.life / f.max;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, f.color);
        g.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.globalAlpha = k;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, 6.283);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // shockwaves: soft wide band + crisp leading edge
      for (const r of this.rings) {
        const k = 1 - r.life / r.maxLife;
        const rad = r.r + (r.max - r.r) * U.easeOut(k);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = r.color + (1 - k) * 0.12 + ')';
        ctx.lineWidth = (r.w * (1 - k) + 0.5) * 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, 6.283);
        ctx.stroke();
        ctx.strokeStyle = r.color + (1 - k) * 0.5 + ')';
        ctx.lineWidth = r.w * (1 - k) * 0.5 + 0.4;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },

    drawTexts(ctx, scale) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of this.texts) {
        const k = t.life / t.max;
        const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
        const sz = (t.size * pop) / Math.max(0.6, scale);
        ctx.globalAlpha = Math.min(1, k * 2.5);
        ctx.font = `900 ${sz}px "Lilita One", "Arial Black", sans-serif`;
        ctx.lineJoin = 'round';
        ctx.lineWidth = sz * 0.22;
        ctx.strokeStyle = 'rgba(20,14,30,0.92)';
        ctx.strokeText(t.text, t.x, t.y + sz * 0.06);
        ctx.strokeText(t.text, t.x, t.y);
        const g = ctx.createLinearGradient(0, t.y - sz * 0.5, 0, t.y + sz * 0.5);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.45, t.color);
        g.addColorStop(1, t.color);
        ctx.fillStyle = g;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }
  });
})();

