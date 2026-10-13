/* GrejsAlley Lemmings — lemming.js
 * The Lemming (called "grejs" in the UI) and its basic movement states:
 * walking, falling, climbing, shrugging, exiting, drowning and splatting.
 * Skill-specific states live in abilities.js and register into GL.STATES.
 *
 * Coordinates: (x, y) is the foot position. y is the row of the ground pixel
 * the lemming stands on, so the body occupies rows y-10 .. y-1.
 */
(function (GL) {
  'use strict';

  const C = GL.CONST = {
    TPS: 20,            // simulation ticks per second (at 1x speed)
    LEM_H: 10,          // body height in level pixels
    STEP_UP: 6,         // max rise a walker can step up; higher = wall
    STEP_DOWN: 3,       // max drop handled as walking; more = falling
    SPLAT: 60,          // falls longer than this kill (unless floating)
    FALL_SPEED: 3,      // px per tick while falling
    FLOAT_OPEN: 12,     // fall distance before the parachute opens
    BOMB_TICKS: 100,    // 5 seconds fuse
    EXIT_RANGE: 3,
  };

  let nextId = 1;
  class Lemming {
    constructor(x, y, dir) {
      this.id = nextId++;
      this.x = x; this.y = y;
      this.px = x; this.py = y;   // previous position (render interpolation)
      this.dir = dir || 1;
      this.state = 'falling';
      this.t = 0;                 // ticks in current state
      this.anim = 0;              // total ticks alive (animation clock)
      this.fall = 0;              // distance fallen in current fall
      this.climber = false;
      this.floater = false;
      this.umbrella = false;      // parachute currently open
      this.bomb = -1;             // fuse ticks left, -1 = no bomb
      this.bricks = 0;
      this.cause = '';            // death cause for effects/stats
    }
    get alive() { return this.state !== 'dead' && this.state !== 'saved'; }
    // Lemmings that can still be saved / affect the level
    get active() { return this.alive && this.state !== 'exiting' && this.state !== 'drowning' && this.state !== 'splatting'; }
    setState(s) { this.state = s; this.t = 0; }
  }
  GL.Lemming = Lemming;

  const STATES = GL.STATES = GL.STATES || {};

  /* --------------------------------- walking --------------------------------- */
  STATES.walking = function (L, g) {
    const T = g.terrain;
    const nx = L.x + L.dir;

    if (g.blockedBy(L, nx)) { L.dir = -L.dir; return; }

    if (T.solid(nx, L.y - 1)) {
      // Terrain in front at foot level: step up if it is low enough, otherwise it is a wall.
      let rise = 1;
      while (rise <= C.STEP_UP && T.solid(nx, L.y - 1 - rise)) rise++;
      if (rise > C.STEP_UP) {
        // The level's side edges are not climbable.
        if (L.climber && nx >= 0 && nx < T.w && !T.solid(L.x, L.y - C.LEM_H - 1)) { L.setState('climbing'); }
        else L.dir = -L.dir;
        return;
      }
      L.x = nx; L.y -= rise;
      return;
    }
    if (T.solid(nx, L.y)) { L.x = nx; return; }
    // Ground drops away: small drops are walked, larger ones become a fall.
    for (let d = 1; d <= C.STEP_DOWN; d++) {
      if (T.solid(nx, L.y + d)) { L.x = nx; L.y += d; return; }
    }
    L.x = nx;
    L.fall = 0;
    L.setState('falling');
  };

  /* --------------------------------- falling --------------------------------- */
  STATES.falling = function (L, g) {
    const T = g.terrain;
    if (L.floater && !L.umbrella && L.fall >= C.FLOAT_OPEN) { L.umbrella = true; g.emit('umbrella', L); }
    const speed = L.umbrella ? (L.t % 2 ? 2 : 1) : C.FALL_SPEED;
    for (let i = 0; i < speed; i++) {
      if (T.solid(L.x, L.y)) break;
      L.y++; L.fall++;
      if (g.hazardAt(L)) return;           // landed in water/lava/acid
      if (L.y >= T.h + C.LEM_H) { g.kill(L, 'fell'); return; }
    }
    if (T.solid(L.x, L.y)) {
      if (L.fall > C.SPLAT && !L.umbrella) {
        L.setState('splatting'); L.cause = 'splat'; g.emit('splat', L);
      } else {
        if (L.fall > 4) g.emit('land', L);
        L.setState('walking');
      }
      L.fall = 0; L.umbrella = false;
    }
  };

  /* -------------------------------- climbing --------------------------------- */
  STATES.climbing = function (L, g) {
    const T = g.terrain;
    if (L.t % 3 === 2) return;             // climb at 2/3 speed
    if (T.solid(L.x, L.y - C.LEM_H - 1) || L.y - C.LEM_H - 1 < 0) {
      // Head hits an overhang (or the top of the level): let go and fall backwards.
      L.dir = -L.dir;
      L.fall = 0;
      L.setState('falling');
      return;
    }
    L.y--;
    if (!T.solid(L.x + L.dir, L.y - 1)) {
      // Reached the top of the wall (or the wall was dug away): hoist over the
      // edge. If there is no ground there, walking turns it into a fall.
      L.x += L.dir;
      L.setState('walking');
    }
  };

  /* -------------------------------- shrugging -------------------------------- */
  // Builder ran out of bricks: short shrug, then keep walking.
  STATES.shrugging = function (L, g) {
    if (!g.terrain.solid(L.x, L.y)) { L.fall = 0; L.setState('falling'); return; }
    if (L.t >= 12) L.setState('walking');
  };

  /* --------------------------- terminal animations --------------------------- */
  STATES.exiting = function (L, g) { if (L.t >= 12) g.save(L); };
  STATES.drowning = function (L, g) { if (L.t >= 22) g.kill(L, L.cause || 'drown', true); };
  STATES.splatting = function (L, g) { if (L.t >= 16) g.kill(L, 'splat', true); };
  STATES.dead = function () {};
  STATES.saved = function () {};

  /* ------------------------------ update dispatch ---------------------------- */
  GL.updateLemming = function (L, g) {
    L.px = L.x; L.py = L.y;
    L.anim++;
    L.t++;

    // Bomb fuse runs regardless of what the lemming is doing.
    if (L.bomb > 0 && L.active) {
      L.bomb--;
      if (L.bomb === 0) { g.explode(L); return; }
    }

    const fn = STATES[L.state];
    if (fn) fn(L, g);
    if (!L.active) return;

    // Exits and hazards after movement.
    if (L.state === 'walking' || L.state === 'falling' || L.state === 'shrugging') {
      for (const e of g.exits) {
        if (Math.abs(L.x - e.x) <= C.EXIT_RANGE && L.y >= e.y - 8 && L.y <= e.y + 3) {
          L.setState('exiting'); L.bomb = -1; L.umbrella = false;
          g.emit('exit', L);
          return;
        }
      }
    }
    if (g.hazardAt(L)) return;
    if (L.y >= g.terrain.h + C.LEM_H) g.kill(L, 'fell');
  };
})(typeof window !== 'undefined' ? (window.GL = window.GL || {}) : (globalThis.GL = globalThis.GL || {}));
