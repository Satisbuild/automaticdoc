/* GrejsAlley Lemmings — game.js
 * One play session of a level: releases lemmings, steps the simulation at a
 * fixed tick rate, tracks counters, time limit and win/lose.
 * DOM-free: the renderer/UI read its state and drain game.events.
 */
(function (GL) {
  'use strict';
  const C = GL.CONST;
  const HATCH_TICKS = 34;       // trapdoor opening animation before the first release

  // Release rate 1..99 -> ticks between lemmings (higher rate = faster).
  GL.releaseInterval = function (rate) { return Math.round(4 + (99 - rate) * 0.85); };

  class Game {
    constructor(def) {
      this.def = def;
      const lvl = GL.Level.build(def);
      this.level = lvl;
      this.terrain = lvl.terrain;
      this.entrances = lvl.entrances;
      this.exits = lvl.exits;
      this.hazards = lvl.hazards;

      this.lemmings = [];
      this.count = def.count;
      this.required = def.required;
      this.released = 0;
      this.saved = 0;
      this.dead = 0;
      this.skills = {};
      for (const id of GL.SKILL_IDS) this.skills[id] = Math.max(0, (def.skills && def.skills[id]) | 0);
      this.minRate = clamp(def.rate || 50, 1, 99);
      this.rate = this.minRate;
      this.releasing = true;          // player can pause the release
      this.tick = 0;
      this.timeLimit = def.time ? Math.round(def.time * C.TPS) : 0;
      this.nextRelease = HATCH_TICKS;
      this.nextEntrance = 0;
      this.nuking = false;
      this.nukeQueue = [];
      this.goalReached = false;
      this.over = false;
      this.result = null;
      this.endTimer = -1;
      this.events = [];
      this.hatchOpen = 0;             // 0..1 for rendering
    }

    emit(type, L, extra) {
      const e = { type, x: L ? L.x : 0, y: L ? L.y : 0, lem: L || null };
      if (extra) Object.assign(e, extra);
      this.events.push(e);
      if (this.events.length > 500) this.events.splice(0, this.events.length - 500);
    }

    get activeCount() { let n = 0; for (const L of this.lemmings) if (L.alive) n++; return n; }
    get timeLeft() { return this.timeLimit ? Math.max(0, this.timeLimit - this.tick) : Infinity; }
    get remainingToRelease() { return this.nuking ? 0 : this.count - this.released; }

    setRate(r) { this.rate = clamp(Math.round(r), this.minRate, 99); }

    // Walkers turn when they would step into a blocker's field.
    blockedBy(L, nx) {
      for (const b of this.lemmings) {
        if (b === L || b.state !== 'blocking') continue;
        if (Math.abs(b.y - L.y) > 8) continue;
        const dNew = Math.abs(nx - b.x), dOld = Math.abs(L.x - b.x);
        if (dNew <= 4 && dNew < dOld) return true;
        // A lemming standing right on top of a new blocker is sent back the way
        // the blocker is not facing, so a crowd cannot slip through.
        if (dOld === 0 && L.dir === b.dir) return true;
      }
      return false;
    }

    hazardAt(L) {
      const fx = L.x, fy = L.y - 2;
      for (const h of this.hazards) {
        if (fx >= h.x && fx < h.x + h.w && fy >= h.y && fy < h.y + h.h) {
          L.cause = h.type === 'water' ? 'drown' : h.type;
          L.bomb = -1; L.umbrella = false;
          L.setState('drowning');
          this.emit(h.type === 'water' ? 'drown' : 'burn', L, { hazard: h.type });
          return true;
        }
      }
      return false;
    }

    kill(L, cause, quiet) {
      if (!L.alive) return;
      L.cause = cause || L.cause;
      L.state = 'dead';
      this.dead++;
      if (!quiet) this.emit('die', L, { cause: L.cause });
    }

    save(L) {
      if (!L.alive) return;
      L.state = 'saved';
      this.saved++;
      this.emit('saved', L);
      if (!this.goalReached && this.saved >= this.required) { this.goalReached = true; this.emit('goal', null); }
    }

    explode(L) {
      if (!L.active) { L.bomb = -1; return; }
      this.terrain.eraseCircle(L.x, L.y - 5, 11);
      this.emit('explode', L);
      this.kill(L, 'bomb', true);
    }

    // Try to give `skill` to lemming L. Returns '' on success or a reason.
    assign(L, skill) {
      if (this.over) return 'banen er slut';
      if (!this.skills[skill]) return 'ingen tilbage';
      const why = GL.canAssign(L, skill, this);
      if (why) return why;
      GL.applySkill(L, skill, this);
      this.skills[skill]--;
      this.emit('assign', L, { skill });
      return '';
    }

    // Nuke: every lemming gets a bomb, one per tick, and release stops.
    nuke() {
      if (this.nuking || this.over) return;
      this.nuking = true;
      this.nukeQueue = this.lemmings.filter(L => L.active && L.bomb < 0);
      this.emit('nuke', null);
    }

    release() {
      const e = this.entrances[this.nextEntrance % this.entrances.length];
      this.nextEntrance++;
      const L = new GL.Lemming(e.x, e.y, e.dir);
      this.lemmings.push(L);
      this.released++;
      this.emit('release', L);
    }

    step() {
      if (this.over) return;
      this.tick++;
      this.hatchOpen = Math.min(1, this.tick / HATCH_TICKS);
      if (this.tick === 1) this.emit('hatch', null);

      if (!this.nuking && this.releasing && this.released < this.count) {
        if (--this.nextRelease <= 0) {
          this.release();
          this.nextRelease = GL.releaseInterval(this.rate);
        }
      }
      if (this.nuking && this.nukeQueue.length) {
        const L = this.nukeQueue.shift();
        if (L.active && L.bomb < 0) L.bomb = C.BOMB_TICKS;
      }

      for (let i = 0; i < this.lemmings.length; i++) {
        const L = this.lemmings[i];
        if (L.alive) GL.updateLemming(L, this);
      }
      // Drop finished lemmings occasionally to keep the list small.
      if (this.tick % 100 === 0) this.lemmings = this.lemmings.filter(L => L.alive);

      this.checkEnd();
    }

    checkEnd() {
      if (this.endTimer > 0) {
        if (--this.endTimer === 0) this.finish(this.endReason);
        return;
      }
      if (this.timeLimit && this.tick >= this.timeLimit) { this.finish('time'); return; }

      let alive = 0, busy = 0;
      for (const L of this.lemmings) {
        if (!L.alive) continue;
        alive++;
        if (L.state !== 'blocking') busy++;
      }
      const toCome = this.remainingToRelease;
      if (toCome === 0 && alive === 0) { this.scheduleEnd('done', 20); return; }
      // Only blockers left: nothing more can happen.
      if (toCome === 0 && busy === 0 && !this.lemmings.some(L => L.alive && L.bomb > 0)) { this.scheduleEnd('done', 40); return; }
      // Goal can no longer be reached (during a nuke, let the bombs go off first).
      if (!this.nuking && this.saved + alive + toCome < this.required) this.scheduleEnd('impossible', 40);
    }

    scheduleEnd(reason, ticks) { this.endReason = reason; this.endTimer = ticks; }

    finish(reason) {
      if (this.over) return;
      this.over = true;
      const won = this.saved >= this.required;
      this.result = {
        reason, won,
        saved: this.saved, dead: this.dead, total: this.count, required: this.required,
        released: this.released,
        stars: GL.starsFor(this.def, this.saved),
        timeUsed: this.tick / C.TPS,
      };
      this.emit(won ? 'win' : 'lose', null);
    }
  }

  // 1 star = goal, 2 = halfway to best, 3 = best possible (def.best or all).
  GL.starsFor = function (def, saved) {
    if (saved < def.required) return 0;
    const best = def.best || def.count;
    if (saved >= best) return 3;
    if (saved >= Math.ceil((def.required + best) / 2)) return 2;
    return 1;
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  GL.Game = Game;
})(typeof window !== 'undefined' ? (window.GL = window.GL || {}) : (globalThis.GL = globalThis.GL || {}));
