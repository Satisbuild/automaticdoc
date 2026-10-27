// Kategorier, egne regler og indbyggede regler.

(function () {
  'use strict';
  const GB = globalThis.GB;
  const U = GB.util, UI = GB.ui, S = GB.store, C = GB.categories, A = GB.actions;
  const { $, $$, esc, icon } = UI;

  const KINDS = [['expense', 'Udgift'], ['income', 'Indtægt'], ['savings', 'Opsparing (tæller ikke som forbrug)'], ['transfer', 'Overførsel (tæller ikke)'], ['mixed', 'Blandet (ud = udgift, ind = indtægt)']];
  const PROTECTED = new Set([C.UNKNOWN_ID, 'other-transfer']);
  const st = { tab: 'categories' };
  const fail = (e) => UI.toast(e.message, 'error');

  function render(root, c) {
    root.innerHTML = '<div class="tabs-inline" role="tablist">' +
      [['categories', 'Kategorier'], ['rules', 'Mine regler (' + S.data.rules.length + ')'], ['builtin', 'Indbyggede regler']].map(([k, l]) => '<button type="button" role="tab" data-tab="' + k + '" aria-selected="' + (st.tab === k) + '">' + esc(l) + '</button>').join('') +
      '</div><div id="catBody"></div>';
    $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.tab; GB.app.render(); }));
    const body = $('#catBody', root);
    if (st.tab === 'rules') renderRules(body);
    else if (st.tab === 'builtin') renderBuiltin(body);
    else renderCategories(body, c);
  }

  // --- Kategorier --------------------------------------------------------------

  function renderCategories(body, c) {
    const sum = c.calc.summarize(c.periodTxs);
    const counts = new Map();
    for (const t of S.data.transactions) counts.set(t.categoryId, (counts.get(t.categoryId) || 0) + 1);
    const groups = S.data.categories.filter((x) => !x.parentId).sort((a, b) => a.order - b.order);
    // Forbrug vises som beløb; penge ind (indtægter og fx modtaget MobilePay) vises med "+".
    const amountOf = (id, isGroup) => {
      const exp = (isGroup ? sum.byGroup.get(id) : sum.byCategory.get(id)) || 0;
      const inc = isGroup ? [...sum.incomeByCategory].filter(([k]) => k === id || (S.byId.categories.get(k) || {}).parentId === id).reduce((s, [, v]) => s + v, 0) : sum.incomeByCategory.get(id) || 0;
      const fmtInc = '<span class="pos">' + esc(U.fmtMoney(inc, { decimals: 0, sign: true })) + '</span>';
      if (!exp && inc) return fmtInc;
      return esc(U.fmtMoney(exp, { decimals: 0 })) + (inc ? ' / ' + fmtInc : '');
    };
    let html = '<div class="row between"><p class="lead" style="margin:0">Beløb vises for <b>' + esc(c.label.toLowerCase()) + '</b>. Skjulte kategorier kan ikke vælges, men eksisterende transaktioner beholder dem.</p>' +
      '<button type="button" class="btn primary" data-act="new-group">' + icon('plus') + 'Ny hovedkategori</button></div><div class="stack mt">';
    for (const g of groups) {
      const subs = S.data.categories.filter((x) => x.parentId === g.id).sort((a, b) => a.order - b.order);
      html += '<section class="cat-group"><div class="cat-group-head">' + UI.catIcon(g.id) + '<h3>' + esc(g.name) + (g.hidden ? ' <span class="badge">skjult</span>' : '') + ' <span class="badge">' + esc(KINDS.find((k) => k[0] === g.kind)[1].split(' (')[0]) + '</span></h3>' +
        '<span class="num">' + amountOf(g.id, true) + '</span>' +
        '<button type="button" class="btn sm ghost" data-act="add-sub" data-id="' + esc(g.id) + '" title="Tilføj underkategori">' + icon('plus') + '<span class="sr-only">Tilføj underkategori</span></button>' +
        '<button type="button" class="btn sm ghost" data-act="edit" data-id="' + esc(g.id) + '" title="Redigér">' + icon('edit') + '<span class="sr-only">Redigér ' + esc(g.name) + '</span></button></div><ul class="cat-subs">' +
        subs.map((s) => '<li class="' + (s.hidden ? 'is-hidden' : '') + '"><span class="grow">' + esc(s.name) + (s.hidden ? ' <span class="badge">skjult</span>' : '') + (s.kind !== g.kind ? ' <span class="badge info">' + esc(KINDS.find((k) => k[0] === s.kind)[1].split(' (')[0]) + '</span>' : '') + '</span>' +
          '<button type="button" class="link-btn small" data-act="show-tx" data-id="' + esc(s.id) + '">' + (counts.get(s.id) || 0) + ' transaktioner</button>' +
          '<span class="num small" style="min-width:90px;text-align:right">' + amountOf(s.id) + '</span>' +
          '<button type="button" class="btn sm ghost icon-only" data-act="edit" data-id="' + esc(s.id) + '" aria-label="Redigér ' + esc(s.name) + '">' + icon('edit') + '</button>' +
          '<button type="button" class="btn sm ghost icon-only" data-act="toggle" data-id="' + esc(s.id) + '" aria-label="' + (s.hidden ? 'Vis ' : 'Skjul ') + esc(s.name) + '">' + icon(s.hidden ? 'eye' : 'eye-off') + '</button>' +
          (PROTECTED.has(s.id) ? '' : '<button type="button" class="btn sm ghost icon-only" data-act="delete" data-id="' + esc(s.id) + '" aria-label="Slet ' + esc(s.name) + '">' + icon('trash') + '</button>') + '</li>').join('') +
        '</ul></section>';
    }
    body.innerHTML = html + '</div>';
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.act === 'new-group') categoryDialog(null, null);
      if (b.dataset.act === 'add-sub') categoryDialog(null, id);
      if (b.dataset.act === 'edit') categoryDialog(S.byId.categories.get(id));
      if (b.dataset.act === 'show-tx') GB.app.go('transactions', { categoryId: id, all: true });
      if (b.dataset.act === 'toggle') {
        const cat = S.byId.categories.get(id);
        await S.put('categories', Object.assign({}, cat, { hidden: !cat.hidden })).catch(fail);
        GB.app.refresh();
      }
      if (b.dataset.act === 'delete') deleteCategory(id);
    });
  }

  async function categoryDialog(cat, parentId) {
    const isNew = !cat;
    const parent = parentId ? S.byId.categories.get(parentId) : cat && cat.parentId ? S.byId.categories.get(cat.parentId) : null;
    const isGroup = cat ? !cat.parentId : !parentId;
    const cur = cat || { name: '', kind: parent ? parent.kind : 'expense', color: parent ? parent.color : C.COLORS[S.data.categories.length % C.COLORS.length], icon: parent ? parent.icon : 'tag' };
    const groups = S.data.categories.filter((x) => !x.parentId).sort((a, b) => a.order - b.order);
    const v = await UI.dialog({
      title: isNew ? (isGroup ? 'Ny hovedkategori' : 'Ny underkategori i ' + parent.name) : 'Redigér kategori',
      body: '<div class="stack"><div class="field"><label for="cName">Navn</label><input type="text" id="cName" maxlength="50" value="' + esc(cur.name) + '" autofocus></div>' +
        (!isGroup ? '<div class="field"><label for="cParent">Hovedkategori</label><select id="cParent"' + (cat && PROTECTED.has(cat.id) ? ' disabled' : '') + '>' + UI.options(groups.map((g) => [g.id, g.name]), parent ? parent.id : '') + '</select></div>' : '') +
        '<div class="field"><label for="cKind">Beregnes som</label><select id="cKind"' + (cat && PROTECTED.has(cat.id) ? ' disabled' : '') + '>' + UI.options(KINDS, cur.kind) + '</select><span class="hint">Styrer, om beløbene tæller som indtægt, forbrug, opsparing eller ingenting.</span></div>' +
        (isGroup ? '<div class="field"><span id="cColL" style="font-size:13.5px;font-weight:600;color:var(--text-2)">Farve</span><div class="swatches" role="group" aria-labelledby="cColL">' + C.COLORS.map((col) => '<button type="button" data-col="' + col + '" style="background:' + col + '" aria-label="Farve ' + col + '" aria-pressed="' + (col === cur.color) + '"></button>').join('') + '</div></div>' : '') +
        '<div class="field"><span id="cIcoL" style="font-size:13.5px;font-weight:600;color:var(--text-2)">Ikon</span><div class="icon-pick" role="group" aria-labelledby="cIcoL">' + C.ICONS.map((ic) => '<button type="button" data-ico="' + ic + '" aria-label="Ikon ' + ic + '" aria-pressed="' + (ic === cur.icon) + '">' + icon(ic) + '</button>').join('') + '</div></div></div>',
      onOpen: (dlg) => {
        dlg.addEventListener('click', (e) => {
          const s = e.target.closest('[data-col],[data-ico]');
          if (!s) return;
          const attr = s.dataset.col ? 'data-col' : 'data-ico';
          $$('[' + attr + ']', dlg).forEach((x) => x.setAttribute('aria-pressed', String(x === s)));
        });
      },
      actions: [{ label: 'Annullér', value: null }, {
        label: 'Gem', primary: true, onClick: (dlg) => {
          const name = $('#cName', dlg).value.trim();
          if (!name) { UI.toast('Giv kategorien et navn', 'warn'); return false; }
          const col = $('[data-col][aria-pressed="true"]', dlg), ico = $('[data-ico][aria-pressed="true"]', dlg);
          return { name, kind: $('#cKind', dlg).value, parentId: isGroup ? null : $('#cParent', dlg).value, color: col ? col.dataset.col : cur.color, icon: ico ? ico.dataset.ico : cur.icon };
        },
      }],
    });
    if (!v) return;
    const recs = [];
    if (isNew) {
      const siblings = S.data.categories.filter((x) => (x.parentId || null) === (v.parentId || null));
      recs.push({ id: U.uid('cat'), name: v.name, parentId: v.parentId, kind: v.kind, color: v.parentId ? S.byId.categories.get(v.parentId).color : v.color, icon: v.icon, hidden: false, order: siblings.length, builtin: false });
    } else {
      const upd = Object.assign({}, cat, { name: v.name, kind: PROTECTED.has(cat.id) ? cat.kind : v.kind, icon: v.icon });
      if (!isGroup && !PROTECTED.has(cat.id)) { upd.parentId = v.parentId; upd.color = S.byId.categories.get(v.parentId).color; }
      if (isGroup) {
        upd.color = v.color;
        // Underkategorier følger hovedkategoriens farve og (hvis de fulgte den før) dens type.
        for (const s of S.data.categories.filter((x) => x.parentId === cat.id)) {
          recs.push(Object.assign({}, s, { color: v.color, kind: s.kind === cat.kind && !PROTECTED.has(s.id) ? v.kind : s.kind }));
        }
      }
      recs.push(upd);
    }
    await S.put('categories', recs).catch(fail);
    UI.toast('Kategorien er gemt');
    GB.app.refresh();
  }

  async function deleteCategory(id) {
    const cat = S.byId.categories.get(id);
    const ids = new Set([id].concat(S.data.categories.filter((x) => x.parentId === id).map((x) => x.id)));
    if ([...ids].some((x) => PROTECTED.has(x))) { UI.toast('Denne kategori bruges af appen og kan ikke slettes – men den kan skjules', 'warn'); return; }
    const txs = S.data.transactions.filter((t) => ids.has(t.categoryId));
    const rules = S.data.rules.filter((r) => ids.has(r.categoryId));
    const v = await UI.dialog({
      title: 'Slet ' + cat.name,
      body: '<p>' + (txs.length ? '<b>' + txs.length + '</b> transaktioner bruger kategorien' + (ids.size > 1 ? ' eller dens underkategorier' : '') + '. Hvor skal de flyttes hen?' : 'Ingen transaktioner bruger kategorien.') + '</p>' +
        (txs.length ? '<div class="field"><label for="moveTo">Flyt transaktionerne til</label><select id="moveTo">' + UI.categoryOptions(C.UNKNOWN_ID).replace(new RegExp('<option value="(' + [...ids].map((x) => x.replace(/[^\w-]/g, '')).join('|') + ')"[^>]*>[^<]*</option>', 'g'), '') + '</select></div>' : '') +
        (rules.length ? '<p class="small muted">' + rules.length + ' af dine regler peger på kategorien og bliver slettet.</p>' : '') +
        '<p class="small muted">Budgetlinjer for kategorien fjernes også.</p>',
      actions: [{ label: 'Annullér', value: null }, { label: 'Slet kategori', danger: true, onClick: (dlg) => ({ moveTo: txs.length ? $('#moveTo', dlg).value : null }) }],
    });
    if (!v) return;
    const now = new Date().toISOString();
    for (const t of txs) {
      GB.tx.applyEdit(t, { categoryId: v.moveTo }, now);
      if (v.moveTo === C.UNKNOWN_ID) { t.categorySource = 'unknown'; t.categoryReason = 'Kategorien blev slettet'; }
    }
    const budgets = S.data.budgets.filter((b) => b.lines.some((l) => ids.has(l.categoryId))).map((b) => Object.assign({}, b, { lines: b.lines.filter((l) => !ids.has(l.categoryId)) }));
    await S.batch([
      { store: 'transactions', put: txs },
      { store: 'rules', remove: rules.map((r) => r.id) },
      { store: 'budgets', put: budgets },
      { store: 'categories', remove: [...ids] },
    ]).catch(fail);
    UI.toast('Kategorien er slettet');
    GB.app.refresh();
  }

  // --- Mine regler -------------------------------------------------------------

  const MATCH = { contains: 'indeholder', startsWith: 'starter med', equals: 'er lig med', word: 'indeholder ordet' };

  function renderRules(body) {
    const rules = C.sortRules(S.data.rules);
    const counts = new Map(rules.map((r) => [r.id, S.data.transactions.filter((t) => t.categoryRuleId === r.id && t.categorySource === 'rule').length]));
    body.innerHTML = '<div class="row between"><p class="lead" style="margin:0">Dine regler bruges før de indbyggede. Den øverste regel, der passer, vinder. Manuelt valgte kategorier ændres aldrig af regler, medmindre du selv beder om det.</p>' +
      '<div class="row"><button type="button" class="btn" data-act="rerun">' + icon('refresh') + 'Kategorisér igen</button><button type="button" class="btn primary" data-act="new">' + icon('plus') + 'Ny regel</button></div></div>' +
      '<div class="card flush mt">' + (rules.length ? '<div class="table-wrap"><table><thead><tr><th>Aktiv</th><th>Regel</th><th>Kategori</th><th>Konto</th><th class="r">Bruges af</th><th class="r">Prioritet</th><th></th></tr></thead><tbody>' +
        rules.map((r, i) => '<tr><td><input type="checkbox" data-act="active" data-id="' + esc(r.id) + '"' + (r.active ? ' checked' : '') + ' aria-label="Regel aktiv"></td>' +
          '<td><b>' + esc(r.name || r.keyword) + '</b><div class="small muted">Teksten ' + esc(MATCH[r.matchType] || 'indeholder') + ' "' + esc(r.keyword) + '"' + (r.sign === 'in' ? ' · kun indtægter' : r.sign === 'out' ? ' · kun udgifter' : '') + '</div></td>' +
          '<td>' + UI.catChip(r.categoryId) + '</td><td class="small">' + (r.accountId ? esc(UI.accountName(r.accountId)) : 'Alle') + '</td>' +
          '<td class="r num">' + counts.get(r.id) + '</td>' +
          '<td class="r"><span class="row end" style="gap:4px;flex-wrap:nowrap"><button type="button" class="btn sm ghost icon-only" data-act="up" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Flyt op">' + icon('up') + '</button><button type="button" class="btn sm ghost icon-only" data-act="down" data-i="' + i + '"' + (i === rules.length - 1 ? ' disabled' : '') + ' aria-label="Flyt ned">' + icon('down') + '</button></span></td>' +
          '<td class="r"><span class="row end" style="gap:4px;flex-wrap:nowrap"><button type="button" class="btn sm ghost icon-only" data-act="edit" data-id="' + esc(r.id) + '" aria-label="Redigér">' + icon('edit') + '</button><button type="button" class="btn sm ghost icon-only" data-act="del" data-id="' + esc(r.id) + '" aria-label="Slet">' + icon('trash') + '</button></span></td></tr>').join('') +
        '</tbody></table></div>' : UI.empty('tag', 'Ingen egne regler endnu', 'Når du ændrer kategorien på en transaktion, tilbyder Grejs Budget at lave en regel. Du kan også oprette dem her.')) + '</div>';
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.dataset.act === 'active') return;
      const act = b.dataset.act;
      if (act === 'new') A.ruleDialog(null);
      if (act === 'edit') A.ruleDialog(S.byId.rules.get(b.dataset.id));
      if (act === 'del') {
        const r = S.byId.rules.get(b.dataset.id);
        if (await UI.confirm({ title: 'Slet regel', message: 'Reglen "' + (r.name || r.keyword) + '" slettes. Transaktioner, der allerede har fået en kategori af reglen, beholder den, indtil du kategoriserer igen.', confirmLabel: 'Slet', danger: true })) {
          await S.remove('rules', r.id).catch(fail);
          GB.app.refresh();
        }
      }
      if (act === 'up' || act === 'down') {
        const i = +b.dataset.i, j = act === 'up' ? i - 1 : i + 1;
        const list = rules.slice();
        [list[i], list[j]] = [list[j], list[i]];
        await S.put('rules', list.map((r, k) => Object.assign({}, r, { priority: (k + 1) * 10 }))).catch(fail);
        GB.app.refresh();
      }
      if (act === 'rerun') rerun();
    });
    body.addEventListener('change', async (e) => {
      if (e.target.dataset.act !== 'active') return;
      const r = S.byId.rules.get(e.target.dataset.id);
      await S.put('rules', Object.assign({}, r, { active: e.target.checked })).catch(fail);
      GB.app.refresh();
    });
  }

  async function rerun() {
    const manual = S.data.transactions.filter((t) => t.categorySource === 'manual').length;
    const v = await UI.dialog({
      title: 'Kategorisér igen',
      body: '<p>Alle transaktioner, som ikke er kategoriseret manuelt, kategoriseres igen med dine regler og de indbyggede regler.</p>' +
        (manual ? '<label class="check"><input type="checkbox" id="ow"> <span>Overskriv også de <b>' + manual + '</b> kategorier, du selv har valgt</span></label><p class="small muted mt-s">Lad feltet være tomt for at bevare dine egne valg.</p>' : ''),
      actions: [{ label: 'Annullér', value: null }, { label: 'Kategorisér', primary: true, onClick: (dlg) => ({ overwriteManual: !!($('#ow', dlg) && $('#ow', dlg).checked) }) }],
    });
    if (!v) return;
    if (v.overwriteManual && !(await UI.confirm({ title: 'Er du sikker?', message: manual + ' manuelt valgte kategorier bliver erstattet af reglernes forslag. Det kan ikke fortrydes (undtagen ved at gendanne en sikkerhedskopi).', confirmLabel: 'Ja, overskriv', danger: true }))) return;
    const n = await A.applyRules(v);
    UI.toast(n + ' transaktioner fik ny kategori');
    GB.app.refresh();
  }

  // --- Indbyggede regler -------------------------------------------------------

  function renderBuiltin(body) {
    const disabled = new Set(S.settings.disabledBuiltinRules || []);
    body.innerHTML = '<p class="lead">Grejs Budget kender en række danske butikker og betalingsmodtagere. <span class="badge ok">Sikker</span> giver kategorien direkte. <span class="badge notice">Forslag</span> markerer transaktionen til kontrol, fordi teksten kan betyde flere ting. Slå en regel fra, hvis den rammer forkert.</p>' +
      '<div class="card flush mt"><div class="table-wrap"><table class="compact"><thead><tr><th>Til</th><th>Kategori</th><th>Nøgleord</th><th>Type</th></tr></thead><tbody>' +
      C.BUILTIN_RULES.filter((r) => S.byId.categories.has(r.categoryId)).map((r) => '<tr><td><input type="checkbox" data-b="' + esc(r.id) + '"' + (disabled.has(r.id) ? '' : ' checked') + ' aria-label="Regel aktiv"></td><td>' + UI.catChip(r.categoryId) + '</td>' +
        '<td class="small">' + esc(r.keywords.join(', ')) + (r.sign === 'in' ? ' <span class="muted">(kun indtægter)</span>' : r.sign === 'out' ? ' <span class="muted">(kun udgifter)</span>' : '') + '</td>' +
        '<td>' + (r.confidence === 'high' ? '<span class="badge ok">Sikker</span>' : '<span class="badge notice">Forslag</span>') + '</td></tr>').join('') +
      '</tbody></table></div></div>';
    body.addEventListener('change', async (e) => {
      const id = e.target.dataset.b;
      if (!id) return;
      const set = new Set(S.settings.disabledBuiltinRules || []);
      if (e.target.checked) set.delete(id); else set.add(id);
      await S.saveSettings({ disabledBuiltinRules: [...set] }).catch(fail);
      UI.toast('Gemt. Brug "Kategorisér igen" under Mine regler for at opdatere eksisterende transaktioner.');
    });
  }

  GB.views.categories = { render };
})();
