/* GrejsAlley Lemmings — abilities.js
 * The eight skills: definitions for the UI, assignment rules and the
 * state handlers for the skills that are actions (build, bash, mine, dig, block).
 * Climber, floater and bomber are permanent flags/timers handled in lemming.js
 * and game.js.
 */
(function (GL) {
  'use strict';
  const C = GL.CONST;
  const STATES = GL.STATES;

  // Order here = order in the toolbar and the 1..8 hotkeys.
  GL.SKILLS = [
    { id: 'climber', name: 'Klatrer', desc: 'Klatrer op ad lodrette vægge.' },
    { id: 'floater', name: 'Faldskærm', desc: 'Overlever lange fald med faldskærm.' },
    { id: 'bomber', name: 'Bombe', desc: 'Eksploderer efter 5 sekunder og fjerner jord.' },
    { id: 'blocker', name: 'Stopper', desc: 'Står stille og vender de andre om.' },
    { id: 'builder', name: 'Bygger', desc: 'Bygger en trappe med 12 klodser.' },
    { id: 'basher', name: 'Bryder', desc: 'Graver vandret gennem jord.' },
    { id: 'miner', name: 'Minearbejder', desc: 'Graver skråt nedad.' },
    { id: 'digger', name: 'Graver', desc: 'Graver lodret ned.' },
  ];
  GL.SKILL_IDS = GL.SKILLS.map(s => s.id);

  const BUILD_TICKS = 12, BRICKS = 12, BRICK_W = 6, BUILD_STEP = 3;
  const BASH_REACH = 4, BASH_LOOK = 16, TUNNEL_H = 11;

  // States where the lemming stands on ground doing something and can be
  // given a new ground task.
  const GROUND = { walking: 1, shrugging: 1, building: 1, bashing: 1, mining: 1, digging: 1 };

  /* --------------------------- assignment rules --------------------------- */
  // Returns '' if the skill can be assigned, otherwise a short reason.
  GL.canAssign = function (L, skill, g) {
    if (!L.active) return 'utilgængelig';
    switch (skill) {
      case 'climber': return L.climber ? 'kan allerede klatre' : '';
      case 'floater': return L.floater ? 'har allerede faldskærm' : '';
      case 'bomber': return L.bomb >= 0 ? 'tæller allerede ned' : '';
      case 'blocker':
        if (!GROUND[L.state]) return 'skal stå på jorden';
        for (const o of g.lemmings) {
          if (o !== L && o.state === 'blocking' && Math.abs(o.x - L.x) < 10 && Math.abs(o.y - L.y) < 10) return 'for tæt på en anden stopper';
        }
        return '';
      case 'builder': return GROUND[L.state] ? '' : 'skal stå på jorden';
      case 'basher': return GROUND[L.state] && L.state !== 'bashing' ? '' : 'kan ikke bryde nu';
      case 'miner': return GROUND[L.state] && L.state !== 'mining' ? '' : 'kan ikke grave nu';
      case 'digger': return GROUND[L.state] && L.state !== 'digging' ? '' : 'kan ikke grave nu';
    }
    return 'ukendt evne';
  };

  GL.applySkill = function (L, skill, g) {
    switch (skill) {
      case 'climber': L.climber = true; break;
      case 'floater': L.floater = true; break;
      case 'bomber': L.bomb = C.BOMB_TICKS; break;
      case 'blocker': L.setState('blocking'); break;
      case 'builder': L.bricks = BRICKS; L.setState('building'); break;
      case 'basher': L.setState('bashing'); break;
      case 'miner': L.setState('mining'); break;
      case 'digger': L.setState('digging'); break;
    }
  };

  function startFall(L) { L.fall = 0; L.setState('falling'); }

  // After horizontal movement, follow the floor down a little or start falling.
  function settle(L, T) {
    if (T.solid(L.x, L.y)) return true;
    for (let d = 1; d <= C.STEP_DOWN; d++) {
      if (T.solid(L.x, L.y + d)) { L.y += d; return true; }
    }
    startFall(L);
    return false;
  }

  /* -------------------------------- blocker ------------------------------- */
  STATES.blocking = function (L, g) {
    // If the ground under the blocker is removed it falls and stops blocking.
    if (!g.terrain.solid(L.x, L.y)) startFall(L);
  };

  /* -------------------------------- builder ------------------------------- */
  STATES.building = function (L, g) {
    const T = g.terrain;
    if (!T.solid(L.x, L.y)) { startFall(L); return; }
    const phase = L.t % BUILD_TICKS;
    if (phase === 1) {
      // Lay a brick one row above the feet, starting under the lemming.
      for (let i = 0; i < BRICK_W; i++) T.placeBrick(L.x + L.dir * i, L.y - 1);
      L.bricks--;
      g.emit('brick', L);
      if (L.bricks === 2) g.emit('bricksLow', L);
    } else if (phase === 0) {
      // Step up onto the brick and move forward.
      if (T.solid(L.x, L.y - C.LEM_H)) { L.setState('walking'); L.dir = -L.dir; return; } // head bump
      L.y -= 1;
      for (let s = 0; s < BUILD_STEP; s++) {
        const nx = L.x + L.dir;
        if (T.solid(nx, L.y - 1) || T.solid(nx, L.y - C.LEM_H + 1)) {
          // Something in the way. Walking decides: step onto it or turn around.
          L.setState('walking');
          return;
        }
        L.x = nx;
      }
      if (L.bricks <= 0) L.setState('shrugging');
    }
  };

  /* -------------------------------- basher -------------------------------- */
  STATES.bashing = function (L, g) {
    const T = g.terrain;
    if (L.t % 2) return;
    const x0 = L.x + L.dir, x1 = L.x + L.dir * BASH_REACH;
    if (T.steelIn(x0, L.y - C.LEM_H, x1, L.y - 1)) {
      g.emit('steel', L);
      L.dir = -L.dir;
      L.setState('walking');
      return;
    }
    if (T.eraseRect(x0, L.y - TUNNEL_H, x1, L.y - 1)) {
      if (L.t % 6 === 0) g.emit('dig', L);
    }
    L.x += L.dir;
    if (!settle(L, T)) return;
    // Stop when there is nothing left to bash in front.
    if (!T.diggableIn(L.x + L.dir, L.y - C.LEM_H, L.x + L.dir * BASH_LOOK, L.y - 2)) {
      L.setState('walking');
    }
  };

  /* -------------------------------- miner --------------------------------- */
  // Digs diagonally: 2 px forward and 1 px down per stroke.
  STATES.mining = function (L, g) {
    const T = g.terrain;
    if (L.t % 6 !== 0) return;
    const xa = L.x - L.dir, xb = L.x + L.dir * 5;
    if (T.steelIn(xa, L.y - C.LEM_H, xb, L.y + 1) ) {
      g.emit('steel', L);
      L.setState('walking');
      return;
    }
    T.eraseRect(xa, L.y - TUNNEL_H, xb, L.y);
    g.emit('dig', L);
    L.x += L.dir * 2;
    L.y += 1;
    if (L.y >= T.h) { startFall(L); return; }
    settle(L, T);
  };

  /* -------------------------------- digger -------------------------------- */
  // Digs straight down, a 9 px wide hole.
  STATES.digging = function (L, g) {
    const T = g.terrain;
    if (L.t % 3 !== 0) return;
    if (T.steelIn(L.x - 2, L.y, L.x + 2, L.y)) {
      g.emit('steel', L);
      L.setState('walking');
      return;
    }
    const n = T.eraseRect(L.x - 4, L.y, L.x + 4, L.y);
    if (n === 0) { startFall(L); return; }
    if (L.t % 9 === 0) g.emit('dig', L);
    L.y += 1;
    let ground = false;
    for (let x = L.x - 2; x <= L.x + 2; x++) if (T.solid(x, L.y)) { ground = true; break; }
    if (!ground) startFall(L);
  };
})(typeof window !== 'undefined' ? (window.GL = window.GL || {}) : (globalThis.GL = globalThis.GL || {}));
