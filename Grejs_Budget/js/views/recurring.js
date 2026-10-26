// Faste betalinger og abonnementer.

(function () {
  'use strict';
  const GB = globalThis.GB;
  const U = GB.util, UI = GB.ui, S = GB.store, R = GB.recurring;
  const { $, esc, icon } = UI;
  const fail = (e) => UI.toast(e.message, 'error');

  function amountText(r) {
    const variable = r.amountMax != null && r.amountMin != null && r.amountMax - r.amountMin > r.amount * 0.1;
    return variable ? 'ca. ' + U.fmtMoney(r.amount, { decimals: 0 }) + ' <span class="small muted">(' + esc(U.fmtMoney(r.amountMin, { decimals: 0, noSuffix: true })) + '–' + esc(U.fmtMoney(r.amountMax, { decimals: 0 })) + ')</span>' : esc(U.fmtMoney(r.amount));
  }

  function render(root, c) {
    const confirmed = S.data.recurring.filter((r) => r.status === 'confirmed').sort((a, b) => R.monthlyEquivalent(b) - R.monthlyEquivalent(a));
    const dismissed = S.data.recurring.filter((r) => r.status === 'dismissed');
    const sugg = S.data.transactions.length ? R.detect(S.data.transactions, S.data.recurring, c.calc, GB.analytics.dataRange(S.data.transactions).to) : [];
    const perMonth = confirmed.reduce((s, r) => s + R.monthlyEquivalent(r), 0);
    const anyVariable = confirmed.some((r) => r.amountMax - r.amountMin > r.amount * 0.1);

    let html = '<div class="kpis">' +
      '<div class="kpi"><div class="kpi-label">' + icon('repeat') + 'Bekræftede faste betalinger</div><div class="kpi-value">' + confirmed.length + '</div><div class="kpi-sub">' + sugg.length + ' forslag venter</div></div>' +
      '<div class="kpi"><div class="kpi-label">' + icon('calendar') + 'Pr. måned</div><div class="kpi-value">' + esc(U.fmtMoney(perMonth, { decimals: 0 })) + '</div><div class="kpi-sub">' + (anyVariable ? 'Estimat – nogle beløb varierer' : 'Omregnet til månedligt beløb') + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">' + icon('chart') + 'Pr. år</div><div class="kpi-value">' + esc(U.fmtMoney(perMonth * 12, { decimals: 0 })) + '</div><div class="kpi-sub">Ved uændrede priser</div></div></div>';

    html += '<section class="card flush mt"><div class="card-head" style="padding:16px 20px 0"><h2>Dine faste betalinger</h2><button type="button" class="btn sm primary" data-act="new">' + icon('plus') + 'Tilføj manuelt</button></div>' +
      (confirmed.length ? '<div class="table-wrap mt-s"><table><thead><tr><th>Betaling</th><th>Hyppighed</th><th class="r">Beløb</th><th class="r">Pr. måned</th><th>Seneste</th><th>Næste forventet</th><th></th></tr></thead><tbody>' +
        confirmed.map((r) => '<tr><td>' + UI.catChip(r.categoryId) + ' <b>' + esc(r.name) + '</b>' + (r.manual ? ' <span class="badge">manuel</span>' : '') + (r.notes ? '<div class="small muted">' + esc(r.notes) + '</div>' : '') + '</td>' +
          '<td>' + esc(R.FREQUENCIES[r.frequency].label) + '</td><td class="r num">' + amountText(r) + '</td><td class="r num">' + esc(U.fmtMoney(R.monthlyEquivalent(r), { decimals: 0 })) + '</td>' +
          '<td class="small">' + (r.lastDate ? esc(U.fmtDate(r.lastDate, { short: true })) : '–') + '</td><td class="small">' + esc(U.fmtDate(R.upcoming(r, c.today), { short: true })) + '</td>' +
          '<td class="r"><span class="row end" style="gap:4px;flex-wrap:nowrap">' + (r.matchKey ? '<button type="button" class="btn sm ghost icon-only" data-show="' + esc(r.id) + '" aria-label="Vis transaktioner">' + icon('list') + '</button>' : '') +
          '<button type="button" class="btn sm ghost icon-only" data-edit="' + esc(r.id) + '" aria-label="Redigér">' + icon('edit') + '</button><button type="button" class="btn sm ghost icon-only" data-del="' + esc(r.id) + '" aria-label="Fjern">' + icon('trash') + '</button></span></td></tr>').join('') +
        '</tbody></table></div>' : UI.empty('repeat', 'Ingen bekræftede faste betalinger endnu', 'Bekræft forslagene nedenfor, eller tilføj en fast betaling manuelt.')) + '</section>';

    html += '<section class="card mt"><div class="card-head"><h2>' + icon('spark') + 'Mulige faste betalinger</h2><span class="sub">Fundet ud fra ens tekst, beløb og interval</span></div>' +
      (sugg.length ? '<ul class="list">' + sugg.map((s, i) => '<li>' + UI.catIcon(s.categoryId) + '<div class="grow"><div class="title">' + esc(s.name) + (s.stale ? ' <span class="badge">muligvis stoppet</span>' : '') + '</div><div class="meta">' + esc(R.FREQUENCIES[s.frequency].label) + ' · ' + s.count + ' betalinger · seneste ' + esc(U.fmtDate(s.lastDate, { short: true })) + '</div></div>' +
        '<div class="amount num">' + amountText(s) + '</div><button type="button" class="btn sm" data-stx="' + i + '">Vis</button><button type="button" class="btn sm primary" data-ok="' + i + '">' + icon('check') + 'Bekræft</button><button type="button" class="btn sm ghost" data-no="' + i + '">Ikke fast</button></li>').join('') + '</ul>'
        : '<p class="muted">Ingen nye forslag. ' + (S.data.transactions.length ? 'Der skal typisk være mindst 3 månedlige (eller 2 kvartalsvise/årlige) betalinger til samme modtager.' : 'Importér data først.') + '</p>') +
      (dismissed.length ? '<details class="mt-s"><summary class="small">' + dismissed.length + ' afviste forslag</summary><ul class="list">' + dismissed.map((r) => '<li><span class="grow">' + esc(r.name) + '</span><button type="button" class="btn sm ghost" data-undo="' + esc(r.id) + '">Fortryd</button></li>').join('') + '</ul></details>' : '') + '</section>';

    html += '<div class="note mt">' + icon('info') + '<p>Grejs Budget kan ikke opsige abonnementer eller stoppe betalinger – det skal gøres hos udbyderen eller i din netbank. Du kan skrive egne noter om opsigelse på hver betaling.</p></div>';
    root.innerHTML = html;

    root.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'new') return editDialog(null);
      if (b.dataset.edit) return editDialog(S.byId.recurring.get(b.dataset.edit));
      if (b.dataset.show) { const r = S.byId.recurring.get(b.dataset.show); return GB.app.go('transactions', { ids: S.data.transactions.filter((t) => R.matches(r, t)).map((t) => t.id) }); }
      if (b.dataset.stx) return GB.app.go('transactions', { ids: sugg[+b.dataset.stx].txIds });
      if (b.dataset.del) {
        const r = S.byId.recurring.get(b.dataset.del);
        if (!(await UI.confirm({ title: 'Fjern fast betaling', message: '"' + r.name + '" fjernes fra oversigten. Transaktionerne røres ikke.', confirmLabel: 'Fjern', danger: true }))) return;
        await S.remove('recurring', r.id).catch(fail);
        await GB.actions.linkRecurring();
        return GB.app.refresh();
      }
      if (b.dataset.undo) { await S.remove('recurring', b.dataset.undo).catch(fail); return GB.app.refresh(); }
      if (b.dataset.ok || b.dataset.no) {
        const s = sugg[+(b.dataset.ok || b.dataset.no)];
        const rec = {
          id: U.uid('rec'), name: s.name, matchKey: s.matchKey, accountId: s.accountId, amount: s.amount, amountMin: s.amountMin, amountMax: s.amountMax,
          frequency: s.frequency, lastDate: s.lastDate, nextDate: s.nextDate, status: b.dataset.ok ? 'confirmed' : 'dismissed', manual: false, categoryId: s.categoryId, notes: '', createdAt: new Date().toISOString(),
        };
        if (b.dataset.ok) { const edited = await editDialog(rec, true); if (!edited) return; }
        else { await S.put('recurring', rec).catch(fail); GB.app.refresh(); }
      }
    });
  }

  async function editDialog(rec, isConfirm) {
    const r = rec || { name: '', amount: '', frequency: 'monthly', nextDate: U.todayISO(), categoryId: GB.categories.UNKNOWN_ID, accountId: null, notes: '', matchKey: '', manual: true, status: 'confirmed' };
    const v = await UI.dialog({
      title: isConfirm ? 'Bekræft fast betaling' : rec ? 'Redigér fast betaling' : 'Ny fast betaling',
      body: '<div class="fields"><div class="field"><label for="rName">Navn</label><input type="text" id="rName" maxlength="60" value="' + esc(r.name) + '" autofocus></div>' +
        '<div class="field"><label for="rAmt">Forventet beløb (kr.)</label><input type="text" inputmode="decimal" id="rAmt" value="' + esc(UI.amountInputValue(r.amount)) + '"></div>' +
        '<div class="field"><label for="rFreq">Hyppighed</label><select id="rFreq">' + UI.options(Object.entries(R.FREQUENCIES).map(([k, f]) => [k, f.label]), r.frequency) + '</select></div>' +
        '<div class="field"><label for="rNext">Næste forventede betaling</label><input type="date" id="rNext" value="' + esc(r.nextDate || U.todayISO()) + '"></div>' +
        '<div class="field"><label for="rCat">Kategori</label><select id="rCat">' + UI.categoryOptions(r.categoryId) + '</select></div>' +
        '<div class="field"><label for="rKey">Tekst i banken <span class="hint">(til at finde betalingerne)</span></label><input type="text" id="rKey" maxlength="60" value="' + esc(r.matchKey || '') + '" placeholder="Fx NETFLIX"></div></div>' +
        '<div class="field mt"><label for="rNotes">Noter <span class="hint">(fx opsigelsesvarsel eller kundenummer)</span></label><textarea id="rNotes" maxlength="1000">' + esc(r.notes || '') + '</textarea></div>' +
        (r.amountMax - r.amountMin > r.amount * 0.1 ? '<p class="small muted mt-s">Beløbet har varieret mellem ' + esc(U.fmtMoney(r.amountMin)) + ' og ' + esc(U.fmtMoney(r.amountMax)) + ' – det forventede beløb er et estimat.</p>' : ''),
      actions: [{ label: 'Annullér', value: null }, {
        label: isConfirm ? 'Bekræft' : 'Gem', primary: true, onClick: (dlg) => {
          const name = $('#rName', dlg).value.trim(), amount = UI.readAmount($('#rAmt', dlg).value), next = $('#rNext', dlg).value;
          if (!name || !(Math.abs(amount) > 0) || !U.isValidISO(next)) { UI.toast('Udfyld navn, beløb og dato', 'warn'); return false; }
          return { name, amount: Math.abs(amount), frequency: $('#rFreq', dlg).value, nextDate: next, categoryId: $('#rCat', dlg).value, matchKey: GB.categories.merchantKey($('#rKey', dlg).value) || '', notes: $('#rNotes', dlg).value.trim() };
        },
      }],
    });
    if (!v) return null;
    const out = Object.assign({ id: U.uid('rec'), createdAt: new Date().toISOString(), status: 'confirmed', manual: true }, r, v);
    if (out.amountMin == null || r.amount !== v.amount && out.manual) { out.amountMin = v.amount; out.amountMax = v.amount; }
    await S.put('recurring', out).catch(fail);
    await GB.actions.linkRecurring();
    UI.toast('Den faste betaling er gemt');
    GB.app.refresh();
    return out;
  }

  GB.views.recurring = { render };
})();
