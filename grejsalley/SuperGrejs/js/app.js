'use strict';
/* =====================================================================
   SUPER GREJS - app.js
   Starter spillet og binder alt sammen: indstillinger, hovedløkke,
   tilstande (menu, intro, spil, pause, resultat, game over), progression
   og online-synkronisering.
   ===================================================================== */
SG.app = (function () {
  const U = SG.util;
  const STEP = SG.physics.STEP;
  const DEFAULT_SETTINGS = { music: true, musicVol: 0.55, sfx: true, sfxVol: 0.8, shake: true, reduceFlash: false, touch: 'auto', keys: null, char: 'grejs' };

  let settings = Object.assign({}, DEFAULT_SETTINGS, U.store.get('sg_settings', {}));
  if (!SG.characters.BY_ID[settings.char]) settings.char = 'grejs';
  let state = 'menu';
  let game = null;
  let menuT = 0;
  let levelStartForm = 0;
  let introTimer = null;

  function saveSettings() {
    U.store.set('sg_settings', settings);
    SG.audio.configure({ music: settings.music, musicVol: settings.musicVol, sfx: settings.sfx, sfxVol: settings.sfxVol });
    if (game) game.settings = { shake: settings.shake, reduceFlash: settings.reduceFlash };
    updateTouch();
  }

  function isTouchDevice() { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; }
  function updateTouch() {
    const want = settings.touch === 'on' || (settings.touch === 'auto' && isTouchDevice());
    document.body.classList.toggle('touch', want);
    const playing = state === 'playing';
    document.getElementById('touch').classList.toggle('hidden', !(want && playing));
    const pad = want && playing ? 0.2 : 0;
    if (game && SG.renderer.setBottomPad) game.setView(SG.renderer.setBottomPad(pad));
    const portrait = innerHeight > innerWidth;
    document.getElementById('rotate-hint').classList.toggle('hidden', !(want && playing && portrait));
  }

  function setState(s) {
    state = s;
    SG.input.setEnabled(s === 'playing');
    updateTouch();
  }

  /* ---------------- Spil-hooks ---------------- */
  function makeGame() {
    game = new SG.Game({
      onHud: d => SG.ui.hud(d),
      onToast: m => SG.ui.toast(m, 1800),
      onBossBar: (n, f) => SG.ui.bossBar(n, f),
      onLevelClear: info => levelClear(info),
      onLifeLost: checkpoint => lifeLost(checkpoint),
      onGameOver: () => gameOver(),
      onWarp: (world, info) => warp(world, info),
    });
    game.settings = { shake: settings.shake, reduceFlash: settings.reduceFlash };
    game.setView(SG.renderer.resize());
  }

  /* ---------------- Flow ---------------- */
  function firstPlayable() {
    const P = SG.progress;
    const last = P.last;
    if (last && SG.levels.has(last)) {
      const [w, k] = last.split('-').map(Number);
      if (P.isUnlocked(w, k)) return last;
    }
    const w = P.unlockedWorld;
    for (let k = 1; k <= 4; k++) if (P.isUnlocked(w, k) && !P.isCompleted(w, k)) return `${w}-${k}`;
    return `${w}-1`;
  }

  function continueGame() { startLevel(firstPlayable()); }

  function startLevel(id, opts) {
    opts = opts || {};
    const [w, k] = id.split('-').map(Number);
    if (!opts.force && !SG.progress.isUnlocked(w, k)) { SG.ui.toast('Banen er låst.'); return; }
    if (!game.session || opts.newSession) game.startSession(settings.char, 5);
    game.session.charId = settings.char;
    if (opts.checkpoint === undefined) levelStartForm = game.session.form;
    SG.progress.setLast(id);
    showIntro(id, opts.note, () => {
      game.loadLevel(id, { checkpoint: opts.checkpoint || null });
      SG.ui.hide();
      SG.ui.showHud(true);
      game.emitHud();
      setState('playing');
    });
  }

  function showIntro(id, note, then) {
    clearTimeout(introTimer);
    SG.audio.music.stop();
    SG.ui.showHud(false);
    setState('intro');
    SG.ui.show('intro', { id, lives: game.session.lives, note });
    introTimer = setTimeout(then, 1700);
  }

  function lifeLost(checkpoint) {
    const id = game.levelId;
    startLevel(id, { checkpoint, force: true, note: checkpoint ? 'Fra checkpoint' : '' });
  }

  function gameOver() {
    setState('gameover');
    SG.ui.showHud(false);
    SG.audio.sfx('gameover');
    SG.ui.show('gameover', { levelId: game.levelId });
  }

  function retryAfterGameOver() {
    const id = game.levelId;
    game.startSession(settings.char, 5);
    startLevel(id, { force: true });
  }

  function levelClear(info) {
    setState('results');
    SG.ui.showHud(false);
    const res = SG.progress.complete(info.world, info.index);
    let unlockText = '';
    if (res.newWorld) unlockText = `Verden ${res.newWorld}: ${SG.levels.worlds[res.newWorld].name} er låst op!`;
    else if (res.next && info.index < 4) unlockText = `Bane ${res.next} · ${SG.levels.name(res.next)} er låst op`;
    else if (info.world === 8 && info.index === 4) unlockText = 'Du har klaret hele Super Grejs!';
    SG.audio.music.play('title');
    SG.ui.show('results', {
      info, next: res.next, nextWorld: res.next ? Number(res.next.split('-')[0]) : info.world, unlockText,
      onSyncEl: el => syncInto(el, !!res.newWorld),
    });
  }

  // Viser status for online-gemning i resultatskærmen
  async function syncInto(el, isNew) {
    if (!el) return;
    if (!SG.auth.loggedIn) {
      if (isNew && SG.api.available) el.textContent = 'Log ind for at komme på ranglisten med din nye verden.';
      return;
    }
    if (!isNew && !SG.progress.pending) return;
    el.className = 'sync';
    el.textContent = 'Gemmer online …';
    const r = await SG.progress.syncWorld();
    if (r.status === 'ok') {
      el.className = 'sync ok';
      el.textContent = `✓ Gemt online - din rekord er Verden ${r.world}`;
    } else {
      el.className = 'sync bad';
      el.innerHTML = '';
      el.append(document.createTextNode('Kunne ikke gemme online: ' + (r.error ? r.error.message : 'ukendt fejl') + ' '));
      const b = document.createElement('button');
      b.className = 'btn small';
      b.textContent = 'Prøv igen';
      b.addEventListener('click', () => syncInto(el, true));
      el.appendChild(b);
    }
  }

  async function warp(world, info) {
    const newWorld = SG.progress.warpTo(world);
    SG.ui.toast(`Warp-rør! Videre til Verden ${world}`, 2600);
    if (newWorld && SG.auth.loggedIn) SG.progress.syncWorld().then(r => { if (r.status !== 'ok') SG.ui.toast('Kunne ikke gemme den nye verden online endnu - prøver igen senere.'); });
    startLevel(`${world}-1`, { force: true, note: 'Warp!' });
  }

  function pause() {
    if (state !== 'playing') return;
    game.paused = true;
    setState('paused');
    SG.audio.music.stop();
    SG.audio.sfx('pause');
    SG.ui.show('pause');
  }

  function resume() {
    if (state !== 'paused') return;
    SG.ui.hide();
    game.paused = false;
    SG.input.clear();
    setState('playing');
    game.restoreMusic();
  }

  function restartLevel() {
    game.paused = false;
    game.session.form = levelStartForm;
    startLevel(game.levelId, { force: true });
  }

  function quit(to) {
    clearTimeout(introTimer);
    if (game) { game.running = false; game.paused = false; }
    SG.ui.showHud(false);
    setState('menu');
    SG.audio.music.play('title');
    SG.ui.show(to || 'main');
  }

  function setChar(id) {
    settings.char = id;
    saveSettings();
    if (game && game.session) game.session.charId = id;
    if (SG.auth.loggedIn) {
      SG.api.setCharacter(id).then(r => SG.auth.setUser(r.user)).catch(() => {});
    }
  }

  async function afterLogin() {
    SG.progress.reload();
    try {
      const u = await SG.auth.refresh();
      if (u) {
        SG.progress.applyServer(u.highestWorldReached);
        if (SG.progress.unlockedWorld > u.highestWorldReached) await SG.progress.syncWorld();
        if (u.character !== settings.char) SG.api.setCharacter(settings.char).then(r => SG.auth.setUser(r.user)).catch(() => {});
      }
    } catch (e) { /* vises i menuen */ }
  }

  async function logout() {
    await SG.auth.logout();
    SG.progress.reload();
    SG.ui.toast('Du er logget ud.');
    if (game) game.session = null;
    SG.ui.show('main');
  }

  async function resync() {
    const r = await SG.progress.syncWorld();
    SG.ui.toast(r.status === 'ok' ? `Gemt online: Verden ${r.world}` : 'Kunne ikke gemme: ' + (r.error ? r.error.message : 'prøv igen senere'));
    if (SG.ui.current === 'main') SG.ui.show('main');
  }

  /* ---------------- Hovedløkke ---------------- */
  let acc = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    SG.input.poll();
    if (state === 'playing') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 12) {
        game.update(STEP);
        SG.input.endStep();
        acc -= STEP;
        n++;
      }
      if (n >= 12) acc = 0;
      SG.renderer.draw(game);
    } else if ((state === 'paused' || state === 'results' || state === 'gameover') && game && game.room) {
      SG.renderer.draw(game);
    } else if (state === 'intro') {
      SG.renderer.black(1);
    } else {
      menuT += dt;
      const w = Math.min(SG.progress.unlockedWorld, 8);
      const th = (SG.levels.worlds[w] || {}).theme || 'grass';
      SG.renderer.drawMenuScene(menuT, th, settings.char);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- Opstart ---------------- */
  function boot() {
    SG.renderer.init(document.getElementById('screen'));
    SG.input.setKeys(settings.keys);
    SG.input.bindTouch(document.getElementById('touch'));
    saveSettings();
    makeGame();

    SG.input.onPress(a => {
      if (a !== 'pause') return;
      if (state === 'playing') pause();
      else if (state === 'paused' && SG.ui.current === 'pause') resume();
    });
    document.getElementById('btn-pause').addEventListener('click', () => { SG.audio.unlock(); pause(); });

    const unlock = () => {
      SG.audio.unlock();
      if (state === 'menu' && !SG.audio.music.current) SG.audio.music.play('title');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    window.addEventListener('resize', () => { if (game) game.setView(SG.renderer.resize()); updateTouch(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
    window.addEventListener('blur', () => { if (state === 'playing') pause(); });

    SG.auth.onChange(() => { if (SG.ui.current === 'main') SG.ui.show('main'); });
    SG.ui.show('main');
    SG.audio.music.play('title');
    requestAnimationFrame(t => { last = t; frame(t); });

    // Hent konto og online-progression i baggrunden
    if (SG.auth.loggedIn) {
      afterLogin().then(() => { if (SG.ui.current === 'main') SG.ui.show('main'); });
    }

    // Tilbage online efter at have spillet offline: gem den nye verden online med det samme
    window.addEventListener('online', () => {
      if (SG.auth.loggedIn && SG.progress.pending) resync();
    });
  }

  return {
    boot, startLevel, continueGame, pause, resume, restartLevel, quit, setChar, afterLogin, logout, resync,
    retryAfterGameOver, saveSettings,
    get settings() { return settings; },
    get charId() { return settings.char; },
    get game() { return game; },
    get state() { return state; },
  };
})();

window.addEventListener('DOMContentLoaded', () => SG.app.boot());
