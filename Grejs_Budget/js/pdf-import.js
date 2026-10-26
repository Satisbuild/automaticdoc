// Læser kontoudtog i PDF (fx fra netbanken eller "Gem som PDF" i Chrome) lokalt i browseren.
//
// 1. pdf.js (assets/libraries/pdfjs-*) henter teksten og dens placering på hver side.
//    Biblioteket indlæses først, når der vælges en PDF, og sender intet ud af enheden.
// 2. itemsToTable() samler teksten til linjer og celler og laver en tabel:
//    - Findes en overskriftsrække (Dato / Tekst / Beløb …), placeres cellerne under de
//      kolonner, de står under – også når overskriften gentages på hver side.
//    - Ellers læses hver linje som "dato … tekst … beløb [saldo]".
//    - Datoer uden årstal (fx "05.01") får årstallet fra resten af udtoget.
// Tabellen går derefter gennem den almindelige importguide (kolonner, kontrol, dubletter).
// Scannede PDF'er (billeder uden tekst) kan ikke læses – det fortælles tydeligt.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;

  const LIB = 'assets/libraries/pdfjs-6.4.299/';
  let libPromise = null;

  // pdf.js kræver Promise.withResolvers, som ældre browsere (fx Safari før 17.4) mangler.
  // Workeren får samme tilføjelse via assets/libraries/pdfjs-worker-loader.js.
  function polyfill() {
    if (typeof Promise.withResolvers !== 'function') {
      Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new this((a, b) => { resolve = a; reject = b; });
        return { promise, resolve, reject };
      };
    }
  }

  function loadLib() {
    if (!libPromise) {
      polyfill();
      const base = new URL(LIB, document.baseURI).href;
      libPromise = import(base + 'pdf.min.js').then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = new URL('../pdfjs-worker-loader.js', base).href;
        return lib;
      }).catch((e) => {
        libPromise = null;
        throw new Error(location.protocol === 'file:'
          ? 'PDF-import kræver, at Grejs Budget åbnes via hjemmesiden eller "Start Grejs Budget.bat" – ikke direkte som fil.'
          : 'PDF-læseren kunne ikke indlæses (' + (e && e.message) + ').');
      });
    }
    return libPromise;
  }

  // --- Fra tekststykker til linjer og celler -----------------------------------

  // items: [{ str, x, y, w, h }] med y målt oppefra.
  function toLines(items) {
    const list = items.filter((i) => i.str && i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
    const lines = [];
    for (const it of list) {
      const tol = Math.max(2, it.h * 0.45);
      let line = null;
      for (let k = lines.length - 1; k >= 0 && k >= lines.length - 3; k--) if (Math.abs(lines[k].y - it.y) <= tol) { line = lines[k]; break; }
      if (!line) { line = { y: it.y, items: [] }; lines.push(line); }
      line.items.push(it);
    }
    for (const l of lines) {
      l.items.sort((a, b) => a.x - b.x);
      const cells = [];
      for (const it of l.items) {
        const prev = cells[cells.length - 1];
        const gap = prev ? it.x - prev.x1 : Infinity;
        const h = it.h || 8;
        if (prev && gap < Math.max(3.5, h * 0.75)) {
          prev.text += (gap > h * 0.12 && !/\s$/.test(prev.text) && !/^\s/.test(it.str) ? ' ' : '') + it.str;
          prev.x1 = Math.max(prev.x1, it.x + it.w);
        } else cells.push({ text: it.str, x0: it.x, x1: it.x + it.w });
      }
      l.cells = cells.map((c) => Object.assign(c, { text: c.text.replace(/\s+/g, ' ').trim() })).filter((c) => c.text);
    }
    return lines.filter((l) => l.cells.length);
  }

  // --- Datoer og beløb ---------------------------------------------------------

  const FULL_DATE = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2}|\d{4})$|^(\d{4})-(\d{2})-(\d{2})$/;
  const SHORT_DATE = /^(\d{1,2})[.\-/](\d{1,2})\.?$/;
  const DATE_AT_START = /^(\d{1,2}[.\-/]\d{1,2}(?:[.\-/](?:\d{4}|\d{2}))?|\d{4}-\d{2}-\d{2})(?:\s+|$)/;
  const AMOUNT = /^[-+−]?\s?\(?(?:\d{1,3}(?:[.\s ]\d{3})+|\d+)(?:[.,]\d{1,2})?\)?\s?-?(?:\s?(?:kr\.?|dkk))?$/i;
  // Beløb skal have to decimaler, så fx kortnumre og postnumre ikke forveksles med beløb.
  const isAmount = (s) => AMOUNT.test(s.trim()) && /\d[.,]\d{2}(?!\d)/.test(s);
  const isDate = (s) => FULL_DATE.test(s.trim()) || SHORT_DATE.test(s.trim());

  // Finder hvilke år udtoget dækker (ud fra fulde datoer i hele teksten).
  function yearRange(allText) {
    const ds = [];
    for (const m of allText.matchAll(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})\b/g)) {
      const iso = U.iso(+m[3], +m[2], +m[1]);
      if (U.isValidISO(iso)) ds.push(iso);
    }
    for (const m of allText.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) if (U.isValidISO(m[0])) ds.push(m[0]);
    if (ds.length) { ds.sort(); return { from: ds[0], to: ds[ds.length - 1] }; }
    const years = (allText.match(/\b20\d{2}\b/g) || []).map(Number);
    if (years.length) return { from: Math.min(...years) + '-01-01', to: Math.max(...years) + '-12-31' };
    return null;
  }

  // "05.01" -> "05-01-2026" ud fra udtogets periode. Fulde datoer gives videre uændret.
  function completeDate(s, range, today) {
    const t = s.trim();
    const m = t.match(SHORT_DATE);
    if (!m) return t;
    const d = +m[1], mo = +m[2];
    const candidates = [];
    const y0 = range ? +range.from.slice(0, 4) : +today.slice(0, 4);
    const y1 = range ? +range.to.slice(0, 4) : +today.slice(0, 4);
    for (let y = y0 - 1; y <= y1 + 1; y++) { const iso = U.iso(y, mo, d); if (U.isValidISO(iso)) candidates.push(iso); }
    if (!candidates.length) return t;
    // Foretræk en dato inden for udtogets periode, der ikke ligger i fremtiden; dernæst lidt uden for perioden.
    const tiers = [
      (c) => range && c >= range.from && c <= range.to && c <= today,
      (c) => range && c >= range.from && c <= range.to,
      (c) => range && c >= U.addDays(range.from, -31) && c <= U.addDays(range.to, 31) && c <= today,
      (c) => c <= today,
      () => true,
    ];
    let pick = null;
    for (const ok of tiers) { const hit = candidates.filter(ok); if (hit.length) { pick = hit.sort().pop(); break; } }
    return pick.slice(8, 10) + '-' + pick.slice(5, 7) + '-' + pick.slice(0, 4);
  }

  const NOISE = /^(side|page)\s*\d|^(ultimo|primo|ny saldo|saldo (pr|til|fra|overført)|transport|overført fra|i alt|total|sum)\b/i;

  // --- Tabel -------------------------------------------------------------------

  function overlap(a0, a1, b0, b1) { return Math.min(a1, b1) - Math.max(a0, b0); }

  function itemsToTable(pages, opts) {
    const today = (opts && opts.today) || U.todayISO();
    const pageLines = pages.map((p) => toLines(p.items));
    const allLines = pageLines.flat();
    const allText = allLines.map((l) => l.cells.map((c) => c.text).join(' ')).join('\n');
    const range = yearRange(allText);

    // Overskriftsrække: første linje med dato, tekst og beløb/debet/kredit.
    let header = null;
    for (const l of allLines) {
      const map = GB.importer.guessMapping(l.cells.map((c) => c.text));
      if (GB.importer.mappingComplete(map) && l.cells.length >= 3 && l.cells.length <= 12) { header = l; break; }
    }

    if (header) {
      const hText = header.cells.map((c) => c.text);
      const hKey = hText.join('|').toLowerCase();
      const hMap = GB.importer.guessMapping(hText);
      const cols = header.cells.map((c, i) => {
        // Kolonnens område går til næste overskrift (venstrestillet) – beløb står ofte højrestillet.
        const next = header.cells[i + 1];
        return { x0: c.x0, x1: c.x1, right: next ? next.x0 : Infinity, left: i ? header.cells[i - 1].x1 : -Infinity };
      });
      const numericCols = new Set([hMap.amount, hMap.debit, hMap.credit, hMap.balance].filter((x) => x >= 0));
      const rows = [hText];
      let started = false, last = null;
      for (const pl of pageLines) {
        for (const l of pl) {
          if (l === header) { started = true; continue; }
          if (!started) continue;
          if (l.cells.map((c) => c.text).join('|').toLowerCase() === hKey) continue;
          const row = new Array(cols.length).fill('');
          for (const c of l.cells) {
            let best = -1, bestScore = -Infinity;
            cols.forEach((col, i) => {
              let score = overlap(c.x0, c.x1, col.x0, col.x1);
              if (score <= 0) {
                const inZone = c.x0 >= col.x0 - 2 && c.x0 < col.right - 2;
                score = inZone ? 0 : -Math.min(Math.abs(c.x0 - col.x0), Math.abs(c.x1 - col.x1));
                if (numericCols.has(i) && isAmount(c.text)) score += overlap(c.x0, c.x1, col.left, col.x1) > 0 ? 1 : 0;
              }
              if (score > bestScore) { bestScore = score; best = i; }
            });
            row[best] = row[best] ? row[best] + ' ' + c.text : c.text;
          }
          const dateCell = (row[hMap.date] || '').trim();
          const firstDate = dateCell.split(' ')[0];
          if (isDate(firstDate)) {
            row[hMap.date] = completeDate(firstDate, range, today);
            rows.push(row);
            last = row;
          } else if (last && hMap.description >= 0 && row[hMap.description] && !NOISE.test(row[hMap.description]) &&
            row.every((v, i) => i === hMap.description || !v || (hMap.extra || []).includes(i))) {
            // Fortsættelseslinje (tekst over flere linjer)
            last[hMap.description] += ' ' + row[hMap.description];
          } else last = null;
        }
      }
      return { rows, mode: 'header', textFound: allText.trim().length > 0 };
    }

    // Uden overskrift: dato først, beløb sidst.
    const rows = [['Dato', 'Tekst', 'Beløb', 'Saldo']];
    let last = null;
    for (const l of allLines) {
      let cells = l.cells.map((c) => c.text);
      const m = cells[0].match(DATE_AT_START);
      if (m) {
        const rest = cells[0].slice(m[0].length).trim();
        cells = [m[1]].concat(rest ? [rest] : [], cells.slice(1));
        // Ekstra dato (fx rentedato) lige efter den første springes over.
        while (cells.length > 2 && isDate(cells[1])) cells.splice(1, 1);
        const amounts = [];
        while (cells.length > 1 && isAmount(cells[cells.length - 1]) && amounts.length < 2) amounts.unshift(cells.pop());
        // Beløb kan også stå i slutningen af tekstcellen.
        if (!amounts.length && cells.length > 1) {
          const t = cells[cells.length - 1].match(/^(.*?)\s+([-+−]?(?:\d{1,3}(?:[.\s]\d{3})+|\d+)[.,]\d{2}-?)(?:\s+([-+−]?(?:\d{1,3}(?:[.\s]\d{3})+|\d+)[.,]\d{2}-?))?$/);
          if (t) { cells[cells.length - 1] = t[1]; amounts.push(t[2]); if (t[3]) amounts.push(t[3]); }
        }
        if (amounts.length && cells.length >= 2) {
          last = [completeDate(cells[0], range, today), cells.slice(1).join(' '), amounts[0], amounts[1] || ''];
          rows.push(last);
          continue;
        }
      } else if (last && cells.length === 1 && !isAmount(cells[0]) && !NOISE.test(cells[0]) && cells[0].length < 80) {
        last[1] += ' ' + cells[0];
        continue;
      }
      last = null;
    }
    return { rows, mode: 'lines', textFound: allText.trim().length > 0 };
  }

  // --- Læs en PDF-fil ----------------------------------------------------------

  async function read(buf, password) {
    const lib = await loadLib();
    let doc;
    const task = lib.getDocument({ data: new Uint8Array(buf.slice(0)), password: password || undefined, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false });
    try {
      doc = await task.promise;
    } catch (e) {
      task.destroy();
      if (e && e.name === 'PasswordException') {
        const err = new Error(password ? 'Adgangskoden passer ikke.' : 'PDF\'en er beskyttet med en adgangskode.');
        err.needsPassword = true;
        throw err;
      }
      throw new Error('PDF-filen kunne ikke åbnes – den er måske beskadiget eller ikke en rigtig PDF (' + ((e && e.message) || 'ukendt fejl') + ').');
    }
    const pages = [];
    try {
      for (let p = 1; p <= Math.min(doc.numPages, 300); p++) {
        const page = await doc.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        pages.push({
          items: tc.items.filter((i) => typeof i.str === 'string').map((i) => {
            const tr = i.transform;
            const h = Math.hypot(tr[2], tr[3]) || i.height || 8;
            return { str: i.str, x: tr[4], y: vp.height - tr[5], w: i.width, h };
          }),
        });
      }
    } finally {
      await task.destroy();
    }
    const res = itemsToTable(pages);
    if (!res.textFound) throw new Error('PDF\'en indeholder ingen tekst – den er sandsynligvis scannet som billede. Hent i stedet udtoget som CSV eller Excel i netbanken.');
    if (res.rows.length < 2) throw new Error('Der blev ikke fundet nogen transaktioner i PDF\'en. Grejs Budget leder efter linjer med en dato og et beløb. Hent evt. udtoget som CSV i stedet.');
    return Object.assign(res, { pages: pages.length });
  }

  GB.pdf = { read, itemsToTable, toLines, completeDate, yearRange, LIB };
})();
