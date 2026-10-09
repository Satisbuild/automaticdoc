'use strict';
/* =====================================================================
   SUPER GREJS - bosses.js
   Én original boss pr. verden + to mini-bosser. Hver boss har 2-3 faser
   med angreb, der altid varsles (blink, rystelse, advarselsmarkering).
   Svaghed: hop på hovedet, når bossen IKKE har pigge/skjold fremme.
   Energikugler giver lidt skade. Angrebene skrives som generatorer.
   ===================================================================== */
SG.bosses = (function () {
  const E = SG.entities;
  const PH = SG.physics;
  const U = SG.util;
  const A = SG.art;
  const OUT = A.OUT;
  const TILE = PH.TILE;

  function* wait(t) { while (t > 0) t -= yield; }

  /* =================================================================
     PROJEKTIL-TYPER
     ================================================================= */
  const drawBall = (c1, c2) => (ctx, p) => {
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(p.cx, p.cy, p.w / 2 + 1, 0, 7); ctx.fill();
    ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(p.cx, p.cy, p.w / 2, 0, 7); ctx.fill();
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(p.cx - 1, p.cy - 1, p.w / 4, 0, 7); ctx.fill();
  };
  const PROJ = {
    fire: { w: 10, h: 10, color: '#ff8a2a', draw: drawBall('#ff6a1a', '#ffe14d') },
    rock: { w: 12, h: 12, color: '#a8a0b8', grav: 900, draw: drawBall('#7a7090', '#c8c0d8') },
    snow: { w: 12, h: 12, color: '#ffffff', grav: 900, draw: drawBall('#e8f4ff', '#ffffff') },
    feather: {
      w: 8, h: 12, color: '#bfe6ff', tiles: 'pass',
      draw(ctx, p) { ctx.fillStyle = OUT; ctx.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2); ctx.fillStyle = '#e8f4ff'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.fillStyle = '#4fc3ff'; ctx.fillRect(p.x + 3, p.y, 2, p.h); },
    },
    leaf: {
      w: 10, h: 8, color: '#7ad49a', tiles: 'pass',
      draw(ctx, p) { ctx.fillStyle = OUT; ctx.beginPath(); ctx.ellipse(p.cx, p.cy, 6, 4, p.t * 3, 0, 7); ctx.fill(); ctx.fillStyle = '#5be37d'; ctx.beginPath(); ctx.ellipse(p.cx, p.cy, 5, 3, p.t * 3, 0, 7); ctx.fill(); },
    },
    shock: {
      w: 12, h: 10, color: '#ffd34a', tiles: 'roll',
      draw(ctx, p) {
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(p.x - 1, p.y + p.h + 1); ctx.lineTo(p.cx, p.y - 3); ctx.lineTo(p.x + p.w + 1, p.y + p.h + 1); ctx.fill();
        ctx.fillStyle = '#ffd34a'; ctx.beginPath(); ctx.moveTo(p.x + 1, p.y + p.h); ctx.lineTo(p.cx, p.y); ctx.lineTo(p.x + p.w - 1, p.y + p.h); ctx.fill();
        ctx.fillStyle = '#fff7c8'; ctx.fillRect(p.cx - 1, p.y + 4, 2, 4);
      },
    },
    gear: {
      w: 14, h: 14, color: '#c8d0e0', tiles: 'roll',
      draw(ctx, p) {
        ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(p.t * 12 * Math.sign(p.vx || 1));
        ctx.fillStyle = OUT; for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -9, 4, 18); }
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
        ctx.fillStyle = '#c8d0e0'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#5a6074'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, 7); ctx.fill();
        ctx.restore();
      },
    },
    icicle: {
      w: 10, h: 16, color: '#d8f4ff', grav: 700,
      draw(ctx, p) { E.blit(ctx, A.istap(false).r, p.cx, p.y + p.h + 1); },
    },
    bomb: { w: 12, h: 12, color: '#ff4d5e', grav: 700, draw: drawBall('#3a3e4c', '#ff4d5e') },
    chaos: { w: 12, h: 12, color: '#c04aff', tiles: 'pass', draw: drawBall('#8a2ad0', '#ff8aff') },
  };

  function shoot(game, x, y, type, vx, vy, extra) {
    const def = PROJ[type];
    const o = Object.assign({}, def, { vx, vy }, extra || {});
    return game.add(new E.Projectile(x, y, o));
  }

  // Advarselsmarkør, der efterfølges af noget farligt (regn, rødder ...)
  class Warning extends E.Ent {
    constructor(x, y, t, then, kind) {
      super(x - 8, y - 4, 16, 4);
      this.kind = 'fx';
      this.left = t; this.then = then; this.wk = kind;
    }
    update(game, dt) {
      this.t += dt; this.left -= dt;
      if (this.left <= 0) { this.remove = true; this.then(game); }
    }
    draw(ctx) {
      const on = Math.floor(this.t * 10) % 2 === 0;
      ctx.fillStyle = on ? 'rgba(255,77,94,.85)' : 'rgba(255,201,60,.6)';
      if (this.wk === 'top') {
        ctx.beginPath(); ctx.moveTo(this.cx - 6, this.y); ctx.lineTo(this.cx + 6, this.y); ctx.lineTo(this.cx, this.y + 8); ctx.fill();
      } else {
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.fillRect(this.cx - 1, this.y - 8, 2, 5);
      }
    }
  }

  // Rod-pig, der skyder op af gulvet
  class RootSpike extends E.Ent {
    constructor(x, floor, h) {
      super(x - 6, floor, 12, 0);
      this.kind = 'hazard';
      this.floor = floor; this.maxH = h || 34;
      this.harmful = true;
    }
    update(game, dt) {
      this.t += dt;
      const k = this.t < 0.15 ? this.t / 0.15 : this.t < 0.9 ? 1 : Math.max(0, 1 - (this.t - 0.9) / 0.3);
      this.h = this.maxH * k; this.y = this.floor - this.h;
      this.harmful = this.h > 4;
      if (this.t > 1.2) this.remove = true;
    }
    draw(ctx) {
      if (this.h <= 0) return;
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(this.x - 1, this.floor); ctx.lineTo(this.cx, this.y - 2); ctx.lineTo(this.x + this.w + 1, this.floor); ctx.fill();
      ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.moveTo(this.x + 1, this.floor); ctx.lineTo(this.cx, this.y); ctx.lineTo(this.x + this.w - 1, this.floor); ctx.fill();
      ctx.fillStyle = '#a8703c'; ctx.fillRect(this.cx - 1, this.y + 6, 2, this.h - 8);
    }
  }

  /* =================================================================
     BOSS-KLASSEN
     ================================================================= */
  class Boss extends E.Enemy {
    constructor(def, x, bottom, opts) {
      super(x - def.w / 2, bottom - def.h, def.w, def.h);
      this.def = def;
      this.isBoss = true;
      this.mini = !!opts.mini;
      this.maxHp = def.hp;
      this.hp = def.hp;
      this.phase = 0;
      this.state = this.mini ? 'wake' : 'intro';
      this.inv = 0;
      this.flash = 0;
      this.dir = -1;
      this.co = null;
      this.telegraph = 0;
      this.spiky = false;
      this.flying = !!def.flying;
      this.stun = 0;
      this.harmful = true;
      this.stompable = true;
      this.fireproof = false;
      this.starproof = false;
      this.atk = 0;
      this.alpha = 1;
      this.hitWall = false;
      this.dieT = 0;
    }
    get name() { return this.def.name; }
    bounds(game) {
      const a = game.room.arena;
      if (a && !this.mini) return [a.x0 * TILE, (a.x1 + 1) * TILE];
      return [this.home0 || 0, this.home1 || game.room.w * TILE];
    }
    floorY(game) {
      const a = game.room.arena;
      if (a && !this.mini) return (game.room.h - a.floor) * TILE;
      return this.floor0 || this.bottom;
    }
    facePlayer(game) { const p = game.player; if (p) this.dir = p.cx < this.cx ? -1 : 1; }

    update(game, dt) {
      this.t += dt;
      this.inv = Math.max(0, this.inv - dt);
      this.flash = Math.max(0, this.flash - dt);
      this.telegraph = Math.max(0, this.telegraph - dt);
      if (this.dead) {
        this.dieT += dt;
        if (Math.random() < 0.25) {
          game.burst(this.x + Math.random() * this.w, this.y + Math.random() * this.h, U.pick(['#ffd34a', '#ff6a1a', '#ffffff']), 8, 'spark');
          if (Math.random() < 0.4) SG.audio.sfx('boom');
        }
        this.alpha = Math.max(0, 1 - this.dieT / 2);
        if (this.dieT > 2) { this.remove = true; game.onBossDefeated(this); }
        return;
      }
      if (this.state === 'intro') {
        // Venter på at arenaen lukker
        if (game.bossStarted) { this.state = 'roar'; this.co = this.roar(game); }
      } else if (this.state === 'wake') {
        const p = game.player;
        if (p && Math.abs(p.cx - this.cx) < 220 && Math.abs(p.bottom - this.bottom) < 64) { this.state = 'fight'; this.home0 = this.x - 8 * TILE; this.home1 = this.x + this.w + 6 * TILE; this.floor0 = this.bottom; game.onMiniBoss(this); }
      }
      if (this.state !== 'intro' && this.state !== 'wake') {
        if (!this.co) this.co = this.nextAttack(game);
        const r = this.co.next(dt);
        if (r.done) { this.co = null; if (this.state === 'roar') this.state = 'fight'; }
      }
      // Fysik
      this.hitWall = false;
      if (!this.flying) {
        this.vy = Math.min(this.vy + 1500 * dt, 600);
        const r = this.move(game, dt);
        if (r.wallL || r.wallR) this.hitWall = true;
      } else {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }
      const [b0, b1] = this.bounds(game);
      if (this.x < b0) { this.x = b0; this.hitWall = true; if (this.vx < 0) this.vx = 0; }
      if (this.x + this.w > b1) { this.x = b1 - this.w; this.hitWall = true; if (this.vx > 0) this.vx = 0; }
      if (this.y > game.room.h * TILE + 40) { this.hp = 0; this.die(game); }
    }

    *roar(game) {
      this.facePlayer(game);
      this.telegraph = 1.2;
      SG.audio.sfx('roar');
      game.shake(4, 0.6);
      yield* wait(1.3);
    }

    nextAttack(game) {
      const phases = this.def.phases;
      const list = phases[Math.min(this.phase, phases.length - 1)];
      const name = list[this.atk % list.length];
      this.atk++;
      const fn = ATTACKS[name.split(':')[0]];
      const arg = name.split(':')[1];
      const self = this;
      return (function* () {
        yield* fn(self, game, arg);
        self.vx = 0;
        yield* wait(self.def.rest != null ? self.def.rest : 0.55);
      })();
    }

    // Skade. how: 'stomp' | 'fire' | 'star' | 'shell'
    hit(game, amount, how) {
      if (this.dead || this.inv > 0 || this.state === 'intro' || this.state === 'wake') return false;
      this.hp -= amount;
      this.flash = 0.3;
      if (how === 'fire') { this.inv = 0.2; SG.audio.sfx('kick'); }
      else { this.inv = 1.1; SG.audio.sfx('bosshit'); game.shake(5, 0.3); }
      if (this.hp <= 0.001) { this.die(game); return true; }
      const n = this.def.phases.length;
      const frac = this.hp / this.maxHp;
      const ph = n >= 3 ? (frac <= 1 / 3 ? 2 : frac <= 2 / 3 ? 1 : 0) : n === 2 ? (frac <= 0.5 ? 1 : 0) : 0;
      if (ph !== this.phase) { this.phase = ph; this.atk = 0; game.toastHud(this.def.phaseText ? this.def.phaseText[ph] || 'Bossen bliver vred!' : 'Bossen bliver vred!'); }
      if (how === 'stomp' || how === 'star') {
        // Afbryd angrebet og lad bossen komme sig
        this.spiky = false;
        this.flying = false;
        this.co = this.recover(game);
      }
      game.hudDirty = true;
      return true;
    }
    *recover(game) {
      this.vx = (this.cx < game.player.cx ? -1 : 1) * 90;
      this.stun = 0.7;
      if (this.flying) { this.vy = -60; }
      yield* wait(0.25);
      this.vx = 0; this.vy = 0;
      yield* wait(0.5);
      this.stun = 0;
    }
    die(game) {
      if (this.dead) return;
      this.dead = true;
      this.harmful = false;
      this.hp = 0;
      this.vx = 0; this.vy = 0;
      this.flying = true;
      SG.audio.sfx('boom');
      game.shake(8, 1.2);
      game.hudDirty = true;
    }
    kill(game, how) {
      // Almindelige "dræb" (skjold, stjerne) bliver til skade på bossen
      if (how === 'star' || how === 'shell') this.hit(game, 1, how);
    }

    draw(ctx, game) {
      ctx.save();
      ctx.globalAlpha *= this.alpha;
      const blink = this.inv > 0 && Math.floor(this.t * 16) % 2 === 0;
      if (blink && !this.dead) ctx.globalAlpha *= 0.55;
      if (this.flash > 0 && Math.floor(this.t * 20) % 2 === 0) ctx.filter = 'brightness(2.4)';
      this.def.draw(ctx, this, game);
      ctx.restore();
      if (this.telegraph > 0 && !this.dead) {
        const y = this.y - 14 + Math.sin(this.t * 20) * 1.5;
        ctx.fillStyle = OUT; ctx.fillRect(this.cx - 3, y - 1, 6, 12);
        ctx.fillStyle = '#ff4d5e'; ctx.fillRect(this.cx - 2, y, 4, 7); ctx.fillRect(this.cx - 2, y + 8, 4, 2);
      }
      if (this.stun > 0) {
        for (let i = 0; i < 3; i++) {
          const a = this.t * 6 + i * 2.1;
          ctx.fillStyle = '#ffe14d';
          ctx.fillRect(this.cx + Math.cos(a) * 12 - 1.5, this.y - 6 + Math.sin(a) * 3 - 1.5, 3, 3);
        }
      }
    }
  }

  /* =================================================================
     ANGREB (generatorer)
     ================================================================= */
  const ATTACKS = {
    *idle(b, g, t) { b.facePlayer(g); b.vx = 0; yield* wait(Number(t) || 0.8); },

    *walk(b, g, t) {
      let left = Number(t) || 1.6;
      while (left > 0) { b.facePlayer(g); b.vx = b.dir * (b.def.speed || 50); left -= yield; }
      b.vx = 0;
    },

    *hop(b, g, n) {
      n = Number(n) || 3;
      for (let i = 0; i < n; i++) {
        b.facePlayer(g);
        b.telegraph = 0.25;
        yield* wait(0.25);
        b.vy = -(b.def.hopPower || 420);
        b.vx = b.dir * (b.def.hopSpeed || 90);
        yield* wait(0.1);
        while (!b.onGround) yield;
        b.vx = 0;
        g.shake(3, 0.2); SG.audio.sfx('slam');
        g.puff(b.x, b.bottom, '#d8c8a8', 6); g.puff(b.x + b.w, b.bottom, '#d8c8a8', 6);
        if (b.phase >= 1 || b.def.hopShock) {
          shoot(g, b.x - 6, b.bottom - 5, 'shock', -150, 0, { life: 4 });
          shoot(g, b.x + b.w + 6, b.bottom - 5, 'shock', 150, 0, { life: 4 });
        }
        yield* wait(0.3);
      }
    },

    *charge(b, g) {
      b.facePlayer(g);
      b.telegraph = 0.75;
      SG.audio.sfx('roar');
      let t = 0.75;
      while (t > 0) { b.shakeX = Math.sin(b.t * 60) * 1.5; t -= yield; }
      b.shakeX = 0;
      const sp = (b.def.chargeSpeed || 230) * (1 + b.phase * 0.15);
      let guard = 4;
      while (!b.hitWall && guard > 0) { b.vx = b.dir * sp; if (Math.random() < 0.4) g.puff(b.cx - b.dir * b.w / 2, b.bottom, '#d8c8a8', 1); guard -= yield; }
      b.vx = 0;
      g.shake(5, 0.3); SG.audio.sfx('slam');
      b.stun = 1.2;
      yield* wait(1.2);
      b.stun = 0;
    },

    *shoot(b, g, n) {
      n = Number(n) || 3;
      const type = b.def.bullet || 'fire';
      for (let i = 0; i < n; i++) {
        b.facePlayer(g);
        b.telegraph = 0.35;
        yield* wait(0.35);
        const p = g.player;
        const sx = b.cx + b.dir * b.w * 0.4, sy = b.y + b.h * 0.35;
        const ang = Math.atan2(p.cy - sy, p.cx - sx);
        const spread = b.phase >= 1 ? [-0.25, 0, 0.25] : [0];
        spread.forEach(d => shoot(g, sx, sy, type, Math.cos(ang + d) * 150, Math.sin(ang + d) * 150, { tiles: 'pass', life: 5, grav: 0 }));
        SG.audio.sfx('shoot');
        yield* wait(0.45);
      }
    },

    *lob(b, g, n) {
      n = Number(n) || 3;
      const type = b.def.lob || 'rock';
      for (let i = 0; i < n; i++) {
        b.facePlayer(g);
        b.telegraph = 0.3;
        yield* wait(0.3);
        const p = g.player;
        const dx = p.cx - b.cx;
        const tFlight = 0.9;
        shoot(g, b.cx, b.y + 4, type, dx / tFlight + U.rand(-20, 20), -0.5 * 900 * tFlight, { life: 4 });
        SG.audio.sfx('shoot');
        yield* wait(0.5);
      }
    },

    *rain(b, g, n) {
      n = Number(n) || 6;
      const type = b.def.rainType || 'rock';
      const [x0, x1] = b.bounds(g);
      const top = g.cam.y + 4;
      b.telegraph = 0.5;
      SG.audio.sfx('roar');
      g.shake(3, 0.8);
      for (let i = 0; i < n; i++) {
        const x = i === 0 ? g.player.cx : U.rand(x0 + 16, x1 - 16);
        g.add(new Warning(x, top + 2, 0.7, gg => shoot(gg, x, top, type, 0, 60, { grav: 700, life: 4 }), 'top'));
        yield* wait(0.28);
      }
      yield* wait(0.6);
    },

    *slam(b, g) {
      b.facePlayer(g);
      b.telegraph = 0.4;
      yield* wait(0.4);
      b.vy = -560;
      const target = g.player.cx;
      while (b.vy < 0) { b.vx = U.clamp((target - b.cx) * 2.5, -200, 200); yield; }
      b.vx = 0;
      b.flying = true; b.vy = 0;
      yield* wait(0.35);
      b.flying = false; b.vy = 520;
      while (!b.onGround) yield;
      g.shake(6, 0.35); SG.audio.sfx('slam');
      shoot(g, b.x - 6, b.bottom - 5, 'shock', -170, 0, { life: 4 });
      shoot(g, b.x + b.w + 6, b.bottom - 5, 'shock', 170, 0, { life: 4 });
      b.stun = 1.1;
      yield* wait(1.1);
      b.stun = 0;
    },

    *burrow(b, g) {
      b.telegraph = 0.4;
      yield* wait(0.4);
      b.harmful = false; b.stompable = false;
      SG.audio.sfx('crumble');
      for (let k = 1; k >= 0; k -= 0.1) { b.alpha = k; g.puff(b.cx + U.rand(-15, 15), b.bottom, '#8f7ca6', 2); yield* wait(0.04); }
      b.alpha = 0;
      const tx = U.clamp(g.player.cx, b.bounds(g)[0] + b.w / 2, b.bounds(g)[1] - b.w / 2);
      let t = 0.9;
      while (t > 0) { g.puff(tx + U.rand(-12, 12), b.floorY(g), '#8f7ca6', 1); t -= yield; }
      b.x = tx - b.w / 2;
      b.alpha = 1; b.harmful = true;
      b.vy = -380;
      SG.audio.sfx('slam'); g.shake(4, 0.3);
      for (let i = 0; i < 6; i++) shoot(g, b.cx, b.y + 6, 'rock', U.rand(-120, 120), U.rand(-380, -220), { life: 3 });
      while (!b.onGround) yield;
      b.stompable = true;
      b.stun = 1.3;
      yield* wait(1.3);
      b.stun = 0;
    },

    *fly(b, g, n) {
      n = Number(n) || 5;
      b.flying = true;
      b.vx = 0;
      const top = g.cam.y + 36;
      while (b.y > top) { b.vy = -160; yield; }
      b.vy = 0;
      const [x0, x1] = b.bounds(g);
      let dir = b.cx < (x0 + x1) / 2 ? 1 : -1;
      let drops = n;
      let dropT = 0.4;
      while (drops > 0) {
        b.vx = dir * (b.def.flySpeed || 110);
        b.y = top + Math.sin(b.t * 3) * 6 - b.vy * 0;
        if (b.x <= x0 + 2 && dir < 0) dir = 1;
        if (b.x + b.w >= x1 - 2 && dir > 0) dir = -1;
        b.dir = dir;
        const dt = yield;
        dropT -= dt;
        if (dropT <= 0) {
          dropT = 0.55 - b.phase * 0.1;
          drops--;
          shoot(g, b.cx, b.bottom, b.def.dropType || 'feather', 0, 120, { life: 4, grav: b.def.dropType === 'bomb' ? 600 : 0 });
        }
      }
      b.vx = 0;
    },

    *dive(b, g) {
      if (!b.flying) { yield* ATTACKS.fly(b, g, 1); }
      b.vx = 0; b.vy = 0;
      b.facePlayer(g);
      b.telegraph = 0.6;
      SG.audio.sfx('roar');
      yield* wait(0.6);
      const p = g.player;
      const ang = Math.atan2(p.cy - b.cy, p.cx - b.cx);
      const sp = 300 + b.phase * 40;
      b.vx = Math.cos(ang) * sp; b.vy = Math.max(120, Math.sin(ang) * sp);
      let guard = 2.5;
      while (b.bottom < b.floorY(g) - 1 && guard > 0) { guard -= yield; }
      b.flying = false;
      b.vx = 0;
      g.shake(5, 0.3); SG.audio.sfx('slam');
      b.stun = 1.4;
      yield* wait(1.4);
      b.stun = 0;
    },

    *land(b, g) {
      b.flying = false;
      while (!b.onGround) yield;
      b.stun = 1.3;
      yield* wait(1.3);
      b.stun = 0;
    },

    *gust(b, g) {
      b.facePlayer(g);
      b.telegraph = 0.5;
      yield* wait(0.5);
      g.windForce = b.dir * 120;
      let t = 2;
      while (t > 0) {
        if (Math.random() < 0.25) g.particles.push({ x: b.cx, y: b.y + U.rand(0, b.h), vx: b.dir * 300, vy: 0, g: 0, life: 0.6, max: 0.6, size: 2, color: '#ffffff', type: 'sq' });
        t -= yield;
      }
      g.windForce = 0;
      yield* ATTACKS.shoot(b, g, 2);
    },

    *summon(b, g, n) {
      n = Number(n) || 2;
      const alive = g.entities.filter(e => e.summoned && !e.dead).length;
      if (alive >= 3) { yield* wait(0.5); return; }
      b.telegraph = 0.6;
      SG.audio.sfx('roar');
      yield* wait(0.6);
      const [x0, x1] = b.bounds(g);
      for (let i = 0; i < n; i++) {
        const left = i % 2 === 0;
        const type = b.def.minion || 'skramler';
        let e;
        if (type === 'drone') {
          e = new E.Drone(left ? x0 + 24 : x1 - 40, g.cam.y + 70 + i * 16, { mode: 'h', range: 4, speed: 1.6 });
        } else {
          e = new E.Skramler(left ? x0 + 8 : x1 - 24, b.floorY(g) - 40, { dir: left ? 1 : -1 });
        }
        e.summoned = true;
        g.add(e);
        g.burst(e.cx, e.cy, '#c08aff', 10, 'spark');
        yield* wait(0.3);
      }
    },

    *roots(b, g, n) {
      n = Number(n) || 3;
      b.spiky = true;
      b.telegraph = 0.5;
      yield* wait(0.5);
      for (let i = 0; i < n; i++) {
        const x = g.player.cx;
        const floor = b.floorY(g);
        g.add(new Warning(x, floor - 2, 0.65, gg => { gg.add(new RootSpike(x, floor, 38)); SG.audio.sfx('crumble'); }, 'floor'));
        yield* wait(0.55 - b.phase * 0.08);
      }
      yield* wait(0.8);
      b.spiky = false;
    },

    *spin(b, g) {
      b.spiky = true;
      b.telegraph = 0.6;
      yield* wait(0.6);
      b.facePlayer(g);
      let t = 3;
      let dir = b.dir;
      while (t > 0) {
        b.vx = dir * 170;
        if (b.hitWall) { dir = -dir; SG.audio.sfx('bump'); }
        b.spinA = (b.spinA || 0) + 0.4;
        t -= yield;
      }
      b.vx = 0;
      b.spiky = false;
      b.stun = 1;
      yield* wait(1);
      b.stun = 0;
    },

    *gears(b, g, n) {
      n = Number(n) || 2;
      for (let i = 0; i < n; i++) {
        b.facePlayer(g);
        b.telegraph = 0.4;
        yield* wait(0.4);
        shoot(g, b.cx + b.dir * b.w / 2, b.bottom - 8, 'gear', b.dir * (130 + b.phase * 25), 0, { life: 6, grav: 900 });
        SG.audio.sfx('shoot');
        yield* wait(0.6);
      }
    },

    *ring(b, g) {
      b.telegraph = 0.6;
      yield* wait(0.6);
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2;
        shoot(g, b.cx, b.cy, 'chaos', Math.cos(a) * 120, Math.sin(a) * 120, { life: 4 });
      }
      SG.audio.sfx('zap');
      yield* wait(0.8);
    },
  };

  /* =================================================================
     BOSS-TEGNINGER
     ================================================================= */
  function body(ctx, x, y, w, h, col, r) {
    ctx.fillStyle = OUT;
    rr(ctx, x - 1.5, y - 1.5, w + 3, h + 3, r + 1.5); ctx.fill();
    ctx.fillStyle = col;
    rr(ctx, x, y, w, h, r); ctx.fill();
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function eye(ctx, x, y, r, dir, angry, col) {
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, 7); ctx.fill();
    ctx.fillStyle = col || '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x + dir * r * 0.4, y + 0.5, r * 0.45, 0, 7); ctx.fill();
    if (angry) { ctx.fillStyle = OUT; ctx.save(); ctx.translate(x, y - r); ctx.rotate(dir * 0.35); ctx.fillRect(-r - 1, -2, r * 2 + 2, 2.5); ctx.restore(); }
  }
  function stunTint() { /* blink håndteres i Boss.draw */ }

  const DEFS = {
    bulder: {
      name: 'Brumle Bulder', w: 40, h: 34, hp: 3, speed: 55, chargeSpeed: 220,
      phases: [['walk:1.4', 'hop:3', 'charge'], ['hop:2', 'charge', 'walk:1', 'hop:3'], ['charge', 'hop:4', 'charge']],
      draw(ctx, b) {
        const x = b.x + (b.shakeX || 0), y = b.y, d = b.dir;
        stunTint(ctx, b);
        // Ører og krop
        body(ctx, x + 4, y + 2, 10, 10, '#8a5a2a', 5); body(ctx, x + 26, y + 2, 10, 10, '#8a5a2a', 5);
        body(ctx, x, y + 6, b.w, b.h - 6, '#a8703c', 14);
        ctx.fillStyle = '#e0b07a'; rr(ctx, x + 10, y + 16, 20, 16, 8); ctx.fill();
        // Hjelm
        ctx.fillStyle = OUT; rr(ctx, x + 5, y + 2, 30, 10, 5); ctx.fill();
        ctx.fillStyle = '#9aa2b4'; rr(ctx, x + 6, y + 3, 28, 8, 4); ctx.fill();
        ctx.fillStyle = '#e0e6f0'; ctx.fillRect(x + 10, y + 4, 8, 2);
        eye(ctx, x + 20 + d * 6, y + 15, 3.5, d, true);
        eye(ctx, x + 20 + d * 14, y + 15, 3, d, true);
        ctx.fillStyle = OUT; ctx.fillRect(x + 20 + d * 10 - 3, y + 22, 6, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 20 + d * 10 - 2, y + 22, 1.5, 2); ctx.fillRect(x + 20 + d * 10 + 1, y + 22, 1.5, 2);
        // Fødder
        const step = b.onGround && Math.abs(b.vx) > 1 ? Math.sin(b.t * 14) * 2 : 0;
        body(ctx, x + 4, y + b.h - 6 + step, 12, 7, '#6a4220', 3); body(ctx, x + 24, y + b.h - 6 - step, 12, 7, '#6a4220', 3);
      },
    },
    graver: {
      name: 'Grav-Gustav', w: 46, h: 34, hp: 4, speed: 60, chargeSpeed: 240, lob: 'rock', rainType: 'rock',
      phases: [['lob:3', 'burrow', 'charge'], ['burrow', 'rain:6', 'lob:3', 'charge'], ['burrow', 'burrow', 'rain:8', 'charge']],
      draw(ctx, b) {
        const x = b.x + (b.shakeX || 0), y = b.y, d = b.dir;
        stunTint(ctx, b);
        // Bælter
        body(ctx, x + 2, y + b.h - 10, b.w - 4, 10, '#3a3e4c', 5);
        ctx.fillStyle = '#7a8096';
        for (let i = 0; i < 6; i++) ctx.fillRect(x + 6 + ((i * 7 + b.t * 40 * Math.sign(b.vx || 0)) % 36 + 36) % 36, y + b.h - 8, 3, 6);
        // Krop
        body(ctx, x + 4, y + 6, b.w - 12, b.h - 14, '#8f7ca6', 8);
        ctx.fillStyle = '#b8a8d0'; ctx.fillRect(x + 8, y + 8, b.w - 22, 3);
        // Bor
        const bx = d > 0 ? x + b.w - 10 : x + 10;
        ctx.save(); ctx.translate(bx, y + 18);
        ctx.scale(d, 1);
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(-2, -11); ctx.lineTo(16, 0); ctx.lineTo(-2, 11); ctx.fill();
        ctx.fillStyle = '#ffd34a'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(14, 0); ctx.lineTo(0, 9); ctx.fill();
        ctx.fillStyle = '#c87a00';
        for (let i = 0; i < 3; i++) { const o = (b.t * 30 + i * 5) % 14; ctx.fillRect(o, -9 + o * 0.6, 2, 18 - o * 1.2); }
        ctx.restore();
        // Briller
        body(ctx, x + b.w / 2 - 10 + d * 2, y + 1, 20, 9, '#3a3e4c', 4);
        eye(ctx, x + b.w / 2 - 4 + d * 2, y + 5, 3, d, true, '#7af0ff');
        eye(ctx, x + b.w / 2 + 4 + d * 2, y + 5, 3, d, true, '#7af0ff');
      },
    },
    vindolf: {
      name: 'Stormfuglen Vindolf', w: 42, h: 34, hp: 4, flying: true, flySpeed: 120, dropType: 'feather', bullet: 'feather',
      phases: [['fly:5', 'dive', 'land'], ['gust', 'dive', 'fly:6', 'dive', 'land'], ['fly:7', 'dive', 'dive', 'gust', 'land']],
      draw(ctx, b) {
        const x = b.x, y = b.y, d = b.dir;
        stunTint(ctx, b);
        const flap = b.flying ? Math.sin(b.t * 16) * 8 : 2;
        // Vinger
        ctx.fillStyle = OUT;
        ctx.beginPath(); ctx.moveTo(x + 12, y + 14); ctx.lineTo(x - 10, y + 8 - flap); ctx.lineTo(x + 6, y + 24); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 30, y + 14); ctx.lineTo(x + 52, y + 8 - flap); ctx.lineTo(x + 36, y + 24); ctx.fill();
        ctx.fillStyle = '#7ab8ff';
        ctx.beginPath(); ctx.moveTo(x + 12, y + 15); ctx.lineTo(x - 7, y + 9 - flap); ctx.lineTo(x + 7, y + 22); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 30, y + 15); ctx.lineTo(x + 49, y + 9 - flap); ctx.lineTo(x + 35, y + 22); ctx.fill();
        body(ctx, x + 6, y + 6, 30, 24, '#e8f4ff', 12);
        ctx.fillStyle = '#bfe0ff'; rr(ctx, x + 12, y + 16, 18, 12, 6); ctx.fill();
        // Top-fjer
        ctx.fillStyle = OUT; ctx.fillRect(x + 18, y - 2, 6, 10);
        ctx.fillStyle = '#4fc3ff'; ctx.fillRect(x + 19, y - 1, 4, 8);
        eye(ctx, x + 21 + d * 7, y + 14, 3.5, d, true);
        // Næb
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x + 21 + d * 10, y + 17); ctx.lineTo(x + 21 + d * 22, y + 20); ctx.lineTo(x + 21 + d * 10, y + 23); ctx.fill();
        ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.moveTo(x + 21 + d * 11, y + 18); ctx.lineTo(x + 21 + d * 20, y + 20); ctx.lineTo(x + 21 + d * 11, y + 22); ctx.fill();
        // Fødder
        ctx.fillStyle = '#ff8a2a'; ctx.fillRect(x + 14, y + 29, 4, 5); ctx.fillRect(x + 24, y + 29, 4, 5);
      },
    },
    magmus: {
      name: 'Doktor Magmus', w: 44, h: 38, hp: 5, bullet: 'fire', rainType: 'fire', flying: false, hopPower: 380,
      phases: [['shoot:3', 'slam', 'idle:0.4'], ['shoot:3', 'rain:7', 'slam'], ['slam', 'shoot:4', 'rain:9', 'slam']],
      draw(ctx, b) {
        const x = b.x + (b.shakeX || 0), y = b.y, d = b.dir;
        stunTint(ctx, b);
        // Flammer under
        if (!b.onGround || b.vy < 0) {
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i % 2 ? '#ffd34a' : '#ff6a1a';
            ctx.beginPath(); ctx.moveTo(x + 10 + i * 12, y + b.h - 4); ctx.lineTo(x + 16 + i * 12, y + b.h + 8 + Math.random() * 6); ctx.lineTo(x + 22 + i * 12, y + b.h - 4); ctx.fill();
          }
        }
        // Skål
        body(ctx, x, y + 20, b.w, 14, '#9aa2ba', 7);
        ctx.fillStyle = '#e0e6f0'; ctx.fillRect(x + 4, y + 21, b.w - 8, 2);
        ctx.fillStyle = '#ff4d5e'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * 10, y + 27, 4, 3);
        // Glaskuppel med doktoren
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x + b.w / 2, y + 21, 16, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(180,240,255,.55)'; ctx.beginPath(); ctx.arc(x + b.w / 2, y + 21, 14.5, Math.PI, 0); ctx.fill();
        const hx = x + b.w / 2 + d * 2;
        ctx.fillStyle = '#ffd0b0'; ctx.beginPath(); ctx.arc(hx, y + 15, 7, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx - d * 6, y + 10, 4, 0, 7); ctx.arc(hx - d * 2, y + 7, 4, 0, 7); ctx.fill();
        ctx.fillStyle = OUT; ctx.fillRect(hx - 6, y + 12, 12, 3);
        ctx.fillStyle = '#ffd34a'; ctx.fillRect(hx - 5 + (d > 0 ? 6 : 0), y + 12, 4, 3);
        ctx.fillStyle = OUT; ctx.fillRect(hx + d * 2 - 2, y + 18, 4, 1);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(hx - 8, y + 5, 3, 2);
      },
    },
    frosti: {
      name: 'Iskolossen Frosti', w: 44, h: 44, hp: 5, speed: 50, chargeSpeed: 250, lob: 'snow', rainType: 'icicle',
      phases: [['lob:3', 'charge', 'slam'], ['rain:6', 'lob:3', 'spin', 'charge'], ['spin', 'rain:8', 'slam', 'charge', 'lob:4']],
      draw(ctx, b) {
        const x = b.x + (b.shakeX || 0), y = b.y, d = b.dir;
        stunTint(ctx, b);
        ctx.save();
        if (b.spiky) { ctx.translate(b.cx, b.cy); ctx.rotate(b.spinA || 0); ctx.translate(-b.cx, -b.cy); }
        body(ctx, x + 2, y + 18, 40, 26, '#ffffff', 13);
        body(ctx, x + 8, y + 4, 28, 20, '#f0f8ff', 10);
        ctx.fillStyle = '#d8ecff'; ctx.fillRect(x + 6, y + 36, 32, 4);
        // Iskrone
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x + 9 + i * 6, y + 6); ctx.lineTo(x + 12 + i * 6, y - 6 - (i % 2) * 4); ctx.lineTo(x + 15 + i * 6, y + 6); ctx.fill();
          ctx.fillStyle = '#8fd0ff'; ctx.beginPath(); ctx.moveTo(x + 10 + i * 6, y + 6); ctx.lineTo(x + 12 + i * 6, y - 4 - (i % 2) * 4); ctx.lineTo(x + 14 + i * 6, y + 6); ctx.fill();
        }
        if (b.spiky) {
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2;
            ctx.fillStyle = '#8fd0ff';
            ctx.beginPath(); ctx.moveTo(b.cx + Math.cos(a) * 20, b.cy + Math.sin(a) * 20); ctx.lineTo(b.cx + Math.cos(a + 0.2) * 28, b.cy + Math.sin(a + 0.2) * 28); ctx.lineTo(b.cx + Math.cos(a + 0.4) * 20, b.cy + Math.sin(a + 0.4) * 20); ctx.fill();
          }
        }
        ctx.fillStyle = OUT;
        ctx.fillRect(x + 22 + d * 3 - 6, y + 11, 4, 4); ctx.fillRect(x + 22 + d * 3 + 3, y + 11, 4, 4);
        ctx.fillStyle = '#ff8a2a'; ctx.fillRect(x + 22 + d * 3 + (d > 0 ? 0 : -8), y + 16, 8, 3);
        ctx.fillStyle = OUT; for (let i = 0; i < 3; i++) ctx.fillRect(x + 20, y + 24 + i * 6, 4, 4);
        ctx.restore();
      },
    },
    rodkongen: {
      name: 'Rodkongen', w: 46, h: 44, hp: 6, speed: 40, bullet: 'leaf', minion: 'skramler', hopPower: 360,
      phases: [['roots:3', 'shoot:2', 'hop:2'], ['roots:4', 'summon:2', 'shoot:3', 'hop:2'], ['roots:5', 'shoot:3', 'summon:2', 'roots:4', 'hop:3']],
      draw(ctx, b) {
        const x = b.x + (b.shakeX || 0), y = b.y, d = b.dir;
        stunTint(ctx, b);
        // Rodfødder
        ctx.fillStyle = OUT; for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 11, y + b.h - 6, 6, 7);
        ctx.fillStyle = '#5a3a20'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 5 + i * 11, y + b.h - 6, 4, 6);
        body(ctx, x + 2, y + 12, b.w - 4, b.h - 16, '#7a4a2a', 10);
        ctx.fillStyle = '#5a3418'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 8 + i * 9, y + 16, 2, b.h - 24);
        // Krone af blade / torne
        for (let i = 0; i < 6; i++) {
          const cx = x + 6 + i * 7;
          ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(cx - 4, y + 14); ctx.lineTo(cx, y - (b.spiky ? 10 : 2) - (i % 2) * 4); ctx.lineTo(cx + 4, y + 14); ctx.fill();
          ctx.fillStyle = b.spiky ? '#e8e0f0' : '#3f9a62'; ctx.beginPath(); ctx.moveTo(cx - 3, y + 13); ctx.lineTo(cx, y - (b.spiky ? 8 : 0) - (i % 2) * 4); ctx.lineTo(cx + 3, y + 13); ctx.fill();
        }
        eye(ctx, x + b.w / 2 - 7 + d * 3, y + 22, 4, d, true, '#ffe14d');
        eye(ctx, x + b.w / 2 + 7 + d * 3, y + 22, 4, d, true, '#ffe14d');
        ctx.fillStyle = OUT; ctx.fillRect(x + b.w / 2 - 8 + d * 3, y + 31, 16, 4);
      },
    },
    tyrann: {
      name: 'Tandhjulstyrannen', w: 48, h: 46, hp: 6, speed: 55, chargeSpeed: 250, bullet: 'fire', hopShock: true,
      phases: [['gears:2', 'charge', 'slam'], ['gears:3', 'shoot:3', 'slam', 'charge'], ['slam', 'gears:3', 'charge', 'shoot:4', 'slam']],
      draw(ctx, b) {
        const x = b.x + (b.shakeX || 0), y = b.y, d = b.dir;
        stunTint(ctx, b);
        const step = b.onGround && Math.abs(b.vx) > 1 ? Math.sin(b.t * 14) * 2 : 0;
        body(ctx, x + 8, y + b.h - 12 + step, 12, 12, '#5a6074', 3); body(ctx, x + 28, y + b.h - 12 - step, 12, 12, '#5a6074', 3);
        body(ctx, x + 2, y + 8, b.w - 4, b.h - 18, '#e6b44a', 8);
        ctx.fillStyle = '#fff0a8'; ctx.fillRect(x + 6, y + 10, b.w - 12, 3);
        // Tandhjul på brystet
        ctx.save(); ctx.translate(x + b.w / 2, y + 26); ctx.rotate(b.t * 3);
        ctx.fillStyle = OUT; for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -10, 5, 20); }
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#9aa2b4'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff4d5e'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
        ctx.restore();
        // Hoved
        body(ctx, x + 12, y, 24, 12, '#9aa2b4', 4);
        ctx.fillStyle = '#ff4d5e'; ctx.fillRect(x + 16 + (d > 0 ? 6 : 0), y + 4, 10, 3);
        // Savarm
        const ax = d > 0 ? x + b.w : x;
        ctx.save(); ctx.translate(ax, y + 22); ctx.rotate(b.t * 18);
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
        ctx.fillStyle = '#e0e6f0'; for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(3, -6); ctx.lineTo(-3, -6); ctx.fill(); }
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
        ctx.restore();
      },
    },
    kejser: {
      name: 'Kaos-Kejseren Grumulus', w: 52, h: 50, hp: 9, speed: 60, chargeSpeed: 260, bullet: 'chaos', rainType: 'bomb',
      dropType: 'bomb', minion: 'drone', flySpeed: 130, hopShock: true,
      phaseText: ['', 'Grumulus letter! Pas på bomberne!', 'Grumulus raser - sidste fase!'],
      phases: [['shoot:3', 'hop:3', 'summon:2', 'charge'], ['fly:6', 'dive', 'roots:4', 'ring', 'land'], ['slam', 'ring', 'charge', 'rain:8', 'roots:5', 'shoot:4', 'slam']],
      draw(ctx, b) {
        const x = b.x + (b.shakeX || 0), y = b.y, d = b.dir;
        stunTint(ctx, b);
        // Kappe
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x + 4, y + 14); ctx.lineTo(x - 4, y + b.h + 1); ctx.lineTo(x + b.w + 4, y + b.h + 1); ctx.lineTo(x + b.w - 4, y + 14); ctx.fill();
        ctx.fillStyle = '#5a1a8a'; ctx.beginPath(); ctx.moveTo(x + 5, y + 15); ctx.lineTo(x - 2, y + b.h); ctx.lineTo(x + b.w + 2, y + b.h); ctx.lineTo(x + b.w - 5, y + 15); ctx.fill();
        ctx.fillStyle = '#ff3a6a'; ctx.fillRect(x - 1, y + b.h - 4, b.w + 2, 3);
        body(ctx, x + 12, y + 16, b.w - 24, b.h - 20, '#2a1e34', 6);
        ctx.fillStyle = '#ffc93c'; ctx.fillRect(x + b.w / 2 - 2, y + 20, 4, b.h - 28);
        // Hoved og horn
        body(ctx, x + 14, y + 2, 24, 18, '#8a6aa0', 8);
        ctx.fillStyle = OUT;
        ctx.beginPath(); ctx.moveTo(x + 14, y + 6); ctx.lineTo(x + 4, y - 10); ctx.lineTo(x + 18, y + 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 38, y + 6); ctx.lineTo(x + 48, y - 10); ctx.lineTo(x + 34, y + 2); ctx.fill();
        ctx.fillStyle = '#e8e0d0';
        ctx.beginPath(); ctx.moveTo(x + 15, y + 5); ctx.lineTo(x + 6, y - 7); ctx.lineTo(x + 18, y + 3); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 37, y + 5); ctx.lineTo(x + 46, y - 7); ctx.lineTo(x + 34, y + 3); ctx.fill();
        // Krone
        ctx.fillStyle = '#ffc93c';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 18 + i * 6, y + 3); ctx.lineTo(x + 21 + i * 6, y - 4); ctx.lineTo(x + 24 + i * 6, y + 3); ctx.fill(); }
        eye(ctx, x + 26 + d * 3 - 5, y + 11, 3, d, true, '#ff3a3a');
        eye(ctx, x + 26 + d * 3 + 5, y + 11, 3, d, true, '#ff3a3a');
        ctx.fillStyle = OUT; ctx.fillRect(x + 21 + d * 3, y + 16, 10, 2);
        if (b.phase >= 2) {
          ctx.strokeStyle = 'rgba(255,60,120,.6)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(b.cx, b.cy, 30 + Math.sin(b.t * 8) * 3, 0, 7); ctx.stroke();
        }
      },
    },
    // Mini-bosser
    kaempeskramler: {
      name: 'Kæmpe-Skramler', w: 30, h: 28, hp: 3, speed: 60, chargeSpeed: 200, mini: true,
      phases: [['walk:1.2', 'hop:2', 'charge']],
      draw(ctx, b) {
        const s = A.skramler(Math.floor(b.t * 6) % 2, false, false);
        const img = b.dir > 0 ? s.r : s.l;
        ctx.drawImage(img, b.x - 1 + (b.shakeX || 0), b.y - 4, 32, 32);
        ctx.fillStyle = '#ffc93c'; ctx.fillRect(b.x + 9, b.y - 6, 12, 3); ctx.fillRect(b.x + 9, b.y - 9, 3, 3); ctx.fillRect(b.x + 14, b.y - 10, 3, 4); ctx.fillRect(b.x + 18, b.y - 9, 3, 3);
      },
    },
    panserbille: {
      name: 'Panserbillen', w: 30, h: 30, hp: 3, speed: 50, chargeSpeed: 230, mini: true,
      phases: [['walk:1', 'spin', 'charge', 'hop:2']],
      draw(ctx, b) {
        const s = A.bille(Math.floor(b.t * 6) % 2, b.spiky, false);
        const img = b.dir > 0 ? s.r : s.l;
        ctx.save();
        if (b.spiky) { ctx.translate(b.cx, b.cy); ctx.rotate(b.t * 20 * b.dir); ctx.translate(-b.cx, -b.cy); }
        ctx.drawImage(img, b.x - 1 + (b.shakeX || 0), b.y - 16, 32, 48);
        ctx.restore();
        if (b.spiky) {
          ctx.fillStyle = '#e8e0f0';
          for (let i = 0; i < 6; i++) { const a = b.t * 20 + i; ctx.fillRect(b.cx + Math.cos(a) * 15 - 1.5, b.cy + Math.sin(a) * 15 - 1.5, 3, 3); }
        }
      },
    },
  };

  function create(id, x, bottom, opts) {
    const def = DEFS[id];
    if (!def) throw new Error('Ukendt boss ' + id);
    return new Boss(def, x, bottom, opts || {});
  }

  function createMini(s, room) {
    const b = create(s.props.id || 'kaempeskramler', s.x * TILE + 8, (room.h - s.y) * TILE, { mini: true });
    b.drop = s.props.drop || 'flower';
    return b;
  }

  return { create, createMini, DEFS, Boss, ATTACKS };
})();
