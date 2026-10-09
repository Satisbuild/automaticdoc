'use strict';
/* =====================================================================
   SUPER GREJS - game.js
   Selve spillet: indlæsning af baner og rum, opdatering af alt i faste
   tidsskridt, kollisioner, blokke, mønter, liv, checkpoints, timer,
   kamera, bossarena, rør/døre og målsekvens.
   UI'et får besked gennem "hooks" (onHud, onLevelClear, onGameOver ...).
   ===================================================================== */
SG.Game = (function () {
  const PH = SG.physics;
  const T = PH.T;
  const C = PH.C;
  const U = SG.util;
  const E = SG.entities;
  const TILE = PH.TILE;
  const VIEW_H = 288;

  class Game {
    constructor(hooks) {
      this.hooks = hooks || {};
      this.viewW = 512;
      this.viewH = VIEW_H;
      this.cam = { x: 0, y: 0, look: 0 };
      this.entities = [];
      this.particles = [];
      this.t = 0;
      this.paused = false;
      this.session = null;
      this.settings = { shake: true, reduceFlash: false };
      this.running = false;
    }

    /* ---------------- Session og bane ---------------- */
    startSession(charId, lives) {
      this.session = { charId, lives: lives == null ? 5 : lives, coins: 0, form: 0 };
    }

    loadLevel(id, opts) {
      opts = opts || {};
      this.levelId = id;
      this.level = SG.levels.load(id);
      // Glem alt fra den forrige bane, så intet føres med over
      this.room = null;
      this.roomName = null;
      this.entities = [];
      this.roomStates = {};
      this.time = this.level.meta.time;
      this.timeShown = Math.ceil(this.time);
      this.hurry = false;
      this.levelCoins = 0;
      this.bossStarted = false;
      this.bossLocked = false;
      this.bossDone = false;
      this.boss = null;
      this.miniBoss = null;
      this.lastBossFrac = -1;
      this.windForce = 0;
      this.controlLock = false;
      this.freezeT = 0;
      this.shakeT = 0; this.shakeAmp = 0;
      this.transition = null;
      this.ending = null;
      this.state = 'play';
      this.checkpoint = opts.checkpoint || null;
      this.bumps = new Map();
      this.crumbles = new Map();
      this.particles = [];
      const s = this.session;
      this.player = new SG.Player(this, s.charId, s.form);

      let roomName = this.level.startRoom;
      let start;
      if (this.checkpoint) { roomName = this.checkpoint.room; }
      this.switchRoom(roomName);
      if (this.checkpoint) start = { px: this.checkpoint.x, bottom: this.checkpoint.bottom };
      else {
        const st = this.room.start || { x: 2, y: 2 };
        start = { px: st.x * TILE + 2, bottom: (this.room.h - st.y) * TILE };
      }
      this.player.place(start.px, start.bottom);
      // Spring checkpoints, man allerede har nået, over
      if (this.checkpoint) this.entities.forEach(e => { if (e.kind === 'checkpoint' && e.x <= this.checkpoint.x + 8) e.on = true; });
      this.snapCamera();
      this.restoreMusic();
      this.hudDirty = true;
      this.running = true;
      this.emitHud();
    }

    get theme() { return this._theme; }

    switchRoom(name) {
      // Gem det nuværende rums tilstand, så fjender ikke genopstår
      if (this.room && this.roomName) this.roomStates[this.roomName] = { entities: this.entities, spawned: this.spawned };
      this.roomName = name;
      this.room = this.level.rooms[name];
      if (!this.room) throw new Error('Ukendt rum ' + name);
      const meta = this.level.meta;
      this._theme = SG.art.themeFor(this.room.theme || meta.theme, this.room.theme ? false : !!meta.fort);
      const saved = this.roomStates[name];
      if (saved) { this.entities = saved.entities; this.spawned = saved.spawned; }
      else { this.entities = []; this.spawned = new Uint8Array(this.room.spawns.length); }
      this.entities = this.entities.filter(e => e.kind !== 'proj' && e.kind !== 'hazard' && e.kind !== 'fx');
      this.particles = [];
      if (this.player) this.player.platform = null;
      this.cam.look = 0;
    }

    snapCamera() {
      const p = this.player;
      this.cam.x = U.clamp(p.cx - this.viewW * 0.42, 0, Math.max(0, this.room.w * TILE - this.viewW));
      this.cam.y = this.camTargetY();
      this.spawnNearby(true);
    }

    camTargetY() {
      const rh = this.room.h * TILE;
      if (rh <= this.viewH) return rh - this.viewH;
      return U.clamp(this.player.cy - this.viewH * 0.55, 0, rh - this.viewH);
    }

    setView(w) {
      this.viewW = w;
    }

    /* ---------------- Hjælpere til entities ---------------- */
    add(e) { if (e) this.entities.push(e); return e; }
    onScreen(e, m) {
      m = m || 0;
      return e.x + e.w > this.cam.x - m && e.x < this.cam.x + this.viewW + m && e.y + e.h > this.cam.y - m && e.y < this.cam.y + this.viewH + m;
    }
    freeze(t) { this.freezeT = Math.max(this.freezeT, t); }
    shake(a, t) { if (!this.settings.shake) return; this.shakeAmp = Math.max(this.shakeAmp, a); this.shakeT = Math.max(this.shakeT, t); }
    burst(x, y, color, n, type) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = U.rand(40, 140);
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, g: type === 'shard' ? 700 : 200, life: U.rand(0.3, 0.6), max: 0.6, size: type === 'shard' ? 3 : 2, color, type: type || 'sq', rot: Math.random() * 6 });
      }
    }
    puff(x, y, color, n) {
      for (let i = 0; i < n; i++) this.particles.push({ x: x + U.rand(-3, 3), y: y - 2, vx: U.rand(-25, 25), vy: U.rand(-35, -10), g: 0, life: U.rand(0.25, 0.45), max: 0.45, size: U.rand(2, 4), color, type: 'puff' });
    }
    text(x, y, str, color) {
      this.particles.push({ x, y, vx: 0, vy: -40, g: 0, life: 0.8, max: 0.8, size: 8, color: color || '#ffffff', type: 'text', str });
    }
    toastHud(msg) { if (this.hooks.onToast) this.hooks.onToast(msg); }
    iris(t) { /* visuel effekt styres af transition */ }
    windAt(x) {
      let f = 0;
      for (const w of this.room.wind) if (x >= w.x0 * TILE && x <= (w.x1 + 1) * TILE) f += w.force;
      return f;
    }

    /* ---------------- Hovedopdatering ---------------- */
    update(dt) {
      if (!this.running || this.paused) return;
      this.t += dt;

      if (this.transition) {
        const tr = this.transition;
        tr.t += dt;
        if (tr.phase === 'out' && tr.t >= tr.dur) { tr.phase = 'in'; tr.t = 0; tr.then(); }
        else if (tr.phase === 'in' && tr.t >= tr.dur) this.transition = null;
        if (this.transition && this.transition.phase === 'out') return;
      }

      if (this.freezeT > 0) {
        this.freezeT -= dt;
        this.player.growT = Math.max(0, this.player.growT - dt);
        this.updateParticles(dt);
        return;
      }

      this.spawnNearby(false);

      // 1) Platforme (så spilleren kan køre med dem)
      for (const e of this.entities) if (e.kind === 'platform' && !e.remove) e.update(this, dt);
      // 2) Spilleren
      this.player.update(dt);
      // 3) Alt andet
      for (let i = 0; i < this.entities.length; i++) {
        const e = this.entities[i];
        if (e.kind !== 'platform' && !e.remove) e.update(this, dt);
      }
      // 4) Kollisioner
      this.collide(dt);
      this.entities = this.entities.filter(e => !e.remove);
      // Fjender langt bag kameraet forsvinder
      if (this.room.camLock && !this.bossLocked) {
        const lim = this.cam.x - this.viewW;
        this.entities = this.entities.filter(e => !(e.kind === 'enemy' && !e.isBoss && e.x + e.w < lim));
      }

      this.updateParticles(dt);
      this.updateTiles(dt);
      this.updateArena(dt);
      this.updateBossBar();
      this.updateEnding(dt);
      this.updateTimer(dt);
      this.updateCamera(dt);
      if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmp = 0; }
      if (this.hudDirty) this.emitHud();
    }

    spawnNearby(initial) {
      const room = this.room;
      const right = this.cam.x + this.viewW + 64;
      const left = this.cam.x - (room.camLock ? 32 : 160);
      for (let i = 0; i < room.spawns.length; i++) {
        if (this.spawned[i]) continue;
        const s = room.spawns[i];
        const px = s.x * TILE;
        const always = s.type === 'goal' || s.type === 'checkpoint' || s.type === 'platform' || s.type === 'kanon' || s.type === 'stang';
        if ((px < right && px > left) || (always && px < right + 400)) {
          if (initial && s.type !== 'goal' && s.type !== 'checkpoint' && s.type !== 'platform' && px < this.player.x + 40 && px > this.player.x - 40 && (s.type === 'skramler' || s.type === 'bille')) {
            // Undgå at en fjende starter oven i spilleren
            this.spawned[i] = 1;
            continue;
          }
          this.spawned[i] = 1;
          const e = E.create(s, room);
          if (e) this.entities.push(e);
        }
      }
    }

    updateParticles(dt) {
      const ps = this.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.rot != null) p.rot += dt * 10;
      }
      if (ps.length > 400) ps.splice(0, ps.length - 400);
    }

    /* ---------------- Kollisioner ---------------- */
    collide(dt) {
      const p = this.player;
      const ents = this.entities;
      const playerActive = p.alive && p.state === 'play';
      const jumpHeld = SG.input.down('jump');

      for (const e of ents) {
        if (e.remove) continue;
        if (e.kind === 'proj') {
          for (const t of ents) {
            if (t.kind !== 'enemy' || t.dead || t.remove) continue;
            if (!U.overlap(e, t)) continue;
            if (t.isBoss) t.hit(this, t.def.fireDmg || 0.34, 'fire');
            else if (!t.fireproof) t.kill(this, 'fire');
            e.pop(this);
            break;
          }
          continue;
        }
        if (!playerActive) continue;

        if (e.kind === 'item') {
          if (e.emerge <= 0 && U.overlap(p, e)) { e.remove = true; SG.powerups.collect(this, p, e.item); }
        } else if (e.kind === 'enemy') {
          this.collideEnemy(p, e, dt, jumpHeld);
        } else if (e.kind === 'hazard') {
          if (e.harmful && U.overlap(p, e)) p.hurt();
        } else if (e.kind === 'platform') {
          if (e.hurtsPlayer && e.hurtsPlayer(p)) p.hurt();
        } else if (e.kind === 'spring') {
          if (p.vy > 0 && p.bottom - p.vy * dt <= e.y + 5 && p.x + p.w > e.x + 1 && p.x < e.x + e.w - 1 && p.bottom >= e.y) {
            p.y = e.y - p.h;
            p.vy = -(jumpHeld ? 560 : 400);
            p.springBoost = true;
            p.jumping = true;
            p.onGround = false;
            e.compress = 1;
            SG.audio.sfx('spring');
          }
        } else if (e.kind === 'goal') {
          // Hele stolpens søjle tæller - også hvis man hopper over toppen
          if (p.x + p.w >= e.x && p.x <= e.x + e.w && p.bottom <= e.base + 2) this.startGoal(e);
        } else if (e.kind === 'crystal') {
          if (U.overlap(p, e)) this.startVictory(e);
        }
      }

      // Fjender vender, når de går ind i hinanden
      for (let i = 0; i < ents.length; i++) {
        const a = ents[i];
        if (a.kind !== 'enemy' || a.dead || !a.onGround || a.isBoss || !(a instanceof E.Skramler || (a instanceof E.Bille && a.state === 'walk'))) continue;
        for (let j = i + 1; j < ents.length; j++) {
          const b = ents[j];
          if (b.kind !== 'enemy' || b.dead || !b.onGround || b.isBoss || !(b instanceof E.Skramler || (b instanceof E.Bille && b.state === 'walk'))) continue;
          if (U.overlap(a, b)) {
            if (a.cx < b.cx) { a.dir = -1; b.dir = 1; } else { a.dir = 1; b.dir = -1; }
          }
        }
      }
    }

    collideEnemy(p, e, dt, jumpHeld) {
      if (e.dead) return;
      const isShell = e instanceof E.Bille && e.state === 'shell';
      const hits = e.hurtsPlayer ? e.hurtsPlayer(p) : U.overlap(p, e);
      if (!hits) return;
      if (p.star > 0 && !e.starproof) {
        if (e.isBoss) e.hit(this, 1, 'star'); else e.kill(this, 'star');
        return;
      }
      const fromAbove = p.vy > 0 && p.bottom - p.vy * dt <= e.y + 6;
      const bounce = () => {
        p.vy = -(jumpHeld ? C.STOMP_BOUNCE_HELD : C.STOMP_BOUNCE);
        p.jumping = true;
        p.onGround = false;
        p.y = Math.min(p.y, e.y - p.h);
      };
      if (isShell) {
        if (fromAbove) bounce();
        e.kick(this, p.cx);
        return;
      }
      if (fromAbove && e.stompable) {
        if (e.isBoss) {
          if (e.spiky) { p.hurt(); return; }
          if (e.hit(this, 1, 'stomp')) bounce();
          else bounce();
          return;
        }
        if (e instanceof E.Bille) {
          e.toShell();
          SG.audio.sfx('stomp');
          this.burst(e.cx, e.y, '#ffffff', 6, 'spark');
        } else {
          e.kill(this, 'stomp');
        }
        bounce();
        return;
      }
      if (!e.harmful) return;
      if (e instanceof E.Bille && e.state === 'spin' && e.kickGrace > 0) return;
      p.hurt();
    }

    /* ---------------- Blokke ---------------- */
    bumpTile(tx, ty, by, player) {
      const room = this.room;
      const code = PH.tileAt(room, tx, ty);
      if (tx < 0 || tx >= room.w || ty < 0 || ty >= room.h) return;
      const idx = ty * room.w + tx;
      let content = room.contents.get(idx);
      const pl = player || this.player;
      const topY = ty * TILE;
      let bumped = false;

      if (code === T.QBLOCK || code === T.HIDDEN) {
        content = content || 'coin';
        this.giveContent(content, tx, ty, pl);
        PH.setTile(room, tx, ty, T.USED);
        room.contents.delete(idx);
        bumped = true;
      } else if (code === T.BRICK) {
        if (content === 'multi' || (content && content.kind === 'multi')) {
          let c = typeof content === 'object' ? content : { kind: 'multi', left: 8, until: this.t + 5 };
          c.left--;
          this.giveContent('coin', tx, ty, pl);
          if (c.left <= 0 || this.t > c.until) { PH.setTile(room, tx, ty, T.USED); room.contents.delete(idx); }
          else room.contents.set(idx, c);
          bumped = true;
        } else if (content) {
          this.giveContent(content, tx, ty, pl);
          PH.setTile(room, tx, ty, T.USED);
          room.contents.delete(idx);
          bumped = true;
        } else if ((by === 'head' && pl.form > 0) || by === 'shell') {
          PH.setTile(room, tx, ty, T.EMPTY);
          const col = this.theme.brick;
          for (let i = 0; i < 4; i++) {
            this.particles.push({ x: tx * TILE + 4 + (i % 2) * 8, y: topY + 4 + Math.floor(i / 2) * 8, vx: (i % 2 ? 1 : -1) * U.rand(50, 90), vy: -U.rand(220, 320) + Math.floor(i / 2) * 80, g: 1200, life: 1, max: 1, size: 6, color: col, type: 'shard', rot: 0 });
          }
          SG.audio.sfx('brick');
          this.shake(1.5, 0.1);
          this.bumpAbove(tx, ty);
          return;
        } else {
          bumped = true;
          if (by === 'head') SG.audio.sfx('bump');
        }
      } else if (by === 'head') {
        SG.audio.sfx('bump');
        return;
      }
      if (bumped) {
        this.bumps.set(idx, 0.18);
        this.bumpAbove(tx, ty);
      }
    }

    // Fjender og ting oven på en blok, der bliver stødt, påvirkes
    bumpAbove(tx, ty) {
      const top = ty * TILE;
      const box = { x: tx * TILE, y: top - 6, w: TILE, h: 6 };
      for (const e of this.entities) {
        if (e.kind === 'enemy' && !e.dead && !e.isBoss && U.overlap(box, e)) e.kill(this, 'bump');
        if (e.kind === 'item' && U.overlap(box, e)) e.hop();
      }
      if (PH.tileAt(this.room, tx, ty - 1) === T.COIN) {
        PH.setTile(this.room, tx, ty - 1, T.EMPTY);
        this.add(new E.CoinPop(tx * TILE, top));
        this.addCoin(tx * TILE + 8, top - 8, true);
      }
    }

    giveContent(content, tx, ty, player) {
      const x = tx * TILE, top = ty * TILE;
      if (content === 'coin' || content === 'multi') {
        this.add(new E.CoinPop(x, top));
        this.addCoin(x + 8, top - 8, true);
        return;
      }
      const reward = SG.powerups.blockReward(content, player);
      if (reward) {
        this.add(new E.Item(x, top + TILE, reward, true));
        SG.audio.sfx('sprout');
      }
    }

    touchCrumble(tx, ty) {
      const idx = ty * this.room.w + tx;
      if (!this.crumbles.has(idx)) this.crumbles.set(idx, { tx, ty, t: 0, state: 'shake' });
    }

    updateTiles(dt) {
      for (const [k, v] of this.bumps) { const n = v - dt; if (n <= 0) this.bumps.delete(k); else this.bumps.set(k, n); }
      for (const [k, c] of this.crumbles) {
        c.t += dt;
        if (c.state === 'shake' && c.t > 0.45) {
          c.state = 'gone'; c.t = 0;
          PH.setTile(this.room, c.tx, c.ty, T.EMPTY);
          this.burst(c.tx * TILE + 8, c.ty * TILE + 8, '#c89a5a', 8, 'shard');
          SG.audio.sfx('crumble');
        } else if (c.state === 'gone' && c.t > 4) {
          const box = { x: c.tx * TILE, y: c.ty * TILE, w: TILE, h: TILE };
          if (!U.overlap(box, this.player)) {
            PH.setTile(this.room, c.tx, c.ty, T.CRUMBLE);
            this.crumbles.delete(k);
            this.puff(c.tx * TILE + 8, c.ty * TILE + 16, '#c89a5a', 4);
          }
        }
      }
    }

    /* ---------------- Mønter, liv, checkpoints ---------------- */
    addCoin(x, y, silentFx) {
      const s = this.session;
      s.coins++;
      this.levelCoins++;
      SG.audio.sfx('coin');
      if (!silentFx) this.burst(x, y, '#ffe14d', 5, 'spark');
      if (s.coins >= 100) { s.coins -= 100; this.addLife(1, x, y); }
      this.hudDirty = true;
    }
    addLife(n, x, y) {
      this.session.lives = Math.min(99, this.session.lives + n);
      SG.audio.sfx('oneup');
      this.text(x, y - 10, '1UP', '#5be37d');
      this.hudDirty = true;
    }
    reachCheckpoint(cp) {
      this.checkpoint = { room: this.roomName, x: cp.x - 2, bottom: cp.bottom };
      SG.audio.sfx('checkpoint');
      this.burst(cp.cx, cp.y + 6, '#5be37d', 14, 'spark');
      this.toastHud('Checkpoint!');
    }
    onEnemyKilled() { /* ingen point - kun feedback */ }

    /* ---------------- Død og liv ---------------- */
    onPlayerDying(cause) {
      SG.audio.music.stop();
      SG.audio.sfx('die');
      this.shake(4, 0.3);
      this.session.form = 0;
      this.state = 'dying';
      this.deathCause = cause;
      this.controlLock = true;
      this.hooks.onBossBar && this.hooks.onBossBar(null);
    }
    onPlayerDied() {
      this.session.lives--;
      this.hudDirty = true;
      this.emitHud();
      this.running = false;
      if (this.session.lives <= 0) { if (this.hooks.onGameOver) this.hooks.onGameOver(); }
      else if (this.hooks.onLifeLost) this.hooks.onLifeLost(this.checkpoint, this.deathCause);
    }

    updateTimer(dt) {
      const p = this.player;
      if (this.ending || !p.alive || p.state !== 'play' || this.bossDone) return;
      this.time -= dt;
      const shown = Math.max(0, Math.ceil(this.time));
      if (shown !== this.timeShown) { this.timeShown = shown; this.hudDirty = true; }
      if (!this.hurry && this.time <= 60) {
        this.hurry = true;
        SG.audio.sfx('warn');
        SG.audio.music.setSpeed(1.22);
        this.toastHud('Skynd dig! Under 60 sekunder tilbage');
      }
      if (this.time <= 0) { this.time = 0; p.die('time'); }
    }

    /* ---------------- Kamera ---------------- */
    updateCamera(dt) {
      const p = this.player;
      const room = this.room;
      const maxX = Math.max(0, room.w * TILE - this.viewW);
      if (this.bossLocked) {
        const a = room.arena;
        const ax0 = a.x0 * TILE, ax1 = (a.x1 + 1) * TILE;
        let target;
        if (ax1 - ax0 <= this.viewW) target = (ax0 + ax1) / 2 - this.viewW / 2;
        else target = U.clamp(p.cx - this.viewW / 2, ax0, ax1 - this.viewW);
        this.cam.x += (target - this.cam.x) * Math.min(1, dt * 4);
      } else if (p.alive) {
        this.cam.look = U.approach(this.cam.look, p.facing * 22 * Math.min(1, Math.abs(p.vx) / 60), 60 * dt);
        let target = p.cx - this.viewW * 0.42 + this.cam.look;
        if (room.camLock) target = Math.max(this.cam.x, target);
        this.cam.x += (target - this.cam.x) * Math.min(1, dt * 10);
        this.cam.x = U.clamp(this.cam.x, 0, maxX);
      }
      if (p.alive || p.state !== 'dead') {
        const ty = this.camTargetY();
        this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 6);
      }
    }

    /* ---------------- Bossarena ---------------- */
    updateArena(dt) {
      const a = this.room.arena;
      if (!a || this.bossDone) return;
      const p = this.player;
      if (!this.bossLocked && p.alive && p.x > a.x0 * TILE + 24) {
        this.bossLocked = true;
        // Luk porten bag spilleren
        for (let y = a.floor; y < this.room.h; y++) PH.setTile(this.room, a.x0 - 1, this.room.h - 1 - y, T.HARD);
        this.puff((a.x0 - 1) * TILE + 8, (this.room.h - a.floor) * TILE, '#c8c0b0', 8);
        SG.audio.sfx('slam');
        this.shake(3, 0.3);
        const bx = (a.x1 - 5) * TILE;
        this.boss = this.add(SG.bosses.create(a.boss, bx, (this.room.h - a.floor) * TILE));
        this.boss.dir = -1;
        SG.audio.music.play('boss');
        this.bossTimer = 1.2;
        if (this.hooks.onBossBar) this.hooks.onBossBar(this.boss.name, 1);
      }
      if (this.bossLocked && !this.bossStarted) {
        this.bossTimer -= dt;
        if (this.bossTimer <= 0) this.bossStarted = true;
      }
    }

    // Bossbaren følger den aktive boss eller mini-boss
    updateBossBar() {
      const b = this.boss && !this.boss.dead ? this.boss : this.miniBoss && !this.miniBoss.dead ? this.miniBoss : null;
      if (!b || !this.hooks.onBossBar) return;
      const f = Math.max(0, b.hp / b.maxHp);
      if (f !== this.lastBossFrac) { this.lastBossFrac = f; this.hooks.onBossBar(b.name, f); }
    }

    onMiniBoss(b) {
      this.miniBoss = b;
      this.lastBossFrac = -1;
      SG.audio.music.play('boss');
      this.toastHud(b.name + ' spærrer vejen!');
    }

    onBossDefeated(b) {
      if (this.hooks.onBossBar) this.hooks.onBossBar(null);
      this.entities.forEach(e => { if (e.kind === 'hazard' || e.summoned) { e.remove = true; this.burst(e.cx, e.cy, '#ffffff', 4, 'spark'); } });
      this.windForce = 0;
      if (b.mini) {
        this.miniBoss = null;
        this.add(new E.Item(b.cx - 8, b.bottom, b.drop || 'flower', false));
        this.restoreMusic();
        this.toastHud(b.name + ' er besejret!');
        return;
      }
      this.bossDone = true;
      SG.audio.music.stop();
      SG.audio.sfx('fanfare');
      const a = this.room.arena;
      const cx = ((a.x0 + a.x1 + 1) / 2) * TILE;
      this.add(new E.Crystal(cx, (this.room.h - a.floor) * TILE - 10));
      this.toastHud(b.name + ' er besejret! Tag Grejskrystallen');
    }

    /* ---------------- Rør, døre og warp ---------------- */
    travel(dest) {
      const p = this.player;
      if (dest.warp) {
        this.transition = { t: 0, dur: 0.5, phase: 'out', then: () => {
          this.running = false;
          if (this.hooks.onWarp) this.hooks.onWarp(dest.warp, this.levelInfo());
        } };
        return;
      }
      const to = dest.to;
      this.transition = {
        t: 0, dur: 0.35, phase: 'out',
        then: () => {
          this.switchRoom(to.room);
          if (to.pipe) {
            const top = (this.room.h - 1 - to.y) * TILE;
            p.emergeFrom(top, to.x * TILE + 16);
          } else {
            p.state = 'play';
            p.behind = false;
            p.place(to.x * TILE + 2, (this.room.h - to.y) * TILE);
          }
          this.snapCamera();
          this.restoreMusic();
        },
      };
    }

    restoreMusic() {
      if (!this.level) return;
      const p = this.player;
      SG.audio.music.setSpeed(this.hurry ? 1.22 : 1);
      if (p && p.star > 0) return SG.audio.music.play('star');
      if ((this.bossLocked && !this.bossDone) || (this.miniBoss && !this.miniBoss.dead)) return SG.audio.music.play('boss');
      if (this.room && this.room.music) return SG.audio.music.play(this.room.music);
      const m = this.level.meta.music || (this.level.meta.fort ? 'fort' : 'w' + this.level.world);
      SG.audio.music.play(m);
    }

    /* ---------------- Mål ---------------- */
    startGoal(goal) {
      if (this.ending) return;
      const p = this.player;
      this.ending = { kind: 'goal', goal, phase: 'slide', t: 0, high: p.y < goal.y + goal.h * 0.35 };
      p.state = 'goal';
      p.goalPose = 'fall';
      p.vx = 0; p.vy = 0;
      p.star = 0;
      p.x = goal.x - p.w + 2;
      if (p.y < goal.y - 6) p.y = goal.y - 6;
      p.facing = 1;
      this.controlLock = true;
      SG.audio.music.stop();
      SG.audio.sfx('flag');
    }

    startVictory(crystal) {
      if (this.ending) return;
      const p = this.player;
      crystal.remove = true;
      this.burst(crystal.cx, crystal.cy, '#ffd34a', 30, 'spark');
      this.ending = { kind: 'victory', phase: 'pose', t: 0 };
      p.state = 'victory';
      p.vx = 0; p.vy = 0;
      this.controlLock = true;
      SG.audio.sfx('clear');
    }

    updateEnding(dt) {
      const en = this.ending;
      if (!en) return;
      const p = this.player;
      en.t += dt;
      if (en.kind === 'victory') {
        // Land på gulvet og jubl
        p.vx = 0;
        p.vy = Math.min(p.vy + 900 * dt, 400);
        PH.move(this.room, p, dt, { semi: true });
        if (Math.random() < 0.1) this.firework();
        if (en.t > 3.2 && !en.done) { en.done = true; this.finish(); }
        return;
      }
      const g = en.goal;
      if (en.phase === 'slide') {
        p.y += 130 * dt;
        g.flagY = U.clamp((p.y - g.y) / (g.h - 20), 0, 1);
        if (p.bottom >= g.base) {
          p.y = g.base - p.h;
          en.phase = 'wait'; en.t = 0;
          p.goalPose = 'idle0';
          if (en.high) { for (let i = 0; i < 3; i++) setTimeout(() => this.firework(), i * 300); this.text(g.cx, g.y, 'SUPER!', '#ffe14d'); }
        }
      } else if (en.phase === 'wait') {
        g.flagY = Math.min(1, g.flagY + dt * 2);
        if (en.t > 0.4) { en.phase = 'walk'; en.t = 0; SG.audio.sfx('clear'); p.x += 8; }
      } else if (en.phase === 'walk') {
        p.x += 70 * dt;
        p.anim += dt;
        p.goalPose = ['run0', 'run1', 'run2', 'run3'][Math.floor(p.anim * 10) % 4];
        // Følg jorden
        p.y = g.base - p.h;
        if (p.cx >= g.hutX + 24) { en.phase = 'inside'; en.t = 0; p.hidden = true; this.puff(g.hutX + 24, g.base, '#ffffff', 6); }
      } else if (en.phase === 'inside') {
        if (en.t > 1.6 && !en.done) { en.done = true; this.finish(); }
      }
    }

    firework() {
      const x = this.cam.x + U.rand(60, this.viewW - 60), y = this.cam.y + U.rand(40, 140);
      const col = U.pick(['#ffe14d', '#ff6ad8', '#6ff3ff', '#5be37d', '#ff8a2a']);
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2;
        this.particles.push({ x, y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, g: 120, life: 0.9, max: 0.9, size: 2, color: col, type: 'spark' });
      }
      SG.audio.sfx('boom');
    }

    levelInfo() {
      return { id: this.levelId, world: this.level.world, index: this.level.index, name: this.level.meta.name, timeLeft: Math.max(0, Math.ceil(this.time)), coins: this.levelCoins };
    }

    finish() {
      this.session.form = this.player.form;
      this.running = false;
      if (this.hooks.onLevelClear) this.hooks.onLevelClear(this.levelInfo());
    }

    /* ---------------- HUD ---------------- */
    emitHud() {
      this.hudDirty = false;
      if (!this.hooks.onHud || !this.session) return;
      const p = this.player;
      this.hooks.onHud({
        lives: this.session.lives,
        coins: this.session.coins,
        time: this.timeShown,
        hurry: this.hurry,
        world: this.level ? `${this.level.world}-${this.level.index}` : '',
        power: p ? SG.powerups.hudLabel(p) : null,
        charId: this.session.charId,
      });
    }
  }

  Game.VIEW_H = VIEW_H;
  return Game;
})();
