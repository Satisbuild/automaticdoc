#!/usr/bin/env node
// Starter Grejs Budget på http://localhost:8040/Grejs_Budget/ og åbner browseren.
// Bruges af "Start Grejs Budget.bat". Kræver kun Node.js – ingen pakker.
// (Via localhost virker offline-funktionen; åbnes index.html direkte som fil, virker appen også, men ikke offline.)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.csv': 'text/csv; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function start(port) {
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Ikke fundet'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && port < 8060) start(port + 1);
    else { console.error('Kunne ikke starte serveren:', e.message); process.exit(1); }
  });
  server.listen(port, '127.0.0.1', () => {
    const url = 'http://localhost:' + port + '/Grejs_Budget/';
    console.log('Grejs Budget kører på ' + url + '  (luk vinduet for at stoppe)');
    if (!process.argv.includes('--no-open')) {
      const cmd = process.platform === 'win32' ? 'start "" "' + url + '"' : process.platform === 'darwin' ? 'open "' + url + '"' : 'xdg-open "' + url + '"';
      exec(cmd);
    }
  });
}

start(+process.env.PORT || 8040);
