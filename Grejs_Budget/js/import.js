// Læser bankfiler lokalt i browseren og gør dem til ens rækker (dato, tekst, beløb …).
// Intet sendes ud af enheden.
//
//   CSV/TXT – komma, semikolon eller tabulator; UTF-8 eller Windows-1252 (ældre danske bankfiler)
//   XLSX    – første ark læses med en lille indbygget læser (bruger browserens DecompressionStream)
//   OFX/QFX – <STMTTRN>-poster
//   QIF     – D/T/P/M-linjer
//   PDF     – tekst og placering læses med pdf.js og laves til en tabel (js/pdf-import.js)
// Gamle .xls-filer og scannede PDF'er uden tekst understøttes ikke – det fortælles tydeligt til brugeren.

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const U = GB.util;

  // --- Filtype og tegnsæt ------------------------------------------------------

  function detectFormat(name, bytes) {
    const ext = (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
    const head = bytes ? new TextDecoder('latin1').decode(bytes.slice(0, 600)) : '';
    if (head.startsWith('PK')) return ext === 'xlsx' || ext === 'xlsm' || !ext ? 'xlsx' : 'zip';
    if (head.startsWith('%PDF') || ext === 'pdf') return 'pdf';
    if (ext === 'xls' || head.startsWith('\xD0\xCF\x11\xE0')) return 'xls';
    if (ext === 'json' || /^\s*[{[]/.test(head)) return 'json';
    if (ext === 'ofx' || ext === 'qfx' || /<OFX>|OFXHEADER/i.test(head)) return 'ofx';
    if (ext === 'qif' || /^\s*!Type:/i.test(head)) return 'qif';
    return 'csv';
  }

  const FORMAT_LABEL = { csv: 'CSV', xlsx: 'Excel (XLSX)', ofx: 'OFX', qif: 'QIF', json: 'Sikkerhedskopi (JSON)', pdf: 'PDF', xls: 'Excel 97 (XLS)', zip: 'ZIP' };
  const UNSUPPORTED = {
    xls: 'Gamle Excel-filer (.xls) kan ikke læses. Åbn filen i Excel og gem den som .xlsx eller .csv.',
    zip: 'Filen ligner en ZIP-fil. Pak den ud og vælg bankfilen indeni.',
  };

  // Prøver UTF-8 først; giver det ugyldige tegn, er filen næsten altid Windows-1252 (ANSI).
  function decodeText(bytes, encoding) {
    let b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) { b = b.subarray(3); if (!encoding) encoding = 'utf-8'; }
    if (b[0] === 0xFF && b[1] === 0xFE) return { text: new TextDecoder('utf-16le').decode(b.subarray(2)), encoding: 'utf-16le' };
    if (encoding && encoding !== 'auto') return { text: new TextDecoder(encoding).decode(b), encoding };
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(b), encoding: 'utf-8' }; }
    catch (e) { return { text: new TextDecoder('windows-1252').decode(b), encoding: 'windows-1252' }; }
  }

  // --- CSV ---------------------------------------------------------------------

  // Vælger den separator, der giver flest og mest ensartede kolonner i de første linjer.
  function detectDelimiter(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
    let best = ';', bestScore = -1;
    for (const d of [';', ',', '\t', '|']) {
      const counts = lines.map((l) => countOutsideQuotes(l, d));
      const nonZero = counts.filter((c) => c > 0);
      if (!nonZero.length) continue;
      const freq = new Map();
      for (const c of nonZero) freq.set(c, (freq.get(c) || 0) + 1);
      const [mode, hits] = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      const score = hits * 10 + mode + (d === ';' ? 0.5 : 0);
      if (score > bestScore) { best = d; bestScore = score; }
    }
    return best;
  }
  function countOutsideQuotes(line, d) {
    let n = 0, q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (ch === d && !q) n++; }
    return n;
  }

  function parseCSV(text, delim) {
    const rows = [];
    let row = [], field = '', q = false, i = 0;
    const n = text.length;
    while (i < n) {
      const ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"' && field.trim() === '') { field = ''; q = true; i++; continue; }
      if (ch === delim) { row.push(field); field = ''; i++; continue; }
      if (ch === '\r' || ch === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
        if (ch === '\r' && text[i + 1] === '\n') i++;
        i++; continue;
      }
      field += ch; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
  }

  // --- Kolonner ----------------------------------------------------------------

  const norm = (s) => U.fold(s).replace(/[._:()\[\]"']/g, ' ').replace(/\s+/g, ' ').trim();
  // Rækkefølgen i hver liste er prioriteten: "Bogføringsdato" vælges før "Rentedato".
  const COLUMN_PATTERNS = {
    date: [/^bogf.*dato$|^bogført$|^bogføring$/, /^dato$|^date$/, /^transaktionsdato$|^transaction date$|^booking date$|^posting date$|^købsdato$/, /dato|date/],
    description: [/^tekst$|^text$|^beskrivelse$|^description$/, /^betalingstekst$|^posteringstekst$|^transaktionstekst$|^posteringsbeskrivelse$/, /^modtager$|^navn$|^payee$|^merchant$|^butik$/, /tekst|beskrivelse|description|details|memo|meddelelse/],
    amount: [/^beløb$|^belob$|^amount$/, /^beløb i dkk$|^beløb dkk$|^amount dkk$|^transaktionsbeløb$|^bogført beløb$/, /beløb|belob|amount/],
    debit: [/^debet$|^debit$|^udbetaling$|^hævet$|^ud$|^money out$|^paid out$|^withdrawal$/],
    credit: [/^kredit$|^credit$|^indbetaling$|^indsat$|^ind$|^money in$|^paid in$|^deposit$/],
    currency: [/^valuta$|^currency$|^møntsort$|^mønt$/],
    balance: [/^saldo$|^balance$|^bogført saldo$|^disponibel saldo$/, /saldo|balance/],
    reference: [/^reference$|^ref$|^transaktions id$|^transaktions-id$|^transaktionsid$|^transaction id$|^posterings id$|^id$|^bilag$|^bilagsnummer$/, /reference|transaktions-?id/],
  };
  const EXTRA_DESC = /^modtager$|^navn$|^payee$|^afsender$|^meddelelse$|^besked$/;

  function guessMapping(header) {
    const h = header.map(norm);
    const used = new Set();
    const map = { date: -1, description: -1, extra: [], amount: -1, debit: -1, credit: -1, currency: -1, balance: -1, reference: -1 };
    const order = ['date', 'debit', 'credit', 'currency', 'balance', 'reference', 'amount', 'description'];
    for (const key of order) {
      outer: for (const re of COLUMN_PATTERNS[key]) {
        for (let i = 0; i < h.length; i++) {
          if (used.has(i) || !re.test(h[i])) continue;
          if (key === 'amount' && /saldo|balance/.test(h[i])) continue;
          if (key === 'date' && /rente|valør|value/.test(h[i]) && h.some((x, j) => j !== i && /bogf|^dato$|^date$/.test(x))) continue;
          map[key] = i; used.add(i); break outer;
        }
      }
    }
    for (let i = 0; i < h.length; i++) if (!used.has(i) && EXTRA_DESC.test(h[i])) { map.extra.push(i); used.add(i); }
    if (map.amount >= 0 && (map.debit >= 0 || map.credit >= 0)) { map.debit = -1; map.credit = -1; }
    return map;
  }
  function mappingScore(map) {
    return (map.date >= 0 ? 1 : 0) + (map.description >= 0 ? 1 : 0) + (map.amount >= 0 || map.debit >= 0 || map.credit >= 0 ? 1 : 0);
  }
  function mappingComplete(map) { return mappingScore(map) === 3; }

  // Nogle banker har et par linjer med kontonavn o.l. før selve overskriftsrækken.
  function detectHeaderRow(rows) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      if (mappingScore(guessMapping(rows[i])) >= 2) return i;
    }
    return 0;
  }

  // --- Beløb -------------------------------------------------------------------

  function cleanAmount(s) {
    let v = String(s == null ? '' : s).replace(/[\s  ']/g, '').replace(/kr\.?|dkk|eur|usd|sek|nok|gbp|€|\$|£/gi, '');
    let neg = false;
    if (/^\(.*\)$/.test(v)) { neg = true; v = v.slice(1, -1); }
    if (/-$/.test(v)) { neg = true; v = v.slice(0, -1); }
    if (/^[−–-]/.test(v)) { neg = !neg; v = v.slice(1); }
    if (/^\+/.test(v)) v = v.slice(1);
    return { v, neg };
  }

  // Finder ud af, om filen bruger decimalkomma (1.234,56) eller decimalpunktum (1,234.56).
  function detectDecimalMode(values) {
    let comma = 0, dot = 0;
    for (const raw of values) {
      const { v } = cleanAmount(raw);
      if (!v) continue;
      const lc = v.lastIndexOf(','), ld = v.lastIndexOf('.');
      if (lc >= 0 && ld >= 0) { if (lc > ld) comma++; else dot++; continue; }
      if (lc >= 0 && !/^\d{1,3}(,\d{3})+$/.test(v)) comma++;
      if (ld >= 0 && !/^\d{1,3}(\.\d{3})+$/.test(v)) dot++;
    }
    if (comma === 0 && dot === 0) return { mode: 'comma', certain: false };
    return { mode: comma >= dot ? 'comma' : 'dot', certain: comma === 0 || dot === 0 };
  }

  // Returnerer { value } eller { error }. Et tomt felt bliver aldrig til 0 kr.
  function parseAmount(raw, mode) {
    const { v, neg } = cleanAmount(raw);
    if (!v) return { empty: true };
    let s;
    if (mode === 'dot') s = v.replace(/,/g, '');
    else s = v.replace(/\./g, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return { error: 'Ugyldigt beløb "' + raw + '"' };
    const value = U.round2((neg ? -1 : 1) * parseFloat(s));
    // "1.234" kan både være 1.234 kr. (tusindtal) og 1,234 kr.; markér, hvis filen ikke afgør det.
    const ambiguous = /^\d{1,3}[.,]\d{3}$/.test(v);
    return { value, ambiguous };
  }

  // --- Datoer ------------------------------------------------------------------

  const MONTH_NAMES = { jan: 1, feb: 2, mar: 3, apr: 4, maj: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12 };

  function splitDate(raw) {
    const s = String(raw == null ? '' : raw).trim().replace(/[T\s]+\d{1,2}[:.]\d{2}([:.]\d{2})?.*$/, '');
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return { kind: 'ymd', a: +m[1], b: +m[2], c: +m[3] };
    m = s.match(/^(\d{8})$/);
    if (m) return { kind: 'ymd', a: +s.slice(0, 4), b: +s.slice(4, 6), c: +s.slice(6, 8) };
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.'](\d{2}|\d{4})$/);
    if (m) return { kind: 'xyz', a: +m[1], b: +m[2], c: m[3].length === 2 ? 2000 + +m[3] : +m[3] };
    m = s.match(/^(\d{1,2})\.?\s*([a-zæøå]{3})[a-zæøå]*\.?\s*(\d{4})$/i);
    if (m && MONTH_NAMES[m[2].toLowerCase()]) return { kind: 'ymd', a: +m[3], b: MONTH_NAMES[m[2].toLowerCase()], c: +m[1] };
    return null;
  }

  // format: 'auto' | 'DMY' | 'MDY' | 'YMD'
  function parseDate(raw, format) {
    const p = splitDate(raw);
    if (!p) return null;
    let y, m, d;
    if (p.kind === 'ymd') { y = p.a; m = p.b; d = p.c; }
    else if (format === 'MDY') { m = p.a; d = p.b; y = p.c; }
    else { d = p.a; m = p.b; y = p.c; }
    const s = U.iso(y, m, d);
    return U.isValidISO(s) ? s : null;
  }

  function detectDateFormat(values) {
    let dmy = false, mdy = false, any = false;
    for (const v of values) {
      const p = splitDate(v);
      if (!p) continue;
      if (p.kind === 'ymd') return { format: 'YMD', certain: true };
      any = true;
      if (p.a > 12) dmy = true;
      if (p.b > 12) mdy = true;
    }
    if (dmy && !mdy) return { format: 'DMY', certain: true };
    if (mdy && !dmy) return { format: 'MDY', certain: true };
    return { format: 'DMY', certain: !any };
  }

  // --- Fra tabel til rækker ----------------------------------------------------

  // table: { rows: [[...]], headerRow, map, dateFormat, decimalMode, invertSign, currency }
  function buildRows(table, opts) {
    const o = opts || {};
    const map = o.map;
    const all = table.rows;
    const start = (o.headerRow || 0) + 1;
    const out = [], errors = [];
    let empty = 0, ambiguous = 0;
    const cell = (r, i) => (i >= 0 && i < r.length ? r[i] : '');
    for (let i = start; i < all.length; i++) {
      const r = all[i];
      const rowNo = i + 1;
      if (!r.some((c) => String(c).trim())) { empty++; continue; }
      const date = parseDate(cell(r, map.date), o.dateFormat);
      if (!date) { errors.push({ rowNo, reason: cell(r, map.date) ? 'Ugyldig dato "' + cell(r, map.date) + '"' : 'Mangler dato', raw: r }); continue; }
      let amount, amb = false;
      if (map.amount >= 0) {
        const a = parseAmount(cell(r, map.amount), o.decimalMode);
        if (a.empty) { errors.push({ rowNo, reason: 'Mangler beløb', raw: r }); continue; }
        if (a.error) { errors.push({ rowNo, reason: a.error, raw: r }); continue; }
        amount = a.value; amb = a.ambiguous;
      } else {
        const d = parseAmount(cell(r, map.debit), o.decimalMode);
        const c = parseAmount(cell(r, map.credit), o.decimalMode);
        if (d.error || c.error) { errors.push({ rowNo, reason: d.error || c.error, raw: r }); continue; }
        if (d.empty && c.empty) { errors.push({ rowNo, reason: 'Mangler beløb i både debet og kredit', raw: r }); continue; }
        amount = U.round2((c.empty ? 0 : Math.abs(c.value)) - (d.empty ? 0 : Math.abs(d.value)));
        amb = !!(d.ambiguous || c.ambiguous);
      }
      if (o.invertSign) amount = -amount;
      if (amb && !o.decimalCertain) ambiguous++;
      const parts = [cell(r, map.description), ...(map.extra || []).map((x) => cell(r, x))].map((s) => String(s).trim()).filter(Boolean);
      const description = [...new Set(parts)].join(' · ');
      const currency = (cell(r, map.currency) || o.currency || 'DKK').toUpperCase().slice(0, 3);
      const balRaw = cell(r, map.balance);
      const bal = balRaw ? parseAmount(balRaw, o.decimalMode) : null;
      const raw = {};
      (all[o.headerRow || 0] || []).forEach((h, j) => { if (h && r[j] !== '' && r[j] != null) raw[String(h).slice(0, 60)] = String(r[j]).slice(0, 300); });
      out.push({
        rowNo, date, amount, description: description || '(uden tekst)',
        currency: /^[A-Z]{3}$/.test(currency) ? currency : 'DKK',
        balance: bal && bal.value != null ? bal.value : null,
        reference: String(cell(r, map.reference) || '').trim() || null,
        ambiguous: amb && !o.decimalCertain,
        raw,
      });
    }
    return { rows: out, errors, empty, ambiguous };
  }

  // Analyserer en tabel og foreslår opsætning (overskriftsrække, kolonner, dato- og decimalformat).
  // hint: { decimalMode, headerRow } – headerRow bruges, når brugeren selv har valgt overskriftsrækken.
  function analyzeTable(rows, hint) {
    const headerRow = hint && hint.headerRow != null ? hint.headerRow : detectHeaderRow(rows);
    const header = rows[headerRow] || [];
    const map = guessMapping(header);
    const body = rows.slice(headerRow + 1, headerRow + 400);
    const amountVals = [];
    for (const r of body) for (const i of [map.amount, map.debit, map.credit]) if (i >= 0 && r[i]) amountVals.push(r[i]);
    const dec = hint && hint.decimalMode ? { mode: hint.decimalMode, certain: true } : detectDecimalMode(amountVals);
    const df = detectDateFormat(body.map((r) => r[map.date]).filter(Boolean));
    return { headerRow, map, decimalMode: dec.mode, decimalCertain: dec.certain, dateFormat: df.format, dateCertain: df.certain, invertSign: false };
  }

  // --- XLSX --------------------------------------------------------------------

  function xmlDecode(s) {
    return s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
    });
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Din browser kan ikke udpakke Excel-filer. Gem filen som CSV i stedet.');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(buf, wanted) {
    const b = new Uint8Array(buf);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Filen er ikke en gyldig Excel-fil.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder('utf-8');
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      if (!wanted(name)) continue;
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const data = b.subarray(start, start + csize);
      files[name] = method === 0 ? data : method === 8 ? await inflateRaw(data) : null;
    }
    return files;
  }

  const BUILTIN_DATE_FMTS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  function colIndex(ref) {
    const letters = ref.match(/^[A-Z]+/)[0];
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }
  function serialToISO(serial, date1904) {
    const days = Math.floor(serial) + (date1904 ? 1462 : 0);
    return U.fromDayNum(days - 25569);
  }

  async function readXlsx(buf) {
    const files = await unzip(buf, (n) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(n));
    const dec = new TextDecoder('utf-8');
    const txt = (n) => (files[n] ? dec.decode(files[n]) : '');
    const wb = txt('xl/workbook.xml');
    const date1904 = /date1904="(1|true)"/.test(wb);
    const firstSheet = wb.match(/<sheet\b[^>]*r:id="([^"]+)"/);
    let sheetPath = null;
    if (firstSheet) {
      const rel = txt('xl/_rels/workbook.xml.rels').match(new RegExp('<Relationship\\b[^>]*Id="' + firstSheet[1] + '"[^>]*>'));
      const target = rel && rel[0].match(/Target="([^"]+)"/);
      if (target) sheetPath = target[1].replace(/^\/?(xl\/)?/, 'xl/');
    }
    if (!sheetPath || !files[sheetPath]) sheetPath = Object.keys(files).filter((n) => n.startsWith('xl/worksheets/')).sort()[0];
    if (!sheetPath) throw new Error('Excel-filen indeholder ingen ark.');

    const shared = [];
    for (const si of txt('xl/sharedStrings.xml').match(/<si>[\s\S]*?<\/si>/g) || []) {
      shared.push(xmlDecode((si.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')));
    }
    const styles = txt('xl/styles.xml');
    const customDate = new Set();
    for (const m of styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
      const code = xmlDecode(m[2]).replace(/"[^"]*"|\[[^\]]*\]/g, '');
      if (/[dy]/i.test(code) || /m{1,4}.*[dy]|[dy].*m/i.test(code)) customDate.add(+m[1]);
    }
    const xfs = [];
    const cellXfs = styles.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/);
    if (cellXfs) for (const m of cellXfs[0].matchAll(/<xf\b[^>]*?numFmtId="(\d+)"/g)) xfs.push(+m[1]);
    const isDateStyle = (s) => { const f = xfs[s]; return f != null && (BUILTIN_DATE_FMTS.has(f) || customDate.has(f)); };

    const rows = [];
    const sheet = dec.decode(files[sheetPath]);
    for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
      const row = [];
      for (const cm of (rm[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1], inner = cm[2] || '';
        const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
        const t = (attrs.match(/\bt="([^"]+)"/) || [])[1];
        const s = +((attrs.match(/\bs="(\d+)"/) || [])[1] || 0);
        const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
        let val = '';
        if (t === 's') val = vm ? shared[+vm[1]] || '' : '';
        else if (t === 'inlineStr') val = xmlDecode((inner.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || []).map((x) => x.replace(/<[^>]+>/g, '')).join(''));
        else if (t === 'b') val = vm && vm[1] === '1' ? 'SAND' : 'FALSK';
        else if (vm) {
          val = xmlDecode(vm[1]);
          if (t !== 'str' && t !== 'e' && isDateStyle(s) && /^-?\d+(\.\d+)?$/.test(val)) val = serialToISO(+val, date1904);
        }
        const idx = ref ? colIndex(ref) : row.length;
        while (row.length < idx) row.push('');
        row[idx] = String(val).trim();
      }
      if (row.some((c) => c !== '')) rows.push(row);
    }
    return rows;
  }

  // --- OFX og QIF --------------------------------------------------------------

  function parseOFX(text) {
    const cur = (text.match(/<CURDEF>\s*([A-Z]{3})/i) || [])[1] || 'DKK';
    const rows = [['Dato', 'Tekst', 'Beløb', 'Reference', 'Valuta']];
    for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi)) {
      const get = (tag) => { const x = m[1].match(new RegExp('<' + tag + '>\\s*([^<\\r\\n]*)', 'i')); return x ? xmlDecode(x[1].trim()) : ''; };
      const dt = get('DTPOSTED').slice(0, 8);
      const name = get('NAME'), memo = get('MEMO');
      const desc = [name, memo && memo !== name ? memo : ''].filter(Boolean).join(' · ');
      rows.push([dt ? dt.slice(0, 4) + '-' + dt.slice(4, 6) + '-' + dt.slice(6, 8) : '', desc, get('TRNAMT'), get('FITID'), get('CURRENCY') || cur]);
    }
    return rows;
  }

  function parseQIF(text) {
    const rows = [['Dato', 'Tekst', 'Beløb', 'Reference']];
    let cur = {};
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      const c = line[0], v = line.slice(1).trim();
      if (c === '^') { if (cur.D || cur.T) rows.push([cur.D || '', [cur.P, cur.M].filter(Boolean).join(' · '), cur.T || '', cur.N || '']); cur = {}; }
      else if ('DTUPMN'.includes(c)) cur[c === 'U' ? 'T' : c] = cur[c === 'U' ? 'T' : c] || v;
    }
    return rows.map((r, i) => (i === 0 ? r : [r[0].replace("'", '/'), r[1], r[2], r[3]]));
  }

  // Læser en fil til en tabel (array af rækker). Kaster en forståelig fejl, hvis det ikke kan lade sig gøre.
  async function readTable(file, buf, opts) {
    const bytes = new Uint8Array(buf);
    const format = detectFormat(file.name, bytes);
    if (UNSUPPORTED[format]) throw new Error(UNSUPPORTED[format]);
    if (format === 'json') throw new Error('Det ligner en sikkerhedskopi (JSON). Gendan den under Indstillinger → Sikkerhedskopi.');
    if (!bytes.length) throw new Error('Filen er tom.');
    if (format === 'pdf') {
      if (!GB.pdf) throw new Error('PDF-læseren er ikke tilgængelig her.');
      const res = await GB.pdf.read(buf, opts && opts.password);
      return { format, rows: res.rows, encoding: null, delimiter: null, decimalHint: null, pdfMode: res.mode, pages: res.pages };
    }
    if (format === 'xlsx') return { format, rows: await readXlsx(buf), encoding: null, delimiter: null, decimalHint: 'dot' };
    const { text, encoding } = decodeText(bytes, opts && opts.encoding);
    if (!text.trim()) throw new Error('Filen er tom.');
    if (format === 'ofx') return { format, rows: parseOFX(text), encoding, delimiter: null, decimalHint: 'dot' };
    if (format === 'qif') return { format, rows: parseQIF(text), encoding, delimiter: null, decimalHint: null };
    const delimiter = (opts && opts.delimiter) || detectDelimiter(text);
    const rows = parseCSV(text, delimiter);
    if (rows.length < 2) throw new Error('Filen indeholder ingen rækker med data.');
    if (Math.max(...rows.slice(0, 20).map((r) => r.length)) < 2) throw new Error('Kunne ikke finde kolonner i filen. Er det en bankfil i CSV-format?');
    return { format, rows, encoding, delimiter, decimalHint: null };
  }

  GB.importer = {
    detectFormat, FORMAT_LABEL, UNSUPPORTED, decodeText, detectDelimiter, parseCSV,
    guessMapping, mappingComplete, detectHeaderRow, detectDecimalMode, parseAmount, parseDate, detectDateFormat,
    buildRows, analyzeTable, readXlsx, parseOFX, parseQIF, readTable,
  };
})();
