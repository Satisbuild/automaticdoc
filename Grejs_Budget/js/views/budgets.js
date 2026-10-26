// Budgetter – månedsbudget pr. kategori, forslag ud fra tidligere måneder og periodebudgetter.

(function () {
  'use strict';
  const GB = globalThis.GB;
  const U = GB.util, UI = GB.ui, S = GB.store, B = GB.budgets;
  const { $, $$, esc, icon, money } = UI;

  const st = { month: null };
  const fail = (e) => UI.toast(e.message, 'error');

  function render(root, c) {
    if (!st.month) st.month = U.monthKey(c.today);
    const mk = st.month;
    const calc = c.calc;
    const ev = B.evaluate(S.data.budgets, mk, S.data.transactions, calc, c.settings.thresholds);
    const cov = GB.analytics.monthCoverage(mk, GB.analytics.dataRange(S.data.transactions), c.today);

    let html = '<div class="row between"><div class="row" role="group" aria-label="Vælg måned">' +
      '<button type="button" class="btn icon-only" data-m="-1" aria-label="Forrige måned">' + icon('left') + '</button>' +
      '<label class="sr-only" for="bMonth">Måned</label><input type="month" id="bMonth" value="' + esc(mk) + '" style="width:auto">' +
      '<button type="button" class="btn icon-only" data-m="1" aria-label="Næste måned">' + icon('right') + '</button>' +
      '<h2 style="margin-left:6px">' + esc(U.capitalize(U.fmtMonth(mk))) + '</h2>' + (cov.partial || !cov.complete ? ' <span class="badge notice" title="' + esc(cov.reason) + '">' + esc(cov.reason || 'Ufuldstændig') + '</span>' : '') + '</div>' +
      (ev.plan ? '<div class="row">' + (B.completeMonths(GB.analytics.dataRange(S.data.transactions), c.today, 3).length ? '<button type="button" class="btn" data-act="suggest" data-n="3">' + icon('spark') + 'Foreslå budget</button>' : '') + '<button type="button" class="btn" data-act="copy-next">' + icon('copy') + 'Kopiér til næste måned</button>' + (!ev.inherited ? '<button type="button" class="btn danger" data-act="delete-plan">' + icon('trash') + 'Slet</button>' : '') + '</div>' : '') + '</div>';

    if (!ev.plan) html += noPlan(c, mk);
    else html += planView(ev, c);
    html += periodBudgets(c);
    root.innerHTML = html;
    bind(root, c, ev);
  }

  function noPlan(c, mk) {
    const prev = S.data.budgets.filter((b) => b.month < mk).sort((a, b) => b.month.localeCompare(a.month))[0];
    const months3 = B.completeMonths(GB.analytics.dataRange(S.data.transactions), c.today, 3);
    const months6 = B.completeMonths(GB.analytics.dataRange(S.data.transactions), c.today, 6);
    return '<div class="card mt">' + UI.empty('target', 'Intet budget for ' + U.fmtMonth(mk), 'Læg et realistisk budget for måneden. Grejs Budget kan foreslå beløb ud fra dine tidligere hele måneder – du godkender selv hvert beløb.',
      (prev ? '<button type="button" class="btn" data-act="copy-from" data-from="' + esc(prev.month) + '">' + icon('copy') + 'Kopiér fra ' + esc(U.fmtMonth(prev.month)) + '</button>' : '') +
      (months3.length ? '<button type="button" class="btn" data-act="suggest" data-n="3">' + icon('spark') + 'Foreslå ud fra ' + months3.length + ' mdr.</button>' : '') +
      (months6.length > months3.length ? '<button type="button" class="btn" data-act="suggest" data-n="6">' + icon('spark') + 'Foreslå ud fra ' + months6.length + ' mdr.</button>' : '') +
      '<button type="button" class="btn primary" data-act="blank">' + icon('plus') + 'Start fra bunden</button>') +
      (!months3.length && S.data.transactions.length ? '<p class="small muted" style="text-align:center">Forslag kræver mindst én hel måned med data.</p>' : '') + '</div>';
  }

  function planView(ev, c) {
    const p = ev.plan;
    const free = U.round2((p.expectedIncome || 0) - ev.totalBudget - (p.savingsTarget || 0));
    const savedNow = ev.summary.savings;
    let html = ev.inherited ? '<div class="banner info mt">' + icon('info') + '<span>Der er ikke lagt et budget for ' + esc(U.fmtMonth(ev.month)) + ', så budgettet fra <b>' + esc(U.fmtMonth(ev.fromMonth)) + '</b> bruges. Retter du noget, gemmes det som et nyt budget for ' + esc(U.fmtMonth(ev.month)) + '.</span></div>' : '';
    html += '<div class="kpis mt">' +
      '<div class="kpi"><div class="kpi-label">' + icon('target') + 'Budget brugt</div><div class="kpi-value">' + esc(U.fmtPct(ev.total.pct)) + '</div><div class="kpi-sub">' + esc(U.fmtMoney(ev.summary.expense, { decimals: 0 })) + ' af ' + esc(U.fmtMoney(ev.totalBudget, { decimals: 0 })) + '</div>' + UI.bar(ev.total.pct, ev.total.level, { thin: true, label: 'Samlet budget brugt' }) + '</div>' +
      '<div class="kpi"><div class="kpi-label">' + icon('wallet') + 'Tilbage af budgettet</div><div class="kpi-value ' + (ev.total.left < 0 ? 'neg' : '') + '">' + esc(U.fmtMoney(ev.total.left, { decimals: 0 })) + '</div><div class="kpi-sub">' + UI.levelBadge(ev.total.level, ev.total.label) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">' + icon('piggy') + 'Opsparing</div><div class="kpi-value">' + esc(U.fmtMoney(savedNow, { decimals: 0 })) + '</div><div class="kpi-sub">Mål: ' + esc(U.fmtMoney(p.savingsTarget || 0, { decimals: 0 })) + '</div>' + (p.savingsTarget ? UI.bar((savedNow / p.savingsTarget) * 100, savedNow >= p.savingsTarget ? 'ok' : '', { thin: true }) : '') + '</div>' +
      '<div class="kpi accent"><div class="kpi-label">' + icon('income') + 'Råderum efter plan</div><div class="kpi-value ' + (free >= 0 ? 'pos' : 'neg') + '">' + esc(U.fmtMoney(free, { decimals: 0, sign: true })) + '</div><div class="kpi-sub">Forventede indtægter − budget − opsparingsmål</div></div></div>';

    html += '<section class="card mt"><div class="card-head"><h2>Plan for måneden</h2></div><div class="fields">' +
      '<div class="field"><label for="pInc">Forventede indtægter (kr.)</label><input type="text" inputmode="decimal" id="pInc" value="' + esc(UI.amountInputValue(p.expectedIncome || '')) + '"><span class="hint">Faktisk: ' + esc(U.fmtMoney(ev.summary.income, { decimals: 0 })) + '</span></div>' +
      '<div class="field"><label for="pSav">Opsparingsmål (kr.)</label><input type="text" inputmode="decimal" id="pSav" value="' + esc(UI.amountInputValue(p.savingsTarget || '')) + '"></div>' +
      '<div class="field"><label for="pTot">Samlet udgiftsbudget (kr.)</label><input type="text" inputmode="decimal" id="pTot" value="' + esc(UI.amountInputValue(p.total || '')) + '" placeholder="' + esc(UI.amountInputValue(ev.linesTotal)) + '"><span class="hint">Tom = summen af kategorierne (' + esc(U.fmtMoney(ev.linesTotal, { decimals: 0 })) + ')</span></div>' +
      '</div></section>';

    const groupsWithBoth = p.lines.filter((l) => !(S.byId.categories.get(l.categoryId) || {}).parentId && p.lines.some((x) => (S.byId.categories.get(x.categoryId) || {}).parentId === l.categoryId));
    html += '<section class="card flush mt"><div class="card-head" style="padding:16px 20px 0"><h2>Kategorier</h2><span class="sub">Interne overførsler tæller ikke som forbrug' + (c.settings.calcRules.refundsOffset ? ', og refusioner trækkes fra' : '') + '</span></div>' +
      (groupsWithBoth.length ? '<div class="note warn" style="margin:12px 20px 0">' + icon('alert') + '<p>Både en hovedkategori og dens underkategorier har budget (' + esc(groupsWithBoth.map((l) => UI.catName(l.categoryId)).join(', ') + '). Forbruget tælles da med begge steder, og summen af linjerne bliver for høj.') + '</p></div>' : '') +
      '<div class="table-wrap mt-s"><table><thead><tr><th>Kategori</th><th class="r">Budget</th><th class="r">Brugt</th><th class="r">Tilbage</th><th style="min-width:180px">Status</th><th title="Overfør ubrugt beløb til næste måned">Overfør rest</th><th></th></tr></thead><tbody>' +
      ev.lines.map((l, i) => '<tr><td>' + UI.catChip(l.line.categoryId) + (l.line.accountId ? '<div class="small muted">' + esc(UI.accountName(l.line.accountId)) + '</div>' : '') + '</td>' +
        '<td class="r"><label class="sr-only" for="lb' + i + '">Budget for ' + esc(UI.catName(l.line.categoryId)) + '</label><input type="text" inputmode="decimal" id="lb' + i + '" data-line="' + i + '" value="' + esc(UI.amountInputValue(l.line.amount)) + '" style="width:110px;text-align:right">' + (l.carry ? '<div class="small muted">+ ' + esc(U.fmtMoney(l.carry, { decimals: 0 })) + ' overført</div>' : '') + '</td>' +
        '<td class="r num">' + esc(U.fmtMoney(l.spent, { decimals: 0 })) + '</td>' +
        '<td class="r num ' + (l.left < 0 ? 'neg' : '') + '">' + esc(U.fmtMoney(l.left, { decimals: 0 })) + '</td>' +
        '<td>' + UI.bar(l.pct, l.level, { label: UI.catName(l.line.categoryId) }) + '<div class="row mt-s" style="gap:6px">' + UI.levelBadge(l.level, l.label) + '<span class="small muted">' + esc(U.fmtPct(l.pct)) + '</span></div></td>' +
        '<td><input type="checkbox" data-roll="' + i + '"' + (l.line.rollover ? ' checked' : '') + ' aria-label="Overfør ubrugt beløb til næste måned"></td>' +
        '<td><button type="button" class="btn sm ghost icon-only" data-del-line="' + i + '" aria-label="Fjern linje">' + icon('trash') + '</button></td></tr>').join('') +
      '</tbody><tfoot><tr><td>I alt</td><td class="r num">' + esc(U.fmtMoney(ev.linesTotal, { decimals: 0 })) + '</td><td class="r num">' + esc(U.fmtMoney(U.sumAmounts(ev.lines, (l) => l.spent), { decimals: 0 })) + '</td><td colspan="4"></td></tr></tfoot></table></div>' +
      '<div class="row" style="padding:14px 20px;border-top:1px solid var(--border)"><label class="sr-only" for="newCat">Kategori</label><select id="newCat" style="max-width:280px">' + UI.categoryOptions('', { allLabel: 'Vælg kategori …', allowGroups: true }) + '</select>' +
      '<label class="sr-only" for="newAmt">Beløb</label><input type="text" inputmode="decimal" id="newAmt" placeholder="Beløb" style="width:120px">' +
      (S.data.accounts.length > 1 ? '<label class="sr-only" for="newAcc">Konto</label><select id="newAcc" style="max-width:200px">' + UI.accountOptions('', 'Alle konti') + '</select>' : '') +
      '<button type="button" class="btn primary" data-act="add-line">' + icon('plus') + 'Tilføj</button></div></section>';

    const unbudgeted = [...ev.summary.byCategory].filter(([id, v]) => v > 0 && !p.lines.some((l) => l.categoryId === id || l.categoryId === (S.byId.categories.get(id) || {}).parentId)).sort((a, b) => b[1] - a[1]);
    if (unbudgeted.length) {
      html += '<section class="card mt"><div class="card-head"><h2>Forbrug uden budget</h2><span class="sub">' + esc(U.fmtMoney(U.sumAmounts(unbudgeted, (x) => x[1]), { decimals: 0 })) + ' i alt</span></div><ul class="list">' +
        unbudgeted.slice(0, 8).map(([id, v]) => '<li>' + UI.catIcon(id) + '<span class="grow title">' + esc(UI.catName(id)) + '</span><span class="num">' + esc(U.fmtMoney(v, { decimals: 0 })) + '</span><button type="button" class="btn sm" data-quick="' + esc(id) + '" data-v="' + Math.ceil(v / 50) * 50 + '">' + icon('plus') + 'Budget</button></li>').join('') + '</ul></section>';
    }
    return html;
  }

  function periodBudgets(c) {
    const list = S.data.periodBudgets.slice().sort((a, b) => b.from.localeCompare(a.from));
    return '<section class="card mt"><div class="card-head"><h2>' + icon('calendar') + 'Periodebudgetter</h2><button type="button" class="btn sm" data-act="new-period">' + icon('plus') + 'Nyt periodebudget</button></div>' +
      '<p class="small muted">Til fx ferie eller julegaver – et samlet beløb for en bestemt periode og udvalgte kategorier.</p>' +
      (list.length ? '<ul class="list">' + list.map((pb) => {
        const s = B.periodStatus(pb, S.data.transactions, c.calc, c.settings.thresholds);
        return '<li><div class="grow"><div class="title">' + esc(pb.name) + '</div><div class="meta">' + esc(U.fmtDate(pb.from, { short: true })) + ' – ' + esc(U.fmtDate(pb.to, { short: true })) + ' · ' + esc((pb.categoryIds || []).length ? pb.categoryIds.map((x) => UI.catName(x)).join(', ') : 'Alle udgifter') + '</div>' +
          '<div class="mt-s">' + UI.bar(s.pct, s.level, { thin: true, label: pb.name }) + '</div></div><div class="amount"><div class="num">' + esc(U.fmtMoney(s.spent, { decimals: 0 })) + ' / ' + esc(U.fmtMoney(pb.amount, { decimals: 0 })) + '</div>' + UI.levelBadge(s.level, s.label) + '</div>' +
          '<button type="button" class="btn sm ghost icon-only" data-edit-pb="' + esc(pb.id) + '" aria-label="Redigér">' + icon('edit') + '</button><button type="button" class="btn sm ghost icon-only" data-del-pb="' + esc(pb.id) + '" aria-label="Slet">' + icon('trash') + '</button></li>';
      }).join('') + '</ul>' : '') + '</section>';
  }

  // Gemmer planen. Er den videreført fra en tidligere måned, gemmes en kopi for den viste måned.
  async function savePlan(ev, mutate) {
    const base = ev.inherited ? B.copyPlan(ev.plan, ev.month) : Object.assign({}, ev.plan, { lines: ev.plan.lines.map((l) => Object.assign({}, l)) });
    mutate(base);
    base.updatedAt = new Date().toISOString();
    delete base.isSample;
    await S.put('budgets', base).catch(fail);
    if (ev.inherited) UI.toast('Gemt som budget for ' + U.fmtMonth(ev.month));
    GB.app.refresh();
  }

  function bind(root, c, ev) {
    const go = (n) => { st.month = U.addMonthKey(st.month, n); GB.app.render(); };
    $$('[data-m]', root).forEach((b) => b.addEventListener('click', () => go(+b.dataset.m)));
    $('#bMonth', root).addEventListener('change', (e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) { st.month = e.target.value; GB.app.render(); } });

    const num = (v) => { const x = UI.readAmount(v); return x == null ? 0 : Math.max(0, x); };
    if (ev.plan) {
      const field = (sel, key) => $(sel, root).addEventListener('change', (e) => savePlan(ev, (p) => { p[key] = num(e.target.value); }));
      field('#pInc', 'expectedIncome'); field('#pSav', 'savingsTarget'); field('#pTot', 'total');
      $$('[data-line]', root).forEach((inp) => inp.addEventListener('change', () => savePlan(ev, (p) => { p.lines[+inp.dataset.line].amount = num(inp.value); })));
      $$('[data-roll]', root).forEach((inp) => inp.addEventListener('change', () => savePlan(ev, (p) => { p.lines[+inp.dataset.roll].rollover = inp.checked; })));
    }

    root.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (b.dataset.delLine != null) savePlan(ev, (p) => { p.lines.splice(+b.dataset.delLine, 1); });
      if (b.dataset.quick) savePlan(ev, (p) => { p.lines.push({ categoryId: b.dataset.quick, amount: +b.dataset.v, rollover: false, accountId: null }); });
      if (act === 'add-line') {
        const cat = $('#newCat', root).value, amt = UI.readAmount($('#newAmt', root).value);
        const acc = $('#newAcc', root) ? $('#newAcc', root).value || null : null;
        if (!cat) { UI.toast('Vælg en kategori', 'warn'); return; }
        if (!(amt > 0)) { UI.toast('Skriv et beløb større end 0', 'warn'); $('#newAmt', root).focus(); return; }
        if (ev.plan.lines.some((l) => l.categoryId === cat && (l.accountId || null) === acc)) { UI.toast('Kategorien har allerede et budget – ret beløbet i tabellen', 'warn'); return; }
        savePlan(ev, (p) => { p.lines.push({ categoryId: cat, amount: amt, rollover: false, accountId: acc }); });
      }
      if (act === 'blank') {
        await S.put('budgets', { id: st.month, month: st.month, expectedIncome: 0, savingsTarget: 0, total: 0, lines: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).catch(fail);
        GB.app.refresh();
      }
      if (act === 'copy-from') {
        await S.put('budgets', B.copyPlan(S.byId.budgets.get(b.dataset.from), st.month)).catch(fail);
        UI.toast('Budgettet er kopieret');
        GB.app.refresh();
      }
      if (act === 'copy-next') {
        const next = U.addMonthKey(st.month, 1);
        if (S.byId.budgets.has(next) && !(await UI.confirm({ title: 'Overskriv budget?', message: U.capitalize(U.fmtMonth(next)) + ' har allerede et budget. Skal det erstattes af en kopi af ' + U.fmtMonth(st.month) + '?', confirmLabel: 'Erstat', danger: true }))) return;
        await S.put('budgets', B.copyPlan(ev.plan, next)).catch(fail);
        st.month = next;
        UI.toast('Budgettet er kopieret til ' + U.fmtMonth(next));
        GB.app.refresh();
      }
      if (act === 'delete-plan') {
        if (await UI.confirm({ title: 'Slet budget', message: 'Budgettet for ' + U.fmtMonth(st.month) + ' slettes. Dine transaktioner røres ikke.', confirmLabel: 'Slet', danger: true })) {
          await S.remove('budgets', st.month).catch(fail);
          GB.app.refresh();
        }
      }
      if (act === 'suggest') suggestDialog(c, +b.dataset.n);
      if (act === 'new-period') periodDialog(null);
      if (b.dataset.editPb) periodDialog(S.byId.periodBudgets.get(b.dataset.editPb));
      if (b.dataset.delPb) {
        if (await UI.confirm({ title: 'Slet periodebudget', message: 'Periodebudgettet slettes.', confirmLabel: 'Slet', danger: true })) { await S.remove('periodBudgets', b.dataset.delPb).catch(fail); GB.app.refresh(); }
      }
    });
  }

  async function suggestDialog(c, n) {
    const months = B.completeMonths(GB.analytics.dataRange(S.data.transactions), c.today, n);
    const sg = B.suggest(S.data.transactions, c.calc, months, S.byId.categories);
    if (!sg) return;
    const v = await UI.dialog({
      title: 'Forslag til budget', wide: true,
      body: '<p>Beløbene er gennemsnittet af <b>' + esc(months.map((m) => U.fmtMonth(m, true)).join(', ')) + '</b>, rundet op til nærmeste 50 kr. Ret eller fravælg dem, før du godkender.</p>' +
        '<div class="fields"><div class="field"><label for="sInc">Forventede indtægter</label><input type="text" id="sInc" value="' + esc(UI.amountInputValue(sg.expectedIncome)) + '"></div>' +
        '<div class="field"><label for="sSav">Opsparingsmål</label><input type="text" id="sSav" value="' + esc(UI.amountInputValue(sg.savingsTarget)) + '"></div>' +
        '<div class="field"><label for="sTot">Samlet udgiftsbudget</label><input type="text" id="sTot" value="' + esc(UI.amountInputValue(sg.total)) + '"><span class="hint">Gennemsnitligt forbrug: ' + esc(U.fmtMoney(sg.averageExpense, { decimals: 0 })) + '</span></div></div>' +
        '<div class="table-wrap mt"><table class="compact"><thead><tr><th>Med</th><th>Kategori</th><th class="r">Gennemsnit</th><th class="r">Budget</th></tr></thead><tbody>' +
        sg.lines.map((l, i) => '<tr><td><input type="checkbox" data-s="' + i + '" checked aria-label="Medtag ' + esc(UI.catName(l.categoryId)) + '"></td><td>' + UI.catChip(l.categoryId) + '</td><td class="r num">' + esc(U.fmtMoney(l.average, { decimals: 0 })) + '</td>' +
          '<td class="r"><input type="text" inputmode="decimal" data-sa="' + i + '" value="' + esc(UI.amountInputValue(l.amount)) + '" style="width:110px;text-align:right" aria-label="Budget"></td></tr>').join('') + '</tbody></table></div>',
      actions: [{ label: 'Annullér', value: null }, {
        label: 'Godkend budget', primary: true, onClick: (dlg) => ({
          expectedIncome: UI.readAmount($('#sInc', dlg).value) || 0, savingsTarget: UI.readAmount($('#sSav', dlg).value) || 0, total: UI.readAmount($('#sTot', dlg).value) || 0,
          lines: sg.lines.map((l, i) => ($('[data-s="' + i + '"]', dlg).checked ? { categoryId: l.categoryId, amount: Math.max(0, UI.readAmount($('[data-sa="' + i + '"]', dlg).value) || 0), rollover: false, accountId: null } : null)).filter((l) => l && l.amount > 0),
        }),
      }],
    });
    if (!v) return;
    await S.put('budgets', Object.assign({ id: st.month, month: st.month, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, v)).catch(fail);
    UI.toast('Budgettet er gemt');
    GB.app.refresh();
  }

  async function periodDialog(pb) {
    const p = pb || { name: '', from: U.todayISO(), to: U.addMonths(U.todayISO(), 1), amount: '', categoryIds: [], accountId: null };
    const groups = S.data.categories.filter((x) => !x.parentId && x.kind === 'expense' && !x.hidden).sort((a, b) => a.order - b.order);
    const v = await UI.dialog({
      title: pb ? 'Redigér periodebudget' : 'Nyt periodebudget', wide: true,
      body: '<div class="fields"><div class="field"><label for="pbName">Navn</label><input type="text" id="pbName" maxlength="60" value="' + esc(p.name) + '" placeholder="Fx Sommerferie" autofocus></div>' +
        '<div class="field"><label for="pbFrom">Fra</label><input type="date" id="pbFrom" value="' + esc(p.from) + '"></div><div class="field"><label for="pbTo">Til</label><input type="date" id="pbTo" value="' + esc(p.to) + '"></div>' +
        '<div class="field"><label for="pbAmt">Beløb (kr.)</label><input type="text" inputmode="decimal" id="pbAmt" value="' + esc(UI.amountInputValue(p.amount)) + '"></div>' +
        (S.data.accounts.length > 1 ? '<div class="field"><label for="pbAcc">Konto</label><select id="pbAcc">' + UI.accountOptions(p.accountId, 'Alle konti') + '</select></div>' : '') + '</div>' +
        '<fieldset class="mt" style="border:1px solid var(--border);border-radius:12px;padding:12px 14px"><legend class="small" style="font-weight:600">Kategorier (ingen valgt = alle udgifter)</legend><div class="fields" style="gap:8px">' +
        groups.map((g) => '<label class="check"><input type="checkbox" data-pc="' + esc(g.id) + '"' + ((p.categoryIds || []).includes(g.id) ? ' checked' : '') + '> ' + esc(g.name) + '</label>').join('') + '</div></fieldset>',
      actions: [{ label: 'Annullér', value: null }, {
        label: 'Gem', primary: true, onClick: (dlg) => {
          const name = $('#pbName', dlg).value.trim(), from = $('#pbFrom', dlg).value, to = $('#pbTo', dlg).value, amount = UI.readAmount($('#pbAmt', dlg).value);
          if (!name || !U.isValidISO(from) || !U.isValidISO(to) || from > to || !(amount > 0)) { UI.toast('Udfyld navn, gyldige datoer og et beløb', 'warn'); return false; }
          return { name, from, to, amount, accountId: $('#pbAcc', dlg) ? $('#pbAcc', dlg).value || null : null, categoryIds: $$('[data-pc]:checked', dlg).map((x) => x.dataset.pc) };
        },
      }],
    });
    if (!v) return;
    await S.put('periodBudgets', Object.assign({ id: (pb && pb.id) || U.uid('pb'), createdAt: (pb && pb.createdAt) || new Date().toISOString() }, v)).catch(fail);
    GB.app.refresh();
  }

  GB.views.budgets = { render };
})();
