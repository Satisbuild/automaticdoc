#!/usr/bin/env node
// Versionerer appens filer automatisk:
//  - index.html får ?v=<hash> på alle CSS- og JS-filer
//  - service-worker.js får den aktuelle liste over appfiler og et nyt versionsnummer,
//    når noget er ændret.
// Kør: node Grejs_Budget/scripts/stamp-service-worker.js   (gøres automatisk ved commit)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);

function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = dir + '/' + e.name;
    return e.isDirectory() ? walk(rel) : [rel];
  });
}

function stamp() {
  const indexPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const assets = [];
  const out = html.replace(/(href|src)="((?:css|js)\/[\w./-]+\.(?:css|js))(?:\?v=[^"]*)?"/g, (m, attr, file) => {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) throw new Error(`index.html henviser til ${file}, som ikke findes`);
    const url = `${file}?v=${hash(fs.readFileSync(p))}`;
    assets.push(url);
    return `${attr}="${url}"`;
  });
  if (out !== html) { fs.writeFileSync(indexPath, out); html = out; }

  // Billeder og lokale biblioteker (fx PDF-læseren), så alt virker offline.
  const images = walk('assets').filter((f) => /\.(png|svg|jpg|webp|js)$/i.test(f)).sort();
  const shell = ['./', 'index.html', 'manifest.webmanifest', ...assets, ...images];

  const h = crypto.createHash('sha256');
  h.update(html);
  for (const f of ['manifest.webmanifest', ...images]) h.update(f).update(fs.readFileSync(path.join(ROOT, f)));
  const version = h.digest('hex').slice(0, 10);

  const block = '// <precache> (genereret af scripts/stamp-service-worker.js - rediger ikke i hånden)\n' +
    `const VERSION = '${version}';\n` +
    'const SHELL = ' + JSON.stringify(shell, null, 2) + ';\n' +
    '// </precache>';
  const swPath = path.join(ROOT, 'service-worker.js');
  const src = fs.readFileSync(swPath, 'utf8');
  const sw = src.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, block);
  if (sw !== src) { fs.writeFileSync(swPath, sw); console.log('Grejs_Budget/service-worker.js opdateret: ' + shell.length + ' filer, version ' + version); }
  else console.log('Grejs_Budget/service-worker.js er allerede opdateret (version ' + version + ')');
}

stamp();
