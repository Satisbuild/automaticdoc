/*
 * GrejsRadio – afspiller
 * Styrer ét enkelt <audio>-element, så der aldrig kan spille to streams samtidig.
 *
 * Tilstande (state):
 *   idle     Ingen station valgt
 *   loading  Streamen indlæses / genopretter forbindelsen
 *   playing  Spiller
 *   paused   Pauset (eller stoppet)
 *   error    Noget gik galt – message forklarer hvad, og retry() prøver igen
 */
(function () {
  'use strict';

  var LOAD_TIMEOUT = 15000;   // så længe venter vi på, at en station starter
  var STALL_TIMEOUT = 20000;  // så længe må en stream "hænge", før vi melder fejl

  var MSG = {
    offline: 'Ingen internetforbindelse. Radioen prøver igen, når du er online.',
    timeout: 'Stationen svarer ikke lige nu. Prøv igen om lidt, eller vælg en anden station.',
    lost: 'Forbindelsen til stationen blev afbrudt.',
    network: 'Der opstod et problem med forbindelsen til stationen.',
    decode: 'Streamen kunne ikke afspilles.',
    unavailable: 'Stationen kan ikke afspilles lige nu. Den kan være nede, eller din browser understøtter ikke formatet.',
    format: 'Din browser kan ikke afspille denne stations lydformat. Prøv en anden browser.',
    blocked: 'Tryk på afspil for at starte radioen.',
    generic: 'Stationen kunne ikke startes.'
  };

  function RadioPlayer(audio) {
    this.audio = audio;
    this.station = null;
    this.url = null;
    this.state = 'idle';
    this.message = '';
    this.canRetry = false;
    this.wantPlay = false;      // brugeren ønsker, at der spilles
    this.retryWhenOnline = false;
    this.reqId = 0;             // tæller, så svar fra gamle forsøg ignoreres
    this.timer = null;
    this.listeners = [];
    this._bind();
  }

  RadioPlayer.prototype.onChange = function (fn) { this.listeners.push(fn); };

  RadioPlayer.prototype._emit = function () {
    var info = { state: this.state, message: this.message, canRetry: this.canRetry, station: this.station };
    this.listeners.forEach(function (fn) { fn(info); });
  };

  RadioPlayer.prototype._set = function (state, message, canRetry) {
    this.state = state;
    this.message = message || '';
    this.canRetry = !!canRetry;
    this._emit();
  };

  /** Vælg en station (og start den, hvis autoplay er sand). */
  RadioPlayer.prototype.select = function (station, url, autoplay) {
    var same = this.station && this.station.id === station.id && this.url === url;
    this.station = station;
    this.url = url;
    if (autoplay) {
      this.play();
    } else if (!same) {
      this._stop();
      this._set('paused', 'Klar til at spille');
    }
  };

  RadioPlayer.prototype.play = function () {
    if (!this.station) return;
    var self = this;
    var id = ++this.reqId;
    this._clearTimer();

    if (!this.isSupported(this.station)) {
      this.wantPlay = false;
      this._stop();
      this._set('error', MSG.format, false);
      return;
    }
    if (navigator.onLine === false) {
      this.wantPlay = false;
      this.retryWhenOnline = true;
      this._stop();
      this._set('error', MSG.offline, true);
      return;
    }

    this.wantPlay = true;
    this.retryWhenOnline = false;
    // Det er live-radio: start altid streamen forfra, så man lytter "nu" og ikke fra en gammel buffer.
    this.audio.src = this.url;
    this._set('loading', 'Indlæser …');
    this._startTimer(LOAD_TIMEOUT, MSG.timeout);

    var p = this.audio.play();
    if (p && p.catch) {
      p.catch(function (err) {
        if (id !== self.reqId) return;               // et nyere forsøg har overtaget
        if (err && err.name === 'AbortError') return; // afbrudt af stationsskift
        self._clearTimer();
        self.wantPlay = false;
        if (err && err.name === 'NotAllowedError') {
          self._stop();
          self._set('paused', MSG.blocked, false);
        } else if (err && err.name === 'NotSupportedError') {
          self._stop();
          self._set('error', MSG.unavailable, true);
        } else {
          self._stop();
          self._set('error', MSG.generic, true);
        }
      });
    }
  };

  RadioPlayer.prototype.pause = function () {
    this.reqId++;
    this.wantPlay = false;
    this.retryWhenOnline = false;
    this._clearTimer();
    // Kun pause (ikke fjerne kilden), så telefonens mediekontrol bliver på låseskærmen.
    this.audio.pause();
    this._set(this.station ? 'paused' : 'idle');
  };

  RadioPlayer.prototype.toggle = function () {
    if (this.wantPlay) this.pause(); else this.play();
  };

  RadioPlayer.prototype.retry = function () { this.play(); };

  RadioPlayer.prototype.isActive = function () { return this.wantPlay; };

  RadioPlayer.prototype.setVolume = function (v) { this.audio.volume = Math.min(1, Math.max(0, v)); };
  RadioPlayer.prototype.setMuted = function (m) { this.audio.muted = !!m; };

  RadioPlayer.prototype.isSupported = function (station) {
    if (!station.type || typeof this.audio.canPlayType !== 'function') return true;
    return this.audio.canPlayType(station.type) !== '';
  };

  /* ---------- intern ---------- */

  RadioPlayer.prototype._stop = function () {
    this.audio.pause();
    if (this.audio.getAttribute('src')) {
      this.audio.removeAttribute('src');
      this.audio.load(); // lukker forbindelsen til den gamle stream
    }
  };

  RadioPlayer.prototype._fail = function (message, canRetry) {
    this.reqId++;
    this.wantPlay = false;
    this._clearTimer();
    this._stop();
    this._set('error', message, canRetry !== false);
  };

  RadioPlayer.prototype._startTimer = function (ms, message) {
    var self = this;
    this._clearTimer();
    this.timer = setTimeout(function () {
      self.timer = null;
      if (!self.wantPlay) return;
      if (navigator.onLine === false) self.retryWhenOnline = true;
      self._fail(navigator.onLine === false ? MSG.offline : message);
    }, ms);
  };

  RadioPlayer.prototype._clearTimer = function () {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  };

  RadioPlayer.prototype._bind = function () {
    var self = this;
    var a = this.audio;

    a.addEventListener('playing', function () {
      if (!self.wantPlay) return;
      self._clearTimer();
      self._set('playing');
    });

    a.addEventListener('waiting', function () {
      if (!self.wantPlay || self.state !== 'playing') return;
      self._set('loading', 'Genopretter forbindelsen …');
      self._startTimer(STALL_TIMEOUT, MSG.lost);
    });

    a.addEventListener('stalled', function () {
      if (!self.wantPlay || self.timer) return;
      self._startTimer(STALL_TIMEOUT, MSG.lost);
    });

    // Pause, som ikke kom fra os (fx et telefonopkald eller systemet).
    a.addEventListener('pause', function () {
      if (self.wantPlay && a.paused && a.getAttribute('src')) {
        self.reqId++;
        self.wantPlay = false;
        self._clearTimer();
        self._set('paused');
      }
    });

    // En livestream må ikke "slutte" – sker det, er forbindelsen røget.
    a.addEventListener('ended', function () {
      if (self.wantPlay) self._fail(MSG.lost);
    });

    a.addEventListener('error', function () {
      if (!self.wantPlay || !a.getAttribute('src')) return; // fejl fra en kilde, vi selv har fjernet
      var code = a.error ? a.error.code : 0;
      if (navigator.onLine === false) {
        self.retryWhenOnline = true;
        self._fail(MSG.offline);
      } else if (code === 2) {
        self._fail(MSG.network);
      } else if (code === 3) {
        self._fail(MSG.decode);
      } else if (code === 4) {
        self._fail(MSG.unavailable);
      } else {
        self._fail(MSG.generic);
      }
    });

    window.addEventListener('offline', function () {
      if (self.wantPlay) self.retryWhenOnline = true;
    });

    window.addEventListener('online', function () {
      if (self.retryWhenOnline && self.station) {
        self.retryWhenOnline = false;
        self.play();
      }
    });
  };

  window.GrejsRadio = window.GrejsRadio || {};
  window.GrejsRadio.RadioPlayer = RadioPlayer;
})();
