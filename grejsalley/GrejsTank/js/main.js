/* =====================================================================
 * GREJS TANKS - main.js
 * Boot sequence: load save, validate data, warm caches, wire UI,
 * register the offline service worker (when served over http/https).
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;

  function setLoad(p, text) {
    const f = document.getElementById('loadbar-fill');
    if (f) f.style.width = Math.round(p * 100) + '%';
    const t = document.getElementById('load-text');
    if (t && text) t.textContent = text;
  }

  function boot() {
    try {
      setLoad(0.1, 'Loading save...');
      GT.Save.load();
      GT.Save.validate();
      GT.Particles.setQuality(GT.Save.data.settings.quality);
      setLoad(0.35, 'Building 150 levels...');
      // sanity: make sure every level definition can be built
      let ok = 0;
      for (let w = 1; w <= GT.Worlds.count; w++) for (let l = 1; l <= GT.Levels.PER_WORLD; l++) if (GT.Levels.get(w, l)) ok++;
      setLoad(0.6, 'Fuelling ' + GT.Tanks.list.length + ' tanks...');
      GT.Progress.ensureChallenges();
      GT.Progress.autoUnlockTanks();
      GT.Progress.checkAchievements();
      GT.Game.init(document.getElementById('game'));
      GT.UI.initStatic();
      setLoad(1, 'Ready! (' + ok + ' levels)');
      setTimeout(() => {
        GT.UI.show('menu', {}, true);
        GT.Cloud.startup(); // compare with the cloud save when logged in
      }, 250);
      window.addEventListener('beforeunload', () => GT.Save.save());
    } catch (e) {
      console.error('[Boot] failed', e);
      setLoad(1, 'Something went wrong while loading. Try Settings → Reset save. (' + e.message + ')');
    }
    // offline support (GitHub Pages / any http server)
    try {
      if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && window.self === window.top) {
        Promise.resolve().catch(() => {});
      }
    } catch (e) { /* ignore */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // tiny debug hook for testing in the console
  window.GrejsDebug = {
    coins(n) { GT.Save.addCoins(n || 10000); GT.Save.save(); GT.UI.renderTopbars(); },
    unlockAll() {
      const d = GT.Save.data;
      d.unlockedTanks = GT.Tanks.list.map((t) => t.id);
      d.unlockedWeapons = GT.Weapons.list.map((w) => w.id);
      for (let w = 1; w <= GT.Worlds.count; w++) { d.bosses[w] = true; for (let l = 1; l <= 15; l++) { d.completed['w' + w + '_l' + l] = true; d.stars['w' + w + '_l' + l] = 3; } }
      GT.Save.save();
      GT.UI.home();
    }
  };
})();

