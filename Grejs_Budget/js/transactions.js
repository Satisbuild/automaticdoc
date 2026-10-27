// Transaktioner: oprettelse fra importerede rækker, dubletkontrol, redigering med historik,
// søgning, filtrering og sortering.
//
// Bankens oprindelige værdier gemmes i tx.original og ændres aldrig. Retter brugeren dato,
// tekst eller beløb, logges ændringen i tx.history, og feltet markeres i tx.edited,
// så det oprindelige altid kan ses og genskabes.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;
  const C = GB.categories;

  function makeTransaction(row, accountId, batchId, now) {
    const ts = now || new Date().toISOString();
    const desc = String(row.description || '').slice(0, 500);
    return {
      id: U.uid('tx'),
      accountId,
      importBatchId: batchId || null,
      date: row.date,
      description: desc,
      descriptionOriginal: desc,
      descriptionNormalized: C.normalizeDescription(desc),
      amount: U.round2(row.amount),
      currency: row.currency || 'DKK',
      exchangeRate: null,
      balance: row.balance != null ? row.balance : null,
      categoryId: C.UNKNOWN_ID,
      categorySource: 'unknown',
      categoryRuleId: null,
      categoryReason: '',
      bankTransactionId: row.reference || null,
      duplicateOf: row.duplicateOf || null,
      isInternalTransfer: false,
      isRecurring: false,
      recurringId: null,
      isOneOff: false,
      needsReview: !!row.needsReview,
      notes: '',
      tags: [],
      original: { date: row.date, description: desc, amount: U.round2(row.amount), currency: row.currency || 'DKK' },
      edited: {},
      history: [],
      originalRowData: row.raw || {},
      createdAt: ts,
      updatedAt: ts,
    };
  }

  // --- Dubletter ---------------------------------------------------------------

  function signature(accountId, date, amount, description) {
    return accountId + '|' + date + '|' + U.toOre(amount) + '|' + C.normalizeDescription(description).replace(/[^A-Z0-9ÆØÅ]/g, '');
  }
  const txSignature = (t) => signature(t.accountId, t.original ? t.original.date : t.date, t.original ? t.original.amount : t.amount, t.original ? t.original.description : t.description);

  // Er bankens reference/ID-kolonne pålidelig? Kun hvis den næsten altid er udfyldt og unik.
  function referencesReliable(rows) {
    if (!rows.length) return false;
    const refs = rows.map((r) => r.reference).filter(Boolean);
    if (refs.length < rows.length * 0.8) return false;
    return new Set(refs).size >= refs.length * 0.98;
  }

  // Indeks over det, der allerede er gemt (og det, der er valgt til import tidligere i samme import).
  function makeDuplicateIndex(existing) {
    const idx = { sig: new Map(), ref: new Map() };
    for (const t of existing) addToIndex(idx, t);
    return idx;
  }
  function addToIndex(idx, t) {
    const s = txSignature(t);
    if (!idx.sig.has(s)) idx.sig.set(s, []);
    idx.sig.get(s).push({ id: t.id || null, ref: t.bankTransactionId || null });
    if (t.bankTransactionId) idx.ref.set(t.accountId + '|' + t.bankTransactionId, t.id || null);
  }

  // Markerer hver række med dupStatus:
  //   'new'      – ny transaktion
  //   'certain'  – samme bank-ID findes allerede (springes over som standard)
  //   'possible' – samme konto, dato, beløb og tekst findes allerede (springes over som standard, men kan vælges)
  // To ens køb i SAMME fil er ikke dubletter af hinanden – de får 'new' og en note (twinsInFile).
  // Der slettes aldrig noget automatisk; brugeren kan ændre hver beslutning (row.decision).
  function markDuplicates(rows, accountId, idx) {
    const useRefs = referencesReliable(rows);
    const consumed = new Set();
    const inFile = new Map();
    for (const r of rows) {
      const s = signature(accountId, r.date, r.amount, r.description);
      inFile.set(s, (inFile.get(s) || 0) + 1);
    }
    for (const r of rows) {
      const s = signature(accountId, r.date, r.amount, r.description);
      r.signature = s;
      r.twinsInFile = inFile.get(s);
      // Bankens ID bruges (og gemmes) kun, hvis kolonnen er pålidelig i hele filen.
      // Værdien findes stadig i originalRowData.
      if (!useRefs) r.reference = null;
      const refKey = useRefs && r.reference ? accountId + '|' + r.reference : null;
      if (refKey && idx.ref.has(refKey)) {
        r.dupStatus = 'certain'; r.duplicateOf = idx.ref.get(refKey); r.decision = 'skip';
        const e = (idx.sig.get(s) || []).find((x) => x.ref === r.reference);
        if (e) consumed.add(e);
        continue;
      }
      // Hver gemt transaktion kan kun "bruges" som dublet-match én gang. Har rækken et pålideligt
      // bank-ID, kan den kun matche gemte poster uden ID (et andet ID = en anden transaktion).
      const match = (idx.sig.get(s) || []).find((e) => !consumed.has(e) && (!refKey || !e.ref));
      if (match) {
        r.dupStatus = 'possible'; r.duplicateOf = match.id; r.decision = 'skip';
        consumed.add(match);
        continue;
      }
      r.dupStatus = 'new'; r.duplicateOf = null; r.decision = 'import';
    }
    return { useRefs };
  }

  // --- Redigering --------------------------------------------------------------

  const TRACKED = ['date', 'description', 'amount', 'currency', 'accountId', 'categoryId', 'isInternalTransfer', 'exchangeRate', 'linkedTo'];

  // Retter felter og logger ændringerne. Returnerer listen af ændrede felter.
  function applyEdit(tx, changes, now) {
    const ts = now || new Date().toISOString();
    const changed = [];
    for (const [k, v] of Object.entries(changes)) {
      const before = tx[k];
      if (JSON.stringify(before) === JSON.stringify(v)) continue;
      tx[k] = v;
      changed.push(k);
      if (TRACKED.includes(k)) {
        tx.history = (tx.history || []).concat({ at: ts, field: k, from: before == null ? null : before, to: v == null ? null : v }).slice(-50);
      }
      if (tx.original && k in tx.original) {
        tx.edited = Object.assign({}, tx.edited);
        if (JSON.stringify(tx.original[k]) === JSON.stringify(v)) delete tx.edited[k]; else tx.edited[k] = true;
      }
    }
    if (changed.includes('description')) tx.descriptionNormalized = C.normalizeDescription(tx.description);
    if (changed.length) tx.updatedAt = ts;
    return changed;
  }

  function restoreOriginal(tx, now) {
    if (!tx.original) return [];
    return applyEdit(tx, { date: tx.original.date, description: tx.original.description, amount: tx.original.amount, currency: tx.original.currency }, now);
  }

  // --- Penge fra andre (fx MobilePay, når man har lagt ud) ---------------------

  const isMobilePay = (t) => t.categoryId === 'other-mobilepay' || /(^|[^A-ZÆØÅ])MOBILE ?PAY/.test(t.descriptionNormalized || C.normalizeDescription(t.description));

  // Beløb, der er koblet til udgiften.
  const reimbursementsOf = (expense, txs) => txs.filter((t) => t.linkedTo === expense.id && t.amount > 0);

  // Udgiften minus det, andre har betalt tilbage (aldrig under 0).
  function ownShare(expense, txs) {
    const back = U.sumAmounts(reimbursementsOf(expense, txs), (t) => t.amount);
    return { paid: -expense.amount, back, own: Math.max(0, U.round2(-expense.amount - back)) };
  }

  // Tidsrummet, der ledes i: fra starten af købsmåneden (eller 3 dage før købet, hvis det er tidligere)
  // til 45 dage efter. opts.all: fra 14 dage før / månedens start til 120 dage efter.
  function reimbursementWindow(expense, all) {
    const monthStart = U.monthStart(U.monthKey(expense.date));
    const early = U.addDays(expense.date, all ? -14 : -3);
    return { from: early < monthStart ? early : monthStart, to: U.addDays(expense.date, all ? 120 : 45) };
  }

  // Alle penge ind i tidsrummet – MobilePay, eller alle indbetalinger med opts.all – med en status:
  //   ok          – kan kobles på
  //   linked      – allerede koblet til et andet køb (linkedTo peger på det)
  //   tooBig      – større end det, der mangler at blive dækket
  // classify udelukker opsparing, refusioner fra butikker og overførsler – dog ikke overførsler,
  // appen kun har gættet på (fx "Overførsel fra Søren"), for det er ofte netop penge fra andre.
  function reimbursementOptions(expense, txs, opts) {
    const o = opts || {};
    const left = ownShare(expense, txs).own;
    const win = reimbursementWindow(expense, o.all);
    const excluded = (t) => {
      if (!o.classify) return false;
      const type = o.classify(t).type;
      return ['savings', 'foreign', 'refund'].includes(type) || (type === 'transfer' && t.categorySource !== 'suggested');
    };
    return txs.filter((t) => t.amount > 0 && t.linkedTo !== expense.id && t.id !== expense.id && !t.isInternalTransfer && (o.all || isMobilePay(t)) &&
        t.date >= win.from && t.date <= win.to && !(o.classify && !t.linkedTo && excluded(t)))
      .map((t) => ({ t, status: t.linkedTo ? 'linked' : t.amount > left + 0.005 ? 'tooBig' : 'ok' }))
      .sort((a, b) => Math.abs(U.daysBetween(expense.date, a.t.date)) - Math.abs(U.daysBetween(expense.date, b.t.date)) || b.t.amount - a.t.amount);
  }

  // Forslag, der kan kobles på (se reimbursementOptions).
  function reimbursementCandidates(expense, txs, opts) {
    return reimbursementOptions(expense, txs, opts).filter((x) => x.status === 'ok').map((x) => x.t);
  }

  // Forslag til hvilken udgift et modtaget beløb hører til: udgifter fra 45 dage før til 3 dage efter,
  // hvor der stadig mangler mindst beløbet at blive dækket. classify sikrer, at det er rigtige udgifter.
  // Rækkefølge: udgifter, andre allerede har betalt til (delte køb), derefter de nærmeste dage
  // (i bidder af 4 dage), og inden for samme bid de største køb – dem lægger man oftest ud for.
  function expenseCandidates(money, txs, classify) {
    const shared = new Set(txs.filter((t) => t.linkedTo).map((t) => t.linkedTo));
    const near = (t) => Math.floor(Math.abs(U.daysBetween(money.date, t.date)) / 4);
    return txs.filter((t) => t.amount < 0 && t.id !== money.id && t.categoryId !== 'other-mobilepay' && (!classify || classify(t).type === 'expense') &&
        t.date >= U.addDays(money.date, -45) && t.date <= U.addDays(money.date, 3) && ownShare(t, txs).own >= money.amount - 0.005)
      .sort((a, b) => (shared.has(b.id) - shared.has(a.id)) || near(a) - near(b) || a.amount - b.amount);
  }

  // --- Søgning, filtre og sortering --------------------------------------------

  // f: { from, to, accountIds, categoryIds (Set), types (Set: income|expense|transfer|savings|refund),
  //      min, max (beløbets absolutte værdi), tags, text, review, batchId, ids, recurring }
  // classify: funktion fra analytics, så "type" betyder det samme som i alle beregninger.
  function filterTransactions(txs, f, helpers) {
    const h = helpers || {};
    const text = f.text ? U.fold(f.text) : '';
    const terms = text ? text.split(' ') : [];
    return txs.filter((t) => {
      if (f.ids && !f.ids.has(t.id)) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (f.accountIds && f.accountIds.size && !f.accountIds.has(t.accountId)) return false;
      // Penge fra andre, der er koblet til en udgift, vises sammen med udgiftens kategori.
      if (f.categoryIds && f.categoryIds.size && !f.categoryIds.has(t.categoryId) && !(t.linkedTo && h.classify && f.categoryIds.has(h.classify(t).categoryId))) return false;
      if (f.batchId && t.importBatchId !== f.batchId) return false;
      if (f.review && !(t.needsReview || t.categorySource === 'suggested' || t.categorySource === 'unknown')) return false;
      if (f.recurring && !t.isRecurring) return false;
      const abs = Math.abs(t.amount);
      if (f.min != null && f.min !== '' && abs < +f.min) return false;
      if (f.max != null && f.max !== '' && abs > +f.max) return false;
      if (f.tags && f.tags.length && !f.tags.every((tag) => (t.tags || []).includes(tag))) return false;
      if (f.types && f.types.size && h.classify && !f.types.has(h.classify(t).type)) return false;
      if (terms.length) {
        const hay = U.fold([t.description, t.descriptionOriginal, t.notes, (t.tags || []).join(' '), h.categoryName ? h.categoryName(t.categoryId) : '', U.fmtNumber(Math.abs(t.amount), 2), String(Math.abs(t.amount))].join(' '));
        if (!terms.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }

  function sortTransactions(txs, key, dir, helpers) {
    const d = dir === 'asc' ? 1 : -1;
    const h = helpers || {};
    const cmp = {
      date: (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
      amount: (a, b) => a.amount - b.amount,
      description: (a, b) => a.description.localeCompare(b.description, 'da'),
      category: (a, b) => (h.categoryName ? h.categoryName(a.categoryId).localeCompare(h.categoryName(b.categoryId), 'da') : 0),
    }[key] || ((a, b) => a.date.localeCompare(b.date));
    return txs.slice().sort((a, b) => d * cmp(a, b) || d * a.id.localeCompare(b.id));
  }

  GB.tx = {
    makeTransaction, signature, txSignature, referencesReliable, makeDuplicateIndex, addToIndex, markDuplicates,
    applyEdit, restoreOriginal, filterTransactions, sortTransactions,
    isMobilePay, reimbursementsOf, ownShare, reimbursementWindow, reimbursementOptions, reimbursementCandidates, expenseCandidates,
  };
})();
