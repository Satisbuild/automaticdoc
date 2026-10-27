#!/usr/bin/env node
// Automatiske tests af import, dubletter, kategorisering, beregninger, budgetter, backup m.m.
// Kør: node Grejs_Budget/scripts/run-tests.js   (gøres automatisk ved commit)
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { load } = require('./lib/load');
const { buildXlsx } = require('./lib/xlsx-writer');
const sampleFiles = require('./make-sample-data').files;

const GB = load();
const U = GB.util, I = GB.importer, C = GB.categories, T = GB.tx, An = GB.analytics, B = GB.budgets, R = GB.recurring, E = GB.exporter, S = GB.store;
const ROOT = path.resolve(__dirname, '..');

const cats = C.defaultCategories();
const calc = An.makeCalc(cats, {});
const ctx = C.makeContext([], cats, []);

// Læser en "fil" fra tekst/buffer helt som appen gør, og returnerer rækker + fejl.
async function importText(name, content, overrides) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const table = await I.readTable({ name }, ab);
  const setup = Object.assign(I.analyzeTable(table.rows, { decimalMode: table.decimalHint }), overrides || {});
  return Object.assign(I.buildRows(table, setup), { table, setup });
}
function toTxs(rows, acc) {
  return rows.map((r) => { const t = T.makeTransaction(r, acc, 'b1'); C.categorize(t, ctx); return t; });
}
function tx(p) {
  const t = T.makeTransaction(Object.assign({ date: '2026-03-10', amount: -100, description: 'TEST' }, p), p.accountId || 'a1', null);
  C.categorize(t, ctx);
  return Object.assign(t, p.patch || {});
}

