/* Headless level verifier for GrejsAlley Lemmings.
 * Runs every level through the real simulation with a scripted solution and
 * checks that the goal (and ideally the "best" count) can be reached.
 *
 *   node tools/verify.js            all levels
 *   node tools/verify.js ice-1 -v   one level, verbose
 *
 * Solution steps: { s: skill, x, dir, ymin, ymax, state, n, wait, delay, who }
 *   x/dir/ymin/ymax/state  conditions on the lemming
 *   n       how many lemmings get it (default 1)
 *   wait    false = active immediately, otherwise after the previous step is done
 *   delay   ticks to wait after the previous step finished
 *   who     'blocker' = target a blocking lemming, 'prev' = the lemming of the previous step
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'js');
const ctx = { console, Math, Object, Array, Uint8Array, Infinity, Error };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['level.js', 'lemming.js', 'abilities.js', 'game.js', 'levels-data.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const GL = ctx.GL;

const SOLUTIONS = {
  'hills-1': [],
  'hills-2': [{ s: 'digger', x: 280, dir: 1 }],
  'hills-3': [{ s: 'builder', x: 270, dir: 1 }],
  'hills-4': [{ s: 'blocker', x: 230, dir: 1 }],
  'caves-1': [{ s: 'climber', x: 150, dir: 1, n: 10 }],
  'caves-2': [{ s: 'floater', x: 120, dir: 1, n: 10 }],
  'caves-3': [{ s: 'basher', x: 215, dir: 1 }],
  'caves-4': [{ s: 'miner', x: 200, dir: 1 }],
  'ice-1': [
    { s: 'builder', x: 196, dir: 1 },
    { s: 'blocker', x: 150, dir: 1 },
    { s: 'builder', who: 'first', state: 'shrugging', wait: false },
    { s: 'bomber', who: 'blocker', delay: 500 },
  ],
  'ice-2': [{ s: 'digger', x: 220, dir: 1 }, { s: 'basher', x: 290, dir: 1, ymin: 110 }],
  'ice-3': [{ s: 'climber', x: 120, dir: 1, n: 8 }, { s: 'floater', x: 160, dir: 1, n: 8, wait: false }],
  'ice-4': [{ s: 'bomber', x: 232, dir: 1 }],
  'desert-1': [{ s: 'digger', x: 305, dir: 1 }, { s: 'basher', x: 215, dir: -1, ymin: 120 }],
  'desert-2': [{ s: 'blocker', x: 458, dir: 1 }, { s: 'basher', x: 445, dir: -1, ymin: 120 }],
  'desert-3': [{ s: 'bomber', x: 101, dir: 1, ymin: 60, ymax: 72 }, { s: 'builder', x: 330, dir: 1, ymin: 118 }, { s: 'builder', who: 'prev', state: 'shrugging' }],
  'desert-4': [
    { s: 'miner', x: 100, dir: 1 },
    { s: 'blocker', x: 290, dir: 1, ymin: 130, skip: 1 },
    { s: 'builder', x: 327, dir: 1, ymin: 130, wait: false },
    { s: 'basher', x: 455, dir: 1, ymin: 125 },
    { s: 'bomber', who: 'blocker', delay: 200 },
  ],
  'industry-1': [{ s: 'digger', x: 310, dir: 1 }, { s: 'basher', x: 425, dir: 1, ymin: 105 }, { s: 'miner', x: 490, dir: 1, ymin: 105 }],
  'industry-2': [
    { s: 'builder', x: 300, dir: 1 },
    { s: 'blocker', x: 150, dir: -1, wait: false },
    { s: 'builder', who: 'first', state: 'shrugging', wait: false },
    { s: 'builder', who: 'first', state: 'shrugging', wait: false },
  ],
  'industry-3': [{ s: 'digger', x: 220, dir: 1 }, { s: 'blocker', x: 288, dir: 1, ymin: 135 }, { s: 'miner', x: 200, dir: -1, ymin: 135 }],
  'industry-4': [
    { s: 'builder', x: 216, dir: 1 },
    { s: 'blocker', x: 180, dir: 1 },
    { s: 'digger', x: 420, dir: 1, ymin: 60, ymax: 70 },
    { s: 'basher', x: 550, dir: 1, ymin: 120 },
    { s: 'miner', x: 612, dir: 1, ymin: 120 },
    { s: 'bomber', who: 'blocker', delay: 400 },
  ],
};

function run(def, steps, verbose) {
  const g = new GL.Game(def);
  const st = steps.map(s => Object.assign({ n: 1, done: 0, finishedAt: -1 }, s));
  let firstLem = null, prevLem = null;
  const log = [];
  let guard = 0;
  while (!g.over && guard++ < 20 * 60 * 15) {
    if (!firstLem && g.lemmings.length) firstLem = g.lemmings[0];
    for (let i = 0; i < st.length; i++) {
      const s = st[i];
      if (s.done >= s.n) continue;
      const prev = st[i - 1];
      if (i > 0 && s.wait !== false && prev.done < prev.n) continue;
      if (i > 0 && s.delay && (prev.finishedAt < 0 || g.tick - prev.finishedAt < s.delay)) continue;
      for (const L of g.lemmings) {
        if (!L.active) continue;
        if (s.who === 'first' && L !== firstLem) continue;
        if (s.who === 'prev' && L !== prevLem) continue;
        if (s.who === 'blocker' && L.state !== 'blocking') continue;
        if (s.x !== undefined && L.x !== s.x) continue;
        if (s.dir !== undefined && L.dir !== s.dir) continue;
        if (s.ymin !== undefined && L.y < s.ymin) continue;
        if (s.ymax !== undefined && L.y > s.ymax) continue;
        if (s.state && L.state !== s.state) continue;
        if (!s.state && s.who !== 'blocker' && L.state !== 'walking') continue;
        if (s._used && s._used.has(L.id)) continue;
        if (s.skip && (s._skipped = s._skipped || new Set()).size < s.skip && !s._skipped.has(L.id)) { s._skipped.add(L.id); continue; }
        if (s._skipped && s._skipped.has(L.id) && s.skip) continue;
        const why = g.assign(L, s.s);
        if (!why) {
          (s._used = s._used || new Set()).add(L.id);
          s.done++; prevLem = L;
          log.push(`t=${g.tick} ${s.s} -> #${L.id} at (${L.x},${L.y})`);
          if (s.done >= s.n) s.finishedAt = g.tick;
          if (s.done >= s.n) break;
        }
      }
    }
    g.step();
  }
  const deaths = {};
  for (const e of g.events) if (e.type === 'die' || e.type === 'drown' || e.type === 'burn' || e.type === 'splat' || e.type === 'explode') deaths[e.type] = (deaths[e.type] || 0) + 1;
  if (verbose) {
    console.log(log.join('\n'));
    for (const e of g.events) if (['die', 'drown', 'burn', 'splat', 'explode', 'steel'].includes(e.type)) console.log('  ', e.type, '#' + (e.lem && e.lem.id), 'at', e.x, e.y, e.cause || '');
  }
  return { g, log, steps: st };
}

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const only = args.filter(a => !a.startsWith('-'));
let fail = 0;
const ids = new Set();
for (const def of GL.LEVELS) {
  if (ids.has(def.id)) { console.log('DUPLIKAT id', def.id); fail++; }
  ids.add(def.id);
  if (only.length && !only.includes(def.id)) continue;
  const errs = GL.Level.validate(def);
  if (errs.length) { console.log(def.id, 'UGYLDIG:', errs.join(', ')); fail++; continue; }
  const sol = SOLUTIONS[def.id];
  if (!sol) { console.log(def.id, 'mangler løsning'); fail++; continue; }
  // Skill budget sanity: the solution must not use more than available.
  const { g, steps } = run(def, sol, verbose);
  const r = g.result || {};
  const unused = steps.filter(s => s.done < s.n).map(s => s.s);
  const best = def.best || def.count;
  // A level that needs skills must not be winnable by doing nothing.
  let trivial = false;
  if (sol.length) trivial = !!run(def, [], false).g.result.won;
  if (trivial) { console.log(`FAIL ${def.id} kan vindes uden at gøre noget`); fail++; }
  const ok = r.won;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${def.id.padEnd(12)} reddet ${r.saved}/${r.total} (krav ${r.required}, bedst ${best}) døde ${r.dead} tid ${Math.round(r.timeUsed)}s grund=${r.reason}${r.saved < best ? '  [under bedst]' : ''}${unused.length ? '  ubrugte trin: ' + unused.join(',') : ''}`);
}
process.exit(fail ? 1 : 0);
