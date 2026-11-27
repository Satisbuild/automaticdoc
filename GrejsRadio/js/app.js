/*
 * GrejsRadio – brugerflade
 * Binder stationslisten, afspilleren, mediekontrollerne og de gemte indstillinger sammen.
 */
(function () {
  'use strict';

  var G = window.GrejsRadio;
  var stations = G.stations;
  var settings = G.storage.load();
  var $ = function (id) { return document.getElementById(id); };

  var audio = $('audio');
  var player = new G.RadioPlayer(audio);
  var media = G.mediaSession.init({
    play: function () { if (!current) selectIndex(0, true); else player.play(); },
    pause: function () { player.pause(); },
    next: function () { step(1); },
    previous: function () { step(-1); }
  });

  var current = null; // den valgte station
  var heartSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.6a4.3 4.3 0 017.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>';
  var eqHtml = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>';

  /* ---------- stationsdata ---------- */

  function byId(id) {
    for (var i = 0; i < stations.length; i++) if (stations[i].id === id) return stations[i];
    return null;
  }

  function regionOf(station) {
    if (!station.regions) return null;
    return station.regions[settings.p4Region] ? settings.p4Region : station.defaultRegion;
  }

  function streamUrl(station) {
    var r = regionOf(station);
    return r ? station.regions[r].streamUrl : station.streamUrl;
  }

  function subtitle(station) {
    var r = regionOf(station);
    return r ? 'P4 ' + station.regions[r].name : station.tagline;
  }

  function isFav(id) { return settings.favorites.indexOf(id) !== -1; }

  function persist() {
    settings.lastStationId = current ? current.id : settings.lastStationId;
    G.storage.save(settings);
  }

  /* ---------- stationsliste ---------- */

  function badgeHtml(station, cls) {
    var style = 'background:linear-gradient(135deg,' + station.colors[0] + ',' + station.colors[1] + ')';
    if (station.logo) {
      return '<span class="' + cls + ' has-logo" style="' + style + '"><img src="' + esc(station.logo) + '" alt="" loading="lazy"></span>';
    }
    var text = station.badge || station.name;
    var size = text.length <= 2 ? '' : text.length <= 4 ? ' is-md' : ' is-sm';
    return '<span class="' + cls + size + '" style="' + style + '">' + esc(text) + '</span>';
  }

  function renderStations() {
    var wrap = $('station-groups');
    var onlyFav = settings.filter === 'favorites';
    var html = '';

    G.groups.forEach(function (group) {
      var list = stations.filter(function (s) {
        return s.group === group.id && (!onlyFav || isFav(s.id));
      });
      if (!list.length) return;
      html += '<section class="gr-group" aria-labelledby="group-' + group.id + '">' +
        '<h2 class="gr-group__title" id="group-' + group.id + '">' + esc(group.title) + '</h2>' +
        '<ul class="gr-grid" role="list">';
      list.forEach(function (s) {
        var fav = isFav(s.id);
        html += '<li class="station" data-id="' + s.id + '">' +
          '<button type="button" class="station__main" data-action="select" aria-label="' + esc(s.name) + ' – ' + esc(subtitle(s)) + '">' +
            badgeHtml(s, 'station__badge') +
            '<span class="station__text">' +
              '<span class="station__name">' + esc(s.name) + '</span>' +
              '<span class="station__tag">' + esc(subtitle(s)) + '</span>' +
            '</span>' +
            '<span class="station__state" aria-hidden="true">' + eqHtml + '<span class="station__state-text"></span></span>' +
          '</button>' +
          '<button type="button" class="station__fav" data-action="fav" aria-pressed="' + fav + '" aria-label="' +
            (fav ? 'Fjern ' + esc(s.name) + ' fra favoritter' : 'Tilføj ' + esc(s.name) + ' til favoritter') + '">' + heartSvg + '</button>' +
        '</li>';
      });
      html += '</ul></section>';
    });

    wrap.innerHTML = html;
    $('fav-empty').hidden = !(onlyFav && settings.favorites.length === 0);
    $('count-all').textContent = stations.length;
    $('count-fav').textContent = stations.filter(function (s) { return isFav(s.id); }).length;
    updateStationStates();
  }

  /** Markerer den valgte station i listen (med tekst, ikke kun farve). */
  function updateStationStates() {
    var nodes = document.querySelectorAll('.station');
    for (var i = 0; i < nodes.length; i++) {
      var li = nodes[i];
      var isCur = current && li.getAttribute('data-id') === current.id;
      var btn = li.querySelector('.station__main');
      li.classList.toggle('is-current', !!isCur);
      li.setAttribute('data-state', isCur ? player.state : '');
      if (isCur) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
      var label = '';
      if (isCur) {
        label = { playing: 'Spiller', loading: 'Indlæser', paused: 'Pauset', error: 'Fejl', idle: '' }[player.state] || '';
      }
      li.querySelector('.station__state-text').textContent = label;
    }
  }

  /* ---------- afspilning ---------- */

  function selectStation(station, autoplay) {
    if (!station) return;
    current = station;
    player.select(station, streamUrl(station), autoplay);
    persist();
    renderNow();
  }

  function selectIndex(i, autoplay) {
    var n = stations.length;
    selectStation(stations[((i % n) + n) % n], autoplay);
  }

  /** Næste/forrige i den faste rækkefølge – fortsætter rundt i ring. */
  function step(dir) {
    var idx = current ? stations.indexOf(current) : (dir > 0 ? -1 : 0);
    selectIndex(idx + dir, true);
  }

  function togglePlay() {
    if (!current) { selectIndex(0, true); return; }
    player.toggle();
  }

  /* ---------- afspillerpanel ---------- */

  function renderNow() {
    var art = $('now-art');
    var favBtn = $('now-fav');
    if (!current) {
      favBtn.disabled = true;
      return;
    }
    art.outerHTML = badgeHtml(current, 'gr-now__art').replace('<span class="gr-now__art', '<span id="now-art" aria-hidden="true" class="gr-now__art');
    $('now-name').textContent = current.name;
    $('now-tagline').textContent = subtitle(current);
    var fav = isFav(current.id);
    favBtn.disabled = false;
    favBtn.setAttribute('aria-pressed', String(fav));
    favBtn.setAttribute('aria-label', fav ? 'Fjern ' + current.name + ' fra favoritter' : 'Tilføj ' + current.name + ' til favoritter');
    document.title = current.name + ' · GrejsRadio';
    renderStatus();
  }

  function renderStatus() {
    var st = player.state;
    var labels = { idle: 'Klar', loading: 'Indlæser …', playing: 'Spiller', paused: 'Pauset', error: 'Fejl' };
    var text = labels[st];
    if (st === 'loading' && player.message) text = player.message;
    if (st === 'paused' && player.message) text = player.message;

    $('status').setAttribute('data-state', st);
    $('status-text').textContent = text;
    document.body.setAttribute('data-state', st);

    var playBtn = $('play');
    var active = player.isActive();
    playBtn.setAttribute('aria-label', active ? 'Pause' : 'Afspil');
    playBtn.classList.toggle('is-active', active);
    playBtn.classList.toggle('is-loading', st === 'loading');

    var errBox = $('error-box');
    errBox.hidden = st !== 'error';
    if (st === 'error') {
      $('error-text').textContent = player.message;
      $('retry').hidden = !player.canRetry;
    }

    updateStationStates();
    if (current) media.update(current, subtitle(current), st);
  }

  player.onChange(renderStatus);

  /* ---------- lydstyrke ---------- */

  // iOS tillader ikke, at en side styrer lydstyrken – der bruges telefonens knapper.
  var canSetVolume = (function () {
    try { var a = document.createElement('audio'); a.volume = 0.5; return Math.abs(a.volume - 0.5) < 0.01; }
    catch (e) { return true; }
  })();

  function applyVolume() {
    var v = settings.volume;
    player.setVolume(v / 100);
    player.setMuted(settings.muted);
    var range = $('volume');
    range.value = v;
    range.style.setProperty('--fill', (settings.muted ? 0 : v) + '%');
    range.setAttribute('aria-valuetext', settings.muted ? 'Lyd slået fra' : v + ' procent');
    $('volume-value').textContent = settings.muted ? 'Fra' : v + ' %';
    var mute = $('mute');
    var muted = settings.muted || v === 0;
    mute.setAttribute('aria-pressed', String(settings.muted));
    mute.setAttribute('aria-label', settings.muted ? 'Slå lyden til' : 'Slå lyden fra');
    mute.classList.toggle('is-muted', muted);
  }

  function setVolume(v) {
    settings.volume = Math.max(0, Math.min(100, Math.round(v)));
    if (settings.volume > 0 && settings.muted) settings.muted = false;
    applyVolume();
    persist();
  }

  function toggleMute() {
    settings.muted = !settings.muted;
    if (!settings.muted && settings.volume === 0) settings.volume = 50;
    applyVolume();
    persist();
  }

  /* ---------- favoritter, filter og visning ---------- */

  function toggleFav(id) {
    var i = settings.favorites.indexOf(id);
    if (i === -1) settings.favorites.push(id); else settings.favorites.splice(i, 1);
    persist();
    renderStations();
    renderNow();
  }

  function setFilter(f) {
    settings.filter = f;
    var chips = document.querySelectorAll('.gr-filter [data-filter]');
    for (var i = 0; i < chips.length; i++) {
      chips[i].setAttribute('aria-pressed', String(chips[i].getAttribute('data-filter') === f));
    }
    persist();
    renderStations();
  }

  function setView(v) {
    settings.view = v;
    document.body.setAttribute('data-view', v);
    var btns = document.querySelectorAll('[data-view]');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i] === document.body) continue;
      btns[i].setAttribute('aria-pressed', String(btns[i].getAttribute('data-view') === v));
    }
    persist();
  }

  function setupRegions() {
    var p4 = byId('dr-p4');
    var sel = $('p4-region');
    if (!p4 || !p4.regions) { sel.closest('.gr-region').hidden = true; return; }
    if (!p4.regions[settings.p4Region]) settings.p4Region = p4.defaultRegion;
    Object.keys(p4.regions).forEach(function (key) {
      var o = document.createElement('option');
      o.value = key;
      o.textContent = p4.regions[key].name;
      sel.appendChild(o);
    });
    sel.value = settings.p4Region;
    sel.addEventListener('change', function () {
      settings.p4Region = sel.value;
      persist();
      renderStations();
      if (current && current.id === 'dr-p4') {
        selectStation(current, player.isActive()); // skift region – spiller videre, hvis den spillede
      }
    });
  }

  /* ---------- hændelser ---------- */

  $('station-groups').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var id = btn.closest('.station').getAttribute('data-id');
    var station = byId(id);
    if (btn.getAttribute('data-action') === 'fav') {
      toggleFav(id);
      var again = document.querySelector('.station[data-id="' + id + '"] .station__fav');
      if (again) again.focus(); // behold fokus efter genopbygning af listen
      return;
    }
    if (current === station && player.isActive()) player.pause();
    else selectStation(station, true);
  });

  document.addEventListener('click', function (e) {
    var f = e.target.closest('[data-filter]');
    if (f) setFilter(f.getAttribute('data-filter'));
    var v = e.target.closest('button[data-view]');
    if (v) setView(v.getAttribute('data-view'));
  });

  $('play').addEventListener('click', togglePlay);
  $('next').addEventListener('click', function () { step(1); });
  $('prev').addEventListener('click', function () { step(-1); });
  $('retry').addEventListener('click', function () { player.retry(); });
  $('mute').addEventListener('click', toggleMute);
  $('now-fav').addEventListener('click', function () { if (current) toggleFav(current.id); });
  $('volume').addEventListener('input', function (e) { setVolume(Number(e.target.value)); });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    var tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
    var onButton = tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A';
    var k = e.key;
    if ((k === ' ' || k === 'Spacebar') && !onButton) { e.preventDefault(); togglePlay(); }
    else if (k === 'k' || k === 'K') togglePlay();
    else if (k === 'n' || k === 'N' || k === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (k === 'p' || k === 'P' || k === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (k === 'm' || k === 'M') toggleMute();
    else if (k === '+' || k === '=') setVolume(settings.volume + 5);
    else if (k === '-' || k === '−') setVolume(settings.volume - 5);
  });

  // Sikkerhedsnet: hvis telefonen alligevel viser "spol ±10 sek." på låseskærmen,
  // forsøger den at spole i streamen. Live-radio kan ikke spoles, så et spol frem
  // tolkes som "næste station" og et spol tilbage som "forrige station".
  var lastTime = 0;
  var seekLock = 0;
  audio.addEventListener('loadstart', function () { lastTime = 0; });
  audio.addEventListener('timeupdate', function () { if (!audio.seeking) lastTime = audio.currentTime; });
  audio.addEventListener('seeking', function () {
    if (!player.isActive()) return;
    var now = Date.now();
    if (now < seekLock) return;
    seekLock = now + 1500;
    step(audio.currentTime >= lastTime ? 1 : -1);
  });

  // Afspilleren ligger fast i bunden på mobil – sørg for, at listen ikke gemmer sig bag den.
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      document.documentElement.style.setProperty('--player-h', $('player').offsetHeight + 'px');
    }).observe($('player'));
  }

  /* ---------- start ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  if (!canSetVolume) {
    $('volume').hidden = true;
    $('volume-value').hidden = true;
    $('volume-hint').hidden = false;
  }

  setupRegions();
  setView(settings.view);
  setFilter(settings.filter);
  applyVolume();

  // Husk den sidste station – men start den ikke selv (browsere tillader ikke autoplay med lyd).
  var last = byId(settings.lastStationId);
  if (last) selectStation(last, false);
  else renderStatus();
})();
