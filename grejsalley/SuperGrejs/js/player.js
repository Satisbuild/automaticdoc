'use strict';
/* =====================================================================
   SUPER GREJS - player.js
   Spillerens styring og fysik. Alle figurer bruger præcis de samme
   værdier (SG.physics.C), så ingen figur har en fordel.
   ===================================================================== */
SG.Player = (function () {
  const PH = SG.physics;
  const C = PH.C;
  const T = PH.T;
  const U = SG.util;
  const FORM = SG.powerups.FORM;
  const TILE = PH.TILE;
  const H_SMALL = 14, H_BIG = 26;

  class Player {
    constructor(game, charId, form) {
      this.game = game;
      this.charId = charId;
      this.form = form || FORM.SMALL;
      this.w = 12;
      this.h = this.form ? H_BIG : H_SMALL;
      this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
      this.facing = 1;
      this.onGround = false;
      this.groundTile = 0;
      this.platform = null;
      this.alive = true;
      this.state = 'play';
      this.star = 0;
      this.invuln = 0;
      this.coyote = 0;
      this.buffer = 0;
      this.jumping = false;
      this.springBoost = false;
      this.duck = false;
      this.skid = false;
      this.fireCd = 0;
      this.throwT = 0;
      this.landT = 0;
      this.hurtT = 0;
      this.anim = 0;
      this.growT = 0;
      this.growFrom = 0;
      this.stateT = 0;
      this.behind = false;
      this.tintCanvas = U.makeCanvas(32, 64);
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get bottom() { return this.y + this.h; }

    place(px, bottom) {
      this.x = px;
      this.y = bottom - this.h;
      this.vx = 0; this.vy = 0;
      this.platform = null;
    }

    setForm(form, animate) {
      const bottom = this.bottom;
      const prev = this.form;
      this.form = form;
      this.h = form ? H_BIG : H_SMALL;
      if (this.duck && form) this.h = H_SMALL;
      this.y = bottom - this.h;
      if (form && !this.canStandAt(this.x)) { this.duck = true; this.h = H_SMALL; this.y = bottom - this.h; }
      if (animate) {
        this.growT = 0.6;
        this.growFrom = prev;
        this.game.freeze(0.6);
      }
      this.game.hudDirty = true;
    }

    canStandAt(x) {
      // Er der plads til stor form (stående)?
      const room = this.game.room;
      const top = this.bottom - H_BIG;
      const ty = Math.floor((top + 1) / TILE);
      const x0 = Math.floor((x + 0.5) / TILE), x1 = Math.floor((x + this.w - 0.5) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        for (let yy = ty; yy <= Math.floor((this.bottom - 1) / TILE); yy++) {
          if (PH.isSolid(PH.tileAt(room, tx, yy))) return false;
        }
      }
      return true;
    }

    setDuck(v) {
      if (v === this.duck) return;
      if (!v && this.form && !this.canStandAt(this.x)) return;
      const bottom = this.bottom;
      this.duck = v;
      this.h = this.form && !v ? H_BIG : H_SMALL;
      this.y = bottom - this.h;
    }

    hurt() {
      if (!this.alive || this.state !== 'play' || this.star > 0 || this.invuln > 0) return;
      if (this.form > FORM.SMALL) {
        this.setForm(this.form === FORM.FIRE ? FORM.BIG : FORM.SMALL, true);
        this.invuln = C.INVULN;
        this.hurtT = 0.35;
        SG.audio.sfx('powerdown');
        this.game.shake(3, 0.25);
        this.game.burst(this.cx, this.cy, '#ffffff', 10, 'spark');
      } else {
        this.die('hit');
      }
    }

    die(cause) {
      if (!this.alive) return;
      this.alive = false;
      this.state = 'dead';
      this.stateT = 0;
      this.vx = 0; this.vy = 0;
      this.star = 0;
      this.duck = false;
      this.platform = null;
      this.game.onPlayerDying(cause);
    }

    update(dt) {
      const g = this.game;
      this.anim += dt;
      this.stateT += dt;
      if (this.growT > 0) { this.growT -= dt; }
      if (this.state === 'dead') return this.updateDead(dt);
      if (this.state === 'pipe' || this.state === 'pipeOut' || this.state === 'door') return this.updateTravel(dt);
      if (this.state === 'goal' || this.state === 'victory' || this.state === 'frozen') return;

      const I = SG.input;
      const lock = g.controlLock;
      const left = !lock && I.down('left');
      const right = !lock && I.down('right');
      const run = !lock && I.down('run');
      const down = !lock && I.down('down');
      const jumpHeld = !lock && I.down('jump');

      this.invuln = Math.max(0, this.invuln - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.fireCd = Math.max(0, this.fireCd - dt);
      this.throwT = Math.max(0, this.throwT - dt);
      this.landT = Math.max(0, this.landT - dt);
      this.buffer = Math.max(0, this.buffer - dt);
      if (this.star > 0) {
        this.star -= dt;
        if (Math.random() < 0.5) g.particles.push({ x: this.x + Math.random() * this.w, y: this.y + Math.random() * this.h, vx: 0, vy: -20, g: 0, life: 0.4, max: 0.4, size: 2, color: U.pick(['#ffe14d', '#ff6ad8', '#6ff3ff', '#ffffff']), type: 'sq' });
        if (this.star <= 0) { this.star = 0; g.restoreMusic(); g.hudDirty = true; }
      }
      if (!lock && I.pressed('jump')) this.buffer = C.JUMP_BUFFER;

      // --- Duk ---
      if (down && this.onGround) this.setDuck(true);
      else if (!down && this.duck) this.setDuck(false);

      // --- Vandret bevægelse ---
      const ground = this.onGround;
      const ice = ground && this.groundTile === T.ICE;
      const k = ice ? C.ICE_FACTOR : 1;
      let dir = (right ? 1 : 0) - (left ? 1 : 0);
      if (this.duck && ground) dir = 0;
      const max = run ? C.RUN_MAX : C.WALK_MAX;
      this.skid = false;
      if (ground) {
        if (dir !== 0) {
          if (Math.sign(this.vx) === -dir && Math.abs(this.vx) > 24) {
            this.vx = U.approach(this.vx, 0, C.SKID * k * dt);
            this.skid = true;
            if (Math.random() < 0.4) g.puff(this.cx, this.bottom, '#e8e0d0', 1);
          } else if (Math.abs(this.vx) > max && Math.sign(this.vx) === dir) {
            this.vx = U.approach(this.vx, dir * max, C.DEC_RELEASE * k * dt);
          } else {
            this.vx = U.approach(this.vx, dir * max, (run ? C.ACC_RUN : C.ACC_WALK) * k * dt);
          }
          this.facing = dir;
        } else {
          this.vx = U.approach(this.vx, 0, C.DEC_RELEASE * k * (this.duck ? 0.7 : 1) * dt);
        }
      } else {
        if (dir !== 0) {
          if (Math.abs(this.vx) < max || Math.sign(this.vx) !== dir) this.vx = U.approach(this.vx, dir * max, C.AIR_ACC * dt);
          this.facing = dir;
        } else {
          this.vx = U.approach(this.vx, 0, C.AIR_DEC * dt);
        }
      }

      // --- Hop ---
      if (this.buffer > 0 && (ground || this.coyote > 0)) {
        const speedK = Math.min(1, Math.abs(this.vx) / C.RUN_MAX);
        this.vy = -(C.JUMP_V + C.JUMP_RUN_BONUS * speedK);
        this.buffer = 0;
        this.coyote = 0;
        this.jumping = true;
        this.onGround = false;
        this.platform = null;
        SG.audio.sfx('jump', this.form > 0);
      }

      // --- Tyngdekraft ---
      let grav;
      if (this.vy < 0 && ((jumpHeld && this.jumping) || this.springBoost)) grav = C.GRAV_HOLD;
      else if (this.vy < 0) grav = C.GRAV_RELEASE;
      else grav = C.GRAV_FALL;
      if (this.vy >= 0) { this.jumping = false; this.springBoost = false; }
      this.vy = Math.min(this.vy + grav * dt, C.MAX_FALL);

      // --- Kør med platform ---
      if (this.platform) {
        const p = this.platform;
        if (p.remove || this.vy < 0) this.platform = null;
        else {
          this.x += p.dx || 0;
          this.y = p.y - this.h;
          if (this.vy > 0) this.vy = 0;
        }
      }

      // --- Ydre skub: transportbånd og vind ---
      let push = 0;
      if (ground && (this.groundTile === T.CONV_L || this.groundTile === T.CONV_R)) push += (this.groundTile === T.CONV_R ? 1 : -1) * C.CONVEYOR;
      push += g.windAt(this.cx, this.cy) + (g.windForce || 0);

      // --- Flyt og kollidér ---
      const prevBottom = this.bottom;
      const wasGround = this.onGround || !!this.platform;
      const fallSpeed = this.vy;
      this.vx += push;
      const res = PH.move(g.room, this, dt, { semi: true, hidden: true, corner: true });
      if (res.wallL || res.wallR) this.vx = 0; else this.vx -= push;

      if (res.head.length) {
        let best = res.head[0], bd = Infinity;
        res.head.forEach(h => { const d = Math.abs(h[0] * TILE + 8 - this.cx); if (d < bd) { bd = d; best = h; } });
        if (best[2] === T.SPIKE_DOWN) this.hurt();
        else g.bumpTile(best[0], best[1], 'head', this);
      }

      // Platforme (oppefra)
      let onPlat = null;
      if (this.vy >= 0) {
        for (const e of g.entities) {
          if (!e.solidTop || e.remove) continue;
          if (this.x + this.w <= e.x || this.x >= e.x + e.w) continue;
          const top = e.y;
          if (prevBottom <= top - (e.dy || 0) + 3 && this.bottom >= top - 0.5) {
            this.y = top - this.h;
            this.vy = 0;
            onPlat = e;
            break;
          }
        }
      }
      this.platform = onPlat;
      this.onGround = res.landed || !!onPlat;
      this.groundTile = onPlat ? 0 : res.ground;

      if (this.onGround) {
        this.coyote = C.COYOTE;
        if (!wasGround && fallSpeed > 180) { this.landT = 0.1; g.puff(this.cx - 4, this.bottom, '#e8e0d0', 2); g.puff(this.cx + 4, this.bottom, '#e8e0d0', 2); }
      } else {
        this.coyote = Math.max(0, this.coyote - dt);
      }

      // Pigge
      if (res.landed && res.groundTiles.some(t => t[2] === T.SPIKE)) { this.hurt(); if (this.alive) this.vy = -260; }
      if (res.wallTiles.some(t => t[2] === T.SPIKE)) this.hurt();
      // Smuldreblokke
      if (res.landed) res.groundTiles.forEach(t => { if (t[2] === T.CRUMBLE) g.touchCrumble(t[0], t[1]); });

      // Kameraets venstre kant
      if (g.room.camLock && this.x < g.cam.x) { this.x = g.cam.x; if (this.vx < 0) this.vx = 0; }

      // Død ved hul eller lava
      if (this.y > g.room.h * TILE + 8) { this.die('pit'); return; }
      if (PH.inLiquid(g.room, this)) { this.die('lava'); return; }

      this.collectCoins();

      // Energikugler
      if (this.form === FORM.FIRE && !lock && I.pressed('run') && this.fireCd <= 0 && !this.duck) {
        const n = g.entities.filter(e => e.kind === 'proj' && !e.remove).length;
        if (n < 2) {
          g.add(new SG.entities.Energy(this.cx + this.facing * 6 - 4, this.y + (this.form ? 8 : 4), this.facing));
          this.fireCd = 0.22;
          this.throwT = 0.15;
          SG.audio.sfx('fire');
        }
      }

      // Rør og døre
      if (!lock && down && this.onGround) this.checkPipes();
      if (!lock && I.pressed('down') && this.onGround) this.checkDoors();
    }

    collectCoins() {
      const g = this.game;
      const x0 = Math.floor((this.x + 1) / TILE), x1 = Math.floor((this.x + this.w - 1) / TILE);
      const y0 = Math.floor((this.y + 1) / TILE), y1 = Math.floor((this.y + this.h - 1) / TILE);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (PH.tileAt(g.room, tx, ty) === T.COIN) {
          PH.setTile(g.room, tx, ty, T.EMPTY);
          g.addCoin(tx * TILE + 8, ty * TILE + 8);
        }
      }
    }

    checkPipes() {
      const g = this.game;
      for (const p of g.room.pipes) {
        const top = (g.room.h - 1 - p.y) * TILE;
        const px = p.x * TILE;
        if (Math.abs(this.bottom - top) < 1.5 && this.cx >= px + 6 && this.cx <= px + 26) {
          this.state = 'pipe';
          this.stateT = 0;
          this.vx = 0; this.vy = 0;
          this.x = px + 16 - this.w / 2;
          this.travel = p;
          this.behind = true;
          SG.audio.sfx('pipe');
          return;
        }
      }
    }

    checkDoors() {
      const g = this.game;
      for (const d of g.room.doors) {
        const dx = d.x * TILE, bottom = (g.room.h - d.y) * TILE;
        if (this.cx > dx && this.cx < dx + TILE && Math.abs(this.bottom - bottom) < 2) {
          this.state = 'door';
          this.stateT = 0;
          this.vx = 0;
          this.travel = d;
          SG.audio.sfx('door');
          g.iris(0.45);
          return;
        }
      }
    }

    // Spilleren kommer op af et rør (efter rumskift)
    emergeFrom(pipeTopPx, cx) {
      this.state = 'pipeOut';
      this.stateT = 0;
      this.behind = true;
      this.x = cx - this.w / 2;
      this.y = pipeTopPx;
      this.vx = 0; this.vy = 0;
      this.emergeTop = pipeTopPx;
      SG.audio.sfx('pipe');
    }

    updateTravel(dt) {
      const g = this.game;
      if (this.state === 'pipe') {
        this.y += 32 * dt;
        if (this.stateT > 0.75) { this.behind = false; g.travel(this.travel); }
      } else if (this.state === 'door') {
        if (this.stateT > 0.5) g.travel(this.travel);
      } else if (this.state === 'pipeOut') {
        this.y -= 32 * dt;
        if (this.bottom <= this.emergeTop) {
          this.y = this.emergeTop - this.h;
          this.state = 'play';
          this.behind = false;
          this.onGround = true;
        }
      }
    }

    updateDead(dt) {
      if (this.stateT < 0.5) return;
      if (!this.deathJump) { this.deathJump = true; this.vy = -360; }
      this.vy = Math.min(this.vy + 900 * dt, 500);
      this.y += this.vy * dt;
      if (this.stateT > 3.0 && !this.deadDone) { this.deadDone = true; this.game.onPlayerDied(); }
    }

    pose() {
      if (this.state === 'dead') return 'dead';
      if (this.state === 'victory') return Math.floor(this.anim * 3) % 2 ? 'win1' : 'win0';
      if (this.state === 'goal') return this.goalPose || 'fall';
      if (this.state === 'pipe' || this.state === 'pipeOut' || this.state === 'door') return 'idle0';
      if (this.hurtT > 0) return 'hurt';
      if (this.duck && this.form) return 'duck';
      if (!this.onGround) return this.vy < 0 ? 'jump' : 'fall';
      if (this.landT > 0) return 'land';
      if (this.skid) return 'skid';
      if (this.throwT > 0) return 'run0';
      const sp = Math.abs(this.vx);
      if (sp > 6) {
        const rate = 6 + sp / 12;
        return ['run0', 'run1', 'run2', 'run3'][Math.floor(this.anim * rate) % 4];
      }
      return Math.floor(this.anim * 1.6) % 2 ? 'idle1' : 'idle0';
    }

    draw(ctx, opts) {
      if (this.hidden) return;
      let big = this.form > 0;
      let fire = this.form === FORM.FIRE;
      if (this.growT > 0) {
        // Skift mellem gammel og ny form under forvandlingen
        const old = Math.floor(this.growT * 14) % 2 === 0;
        if (old) { big = this.growFrom > 0; fire = this.growFrom === FORM.FIRE; }
      }
      const pose = this.pose();
      const set = SG.characters.frame(this.charId, pose, big && !(this.duck && pose !== 'duck'), fire);
      let img = this.facing < 0 ? set.l : set.r;
      const w = img.width / 2, h = img.height / 2;
      let alpha = 1;
      if (this.invuln > 0 && this.state === 'play') {
        alpha = opts && opts.reduceFlash ? 0.6 : (Math.floor(this.invuln * 12) % 2 ? 0.3 : 1);
      }
      if (this.star > 0) {
        const tc = this.tintCanvas;
        if (tc.width !== img.width || tc.height !== img.height) { tc.width = img.width; tc.height = img.height; }
        const tg = tc.getContext('2d');
        tg.globalCompositeOperation = 'source-over';
        tg.clearRect(0, 0, tc.width, tc.height);
        tg.drawImage(img, 0, 0);
        tg.globalCompositeOperation = 'source-atop';
        tg.globalAlpha = 0.45;
        tg.fillStyle = ['#ffe14d', '#ff6ad8', '#6ff3ff', '#5be37d'][Math.floor(this.anim * 14) % 4];
        tg.fillRect(0, 0, tc.width, tc.height);
        tg.globalAlpha = 1;
        img = tc;
      }
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.drawImage(img, Math.round((this.cx - w / 2) * 2) / 2, Math.round((this.bottom - h + 0.5) * 2) / 2, w, h);
      ctx.restore();
    }
  }

  Player.H_SMALL = H_SMALL;
  Player.H_BIG = H_BIG;
  return Player;
})();
