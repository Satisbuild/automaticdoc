'use strict';
/* =====================================================================
   SUPER GREJS - entities.js
   Fjender, platforme, genstande og projektiler.
   Alle har update(game, dt) og draw(ctx, game). Positioner er i
   spil-enheder (16 pr. tile), x/y er øverste venstre hjørne af hitboxen.
   ===================================================================== */
SG.entities = (function () {
  const PH = SG.physics;
  const A = SG.art;
  const U = SG.util;
  const TILE = PH.TILE;
  const ENEMY_G = 1500, ENEMY_MAXFALL = 440;

  // Tegn en art-sprite (dobbelt opløsning) med bunden centreret.
  function blit(ctx, img, cx, bottom, opts) {
    const w = img.width / A.R, h = img.height / A.R;
    if (opts && (opts.flipY || opts.alpha != null || opts.rot)) {
      ctx.save();
      if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
      ctx.translate(cx, bottom - h / 2);
      if (opts.rot) ctx.rotate(opts.rot);
      if (opts.flipY) ctx.scale(1, -1);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }
    ctx.drawImage(img, Math.round((cx - w / 2) * 2) / 2, Math.round((bottom - h) * 2) / 2, w, h);
  }

  /* =================================================================
     BASIS
     ================================================================= */
  class Ent {
    constructor(x, y, w, h) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.vx = 0; this.vy = 0;
      this.dir = -1;
      this.t = 0;
      this.kind = 'misc';
      this.dead = false;
      this.remove = false;
      this.onGround = false;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get bottom() { return this.y + this.h; }
    gravity(dt, g, max) { this.vy = Math.min(this.vy + (g || ENEMY_G) * dt, max || ENEMY_MAXFALL); }
    move(game, dt, opts) {
      const r = PH.move(game.room, this, dt, opts);
      this.onGround = r.landed;
      return r;
    }
    update() {}
    draw() {}
  }

  class Enemy extends Ent {
    constructor(x, y, w, h) {
      super(x, y, w, h);
      this.kind = 'enemy';
      this.stompable = true;
      this.harmful = true;
      this.fireproof = false;
      this.starproof = false;
      this.flipped = false;
      this.squashed = false;
      this.deadT = 0;
    }
    // how: 'stomp' | 'fire' | 'star' | 'shell' | 'bump' | 'lava'
    kill(game, how) {
      if (this.dead) return;
      this.dead = true;
      this.harmful = false;
      if (how === 'stomp') {
        this.squashed = true;
        SG.audio.sfx('stomp');
      } else {
        this.flipped = true;
        this.vy = -230;
        this.vx = (game.player && game.player.cx < this.cx ? 1 : -1) * 50;
        SG.audio.sfx(how === 'fire' ? 'kick' : 'stomp');
      }
      game.burst(this.cx, this.cy, '#ffffff', 8, 'spark');
      game.onEnemyKilled(this, how);
    }
    updateDead(game, dt) {
      this.deadT += dt;
      if (this.squashed) {
        if (this.deadT > 0.5) this.remove = true;
        return;
      }
      this.vy = Math.min(this.vy + 1300 * dt, 500);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > game.room.h * TILE + 64) this.remove = true;
    }
    // Simpel gang: vend ved vægge (og kanter, hvis edge=true)
    walk(game, dt, speed, edge) {
      this.vx = this.dir * speed;
      this.gravity(dt);
      const r = this.move(game, dt);
      if (r.wallL) this.dir = 1;
      if (r.wallR) this.dir = -1;
      if (edge && this.onGround && !PH.groundAhead(game.room, this, this.dir)) this.dir *= -1;
      if (this.y > game.room.h * TILE + 32) this.remove = true;
      if (PH.inLiquid(game.room, this)) this.kill(game, 'lava');
      return r;
    }
  }

  /* =================================================================
     FJENDER
     ================================================================= */
  // Småskramler - går frem og tilbage. Variant 'edge' vender ved kanter.
  class Skramler extends Enemy {
    constructor(x, y, p) {
      super(x + 1, y - 14, 14, 14);
      this.edge = !!p.edge;
      this.dir = p.dir || -1;
      this.speed = p.speed || 34;
    }
    update(game, dt) {
      this.t += dt;
      if (this.dead) return this.updateDead(game, dt);
      this.walk(game, dt, this.speed, this.edge);
    }
    draw(ctx) {
      const s = A.skramler(Math.floor(this.t * 6) % 2, this.squashed, this.edge);
      blit(ctx, this.dir > 0 ? s.r : s.l, this.cx, this.bottom + 1, this.flipped ? { flipY: true } : null);
    }
  }

  // Skjoldbille - bliver til et skjold, der kan sparkes.
  class Bille extends Enemy {
    constructor(x, y, p) {
      super(x + 1, y - 22, 14, 22);
      this.state = 'walk';
      this.edge = !!p.edge;
      this.dir = p.dir || -1;
      this.shellT = 0;
      this.kickGrace = 0;
    }
    toShell() {
      if (this.state === 'walk') { this.y += 8; this.h = 14; }
      this.state = 'shell';
      this.vx = 0;
      this.shellT = 0;
      this.stompable = true;
      this.harmful = false;
    }
    kick(game, fromX) {
      this.dir = fromX < this.cx ? 1 : -1;
      this.state = 'spin';
      this.vx = this.dir * 230;
      this.kickGrace = 0.22;
      this.harmful = true;
      SG.audio.sfx('kick');
      game.burst(this.cx, this.cy, '#ffffff', 5, 'spark');
    }
    update(game, dt) {
      this.t += dt;
      if (this.dead) return this.updateDead(game, dt);
      this.kickGrace = Math.max(0, this.kickGrace - dt);
      if (this.state === 'walk') {
        this.walk(game, dt, 30, this.edge);
      } else if (this.state === 'shell') {
        this.shellT += dt;
        this.vx = 0;
        this.gravity(dt);
        this.move(game, dt);
        if (this.shellT > 8.5) {
          this.state = 'walk';
          this.y -= 8; this.h = 22;
          this.harmful = true;
        }
      } else {
        this.vx = this.dir * 230;
        this.gravity(dt);
        const r = this.move(game, dt);
        if (r.wallL || r.wallR) {
          r.wallTiles.forEach(([tx, ty]) => game.bumpTile(tx, ty, 'shell'));
          this.dir = r.wallL ? 1 : -1;
          SG.audio.sfx('bump');
        }
        // Skjoldet vælter andre fjender
        game.entities.forEach(e => {
          if (e !== this && e.kind === 'enemy' && !e.dead && U.overlap(this, e)) {
            if (e instanceof Bille && e.state === 'spin') { e.kill(game, 'shell'); this.kill(game, 'shell'); }
            else if (!e.isBoss) e.kill(game, 'shell');
          }
        });
        if (this.y > game.room.h * TILE + 32) this.remove = true;
        if (PH.inLiquid(game.room, this)) this.kill(game, 'lava');
      }
    }
    draw(ctx) {
      const shell = this.state !== 'walk' || this.flipped;
      const wob = this.state === 'shell' && this.shellT > 6.5 && Math.floor(this.t * 14) % 2 === 0;
      const s = A.bille(Math.floor(this.t * 6) % 2, shell, wob);
      blit(ctx, this.dir > 0 ? s.r : s.l, this.cx + (wob ? 1 : 0), this.bottom + 1, this.flipped ? { flipY: true } : null);
    }
  }

  // Rørgnasker - dukker op af et rør med faste mellemrum.
  class Gnasker extends Enemy {
    constructor(x, y, p) {
      super(x + 9, y - 22, 14, 22);
      this.px = x + 16;          // rørets midte
      this.base = y;             // rørets top
      this.rise = 0;
      this.phase = 'down';
      this.timer = 1.2 + (p.delay || 0);
      this.stompable = false;
      this.behind = true;
    }
    update(game, dt) {
      this.t += dt;
      if (this.dead) return this.updateDead(game, dt);
      this.timer -= dt;
      const p = game.player;
      const near = p && Math.abs(p.cx - this.px) < 30 && p.bottom <= this.base + 2;
      if (this.phase === 'down' && this.timer <= 0 && !near) { this.phase = 'up'; this.timer = 0.55; }
      else if (this.phase === 'up') { this.rise = Math.min(1, this.rise + dt / 0.55); if (this.timer <= 0) { this.phase = 'top'; this.timer = 1.3; } }
      else if (this.phase === 'top' && this.timer <= 0) { this.phase = 'lower'; this.timer = 0.55; }
      else if (this.phase === 'lower') { this.rise = Math.max(0, this.rise - dt / 0.55); if (this.timer <= 0) { this.phase = 'down'; this.timer = 1.6; } }
      const vis = 24 * this.rise;
      this.y = this.base - vis + 2;
      this.h = Math.max(0, vis - 2);
      this.harmful = this.rise > 0.2;
    }
    draw(ctx) {
      if (this.rise <= 0 && !this.dead) return;
      const s = A.gnasker(Math.floor(this.t * 5) % 2);
      if (this.flipped) return blit(ctx, s.r, this.cx, this.y + 24, { flipY: true });
      blit(ctx, s.r, this.px, this.base + 24 * (1 - this.rise));
    }
  }

  // Luftdrøne - flyver i et fast mønster.
  class Drone extends Enemy {
    constructor(x, y, p) {
      super(x + 1, y - 14, 14, 12);
      this.x0 = this.x; this.y0 = this.y;
      this.mode = p.mode || 'h';
      this.range = (p.range || 3) * TILE;
      this.speed = p.speed || 1.4;
      this.t = p.phase || 0;
    }
    update(game, dt) {
      this.t += dt;
      if (this.dead) return this.updateDead(game, dt);
      const s = Math.sin(this.t * this.speed);
      const ox = this.x;
      if (this.mode === 'h') { this.x = this.x0 + s * this.range; this.y = this.y0 + Math.sin(this.t * 4) * 3; }
      else if (this.mode === 'v') { this.y = this.y0 + s * this.range; }
      else { this.x = this.x0 + Math.cos(this.t * this.speed) * this.range; this.y = this.y0 + s * this.range; }
      if (this.x !== ox) this.dir = this.x > ox ? 1 : -1;
    }
    draw(ctx) {
      const s = A.drone(Math.floor(this.t * 14) % 2);
      blit(ctx, this.dir > 0 ? s.r : s.l, this.cx, this.bottom + 2, this.flipped ? { flipY: true } : null);
    }
  }

  // Gnisterobot - elektrisk felt der tænder og slukker.
  class Gnist extends Enemy {
    constructor(x, y, p) {
      super(x + 1, y - 19, 14, 19);
      this.dir = p.dir || -1;
      this.cycle = (p.phase || 0);
      this.field = 'off';
      this.radius = 22;
    }
    update(game, dt) {
      this.t += dt;
      if (this.dead) return this.updateDead(game, dt);
      this.cycle += dt;
      const c = this.cycle % 4;
      const prev = this.field;
      this.field = c < 2 ? 'off' : c < 2.6 ? 'warn' : 'on';
      if (this.field === 'on' && prev !== 'on' && game.onScreen(this)) SG.audio.sfx('zap');
      this.stompable = this.field !== 'on';
      this.walk(game, dt, this.field === 'on' ? 0 : 22, true);
    }
    hurtsPlayer(p) {
      if (U.overlap(this, p)) return true;
      if (this.field !== 'on') return false;
      const nx = U.clamp(this.cx, p.x, p.x + p.w), ny = U.clamp(this.cy, p.y, p.y + p.h);
      return (nx - this.cx) ** 2 + (ny - this.cy) ** 2 < this.radius ** 2;
    }
    draw(ctx) {
      if (!this.dead && this.field !== 'off') {
        const on = this.field === 'on';
        if (on || Math.floor(this.t * 12) % 2) {
          ctx.save();
          ctx.strokeStyle = on ? 'rgba(160,240,255,.9)' : 'rgba(160,240,255,.45)';
          ctx.lineWidth = on ? 1.5 : 1;
          ctx.beginPath();
          for (let i = 0; i <= 24; i++) {
            const a = i / 24 * Math.PI * 2;
            const r = this.radius + (on ? Math.sin(a * 5 + this.t * 30) * 2 : 0);
            const px = this.cx + Math.cos(a) * r, py = this.cy + Math.sin(a) * r;
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          ctx.stroke();
          if (on) { ctx.fillStyle = 'rgba(120,220,255,.12)'; ctx.fill(); }
          ctx.restore();
        }
      }
      const s = A.gnist(Math.floor(this.t * 5) % 2, this.field === 'on');
      blit(ctx, this.dir > 0 ? s.r : s.l, this.cx, this.bottom + 1, this.flipped ? { flipY: true } : null);
    }
  }

  // Hoppeklat - hopper mod spilleren.
  class Hopper extends Enemy {
    constructor(x, y, p) {
      super(x + 1, y - 14, 14, 14);
      this.wait = 0.6 + (p.phase || 0);
      this.power = p.power || 330;
    }
    update(game, dt) {
      this.t += dt;
      if (this.dead) return this.updateDead(game, dt);
      this.gravity(dt);
      const r = this.move(game, dt);
      if (r.wallL || r.wallR) this.vx = -this.vx;
      if (this.onGround) {
        this.vx = 0;
        this.wait -= dt;
        if (this.wait <= 0) {
          const p = game.player;
          this.dir = p && p.cx < this.cx ? -1 : 1;
          this.vy = -this.power;
          this.vx = this.dir * 55;
          this.wait = 1.1;
        }
      }
      if (this.y > game.room.h * TILE + 32) this.remove = true;
      if (PH.inLiquid(game.room, this)) this.kill(game, 'lava');
    }
    draw(ctx) {
      const s = A.hopper(this.onGround && this.wait < 0.25 ? 1 : 0);
      blit(ctx, this.dir > 0 ? s.r : s.l, this.cx, this.bottom + 1, this.flipped ? { flipY: true } : null);
    }
  }

  // Kanontårn - affyrer piggkugler. Står på en hård blok, som byggeren lægger.
  class Kanon extends Ent {
    constructor(x, y, p) {
      super(x, y - 16, 16, 16);
      this.kind = 'misc';
      this.period = p.period || 3.2;
      this.timer = (p.phase || 0) + 1;
      this.always = !!p.always;
    }
    update(game, dt) {
      const p = game.player;
      if (!p) return;
      this.timer -= dt;
      const dx = p.cx - this.cx;
      if (this.timer <= 0 && (game.onScreen(this, 24) || this.always)) {
        if (Math.abs(dx) > 26) {
          const dir = dx < 0 ? -1 : 1;
          game.add(new Kugle(this.cx - 6 + dir * 8, this.y + 2, dir));
          game.puff(this.cx + dir * 9, this.cy, '#c8c8d8', 6);
          SG.audio.sfx('shoot');
        }
        this.timer = this.period;
      }
    }
    draw(ctx) { blit(ctx, A.kanon().r, this.cx, this.bottom); }
  }

  class Kugle extends Enemy {
    constructor(x, y, dir) {
      super(x, y, 12, 12);
      this.dir = dir;
      this.vx = dir * 96;
      this.life = 9;
    }
    update(game, dt) {
      this.t += dt;
      if (this.dead) return this.updateDead(game, dt);
      this.x += this.vx * dt;
      this.life -= dt;
      if (this.life <= 0) this.remove = true;
    }
    draw(ctx) {
      blit(ctx, A.piggkugle(Math.floor(this.t * 10) % 4).r, this.cx, this.bottom + 2, this.flipped ? { flipY: true } : null);
    }
  }

  // Gløder - hopper op af lava.
  class Gloeder extends Enemy {
    constructor(x, y, p) {
      super(x + 2, y + 4, 12, 14);
      this.y0 = this.y;
      this.height = (p.h || 5) * TILE;
      this.timer = p.phase || 0;
      this.state = 'wait';
      this.stompable = false;
      this.fireproof = true;
    }
    update(game, dt) {
      this.t += dt;
      if (this.dead) return this.updateDead(game, dt);
      if (this.state === 'wait') {
        this.harmful = false;
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'jump'; this.vy = -Math.sqrt(2 * 900 * (this.height + 10)); }
      } else {
        this.harmful = true;
        this.vy += 900 * dt;
        this.y += this.vy * dt;
        if (this.vy > 0 && this.y >= this.y0) { this.y = this.y0; this.state = 'wait'; this.timer = 1.6; game.burst(this.cx, this.y0, '#ff8a2a', 5); }
      }
    }
    draw(ctx) {
      if (this.state === 'wait' && !this.dead) return;
      const s = A.gloeder(Math.floor(this.t * 10) % 3);
      blit(ctx, s.r, this.cx, this.bottom + 2, { flipY: this.vy > 0 || this.flipped });
    }
  }

  // Glødestang - roterende kæde af ildkugler omkring en blok.
  class Stang extends Enemy {
    constructor(x, y, p) {
      super(x, y - 16, 16, 16);
      this.n = p.len || 5;
      this.speed = p.speed || 1.7;
      this.a = p.angle || 0;
      this.stompable = false;
      this.fireproof = true;
      this.starproof = true;
    }
    balls() {
      const out = [];
      for (let i = 0; i < this.n; i++) out.push([this.cx + Math.cos(this.a) * i * 8, this.cy + Math.sin(this.a) * i * 8]);
      return out;
    }
    update(game, dt) { this.t += dt; this.a += this.speed * dt; }
    hurtsPlayer(p) {
      return this.balls().some(([bx, by]) => {
        const nx = U.clamp(bx, p.x, p.x + p.w), ny = U.clamp(by, p.y, p.y + p.h);
        return (nx - bx) ** 2 + (ny - by) ** 2 < 4.5 ** 2;
      });
    }
    draw(ctx) {
      const f = Math.floor(this.t * 10) % 3;
      this.balls().forEach(([bx, by], i) => {
        if (i === 0) return;
        const s = A.gloeder(f).r;
        ctx.drawImage(s, bx - 5, by - 5, 10, 10);
      });
    }
  }

  // Stempel - tungt stempel der knuser ned og løfter sig igen. Toppen kan man stå på.
  class Stempel extends Ent {
    constructor(x, y, p, room) {
      super(x + 2, y - 28, 28, 28);
      this.kind = 'platform';
      this.solidTop = true;
      this.y0 = this.y;
      this.period = p.period || 2.2;
      this.timer = (p.phase || 0) + 1;
      this.state = 'top';
      this.shake = 0;
      // Find gulvet under stemplet
      let ty = Math.floor((this.y + this.h) / TILE);
      while (ty < room.h && !PH.isSolid(PH.tileAt(room, Math.floor(this.cx / TILE), ty))) ty++;
      this.floorY = ty * TILE - this.h;
    }
    update(game, dt) {
      this.t += dt;
      const oy = this.y;
      this.timer -= dt;
      if (this.state === 'top' && this.timer <= 0) { this.state = 'warn'; this.timer = 0.45; }
      else if (this.state === 'warn') { this.shake = Math.sin(this.t * 80) * 1; if (this.timer <= 0) { this.state = 'drop'; this.vy = 0; this.shake = 0; } }
      else if (this.state === 'drop') {
        this.vy = Math.min(this.vy + 1800 * dt, 520);
        this.y += this.vy * dt;
        if (this.y >= this.floorY) {
          this.y = this.floorY; this.state = 'down'; this.timer = 0.7;
          if (game.onScreen(this, 32)) { SG.audio.sfx('slam'); game.shake(3, 0.2); }
          game.puff(this.x + 2, this.bottom, '#c8c0b0', 5); game.puff(this.x + this.w - 2, this.bottom, '#c8c0b0', 5);
        }
      } else if (this.state === 'down' && this.timer <= 0) { this.state = 'rise'; }
      else if (this.state === 'rise') {
        this.y -= 55 * dt;
        if (this.y <= this.y0) { this.y = this.y0; this.state = 'top'; this.timer = this.period; }
      }
      this.dy = this.y - oy;
      this.dx = 0;
    }
    hurtsPlayer(p) {
      if (!U.overlap(this, p)) return false;
      return p.bottom > this.y + 6;
    }
    draw(ctx) {
      const x = this.x + this.shake, y = this.y;
      // Stang op til loftet
      ctx.fillStyle = '#5a6074';
      ctx.fillRect(this.cx - 3, this.y0 - 40, 6, y - this.y0 + 40);
      ctx.fillStyle = '#8a90a8';
      ctx.fillRect(this.cx - 3, this.y0 - 40, 2, y - this.y0 + 40);
      ctx.fillStyle = A.OUT; ctx.fillRect(x - 1, y - 1, this.w + 2, this.h + 2);
      ctx.fillStyle = '#7a8096'; ctx.fillRect(x, y, this.w, this.h);
      ctx.fillStyle = '#a8b0c4'; ctx.fillRect(x, y, this.w, 3);
      ctx.fillStyle = '#4e546a'; ctx.fillRect(x, y + this.h - 6, this.w, 6);
      ctx.fillStyle = '#ffcf3a';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 2 + i * 7, y + this.h - 5, 4, 4);
      ctx.fillStyle = '#2a2236';
      ctx.fillRect(x + 6, y + 9, 5, 5); ctx.fillRect(x + this.w - 11, y + 9, 5, 5);
      if (this.state === 'warn' || this.state === 'drop') { ctx.fillStyle = '#ff4d5e'; ctx.fillRect(x + 7, y + 10, 3, 3); ctx.fillRect(x + this.w - 10, y + 10, 3, 3); }
    }
  }

  // Istap / faldsten - falder, når spilleren går under.
  class Istap extends Enemy {
    constructor(x, y, p) {
      super(x + 3, y - 16, 10, 15);
      this.state = 'hang';
      this.rock = !!p.rock;
      this.stompable = false;
      this.fireproof = true;
      this.shakeT = 0;
    }
    update(game, dt) {
      this.t += dt;
      if (this.dead) return this.updateDead(game, dt);
      const p = game.player;
      if (this.state === 'hang') {
        if (p && Math.abs(p.cx - this.cx) < 34 && p.y > this.y) { this.state = 'shake'; this.shakeT = 0.4; }
      } else if (this.state === 'shake') {
        this.shakeT -= dt;
        if (this.shakeT <= 0) this.state = 'fall';
      } else {
        this.vy = Math.min(this.vy + 1200 * dt, 480);
        this.y += this.vy * dt;
        const ty = Math.floor(this.bottom / TILE);
        const tx = Math.floor(this.cx / TILE);
        const c = PH.tileAt(game.room, tx, ty);
        if ((PH.isSolid(c) || c === PH.T.SEMI) && this.bottom >= ty * TILE) {
          game.burst(this.cx, this.bottom, this.rock ? '#a8a0b8' : '#d8f4ff', 10, 'shard');
          SG.audio.sfx('crumble');
          this.remove = true;
        }
        if (this.y > game.room.h * TILE) this.remove = true;
      }
    }
    draw(ctx) {
      const s = A.istap(this.rock).r;
      const sx = this.state === 'shake' ? Math.sin(this.t * 90) : 0;
      blit(ctx, s, this.cx + sx, this.bottom + 1, this.flipped ? { flipY: true } : null);
    }
  }

  // Natflagermus - hænger i loftet og styrtdykker mod spilleren.
  class Flagermus extends Enemy {
    constructor(x, y, p) {
      super(x + 1, y - 13, 14, 11);
      this.state = 'hang';
      this.y0 = this.y;
    }
    update(game, dt) {
      this.t += dt;
      if (this.dead) return this.updateDead(game, dt);
      const p = game.player;
      if (this.state === 'hang') {
        if (p && Math.abs(p.cx - this.cx) < 120 && p.y > this.y && p.y - this.y < 170) {
          this.state = 'swoop'; this.dir = p.cx < this.cx ? -1 : 1; this.st = 0;
          this.depth = Math.min(150, Math.max(40, p.cy - this.cy));
        }
      } else {
        this.st += dt;
        this.vx = this.dir * 95;
        this.vy = Math.cos(this.st * 2.4) * this.depth * 1.25;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.st > 6) this.remove = true;
      }
    }
    draw(ctx) {
      const s = A.flagermus(this.state === 'hang' ? 0 : Math.floor(this.t * 10) % 2);
      blit(ctx, this.dir > 0 ? s.r : s.l, this.cx, this.bottom + 3, this.state === 'hang' || this.flipped ? { flipY: true } : null);
    }
  }

  // Tornranke - vokser op af jorden, bliver og trækker sig tilbage.
  class Torn extends Enemy {
    constructor(x, y, p) {
      super(x + 3, y, 10, 0);
      this.base = y;
      this.maxH = (p.h || 3) * TILE;
      this.cycle = p.phase || 0;
      this.cur = 0;
      this.stompable = false;
      this.fireproof = true;
      this.starproof = true;
    }
    update(game, dt) {
      this.t += dt;
      this.cycle += dt;
      const c = this.cycle % 3.7;
      // 0-1.6 skjult, 1.6-2.1 varsel, 2.1-2.35 vokser, 2.35-3.3 oppe, 3.3-3.7 trækker sig
      let k = 0;
      this.warn = c >= 1.6 && c < 2.1;
      if (c >= 2.1 && c < 2.35) k = (c - 2.1) / 0.25;
      else if (c >= 2.35 && c < 3.3) k = 1;
      else if (c >= 3.3) k = 1 - (c - 3.3) / 0.4;
      this.cur = this.maxH * k;
      this.y = this.base - this.cur;
      this.h = this.cur;
      this.harmful = this.cur > 4;
      if (this.warn && Math.random() < 0.3) game.puff(this.cx + U.rand(-5, 5), this.base, '#7a5a3a', 1);
    }
    draw(ctx) {
      if (this.warn) {
        ctx.fillStyle = 'rgba(160,255,120,.35)';
        ctx.fillRect(this.x - 2, this.base - 3, this.w + 4, 3);
      }
      if (this.cur <= 0) return;
      const x = this.cx, top = this.base - this.cur;
      ctx.fillStyle = A.OUT; ctx.fillRect(x - 3, top, 6, this.cur);
      ctx.fillStyle = '#3f9a62'; ctx.fillRect(x - 2, top, 4, this.cur);
      ctx.fillStyle = '#7ad49a'; ctx.fillRect(x - 2, top, 1, this.cur);
      for (let y = top + 6; y < this.base - 2; y += 7) {
        const s = ((y / 7) | 0) % 2 ? 1 : -1;
        ctx.fillStyle = '#e8e0f0';
        ctx.beginPath(); ctx.moveTo(x + s * 2, y); ctx.lineTo(x + s * 7, y - 2); ctx.lineTo(x + s * 2, y + 3); ctx.fill();
      }
      ctx.fillStyle = A.OUT; ctx.beginPath(); ctx.arc(x, top + 1, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#c04aff'; ctx.beginPath(); ctx.arc(x, top + 1, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd34a'; ctx.fillRect(x - 1, top, 2, 2);
    }
  }

  /* =================================================================
     PLATFORME, FJEDRE, CHECKPOINTS OG MÅL
     ================================================================= */
  class Platform extends Ent {
    constructor(x, y, p) {
      const w = (p.w || (p.kind === 'cart' ? 2 : 3)) * TILE;
      super(x, y - 16, w, p.kind === 'cart' ? 12 : 8);
      if (p.kind === 'cart') this.y = y - 12;
      this.kind = 'platform';
      this.solidTop = true;
      this.type = p.kind || 'h';
      this.x0 = this.x; this.y0 = this.y;
      this.range = (p.range || 4) * TILE;
      this.speed = p.speed || (p.kind === 'cart' ? 115 : 50);
      this.pdir = p.dir || 1;
      this.style = p.style || null;
      this.riderT = 0;
      this.angle = p.angle || 0;
      this.dx = 0; this.dy = 0;
      if (this.type === 'v') this.pdir = p.dir || -1;
    }
    update(game, dt) {
      this.t += dt;
      const ox = this.x, oy = this.y;
      const ridden = game.player && game.player.platform === this;
      if (this.type === 'h') {
        this.x += this.speed * this.pdir * dt;
        if (this.x > this.x0 + this.range) { this.x = this.x0 + this.range; this.pdir = -1; }
        if (this.x < this.x0) { this.x = this.x0; this.pdir = 1; }
      } else if (this.type === 'v') {
        this.y += this.speed * this.pdir * dt;
        if (this.y < this.y0 - this.range) { this.y = this.y0 - this.range; this.pdir = 1; }
        if (this.y > this.y0) { this.y = this.y0; this.pdir = -1; }
      } else if (this.type === 'fall') {
        if (ridden) this.riderT += dt;
        if (this.riderT > 0.3) { this.vy = Math.min(this.vy + 700 * dt, 300); this.y += this.vy * dt; }
        else if (this.riderT > 0) this.shakeX = Math.sin(this.t * 70);
        if (this.y > game.room.h * TILE + 40) this.remove = true;
      } else if (this.type === 'circle') {
        this.angle += (this.speed / 60) * dt * this.pdir;
        this.x = this.x0 + Math.cos(this.angle) * this.range - this.w / 2 + 8;
        this.y = this.y0 + Math.sin(this.angle) * this.range;
      } else if (this.type === 'cart') {
        // Minevogn: kører mod højre, når man står i den, og stopper ved en væg.
        if (ridden && !this.started) { this.started = true; SG.audio.sfx('kick'); }
        const moving = this.started && !this.stopped;
        this.vx = moving ? Math.min((this.vx || 0) + 160 * dt, this.speed) : 0;
        this.vy = Math.min((this.vy || 0) + 900 * dt, 300);
        const r = PH.move(game.room, this, dt, { semi: true });
        if (moving && (r.wallR || this.x > this.x0 + this.range)) {
          this.stopped = true; this.vx = 0;
          SG.audio.sfx('bump'); game.shake(2, 0.15);
        }
        if (moving && Math.random() < 0.3) game.puff(this.x + 4, this.bottom, '#ffcf6a', 1);
        if (this.y > game.room.h * TILE + 40) this.remove = true;
      }
      this.dx = this.x - ox;
      this.dy = this.y - oy;
    }
    draw(ctx, game) {
      const x = this.x + (this.shakeX || 0), y = this.y, w = this.w;
      const th = game.theme;
      if (this.type === 'cart') {
        ctx.fillStyle = A.OUT; ctx.fillRect(x - 1, y - 1, w + 2, this.h - 2);
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x, y, w, this.h - 4);
        ctx.fillStyle = '#c98a4b'; ctx.fillRect(x, y, w, 2);
        ctx.fillStyle = '#5a3414'; for (let i = 4; i < w; i += 6) ctx.fillRect(x + i, y + 3, 1, this.h - 8);
        [x + 6, x + w - 6].forEach(wx => {
          ctx.fillStyle = A.OUT; ctx.beginPath(); ctx.arc(wx, y + this.h - 2, 4, 0, 7); ctx.fill();
          ctx.fillStyle = '#a8b0c4'; ctx.beginPath(); ctx.arc(wx, y + this.h - 2, 3, 0, 7); ctx.fill();
          ctx.fillStyle = '#3a3e4c'; ctx.fillRect(wx - 1, y + this.h - 3, 2, 2);
        });
        return;
      }
      const style = this.style || (th.semi === 'cloud' ? 'cloud' : th.ground === 'plate' || th.semi === 'girder' || th.semi === 'chain' ? 'metal' : 'wood');
      if (style === 'cloud') {
        ctx.fillStyle = '#9a8ad0';
        for (let i = 0; i < w; i += 8) { ctx.beginPath(); ctx.arc(x + i + 4, y + 4, 6, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < w; i += 8) { ctx.beginPath(); ctx.arc(x + i + 4, y + 3, 5, 0, 7); ctx.fill(); }
        return;
      }
      ctx.fillStyle = A.OUT; ctx.fillRect(x - 1, y - 1, w + 2, this.h + 2);
      if (style === 'metal') {
        ctx.fillStyle = '#9aa2b4'; ctx.fillRect(x, y, w, this.h);
        ctx.fillStyle = '#e0e6f0'; ctx.fillRect(x, y, w, 2);
        ctx.fillStyle = '#ffcf3a'; for (let i = 2; i < w - 2; i += 8) ctx.fillRect(x + i, y + 4, 4, 2);
      } else {
        ctx.fillStyle = '#c98a4b'; ctx.fillRect(x, y, w, this.h);
        ctx.fillStyle = '#f2b878'; ctx.fillRect(x, y, w, 2);
        ctx.fillStyle = '#7a4a20'; for (let i = 16; i < w; i += 16) ctx.fillRect(x + i, y, 1, this.h);
      }
      if (this.type === 'fall') { ctx.fillStyle = '#ff4d5e'; ctx.fillRect(x + w / 2 - 2, y + 3, 4, 3); }
    }
  }

  class Spring extends Ent {
    constructor(x, y) {
      super(x, y - 16, 16, 16);
      this.kind = 'spring';
      this.compress = 0;
    }
    update(game, dt) { this.compress = Math.max(0, this.compress - dt * 4); }
    draw(ctx) {
      const s = A.springTile(this.compress > 0.5 ? 1 : 0);
      ctx.drawImage(s, this.x, this.y, 16, 16);
    }
  }

  class Checkpoint extends Ent {
    constructor(x, y, p) {
      super(x + 4, y - 32, 8, 32);
      this.kind = 'checkpoint';
      this.id = p.id || 0;
      this.on = false;
    }
    update(game, dt) {
      this.t += dt;
      const p = game.player;
      if (!this.on && p && p.alive && p.cx > this.x) {
        this.on = true;
        game.reachCheckpoint(this);
      }
    }
    draw(ctx) {
      const x = this.cx, b = this.bottom;
      ctx.fillStyle = A.OUT; ctx.fillRect(x - 2, b - 32, 4, 32);
      ctx.fillStyle = '#d8d0e8'; ctx.fillRect(x - 1, b - 32, 2, 32);
      const wave = Math.sin(this.t * 6) * 1.5;
      ctx.fillStyle = A.OUT;
      ctx.beginPath(); ctx.moveTo(x + 1, b - 31); ctx.lineTo(x + 15, b - 27 + wave); ctx.lineTo(x + 1, b - 21); ctx.fill();
      ctx.fillStyle = this.on ? '#5be37d' : '#ff4d5e';
      ctx.beginPath(); ctx.moveTo(x + 2, b - 30); ctx.lineTo(x + 13, b - 27 + wave); ctx.lineTo(x + 2, b - 23); ctx.fill();
      ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(x, b - 33, 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a5068'; ctx.fillRect(x - 5, b - 3, 10, 3);
    }
  }

  // Målstolpe med stjerneflag + Grejs-hytten bagved.
  class Goal extends Ent {
    constructor(x, y) {
      super(x + 6, y - 9 * TILE, 4, 9 * TILE);
      this.kind = 'goal';
      this.flagY = 0;      // 0 = top, 1 = bund
      this.hutX = x + 4 * TILE;
      this.base = y;
    }
    update(game, dt) { this.t += dt; }
    draw(ctx) {
      const x = this.cx, top = this.y, b = this.base;
      // Hytte
      const hx = this.hutX, hw = 48, hh = 40;
      ctx.fillStyle = A.OUT; ctx.fillRect(hx - 1, b - hh - 1, hw + 2, hh + 1);
      ctx.fillStyle = '#e8c890'; ctx.fillRect(hx, b - hh, hw, hh);
      ctx.fillStyle = '#c8a070'; for (let yy = b - hh + 6; yy < b; yy += 7) ctx.fillRect(hx, yy, hw, 1);
      ctx.fillStyle = A.OUT;
      ctx.beginPath(); ctx.moveTo(hx - 7, b - hh + 1); ctx.lineTo(hx + hw / 2, b - hh - 24); ctx.lineTo(hx + hw + 7, b - hh + 1); ctx.fill();
      ctx.fillStyle = '#ff4d5e';
      ctx.beginPath(); ctx.moveTo(hx - 4, b - hh); ctx.lineTo(hx + hw / 2, b - hh - 21); ctx.lineTo(hx + hw + 4, b - hh); ctx.fill();
      ctx.fillStyle = '#ffa0a8'; ctx.fillRect(hx + hw / 2 - 10, b - hh - 12, 20, 2);
      ctx.fillStyle = '#4a2a14'; ctx.fillRect(hx + 17, b - 22, 14, 22);
      ctx.fillStyle = '#ffc93c'; ctx.fillRect(hx + 27, b - 12, 2, 2);
      ctx.fillStyle = '#4fc3ff'; ctx.fillRect(hx + 5, b - 30, 8, 8); ctx.fillRect(hx + 35, b - 30, 8, 8);
      ctx.fillStyle = '#ffc93c'; ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillText('G', hx + hw / 2, b - hh - 4);
      // Stolpe
      ctx.fillStyle = A.OUT; ctx.fillRect(x - 2, top, 4, b - top);
      ctx.fillStyle = '#e8eef8'; ctx.fillRect(x - 1, top, 2, b - top);
      ctx.fillStyle = A.OUT; ctx.fillRect(x - 6, b - 8, 12, 8);
      ctx.fillStyle = '#7a8096'; ctx.fillRect(x - 5, b - 7, 10, 7);
      // Stjerne i toppen
      const st = A.item('star', Math.floor(this.t * 8) % 4).r;
      ctx.drawImage(st, x - 7, top - 13, 14, 14);
      // Flag
      const fy = top + 6 + this.flagY * (b - top - 26);
      const w = Math.sin(this.t * 7) * 2;
      ctx.fillStyle = A.OUT;
      ctx.beginPath(); ctx.moveTo(x - 1, fy - 1); ctx.lineTo(x - 23, fy + 7 + w); ctx.lineTo(x - 1, fy + 15); ctx.fill();
      ctx.fillStyle = '#5be37d';
      ctx.beginPath(); ctx.moveTo(x - 2, fy); ctx.lineTo(x - 20, fy + 7 + w); ctx.lineTo(x - 2, fy + 14); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 10, fy + 6, 3, 3);
    }
  }

  // Grejskrystal - mål efter en bosskamp.
  class Crystal extends Ent {
    constructor(x, y) {
      super(x - 8, y - 28, 16, 24);
      this.kind = 'crystal';
      this.y0 = this.y;
    }
    update(game, dt) { this.t += dt; this.y = this.y0 + Math.sin(this.t * 2.5) * 3; }
    draw(ctx) {
      const x = this.cx, y = this.y;
      ctx.save();
      ctx.fillStyle = 'rgba(255,230,120,.25)';
      ctx.beginPath(); ctx.arc(x, y + 12, 22 + Math.sin(this.t * 4) * 3, 0, 7); ctx.fill();
      ctx.fillStyle = A.OUT;
      ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x + 10, y + 10); ctx.lineTo(x, y + 26); ctx.lineTo(x - 10, y + 10); ctx.fill();
      ctx.fillStyle = '#ffd34a';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y + 10); ctx.lineTo(x, y + 24); ctx.lineTo(x - 8, y + 10); ctx.fill();
      ctx.fillStyle = '#fff7c8';
      ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x - 5, y + 10); ctx.lineTo(x, y + 14); ctx.fill();
      ctx.restore();
    }
  }

  /* =================================================================
     GENSTANDE
     ================================================================= */
  class Item extends Ent {
    constructor(x, y, kindName, fromBlock) {
      super(x + 1, y - 14, 14, 14);
      this.kind = 'item';
      this.item = kindName;
      this.def = SG.powerups.ITEMS[kindName];
      this.emerge = fromBlock ? 16 : 0;
      this.dir = 1;
      this.vy = 0;
    }
    update(game, dt) {
      this.t += dt;
      if (this.emerge > 0) {
        const d = Math.min(this.emerge, 30 * dt);
        this.y -= d;
        this.emerge -= d;
        return;
      }
      if (!this.def.gravity) return;
      this.vx = this.dir * this.def.speed;
      this.gravity(dt, 1200, 400);
      const r = this.move(game, dt);
      if (r.wallL) this.dir = 1;
      if (r.wallR) this.dir = -1;
      if (this.def.bounce && r.landed) this.vy = -this.def.bounce;
      if (this.y > game.room.h * TILE + 32) this.remove = true;
      if (PH.inLiquid(game.room, this)) this.remove = true;
    }
    hop() { if (this.emerge <= 0 && this.def.gravity) { this.vy = -260; } }
    draw(ctx) {
      const s = A.item(this.item, Math.floor(this.t * 8) % 4).r;
      blit(ctx, s, this.cx, this.bottom + 1);
    }
  }

  // Mønt der hopper op af en blok
  class CoinPop extends Ent {
    constructor(x, y) {
      super(x + 3, y - 16, 10, 14);
      this.kind = 'fx';
      this.vy = -330;
      this.y0 = y;
    }
    update(game, dt) {
      this.t += dt;
      this.vy += 1100 * dt;
      this.y += this.vy * dt;
      if (this.vy > 0 && this.y > this.y0 - 40) {
        this.remove = true;
        game.text(this.cx, this.y, '+1', '#ffd34d');
        game.burst(this.cx, this.cy, '#ffe14d', 4, 'spark');
      }
    }
    draw(ctx) { ctx.drawImage(A.coinFrame(Math.floor(this.t * 18) % 6), this.x - 3, this.y - 1, 16, 16); }
  }

  // Spillerens energikugle
  class Energy extends Ent {
    constructor(x, y, dir) {
      super(x, y, 8, 8);
      this.kind = 'proj';
      this.dir = dir;
      this.vx = dir * PH.C.FIRE_SPEED;
      this.vy = 60;
      this.life = 2.2;
    }
    update(game, dt) {
      this.t += dt;
      this.life -= dt;
      this.vy = Math.min(this.vy + 1100 * dt, 420);
      const r = this.move(game, dt, { semi: true });
      if (r.landed) this.vy = -210;
      if (r.wallL || r.wallR || r.ceiling || this.life <= 0 || PH.inLiquid(game.room, this) || !game.onScreen(this, 40)) this.pop(game);
      this.vx = this.dir * PH.C.FIRE_SPEED;
      if (Math.random() < 0.5) game.particles.push({ x: this.cx, y: this.cy, vx: 0, vy: 0, g: 0, life: 0.18, max: 0.18, size: 3, color: '#6ff3ff', type: 'sq' });
    }
    pop(game) {
      if (this.remove) return;
      this.remove = true;
      game.burst(this.cx, this.cy, '#bff8ff', 6, 'spark');
    }
    draw(ctx) {
      const s = A.item('energy').r;
      ctx.save();
      ctx.translate(this.cx, this.cy);
      ctx.rotate(this.t * 14 * this.dir);
      ctx.drawImage(s, -6, -6, 12, 12);
      ctx.restore();
    }
  }

  // Generisk farligt projektil (bruges af bosser)
  class Projectile extends Ent {
    constructor(x, y, o) {
      super(x - (o.w || 10) / 2, y - (o.h || 10) / 2, o.w || 10, o.h || 10);
      this.kind = 'hazard';
      this.o = o;
      this.vx = o.vx || 0;
      this.vy = o.vy || 0;
      this.life = o.life || 6;
      this.harmful = true;
    }
    update(game, dt) {
      this.t += dt;
      this.life -= dt;
      const o = this.o;
      if (o.grav) this.vy = Math.min(this.vy + o.grav * dt, 500);
      if (o.sine) this.vy = Math.cos(this.t * o.sine) * (o.amp || 60);
      if (o.tiles === 'pass') { this.x += this.vx * dt; this.y += this.vy * dt; }
      else {
        const r = PH.move(game.room, this, dt, { semi: o.tiles !== 'nosemi' });
        if (o.tiles === 'bounce') { if (r.landed) this.vy = -(o.bounce || 200); if (r.wallL || r.wallR) this.vx = -(this.vx || 0) || (r.wallL ? 80 : -80); }
        else if (o.tiles === 'roll') { if (r.wallL || r.wallR) this.die(game); }
        else if (r.landed || r.wallL || r.wallR || r.ceiling) this.die(game);
        if (o.tiles === 'roll') this.vx = o.vx;
      }
      if (this.life <= 0 || this.y > game.room.h * TILE + 40) this.die(game, true);
    }
    die(game, silent) {
      if (this.remove) return;
      this.remove = true;
      if (!silent) game.burst(this.cx, this.cy, this.o.color || '#ff8a2a', 7, 'shard');
      if (this.o.onDie) this.o.onDie(game, this);
    }
    draw(ctx) { this.o.draw(ctx, this); }
  }

  /* =================================================================
     FABRIK
     ================================================================= */
  const TYPES = {
    skramler: Skramler, bille: Bille, gnasker: Gnasker, drone: Drone, gnist: Gnist, hopper: Hopper,
    kanon: Kanon, gloeder: Gloeder, stang: Stang, stempel: Stempel, istap: Istap, flagermus: Flagermus,
    torn: Torn, platform: Platform, spring: Spring, checkpoint: Checkpoint, goal: Goal,
  };

  // s = { type, x, y (tiles, y fra bunden), props }
  function create(s, room) {
    if (s.type === 'item') {
      const px = s.x * TILE, bottom = (room.h - s.y) * TILE;
      return new Item(px, bottom, s.props.kind || 'fruit', false);
    }
    if (s.type === 'miniboss') return SG.bosses.createMini(s, room);
    const C = TYPES[s.type];
    if (!C) { console.warn('Ukendt entity', s.type); return null; }
    const px = s.x * TILE;
    const bottom = (room.h - s.y) * TILE;
    return new C(px, bottom, s.props || {}, room);
  }

  return { Ent, Enemy, Bille, Item, CoinPop, Energy, Projectile, Crystal, Skramler, Drone, Hopper, Gloeder, create, blit, TYPES };
})();
