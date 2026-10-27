// Fælles beregningsregler. Dashboard, transaktioner, budgetter, sammenligning og rapporter
// bruger ALLE classify()/summarize() herfra, så de aldrig viser forskellige tal.
//
// Regler (kan delvist slås til/fra i indstillinger):
//   - Interne overførsler (markeret af brugeren eller kategori med kind "transfer", fx
//     "Interne overførsler" og "Betaling af kreditkort") tæller hverken som indtægt eller forbrug.
//     Derved dobbelttælles et kreditkortkøb ikke, når kortregningen betales fra lønkontoen.
//   - Opsparing/investering (kind "savings") vises som opsparing, ikke forbrug
//     (indstilling savingsAsExpense = true gør dem til forbrug).
//   - Kontanthævning er forbrug (cashAsExpense = false gør den til en overførsel).
//   - Penge ind i en udgiftskategori (fx returvarer) er en refusion: den modregnes i kategoriens
//     forbrug (refundsOffset = true) eller tælles som indtægt (false).
//   - Penge ind uden kategori tælles som indtægt.
//   - En "blandet" kategori (kind "mixed", fx MobilePay) tæller penge ud som forbrug og penge ind som indtægt.
//   - Beløb i fremmed valuta tælles kun med, når brugeren har angivet en kurs (tx.exchangeRate).
//   Netto = indtægter − forbrug. Opsparing trækkes ikke fra netto.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;

  const DEFAULT_RULES = { refundsOffset: true, cashAsExpense: true, savingsAsExpense: false };

  const TYPE_LABEL = {
    income: 'Indtægt', expense: 'Udgift', refund: 'Refusion', transfer: 'Intern overførsel', savings: 'Opsparing', foreign: 'Fremmed valuta uden kurs',
  };

  function makeCalc(categories, rules) {
    const r = Object.assign({}, DEFAULT_RULES, rules || {});
    const cats = new Map(categories.map((c) => [c.id, c]));

    const groupOf = (id) => { const c = cats.get(id); return c ? (c.parentId || c.id) : 'other'; };

    function dkk(tx) {
      if (!tx.currency || tx.currency === 'DKK') return tx.amount;
      if (tx.exchangeRate > 0) return U.round2(tx.amount * tx.exchangeRate);
      return null;
    }

    // Returnerer { type, income, expense, savings } i kroner (bidrag til summerne).
    function classify(tx) {
      const a = dkk(tx);
      const z = { income: 0, expense: 0, savings: 0 };
      if (a == null) return Object.assign(z, { type: 'foreign' });
      if (tx.isInternalTransfer) return Object.assign(z, { type: 'transfer' });
      const c = cats.get(tx.categoryId);
      let kind = c ? c.kind : 'expense';
      if (tx.categoryId === 'other-cash' && !r.cashAsExpense) kind = 'transfer';
      if (kind === 'transfer') return Object.assign(z, { type: 'transfer' });
      if (kind === 'savings') {
        if (!r.savingsAsExpense) return Object.assign(z, { type: 'savings', savings: -a });
        kind = 'expense';
      }
      if (kind === 'income') return Object.assign(z, { type: 'income', income: a });
      // Blandet kategori (fx MobilePay): penge ud er forbrug, penge ind er indtægt.
      if (kind === 'mixed') return a < 0 ? Object.assign(z, { type: 'expense', expense: -a }) : Object.assign(z, { type: 'income', income: a });
      if (a < 0) return Object.assign(z, { type: 'expense', expense: -a });
      if (tx.categoryId === 'other-unknown' || !c) return Object.assign(z, { type: 'income', income: a });
      if (r.refundsOffset) return Object.assign(z, { type: 'refund', expense: -a });
      return Object.assign(z, { type: 'income', income: a });
    }

    // Summer for en liste transaktioner – alt regnes i øre.
    function summarize(txs) {
      let inc = 0, exp = 0, sav = 0, transfers = 0, foreign = 0;
      const byCat = new Map(), byGroup = new Map(), incomeByCat = new Map();
      for (const t of txs) {
        const k = classify(t);
        if (k.type === 'transfer') { transfers++; continue; }
        if (k.type === 'foreign') { foreign++; continue; }
        const io = U.toOre(k.income), eo = U.toOre(k.expense), so = U.toOre(k.savings);
        inc += io; exp += eo; sav += so;
        if (eo) {
          byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + eo);
          const g = groupOf(t.categoryId);
          byGroup.set(g, (byGroup.get(g) || 0) + eo);
        }
        if (io) incomeByCat.set(t.categoryId, (incomeByCat.get(t.categoryId) || 0) + io);
      }
      const kr = (m) => new Map([...m].map(([k, v]) => [k, U.fromOre(v)]));
      return {
        income: U.fromOre(inc), expense: U.fromOre(exp), net: U.fromOre(inc - exp), savings: U.fromOre(sav),
        count: txs.length, transfers, foreign,
        byCategory: kr(byCat), byGroup: kr(byGroup), incomeByCategory: kr(incomeByCat),
      };
    }

    // Forbrug for én kategori (eller hovedkategori inkl. underkategorier).
    function spentIn(txs, categoryId) {
      const isGroup = cats.has(categoryId) && !cats.get(categoryId).parentId;
      let ore = 0;
      for (const t of txs) {
        if (isGroup ? groupOf(t.categoryId) !== categoryId : t.categoryId !== categoryId) continue;
        ore += U.toOre(classify(t).expense);
      }
      return U.fromOre(ore);
    }

    function byMonth(txs, months) {
      const buckets = new Map(months.map((m) => [m, []]));
      for (const t of txs) { const b = buckets.get(U.monthKey(t.date)); if (b) b.push(t); }
      return months.map((m) => Object.assign({ month: m }, summarize(buckets.get(m))));
    }

    return { rules: r, classify, summarize, spentIn, byMonth, groupOf, dkk, categories: cats };
  }

  // --- Perioder ----------------------------------------------------------------

  const PERIODS = [
    ['this-month', 'Denne måned'], ['last-month', 'Sidste måned'], ['last-3', 'Seneste 3 måneder'],
    ['last-6', 'Seneste 6 måneder'], ['this-year', 'I år'], ['last-12', 'Seneste 12 måneder'], ['all', 'Alle data'], ['custom', 'Valgfri periode'],
  ];

  function periodRange(key, today, custom, dataRange) {
    const mk = U.monthKey(today);
    switch (key) {
      case 'last-month': { const m = U.addMonthKey(mk, -1); return { from: U.monthStart(m), to: U.monthEnd(m) }; }
      case 'last-3': return { from: U.monthStart(U.addMonthKey(mk, -2)), to: U.monthEnd(mk) };
      case 'last-6': return { from: U.monthStart(U.addMonthKey(mk, -5)), to: U.monthEnd(mk) };
      case 'last-12': return { from: U.monthStart(U.addMonthKey(mk, -11)), to: U.monthEnd(mk) };
      case 'this-year': return { from: mk.slice(0, 4) + '-01-01', to: mk.slice(0, 4) + '-12-31' };
      case 'all': return dataRange && dataRange.from ? { from: dataRange.from, to: dataRange.to } : { from: U.monthStart(mk), to: U.monthEnd(mk) };
      case 'custom':
        if (custom && U.isValidISO(custom.from) && U.isValidISO(custom.to)) return custom.from <= custom.to ? { from: custom.from, to: custom.to } : { from: custom.to, to: custom.from };
        return { from: U.monthStart(mk), to: U.monthEnd(mk) };
      default: return { from: U.monthStart(mk), to: U.monthEnd(mk) };
    }
  }

  function periodLabel(range) {
    const a = U.parts(range.from), b = U.parts(range.to);
    const fullMonth = a.d === 1 && range.to === U.monthEnd(U.monthKey(range.to));
    if (fullMonth && U.monthKey(range.from) === U.monthKey(range.to)) return U.capitalize(U.fmtMonth(U.monthKey(range.from)));
    if (fullMonth && a.y === b.y && a.m === 1 && b.m === 12) return 'Året ' + a.y;
    if (fullMonth) return U.capitalize(U.MONTHS[a.m - 1]) + (a.y !== b.y ? ' ' + a.y : '') + ' – ' + U.MONTHS[b.m - 1] + ' ' + b.y;
    return U.fmtDate(range.from, { short: true }) + ' – ' + U.fmtDate(range.to, { short: true });
  }

  // Er en måned dækket af data? En måned er ufuldstændig, hvis den indeholder første eller
  // sidste importerede dato, og data ikke dækker hele måneden – eller hvis måneden ikke er slut endnu.
  function monthCoverage(mk, dataRange, today) {
    const start = U.monthStart(mk), end = U.monthEnd(mk);
    const total = U.daysInMonth(+mk.slice(0, 4), +mk.slice(5, 7));
    if (!dataRange || !dataRange.from) return { complete: false, reason: 'Ingen data', days: 0, total };
    const from = dataRange.from > start ? dataRange.from : start;
    let to = dataRange.to < end ? dataRange.to : end;
    if (today && today < to) to = today;
    if (from > to) return { complete: false, reason: 'Ingen data i måneden', days: 0, total };
    const days = U.daysBetween(from, to) + 1;
    if (today && today >= start && today < end) return { complete: false, reason: 'Måneden er ikke slut', days, total, partial: true };
    if (U.daysBetween(start, from) > 2) return { complete: false, reason: 'Data starter først ' + U.fmtDate(from, { short: true }), days, total, partial: true };
    if (U.daysBetween(to, end) > 2) return { complete: false, reason: 'Data slutter ' + U.fmtDate(to, { short: true }), days, total, partial: true };
    return { complete: true, reason: '', days, total };
  }

  // Ændring i kroner og procent. Procent vises ikke, hvis grundlaget er 0 eller mangler.
  function change(cur, prev) {
    const diff = U.round2(cur - prev);
    const pct = prev && Math.abs(prev) >= 1 ? (diff / Math.abs(prev)) * 100 : null;
    return { diff, pct };
  }

  // Forslag til interne overførsler: samme beløb ud af én konto og ind på en anden inden for 4 dage.
  function findTransferPairs(txs) {
    const ins = txs.filter((t) => t.amount > 0 && !t.isInternalTransfer);
    const byAmount = new Map();
    for (const t of ins) {
      const k = U.toOre(t.amount);
      if (!byAmount.has(k)) byAmount.set(k, []);
      byAmount.get(k).push(t);
    }
    const used = new Set();
    const pairs = [];
    for (const out of txs) {
      if (out.amount >= 0 || out.isInternalTransfer) continue;
      const cands = byAmount.get(U.toOre(-out.amount)) || [];
      const m = cands.find((t) => !used.has(t.id) && t.accountId !== out.accountId && Math.abs(U.daysBetween(out.date, t.date)) <= 4);
      if (m) { used.add(m.id); pairs.push([out, m]); }
    }
    return pairs;
  }

  // Hvilke måneder har en konto data for? Bruges på importsiden.
  // Dækning = perioderne fra hver importeret fil (første til sidste dato) + datoerne for alle
  // transaktioner på kontoen. En måned er:
  //   'full'    – dækket (højst 3 dage mangler; for den igangværende måned: indtil i dag)
  //   'partial' – noget af måneden er dækket
  //   'none'    – ingen data – kan importeres
  //   'future'  – måneden er ikke begyndt endnu
  function accountCoverage(txs, batches, accountId, months, today) {
    const iv = [];
    const count = new Map();
    for (const b of batches) if (b.accountId === accountId && b.imported > 0 && U.isValidISO(b.firstDate) && U.isValidISO(b.lastDate)) iv.push([U.dayNum(b.firstDate), U.dayNum(b.lastDate)]);
    for (const t of txs) {
      if (t.accountId !== accountId) continue;
      const d = U.dayNum(t.date);
      iv.push([d, d]);
      const mk = U.monthKey(t.date);
      count.set(mk, (count.get(mk) || 0) + 1);
    }
    iv.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [a, b] of iv) {
      const last = merged[merged.length - 1];
      if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b); else merged.push([a, b]);
    }
    const todayN = U.dayNum(today);
    return months.map((mk) => {
      const start = U.dayNum(U.monthStart(mk)), end = U.dayNum(U.monthEnd(mk));
      const current = todayN >= start && todayN <= end;
      if (start > todayN) return { month: mk, status: 'future', txCount: 0, current: false };
      const limit = Math.min(end, todayN);
      let covered = 0, first = null, lastDay = null;
      for (const [a, b] of merged) {
        const lo = Math.max(a, start), hi = Math.min(b, limit);
        if (lo > hi) continue;
        covered += hi - lo + 1;
        if (first == null) first = lo;
        lastDay = hi;
      }
      const total = limit - start + 1;
      const status = !covered ? 'none' : covered >= total - 3 ? 'full' : 'partial';
      return { month: mk, status, txCount: count.get(mk) || 0, current, from: first != null ? U.fromDayNum(first) : null, to: lastDay != null ? U.fromDayNum(lastDay) : null, missingDays: total - covered };
    });
  }

  function dataRange(txs) {
    let from = null, to = null;
    for (const t of txs) {
      if (!from || t.date < from) from = t.date;
      if (!to || t.date > to) to = t.date;
    }
    return { from, to };
  }

  GB.analytics = { DEFAULT_RULES, TYPE_LABEL, PERIODS, makeCalc, periodRange, periodLabel, monthCoverage, change, findTransferPairs, dataRange, accountCoverage };
})();
