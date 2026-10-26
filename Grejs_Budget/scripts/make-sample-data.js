#!/usr/bin/env node
// Laver eksempelfilerne i Grejs_Budget/eksempeldata/ – helt opdigtede data i forskellige
// bankformater, så importguiden kan afprøves. Kør: node Grejs_Budget/scripts/make-sample-data.js
'use strict';
const fs = require('fs');
const path = require('path');
const { load } = require('./lib/load');
const { buildXlsx } = require('./lib/xlsx-writer');

const GB = load();
const U = GB.util;
const OUT = path.join(__dirname, '..', 'eksempeldata');
const UNTIL = '2026-04-14';

const da = (n) => U.fmtNumber(n, 2); // dansk format: 1.234,56
const dmy = (iso, sep) => iso.slice(8, 10) + sep + iso.slice(5, 7) + sep + iso.slice(0, 4);
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

function files() {
  U.setNumberFormat('da');
  const g = GB.sample.generate(UNTIL, 4, 777);
  const checking = GB.sample.withBalance(g.checking, 18450.75);
  const out = {};

  // 1+2) Lønkonto i to overlappende filer (marts findes i begge) – semikolon, decimalkomma, DD.MM.ÅÅÅÅ, UTF-8 med BOM.
  const lon = (rows) => '﻿' + ['Bogført;Tekst;Beløb;Saldo;Status'].concat(rows.map((r) => [dmy(r.date, '.'), r.description, da(r.amount), da(r.balance), 'Udført'].join(';'))).join('\r\n') + '\r\n';
  out['lonkonto_2026-01_til_2026-03.csv'] = lon(checking.filter((r) => r.date < '2026-04-01'));
  out['lonkonto_2026-03_til_2026-04.csv'] = lon(checking.filter((r) => r.date >= '2026-03-01'));

  // 3) Kreditkort – komma som separator, decimalpunktum, ÅÅÅÅ-MM-DD, separate debet/kredit-kolonner og transaktions-ID.
  let n = 1000;
  out['kreditkort_2026.csv'] = ['"Date","Description","Debit","Credit","Currency","Transaction ID"']
    .concat(g.card.map((r) => [r.date, q(r.description), r.amount < 0 ? (-r.amount).toFixed(2) : '', r.amount > 0 ? r.amount.toFixed(2) : '', 'DKK', 'KK-2026-' + (n++)].join(','))).join('\n') + '\n';

  // 4) Opsparingskonto som Excel-fil (rigtige datoceller og tal).
  out['opsparing_2026.xlsx'] = buildXlsx([['Dato', 'Tekst', 'Beløb']].concat(g.savings.map((r) => [{ date: r.date }, r.description, r.amount])));

  // 5) En ældre ANSI-fil (Windows-1252) med tabulator, DD-MM-ÅÅÅÅ og nogle fejlbehæftede rækker.
  const bad = [
    'Dato\tTekst\tBeløb',
    '02-02-2026\tKøbmand Ærø Ølstykke Å\t-84,50',
    '03-02-2026\tGavekort til børnehaven\t-200,00',
    '31-02-2026\tUgyldig dato\t-10,00',
    '05-02-2026\tMangler beløb\t',
    '06-02-2026\tBeløb er tekst\tikke et tal',
    '07-02-2026\tMobilePay fra Søren\t150,00',
    '\t\t',
    '08-02-2026\tKiosk Ålborg\t-32,00',
  ].join('\r\n') + '\r\n';
  out['aeldre_bankfil_ansi_med_fejl.csv'] = Buffer.from(bad, 'latin1');
  return out;
}

if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, content] of Object.entries(files())) {
    fs.writeFileSync(path.join(OUT, name), content);
    console.log('Skrev eksempeldata/' + name);
  }
}

module.exports = { files, UNTIL };
