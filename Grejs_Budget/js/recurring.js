// Faste betalinger og abonnementer.
//
// Mulige faste betalinger findes ved at gruppere udgifter med samme betalingsmodtager
// (merchantKey) og se på afstanden mellem betalingerne. Brugeren skal selv bekræfte dem.
// Appen kan ikke opsige eller stoppe betalinger – den viser kun et overblik.
//
// RecurringPayment:
//   { id, name, matchKey, accountId, amount, amountMin, amountMax, frequency, lastDate, nextDate,
//     status: 'confirmed' | 'dismissed', manual, categoryId, notes }

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;
  const C = GB.categories;

  const FREQUENCIES = {
    weekly: { label: 'Ugentlig', min: 5, max: 9, minCount: 4, perMonth: 52 / 12 },
    monthly: { label: 'Månedlig', min: 25, max: 36, minCount: 3, perMonth: 1 },
    quarterly: { label: 'Kvartalsvis', min: 80, max: 100, minCount: 2, perMonth: 1 / 3 },
    halfyear: { label: 'Halvårlig', min: 170, max: 195, minCount: 2, perMonth: 1 / 6 },
    yearly: { label: 'Årlig', min: 350, max: 380, minCount: 2, perMonth: 1 / 12 },
  };

  function nextDate(freq, date) {
    switch (freq) {
      case 'weekly': return U.addDays(date, 7);
      case 'quarterly': return U.addMonths(date, 3);
      case 'halfyear': return U.addMonths(date, 6);
      case 'yearly': return U.addMonths(date, 12);
      default: return U.addMonths(date, 1);
    }
  }

  // Første forventede dato fra og med "from".
  function upcoming(rec, from) {
    let d = rec.nextDate || (rec.lastDate ? nextDate(rec.frequency, rec.lastDate) : from);
    for (let i = 0; d < from && i < 600; i++) d = nextDate(rec.frequency, d);
    return d;
  }
  function occurrencesBetween(rec, from, to) {
    const out = [];
    for (let d = upcoming(rec, from), i = 0; d <= to && i < 60; d = nextDate(rec.frequency, d), i++) out.push(d);
    return out;
  }
  const monthlyEquivalent = (rec) => U.round2(rec.amount * (FREQUENCIES[rec.frequency] || FREQUENCIES.monthly).perMonth);

  const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  // txs: alle transaktioner. known: eksisterende RecurringPayment-poster (bekræftede og afviste).
  function detect(txs, known, calc, dataEnd) {
    const knownKeys = new Set((known || []).map((r) => r.matchKey));
    const groups = new Map();
    for (const t of txs) {
      if (t.amount >= 0 || t.isInternalTransfer) continue;
      if (calc && calc.classify(t).type === 'transfer') continue;
      const key = C.merchantKey(t.description);
      if (!key || key.length < 3) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    const out = [];
    for (const [key, list] of groups) {
      if (knownKeys.has(key) || list.length < 2) continue;
      const byDay = new Map();
      for (const t of list) if (!byDay.has(t.date)) byDay.set(t.date, t);
      const items = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
      if (items.length < 2) continue;
      const gaps = [];
      for (let i = 1; i < items.length; i++) gaps.push(U.daysBetween(items[i - 1].date, items[i].date));
      const med = median(gaps);
      const freq = Object.keys(FREQUENCIES).find((f) => med >= FREQUENCIES[f].min && med <= FREQUENCIES[f].max);
      if (!freq) continue;
      const F = FREQUENCIES[freq];
      if (items.length < F.minCount) continue;
      const fit = gaps.filter((g) => g >= F.min - 3 && g <= F.max + 3).length / gaps.length;
      if (fit < 0.7) continue;
      const amounts = items.map((t) => -t.amount);
      const amt = median(amounts);
      const lo = Math.min(...amounts), hi = Math.max(...amounts);
      if (hi > amt * 3 || lo < amt / 3) continue;
      const last = items[items.length - 1];
      const stale = dataEnd && U.daysBetween(last.date, dataEnd) > F.max * 2;
      const catCount = new Map();
      for (const t of items) catCount.set(t.categoryId, (catCount.get(t.categoryId) || 0) + 1);
      out.push({
        matchKey: key, name: U.capitalize(key.toLowerCase()), frequency: freq,
        amount: U.round2(amt), amountMin: lo, amountMax: hi, variable: (hi - lo) / amt > 0.1,
        lastDate: last.date, nextDate: nextDate(freq, last.date), count: items.length, stale: !!stale,
        txIds: list.map((t) => t.id), accountId: last.accountId,
        categoryId: [...catCount].sort((a, b) => b[1] - a[1])[0][0],
      });
    }
    return out.sort((a, b) => b.amount * FREQUENCIES[b.frequency].perMonth - a.amount * FREQUENCIES[a.frequency].perMonth);
  }

  // Fundne betalinger matcher på præcis samme modtagernøgle; manuelt oprettede på, at teksten indeholder nøglen.
  function matches(rec, t) {
    if (t.amount >= 0 || !rec.matchKey || (rec.accountId && rec.accountId !== t.accountId)) return false;
    return C.merchantKey(t.description) === rec.matchKey || (!!rec.manual && C.normalizeDescription(t.description).includes(rec.matchKey));
  }

  GB.recurring = { FREQUENCIES, nextDate, upcoming, occurrencesBetween, monthlyEquivalent, detect, matches };
})();
