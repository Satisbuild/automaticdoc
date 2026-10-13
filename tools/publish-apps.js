#!/usr/bin/env node
// Lægger nye app-filer fra DelApps/ op som GitHub Releases og opdaterer
// DelApps/apps.json, som download-siden (DelApps/index.html) viser.
//
// Smid bare en fil i DelApps/, fx "Grejs-Game-Library-1.2.0.zip", og commit.
// Navn og version læses ud fra filnavnet (Navn-Med-Bindestreger-1.2.0.zip).
// Beskrivelse, platform og installationstrin kan skrives i DelApps/apps-info.json.
//
// Kør: node tools/publish-apps.js            (gøres automatisk af .githooks/pre-commit)
//      node tools/publish-apps.js --dry-run  (viser hvad der ville ske, uploader intet)
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const appsDir = path.join(root, 'DelApps');
const appsJsonPath = path.join(appsDir, 'apps.json');
const infoPath = path.join(appsDir, 'apps-info.json');
const dryRun = process.argv.includes('--dry-run');

const APP_FILE = /\.(zip|exe|msi)$/i;
const CONTENT_TYPES = { '.zip': 'application/zip', '.exe': 'application/vnd.microsoft.portable-executable', '.msi': 'application/x-msi' };

const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);

function parseFileName(file) {
  const base = file.replace(APP_FILE, '');
  const m = base.match(/^(.*?)[-_ ]v?(\d+(?:\.\d+)+)$/);
  const rawName = m ? m[1] : base;
  const version = m ? m[2] : '1.0.0';
  const name = rawName.replace(/[-_]+/g, ' ').trim();
  const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { name, version, tag: `${slug}-v${version}` };
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${Math.round(bytes / 1024 / 1024)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function githubRepo() {
  const url = execSync('git remote get-url origin', { cwd: root }).toString().trim();
  const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
  if (!m) throw new Error('origin er ikke et GitHub-repo: ' + url);
  return `${m[1]}/${m[2]}`;
}

// Bruger det GitHub-login, git allerede har gemt (Git Credential Manager).
function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const out = execSync('git credential fill', { cwd: root, input: 'protocol=https\nhost=github.com\n\n' }).toString();
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error('Fandt intet gemt GitHub-login i git');
  return m[1].trim();
}

async function api(token, method, url, body, headers = {}) {
  const res = await fetch(url.startsWith('http') ? url : `https://api.github.com${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'publish-apps', ...headers },
    body,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function upload(token, repo, file, meta) {
  let release = await api(token, 'GET', `/repos/${repo}/releases/tags/${encodeURIComponent(meta.tag)}`);
  if (!release) {
    release = await api(token, 'POST', `/repos/${repo}/releases`, JSON.stringify({
      tag_name: meta.tag,
      name: `${meta.name} ${meta.version}`,
      body: `${meta.name} version ${meta.version}. Hentes fra Grejs Apps på automatikhelp.com.`,
    }), { 'Content-Type': 'application/json' });
  }
  const existing = (release.assets || []).find((a) => a.name === file);
  if (existing) return existing.browser_download_url;

  const data = fs.readFileSync(path.join(appsDir, file));
  const uploadUrl = release.upload_url.replace(/\{.*\}$/, '') + '?name=' + encodeURIComponent(file);
  const asset = await api(token, 'POST', uploadUrl, data, {
    'Content-Type': CONTENT_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': String(data.length),
  });
  return asset.browser_download_url;
}

async function main() {
  if (!fs.existsSync(appsDir)) return;
  const known = readJson(appsJsonPath, []);
  const info = readJson(infoPath, {});
  const files = fs.readdirSync(appsDir).filter((f) => APP_FILE.test(f));

  // Behold apps fra apps.json, også selvom filen ikke ligger lokalt (filerne er ikke i git).
  const byFile = new Map(known.map((a) => [a.file, a]));
  let token, repo;

  for (const file of files) {
    const size = fs.statSync(path.join(appsDir, file)).size;
    const prev = byFile.get(file);
    if (prev && prev.bytes === size) continue;

    const meta = parseFileName(file);
    console.log(`publish-apps: ${file} -> release "${meta.tag}" (${formatSize(size)})`);
    if (dryRun) continue;
    try {
      token = token || githubToken();
      repo = repo || githubRepo();
      const url = await upload(token, repo, file, meta);
      byFile.set(file, { file, name: meta.name, version: meta.version, bytes: size, size: formatSize(size), url });
      console.log(`publish-apps: uploadet ${file}`);
    } catch (e) {
      console.warn(`publish-apps: kunne ikke uploade ${file} - prøver igen ved næste commit.\n  ${e.message}`);
    }
  }

  // Vis kun nyeste version af hver app, og flet beskrivelser fra apps-info.json ind.
  const newest = new Map();
  for (const app of byFile.values()) {
    const cur = newest.get(app.name);
    if (!cur || compareVersions(app.version, cur.version) > 0) newest.set(app.name, app);
  }
  const apps = [...byFile.values()]
    .sort((a, b) => a.name.localeCompare(b.name) || compareVersions(b.version, a.version))
    .map((a) => ({ ...a, latest: newest.get(a.name) === a, ...(info[a.name] || {}) }));

  const out = JSON.stringify(apps, null, 2) + '\n';
  if (!dryRun && out !== (fs.existsSync(appsJsonPath) ? fs.readFileSync(appsJsonPath, 'utf8') : '')) {
    fs.writeFileSync(appsJsonPath, out);
    console.log(`publish-apps: apps.json opdateret (${apps.length} filer)`);
  }
}

main().catch((e) => {
  // Et upload-problem må aldrig blokere en commit.
  console.warn('publish-apps: ' + e.message);
});
