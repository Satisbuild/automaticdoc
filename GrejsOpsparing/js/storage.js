// LocalStorage, backupfiler (JSON) og CSV-eksport for GrejsOpsparing.
// Alle data bliver i browseren – der er ingen server.

(function (global) {
  'use strict';

  const STORAGE_KEY = 'grejsOpsparing';
  // Hvis gemte data er beskadigede, flyttes de hertil i stedet for at blive overskrevet.
  const DAMAGED_KEY = 'grejsOpsparing_beskadiget';
  const APP_ID = 'GrejsOpsparing';
  const FORMAT_VERSION = 1;
  const CURRENCIES = ['DKK', 'EUR', 'SEK', 'NOK', 'USD', 'GBP'];
  const THEMES = ['system', 'light', 'dark'];
  const MAX_DESCRIPTION = 120;
  const MAX_TRANSACTIONS = 50000;

  const C = global.GOCalc;

  function createDefaultData() {
    return {
      version: FORMAT_VERSION,
      settings: { currency: 'DKK', theme: 'system', lastExport: null },
      interest: { rates: [{ from: null, rate: 0 }], compounding: 'monthly', startDate: null },
      goal: { name: '', amount: 0, targetDate: null },
      plan: { monthlyAmount: 0, dayOfMonth: 1 },
      transactions: [],
    };
  }

  function newId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function isObj(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  function isAmount(v) {
    return Number.isSafeInteger(v) && v > 0 && v <= C.MAX_AMOUNT;
  }

  // Kontrollerer og renser data. Returnerer { ok, data } eller { ok: false, error }.
  // Bruges både når appen starter og når en backupfil importeres.
  function normalizeData(raw) {
    const fail = (error) => ({ ok: false, error });
    if (!isObj(raw)) return fail('Filen indeholder ikke en opsparing.');
    if (typeof raw.version !== 'number' || raw.version > FORMAT_VERSION) {
      return fail('Filen er lavet med en nyere eller ukendt version af GrejsOpsparing.');
    }
    const out = createDefaultData();

    const s = isObj(raw.settings) ? raw.settings : {};
    if (CURRENCIES.includes(s.currency)) out.settings.currency = s.currency;
    if (THEMES.includes(s.theme)) out.settings.theme = s.theme;
    if (typeof s.lastExport === 'string') out.settings.lastExport = s.lastExport;

    const i = raw.interest;
    if (!isObj(i)) return fail('Renteindstillingerne mangler i filen.');
    if (i.compounding !== 'monthly' && i.compounding !== 'yearly') return fail('Ukendt rentetilskrivning i filen.');
    out.interest.compounding = i.compounding;
    if (i.startDate !== null && i.startDate !== undefined) {
      if (C.parseDateKey(i.startDate) === null) return fail('Rentens startdato i filen er ugyldig.');
      out.interest.startDate = i.startDate;
    }
    if (!Array.isArray(i.rates) || !i.rates.length) return fail('Renten mangler i filen.');
    const rates = [];
    const seen = new Set();
    for (const r of i.rates) {
      if (!isObj(r) || typeof r.rate !== 'number' || !(r.rate >= 0 && r.rate <= 100)) return fail('En rente i filen er ugyldig.');
      if (r.from !== null && C.parseDateKey(r.from) === null) return fail('En renteændring i filen har en ugyldig dato.');
      const key = r.from || '';
      if (seen.has(key)) return fail('Filen har to renter, der gælder fra samme dato.');
      seen.add(key);
      rates.push({ from: r.from, rate: r.rate });
    }
    if (!rates.some((r) => r.from === null)) return fail('Filen mangler den grundlæggende rente.');
    rates.sort((a, b) => (a.from === null ? -1 : b.from === null ? 1 : a.from < b.from ? -1 : 1));
    out.interest.rates = rates;

    const g = isObj(raw.goal) ? raw.goal : {};
    if (g.amount !== 0 && g.amount !== undefined && !isAmount(g.amount)) return fail('Opsparingsmålet i filen er ugyldigt.');
    out.goal.amount = g.amount || 0;
    out.goal.name = typeof g.name === 'string' ? g.name.slice(0, 60) : '';
    if (g.targetDate) {
      if (C.parseDateKey(g.targetDate) === null) return fail('Målets slutdato i filen er ugyldig.');
      out.goal.targetDate = g.targetDate;
    }

    const p = isObj(raw.plan) ? raw.plan : {};
    if (p.monthlyAmount !== 0 && p.monthlyAmount !== undefined && !isAmount(p.monthlyAmount)) return fail('Den månedlige opsparing i filen er ugyldig.');
    out.plan.monthlyAmount = p.monthlyAmount || 0;
    if (p.dayOfMonth !== undefined) {
      if (!Number.isInteger(p.dayOfMonth) || p.dayOfMonth < 1 || p.dayOfMonth > 31) return fail('Indbetalingsdagen i filen er ugyldig.');
      out.plan.dayOfMonth = p.dayOfMonth;
    }

    if (!Array.isArray(raw.transactions)) return fail('Transaktionerne mangler i filen.');
    if (raw.transactions.length > MAX_TRANSACTIONS) return fail('Filen har for mange transaktioner.');
    const ids = new Set();
    for (const [n, t] of raw.transactions.entries()) {
      const where = 'Transaktion nr. ' + (n + 1);
      if (!isObj(t)) return fail(where + ' er ugyldig.');
      if (t.type !== 'deposit' && t.type !== 'withdrawal') return fail(where + ' har en ukendt type.');
      if (!isAmount(t.amount)) return fail(where + ' har et ugyldigt beløb.');
      if (C.parseDateKey(t.date) === null) return fail(where + ' har en ugyldig dato.');
      if (typeof t.id !== 'string' || !t.id || ids.has(t.id)) return fail(where + ' mangler et entydigt id.');
      ids.add(t.id);
      out.transactions.push({
        id: t.id,
        type: t.type,
        amount: t.amount,
        date: t.date,
        description: typeof t.description === 'string' ? t.description.slice(0, MAX_DESCRIPTION) : '',
        createdAt: typeof t.createdAt === 'string' ? t.createdAt : t.date + 'T12:00:00.000Z',
      });
    }
    return { ok: true, data: out };
  }

  function readRaw(key) {
    try {
      return global.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  // Indlæser data. Returnerer { data, warning }.
  function loadData() {
    const text = readRaw(STORAGE_KEY);
    if (text === null) return { data: createDefaultData(), warning: storageAvailable() ? null : 'unavailable' };
    try {
      const res = normalizeData(JSON.parse(text));
      if (res.ok) return { data: res.data, warning: null };
    } catch (e) { /* falder igennem til beskadiget */ }
    try {
      global.localStorage.setItem(DAMAGED_KEY, text);
    } catch (e) { /* ignoreres */ }
    return { data: createDefaultData(), warning: 'damaged' };
  }

  function saveData(data) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return { ok: true };
    } catch (e) {
      const full = e && (e.name === 'QuotaExceededError' || e.code === 22);
      return {
        ok: false,
        error: full
          ? 'Browserens lager er fyldt op, så ændringen kunne ikke gemmes.'
          : 'Ændringen kunne ikke gemmes i browseren (LocalStorage er slået fra eller blokeret).',
      };
    }
  }

  function clearData() {
    try {
      global.localStorage.removeItem(STORAGE_KEY);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Data kunne ikke slettes fra browseren.' };
    }
  }

  function storageAvailable() {
    try {
      const k = '__grejsOpsparing_test__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function storageSize() {
    const text = readRaw(STORAGE_KEY);
    return text ? text.length * 2 : 0; // UTF-16
  }

  // ---------- Backupfil ----------

  function exportJSON(data, now) {
    return JSON.stringify({
      app: APP_ID,
      format: FORMAT_VERSION,
      exportedAt: (now || new Date()).toISOString(),
      data,
    }, null, 2);
  }

  // Læser en backupfil. Returnerer { ok, data, exportedAt } eller { ok: false, error }.
  function parseBackup(text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'Filen er ikke en gyldig JSON-fil.' };
    }
    if (!isObj(raw) || raw.app !== APP_ID) {
      return { ok: false, error: 'Filen er ikke en backup fra GrejsOpsparing.' };
    }
    if (raw.format !== FORMAT_VERSION) {
      return { ok: false, error: 'Backupfilen har et format, som denne version ikke kender.' };
    }
    const res = normalizeData(raw.data);
    if (!res.ok) return res;
    return { ok: true, data: res.data, exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null };
  }

  // ---------- CSV ----------

  const TYPE_LABELS = { deposit: 'Indbetaling', withdrawal: 'Hævning', interest: 'Rente' };

  function csvCell(value) {
    const s = String(value);
    let safe = s;
    // Undgå at Excel tolker en beskrivelse som en formel.
    if (/^[=+\-@\t\r]/.test(safe)) safe = "'" + safe;
    return /[";\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  }

  function oreToCsv(ore) {
    const neg = ore < 0;
    const abs = Math.abs(Math.round(ore));
    return (neg ? '-' : '') + Math.floor(abs / 100) + ',' + String(abs % 100).padStart(2, '0');
  }

  // Semikolon og komma som decimaltegn, så dansk Excel åbner filen korrekt.
  function rowsToCSV(rows, currency) {
    const lines = [['Dato', 'Type', 'Beskrivelse', 'Beløb (' + currency + ')', 'Saldo efter (' + currency + ')'].join(';')];
    for (const r of rows) {
      const signed = r.type === 'withdrawal' ? -r.amount : r.amount;
      lines.push([r.date, TYPE_LABELS[r.type], csvCell(r.description || ''), oreToCsv(signed), oreToCsv(r.balanceAfter)].join(';'));
    }
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  global.GOStorage = {
    STORAGE_KEY, APP_ID, FORMAT_VERSION, CURRENCIES, THEMES, MAX_DESCRIPTION, TYPE_LABELS,
    createDefaultData, newId, normalizeData, loadData, saveData, clearData, storageAvailable, storageSize,
    exportJSON, parseBackup, rowsToCSV,
  };
})(typeof window !== 'undefined' ? window : globalThis);
