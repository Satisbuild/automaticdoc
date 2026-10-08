'use strict';
/* GREJS BASE BUILDER - home.js: village scene, input, placement, HUD */

/* =====================================================================
   HOME VILLAGE SCENE
   ===================================================================== */
const Home = {
  sel: null,        // selected building id
  place: null,      // { t, x, y, walls: [] }
  drag: null,       // { i, x, y, ox, oy } moving a building
  workers: [],
  theme: null,
};
function homeTheme() { return { name: 'Grejs Plains', ground: '#6cbf4a', ground2: '#64b444', accent: '#ffd23f' }; }

function displayRes() {
  const me = S.me;
  if (!me) return { gold: 0, elixir: 0, dark: 0 };
  const h = Math.max(0, (Date.now() - S.meAt) / 3600e3);
  const out = {};
  const prod = { gold: 0, elixir: 0, dark: 0 };
  for (const b of me.buildings) { const d = D.bdef(b.t); if (d && d.prod && b.lv > 0) prod[d.prod] += D.production(b.t, b.lv); }
  for (const r of D.RES) out[r] = me.res[r] >= me.caps[r] ? me.res[r] : Math.min(me.caps[r], me.res[r] + prod[r] * h);
  for (const r of D.ORES) out[r] = me.res[r] || 0;
  return out;
}
function jobFor(i) { return S.me ? S.me.jobs.find(j => j.kind === 'b' && j.b === i) : null; }
function heroBusy(id) { return S.me && S.me.jobs.some(j => j.kind === 'h' && j.hero === id); }
function freeBuilders() { return S.me ? S.me.builders - S.me.jobs.length : 0; }
function countBuilt(t) { return S.me.buildings.filter(b => b.t === t).length; }
function bestLv(t) { return S.me.buildings.reduce((m, b) => (b.t === t && b.lv > m ? b.lv : m), 0); }

/* collision check for the local preview (the server checks again) */
function spotFree(t, x, y, ignore, extra) {
  const s = D.bdef(t).size;
  if (x < 0 || y < 0 || x + s > D.GRID || y + s > D.GRID) return false;
  for (const b of S.me.buildings) {
    if (b.i === ignore) continue;
    const bs = D.bdef(b.t).size;
    if (x < b.x + bs && x + s > b.x && y < b.y + bs && y + s > b.y) return false;
  }
  if (extra) for (const w of extra) if (w.x >= x && w.x < x + s && w.y >= y && w.y < y + s) return false;
  return true;
}
function pickBuilding(sx, sy) {
  const [tx, ty] = screenToTile(sx, sy);
  const list = S.scene === 'home' ? S.me.buildings : [];
  for (let k = 0; k <= 4; k++) {
    const x = tx + k * 0.45, y = ty + k * 0.45;
    let best = null;
    for (const b of list) {
      const s = D.bdef(b.t).size;
      if (x >= b.x && x < b.x + s && y >= b.y && y < b.y + s) { if (!best || b.x + b.y > best.x + best.y) best = b; }
    }
    if (best) return best;
  }
  return null;
}

