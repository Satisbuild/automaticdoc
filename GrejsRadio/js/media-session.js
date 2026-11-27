/*
 * GrejsRadio – mediekontroller (Media Session API)
 * Viser stationen på låseskærmen / i mediepanelet og kobler telefonens og
 * høretelefonernes knapper til radioen. Gør ingenting i browsere uden understøttelse.
 */
(function () {
  'use strict';

  var supported = 'mediaSession' in navigator;
  var artCache = {};

  function setHandler(action, fn) {
    try { navigator.mediaSession.setActionHandler(action, fn); } catch (e) { /* handlingen understøttes ikke */ }
  }

  /** Laver et kvadratisk billede med stationens mærke (bruges, når der ikke er et logo). */
  function makeArtwork(station) {
    if (artCache[station.id]) return artCache[station.id];
    var url = '';
    try {
      var size = 512;
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      var grad = g.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, station.colors[0]);
      grad.addColorStop(1, station.colors[1]);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      var text = station.badge || station.name;
      var fontSize = text.length <= 2 ? 240 : text.length <= 4 ? 150 : 120;
      g.font = '800 ' + fontSize + 'px Inter, system-ui, sans-serif';
      g.fillText(text, size / 2, size / 2 + 8);
      url = c.toDataURL('image/png');
    } catch (e) { url = ''; }
    artCache[station.id] = url;
    return url;
  }

  function artworkFor(station) {
    if (station.logo) {
      return [{ src: new URL(station.logo, location.href).href, sizes: '512x512' }];
    }
    var art = makeArtwork(station);
    var list = [];
    if (art) list.push({ src: art, sizes: '512x512', type: 'image/png' });
    list.push({ src: new URL('/icons/icon-512.png', location.href).href, sizes: '512x512', type: 'image/png' });
    return list;
  }

  /**
   * @param {object} handlers { play, pause, next, previous }
   */
  function init(handlers) {
    if (!supported) return { update: function () {} };

    function register() {
      setHandler('play', function () { handlers.play(); });
      setHandler('pause', function () { handlers.pause(); });
      setHandler('stop', function () { handlers.pause(); });
      setHandler('nexttrack', function () { handlers.next(); });
      setHandler('previoustrack', function () { handlers.previous(); });
      // Live-radio kan ikke spoles. Uden disse viser nogle telefoner ±10 sek. i stedet for næste/forrige.
      setHandler('seekbackward', null);
      setHandler('seekforward', null);
      setHandler('seekto', null);
    }
    register();

    var lastId = null;
    var lastState = null;
    return {
      update: function (station, subtitle, state) {
        if (!station) return;
        // Nogle telefoner (især iPhone) nulstiller knapperne, når en ny stream starter.
        // Registrér dem igen, så låseskærmen viser næste/forrige i stedet for spol ±10 sek.
        if (state === 'playing' && lastState !== 'playing') register();
        lastState = state;
        var key = station.id + '|' + subtitle;
        if (key !== lastId && typeof window.MediaMetadata === 'function') {
          lastId = key;
          try {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: station.name,
              artist: subtitle,
              album: 'GrejsRadio',
              artwork: artworkFor(station)
            });
          } catch (e) { /* ignoreres */ }
        }
        try {
          navigator.mediaSession.playbackState =
            (state === 'playing' || state === 'loading') ? 'playing' : (state === 'idle' ? 'none' : 'paused');
        } catch (e) { /* ignoreres */ }
      }
    };
  }

  window.GrejsRadio = window.GrejsRadio || {};
  window.GrejsRadio.mediaSession = { init: init };
})();
