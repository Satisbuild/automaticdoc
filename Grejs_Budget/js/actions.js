// Fælles handlinger, som bruges fra flere sider: rette transaktioner, skifte kategori
// (med tilbud om en regel), regler, konti, gemme en import, eksempeldata og sikkerhedskopi.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util, UI = GB.ui, S = GB.store, C = GB.categories, T = GB.tx;
  const { $, $$, esc, icon } = UI;

  const ACCOUNT_TYPES = [['checking', 'Lønkonto'], ['budget', 'Budgetkonto'], ['savings', 'Opsparing'], ['credit', 'Kreditkort'], ['cash', 'Kontanter'], ['other', 'Anden konto']];

  const refresh = () => GB.app.refresh();
  const fail = (e) => UI.toast(e && e.message ? e.message : 'Kunne ikke gemme', 'error');
  const catCtx = () => C.makeContext(S.data.rules, S.data.categories, S.settings.disabledBuiltinRules);

  // --- Konti -------------------------------------------------------------------

  async function accountDialog(acc) {
    const a = acc || {};
    const v = await UI.dialog({
      title: acc ? 'Redigér konto' : 'Ny konto',
      body: '<form class="stack" id="accForm">' +
        '<div class="field"><label for="accName">Navn</label><input type="text" id="accName" required maxlength="60" value="' + esc(a.name || '') + '" placeholder="Fx Lønkonto" autofocus></div>' +
        '<div class="fields"><div class="field"><label for="accType">Kontotype</label><select id="accType">' + UI.options(ACCOUNT_TYPES, a.type || 'checking') + '</select></div>' +
        '<div class="field"><label for="accBank">Bank <span class="hint">(valgfrit)</span></label><input type="text" id="accBank" maxlength="60" value="' + esc(a.bank || '') + '"></div>' +
        '<div class="field"><label for="accCur">Valuta</label><input type="text" id="accCur" maxlength="3" value="' + esc(a.currency || 'DKK') + '"></div></div>' +
        '<p class="small muted">Skriv aldrig kontonummer, adgangskoder eller MitID-oplysninger her. Grejs Budget har ikke brug for dem.</p></form>',
      actions: [{ label: 'Annullér', value: null }, {
        label: 'Gem konto', primary: true, onClick: (dlg) => {
          const name = $('#accName', dlg).value.trim();
          if (!name) { $('#accName', dlg).focus(); UI.toast('Giv kontoen et navn', 'warn'); return false; }
          const cur = ($('#accCur', dlg).value.trim().toUpperCase() || 'DKK');
          return { name, type: $('#accType', dlg).value, bank: $('#accBank', dlg).value.trim(), currency: /^[A-Z]{3}$/.test(cur) ? cur : 'DKK' };
        },
      }],
    });
    if (!v) return null;
    const rec = Object.assign({}, a, v, { id: a.id || U.uid('acc'), createdAt: a.createdAt || new Date().toISOString() });
    await S.put('accounts', rec).catch(fail);
    return rec;
  }

  // --- Kategori og regler ------------------------------------------------------

  async function pickCategory(current, title) {
    return UI.dialog({
      title: title || 'Vælg kategori',
      body: '<div class="field"><label for="pickCat">Kategori</label><select id="pickCat" autofocus>' + UI.categoryOptions(current) + '</select></div>',
      actions: [{ label: 'Annullér', value: null }, { label: 'Vælg', primary: true, onClick: (dlg) => $('#pickCat', dlg).value }],
    });
  }

  // Sætter kategori manuelt. Tilbyder bagefter at lave en regel for lignende tekster.
  async function setCategory(ids, categoryId, opts) {
    const o = opts || {};
    const list = ids.map((id) => S.byId.transactions.get(id)).filter(Boolean);
    for (const t of list) {
      T.applyEdit(t, { categoryId });
      t.categorySource = 'manual'; t.categoryRuleId = null; t.categoryReason = 'Valgt af dig';
      if (t.needsReview && !t.duplicateOf) t.needsReview = false;
    }
    await S.put('transactions', list).catch(fail);
    refresh();
    if (o.askRule === false || !S.settings.askRuleOnCategoryChange || !list.length) return;
    const keys = new Set(list.map((t) => C.merchantKey(t.description)));
    if (keys.size !== 1) return;
    await offerRule(list[0], categoryId);
  }

  async function offerRule(tx, categoryId) {
    const kw = C.suggestKeyword(tx.description);
    if (!kw) return;
    const count = (keyword, type, acc) => {
      const r = { active: true, keyword, matchType: type, accountId: acc ? tx.accountId : null, sign: 'any' };
      return S.data.transactions.filter((t) => t.id !== tx.id && t.categorySource !== 'manual' && t.categoryId !== categoryId && C.ruleMatches(r, t)).length;
    };
    const v = await UI.dialog({
      title: 'Lav en regel?',
      body: '<p>Skal fremtidige transaktioner med lignende tekst automatisk få kategorien <b>' + esc(UI.catName(categoryId)) + '</b>?</p>' +
        '<div class="fields"><div class="field"><label for="rKw">Når teksten</label><select id="rType">' + UI.options([['contains', 'indeholder'], ['startsWith', 'starter med'], ['word', 'indeholder ordet'], ['equals', 'er lig med']], 'contains') + '</select></div>' +
        '<div class="field"><label for="rKw">Tekst</label><input type="text" id="rKw" value="' + esc(kw) + '" maxlength="80"></div></div>' +
        '<div class="stack mt-s" style="gap:8px"><label class="check"><input type="checkbox" id="rAcc"> Kun for kontoen ' + esc(UI.accountName(tx.accountId)) + '</label>' +
        '<label class="check"><input type="checkbox" id="rApply" checked> <span>Brug også reglen på <b id="rCount">0</b> eksisterende transaktioner <span class="muted">(dine manuelle valg røres ikke)</span></span></label>' +
        '<label class="check"><input type="checkbox" id="rNever"> Spørg ikke igen</label></div>',
      onOpen: (dlg) => {
        const upd = () => { $('#rCount', dlg).textContent = count($('#rKw', dlg).value.trim().toUpperCase(), $('#rType', dlg).value, $('#rAcc', dlg).checked); };
        ['#rKw', '#rType', '#rAcc'].forEach((s) => $(s, dlg).addEventListener('input', upd));
        $('#rAcc', dlg).addEventListener('change', upd);
        upd();
      },
      actions: [
        { label: 'Nej tak', onClick: (dlg) => ({ no: true, never: $('#rNever', dlg).checked }) },
        { label: 'Opret regel', primary: true, onClick: (dlg) => ({ keyword: $('#rKw', dlg).value.trim(), matchType: $('#rType', dlg).value, acc: $('#rAcc', dlg).checked, apply: $('#rApply', dlg).checked, never: $('#rNever', dlg).checked }) },
      ],
    });
    if (!v) return;
    if (v.never) await S.saveSettings({ askRuleOnCategoryChange: false }).catch(fail);
    if (v.no || !v.keyword) return;
    const rule = newRule({ name: v.keyword, keyword: v.keyword.toUpperCase(), matchType: v.matchType, categoryId, accountId: v.acc ? tx.accountId : null });
    await S.put('rules', rule).catch(fail);
    const n = v.apply ? await applyRules() : 0;
    UI.toast('Reglen er oprettet' + (n ? ' og brugt på ' + n + ' transaktioner' : ''));
    refresh();
  }

  function newRule(p) {
    const maxPrio = S.data.rules.reduce((m, r) => Math.max(m, r.priority || 0), 0);
    return Object.assign({ id: U.uid('rule'), name: '', keyword: '', matchType: 'contains', categoryId: C.UNKNOWN_ID, accountId: null, sign: 'any', priority: maxPrio + 10, active: true, createdAt: new Date().toISOString() }, p);
  }

  async function ruleDialog(rule, prefill) {
    const r = rule || newRule(prefill || {});
    const matching = (dlg) => {
      const test = { active: true, keyword: $('#ruKw', dlg).value.trim().toUpperCase(), matchType: $('#ruType', dlg).value, accountId: $('#ruAcc', dlg).value || null, sign: $('#ruSign', dlg).value };
      return test.keyword ? S.data.transactions.filter((t) => C.ruleMatches(test, t)) : [];
    };
    const v = await UI.dialog({
      title: rule ? 'Redigér regel' : 'Ny regel',
      wide: true,
      body: '<div class="fields">' +
        '<div class="field"><label for="ruName">Navn <span class="hint">(valgfrit)</span></label><input type="text" id="ruName" maxlength="60" value="' + esc(r.name) + '"></div>' +
        '<div class="field"><label for="ruType">Når teksten</label><select id="ruType">' + UI.options([['contains', 'indeholder'], ['startsWith', 'starter med'], ['word', 'indeholder ordet'], ['equals', 'er lig med']], r.matchType) + '</select></div>' +
        '<div class="field"><label for="ruKw">Tekst / nøgleord</label><input type="text" id="ruKw" maxlength="80" value="' + esc(r.keyword) + '" autofocus></div>' +
        '<div class="field"><label for="ruCat">Så er kategorien</label><select id="ruCat">' + UI.categoryOptions(r.categoryId) + '</select></div>' +
        '<div class="field"><label for="ruSign">Gælder for</label><select id="ruSign">' + UI.options([['any', 'Både ind og ud'], ['out', 'Kun udgifter (penge ud)'], ['in', 'Kun indtægter (penge ind)']], r.sign || 'any') + '</select></div>' +
        '<div class="field"><label for="ruAcc">Konto</label><select id="ruAcc">' + UI.accountOptions(r.accountId, 'Alle konti') + '</select></div>' +
        '<div class="field"><label for="ruPrio">Prioritet <span class="hint">(lavt tal vinder)</span></label><input type="number" id="ruPrio" value="' + esc(r.priority) + '" step="1"></div>' +
        '</div><label class="check mt"><input type="checkbox" id="ruActive"' + (r.active ? ' checked' : '') + '> Reglen er aktiv</label>' +
        '<div class="note mt">' + icon('info') + '<div id="ruPreview"></div></div>',
      onOpen: (dlg) => {
        const upd = () => {
          const m = matching(dlg);
          $('#ruPreview', dlg).innerHTML = $('#ruKw', dlg).value.trim()
            ? '<p><b>' + m.length + '</b> af dine transaktioner passer på reglen.</p>' + (m.length ? '<ul class="history">' + m.slice(0, 5).map((t) => '<li>' + esc(U.fmtDate(t.date, { short: true })) + ' · ' + esc(t.description) + ' · ' + esc(U.fmtMoney(t.amount)) + '</li>').join('') + '</ul>' : '')
            : '<p>Skriv en tekst for at se, hvilke transaktioner reglen rammer.</p>';
        };
        $$('input,select', dlg).forEach((el) => el.addEventListener('input', upd));
        upd();
      },
      actions: [{ label: 'Annullér', value: null }, {
        label: 'Gem regel', primary: true, onClick: (dlg) => {
          const kw = $('#ruKw', dlg).value.trim();
          if (!kw) { UI.toast('Skriv den tekst, reglen skal reagere på', 'warn'); $('#ruKw', dlg).focus(); return false; }
          return {
            name: $('#ruName', dlg).value.trim(), keyword: kw.toUpperCase(), matchType: $('#ruType', dlg).value, categoryId: $('#ruCat', dlg).value,
            sign: $('#ruSign', dlg).value, accountId: $('#ruAcc', dlg).value || null, priority: parseInt($('#ruPrio', dlg).value, 10) || 0, active: $('#ruActive', dlg).checked,
            count: matching(dlg).filter((t) => t.categorySource !== 'manual').length,
          };
        },
      }],
    });
    if (!v) return null;
    const count = v.count; delete v.count;
    const rec = Object.assign({}, r, v, { updatedAt: new Date().toISOString() });
    await S.put('rules', rec).catch(fail);
    if (count && await UI.confirm({ title: 'Brug reglen nu?', message: 'Reglen passer på ' + count + ' transaktioner, som ikke er kategoriseret manuelt. Skal de kategoriseres igen med dine regler nu? Manuelt valgte kategorier ændres ikke.', confirmLabel: 'Ja, kategorisér igen' })) {
      const n = await applyRules();
      UI.toast(n + ' transaktioner fik ny kategori');
    }
    refresh();
    return rec;
  }

  // Kategoriserer igen. Manuelle valg røres kun, hvis overwriteManual er sat (kræver brugerens tilladelse).
  async function applyRules(opts) {
    const ctx = catCtx();
    const changed = [];
    for (const t of S.data.transactions) if (C.categorize(t, ctx, opts)) { t.updatedAt = new Date().toISOString(); changed.push(t); }
    if (changed.length) await S.put('transactions', changed).catch(fail);
    return changed.length;
  }

  // --- Transaktioner -----------------------------------------------------------

  function txForm(t, isNew) {
    const acc = t.accountId || (S.data.accounts[0] && S.data.accounts[0].id) || '';
    const foreign = t.currency && t.currency !== 'DKK';
    const typeSel = t.isInternalTransfer ? 'transfer' : 'auto';
    const edited = (f) => (t.edited && t.edited[f] ? ' <span class="badge info" title="Bankens værdi: ' + esc(f === 'amount' ? U.fmtMoney(t.original[f]) : f === 'date' ? U.fmtDate(t.original[f]) : t.original[f]) + '">ændret af dig</span>' : '');
    return '<form class="stack" id="txForm">' +
      '<div class="fields">' +
      '<div class="field"><label for="txDate">Dato' + edited('date') + '</label><input type="date" id="txDate" required value="' + esc(t.date || U.todayISO()) + '"></div>' +
      '<div class="field"><label for="txAmount">Beløb <span class="hint">(minus = penge ud)</span>' + edited('amount') + '</label><input type="text" inputmode="decimal" id="txAmount" required value="' + esc(UI.amountInputValue(t.amount)) + '" placeholder="-125,50"></div>' +
      '<div class="field"><label for="txCur">Valuta' + edited('currency') + '</label><input type="text" id="txCur" maxlength="3" value="' + esc(t.currency || 'DKK') + '"></div>' +
      '</div>' +
      '<div class="field' + (foreign ? '' : ' hidden') + '" id="rateWrap"><label for="txRate">Kurs til DKK <span class="hint">(fx 7,46 for EUR – ellers tælles beløbet ikke med i summerne)</span></label><input type="text" inputmode="decimal" id="txRate" value="' + esc(t.exchangeRate ? String(t.exchangeRate).replace('.', ',') : '') + '"></div>' +
      '<div class="field"><label for="txDesc">Beskrivelse' + edited('description') + '</label><input type="text" id="txDesc" maxlength="300" required value="' + esc(t.description || '') + '"></div>' +
      '<div class="fields">' +
      '<div class="field"><label for="txCat">Kategori</label><select id="txCat">' + UI.categoryOptions(t.categoryId || C.UNKNOWN_ID) + '</select></div>' +
      '<div class="field"><label for="txAcc">Konto</label><select id="txAcc">' + UI.accountOptions(acc) + '</select></div>' +
      '<div class="field"><label for="txType">Type</label><select id="txType">' + UI.options([['auto', 'Automatisk (ud fra beløb og kategori)'], ['transfer', 'Intern overførsel – tæller ikke']], typeSel) + '</select></div>' +
      '</div>' +
      '<div class="field"><label for="txTags">Tags <span class="hint">(adskil med komma)</span></label><input type="text" id="txTags" maxlength="200" value="' + esc((t.tags || []).join(', ')) + '"></div>' +
      '<div class="field"><label for="txNotes">Noter</label><textarea id="txNotes" maxlength="2000">' + esc(t.notes || '') + '</textarea></div>' +
      '<label class="check"><input type="checkbox" id="txOneOff"' + (t.isOneOff ? ' checked' : '') + '> Engangsudgift <span class="muted small">(kan skjules i månedssammenligningen)</span></label>' +
      (isNew ? '' : txInfo(t)) +
      '</form>';
  }

  function txInfo(t) {
    const batch = t.importBatchId ? S.byId.batches.get(t.importBatchId) : null;
    const raw = Object.entries(t.originalRowData || {});
    const k = GB.app.calc.classify(t);
    let html = '<hr><dl class="kv">' +
      '<dt>Beregnes som</dt><dd>' + esc(GB.analytics.TYPE_LABEL[k.type]) + '</dd>' +
      '<dt>Kategori valgt af</dt><dd>' + esc(C.SOURCE_LABEL[t.categorySource] || '–') + (t.categoryReason ? ' – ' + esc(t.categoryReason) : '') + '</dd>' +
      '<dt>Bankens tekst</dt><dd>' + esc(t.descriptionOriginal) + '</dd>' +
      '<dt>Kilde</dt><dd>' + (batch ? 'Importeret fra ' + esc(batch.fileName) + ' (' + esc(U.fmtDate(batch.importedAt.slice(0, 10))) + ')' : 'Oprettet manuelt') + '</dd>' +
      (t.duplicateOf ? '<dt>Mulig dublet</dt><dd>Importeret selvom en ens transaktion fandtes i forvejen</dd>' : '') +
      (t.isRecurring ? '<dt>Fast betaling</dt><dd>Ja</dd>' : '') +
      '</dl>';
    if (raw.length) html += '<details class="mt-s"><summary class="small">Oprindelig række fra filen</summary><dl class="kv mt-s">' + raw.map(([a, b]) => '<dt>' + esc(a) + '</dt><dd>' + esc(b) + '</dd>').join('') + '</dl></details>';
    if (t.history && t.history.length) {
      const fmt = (f, v) => (v == null ? '–' : f === 'amount' ? U.fmtMoney(v) : f === 'categoryId' ? UI.catName(v) : f === 'accountId' ? UI.accountName(v) : f === 'date' ? U.fmtDate(v) : String(v));
      const NAMES = { date: 'Dato', description: 'Beskrivelse', amount: 'Beløb', currency: 'Valuta', accountId: 'Konto', categoryId: 'Kategori', isInternalTransfer: 'Intern overførsel', exchangeRate: 'Kurs' };
      html += '<details class="mt-s"><summary class="small">Ændringshistorik (' + t.history.length + ')</summary><ul class="history">' +
        t.history.slice().reverse().map((h) => '<li>' + esc(new Date(h.at).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })) + ' – ' + esc(NAMES[h.field] || h.field) + ': ' + esc(fmt(h.field, h.from)) + ' → ' + esc(fmt(h.field, h.to)) + '</li>').join('') + '</ul></details>';
    }
    return html;
  }

  function readTxForm(dlg) {
    const date = $('#txDate', dlg).value;
    const amount = UI.readAmount($('#txAmount', dlg).value);
    const description = $('#txDesc', dlg).value.trim();
    if (!U.isValidISO(date)) { UI.toast('Vælg en gyldig dato', 'warn'); $('#txDate', dlg).focus(); return null; }
    if (amount == null) { UI.toast('Skriv et gyldigt beløb, fx -125,50', 'warn'); $('#txAmount', dlg).focus(); return null; }
    if (!description) { UI.toast('Skriv en beskrivelse', 'warn'); $('#txDesc', dlg).focus(); return null; }
    if (!$('#txAcc', dlg).value) { UI.toast('Opret først en konto', 'warn'); return null; }
    const cur = ($('#txCur', dlg).value.trim().toUpperCase() || 'DKK');
    const rate = UI.readAmount($('#txRate', dlg).value);
    return {
      date, amount, description, currency: /^[A-Z]{3}$/.test(cur) ? cur : 'DKK', exchangeRate: cur !== 'DKK' && rate > 0 ? rate : null,
      categoryId: $('#txCat', dlg).value, accountId: $('#txAcc', dlg).value, isInternalTransfer: $('#txType', dlg).value === 'transfer',
      tags: [...new Set($('#txTags', dlg).value.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 20),
      notes: $('#txNotes', dlg).value.trim(), isOneOff: $('#txOneOff', dlg).checked,
    };
  }
  function bindCurrency(dlg) {
    const upd = () => { $('#rateWrap', dlg).classList.toggle('hidden', ($('#txCur', dlg).value.trim().toUpperCase() || 'DKK') === 'DKK'); };
    $('#txCur', dlg).addEventListener('input', upd);
  }

  async function openTransaction(id) {
    const t = S.byId.transactions.get(id);
    if (!t) return;
    const anyEdited = t.edited && Object.keys(t.edited).length;
    const v = await UI.dialog({
      title: 'Transaktion', wide: true, body: txForm(t, false), onOpen: bindCurrency,
      actions: [
        { label: 'Slet', onClick: () => 'delete' },
        ...(anyEdited ? [{ label: 'Gendan bankens værdier', onClick: () => 'restore' }] : []),
        { label: 'Annullér', value: null },
        { label: 'Gem ændringer', primary: true, onClick: (dlg) => readTxForm(dlg) || false },
      ],
    });
    if (!v) return;
    if (v === 'delete') { await deleteTransactions([id]); return; }
    if (v === 'restore') {
      T.restoreOriginal(t);
      await S.put('transactions', t).catch(fail);
      UI.toast('Bankens oprindelige værdier er gendannet');
      refresh();
      return;
    }
    const catChanged = v.categoryId !== t.categoryId;
    T.applyEdit(t, v);
    if (catChanged) { t.categorySource = 'manual'; t.categoryRuleId = null; t.categoryReason = 'Valgt af dig'; if (!t.duplicateOf) t.needsReview = false; }
    await S.put('transactions', t).catch(fail);
    UI.toast('Transaktionen er gemt');
    refresh();
    if (catChanged && S.settings.askRuleOnCategoryChange) await offerRule(t, v.categoryId);
  }

  async function addTransaction() {
    if (!S.data.accounts.length) {
      UI.toast('Opret først en konto til transaktionen', 'warn');
      if (!(await accountDialog())) return;
    }
    const v = await UI.dialog({
      title: 'Ny transaktion', wide: true, body: txForm({ amount: '', currency: 'DKK', categoryId: C.UNKNOWN_ID, accountId: GB.app.state.account || '' }, true), onOpen: bindCurrency,
      actions: [{ label: 'Annullér', value: null }, { label: 'Tilføj', primary: true, onClick: (dlg) => readTxForm(dlg) || false }],
    });
    if (!v) return;
    const t = T.makeTransaction({ date: v.date, amount: v.amount, description: v.description, currency: v.currency }, v.accountId, null);
    Object.assign(t, { exchangeRate: v.exchangeRate, isInternalTransfer: v.isInternalTransfer, tags: v.tags, notes: v.notes, isOneOff: v.isOneOff });
    if (v.categoryId !== C.UNKNOWN_ID) { t.categoryId = v.categoryId; t.categorySource = 'manual'; t.categoryReason = 'Valgt af dig'; }
    else C.categorize(t, catCtx());
    await S.put('transactions', t).catch(fail);
    UI.toast('Transaktionen er tilføjet');
    refresh();
  }

  async function deleteTransactions(ids) {
    if (!ids.length) return false;
    const ok = await UI.confirm({ title: 'Slet transaktioner', message: ids.length === 1 ? 'Transaktionen slettes permanent fra Grejs Budget. Den kan hentes igen ved at importere bankfilen på ny.' : ids.length + ' transaktioner slettes permanent fra Grejs Budget.', confirmLabel: 'Slet', danger: true });
    if (!ok) return false;
    await S.remove('transactions', ids).catch(fail);
    UI.toast(ids.length === 1 ? 'Transaktionen er slettet' : ids.length + ' transaktioner er slettet');
    refresh();
    return true;
  }

  async function updateTransactions(ids, patch, label) {
    const list = ids.map((id) => S.byId.transactions.get(id)).filter(Boolean);
    for (const t of list) T.applyEdit(t, typeof patch === 'function' ? patch(t) : patch);
    await S.put('transactions', list).catch(fail);
    if (label) UI.toast(label);
    refresh();
  }

  // --- Import ------------------------------------------------------------------

  // Gemmer en bekræftet import samlet (alt eller intet).
  // files: [{ name, format, size, accountId, rows (med decision), errors, empty, isSample }]
  async function commitImport(files) {
    const now = new Date().toISOString();
    const ctx = catCtx();
    const batches = [], txs = [];
    for (const f of files) {
      const batch = {
        id: U.uid('batch'), fileName: f.name, format: f.format, importedAt: now, accountId: f.accountId,
        rowsRead: f.rows.length + f.errors.length, imported: 0, skippedDuplicates: 0, importedDuplicates: 0, errors: f.errors.length,
        firstDate: null, lastDate: null, isSample: !!f.isSample,
        warnings: f.errors.slice(0, 50).map((e) => 'Række ' + e.rowNo + ': ' + e.reason),
      };
      for (const r of f.rows) {
        if (r.decision !== 'import') { batch.skippedDuplicates++; continue; }
        const t = T.makeTransaction(Object.assign({}, r, { needsReview: r.dupStatus !== 'new' && r.dupStatus != null }), f.accountId, batch.id, now);
        if (r.dupStatus === 'possible' || r.dupStatus === 'certain') { t.duplicateOf = r.duplicateOf || null; batch.importedDuplicates++; }
        C.categorize(t, ctx);
        txs.push(t);
        batch.imported++;
        if (!batch.firstDate || t.date < batch.firstDate) batch.firstDate = t.date;
        if (!batch.lastDate || t.date > batch.lastDate) batch.lastDate = t.date;
      }
      batches.push(batch);
    }
    await S.batch([{ store: 'batches', put: batches }, { store: 'transactions', put: txs }]);
    await linkRecurring();
    return { batches, count: txs.length };
  }

  async function deleteBatch(id) {
    const b = S.byId.batches.get(id);
    if (!b) return;
    const ids = S.data.transactions.filter((t) => t.importBatchId === id).map((t) => t.id);
    const ok = await UI.confirm({ title: 'Fortryd import', html: 'Importen af <b>' + esc(b.fileName) + '</b> fjernes sammen med dens <b>' + ids.length + '</b> transaktioner. Andre importer og dine øvrige data røres ikke.', confirmLabel: 'Fjern importen', danger: true });
    if (!ok) return;
    await S.batch([{ store: 'transactions', remove: ids }, { store: 'batches', remove: [id] }]).catch(fail);
    UI.toast('Importen er fjernet');
    refresh();
  }

  // Markerer transaktioner, der hører til bekræftede faste betalinger, og opdaterer seneste dato.
  async function linkRecurring() {
    const recs = S.data.recurring.filter((r) => r.status === 'confirmed' && r.matchKey);
    const changed = new Set(), changedRecs = [];
    for (const t of S.data.transactions) {
      const r = recs.find((x) => GB.recurring.matches(x, t));
      const want = r ? r.id : null;
      if ((t.recurringId || null) !== want) { t.recurringId = want; t.isRecurring = !!want; changed.add(t); }
      if (r && (!r.lastDate || t.date > r.lastDate)) { r.lastDate = t.date; r.nextDate = GB.recurring.nextDate(r.frequency, t.date); if (!changedRecs.includes(r)) changedRecs.push(r); }
    }
    const ops = [];
    if (changed.size) ops.push({ store: 'transactions', put: [...changed] });
    if (changedRecs.length) ops.push({ store: 'recurring', put: changedRecs });
    if (ops.length) await S.batch(ops).catch(fail);
  }

  // --- Eksempeldata ------------------------------------------------------------

  async function loadSample() {
    if (S.data.transactions.length && !(await UI.confirm({ title: 'Indlæs eksempeldata', message: 'Du har allerede data. Eksempeldata lægges ved siden af og kan fjernes igen med ét klik under Indstillinger.', confirmLabel: 'Indlæs eksempeldata' }))) return;
    const today = U.todayISO();
    const gen = GB.sample.generate(today, 7, 4242);
    const now = new Date().toISOString();
    const accs = [
      { id: U.uid('acc'), name: 'Lønkonto (eksempel)', type: 'checking', bank: 'Eksempelbank', currency: 'DKK', createdAt: now, isSample: true },
      { id: U.uid('acc'), name: 'Kreditkort (eksempel)', type: 'credit', bank: 'Eksempelbank', currency: 'DKK', createdAt: now, isSample: true },
      { id: U.uid('acc'), name: 'Opsparing (eksempel)', type: 'savings', bank: 'Eksempelbank', currency: 'DKK', createdAt: now, isSample: true },
    ];
    await S.put('accounts', accs);
    const files = [[gen.checking, accs[0]], [gen.card, accs[1]], [gen.savings, accs[2]]].map(([rows, acc]) => ({
      name: 'Eksempeldata – ' + acc.name.replace(' (eksempel)', ''), format: 'sample', accountId: acc.id, isSample: true, errors: [],
      rows: rows.map((r, i) => Object.assign({ rowNo: i + 2, currency: 'DKK', raw: {} }, r, { dupStatus: 'new', decision: 'import' })),
    }));
    const res = await commitImport(files);
    const mk = U.monthKey(today);
    if (!S.data.budgets.some((b) => b.month === mk)) {
      await S.put('budgets', {
        id: mk, month: mk, expectedIncome: 24800, savingsTarget: 2000, total: 22000, isSample: true, createdAt: now, updatedAt: now,
        lines: [['food-groceries', 4500], ['food-takeaway', 1100], ['transport-fuel', 1400], ['subs-streaming', 350], ['shopping-clothes', 1200], ['housing-electricity', 750], ['food-restaurant', 500]]
          .map(([categoryId, amount]) => ({ categoryId, amount, rollover: false, accountId: null })),
      });
    }
    await S.put('goals', [
      { id: U.uid('goal'), name: 'Nødfond', type: 'emergency', target: 30000, saved: 12500, targetDate: U.addMonths(today, 10), monthly: 1500, color: '#16a34a', createdAt: now, isSample: true },
      { id: U.uid('goal'), name: 'Sommerferie', type: 'holiday', target: 15000, saved: 4200, targetDate: U.addMonths(today, 7), monthly: 1000, color: '#f97316', createdAt: now, isSample: true },
    ]);
    await S.saveSettings({ onboarded: true });
    UI.toast(res.count + ' eksempeltransaktioner er indlæst');
    GB.app.state.period = 'this-month';
    refresh();
  }

  function sampleCounts() {
    const batches = new Set(S.data.batches.filter((b) => b.isSample).map((b) => b.id));
    return { batches, txs: S.data.transactions.filter((t) => batches.has(t.importBatchId)).length, any: batches.size > 0 || S.data.accounts.some((a) => a.isSample) };
  }

  async function clearSample() {
    const sc = sampleCounts();
    const ok = await UI.confirm({ title: 'Fjern eksempeldata', message: 'Alle eksempeltransaktioner (' + sc.txs + '), eksempelkonti, eksempelbudgettet og eksempelmålene fjernes. Dine egne data røres ikke.', confirmLabel: 'Fjern eksempeldata', danger: true });
    if (!ok) return;
    const txIds = S.data.transactions.filter((t) => sc.batches.has(t.importBatchId)).map((t) => t.id);
    const remainingAcc = new Set(S.data.transactions.filter((t) => !sc.batches.has(t.importBatchId)).map((t) => t.accountId));
    await S.batch([
      { store: 'transactions', remove: txIds },
      { store: 'batches', remove: [...sc.batches] },
      { store: 'accounts', remove: S.data.accounts.filter((a) => a.isSample && !remainingAcc.has(a.id)).map((a) => a.id) },
      { store: 'budgets', remove: S.data.budgets.filter((b) => b.isSample).map((b) => b.id) },
      { store: 'goals', remove: S.data.goals.filter((g) => g.isSample).map((g) => g.id) },
      { store: 'recurring', remove: S.data.recurring.filter((r) => r.isSample || (r.accountId && !remainingAcc.has(r.accountId) && S.byId.accounts.get(r.accountId) && S.byId.accounts.get(r.accountId).isSample)).map((r) => r.id) },
    ]).catch(fail);
    if (GB.app.state.account && !S.byId.accounts.has(GB.app.state.account)) GB.app.state.account = '';
    UI.toast('Eksempeldata er fjernet');
    refresh();
  }

  // --- Sikkerhedskopi ----------------------------------------------------------

  function downloadBackup() {
    const b = GB.exporter.makeBackup(S);
    GB.exporter.download(JSON.stringify(b), 'grejs-budget-sikkerhedskopi_' + GB.exporter.stamp() + '.json', 'application/json');
    S.saveSettings({ lastBackupAt: new Date().toISOString() }).catch(() => {});
    UI.toast('Sikkerhedskopien er hentet – gem den et sikkert sted');
  }

  GB.actions = {
    ACCOUNT_TYPES, accountDialog, pickCategory, setCategory, offerRule, newRule, ruleDialog, applyRules,
    openTransaction, addTransaction, deleteTransactions, updateTransactions,
    commitImport, deleteBatch, linkRecurring, loadSample, clearSample, sampleCounts, downloadBackup, catCtx,
  };
})();
