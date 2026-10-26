// Indstillinger og privatliv: visning, beregningsregler, konti, sikkerhedskopi, lagring og sletning.

(function () {
  'use strict';
  const GB = globalThis.GB;
  const U = GB.util, UI = GB.ui, S = GB.store, A = GB.actions;
  const { $, $$, esc, icon } = UI;
  const fail = (e) => UI.toast(e.message, 'error');

  function render(root, c) {
    const s = S.settings;
    const sc = A.sampleCounts();
    const r = s.calcRules;
    const accCounts = new Map();
    for (const t of S.data.transactions) accCounts.set(t.accountId, (accCounts.get(t.accountId) || 0) + 1);
    const sw = 'serviceWorker' in navigator && window.isSecureContext;

    root.innerHTML = '<div class="grid grid-2">' +
      // Udseende og visning
      '<section class="card"><div class="card-head"><h2>' + icon('eye') + 'Udseende og visning</h2></div><div class="stack" style="gap:14px">' +
      '<div class="field"><span style="font-size:13.5px;font-weight:600;color:var(--text-2)" id="thL">Tema</span><div class="seg" role="group" aria-labelledby="thL">' +
      [['system', 'Følg systemet'], ['light', 'Lyst'], ['dark', 'Mørkt']].map(([k, l]) => '<button type="button" data-theme-set="' + k + '" aria-pressed="' + (s.theme === k) + '">' + esc(l) + '</button>').join('') + '</div></div>' +
      '<div class="fields"><div class="field"><label for="sPeriod">Standardperiode på overblikket</label><select id="sPeriod">' + UI.options(GB.analytics.PERIODS.filter((p) => p[0] !== 'custom'), s.defaultPeriod) + '</select></div>' +
      '<div class="field"><label for="sAcc">Start med konto</label><select id="sAcc">' + UI.options([['all', 'Alle konti']], s.defaultAccount) + UI.accountOptions(s.defaultAccount) + '</select></div>' +
      '<div class="field"><label for="sFmt">Talformat</label><select id="sFmt">' + UI.options([['da', '1.234,56 kr.'], ['da-nogroup', '1234,56 kr.'], ['en', '1,234.56 DKK']], s.numberFormat) + '</select></div>' +
      '<div class="field"><label for="sPage">Transaktioner pr. side</label><select id="sPage">' + UI.options([['50', '50'], ['100', '100'], ['250', '250'], ['500', '500']], String(s.pageSize)) + '</select></div></div></div></section>' +

      // Beregninger
      '<section class="card"><div class="card-head"><h2>' + icon('chart') + 'Beregningsregler</h2></div><p class="small muted">Reglerne gælder ens overalt: overblik, budgetter, sammenligning og rapporter.</p><div class="stack" style="gap:10px">' +
      '<label class="check"><input type="checkbox" data-rule="refundsOffset"' + (r.refundsOffset ? ' checked' : '') + '> <span>Træk refusioner fra forbruget i kategorien <span class="small muted">(ellers tælles de som indtægt)</span></span></label>' +
      '<label class="check"><input type="checkbox" data-rule="cashAsExpense"' + (r.cashAsExpense ? ' checked' : '') + '> <span>Tæl kontanthævninger som forbrug <span class="small muted">(ellers som overførsel)</span></span></label>' +
      '<label class="check"><input type="checkbox" data-rule="savingsAsExpense"' + (r.savingsAsExpense ? ' checked' : '') + '> <span>Tæl opsparing og investering som forbrug <span class="small muted">(standard: vises for sig)</span></span></label>' +
      '<p class="small muted">Interne overførsler og betaling af kreditkort tæller aldrig som indtægt eller forbrug, så kortkøb ikke dobbelttælles.</p></div>' +
      '<hr><h3>Budgetadvarsler</h3><div class="fields mt-s"><div class="field"><label for="sNotice">"Hold øje" fra (%)</label><input type="number" id="sNotice" min="1" max="99" value="' + esc(s.thresholds.notice) + '"></div>' +
      '<div class="field"><label for="sWarn">"Tæt på grænsen" fra (%)</label><input type="number" id="sWarn" min="1" max="100" value="' + esc(s.thresholds.warn) + '"></div></div>' +
      '<hr><h3>Kategorisering</h3><label class="check mt-s"><input type="checkbox" id="sAsk"' + (s.askRuleOnCategoryChange ? ' checked' : '') + '> Spørg, om der skal laves en regel, når jeg ændrer en kategori</label>' +
      '<p class="mt-s"><a href="#/kategorier">Kategorier og regler</a></p></section></div>' +

      // Konti
      '<section class="card mt"><div class="card-head"><h2>' + icon('wallet') + 'Konti</h2><button type="button" class="btn sm" data-act="new-acc">' + icon('plus') + 'Ny konto</button></div>' +
      (S.data.accounts.length ? '<ul class="list">' + S.data.accounts.map((a) => '<li><span class="cat-icon" style="background:var(--brand-navy)">' + icon('wallet') + '</span><div class="grow"><div class="title">' + esc(a.name) + (a.isSample ? ' <span class="badge">eksempel</span>' : '') + '</div><div class="meta">' + esc((A.ACCOUNT_TYPES.find((x) => x[0] === a.type) || [, 'Konto'])[1]) + (a.bank ? ' · ' + esc(a.bank) : '') + ' · ' + esc(a.currency || 'DKK') + ' · ' + (accCounts.get(a.id) || 0) + ' transaktioner</div></div>' +
        '<button type="button" class="btn sm ghost icon-only" data-edit-acc="' + esc(a.id) + '" aria-label="Redigér ' + esc(a.name) + '">' + icon('edit') + '</button><button type="button" class="btn sm ghost icon-only" data-del-acc="' + esc(a.id) + '" aria-label="Slet ' + esc(a.name) + '">' + icon('trash') + '</button></li>').join('') + '</ul>' : '<p class="muted">Ingen konti endnu. De oprettes, når du importerer.</p>') + '</section>' +

      // Sikkerhedskopi
      '<div class="grid grid-2 mt"><section class="card"><div class="card-head"><h2>' + icon('database') + 'Sikkerhedskopi</h2></div>' +
      '<p>En sikkerhedskopi er én JSON-fil med <b>alle</b> dine data: transaktioner, kategorier, regler, budgetter, konti, mål, faste betalinger og indstillinger. Brug den til at flytte Grejs Budget til en anden computer, telefon eller browser – eller hvis browserdata bliver ryddet.</p>' +
      '<p class="small muted">' + (s.lastBackupAt ? 'Seneste sikkerhedskopi hentet ' + esc(new Date(s.lastBackupAt).toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' })) + '.' : 'Du har ikke hentet en sikkerhedskopi endnu.') + '</p>' +
      '<div class="row"><button type="button" class="btn primary" data-act="backup">' + icon('download') + 'Hent sikkerhedskopi</button><label class="btn" for="restoreFile" tabindex="0" id="restoreLbl">' + icon('upload') + 'Gendan fra fil</label><input type="file" id="restoreFile" accept=".json,application/json" class="sr-only"></div></section>' +

      // Eksempeldata
      '<section class="card"><div class="card-head"><h2>' + icon('spark') + 'Eksempeldata</h2></div>' +
      '<p>Opdigtede transaktioner, så du kan prøve alle funktioner. Ingen rigtige personer eller bankdata.</p>' +
      (sc.any ? '<p class="small muted">' + sc.txs + ' eksempeltransaktioner er indlæst.</p><button type="button" class="btn danger" data-act="clear-sample">' + icon('trash') + 'Fjern eksempeldata</button>' : '<button type="button" class="btn" data-act="sample">' + icon('spark') + 'Indlæs eksempeldata</button>') +
      '<p class="small muted mt">Der ligger også eksempelfiler i mappen <span class="mono">eksempeldata/</span>, som du kan importere for at prøve importguiden.</p></section></div>' +

      // Lagring og privatliv
      '<section class="card mt"><div class="card-head"><h2>' + icon('shield') + 'Datalagring og privatliv</h2></div><div class="grid grid-2">' +
      '<div><ul class="feature-list" style="margin:0">' +
      '<li style="color:var(--text)">' + icon('lock') + '<span>Alle data gemmes <b>kun i denne browser på denne enhed</b> (IndexedDB). Intet sendes til en server, og der er ingen login, sporing, reklamer eller analyseværktøjer.</span></li>' +
      '<li style="color:var(--text)">' + icon('bank') + '<span>Grejs Budget forbinder sig ikke til din bank og beder aldrig om adgangskoder, MitID eller kortoplysninger.</span></li>' +
      '<li style="color:var(--text)">' + icon('swap') + '<span>Data synkroniseres <b>ikke</b> mellem enheder eller browsere. Flyt dem med en sikkerhedskopi.</span></li>' +
      '<li style="color:var(--text)">' + icon('alert') + '<span>Rydder du browserdata, bruger privat browsing eller afinstallerer browseren, forsvinder dataene. Hent derfor en sikkerhedskopi jævnligt.</span></li>' +
      '<li style="color:var(--text)">' + icon('alert') + '<span><b>Safari (Mac, iPhone og iPad):</b> Safari kan slette data fra hjemmesider, der ikke har været brugt i 7 dage. Undgå det ved at tilføje Grejs Budget til Dock (Mac: Arkiv → Føj til Dock) eller til hjemmeskærmen (iPhone/iPad: Del → Føj til hjemmeskærm), og hent sikkerhedskopier.</span></li>' +
      '<li style="color:var(--text)">' + icon('wifi-off') + '<span>' + (sw ? 'Appen virker offline, når den først er indlæst. Opdateringer installeres først, når du vælger det, og dine data bevares.' : 'Offline-funktionen kræver, at siden åbnes via https eller localhost (ikke som en lokal fil). Selve appen virker dog stadig.') + '</span></li>' +
      '</ul></div><div id="storageInfo" class="note">' + icon('database') + '<div>Henter lagerstatus …</div></div></div></section>' +

      // Slet alt
      '<section class="card mt" style="border-color:color-mix(in srgb,var(--danger) 35%,transparent)"><div class="card-head"><h2 style="color:var(--danger)">' + icon('trash') + 'Slet alle data</h2></div>' +
      '<p>Sletter alt, hvad Grejs Budget har gemt i denne browser. Det kan ikke fortrydes uden en sikkerhedskopi.</p><button type="button" class="btn danger" data-act="delete-all">' + icon('trash') + 'Slet alle data …</button></section>' +
      '<p class="small muted mt" style="text-align:center">Grejs Budget · datamodel version ' + S.SCHEMA + '</p>';

    bind(root);
    storageInfo(root);
  }

  async function storageInfo(root) {
    const est = await S.estimate();
    const box = $('#storageInfo', root);
    if (!box) return;
    const mb = (b) => (b == null ? '?' : U.fmtNumber(b / 1048576, 1));
    box.innerHTML = icon('database') + '<div><p><b>Lager: ' + (S.backend === 'indexeddb' ? 'IndexedDB i denne browser' : 'Midlertidigt (gemmes ikke!)') + '</b></p>' +
      '<p class="small">' + U.fmtNumber(S.data.transactions.length) + ' transaktioner, ' + S.data.accounts.length + ' konti, ' + S.data.rules.length + ' regler, ' + S.data.budgets.length + ' månedsbudgetter, ' + S.data.goals.length + ' mål.' +
      (est.usage != null ? ' Bruger ca. ' + mb(est.usage) + ' MB' + (est.quota ? ' af ' + mb(est.quota) + ' MB tilgængeligt' : '') + '.' : '') + '</p>' +
      '<p class="small">' + (est.persisted ? 'Browseren har lovet ikke at rydde dataene automatisk.' : 'Browseren kan rydde dataene, hvis enheden mangler plads.') + '</p>' +
      (!est.persisted && navigator.storage && navigator.storage.persist ? '<button type="button" class="btn sm" id="persistBtn">Bed browseren om at beholde data</button>' : '') + '</div>';
    const pb = $('#persistBtn', box);
    if (pb) pb.addEventListener('click', async () => { const ok = await S.requestPersist(); UI.toast(ok ? 'Browseren beholder nu dataene' : 'Browseren afviste – hent sikkerhedskopier jævnligt', ok ? '' : 'warn'); storageInfo(root); });
  }

  function bind(root) {
    const save = (patch, msg) => S.saveSettings(patch).then(() => { if (msg) UI.toast(msg); GB.app.refresh(); }).catch(fail);
    $$('[data-theme-set]', root).forEach((b) => b.addEventListener('click', () => { GB.theme.apply(b.dataset.themeSet); save({ theme: b.dataset.themeSet }); }));
    $('#sPeriod', root).addEventListener('change', (e) => { GB.app.state.period = e.target.value; save({ defaultPeriod: e.target.value }, 'Gemt'); });
    $('#sAcc', root).addEventListener('change', (e) => save({ defaultAccount: e.target.value }, 'Gemt'));
    $('#sFmt', root).addEventListener('change', (e) => save({ numberFormat: e.target.value }, 'Gemt'));
    $('#sPage', root).addEventListener('change', (e) => save({ pageSize: +e.target.value }, 'Gemt'));
    $$('[data-rule]', root).forEach((x) => x.addEventListener('change', () => save({ calcRules: Object.assign({}, S.settings.calcRules, { [x.dataset.rule]: x.checked }) }, 'Beregningsreglen er ændret')));
    const th = () => {
      const n = Math.max(1, Math.min(99, parseInt($('#sNotice', root).value, 10) || 70));
      const w = Math.max(n, Math.min(100, parseInt($('#sWarn', root).value, 10) || 90));
      save({ thresholds: { notice: n, warn: w } }, 'Gemt');
    };
    $('#sNotice', root).addEventListener('change', th);
    $('#sWarn', root).addEventListener('change', th);
    $('#sAsk', root).addEventListener('change', (e) => save({ askRuleOnCategoryChange: e.target.checked }));
    $('#restoreLbl', root).addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#restoreFile', root).click(); } });
    $('#restoreFile', root).addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(f); });

    root.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'backup') A.downloadBackup();
      if (act === 'sample') A.loadSample();
      if (act === 'clear-sample') A.clearSample();
      if (act === 'new-acc') { if (await A.accountDialog()) GB.app.refresh(); }
      if (act === 'delete-all') deleteAll();
      if (b.dataset.editAcc) { if (await A.accountDialog(S.byId.accounts.get(b.dataset.editAcc))) GB.app.refresh(); }
      if (b.dataset.delAcc) deleteAccount(b.dataset.delAcc);
    });
  }

  async function deleteAccount(id) {
    const a = S.byId.accounts.get(id);
    const txs = S.data.transactions.filter((t) => t.accountId === id).map((t) => t.id);
    const batches = S.data.batches.filter((b) => b.accountId === id).map((b) => b.id);
    const ok = await UI.confirm({ title: 'Slet konto', html: 'Kontoen <b>' + esc(a.name) + '</b>' + (txs.length ? ' og dens <b>' + txs.length + '</b> transaktioner' : '') + ' slettes permanent.', confirmLabel: 'Slet konto', danger: true });
    if (!ok) return;
    await S.batch([{ store: 'transactions', remove: txs }, { store: 'batches', remove: batches }, { store: 'accounts', remove: [id] }]).catch(fail);
    if (GB.app.state.account === id) GB.app.state.account = '';
    if (S.settings.defaultAccount === id) await S.saveSettings({ defaultAccount: 'all' }).catch(() => {});
    UI.toast('Kontoen er slettet');
    GB.app.refresh();
  }

  function describeCounts(counts) {
    const n = (k) => counts[k] || 0;
    return '<ul class="history">' +
      '<li>' + n('transactions') + ' transaktioner</li><li>' + n('accounts') + ' konti</li><li>' + n('categories') + ' kategorier</li><li>' + n('rules') + ' egne regler</li>' +
      '<li>' + n('budgets') + ' månedsbudgetter og ' + n('periodBudgets') + ' periodebudgetter</li><li>' + n('recurring') + ' faste betalinger</li><li>' + n('goals') + ' mål</li><li>' + n('batches') + ' poster i importhistorikken</li></ul>';
  }
  const currentCounts = () => Object.fromEntries(S.STORES.map((s) => [s, S.data[s].length]));

  async function restore(file) {
    let obj;
    try { obj = JSON.parse(await file.text()); } catch (e) { UI.toast('Filen er ikke gyldig JSON og kan ikke gendannes', 'error'); return; }
    const v = GB.exporter.validateBackup(obj, S);
    if (!v.ok) {
      await UI.dialog({ title: 'Sikkerhedskopien kan ikke bruges', body: '<p>Intet er ændret. Problemer:</p><ul class="history">' + v.errors.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' });
      return;
    }
    const hasData = S.data.transactions.length || S.data.accounts.length;
    const choice = await UI.dialog({
      title: 'Gendan sikkerhedskopi', wide: true,
      body: '<p>Sikkerhedskopien er lavet ' + esc(v.exportedAt ? new Date(v.exportedAt).toLocaleString('da-DK', { dateStyle: 'medium', timeStyle: 'short' }) : 'på et ukendt tidspunkt') + ' og indeholder:</p>' + describeCounts(v.counts) +
        (v.warnings.length ? '<p class="small muted">' + v.warnings.map(esc).join('<br>') + '</p>' : '') +
        (hasData ? '<div class="note warn mt">' + icon('alert') + '<div><p><b>Gendannelse erstatter alle dine nuværende data</b>, som er:</p>' + describeCounts(currentCounts()) + '<p>Hent en sikkerhedskopi af dem først, hvis du vil kunne fortryde.</p></div></div>' : ''),
      actions: [{ label: 'Annullér', value: null }].concat(hasData ? [{ label: 'Hent nuværende data først', onClick: () => { A.downloadBackup(); return false; } }] : []).concat([{ label: 'Erstat og gendan', danger: true, value: 'go' }]),
    });
    if (choice !== 'go') return;
    try {
      const data = obj.data;
      if (obj.schema < S.SCHEMA) S.runMigrations(data, obj.schema);
      await S.replaceAll(data, obj.settings);
      if (!S.data.categories.length) await S.put('categories', GB.categories.defaultCategories());
      GB.theme.apply(S.settings.theme);
      GB.app.state.account = '';
      UI.toast('Sikkerhedskopien er gendannet');
      GB.app.refresh();
    } catch (e) { fail(e); }
  }

  async function deleteAll() {
    const v = await UI.dialog({
      title: 'Slet alle data',
      body: '<p>Følgende slettes permanent fra denne browser:</p>' + describeCounts(currentCounts()) + '<p>Desuden nulstilles alle indstillinger. Bankfiler på din computer og sikkerhedskopier, du har hentet, røres ikke.</p>' +
        '<div class="field mt"><label for="delConfirm">Skriv <b>SLET</b> for at bekræfte</label><input type="text" id="delConfirm" autocomplete="off"></div>',
      actions: [{ label: 'Annullér', value: null }, { label: 'Hent sikkerhedskopi først', onClick: () => { A.downloadBackup(); return false; } },
        { label: 'Slet alt', danger: true, onClick: (dlg) => { if ($('#delConfirm', dlg).value.trim().toUpperCase() !== 'SLET') { UI.toast('Skriv SLET for at bekræfte', 'warn'); return false; } return 'go'; } }],
    });
    if (v !== 'go') return;
    try {
      await S.replaceAll({}, {});
      await S.put('categories', GB.categories.defaultCategories());
      GB.theme.apply('system');
      Object.assign(GB.app.state, { account: '', period: 'this-month' });
      UI.toast('Alle data er slettet');
      GB.app.go('overview');
      GB.app.refresh();
    } catch (e) { fail(e); }
  }

  GB.views.settings = { render };
})();
