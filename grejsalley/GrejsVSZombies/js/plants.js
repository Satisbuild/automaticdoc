'use strict';
/* =====================================================================
   GREJS VS ZOMBIES - plants.js
   39 planter: data, opgraderingsskalering, gameplay-adfærd (tick),
   Plant Power og tegning. Tegnefunktioner får ctx med origo ved
   plantens fødder (y negativ = op).
   G = den kørende kamp (se game.js) og giver hjælpefunktioner.
   ===================================================================== */
GVZ.Plants = (function () {
  const U = GVZ.U, A = GVZ.A, k = A.k;
  const MAX_LV = 6;
  const CATS = { resource: 'Ressource', attack: 'Angreb', defense: 'Forsvar', trap: 'Fælde & eksplosion', support: 'Støtte' };

  /* ---------------------------------------------------------------
     Fælles tegneskabeloner
     --------------------------------------------------------------- */
  const sway = (p, t, a) => Math.sin(t * 2.1 + (p.seed || 0)) * (a || 0.05);
  const blinkOf = (p, t) => { const b = (((t + (p.seed || 0) * 3) % 4.2) + 4.2) % 4.2; return b < 0.12 ? U.clamp(1 - Math.abs(b - 0.06) / 0.06, 0, 1) : 0; };
  const recoil = (p) => (p.shootT != null && p.shootT < 0.22 ? Math.sin((p.shootT / 0.22) * Math.PI) : 0);

  function baseLeaves(ctx, col, spread, size) {
    size = size || 1;
    A.leaf(ctx, -2, -4, 30 * size, 11 * size, Math.PI + 0.35 + (spread || 0), col);
    A.leaf(ctx, 2, -4, 30 * size, 11 * size, -0.35 - (spread || 0), col);
  }
  function dirt(ctx, w) {
    A.ell(ctx, 0, 0, w || 22, 6, 0, '#6b4a2c', 2);
    ctx.fillStyle = k('#8a6239'); ctx.beginPath(); ctx.ellipse(-3, -1.5, (w || 22) * 0.6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  /* Skydeplante: stængel + hoved + mundstykke */
  function shooter(ctx, p, t, o) {
    const sw = sway(p, t, 0.05), rc = recoil(p);
    const hx = sw * 40 - rc * 6, hy = -58 + rc * 3;
    dirt(ctx);
    baseLeaves(ctx, o.leaf || '#4c9a2a', 0, 1);
    A.stem(ctx, 0, -2, hx - 4, hy + 14, -6 + sw * 30, 7, o.stem || '#4c9a2a');
    if (o.back) o.back(ctx, hx, hy, p, t);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(1 + rc * 0.12, 1 - rc * 0.1);
    const r = o.r || 23;
    // mundstykke
    const ml = (o.muzzleLen || 20) + rc * 4;
    A.rrect(ctx, r * 0.55, -8, ml, 16, 6, o.c1, 2.6);
    A.ell(ctx, r * 0.55 + ml, 0, 5, 9, 0, U.shade(o.c2, -0.3), 2.4);
    ctx.fillStyle = k('#1a0f08'); ctx.beginPath(); ctx.ellipse(r * 0.55 + ml + 1, 0, 2.6, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    // hoved
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.94, 0, 0, Math.PI * 2);
    ctx.fillStyle = A.rg(ctx, 0, 0, r, o.c1, o.c2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
    A.shine(ctx, -r * 0.35, -r * 0.45, r * 0.3, r * 0.17);
    if (o.deco) o.deco(ctx, r, p, t);
    A.eye(ctx, r * 0.08, -r * 0.18, r * 0.36, 0.7, 0, blinkOf(p, t), { brow: o.brow == null ? 0.6 : o.brow });
    if (o.mouth !== false) A.mouth(ctx, r * 0.42, r * 0.38, r * 0.35, rc > 0.2 ? 'o' : 'flat', rc);
    ctx.restore();
  }
  /* Lanterne-pære (solplanter) */
  function lantern(ctx, x, y, r, p, t, glowA, col) {
    col = col || '#ffd23f';
    const pulse = 0.75 + Math.sin(t * 3 + (p.seed || 0)) * 0.25;
    A.glow(ctx, x, y, r * 2.4, col, 0.35 * pulse * (glowA == null ? 1 : glowA));
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.95, r, 0, 0, Math.PI * 2);
    ctx.fillStyle = A.rg(ctx, x, y, r, '#fffbe0', col); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
    // kalk-blade øverst
    A.poly(ctx, [x - r * 0.75, y - r * 0.55, x - r * 0.2, y - r * 1.25, x, y - r * 0.7, x + r * 0.2, y - r * 1.25, x + r * 0.75, y - r * 0.55, x, y - r * 0.85], '#5aa832', 2.4);
    A.shine(ctx, x - r * 0.38, y - r * 0.35, r * 0.22, r * 0.13, 0.8);
  }
  function happyFace(ctx, x, y, s, p, t, mouth) {
    const b = blinkOf(p, t);
    A.eye(ctx, x - s * 0.36, y - s * 0.1, s * 0.24, 0.3, 0.2, b);
    A.eye(ctx, x + s * 0.36, y - s * 0.1, s * 0.24, 0.3, 0.2, b);
    A.mouth(ctx, x, y + s * 0.35, s * 0.5, mouth || 'smile');
    ctx.fillStyle = 'rgba(255,110,120,.35)';
    ctx.beginPath(); ctx.ellipse(x - s * 0.62, y + s * 0.2, s * 0.14, s * 0.08, 0, 0, Math.PI * 2); ctx.ellipse(x + s * 0.62, y + s * 0.2, s * 0.14, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  }
  /* Skadestadier: revner oven på vægge */
  function cracks(ctx, p, x, y, s) {
    const f = p.hp / p.maxHp;
    if (f > 0.66) return;
    ctx.strokeStyle = k('#2a1b12'); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y - s * 0.6); ctx.lineTo(x - s * 0.2, y - s * 0.3); ctx.lineTo(x - s * 0.35, y); ctx.lineTo(x - s * 0.1, y + s * 0.25);
    if (f < 0.33) { ctx.moveTo(x + s * 0.55, y - s * 0.2); ctx.lineTo(x + s * 0.25, y + s * 0.05); ctx.lineTo(x + s * 0.4, y + s * 0.35); ctx.moveTo(x + s * 0.25, y + s * 0.05); ctx.lineTo(x + s * 0.05, y - s * 0.1); }
    ctx.stroke(); ctx.lineCap = 'butt';
  }
  function svamp(ctx, p, t, cap, spots, stemC) {
    const sw = sway(p, t, 0.03), rc = recoil(p);
    dirt(ctx, 18);
    ctx.save(); ctx.translate(0, 0); ctx.rotate(sw);
    A.rrect(ctx, -14, -34, 28, 34, 10, stemC || '#efe4c8', 3);
    const b = blinkOf(p, t);
    A.eye(ctx, -6, -20, 5, 0.6, 0, b); A.eye(ctx, 7, -20, 5, 0.6, 0, b);
    A.mouth(ctx, 2, -10, 10, rc > 0.2 ? 'o' : 'smile', rc);
    ctx.save(); ctx.translate(0, -34); ctx.scale(1 + rc * 0.15, 1 - rc * 0.15);
    ctx.beginPath(); ctx.moveTo(-30, 2); ctx.bezierCurveTo(-32, -34, 32, -34, 30, 2); ctx.quadraticCurveTo(0, 8, -30, 2); ctx.closePath();
    ctx.fillStyle = A.rg(ctx, 0, -12, 30, U.shade(cap, 0.25), U.shade(cap, -0.2)); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
    ctx.fillStyle = k(spots);
    [[-14, -12, 6], [6, -18, 5], [16, -6, 4], [-3, -4, 3.5]].forEach((s) => { ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, Math.PI * 2); ctx.fill(); });
    A.shine(ctx, -12, -20, 8, 4);
    ctx.restore(); ctx.restore();
  }

  /* ---------------------------------------------------------------
     Fælles adfærd
     --------------------------------------------------------------- */
  function hasTarget(G, p, o) {
    o = o || {};
    const x1 = o.range ? p.x + o.range * G.CW : G.W + 40;
    return G.firstZombieInRow(p.r, p.x - 10, x1, o);
  }
  /* Standard skydeplante: skyder hvis der er mål foran i rækken */
  function shooterTick(fire, o) {
    o = o || {};
    return function (p, dt, G) {
      p.cool -= dt * p.haste;
      if (p.pp > 0) {
        p.ppT = (p.ppT || 0) - dt;
        if (p.ppT <= 0) { p.ppT = o.ppRate || 0.07; fire(p, G, true); }
        return;
      }
      if (p.cool <= 0) {
        if (o.always || hasTarget(G, p, o)) { fire(p, G, false); p.cool = p.s.rate; }
        else p.cool = 0.15;
      }
    };
  }
  function produceTick(p, dt, G, amount, n) {
    p.prod -= dt * p.haste;
    if (p.prod <= 0) {
      p.prod = p.s.interval * U.rand(0.92, 1.08);
      p.glowT = 1;
      for (let i = 0; i < (n || 1); i++) G.makeSun(p.x + (i - (n - 1) / 2) * 20, p.y - 60, Math.round(amount * p.prodMul), { from: p });
    }
    if (p.glowT > 0) p.glowT -= dt * 1.5;
  }
  const muzzle = (p, dx, dy) => ({ x: p.x + (dx == null ? 46 : dx), y: p.y + (dy == null ? -58 : dy) });

  /* ---------------------------------------------------------------
     Plantedata
     --------------------------------------------------------------- */
  const L = [];
  function def(d) { L.push(d); return d; }

  /* ================= RESSOURCE ================= */
  def({
    id: 'solspire', name: 'Solspire', cat: 'resource', cost: 50, cd: 7.5, hp: 300, interval: 24, produce: 25,
    desc: 'En lille lanternespire, der samler sollys i sin pære og slipper det løs som sol.',
    special: 'Producerer 25 sol hver ~24 sek.', pp: 'Udsender straks 150 sol.',
    perks: ['Lv3: Første sol kommer meget hurtigere', 'Lv5: Hver 4. sol er dobbelt stor'],
    crest: [0, -86],
    init(p) { p.prod = p.lv >= 3 ? U.rand(2, 4) : U.rand(5, 10); p.count = 0; },
    tick(p, dt, G) {
      p.prod -= dt * p.haste;
      if (p.prod <= 0) {
        p.prod = p.s.interval * U.rand(0.92, 1.08); p.glowT = 1; p.count++;
        const big = p.lv >= 5 && p.count % 4 === 0;
        G.makeSun(p.x, p.y - 70, Math.round(p.s.produce * p.prodMul * (big ? 2 : 1)), { from: p });
      }
      if (p.glowT > 0) p.glowT -= dt * 1.5;
    },
    power(p, G) { for (let i = 0; i < 6; i++) G.makeSun(p.x + U.rand(-40, 40), p.y - 60 - U.rand(0, 30), Math.round(25 * p.ppMul), { from: p, burst: true }); },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.08), g = p.glowT > 0 ? p.glowT : 0;
      dirt(ctx);
      baseLeaves(ctx, '#55a832', 0.1, 0.95);
      A.leaf(ctx, 0, -26, 22, 8, -0.9 + sw, '#64b93a');
      const hx = sw * 60, hy = -66 - g * 4;
      A.stem(ctx, 0, -2, hx, hy + 18, 12 + sw * 40, 6, '#4f9e2c');
      lantern(ctx, hx, hy, 20 + g * 3, p, t, 1 + g);
      happyFace(ctx, hx, hy + 3, 16, p, t, g > 0.2 ? 'grin' : 'smile');
    },
  });
  def({
    id: 'tvillinglys', name: 'Tvillinglys', cat: 'resource', cost: 125, cd: 10, hp: 300, interval: 24, produce: 25,
    desc: 'To lanterner på én stængel. Dyr at plante, men den betaler sig hurtigt tilbage.',
    special: 'Producerer 2 × 25 sol hver ~24 sek.', pp: 'Udsender straks 250 sol.',
    perks: ['Lv3: +10% sol pr. pære', 'Lv5: Producerer 3 sole'],
    crest: [0, -90],
    init(p) { p.prod = U.rand(6, 10); },
    tick(p, dt, G) { produceTick(p, dt, G, p.s.produce * (p.lv >= 3 ? 1.1 : 1), p.lv >= 5 ? 3 : 2); },
    power(p, G) { for (let i = 0; i < 10; i++) G.makeSun(p.x + U.rand(-45, 45), p.y - 60 - U.rand(0, 40), Math.round(25 * p.ppMul), { from: p, burst: true }); },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.06), g = p.glowT > 0 ? p.glowT : 0;
      dirt(ctx);
      baseLeaves(ctx, '#55a832', 0.15, 1);
      A.stem(ctx, 0, -2, -18 + sw * 50, -58, -10, 6, '#4f9e2c');
      A.stem(ctx, 0, -2, 20 + sw * 50, -70, 10, 6, '#4f9e2c');
      lantern(ctx, -20 + sw * 50, -72 - g * 3, 17 + g * 2, p, t, 1 + g, '#ffc83a');
      happyFace(ctx, -20 + sw * 50, -69 - g * 3, 13, p, t);
      lantern(ctx, 22 + sw * 50, -84 - g * 3, 17 + g * 2, p, t, 1 + g, '#ffe066');
      happyFace(ctx, 22 + sw * 50, -81 - g * 3, 13, p, t, g > 0.2 ? 'grin' : 'smile');
    },
  });
  def({
    id: 'solkrukke', name: 'Solkrukke', cat: 'resource', cost: 75, cd: 15, hp: 400, interval: 46, produce: 125,
    desc: 'En kandeplante, der langsomt fyldes med flydende sollys og tømmer det på én gang.',
    special: 'Fyldes over ~46 sek. og udløser derefter 125 sol.', pp: 'Fyldes helt og tømmes 2 gange.',
    perks: ['Lv3: Udløser også en mønt', 'Lv5: 150 sol pr. tømning'],
    crest: [0, -84],
    init(p) { p.prod = p.s.interval * 0.8; },
    tick(p, dt, G) {
      p.prod -= dt * p.haste;
      if (p.prod <= 0) {
        p.prod = p.s.interval; p.glowT = 1;
        G.makeSun(p.x, p.y - 70, Math.round((p.lv >= 5 ? 150 : p.s.produce) * p.prodMul), { from: p, big: true });
        if (p.lv >= 3) G.makeCoin(p.x + 20, p.y - 50, 'silver');
      }
      if (p.glowT > 0) p.glowT -= dt;
    },
    power(p, G) { for (let i = 0; i < 2; i++) G.makeSun(p.x + (i ? 25 : -25), p.y - 70, Math.round(125 * p.ppMul), { from: p, big: true, burst: true }); p.prod = p.s.interval; },
    draw(ctx, p, t) {
      const fill = 1 - U.clamp(p.prod / (p.s ? p.s.interval : 46), 0, 1);
      const sw = sway(p, t, 0.03);
      dirt(ctx, 26);
      baseLeaves(ctx, '#3f8f3a', 0.3, 1.1);
      ctx.save(); ctx.rotate(sw);
      // krukke
      ctx.beginPath();
      ctx.moveTo(-16, -6); ctx.bezierCurveTo(-34, -20, -30, -58, -14, -66); ctx.lineTo(14, -66); ctx.bezierCurveTo(30, -58, 34, -20, 16, -6); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -66, -6, '#9bd36a', '#3f8f3a'); ctx.fill();
      ctx.save(); ctx.clip();
      const ly = -8 - fill * 56;
      A.glow(ctx, 0, ly + 10, 40, '#ffd23f', 0.5 * fill);
      ctx.fillStyle = k('#ffd23f'); ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.moveTo(-40, ly + Math.sin(t * 3) * 2); ctx.quadraticCurveTo(0, ly - 4 + Math.sin(t * 3 + 1) * 3, 40, ly); ctx.lineTo(40, 0); ctx.lineTo(-40, 0); ctx.fill();
      ctx.globalAlpha = 1; ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.ell(ctx, 0, -66, 17, 6, 0, '#2f6e2a', 3);
      ctx.fillStyle = k('#ffe680'); ctx.globalAlpha = 0.5 + fill * 0.5; ctx.beginPath(); ctx.ellipse(0, -66, 12, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      A.leaf(ctx, 10, -68, 22, 9, -0.9, '#62b33f');
      happyFace(ctx, 0, -32, 14, p, t, fill > 0.9 ? 'grin' : 'smile');
      A.shine(ctx, -16, -48, 4, 10);
      ctx.restore();
    },
  });
  def({
    id: 'guldknop', name: 'Guldknop', cat: 'resource', cost: 100, cd: 10, hp: 300, interval: 26, produce: 25,
    desc: 'En forgyldt knop. Producerer sol - og jo mere den opgraderes, jo oftere drysser den mønter.',
    special: 'Producerer 25 sol og har chance for en mønt (stiger med niveau).', pp: 'Sender 75 sol og en regn af mønter.',
    perks: ['Lv3: Kan droppe guldmønter', 'Lv5: Kan droppe ædelsten'],
    crest: [0, -86],
    init(p) { p.prod = U.rand(6, 11); },
    tick(p, dt, G) {
      p.prod -= dt * p.haste;
      if (p.prod <= 0) {
        p.prod = p.s.interval * U.rand(0.92, 1.08); p.glowT = 1;
        G.makeSun(p.x, p.y - 70, Math.round(p.s.produce * p.prodMul), { from: p });
        if (Math.random() < 0.15 + 0.06 * p.lv) G.makeCoin(p.x + 18, p.y - 60, p.lv >= 3 && Math.random() < 0.35 ? 'gold' : 'silver');
        if (p.lv >= 5 && Math.random() < 0.04) G.makeCoin(p.x - 18, p.y - 60, 'gem');
      }
      if (p.glowT > 0) p.glowT -= dt * 1.5;
    },
    power(p, G) { for (let i = 0; i < 3; i++) G.makeSun(p.x + U.rand(-30, 30), p.y - 70, 25, { from: p, burst: true }); for (let i = 0; i < 6; i++) G.makeCoin(p.x + U.rand(-40, 40), p.y - 60, i < 2 ? 'gold' : 'silver'); },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.06), g = p.glowT > 0 ? p.glowT : 0;
      dirt(ctx);
      baseLeaves(ctx, '#7aa832', 0.1, 1);
      const hx = sw * 50, hy = -64;
      A.stem(ctx, 0, -2, hx, hy + 16, 8, 6, '#6f9a2c');
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(t * 0.6);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        A.circ(ctx, Math.cos(a) * 22, Math.sin(a) * 22, 9, i % 2 ? '#ffcf3a' : '#f2b21e', 2.4);
        ctx.fillStyle = k('#c98a12'); ctx.fillRect(Math.cos(a) * 22 - 1.5, Math.sin(a) * 22 - 4, 3, 8);
      }
      ctx.restore();
      A.glow(ctx, hx, hy, 40, '#ffd23f', 0.25 + g * 0.4);
      A.ball(ctx, hx, hy, 18, '#fff1a8', '#e6a817');
      happyFace(ctx, hx, hy + 2, 14, p, t, 'grin');
    },
  });
  def({
    id: 'maaneblomst', name: 'Måneblomst', cat: 'resource', cost: 25, cd: 7.5, hp: 300, interval: 24, produce: 15,
    desc: 'En bleg natblomst, der lever af måneskin. Starter lille og vokser sig stærkere.',
    special: 'Giver 15 sol - vokser efter 60 sek. og giver så 25 sol.', pp: 'Vokser straks fuldt og udsender 100 sol.',
    perks: ['Lv3: Vokser efter 40 sek.', 'Lv5: Fuldvoksen giver 35 sol'],
    crest: [0, -74],
    init(p) { p.prod = U.rand(5, 9); p.grow = 0; },
    tick(p, dt, G) {
      p.grow += dt;
      const big = p.grow > (p.lv >= 3 ? 40 : 60);
      produceTick(p, dt, G, big ? (p.lv >= 5 ? 35 : 25) * (p.s.produce / 15) : p.s.produce, 1);
    },
    power(p, G) { p.grow = 999; for (let i = 0; i < 4; i++) G.makeSun(p.x + U.rand(-30, 30), p.y - 60, Math.round(25 * p.ppMul), { from: p, burst: true }); },
    draw(ctx, p, t) {
      const big = (p.grow || 0) > (p.lv >= 3 ? 40 : 60);
      const s = big ? 1 : 0.78, sw = sway(p, t, 0.05);
      dirt(ctx, 18);
      ctx.save(); ctx.scale(s, s);
      baseLeaves(ctx, '#4a8f7a', 0.2, 0.9);
      A.stem(ctx, 0, -2, sw * 40, -50, 6, 5, '#3f7f6c');
      const hx = sw * 40, hy = -62;
      A.glow(ctx, hx, hy, 46, '#b8d8ff', 0.4);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 0.2;
        A.ell(ctx, hx + Math.cos(a) * 15, hy + Math.sin(a) * 15, 13, 7, a, '#dfe9ff', 2.2);
      }
      A.ball(ctx, hx, hy, 14, '#ffffff', '#9fbfff');
      ctx.fillStyle = k('#6e86c9'); ctx.beginPath(); ctx.arc(hx + 4, hy - 2, 9, 0, Math.PI * 2); ctx.arc(hx + 8, hy - 5, 8, 0, Math.PI * 2, true); ctx.fill();
      const b = blinkOf(p, t);
      A.eye(ctx, hx - 5, hy + 1, 3.5, 0, 0, Math.max(b, 0.5)); A.eye(ctx, hx + 5, hy + 1, 3.5, 0, 0, Math.max(b, 0.5));
      A.mouth(ctx, hx, hy + 7, 7, 'smile');
      ctx.restore();
    },
  });

  /* ================= ANGREB ================= */
  def({
    id: 'kernekanon', name: 'Kernekanon', cat: 'attack', cost: 100, cd: 7.5, hp: 300, dmg: 20, rate: 1.45,
    desc: 'Grejs-havens trofaste soldat. Skyder hårde kerner lige frem i sin række.',
    special: 'Skyder én kerne ad gangen lige frem.', pp: 'Affyrer en massiv salve af 40 kerner.',
    perks: ['Lv3: 15% chance for dobbeltskud', 'Lv5: Kernerne gennemborer 1 ekstra zombie'],
    crest: [-6, -84], muzzle: [46, -58],
    init(p) { p.cool = U.rand(0.3, 1.2); },
    tick: shooterTick(function (p, G, pp) {
      const m = muzzle(p);
      const spec = { kind: 'seed', dmg: p.s.dmg * (pp ? 1.5 : 1), speed: 520, pierce: p.lv >= 5 ? 2 : 1, big: pp };
      G.shoot(p, m.x, m.y + (pp ? U.rand(-6, 6) : 0), spec);
      if (!pp && p.lv >= 3 && Math.random() < 0.15) G.later(0.15, () => G.shoot(p, m.x, m.y, spec));
    }, { ppRate: 0.075 }),
    power(p) { p.pp = 3; },
    draw(ctx, p, t) {
      shooter(ctx, p, t, {
        c1: '#8fe05a', c2: '#3c9a2a', deco(c, r) { A.leaf(c, -r * 0.7, -r * 0.6, 22, 8, -2.4, '#4fae34'); },
      });
    },
  });
  def({
    id: 'pebberpuffer', name: 'Pebberpuffer', cat: 'attack', cost: 175, cd: 7.5, hp: 300, dmg: 18, rate: 0.72,
    desc: 'En hidsig chili med to løb. Skyder dobbelt så hurtigt som en Kernekanon.',
    special: 'Hurtigskydende: skyder cirka hvert 0,7 sek.', pp: 'Skyder et tæppe af brændende peberkorn i 3 sek.',
    perks: ['Lv3: Skud efterlader en lille brand', 'Lv5: +20% skudhastighed'],
    crest: [-2, -88], muzzle: [50, -58],
    init(p) { p.cool = U.rand(0.2, 0.8); if (p.lv >= 5) p.s.rate *= 0.8; },
    tick: shooterTick(function (p, G, pp) {
      const m = muzzle(p, 50);
      G.shoot(p, m.x, m.y + (p.alt = !p.alt) * 8 - 4, { kind: 'pepper', dmg: p.s.dmg, speed: 600, burn: pp || p.lv >= 3 ? 3 : 0, big: pp });
    }, { ppRate: 0.05 }),
    power(p) { p.pp = 3; },
    draw(ctx, p, t) {
      shooter(ctx, p, t, {
        c1: '#ff6a4d', c2: '#b8241b', r: 22, muzzleLen: 22,
        deco(c, r) {
          A.poly(c, [-r * 0.6, -r * 0.75, -r * 0.1, -r * 1.25, r * 0.3, -r * 0.8, 0, -r * 0.7], '#4ea52f', 2.4);
          A.rrect(c, r * 0.55, 6, 18, 9, 4, '#e0442f', 2.2);
        },
        brow: 1,
      });
    },
  });
  def({
    id: 'piggebold', name: 'Piggebold', cat: 'attack', cost: 125, cd: 7.5, hp: 300, dmg: 20, rate: 1.6,
    desc: 'En stikkende kugle, der skyder pigge i seks retninger - også bagud og skråt.',
    special: 'Skyder i 6 retninger (rammer zombier i andre rækker og bag sig).', pp: 'Roterende pigstorm i alle retninger i 3 sek.',
    perks: ['Lv3: Piggene flyver længere og hurtigere', 'Lv5: 8 retninger'],
    crest: [0, -78],
    init(p) { p.cool = U.rand(0.3, 1); },
    tick(p, dt, G) {
      p.cool -= dt * p.haste;
      const fire = (rot) => {
        const n = p.lv >= 5 ? 8 : 6, sp = p.lv >= 3 ? 520 : 440;
        for (let i = 0; i < n; i++) {
          const a = rot + (i / n) * Math.PI * 2;
          G.shoot(p, p.x, p.y - 48, { kind: 'spike', dmg: p.s.dmg, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, free: true, life: 2.2 });
        }
      };
      if (p.pp > 0) { p.ppT = (p.ppT || 0) - dt; if (p.ppT <= 0) { p.ppT = 0.12; p.rot = (p.rot || 0) + 0.27; fire(p.rot); } return; }
      if (p.cool <= 0) {
        if (G.anyZombieOnLawn()) { fire(0); p.cool = p.s.rate; } else p.cool = 0.3;
      }
    },
    power(p) { p.pp = 3; },
    draw(ctx, p, t) {
      const rc = recoil(p), sw = sway(p, t, 0.04);
      dirt(ctx);
      baseLeaves(ctx, '#4c9a2a', 0.2, 0.9);
      A.stem(ctx, 0, -2, sw * 30, -36, 4, 6);
      ctx.save(); ctx.translate(sw * 30, -48); ctx.scale(1 + rc * 0.15, 1 + rc * 0.15); ctx.rotate((p.rot || 0) * 0.5);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        A.poly(ctx, [Math.cos(a - 0.18) * 20, Math.sin(a - 0.18) * 20, Math.cos(a) * 34, Math.sin(a) * 34, Math.cos(a + 0.18) * 20, Math.sin(a + 0.18) * 20], '#f6d36b', 2);
      }
      ctx.restore();
      A.ball(ctx, sw * 30, -48, 23, '#d58cff', '#7a3fb8');
      happyFace(ctx, sw * 30, -46, 15, p, t, rc > 0.2 ? 'o' : 'grin');
    },
  });
  def({
    id: 'tornlanse', name: 'Tornlanse', cat: 'attack', cost: 150, cd: 7.5, hp: 300, dmg: 26, rate: 1.9,
    desc: 'En rosenknop med en lansespids. Dens torne gennemborer alle zombier i rækken.',
    special: 'Tornene gennemborer ALLE zombier i rækken.', pp: 'Skyder 5 kæmpetorne, der skader 3×.',
    perks: ['Lv3: Torne ignorerer skjolde', 'Lv5: +30% skade mod rustning'],
    crest: [-4, -96], muzzle: [52, -70],
    init(p) { p.cool = U.rand(0.3, 1.2); },
    tick: shooterTick(function (p, G, pp) {
      const m = muzzle(p, 52, -70);
      G.shoot(p, m.x, m.y, { kind: 'thorn', dmg: p.s.dmg * (pp ? 3 : 1), speed: 640, pierce: 99, bypassShield: p.lv >= 3, armorMul: p.lv >= 5 ? 1.3 : 1, big: pp });
    }, { ppRate: 0.25 }),
    power(p) { p.pp = 1.2; },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.04), rc = recoil(p);
      dirt(ctx);
      baseLeaves(ctx, '#3e8a35', 0.1, 1);
      A.stem(ctx, 0, -2, sw * 30, -60, -4, 6, '#3e7a2a');
      for (let i = 0; i < 3; i++) A.poly(ctx, [-3, -14 - i * 15, -11, -18 - i * 15, -3, -22 - i * 15], '#d9c6a0', 1.5);
      ctx.save(); ctx.translate(sw * 30 - rc * 6, -72);
      A.poly(ctx, [10, -6, 58 + rc * 6, 0, 10, 6], '#efe2bd', 2.4);
      ctx.beginPath(); ctx.moveTo(-18, 10); ctx.bezierCurveTo(-26, -14, -6, -30, 4, -24); ctx.bezierCurveTo(22, -16, 22, 8, 12, 14); ctx.quadraticCurveTo(0, 20, -18, 10); ctx.closePath();
      ctx.fillStyle = A.rg(ctx, 0, -4, 24, '#ff6b7a', '#9b1730'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, -14); ctx.quadraticCurveTo(4, -6, -2, 8); ctx.strokeStyle = k('#7a0f22'); ctx.lineWidth = 2; ctx.stroke();
      A.poly(ctx, [-16, 10, -6, 18, 4, 12, 14, 16, 12, 6], '#4a9a2c', 2.2);
      A.eye(ctx, 6, -6, 6, 0.8, 0, blinkOf(p, t), { brow: 0.9 });
      ctx.restore();
    },
  });
  def({
    id: 'bombebaer', name: 'Bombebær', cat: 'attack', cost: 200, cd: 7.5, hp: 300, dmg: 40, rate: 3, splash: 70,
    desc: 'En busk med eksplosive bær, som den kaster i en bue hen over skjolde og forhindringer.',
    special: 'Kaster eksplosive bær (områdeskade). Rammer over skjolde og gravsten.', pp: 'Bombarderer hele banen med 12 bær.',
    perks: ['Lv3: Større eksplosionsradius', 'Lv5: Bær splitter i 3 småbomber'],
    crest: [0, -82],
    init(p) { p.cool = U.rand(0.5, 1.5); },
    tick(p, dt, G) {
      p.cool -= dt * p.haste;
      if (p.cool <= 0) {
        const z = hasTarget(G, p, { lob: true });
        if (z) {
          p.shootT = 0;
          G.lob(p, p.x + 20, p.y - 70, z, { kind: 'berry', dmg: p.s.dmg, splash: p.s.splash * (p.lv >= 3 ? 1.3 : 1), cluster: p.lv >= 5 });
          p.cool = p.s.rate;
        } else p.cool = 0.2;
      }
    },
    power(p, G) {
      const zs = G.zombies.filter((z) => z.alive && !z.under);
      for (let i = 0; i < 12; i++) {
        const z = zs.length ? U.pick(zs) : null;
        const tgt = z || { x: U.rand(G.X0 + 200, G.X0 + 900), y: G.rowY(U.randi(0, G.rows - 1)), fake: true };
        G.later(i * 0.12, () => G.lob(p, p.x + 20, p.y - 70, tgt, { kind: 'berry', dmg: p.s.dmg * 2 * p.ppMul, splash: 90, big: true }));
      }
    },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.04), rc = recoil(p);
      dirt(ctx, 26);
      A.ell(ctx, 0, -22, 30, 22, 0, '#3f8a3a', 3);
      A.speckle(ctx, -24, -38, 48, 30, 10, '#2e6e2a', 3, 2);
      A.leaf(ctx, -20, -30, 22, 9, -2.3, '#55a840');
      A.leaf(ctx, 20, -30, 22, 9, -0.8, '#55a840');
      const arm = -0.9 + (rc > 0 ? rc * 1.6 : Math.sin(t * 2) * 0.05);
      ctx.save(); ctx.translate(-6, -36); ctx.rotate(arm + sw);
      A.stem(ctx, 0, 0, 0, -32, 4, 5, '#4a8f2c');
      A.ell(ctx, 0, -36, 13, 6, 0, '#4fae34', 2.4);
      if (!(p.shootT < 0.5)) { A.ball(ctx, 0, -44, 11, '#7aa0ff', '#20307a'); A.circ(ctx, -3, -55, 2, '#ffb347', 0); }
      ctx.restore();
      A.ball(ctx, -14, -18, 9, '#7aa0ff', '#20307a'); A.ball(ctx, 2, -12, 9, '#7aa0ff', '#20307a'); A.ball(ctx, 15, -20, 9, '#7aa0ff', '#20307a');
      const b = blinkOf(p, t);
      A.eye(ctx, -9, -30, 5, 0.6, 0, b, { brow: 0.7 }); A.eye(ctx, 7, -30, 5, 0.6, 0, b, { brow: -0.7 });
      A.mouth(ctx, 0, -20, 10, 'grin');
    },
  });
  def({
    id: 'grenskyder', name: 'Grenskyder', cat: 'attack', cost: 300, cd: 7.5, hp: 300, dmg: 20, rate: 1.45,
    desc: 'Tre hoveder på én gren. Skyder i sin egen række og i begge naborækker.',
    special: 'Skyder i 3 rækker på én gang.', pp: 'Salve af 30 kerner i hver af de 3 rækker.',
    perks: ['Lv3: Midterhovedet skyder dobbelt', 'Lv5: +1 gennemboring'],
    crest: [-6, -100],
    init(p) { p.cool = U.rand(0.3, 1.2); },
    tick(p, dt, G) {
      p.cool -= dt * p.haste;
      const fire = (big) => {
        p.shootT = 0;
        for (let d = -1; d <= 1; d++) {
          const rr = p.r + d;
          if (rr < 0 || rr >= G.rows) continue;
          const sy = p.y - 58 + d * 16;
          G.shoot(p, p.x + 44, sy, { kind: 'seed', dmg: p.s.dmg * (big ? 1.4 : 1), speed: 520, toRow: rr, pierce: p.lv >= 5 ? 2 : 1, big, color: '#ffb84a' });
          if (d === 0 && p.lv >= 3 && !big) G.later(0.15, () => G.shoot(p, p.x + 44, sy, { kind: 'seed', dmg: p.s.dmg, speed: 520, color: '#ffb84a' }));
        }
      };
      if (p.pp > 0) { p.ppT = (p.ppT || 0) - dt; if (p.ppT <= 0) { p.ppT = 0.1; fire(true); } return; }
      if (p.cool <= 0) {
        let any = false;
        for (let d = -1; d <= 1; d++) if (p.r + d >= 0 && p.r + d < G.rows && G.firstZombieInRow(p.r + d, p.x - 10, G.W + 40, {})) any = true;
        if (any) { fire(false); p.cool = p.s.rate; } else p.cool = 0.15;
      }
    },
    power(p) { p.pp = 3; },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.04), rc = recoil(p);
      dirt(ctx);
      baseLeaves(ctx, '#6a9a2a', 0, 1);
      A.stem(ctx, 0, -2, sw * 20, -40, 0, 8, '#6a8a2a');
      const heads = [[-4, -78, -0.15], [10, -58, 0], [-2, -38, 0.18]];
      heads.forEach((h, i) => {
        A.stem(ctx, sw * 20, -40, h[0] + sw * 30, h[1], (i - 1) * 8, 5, '#6a8a2a');
      });
      heads.forEach((h) => {
        ctx.save(); ctx.translate(h[0] + sw * 30 - rc * 4, h[1]); ctx.rotate(h[2]);
        A.rrect(ctx, 8, -6, 18, 12, 5, '#ffb84a', 2.2);
        A.ell(ctx, 26, 0, 4, 7, 0, '#a8661a', 2); ctx.fillStyle = k('#1a0f08'); ctx.beginPath(); ctx.ellipse(27, 0, 2, 4, 0, 0, Math.PI * 2); ctx.fill();
        A.ball(ctx, 0, 0, 15, '#ffd27a', '#d6801c');
        A.eye(ctx, 2, -3, 5, 0.7, 0, blinkOf(p, t + h[1]), { brow: 0.6 });
        ctx.restore();
      });
    },
  });
  def({
    id: 'laserlilje', name: 'Laserlilje', cat: 'attack', cost: 200, cd: 7.5, hp: 300, dmg: 50, rate: 3.2,
    desc: 'En elegant lilje, der lader sollys op i sin trompet og affyrer en laserstråle.',
    special: 'Laserstrålen rammer ALLE zombier i rækken på én gang.', pp: 'Kontinuerlig kæmpelaser i 3 sek.',
    perks: ['Lv3: Laseren rammer også flyvende zombier', 'Lv5: Strålen rammer også naborækkerne svagt'],
    crest: [0, -100],
    init(p) { p.cool = U.rand(0.5, 1.5); p.charge = 0; },
    tick(p, dt, G) {
      p.cool -= dt * p.haste;
      if (p.pp > 0) {
        p.charge = 1; p.ppT = (p.ppT || 0) - dt;
        if (p.ppT <= 0) { p.ppT = 0.15; G.beam(p, p.r, p.y - 72, { dmg: p.s.dmg * 0.5 * p.ppMul, air: true, big: true }); }
        return;
      }
      if (p.charge > 0) {
        p.charge += dt * 2.2;
        if (p.charge >= 1) {
          p.charge = 0; p.shootT = 0;
          G.beam(p, p.r, p.y - 72, { dmg: p.s.dmg, air: p.lv >= 3 });
          if (p.lv >= 5) for (const d of [-1, 1]) if (p.r + d >= 0 && p.r + d < G.rows) G.beam(p, p.r + d, G.rowY(p.r + d) - 60, { dmg: p.s.dmg * 0.35, thin: true });
          p.cool = p.s.rate;
        }
      } else if (p.cool <= 0) {
        if (hasTarget(G, p, { air: p.lv >= 3 })) p.charge = 0.01; else p.cool = 0.2;
      }
    },
    power(p) { p.pp = 3; },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.03), ch = p.charge || 0;
      dirt(ctx);
      baseLeaves(ctx, '#3f9a5a', 0.05, 1.1);
      A.leaf(ctx, 0, -30, 30, 8, -2.6, '#4ab06a');
      A.stem(ctx, 0, -2, sw * 30, -64, -8, 6, '#3f8a4a');
      ctx.save(); ctx.translate(sw * 30, -72);
      if (ch > 0 || p.pp > 0) A.glow(ctx, 30, 0, 30 + ch * 20, '#ff6bd5', 0.4 + ch * 0.4);
      for (let i = -1; i <= 1; i++) {
        ctx.save(); ctx.rotate(i * 0.55);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(14, -16, 38, -14, 44, -2); ctx.bezierCurveTo(36, 4, 18, 8, 0, 0);
        ctx.fillStyle = A.vg(ctx, -16, 8, '#ffffff', '#ffb3e6'); ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = k(A.INK); ctx.stroke();
        ctx.restore();
      }
      A.ell(ctx, 30, 0, 7, 13, 0, '#ff6bd5', 2.4);
      ctx.fillStyle = k('#ffe9fa'); ctx.globalAlpha = 0.3 + ch * 0.7; ctx.beginPath(); ctx.ellipse(31, 0, 4, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      A.circ(ctx, 0, 0, 10, '#ffd6f0', 2.4);
      A.eye(ctx, 1, -1, 4.5, 0.8, 0, blinkOf(p, t), { brow: 0.5 });
      ctx.restore();
    },
  });
  def({
    id: 'lynklover', name: 'Lynkløver', cat: 'attack', cost: 225, cd: 7.5, hp: 300, dmg: 30, rate: 2.2, chain: 4,
    desc: 'En firkløver ladet med statisk elektricitet. Dens lyn springer fra zombie til zombie.',
    special: 'Lyn, der kæder videre til op til 4 zombier (også flyvende). Rækkevidde 5 felter.', pp: 'Lynstorm: kæder gennem ALLE zombier på banen.',
    perks: ['Lv3: +2 kædespring', 'Lv5: Lyn lammer zombier kort'],
    crest: [0, -92],
    init(p) { p.cool = U.rand(0.4, 1.4); },
    tick(p, dt, G) {
      p.cool -= dt * p.haste;
      if (p.cool <= 0) {
        const z = hasTarget(G, p, { range: 5, air: true });
        if (z) {
          p.shootT = 0;
          G.chain(p.x + 10, p.y - 64, z, { dmg: p.s.dmg, jumps: p.s.chain + (p.lv >= 3 ? 2 : 0), stun: p.lv >= 5 ? 0.4 : 0 });
          p.cool = p.s.rate;
        } else p.cool = 0.2;
      }
    },
    power(p, G) {
      const zs = G.zombies.filter((z) => z.alive && !z.under);
      if (zs.length) G.chain(p.x + 10, p.y - 64, zs[0], { dmg: p.s.dmg * 3 * p.ppMul, jumps: 99, range: 9999, stun: 1.5, big: true });
    },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.05), rc = recoil(p);
      dirt(ctx);
      baseLeaves(ctx, '#2f9a7a', 0.1, 0.95);
      A.stem(ctx, 0, -2, sw * 30, -52, 6, 6, '#2f8a6a');
      ctx.save(); ctx.translate(sw * 30, -64); ctx.rotate(Math.sin(t * 1.5) * 0.08);
      if (rc > 0 || Math.random() < 0.04) A.glow(ctx, 0, 0, 50, '#7ff6ff', 0.5);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        ctx.save(); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-14, -10, -16, -30, 0, -26); ctx.bezierCurveTo(16, -30, 14, -10, 0, 0);
        ctx.fillStyle = A.vg(ctx, -30, 0, '#9effe8', '#22a58a'); ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = k(A.INK); ctx.stroke();
        ctx.restore();
      }
      A.circ(ctx, 0, 0, 11, '#c9fff5', 2.4);
      happyFace(ctx, 0, 1, 9, p, t, rc > 0.2 ? 'grin' : 'smile');
      ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 2;
      if (Math.sin(t * 9 + (p.seed || 0)) > 0.6) { ctx.beginPath(); ctx.moveTo(18, -18); ctx.lineTo(24, -26); ctx.lineTo(21, -27); ctx.lineTo(28, -36); ctx.stroke(); }
      ctx.restore();
    },
  });
  def({
    id: 'giftsvamp', name: 'Giftsvamp', cat: 'attack', cost: 125, cd: 7.5, hp: 300, dmg: 10, rate: 1.6, range: 4,
    desc: 'En lilla svamp, der spytter giftige sporer. Giften går lige igennem rustning.',
    special: 'Gift (skade over tid) der ignorerer rustning. Rækkevidde 4 felter.', pp: 'Udsender en giftsky over 3×3 felter.',
    perks: ['Lv3: Rækkevidde 6 felter', 'Lv5: Giften spreder sig til nabozombier'],
    crest: [0, -74],
    init(p) { p.cool = U.rand(0.3, 1); },
    tick(p, dt, G) {
      p.cool -= dt * p.haste;
      if (p.cool <= 0) {
        if (hasTarget(G, p, { range: p.lv >= 3 ? 6 : p.s.range })) {
          p.shootT = 0;
          G.shoot(p, p.x + 26, p.y - 36, { kind: 'spore', dmg: p.s.dmg, speed: 380, poison: { dps: p.s.dmg * 1.1, dur: 4 }, spread: p.lv >= 5, maxX: p.x + (p.lv >= 3 ? 6 : p.s.range) * G.CW });
          p.cool = p.s.rate;
        } else p.cool = 0.2;
      }
    },
    power(p, G) { G.poisonCloud(p.x + G.CW, p.y - 30, 1.5 * G.CW, 8, 40 * p.ppMul); },
    draw(ctx, p, t) { svamp(ctx, p, t, '#a34fd6', '#9cff6b'); },
  });
  def({
    id: 'graeskarkaster', name: 'Græskarkaster', cat: 'attack', cost: 325, cd: 7.5, hp: 300, dmg: 80, rate: 3.6, splash: 60,
    desc: 'En slyngeplante, der kyler tunge græskar i en høj bue. Langsom, men knusende.',
    special: 'Tunge projektiler med stor skade + områdeskade. Rammer over skjolde.', pp: 'Kaster et kæmpegræskar mod hver zombie (op til 8).',
    perks: ['Lv3: Efterlader klistret græskarsuppe (gør langsom)', 'Lv5: +25% skade'],
    crest: [-10, -90],
    init(p) { p.cool = U.rand(0.5, 2); },
    tick(p, dt, G) {
      p.cool -= dt * p.haste;
      if (p.cool <= 0) {
        const z = hasTarget(G, p, { lob: true });
        if (z) {
          p.shootT = 0;
          G.lob(p, p.x - 10, p.y - 80, z, { kind: 'pumpkin', dmg: p.s.dmg * (p.lv >= 5 ? 1.25 : 1), splash: p.s.splash, slow: p.lv >= 3, dur: 1.15 });
          p.cool = p.s.rate;
        } else p.cool = 0.2;
      }
    },
    power(p, G) {
      const zs = G.zombies.filter((z) => z.alive && !z.under).slice(0, 8);
      zs.forEach((z, i) => G.later(i * 0.15, () => G.lob(p, p.x - 10, p.y - 80, z, { kind: 'pumpkin', dmg: p.s.dmg * 3 * p.ppMul, splash: 80, big: true, dur: 1 })));
    },
    draw(ctx, p, t) {
      const rc = p.shootT != null && p.shootT < 0.5 ? Math.sin((p.shootT / 0.5) * Math.PI) : 0;
      dirt(ctx, 28);
      A.ell(ctx, 0, -10, 32, 14, 0, '#4b8a32', 3);
      A.leaf(ctx, -26, -10, 22, 10, Math.PI + 0.3, '#5aa838'); A.leaf(ctx, 26, -10, 22, 10, -0.3, '#5aa838');
      const arm = -0.35 + rc * 1.2 + Math.sin(t * 1.8) * 0.03;
      ctx.save(); ctx.translate(-6, -16); ctx.rotate(-arm);
      A.stem(ctx, 0, 0, -26, -48, -6, 7, '#4a7a28');
      ctx.translate(-30, -54);
      A.ell(ctx, 0, 0, 20, 10, -0.6, '#3e7a2a', 2.6);
      if (!(p.shootT < 0.6)) {
        A.ell(ctx, 0, -10, 18, 15, 0, '#ff9a2a', 3);
        ctx.strokeStyle = k('#c9640f'); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -10, 7, 14, 0, 0, Math.PI * 2); ctx.stroke();
        A.rrect(ctx, -2, -29, 4, 7, 2, '#5a8a2a', 1.6);
      }
      ctx.restore();
      const b = blinkOf(p, t);
      A.eye(ctx, -8, -16, 5, 0.6, -0.3, b); A.eye(ctx, 8, -16, 5, 0.6, -0.3, b);
      A.mouth(ctx, 0, -6, 10, rc > 0.2 ? 'grin' : 'smile');
    },
  });
  def({
    id: 'isknop', name: 'Isknop', cat: 'attack', cost: 150, cd: 7.5, hp: 300, dmg: 20, rate: 1.45,
    desc: 'En frossen kernekanon. Dens iskerner gør zombier langsomme.',
    special: 'Skud gør zombier 50% langsommere i 5 sek.', pp: 'Fryser alle zombier i rækken fast i 6 sek.',
    perks: ['Lv3: Langsomhed varer 8 sek.', 'Lv5: 10% chance for at fryse helt'],
    crest: [-6, -84],
    init(p) { p.cool = U.rand(0.3, 1.2); },
    tick: shooterTick(function (p, G) {
      const m = muzzle(p);
      G.shoot(p, m.x, m.y, { kind: 'ice', dmg: p.s.dmg, speed: 520, slow: p.lv >= 3 ? 8 : 5, freezeChance: p.lv >= 5 ? 0.1 : 0 });
    }),
    power(p, G) {
      for (const z of G.zombies) if (z.alive && z.row === p.r && !z.boss) G.freezeZombie(z, 6);
      G.fx.ring(p.x, p.y - 40, 300, '#9be8ff'); G.fx.burst(p.x + 200, p.y - 40, '#dff8ff', 40, 300);
      GVZ.Audio.play('freeze');
    },
    draw(ctx, p, t) {
      shooter(ctx, p, t, {
        c1: '#bff1ff', c2: '#3c8fd6', leaf: '#4a9ab0', stem: '#4a8aa0',
        deco(c, r) {
          A.poly(c, [-r * 0.6, -r * 0.6, -r * 0.5, -r * 1.3, -r * 0.2, -r * 0.8, 0, -r * 1.45, r * 0.15, -r * 0.85], '#e9fbff', 2.2);
        },
      });
    },
  });
  def({
    id: 'ildblomst', name: 'Ildblomst', cat: 'attack', cost: 175, cd: 7.5, hp: 300, dmg: 28, rate: 1.6,
    desc: 'En flammende blomst, der skyder ildkugler. Ilden brænder og smelter is.',
    special: 'Ildkugler med brand og lille områdeskade. Tør frosne planter op i nærheden.', pp: 'Flammekaster der brænder hele rækken i 3 sek.',
    perks: ['Lv3: Optøer planter i 3×3 og beskytter mod frost', 'Lv5: Brand varer længere og skader mere'],
    crest: [0, -92],
    init(p) { p.cool = U.rand(0.3, 1.2); },
    tick(p, dt, G) {
      // optø naboer
      p.warmT = (p.warmT || 0) - dt;
      if (p.warmT <= 0) { p.warmT = 1; for (const q of G.neighbors(p, p.lv >= 3 ? 1 : 0, true)) if (q.frozen > 0) q.frozen = 0; }
      if (p.pp > 0) {
        p.ppT = (p.ppT || 0) - dt;
        if (p.ppT <= 0) { p.ppT = 0.2; G.flameRow(p.r, p.x + 30, G.W, p.s.dmg * 0.8 * p.ppMul); }
        return;
      }
      p.cool -= dt * p.haste;
      if (p.cool <= 0) {
        if (hasTarget(G, p, {})) {
          p.shootT = 0;
          G.shoot(p, p.x + 30, p.y - 64, { kind: 'fireball', dmg: p.s.dmg, speed: 480, burn: p.lv >= 5 ? 6 : 4, burnDps: p.lv >= 5 ? 8 : 5, splash: 36, dmgType: 'fire' });
          p.cool = p.s.rate;
        } else p.cool = 0.2;
      }
    },
    power(p) { p.pp = 3; },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.05), rc = recoil(p);
      dirt(ctx);
      baseLeaves(ctx, '#5a8a2a', 0.1, 1);
      A.stem(ctx, 0, -2, sw * 30, -54, 6, 6, '#5a7a2a');
      ctx.save(); ctx.translate(sw * 30, -64);
      A.glow(ctx, 0, 0, 50, '#ff8a2a', 0.35 + rc * 0.4);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.sin(t * 6 + i) * 0.08;
        const l = 26 + Math.sin(t * 9 + i * 2) * 4;
        ctx.save(); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(-7, -8); ctx.quadraticCurveTo(-8, -l * 0.8, 0, -l); ctx.quadraticCurveTo(8, -l * 0.8, 7, -8); ctx.closePath();
        ctx.fillStyle = A.vg(ctx, -l, -8, '#ffe14a', '#ff4b1f'); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = k(A.INK); ctx.stroke();
        ctx.restore();
      }
      A.ball(ctx, 0, 0, 15, '#fff1b0', '#ffa21f');
      happyFace(ctx, 0, 1, 12, p, t, rc > 0.2 ? 'o' : 'grin');
      ctx.restore();
    },
  });
  def({
    id: 'grejsgab', name: 'Grejsgab', cat: 'attack', cost: 150, cd: 7.5, hp: 300, dmg: 0,
    desc: 'En kødædende plante med et enormt gab. Sluger en zombie hel - men skal så tygge længe.',
    special: 'Sluger en zombie lige foran sig. Tygger derefter i 25 sek. Store zombier tager 600 skade.', pp: 'Sluger alt i 3 felter foran sig og tygger færdigt med det samme.',
    perks: ['Lv3: Tygger 30% hurtigere', 'Lv5: Store zombier tager 1200 skade'],
    crest: [-8, -96],
    init(p) { p.chew = 0; p.bite = 0; },
    tick(p, dt, G) {
      if (p.bite > 0) {
        p.bite -= dt;
        if (p.bite <= 0) {
          const z = G.firstZombieInRow(p.r, p.x - 20, p.x + G.CW * 1.4, {});
          if (z) {
            if (z.boss || z.def.heavy) { G.damageZombie(z, p.lv >= 5 ? 1200 : 600, { type: 'melee' }); p.chew = 6; }
            else { G.swallow(z); p.chew = 25 * (p.lv >= 3 ? 0.7 : 1); }
            GVZ.Audio.play('gulp');
          }
        }
        return;
      }
      if (p.chew > 0) { p.chew -= dt * p.haste; return; }
      const z = G.firstZombieInRow(p.r, p.x - 20, p.x + G.CW * 1.35, {});
      if (z) p.bite = 0.45;
    },
    power(p, G) {
      let n = 0;
      for (const z of G.zombies.slice()) if (z.alive && z.row === p.r && z.x > p.x - 20 && z.x < p.x + G.CW * 3.2 && !z.under) { if (z.boss) G.damageZombie(z, 2000, {}); else G.swallow(z); n++; }
      p.chew = 0; p.bite = 0; if (n) GVZ.Audio.play('gulp');
    },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.05);
      const chewing = p.chew > 0;
      const open = p.bite > 0 ? 1 - p.bite / 0.45 : chewing ? Math.abs(Math.sin(t * 6)) * 0.15 : 0.25 + Math.sin(t * 2) * 0.08;
      dirt(ctx);
      baseLeaves(ctx, '#4c9a2a', 0.1, 1.1);
      A.stem(ctx, 0, -2, sw * 20 - 4, -50, -14, 7);
      ctx.save(); ctx.translate(sw * 20 + 4, -66 - (chewing ? 0 : 4));
      if (chewing) ctx.scale(1.12 + Math.sin(t * 6) * 0.04, 1.04);
      const ja = open * 0.9;
      // underkæbe
      ctx.save(); ctx.rotate(ja * 0.5);
      ctx.beginPath(); ctx.moveTo(-24, 2); ctx.quadraticCurveTo(-10, 30, 30, 8); ctx.lineTo(28, 2); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, 0, 30, '#c25ad6', '#6b2a8a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.fillStyle = k('#fff6dd'); for (let i = 0; i < 4; i++) A.poly(ctx, [-8 + i * 9, 6 - i, -4 + i * 9, -2 - i, 0 + i * 9, 6 - i], '#fff6dd', 1.5);
      ctx.restore();
      // overkæbe
      ctx.save(); ctx.rotate(-ja * 0.6);
      ctx.beginPath(); ctx.moveTo(-26, 4); ctx.bezierCurveTo(-34, -34, 28, -40, 34, 0); ctx.lineTo(-26, 4); ctx.closePath();
      ctx.fillStyle = A.rg(ctx, 0, -14, 34, '#e08aff', '#7a2fa0'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      for (let i = 0; i < 5; i++) A.poly(ctx, [-14 + i * 10, 2, -10 + i * 10, 11, -6 + i * 10, 2], '#fff6dd', 1.5);
      A.speckle(ctx, -18, -26, 40, 18, 6, '#f2c4ff', 9, 2.4);
      A.eye(ctx, 2, -16, 7, 0.8, 0.2, chewing ? 0.6 : blinkOf(p, t), { brow: 0.8 });
      ctx.restore();
      ctx.restore();
    },
  });
  def({
    id: 'naalepude', name: 'Nålepude', cat: 'attack', cost: 125, cd: 7.5, hp: 300, dmg: 20, rate: 1.45,
    desc: 'En kaktus med lange nåle. Den eneste skydeplante, der rammer flyvende zombier helt sikkert.',
    special: 'Skyder nåle, der rammer flyvende zombier (prioriteret) og zombier på jorden.', pp: 'Nåleregn: 20 nåle mod luftmål og jordmål.',
    perks: ['Lv3: Dobbelt skade mod flyvende', 'Lv5: Nålene gennemborer 1 ekstra'],
    crest: [0, -96],
    init(p) { p.cool = U.rand(0.3, 1.2); },
    tick: shooterTick(function (p, G, pp) {
      G.shoot(p, p.x + 30, p.y - 78, { kind: 'needle', dmg: p.s.dmg * (pp ? 1.5 : 1), speed: 600, air: true, airMul: p.lv >= 3 ? 2 : 1, pierce: p.lv >= 5 ? 2 : 1 });
    }, { air: true, ppRate: 0.15 }),
    power(p) { p.pp = 3; },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.02), rc = recoil(p);
      dirt(ctx, 20);
      ctx.save(); ctx.rotate(sw);
      A.rrect(ctx, -20, -78, 40, 76, 18, '#5abf6a', 3);
      ctx.strokeStyle = k('#3c8f4a'); ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 9, -72); ctx.lineTo(i * 9, -6); ctx.stroke(); }
      ctx.strokeStyle = k('#fff6d0'); ctx.lineWidth = 1.6;
      for (let y = -66; y < -10; y += 12) for (const x of [-20, 20]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sign(x) * 7, y - 3); ctx.stroke(); }
      A.rrect(ctx, 16 - rc * 3, -84, 26, 8, 4, '#d9f0a0', 2);
      A.circ(ctx, -4, -82, 9, '#ff7ab8', 2.2); A.circ(ctx, -4, -82, 3.5, '#ffe14a', 0);
      happyFace(ctx, 0, -46, 13, p, t, rc > 0.2 ? 'o' : 'smile');
      ctx.restore();
    },
  });
  def({
    id: 'bumerang', name: 'Bumerangblad', cat: 'attack', cost: 175, cd: 7.5, hp: 300, dmg: 22, rate: 2,
    desc: 'En plante med et buet blad, som den kaster som en bumerang. Rammer både ud og hjem.',
    special: 'Bumerangen flyver 5 felter, rammer op til 3 zombier ud og 3 hjem.', pp: '3 kæmpebumeranger, der skærer gennem 3 rækker.',
    perks: ['Lv3: Flyver 7 felter', 'Lv5: Rammer op til 5 zombier hver vej'],
    crest: [0, -88],
    init(p) { p.cool = U.rand(0.3, 1.2); },
    tick(p, dt, G) {
      p.cool -= dt * p.haste;
      if (p.cool <= 0 && !p.thrown) {
        if (hasTarget(G, p, { range: p.lv >= 3 ? 7 : 5 })) {
          p.shootT = 0; p.thrown = true;
          G.shoot(p, p.x + 30, p.y - 56, { kind: 'boomerang', dmg: p.s.dmg, speed: 420, boomerang: (p.lv >= 3 ? 7 : 5) * G.CW, hits: p.lv >= 5 ? 5 : 3, owner: p });
          p.cool = p.s.rate;
        } else p.cool = 0.2;
      }
    },
    power(p, G) {
      for (let d = -1; d <= 1; d++) {
        const rr = p.r + d; if (rr < 0 || rr >= G.rows) continue;
        G.shoot(p, p.x + 30, G.rowY(rr) - 56, { kind: 'boomerang', dmg: p.s.dmg * 3 * p.ppMul, speed: 480, boomerang: 9 * G.CW, hits: 99, big: true, toRow: rr });
      }
    },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.05);
      dirt(ctx);
      baseLeaves(ctx, '#3f9a4a', 0.1, 1);
      A.stem(ctx, 0, -2, sw * 30, -50, -6, 6, '#3f8a3a');
      A.ball(ctx, sw * 30, -58, 18, '#a7e8a0', '#3e9a4a');
      happyFace(ctx, sw * 30, -56, 13, p, t, 'grin');
      if (!p.thrown) {
        ctx.save(); ctx.translate(sw * 30 + 20, -76); ctx.rotate(-0.4 + Math.sin(t * 2) * 0.1);
        ctx.beginPath(); ctx.moveTo(-16, 8); ctx.quadraticCurveTo(0, -14, 18, 6); ctx.quadraticCurveTo(0, -4, -16, 8);
        ctx.fillStyle = k('#e8c14a'); ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = k(A.INK); ctx.stroke();
        ctx.restore();
      }
    },
  });

  /* ================= FORSVAR ================= */
  def({
    id: 'barkmur', name: 'Barkmur', cat: 'defense', cost: 50, cd: 25, hp: 4000,
    desc: 'En tyk, knudret træstub. Den gør ikke noget - men zombier skal tygge LÆNGE.',
    special: 'Meget højt liv. Blokerer zombier.', pp: 'Gendanner alt liv og får en jernbark-rustning (+2000).',
    perks: ['Lv3: Zombier, der tygger, tager 5 skade/sek.', 'Lv5: Langsom selvreparation'],
    crest: [0, -82],
    tick(p, dt, G) {
      if (p.lv >= 3 && p.eaten > 0) for (const z of p.eaters || []) if (z.alive) G.damageZombie(z, 5 * dt, { silent: true });
      if (p.lv >= 5) p.hp = Math.min(p.maxHp, p.hp + 8 * dt);
    },
    power(p) { p.hp = p.maxHp; p.armor = 2000 * p.ppMul; p.armorMax = p.armor; },
    draw(ctx, p, t) {
      const f = p.hp / (p.maxHp || 1);
      const sq = Math.sin(t * 1.4 + (p.seed || 0)) * 1.2;
      dirt(ctx, 34);
      ctx.beginPath(); ctx.moveTo(-34, -2); ctx.bezierCurveTo(-40, -50, -24, -80 - sq, 0, -80 - sq); ctx.bezierCurveTo(24, -80 - sq, 40, -50, 34, -2); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -80, 0, '#c08a52', '#6e4523'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = k('#5a3618'); ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 10, -2); ctx.bezierCurveTo(i * 10 + 4, -30, i * 9 - 4, -50, i * 7, -82); ctx.stroke(); }
      ctx.restore();
      A.ell(ctx, 0, -78 - sq, 22, 6, 0, '#e2b77a', 2.4);
      ctx.strokeStyle = k('#a8773f'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, -78 - sq, 13, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
      A.leaf(ctx, 16, -76, 18, 7, -0.6, '#62b33f');
      const b = blinkOf(p, t);
      const worried = f < 0.5;
      A.eye(ctx, -10, -46, 7, worried ? -0.4 : 0.4, worried ? -0.3 : 0, b, { brow: worried ? -0.7 : 0.2 });
      A.eye(ctx, 12, -46, 7, worried ? -0.4 : 0.4, worried ? -0.3 : 0, b, { brow: worried ? 0.7 : -0.2 });
      A.mouth(ctx, 1, -28, 14, f < 0.33 ? 'teeth' : worried ? 'frown' : 'smile', 0.3);
      cracks(ctx, p, 0, -40, 30);
      if (p.armor > 0) { ctx.strokeStyle = k('#9aa6b8'); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-36, -30); ctx.lineTo(36, -30); ctx.moveTo(-34, -58); ctx.lineTo(34, -58); ctx.stroke(); }
    },
  });
  def({
    id: 'stenrod', name: 'Stenrod', cat: 'defense', cost: 125, cd: 30, hp: 8000, tall: true,
    desc: 'En høj stensøjle overgroet med mos. Så høj, at zombier ikke kan springe eller svinge over den.',
    special: 'Ekstremt højt liv. HØJ: stopper springende og svingende zombier.', pp: 'Fuld reparation og stenhud (+3000).',
    perks: ['Lv3: Reflekterer 10 skade/sek. til tyggende zombier', 'Lv5: +25% ekstra liv'],
    crest: [0, -108],
    init(p) { if (p.lv >= 5) { p.maxHp *= 1.25; p.hp = p.maxHp; } },
    tick(p, dt, G) { if (p.lv >= 3) for (const z of p.eaters || []) if (z.alive) G.damageZombie(z, 10 * dt, { silent: true }); },
    power(p) { p.hp = p.maxHp; p.armor = 3000 * p.ppMul; p.armorMax = p.armor; },
    draw(ctx, p, t) {
      const f = p.hp / (p.maxHp || 1);
      dirt(ctx, 32);
      A.poly(ctx, [-30, -2, -32, -60, -22, -100, 4, -108, 26, -96, 32, -52, 30, -2], '#9b9aa8', 3);
      ctx.save(); A.poly(ctx, [-30, -2, -32, -60, -22, -100, 4, -108, 26, -96, 32, -52, 30, -2], null, 0); ctx.clip();
      ctx.fillStyle = k('#7a7988'); ctx.fillRect(10, -110, 30, 110);
      A.speckle(ctx, -30, -100, 60, 96, 18, '#6c6b78', 4, 2.5);
      ctx.fillStyle = k('#5fa83c'); ctx.beginPath(); ctx.moveTo(-34, -96); ctx.quadraticCurveTo(-10, -86, 8, -110); ctx.lineTo(30, -110); ctx.lineTo(30, -90); ctx.quadraticCurveTo(0, -70, -34, -76); ctx.fill();
      ctx.restore();
      A.poly(ctx, [-30, -2, -32, -60, -22, -100, 4, -108, 26, -96, 32, -52, 30, -2], null, 3);
      A.leaf(ctx, -22, -88, 18, 7, -2.6, '#62b33f'); A.leaf(ctx, 18, -92, 16, 6, -0.4, '#62b33f');
      const b = blinkOf(p, t);
      A.eye(ctx, -10, -60, 7, 0.4, 0, b, { brow: f < 0.5 ? -0.5 : 0.8 }); A.eye(ctx, 12, -60, 7, 0.4, 0, b, { brow: f < 0.5 ? 0.5 : -0.8 });
      A.mouth(ctx, 1, -40, 16, f < 0.33 ? 'teeth' : 'flat', 0.2);
      cracks(ctx, p, 0, -50, 34);
      if (p.armor > 0) A.glow(ctx, 0, -55, 60, '#c9d6ff', 0.35);
    },
  });
  def({
    id: 'mospude', name: 'Mospude', cat: 'defense', cost: 100, cd: 20, hp: 2400, regen: 22,
    desc: 'En blød, tyk mospude med små blomster. Den heler sig selv konstant.',
    special: 'Reparerer sig selv med ca. 22 liv/sek.', pp: 'Heler sig selv og alle naboplanter fuldt op.',
    perks: ['Lv3: Heler også naboplanter langsomt', 'Lv5: Dobbelt heling når under 30% liv'],
    crest: [0, -62],
    tick(p, dt, G) {
      const mul = p.lv >= 5 && p.hp < p.maxHp * 0.3 ? 2 : 1;
      p.hp = Math.min(p.maxHp, p.hp + p.s.regen * mul * dt);
      if (p.lv >= 3) for (const q of G.neighbors(p, 1)) q.hp = Math.min(q.maxHp, q.hp + 4 * dt);
      p.sp = (p.sp || 0) - dt;
      if (p.sp <= 0 && p.hp < p.maxHp) { p.sp = 0.6; G.fx.sparkle(p.x + U.rand(-24, 24), p.y - U.rand(10, 50), '#9cff7a'); }
    },
    power(p, G) { p.hp = p.maxHp; for (const q of G.neighbors(p, 1)) { q.hp = q.maxHp; G.fx.sparkle(q.x, q.y - 40, '#9cff7a', 8); } },
    draw(ctx, p, t) {
      const f = p.hp / (p.maxHp || 1);
      const br = Math.sin(t * 1.6 + (p.seed || 0)) * 2;
      dirt(ctx, 34);
      ctx.beginPath(); ctx.moveTo(-36, -2);
      for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; ctx.quadraticCurveTo(Math.cos(a - 0.2) * 44, -30 + Math.sin(a - 0.2) * (30 + br), Math.cos(a) * 36, -22 + Math.sin(a) * (30 + br)); }
      ctx.lineTo(36, -2); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -60, 0, '#8fd45a', '#3f8a2a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.speckle(ctx, -30, -50, 60, 40, 22, '#6bbf3f', 12, 2.2);
      [[-20, -44, '#ff9ad5'], [16, -50, '#fff07a'], [26, -30, '#ffffff'], [-28, -24, '#9ad5ff']].forEach((c) => { A.circ(ctx, c[0], c[1], 4.5, c[2], 1.6); A.circ(ctx, c[0], c[1], 1.6, '#ffcc33', 0); });
      const b = Math.max(blinkOf(p, t), f > 0.8 ? 0.55 : 0);
      A.eye(ctx, -9, -28, 5.5, 0, 0, b); A.eye(ctx, 9, -28, 5.5, 0, 0, b);
      A.mouth(ctx, 0, -16, 10, f < 0.4 ? 'frown' : 'smile');
    },
  });
  def({
    id: 'skjoldbregne', name: 'Skjoldbregne', cat: 'defense', cost: 125, cd: 20, hp: 1200, shield: 300, interval: 16,
    desc: 'En bregne, der folder sine blade ud til et beskyttende skjold om nabo-planterne.',
    special: 'Giver sig selv og alle 8 naboplanter et skjold på 300 hver ~16 sek.', pp: 'Giver alle planter i 3 rækker et kæmpeskjold (900).',
    perks: ['Lv3: Skjoldet er på 450', 'Lv5: Hvert 2. skjold reflekterer kasteskud'],
    crest: [0, -92],
    init(p) { p.prod = 3; },
    tick(p, dt, G) {
      p.prod -= dt * p.haste;
      if (p.prod <= 0) {
        p.prod = p.s.interval; p.glowT = 1;
        const amt = p.s.shield * (p.lv >= 3 ? 1.5 : 1);
        for (const q of [p].concat(G.neighbors(p, 1))) { q.shield = Math.max(q.shield || 0, amt); q.shieldMax = Math.max(q.shield, q.shieldMax || 0); }
        G.fx.ring(p.x, p.y - 40, G.CW * 1.5, '#7ae0ff');
      }
      if (p.glowT > 0) p.glowT -= dt;
    },
    power(p, G) {
      for (const q of G.allPlants()) if (Math.abs(q.r - p.r) <= 1) { q.shield = 900 * p.ppMul; q.shieldMax = q.shield; }
      G.fx.ring(p.x, p.y - 40, 500, '#7ae0ff');
    },
    draw(ctx, p, t) {
      const g = p.glowT > 0 ? p.glowT : 0;
      dirt(ctx, 26);
      if (g > 0) A.glow(ctx, 0, -50, 70, '#7ae0ff', g * 0.5);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.32 + Math.sin(t * 1.5 + i) * 0.03;
        ctx.save(); ctx.translate(0, -6); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(40, -16, 78, 0); ctx.quadraticCurveTo(40, 16, 0, 0);
        ctx.fillStyle = A.vg(ctx, -14, 14, '#7ed36a', '#2f7a3a'); ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = k(A.INK); ctx.stroke();
        ctx.strokeStyle = k('#2a6a2a'); ctx.lineWidth = 1.4;
        for (let j = 1; j < 7; j++) { ctx.beginPath(); ctx.moveTo(j * 10, 0); ctx.lineTo(j * 10 + 5, -8 + j * 0.6); ctx.moveTo(j * 10, 0); ctx.lineTo(j * 10 + 5, 8 - j * 0.6); ctx.stroke(); }
        ctx.restore();
      }
      A.ell(ctx, 0, -46, 20, 24, 0, '#4fb0d6', 3);
      A.ell(ctx, 0, -46, 13, 16, 0, '#9be4ff', 2);
      happyFace(ctx, 0, -45, 11, p, t);
    },
  });
  def({
    id: 'boblebusk', name: 'Boblebusk', cat: 'defense', cost: 100, cd: 20, hp: 600, wall: 1200, interval: 18,
    desc: 'En sæbeagtig busk, der puster en stor, sej boble ud foran sig. Zombier skal flække boblen først.',
    special: 'Skaber en midlertidig boblebarriere (1200 liv) i feltet foran hver ~18 sek.', pp: 'Bobler i alle tomme felter foran sig i rækken.',
    perks: ['Lv3: Boblen gør zombier langsomme når den springer', 'Lv5: Boblen har 2000 liv'],
    crest: [0, -78],
    init(p) { p.prod = 4; },
    tick(p, dt, G) {
      p.prod -= dt * p.haste;
      if (p.prod <= 0) {
        p.prod = p.s.interval;
        if (G.placeBubble(p.r, p.c + 1, p.lv >= 5 ? 2000 : p.s.wall, p.lv >= 3)) { p.shootT = 0; GVZ.Audio.play('whoosh'); }
      }
    },
    power(p, G) { for (let c = p.c + 1; c < G.cols; c++) G.placeBubble(p.r, c, 1500 * p.ppMul, true); },
    draw(ctx, p, t) {
      const rc = recoil(p);
      dirt(ctx, 26);
      A.ell(ctx, 0, -24, 30, 24, 0, '#6ab0c8', 3);
      A.speckle(ctx, -24, -44, 48, 36, 12, '#4c8ea6', 5, 3);
      for (let i = 0; i < 4; i++) {
        const bt = (t * 0.6 + i * 0.25) % 1;
        ctx.globalAlpha = 1 - bt;
        A.circ(ctx, 14 + bt * 30 + i * 3, -50 - bt * 40, 4 + bt * 5, 'rgba(210,245,255,.6)', 1.2);
        ctx.globalAlpha = 1;
      }
      A.eye(ctx, -8, -30, 5.5, 0.4, 0, blinkOf(p, t)); A.eye(ctx, 8, -30, 5.5, 0.4, 0, blinkOf(p, t));
      A.mouth(ctx, 14 + rc * 4, -18, 10, 'o', 0.5 + rc);
    },
  });

  /* ================= FÆLDER & EKSPLOSIONER ================= */
  def({
    id: 'knoldmine', name: 'Knoldmine', cat: 'trap', cost: 25, cd: 25, hp: 300, dmg: 1800, arm: 14,
    desc: 'En lille knold, der graver sig ned og skal bruge tid på at blive skarp. Derefter: BOOM.',
    special: 'Aktiveres efter 14 sek. og eksploderer, når en zombie træder på den.', pp: 'Aktiveres straks og får dobbelt eksplosionsradius.',
    perks: ['Lv3: Aktiveres efter 10 sek.', 'Lv5: Efterlader en ny ikke-aktiveret mine'],
    crest: [0, -40], noEatArmed: true,
    init(p) { p.armT = p.lv >= 3 ? 10 : p.s.arm; },
    tick(p, dt, G) {
      if (p.armT > 0) { p.armT -= dt * p.haste; if (p.armT <= 0) { G.fx.dust(p.x, p.y, 10); GVZ.Audio.play('place'); } return; }
      const z = G.zombies.find((z) => z.alive && z.row === p.r && !z.flying && Math.abs(z.x - p.x) < G.CW * 0.42 && !z.under);
      if (z) {
        G.explode(p.x, p.y - 20, G.CW * (p.big ? 1.1 : 0.6), p.s.dmg, { rowOnly: !p.big, row: p.r, src: p });
        const r = p.r, c = p.c, lv = p.lv;
        G.removePlant(p, true);
        if (lv >= 5) G.later(0.6, () => G.placePlantFree('knoldmine', r, c, lv));
      }
    },
    power(p) { p.armT = 0; p.big = true; },
    draw(ctx, p, t) {
      const armed = !(p.armT > 0);
      if (!armed) {
        dirt(ctx, 20);
        A.ell(ctx, 0, -6, 18, 8, 0, '#a5763f', 2.6);
        A.stem(ctx, 0, -8, 2, -22, 2, 3);
        A.leaf(ctx, 2, -22, 10, 5, -0.6, '#62b33f');
        const b = 1;
        A.eye(ctx, -6, -8, 3, 0, 0, b); A.eye(ctx, 6, -8, 3, 0, 0, b);
        return;
      }
      const bob = Math.sin(t * 5) * 1.5;
      dirt(ctx, 26);
      A.ell(ctx, 0, -16 + bob, 26, 18, 0, '#c99355', 3);
      A.speckle(ctx, -18, -30 + bob, 36, 22, 7, '#8a6030', 6, 2);
      A.shine(ctx, -10, -24 + bob, 7, 4);
      A.stem(ctx, 0, -32 + bob, 0, -44 + bob, 0, 3, '#7a7a7a');
      const on = Math.sin(t * 8) > 0;
      if (on) A.glow(ctx, 0, -46 + bob, 16, '#ff3030', 0.8);
      A.circ(ctx, 0, -46 + bob, 5, on ? '#ff3a3a' : '#7a1a1a', 2);
      A.eye(ctx, -8, -18 + bob, 5, 0.4, 0, blinkOf(p, t), { brow: 0.6 }); A.eye(ctx, 8, -18 + bob, 5, 0.4, 0, blinkOf(p, t), { brow: -0.6 });
      A.mouth(ctx, 0, -8 + bob, 10, 'grin');
    },
  });
  def({
    id: 'tomatbombe', name: 'Tomatbombe', cat: 'trap', cost: 150, cd: 35, hp: 9999, dmg: 1800, instant: true,
    desc: 'En stiktosset tomat, der sitrer af raseri - og eksploderer i et 3×3-område.',
    special: 'Eksploderer straks og rammer alle zombier i 3×3 felter.', pp: '-',
    perks: ['Lv3: Lidt større radius', 'Lv5: Efterlader brændende jord'],
    crest: [0, -70],
    init(p) { p.fuse = 0.9; },
    tick(p, dt, G) {
      p.fuse -= dt;
      if (p.fuse <= 0) {
        G.explode(p.x, p.y - 40, G.CW * (p.lv >= 3 ? 1.65 : 1.5), p.s.dmg, { big: true, src: p });
        if (p.lv >= 5) G.burnGround(p.r, p.c, 6);
        G.removePlant(p, true);
      }
    },
    draw(ctx, p, t) {
      const f = 1 - U.clamp((p.fuse == null ? 0.9 : p.fuse) / 0.9, 0, 1);
      const sh = f * 4, s = 1 + f * 0.35;
      ctx.save(); ctx.translate(U.rand(-sh, sh), U.rand(-sh, sh)); ctx.scale(s, s);
      dirt(ctx, 20);
      A.ball(ctx, 0, -32, 28, U.mix('#ff6a4d', '#ffffff', f * 0.5), '#b81f14');
      A.poly(ctx, [-14, -58, -4, -54, 0, -66, 4, -54, 14, -58, 6, -50, -6, -50], '#4fae34', 2.4);
      A.eye(ctx, -10, -36, 6, 0, 0, 0, { brow: 1 }); A.eye(ctx, 10, -36, 6, 0, 0, 0, { brow: -1 });
      A.mouth(ctx, 0, -20, 16, 'teeth', f);
      ctx.restore();
    },
  });
  def({
    id: 'frostklokke', name: 'Frostklokke', cat: 'trap', cost: 75, cd: 40, hp: 9999, dmg: 20, instant: true,
    desc: 'En blå klokkeblomst. Når den ringer, fryser alle zombier på banen til is.',
    special: 'Fryser ALLE zombier på banen i 4 sek. (gør dem langsomme bagefter).', pp: '-',
    perks: ['Lv3: Fryser i 5,5 sek.', 'Lv5: Frosne zombier tager +25% skade'],
    crest: [0, -70],
    init(p) { p.fuse = 0.7; },
    tick(p, dt, G) {
      p.fuse -= dt;
      if (p.fuse <= 0) {
        const d = p.lv >= 3 ? 5.5 : 4;
        for (const z of G.zombies) if (z.alive) { G.freezeZombie(z, z.boss ? d * 0.4 : d, p.lv >= 5); G.damageZombie(z, p.s.dmg, { type: 'ice', silent: true }); }
        G.fx.flash('#bff4ff', 0.6); G.fx.ring(p.x, p.y - 30, 900, '#bff4ff'); G.shake(4);
        GVZ.Audio.play('freeze');
        G.removePlant(p, true);
      }
    },
    draw(ctx, p, t) {
      const f = 1 - U.clamp((p.fuse == null ? 0.7 : p.fuse) / 0.7, 0, 1);
      dirt(ctx, 18);
      A.stem(ctx, 0, -2, 0, -60, 10, 5, '#3f7a8a');
      ctx.save(); ctx.translate(4, -60); ctx.rotate(Math.sin(t * 20) * 0.3 * f + Math.sin(t * 2) * 0.05);
      A.glow(ctx, 0, 14, 40, '#bff4ff', 0.3 + f * 0.6);
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.bezierCurveTo(-14, 6, -22, 26, -26, 34); ctx.quadraticCurveTo(0, 42, 26, 34); ctx.bezierCurveTo(22, 26, 14, 6, 6, 0); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, 0, 36, '#bff4ff', '#3c7ad6'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.circ(ctx, 0, 36, 5, '#e9fbff', 2);
      happyFace(ctx, 0, 20, 10, p, t, f > 0.5 ? 'o' : 'smile');
      ctx.restore();
    },
  });
  def({
    id: 'giftsump', name: 'Giftsump', cat: 'trap', cost: 125, cd: 30, hp: 600, dmg: 30, life: 13,
    desc: 'En boblende sumpkande, der udånder giftige dampe over et 3×3-område, til den visner.',
    special: 'Giftsky i 3×3 felter: ca. 30 skade/sek. i 13 sek. Ignorerer rustning.', pp: 'Skyen fordobles i størrelse og varighed.',
    perks: ['Lv3: Varer 18 sek.', 'Lv5: Forgiftede zombier bliver langsomme'],
    crest: [0, -70],
    init(p) { p.life = p.lv >= 3 ? 18 : p.s.life; p.puff = 0; },
    tick(p, dt, G) {
      p.life -= dt;
      p.puff -= dt;
      const rad = G.CW * (p.big ? 2.6 : 1.5);
      if (p.puff <= 0) {
        p.puff = 0.5;
        for (const z of G.zombies) if (z.alive && !z.under && Math.abs(z.x - p.x) < rad && Math.abs(z.row - p.r) <= (p.big ? 2 : 1)) {
          G.poisonZombie(z, p.s.dmg, 1.2);
          if (p.lv >= 5) G.slowZombie(z, 1.5);
        }
        G.fx.gas(p.x, p.y - 30, rad, '#9cff6b');
      }
      if (p.life <= 0) G.removePlant(p, true);
    },
    power(p) { p.big = true; p.life *= 2; },
    draw(ctx, p, t) {
      const fade = U.clamp((p.life == null ? 10 : p.life) / 3, 0.3, 1);
      dirt(ctx, 26);
      ctx.globalAlpha = fade;
      ctx.beginPath(); ctx.moveTo(-22, -2); ctx.bezierCurveTo(-36, -30, -20, -52, -10, -54); ctx.lineTo(10, -54); ctx.bezierCurveTo(20, -52, 36, -30, 22, -2); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -54, 0, '#a6d86a', '#3f6a2a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      A.ell(ctx, 0, -54, 12, 5, 0, '#6cff4a', 2.4);
      for (let i = 0; i < 3; i++) { const bt = (t * 0.8 + i / 3) % 1; ctx.globalAlpha = (1 - bt) * fade; A.circ(ctx, Math.sin(i * 2 + t) * 8, -58 - bt * 30, 3 + bt * 4, '#a8ff7a', 1.2); }
      ctx.globalAlpha = fade;
      A.eye(ctx, -8, -30, 5, 0.3, 0, 0.5); A.eye(ctx, 8, -30, 5, 0.3, 0, 0.5);
      A.mouth(ctx, 0, -18, 10, 'grin');
      ctx.globalAlpha = 1;
    },
  });
  def({
    id: 'blaesebaelg', name: 'Blæsebælg', cat: 'trap', cost: 100, cd: 20, hp: 400, interval: 9,
    desc: 'Et græskar med blæsebælg-blade. Puster zombier tilbage og blæser flyvende zombier helt væk.',
    special: 'Skubber zombier i rækken 1,5 felt tilbage hver ~9 sek. Blæser flyvere væk.', pp: 'Orkan: skubber ALLE zombier i 3 rækker 3 felter tilbage.',
    perks: ['Lv3: Skubber 2 felter', 'Lv5: Pust gør også zombier langsomme'],
    crest: [0, -80],
    init(p) { p.prod = 2; },
    tick(p, dt, G) {
      p.prod -= dt * p.haste;
      if (p.prod <= 0) {
        const any = G.firstZombieInRow(p.r, p.x - 10, G.W + 40, { air: true });
        if (any) {
          p.prod = p.s.interval; p.shootT = 0;
          G.gust(p.r, p.x, G.CW * (p.lv >= 3 ? 2 : 1.5), { slow: p.lv >= 5 });
        } else p.prod = 0.3;
      }
    },
    power(p, G) { for (let d = -1; d <= 1; d++) if (p.r + d >= 0 && p.r + d < G.rows) G.gust(p.r + d, G.X0 - 100, G.CW * 3 * p.ppMul, { slow: true }); p.shootT = 0; },
    draw(ctx, p, t) {
      const rc = p.shootT != null && p.shootT < 0.6 ? Math.sin((p.shootT / 0.6) * Math.PI) : 0;
      dirt(ctx, 26);
      const sx = 1 - rc * 0.15, sy = 1 + rc * 0.1;
      A.leaf(ctx, -10, -40, 30, 14, Math.PI + 0.6 - rc * 0.6, '#5aa838');
      A.leaf(ctx, -10, -24, 30, 14, Math.PI - 0.4 + rc * 0.6, '#5aa838');
      ctx.save(); ctx.translate(0, -32); ctx.scale(sx, sy);
      A.ell(ctx, 0, 0, 28, 26, 0, '#ffb04a', 3);
      ctx.strokeStyle = k('#c97a1a'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 25, 0, 0, Math.PI * 2); ctx.stroke();
      A.rrect(ctx, 22, -7, 18, 14, 5, '#e09a3a', 2.4);
      A.eye(ctx, -6, -6, 5, 0.6, 0, blinkOf(p, t), { brow: 0.4 }); A.eye(ctx, 8, -6, 5, 0.6, 0, blinkOf(p, t));
      ctx.fillStyle = 'rgba(255,90,90,.35)'; ctx.beginPath(); ctx.arc(-4, 8, 6 + rc * 3, 0, Math.PI * 2); ctx.arc(14, 8, 6 + rc * 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (rc > 0) { ctx.strokeStyle = 'rgba(255,255,255,' + rc * 0.8 + ')'; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(44, -32 + i * 10); ctx.lineTo(70 + rc * 20, -32 + i * 14); ctx.stroke(); } }
    },
  });
  def({
    id: 'kvikjord', name: 'Kvikjord', cat: 'trap', cost: 175, cd: 25, hp: 300, ground: true, rate: 22,
    desc: 'Et hul med sultne rødder. Zombier, der træder på det, bliver trukket ned i jorden.',
    special: 'Trækker den første zombie ned i jorden (op til 2000 liv). Genlader i 22 sek. Kan ikke ædes.', pp: 'Trækker alle zombier i rækken inden for 2 felter ned.',
    perks: ['Lv3: Genlader på 16 sek.', 'Lv5: Kan trække op til 3500 liv'],
    crest: [0, -30],
    init(p) { p.cool = 2; },
    tick(p, dt, G) {
      if (p.cool > 0) { p.cool -= dt * p.haste; return; }
      const z = G.zombies.find((z) => z.alive && z.row === p.r && !z.flying && !z.boss && !z.under && Math.abs(z.x - p.x) < G.CW * 0.4);
      if (z) {
        const cap = p.lv >= 5 ? 3500 : 2000;
        if (z.hp + z.armor + (z.shieldHp || 0) <= cap) G.dragUnder(z); else G.damageZombie(z, cap * 0.6, {});
        p.cool = p.lv >= 3 ? 16 : p.s.rate; p.shootT = 0;
        GVZ.Audio.play('gulp');
      }
    },
    power(p, G) { for (const z of G.zombies.slice()) if (z.alive && z.row === p.r && !z.boss && !z.flying && Math.abs(z.x - p.x) < G.CW * 2.2) G.dragUnder(z); p.cool = 0; },
    draw(ctx, p, t) {
      const ready = !(p.cool > 0);
      A.ell(ctx, 0, -4, 36, 13, 0, '#3a2414', 3);
      A.ell(ctx, 0, -3, 28, 8, 0, '#1a0e06', 0);
      ctx.strokeStyle = k('#7a5a2a'); ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + (i / 4) * Math.PI, w = Math.sin(t * 3 + i) * 3;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 26, -4 + Math.sin(a) * 8); ctx.quadraticCurveTo(Math.cos(a) * 34 + w, -10 + Math.sin(a) * 16, Math.cos(a) * 20, -14 + Math.sin(a) * 18 - (ready ? 6 : 0)); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      if (ready) {
        const gl = 0.6 + Math.sin(t * 4) * 0.3;
        ctx.fillStyle = 'rgba(255,230,90,' + gl + ')';
        ctx.beginPath(); ctx.ellipse(-8, -4, 3.5, 2.2, 0, 0, Math.PI * 2); ctx.ellipse(8, -4, 3.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      }
    },
  });
  def({
    id: 'tornmaatte', name: 'Tornmåtte', cat: 'trap', cost: 100, cd: 7.5, hp: 600, dmg: 20, ground: true,
    desc: 'Et tæppe af tornede ranker på jorden. Zombier går hen over den og skærer sig. Punkterer hjul.',
    special: 'Ca. 20 skade/sek. til zombier ovenpå. Kan ikke ædes. Køretøjer tager 400 skade, men ødelægger den.', pp: 'Torne skyder op i hele rækken i 3 sek.',
    perks: ['Lv3: +50% skade', 'Lv5: Overlever 2 køretøjer'],
    crest: [0, -24],
    init(p) { p.tick = 0; p.lives = p.lv >= 5 ? 2 : 1; },
    tick(p, dt, G) {
      p.tick -= dt;
      if (p.pp > 0) { p.ppT = (p.ppT || 0) - dt; if (p.ppT <= 0) { p.ppT = 0.25; for (const z of G.zombies) if (z.alive && z.row === p.r && !z.flying && !z.under) G.damageZombie(z, 40 * p.ppMul, { type: 'pierce' }); G.fx.spikes(p.r); } }
      if (p.tick <= 0) {
        p.tick = 0.25;
        for (const z of G.zombies) if (z.alive && z.row === p.r && !z.flying && !z.under && Math.abs(z.x - p.x) < G.CW * 0.5) G.damageZombie(z, p.s.dmg * 0.25 * (p.lv >= 3 ? 1.5 : 1), { type: 'pierce', silent: true });
      }
    },
    power(p) { p.pp = 3; },
    draw(ctx, p, t) {
      A.ell(ctx, 0, -3, 40, 11, 0, '#4a6a2a', 2.6);
      ctx.strokeStyle = k('#3a5a1a'); ctx.lineWidth = 3;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 10 - 6, -2); ctx.quadraticCurveTo(i * 10, -10, i * 10 + 6, -2); ctx.stroke(); }
      for (let i = -3; i <= 3; i++) A.poly(ctx, [i * 11 - 3, -5, i * 11, -15 - Math.abs(Math.sin(t * 2 + i)) * 2, i * 11 + 3, -5], '#e0d6b0', 1.5);
    },
  });
  def({
    id: 'flammerod', name: 'Flammerod', cat: 'trap', cost: 125, cd: 35, hp: 9999, dmg: 1800, instant: true,
    desc: 'En brandvarm rod, der sitrer, svulmer op - og sender en flammevæg ned gennem hele rækken.',
    special: 'Brænder ALLE zombier i hele rækken. Smelter is.', pp: '-',
    perks: ['Lv3: Brænder også svagt i naborækkerne', 'Lv5: Efterlader brændende jord i rækken'],
    crest: [0, -70],
    init(p) { p.fuse = 0.8; },
    tick(p, dt, G) {
      p.fuse -= dt;
      if (p.fuse <= 0) {
        G.flameRow(p.r, G.X0 - 40, G.W + 60, p.s.dmg, { big: true });
        if (p.lv >= 3) for (const d of [-1, 1]) if (p.r + d >= 0 && p.r + d < G.rows) G.flameRow(p.r + d, G.X0 - 40, G.W + 60, p.s.dmg * 0.15, { thin: true });
        if (p.lv >= 5) for (let c = 0; c < G.cols; c++) G.burnGround(p.r, c, 5);
        G.shake(6);
        G.removePlant(p, true);
      }
    },
    draw(ctx, p, t) {
      const f = 1 - U.clamp((p.fuse == null ? 0.8 : p.fuse) / 0.8, 0, 1);
      ctx.save(); ctx.translate(U.rand(-f * 3, f * 3), 0); ctx.scale(1 + f * 0.2, 1 + f * 0.3);
      dirt(ctx, 18);
      ctx.beginPath(); ctx.moveTo(-12, -2); ctx.bezierCurveTo(-22, -30, -12, -56, 0, -66); ctx.bezierCurveTo(12, -56, 22, -30, 12, -2); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -66, 0, '#ff9a3a', U.mix('#c8231a', '#ffffff', f * 0.4)); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.save(); ctx.translate(0, -64);
      const fl = 10 + Math.sin(t * 14) * 3 + f * 10;
      ctx.beginPath(); ctx.moveTo(-6, 4); ctx.quadraticCurveTo(-8, -fl, 0, -fl * 1.4); ctx.quadraticCurveTo(8, -fl, 6, 4); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -fl * 1.4, 4, '#fff07a', '#ff5a1f'); ctx.fill();
      ctx.restore();
      A.eye(ctx, -5, -36, 4.5, 0, 0, 0, { brow: 1 }); A.eye(ctx, 6, -36, 4.5, 0, 0, 0, { brow: -1 });
      A.mouth(ctx, 0, -22, 10, 'teeth', f);
      ctx.restore();
    },
  });

  /* ================= STØTTE ================= */
  def({
    id: 'glodstub', name: 'Glødstub', cat: 'support', cost: 175, cd: 7.5, hp: 1500,
    desc: 'En træstub med en gløde-skål. Projektiler, der flyver igennem den, antændes.',
    special: 'Projektiler gennem feltet bliver til ild: ×2 skade og brand. Isskud smelter.', pp: 'I 10 sek. bliver ild-projektiler til blå flammer (×3).',
    perks: ['Lv3: ×2,3 skade', 'Lv5: Ild-projektiler får områdeskade'],
    crest: [0, -78], passThrough: true,
    tick() {},
    power(p) { p.pp = 10; },
    draw(ctx, p, t) {
      const blue = p.pp > 0;
      dirt(ctx, 30);
      A.rrect(ctx, -28, -56, 56, 54, 10, '#8a5a30', 3);
      ctx.strokeStyle = k('#5a3618'); ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 10, -52); ctx.lineTo(i * 10 + 2, -6); ctx.stroke(); }
      A.ell(ctx, 0, -56, 28, 8, 0, '#4a2a14', 3);
      const c1 = blue ? '#c9f0ff' : '#fff07a', c2 = blue ? '#2a7aff' : '#ff4b1f';
      A.glow(ctx, 0, -70, 54, blue ? '#4aa8ff' : '#ff8a2a', 0.45);
      for (let i = 0; i < 5; i++) {
        const x = -16 + i * 8, h = 22 + Math.sin(t * 11 + i * 1.7) * 7;
        ctx.beginPath(); ctx.moveTo(x - 7, -56); ctx.quadraticCurveTo(x - 6, -56 - h * 0.7, x, -56 - h); ctx.quadraticCurveTo(x + 6, -56 - h * 0.7, x + 7, -56); ctx.closePath();
        ctx.fillStyle = A.vg(ctx, -56 - h, -56, c1, c2); ctx.fill();
      }
      A.eye(ctx, -9, -34, 5, 0.6, 0, blinkOf(p, t), { brow: 0.6 }); A.eye(ctx, 9, -34, 5, 0.6, 0, blinkOf(p, t), { brow: -0.6 });
      A.mouth(ctx, 0, -20, 12, 'smile');
    },
  });
  def({
    id: 'urtetid', name: 'Urtetid', cat: 'support', cost: 75, cd: 15, hp: 300, haste: 0.25,
    desc: 'En urt med en timeglasblomst. Får tiden til at gå hurtigere for frøposerne.',
    special: 'Alle plantekort genoplades 25% hurtigere (max 2 Urtetid tæller).', pp: 'Genoplader straks alle plantekort.',
    perks: ['Lv3: +30% genopladning', 'Lv5: +35% og giver 5 sol hvert 10. sek.'],
    crest: [0, -84],
    tick(p, dt, G) {
      if (p.lv >= 5) { p.prod = (p.prod || 10) - dt; if (p.prod <= 0) { p.prod = 10; G.makeSun(p.x, p.y - 60, 5, { from: p, small: true }); } }
    },
    power(p, G) { G.resetCooldowns(); },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.06);
      dirt(ctx);
      baseLeaves(ctx, '#5aa85a', 0.2, 0.9);
      A.leaf(ctx, 0, -24, 20, 6, -2.2, '#6ab86a'); A.leaf(ctx, 0, -34, 20, 6, -0.9, '#6ab86a');
      A.stem(ctx, 0, -2, sw * 30, -54, 4, 5, '#4a8a4a');
      ctx.save(); ctx.translate(sw * 30, -66);
      A.rrect(ctx, -16, -24, 32, 6, 3, '#b07a3a', 2.4); A.rrect(ctx, -16, 18, 32, 6, 3, '#b07a3a', 2.4);
      ctx.beginPath(); ctx.moveTo(-12, -18); ctx.lineTo(12, -18); ctx.lineTo(2, 0); ctx.lineTo(12, 18); ctx.lineTo(-12, 18); ctx.lineTo(-2, 0); ctx.closePath();
      ctx.fillStyle = 'rgba(220,245,255,.7)'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = k(A.INK); ctx.stroke();
      const sand = (t * 0.15) % 1;
      ctx.fillStyle = k('#ffd23f');
      ctx.beginPath(); ctx.moveTo(-10 + sand * 8, -16 + sand * 14); ctx.lineTo(10 - sand * 8, -16 + sand * 14); ctx.lineTo(1, -1); ctx.lineTo(-1, -1); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10, 17); ctx.lineTo(10, 17); ctx.lineTo(10 - (1 - sand) * 9, 17 - sand * 12); ctx.lineTo(-10 + (1 - sand) * 9, 17 - sand * 12); ctx.fill();
      ctx.fillRect(-0.8, -1, 1.6, 18);
      ctx.restore();
      happyFace(ctx, sw * 30 + 24, -44, 8, p, t);
    },
  });
  def({
    id: 'solspejl', name: 'Solspejl', cat: 'support', cost: 50, cd: 10, hp: 300,
    desc: 'En plante med et blankt spejlblad, der kaster ekstra lys på sine naboer og fanger solstråler.',
    special: 'Naboplanter, der laver sol, giver +50% sol. Fanger nedfaldende sol i nærheden automatisk.', pp: 'Laver 100 sol og fordobler naboernes sol i 10 sek.',
    perks: ['Lv3: +65% sol til naboer', 'Lv5: +80% sol til naboer'],
    crest: [0, -92],
    tick() {},
    power(p, G) { for (let i = 0; i < 4; i++) G.makeSun(p.x + U.rand(-30, 30), p.y - 70, 25, { from: p, burst: true }); p.pp = 10; },
    draw(ctx, p, t) {
      const sw = sway(p, t, 0.04);
      dirt(ctx);
      baseLeaves(ctx, '#5aa83a', 0.15, 0.9);
      A.stem(ctx, 0, -2, sw * 20, -50, 8, 6);
      ctx.save(); ctx.translate(sw * 20, -66); ctx.rotate(Math.sin(t * 0.8) * 0.2);
      A.rays(ctx, 0, 0, 26, 46, 10, t * 0.5, '#fff4a8', 0.28 + (p.pp > 0 ? 0.3 : 0));
      A.ell(ctx, 0, 0, 26, 26, 0, '#c9a24a', 3);
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(-20, -20, 20, 20); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, k('#cfe9ff')); g.addColorStop(0.55, '#ffffff'); g.addColorStop(1, k('#9fc2e6'));
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = k(A.INK); ctx.stroke();
      happyFace(ctx, 0, 2, 11, p, t);
      ctx.restore();
    },
  });
  def({
    id: 'slimknop', name: 'Slimknop', cat: 'support', cost: 75, cd: 10, hp: 400, slow: 0.4,
    desc: 'En klistret knop, der drypper slim ud omkring sig. Zombier i nærheden sumper langsomt rundt.',
    special: 'Zombier inden for ~1,5 felt bevæger sig 40% langsommere.', pp: 'Slimbølge: alle zombier i 3 rækker bliver langsomme i 10 sek.',
    perks: ['Lv3: Radius 2 felter', 'Lv5: 55% langsommere'],
    crest: [0, -72],
    tick(p, dt, G) {
      const rad = G.CW * (p.lv >= 3 ? 2 : 1.5);
      for (const z of G.zombies) if (z.alive && !z.flying && !z.under && Math.abs(z.x - p.x) < rad && Math.abs(G.rowY(z.row) - p.y) < rad) z.auraSlow = Math.max(z.auraSlow || 0, p.lv >= 5 ? 0.55 : p.s.slow);
    },
    power(p, G) { for (const z of G.zombies) if (z.alive && Math.abs(z.row - p.r) <= 1) G.slowZombie(z, 10); G.fx.ring(p.x, p.y - 30, 400, '#a8ff5a'); },
    draw(ctx, p, t) {
      dirt(ctx, 24);
      A.ell(ctx, 0, -8, 34, 7, 0, 'rgba(160,255,90,.45)', 0);
      ctx.beginPath(); ctx.moveTo(-24, -4); ctx.bezierCurveTo(-30, -40, -10, -56, 0, -60); ctx.bezierCurveTo(10, -56, 30, -40, 24, -4); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -60, 0, '#c8ff7a', '#4caf2a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k(A.INK); ctx.stroke();
      for (let i = 0; i < 3; i++) { const dt = (t * 0.7 + i * 0.33) % 1; A.ell(ctx, -16 + i * 16, -14 + dt * 10, 3, 4 + dt * 4, 0, '#b8ff6a', 1.4); }
      A.shine(ctx, -10, -40, 6, 10);
      happyFace(ctx, 0, -30, 12, p, t, 'grin');
    },
  });
  def({
    id: 'rytmerod', name: 'Rytmerod', cat: 'support', cost: 125, cd: 10, hp: 400, haste: 0.35,
    desc: 'En trommerod, der slår takten. Alle naboplanter angriber og producerer hurtigere.',
    special: '8 naboplanter angriber/producerer 35% hurtigere.', pp: 'Dobbelt tempo til alle naboer i 10 sek.',
    perks: ['Lv3: +45% tempo', 'Lv5: +55% tempo'],
    crest: [0, -76],
    tick() {},
    power(p) { p.pp = 10; },
    draw(ctx, p, t) {
      const beat = Math.abs(Math.sin(t * (p.pp > 0 ? 9 : 4.5)));
      dirt(ctx, 26);
      ctx.save(); ctx.translate(0, -26); ctx.scale(1 + beat * 0.04, 1 - beat * 0.04);
      A.rrect(ctx, -26, -24, 52, 44, 10, '#c0612f', 3);
      ctx.strokeStyle = k('#f3d07a'); ctx.lineWidth = 2.5;
      ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(-24 + i * 12, -22); ctx.lineTo(-18 + i * 12, 18); } ctx.stroke();
      A.ell(ctx, 0, -24, 26, 8, 0, '#f6e7c8', 3);
      ctx.restore();
      const a1 = -0.6 + beat * 0.7, a2 = -2.5 - beat * 0.7;
      ctx.save(); ctx.translate(-20, -40); ctx.rotate(a2); A.leaf(ctx, 0, 0, 30, 6, 0, '#62b33f'); ctx.restore();
      ctx.save(); ctx.translate(20, -40); ctx.rotate(a1); A.leaf(ctx, 0, 0, 30, 6, 0, '#62b33f'); ctx.restore();
      happyFace(ctx, 0, -22, 11, p, t, 'grin');
      if (beat > 0.95) { ctx.strokeStyle = 'rgba(255,240,150,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -50, 36, -2.4, -0.7); ctx.stroke(); }
    },
  });
  def({
    id: 'flydeblad', name: 'Flydeblad', cat: 'support', cost: 25, cd: 7.5, hp: 300, pad: true,
    desc: 'Et stort, flydende blad. Gør det muligt at plante på vand.',
    special: 'Plant den på vand - derefter kan andre planter stå ovenpå.', pp: 'Gendanner liv for planten ovenpå.',
    perks: ['Lv3: Planten ovenpå får +10% liv', 'Lv5: Planten ovenpå får +20% liv'],
    crest: [0, -14],
    tick() {},
    draw(ctx, p, t) {
      const bob = Math.sin(t * 2 + (p.seed || 0)) * 1.5;
      ctx.save(); ctx.translate(0, bob);
      ctx.beginPath(); ctx.ellipse(0, -2, 42, 14, 0, 0.25, Math.PI * 2 - 0.05); ctx.lineTo(0, -2); ctx.closePath();
      ctx.fillStyle = A.vg(ctx, -16, 12, '#7fd36a', '#2f8a3a'); ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = k(A.INK); ctx.stroke();
      ctx.strokeStyle = k('#3f9a4a'); ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { const a = 0.6 + i * 0.9; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(Math.cos(a) * 36, -2 + Math.sin(a) * 11); ctx.stroke(); }
      ctx.restore();
    },
  });

  /* ---------------------------------------------------------------
     Opslag og opgraderingsskalering
     --------------------------------------------------------------- */
  const BY = {};
  L.forEach((d, i) => { d.order = i; BY[d.id] = d; d.cat = d.cat || 'attack'; });

  function stats(id, lv) {
    const d = BY[id];
    lv = U.clamp(lv || 1, 1, MAX_LV);
    const l = lv - 1;
    const s = {
      cost: d.cost, cd: +(d.cd * (1 - 0.05 * l)).toFixed(1), hp: Math.round(d.hp * (1 + 0.15 * l)),
      dmg: d.dmg ? Math.round(d.dmg * (1 + 0.12 * l)) : 0, rate: d.rate ? +(d.rate * (1 - 0.045 * l)).toFixed(2) : 0,
      interval: d.interval ? +(d.interval * (1 - 0.06 * l)).toFixed(1) : 0, produce: d.produce || 0,
      splash: d.splash || 0, range: d.range || 0, chain: d.chain || 0, regen: d.regen ? d.regen * (1 + 0.15 * l) : 0,
      shield: d.shield ? Math.round(d.shield * (1 + 0.12 * l)) : 0, wall: d.wall || 0, slow: d.slow || 0, haste: d.haste || 0,
      arm: d.arm || 0, life: d.life || 0, pp: 1 + 0.15 * l,
    };
    if (d.instant || d.id === 'knoldmine') s.hp = d.hp;
    return s;
  }
  /* Tekst til "næste opgradering" */
  function nextUpgradeText(id, lv) {
    if (lv >= MAX_LV) return 'Maks niveau nået!';
    const a = stats(id, lv), b = stats(id, lv + 1), d = BY[id], out = [];
    if (b.dmg !== a.dmg) out.push('Skade ' + a.dmg + ' → ' + b.dmg);
    if (b.hp !== a.hp && !d.instant) out.push('Liv ' + a.hp + ' → ' + b.hp);
    if (b.rate !== a.rate) out.push('Angrebstid ' + a.rate + 's → ' + b.rate + 's');
    if (b.interval !== a.interval) out.push('Produktion hver ' + a.interval + 's → ' + b.interval + 's');
    if (b.cd !== a.cd) out.push('Genopladning ' + a.cd + 's → ' + b.cd + 's');
    out.push('Plant Power +15%');
    if (lv + 1 === 3 && d.perks) out.push('NY EVNE: ' + d.perks[0]);
    if (lv + 1 === 5 && d.perks) out.push('NY EVNE: ' + d.perks[1]);
    return out.join(' · ');
  }

  /* Tegn en plante til et lille ikon-canvas (kort, leksikon) */
  const iconCache = new Map();
  function icon(id, size, lv, locked) {
    const key = id + '|' + size + '|' + (lv || 1) + '|' + (locked ? 1 : 0);
    if (iconCache.has(key)) return iconCache.get(key);
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const d = BY[id];
    const fake = { seed: 1.3, lv: lv || 1, shootT: 9, hp: 1, maxHp: 1, s: stats(id, lv || 1), prod: 20, fuse: 99, life: 10, grow: 999, armT: 0, cool: 0 };
    if (d.id === 'knoldmine') fake.armT = 0;
    ctx.translate(size / 2, size * 0.9);
    const sc = size / 118;
    ctx.scale(sc, sc);
    if (locked) A.setTint('#1a1530', 0.92);
    try { d.draw(ctx, fake, 0.4); } catch (e) { /* ignorer */ }
    A.clearTint();
    iconCache.set(key, c);
    return c;
  }
  function iconURL(id, size, lv, locked) {
    const key = 'u|' + id + '|' + size + '|' + (lv || 1) + '|' + (locked ? 1 : 0);
    if (iconCache.has(key)) return iconCache.get(key);
    const u = icon(id, size, lv, locked).toDataURL();
    iconCache.set(key, u);
    return u;
  }

  return { LIST: L, BY, CATS, MAX_LV, stats, nextUpgradeText, icon, iconURL };
})();
