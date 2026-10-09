'use strict';
/* =====================================================================
   SUPER GREJS - levels.js
   Bane-bygger og register. Selve banerne står i levels-data.js som
   håndskrevne kommandoer (ingen tilfældig generering).

   Koordinater i byggeren er i tiles: x fra venstre, y fra BUNDEN
   (y = 0 er nederste række). Det gør det let at læse "højde over jorden".

   Tegnforklaring til row()/rows():
     ' ' spring over     '.' tøm       '#' jord        'X' hård blok
     'B' mursten         '?' blok m. mønt              'P' blok m. power-up
     'M' mursten m. mange mønter       'p' mursten m. power-up
     'S' mursten m. stjernekerne       'l' blok m. ekstraliv
     'h' skjult blok m. mønt           'H' skjult blok m. power-up
     '1' skjult blok m. ekstraliv      'U' brugt blok
     '-' halvfast platform (kan hoppes op igennem)
     '^' pigge   'v' pigge i loftet    '~' lava       '%' giftsump
     'i' is      '<' '>' transportbånd 'F' falsk væg (kan gås igennem)
     'c' smuldreblok                   'o' mønt
   ===================================================================== */
SG.levels = (function () {
  const T = SG.physics.T;

  const LEGEND = {
    '.': [T.EMPTY], '#': [T.GROUND], 'X': [T.HARD], 'B': [T.BRICK], '?': [T.QBLOCK, 'coin'], 'P': [T.QBLOCK, 'power'],
    'M': [T.BRICK, 'multi'], 'p': [T.BRICK, 'power'], 'S': [T.BRICK, 'star'], 'l': [T.QBLOCK, 'life'],
    'h': [T.HIDDEN, 'coin'], 'H': [T.HIDDEN, 'power'], '1': [T.HIDDEN, 'life'], 'U': [T.USED],
    '-': [T.SEMI], '^': [T.SPIKE], 'v': [T.SPIKE_DOWN], '~': [T.LAVA], '%': [T.POISON], 'i': [T.ICE],
    '<': [T.CONV_L], '>': [T.CONV_R], 'F': [T.FAKE], 'c': [T.CRUMBLE], 'o': [T.COIN],
  };

  class Room {
    constructor(name, w, h, opts) {
      opts = opts || {};
      this.name = name;
      this.w = w;
      this.h = h;
      this.tiles = new Uint8Array(w * h);
      this.contents = new Map();   // tile-indeks -> indhold i blok
      this.spawns = [];            // fjender, platforme, fjedre ...
      this.decor = [];
      this.pipes = [];
      this.doors = [];
      this.wind = [];
      this.checkpoints = [];
      this.start = null;
      this.goal = null;
      this.arena = null;
      this.theme = opts.theme || null;
      this.dark = !!opts.dark;
      this.camLock = opts.camLock !== false; // kameraet går ikke baglæns
      this.music = opts.music || null;
    }
    // y fra bunden -> rækkeindeks
    row(y) { return this.h - 1 - y; }
    idx(x, y) { return this.row(y) * this.w + x; }
    inside(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h; }

    set(x, y, code, content) {
      if (!this.inside(x, y)) return this;
      const i = this.idx(x, y);
      this.tiles[i] = code;
      if (content) this.contents.set(i, content);
      else this.contents.delete(i);
      return this;
    }
    get(x, y) { return this.inside(x, y) ? this.tiles[this.idx(x, y)] : T.EMPTY; }

    fill(x0, y0, x1, y1, code) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, code);
      return this;
    }
    clear(x0, y0, x1, y1) { return this.fill(x0, y0, x1, y1, T.EMPTY); }
    // Jord fra bunden op til (men ikke med) top.
    ground(x0, x1, top) { return this.fill(x0, 0, x1, (top == null ? 2 : top) - 1, T.GROUND); }
    gap(x0, x1) { return this.fill(x0, 0, x1, this.h - 1, T.EMPTY); }
    // Tegn en række tegn fra venstre mod højre i højde y.
    put(x, y, str) {
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === ' ') continue;
        const L = LEGEND[ch];
        if (!L) throw new Error(`Ukendt bane-tegn '${ch}'`);
        this.set(x + i, y, L[0], L[1] || null);
      }
      return this;
    }
    // Flere rækker oppefra og ned. yTop er højden for første streng.
    art(x, yTop, lines) {
      lines.forEach((s, i) => this.put(x, yTop - i, s));
      return this;
    }
    // Lodret rør (2 bredt) fra base og 'height' tiles op.
    pipe(x, base, height, opts) {
      opts = opts || {};
      for (let y = base; y < base + height; y++) { this.set(x, y, T.PIPE_L); this.set(x + 1, y, T.PIPE_R); }
      const top = base + height - 1;
      if (opts.to || opts.warp) this.pipes.push({ x, y: top, to: opts.to || null, warp: opts.warp || null });
      if (opts.biter) this.spawn('gnasker', x, top + 1, { pipe: true, delay: opts.biter === true ? 0 : opts.biter });
      return this;
    }
    // Trappe af hårde blokke. dir 1 = op mod højre, -1 = ned mod højre.
    stairs(x, base, n, dir, code) {
      code = code || T.HARD;
      for (let i = 0; i < n; i++) {
        const h = dir < 0 ? n - i : i + 1;
        this.fill(x + i, base, x + i, base + h - 1, code);
      }
      return this;
    }
    coins(x, y, n, dx, dy) {
      for (let i = 0; i < n; i++) this.set(x + i * (dx || 1), y + i * (dy || 0), T.COIN);
      return this;
    }
    // Mønter i en bue over et hul
    arc(x, y, n, h) {
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        this.set(x + i, y + Math.round(Math.sin(t * Math.PI) * (h || 2)), T.COIN);
      }
      return this;
    }
    spawn(type, x, y, props) { this.spawns.push({ type, x, y, props: props || {} }); return this; }
    enemy(type, x, y, props) { return this.spawn(type, x, y, props); }
    // Bevægelig platform: kind 'h' | 'v' | 'fall' | 'cart' | 'circle'
    plat(kind, x, y, props) { return this.spawn('platform', x, y, Object.assign({ kind }, props || {})); }
    spring(x, y) { return this.spawn('spring', x, y); }
    // Kanontårn på en hård blok
    cannon(x, y, props) { this.set(x, y, T.HARD); return this.spawn('kanon', x, y, props); }
    // Glødestang omkring en brugt blok
    fireBar(x, y, len, speed, angle) { this.set(x, y, T.USED); return this.spawn('stang', x, y, { len, speed, angle }); }
    decorate(kind, x, y) { this.decor.push({ kind, x, y }); return this; }
    startAt(x, y) { this.start = { x, y }; return this; }
    checkpoint(x, y) { this.checkpoints.push({ x, y }); return this.spawn('checkpoint', x, y, { id: this.checkpoints.length - 1 }); }
    goalAt(x, y) { this.goal = { x, y }; return this.spawn('goal', x, y); }
    door(x, y, to) { this.doors.push({ x, y, to }); return this; }
    windZone(x0, x1, force) { this.wind.push({ x0, x1, force }); return this; }
    // Bossarena mellem x0 og x1. Porten lukker bag spilleren.
    bossArena(x0, x1, boss, opts) {
      this.arena = Object.assign({ x0, x1, boss, floor: 2 }, opts || {});
      return this;
    }
  }

  /* ---------------- Register ---------------- */
  const DEFS = new Map();
  const WORLD_INFO = [];

  function world(n, info) { WORLD_INFO[n] = info; }

  // build(L) kaldes, når banen skal spilles, så en ny kopi altid er frisk.
  function define(id, meta, build) {
    DEFS.set(id, { id, meta, build });
  }

  function load(id) {
    const def = DEFS.get(id);
    if (!def) throw new Error('Ukendt bane ' + id);
    const [w, k] = id.split('-').map(Number);
    const rooms = {};
    const L = {
      room(name, width, height, opts) {
        const r = new Room(name, width, height || 18, opts);
        rooms[name] = r;
        return r;
      },
    };
    def.build(L);
    const meta = Object.assign({ time: 300, theme: 'grass' }, def.meta);
    return { id, world: w, index: k, meta, rooms, startRoom: meta.startRoom || 'main' };
  }

  const has = id => DEFS.has(id);
  const ids = () => Array.from(DEFS.keys());
  const name = id => (DEFS.get(id) ? DEFS.get(id).meta.name : id);

  return { Room, LEGEND, define, load, has, ids, name, world, WORLD_INFO, get worlds() { return WORLD_INFO; } };
})();
