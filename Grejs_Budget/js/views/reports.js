// Rapporter og eksport: CSV, printvenlig rapport (gem som PDF via browseren) og sikkerhedskopi.

(function () {
  'use strict';
  const GB = globalThis.GB;
  const U = GB.util, UI = GB.ui, S = GB.store, An = GB.analytics, E = GB.exporter;
  const { $, $$, esc, icon } = UI;

  const st = { from: null, to: null, account: '', groups: [], fields: null };

  // Kolonner til eksport af transaktioner. [id, overskrift, get(t), numerisk, standard]
  function txColumnDefs(calc) {
    const batchName = (id) => { const b = id && S.byId.batches.get(id); return b ? b.fileName : 'Manuel'; };
    return [
      ['date', 'Dato', (t) => t.date, false, true],
      ['description', 'Beskrivelse', (t) => t.description, false, true],
      ['descriptionOriginal', 'Bankens tekst', (t) => t.descriptionOriginal, false, false],
      ['amount', 'Beløb', (t) => t.amount, true, true],
      ['currency', 'Valuta', (t) => t.currency, false, true],
      ['type', 'Type', (t) => An.TYPE_LABEL[calc.classify(t).type], false, true],
      ['group', 'Hovedkategori', (t) => { const c = UI.catOf(t.categoryId); return c.parentId ? UI.catName(c.parentId) : c.name; }, false, true],
      ['category', 'Kategori', (t) => UI.catName(t.categoryId), false, true],
      ['account', 'Konto', (t) => UI.accountName(t.accountId), false, true],
      ['notes', 'Noter', (t) => t.notes, false, true],
      ['tags', 'Tags', (t) => (t.tags || []).join(', '), false, true],
      ['categorySource', 'Kategori valgt af', (t) => GB.categories.SOURCE_LABEL[t.categorySource], false, false],
      ['batch', 'Importeret fra', (t) => batchName(t.importBatchId), false, false],
      ['edited', 'Ændret af bruger', (t) => (t.edited && Object.keys(t.edited).length ? 'Ja' : ''), false, false],
    ];
  }
  function txColumns(calc, ids) {
    return txColumnDefs(calc).filter((d) => (ids ? ids.includes(d[0]) : d[4])).map(([, label, get, numeric]) => ({ label, get, numeric }));
  }

  function selection(c) {
    const from = U.monthStart(st.from <= st.to ? st.from : st.to), to = U.monthEnd(st.from <= st.to ? st.to : st.from);
    const groups = new Set(st.groups);
    const txs = S.data.transactions.filter((t) => t.date >= from && t.date <= to && (!st.account || t.accountId === st.account) && (!groups.size || groups.has(c.calc.groupOf(t.categoryId))));
    return { from, to, txs, months: U.monthRange(U.monthKey(from), U.monthKey(to)) };
  }

  function render(root, c) {
    const range = An.dataRange(S.data.transactions);
    if (!st.to) {
      st.to = U.monthKey(range.to && range.to < c.today ? range.to : c.today);
      st.from = U.addMonthKey(st.to, -2);
      if (range.from && st.from < U.monthKey(range.from)) st.from = U.monthKey(range.from);
    }
    if (!st.fields) st.fields = txColumnDefs(c.calc).filter((d) => d[4]).map((d) => d[0]);
    const sel = selection(c);
    const groups = S.data.categories.filter((x) => !x.parentId).sort((a, b) => a.order - b.order);

    let html = '<div class="grid grid-2 no-print">' +
      '<section class="card"><div class="card-head"><h2>' + icon('filter') + 'Udvalg</h2></div><div class="fields">' +
      '<div class="field"><label for="rFrom">Fra måned</label><input type="month" id="rFrom" value="' + esc(st.from) + '"></div>' +
      '<div class="field"><label for="rTo">Til måned</label><input type="month" id="rTo" value="' + esc(st.to) + '"></div>' +
      (S.data.accounts.length > 1 ? '<div class="field"><label for="rAcc">Konto</label><select id="rAcc">' + UI.accountOptions(st.account, 'Alle konti') + '</select></div>' : '') + '</div>' +
      '<details class="mt"' + (st.groups.length ? ' open' : '') + '><summary class="small">Kategorier' + (st.groups.length ? ' (' + st.groups.length + ' valgt)' : ' (alle)') + '</summary><div class="fields mt-s" style="gap:6px">' +
      groups.map((g) => '<label class="check small"><input type="checkbox" data-rg="' + esc(g.id) + '"' + (st.groups.includes(g.id) ? ' checked' : '') + '> ' + esc(g.name) + '</label>').join('') + '</div></details>' +
      '<p class="small muted mt">' + U.fmtNumber(sel.txs.length) + ' transaktioner i udvalget.</p></section>' +
      '<section class="card"><div class="card-head"><h2>' + icon('download') + 'Eksport</h2></div><div class="stack" style="gap:10px">' +
      '<div class="row"><button type="button" class="btn primary" data-exp="tx">' + icon('download') + 'Transaktioner (CSV)</button><details><summary class="small">Vælg felter</summary><div class="fields mt-s" style="gap:6px;grid-template-columns:repeat(2,minmax(0,1fr))">' +
      txColumnDefs(c.calc).map((d) => '<label class="check small"><input type="checkbox" data-field="' + d[0] + '"' + (st.fields.includes(d[0]) ? ' checked' : '') + '> ' + esc(d[1]) + '</label>').join('') + '</div></details></div>' +
      '<div class="row"><button type="button" class="btn" data-exp="month">' + icon('chart') + 'Månedsrapport (CSV)</button><button type="button" class="btn" data-exp="budget">' + icon('target') + 'Budgetrapport (CSV)</button></div>' +
      '<div class="row"><button type="button" class="btn" data-exp="print">' + icon('printer') + 'Udskriv / gem som PDF</button><button type="button" class="btn" data-exp="backup">' + icon('database') + 'Fuld sikkerhedskopi (JSON)</button></div>' +
      '<p class="small muted">CSV-filer bruger dansk format (semikolon og decimalkomma) og kan åbnes i Excel. PDF laves med browserens "Udskriv → Gem som PDF".</p></div></section></div>';

    html += report(c, sel);
    root.innerHTML = html;
    bind(root, c, sel);
  }

  function report(c, sel) {
    const calc = c.calc;
    const sum = calc.summarize(sel.txs);
    const rows = calc.byMonth(sel.txs, sel.months);
    const range = An.dataRange(S.data.transactions);
    const groups = [...sum.byGroup].filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
    const merchants = new Map();
    for (const t of sel.txs) {
      const e = calc.classify(t).expense;
      if (!e) continue;
      const k = GB.categories.merchantKey(t.description) || t.description;
      merchants.set(k, (merchants.get(k) || 0) + e);
    }
    const topM = [...merchants].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const budgetMonths = sel.months.map((m) => GB.budgets.evaluate(S.data.budgets, m, S.data.transactions, calc, c.settings.thresholds)).filter((e) => e.plan);
    const label = An.periodLabel({ from: sel.from, to: sel.to });

    return '<article class="report mt"><div class="report-head"><img src="assets/icons/app-icon-192.png" alt="" width="64" height="64"><div><h1>Grejs Budget – økonomirapport</h1><p class="muted" style="margin:0">' + esc(label) + ' · ' + esc(st.account ? UI.accountName(st.account) : 'Alle konti') + (st.groups.length ? ' · udvalgte kategorier' : '') + ' · lavet ' + esc(U.fmtDate(c.today)) + '</p></div></div>' +
      '<div class="kpis"><div class="kpi"><div class="kpi-label">Indtægter</div><div class="kpi-value">' + esc(U.fmtMoney(sum.income, { decimals: 0 })) + '</div></div><div class="kpi"><div class="kpi-label">Udgifter</div><div class="kpi-value">' + esc(U.fmtMoney(sum.expense, { decimals: 0 })) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Netto</div><div class="kpi-value">' + esc(U.fmtMoney(sum.net, { decimals: 0, sign: true })) + '</div></div><div class="kpi"><div class="kpi-label">Opsparing</div><div class="kpi-value">' + esc(U.fmtMoney(sum.savings, { decimals: 0 })) + '</div></div></div>' +
      '<h3>Måned for måned</h3><div class="table-wrap"><table class="compact"><thead><tr><th>Måned</th><th class="r">Indtægter</th><th class="r">Udgifter</th><th class="r">Netto</th><th class="r">Opsparing</th></tr></thead><tbody>' +
      rows.map((r) => { const cov = An.monthCoverage(r.month, range, c.today); return '<tr><td>' + esc(U.capitalize(U.fmtMonth(r.month))) + (cov.complete ? '' : ' <span class="small muted">(' + esc(cov.reason || 'ufuldstændig') + ')</span>') + '</td><td class="r num">' + esc(U.fmtMoney(r.income)) + '</td><td class="r num">' + esc(U.fmtMoney(r.expense)) + '</td><td class="r num">' + esc(U.fmtMoney(r.net, { sign: true })) + '</td><td class="r num">' + esc(U.fmtMoney(r.savings)) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td>I alt</td><td class="r num">' + esc(U.fmtMoney(sum.income)) + '</td><td class="r num">' + esc(U.fmtMoney(sum.expense)) + '</td><td class="r num">' + esc(U.fmtMoney(sum.net, { sign: true })) + '</td><td class="r num">' + esc(U.fmtMoney(sum.savings)) + '</td></tr></tfoot></table></div>' +
      '<h3>Udgifter pr. kategori</h3><div class="table-wrap"><table class="compact"><thead><tr><th>Kategori</th><th class="r">Beløb</th><th class="r">Andel</th><th class="r">Pr. måned</th></tr></thead><tbody>' +
      groups.map(([g, v]) => {
        const subs = [...sum.byCategory].filter(([id, x]) => x !== 0 && calc.groupOf(id) === g && id !== g).sort((a, b) => b[1] - a[1]);
        return '<tr><td><b>' + esc(UI.catName(g)) + '</b></td><td class="r num"><b>' + esc(U.fmtMoney(v)) + '</b></td><td class="r num">' + esc(U.fmtPct(sum.expense ? (v / sum.expense) * 100 : 0, 1)) + '</td><td class="r num">' + esc(U.fmtMoney(v / sel.months.length, { decimals: 0 })) + '</td></tr>' +
          subs.map(([id, x]) => '<tr><td style="padding-left:28px">' + esc(UI.catName(id)) + '</td><td class="r num">' + esc(U.fmtMoney(x)) + '</td><td class="r num muted">' + esc(U.fmtPct(sum.expense ? (x / sum.expense) * 100 : 0, 1)) + '</td><td class="r num muted">' + esc(U.fmtMoney(x / sel.months.length, { decimals: 0 })) + '</td></tr>').join('');
      }).join('') + '</tbody></table></div>' +
      (budgetMonths.length ? '<h3>Budget og faktisk forbrug</h3>' + budgetMonths.map((ev) => '<p style="margin:12px 0 6px"><b>' + esc(U.capitalize(U.fmtMonth(ev.month))) + '</b> – ' + esc(U.fmtMoney(ev.summary.expense, { decimals: 0 })) + ' af ' + esc(U.fmtMoney(ev.totalBudget, { decimals: 0 })) + ' (' + esc(ev.total.label.toLowerCase()) + ')</p>' +
        '<div class="table-wrap"><table class="compact"><thead><tr><th>Kategori</th><th class="r">Budget</th><th class="r">Brugt</th><th class="r">Tilbage</th><th class="r">Brugt %</th><th>Status</th></tr></thead><tbody>' +
        ev.lines.map((l) => '<tr><td>' + esc(UI.catName(l.line.categoryId)) + '</td><td class="r num">' + esc(U.fmtMoney(l.budget, { decimals: 0 })) + '</td><td class="r num">' + esc(U.fmtMoney(l.spent, { decimals: 0 })) + '</td><td class="r num">' + esc(U.fmtMoney(l.left, { decimals: 0 })) + '</td><td class="r num">' + esc(U.fmtPct(l.pct)) + '</td><td>' + esc(l.label) + '</td></tr>').join('') + '</tbody></table></div>').join('') : '') +
      (topM.length ? '<h3>Største modtagere</h3><div class="table-wrap"><table class="compact"><thead><tr><th>Modtager</th><th class="r">Beløb</th></tr></thead><tbody>' + topM.map(([k, v]) => '<tr><td>' + esc(k) + '</td><td class="r num">' + esc(U.fmtMoney(v)) + '</td></tr>').join('') + '</tbody></table></div>' : '') +
      '<p class="small muted mt">Beregnet ud fra de importerede transaktioner. Interne overførsler (' + sum.transfers + ' stk.) tæller hverken som indtægt eller forbrug. Opsparing tæller ' + (c.settings.calcRules.savingsAsExpense ? 'som forbrug' : 'ikke som forbrug') + '. Refusioner ' + (c.settings.calcRules.refundsOffset ? 'trækkes fra forbruget i kategorien' : 'tælles som indtægt') + '.' + (sum.foreign ? ' ' + sum.foreign + ' transaktioner i fremmed valuta uden kurs er ikke medregnet.' : '') + '</p></article>';
  }

  function bind(root, c, sel) {
    const re = () => GB.app.render();
    $('#rFrom', root).addEventListener('change', (e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) { st.from = e.target.value; re(); } });
    $('#rTo', root).addEventListener('change', (e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) { st.to = e.target.value; re(); } });
    if ($('#rAcc', root)) $('#rAcc', root).addEventListener('change', (e) => { st.account = e.target.value; re(); });
    $$('[data-rg]', root).forEach((x) => x.addEventListener('change', () => { st.groups = $$('[data-rg]:checked', root).map((y) => y.dataset.rg); re(); }));
    $$('[data-field]', root).forEach((x) => x.addEventListener('change', () => { st.fields = $$('[data-field]:checked', root).map((y) => y.dataset.field); }));
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-exp]');
      if (!b) return;
      const kind = b.dataset.exp;
      const name = (p) => 'grejs-budget-' + p + '_' + st.from + '_til_' + st.to + '.csv';
      if (kind === 'print') { window.print(); return; }
      if (kind === 'backup') {
        if (await UI.confirm({ title: 'Fuld sikkerhedskopi', message: 'Filen indeholder alle dine data: transaktioner, kategorier, regler, budgetter, konti, mål og indstillinger. Gem den et sikkert sted.', confirmLabel: 'Hent sikkerhedskopi' })) GB.actions.downloadBackup();
        return;
      }
      if (kind === 'tx') {
        if (!sel.txs.length) { UI.toast('Ingen transaktioner i udvalget', 'warn'); return; }
        if (!st.fields.length) { UI.toast('Vælg mindst ét felt', 'warn'); return; }
        if (!(await UI.confirm({ title: 'Eksportér transaktioner', message: sel.txs.length + ' transaktioner gemmes i en CSV-fil på din enhed. Filen indeholder dine bankdata.', confirmLabel: 'Hent CSV' }))) return;
        const list = GB.tx.sortTransactions(sel.txs, 'date', 'asc');
        E.download(E.toCSV(list, txColumns(c.calc, st.fields)), name('transaktioner'), 'text/csv;charset=utf-8');
      }
      if (kind === 'month') {
        const rows = c.calc.byMonth(sel.txs, sel.months);
        const groups = S.data.categories.filter((x) => !x.parentId).sort((a, b) => a.order - b.order).filter((g) => rows.some((r) => r.byGroup.get(g.id)));
        const cols = [{ label: 'Måned', get: (r) => r.month }, { label: 'Indtægter', get: (r) => r.income, numeric: true }, { label: 'Udgifter', get: (r) => r.expense, numeric: true }, { label: 'Netto', get: (r) => r.net, numeric: true }, { label: 'Opsparing', get: (r) => r.savings, numeric: true }]
          .concat(groups.map((g) => ({ label: 'Udgift: ' + g.name, get: (r) => r.byGroup.get(g.id) || 0, numeric: true })));
        E.download(E.toCSV(rows, cols), name('maanedsrapport'), 'text/csv;charset=utf-8');
      }
      if (kind === 'budget') {
        const out = [];
        for (const m of sel.months) {
          const ev = GB.budgets.evaluate(S.data.budgets, m, S.data.transactions, c.calc, c.settings.thresholds);
          if (!ev.plan) continue;
          out.push({ m, cat: 'I alt', budget: ev.totalBudget, spent: ev.summary.expense, left: ev.total.left, pct: ev.total.pct, status: ev.total.label });
          for (const l of ev.lines) out.push({ m, cat: UI.catName(l.line.categoryId, true), budget: l.budget, spent: l.spent, left: l.left, pct: l.pct, status: l.label });
        }
        if (!out.length) { UI.toast('Der er ingen budgetter i den valgte periode', 'warn'); return; }
        E.download(E.toCSV(out, [{ label: 'Måned', get: (r) => r.m }, { label: 'Kategori', get: (r) => r.cat }, { label: 'Budget', get: (r) => r.budget, numeric: true }, { label: 'Brugt', get: (r) => r.spent, numeric: true }, { label: 'Tilbage', get: (r) => r.left, numeric: true }, { label: 'Brugt %', get: (r) => (r.pct == null ? null : U.round2(r.pct)), numeric: true }, { label: 'Status', get: (r) => r.status }]), name('budgetrapport'), 'text/csv;charset=utf-8');
      }
    });
  }

  GB.views.reports = { render, txColumns };
})();
