/* GrejsAlley Lemmings — save.js
 * Progress and settings in localStorage. Invalid or missing data falls back
 * to defaults so the game never crashes on a bad save.
 */
(function (GL) {
  'use strict';
  const KEY = 'grejsalley.lemmings.v1';

  const DEFAULT_SETTINGS = {
    music: true,
    sfx: true,
    volume: 0.7,        // master 0..1
    musicVolume: 0.5,   // 0..1 relative to master
    fx: true,           // particles, parallax ambience, screen shake
    touch: 'auto',      // 'auto' | 'on' | 'off' — large touch controls
    speed: 1,           // preferred game speed 1/2/4
    hints: true,        // show keyboard hints
  };

  function defaults() {
    return { settings: Object.assign({}, DEFAULT_SETTINGS), unlocked: 1, levels: {}, last: null };
  }

  function sanitize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      const def = DEFAULT_SETTINGS[k], v = s[k];
      if (typeof def === 'boolean' && typeof v === 'boolean') d.settings[k] = v;
      else if (typeof def === 'number' && typeof v === 'number' && isFinite(v)) d.settings[k] = v;
      else if (typeof def === 'string' && typeof v === 'string') d.settings[k] = v;
    }
    d.settings.volume = clamp01(d.settings.volume);
    d.settings.musicVolume = clamp01(d.settings.musicVolume);
    if (![1, 2, 4].includes(d.settings.speed)) d.settings.speed = 1;
    if (!['auto', 'on', 'off'].includes(d.settings.touch)) d.settings.touch = 'auto';

    const total = (GL.LEVELS || []).length || 1;
    if (Number.isInteger(raw.unlocked)) d.unlocked = Math.max(1, Math.min(total, raw.unlocked));
    if (raw.levels && typeof raw.levels === 'object') {
      for (const id of Object.keys(raw.levels)) {
        const r = raw.levels[id];
        if (!r || typeof r !== 'object') continue;
        if (!(GL.LEVELS || []).some(l => l.id === id)) continue;
        d.levels[id] = {
          done: !!r.done,
          best: Number.isInteger(r.best) && r.best >= 0 ? r.best : 0,
          stars: Number.isInteger(r.stars) ? Math.max(0, Math.min(3, r.stars)) : 0,
          plays: Number.isInteger(r.plays) ? r.plays : 0,
        };
      }
    }
    if (typeof raw.last === 'string' && (GL.LEVELS || []).some(l => l.id === raw.last)) d.last = raw.last;
    return d;
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  const Save = {
    data: defaults(),
    load() {
      try {
        const txt = localStorage.getItem(KEY);
        this.data = sanitize(txt ? JSON.parse(txt) : null);
      } catch (e) {
        this.data = defaults();
      }
      return this.data;
    },
    write() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage full or blocked */ }
    },
    get settings() { return this.data.settings; },
    setSetting(k, v) { this.data.settings[k] = v; this.write(); },
    levelRecord(id) { return this.data.levels[id] || { done: false, best: 0, stars: 0, plays: 0 }; },
    isUnlocked(index) { return index < this.data.unlocked; },
    setLast(id) { this.data.last = id; this.write(); },
    // Record a finished attempt. Returns { newBest, unlockedNext }.
    recordResult(levelIndex, result) {
      const def = GL.LEVELS[levelIndex];
      const rec = Object.assign({}, this.levelRecord(def.id));
      rec.plays++;
      let newBest = false, unlockedNext = false;
      if (result.won) {
        rec.done = true;
        if (result.saved > rec.best) { rec.best = result.saved; newBest = true; }
        rec.stars = Math.max(rec.stars, result.stars);
        if (levelIndex + 1 < GL.LEVELS.length && this.data.unlocked < levelIndex + 2) {
          this.data.unlocked = levelIndex + 2;
          unlockedNext = true;
        }
      }
      this.data.levels[def.id] = rec;
      this.write();
      return { newBest, unlockedNext };
    },
    totalStars() { return Object.values(this.data.levels).reduce((a, r) => a + (r.stars || 0), 0); },
    hasProgress() { return !!this.data.last || Object.keys(this.data.levels).length > 0; },
    resetProgress() {
      const settings = this.data.settings;
      this.data = defaults();
      this.data.settings = settings;
      this.write();
    },
  };

  GL.Save = Save;
})(window.GL = window.GL || {});
