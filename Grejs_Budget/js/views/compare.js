// Månedssammenligning og historik.

(function () {
  'use strict';
  const GB = globalThis.GB;
  const U = GB.util, UI = GB.ui, S = GB.store, An = GB.analytics;
  const { $, $$, esc, icon } = UI;

  const st = { mode: 'months', from: null, to: null, a: null, b: null, account: '', hidden: [], noOneOff: false, perDay: false, subs: false };

  function filtered(c) {
    const hidden = new Set(st.hidden);
    for (const x of S.data.categories) if (x.parentId && hidden.has(x.parentId)) hidden.add(x.id);
    return S.data.transactions.filter((t) => (!st.account || t.accountId === st.account) && !hidden.has(t.categoryId) && !(st.noOneOff && t.isOneOff));
  }

  function render(root, c) {
    const range = An.dataRange(S.data.transactions);
    if (!range.from) {
      root.innerHTML = '<div class="card">' + UI.empty('chart', 'Ingen data at sammenligne', 'Importér mindst to måneders bankdata for at se udviklingen.', '<a class="btn primary" href="#/importer">Importér data</a>') + '</div>';
      return;
    }
    const lastMk = U.monthKey(range.to < c.today ? range.to : c.today);
    // Kommer man fra importen, vises netop de importerede måneder.
    const p = c.state.params || {};
    if (p.fromMonth && p.toMonth) { Object.assign(st, { mode: 'months', from: p.fromMonth, to: p.toMonth }); c.state.params = {}; }
    if (!st.to) { st.to = lastMk; st.from = U.monthKey(range.from) > U.addMonthKey(lastMk, -5) ? U.monthKey(range.from) : U.addMonthKey(lastMk, -5); }
    if (!st.a) { st.a = lastMk; st.b = U.addMonthKey(lastMk, -1); }
    const groups = S.data.categories.filter((x) => !x.parentId).sort((a, b) => a.order - b.order);

    let html = '<div class="card"><div class="row between"><div class="seg" role="group" aria-label="Visning">' +
      [['months', 'Måned for måned'], ['pair', 'Sammenlign to måneder'], ['years', 'År']].map(([k, l]) => '<button type="button" data-mode="' + k + '" aria-pressed="' + (st.mode === k) + '">' + esc(l) + '</button>').join('') + '</div>' +
      '<div class="row">' + (st.mode === 'months' ? '<label for="cmpFrom" class="small">Fra</label><input type="month" id="cmpFrom" value="' + esc(st.from) + '" style="width:auto"><label for="cmpTo" class="small">til</label><input type="month" id="cmpTo" value="' + esc(st.to) + '" style="width:auto">' : '') +
      (st.mode === 'pair' ? '<label for="cmpA" class="small">Måned</label><input type="month" id="cmpA" value="' + esc(st.a) + '" style="width:auto"><label for="cmpB" class="small">mod</label><input type="month" id="cmpB" value="' + esc(st.b) + '" style="width:auto"><button type="button" class="btn sm" id="cmpYoY" title="Samme måned sidste år">Samme måned sidste år</button>' : '') +
      (S.data.accounts.length > 1 ? '<label class="sr-only" for="cmpAcc">Konto</label><select id="cmpAcc" style="width:auto">' + UI.accountOptions(st.account, 'Alle konti') + '</select>' : '') + '</div></div>' +
      '<details class="mt-s"' + (st.hidden.length || st.noOneOff || st.perDay ? ' open' : '') + '><summary class="small">Udelad kategorier og engangsudgifter' + (st.hidden.length ? ' (' + st.hidden.length + ' skjult)' : '') + '</summary><div class="row mt-s">' +
      groups.map((g) => '<label class="check small"><input type="checkbox" data-hide="' + esc(g.id) + '"' + (st.hidden.includes(g.id) ? ' checked' : '') + '> Skjul ' + esc(g.name.toLowerCase()) + '</label>').join('') +
      '</div><div class="row mt-s"><label class="check small"><input type="checkbox" id="cmpOneOff"' + (st.noOneOff ? ' checked' : '') + '> Udelad transaktioner markeret som engangsudgift</label>' +
      (st.mode === 'months' ? '<label class="check small"><input type="checkbox" id="cmpPerDay"' + (st.perDay ? ' checked' : '') + '> Vis gennemsnit pr. dag (retfærdigt ved ufuldstændige måneder)</label>' : '') +
      '</div><p class="small muted mt-s">Interne overførsler tæller aldrig med.</p></details></div>';

    const txs = filtered(c);
    if (st.mode === 'pair') html += pairView(c, txs, range);
    else if (st.mode === 'years') html += yearsView(c, txs, range);
    else html += monthsView(c, txs, range);
    root.innerHTML = html;
    bind(root);
  }

  function monthsView(c, txs, range) {
    const from = st.from <= st.to ? st.from : st.to, to = st.from <= st.to ? st.to : st.from;
    const months = U.monthRange(from, to).slice(-36);
    const rows = c.calc.byMonth(txs, months).map((m) => Object.assign(m, { cov: An.monthCoverage(m.month, range, c.today) }));
    const div = (m, v) => (st.perDay ? (m.cov.days ? v / m.cov.days : 0) : v);
    const fm = (v) => U.fmtMoney(v, { decimals: st.perDay ? 2 : 0 });
    const complete = rows.filter((r) => r.cov.complete);
    let html = '';
    html += '<section class="card mt"><div class="card-head"><h2>Udvikling</h2><span class="sub">' + (st.perDay ? 'Gennemsnit pr. dag med data' : 'Pr. måned') + '</span></div>' +
      GB.charts.lines([
        { label: 'Indtægter', color: 'var(--chart-income)', values: rows.map((r) => div(r, r.income)) },
        { label: 'Udgifter', color: '#f97316', values: rows.map((r) => div(r, r.expense)) },
        { label: 'Opsparing', color: '#6366f1', values: rows.map((r) => div(r, r.savings)) },
      ], rows.map((r) => U.fmtMonth(r.month, true) + (r.cov.complete ? '' : '*'))) + '</section>';

    html += '<section class="card flush mt"><div class="table-wrap"><table><thead><tr><th>Måned</th><th class="r">Indtægter</th><th class="r">Udgifter</th><th class="r">Netto</th><th class="r">Opsparing</th><th class="r">Udgifter ift. måneden før</th></tr></thead><tbody>' +
      rows.map((r, i) => {
        const prev = rows[i - 1];
        const ch = prev ? An.change(div(r, r.expense), div(prev, prev.expense)) : null;
        const fair = prev && (st.perDay || (r.cov.complete && prev.cov.complete));
        return '<tr><td>' + esc(U.capitalize(U.fmtMonth(r.month))) + (r.cov.complete ? '' : ' <span class="badge notice" title="' + esc(r.cov.reason) + '">' + esc(r.cov.reason || 'ufuldstændig') + '</span>') + '</td>' +
          '<td class="r num pos">' + esc(fm(div(r, r.income))) + '</td><td class="r num">' + esc(fm(div(r, r.expense))) + '</td>' +
          '<td class="r num ' + (r.net < 0 ? 'neg' : '') + '">' + esc(U.fmtMoney(div(r, r.net), { decimals: st.perDay ? 2 : 0, sign: true })) + '</td><td class="r num">' + esc(fm(div(r, r.savings))) + '</td>' +
          '<td class="r num">' + (ch && fair ? esc(U.fmtMoney(ch.diff, { decimals: 0, sign: true })) + (ch.pct != null ? ' <span class="muted">(' + (ch.diff >= 0 ? '+' : '−') + esc(U.fmtPct(Math.abs(ch.pct))) + ')</span>' : '') : '<span class="muted" title="Sammenlignes kun, når begge måneder er hele – eller vælg gennemsnit pr. dag">–</span>') + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td>Gennemsnit (' + complete.length + ' hele mdr.)</td>' +
      (complete.length ? ['income', 'expense', 'net', 'savings'].map((k) => '<td class="r num">' + esc(U.fmtMoney(U.sumAmounts(complete, (r) => r[k]) / complete.length, { decimals: 0 })) + '</td>').join('') : '<td colspan="4" class="muted">Ingen hele måneder</td>') + '<td></td></tr></tfoot></table></div></section>';

    // Kategori × måned
    const groupMode = !st.subs;
    const keyOf = (id) => (groupMode ? c.calc.groupOf(id) : id);
    const matrix = new Map();
    rows.forEach((r, i) => { for (const [id, v] of r.byCategory) { const k = keyOf(id); if (!matrix.has(k)) matrix.set(k, new Array(rows.length).fill(0)); matrix.get(k)[i] += v; } });
    const keys = [...matrix.keys()].sort((a, b) => matrix.get(b).reduce((s, v) => s + v, 0) - matrix.get(a).reduce((s, v) => s + v, 0));
    html += '<section class="card flush mt"><div class="card-head" style="padding:16px 20px 0"><h2>Udgifter pr. kategori og måned</h2><label class="check small"><input type="checkbox" id="cmpSubs"' + (st.subs ? ' checked' : '') + '> Vis underkategorier</label></div>' +
      '<div class="table-wrap mt-s"><table class="compact"><thead><tr><th>Kategori</th>' + rows.map((r) => '<th class="r">' + esc(U.fmtMonth(r.month, true)) + (r.cov.complete ? '' : '*') + '</th>').join('') + '<th class="r">Gns. hele mdr.</th></tr></thead><tbody>' +
      keys.map((k) => {
        const vals = matrix.get(k);
        const comp = rows.map((r, i) => (r.cov.complete ? vals[i] : null)).filter((v) => v != null);
        return '<tr><td>' + UI.catChip(k) + '</td>' + vals.map((v, i) => '<td class="r num">' + (v ? esc(fm(div(rows[i], v))) : '<span class="muted">–</span>') + '</td>').join('') +
          '<td class="r num"><b>' + (comp.length ? esc(fm(comp.reduce((s, v) => s + v, 0) / comp.length)) : '–') + '</b></td></tr>';
      }).join('') + '</tbody></table></div><p class="small muted" style="padding:10px 20px">* ufuldstændig måned – gennemsnittet bruger kun hele måneder.</p></section>';
    return html;
  }

  function pairView(c, txs, range) {
    const sa = c.calc.summarize(GB.budgets.filterMonth(txs, st.a)), sb = c.calc.summarize(GB.budgets.filterMonth(txs, st.b));
    const ca = An.monthCoverage(st.a, range, c.today), cb = An.monthCoverage(st.b, range, c.today);
    const head = (mk, cov) => esc(U.capitalize(U.fmtMonth(mk))) + (cov.complete ? '' : ' <span class="badge notice">' + esc(cov.reason || 'ufuldstændig') + '</span>');
    const line = (label, a, b, inv) => {
      const ch = An.change(a, b);
      return '<tr><td>' + esc(label) + '</td><td class="r num">' + esc(U.fmtMoney(a, { decimals: 0 })) + '</td><td class="r num">' + esc(U.fmtMoney(b, { decimals: 0 })) + '</td><td class="r num">' + esc(U.fmtMoney(ch.diff, { decimals: 0, sign: true })) + '</td><td class="r">' + (ch.pct != null ? UI.trend(ch, inv) || '<span class="muted">0 %</span>' : '<span class="muted" title="Ingen procent, når grundlaget er 0">–</span>') + '</td></tr>';
    };
    const groupIds = new Set([...sa.byGroup.keys(), ...sb.byGroup.keys()]);
    const groups = [...groupIds].sort((x, y) => (sa.byGroup.get(y) || 0) + (sb.byGroup.get(y) || 0) - (sa.byGroup.get(x) || 0) - (sb.byGroup.get(x) || 0));
    return (!ca.complete || !cb.complete ? '<div class="note warn mt">' + icon('alert') + '<p>Mindst én af månederne er ufuldstændig, så forskellene kan være misvisende.</p></div>' : '') +
      '<section class="card flush mt"><div class="table-wrap"><table><thead><tr><th></th><th class="r">' + head(st.a, ca) + '</th><th class="r">' + head(st.b, cb) + '</th><th class="r">Forskel</th><th class="r">Ændring</th></tr></thead><tbody>' +
      line('Indtægter', sa.income, sb.income) + line('Udgifter', sa.expense, sb.expense, true) + line('Netto', sa.net, sb.net) + line('Opsparing', sa.savings, sb.savings) +
      '<tr><td colspan="5" style="background:var(--panel-2);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Udgifter pr. område</td></tr>' +
      groups.map((g) => line(UI.catName(g), sa.byGroup.get(g) || 0, sb.byGroup.get(g) || 0, true)).join('') + '</tbody></table></div></section>';
  }

  function yearsView(c, txs, range) {
    const y0 = +range.from.slice(0, 4), y1 = +range.to.slice(0, 4);
    const rows = [];
    for (let y = y1; y >= y0; y--) {
      const list = txs.filter((t) => t.date.startsWith(y + '-'));
      const s = c.calc.summarize(list);
      const months = U.monthRange(y + '-01', y + '-12').filter((m) => An.monthCoverage(m, range, c.today).complete);
      const compTx = list.filter((t) => months.includes(U.monthKey(t.date)));
      const cs = c.calc.summarize(compTx);
      rows.push({ y, s, months: months.length, avgExp: months.length ? cs.expense / months.length : null, avgInc: months.length ? cs.income / months.length : null });
    }
    return '<section class="card flush mt"><div class="table-wrap"><table><thead><tr><th>År</th><th class="r">Indtægter</th><th class="r">Udgifter</th><th class="r">Netto</th><th class="r">Opsparing</th><th class="r">Gns. udgift / md.</th><th class="r">Hele måneder</th></tr></thead><tbody>' +
      rows.map((r) => '<tr><td><b>' + r.y + '</b></td><td class="r num pos">' + esc(U.fmtMoney(r.s.income, { decimals: 0 })) + '</td><td class="r num">' + esc(U.fmtMoney(r.s.expense, { decimals: 0 })) + '</td><td class="r num">' + esc(U.fmtMoney(r.s.net, { decimals: 0, sign: true })) + '</td><td class="r num">' + esc(U.fmtMoney(r.s.savings, { decimals: 0 })) + '</td>' +
        '<td class="r num">' + (r.avgExp != null ? esc(U.fmtMoney(r.avgExp, { decimals: 0 })) : '–') + '</td><td class="r num">' + r.months + '</td></tr>').join('') +
      '</tbody></table></div><p class="small muted" style="padding:10px 20px">Årstallene dækker kun de måneder, du har importeret. Gennemsnit pr. måned bruger kun hele måneder.</p></section>';
  }

  function bind(root) {
    const re = () => GB.app.render();
    $$('[data-mode]', root).forEach((b) => b.addEventListener('click', () => { st.mode = b.dataset.mode; re(); }));
    const mon = (id, key) => { const el = $(id, root); if (el) el.addEventListener('change', () => { if (/^\d{4}-\d{2}$/.test(el.value)) { st[key] = el.value; re(); } }); };
    mon('#cmpFrom', 'from'); mon('#cmpTo', 'to'); mon('#cmpA', 'a'); mon('#cmpB', 'b');
    if ($('#cmpYoY', root)) $('#cmpYoY', root).addEventListener('click', () => { st.b = U.addMonthKey(st.a, -12); re(); });
    if ($('#cmpAcc', root)) $('#cmpAcc', root).addEventListener('change', (e) => { st.account = e.target.value; re(); });
    $$('[data-hide]', root).forEach((b) => b.addEventListener('change', () => { st.hidden = $$('[data-hide]:checked', root).map((x) => x.dataset.hide); re(); }));
    $('#cmpOneOff', root).addEventListener('change', (e) => { st.noOneOff = e.target.checked; re(); });
    if ($('#cmpPerDay', root)) $('#cmpPerDay', root).addEventListener('change', (e) => { st.perDay = e.target.checked; re(); });
    if ($('#cmpSubs', root)) $('#cmpSubs', root).addEventListener('change', (e) => { st.subs = e.target.checked; re(); });
  }

  GB.views.compare = { render };
})();