function updateWorkers(dt, t) {
  const me = S.me; if (!me) return;
  const huts = me.buildings.filter(b => b.t === 'builderhut' && b.lv > 0);
  while (Home.workers.length < huts.length) Home.workers.push({ x: 20, y: 20, tx: 20, ty: 20, job: null, wait: 0, face: 1 });
  Home.workers.length = huts.length;
  const sites = [];
  for (const j of me.jobs) {
    if (j.kind === 'b') { const b = me.buildings.find(x => x.i === j.b); if (b) sites.push(b); }
    else { const alt = me.buildings.find(x => D.bdef(x.t).hero === j.hero); if (alt) sites.push(alt); }
  }
  Home.workers.forEach((w, i) => {
    const site = sites[i], hut = huts[i];
    if (site) {
      const s = D.bdef(site.t).size;
      w.tx = site.x + s + 0.2; w.ty = site.y + s * 0.5 + (i % 2 ? -0.3 : 0.3);
    } else if (w.wait <= 0) {
      w.tx = hut.x + 1 + rand(-1.5, 2.5); w.ty = hut.y + 2.3 + rand(-0.5, 1.5); w.wait = rand(2, 5);
    }
    w.wait -= dt;
    const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
    if (d > 0.05) { const m = Math.min(d, dt * 2.2); w.x += dx / d * m; w.y += dy / d * m; w.face = dx - dy >= 0 ? 1 : -1; w.walking = true; }
    else { w.walking = false; w.building = !!site; }
    if (w.building && Math.random() < dt * 3) burst(w.x - 0.2, w.y, 3, { col: '#ffe27a', size: 2, speed: 40, up: 60, g: 200, life: 0.4, kind: 'spark' });
  });
}
function drawWorker(c, w, t) {
  const [wx, wy] = iso(w.x, w.y);
  c.save(); c.translate(wx, wy); if (w.face < 0) c.scale(-1, 1);
  const k = 0.9, bob = w.walking ? Math.abs(Math.sin(t * 10)) * 2 : 0;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 0, 6, 3, 0, 0, 7); c.fill();
  c.translate(0, -bob);
  c.fillStyle = '#2a4a8a'; c.fillRect(-3.5 * k, -6 * k, 3 * k, 6 * k); c.fillRect(0.5 * k, -6 * k, 3 * k, 6 * k);
  c.fillStyle = '#2a6fd0'; c.strokeStyle = OUT; c.beginPath(); c.ellipse(0, -10 * k, 6 * k, 6.5 * k, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#f2c08a'; c.beginPath(); c.arc(0, -19 * k, 5 * k, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#ffcf3a'; c.beginPath(); c.arc(0, -21 * k, 5.4 * k, Math.PI, 0); c.fill(); c.stroke();
  c.fillStyle = '#5a3a20'; c.fillRect(-2 * k, 1.8 * k - 19 * k, 5 * k, 1.5 * k);
  const sw = w.building ? Math.sin(t * 14) * 0.9 : 0.3;
  c.save(); c.translate(5 * k, -11 * k); c.rotate(sw - 0.4);
  c.fillStyle = '#8a5a2b'; c.fillRect(0, -10 * k, 2 * k, 11 * k); c.fillStyle = '#9aa3ad'; c.fillRect(-2.5 * k, -12 * k, 7 * k, 3.5 * k);
  c.restore(); c.restore();
}

