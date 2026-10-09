'use strict';
/* =====================================================================
   SUPER GREJS - physics.js
   Tile-koder, fysik-konstanter og kollision mod banens tiles.
   Fysikken kører med fast tidsskridt (1/120 s), så den opfører sig ens
   ved 30, 60 og 144 FPS. Alle konstanter kan finjusteres her.
   ===================================================================== */
SG.physics = (function () {
  const TILE = 16;
  const STEP = 1 / 120;

  // Spillerens bevægelse (enheder: pixels og pixels/sekund)
  const C = {
    WALK_MAX: 96,
    RUN_MAX: 158,
    ACC_WALK: 340,
    ACC_RUN: 430,
    DEC_RELEASE: 400,
    SKID: 960,
    AIR_ACC: 320,
    AIR_DEC: 140,
    ICE_FACTOR: 0.22,      // acceleration/bremsning på is
    JUMP_V: 300,           // hopfart fra stilstand
    JUMP_RUN_BONUS: 40,    // ekstra hopfart ved fuld løbefart
    GRAV_HOLD: 620,        // tyngdekraft mens hop holdes og man stiger
    GRAV_RELEASE: 1900,    // når hop slippes tidligt
    GRAV_FALL: 1500,
    MAX_FALL: 440,
    COYOTE: 0.08,          // man kan stadig hoppe kort efter man er gået ud over en kant
    JUMP_BUFFER: 0.11,     // hop trykket lige før landing tæller
    STOMP_BOUNCE: 230,
    STOMP_BOUNCE_HELD: 340,
    SPRING_V: 520,
    INVULN: 2.0,
    STAR_TIME: 10,
    FIRE_SPEED: 270,
    CONVEYOR: 52,
    CORNER_NUDGE: 5,
  };

  // Tile-koder
  const T = {
    EMPTY: 0, GROUND: 1, BRICK: 2, QBLOCK: 3, USED: 4, HARD: 5, PIPE_L: 6, PIPE_R: 7, SEMI: 8,
    SPIKE: 9, LAVA: 10, ICE: 11, CONV_L: 12, CONV_R: 13, HIDDEN: 14, FAKE: 15, CRUMBLE: 16,
    COIN: 17, SPIKE_DOWN: 18, POISON: 19,
  };
  const SOLID = new Uint8Array(32);
  [T.GROUND, T.BRICK, T.QBLOCK, T.USED, T.HARD, T.PIPE_L, T.PIPE_R, T.SPIKE, T.ICE, T.CONV_L, T.CONV_R, T.CRUMBLE, T.SPIKE_DOWN]
    .forEach(c => { SOLID[c] = 1; });
  const isSolid = c => SOLID[c] === 1;
  const isLiquid = c => c === T.LAVA || c === T.POISON;

  /* ---------------- Rum (et område af en bane) ---------------- */
  function tileAt(room, tx, ty) {
    if (tx < 0 || tx >= room.w) return T.HARD;  // usynlige vægge i siderne
    if (ty < 0 || ty >= room.h) return T.EMPTY; // åbent opad og nedad (hul = død)
    return room.tiles[ty * room.w + tx];
  }
  function setTile(room, tx, ty, code) {
    if (tx < 0 || tx >= room.w || ty < 0 || ty >= room.h) return;
    room.tiles[ty * room.w + tx] = code;
  }

  /* -----------------------------------------------------------------
     Flyt et legeme (x, y, w, h, vx, vy) og løs kollisioner akse for akse.
     opts.semi:    kollidér med halvfaste platforme (oppefra)
     opts.hidden:  skjulte blokke er faste ved stød nedefra (spilleren)
     opts.corner:  hjørne-korrektion ved hovedstød (spilleren)
     Returnerer info om væg, loft og landing.
     ----------------------------------------------------------------- */
  function move(room, b, dt, opts) {
    opts = opts || {};
    const res = { wallL: false, wallR: false, ceiling: false, head: [], landed: false, ground: -1, groundTiles: [], wallTiles: [] };
    const prevBottom = b.y + b.h;
    const prevTop = b.y;

    // --- X ---
    if (b.vx !== 0) {
      b.x += b.vx * dt;
      const y0 = Math.floor((b.y + 1) / TILE), y1 = Math.floor((b.y + b.h - 1) / TILE);
      if (b.vx > 0) {
        const tx = Math.floor((b.x + b.w) / TILE);
        for (let ty = y0; ty <= y1; ty++) {
          const c = tileAt(room, tx, ty);
          if (isSolid(c)) { b.x = tx * TILE - b.w; res.wallR = true; res.wallTiles.push([tx, ty, c]); break; }
        }
      } else {
        const tx = Math.floor(b.x / TILE);
        for (let ty = y0; ty <= y1; ty++) {
          const c = tileAt(room, tx, ty);
          if (isSolid(c)) { b.x = (tx + 1) * TILE; res.wallL = true; res.wallTiles.push([tx, ty, c]); break; }
        }
      }
      if (res.wallL || res.wallR) b.vx = 0;
    }

    // --- Y ---
    b.y += b.vy * dt;
    const x0 = Math.floor((b.x + 0.01) / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
    if (b.vy > 0) {
      const ty = Math.floor((b.y + b.h) / TILE);
      const tileTop = ty * TILE;
      let hit = false;
      for (let tx = x0; tx <= x1; tx++) {
        const c = tileAt(room, tx, ty);
        if (isSolid(c) || (opts.semi !== false && c === T.SEMI && prevBottom <= tileTop + 0.5)) {
          hit = true;
          res.groundTiles.push([tx, ty, c]);
        }
      }
      if (hit) {
        b.y = tileTop - b.h;
        b.vy = 0;
        res.landed = true;
        res.ground = pickGround(res.groundTiles, b);
      }
    } else if (b.vy < 0) {
      const ty = Math.floor(b.y / TILE);
      const tileBottom = (ty + 1) * TILE;
      for (let tx = x0; tx <= x1; tx++) {
        const c = tileAt(room, tx, ty);
        const hiddenHit = opts.hidden && c === T.HIDDEN && prevTop >= tileBottom - 0.5;
        if (isSolid(c) || hiddenHit) res.head.push([tx, ty, c]);
      }
      if (res.head.length && opts.corner) {
        // Hjørne-korrektion: rammer man kun en kant af en blok med få pixels, skubbes man forbi.
        if (res.head.length === 1) {
          const [hx] = res.head[0];
          const overlapL = (hx + 1) * TILE - b.x;          // blokken er til venstre for midten
          const overlapR = b.x + b.w - hx * TILE;          // blokken er til højre
          const freeAt = nx => !isSolid(tileAt(room, Math.floor(nx / TILE), ty)) && !isSolid(tileAt(room, Math.floor((nx + b.w - 0.01) / TILE), ty));
          if (hx * TILE <= b.x && overlapL <= C.CORNER_NUDGE && freeAt(b.x + overlapL)) {
            b.x += overlapL; res.head.length = 0;
          } else if (hx * TILE >= b.x && overlapR <= C.CORNER_NUDGE && freeAt(b.x - overlapR)) {
            b.x -= overlapR; res.head.length = 0;
          }
        }
      }
      if (res.head.length) {
        b.y = tileBottom;
        b.vy = 0;
        res.ceiling = true;
      }
    }

    // Stå stille på jorden: tjek 1 px under fødderne
    if (!res.landed && b.vy === 0) {
      const ty = Math.floor((b.y + b.h + 1) / TILE);
      const tileTop = ty * TILE;
      if (Math.abs(b.y + b.h - tileTop) < 0.6) {
        for (let tx = x0; tx <= x1; tx++) {
          const c = tileAt(room, tx, ty);
          if (isSolid(c) || (opts.semi !== false && c === T.SEMI)) res.groundTiles.push([tx, ty, c]);
        }
        if (res.groundTiles.length) { res.landed = true; res.ground = pickGround(res.groundTiles, b); }
      }
    }
    return res;
  }

  // Den tile man mest står på (bruges til is, transportbånd, pigge, smuldrende blokke).
  function pickGround(list, b) {
    let best = list[0], bestOv = -1;
    const cx = b.x + b.w / 2;
    list.forEach(t => {
      const ov = TILE - Math.abs(t[0] * TILE + TILE / 2 - cx);
      if (ov > bestOv) { bestOv = ov; best = t; }
    });
    return best[2];
  }

  // Er der fast grund lige foran (til fjender, der vender ved kanter)?
  function groundAhead(room, b, dir) {
    const fx = dir > 0 ? b.x + b.w + 1 : b.x - 1;
    const tx = Math.floor(fx / TILE);
    const ty = Math.floor((b.y + b.h + 2) / TILE);
    const c = tileAt(room, tx, ty);
    return isSolid(c) || c === T.SEMI;
  }

  // Overlapper kroppen væske (lava/sump)? Kun den nederste del tæller.
  function inLiquid(room, b) {
    const ty = Math.floor((b.y + b.h - 3) / TILE);
    const x0 = Math.floor((b.x + 3) / TILE), x1 = Math.floor((b.x + b.w - 3) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      const c = tileAt(room, tx, ty);
      if (isLiquid(c)) {
        const surface = ty * TILE + (isLiquid(tileAt(room, tx, ty - 1)) ? 0 : 6);
        if (b.y + b.h - 3 > surface) return true;
      }
    }
    return false;
  }

  return { TILE, STEP, C, T, isSolid, isLiquid, tileAt, setTile, move, groundAhead, inLiquid };
})();
