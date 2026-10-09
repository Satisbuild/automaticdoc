'use strict';
/* =====================================================================
   GREJS BASE BUILDER - core.js (config, helpers, icons, network, sound, modals)
   ---------------------------------------------------------------------
   Online only. Every game rule runs on the server (grejsbase/ in the
   backend repo); this page draws, collects input and sends intents.
   GBData (game data) and GBSim (battle simulation) are loaded from the
   server itself, so the browser always runs the exact code the server
   uses to judge battles.

   Test against a local server:
     localStorage.setItem('baseCloudApi', 'http://localhost:3000/base')
   ===================================================================== */

const PROD_API = 'https://grejsdata.systematisk.dk/base';
const API = (function () {
  let b = PROD_API;
  try { const o = localStorage.getItem('baseCloudApi'); if (o) b = o; } catch (e) { /* ignore */ }
  return b.trim().replace(/\/+$/, '');
})();

let D = null;     // GBData, after load
let GBSim = null; // GBSim, after load

/* =====================================================================
   SMALL HELPERS
   ===================================================================== */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
function fmt(n) {
  n = Math.floor(n || 0);
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
  return n.toLocaleString('en-US');
}
function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec >= 86400) return Math.floor(sec / 86400) + 'd ' + Math.floor(sec % 86400 / 3600) + 'h';
  if (sec >= 3600) return Math.floor(sec / 3600) + 'h ' + Math.floor(sec % 3600 / 60) + 'm';
  if (sec >= 60) return Math.floor(sec / 60) + 'm ' + (sec % 60 ? (sec % 60) + 's' : '');
  return sec + 's';
}
function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return Math.floor(s / 86400) + ' d ago';
}
/* Accepts '#rgb', '#rrggbb' and 'rgb(r,g,b)' - shade() output can be shaded again. */
const _rgbCache = new Map();
function toRgb(col) {
  let v = _rgbCache.get(col);
  if (v) return v;
  if (col[0] === '#') {
    let c = col.slice(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    v = [n >> 16, (n >> 8) & 255, n & 255];
  } else {
    const m = col.match(/[\d.]+/g) || [0, 0, 0];
    v = [+m[0], +m[1], +m[2]];
  }
  _rgbCache.set(col, v);
  return v;
}
function shade(col, amt) {
  let [r, g, b] = toRgb(col);
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}
function rgba(col, a) { const [r, g, b] = toRgb(col); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
function mix(a, b, k) { const p = toRgb(a), q = toRgb(b); return 'rgb(' + ((p[0] + (q[0] - p[0]) * k) | 0) + ',' + ((p[1] + (q[1] - p[1]) * k) | 0) + ',' + ((p[2] + (q[2] - p[2]) * k) | 0) + ')'; }
const serverNow = () => Date.now() + S.clockOff;

/* =====================================================================
   ICONS (inline SVG)
   ===================================================================== */
const ICONS = {
  gold: '<svg viewBox="0 0 32 32"><circle cx="16" cy="17" r="12" fill="#b8740a"/><circle cx="16" cy="15" r="12" fill="#ffd23f" stroke="#8a5005" stroke-width="2"/><circle cx="16" cy="15" r="7.5" fill="none" stroke="#e8a40c" stroke-width="2"/><path d="M12 10a8 8 0 0 1 6-2" stroke="#fff6c0" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  elixir: '<svg viewBox="0 0 32 32"><path d="M16 3C16 3 6 15 6 21a10 10 0 0 0 20 0C26 15 16 3 16 3Z" fill="#d64bff" stroke="#5a0a7a" stroke-width="2"/><path d="M11 20a5 5 0 0 0 3 5" stroke="#ffd0ff" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>',
  dark: '<svg viewBox="0 0 32 32"><path d="M16 3C16 3 6 15 6 21a10 10 0 0 0 20 0C26 15 16 3 16 3Z" fill="#3a2468" stroke="#120626" stroke-width="2"/><path d="M11 20a5 5 0 0 0 3 5" stroke="#a080e0" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>',
  shiny: '<svg viewBox="0 0 32 32"><path d="M16 3 27 12 16 29 5 12Z" fill="#c8d8e8" stroke="#4a5a6a" stroke-width="2"/><path d="M5 12h22M16 3l-4 9 4 17 4-17z" stroke="#4a5a6a" stroke-width="1.2" fill="none"/></svg>',
  glowy: '<svg viewBox="0 0 32 32"><path d="M16 3 27 12 16 29 5 12Z" fill="#7fd4ff" stroke="#0a4a7a" stroke-width="2"/><path d="M5 12h22M16 3l-4 9 4 17 4-17z" stroke="#0a4a7a" stroke-width="1.2" fill="none"/></svg>',
  starry: '<svg viewBox="0 0 32 32"><path d="M16 3 27 12 16 29 5 12Z" fill="#ffb3f0" stroke="#7a0a6a" stroke-width="2"/><path d="m16 9 1.5 3.5 3.5.5-2.6 2.4.7 3.6L16 17.2 12.9 19l.7-3.6L11 13l3.5-.5z" fill="#fff"/></svg>',
  trophy: '<svg viewBox="0 0 32 32"><path d="M9 4h14v7a7 7 0 0 1-14 0Z" fill="#ffd23f" stroke="#8a5005" stroke-width="2"/><path d="M9 7H4a5 5 0 0 0 5 6M23 7h5a5 5 0 0 1-5 6" fill="none" stroke="#8a5005" stroke-width="2"/><path d="M14 18h4v5h-4zM10 24h12v4H10z" fill="#e8a40c" stroke="#8a5005" stroke-width="2"/></svg>',
  star: '<svg viewBox="0 0 32 32" class="star"><path d="m16 2 4.2 8.6 9.4 1.4-6.8 6.6 1.6 9.4L16 23.6 7.6 28l1.6-9.4L2.4 12l9.4-1.4z" fill="#ffd23f" stroke="#8a5005" stroke-width="2" stroke-linejoin="round"/></svg>',
  starOff: '<svg viewBox="0 0 32 32" class="star"><path d="m16 2 4.2 8.6 9.4 1.4-6.8 6.6 1.6 9.4L16 23.6 7.6 28l1.6-9.4L2.4 12l9.4-1.4z" fill="#4a3a2a" stroke="#1a0e05" stroke-width="2" stroke-linejoin="round"/></svg>',
  shield: '<svg viewBox="0 0 32 32"><path d="M16 3 27 7v8c0 7-5 12-11 14C10 27 5 22 5 15V7Z" fill="#7fd4ff" stroke="#0a3a60" stroke-width="2"/><path d="M16 7v18" stroke="#fff" stroke-width="2" opacity=".6"/></svg>',
  builder: '<svg viewBox="0 0 32 32"><circle cx="16" cy="13" r="7" fill="#f2c08a" stroke="#5a3010" stroke-width="2"/><path d="M8 12a8 8 0 0 1 16 0z" fill="#ffcf3a" stroke="#5a3010" stroke-width="2"/><path d="M9 29a7 7 0 0 1 14 0z" fill="#2a6fd0" stroke="#5a3010" stroke-width="2"/></svg>',
  clock: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#fff" stroke="#3a2410" stroke-width="2.5"/><path d="M16 9v7l5 3" stroke="#3a2410" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>',
  attack: '<svg viewBox="0 0 48 48"><path d="M8 6 30 28l-4 4L4 10V6Z" fill="#e8eef5" stroke="#1a1a24" stroke-width="2.5"/><path d="M40 6 18 28l4 4L44 10V6Z" fill="#e8eef5" stroke="#1a1a24" stroke-width="2.5"/><path d="m24 30 6 6-4 4-6-6M24 30l-6 6 4 4 6-6" fill="#c0521a" stroke="#1a1a24" stroke-width="2.5"/><path d="M10 38l4 4M38 38l-4 4" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"/></svg>',
  swords: '<svg viewBox="0 0 32 32"><path d="M5 4 20 19l-3 3L3 8V4Z" fill="#e8eef5" stroke="#1a1a24" stroke-width="2"/><path d="m16 21 4 4-3 3-4-4" fill="#c0521a" stroke="#1a1a24" stroke-width="2"/><circle cx="24" cy="10" r="6" fill="#ff6a3a" stroke="#1a1a24" stroke-width="2"/><path d="M21 10h6M24 7v6" stroke="#fff" stroke-width="2"/></svg>',
  crown: '<svg viewBox="0 0 32 32"><path d="M4 11 10 17 16 6l6 11 6-6-3 15H7Z" fill="#ffd23f" stroke="#6a3a05" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="19" r="2.5" fill="#ff4d5a"/><path d="M7 26h18" stroke="#6a3a05" stroke-width="3"/></svg>',
  map: '<svg viewBox="0 0 32 32"><path d="M4 7l8-3 8 3 8-3v21l-8 3-8-3-8 3Z" fill="#f7e6c4" stroke="#5a3a10" stroke-width="2" stroke-linejoin="round"/><path d="M12 4v21M20 7v21" stroke="#5a3a10" stroke-width="1.5"/><path d="m22 12 4 4m0-4-4 4" stroke="#e04030" stroke-width="2.5" stroke-linecap="round"/></svg>',
  hammer: '<svg viewBox="0 0 32 32"><path d="M6 8h14l4 4H20v4H10V12H6Z" fill="#9aa3ad" stroke="#1a1a24" stroke-width="2" stroke-linejoin="round"/><path d="M14 16h4v13h-4z" fill="#b07a45" stroke="#1a1a24" stroke-width="2"/></svg>',
  scroll: '<svg viewBox="0 0 32 32"><path d="M8 5h17v20a3 3 0 0 1-3 3H8z" fill="#f7e6c4" stroke="#5a3a10" stroke-width="2"/><path d="M12 11h9M12 15h9M12 19h6" stroke="#5a3a10" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="25" r="3" fill="#d4a060" stroke="#5a3a10" stroke-width="2"/></svg>',
  gear: '<svg viewBox="0 0 32 32"><path d="M16 4l3 1 1 3 3 1 3-1 2 3-2 3v3l2 3-2 3-3-1-3 1-1 3-3 1-3-1-1-3-3-1-3 1-2-3 2-3v-3L4 9l2-3 3 1 3-1 1-3z" fill="#c8d0d8" stroke="#2a2a34" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="16" r="4.5" fill="#5a6270" stroke="#2a2a34" stroke-width="2"/></svg>',
  up: '<svg viewBox="0 0 32 32"><path d="M16 3 28 16h-7v12h-10V16H4Z" fill="#5dd23b" stroke="#1a4a0a" stroke-width="2.5" stroke-linejoin="round"/></svg>',
  move: '<svg viewBox="0 0 32 32"><path d="M16 3l5 5h-3v6h6v-3l5 5-5 5v-3h-6v6h3l-5 5-5-5h3v-6H8v3l-5-5 5-5v3h6V8h-3z" fill="#fff" stroke="#1a1a24" stroke-width="2" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#45b8ff" stroke="#0a3a60" stroke-width="2.5"/><path d="M16 14v9" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="16" cy="9.5" r="2.2" fill="#fff"/></svg>',
  x: '<svg viewBox="0 0 32 32"><path d="M8 8l16 16M24 8 8 24" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 32 32"><path d="m6 17 7 7L26 9" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flask: '<svg viewBox="0 0 32 32"><path d="M12 4h8v8l7 12a3 3 0 0 1-3 4H8a3 3 0 0 1-3-4l7-12Z" fill="#e8f4ff" stroke="#1a2a3a" stroke-width="2"/><path d="M8 21h16l2 4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" fill="#45b8ff"/></svg>',
  people: '<svg viewBox="0 0 32 32"><circle cx="11" cy="11" r="5" fill="#f2c08a" stroke="#3a2410" stroke-width="2"/><circle cx="22" cy="12" r="4" fill="#f2c08a" stroke="#3a2410" stroke-width="2"/><path d="M3 27a8 8 0 0 1 16 0zM16 27a6 6 0 0 1 13 0z" fill="#45b8ff" stroke="#3a2410" stroke-width="2"/></svg>',
  eye: '<svg viewBox="0 0 32 32"><path d="M3 16s5-9 13-9 13 9 13 9-5 9-13 9S3 16 3 16Z" fill="#fff" stroke="#1a1a24" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#45b8ff" stroke="#1a1a24" stroke-width="2"/></svg>',
  back: '<svg viewBox="0 0 32 32"><path d="M14 6 4 16l10 10v-6h8a6 6 0 0 1 6 6v0a12 12 0 0 0-12-14h-2Z" fill="#fff" stroke="#1a1a24" stroke-width="2.5" stroke-linejoin="round"/></svg>',
  dice: '<svg viewBox="0 0 32 32"><rect x="5" y="5" width="22" height="22" rx="5" fill="#fff" stroke="#1a1a24" stroke-width="2.5"/><circle cx="11" cy="11" r="2.3"/><circle cx="21" cy="21" r="2.3"/><circle cx="16" cy="16" r="2.3"/><circle cx="21" cy="11" r="2.3"/><circle cx="11" cy="21" r="2.3"/></svg>',
};
const RICON = { gold: 'gold', elixir: 'elixir', dark: 'dark', shiny: 'shiny', glowy: 'glowy', starry: 'starry' };
const icon = (n, cls) => '<span class="ico ' + (cls || '') + '">' + (ICONS[n] || '') + '</span>';
function paintIcons(root) {
  for (const e of $$('[data-icon]', root)) { if (!e.dataset.painted) { e.innerHTML = ICONS[e.dataset.icon] || ''; e.dataset.painted = '1'; } }
}
function starsHtml(n, max) { let s = ''; for (let i = 0; i < (max || 3); i++) s += i < n ? ICONS.star : ICONS.starOff; return '<span class="stars">' + s + '</span>'; }
const costHtml = (r, a) => '<span class="cost">' + icon(r) + fmt(a) + '</span>';

/* =====================================================================
   SETTINGS (harmless local preferences only - progress lives on the server)
   ===================================================================== */
const SET = Object.assign({ sound: 0.7, music: 0.35, quality: 'high', shake: true, numbers: true }, (function () {
  try { return JSON.parse(localStorage.getItem('gbbSettings')) || {}; } catch (e) { return {}; }
})());
function saveSettings() { try { localStorage.setItem('gbbSettings', JSON.stringify(SET)); } catch (e) { /* ignore */ } }

/* =====================================================================
   STATE
   ===================================================================== */
const S = {
  me: null, meAt: 0, clockOff: 0,
  scene: 'home',          // home | battle | replay
  online: 0, unseen: 0,
  refreshAt: 0, refreshing: false,
};

/* =====================================================================
   NETWORK
   ===================================================================== */
const TOKEN_KEY = 'gbbToken';
const Net = {
  token: null,
  load() {
    try { this.token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null; } catch (e) { this.token = null; }
  },
  save(t, remember) {
    this.token = t;
    try {
      localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
      if (t) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
    } catch (e) { /* ignore */ }
  },
  async call(method, path, body) {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h.Authorization = 'Bearer ' + this.token;
    let r;
    try {
      r = await fetch(API + '/api' + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      const err = new Error('Cannot reach the Grejs server'); err.code = 'offline'; throw err;
    }
    let j = null;
    try { j = await r.json(); } catch (e) { /* ignore */ }
    if (!r.ok) {
      const err = new Error((j && j.error) || ('Server error ' + r.status));
      err.code = j && j.code; err.status = r.status;
      if (r.status === 401 && this.token && !path.startsWith('/auth/')) { setTimeout(() => App.loggedOut('Your session expired - please log in again'), 0); }
      throw err;
    }
    return j;
  },
  get(p) { return this.call('GET', p); },
  post(p, b) { return this.call('POST', p, b || {}); },
};

/* Village action: send intent, take the server's state, report errors. */
async function act(route, body, okMsg) {
  try {
    const j = await Net.post('/' + route, body);
    setMe(j.me);
    if (okMsg) toast(okMsg, 'good');
    return j.result || true;
  } catch (e) {
    Sound.play('error');
    toast(e.message, 'bad');
    return null;
  }
}

/* =====================================================================
   SOUND (synthesised with Web Audio - no files)
   ===================================================================== */
const Sound = (function () {
  let ctx = null, master = null, sfx = null, mus = null, noiseBuf = null, musicTimer = null, last = {};
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    mus = ctx.createGain(); mus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    volumes();
    startMusic();
  }
  function volumes() { if (!ctx) return; sfx.gain.value = SET.sound; mus.gain.value = SET.music * 0.5; }
  function tone(type, f0, f1, dur, vol, delay) {
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, q, delay, type) {
    const t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const SFX = {
    click: () => tone('triangle', 660, 880, 0.07, 0.25),
    open: () => { tone('sine', 520, 780, 0.12, 0.2); tone('sine', 780, 1040, 0.1, 0.12, 0.05); },
    error: () => { tone('square', 220, 180, 0.15, 0.12); tone('square', 180, 140, 0.18, 0.12, 0.1); },
    place: () => { noise(0.18, 0.5, 600, 1); tone('sine', 160, 70, 0.2, 0.4); },
    build: () => { for (let i = 0; i < 3; i++) { tone('square', 900, 700, 0.04, 0.12, i * 0.09); noise(0.05, 0.3, 3000, 2, i * 0.09, 'bandpass'); } },
    done: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, 0, 0.25, 0.22, i * 0.08)); },
    coin: () => { tone('square', 1200, 1800, 0.06, 0.1); tone('square', 1800, 2400, 0.08, 0.08, 0.05); },
    deploy: () => { tone('sine', 300, 600, 0.08, 0.25); noise(0.06, 0.2, 2000, 1); },
    spell: () => { tone('sawtooth', 200, 1200, 0.35, 0.12); noise(0.4, 0.25, 4000, 3, 0, 'bandpass'); },
    arrow: () => noise(0.09, 0.18, 5000, 4, 0, 'bandpass'),
    cannon: () => { noise(0.3, 0.6, 400, 1); tone('sine', 120, 40, 0.3, 0.5); },
    zap: () => { tone('sawtooth', 1600, 200, 0.15, 0.12); noise(0.12, 0.2, 6000, 2, 0, 'highpass'); },
    magic: () => { tone('sine', 900, 300, 0.25, 0.15); },
    boom: () => { noise(0.6, 0.8, 300, 0.7); tone('sine', 90, 30, 0.5, 0.6); },
    lightning: () => { noise(0.5, 0.7, 2500, 0.5, 0, 'highpass'); tone('sawtooth', 2000, 80, 0.4, 0.15); },
    hit: () => noise(0.06, 0.25, 1200, 1),
    death: () => tone('triangle', 500, 120, 0.25, 0.15),
    destroy: () => { noise(0.8, 0.7, 500, 0.6); tone('sine', 70, 30, 0.7, 0.5); noise(0.4, 0.3, 2500, 1, 0.15); },
    trap: () => { tone('square', 1500, 1500, 0.05, 0.1); noise(0.5, 0.8, 350, 0.7, 0.05); },
    victory: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, 0, 0.3, 0.22, i * 0.12)); },
    defeat: () => { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, 0, 0.4, 0.2, i * 0.22)); },
    alarm: () => { for (let i = 0; i < 3; i++) { tone('square', 880, 660, 0.18, 0.12, i * 0.25); } },
    star: () => { tone('triangle', 1046, 1568, 0.3, 0.25); noise(0.2, 0.2, 6000, 2, 0, 'highpass'); },
  };
  function play(name) {
    if (!ctx || SET.sound <= 0 || !SFX[name]) return;
    const t = performance.now();
    if (last[name] && t - last[name] < 45) return;   // avoid machine-gun stacking
    last[name] = t;
    try { SFX[name](); } catch (e) { /* ignore */ }
  }
  /* gentle procedural music: pentatonic arpeggio over a soft pad */
  function startMusic() {
    if (musicTimer || !ctx) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const roots = [196, 174.6, 220, 164.8];
    let step = 0;
    musicTimer = setInterval(function () {
      if (!ctx || SET.music <= 0 || document.hidden) return;
      const t = ctx.currentTime;
      const root = roots[Math.floor(step / 16) % roots.length];
      if (step % 16 === 0) {
        for (const m of [1, 1.5, 2]) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = root * m / 2;
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 1); g.gain.linearRampToValueAtTime(0.0001, t + 4.6);
          o.connect(g); g.connect(mus); o.start(t); o.stop(t + 4.8);
        }
      }
      if (Math.random() < (S.scene === 'battle' ? 0.85 : 0.55)) {
        const n = scale[Math.floor(Math.random() * scale.length)];
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = root * Math.pow(2, n / 12) * 2;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.7);
      }
      step++;
    }, 300);
  }
  return { init: init, play: play, volumes: volumes };
})();

