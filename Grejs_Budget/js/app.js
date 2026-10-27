// Grejs Budget – opstart, navigation og fælles tilstand (valgt periode og konto).
// Hver side ligger i js/views/*.js og registrerer sig i GB.views.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util, UI = GB.ui, S = GB.store, A = GB.analytics;
  const { $, $$, esc, icon } = UI;
  GB.views = GB.views || {};

  // [id, url, titel, ikon, sektion, bruger global periode/konto]
  const NAV = [
    ['overview', 'overblik', 'Overblik', 'dashboard', 'Økonomi', true],
    ['transactions', 'transaktioner', 'Transaktioner', 'list', 'Økonomi', true],
    ['insights', 'indsigter', 'Indsigter', 'spark', 'Økonomi', true],
    ['categories', 'kategorier', 'Kategorier', 'tag', 'Økonomi', true],
    ['budgets', 'budgetter', 'Budgetter', 'target', 'Økonomi', false],
    ['compare', 'sammenligning', 'Månedssammenligning', 'chart', 'Økonomi', false],
    ['recurring', 'faste-betalinger', 'Faste betalinger', 'repeat', 'Økonomi', false],
    ['goals', 'maal', 'Mål og opsparing', 'piggy', 'Økonomi', false],
    ['import', 'importer', 'Importér data', 'upload', 'Data', false],
    ['reports', 'rapporter', 'Rapporter', 'file', 'Data', false],
    ['settings', 'indstillinger', 'Indstillinger og privatliv', 'shield', 'Data', false],
  ];
  const BOTTOM = ['overview', 'transactions', 'budgets', 'import'];

  const state = { route: 'overview', params: {}, period: 'this-month', custom: { from: '', to: '' }, account: '' };
  let calc = null;
  let ready = false;

  function rebuildCalc() {
    calc = A.makeCalc(S.data.categories, S.settings.calcRules, (id) => S.byId.transactions.get(id));
    U.setNumberFormat(S.settings.numberFormat);
    return calc;
  }

  // Alt, en side skal bruge for at tegne sig selv.
  function ctx() {
    const today = U.todayISO();
    const all = S.data.transactions;
    const txs = state.account ? all.filter((t) => t.accountId === state.account) : all;
    const dataRange = A.dataRange(txs);
    const range = A.periodRange(state.period, today, state.custom, dataRange);
    const periodTxs = txs.filter((t) => t.date >= range.from && t.date <= range.to);
    return {
      today, all, txs, periodTxs, range, label: A.periodLabel(range), dataRange, calc, settings: S.settings, state,
      accountId: state.account || null,
    };
  }

  // --- Navigation --------------------------------------------------------------

  function routeFromHash() {
    const slug = (location.hash.replace(/^#\/?/, '').split('?')[0] || '').toLowerCase();
    const n = NAV.find((x) => x[1] === slug);
    return n ? n[0] : null;
  }

  function go(route, params) {
    state.params = params || {};
    const n = NAV.find((x) => x[0] === route) || NAV[0];
    const hash = '#/' + n[1];
    if (location.hash !== hash) { state.route = n[0]; history.pushState(null, '', hash); }
    state.route = n[0];
    closeSidebar();
    render(true);
  }

  function renderNav() {
    const counts = badgeCounts();
    let html = '', section = '';
    for (const [id, slug, title, ic, sec] of NAV) {
      if (sec !== section) { html += '<li class="sb-section">' + esc(sec) + '</li>'; section = sec; }
      const b = counts[id];
      html += '<li><a class="sb-link" href="#/' + slug + '"' + (state.route === id ? ' aria-current="page"' : '') + '>' + icon(ic) + '<span>' + esc(title) + '</span>' +
        (b ? '<span class="sb-badge' + (b.warn ? ' warn' : '') + '" title="' + esc(b.title) + '">' + b.n + '</span>' : '') + '</a></li>';
    }
    $('#sbNav').innerHTML = html;
    $('#bottomNav').innerHTML = BOTTOM.map((id) => {
      const n = NAV.find((x) => x[0] === id);
      return '<a href="#/' + n[1] + '"' + (state.route === id ? ' aria-current="page"' : '') + '>' + icon(n[3]) + '<span>' + esc(n[2].split(' ')[0]) + '</span></a>';
    }).join('') + '<button type="button" id="moreBtn" aria-label="Flere sider">' + icon('menu') + '<span>Mere</span></button>';
    $('#moreBtn').addEventListener('click', openSidebar);
  }

  function badgeCounts() {
    const out = {};
    const review = S.data.transactions.filter((t) => t.needsReview || t.categorySource === 'suggested' || t.categorySource === 'unknown').length;
    if (review) out.transactions = { n: review > 999 ? '999+' : review, warn: true, title: review + ' transaktioner skal kontrolleres' };
    return out;
  }

  function openSidebar() { $('#sidebar').classList.add('open'); $('#sbOverlay').classList.add('open'); const f = $('#sidebar .sb-link'); if (f) f.focus(); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sbOverlay').classList.remove('open'); }

  // --- Topbar: periode og konto ------------------------------------------------

  function renderFilters(show) {
    const box = $('#tbFilters');
    box.hidden = !show;
    if (!show) return;
    const periods = A.PERIODS.map(([v, l]) => [v, l]);
    box.innerHTML =
      '<label class="sr-only" for="periodSel">Periode</label><select id="periodSel">' + UI.options(periods, state.period) + '</select>' +
      '<span class="tb-custom"' + (state.period === 'custom' ? '' : ' hidden') + '><label class="sr-only" for="cFrom">Fra</label><input type="date" id="cFrom" value="' + esc(state.custom.from) + '"><span class="muted">–</span><label class="sr-only" for="cTo">Til</label><input type="date" id="cTo" value="' + esc(state.custom.to) + '"></span>' +
      (S.data.accounts.length > 1 ? '<label class="sr-only" for="accountSel">Konto</label><select id="accountSel">' + UI.accountOptions(state.account, 'Alle konti') + '</select>' : '');
    $('#periodSel').addEventListener('change', (e) => {
      state.period = e.target.value;
      if (state.period === 'custom' && !state.custom.from) {
        const c = ctx();
        state.custom = { from: c.range.from, to: c.range.to };
      }
      render();
    });
    const onCustom = () => { state.custom = { from: $('#cFrom').value, to: $('#cTo').value }; if (U.isValidISO(state.custom.from) && U.isValidISO(state.custom.to)) render(); };
    if ($('#cFrom')) { $('#cFrom').addEventListener('change', onCustom); $('#cTo').addEventListener('change', onCustom); }
    if ($('#accountSel')) $('#accountSel').addEventListener('change', (e) => { state.account = e.target.value; render(); });
  }

  // --- Tegning -----------------------------------------------------------------

  function render(focus) {
    if (!ready) return;
    const n = NAV.find((x) => x[0] === state.route) || NAV[0];
    const view = GB.views[n[0]];
    $('#pageTitle').textContent = n[2];
    document.title = n[2] + ' – Grejs Budget';
    renderNav();
    renderFilters(n[5]);
    // Hver visning får en ny container, så gamle event listeners forsvinder med den.
    const host = $('#view');
    const scrollY = window.scrollY;
    const root = document.createElement('div');
    if (focus) { host.style.animation = 'none'; void host.offsetWidth; host.style.animation = ''; }
    try {
      host.replaceChildren(root);
      if (view) view.render(root, ctx());
      else root.innerHTML = UI.empty('alert', 'Siden findes ikke', '');
    } catch (e) {
      console.error(e);
      root.innerHTML = '<div class="banner error">' + icon('alert') + '<span>Der opstod en fejl ved visning af siden: ' + esc(e.message) + '</span></div>';
    }
    if (focus) { host.focus({ preventScroll: true }); window.scrollTo(0, 0); } else window.scrollTo(0, scrollY);
  }

  // Kaldes efter enhver ændring af data.
  function refresh() { rebuildCalc(); render(); }

  // --- Status, bannere og opdateringer -----------------------------------------

  function banner(id, kind, html, buttons) {
    let el = document.getElementById(id);
    if (!html) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = id; $('#banners').appendChild(el); }
    el.className = 'banner ' + kind;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.innerHTML = icon(kind === 'info' ? 'info' : 'alert') + '<span>' + html + '</span>' + (buttons || []).map((b, i) => '<button type="button" class="btn sm" data-b="' + i + '">' + esc(b.label) + '</button>').join('');
    (buttons || []).forEach((b, i) => el.querySelector('[data-b="' + i + '"]').addEventListener('click', b.onClick));
  }

  function updateStatus(kind) {
    const pill = $('#savePill');
    if (S.backend !== 'indexeddb') { pill.className = 'status-pill err'; pill.innerHTML = '<span class="dot"></span><span class="lbl">Gemmes ikke</span>'; pill.title = 'Data gemmes ikke – se beskeden øverst'; return; }
    if (S.failed) { pill.className = 'status-pill err'; pill.innerHTML = '<span class="dot"></span><span class="lbl">Ikke gemt</span>'; return; }
    if (kind === 'saving' || S.pending) { pill.className = 'status-pill'; pill.innerHTML = '<span class="dot"></span><span class="lbl">Gemmer …</span>'; return; }
    pill.className = 'status-pill ok'; pill.innerHTML = icon('lock') + '<span class="lbl">Gemt lokalt</span>'; pill.title = 'Alle data er gemt i denne browser på denne enhed';
  }
  function updateNet() {
    $('#netPill').hidden = navigator.onLine;
  }

  let userAskedUpdate = false;
  function registerSW() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      const waiting = (w) => banner('updBanner', 'info', 'En ny version af Grejs Budget er klar. Dine data bevares.', [{ label: 'Opdatér nu', onClick: () => { userAskedUpdate = true; w.postMessage({ type: 'SKIP_WAITING' }); } }]);
      if (reg.waiting && navigator.serviceWorker.controller) waiting(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) waiting(w); });
      });
    }).catch((e) => console.warn('Service worker kunne ikke registreres', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (userAskedUpdate && !S.pending) location.reload(); });
  }

  async function init() {
    UI.initTooltips();
    S.on((type, detail) => {
      if (type === 'error') {
        banner('storeBanner', 'error', esc(detail.message) + (S.backend === 'indexeddb' ? ' Luk ikke fanen, før problemet er løst – ændringer kan ellers gå tabt.' : ' Indtil det er løst, gemmes intet, når siden lukkes. Eksportér en sikkerhedskopi, hvis du laver ændringer.'),
          S.backend === 'indexeddb' ? [{ label: 'Download sikkerhedskopi', onClick: () => GB.actions.downloadBackup() }] : null);
      }
      if (type === 'recovered') banner('storeBanner');
      if (type === 'external-change') banner('extBanner', 'info', 'Data er ændret i en anden fane med Grejs Budget.', [{ label: 'Genindlæs', onClick: () => location.reload() }]);
      updateStatus(type);
    });
    await S.init();
    if (!S.data.categories.length) await S.put('categories', GB.categories.defaultCategories()).catch(() => {});
    state.period = S.settings.defaultPeriod || 'this-month';
    state.account = S.settings.defaultAccount && S.settings.defaultAccount !== 'all' && S.byId.accounts.has(S.settings.defaultAccount) ? S.settings.defaultAccount : '';
    GB.theme.apply(S.settings.theme);
    rebuildCalc();
    state.route = routeFromHash() || 'overview';
    ready = true;
    updateStatus();
    updateNet();
    render(false);

    window.addEventListener('hashchange', () => { const r = routeFromHash(); if (r && r !== state.route) { state.route = r; state.params = {}; closeSidebar(); render(true); } });
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    window.addEventListener('beforeunload', (e) => { if (S.pending || S.failed) { e.preventDefault(); e.returnValue = ''; } });
    $('#menuBtn').addEventListener('click', openSidebar);
    $('#sbOverlay').addEventListener('click', closeSidebar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#sidebar').classList.contains('open')) closeSidebar(); });
    $('#sbNav').addEventListener('click', (e) => { if (e.target.closest('a')) closeSidebar(); });
    registerSW();
  }

  GB.app = {
    NAV, state, ctx, go, render, refresh, rebuildCalc, banner,
    get calc() { return calc; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
