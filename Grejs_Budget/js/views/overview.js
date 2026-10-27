// Overblik – økonomiens forside.

(function () {
  'use strict';
  const GB = globalThis.GB;
  const U = GB.util, UI = GB.ui, S = GB.store;
  const { esc, icon, money } = UI;
  const MP = 'other-mobilepay';

  function welcome() {
    return '<section class="welcome">' +
      '<div><h2>Velkommen til <b>Grejs Budget</b></h2>' +
      '<p>Få overblik over, hvor pengene bliver af. Importér bankudtog fra flere måneder og konti, få dem kategoriseret automatisk, læg et budget og følg udviklingen måned for måned.</p>' +
      '<ul class="feature-list">' +
      '<li>' + icon('lock') + '<span>Dine data bliver i denne browser på denne enhed. Intet uploades, ingen login og ingen bankforbindelse.</span></li>' +
      '<li>' + icon('upload') + '<span>Hent en CSV- eller Excel-fil i din netbank og træk den ind – flere måneder og flere filer på én gang.</span></li>' +
      '<li>' + icon('wifi-off') + '<span>Virker også uden internet, når siden først er indlæst.</span></li></ul>' +
      '<div class="row"><a class="btn brand" href="#/importer">' + icon('upload') + 'Importér bankfil</a><button type="button" class="btn" data-action="sample">' + icon('spark') + 'Prøv med eksempeldata</button></div></div>' +
      '<img class="logo" src="assets/grejs-budget-logo.png" alt="Grejs Budget-logo: tegnebog med en grøn graf og en mønt med kr" width="340" height="340"></section>';
  }

  // Sammenligner med forrige måned (samme dage, hvis måneden ikke er slut).
  function prevComparable(c) {
    const singleMonth = U.monthKey(c.range.from) === U.monthKey(c.range.to) && c.range.from.endsWith('-01');
    if (!singleMonth) return null;
    const mk = U.monthKey(c.range.from);
    const prev = U.addMonthKey(mk, -1);
    if (!c.dataRange.from || c.dataRange.from > U.addDays(U.monthStart(prev), 2)) return null;
    const running = c.today >= c.range.from && c.today < c.range.to;
    const lastDay = running ? U.parts(c.today).d : 31;
    const to = U.iso(+prev.slice(0, 4), +prev.slice(5, 7), Math.min(lastDay, U.daysInMonth(+prev.slice(0, 4), +prev.slice(5, 7))));
    const curTo = running ? c.today : c.range.to;
    const out = {
      prev: c.calc.summarize(c.txs.filter((t) => t.date >= U.monthStart(prev) && t.date <= to)),
      cur: c.calc.summarize(c.txs.filter((t) => t.date >= c.range.from && t.date <= curTo)),
      label: running ? 'mod 1.–' + lastDay + '. ' + U.MONTHS_SHORT[+prev.slice(5, 7) - 1] : 'mod ' + U.fmtMonth(prev),
    };
    return out.prev.count && out.cur.count ? out : null;
  }

  function kpi(label, ic, value, sub, extra) {
    return '<div class="kpi' + (extra && extra.cls ? ' ' + extra.cls : '') + '"><div class="kpi-label">' + icon(ic) + esc(label) + '</div><div class="kpi-value' + (extra && extra.valueCls ? ' ' + extra.valueCls : '') + '">' + value + '</div>' +
      (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') + (extra && extra.after ? extra.after : '') + '</div>';
  }

  function render(root, c) {
    if (!S.data.transactions.length) {
      root.innerHTML = welcome();
      root.querySelector('[data-action="sample"]').addEventListener('click', () => GB.actions.loadSample());
      return;
    }
    const calc = c.calc;
    const sum = calc.summarize(c.periodTxs);
    const cmp = prevComparable(c);
    const todayMk = U.monthKey(c.today);
    const ev = GB.budgets.evaluate(S.data.budgets, todayMk, c.txs, calc, c.settings.thresholds);
    const monthEnd = U.monthEnd(todayMk);
    const upcoming = [];
    for (const r of S.data.recurring.filter((x) => x.status === 'confirmed')) {
      for (const d of GB.recurring.occurrencesBetween(r, U.addDays(c.today, 1), U.addDays(c.today, 30))) upcoming.push({ r, d });
    }
    upcoming.sort((a, b) => a.d.localeCompare(b.d));
    const restOfMonth = upcoming.filter((x) => x.d <= monthEnd);
    const restSum = U.sumAmounts(restOfMonth, (x) => x.r.amount);
    const variable = restOfMonth.some((x) => x.r.amountMax && x.r.amountMin && x.r.amountMax - x.r.amountMin > x.r.amount * 0.1);

    let html = '';
    if (!c.periodTxs.length) {
      const last = c.dataRange.to;
      html += '<div class="note warn" style="margin-bottom:18px">' + icon('info') + '<div><p>Der er ingen transaktioner i <b>' + esc(c.label.toLowerCase()) + '</b>' + (last ? '. Dine seneste data er fra ' + esc(U.fmtDate(last)) + '.' : '.') + '</p>' +
        (last ? '<button type="button" class="btn sm" data-action="jump" data-month="' + esc(U.monthKey(last)) + '">Vis ' + esc(U.fmtMonth(U.monthKey(last))) + '</button>' : '') + '</div></div>';
    }

    const t = (a, b, inv) => (cmp ? UI.trend(GB.analytics.change(a, b), inv) : '');
    // MobilePay vises delt op i penge ind (indtægt) og penge ud (udgift).
    const mp = { in: sum.incomeByCategory.get(MP) || 0, out: sum.byCategory.get(MP) || 0, txs: c.periodTxs.filter((x) => x.categoryId === MP && c.calc.classify(x).type !== 'transfer') };
    const mpNote = (v) => (v ? { after: '<div class="kpi-sub">heraf MobilePay: ' + esc(U.fmtMoney(v, { decimals: 0 })) + '</div>' } : null);
    html += '<div class="section-title"><p class="muted" style="margin:0">' + icon('calendar') + ' <b>' + esc(c.label) + '</b>' + (c.accountId ? ' · ' + esc(UI.accountName(c.accountId)) : ' · alle konti') + '</p>' +
      (cmp ? '<span class="small muted">Pile viser ændring ' + esc(cmp.label) + '</span>' : '') + '</div>';
    html += '<div class="kpis">' +
      kpi('Indtægter', 'income', esc(U.fmtMoney(sum.income, { decimals: 0 })), t(cmp && cmp.cur.income, cmp && cmp.prev.income) || '&nbsp;', mpNote(mp.in)) +
      kpi('Udgifter', 'cart', esc(U.fmtMoney(sum.expense, { decimals: 0 })), t(cmp && cmp.cur.expense, cmp && cmp.prev.expense, true) || '&nbsp;', mpNote(mp.out)) +
      kpi('Tilbage', 'wallet', esc(U.fmtMoney(sum.net, { decimals: 0, sign: true })), 'Indtægter minus udgifter', { cls: 'accent', valueCls: sum.net >= 0 ? 'pos' : 'neg' }) +
      kpi('Opsparing', 'piggy', esc(U.fmtMoney(sum.savings, { decimals: 0 })), ev.plan && ev.savingsTarget ? 'Mål: ' + esc(U.fmtMoney(ev.savingsTarget, { decimals: 0 })) + ' pr. måned' : 'Overført til opsparing og investering') +
      (ev.plan && ev.totalBudget ? kpi('Budget brugt · ' + U.MONTHS[+todayMk.slice(5, 7) - 1], 'target', esc(U.fmtPct(ev.total.pct)), esc(U.fmtMoney(ev.summary.expense, { decimals: 0 })) + ' af ' + esc(U.fmtMoney(ev.totalBudget, { decimals: 0 })), { after: UI.bar(ev.total.pct, ev.total.level, { thin: true, label: 'Budget brugt' }) })
        : kpi('Budget', 'target', '–', '<a href="#/budgetter">Læg et budget</a>')) +
      kpi('Faste betalinger resten af måneden', 'repeat', esc(U.fmtMoney(restSum, { decimals: 0 })), restOfMonth.length ? restOfMonth.length + ' forventede' + (variable ? ' · beløb er estimater' : '') : (S.data.recurring.some((r) => r.status === 'confirmed') ? 'Ingen flere i denne måned' : '<a href="#/faste-betalinger">Find faste betalinger</a>')) +
      '</div>';
    html += '<p class="small muted mt-s">' + icon('info') + ' "Tilbage" er beregnet ud fra de transaktioner, du har importeret – det svarer ikke nødvendigvis til saldoen på din bankkonto. Interne overførsler og opsparing tæller ikke som forbrug.' +
      (sum.foreign ? ' ' + sum.foreign + ' transaktioner i fremmed valuta uden kurs er ikke medregnet.' : '') + '</p>';

    if (S.data.transactions.some((x) => x.categoryId === MP)) {
      // Penge fra andre, der er koblet til en udgift, er ikke indtægt – de vises for sig.
      const linked = c.periodTxs.filter((x) => x.linkedTo && GB.tx.isMobilePay(x) && c.calc.classify(x).type === 'reimbursement');
      const linkedSum = U.sumAmounts(linked, (x) => x.amount);
      const nIn = mp.txs.filter((x) => x.amount > 0 && c.calc.classify(x).type === 'income').length, nOut = mp.txs.filter((x) => x.amount < 0).length;
      html += '<section class="card mt"><div class="card-head"><h2>' + icon('phone') + 'MobilePay</h2><span class="sub">' + esc(c.label) + '</span></div><div class="summary-grid">' +
        '<button type="button" class="s insight" data-mp="income" style="display:block"><b class="pos">' + esc(U.fmtMoney(mp.in, { decimals: 0, sign: true })) + '</b><span>Indtægt · ' + nIn + ' modtaget</span></button>' +
        '<button type="button" class="s insight" data-mp="reimbursement" style="display:block"><b>' + esc(U.fmtMoney(linkedSum, { decimals: 0 })) + '</b><span>Penge fra andre · ' + linked.length + ' koblet til udgifter</span></button>' +
        '<button type="button" class="s insight" data-mp="expense" style="display:block"><b>' + esc(U.fmtMoney(-mp.out, { decimals: 0 })) + '</b><span>Udgift · ' + nOut + ' sendt</span></button>' +
        '<div class="s"><b class="' + (mp.in - mp.out >= 0 ? 'pos' : 'neg') + '">' + esc(U.fmtMoney(mp.in - mp.out, { decimals: 0, sign: true })) + '</b><span>Netto (indtægt minus udgift)</span></div>' +
        '</div><p class="small muted mt-s">Har du lagt ud for andre, og har de sendt deres andel med MobilePay? Åbn udgiften (fx Land og Fritid) eller beløbet og kobl dem sammen under <b>Penge fra andre</b>. Så tæller pengene ikke som indtægt, men trækkes fra udgiften, så du kan se, hvad du selv har brugt.</p></section>';
    }

    // Grafer
    // Grafen slutter ved periodens slutning – eller ved de seneste data, hvis perioden ligger efter dem.
    let endMk = U.monthKey(c.range.to > c.today && c.range.from <= c.today ? c.today : c.range.to);
    if (c.dataRange.to && U.monthKey(c.dataRange.to) < endMk && !c.periodTxs.length) endMk = U.monthKey(c.dataRange.to);
    let startMk = U.monthKey(c.range.from);
    if (U.monthRange(startMk, endMk).length < 6) startMk = U.addMonthKey(endMk, -5);
    if (c.dataRange.from && startMk < U.monthKey(c.dataRange.from)) startMk = U.monthKey(c.dataRange.from) > endMk ? endMk : U.monthKey(c.dataRange.from);
    let months = U.monthRange(startMk, endMk);
    if (months.length > 13) months = months.slice(-13);
    const bm = calc.byMonth(c.txs, months).map((m) => ({ label: U.fmtMonth(m.month, true), income: m.income, expense: m.expense, partial: !GB.analytics.monthCoverage(m.month, c.dataRange, c.today).complete }));
    const groups = [...sum.byGroup].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const top = groups.slice(0, 6);
    const rest = groups.slice(6).reduce((s, [, v]) => s + v, 0);
    const items = top.map(([id, v]) => ({ id, label: UI.catOf(id).name, value: v, color: UI.catOf(id).color }));
    if (rest > 0) items.push({ id: null, label: 'Andre', value: rest, color: '#cbd5e1' });

    html += '<div class="grid grid-main mt">' +
      '<section class="card"><div class="card-head"><h2>Indtægter og udgifter pr. måned</h2><span class="sub">' + esc(U.fmtMonth(months[0], true)) + ' – ' + esc(U.fmtMonth(months[months.length - 1], true)) + '</span></div>' + (bm.some((m) => m.income || m.expense) ? GB.charts.incomeExpense(bm) : UI.empty('chart', 'Ingen data i perioden', '')) + '</section>' +
      '<section class="card"><div class="card-head"><h2>Udgifter fordelt</h2><span class="sub">' + esc(c.label) + '</span></div>' +
      (items.length ? '<div class="donut-wrap">' + GB.charts.donut(items, { sub: 'udgifter' }) + '<ul class="list clickable legend-list">' +
        items.map((x) => '<li' + (x.id ? ' data-go-cat="' + esc(x.id) + '"' : '') + ' tabindex="0"><span class="cat-dot" style="background:' + esc(x.color) + ';width:10px;height:10px;border-radius:3px"></span><span class="grow title" style="font-weight:550">' + esc(x.label) + '</span><span class="num small">' + esc(U.fmtPct((x.value / sum.expense) * 100)) + '</span></li>').join('') +
        '</ul></div>' + GB.charts.table(['Område', 'Beløb', 'Andel'], items.map((x) => [x.label, U.fmtMoney(x.value), U.fmtPct((x.value / sum.expense) * 100, 1)]))
        : UI.empty('chart', 'Ingen udgifter i perioden', '')) + '</section></div>';

    // Største kategorier + budget
    const cats = [...sum.byCategory].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCat = cats.length ? cats[0][1] : 1;
    html += '<div class="grid grid-2 mt">' +
      '<section class="card"><div class="card-head"><h2>Største udgiftskategorier</h2><a class="small" href="#/kategorier">Alle kategorier</a></div>' +
      (cats.length ? cats.map(([id, v]) => '<div class="cat-row" data-go-cat="' + esc(id) + '" style="cursor:pointer">' + UI.catIcon(id) + '<div><div class="name"><span>' + esc(UI.catName(id)) + '</span><span class="num">' + esc(U.fmtMoney(v, { decimals: 0 })) + '</span></div>' + UI.bar((v / maxCat) * 100, 'ok', { thin: true }) + '</div><span class="small muted num">' + esc(U.fmtPct((v / sum.expense) * 100)) + '</span></div>').join('')
        : UI.empty('tag', 'Ingen udgifter endnu', '')) + '</section>' +
      '<section class="card"><div class="card-head"><h2>Budgetstatus</h2><span class="sub">' + esc(U.capitalize(U.fmtMonth(todayMk))) + '</span></div>' + budgetBlock(ev) + '</section></div>';

    // Seneste, kommende og indsigter
    const recent = c.txs.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 7);
    const ins = GB.insights.generate(c, S.data, { skipRecurring: false }).slice(0, 4);
    html += '<div class="grid grid-3 mt">' +
      '<section class="card"><div class="card-head"><h2>Seneste transaktioner</h2><a class="small" href="#/transaktioner">Se alle</a></div><ul class="list clickable">' +
      recent.map((t) => '<li data-tx="' + esc(t.id) + '" tabindex="0">' + UI.catIcon(t.categoryId) + '<div class="grow"><div class="title">' + esc(t.description) + '</div><div class="meta">' + esc(U.fmtDate(t.date, { short: true })) + ' · ' + esc(UI.catName(t.categoryId)) + '</div></div><div class="amount">' + UI.txAmount(t) + '</div></li>').join('') + '</ul></section>' +
      '<section class="card"><div class="card-head"><h2>Faste betalinger</h2><span class="sub">næste 30 dage</span></div>' +
      (upcoming.length ? '<ul class="list">' + upcoming.slice(0, 6).map((x) => '<li>' + UI.catIcon(x.r.categoryId) + '<div class="grow"><div class="title">' + esc(x.r.name) + '</div><div class="meta">' + esc(U.fmtDate(x.d, { short: true })) + ' · ' + esc(GB.recurring.FREQUENCIES[x.r.frequency].label) + '</div></div><div class="amount num">' + (x.r.amountMax - x.r.amountMin > x.r.amount * 0.1 ? 'ca. ' : '') + esc(U.fmtMoney(-x.r.amount, { decimals: 0 })) + '</div></li>').join('') + '</ul>'
        : UI.empty('repeat', 'Ingen bekræftede faste betalinger', 'Grejs Budget kan finde dem i dine data.', '<a class="btn sm" href="#/faste-betalinger">Find faste betalinger</a>')) + '</section>' +
      '<section class="card"><div class="card-head"><h2>Indsigter</h2><a class="small" href="#/indsigter">Alle</a></div>' +
      (ins.length ? '<div class="insights">' + ins.map((x, i) => insightBtn(x, i)).join('') + '</div>' : UI.empty('spark', 'Ingen indsigter endnu', 'Der kommer flere, når du har data fra mindst to måneder.')) + '</section></div>';

    root.innerHTML = html;
    root.addEventListener('click', (e) => onClick(e, c, ins));
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('li[tabindex]')) onClick(e, c, ins); });
  }

  function budgetBlock(ev) {
    if (!ev.plan) return UI.empty('target', 'Intet budget for denne måned', 'Læg et budget, eller lad Grejs Budget foreslå et ud fra dine tidligere måneder.', '<a class="btn sm primary" href="#/budgetter">Læg budget</a>');
    const lines = ev.lines.slice().sort((a, b) => (b.pct || 0) - (a.pct || 0)).slice(0, 5);
    return (ev.inherited ? '<p class="small muted">Videreført fra ' + esc(U.fmtMonth(ev.fromMonth)) + '.</p>' : '') +
      lines.map((l) => '<div class="cat-row">' + UI.catIcon(l.line.categoryId) + '<div><div class="name"><span>' + esc(UI.catName(l.line.categoryId)) + '</span><span class="num small">' + esc(U.fmtMoney(l.spent, { decimals: 0 })) + ' / ' + esc(U.fmtMoney(l.budget, { decimals: 0 })) + '</span></div>' + UI.bar(l.pct, l.level, { thin: true, label: UI.catName(l.line.categoryId) + ' budget' }) + '</div>' + UI.levelBadge(l.level, l.level === 'ok' ? U.fmtPct(l.pct) : l.label) + '</div>').join('') +
      '<div class="card-foot"><a href="#/budgetter">Se hele budgettet</a></div>';
  }

  function insightBtn(x, i) {
    return '<button type="button" class="insight ' + esc(x.kind) + '" data-insight="' + i + '"><span class="ins-icon">' + icon(x.icon) + '</span><span><span class="ins-text">' + esc(x.text) + '</span><span class="ins-why" style="display:block">' + esc(x.why) + '</span></span></button>';
  }

  function onClick(e, c, ins) {
    const el = e.target.closest('[data-tx],[data-go-cat],[data-insight],[data-action],[data-mp]');
    if (!el) return;
    if (el.dataset.mp) GB.app.go('transactions', { categoryId: MP, type: el.dataset.mp, from: c.range.from, to: c.range.to });
    else if (el.dataset.tx) GB.actions.openTransaction(el.dataset.tx);
    else if (el.dataset.goCat) GB.app.go('transactions', { categoryId: el.dataset.goCat, from: c.range.from, to: c.range.to });
    else if (el.dataset.insight) { const a = ins[+el.dataset.insight].action; GB.app.go(a.route, a.params); }
    else if (el.dataset.action === 'jump') {
      const mk = el.dataset.month;
      Object.assign(GB.app.state, { period: 'custom', custom: { from: U.monthStart(mk), to: U.monthEnd(mk) } });
      GB.app.render();
    }
  }

  GB.views.overview = { render, insightBtn };
})();
