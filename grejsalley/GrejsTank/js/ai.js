/* =====================================================================
 * GREJS TANKS - ai.js
 * Enemy AI. Uses the real ballistic simulation (gravity, wind,
 * terrain collision) to search angle/power for each usable weapon,
 * picks the best weapon for the situation and then adds human-like
 * error that shrinks as the AI "adjusts" its aim over turns and as
 * difficulty rises.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const U = GT.U;
  const PH = GT.Physics;

  function gauss() {
    // standard normal distribution (Box-Muller), clamped to +-2.5 sigma
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return U.clamp(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v), -2.5, 2.5);
  }

  const AI = (GT.AI = {
    /** choose the target (nearest living opponent) */
    target(b, t) {
      let best = null, bd = 1e9;
      for (const o of b.tanks) {
        if (!o.alive || o.team === t.team) continue;
        const d = Math.abs(o.x - t.x);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    },

    /** movement decision. returns target x or null */
    decideMove(b, t) {
      const tgt = this.target(b, t);
      if (!tgt) return null;
      const T = b.terrain;
      const reach = t.maxFuel * 0.9;
      if (t.ai === 'kamikaze') {
        const dir = Math.sign(tgt.x - t.x) || 1;
        return t.x + dir * Math.min(reach, Math.max(0, Math.abs(tgt.x - t.x) - 55));
      }
      // climb out of deep craters
      const yl = T.surfaceY(t.x - 45, t.y - 120), yr = T.surfaceY(t.x + 45, t.y - 120);
      if (t.y - Math.min(yl, yr) > 38 && Math.random() < 0.7) {
        const dir = yl < yr ? -1 : 1;
        return t.x + dir * reach * 0.6;
      }
      if (t.ai === 'mover' && Math.random() < 0.65) return t.x + U.rand(-reach, reach);
      if (t.isBoss) return Math.random() < 0.2 ? t.x + U.rand(-reach, reach) * 0.4 : null;
      if (t.hp < t.maxHp * 0.35 && Math.random() < 0.35) {
        const dir = Math.sign(t.x - tgt.x) || 1;
        return t.x + dir * reach * 0.7;
      }
      if (Math.random() < 0.18) return t.x + U.rand(-reach, reach) * 0.5;
      return null;
    },

    /** simulate a shot for a weapon at angle/power */
    sim(b, t, w, ang, pow) {
      const m = GT.Render.muzzle(t, ang);
      const v = t.launch * (pow / 100) * w.speed;
      const a = U.rad(ang);
      return PH.simulate({
        x: m.x, y: m.y, vx: Math.cos(a) * v, vy: -Math.sin(a) * v,
        g: b.gravity * w.grav, wind: b.windAcc() * w.wind,
        terrain: b.terrain, tanks: b.tanks, ignore: t, maxT: 7, ghost: w.type === 'ghost'
      });
    },

    /** score an impact (lower is better) */
    score(b, t, tgt, w, res) {
      let s;
      if (res.tank === tgt) s = 0;
      else if (res.out) s = 2000;
      else {
        const cx = tgt.x, cy = tgt.y - 15 * tgt.scale;
        s = Math.hypot(res.x - cx, (res.y - cy) * 1.2);
        // drilling weapons are fine landing above the target
        if ((w.type === 'drill' || w.type === 'pierce') && Math.abs(res.x - cx) < 40 && res.y < cy) s *= 0.4;
        if (w.type === 'roll') s = Math.abs(res.x + Math.sign(cx - res.x) * 40 - cx) + Math.abs(res.y - cy) * 0.5;
      }
      if (res.tank && res.tank !== tgt && res.tank.team === t.team) s += 900;
      // don't blow yourself up
      const self = Math.hypot(res.x - t.x, res.y - (t.y - 15));
      const rad = (w.r || 40) * t.radiusMult;
      if (self < rad + 20) s += 1500;
      for (const o of b.tanks) {
        if (o === t || !o.alive || o.team !== t.team) continue;
        if (Math.hypot(res.x - o.x, res.y - o.y) < rad + 15) s += 500;
      }
      return s;
    },

    /** search the best angle/power for a weapon */
    solve(b, t, tgt, w) {
      const dir = tgt.x >= t.x ? 1 : -1;
      if (w.type === 'laser') {
        const m = GT.Render.muzzle(t, dir > 0 ? 10 : 170);
        let ang = U.deg(Math.atan2(-(tgt.y - 16 * tgt.scale - m.py), tgt.x - m.px));
        ang = U.clamp(ang, 0, 180);
        // line of sight check
        const hit = b.terrain.rayHit(m.px, m.py, tgt.x, tgt.y - 16 * tgt.scale, 6);
        return { ang, pow: 70, score: hit && w.id !== 'ab_laser' ? 400 : 0 };
      }
      let best = { score: 1e9, ang: dir > 0 ? 45 : 135, pow: 60 };
      const angs = [];
      for (let a = 8; a <= 86; a += 3) angs.push(a);
      for (const a0 of angs) {
        const ang = dir > 0 ? a0 : 180 - a0;
        for (let pow = 15; pow <= 100; pow += 5) {
          const res = this.sim(b, t, w, ang, pow);
          const sc = this.score(b, t, tgt, w, res);
          if (sc < best.score) best = { score: sc, ang, pow };
        }
      }
      // refine
      const b0 = Object.assign({}, best);
      for (let da = -3; da <= 3; da += 1) {
        for (let dp = -4; dp <= 4; dp += 1) {
          const ang = U.clamp(b0.ang + da, 0, 180), pow = U.clamp(b0.pow + dp, 5, 100);
          const res = this.sim(b, t, w, ang, pow);
          const sc = this.score(b, t, tgt, w, res);
          if (sc < best.score) best = { score: sc, ang, pow };
        }
      }
      return best;
    },

    /** full shot decision: weapon index + angle + power */
    decideShot(b, t) {
      const tgt = this.target(b, t);
      if (!tgt) return null;
      const opts = [];
      t.weapons.forEach((slot, i) => {
        if (slot.ammo === 0) return;
        const w = GT.Weapons.get(slot.id);
        if (w.type === 'dirt') return;
        opts.push({ i, w });
      });
      if (!opts.length) opts.push({ i: 0, w: GT.Weapons.get(t.weapons[0].id) });
      // evaluate primary first; consider specials with some probability
      const results = [];
      for (const o of opts) {
        const special = t.weapons[o.i].ammo > 0;
        if (special && !t.isBoss && Math.random() < 0.45 && results.length) continue;
        const r = this.solve(b, t, tgt, o.w);
        let value = r.score;
        // prefer stronger weapons when they can hit
        value -= Math.min(40, (o.w.dmg * (o.w.count || 1)) / 6);
        if (o.w.good.includes('bunker') && results.length && results[0].score > 60) value -= 60;
        results.push({ o, r, value, score: r.score });
      }
      results.sort((a, b2) => a.value - b2.value);
      const pick = results[0];
      // human-like error: shrinks with accuracy & repeated attempts
      t.shotsAt = (t.shotsAt || 0) + 1;
      // the AI "learns" over its first shots, but never becomes a perfect computer
      const learn = Math.max(0.4, 1 - 0.15 * (t.shotsAt - 1));
      const err = (1 - Math.min(t.acc, t.isBoss ? 0.93 : 0.9)) * learn;
      // occasionally a clearly bad shot (nerves, misjudged wind)
      const wobble = Math.random() < 0.06 ? 2.2 : 1;
      // straight-line weapons are trivial to aim, so give them extra angular error
      const straight = pick.o.w.type === 'laser' ? 4 : 1;
      const ang = U.clamp(pick.r.ang + gauss() * 5 * err * wobble * straight, 0, 180);
      const pow = U.clamp(pick.r.pow + gauss() * 10 * err * wobble, 5, 100);
      return { weapon: pick.o.i, ang, pow, target: tgt };
    }
  });
})();

