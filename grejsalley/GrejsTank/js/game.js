/* =====================================================================
 * GREJS TANKS - game.js
 * The Battle: turn system, tanks, projectiles & behaviors, explosions,
 * damage, status effects, abilities, bosses & phases, random events,
 * camera, rendering and the requestAnimationFrame game loop.
 *
 * The battle is UI-agnostic: it talks to the HUD through `this.ui`
 * callbacks and receives input through public methods.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const U = GT.U, P = GT.Particles, R = GT.Render, PH = GT.Physics;
  const A = () => GT.Audio;
  const STEP = 1 / 120;

  let uid = 1;

  class Battle {
    constructor(level, opts) {
      this.level = level;
      this.world = GT.Worlds.get(level.world);
      this.opts = opts || {};
      this.ui = this.opts.ui || {};
      this.W = level.width;
      this.H = level.height || 1000;
      this.time = 0;
      this.paused = false;
      this.over = false;
      this.state = 'intro';
      this.stateT = 0;
      this.gravity = PH.GRAVITY * this.world.gravity * (level.event === 'lowgrav' ? 0.6 : 1);
      this.dmgGlobal = level.event === 'double' ? 2 : 1;
      this.diff = level.diff || 0;
      this.settings = (GT.Save.data && GT.Save.data.settings) || {};
      P.reset();
      P.setQuality(this.settings.quality);

      this.terrain = new GT.Terrain(this.W, this.H, this.world);
      this.terrain.generate(level);
      this.bg = R.buildBackground(this.world, this.W, this.H, level.seed);
      this.hazardY = this.world.hazard && this.world.hazard.type !== 'void' ? this.world.lavaLevel || 910 : null;

      this.tanks = [];
      this.projectiles = [];
      this.timers = [];
      this.zones = [];
      this.mines = [];
      this.barrels = [];
      this.crates = [];
      this.platforms = [];
      this.drones = [];
      this.decos = [];
      this.beams = [];
      this.bolts = [];
      this.markers = [];
      this.wind = 0;
      this.round = 0;
      this.turnIdx = 0;
      this.order = [];
      this.active = null;
      this.moveDir = 0;
      this.lastBoom = null;
      this.explosionId = 0;
      this.stats = {
        turns: 0, shots: 0, kills: 0, damage: 0, damageTaken: 0, crits: 0,
        usedWeapons: new Set(), usedCats: new Set(), abilityUses: 0, crates: 0,
        multiKills: 0, longShot: false, nukeKill: false, coinsFound: 0, bpFound: 0, enemiesSeen: new Set()
      };
      // panX/panY: manual camera offset (world units) set by the player to look around
      this.cam = { x: 0, y: 0, scale: 1, shake: 0, overview: false, fx: 0, fy: 0, panX: 0, panY: 0, panDir: 0 };
      this.view = { x: 0, y: 0, w: 1000, h: 700 };

      this._createTanks();
      this._placeDecos();
      this._setupEvent();
      this._snapCamera();
    }

    /* ==============================================================
     * Setup
     * ============================================================== */
    _baseTank(o) {
      return Object.assign({
        uid: uid++, alive: true, dying: 0, x: 0, y: 0, tilt: 0, aim: 45, power: 60,
        vy: 0, falling: false, fallStart: 0, knockVx: 0, flash: 0, recoil: 0, phase: 0,
        fuel: 0, weapon: 0, charge: 0, shield: 0, shieldTurns: 0, acc: 0.5,
        status: { frozen: 0, burn: null, poison: null, emp: 0, double: false, over: false },
        shotsAt: 0, isBoss: false
      }, o);
    }

    _createTanks() {
      const L = this.level;
      const T = this.terrain;
      // ---- player
      const def = GT.Tanks.get(this.opts.tankId);
      const st = GT.Tanks.stats(def.id);
      const p = this._baseTank({
        team: 'player', id: def.id, name: def.name, vis: def.vis, scale: def.size,
        maxHp: st.hp, hp: st.hp, armor: st.armor, dmgMult: st.damage / 100,
        launch: PH.SPEED_BASE * st.power, speedStat: st.speed, reload: st.reload,
        radiusMult: st.radius / 100, stability: st.stability, specialMult: st.special / 100,
        ability: def.ability, isPlayer: true, hover: def.vis.move === 'hover'
      });
      p.maxFuel = 150 * (st.speed / 100);
      p.moveSpeed = 90 * (0.6 + (0.4 * st.speed) / 100); // a bit snappier than enemies so driving feels responsive
      // ability upgrades: stronger effect + faster recharge
      const abLvl = GT.Save.abilityLevel(p.ability);
      p.specialMult *= GT.Tanks.abilityMult(abLvl);
      p.cd = GT.Tanks.abilityCd(p.ability, abLvl);
      p.charge = p.cd * 0.5; // half charged at start
      // weapons: primary (infinite), signature, loadout
      const S = GT.Save;
      const wl = [];
      const add = (id, infinite) => {
        const w = GT.Weapons.get(id);
        const lvl = S.weaponLevel(id);
        const ex = wl.find((x) => x.id === id);
        const ammo = infinite ? -1 : GT.Weapons.levelAmmo(w, lvl);
        if (ex) {
          if (ex.ammo >= 0 && ammo !== 0) ex.ammo = ammo < 0 ? -1 : ex.ammo + Math.max(1, Math.ceil(ammo / 2));
          return;
        }
        wl.push({ id, ammo, lvl, max: ammo });
      };
      add(def.weapons[0], true);
      add(def.weapons[1], false);
      for (const id of (this.opts.loadout || [])) if (id && GT.Weapons.byId[id]) add(id, false);
      p.weapons = wl;
      this.player = p;
      this._place(p, L.spawns.player);
      this.tanks.push(p);

      // ---- enemies
      const n = L.enemies.length;
      const multi = [1, 1, 0.78, 0.66, 0.58][Math.min(4, n)];
      L.enemies.forEach((e, i) => {
        const sp = L.spawns.enemies[i] || { x: this.W * 0.8 };
        const t = e.type === 'boss' ? this._makeBoss(e.boss) : this._makeEnemy(e.type, n > 1 ? multi : 1);
        this._place(t, sp);
        this.tanks.push(t);
      });
      // face each other
      for (const t of this.tanks) {
        const tgt = t.team === 'player' ? this.tanks.find((o) => o.team !== 'player') : p;
        const right = !tgt || tgt.x >= t.x;
        t.aim = right ? 45 : 135;
        t.power = 60;
      }
    }

    _makeEnemy(type, multi) {
      const e = GT.Enemies.get(type);
      // difficulty grows slower after world 10 so the late worlds stay beatable
      const d = this.diff <= 10 ? this.diff : 10 + (this.diff - 10) * 0.5;
      const HARD = 1.3; // global boost to enemy hp and damage
      const t = this._baseTank({
        team: 'enemy', id: e.id, name: e.name, vis: Object.assign({}, e.vis, { deco: (e.vis.deco || []).concat(['visor']) }),
        scale: e.vis.size || 1, ai: e.ai, split: e.split,
        maxHp: Math.round(e.hp * (1 + 0.27 * d) * HARD), armor: Math.round(e.armor + d * 1.6),
        dmgMult: e.dmg * (1 + 0.14 * d) * (multi || 1) * HARD, launch: PH.SPEED_BASE * (e.power + d * 1.5),
        speedStat: e.ai === 'mover' || e.ai === 'kamikaze' ? 140 : 90, radiusMult: 1, stability: 55,
        acc: Math.min(0.9, e.acc + 0.12 + d * 0.03), specialMult: 1 + d * 0.06
      });
      t.hp = t.maxHp;
      t.maxFuel = 150 * (t.speedStat / 100);
      t.moveSpeed = 70 * (0.6 + (0.4 * t.speedStat) / 100);
      t.weapons = e.w.map((id, i) => {
        const w = GT.Weapons.get(id);
        // primary weapon and basic shells are always unlimited for the AI
        return { id, ammo: i === 0 || w.ammo < 0 || id === 'shell' ? -1 : Math.max(1, w.ammo), lvl: 1 };
      });
      if (e.ai === 'shielder') { t.ability = 'shield'; t.cd = 3; t.charge = 2; }
      if (e.ai === 'healer') { t.ability = 'heal_ally'; t.cd = 3; t.charge = 2; }
      this.stats.enemiesSeen.add(e.id);
      return t;
    }

    _makeBoss(id) {
      const B = GT.Enemies.bosses.find((x) => x.id === id) || GT.Enemies.bosses[0];
      const d = this.diff <= 10 ? this.diff : 10 + (this.diff - 10) * 0.5;
      const HARD = 1.3;
      const t = this._baseTank({
        team: 'enemy', id: B.id, name: B.name, vis: Object.assign({}, B.vis, { deco: (B.vis.deco || []).concat(['visor']) }),
        scale: B.scale, ai: 'boss', isBoss: true, bossDef: B, phaseIdx: 0, pendingPhase: null,
        maxHp: Math.round(B.hp * Math.max(0.3, 0.55 - 0.02 * B.world) * HARD), armor: B.armor, dmgMult: B.dmg * 0.85 * (1 + 0.12 * d) * HARD,
        launch: PH.SPEED_BASE * (110 + d * 1.5), speedStat: 60, radiusMult: 1.1, stability: 100,
        acc: Math.min(0.9, B.acc + 0.08 + d * 0.015), specialMult: 1 + d * 0.08
      });
      t.hp = t.maxHp;
      t.maxFuel = 90;
      t.moveSpeed = 45;
      t.weapons = B.phases[0].w.map((id) => ({ id, ammo: -1, lvl: 1 }));
      this.boss = t;
      this.stats.enemiesSeen.add(B.id);
      return t;
    }

    _place(t, sp) {
      const T = this.terrain;
      let x = U.clamp(sp.x, 40, this.W - 40);
      let y = T.surfaceY(x, sp.y != null ? sp.y - 20 : 0);
      if (y > this.H - 5) {
        // search nearby for ground
        for (let k = 10; k < 400 && y > this.H - 5; k += 10) {
          for (const s of [-1, 1]) {
            const yy = T.surfaceY(x + s * k, 0);
            if (yy < this.H - 5) { x += s * k; y = yy; break; }
          }
        }
      }
      t.x = x;
      t.y = Math.min(y, this.H - 25);
      this._updateTilt(t, 1);
    }

    _placeDecos() {
      const T = this.terrain;
      const r = U.rng(this.level.seed + 99);
      const n = Math.floor(this.W / 70);
      const spawns = this.tanks.map((t) => t.x);
      for (let i = 0; i < n; i++) {
        const x = r.range(20, this.W - 20);
        if (spawns.some((s) => Math.abs(s - x) < 55)) continue;
        const y = T.surfaceY(x, 0);
        if (y >= this.H - 30 || (this.hazardY && y > this.hazardY - 10)) continue;
        // skip steep spots
        const y2 = T.surfaceY(x + 12, 0), y1 = T.surfaceY(x - 12, 0);
        if (Math.abs(y2 - y1) > 16) continue;
        const type = r.pick(this.world.deco);
        this.decos.push({ x, y: y + 3, sp: R.decoSprite(type, this.world), s: r.range(0.75, 1.15), flip: r() < 0.5 });
      }
    }

    _setupEvent() {
      const ev = this.level.event;
      const T = this.terrain;
      const r = U.rng(this.level.seed + 7);
      const clearOf = (x, d) => this.tanks.every((t) => Math.abs(t.x - x) > d);
      if (ev === 'barrels') {
        for (let i = 0, tries = 0; i < 5 && tries < 60; tries++) {
          const x = r.range(this.W * 0.2, this.W * 0.85);
          if (!clearOf(x, 90)) continue;
          const y = T.surfaceY(x, 0);
          if (y > this.H - 30) continue;
          this.barrels.push({ x, y, alive: true, vy: 0 });
          i++;
        }
      }
      if (ev === 'platforms') {
        const k = r.int(1, 2);
        for (let i = 0; i < k; i++) {
          const cx = this.W * (0.35 + 0.3 * i + r.range(-0.05, 0.05));
          this.platforms.push({ cx, x: cx, y: r.range(230, 400), w: r.range(120, 180), h: 18, amp: r.range(90, 180), spd: r.range(0.35, 0.6), ph: r.range(0, 6) });
        }
      }
      if (ev === 'toxic') {
        for (let i = 0, tries = 0; i < 2 && tries < 40; tries++) {
          const x = r.range(this.W * 0.25, this.W * 0.75);
          if (!clearOf(x, 120)) continue;
          const y = T.surfaceY(x, 0);
          if (y > this.H - 30) continue;
          this.zones.push({ type: 'toxic', x, y, r: 90, dmg: Math.round(22 * (1 + 0.2 * this.diff)), turns: 999, owner: null, t: r.range(0, 5) });
          i++;
        }
      }
    }

    /* ==============================================================
     * Helpers
     * ============================================================== */
    windAcc() {
      return this.wind * PH.WIND_ACC;
    }
    enemiesOf(t) {
      return this.tanks.filter((o) => o.alive && o.team !== t.team);
    }
    alliesOf(t) {
      return this.tanks.filter((o) => o.alive && o.team === t.team);
    }
    nearestEnemy(t, x) {
      let best = null, bd = 1e9;
      for (const o of this.enemiesOf(t)) {
        const d = Math.abs(o.x - (x == null ? t.x : x));
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }
    after(t, fn) {
      this.timers.push({ t, fn });
    }
    msg(text, kind) {
      if (this.ui.message) this.ui.message(text, kind);
    }
    shake(v) {
      if (this.settings.shake === false) return;
      this.cam.shake = Math.min(28, Math.max(this.cam.shake, v));
    }
    currentWeapon(t) {
      t = t || this.player;
      if (t.armed) return GT.Weapons.get(GT.Tanks.ABILITIES[t.armed].weapon);
      const slot = t.weapons[t.weapon] || t.weapons[0];
      return GT.Weapons.get(slot.id);
    }
    isPlayerTurn() {
      return this.active === this.player && (this.state === 'aim' || this.state === 'teleport');
    }

    /* ==============================================================
     * Turn flow
     * ============================================================== */
    begin() {
      this.state = 'intro';
      this.stateT = this.level.isBoss ? 2.4 : 1.4;
      const boss = this.boss;
      if (boss) {
        this.cam.fx = boss.x;
        this.cam.fy = boss.y;
        A().play('boss');
        this.msg('⚠ ' + boss.name.toUpperCase() + ' ⚠', 'boss');
      } else {
        this.msg(this.level.name, 'title');
      }
      if (this.level.event) {
        const ev = GT.Levels.EVENTS[this.level.event];
        this.after(this.level.isBoss ? 1.2 : 0.7, () => this.msg(ev.icon + ' ' + ev.name + ': ' + ev.desc, 'event'));
      }
    }

    newRound() {
      this.round++;
      const wm = this.level.windMax || 0;
      this.wind = Math.round(U.rand(-wm, wm));
      // tick zones
      for (const z of this.zones) z.turns--;
      this.zones = this.zones.filter((z) => z.turns > 0);
      // mines age
      for (const m of this.mines) m.age++;
      const old = this.mines.filter((m) => m.age > 4);
      for (const m of old) this._detonateMine(m);
      this.order = this.tanks.filter((t) => t.alive);
      // player always first
      this.order.sort((a, b) => (a.team === 'player' ? -1 : 0) - (b.team === 'player' ? -1 : 0));
      this.turnIdx = 0;
      let eventful = false;
      // supply crates
      const crateChance = this.level.event === 'crates' ? 0.6 : 0.16;
      if (this.round > 1 && this.crates.filter((c) => c.alive).length < 2 && Math.random() < crateChance) {
        this._spawnCrate();
      }
      // sudden death: prevents endless stalemates in very long battles
      if (this.round >= GT.Battle.SUDDEN_DEATH) {
        eventful = true;
        const pct = 0.05 + 0.01 * (this.round - GT.Battle.SUDDEN_DEATH);
        if (this.round === GT.Battle.SUDDEN_DEATH) this.msg('☢️ SUDDEN DEATH! Everyone takes damage every round', 'event');
        for (const t of this.tanks) {
          if (!t.alive) continue;
          this._damage(t, Math.round(t.maxHp * pct), null, { pure: true, color: '#ff5252', label: '☢' });
          P.burst(t.x, t.y - 20, ['#ff5252', '#ffd54f'], 12, 120);
        }
      }
      // meteor shower
      if (this.level.event === 'meteors' && this.round > 1) {
        eventful = true;
        this.msg('☄️ Meteor shower!', 'event');
        for (let i = 0; i < 2; i++) {
          const x = U.rand(this.W * 0.1, this.W * 0.9);
          this.after(0.3 + i * 0.5, () => this._spawnMeteor(x, Math.round(40 * (1 + 0.2 * this.diff)), 46, null));
        }
      }
      if (eventful) this._waitResolve(() => this.startTurn());
      else this.startTurn();
    }

    startTurn() {
      if (this.over) return;
      if (this._checkEnd()) return; // e.g. tanks destroyed by round events (sudden death, meteors)
      if (this.turnIdx >= this.order.length) return this.newRound();
      const t = this.order[this.turnIdx];
      if (!t || !t.alive) {
        this.turnIdx++;
        return this.startTurn();
      }
      this.active = t;
      t.fuel = t.maxFuel;
      t.armed = null;
      this.moveDir = 0;
      // shield expiry
      if (t.shieldTurns > 0) {
        t.shieldTurns--;
        if (t.shieldTurns <= 0) t.shield = 0;
      }
      // ability charge
      if (t.status.emp > 0) t.status.emp--;
      else if (t.ability) t.charge = Math.min(t.cd, t.charge + 0.8 + (t.reload || 2) * 0.1);
      // damage over time + hazards
      const dot = this._applyTurnDamage(t);
      if (!t.alive) {
        return this._waitResolve(() => this.endTurn());
      }
      if (t.status.iceImmune > 0) t.status.iceImmune--;
      if (t.status.frozen > 0) {
        t.status.frozen--;
        // after thawing a tank always gets to act once before it can be frozen again
        if (t.status.frozen <= 0) t.status.iceImmune = 2;
        P.text(t.x, t.y - 60 * t.scale, 'FROZEN!', '#aef', 26);
        A().play('freeze');
        this.state = 'frozen';
        this.stateT = 1.1;
        if (this.ui.turn) this.ui.turn(this);
        return;
      }
      if (this.ui.turn) this.ui.turn(this);
      if (t === this.player) {
        this.stats.turns++;
        this.resetPan();
        this.state = 'aim';
        A().play('turn');
        if (dot) this.stateT = 0;
      } else {
        this.state = 'ai_start';
        this.stateT = dot ? 0.9 : 0.55;
      }
    }

    endTurn() {
      if (this.over) return;
      this.active = null;
      A().engine(false);
      if (this._checkEnd()) return;
      this.turnIdx++;
      this.startTurn();
    }

    _checkEnd() {
      if (this.over) return true;
      if (!this.player.alive) {
        this.over = true;
        this.state = 'defeat';
        this.stateT = 2;
        A().play('defeat');
        this.msg('DEFEAT', 'defeat');
        return true;
      }
      if (!this.tanks.some((t) => t.alive && t.team === 'enemy')) {
        this.over = true;
        this.state = 'victory';
        this.stateT = 2.2;
        A().play('victory');
        this.msg('VICTORY!', 'victory');
        return true;
      }
      return false;
    }

    /** freeze a tank (respects the short immunity after thawing) */
    _freeze(t, turns) {
      if (!t.alive || t.status.iceImmune > 0) return false;
      t.status.frozen = Math.max(t.status.frozen, turns);
      return true;
    }

    _forceSettle() {
      this.resolveT = 0;
      this.projectiles.length = 0;
      this.timers.length = 0;
      this.beams.length = 0;
      for (const d of this.drones) d.dead = true;
      this.drones.length = 0;
      for (const t of this.tanks) {
        t.knockVx = 0;
        if (!t.alive) t.dying = 0;
      }
      for (const c of this.crates) c.falling = false;
    }

    _waitResolve(cb) {
      this.resolveT = 0;
      this.state = 'resolve';
      this.stateT = 0;
      this.resolveCb = cb;
      this.settleT = 0;
    }

    _settled() {
      if (this.projectiles.length || this.timers.length || this.drones.length || this.beams.length) return false;
      for (const t of this.tanks) {
        if (t.falling || Math.abs(t.knockVx) > 4) return false;
        if (!t.alive && t.dying > 0.4) return false;
      }
      // falling supply crates keep dropping during the next turn - no need to wait for them
      return true;
    }

    _applyTurnDamage(t) {
      let any = false;
      const s = t.status;
      // burn / poison status
      for (const k of ['burn', 'poison']) {
        const st = s[k];
        if (st && st.turns > 0) {
          this._damage(t, st.dmg, st.owner, { pure: true, color: k === 'burn' ? '#ff9a3d' : '#8cff4a', label: k === 'burn' ? '🔥' : '☠' });
          st.turns--;
          any = true;
          if (st.turns <= 0) s[k] = null;
          if (k === 'burn') P.burst(t.x, t.y - 20, ['#ff7a1a', '#ffd35a'], 14, 120);
          else P.burst(t.x, t.y - 20, ['#8cff4a', '#4fd12b'], 14, 100);
        }
      }
      // zones
      const best = {};
      for (const z of this.zones) {
        if (Math.abs(t.x - z.x) < z.r && Math.abs(t.y - z.y) < z.r * 0.8) {
          if (!best[z.type] || best[z.type].dmg < z.dmg) best[z.type] = z;
        }
      }
      for (const k in best) {
        const z = best[k];
        this._damage(t, z.dmg, z.owner, { pure: true, color: k === 'fire' ? '#ff9a3d' : '#8cff4a', label: k === 'fire' ? '🔥' : '☣' });
        any = true;
      }
      // hazard
      if (t.alive && this.hazardY && t.y > this.hazardY - 4) {
        const hz = this.world.hazard;
        this._damage(t, Math.round(hz.dmg * (1 + 0.1 * this.diff)), null, { pure: true, color: hz.color, label: hz.type === 'lava' ? '🌋' : '☣' });
        any = true;
      }
      return any;
    }

    /* ==============================================================
     * Player input API
     * ============================================================== */
    setAim(angle, power) {
      if (!this.isPlayerTurn()) return;
      const p = this.player;
      if (angle != null) p.aim = U.clamp(angle, -80, 260);
      if (power != null) p.power = U.clamp(power, 1, 100);
    }
    nudgeAim(da, dp) {
      if (!this.isPlayerTurn()) return;
      this.setAim(this.player.aim + (da || 0), this.player.power + (dp || 0));
    }
    setMove(dir) {
      this.moveDir = dir;
    }
    selectWeapon(i) {
      const p = this.player;
      if (!this.isPlayerTurn() || !p.weapons[i]) return;
      if (p.weapons[i].ammo === 0) {
        A().play('error');
        return;
      }
      p.armed = null;
      p.weapon = i;
      A().play('select');
    }
    toggleOverview() {
      this.cam.overview = !this.cam.overview;
    }

    /* ---- manual camera pan (look around the battlefield) ---- */
    /** hold-to-pan: dir -1 (left), 0 (stop), 1 (right) */
    setPan(dir) {
      this.cam.panDir = dir;
    }
    /** pan by a screen-pixel drag */
    panByScreen(dx, dy) {
      const c = this.cam;
      c.panX -= dx / c.scale;
      c.panY -= dy / c.scale;
      this._clampPan();
    }
    resetPan() {
      const c = this.cam;
      c.panX = c.panY = 0;
      c.panDir = 0;
    }
    isPanned() {
      return Math.abs(this.cam.panX) > 1 || Math.abs(this.cam.panY) > 1;
    }
    _clampPan() {
      const c = this.cam;
      c.panX = U.clamp(c.panX, -this.W, this.W);
      c.panY = U.clamp(c.panY, -this.H, this.H);
    }

    /** pointer in world coords (aim drag / teleport tap) */
    pointerAim(wx, wy) {
      if (this.state === 'teleport') return;
      if (!this.isPlayerTurn()) return;
      const p = this.player;
      const m = R.muzzle(p, p.aim);
      const dx = wx - m.px, dy = m.py - wy;
      let ang = U.deg(Math.atan2(dy, dx));
      if (ang < -90) ang += 360; // below horizontal on the left -> 180..270
      p.aim = U.clamp(ang, -80, 260);
      // power from distance (in screen pixels, converted by UI)
    }
    pointerTap(wx, wy) {
      if (this.state !== 'teleport') return false;
      const p = this.player;
      const x = U.clamp(wx, 30, this.W - 30);
      const y = this.terrain.surfaceY(x, Math.max(0, wy - 30));
      if (y >= this.H - 25 || (this.terrain.isSolid(x, y - 20))) {
        A().play('error');
        P.text(wx, wy, 'No ground!', '#ff8a8a', 20);
        return true;
      }
      P.burst(p.x, p.y - 20, ['#b36bff', '#6cf5ff', '#fff'], 30, 260);
      p.x = x;
      p.y = y;
      p.vy = 0;
      p.falling = false;
      this._updateTilt(p, 1);
      P.burst(p.x, p.y - 20, ['#b36bff', '#6cf5ff', '#fff'], 30, 260);
      A().play('teleport');
      p.charge = 0;
      this.stats.abilityUses++;
      this.state = 'aim';
      if (this.ui.turn) this.ui.turn(this);
      return true;
    }

    fire() {
      if (!this.isPlayerTurn() || this.state === 'teleport') return;
      const p = this.player;
      const w = this.currentWeapon(p);
      if (!p.armed) {
        const slot = p.weapons[p.weapon];
        if (!slot || slot.ammo === 0) return;
        if (slot.ammo > 0) slot.ammo--;
        this.stats.usedWeapons.add(slot.id);
        this.stats.usedCats.add(w.cat);
      } else {
        p.charge = 0;
        this.stats.abilityUses++;
        p.armed = null;
      }
      this.stats.shots++;
      this.moveDir = 0;
      this.resetPan();
      A().engine(false);
      this._fire(p, w, p.aim, p.power);
      // auto-switch to primary when ammo runs out
      const slot = p.weapons[p.weapon];
      if (slot && slot.ammo === 0) p.weapon = 0;
    }

    /** activate the special ability */
    useAbility() {
      const p = this.player;
      if (!this.isPlayerTurn()) return false;
      if (this.state === 'teleport') {
        this.state = 'aim';
        return false;
      }
      const ab = GT.Tanks.ABILITIES[p.ability];
      if (!ab) return false;
      if (p.armed) {
        p.armed = null;
        return false;
      }
      if (p.charge < p.cd || p.status.emp > 0) {
        A().play('error');
        return false;
      }
      if (ab.kind === 'weapon') {
        p.armed = p.ability;
        A().play('select');
        this.msg(ab.icon + ' ' + ab.name + ' armed - aim and fire!', 'info');
        return true;
      }
      if (ab.kind === 'target') {
        this.state = 'teleport';
        this.msg('🌀 Tap where you want to teleport', 'info');
        return true;
      }
      p.charge = 0;
      this.stats.abilityUses++;
      if (ab.kind === 'self') {
        this._selfAbility(p, p.ability);
        if (this.ui.turn) this.ui.turn(this);
        return true;
      }
      // auto
      this.moveDir = 0;
      this.resetPan();
      this._autoAbility(p, p.ability);
      this.state = 'flight';
      this._waitResolve(() => this.endTurn());
      return true;
    }

    /* ==============================================================
     * Abilities
     * ============================================================== */
    _selfAbility(t, id) {
      const k = t.specialMult || 1;
      switch (id) {
        case 'shield':
          t.shield = Math.round(t.maxHp * 0.3 * k);
          t.shieldTurns = 2;
          A().play('shield');
          P.text(t.x, t.y - 60 * t.scale, '🛡 SHIELD', '#8fd8ff', 24);
          break;
        case 'repair': {
          const h = Math.round(t.maxHp * 0.28 * k);
          this._heal(t, h);
          break;
        }
        case 'heal_ally': {
          const allies = this.alliesOf(t).filter((o) => o.hp < o.maxHp);
          allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
          const tgt = allies[0] || t;
          this.beams.push({ x1: t.x, y1: t.y - 25, x2: tgt.x, y2: tgt.y - 20, life: 0.5, max: 0.5, color: '#7dff9b', w: 6 });
          this._heal(tgt, Math.round(tgt.maxHp * 0.14 * k));
          break;
        }
        case 'double':
          t.status.double = true;
          A().play('upgrade');
          P.text(t.x, t.y - 60 * t.scale, '✖2 DAMAGE', '#ffd23f', 24);
          break;
        case 'overcharge':
          t.status.over = true;
          A().play('zap');
          P.burst(t.x, t.y - 20, ['#6cf5ff', '#fff'], 24, 200);
          P.text(t.x, t.y - 60 * t.scale, '⚡ OVERCHARGE', '#6cf5ff', 24);
          break;
        case 'nitro':
          t.fuel = t.maxFuel * 3;
          this._heal(t, Math.round(t.maxHp * 0.08 * k));
          P.text(t.x, t.y - 80 * t.scale, '💨 NITRO', '#fff', 24);
          break;
      }
    }

    _heal(t, h) {
      h = Math.min(h, t.maxHp - t.hp);
      t.hp += h;
      P.heal(t.x, t.y - 20);
      P.text(t.x, t.y - 55 * t.scale, '+' + h, '#7dff9b', 24);
      A().play('heal');
    }

    _autoAbility(t, id) {
      const k = (t.specialMult || 1) * t.dmgMult * this.dmgGlobal;
      const tgt = this.nearestEnemy(t);
      if (!tgt && id !== 'emp_pulse') return;
      switch (id) {
        case 'barrage': {
          const foes = this.enemiesOf(t);
          const w = GT.Weapons.get('ab_missile');
          for (let i = 0; i < 6; i++) {
            this.after(i * 0.15, () => {
              if (!t.alive) return;
              const target = foes[i % foes.length];
              const m = R.muzzle(t, 90);
              const a = U.rad(90 + U.rand(-35, 35));
              this._spawnProjectile(t, w, m.px, m.py - 10, Math.cos(a) * 520, -Math.sin(a) * 520, { dmgMult: k, target });
              A().play('rocket');
            });
          }
          break;
        }
        case 'drone':
          this.drones.push({ kind: 'drone', x: t.x, y: t.y - 60, tx: tgt.x, owner: t, target: tgt, drops: 4, cool: 0, phase: 'go', dmg: k, t: 0 });
          A().play('rocket');
          break;
        case 'earthquake':
          this.shake(22);
          A().play('explosion', { size: 2.5 });
          this.msg('🌋 EARTHQUAKE!', 'event');
          for (const o of this.enemiesOf(t)) {
            if (o.falling) continue;
            this.after(0.3 + Math.random() * 0.3, () => {
              this.terrain.carve(o.x + U.rand(-40, 40), o.y + 8, 26);
              P.dust(o.x, o.y, this.world.terrain.soil[0], 12);
              this._damage(o, 85 * k, t, {});
            });
          }
          break;
        case 'freeze':
          this.bolts.push(this._makeBolt(t.x, t.y - 30, tgt.x, tgt.y - 20, '#aef'));
          this.after(0.25, () => {
            this._damage(tgt, 55 * k, t, {});
            this._freeze(tgt, 1);
            P.burst(tgt.x, tgt.y - 20, ['#e8fbff', '#9be7ff'], 30, 220);
            A().play('freeze');
          });
          break;
        case 'firestorm':
        case 'toxic_cloud': {
          const w = GT.Weapons.get(id === 'firestorm' ? 'ab_fire' : 'ab_toxic');
          this.msg(id === 'firestorm' ? '🔥 FIRESTORM!' : '☣ TOXIC CLOUD!', 'event');
          for (let i = 0; i < 8; i++) {
            this.after(0.2 + i * 0.12, () => {
              const x = tgt.x + U.rand(-130, 130);
              this._spawnProjectile(t, w, x, this.cam.y - 60, U.rand(-30, 30), 250, { dmgMult: k });
            });
          }
          break;
        }
        case 'emp_pulse':
          A().play('zap');
          P.rings.push({ x: t.x, y: t.y - 20, r: 10, max: 900, life: 0.8, maxLife: 0.8, color: 'rgba(120,180,255,', w: 8 });
          for (const o of this.enemiesOf(t)) {
            this.after(0.3, () => {
              o.shield = 0;
              o.status.emp = 2;
              this._damage(o, 30 * k, t, {});
              P.sparks(o.x, o.y - 20, '#9cf', 20);
            });
          }
          break;
        case 'siphon':
          this.beams.push({ x1: t.x, y1: t.y - 25, x2: tgt.x, y2: tgt.y - 20, life: 0.7, max: 0.7, color: '#ff2a5a', w: 8 });
          A().play('laser');
          this.after(0.3, () => {
            const d = this._damage(tgt, 80 * k, t, {});
            this._heal(t, Math.max(10, Math.round(d)));
          });
          break;
      }
    }

    /** boss phase change actions */
    _bossPhase(t) {
      const B = t.bossDef;
      const ph = B.phases[t.pendingPhase];
      t.phaseIdx = t.pendingPhase;
      t.pendingPhase = null;
      t.weapons = ph.w.map((id) => ({ id, ammo: -1, lvl: 1 }));
      t.weapon = 0;
      A().play('phase');
      this.shake(16);
      P.burst(t.x, t.y - 40, ['#ff1744', '#ffd600', '#fff'], 50, 400);
      const tgt = this.player;
      const k = t.dmgMult * this.dmgGlobal;
      switch (ph.enter) {
        case 'barrage': this._autoAbility(t, 'barrage'); break;
        case 'shield': t.shield = Math.round(t.maxHp * 0.2); t.shieldTurns = 3; A().play('shield'); break;
        case 'heal': this._heal(t, Math.round(t.maxHp * 0.15)); break;
        case 'rage': t.dmgMult *= 1.3; P.text(t.x, t.y - 90 * t.scale, 'ENRAGED!', '#ff3d3d', 30); break;
        case 'quake': this._autoAbility(t, 'earthquake'); break;
        case 'freeze': this._autoAbility(t, 'freeze'); break;
        case 'meteor':
          for (let i = 0; i < 3; i++) this.after(0.4 + i * 0.35, () => this._spawnMeteor(tgt.x + U.rand(-120, 120), 60 * k, 55, t));
          break;
        case 'airstrike':
          this._airstrike(t, tgt.x, { n: 6, dmg: 40, r: 36, spread: 180 }, k);
          break;
        case 'summon': {
          const type = ph.summon || 'grunt';
          for (let i = 0; i < 2; i++) {
            const m = this._makeEnemy(type, 0.7);
            // summoned reinforcements arrive damaged
            m.maxHp = m.hp = Math.round(m.maxHp * 0.5);
            const x = U.clamp(t.x + (i ? 1 : -1) * U.rand(140, 220), 40, this.W - 40);
            m.x = x;
            m.y = Math.max(0, this.terrain.surfaceY(x, 0) - 300);
            m.falling = true;
            m.fallStart = m.y + 300; // no fall damage for spawns
            m.aim = tgt.x < x ? 135 : 45;
            this.tanks.push(m);
          }
          break;
        }
      }
    }

    /* ==============================================================
     * Firing & projectiles
     * ============================================================== */
    _fire(t, w, ang, pow) {
      let dmgMult = t.dmgMult * this.dmgGlobal;
      let radMult = t.radiusMult || 1;
      if (t.isPlayer) {
        const slot = t.weapons.find((s) => s.id === w.id);
        dmgMult *= GT.Weapons.levelMult(slot ? slot.lvl : 1);
      }
      if (t.status.double) { dmgMult *= 2; t.status.double = false; }
      if (t.status.over) { dmgMult *= 1.25; radMult *= 1.6; t.status.over = false; }
      t.recoil = 1;
      t.aim = ang;
      const m = R.muzzle(t, ang);
      const big = w.dmg >= 110 || w.id === 'mortar';
      P.muzzle(m.x, m.y, -U.rad(ang), big);
      this.shake(big ? 6 : 3);
      A().play(w.sound || (big ? 'heavyfire' : 'fire'));
      this.state = 'flight';
      this.lastBoom = null;
      if (w.type === 'laser') {
        this._laser(t, w, m, ang, dmgMult);
      } else {
        const count = w.count || 1;
        for (let i = 0; i < count; i++) {
          const off = count > 1 ? (i - (count - 1) / 2) * w.spread : 0;
          const launch = () => {
            if (!t.alive) return;
            const mm = R.muzzle(t, ang + off);
            const v = t.launch * (pow / 100) * w.speed;
            const a = U.rad(ang + off + (w.seq ? U.rand(-w.spread, w.spread) * 0.5 : 0));
            this._spawnProjectile(t, w, mm.x, mm.y, Math.cos(a) * v, -Math.sin(a) * v, { dmgMult, radMult });
            if (w.seq && i > 0) {
              t.recoil = 1;
              P.muzzle(mm.x, mm.y, -a, false);
              A().play('fire');
            }
          };
          if (w.seq && i > 0) this.after(i * w.seq, launch);
          else launch();
        }
      }
      this._waitResolve(() => this.endTurn());
    }

    _spawnProjectile(owner, w, x, y, vx, vy, o) {
      o = o || {};
      const p = {
        id: uid++, w, owner, x, y, vx, vy, age: 0, state: 'fly',
        dmgMult: o.dmgMult || 1, radMult: o.radMult || 1,
        bounces: w.bounces || 0, drillLeft: w.drill || 0, pierceLeft: w.pierce || 0,
        apex: false, trailT: 0, target: o.target || null, fromX: owner ? owner.x : x, sizeMul: o.sizeMul || 1,
        noSelf: o.noSelf != null ? o.noSelf : 0.25, isSub: !!o.isSub
      };
      this.projectiles.push(p);
      return p;
    }

    _updateProjectiles(dt) {
      const list = this.projectiles;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (p.dead) continue;
        this._stepProjectile(p, dt);
      }
      this.projectiles = list.filter((p) => !p.dead);
    }

    _stepProjectile(p, dt) {
      const w = p.w;
      const T = this.terrain;
      p.age += dt;
      if (p.state === 'roll') return this._stepRoll(p, dt);
      if (p.state === 'drill') return this._stepDrill(p, dt);

      // homing steering
      if (w.type === 'homing' && p.age > 0.35) {
        let tgt = p.target && p.target.alive ? p.target : this.nearestEnemy(p.owner || this.player, p.x);
        if (tgt) {
          const dx = tgt.x - p.x, dy = tgt.y - 18 * tgt.scale - p.y;
          const want = Math.atan2(dy, dx);
          const cur = Math.atan2(p.vy, p.vx);
          let d = want - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const turn = U.clamp(d, -w.homing * dt, w.homing * dt);
          const sp = Math.hypot(p.vx, p.vy);
          const na = cur + turn;
          p.vx = Math.cos(na) * sp;
          p.vy = Math.sin(na) * sp;
        }
      }
      const prevVy = p.vy;
      p.vy += this.gravity * w.grav * dt;
      p.vx += this.windAcc() * w.wind * dt;
      // apex behaviors
      if (!p.apex && prevVy < 0 && p.vy >= 0) {
        p.apex = true;
        if (w.type === 'split') return this._split(p);
        if (w.type === 'rain') return this._rain(p);
      }
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;

      // tanks
      for (const t of this.tanks) {
        if (!t.alive) continue;
        if (t === p.owner && p.age < p.noSelf) continue;
        if (PH.hitTank(t, nx, ny)) return this._impact(p, nx, ny, t);
      }
      // platforms
      for (const pl of this.platforms) {
        if (nx > pl.x - pl.w / 2 && nx < pl.x + pl.w / 2 && ny > pl.y && ny < pl.y + pl.h) return this._impact(p, nx, ny, null, true);
      }
      // crates & barrels
      for (const c of this.crates) {
        if (c.alive && Math.hypot(nx - c.x, ny - (c.y - 14)) < 18) {
          this._collectCrate(c, p.owner);
          return this._impact(p, nx, ny, null);
        }
      }
      for (const b of this.barrels) {
        if (b.alive && Math.abs(nx - b.x) < 12 && ny > b.y - 26 && ny < b.y + 2) return this._impact(p, nx, ny, null);
      }
      // terrain
      if (!(w.type === 'ghost' && p.vy < 0)) {
        const hit = T.rayHit(p.x, p.y, nx, ny, 2.5);
        if (hit) {
          if (w.type === 'pierce' && p.pierceLeft > 0) {
            p.pierceLeft -= Math.hypot(nx - p.x, ny - p.y);
            if (Math.random() < 0.5) P.sparks(hit.x, hit.y, '#e0e6ff', 3);
          } else {
            return this._impact(p, hit.x, hit.y, null);
          }
        }
      }
      p.x = nx;
      p.y = ny;
      // trail
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = w.trail === 'dot' ? 0.03 : 0.018;
        P.trail(p.x, p.y, w.trail, w.color);
      }
      // out of world
      if (p.x < -300 || p.x > this.W + 300 || p.y > this.H + 60 || p.y < -4000) {
        p.dead = true;
        if (p.owner === this.player && !p.isSub) P.text(U.clamp(p.x, 60, this.W - 60), Math.min(p.y, this.H - 80), 'MISS', '#ffffff', 22);
        if (w.type === 'marker' && p.y > this.H) p.dead = true;
      }
    }

    _stepRoll(p, dt) {
      const T = this.terrain;
      p.rollT += dt;
      const nx = p.x + p.dir * p.rollSpeed * dt;
      const ny = T.surfaceY(nx, p.y - 14);
      if (ny < p.y - 13 || ny > this.H || p.rollT > 3 || nx < 5 || nx > this.W - 5) return this._impact(p, p.x, p.y, null);
      // gravity along slope
      p.rollSpeed = U.clamp(p.rollSpeed + (ny - p.y) * 8, 60, 420);
      p.x = nx;
      p.y = Math.min(ny, p.y + 20);
      p.vx = p.dir * p.rollSpeed;
      p.vy = 0;
      for (const t of this.tanks) {
        if (t.alive && t !== p.owner && Math.abs(t.x - p.x) < 26 * t.scale && Math.abs(t.y - p.y) < 30 * t.scale) return this._impact(p, p.x, p.y - 4, t);
      }
      if (Math.random() < 0.3) P.dust(p.x, p.y, this.world.terrain.top, 1);
    }

    _stepDrill(p, dt) {
      const sp = 340;
      const d = sp * dt;
      p.x += p.dx * d;
      p.y += p.dy * d;
      p.drillLeft -= d;
      p.carveT = (p.carveT || 0) - d;
      if (p.carveT <= 0) {
        p.carveT = 8;
        this.terrain.carve(p.x, p.y, 10, false);
        if (Math.random() < 0.5) P.dust(p.x, p.y, this.world.terrain.soil[0], 1);
      }
      for (const t of this.tanks) {
        if (t.alive && t !== p.owner && PH.hitTank(t, p.x, p.y)) return this._explode(p, p.x, p.y, t);
      }
      if (p.drillLeft <= 0 || p.y > this.H - 24 || p.x < 0 || p.x > this.W) return this._explode(p, p.x, p.y, null);
    }

    /** projectile touched something */
    _impact(p, x, y, tank, platform) {
      const w = p.w;
      const T = this.terrain;
      if (tank) {
        if (w.type === 'marker') return this._marker(p, x, y);
        if (w.type === 'dirt') return this._explode(p, x, y, tank);
        return this._explode(p, x, y, tank);
      }
      switch (w.type) {
        case 'bounce':
          if (p.bounces > 0 && !platform) {
            const n = T.normalAt(x, y);
            const dot = p.vx * n.x + p.vy * n.y;
            p.vx = (p.vx - 2 * dot * n.x) * 0.64;
            p.vy = (p.vy - 2 * dot * n.y) * 0.64;
            p.x = x + n.x * 5;
            p.y = y + n.y * 5;
            p.bounces--;
            p.apex = false;
            A().play('bounce');
            P.dust(x, y, this.world.terrain.top, 4);
            T.carve(x, y, 9, false);
            return;
          }
          break;
        case 'roll':
          if (!platform) {
            p.state = 'roll';
            p.dir = Math.sign(p.vx) || 1;
            p.rollSpeed = U.clamp(Math.abs(p.vx) * 0.6, 120, 280);
            p.rollT = 0;
            p.x = x;
            p.y = T.surfaceY(x, y - 10);
            A().play('thud');
            return;
          }
          break;
        case 'drill':
        case 'tunnel':
          if (!platform) {
            p.state = 'drill';
            let a = Math.atan2(p.vy, p.vx);
            if (w.type === 'tunnel') a = p.vx >= 0 ? 0.12 : Math.PI - 0.12;
            p.dx = Math.cos(a);
            p.dy = Math.sin(a);
            p.x = x;
            p.y = y;
            A().play('drill');
            return;
          }
          break;
        case 'marker':
          return this._marker(p, x, y);
        case 'mines':
          if (!platform) return this._layMine(p, x, y);
          break;
      }
      this._explode(p, x, y, null);
    }

    _split(p) {
      const w = p.w;
      const sub = this._subWeapon(w);
      const n = w.sub.n;
      const sp = Math.hypot(p.vx, p.vy);
      const base = Math.atan2(p.vy, p.vx);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * w.sub.spread;
        this._spawnProjectile(p.owner, sub, p.x, p.y, Math.cos(a) * sp * 1.05, Math.sin(a) * sp * 1.05, { dmgMult: p.dmgMult, radMult: p.radMult, isSub: true, noSelf: 0 });
      }
      P.burst(p.x, p.y, ['#fff', '#ffd35a'], 12, 150);
      A().play('small_boom');
      p.dead = true;
    }

    _rain(p) {
      const w = p.w;
      const sub = this._subWeapon(w);
      for (let i = 0; i < w.sub.n; i++) {
        this.after(i * 0.05, () => {
          this._spawnProjectile(p.owner, sub, p.x + U.rand(-w.sub.width / 2, w.sub.width / 2), p.y + U.rand(-10, 10), p.vx * 0.3 + U.rand(-30, 30), U.rand(20, 80), { dmgMult: p.dmgMult, radMult: p.radMult, isSub: true, noSelf: 0 });
        });
      }
      P.burst(p.x, p.y, [w.color, '#fff'], 20, 180);
      A().play('small_boom');
      p.dead = true;
    }

    _subWeapon(w) {
      if (w._sub) return w._sub;
      const s = w.sub;
      w._sub = {
        id: w.id + '_sub', name: w.name, icon: w.icon, cat: w.cat, type: s.type || (w.type === 'rain' ? 'ballistic' : w.type === 'split' && w.homing ? 'homing' : 'ballistic'),
        dmg: s.dmg, r: s.r, speed: 1, grav: 1, wind: w.type === 'rain' ? 0.5 : 1, count: 1, spread: 0, seq: 0, knock: 1,
        trail: w.trail === 'fire' || s.fire ? 'fire' : w.trail === 'toxic' ? 'toxic' : 'dot', color: w.color, size: Math.max(3, (w.size || 6) * 0.65),
        sprite: w.sprite === 'rocket' ? 'rocket' : null, good: [],
        burn: s.fire ? { dmg: 12, turns: 2, r: 45 } : null, poison: w.type === 'rain' && w.poison ? { dmg: 10, turns: 2, r: 36 } : null, isSub: true
      };
      return w._sub;
    }

    _layMine(p, x, y) {
      const T = this.terrain;
      const gy = T.surfaceY(x, y - 8);
      const m = { x, y: gy, owner: p.owner, w: p.w, dmgMult: p.dmgMult, radMult: p.radMult, age: 0, armT: 0.35, alive: true };
      p.dead = true;
      A().play('thud');
      // explode immediately if landing next to an enemy
      for (const t of this.tanks) {
        if (t.alive && t.team !== (p.owner && p.owner.team) && Math.abs(t.x - x) < 55 && Math.abs(t.y - gy) < 50) {
          m.armT = 0.05;
        }
      }
      this.mines.push(m);
    }

    _detonateMine(m) {
      if (!m.alive) return;
      m.alive = false;
      this._explode({ w: m.w, owner: m.owner, dmgMult: m.dmgMult, radMult: m.radMult, fromX: m.x, noProjectile: true }, m.x, m.y - 4, null);
    }

    _marker(p, x, y) {
      const w = p.w;
      p.dead = true;
      const mk = w.marker;
      const k = p.dmgMult;
      this.markers.push({ x, y, life: 1.6 });
      A().play('whistle');
      if (mk.kind === 'bombs') this._airstrike(p.owner, x, mk, k);
      else if (mk.kind === 'meteor') {
        for (let i = 0; i < mk.n; i++) {
          const off = mk.n > 1 ? (i - (mk.n - 1) / 2) * mk.spread : 0;
          this.after(0.5 + i * 0.3, () => this._spawnMeteor(x + off, mk.dmg * k, mk.r, p.owner));
        }
      } else if (mk.kind === 'lightning') {
        for (let i = 0; i < mk.n; i++) {
          this.after(0.5 + i * 0.28, () => {
            const lx = x + U.rand(-mk.spread / 2, mk.spread / 2);
            const gy = this.terrain.surfaceY(lx, 0);
            const ty = Math.min(gy, this.H - 22);
            this.bolts.push(this._makeBolt(lx + U.rand(-60, 60), this.cam.y - 40, lx, ty, '#fff27a'));
            A().play('zap');
            this.shake(6);
            this._explode({ w: { id: 'thunder_strike', dmg: mk.dmg, r: mk.r, knock: 1, good: [], color: '#fff27a' }, owner: p.owner, dmgMult: k, radMult: 1, fromX: p.fromX, noProjectile: true, flash: '#fffbd0', colors: ['#ffffff', '#fff27a', '#9cf'] }, lx, ty, null);
          });
        }
      }
    }

    _airstrike(owner, x, mk, k) {
      const dir = owner && owner.x > x ? -1 : 1;
      const drops = [];
      for (let i = 0; i < mk.n; i++) drops.push(x + (mk.n > 1 ? (i / (mk.n - 1) - 0.5) * mk.spread : 0) + U.rand(-8, 8));
      if (dir < 0) drops.reverse();
      this.drones.push({ kind: 'plane', x: x - dir * 900, y: Math.max(40, this.cam.y + 30), dir, drops, owner, dmg: mk.dmg, r: mk.r, k, t: 0 });
      A().play('rocket');
    }

    _spawnMeteor(x, dmg, r, owner) {
      const w = { id: 'meteor_fall', name: 'Meteor', type: 'ballistic', dmg, r, grav: 0, wind: 0, speed: 1, knock: 1.3, trail: 'fire', color: '#ff9a3d', size: Math.max(8, r / 5), sprite: 'meteor', good: [], count: 1 };
      x = U.clamp(x, 10, this.W - 10);
      const gy = Math.min(this.terrain.surfaceY(x, 0), this.H - 20);
      const sy = Math.min(gy - 900, this.cam.y - 150);
      const sx = x - (gy - sy) * 0.3;
      const d = Math.hypot(x - sx, gy - sy);
      this._spawnProjectile(owner, w, sx, sy, ((x - sx) / d) * 950, ((gy - sy) / d) * 950, { dmgMult: 1, noSelf: 0, isSub: true });
      A().play('whistle');
    }

    _laser(t, w, m, ang, dmgMult) {
      const a = U.rad(ang);
      const dx = Math.cos(a), dy = -Math.sin(a);
      const range = w.range || 1500;
      const big = w.id === 'ab_laser';
      let x = m.x, y = m.y;
      const hit = new Set();
      let endX = x + dx * range, endY = y + dy * range;
      for (let d = 0; d < range; d += 6) {
        x = m.x + dx * d;
        y = m.y + dy * d;
        if (x < -50 || x > this.W + 50 || y > this.H || y < -2000) { endX = x; endY = y; break; }
        for (const o of this.tanks) {
          if (o.alive && o !== t && !hit.has(o) && PH.hitTank(o, x, y)) hit.add(o);
        }
        if (this.terrain.isSolid(x, y)) {
          if (big) {
            if (d % 12 < 6) this.terrain.carve(x, y, 13, false);
          } else {
            endX = x;
            endY = y;
            this.terrain.carve(x, y, 20);
            P.sparks(x, y, w.color, 14);
            break;
          }
        }
      }
      this.beams.push({ x1: m.x, y1: m.y, x2: endX, y2: endY, life: big ? 0.8 : 0.45, max: big ? 0.8 : 0.45, color: w.color, w: w.width || 7 });
      this.lastBoom = { x: (m.x + endX) / 2, y: (m.y + endY) / 2, t: 0.8 };
      for (const o of hit) {
        const dmg = w.dmg * dmgMult;
        this._damage(o, dmg, t, { weapon: w, fromX: t.x });
        P.sparks(o.x, o.y - 16 * o.scale, w.color, 20);
        P.explosion(o.x, o.y - 16 * o.scale, 18, { colors: ['#fff', w.color] });
        if (t === this.player && o.team === 'enemy' && !o.alive) this.stats.kills += 0; // counted in kill
      }
      this.shake(big ? 10 : 5);
    }

    _makeBolt(x1, y1, x2, y2, color) {
      const pts = [x1, y1];
      const n = 10;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        pts.push(U.lerp(x1, x2, t) + U.rand(-22, 22), U.lerp(y1, y2, t) + U.rand(-10, 10));
      }
      pts.push(x2, y2);
      return { pts, life: 0.35, max: 0.35, color };
    }

    /* ==============================================================
     * Explosions & damage
     * ============================================================== */
    _explode(p, x, y, direct) {
      const w = p.w;
      p.dead = true;
      const owner = p.owner;
      const r = (w.r || 30) * (p.radMult || 1);
      const dmg = (w.dmg || 0) * (p.dmgMult || 1);
      const eid = ++this.explosionId;
      this.lastBoom = { x, y, t: 0.9 };
      const T = this.terrain;
      const soil = this.world.terrain.soil;

      if (w.type === 'dirt') {
        T.addDirt(x, y, r);
        P.dust(x, y, soil[0], 20);
        A().play('thud');
        this.shake(5);
        return;
      }
      // carve ground
      if (!w.noCarve) T.carve(x, y, w.quake ? r * 0.6 : r * 0.88);
      // visuals & audio
      const cols = p.colors || (w.burn ? ['#fff3b0', '#ffb347', '#ff5a1a', '#d62b12'] : w.freeze ? ['#ffffff', '#c9f3ff', '#7fd6ff'] : w.poison ? ['#eaffc4', '#9dff3a', '#4fd12b'] : w.glow ? ['#ffffff', w.color, U.shade(w.color, -0.3)] : null);
      const kind = w.burn ? 'fire' : w.freeze ? 'ice' : w.poison ? 'toxic' : w.id.indexOf('firecracker') === 0 ? 'cracker' : w.glow || w.chain || w.emp || w.cat === 'energy' ? 'energy' : 'he';
      const ground = T.isSolid(x, y + 4) || T.isSolid(x, y + 14) || T.isSolid(x - 8, y + 8) || T.isSolid(x + 8, y + 8);
      P.explosion(x, y, r, { colors: cols || undefined, debris: [soil[0], soil[1], this.world.terrain.top], flash: p.flash, kind, ground, energy: w.color });
      A().play(r > 34 ? 'explosion' : 'small_boom', { size: r / 40 });
      this.shake(Math.min(26, r / 5));
      if (w.id === 'nuke') {
        this._nukeFx(x, y, r);
      }
      // black hole pull
      if (w.pull) {
        for (const t of this.tanks) {
          if (!t.alive) continue;
          const d = t.x - x;
          if (Math.abs(d) < w.pull + r) t.knockVx -= Math.sign(d) * Math.min(Math.abs(d), 220) * 2.2;
        }
        P.rings.push({ x, y, r: r * 2.5, max: 5, life: 0.6, maxLife: 0.6, color: 'rgba(179,107,255,', w: 10 });
      }
      // damage tanks
      let killsHere = 0;
      const before = this.tanks.filter((t) => t.alive && t.team === 'enemy').length;
      for (const t of this.tanks) {
        if (!t.alive) continue;
        let d = PH.distToTank(t, x, y);
        if (t === direct) d = 0;
        if (d >= r) continue;
        const fall = 1 - 0.72 * Math.pow(d / r, 1.2);
        let amount = dmg * fall;
        let crit = false;
        if (t === direct && !w.isSub) {
          crit = true;
          amount *= w.crit || 1.25;
        }
        if (owner && t.team === owner.team) amount *= 0.5;
        this._damage(t, amount, owner, { crit, weapon: w, fromX: p.fromX });
        // knockback
        const kdir = Math.sign(t.x - x) || 1;
        const kb = r * 2.2 * (1 - d / r) * (w.knock || 1) * (100 / (100 + (t.stability || 50)));
        if (!w.pull) t.knockVx += kdir * kb;
        // status
        if (t.alive) {
          if (w.freeze) this._freeze(t, w.freeze);
          if (w.emp) {
            t.status.emp = w.emp;
            if (t.shield) P.text(t.x, t.y - 70, 'SHIELD DOWN', '#9cf', 20);
            t.shield = 0;
          }
          if (w.burn) t.status.burn = { dmg: Math.round(w.burn.dmg * (p.dmgMult || 1)), turns: w.burn.turns, owner };
          if (w.poison) t.status.poison = { dmg: Math.round(w.poison.dmg * (p.dmgMult || 1)), turns: w.poison.turns, owner };
        }
      }
      // lingering zones
      if (w.burn) this.zones.push({ type: 'fire', x, y: T.surfaceY(x, y - 30), r: w.burn.r * (p.radMult || 1), dmg: Math.round(w.burn.dmg * (p.dmgMult || 1) * 0.8), turns: w.burn.turns + 1, owner, t: Math.random() * 5 });
      if (w.poison) this.zones.push({ type: 'toxic', x, y: T.surfaceY(x, y - 30), r: w.poison.r * (p.radMult || 1), dmg: Math.round(w.poison.dmg * (p.dmgMult || 1) * 0.8), turns: w.poison.turns + 1, owner, t: Math.random() * 5 });
      // chain lightning
      if (w.chain) {
        let from = { x, y };
        const hit = new Set(direct ? [direct] : []);
        for (let i = 0; i < w.chain.n; i++) {
          let best = null, bd = w.chain.range;
          for (const t of this.tanks) {
            if (!t.alive || hit.has(t) || (owner && t.team === owner.team)) continue;
            const d = Math.hypot(t.x - from.x, t.y - from.y);
            if (d < bd) { bd = d; best = t; }
          }
          if (!best) break;
          hit.add(best);
          const bx = best.x, by = best.y - 18 * best.scale;
          const f = from;
          this.after(0.12 * (i + 1), () => {
            this.bolts.push(this._makeBolt(f.x, f.y, bx, by, '#fff27a'));
            A().play('zap');
            if (best.alive) this._damage(best, w.chain.dmg * (p.dmgMult || 1), owner, { weapon: w, fromX: p.fromX });
            P.sparks(bx, by, '#fff27a', 16);
          });
          from = { x: bx, y: by };
        }
      }
      // quake
      if (w.quake) {
        this.shake(24);
        for (const t of this.tanks) {
          if (!t.alive || t.falling || (owner && t.team === owner.team)) continue;
          const d = Math.abs(t.x - x);
          if (d < w.quake.range) {
            this._damage(t, w.quake.dmg * (p.dmgMult || 1) * (1 - (d / w.quake.range) * 0.5), owner, { weapon: w, fromX: p.fromX });
            P.dust(t.x, t.y, soil[0], 10);
          }
        }
      }
      // cluster submunitions
      if (w.type === 'cluster' && w.sub) {
        const sub = this._subWeapon(w);
        for (let i = 0; i < w.sub.n; i++) {
          const a = -Math.PI / 2 + U.rand(-1.1, 1.1);
          const s = w.sub.spd * U.rand(0.6, 1.15);
          this._spawnProjectile(owner, sub, x, y - 6, Math.cos(a) * s, Math.sin(a) * s, { dmgMult: p.dmgMult, radMult: p.radMult, isSub: true, noSelf: 0 });
        }
      }
      // barrels, mines, crates, decorations
      for (const b of this.barrels) {
        if (b.alive && Math.hypot(b.x - x, b.y - 12 - y) < r + 14) {
          b.alive = false;
          this.after(0.12, () => this._explode({ w: { id: 'barrel', dmg: Math.round(55 * (1 + 0.2 * this.diff)), r: 58, knock: 1.3, good: [] }, owner, dmgMult: 1, radMult: 1, fromX: b.x, noProjectile: true, colors: ['#fff3b0', '#ffb347', '#ff5a1a'] }, b.x, b.y - 12, null));
        }
      }
      for (const m of this.mines) {
        if (m.alive && Math.hypot(m.x - x, m.y - y) < r + 10) {
          m.alive = false;
          this.after(0.15, () => this._explode({ w: m.w, owner: m.owner, dmgMult: m.dmgMult, radMult: m.radMult, fromX: m.x, noProjectile: true }, m.x, m.y - 4, null));
        }
      }
      for (const c of this.crates) {
        if (c.alive && Math.hypot(c.x - x, c.y - 14 - y) < r + 16) this._collectCrate(c, owner);
      }
      this.decos = this.decos.filter((d) => {
        if (Math.hypot(d.x - x, d.y - 15 - y) < r + 12 || !T.isSolid(d.x, d.y + 1)) {
          P.dust(d.x, d.y - 10, '#6b4a2b', 5);
          return false;
        }
        return true;
      });
      // multi kill
      const after = this.tanks.filter((t) => t.alive && t.team === 'enemy').length;
      killsHere = before - after;
      if (owner === this.player && killsHere >= 2) {
        this.stats.multiKills++;
        this.after(0.3, () => this.msg('💥 MULTI-KILL x' + killsHere + '!', 'event'));
      }
    }

    _nukeFx(x, y, r) {
      this.shake(30);
      P.flashes.push({ x, y, r: r * 5, life: 0.5, max: 0.5, color: '#ffffff' });
      for (let i = 0; i < 40; i++) {
        P.add({ x: x + U.rand(-20, 20), y: y - i * 6, vx: U.rand(-20, 20), vy: U.rand(-160, -60), life: U.rand(1.5, 3), size: U.rand(20, 40), size2: U.rand(40, 80), color: U.pick(['#ffb347', '#ff7a1a', '#5a4a40', '#3b3530']), type: 'smoke', alpha: 0.7, drag: 0.96 });
      }
    }

    /** apply damage; returns damage dealt */
    _damage(t, amount, source, o) {
      if (!t.alive || amount <= 0) return 0;
      o = o || {};
      if (!o.pure) amount *= 1 - t.armor / (t.armor + 100);
      if (t.shield > 0) {
        const ab = Math.min(t.shield, amount);
        t.shield -= ab;
        amount -= ab;
        P.text(t.x, t.y - 75 * t.scale, 'BLOCKED ' + Math.round(ab), '#8fd8ff', 18);
        P.sparks(t.x, t.y - 20 * t.scale, '#8fd8ff', 12);
        if (t.shield <= 0) t.shieldTurns = 0;
      }
      amount = Math.round(amount);
      if (amount <= 0) return 0;
      t.hp -= amount;
      t.flash = 1;
      t.jolt = Math.min(1, 0.4 + amount / 120);
      if (!o.pure) P.hit(t.x + U.rand(-10, 10) * t.scale, t.y - 18 * t.scale, ['#6d6a74', '#8a8794', t.vis.body, t.vis.accent]);
      t.lastHit = this.time;
      const col = o.color || (o.crit ? '#ffd23f' : t.team === 'player' ? '#ff6b6b' : '#ffffff');
      if (this.settings.damageNumbers !== false) {
        P.text(t.x + U.rand(-10, 10), t.y - 55 * t.scale, (o.label ? o.label + ' ' : '') + '-' + amount, col, o.crit ? 30 : 24);
        if (o.crit) P.text(t.x, t.y - 88 * t.scale, 'CRITICAL!', '#ffd23f', 22, { life: 1 });
      }
      if (o.crit) A().play('crit');
      else A().play('hit');
      if (source && source.team === 'player' && t.team === 'enemy') {
        this.stats.damage += amount;
        if (o.crit) this.stats.crits++;
        if (o.fromX != null && Math.abs(o.fromX - t.x) > 1300) this.stats.longShot = true;
      }
      if (t.team === 'player') this.stats.damageTaken += amount;
      if (t.isBoss && t.hp > 0) {
        const ph = t.bossDef.phases;
        for (let i = ph.length - 1; i > t.phaseIdx; i--) {
          if (ph[i].at && t.hp / t.maxHp <= ph[i].at) {
            if (t.pendingPhase == null || t.pendingPhase < i) {
              t.pendingPhase = i;
              this.msg('PHASE ' + (i + 1) + ': ' + (ph[i].say || ''), 'boss');
            }
            break;
          }
        }
      }
      if (t.hp <= 0) this._kill(t, source, o);
      if (this.ui.hp) this.ui.hp(this);
      return amount;
    }

    _kill(t, source, o) {
      t.hp = 0;
      t.alive = false;
      t.dying = 1.4;
      t.shield = 0;
      A().play('destroy');
      this.shake(18);
      P.explosion(t.x, t.y - 20 * t.scale, 60 * t.scale, { debris: ['#444', '#666', t.vis.body, t.vis.accent] });
      this.after(0.25, () => P.explosion(t.x + 20, t.y - 30 * t.scale, 40 * t.scale, {}));
      if (t.team === 'enemy') {
        this.stats.kills++;
        if (o && o.weapon && o.weapon.id === 'nuke' && source === this.player) this.stats.nukeKill = true;
        P.text(t.x, t.y - 100 * t.scale, 'DESTROYED!', '#ffd23f', 30, { life: 1.6 });
        if (t.split) {
          for (let i = 0; i < 2; i++) {
            this.after(0.5, () => {
              const m = this._makeEnemy(t.split, 0.8);
              m.x = U.clamp(t.x + (i ? 40 : -40), 30, this.W - 30);
              m.y = t.y - 60;
              m.falling = true;
              m.fallStart = m.y + 200;
              m.aim = t.aim;
              this.tanks.push(m);
              this.order.push(m);
              P.burst(m.x, m.y, ['#ab47bc', '#fff'], 16, 200);
            });
          }
        }
      }
    }

    _spawnCrate() {
      const x = U.rand(this.W * 0.3, this.W * 0.7);
      const kinds = ['coins', 'coins', 'repair', 'ammo', 'charge', 'blueprint'];
      const kind = U.pick(kinds);
      this.crates.push({ x, y: this.cam.y - 30, alive: true, falling: true, kind, sway: Math.random() * 6 });
      this.msg('📦 Supply drop incoming! Shoot it!', 'info');
    }

    _collectCrate(c, owner) {
      if (!c.alive) return;
      c.alive = false;
      A().play('crate');
      P.burst(c.x, c.y - 14, ['#ffd35a', '#fff', '#b07a3a'], 24, 250);
      if (!owner) return;
      if (owner === this.player) {
        this.stats.crates++;
        switch (c.kind) {
          case 'coins': {
            const v = Math.round(60 + this.level.world * 30);
            this.stats.coinsFound += v;
            P.text(c.x, c.y - 40, '+' + v + ' 🪙', '#ffd23f', 26);
            A().play('coin');
            break;
          }
          case 'repair':
            this._heal(owner, Math.round(owner.maxHp * 0.2));
            break;
          case 'ammo':
            for (const s of owner.weapons) if (s.ammo >= 0) s.ammo++;
            P.text(c.x, c.y - 40, '+1 AMMO', '#9cf', 24);
            break;
          case 'charge':
            owner.charge = owner.cd;
            P.text(c.x, c.y - 40, '⭐ SPECIAL READY', '#ffd23f', 22);
            break;
          case 'blueprint':
            this.stats.bpFound++;
            P.text(c.x, c.y - 40, '+1 📘 BLUEPRINT', '#8fd8ff', 24);
            break;
        }
      } else if (owner.alive) {
        this._heal(owner, Math.round(owner.maxHp * 0.12));
      }
    }

    /* ==============================================================
     * Tank physics
     * ============================================================== */
    _updateTilt(t, k) {
      const T = this.terrain, s = t.scale;
      const yl = T.surfaceY(t.x - 14 * s, t.y - 30), yr = T.surfaceY(t.x + 14 * s, t.y - 30);
      let target = t.tilt;
      if (Math.abs(yl - t.y) < 40 && Math.abs(yr - t.y) < 40) target = U.clamp(Math.atan2(yr - yl, 28 * s), -0.55, 0.55);
      t.tilt += (target - t.tilt) * Math.min(1, k);
    }

    _supported(t) {
      const T = this.terrain, s = t.scale;
      const y = (t.y + 1) | 0;
      return T.isSolid(t.x, y) || T.isSolid(t.x - 9 * s, y) || T.isSolid(t.x + 9 * s, y) || T.isSolid(t.x, y + 1);
    }

    _moveTank(t, dir, dt) {
      if (t.fuel <= 0) return false;
      const T = this.terrain, s = t.scale;
      const dx = dir * t.moveSpeed * dt;
      const nx = U.clamp(t.x + dx, 25, this.W - 25);
      if (nx === t.x) return false;
      // generous step height so tanks can drive up crater walls and out of holes
      const climb = (t.hover ? 34 : 28) * s;
      const ny = T.surfaceY(nx, t.y - climb);
      if (ny <= t.y - climb) return false; // wall
      if (T.isSolid(nx, ny - 22 * s)) return false; // overhang / ceiling over the new spot
      // platform (moving) block
      t.x = nx;
      if (ny - t.y <= climb * 1.4) t.y = ny;
      t.fuel -= Math.abs(dx);
      t.phase += dx * 0.6;
      if (Math.random() < 0.3) P.dust(t.x - dir * 22 * s, t.y, this.world.terrain.top, 1);
      if (Math.random() < 0.12) P.add({ x: t.x - dir * 20 * s, y: t.y - 2, vx: -dir * U.rand(30, 90), vy: U.rand(-120, -50), life: 0.6, size: U.rand(1, 2), color: this.world.terrain.soil[0], type: 'debris', grav: 700, vr: 8 });
      // tread marks pressed into the ground
      if (!t.hover && t.vis.move !== 'hover') {
        const c = T.ctx;
        c.save();
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = 'rgba(0,0,0,0.16)';
        for (const ox of [-16, 12]) {
          const mx = Math.round(t.x + ox * s);
          if (((mx >> 1) & 1) === 0) c.fillRect(mx, Math.round(t.y), 2, 3);
        }
        c.restore();
      }
      return true;
    }

    _updateTanks(dt) {
      const T = this.terrain;
      for (const t of this.tanks) {
        t.flash = Math.max(0, t.flash - dt * 5);
        t.recoil = Math.max(0, t.recoil - dt * 4);
        if (t.jolt) t.jolt = Math.max(0, t.jolt - dt * 3);
        if (t.alive && t.y < this.H) {
          const s = t.scale, back = t.x - (t.aim > 90 ? -1 : 1) * 22 * s;
          // damaged tanks smoulder, badly damaged ones burn
          const f = t.hp / t.maxHp;
          if (f < 0.5 && Math.random() < dt * (f < 0.25 ? 9 : 4)) P.add({ x: t.x + U.rand(-12, 8) * s, y: t.y - 24 * s, vx: U.rand(-8, 8), vy: U.rand(-50, -30), life: U.rand(1.2, 2), size: 4 * s, size2: 16 * s, color: f < 0.25 ? '#2c2724' : '#5e5650', type: 'smoke', alpha: 0.5, grav: -15 });
          if (f < 0.25 && Math.random() < dt * 10) P.add({ x: t.x + U.rand(-8, 8) * s, y: t.y - 22 * s, vx: U.rand(-10, 10), vy: U.rand(-60, -30), life: U.rand(0.3, 0.6), size: U.rand(3, 5) * s, size2: 1, color: U.pick(['#ffd35a', '#ff8a1a']), type: 'fire', add: true, grav: -60 });
          // idle engine exhaust
          if (t.vis.move !== 'hover' && Math.random() < dt * (t === this.active ? 3 : 0.8)) P.add({ x: back, y: t.y - 16 * s, vx: U.rand(-6, 6), vy: U.rand(-28, -14), life: U.rand(0.8, 1.4), size: 2 * s, size2: 8 * s, color: '#8d8a86', type: 'smoke', alpha: 0.3, grav: -10 });
        }
        if (!t.alive) {
          if (t.dying > 0) {
            t.dying -= dt;
            if (Math.random() < 0.5) P.add({ x: t.x + U.rand(-15, 15), y: t.y - 20, vx: U.rand(-10, 10), vy: -60, life: 1.5, size: 6, size2: 22, color: '#2c2724', type: 'smoke', alpha: 0.5, grav: -20 });
          } else if (Math.random() < 0.05) {
            P.add({ x: t.x + U.rand(-10, 10), y: t.y - 16, vx: U.rand(-8, 8), vy: -40, life: 2, size: 5, size2: 16, color: '#3b3530', type: 'smoke', alpha: 0.4, grav: -10 });
          }
        }
        // knockback slide
        if (Math.abs(t.knockVx) > 4) {
          const dir = Math.sign(t.knockVx);
          const steps = Math.ceil((Math.abs(t.knockVx) * dt) / 3);
          for (let i = 0; i < steps; i++) {
            const nx = U.clamp(t.x + dir * 3, 20, this.W - 20);
            const ny = T.surfaceY(nx, t.y - 16 * t.scale);
            if (ny <= t.y - 16 * t.scale) { t.knockVx = 0; break; }
            t.x = nx;
            if (ny - t.y < 16) t.y = ny;
          }
          t.knockVx *= Math.pow(0.86, dt * 60);
          if (Math.abs(t.knockVx) <= 4) t.knockVx = 0;
        }
        // falling
        if (!this._supported(t)) {
          if (!t.falling) {
            t.falling = true;
            t.fallStart = t.y;
            t.vy = 0;
          }
          t.vy = Math.min(900, t.vy + this.gravity * 1.2 * dt);
          const ny = t.y + t.vy * dt;
          const s = t.scale;
          const land = Math.min(T.surfaceY(t.x, t.y), T.surfaceY(t.x - 9 * s, t.y), T.surfaceY(t.x + 9 * s, t.y));
          if (ny >= land) {
            t.y = land;
            this._land(t);
          } else t.y = ny;
          if (t.y > this.H + 40) {
            t.falling = false;
            if (t.alive) {
              P.text(t.x, this.H - 120, 'FELL!', '#fff', 28);
              this._damage(t, t.hp + 9999, null, { pure: true });
            }
            t.y = this.H + 400;
          }
        } else if (t.falling) {
          this._land(t);
        }
        if (t.alive) this._updateTilt(t, dt * 8);
      }
    }

    _land(t) {
      t.falling = false;
      const dist = t.y - t.fallStart;
      t.vy = 0;
      if (dist > 70 && !t.hover && t.alive) {
        const dmg = Math.round((dist - 70) * 0.3);
        if (dmg > 0) this._damage(t, dmg, null, { pure: true, color: '#ddd' });
      }
      if (dist > 30) {
        P.dust(t.x, t.y, this.world.terrain.top, 8);
        A().play('thud');
      }
    }

    /* ==============================================================
     * Main update
     * ============================================================== */
    update(dt) {
      if (this.paused) return;
      this.time += dt;
      this.stateT -= dt;
      // timers
      if (this.timers.length) {
        const due = [];
        for (const tm of this.timers) {
          tm.t -= dt;
          if (tm.t <= 0) due.push(tm);
        }
        if (due.length) {
          this.timers = this.timers.filter((tm) => tm.t > 0);
          for (const tm of due) tm.fn();
        }
      }
      // projectiles (fixed sub-steps)
      this._acc = (this._acc || 0) + dt;
      let n = 0;
      while (this._acc >= STEP && n < 12) {
        this._acc -= STEP;
        n++;
        if (this.projectiles.length) this._updateProjectiles(STEP);
      }
      this._updateTanks(dt);
      this._updateMisc(dt);
      this._updateState(dt);
      P.wind = this.wind * PH.WIND_ACC * 1.6;
      P.update(dt, this.terrain);
      P.ambient(this.world.ambient === 'clouds' ? null : this.world.ambient, this.view, dt);
      this._updateCamera(dt);
    }

    _updateMisc(dt) {
      // platforms
      for (const pl of this.platforms) pl.x = pl.cx + Math.sin(this.time * pl.spd + pl.ph) * pl.amp;
      // mines
      for (const m of this.mines) {
        if (!m.alive) continue;
        m.armT -= dt;
        if (m.armT > 0) continue;
        for (const t of this.tanks) {
          if (t.alive && (!m.owner || t.team !== m.owner.team || m.age > 0) && Math.abs(t.x - m.x) < 34 * t.scale && Math.abs(t.y - m.y) < 40) {
            if (m.owner && t === m.owner && m.age === 0) continue;
            this._detonateMine(m);
            break;
          }
        }
      }
      this.mines = this.mines.filter((m) => m.alive);
      // crates
      for (const c of this.crates) {
        if (!c.alive || !c.falling) continue;
        c.y += 55 * dt;
        c.sway += dt;
        const gy = this.terrain.surfaceY(c.x, c.y);
        if (c.y >= gy) {
          c.y = gy;
          c.falling = false;
        }
        if (c.y > this.H) c.alive = false;
      }
      for (const c of this.crates) if (c.alive && !c.falling && !this.terrain.isSolid(c.x, c.y) && !this.terrain.isSolid(c.x, c.y + 1) && !this.terrain.isSolid(c.x, c.y + 2)) c.falling = true;
      // barrels settle
      for (const b of this.barrels) {
        if (!b.alive) continue;
        if (!this.terrain.isSolid(b.x, b.y + 1)) {
          b.vy += this.gravity * dt;
          b.y += b.vy * dt;
          const gy = this.terrain.surfaceY(b.x, b.y - b.vy * dt);
          if (b.y >= gy) { b.y = gy; b.vy = 0; }
          if (b.y > this.H) b.alive = false;
        }
      }
      // drones & planes
      for (const d of this.drones) {
        d.t += dt;
        if (d.kind === 'plane') {
          d.x += d.dir * 520 * dt;
          while (d.drops.length && (d.dir > 0 ? d.x >= d.drops[0] : d.x <= d.drops[0])) {
            const bx = d.drops.shift();
            const w = { id: 'air_bomb', name: 'Bomb', type: 'ballistic', dmg: d.dmg, r: d.r, grav: 1, wind: 0.3, speed: 1, knock: 1, trail: 'dot', color: '#ffcf4a', size: 5, sprite: 'bomb', good: [], count: 1 };
            this._spawnProjectile(d.owner, w, bx, d.y + 10, d.dir * 15, 80, { dmgMult: d.k, noSelf: 0, isSub: true });
          }
          if (!d.drops.length && Math.abs(d.x - (this.cam.x + this.view.w / 2)) > this.view.w) d.dead = true;
          if (d.t > 8) d.dead = true;
        } else if (d.kind === 'drone') {
          const tgt = d.target && d.target.alive ? d.target : this.nearestEnemy(d.owner, d.x);
          const tx = tgt ? tgt.x : d.x;
          const ty = tgt ? Math.max(60, tgt.y - 260) : 100;
          if (d.phase === 'go') {
            const dx = tx - d.x, dy = ty - d.y;
            const dist = Math.hypot(dx, dy);
            const sp = 420 * dt;
            if (dist < 14) d.phase = 'drop';
            else {
              d.x += (dx / dist) * Math.min(sp, dist);
              d.y += (dy / dist) * Math.min(sp, dist);
            }
          } else if (d.phase === 'drop') {
            d.cool -= dt;
            d.x += Math.sin(d.t * 5) * 40 * dt;
            if (d.cool <= 0 && d.drops > 0) {
              d.cool = 0.3;
              d.drops--;
              this._spawnProjectile(d.owner, GT.Weapons.get('ab_bomb'), d.x + U.rand(-12, 12), d.y + 8, U.rand(-20, 20), 40, { dmgMult: d.dmg, noSelf: 0, isSub: true });
              A().play('thud');
            }
            if (d.drops <= 0 && d.cool <= 0) d.phase = 'leave';
          } else {
            d.y -= 400 * dt;
            if (d.y < this.cam.y - 200) d.dead = true;
          }
          if (d.t > 10) d.dead = true;
        }
      }
      this.drones = this.drones.filter((d) => !d.dead);
      // visuals
      for (const b of this.beams) b.life -= dt;
      this.beams = this.beams.filter((b) => b.life > 0);
      for (const b of this.bolts) b.life -= dt;
      this.bolts = this.bolts.filter((b) => b.life > 0);
      for (const m of this.markers) m.life -= dt;
      this.markers = this.markers.filter((m) => m.life > 0);
      for (const z of this.zones) {
        z.t += dt;
        if (Math.random() < dt * (z.type === 'fire' ? 18 : 10) * (P.quality)) {
          const x = z.x + U.rand(-z.r, z.r) * 0.9;
          const y = this.terrain.surfaceY(x, z.y - 40);
          if (y < this.H) {
            if (z.type === 'fire') P.add({ x, y: y - 2, vx: U.rand(-10, 10), vy: U.rand(-80, -30), life: U.rand(0.3, 0.7), size: U.rand(4, 9), size2: 1, color: U.pick(['#ffd35a', '#ff7a1a', '#ff4d1a']), type: 'fire', add: true, grav: -60 });
            else P.add({ x, y: y - 4, vx: U.rand(-8, 8), vy: U.rand(-30, -10), life: U.rand(0.8, 1.6), size: U.rand(6, 10), size2: U.rand(14, 22), color: U.pick(['#8cff4a', '#5fd12b', '#b7ff6a']), type: 'smoke', alpha: 0.35, grav: -10 });
          }
        }
      }
      if (this.lastBoom) {
        this.lastBoom.t -= dt;
        if (this.lastBoom.t <= 0) this.lastBoom = null;
      }
    }

    _updateState(dt) {
      const t = this.active;
      switch (this.state) {
        case 'intro':
          if (this.stateT <= 0) {
            this.state = 'idle';
            this.newRound();
          }
          break;
        case 'aim':
          if (this.moveDir && t === this.player) {
            const moved = this._moveTank(t, this.moveDir, dt);
            A().engine(moved);
          } else A().engine(false);
          break;
        case 'frozen':
          if (this.stateT <= 0) this.endTurn();
          break;
        case 'ai_start':
          if (this.stateT <= 0) {
            if (t.isBoss && t.pendingPhase != null) {
              this._bossPhase(t);
              this._waitResolve(() => {
                if (t.alive && this.player.alive) {
                  this.active = t;
                  this.state = 'ai_start';
                  this.stateT = 0.3;
                } else this.endTurn();
              });
              return;
            }
            // support abilities
            if ((t.ability === 'shield' || t.ability === 'heal_ally') && t.charge >= t.cd && t.status.emp <= 0) {
              const allies = this.alliesOf(t);
              const hurt = allies.some((o) => o.hp < o.maxHp * 0.75);
              if (t.ability === 'heal_ally' && hurt) {
                t.charge = 0;
                this._selfAbility(t, 'heal_ally');
              } else if (t.ability === 'shield') {
                t.charge = 0;
                const tgt = allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || t;
                tgt.shield = Math.round(tgt.maxHp * 0.25);
                tgt.shieldTurns = 2;
                this.beams.push({ x1: t.x, y1: t.y - 25, x2: tgt.x, y2: tgt.y - 20, life: 0.5, max: 0.5, color: '#8fd8ff', w: 5 });
                A().play('shield');
              }
            }
            const mx = GT.AI.decideMove(this, t);
            this.aiMoveTarget = mx == null ? null : U.clamp(mx, 30, this.W - 30);
            this.state = 'ai_move';
            this.stateT = 3;
          }
          break;
        case 'ai_move': {
          const tx = this.aiMoveTarget;
          let moving = false;
          if (tx != null && Math.abs(tx - t.x) > 4 && this.stateT > 0) {
            moving = this._moveTank(t, Math.sign(tx - t.x), dt);
          }
          A().engine(moving);
          if (!moving && !t.falling) {
            A().engine(false);
            // kamikaze detonation
            if (t.ai === 'kamikaze' && Math.abs(this.player.x - t.x) < 110 && Math.abs(this.player.y - t.y) < 90) {
              this.msg('💣 KAMIKAZE!', 'event');
              const w = { id: 'kamikaze', dmg: 135, r: 80, knock: 1.6, good: [] };
              this.state = 'flight';
              this._explode({ w, owner: t, dmgMult: t.dmgMult * this.dmgGlobal, radMult: 1, fromX: t.x }, t.x, t.y - 15, null);
              if (t.alive) this._damage(t, t.hp + 999, null, { pure: true });
              this._waitResolve(() => this.endTurn());
              return;
            }
            this.state = 'ai_think';
            this.stateT = 0.05;
          }
          break;
        }
        case 'ai_think':
          if (this.stateT <= 0) {
            const plan = GT.AI.decideShot(this, t);
            if (!plan) {
              this.endTurn();
              return;
            }
            t.weapon = plan.weapon;
            this.aiPlan = plan;
            this.aiFrom = { aim: t.aim, power: t.power };
            this.state = 'ai_aim';
            this.stateT = 0.75;
          }
          break;
        case 'ai_aim': {
          const k = U.easeOut(1 - Math.max(0, this.stateT) / 0.75);
          t.aim = U.lerp(this.aiFrom.aim, this.aiPlan.ang, k);
          t.power = U.lerp(this.aiFrom.power, this.aiPlan.pow, k);
          if (this.stateT <= 0) {
            const slot = t.weapons[t.weapon];
            const w = GT.Weapons.get(slot.id);
            if (slot.ammo > 0) slot.ammo--;
            this._fire(t, w, this.aiPlan.ang, this.aiPlan.pow);
          }
          break;
        }
        case 'resolve':
          // safety valve: never wait forever for the battlefield to settle
          this.resolveT = (this.resolveT || 0) + dt;
          if (this.resolveT > 12) this._forceSettle();
          if (this._settled()) {
            this.settleT += dt;
            if (this.settleT > 0.45) {
              const cb = this.resolveCb;
              this.resolveCb = null;
              this.state = 'idle';
              if (cb) cb();
            }
          } else this.settleT = 0;
          break;
        case 'victory':
        case 'defeat':
          if (this.stateT <= 0 && !this.ended) {
            this.ended = true;
            if (this.ui.end) this.ui.end(this.result());
          }
          break;
      }
    }

    result() {
      const p = this.player;
      const s = this.stats;
      return {
        win: this.state === 'victory', level: this.level, tankId: p.id,
        turns: s.turns, kills: s.kills, damage: s.damage, damageTaken: s.damageTaken, crits: s.crits,
        hpPct: Math.max(0, p.hp) / p.maxHp, usedCats: Array.from(s.usedCats), usedWeapons: Array.from(s.usedWeapons),
        abilityUses: s.abilityUses, crates: s.crates, multiKills: s.multiKills, longShot: s.longShot,
        nukeKill: s.nukeKill, shots: s.shots, coinsFound: s.coinsFound, bpFound: s.bpFound, enemiesSeen: Array.from(s.enemiesSeen)
      };
    }

    /* ==============================================================
     * Camera
     * ============================================================== */
    resize(cw, ch) {
      this.cw = cw;
      this.ch = ch;
    }
    _baseScale() {
      const cw = this.cw || 1000, ch = this.ch || 700;
      if (this.cam.overview) return Math.min(cw / (this.W + 60), ch / (this.H * 0.8));
      if (ch > cw * 1.1) return Math.min(ch / 720, cw / 820); // portrait phones: zoom in a bit
      return Math.min(ch / 720, cw / 1050);
    }
    _focus() {
      const c = this.cam;
      const pr = this.projectiles.find((p) => !p.isSub) || this.projectiles[0];
      if (pr) return { x: pr.x, y: pr.y, fast: true };
      const dr = this.drones[0];
      if (dr) return { x: dr.x, y: dr.y + 150 };
      if (this.lastBoom) return { x: this.lastBoom.x, y: this.lastBoom.y };
      if (this.state === 'intro') return { x: c.fx, y: c.fy };
      const t = this.active || this.player;
      if (t && (this.state === 'aim' || this.state.startsWith('ai'))) {
        const e = this.nearestEnemy(t);
        if (e) {
          const vw = (this.cw || 1000) / this._baseScale();
          if (Math.abs(e.x - t.x) < vw * 0.75) return { x: (e.x + t.x) / 2, y: Math.min(e.y, t.y), idle: true };
          return { x: t.x + Math.sign(e.x - t.x) * vw * 0.22, y: t.y, idle: true };
        }
      }
      return t ? { x: t.x, y: t.y, idle: true } : { x: this.W / 2, y: this.H / 2, idle: true };
    }
    _snapCamera() {
      this._updateCamera(1, true);
    }
    _updateCamera(dt, snap) {
      const c = this.cam;
      const cw = this.cw || 1000, ch = this.ch || 700;
      const ts = this._baseScale();
      c.scale = snap ? ts : c.scale + (ts - c.scale) * Math.min(1, dt * 5);
      const vw = cw / c.scale, vh = ch / c.scale;
      const f = this._focus();
      // manual pan: hold-to-pan moves ~ one screen width per second
      if (c.panDir) {
        c.panX += c.panDir * vw * Math.min(dt, 0.1);
        this._clampPan();
      }
      // the pan only applies while nothing is flying (shots/drones keep the camera)
      if (f.idle && !c.overview && (c.panX || c.panY)) {
        // keep the pan inside the world so panning back responds immediately
        if (vw < this.W) c.panX = U.clamp(c.panX, vw / 2 - f.x, this.W - vw / 2 - f.x);
        else c.panX = 0;
        if (vh < this.H) c.panY = U.clamp(c.panY, vh * 0.52 - 700 - f.y, this.H - vh * 0.48 - f.y);
        else c.panY = 0;
        f.x += c.panX;
        f.y += c.panY;
        f.fast = true;
      }
      let tx, ty;
      if (vw >= this.W) tx = (this.W - vw) / 2;
      else tx = U.clamp(f.x - vw / 2, 0, this.W - vw);
      // portrait: keep the ground in the middle of the screen (controls cover the bottom)
      const portrait = ch > cw * 1.1;
      if (vh >= this.H) ty = portrait ? this.H - vh * 0.8 : this.H - vh;
      else ty = U.clamp(f.y - vh * 0.52, -700, this.H - vh);
      if (this.cam.overview) {
        tx = (this.W - vw) / 2;
        ty = portrait ? this.H - vh * 0.8 : this.H - vh;
      }
      const k = snap ? 1 : Math.min(1, dt * (f.fast ? 5 : 3));
      c.x += (tx - c.x) * k;
      c.y += (ty - c.y) * k;
      c.shake *= Math.pow(0.02, dt);
      if (c.shake < 0.3) c.shake = 0;
      this.view = { x: c.x, y: c.y, w: vw, h: vh };
    }
    screenToWorld(sx, sy) {
      return { x: this.cam.x + sx / this.cam.scale, y: this.cam.y + sy / this.cam.scale };
    }
    worldToScreen(x, y) {
      return { x: (x - this.cam.x) * this.cam.scale, y: (y - this.cam.y) * this.cam.scale };
    }

    /* ==============================================================
     * Rendering
     * ============================================================== */
    render(ctx, dpr) {
      const c = this.cam;
      const cw = this.cw, ch = this.ch;
      const t = this.time;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R.drawSky(ctx, this.world, cw, ch, t, c.x * c.scale);
      R.drawClouds(ctx, this.world, cw, ch, t, c.x * c.scale);
      const sx = c.shake ? U.rand(-c.shake, c.shake) : 0;
      const sy = c.shake ? U.rand(-c.shake, c.shake) : 0;
      // parallax layers
      for (const L of this.bg) {
        const f = L.factor;
        const ox = -c.x * f * c.scale - 400 * c.scale;
        const oy = (-c.y * (0.5 + f * 0.5)) * c.scale;
        ctx.drawImage(L.canvas, ox + sx * f, oy + sy * f, L.canvas.width * c.scale, L.canvas.height * c.scale);
      }
      // world transform
      const s = c.scale * dpr;
      ctx.setTransform(s, 0, 0, s, (-c.x * c.scale + sx) * dpr, (-c.y * c.scale + sy) * dpr);
      this._drawHazardBack(ctx);
      ctx.drawImage(this.terrain.canvas, 0, 0);
      // bedrock below the world (visible on tall portrait screens)
      if (this.view.y + this.view.h > this.H && !(this.world.hazard && this.world.hazard.type === 'void')) {
        ctx.fillStyle = this.world.terrain.soil[2];
        ctx.fillRect(-2000, this.H - 1, this.W + 4000, this.view.y + this.view.h - this.H + 40);
      }
      if (this.terrain.hasHard) ctx.drawImage(this.terrain.hardCanvas, 0, 0);
      this._drawZones(ctx);
      for (const d of this.decos) {
        const sp = d.sp;
        ctx.save();
        ctx.translate(d.x, d.y);
        if (d.flip) ctx.scale(-1, 1);
        ctx.scale(d.s, d.s);
        ctx.drawImage(sp.canvas, -sp.ax, -sp.ay, 120, 120);
        ctx.restore();
      }
      this._drawGrass(ctx);
      this._drawProps(ctx);
      // tanks
      for (const tk of this.tanks) this._drawTank(ctx, tk);
      // projectiles
      for (const p of this.projectiles) R.drawProjectile(ctx, p, t);
      for (const d of this.drones) this._drawDrone(ctx, d);
      this._drawBeams(ctx);
      P.draw(ctx);
      this._drawHazardFront(ctx);
      this._drawAimGuide(ctx);
      P.drawTexts(ctx, c.scale);
      // screen-space overlays
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R.drawForeground(ctx, this.world, cw, ch, c.x * c.scale, t);
      this._drawVignette(ctx, cw, ch);
      this._drawOffscreen(ctx);
    }

    /** swaying grass blades along the live ground surface */
    _drawGrass(ctx) {
      if (this.terrain.style !== 'grass' || P.quality < 0.5) return;
      const T = this.terrain, tops = T.tops(), m = T.mask, W = this.W;
      const t = this.time, lean = U.clamp(this.wind, -10, 10) * 0.35;
      const x0 = Math.max(0, Math.floor(this.view.x)), x1 = Math.min(W - 1, Math.ceil(this.view.x + this.view.w));
      const cols = [U.shade(this.world.terrain.top, -0.22), this.world.terrain.top, this.world.terrain.top2 || U.shade(this.world.terrain.top, 0.25)];
      const paths = [new Path2D(), new Path2D(), new Path2D()];
      const flowers = [];
      for (let x = x0 - (x0 % 3); x <= x1; x += 3) {
        const y = tops[x];
        if (y >= this.H - 26 || m[y * W + x] !== 1) continue;
        const hsh = U.hash2(x, 11);
        const h = 4 + hsh * 7;
        const sway = Math.sin(t * 2.1 + x * 0.045) * 1.4 + Math.sin(t * 3.7 + x * 0.13) * 0.5 + lean;
        const p = paths[(hsh * 3) | 0];
        p.moveTo(x - 1, y + 2);
        p.quadraticCurveTo(x + sway * 0.4, y - h * 0.55, x + sway, y - h);
        p.lineTo(x + 1, y + 2);
        if (hsh > 0.965) flowers.push(x + sway, y - h);
      }
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = cols[i];
        ctx.fill(paths[i]);
      }
      for (let i = 0; i < flowers.length; i += 2) {
        ctx.fillStyle = ['#ff5c8a', '#ffd23f', '#ffffff', '#7cc8ff'][(flowers[i] | 0) % 4];
        ctx.beginPath();
        ctx.arc(flowers[i], flowers[i + 1], 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /** subtle screen vignette for depth (gradient cached per size) */
    _drawVignette(ctx, cw, ch) {
      if (!this._vig || this._vig.w !== cw || this._vig.h !== ch) {
        const g = ctx.createRadialGradient(cw / 2, ch * 0.48, Math.min(cw, ch) * 0.35, cw / 2, ch * 0.5, Math.hypot(cw, ch) * 0.62);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,10,0.32)');
        this._vig = { w: cw, h: ch, g };
      }
      ctx.fillStyle = this._vig.g;
      ctx.fillRect(0, 0, cw, ch);
    }

    _drawHazardBack(ctx) {
      if (this.world.hazard && this.world.hazard.type === 'void') {
        const g = ctx.createLinearGradient(0, this.H - 220, 0, this.H + 200);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,0.95)');
        ctx.fillStyle = g;
        ctx.fillRect(-2000, this.H - 220, this.W + 4000, 800);
        return;
      }
      if (!this.hazardY) return;
      const hz = this.world.hazard;
      const y = this.hazardY;
      const g = ctx.createLinearGradient(0, y, 0, this.H);
      g.addColorStop(0, U.shade(hz.color, 0.2));
      g.addColorStop(1, U.shade(hz.color, -0.5));
      ctx.fillStyle = g;
      ctx.fillRect(-100, y, this.W + 200, this.H - y + 200);
    }
    _drawHazardFront(ctx) {
      if (this.world.hazard && this.world.hazard.type === 'void') {
        const t = this.time;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let x = -100; x < this.W + 200; x += 90) {
          const y = this.H - 40 + Math.sin(x * 0.02 + t) * 12;
          ctx.beginPath();
          ctx.ellipse(x + ((t * 10) % 90), y, 70, 30, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }
      if (!this.hazardY) return;
      // animated surface line on exposed hazard
      const hz = this.world.hazard;
      ctx.fillStyle = U.rgba(U.shade(hz.color, 0.4), 0.9);
      const t = this.time;
      for (let x = 0; x < this.W; x += 6) {
        if (this.terrain.isSolid(x, this.hazardY + 2)) continue;
        const h = 3 + Math.sin(x * 0.05 + t * 3) * 2;
        ctx.fillRect(x, this.hazardY - h + 2, 6, h);
      }
    }

    _drawZones(ctx) {
      for (const z of this.zones) {
        const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
        const c = z.type === 'fire' ? '255,120,30' : '120,255,60';
        g.addColorStop(0, `rgba(${c},0.35)`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(z.x, z.y, z.r, z.r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    _drawProps(ctx) {
      const t = this.time;
      for (const pl of this.platforms) {
        ctx.fillStyle = '#6f7887';
        R.rrect(ctx, pl.x - pl.w / 2, pl.y, pl.w, pl.h, 4);
        ctx.fill();
        ctx.strokeStyle = '#2a2f38';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = '#4a515e';
        for (let x = pl.x - pl.w / 2 + 10; x < pl.x + pl.w / 2 - 6; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x, pl.y + 3);
          ctx.lineTo(x + 8, pl.y + pl.h - 3);
          ctx.stroke();
        }
      }
      for (const b of this.barrels) {
        if (!b.alive) continue;
        ctx.fillStyle = '#c62828';
        R.rrect(ctx, b.x - 10, b.y - 26, 20, 26, 4);
        ctx.fill();
        ctx.strokeStyle = '#3a0d0d';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffd600';
        ctx.fillRect(b.x - 10, b.y - 18, 20, 5);
        ctx.fillStyle = '#222';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('☢', b.x, b.y - 5);
      }
      for (const m of this.mines) R.drawProjectile(ctx, { x: m.x, y: m.y, vx: 1, vy: 0, w: { sprite: 'mine', size: 6, color: '#f44' } }, t);
      for (const c of this.crates) {
        if (!c.alive) continue;
        ctx.save();
        ctx.translate(c.x, c.y);
        if (c.falling) {
          ctx.rotate(Math.sin(c.sway * 2) * 0.12);
          ctx.strokeStyle = '#eee';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-12, -26);
          ctx.lineTo(-22, -58);
          ctx.moveTo(12, -26);
          ctx.lineTo(22, -58);
          ctx.stroke();
          ctx.fillStyle = '#ff5252';
          ctx.beginPath();
          ctx.arc(0, -58, 26, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(0, -58, 26, Math.PI * 1.33, Math.PI * 1.66);
          ctx.lineTo(0, -58);
          ctx.fill();
        }
        ctx.fillStyle = '#c98a3e';
        ctx.fillRect(-13, -26, 26, 26);
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 2;
        ctx.strokeRect(-13, -26, 26, 26);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText({ coins: '$', repair: '+', ammo: '•', charge: '★', blueprint: 'B' }[c.kind] || '?', 0, -12);
        ctx.restore();
      }
      for (const m of this.markers) {
        ctx.globalAlpha = Math.min(1, m.life);
        ctx.fillStyle = '#ff2a2a';
        ctx.beginPath();
        ctx.arc(m.x, m.y - 6, 5 + Math.sin(t * 20) * 2, 0, Math.PI * 2);
        ctx.fill();
        if (Math.random() < 0.4) P.add({ x: m.x, y: m.y - 6, vx: U.rand(-10, 10), vy: -60, life: 1, size: 4, size2: 14, color: '#ff4d4d', type: 'smoke', alpha: 0.5 });
        ctx.globalAlpha = 1;
      }
    }

    _drawTank(ctx, tk) {
      if (tk.y > this.H + 100) return;
      const t = this.time;
      if (!tk.alive) {
        if (tk.dying > 1.2) return;
        // wreck
        ctx.save();
        R.drawTank(ctx, tk.vis, { x: tk.x, y: tk.y, tilt: tk.tilt + 0.1, aim: tk.aim > 90 ? 160 : 20, scale: tk.scale, t: 0, alpha: 1, dmg: 1 });
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = '#1a1614';
        ctx.beginPath();
        ctx.ellipse(tk.x, tk.y - 16 * tk.scale, 34 * tk.scale, 20 * tk.scale, tk.tilt, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      R.drawTank(ctx, tk.vis, {
        x: tk.x, y: tk.y, tilt: tk.tilt, aim: tk.aim, recoil: tk.recoil, phase: tk.phase, flash: tk.flash,
        scale: tk.scale, t, frozen: tk.status.frozen > 0, dmg: 1 - tk.hp / tk.maxHp, jolt: tk.jolt || 0
      });
      const s = tk.scale;
      // shield bubble
      if (tk.shield > 0) {
        const g = ctx.createRadialGradient(tk.x, tk.y - 18 * s, 10 * s, tk.x, tk.y - 18 * s, 46 * s);
        g.addColorStop(0, 'rgba(120,200,255,0)');
        g.addColorStop(0.8, 'rgba(120,200,255,0.25)');
        g.addColorStop(1, 'rgba(180,230,255,0.7)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(tk.x, tk.y - 18 * s, 46 * s, 36 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(200,240,255,${0.5 + 0.3 * Math.sin(t * 5)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // floating HP bar
      const bw = 56 * Math.min(1.6, s), bx = tk.x - bw / 2, by = tk.y - 62 * s - 10;
      ctx.fillStyle = 'rgba(20,16,30,0.75)';
      R.rrect(ctx, bx - 2, by - 2, bw + 4, 10, 4);
      ctx.fill();
      const f = Math.max(0, tk.hp / tk.maxHp);
      ctx.fillStyle = tk.team === 'player' ? (f > 0.3 ? '#4be36b' : '#ffb03b') : f > 0.3 ? '#ff4d4d' : '#ff9a3d';
      R.rrect(ctx, bx, by, Math.max(2, bw * f), 6, 3);
      ctx.fill();
      if (tk.shield > 0) {
        ctx.fillStyle = '#8fd8ff';
        ctx.fillRect(bx, by - 4, Math.min(bw, (bw * tk.shield) / tk.maxHp), 3);
      }
      // status icons
      const icons = [];
      if (tk.status.burn) icons.push('🔥');
      if (tk.status.poison) icons.push('☠️');
      if (tk.status.frozen) icons.push('❄️');
      if (tk.status.emp) icons.push('📵');
      if (tk.status.double) icons.push('✖2');
      if (tk.status.over) icons.push('⚡');
      if (icons.length) {
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(icons.join(''), tk.x, by - 8);
      }
      if (tk.isBoss) {
        ctx.font = `900 ${14}px "Lilita One", sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.strokeText(tk.name, tk.x, by - (icons.length ? 24 : 8));
        ctx.fillStyle = '#ffd23f';
        ctx.fillText(tk.name, tk.x, by - (icons.length ? 24 : 8));
      }
      // active marker
      if (tk === this.active && !this.over) {
        const yy = by - 26 - Math.abs(Math.sin(t * 4)) * 8 - (tk.isBoss ? 14 : 0);
        ctx.fillStyle = tk.team === 'player' ? '#ffe14d' : '#ff5a5a';
        ctx.beginPath();
        ctx.moveTo(tk.x - 8, yy);
        ctx.lineTo(tk.x + 8, yy);
        ctx.lineTo(tk.x, yy + 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1d1a26';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    _drawDrone(ctx, d) {
      ctx.save();
      ctx.translate(d.x, d.y);
      if (d.kind === 'plane') {
        ctx.scale(d.dir, 1);
        ctx.fillStyle = '#5b6b7c';
        ctx.strokeStyle = '#1d1a26';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 46, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(-22, 26);
        ctx.lineTo(4, 26);
        ctx.lineTo(10, 0);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-36, -2);
        ctx.lineTo(-48, -22);
        ctx.lineTo(-38, -22);
        ctx.lineTo(-26, -4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#9cdcff';
        ctx.beginPath();
        ctx.ellipse(26, -4, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#3a3f4a';
        ctx.strokeStyle = '#1d1a26';
        ctx.lineWidth = 2;
        R.rrect(ctx, -16, -6, 32, 12, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ff3d3d';
        ctx.beginPath();
        ctx.arc(0, 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(220,220,230,0.8)';
        for (const x of [-18, 18]) {
          ctx.beginPath();
          const w = 12 * Math.abs(Math.sin(this.time * 40));
          ctx.moveTo(x - w, -9);
          ctx.lineTo(x + w, -9);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    _drawBeams(ctx) {
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.beams) {
        const k = b.life / b.max;
        ctx.strokeStyle = U.rgba(b.color, 0.5 * k);
        ctx.lineWidth = b.w * 2.4 * k + 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${k})`;
        ctx.lineWidth = b.w * 0.6 * k + 1;
        ctx.stroke();
      }
      for (const b of this.bolts) {
        const k = b.life / b.max;
        for (const [wd, a] of [[7, 0.35], [2.5, 1]]) {
          ctx.strokeStyle = wd > 3 ? U.rgba(b.color, a * k) : `rgba(255,255,255,${k})`;
          ctx.lineWidth = wd;
          ctx.beginPath();
          ctx.moveTo(b.pts[0], b.pts[1]);
          for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'butt';
    }

    _drawAimGuide(ctx) {
      if (!this.isPlayerTurn() || this.state === 'teleport') return;
      const mode = this.settings.aimGuide || 'normal';
      const p = this.player;
      const w = this.currentWeapon(p);
      const m = R.muzzle(p, p.aim);
      const a = U.rad(p.aim);
      ctx.save();
      if (mode !== 'off') {
        if (w.type === 'laser') {
          ctx.setLineDash([10, 8]);
          ctx.strokeStyle = U.rgba(w.color, 0.7);
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x + Math.cos(a) * 1400, m.y - Math.sin(a) * 1400);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const v = p.launch * (p.power / 100) * w.speed;
          const res = PH.simulate({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: -Math.sin(a) * v, g: this.gravity * w.grav, wind: 0, terrain: this.terrain, maxT: 8, collect: true, ghost: w.type === 'ghost' });
          const pts = res.path;
          const frac = mode === 'short' ? 0.4 : mode === 'long' ? 1 : 0.75;
          const n = Math.floor(pts.length / 2 * frac);
          for (let i = 0; i < n; i += 3) {
            const k = 1 - i / n;
            ctx.globalAlpha = 0.25 + 0.75 * k;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pts[i * 2], pts[i * 2 + 1], 2.6 + k * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      // power arc around the tank
      const r = 52 * p.scale;
      const pv = R.muzzle(p, p.aim);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(pv.px, pv.py, r, -a - 0.5, -a + 0.5);
      ctx.stroke();
      ctx.strokeStyle = p.power > 80 ? '#ff5a3d' : p.power > 50 ? '#ffd23f' : '#4be36b';
      ctx.beginPath();
      ctx.arc(pv.px, pv.py, r, -a - 0.5, -a - 0.5 + (p.power / 100) * 1.0);
      ctx.stroke();
      ctx.restore();
    }

    _drawOffscreen(ctx) {
      // arrows for projectiles above the view
      for (const p of this.projectiles) {
        const sp = this.worldToScreen(p.x, p.y);
        if (sp.y < 0 && sp.x > 0 && sp.x < this.cw) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.moveTo(sp.x, 6);
          ctx.lineTo(sp.x - 8, 20);
          ctx.lineTo(sp.x + 8, 20);
          ctx.fill();
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(Math.round(-sp.y / this.cam.scale) + 'm', sp.x, 33);
        }
      }
      // enemies off screen indicators
      if (this.over) return;
      for (const t of this.tanks) {
        if (!t.alive) continue;
        const sp = this.worldToScreen(t.x, t.y - 20);
        const off = sp.x < 0 ? -1 : sp.x > this.cw ? 1 : 0;
        if (!off) continue;
        const x = off < 0 ? 16 : this.cw - 16;
        const y = U.clamp(sp.y, 90, this.ch - 140);
        ctx.fillStyle = t.team === 'player' ? '#4be36b' : '#ff4d4d';
        ctx.beginPath();
        ctx.moveTo(x + off * 10, y);
        ctx.lineTo(x - off * 6, y - 10);
        ctx.lineTo(x - off * 6, y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1d1a26';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  GT.Battle = Battle;
  Battle.SUDDEN_DEATH = 30; // round in which sudden death starts

  /* ================================================================
   * Game loop manager
   * ================================================================ */
  GT.Game = {
    battle: null,
    canvas: null,
    ctx: null,
    running: false,
    _last: 0,
    _raf: 0,
    dpr: 1,
    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      window.addEventListener('resize', () => this.resize());
      this.resize();
    },
    resize() {
      if (!this.canvas) return;
      const r = this.canvas.getBoundingClientRect();
      const q = GT.Save.data && GT.Save.data.settings.quality === 'low' ? 1 : 2;
      this.dpr = Math.min(window.devicePixelRatio || 1, q);
      this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
      this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
      if (this.battle) this.battle.resize(r.width, r.height);
    },
    start(battle) {
      this.battle = battle;
      this.resize();
      battle.resize(this.canvas.getBoundingClientRect().width, this.canvas.getBoundingClientRect().height);
      battle._snapCamera();
      battle.begin();
      if (!this.running) {
        this.running = true;
        this._last = performance.now();
        this._raf = requestAnimationFrame((t) => this._loop(t));
      }
    },
    stop() {
      this.running = false;
      cancelAnimationFrame(this._raf);
      this.battle = null;
      GT.Audio.engine(false);
    },
    _loop(now) {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - this._last) / 1000));
      this._last = now;
      const b = this.battle;
      if (b) {
        try {
          b.update(dt);
          b.render(this.ctx, this.dpr);
          if (b.ui.tick) b.ui.tick(b, dt);
        } catch (e) {
          console.error('[Game] loop error', e);
        }
      }
      this._raf = requestAnimationFrame((t) => this._loop(t));
    }
  };
})();

