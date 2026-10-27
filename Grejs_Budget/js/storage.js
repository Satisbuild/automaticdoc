// Lokal lagring i IndexedDB (databasen "grejsbudget"). Intet sendes til en server.
//
// Appen arbejder på en kopi i hukommelsen (GB.store.data) og skriver kun de poster, der
// ændres, igennem til IndexedDB. Fejler en skrivning, vises en fejl, og appen advarer,
// hvis fanen lukkes, før ændringerne er gemt.
//
// Datamodellens version ligger i meta "schema". Nye versioner får en migration i MIGRATIONS,
// som køres automatisk ved opstart (og ved gendannelse af en ældre sikkerhedskopi).

(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});

  const DB_NAME = 'grejsbudget';
  const DB_VERSION = 1;
  const SCHEMA = 4;
  const STORES = ['transactions', 'accounts', 'categories', 'rules', 'budgets', 'periodBudgets', 'recurring', 'goals', 'batches'];

  const DEFAULT_SETTINGS = {
    theme: 'system',
    defaultPeriod: 'this-month',
    defaultAccount: 'all',
    numberFormat: 'da',
    thresholds: { notice: 70, warn: 90 },
    calcRules: { refundsOffset: true, cashAsExpense: true, savingsAsExpense: false },
    disabledBuiltinRules: [],
    askRuleOnCategoryChange: true,
    pageSize: 100,
    onboarded: false,
    lastBackupAt: null,
  };

  // Migrationer: { [nyVersion]: (data) => void }. Køres i rækkefølge fra den gemte version.
  const MIGRATIONS = {
    // 2: Ny underkategori "MobilePay" under Andre poster. MobilePay-udgifter, som appen selv har
    //    kategoriseret (ikke dine manuelle valg eller egne regler), flyttes til den.
    2(d) {
      const C = GB.categories;
      if (!d.categories.length || d.categories.some((c) => c.id === 'other-mobilepay')) return;
      const cat = C.defaultCategories().find((c) => c.id === 'other-mobilepay');
      const group = d.categories.find((c) => c.id === 'other');
      if (!group) return;
      d.categories.push(Object.assign({}, cat, { color: group.color, kind: 'expense' }));
      moveMobilePay(d, (t) => t.amount < 0);
    },
    // 3: MobilePay bliver en blandet kategori: penge ud er forbrug, penge ind er indtægt.
    //    Modtaget MobilePay, som appen selv har kategoriseret, flyttes også til den.
    //    Har brugeren selv ændret kategoriens type, røres typen ikke.
    3(d) {
      const cat = d.categories.find((c) => c.id === 'other-mobilepay');
      if (!cat) return;
      if (cat.kind === 'expense') cat.kind = 'mixed';
      moveMobilePay(d, (t) => t.amount > 0);
    },
    // 4: Indbyggede regler får faste id'er (før: placering i listen), og nye sikre regler
    //    (fx SUNSET, COCCO BELLO, LEGO, NemBilvask) bruges på transaktioner, der var ukendte
    //    eller kun havde et forslag. Manuelle valg og egne regler røres ikke.
    4(d, s, from) {
      const C = GB.categories;
      const map = (id) => C.legacyRuleId(id, from);
      if (Array.isArray(s.disabledBuiltinRules)) s.disabledBuiltinRules = s.disabledBuiltinRules.map(map).filter(Boolean);
      for (const t of d.transactions) if (t.categoryRuleId && /^builtin-\d+$/.test(t.categoryRuleId)) t.categoryRuleId = map(t.categoryRuleId);
      if (!d.categories.length) return;
      const ctx = C.makeContext([], d.categories, s.disabledBuiltinRules);
      for (const t of d.transactions) {
        if (t.categorySource !== 'unknown' && t.categorySource !== 'suggested') continue;
        const sg = C.suggest(t, ctx);
        if (sg.categorySource !== 'default') continue;
        Object.assign(t, sg, { categoryReason: sg.reason });
        delete t.reason;
      }
    },
  };

  // Flytter MobilePay-transaktioner, som appen selv har kategoriseret, til kategorien MobilePay.
  // Manuelle valg, egne regler og sikre indbyggede match (fx "MobilePay NETTO" = Supermarked) bevares.
  function moveMobilePay(d, which) {
    const C = GB.categories;
    const rule = C.BUILTIN_RULES.find((r) => r.categoryId === 'other-mobilepay');
    for (const t of d.transactions) {
      if (!which(t) || !['unknown', 'suggested'].includes(t.categorySource)) continue;
      const text = t.descriptionNormalized || C.normalizeDescription(t.description);
      if (!/(^|[^A-ZÆØÅ])MOBILE ?PAY/.test(text)) continue;
      Object.assign(t, { categoryId: 'other-mobilepay', categorySource: 'default', categoryRuleId: rule.id, categoryReason: 'Indbygget regel: teksten indeholder "MOBILEPAY"' });
    }
  }

  const data = {};
  const byId = {};
  for (const s of STORES) { data[s] = []; byId[s] = new Map(); }
  let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  let db = null;
  let backend = 'none';
  let pending = 0;
  let failed = false;
  let lastError = null;
  const listeners = new Set();
  let channel = null;

  function emit(type, detail) { for (const fn of listeners) { try { fn(type, detail); } catch (e) { console.error(e); } } }

  function openDb() {
    return new Promise((resolve, reject) => {
      let idb;
      try { idb = globalThis.indexedDB; } catch (e) { idb = null; }
      if (!idb) { reject(new Error('Browseren understøtter ikke lokal lagring (IndexedDB).')); return; }
      const timer = setTimeout(() => reject(new Error('Den lokale database svarer ikke. Luk andre faner med Grejs Budget og prøv igen.')), 5000);
      let req;
      try { req = idb.open(DB_NAME, DB_VERSION); } catch (e) { clearTimeout(timer); reject(e); return; }
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const s of STORES) {
          if (!d.objectStoreNames.contains(s)) {
            const os = d.createObjectStore(s, { keyPath: 'id' });
            if (s === 'transactions') { os.createIndex('date', 'date'); os.createIndex('importBatchId', 'importBatchId'); }
          }
        }
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
      };
      req.onblocked = () => { clearTimeout(timer); reject(new Error('Databasen er blokeret af en anden fane med Grejs Budget. Luk den og genindlæs.')); };
      req.onsuccess = () => {
        clearTimeout(timer);
        const d = req.result;
        d.onversionchange = () => { d.close(); emit('error', new Error('Grejs Budget er opdateret i en anden fane. Genindlæs siden.')); };
        resolve(d);
      };
      req.onerror = () => { clearTimeout(timer); reject(req.error || new Error('Kunne ikke åbne den lokale database.')); };
    });
  }

  function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  function txDone(t) { return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Skrivningen blev afbrudt')); }); }

  function friendly(e) {
    const name = e && e.name;
    if (name === 'QuotaExceededError') return new Error('Der er ikke mere lagerplads til Grejs Budget i browseren. Eksportér en sikkerhedskopi og ryd gamle data, eller giv browseren mere plads.');
    return e instanceof Error ? e : new Error(String(e && e.message || e));
  }

  async function init() {
    try {
      db = await openDb();
      backend = 'indexeddb';
      const t = db.transaction(STORES.concat('meta'), 'readonly');
      const results = await Promise.all(STORES.map((s) => reqP(t.objectStore(s).getAll())));
      const meta = await reqP(t.objectStore('meta').getAll());
      STORES.forEach((s, i) => setStore(s, results[i]));
      const m = new Map(meta.map((x) => [x.id, x.value]));
      settings = mergeSettings(m.get('settings'));
      const stored = m.get('schema') || (results.some((r) => r.length) ? 1 : SCHEMA);
      if (stored > SCHEMA) throw new Error('Dine data er gemt af en nyere version af Grejs Budget. Genindlæs siden for at hente den nyeste version.');
      if (stored < SCHEMA) {
        runMigrations(data, stored, settings);
        for (const s of STORES) setStore(s, data[s]);
        await writeAll();
      }
      await putMeta('schema', SCHEMA);
    } catch (e) {
      backend = 'memory';
      lastError = friendly(e);
      emit('error', lastError);
    }
    try {
      channel = new BroadcastChannel('grejsbudget');
      channel.onmessage = (ev) => { if (ev.data === 'changed') emit('external-change'); };
    } catch (e) { channel = null; }
    return { backend, error: lastError };
  }

  // d: alle data, from: version de blev gemt med, s: indstillingerne (kan også ændres af en migration).
  function runMigrations(d, from, s) {
    for (let v = from + 1; v <= SCHEMA; v++) if (MIGRATIONS[v]) MIGRATIONS[v](d, s || {}, from);
  }

  function mergeSettings(s) {
    const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (s && typeof s === 'object') {
      for (const k of Object.keys(out)) {
        if (!(k in s)) continue;
        const isObj = out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]);
        out[k] = isObj ? Object.assign(out[k], s[k]) : s[k];
      }
    }
    return out;
  }

  function setStore(s, list) {
    data[s] = list.slice();
    byId[s] = new Map(data[s].map((x) => [x.id, x]));
  }

  function track(p) {
    pending++;
    emit('saving', pending);
    return p.then(() => {
      pending--;
      if (failed && pending === 0) { failed = false; lastError = null; emit('recovered'); }
      emit('saved', pending);
      if (channel) channel.postMessage('changed');
    }, (e) => {
      pending--;
      failed = true;
      lastError = friendly(e);
      emit('error', lastError);
      throw lastError;
    });
  }

  // Gemmer én eller flere poster (opdaterer også kopien i hukommelsen).
  function put(store, records) {
    const list = Array.isArray(records) ? records : [records];
    for (const r of list) {
      if (!byId[store].has(r.id)) data[store].push(r);
      else if (byId[store].get(r.id) !== r) data[store][data[store].indexOf(byId[store].get(r.id))] = r;
      byId[store].set(r.id, r);
    }
    if (backend !== 'indexeddb') return Promise.resolve();
    return track((async () => {
      const t = db.transaction(store, 'readwrite');
      const os = t.objectStore(store);
      for (const r of list) os.put(r);
      await txDone(t);
    })());
  }

  function remove(store, ids) {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    if (!set.size) return Promise.resolve();
    data[store] = data[store].filter((x) => !set.has(x.id));
    for (const id of set) byId[store].delete(id);
    if (backend !== 'indexeddb') return Promise.resolve();
    return track((async () => {
      const t = db.transaction(store, 'readwrite');
      const os = t.objectStore(store);
      for (const id of set) os.delete(id);
      await txDone(t);
    })());
  }

  // Flere ændringer i én samlet skrivning: alt eller intet gemmes (bruges ved import).
  // ops: [{ store, put: [...] } | { store, remove: [...] }]
  function batch(ops) {
    for (const op of ops) {
      if (op.put) for (const r of op.put) { if (!byId[op.store].has(r.id)) data[op.store].push(r); else data[op.store][data[op.store].indexOf(byId[op.store].get(r.id))] = r; byId[op.store].set(r.id, r); }
      if (op.remove) { const s = new Set(op.remove); data[op.store] = data[op.store].filter((x) => !s.has(x.id)); for (const id of s) byId[op.store].delete(id); }
    }
    if (backend !== 'indexeddb') return Promise.resolve();
    const stores = [...new Set(ops.map((o) => o.store))];
    return track((async () => {
      const t = db.transaction(stores, 'readwrite');
      for (const op of ops) {
        const os = t.objectStore(op.store);
        if (op.put) for (const r of op.put) os.put(r);
        if (op.remove) for (const id of op.remove) os.delete(id);
      }
      await txDone(t);
    })());
  }

  function putMeta(id, value) {
    if (backend !== 'indexeddb') return Promise.resolve();
    const t = db.transaction('meta', 'readwrite');
    t.objectStore('meta').put({ id, value });
    return txDone(t);
  }

  function saveSettings(patch) {
    if (patch) Object.assign(settings, patch);
    return track(putMeta('settings', settings));
  }

  async function writeAll() {
    if (backend !== 'indexeddb') return;
    const t = db.transaction(STORES.concat('meta'), 'readwrite');
    for (const s of STORES) {
      const os = t.objectStore(s);
      os.clear();
      for (const r of data[s]) os.put(r);
    }
    t.objectStore('meta').put({ id: 'settings', value: settings });
    t.objectStore('meta').put({ id: 'schema', value: SCHEMA });
    await txDone(t);
  }

  // Erstatter ALLE data (gendannelse af sikkerhedskopi eller sletning).
  function replaceAll(newData, newSettings) {
    for (const s of STORES) setStore(s, (newData && newData[s]) || []);
    settings = mergeSettings(newSettings);
    return track(writeAll());
  }

  async function estimate() {
    try {
      const nav = globalThis.navigator;
      const est = nav && nav.storage && nav.storage.estimate ? await nav.storage.estimate() : {};
      const persisted = nav && nav.storage && nav.storage.persisted ? await nav.storage.persisted() : null;
      return { usage: est.usage, quota: est.quota, persisted };
    } catch (e) { return {}; }
  }
  async function requestPersist() {
    try { return await globalThis.navigator.storage.persist(); } catch (e) { return false; }
  }

  GB.store = {
    STORES, SCHEMA, DEFAULT_SETTINGS, MIGRATIONS, runMigrations,
    data, byId,
    get settings() { return settings; },
    get backend() { return backend; },
    get pending() { return pending; },
    get failed() { return failed; },
    get lastError() { return lastError; },
    init, put, remove, batch, saveSettings, replaceAll, estimate, requestPersist, mergeSettings,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();
