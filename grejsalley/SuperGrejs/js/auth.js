'use strict';
/* =====================================================================
   SUPER GREJS - auth.js
   Login-session og spillerens progression.

   Session: backend udsteder et kortlivet JWT (standard 12 timer). Det
   gemmes i localStorage sammen med udløbstidspunktet og slettes, når det
   udløber, ved log ud, eller hvis serveren afviser det. Adgangskoden
   gemmes aldrig i browseren.

   Progression: gemmes lokalt pr. profil (gæst eller bruger). Når man er
   logget ind, er serverens highestWorldReached den autoritative værdi for
   ranglisten. En ny verden sendes til serveren, og spillet viser først
   "gemt online", når serveren har bekræftet det.
   ===================================================================== */
SG.auth = (function () {
  const KEY = 'sg_session';
  let session = load();
  const listeners = [];

  function load() {
    const s = SG.util.store.get(KEY, null);
    if (!s || !s.token || !s.expiresAt || Date.parse(s.expiresAt) <= Date.now()) {
      SG.util.store.remove(KEY);
      return null;
    }
    return s;
  }
  function save() {
    if (session) SG.util.store.set(KEY, session);
    else SG.util.store.remove(KEY);
    listeners.forEach(fn => fn(session));
  }

  SG.api.setTokenGetter(() => {
    if (session && Date.parse(session.expiresAt) <= Date.now()) { session = null; save(); }
    return session ? session.token : null;
  });
  SG.api.setUnauthorizedHandler(() => {
    session = null;
    save();
    if (SG.ui && SG.ui.toast) SG.ui.toast('Dit login er udløbet. Log ind igen.');
  });

  async function login(username, password) {
    const r = await SG.api.login(username, password);
    session = { token: r.token, expiresAt: r.expiresAt, user: r.user };
    save();
    return r.user;
  }
  async function register(username, password) {
    const r = await SG.api.register(username, password);
    session = { token: r.token, expiresAt: r.expiresAt, user: r.user };
    save();
    return r.user;
  }
  async function logout() {
    const had = session;
    try { if (had) await SG.api.logout(); } catch (e) { /* log ud lokalt uanset */ }
    session = null;
    save();
  }
  async function refresh() {
    if (!session) return null;
    const r = await SG.api.me();
    session.user = r.user;
    save();
    return r.user;
  }
  function setUser(u) { if (session) { session.user = u; save(); } }

  return {
    get user() { return session ? session.user : null; },
    get loggedIn() { return !!session; },
    login, register, logout, refresh, setUser,
    onChange(fn) { listeners.push(fn); },
  };
})();

/* ---------------- Progression ---------------- */
SG.progress = (function () {
  const LEVELS_PER_WORLD = 4;
  const WORLDS = 8;
  let data = null;
  let key = null;

  function profileKey() {
    const u = SG.auth.user;
    return 'sg_progress_' + (u ? 'u_' + u.id : 'guest');
  }
  function ensure() {
    const k = profileKey();
    if (k !== key || !data) {
      key = k;
      data = Object.assign({ completed: {}, unlockedWorld: 1, pendingWorld: null, gameComplete: false, last: '1-1' }, SG.util.store.get(k, {}));
      data.unlockedWorld = SG.util.clamp(Math.floor(data.unlockedWorld) || 1, 1, WORLDS);
    }
    return data;
  }
  function save() { SG.util.store.set(key, data); }

  const id = (w, k) => `${w}-${k}`;

  function isUnlocked(w, k) {
    const d = ensure();
    if (w < d.unlockedWorld) return true;
    if (w > d.unlockedWorld) return false;
    return k === 1 || !!d.completed[id(w, k - 1)] || !!d.completed[id(w, k)];
  }

  // Kaldes når en bane er gennemført. Returnerer hvad der blev låst op.
  function complete(w, k) {
    const d = ensure();
    d.completed[id(w, k)] = true;
    let newWorld = null;
    let next = null;
    if (k < LEVELS_PER_WORLD) next = id(w, k + 1);
    else if (w < WORLDS) {
      next = id(w + 1, 1);
      if (d.unlockedWorld < w + 1) { d.unlockedWorld = w + 1; newWorld = w + 1; }
    } else {
      d.gameComplete = true;
    }
    d.last = next || id(w, k);
    save();
    return { newWorld, next };
  }

  // Warp-rør fører højst én verden frem
  function warpTo(world) {
    const d = ensure();
    let newWorld = null;
    if (world > d.unlockedWorld && world <= WORLDS) { d.unlockedWorld = world; newWorld = world; }
    d.last = id(world, 1);
    save();
    return newWorld;
  }

  function highestCompletedWorld() {
    const d = ensure();
    let best = 0;
    for (let w = 1; w <= WORLDS; w++) if (d.completed[id(w, 4)] || w < d.unlockedWorld) best = w;
    return best;
  }

  // Serveren er sandhed for ranglisten. Lokal værdi hæves til serverens.
  function applyServer(highest) {
    const d = ensure();
    if (highest > d.unlockedWorld) d.unlockedWorld = highest;
    if (d.pendingWorld && d.pendingWorld <= highest) d.pendingWorld = null;
    save();
  }

  // Sender næste verden til serveren. Serveren accepterer kun +1 ad gangen.
  async function syncWorld() {
    const d = ensure();
    if (!SG.auth.loggedIn) return { status: 'offline' };
    const target = d.unlockedWorld;
    try {
      let r = await SG.api.progress();
      let server = r.highestWorldReached;
      while (server < target) {
        const res = await SG.api.setWorld(server + 1);
        if (res.highestWorldReached <= server) break;
        server = res.highestWorldReached;
      }
      d.pendingWorld = server < target ? target : null;
      if (server > d.unlockedWorld) d.unlockedWorld = server;
      save();
      if (SG.auth.user && SG.auth.user.highestWorldReached !== server) SG.auth.setUser(Object.assign({}, SG.auth.user, { highestWorldReached: server }));
      return { status: server >= target ? 'ok' : 'partial', world: server };
    } catch (e) {
      d.pendingWorld = target;
      save();
      return { status: 'error', error: e };
    }
  }

  return {
    LEVELS_PER_WORLD, WORLDS,
    get data() { return ensure(); },
    reload() { key = null; return ensure(); },
    isUnlocked, isCompleted: (w, k) => !!ensure().completed[id(w, k)],
    complete, warpTo, highestCompletedWorld, applyServer, syncWorld,
    get unlockedWorld() { return ensure().unlockedWorld; },
    get pending() { return ensure().pendingWorld; },
    get last() { return ensure().last; },
    setLast(v) { ensure().last = v; save(); },
  };
})();
