// Sætter tema (lyst/mørkt/system) før siden tegnes, så der ikke blinker et forkert tema.
// Temaet huskes i localStorage – den eneste lille indstilling, der ligger der.
(function () {
  'use strict';
  const GB = (globalThis.GB = globalThis.GB || {});
  const KEY = 'grejsbudget.theme';
  function apply(t) {
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    try { localStorage.setItem(KEY, t || 'system'); } catch (e) { /* privat vindue o.l. */ }
  }
  let t = 'system';
  try { t = localStorage.getItem(KEY) || 'system'; } catch (e) { /* ignorer */ }
  apply(t);
  GB.theme = { apply };
})();
