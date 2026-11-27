/*
 * GrejsRadio – lokal lagring
 * Alle brugerens valg gemmes under én nøgle i localStorage.
 * Hvis localStorage ikke virker (fx privat browsing), kører radioen videre uden at gemme.
 */
(function () {
  'use strict';

  var KEY = 'grejsRadio';
  var DEFAULTS = {
    version: 1,
    lastStationId: null,
    volume: 80,          // 0-100
    muted: false,
    favorites: [],       // station-id'er
    view: 'grid',        // 'grid' | 'list'
    filter: 'all',       // 'all' | 'favorites'
    p4Region: 'kbh'
  };

  function load() {
    var data = {};
    try {
      data = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    } catch (e) { data = {}; }
    var s = Object.assign({}, DEFAULTS, data);
    // Ryd op i værdier, der kan være ødelagte eller forældede.
    s.volume = clamp(Number(s.volume), 0, 100, DEFAULTS.volume);
    s.muted = !!s.muted;
    s.favorites = Array.isArray(s.favorites) ? s.favorites.filter(function (x) { return typeof x === 'string'; }) : [];
    if (s.view !== 'grid' && s.view !== 'list') s.view = DEFAULTS.view;
    if (s.filter !== 'all' && s.filter !== 'favorites') s.filter = DEFAULTS.filter;
    return s;
  }

  function save(settings) {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (e) { /* fuld eller blokeret – ignoreres */ }
  }

  function clamp(n, min, max, fallback) {
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  window.GrejsRadio = window.GrejsRadio || {};
  window.GrejsRadio.storage = { load: load, save: save };
})();