/* build the depth-sorted draw list for the home village */
function homeDraw(c, t, dt) {
  const me = S.me;
  if (!me) return;
  const items = [];
  const res = displayRes();
  const fillOf = r => clamp(Math.round(4 * res[r] / Math.max(1, me.caps[r])), 0, 4);
  const walls = new Set();
  for (const b of me.buildings) if (b.t === 'wall') walls.add(b.x + ',' + b.y);
  const moving = Home.drag;
  for (const b of me.buildings) {
    const s = D.bdef(b.t).size;
    let x = b.x, y = b.y;
    if (moving && moving.i === b.i) { x = moving.x; y = moving.y; }
    items.push([x + y + s, () => drawHomeBuilding(c, b, x, y, s, t, walls, fillOf)]);
  }
  for (const w of Home.workers) items.push([w.x + w.y, () => drawWorker(c, w, t)]);
  if (Home.place) {
    const p = Home.place, s = D.bdef(p.t).size;
    for (const w of p.walls) items.push([w.x + w.y + 1, () => blit(c, wallSprite(1, 0), ...iso(w.x, w.y), 0.85)]);
    items.push([p.x + p.y + s + 100, () => drawGhost(c, p.t, p.x, p.y, spotFree(p.t, p.x, p.y, null, p.walls), t)]);
  }
  items.sort((a, b) => a[0] - b[0]);
  // ground markers under everything selected
  if (Home.sel != null || moving) {
    const b = me.buildings.find(x => x.i === (moving ? moving.i : Home.sel));
    if (b) {
      const s = D.bdef(b.t).size, x = moving ? moving.x : b.x, y = moving ? moving.y : b.y;
      const ok = !moving || spotFree(b.t, x, y, b.i);
      footprint(c, x, y, s, ok ? 'rgba(120,255,120,.35)' : 'rgba(255,80,80,.45)', ok ? '#9cff6b' : '#ff5a4a');
      const a = D.bdef(b.t).atk && D.atkStats(b.t, b.lv);
      if (a && !moving) rangeRing(c, x + s / 2, y + s / 2, a.range + s / 2, a.min);
    }
  }
  for (const it of items) it[1]();
}
function footprint(c, x, y, s, fill, stroke) {
  poly(c, [iso(x, y), iso(x + s, y), iso(x + s, y + s), iso(x, y + s)], fill, stroke, 2.5);
}
function rangeRing(c, cx, cy, r, min) {
  const [wx, wy] = iso(cx, cy);
  c.save(); c.setLineDash([8, 6]); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(wx, wy, r * CRX, r * CRY, 0, 0, 7); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.07)'; c.fill();
  if (min) { c.strokeStyle = 'rgba(255,90,74,.7)'; c.beginPath(); c.ellipse(wx, wy, min * CRX, min * CRY, 0, 0, 7); c.stroke(); }
  c.restore();
}
function drawGhost(c, t, x, y, ok, time) {
  const s = D.bdef(t).size;
  footprint(c, x, y, s, ok ? 'rgba(120,255,120,.4)' : 'rgba(255,80,80,.5)', ok ? '#9cff6b' : '#ff5a4a');
  const [wx, wy] = iso(x, y);
  blit(c, t === 'wall' ? wallSprite(1, 0) : spriteFor(t, 1, 0, true), wx, wy - 6 - Math.sin(time * 5) * 3, 0.75);
}
function drawHomeBuilding(c, b, x, y, s, t, walls, fillOf) {
  const [wx, wy] = iso(x, y);
  const job = jobFor(b.i);
  if (b.t === 'wall') {
    const mask = (walls.has((b.x + 1) + ',' + b.y) ? 1 : 0) | (walls.has(b.x + ',' + (b.y + 1)) ? 2 : 0);
    blit(c, wallSprite(Math.max(1, b.lv), Home.drag && Home.drag.i === b.i ? 0 : mask), wx, wy);
    return;
  }
  const d = D.bdef(b.t);
  const fill = d.store ? fillOf(d.store) : 0;
  const sp = spriteFor(b.t, Math.max(1, b.lv), fill, true);
  if (b.lv === 0) {
    blit(c, sp, wx, wy, 0.35);
  } else {
    if (Home.sel === b.i) { c.save(); c.shadowColor = '#fff'; c.shadowBlur = 12 + Math.sin(t * 6) * 6; blit(c, sp, wx, wy); c.restore(); }
    else blit(c, sp, wx, wy);
    const hero = d.hero && S.me.heroes[d.hero] && !heroBusy(d.hero) ? d.hero : null;
    drawLive(c, { t: b.t, lv: b.lv, s: s, i: b.i, hero: hero, revealed: true }, t, wx, wy);
  }
  if (job) scaffold(c, x, y, s, job, t);
  // smoke from busy chimneys
  if (SET.quality !== 'low' && Math.random() < 0.03 && (b.t === 'blacksmith' || b.t === 'townhall' || b.t === 'builderhut')) {
    const p = b.t === 'blacksmith' ? [x + 2.15, y + 0.75, 46] : [x + s / 2, y + s / 2, b.t === 'townhall' ? 50 : 30];
    const [px, py] = iso(p[0], p[1]);
    part({ x: px, y: py, z: p[2], vz: 18, vx: rand(4, 12), life: 2.4, max: 2.4, size: 5, col: 'rgba(200,200,200,.5)', kind: 'smoke', drag: 1 });
  }
  if (d.prod && b.lv > 0 && Math.random() < 0.012) {
    const [px, py] = iso(x + s / 2, y + s / 2);
    part({ x: px, y: py, z: 30, vz: 30, life: 1.2, max: 1.2, size: 3, col: d.prod === 'gold' ? '#ffd23f' : d.prod === 'elixir' ? '#ff80ff' : '#a080ff', kind: 'spark', drag: 1 });
  }
}
function scaffold(c, x, y, s, job, t) {
  const at = (tx, ty, z) => { const p = iso(tx, ty); return [p[0], p[1] - z]; };
  c.strokeStyle = '#8a5a2b'; c.lineWidth = 2.5;
  const h = 18 + s * 8;
  for (const [px, py] of [[x + 0.2, y + s - 0.2], [x + s - 0.2, y + s - 0.2], [x + s - 0.2, y + 0.2]]) {
    const a = at(px, py, 0), b = at(px, py, h); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
  for (const z of [h * 0.45, h]) {
    const a = at(x + 0.2, y + s - 0.2, z), b = at(x + s - 0.2, y + s - 0.2, z), e = at(x + s - 0.2, y + 0.2, z);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(e[0], e[1]); c.stroke();
  }
  // progress + timer
  const now = serverNow(), k = clamp((now - job.start) / Math.max(1, job.end - job.start), 0, 1);
  const p = at(x + s / 2, y + s / 2, h + 26);
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(p[0] - 26, p[1], 52, 8);
  c.fillStyle = '#9cff6b'; c.fillRect(p[0] - 25, p[1] + 1, 50 * k, 6);
  c.font = '13px "Lilita One", Impact'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#000';
  const txt = fmtTime((job.end - now) / 1000);
  c.strokeText(txt, p[0], p[1] - 3); c.fillStyle = '#fff'; c.fillText(txt, p[0], p[1] - 3);
}

/* =====================================================================
   INPUT - pan, pinch zoom, tap, drag buildings
   ===================================================================== */
const Input = { ptrs: new Map(), start: null, moved: false, pinch: null, dragB: false, lastTap: 0, hold: null };
function onDown(e) {
  Sound.init();
  canvas.setPointerCapture(e.pointerId);
  Input.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (Input.ptrs.size === 2) {
    const [a, b] = [...Input.ptrs.values()];
    Input.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z };
    Input.dragB = false; Home.drag = null; stopHold();
    return;
  }
  Input.start = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, t: performance.now() };
  Input.vel = { x: 0, y: 0, lx: e.clientX, ly: e.clientY, lt: performance.now() };
  cam.vx = cam.vy = 0;
  Input.moved = false;
  Input.dragB = false;
  if (S.scene === 'home' && S.me) {
    const [tx, ty] = screenToTile(e.clientX, e.clientY);
    if (Home.place && Home.place.t !== 'wall') {
      const s = D.bdef(Home.place.t).size;
      if (tx >= Home.place.x - 0.5 && tx < Home.place.x + s + 0.5 && ty >= Home.place.y - 0.5 && ty < Home.place.y + s + 0.5) { Input.dragB = 'place'; Input.grab = [tx - Home.place.x, ty - Home.place.y]; }
    } else if (Home.sel != null) {
      const b = S.me.buildings.find(x => x.i === Home.sel);
      const hit = pickBuilding(e.clientX, e.clientY);
      if (b && hit && hit.i === b.i) { Input.dragB = 'move'; Input.grab = [tx - b.x, ty - b.y]; }
    }
  } else if (S.scene === 'battle') {
    Battle.pointerDown(e.clientX, e.clientY);
  }
}
function onMove(e) {
  if (!Input.ptrs.has(e.pointerId)) return;
  Input.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (Input.pinch && Input.ptrs.size >= 2) {
    const [a, b] = [...Input.ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    cam.tz = null; setZoomAround((a.x + b.x) / 2, (a.y + b.y) / 2, Input.pinch.z * d / Input.pinch.d);
    Input.moved = true;
    return;
  }
  if (!Input.start) return;
  const dx = e.clientX - Input.start.x, dy = e.clientY - Input.start.y;
  if (!Input.moved && Math.hypot(dx, dy) > 7) { Input.moved = true; if (S.scene === 'battle') Battle.pointerMoved(); }
  if (!Input.moved) return;
  if (Input.dragB && S.scene === 'home') {
    const [tx, ty] = screenToTile(e.clientX, e.clientY);
    const nx = Math.round(tx - Input.grab[0]), ny = Math.round(ty - Input.grab[1]);
    if (Input.dragB === 'place') { Home.place.x = nx; Home.place.y = ny; }
    else {
      const b = S.me.buildings.find(x => x.i === Home.sel);
      if (b) { if (!Home.drag) Home.drag = { i: b.i, x: b.x, y: b.y }; Home.drag.x = nx; Home.drag.y = ny; }
    }
    return;
  }
  canvas.classList.add('dragging');
  const nowT = performance.now(), v = Input.vel, dtm = Math.max(1, nowT - v.lt);
  v.x = v.x * 0.6 + (e.clientX - v.lx) / dtm * 1000 * 0.4; v.y = v.y * 0.6 + (e.clientY - v.ly) / dtm * 1000 * 0.4; v.lx = e.clientX; v.ly = e.clientY; v.lt = nowT;
  cam.x = Input.start.cx - dx / cam.z; cam.y = Input.start.cy - dy / cam.z;
  clampCam();
}
function onUp(e) {
  Input.ptrs.delete(e.pointerId);
  canvas.classList.remove('dragging');
  if (Input.ptrs.size < 2) Input.pinch = null;
  if (Input.ptrs.size > 0) { Input.start = null; return; }
  const wasMoved = Input.moved, start = Input.start;
  Input.start = null;
  if (S.scene === 'battle') { Battle.pointerUp(); }
  if (S.scene === 'home' && Input.dragB === 'move' && Home.drag) {
    const d = Home.drag, b = S.me.buildings.find(x => x.i === d.i);
    if (b && (d.x !== b.x || d.y !== b.y)) {
      if (spotFree(b.t, d.x, d.y, b.i)) {
        const ox = b.x, oy = b.y;
        b.x = d.x; b.y = d.y;   // optimistic; server answer replaces it
        Sound.play('place');
        act('building/move', { id: b.i, x: d.x, y: d.y }).then(r => { if (!r) { b.x = ox; b.y = oy; } });
      } else { Sound.play('error'); }
    }
    Home.drag = null; Input.dragB = false;
    return;
  }
  if (wasMoved && !Input.dragB && Input.vel && performance.now() - Input.vel.lt < 80) { cam.vx = -Input.vel.x / cam.z; cam.vy = -Input.vel.y / cam.z; }
  Input.dragB = false;
  if (!wasMoved && start) tap(e.clientX, e.clientY);
}
function zoomAt(sx, sy, f) { zoomTo(sx, sy, f); }
canvas.addEventListener('pointerdown', onDown);
canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === 'Escape') { if (Modal.top()) Modal.close(Modal.top()); else if (Home.place) cancelPlace(); else selectBuilding(null); }
  if (S.scene === 'battle' && /^[1-9]$/.test(e.key)) Battle.selectIndex(Number(e.key) - 1);
  if (e.key === '+' || e.key === '=') zoomAt(W / 2, H / 2, 1.15);
  if (e.key === '-') zoomAt(W / 2, H / 2, 1 / 1.15);
});
function stopHold() { if (Input.hold) { clearInterval(Input.hold); Input.hold = null; } }

