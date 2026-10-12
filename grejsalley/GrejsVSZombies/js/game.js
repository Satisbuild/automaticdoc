'use strict';
/* =====================================================================
   GREJS VS ZOMBIES - game.js
   Kampmotoren: gitter, sol, planteplacering, zombie-AI, projektiler,
   bølger, bosser, verdensmekanikker, Plant Power, evner, sejr/nederlag
   og al tegning af kampbanen.
   update(dt) er uafhængig af tegning, så motoren også kan køre
   "headless" (bruges til automatiske test af alle 150 baner).
   ===================================================================== */
GVZ.Battle = (function () {
  const U = GVZ.U, A = GVZ.A, P = GVZ.Plants, Z = GVZ.Zombies, WD = GVZ.Worlds, AU = GVZ.Audio;
  const LAY = WD.LAYOUT;

  /* Boblebarriere (fra Boblebusk) - opfører sig som en plante, zombier skal æde den */
  const BUBBLE = {
    id: '_bubble', name: 'Boble', cat: 'defense', hp: 1200, cost: 0, crest: [0, -60],
    tick(p, dt, G) { p.life -= dt; if (p.life <= 0) G.removePlant(p, true); },
    draw(ctx, p, t) {
      const f = p.hp / p.maxHp, wob = Math.sin(t * 4) * 2;
      A.shadow(ctx, 0, 0, 34, 7, 0.15);
      ctx.beginPath(); ctx.ellipse(0, -40, 38 + wob, 40 - wob, 0, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(-12, -54, 4, 0, -40, 42);
      g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(0.5, 'rgba(160,230,255,' + (0.25 + f * 0.2) + ')'); g.addColorStop(1, 'rgba(120,180,255,' + (0.4 + f * 0.2) + ')');
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(80,140,220,.8)'; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,220,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -40, 30, 3.6, 4.6); ctx.stroke();
    },
  };
  /* Løbsk minevogn/bulldozerskovl fra bosser */
  const CART = {
    id: '_cart', name: 'Minevogn', w: 0, hp: 1500, speed: 70, eat: 0, cost: 0, ab: { crush: 1 }, resist: {}, look: {},
  };

  class Battle {
    constructor(level, opts) {
      opts = opts || {};
      this.level = level;
      this.opts = opts;
      this.headless = !!opts.headless;
      this.W = LAY.W; this.H = LAY.H; this.X0 = LAY.X0; this.Y0 = LAY.Y0; this.CW = LAY.CW; this.CH = LAY.CH;
      this.rows = level.rows; this.cols = level.cols;
      this.world = WD.WORLDS[level.world];
      this.tiles = level.tiles.map((r) => r.slice());
      this.grid = []; this.pads = []; this.obst = [];
      for (let r = 0; r < this.rows; r++) { this.grid.push(new Array(this.cols).fill(null)); this.pads.push(new Array(this.cols).fill(null)); this.obst.push(new Array(this.cols).fill(null)); }
      this.plants = []; this.zombies = []; this.projs = []; this.parts = []; this.texts = []; this.picks = []; this.timers = []; this.areas = []; this.marks = []; this.beams = [];
      this.t = 0; this.state = 'intro'; this.introT = this.headless ? 0 : 2.4; this.endT = 0;
      this.sun = level.startSun;
      this.mods = level.mods || [];
      this.settings = (GVZ.Progress.S && GVZ.Progress.S.settings) || {};
      this.low = this.settings.quality === 'low';
      // kort
      const loadout = level.plantsFixed ? level.plantsFixed.filter((id) => P.BY[id]) : (opts.loadout || ['kernekanon']);
      this.cards = loadout.map((id) => this.makeCard(id));
      this.conveyor = !!(level.conveyor || level.conveyorFromLoadout);
      this.beltPool = level.conveyorFromLoadout ? (opts.loadout || []).filter((id) => P.BY[id] && P.BY[id].cat !== 'resource') : (level.conveyor || []);
      if (this.conveyor && !this.beltPool.length) this.beltPool = ['kernekanon', 'barkmur', 'tomatbombe'];
      this.belt = []; this.beltT = 2;
      if (this.conveyor) this.cards = [];
      this.selected = null; this.hover = null; this.cartSel = null;
      // plant power og evner
      this.leaves = this.mods.includes('nopower') ? 0 : (level.world > 0 || level.idx >= 2 ? 1 : 0);
      this.maxLeaves = 3;
      this.noPower = this.mods.includes('nopower');
      this.abilities = this.noPower ? [] : GVZ.Progress.abilities().map((a) => ({ def: a, cd: a.cd * 0.5 }));
      this.rageT = 0;
      // kværnere
      this.shred = [];
      for (let r = 0; r < this.rows; r++) this.shred.push({ state: level.noShredders ? 'none' : 'ready', x: this.X0 - 48 });
      // bølger
      this.waves = level.waves || [];
      this.waveIdx = 0;
      this.nextWaveT = level.firstWave || 20;
      this.waveStartHp = 1; this.waveSpawnT = 0; this.spawnQueue = [];
      this.endless = !!level.endless;
      this.banner = null;
      // statistik
      this.stats = { kills: 0, sun: 0, spent: 0, lost: 0, placed: 0, powers: 0, abilities: 0, coins: 0, gems: 0, shredUsed: 0 };
      this.skyT = 6;
      this.sandstorm = 0; this.blizzard = 0; this.windT = 0;
      this.evT = { sand: 40, wind: 28, blizz: 30, collapse: 26, vines: 28, grave: 40 };
      this.shakeA = 0; this.flashA = 0; this.flashCol = '#fff';
      this.buffT = 0;
      this.parts = this.parts || [];
      this.fx = this.makeFx();
      // forhindringer
      for (const tb of level.tombs || []) this.addObstacle(tb.r, tb.c, 'tomb', level.treasure ? 'treasure' : null);
      for (const pp of level.prePlaced || []) { const p = this.placePlantFree(pp.id, pp.r, pp.c, GVZ.Progress.owns(pp.id) ? GVZ.Progress.plantLv(pp.id) : 1); if (p && pp.protect) p.protect = true; }
      // boss
      this.boss = null;
      if (level.boss) this.makeBoss(level.boss);
      this.objective = level.objective || null;
      this.lineX = this.objective && this.objective.type === 'line' ? this.X0 + this.objective.value * this.CW : null;
      this.won = false; this.lost = false; this.result = null; this.loseReason = '';
      this.reward = null;
    }

    /* ================= Hjælpere ================= */
    rowY(r) { return this.Y0 + r * this.CH + this.CH - 18; }
    cellX(c) { return this.X0 + c * this.CW + this.CW / 2; }
    colOf(x) { return Math.floor((x - this.X0) / this.CW); }
    rowOf(y) { return Math.floor((y - this.Y0) / this.CH); }
    inGrid(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }
    later(sec, fn) { this.timers.push({ t: sec, fn }); }
    shake(a) { this.shakeA = Math.max(this.shakeA, a); }
    play(s) { if (!this.headless) AU.play(s); }
    allPlants() { return this.plants.filter((p) => p.alive && !p.def.pad); }
    plantAt(r, c) { if (!this.inGrid(r, c)) return null; return this.grid[r][c] || this.pads[r][c]; }
    neighbors(p, rad, self) {
      rad = rad == null ? 1 : rad;
      const out = [];
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (!self && dr === 0 && dc === 0) continue;
        const q = this.inGrid(p.r + dr, p.c + dc) ? this.grid[p.r + dr][p.c + dc] : null;
        if (q && q.alive) out.push(q);
      }
      return out;
    }
    anyZombieOnLawn() { return this.zombies.some((z) => z.alive && z.x < this.W - 10 && !z.under) || !!(this.boss && this.boss.alive); }
    /* Første mål foran x0 i rækken (inden x1). opts.air: også flyvende. */
    firstZombieInRow(row, x0, x1, o) {
      o = o || {};
      let best = null, bx = Infinity;
      for (const z of this.zombies) {
        if (!z.alive || z.row !== row || z.under || z.rising > 0) continue;
        if (z.flying && !o.air) continue;
        if (z.x < x0 || z.x > x1 || z.x > this.W - 6) continue;
        if (z.x < bx) { bx = z.x; best = z; }
      }
      if (!best && this.boss && this.boss.alive && this.boss.x - 70 <= x1 && this.boss.x > x0) return this.boss;
      return best;
    }
    makeCard(id) {
      const d = P.BY[id];
      const lv = GVZ.Progress.owns(id) ? GVZ.Progress.plantLv(id) : 1;
      const s = P.stats(id, lv);
      let cost = d.cost;
      if (this.mods && this.mods.includes('cheap')) cost = Math.round(cost * 0.75 / 5) * 5;
      const cdMax = s.cd;
      const startCd = d.cd >= 25 ? cdMax * 0.6 : 0;
      return { id, def: d, lv, cost, cdMax, cd: startCd };
    }

    /* ================= Planter ================= */
    canPlace(id, r, c, free) {
      if (!this.inGrid(r, c)) return 'Uden for banen';
      const d = P.BY[id];
      const tile = this.tiles[r][c];
      if (['bossarea', 'wreck', 'hole', 'vine'].includes(tile)) return 'Feltet er blokeret';
      if (this.obst[r][c]) return 'Der står en forhindring';
      if (d.pad) {
        if (tile !== 'water') return 'Flydeblad skal på vand';
        if (this.pads[r][c]) return 'Der er allerede et flydeblad';
        return null;
      }
      if (tile === 'water' && !this.pads[r][c]) return 'Plant et Flydeblad på vandet først';
      if (this.grid[r][c]) return 'Feltet er optaget';
      if (this.level.bannedCats && this.level.bannedCats.includes(d.cat)) return 'Den plantetype er ikke tilladt her';
      if (this.objective && this.objective.type === 'maxPlants' && this.allPlants().length >= this.objective.value) return 'Du må højst have ' + this.objective.value + ' planter';
      return null;
    }
    placePlant(cardIdx, r, c) {
      if (this.state !== 'play' && this.state !== 'intro') return false;
      const card = this.cards[cardIdx];
      if (!card) return false;
      if (card.cd > 0) { this.deny('Planten lader stadig op'); return false; }
      if (this.sun < card.cost) { this.deny('Ikke nok sol'); return false; }
      const why = this.canPlace(card.id, r, c);
      if (why) { this.deny(why); return false; }
      this.sun -= card.cost; this.stats.spent += card.cost;
      card.cd = card.cdMax;
      this.placePlantFree(card.id, r, c, card.lv);
      this.stats.placed++;
      return true;
    }
    placeFromBelt(i, r, c) {
      const b = this.belt[i];
      if (!b) return false;
      const why = this.canPlace(b.id, r, c);
      if (why) { this.deny(why); return false; }
      this.belt.splice(i, 1);
      const lv = GVZ.Progress.owns(b.id) ? GVZ.Progress.plantLv(b.id) : 1;
      this.placePlantFree(b.id, r, c, lv);
      this.stats.placed++;
      return true;
    }
    placePlantFree(id, r, c, lv) {
      const d = id === '_bubble' ? BUBBLE : P.BY[id];
      if (!d || !this.inGrid(r, c)) return null;
      if (id !== '_bubble' && this.canPlace(id, r, c)) return null;
      const s = id === '_bubble' ? { hp: d.hp, pp: 1 } : P.stats(id, lv || 1);
      const p = {
        id, def: d, lv: lv || 1, s: Object.assign({}, s), r, c, x: this.cellX(c), y: this.rowY(r), hp: s.hp, maxHp: s.hp,
        alive: true, t: 0, seed: Math.random() * 10, shootT: 9, cool: 0, haste: 1, prodMul: 1, dmgMul: 1, ppMul: s.pp || 1,
        pp: 0, frozen: 0, hexed: 0, shield: 0, armor: 0, eaters: [], eaten: 0, born: this.t,
      };
      // flydeblad giver ekstra liv
      if (!d.pad && this.pads[r][c] && this.pads[r][c].lv >= 3) { p.maxHp *= this.pads[r][c].lv >= 5 ? 1.2 : 1.1; p.hp = p.maxHp; }
      if (d.pad) { this.pads[r][c] = p; p.y = this.rowY(r) + 4; }
      else this.grid[r][c] = p;
      if (this.pads[r][c] && !d.pad) p.y = this.rowY(r) - 6;
      this.plants.push(p);
      if (d.init) d.init(p, this);
      if (!this.headless) { this.fx.dust(p.x, p.y, 8); this.play('place'); }
      return p;
    }
    removePlant(p, silent, byZombie) {
      if (!p.alive) return;
      p.alive = false;
      if (this.grid[p.r] && this.grid[p.r][p.c] === p) this.grid[p.r][p.c] = null;
      if (this.pads[p.r] && this.pads[p.r][p.c] === p) {
        this.pads[p.r][p.c] = null;
        const top = this.grid[p.r][p.c];
        if (top && this.tiles[p.r][p.c] === 'water') this.removePlant(top, false, byZombie); // planten synker
      }
      if (byZombie && p.def !== BUBBLE) {
        this.stats.lost++;
        if (p.protect) this.lose('En truet plante blev ædt!');
        if (this.level.rule === 'noLoss') this.lose('Du mistede en plante!');
      }
      if (!silent && !this.headless) { this.fx.debris(p.x, p.y - 30, '#5aa83a', 10); this.play('plantDie'); }
    }
    damagePlant(p, dmg, src) {
      if (!p || !p.alive) return;
      if (p.shield > 0) { const a = Math.min(p.shield, dmg); p.shield -= a; dmg -= a; }
      if (p.armor > 0 && dmg > 0) { const a = Math.min(p.armor, dmg); p.armor -= a; dmg -= a; }
      p.hp -= dmg; p.hitT = 0.1;
      if (p.hp <= 0) this.removePlant(p, false, true);
    }
    shovel(r, c) {
      const p = this.plantAt(r, c);
      if (!p) { this.deny('Ingen plante her'); return false; }
      if (p.protect) { this.deny('Truede planter kan ikke graves op'); return false; }
      this.removePlant(p, true);
      if (!this.headless) { this.fx.dust(p.x, p.y, 12); this.play('shovel'); }
      return true;
    }
    resetCooldowns() { for (const c of this.cards) c.cd = 0; this.fx.ring(160, 60, 200, '#ffe14a'); }
    placeBubble(r, c, hp, slow) {
      if (!this.inGrid(r, c) || this.grid[r][c] || this.obst[r][c]) return false;
      const t = this.tiles[r][c];
      if (['bossarea', 'wreck', 'hole', 'vine'].includes(t) || (t === 'water' && !this.pads[r][c])) return false;
      const p = this.placePlantFree('_bubble', r, c, 1);
      if (!p) return false;
      p.hp = p.maxHp = hp; p.life = 20; p.slowPop = slow;
      return true;
    }

    /* ================= Forhindringer ================= */
    addObstacle(r, c, type, extra) {
      if (!this.inGrid(r, c) || this.obst[r][c] || this.grid[r][c]) return false;
      this.obst[r][c] = { type, hp: type === 'ice' ? 600 : 300, maxHp: type === 'ice' ? 600 : 300, r, c, extra, seed: Math.random() * 10 };
      return true;
    }
    damageObstacle(o, dmg) {
      o.hp -= dmg;
      if (o.hp <= 0) {
        this.obst[o.r][o.c] = null;
        if (!this.headless) this.fx.debris(this.cellX(o.c), this.rowY(o.r) - 30, o.type === 'ice' ? '#bfe4ff' : '#8a8a96', 12);
        if (o.extra === 'treasure') { this.makeCoin(this.cellX(o.c), this.rowY(o.r) - 40, 'gold'); if (Math.random() < 0.3) this.makeCoin(this.cellX(o.c) + 20, this.rowY(o.r) - 40, 'gem'); }
      }
    }

    /* ================= Zombier ================= */
    spawnZombie(id, row, x, o) {
      o = o || {};
      if (id === 'scarab' && !o.single) {
        for (let i = 0; i < 3; i++) this.spawnZombie('scarab', row, x + i * 26, Object.assign({}, o, { single: true }));
        return null;
      }
      const d = id === '_cart' ? CART : Z.BY[id];
      if (!d) return null;
      const tanky = this.mods.includes('tanky') ? 1.4 : 1;
      const z = {
        def: d, id, row, x, yy: this.rowY(row), hp: d.hp * tanky, maxHp: d.hp * tanky, armor: (d.armor || 0) * tanky, armorMax: (d.armor || 0) * tanky,
        shieldHp: (d.shield || 0) * tanky, shieldMax: (d.shield || 0) * tanky, alive: true, state: 'walk', dir: -1, walk: Math.random() * 6,
        slowT: 0, freezeT: 0, stunT: 0, poison: null, burn: null, flash: 0, age: 0, seed: Math.random() * 10, wardHp: 0, auraSlow: 0,
        flying: !!(d.ab && d.ab.fly), under: !!(d.ab && d.ab.dig), rising: o.rise ? 1 : 0, abT: 2 + Math.random() * 2, knock: 0, dmgAcc: 0, dmgT: 0,
        leaf: !!o.leaf, coin: !!o.coin || !!this.level.treasure, noLose: id === '_cart', lastHit: 0,
      };
      if (this.mods.includes('armored') && !z.armor && !d.heavy && !z.flying && id !== '_cart' && !d.small) { z.armor = z.armorMax = 370; z.potHat = true; }
      if (d.ab && d.ab.swingIn) { z.state = 'swing'; z.swingT = 0; z.swingFrom = x; z.swingTo = this.X0 + this.CW * U.rand(4.6, 6.4); }
      if (id === '_cart') { z.state = 'walk'; z.isCart = true; }
      this.zombies.push(z);
      if (!this.headless && id !== '_cart') { GVZ.Progress.seeZombie(id); if (Math.random() < 0.15) this.play('groan'); }
      return z;
    }
    zombieSpeed(z) {
      let s = z.def.speed;
      if (z.def.ab.jump && z.jumped) s = 19;
      if (z.def.ab.berserk) s *= 1 + 2 * (1 - z.hp / z.maxHp);
      if (z.slowT > 0) s *= 0.5;
      if (z.auraSlow > 0) s *= 1 - z.auraSlow;
      const c = this.colOf(z.x);
      if (this.inGrid(z.row, c)) { const t = this.tiles[z.row][c]; if (t === 'ice') s *= 1.35; if (t === 'water') s *= 0.85; }
      if (this.mods.includes('fast')) s *= 1.3;
      if (this.windT > 0 && z.dir < 0) s += 30;
      return s;
    }
    /* Planten, som zombien står og rører ved (foran sig) */
    plantInFront(z, reach) {
      reach = reach || 46;
      const c0 = this.colOf(z.x);
      for (let dc = -1; dc <= 1; dc++) {
        const c = c0 + dc;
        if (!this.inGrid(z.row, c)) continue;
        const p = this.grid[z.row][c] || this.pads[z.row][c];
        if (!p || !p.alive || p.def.ground) continue;
        if (p.id === 'knoldmine' && !(p.armT > 0)) continue;
        const d = z.dir < 0 ? z.x - p.x : p.x - z.x;
        if (d > -14 && d < reach) return p;
      }
      return null;
    }
    resist(z, type) { const r = z.def.resist && z.def.resist[type]; return r == null ? 1 : r; }
    damageZombie(z, dmg, o) {
      o = o || {};
      if (z.boss) return this.damageBoss(z, dmg, o);
      if (!z.alive || dmg <= 0) return;
      if (z.phased) return;
      const type = o.type || 'normal';
      dmg *= this.resist(z, type === 'explode' ? 'none' : type);
      if (z.frozenVuln && z.freezeT > 0) dmg *= 1.25;
      if (z.wardHp > 0 && type !== 'poison') { const a = Math.min(z.wardHp, dmg); z.wardHp -= a; dmg -= a; }
      // skjold forfra
      if (z.shieldHp > 0 && !o.bypassShield && type !== 'poison' && type !== 'explode' && !o.fromBehind) {
        let sd = dmg * (type === 'elec' && z.def.ab.regenShield ? 3 : 1);
        const a = Math.min(z.shieldHp, sd); z.shieldHp -= a; sd -= a;
        dmg = sd > 0 ? sd / (type === 'elec' && z.def.ab.regenShield ? 3 : 1) : 0;
        if (!o.silent) this.play('armor');
        if (z.shieldHp <= 0 && !this.headless) this.fx.debris(z.x - 30, z.yy - 50, z.def.ab.regenShield ? '#9ae8ff' : '#b07a42', 10);
      }
      if (z.armor > 0 && type !== 'poison' && dmg > 0) {
        const m = o.armorMul || 1;
        const a = Math.min(z.armor, dmg * m); z.armor -= a; dmg -= a / m;
        if (!o.silent) this.play('armor');
        if (z.armor <= 0 && !this.headless) {
          this.fx.debris(z.x, z.yy - 110, z.def.id === 'pianist' ? '#3a2418' : '#9aa2b0', 10);
          if (z.def.ab.crush) { z.stunT = 0.8; }
        }
      }
      if (dmg > 0) z.hp -= dmg;
      z.lastHit = this.t;
      if (!o.silent) z.flash = 0.08;
      if (this.settings.dmgNumbers && !this.headless) { z.dmgAcc += dmg; }
      if (z.hp <= 0) this.killZombie(z, o);
    }
    killZombie(z, o) {
      if (!z.alive) return;
      o = o || {};
      z.alive = false; z.dieT = 0;
      z.burnt = o.type === 'explode' || o.type === 'fire';
      if (z.isCart) { if (!this.headless) this.fx.explosion(z.x, z.yy - 30, 50, false); return; }
      this.stats.kills++;
      if (!this.headless) { this.play('zdie'); if (z.hp < z.maxHp * 0.5 && !z.burnt) this.fx.head(z); }
      if (z.leaf) this.makePick('leaf', z.x, z.yy - 50);
      if (z.coin || Math.random() < 0.04) this.makeCoin(z.x, z.yy - 50, Math.random() < 0.15 ? 'gold' : 'silver');
      if (z.carry) {
        const q = z.carry; z.carry = null;
        if (!this.grid[q.r][q.c] && this.canPlace(q.id, q.r, q.c) === null) { const np = this.placePlantFree(q.id, q.r, q.c, q.lv); if (np) np.hp = Math.max(1, q.hp); }
      }
      const ab = z.def.ab;
      if (ab.split && !o.swallow) for (let i = 0; i < ab.split; i++) this.spawnZombie('mini', z.row, z.x + (i ? 24 : -10));
      if (ab.tomb && !o.swallow && Math.random() < 0.25 && this.obst.flat().filter(Boolean).length < 5) { const c = this.colOf(z.x); if (c >= 3 && c < this.cols && !this.grid[z.row][c]) this.addObstacle(z.row, c, 'tomb'); }
    }
    swallow(z) { if (z.boss) return; this.killZombie(z, { swallow: true }); z.gone = true; }
    dragUnder(z) { if (z.boss) return; this.killZombie(z, { swallow: true }); z.sink = 1; if (!this.headless) this.fx.dust(z.x, z.yy, 14); }
    freezeZombie(z, dur, vuln) {
      if (z.boss) { this.bossStun(z.def.weak === 'ice' ? dur : dur * 0.5); return; }
      if (this.resist(z, 'ice') === 0) return;
      z.freezeT = Math.max(z.freezeT, dur); z.slowT = Math.max(z.slowT, dur + 4);
      if (vuln) z.frozenVuln = true;
      z.burn = null;
    }
    slowZombie(z, dur) { if (z.boss || this.resist(z, 'ice') === 0) return; z.slowT = Math.max(z.slowT, dur); }
    poisonZombie(z, dps, dur) {
      if (z.boss) { this.damageBoss(z, dps * dur * 0.5, { type: 'poison' }); return; }
      const r = this.resist(z, 'poison'); if (r === 0) return;
      z.poison = { dps: Math.max(dps * r, z.poison ? z.poison.dps : 0), t: Math.max(dur, z.poison ? z.poison.t : 0) };
    }
    burnZombie(z, dps, dur) {
      if (z.boss) return;
      z.burn = { dps: dps * this.resist(z, 'fire'), t: dur };
      z.slowT = 0; z.freezeT = 0;
    }

    updateZombie(z, dt) {
      const d = z.def, ab = d.ab;
      z.age += dt;
      if (z.flash > 0) z.flash -= dt;
      if (z.dmgAcc > 0) { z.dmgT -= dt; if (z.dmgT <= 0) { if (z.dmgAcc >= 1) this.fx.text(z.x + U.rand(-10, 10), z.yy - 120, Math.round(z.dmgAcc), '#fff', 15); z.dmgAcc = 0; z.dmgT = 0.3; } }
      // status-effekter
      if (z.poison) { z.poison.t -= dt; this.damageZombie(z, z.poison.dps * dt, { type: 'poison', silent: true }); if (z.poison && z.poison.t <= 0) z.poison = null; if (!z.alive) return; }
      if (z.burn) { z.burn.t -= dt; this.damageZombie(z, z.burn.dps * dt, { type: 'fire', silent: true, bypassShield: true }); if (z.burn && z.burn.t <= 0) z.burn = null; if (!z.alive) return; }
      if (z.slowT > 0) z.slowT -= dt;
      const c = this.colOf(z.x);
      if (this.inGrid(z.row, c) && this.tiles[z.row][c] === 'bog' && !z.flying && !z.under) this.damageZombie(z, 10 * dt * this.resist(z, 'poison'), { type: 'poison', silent: true });
      if (!z.alive) return;
      for (const a of this.areas) if (a.type === 'fire' && a.r === z.row && Math.abs(this.cellX(a.c) - z.x) < this.CW * 0.55 && !z.flying) this.damageZombie(z, 30 * dt, { type: 'fire', silent: true, bypassShield: true });
      if (!z.alive) return;
      if (ab.regen) z.hp = Math.min(z.maxHp, z.hp + ab.regen * dt);
      if (ab.regenShield && this.t - z.lastHit > 4 && z.shieldHp < z.shieldMax) z.shieldHp = Math.min(z.shieldMax, z.shieldHp + ab.regenShield * dt);
      if (ab.phase) { z.phT = (z.phT || ab.phase.every) - dt; if (z.phT <= 0) { z.phased = !z.phased; z.phT = z.phased ? ab.phase.dur : ab.phase.every; } }
      // rækkeskift-animation
      const ty = this.rowY(z.row);
      z.yy += (ty - z.yy) * Math.min(1, dt * 6);
      if (z.rising > 0) { z.rising -= dt * 1.2; return; }
      if (z.knock > 0) { const m = Math.min(z.knock, dt * 300); z.x += m; z.knock -= m; return; }
      if (z.freezeT > 0) { z.freezeT -= dt; if (z.freezeT <= 0) z.frozenVuln = false; return; }
      if (z.stunT > 0) { z.stunT -= dt; return; }
      const sp = this.zombieSpeed(z);
      // ---------------- særlige tilstande ----------------
      if (z.state === 'swing') {
        z.swingT += dt / 1.3;
        z.x = U.lerp(z.swingFrom, z.swingTo, U.easeInOut(Math.min(1, z.swingT)));
        z.lift = Math.sin(Math.min(1, z.swingT) * Math.PI) * 120;
        if (z.swingT >= 1) { z.state = 'walk'; z.lift = 0; if (!this.headless) this.fx.dust(z.x, z.yy, 8); }
        return;
      }
      if (z.state === 'jump') {
        z.jT += dt / 0.8;
        z.x = U.lerp(z.jFrom, z.jTo, Math.min(1, z.jT));
        z.lift = Math.sin(Math.min(1, z.jT) * Math.PI) * (ab.jump === 2 ? 110 : 80);
        if (z.jT >= 1) { z.state = 'walk'; z.lift = 0; z.jumped = true; }
        return;
      }
      if (z.state === 'blast') {
        z.jT += dt / 1.2;
        z.x = U.lerp(z.jFrom, z.jTo, Math.min(1, z.jT));
        z.lift = Math.sin(Math.min(1, z.jT) * Math.PI) * 220;
        if (z.jT >= 1) { z.state = 'walk'; z.lift = 0; z.dir = 1; if (!this.headless) this.fx.dust(z.x, z.yy, 12); }
        return;
      }
      if (z.state === 'emerge') { z.jT -= dt; if (z.jT <= 0) { z.state = 'walk'; z.dir = 1; } return; }
      if (z.state === 'swoop') {
        z.jT += dt;
        z.swoopY = Math.sin(Math.min(1, z.jT / 1) * Math.PI) * 60;
        if (z.jT > 0.5 && !z.swooped) { z.swooped = true; const p = this.plantInFront(z, 60); if (p) { this.damagePlant(p, ab.swoop.dmg, z); z.hp = Math.min(z.maxHp, z.hp + ab.swoop.dmg * 0.5); if (!this.headless) this.fx.burst(p.x, p.y - 40, '#c0102a', 8, 120); } }
        if (z.jT >= 1) { z.state = 'walk'; z.flying = true; z.swoopY = 0; }
        return;
      }
      if (z.state === 'throw' || z.state === 'gun') {
        // står stille og angriber - tjek om der stadig er mål
        const spec = ab.thrower || ab.gunner;
        const tgt = this.targetPlantAhead(z, spec.range);
        if (!tgt) { z.state = 'walk'; }
        else {
          z.throwT = (z.throwT || 0) - dt;
          if (z.throwT <= 0) {
            z.throwT = spec.every;
            if (ab.gunner) this.zShot(z, tgt, spec.dmg);
            else this.zLob(z, tgt, spec);
          }
          return;
        }
      }
      if (z.state === 'cannon') {
        z.throwT = (z.throwT || 0) - dt;
        if (z.throwT <= 0) {
          z.throwT = ab.cannon.every;
          const plants = this.plants.filter((p) => p.alive && !p.def.pad && Math.abs(p.r - z.row) <= 1 && p.x < z.x);
          if (plants.length) this.zLob(z, U.pick(plants), { dmg: ab.cannon.dmg, proj: 'cannon' });
          z.shots = (z.shots || 0) + 1;
          if (z.shots >= ab.cannon.shots) z.state = 'walk';
        }
        return;
      }
      // ---------------- flyvende ----------------
      if (z.flying) {
        if (ab.fly === 'bird') return this.updateParrot(z, dt, sp);
        z.x += z.dir * sp * dt;
        z.walk += dt * 4;
        if (ab.swoop) {
          z.abT -= dt;
          if (z.abT <= 0) { z.abT = ab.swoop.every; const p = this.plantInFront(z, 70); if (p) { z.state = 'swoop'; z.jT = 0; z.swooped = false; z.flying = false; } }
        }
        this.checkHouse(z);
        return;
      }
      // ---------------- under jorden ----------------
      if (z.under) {
        z.x -= sp * 1.15 * dt; z.walk += dt * 6;
        if (z.x <= this.X0 + 30) { z.under = false; z.state = 'emerge'; z.jT = 0.8; z.dir = 1; if (!this.headless) this.fx.dust(z.x, z.yy, 16); }
        return;
      }
      // ---------------- evner, der virker mens man går ----------------
      if (z.x < this.W - 30) {
        if (ab.ward) { z.abT -= dt; if (z.abT <= 0) { z.abT = ab.ward.every; for (const o of this.zombies) if (o !== z && o.alive && Math.abs(o.x - z.x) < ab.ward.rad * this.CW && Math.abs(o.row - z.row) <= 1) { o.wardHp = Math.max(o.wardHp, ab.ward.amt); } if (!this.headless) this.fx.ring(z.x, z.yy - 60, ab.ward.rad * this.CW, '#9ae0ff'); } }
        if (ab.heal) { z.abT -= dt; if (z.abT <= 0) { z.abT = ab.heal.every; for (const o of this.zombies) if (o.alive && Math.abs(o.x - z.x) < ab.heal.rad * this.CW && Math.abs(o.row - z.row) <= 1 && o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + ab.heal.amt); if (!this.headless) this.fx.sparkle(o.x, o.yy - 80, '#ff9ad5', 3); } } }
        if (ab.raise) { z.abT -= dt; if (z.abT <= 0) { z.abT = ab.raise.every; const n = U.randi(1, 2); for (let i = 0; i < n; i++) { const rr = U.clamp(z.row + U.randi(-1, 1), 0, this.rows - 1); if (this.level.lanes && !this.level.lanes.includes(rr)) continue; this.spawnZombie(U.pick(['shambler', 'shambler', 'pothead']), rr, Math.min(this.W - 20, z.x + U.rand(40, 120)), { rise: true }); } if (!this.headless) this.fx.burst(z.x, z.yy - 60, '#7affa0', 12, 100); } }
        if (ab.hex) { z.abT -= dt; if (z.abT <= 0) { z.abT = ab.hex.every; const p = this.targetPlantAhead(z, ab.hex.range); if (p) { p.hexed = ab.hex.dur; if (!this.headless) { this.fx.burst(p.x, p.y - 40, '#c07aff', 16, 120); this.play('poison'); } } } }
        if (ab.kick) { z.abT -= dt; if (z.abT <= 0) { z.abT = ab.kick.every; const o = this.zombies.find((o) => o !== z && o.alive && o.row === z.row && o.x < z.x && z.x - o.x < this.CW * 1.4 && !o.flying && !o.def.heavy); if (o) { o.x -= this.CW * 1.3; if (!this.headless) this.fx.dust(o.x, o.yy, 6); } } }
        if (ab.lane) { z.abT -= dt; if (z.abT <= 0) { z.abT = ab.lane.every; const opts = [z.row - 1, z.row + 1].filter((r) => r >= 0 && r < this.rows && (!this.level.lanes || this.level.lanes.includes(r))); if (opts.length && !this.plantInFront(z)) z.row = U.pick(opts); } }
        if (ab.blast && !z.blasted) { z.abT -= dt; if (z.age > ab.blast && z.x < this.X0 + this.CW * 8) { z.blasted = true; z.state = 'blast'; z.jT = 0; z.jFrom = z.x; z.jTo = this.X0 + 30; if (!this.headless) { this.fx.explosion(z.x, z.yy - 20, 40, false); this.play('explode'); } return; } }
        if (ab.imp && !z.thrown && z.hp < z.maxHp * 0.5 && z.x > this.X0 + this.CW * 3) { z.thrown = true; const m = this.spawnZombie('mini', z.row, z.x); if (m) { m.state = 'jump'; m.jT = 0; m.jFrom = z.x; m.jTo = Math.max(this.X0 + 40, z.x - this.CW * 5); m.jumped = true; } }
        if (ab.laser) { z.lasT = (z.lasT == null ? ab.laser.every : z.lasT) - dt; if (z.lasT <= 0) { z.lasT = ab.laser.every; const p = this.targetPlantAhead(z, 9); if (p) { this.damagePlant(p, ab.laser.dmg, z); this.beams.push({ x0: z.x - 30, x1: p.x, y: z.yy - 110, t: 0.3, col: '#ff4a4a', w: 8 }); z.laserT = 0.4; this.play('laser'); } } if (z.laserT > 0) z.laserT -= dt; }
        if (ab.cannon && !z.shots && z.x <= this.X0 + this.CW * 8.6) { z.state = 'cannon'; z.throwT = 1.5; return; }
        if ((ab.thrower || ab.gunner) && z.state === 'walk') { const spec = ab.thrower || ab.gunner; if (this.targetPlantAhead(z, spec.range)) { z.state = ab.gunner ? 'gun' : 'throw'; z.throwT = 0.6; return; } }
      }
      // ---------------- gå / æd ----------------
      const p = this.plantInFront(z);
      if (ab.crush && z.armor > 0 || z.isCart) {
        if (p) {
          if (p.def.tall) { if (z.isCart) { this.damagePlant(p, 1500, z); this.killZombie(z, {}); return; } z.armor = 0; z.stunT = 1; if (!this.headless) this.fx.debris(z.x - 30, z.yy - 40, '#3a2418', 14); this.play('armor'); return; }
          this.removePlant(p, false, true); if (!this.headless) { this.fx.dust(p.x, p.y, 14); this.shake(3); }
        }
        // tornmåtte under hjulene
        const cc = this.colOf(z.x);
        if (this.inGrid(z.row, cc)) { const q = this.grid[z.row][cc]; if (q && q.id === 'tornmaatte' && Math.abs(q.x - z.x) < 30) { this.damageZombie(z, 400, { bypassShield: true }); q.lives = (q.lives || 1) - 1; if (q.lives <= 0) this.removePlant(q, false, true); } }
        z.x += z.dir * sp * dt; z.walk += dt * 5;
        this.checkHouse(z);
        return;
      }
      if (ab.jump && !z.jumped && p) {
        if (p.def.tall) { z.jumped = true; }
        else {
          // spring over (1 eller 2 planter)
          z.state = 'jump'; z.jT = 0; z.jFrom = z.x; z.jTo = z.x - this.CW * (ab.jump === 2 ? 2.1 : 1.15);
          if (ab.jump === 2) { const c2 = this.colOf(z.x) - 1, q = this.inGrid(z.row, c2) ? this.grid[z.row][c2] : null; if (q && q.def.tall) z.jTo = z.x - this.CW * 1.15; }
          return;
        }
      }
      if (ab.smash && p) {
        z.smashT = (z.smashT || 0) + dt / 1.1;
        if (z.smashT >= 1) {
          z.smashT = 0;
          if (p.def.tall) this.damagePlant(p, 4000, z); else this.removePlant(p, false, true);
          if (!this.headless) { this.fx.dust(p.x, p.y, 18); this.shake(6); this.play('explode'); }
        }
        z.state = 'eat';
        return;
      }
      if (p) {
        z.state = 'eat';
        let eat = d.eat * dt;
        if (p.def.cat === 'defense' && d.id === 'gnawer') eat *= 1;
        this.damagePlant(p, eat, z);
        if (!p.eaters.includes(z)) p.eaters.push(z);
        p.eatenT = 0.2;
        if (ab.toxicBite && p.alive) { p.poisonT = 5; p.poisonDps = ab.toxicBite; }
        z.chompT = (z.chompT || 0) - dt;
        if (z.chompT <= 0) { z.chompT = 0.45; this.play('chomp'); }
        return;
      }
      z.state = 'walk';
      z.smashT = 0;
      z.x += z.dir * sp * dt;
      z.walk += dt * sp * 0.22;
      if (z.dir > 0 && z.x > this.W + 60) { z.alive = false; z.gone = true; }
      this.checkHouse(z);
    }
    updateParrot(z, dt, sp) {
      z.walk += dt * 6;
      if (!z.carry) {
        z.x -= sp * dt;
        // find første plante under sig
        const c = this.colOf(z.x);
        if (this.inGrid(z.row, c)) {
          const p = this.grid[z.row][c];
          if (p && p.alive && Math.abs(p.x - z.x) < 14 && !p.protect && !p.def.instant) {
            z.carry = { id: p.id, lv: p.lv, r: p.r, c: p.c, hp: p.hp, s: p.s, seed: p.seed, shootT: 9, prod: 10, maxHp: p.maxHp, cool: 0, fuse: 99, life: 9, grow: 99 };
            this.removePlant(p, true, true);
            if (!this.headless) this.play('whoosh');
            z.dir = 1;
          }
        }
        this.checkHouse(z);
      } else {
        z.x += sp * 1.4 * dt;
        if (z.x > this.W + 60) { z.alive = false; z.gone = true; }
      }
    }
    targetPlantAhead(z, range) {
      let best = null, bx = -Infinity;
      for (const p of this.plants) {
        if (!p.alive || p.r !== z.row || p.def.ground || p.def.pad) continue;
        if (p.x > z.x - 20 || p.x < z.x - range * this.CW) continue;
        if (p.x > bx) { bx = p.x; best = p; }
      }
      return best;
    }
    zLob(z, p, spec) {
      if (!this.headless) this.play('lob');
      this.projs.push({ kind: spec.proj || 'rock', enemy: true, lob: true, x0: z.x - 20, y0: z.yy - 90, tx: p.x, ty: p.y - 30, t: 0, dur: 0.9, x: z.x, y: z.yy - 90, target: p, dmg: spec.dmg, freeze: spec.freeze, life: 3 });
      z.throwT2 = 0;
    }
    zShot(z, p, dmg) {
      if (!this.headless) this.play('shoot');
      this.projs.push({ kind: 'bullet', enemy: true, x: z.x - 30, y: z.yy - 74, vx: -560, vy: 0, row: z.row, dmg, life: 3 });
    }
    checkHouse(z) {
      if (z.x >= this.X0 - 30 || z.dir > 0) return;
      if (z.noLose) { z.alive = false; z.gone = true; return; }
      const sh = this.shred[z.row];
      if (sh && sh.state === 'ready') { this.triggerShredder(z.row); return; }
      if (sh && sh.state === 'run') return;
      if (z.x < this.X0 - 90) this.lose('Zombierne nåede ind i huset!');
    }
    triggerShredder(r) {
      const sh = this.shred[r];
      sh.state = 'run'; sh.x = this.X0 - 48;
      this.stats.shredUsed++;
      this.play('shredder');
    }

    /* ================= Projektiler ================= */
    shoot(p, x, y, spec) {
      p.shootT = 0;
      const dmg = spec.dmg * (p.dmgMul || 1);
      const lv = p.lv || 1;
      const pr = Object.assign({}, spec, { x, y, dmg, row: spec.toRow != null ? spec.toRow : p.r, life: spec.life || 3, hit: [], src: p, gold: lv >= 5 });
      if (!spec.free) { pr.vx = spec.speed || 500; pr.vy = 0; pr.ty = spec.toRow != null ? this.rowY(spec.toRow) - 58 : y; }
      if (spec.boomerang) { pr.startX = x; pr.out = true; }
      pr.trail = [];
      this.projs.push(pr);
      if (!this.headless) this.play(spec.kind === 'boomerang' ? 'whoosh' : spec.big ? 'shootHeavy' : 'shoot');
    }
    lob(p, x, y, target, spec) {
      p.shootT = 0;
      const ty = target.boss ? this.rowY(p.r) - 40 : target.fake ? target.y - 30 : target.yy - 50;
      const tx = target.boss ? target.x - 60 : target.x;
      this.projs.push(Object.assign({}, spec, { lob: true, x0: x, y0: y, tx, ty, x, y, t: 0, dur: spec.dur || 0.9, target: target.fake ? null : target, dmg: spec.dmg * (p.dmgMul || 1), life: 4, src: p, row: target.row != null ? target.row : p.r }));
      if (!this.headless) this.play('lob');
    }
    beam(p, row, y, spec) {
      p.shootT = 0;
      const dmg = spec.dmg * (p.dmgMul || 1);
      for (const z of this.zombies) if (z.alive && z.row === row && z.x > p.x && z.x < this.W && !z.under && (!z.flying || spec.air)) this.damageZombie(z, dmg, { type: 'pierce' });
      if (this.boss && this.boss.alive) this.damageBoss(this.boss, dmg, { type: 'pierce' });
      // gravsten og is-blokke i rækken
      for (let c = this.colOf(p.x) + 1; c < this.cols; c++) if (this.obst[row][c]) this.damageObstacle(this.obst[row][c], dmg);
      this.beams.push({ x0: p.x + 30, x1: this.W, y, t: spec.big ? 0.2 : 0.35, col: '#ff6bd5', w: spec.thin ? 4 : spec.big ? 22 : 12 });
      if (!this.headless && !spec.thin) this.play('laser');
    }
    chain(x, y, first, spec) {
      let cur = first, px = x, py = y;
      const hit = new Set();
      const range = spec.range || 190;
      for (let i = 0; i < (spec.jumps || 3) + 1 && cur; i++) {
        hit.add(cur);
        const cx = cur.boss ? cur.x - 60 : cur.x, cy = cur.boss ? this.rowY(2) - 120 : cur.yy - 60 - (cur.flying ? 60 : 0);
        this.beams.push({ x0: px, y0: py, x1: cx, y1: cy, t: 0.25, col: '#9ffcff', w: spec.big ? 6 : 3, zig: true });
        this.damageZombie(cur, spec.dmg * (i === 0 ? 1 : 0.8), { type: 'elec' });
        if (spec.stun && !cur.boss && cur.alive) cur.stunT = Math.max(cur.stunT, spec.stun);
        if (cur.flying && cur.def.ab.fly === 'balloon') { cur.flying = false; if (!this.headless) this.fx.burst(cur.x, cur.yy - 170, '#ff8ad5', 10, 140); }
        px = cx; py = cy;
        let nb = null, nd = Infinity;
        for (const z of this.zombies) {
          if (!z.alive || hit.has(z) || z.under) continue;
          const d = U.dist(cx, cy, z.x, z.yy - 60);
          if (d < range && d < nd) { nd = d; nb = z; }
        }
        cur = nb;
      }
      if (!this.headless) this.play('zap');
    }
    flameRow(row, x0, x1, dmg, o) {
      o = o || {};
      for (const z of this.zombies) if (z.alive && z.row === row && z.x >= x0 && z.x <= x1 && !z.under) { this.damageZombie(z, dmg, { type: 'fire', bypassShield: true }); if (z.alive) this.burnZombie(z, 6, 3); }
      if (this.boss && this.boss.alive && x1 >= this.boss.x - 80) this.damageBoss(this.boss, dmg * (o.big ? 0.6 : 1), { type: 'fire' });
      for (let c = 0; c < this.cols; c++) { const ob = this.obst[row][c]; if (ob && ob.type === 'ice') this.damageObstacle(ob, 9999); }
      if (!this.headless) {
        this.fx.fireRow(row, x0, x1, o.thin);
        if (!o.thin) { this.play('fire'); if (o.big) this.play('explode'); }
      }
    }
    explode(x, y, rad, dmg, o) {
      o = o || {};
      for (const z of this.zombies) {
        if (!z.alive) continue;
        if (o.rowOnly && z.row !== o.row) continue;
        const zy = z.yy - 40 - (z.flying ? 60 : 0);
        if (Math.abs(z.x - x) < rad + 20 && Math.abs(zy - y) < rad + 40) this.damageZombie(z, dmg, { type: 'explode' });
      }
      if (this.boss && this.boss.alive && x + rad > this.boss.x - 110) { this.damageBoss(this.boss, dmg * 0.6, { type: 'explode' }); if (dmg >= 1000) this.bossStun(2.5); }
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) { const ob = this.obst[r][c]; if (ob && Math.abs(this.cellX(c) - x) < rad + 30 && Math.abs(this.rowY(r) - 40 - y) < rad + 40) this.damageObstacle(ob, dmg); }
      if (!this.headless) {
        this.fx.explosion(x, y, rad, o.big);
        this.shake(o.big ? 10 : 5);
        this.play(o.big ? 'bigExplode' : 'explode');
      }
    }
    poisonCloud(x, y, rad, dur, dps) { this.areas.push({ type: 'gas', x, y, rad, t: dur, dps, tick: 0 }); }
    burnGround(r, c, dur) { if (this.inGrid(r, c)) this.areas.push({ type: 'fire', r, c, t: dur }); }
    gust(row, fromX, dist, o) {
      o = o || {};
      for (const z of this.zombies) {
        if (!z.alive || z.row !== row || z.x < fromX || z.under) continue;
        if (z.flying) { z.blown = true; this.killZombie(z, {}); z.blowV = 600; continue; }
        if (z.def.heavy) z.knock += dist * 0.4; else z.knock += dist;
        if (o.slow) this.slowZombie(z, 4);
      }
      if (!this.headless) { this.fx.wind(row, fromX); this.play('whoosh'); }
    }
    updateProjs(dt) {
      const zs = this.zombies;
      for (const pr of this.projs) {
        if (pr.dead) continue;
        pr.life -= dt;
        if (pr.life <= 0) { pr.dead = true; continue; }
        if (!this.headless && !this.low && pr.trail) { pr.trail.push(pr.x, pr.y); if (pr.trail.length > 12) pr.trail.splice(0, 2); }
        if (pr.lob) { this.updateLob(pr, dt); continue; }
        const px = pr.x;
        pr.x += pr.vx * dt;
        if (pr.ty != null && !pr.free) pr.y += (pr.ty - pr.y) * Math.min(1, dt * 10);
        else pr.y += (pr.vy || 0) * dt;
        if (pr.enemy) { this.updateEnemyShot(pr, px); continue; }
        if (pr.x > this.W + 30 || pr.x < -30 || pr.y < 60 || pr.y > this.H + 30 || (pr.maxX && pr.x > pr.maxX)) {
          if (!pr.boomerang) { pr.dead = true; continue; }
        }
        // bumerang vender
        if (pr.boomerang) {
          if (pr.out && pr.x - pr.startX > pr.boomerang) { pr.out = false; pr.vx = -Math.abs(pr.vx); pr.hit = []; }
          if (!pr.out && pr.x < pr.startX - 10) { pr.dead = true; if (pr.owner) pr.owner.thrown = false; continue; }
        }
        // glødstub
        if (!pr.lit && pr.vx > 0 && !pr.free) {
          const c = this.colOf(pr.x), pc = this.colOf(px);
          if (c !== pc && this.inGrid(pr.row, c)) {
            const q = this.grid[pr.row][c];
            if (q && q.id === 'glodstub' && q.alive) {
              pr.lit = true;
              if (pr.kind === 'ice') { pr.kind = 'seed'; pr.slow = 0; }
              else { pr.fire = true; pr.dmg *= (q.lv >= 3 ? 2.3 : 2) * (q.pp > 0 ? 1.5 : 1); pr.dmgType = 'fire'; pr.blue = q.pp > 0; if (q.lv >= 5) pr.splash = Math.max(pr.splash || 0, 40); }
            }
          }
        }
        // forhindringer (gravsten/is) blokerer lige skud
        if (!pr.free || true) {
          const r = pr.free ? this.rowOf(pr.y + 58) : pr.row, c = this.colOf(pr.x);
          if (this.inGrid(r, c) && this.obst[r][c] && c !== this.colOf(px) - 0 && Math.abs(this.cellX(c) - pr.x) < 30) {
            this.damageObstacle(this.obst[r][c], pr.dmg);
            if (!this.headless) this.fx.burst(pr.x, pr.y, '#c8c0b0', 4, 80);
            if (pr.pierce !== 99) { pr.dead = true; continue; }
          }
        }
        // boss
        if (this.boss && this.boss.alive && pr.vx > 0 && pr.x >= this.boss.x - 70 && !pr.hitBoss) {
          this.damageBoss(this.boss, pr.dmg, { type: pr.dmgType || (pr.kind === 'thorn' ? 'pierce' : 'normal') });
          if (!this.headless) this.fx.burst(pr.x, pr.y, '#fff', 4, 100);
          pr.hitBoss = true;
          if (!pr.boomerang && pr.pierce !== 99) { pr.dead = true; continue; }
        }
        // zombier
        const row = pr.free ? this.rowOf(pr.y + 52) : pr.row;
        const x0 = Math.min(px, pr.x) - 4, x1 = Math.max(px, pr.x) + 4;
        for (const z of zs) {
          if (!z.alive || z.row !== row || z.under || z.rising > 0 || z.phased) continue;
          if (z.flying && !pr.air) continue;
          if (z.x > this.W - 4) continue;
          const hw = z.def.small ? 16 : z.def.heavy ? 34 : 22;
          if (z.x + hw < x0 || z.x - hw > x1) continue;
          if (pr.hit.includes(z)) continue;
          pr.hit.push(z);
          this.projHit(pr, z);
          if (pr.boomerang) { pr.hits--; if (pr.hits <= 0) { pr.out = false; pr.vx = -Math.abs(pr.vx); } continue; }
          if (pr.pierce === 99) continue;
          pr.pierce = (pr.pierce || 1) - 1;
          if (pr.pierce <= 0) { pr.dead = true; break; }
        }
      }
      if (this.projs.length > 40 && this.projs.some((p) => p.dead)) this.projs = this.projs.filter((p) => !p.dead);
    }
    projHit(pr, z) {
      let dmg = pr.dmg;
      if (z.flying && pr.airMul) dmg *= pr.airMul;
      const opts = { type: pr.dmgType || (pr.kind === 'thorn' || pr.kind === 'spike' || pr.kind === 'needle' ? 'pierce' : 'normal'), bypassShield: pr.bypassShield || pr.vx < 0, armorMul: pr.armorMul, fromBehind: pr.vx < 0 };
      if (z.flying && z.def.ab.fly === 'balloon' && pr.air) { z.flying = false; z.state = 'walk'; if (!this.headless) { this.fx.burst(z.x, z.yy - 170, '#ff8ad5', 12, 160); this.play('hit'); } return; }
      this.damageZombie(z, dmg, opts);
      if (pr.slow && z.alive) this.slowZombie(z, pr.slow);
      if (pr.freezeChance && z.alive && Math.random() < pr.freezeChance) this.freezeZombie(z, 2);
      if (pr.burn && z.alive) this.burnZombie(z, pr.burnDps || 4, pr.burn);
      if (pr.fire && z.alive) { z.slowT = 0; z.freezeT = 0; }
      if (pr.poison && z.alive) this.poisonZombie(z, pr.poison.dps, pr.poison.dur);
      if (pr.poison && pr.spread) for (const o of this.zombies) if (o !== z && o.alive && o.row === z.row && Math.abs(o.x - z.x) < 70) this.poisonZombie(o, pr.poison.dps * 0.6, pr.poison.dur);
      if (pr.splash) for (const o of this.zombies) if (o !== z && o.alive && o.row === z.row && Math.abs(o.x - z.x) < pr.splash && !o.flying) this.damageZombie(o, dmg * 0.35, { type: opts.type, silent: true });
      if (!this.headless) {
        const col = pr.fire ? '#ffb347' : pr.kind === 'ice' ? '#bff4ff' : pr.kind === 'spore' ? '#b07aff' : pr.kind === 'pepper' ? '#ff6a4d' : '#a8e05a';
        this.fx.burst(pr.x, pr.y, col, this.low ? 2 : 5, 120);
        this.play(z.armor > 0 || z.shieldHp > 0 ? 'armor' : 'hit');
      }
    }
    updateLob(pr, dt) {
      pr.t += dt / pr.dur;
      if (pr.target && (pr.target.alive || pr.target.boss)) {
        if (pr.target.boss) pr.tx += (pr.target.x - 60 - pr.tx) * Math.min(1, dt * 4);
        else if (pr.target.x != null && !pr.enemy) pr.tx += (pr.target.x - pr.tx) * Math.min(1, dt * 4);
      }
      const t = Math.min(1, pr.t);
      const h = pr.enemy ? 140 : 170;
      pr.x = U.lerp(pr.x0, pr.tx, t);
      pr.y = U.lerp(pr.y0, pr.ty, t) - Math.sin(t * Math.PI) * h;
      pr.rot = (pr.rot || 0) + dt * 8;
      if (t < 1) return;
      pr.dead = true;
      if (pr.enemy) {
        const p = pr.target;
        if (p && p.alive) {
          if (pr.freeze) { p.frozen = Math.max(p.frozen, pr.freeze); this.damagePlant(p, pr.dmg); if (!this.headless) this.fx.burst(p.x, p.y - 40, '#ffffff', 12, 120); }
          else { this.damagePlant(p, pr.dmg); if (!this.headless) this.fx.debris(p.x, p.y - 40, '#9a9288', 8); }
        }
        if (pr.kind === 'cannon' && !this.headless) { this.fx.explosion(pr.tx, pr.ty, 40, false); this.play('explode'); }
        if (pr.poisonPool) this.areas.push({ type: 'toxic', r: pr.r, c: pr.c, t: 6 });
        return;
      }
      // plante-kasteskud lander
      const tz = pr.target && pr.target.alive && !pr.target.boss ? pr.target : null;
      if (tz) this.damageZombie(tz, pr.dmg, { type: pr.kind === 'pumpkin' ? 'normal' : 'explode', bypassShield: true });
      if (pr.target && pr.target.boss && pr.target.alive) this.damageBoss(pr.target, pr.dmg, { type: pr.kind === 'berry' ? 'explode' : 'normal' });
      const rad = pr.splash || 50;
      for (const z of this.zombies) if (z !== tz && z.alive && !z.under && Math.abs(z.x - pr.tx) < rad && Math.abs(z.yy - 50 - pr.ty) < this.CH * 0.6) this.damageZombie(z, pr.dmg * 0.5, { type: 'explode', silent: true });
      if (pr.slow) for (const z of this.zombies) if (z.alive && Math.abs(z.x - pr.tx) < rad + 20 && Math.abs(z.yy - 50 - pr.ty) < this.CH * 0.6) this.slowZombie(z, 4);
      if (pr.cluster) for (let i = 0; i < 3; i++) { const ox = U.rand(-60, 60); this.later(0.15 + i * 0.1, () => { for (const z of this.zombies) if (z.alive && Math.abs(z.x - (pr.tx + ox)) < 40 && Math.abs(z.yy - 50 - pr.ty) < this.CH * 0.6) this.damageZombie(z, pr.dmg * 0.4, { type: 'explode', silent: true }); if (!this.headless) this.fx.explosion(pr.tx + ox, pr.ty, 26, false); }); }
      if (!this.headless) {
        if (pr.kind === 'berry') { this.fx.explosion(pr.tx, pr.ty, rad * 0.7, false); this.play('explode'); }
        else { this.fx.debris(pr.tx, pr.ty, '#ff9a2a', 12); this.play('splat'); this.shake(2); }
      }
    }
    updateEnemyShot(pr, px) {
      const c = this.colOf(pr.x);
      if (pr.x < this.X0 - 20) { pr.dead = true; return; }
      if (this.inGrid(pr.row, c)) {
        const p = this.grid[pr.row][c] || this.pads[pr.row][c];
        if (p && p.alive && !p.def.ground && Math.abs(p.x - pr.x) < 30) {
          this.damagePlant(p, pr.dmg);
          pr.dead = true;
          if (!this.headless) { this.fx.burst(pr.x, pr.y, '#ffe14a', 6, 100); this.play('hit'); }
        }
      }
    }

    /* ================= Boss ================= */
    makeBoss(id) {
      const d = Z.BOSSES[id];
      const hp = d.hp;
      this.boss = { def: d, boss: true, id, alive: true, hp, maxHp: hp, x: this.X0 + this.CW * 8.6, row: 2, yy: this.Y0 + this.CH * 5 - 10, phase: 0, atkT: 14, summonT: 6, shieldHp: 0, shieldMax: 1, shieldT: 0, stunT: 0, flash: 0, atkAnim: 0, beamCharge: 0, dieT: 0, seed: 1, walk: 0, state: 'walk', armor: 0, armorMax: 1, maxShield: 0 };
      if (!this.headless) GVZ.Progress.seeBoss(id);
    }
    damageBoss(b, dmg, o) {
      if (!b.alive) return;
      o = o || {};
      const type = o.type || 'normal';
      const weak = b.def.weak === type || (b.def.weak === 'explode' && type === 'explode');
      if (weak) dmg *= 2;
      if (b.shieldHp > 0) {
        const sd = weak || type === 'explode' ? dmg : dmg * 0.1;
        b.shieldHp -= sd;
        if (b.shieldHp <= 0 && !this.headless) { this.fx.ring(b.x - 40, b.yy - 150, 220, '#9ae8ff'); this.play('armor'); }
        b.flash = 0.06;
        return;
      }
      b.hp -= dmg;
      b.flash = 0.08;
      if (this.settings.dmgNumbers && !this.headless && dmg >= 25 && Math.random() < 0.5) this.fx.text(b.x - 60 + U.rand(-40, 40), b.yy - 260 + U.rand(-30, 30), Math.round(dmg), weak ? '#ffe14a' : '#fff', weak ? 20 : 15);
      const ph = b.hp < b.maxHp * 0.33 ? 2 : b.hp < b.maxHp * 0.66 ? 1 : 0;
      if (ph > b.phase) {
        b.phase = ph;
        this.showBanner(ph === 2 ? b.def.name + ' er rasende!' : b.def.name + ' skifter taktik!', 2.2, '#ff8a2a');
        if (b.def.shieldPhase) { b.shieldMax = 2000 + this.level.world * 350; b.shieldHp = b.shieldMax; b.shieldT = 15; }
        this.shake(8); this.play('boss');
        b.atkT = Math.min(b.atkT, 2);
      }
      if (b.hp <= 0) {
        b.alive = false; b.dieT = 0;
        this.play('bigExplode');
        for (let i = 0; i < 8; i++) this.later(i * 0.25, () => { this.fx.explosion(b.x - 60 + U.rand(-80, 80), b.yy - U.rand(40, 260), 70, true); this.shake(10); this.play('explode'); });
        for (const z of this.zombies) if (z.alive) this.killZombie(z, { type: 'explode' });
      }
    }
    bossStun(d) { if (this.boss && this.boss.alive) { this.boss.stunT = Math.max(this.boss.stunT, d); this.boss.atkT = Math.max(this.boss.atkT, d); } }
    updateBoss(dt) {
      const b = this.boss;
      if (!b) return;
      if (!b.alive) { b.dieT += dt; return; }
      b.walk += dt;
      if (b.flash > 0) b.flash -= dt;
      if (b.atkAnim > 0) b.atkAnim = Math.max(0, b.atkAnim - dt * 1.5);
      if (b.shieldHp > 0) { b.shieldT -= dt; if (b.shieldT <= 0) b.shieldHp = 0; }
      if (b.stunT > 0) { b.stunT -= dt; return; }
      if (this.state !== 'play') return;
      const mul = [1, 0.8, 0.62][b.phase];
      b.summonT -= dt;
      if (b.summonT <= 0) {
        b.summonT = (12 - b.phase * 2.5) * (this.level.world >= 5 ? 0.9 : 1);
        this.bossSummon(b, 2 + b.phase + Math.floor(this.level.world / 3));
      }
      b.atkT -= dt;
      if (b.atkT <= 0) {
        b.atkT = U.rand(9, 12) * mul;
        const atk = U.pick(b.def.attacks.filter((a) => a !== 'summon'));
        this.bossAttack(b, atk || 'lob');
      }
    }
    /* Bossen tilkalder zombier for et "budget" af zombiepoint, ligesom bølger */
    bossSummon(b, n) {
      const pool = b.def.pool;
      let budget = 1.5 + this.level.world * 0.9 + b.phase * 1.2 + n * 0.3;
      let i = 0, guard = 0;
      const list = [];
      while (budget > 0.5 && guard++ < 20) {
        const cands = pool.filter((id) => Z.BY[id].cost <= budget + 0.5 && (Z.BY[id].cost < 9 || b.phase >= 1));
        const id = cands.length ? U.pick(cands.concat(cands.filter((c) => Z.BY[c].cost <= 2))) : 'shambler';
        list.push(id); budget -= Z.BY[id].cost;
        if (!cands.length) break;
      }
      for (const id of list) this.later((i++) * 0.4, () => this.spawnZombie(id, U.randi(0, this.rows - 1), this.W + 10 + U.rand(0, 40), { leaf: Math.random() < 0.15 }));
      b.atkAnim = 1;
    }
    bossAttack(b, atk) {
      b.atkAnim = 1;
      const W = this.level.world;
      const plantsList = this.plants.filter((p) => p.alive && !p.def.pad);
      const randomPlantCells = (n) => {
        const out = U.pick ? [] : [];
        const pool = plantsList.slice();
        for (let i = 0; i < n; i++) {
          if (pool.length && Math.random() < 0.8) { const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; out.push({ r: p.r, c: p.c }); }
          else out.push({ r: U.randi(0, this.rows - 1), c: U.randi(0, this.cols - 2) });
        }
        return out;
      };
      const lobAt = (cells, dmg, kind, extra) => {
        for (const cell of cells) {
          this.marks.push({ r: cell.r, c: cell.c, t: 1.5, max: 1.5, col: '#ff3a3a' });
          this.later(0.9, () => {
            const tx = this.cellX(cell.c), ty = this.rowY(cell.r) - 30;
            this.projs.push({ kind: kind || 'rock', enemy: true, lob: true, x0: b.x - 80, y0: b.yy - 220, tx, ty, t: 0, dur: 0.6, x: b.x, y: b.yy - 220, target: null, dmg: 0, life: 2, bossCell: cell });
            this.later(0.6, () => {
              const p = this.plantAt(cell.r, cell.c);
              if (p) this.damagePlant(p, dmg);
              if (extra === 'big') for (const q of this.plants) if (q.alive && Math.abs(q.r - cell.r) <= 0 && Math.abs(q.c - cell.c) === 1) this.damagePlant(q, dmg * 0.5);
              if (extra === 'poison') this.areas.push({ type: 'toxic', r: cell.r, c: cell.c, t: 6 });
              if (!this.headless) { this.fx.explosion(tx, ty, 40, false); this.play('explode'); }
            });
          });
        }
        if (!this.headless) this.play('warn');
      };
      const rowAttack = (dmg, col, kind) => {
        const r = (() => { const rowsWith = [...new Set(plantsList.map((p) => p.r))]; return rowsWith.length ? U.pick(rowsWith) : U.randi(0, this.rows - 1); })();
        this.marks.push({ row: r, t: 1.6, max: 1.6, col });
        b.beamCharge = 1;
        if (!this.headless) this.play('warn');
        this.later(1.6, () => {
          b.beamCharge = 0;
          for (const p of this.plants) if (p.alive && p.r === r && !p.def.pad) this.damagePlant(p, dmg);
          if (kind === 'beam') this.beams.push({ x0: this.X0 - 40, x1: b.x - 60, y: this.rowY(r) - 50, t: 0.5, col, w: 26 });
          else if (kind === 'fire') this.fx.fireRow(r, this.X0 - 30, b.x - 60, false);
          else { this.fx.shock(r, b.x - 60); this.shake(8); }
          if (!this.headless) this.play(kind === 'beam' ? 'laser' : kind === 'fire' ? 'fire' : 'explode');
        });
      };
      const base = 170 + W * 28;
      switch (atk) {
        case 'lob': case 'volley': case 'dynamite': case 'missiles': lobAt(randomPlantCells(2 + b.phase + (atk === 'volley' || atk === 'missiles' ? 1 : 0)), base, atk === 'missiles' ? 'missile' : atk === 'dynamite' ? 'dynamite' : 'rock'); break;
        case 'cars': lobAt(randomPlantCells(1 + b.phase), base * 1.6, 'car', 'big'); break;
        case 'poisonLob': lobAt(randomPlantCells(2 + b.phase), base * 0.6, 'goo', 'poison'); break;
        case 'stomp': case 'anchor': rowAttack(base * 0.8, '#ff8a2a', 'shock'); break;
        case 'beam': case 'laser': rowAttack(base * 0.75, '#ff5a5a', 'beam'); break;
        case 'firebreath': rowAttack(base * 0.8, '#7aff5a', 'fire'); break;
        case 'charge': {
          const r = U.randi(0, this.rows - 1);
          this.marks.push({ row: r, t: 1.4, max: 1.4, col: '#ffc23a' });
          if (!this.headless) this.play('warn');
          this.later(1.4, () => { const z = this.spawnZombie('_cart', r, b.x - 60); if (z) { z.hp = z.maxHp = 900 + W * 150; } });
          break;
        }
        case 'freeze': {
          const cells = randomPlantCells(1)[0];
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (this.inGrid(cells.r + dr, cells.c + dc)) this.marks.push({ r: cells.r + dr, c: cells.c + dc, t: 1.4, max: 1.4, col: '#9be8ff' });
          this.later(1.4, () => { for (const p of this.plants) if (p.alive && Math.abs(p.r - cells.r) <= 1 && Math.abs(p.c - cells.c) <= 1) p.frozen = Math.max(p.frozen, 7); this.fx.ring(this.cellX(cells.c), this.rowY(cells.r) - 40, 160, '#bff4ff'); this.play('freeze'); });
          break;
        }
        case 'iceblock': {
          for (let i = 0; i < 2 + b.phase; i++) { const r = U.randi(0, this.rows - 1), c = U.randi(3, this.cols - 2); if (!this.grid[r][c]) this.addObstacle(r, c, 'ice'); }
          this.play('freeze');
          break;
        }
        case 'sandstorm': this.startSandstorm(3 + b.phase); break;
        case 'summonBats': for (let i = 0; i < 2 + b.phase; i++) this.later(i * 0.4, () => this.spawnZombie('vampire', U.randi(0, this.rows - 1), b.x - 40)); break;
        case 'grab': {
          const targets = plantsList.filter((p) => !p.protect).sort(() => Math.random() - 0.5).slice(0, 1 + (b.phase > 1 ? 1 : 0));
          for (const p of targets) {
            this.marks.push({ r: p.r, c: p.c, t: 1.6, max: 1.6, col: '#c07aff' });
            this.later(1.6, () => { if (p.alive) { if (p.shield > 0) p.shield = 0; else this.removePlant(p, false, true); this.fx.burst(p.x, p.y - 30, '#3a8a3a', 12, 140); } });
          }
          if (!this.headless) this.play('warn');
          break;
        }
        default: this.bossSummon(b, 2);
      }
    }

    /* ================= Bølger ================= */
    get totalWaves() { return this.endless ? Infinity : this.waves.length; }
    spawnWave() {
      let wave;
      if (this.endless) wave = WD.endlessWave(this.waveIdx, this.level.world);
      else wave = this.waves[this.waveIdx];
      if (!wave) return;
      this.waveIdx++;
      const isFinal = !this.endless && this.waveIdx === this.waves.length;
      if (wave.flag || isFinal) { this.play('wave'); }
      const rowsAll = this.level.lanes || [...Array(this.rows).keys()];
      const list = wave.list.slice();
      let leafN = this.noPower ? 0 : (wave.flag ? 2 : this.waveIdx > 1 && Math.random() < 0.55 ? 1 : 0);
      const spread = wave.flag ? 5 : 3.5;
      list.forEach((id, i) => {
        const delay = id === 'flag' ? 0 : U.rand(0, spread) + i * 0.15;
        const leaf = leafN > 0 && i > 0 && Math.random() < 0.5 ? (leafN--, true) : false;
        this.pendingSpawns = (this.pendingSpawns || 0) + 1;
        this.later(delay, () => {
          this.pendingSpawns--;
          let row = U.pick(rowsAll);
          // vand: zombier kan godt gå i vand
          this.spawnZombie(id, row, this.W + 20 + U.rand(0, 50), { leaf });
        });
      });
      this.waveStartHp = list.reduce((s, id) => s + (Z.BY[id] ? Z.BY[id].hp + (Z.BY[id].armor || 0) : 0), 0);
      this.waveSpawnT = this.t;
      this.nextWaveT = this.endless ? 26 : this.level.waveGap || 25;
    }
    aliveHp() { let s = 0; for (const z of this.zombies) if (z.alive && !z.noLose) s += z.hp + z.armor; return s; }
    showBanner(text, dur, col, big) { this.banner = { text, t: dur || 2.5, max: dur || 2.5, col: col || '#ff4d5a', big }; }
    updateWaves(dt) {
      if (this.boss) return;
      const more = this.endless || this.waveIdx < this.waves.length;
      if (!more) return;
      this.nextWaveT -= dt;
      // tidlig bølge, når forrige næsten er besejret
      if (this.waveIdx > 0 && this.t - this.waveSpawnT > 7 && this.aliveHp() < this.waveStartHp * 0.3) this.nextWaveT = Math.min(this.nextWaveT, 2.5);
      const nextWave = this.endless ? { flag: (this.waveIdx + 1) % 5 === 0 } : this.waves[this.waveIdx];
      const isFinal = !this.endless && this.waveIdx === this.waves.length - 1;
      if (nextWave && (nextWave.flag || isFinal) && this.nextWaveT <= 3.2 && !this.bannerFor) {
        this.bannerFor = this.waveIdx;
        this.showBanner(isFinal ? 'SIDSTE BØLGE!' : 'En stor bølge af zombier nærmer sig!', 3, '#ff4d5a', true);
        this.play('warn');
      }
      if (this.nextWaveT <= 0) { this.bannerFor = null; this.spawnWave(); }
    }
    waveProgress() {
      if (this.boss) return this.boss.alive ? 1 - this.boss.hp / this.boss.maxHp : 1;
      if (this.endless) return ((this.waveIdx % 5) + 0.5) / 5;
      const n = this.waves.length;
      if (!n) return 1;
      const frac = this.waveIdx === 0 ? 0 : U.clamp(1 - this.aliveHp() / Math.max(1, this.waveStartHp), 0, 1);
      return U.clamp((Math.max(0, this.waveIdx - 1) + frac) / n, 0, 1);
    }

    /* ================= Verdensbegivenheder ================= */
    startSandstorm(n) {
      this.sandstorm = 3.5;
      // kun lette zombier kommer med sandstormen
      const pool = (this.level.zombiesPreview || []).filter((id) => Z.BY[id] && Z.BY[id].cost <= 2 && id !== 'flag' && id !== 'scarab');
      for (let i = 0; i < n; i++) this.later(0.6 + i * 0.3, () => {
        const rows = this.level.lanes || [...Array(this.rows).keys()];
        const sx = this.lineX != null ? this.lineX + this.CW * U.rand(3.5, 5) : this.X0 + this.CW * U.rand(5.8, 8.2);
        this.spawnZombie(U.pick(pool.length ? pool : ['shambler']), U.pick(rows), sx, { rise: true });
      });
      this.showBanner('Sandstorm!', 2, '#ffb45a');
      this.play('whoosh');
    }
    updateEvents(dt) {
      const mech = this.level.mech || [], li = this.level.idx || 0;
      const active = this.state === 'play' && (this.waveIdx > 0 || this.boss);
      if (this.sandstorm > 0) this.sandstorm -= dt;
      if (this.blizzard > 0) this.blizzard -= dt;
      if (this.windT > 0) this.windT -= dt;
      if (!active) return;
      const E = this.evT;
      if (mech.includes('sandstorm') && (li >= 5 || this.level.mode !== 'adventure')) { E.sand -= dt; if (E.sand <= 0) { E.sand = U.rand(48, 60); this.startSandstorm(1 + (li >= 11 ? 1 : 0)); } }
      if (mech.includes('wind') && li >= 4) { E.wind -= dt; if (E.wind <= 0) { E.wind = U.rand(28, 36); this.windT = 3; this.showBanner('Vindstød!', 1.6, '#ffffff'); this.play('whoosh'); } }
      if (mech.includes('blizzard') && li >= 2) {
        E.blizz -= dt;
        if (E.blizz <= 0) {
          E.blizz = U.rand(30, 38); this.blizzard = 3;
          const victims = this.allPlants().filter((p) => !p.def.instant).sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(li / 5));
          for (const p of victims) { const warm = this.plants.some((q) => q.alive && q.id === 'ildblomst' && Math.abs(q.r - p.r) <= (q.lv >= 3 ? 1 : 0) && Math.abs(q.c - p.c) <= 1); if (!warm) p.frozen = 7; }
          this.showBanner('Snestorm!', 1.8, '#bfe4ff'); this.play('freeze');
        }
      }
      if (mech.includes('collapse') && (li >= 2 || this.level.mode !== 'adventure')) {
        E.collapse -= dt;
        if (E.collapse <= 0) {
          E.collapse = U.rand(24, 32);
          const holes = this.tiles.flat().filter((t) => t === 'hole' || t === 'cracked').length;
          if (holes < 4) {
            const opts = [];
            for (let r = 0; r < this.rows; r++) for (let c = 1; c < this.cols - 1; c++) if (this.tiles[r][c] === 'grass' && !this.obst[r][c]) opts.push([r, c]);
            if (opts.length) { const [r, c] = U.pick(opts); this.tiles[r][c] = 'cracked'; this.later(5, () => { this.tiles[r][c] = 'hole'; const p = this.grid[r][c]; if (p) this.removePlant(p, false, true); if (!this.headless) { this.fx.debris(this.cellX(c), this.rowY(r) - 20, '#5a5a60', 16); this.shake(4); this.play('explode'); } }); this.play('warn'); }
          }
        }
      }
      if (mech.includes('vines') && li >= 2) {
        E.vines -= dt;
        if (E.vines <= 0) {
          E.vines = U.rand(26, 34);
          const opts = [];
          for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.tiles[r][c] === 'grass' && !this.grid[r][c] && !this.obst[r][c]) opts.push([r, c]);
          if (opts.length) { const [r, c] = U.pick(opts); this.tiles[r][c] = 'vine'; this.later(40, () => { if (this.tiles[r][c] === 'vine') this.tiles[r][c] = 'grass'; }); }
        }
      }
      if (mech.includes('tombs') && this.world.night && li >= 4) {
        E.grave -= dt;
        if (E.grave <= 0) { E.grave = U.rand(36, 46); const r = U.randi(0, this.rows - 1), c = U.randi(4, this.cols - 1); this.addObstacle(r, c, 'tomb'); if (!this.headless) this.fx.dust(this.cellX(c), this.rowY(r), 10); }
      }
    }
    /* Vælg næste plante til båndet - undgå for mange ens i træk */
    pickBelt() {
      const pool = this.beltPool;
      let id = U.pick(pool);
      if (this.belt.length >= 2 && this.belt.slice(-2).every((b) => b.id === id) && pool.length > 1) id = U.pick(pool.filter((x) => x !== id));
      return id;
    }
    cutVine(r, c) {
      if (this.tiles[r][c] !== 'vine') return false;
      if (this.sun < 25) { this.deny('Det koster 25 sol at klippe lianer'); return false; }
      this.sun -= 25; this.tiles[r][c] = 'grass';
      if (!this.headless) { this.fx.debris(this.cellX(c), this.rowY(r) - 30, '#3a9a2a', 12); this.play('shovel'); }
      return true;
    }
    moveCart(r0, c0, r1, c1) {
      if (c0 !== c1 || this.tiles[r1][c1] !== 'rail' || this.grid[r1][c1]) return false;
      const p = this.grid[r0][c0];
      if (!p) return false;
      this.grid[r0][c0] = null; this.grid[r1][c1] = p; p.r = r1; p.y = this.rowY(r1);
      if (!this.headless) this.play('whoosh');
      return true;
    }

    /* ================= Opsamling (sol, mønter, blade) ================= */
    makeSun(x, y, val, o) {
      o = o || {};
      const sky = !!o.sky;
      const pk = { kind: 'sun', x, y: sky ? -30 : y, val, t: 0, life: sky ? 16 : 11, state: 'fall', vy: sky ? 42 : -U.rand(140, 200), vx: sky ? 0 : U.rand(-50, 50), ty: sky ? U.rand(this.Y0 + 60, this.Y0 + this.CH * 4.6) : y + U.rand(30, 60), big: o.big || val >= 50, small: val < 25, sky };
      this.picks.push(pk);
      if (this.settings.autoSun || this.headless) pk.auto = sky ? 1.8 : 1.0;
      // solspejl fanger nedfaldende sol
      if (sky && this.plants.some((p) => p.alive && p.id === 'solspejl' && Math.abs(p.x - x) < this.CW * 2)) pk.auto = 1.5;
      return pk;
    }
    makeCoin(x, y, kind) {
      const pk = { kind: kind === 'gem' ? 'gem' : 'coin', sub: kind, x, y, val: kind === 'gold' ? 50 : kind === 'gem' ? 1 : 10, t: 0, life: 12, state: 'fall', vy: -U.rand(160, 220), vx: U.rand(-40, 40), ty: y + U.rand(30, 60) };
      this.picks.push(pk);
      if (this.settings.autoSun || this.headless) pk.auto = 1.2;
      if (!this.headless) this.play('coin');
    }
    makePick(kind, x, y) {
      const pk = { kind, x, y, val: 1, t: 0, life: 14, state: 'fall', vy: -180, vx: U.rand(-30, 30), ty: y + 40 };
      this.picks.push(pk);
      if (this.headless) pk.auto = 0.5;
      return pk;
    }
    collectPick(pk) {
      if (pk.state === 'collect') return;
      pk.state = 'collect'; pk.cx = pk.x; pk.cy = pk.y; pk.t = 0;
      if (pk.kind === 'sun') { pk.tx = 74; pk.ty2 = 46; this.play('sun'); }
      else if (pk.kind === 'leaf') { pk.tx = 1170; pk.ty2 = 690; this.play('leaf'); }
      else if (pk.kind === 'reward') { pk.tx = this.W / 2; pk.ty2 = this.H / 2; this.play('star'); }
      else { pk.tx = this.W - 120; pk.ty2 = 24; this.play(pk.kind === 'gem' ? 'gem' : 'coin'); }
    }
    finishPick(pk) {
      if (pk.kind === 'sun') { this.sun += pk.val; this.stats.sun += pk.val; this.checkSunGoal(); }
      else if (pk.kind === 'coin') this.stats.coins += pk.val;
      else if (pk.kind === 'gem') this.stats.gems += 1;
      else if (pk.kind === 'leaf') this.leaves = Math.min(this.maxLeaves, this.leaves + 1);
      else if (pk.kind === 'reward') this.finish(true);
    }
    checkSunGoal() {
      if (this.objective && this.objective.type === 'sunGoal' && this.stats.sun >= this.objective.value && this.state === 'play') this.win();
    }
    updatePicks(dt) {
      for (const pk of this.picks) {
        pk.t += dt;
        if (pk.state === 'fall') {
          if (pk.sky) { pk.y += pk.vy * dt; if (pk.y >= pk.ty) { pk.y = pk.ty; pk.state = 'idle'; pk.t = 0; } }
          else { pk.vy += 600 * dt; pk.x += pk.vx * dt; pk.y += pk.vy * dt; if (pk.vy > 0 && pk.y >= pk.ty) { pk.y = pk.ty; pk.state = 'idle'; pk.t = 0; } }
        } else if (pk.state === 'idle') {
          if (pk.kind !== 'reward' && pk.t > pk.life) pk.dead = true;
          if (pk.kind === 'reward' && pk.t > 2.5) this.collectPick(pk);
        }
        if (pk.auto != null && pk.state !== 'collect') { pk.auto -= dt; if (pk.auto <= 0) this.collectPick(pk); }
        if (pk.state === 'collect') {
          const k = Math.min(1, pk.t / (pk.kind === 'reward' ? 0.8 : 0.55));
          const e = U.easeInOut(k);
          pk.x = U.lerp(pk.cx, pk.tx, e); pk.y = U.lerp(pk.cy, pk.ty2, e);
          if (k >= 1) { pk.dead = true; this.finishPick(pk); }
        }
      }
      if (this.picks.some((p) => p.dead)) this.picks = this.picks.filter((p) => !p.dead);
    }
    /* Klik på et punkt: saml ting op. Returnerer true, hvis noget blev samlet */
    tryCollect(x, y) {
      let best = null, bd = 56;
      for (const pk of this.picks) {
        if (pk.state === 'collect' || pk.dead) continue;
        const d = U.dist(x, y, pk.x, pk.y);
        if (d < bd) { bd = d; best = pk; }
      }
      if (best) { this.collectPick(best); return true; }
      return false;
    }
    collectAll() { for (const pk of this.picks) if (pk.state !== 'collect') this.collectPick(pk); }

    /* ================= Plant Power og evner ================= */
    usePower(r, c) {
      if (this.noPower) { this.deny('Plant Power er slået fra her'); return false; }
      if (this.leaves <= 0) { this.deny('Du har ingen Plant Power-blade'); return false; }
      const p = this.grid[r] && this.grid[r][c];
      if (!p || !p.alive) { this.deny('Vælg en plante'); return false; }
      if (!p.def.power || p.def.instant) { this.deny('Den plante har ingen Plant Power'); return false; }
      this.leaves--;
      this.stats.powers++;
      p.ppMul = p.s.pp || 1;
      p.ppFlash = 1.4;
      p.def.power(p, this);
      if (!this.headless) {
        this.fx.ring(p.x, p.y - 40, 160, '#7aff5a'); this.fx.sparkle(p.x, p.y - 50, '#c8ff7a', 24); this.fx.flash('#c8ff7a', 0.25);
        this.play('power');
      }
      return true;
    }
    useAbility(i) {
      const a = this.abilities[i];
      if (!a || a.cd > 0 || this.state !== 'play') return false;
      a.cd = a.def.cd;
      this.stats.abilities++;
      this.play('ability');
      const zs = this.zombies.filter((z) => z.alive && z.x < this.W - 20);
      switch (a.def.id) {
        case 'meteor': {
          const targets = zs.sort((m, n) => m.x - n.x).slice(0, 12);
          for (let k = 0; k < 3; k++) {
            const tz = targets.length ? targets[Math.min(targets.length - 1, k * 3)] : null;
            const tx = tz ? tz.x : this.X0 + U.rand(300, 800), ty = tz ? tz.yy - 40 : this.rowY(U.randi(0, 4)) - 40;
            this.fx.meteor(tx, ty, 0.7 + k * 0.25);
            this.later(0.7 + k * 0.25, () => this.explode(tx, ty, this.CW * 1.2, 600, { big: true }));
          }
          if (this.boss && this.boss.alive) this.later(1, () => this.damageBoss(this.boss, 1500, { type: 'explode' }));
          break;
        }
        case 'frost': for (const z of this.zombies) if (z.alive) this.freezeZombie(z, 5); this.fx.flash('#bff4ff', 0.5); this.play('freeze'); break;
        case 'sunrain': for (let k = 0; k < 8; k++) { const pk = this.makeSun(this.X0 + U.rand(80, 800), 0, 25, { sky: true }); pk.vy = 260; pk.auto = 1.2; } break;
        case 'rage': this.rageT = 10; this.fx.flash('#ffe14a', 0.3); break;
        case 'gust': for (let r = 0; r < this.rows; r++) this.gust(r, this.X0 - 200, this.CW * 2, {}); this.bossStun(1.5); break;
      }
      return true;
    }

    /* ================= Hovedløkke ================= */
    update(dt) {
      if (this.state === 'done') return;
      this.t += dt;
      if (this.shakeA > 0) this.shakeA = Math.max(0, this.shakeA - dt * 25);
      if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 1.6);
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
      // timere
      if (this.timers.length) {
        const due = [];
        for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) due.push(tm); }
        if (due.length) { this.timers = this.timers.filter((tm) => tm.t > 0); for (const tm of due) { try { tm.fn(); } catch (e) { if (this.opts.onError) this.opts.onError(e); } } }
      }
      if (this.state === 'intro') {
        this.introT -= dt;
        if (this.introT <= 0) this.state = 'play';
        this.updateParts(dt);
        return;
      }
      if (this.state === 'won' || this.state === 'lost') {
        this.endT += dt;
        this.updatePicks(dt);
        this.updateParts(dt);
        for (const z of this.zombies) if (!z.alive) z.dieT = (z.dieT || 0) + dt;
        if (this.boss && !this.boss.alive) this.boss.dieT += dt;
        if (this.state === 'lost' && this.endT > (this.headless ? 0 : 2.6)) this.finish(false);
        if (this.state === 'won' && this.headless) this.finish(true);
        if (this.state === 'won' && this.endT > 6 && !this.result) this.finish(true);
        return;
      }
      // ---------- spil ----------
      // sol fra himlen
      if (!this.level.noSky && !this.conveyor) {
        this.skyT -= dt;
        if (this.skyT <= 0) { this.skyT = (this.level.night ? 26 : 9.5) * U.rand(0.9, 1.15); this.makeSun(this.X0 + U.rand(40, this.CW * this.cols - 40), 0, 25, { sky: true }); if (!this.headless) this.play('sunDrop'); }
      }
      // transportbånd
      if (this.conveyor) {
        this.beltT -= dt;
        if (this.beltT <= 0) {
          this.beltT = this.level.conveyorFast ? U.rand(2.6, 3.6) : this.boss ? U.rand(3.4, 4.4) : U.rand(4.2, 5.6) * (this.level.world >= 4 ? 0.85 : 1);
          if (this.belt.length < 8) this.belt.push({ id: this.pickBelt(), x: 1, uid: Math.random() });
        }
      }
      // kort genoplades
      const haste = 1 + Math.min(2, this.plants.filter((p) => p.alive && p.id === 'urtetid').length) * this.urtetidBonus();
      for (const c of this.cards) if (c.cd > 0) c.cd = Math.max(0, c.cd - dt * haste);
      for (const a of this.abilities) if (a.cd > 0) a.cd = Math.max(0, a.cd - dt);
      if (this.rageT > 0) this.rageT -= dt;
      this.updateWaves(dt);
      this.updateEvents(dt);
      // buffs (hvert 0,25 s)
      this.buffT -= dt;
      if (this.buffT <= 0) { this.buffT = 0.25; this.computeBuffs(); }
      // planter
      for (const p of this.plants) {
        if (!p.alive) continue;
        p.t += dt;
        p.shootT += dt;
        if (p.hitT > 0) p.hitT -= dt;
        if (p.ppFlash > 0) p.ppFlash -= dt;
        if (p.pp > 0) p.pp -= dt;
        if (p.eatenT > 0) p.eatenT -= dt; else if (p.eaters.length) p.eaters.length = 0;
        if (p.poisonT > 0) { p.poisonT -= dt; this.damagePlant(p, p.poisonDps * dt); if (!p.alive) continue; }
        const tile = this.tiles[p.r][p.c];
        if (tile === 'bog' && !p.def.pad) { this.damagePlant(p, (p.maxHp * 0.012 + 2) * dt); if (!p.alive) continue; }
        for (const a of this.areas) if (a.type === 'toxic' && a.r === p.r && a.c === p.c) { this.damagePlant(p, 40 * dt); }
        if (!p.alive) continue;
        if (p.frozen > 0) { p.frozen -= dt; continue; }
        if (p.hexed > 0) { p.hexed -= dt; continue; }
        if (p.def.tick) p.def.tick(p, dt, this);
      }
      if (this.plants.length > 30 && this.plants.some((p) => !p.alive)) this.plants = this.plants.filter((p) => p.alive);
      // zombier
      for (const z of this.zombies) { if (z.alive) this.updateZombie(z, dt); else z.dieT = (z.dieT || 0) + dt; z.auraSlow = 0; }
      if (this.zombies.length > 20 && this.zombies.some((z) => !z.alive && z.dieT > 1.6)) this.zombies = this.zombies.filter((z) => z.alive || z.dieT <= 1.6);
      // boss
      this.updateBoss(dt);
      // projektiler
      this.updateProjs(dt);
      // områder
      for (const a of this.areas) {
        a.t -= dt;
        if (a.type === 'gas') { a.tick -= dt; if (a.tick <= 0) { a.tick = 0.5; for (const z of this.zombies) if (z.alive && !z.under && Math.abs(z.x - a.x) < a.rad && Math.abs(z.yy - 40 - a.y) < a.rad) this.poisonZombie(z, a.dps, 1); if (!this.headless) this.fx.gas(a.x, a.y, a.rad, '#9cff6b'); } }
      }
      if (this.areas.some((a) => a.t <= 0)) this.areas = this.areas.filter((a) => a.t > 0);
      for (const m of this.marks) m.t -= dt;
      if (this.marks.some((m) => m.t <= 0)) this.marks = this.marks.filter((m) => m.t > 0);
      for (const b of this.beams) b.t -= dt;
      if (this.beams.some((b) => b.t <= 0)) this.beams = this.beams.filter((b) => b.t > 0);
      // kværnere
      for (let r = 0; r < this.rows; r++) {
        const sh = this.shred[r];
        if (sh.state !== 'run') continue;
        sh.x += 520 * dt;
        for (const z of this.zombies) if (z.alive && z.row === r && Math.abs(z.x - sh.x) < 40) { this.killZombie(z, {}); z.shredded = true; if (!this.headless) this.fx.debris(z.x, z.yy - 50, '#7a9a6a', 10); }
        if (sh.x > this.W + 60) sh.state = 'used';
      }
      this.updatePicks(dt);
      this.updateParts(dt);
      this.checkEnd();
    }
    urtetidBonus() { let best = 0.25; for (const p of this.plants) if (p.alive && p.id === 'urtetid') best = Math.max(best, p.lv >= 5 ? 0.35 : p.lv >= 3 ? 0.3 : 0.25); return best; }
    computeBuffs() {
      for (const p of this.plants) { if (!p.alive) continue; p.haste = 1; p.prodMul = 1; p.dmgMul = 1; }
      for (const p of this.plants) {
        if (!p.alive) continue;
        if (this.tiles[p.r][p.c] === 'power') { p.haste *= 1.5; p.dmgMul *= 1.5; }
        if (this.rageT > 0) { p.haste *= 2; p.dmgMul *= 1.5; }
        if (p.id === 'rytmerod' && !(p.frozen > 0) && !(p.hexed > 0)) {
          const h = p.pp > 0 ? 2 : 1 + (p.lv >= 5 ? 0.55 : p.lv >= 3 ? 0.45 : 0.35);
          for (const q of this.neighbors(p, 1)) q.haste *= h;
        }
        if (p.id === 'solspejl') {
          const m = p.pp > 0 ? 2 : 1 + (p.lv >= 5 ? 0.8 : p.lv >= 3 ? 0.65 : 0.5);
          for (const q of this.neighbors(p, 1)) if (q.def.cat === 'resource') q.prodMul = Math.max(q.prodMul, m);
        }
      }
    }
    checkEnd() {
      if (this.state !== 'play') return;
      if (this.objective && this.objective.type === 'timeLimit' && this.t > this.objective.value + (this.level.firstWave || 0) * 0) {
        if (!this.won) this.lose('Tiden løb ud!');
        return;
      }
      if (this.lineX != null) for (const z of this.zombies) { if (z.alive && !z.flying && !z.under && z.dir < 0 && (z.state === 'walk' || z.state === 'eat') && z.prevX >= this.lineX && z.x < this.lineX && !z.noLose) { this.lose('En zombie trampede blomsterne ned!'); return; } z.prevX = z.x; }
      if (this.boss) { if (!this.boss.alive) this.win(); return; }
      if (this.endless) return;
      if (this.objective && this.objective.type === 'sunGoal') {
        // bliv ved med at sende små bølger, indtil målet er nået
        if (this.waveIdx >= this.waves.length && !this.zombies.some((z) => z.alive)) { this.waves.push({ list: WD.endlessWave(Math.min(12, 3 + this.level.world * 2), this.level.world).list.slice(0, 6), flag: false }); this.nextWaveT = 6; }
        return;
      }
      if (this.waveIdx >= this.waves.length && !this.pendingSpawns && !this.zombies.some((z) => z.alive && !z.noLose)) this.win();
    }
    win() {
      if (this.state !== 'play') return;
      this.won = true; this.state = 'won'; this.endT = 0;
      if (!this.headless) {
        AU.play('win');
        let lx = this.W / 2, ly = this.H / 2;
        const lastZ = this.zombies.filter((z) => !z.alive && !z.gone).pop();
        if (lastZ) { lx = U.clamp(lastZ.x, this.X0 + 100, this.W - 120); ly = lastZ.yy - 40; }
        this.makePick('reward', lx, ly);
        this.collectAll();
      }
      for (const z of this.zombies) if (z.alive) this.killZombie(z, {});
    }
    lose(reason) {
      if (this.state !== 'play') return;
      this.lost = true; this.state = 'lost'; this.endT = 0; this.loseReason = reason || 'Zombierne vandt!';
      this.play('lose');
    }
    finish(won) {
      if (this.result) return;
      this.state = 'done';
      const st = this.stats;
      const s3 = this.level.star3;
      let s3ok = false;
      if (won && s3) {
        if (s3.type === 'noLoss') s3ok = st.lost === 0;
        else if (s3.type === 'spend') s3ok = st.spent <= s3.value;
        else if (s3.type === 'noPower') s3ok = st.powers === 0 && st.abilities === 0;
        else if (s3.type === 'maxLost') s3ok = st.lost <= s3.value;
        else if (s3.type === 'time') s3ok = this.t <= s3.value;
      }
      this.result = {
        won, stars: [won, won && st.shredUsed === 0, s3ok], kills: st.kills, sun: st.sun, spent: st.spent, lostPlants: st.lost,
        coinsPicked: st.coins, gemsPicked: st.gems, powers: st.powers, waves: this.endless ? Math.max(0, this.waveIdx - 1) : this.waveIdx,
        score: st.kills * 10 + this.waveIdx * 100 + (won ? 500 : 0), time: this.t, reason: this.loseReason,
      };
      if (this.endless) { this.result.won = false; this.result.waves = Math.max(0, this.waveIdx - (this.zombies.some((z) => z.alive) ? 1 : 0)); }
      if (this.opts.onEnd) this.opts.onEnd(this.result);
    }
    deny(msg) {
      this.denyMsg = { text: msg, t: 1.6 };
      if (!this.headless) AU.play('deny');
    }

    /* ================= Input ================= */
    cellAt(x, y) {
      const c = this.colOf(x), r = this.rowOf(y);
      return this.inGrid(r, c) ? { r, c } : null;
    }
    /* Kaldes af UI ved klik/tryk på banen */
    tap(x, y) {
      if (this.state === 'won') { this.tryCollect(x, y); return; }
      if (this.state !== 'play' && this.state !== 'intro') return;
      if (this.tryCollect(x, y)) return;
      const cell = this.cellAt(x, y);
      const sel = this.selected;
      if (sel == null) {
        if (!cell) return;
        // minevogn
        if (this.tiles[cell.r][cell.c] === 'rail') {
          if (this.cartSel && this.grid[this.cartSel.r][this.cartSel.c]) { if (this.moveCart(this.cartSel.r, this.cartSel.c, cell.r, cell.c)) { this.cartSel = null; return; } }
          if (this.grid[cell.r][cell.c]) { this.cartSel = cell; return; }
        }
        this.cartSel = null;
        if (this.tiles[cell.r][cell.c] === 'vine') this.cutVine(cell.r, cell.c);
        return;
      }
      if (!cell) { this.selected = null; return; }
      if (sel === 'shovel') { this.shovel(cell.r, cell.c); this.selected = null; return; }
      if (sel === 'power') { if (this.usePower(cell.r, cell.c)) this.selected = null; return; }
      if (typeof sel === 'string' && sel.startsWith('belt:')) { const i = this.belt.findIndex((b) => b.uid === +sel.slice(5)); if (i >= 0 && this.placeFromBelt(i, cell.r, cell.c)) this.selected = null; return; }
      if (typeof sel === 'number') { if (this.placePlant(sel, cell.r, cell.c)) this.selected = null; }
    }

    /* ================= Effekter ================= */
    makeFx() {
      const G = this;
      const add = (p) => { if (G.headless) return; if (G.parts.length > (G.low ? 160 : 600)) G.parts.shift(); G.parts.push(p); };
      return {
        burst(x, y, col, n, spd) { for (let i = 0; i < (n || 6); i++) { const a = Math.random() * Math.PI * 2, s = (spd || 100) * U.rand(0.4, 1); add({ type: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: U.rand(0.3, 0.6), max: 0.6, size: U.rand(2, 4.5), col, grav: 300 }); } },
        sparkle(x, y, col, n) { for (let i = 0; i < (n || 4); i++) add({ type: 'star', x: x + U.rand(-20, 20), y: y + U.rand(-20, 20), vx: U.rand(-20, 20), vy: U.rand(-60, -20), life: U.rand(0.5, 0.9), max: 0.9, size: U.rand(3, 6), col, grav: 0 }); },
        dust(x, y, n) { for (let i = 0; i < (n || 6); i++) add({ type: 'smoke', x: x + U.rand(-30, 30), y: y - U.rand(0, 10), vx: U.rand(-40, 40), vy: U.rand(-40, -10), life: U.rand(0.4, 0.8), max: 0.8, size: U.rand(8, 16), col: '#c8b090', grav: 0 }); },
        smoke(x, y, n, col) { for (let i = 0; i < (n || 6); i++) add({ type: 'smoke', x: x + U.rand(-20, 20), y: y + U.rand(-20, 20), vx: U.rand(-30, 30), vy: U.rand(-60, -20), life: U.rand(0.8, 1.4), max: 1.4, size: U.rand(14, 26), col: col || '#5a5a5a', grav: 0 }); },
        debris(x, y, col, n) { for (let i = 0; i < (n || 8); i++) { const a = -Math.PI / 2 + U.rand(-1.2, 1.2), s = U.rand(120, 280); add({ type: 'chunk', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.6, 1), max: 1, size: U.rand(3, 7), col, grav: 700, rot: Math.random() * 6, vr: U.rand(-10, 10) }); } },
        ring(x, y, r, col) { add({ type: 'ring', x, y, r0: 10, r1: r, life: 0.5, max: 0.5, col }); },
        text(x, y, str, col, size) { if (!G.headless) G.texts.push({ x, y, str: String(str), col: col || '#fff', size: size || 18, t: 0, life: 0.9 }); },
        flash(col, a) { G.flashCol = col; G.flashA = Math.max(G.flashA, a); },
        gas(x, y, rad, col) { if (G.low) return; for (let i = 0; i < 3; i++) add({ type: 'smoke', x: x + U.rand(-rad, rad) * 0.8, y: y + U.rand(-rad, rad) * 0.5, vx: U.rand(-15, 15), vy: U.rand(-20, 0), life: 1.2, max: 1.2, size: U.rand(18, 30), col, grav: 0, alpha: 0.35 }); },
        spikes(row) { for (let c = 0; c < G.cols; c++) add({ type: 'spike', x: G.cellX(c), y: G.rowY(row), life: 0.4, max: 0.4 }); },
        wind(row, x) { for (let i = 0; i < 10; i++) add({ type: 'streak', x: x + U.rand(0, 600), y: G.rowY(row) - U.rand(20, 90), vx: 700, vy: 0, life: 0.5, max: 0.5, size: U.rand(30, 70), col: '#ffffff' }); },
        head(z) { add({ type: 'head', x: z.x - 6, y: z.yy - 100 * ((z.def.look && z.def.look.scale) || 1), vx: U.rand(30, 90), vy: -U.rand(160, 240), life: 1.4, max: 1.4, rot: 0, vr: U.rand(4, 9), grav: 700, z }); },
        fireRow(row, x0, x1, thin) { for (let x = Math.max(G.X0 - 20, x0); x < x1; x += thin ? 60 : 30) add({ type: 'flame', x: x + U.rand(-10, 10), y: G.rowY(row) - 4, vx: 0, vy: -U.rand(20, 60), life: U.rand(0.5, 0.9), max: 0.9, size: thin ? 14 : U.rand(22, 36), grav: 0 }); },
        shock(row, x1) { for (let x = G.X0 - 20; x < x1; x += 40) add({ type: 'smoke', x, y: G.rowY(row) - 10, vx: 0, vy: -30, life: 0.7, max: 0.7, size: 26, col: '#a08060', grav: 0 }); },
        explosion(x, y, r, big) {
          add({ type: 'boom', x, y, r: r * (big ? 1.2 : 1), life: big ? 0.7 : 0.5, max: big ? 0.7 : 0.5 });
          add({ type: 'ring', x, y, r0: r * 0.3, r1: r * 1.8, life: 0.45, max: 0.45, col: '#fff2c0' });
          const n = G.low ? 6 : big ? 26 : 12;
          for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = U.rand(80, big ? 380 : 260); add({ type: 'ember', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: U.rand(0.4, 0.9), max: 0.9, size: U.rand(2, 5), col: U.pick(['#ffe14a', '#ff8a2a', '#ff4b1f']), grav: 400 }); }
          for (let i = 0; i < (G.low ? 3 : big ? 10 : 5); i++) add({ type: 'smoke', x: x + U.rand(-r, r) * 0.5, y: y + U.rand(-r, r) * 0.4, vx: U.rand(-30, 30), vy: U.rand(-80, -30), life: U.rand(0.9, 1.6), max: 1.6, size: U.rand(r * 0.4, r * 0.8), col: '#3a3030', grav: 0, delay: 0.15 });
        },
        meteor(x, y, delay) { add({ type: 'meteor', x, y, life: delay, max: delay }); },
      };
    }
    updateParts(dt) {
      for (const p of this.parts) {
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.life -= dt;
        if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.grav || 0) * dt; }
        if (p.vr) p.rot += p.vr * dt;
        if (p.type === 'smoke') { p.vx *= 0.96; p.vy *= 0.96; }
      }
      if (this.parts.some((p) => p.life <= 0)) this.parts = this.parts.filter((p) => p.life > 0);
      for (const t of this.texts) t.t += dt;
      if (this.texts.length && this.texts[0].t > this.texts[0].life) this.texts = this.texts.filter((t) => t.t <= t.life);
      if (this.denyMsg) { this.denyMsg.t -= dt; if (this.denyMsg.t <= 0) this.denyMsg = null; }
    }

    /* ================= Tegning ================= */
    render(ctx, view) {
      const t = this.t;
      const W = this.W, H = this.H;
      ctx.save();
      if (this.shakeA > 0) ctx.translate(U.rand(-this.shakeA, this.shakeA), U.rand(-this.shakeA, this.shakeA));
      const bgScale = view && view.bgScale || 1;
      if (!this.bg || this.bgTilesKey !== this.level.id) { this.bg = WD.background(this.world, this.level.tiles, bgScale); this.bgTilesKey = this.level.id; }
      ctx.drawImage(this.bg, 0, 0, W, H);
      WD.overlay(ctx, this, t, this.low, 'tiles');
      // blomsterlinje
      if (this.lineX != null) {
        for (let r = 0; r < this.rows; r++) for (let i = 0; i < 3; i++) { const y = this.Y0 + r * this.CH + 20 + i * 34; A.circ(ctx, this.lineX, y, 6, ['#ff7ab8', '#ffe14a', '#ffffff'][i], 1.5); A.circ(ctx, this.lineX, y, 2.4, '#ffb000', 0); }
        ctx.strokeStyle = 'rgba(255,122,184,.5)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(this.lineX, this.Y0); ctx.lineTo(this.lineX, this.Y0 + this.rows * this.CH); ctx.stroke(); ctx.setLineDash([]);
      }
      // markeringer (boss-angreb)
      for (const m of this.marks) {
        const a = 0.25 + Math.sin(t * 16) * 0.15;
        ctx.fillStyle = U.rgba(m.col, a);
        if (m.row != null) ctx.fillRect(this.X0, this.Y0 + m.row * this.CH, this.cols * this.CW, this.CH);
        else { ctx.fillRect(this.X0 + m.c * this.CW + 4, this.Y0 + m.r * this.CH + 4, this.CW - 8, this.CH - 8); ctx.strokeStyle = m.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.cellX(m.c), this.rowY(m.r) - 30, 40 * (m.t / m.max), 0, Math.PI * 2); ctx.stroke(); }
      }
      // områder
      for (const a of this.areas) {
        if (a.type === 'fire') { for (let i = 0; i < 3; i++) this.drawFlame(ctx, this.cellX(a.c) + (i - 1) * 26, this.rowY(a.r) + 2, 16 + Math.sin(t * 10 + i) * 4); }
        if (a.type === 'toxic') { ctx.fillStyle = 'rgba(140,255,90,.35)'; ctx.beginPath(); ctx.ellipse(this.cellX(a.c), this.rowY(a.r) - 6, 44, 14, 0, 0, Math.PI * 2); ctx.fill(); }
      }
      // kværnere
      for (let r = 0; r < this.rows; r++) { const sh = this.shred[r]; if (sh.state === 'ready' || sh.state === 'run') this.drawShredder(ctx, sh.x, this.rowY(r), t, sh.state === 'run'); }
      // rækkevis: forhindringer, planter, zombier
      const zsByRow = [];
      for (let r = 0; r < this.rows; r++) zsByRow.push([]);
      const flyers = [];
      for (const z of this.zombies) {
        if (z.gone && !z.alive && !z.sink && !z.blown) continue;
        if (!z.alive && z.dieT > 1.6) continue;
        if (z.flying || z.blown) flyers.push(z); else if (zsByRow[z.row]) zsByRow[z.row].push(z);
      }
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) { const o = this.obst[r][c]; if (o) this.drawObstacle(ctx, o, t); }
        for (let c = 0; c < this.cols; c++) { const p = this.pads[r][c]; if (p) this.drawPlant(ctx, p, t); }
        for (let c = 0; c < this.cols; c++) { const p = this.grid[r][c]; if (p) this.drawPlant(ctx, p, t); }
        if (this.boss && r === 2) this.drawBoss(ctx, t);
        zsByRow[r].sort((a, b) => b.x - a.x);
        for (const z of zsByRow[r]) this.drawZombie(ctx, z, t);
      }
      for (const z of flyers) this.drawZombie(ctx, z, t);
      // minevogn-valg
      if (this.cartSel) { ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 4; ctx.strokeRect(this.X0 + this.cartSel.c * this.CW + 3, this.Y0 + this.cartSel.r * this.CH + 3, this.CW - 6, this.CH - 6); }
      this.drawProjs(ctx, t);
      this.drawBeams(ctx, t);
      this.drawParts(ctx, t);
      WD.overlay(ctx, this, t, this.low, 'weather');
      this.drawPicks(ctx, t);
      this.drawPreview(ctx, t);
      // tekster
      ctx.textAlign = 'center';
      for (const tx of this.texts) {
        const k = tx.t / tx.life;
        ctx.globalAlpha = 1 - k * k;
        ctx.font = '900 ' + tx.size + 'px Lilita One, Arial Black, sans-serif';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.strokeText(tx.str, tx.x, tx.y - k * 30); ctx.fillStyle = tx.col; ctx.fillText(tx.str, tx.x, tx.y - k * 30);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (this.flashA > 0) { ctx.fillStyle = U.rgba(this.flashCol, this.flashA * 0.6); ctx.fillRect(0, 0, W, H); }
      this.drawBanner(ctx, t);
    }
    drawPlant(ctx, p, t) {
      if (!p.alive) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (!p.def.pad && !p.def.ground) A.shadow(ctx, 0, 0, 30, 8, 0.22);
      if (p.ppFlash > 0 || p.pp > 0) { A.glow(ctx, 0, -40, 70, '#9cff6b', 0.35 + Math.sin(t * 10) * 0.12); if (!this.low) A.rays(ctx, 0, -40, 30, 80, 10, t * 1.5, '#d8ff9a', 0.25); }
      if (this.tiles[p.r][p.c] === 'power' && !p.def.pad) A.glow(ctx, 0, -30, 50, '#5ae0ff', 0.25);
      if (p.hitT > 0) A.setTint('#ffffff', 0.5);
      else if (p.frozen > 0) A.setTint('#9fdcff', 0.55);
      else if (p.hexed > 0) A.setTint('#9a5ad6', 0.55);
      else if (p.poisonT > 0) A.setTint('#7aff5a', 0.3);
      // "ædt"-ryst
      if (p.eatenT > 0) ctx.translate(Math.sin(t * 40) * 1.5, 0);
      try { p.def.draw(ctx, p, t); } catch (e) { /* tegnefejl må ikke stoppe spillet */ }
      A.clearTint();
      // niveau-pynt
      if (p.lv >= 3 && p.def.crest) {
        const [cx, cy] = p.def.crest;
        A.star(ctx, cx, cy, p.lv >= 5 ? 8 : 6, p.lv >= 5 ? 3.5 : 2.6, 5, t * 0.8, p.lv >= 5 ? '#ffd23f' : '#c8ff7a', 1.5);
        if (p.lv >= 6 && !this.low) A.glow(ctx, cx, cy, 18, '#ffe14a', 0.4 + Math.sin(t * 4) * 0.2);
      }
      if (p.shield > 0) {
        const a = 0.25 + 0.2 * Math.min(1, p.shield / (p.shieldMax || 300));
        ctx.beginPath(); ctx.ellipse(0, -40, 42, 48, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(122,224,255,' + a * 0.5 + ')'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(160,240,255,' + (a + 0.3) + ')'; ctx.stroke();
      }
      if (p.frozen > 0) { ctx.fillStyle = 'rgba(190,240,255,.45)'; U.roundRect(ctx, -32, -84, 64, 82, 10); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.stroke(); }
      if (p.hexed > 0) { for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; A.star(ctx, Math.cos(a) * 26, -50 + Math.sin(a) * 12, 5, 2, 4, 0, '#d8a8ff', 0); } }
      if (p.protect) { ctx.fillStyle = '#ff4d7a'; ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', 26, -70 + Math.sin(t * 4) * 3); }
      // livsbjælke, når skadet
      if (p.hp < p.maxHp * 0.98 && !p.def.instant && p.def !== BUBBLE) {
        const f = U.clamp(p.hp / p.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-24, 4, 48, 6);
        ctx.fillStyle = f > 0.5 ? '#6be36b' : f > 0.25 ? '#ffd23f' : '#ff4d5a'; ctx.fillRect(-23, 5, 46 * f, 4);
      }
      ctx.restore();
    }
    drawZombie(ctx, z, t) {
      const dieK = z.alive ? 0 : Math.min(1, (z.dieT || 0) / 1.2);
      if (!z.alive && (z.gone && !z.sink && !z.blown)) return;
      ctx.save();
      const lift = z.lift || 0;
      ctx.translate(z.x + (z.blown ? (z.dieT || 0) * 600 : 0), z.yy - (z.blown ? (z.dieT || 0) * 200 : 0));
      if (!z.flying && !z.blown && !z.under) A.shadow(ctx, 0, 0, z.def.heavy ? 44 : 26, 7, 0.25 * (1 - dieK));
      if (z.under) {
        // jordbunke, der bevæger sig
        ctx.fillStyle = '#6b4a2c'; ctx.beginPath(); ctx.ellipse(0, -4, 26, 10 + Math.sin(t * 12) * 2, 0, Math.PI, 0); ctx.fill();
        A.speckle(ctx, -22, -14, 44, 10, 6, '#8a6239', (z.seed * 10) | 0, 3);
        ctx.restore();
        return;
      }
      if (z.rising > 0) { ctx.beginPath(); ctx.rect(-90, -330, 180, 332); ctx.clip(); ctx.translate(0, z.rising * 120); }
      if (z.sink) { ctx.beginPath(); ctx.rect(-90, -330, 180, 332); ctx.clip(); ctx.translate(0, Math.min(1, z.dieT || 0) * 140); }
      ctx.translate(0, -lift);
      if (z.leaf && z.alive) A.glow(ctx, 0, -60, 70, '#7aff5a', 0.3 + Math.sin(t * 5) * 0.12);
      if (!z.alive && !z.sink && !z.blown && !z.shredded) {
        // dødsanimation: vælter bagover
        ctx.rotate(dieK * 1.3 * (z.dir < 0 ? 1 : -1));
        ctx.globalAlpha = 1 - Math.max(0, dieK - 0.5) * 2;
      }
      if (z.shredded) ctx.globalAlpha = Math.max(0, 1 - (z.dieT || 0) * 4);
      if (z.phased) ctx.globalAlpha *= 0.35 + Math.sin(t * 30) * 0.1;
      if (z.def.id === 'hologram' && !z.phased) ctx.globalAlpha *= 0.85;
      if (z.dir > 0) ctx.scale(-1, 1);
      // tonen
      if (!z.alive && z.burnt) A.setTint('#1a1410', 0.85);
      else if (z.flash > 0) A.setTint('#ffffff', 0.38);
      else if (z.freezeT > 0) A.setTint('#8fd8ff', 0.6);
      else if (z.slowT > 0) A.setTint('#6ab8ff', 0.35);
      else if (z.poison) A.setTint('#7aff5a', 0.35);
      else if (z.burn) A.setTint('#ff8a3a', 0.3);
      if (z.state === 'jump' || z.state === 'blast') ctx.rotate(-0.25);
      try {
        if (z.isCart) this.drawCart(ctx, z, t);
        else Z.draw(ctx, z, t);
        if (z.potHat && z.armor > 0) { ctx.save(); ctx.translate(-4, -96); ctx.rotate(0.15); A.poly(ctx, [-16, 0, 16, 0, 12, -22, -12, -22], '#d0703a', 3); ctx.restore(); }
      } catch (e) { /* ignorer */ }
      A.clearTint();
      if (z.alive) {
        if (z.freezeT > 0) { ctx.fillStyle = 'rgba(190,240,255,.4)'; U.roundRect(ctx, -34, -140, 70, 140, 10); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke(); }
        if (z.wardHp > 0) { ctx.beginPath(); ctx.ellipse(0, -66, 40, 70, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(154,224,255,' + (0.5 + Math.sin(t * 6) * 0.2) + ')'; ctx.lineWidth = 3; ctx.stroke(); }
        if (z.burn && !this.low) this.drawFlame(ctx, 0, -40, 14 + Math.sin(t * 12) * 3);
        if (z.poison && !this.low && Math.random() < 0.08) this.fx.burst(z.x, z.yy - 90, '#7aff5a', 1, 30);
        if (z.stunT > 0) { for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; A.star(ctx, Math.cos(a) * 18, -130 + Math.sin(a) * 6, 5, 2, 5, 0, '#ffe14a', 0); } }
        if (z.state === 'swing' && z.def.ab.swingIn) { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -110); ctx.lineTo(60, -400); ctx.stroke(); }
      }
      ctx.restore();
      // faldende hoved/arm håndteres som partikel
    }
    drawCart(ctx, z, t) {
      const bossId = this.boss && this.boss.def.id;
      if (bossId === 'bulldozer') {
        A.rrect(ctx, -50, -60, 100, 54, 8, '#ffc23a', 3);
        A.poly(ctx, [-50, -70, -70, -66, -74, 0, -50, -4], '#e0a21c', 3);
        A.rrect(ctx, -50, -14, 100, 18, 9, '#2a2a30', 3);
      } else {
        A.poly(ctx, [-44, -60, 44, -60, 36, -10, -36, -10], '#7a5a3a', 3);
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-40, -46, 80, 4); ctx.fillRect(-38, -30, 76, 4);
        A.ball(ctx, -14, -66, 12, '#ffd86a', '#c48a1c'); A.ball(ctx, 10, -64, 10, '#b0a89a', '#6a6258');
        for (const x of [-26, 26]) { A.circ(ctx, x, -8, 9, '#3a3a44', 3); ctx.save(); ctx.translate(x, -8); ctx.rotate(-t * 10); ctx.fillStyle = '#9a9aa8'; ctx.fillRect(-1.5, -7, 3, 14); ctx.restore(); }
      }
    }
    drawBoss(ctx, t) {
      const b = this.boss;
      if (!b) return;
      ctx.save();
      ctx.translate(b.x, b.yy);
      if (!b.alive) { const k = Math.min(1, b.dieT / 2.4); ctx.globalAlpha = 1 - k; ctx.translate(U.rand(-6, 6) * (1 - k), k * 80); }
      A.shadow(ctx, 0, 0, 130, 18, 0.3);
      if (b.flash > 0) A.setTint('#ffffff', 0.55);
      else if (b.stunT > 0) A.setTint('#9fdcff', 0.4);
      try { Z.drawBoss(ctx, b, t); } catch (e) { /* ignorer */ }
      A.clearTint();
      if (b.shieldHp > 0) {
        ctx.beginPath(); ctx.ellipse(-10, -150, 150, 180, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120,230,255,' + (0.12 + Math.sin(t * 5) * 0.05) + ')'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(160,240,255,.8)'; ctx.stroke();
      }
      if (b.stunT > 0) for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.6; A.star(ctx, Math.cos(a) * 60 - 20, -300 + Math.sin(a) * 14, 9, 4, 5, 0, '#ffe14a', 1.5); }
      ctx.restore();
    }
    drawObstacle(ctx, o, t) {
      const x = this.cellX(o.c), y = this.rowY(o.r);
      ctx.save(); ctx.translate(x, y);
      A.shadow(ctx, 0, 0, 30, 7, 0.25);
      const f = o.hp / o.maxHp;
      if (o.type === 'ice') {
        A.rrect(ctx, -34, -70, 68, 70, 8, 'rgba(190,235,255,.85)', 3);
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -60); ctx.lineTo(-6, -40); ctx.moveTo(10, -66); ctx.lineTo(24, -40); ctx.stroke();
      } else {
        const night = this.world.night, sand = this.world.ground === 'sand';
        const col = o.extra === 'treasure' ? '#e8c060' : sand ? '#c8a878' : night ? '#6a6a7a' : '#8a8a96';
        ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-26, -50); ctx.quadraticCurveTo(-26, -76, 0, -76); ctx.quadraticCurveTo(26, -76, 26, -50); ctx.lineTo(26, 0); ctx.closePath();
        ctx.fillStyle = A.vg(ctx, -76, 0, U.shade(col, 0.15), U.shade(col, -0.25)); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = A.INK; ctx.stroke();
        if (sand) { ctx.fillStyle = '#2a5ad6'; ctx.fillRect(-14, -54, 28, 6); A.eye(ctx, 0, -38, 6, 0, 0, 0, { white: '#f4e8c0' }); }
        else { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-3, -64, 6, 30); ctx.fillRect(-12, -54, 24, 6); }
        if (o.extra === 'treasure') A.glow(ctx, 0, -40, 50, '#ffe14a', 0.35);
        if (f < 0.6) { ctx.strokeStyle = A.INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -60); ctx.lineTo(-8, -40); ctx.lineTo(-16, -20); ctx.stroke(); }
        ctx.fillStyle = 'rgba(80,140,60,.6)'; ctx.beginPath(); ctx.ellipse(0, -2, 30, 5, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    drawShredder(ctx, x, y, t, running) {
      ctx.save(); ctx.translate(x, y);
      if (running) ctx.translate(0, Math.sin(t * 50) * 1.5);
      A.shadow(ctx, 0, 2, 30, 6, 0.3);
      A.rrect(ctx, -26, -36, 48, 30, 8, '#e8423a', 3);
      A.rrect(ctx, -30, -12, 56, 10, 4, '#3a3a44', 2.5);
      ctx.save(); ctx.translate(26, -20); ctx.rotate(running ? t * 30 : t * 2);
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); A.poly(ctx, [0, -3, 16, -1, 16, 1, 0, 3], '#d8dde8', 1.5); }
      ctx.restore();
      A.circ(ctx, -14, -4, 8, '#2a2a30', 2.5); A.circ(ctx, 12, -4, 8, '#2a2a30', 2.5);
      A.rrect(ctx, -34, -54, 6, 24, 3, '#5a5a68', 2);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-20, -30, 30, 5);
      if (running && !this.low) { this.fx.debris(x + 30, y - 20, '#6fc24a', 1); }
      ctx.restore();
    }
    drawFlame(ctx, x, y, s) {
      ctx.beginPath(); ctx.moveTo(x - s * 0.6, y); ctx.quadraticCurveTo(x - s * 0.7, y - s, x, y - s * 1.6); ctx.quadraticCurveTo(x + s * 0.7, y - s, x + s * 0.6, y); ctx.closePath();
      const g = ctx.createLinearGradient(0, y - s * 1.6, 0, y); g.addColorStop(0, 'rgba(255,240,120,.9)'); g.addColorStop(1, 'rgba(255,80,20,.8)');
      ctx.fillStyle = g; ctx.fill();
    }
    drawProjs(ctx, t) {
      for (const pr of this.projs) {
        if (pr.dead) continue;
        // spor
        if (pr.trail && pr.trail.length > 3 && !this.low) {
          ctx.beginPath(); ctx.moveTo(pr.trail[0], pr.trail[1]);
          for (let i = 2; i < pr.trail.length; i += 2) ctx.lineTo(pr.trail[i], pr.trail[i + 1]);
          ctx.lineTo(pr.x, pr.y);
          ctx.strokeStyle = pr.fire ? (pr.blue ? 'rgba(90,160,255,.5)' : 'rgba(255,140,40,.5)') : pr.gold ? 'rgba(255,220,80,.45)' : 'rgba(255,255,255,.35)';
          ctx.lineWidth = pr.big ? 8 : 5; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
        }
        ctx.save(); ctx.translate(pr.x, pr.y);
        const big = pr.big ? 1.4 : 1, gold = pr.gold ? 1.15 : 1;
        if (pr.fire) {
          A.glow(ctx, 0, 0, 22, pr.blue ? '#4aa8ff' : '#ff8a2a', 0.6);
          A.ball(ctx, 0, 0, 8 * big, pr.blue ? '#e0f4ff' : '#fff1b0', pr.blue ? '#2a7aff' : '#ff6a1f', 2);
        } else switch (pr.kind) {
          case 'seed': A.ball(ctx, 0, 0, 7.5 * big * gold, pr.gold ? '#fff6a0' : pr.color ? U.shade(pr.color, 0.4) : '#c8f07a', pr.gold ? '#e0a21c' : pr.color || '#5aa82a', 2.2); break;
          case 'pepper': ctx.rotate(0.3); A.ell(ctx, 0, 0, 7 * big, 4.5 * big, 0, '#ff5a3a', 2); break;
          case 'ice': A.glow(ctx, 0, 0, 16, '#9be8ff', 0.5); A.ball(ctx, 0, 0, 7.5 * big, '#ffffff', '#5ab8ff', 2.2); break;
          case 'spike': ctx.rotate(Math.atan2(pr.vy, pr.vx)); A.poly(ctx, [-8, -3, 10, 0, -8, 3], '#f6d36b', 1.8); break;
          case 'thorn': A.poly(ctx, [-18 * big, -4 * big, 14 * big, 0, -18 * big, 4 * big], '#efe2bd', 2); break;
          case 'needle': ctx.rotate(-0.15); A.poly(ctx, [-12, -2, 12, 0, -12, 2], '#fff6d0', 1.6); break;
          case 'spore': A.glow(ctx, 0, 0, 14, '#b07aff', 0.5); A.ball(ctx, 0, 0, 6, '#e0b8ff', '#7a3fb8', 2); break;
          case 'fireball': A.glow(ctx, 0, 0, 22, '#ff8a2a', 0.6); A.ball(ctx, 0, 0, 9, '#fff1b0', '#ff6a1f', 2); break;
          case 'boomerang': ctx.rotate(t * 18); ctx.beginPath(); ctx.moveTo(-16 * big, 8); ctx.quadraticCurveTo(0, -14 * big, 18 * big, 6); ctx.quadraticCurveTo(0, -4, -16 * big, 8); ctx.fillStyle = '#e8c14a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = A.INK; ctx.stroke(); break;
          case 'berry': ctx.rotate(pr.rot || 0); A.ball(ctx, 0, 0, 10 * big, '#7aa0ff', '#20307a', 2.4); break;
          case 'pumpkin': ctx.rotate(pr.rot || 0); A.ell(ctx, 0, 0, 15 * big, 12 * big, 0, '#ff9a2a', 2.6); break;
          case 'rock': ctx.rotate(pr.rot || 0); A.ball(ctx, 0, 0, 10, '#b0a89a', '#6a6258', 2.4); break;
          case 'snow': A.ball(ctx, 0, 0, 10, '#ffffff', '#b8d8ff', 2.4); break;
          case 'cannon': A.ball(ctx, 0, 0, 11, '#6a6a7a', '#1a1a20', 2.4); break;
          case 'bullet': A.rrect(ctx, -8, -2.5, 16, 5, 2, '#ffe14a', 1.5); break;
          case 'missile': ctx.rotate(Math.PI / 2 + (pr.rot || 0) * 0.1); A.rrect(ctx, -5, -14, 10, 26, 4, '#d8dde8', 2); A.glow(ctx, 0, 16, 12, '#ff8a2a', 0.8); break;
          case 'dynamite': ctx.rotate(pr.rot || 0); A.rrect(ctx, -10, -4, 20, 8, 3, '#d8323a', 2); break;
          case 'car': ctx.rotate((pr.rot || 0) * 0.3); WD.drawWreck(ctx, 0, 20, 2); break;
          case 'goo': A.ball(ctx, 0, 0, 12, '#c8ff7a', '#3a8a2a', 2.4); break;
          default: A.ball(ctx, 0, 0, 7, '#c8f07a', '#5aa82a', 2);
        }
        ctx.restore();
      }
    }
    drawBeams(ctx, t) {
      for (const b of this.beams) {
        const a = Math.min(1, b.t * 5);
        ctx.save();
        ctx.globalAlpha = a;
        if (b.zig) {
          ctx.strokeStyle = b.col; ctx.lineWidth = b.w; ctx.shadowColor = b.col; ctx.shadowBlur = this.low ? 0 : 12;
          ctx.beginPath(); ctx.moveTo(b.x0, b.y0);
          const n = 7;
          for (let i = 1; i < n; i++) { const k = i / n; ctx.lineTo(U.lerp(b.x0, b.x1, k) + U.rand(-10, 10), U.lerp(b.y0, b.y1, k) + U.rand(-12, 12)); }
          ctx.lineTo(b.x1, b.y1); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, b.w * 0.4); ctx.stroke();
        } else {
          const g = ctx.createLinearGradient(0, b.y - b.w, 0, b.y + b.w);
          g.addColorStop(0, U.rgba(b.col, 0)); g.addColorStop(0.5, b.col); g.addColorStop(1, U.rgba(b.col, 0));
          ctx.fillStyle = g; ctx.fillRect(b.x0, b.y - b.w, b.x1 - b.x0, b.w * 2);
          ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(b.x0, b.y - b.w * 0.18, b.x1 - b.x0, b.w * 0.36);
        }
        ctx.restore();
      }
    }
    drawParts(ctx, t) {
      for (const p of this.parts) {
        if (p.delay > 0) continue;
        const k = 1 - p.life / p.max;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.5)) * (p.alpha || 1);
        switch (p.type) {
          case 'dot': ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); break;
          case 'ember': ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill(); break;
          case 'star': A.star(ctx, p.x, p.y, p.size, p.size * 0.4, 4, k * 3, p.col, 0); break;
          case 'smoke': ctx.fillStyle = p.col; ctx.globalAlpha *= 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + k * 0.8), 0, Math.PI * 2); ctx.fill(); break;
          case 'chunk': ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore(); break;
          case 'ring': ctx.strokeStyle = p.col; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, U.lerp(p.r0, p.r1, U.easeOutCubic(k)), 0, Math.PI * 2); ctx.stroke(); break;
          case 'streak': ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.size, p.y); ctx.stroke(); break;
          case 'flame': this.drawFlame(ctx, p.x, p.y, p.size * (1 - k * 0.6)); break;
          case 'spike': ctx.globalAlpha = 1 - k; for (let i = -2; i <= 2; i++) A.poly(ctx, [p.x + i * 14 - 4, p.y, p.x + i * 14, p.y - 30 * Math.sin(k * Math.PI), p.x + i * 14 + 4, p.y], '#e0d6b0', 1.5); break;
          case 'boom': {
            const r = p.r * (0.4 + U.easeOutCubic(k) * 0.9);
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, 'rgba(255,255,220,' + (1 - k) + ')'); g.addColorStop(0.35, 'rgba(255,200,60,' + (1 - k) + ')'); g.addColorStop(0.7, 'rgba(255,90,20,' + (0.8 - k * 0.8) + ')'); g.addColorStop(1, 'rgba(120,30,10,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'head': {
            if (!p.z) break;
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            const sc = (p.z.def.look && p.z.def.look.scale) || 1; ctx.scale(sc * 0.9, sc * 0.9);
            try { Z.headShape(ctx, p.z.def.look, p.z, 0, 0.6); } catch (e) {}
            ctx.restore();
            break;
          }
          case 'meteor': {
            const y0 = -60, kk = U.easeInCubic(k);
            const mx = p.x + 200 * (1 - kk), my = U.lerp(y0, p.y, kk);
            A.glow(ctx, mx, my, 40, '#ff8a2a', 0.7);
            A.ball(ctx, mx, my, 16, '#ffd27a', '#a0401a', 2.5);
            ctx.strokeStyle = 'rgba(255,160,60,.6)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 60, my - 70); ctx.stroke();
            ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y + 30, 50 * (1 - k) + 20, 0, Math.PI * 2); ctx.stroke();
            break;
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    drawPicks(ctx, t) {
      for (const pk of this.picks) {
        const fade = pk.state === 'idle' && pk.t > pk.life - 2 && pk.kind !== 'reward' ? 0.4 + Math.abs(Math.sin(pk.t * 10)) * 0.6 : 1;
        ctx.globalAlpha = fade;
        ctx.save(); ctx.translate(pk.x, pk.y);
        if (pk.kind === 'sun') {
          const s = pk.big ? 1.35 : pk.small ? 0.7 : 1;
          ctx.scale(s, s);
          A.glow(ctx, 0, 0, 46, '#ffd23f', 0.5);
          A.rays(ctx, 0, 0, 16, 34, 10, t * 1.4, '#ffe680', 0.7);
          A.ball(ctx, 0, 0, 18, '#fff6c0', '#ffb81f', 2.5);
          ctx.fillStyle = 'rgba(200,110,0,.7)'; ctx.beginPath(); ctx.arc(-6, -2, 2, 0, Math.PI * 2); ctx.arc(6, -2, 2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(200,110,0,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 2, 6, 0.2, Math.PI - 0.2); ctx.stroke();
        } else if (pk.kind === 'coin') {
          const sq = Math.abs(Math.cos(t * 5 + pk.x));
          ctx.scale(0.35 + sq * 0.65, 1);
          A.ball(ctx, 0, 0, pk.sub === 'gold' ? 15 : 12, pk.sub === 'gold' ? '#fff3a0' : '#f4f6ff', pk.sub === 'gold' ? '#e0a21c' : '#9aa2b8', 2.4);
          ctx.fillStyle = pk.sub === 'gold' ? '#b8800f' : '#6a7288'; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('G', 0, 1);
        } else if (pk.kind === 'gem') {
          A.glow(ctx, 0, 0, 30, '#6ae0ff', 0.5);
          A.poly(ctx, [0, -14, 12, -4, 7, 12, -7, 12, -12, -4], '#5ae0ff', 2.4);
          ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(0, -12); ctx.lineTo(2, -4); ctx.fill();
        } else if (pk.kind === 'leaf') {
          A.glow(ctx, 0, 0, 40, '#7aff5a', 0.6);
          ctx.rotate(Math.sin(t * 3) * 0.3);
          A.leaf(ctx, -14, 8, 30, 12, -0.8, '#5ae04a');
        } else if (pk.kind === 'reward') {
          const s = 1 + Math.sin(t * 4) * 0.06 + (pk.state === 'collect' ? pk.t * 2 : 0);
          ctx.scale(s, s);
          A.rays(ctx, 0, 0, 30, 90, 14, t, '#fff4a8', 0.5);
          A.glow(ctx, 0, 0, 80, '#ffe14a', 0.6);
          A.rrect(ctx, -26, -34, 52, 68, 8, '#ffe9a8', 3);
          const pid = this.level.reward && this.level.reward.plant;
          if (pid && !GVZ.Progress.owns(pid) && !this.headless) { ctx.save(); ctx.translate(0, 26); ctx.scale(0.42, 0.42); try { P.BY[pid].draw(ctx, { seed: 1, lv: 1, shootT: 9, hp: 1, maxHp: 1, s: P.stats(pid, 1), prod: 10, fuse: 99, life: 9, grow: 99 }, t); } catch (e) {} ctx.restore(); }
          else A.star(ctx, 0, 0, 20, 9, 5, 0, '#ffd23f', 2.5);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    drawPreview(ctx, t) {
      const h = this.hover;
      if (!h || this.selected == null || this.state !== 'play' && this.state !== 'intro') return;
      const cell = this.cellAt(h.x, h.y);
      if (!cell) return;
      const x = this.X0 + cell.c * this.CW, y = this.Y0 + cell.r * this.CH;
      const sel = this.selected;
      let id = null, ok = true;
      if (typeof sel === 'number' && this.cards[sel]) { id = this.cards[sel].id; ok = !this.canPlace(id, cell.r, cell.c) && this.sun >= this.cards[sel].cost && this.cards[sel].cd <= 0; }
      else if (typeof sel === 'string' && sel.startsWith('belt:')) { const b = this.belt.find((b) => b.uid === +sel.slice(5)); if (b) { id = b.id; ok = !this.canPlace(id, cell.r, cell.c); } }
      else if (sel === 'shovel') ok = !!this.plantAt(cell.r, cell.c);
      else if (sel === 'power') { const p = this.grid[cell.r][cell.c]; ok = !!(p && p.def.power && !p.def.instant && this.leaves > 0); }
      ctx.fillStyle = ok ? 'rgba(255,255,255,.18)' : 'rgba(255,60,60,.22)';
      ctx.fillRect(x, y, this.CW, this.CH);
      ctx.strokeStyle = ok ? 'rgba(255,255,255,.7)' : 'rgba(255,80,80,.8)'; ctx.lineWidth = 3; ctx.strokeRect(x + 2, y + 2, this.CW - 4, this.CH - 4);
      // række- og kolonne-hjælpelinjer
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(this.X0, y, this.cols * this.CW, this.CH);
      if (id) {
        ctx.save(); ctx.translate(this.cellX(cell.c), this.rowY(cell.r)); ctx.globalAlpha = 0.55;
        try { P.BY[id].draw(ctx, { seed: 1, lv: 1, shootT: 9, hp: 1, maxHp: 1, s: P.stats(id, 1), prod: 10, fuse: 99, life: 9, grow: 99, armT: 0 }, t); } catch (e) {}
        ctx.restore(); ctx.globalAlpha = 1;
      } else if (sel === 'shovel') {
        ctx.save(); ctx.translate(this.cellX(cell.c) + 10, this.rowY(cell.r) - 50); ctx.rotate(0.6 + Math.sin(t * 8) * 0.1);
        A.rrect(ctx, -4, -40, 8, 44, 3, '#8a5a2a', 2); A.poly(ctx, [-14, 4, 14, 4, 10, 30, 0, 36, -10, 30], '#c8d0dc', 2.4); ctx.restore();
      }
    }
    drawBanner(ctx, t) {
      const b = this.banner;
      if (this.state === 'intro' && !this.headless) {
        const k = this.introT;
        const word = k > 1.6 ? 'Klar...' : k > 0.8 ? 'Parat...' : 'PLANT!';
        const s = 1 + ((k * 1.25) % 1) * 0.3;
        ctx.save(); ctx.translate(this.W / 2, this.H / 2); ctx.scale(s, s);
        ctx.font = '72px Lilita One, Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 10; ctx.strokeStyle = '#2a1b12'; ctx.strokeText(word, 0, 0);
        ctx.fillStyle = word === 'PLANT!' ? '#7aff5a' : '#ffd23f'; ctx.fillText(word, 0, 0);
        ctx.restore();
      }
      if (b) {
        const k = 1 - b.t / b.max;
        const a = k < 0.15 ? k / 0.15 : b.t < 0.4 ? b.t / 0.4 : 1;
        ctx.save(); ctx.globalAlpha = a;
        ctx.translate(this.W / 2, this.H / 2 - 40);
        const sc = b.big ? 1 + Math.sin(t * 10) * 0.03 : 1;
        ctx.scale(sc, sc);
        ctx.font = (b.big ? 48 : 36) + 'px Lilita One, Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 9; ctx.strokeStyle = '#2a1b12'; ctx.strokeText(b.text, 0, 0);
        ctx.fillStyle = b.col; ctx.fillText(b.text, 0, 0);
        ctx.restore();
      }
      if (this.state === 'lost' && !this.headless) {
        const k = Math.min(1, this.endT / 0.8);
        ctx.fillStyle = 'rgba(40,0,0,' + k * 0.5 + ')'; ctx.fillRect(0, 0, this.W, this.H);
        ctx.save(); ctx.translate(this.W / 2, this.H / 2); ctx.scale(0.6 + U.easeOutBack(k) * 0.4, 0.6 + U.easeOutBack(k) * 0.4);
        ctx.font = '58px Lilita One, Arial Black, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 10; ctx.strokeStyle = '#2a1b12'; ctx.strokeText(this.loseReason, 0, 0); ctx.fillStyle = '#9cff6b'; ctx.fillText(this.loseReason, 0, 0);
        ctx.restore();
      }
      if (this.denyMsg && !this.headless) {
        ctx.save(); ctx.globalAlpha = Math.min(1, this.denyMsg.t * 2);
        ctx.font = '22px Lilita One, Arial Black, sans-serif'; ctx.textAlign = 'center';
        const w = ctx.measureText(this.denyMsg.text).width + 30;
        ctx.fillStyle = 'rgba(40,10,10,.8)'; U.roundRect(ctx, this.W / 2 - w / 2, this.H - 70, w, 38, 12); ctx.fill();
        ctx.fillStyle = '#ffd0d0'; ctx.fillText(this.denyMsg.text, this.W / 2, this.H - 44);
        ctx.restore();
      }
    }
  }
  return { Battle, BUBBLE };
})();
