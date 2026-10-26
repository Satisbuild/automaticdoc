// Fælles hjælpefunktioner: beløb, datoer, tekst og id'er.
//
// Beløbsmodel (gælder hele appen):
//   amount er et tal i kroner med fortegn – positivt = penge ind, negativt = penge ud.
//   Summer regnes altid i øre (heltal) via sumAmounts(), så afrundingsfejl ikke hober sig op.
//   Der afrundes først, når beløbet vises.
//
// Datoer gemmes som tekst "ÅÅÅÅ-MM-DD" (bankens bogføringsdato) og regnes uden tidszoner,
// så en transaktion aldrig flytter sig en dag pga. UTC-omregning.
//
// Filen virker både i browseren og i Node (tests): alt hænges på globalThis.GB.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});

  // --- Tekst -------------------------------------------------------------------

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  // Al tekst fra banker, filer og brugeren skal igennem esc(), før den sættes ind i HTML.
  function esc(v) {
    return v == null ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]);
  }

  let counter = 0;
  function uid(prefix) {
    counter = (counter + 1) % 1e6;
    const rnd = (globalThis.crypto && crypto.getRandomValues)
      ? Array.from(crypto.getRandomValues(new Uint32Array(2)), (n) => n.toString(36)).join('')
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return (prefix ? prefix + '_' : '') + Date.now().toString(36) + counter.toString(36) + rnd.slice(0, 10);
  }

  // Til søgning: små bogstaver, ens mellemrum. Æ/Ø/Å bevares.
  function fold(s) {
    return String(s == null ? '' : s).toLocaleLowerCase('da-DK').replace(/\s+/g, ' ').trim();
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }

  // --- Beløb -------------------------------------------------------------------

  const toOre = (kr) => Math.round(Number(kr) * 100);
  const fromOre = (ore) => ore / 100;
  const round2 = (kr) => fromOre(toOre(kr));
  function sumAmounts(list, pick) {
    let ore = 0;
    for (const x of list) ore += toOre(pick ? pick(x) : x);
    return fromOre(ore);
  }

  // Visningsformat kan ændres i indstillinger (numberFormat).
  const FORMATS = {
    'da': { locale: 'da-DK', group: true, suffix: ' kr.' },
    'da-nogroup': { locale: 'da-DK', group: false, suffix: ' kr.' },
    'en': { locale: 'en-GB', group: true, suffix: ' DKK' },
  };
  const fmtCache = new Map();
  let numberFormat = 'da';
  function setNumberFormat(f) { if (FORMATS[f]) numberFormat = f; }
  function formatter(decimals) {
    const key = numberFormat + decimals;
    if (!fmtCache.has(key)) {
      const f = FORMATS[numberFormat];
      fmtCache.set(key, new Intl.NumberFormat(f.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: f.group }));
    }
    return fmtCache.get(key);
  }
  // fmtMoney(-125.5) -> "−125,50 kr."   opts.sign: vis også "+" for positive beløb
  function fmtMoney(kr, opts) {
    const o = opts || {};
    if (kr == null || !isFinite(kr)) return '–';
    const decimals = o.decimals != null ? o.decimals : 2;
    const v = round2(kr);
    const abs = formatter(decimals).format(Math.abs(v));
    const sign = v < 0 ? '−' : (o.sign && v > 0 ? '+' : '');
    return sign + abs + (o.noSuffix ? '' : FORMATS[numberFormat].suffix);
  }
  function fmtNumber(n, decimals) {
    return formatter(decimals || 0).format(n);
  }
  function fmtPct(p, decimals) {
    if (p == null || !isFinite(p)) return '–';
    return formatter(decimals == null ? 0 : decimals).format(p) + ' %';
  }

  // --- Datoer ------------------------------------------------------------------

  const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
  const MONTHS_SHORT = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];

  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  function iso(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
  function parts(s) { return { y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) }; }
  function isValidISO(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const { y, m, d } = parts(s);
    return y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
  }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  // Dagnummer siden 1970 – bruges kun til at regne afstande, aldrig til visning.
  function dayNum(s) { const p = parts(s); return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 864e5); }
  function fromDayNum(n) { const d = new Date(n * 864e5); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  function addDays(s, n) { return fromDayNum(dayNum(s) + n); }
  function daysBetween(a, b) { return dayNum(b) - dayNum(a); }
  function addMonths(s, n) {
    const p = parts(s);
    let m = p.m - 1 + n;
    const y = p.y + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12 + 1;
    return iso(y, m, Math.min(p.d, daysInMonth(y, m)));
  }
  function todayISO() { const d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  const monthKey = (s) => s.slice(0, 7);
  const monthStart = (mk) => mk + '-01';
  function monthEnd(mk) { const y = +mk.slice(0, 4), m = +mk.slice(5, 7); return iso(y, m, daysInMonth(y, m)); }
  function addMonthKey(mk, n) { return monthKey(addMonths(mk + '-01', n)); }
  // Alle måneder fra a til b (begge inkl.), fx ["2026-01","2026-02"].
  function monthRange(a, b) {
    const out = [];
    for (let mk = a; mk <= b && out.length < 600; mk = addMonthKey(mk, 1)) out.push(mk);
    return out;
  }
  function fmtDate(s, opts) {
    if (!isValidISO(s)) return s || '–';
    const p = parts(s);
    if (opts && opts.short) return p.d + '. ' + MONTHS_SHORT[p.m - 1] + (opts.noYear ? '' : ' ' + p.y);
    return p.d + '. ' + MONTHS[p.m - 1] + ' ' + p.y;
  }
  function fmtMonth(mk, short) {
    const y = mk.slice(0, 4), m = +mk.slice(5, 7);
    return short ? MONTHS_SHORT[m - 1] + ' ' + y.slice(2) : MONTHS[m - 1] + ' ' + y;
  }
  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  GB.util = {
    esc, uid, fold, debounce,
    toOre, fromOre, round2, sumAmounts, fmtMoney, fmtNumber, fmtPct, setNumberFormat,
    iso, parts, isValidISO, daysInMonth, dayNum, fromDayNum, addDays, daysBetween, addMonths, todayISO,
    monthKey, monthStart, monthEnd, addMonthKey, monthRange, fmtDate, fmtMonth, capitalize,
    MONTHS, MONTHS_SHORT,
  };
})();
