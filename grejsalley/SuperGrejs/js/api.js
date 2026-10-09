'use strict';
/* =====================================================================
   SUPER GREJS - api.js
   Lille REST-klient til Super Grejs-backend. Browseren taler KUN med
   API'et - aldrig direkte med databasen.
   Fejl kommer altid tilbage som { status, code, message } med en
   forståelig dansk besked.
   ===================================================================== */
SG.api = (function () {
  const base = SG.config.API_BASE;
  let tokenGetter = () => null;
  let onUnauthorized = () => {};

  class ApiError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function request(method, path, body, opts) {
    opts = opts || {};
    if (!base) throw new ApiError(0, 'not_configured', 'Online-funktioner er ikke sat op for denne side endnu.');
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = tokenGetter();
    if (opts.auth !== false && token) headers.Authorization = 'Bearer ' + token;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 10000);
    let res;
    try {
      res = await fetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch (e) {
      throw new ApiError(0, 'network', e.name === 'AbortError'
        ? 'Serveren svarer ikke. Prøv igen om lidt.'
        : 'Kunne ikke forbinde til serveren. Tjek din forbindelse og prøv igen.');
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* tomt svar */ }
    if (!res.ok) {
      const err = (data && data.error) || {};
      const code = err.code || 'http_' + res.status;
      let msg = err.message;
      if (!msg) {
        if (res.status === 503) msg = 'Serveren kan ikke nå databasen lige nu. Prøv igen om lidt.';
        else if (res.status >= 500) msg = 'Der skete en fejl på serveren.';
        else msg = 'Noget gik galt (' + res.status + ').';
      }
      if (res.status === 401 && opts.auth !== false && token) onUnauthorized(code);
      throw new ApiError(res.status, code, msg);
    }
    return data;
  }

  const enc = encodeURIComponent;
  return {
    ApiError,
    get available() { return !!base; },
    base,
    setTokenGetter(fn) { tokenGetter = fn; },
    setUnauthorizedHandler(fn) { onUnauthorized = fn; },
    health: () => request('GET', '/health', undefined, { auth: false, timeout: 5000 }),
    register: (username, password) => request('POST', '/auth/register', { username, password }, { auth: false }),
    login: (username, password) => request('POST', '/auth/login', { username, password }, { auth: false }),
    logout: () => request('POST', '/auth/logout'),
    me: () => request('GET', '/auth/me'),
    setCharacter: character => request('PUT', '/auth/me/character', { character }),
    progress: () => request('GET', '/progress'),
    setWorld: world => request('PUT', '/progress/world', { world }),
    friends: () => request('GET', '/friends'),
    requests: () => request('GET', '/friends/requests'),
    sendRequest: username => request('POST', '/friends/requests', { username }),
    accept: id => request('POST', `/friends/requests/${enc(id)}/accept`),
    decline: id => request('POST', `/friends/requests/${enc(id)}/decline`),
    cancel: id => request('DELETE', `/friends/requests/${enc(id)}`),
    removeFriend: id => request('DELETE', `/friends/${enc(id)}`),
    search: q => request('GET', `/players/search?q=${enc(q)}`),
    leaderboardFriends: () => request('GET', '/leaderboard/friends'),
    leaderboardGlobal: (limit, offset) => request('GET', `/leaderboard/global?limit=${limit || 50}&offset=${offset || 0}`),
  };
})();
