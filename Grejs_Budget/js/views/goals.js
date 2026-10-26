// Mål og opsparing. Alle estimater bygger på brugerens egne tal og er ingen garanti.

(function () {
  'use strict';
  const GB = globalThis.GB;
  const U = GB.util, UI = GB.ui, S = GB.store;
  const { $, $$, esc, icon } = UI;
  const fail = (e) => UI.toast(e.message, 'error');

  const TYPES = [['emergency', 'Nødfond'], ['holiday', 'Ferie'], ['car', 'Ny bil'], ['electronics', 'Elektronik'], ['debt', 'Afbetaling af gæld'], ['custom', 'Eget mål']];
  const TYPE_ICON = { emergency: 'shield', holiday: 'plane', car: 'car', electronics: 'bolt', debt: 'bank', custom: 'star' };

  function monthsUntil(today, date) {
    if (!U.isValidISO(date)) return null;
    const a = U.parts(today), b = U.parts(date);
    return (b.y - a.y) * 12 + (b.m - a.m) + (b.d >= a.d ? 0 : -1);
  }

  function goalCard(g, today) {
    const left = Math.max(0, U.round2(g.target - g.saved));
    const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
    const months = monthsUntil(today, g.targetDate);
    const need = months != null && months > 0 ? left / months : null;
    const eta = g.monthly > 0 && left > 0 ? U.addMonths(today, Math.ceil(left / g.monthly)) : null;
    let status = '';
    if (left <= 0) status = UI.levelBadge('ok', 'Nået');
    else if (months != null && months <= 0) status = UI.levelBadge('warn', 'Måldatoen er passeret');
    else if (need != null && g.monthly > 0) status = g.monthly >= need ? UI.levelBadge('ok', 'Følger planen') : UI.levelBadge('notice', 'Bidraget er under det nødvendige');
    return '<section class="card goal"><div class="goal-top">' + GB.charts.ring(pct, g.color) + '<div style="min-width:0;flex:1"><h3 class="row" style="gap:8px">' + icon(TYPE_ICON[g.type] || 'star') + esc(g.name) + '</h3>' +
      '<div class="kpi-value" style="font-size:20px">' + esc(U.fmtMoney(g.saved, { decimals: 0 })) + ' <span class="small muted" style="font-weight:500">af ' + esc(U.fmtMoney(g.target, { decimals: 0 })) + '</span></div>' + status + '</div></div>' +
      '<dl class="kv">' +
      '<dt>Mangler</dt><dd class="num">' + esc(U.fmtMoney(left, { decimals: 0 })) + '</dd>' +
      (g.targetDate ? '<dt>Måldato</dt><dd>' + esc(U.fmtDate(g.targetDate)) + (months != null && months > 0 ? ' <span class="muted">(' + months + ' mdr.)</span>' : '') + '</dd>' : '') +
      (need != null && left > 0 ? '<dt>Skal lægges til side</dt><dd class="num"><b>' + esc(U.fmtMoney(need, { decimals: 0 })) + '</b> pr. måned for at nå målet</dd>' : '') +
      (g.monthly > 0 ? '<dt>Dit bidrag</dt><dd class="num">' + esc(U.fmtMoney(g.monthly, { decimals: 0 })) + ' pr. måned' + (eta ? ' → nået ca. ' + esc(U.fmtMonth(U.monthKey(eta))) : '') + '</dd>' : '') +
      '</dl><div class="row"><button type="button" class="btn sm primary" data-add="' + esc(g.id) + '">' + icon('plus') + 'Registrér indbetaling</button><button type="button" class="btn sm" data-edit="' + esc(g.id) + '">' + icon('edit') + 'Redigér</button><button type="button" class="btn sm ghost icon-only" data-del="' + esc(g.id) + '" aria-label="Slet mål">' + icon('trash') + '</button></div></section>';
  }

  function render(root, c) {
    const goals = S.data.goals.slice().sort((a, b) => String(a.targetDate || '9999').localeCompare(String(b.targetDate || '9999')));
    const months = GB.budgets.completeMonths(GB.analytics.dataRange(S.data.transactions), c.today, 3);
    let avg = null;
    if (months.length) {
      const list = S.data.transactions.filter((t) => t.date >= U.monthStart(months[0]) && t.date <= U.monthEnd(months[months.length - 1]));
      avg = c.calc.summarize(list).savings / months.length;
    }
    const totalTarget = U.sumAmounts(goals, (g) => g.target), totalSaved = U.sumAmounts(goals, (g) => g.saved);
    let html = '<div class="row between"><p class="lead" style="margin:0">Sæt mål for din opsparing og se, hvad der skal til. Beregningerne bygger kun på de tal, du selv skriver, og er ikke en garanti.</p><button type="button" class="btn primary" data-act="new">' + icon('plus') + 'Nyt mål</button></div>';
    html += '<div class="kpis mt">' +
      '<div class="kpi"><div class="kpi-label">' + icon('piggy') + 'Opsparet til mål</div><div class="kpi-value">' + esc(U.fmtMoney(totalSaved, { decimals: 0 })) + '</div><div class="kpi-sub">af ' + esc(U.fmtMoney(totalTarget, { decimals: 0 })) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">' + icon('repeat') + 'Planlagt bidrag</div><div class="kpi-value">' + esc(U.fmtMoney(U.sumAmounts(goals, (g) => g.monthly || 0), { decimals: 0 })) + '</div><div class="kpi-sub">pr. måned i alt</div></div>' +
      '<div class="kpi"><div class="kpi-label">' + icon('chart') + 'Opsparing i dine data</div><div class="kpi-value">' + (avg != null ? esc(U.fmtMoney(avg, { decimals: 0 })) : '–') + '</div><div class="kpi-sub">' + (avg != null ? 'gns. pr. måned, ' + months.length + ' hele mdr.' : 'Kræver mindst én hel måned') + '</div></div></div>';
    html += goals.length ? '<div class="grid grid-3 mt">' + goals.map((g) => goalCard(g, c.today)).join('') + '</div>'
      : '<div class="card mt">' + UI.empty('piggy', 'Ingen mål endnu', 'Opret fx en nødfond, en ferie eller afbetaling af gæld.', '<button type="button" class="btn primary" data-act="new">' + icon('plus') + 'Opret mål</button>') + '</div>';
    html += '<div class="note mt">' + icon('info') + '<p>Overførsler til opsparing (kategorierne <b>Opsparing</b> og <b>Investering</b>) tælles som opsparing og ikke som forbrug. ' +
      'Overførsler mellem dine egne konti kan markeres som interne, så de ikke tælles to gange. Du kan ændre, hvordan opsparing vises, under <a href="#/indstillinger">Indstillinger</a>.</p></div>';
    root.innerHTML = html;

    root.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'new') goalDialog(null);
      if (b.dataset.edit) goalDialog(S.byId.goals.get(b.dataset.edit));
      if (b.dataset.del) {
        const g = S.byId.goals.get(b.dataset.del);
        if (await UI.confirm({ title: 'Slet mål', message: 'Målet "' + g.name + '" slettes. Dine transaktioner røres ikke.', confirmLabel: 'Slet', danger: true })) { await S.remove('goals', g.id).catch(fail); GB.app.refresh(); }
      }
      if (b.dataset.add) {
        const g = S.byId.goals.get(b.dataset.add);
        const v = await UI.dialog({
          title: 'Registrér indbetaling til ' + g.name,
          body: '<div class="field"><label for="gAdd">Beløb (kr.) <span class="hint">– brug minus for en hævning</span></label><input type="text" inputmode="decimal" id="gAdd" autofocus></div>',
          actions: [{ label: 'Annullér', value: null }, { label: 'Registrér', primary: true, onClick: (dlg) => UI.readAmount($('#gAdd', dlg).value) || false }],
        });
        if (v) { await S.put('goals', Object.assign({}, g, { saved: U.round2(Math.max(0, g.saved + v)) })).catch(fail); GB.app.refresh(); }
      }
    });
  }

  async function goalDialog(goal) {
    const g = goal || { name: '', type: 'emergency', target: '', saved: 0, targetDate: U.addMonths(U.todayISO(), 12), monthly: '', color: GB.categories.COLORS[S.data.goals.length % GB.categories.COLORS.length] };
    const v = await UI.dialog({
      title: goal ? 'Redigér mål' : 'Nyt mål',
      body: '<div class="fields"><div class="field"><label for="gType">Type</label><select id="gType">' + UI.options(TYPES, g.type) + '</select></div>' +
        '<div class="field"><label for="gName">Navn</label><input type="text" id="gName" maxlength="60" value="' + esc(g.name) + '" placeholder="Fx Nødfond"></div>' +
        '<div class="field"><label for="gTarget">Målbeløb (kr.)</label><input type="text" inputmode="decimal" id="gTarget" value="' + esc(UI.amountInputValue(g.target)) + '"></div>' +
        '<div class="field"><label for="gSaved">Opsparet nu (kr.)</label><input type="text" inputmode="decimal" id="gSaved" value="' + esc(UI.amountInputValue(g.saved)) + '"></div>' +
        '<div class="field"><label for="gDate">Måldato <span class="hint">(valgfri)</span></label><input type="date" id="gDate" value="' + esc(g.targetDate || '') + '"></div>' +
        '<div class="field"><label for="gMonthly">Månedligt bidrag <span class="hint">(valgfrit)</span></label><input type="text" inputmode="decimal" id="gMonthly" value="' + esc(UI.amountInputValue(g.monthly)) + '"></div></div>' +
        '<div class="field mt"><span style="font-size:13.5px;font-weight:600;color:var(--text-2)">Farve</span><div class="swatches">' + GB.categories.COLORS.slice(0, 10).map((col) => '<button type="button" data-col="' + col + '" style="background:' + col + '" aria-label="Farve" aria-pressed="' + (col === g.color) + '"></button>').join('') + '</div></div>',
      onOpen: (dlg) => {
        dlg.addEventListener('click', (e) => { const s = e.target.closest('[data-col]'); if (s) $$('[data-col]', dlg).forEach((x) => x.setAttribute('aria-pressed', String(x === s))); });
        $('#gType', dlg).addEventListener('change', (e) => { if (!$('#gName', dlg).value) $('#gName', dlg).value = TYPES.find((t) => t[0] === e.target.value)[1]; });
      },
      actions: [{ label: 'Annullér', value: null }, {
        label: 'Gem', primary: true, onClick: (dlg) => {
          const type = $('#gType', dlg).value;
          const name = $('#gName', dlg).value.trim() || TYPES.find((t) => t[0] === type)[1];
          const target = UI.readAmount($('#gTarget', dlg).value);
          if (!(target > 0)) { UI.toast('Skriv et målbeløb', 'warn'); $('#gTarget', dlg).focus(); return false; }
          const d = $('#gDate', dlg).value;
          const col = $('[data-col][aria-pressed="true"]', dlg);
          return { type, name, target, saved: Math.max(0, UI.readAmount($('#gSaved', dlg).value) || 0), targetDate: U.isValidISO(d) ? d : null, monthly: Math.max(0, UI.readAmount($('#gMonthly', dlg).value) || 0), color: col ? col.dataset.col : g.color };
        },
      }],
    });
    if (!v) return;
    await S.put('goals', Object.assign({ id: U.uid('goal'), createdAt: new Date().toISOString() }, goal || {}, v)).catch(fail);
    GB.app.refresh();
  }

  GB.views.goals = { render };
})();
