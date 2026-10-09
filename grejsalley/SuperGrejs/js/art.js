'use strict';
/* =====================================================================
   SUPER GREJS - art.js
   Al grafik tegnes i koden (ingen billedfiler). Sprites tegnes som
   pixel-art i dobbelt opløsning (32x32 pixels pr. 16x16 spil-enheder),
   får automatisk mørk kontur og caches som canvas.
   ===================================================================== */
SG.art = (function () {
  const U = SG.util;
  const R = 2;          // art-pixels pr. spil-enhed
  const T = 16 * R;     // en tile i art-pixels
  const OUT = '#1a0f33'; // fælles konturfarve

  /* ---------------- Pixel-painter ---------------- */
  function painter(w, h) {
    const c = U.makeCanvas(w, h);
    const g = c.getContext('2d');
    const api = {
      c, g, w, h,
      r(x, y, ww, hh, col) { if (ww <= 0 || hh <= 0) return api; g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); return api; },
      p(x, y, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); return api; },
      ell(cx, cy, rx, ry, col) {
        g.fillStyle = col;
        for (let y = -ry; y <= ry; y++) {
          const t = 1 - (y * y) / (ry * ry + 0.0001);
          if (t < 0) continue;
          const dx = Math.round(rx * Math.sqrt(t));
          g.fillRect(Math.round(cx - dx), Math.round(cy + y), dx * 2 + 1, 1);
        }
        return api;
      },
      circ(cx, cy, r, col) { return api.ell(cx, cy, r, r, col); },
      poly(pts, col) {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
        g.closePath();
        g.fill();
        return api;
      },
      line(x0, y0, x1, y1, col) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
        for (let i = 0; i <= n; i++) api.p(U.lerp(x0, x1, n ? i / n : 0), U.lerp(y0, y1, n ? i / n : 0), col);
        return api;
      },
      // Fjerner halvgennemsigtige kanter, så alt bliver skarpe pixels.
      harden() {
        const d = g.getImageData(0, 0, w, h);
        const a = d.data;
        for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 110 ? 255 : 0;
        g.putImageData(d, 0, 0);
        return api;
      },
      outline(col, diag) {
        const d = g.getImageData(0, 0, w, h);
        const a = d.data;
        const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 110;
        const [r, gg, b] = U.hexToRgb(col || OUT);
        const add = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (solid(x, y)) continue;
          if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) ||
            (diag && (solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1)))) add.push((y * w + x) * 4);
        }
        add.forEach(i => { a[i] = r; a[i + 1] = gg; a[i + 2] = b; a[i + 3] = 255; });
        g.putImageData(d, 0, 0);
        return api;
      },
    };
    return api;
  }

  function flipX(src) {
    const c = U.makeCanvas(src.width, src.height);
    const g = c.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }

  // Ensfarvet silhuet (bruges til blink ved skade og stjerne-effekt).
  function tint(src, col, alpha) {
    const c = U.makeCanvas(src.width, src.height);
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.fillStyle = col;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  /* =================================================================
     TEMAER - én pr. verden + fæstning og bonusrum
     ================================================================= */
  const THEMES = {
    grass: {
      name: 'Grønne Grejsmarker', sky: ['#4cb8ff', '#a8e6ff', '#e6fbff'],
      ground: 'soil', cap: '#5be37d', capDark: '#2c9b4c', capLight: '#a6f7a0', dirt: '#c98245', dirtDark: '#8f4f22', dirtLight: '#e6a868',
      brick: '#d8662e', brickDark: '#7a2c10', brickLight: '#ff9a5c', pipe: '#3fcf6a', pipeDark: '#1d7a3a', pipeLight: '#9cf7b0',
      semi: 'wood', hard: '#c0a374', hardDark: '#7c6040', far: '#a3d9f2', mid: '#79d38e', midDark: '#4fb06c', near: '#3e9a58',
      bgKind: 'hills', ambient: 'clouds',
    },
    mine: {
      name: 'Møntminen', sky: ['#160f24', '#2b1d3c', '#4b3048'],
      ground: 'soil', cap: '#c9a46a', capDark: '#8a6a3a', capLight: '#f2d39a', dirt: '#6d5b80', dirtDark: '#463a58', dirtLight: '#8f7ca6',
      brick: '#a8743c', brickDark: '#5a3714', brickLight: '#d9a364', pipe: '#d98a4a', pipeDark: '#8a4a1a', pipeLight: '#ffc08a',
      semi: 'scaffold', hard: '#8f86a0', hardDark: '#55506a', far: '#2f2442', mid: '#3d2f52', midDark: '#2a2040', near: '#231a36',
      bgKind: 'cave', ambient: 'dust',
    },
    sky: {
      name: 'Skyhøj', sky: ['#7aa8ff', '#c3b8ff', '#ffe0f0'],
      ground: 'soil', cap: '#9cf0b2', capDark: '#55b87a', capLight: '#dcffe6', dirt: '#c7a8f0', dirtDark: '#8a6ac0', dirtLight: '#e6d4ff',
      brick: '#f08ab8', brickDark: '#9a3a6a', brickLight: '#ffc2dc', pipe: '#5fd0c9', pipeDark: '#2a8a86', pipeLight: '#b4fff8',
      semi: 'cloud', hard: '#f2e0b8', hardDark: '#b09a70', far: '#ffffff', mid: '#f4eaff', midDark: '#d8c8f8', near: '#ffffff',
      bgKind: 'clouds', ambient: 'wind',
    },
    lava: {
      name: 'Lava-laboratoriet', sky: ['#1a0a12', '#3a1218', '#7a2a18'],
      ground: 'plate', cap: '#9aa2ba', capDark: '#5a6078', capLight: '#d4daea', dirt: '#454a5e', dirtDark: '#2c3042', dirtLight: '#6a7088',
      brick: '#b0402c', brickDark: '#5a1810', brickLight: '#ff7a4a', pipe: '#a8b0c4', pipeDark: '#5a6078', pipeLight: '#eef2ff',
      semi: 'grate', hard: '#7a8096', hardDark: '#3e4256', far: '#3a1420', mid: '#4a1a22', midDark: '#2e1016', near: '#24101a',
      bgKind: 'lab', ambient: 'embers',
    },
    frost: {
      name: 'Frostfjeldet', sky: ['#8ccaff', '#c6e6ff', '#f2fbff'],
      ground: 'soil', cap: '#ffffff', capDark: '#b8d8f4', capLight: '#ffffff', dirt: '#7ea4cc', dirtDark: '#4f74a2', dirtLight: '#a6c8ea',
      brick: '#8fd0ff', brickDark: '#3a7ab8', brickLight: '#d8f2ff', pipe: '#5aa8e0', pipeDark: '#2a6aa0', pipeLight: '#bfe6ff',
      semi: 'iceledge', hard: '#d4e8f8', hardDark: '#8aa8c8', far: '#d8ecff', mid: '#a8c8e8', midDark: '#7aa0c8', near: '#5a84b0',
      bgKind: 'peaks', ambient: 'snow',
    },
    forest: {
      name: 'Mørkeskoven', sky: ['#070d1a', '#0f1a30', '#1f2c48'],
      ground: 'soil', cap: '#3f9a62', capDark: '#22603c', capLight: '#7ad49a', dirt: '#3e2c40', dirtDark: '#241828', dirtLight: '#5a4460',
      brick: '#5e4e72', brickDark: '#2e2440', brickLight: '#8a78a6', pipe: '#8a64e0', pipeDark: '#4a2e8a', pipeLight: '#c8b0ff',
      semi: 'branch', hard: '#6a6078', hardDark: '#3a3248', far: '#121e34', mid: '#0f1a2a', midDark: '#0a1220', near: '#08101a',
      bgKind: 'trees', ambient: 'fireflies',
    },
    mech: {
      name: 'Mekanikkens by', sky: ['#ff9a6a', '#ffc08a', '#ffe6b0'],
      ground: 'plate', cap: '#b8c0d0', capDark: '#6e7688', capLight: '#e8eef8', dirt: '#5c6274', dirtDark: '#3a3e4c', dirtLight: '#7c8296',
      brick: '#c8743a', brickDark: '#6a3412', brickLight: '#f2a868', pipe: '#e6b44a', pipeDark: '#946a14', pipeLight: '#fff0a8',
      semi: 'girder', hard: '#9aa2b4', hardDark: '#5a6274', far: '#e8a080', mid: '#9a6a6a', midDark: '#6a4650', near: '#4a3040',
      bgKind: 'city', ambient: 'smoke',
    },
    chaos: {
      name: 'Kaosfæstningen', sky: ['#0d0510', '#2a0a1e', '#5a0a24'],
      ground: 'obsidian', cap: '#5a4a6e', capDark: '#2e2440', capLight: '#8a78a6', dirt: '#2a1e34', dirtDark: '#160e1e', dirtLight: '#3e3050',
      brick: '#6e2a40', brickDark: '#30101c', brickLight: '#a8506a', pipe: '#b03a5a', pipeDark: '#5a1428', pipeLight: '#ff8aa8',
      semi: 'chain', hard: '#4e4060', hardDark: '#261c34', far: '#2a0a1a', mid: '#1e0814', midDark: '#12040c', near: '#0e0308',
      bgKind: 'spires', ambient: 'embers',
    },
    bonus: {
      name: 'Hemmeligt rum', sky: ['#0a0a24', '#141440', '#1e1e5a'],
      ground: 'stone', cap: '#5a6ad0', capDark: '#2e3a8a', capLight: '#a0b0ff', dirt: '#3a46a0', dirtDark: '#222a6a', dirtLight: '#5a68c8',
      brick: '#4a5ad0', brickDark: '#1e286a', brickLight: '#8a9aff', pipe: '#3fcf6a', pipeDark: '#1d7a3a', pipeLight: '#9cf7b0',
      semi: 'wood', hard: '#5a62a0', hardDark: '#2a3060', far: '#16164a', mid: '#12123e', midDark: '#0c0c30', near: '#0a0a26',
      bgKind: 'bricks', ambient: 'sparkle',
    },
  };

  // Fæstningsbaner (x-4) bruger verdenens farver, men sten og borgmure.
  function themeFor(id, fort) {
    const base = THEMES[id] || THEMES.grass;
    if (!fort) return base;
    const key = id + '_fort';
    if (THEMES[key]) return THEMES[key];
    const t = Object.assign({}, base, {
      ground: 'stone',
      cap: U.mix(base.hard, '#8a8aa0', 0.5), capDark: U.mix(base.hardDark, '#3a3a50', 0.5), capLight: U.mix(base.hard, '#ffffff', 0.35),
      dirt: U.mix(base.hard, '#4a4a5e', 0.55), dirtDark: U.mix(base.hardDark, '#24243a', 0.5), dirtLight: U.mix(base.hard, '#8a8aa8', 0.4),
      sky: [U.mix(base.sky[0], '#05030c', 0.7), U.mix(base.sky[1], '#120a1e', 0.7), U.mix(base.sky[2], '#2a1424', 0.65)],
      bgKind: 'castle', semi: 'chain', fortOf: id,
      wall: U.mix(base.hardDark, '#2a2238', 0.55), wallDark: U.mix(base.hardDark, '#120c1c', 0.7),
    });
    THEMES[key] = t;
    return t;
  }

  /* =================================================================
     TILES
     ================================================================= */
  const tileCache = new Map();
  function cached(key, fn) {
    let v = tileCache.get(key);
    if (!v) { v = fn(); tileCache.set(key, v); }
    return v;
  }

  // Jord/sten med kanter: top/venstre/højre afgør hvilke kanter der tegnes.
  function groundTile(th, top, left, right, seed) {
    return cached(`g|${th.name}|${th.ground}|${top}|${left}|${right}|${seed}`, () => {
      const P = painter(T, T);
      const rnd = U.mulberry32(seed * 977 + 13);
      if (th.ground === 'plate') {
        P.r(0, 0, T, T, th.dirt);
        P.r(1, 1, T - 2, T - 2, th.dirtLight);
        P.r(2, 2, T - 4, T - 4, th.dirt);
        P.r(2, T - 4, T - 4, 2, th.dirtDark);
        [[4, 4], [T - 6, 4], [4, T - 6], [T - 6, T - 6]].forEach(([x, y]) => { P.r(x, y, 2, 2, th.dirtLight); P.p(x + 1, y + 1, th.dirtDark); });
        if (seed % 3 === 0) { P.r(9, 14, 14, 2, th.dirtDark); P.r(9, 16, 14, 1, th.dirtLight); }
        if (top) {
          P.r(0, 0, T, 7, th.cap);
          P.r(0, 0, T, 2, th.capLight);
          P.r(0, 6, T, 2, th.capDark);
          for (let x = 2; x < T; x += 8) P.r(x, 3, 3, 2, th.capDark);
        }
      } else if (th.ground === 'obsidian') {
        P.r(0, 0, T, T, th.dirt);
        for (let i = 0; i < 5; i++) P.r((rnd() * 28) | 0, (rnd() * 28) | 0, 3 + ((rnd() * 4) | 0), 2, th.dirtLight);
        // Glødende sprækker
        let x = (rnd() * 20 + 6) | 0, y = top ? 8 : 0;
        while (y < T) { P.r(x, y, 1, 3, '#ff3a3a'); P.p(x + 1, y + 1, '#ffb04a'); y += 3; x += rnd() < 0.5 ? -1 : 1; x = U.clamp(x, 2, 29); }
        if (top) {
          P.r(0, 0, T, 6, th.cap);
          P.r(0, 0, T, 1, th.capLight);
          P.r(0, 6, T, 2, th.capDark);
        }
      } else if (th.ground === 'stone') {
        P.r(0, 0, T, T, th.dirt);
        const off = seed % 2 ? 0 : 8;
        P.r(0, 15, T, 2, th.dirtDark);
        P.r((8 + off) % T, 0, 2, 15, th.dirtDark);
        P.r((24 + off) % T, 17, 2, 15, th.dirtDark);
        P.r(0, 0, T, 1, th.dirtLight);
        P.r(0, 17, T, 1, th.dirtLight);
        for (let i = 0; i < 4; i++) P.p((rnd() * 30) | 0, (rnd() * 30) | 0, th.dirtLight);
        if (top) { P.r(0, 0, T, 4, th.cap); P.r(0, 0, T, 1, th.capLight); P.r(0, 4, T, 2, th.capDark); }
      } else {
        // 'soil': jord med top-dække (græs, sne, grus, mos)
        P.r(0, 0, T, T, th.dirt);
        for (let i = 0; i < 7; i++) {
          const sx = (rnd() * 28) | 0, sy = (rnd() * 28) | 0;
          P.r(sx, sy, 3, 2, rnd() < 0.5 ? th.dirtDark : th.dirtLight);
        }
        if (seed % 4 === 1) { P.ell(18, 20, 4, 3, th.dirtDark); P.ell(17, 19, 3, 2, th.dirtLight); }
        if (top) {
          P.r(0, 0, T, 8, th.cap);
          P.r(0, 1, T, 2, th.capLight);
          // Bølget underkant
          for (let x = 0; x < T; x += 4) {
            const d = 1 + (((x * 7 + seed * 3) % 5) > 2 ? 3 : 1);
            P.r(x, 8, 4, d, th.cap);
            P.r(x, 8 + d, 4, 1, th.capDark);
          }
          if (th.cap === '#ffffff') { P.r(3, 2, 6, 1, '#e8f6ff'); P.r(18, 3, 7, 1, '#e8f6ff'); }
          else { P.p(5, 0, th.capLight); P.p(13, 0, th.capLight); P.p(24, 0, th.capLight); }
        }
      }
      if (left) { P.r(0, 0, 2, T, th.dirtDark); if (top) P.r(0, 0, 2, 8, th.capDark); }
      if (right) { P.r(T - 2, 0, 2, T, th.dirtDark); if (top) P.r(T - 2, 0, 2, 8, th.capDark); }
      if (top && left) { P.g.clearRect(0, 0, 2, 2); P.g.clearRect(0, 0, 1, 3); }
      if (top && right) { P.g.clearRect(T - 2, 0, 2, 2); P.g.clearRect(T - 1, 0, 1, 3); }
      return P.c;
    });
  }

  function brickTile(th, seed) {
    return cached(`b|${th.name}|${th.brick}|${seed % 2}`, () => {
      const P = painter(T, T);
      P.r(0, 0, T, T, th.brickDark);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 ? 8 : 0;
        for (let bx = -off; bx < T; bx += 16) {
          const x = bx + 1, y = row * 8 + 1;
          P.r(x, y, 14, 6, th.brick);
          P.r(x, y, 14, 1, th.brickLight);
          P.r(x, y + 5, 14, 1, U.shade(th.brick, -0.2));
        }
      }
      P.r(0, 0, T, 1, th.brickLight);
      return P.c;
    });
  }

  function qblockTile(frame, used) {
    return cached(`q|${frame}|${used}`, () => {
      const P = painter(T, T);
      if (used) {
        P.r(0, 0, T, T, '#7a4a20');
        P.r(1, 1, T - 2, T - 2, '#b07a44');
        P.r(2, 2, T - 4, 2, '#d4a066');
        P.r(2, T - 4, T - 4, 2, '#8a5a2a');
        [[3, 3], [T - 5, 3], [3, T - 5], [T - 5, T - 5]].forEach(([x, y]) => P.r(x, y, 2, 2, '#5a3414'));
        return P.c;
      }
      const glow = [0, 0.25, 0.5, 0.25][frame];
      P.r(0, 0, T, T, '#8a3c00');
      P.r(1, 1, T - 2, T - 2, U.mix('#ffb21c', '#ffe066', glow));
      P.r(2, 2, T - 4, 2, '#fff2a8');
      P.r(2, 4, 2, T - 6, '#ffe066');
      P.r(2, T - 4, T - 4, 2, '#c86a00');
      P.r(T - 4, 4, 2, T - 6, '#e08a00');
      [[4, 4], [T - 6, 4], [4, T - 6], [T - 6, T - 6]].forEach(([x, y]) => { P.r(x, y, 2, 2, '#8a3c00'); P.p(x, y, '#fff2a8'); });
      // Gnist-symbol (fire spidser) i midten
      const c = 16, s = 7 + (frame === 2 ? 1 : 0);
      const col = '#8a3c00', hi = '#ffffff';
      P.r(c - 1, c - s, 2, s * 2, col);
      P.r(c - s, c - 1, s * 2, 2, col);
      P.r(c - 3, c - 3, 6, 6, col);
      P.r(c - 1, c - s + 2, 1, s * 2 - 4, frame === 2 ? hi : '#fff2a8');
      P.r(c - s + 2, c - 1, s * 2 - 4, 1, frame === 2 ? hi : '#fff2a8');
      return P.c;
    });
  }

  function hardTile(th) {
    return cached(`h|${th.name}|${th.hard}`, () => {
      const P = painter(T, T);
      P.r(0, 0, T, T, th.hardDark);
      P.r(1, 1, T - 2, T - 2, th.hard);
      P.poly([1, 1, T - 1, 1, T - 5, 5, 5, 5, 5, T - 5, 1, T - 1], U.shade(th.hard, 0.3));
      P.poly([T - 1, T - 1, 1, T - 1, 5, T - 5, T - 5, T - 5, T - 5, 5, T - 1, 1], U.shade(th.hard, -0.25));
      P.r(5, 5, T - 10, T - 10, th.hard);
      P.harden();
      return P.c;
    });
  }

  function pipeTile(th, part) {
    // part: 'tl','tr','l','r'
    return cached(`p|${th.name}|${th.pipe}|${part}`, () => {
      const P = painter(T, T);
      const top = part[0] === 't';
      const left = part.endsWith('l');
      const base = th.pipe, dk = th.pipeDark, lt = th.pipeLight;
      if (top) {
        P.r(0, 2, T, T - 4, OUT);
        if (left) { P.r(2, 4, T - 2, T - 8, base); P.r(6, 4, 4, T - 8, lt); P.r(13, 4, 2, T - 8, lt); P.r(2, 4, T - 2, 2, lt); }
        else { P.r(0, 4, T - 2, T - 8, base); P.r(T - 12, 4, 6, T - 8, dk); P.r(0, 4, T - 2, 2, lt); P.r(T - 6, 4, 4, T - 8, U.shade(dk, -0.2)); }
        P.r(0, T - 6, T, 2, U.shade(base, -0.35));
      } else {
        if (left) { P.r(2, 0, T - 2, T, OUT); P.r(4, 0, T - 4, T, base); P.r(8, 0, 4, T, lt); P.r(14, 0, 2, T, lt); }
        else { P.r(0, 0, T - 2, T, OUT); P.r(0, 0, T - 4, T, base); P.r(T - 14, 0, 6, T, dk); P.r(T - 8, 0, 4, T, U.shade(dk, -0.2)); }
      }
      return P.c;
    });
  }

  function semiTile(th, left, right) {
    return cached(`s|${th.name}|${th.semi}|${left}|${right}`, () => {
      const P = painter(T, T);
      const k = th.semi;
      if (k === 'cloud') {
        P.ell(16, 9, 18, 8, '#ffffff');
        P.ell(8, 7, 9, 7, '#ffffff');
        P.ell(24, 6, 9, 6, '#ffffff');
        P.r(0, 12, T, 4, '#e2e8ff');
        if (left) P.g.clearRect(0, 0, 4, T);
        if (right) P.g.clearRect(T - 4, 0, 4, T);
        P.r(0, 13, T, 3, '#ffd98a');
        P.harden().outline('#5a3ea0');
      } else if (k === 'grate' || k === 'girder') {
        const col = k === 'grate' ? '#9aa2ba' : '#e2553a';
        const dk = k === 'grate' ? '#4e546a' : '#8a2414';
        P.r(0, 0, T, 4, col); P.r(0, 10, T, 4, col);
        P.r(0, 0, T, 1, U.shade(col, 0.4));
        for (let x = 0; x < T; x += 8) { P.line(x, 4, x + 6, 9, col); P.line(x + 1, 4, x + 7, 9, dk); }
        P.r(0, 13, T, 1, dk);
        P.outline();
      } else if (k === 'chain') {
        P.r(0, 0, T, 6, '#5a5068'); P.r(0, 0, T, 1, '#9a90b0'); P.r(0, 5, T, 2, '#2a2236');
        for (let x = 2; x < T; x += 8) { P.r(x, 7, 4, 6, '#7a7090'); P.r(x + 1, 8, 2, 4, '#2a2236'); }
        P.outline();
      } else if (k === 'iceledge') {
        P.r(0, 0, T, 8, '#d8f4ff'); P.r(0, 0, T, 2, '#ffffff'); P.r(0, 7, T, 2, '#8ac4ec');
        for (let x = 2; x < T; x += 7) P.poly([x, 9, x + 5, 9, x + 2, 16 + (x % 3) * 2], '#bfe6ff');
        P.harden().outline('#3a6a9a');
      } else if (k === 'branch') {
        P.r(0, 2, T, 8, '#6a4a34'); P.r(0, 2, T, 2, '#9a7454'); P.r(0, 9, T, 1, '#3a2418');
        for (let x = 3; x < T; x += 9) P.r(x, 5, 4, 1, '#3a2418');
        if (left || right) P.ell(left ? 6 : 26, 1, 5, 3, '#3f9a62');
        P.harden().outline();
      } else if (k === 'scaffold') {
        P.r(0, 0, T, 7, '#b07a44'); P.r(0, 0, T, 2, '#e0a868'); P.r(0, 6, T, 1, '#6a4420');
        P.r(left ? 3 : 0, 7, 3, T - 7, '#8a5a2a'); P.r(right ? T - 6 : T - 3, 7, 3, T - 7, '#8a5a2a');
        P.line(4, 8, T - 4, T - 1, '#8a5a2a');
        P.outline();
      } else {
        // træplanke
        P.r(0, 0, T, 8, '#c98a4b'); P.r(0, 0, T, 2, '#f2b878'); P.r(0, 7, T, 2, '#7a4a20');
        P.r(15, 0, 1, 8, '#7a4a20');
        P.p(4, 4, '#7a4a20'); P.p(26, 4, '#7a4a20');
        if (left) P.r(4, 9, 3, T - 9, '#9a6a3a');
        if (right) P.r(T - 7, 9, 3, T - 9, '#9a6a3a');
        P.outline();
      }
      return P.c;
    });
  }

  function spikeTile(dir) {
    return cached('spike|' + dir, () => {
      const P = painter(T, T);
      for (let i = 0; i < 4; i++) {
        const x = i * 8;
        P.poly([x, T, x + 4, 8, x + 8, T], '#c8d0e0');
        P.poly([x + 4, 8, x + 8, T, x + 5, T], '#6a7288');
      }
      P.r(0, T - 4, T, 4, '#4a5068');
      P.harden().outline();
      if (dir === 'down') {
        const c = U.makeCanvas(T, T), g = c.getContext('2d');
        g.translate(0, T); g.scale(1, -1); g.drawImage(P.c, 0, 0);
        return c;
      }
      return P.c;
    });
  }

  function lavaTile(frame, surface, poison) {
    return cached(`lava|${frame}|${surface}|${poison}`, () => {
      const P = painter(T, T);
      const deep = poison ? '#5a1aa0' : '#d8360e', mid = poison ? '#8a3ae0' : '#ff6a1a', hot = poison ? '#d8a0ff' : '#ffd34a';
      P.r(0, 0, T, T, deep);
      for (let i = 0; i < 4; i++) {
        const x = (i * 9 + frame * 3) % T, y = 12 + ((i * 7 + frame * 2) % 16);
        P.ell(x, y, 3, 2, mid);
      }
      if (surface) {
        P.g.clearRect(0, 0, T, 6);
        for (let x = 0; x < T; x++) {
          const h = 6 + Math.round(2 * Math.sin((x + frame * 4) / 32 * Math.PI * 2));
          P.r(x, h, 1, 3, hot);
          P.r(x, h + 3, 1, 3, mid);
        }
      }
      return P.c;
    });
  }

  function iceTile() {
    return cached('ice', () => {
      const P = painter(T, T);
      P.r(0, 0, T, T, '#5a9ad0');
      P.r(1, 1, T - 2, T - 2, '#a8deff');
      P.r(1, 1, T - 2, 3, '#e8f8ff');
      P.line(6, 26, 24, 8, '#ffffff'); P.line(7, 26, 25, 8, '#ffffff');
      P.line(14, 28, 28, 14, '#d4f0ff');
      P.r(1, T - 3, T - 2, 2, '#7ab8e4');
      return P.c;
    });
  }

  function conveyorTile(frame, dir) {
    return cached(`conv|${frame}|${dir}`, () => {
      const P = painter(T, T);
      P.r(0, 0, T, T, '#3a3e4c');
      P.r(0, 0, T, 10, '#24262e');
      for (let i = -1; i < 5; i++) {
        const x = i * 8 + ((dir > 0 ? frame : 4 - frame) % 4) * 2;
        P.r(x, 2, 4, 6, '#ffcf3a');
        P.r(x + (dir > 0 ? 3 : 0), 3, 1, 4, '#a07a10');
      }
      P.r(0, 0, T, 1, '#6a7088');
      P.circ(8, 21, 6, '#7a8096'); P.circ(8, 21, 2, '#24262e');
      P.circ(24, 21, 6, '#7a8096'); P.circ(24, 21, 2, '#24262e');
      P.r(0, T - 2, T, 2, '#24262e');
      return P.c;
    });
  }

  function crumbleTile(th) {
    return cached('crumble|' + th.name, () => {
      const P = painter(T, T);
      P.r(0, 0, T, T, '#6a4a2a');
      P.r(1, 1, T - 2, T - 2, '#c89a5a');
      P.r(1, 1, T - 2, 2, '#f2c88a');
      P.line(6, 3, 12, 14, '#6a4a2a'); P.line(12, 14, 9, 26, '#6a4a2a');
      P.line(22, 2, 19, 12, '#6a4a2a'); P.line(19, 12, 26, 22, '#6a4a2a');
      P.r(1, T - 3, T - 2, 2, '#8a6a3a');
      return P.c;
    });
  }

  function springTile(compress) {
    return cached('spring|' + compress, () => {
      const P = painter(T, T);
      const top = 6 + compress * 10;
      P.r(4, top, 24, 5, '#ff4d5e'); P.r(4, top, 24, 2, '#ffa0a8');
      for (let y = top + 5; y < T - 5; y += 4) { P.r(8, y, 16, 2, '#c8d0e0'); P.r(10, y + 2, 12, 2, '#6a7288'); }
      P.r(4, T - 5, 24, 5, '#4a5068');
      P.outline();
      return P.c;
    });
  }

  /* ---------------- Mønter ---------------- */
  function coinFrame(i) {
    return cached('coin|' + i, () => {
      const P = painter(T, T);
      const w = [9, 7, 3, 1, 3, 7][i];
      const cx = 16, cy = 16;
      if (w <= 1) {
        P.r(cx - 1, cy - 12, 3, 24, '#c87a00');
        P.r(cx, cy - 12, 1, 24, '#ffe9a0');
      } else {
        P.ell(cx, cy, w, 12, '#c87a00');
        P.ell(cx, cy, Math.max(1, w - 2), 10, '#ffd34d');
        if (w > 5) {
          P.r(cx - 2, cy - 6, 2, 12, '#e8a000');
          P.r(cx - 2, cy - 6, 5, 2, '#e8a000');
          P.r(cx - 2, cy + 4, 5, 2, '#e8a000');
          P.r(cx + 1, cy, 2, 5, '#e8a000');
        }
        P.r(cx - w + 2, cy - 7, 2, 6, '#fff7c8');
      }
      P.outline();
      return P.c;
    });
  }

  /* =================================================================
     FJENDER OG GENSTANDE (32x32 art = 16x16 spil-enheder)
     ================================================================= */
  const spriteCache = new Map();
  function sprite(key, fn) {
    let s = spriteCache.get(key);
    if (!s) {
      const right = fn();
      s = { r: right, l: flipX(right) };
      spriteCache.set(key, s);
    }
    return s;
  }

  // Småskramler: en sur lille dåse-robot på to ben.
  function skramler(frame, squashed, variant) {
    return sprite(`skramler|${frame}|${squashed}|${variant}`, () => {
      const P = painter(32, 32);
      const body = variant ? '#e05a7a' : '#d0783a', dark = variant ? '#8a2040' : '#8a4218', light = variant ? '#ffa0b8' : '#f2b070';
      if (squashed) {
        P.ell(16, 26, 13, 5, body);
        P.r(5, 26, 22, 2, dark);
        P.r(9, 23, 4, 2, '#fff'); P.r(19, 23, 4, 2, '#fff');
        P.r(10, 24, 2, 1, OUT); P.r(20, 24, 2, 1, OUT);
        return P.harden().outline().c;
      }
      const lf = frame % 2 === 0;
      P.r(lf ? 8 : 10, 25, 6, 6, '#3a2a40'); P.r(lf ? 18 : 16, 25, 6, 6, '#3a2a40');
      P.r(lf ? 6 : 8, 29, 8, 3, '#2a1a30'); P.r(lf ? 18 : 16, 29, 8, 3, '#2a1a30');
      P.ell(16, 16, 12, 11, body);
      P.r(5, 13, 22, 3, dark);
      P.r(5, 20, 22, 2, dark);
      P.ell(12, 9, 5, 3, light);
      // Bolt på toppen
      P.r(14, 2, 4, 4, '#a8b0c4'); P.r(15, 1, 2, 2, '#e8eef8');
      // Øje og vrede bryn
      P.ell(17, 15, 5, 5, '#ffffff');
      P.r(18, 13, 3, 5, OUT);
      P.poly([10, 8, 24, 11, 24, 13, 10, 11], OUT);
      // Bule
      P.r(7, 22, 3, 2, light);
      return P.harden().outline().c;
    });
  }

  // Skjoldbille: grøn-guld bille. Skjoldformen kan sparkes.
  function bille(frame, shell, wobble) {
    return sprite(`bille|${frame}|${shell}|${wobble}`, () => {
      const P = painter(32, 48);
      const sh = '#2fb59a', shd = '#167a66', shl = '#8ff0d8', gold = '#ffc93c';
      if (shell) {
        const y0 = 20 + (wobble ? 1 : 0);
        P.ell(16, y0 + 14, 14, 12, sh);
        P.ell(16, y0 + 10, 11, 7, shl);
        P.ell(16, y0 + 11, 9, 5, sh);
        P.r(15, y0 + 3, 2, 22, gold);
        P.ell(16, y0 + 24, 13, 3, '#f2e0b8');
        P.r(4, y0 + 22, 24, 2, shd);
        return P.harden().outline().c;
      }
      const lf = frame % 2 === 0;
      // Ben
      [[8, 40], [14, 41], [20, 40]].forEach(([x, y], i) => P.r(x + (lf ^ (i % 2) ? 1 : -1), y, 3, 6, '#3a2a40'));
      // Hoved
      P.ell(25, 14, 7, 7, '#f2c84a');
      P.ell(27, 12, 3, 4, '#ffffff');
      P.r(28, 11, 2, 4, OUT);
      P.r(30, 18, 3, 2, '#8a5a10');
      P.r(22, 4, 2, 5, '#3a2a40'); P.r(23, 2, 4, 2, '#3a2a40');
      // Skjold
      P.ell(13, 28, 13, 13, sh);
      P.ell(12, 24, 9, 7, shl);
      P.ell(13, 25, 7, 5, sh);
      P.r(4, 30, 18, 2, gold);
      P.r(5, 36, 16, 2, shd);
      P.ell(13, 39, 11, 2, '#f2e0b8');
      return P.harden().outline().c;
    });
  }

  // Rørgnasker: lilla orm med store kæber.
  function gnasker(frame) {
    return sprite(`gnasker|${frame}`, () => {
      const P = painter(32, 48);
      const open = frame % 2 === 0;
      for (let i = 0; i < 4; i++) {
        const y = 22 + i * 7;
        P.ell(16 + (i % 2 ? 1 : -1), y, 8, 5, i % 2 ? '#8a4ad0' : '#a868f0');
        P.r(12, y - 1, 3, 2, '#d8b0ff');
      }
      P.r(10, 44, 12, 4, '#4a8a3a');
      // Hoved
      P.ell(16, 12, 12, 10, '#b86cff');
      P.ell(13, 8, 5, 3, '#e0c0ff');
      if (open) {
        P.r(6, 12, 20, 8, '#3a0a2a');
        for (let x = 7; x < 26; x += 4) { P.poly([x, 12, x + 3, 12, x + 1.5, 16], '#ffffff'); P.poly([x, 20, x + 3, 20, x + 1.5, 16], '#ffffff'); }
      } else {
        P.r(6, 15, 20, 2, '#3a0a2a');
        for (let x = 7; x < 26; x += 4) P.r(x, 14, 2, 1, '#ffffff');
      }
      P.ell(11, 5, 3, 3, '#fff'); P.ell(21, 5, 3, 3, '#fff');
      P.r(11, 4, 2, 3, OUT); P.r(21, 4, 2, 3, OUT);
      return P.harden().outline().c;
    });
  }

  // Luftdrøne: lille propeldrone med ét øje.
  function drone(frame) {
    return sprite(`drone|${frame}`, () => {
      const P = painter(32, 32);
      P.r(15, 4, 2, 6, '#4a5068');
      if (frame % 2) { P.r(3, 3, 26, 2, '#c8d0e0'); }
      else { P.r(8, 2, 16, 2, '#c8d0e0'); P.r(3, 4, 8, 1, '#8890a8'); P.r(21, 4, 8, 1, '#8890a8'); }
      P.ell(16, 17, 11, 9, '#ff8a2a');
      P.ell(13, 13, 5, 3, '#ffc08a');
      P.r(6, 21, 20, 3, '#c8541a');
      P.ell(18, 17, 5, 5, '#ffffff');
      P.ell(19, 17, 3, 3, '#2a8aff');
      P.r(19, 16, 1, 2, '#ffffff');
      P.r(9, 26, 3, 4, '#4a5068'); P.r(20, 26, 3, 4, '#4a5068');
      return P.harden().outline().c;
    });
  }

  // Gnisterobot: firkantet robot med antenne. Feltet tegnes i renderer.
  function gnist(frame, charged) {
    return sprite(`gnist|${frame}|${charged}`, () => {
      const P = painter(32, 40);
      const lf = frame % 2 === 0;
      P.r(lf ? 7 : 9, 32, 6, 8, '#3a3e4c'); P.r(lf ? 19 : 17, 32, 6, 8, '#3a3e4c');
      P.r(4, 12, 24, 21, '#ffcf3a');
      P.r(4, 12, 24, 3, '#fff0a0');
      for (let x = 4; x < 28; x += 8) P.poly([x, 28, x + 4, 28, x + 8, 33, x + 4, 33], '#2a2236');
      P.r(4, 28, 24, 1, '#2a2236');
      P.r(8, 17, 16, 7, '#2a2236');
      P.r(10, 19, 4, 3, charged ? '#ffffff' : '#7af0ff');
      P.r(18, 19, 4, 3, charged ? '#ffffff' : '#7af0ff');
      P.r(15, 4, 2, 8, '#6a7288');
      P.circ(16, 4, 3, charged ? '#ffffff' : '#7af0ff');
      return P.harden().outline().c;
    });
  }

  // Hoppeklat: blå klat på en fjeder.
  function hopper(frame) {
    return sprite(`hopper|${frame}`, () => {
      const P = painter(32, 32);
      const sq = frame === 1;
      P.ell(16, sq ? 20 : 15, 12, sq ? 8 : 11, '#3aa8ff');
      P.ell(12, sq ? 16 : 10, 5, 3, '#a8deff');
      P.r(11, sq ? 18 : 13, 3, 4, '#fff'); P.r(19, sq ? 18 : 13, 3, 4, '#fff');
      P.r(12, sq ? 19 : 14, 2, 3, OUT); P.r(20, sq ? 19 : 14, 2, 3, OUT);
      P.r(13, sq ? 24 : 21, 6, 2, '#1a5aa0');
      for (let y = sq ? 28 : 26; y < 31; y += 2) P.r(10, y, 12, 1, '#c8d0e0');
      return P.harden().outline().c;
    });
  }

  function piggkugle(frame) {
    return sprite(`kugle|${frame}`, () => {
      const P = painter(32, 32);
      const a0 = frame * Math.PI / 8;
      for (let i = 0; i < 8; i++) {
        const a = a0 + i * Math.PI / 4;
        P.poly([16 + Math.cos(a) * 15, 16 + Math.sin(a) * 15, 16 + Math.cos(a + 0.35) * 9, 16 + Math.sin(a + 0.35) * 9, 16 + Math.cos(a - 0.35) * 9, 16 + Math.sin(a - 0.35) * 9], '#8a90a8');
      }
      P.circ(16, 16, 10, '#3a3e4c');
      P.ell(13, 12, 4, 3, '#7a8096');
      P.circ(16, 16, 3, '#ff4d5e');
      return P.harden().outline().c;
    });
  }

  function kanon() {
    return sprite('kanon', () => {
      const P = painter(32, 32);
      P.r(2, 2, 28, 28, '#3a3e4c');
      P.r(4, 4, 24, 24, '#5a6074');
      P.r(4, 4, 24, 3, '#8a90a8');
      P.circ(16, 16, 8, '#24262e');
      P.circ(16, 16, 5, '#0d0e14');
      P.r(4, 25, 24, 3, '#2a2c36');
      [[6, 8], [24, 8], [6, 22], [24, 22]].forEach(([x, y]) => P.r(x, y, 2, 2, '#a8b0c4'));
      return P.outline().c;
    });
  }

  function gloeder(frame) {
    return sprite(`gloeder|${frame}`, () => {
      const P = painter(32, 32);
      const f = frame % 3;
      P.poly([16, 1 + f, 24, 12, 26, 22, 16, 30, 6, 22, 8, 12], '#ff5a1a');
      P.poly([16, 7 + f, 21, 15, 22, 22, 16, 27, 10, 22, 11, 15], '#ffb21c');
      P.ell(16, 21, 4, 5, '#fff2a8');
      P.r(12, 18, 2, 3, OUT); P.r(18, 18, 2, 3, OUT);
      return P.harden().outline('#5a1000').c;
    });
  }

  function flagermus(frame) {
    return sprite(`bat|${frame}`, () => {
      const P = painter(32, 32);
      const up = frame % 2 === 0;
      if (up) { P.poly([14, 16, 1, 4, 4, 12, 0, 16, 8, 18], '#6a3ab0'); P.poly([18, 16, 31, 4, 28, 12, 32, 16, 24, 18], '#6a3ab0'); }
      else { P.poly([14, 16, 1, 26, 5, 20, 0, 18, 8, 15], '#6a3ab0'); P.poly([18, 16, 31, 26, 27, 20, 32, 18, 24, 15], '#6a3ab0'); }
      P.ell(16, 17, 7, 7, '#8a5ad0');
      P.poly([11, 12, 12, 6, 15, 11], '#8a5ad0'); P.poly([21, 12, 20, 6, 17, 11], '#8a5ad0');
      P.r(12, 15, 3, 3, '#ffe14d'); P.r(18, 15, 3, 3, '#ffe14d');
      P.r(14, 21, 1, 2, '#fff'); P.r(17, 21, 1, 2, '#fff');
      return P.harden().outline().c;
    });
  }

  function istap(rock) {
    return sprite(`istap|${rock}`, () => {
      const P = painter(32, 32);
      if (rock) {
        P.poly([4, 0, 28, 0, 22, 14, 18, 30, 12, 20, 8, 12], '#8f86a0');
        P.poly([8, 0, 16, 0, 12, 10], '#b8b0c8');
      } else {
        P.poly([5, 0, 27, 0, 18, 30, 15, 31], '#bfe6ff');
        P.poly([9, 0, 15, 0, 15, 24], '#ffffff');
      }
      return P.harden().outline(rock ? OUT : '#3a6a9a').c;
    });
  }

  /* ---------------- Power-ups ---------------- */
  function item(kind, frame) {
    return sprite(`item|${kind}|${frame || 0}`, () => {
      const P = painter(32, 32);
      if (kind === 'fruit') {
        // Kraftfrugt
        P.ell(16, 19, 12, 11, '#ff4d3d');
        P.ell(11, 15, 5, 4, '#ffb199');
        P.ell(21, 24, 5, 3, '#c82020');
        P.r(15, 4, 3, 6, '#6a3a1a');
        P.poly([17, 6, 27, 2, 25, 9], '#4ad86a');
        P.poly([18, 6, 25, 4, 23, 7], '#a8ffb0');
        P.r(9, 13, 2, 2, '#ffffff');
        P.r(13, 22, 2, 2, '#ffd8c8'); P.r(19, 17, 2, 2, '#ffd8c8');
      } else if (kind === 'flower') {
        // Energiblomst
        P.r(15, 18, 3, 13, '#2fb35a');
        P.poly([16, 26, 6, 20, 8, 27], '#4ad86a'); P.poly([17, 26, 27, 20, 25, 27], '#4ad86a');
        const glow = frame % 2 ? '#bff8ff' : '#6ff3ff';
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          P.ell(16 + Math.cos(a) * 7, 11 + Math.sin(a) * 6, 5, 4, i % 2 ? glow : '#2ab0ff');
        }
        P.circ(16, 11, 5, '#ffffff');
        P.poly([17, 6, 13, 12, 16, 12, 14, 16, 19, 10, 16, 10], '#ffc93c');
      } else if (kind === 'star') {
        // Stjernekerne
        const a0 = (frame || 0) * Math.PI / 8;
        const pts = [];
        for (let i = 0; i < 8; i++) {
          const a = a0 + i * Math.PI / 4;
          const r = i % 2 ? 7 : 15;
          pts.push(16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
        }
        P.poly(pts, '#ffb21c');
        P.circ(16, 16, 8, '#ffe14d');
        P.circ(16, 16, 5, '#fff7c8');
        P.r(13, 13, 2, 4, OUT); P.r(18, 13, 2, 4, OUT);
      } else if (kind === 'life') {
        // Ekstralivs-kapsel
        P.poly([6, 22, 18, 6, 26, 12, 14, 28], '#ffffff');
        P.poly([6, 22, 12, 14, 20, 20, 14, 28], '#4ad86a');
        P.ell(10, 25, 4, 4, '#4ad86a');
        P.ell(22, 9, 4, 4, '#ffffff');
        P.r(17, 10, 3, 2, '#d8e8f8');
        // Hjerte
        P.circ(19, 15, 2, '#ff4d5e'); P.circ(23, 15, 2, '#ff4d5e'); P.poly([17, 16, 25, 16, 21, 21], '#ff4d5e');
      } else if (kind === 'energy') {
        // Spillerens energiskud
        P.circ(16, 16, 7, '#2ab0ff');
        P.circ(16, 16, 5, '#bff8ff');
        P.circ(15, 15, 2, '#ffffff');
      }
      return P.harden().outline().c;
    });
  }

  /* =================================================================
     BAGGRUNDE (parallax-lag) - cachet pr. tema
     ================================================================= */
  const BG_W = 768;   // spil-enheder pr. gentagelse
  const BG_H = 288;
  const bgCache = new Map();

  function layerCanvas() {
    const c = U.makeCanvas(BG_W * R, BG_H * R);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.scale(R, R);
    return { c, g };
  }

  // Tegn på et midlertidigt lag og læg det på med gennemsigtighed (undgår mørke overlap)
  function withAlpha(target, alpha, fn) {
    const tmp = layerCanvas();
    fn(tmp.g);
    target.g.globalAlpha = alpha;
    target.g.drawImage(tmp.c, 0, 0, BG_W, BG_H);
    target.g.globalAlpha = 1;
  }

  // Tegner en form tre gange (x-W, x, x+W), så laget kan gentages sømløst.
  const wrap = (fn) => { [-BG_W, 0, BG_W].forEach(off => fn(off)); };

  function ridge(g, rnd, baseY, amp, step, col, sharp) {
    g.fillStyle = col;
    const pts = [];
    for (let x = 0; x <= BG_W; x += step) pts.push([x, baseY - rnd() * amp]);
    pts[pts.length - 1][1] = pts[0][1];
    wrap(off => {
      g.beginPath();
      g.moveTo(off, BG_H);
      pts.forEach(([x, y], i) => {
        if (sharp || i === 0) g.lineTo(x + off, y);
        else {
          const [px, py] = pts[i - 1];
          g.quadraticCurveTo(px + off + step / 2, py, x + off - step / 2 + step / 2, y);
        }
      });
      g.lineTo(BG_W + off, BG_H);
      g.closePath();
      g.fill();
    });
    return pts;
  }

  function cloud(g, x, y, s, col, shade) {
    g.fillStyle = shade || col;
    [[0, 4, 14], [14, 0, 16], [30, 4, 13], [44, 8, 10]].forEach(([dx, dy, r]) => {
      g.beginPath(); g.arc(x + dx * s, y + dy * s + 3 * s, r * s, 0, 7); g.fill();
    });
    g.fillStyle = col;
    [[0, 4, 14], [14, 0, 16], [30, 4, 13], [44, 8, 10]].forEach(([dx, dy, r]) => {
      g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); g.fill();
    });
    g.fillRect(x - 10 * s, y + 4 * s, 64 * s, 12 * s);
  }

  function buildLayers(th) {
    const key = th.name + '|' + th.bgKind;
    if (bgCache.has(key)) return bgCache.get(key);
    const rnd = U.mulberry32(key.length * 7919 + th.bgKind.charCodeAt(0) * 31);
    const far = layerCanvas(), mid = layerCanvas(), near = layerCanvas();
    const k = th.bgKind;

    if (k === 'hills') {
      for (let i = 0; i < 6; i++) cloud(far.g, rnd() * BG_W, 30 + rnd() * 60, 0.6 + rnd() * 0.5, '#ffffff', '#d8f2ff');
      ridge(far.g, rnd, 190, 70, 96, th.far, false);
      ridge(mid.g, rnd, 236, 50, 64, th.mid, false);
      // Små træer på midterlaget
      for (let i = 0; i < 9; i++) {
        const x = rnd() * BG_W, y = 214 + rnd() * 18;
        wrap(off => {
          mid.g.fillStyle = '#6a4a2a'; mid.g.fillRect(x + off - 2, y, 4, 22);
          mid.g.fillStyle = th.midDark; mid.g.beginPath(); mid.g.arc(x + off, y - 4, 14, 0, 7); mid.g.fill();
          mid.g.fillStyle = th.mid; mid.g.beginPath(); mid.g.arc(x + off - 3, y - 7, 9, 0, 7); mid.g.fill();
        });
      }
      ridge(near.g, rnd, 262, 22, 40, th.near, false);
    } else if (k === 'cave') {
      far.g.fillStyle = th.far;
      for (let i = 0; i < 14; i++) {
        const x = rnd() * BG_W, w = 20 + rnd() * 40, h = 30 + rnd() * 80;
        wrap(off => { far.g.beginPath(); far.g.moveTo(x + off - w / 2, 0); far.g.lineTo(x + off + w / 2, 0); far.g.lineTo(x + off, h); far.g.fill(); });
      }
      ridge(far.g, rnd, 220, 60, 48, th.far, true);
      // Støttebjælker og lanterner
      for (let i = 0; i < 5; i++) {
        const x = i * (BG_W / 5) + 40;
        wrap(off => {
          const g = mid.g;
          g.fillStyle = '#2e2030'; g.fillRect(x + off, 120, 8, 168); g.fillRect(x + off + 90, 120, 8, 168);
          g.fillRect(x + off - 6, 112, 110, 10);
          g.fillStyle = '#3a2a3a'; g.fillRect(x + off, 120, 2, 168); g.fillRect(x + off - 6, 112, 110, 2);
          g.fillStyle = 'rgba(255,190,90,.18)'; g.beginPath(); g.arc(x + off + 50, 136, 26, 0, 7); g.fill();
          g.fillStyle = '#ffcf6a'; g.fillRect(x + off + 46, 128, 8, 10);
          g.fillStyle = '#3a2a1a'; g.fillRect(x + off + 49, 122, 2, 6);
        });
      }
      // Krystaller
      for (let i = 0; i < 10; i++) {
        const x = rnd() * BG_W, y = 240 + rnd() * 30, h = 10 + rnd() * 18;
        const col = ['#5ae0ff', '#ff6ad8', '#ffd84a'][i % 3];
        wrap(off => {
          near.g.fillStyle = col; near.g.globalAlpha = 0.85;
          near.g.beginPath(); near.g.moveTo(x + off, y); near.g.lineTo(x + off + 5, y - h); near.g.lineTo(x + off + 10, y); near.g.fill();
          near.g.globalAlpha = 1;
        });
      }
      ridge(near.g, rnd, 276, 18, 24, th.near, true);
    } else if (k === 'clouds') {
      // Baggrundsskyer er halvgennemsigtige, så de ikke forveksles med platformskyer
      withAlpha(far, 0.55, g => { for (let i = 0; i < 10; i++) cloud(g, rnd() * BG_W, 20 + rnd() * 120, 0.5 + rnd() * 0.6, '#ffffff', '#f0d8ff'); });
      // Svævende øer langt væk
      withAlpha(far, 0.35, g => { for (let i = 0; i < 3; i++) {
        const x = 80 + i * 250 + rnd() * 60, y = 60 + rnd() * 50;
        wrap(off => {
          g.fillStyle = '#b8a0e8'; g.beginPath(); g.moveTo(x + off - 22, y); g.lineTo(x + off + 22, y); g.lineTo(x + off + 4, y + 26); g.lineTo(x + off - 3, y + 20); g.fill();
          g.fillStyle = '#9ce8b2'; g.fillRect(x + off - 23, y - 4, 46, 5);
        });
      } });
      withAlpha(mid, 0.6, g => { for (let i = 0; i < 7; i++) cloud(g, rnd() * BG_W, 150 + rnd() * 80, 0.9 + rnd() * 0.7, '#ffffff', '#e0d0ff'); });
      withAlpha(near, 0.8, g => { for (let i = 0; i < 6; i++) cloud(g, rnd() * BG_W, 250 + rnd() * 20, 1.2 + rnd() * 0.5, '#ffffff', '#e8dcff'); });
    } else if (k === 'lab') {
      // Rør og tanke
      for (let i = 0; i < 8; i++) {
        const x = i * 96 + rnd() * 30;
        wrap(off => {
          const g = far.g;
          g.fillStyle = th.far; g.fillRect(x + off, 0, 40, BG_H);
          g.fillStyle = U.shade(th.far, 0.15); g.fillRect(x + off + 4, 0, 4, BG_H);
          g.fillStyle = 'rgba(255,90,30,.25)'; g.fillRect(x + off + 14, 60 + (i % 3) * 30, 12, 60);
        });
      }
      for (let i = 0; i < 4; i++) {
        const x = i * 192 + 60;
        wrap(off => {
          const g = mid.g;
          g.fillStyle = th.mid; g.fillRect(x + off, 150, 70, 138);
          g.fillStyle = '#ff6a1a'; g.globalAlpha = 0.6; g.fillRect(x + off + 10, 170, 50, 60); g.globalAlpha = 1;
          g.fillStyle = '#ffd34a'; g.fillRect(x + off + 10, 170 + ((i * 13) % 30), 50, 3);
          g.fillStyle = U.shade(th.mid, 0.2); g.fillRect(x + off, 150, 70, 6);
          g.fillStyle = th.midDark; g.fillRect(x + off + 30, 100, 10, 50); g.fillRect(x + off - 40, 96, 90, 8);
        });
      }
      ridge(near.g, rnd, 274, 10, 32, th.near, true);
    } else if (k === 'peaks') {
      ridge(far.g, rnd, 170, 100, 72, th.far, true);
      // Snehætter
      far.g.fillStyle = '#ffffff';
      ridge(mid.g, rnd, 220, 70, 56, th.mid, true);
      for (let i = 0; i < 16; i++) {
        const x = rnd() * BG_W, y = 230 + rnd() * 30, h = 26 + rnd() * 20;
        wrap(off => {
          const g = near.g;
          g.fillStyle = th.near;
          g.beginPath(); g.moveTo(x + off, y - h); g.lineTo(x + off + 12, y); g.lineTo(x + off - 12, y); g.fill();
          g.fillStyle = '#ffffff';
          g.beginPath(); g.moveTo(x + off, y - h); g.lineTo(x + off + 5, y - h + 10); g.lineTo(x + off - 5, y - h + 10); g.fill();
          g.fillStyle = '#4a3a2a'; g.fillRect(x + off - 2, y, 4, 8);
        });
      }
      ridge(near.g, rnd, 280, 10, 40, '#e8f4ff', false);
    } else if (k === 'trees') {
      // Måne
      far.g.fillStyle = '#f2f0d8'; far.g.beginPath(); far.g.arc(560, 60, 24, 0, 7); far.g.fill();
      far.g.fillStyle = th.sky[1]; far.g.beginPath(); far.g.arc(570, 54, 20, 0, 7); far.g.fill();
      const tree = (g, x, y, h, col) => {
        g.fillStyle = col;
        g.fillRect(x - 4, y - h, 8, h);
        for (let j = 0; j < 4; j++) {
          const yy = y - h + j * h / 5, w = 14 + j * 7;
          g.beginPath(); g.moveTo(x, yy - 14); g.lineTo(x + w, yy + 22); g.lineTo(x - w, yy + 22); g.fill();
        }
      };
      for (let i = 0; i < 18; i++) { const x = rnd() * BG_W, h = 120 + rnd() * 80; wrap(off => tree(far.g, x + off, 288, h, th.far)); }
      for (let i = 0; i < 12; i++) { const x = rnd() * BG_W, h = 100 + rnd() * 90; wrap(off => tree(mid.g, x + off, 288, h, th.mid)); }
      // Glødende svampe
      for (let i = 0; i < 10; i++) {
        const x = rnd() * BG_W, y = 268 + rnd() * 14;
        const col = ['#5af0d8', '#c08aff', '#ffd84a'][i % 3];
        wrap(off => {
          const g = near.g;
          g.fillStyle = col; g.globalAlpha = 0.25; g.beginPath(); g.arc(x + off, y - 4, 14, 0, 7); g.fill();
          g.globalAlpha = 1; g.fillStyle = '#d8d0e8'; g.fillRect(x + off - 1, y - 4, 3, 8);
          g.fillStyle = col; g.beginPath(); g.ellipse(x + off, y - 5, 6, 3, 0, Math.PI, 0); g.fill();
        });
      }
      ridge(near.g, rnd, 282, 8, 30, th.near, false);
    } else if (k === 'city') {
      // Fabrikker med skorstene, tandhjul
      for (let i = 0; i < 12; i++) {
        const x = i * 64 + rnd() * 20, w = 40 + rnd() * 30, h = 80 + rnd() * 90;
        wrap(off => {
          const g = far.g;
          g.fillStyle = th.far; g.fillRect(x + off, 288 - h, w, h);
          if (i % 3 === 0) g.fillRect(x + off + w * 0.6, 288 - h - 50, 10, 50);
          g.fillStyle = 'rgba(255,240,180,.35)';
          for (let wy = 288 - h + 10; wy < 270; wy += 16) for (let wx = x + 6; wx < x + w - 6; wx += 12) if (((wx * 7 + wy) | 0) % 3) g.fillRect(wx + off, wy, 5, 7);
        });
      }
      const gear = (g, x, y, r, col) => {
        g.fillStyle = col;
        g.beginPath();
        for (let t = 0; t < 12; t++) { const a = t * Math.PI / 6; g.rect(x + Math.cos(a) * r - 4, y + Math.sin(a) * r - 4, 8, 8); }
        g.fill();
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x, y, r * 0.35, 0, 7); g.fill();
        g.globalCompositeOperation = 'source-over';
      };
      for (let i = 0; i < 5; i++) { const x = rnd() * BG_W, y = 150 + rnd() * 80; wrap(off => gear(mid.g, x + off, y, 18 + rnd() * 14, th.mid)); }
      for (let i = 0; i < 6; i++) {
        const x = i * 128 + 30;
        wrap(off => {
          const g = mid.g;
          g.fillStyle = th.midDark; g.fillRect(x + off, 200, 80, 88);
          g.fillStyle = th.mid; g.fillRect(x + off, 200, 80, 6);
        });
      }
      ridge(near.g, rnd, 278, 8, 24, th.near, true);
    } else if (k === 'spires') {
      for (let i = 0; i < 10; i++) {
        const x = rnd() * BG_W, h = 120 + rnd() * 120, w = 16 + rnd() * 20;
        wrap(off => {
          const g = far.g;
          g.fillStyle = th.far;
          g.fillRect(x + off - w / 2, 288 - h, w, h);
          g.beginPath(); g.moveTo(x + off - w / 2 - 4, 288 - h); g.lineTo(x + off, 288 - h - 40); g.lineTo(x + off + w / 2 + 4, 288 - h); g.fill();
          g.fillStyle = '#ff3a3a'; g.fillRect(x + off - 2, 288 - h + 20, 4, 6);
        });
      }
      ridge(mid.g, rnd, 240, 60, 40, th.mid, true);
      ridge(near.g, rnd, 276, 16, 20, th.near, true);
    } else if (k === 'castle') {
      const wall = th.wall, dk = th.wallDark;
      far.g.fillStyle = dk; far.g.fillRect(0, 0, BG_W, BG_H);
      far.g.fillStyle = wall;
      for (let y = 0; y < BG_H; y += 24) for (let x = (y / 24) % 2 ? -24 : 0; x < BG_W; x += 48) far.g.fillRect(x + 2, y + 2, 44, 20);
      // Vinduer og bannere
      for (let i = 0; i < 6; i++) {
        const x = i * 128 + 40;
        const g = mid.g;
        g.fillStyle = '#0a0610'; g.fillRect(x, 70, 30, 50); g.beginPath(); g.arc(x + 15, 70, 15, Math.PI, 0); g.fill();
        g.fillStyle = 'rgba(255,120,60,.22)'; g.fillRect(x + 4, 74, 22, 44);
        g.fillStyle = i % 2 ? '#a02040' : '#4030a0';
        g.fillRect(x + 64, 40, 26, 80);
        g.beginPath(); g.moveTo(x + 64, 120); g.lineTo(x + 77, 108); g.lineTo(x + 90, 120); g.fill();
        g.fillStyle = '#ffc93c'; g.fillRect(x + 72, 60, 10, 10);
        // Fakkel
        g.fillStyle = '#5a3a20'; g.fillRect(x - 20, 150, 6, 18);
        g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(x - 17, 146, 6, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,140,60,.18)'; g.beginPath(); g.arc(x - 17, 146, 22, 0, 7); g.fill();
      }
    } else if (k === 'bricks') {
      far.g.fillStyle = th.far; far.g.fillRect(0, 0, BG_W, BG_H);
      far.g.fillStyle = th.mid;
      for (let y = 0; y < BG_H; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < BG_W; x += 32) far.g.fillRect(x + 1, y + 1, 30, 14);
    }
    const res = { far: far.c, mid: mid.c, near: near.c };
    bgCache.set(key, res);
    return res;
  }

  /* ---------------- Dekorationer ---------------- */
  function decor(kind, th) {
    return cached(`decor|${kind}|${th.name}`, () => {
      let P;
      switch (kind) {
        case 'bush': {
          P = painter(64, 32);
          P.ell(16, 22, 14, 10, th.capDark); P.ell(32, 18, 16, 14, th.capDark); P.ell(48, 22, 14, 10, th.capDark);
          P.ell(16, 21, 12, 8, th.cap); P.ell(32, 17, 14, 12, th.cap); P.ell(48, 21, 12, 8, th.cap);
          P.ell(28, 11, 6, 4, th.capLight); P.ell(13, 17, 4, 3, th.capLight);
          P.r(0, 30, 64, 2, th.capDark);
          return P.harden().outline().c;
        }
        case 'flowers': {
          P = painter(32, 32);
          [[6, '#ff6a8a'], [16, '#ffd84a'], [26, '#b98cff']].forEach(([x, c], i) => {
            P.r(x, 20 - i * 2, 2, 12 + i * 2, '#2c9b4c');
            P.circ(x + 1, 18 - i * 2, 3, c); P.p(x + 1, 18 - i * 2, '#ffffff');
          });
          return P.harden().outline().c;
        }
        case 'fence': {
          P = painter(64, 32);
          for (let x = 2; x < 64; x += 14) { P.r(x, 6, 6, 26, '#e8c890'); P.poly([x, 6, x + 3, 2, x + 6, 6], '#e8c890'); }
          P.r(0, 12, 64, 4, '#c8a070'); P.r(0, 22, 64, 4, '#c8a070');
          return P.harden().outline().c;
        }
        case 'sign': {
          P = painter(32, 48);
          P.r(14, 20, 4, 28, '#8a5a2a');
          P.r(2, 4, 28, 18, '#c98a4b'); P.r(2, 4, 28, 3, '#f2b878');
          P.poly([10, 10, 20, 10, 20, 7, 26, 13, 20, 19, 20, 16, 10, 16], '#ffffff');
          return P.harden().outline().c;
        }
        case 'tree': {
          P = painter(64, 96);
          P.r(28, 50, 9, 46, '#7a4a24'); P.r(29, 50, 3, 46, '#a8703c');
          P.ell(32, 36, 28, 26, th.capDark); P.ell(30, 32, 24, 22, th.cap); P.ell(22, 22, 9, 7, th.capLight);
          return P.harden().outline().c;
        }
        case 'pine': {
          P = painter(48, 96);
          P.r(21, 74, 6, 22, '#5a3a1a');
          for (let i = 0; i < 4; i++) P.poly([24, 6 + i * 16, 44 - i * 0, 34 + i * 14, 4, 34 + i * 14], i % 2 ? '#2a7a5a' : '#3a9a6a');
          for (let i = 0; i < 4; i++) P.poly([24, 6 + i * 16, 32, 18 + i * 16, 16, 18 + i * 16], '#ffffff');
          return P.harden().outline().c;
        }
        case 'crystal': {
          P = painter(32, 48);
          P.poly([6, 48, 10, 18, 16, 10, 20, 26, 22, 48], '#5ae0ff');
          P.poly([16, 48, 22, 14, 28, 22, 28, 48], '#ff6ad8');
          P.poly([10, 18, 16, 10, 14, 30], '#d8faff');
          return P.harden().outline().c;
        }
        case 'lantern': {
          P = painter(32, 64);
          P.r(15, 0, 2, 30, '#3a2a1a');
          P.r(10, 30, 12, 16, '#3a2a1a'); P.r(12, 32, 8, 12, '#ffd36a'); P.r(13, 33, 3, 6, '#fff7c8');
          return P.outline().c;
        }
        case 'mushroom': {
          P = painter(32, 32);
          P.r(14, 18, 4, 14, '#e8e0f0');
          P.ell(16, 16, 12, 7, '#7af0d8'); P.r(4, 16, 24, 4, '#2a8a7a');
          P.p(10, 13, '#ffffff'); P.p(20, 12, '#ffffff'); P.p(16, 14, '#ffffff');
          return P.harden().outline().c;
        }
        case 'gear': {
          P = painter(64, 64);
          for (let t = 0; t < 10; t++) { const a = t * Math.PI / 5; P.r(32 + Math.cos(a) * 24 - 5, 32 + Math.sin(a) * 24 - 5, 10, 10, '#9aa2b4'); }
          P.circ(32, 32, 24, '#9aa2b4'); P.circ(32, 32, 18, '#7a8296'); P.circ(32, 32, 7, '#3a3e4c');
          return P.harden().outline().c;
        }
        case 'torch': {
          P = painter(32, 48);
          P.r(13, 20, 6, 28, '#5a3a20');
          P.poly([16, 2, 24, 14, 22, 22, 10, 22, 8, 14], '#ff6a1a'); P.poly([16, 8, 20, 16, 18, 21, 14, 21, 12, 16], '#ffd34a');
          return P.harden().outline().c;
        }
        case 'snowman': {
          P = painter(32, 48);
          P.circ(16, 36, 11, '#ffffff'); P.circ(16, 18, 8, '#ffffff');
          P.r(13, 16, 2, 2, OUT); P.r(18, 16, 2, 2, OUT); P.r(16, 19, 5, 2, '#ff8a2a');
          P.r(9, 7, 14, 3, '#3a3e4c'); P.r(11, 1, 10, 7, '#3a3e4c'); P.r(11, 6, 10, 1, '#ff4d5e');
          return P.harden().outline('#3a6a9a').c;
        }
        case 'rocks': {
          P = painter(48, 24);
          P.ell(14, 16, 12, 8, th.hardDark); P.ell(13, 14, 10, 6, th.hard);
          P.ell(34, 18, 10, 6, th.hardDark); P.ell(33, 17, 8, 4, th.hard);
          return P.harden().outline().c;
        }
        case 'chimney': {
          P = painter(32, 64);
          P.r(6, 10, 20, 54, '#7a4a3a'); P.r(4, 6, 24, 6, '#5a3428');
          for (let y = 16; y < 64; y += 8) P.r(6, y, 20, 1, '#5a3428');
          return P.outline().c;
        }
        case 'skullpost': {
          P = painter(32, 48);
          P.r(14, 18, 4, 30, '#4a3a5a');
          P.circ(16, 12, 9, '#e8e0d0'); P.r(10, 10, 4, 4, OUT); P.r(18, 10, 4, 4, OUT); P.r(12, 18, 8, 3, '#e8e0d0');
          P.r(13, 18, 1, 3, OUT); P.r(16, 18, 1, 3, OUT); P.r(19, 18, 1, 3, OUT);
          return P.harden().outline().c;
        }
        default: {
          P = painter(32, 32);
          return P.c;
        }
      }
    });
  }

  // Målstolpe, checkpoint, dør, hytte og andet tegnes direkte i renderer.js.

  return {
    R, T, OUT, THEMES, themeFor, painter, flipX, tint,
    groundTile, brickTile, qblockTile, hardTile, pipeTile, semiTile, spikeTile, lavaTile, iceTile, conveyorTile, crumbleTile, springTile,
    coinFrame, skramler, bille, gnasker, drone, gnist, hopper, piggkugle, kanon, gloeder, flagermus, istap, item,
    buildLayers, decor, BG_W, BG_H,
  };
})();
