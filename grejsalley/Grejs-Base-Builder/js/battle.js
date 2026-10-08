'use strict';
/* GREJS BASE BUILDER - battle.js: battle scene, replays, main loop */

/* =====================================================================
   BATTLE SCENE (PvP, campaign, replay)
   The local sim is only for display. What counts is the server's re-run
   of the commands we send - see grejsbase/battles.js.
   ===================================================================== */
const TICK_MS = 100;
const Battle = {
  b: null,
  start(data, mode, extra) {
    Modal.closeAll();
    selectBuilding(null); Home.place = null;
    const sim = new GBSim.Sim(data.base, data.army, { fx: true, maxTicks: data.maxTicks || D.BATTLE_TICKS });
    const theme = mode === 'campaign' || (extra && extra.level)
      ? Object.assign({}, D.WORLDS[((extra && extra.level) || data.level).w - 1])
      : { name: 'Grejs Plains', ground: '#74c450', ground2: '#68b846', accent: '#ffd23f' };
    this.b = {
      id: data.id, mode: mode, data: data, sim: sim, t0: performance.now(), acc: 0,
      sel: null, outbox: [], chain: Promise.resolve(), sendErr: 0, ended: false, finishing: false,
      vis: sim.b.map(() => ({ aim: null, recoil: 0, zap: 0, hit: 0 })), shots: [], theme: theme,
      lootPer: data.lootPer || null, lootTotal: data.lootTotal || null, loot: { gold: 0, elixir: 0, dark: 0 },
      redFlash: 0, msgT: 0, replay: mode === 'replay' ? { cmds: extra.cmds, i: 0, endTick: extra.endTick, speed: 1, summary: extra.summary } : null,
      lastStars: 0, holdT: 0, holding: false, lastPct: 0,
    };
    makeGround(theme);
    S.scene = 'battle';
    $('#hud').classList.add('hidden');
    $('#bhud').classList.remove('hidden');
    $('#replayBar').classList.toggle('hidden', mode !== 'replay');
    $('#bEnd').classList.toggle('hidden', mode === 'replay');
    $('#bBar').classList.toggle('hidden', mode === 'replay');
    cam.z = clamp(Math.min(W / 2600, H / 1400) * 1.25, minZoom(), 1.2); cam.x = 0; cam.y = 640;
    FX.parts.length = 0; FX.texts.length = 0; FX.rings.length = 0; FX.beams.length = 0;
    this.renderHeader();
    this.renderCards();
    this.msg(mode === 'replay' ? 'REPLAY' : 'Tap outside the base to deploy!', 2.5);
    if (mode !== 'replay') {
      this.b.flushTimer = setInterval(() => this.flush(), 1000);
      // pick the first available card
      const first = this.b.cards.find(c => c.n > 0);
      if (first) this.b.sel = first.key;
      this.renderCards();
    }
    Sound.play(mode === 'replay' ? 'open' : 'alarm');
  },
  msg(txt, sec) { $('#bMsg').innerHTML = txt; $('#bMsg').style.opacity = 1; this.b.msgT = sec || 2; },
  renderHeader() {
    const b = this.b, d = b.data;
    if (b.mode === 'campaign') {
      $('#bWho').innerHTML = '<span class="badge-th">' + (d.level.boss ? 'BOSS' : 'W' + d.level.w) + '</span>' + esc(d.level.name);
      $('#bSub').textContent = 'CAMPAIGN · single player';
    } else if (b.mode === 'replay') {
      const s = b.replay.summary;
      $('#bWho').innerHTML = esc(s.attacker.name) + ' <span class="muted">vs</span> ' + esc(s.defender.name);
      $('#bSub').textContent = 'Replay · ' + new Date(s.at).toLocaleString();
      $('#replayTitle').textContent = 'REPLAY';
    } else {
      const o = d.opponent;
      $('#bWho').innerHTML = '<span class="badge-th">TH' + o.th + '</span>' + esc(o.name);
      $('#bSub').innerHTML = icon('trophy') + ' win: +' + d.offer.win + ' · lose: -' + d.offer.loss;
    }
    this.renderLoot();
  },
  renderLoot() {
    const b = this.b;
    if (!b.lootTotal) { $('#bLoot').innerHTML = ''; return; }
    const row = r => '<span>' + icon(r) + fmt(b.loot[r]) + ' <span class="muted" style="font-size:.8em">/ ' + fmt(b.lootTotal[r]) + '</span></span>';
    $('#bLoot').innerHTML = '<span class="note" style="font-family:var(--font)">AVAILABLE LOOT</span>' + row('gold') + row('elixir') + (b.lootTotal.dark ? row('dark') : '');
  },
  renderCards() {
    const b = this.b, sim = b.sim, a = b.data.army;
    if (!b.cards) {
      b.cards = [];
      for (const id of D.TROOPS) if (a.troops[id]) b.cards.push({ key: 't:' + id, kind: 't', id: id, lv: a.troops[id].lv });
      for (const id of D.HEROES) if (a.heroes[id]) b.cards.push({ key: 'h:' + id, kind: 'h', id: id, lv: a.heroes[id].lv });
      for (const id of D.SPELLS) if (a.spells[id]) b.cards.push({ key: 's:' + id, kind: 's', id: id, lv: a.spells[id].lv });
    }
    for (const c of b.cards) {
      if (c.kind === 't') c.n = sim.left.troops[c.id] || 0;
      else if (c.kind === 's') c.n = sim.left.spells[c.id] || 0;
      else {
        const u = sim.units.find(u => u.kind === 'hero' && u.id === c.id);
        c.n = sim.left.heroes[c.id] ? 1 : 0;
        c.ability = !!(u && u.alive && u.ability);
        c.dead = !!(u && !u.alive);
        c.usedAbility = !!(u && !u.ability);
      }
    }
    const bar = $('#bBar');
    bar.innerHTML = b.cards.map((c, i) => {
      const cls = ['dcard', c.kind === 's' ? 'spell' : c.kind === 'h' ? 'hero' : '', c.key === b.sel ? 'sel' : '',
        c.kind === 'h' && c.ability ? 'ability' : '', (c.kind !== 'h' && !c.n) || (c.kind === 'h' && !c.n && !c.ability) ? 'empty' : ''].join(' ');
      return '<div class="' + cls + '" data-i="' + i + '"><canvas width="96" height="96"></canvas><span class="n">' + (c.kind === 'h' ? (c.ability ? '⚡' : c.n ? '' : c.dead ? '✖' : '') : 'x' + c.n) + '</span><span class="lv">' + (c.kind === 'h' && c.ability ? 'ABILITY' : 'LV ' + c.lv) + '</span></div>';
    }).join('');
    $$('.dcard', bar).forEach(el => {
      const c = b.cards[+el.dataset.i];
      el.querySelector('canvas').getContext('2d').drawImage(portrait(c.id, 96), 0, 0);
      el.onclick = () => this.cardClick(c);
    });
  },
  selectIndex(i) { const c = this.b && this.b.cards[i]; if (c) this.cardClick(c); },
  cardClick(c) {
    const b = this.b;
    if (b.mode === 'replay' || b.ended) return;
    Sound.play('click');
    if (c.kind === 'h' && c.ability) { this.command({ k: 'a', id: c.id }); return; }
    if ((c.kind !== 'h' && !c.n) || (c.kind === 'h' && !c.n)) return;
    b.sel = c.key;
    this.renderCards();
  },
  pointerDown(sx, sy) {
    const b = this.b;
    if (!b || b.ended || b.mode === 'replay' || !b.sel || b.sel[0] !== 't') return;
    b.holding = { sx: sx, sy: sy, t: performance.now() };
  },
  pointerMoved() { if (this.b) this.b.holding = false; },
  pointerUp() { if (this.b) this.b.holding = false; },
  tap(sx, sy) {
    const b = this.b;
    if (!b || b.ended || b.mode === 'replay' || !b.sel) return;
    if (b.holdFired) { b.holdFired = false; return; }
    this.deployAt(sx, sy);
  },
  deployAt(sx, sy) {
    const b = this.b;
    const [tx, ty] = screenToTile(sx, sy);
    const x = Math.round(tx * 4) / 4, y = Math.round(ty * 4) / 4;
    const [k, id] = b.sel.split(':');
    if (k === 's') { if (!(x >= 0 && y >= 0 && x <= D.GRID && y <= D.GRID)) return; this.command({ k: 's', id: id, x: x, y: y }); return; }
    if (!b.sim.canDeploy(x, y)) { b.redFlash = 1.2; Sound.play('error'); this.msg('You can\'t deploy there - stay outside the base', 1.5); return; }
    this.command({ k: k, id: id, x: x, y: y });
  },
  command(c) {
    const b = this.b;
    c.t = b.sim.tick;
    const ok = b.sim.command(c);
    if (!ok) return false;
    b.outbox.push(c);
    this.handleEvents();
    if (c.k === 's') Sound.play('spell');
    else if (c.k === 'a') Sound.play('lightning');
    else Sound.play('deploy');
    // auto-advance to the next card when this one is empty
    this.renderCards();
    const cur = b.cards.find(x => x.key === b.sel);
    if (cur && !cur.n && c.k !== 'a') { const nxt = b.cards.find(x => x.n > 0 && x.kind === cur.kind) || b.cards.find(x => x.n > 0); b.sel = nxt ? nxt.key : null; this.renderCards(); }
    return true;
  },
  flush(final) {
    const b = this.b;
    if (!b || b.mode === 'replay' || (!b.outbox.length && !final)) return b ? b.chain : Promise.resolve();
    const batch = b.outbox.splice(0);
    b.chain = b.chain.then(() => batch.length ? Net.post('/battle/' + b.id + '/cmds', { cmds: batch }) : null).catch(e => {
      b.sendErr++;
      if (e.code === 'battle_over') return;
      // put them back and retry next second (network hiccup)
      if (e.code === 'offline') b.outbox.unshift(...batch);
    });
    return b.chain;
  },
  async endNow() {
    const b = this.b;
    if (!b || b.ended) return;
    if (b.sim.armyLeft() && !b.sim.over) {
      if (!(await confirmBox('END BATTLE?', 'You still have troops left. End the battle now?', 'END BATTLE', 'red'))) return;
    }
    if (!b.sim.over) b.sim.end('ended');
    this.finish();
  },
  async finish() {
    const b = this.b;
    if (b.ended) return;
    b.ended = true;
    clearInterval(b.flushTimer);
    if (b.mode === 'replay') { setTimeout(() => this.replayDone(), 1500); return; }
    $('#bEnd').classList.add('hidden');
    this.msg('Battle over - the server is checking the result…', 5);
    await this.flush(true);
    let res = null, err = null;
    for (let i = 0; i < 4 && !res; i++) {
      try { res = await Net.post('/battle/' + b.id + '/end', { endTick: b.sim.tick, cmds: b.outbox.splice(0) }); }
      catch (e) { err = e; if (e.code !== 'offline' && e.code !== 'busy') break; await new Promise(r => setTimeout(r, 1500)); }
    }
    if (!res) { toast((err && err.message) || 'Could not reach the server', 'bad'); this.exit(); return; }
    setMe(res.me);
    UI.battleResult(res.result, b);
  },
  exit() {
    const b = this.b;
    if (b && b.flushTimer) clearInterval(b.flushTimer);
    this.b = null;
    S.scene = 'home';
    $('#bhud').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    makeGround(homeTheme());
    cam.z = clamp(Math.min(W / 2200, H / 1200) * 1.3, minZoom(), 1.4); cam.x = 0; cam.y = 640;
    FX.parts.length = 0;
    updateHud(true);
    refreshMe();
  },
  replayDone() {
    const b = this.b, s = b.replay.summary;
    const w = Modal.open('REPLAY FINISHED', '<div class="center">' + starsHtml(s.stars) + '<div class="big-pct">' + s.pct + '%</div><div class="lootline">' + ['gold', 'elixir', 'dark'].map(r => '<span>' + icon(r) + fmt(s.loot[r]) + '</span>').join('') + '</div><div class="row" style="justify-content:center;margin-top:1em;gap:1em"><button class="btn blue" data-again>WATCH AGAIN</button><button class="btn" data-home>RETURN HOME</button></div></div>', { size: 'narrow', onClose: () => { if (this.b && this.b.mode === 'replay') this.exit(); } });
    w.querySelector('[data-home]').onclick = () => Modal.close(w);
    w.querySelector('[data-again]').onclick = () => { const r = b.replay, d = b.data; Modal.stack.pop(); w.remove(); Battle.start(d, 'replay', { cmds: r.cmds, endTick: r.endTick, summary: r.summary }); };
  },

  /* ---- per frame ------------------------------------------------------ */
  update(dt) {
    const b = this.b;
    if (!b) return;
    const sim = b.sim;
    // hold to deploy a stream of troops
    if (b.holding && !b.ended && performance.now() - b.holding.t > 260) {
      b.holdT -= dt;
      if (b.holdT <= 0) { b.holdT = 0.11; b.holdFired = true; this.deployAt(b.holding.sx, b.holding.sy); }
    }
    if (b.msgT > 0) { b.msgT -= dt; if (b.msgT <= 0) $('#bMsg').style.opacity = 0; }
    if (b.redFlash > 0) b.redFlash -= dt;
    for (const v of b.vis) { if (v.recoil > 0) v.recoil = Math.max(0, v.recoil - dt * 5); if (v.zap > 0) v.zap -= dt; if (v.hit > 0) v.hit -= dt; }
    if (!sim.over) {
      let target;
      if (b.replay) { b.acc += dt * 1000 * b.replay.speed; target = Math.floor(b.acc / TICK_MS); }
      else target = Math.floor((performance.now() - b.t0) / TICK_MS);
      let n = 0;
      while (!sim.over && sim.tick < target && n < 80) {
        if (b.replay) {
          const r = b.replay;
          while (r.i < r.cmds.length && r.cmds[r.i].t <= sim.tick) sim.command(r.cmds[r.i++]);
          if (sim.tick >= r.endTick) { sim.end('ended'); break; }
        }
        sim.step(); n++;
        this.handleEvents();
      }
      b.alpha = b.replay ? (b.acc % TICK_MS) / TICK_MS : ((performance.now() - b.t0) % TICK_MS) / TICK_MS;
      if (sim.over) { this.handleEvents(); setTimeout(() => this.finish(), 900); }
    } else b.alpha = 1;
    // HUD
    const left = Math.max(0, (sim.maxTicks - sim.tick) * TICK_MS / 1000);
    $('#bTime').textContent = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
    const pct = sim.pct();
    if (pct !== b.lastPct) { $('#bPct').textContent = pct + '%'; b.lastPct = pct; }
    const st = sim.stars();
    if (st !== b.lastStars || !$('#bStars').innerHTML) {
      if (st > b.lastStars) { Sound.play('star'); this.msg(ICONS.star.replace('class="star"', 'class="star" style="width:2em;height:2em"') + '<br>STAR EARNED!', 1.6); }
      b.lastStars = st;
      $('#bStars').innerHTML = starsHtml(st).replace(/^<span class="stars">|<\/span>$/g, '');
    }
    if (b.lootPer && (!b.lootAt || performance.now() - b.lootAt > 400)) {
      b.lootAt = performance.now();
      const dmg = sim.damageFractions();
      const l = { gold: 0, elixir: 0, dark: 0 };
      b.lootPer.forEach((p, i) => { for (const r of D.RES) l[r] += Math.floor((p[r] || 0) * (dmg[i] || 0)); });
      if (l.gold !== b.loot.gold || l.elixir !== b.loot.elixir) { b.loot = l; this.renderLoot(); }
    }
    if (!b.cardsAt || performance.now() - b.cardsAt > 500) { b.cardsAt = performance.now(); if (b.mode !== 'replay') this.renderCardsLight(); }
  },
  renderCardsLight() {
    // hero cards change state (ability ready / dead) without a tap
    const b = this.b, sim = b.sim;
    let changed = false;
    for (const c of b.cards) if (c.kind === 'h') {
      const u = sim.units.find(u => u.kind === 'hero' && u.id === c.id);
      const ab = !!(u && u.alive && u.ability), dead = !!(u && !u.alive);
      if (ab !== c.ability || dead !== c.dead) changed = true;
    }
    if (changed) this.renderCards();
  },

  handleEvents() {
    const b = this.b, sim = b.sim;
    if (!sim.events.length) return;
    for (const e of sim.events) {
      switch (e.t) {
        case 'deploy': { const u = sim.units[e.u]; burst(e.x, e.y, 6, { col: 'rgba(230,220,200,.7)', size: 6, speed: 30, life: 0.5, kind: 'smoke' }); if (u.kind === 'hero') { floatText(e.x, e.y, D.hdef(u.id).name, '#ffd23f', 50); } break; }
        case 'shot': {
          if (e.b != null) { const v = b.vis[e.b]; v.aim = Math.atan2(e.ty - e.fy, e.tx - e.fx); v.recoil = 1; if (e.kind !== 'archertower' && e.kind !== 'wizardtower') flash(e.fx, e.fy, 40, '#ffb040', 26, 0.15); }
          b.shots.push({ kind: e.kind, fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty, u: e.u, start: e.tick, travel: e.travel, lob: e.lob });
          const k = e.kind;
          Sound.play(k === 'cannon' || k === 'eagleartillery' || k === 'mortar' || k === 'bossfortress' ? 'cannon' : k === 'wizardtower' ? 'magic' : 'arrow');
          if (k === 'cannon' || k === 'mortar' || k === 'eagleartillery') burst(e.fx, e.fy, 3, { col: 'rgba(200,200,200,.6)', size: 6, speed: 20, z: 20, life: 0.6, kind: 'smoke' });
          break;
        }
        case 'beam': { const v = b.vis[e.b]; v.aim = Math.atan2(e.ty - e.fy, e.tx - e.fx); v.zap = 0.2; FX.beams.push({ b: e.b, u: e.u, kind: e.kind, t: 0, max: e.kind === 'infernotower' ? 0.22 : 0.15 }); Sound.play('zap'); break; }
        case 'attack': {
          const u = sim.units[e.u];
          if (e.ranged) b.shots.push({ kind: 'troop:' + u.id, fx: e.x, fy: e.y, tx: e.tx, ty: e.ty, start: e.tick, travel: 3, lob: false });
          else { burst(e.tx + rand(-.4, .4), e.ty + rand(-.4, .4), 3, { col: ['#fff', '#ffe27a'], size: 2.5, speed: 50, up: 60, g: 200, life: 0.3, kind: 'spark', z: 10 }); Sound.play('hit'); }
          break;
        }
        case 'bhit': { b.vis[e.b].hit = 0.12; if (SET.numbers && e.dmg >= 60) { const bb = sim.b[e.b]; floatText(bb.cx, bb.cy, '-' + Math.round(e.dmg), '#ffe27a', 40); } break; }
        case 'uhit': { const u = sim.units[e.u]; u.flash = 0.12; if (SET.numbers && (u.kind === 'hero' || e.dmg >= 80)) floatText(u.x, u.y, '-' + Math.round(e.dmg), '#ff8a7a', 30); break; }
        case 'destroy': {
          const bb = sim.b[e.b];
          b.vis[e.b].dAt = performance.now();
          if (e.wall) { burst(e.x, e.y, 8, { col: [tier(bb.lv, WALL_COLS), '#6a6a72'], size: 4, speed: 70, up: 120, g: 300, life: 0.8, kind: 'debris' }); Sound.play('hit'); }
          else {
            explosion(e.x, e.y, 1.2 + e.s * 0.25, 'fire');
            burst(e.x, e.y, 18 + e.s * 4, { col: ['#6a6a72', '#7a6a5a', '#8a5a2b', '#4a4a52'], size: 5, speed: 90 + e.s * 20, up: 180, g: 320, life: 1.2, kind: 'debris' });
            burst(e.x, e.y, 10, { col: ['rgba(60,50,40,.6)', 'rgba(90,80,70,.5)'], size: 16, speed: 20, up: 20, life: 2.6, kind: 'smoke' });
            cam.shake = Math.max(cam.shake, bb.core ? 20 : 8);
            Sound.play('destroy');
            if (bb.core) this.msg(bb.t === 'bossfortress' ? 'BOSS DESTROYED!' : 'TOWN HALL DESTROYED!', 2);
          }
          break;
        }
        case 'death': { const u = sim.units[e.u]; u.deadAt = performance.now(); burst(e.x, e.y, 6, { col: 'rgba(240,240,255,.8)', size: 5, speed: 30, up: 40, life: 0.6, kind: 'smoke' }); Sound.play('death'); if (u.sprung) burst(e.x, e.y, 6, { col: '#9aa3ad', size: 3, speed: 40, up: 260, g: 300, life: 1, kind: 'debris' }); break; }
        case 'boom': { explosion(e.x, e.y, e.r, e.c === 'magic' ? 'magic' : e.c === 'lightning' ? 'lightning' : 'fire'); Sound.play(e.c === 'lightning' ? 'lightning' : e.c === 'magic' ? 'magic' : 'boom'); break; }
        case 'spell': {
          const col = (D.sdef(e.id) || { color: '#fff' }).color;
          FX.rings.push({ tx: e.x, ty: e.y, r: e.r, t: 0, max: 0.6, col: col });
          if (e.id === 'lightning') { b.bolts = (b.bolts || []).concat([{ x: e.x, y: e.y, r: e.r, t: 0 }]); }
          if (e.id === 'freeze') burst(e.x, e.y, 20, { col: ['#e8fbff', '#bdf3ff'], size: 3, speed: 80, up: 60, life: 1, kind: 'spark' });
          break;
        }
        case 'trap': {
          const id = e.id;
          if (id === 'springtrap') { burst(e.x, e.y, 8, { col: '#9aa3ad', size: 3, speed: 30, up: 200, g: 300, life: 0.8, kind: 'debris' }); Sound.play('boom'); this.msg('Spring Trap!', 1); }
          else if (id === 'freezetrap') { explosion(e.x, e.y, e.r, 'freeze'); Sound.play('magic'); this.msg('Freeze Trap!', 1); }
          else { explosion(e.x, e.y, e.r, 'fire'); Sound.play('trap'); }
          break;
        }
        case 'trapArm': { const bb = sim.b[e.b]; bb.shown = performance.now(); break; }
        case 'heal': burst(e.x, e.y, 5, { col: ['#9cff6b', '#ffe27a'], size: 3, speed: 30, up: 60, life: 0.6, kind: 'spark' }); break;
        case 'ability': { const u = sim.units[e.u]; this.msg(esc(D.hdef(e.id).ability) + '!', 1.5); explosion(u.x, u.y, 1.5, 'magic'); Sound.play('spell'); break; }
        case 'ring': FX.rings.push({ tx: e.x, ty: e.y, r: e.r, t: 0, max: 0.8, col: e.c === 'heal' ? '#9cff6b' : '#7ad7ff' }); break;
        case 'reveal': { const bb = sim.b[e.b]; burst(bb.cx, bb.cy, 12, { col: ['#7fd4ff', '#fff'], size: 3, speed: 60, up: 100, g: 200, life: 0.6, kind: 'spark' }); floatText(bb.cx, bb.cy, 'Hidden Trap!', '#7fd4ff', 50); Sound.play('zap'); break; }
        case 'wake': this.msg('Eagle Artillery has woken up!', 2); Sound.play('alarm'); break;
      }
    }
    sim.events.length = 0;
  },

  /* ---- drawing -------------------------------------------------------- */
  draw(c, t) {
    const b = this.b; if (!b) return;
    const sim = b.sim, a = b.alpha == null ? 1 : b.alpha;
    // deploy zone hint
    if ((b.sel && b.sel[0] !== 's' && !b.ended) || b.redFlash > 0) {
      // a soft glowing border around the no-deploy area; red fill only on a bad tap
      const red = b.redFlash > 0, G = D.GRID, nd = sim.noDeploy;
      const blocked = (x, y) => x >= 0 && y >= 0 && x < G && y < G && nd[y * G + x];
      if (!b.zonePath) {
        b.zonePath = [];
        for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
          if (!nd[y * G + x]) continue;
          if (!blocked(x, y - 1)) b.zonePath.push([iso(x, y), iso(x + 1, y)]);
          if (!blocked(x + 1, y)) b.zonePath.push([iso(x + 1, y), iso(x + 1, y + 1)]);
          if (!blocked(x, y + 1)) b.zonePath.push([iso(x, y + 1), iso(x + 1, y + 1)]);
          if (!blocked(x - 1, y)) b.zonePath.push([iso(x, y), iso(x, y + 1)]);
        }
      }
      if (red) {
        c.fillStyle = 'rgba(255,40,40,' + (0.22 * Math.min(1, b.redFlash)) + ')';
        c.beginPath();
        for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
          if (!nd[y * G + x]) continue;
          const p0 = iso(x, y), p1 = iso(x + 1, y), p2 = iso(x + 1, y + 1), p3 = iso(x, y + 1);
          c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.closePath();
        }
        c.fill();
      }
      c.save(); c.lineCap = 'round';
      for (const [w, a] of [[6, 0.07], [1.8, 0.4]]) {
        c.strokeStyle = red ? 'rgba(255,90,74,' + a + ')' : 'rgba(255,255,255,' + a * (0.75 + 0.25 * Math.sin(t * 3)) + ')'; c.lineWidth = w;
        c.beginPath(); for (const [p, q] of b.zonePath) { c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); } c.stroke();
      }
      c.restore();
    }
    // spell zones on the ground
    for (const z of sim.zones) {
      const col = (D.sdef(z.id) || { color: '#c24bff' }).color;
      const [wx, wy] = iso(z.x, z.y);
      c.save(); c.globalAlpha = 0.22 + 0.08 * Math.sin(t * 6);
      c.fillStyle = col; c.beginPath(); c.ellipse(wx, wy, z.r * CRX, z.r * CRY, 0, 0, 7); c.fill();
      c.globalAlpha = 0.8; c.strokeStyle = col; c.lineWidth = 3; c.stroke(); c.restore();
      if (Math.random() < 0.3) part({ x: wx + rand(-z.r, z.r) * CRX * 0.7, y: wy + rand(-z.r, z.r) * CRY * 0.7, z: 0, vz: 40, life: 0.8, max: 0.8, size: 2.5, col: col, kind: 'spark', drag: 1 });
    }
    const walls = new Set();
    for (const bb of sim.b) if (bb.wall && bb.alive) walls.add(bb.x + ',' + bb.y);
    const items = [];
    for (const bb of sim.b) {
      if (bb.trap) {
        if (bb.alive && bb.triggered < 0 && b.mode === 'replay') items.push([bb.x + bb.y + bb.s, () => blit(c, spriteFor(bb.t, bb.lv, 0, true), ...iso(bb.x, bb.y), 0.35)]);
        else if (bb.shown && performance.now() - bb.shown < 600) items.push([bb.x + bb.y + bb.s, () => blit(c, spriteFor(bb.t, bb.lv, 0, true), ...iso(bb.x, bb.y))]);
        continue;
      }
      items.push([bb.x + bb.y + bb.s, () => this.drawBuilding(c, bb, t, walls)]);
    }
    const now = performance.now();
    for (const u of sim.units) {
      if (!u.alive && (!u.deadAt || now - u.deadAt > 500)) continue;
      const x = u.px + (u.x - u.px) * a, y = u.py + (u.y - u.py) * a;
      items.push([x + y + (u.air ? 2 : 0), () => this.drawUnit(c, u, x, y, t, now)]);
    }
    items.sort((p, q) => p[0] - q[0]);
    for (const it of items) it[1]();
    this.drawShots(c, t, a);
    this.drawBeams(c);
    if (b.bolts) {
      b.bolts = b.bolts.filter(bo => (bo.t += 1 / 60) < 0.45);
      for (const bo of b.bolts) {
        const [wx, wy] = iso(bo.x, bo.y);
        c.save(); c.shadowColor = '#7fd4ff'; c.shadowBlur = 20; c.strokeStyle = '#fff'; c.lineWidth = 3 + 3 * (1 - bo.t / 0.45);
        for (let k = 0; k < 3; k++) {
          c.beginPath(); let px = wx + rand(-30, 30), py = wy - 500; c.moveTo(px, py);
          while (py < wy) { px += rand(-22, 22); py += rand(30, 60); c.lineTo(px, Math.min(py, wy)); }
          c.stroke();
        }
        c.restore();
      }
    }
    // hp bars on top
    for (const bb of sim.b) {
      if (!bb.alive || bb.hp >= bb.maxHp || bb.wall || bb.trap) continue;
      const [wx, wy] = iso(bb.cx, bb.cy);
      hpBar(c, wx, wy - 30 - bb.s * 10, 34 + bb.s * 4, bb.hp / bb.maxHp, '#9cff6b');
    }
    for (const u of sim.units) {
      if (!u.alive || (u.kind !== 'hero' && u.hp >= u.maxHp)) continue;
      const x = u.px + (u.x - u.px) * a, y = u.py + (u.y - u.py) * a;
      const [wx, wy] = iso(x, y);
      hpBar(c, wx, wy - (u.air ? 74 : 38) * (LOOK[u.id] ? LOOK[u.id].sz : 1) * (u.kind === 'hero' ? 1.2 : 1.1) - 6, u.kind === 'hero' ? 34 : 18, u.hp / u.maxHp, u.kind === 'hero' ? '#ffd23f' : '#7fd4ff');
    }
  },
  drawBuilding(c, bb, t, walls) {
    const [wx, wy] = iso(bb.x, bb.y);
    const v = this.b.vis[bb.i];
    if (!bb.alive) {
      if (!bb.wall) blit(c, rubbleSprite(bb.s), wx, wy);
      const k = v.dAt ? (performance.now() - v.dAt) / 450 : 1;
      if (k < 1) {
        const sp = bb.wall ? wallSprite(bb.lv, 0) : spriteFor(bb.t, bb.lv, D.bdef(bb.t).store ? 3 : 0, true);
        c.save(); c.beginPath(); c.rect(wx - 400, wy - 400, 800, 400 + bb.s * HH * 2 + 4); c.clip();
        blit(c, sp, wx + rand(-2, 2), wy + k * k * (30 + bb.s * 12), 1 - k * 0.6);
        c.restore();
      }
      if (!bb.wall && hiQ() && Math.random() < 0.02 * bb.s) { const p = iso(bb.cx + rand(-.4, .4), bb.cy + rand(-.4, .4)); part({ x: p[0], y: p[1], z: 4, vz: 14, vx: rand(4, 10), life: 2.5, max: 2.5, size: 5, col: '#5a524a', kind: 'smoke', drag: 1 }); }
      return;
    }
    if (bb.wall) {
      const mask = (walls.has((bb.x + 1) + ',' + bb.y) ? 1 : 0) | (walls.has(bb.x + ',' + (bb.y + 1)) ? 2 : 0);
      blit(c, wallSprite(bb.lv, mask), wx, wy + (v.hit > 0 ? 1 : 0));
      return;
    }
    if (bb.hidden && !bb.revealed) return;
    const d = D.bdef(bb.t);
    const fill = d.store ? 3 : 0;
    const shake = v.hit > 0 ? rand(-1.2, 1.2) : 0;
    blit(c, spriteFor(bb.t, bb.lv, fill, bb.revealed), wx + shake, wy);
    if (bb.frozen > 0) { c.save(); c.globalAlpha = 0.45; footprint(c, bb.x, bb.y, bb.s, '#bdf3ff'); c.restore(); }
    drawLive(c, { t: bb.t, lv: bb.lv, s: bb.s, i: bb.i, hero: bb.hero && bb.hero.id, aim: v.aim, recoil: v.recoil, zap: v.zap, revealed: bb.revealed }, bb.frozen > 0 ? 0 : t, wx + shake, wy);
    if (bb.poison) { c.save(); c.globalAlpha = 0.3; footprint(c, bb.x, bb.y, bb.s, '#8bd13a'); c.restore(); }
    if (!bb.awake) { c.font = '14px "Lilita One"'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('Zzz', wx, wy - 20 + Math.sin(t * 2) * 4); }
  },
  drawUnit(c, u, x, y, t, now) {
    const [wx, wy] = iso(x, y);
    c.save();
    if (!u.alive) c.globalAlpha = Math.max(0, 1 - (now - u.deadAt) / 500);
    else if (u.invis > 0 || u.zoneInvis) c.globalAlpha = 0.4;
    const moving = Math.abs(u.x - u.px) + Math.abs(u.y - u.py) > 0.001;
    const tt = moving ? t : 0.3;
    if (u.frozen > 0) c.filter = 'saturate(0.2) brightness(1.3)';
    if (u.invuln > 0) { c.shadowColor = '#7ad7ff'; c.shadowBlur = 14; }
    else if (u.rage || u.zoneRage) { c.shadowColor = '#c24bff'; c.shadowBlur = 10; }
    const face = (u.face || 1) * 1;
    // flip to iso-screen direction
    const sx = (u.x - u.px) - (u.y - u.py);
    if (Math.abs(sx) > 0.001) u.sface = sx > 0 ? 1 : -1;
    drawUnitShape(c, u.id, wx, wy, u.sface || face, tt, u.atkAnim > 0 ? 1 : 0, u.kind === 'hero' ? 1.25 : 1.12, u.flash > 0);
    if (u.flash > 0) u.flash -= 1 / 60;
    c.restore();
    if (u.kind === 'hero' && u.alive) { c.save(); c.globalAlpha = 0.6 + 0.3 * Math.sin(t * 5); c.beginPath(); c.ellipse(wx, wy, 15, 6.5, 0, 0, 7); c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.stroke(); c.restore(); }
  },
  drawShots(c, t, a) {
    const b = this.b, sim = b.sim;
    const nowT = sim.tick - 1 + a;
    b.shots = b.shots.filter(s => nowT - s.start <= s.travel + 0.5);
    for (const s of b.shots) {
      const k = clamp((nowT - s.start) / s.travel, 0, 1);
      let tx = s.tx, ty = s.ty;
      if (!s.lob && s.u != null) { const u = sim.units[s.u]; if (u && u.alive) { tx = u.x; ty = u.y; } }
      const [fx, fy] = iso(s.fx, s.fy), [ex, ey] = iso(tx, ty);
      const kind = s.kind;
      const z0 = kind.startsWith('troop:') ? 16 : kind === 'archertower' ? 50 : kind === 'airdefense' ? 40 : kind === 'wizardtower' ? 66 : 20;
      const z1 = sim.units[s.u] && sim.units[s.u].air ? 50 : 10;
      const arc = s.lob ? Math.sin(Math.PI * k) * 160 : Math.sin(Math.PI * k) * 14;
      const x = lerp(fx, ex, k), y = lerp(fy - z0, ey - z1, k) - arc;
      const k2 = Math.max(0, k - 0.14), arc2 = s.lob ? Math.sin(Math.PI * k2) * 160 : Math.sin(Math.PI * k2) * 14;
      const x2 = lerp(fx, ex, k2), y2 = lerp(fy - z0, ey - z1, k2) - arc2;
      if (k > 0.02) { const tg = c.createLinearGradient(x2, y2, x, y); tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, 'rgba(255,240,200,.55)'); c.strokeStyle = tg; c.lineWidth = s.lob ? 5 : 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x2, y2); c.lineTo(x, y); c.stroke(); }
      if (kind === 'archertower' || kind === 'xbow' || kind === 'troop:archer' || kind === 'troop:skyttedronningen' || kind === 'troop:batswarm') {
        const ang = Math.atan2((ey - z1) - (fy - z0), ex - fx);
        c.save(); c.translate(x, y); c.rotate(ang); c.strokeStyle = kind === 'xbow' ? '#d9b44a' : '#f7e6c4'; c.lineWidth = kind === 'xbow' ? 3 : 2;
        c.beginPath(); c.moveTo(-10, 0); c.lineTo(4, 0); c.stroke(); c.restore();
      } else if (kind === 'wizardtower' || kind === 'troop:wizard' || kind === 'troop:denstorevagt' || kind === 'troop:dragon' || kind === 'bossfortress') {
        const col = kind === 'troop:dragon' || kind === 'bossfortress' ? '#ff7a1a' : kind === 'troop:denstorevagt' ? '#7ad7ff' : '#ff80ff';
        c.save(); c.globalCompositeOperation = 'lighter'; glowAt(c, x, y, 16, col, 1); c.restore();
        if (Math.random() < 0.5) part({ x: x, y: y, z: 0, life: 0.3, max: 0.3, size: 3, col: col, kind: 'spark', drag: 1 });
      } else if (kind === 'airdefense' || kind === 'eagleartillery') {
        c.fillStyle = '#c0392b'; c.beginPath(); c.arc(x, y, kind === 'eagleartillery' ? 8 : 4, 0, 7); c.fill();
        part({ x: x, y: y, z: 0, life: 0.4, max: 0.4, size: 4, col: 'rgba(220,220,220,.6)', kind: 'smoke', drag: 1 });
      } else if (kind.startsWith('troop:')) {
        c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill();
      } else {
        c.fillStyle = '#1a1a24'; c.beginPath(); c.arc(x, y, s.lob ? 7 : 5, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(x - 1.5, y - 1.5, 1.8, 0, 7); c.fill();
      }
    }
  },
  drawBeams(c) {
    const sim = this.b.sim;
    for (const be of FX.beams) {
      const bb = sim.b[be.b], u = sim.units[be.u];
      if (!bb || !u) continue;
      const z0 = be.kind === 'infernotower' ? 40 : be.kind === 'monolith' ? 60 : be.kind === 'hiddentrap' ? 36 : 20;
      const [fx, fy] = iso(bb.cx, bb.cy), [ex, ey] = iso(u.x, u.y);
      const col = be.kind === 'infernotower' ? '#ff7a1a' : be.kind === 'monolith' ? '#7fd4ff' : be.kind === 'hiddentrap' ? '#e8fbff' : '#ffe27a';
      c.save(); c.shadowColor = col; c.shadowBlur = 16; c.strokeStyle = col; c.lineWidth = be.kind === 'infernotower' ? 5 : 3; c.globalAlpha = 1 - be.t / be.max;
      c.beginPath(); c.moveTo(fx, fy - z0);
      if (be.kind === 'hiddentrap') { for (let k = 1; k < 5; k++) c.lineTo(lerp(fx, ex, k / 5) + rand(-6, 6), lerp(fy - z0, ey - 14, k / 5) + rand(-6, 6)); }
      c.lineTo(ex, ey - (u.air ? 50 : 14)); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); c.restore();
    }
  },
};
function hpBar(c, x, y, w, k, col) {
  c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  c.fillStyle = k > 0.5 ? col : k > 0.25 ? '#ffcf3a' : '#ff5a4a'; c.fillRect(x - w / 2, y, w * clamp(k, 0, 1), 4);
}
$('#bEnd').onclick = () => { Sound.play('click'); Battle.endNow(); };
$('#rpSpeed').onclick = () => { const r = Battle.b && Battle.b.replay; if (!r) return; r.speed = r.speed >= 4 ? 1 : r.speed * 2; $('#rpSpeed').textContent = r.speed + 'x'; Sound.play('click'); };
$('#rpExit').onclick = () => { Sound.play('click'); Battle.exit(); };

/* =====================================================================
   MAIN LOOP
   ===================================================================== */
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const t = now / 1000;
  camUpdate(dt);
  if (S.scene === 'battle' && Battle.b) Battle.update(dt);
  else if (S.scene === 'home' && S.me) { updateWorkers(dt, t); updateHud(); }
  updateFx(dt);
  if (ground && (S.scene === 'battle' || S.me)) {
    ambient(dt, ground.theme);
    drawSea(ctx, t);
    drawGround(ctx);
    if (S.scene === 'battle' && Battle.b) Battle.draw(ctx, t);
    else if (S.me) homeDraw(ctx, t, dt);
    drawClouds(ctx, t);
    drawParticles(ctx);
    drawTexts(ctx);
    drawPost(ctx);
  } else if (ground) { drawSea(ctx, t); drawGround(ctx); drawDemo(ctx, t); drawClouds(ctx, t); drawParticles(ctx); drawPost(ctx); }
  requestAnimationFrame(frame);
}
