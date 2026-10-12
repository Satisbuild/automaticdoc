'use strict';
/* =====================================================================
   GREJS VS ZOMBIES - ui.js
   Alle skærme og menuer: hovedmenu, verdenskort, baneoversigt,
   bane-intro/loadout, kamp-HUD og input, resultater, plantesamling,
   opgraderinger, leksikon, udfordringer, Endless og indstillinger.
   ===================================================================== */
GVZ.UI = (function () {
  const U = GVZ.U, P = GVZ.Plants, Z = GVZ.Zombies, WD = GVZ.Worlds, PR = GVZ.Progress, AU = GVZ.Audio, A = GVZ.A;
  const $ = U.$, $$ = U.$$, el = U.el, esc = U.esc;
  const S = () => PR.S;

  let current = null;
  const history = [];
  const ui = { worldIdx: 0, level: null, loadout: [], filter: 'all', sort: 'cat', colSel: 'kernekanon', upSel: 'kernekanon', almTab: 'plants', almSel: null, chTab: 'daily', endlessTheme: 0 };

  /* ---------------- Hjælpere ---------------- */
  const svg = (body, vb) => '<svg class="si" viewBox="' + (vb || '0 0 24 24') + '" aria-hidden="true">' + body + '</svg>';
  const SVG = {
    star: svg('<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" fill="#ffc21a" stroke="#2a1b12" stroke-width="1.6" stroke-linejoin="round"/>'),
    belt: svg('<path d="M3 8h14l-3-3M21 16H7l3 3" fill="none" stroke="#2a1b12" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
    storm: svg('<path d="M4 6l6 6-6 6M12 6l6 6-6 6" fill="none" stroke="#c42a36" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
    lock: svg('<rect x="5" y="10" width="14" height="10" rx="2" fill="#ffd23f" stroke="#2a1b12" stroke-width="1.8"/><path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="#2a1b12" stroke-width="2"/>'),
    skull: svg('<path d="M12 3c-4.4 0-8 3.2-8 7.6 0 2.4 1.1 4 2.6 5V19h2.2v-2h1.4v2h3.6v-2h1.4v2h2.2v-3.4c1.5-1 2.6-2.6 2.6-5C20 6.2 16.4 3 12 3z" fill="#fff4d8" stroke="#2a1b12" stroke-width="1.6"/><circle cx="8.8" cy="11" r="2" fill="#2a1b12"/><circle cx="15.2" cy="11" r="2" fill="#2a1b12"/>'),
    loop: svg('<path d="M7 9a4 4 0 100 6c2 0 3-1.5 5-3s3-3 5-3a4 4 0 110 6c-2 0-3-1.5-5-3S9 9 7 9z" fill="none" stroke="#2a1b12" stroke-width="2.4"/>'),
  };
  const ico = (cls) => '<i class="' + cls + '"></i>';
  function chipsHTML() {
    const s = S();
    return '<span class="chip">' + ico('coin') + U.fmt(s.coins) + '</span><span class="chip">' + ico('gem') + s.gems + '</span><span class="chip">' + ico('star') + PR.totalStars() + '</span>';
  }
  function refreshChips() { $$('.chips').forEach((c) => { c.innerHTML = chipsHTML(); }); }
  function toast(msg, kind) {
    const t = el('div', 'toast ' + (kind || ''), msg);
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3300);
  }
  function modal(html, opts) {
    opts = opts || {};
    const m = $('#modal');
    m.innerHTML = html;
    $('#modalBack').classList.add('show');
    $('#modalBack').onclick = (e) => { if (e.target.id === 'modalBack' && opts.dismiss !== false) closeModal(); };
    return m;
  }
  function closeModal() { $('#modalBack').classList.remove('show'); $('#modal').innerHTML = ''; }
  function confirmBox(title, text, yes, yesLabel) {
    const m = modal('<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="row"><button class="btn gray" data-no>Annullér</button><button class="btn red" data-yes>' + esc(yesLabel || 'Ja') + '</button></div>');
    m.querySelector('[data-no]').onclick = () => { AU.play('click'); closeModal(); };
    m.querySelector('[data-yes]').onclick = () => { AU.play('click'); closeModal(); yes(); };
  }
  function fadeTo(fn) {
    const f = $('#fade');
    f.classList.add('on');
    setTimeout(() => { fn(); requestAnimationFrame(() => f.classList.remove('on')); }, 260);
  }
  function show(name, push) {
    if (current && push !== false && current !== name) history.push(current);
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + name));
    current = name;
    refreshChips();
    const r = RENDER[name];
    if (r) r();
    if (name !== 'battle') AU.playSong(name === 'levels' ? WD.WORLDS[ui.worldIdx].song : 'menu');
    menuBg.active = name !== 'battle';
  }
  function back() {
    AU.play('click');
    if (current === 'battle') return;
    const prev = history.pop() || 'menu';
    show(prev, false);
  }
  const levelLabel = (lvl) => {
    if (lvl.mode === 'adventure') return WD.WORLDS[lvl.world].name + ' · Bane ' + (lvl.idx + 1);
    return lvl.name;
  };
  const TYPE_INFO = {
    normal: ['Almindelig', ''], special: ['Specialbane', SVG.star], conveyor: ['Transportbånd', SVG.belt], gauntlet: ['Stormbane', SVG.storm],
    puzzle: ['Fast udvalg', SVG.lock], boss: ['BOSSKAMP', SVG.skull], endless: ['Endless', SVG.loop],
  };
  const speedName = (s) => (s < 15 ? 'Meget langsom' : s < 19 ? 'Langsom' : s < 24 ? 'Normal' : s < 38 ? 'Hurtig' : 'Lynhurtig');
  const RES_NAMES = { fire: 'Ild', ice: 'Frost', poison: 'Gift', elec: 'Lyn' };
  const ATK_NAMES = { summon: 'Tilkalder zombier', lob: 'Kaster råddent affald', stomp: 'Jordskælv i en række', sandstorm: 'Sandstorm', beam: 'Øjenstråle over en række', volley: 'Kanonsalve', anchor: 'Ankerslag', charge: 'Løbske vogne', dynamite: 'Dynamit', laser: 'Laser', missiles: 'Missiler', firebreath: 'Ildånde', summonBats: 'Vampyrflokke', freeze: 'Frysebølge', iceblock: 'Isblokke', cars: 'Kaster bilvrag', poisonLob: 'Giftspyt', grab: 'Griber planter' };
  const WEAK_NAMES = { fire: 'Ild', ice: 'Frost', elec: 'Lyn', explode: 'Eksplosioner', pierce: 'Gennemboring', none: 'Ingen' };

  /* ===================================================================
     Menu-baggrund (animeret havescene)
     =================================================================== */
  const menuBg = {
    active: true, cv: null, ctx: null, zs: [], plants: [], t: 0, last: 0, world: 0,
    init() {
      this.cv = $('#menuBg'); this.ctx = this.cv.getContext('2d');
      const L = WD.LAYOUT;
      const spots = [['solspire', 0, 0], ['kernekanon', 1, 1], ['tvillinglys', 0, 2], ['pebberpuffer', 2, 3], ['barkmur', 5, 2], ['isknop', 1, 4], ['solspire', 0, 3], ['grenskyder', 2, 1], ['laserlilje', 3, 0], ['stenrod', 6, 4], ['lynklover', 3, 3], ['ildblomst', 2, 0], ['tomatbombe', 4, 4]];
      this.plants = spots.map(([id, c, r]) => ({ id, x: L.X0 + c * L.CW + L.CW / 2, y: L.Y0 + r * L.CH + L.CH - 18, p: { seed: Math.random() * 9, lv: 1 + (r % 3) * 2, shootT: 9, hp: 1, maxHp: 1, s: P.stats(id, 1), prod: 20, fuse: 99, life: 9, grow: 999, armT: 0 } }));
      const loop = (ts) => { this.frame(ts); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },
    frame(ts) {
      const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000); this.last = ts;
      if (!this.active) return;
      this.t += dt;
      const cv = this.cv, dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = innerWidth, h = innerHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = this.ctx;
      const wi = current === 'levels' ? ui.worldIdx : 0;
      const wd = WD.WORLDS[wi];
      const L = WD.LAYOUT;
      const tiles = []; for (let r = 0; r < 5; r++) { tiles.push([]); for (let c = 0; c < 9; c++) tiles[r].push('grass'); }
      const bg = WD.background(wd, tiles, Math.min(1.5, dpr * Math.max(w / 1280, h / 720)));
      const sc = Math.max(w / 1080, h / 720);
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, 0, 0);
      const ox = (w / sc - 1280) / 2 + 100, oy = (h / sc - 720) / 2;
      ctx.translate(ox, oy);
      ctx.drawImage(bg, 0, 0, 1280, 720);
      const t = this.t;
      if (wi === 0) for (const pl of this.plants) { ctx.save(); ctx.translate(pl.x, pl.y); A.shadow(ctx, 0, 0, 28, 7, 0.2); try { P.BY[pl.id].draw(ctx, pl.p, t); } catch (e) {} ctx.restore(); if (pl.p.shootT > 1.5 && Math.random() < dt * 0.6) pl.p.shootT = 0; pl.p.shootT += dt; }
      // zombier, der vandrer
      if (Math.random() < dt * 0.35 && this.zs.length < 6) {
        const pool = wi === 0 ? ['shambler', 'pothead', 'kettle', 'sprinter', 'flag', 'shieldbearer'] : WD.WORLDS[wi].intro ? Object.values(WD.WORLDS[wi].intro).concat(['shambler', 'kettle']) : ['shambler'];
        const id = U.pick(pool);
        const d = Z.BY[id];
        if (d) this.zs.push({ def: d, id, row: U.randi(0, 4), x: 1340, walk: 0, hp: 1, maxHp: 1, armor: d.armor || 0, armorMax: d.armor || 0, shieldHp: d.shield || 0, shieldMax: d.shield || 0, state: 'walk', seed: Math.random() * 9, flying: !!(d.ab && d.ab.fly) });
      }
      this.zs.sort((a, b) => a.row - b.row);
      for (const z of this.zs) {
        z.x -= d0(z) * dt; z.walk += dt * d0(z) * 0.22;
        ctx.save(); ctx.translate(z.x, L.Y0 + z.row * L.CH + L.CH - 18);
        if (!z.flying) A.shadow(ctx, 0, 0, 26, 7, 0.25);
        try { Z.draw(ctx, z, t); } catch (e) {}
        ctx.restore();
      }
      this.zs = this.zs.filter((z) => z.x > 120);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, cv.height);
      g.addColorStop(0, 'rgba(10,25,14,.25)'); g.addColorStop(1, 'rgba(10,25,14,.55)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      function d0(z) { return z.def.speed * 0.8; }
    },
  };

  /* ===================================================================
     Hovedmenu
     =================================================================== */
  function renderMenu() {
    const s = S();
    const need = PR.xpNeed(s.plvl);
    const done = PR.levelsDone();
    $('#profile').innerHTML =
      '<div class="lvl"><b>' + s.plvl + '</b><div><div>Gartner Lv ' + s.plvl + '</div><div class="xpbar"><div style="width:' + Math.round((s.xp / need) * 100) + '%"></div></div><small>' + s.xp + ' / ' + need + ' XP</small></div></div>' +
      '<div class="stat">' + ico('coin') + U.fmt(s.coins) + '</div><div class="stat">' + ico('gem') + s.gems + '</div>' +
      '<div class="stat">' + ico('star') + PR.totalStars() + ' / 450</div><div class="stat">🗺 ' + done + ' / 150 baner</div>';
    const nx = PR.nextLevel();
    const dailyLeft = [0, 1, 2].filter((i) => !s.daily[U.dayKey() + '-' + i]).length;
    const upCount = PR.ownedList().filter((id) => PR.canUpgrade(id)).length;
    const btns = [
      { id: 'play', label: 'Spil', sub: 'Fortsæt: ' + WD.WORLDS[nx.wi].name + ' ' + (nx.li + 1), icon: ['p', 'kernekanon'], primary: true },
      { id: 'adventure', label: 'Eventyr', sub: '10 verdener · 150 baner', icon: ['p', 'solspire'], primary: true },
      { id: 'collection', label: 'Plantesamling', sub: PR.ownedList().length + ' / ' + P.LIST.length + ' planter', icon: ['p', 'tvillinglys'] },
      { id: 'upgrades', label: 'Planteopgraderinger', sub: 'Gør dine planter stærkere', icon: ['p', 'pebberpuffer', 5], badge: upCount || null },
      { id: 'almanac', label: 'Leksikon', sub: 'Planter, zombier og medaljer', icon: ['z', 'shambler'] },
      { id: 'challenges', label: 'Daglige udfordringer', sub: 'Daglige, special og skattejagt', icon: ['z', 'kettle'], badge: dailyLeft || null },
      { id: 'endless', label: 'Endless Survival', sub: 'Rekord: ' + s.endless.bestWave + ' bølger', icon: ['z', 'brute'] },
      { id: 'settings', label: 'Indstillinger', sub: 'Lyd, grafik og data', icon: ['p', 'urtetid'] },
    ];
    const box = $('#menuBtns');
    box.innerHTML = '';
    for (const b of btns) {
      const e = el('button', 'mbtn' + (b.primary ? ' primary' : ''));
      const src = b.icon[0] === 'p' ? P.iconURL(b.icon[1], 96, b.icon[2] || 1) : Z.iconURL(b.icon[1], 96);
      e.innerHTML = '<img class="mi" src="' + src + '" alt="">' + '<b>' + b.label + '</b><small>' + esc(b.sub) + '</small>' + (b.badge ? '<span class="badge">' + b.badge + '</span>' : '');
      e.onclick = () => { AU.play('select'); menuAction(b.id); };
      box.appendChild(e);
    }
  }
  function menuAction(id) {
    if (id === 'play') { const nx = PR.nextLevel(); ui.worldIdx = nx.wi; openLevel(WD.buildLevel(nx.wi, nx.li)); return; }
    if (id === 'adventure') return show('worlds');
    show(id);
  }

  /* ===================================================================
     Verdenskort
     =================================================================== */
  const thumbCache = {};
  function worldThumb(wi, w, h) {
    const k = wi + '|' + w;
    if (!thumbCache[k]) thumbCache[k] = WD.thumb(wi, w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(thumbCache[k], 0, 0);
    return c;
  }
  function renderWorlds() {
    const box = $('#worldList');
    box.innerHTML = '';
    WD.WORLDS.forEach((w, wi) => {
      const unlocked = PR.worldUnlocked(wi);
      const stars = PR.worldStars(wi);
      const bossDone = !!(PR.levelState(wi, 14) && PR.levelState(wi, 14).done);
      const card = el('button', 'wcard' + (unlocked ? '' : ' locked'));
      card.appendChild(worldThumb(wi, 360, 180));
      card.insertAdjacentHTML('beforeend', '<span class="wnum">Verden ' + (wi + 1) + '</span>' +
        '<span class="bossmark' + (bossDone ? ' done' : '') + '">' + (bossDone ? '✓ Boss besejret' : '☠ ' + esc(Z.BOSSES[w.boss].name)) + '</span>' +
        (unlocked ? '' : '<div class="lock"><div><span>🔒</span>Besejr bossen i<br>' + esc(WD.WORLDS[wi - 1].name) + '</div></div>') +
        '<div class="wbody"><h3>' + esc(w.name) + '</h3><p>' + esc(w.sub) + '</p><div class="wstars">' + ico('star') + stars + ' / 45<div class="prog"><div style="width:' + Math.round((stars / 45) * 100) + '%"></div></div></div></div>');
      card.onclick = () => {
        if (!unlocked) { AU.play('deny'); toast('🔒 Besejr først bossen i ' + WD.WORLDS[wi - 1].name, 'bad'); return; }
        AU.play('select'); ui.worldIdx = wi; show('levels');
      };
      box.appendChild(card);
    });
  }

  /* ===================================================================
     Baneoversigt
     =================================================================== */
  function renderLevels() {
    const wi = ui.worldIdx, w = WD.WORLDS[wi];
    $('#levelsTitle').textContent = 'Verden ' + (wi + 1) + ': ' + w.name;
    const map = $('#levelMap');
    map.innerHTML = '';
    const bg = worldThumb(wi, 720, 360); bg.className = 'lm-bg'; map.appendChild(bg);
    const pos = [];
    for (let i = 0; i < 15; i++) {
      const row = Math.floor(i / 5), k = i % 5;
      const col = row % 2 === 0 ? k : 4 - k;
      pos.push([10 + col * 20, 20 + row * 30 + (k % 2 ? 4 : -4)]);
    }
    let path = '';
    pos.forEach((p, i) => { path += (i ? ' L' : 'M') + p[0] + ' ' + p[1]; });
    map.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="' + path + '" fill="none" stroke="rgba(42,27,18,.75)" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="stroke-width:12px"/><path d="' + path + '" fill="none" stroke="#fff4d8" stroke-dasharray="2 2" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="stroke-width:5px;stroke-dasharray:10 10"/></svg>');
    const nx = PR.nextLevel();
    for (let i = 0; i < 15; i++) {
      const st = PR.levelState(wi, i), unl = PR.levelUnlocked(wi, i);
      const lvlMeta = WD.buildLevel(wi, i);
      const n = el('button', 'lnode' + (i === 14 ? ' boss' : '') + (st && st.done ? ' done' : '') + (!unl ? ' locked' : '') + (nx.wi === wi && nx.li === i ? ' next' : ''));
      n.style.left = pos[i][0] + '%'; n.style.top = pos[i][1] + '%';
      const ti = TYPE_INFO[lvlMeta.type] || TYPE_INFO.normal;
      n.innerHTML = (i === 14 ? '<img src="' + Z.iconURL(w.boss, 96) + '" alt="Boss" style="width:118%;height:118%;margin-top:-14%;pointer-events:none">' : i + 1) + (ti[1] && i !== 14 ? '<span class="ltype" title="' + ti[0] + '">' + ti[1] + '</span>' : '') +
        '<span class="ls">' + [0, 1, 2].map((s) => '<i class="' + (st && st.s && st.s[s] ? 'on' : '') + '"></i>').join('') + '</span>';
      n.title = ti[0] + (lvlMeta.reward.plant ? ' · Låser op: ' + P.BY[lvlMeta.reward.plant].name : '');
      n.onclick = () => {
        if (!unl) { AU.play('deny'); toast('🔒 Klar den forrige bane først', 'bad'); return; }
        AU.play('select'); openLevel(lvlMeta);
      };
      map.appendChild(n);
    }
    renderChests();
  }
  function renderChests() {
    const wi = ui.worldIdx;
    const bar = $('#chestBar');
    bar.innerHTML = '';
    const stars = PR.worldStars(wi), cs = PR.chestState(wi);
    PR.CHEST_AT.forEach((need, i) => {
      const ready = !cs[i] && stars >= need;
      const c = el('div', 'chest' + (ready ? ' ready' : '') + (cs[i] ? ' claimed' : ''), '<span class="ci">' + (cs[i] ? '📭' : '🎁') + '</span><div>' + ico('star') + ' ' + Math.min(stars, need) + ' / ' + need + '<br><small>' + (cs[i] ? 'Åbnet' : ready ? 'Tryk for at åbne!' : 'Stjernekiste') + '</small></div>');
      c.querySelector('i').style.cssText = 'width:16px;height:16px;display:inline-block;vertical-align:-2px';
      if (ready) c.onclick = () => {
        const rew = PR.claimChest(wi, i);
        if (rew) { AU.play('gem'); modal('<h2 class="win">Stjernekiste!</h2><div class="rewards"><div class="rw">' + ico('gem') + '+' + rew.gems + '</div><div class="rw">' + ico('coin') + '+' + U.fmt(rew.coins) + '</div></div><div class="row"><button class="btn" data-ok>Fedt!</button></div>').querySelector('[data-ok]').onclick = closeModal; renderChests(); refreshChips(); }
      };
      bar.appendChild(c);
    });
  }

  /* ===================================================================
     Bane-intro og loadout
     =================================================================== */
  function openLevel(lvl) {
    ui.level = lvl;
    const fixed = lvl.plantsFixed;
    let lo = (fixed ? fixed.slice() : S().loadout.filter((id) => PR.owns(id)));
    if (!fixed) {
      if (lvl.bannedCats) lo = lo.filter((id) => !lvl.bannedCats.includes(P.BY[id].cat));
      if (lvl.conveyorFromLoadout) lo = lo.filter((id) => P.BY[id].cat !== 'resource');
      // nyeste plante kommer altid med, hvis der er plads
      if (!lo.length) lo = PR.ownedList().filter((id) => !lvl.conveyorFromLoadout || P.BY[id].cat !== 'resource');
    }
    ui.loadout = lo.slice(0, lvl.slots || 8);
    show('loadout');
  }
  function renderLoadout() {
    const lvl = ui.level;
    if (!lvl) return show('menu', false);
    $('#loadTitle').textContent = levelLabel(lvl);
    const w = WD.WORLDS[lvl.world];
    const ti = TYPE_INFO[lvl.type] || TYPE_INFO.normal;
    const st = lvl.mode === 'adventure' ? PR.levelState(lvl.world, lvl.idx) : null;
    let h = '<h3>' + esc(lvl.mode === 'adventure' ? w.name + ' ' + (lvl.idx + 1) : lvl.name) + '</h3><span class="ltag">' + ti[1] + ' ' + ti[0] + '</span>';
    if (lvl.objective && lvl.objective.text) h += '<div class="box"><b>Mål</b>' + esc(lvl.objective.text) + '</div>';
    if (lvl.mode === 'adventure' && lvl.world === 0 && lvl.idx === 0) h += '<div class="box"><b>Sådan spiller du</b>Vælg en plante øverst, og tryk på et felt for at plante den. Saml sol, der falder ned, for at få råd til flere planter. Stop zombierne, før de når huset!</div>';
    else if (w.mech.length && (lvl.idx <= 1 || lvl.mode !== 'adventure')) h += '<div class="box"><b>Verdensmekanik</b>' + esc(w.mechText) + '</div>';
    if (lvl.newZombie && Z.BY[lvl.newZombie]) {
      const zd = Z.BY[lvl.newZombie];
      h += '<div class="box"><b>Ny zombie: ' + esc(zd.name) + '</b><div style="display:flex;gap:8px;align-items:center"><img src="' + Z.iconURL(zd.id, 72) + '" width="56" height="56" alt=""><span>' + esc(zd.desc) + '<br><i style="color:#3c8f2a">Tip: ' + esc(zd.tip || '') + '</i></span></div></div>';
    }
    if (lvl.boss) {
      const bd = Z.BOSSES[lvl.boss];
      h += '<div class="box"><b>Boss: ' + esc(bd.name) + '</b><div style="display:flex;gap:8px;align-items:center"><img src="' + Z.iconURL(lvl.boss, 80) + '" width="64" height="64" alt=""><span>' + esc(bd.desc) + '<br><b style="display:inline;font-size:14px">Svaghed:</b> ' + esc(bd.weakText) + '</span></div></div>';
    }
    const zs = (lvl.zombiesPreview || []).filter((id) => Z.BY[id]);
    if (zs.length) h += '<div class="box"><b>Zombier på banen</b><div class="zrow">' + zs.map((id) => '<img class="' + (id === lvl.newZombie ? 'new' : '') + '" title="' + (S().seenZ[id] ? esc(Z.BY[id].name) : '???') + '" src="' + Z.iconURL(id, 64, !S().seenZ[id] && id !== lvl.newZombie) + '">').join('') + '</div></div>';
    if (lvl.mode === 'adventure') {
      const s = st && st.s ? st.s : [false, false, false];
      h += '<div class="box stars3"><b>Stjerner</b>' + [['Vind banen', s[0]], [lvl.noShredders ? 'Vind banen (ingen kværnere her)' : 'Brug ingen kværnere', s[1]], [lvl.star3 ? lvl.star3.text : '-', s[2]]].map((x) => '<div>' + ico('star') + '<span style="opacity:' + (x[1] ? 1 : 0.75) + '">' + esc(x[0]) + (x[1] ? ' ✓' : '') + '</span></div>').join('') + '</div>';
    }
    const r = lvl.reward || {};
    const first = !(st && st.done);
    let rw = '';
    if (r.coins) rw += '<span class="chip" style="background:rgba(0,0,0,.6)">' + ico('coin') + (first ? r.coins : Math.round(r.coins * 0.4)) + '</span> ';
    if (r.gems && first) rw += '<span class="chip" style="background:rgba(0,0,0,.6)">' + ico('gem') + r.gems + '</span> ';
    if (r.plant && first && !PR.owns(r.plant)) rw += '<span class="chip" style="background:rgba(0,0,0,.6)">🌱 Ny plante!</span>';
    if (rw) h += '<div class="box"><b>Belønning</b>' + rw + '</div>';
    $('#lvlInfo').innerHTML = h;
    renderPicker();
    const ab = PR.abilities();
    $('#abilityPreview').innerHTML = lvl.mods && lvl.mods.includes('nopower') ? '<span>Evner og Plant Power er slået fra</span>' : ab.length ? 'Evner: ' + ab.map((a) => '<span title="' + esc(a.text) + '">' + a.icon + ' ' + esc(a.name) + '</span>').join('') : '';
    $('#btnStart').textContent = lvl.boss ? 'Mød bossen!' : 'Kæmp!';
  }
  function renderPicker() {
    const lvl = ui.level;
    const slotsN = lvl.slots || 8;
    const fixed = !!lvl.plantsFixed;
    const conveyorFixed = !!lvl.conveyor && !lvl.conveyorFromLoadout;
    const slots = $('#slots');
    slots.innerHTML = '';
    if (conveyorFixed) {
      slots.innerHTML = '<div style="color:#fff;padding:6px;font-family:var(--font-h);font-size:16px">Transportbånd med: </div>' + lvl.conveyor.map((id) => '<div class="pcard cat-' + P.BY[id].cat + '" style="width:60px"><img src="' + P.iconURL(id, 64, PR.plantLv(id)) + '"></div>').join('');
      $('#pickerTools').innerHTML = '<span style="font-weight:800">Denne bane bruger et fast transportbånd - du skal ikke vælge planter. Tryk på Kæmp!</span>';
      $('#pickGrid').innerHTML = ''; $('#pickDetail').innerHTML = '';
      return;
    }
    for (let i = 0; i < slotsN; i++) {
      const id = ui.loadout[i];
      if (id) {
        const c = plantCard(id, PR.owns(id) ? PR.plantLv(id) : 1);
        c.style.width = '66px';
        if (!fixed) c.onclick = () => { AU.play('click'); ui.loadout.splice(i, 1); renderPicker(); };
        c.onmouseenter = () => pickDetail(id);
        slots.appendChild(c);
      } else slots.appendChild(el('div', 'slot'));
    }
    if (fixed) {
      $('#pickerTools').innerHTML = '<span style="font-weight:800">Fast udvalg: banen bestemmer dine planter.</span>';
      $('#pickGrid').innerHTML = '';
      pickDetail(ui.loadout[0]);
      return;
    }
    const cats = [['all', 'Alle'], ['resource', 'Ressource'], ['attack', 'Angreb'], ['defense', 'Forsvar'], ['trap', 'Fælde'], ['support', 'Støtte']];
    $('#pickerTools').innerHTML = cats.map((c) => '<button class="seg' + (ui.filter === c[0] ? ' on' : '') + '" data-f="' + c[0] + '">' + c[1] + '</button>').join('') +
      '<span style="flex:1"></span><button class="seg' + (ui.sort === 'cat' ? ' on' : '') + '" data-s="cat">Kategori</button><button class="seg' + (ui.sort === 'cost' ? ' on' : '') + '" data-s="cost">Solpris</button><button class="seg' + (ui.sort === 'lv' ? ' on' : '') + '" data-s="lv">Niveau</button>';
    $$('#pickerTools [data-f]').forEach((b) => (b.onclick = () => { AU.play('click'); ui.filter = b.dataset.f; renderPicker(); }));
    $$('#pickerTools [data-s]').forEach((b) => (b.onclick = () => { AU.play('click'); ui.sort = b.dataset.s; renderPicker(); }));
    let list = PR.ownedList();
    if (ui.filter !== 'all') list = list.filter((id) => P.BY[id].cat === ui.filter);
    const catOrder = ['resource', 'attack', 'defense', 'trap', 'support'];
    if (ui.sort === 'cat') list.sort((a, b) => catOrder.indexOf(P.BY[a].cat) - catOrder.indexOf(P.BY[b].cat) || P.BY[a].order - P.BY[b].order);
    if (ui.sort === 'cost') list.sort((a, b) => P.BY[a].cost - P.BY[b].cost);
    if (ui.sort === 'lv') list.sort((a, b) => PR.plantLv(b) - PR.plantLv(a));
    const grid = $('#pickGrid');
    grid.innerHTML = '';
    for (const id of list) {
      const banned = (lvl.bannedCats && lvl.bannedCats.includes(P.BY[id].cat)) || (lvl.conveyorFromLoadout && P.BY[id].cat === 'resource');
      const c = plantCard(id, PR.plantLv(id));
      if (ui.loadout.includes(id)) c.classList.add('chosen');
      if (banned) { c.style.opacity = '.3'; c.title = 'Ikke tilladt på denne bane'; }
      c.onclick = () => {
        pickDetail(id);
        if (banned) { AU.play('deny'); toast(lvl.conveyorFromLoadout ? 'Ressourceplanter bruges ikke i bosskampe' : 'Den type er ikke tilladt her', 'bad'); return; }
        const i = ui.loadout.indexOf(id);
        if (i >= 0) { ui.loadout.splice(i, 1); AU.play('click'); }
        else if (ui.loadout.length < slotsN) { ui.loadout.push(id); AU.play('select'); }
        else { AU.play('deny'); toast('Alle ' + slotsN + ' pladser er fyldt - fjern en plante først', 'bad'); return; }
        renderPicker();
      };
      c.onmouseenter = () => pickDetail(id);
      grid.appendChild(c);
    }
  }
  function plantCard(id, lv, locked) {
    const d = P.BY[id];
    const c = el('button', 'pcard cat-' + d.cat + (locked ? ' locked' : ''));
    c.innerHTML = '<img src="' + P.iconURL(id, 80, lv, locked) + '" alt=""><span class="cost">' + ico('sun') + (locked ? '?' : d.cost) + '</span>' + (locked ? '' : '<span class="lv' + (lv >= P.MAX_LV ? ' max' : '') + '">' + (lv >= P.MAX_LV ? 'MAX' : 'Lv' + lv) + '</span>');
    return c;
  }
  function statLine(id, lv) {
    const s = P.stats(id, lv), d = P.BY[id];
    const parts = ['☀ ' + d.cost, '⏱ ' + s.cd + 's'];
    if (!d.instant) parts.push('❤ ' + s.hp);
    if (s.dmg) parts.push('⚔ ' + s.dmg + (s.rate ? ' / ' + s.rate + 's' : ''));
    if (s.interval) parts.push('↻ ' + s.interval + 's');
    return parts.join(' · ');
  }
  function pickDetail(id) {
    if (!id) return;
    const d = P.BY[id], lv = PR.owns(id) ? PR.plantLv(id) : 1;
    $('#pickDetail').innerHTML = '<b>' + esc(d.name) + '</b> <small>(' + P.CATS[d.cat] + ', Lv ' + lv + ')</small><br>' + statLine(id, lv) + '<br>' + esc(d.special) + (d.pp && d.pp !== '-' ? '<br><span style="color:#2a8a1a">Plant Power: ' + esc(d.pp) + '</span>' : '');
  }
  function startFromLoadout() {
    const lvl = ui.level;
    const conveyorFixed = !!lvl.conveyor && !lvl.conveyorFromLoadout;
    if (!conveyorFixed && !lvl.plantsFixed && !ui.loadout.length) { AU.play('deny'); toast('Vælg mindst én plante', 'bad'); return; }
    const water = lvl.tiles && lvl.tiles.flat().includes('water');
    const go = () => {
      if (!lvl.plantsFixed && !conveyorFixed) { S().loadout = ui.loadout.slice(); PR.save(); }
      AU.play('select');
      fadeTo(() => startBattle(lvl, ui.loadout.slice()));
    };
    if (water && PR.owns('flydeblad') && !ui.loadout.includes('flydeblad') && !lvl.plantsFixed && !conveyorFixed) {
      confirmBox('Ingen Flydeblad?', 'Banen har vand. Uden Flydeblad kan du ikke plante i de bageste kolonner. Vil du starte alligevel?', go, 'Start alligevel');
      return;
    }
    if (!lvl.conveyorFromLoadout && !lvl.plantsFixed && !conveyorFixed && !ui.loadout.some((id) => P.BY[id].cat === 'resource') && PR.ownedList().some((id) => P.BY[id].cat === 'resource') && !lvl.noSky && lvl.startSun < 300) {
      confirmBox('Ingen solplanter?', 'Du har ingen planter, der laver sol. Det bliver svært! Vil du starte alligevel?', go, 'Start alligevel');
      return;
    }
    go();
  }

  /* ===================================================================
     Kamp
     =================================================================== */
  const B = { battle: null, raf: 0, last: 0, paused: false, speed: 1, k: 1, cards: [], drag: null, ended: false, tipStep: 0, tipT: 0, lastHud: {} };
  function startBattle(lvl, loadout) {
    // byg en frisk kopi af banen (genstart skal være deterministisk)
    const fresh = lvl.mode === 'adventure' ? WD.buildLevel(lvl.world, lvl.idx) : lvl.mode === 'endless' ? WD.buildEndless(lvl.world) : lvl;
    if (lvl.mode === 'challenge' || lvl.special || lvl.treasure || lvl.dailyKey) Object.assign(fresh, { waves: lvl.waves.map((w) => ({ list: w.list.slice(), flag: w.flag })) });
    ui.level = fresh;
    ui.loadout = loadout;
    show('battle');
    const b = new GVZ.Battle.Battle(fresh, { loadout, onEnd: (res) => onBattleEnd(fresh, res), onError: (e) => console.error(e) });
    B.battle = b; B.paused = false; B.ended = false; B.tipStep = 0; B.tipT = 0; B.lastHud = {};
    B.speed = 1;
    $('#btnSpeed').textContent = '1×';
    buildHud(b);
    fitStage();
    AU.playSong(fresh.boss ? 'boss' : fresh.mode === 'endless' ? 'tense' : WD.WORLDS[fresh.world].song);
    if (fresh.boss) AU.play('boss');
    cancelAnimationFrame(B.raf);
    B.last = performance.now();
    B.raf = requestAnimationFrame(loop);
    showLevelTip(fresh);
  }
  function showLevelTip(lvl) {
    let tip = null;
    const id = lvl.id;
    if (id === 'w0-0') { B.tipStep = 1; tip = '1. Tryk på <b>Kernekanon</b>-kortet øverst.  2. Tryk på et felt i den midterste række.'; }
    else if (id === 'w0-1') tip = 'Plant <b>Solspirer</b> i de bageste kolonner - de laver sol, så du får råd til flere planter!';
    else if (id === 'w0-2') tip = 'Zombier med <b>grønt skær</b> taber et Plant Power-blad. Vælg Plant Power nederst til venstre og tryk på en plante!';
    else if (id === 'w0-4') tip = 'Transportbånd: planterne er gratis, men kommer i tilfældig rækkefølge. Brug dem klogt!';
    else if (lvl.boss) tip = 'BOSSKAMP! Dine valgte planter kommer på båndet. Hold øje med de røde markeringer - der rammer bossen næste gang!';
    else if (lvl.mode === 'adventure' && lvl.idx === 0 && WD.WORLDS[lvl.world].mech.length) tip = WD.WORLDS[lvl.world].mechText;
    else if (lvl.objective && lvl.objective.type === 'line') tip = 'Ingen zombie må gå over blomsterlinjen!';
    else if (lvl.objective && lvl.objective.type === 'protect') tip = 'Beskyt planterne med ♥ - mister du én, taber du banen.';
    if (tip) { setTip(tip); B.tipT = B.tipStep ? 999 : 9; }
  }
  function setTip(html) { const t = $('#tipBox'); if (html) { t.innerHTML = html; t.classList.add('show'); } else t.classList.remove('show'); }
  function updateTutorial(b, dt) {
    if (B.tipT > 0 && B.tipT < 900) { B.tipT -= dt; if (B.tipT <= 0) setTip(null); }
    if (!B.tipStep) return;
    if (B.tipStep === 1 && b.stats.placed > 0) { B.tipStep = 2; setTip('Godt! Tryk nu på <b>solen</b>, når den falder ned, for at samle den.'); }
    else if (B.tipStep === 2 && b.stats.sun >= 25) { B.tipStep = 3; setTip('Sådan! Plant flere Kernekanoner, efterhånden som du får sol. Zombierne kommer snart...'); B.tipT = 8; }
    else if (B.tipStep === 3 && B.tipT <= 0) { B.tipStep = 0; }
  }
  function buildHud(b) {
    const bank = $('#bank');
    bank.innerHTML = '';
    bank.classList.toggle('belt', b.conveyor);
    B.cards = [];
    B.beltEls = {};
    if (!b.conveyor) {
      b.cards.forEach((card, i) => {
        const c = plantCard(card.id, card.lv);
        c.style.width = '70px';
        c.insertAdjacentHTML('beforeend', '<div class="cd"></div><span class="key">' + (i + 1) + '</span>');
        c.querySelector('.cost').innerHTML = ico('sun') + card.cost;
        c.addEventListener('pointerdown', (e) => { e.preventDefault(); cardDown(i, e); });
        bank.appendChild(c);
        B.cards.push({ el: c, cd: c.querySelector('.cd') });
      });
      bank.style.width = (b.cards.length * 74 + 12) + 'px';
    }
    $('#btnShovel').style.left = (b.conveyor ? 116 + 668 + 8 : 116 + b.cards.length * 74 + 12 + 8) + 'px';
    // evner
    const ab = $('#abilities');
    ab.innerHTML = '';
    b.abilities.forEach((a, i) => {
      const e = el('button', 'abil', a.def.icon + '<small>' + esc(a.def.name) + '</small><div class="cd"></div><div class="cdt"></div>');
      e.title = a.def.name + ': ' + a.def.text;
      e.onclick = () => { if (b.useAbility(i)) toast(a.def.icon + ' ' + a.def.name + '!', 'good'); else AU.play('deny'); };
      ab.appendChild(e);
    });
    $('#btnPower').style.display = b.noPower ? 'none' : '';
    // bølgebjælke
    const flags = $('#wbFlags');
    flags.innerHTML = '';
    const wb = $('#waveBar');
    wb.classList.toggle('boss', !!b.boss);
    if (!b.boss && !b.endless) {
      const n = b.waves.length;
      b.waves.forEach((w, i) => { if (w.flag) { const f = el('i'); f.style.left = (100 - ((i + 1) / n) * 100) + '%'; f.dataset.i = i; flags.appendChild(f); } });
    }
    $('#wbName').textContent = b.boss ? Z.BOSSES[b.boss.id].name : b.endless ? 'Endless' : levelLabel(b.level);
    setTip(null);
  }
  function cardDown(i, e) {
    const b = B.battle;
    if (!b) return;
    AU.unlock();
    const card = b.cards[i];
    if (b.selected === i) { b.selected = null; AU.play('click'); return; }
    if (card.cd > 0) { b.deny('Planten lader stadig op'); return; }
    if (b.sun < card.cost) { b.deny('Ikke nok sol'); flashSun(); return; }
    b.selected = i; AU.play('select');
    B.drag = { sx: e.clientX, sy: e.clientY, moved: false };
  }
  function beltDown(uid, e) {
    const b = B.battle;
    const key = 'belt:' + uid;
    if (b.selected === key) { b.selected = null; return; }
    b.selected = key; AU.play('select');
    B.drag = { sx: e.clientX, sy: e.clientY, moved: false };
  }
  function flashSun() { const s = $('#sunBox'); s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash'); }
  function toLogical(cx, cy) {
    const r = $('#battleCanvas').getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * 1280, y: ((cy - r.top) / r.height) * 720 };
  }
  function fitStage() {
    const wrap = $('#stageWrap');
    const w = wrap.clientWidth || innerWidth, h = wrap.clientHeight || innerHeight;
    const s = Math.min(w / 1280, h / 720);
    const ox = (w - 1280 * s) / 2, oy = (h - 720 * s) / 2;
    $('#stage').style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + s + ')';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = Math.min(2, s * dpr);
    const cv = $('#battleCanvas');
    cv.width = Math.round(1280 * k); cv.height = Math.round(720 * k);
    B.k = k;
    if (B.battle) B.battle.bg = null;
  }
  function loop(ts) {
    const b = B.battle;
    if (!b) return;
    let dt = Math.min(0.05, (ts - B.last) / 1000);
    B.last = ts;
    if (!B.paused && !B.ended) {
      for (let i = 0; i < B.speed; i++) b.update(dt);
      updateTutorial(b, dt);
    }
    const cv = $('#battleCanvas'), ctx = cv.getContext('2d');
    ctx.setTransform(B.k, 0, 0, B.k, 0, 0);
    b.render(ctx, { bgScale: B.k });
    updateHud(b);
    B.raf = requestAnimationFrame(loop);
  }
  function updateHud(b) {
    const L = B.lastHud;
    if (L.sun !== b.sun) { $('#sunTxt').textContent = b.sun; L.sun = b.sun; }
    if (L.coins !== b.stats.coins) { $('#coinChip span').textContent = b.stats.coins; L.coins = b.stats.coins; }
    // kort
    if (!b.conveyor) b.cards.forEach((card, i) => {
      const e = B.cards[i];
      const f = card.cd > 0 ? card.cd / card.cdMax : 0;
      const poor = b.sun < card.cost;
      const sel = b.selected === i;
      const key = f.toFixed(3) + poor + sel;
      if (e.key === key) return;
      e.key = key;
      e.cd.style.height = (f * 100) + '%';
      e.el.classList.toggle('poor', poor);
      e.el.classList.toggle('sel', sel);
    });
    else syncBelt(b);
    $('#btnShovel').classList.toggle('sel', b.selected === 'shovel');
    const pp = $('#btnPower');
    if (L.leaves !== b.leaves || L.ppSel !== (b.selected === 'power')) {
      L.leaves = b.leaves; L.ppSel = b.selected === 'power';
      $('#ppLeaves').innerHTML = [0, 1, 2].map((i) => '<i class="' + (i < b.leaves ? 'on' : '') + '"></i>').join('');
      pp.classList.toggle('sel', b.selected === 'power');
      pp.classList.toggle('empty', b.leaves <= 0);
    }
    $$('#abilities .abil').forEach((e, i) => {
      const a = b.abilities[i];
      if (!a) return;
      const f = a.cd / a.def.cd;
      e.querySelector('.cd').style.height = (f * 100) + '%';
      e.querySelector('.cdt').textContent = a.cd > 0 ? Math.ceil(a.cd) : '';
      e.classList.toggle('ready', a.cd <= 0);
    });
    // bølger
    const prog = b.waveProgress();
    const pr = Math.round(prog * 1000);
    if (L.prog !== pr) {
      L.prog = pr;
      $('#wbFill').style.width = (prog * 100) + '%';
      $('#wbHead').style.left = (100 - prog * 100) + '%';
      $$('#wbFlags i').forEach((f) => f.classList.toggle('passed', b.waveIdx > +f.dataset.i));
    }
    // mål
    const o = b.objective;
    let ot = '';
    if (b.endless) ot = 'Bølge ' + b.waveIdx + ' · Zombier besejret: ' + b.stats.kills;
    else if (o && o.type === 'sunGoal') ot = '☀ ' + Math.min(b.stats.sun, o.value) + ' / ' + o.value + ' sol';
    else if (o && o.type === 'timeLimit') ot = '⏱ ' + U.fmtTime(o.value - b.t);
    else if (o && o.type === 'maxPlants') ot = 'Planter: ' + b.allPlants().length + ' / ' + o.value;
    else if (o && o.type === 'line') ot = 'Hold blomsterlinjen!';
    else if (o && o.type === 'protect') ot = '♥ Beskyt de truede planter';
    else if (b.level.rule === 'noLoss') ot = 'Mist ingen planter! (' + b.stats.lost + ')';
    if (L.ot !== ot) { L.ot = ot; const ob = $('#objBox'); ob.textContent = ot; ob.classList.toggle('show', !!ot); }
  }
  function syncBelt(b) {
    const bank = $('#bank');
    const seen = new Set();
    b.belt.forEach((it, i) => {
      seen.add(it.uid);
      let e = B.beltEls[it.uid];
      if (!e) {
        e = plantCard(it.id, PR.owns(it.id) ? PR.plantLv(it.id) : 1);
        e.querySelector('.cost').textContent = 'Gratis';
        e.style.left = '670px';
        e.addEventListener('pointerdown', (ev) => { ev.preventDefault(); AU.unlock(); beltDown(it.uid, ev); });
        bank.appendChild(e);
        B.beltEls[it.uid] = e;
        void e.offsetWidth;
      }
      const x = 6 + i * 74;
      if (e._x !== x) { e.style.left = x + 'px'; e._x = x; }
      e.classList.toggle('sel', b.selected === 'belt:' + it.uid);
    });
    for (const uid in B.beltEls) if (!seen.has(+uid)) { B.beltEls[uid].remove(); delete B.beltEls[uid]; }
  }
  function bindBattleInput() {
    const cv = $('#battleCanvas');
    cv.addEventListener('pointerdown', (e) => {
      const b = B.battle; if (!b || B.paused) return;
      AU.unlock();
      const p = toLogical(e.clientX, e.clientY);
      b.hover = p;
      b.tap(p.x, p.y);
    });
    cv.addEventListener('pointermove', (e) => { const b = B.battle; if (b) b.hover = toLogical(e.clientX, e.clientY); });
    cv.addEventListener('pointerleave', () => { const b = B.battle; if (b && !B.drag) b.hover = null; });
    window.addEventListener('pointermove', (e) => {
      if (!B.drag || !B.battle) return;
      if (Math.abs(e.clientX - B.drag.sx) + Math.abs(e.clientY - B.drag.sy) > 12) B.drag.moved = true;
      if (B.drag.moved) B.battle.hover = toLogical(e.clientX, e.clientY);
    });
    window.addEventListener('pointerup', (e) => {
      const d = B.drag; B.drag = null;
      const b = B.battle;
      if (!d || !b || !d.moved) return;
      const p = toLogical(e.clientX, e.clientY);
      if (b.cellAt(p.x, p.y)) b.tap(p.x, p.y);
    });
    $('#btnShovel').onclick = () => { const b = B.battle; if (!b) return; b.selected = b.selected === 'shovel' ? null : 'shovel'; AU.play('click'); };
    $('#btnPower').onclick = () => {
      const b = B.battle; if (!b) return;
      if (b.leaves <= 0) { b.deny('Saml Plant Power-blade fra glødende zombier'); return; }
      b.selected = b.selected === 'power' ? null : 'power'; AU.play('leaf');
    };
    $('#btnPause').onclick = () => pauseMenu();
    $('#btnSpeed').onclick = () => { B.speed = B.speed === 1 ? 2 : 1; $('#btnSpeed').textContent = B.speed + '×'; AU.play('click'); };
    window.addEventListener('keydown', (e) => {
      AU.unlock();
      if (current !== 'battle' || !B.battle) { if (e.key === 'Escape' && $('#modalBack').classList.contains('show')) closeModal(); else if (e.key === 'Escape' && current !== 'menu' && current !== 'battle') back(); return; }
      const b = B.battle;
      if (e.key === 'Escape') { if (B.paused) resume(); else pauseMenu(); return; }
      if (B.paused) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) { if (b.conveyor) { const it = b.belt[n - 1]; if (it) b.selected = 'belt:' + it.uid; } else if (b.cards[n - 1]) cardDown(n - 1, { clientX: 0, clientY: 0 }), B.drag = null; }
      if (e.key === 's' || e.key === 'S') b.selected = b.selected === 'shovel' ? null : 'shovel';
      if (e.key === 'q' || e.key === 'Q') $('#btnPower').onclick();
      if (e.key === 'f' || e.key === 'F') $('#btnSpeed').onclick();
      if (e.key === ' ') { e.preventDefault(); b.collectAll(); }
    });
    window.addEventListener('resize', () => { if (current === 'battle') fitStage(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'battle' && B.battle && !B.paused && !B.ended) pauseMenu(); });
  }
  function pauseMenu() {
    if (!B.battle || B.ended) return;
    B.paused = true;
    AU.play('click');
    const s = S().settings;
    const m = modal('<h2>Pause</h2><p>' + esc(levelLabel(B.battle.level)) + '</p><div class="menu-list">' +
      '<button class="btn big" data-a="resume">Fortsæt</button>' +
      '<button class="btn orange" data-a="restart">Genstart banen</button>' +
      '<button class="btn blue" data-a="sound">' + (s.mute ? '🔇 Lyd: fra' : '🔊 Lyd: til') + '</button>' +
      '<button class="btn blue" data-a="quality">Grafik: ' + (s.quality === 'low' ? 'Lav' : 'Høj') + '</button>' +
      '<button class="btn red" data-a="quit">Forlad banen</button></div>', { dismiss: false });
    m.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a;
      if (act === 'resume') resume();
      if (act === 'restart') confirmBox('Genstart?', 'Vil du starte banen forfra?', () => { const lvl = ui.level; startBattle(lvl.mode === 'challenge' || lvl.dailyKey || lvl.special || lvl.treasure ? lvl : lvl, ui.loadout); }, 'Genstart');
      if (act === 'sound') { s.mute = !s.mute; AU.configure({ mute: s.mute }); PR.save(); pauseMenu(); }
      if (act === 'quality') { s.quality = s.quality === 'low' ? 'high' : 'low'; B.battle.low = s.quality === 'low'; PR.save(); pauseMenu(); }
      if (act === 'quit') confirmBox('Forlad banen?', 'Dit fremskridt på denne bane går tabt.', () => { quitBattle(); }, 'Forlad');
    };
  }
  function resume() { closeModal(); B.paused = false; B.last = performance.now(); AU.play('click'); }
  function quitBattle() {
    cancelAnimationFrame(B.raf);
    B.battle = null; B.paused = false;
    fadeTo(() => { const lvl = ui.level; history.length = 0; if (lvl && lvl.mode === 'adventure') { history.push('menu', 'worlds'); show('levels', false); } else show(lvl && lvl.mode === 'endless' ? 'endless' : lvl && lvl.mode === 'challenge' ? 'challenges' : 'menu', false); });
  }

  /* ---------------- Resultater ---------------- */
  function onBattleEnd(lvl, res) {
    B.ended = true;
    setTip(null);
    const sum = PR.finishLevel(lvl, res);
    setTimeout(() => showResults(lvl, res, sum), res.won ? 500 : 200);
  }
  function showResults(lvl, res, sum) {
    let h = '';
    const isEndless = lvl.mode === 'endless';
    if (isEndless) {
      h += '<h2 class="win">Du overlevede ' + res.waves + ' bølger!</h2>' + (sum.newRecord ? '<p style="color:#c48a0c">🏆 NY REKORD!</p>' : '<p>Rekord: ' + S().endless.bestWave + ' bølger</p>') + '<p>Zombier besejret: ' + res.kills + ' · Score: ' + U.fmt(res.score) + '</p>';
      AU.play(sum.newRecord ? 'win' : 'lose');
    } else if (res.won) {
      h += '<h2 class="win">' + (lvl.boss ? 'BOSSEN ER BESEJRET!' : 'SEJR!') + '</h2>';
      if (lvl.mode === 'adventure') {
        const s = res.stars;
        h += '<div class="bigstars">' + [0, 1, 2].map((i) => '<i data-star="' + i + '" class=""></i>').join('') + '</div>';
        h += '<div class="starlist">' + [['Vind banen', s[0]], ['Ingen kværnere brugt', s[1]], [lvl.star3 ? lvl.star3.text : '-', s[2]]].map((x) => '<div><i class="' + (x[1] ? 'on' : '') + '"></i>' + esc(x[0]) + '</div>').join('') + '</div>';
      }
    } else {
      h += '<h2 class="lose">Zombierne vandt!</h2><p>' + esc(res.reason || '') + '</p><p style="font-size:14px;color:#7a6248">💡 ' + esc(U.pick(LOSE_TIPS)) + '</p>';
    }
    h += '<div class="rewards">';
    let delay = 0.2;
    const rw = (inner) => { const s = '<div class="rw" style="animation-delay:' + delay.toFixed(2) + 's">' + inner + '</div>'; delay += 0.15; return s; };
    if (sum.coins) h += rw(ico('coin') + '+' + U.fmt(sum.coins));
    if (sum.xp) h += rw(ico('xp') + '+' + sum.xp + ' XP');
    if (sum.gems) h += rw(ico('gem') + '+' + sum.gems);
    for (const sd of sum.seeds) h += rw('<img src="' + P.iconURL(sd.id, 48, PR.plantLv(sd.id)) + '">' + ico('seed') + '+' + sd.n);
    h += '</div>';
    if (sum.newPlant) { const d = P.BY[sum.newPlant]; h += '<div class="unlock-card"><small>NY PLANTE LÅST OP!</small><img src="' + P.iconURL(d.id, 140, 1) + '"><b>' + esc(d.name) + '</b><small>' + esc(d.special) + '</small></div>'; }
    if (sum.levelUps.length) h += '<p style="color:#6a3ac0">⬆ Du er nu Gartner Lv ' + sum.levelUps[sum.levelUps.length - 1] + '! (+2 ' + 'ædelsten, +100 mønter pr. niveau)</p>';
    for (const m of sum.medals) h += '<p style="color:#c48a0c">🏅 Medalje: ' + esc(m.name) + ' (+' + m.gems + ' ædelsten)</p>';
    if (sum.chests.length) h += '<p style="color:#c48a0c">🎁 En stjernekiste er klar på verdenskortet!</p>';
    const ab = PR.ABILITIES.find((a) => a.req[0] === lvl.world && a.req[1] === lvl.idx && lvl.mode === 'adventure' && res.won && sum.first);
    if (ab) h += '<p style="color:#6a3ac0">' + ab.icon + ' Ny evne: <b>' + esc(ab.name) + '</b> - ' + esc(ab.text) + '</p>';
    h += '<div class="row">';
    const nextAvail = lvl.mode === 'adventure' && res.won && !(lvl.world === 9 && lvl.idx === 14);
    if (nextAvail) h += '<button class="btn big" data-a="next">Næste bane ›</button>';
    h += '<button class="btn orange" data-a="retry">' + (res.won ? 'Spil igen' : 'Prøv igen') + '</button>';
    if (!res.won && !isEndless) h += '<button class="btn blue" data-a="loadout">Skift planter</button>';
    h += '<button class="btn gray" style="background:linear-gradient(#f4ead2,#d8c8a0);color:var(--ink);text-shadow:none;cursor:pointer" data-a="map">' + (lvl.mode === 'adventure' ? 'Kort' : 'Menu') + '</button></div>';
    const m = modal(h, { dismiss: false });
    if (res.won && lvl.mode === 'adventure') res.stars.forEach((on, i) => { if (on) setTimeout(() => { const s = m.querySelector('[data-star="' + i + '"]'); if (s) { s.classList.add('on'); AU.play('star'); } }, 500 + i * 380); });
    refreshChips();
    m.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      AU.play('click');
      closeModal();
      cancelAnimationFrame(B.raf);
      B.battle = null;
      if (a.dataset.a === 'next') {
        let wi = lvl.world, li = lvl.idx + 1;
        if (li >= 15) { wi++; li = 0; }
        ui.worldIdx = wi;
        history.length = 0; history.push('menu', 'worlds', 'levels');
        if (sum.newPlant && !ui.loadout.includes(sum.newPlant)) { const nl = S().loadout; if (!nl.includes(sum.newPlant)) nl.unshift(sum.newPlant); }
        fadeTo(() => openLevel(WD.buildLevel(wi, li)));
        current = 'levels';
      } else if (a.dataset.a === 'retry') fadeTo(() => startBattle(lvl, ui.loadout));
      else if (a.dataset.a === 'loadout') { history.length = 0; history.push('menu'); if (lvl.mode === 'adventure') history.push('worlds', 'levels'); current = history[history.length - 1]; fadeTo(() => openLevel(lvl)); }
      else quitBattle();
    };
  }
  const LOSE_TIPS = [
    'Plant flere solplanter tidligt - en stærk økonomi giver flere skydeplanter senere.',
    'Sæt en Barkmur foran dine skydeplanter, så zombierne bliver stoppet længe.',
    'Opgradér dine planter under Planteopgraderinger - det gør en stor forskel.',
    'Brug Plant Power på din stærkeste skydeplante, når en stor bølge kommer.',
    'Tomatbombe og Knoldmine er perfekte mod tunge zombier.',
    'Læs zombiernes svagheder i Leksikonet.',
    'Prøv en anden kombination af planter - nogle baner kræver en ny strategi.',
    'Husk dine evner i venstre side - de kan redde en række i sidste øjeblik.',
  ];

  /* ===================================================================
     Plantesamling og detaljer
     =================================================================== */
  let detailAnim = null;
  function animCanvas(c, drawFn) {
    if (detailAnim) cancelAnimationFrame(detailAnim);
    const ctx = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = 150 * dpr; c.height = 150 * dpr;
    let t = 0, last = performance.now();
    const f = (ts) => {
      if (!c.isConnected) return;
      t += Math.min(0.05, (ts - last) / 1000); last = ts;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 150, 150);
      drawFn(ctx, t);
      detailAnim = requestAnimationFrame(f);
    };
    detailAnim = requestAnimationFrame(f);
  }
  function plantDetailHTML(id, readonly) {
    const d = P.BY[id], owned = PR.owns(id), lv = owned ? PR.plantLv(id) : 1;
    if (!owned) {
      const u = WD.PLANT_UNLOCK[id];
      return '<div class="detail-head"><canvas></canvas><div><h3>???</h3><span class="cat">' + P.CATS[d.cat] + '</span></div></div><p class="desc">Denne plante er endnu ikke låst op.</p>' + (u ? '<div class="infobox"><b>Låses op</b>' + esc(WD.WORLDS[u.wi].name) + ', bane ' + (u.li + 1) + '</div>' : '');
    }
    const s = P.stats(id, lv);
    const stats = [['Solpris', d.cost], ['Liv', d.instant ? '-' : s.hp], ['Genopladning', s.cd + ' s']];
    if (s.dmg) stats.push(['Skade', s.dmg]);
    if (s.rate) stats.push(['Angrebstid', s.rate + ' s']);
    if (s.interval) stats.push(['Produktion', 'hver ' + s.interval + ' s']);
    if (s.range) stats.push(['Rækkevidde', s.range + ' felter']);
    else if (s.dmg && !d.instant) stats.push(['Rækkevidde', 'Hele rækken']);
    if (d.tall) stats.push(['Særligt', 'HØJ']);
    if (d.ground) stats.push(['Særligt', 'Jordplante']);
    let h = '<div class="detail-head"><canvas></canvas><div><h3>' + esc(d.name) + '</h3><span class="cat">' + P.CATS[d.cat] + '</span><div class="lvpips">' + Array.from({ length: P.MAX_LV }, (_, i) => '<i class="' + (i < lv ? 'on' : '') + '"></i>').join('') + '</div><b style="font-family:var(--font-h);font-weight:400">Niveau ' + lv + ' / ' + P.MAX_LV + '</b></div></div>';
    h += '<p class="desc">' + esc(d.desc) + '</p>';
    h += '<div class="stats">' + stats.map((x) => '<div>' + x[0] + '<b>' + x[1] + '</b></div>').join('') + '</div>';
    h += '<div class="infobox"><b>Specialevne</b>' + esc(d.special) + '</div>';
    if (d.pp && d.pp !== '-') h += '<div class="infobox pp"><b>🍃 Plant Power</b>' + esc(d.pp) + '</div>';
    if (d.perks) h += '<div class="infobox"><b>Niveau-evner</b>' + d.perks.map((p, i) => '<div style="opacity:' + (lv >= (i ? 5 : 3) ? 1 : 0.55) + '">' + (lv >= (i ? 5 : 3) ? '✓ ' : '🔒 ') + esc(p) + '</div>').join('') + '</div>';
    const cost = PR.upgradeCost(id);
    if (cost) {
      const sd = PR.seeds(id);
      h += '<div class="infobox"><b>Næste opgradering (Lv ' + (lv + 1) + ')</b>' + esc(P.nextUpgradeText(id, lv)) + '<div class="seedbar"><div style="width:' + Math.min(100, (sd / cost.seeds) * 100) + '%"></div><span>' + sd + ' / ' + cost.seeds + ' frø</span></div></div>';
      if (!readonly) h += '<div class="up-row-btns"><button class="btn' + (PR.canUpgrade(id) ? '' : ' gray') + '" data-up="' + id + '">Opgradér · ' + ico('coin') + U.fmt(cost.coins) + '</button><button class="btn purple small" data-buyseeds="' + id + '">+25 frø · ' + ico('gem') + '6</button></div>';
    } else h += '<div class="infobox"><b>Maks niveau!</b>Denne plante er fuldt opgraderet.</div>';
    return h;
  }
  function mountPlantDetail(box, id, readonly) {
    box.innerHTML = plantDetailHTML(id, readonly);
    const c = box.querySelector('canvas');
    const owned = PR.owns(id), lv = owned ? PR.plantLv(id) : 1;
    const fake = { seed: 1.7, lv, shootT: 9, hp: 1, maxHp: 1, s: P.stats(id, lv), prod: 20, fuse: 99, life: 9, grow: 999, armT: 0, cool: 0 };
    animCanvas(c, (ctx, t) => {
      ctx.save(); ctx.translate(75, 132); ctx.scale(1.15, 1.15);
      A.shadow(ctx, 0, 0, 30, 7, 0.25);
      if (!owned) A.setTint('#1a1530', 0.92);
      fake.shootT += 1 / 60; if (fake.shootT > 1.6) fake.shootT = 0;
      try { P.BY[id].draw(ctx, fake, t); } catch (e) {}
      A.clearTint();
      if (lv >= 3 && owned && P.BY[id].crest) A.star(ctx, P.BY[id].crest[0], P.BY[id].crest[1], lv >= 5 ? 8 : 6, lv >= 5 ? 3.5 : 2.6, 5, t, lv >= 5 ? '#ffd23f' : '#c8ff7a', 1.5);
      ctx.restore();
    });
    box.onclick = (e) => {
      const up = e.target.closest('[data-up]'), buy = e.target.closest('[data-buyseeds]');
      if (up) doUpgrade(up.dataset.up, () => mountPlantDetail(box, id, readonly));
      if (buy) { const got = PR.buy('pack_gem', buy.dataset.buyseeds); if (got) { AU.play('gem'); toast('+25 frø til ' + P.BY[id].name, 'good'); mountPlantDetail(box, id, readonly); refreshChips(); if (current === 'collection') renderCollectionGrid(); } else { AU.play('deny'); toast('Ikke nok ædelsten', 'bad'); } }
    };
  }
  function doUpgrade(id, after) {
    if (!PR.canUpgrade(id)) {
      const c = PR.upgradeCost(id);
      AU.play('deny');
      if (c) toast(PR.seeds(id) < c.seeds ? 'Du mangler ' + (c.seeds - PR.seeds(id)) + ' frø' : 'Du mangler ' + U.fmt(c.coins - S().coins) + ' mønter', 'bad');
      return;
    }
    PR.upgrade(id);
    AU.play('upgrade');
    const lv = PR.plantLv(id), d = P.BY[id];
    const perk = lv === 3 ? d.perks[0] : lv === 5 ? d.perks[1] : null;
    modal('<h2 class="win">Opgraderet!</h2><div class="unlock-card"><img src="' + P.iconURL(id, 140, lv) + '"><b>' + esc(d.name) + ' Lv ' + lv + '</b>' + (perk ? '<small>NY EVNE: ' + esc(perk) + '</small>' : '<small>Stærkere stats og Plant Power</small>') + '</div><div class="row"><button class="btn" data-ok>Super!</button></div>').querySelector('[data-ok]').onclick = () => { AU.play('click'); closeModal(); };
    refreshChips();
    if (after) after();
    if (current === 'collection') renderCollectionGrid();
    if (current === 'upgrades') renderUpgrades();
  }
  function renderCollection() {
    const cats = [['all', 'Alle'], ['resource', 'Ressource'], ['attack', 'Angreb'], ['defense', 'Forsvar'], ['trap', 'Fælde'], ['support', 'Støtte']];
    $('#colFilter').innerHTML = cats.map((c) => '<button class="seg' + (ui.filter === c[0] ? ' on' : '') + '" data-f="' + c[0] + '">' + c[1] + '</button>').join('');
    $$('#colFilter [data-f]').forEach((b) => (b.onclick = () => { AU.play('click'); ui.filter = b.dataset.f; renderCollection(); }));
    renderCollectionGrid();
    mountPlantDetail($('#colDetail'), ui.colSel, false);
  }
  function renderCollectionGrid() {
    const grid = $('#colGrid');
    grid.innerHTML = '';
    for (const d of P.LIST) {
      if (ui.filter !== 'all' && d.cat !== ui.filter) continue;
      const owned = PR.owns(d.id);
      const c = plantCard(d.id, PR.plantLv(d.id), !owned);
      c.insertAdjacentHTML('beforeend', '<span class="nm">' + (owned ? esc(d.name) : '???') + '</span>');
      if (owned && PR.canUpgrade(d.id)) c.insertAdjacentHTML('beforeend', '<span class="up">↑</span>');
      if (ui.colSel === d.id) c.classList.add('sel');
      c.onclick = () => { AU.play('click'); ui.colSel = d.id; renderCollectionGrid(); mountPlantDetail($('#colDetail'), d.id, false); };
      grid.appendChild(c);
    }
  }

  /* ===================================================================
     Opgraderinger + butik
     =================================================================== */
  function renderUpgrades() {
    const list = PR.ownedList().sort((a, b) => (PR.canUpgrade(b) - PR.canUpgrade(a)) || (PR.plantLv(b) - PR.plantLv(a)) || (P.BY[a].order - P.BY[b].order));
    if (!PR.owns(ui.upSel)) ui.upSel = list[0];
    const box = $('#upList');
    box.innerHTML = '';
    for (const id of list) {
      const d = P.BY[id], lv = PR.plantLv(id), c = PR.upgradeCost(id), sd = PR.seeds(id);
      const row = el('div', 'up-row' + (ui.upSel === id ? ' sel' : ''));
      row.innerHTML = '<img src="' + P.iconURL(id, 64, lv) + '"><div><h4>' + esc(d.name) + ' <small style="font-family:var(--font)">Lv ' + lv + (c ? ' → ' + (lv + 1) : ' (MAKS)') + '</small></h4>' +
        (c ? '<div class="seedbar" style="margin:3px 0;height:18px"><div style="width:' + Math.min(100, (sd / c.seeds) * 100) + '%"></div><span style="line-height:14px">' + ico('seed').replace('<i', '<i style="width:12px;height:12px;display:inline-block;vertical-align:-2px"') + ' ' + sd + ' / ' + c.seeds + '</span></div><div class="nexttxt">' + esc(P.nextUpgradeText(id, lv)) + '</div>' : '<div class="meta">Fuldt opgraderet ★</div>') + '</div>' +
        (c ? '<button class="btn small' + (PR.canUpgrade(id) ? '' : ' gray') + '" data-up="' + id + '">' + ico('coin').replace('<i', '<i style="width:16px;height:16px;display:inline-block"') + U.fmt(c.coins) + '</button>' : '');
      row.onclick = (e) => {
        if (e.target.closest('[data-up]')) { doUpgrade(id); return; }
        AU.play('click'); ui.upSel = id; renderUpgrades();
      };
      box.appendChild(row);
    }
    const shop = $('#shop');
    const sel = P.BY[ui.upSel];
    shop.innerHTML = '<h3>🛒 Frøbutik</h3><p style="font-size:13px;margin-bottom:8px">Frø bruges til at opgradere planter. Du får også frø for hver bane, du klarer.</p>' +
      PR.SHOP.map((it) => '<div class="shop-item"><span class="si">' + (it.id === 'pack_small' ? '🌱' : it.id === 'pack_big' ? '🌾' : it.id === 'pack_gem' ? '🎯' : '💰') + '</span><div><b>' + esc(it.name) + '</b>' + esc(it.targeted ? '25 frø til ' + (sel ? sel.name : 'valgt plante') : it.text) + '</div><button class="btn small ' + (it.gems ? 'purple' : 'orange') + '" data-buy="' + it.id + '">' + (it.coins ? ico('coin').replace('<i', '<i style="width:16px;height:16px;display:inline-block"') + U.fmt(it.coins) : ico('gem').replace('<i', '<i style="width:16px;height:16px;display:inline-block"') + it.gems) + '</button></div>').join('');
    shop.onclick = (e) => {
      const b = e.target.closest('[data-buy]'); if (!b) return;
      const got = PR.buy(b.dataset.buy, ui.upSel);
      if (!got) { AU.play('deny'); toast('Du har ikke råd', 'bad'); return; }
      AU.play('gem');
      if (got.length) toast('Frø: ' + got.map((g) => P.BY[g.id].name + ' +' + g.n).join(', '), 'good'); else toast('+1.000 mønter', 'good');
      refreshChips(); renderUpgrades();
    };
  }

  /* ===================================================================
     Leksikon
     =================================================================== */
  function renderAlmanac() {
    const tabs = [['plants', '🌱 Planter'], ['zombies', '🧟 Zombier'], ['bosses', '☠ Bosser'], ['medals', '🏅 Medaljer']];
    $('#almTabs').innerHTML = tabs.map((t) => '<button class="tab' + (ui.almTab === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>').join('');
    $$('#almTabs [data-t]').forEach((b) => (b.onclick = () => { AU.play('click'); ui.almTab = b.dataset.t; ui.almSel = null; renderAlmanac(); }));
    const grid = $('#almGrid'), det = $('#almDetail');
    grid.innerHTML = '';
    grid.className = 'plant-grid big';
    if (ui.almTab === 'plants') {
      for (const d of P.LIST) {
        const owned = PR.owns(d.id);
        const c = plantCard(d.id, PR.plantLv(d.id), !owned);
        c.insertAdjacentHTML('beforeend', '<span class="nm">' + (owned ? esc(d.name) : '???') + '</span>');
        c.onclick = () => { AU.play('click'); ui.almSel = d.id; mountPlantDetail(det, d.id, true); };
        grid.appendChild(c);
      }
      mountPlantDetail(det, ui.almSel || 'kernekanon', true);
    } else if (ui.almTab === 'zombies') {
      for (const d of Z.LIST) {
        const seen = !!S().seenZ[d.id];
        const c = el('button', 'pcard' + (seen ? '' : ' locked'), '<img src="' + Z.iconURL(d.id, 96, !seen) + '"><span class="nm">' + (seen ? esc(d.name) : '???') + '</span>');
        c.onclick = () => { AU.play('click'); ui.almSel = d.id; zombieDetail(det, d.id); };
        grid.appendChild(c);
      }
      zombieDetail(det, ui.almSel || 'shambler');
    } else if (ui.almTab === 'bosses') {
      for (const id in Z.BOSSES) {
        const seen = S().seenBoss[id];
        const c = el('button', 'pcard' + (seen ? '' : ' locked'), '<img src="' + Z.iconURL(id, 96, !seen) + '"><span class="nm">' + (seen ? esc(Z.BOSSES[id].name) : '???') + '</span>');
        c.onclick = () => { AU.play('click'); ui.almSel = id; bossDetail(det, id); };
        grid.appendChild(c);
      }
      bossDetail(det, ui.almSel || 'kompost');
    } else {
      grid.className = 'ch-list';
      grid.style.padding = '0';
      for (const m of PR.MEDALS) {
        const got = !!S().medals[m.id];
        grid.insertAdjacentHTML('beforeend', '<div class="ch-card' + (got ? '' : ' locked') + '"><div class="cb"><h3>' + (got ? '🏅 ' : '🔒 ') + esc(m.name) + '</h3><p>' + esc(m.text) + '</p><div class="rew">' + ico('gem') + m.gems + (got ? ' <span class="done">✓ Opnået</span>' : '') + '</div></div></div>');
      }
      const st = S().stats;
      det.innerHTML = '<h3 style="font-family:var(--font-h);font-weight:400;font-size:26px">Statistik</h3><div class="stats">' + [['Zombier besejret', U.fmt(st.kills)], ['Sol samlet', U.fmt(st.sun)], ['Sejre', st.wins], ['Nederlag', st.losses], ['Bosser besejret', st.bosses], ['Plant Power brugt', st.powers], ['Opgraderinger', st.upgrades], ['Daglige udfordringer', st.dailies], ['Baner klaret', PR.levelsDone() + ' / 150'], ['Stjerner', PR.totalStars() + ' / 450'], ['Medaljer', Object.keys(S().medals).length + ' / ' + PR.MEDALS.length], ['Endless rekord', S().endless.bestWave + ' bølger']].map((x) => '<div>' + x[0] + '<b>' + x[1] + '</b></div>').join('') + '</div>';
    }
  }
  function zombieDetail(box, id) {
    const d = Z.BY[id], seen = !!S().seenZ[id];
    if (!seen) { box.innerHTML = '<div class="detail-head"><canvas></canvas><div><h3>???</h3></div></div><p class="desc">Du har ikke mødt denne zombie endnu. Den registreres her, når du møder den i kamp.</p>'; }
    else {
      const res = Object.entries(d.resist || {}).map(([k, v]) => (RES_NAMES[k] || k) + (v === 0 ? ': immun' : v < 1 ? ': modstand' : ': sårbar')).join(', ');
      const ab = [];
      if (d.armor) ab.push('Rustning');
      if (d.shield) ab.push('Skjold forfra');
      if (d.heavy) ab.push('Tung');
      if (d.ab.fly) ab.push('Flyver');
      if (d.small) ab.push('Lille');
      box.innerHTML = '<div class="detail-head"><canvas></canvas><div><h3>' + esc(d.name) + '</h3><span class="cat">' + (d.w ? esc(WD.WORLDS[d.w - 1].name) : 'Overalt') + '</span></div></div><p class="desc">' + esc(d.desc) + '</p><div class="stats">' +
        [['Liv', d.hp], ['Rustning', d.armor || '-'], ['Skjold', d.shield || '-'], ['Fart', speedName(d.speed)], ['Bid', d.eat ? Math.round(d.eat) + '/s' : 'Knuser'], ['Egenskaber', ab.join(', ') || '-']].map((x) => '<div>' + x[0] + '<b>' + x[1] + '</b></div>').join('') + '</div>' +
        (res ? '<div class="infobox"><b>Modstand</b>' + esc(res) + '</div>' : '') + '<div class="infobox pp"><b>💡 Tip</b>' + esc(d.tip || '') + '</div>';
    }
    const z = { def: d, walk: 0, hp: 1, maxHp: 1, armor: d.armor || 0, armorMax: d.armor || 0, shieldHp: d.shield || 0, shieldMax: d.shield || 0, state: 'walk', seed: 2, flying: !!d.ab.fly };
    animCanvas(box.querySelector('canvas'), (ctx, t) => {
      ctx.save(); ctx.translate(80, 140);
      let sc = 0.85 / ((d.look && d.look.scale) || 1);
      if (d.id === 'giant' || d.id === 'mech') sc *= 0.7;
      if (z.flying) { ctx.translate(0, 50); sc *= 0.8; }
      ctx.scale(sc, sc);
      z.walk = t * 4;
      A.shadow(ctx, 0, 0, 26, 7, 0.25);
      if (!seen) A.setTint('#1a1530', 0.92);
      try { Z.draw(ctx, z, t); } catch (e) {}
      A.clearTint();
      ctx.restore();
    });
  }
  function bossDetail(box, id) {
    const d = Z.BOSSES[id], st = S().seenBoss[id];
    box.innerHTML = '<div class="detail-head"><canvas></canvas><div><h3>' + (st ? esc(d.name) : '???') + '</h3><span class="cat">' + (st === 2 ? '✓ Besejret' : st ? 'Mødt' : 'Ukendt') + '</span></div></div>' +
      (st ? '<p class="desc">' + esc(d.desc) + '</p><div class="stats"><div>Liv<b>' + U.fmt(d.hp) + '</b></div><div>Svaghed<b>' + WEAK_NAMES[d.weak] + '</b></div></div><div class="infobox"><b>Angreb</b>' + d.attacks.map((a) => esc(ATK_NAMES[a] || a)).join(' · ') + (d.shieldPhase ? ' · Energiskjold i nye faser' : '') + '</div><div class="infobox pp"><b>💡 Taktik</b>' + esc(d.weakText) + ' Store eksplosioner tæt på bossen lammer den et øjeblik.</div>' : '<p class="desc">Du har ikke mødt denne boss endnu.</p>');
    const b = { def: d, phase: 0, atkAnim: 0, beamCharge: 0, walk: 0, hp: 1, maxHp: 1 };
    animCanvas(box.querySelector('canvas'), (ctx, t) => {
      ctx.save(); ctx.translate(80, 145); ctx.scale(0.36, 0.36);
      if (!st) A.setTint('#1a1530', 0.92);
      try { d.draw(ctx, b, t); } catch (e) {}
      A.clearTint();
      ctx.restore();
    });
  }

  /* ===================================================================
     Udfordringer
     =================================================================== */
  function renderChallenges() {
    const tabs = [['daily', '📅 Daglige'], ['special', '★ Special'], ['treasure', '💰 Skattejagt']];
    $('#chTabs').innerHTML = tabs.map((t) => '<button class="tab' + (ui.chTab === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>').join('');
    $$('#chTabs [data-t]').forEach((b) => (b.onclick = () => { AU.play('click'); ui.chTab = b.dataset.t; renderChallenges(); }));
    const box = $('#chList');
    box.innerHTML = '';
    const today = U.dayKey();
    const card = (wi, title, text, rew, status, btn, locked, onPlay) => {
      const c = el('div', 'ch-card' + (locked ? ' locked' : ''));
      c.appendChild(worldThumb(wi, 360, 135));
      c.insertAdjacentHTML('beforeend', '<div class="cb"><h3>' + esc(title) + '</h3><p>' + text + '</p><div class="rew">' + rew + '</div>' + (status ? '<div class="done">' + status + '</div>' : '') + (btn ? '<button class="btn' + (locked ? ' gray' : '') + '">' + btn + '</button>' : '') + '</div>');
      const b = c.querySelector('.btn');
      if (b) b.onclick = () => { if (locked) { AU.play('deny'); return; } AU.play('select'); onPlay(); };
      box.appendChild(c);
    };
    if (ui.chTab === 'daily') {
      const ds = WD.daily(today);
      box.insertAdjacentHTML('beforeend', '<p style="color:#fff;grid-column:1/-1;font-size:15px">Nye udfordringer hver dag kl. 00:00. Dagens udfordringer er ens for alle spillere på samme dag.</p>');
      ds.forEach((lvl) => {
        const done = !!S().daily[lvl.dailyKey];
        card(lvl.world, lvl.name + ' · ' + WD.WORLDS[lvl.world].name, esc(lvl.objective.text), ico('coin') + lvl.reward.coins + ' ' + ico('gem') + lvl.reward.gems + ' ' + ico('xp') + lvl.reward.xp, done ? '✓ Klaret i dag (genspil giver mindre)' : '', done ? 'Spil igen' : 'Spil', false, () => openLevel(lvl));
      });
    } else if (ui.chTab === 'special') {
      for (const sp of WD.SPECIALS) {
        const unl = !!(PR.levelState(sp.req[0], sp.req[1]) && PR.levelState(sp.req[0], sp.req[1]).done);
        const done = !!S().specials[sp.id];
        card(sp.wi, sp.name, esc(sp.text) + (unl ? '' : '<br><i>🔒 Kræver: ' + esc(WD.WORLDS[sp.req[0]].name) + ' bane ' + (sp.req[1] + 1) + '</i>'), ico('gem') + sp.gems + ' (første gang) ' + ico('coin') + '400', done ? '✓ Gennemført' : '', unl ? 'Spil' : 'Låst', !unl, () => openLevel(WD.buildSpecial(sp)));
      }
    } else {
      for (const tr of WD.TREASURES) {
        const unl = !!(PR.levelState(tr.req[0], tr.req[1]) && PR.levelState(tr.req[0], tr.req[1]).done);
        const usedToday = S().treasure[tr.id] === today;
        card(tr.wi, tr.name, esc(tr.text) + (unl ? '' : '<br><i>🔒 Kræver: ' + esc(WD.WORLDS[tr.req[0]].name) + ' bane ' + (tr.req[1] + 1) + '</i>'), ico('coin') + '500+ ' + ico('seed') + ' frø ' + ico('gem') + '3', usedToday ? '✓ Plyndret i dag - kom igen i morgen' : '', !unl ? 'Låst' : usedToday ? 'I morgen' : 'Jagt skatten', !unl || usedToday, () => openLevel(WD.buildTreasure(tr)));
      }
    }
  }

  /* ===================================================================
     Endless
     =================================================================== */
  function renderEndless() {
    const s = S().endless;
    const box = $('#endlessBox');
    box.innerHTML = '<div class="rec"><div>Bedste bølge<b>' + s.bestWave + '</b></div><div>Bedste score<b>' + U.fmt(s.bestScore) + '</b></div><div>Forsøg<b>' + s.runs + '</b></div></div><p>Bølgerne bliver hårdere og hårdere - og zombier fra alle de verdener, du har låst op, dukker op. Hver 5. bølge er en stor bølge. Hvor længe kan du holde?</p><h3 style="color:#fff;font-family:var(--font-h);font-weight:400;font-size:22px">Vælg bane</h3><div class="themes" id="themes"></div><button class="btn big" id="btnEndless">Start Endless</button>';
    const th = $('#themes');
    WD.WORLDS.forEach((w, wi) => {
      const unl = PR.worldUnlocked(wi);
      const c = el('button', 'theme' + (ui.endlessTheme === wi ? ' on' : '') + (unl ? '' : ' locked'));
      c.appendChild(worldThumb(wi, 240, 120));
      c.insertAdjacentHTML('beforeend', esc(w.name));
      c.onclick = () => { if (!unl) { AU.play('deny'); return; } AU.play('click'); ui.endlessTheme = wi; renderEndless(); };
      th.appendChild(c);
    });
    $('#btnEndless').onclick = () => { AU.play('select'); openLevel(WD.buildEndless(ui.endlessTheme)); };
  }

  /* ===================================================================
     Indstillinger
     =================================================================== */
  function renderSettings() {
    const s = S().settings;
    const tog = (k, on) => '<button class="toggle' + (on ? ' on' : '') + '" data-tog="' + k + '"></button>';
    $('#settingsBox').innerHTML =
      '<div class="set-card"><h3>🔊 Lyd</h3>' +
      '<div class="set-row"><span>Musik</span><input type="range" min="0" max="100" value="' + Math.round(s.musicVol * 100) + '" data-vol="musicVol"></div>' +
      '<div class="set-row"><span>Lydeffekter</span><input type="range" min="0" max="100" value="' + Math.round(s.sfxVol * 100) + '" data-vol="sfxVol"></div>' +
      '<div class="set-row"><span>Slå al lyd fra</span>' + tog('mute', s.mute) + '</div></div>' +
      '<div class="set-card"><h3>🎨 Grafik og spil</h3>' +
      '<div class="set-row"><span>Høj grafikkvalitet<small>Slå fra på langsomme enheder (færre partikler og effekter)</small></span>' + tog('quality', s.quality !== 'low') + '</div>' +
      '<div class="set-row"><span>Vis skadetal</span>' + tog('dmgNumbers', s.dmgNumbers) + '</div>' +
      '<div class="set-row"><span>Saml sol automatisk<small>Godt på mobil - sol og mønter samles selv</small></span>' + tog('autoSun', s.autoSun) + '</div></div>' +
      '<div class="set-card"><h3>💾 Gemte data</h3><p style="font-size:14px;font-weight:700">Dit fremskridt gemmes automatisk i browseren.</p>' +
      '<div class="set-row"><span>Eksportér / importér<small>Flyt dit spil til en anden browser</small></span><span><button class="btn small blue" data-act="export">Eksportér</button> <button class="btn small blue" data-act="import">Importér</button></span></div>' +
      '<div class="set-row"><span>Nulstil alt fremskridt<small>Kan ikke fortrydes!</small></span><button class="btn small red" data-act="reset">Nulstil</button></div></div>' +
      '<div class="set-card"><h3>ℹ Om spillet</h3><p style="font-size:14px;font-weight:700">Grejs vs Zombies v1.0 · gemmedata v' + PR.VERSION + '<br>Al grafik, lyd og musik er lavet i koden til GrejsAlley.<br>Tastatur: 1-9 vælg plante · S skovl · Q Plant Power · F hastighed · Mellemrum saml alt · Esc pause</p></div>';
    const box = $('#settingsBox');
    box.oninput = (e) => {
      const v = e.target.dataset.vol; if (!v) return;
      s[v] = e.target.value / 100; AU.configure({ [v]: s[v] }); PR.save();
    };
    box.onchange = () => { AU.play('click'); };
    box.onclick = (e) => {
      const t = e.target.closest('[data-tog]'), a = e.target.closest('[data-act]');
      if (t) {
        const k = t.dataset.tog;
        if (k === 'quality') s.quality = s.quality === 'low' ? 'high' : 'low';
        else s[k] = !s[k];
        if (k === 'mute') AU.configure({ mute: s.mute });
        PR.save(); AU.play('click'); renderSettings();
      }
      if (a && a.dataset.act === 'export') {
        const m = modal('<h2>Eksportér</h2><p>Kopiér koden og gem den et sikkert sted.</p><textarea class="savebox" readonly>' + PR.exportSave() + '</textarea><div class="row"><button class="btn" data-ok>Luk</button></div>');
        m.querySelector('textarea').select();
        m.querySelector('[data-ok]').onclick = closeModal;
      }
      if (a && a.dataset.act === 'import') {
        const m = modal('<h2>Importér</h2><p>Indsæt en eksporteret kode. Dit nuværende fremskridt bliver erstattet!</p><textarea class="savebox"></textarea><div class="row"><button class="btn gray" data-no>Annullér</button><button class="btn orange" data-ok>Importér</button></div>');
        m.querySelector('[data-no]').onclick = closeModal;
        m.querySelector('[data-ok]').onclick = () => { if (PR.importSave(m.querySelector('textarea').value)) { closeModal(); toast('Fremskridt importeret!', 'good'); applySettings(); renderSettings(); refreshChips(); } else toast('Ugyldig kode', 'bad'); };
      }
      if (a && a.dataset.act === 'reset') {
        confirmBox('Nulstil alt?', 'Alle baner, planter, opgraderinger, mønter og rekorder slettes.', () => {
          confirmBox('Er du HELT sikker?', 'Dette kan ikke fortrydes.', () => { PR.reset(); applySettings(); toast('Fremskridt nulstillet', 'good'); history.length = 0; show('menu', false); }, 'Slet alt');
        }, 'Fortsæt');
      }
    };
  }
  function applySettings() { const s = S().settings; AU.configure({ musicVol: s.musicVol, sfxVol: s.sfxVol, mute: s.mute }); }

  const RENDER = {
    menu: renderMenu, worlds: renderWorlds, levels: renderLevels, loadout: renderLoadout,
    collection: renderCollection, upgrades: renderUpgrades, almanac: renderAlmanac, challenges: renderChallenges, endless: renderEndless, settings: renderSettings,
  };

  function init() {
    $$('[data-back]').forEach((b) => (b.onclick = back));
    $('#btnStart').onclick = startFromLoadout;
    bindBattleInput();
    menuBg.init();
    applySettings();
    show('menu', false);
    const unlock = () => { AU.unlock(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // velkomst ved første start
    if (!S().tutorial.welcome) {
      S().tutorial.welcome = true; PR.save();
      const m = modal('<h2 class="win">Velkommen til Grejs vs Zombies!</h2><p>Zombierne marcherer mod Grejs\' hus, og kun haven står i vejen. Plant, saml sol, og forsvar huset gennem 10 verdener og 150 baner!</p><div class="unlock-card"><img src="' + P.iconURL('kernekanon', 140, 1) + '"><b>Kernekanon</b><small>Din første plante</small></div><div class="row"><button class="btn big" data-ok>Lad os plante!</button></div>');
      m.querySelector('[data-ok]').onclick = () => { AU.unlock(); AU.play('select'); closeModal(); };
    }
  }
  return { init, show, toast, get battle() { return B.battle; }, openLevel, startBattle };
})();
