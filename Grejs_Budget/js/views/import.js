// Importguide i 6 trin: filer → konto → kolonner → kontrol → dubletter → bekræft.
// Data gemmes først, når brugeren bekræfter i sidste trin – og så samlet (alt eller intet).

(function () {
  'use strict';
  const GB = globalThis.GB;
  const U = GB.util, UI = GB.ui, S = GB.store, I = GB.importer, T = GB.tx, C = GB.categories;
  const { $, $$, esc, icon } = UI;

  const STEPS = ['Vælg filer', 'Konto', 'Kolonner', 'Kontrol', 'Dubletter', 'Bekræft'];
  const ACCEPT = '.csv,.txt,.tsv,.xlsx,.ofx,.qfx,.qif,.pdf,application/pdf';
  const MAX_SIZE = 30 * 1024 * 1024;
  let imp = fresh();

  function fresh() { return { step: 1, files: [], accountId: '', perFile: false, active: 0, busy: false, done: null }; }
  const okFiles = () => imp.files.filter((f) => f.status === 'ok');
  const fmtSize = (b) => (b < 1024 ? b + ' B' : b < 1048576 ? U.fmtNumber(b / 1024, 0) + ' kB' : U.fmtNumber(b / 1048576, 1) + ' MB');

  function render(root, c) {
    let html = '';
    if (imp.done) html = doneView();
    else {
      html += '<ol class="stepper" aria-label="Trin i importen">' + STEPS.map((s, i) => '<li class="' + (i + 1 < imp.step ? 'done' : '') + '"' + (i + 1 === imp.step ? ' aria-current="step"' : '') + '>' + esc(s) + '</li>').join('') + '</ol>';
      html += '<div class="card">' + [null, step1, step2, step3, step4, step5, step6][imp.step](c) + '</div>';
    }
    if (imp.done) html += coverageView(c, [...new Set(imp.done.batches.map((x) => x.accountId))]);
    else if (imp.step === 1) html += coverageView(c, null) + historyView();
    if (imp.step === 2 && !imp.done) {
      const chosen = [...new Set(okFiles().map(accountOf).filter(Boolean))];
      if (chosen.length) html += coverageView(c, chosen);
    }
    root.innerHTML = html;
    bind(root, c);
  }

  // --- Måneder med data --------------------------------------------------------

  const COV = {
    full: { label: 'Importeret', icon: 'check' },
    partial: { label: 'Delvis', icon: 'alert' },
    none: { label: 'Mangler', icon: 'plus' },
    future: { label: 'Ikke begyndt', icon: '' },
  };

  // Hele kalenderår fra de ældste data (højst 4 år tilbage) til og med i år.
  function coverageMonths(today) {
    const range = GB.analytics.dataRange(S.data.transactions);
    const y = +today.slice(0, 4);
    const first = Math.max(y - 3, range.from ? Math.min(y, +range.from.slice(0, 4)) : y);
    return U.monthRange(first + '-01', y + '-12');
  }

  function covTitle(x) {
    const m = U.capitalize(U.fmtMonth(x.month));
    const span = x.from ? U.fmtDate(x.from, { short: true, noYear: true }) + ' – ' + U.fmtDate(x.to, { short: true, noYear: true }) : '';
    if (x.status === 'full') return m + ': importeret' + (x.current ? ' indtil i dag' : '') + ' – ' + x.txCount + ' transaktioner (' + span + ')';
    if (x.status === 'partial') return m + ': delvis – data fra ' + span + ', ca. ' + x.missingDays + ' dage mangler. Importér hele måneden; det, du allerede har, springes over som dubletter.';
    if (x.status === 'none') return m + ': ingen data – kan importeres';
    return m + ': måneden er ikke begyndt';
  }

  function coverageView(c, accountIds) {
    const accs = S.data.accounts.filter((a) => !accountIds || accountIds.includes(a.id));
    if (!accs.length) return '';
    const months = coverageMonths(c.today);
    let html = '<section class="card mt" id="coverage"><div class="card-head"><h2>' + icon('calendar') + 'Måneder med data</h2><span class="sub">' + (accountIds ? 'For den valgte konto' : 'Hvad du har importeret – og hvad du mangler') + '</span></div>' +
      '<div class="legend" style="margin:0 0 12px">' + ['full', 'partial', 'none'].map((s) => '<span><span class="cov-cell ' + s + ' cov-key">' + icon(COV[s].icon) + '</span>' + esc(COV[s].label) + (s === 'none' ? ' – kan importeres' : s === 'partial' ? ' – kan fyldes ud' : '') + '</span>').join('') + '</div>';
    for (const a of accs) {
      const cov = GB.analytics.accountCoverage(S.data.transactions, S.data.batches, a.id, months, c.today);
      const withData = cov.filter((x) => x.status === 'full' || x.status === 'partial');
      const firstData = withData.length ? withData[0].month : null;
      const gaps = firstData ? cov.filter((x) => x.month > firstData && (x.status === 'none' || x.status === 'partial')) : [];
      let summary;
      if (!firstData) summary = 'Ingen data endnu – alle måneder kan importeres.';
      else {
        const lastData = withData[withData.length - 1].month;
        summary = 'Data fra ' + U.fmtMonth(firstData) + ' til ' + U.fmtMonth(lastData) + '. ' +
          (gaps.length ? 'Mangler eller er delvise: ' + gaps.slice(0, 8).map((x) => U.fmtMonth(x.month, true) + (x.status === 'partial' ? ' (delvis)' : '')).join(', ') + (gaps.length > 8 ? ' og ' + (gaps.length - 8) + ' flere' : '') + '.' : 'Ingen huller i perioden.');
      }
      const years = [...new Set(months.map((m) => m.slice(0, 4)))];
      html += '<div class="cov-acc"><div class="row between"><h3>' + esc(a.name) + (a.isSample ? ' <span class="badge">eksempel</span>' : '') + '</h3><span class="small muted">' + esc(summary) + '</span></div>' +
        years.map((y) => '<div class="cov-year"><span class="cov-yl">' + y + '</span>' + cov.filter((x) => x.month.startsWith(y)).map((x) => {
          const t = covTitle(x);
          return '<button type="button" class="cov-cell ' + x.status + '" data-cov-acc="' + esc(a.id) + '" data-cov-month="' + x.month + '" data-status="' + x.status + '" title="' + esc(t) + '" aria-label="' + esc(t) + '"' + (x.status === 'future' ? ' disabled' : '') + '>' +
            '<span class="cov-m">' + esc(U.MONTHS_SHORT[+x.month.slice(5, 7) - 1].replace('.', '')) + '</span>' + (COV[x.status].icon ? icon(COV[x.status].icon) : '') + '</button>';
        }).join('') + '</div>').join('') + '</div>';
    }
    return html + '<p class="small muted mt-s">Klik på en måned med data for at se transaktionerne. Det er helt i orden at importere en fil, der overlapper – det, du allerede har, springes over som dubletter.</p></section>';
  }

  // Hvilke måneder dækker en fil – og er de nye eller allerede importeret på kontoen?
  function fileMonths(f, c) {
    const acc = accountOf(f);
    const counts = new Map();
    for (const r of f.result.rows) counts.set(U.monthKey(r.date), (counts.get(U.monthKey(r.date)) || 0) + 1);
    const months = [...counts.keys()].sort();
    if (!months.length) return '';
    const cov = GB.analytics.accountCoverage(S.data.transactions, S.data.batches, acc, months, c.today);
    const LABEL = { none: 'ny måned', partial: 'delvis – resten fyldes ud', full: 'allerede importeret – dubletter springes over', future: 'i fremtiden?' };
    const cls = { none: 'none', partial: 'partial', full: 'full', future: 'future' };
    return '<p class="small mt-s" style="margin-bottom:6px"><b>Måneder i filen</b> sammenlignet med det, du har på ' + esc(UI.accountName(acc)) + ':</p><div class="row" style="gap:6px">' +
      cov.map((x) => '<span class="cov-chip ' + cls[x.status] + '">' + (COV[x.status].icon ? icon(COV[x.status].icon) : '') + esc(U.capitalize(U.fmtMonth(x.month, true))) + ': ' + esc(LABEL[x.status]) + ' <span class="muted">(' + counts.get(x.month) + ')</span></span>').join('') + '</div>';
  }

  // --- Trin 1: filer -----------------------------------------------------------

  function step1() {
    return '<h2>Vælg bankfiler</h2><p class="muted">Hent dine posteringer i netbanken som <b>CSV</b> (eller Excel/XLSX, PDF, OFX, QIF). Du kan vælge flere filer og flere måneder på én gang – også <b>et helt år i én fil</b>, og også filer, der overlapper. Hver transaktion placeres automatisk i den måned, den har dato i, og dubletter findes automatisk.</p>' +
      '<label class="dropzone mt" id="drop" tabindex="0">' + icon('upload') + '<h3>Træk filer hertil, eller klik for at vælge</h3><span class="small muted">CSV, TXT, XLSX, PDF, OFX, QFX og QIF · filerne læses kun i din browser</span>' +
      '<input type="file" id="fileInput" multiple accept="' + ACCEPT + '" class="sr-only"></label>' +
      (imp.files.length ? '<div class="file-list">' + imp.files.map((f, i) => '<div class="file-item' + (f.status === 'error' ? ' error' : '') + '"><span class="fi-icon">' + icon(f.status === 'error' ? 'alert' : 'file') + '</span>' +
        '<div style="min-width:0"><div class="fi-name">' + esc(f.name) + '</div><div class="fi-meta">' + esc(I.FORMAT_LABEL[f.format] || f.format || '') + ' · ' + esc(fmtSize(f.size)) + ' · ' +
        (f.status === 'reading' ? 'Læser …' : f.status === 'error' ? '<span style="color:var(--danger)">' + esc(f.error) + '</span>' : U.fmtNumber(Math.max(0, f.table.rows.length - f.setup.headerRow - 1)) + ' rækker fundet' + (f.table.encoding && f.table.encoding !== 'utf-8' ? ' · tegnsæt ' + esc(f.table.encoding) : '')) + '</div></div>' +
        '<button type="button" class="btn sm ghost icon-only" data-remove="' + i + '" aria-label="Fjern ' + esc(f.name) + '">' + icon('x') + '</button></div>').join('') + '</div>' : '') +
      '<div class="note mt">' + icon('shield') + '<p>Grejs Budget beder aldrig om login, MitID eller kortoplysninger, og filerne sendes ikke nogen steder hen. PDF-kontoudtog læses også (fx fra netbanken eller "Gem som PDF" i Chrome), men CSV eller Excel giver det mest præcise resultat. Scannede PDF\'er uden tekst kan ikke læses.</p></div>' +
      '<div class="row end mt">' + (imp.files.length ? '<button type="button" class="btn ghost" data-act="reset">Ryd</button>' : '') + '<button type="button" class="btn primary" data-act="next"' + (okFiles().length && !imp.files.some((f) => f.status === 'reading') ? '' : ' disabled') + '>Næste' + icon('right') + '</button></div>';
  }

  async function addFiles(list) {
    for (const file of list) {
      const f = { id: U.uid('f'), name: file.name, size: file.size, format: '', status: 'reading', error: '', buf: null, table: null, setup: null, accountId: '' };
      imp.files.push(f);
      if (file.size > MAX_SIZE) { f.status = 'error'; f.error = 'Filen er større end 30 MB'; continue; }
      GB.app.render();
      try {
        f.buf = await file.arrayBuffer();
        await readWithPassword(f);
      } catch (e) {
        f.status = 'error'; f.error = e.message || 'Filen kunne ikke læses';
      }
    }
    GB.app.render();
  }

  // Beskyttede PDF'er: spørg om adgangskoden (højst 3 forsøg). Den gemmes kun i hukommelsen.
  async function readWithPassword(f) {
    let password = null;
    for (let tries = 0; ; tries++) {
      try { await readFile(f, password ? { password } : undefined); return; } catch (e) {
        if (!e.needsPassword || tries >= 3) throw e;
        password = await UI.dialog({
          title: 'Adgangskode til PDF',
          body: '<p>' + esc(f.name) + ' er beskyttet' + (password ? ' – <b>adgangskoden passede ikke</b>' : '') + '. Skriv adgangskoden for at åbne den. Den bruges kun her i browseren og gemmes ikke.</p>' +
            '<div class="field"><label for="pdfPw">Adgangskode</label><input type="password" id="pdfPw" autocomplete="off" autofocus></div>',
          actions: [{ label: 'Annullér', value: null }, { label: 'Åbn PDF', primary: true, onClick: (dlg) => $('#pdfPw', dlg).value || false }],
        });
        if (!password) throw new Error('PDF\'en er beskyttet med en adgangskode og blev ikke åbnet.');
      }
    }
  }

  async function readFile(f, opts) {
    f.format = I.detectFormat(f.name, new Uint8Array(f.buf.slice(0, 600)));
    const table = await I.readTable({ name: f.name }, f.buf, opts);
    f.format = table.format;
    f.table = table;
    if (opts && opts.password) f.password = opts.password;
    const prev = f.setup;
    f.setup = Object.assign(I.analyzeTable(table.rows, { decimalMode: table.decimalHint }), { encoding: opts && opts.encoding || 'auto', delimiter: table.delimiter });
    if (prev && opts) Object.assign(f.setup, { invertSign: prev.invertSign });
    f.status = 'ok';
    f.error = '';
  }

  // --- Trin 2: konto -----------------------------------------------------------

  function step2() {
    const files = okFiles();
    if (!S.data.accounts.length) {
      return '<h2>Hvilken konto er filerne fra?</h2><p class="muted">Opret en konto, fx "Lønkonto" eller "Kreditkort". Banknavn er valgfrit.</p>' +
        '<div class="row mt"><button type="button" class="btn primary" data-act="new-account">' + icon('plus') + 'Opret konto</button></div>' + nav(false);
    }
    return '<h2>Hvilken konto er filerne fra?</h2><p class="muted">Transaktionerne knyttes til kontoen, så du kan følge flere konti hver for sig og samlet.</p>' +
      (imp.perFile ? files.map((f) => '<div class="field mt"><label for="acc_' + f.id + '">' + esc(f.name) + '</label><select id="acc_' + f.id + '" data-fileacc="' + esc(f.id) + '">' + UI.options([['', 'Vælg konto …']], '') + UI.accountOptions(f.accountId) + '</select></div>').join('')
        : '<div class="field mt" style="max-width:420px"><label for="accAll">Konto</label><select id="accAll">' + UI.options([['', 'Vælg konto …']], '') + UI.accountOptions(imp.accountId) + '</select></div>') +
      '<div class="row mt"><button type="button" class="btn" data-act="new-account">' + icon('plus') + 'Ny konto</button>' +
      (files.length > 1 ? '<label class="check"><input type="checkbox" id="perFile"' + (imp.perFile ? ' checked' : '') + '> Filerne er fra forskellige konti</label>' : '') + '</div>' +
      nav(files.every((f) => (imp.perFile ? f.accountId : imp.accountId)));
  }

  // --- Trin 3: kolonner --------------------------------------------------------

  const FIELD_LABELS = [['date', 'Dato *'], ['description', 'Tekst / beskrivelse *'], ['amount', 'Beløb'], ['debit', 'Debet (penge ud)'], ['credit', 'Kredit (penge ind)'], ['currency', 'Valuta'], ['balance', 'Saldo'], ['reference', 'Transaktions-ID']];

  function step3() {
    const files = okFiles();
    if (imp.active >= files.length) imp.active = 0;
    const f = files[imp.active];
    const s = f.setup;
    const header = f.table.rows[s.headerRow] || [];
    const width = Math.max(...f.table.rows.slice(s.headerRow, s.headerRow + 12).map((r) => r.length));
    const cols = [['-1', '— ingen —']].concat(Array.from({ length: width }, (_, i) => [String(i), colName(i) + ': ' + (header[i] || '(tom)').slice(0, 30)]));
    const mapped = new Map();
    for (const [k] of FIELD_LABELS) if (s.map[k] >= 0) mapped.set(s.map[k], k);
    for (const x of s.map.extra || []) mapped.set(x, 'extra');
    const complete = I.mappingComplete(s.map);
    const allComplete = files.every((x) => I.mappingComplete(x.setup.map));
    return '<h2>Hvilke kolonner er hvad?</h2><p class="muted">Grejs Budget har gættet ud fra kolonnenavnene. Kontrollér, at dato, tekst og beløb passer – og ret, hvis noget er forkert.</p>' +
      (files.length > 1 ? '<div class="tabs-inline mt" role="tablist">' + files.map((x, i) => '<button type="button" role="tab" data-tabfile="' + i + '" aria-selected="' + (i === imp.active) + '">' + (I.mappingComplete(x.setup.map) ? '' : '⚠ ') + esc(x.name) + '</button>').join('') + '</div>' : '') +
      (f.format === 'pdf' ? '<div class="note mt">' + icon('file') + '<p>Tabellen er genskabt ud fra teksten i PDF\'en (' + (f.table.pages || 1) + ' side' + ((f.table.pages || 1) === 1 ? '' : 'r') + ', ' +
        (f.table.pdfMode === 'header' ? 'kolonner fundet ud fra overskriftsrækken' : 'linjer med dato, tekst og beløb') + '). Kontrollér især beløb og fortegn – og at ingen linjer mangler – i næste trin.</p></div>' : '') +
      '<div class="map-grid mt">' +
      FIELD_LABELS.map(([k, l]) => '<div class="field"><label for="map_' + k + '">' + esc(l) + '</label><select id="map_' + k + '" data-map="' + k + '">' + UI.options(cols, String(s.map[k])) + '</select></div>').join('') +
      '<div class="field"><label for="map_extra">Ekstra tekstkolonne</label><select id="map_extra" data-map="extra">' + UI.options(cols, String((s.map.extra || [])[0] != null ? s.map.extra[0] : -1)) + '</select><span class="hint">Fx modtager – lægges til beskrivelsen</span></div>' +
      '</div><hr><div class="map-grid">' +
      '<div class="field"><label for="setHeader">Overskriftsrække</label><select id="setHeader">' + UI.options(f.table.rows.slice(0, 20).map((r, i) => [String(i), 'Række ' + (i + 1) + ': ' + r.slice(0, 3).join(' | ').slice(0, 40)]), String(s.headerRow)) + '</select></div>' +
      '<div class="field"><label for="setDate">Datoformat</label><select id="setDate">' + UI.options([['DMY', 'Dag-måned-år (31-12-2026)'], ['YMD', 'År-måned-dag (2026-12-31)'], ['MDY', 'Måned/dag/år (12/31/2026)']], s.dateFormat) + '</select>' + (s.dateCertain ? '' : '<span class="hint" style="color:var(--warn)">Kunne ikke afgøres sikkert – kontrollér</span>') + '</div>' +
      '<div class="field"><label for="setDec">Decimaltegn</label><select id="setDec">' + UI.options([['comma', 'Komma – dansk (1.234,56)'], ['dot', 'Punktum (1,234.56)']], s.decimalMode) + '</select>' + (s.decimalCertain ? '' : '<span class="hint" style="color:var(--warn)">Kunne ikke afgøres sikkert – kontrollér</span>') + '</div>' +
      (f.format === 'csv' ? '<div class="field"><label for="setDelim">Separator</label><select id="setDelim">' + UI.options([[';', 'Semikolon ;'], [',', 'Komma ,'], ['\t', 'Tabulator'], ['|', 'Lodret streg |']], s.delimiter) + '</select></div>' +
        '<div class="field"><label for="setEnc">Tegnsæt</label><select id="setEnc">' + UI.options([['auto', 'Automatisk (' + (f.table.encoding || '') + ')'], ['utf-8', 'UTF-8'], ['windows-1252', 'Windows-1252 / ANSI'], ['iso-8859-1', 'ISO-8859-1']], s.encoding) + '</select><span class="hint">Ret, hvis æ, ø og å ser forkerte ud</span></div>' : '') +
      '<div class="field" style="justify-content:flex-end"><label class="check"><input type="checkbox" id="setInvert"' + (s.invertSign ? ' checked' : '') + '> Vend fortegn</label><span class="hint">Hvis udgifter står som positive tal</span></div>' +
      '</div>' +
      (!complete ? '<div class="note warn mt">' + icon('alert') + '<p>Vælg mindst en kolonne for <b>dato</b>, <b>tekst</b> og enten <b>beløb</b> eller <b>debet/kredit</b>.</p></div>' : '') +
      '<h3 class="mt">Forhåndsvisning af filen</h3><div class="table-wrap mt-s" style="max-height:340px;border:1px solid var(--border);border-radius:10px"><table class="preview-table"><thead><tr><th>#</th>' +
      Array.from({ length: width }, (_, i) => '<th class="' + (mapped.has(i) ? 'mapped' : '') + '">' + esc(colName(i)) + (mapped.has(i) ? ' · ' + esc(labelFor(mapped.get(i))) : '') + '</th>').join('') + '</tr></thead><tbody>' +
      f.table.rows.slice(s.headerRow, s.headerRow + 11).map((r, j) => '<tr class="' + (j === 0 ? 'header-row' : '') + '"><td class="muted">' + (s.headerRow + j + 1) + '</td>' + Array.from({ length: width }, (_, i) => '<td>' + esc(r[i] || '') + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>' + nav(allComplete);
  }
  const colName = (i) => (i < 26 ? String.fromCharCode(65 + i) : 'K' + (i + 1));
  const labelFor = (k) => (k === 'extra' ? 'ekstra tekst' : FIELD_LABELS.find((x) => x[0] === k)[1].replace(' *', '').toLowerCase());

  // --- Trin 4: kontrol ---------------------------------------------------------

  function buildAll() {
    for (const f of okFiles()) f.result = I.buildRows(f.table, f.setup);
  }

  function step4(c) {
    buildAll();
    const files = okFiles();
    const ctx = GB.actions.catCtx();
    const total = files.reduce((s, f) => s + f.result.rows.length, 0);
    let html = '<h2>Kontrollér data</h2><p class="muted">Sådan er filerne blevet læst. Ret indstillingerne i forrige trin, hvis datoer eller beløb ser forkerte ud.</p>';
    for (const f of files) {
      const r = f.result;
      const dates = r.rows.map((x) => x.date).sort();
      const future = r.rows.filter((x) => x.date > U.addDays(c.today, 3)).length;
      html += '<section class="mt"><h3>' + esc(f.name) + ' <span class="muted small">→ ' + esc(UI.accountName(accountOf(f))) + '</span></h3>' +
        '<div class="summary-grid mt-s"><div class="s"><b>' + U.fmtNumber(r.rows.length + r.errors.length) + '</b><span>rækker læst</span></div><div class="s"><b>' + U.fmtNumber(r.rows.length) + '</b><span>klar til import</span></div>' +
        '<div class="s"><b style="color:' + (r.errors.length ? 'var(--danger)' : 'inherit') + '">' + r.errors.length + '</b><span>springes over pga. fejl</span></div>' +
        '<div class="s"><b>' + (dates.length ? esc(U.fmtDate(dates[0], { short: true })) : '–') + '</b><span>til ' + (dates.length ? esc(U.fmtDate(dates[dates.length - 1], { short: true })) : '–') + '</span></div></div>' + fileMonths(f, c);
      if (r.errors.length) html += '<details class="note warn mt-s" open style="display:block"><summary>' + icon('alert') + ' <b>' + r.errors.length + ' rækker kan ikke læses og bliver ikke importeret</b></summary><ul class="history">' + r.errors.slice(0, 30).map((e) => '<li>Række ' + e.rowNo + ': ' + esc(e.reason) + ' <span class="muted">(' + esc(e.raw.join(' | ').slice(0, 90)) + ')</span></li>').join('') + (r.errors.length > 30 ? '<li>… og ' + (r.errors.length - 30) + ' flere</li>' : '') + '</ul></details>';
      if (r.ambiguous) html += '<div class="note warn mt-s">' + icon('alert') + '<p><b>' + r.ambiguous + ' beløb kan læses på to måder</b> (fx "1.234" kan være 1.234 kr. eller 1,234 kr.). De er læst med <b>' + (f.setup.decimalMode === 'comma' ? 'dansk format' : 'punktum som decimaltegn') + '</b>. Kontrollér herunder, og ret decimaltegnet i forrige trin, hvis det er forkert.</p></div>';
      if (future) html += '<div class="note warn mt-s">' + icon('alert') + '<p>' + future + ' transaktioner har en dato i fremtiden. Kontrollér datoformatet.</p></div>';
      if (!r.rows.length) html += '<div class="note warn mt-s">' + icon('alert') + '<p>Ingen rækker kunne læses fra filen. Kontrollér kolonnerne i forrige trin – ellers springes filen over.</p></div>';
      else html += '<div class="table-wrap mt-s"><table class="compact"><thead><tr><th>Dato</th><th>Tekst</th><th class="r">Beløb</th><th>Foreslået kategori</th></tr></thead><tbody>' +
        r.rows.slice(0, 8).map((x) => {
          const sg = C.suggest({ amount: x.amount, description: x.description, descriptionNormalized: C.normalizeDescription(x.description), accountId: accountOf(f) }, ctx);
          return '<tr><td class="num">' + esc(U.fmtDate(x.date, { short: true })) + '</td><td>' + esc(x.description) + '</td><td class="r">' + UI.money(x.amount, { sign: true }) + (x.currency !== 'DKK' ? ' <span class="badge">' + esc(x.currency) + '</span>' : '') + (x.ambiguous ? ' <span class="badge notice" title="Kan læses på to måder">?</span>' : '') + '</td><td>' + UI.catChip(sg.categoryId) + (sg.categorySource === 'suggested' ? ' <span class="badge notice">forslag</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (r.rows.length > 8 ? '<p class="small muted">… og ' + (r.rows.length - 8) + ' rækker mere</p>' : '');
      html += '</section>';
    }
    return html + nav(total > 0);
  }

  // --- Trin 5: dubletter -------------------------------------------------------

  function detectDuplicates() {
    const idx = T.makeDuplicateIndex(S.data.transactions);
    for (const f of okFiles()) {
      const acc = accountOf(f);
      T.markDuplicates(f.result.rows, acc, idx);
      for (const r of f.result.rows) if (r.decision === 'import') T.addToIndex(idx, { id: null, accountId: acc, date: r.date, amount: r.amount, description: r.description, bankTransactionId: r.reference });
    }
  }

  function step5() {
    if (!imp.dupDone) { detectDuplicates(); imp.dupDone = true; }
    const files = okFiles();
    const dups = [];
    files.forEach((f, fi) => f.result.rows.forEach((r, ri) => { if (r.dupStatus !== 'new') dups.push({ f, fi, r, ri }); }));
    const twins = files.reduce((s, f) => s + f.result.rows.filter((r) => r.dupStatus === 'new' && r.twinsInFile > 1).length, 0);
    let html = '<h2>Dubletter</h2>';
    if (!dups.length) html += '<div class="note ok mt">' + icon('check') + '<p><b>Ingen dubletter fundet.</b> Ingen af rækkerne findes i forvejen i Grejs Budget.</p></div>';
    else {
      const certain = dups.filter((d) => d.r.dupStatus === 'certain').length;
      html += '<p class="muted">' + dups.length + ' rækker ligner transaktioner, du allerede har' + (certain ? ' (' + certain + ' med samme transaktions-ID fra banken)' : '') + '. De springes over som standard. To rigtige køb kan dog have samme dato, beløb og tekst – vælg "Importér alligevel", hvis det er tilfældet.</p>' +
        '<div class="row mt-s"><button type="button" class="btn sm" data-alldup="skip">Spring alle over</button><button type="button" class="btn sm" data-alldup="import">Importér alle alligevel</button></div>' +
        '<div class="table-wrap mt-s" style="max-height:440px"><table class="compact"><thead><tr><th>Fil</th><th>Dato</th><th>Tekst</th><th class="r">Beløb</th><th>Fundet</th><th>Valg</th></tr></thead><tbody>' +
        dups.map((d) => '<tr class="dup"><td class="small">' + esc(d.f.name) + '</td><td class="num">' + esc(U.fmtDate(d.r.date, { short: true })) + '</td><td>' + esc(d.r.description) + '</td><td class="r">' + UI.money(d.r.amount, { sign: true }) + '</td>' +
          '<td>' + (d.r.dupStatus === 'certain' ? '<span class="badge warn">Samme bank-ID</span>' : '<span class="badge notice">Samme dato, beløb og tekst</span>') + '</td>' +
          '<td><label class="sr-only" for="dup_' + d.fi + '_' + d.ri + '">Valg</label><select id="dup_' + d.fi + '_' + d.ri + '" data-dup="' + d.fi + ':' + d.ri + '" style="width:auto">' + UI.options([['skip', 'Spring over'], ['import', 'Importér alligevel']], d.r.decision) + '</select></td></tr>').join('') +
        '</tbody></table></div>';
    }
    if (twins) html += '<div class="note mt">' + icon('info') + '<p>' + twins + ' rækker optræder mere end én gang i samme fil med samme dato, beløb og tekst. De importeres alle, da det typisk er rigtige, ens køb.</p></div>';
    return html + nav(true);
  }

  // --- Trin 6: bekræft ---------------------------------------------------------

  function step6(c) {
    const files = okFiles();
    const ctx = GB.actions.catCtx();
    const all = [];
    let errors = 0, skipped = 0, forced = 0;
    for (const f of files) {
      errors += f.result.errors.length;
      for (const r of f.result.rows) {
        if (r.decision !== 'import') { skipped++; continue; }
        if (r.dupStatus !== 'new') forced++;
        const t = { amount: r.amount, currency: r.currency, description: r.description, descriptionNormalized: C.normalizeDescription(r.description), accountId: accountOf(f), date: r.date };
        Object.assign(t, C.suggest(t, ctx));
        all.push(t);
      }
    }
    const sum = c.calc.summarize(all);
    const range = GB.analytics.dataRange(all);
    const unknown = all.filter((t) => t.categorySource === 'unknown' || t.categorySource === 'suggested').length;
    return '<h2>Bekræft import</h2><div class="summary-grid mt">' +
      '<div class="s"><b>' + U.fmtNumber(all.length) + '</b><span>transaktioner importeres</span></div>' +
      '<div class="s"><b>' + (range.from ? esc(U.fmtDate(range.from, { short: true })) + ' – ' + esc(U.fmtDate(range.to, { short: true })) : '–') + '</b><span>periode</span></div>' +
      '<div class="s"><b class="pos">' + esc(U.fmtMoney(sum.income, { decimals: 0 })) + '</b><span>indtægter</span></div>' +
      '<div class="s"><b>' + esc(U.fmtMoney(sum.expense, { decimals: 0 })) + '</b><span>udgifter</span></div>' +
      '<div class="s"><b>' + skipped + '</b><span>dubletter springes over</span></div>' +
      '<div class="s"><b>' + errors + '</b><span>rækker med fejl springes over</span></div></div>' +
      '<ul class="list mt">' + files.map((f) => '<li>' + icon('file') + '<span class="grow">' + esc(f.name) + ' → <b>' + esc(UI.accountName(accountOf(f))) + '</b></span><span class="num">' + f.result.rows.filter((r) => r.decision === 'import').length + ' stk.</span></li>').join('') + '</ul>' +
      monthDistribution(all, c) +
      (forced ? '<div class="note warn mt">' + icon('alert') + '<p>' + forced + ' mulige dubletter importeres efter dit valg. De markeres, så du kan kontrollere dem bagefter.</p></div>' : '') +
      (unknown ? '<div class="note mt">' + icon('info') + '<p>' + unknown + ' transaktioner kunne ikke kategoriseres sikkert og markeres til kontrol.</p></div>' : '') +
      (sum.foreign ? '<div class="note warn mt">' + icon('alert') + '<p>' + sum.foreign + ' transaktioner er i fremmed valuta. De tælles ikke med i summerne, før du angiver en kurs.</p></div>' : '') +
      (all.length ? '<p class="small muted mt">Når du bekræfter, gemmes transaktionerne i denne browser. Du kan altid fortryde hele importen under Importhistorik.</p>'
        : '<div class="note ok mt">' + icon('check') + '<div><p><b>Der er intet nyt at importere.</b> Alle rækker findes allerede i Grejs Budget' + (errors ? ' eller kunne ikke læses' : '') + '. Gå tilbage og vælg "Importér alligevel" under Dubletter, hvis nogle af dem er nye køb.</p><button type="button" class="btn sm" data-act="reset">Afslut uden at importere</button></div></div>') +
      '<div class="row between mt"><button type="button" class="btn" data-act="back">' + icon('left') + 'Tilbage</button><button type="button" class="btn primary" data-act="commit"' + (all.length && !imp.busy ? '' : ' disabled') + '>' + (imp.busy ? 'Gemmer …' : icon('check') + 'Importér ' + U.fmtNumber(all.length) + ' transaktioner') + '</button></div>';
  }

  // Hvordan fordeler de nye transaktioner sig på månederne? (Hver transaktion placeres efter sin egen dato.)
  function monthDistribution(all, c) {
    if (!all.length) return '';
    const accounts = new Set(all.map((t) => t.accountId));
    const byMonth = new Map();
    for (const t of all) { const mk = U.monthKey(t.date); if (!byMonth.has(mk)) byMonth.set(mk, []); byMonth.get(mk).push(t); }
    const months = [...byMonth.keys()].sort();
    const existing = new Map();
    for (const t of S.data.transactions) if (accounts.has(t.accountId)) existing.set(U.monthKey(t.date), (existing.get(U.monthKey(t.date)) || 0) + 1);
    const rows = months.map((mk) => {
      const s = c.calc.summarize(byMonth.get(mk));
      const ex = existing.get(mk) || 0;
      return '<tr><td>' + esc(U.capitalize(U.fmtMonth(mk))) + '</td><td class="r num">' + byMonth.get(mk).length + '</td><td class="r num pos">' + esc(U.fmtMoney(s.income, { decimals: 0 })) + '</td><td class="r num">' + esc(U.fmtMoney(s.expense, { decimals: 0 })) + '</td>' +
        '<td>' + (ex ? '<span class="cov-chip partial">' + icon('plus') + 'Supplerer ' + ex + ' eksisterende</span>' : '<span class="cov-chip none">' + icon('plus') + 'Ny måned</span>') + '</td></tr>';
    }).join('');
    return '<h3 class="mt">Fordeling på måneder</h3><p class="small muted" style="margin:4px 0 8px">Hver transaktion placeres i den måned, den har dato i – så en fil med et helt år fordeles automatisk på ' + months.length + ' måned' + (months.length === 1 ? '' : 'er') + '.</p>' +
      '<div class="table-wrap" style="max-height:420px;border:1px solid var(--border);border-radius:10px"><table class="compact"><thead><tr><th>Måned</th><th class="r">Transaktioner</th><th class="r">Ind</th><th class="r">Ud</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function doneView() {
    const d = imp.done;
    const m = d.months || [];
    const spread = m.length > 1 ? ' Fordelt på ' + m.length + ' måneder (' + U.fmtMonth(m[0]) + ' – ' + U.fmtMonth(m[m.length - 1]) + ').' : m.length ? ' Alle i ' + U.fmtMonth(m[0]) + '.' : '';
    return '<div class="card">' + UI.empty('check', 'Importen er gennemført', U.fmtNumber(d.count) + ' transaktioner er gemt fra ' + d.batches.length + ' fil' + (d.batches.length === 1 ? '' : 'er') + '.' + spread + (d.skipped ? ' ' + d.skipped + ' dubletter blev sprunget over.' : ''),
      '<a class="btn primary" href="#/overblik">Se overblikket</a>' + (m.length > 1 ? '<button type="button" class="btn" data-act="show-months">' + icon('chart') + 'Se måned for måned</button>' : '') +
      '<button type="button" class="btn" data-act="show-imported">Se de importerede</button><button type="button" class="btn" data-act="again">' + icon('upload') + 'Importér flere</button>') + '</div>';
  }

  function historyView() {
    const list = S.data.batches.slice().sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    if (!list.length) return '';
    const counts = new Map();
    for (const t of S.data.transactions) if (t.importBatchId) counts.set(t.importBatchId, (counts.get(t.importBatchId) || 0) + 1);
    return '<section class="card flush mt"><div class="card-head" style="padding:16px 20px 0"><h2>Importhistorik</h2><span class="sub">Fortryd en import, hvis en fil blev importeret forkert</span></div><div class="table-wrap mt-s"><table class="compact"><thead><tr><th>Fil</th><th>Importeret</th><th>Konto</th><th>Periode</th><th class="r">Rækker</th><th class="r">Gemt nu</th><th class="r">Sprunget over</th><th></th></tr></thead><tbody>' +
      list.map((b) => '<tr><td>' + esc(b.fileName) + (b.isSample ? ' <span class="badge">eksempel</span>' : '') + (b.warnings && b.warnings.length ? ' <span class="badge warn" title="' + esc(b.warnings.slice(0, 5).join('\n')) + '">' + b.errors + ' fejl</span>' : '') + '</td>' +
        '<td class="small">' + esc(new Date(b.importedAt).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })) + '</td><td class="small">' + esc(UI.accountName(b.accountId)) + '</td>' +
        '<td class="small">' + (b.firstDate ? esc(U.fmtDate(b.firstDate, { short: true })) + ' – ' + esc(U.fmtDate(b.lastDate, { short: true })) : '–') + '</td>' +
        '<td class="r num">' + b.rowsRead + '</td><td class="r num">' + (counts.get(b.id) || 0) + '</td><td class="r num">' + (b.skippedDuplicates + b.errors) + '</td>' +
        '<td class="r"><span class="row end" style="gap:4px;flex-wrap:nowrap"><button type="button" class="btn sm ghost" data-showbatch="' + esc(b.id) + '">Vis</button><button type="button" class="btn sm danger" data-delbatch="' + esc(b.id) + '">Fortryd</button></span></td></tr>').join('') +
      '</tbody></table></div></section>';
  }

  // --- Fælles ------------------------------------------------------------------

  function accountOf(f) { return imp.perFile ? f.accountId : imp.accountId; }

  function nav(canNext) {
    return '<div class="row between mt"><button type="button" class="btn" data-act="back">' + icon('left') + 'Tilbage</button><button type="button" class="btn primary" data-act="next"' + (canNext ? '' : ' disabled') + '>Næste' + icon('right') + '</button></div>';
  }

  function go(step) {
    if (step < 5) imp.dupDone = false;
    imp.step = step;
    GB.app.render();
    window.scrollTo({ top: 0 });
  }

  function bind(root, c) {
    const input = $('#fileInput', root);
    if (input) {
      input.addEventListener('change', () => { if (input.files.length) addFiles([...input.files]); });
      const drop = $('#drop', root);
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (e) => { const fl = [...(e.dataTransfer.files || [])]; if (fl.length) addFiles(fl); });
    }
    const accAll = $('#accAll', root);
    if (accAll) accAll.addEventListener('change', () => { imp.accountId = accAll.value; GB.app.render(); });
    $$('[data-fileacc]', root).forEach((s) => s.addEventListener('change', () => { imp.files.find((f) => f.id === s.dataset.fileacc).accountId = s.value; GB.app.render(); }));
    const pf = $('#perFile', root);
    if (pf) pf.addEventListener('change', () => { imp.perFile = pf.checked; if (pf.checked) okFiles().forEach((f) => { f.accountId = f.accountId || imp.accountId; }); GB.app.render(); });

    if (imp.step === 3) {
      const f = okFiles()[imp.active];
      const s = f.setup;
      $$('[data-map]', root).forEach((sel) => sel.addEventListener('change', () => {
        const k = sel.dataset.map, v = +sel.value;
        if (k === 'extra') s.map.extra = v >= 0 ? [v] : [];
        else {
          s.map[k] = v;
          if (k === 'amount' && v >= 0) { s.map.debit = -1; s.map.credit = -1; }
          if ((k === 'debit' || k === 'credit') && v >= 0) s.map.amount = -1;
        }
        GB.app.render();
      }));
      $('#setHeader', root).addEventListener('change', (e) => {
        const a = I.analyzeTable(f.table.rows, { decimalMode: f.table.decimalHint, headerRow: +e.target.value });
        Object.assign(s, a, { invertSign: s.invertSign, encoding: s.encoding, delimiter: s.delimiter });
        GB.app.render();
      });
      $('#setDate', root).addEventListener('change', (e) => { s.dateFormat = e.target.value; s.dateCertain = true; GB.app.render(); });
      $('#setDec', root).addEventListener('change', (e) => { s.decimalMode = e.target.value; s.decimalCertain = true; GB.app.render(); });
      $('#setInvert', root).addEventListener('change', (e) => { s.invertSign = e.target.checked; });
      const reread = async (opts) => { try { await readFile(f, Object.assign({ encoding: s.encoding, delimiter: s.delimiter }, opts)); } catch (err) { UI.toast(err.message, 'error'); } GB.app.render(); };
      if ($('#setDelim', root)) $('#setDelim', root).addEventListener('change', (e) => reread({ delimiter: e.target.value }));
      if ($('#setEnc', root)) $('#setEnc', root).addEventListener('change', (e) => reread({ encoding: e.target.value === 'auto' ? null : e.target.value }));
      $$('[data-tabfile]', root).forEach((b) => b.addEventListener('click', () => { imp.active = +b.dataset.tabfile; GB.app.render(); }));
    }

    $$('[data-dup]', root).forEach((sel) => sel.addEventListener('change', () => {
      const [fi, ri] = sel.dataset.dup.split(':').map(Number);
      okFiles()[fi].result.rows[ri].decision = sel.value;
    }));

    root.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.covMonth) {
        const mk = b.dataset.covMonth;
        if (b.dataset.status === 'full' || b.dataset.status === 'partial') {
          GB.app.state.account = b.dataset.covAcc;
          GB.app.go('transactions', { from: U.monthStart(mk), to: U.monthEnd(mk) });
        } else if (b.dataset.status === 'none' && $('#drop', root)) {
          $('#drop', root).scrollIntoView({ behavior: 'smooth', block: 'center' });
          $('#drop', root).focus({ preventScroll: true });
          UI.toast('Vælg bankfilen for ' + U.fmtMonth(mk) + ' herover');
        }
        return;
      }
      if (b.dataset.remove != null) { imp.files.splice(+b.dataset.remove, 1); GB.app.render(); return; }
      if (b.dataset.alldup) { okFiles().forEach((f) => f.result.rows.forEach((r) => { if (r.dupStatus !== 'new') r.decision = b.dataset.alldup; })); GB.app.render(); return; }
      if (b.dataset.delbatch) { GB.actions.deleteBatch(b.dataset.delbatch); return; }
      if (b.dataset.showbatch) { GB.app.go('transactions', { batchId: b.dataset.showbatch, all: true }); return; }
      const act = b.dataset.act;
      if (act === 'next') go(imp.step + 1);
      if (act === 'back') go(Math.max(1, imp.step - 1));
      if (act === 'reset' || act === 'again') { imp = fresh(); GB.app.render(); }
      if (act === 'new-account') {
        const a = await GB.actions.accountDialog();
        if (a) { if (imp.perFile) okFiles().forEach((f) => { if (!f.accountId) f.accountId = a.id; }); else imp.accountId = a.id; GB.app.render(); }
      }
      if (act === 'show-months') { const m = imp.done.months; GB.app.go('compare', { fromMonth: m[0], toMonth: m[m.length - 1] }); return; }
      if (act === 'show-imported') GB.app.go('transactions', { ids: S.data.transactions.filter((t) => imp.done.batches.some((x) => x.id === t.importBatchId)).map((t) => t.id) });
      if (act === 'commit') {
        if (imp.busy) return;
        imp.busy = true;
        b.disabled = true;
        b.textContent = 'Gemmer …';
        try {
          const files = okFiles().filter((f) => f.result.rows.length).map((f) => ({ name: f.name, format: f.format, size: f.size, accountId: accountOf(f), rows: f.result.rows, errors: f.result.errors }));
          const res = await GB.actions.commitImport(files);
          const skipped = res.batches.reduce((s, x) => s + x.skippedDuplicates, 0);
          const months = [...new Set(files.flatMap((f) => f.rows.filter((r) => r.decision === 'import').map((r) => U.monthKey(r.date))))].sort();
          imp = fresh();
          imp.done = { count: res.count, batches: res.batches, skipped, months };
          await S.saveSettings({ onboarded: true }).catch(() => {});
          UI.toast(res.count + ' transaktioner er importeret');
          GB.app.refresh();
        } catch (err) {
          imp.busy = false;
          UI.toast('Importen kunne ikke gemmes: ' + err.message + '. Intet er gemt – prøv igen.', 'error');
          GB.app.render();
        }
      }
    });
  }

  GB.views.import = { render };
})();
