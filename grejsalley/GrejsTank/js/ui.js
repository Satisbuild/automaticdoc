/* =====================================================================
 * GREJS TANKS - ui.js
 * All DOM UI: screen navigation, main menu, world map, level select,
 * tank select, garage (upgrades / unlock / compare), weapons, daily
 * challenges, achievements, collection, settings, battle HUD & input
 * (mouse, keyboard, touch), pause, victory and defeat screens.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const U = GT.U, R = GT.Render;
  const $ = U.$, $$ = U.$$, esc = U.esc;
  const S = () => GT.Save.data;
  /** illustrated weapon icon (canvas-rendered, cached as a data URL) */
  const wico = (w, cls) => `<img class="${cls || 'wimg'}" src="${R.weaponIcon(w)}" alt="" draggable="false">`;
  const snd = (n) => GT.Audio.play(n);

  const TEMPLATE_NAMES = {
    flat: 'Open field', rolling: 'Rolling hills', hill: 'Big hill', mountain: 'Tall mountain', valley: 'Deep valley',
    twin_peaks: 'Twin peaks', cliffs: 'Cliffs', plateaus: 'Mesas', stairs: 'Terraces', canyon: 'Canyon',
    islands: 'Floating islands', bunker: 'Enemy bunker', tunnels: 'Tunnels', fortress: 'Fortress', pits: 'Deep pits'
  };
  const TIPS = [
    'Upgrade HP and Armor in the Garage to survive longer.',
    'Watch the wind indicator - it pushes your shots sideways.',
    'Drill, Piercing and Ghost shells reach enemies hiding in bunkers.',
    'Knock enemies into lava, acid or off floating islands with big blasts.',
    'Your special ability charges every turn - use it often!',
    'Buy new weapons with coins once you reach the required player level.',
    'Shoot supply crates for coins, repairs, ammo and blueprints.',
    'Frozen tanks skip their next turn. Ice bombs buy you time.',
    'Driving to higher ground gives you better shooting angles.',
    'Direct hits are critical and deal +25% damage.',
    'Replaying levels for 3 stars unlocks new worlds and tanks.'
  ];

  const UI = (GT.UI = {
    stack: [],
    current: null,
    params: {},
    gFilter: 'all',
    gSel: null,
    wSel: null,
    colTab: 'tanks',
    pendingLevel: null,
    battle: null,

    /* ================================================================
     * Navigation
     * ================================================================ */
    show(name, params, noPush) {
      if (this.current && !noPush && this.current !== name) this.stack.push({ name: this.current, params: this.params });
      $$('.screen').forEach((s) => s.classList.remove('active'));
      const el = $('#scr-' + name);
      if (!el) return;
      el.classList.add('active');
      this.current = name;
      this.params = params || {};
      this.renderTopbars();
      const fn = this['enter_' + name];
      if (fn) {
        try {
          fn.call(this, this.params);
        } catch (e) {
          console.error('[UI] enter ' + name, e);
        }
      }
      if (name !== 'garage') this._stopGarageAnim();
    },
    go(name, params) {
      snd('click');
      this.show(name, params);
    },
    back() {
      snd('click');
      const prev = this.stack.pop();
      if (prev) this.show(prev.name, prev.params, true);
      else this.show('menu', {}, true);
    },
    home() {
      this.stack = [];
      this.show('menu', {}, true);
    },

    renderTopbars() {
      const d = S();
      const li = GT.Save.levelInfo();
      const ic = (id) => `<svg><use href="#${id}"/></svg>`;
      const html = `<div class="tbp lvl" title="Player level ${li.level}"><span class="lvn">${li.level}</span><div class="xp"><i style="width:${Math.round((li.cur / li.need) * 100)}%"></i></div></div>
        <div class="tbp" title="Coins">${ic('i-coin')}${U.fmt(d.coins)}</div>
        <div class="tbp hide-sm" title="Stars">${ic('i-star-g')}${GT.Save.totalStars()}</div>
        <div class="tbp hide-sm" title="Blueprints">${ic('i-bp')}${d.blueprints}</div>`;
      $$('[data-topbar]').forEach((e) => (e.innerHTML = html));
    },

    toast(icon, title, sub) {
      const t = U.el('div', 'toast', `<span class="ti">${icon}</span><div>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`);
      $('#toasts').appendChild(t);
      setTimeout(() => t.remove(), 4200);
    },

    modal(html, opts) {
      opts = opts || {};
      const m = $('#modal');
      m.className = 'modal' + (opts.wide ? ' wide' : '');
      m.innerHTML = html;
      $('#modal-back').classList.add('open');
      this._modalOpts = opts;
      return m;
    },
    closeModal() {
      $('#modal-back').classList.remove('open');
      const o = this._modalOpts;
      this._modalOpts = null;
      if (o && o.onClose) o.onClose();
    },
    confirm(title, text, ok, cb) {
      const m = this.modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row"><button class="btn gray" data-x>Cancel</button><button class="btn red" data-ok>${esc(ok)}</button></div>`);
      m.querySelector('[data-x]').onclick = () => this.closeModal();
      m.querySelector('[data-ok]').onclick = () => {
        this.closeModal();
        cb();
      };
    },

    /* ================================================================
     * MAIN MENU
     * ================================================================ */
    enter_menu() {
      const nx = GT.Levels.nextCampaign();
      $('#play-sub').textContent = nx ? `World ${nx.w} · ${GT.Worlds.get(nx.w).name} · Level ${nx.l}` : 'Choose a level';
      const ch = GT.Progress.ensureChallenges();
      const claimable = ch.filter((c) => c.done && !c.claimed).length;
      const b = $('#badge-ch');
      b.textContent = claimable || '!';
      b.classList.toggle('on', claimable > 0 || ch.some((c) => !c.done));
      this.drawMenuBg();
      GT.Audio.playMusic(GT.Worlds.MENU_MUSIC);
    },
    drawMenuBg() {
      const cv = $('#menu-bg');
      const r = cv.getBoundingClientRect();
      if (!r.width) return;
      let wid = 1;
      for (let w = GT.Worlds.count; w >= 1; w--) if (GT.Worlds.isUnlocked(w)) { wid = w; break; }
      const world = GT.Worlds.get(wid);
      const W = Math.round(r.width), H = Math.round(r.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      const ctx = cv.getContext('2d');
      const thumb = R.worldThumb(world, cv.width, cv.height);
      ctx.drawImage(thumb, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const tk = GT.Tanks.get(S().selectedTank);
      const gy = world.seaOfClouds ? H * 0.68 : H * 0.74 + 0;
      const sc = Math.max(1.4, Math.min(W, H) / 230);
      R.drawTank(ctx, tk.vis, { x: W * 0.16, y: gy + 6, aim: 35, scale: sc * tk.size, t: 1 });
      const en = GT.Enemies.boss(wid);
      R.drawTank(ctx, Object.assign({}, en.vis, { deco: (en.vis.deco || []).concat(['visor']) }), { x: W * 0.85, y: gy + 6, aim: 150, scale: sc * 1.4, t: 1, facing: -1 });
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(20,12,40,0.35)');
      g.addColorStop(0.5, 'rgba(20,12,40,0.05)');
      g.addColorStop(1, 'rgba(20,12,40,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
    play() {
      snd('click');
      const nx = GT.Levels.nextCampaign() || { w: 1, l: 1 };
      this.show('levels', { w: nx.w });
      this.levelInfo(nx.w, nx.l);
    },

    /* ================================================================
     * WORLD MAP
     * ================================================================ */
    enter_worldmap() {
      const grid = $('#world-grid');
      grid.innerHTML = '';
      GT.Audio.playMusic(GT.Worlds.MENU_MUSIC);
      const per = GT.Levels.PER_WORLD, maxStars = per * 3, count = GT.Worlds.count;
      const cleared = (id) => { let n = 0; for (let l = 1; l <= per; l++) if (S().completed['w' + id + '_l' + l]) n++; return n; };

      // summary: unlocked worlds, bosses, stars, current world and next goal
      let unlockedN = 0, firstLocked = null;
      for (const w of GT.Worlds.list) {
        if (GT.Worlds.isUnlocked(w.id)) unlockedN++;
        else if (!firstLocked) firstLocked = w;
      }
      const nx = GT.Levels.nextCampaign();
      const allDone = nx && nx.w === count && nx.l === per && S().completed['w' + count + '_l' + per];
      const current = nx ? nx.w : firstLocked ? firstLocked.id - 1 : count;
      const goal = allDone ? '🏆 All ' + count + ' worlds conquered!'
        : nx ? `Next: World ${nx.w} · Level ${nx.l} (${esc(GT.Levels.get(nx.w, nx.l).name)})`
        : `Unlock ${esc(firstLocked.name)}: ${esc(GT.Worlds.lockReason(firstLocked.id))}`;
      const sum = U.el('div', 'wm-summary', `
        <div><small>Worlds unlocked</small><b>🗺️ ${unlockedN}/${count}</b></div>
        <div><small>Bosses defeated</small><b>👑 ${Object.keys(S().bosses).length}/${count}</b></div>
        <div><small>Stars</small><b>⭐ ${GT.Save.totalStars()}/${GT.Levels.total() * 3}</b></div>
        <div class="wm-goal"><small>Current world ${current} · ${esc(GT.Worlds.get(current).name)}</small><b>${goal}</b></div>
        <button class="btn yellow wm-jump">Jump to current</button>`);
      grid.appendChild(sum);

      // thumbnails are drawn lazily as cards scroll into view (100 canvases up front stalls the UI)
      const thumbs = (this._worldThumbs = this._worldThumbs || {});
      if (this._wmObs) this._wmObs.disconnect();
      const draw = (cv) => {
        if (cv._drawn) return;
        cv._drawn = true;
        const w = GT.Worlds.get(+cv.dataset.w);
        if (!thumbs[w.id]) thumbs[w.id] = R.worldThumb(w, 480, 240);
        cv.getContext('2d').drawImage(thumbs[w.id], 0, 0);
      };
      const obs = (this._wmObs = 'IntersectionObserver' in window
        ? new IntersectionObserver((ents) => {
          for (const e of ents) if (e.isIntersecting) { obs.unobserve(e.target); draw(e.target); }
        }, { root: grid.closest('.scroll'), rootMargin: '400px 0px' })
        : null);

      let currentCard = null;
      for (const w of GT.Worlds.list) {
        const unlocked = GT.Worlds.isUnlocked(w.id);
        const stars = GT.Save.worldStars(w.id);
        const done = cleared(w.id);
        const card = U.el('div', 'world-card' + (unlocked ? '' : ' locked') + (w.id === current ? ' current' : '') + (done === per ? ' cleared' : ''));
        if (w.id === current) currentCard = card;
        const cv = document.createElement('canvas');
        cv.width = 480;
        cv.height = 240;
        cv.dataset.w = w.id;
        cv.style.background = `linear-gradient(${w.sky[0]}, ${w.sky[1]})`;
        card.appendChild(cv);
        if (obs) obs.observe(cv);
        else draw(cv);
        if (S().bosses[w.id]) card.appendChild(U.el('div', 'boss-tag', '👑 Boss defeated'));
        else if (w.id === current && unlocked) card.appendChild(U.el('div', 'boss-tag cur', '▶ Current world'));
        if (w.id === count) card.appendChild(U.el('div', 'final-tag', '🏆 Final world'));
        if (!unlocked) card.appendChild(U.el('div', 'lock', `<b>🔒</b>${esc(GT.Worlds.lockReason(w.id))}`));
        card.appendChild(U.el('div', 'wc-prog', `<i style="width:${(done / per) * 100}%"></i>`));
        card.appendChild(U.el('div', 'wc-info', `<div class="wc-num">${w.id}</div><div class="wc-tx"><h3>${w.icon} ${esc(w.name)}</h3><p>${esc(w.sub)}${w.gravity < 1 ? ' · Low gravity' : ''}</p></div><div class="wc-stars">⭐ ${stars}/${maxStars}<br><small>${done}/${per} levels</small></div>`));
        card.onclick = () => {
          if (!unlocked) {
            snd('error');
            this.toast('🔒', w.name + ' is locked', GT.Worlds.lockReason(w.id));
            return;
          }
          this.go('levels', { w: w.id });
        };
        grid.appendChild(card);
      }
      const jump = (smooth) => currentCard && currentCard.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
      sum.querySelector('.wm-jump').onclick = () => { snd('click'); jump(true); };
      if (current > 2) requestAnimationFrame(() => jump(false));
      // fill in the remaining thumbnails in the background, a few per tick
      const gen = (this._wmGen = (this._wmGen || 0) + 1);
      const queue = Array.from(grid.querySelectorAll('.world-card canvas'));
      const pump = () => {
        if (gen !== this._wmGen) return;
        for (let n = 0; n < 3 && queue.length; n++) draw(queue.shift());
        if (queue.length) setTimeout(pump, 30);
      };
      setTimeout(pump, 300);
    },

    /* ================================================================
     * LEVEL SELECT
     * ================================================================ */
    enter_levels(p) {
      const w = p.w || 1;
      const world = GT.Worlds.get(w);
      const pad = (n) => String(n).padStart(2, '0');
      const ico = (id, cls) => `<svg class="ico${cls ? ' ' + cls : ''}"><use href="#${id}"/></svg>`;
      $('#levels-title').innerHTML = `<small>World ${pad(w)}</small><span>${esc(world.name)}</span>`;
      const bg = R.worldThumb(world, 1280, 720);
      $('#levels-bg').style.backgroundImage = `url(${bg.toDataURL('image/jpeg', 0.8)})`;
      GT.Audio.playMusic(world.music);

      // world summary strip
      const per = GT.Levels.PER_WORLD;
      let cleared = 0;
      for (let l = 1; l <= per; l++) if (S().completed['w' + w + '_l' + l]) cleared++;
      const stars = GT.Save.worldStars(w), maxStars = per * 3;
      const tags = [];
      if (world.gravity < 1) tags.push('Low gravity');
      if (world.hazard) tags.push('Hazard: ' + world.hazard.type);
      if (world.big) tags.push('Large maps');
      if (S().bosses[w]) tags.push('Boss defeated');
      $('#lv-banner').innerHTML = `<div class="lvb-desc"><b>${esc(world.sub)}</b>${tags.length ? `<small>${tags.map((t) => `<span class="lvb-tag">${esc(t)}</span>`).join('')}</small>` : ''}</div>
        <div class="lvb-stat"><div class="n"><svg><use href="#i-star-g"/></svg>${stars}<small>/ ${maxStars}</small></div><div class="lvb-bar"><i style="width:${(stars / maxStars) * 100}%"></i></div><label>Stars earned</label></div>
        <div class="lvb-stat"><div class="n">${ico('i-check', 'ok')}${cleared}<small>/ ${per}</small></div><div class="lvb-bar g"><i style="width:${(cleared / per) * 100}%"></i></div><label>Missions cleared</label></div>`;

      const path = $('#level-path');
      path.innerHTML = '';
      let nextMarked = false;
      for (let l = 1; l <= per; l++) {
        const id = 'w' + w + '_l' + l;
        const lv = GT.Levels.get(w, l);
        const unlocked = GT.Levels.isUnlocked(w, l);
        const done = !!S().completed[id];
        const st = S().stars[id] || 0;
        const node = U.el('div', 'lvl-node' + (lv.isBoss ? ' boss' : '') + (done ? ' done' : '') + (st >= 3 ? ' perfect' : '') + (unlocked ? '' : ' locked'));
        const isNext = unlocked && !done && !nextMarked;
        if (isNext) {
          node.classList.add('next');
          nextMarked = true;
        }
        const starRow = `<div class="ln-stars">${[0, 1, 2].map((i) => `<svg class="${i < st ? 'on' : ''}"><use href="#i-star"/></svg>`).join('')}</div>`;
        const ev = lv.event ? GT.Levels.EVENTS[lv.event] : null;
        const bty = GT.Progress.bountyFor(id);
        const evChip = (bty ? `<span class="ln-ev bounty" title="Bounty: +${bty.reward} coins today">💰</span>` : '') + (ev ? `<span class="ln-ev" title="${esc(ev.name)}: ${esc(ev.desc)}">${ev.icon}</span>` : '');
        if (lv.isBoss) {
          const b = GT.Enemies.boss(w);
          const cv = document.createElement('canvas');
          cv.width = 240;
          cv.height = 160;
          R.tankPreview(cv, Object.assign({}, b.vis, { deco: (b.vis.deco || []).concat(['visor']) }), { aim: 160, facing: -1, zoom: 0.95, dark: !unlocked });
          node.appendChild(cv);
          node.appendChild(U.el('div', 'bs-tx', `<small>Boss battle${ev ? ' · ' + esc(ev.name) : ''}${bty ? ' · 💰 Bounty +' + bty.reward : ''}</small><b>${esc(b.name)}</b>${starRow}`));
          node.appendChild(U.el('div', 'bs-cta' + (done ? ' won' : ''),
            !unlocked ? `${ico('i-lock')}<span>Clear mission ${pad(l - 1)}</span>`
              : done ? `${ico('i-check')}<span>Defeated</span>`
              : `<span class="ln-play">${ico('i-play', 'fill')}FIGHT</span>`));
        } else {
          const foes = lv.enemies.length;
          node.innerHTML = `<span class="ln-tl" title="${foes} ${foes === 1 ? 'enemy' : 'enemies'}">${unlocked ? `${ico('i-tank')}×${foes}` : ico('i-lock')}</span>${evChip ? `<span class="ln-tr">${evChip}</span>` : ''}
            <span class="ln-no">${pad(l)}</span>${isNext ? `<span class="ln-play">${ico('i-play', 'fill')}PLAY</span>` : starRow}`;
        }
        node.onclick = () => {
          if (!unlocked) {
            snd('error');
            this.toast('🔒', 'Level locked', 'Complete the previous level first');
            return;
          }
          snd('click');
          this.levelInfo(w, l);
        };
        path.appendChild(node);
      }
    },

    levelInfo(w, l) {
      const lv = GT.Levels.get(w, l);
      const world = GT.Worlds.get(w);
      const id = lv.id;
      const st = S().stars[id] || 0;
      const enemies = lv.enemies.map((e) => {
        if (e.type === 'boss') {
          const b = GT.Enemies.boss(w);
          return { name: b.name, vis: b.vis, boss: true };
        }
        const d = GT.Enemies.get(e.type);
        return { name: d.name, vis: d.vis };
      });
      const ev = lv.event ? GT.Levels.EVENTS[lv.event] : null;
      const share = GT.Progress.starShare(lv), left = GT.Progress.coinsLeft(lv), bty = GT.Progress.bountyFor(id);
      const m = this.modal(`
        <h2>${w}-${l} ${esc(lv.name)}</h2>
        <p>${world.icon} ${esc(world.name)} · ${TEMPLATE_NAMES[lv.template] || lv.template}</p>
        <div class="enemy-row" id="li-enemies"></div>
        <div class="info-grid">
          <div><small>Enemies</small>${enemies.length}${lv.isBoss ? ' (Boss)' : ''}</div>
          <div><small>Wind</small>${lv.windMax < 1 ? 'Calm' : 'up to ' + Math.round(lv.windMax)}</div>
          <div><small>Gravity</small>${world.gravity < 1 || lv.event === 'lowgrav' ? 'Low' : 'Normal'}</div>
          <div><small>Coins left</small>${left ? '🪙 ' + left + ' <small>(' + share + ' per new ★)</small>' : '✅ All earned'}</div>
          ${bty ? `<div style="grid-column:1/-1"><small>Bounty today</small>💰 Win this level today for +${bty.reward} coins</div>` : ''}
          ${ev ? `<div style="grid-column:1/-1"><small>Special event</small>${ev.icon} ${ev.name} - ${ev.desc}</div>` : ''}
        </div>
        <div class="star-req">
          <div class="${st >= 1 ? 'got' : ''}">★ Win the battle</div>
          <div>★ Finish with at least 50% HP</div>
          <div>★ Win in ${lv.par} turns or less${S().bestTurns[id] ? ` <small>(best: ${S().bestTurns[id]})</small>` : ''}</div>
          <div style="margin-top:4px;color:var(--yellow)">Best: ${'★'.repeat(st)}${'☆'.repeat(3 - st)}</div>
        </div>
        <div class="row"><button class="btn gray" data-x>Close</button><button class="btn yellow" data-go>Choose Tank ›</button></div>`);
      const row = m.querySelector('#li-enemies');
      for (const e of enemies) {
        const chip = U.el('div', 'enemy-chip');
        const cv = document.createElement('canvas');
        cv.width = 228;
        cv.height = 150;
        R.tankPreview(cv, Object.assign({}, e.vis, { deco: (e.vis.deco || []).concat(['visor']) }), { aim: 150, facing: -1 });
        chip.appendChild(cv);
        chip.appendChild(U.el('span', '', esc(e.name)));
        row.appendChild(chip);
      }
      m.querySelector('[data-x]').onclick = () => this.closeModal();
      m.querySelector('[data-go]').onclick = () => {
        this.closeModal();
        this.pendingLevel = { w, l };
        this.go('tankselect', { w, l });
      };
    },

    /* ================================================================
     * TANK SELECT
     * ================================================================ */
    enter_tankselect(p) {
      const lv = GT.Levels.get(p.w || 1, p.l || 1);
      $('#ts-level').innerHTML = `Next battle: <b>${lv.world}-${lv.index} ${esc(lv.name)}</b>`;
      this.renderTankSelect();
      $('#btn-battle').onclick = () => {
        snd('click');
        this.startBattle(p.w || 1, p.l || 1);
      };
    },
    renderTankSelect() {
      const list = $('#ts-list');
      list.innerHTML = '';
      const owned = GT.Tanks.list.filter((t) => S().unlockedTanks.includes(t.id));
      for (const t of owned) {
        const c = this.tankCard(t, t.id === S().selectedTank);
        c.onclick = () => {
          S().selectedTank = t.id;
          GT.Save.save();
          snd('select');
          this.renderTankSelect();
        };
        list.appendChild(c);
      }
      const t = GT.Tanks.get(S().selectedTank);
      if (this._tsTank !== t) this._tsPick = performance.now();
      this._tsTank = t;
      this._startTsAnim();
      $('#ts-info').innerHTML = this.tankInfoHtml(t, true);
      this.renderLoadout($('#ts-loadout'), true);
    },
    tankCard(t, sel) {
      const st = GT.Progress.tankUnlockState(t);
      const c = U.el('div', 'tank-card' + (sel ? ' sel' : '') + (st.unlocked ? '' : ' locked' + (st.met ? ' can' : '')));
      const cv = document.createElement('canvas');
      cv.width = 240;
      cv.height = 160;
      R.tankPreview(cv, t.vis, { dark: !st.unlocked, zoom: t.size * 0.86, ground: 0.84 });
      c.appendChild(cv);
      c.appendChild(U.el('div', 'tier', '★'.repeat(t.tier)));
      c.appendChild(U.el('div', 'tn', esc(t.name)));
      c.appendChild(U.el('div', 'tt', st.unlocked ? t.className + ' · Lv ' + GT.Save.tankLevel(t.id) : t.className));
      return c;
    },
    tankInfoHtml(t, short) {
      const s = GT.Tanks.stats(t.id);
      const ab = GT.Tanks.ABILITIES[t.ability];
      const w0 = GT.Weapons.get(t.weapons[0]), w1 = GT.Weapons.get(t.weapons[1]);
      return `<div class="g-name"><h2>${esc(t.name)}</h2><span class="chip y">${t.className}</span><span class="chip">Tier ${t.tier}</span><span class="chip b">Lv ${s.level}</span></div>
        ${short ? '' : `<div class="g-desc">${esc(t.desc)}</div>`}
        ${this.statBars(s)}
        <div class="chips" style="margin-top:6px"><span class="chip g">${ab ? ab.icon + ' ' + ab.name : ''}</span><span class="chip">${wico(w0)} ${w0.name} ∞</span><span class="chip">${wico(w1)} ${w1.name}</span></div>`;
    },
    statBars(s, cmp) {
      const MAX = { hp: 3200, armor: 90, damage: 260, power: 160, speed: 360, reload: 9, special: 220 };
      const rows = [['hp', 'HP'], ['armor', 'Armor'], ['damage', 'Damage'], ['power', 'Power'], ['speed', 'Speed'], ['reload', 'Reload'], ['special', 'Special']];
      return `<div class="stats">${rows.map(([k, n]) => {
        const v = s[k];
        const pct = Math.min(100, (v / MAX[k]) * 100);
        let delta = '';
        if (cmp) {
          const d = v - cmp[k];
          if (Math.abs(d) > 0.05) delta = `<span class="cmp ${d > 0 ? 'pos' : 'neg'}">${d > 0 ? '+' : ''}${Math.round(d * 10) / 10}</span>`;
        }
        return `<div class="stat"><div class="sl"><span>${n}</span><b>${k === 'damage' || k === 'special' ? v + '%' : v}${delta}</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
      }).join('')}</div>`;
    },
    renderLoadout(el, editable) {
      el.innerHTML = '';
      const lo = S().loadout;
      for (let i = 0; i < 4; i++) {
        const id = lo[i];
        const w = id ? GT.Weapons.get(id) : null;
        const slot = U.el('div', 'slot' + (w ? ' filled' : ''), w ? `<span class="wi">${wico(w)}</span>${esc(w.name)}` : '<span class="wi">＋</span>Empty');
        slot.onclick = () => this.pickWeapon(i, () => this.renderLoadout(el, editable));
        el.appendChild(slot);
      }
    },
    pickWeapon(slotIdx, done) {
      snd('click');
      const d = S();
      const owned = GT.Weapons.list.filter((w) => d.unlockedWeapons.includes(w.id) && w.id !== 'shell');
      const m = this.modal(`<h2>Choose weapon</h2><p>Slot ${slotIdx + 1}</p><div class="w-grid" id="pw-grid"></div><div class="row"><button class="btn gray" data-x>Close</button><button class="btn red" data-rm>Empty slot</button><button class="btn" data-shop>Weapon shop ›</button></div>`, { wide: true });
      const g = m.querySelector('#pw-grid');
      for (const w of owned) {
        const eq = d.loadout.includes(w.id);
        const c = U.el('div', 'w-card' + (eq ? ' eq' : '') + (d.loadout[slotIdx] === w.id ? ' sel' : ''), `<div class="wi">${wico(w)}</div><div class="wn">${esc(w.name)}</div>`);
        c.onclick = () => {
          const other = d.loadout.indexOf(w.id);
          if (other >= 0) d.loadout[other] = d.loadout[slotIdx];
          d.loadout[slotIdx] = w.id;
          GT.Save.save();
          snd('select');
          this.closeModal();
          done && done();
        };
        g.appendChild(c);
      }
      if (!owned.length) g.innerHTML = '<p>No weapons yet - visit the weapon shop!</p>';
      m.querySelector('[data-x]').onclick = () => this.closeModal();
      m.querySelector('[data-rm]').onclick = () => {
        d.loadout[slotIdx] = null;
        GT.Save.save();
        this.closeModal();
        done && done();
      };
      m.querySelector('[data-shop]').onclick = () => {
        this.closeModal();
        this.go('weapons');
      };
    },

    /* ================================================================
     * GARAGE
     * ================================================================ */
    enter_garage() {
      if (!this.gSel) this.gSel = S().selectedTank;
      const f = $('#g-filters');
      const opts = [['all', 'All'], ['owned', 'Owned'], ['locked', 'Locked'], ['ready', '✨ Ready']];
      f.innerHTML = '';
      for (const [k, n] of opts) {
        const b = U.el('button', this.gFilter === k ? 'on' : '', n);
        b.onclick = () => {
          this.gFilter = k;
          snd('click');
          this.enter_garage();
        };
        f.appendChild(b);
      }
      const cnt = S().unlockedTanks.length;
      f.appendChild(U.el('button', '', `🚜 ${cnt}/${GT.Tanks.list.length}`));
      this.renderGarageList();
      this.renderGarageDetail();
    },
    renderGarageList() {
      const list = $('#g-list');
      list.innerHTML = '';
      for (const t of GT.Tanks.list) {
        const st = GT.Progress.tankUnlockState(t);
        if (this.gFilter === 'owned' && !st.unlocked) continue;
        if (this.gFilter === 'locked' && st.unlocked) continue;
        if (this.gFilter === 'ready' && (st.unlocked || !st.met || st.cost > S().coins)) continue;
        const c = this.tankCard(t, t.id === this.gSel);
        c.onclick = () => {
          this.gSel = t.id;
          snd('select');
          $$('.tank-card', list).forEach((x) => x.classList.remove('sel'));
          c.classList.add('sel');
          this.renderGarageDetail();
        };
        list.appendChild(c);
      }
    },
    renderGarageDetail(cmpId) {
      const t = GT.Tanks.get(this.gSel);
      const st = GT.Progress.tankUnlockState(t);
      const s = GT.Tanks.stats(t.id);
      const ab = GT.Tanks.ABILITIES[t.ability];
      const owned = st.unlocked;
      const d = S();
      const u = GT.Save.upgrades(t.id);
      const xp = d.tankXp[t.id] || 0;
      const lvl = GT.Save.tankLevel(t.id);
      const nextXp = lvl >= 20 ? xp : Math.pow(lvl, 2) * 40;
      const cmp = cmpId ? GT.Tanks.stats(cmpId) : null;
      // ability upgrade level + effective strength (tank's Special stat x ability level)
      const abLvl = GT.Save.abilityLevel(t.ability);
      const abK = (s.special / 100) * GT.Tanks.abilityMult(abLvl);
      const el = $('#g-detail');
      el.innerHTML = `
        <div class="g-hero"><canvas id="g-canvas" width="800" height="450"></canvas></div>
        <div class="g-name"><h2>${esc(t.name)}</h2><span class="chip y">${t.className}</span><span class="chip">${'★'.repeat(t.tier)}</span>${owned ? `<span class="chip b">Lv ${lvl}${lvl < 20 ? ` · ${xp}/${nextXp} XP` : ' MAX'}</span>` : ''}</div>
        <div class="g-desc">${esc(t.desc)}</div>
        ${owned ? '' : `<div class="unlock-box">🔒 ${esc(st.text)}<div class="row" style="margin-top:8px"><button class="btn yellow" id="g-unlock" ${st.met && st.cost <= d.coins ? '' : 'disabled'}>${t.unlock.type === 'blueprints' ? 'UNLOCK - ' + t.unlock.value + ' 📘' : st.cost ? 'UNLOCK - ' + U.fmt(st.cost) + ' 🪙' : 'UNLOCK'}</button></div></div>`}
        <div class="g-actions">
          ${owned ? (d.selectedTank === t.id ? '<button class="btn green" disabled>✔ SELECTED</button>' : '<button class="btn green" id="g-select">SELECT</button>') : ''}
          <button class="btn" id="g-compare">⚖ COMPARE</button>
        </div>
        ${cmp ? `<p style="text-align:center;font-weight:900;color:var(--muted)">Compared with ${esc(GT.Tanks.get(cmpId).name)}</p>` : ''}
        <div class="sec"><h4>Stats</h4>${this.statBars(s, cmp)}</div>
        <div class="sec"><h4>Special Ability</h4><div class="item" style="box-shadow:none;background:rgba(0,0,0,0.2)"><div class="ii">${ab.icon}</div><div class="ib"><b>${ab.name}${abLvl ? ` <span class="chip b">Lv ${abLvl}</span>` : ''}</b><p>${esc(ab.desc)}</p><p><b>Now:</b> ${esc(GT.Tanks.abilityPreview(t.ability, abK))} · Recharge: ${GT.Tanks.abilityCd(t.ability, abLvl)} turns</p></div></div>
          ${owned ? `<div class="upg" id="g-abupg" style="margin-top:8px"></div>` : ''}</div>
        <div class="sec"><h4>Weapons</h4><div class="chips">${t.weapons.map((id, i) => { const w = GT.Weapons.get(id); return `<span class="chip ${i ? 'b' : 'y'}">${wico(w)} ${w.name} ${i ? '(signature)' : '∞'}</span>`; }).join('')}</div></div>
        ${owned ? `<div class="sec"><h4>Upgrades</h4><div class="upg" id="g-upg"></div></div>` : ''}`;
      // hero preview animation
      this._garageTank = t;
      this._startGarageAnim();
      if (owned) {
        // ability upgrade (shared by all tanks with this ability)
        const abBox = $('#g-abupg');
        const abMax = abLvl >= GT.Tanks.ABILITY_MAX;
        const abCost = GT.Tanks.abilityCost(abLvl);
        let next = '';
        if (!abMax) {
          const nk = (s.special / 100) * GT.Tanks.abilityMult(abLvl + 1);
          const ncd = GT.Tanks.abilityCd(t.ability, abLvl + 1);
          next = `Next: ${GT.Tanks.abilityPreview(t.ability, nk)}${ncd < GT.Tanks.abilityCd(t.ability, abLvl) ? ` · Recharge ${ncd} turns` : ''}`;
        }
        abBox.appendChild(U.el('div', 'un', `${ab.icon} Upgrade ability<small>${esc(abMax ? 'Fully upgraded!' : next)}<br>+15% power per level, −1 turn recharge at Lv 3 and 5. Shared by all tanks with ${esc(ab.name)}.</small>`));
        abBox.appendChild(U.el('div', 'pips', Array.from({ length: GT.Tanks.ABILITY_MAX }, (_, i) => `<i class="${i < abLvl ? 'on' : ''}"></i>`).join('')));
        const abBtn = U.el('button', 'btn small ' + (abMax ? 'gray' : 'yellow'), abMax ? 'MAX' : `UPGRADE · ${U.fmt(abCost)} 🪙`);
        abBtn.disabled = abMax || abCost > d.coins;
        abBtn.onclick = () => {
          if (!GT.Save.spend(abCost)) return snd('error');
          d.abilityLevels[t.ability] = abLvl + 1;
          d.stats.upgradesBought++;
          GT.Save.save();
          snd('upgrade');
          this.checkAch();
          this.renderTopbars();
          this.renderGarageDetail(cmpId);
        };
        abBox.appendChild(abBtn);

        const box = $('#g-upg');
        for (const up of GT.Tanks.UPGRADES) {
          const lv = u[up.key];
          const max = lv >= GT.Tanks.MAX_UPG;
          const cost = GT.Tanks.upgradeCost(t, up.key, lv);
          box.appendChild(U.el('div', 'un', `${up.icon} ${up.name}<small>${up.desc}</small>`));
          box.appendChild(U.el('div', 'pips', Array.from({ length: GT.Tanks.MAX_UPG }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')));
          const b = U.el('button', 'btn small ' + (max ? 'gray' : 'yellow'), max ? 'MAX' : `UPGRADE · ${U.fmt(cost)} 🪙`);
          b.disabled = max || cost > d.coins;
          b.onclick = () => {
            if (!GT.Save.spend(cost)) return snd('error');
            u[up.key]++;
            d.stats.upgradesBought++;
            d.stats.maxUpgrade = Math.max(d.stats.maxUpgrade, u[up.key]);
            GT.Save.save();
            snd('upgrade');
            this.checkAch();
            this.renderTopbars();
            this.renderGarageDetail(cmpId);
          };
          box.appendChild(b);
        }
      }
      const sel = $('#g-select');
      if (sel) sel.onclick = () => {
        d.selectedTank = t.id;
        GT.Save.save();
        snd('select');
        this.renderGarageList();
        this.renderGarageDetail(cmpId);
      };
      const un = $('#g-unlock');
      if (un) un.onclick = () => {
        if (GT.Progress.unlockTank(t.id)) {
          snd('unlock');
          this.toast('🚜', 'New tank unlocked!', t.name);
          this.checkAch();
          this.renderTopbars();
          this.renderGarageList();
          this.renderGarageDetail();
        } else snd('error');
      };
      $('#g-compare').onclick = () => this.compareModal(t.id);
    },
    /** animated hero preview on the tank select screen (pops in when a tank is picked) */
    _startTsAnim() {
      if (this._tsRaf) return;
      const loop = (ts) => {
        const cv = document.getElementById('ts-canvas');
        if (!cv || this.current !== 'tankselect') {
          this._tsRaf = 0;
          return;
        }
        const t = this._tsTank;
        const time = ts / 1000;
        const k = Math.min(1, (ts - (this._tsPick || 0)) / 380);
        const pop = 0.82 + 0.18 * (1 - Math.pow(1 - k, 3)) + Math.sin(k * Math.PI) * 0.05;
        R.tankPreview(cv, t.vis, { platform: true, zoom: 0.78 * t.size * pop, aim: 28 + Math.sin(time * 0.7) * 14, t: time, phase: k < 1 ? k * 40 : 40 });
        this._tsRaf = requestAnimationFrame(loop);
      };
      this._tsRaf = requestAnimationFrame(loop);
    },
    _startGarageAnim() {
      if (this._gRaf) return;
      const loop = (ts) => {
        const cv = document.getElementById('g-canvas');
        if (!cv || this.current !== 'garage') {
          this._gRaf = 0;
          return;
        }
        const t = this._garageTank;
        const st = GT.Progress.tankUnlockState(t);
        const time = ts / 1000;
        R.tankPreview(cv, t.vis, { platform: true, zoom: 0.85 * t.size, aim: 30 + Math.sin(time * 0.8) * 25, t: time, phase: time * 20, dark: !st.unlocked });
        this._gRaf = requestAnimationFrame(loop);
      };
      this._gRaf = requestAnimationFrame(loop);
    },
    _stopGarageAnim() {
      if (this._gRaf) cancelAnimationFrame(this._gRaf);
      this._gRaf = 0;
    },
    compareModal(id) {
      snd('click');
      const m = this.modal(`<h2>Compare with...</h2><div class="g-list" id="cmp-list" style="max-height:50vh;overflow:auto"></div><div class="row"><button class="btn gray" data-x>Close</button></div>`, { wide: true });
      const list = m.querySelector('#cmp-list');
      for (const t of GT.Tanks.list) {
        if (t.id === id) continue;
        const c = this.tankCard(t, false);
        c.onclick = () => {
          this.closeModal();
          this.showCompare(id, t.id);
        };
        list.appendChild(c);
      }
      m.querySelector('[data-x]').onclick = () => this.closeModal();
    },
    showCompare(a, b) {
      const A = GT.Tanks.get(a), B = GT.Tanks.get(b);
      const sa = GT.Tanks.stats(a), sb = GT.Tanks.stats(b);
      const rows = [['hp', 'HP'], ['armor', 'Armor'], ['damage', 'Damage %'], ['power', 'Power'], ['speed', 'Speed'], ['reload', 'Reload'], ['radius', 'Blast radius %'], ['stability', 'Stability'], ['special', 'Special %']];
      const m = this.modal(`<h2>⚖ Compare</h2>
        <div style="display:flex;justify-content:space-around"><canvas id="cmpa" width="200" height="130"></canvas><canvas id="cmpb" width="200" height="130"></canvas></div>
        <table class="cmp-table"><tr><th></th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr>
        ${rows.map(([k, n]) => `<tr><td>${n}</td><td class="${sa[k] > sb[k] ? 'best' : ''}">${sa[k]}</td><td class="${sb[k] > sa[k] ? 'best' : ''}">${sb[k]}</td></tr>`).join('')}
        <tr><td>Class</td><td>${A.className}</td><td>${B.className}</td></tr>
        <tr><td>Special</td><td>${GT.Tanks.ABILITIES[A.ability].icon} ${GT.Tanks.ABILITIES[A.ability].name}</td><td>${GT.Tanks.ABILITIES[B.ability].icon} ${GT.Tanks.ABILITIES[B.ability].name}</td></tr>
        <tr><td>Signature</td><td>${GT.Weapons.get(A.weapons[1]).name}</td><td>${GT.Weapons.get(B.weapons[1]).name}</td></tr>
        </table><div class="row"><button class="btn gray" data-x>Close</button><button class="btn" data-v>View ${esc(B.name)}</button></div>`, { wide: true });
      R.tankPreview(m.querySelector('#cmpa'), A.vis, { platform: true, zoom: A.size * 0.9 });
      R.tankPreview(m.querySelector('#cmpb'), B.vis, { platform: true, zoom: B.size * 0.9, dark: !S().unlockedTanks.includes(b) });
      m.querySelector('[data-x]').onclick = () => this.closeModal();
      m.querySelector('[data-v]').onclick = () => {
        this.closeModal();
        this.gSel = b;
        this.renderGarageList();
        this.renderGarageDetail(a);
      };
    },

    /* ================================================================
     * WEAPONS
     * ================================================================ */
    enter_weapons() {
      if (!this.wSel) this.wSel = 'shell';
      this.renderLoadout($('#w-loadout'), true);
      this.renderWeaponList();
      this.renderWeaponDetail();
    },
    renderWeaponList() {
      const list = $('#w-list');
      list.innerHTML = '';
      const d = S();
      const cats = {};
      for (const w of GT.Weapons.list) (cats[w.cat] = cats[w.cat] || []).push(w);
      for (const c in cats) {
        list.appendChild(U.el('h3', 'w-cat', GT.Weapons.CAT_NAMES[c] || c));
        const g = U.el('div', 'w-grid');
        for (const w of cats[c]) {
          const st = GT.Progress.weaponState(w);
          const cls = 'w-card' + (st.unlocked ? '' : st.met ? ' locked buy' : ' locked') + (d.loadout.includes(w.id) ? ' eq' : '') + (this.wSel === w.id ? ' sel' : '');
          const card = U.el('div', cls, `<div class="wi">${wico(w)}</div><div class="wn">${esc(w.name)}</div>${st.unlocked ? '' : `<div class="wn" style="color:var(--muted)">Lv ${w.level}</div>`}`);
          card.onclick = () => {
            this.wSel = w.id;
            snd('select');
            this.renderWeaponList();
            this.renderWeaponDetail();
          };
          g.appendChild(card);
        }
        list.appendChild(g);
      }
    },
    renderWeaponDetail() {
      const w = GT.Weapons.get(this.wSel);
      const d = S();
      const st = GT.Progress.weaponState(w);
      const lvl = GT.Save.weaponLevel(w.id);
      const max = lvl >= GT.Weapons.MAX_LEVEL;
      const cost = GT.Weapons.upgradeCost(w, lvl);
      const eq = d.loadout.includes(w.id);
      const typeText = { ballistic: 'Ballistic', bounce: 'Bouncing', roll: 'Rolling', drill: 'Drilling', pierce: 'Piercing', ghost: 'Phasing', laser: 'Beam', homing: 'Homing', split: 'Splitting', cluster: 'Cluster', marker: 'Marker', rain: 'Rain', mines: 'Mines', dirt: 'Terrain', tunnel: 'Tunneling' }[w.type];
      const el = $('#w-detail');
      const dmgTxt = w.count > 1 ? `${w.count} × ${Math.round(w.dmg * GT.Weapons.levelMult(lvl))}` : w.marker ? `${w.marker.n} × ${w.marker.dmg}` : w.sub && w.type !== 'cluster' ? `${w.sub.n} × ${w.sub.dmg}` : Math.round(w.dmg * GT.Weapons.levelMult(lvl)) + (w.sub ? ` + ${w.sub.n}×${w.sub.dmg}` : '');
      el.innerHTML = `<div class="w-detail-body">
        <div class="w-big">${wico(w, 'wimg big')}</div>
        <div class="g-name"><h2>${esc(w.name)}</h2><span class="chip y">${GT.Weapons.CAT_NAMES[w.cat]}</span><span class="chip">${typeText}</span></div>
        <div class="g-desc">${esc(w.desc || '')}</div>
        <div class="info-grid">
          <div><small>Damage</small>${dmgTxt}</div>
          <div><small>Blast radius</small>${w.type === 'laser' ? 'Beam' : w.r}</div>
          <div><small>Ammo per battle</small>${w.ammo < 0 ? '∞' : GT.Weapons.levelAmmo(w, lvl)}</div>
          <div><small>Level</small>${lvl} / ${GT.Weapons.MAX_LEVEL}</div>
          ${w.burn ? `<div><small>Burn</small>${w.burn.dmg}/turn · ${w.burn.turns} turns</div>` : ''}
          ${w.poison ? `<div><small>Poison</small>${w.poison.dmg}/turn · ${w.poison.turns} turns</div>` : ''}
          ${w.freeze ? `<div><small>Freeze</small>Skip ${w.freeze} turn</div>` : ''}
          ${w.chain ? `<div><small>Chain</small>${w.chain.n} targets × ${w.chain.dmg}</div>` : ''}
        </div>
        ${w.good.length ? `<div class="sec"><h4>Good against</h4><div class="chips">${w.good.map((g) => `<span class="chip g">✔ ${GT.Weapons.GOOD_NAMES[g]}</span>`).join('')}</div></div>` : ''}
        <div class="g-actions" id="w-actions"></div>
      </div>`;
      const act = $('#w-actions');
      if (!st.unlocked) {
        const b = U.el('button', 'btn yellow', st.met ? `BUY · ${U.fmt(w.price)} 🪙` : `🔒 Requires player level ${w.level}`);
        b.disabled = !st.met || d.coins < w.price;
        b.onclick = () => {
          if (GT.Progress.buyWeapon(w.id)) {
            snd('unlock');
            this.toast(wico(w), 'Weapon unlocked!', w.name);
            this.checkAch();
            this.renderTopbars();
            this.enter_weapons();
          } else snd('error');
        };
        act.appendChild(b);
      } else {
        if (w.id !== 'shell') {
          const e = U.el('button', 'btn ' + (eq ? 'gray' : 'green'), eq ? 'UNEQUIP' : 'EQUIP');
          e.onclick = () => {
            const i = d.loadout.indexOf(w.id);
            if (i >= 0) d.loadout[i] = null;
            else {
              const free = d.loadout.indexOf(null);
              if (free < 0) {
                snd('error');
                this.toast('⚠️', 'Loadout is full', 'Tap a slot above to replace a weapon');
                return;
              }
              d.loadout[free] = w.id;
            }
            GT.Save.save();
            snd('select');
            this.enter_weapons();
          };
          act.appendChild(e);
        } else act.appendChild(U.el('div', 'chip y', 'Always equipped as primary'));
        const up = U.el('button', 'btn yellow', max ? 'MAX LEVEL' : `UPGRADE · ${U.fmt(cost)} 🪙`);
        up.disabled = max || d.coins < cost;
        up.title = '+8% damage per level, +1 ammo at level 3 and 5';
        up.onclick = () => {
          if (!GT.Save.spend(cost)) return snd('error');
          d.weaponLevels[w.id] = lvl + 1;
          d.stats.upgradesBought++;
          GT.Save.save();
          snd('upgrade');
          this.checkAch();
          this.renderTopbars();
          this.renderWeaponDetail();
        };
        act.appendChild(up);
      }
    },

    /* ================================================================
     * ACHIEVEMENTS / CHALLENGES / COLLECTION / SETTINGS
     * ================================================================ */
    enter_achievements() {
      const list = $('#ach-list');
      const d = S();
      const done = GT.Progress.achCount();
      list.innerHTML = `<div class="summary"><div class="pill">🏆 ${done} / ${GT.Progress.ACH.length} unlocked</div></div>`;
      const sorted = GT.Progress.ACH.slice().sort((a, b) => (d.achievements[b.id] ? 0 : 1) - (d.achievements[a.id] ? 0 : 1));
      for (const a of sorted) {
        const ok = d.achievements[a.id] && d.achievements[a.id].done;
        let v = 0;
        try { v = a.value(d); } catch (e) { v = 0; }
        const tg = GT.Progress.achTarget(a);
        const pct = Math.min(100, (v / tg) * 100);
        list.appendChild(U.el('div', 'item' + (ok ? ' done' : ' locked'), `<div class="ii">${a.icon}</div><div class="ib"><b>${esc(a.name)}</b><p>${esc(a.desc)}</p>${ok ? '' : `<div class="bar"><i style="width:${pct}%"></i></div>`}</div><div class="ir">${ok ? '✅ Done' : U.fmt(Math.min(v, tg)) + ' / ' + U.fmt(tg)}<br><small>🪙 ${U.fmt(a.reward)}</small></div>`));
      }
    },
    enter_challenges() {
      const list = $('#ch-list');
      const chs = GT.Progress.ensureChallenges();
      const now = new Date();
      const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const h = Math.floor((mid - now) / 3600000), mm = Math.floor(((mid - now) % 3600000) / 60000);
      list.innerHTML = `<div class="summary"><div class="pill">📅 New challenges in ${h}h ${mm}m</div><div class="pill">✅ Completed: ${S().challenges.completedTotal}</div></div>`;
      chs.forEach((c) => {
        const tg = GT.Progress.challengeTarget(c);
        const it = U.el('div', 'item' + (c.claimed ? ' done' : ''), `<div class="ii">${c.claimed ? '✅' : c.done ? '🎁' : '🎯'}</div><div class="ib"><b>${esc(GT.Progress.challengeText(c))}</b><p>Reward: 🪙 ${c.reward}${c.bp ? ' + 📘 ' + c.bp : ''}</p><div class="bar"><i class="up" style="width:${Math.min(100, (c.progress / tg) * 100)}%"></i></div></div><div class="ir"></div>`);
        const ir = it.querySelector('.ir');
        if (c.claimed) ir.textContent = 'Claimed';
        else if (c.done) {
          const b = U.el('button', 'btn yellow small', 'CLAIM');
          b.onclick = () => {
            if (GT.Progress.claimChallenge(c)) {
              snd('coin');
              this.toast('🎁', 'Challenge complete!', '+' + c.reward + ' coins');
              this.checkAch();
              GT.Progress.autoUnlockTanks().forEach((t) => this.toast('🚜', 'New tank unlocked!', t.name));
              GT.Save.save();
              this.renderTopbars();
              this.enter_challenges();
            }
          };
          ir.appendChild(b);
        } else ir.textContent = U.fmt(c.progress) + ' / ' + U.fmt(tg);
        list.appendChild(it);
      });
      // daily bounties: replay cleared levels for coins, even 3-star ones
      const bounties = GT.Progress.ensureBounties();
      list.appendChild(U.el('h3', '', '💰 Daily Bounties'));
      list.lastChild.style.cssText = 'margin:18px 0 6px';
      if (!bounties.length) list.appendChild(U.el('p', '', 'Clear your first level to unlock bounties.'));
      bounties.forEach((b) => {
        const lv = GT.Levels.get(b.w, b.l);
        const it = U.el('div', 'item' + (b.claimed ? ' done' : ''), `<div class="ii">${b.claimed ? '✅' : '💰'}</div><div class="ib"><b>Win ${b.w}-${b.l} ${esc(lv.name)}</b><p>Bounty: 🪙 ${U.fmt(b.reward)} · pays even if you already have ⭐⭐⭐</p></div><div class="ir"></div>`);
        const ir = it.querySelector('.ir');
        if (b.claimed) ir.textContent = 'Collected';
        else {
          const btn = U.el('button', 'btn yellow small', 'PLAY');
          btn.onclick = () => {
            snd('click');
            this.levelInfo(b.w, b.l);
          };
          ir.appendChild(btn);
        }
        list.appendChild(it);
      });
      list.appendChild(U.el('p', '', '<br>Each level only pays coins for new stars - once it has ⭐⭐⭐ it pays nothing more. Bounties and challenges are the way to keep earning. New ones every day.'));
      list.lastChild.style.cssText = 'color:var(--muted);font-weight:800;text-align:center;font-size:0.85em';
      list.appendChild(U.el('p', '', '<br>Challenges are generated locally every day. Completing them unlocks special tanks like Rusty Bucket, Patchwork Medic and Chaos Engine.'));
      list.lastChild.style.cssText = 'color:var(--muted);font-weight:800;text-align:center;font-size:0.85em';
    },
    enter_collection() {
      const tabs = $('#col-tabs');
      const T = [['tanks', '🚜 Tanks'], ['weapons', '🚀 Weapons'], ['abilities', '⭐ Abilities'], ['enemies', '👾 Enemies'], ['bosses', '👑 Bosses'], ['stats', '📊 Stats']];
      tabs.innerHTML = '';
      for (const [k, n] of T) {
        const b = U.el('button', this.colTab === k ? 'on' : '', n);
        b.onclick = () => {
          this.colTab = k;
          snd('click');
          this.enter_collection();
        };
        tabs.appendChild(b);
      }
      const body = $('#col-body');
      body.innerHTML = '';
      const d = S();
      if (this.colTab === 'tanks') {
        body.appendChild(U.el('div', 'summary', `<div class="pill">🚜 ${d.unlockedTanks.length} / ${GT.Tanks.list.length} tanks</div>`));
        const g = U.el('div', 'g-list');
        for (const t of GT.Tanks.list) {
          const c = this.tankCard(t, false);
          c.onclick = () => {
            this.gSel = t.id;
            this.go('garage');
          };
          g.appendChild(c);
        }
        body.appendChild(g);
      } else if (this.colTab === 'weapons') {
        body.appendChild(U.el('div', 'summary', `<div class="pill">🚀 ${d.unlockedWeapons.length} / ${GT.Weapons.list.length} weapons</div>`));
        for (const w of GT.Weapons.list) {
          const own = d.unlockedWeapons.includes(w.id);
          body.appendChild(U.el('div', 'item' + (own ? '' : ' locked'), `<div class="ii">${wico(w)}</div><div class="ib"><b>${esc(w.name)}</b><p>${esc(w.desc)}</p></div><div class="ir">${own ? 'Lv ' + GT.Save.weaponLevel(w.id) : '🔒 Lv ' + w.level}</div>`));
        }
      } else if (this.colTab === 'abilities') {
        for (const k in GT.Tanks.ABILITIES) {
          const a = GT.Tanks.ABILITIES[k];
          const users = GT.Tanks.list.filter((t) => t.ability === k);
          const own = users.some((t) => d.unlockedTanks.includes(t.id));
          body.appendChild(U.el('div', 'item' + (own ? '' : ' locked'), `<div class="ii">${a.icon}</div><div class="ib"><b>${esc(a.name)}</b><p>${esc(a.desc)} · Recharge ${a.cd} turns</p><p>${users.map((t) => esc(t.name)).join(', ')}</p></div>`));
        }
      } else if (this.colTab === 'enemies') {
        const g = U.el('div', 'g-list');
        for (const k in GT.Enemies.types) {
          const e = GT.Enemies.types[k];
          const seen = d.seenEnemies[k];
          const c = U.el('div', 'tank-card' + (seen ? '' : ' locked'));
          const cv = document.createElement('canvas');
          cv.width = 240;
          cv.height = 160;
          R.tankPreview(cv, Object.assign({}, e.vis, { deco: (e.vis.deco || []).concat(['visor']) }), { dark: !seen, aim: 150, facing: -1, zoom: e.vis.size || 1 });
          c.appendChild(cv);
          c.appendChild(U.el('div', 'tn', seen ? esc(e.name) : '???'));
          c.appendChild(U.el('div', 'tt', seen ? `HP ${e.hp} · ${e.w.map((w) => wico(GT.Weapons.get(w), 'wimg sm')).join('')}` : 'Not encountered'));
          g.appendChild(c);
        }
        body.appendChild(g);
      } else if (this.colTab === 'bosses') {
        for (const b of GT.Enemies.bosses) {
          const beat = d.bosses[b.world];
          const it = U.el('div', 'item' + (beat ? ' done' : ''));
          const cv = document.createElement('canvas');
          cv.width = 240;
          cv.height = 160;
          cv.style.width = '90px';
          R.tankPreview(cv, Object.assign({}, b.vis, { deco: (b.vis.deco || []).concat(['visor']) }), { dark: !beat && !d.seenEnemies[b.id], aim: 150, facing: -1 });
          it.appendChild(cv);
          it.appendChild(U.el('div', 'ib', `<b>${esc(b.name)}</b><p>World ${b.world}: ${esc(GT.Worlds.get(b.world).name)} · ${b.phases.length} phases · HP ${U.fmt(b.hp)}</p>`));
          it.appendChild(U.el('div', 'ir', beat ? '👑 Defeated' : '—'));
          body.appendChild(it);
        }
      } else {
        const st = d.stats;
        const rows = [['Battles', st.battles], ['Victories', st.wins], ['Defeats', st.losses], ['Tanks destroyed', st.kills], ['Damage dealt', st.damage], ['Shots fired', st.shots], ['Critical hits', st.crits], ['Bosses defeated', st.bossKills], ['Flawless wins', st.perfectWins], ['Multi-kills', st.multiKills], ['Crates collected', st.crates], ['Abilities used', st.abilityUses], ['Upgrades bought', st.upgradesBought], ['Coins earned', st.coinsEarned], ['Levels completed', GT.Save.levelsCompleted() + ' / ' + GT.Levels.total()], ['Stars', GT.Save.totalStars() + ' / ' + GT.Levels.total() * 3], ['Player level', GT.Save.playerLevel()], ['Blueprints', d.blueprints]];
        for (const [n, v] of rows) body.appendChild(U.el('div', 'set-row', `<span>${n}</span><b>${typeof v === 'number' ? U.fmt(v) : v}</b>`));
      }
    },
    enter_settings() {
      const body = $('#settings-body');
      const st = S().settings;
      body.innerHTML = '';
      const toggle = (label, sub, key) => {
        const row = U.el('div', 'set-row', `<div>${label}<small>${sub}</small></div>`);
        const t = U.el('button', 'toggle' + (st[key] ? ' on' : ''));
        t.onclick = () => {
          st[key] = !st[key];
          t.classList.toggle('on', st[key]);
          GT.Save.save();
          GT.Audio.applySettings();
          snd('click');
        };
        row.appendChild(t);
        body.appendChild(row);
      };
      const slider = (label, key) => {
        const row = U.el('div', 'set-row', `<div>${label}</div>`);
        const r = U.el('input');
        r.type = 'range';
        r.min = 0;
        r.max = 1;
        r.step = 0.05;
        r.value = st[key];
        r.oninput = () => {
          st[key] = +r.value;
          GT.Audio.applySettings();
        };
        r.onchange = () => GT.Save.save();
        row.appendChild(r);
        body.appendChild(row);
      };
      const seg = (label, sub, key, opts) => {
        const row = U.el('div', 'set-row', `<div>${label}<small>${sub}</small></div>`);
        const s = U.el('div', 'seg');
        for (const [v, n] of opts) {
          const b = U.el('button', st[key] === v ? 'on' : '', n);
          b.onclick = () => {
            st[key] = v;
            GT.Save.save();
            snd('click');
            $$('button', s).forEach((x) => x.classList.remove('on'));
            b.classList.add('on');
            if (key === 'quality') GT.Particles.setQuality(v);
          };
          s.appendChild(b);
        }
        row.appendChild(s);
        body.appendChild(row);
      };
      toggle('🎵 Music', 'Procedural soundtrack for every world', 'music');
      slider('Music volume', 'musicVol');
      toggle('🔊 Sound effects', 'Explosions, cannons and UI sounds', 'sound');
      slider('Sound volume', 'sfxVol');
      seg('🎯 Aim guide', 'How much of the trajectory is shown', 'aimGuide', [['off', 'Off'], ['short', 'Short'], ['normal', 'Normal'], ['long', 'Long']]);
      toggle('📳 Screen shake', 'Camera shake on explosions', 'shake');
      toggle('🔢 Damage numbers', 'Floating damage text', 'damageNumbers');
      seg('✨ Graphics', 'Use Low on slow phones', 'quality', [['low', 'Low'], ['high', 'High']]);
      // save management
      const io = U.el('div', 'set-row', `<div>💾 Save data<small>${GT.Save.storageOK ? 'Saved in this browser (localStorage)' : '⚠ Browser storage is blocked - progress only lasts this session'}</small></div>`);
      const ex = U.el('button', 'btn small', 'Export');
      ex.onclick = () => {
        const m = this.modal(`<h2>Export save</h2><p>Copy this code to back up or move your progress.</p><textarea readonly>${GT.Save.exportString()}</textarea><div class="row"><button class="btn" data-x>Close</button></div>`);
        m.querySelector('textarea').select();
        m.querySelector('[data-x]').onclick = () => this.closeModal();
      };
      const im = U.el('button', 'btn small', 'Import');
      im.onclick = () => {
        const m = this.modal(`<h2>Import save</h2><p>Paste a save code. This replaces your current progress.</p><textarea></textarea><div class="row"><button class="btn gray" data-x>Cancel</button><button class="btn yellow" data-ok>Import</button></div>`);
        m.querySelector('[data-x]').onclick = () => this.closeModal();
        m.querySelector('[data-ok]').onclick = () => {
          const ok = GT.Save.importString(m.querySelector('textarea').value);
          this.closeModal();
          this.toast(ok ? '✅' : '⚠️', ok ? 'Save imported' : 'Invalid save code');
          this.renderTopbars();
        };
      };
      const wrap = U.el('div', '');
      wrap.style.cssText = 'display:flex;gap:6px';
      wrap.append(ex, im);
      io.appendChild(wrap);
      body.appendChild(io);
      const acct = GT.Cloud.account;
      const cl = U.el('div', 'set-row', `<div>☁️ Cloud account<small>${acct ? 'Logged in as ' + esc(acct.name) + ' - progress is saved to the cloud' : 'Log in to join the leaderboard and back up your progress'}</small></div>`);
      const cb = U.el('button', 'btn small', acct ? 'Manage' : 'Log in');
      cb.onclick = () => this.go('leaderboard');
      cl.appendChild(cb);
      body.appendChild(cl);
      const rs = U.el('div', 'set-row', '<div>🗑️ Reset save<small>Delete ALL progress and start over</small></div>');
      const rb = U.el('button', 'btn red small', 'RESET');
      rb.onclick = () => this.confirm('Reset save?', 'All coins, tanks, stars and upgrades will be deleted' + (acct ? ', on this device AND in your cloud save' : '') + '. This cannot be undone.', 'Delete everything', () => {
        GT.Save.reset();
        this.gSel = null;
        this.toast('🗑️', 'Save reset', 'Welcome back, Rookie!');
        this.home();
      });
      rs.appendChild(rb);
      body.appendChild(rs);
      body.appendChild(U.el('div', 'set-row', '<div>⌨️ Controls<small>Drag on the battlefield to aim (angle + power) · ←/→ move · W/Q (or ↑/↓) angle +/− · S/A power +/− · Space fire · 1-9 / R/E weapons · F special · Z overview · J/L look around (or right-drag / two-finger drag) · C recenter · Esc pause</small></div>'));
    },

    /* ================================================================
     * LEADERBOARD + CLOUD ACCOUNT
     * ================================================================ */
    lbTab: 'stars',
    lbData: {},
    enter_leaderboard() {
      const tabs = $('#lb-tabs');
      const T = [['stars', '⭐ Stars'], ['worlds', '🗺️ Worlds'], ['tanks', '🚜 Tanks']];
      tabs.innerHTML = '';
      for (const [k, n] of T) {
        const b = U.el('button', this.lbTab === k ? 'on' : '', n);
        b.onclick = () => {
          this.lbTab = k;
          snd('click');
          this.enter_leaderboard();
        };
        tabs.appendChild(b);
      }
      this.renderLeaderboard();
      this.loadLeaderboard();
    },
    async loadLeaderboard() {
      const by = this.lbTab;
      try {
        this.lbData[by] = await GT.Cloud.leaderboard(by);
      } catch (e) {
        this.lbData[by] = { error: e.message };
      }
      if (this.current === 'leaderboard' && this.lbTab === by) this.renderLeaderboard();
    },
    lbValue(p, by) {
      if (by === 'worlds') return `🗺️ ${p.worlds || 1} / ${GT.Worlds.count}`;
      if (by === 'tanks') return `🚜 ${p.tanks || 0} / ${GT.Tanks.list.length}`;
      return `⭐ ${p.stars || 0} / ${GT.Levels.total() * 3}`;
    },
    renderLeaderboard() {
      const body = $('#lb-body');
      const by = this.lbTab, d = this.lbData[by];
      const acct = GT.Cloud.account;
      // keep the login form (and whatever is typed in it) when the board re-renders,
      // e.g. when the leaderboard finishes loading while the player is typing
      const oldForm = !acct && body.querySelector('[data-pin]') ? body.firstElementChild : null;
      const focused = oldForm && oldForm.contains(document.activeElement) ? document.activeElement : null;
      body.innerHTML = '';
      body.appendChild(oldForm || this.accountCard());
      if (focused) focused.focus();
      if (!d) return body.appendChild(U.el('div', 'lb-note', 'Loading leaderboard...'));
      if (d.error) return body.appendChild(U.el('div', 'lb-note', `⚠️ ${esc(d.error)}<br>The game still works - the leaderboard comes back when the server answers.`));
      if (d.me) {
        const rank = d.me.rank ? `#${d.me.rank} of ${d.players}` : 'Not ranked yet';
        body.appendChild(U.el('div', 'summary', `<div class="pill">Your rank: ${rank}</div><div class="pill">${this.lbValue(d.me, by)}</div>`));
        if (!d.me.rank) body.appendChild(U.el('div', 'lb-note', 'Finish a level to appear on the leaderboard.'));
      }
      if (!d.top.length) return body.appendChild(U.el('div', 'lb-note', 'Nobody on the board yet - be the first!'));
      d.top.forEach((p, i) => {
        const me = acct && d.me && p.name === d.me.name;
        const it = U.el('div', 'item' + (me ? ' me' : ''));
        it.appendChild(U.el('div', 'ii rk', i < 3 ? ['🥇', '🥈', '🥉'][i] : '#' + (i + 1)));
        it.appendChild(U.el('div', 'ib', `<b>${esc(p.name)}</b><p>⭐ ${p.stars || 0} · 🗺️ ${p.worlds || 1} · 🚜 ${p.tanks || 0}</p>`));
        it.appendChild(U.el('div', 'ir', this.lbValue(p, by)));
        body.appendChild(it);
      });
      body.appendChild(U.el('div', 'lb-note', `${d.players} player${d.players === 1 ? '' : 's'} on the board`));
    },
    accountCard() {
      const C = GT.Cloud, acct = C.account;
      const box = U.el('div', 'sec');
      if (!C.enabled) {
        box.innerHTML = '<h4>☁️ Online</h4><div class="lb-note">Online features are switched off in this version.</div>';
        return box;
      }
      if (acct) {
        box.innerHTML = `<h4>☁️ Logged in as ${esc(acct.name)}</h4><div class="lb-note">${esc(C.status || '☁️ Your progress is saved to the cloud automatically')}<br>Log in with the same name and pin on another device to continue there.</div>
          <div class="acct-form"><div class="row" style="justify-content:center"><button class="btn small" data-sync>☁️ Save now</button><button class="btn gray small" data-out>Log out</button></div></div>`;
        box.querySelector('[data-sync]').onclick = async () => {
          snd('click');
          await C.keepLocal();
          this.toast('☁️', C.status || 'Saved');
          this.renderLeaderboard();
        };
        box.querySelector('[data-out]').onclick = () =>
          this.confirm('Log out?', 'Your progress stays saved on this device and in the cloud.', 'Log out', async () => {
            await C.logout();
            this.lbData = {};
            this.enter_leaderboard();
          });
        return box;
      }
      box.innerHTML = `<h4>☁️ Join the leaderboard</h4><div class="lb-note" style="text-align:left;padding:0">Create an account to get on the leaderboard and keep your progress in the cloud, so you can continue on another device.</div>
        <div class="acct-form"><input data-name maxlength="16" placeholder="Name (shown on the leaderboard)" autocomplete="username"><input data-pin type="password" maxlength="64" placeholder="Pin (at least 4 characters)" autocomplete="current-password">
        <div class="acct-err" data-err></div><div class="row"><button class="btn yellow small" data-reg>Create account</button><button class="btn small" data-login>Log in</button></div></div>`;
      const err = (t) => (box.querySelector('[data-err]').textContent = t);
      const go = async (kind) => {
        snd('click');
        const name = box.querySelector('[data-name]').value.trim(), pin = box.querySelector('[data-pin]').value;
        if (name.length < 3) return err('Enter a name (at least 3 characters)');
        if (pin.length < 4) return err('The pin must be at least 4 characters');
        err('Please wait...');
        try {
          if (kind === 'reg') {
            const d = await C.register(name, pin);
            this.toast('🎉', 'Account created', 'Welcome, ' + d.name + '!');
          } else {
            const r = await C.login(name, pin);
            if (r.cloud && r.localBetter) {
              // Dismissing the modal decides nothing: the next save re-runs the
              // boot comparison, which keeps whichever copy has more progress.
              await new Promise((done) => {
                const m = this.modal(`<h2>Which progress?</h2><p>This device has more progress than your cloud save.</p>
                  <p>This device: ⭐ ${GT.Save.totalStars()} · Cloud: ⭐ ${Object.values(r.cloud.stars || {}).reduce((a, b) => a + (b || 0), 0)}</p>
                  <div class="row"><button class="btn gray" data-cloud>Use cloud save</button><button class="btn yellow" data-local>Keep this device</button></div>`, { onClose: done });
                m.querySelector('[data-cloud]').onclick = () => { this.closeModal(); C.useCloud(r.cloud); };
                m.querySelector('[data-local]').onclick = () => { this.closeModal(); C.keepLocal(); };
              });
            } else if (r.cloud) C.useCloud(r.cloud);
            else await C.keepLocal();
            this.toast('👋', 'Logged in as ' + r.name);
          }
          this.lbData = {};
          if (this.current === 'leaderboard') this.enter_leaderboard();
          else this.show('leaderboard');
        } catch (e) {
          err(e.message);
        }
      };
      box.querySelector('[data-reg]').onclick = () => go('reg');
      box.querySelector('[data-login]').onclick = () => go('login');
      // block body: returning false from an on-handler would cancel every keypress
      box.querySelector('[data-pin]').onkeydown = (e) => {
        if (e.key === 'Enter') go('login');
      };
      return box;
    },

    checkAch() {
      for (const a of GT.Progress.checkAchievements()) {
        this.toast(a.icon, 'Achievement: ' + a.name, a.desc + ' · +' + a.reward + ' coins');
        snd('unlock');
      }
    },

    /* ================================================================
     * BATTLE
     * ================================================================ */
    startBattle(w, l) {
      this.closeModal();
      const lv = GT.Levels.get(w, l);
      this.pendingLevel = { w, l };
      this.show('battle', { w, l }, true);
      GT.Game.stop();
      const self = this;
      const battle = new GT.Battle(lv, {
        tankId: S().selectedTank,
        loadout: S().loadout,
        ui: {
          message: (t, k) => self.hudMessage(t, k),
          turn: (b) => self.hudTurn(b),
          hp: () => {},
          tick: (b, dt) => self.hudTick(b, dt),
          end: (res) => self.battleEnd(res)
        }
      });
      this.battle = battle;
      this._hud = {};
      this.buildHud(battle);
      GT.Game.start(battle);
      const world = GT.Worlds.get(w);
      GT.Audio.playMusic(lv.isBoss ? GT.Worlds.BOSS_MUSIC : world.music);
    },

    buildHud(b) {
      $('#hud-msg').innerHTML = '';
      $('#hud-toast').innerHTML = '';
      const en = $('#hud-enemies');
      en.innerHTML = '';
      const boss = $('#hud-boss');
      boss.classList.toggle('on', !!b.boss);
      if (b.boss) {
        const ph = b.boss.bossDef.phases;
        boss.innerHTML = `<div class="bn">👑 ${esc(b.boss.name)} <small id="boss-phase">Phase 1/${ph.length}</small></div><div class="hpbar enemy" style="position:relative"><i class="lag" id="boss-lag"></i><i class="hp" id="boss-hp"></i><i class="sh" id="boss-sh"></i><div class="phase-marks">${ph.filter((p) => p.at).map((p) => `<i style="left:${p.at * 100}%"></i>`).join('')}</div><b id="boss-txt"></b></div>`;
      }
      $('#hud-player').innerHTML = `<div class="hn">${esc(b.player.name)}<small>Lv ${GT.Save.tankLevel(b.player.id)}</small></div><div class="hpbar"><i class="lag" id="p-lag"></i><i class="hp" id="p-hp"></i><i class="sh" id="p-sh"></i><b id="p-txt"></b></div>`;
      this.renderWeaponBar(b);
      this.updateAbilityBtn(b);
    },

    renderEnemyBars(b) {
      const en = $('#hud-enemies');
      const list = b.tanks.filter((t) => t.team === 'enemy' && !t.isBoss);
      if (en.childElementCount !== list.length) {
        en.innerHTML = '';
        list.forEach((t) => {
          const d = U.el('div', 'en', `<div class="hn">${esc(t.name)}</div><div class="hpbar enemy"><i class="lag"></i><i class="hp"></i><i class="sh"></i><b></b></div>`);
          d.dataset.uid = t.uid;
          en.appendChild(d);
        });
      }
      const nodes = en.children;
      list.forEach((t, i) => {
        const d = nodes[i];
        if (!d) return;
        const f = Math.max(0, t.hp / t.maxHp) * 100;
        const key = t.hp + '|' + t.shield + '|' + t.alive + '|' + (b.active === t);
        if (d._k === key) return;
        d._k = key;
        d.classList.toggle('dead', !t.alive);
        d.classList.toggle('active', b.active === t);
        d.querySelector('.hp').style.width = f + '%';
        d.querySelector('.lag').style.width = f + '%';
        d.querySelector('.sh').style.width = Math.min(100, (t.shield / t.maxHp) * 100) + '%';
        d.querySelector('b').textContent = t.alive ? Math.max(0, Math.round(t.hp)) : 'DESTROYED';
      });
    },

    renderWeaponBar(b) {
      const bar = $('#weapon-bar');
      bar.innerHTML = '';
      const p = b.player;
      if (p.armed) {
        const ab = GT.Tanks.ABILITIES[p.armed];
        bar.appendChild(U.el('div', 'wchip ability on', `<span class="wi">${ab.icon}</span>${esc(ab.name)} <small>armed</small>`));
      }
      p.weapons.forEach((s, i) => {
        const w = GT.Weapons.get(s.id);
        const c = U.el('button', 'wchip' + (i === p.weapon && !p.armed ? ' on' : '') + (s.ammo === 0 ? ' empty' : ''), `<span class="wi">${wico(w)}</span>${esc(w.name)} <small>${s.ammo < 0 ? '∞' : '×' + s.ammo}</small>`);
        c.title = (i + 1) + ': ' + w.desc;
        c.onclick = () => {
          GT.Audio.init();
          b.selectWeapon(i);
          this.renderWeaponBar(b);
        };
        bar.appendChild(c);
      });
      const on = bar.querySelector('.on');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },

    updateAbilityBtn(b) {
      const p = b.player;
      const ab = GT.Tanks.ABILITIES[p.ability];
      const btn = $('#btn-ability');
      $('#ability-icon').textContent = ab ? ab.icon : '★';
      btn.title = ab ? ab.name + ': ' + ab.desc : '';
      const frac = Math.min(1, p.charge / p.cd);
      $('#ability-ring').style.strokeDashoffset = String(119.4 * (1 - frac));
      const ready = frac >= 1 && p.status.emp <= 0;
      btn.classList.toggle('ready', ready && !p.armed);
      btn.classList.toggle('armed', !!p.armed || b.state === 'teleport');
    },

    hudTurn(b) {
      const t = b.active;
      const turn = $('#hud-turn');
      if (!t) return;
      const mine = t === b.player;
      turn.className = 'hud-turn ' + (mine ? 'me' : 'foe');
      turn.textContent = mine ? 'YOUR TURN' : t.name.toUpperCase();
      $('#hud-bottom').classList.toggle('off', !mine);
      this.renderWeaponBar(b);
      this.updateAbilityBtn(b);
      const wv = b.wind;
      $('#wind-val').textContent = Math.abs(wv);
      const arrow = $('#wind-arrow');
      arrow.textContent = wv === 0 ? '•' : '➜';
      arrow.style.transform = wv < 0 ? 'scaleX(-1)' : 'none';
      if (mine && b.round === 1 && S().settings.turnHints && S().stats.battles < 2) {
        this.hudToast('Drag on the battlefield to aim · Press FIRE to shoot');
      }
    },

    hudMessage(text, kind) {
      if (['title', 'boss', 'victory', 'defeat'].includes(kind)) {
        const box = $('#hud-msg');
        box.innerHTML = '';
        box.appendChild(U.el('div', 'm ' + kind, esc(text)));
      } else this.hudToast(text);
    },
    hudToast(text) {
      const box = $('#hud-toast');
      const d = U.el('div', '', esc(text));
      box.appendChild(d);
      while (box.childElementCount > 3) box.firstChild.remove();
      setTimeout(() => d.remove(), 3200);
    },

    /** called every frame by the game loop - only touches DOM on change */
    hudTick(b) {
      const h = this._hud;
      const p = b.player;
      const set = (key, val, fn) => {
        if (h[key] !== val) {
          h[key] = val;
          fn(val);
        }
      };
      const elev = p.aim <= 90 ? p.aim : 180 - p.aim;
      set('ang', Math.round(elev) + (p.aim > 90 ? 'L' : 'R'), () => ($('#aim-angle').textContent = (p.aim > 90 ? '◀ ' : '') + Math.round(elev) + '°' + (p.aim <= 90 ? ' ▶' : '')));
      set('pow', Math.round(p.power), (v) => {
        $('#aim-power').textContent = v;
        $('#power-fill').style.height = v + '%';
        $('#power-knob').style.bottom = `calc(${v}% - 3px)`;
      });
      set('panned', b.isPanned(), (v) => $('#btn-recenter').classList.toggle('hidden', !v));
      set('fuel', Math.round((p.fuel / p.maxFuel) * 100), (v) => ($('#fuel-fill').style.height = Math.min(100, Math.max(0, v)) + '%'));
      set('php', p.hp + '|' + p.shield, () => {
        const f = Math.max(0, p.hp / p.maxHp) * 100;
        $('#p-hp').style.width = f + '%';
        $('#p-lag').style.width = f + '%';
        $('#p-sh').style.width = Math.min(100, (p.shield / p.maxHp) * 100) + '%';
        $('#p-txt').textContent = Math.max(0, Math.round(p.hp)) + ' / ' + p.maxHp;
      });
      if (b.boss) {
        const B = b.boss;
        set('bhp', B.hp + '|' + B.shield + '|' + B.phaseIdx, () => {
          const f = Math.max(0, B.hp / B.maxHp) * 100;
          $('#boss-hp').style.width = f + '%';
          $('#boss-lag').style.width = f + '%';
          $('#boss-sh').style.width = Math.min(100, (B.shield / B.maxHp) * 100) + '%';
          $('#boss-txt').textContent = Math.max(0, Math.round(B.hp)) + ' / ' + B.maxHp;
          $('#boss-phase').textContent = `Phase ${B.phaseIdx + 1}/${B.bossDef.phases.length}`;
        });
      }
      set('ab', p.charge.toFixed(2) + '|' + p.armed + '|' + b.state + '|' + p.status.emp, () => this.updateAbilityBtn(b));
      set('wsel', p.weapon + '|' + p.armed + '|' + p.weapons.map((s) => s.ammo).join(','), () => this.renderWeaponBar(b));
      const mine = b.isPlayerTurn();
      set('mine', mine, (v) => $('#hud-bottom').classList.toggle('off', !v));
      this.renderEnemyBars(b);
    },

    pause() {
      const b = this.battle;
      if (!b || b.over) return;
      b.paused = true;
      GT.Audio.engine(false);
      snd('click');
      const m = this.modal(`<h2>⏸ Paused</h2><p>${esc(b.level.world + '-' + b.level.index + ' ' + b.level.name)}</p>
        <div style="display:flex;flex-direction:column;gap:10px;max-width:280px;margin:12px auto 0">
          <button class="btn green" data-r>▶ RESUME</button>
          <button class="btn" data-restart>↻ RESTART</button>
          <button class="btn" data-set>⚙ SETTINGS</button>
          <button class="btn red" data-exit>✖ EXIT TO MAP</button>
        </div>`, { onClose: () => { if (this.battle) this.battle.paused = false; } });
      m.querySelector('[data-r]').onclick = () => this.closeModal();
      m.querySelector('[data-restart]').onclick = () => {
        this._modalOpts = null;
        this.closeModal();
        this.startBattle(b.level.world, b.level.index);
      };
      m.querySelector('[data-exit]').onclick = () => {
        this._modalOpts = null;
        this.closeModal();
        this.exitBattle('levels');
      };
      m.querySelector('[data-set]').onclick = () => this.quickSettings();
    },
    quickSettings() {
      const st = S().settings;
      const m = this.modal(`<h2>⚙ Settings</h2><div class="list-wrap" id="qs"></div><div class="row"><button class="btn green" data-r>▶ RESUME</button></div>`, { onClose: () => { if (this.battle) this.battle.paused = false; } });
      const box = m.querySelector('#qs');
      const tog = (label, key) => {
        const row = U.el('div', 'set-row', `<div>${label}</div>`);
        const t = U.el('button', 'toggle' + (st[key] ? ' on' : ''));
        t.onclick = () => {
          st[key] = !st[key];
          t.classList.toggle('on', st[key]);
          GT.Save.save();
          GT.Audio.applySettings();
        };
        row.appendChild(t);
        box.appendChild(row);
      };
      tog('🎵 Music', 'music');
      tog('🔊 Sound', 'sound');
      tog('📳 Screen shake', 'shake');
      tog('🔢 Damage numbers', 'damageNumbers');
      const row = U.el('div', 'set-row', '<div>🎯 Aim guide</div>');
      const seg = U.el('div', 'seg');
      for (const [v, n] of [['off', 'Off'], ['short', 'Short'], ['normal', 'Normal'], ['long', 'Long']]) {
        const b = U.el('button', st.aimGuide === v ? 'on' : '', n);
        b.onclick = () => {
          st.aimGuide = v;
          GT.Save.save();
          $$('button', seg).forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
        };
        seg.appendChild(b);
      }
      row.appendChild(seg);
      box.appendChild(row);
      m.querySelector('[data-r]').onclick = () => this.closeModal();
    },

    exitBattle(to) {
      GT.Game.stop();
      const b = this.battle;
      this.battle = null;
      const w = b ? b.level.world : 1;
      if (to === 'levels') {
        this.stack = [{ name: 'menu', params: {} }, { name: 'worldmap', params: {} }];
        this.show('levels', { w }, true);
      } else if (to === 'garage') {
        this.stack = [{ name: 'menu', params: {} }, { name: 'levels', params: { w } }];
        this.gSel = S().selectedTank;
        this.show('garage', {}, true);
      } else if (to === 'tankselect') {
        this.stack = [{ name: 'menu', params: {} }, { name: 'levels', params: { w } }];
        this.show('tankselect', { w, l: b.level.index }, true);
      } else this.home();
    },

    battleEnd(res) {
      const out = GT.Progress.finishBattle(res);
      const lv = res.level;
      GT.Audio.stopMusic(false);
      const d = S();
      const next = lv.index < GT.Levels.PER_WORLD ? { w: lv.world, l: lv.index + 1 } : lv.world < GT.Worlds.count ? { w: lv.world + 1, l: 1 } : null;
      const nextOk = next && GT.Levels.isUnlocked(next.w, next.l);
      const unlockHtml = [];
      if (out.levelUp) unlockHtml.push(`<div>🎖️ Player level up! You are now level ${out.levelUp}</div>`);
      for (const u of out.unlocks) unlockHtml.push(`<div>${u.kind === 'tank' ? '🚜' : u.kind === 'weapon' ? '🚀' : '🗺️'} ${esc(u.text)}</div>`);
      for (const c of out.challenges) unlockHtml.push(`<div>📅 Challenge complete: ${esc(GT.Progress.challengeText(c))} - claim it in Challenges!</div>`);
      for (const a of out.achievements) unlockHtml.push(`<div>${a.icon} Achievement: ${esc(a.name)} (+${a.reward} 🪙)</div>`);
      const statLine = `<div class="stat-line"><span>Damage dealt <b>${U.fmt(res.damage)}</b></span><span>Turns <b>${res.turns}</b></span><span>Destroyed <b>${res.kills}</b></span><span>Crits <b>${res.crits}</b></span>${res.win ? `<span>HP left <b>${Math.round(res.hpPct * 100)}%</b></span>` : ''}</div>`;
      let html;
      const coinNote = !res.win || out.newStars ? '' : out.maxedBefore
        ? '<p style="font-size:0.8em;color:var(--muted)">⭐⭐⭐ already earned here - no more coins from this level. Look for 💰 bounties in Challenges!</p>'
        : `<p style="font-size:0.8em;color:var(--muted)">No new stars this time. Still ${U.fmt(out.coinsLeft)} 🪙 to earn here with more stars.</p>`;
      if (res.win) {
        html = `<div class="big-title win">VICTORY!</div>
          <div class="stars-big"><span>⭐</span><span>⭐</span><span>⭐</span></div>
          <p style="font-size:0.8em">${out.starFlags.map((f, i) => (f ? '✔' : '✖') + ' ' + ['Win', '50% HP', lv.par + ' turns'][i]).join(' · ')}</p>
          ${statLine}
          <div class="reward-row"><div class="reward">🪙 +${U.fmt(out.coins)}</div><div class="reward">✨ +${out.xp} XP</div>${out.blueprints ? `<div class="reward">📘 +${out.blueprints}</div>` : ''}</div>
          ${coinNote}
          <div class="bonus-list">${out.bonuses.map((b) => `<div><span>${esc(b.name)}</span><b>+${U.fmt(b.coins)}</b></div>`).join('')}</div>
          <div class="unlock-list">${unlockHtml.join('')}</div>
          <div class="row">${nextOk ? '<button class="btn green" data-next>NEXT LEVEL ›</button>' : ''}<button class="btn" data-replay>↻ REPLAY</button><button class="btn gray" data-map>🗺 WORLD MAP</button></div>`;
      } else {
        html = `<div class="big-title lose">DEFEAT</div>
          <p>💡 ${esc(U.pick(TIPS))}</p>
          ${statLine}
          <div class="reward-row"><div class="reward">🪙 +${U.fmt(out.coins)}</div><div class="reward">✨ +${out.xp} XP</div></div>
          <p style="font-size:0.8em">No progress is lost - try again!</p>
          <div class="unlock-list">${unlockHtml.join('')}</div>
          <div class="row"><button class="btn green" data-replay>↻ RETRY</button><button class="btn" data-tank>🚜 CHANGE TANK</button><button class="btn" data-garage>🔧 GARAGE</button><button class="btn gray" data-map>🗺 MAP</button></div>`;
      }
      const m = this.modal(html, { wide: true });
      if (res.win) {
        const spans = m.querySelectorAll('.stars-big span');
        out.starFlags.forEach((f, i) => {
          if (f) setTimeout(() => { spans[i].classList.add('on'); snd('coin'); }, 400 + i * 380);
        });
      }
      for (const a of out.achievements) this.toast(a.icon, 'Achievement: ' + a.name, '+' + a.reward + ' coins');
      const wire = (sel, fn) => {
        const e = m.querySelector(sel);
        if (e) e.onclick = () => {
          snd('click');
          this.closeModal();
          fn();
        };
      };
      wire('[data-next]', () => {
        GT.Game.stop();
        this.battle = null;
        this.stack = [{ name: 'menu', params: {} }, { name: 'worldmap', params: {} }];
        this.show('levels', { w: next.w }, true);
        this.levelInfo(next.w, next.l);
      });
      wire('[data-replay]', () => this.startBattle(lv.world, lv.index));
      wire('[data-map]', () => this.exitBattle('levels'));
      wire('[data-tank]', () => this.exitBattle('tankselect'));
      wire('[data-garage]', () => this.exitBattle('garage'));
      this.renderTopbars();
    },

    /* ================================================================
     * Input wiring (called once)
     * ================================================================ */
    initInput() {
      const canvas = $('#game');
      let aiming = false;
      const local = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const applyAim = (pt) => {
        const b = this.battle;
        if (!b || !b.isPlayerTurn()) return;
        const p = b.player;
        const m = R.muzzle(p, p.aim);
        const sp = b.worldToScreen(m.px, m.py);
        aimVec(b, pt.x - sp.x, sp.y - pt.y);
      };
      const aimRef = (b) => Math.min(b.cw, b.ch) * 0.42;
      const aimVec = (b, dx, dy) => {
        const dist = Math.hypot(dx, dy);
        if (dist < 12) return;
        let ang = U.deg(Math.atan2(dy, dx));
        if (ang < -90) ang += 360; // below horizontal on the left -> 180..270
        b.setAim(ang, U.clamp((dist / aimRef(b)) * 100, 5, 100));
      };
      // touch aiming is relative: drag anywhere and the aim moves with the finger
      // from where it was, so a tap never makes it jump and the finger doesn't hide the tank
      const TOUCH_AIM_SENS = 0.6;
      let touchAim = null;
      const startTouchAim = (b, pt) => {
        const p = b.player, len = (p.power / 100) * aimRef(b), a = U.rad(p.aim);
        touchAim = { x: pt.x, y: pt.y, vx: Math.cos(a) * len, vy: Math.sin(a) * len, aim: p.aim, power: p.power };
      };
      const moveTouchAim = (b, pt) => {
        if (!b || !b.isPlayerTurn() || !touchAim) return;
        aimVec(b, touchAim.vx + (pt.x - touchAim.x) * TOUCH_AIM_SENS, touchAim.vy + (touchAim.y - pt.y) * TOUCH_AIM_SENS);
      };
      // camera pan: right/middle mouse drag, or two fingers on touch
      const touches = new Map(); // pointerId -> last point
      let panning = false, panLast = null;
      const touchCenter = () => {
        let x = 0, y = 0;
        for (const p of touches.values()) { x += p.x; y += p.y; }
        return { x: x / touches.size, y: y / touches.size };
      };
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('pointerdown', (e) => {
        GT.Audio.init();
        const b = this.battle;
        if (!b || b.paused) return;
        const pt = local(e);
        if (e.pointerType === 'touch') touches.set(e.pointerId, pt);
        if (e.button === 1 || e.button === 2 || touches.size >= 2) {
          // start panning (cancels any aim drag in progress)
          e.preventDefault();
          // second finger = pan: undo whatever the first finger did to the aim
          if (aiming && touchAim && b.isPlayerTurn()) b.setAim(touchAim.aim, touchAim.power);
          aiming = false;
          touchAim = null;
          panning = true;
          panLast = touches.size >= 2 ? touchCenter() : pt;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          return;
        }
        if (b.state === 'teleport') {
          const w = b.screenToWorld(pt.x, pt.y);
          b.pointerTap(w.x, w.y);
          return;
        }
        if (!b.isPlayerTurn()) return;
        aiming = true;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        if (e.pointerType === 'touch') startTouchAim(b, pt);
        else applyAim(pt);
      });
      canvas.addEventListener('pointermove', (e) => {
        const pt = local(e);
        if (touches.has(e.pointerId)) touches.set(e.pointerId, pt);
        if (panning) {
          const b = this.battle;
          const cur = touches.size >= 2 ? touchCenter() : pt;
          if (b && panLast) b.panByScreen(cur.x - panLast.x, cur.y - panLast.y);
          panLast = cur;
          return;
        }
        if (aiming) {
          if (touchAim) moveTouchAim(this.battle, pt);
          else applyAim(pt);
        }
      });
      const stop = (e) => {
        touches.delete(e.pointerId);
        aiming = false;
        touchAim = null;
        if (panning) {
          // lifting one of two fingers: keep panning with the other only if 2+ remain
          if (touches.size >= 2) panLast = touchCenter();
          else { panning = false; panLast = null; }
        }
      };
      canvas.addEventListener('pointerup', stop);
      canvas.addEventListener('pointercancel', stop);
      canvas.addEventListener('wheel', (e) => {
        const b = this.battle;
        if (!b) return;
        e.preventDefault();
        b.nudgeAim(0, e.deltaY > 0 ? -2 : 2);
      }, { passive: false });

      // move pad: hold anywhere on it, slide the finger to switch direction.
      // The pointer is captured so drifting off a button doesn't stop the tank.
      const pad = $('.hud-move');
      const bl = $('#btn-left'), br = $('#btn-right');
      let padId = null;
      const padDir = (e) => {
        const r = pad.getBoundingClientRect();
        return e.clientX < r.left + r.width / 2 ? -1 : 1;
      };
      const padSet = (dir) => {
        if (this.battle) this.battle.setMove(dir);
        bl.classList.toggle('held', dir < 0);
        br.classList.toggle('held', dir > 0);
      };
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        GT.Audio.init();
        padId = e.pointerId;
        try { pad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        padSet(padDir(e));
      });
      pad.addEventListener('pointermove', (e) => {
        if (e.pointerId === padId) padSet(padDir(e));
      });
      const padOff = (e) => {
        if (e.pointerId !== padId) return;
        padId = null;
        padSet(0);
      };
      pad.addEventListener('pointerup', padOff);
      pad.addEventListener('pointercancel', padOff);
      pad.addEventListener('lostpointercapture', padOff);
      pad.addEventListener('contextmenu', (e) => e.preventDefault());

      // camera pan buttons (hold to look left/right)
      const holdPan = (id, dir) => {
        const el = $(id);
        const on = (e) => {
          e.preventDefault();
          if (this.battle) this.battle.setPan(dir);
          el.classList.add('held');
        };
        const off = () => {
          if (this.battle && this.battle.cam.panDir === dir) this.battle.setPan(0);
          el.classList.remove('held');
        };
        el.addEventListener('pointerdown', on);
        el.addEventListener('pointerup', off);
        el.addEventListener('pointerleave', off);
        el.addEventListener('pointercancel', off);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
      };
      holdPan('#btn-pan-l', -1);
      holdPan('#btn-pan-r', 1);
      $('#btn-recenter').addEventListener('click', () => this.battle && this.battle.resetPan());

      // angle/power +/- with auto-repeat
      const elevate = (d) => {
        const b = this.battle;
        if (!b) return;
        const p = b.player;
        b.nudgeAim(p.aim <= 90 ? d : -d, 0);
      };
      $$('[data-aim],[data-pow]').forEach((el) => {
        let tmr = null, rep = null;
        const act = () => {
          const b = this.battle;
          if (!b) return;
          if (el.dataset.aim) elevate(+el.dataset.aim);
          else b.nudgeAim(0, +el.dataset.pow);
        };
        const start = (e) => {
          e.preventDefault();
          act();
          tmr = setTimeout(() => (rep = setInterval(act, 45)), 320);
        };
        const end = () => {
          clearTimeout(tmr);
          clearInterval(rep);
        };
        el.addEventListener('pointerdown', start);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointerleave', end);
        el.addEventListener('pointercancel', end);
      });

      // power slider
      const slider = $('#power-slider');
      let sliding = false;
      const slide = (e) => {
        const r = slider.getBoundingClientRect();
        const v = U.clamp((1 - (e.clientY - r.top) / r.height) * 100, 1, 100);
        if (this.battle) this.battle.setAim(null, v);
      };
      slider.addEventListener('pointerdown', (e) => {
        sliding = true;
        try { slider.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        slide(e);
      });
      slider.addEventListener('pointermove', (e) => sliding && slide(e));
      slider.addEventListener('pointerup', () => (sliding = false));
      slider.addEventListener('pointercancel', () => (sliding = false));

      $('#btn-fire').addEventListener('click', () => {
        GT.Audio.init();
        if (this.battle) this.battle.fire();
      });
      $('#btn-ability').addEventListener('click', () => {
        GT.Audio.init();
        const b = this.battle;
        if (!b) return;
        b.useAbility();
        this.updateAbilityBtn(b);
        this.renderWeaponBar(b);
      });
      $('#btn-pause').addEventListener('click', () => this.pause());
      $('#btn-zoom').addEventListener('click', () => this.battle && this.battle.toggleOverview());

      // keyboard
      const keys = {};
      window.addEventListener('keydown', (e) => {
        const b = this.battle;
        if (this.current !== 'battle' || !b) {
          if (e.key === 'Escape' && $('#modal-back').classList.contains('open')) this.closeModal();
          return;
        }
        if ($('#modal-back').classList.contains('open')) {
          if (e.key === 'Escape') this.closeModal();
          return;
        }
        const k = e.key.toLowerCase();
        const step = e.shiftKey ? 5 : 1;
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
        if (k === 'arrowleft') { b.setMove(-1); keys.move = -1; }
        else if (k === 'arrowright') { b.setMove(1); keys.move = 1; }
        else if (k === 'arrowup' || k === 'w') elevate(step);
        else if (k === 'arrowdown' || k === 'q') elevate(-step);
        else if (k === 's') b.nudgeAim(0, step);
        else if (k === 'a') b.nudgeAim(0, -step);
        else if (k === ' ' || k === 'enter') { if (!e.repeat) { GT.Audio.init(); b.fire(); } }
        else if (k === 'f' || k === 'x') { if (!e.repeat) { b.useAbility(); this.updateAbilityBtn(b); this.renderWeaponBar(b); } }
        else if (k === 'z') b.toggleOverview();
        else if (k === 'j') b.setPan(-1);
        else if (k === 'l') b.setPan(1);
        else if (k === 'c') b.resetPan();
        else if (k === 'escape' || k === 'p') this.pause();
        else if (k === 'r' || k === 'e') {
          const p = b.player, n = p.weapons.length;
          let i = p.weapon;
          for (let t = 0; t < n; t++) {
            i = (i + (k === 'e' ? 1 : -1) + n) % n;
            if (p.weapons[i].ammo !== 0) break;
          }
          b.selectWeapon(i);
          this.renderWeaponBar(b);
        } else if (/^[1-9]$/.test(k)) {
          b.selectWeapon(+k - 1);
          this.renderWeaponBar(b);
        }
      });
      window.addEventListener('keyup', (e) => {
        const b = this.battle;
        const k = e.key.toLowerCase();
        if (b && ['arrowleft', 'arrowright'].includes(k)) b.setMove(0);
        if (b && (k === 'j' || k === 'l')) b.setPan(0);
      });
      window.addEventListener('blur', () => {
        if (!this.battle) return;
        this.battle.setMove(0);
        this.battle.setPan(0);
      });
    },

    initStatic() {
      R.applyGarageBackdrop();
      $$('[data-back]').forEach((b) => (b.onclick = () => this.back()));
      $$('[data-go]').forEach((b) => (b.onclick = () => this.go(b.dataset.go)));
      $('#btn-play').onclick = () => this.play();
      $('#modal-back').addEventListener('pointerdown', (e) => {
        if (e.target.id === 'modal-back' && !(this.battle && this.battle.over)) this.closeModal();
      });
      document.addEventListener('pointerdown', () => GT.Audio.init(), { capture: true });
      window.addEventListener('resize', () => {
        if (this.current === 'menu') this.drawMenuBg();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.battle && !this.battle.over && !this.battle.paused) this.pause();
      });
      this.initInput();
    }
  });
})();