function tap(sx, sy) {
  if (S.scene === 'battle') { Battle.tap(sx, sy); return; }
  if (S.scene !== 'home' || !S.me) return;
  const [tx, ty] = screenToTile(sx, sy);
  if (Home.place) {
    const p = Home.place, s = D.bdef(p.t).size;
    if (p.t === 'wall') { placeWallAt(Math.floor(tx), Math.floor(ty)); return; }
    p.x = Math.round(tx - s / 2); p.y = Math.round(ty - s / 2);
    Sound.play('click');
    return;
  }
  const b = pickBuilding(sx, sy);
  selectBuilding(b ? b.i : null);
  if (b) Sound.play('click');
}

/* ---- placement -------------------------------------------------------- */
function startPlace(t) {
  Modal.closeAll();
  selectBuilding(null);
  const s = D.bdef(t).size;
  const [tx, ty] = screenToTile(W / 2, H / 2);
  let x = clamp(Math.round(tx - s / 2), 0, D.GRID - s), y = clamp(Math.round(ty - s / 2), 0, D.GRID - s);
  // nudge to the nearest free spot so the first preview is usually green
  outer: for (let r = 0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (spotFree(t, x + dx, y + dy)) { x += dx; y += dy; break outer; }
  }
  Home.place = { t: t, x: x, y: y, walls: [] };
  renderSelbar();
}
function cancelPlace() { Home.place = null; renderSelbar(); }
async function confirmPlace() {
  const p = Home.place;
  if (!p) return;
  if (p.t === 'wall') {
    if (!p.walls.length) { cancelPlace(); return; }
    const walls = p.walls.slice();
    Home.place = null; renderSelbar();
    if (await act('building/place', { type: 'wall', positions: walls }, walls.length + ' wall' + (walls.length > 1 ? 's' : '') + ' built')) Sound.play('place');
    return;
  }
  if (!spotFree(p.t, p.x, p.y)) { Sound.play('error'); toast('That spot is taken', 'bad'); return; }
  const r = await act('building/place', { type: p.t, x: p.x, y: p.y });
  if (r) { Sound.play('build'); Home.place = null; selectBuilding(r.placed && r.placed[0]); }
}
function placeWallAt(x, y) {
  const p = Home.place;
  const have = countBuilt('wall') + p.walls.length, max = D.maxCount('wall', S.me.th);
  const i = p.walls.findIndex(w => w.x === x && w.y === y);
  if (i >= 0) { p.walls.splice(i, 1); renderSelbar(); return; }
  if (have >= max) { toast('Wall limit reached for your Town Hall', 'bad'); Sound.play('error'); return; }
  if (p.walls.length >= 60) { toast('Confirm these walls first', 'bad'); return; }
  const cost = D.cost('wall', 1).a * (p.walls.length + 1);
  if (displayRes().gold < cost) { toast('Not enough Gold', 'bad'); Sound.play('error'); return; }
  if (!spotFree('wall', x, y, null, p.walls)) { Sound.play('error'); return; }
  p.walls.push({ x: x, y: y });
  Sound.play('place');
  renderSelbar();
}

