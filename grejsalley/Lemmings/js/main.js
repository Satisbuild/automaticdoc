/* GrejsAlley Lemmings — main.js
 * App controller: screens, the fixed-step game loop, skill assignment,
 * pause/speed/release/nuke, level flow and saving results.
 */
(function (GL) {
  'use strict';
  const $ = id => document.getElementById(id);
  const SPEEDS = [1, 2, 4];

  // Small looping scene for the start menu background.
  const MENU_LEVEL = {
    id: 'menu', world: 'hills', theme: 'hills', name: 'Menu', w: 900, h: 170, count: 100000, required: 1, rate: 72,
    skills: {}, entrance: { x: 120, y: 70 }, exit: { x: 820, y: 120 },
    terrain: [
      ['land', 0, 900, 170, [[0, 128], [200, 120], [380, 130], [560, 116], [740, 126], [900, 122]], 'd', 1],
      ['blob', 300, 160, 40, 14, 's', 2],
      ['blob', 640, 165, 60, 16, 'd', 3],
    ],
  };

  const App = {
    screen: 'menu',
    game: null,
    levelIndex: 0,
    renderer: null,
    menuRenderer: null,
    menuGame: null,
    paused: false,
    started: false,
    speed: 1,
    selected: null,
    hover: null,
    hoverPoint: null,
    acc: 0,
    last: 0,
    nukeArmed: false,
    resultShown: false,

    init() {
      GL.Save.load();
      GL.Audio.init(GL.Save.settings);
      this.canvas = $('game-canvas');
      this.renderer = new GL.Renderer(this.canvas, { fx: GL.Save.settings.fx });
      this.menuRenderer = new GL.Renderer($('menu-bg'), { fx: GL.Save.settings.fx });
      this.ui = GL.UI;
      GL.UI.init(this);
      GL.Input.init(this);
      this.speed = GL.Save.settings.speed;
      this.applySettings();
      this.startMenuScene();
      this.refreshMenu();

      window.addEventListener('resize', () => this.onResize());
      document.addEventListener('visibilitychange', () => {
        // Auto-pause when the tab is hidden so nobody dies while you are away.
        if (document.hidden && this.screen === 'game' && this.game && !this.game.over && this.started && !this.paused) this.openPause();
      });
      this.last = performance.now();
      requestAnimationFrame(t => this.frame(t));
      GL.Audio.playSong('menu');
    },

    applySettings() {
      const s = GL.Save.settings;
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      document.body.classList.toggle('touch', s.touch === 'on' || (s.touch === 'auto' && coarse));
      document.body.classList.toggle('no-hints', !s.hints);
      this.renderer.opts.fx = s.fx; this.menuRenderer.opts.fx = s.fx;
      this.renderer.initAmbient(); this.menuRenderer.initAmbient();
      if (this.renderer.game) this.renderer.resize();
    },

    onResize() {
      if (this.screen === 'game' && this.game) this.renderer.resize();
      if (this.screen === 'menu' && this.menuGame) { this.menuRenderer.resize(); this.fitMenuCamera(); }
    },

    /* --------------------------------- screens --------------------------------- */
    showScreen(name) {
      this.screen = name;
      for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === 'scr-' + name);
      if (name === 'levels') { GL.UI.buildLevelSelect(); GL.Audio.playSong('menu'); }
      if (name === 'menu') { this.refreshMenu(); this.menuRenderer.resize(); this.fitMenuCamera(); GL.Audio.playSong('menu'); }
      if (name !== 'game') { this.game = null; this.renderer.game = null; GL.UI.tooltip(null); }
    },

    refreshMenu() {
      const S = GL.Save;
      const btn = $('btn-continue');
      if (S.hasProgress()) {
        const idx = this.continueIndex();
        btn.hidden = false;
        $('continue-info').textContent = `Bane ${idx + 1}: ${GL.LEVELS[idx].name}`;
        $('btn-play').querySelector('span').textContent = 'Spil fra start';
        $('btn-play').classList.remove('primary');
      } else {
        btn.hidden = true;
        $('btn-play').querySelector('span').textContent = 'Spil';
        $('btn-play').classList.add('primary');
      }
    },

    continueIndex() {
      const S = GL.Save;
      // Prefer the newest unlocked level that is not finished; else the last played one.
      const next = S.data.unlocked - 1;
      if (next >= 0 && next < GL.LEVELS.length && !S.levelRecord(GL.LEVELS[next].id).done) return next;
      const last = GL.LEVELS.findIndex(l => l.id === S.data.last);
      return last >= 0 ? last : 0;
    },

    playFromMenu() { this.startLevel(0); },
    continueGame() { this.startLevel(this.continueIndex()); },

    startMenuScene() {
      this.menuGame = new GL.Game(MENU_LEVEL);
      this.menuRenderer.setGame(this.menuGame);
      this.fitMenuCamera();
      this.menuAcc = 0;
    },
    fitMenuCamera() {
      const R = this.menuRenderer;
      if (!R.game) return;
      R.resize();
      R.cam.z = Math.max(R.H / 150, R.W / 900);
      R.centerOn(450, 92);
    },

    /* ---------------------------------- levels ---------------------------------- */
    startLevel(index, skipIntro) {
      const def = GL.LEVELS[index];
      if (!def) return;
      this.levelIndex = index;
      GL.UI.closeDialog();
      this.showScreen('game');
      // A brand-new Game every time: restart resets lemmings, terrain, skills and timer.
      this.game = new GL.Game(def);
      this.renderer.setGame(this.game);
      this.paused = false;
      this.started = false;
      this.acc = 0;
      this.selected = null;
      this.hover = null;
      this.nukeArmed = false;
      this.resultShown = false;
      GL.UI.resetHud();
      GL.UI.setLevelTitle(index, def);
      // pre-select the first available skill
      const first = GL.SKILL_IDS.find(id => this.game.skills[id] > 0);
      this.selected = first || null;
      GL.Save.setLast(def.id);
      GL.Audio.playSong(def.world);
      requestAnimationFrame(() => { this.renderer.resize(); this.renderer.resetCamera(); });
      if (skipIntro) this.begin();
      else GL.UI.intro(index, def, {
        start: () => { GL.UI.closeDialog(); this.begin(); },
        levels: () => { GL.UI.closeDialog(); this.leaveToLevels(true); },
      });
    },

    begin() {
      this.started = true;
      GL.Audio.play('letsgo');
      GL.UI.banner('Lad os komme i gang!', 'good', 1600);
    },

    restart() { this.startLevel(this.levelIndex, true); },

    askRestart() {
      if (!this.game) return;
      if (this.game.over) { this.restart(); return; }
      const wasPaused = this.paused;
      this.paused = true;
      GL.UI.confirm('Genstart banen?', 'Alle grejser, evner, terræn og tid starter forfra.', 'Genstart', () => this.restart(), () => { this.paused = wasPaused; });
    },

    leaveToLevels(force) {
      if (!force && this.game && this.started && !this.game.over && this.game.released > 0) {
        const wasPaused = this.paused;
        this.paused = true;
        GL.UI.confirm('Forlad banen?', 'Dit forsøg på denne bane går tabt.', 'Forlad', () => this.showScreen('levels'), () => { this.paused = wasPaused; });
        return;
      }
      GL.UI.closeDialog();
      this.showScreen('levels');
    },

    /* ---------------------------------- controls --------------------------------- */
    dialogOpen() { return GL.UI.isOpen(); },

    escape() {
      if (GL.UI.isOpen()) { if (GL.UI.dlgClosable) GL.UI.closeDialog(true); return; }
      if (this.screen === 'game' && this.game && !this.game.over) this.openPause();
      else if (this.screen === 'levels') this.showScreen('menu');
    },

    openPause() {
      if (!this.game || this.game.over || !this.started) return;
      this.paused = true;
      GL.UI.pause({
        resume: () => { GL.UI.closeDialog(); this.paused = false; },
        restart: () => { GL.UI.closeDialog(); this.restart(); },
        settings: () => GL.UI.settings(() => this.openPause()),
        levels: () => { GL.UI.closeDialog(); this.showScreen('levels'); },
      });
    },

    togglePause() {
      if (!this.game || this.game.over || !this.started) return;
      this.paused = !this.paused;
      GL.Audio.play('click');
      GL.UI.banner(this.paused ? 'Pause' : 'Fortsætter', this.paused ? 'warn' : 'good', 900);
    },

    changeSpeed(d) {
      const i = Math.max(0, Math.min(SPEEDS.length - 1, SPEEDS.indexOf(this.speed) + d));
      this.setSpeed(SPEEDS[i]);
    },
    cycleSpeed() { this.setSpeed(SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length]); },
    setSpeed(s) {
      if (s === this.speed) return;
      this.speed = s;
      GL.Save.setSetting('speed', s);
      GL.Audio.play('click');
      GL.UI.banner(`Hastighed ${s}×`, null, 800);
    },

    changeRate(d) {
      const g = this.game; if (!g || g.over) return;
      const before = g.rate;
      g.setRate(g.rate + d);
      if (g.rate !== before) GL.Audio.play('click'); else GL.Audio.play('deny');
    },

    toggleRelease() {
      const g = this.game; if (!g || g.over || g.released >= g.count || g.nuking) return;
      g.releasing = !g.releasing;
      GL.Audio.play('click');
      GL.UI.banner(g.releasing ? 'Frigivelse startet' : 'Frigivelse stoppet', g.releasing ? 'good' : 'warn', 1100);
    },

    nukePress() {
      const g = this.game; if (!g || g.over || g.nuking || !this.started) return;
      if (!this.nukeArmed) {
        this.nukeArmed = true;
        GL.Audio.play('deny');
        clearTimeout(this._nukeT);
        this._nukeT = setTimeout(() => { this.nukeArmed = false; }, 2000);
        return;
      }
      this.nukeArmed = false;
      g.nuke();
      GL.UI.banner('Åh nej! Alle bomber er tændt!', 'warn', 2000);
    },

    selectSkill(id) {
      if (!this.game) return;
      if (this.game.skills[id] <= 0) { GL.Audio.play('deny'); GL.UI.toast(`Ingen ${GL.SKILLS.find(s => s.id === id).name} tilbage`); return; }
      this.selected = id;
      GL.Audio.play('select');
    },

    setHover(L, p) {
      this.hover = L || null;
      this.hoverPoint = p || null;
      this.canvas.classList.toggle('has-target', !!L);
    },

    clickLemming(L) {
      const g = this.game;
      if (!g || g.over || !this.started) return;
      if (!L) return;
      if (!this.selected) { GL.UI.toast('Vælg en evne nederst først'); GL.Audio.play('deny'); return; }
      const why = g.assign(L, this.selected);
      if (why) {
        GL.Audio.play('deny');
        GL.UI.toast(`Kan ikke: ${why}`);
      } else {
        GL.UI.bumpSkill(this.selected);
        // auto-unselect when the skill runs out
        if (g.skills[this.selected] <= 0) this.selected = null;
      }
    },

    /* ----------------------------------- loop ----------------------------------- */
    frame(t) {
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      try {
        if (this.screen === 'game' && this.game) this.updateGame(dt);
        else if (this.screen === 'menu' && this.menuGame) this.updateMenu(dt);
      } catch (err) {
        console.error(err);
      }
      requestAnimationFrame(tt => this.frame(tt));
    },

    updateGame(dt) {
      const g = this.game, R = this.renderer;
      GL.Input.edgeScroll(dt);
      if (this.started && !this.paused && !g.over) {
        this.acc += dt * this.speed * GL.CONST.TPS;
        let n = 0;
        while (this.acc >= 1 && n < 16) { g.step(); this.acc -= 1; n++; }
        if (n >= 16) this.acc = 0;
      }
      const alpha = this.paused || !this.started ? 1 : Math.min(1, this.acc);

      if (g.events.length) {
        const ev = g.events.splice(0, g.events.length);
        R.handleEvents(ev);
        GL.Audio.handleEvents(ev);
        for (const e of ev) {
          if (e.type === 'goal') GL.UI.banner('Målet er nået! Red resten for flere stjerner', 'good', 2600);
          if (e.type === 'win' || e.type === 'lose') this.showResults();
        }
      }

      // keep hover valid; touch never hovers
      if (this.hover && !this.hover.active) this.setHover(null);
      const reason = this.hover && this.selected ? GL.canAssign(this.hover, this.selected, g) : '';
      if (this.hover && this.hoverPoint) {
        GL.UI.tooltip(this.hover, this.hoverPoint, this.selected && g.skills[this.selected] > 0 ? reason : '');
      } else GL.UI.tooltip(null);

      R.draw(dt, alpha, { hover: this.hover, canAssign: !reason && !!this.selected });
      if ((this._mm = (this._mm || 0) + 1) % 3 === 0) R.drawMinimap($('minimap'));
      GL.UI.updateHud();
    },

    updateMenu(dt) {
      const g = this.menuGame, R = this.menuRenderer;
      this.menuAcc += dt * GL.CONST.TPS;
      let n = 0;
      while (this.menuAcc >= 1 && n < 8) { g.step(); this.menuAcc -= 1; n++; }
      if (n >= 8) this.menuAcc = 0;
      // keep the scene light: forget finished lemmings and events
      if (g.events.length) { R.handleEvents(g.events.filter(e => e.type === 'saved')); g.events.length = 0; }
      if (g.lemmings.length > 60) g.lemmings = g.lemmings.filter(L => L.alive);
      R.draw(dt, Math.min(1, this.menuAcc), null);
    },

    showResults() {
      if (this.resultShown) return;
      this.resultShown = true;
      const g = this.game, r = g.result, index = this.levelIndex, def = GL.LEVELS[index];
      const rec = GL.Save.recordResult(index, r);
      const hasNext = index + 1 < GL.LEVELS.length;
      this.selected = null;
      setTimeout(() => {
        if (this.game !== g) return;
        GL.UI.results(index, def, r, rec, {
          next: () => { GL.UI.closeDialog(); this.startLevel(index + 1); },
          retry: () => { GL.UI.closeDialog(); this.restart(); },
          levels: () => { GL.UI.closeDialog(); this.showScreen('levels'); },
        }, hasNext);
      }, 700);
    },
  };

  GL.App = App;
  window.addEventListener('DOMContentLoaded', () => App.init());
})(window.GL = window.GL || {});
