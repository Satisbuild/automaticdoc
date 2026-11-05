// LocalStorage og import/eksport. Hvert system har sin egen nøgle, så to faner ikke overskriver hinandens andre systemer.
(function (root) {
  'use strict';
  const G = root.GHB;
  const PREFIX = 'grejsHandball.system.';
  const PREFS_KEY = 'grejsHandball.prefs';

  function available() {
    try {
      const k = 'grejsHandball.test';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (err) {
      return false;
    }
  }

  function saveSystem(doc) {
    try {
      localStorage.setItem(PREFIX + doc.id, JSON.stringify(doc));
      return true;
    } catch (err) {
      return false;
    }
  }

  function loadSystem(id) {
    try {
      const raw = localStorage.getItem(PREFIX + id);
      return raw ? G.normalizeSystem(JSON.parse(raw)) : null;
    } catch (err) {
      return null;
    }
  }

  function deleteSystem(id) {
    try { localStorage.removeItem(PREFIX + id); } catch (err) { /* intet at gøre */ }
  }

  function listSystems() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX)) {
          const doc = loadSystem(key.slice(PREFIX.length));
          if (doc) out.push(doc);
        }
      }
    } catch (err) { /* LocalStorage er ikke tilgængelig */ }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function loadPrefs() {
    const defaults = { lastOpenId: null, customPositions: [], speed: 1 };
    try {
      const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      const prefs = Object.assign(defaults, parsed && typeof parsed === 'object' ? parsed : {});
      if (!Array.isArray(prefs.customPositions)) prefs.customPositions = [];
      prefs.customPositions = prefs.customPositions
        .filter((c) => c && typeof c.label === 'string' && ['attack', 'defense', 'gk'].includes(c.team))
        .map((c) => ({ label: c.label.slice(0, G.LIMITS.label), team: c.team }));
      return prefs;
    } catch (err) {
      return defaults;
    }
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (err) { /* ikke kritisk */ }
  }

  function exportPayload(systems) {
    const payload = { format: G.FORMAT, version: G.FORMAT_VERSION, exportedAt: new Date().toISOString() };
    if (systems.length === 1) payload.system = systems[0];
    else payload.systems = systems;
    return JSON.stringify(payload, null, 2);
  }

  // Returnerer systemer klar til at lægge i biblioteket. Kaster en fejl med en forståelig besked.
  function parseImport(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error('Filen er ikke gyldig JSON.');
    }
    if (!data || data.format !== G.FORMAT) throw new Error('Filen er ikke fra Grejs_Handball_Build.');
    if (typeof data.version === 'number' && data.version > G.FORMAT_VERSION) {
      throw new Error('Filen er lavet med en nyere version af programmet.');
    }
    const list = Array.isArray(data.systems) ? data.systems : data.system ? [data.system] : [];
    if (!list.length) throw new Error('Filen indeholder ingen systemer.');
    return list.map((raw) => {
      const doc = G.normalizeSystem(raw);
      doc.named = true;
      return doc;
    });
  }

  function safeFileName(name) {
    return (name || 'system').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'system';
  }

  function download(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  G.Store = {
    PREFIX, available, saveSystem, loadSystem, deleteSystem, listSystems, loadPrefs, savePrefs,
    exportPayload, parseImport, safeFileName, download,
  };
})(window);
