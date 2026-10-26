#!/usr/bin/env node
// Laver eksempel-PDF'er (opdigtede data) med Chromes "Gem som PDF", så PDF-importen kan afprøves:
//   kontoudtog_lonkonto_2026.pdf  – tabel med overskrift (Dato | Tekst | Rentedato | Beløb | Saldo) over flere sider
//   kreditkort_udtog_2026.pdf     – liste uden overskrift, datoer uden årstal ("05.01") og minus bagefter ("129,00-")
// Kræver Google Chrome eller Microsoft Edge. Kør: node Grejs_Budget/scripts/make-sample-pdf.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { load } = require('./lib/load');

const GB = load();
const U = GB.util;
const OUT = path.join(__dirname, '..', 'eksempeldata');
const UNTIL = '2026-04-14';

const BROWSERS = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const da = (n) => U.fmtNumber(n, 2);
const dmy = (iso) => iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4);

const CSS = 'body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#111;margin:0} h1{font-size:16pt;margin:0 0 4px} .meta{color:#444;margin-bottom:14px}' +
  'table{border-collapse:collapse;width:100%} th{text-align:left;border-bottom:1.5px solid #000;padding:5px 6px;font-size:9.5pt} td{padding:4px 6px;border-bottom:1px solid #ddd}' +
  '.r{text-align:right} @page{size:A4;margin:16mm 14mm}';

function statementHtml(rows) {
  return '<!doctype html><html lang="da"><meta charset="utf-8"><style>' + CSS + '</style><body>' +
    '<h1>Eksempelbank – Kontoudskrift</h1><div class="meta">Lønkonto (eksempel) · Periode 01.01.2026 - ' + dmy(UNTIL) + ' · Opdigtede data</div>' +
    '<table><thead><tr><th>Dato</th><th>Tekst</th><th>Rentedato</th><th class="r">Beløb</th><th class="r">Saldo</th></tr></thead><tbody>' +
    rows.map((r) => '<tr><td>' + dmy(r.date) + '</td><td>' + esc(r.description) + '</td><td>' + dmy(r.date) + '</td><td class="r">' + da(r.amount) + '</td><td class="r">' + da(r.balance) + '</td></tr>').join('') +
    '</tbody></table><p class="meta" style="margin-top:14px">Saldo pr. ' + dmy(UNTIL) + ': ' + da(rows[rows.length - 1].balance) + '</p></body></html>';
}

function cardHtml(rows) {
  return '<!doctype html><html lang="da"><meta charset="utf-8"><style>' + CSS + ' .line{display:flex;gap:24px;padding:3px 0;border-bottom:1px dotted #ccc} .d{width:50px} .t{flex:1} .a{width:110px;text-align:right}</style><body>' +
    '<h1>Kreditkortudtog 2026</h1><div class="meta">Eksempel Mastercard · januar – april 2026 · Opdigtede data</div>' +
    rows.map((r) => '<div class="line"><span class="d">' + r.date.slice(8, 10) + '.' + r.date.slice(5, 7) + '</span><span class="t">' + esc(r.description) + '</span><span class="a">' +
      da(Math.abs(r.amount)) + (r.amount < 0 ? '-' : '') + '</span></div>').join('') +
    '<p class="meta" style="margin-top:14px">Side 1 af 1</p></body></html>';
}

function findBrowser() {
  const b = BROWSERS.find((p) => fs.existsSync(p));
  if (!b) throw new Error('Fandt hverken Chrome eller Edge. Sæt miljøvariablen CHROME til stien.');
  return b;
}

function printToPdf(browser, html, outFile) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grejsbudget-pdf-'));
  const src = path.join(tmp, 'side.html');
  fs.writeFileSync(src, html);
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--user-data-dir=' + path.join(tmp, 'profil'), '--print-to-pdf=' + outFile, 'file:///' + src.replace(/\\/g, '/')], { stdio: 'ignore', timeout: 60000 });
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (require.main === module) {
  const browser = findBrowser();
  const g = GB.sample.generate(UNTIL, 4, 777);
  fs.mkdirSync(OUT, { recursive: true });
  printToPdf(browser, statementHtml(GB.sample.withBalance(g.checking, 18450.75)), path.join(OUT, 'kontoudtog_lonkonto_2026.pdf'));
  console.log('Skrev eksempeldata/kontoudtog_lonkonto_2026.pdf');
  printToPdf(browser, cardHtml(g.card), path.join(OUT, 'kreditkort_udtog_2026.pdf'));
  console.log('Skrev eksempeldata/kreditkort_udtog_2026.pdf');
}

module.exports = { statementHtml, cardHtml, UNTIL };
