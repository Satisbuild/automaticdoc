// Transaktioner – søg, filtrér, sortér, ret og ret mange på én gang.

(function () {
  'use strict';
  const GB = globalThis.GB;
  const U = GB.util, UI = GB.ui, S = GB.store, T = GB.tx, A = GB.actions;
  const { $, $$, esc, icon } = UI;

  const TYPES = [['', 'Alle typer'], ['expense', 'Udgifter'], ['income', 'Indtægter'], ['refund', 'Refusioner'], ['savings', 'Opsparing'], ['transfer', 'Interne overførsler'], ['foreign', 'Fremmed valuta uden kurs']];
  const emptyFilter = () => ({ text: '', categoryId: '', type: '', min: '', max: '', tag: '', batchId: '', review: false, recurring: false });

  const st = { f: emptyFilter(), override: null, sort: 'date', dir: 'desc', page: 0, selected: new Set(), showFilters: false };

  function consumeParams(c) {
    const p = c.state.params || {};
    if (!Object.keys(p).length) return;
    st.f = emptyFilter();
    st.override = null;
    st.page = 0;
    st.selected.clear();
    if (p.ids) st.override = { ids: new Set(p.ids), label: p.pairs ? 'Mulige overførsler mellem egne konti' : p.ids.length + ' udvalgte transaktioner', pairs: !!p.pairs };
    else if (p.all) st.override = { from: null, to: null, label: 'Alle datoer' };
    else if (p.from || p.to) st.override = { from: p.from, to: p.to, label: U.fmtDate(p.from, { short: true }) + ' – ' + U.fmtDate(p.to, { short: true }) };
    if (p.categoryId) { st.f.categoryId = p.categoryId; st.showFilters = true; }
    if (p.review) st.f.review = true;
    if (p.batchId) { st.f.batchId = p.batchId; st.showFilters = true; }
    c.state.params = {};
  }

  function currentList(c) {
    const f = st.f;
    const cats = new Set();
    if (f.categoryId) {
      cats.add(f.categoryId);
      for (const x of S.data.categories) if (x.parentId === f.categoryId) cats.add(x.id);
    }
    const ov = st.override;
    const filter = {
      ids: ov && ov.ids ? ov.ids : null,
      from: ov && ov.ids ? null : ov ? ov.from : c.range.from,
      to: ov && ov.ids ? null : ov ? ov.to : c.range.to,
      accountIds: c.accountId ? new Set([c.accountId]) : null,
      categoryIds: cats.size ? cats : null,
      types: f.type ? new Set([f.type]) : null,
      min: UI.readAmount(f.min), max: UI.readAmount(f.max),
      tags: f.tag ? [f.tag] : null, text: f.text, review: f.review, recurring: f.recurring, batchId: f.batchId || null,
    };
    const helpers = { classify: c.calc.classify, categoryName: (id) => UI.catName(id, true) };
    return T.sortTransactions(T.filterTransactions(S.data.transactions, filter, helpers), st.sort, st.dir, helpers);
  }

  function render(root, c) {
    consumeParams(c);
    if (!S.data.transactions.length) {
      root.innerHTML = '<div class="card">' + UI.empty('list', 'Ingen transaktioner endnu', 'Importér en bankfil, eller tilføj en transaktion i hånden.', '<a class="btn primary" href="#/importer">' + icon('upload') + 'Importér data</a><button type="button" class="btn" id="txAdd0">' + icon('plus') + 'Ny transaktion</button>') + '</div>';
      $('#txAdd0', root).addEventListener('click', () => A.addTransaction());
      return;
    }
    const allTags = [...new Set(S.data.transactions.flatMap((t) => t.tags || []))].sort((a, b) => a.localeCompare(b, 'da'));
    const activeCount = ['categoryId', 'type', 'min', 'max', 'tag', 'batchId'].filter((k) => st.f[k]).length + (st.f.review ? 1 : 0) + (st.f.recurring ? 1 : 0);
    root.innerHTML = '<div class="card flush">' +
      '<div class="tx-toolbar">' +
      '<div class="input-icon">' + icon('search') + '<label class="sr-only" for="txSearch">Søg</label><input type="search" id="txSearch" placeholder="Søg i tekst, kategori, noter, beløb …" value="' + esc(st.f.text) + '"></div>' +
      '<button type="button" class="btn" id="txFilterBtn" aria-expanded="' + st.showFilters + '" aria-controls="txFilters">' + icon('filter') + 'Filtre' + (activeCount ? ' <span class="badge brand">' + activeCount + '</span>' : '') + '</button>' +
      '<button type="button" class="btn" id="txAdd">' + icon('plus') + '<span>Ny</span></button>' +
      '<button type="button" class="btn" id="txExport" title="Eksportér de viste transaktioner som CSV">' + icon('download') + '<span>CSV</span></button>' +
      '</div>' +
      (st.override ? '<div class="tx-sum" style="background:var(--info-soft)">' + icon('filter') + '<span>Viser: <b>' + esc(st.override.label) + '</b> (i stedet for den valgte periode)</span><button type="button" class="link-btn" id="txClearOv">Vis periode igen</button>' +
        (st.override.pairs ? '<button type="button" class="btn sm primary" id="txPairs">' + icon('swap') + 'Markér alle viste som interne overførsler</button>' : '') + '</div>' : '') +
      '<div class="tx-filters" id="txFilters"' + (st.showFilters ? '' : ' hidden') + '>' +
      '<div class="field"><label for="fCat">Kategori</label><select id="fCat">' + UI.categoryOptions(st.f.categoryId, { allLabel: 'Alle kategorier', allowGroups: true, includeHidden: true }) + '</select></div>' +
      '<div class="field"><label for="fType">Type</label><select id="fType">' + UI.options(TYPES, st.f.type) + '</select></div>' +
      '<div class="field"><label for="fMin">Beløb fra (kr.)</label><input type="text" inputmode="decimal" id="fMin" value="' + esc(st.f.min) + '" placeholder="0"></div>' +
      '<div class="field"><label for="fMax">Beløb til (kr.)</label><input type="text" inputmode="decimal" id="fMax" value="' + esc(st.f.max) + '" placeholder="Ingen grænse"></div>' +
      '<div class="field"><label for="fTag">Tag</label><select id="fTag">' + UI.options([['', 'Alle tags']].concat(allTags.map((x) => [x, x])), st.f.tag) + '</select></div>' +
      '<div class="field"><label for="fBatch">Import</label><select id="fBatch">' + UI.options([['', 'Alle importer']].concat(S.data.batches.slice().sort((a, b) => b.importedAt.localeCompare(a.importedAt)).map((b) => [b.id, b.fileName])), st.f.batchId) + '</select></div>' +
      '<div class="field" style="justify-content:flex-end;gap:8px"><label class="check"><input type="checkbox" id="fReview"' + (st.f.review ? ' checked' : '') + '> Skal kontrolleres</label><label class="check"><input type="checkbox" id="fRec"' + (st.f.recurring ? ' checked' : '') + '> Kun faste betalinger</label></div>' +
      '<div class="field" style="justify-content:flex-end"><button type="button" class="btn sm ghost" id="fReset">Nulstil filtre</button></div>' +
      '</div><div id="txDyn"></div></div>';

    const update = () => renderDyn(root, c);
    const search = U.debounce(() => { st.f.text = $('#txSearch', root).value; st.page = 0; update(); }, 180);
    $('#txSearch', root).addEventListener('input', search);
    $('#txFilterBtn', root).addEventListener('click', () => { st.showFilters = !st.showFilters; GB.app.render(); });
    $('#txAdd', root).addEventListener('click', () => A.addTransaction());
    $('#txExport', root).addEventListener('click', () => exportCSV(currentList(c), c));
    const bindF = (id, key, prop) => $(id, root).addEventListener('change', (e) => { st.f[key] = e.target[prop || 'value']; st.page = 0; GB.app.render(); });
    bindF('#fCat', 'categoryId'); bindF('#fType', 'type'); bindF('#fMin', 'min'); bindF('#fMax', 'max'); bindF('#fTag', 'tag'); bindF('#fBatch', 'batchId');
    bindF('#fReview', 'review', 'checked'); bindF('#fRec', 'recurring', 'checked');
    $('#fReset', root).addEventListener('click', () => { st.f = Object.assign(emptyFilter(), { text: st.f.text }); st.page = 0; GB.app.render(); });
    if ($('#txClearOv', root)) $('#txClearOv', root).addEventListener('click', () => { st.override = null; st.page = 0; GB.app.render(); });
    if ($('#txPairs', root)) $('#txPairs', root).addEventListener('click', async () => {
      const ids = currentList(c).map((t) => t.id);
      if (await UI.confirm({ title: 'Markér som interne overførsler', message: ids.length + ' transaktioner markeres som overførsler mellem dine egne konti. De tælles derefter hverken som indtægt eller forbrug. Det kan altid ændres igen.', confirmLabel: 'Markér' })) {
        st.override = null;
        A.updateTransactions(ids, { isInternalTransfer: true }, ids.length + ' transaktioner er markeret som interne overførsler');
      }
    });
    root.addEventListener('click', (e) => onClick(e, root, c));
    root.addEventListener('change', (e) => onChange(e, root, c));
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-open]')) A.openTransaction(e.target.dataset.open); });
    update();
  }

  function flags(t, calc) {
    const f = [];
    if (t.categorySource === 'unknown') f.push('<span class="badge warn" title="Ikke kategoriseret">' + icon('alert') + '</span>');
    else if (t.categorySource === 'suggested') f.push('<span class="badge notice" title="Kategorien er et forslag – kontrollér">?</span>');
    if (t.duplicateOf && t.needsReview) f.push('<span class="badge warn" title="Mulig dublet">' + icon('copy') + '</span>');
    if (t.edited && Object.keys(t.edited).length) f.push('<span class="badge info" title="Ændret af dig – bankens værdi er gemt">' + icon('edit') + '</span>');
    if (t.isRecurring) f.push('<span class="badge" title="Fast betaling">' + icon('repeat') + '</span>');
    if (calc.classify(t).type === 'transfer') f.push('<span class="badge" title="Intern overførsel – tæller ikke som indtægt eller forbrug">' + icon('swap') + '</span>');
    if (t.notes) f.push('<span class="badge" title="' + esc(t.notes.slice(0, 120)) + '">' + icon('note') + '</span>');
    return f.length ? '<span class="tx-flags">' + f.join('') + '</span>' : '';
  }

  function renderDyn(root, c) {
    const list = currentList(c);
    const size = S.settings.pageSize || 100;
    const pages = Math.max(1, Math.ceil(list.length / size));
    if (st.page >= pages) st.page = pages - 1;
    const pageList = list.slice(st.page * size, st.page * size + size);
    for (const id of [...st.selected]) if (!S.byId.transactions.has(id)) st.selected.delete(id);
    const sum = c.calc.summarize(list);
    const multiAcc = S.data.accounts.length > 1;
    const sortBtn = (key, label) => '<button type="button" class="sort" data-sort="' + key + '" aria-label="Sortér efter ' + esc(label.toLowerCase()) + '">' + esc(label) + (st.sort === key ? icon(st.dir === 'asc' ? 'up' : 'down') : '') + '</button>';
    const aria = (k) => (st.sort === k ? ' aria-sort="' + (st.dir === 'asc' ? 'ascending' : 'descending') + '"' : '');
    const allOnPage = pageList.length && pageList.every((t) => st.selected.has(t.id));

    let html = '';
    if (st.selected.size) {
      html += '<div class="bulkbar" role="region" aria-label="Handlinger for valgte"><span>' + st.selected.size + ' valgt</span>' +
        '<button type="button" class="btn sm" data-bulk="category">' + icon('tag') + 'Skift kategori</button>' +
        '<button type="button" class="btn sm" data-bulk="accept">' + icon('check') + 'Godkend kategori</button>' +
        '<button type="button" class="btn sm" data-bulk="tag">' + icon('plus') + 'Tilføj tag</button>' +
        '<button type="button" class="btn sm" data-bulk="transfer">' + icon('swap') + 'Intern overførsel</button>' +
        '<button type="button" class="btn sm" data-bulk="untransfer">Ikke overførsel</button>' +
        '<button type="button" class="btn sm danger" data-bulk="delete">' + icon('trash') + 'Slet</button>' +
        '<span class="spacer"></span><button type="button" class="btn sm ghost" data-bulk="none">Fravælg</button>' +
        (list.length > st.selected.size ? '<button type="button" class="btn sm ghost" data-bulk="all">Vælg alle ' + list.length + '</button>' : '') + '</div>';
    }
    html += '<div class="tx-sum" aria-live="polite"><span><b>' + U.fmtNumber(list.length) + '</b> transaktioner</span>' +
      '<span>Indtægter i visningen: <b class="pos">' + esc(U.fmtMoney(sum.income)) + '</b></span>' +
      '<span>Udgifter i visningen: <b>' + esc(U.fmtMoney(sum.expense)) + '</b></span>' +
      (sum.savings ? '<span>Opsparing: <b>' + esc(U.fmtMoney(sum.savings)) + '</b></span>' : '') +
      (sum.transfers ? '<span class="muted">' + sum.transfers + ' interne overførsler tælles ikke med</span>' : '') +
      '<span class="muted">' + (st.override ? '' : esc(c.label)) + '</span></div>';

    if (!list.length) {
      html += UI.empty('search', 'Ingen transaktioner passer', 'Prøv en anden periode, søgning eller nulstil filtrene.');
    } else {
      html += '<div class="table-wrap tx-table"><table><thead><tr>' +
        '<th style="width:36px"><input type="checkbox" data-selpage aria-label="Vælg alle på siden"' + (allOnPage ? ' checked' : '') + '></th>' +
        '<th' + aria('date') + '>' + sortBtn('date', 'Dato') + '</th><th' + aria('description') + '>' + sortBtn('description', 'Beskrivelse') + '</th><th' + aria('category') + '>' + sortBtn('category', 'Kategori') + '</th>' +
        (multiAcc ? '<th>Konto</th>' : '') + '<th class="r"' + aria('amount') + '>' + sortBtn('amount', 'Beløb') + '</th></tr></thead><tbody>' +
        pageList.map((t) => '<tr class="tx-row' + (st.selected.has(t.id) ? ' selected' : '') + '" data-open="' + esc(t.id) + '" tabindex="0">' +
          '<td><input type="checkbox" data-sel="' + esc(t.id) + '" aria-label="Vælg ' + esc(t.description) + '"' + (st.selected.has(t.id) ? ' checked' : '') + '></td>' +
          '<td class="num">' + esc(U.fmtDate(t.date, { short: true })) + '</td>' +
          '<td class="desc"><div class="t">' + esc(t.description) + flags(t, c.calc) + '</div>' + (t.description !== t.descriptionOriginal ? '<div class="o">Bank: ' + esc(t.descriptionOriginal) + '</div>' : (t.tags && t.tags.length ? '<div class="o">' + t.tags.map((x) => '<span class="tag">' + esc(x) + '</span>').join(' ') + '</div>' : '')) + '</td>' +
          '<td>' + UI.catChip(t.categoryId, { button: 'cat', txId: t.id }) + '</td>' +
          (multiAcc ? '<td class="small muted">' + esc(UI.accountName(t.accountId)) + '</td>' : '') +
          '<td class="r">' + UI.txAmount(t) + '</td></tr>').join('') +
        '</tbody></table></div>' +
        '<ul class="tx-cards">' + pageList.map((t) => '<li data-open="' + esc(t.id) + '" class="' + (st.selected.has(t.id) ? 'selected' : '') + '" tabindex="0">' +
          '<input type="checkbox" data-sel="' + esc(t.id) + '" aria-label="Vælg ' + esc(t.description) + '"' + (st.selected.has(t.id) ? ' checked' : '') + '>' +
          '<div style="min-width:0"><div class="t">' + esc(t.description) + '</div><div class="m"><span>' + esc(U.fmtDate(t.date, { short: true })) + '</span>' + UI.catChip(t.categoryId, { button: 'cat', txId: t.id }) + flags(t, c.calc) + '</div></div>' +
          '<div class="a">' + UI.txAmount(t) + '</div></li>').join('') + '</ul>';
      if (pages > 1) {
        html += '<div class="pager"><span>Viser ' + U.fmtNumber(st.page * size + 1) + '–' + U.fmtNumber(Math.min(list.length, st.page * size + size)) + ' af ' + U.fmtNumber(list.length) + '</span><span class="row">' +
          '<button type="button" class="btn sm" data-page="-1"' + (st.page === 0 ? ' disabled' : '') + '>' + icon('left') + 'Forrige</button><span>Side ' + (st.page + 1) + ' af ' + pages + '</span>' +
          '<button type="button" class="btn sm" data-page="1"' + (st.page >= pages - 1 ? ' disabled' : '') + '>Næste' + icon('right') + '</button></span></div>';
      }
    }
    $('#txDyn', root).innerHTML = html;
    st.lastList = list;
    st.lastPage = pageList;
  }

  async function onClick(e, root, c) {
    const t = e.target;
    const sort = t.closest('[data-sort]');
    if (sort) {
      const k = sort.dataset.sort;
      if (st.sort === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = k; st.dir = k === 'date' || k === 'amount' ? 'desc' : 'asc'; }
      renderDyn(root, c);
      return;
    }
    const pg = t.closest('[data-page]');
    if (pg) { st.page += +pg.dataset.page; renderDyn(root, c); window.scrollTo({ top: 0 }); return; }
    const chip = t.closest('[data-action="cat"]');
    if (chip) {
      e.stopPropagation();
      const tx = S.byId.transactions.get(chip.dataset.id);
      const cat = await A.pickCategory(tx.categoryId, 'Kategori for ' + tx.description.slice(0, 40));
      if (cat && cat !== tx.categoryId) A.setCategory([tx.id], cat);
      else if (cat && tx.categorySource !== 'manual') A.setCategory([tx.id], cat, { askRule: false });
      return;
    }
    const bulk = t.closest('[data-bulk]');
    if (bulk) { onBulk(bulk.dataset.bulk, root, c); return; }
    if (t.matches('input[type="checkbox"]')) return;
    const row = t.closest('[data-open]');
    if (row) A.openTransaction(row.dataset.open);
  }

  function onChange(e, root, c) {
    const t = e.target;
    if (t.dataset.sel) {
      if (t.checked) st.selected.add(t.dataset.sel); else st.selected.delete(t.dataset.sel);
      renderDyn(root, c);
    } else if (t.hasAttribute('data-selpage')) {
      for (const x of st.lastPage || []) { if (t.checked) st.selected.add(x.id); else st.selected.delete(x.id); }
      renderDyn(root, c);
    }
  }

  async function onBulk(kind, root, c) {
    const ids = [...st.selected];
    if (kind === 'none') { st.selected.clear(); renderDyn(root, c); return; }
    if (kind === 'all') { for (const x of st.lastList || []) st.selected.add(x.id); renderDyn(root, c); return; }
    if (kind === 'category') {
      const cat = await A.pickCategory(null, 'Ny kategori til ' + ids.length + ' transaktioner');
      if (cat) { await A.setCategory(ids, cat); UI.toast(ids.length + ' transaktioner har fået ny kategori'); }
    } else if (kind === 'accept') {
      const list = ids.map((id) => S.byId.transactions.get(id)).filter(Boolean);
      for (const x of list) { x.categorySource = 'manual'; x.categoryReason = 'Godkendt af dig'; x.needsReview = false; x.updatedAt = new Date().toISOString(); }
      await S.put('transactions', list).catch((e) => UI.toast(e.message, 'error'));
      UI.toast(list.length + ' transaktioner er markeret som kontrolleret');
      GB.app.refresh();
    } else if (kind === 'tag') {
      const tag = await UI.dialog({
        title: 'Tilføj tag', body: '<div class="field"><label for="bTag">Tag</label><input type="text" id="bTag" maxlength="40" autofocus placeholder="Fx ferie2026"></div>',
        actions: [{ label: 'Annullér', value: null }, { label: 'Tilføj', primary: true, onClick: (dlg) => $('#bTag', dlg).value.trim() || false }],
      });
      if (tag) A.updateTransactions(ids, (x) => ({ tags: [...new Set((x.tags || []).concat(tag))] }), 'Tagget er tilføjet');
    } else if (kind === 'transfer') {
      A.updateTransactions(ids, { isInternalTransfer: true }, ids.length + ' markeret som intern overførsel');
    } else if (kind === 'untransfer') {
      A.updateTransactions(ids, { isInternalTransfer: false }, 'Markeringen er fjernet');
    } else if (kind === 'delete') {
      if (await A.deleteTransactions(ids)) st.selected.clear();
    }
  }

  async function exportCSV(list, c) {
    if (!list.length) { UI.toast('Der er ingen transaktioner at eksportere', 'warn'); return; }
    const ok = await UI.confirm({ title: 'Eksportér transaktioner', message: list.length + ' transaktioner gemmes i en CSV-fil på din enhed. Filen indeholder dine bankdata – opbevar den et sikkert sted.', confirmLabel: 'Hent CSV' });
    if (!ok) return;
    GB.exporter.download(GB.exporter.toCSV(list, GB.views.reports.txColumns(c.calc)), 'grejs-budget-transaktioner_' + GB.exporter.stamp() + '.csv', 'text/csv;charset=utf-8');
  }

  GB.views.transactions = { render };
})();