/* ---- selection panel ---------------------------------------------------- */
function selectBuilding(i) {
  Home.sel = i;
  renderSelbar();
}
function renderSelbar() {
  const bar = $('#selbar');
  if (S.scene !== 'home' || !S.me) { bar.classList.add('hidden'); return; }
  if (Home.place) {
    const p = Home.place, d = D.bdef(p.t);
    const extra = p.t === 'wall' ? ' · tap tiles to add/remove · ' + p.walls.length + ' placed (' + fmt(D.cost('wall', 1).a * p.walls.length) + ' gold)' : ' · drag or tap to position';
    bar.innerHTML = '<div class="title">' + esc(d.name) + '<span class="note" style="-webkit-text-stroke:0">' + extra + '</span></div>' +
      '<div class="btns"><button class="btn red act" data-a="cancel">' + ICONS.x + 'CANCEL</button><button class="btn act" data-a="confirm">' + ICONS.check + (p.t === 'wall' ? 'DONE' : 'PLACE') + '</button></div>';
    bar.classList.remove('hidden');
    bar.querySelector('[data-a=cancel]').onclick = () => { Sound.play('click'); cancelPlace(); };
    bar.querySelector('[data-a=confirm]').onclick = () => confirmPlace();
    return;
  }
  const b = Home.sel != null && S.me.buildings.find(x => x.i === Home.sel);
  if (!b) { bar.classList.add('hidden'); return; }
  const d = D.bdef(b.t), job = jobFor(b.i);
  const btns = [];
  btns.push('<button class="btn blue act" data-a="info">' + ICONS.info + 'INFO</button>');
  const max = b.t === 'townhall' ? D.MAX_TH : D.maxLevel(b.t, S.me.th);
  if (job) {
    btns.push('<button class="btn red act" data-a="cancelJob">' + ICONS.x + 'CANCEL<span class="note" style="color:#fff">50% back</span></button>');
  } else if (b.lv < max && b.lv > 0) {
    const c = D.cost(b.t, b.lv + 1), tm = D.buildTime(b.t, b.lv + 1);
    btns.push('<button class="btn act" data-a="upgrade">' + ICONS.up + 'UPGRADE<span class="cost">' + icon(c.r) + fmt(c.a) + '</span>' + (tm ? '<span class="note" style="color:#fff">' + fmtTime(tm) + '</span>' : '') + '</button>');
    if (b.t === 'wall') btns.push('<button class="btn yellow act" data-a="wallrow">' + ICONS.up + 'ALL LV ' + b.lv + '<span class="note" style="color:#3a2400">walls</span></button>');
  }
  if (b.t === 'barracks' || b.t === 'darkbarracks' || b.t === 'armycamp') btns.push('<button class="btn purple act" data-a="army">' + ICONS.swords + 'TRAIN</button>');
  if (b.t === 'spellfactory') btns.push('<button class="btn purple act" data-a="spells">' + ICONS.swords + 'BREW</button>');
  if (b.t === 'laboratory') btns.push('<button class="btn purple act" data-a="lab">' + ICONS.flask + 'RESEARCH</button>');
  if (d.hero || b.t === 'blacksmith') btns.push('<button class="btn purple act" data-a="heroes">' + ICONS.crown + (b.t === 'blacksmith' ? 'FORGE' : 'HERO') + '</button>');
  const lvTxt = b.lv === 0 ? 'under construction' : 'Level ' + b.lv;
  bar.innerHTML = '<div class="title">' + esc(d.name) + ' <span style="color:var(--gold)">(' + lvTxt + ')</span></div>' +
    (job ? '<div class="timer-pill" id="selTimer"></div>' : '<div class="note" style="text-shadow:0 1px 2px #000">Drag the building to move it</div>') +
    '<div class="btns">' + btns.join('') + '</div>';
  bar.classList.remove('hidden');
  paintIcons(bar);
  const on = (a, fn) => { const e = bar.querySelector('[data-a=' + a + ']'); if (e) e.onclick = () => { Sound.play('click'); fn(); }; };
  on('info', () => UI.buildingInfo(b));
  on('upgrade', async () => {
    const c = D.cost(b.t, b.lv + 1);
    if (b.t === 'townhall' && !(await confirmBox('UPGRADE TOWN HALL?', 'Town Hall ' + (b.lv + 1) + ' unlocks new buildings, troops and heroes.<br>Cost: ' + costHtml(c.r, c.a), 'UPGRADE'))) return;
    const r = await act('building/upgrade', { id: b.i });
    if (r) { Sound.play('build'); toast(esc(d.name) + ' upgrade started', 'good'); }
    renderSelbar();
  });
  on('wallrow', async () => {
    const ids = S.me.buildings.filter(x => x.t === 'wall' && x.lv === b.lv).map(x => x.i);
    const r = await act('building/upgrade-walls', { ids: ids });
    if (r) { Sound.play('build'); toast(r.upgraded + ' walls upgraded', 'good'); }
    renderSelbar();
  });
  on('cancelJob', async () => {
    if (!(await confirmBox('CANCEL?', 'Cancel this construction? You get 50% of the cost back.', 'CANCEL IT', 'red'))) return;
    await act('building/cancel', { job: job.id });
    selectBuilding(S.me.buildings.some(x => x.i === b.i) ? b.i : null);
  });
  on('army', () => UI.army('troops'));
  on('spells', () => UI.army('spells'));
  on('lab', () => UI.army('lab'));
  on('heroes', () => UI.heroes(b.t === 'blacksmith' ? 'forge' : 'heroes'));
}

