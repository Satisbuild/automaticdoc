'use strict';
/* =====================================================================
   GREJS VS ZOMBIES - main.js
   Opstart: indlæs gemte data og start brugerfladen.
   ===================================================================== */
(function () {
  function boot() {
    GVZ.Progress.load();
    GVZ.UI.init();
  }
  // En fejl i én frame må ikke vælte hele spillet - log den og fortsæt.
  window.addEventListener('error', (e) => { console.error('[Grejs vs Zombies]', e.error || e.message); });
  if (document.fonts && document.fonts.ready) {
    // vent kort på skrifttyperne, så knapper og logo ikke "hopper"
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(boot);
  } else boot();
})();