/* =====================================================================
   TOASTS + MODALS
   ===================================================================== */
function toast(msg, kind, ms) {
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.innerHTML = msg;
  $('#toasts').appendChild(t);
  paintIcons(t);
  setTimeout(() => t.remove(), ms || (kind === 'attack' ? 5600 : 3100));
}

const Modal = {
  stack: [],
  open(title, html, opts) {
    opts = opts || {};
    const w = document.createElement('div');
    w.className = 'modal-wrap';
    w.innerHTML = '<div class="modal ' + (opts.size || '') + '"><div class="modal-head"><h2>' + title + '</h2><button class="btn xbtn" data-close>✕</button></div>' +
      (opts.tabs ? '<div class="tabs">' + opts.tabs.map(t => '<button class="tab' + (t[0] === opts.tab ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' : '') +
      '<div class="modal-body">' + html + '</div></div>';
    w.addEventListener('pointerdown', e => { if (e.target === w) Modal.close(w); });
    w.querySelector('[data-close]').onclick = () => { Sound.play('click'); Modal.close(w); };
    $('#modals').appendChild(w);
    paintIcons(w);
    this.stack.push({ el: w, onClose: opts.onClose });
    Sound.play('open');
    return w;
  },
  body(w) { return w.querySelector('.modal-body'); },
  setBody(w, html) { const b = this.body(w); const st = b.scrollTop; b.innerHTML = html; paintIcons(b); b.scrollTop = st; },
  close(w) {
    const i = this.stack.findIndex(m => m.el === w);
    if (i < 0) return;
    const m = this.stack.splice(i, 1)[0];
    m.el.remove();
    if (m.onClose) m.onClose();
  },
  closeAll() { while (this.stack.length) this.close(this.stack[this.stack.length - 1].el); },
  top() { return this.stack.length ? this.stack[this.stack.length - 1].el : null; },
};
function confirmBox(title, html, okLabel, okClass) {
  return new Promise(function (resolve) {
    const w = Modal.open(title, '<div class="center" style="font-weight:800;line-height:1.5">' + html + '</div><div class="row" style="justify-content:center;margin-top:1em;gap:1em"><button class="btn grey" data-no>CANCEL</button><button class="btn ' + (okClass || '') + '" data-yes>' + (okLabel || 'OK') + '</button></div>', { size: 'narrow', onClose: () => resolve(false) });
    w.querySelector('[data-yes]').onclick = () => { resolve(true); Modal.close(w); };
    w.querySelector('[data-no]').onclick = () => Modal.close(w);
  });
}