const tests = {
  // --- Import ---
  'CSV med semikolon og danske decimaler (1.234,56)': async () => {
    const r = await importText('a.csv', 'Dato;Tekst;Beløb;Saldo\n05-01-2026;NETTO;-1.234,56;10.000,00\n06-01-2026;Løn;25.000,00;35.000,00\n');
    assert.deepStrictEqual(r.rows.map((x) => x.amount), [-1234.56, 25000]);
    assert.strictEqual(r.rows[0].date, '2026-01-05');
    assert.strictEqual(r.rows[0].balance, 10000);
    assert.strictEqual(r.errors.length, 0);
  },
  'CSV med komma og decimalpunktum': async () => {
    const r = await importText('b.csv', 'Date,Description,Amount\n2026-01-05,"Shop, Inc",-1234.56\n2026-01-06,Salary,"2,500.00"\n');
    assert.deepStrictEqual(r.rows.map((x) => x.amount), [-1234.56, 2500]);
    assert.strictEqual(r.rows[0].description, 'Shop, Inc');
    assert.strictEqual(r.setup.decimalMode, 'dot');
  },
  'Tabulator som separator': async () => {
    const r = await importText('c.txt', 'Dato\tTekst\tBeløb\n01-02-2026\tA\t-5,00\n');
    assert.strictEqual(r.rows[0].amount, -5);
  },
  'UTF-8 med danske tegn og BOM': async () => {
    const r = await importText('d.csv', '﻿Dato;Tekst;Beløb\n01-02-2026;Æblegården Ørsted Å;-12,00\n');
    assert.strictEqual(r.rows[0].description, 'Æblegården Ørsted Å');
    assert.strictEqual(r.table.encoding, 'utf-8');
  },
  'Windows-1252 (ANSI) læses med korrekte æ, ø og å': async () => {
    const r = await importText('e.csv', Buffer.from('Dato;Tekst;Beløb\n01-02-2026;Køb i Ærø Å;-12,00\n', 'latin1'));
    assert.strictEqual(r.rows[0].description, 'Køb i Ærø Å');
    assert.strictEqual(r.table.encoding, 'windows-1252');
  },
  'Datoformater DD-MM-ÅÅÅÅ, DD.MM.ÅÅ, ÅÅÅÅ-MM-DD, ÅÅÅÅMMDD og tekstmåned': () => {
    assert.strictEqual(I.parseDate('15-01-2026', 'DMY'), '2026-01-15');
    assert.strictEqual(I.parseDate('15.01.26', 'DMY'), '2026-01-15');
    assert.strictEqual(I.parseDate('2026-01-15', 'DMY'), '2026-01-15');
    assert.strictEqual(I.parseDate('20260115', 'DMY'), '2026-01-15');
    assert.strictEqual(I.parseDate('15. jan. 2026', 'DMY'), '2026-01-15');
    assert.strictEqual(I.parseDate('2026-01-15T00:00:00', 'DMY'), '2026-01-15');
    assert.strictEqual(I.parseDate('01/15/2026', 'MDY'), '2026-01-15');
    assert.strictEqual(I.parseDate('31-02-2026', 'DMY'), null);
    assert.deepStrictEqual(I.detectDateFormat(['01/02/2026', '25/02/2026']), { format: 'DMY', certain: true });
    assert.deepStrictEqual(I.detectDateFormat(['01/02/2026', '02/25/2026']), { format: 'MDY', certain: true });
  },
  'Datoer forskydes aldrig pga. tidszoner': () => {
    assert.strictEqual(U.addDays('2026-03-28', 1), '2026-03-29');
    assert.strictEqual(U.addDays('2026-03-29', 1), '2026-03-30');
    assert.strictEqual(U.addMonths('2026-01-31', 1), '2026-02-28');
    assert.strictEqual(U.daysBetween('2026-10-24', '2026-10-26'), 2);
  },
  'Separate debet- og kreditkolonner': async () => {
    const r = await importText('f.csv', 'Dato;Tekst;Debet;Kredit\n01-02-2026;Køb;125,50;\n02-02-2026;Retur;;40,00\n03-02-2026;Negativ debet;-10,00;\n');
    assert.deepStrictEqual(r.rows.map((x) => x.amount), [-125.5, 40, -10]);
    assert.strictEqual(r.setup.map.amount, -1);
  },
  'Overskriftsrække findes, selvom der står kontooplysninger øverst': async () => {
    const r = await importText('g.csv', 'Kontoudtog;Eksempelkonto\n\nDato;Tekst;Beløb\n01-02-2026;A;-1,00\n');
    assert.strictEqual(r.setup.headerRow, 1);
    assert.strictEqual(r.rows.length, 1);
  },
  'Mangelfulde rækker springes over MED begrundelse – aldrig som 0 kr.': async () => {
    const r = await importText('h.csv', 'Dato;Tekst;Beløb\n01-02-2026;OK;-1,00\n31-02-2026;Dato forkert;-2,00\n03-02-2026;Intet beløb;\n04-02-2026;Tekst;abc\n;;\n');
    assert.strictEqual(r.rows.length, 1);
    assert.strictEqual(r.errors.length, 3);
    assert.ok(r.errors.every((e) => e.rowNo && e.reason));
    assert.ok(!r.rows.some((x) => x.amount === 0));
  },
  'Tvetydige beløb ("1.234") markeres, når filen ikke afgør formatet': async () => {
    const r = await importText('i.csv', 'Dato;Tekst;Beløb\n01-02-2026;A;-1.234\n');
    assert.strictEqual(r.setup.decimalCertain, false);
    assert.strictEqual(r.ambiguous, 1);
    assert.strictEqual(r.rows[0].amount, -1234);
  },
  'Tom fil og forkert format giver en forståelig fejl': async () => {
    await assert.rejects(() => importText('tom.csv', ''), /tom/i);
    await assert.rejects(() => importText('gammel.xls', '\xD0\xCF\x11\xE0'), /xls/i);
    await assert.rejects(() => importText('backup.json', '{"format":"x"}'), /sikkerhedskopi/i);
    await assert.rejects(() => importText('x.csv', 'bare en linje uden kolonner\nog en til\n'), /kolonner/i);
  },
  'XLSX: datoceller, tal og tekst læses korrekt': async () => {
    const buf = buildXlsx([['Dato', 'Tekst', 'Beløb'], [{ date: '2026-03-05' }, 'Ærlig & sød', -99.5], [{ date: '2026-03-06' }, 'Løn', 25000]]);
    const r = await importText('k.xlsx', buf);
    assert.deepStrictEqual(r.rows.map((x) => [x.date, x.description, x.amount]), [['2026-03-05', 'Ærlig & sød', -99.5], ['2026-03-06', 'Løn', 25000]]);
  },
  'OFX og QIF læses': async () => {
    const ofx = 'OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>DKK<BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260110120000<TRNAMT>-49.95<FITID>A1<NAME>NETFLIX</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260111<TRNAMT>100.00<FITID>A2<NAME>Retur</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>';
    const r = await importText('x.ofx', ofx);
    assert.deepStrictEqual(r.rows.map((x) => [x.date, x.amount, x.reference]), [['2026-01-10', -49.95, 'A1'], ['2026-01-11', 100, 'A2']]);
    const qif = '!Type:Bank\nD15/01/2026\nT-1,234.50\nPHusleje\n^\nD16/01/2026\nT200.00\nPRefusion\n^\n';
    const r2 = await importText('x.qif', qif);
    assert.deepStrictEqual(r2.rows.map((x) => [x.date, x.amount]), [['2026-01-15', -1234.5], ['2026-01-16', 200]]);
  },
  'PDF med overskrift: kolonner, højrestillede beløb, gentagen overskrift og tekst over to linjer': () => {
    // Tekststykker som pdf.js leverer dem (x, y oppefra, bredde, højde).
    const it = (str, x, y, w) => ({ str, x, y, w: w || str.length * 5, h: 9 });
    const header = (y) => [it('Dato', 40, y), it('Tekst', 110, y), it('Beløb', 420, y, 30), it('Saldo', 500, y, 30)];
    const page1 = [it('Eksempelbank – Kontoudskrift', 40, 30), it('Periode 01.01.2026 - 31.01.2026', 40, 45)].concat(header(80),
      [it('05.01', 40, 100), it('NETTO EKSEMPELBY', 110, 100), it('-1.234,56', 405, 100, 45), it('8.765,44', 485, 100, 45)],
      [it('06.01', 40, 115), it('Lang tekst der fortsætter', 110, 115), it('-50,00', 420, 115, 30), it('8.715,44', 485, 115, 45)],
      [it('på næste linje', 110, 127)],
      [it('Side 1 af 2', 40, 800)]);
    const page2 = header(80).concat([it('28.01', 40, 100), it('Løn', 110, 100), it('25.000,00', 405, 100, 45), it('33.715,44', 480, 100, 50)],
      [it('Saldo pr. 31.01.2026', 110, 130), it('33.715,44', 480, 130, 50)]);
    const res = GB.pdf.itemsToTable([{ items: page1 }, { items: page2 }], { today: '2026-10-26' });
    assert.strictEqual(res.mode, 'header');
    const setup = I.analyzeTable(res.rows, {});
    const r = I.buildRows({ rows: res.rows }, setup);
    assert.deepStrictEqual(r.rows.map((x) => [x.date, x.description, x.amount, x.balance]), [
      ['2026-01-05', 'NETTO EKSEMPELBY', -1234.56, 8765.44],
      ['2026-01-06', 'Lang tekst der fortsætter på næste linje', -50, 8715.44],
      ['2026-01-28', 'Løn', 25000, 33715.44],
    ]);
    assert.strictEqual(r.errors.length, 0);
  },
  'PDF uden overskrift: dato først, beløb sidst, minus bagefter og årstal udledt': () => {
    const it = (str, x, y) => ({ str, x, y, w: str.length * 5, h: 9 });
    const items = [it('Kreditkortudtog december 2025 – januar 2026', 40, 20),
      it('28.12', 40, 60), it('SPOTIFY', 100, 60), it('119,00-', 450, 60),
      it('02.01', 40, 75), it('NETFLIX.COM', 100, 75), it('129,00-', 450, 75),
      it('03.01 H&M Retur', 40, 90), it('299,00', 450, 90),
      it('Side 1 af 1', 40, 300)];
    const res = GB.pdf.itemsToTable([{ items }], { today: '2026-10-26' });
    assert.strictEqual(res.mode, 'lines');
    const r = I.buildRows({ rows: res.rows }, I.analyzeTable(res.rows, {}));
    assert.deepStrictEqual(r.rows.map((x) => [x.date, x.description, x.amount]), [['2025-12-28', 'SPOTIFY', -119], ['2026-01-02', 'NETFLIX.COM', -129], ['2026-01-03', 'H&M Retur', 299]]);
  },
  'PDF: datoer uden årstal placeres i udtogets periode og ikke i fremtiden': () => {
    assert.strictEqual(GB.pdf.completeDate('05.01', { from: '2026-01-01', to: '2026-12-31' }, '2026-10-26'), '05-01-2026');
    assert.strictEqual(GB.pdf.completeDate('30.12', { from: '2025-12-01', to: '2026-01-31' }, '2026-10-26'), '30-12-2025');
    assert.strictEqual(GB.pdf.completeDate('15.11', null, '2026-10-26'), '15-11-2025');
    assert.strictEqual(GB.pdf.completeDate('15.11.2024', null, '2026-10-26'), '15.11.2024');
  },
  'Eksempelfilerne kan importeres uden fejl (undtagen den bevidst fejlbehæftede)': async () => {
    for (const [name, content] of Object.entries(sampleFiles())) {
      const r = await importText(name, content);
      assert.ok(r.rows.length > 0, name + ' gav ingen rækker');
      if (name.includes('fejl')) {
        assert.strictEqual(r.errors.length, 3, name);
        assert.strictEqual(r.rows.find((x) => x.description.startsWith('Køb')).description, 'Købmand Ærø Ølstykke Å');
      } else assert.strictEqual(r.errors.length, 0, name + ': ' + JSON.stringify(r.errors[0]));
      if (name.includes('hele_2025')) {
        const months = new Set(r.rows.map((x) => U.monthKey(x.date)));
        assert.deepStrictEqual([...months].sort(), U.monthRange('2025-01', '2025-12'), 'et helt år skal fordeles på alle 12 måneder');
        const s = calc.byMonth(toTxs(r.rows, 'y'), U.monthRange('2025-01', '2025-12'));
        assert.ok(s.every((m) => m.count > 10 && m.expense > 0), 'hver måned har sine egne transaktioner');
      }
    }
  },

  // --- Dubletter ---
  'Overlappende filer: samme måned tælles ikke to gange': async () => {
    const f = sampleFiles();
    const a = await importText('a.csv', f['lonkonto_2026-01_til_2026-03.csv']);
    const b = await importText('b.csv', f['lonkonto_2026-03_til_2026-04.csv']);
    const existing = toTxs(a.rows, 'acc1');
    const idx = T.makeDuplicateIndex(existing);
    T.markDuplicates(b.rows, 'acc1', idx);
    const march = b.rows.filter((r) => r.date < '2026-04-01');
    assert.ok(march.length > 10);
    assert.ok(march.every((r) => r.dupStatus === 'possible' && r.decision === 'skip'));
    assert.ok(b.rows.filter((r) => r.date >= '2026-04-01').every((r) => r.dupStatus === 'new'));
  },
  'Samme fil importeret igen: alle markeres som dubletter (bank-ID bruges, når det er pålideligt)': async () => {
    const card = sampleFiles()['kreditkort_2026.csv'];
    const a = await importText('k.csv', card), b = await importText('k.csv', card);
    const idx = T.makeDuplicateIndex(toTxs(a.rows, 'acc2'));
    const res = T.markDuplicates(b.rows, 'acc2', idx);
    assert.strictEqual(res.useRefs, true);
    assert.ok(b.rows.every((r) => r.dupStatus === 'certain' && r.decision === 'skip'));
  },
  'To reelle ens køb i samme fil importeres begge': async () => {
    const r = await importText('t.csv', 'Dato;Tekst;Beløb\n01-02-2026;KIOSK;-25,00\n01-02-2026;KIOSK;-25,00\n');
    T.markDuplicates(r.rows, 'a', T.makeDuplicateIndex([]));
    assert.deepStrictEqual(r.rows.map((x) => x.decision), ['import', 'import']);
    assert.strictEqual(r.rows[0].twinsInFile, 2);
  },
  'Kun ét af to ens køb fandtes i forvejen: kun det ene markeres som dublet': async () => {
    const r = await importText('t.csv', 'Dato;Tekst;Beløb\n01-02-2026;KIOSK;-25,00\n01-02-2026;KIOSK;-25,00\n');
    const idx = T.makeDuplicateIndex([tx({ date: '2026-02-01', amount: -25, description: 'KIOSK', accountId: 'a' })]);
    T.markDuplicates(r.rows, 'a', idx);
    assert.deepStrictEqual(r.rows.map((x) => x.dupStatus), ['possible', 'new']);
  },
  'Samme transaktion på en ANDEN konto er ikke en dublet': async () => {
    const r = await importText('t.csv', 'Dato;Tekst;Beløb\n01-02-2026;KIOSK;-25,00\n');
    T.markDuplicates(r.rows, 'b', T.makeDuplicateIndex([tx({ date: '2026-02-01', amount: -25, description: 'KIOSK', accountId: 'a' })]));
    assert.strictEqual(r.rows[0].dupStatus, 'new');
  },

  // --- Kategorisering ---
  'Automatisk kategorisering: sikre og usikre match': () => {
    assert.strictEqual(tx({ description: 'Dankort-køb NETTO 1234 AARHUS' }).categoryId, 'food-groceries');
    assert.strictEqual(tx({ description: 'NETFLIX.COM' }).categorySource, 'default');
    const ok = tx({ description: 'OK Tankstation Viby' });
    assert.strictEqual(ok.categoryId, 'transport-fuel');
    assert.strictEqual(ok.categorySource, 'suggested');
    assert.strictEqual(tx({ description: 'BOOK & CO' }).categoryId, C.UNKNOWN_ID, 'OK må ikke matche inde i et ord');
    assert.strictEqual(tx({ description: 'Lønoverførsel', amount: 20000 }).categoryId, 'income-salary');
    assert.strictEqual(tx({ description: 'H&M Retur', amount: 299 }).categoryId, 'shopping-clothes');
    assert.strictEqual(tx({ description: 'Helt ukendt butik' }).categorySource, 'unknown');
  },
  'MobilePay (ud og ind) får kategorien MobilePay (butikskøb via MobilePay beholder butikkens kategori)': () => {
    const mp = tx({ description: 'MobilePay Overførsel', amount: -150 });
    assert.strictEqual(mp.categoryId, 'other-mobilepay');
    assert.strictEqual(mp.categorySource, 'default');
    assert.strictEqual(tx({ description: 'MobilePay: Søren Hansen', amount: -75 }).categoryId, 'other-mobilepay');
    assert.strictEqual(tx({ description: 'MOBILEPAY NETTO 4512', amount: -89 }).categoryId, 'food-groceries');
    const inn = tx({ description: 'MobilePay fra Søren', amount: 200 });
    assert.strictEqual(inn.categoryId, 'other-mobilepay');
    const cat = cats.find((c) => c.id === 'other-mobilepay');
    assert.ok(cat && cat.kind === 'mixed' && cat.parentId === 'other' && cat.icon === 'phone');
    // Blandet kategori: penge ud er forbrug, penge ind er indtægt (ikke en refusion, der trækkes fra forbruget).
    const s = calc.summarize([mp, inn]);
    assert.strictEqual(s.expense, 150);
    assert.strictEqual(s.income, 200);
    assert.strictEqual(s.incomeByCategory.get('other-mobilepay'), 200);
    assert.strictEqual(calc.classify(inn).type, 'income');
  },
  'Migration: ældre data får MobilePay-kategorien, og kun automatiske kategorier flyttes': () => {
    const old = C.defaultCategories().filter((c) => c.id !== 'other-mobilepay');
    const t1 = Object.assign(tx({ description: 'MobilePay Overførsel', amount: -100 }), { categoryId: 'other-transfer', categorySource: 'suggested' });
    const t2 = Object.assign(tx({ description: 'MobilePay Overførsel', amount: -100 }), { categoryId: 'shopping-gifts', categorySource: 'manual' });
    const t3 = Object.assign(tx({ description: 'MobilePay Peter', amount: -50 }), { categoryId: C.UNKNOWN_ID, categorySource: 'unknown' });
    const t4 = Object.assign(tx({ description: 'MobilePay fra Peter', amount: 50 }), { categoryId: C.UNKNOWN_ID, categorySource: 'unknown' });
    const d = { categories: old, transactions: [t1, t2, t3, t4] };
    S.runMigrations(d, 1);
    assert.strictEqual(d.categories.find((c) => c.id === 'other-mobilepay').kind, 'mixed');
    assert.deepStrictEqual([t1, t2, t3, t4].map((t) => t.categoryId), ['other-mobilepay', 'shopping-gifts', 'other-mobilepay', 'other-mobilepay']);
    S.runMigrations(d, 1);
    assert.strictEqual(d.categories.filter((c) => c.id === 'other-mobilepay').length, 1, 'må ikke tilføjes to gange');
    // Fra version 2: har brugeren selv valgt typen, bevares den – og manuelle valg røres ikke.
    const d2 = { categories: C.defaultCategories().map((c) => (c.id === 'other-mobilepay' ? Object.assign({}, c, { kind: 'income' }) : c)), transactions: [Object.assign(tx({ description: 'MobilePay fra Ole', amount: 80 }), { categoryId: 'income-other', categorySource: 'manual' })] };
    S.runMigrations(d2, 2);
    assert.strictEqual(d2.categories.find((c) => c.id === 'other-mobilepay').kind, 'income');
    assert.strictEqual(d2.transactions[0].categoryId, 'income-other');
  },
  'Brugerens ønskede butikker får de rigtige kategorier': () => {
    const cases = [
      ['BRF BR HAMMERSHØJ', 'food-groceries'], ['Dankort-køb BRF BR HAMMERSHØJ 8830', 'food-groceries'],
      ['SUNSET', 'food-restaurant'], ['SUNSET BOULEVARD AARHUS', 'food-restaurant'], ['COCCO BELLO', 'food-restaurant'],
      ['LAND OG FRITID', 'other-outdoor'], ['Land & Fritid Randers', 'other-outdoor'], ['JAFI', 'other-outdoor'], ['Dankort-køb JAFI VIBORG', 'other-outdoor'],
      ['LEGO', 'other-misc'], ['LEGO STORE AARHUS', 'other-misc'],
      ['MCDONALDS', 'food-takeaway'], ["McDonald's Aarhus C", 'food-takeaway'], ['MC DONALDS 1234', 'food-takeaway'],
      ['Forretning: Jack', 'shopping-clothes'], ['Forretning: Jack & Jones', 'shopping-clothes'],
      ['NEMBILVASK MY GARA', 'transport-fuel'], ['Almindelig BILVASK', 'transport-carwash'],
      ['BRF KREDIT', 'housing-mortgage'], ['LEGOLAND', 'travel-experiences'],
    ];
    for (const [desc, cat] of cases) {
      const t = tx({ description: desc, amount: -100 });
      assert.strictEqual(t.categoryId, cat, desc + ' gav ' + t.categoryId);
      assert.strictEqual(t.categorySource, 'default', desc + ' skal være et sikkert match');
    }
  },
  'Indbyggede regler har faste, unikke id\'er': () => {
    const ids = C.BUILTIN_RULES.map((r) => r.id);
    assert.strictEqual(new Set(ids).size, ids.length);
    assert.ok(ids.every((id) => /^builtin:[a-z-]+:.+/.test(id)));
    assert.strictEqual(C.legacyRuleId('builtin-6', 3), 'builtin:food-groceries:NETTO');
    assert.strictEqual(C.legacyRuleId('builtin-56', 3), 'builtin:other-mobilepay:MOBILEPAY');
    assert.strictEqual(C.legacyRuleId('builtin-56', 1), 'builtin:other-cash:HÆVNING', 'version 1 havde ikke MobilePay-reglen');
    for (const old of ['builtin-0', 'builtin-30', 'builtin-59']) assert.ok(ids.includes(C.legacyRuleId(old, 3)), old);
  },
  'Migration 4: gamle regel-id\'er oversættes, og nye sikre regler bruges kun på ukendte/forslag': () => {
    const mk = (desc, cat, source, ruleId) => Object.assign(tx({ description: desc, amount: -100 }), { categoryId: cat, categorySource: source, categoryRuleId: ruleId });
    const d = {
      categories: C.defaultCategories(),
      transactions: [mk('SUNSET', C.UNKNOWN_ID, 'unknown', null), mk('SUNSET BOULEVARD', 'food-restaurant', 'suggested', 'builtin-8'),
        mk('LEGO', 'shopping-gifts', 'manual', null), mk('COCCO BELLO', 'food-takeaway', 'rule', 'rule_x'), mk('NETTO', 'food-groceries', 'default', 'builtin-6'), mk('Ukendt butik', C.UNKNOWN_ID, 'unknown', null)],
    };
    const s = { disabledBuiltinRules: ['builtin-12'] };
    S.runMigrations(d, 3, s);
    assert.deepStrictEqual(s.disabledBuiltinRules, ['builtin:transport-fuel:OK']);
    assert.deepStrictEqual(d.transactions.map((t) => t.categoryId + '/' + t.categorySource), [
      'food-restaurant/default', 'food-restaurant/default', 'shopping-gifts/manual', 'food-takeaway/rule', 'food-groceries/default', C.UNKNOWN_ID + '/unknown']);
    assert.strictEqual(d.transactions[4].categoryRuleId, 'builtin:food-groceries:NETTO');
    assert.ok(!('reason' in d.transactions[0]));
  },
  'Outdoor ligger under Andre poster, og flyttede regler beholder deres id': () => {
    const cat = cats.find((c) => c.id === 'other-outdoor');
    assert.ok(cat && cat.name === 'Outdoor' && cat.parentId === 'other' && cat.kind === 'expense' && cat.icon === 'tent');
    const ids = C.BUILTIN_RULES.map((r) => r.id);
    assert.ok(ids.includes('builtin:food-restaurant:MCDONALDS'), 'restaurant-reglens id må ikke ændres');
    assert.ok(ids.includes('builtin:other-misc:LAND OG FRITID'), 'Diverse-reglens id må ikke ændres');
    assert.ok(C.ICONS.includes('tent'));
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const ic of C.ICONS) assert.ok(html.includes('id="i-' + ic + '"'), 'ikonet ' + ic + ' mangler i index.html');
  },
  'Migration 5: Outdoor tilføjes, og automatiske kategorier flyttes – manuelle røres ikke': () => {
    const mk = (desc, cat, source) => Object.assign(tx({ description: desc, amount: -100 }), { categoryId: cat, categorySource: source, categoryRuleId: null });
    const d = {
      categories: C.defaultCategories().filter((c) => c.id !== 'other-outdoor'),
      transactions: [mk('LAND OG FRITID', 'other-misc', 'default'), mk('JAFI', C.UNKNOWN_ID, 'unknown'), mk('MCDONALDS', 'food-restaurant', 'suggested'),
        mk('MCDONALDS', 'food-restaurant', 'manual'), mk('JAFI', 'shopping-home', 'rule'), mk('LEGO', 'other-misc', 'default'),
        Object.assign(mk('MC DONALDS AARHUS', C.UNKNOWN_ID, 'unknown'), { descriptionNormalized: 'DONALDS AARHUS' })],
    };
    S.runMigrations(d, 4, {});
    const outdoor = d.categories.find((c) => c.id === 'other-outdoor');
    assert.ok(outdoor && outdoor.parentId === 'other');
    assert.deepStrictEqual(d.transactions.map((t) => t.categoryId + '/' + t.categorySource), [
      'other-outdoor/default', 'other-outdoor/default', 'food-takeaway/default', 'food-restaurant/manual', 'shopping-home/rule', 'other-misc/default', 'food-takeaway/default']);
    S.runMigrations(d, 4, {});
    assert.strictEqual(d.categories.filter((c) => c.id === 'other-outdoor').length, 1);
  },
  'Brugerens regler går forud for indbyggede og respekterer prioritet og konto': () => {
    const rules = [
      { id: 'r1', active: true, keyword: 'NETTO', matchType: 'contains', categoryId: 'food-snacks', priority: 20, sign: 'any', createdAt: '1' },
      { id: 'r2', active: true, keyword: 'NETTO', matchType: 'contains', categoryId: 'shopping-gifts', priority: 10, sign: 'any', accountId: 'kun-denne', createdAt: '2' },
    ];
    const c2 = C.makeContext(rules, cats, []);
    const a = T.makeTransaction({ date: '2026-01-01', amount: -10, description: 'NETTO' }, 'andet', null);
    C.categorize(a, c2);
    assert.strictEqual(a.categoryId, 'food-snacks');
    assert.strictEqual(a.categoryRuleId, 'r1');
    const b = T.makeTransaction({ date: '2026-01-01', amount: -10, description: 'NETTO' }, 'kun-denne', null);
    C.categorize(b, c2);
    assert.strictEqual(b.categoryId, 'shopping-gifts');
  },
  'Manuelt valgt kategori overskrives aldrig lydløst': () => {
    const t = tx({ description: 'NETTO' });
    T.applyEdit(t, { categoryId: 'shopping-gifts' });
    t.categorySource = 'manual';
    const c2 = C.makeContext([{ id: 'r', active: true, keyword: 'NETTO', categoryId: 'food-snacks', priority: 1 }], cats, []);
    assert.strictEqual(C.categorize(t, c2), false);
    assert.strictEqual(t.categoryId, 'shopping-gifts');
    assert.strictEqual(C.categorize(t, c2, { overwriteManual: true }), true);
    assert.strictEqual(t.categoryId, 'food-snacks');
  },
  'Indbyggede regler kan slås fra': () => {
    const id = C.BUILTIN_RULES.find((r) => r.keywords.includes('NETTO')).id;
    const t = T.makeTransaction({ date: '2026-01-01', amount: -10, description: 'NETTO' }, 'a', null);
    C.categorize(t, C.makeContext([], cats, [id]));
    assert.notStrictEqual(t.categoryId, 'food-groceries');
  },
  'Normalisering fjerner kortpræfikser, datoer og numre': () => {
    // 4-cifrede tal bevares (ellers kan "REMA 1000" ikke genkendes); modtagernøglen fjerner alle tal.
    assert.strictEqual(C.normalizeDescription('Dankort-køb NETTO 12.03 4512 VIBY'), 'NETTO 4512 VIBY');
    assert.strictEqual(C.normalizeDescription('VISA/DANKORT REMA 1000 XXXX1234 KORT 99 81234567'), 'REMA 1000');
    assert.strictEqual(C.merchantKey('Dankort-køb NETTO 12.03 4512 VIBY'), 'NETTO VIBY');
    assert.strictEqual(C.normalizeDescription('MC/DANKORT NETTO'), 'NETTO');
    assert.strictEqual(C.normalizeDescription('MC KØB NETTO'), 'NETTO');
    assert.strictEqual(C.normalizeDescription('MC DONALDS AARHUS'), 'MC DONALDS AARHUS', '"MC" i et butiksnavn må ikke fjernes');
    assert.strictEqual(C.merchantKey('NETFLIX.COM 866-579-7172'), 'NETFLIX.COM');
  },

  // --- Redigering ---
  'Redigering gemmer bankens oprindelige værdier og kan gendannes': () => {
    const t = tx({ description: 'NETTO', amount: -50 });
    T.applyEdit(t, { amount: -55, description: 'Netto (rettet)' });
    assert.ok(t.edited.amount && t.edited.description);
    assert.strictEqual(t.original.amount, -50);
    assert.strictEqual(t.history.length, 2);
    T.restoreOriginal(t);
    assert.strictEqual(t.amount, -50);
    assert.deepStrictEqual(t.edited, {});
  },

  // --- Beregninger ---
  'Interne overførsler og kreditkortbetaling dobbelttælles ikke': () => {
    const list = [
      tx({ description: 'Løn', amount: 20000, patch: { categoryId: 'income-salary' } }),
      tx({ description: 'Kortkøb Zalando', amount: -800, accountId: 'kort', patch: { categoryId: 'shopping-clothes' } }),
      tx({ description: 'Betaling kreditkort', amount: -800 }),
      tx({ description: 'Til egen konto', amount: -1000, patch: { isInternalTransfer: true } }),
      tx({ description: 'Fra egen konto', amount: 1000, accountId: 'b', patch: { isInternalTransfer: true } }),
    ];
    assert.strictEqual(list[2].categoryId, 'other-creditcard');
    const s = calc.summarize(list);
    assert.strictEqual(s.income, 20000);
    assert.strictEqual(s.expense, 800);
    assert.strictEqual(s.net, 19200);
    assert.strictEqual(s.transfers, 3);
  },
  'Refusioner, opsparing, kontanter og fremmed valuta følger reglerne': () => {
    const refund = tx({ description: 'H&M Retur', amount: 300 });
    const buy = tx({ description: 'H&M', amount: -500 });
    const save = tx({ description: 'x', amount: -2000, patch: { categoryId: 'finance-savings' } });
    const cash = tx({ description: 'Hævning pengeautomat', amount: -500 });
    const eur = tx({ description: 'Hotel', amount: -100, currency: 'EUR' });
    let s = calc.summarize([refund, buy, save, cash, eur]);
    assert.strictEqual(s.expense, 700);
    assert.strictEqual(s.byCategory.get('shopping-clothes'), 200);
    assert.strictEqual(s.savings, 2000);
    assert.strictEqual(s.foreign, 1);
    const c2 = An.makeCalc(cats, { refundsOffset: false, cashAsExpense: false, savingsAsExpense: true });
    s = c2.summarize([refund, buy, save, cash]);
    assert.strictEqual(s.income, 300);
    assert.strictEqual(s.expense, 2500);
    eur.exchangeRate = 7.46;
    assert.strictEqual(calc.summarize([eur]).expense, 746);
  },
  'Summer regnes i øre uden afrundingsfejl': () => {
    const list = Array.from({ length: 1000 }, () => tx({ amount: -0.1 }));
    assert.strictEqual(calc.summarize(list).expense, 100);
    assert.strictEqual(U.sumAmounts([0.1, 0.2]), 0.3);
  },
  'Ændring i procent vises ikke, når grundlaget er 0': () => {
    assert.strictEqual(An.change(100, 0).pct, null);
    assert.strictEqual(An.change(150, 100).pct, 50);
  },
  'Ufuldstændige måneder markeres': () => {
    const range = { from: '2026-01-12', to: '2026-04-14' };
    assert.strictEqual(An.monthCoverage('2026-01', range, '2026-10-01').complete, false);
    assert.strictEqual(An.monthCoverage('2026-02', range, '2026-10-01').complete, true);
    assert.strictEqual(An.monthCoverage('2026-04', range, '2026-10-01').complete, false);
    assert.strictEqual(An.monthCoverage('2026-10', { from: '2026-01-01', to: '2026-10-20' }, '2026-10-20').reason, 'Måneden er ikke slut');
  },
  'Måneder med data: importeret, delvis, mangler og fremtid pr. konto': () => {
    const batches = [
      { accountId: 'a', imported: 10, firstDate: '2026-01-02', lastDate: '2026-03-30' },
      { accountId: 'a', imported: 4, firstDate: '2026-05-01', lastDate: '2026-05-14' },
      { accountId: 'b', imported: 3, firstDate: '2026-02-01', lastDate: '2026-02-28' },
      { accountId: 'a', imported: 0, firstDate: '2026-06-01', lastDate: '2026-06-30' },
    ];
    const txs = [tx({ accountId: 'a', date: '2026-01-02' }), tx({ accountId: 'a', date: '2026-02-10' }), tx({ accountId: 'a', date: '2026-07-04' }), tx({ accountId: 'a', date: '2026-10-20' })];
    const months = U.monthRange('2026-01', '2026-12');
    const cov = An.accountCoverage(txs, batches, 'a', months, '2026-10-27');
    const st = Object.fromEntries(cov.map((x) => [x.month, x.status]));
    assert.deepStrictEqual([st['2026-01'], st['2026-02'], st['2026-03'], st['2026-04'], st['2026-05'], st['2026-06'], st['2026-07'], st['2026-11']],
      ['full', 'full', 'full', 'none', 'partial', 'none', 'partial', 'future'], 'en import med 0 rækker tæller ikke som dækning');
    assert.strictEqual(cov.find((x) => x.month === '2026-02').txCount, 1);
    assert.strictEqual(cov.find((x) => x.month === '2026-05').missingDays, 17);
    assert.ok(cov.find((x) => x.month === '2026-10').current);
    // Den igangværende måned er "importeret", når data går til (næsten) i dag.
    const cur = An.accountCoverage([], [{ accountId: 'a', imported: 5, firstDate: '2026-10-01', lastDate: '2026-10-26' }], 'a', ['2026-10'], '2026-10-27');
    assert.strictEqual(cur[0].status, 'full');
    assert.strictEqual(An.accountCoverage(txs, batches, 'b', ['2026-02', '2026-03'], '2026-10-27').map((x) => x.status).join(','), 'full,none');
  },
  'Penge fra andre: koblet MobilePay er ikke indtægt, men trækkes fra udgiftens kategori': () => {
    const buy = tx({ description: 'LAND OG FRITID', amount: -900, date: '2026-10-10' });
    const m1 = tx({ description: 'MobilePay fra Søren', amount: 300, date: '2026-10-11' });
    const m2 = tx({ description: 'MobilePay fra Mette', amount: 300, date: '2026-10-12' });
    const other = tx({ description: 'MobilePay fra Ole', amount: 150, date: '2026-10-12' });
    const list = [buy, m1, m2, other];
    const byId = new Map(list.map((t) => [t.id, t]));
    const lc = An.makeCalc(cats, {}, (id) => byId.get(id));
    // Før kobling: modtaget MobilePay er indtægt
    let s = lc.summarize(list);
    assert.strictEqual(s.income, 750);
    assert.strictEqual(s.byCategory.get('other-outdoor'), 900);
    // Forslag: de modtagne beløb fra dagene omkring købet
    assert.deepStrictEqual(T.reimbursementCandidates(buy, list).map((t) => t.id).sort(), [m1.id, m2.id, other.id].sort());
    assert.deepStrictEqual(T.expenseCandidates(m1, list, lc.classify).map((t) => t.id), [buy.id]);
    // Store køb fra de samme dage foreslås før små dagligvarekøb tættere på
    const milk = tx({ description: 'NETTO', amount: -350, date: '2026-10-11' });
    assert.deepStrictEqual(T.expenseCandidates(m1, list.concat(milk), lc.classify).map((t) => t.description), ['LAND OG FRITID', 'NETTO']);
    m1.linkedTo = buy.id; m2.linkedTo = buy.id;
    s = lc.summarize(list);
    assert.strictEqual(lc.classify(m1).type, 'reimbursement');
    assert.strictEqual(s.income, 150, 'kun det ukoblede beløb er indtægt');
    assert.strictEqual(s.expense, 300);
    assert.strictEqual(s.byCategory.get('other-outdoor'), 300, 'Outdoor viser kun egen andel');
    assert.strictEqual(lc.spentIn(list, 'other-outdoor'), 300);
    assert.strictEqual(lc.spentIn(list, 'other'), 300);
    assert.deepStrictEqual(T.ownShare(buy, list), { paid: 900, back: 600, own: 300 });
    // Der kan ikke kobles mere på, end der mangler: 150 kr. passer stadig, men ikke beløb over 300 kr.
    assert.deepStrictEqual(T.reimbursementCandidates(buy, list).map((t) => t.id), [other.id]);
    // "Vis alle indbetalinger": også penge uden MobilePay-tekst og senere end 45 dage – men ikke overførsler eller løn over beløbet
    const late = tx({ description: 'Overførsel fra Søren H', amount: 100, date: '2026-12-20' });
    const own = Object.assign(tx({ description: 'Fra egen opsparing', amount: 100, date: '2026-10-15' }), { isInternalTransfer: true });
    const salary = tx({ description: 'Lønoverførsel', amount: 25000, date: '2026-10-28', patch: { categoryId: 'income-salary' } });
    const wide = list.concat(late, own, salary);
    assert.ok(!T.reimbursementCandidates(buy, wide).some((t) => t.id === late.id), 'kun MobilePay som standard');
    assert.deepStrictEqual(T.reimbursementCandidates(buy, wide, { all: true, classify: lc.classify }).map((t) => t.id).sort(), [other.id, late.id].sort());
    // Hele købsmåneden kommer med, og beløb, der ikke kan kobles på, får en grund
    const exp2 = tx({ description: 'SUNSET', amount: -400, date: '2026-11-20' });
    const early = tx({ description: 'MobilePay fra Ib', amount: 100, date: '2026-11-02' });
    const tooBig = tx({ description: 'MobilePay fra Bo', amount: 500, date: '2026-11-21' });
    const taken = Object.assign(tx({ description: 'MobilePay fra Al', amount: 50, date: '2026-11-21' }), { linkedTo: 'et-andet-køb' });
    const lastMonth = tx({ description: 'MobilePay fra Kim', amount: 50, date: '2026-10-31' });
    assert.deepStrictEqual(T.reimbursementWindow(exp2), { from: '2026-11-01', to: '2027-01-04' });
    const opt = T.reimbursementOptions(exp2, [exp2, early, tooBig, taken, lastMonth]);
    assert.deepStrictEqual(opt.map((x) => x.t.description + ':' + x.status).sort(), ['MobilePay fra Al:linked', 'MobilePay fra Bo:tooBig', 'MobilePay fra Ib:ok']);
    // Koblede beløb vises, når man ser udgiftens kategori
    const shown = T.filterTransactions(list, { categoryIds: new Set(['other-outdoor']) }, { classify: lc.classify });
    assert.deepStrictEqual(shown.map((t) => t.id).sort(), [buy.id, m1.id, m2.id].sort());
    // Slettes udgiften, tæller pengene som almindelig indtægt igen
    byId.delete(buy.id);
    assert.strictEqual(lc.classify(m1).type, 'income');
    // Uden opslag (fx gamle kald) ændres intet
    assert.strictEqual(An.makeCalc(cats, {}).classify(m2).type, 'income');
  },
  'Perioder beregnes korrekt': () => {
    assert.deepStrictEqual(An.periodRange('this-month', '2026-10-26'), { from: '2026-10-01', to: '2026-10-31' });
    assert.deepStrictEqual(An.periodRange('last-month', '2026-01-15'), { from: '2025-12-01', to: '2025-12-31' });
    assert.deepStrictEqual(An.periodRange('last-3', '2026-10-26'), { from: '2026-08-01', to: '2026-10-31' });
    assert.strictEqual(An.periodLabel({ from: '2026-10-01', to: '2026-10-31' }), 'Oktober 2026');
  },
  'Mulige overførsler mellem egne konti findes': () => {
    const pairs = An.findTransferPairs([tx({ amount: -2000, accountId: 'a', date: '2026-02-02' }), tx({ amount: 2000, accountId: 'b', date: '2026-02-03' }), tx({ amount: 2000, accountId: 'a', date: '2026-02-03' })]);
    assert.strictEqual(pairs.length, 1);
    assert.strictEqual(pairs[0][1].accountId, 'b');
  },

  // --- Budgetter ---
  'Budget: forbrug, status og overskridelse': () => {
    const plans = [{ id: '2026-03', month: '2026-03', total: 0, lines: [{ categoryId: 'food', amount: 1000 }, { categoryId: 'subs-streaming', amount: 250 }] }];
    const list = [tx({ description: 'NETTO', amount: -600 }), tx({ description: 'WOLT', amount: -250 }), tx({ description: 'NETFLIX', amount: -299 }), tx({ description: 'NETTO', amount: -999, date: '2026-04-01' })];
    const ev = B.evaluate(plans, '2026-03', list, calc, { notice: 70, warn: 90 });
    assert.strictEqual(ev.lines[0].spent, 850);
    assert.strictEqual(ev.lines[0].level, 'notice');
    assert.strictEqual(ev.lines[1].level, 'over');
    assert.strictEqual(ev.lines[1].left, -49);
    assert.strictEqual(ev.totalBudget, 1250);
    const ev4 = B.evaluate(plans, '2026-04', list, calc);
    assert.strictEqual(ev4.inherited, true);
    assert.strictEqual(ev4.lines[0].spent, 999);
  },
  'Budget: ubrugt beløb overføres kun, når det er valgt': () => {
    const plans = [{ id: '2026-02', month: '2026-02', lines: [{ categoryId: 'food-groceries', amount: 1000, rollover: true }] }, { id: '2026-03', month: '2026-03', lines: [{ categoryId: 'food-groceries', amount: 1000, rollover: true }] }];
    const list = [tx({ description: 'NETTO', amount: -700, date: '2026-02-10' })];
    assert.strictEqual(B.evaluate(plans, '2026-03', list, calc).lines[0].budget, 1300);
    plans[1].lines[0].rollover = false;
    assert.strictEqual(B.evaluate(plans, '2026-03', list, calc).lines[0].budget, 1000);
  },
  'Budgetforslag bygger på hele måneder og rundes op': () => {
    const list = ['2026-01', '2026-02', '2026-03'].flatMap((m) => [tx({ description: 'NETTO', amount: -1010, date: m + '-05' }), tx({ description: 'Løn', amount: 20000, date: m + '-28', patch: { categoryId: 'income-salary' } })]);
    const range = An.dataRange(list);
    range.from = '2026-01-01'; range.to = '2026-03-31';
    const months = B.completeMonths(range, '2026-04-10', 3);
    assert.deepStrictEqual(months, ['2026-01', '2026-02', '2026-03']);
    const sg = B.suggest(list, calc, months, new Map(cats.map((c) => [c.id, c])));
    assert.strictEqual(sg.lines[0].amount, 1050);
    assert.strictEqual(sg.expectedIncome, 20000);
  },

  // --- Faste betalinger ---
  'Faste betalinger findes ud fra interval og beløb': () => {
    const list = ['01-15', '02-15', '03-15', '04-15'].map((d) => tx({ description: 'NETFLIX.COM', amount: -129, date: '2026-' + d }))
      .concat(['01-03', '01-20', '02-11'].map((d) => tx({ description: 'Tilfældig butik', amount: -50, date: '2026-' + d })));
    const s = R.detect(list, [], calc, '2026-04-20');
    assert.strictEqual(s.length, 1);
    assert.strictEqual(s[0].frequency, 'monthly');
    assert.strictEqual(s[0].nextDate, '2026-05-15');
    assert.strictEqual(R.detect(list, [{ matchKey: s[0].matchKey }], calc).length, 0, 'kendte betalinger foreslås ikke igen');
    assert.deepStrictEqual(R.occurrencesBetween({ frequency: 'monthly', nextDate: '2026-05-15' }, '2026-05-01', '2026-07-31'), ['2026-05-15', '2026-06-15', '2026-07-15']);
  },

  // --- Eksport og backup ---
  'CSV-eksport: dansk format, BOM og beskyttelse mod formler': () => {
    const csv = E.toCSV([{ a: '=SUM(A1)', b: -1234.5, c: 'x;y' }], [{ label: 'A', get: (r) => r.a }, { label: 'B', get: (r) => r.b, numeric: true }, { label: 'C', get: (r) => r.c }]);
    assert.ok(csv.startsWith('﻿A;B;C\r\n'));
    assert.ok(csv.includes("'=SUM(A1);-1234,5;\"x;y\""));
  },
  'Backup: fuld kopi valideres og afviser ugyldige filer': () => {
    S.data.transactions.push(tx({ description: 'NETTO' }));
    S.data.accounts.push({ id: 'a1', name: 'Konto' });
    const b = JSON.parse(JSON.stringify(E.makeBackup(S)));
    assert.strictEqual(b.counts.transactions, 1);
    assert.ok(E.validateBackup(b, S).ok);
    assert.ok(!E.validateBackup({ foo: 1 }, S).ok);
    assert.ok(!E.validateBackup(Object.assign({}, b, { schema: S.SCHEMA + 1 }), S).ok, 'nyere version afvises');
    const broken = JSON.parse(JSON.stringify(b));
    broken.data.transactions[0].amount = 'abc';
    assert.ok(!E.validateBackup(broken, S).ok);
    const dup = JSON.parse(JSON.stringify(b));
    dup.data.transactions.push(dup.data.transactions[0]);
    assert.ok(!E.validateBackup(dup, S).ok);
    S.data.transactions.length = 0; S.data.accounts.length = 0;
  },
  'Indstillinger flettes sikkert (også med tomme værdier)': () => {
    const s = S.mergeSettings({ thresholds: { notice: 60 }, lastBackupAt: '2026-01-01', ukendt: 1 });
    assert.strictEqual(s.thresholds.notice, 60);
    assert.strictEqual(s.thresholds.warn, 90);
    assert.strictEqual(s.lastBackupAt, '2026-01-01');
    assert.ok(!('ukendt' in s));
  },

  // --- Ydelse og privatliv ---
  'Stort datasæt: 10.000 transaktioner beregnes og filtreres hurtigt': () => {
    const t0 = Date.now();
    const descs = ['NETTO', 'REMA 1000', 'WOLT', 'CIRCLE K', 'NETFLIX', 'Ukendt', 'Løn'];
    const list = Array.from({ length: 10000 }, (_, i) => tx({ description: descs[i % descs.length], amount: i % 7 === 6 ? 20000 : -(i % 500) - 1, date: U.addDays('2024-01-01', i % 900) }));
    const s = calc.summarize(list);
    const f = T.filterTransactions(list, { text: 'netto', from: '2024-06-01', to: '2025-06-01' }, { classify: calc.classify, categoryName: () => '' });
    const idx = T.makeDuplicateIndex(list);
    const rows = list.slice(0, 2000).map((t) => ({ date: t.date, amount: t.amount, description: t.description }));
    T.markDuplicates(rows, 'a1', idx);
    const ms = Date.now() - t0;
    assert.ok(s.count === 10000 && f.length > 0 && rows.every((r) => r.dupStatus !== 'new'));
    assert.ok(ms < 8000, 'for langsomt: ' + ms + ' ms');
  },
  'Alle appens JavaScript-filer kan indlæses (ingen syntaksfejl)': () => {
    const { execFileSync } = require('child_process');
    const files = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.js$/.test(e.name) && files.push(path.join(d, e.name))));
    walk(path.join(ROOT, 'js'));
    files.push(path.join(ROOT, 'service-worker.js'));
    for (const f of files) {
      try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
      catch (e) { assert.fail(path.relative(ROOT, f) + ': ' + String(e.stderr).split('\n').find((l) => /Error/.test(l))); }
    }
  },
  'Ingen kode sender data ud af enheden': () => {
    const files = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.js$/.test(e.name) && files.push(path.join(d, e.name))));
    walk(path.join(ROOT, 'js'));
    for (const f of files) {
      // Eneste tilladte import(): PDF-læseren fra appens egen mappe.
      let src = fs.readFileSync(f, 'utf8');
      if (path.basename(f) === 'pdf-import.js') {
        assert.ok(/const LIB = 'assets\/libraries\/pdfjs-[\d.]+\/';/.test(src) && /new URL\(LIB, document\.baseURI\)/.test(src), 'PDF-læseren skal hentes fra appens egen mappe');
        src = src.replace("import(base + 'pdf.min.js')", '');
      }
      assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|import\s*\(/.test(src), path.basename(f) + ' laver netværkskald');
      assert.ok(!/https?:\/\//.test(src.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), path.basename(f) + ' henviser til en ekstern adresse');
    }
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.ok(/connect-src 'self'/.test(html), 'CSP skal forhindre forbindelser til andre servere');
    assert.ok(!/<script[^>]+src="https?:/.test(html) && !/<link[^>]+href="https?:/.test(html), 'ingen eksterne scripts eller stylesheets');
  },
  'Navnet skrives altid "Grejs Budget"': () => {
    const bad = /Grejs_Budget(?!\/)|GrejsBudget|Grejs-Budget/;
    for (const f of ['index.html', 'manifest.webmanifest', 'README.md']) {
      const p = path.join(ROOT, f);
      if (fs.existsSync(p)) assert.ok(!bad.test(fs.readFileSync(p, 'utf8').replace(/Grejs_Budget\/|`Grejs_Budget`|mappen Grejs_Budget|Grejs_Budget\\/g, '')), f);
    }
  },
};

(async () => {
  let failed = 0;
  for (const [name, fn] of Object.entries(tests)) {
    try { await fn(); console.log('  ✓ ' + name); }
    catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
  }
  console.log('\n' + (Object.keys(tests).length - failed) + ' af ' + Object.keys(tests).length + ' tests bestået');
  process.exit(failed ? 1 : 0);
})();