/* =====================================================================
   HUD
   ===================================================================== */
let hudLast = 0, lastJobs = null;
function updateHud(force) {
  const me = S.me;
  if (!me) return;
  const now = performance.now();
  if (!force && now - hudLast < 200) return;
  hudLast = now;
  const r = displayRes();
  for (const [k, id] of [['gold', 'Gold'], ['elixir', 'Elixir'], ['dark', 'Dark']]) {
    $('#v' + id).textContent = fmt(r[k]);
    $('#c' + id).textContent = 'max ' + fmt(me.caps[k]);
    $('#f' + id).style.width = (me.caps[k] ? clamp(r[k] / me.caps[k] * 100, 0, 100) : 0) + '%';
  }
  $('#rDark').classList.toggle('hidden', me.caps.dark <= 0 && r.dark <= 0);
  $('#vShiny').textContent = fmt(r.shiny); $('#vGlowy').textContent = fmt(r.glowy); $('#vStarry').textContent = fmt(r.starry);
  $('#meName').textContent = me.name;
  $('#meLvl').textContent = me.level;
  $('#meXp').style.width = clamp(me.levelInfo.into / me.levelInfo.need * 100, 0, 100) + '%';
  $('#meTrophies').innerHTML = icon('trophy') + fmt(me.trophies);
  const sh = (me.shieldUntil - serverNow()) / 1000;
  $('#meShield').classList.toggle('hidden', sh <= 0);
  if (sh > 0) $('#meShield').innerHTML = icon('shield') + fmtTime(sh);
  $('#builderChip').innerHTML = icon('builder') + freeBuilders() + '/' + me.builders;
  $('#onlineN').textContent = S.online ? S.online + ' online' : 'online';
  $('#logDot').classList.toggle('hidden', !S.unseen);
  $('#logDot').textContent = S.unseen;
  const tm = $('#selTimer');
  if (tm && Home.sel != null) { const j = jobFor(Home.sel); if (j) tm.textContent = '⏱ ' + fmtTime((j.end - serverNow()) / 1000); }
  // something finished? ask the server (it settles and tells us)
  const sn = serverNow();
  const due = me.jobs.some(j => j.end <= sn) || (me.lab && me.lab.end <= sn) || queueDue('troops', sn) || queueDue('spells', sn);
  if (due && Date.now() - S.refreshAt > 2500) refreshMe();
  else if (Date.now() - S.refreshAt > 45000) refreshMe();
}
function queueDue(kind, sn) {
  const q = S.me.queue[kind], t0 = S.me.queue.tStart[kind];
  if (!q.length || t0 == null) return false;
  const def = kind === 'spells' ? D.sdef(q[0].id) : D.tdef(q[0].id);
  return t0 + def.time * 1000 <= sn;
}
async function refreshMe() {
  if (S.refreshing || !Net.token) return;
  S.refreshing = true; S.refreshAt = Date.now();
  try { setMe(await Net.get('/me')); } catch (e) { /* offline: keep showing the last state */ }
  S.refreshing = false;
}
function setMe(me) {
  if (!me) return;
  const prev = S.me;
  S.me = me; S.meAt = Date.now(); S.clockOff = me.serverTime - Date.now();
  if (prev && prev.id === me.id) {
    // announce finished work
    for (const j of prev.jobs) {
      if (me.jobs.some(x => x.id === j.id)) continue;
      if (j.end > serverNow() + 1000) continue;
      if (j.kind === 'b') { const b = me.buildings.find(x => x.i === j.b); if (b) { toast('✔ ' + esc(D.bdef(b.t).name) + ' reached level ' + b.lv + '!', 'good'); burst(b.x + 1, b.y + 1, 30, { col: ['#ffd23f', '#9cff6b', '#fff'], size: 4, speed: 80, up: 160, g: 260, life: 1, kind: 'spark' }); } }
      else toast('✔ ' + esc(D.hdef(j.hero).name) + ' reached level ' + me.heroes[j.hero].lv + '!', 'good');
      Sound.play('done');
    }
    if (prev.lab && !me.lab) { toast('✔ Research complete: ' + esc((D.tdef(prev.lab.id) || D.sdef(prev.lab.id)).name) + ' level ' + prev.lab.to, 'good'); Sound.play('done'); }
    if (me.th > prev.th) { Sound.play('victory'); toast('Town Hall ' + me.th + '! New buildings unlocked', 'good'); }
  }
  if (Home.sel != null && !me.buildings.some(b => b.i === Home.sel)) Home.sel = null;
  updateHud(true);
  renderSelbar();
  UI.refreshOpen();
}
