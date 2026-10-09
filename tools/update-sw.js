#!/usr/bin/env node
// Opdaterer listen over filer, som sw.js gemmer til offline-brug, og
// giver cachen et nyt versionsnummer, når en fil har ændret sig.
// Kør: node tools/update-sw.js   (gøres automatisk af .githooks/pre-commit)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const swPath = path.join(root, 'sw.js');

const SKIP = [/^\./, /^tools\//, /(^|\/)README\.md$/, /^CNAME$/, /^sw\.js$/];

const files = execSync('git ls-files -z --cached --others --exclude-standard', { cwd: root })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((f) => !SKIP.some((re) => re.test(f)))
  .filter((f) => fs.existsSync(path.join(root, f)))
  .sort();

const hash = crypto.createHash('sha1');
const urls = new Set(['/']);
for (const f of files) {
  hash.update(f).update(fs.readFileSync(path.join(root, f)));
  urls.add('/' + f);
  if (f.endsWith('/index.html')) urls.add('/' + f.slice(0, -'index.html'.length));
}
const version = hash.digest('hex').slice(0, 10);

const block =
  '// <precache> (genereret af tools/update-sw.js - rediger ikke i hånden)\n' +
  `const VERSION = '${version}';\n` +
  'const PRECACHE = ' + JSON.stringify([...urls], null, 2) + ';\n' +
  '// </precache>';

const src = fs.readFileSync(swPath, 'utf8');
const out = src.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, block);
if (out === src) {
  console.log('sw.js er allerede opdateret (version ' + version + ')');
} else {
  fs.writeFileSync(swPath, out);
  console.log('sw.js opdateret: ' + urls.size + ' filer, version ' + version);
}
