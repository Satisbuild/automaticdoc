/* =====================================================================
 * GREJS TANKS - cloud.js
 * Optional account (name + pin), cloud save and leaderboards, served by
 * the Grejs backend (tanks.js on the server, see TANKS-API.md).
 * Everything here is best-effort: without an account, or while the
 * server is unreachable, the game keeps playing from localStorage.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;

  // The game calls CLOUD_API + '/api/...'. '' = local only, no network.
  // Test: localStorage.setItem('tanksCloudApi', 'http://localhost:3000/tanks')
  const CLOUD_API = 'https://grejsdata.systematisk.dk/tanks';
  const API = (() => {
    let b = CLOUD_API;
    try { const o = localStorage.getItem('tanksCloudApi'); if (o !== null) b = o; } catch (e) { /* ignore */ }
    return b.trim().replace(/\/+$/, '');
  })();
  const ACCT_KEY = 'grejsTanksAccount';
  const PUSH_EVERY = 20000; // at most one upload per 20s while playing

  let acct = null;
  try { acct = JSON.parse(localStorage.getItem(ACCT_KEY)); } catch (e) { /* ignore */ }
  if (!acct || !acct.token || !acct.name) acct = null;

  // `synced` stays false until this device has compared its save with the
  // cloud copy. Until then nothing is uploaded, so a stale device that
  // boots offline can never overwrite progress made elsewhere.
  // main.js runs the first startup() after boot; schedule() only retries it.
  let synced = false, busy = false, lastPush = 0, timer = null, lastTry = Date.now();

  // Fingerprint of the save the cloud is known to hold. Only a real change
  // is uploaded - Save.save() also runs on every page unload, and a stale
  // tab being closed must not push its old copy over newer progress.
  // savedAt and settings are left out: they change without any progress.
  let uploaded = '';
  const fingerprint = (d) => JSON.stringify(Object.assign({}, d, { savedAt: 0, settings: 0 }));
  const changed = () => fingerprint(GT.Save.data) !== uploaded;

  /** progress of a save object, compared lexicographically */
  function progress(d) {
    let stars = 0;
    for (const k in d.stars || {}) stars += d.stars[k] || 0;
    return [stars, Object.keys(d.completed || {}).length, (d.unlockedTanks || []).length, d.xp || 0];
  }
  function cmp(a, b) {
    const pa = progress(a), pb = progress(b);
    for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
  }
  function parse(str) {
    try {
      const d = str ? JSON.parse(str) : null;
      return d && typeof d === 'object' && 'coins' in d ? d : null;
    } catch (e) {
      return null;
    }
  }

  const Cloud = (GT.Cloud = {
    enabled: !!API,
    status: '',
    get account() {
      return acct;
    },

    setAccount(a) {
      acct = a;
      try { a ? localStorage.setItem(ACCT_KEY, JSON.stringify(a)) : localStorage.removeItem(ACCT_KEY); } catch (e) { /* ignore */ }
    },

    async api(path, opt) {
      opt = opt || {};
      if (!API) throw Object.assign(new Error('Online features are switched off in this version'), { offline: true });
      const ctl = new AbortController();
      const tm = setTimeout(() => ctl.abort(), 10000);
      let r;
      try {
        r = await fetch(API + path, {
          method: opt.method || 'GET',
          signal: ctl.signal,
          body: opt.body ? JSON.stringify(opt.body) : undefined,
          headers: Object.assign(opt.body ? { 'Content-Type': 'application/json' } : {}, acct && !opt.noAuth ? { Authorization: 'Bearer ' + acct.token } : {})
        });
      } catch (e) {
        throw Object.assign(new Error('Cannot reach the server'), { offline: true });
      } finally {
        clearTimeout(tm);
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 401 && acct && !opt.noAuth) this.signedOut();
        throw Object.assign(new Error(d.error || 'Server error (' + r.status + ')'), { status: r.status });
      }
      return d;
    },

    signedOut() {
      this.setAccount(null);
      synced = false;
      this.status = '';
      if (GT.UI) GT.UI.toast('☁️', 'You were logged out', 'Log in again on the Leaderboard screen');
    },

    /** Replace local progress with a cloud save, keeping this device's settings. */
    useCloud(c) {
      const settings = GT.Save.data.settings;
      GT.Save.data = GT.Save.merge(GT.Save.defaults(), c);
      GT.Save.data.settings = settings;
      synced = true;
      GT.Save.validate(); // also saves locally
      GT.Progress.autoUnlockTanks();
      uploaded = fingerprint(GT.Save.data);
      if (GT.UI && GT.UI.current) GT.UI.home();
    },

    /** Called from Save.save(): queue an upload. */
    schedule() {
      if (!acct || !API) return;
      if (!synced) {
        // still waiting for the first comparison - retry it, not an upload
        if (!busy && Date.now() - lastTry > 30000) this.startup();
        return;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        this.push();
      }, Math.max(0, lastPush + PUSH_EVERY - Date.now()));
    },

    /** Upload the save if it changed since the last upload (or always, with force). */
    async push(force) {
      if (!acct || !synced || busy) return;
      const fp = fingerprint(GT.Save.data);
      if (!force && fp === uploaded) return;
      busy = true;
      lastPush = Date.now();
      try {
        await this.api('/api/save', { method: 'PUT', body: { save: JSON.stringify(GT.Save.data) } });
        uploaded = fp;
        this.status = '☁️ Saved to the cloud at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        this.status = '⚠️ ' + e.message;
      } finally {
        busy = false;
      }
      if (changed()) this.schedule(); // progress made while the upload was in flight
    },

    /** Page is closing or hidden: fetch may be cut off, sendBeacon is not. */
    beacon() {
      if (!acct || !synced || !API || !navigator.sendBeacon || !changed()) return;
      try {
        const body = JSON.stringify({ token: acct.token, save: JSON.stringify(GT.Save.data) });
        if (navigator.sendBeacon(API + '/api/save', new Blob([body], { type: 'text/plain' }))) uploaded = fingerprint(GT.Save.data);
      } catch (e) { /* ignore */ }
    },

    /** On boot (and on retry): compare with the cloud copy and keep the one with more progress. */
    async startup() {
      if (!acct || !API || busy) return;
      busy = true;
      lastTry = Date.now();
      let c = null;
      try {
        c = parse((await this.api('/api/save')).save);
      } catch (e) {
        this.status = '⚠️ ' + e.message;
        busy = false;
        return;
      }
      busy = false;
      const L = GT.Save.data;
      const diff = c ? cmp(c, L) : -1;
      if (c && (diff > 0 || (diff === 0 && (c.savedAt || 0) > (L.savedAt || 0) + 5000))) {
        this.useCloud(c);
        if (GT.UI) GT.UI.toast('☁️', 'Progress loaded from the cloud', 'Welcome back, ' + acct.name + '!');
      } else {
        synced = true;
        if (c) uploaded = fingerprint(c);
        await this.push(); // only uploads when this device differs from the cloud
      }
    },

    async register(name, pin) {
      const d = await this.api('/api/register', { method: 'POST', noAuth: true, body: { name, pin, save: JSON.stringify(GT.Save.data) } });
      this.setAccount({ name: d.name, token: d.token });
      synced = true;
      uploaded = fingerprint(GT.Save.data);
      lastPush = Date.now();
      this.status = '☁️ Your progress is now saved in the cloud';
      return d;
    },

    /** Logs in. Returns { cloud, localBetter } so the UI can ask which save to keep. */
    async login(name, pin) {
      const d = await this.api('/api/login', { method: 'POST', noAuth: true, body: { name, pin } });
      this.setAccount({ name: d.name, token: d.token });
      synced = false;
      const c = parse(d.save);
      return { name: d.name, cloud: c, localBetter: !c || cmp(GT.Save.data, c) > 0 };
    },

    /** After login: keep this device's progress and upload it. */
    async keepLocal() {
      synced = true;
      await this.push(true);
    },

    async logout() {
      if (synced) await this.push();
      this.api('/api/logout', { method: 'POST', body: {} }).catch(() => {});
      this.setAccount(null);
      synced = false;
      this.status = '';
    },

    leaderboard(by) {
      return this.api('/api/leaderboard?by=' + encodeURIComponent(by) + '&limit=50');
    }
  });

  window.addEventListener('pagehide', () => Cloud.beacon());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Cloud.beacon();
  });

  // Progress made offline: upload as soon as the server can be reached again.
  // Until this device has compared with the cloud (synced), retry that first.
  function retry() {
    if (!acct || !API || busy) return;
    if (!synced) Cloud.startup();
    else if (changed()) Cloud.push();
  }
  window.addEventListener('online', retry);
  setInterval(retry, 60000);
})();

