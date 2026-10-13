/* GrejsAlley Lemmings — ui.js
 * DOM side of the game: skill toolbar, status bar, level select and dialogs
 * (intro, pause, results, settings, confirm).
 */
(function (GL) {
  'use strict';
  const $ = id => document.getElementById(id);
  const icon = (id, cls) => `<svg class="ico${cls ? ' ' + cls : ''}"><use href="#i-${id}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  GL.STATE_NAMES = {
    walking: 'Går', falling: 'Falder', climbing: 'Klatrer', building: 'Bygger', shrugging: 'Færdig med at bygge',
    blocking: 'Stopper', bashing: 'Bryder', mining: 'Minearbejder', digging: 'Graver', exiting: 'Går hjem',
    drowning: 'Forulykker', splatting: 'Splat!',
  };

  const UI = {
    app: null,
    cache: new WeakMap(),
    dlgDefault: null,
    dlgClosable: true,
    onDlgClose: null,

    init(app) {
      this.app = app;
      // skills toolbar
      const sk = $('skills');
      sk.innerHTML = GL.SKILLS.map((s, i) => `
        <button class="skill" data-skill="${s.id}" title="${esc(s.name)} — ${esc(s.desc)} (${i + 1})" aria-label="${esc(s.name)}">
          <span class="key">${i + 1}</span>${icon(s.id)}<span class="sk-name">${esc(s.name)}</span><span class="sk-count">0</span>
        </button>`).join('');
      sk.addEventListener('click', e => {
        const b = e.target.closest('.skill');
        if (b) app.selectSkill(b.dataset.skill);
      });
      this.skillEls = {};
      for (const b of sk.querySelectorAll('.skill')) this.skillEls[b.dataset.skill] = { el: b, count: b.querySelector('.sk-count') };

      // stats bar
      $('stats').innerHTML = [
        ['total', 'people', 'I alt'], ['out', 'out', 'Ude'], ['active', 'walk', 'Aktive'],
        ['saved', 'home', 'Reddet'], ['dead', 'skull', 'Døde'], ['need', 'target', 'Krav'], ['time', 'clock', 'Tid'],
      ].map(([k, ic, label]) => `<span class="stat ${k}" id="st-${k}" title="${label}">${icon(ic)}<span class="k">${label}</span><b id="sv-${k}">0</b></span>`).join('');

      // buttons
      $('rate-down').onclick = () => app.changeRate(-5);
      $('rate-up').onclick = () => app.changeRate(5);
      $('c-pause').onclick = () => app.togglePause();
      $('c-speed').onclick = () => app.cycleSpeed();
      $('c-release').onclick = () => app.toggleRelease();
      $('c-nuke').onclick = () => app.nukePress();
      $('g-pause').onclick = () => app.openPause();
      $('g-restart').onclick = () => app.askRestart();
      $('g-levels').onclick = () => app.leaveToLevels();

      // menu
      $('btn-play').onclick = () => app.playFromMenu();
      $('btn-continue').onclick = () => app.continueGame();
      $('btn-levels').onclick = () => app.showScreen('levels');
      $('btn-settings').onclick = () => this.settings();
      document.querySelectorAll('[data-nav="menu"]').forEach(b => { b.onclick = () => app.showScreen('menu'); });

      $('overlay').addEventListener('pointerdown', e => {
        if (e.target === $('overlay') && this.dlgClosable) this.closeDialog(true);
      });
    },

    /* --------------------------------- HUD --------------------------------- */
    // Update a DOM property only when the value changed (cheap per-frame HUD).
    set(id, prop, val) {
      const el = typeof id === 'string' ? $(id) : id;
      let c = this.cache.get(el);
      if (!c) { c = {}; this.cache.set(el, c); }
      if (c[prop] === val) return;
      c[prop] = val;
      if (prop === 'text') el.textContent = val;
      else if (prop === 'html') el.innerHTML = val;
      else if (prop === 'class') el.className = val;
      else if (prop === 'disabled') el.disabled = val;
    },

    resetHud() { this.cache = new WeakMap(); },

    updateHud() {
      const app = this.app, g = app.game;
      if (!g) return;
      for (const s of GL.SKILLS) {
        const n = g.skills[s.id], o = this.skillEls[s.id];
        this.set(o.count, 'text', String(n));
        o.el.classList.toggle('empty', n <= 0);
        o.el.classList.toggle('sel', app.selected === s.id);
        o.el.setAttribute('aria-pressed', app.selected === s.id ? 'true' : 'false');
      }
      const alive = g.activeCount;
      this.set('sv-total', 'text', String(g.count));
      this.set('sv-out', 'text', String(g.released));
      this.set('sv-active', 'text', String(alive));
      this.set('sv-saved', 'text', `${g.saved}/${g.required}`);
      this.set('sv-dead', 'text', String(g.dead));
      this.set('sv-need', 'text', `${g.required} (${Math.round(g.required / g.count * 100)}%)`);
      this.set('st-saved', 'class', 'stat saved' + (g.saved >= g.required ? ' met' : ''));
      if (g.timeLimit) {
        const left = g.timeLeft / GL.CONST.TPS;
        this.set('sv-time', 'text', fmtTime(left));
        this.set('st-time', 'class', 'stat time' + (left <= 30 && !g.over ? ' low' : ''));
      } else this.set('sv-time', 'text', '∞');

      this.set('rate-val', 'text', String(g.rate));
      this.set('rate-down', 'disabled', g.rate <= g.minRate);
      this.set('rate-up', 'disabled', g.rate >= 99);
      this.set('speed-val', 'text', app.speed + '×');
      this.set('c-speed', 'class', 'sys-btn' + (app.speed > 1 ? ' on' : ''));
      this.set('c-pause', 'html', app.paused ? `${icon('play')}<span>Fortsæt</span>` : `${icon('pause')}<span>Pause</span>`);
      this.set('c-pause', 'class', 'sys-btn' + (app.paused ? ' warn' : ''));
      const relDone = g.released >= g.count || g.nuking;
      this.set('release-val', 'text', relDone ? 'Alle ude' : g.releasing ? 'Frigiver' : 'Stoppet');
      this.set('c-release', 'class', 'sys-btn' + (!relDone && !g.releasing ? ' warn' : ''));
      this.set('c-release', 'disabled', relDone);
      this.set('c-nuke', 'class', 'sys-btn danger' + (app.nukeArmed ? ' armed' : ''));
      this.set('nuke-val', 'text', app.nukeArmed ? 'Tryk igen!' : 'Bombe alle');
      this.set('c-nuke', 'disabled', g.nuking || g.over);

      let status = 'Kører', cls = 'status-pill';
      if (g.over) { status = g.result && g.result.won ? 'Klaret!' : 'Slut'; cls += ' over'; }
      else if (app.paused) { status = 'Pause'; cls += ' paused'; }
      else if (app.speed > 1) { status = `Kører ${app.speed}×`; cls += ' fast'; }
      this.set('g-status', 'text', status);
      this.set('g-status', 'class', cls);
      this.set('g-pause', 'html', app.paused ? icon('play') : icon('pause'));
    },

    bumpSkill(id) {
      const o = this.skillEls[id]; if (!o) return;
      o.el.classList.remove('bump'); void o.el.offsetWidth; o.el.classList.add('bump');
    },

    setLevelTitle(index, def) {
      $('g-levelnum').textContent = `Bane ${index + 1}`;
      $('g-levelname').textContent = def.name;
    },

    tooltip(L, p, reason) {
      const tip = $('lem-tip');
      if (!L || !p) { tip.classList.remove('show'); return; }
      const flags = [];
      if (L.climber) flags.push('Klatrer');
      if (L.floater) flags.push('Faldskærm');
      if (L.bomb > 0) flags.push('Bombe');
      let html = esc(GL.STATE_NAMES[L.state] || L.state);
      if (flags.length && L.state !== 'climbing') html += ' · ' + esc(flags.join(', '));
      if (reason) html += `<br><span class="bad">✕ ${esc(reason)}</span>`;
      tip.innerHTML = html;
      tip.style.left = p.x + 'px';
      tip.style.top = (p.y - 26) + 'px';
      tip.classList.add('show');
    },

    banner(text, kind, ms) {
      const b = $('banner');
      b.textContent = text;
      b.className = 'banner show' + (kind ? ' ' + kind : '');
      clearTimeout(this._bannerT);
      this._bannerT = setTimeout(() => { b.className = 'banner'; }, ms || 2200);
    },

    toast(text, ms) {
      const t = $('toast');
      t.textContent = text;
      t.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => t.classList.remove('show'), ms || 1800);
    },

    /* ------------------------------ level select ------------------------------ */
    buildLevelSelect() {
      const S = GL.Save;
      $('star-total').textContent = `${S.totalStars()}/${GL.LEVELS.length * 3}`;
      const curIndex = Math.min(S.data.unlocked - 1, GL.LEVELS.length - 1);
      $('world-list').innerHTML = GL.WORLDS.map((w, wi) => {
        const levels = GL.LEVELS.map((l, i) => ({ l, i })).filter(o => o.l.world === w.id);
        const stars = levels.reduce((a, o) => a + S.levelRecord(o.l.id).stars, 0);
        return `<section class="world w-${w.theme}">
          <div class="world-head"><div class="wnum">${wi + 1}</div><div><h3>${esc(w.name)}</h3><p>${esc(w.desc)}</p></div>
            <div class="wstars">${icon('star-g')}${stars}/${levels.length * 3}</div></div>
          <div class="level-grid">${levels.map(({ l, i }) => this.levelCard(l, i, i === curIndex)).join('')}</div>
        </section>`;
      }).join('');
      $('world-list').querySelectorAll('.level-card').forEach(c => {
        c.onclick = () => {
          const i = +c.dataset.index;
          if (!S.isUnlocked(i)) { this.toast('Klar den forrige bane for at låse op'); GL.Audio.play('deny'); return; }
          GL.Audio.play('click');
          this.app.startLevel(i);
        };
      });
      const cur = $('world-list').querySelector('.level-card.current');
      if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
    },

    levelCard(l, i, current) {
      const S = GL.Save, rec = S.levelRecord(l.id), unlocked = S.isUnlocked(i);
      const cls = ['level-card', rec.done ? 'done' : '', !unlocked ? 'locked' : '', current && unlocked && !rec.done ? 'current' : ''].join(' ');
      const stars = [1, 2, 3].map(n => icon(rec.stars >= n ? 'star-g' : 'star', rec.stars >= n ? '' : 'off')).join('');
      return `<button class="${cls}" data-index="${i}" ${!unlocked ? 'aria-disabled="true"' : ''} aria-label="Bane ${i + 1}: ${esc(l.name)}${!unlocked ? ' (låst)' : ''}">
        <span class="lnum">${rec.done ? icon('check') : i + 1}</span>
        <span class="lname">${esc(l.name)}</span>
        <span class="lmeta"><span>${icon('people')} ${l.count}</span><span>${icon('target')} ${l.required}</span><span>${icon('clock')} ${fmtTime(l.time)}</span></span>
        <span class="lstars">${stars}${rec.done ? `<span class="lbest">Bedst: ${rec.best}/${l.count}</span>` : ''}</span>
        ${!unlocked ? `<span class="lock">${icon('lock')}</span>` : current && !rec.done ? '<span class="badge">NY</span>' : ''}
      </button>`;
    },

    /* --------------------------------- dialogs --------------------------------- */
    dialog(html, opts) {
      opts = opts || {};
      const d = $('dialog');
      d.innerHTML = html;
      $('overlay').hidden = false;
      this.dlgClosable = opts.closable !== false;
      this.onDlgClose = opts.onClose || null;
      this.dlgDefault = null;
      d.querySelectorAll('[data-act]').forEach(b => {
        const fn = opts.actions && opts.actions[b.dataset.act];
        if (fn) b.onclick = () => { GL.Audio.play('click'); fn(); };
        if (b.hasAttribute('data-default')) this.dlgDefault = fn;
      });
      const first = d.querySelector('[data-default]') || d.querySelector('button');
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
      if (opts.bind) opts.bind(d);
    },

    isOpen() { return !$('overlay').hidden; },

    closeDialog(viaUser) {
      if (!this.isOpen()) return;
      $('overlay').hidden = true;
      $('dialog').innerHTML = '';
      const cb = this.onDlgClose;
      this.onDlgClose = null;
      if (viaUser && cb) cb();
    },

    defaultAction() { if (this.dlgDefault) { this.dlgDefault(); return true; } return false; },

    intro(index, def, actions) {
      const skills = GL.SKILLS.filter(s => def.skills && def.skills[s.id] > 0);
      const world = GL.WORLDS.find(w => w.id === def.world);
      this.dialog(`
        <div class="dlg-head"><div class="lnum">${index + 1}</div><div><h2>${esc(def.name)}</h2><p class="sub">${esc(world ? world.name : '')}</p></div></div>
        <div class="intro-text">${esc(def.intro)}</div>
        <div class="facts">
          <div class="fact">${icon('people')}<div><small>Grejser</small><b>${def.count}</b></div></div>
          <div class="fact">${icon('target')}<div><small>Skal reddes</small><b>${def.required} (${Math.round(def.required / def.count * 100)}%)</b></div></div>
          <div class="fact">${icon('clock')}<div><small>Tid</small><b>${fmtTime(def.time)}</b></div></div>
          <div class="fact">${icon('hatch')}<div><small>Frigivelse</small><b>${def.rate}</b></div></div>
        </div>
        <div class="skill-list">${skills.length ? skills.map(s => `<span class="skill-tag">${icon(s.id)}${esc(s.name)} <b>×${def.skills[s.id]}</b></span>`).join('') : '<span class="skill-tag">Ingen evner — bare se dem gå!</span>'}</div>
        <div class="dlg-actions">
          <button class="btn ghost" data-act="levels">${icon('map')}<span>Banevalg</span></button>
          <button class="btn primary big" data-act="start" data-default>${icon('play')}<span>Start</span></button>
        </div>`, { actions, closable: false });
    },

    pause(actions) {
      this.dialog(`
        <h2>Pause</h2>
        <p class="sub">Spillet står stille. Tag den tid du skal bruge.</p>
        <div class="dlg-stack">
          <button class="btn primary big" data-act="resume" data-default>${icon('play')}<span>Fortsæt</span></button>
          <button class="btn big" data-act="restart">${icon('restart')}<span>Genstart bane</span></button>
          <button class="btn big" data-act="settings">${icon('gear')}<span>Indstillinger</span></button>
          <button class="btn big" data-act="levels">${icon('map')}<span>Tilbage til banevalg</span></button>
        </div>
        ${this.keysHelp()}`, { actions, onClose: actions.resume });
    },

    keysHelp() {
      return `<div class="keys">
        <span><kbd>1</kbd>–<kbd>8</kbd></span><span>Vælg evne</span>
        <span><kbd>Space</kbd></span><span>Pause / fortsæt</span>
        <span><kbd>+</kbd> <kbd>−</kbd></span><span>Spilhastighed 1× / 2× / 4×</span>
        <span><kbd>Z</kbd> <kbd>X</kbd></span><span>Frigivelse langsommere / hurtigere</span>
        <span><kbd>F</kbd></span><span>Start / stop frigivelse</span>
        <span><kbd>R</kbd></span><span>Genstart bane</span>
        <span><kbd>N</kbd> <kbd>N</kbd></span><span>Bombe alle</span>
        <span><kbd>←</kbd><kbd>→</kbd> / træk</span><span>Flyt kameraet · hjul = zoom</span>
        <span><kbd>Esc</kbd></span><span>Pausemenu / luk</span>
      </div>`;
    },

    results(index, def, r, rec, actions, hasNext) {
      const win = r.won;
      const stars = [1, 2, 3].map(n => icon(r.stars >= n ? 'star-g' : 'star', r.stars >= n ? 'on' : 'off')).join('');
      const reasons = { time: 'Tiden løb ud.', impossible: 'Der er ikke længere grejser nok til at nå målet.', done: '' };
      let note = '';
      if (win && rec.newBest) note = `<p class="result-note good">Ny rekord: ${r.saved} reddet!</p>`;
      else if (!win) note = `<p class="result-note">${esc(reasons[r.reason] || '')} Du skulle redde ${r.required}.</p>`;
      else if (rec.unlockedNext && hasNext) note = '<p class="result-note good">Næste bane er låst op!</p>';
      this.dialog(`
        <div class="result-hero ${win ? 'win' : 'lose'}">
          <div class="big-icon">${win ? icon('check') : icon('close')}</div>
          <h2>${win ? 'Bane klaret!' : 'Ikke nok reddet'}</h2>
          <p class="sub">Bane ${index + 1} · ${esc(def.name)}</p>
          ${win ? `<div class="stars-big" aria-label="${r.stars} af 3 stjerner">${stars}</div>` : ''}
        </div>
        <div class="result-grid">
          <div class="fact">${icon('home')}<small>Reddet</small><b>${r.saved} / ${r.total}</b></div>
          <div class="fact">${icon('skull')}<small>Døde</small><b>${r.dead}</b></div>
          <div class="fact">${icon('target')}<small>Krav</small><b>${r.required}</b></div>
        </div>
        ${note}
        <div class="dlg-actions">
          <button class="btn ghost" data-act="levels">${icon('map')}<span>Banevalg</span></button>
          <button class="btn ${win ? '' : 'primary'}" data-act="retry" ${win ? '' : 'data-default'}>${icon('restart')}<span>Prøv igen</span></button>
          ${win && hasNext ? `<button class="btn primary" data-act="next" data-default>${icon('chev')}<span>Næste bane</span></button>` : ''}
        </div>`, { actions, closable: false });
    },

    confirm(title, text, yesLabel, onYes, onNo) {
      this.dialog(`
        <h2>${esc(title)}</h2>
        <p class="sub">${esc(text)}</p>
        <div class="dlg-actions">
          <button class="btn ghost" data-act="no">Annullér</button>
          <button class="btn danger" data-act="yes" data-default>${esc(yesLabel)}</button>
        </div>`, {
        actions: { yes: () => { this.closeDialog(); onYes(); }, no: () => { this.closeDialog(); if (onNo) onNo(); } },
        onClose: onNo,
      });
    },

    settings(onDone) {
      const S = GL.Save, s = S.settings;
      const sw = (id, label, sub, ic, on) => `<div class="setting"><label for="${id}">${icon(ic)}<span>${label}${sub ? `<small>${sub}</small>` : ''}</span></label>
        <span class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></span></div>`;
      const done = () => { this.closeDialog(); if (onDone) onDone(); };
      this.dialog(`
        <h2>Indstillinger</h2>
        <p class="sub">Gemmes automatisk på denne enhed.</p>
        ${sw('set-music', 'Musik', '', 'music', s.music)}
        ${sw('set-sfx', 'Lydeffekter', '', 'sound', s.sfx)}
        <div class="setting"><label for="set-vol">${icon('sound')}<span>Lydstyrke</span></label><input type="range" id="set-vol" min="0" max="100" value="${Math.round(s.volume * 100)}"></div>
        <div class="setting"><label for="set-mvol">${icon('music')}<span>Musikstyrke</span></label><input type="range" id="set-mvol" min="0" max="100" value="${Math.round(s.musicVolume * 100)}"></div>
        ${sw('set-fx', 'Effekter og animationer', 'Partikler, vejr og rystelser', 'gear', s.fx)}
        ${sw('set-hints', 'Vis tastatur-genveje', '', 'gear', s.hints)}
        <div class="setting"><label>${icon('walk')}<span>Store touch-knapper<small>Automatisk på mobil/tablet</small></span></label>
          <span class="seg" id="set-touch">${['auto', 'on', 'off'].map(v => `<button data-v="${v}" class="${s.touch === v ? 'on' : ''}">${{ auto: 'Auto', on: 'Til', off: 'Fra' }[v]}</button>`).join('')}</span></div>
        <div class="dlg-actions">
          <button class="btn danger" data-act="reset">Nulstil fremskridt</button>
          <button class="btn primary" data-act="done" data-default>Færdig</button>
        </div>`, {
        actions: {
          done,
          reset: () => this.confirm('Nulstil fremskridt?', 'Alle oplåste baner, stjerner og rekorder bliver slettet. Indstillinger beholdes.', 'Nulstil', () => {
            S.resetProgress();
            this.toast('Fremskridt nulstillet');
            this.app.refreshMenu();
            if (this.app.screen === 'levels') this.buildLevelSelect();
            this.settings(onDone);
          }, () => this.settings(onDone)),
        },
        onClose: onDone,
        bind: d => {
          const A = GL.Audio;
          d.querySelector('#set-music').onchange = e => { S.setSetting('music', e.target.checked); A.applySettings(); };
          d.querySelector('#set-sfx').onchange = e => { S.setSetting('sfx', e.target.checked); A.applySettings(); A.play('select'); };
          d.querySelector('#set-vol').oninput = e => { S.setSetting('volume', e.target.value / 100); A.applySettings(); };
          d.querySelector('#set-mvol').oninput = e => { S.setSetting('musicVolume', e.target.value / 100); A.applySettings(); };
          d.querySelector('#set-fx').onchange = e => { S.setSetting('fx', e.target.checked); this.app.applySettings(); };
          d.querySelector('#set-hints').onchange = e => { S.setSetting('hints', e.target.checked); this.app.applySettings(); };
          d.querySelectorAll('#set-touch button').forEach(b => {
            b.onclick = () => {
              S.setSetting('touch', b.dataset.v);
              d.querySelectorAll('#set-touch button').forEach(x => x.classList.toggle('on', x === b));
              this.app.applySettings();
            };
          });
        },
      });
    },
  };

  GL.UI = UI;
  GL.fmtTime = fmtTime;
})(window.GL = window.GL || {});
