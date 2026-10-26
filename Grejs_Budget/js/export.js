// Eksport (CSV), fuld sikkerhedskopi (JSON) og kontrol af en sikkerhedskopi før gendannelse.
// Filer laves i browseren og hentes direkte – intet sendes til en server.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;

  const BACKUP_FORMAT = 'grejs-budget-backup';

  // CSV i dansk format: semikolon, decimalkomma, UTF-8 med BOM (så Excel viser æ, ø og å).
  // Tekst, der starter med = + - @, får en apostrof foran, så regneark ikke tolker den som formel.
  function csvCell(v, numeric) {
    if (v == null) return '';
    let s = numeric && typeof v === 'number' ? String(U.round2(v)).replace('.', ',') : String(v);
    if (!numeric && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  // columns: [{ label, get(row), numeric }]
  function toCSV(rows, columns) {
    const lines = [columns.map((c) => csvCell(c.label)).join(';')];
    for (const r of rows) lines.push(columns.map((c) => csvCell(c.get(r), c.numeric)).join(';'));
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  function download(content, filename, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function stamp() { const d = new Date(); return U.todayISO() + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); }

  function makeBackup(store) {
    const d = {};
    for (const s of store.STORES) d[s] = store.data[s];
    const counts = {};
    for (const s of store.STORES) counts[s] = d[s].length;
    return {
      format: BACKUP_FORMAT, app: 'Grejs Budget', schema: store.SCHEMA, exportedAt: new Date().toISOString(),
      counts, settings: store.settings, data: d,
    };
  }

  // Kontrollerer en sikkerhedskopi grundigt, før den må erstatte noget.
  function validateBackup(obj, store) {
    const errors = [], warnings = [];
    if (!obj || typeof obj !== 'object') return { ok: false, errors: ['Filen er ikke en gyldig JSON-sikkerhedskopi.'], warnings };
    if (obj.format !== BACKUP_FORMAT) return { ok: false, errors: ['Filen er ikke en sikkerhedskopi fra Grejs Budget.'], warnings };
    if (typeof obj.schema !== 'number') errors.push('Sikkerhedskopien mangler versionsnummer.');
    else if (obj.schema > store.SCHEMA) errors.push('Sikkerhedskopien er lavet med en nyere version af Grejs Budget (version ' + obj.schema + '). Opdatér appen først.');
    else if (obj.schema < store.SCHEMA) warnings.push('Sikkerhedskopien er fra en ældre version og bliver opgraderet automatisk.');
    const d = obj.data || {};
    const counts = {};
    for (const s of store.STORES) {
      if (d[s] == null) { d[s] = []; if (s !== 'periodBudgets') warnings.push('Ingen ' + s + ' i filen.'); }
      if (!Array.isArray(d[s])) { errors.push('Delen "' + s + '" er ødelagt.'); continue; }
      const bad = d[s].filter((r) => !r || typeof r !== 'object' || typeof r.id !== 'string');
      if (bad.length) errors.push(bad.length + ' poster i "' + s + '" mangler id.');
      counts[s] = d[s].length;
    }
    if (Array.isArray(d.transactions)) {
      const badTx = d.transactions.filter((t) => t && (!U.isValidISO(t.date) || typeof t.amount !== 'number' || !isFinite(t.amount)));
      if (badTx.length) errors.push(badTx.length + ' transaktioner har ugyldig dato eller beløb.');
      const ids = new Set(d.transactions.map((t) => t && t.id));
      if (ids.size !== d.transactions.length) errors.push('Sikkerhedskopien indeholder transaktioner med samme id.');
    }
    return { ok: !errors.length, errors, warnings, counts, exportedAt: obj.exportedAt, schema: obj.schema };
  }

  GB.exporter = { BACKUP_FORMAT, toCSV, csvCell, download, stamp, makeBackup, validateBackup };
})();
