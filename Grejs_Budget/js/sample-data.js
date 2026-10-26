// Eksempeldata – helt opdigtede transaktioner til at prøve appen.
// Ingen rigtige personer, kontonumre eller bankdata. Samme startværdi giver altid samme data.
// Bruges både af knappen "Prøv med eksempeldata" og af scripts/make-sample-data.js,
// som laver eksempelfilerne i mappen eksempeldata/.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Returnerer { checking: [...], card: [...], savings: [...] } med rækker { date, description, amount }
  // for måneder fra (slutmåned − months + 1) til slutmåned, til og med "until".
  function generate(until, months, seed) {
    const r = rng(seed || 20260101);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const amt = (lo, hi) => U.round2(lo + r() * (hi - lo));
    const day = (mk, d) => U.iso(+mk.slice(0, 4), +mk.slice(5, 7), Math.min(d, U.daysInMonth(+mk.slice(0, 4), +mk.slice(5, 7))));
    const endMk = U.monthKey(until);
    const list = U.monthRange(U.addMonthKey(endMk, -(months - 1)), endMk);
    const checking = [], card = [], savings = [];
    const add = (arr, date, description, amount) => { if (date <= until) arr.push({ date, description, amount: U.round2(amount) }); };
    let cardLast = 0;

    list.forEach((mk, i) => {
      const late = i >= list.length - 2;
      add(checking, day(mk, 1), 'BS Betaling Husleje Boligforeningen Eksempel', -7950);
      add(checking, day(mk, 1), 'PUREGYM Medlemskab', -249);
      add(checking, day(mk, 2), 'Overførsel til opsparing', -2000);
      add(savings, day(mk, 2), 'Overførsel fra lønkonto', 2000);
      add(checking, day(mk, 3), 'TELMORE Abonnement', -149);
      add(checking, day(mk, 5), 'BS Betaling ANDEL ENERGI', -amt(520, 780));
      add(checking, day(mk, 10), 'BS Betaling STOFA Internet', -299);
      if ((i % 3) === 0) add(checking, day(mk, 12), 'BS Betaling TRYG Forsikring', -1845);
      if (cardLast) add(checking, day(mk, 8), 'Betaling kreditkort', -cardLast);
      add(checking, day(mk, 28), 'Lønoverførsel Eksempel ApS', 24850 + (i === list.length - 3 ? 3500 : 0));

      const groceries = ['Dankort-køb NETTO 4512 EKSEMPELBY', 'Dankort-køb REMA 1000 EKSEMPELBY', 'Dankort-køb FØTEX EKSEMPELBY', 'Dankort-køb LIDL EKSEMPELBY', 'Dankort-køb SUPERBRUGSEN EKSEMPELBY', 'Visa/Dankort MENY EKSEMPELBY'];
      const n = 9 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) add(checking, day(mk, 1 + Math.floor(r() * 27)), pick(groceries), -amt(65, 620));
      const take = late ? 4 : 2;
      for (let k = 0; k < take; k++) add(checking, day(mk, 2 + Math.floor(r() * 26)), pick(['WOLT Eksempelby', 'JUST EAT Pizza Eksempel']), -amt(170, 340));
      for (let k = 0; k < 2; k++) add(checking, day(mk, 4 + Math.floor(r() * 22)), 'Dankort-køb CIRCLE K EKSEMPELBY', -amt(420, 680));
      if (r() < 0.7) add(checking, day(mk, 6 + Math.floor(r() * 20)), 'Rejsekort Optankning', -200);
      if (r() < 0.6) add(checking, day(mk, 6 + Math.floor(r() * 20)), 'Dankort-køb MATAS EKSEMPELBY', -amt(60, 260));
      if (r() < 0.5) add(checking, day(mk, 9 + Math.floor(r() * 18)), 'Café Hjørnet Eksempelby', -amt(45, 160));
      if (r() < 0.4) add(checking, day(mk, 9 + Math.floor(r() * 18)), 'Hævning pengeautomat', -500);
      if (r() < 0.5) add(checking, day(mk, 9 + Math.floor(r() * 18)), 'MobilePay Overførsel', -amt(50, 300));
      if (i === 1) add(checking, day(mk, 14), 'Tandlæge Eksempel', -1150);
      if (i === 2) add(checking, day(mk, 20), 'Overskydende skat Skattestyrelsen', 2318);

      let cardSum = 0;
      const c = (d, desc, a) => { add(card, day(mk, d), desc, a); if (day(mk, d) <= until) cardSum += a; };
      c(2, 'SPOTIFY P2D3E4F5', -119);
      c(15, 'NETFLIX.COM', -129);
      c(18, 'Disney Plus', -89);
      if (r() < 0.6) c(5 + Math.floor(r() * 20), 'ZALANDO SE', -amt(250, 900));
      if (r() < 0.4) c(5 + Math.floor(r() * 20), 'H&M Eksempelby', -amt(150, 500));
      if (r() < 0.3) c(5 + Math.floor(r() * 20), 'IKEA Eksempelby', -amt(200, 1400));
      if (r() < 0.6) c(5 + Math.floor(r() * 20), 'Restaurant Eksempel', -amt(320, 780));
      if (i === 3) c(11, 'ELGIGANTEN Online', -2499);
      if (i === 4) { c(7, 'BOOKING.COM Hotel', -3150); c(9, 'SAS Flybillet', -2280); }
      if (i === 4) c(24, 'H&M Retur Eksempelby', 299);
      cardLast = -U.round2(cardSum);
    });
    const sort = (a) => a.sort((x, y) => x.date.localeCompare(y.date));
    return { checking: sort(checking), card: sort(card), savings: sort(savings) };
  }

  // Løbende saldo for en konto (kun til eksempelfilerne).
  function withBalance(rows, start) {
    let ore = U.toOre(start);
    return rows.map((x) => { ore += U.toOre(x.amount); return Object.assign({}, x, { balance: U.fromOre(ore) }); });
  }

  GB.sample = { generate, withBalance, rng };
})();
