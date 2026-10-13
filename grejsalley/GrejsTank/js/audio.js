/* =====================================================================
 * GREJS TANKS - audio.js
 * 100% synthesized audio via WebAudio (no audio files needed):
 *  - sound effects (cannon, rockets, explosions, lasers, UI ...)
 *  - procedural music per world + boss music (step sequencer)
 * Music / Sound can be toggled separately in Settings.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;

  const A = (GT.Audio = {
    ctx: null,
    master: null,
    sfx: null,
    music: null,
    noiseBuf: null,
    musicOn: true,
    soundOn: true,
    theme: null,
    _timer: null,
    _step: 0,
    _nextTime: 0,
    _engine: null,
    _lastPlay: {},

    /** must be called from a user gesture */
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) {
        return;
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      // gentle compressor to avoid clipping with many explosions
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(c.destination);
      this.sfx = c.createGain();
      this.music = c.createGain();
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      // white noise buffer
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applySettings();
      if (this._pendingTheme) this.playMusic(this._pendingTheme);
    },

    applySettings() {
      const s = GT.Save && GT.Save.data ? GT.Save.data.settings : { music: true, sound: true, musicVol: 0.5, sfxVol: 0.8 };
      this.musicOn = !!s.music;
      this.soundOn = !!s.sound;
      if (!this.ctx) return;
      this.sfx.gain.value = this.soundOn ? s.sfxVol : 0;
      this.music.gain.value = this.musicOn ? s.musicVol * 0.55 : 0;
      if (!this.musicOn) this.stopMusic(true);
      else if (this.theme && !this._timer) this.playMusic(this.theme);
    },

    /* ---------- low level building blocks ---------- */
    _noise(t, dur, opt) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = opt.filter || 'lowpass';
      f.frequency.setValueAtTime(opt.f0 || 1000, t);
      if (opt.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), t + dur);
      f.Q.value = opt.q || 0.7;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(opt.vol || 0.5, t + (opt.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(opt.dest || this.sfx);
      src.start(t, Math.random());
      src.stop(t + dur + 0.05);
    },
    _tone(t, dur, opt) {
      const c = this.ctx;
      const o = c.createOscillator();
      o.type = opt.type || 'sine';
      o.frequency.setValueAtTime(opt.f0 || 440, t);
      if (opt.f1) o.frequency.exponentialRampToValueAtTime(Math.max(10, opt.f1), t + (opt.slide || dur));
      if (opt.detune) o.detune.value = opt.detune;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(opt.vol || 0.3, t + (opt.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o;
      if (opt.lp) {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = opt.lp;
        o.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(opt.dest || this.sfx);
      o.start(t);
      o.stop(t + dur + 0.05);
    },

    /* ---------- sound effects ---------- */
    play(name, opt) {
      if (!this.ctx || !this.soundOn) return;
      opt = opt || {};
      const now = this.ctx.currentTime;
      // throttle identical sounds in the same instant (e.g. 10 cluster bombs)
      const last = this._lastPlay[name] || 0;
      if (now - last < 0.035) return;
      this._lastPlay[name] = now;
      const t = now + 0.005;
      const size = opt.size || 1;
      switch (name) {
        case 'fire':
          this._noise(t, 0.35, { f0: 1800, f1: 200, vol: 0.55 });
          this._tone(t, 0.3, { type: 'sine', f0: 140, f1: 40, vol: 0.6 });
          break;
        case 'heavyfire':
          this._noise(t, 0.6, { f0: 1200, f1: 120, vol: 0.7 });
          this._tone(t, 0.5, { type: 'triangle', f0: 90, f1: 30, vol: 0.7 });
          break;
        case 'rocket':
          this._noise(t, 0.7, { filter: 'bandpass', f0: 500, f1: 2400, q: 1.5, vol: 0.5, attack: 0.04 });
          this._tone(t, 0.25, { type: 'sawtooth', f0: 200, f1: 90, vol: 0.12, lp: 900 });
          break;
        case 'explosion': {
          const d = 0.5 + 0.5 * size;
          this._noise(t, d, { f0: 900 + 300 * size, f1: 60, vol: Math.min(0.9, 0.45 + 0.2 * size) });
          this._tone(t, d * 0.8, { type: 'sine', f0: 90, f1: 25, vol: Math.min(0.9, 0.5 + 0.2 * size) });
          if (size > 1.6) this._noise(t + 0.08, d * 1.4, { f0: 300, f1: 40, vol: 0.5 });
          break;
        }
        case 'small_boom':
          this._noise(t, 0.25, { f0: 1500, f1: 150, vol: 0.35 });
          break;
        case 'hit':
          this._tone(t, 0.14, { type: 'square', f0: 260, f1: 90, vol: 0.18, lp: 1500 });
          break;
        case 'crit':
          this._tone(t, 0.12, { type: 'square', f0: 880, f1: 1760, vol: 0.14 });
          this._tone(t + 0.08, 0.2, { type: 'square', f0: 1320, f1: 2640, vol: 0.12 });
          break;
        case 'destroy':
          this._noise(t, 1.3, { f0: 700, f1: 40, vol: 0.8 });
          this._tone(t, 1.0, { type: 'sawtooth', f0: 120, f1: 20, vol: 0.35, lp: 600 });
          this._noise(t + 0.25, 0.8, { f0: 2500, f1: 300, vol: 0.25 });
          break;
        case 'laser':
          this._tone(t, 0.45, { type: 'sawtooth', f0: 1800, f1: 120, vol: 0.22, lp: 4000 });
          this._tone(t, 0.45, { type: 'square', f0: 900, f1: 60, vol: 0.1, detune: 12 });
          break;
        case 'plasma':
          this._tone(t, 0.4, { type: 'sine', f0: 200, f1: 900, vol: 0.3 });
          this._tone(t, 0.4, { type: 'triangle', f0: 402, f1: 1800, vol: 0.12 });
          break;
        case 'zap':
          for (let i = 0; i < 5; i++) this._tone(t + i * 0.04, 0.06, { type: 'square', f0: 300 + Math.random() * 1500, vol: 0.12 });
          this._noise(t, 0.3, { filter: 'highpass', f0: 3000, vol: 0.25 });
          break;
        case 'freeze':
          for (let i = 0; i < 6; i++) this._tone(t + i * 0.05, 0.3, { type: 'sine', f0: 1600 + i * 300, vol: 0.08 });
          break;
        case 'burn':
          this._noise(t, 0.6, { filter: 'bandpass', f0: 700, f1: 300, q: 0.5, vol: 0.3, attack: 0.1 });
          break;
        case 'poison':
          this._tone(t, 0.5, { type: 'sine', f0: 300, f1: 140, vol: 0.2 });
          this._noise(t, 0.5, { filter: 'bandpass', f0: 400, q: 3, vol: 0.2 });
          break;
        case 'bounce':
          this._tone(t, 0.1, { type: 'sine', f0: 380, f1: 180, vol: 0.3 });
          break;
        case 'drill':
          this._tone(t, 0.5, { type: 'sawtooth', f0: 90, f1: 140, vol: 0.12, lp: 800 });
          this._noise(t, 0.5, { filter: 'bandpass', f0: 900, q: 2, vol: 0.2 });
          break;
        case 'click':
          this._tone(t, 0.05, { type: 'sine', f0: 700, f1: 500, vol: 0.18 });
          break;
        case 'select':
          this._tone(t, 0.07, { type: 'triangle', f0: 520, f1: 780, vol: 0.2 });
          break;
        case 'error':
          this._tone(t, 0.15, { type: 'square', f0: 180, vol: 0.12, lp: 1000 });
          this._tone(t + 0.12, 0.2, { type: 'square', f0: 140, vol: 0.12, lp: 1000 });
          break;
        case 'coin':
          this._tone(t, 0.08, { type: 'square', f0: 988, vol: 0.1 });
          this._tone(t + 0.07, 0.25, { type: 'square', f0: 1319, vol: 0.1 });
          break;
        case 'upgrade':
          [523, 659, 784, 1047].forEach((f, i) => this._tone(t + i * 0.06, 0.18, { type: 'triangle', f0: f, vol: 0.2 }));
          break;
        case 'unlock':
          [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(t + i * 0.07, 0.3, { type: 'triangle', f0: f, vol: 0.2 }));
          this._noise(t + 0.3, 0.5, { filter: 'highpass', f0: 5000, vol: 0.12 });
          break;
        case 'victory':
          [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.62], [1047, 0.75]].forEach(([f, d]) => {
            this._tone(t + d, 0.35, { type: 'square', f0: f, vol: 0.1, lp: 3000 });
            this._tone(t + d, 0.35, { type: 'triangle', f0: f / 2, vol: 0.2 });
          });
          break;
        case 'defeat':
          [[392, 0], [370, 0.25], [349, 0.5], [262, 0.8]].forEach(([f, d]) => this._tone(t + d, 0.5, { type: 'sawtooth', f0: f, vol: 0.1, lp: 1200 }));
          break;
        case 'heal':
          this._tone(t, 0.5, { type: 'sine', f0: 400, f1: 1200, vol: 0.2 });
          this._tone(t + 0.1, 0.5, { type: 'sine', f0: 600, f1: 1600, vol: 0.12 });
          break;
        case 'shield':
          this._tone(t, 0.6, { type: 'triangle', f0: 220, f1: 660, vol: 0.2 });
          this._noise(t, 0.6, { filter: 'bandpass', f0: 2000, q: 4, vol: 0.12 });
          break;
        case 'teleport':
          this._tone(t, 0.4, { type: 'sine', f0: 1500, f1: 200, vol: 0.2 });
          this._tone(t + 0.2, 0.4, { type: 'sine', f0: 200, f1: 1500, vol: 0.2 });
          break;
        case 'whistle':
          this._tone(t, 0.9, { type: 'sine', f0: 1800, f1: 500, vol: 0.08 });
          break;
        case 'boss':
          this._tone(t, 1.6, { type: 'sawtooth', f0: 55, vol: 0.3, lp: 400, attack: 0.2 });
          this._tone(t, 1.6, { type: 'sawtooth', f0: 82, vol: 0.2, lp: 500, attack: 0.2 });
          break;
        case 'phase':
          this._tone(t, 1.0, { type: 'sawtooth', f0: 70, f1: 140, vol: 0.3, lp: 800 });
          this._noise(t, 1.0, { f0: 400, f1: 3000, vol: 0.3 });
          break;
        case 'turn':
          this._tone(t, 0.12, { type: 'sine', f0: 660, vol: 0.12 });
          this._tone(t + 0.1, 0.16, { type: 'sine', f0: 880, vol: 0.12 });
          break;
        case 'crate':
          this._tone(t, 0.15, { type: 'triangle', f0: 700, f1: 1400, vol: 0.2 });
          break;
        case 'thud':
          this._tone(t, 0.25, { type: 'sine', f0: 80, f1: 40, vol: 0.4 });
          break;
      }
    },

    /* ---------- engine rumble while tank moves ---------- */
    engine(on) {
      if (!this.ctx || !this.soundOn) on = false;
      if (on && !this._engine) {
        const c = this.ctx;
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 48;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 260;
        const g = c.createGain();
        g.gain.value = 0.0001;
        g.gain.linearRampToValueAtTime(0.12, c.currentTime + 0.1);
        o.connect(f);
        f.connect(g);
        g.connect(this.sfx);
        o.start();
        this._engine = { o, g };
      } else if (!on && this._engine) {
        const e = this._engine;
        this._engine = null;
        try {
          e.g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);
          e.o.stop(this.ctx.currentTime + 0.15);
        } catch (err) { /* ignore */ }
      }
    },

    /* ---------- procedural music ---------- */
    /** theme: {bpm, root, scale:[semitones], prog:[degrees], lead, bass, seed, drums, boss} */
    playMusic(theme) {
      if (!theme) return;
      if (!this.ctx) {
        this._pendingTheme = theme;
        return;
      }
      if (this.theme && this.theme.id === theme.id && this._timer) return;
      this.stopMusic(true);
      this.theme = theme;
      if (!this.musicOn) return;
      this._buildPattern(theme);
      this._step = 0;
      this._nextTime = this.ctx.currentTime + 0.1;
      this._timer = setInterval(() => this._schedule(), 30);
    },
    stopMusic(keepTheme) {
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
      if (!keepTheme) this.theme = null;
    },
    _midi(n) {
      return 440 * Math.pow(2, (n - 69) / 12);
    },
    _buildPattern(th) {
      const r = GT.U.rng(th.seed || 1);
      const scale = th.scale;
      const deg = (d, oct) => th.root + scale[((d % scale.length) + scale.length) % scale.length] + 12 * (Math.floor(d / scale.length) + (oct || 0));
      const steps = 64; // 4 bars x 16 steps
      const lead = new Array(steps).fill(null);
      const bass = new Array(steps).fill(null);
      const arp = new Array(steps).fill(null);
      for (let bar = 0; bar < 4; bar++) {
        const chord = th.prog[bar % th.prog.length];
        const tones = [chord, chord + 2, chord + 4];
        for (let s = 0; s < 16; s++) {
          const i = bar * 16 + s;
          // bass: root on beats, octave hops
          if (s % 4 === 0) bass[i] = deg(chord, -2);
          else if (s % 4 === 2 && r() < 0.5) bass[i] = deg(chord, -1);
          // arpeggio on 8ths
          if (s % 2 === 0 && th.arp !== false) arp[i] = deg(tones[(s / 2) % 3], 0);
          // lead: sparse melody from chord tones / scale
          if ((s % 2 === 0 && r() < (th.density || 0.45)) || s === 0) {
            const d = r() < 0.65 ? r.pick(tones) : chord + r.int(-1, 5);
            lead[i] = { n: deg(d, 1), len: r() < 0.3 ? 4 : 2 };
          }
        }
      }
      // make bar 4 answer bar 2 for musicality
      for (let s = 0; s < 16; s++) if (r() < 0.6) lead[48 + s] = lead[16 + s];
      this._pat = { lead, bass, arp, steps };
    },
    _schedule() {
      if (!this.ctx || !this.theme || !this._pat) return;
      const th = this.theme;
      const stepDur = 60 / th.bpm / 4;
      while (this._nextTime < this.ctx.currentTime + 0.15) {
        const i = this._step % this._pat.steps;
        const t = this._nextTime;
        const dest = this.music;
        const L = this._pat.lead[i];
        if (L) this._tone(t, stepDur * L.len * 0.95, { type: th.lead || 'triangle', f0: this._midi(L.n), vol: 0.13, attack: 0.01, dest, lp: 2600 });
        const B = this._pat.bass[i];
        if (B) this._tone(t, stepDur * 1.8, { type: th.bass || 'sawtooth', f0: this._midi(B), vol: 0.16, dest, lp: 420 });
        const R = this._pat.arp[i];
        if (R) this._tone(t, stepDur * 0.8, { type: 'sine', f0: this._midi(R + 12), vol: 0.035, dest });
        // drums
        const s = i % 16;
        const dr = th.drums || 'basic';
        if (s % 4 === 0 || (dr === 'boss' && s % 4 === 2 && s !== 6)) this._tone(t, 0.18, { type: 'sine', f0: 120, f1: 40, vol: dr === 'soft' ? 0.18 : 0.32, dest });
        if (s === 4 || s === 12) this._noise(t, 0.16, { filter: 'highpass', f0: 1500, vol: dr === 'soft' ? 0.06 : 0.12, dest });
        if (s % 2 === 1 && dr !== 'soft') this._noise(t, 0.04, { filter: 'highpass', f0: 7000, vol: 0.05, dest });
        this._nextTime += stepDur;
        this._step++;
      }
    }
  });
})();

