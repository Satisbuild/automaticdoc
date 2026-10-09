'use strict';
/* =====================================================================
   SUPER GREJS - ui.js
   Alle menuer og skærme (DOM), HUD, toast og bossbar.
   Handlinger sendes videre til SG.app.
   ===================================================================== */
SG.ui = (function () {
  const U = SG.util;
  const esc = U.esc;
  const root = () => document.getElementById('screens');
  let current = null;
  let currentOpts = {};
  let animTimer = null;
  let toastTimer = null;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function worldName(w) { const i = SG.levels.worlds[w]; return i ? i.name : 'Verden ' + w; }
  function levelLabel(id) { return `${id} · ${SG.levels.name(id)}`; }

  /* ---------------- Skærm-system ---------------- */
  let shownAt = 0;
  function show(name, opts) {
    stopAnim();
    shownAt = performance.now();
    current = name;
    currentOpts = opts || {};
    const r = root();
    r.innerHTML = '';
    const fn = SCREENS[name];
    if (!fn) return;
    const el = fn(currentOpts);
    if (!el) return;
    r.appendChild(el);
    // Fokus på første knap, så tastatur virker med det samme
    requestAnimationFrame(() => {
      const f = el.querySelector('[data-autofocus]') || el.querySelector('.btn.primary, .btn, button, input');
      if (f && !(matchMedia('(pointer: coarse)').matches && f.tagName === 'INPUT')) f.focus({ preventScroll: true });
    });
  }
  function hide() { stopAnim(); current = null; root().innerHTML = ''; }
  function stopAnim() { if (animTimer) { clearInterval(animTimer); animTimer = null; } }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function on(root, sel, ev, fn) { $$(sel, root).forEach(n => n.addEventListener(ev, e => fn(e, n))); }
  function click(root, sel, fn) {
    on(root, sel, 'click', (e, n) => { SG.audio.unlock(); SG.audio.sfx('select'); fn(e, n); });
  }

  // Piletaster flytter fokus mellem knapper i den aktuelle skærm
  window.addEventListener('keydown', e => {
    if (!current || current === 'intro') return;
    const tag = (e.target && e.target.tagName) || '';
    if (e.key === 'Escape' && tag !== 'INPUT') {
      // Samme tastetryk, der lige åbnede skærmen (fx pause), må ikke lukke den igen
      if (performance.now() - shownAt < 60) return;
      const back = $('#screens [data-back]');
      if (back) { e.preventDefault(); back.click(); }
      return;
    }
    if (tag === 'INPUT') return;
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const items = $$('#screens button:not([disabled]), #screens input, #screens a[href]').filter(n => n.offsetParent !== null);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    const next = items[(i + (fwd ? 1 : -1) + items.length) % items.length] || items[0];
    next.focus();
    SG.audio.sfx('ui');
    e.preventDefault();
  });

  function portraitCanvas(id, size, pose, bust) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    SG.characters.portrait(c, id, pose || 'idle0', { bust });
    return c;
  }

  /* =================================================================
     SKÆRME
     ================================================================= */
  const SCREENS = {};

  /* ---------------- Hovedmenu ---------------- */
  SCREENS.main = () => {
    const ch = SG.characters.get(SG.app.charId);
    const P = SG.progress;
    const user = SG.auth.user;
    const last = P.last || '1-1';
    const hasProgress = Object.keys(P.data.completed).length > 0;
    const e = el(`
      <div class="screen soft">
        <div class="main-wrap">
          <div class="main-left">
            <h1 class="logo" aria-label="Super Grejs"><span class="l1">SUPER</span><span class="l2">GREJS</span></h1>
            <nav class="menu-list" aria-label="Hovedmenu">
              <button class="btn primary" data-go="play" data-autofocus>▶ ${hasProgress ? 'Fortsæt' : 'Spil'} <span class="k">${esc(last)}</span></button>
              <button class="btn" data-go="chars">Vælg figur</button>
              <button class="btn" data-go="map">Verdenskort</button>
              <button class="btn" data-go="social">Venner og rangliste</button>
              <button class="btn" data-go="settings">Indstillinger</button>
              ${user ? `<button class="btn ghost" data-go="logout">Log ud</button>` : `<button class="btn green" data-go="auth">Log ind / Opret konto</button>`}
            </nav>
            <div class="footer-links"><a href="../GREJSALLEY.html">← Tilbage til GrejsAlley</a></div>
          </div>
          <div class="main-right">
            <div class="char-card">
              <div class="pc"></div>
              <div><div class="nm">${esc(ch.name)}</div><div class="ds">${esc(ch.desc)}</div></div>
            </div>
            <div class="stats">
              <div class="stat"><b>Verden ${P.unlockedWorld}</b><span>Senest låst op</span></div>
              <div class="stat"><b>${P.highestCompletedWorld() ? 'Verden ' + P.highestCompletedWorld() : '-'}</b><span>Højeste gennemførte</span></div>
            </div>
            <div class="account-line">
              <i class="dot ${user ? 'on' : ''}"></i>
              <span>${user ? `Logget ind som <b>${esc(user.username)}</b> · Online: Verden ${user.highestWorldReached}` : (SG.api.available ? 'Spiller som gæst - log ind for venner og rangliste' : 'Spiller offline - online-funktioner er ikke sat op')}</span>
            </div>
            ${P.pending && user ? `<div class="notice bad">Din seneste verden er ikke gemt online endnu. <button class="btn small" data-go="resync">Prøv igen</button></div>` : ''}
          </div>
        </div>
      </div>`);
    $('.pc', e).appendChild(portraitCanvas(ch.id, 96, 'idle0', true));
    click(e, '[data-go]', (ev, n) => {
      const go = n.dataset.go;
      if (go === 'play') SG.app.continueGame();
      else if (go === 'logout') SG.app.logout();
      else if (go === 'resync') SG.app.resync();
      else show(go, { from: 'main' });
    });
    return e;
  };

  /* ---------------- Figurvælger ---------------- */
  SCREENS.chars = () => {
    let sel = SG.app.charId;
    const e = el(`
      <div class="screen dim">
        <div class="panel">
          <h2>Vælg figur</h2>
          <div class="char-layout">
            <div class="char-grid" role="listbox" aria-label="Figurer"></div>
            <div class="char-preview" aria-live="polite">
              <canvas width="180" height="180"></canvas>
              <div><div class="nm"></div><div class="ds"></div><p class="note">Alle figurer har præcis samme evner - kun udseendet er forskelligt.</p></div>
            </div>
          </div>
          <div class="row end" style="margin-top:16px">
            <button class="btn ghost" data-back>Tilbage</button>
            <button class="btn primary" data-ok>Vælg figur</button>
          </div>
        </div>
      </div>`);
    const grid = $('.char-grid', e);
    SG.characters.LIST.forEach(c => {
      const b = el(`<button class="char-tile" role="option" aria-pressed="${c.id === sel}" data-id="${c.id}"></button>`);
      b.appendChild(portraitCanvas(c.id, 72, 'idle0', true));
      b.appendChild(document.createTextNode(c.name));
      grid.appendChild(b);
    });
    const prev = $('.char-preview canvas', e);
    const nm = $('.char-preview .nm', e), ds = $('.char-preview .ds', e);
    const update = () => {
      const c = SG.characters.get(sel);
      nm.textContent = c.name; ds.textContent = c.desc;
      $$('.char-tile', e).forEach(t => t.setAttribute('aria-pressed', t.dataset.id === sel));
    };
    update();
    let f = 0;
    const seq = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall', 'land', 'win0', 'win1', 'win0', 'win1', 'idle0'];
    animTimer = setInterval(() => { f++; SG.characters.portrait(prev, sel, seq[f % seq.length]); }, 130);
    SG.characters.portrait(prev, sel, 'idle0');
    on(e, '.char-tile', 'click', (ev, n) => { sel = n.dataset.id; SG.audio.unlock(); SG.audio.sfx('ui'); update(); });
    on(e, '.char-tile', 'dblclick', () => { SG.app.setChar(sel); show('main'); });
    click(e, '[data-ok]', () => { SG.app.setChar(sel); show(currentOpts.from === 'map' ? 'map' : 'main'); });
    click(e, '[data-back]', () => show('main'));
    return e;
  };

  /* ---------------- Verdenskort ---------------- */
  // Knudepunkternes placering (procent) på kortet
  const NODE_POS = [[14, 66], [36, 40], [60, 62], [84, 36]];
  SCREENS.map = (opts) => {
    const P = SG.progress;
    let w = opts.world || Math.min(P.unlockedWorld, Number((P.last || '1-1').split('-')[0]) || 1);
    const e = el(`
      <div class="screen dim">
        <div class="panel">
          <div class="map-head">
            <button class="btn icon" data-prev aria-label="Forrige verden">◀</button>
            <div class="title"><b></b><span></span></div>
            <button class="btn icon" data-next aria-label="Næste verden">▶</button>
          </div>
          <div class="map-stage"><canvas class="bg" width="640" height="280"></canvas><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg></div>
          <div class="world-dots"></div>
          <div class="map-info"><span class="info"></span>
            <div class="row"><button class="btn ghost" data-back>Tilbage</button><button class="btn" data-chars>Figur</button><button class="btn primary" data-playnext>Spil næste</button></div>
          </div>
        </div>
      </div>`);
    const dots = $('.world-dots', e);
    for (let i = 1; i <= 8; i++) {
      const d = el(`<button aria-label="Verden ${i}" class="${i > P.unlockedWorld ? 'locked' : ''}" data-w="${i}">${i}</button>`);
      dots.appendChild(d);
    }
    const render = () => {
      const info = SG.levels.worlds[w] || {};
      $('.title b', e).textContent = `Verden ${w}: ${info.name || ''}`;
      $('.title span', e).textContent = w > P.unlockedWorld ? 'Låst - gennemfør den forrige verden' : (info.tagline || '');
      $$('.world-dots button', e).forEach(b => b.setAttribute('aria-current', Number(b.dataset.w) === w));
      const stage = $('.map-stage', e);
      SG.renderer.themePreview($('canvas.bg', stage), info.theme || 'grass', false);
      $$('.node', stage).forEach(n => n.remove());
      const svg = $('svg', stage);
      const pts = NODE_POS.map(p => p.join(',')).join(' ');
      svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="rgba(26,15,51,.75)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <polyline points="${pts}" fill="none" stroke="#fff6d8" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
      let nextId = null;
      for (let k = 1; k <= 4; k++) {
        const id = `${w}-${k}`;
        const unlocked = P.isUnlocked(w, k);
        const done = P.isCompleted(w, k);
        if (unlocked && !done && !nextId) nextId = id;
        const [x, y] = NODE_POS[k - 1];
        const n = el(`<button class="node ${k === 4 ? 'boss' : ''} ${done ? 'done' : ''} ${unlocked ? '' : 'locked'}" style="left:${x}%;top:${y}%" data-id="${id}" ${unlocked ? '' : 'aria-disabled="true"'} aria-label="Bane ${id}: ${esc(SG.levels.name(id))}${unlocked ? '' : ' (låst)'}">${k}<span class="lbl">${esc(id)} ${esc(SG.levels.name(id))}</span></button>`);
        if (id === nextId) n.classList.add('next');
        stage.appendChild(n);
      }
      if (!nextId && w <= P.unlockedWorld) nextId = `${w}-1`;
      const allDone = [1, 2, 3, 4].every(k => P.isCompleted(w, k));
      $('.info', e).textContent = w > P.unlockedWorld ? `Næste mål: gennemfør ${P.unlockedWorld}-4 for at komme videre`
        : allDone ? 'Verdenen er klaret! Spil banerne igen, eller tag videre.' : `Næste mål: ${levelLabel(nextId)}`;
      const btn = $('[data-playnext]', e);
      btn.disabled = w > P.unlockedWorld;
      btn.dataset.id = nextId || '';
      $('[data-prev]', e).disabled = w <= 1;
      $('[data-next]', e).disabled = w >= 8;
      on(stage, '.node', 'click', (ev, n) => {
        SG.audio.unlock();
        if (n.classList.contains('locked')) { SG.audio.sfx('error'); toast('Banen er låst. Klar banen før den først.'); return; }
        SG.audio.sfx('select');
        SG.app.startLevel(n.dataset.id);
      });
    };
    render();
    click(e, '[data-prev]', () => { if (w > 1) { w--; render(); } });
    click(e, '[data-next]', () => { if (w < 8) { w++; render(); } });
    click(e, '.world-dots button', (ev, n) => { w = Number(n.dataset.w); render(); });
    click(e, '[data-back]', () => show('main'));
    click(e, '[data-chars]', () => show('chars', { from: 'map' }));
    click(e, '[data-playnext]', (ev, n) => { if (n.dataset.id) SG.app.startLevel(n.dataset.id); });
    return e;
  };

  /* ---------------- Venner og rangliste ---------------- */
  SCREENS.social = (opts) => {
    const user = SG.auth.user;
    if (!user) {
      const e = el(`
        <div class="screen dim"><div class="panel mid">
          <h2>Venner og rangliste</h2>
          <div class="notice">${SG.api.available ? 'Log ind eller opret en konto for at tilføje venner og se, hvor langt de er nået.' : 'Online-funktioner er ikke sat op for denne side endnu.'}</div>
          <div class="row end" style="margin-top:16px">
            <button class="btn ghost" data-back>Tilbage</button>
            ${SG.api.available ? '<button class="btn primary" data-auth>Log ind / Opret konto</button>' : ''}
          </div>
        </div></div>`);
      click(e, '[data-back]', () => show('main'));
      click(e, '[data-auth]', () => show('auth', { from: 'social' }));
      return e;
    }
    let tab = opts.tab || 'lb-friends';
    const e = el(`
      <div class="screen dim"><div class="panel">
        <h2>Venner og rangliste</h2>
        <div class="tabs" role="tablist">
          <button class="tab" role="tab" data-tab="lb-friends">Mine venner</button>
          <button class="tab" role="tab" data-tab="lb-global">Alle spillere</button>
          <button class="tab" role="tab" data-tab="friends">Venneliste</button>
          <button class="tab" role="tab" data-tab="requests">Anmodninger <span class="badge hidden">0</span></button>
          <button class="tab" role="tab" data-tab="search">Find spillere</button>
        </div>
        <div class="body"></div>
        <div class="row end" style="margin-top:16px"><button class="btn ghost" data-back>Tilbage</button></div>
      </div></div>`);
    const body = $('.body', e);
    const setBadge = n => { const b = $('.badge', e); b.textContent = n; b.classList.toggle('hidden', !n); };
    SG.api.requests().then(r => setBadge(r.incoming.length)).catch(() => {});

    const loading = () => { body.innerHTML = '<div class="list"><div class="empty">Henter …</div></div>'; };
    const fail = (err, retry) => {
      body.innerHTML = '';
      const n = el(`<div class="notice bad">${esc(err.message)} <button class="btn small" data-retry>Prøv igen</button></div>`);
      click(n, '[data-retry]', retry);
      body.appendChild(n);
    };
    const row = (p, extra) => {
      const r = el(`<div class="lrow ${p.isMe ? 'me' : ''}">
        ${p.rank ? `<span class="rank r${p.rank}">#${p.rank}</span>` : ''}
        <span class="pc"></span>
        <span class="nm">${esc(p.username)}${p.isMe ? ' <small>(dig)</small>' : ''}${extra && extra.sub ? `<small>${esc(extra.sub)}</small>` : ''}</span>
        <span class="wv">Verden ${p.highestWorldReached}</span>
        <span class="acts"></span>
      </div>`);
      $('.pc', r).replaceWith(portraitCanvas(p.character || 'grejs', 40, 'idle0', true));
      return r;
    };

    const tabs = {
      async 'lb-friends'() {
        loading();
        try {
          const r = await SG.api.leaderboardFriends();
          body.innerHTML = '';
          const list = el('<div class="list"></div>');
          r.entries.forEach(p => list.appendChild(row(p)));
          if (!r.friendCount) list.appendChild(el(`<div class="empty">Du har ingen venner endnu. Gå til <b>Find spillere</b> og send en venneanmodning!</div>`));
          body.appendChild(el('<p>Ranglisten sorteres kun efter højeste verden nået.</p>'));
          body.appendChild(list);
        } catch (err) { fail(err, () => tabs[tab]()); }
      },
      async 'lb-global'() {
        loading();
        try {
          const r = await SG.api.leaderboardGlobal(50, 0);
          body.innerHTML = '';
          const list = el('<div class="list"></div>');
          r.entries.forEach(p => list.appendChild(row(p)));
          if (!r.entries.some(p => p.isMe)) {
            list.appendChild(el('<div class="empty" style="padding:8px">…</div>'));
            list.appendChild(row(Object.assign({ isMe: true }, r.me)));
          }
          body.appendChild(el(`<p>Top 50 af ${r.total} spillere. Din placering: <b>#${r.me.rank}</b></p>`));
          body.appendChild(list);
        } catch (err) { fail(err, () => tabs[tab]()); }
      },
      async friends() {
        loading();
        try {
          const r = await SG.api.friends();
          body.innerHTML = '';
          const list = el('<div class="list"></div>');
          if (!r.friends.length) list.appendChild(el('<div class="empty">Ingen venner endnu. Find dem under <b>Find spillere</b>.</div>'));
          r.friends.forEach(f => {
            const rr = row(f);
            const b = el('<button class="btn small red">Fjern</button>');
            b.addEventListener('click', async () => {
              if (!confirm(`Vil du fjerne ${f.username} som ven?`)) return;
              b.disabled = true;
              try { await SG.api.removeFriend(f.id); toast(`${f.username} er fjernet.`); tabs.friends(); }
              catch (err) { b.disabled = false; toast(err.message); }
            });
            $('.acts', rr).appendChild(b);
            list.appendChild(rr);
          });
          body.appendChild(list);
        } catch (err) { fail(err, () => tabs[tab]()); }
      },
      async requests() {
        loading();
        try {
          const r = await SG.api.requests();
          setBadge(r.incoming.length);
          body.innerHTML = '';
          body.appendChild(el('<h3>Til dig</h3>'));
          const inc = el('<div class="list"></div>');
          if (!r.incoming.length) inc.appendChild(el('<div class="empty">Ingen nye anmodninger.</div>'));
          r.incoming.forEach(q => {
            const rr = row(q.user, { sub: 'vil være venner med dig' });
            const ok = el('<button class="btn small green">Accepter</button>');
            const no = el('<button class="btn small red">Afvis</button>');
            ok.addEventListener('click', async () => { ok.disabled = no.disabled = true; try { await SG.api.accept(q.id); SG.audio.sfx('checkpoint'); toast(`Du og ${q.user.username} er nu venner!`); tabs.requests(); } catch (err) { toast(err.message); tabs.requests(); } });
            no.addEventListener('click', async () => { ok.disabled = no.disabled = true; try { await SG.api.decline(q.id); tabs.requests(); } catch (err) { toast(err.message); tabs.requests(); } });
            $('.acts', rr).append(ok, no);
            inc.appendChild(rr);
          });
          body.appendChild(inc);
          body.appendChild(el('<h3>Sendt af dig</h3>'));
          const out = el('<div class="list"></div>');
          if (!r.outgoing.length) out.appendChild(el('<div class="empty">Ingen ventende anmodninger.</div>'));
          r.outgoing.forEach(q => {
            const rr = row(q.user, { sub: 'afventer svar' });
            const c = el('<button class="btn small ghost">Annullér</button>');
            c.addEventListener('click', async () => { c.disabled = true; try { await SG.api.cancel(q.id); tabs.requests(); } catch (err) { toast(err.message); tabs.requests(); } });
            $('.acts', rr).append(el('<span class="pill warn">Afventer</span>'), c);
            out.appendChild(rr);
          });
          body.appendChild(out);
        } catch (err) { fail(err, () => tabs[tab]()); }
      },
      search() {
        body.innerHTML = '';
        const f = el(`<form class="searchbar" autocomplete="off"><input type="search" name="q" maxlength="16" placeholder="Søg efter brugernavn" aria-label="Brugernavn" required><button class="btn primary" type="submit">Søg</button></form>`);
        const list = el('<div class="list"><div class="empty">Skriv hele eller en del af et brugernavn.</div></div>');
        body.append(f, list);
        setTimeout(() => $('input', f).focus(), 50);
        const send = async (p, btn) => {
          btn.disabled = true;
          try {
            const r = await SG.api.sendRequest(p.username);
            if (r.status === 'accepted') { toast(`Du og ${p.username} er nu venner!`); SG.audio.sfx('checkpoint'); }
            else toast(`Venneanmodning sendt til ${p.username}.`);
            run();
          } catch (err) { btn.disabled = false; toast(err.message); }
        };
        const run = async () => {
          const q = $('input', f).value.trim();
          if (!q) return;
          list.innerHTML = '<div class="empty">Søger …</div>';
          try {
            const r = await SG.api.search(q);
            list.innerHTML = '';
            if (!r.players.length) list.appendChild(el('<div class="empty">Ingen spillere fundet.</div>'));
            r.players.forEach(p => {
              const rr = row(p);
              const acts = $('.acts', rr);
              if (p.relation === 'friend') acts.appendChild(el('<span class="pill good">Ven</span>'));
              else if (p.relation === 'outgoing') acts.appendChild(el('<span class="pill warn">Afventer svar</span>'));
              else if (p.relation === 'incoming') {
                const b = el('<button class="btn small green">Accepter</button>');
                b.addEventListener('click', async () => { b.disabled = true; try { await SG.api.accept(p.requestId); toast(`Du og ${p.username} er nu venner!`); run(); } catch (err) { toast(err.message); } });
                acts.appendChild(b);
              } else {
                const b = el('<button class="btn small primary">Tilføj ven</button>');
                b.addEventListener('click', () => send(p, b));
                acts.appendChild(b);
              }
              list.appendChild(rr);
            });
          } catch (err) { list.innerHTML = ''; list.appendChild(el(`<div class="notice bad">${esc(err.message)}</div>`)); }
        };
        f.addEventListener('submit', ev => { ev.preventDefault(); run(); });
      },
    };
    const select = t => {
      tab = t;
      $$('.tab', e).forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
      tabs[t]();
    };
    click(e, '.tab', (ev, n) => select(n.dataset.tab));
    click(e, '[data-back]', () => show('main'));
    select(tab);
    return e;
  };

  /* ---------------- Log ind / opret ---------------- */
  SCREENS.auth = (opts) => {
    let mode = opts.mode || 'login';
    const e = el(`
      <div class="screen dim"><div class="panel narrow">
        <h2>Konto</h2>
        <div class="tabs" role="tablist">
          <button class="tab" data-mode="login">Log ind</button>
          <button class="tab" data-mode="register">Opret konto</button>
        </div>
        <div class="srv"></div>
        <form class="form" autocomplete="on" novalidate>
          <label>Brugernavn<input type="text" name="username" autocomplete="username" maxlength="16" required autocapitalize="off" spellcheck="false"><span class="hint">3-16 tegn: bogstaver, tal og _</span></label>
          <label>Adgangskode<input type="password" name="password" autocomplete="current-password" maxlength="72" required><span class="hint">Mindst 8 tegn</span></label>
          <label class="confirm">Gentag adgangskode<input type="password" name="password2" autocomplete="new-password" maxlength="72"></label>
          <div class="err" role="alert"></div>
          <div class="row end">
            <button class="btn ghost" type="button" data-back>Tilbage</button>
            <button class="btn primary" type="submit">Log ind</button>
          </div>
        </form>
        <p style="margin-top:12px;font-size:13px">Du kan sagtens spille uden konto. Kontoen bruges kun til venner og ranglisten, som viser din højeste verden.</p>
      </div></div>`);
    const form = $('form', e), errEl = $('.err', e), sub = $('[type=submit]', e);
    const setMode = m => {
      mode = m;
      $$('.tab', e).forEach(b => b.setAttribute('aria-selected', b.dataset.mode === m));
      $('.confirm', e).classList.toggle('hidden', m !== 'register');
      sub.textContent = m === 'register' ? 'Opret konto' : 'Log ind';
      form.password.autocomplete = m === 'register' ? 'new-password' : 'current-password';
      errEl.textContent = '';
    };
    setMode(mode);
    click(e, '.tab', (ev, n) => setMode(n.dataset.mode));
    click(e, '[data-back]', () => show(opts.from === 'social' ? 'social' : 'main'));
    if (!SG.api.available) {
      $('.srv', e).innerHTML = '<div class="notice bad">Online-funktioner er ikke sat op for denne side endnu (se README).</div>';
      sub.disabled = true;
    } else {
      SG.api.health().then(h => {
        if (h.database !== 'connected') $('.srv', e).innerHTML = '<div class="notice bad">Serveren kører, men kan ikke nå databasen lige nu. Prøv igen om lidt.</div>';
      }).catch(err => { $('.srv', e).innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; });
    }
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      SG.audio.unlock();
      const u = form.username.value.trim(), p = form.password.value;
      errEl.textContent = '';
      if (!/^[A-Za-z0-9_æøåÆØÅ]{3,16}$/.test(u)) { errEl.textContent = 'Brugernavnet skal være 3-16 tegn og må kun indeholde bogstaver, tal og _.'; return; }
      if (p.length < 8) { errEl.textContent = 'Adgangskoden skal være mindst 8 tegn.'; return; }
      if (mode === 'register' && p !== form.password2.value) { errEl.textContent = 'De to adgangskoder er ikke ens.'; return; }
      sub.disabled = true;
      sub.textContent = 'Vent …';
      try {
        if (mode === 'register') await SG.auth.register(u, p);
        else await SG.auth.login(u, p);
        SG.audio.sfx('oneup');
        await SG.app.afterLogin();
        toast(mode === 'register' ? `Velkommen, ${u}!` : `Logget ind som ${u}`);
        show(opts.from === 'social' ? 'social' : 'main');
      } catch (err) {
        SG.audio.sfx('error');
        errEl.textContent = err.message;
        sub.disabled = false;
        sub.textContent = mode === 'register' ? 'Opret konto' : 'Log ind';
      }
    });
    return e;
  };

  /* ---------------- Indstillinger ---------------- */
  SCREENS.settings = (opts) => {
    const s = SG.app.settings;
    const e = el(`
      <div class="screen dim"><div class="panel">
        <h2>Indstillinger</h2>
        <div class="set-grid">
          <div class="set-box">
            <h3 style="margin-top:0">Lyd</h3>
            <div class="set-row"><label id="l-music">Musik</label><button class="switch" role="switch" data-k="music" aria-labelledby="l-music"></button></div>
            <div class="set-row"><input type="range" min="0" max="100" data-v="musicVol" aria-label="Musikstyrke"></div>
            <div class="set-row"><label id="l-sfx">Lydeffekter</label><button class="switch" role="switch" data-k="sfx" aria-labelledby="l-sfx"></button></div>
            <div class="set-row"><input type="range" min="0" max="100" data-v="sfxVol" aria-label="Lydeffektstyrke"></div>
            <h3>Visning</h3>
            <div class="set-row"><label id="l-shake">Skærmryst</label><button class="switch" role="switch" data-k="shake" aria-labelledby="l-shake"></button></div>
            <div class="set-row"><label id="l-flash">Mindre blink</label><button class="switch" role="switch" data-k="reduceFlash" aria-labelledby="l-flash"></button></div>
            <div class="set-row"><label>Touchknapper</label>
              <div class="seg" role="group" aria-label="Touchknapper"><button data-touch="auto">Auto</button><button data-touch="on">Til</button><button data-touch="off">Fra</button></div>
            </div>
          </div>
          <div class="set-box">
            <h3 style="margin-top:0">Tastatur</h3>
            <table class="keys"><tbody></tbody></table>
            <div class="row" style="margin-top:10px"><button class="btn small ghost" data-resetkeys>Nulstil taster</button></div>
            <h3>Touch og gamepad</h3>
            <p style="font-size:13px">Touch: ◀ ▶ for at gå, ▼ for at dukke/gå ind i rør, HOP og LØB (LØB skyder også med Energiblomst). Gamepad: venstre stick/D-pad, A = hop, B/X = løb.</p>
            <p style="font-size:13px">Pause: Esc, P eller knappen øverst til højre. Musik starter først, når du har klikket eller trykket på en tast.</p>
          </div>
        </div>
        <div class="row end" style="margin-top:16px"><button class="btn primary" data-back>Færdig</button></div>
      </div></div>`);
    const sync = () => {
      $$('.switch', e).forEach(b => b.setAttribute('aria-checked', !!s[b.dataset.k]));
      $$('[data-v]', e).forEach(r => { r.value = Math.round(s[r.dataset.v] * 100); });
      $$('[data-touch]', e).forEach(b => b.setAttribute('aria-pressed', b.dataset.touch === s.touch));
      const tb = $('.keys tbody', e);
      const keys = SG.input.getKeys();
      tb.innerHTML = '';
      SG.input.ACTIONS.forEach(a => {
        const tr = el(`<tr><td>${SG.input.LABELS[a]}</td><td><span class="kb">${keys[a].map(k => `<kbd>${esc(SG.input.keyName(k))}</kbd>`).join(' ')}</span> <button class="btn small ghost" data-rebind="${a}">Skift</button></td></tr>`);
        tb.appendChild(tr);
      });
      on(tb, '[data-rebind]', 'click', (ev, n) => {
        const a = n.dataset.rebind;
        n.closest('td').querySelector('.kb').innerHTML = '<kbd class="wait">Tryk på en tast …</kbd>';
        n.disabled = true;
        SG.input.rebind(a, k => { s.keys = k; SG.app.saveSettings(); sync(); });
      });
    };
    sync();
    click(e, '.switch', (ev, n) => { s[n.dataset.k] = !s[n.dataset.k]; SG.app.saveSettings(); sync(); });
    on(e, '[data-v]', 'input', (ev, n) => { s[n.dataset.v] = Number(n.value) / 100; SG.app.saveSettings(); });
    on(e, '[data-v]', 'change', () => { SG.audio.sfx('coin'); });
    click(e, '[data-touch]', (ev, n) => { s.touch = n.dataset.touch; SG.app.saveSettings(); sync(); });
    click(e, '[data-resetkeys]', () => { SG.input.resetKeys(); s.keys = SG.input.getKeys(); SG.app.saveSettings(); sync(); });
    click(e, '[data-back]', () => { SG.input.cancelRebind(); opts.from === 'pause' ? show('pause') : show('main'); });
    return e;
  };

  /* ---------------- Pause ---------------- */
  SCREENS.pause = () => {
    const g = SG.app.game;
    const e = el(`
      <div class="screen dim"><div class="panel narrow">
        <h2 style="text-align:center">Pause</h2>
        <p style="text-align:center">Verden ${esc(g.levelId)} · ${esc(SG.levels.name(g.levelId))}</p>
        <div class="pause-list">
          <button class="btn primary" data-a="resume" data-back>Fortsæt</button>
          <button class="btn" data-a="restart">Start banen forfra</button>
          <button class="btn" data-a="settings">Indstillinger</button>
          <button class="btn" data-a="map">Til verdenskort</button>
          <button class="btn ghost" data-a="menu">Til hovedmenu</button>
        </div>
      </div></div>`);
    click(e, '[data-a]', (ev, n) => {
      const a = n.dataset.a;
      if (a === 'resume') SG.app.resume();
      else if (a === 'restart') SG.app.restartLevel();
      else if (a === 'settings') show('settings', { from: 'pause' });
      else if (a === 'map') SG.app.quit('map');
      else SG.app.quit('main');
    });
    return e;
  };

  /* ---------------- Resultat ---------------- */
  SCREENS.results = (o) => {
    const info = o.info;
    const isLastLevel = info.world === 8 && info.index === 4;
    const e = el(`
      <div class="screen dim"><div class="panel mid">
        <h2 class="big-title">${info.index === 4 ? 'Fæstningen er faldet!' : 'Bane gennemført!'}</h2>
        <p class="sub-title">Verden ${esc(info.id)} · ${esc(info.name)}</p>
        <div class="result-grid">
          <div class="stat"><b>${info.timeLeft}</b><span>Tid tilbage</span></div>
          <div class="stat"><b>${info.coins}</b><span>Mønter</span></div>
          <div class="stat"><b>x${SG.app.game.session.lives}</b><span>Liv</span></div>
        </div>
        ${o.unlockText ? `<div class="unlock">${esc(o.unlockText)}</div>` : ''}
        <div class="sync"></div>
        <div class="row center">
          <button class="btn" data-a="map">Til verdenskort</button>
          ${isLastLevel ? '<button class="btn primary" data-a="ending" data-autofocus>Se slutningen</button>' : `<button class="btn primary" data-a="next" data-autofocus>Næste bane ▶</button>`}
        </div>
      </div></div>`);
    click(e, '[data-a]', (ev, n) => {
      const a = n.dataset.a;
      if (a === 'next') SG.app.startLevel(o.next);
      else if (a === 'ending') show('ending');
      else show('map', { world: o.nextWorld || info.world });
    });
    o.onSyncEl && o.onSyncEl($('.sync', e));
    return e;
  };

  /* ---------------- Game over ---------------- */
  SCREENS.gameover = (o) => {
    const e = el(`
      <div class="screen dim"><div class="panel narrow" style="text-align:center">
        <h2 class="big-title" style="color:#ff4d5e">GAME OVER</h2>
        <p>Du løb tør for liv på ${esc(o.levelId)}. Din progression er stadig gemt - prøv igen med 5 nye liv!</p>
        <div class="pause-list">
          <button class="btn primary" data-a="retry">Prøv igen</button>
          <button class="btn" data-a="map">Til verdenskort</button>
          <button class="btn ghost" data-a="menu">Til hovedmenu</button>
        </div>
      </div></div>`);
    click(e, '[data-a]', (ev, n) => {
      const a = n.dataset.a;
      if (a === 'retry') SG.app.retryAfterGameOver();
      else if (a === 'map') show('map');
      else show('main');
    });
    return e;
  };

  /* ---------------- Bane-intro ---------------- */
  SCREENS.intro = (o) => {
    const [w] = o.id.split('-').map(Number);
    const e = el(`
      <div class="screen intro">
        <div class="w">VERDEN ${esc(o.id)}</div>
        <div class="t">${esc(SG.levels.name(o.id))}</div>
        <div class="w" style="font-size:12px">${esc(worldName(w))}</div>
        <div class="lv"><span class="pc"></span> x ${o.lives}</div>
        ${o.note ? `<div class="w" style="font-size:11px;color:#ffc93c">${esc(o.note)}</div>` : ''}
      </div>`);
    $('.pc', e).replaceWith(portraitCanvas(SG.app.charId, 56, 'idle0', true));
    return e;
  };

  /* ---------------- Slutning ---------------- */
  SCREENS.ending = () => {
    const ch = SG.characters.get(SG.app.charId);
    const e = el(`
      <div class="screen dim"><div class="panel mid credits">
        <h2 class="big-title">Tillykke!</h2>
        <p class="sub-title">${esc(ch.name)} har besejret Kaos-Kejseren Grumulus, og der er fred i alle otte verdener.</p>
        <div class="pc" style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap"></div>
        <div class="roll"><div>
          <h4>SUPER GREJS</h4><p>Et originalt platformspil til GrejsAlley</p>
          <h4>HELTE</h4><p>Jones · Langvad · Grejs · Buss · Joe</p><p>Luske · Muggel · Jeppe Gobi · Polly L · Ossy</p>
          <h4>VERDENER</h4><p>Grønne Grejsmarker · Møntminen · Skyhøj · Lava-laboratoriet</p><p>Frostfjeldet · Mørkeskoven · Mekanikkens by · Kaosfæstningen</p>
          <h4>BOSSER</h4><p>Brumle Bulder · Grav-Gustav · Stormfuglen Vindolf · Doktor Magmus</p><p>Iskolossen Frosti · Rodkongen · Tandhjulstyrannen · Kaos-Kejseren Grumulus</p>
          <h4>TAK FORDI DU SPILLEDE</h4><p>Prøv at finde alle hemmelige rum og warp-rør!</p>
        </div></div>
        <div class="row center"><button class="btn" data-a="map">Til verdenskort</button><button class="btn primary" data-a="menu">Til hovedmenu</button></div>
      </div></div>`);
    const pc = $('.pc', e);
    SG.characters.LIST.forEach((c, i) => pc.appendChild(portraitCanvas(c.id, 48, i % 2 ? 'win0' : 'win1')));
    SG.audio.music.play('ending');
    click(e, '[data-a]', (ev, n) => { SG.audio.music.play('title'); n.dataset.a === 'map' ? show('map') : show('main'); });
    return e;
  };

  /* =================================================================
     HUD, toast og bossbar
     ================================================================= */
  let lastHud = {};
  function hud(d) {
    const set = (id, v) => { if (lastHud[id] !== v) { lastHud[id] = v; const n = document.getElementById(id); if (n) n.innerHTML = v; } };
    set('hud-lives', 'x' + d.lives);
    set('hud-coins', '<i class="coin-ico"></i>' + U.pad(d.coins, 2));
    set('hud-time', String(d.time));
    set('hud-world', d.world);
    set('hud-power', d.power ? `<i class="pw ${d.power.cls}"></i>${d.power.text}` : '-');
    const t = document.getElementById('hud-time');
    if (t) t.classList.toggle('hurry', !!d.hurry);
    if (lastHud.charId !== d.charId) {
      lastHud.charId = d.charId;
      SG.characters.portrait(document.getElementById('hud-face'), d.charId, 'idle0', { bust: true });
    }
  }
  function showHud(v) {
    document.getElementById('hud').classList.toggle('hidden', !v);
    if (!v) bossBar(null);
    lastHud = {};
  }
  function toast(msg, ms) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 2400);
  }
  function bossBar(name, frac) {
    const b = document.getElementById('boss-bar');
    if (!name) { b.classList.add('hidden'); return; }
    b.classList.remove('hidden');
    document.getElementById('boss-name').textContent = name;
    document.getElementById('boss-fill').style.width = Math.round(U.clamp(frac, 0, 1) * 100) + '%';
  }

  return { show, hide, toast, hud, showHud, bossBar, get current() { return current; }, el };
})();
