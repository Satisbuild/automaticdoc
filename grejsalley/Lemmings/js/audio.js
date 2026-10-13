/* GrejsAlley Lemmings — audio.js
 * All sound is synthesized with the Web Audio API (no audio files needed):
 * short sound effects plus a small procedural chiptune per world.
 * The AudioContext is only created after the first user interaction, so the
 * browser never blocks or starts sound unexpectedly.
 */
(function (GL) {
  'use strict';

  const SONGS = {
    menu: { root: 55, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 100, prog: [0, 5, 3, 4], lead: 'square', seed: 3 },
    hills: { root: 60, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 112, prog: [0, 5, 3, 4], lead: 'square', seed: 1 },
    caves: { root: 57, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 90, prog: [0, 5, 6, 4], lead: 'triangle', seed: 7, echo: true },
    ice: { root: 62, scale: [0, 2, 4, 7, 9], bpm: 100, prog: [0, 3, 4, 0], lead: 'sine', seed: 5, echo: true },
    desert: { root: 50, scale: [0, 1, 4, 5, 7, 8, 10], bpm: 104, prog: [0, 1, 0, 6], lead: 'square', seed: 9 },
    industry: { root: 52, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 124, prog: [0, 0, 5, 6], lead: 'sawtooth', seed: 11 },
  };

  const Audio = {
    ctx: null, master: null, sfxGain: null, musicGain: null,
    settings: null,
    last: {},
    song: null, songName: null, timer: 0, step: 0, nextTime: 0,

    init(settings) { this.settings = settings; },

    // Call from a user gesture (pointerdown/keydown). Safe to call repeatedly.
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { this.ctx = new AC(); } catch (e) { return; }
        this.master = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.master);
        this.musicGain.connect(this.master);
        this.master.connect(this.ctx.destination);
        // short echo used by some songs
        this.delay = this.ctx.createDelay(1);
        this.delay.delayTime.value = 0.28;
        this.delayGain = this.ctx.createGain();
        this.delayGain.gain.value = 0.25;
        this.delay.connect(this.delayGain); this.delayGain.connect(this.delay); this.delayGain.connect(this.musicGain);
        this.applySettings();
        if (this.pendingSong) { const s = this.pendingSong; this.pendingSong = null; this.playSong(s); }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    applySettings() {
      if (!this.ctx) return;
      const s = this.settings, t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(s.volume, t, 0.05);
      this.sfxGain.gain.setTargetAtTime(s.sfx ? 0.9 : 0, t, 0.05);
      this.musicGain.gain.setTargetAtTime(s.music ? s.musicVolume * 0.55 : 0, t, 0.05);
    },

    /* ------------------------------- primitives ------------------------------ */
    tone(freq, dur, type, vol, slide, delay, dest) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || this.sfxGain);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol, filter, freq, sweepTo, delay, dest) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + (delay || 0);
      if (!this.noiseBuf) {
        const len = c.sampleRate * 1;
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = c.createBufferSource(); src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = filter || 'lowpass'; f.frequency.setValueAtTime(freq || 1000, t);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    },
    throttle(name, ms) {
      const now = performance.now();
      if (this.last[name] && now - this.last[name] < ms) return false;
      this.last[name] = now; return true;
    },

    /* ------------------------------ sound effects ----------------------------- */
    play(name) {
      if (!this.ctx || !this.settings.sfx) return;
      switch (name) {
        case 'select': this.tone(660, 0.06, 'square', 0.08, 990); break;
        case 'click': this.tone(520, 0.04, 'triangle', 0.1); break;
        case 'assign': this.tone(440, 0.09, 'triangle', 0.18, 880); this.tone(880, 0.06, 'sine', 0.08, null, 0.05); break;
        case 'deny': this.tone(180, 0.12, 'square', 0.08, 120); break;
        case 'dig': if (this.throttle(name, 70)) this.noise(0.07, 0.16, 'lowpass', 900, 300); break;
        case 'brick': if (this.throttle(name, 60)) this.tone(1150, 0.035, 'triangle', 0.08); break;
        case 'bricksLow': this.tone(880, 0.06, 'square', 0.07); this.tone(660, 0.08, 'square', 0.07, null, 0.08); break;
        case 'explode':
          this.noise(0.7, 0.55, 'lowpass', 1600, 80);
          this.tone(130, 0.5, 'sine', 0.5, 35);
          break;
        case 'saved':
          if (!this.throttle(name, 50)) break;
          [784, 988, 1318].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.12, null, i * 0.05));
          break;
        case 'splat': this.noise(0.18, 0.25, 'bandpass', 500, 200); this.tone(320, 0.18, 'sine', 0.15, 70); break;
        case 'drown': for (let i = 0; i < 4; i++) this.tone(380 + i * 90, 0.06, 'sine', 0.1, 700 + i * 80, i * 0.07); break;
        case 'burn': this.noise(0.35, 0.18, 'highpass', 1800, 600); this.tone(260, 0.2, 'sawtooth', 0.05, 90); break;
        case 'acid': this.noise(0.3, 0.16, 'bandpass', 1400, 300); break;
        case 'steel': if (this.throttle(name, 120)) { this.tone(1900, 0.05, 'square', 0.08); this.tone(2500, 0.08, 'square', 0.05, null, 0.03); } break;
        case 'hatch': this.tone(180, 0.35, 'square', 0.06, 320); this.noise(0.25, 0.08, 'lowpass', 600); break;
        case 'letsgo': [523, 659, 784].forEach((f, i) => this.tone(f, 0.1, 'square', 0.07, null, 0.4 + i * 0.09)); break;
        case 'umbrella': this.noise(0.18, 0.08, 'bandpass', 2400, 900); break;
        case 'nuke': [600, 500, 400, 300].forEach((f, i) => this.tone(f, 0.14, 'square', 0.09, null, i * 0.13)); break;
        case 'goal': [659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.13, null, i * 0.08)); break;
        case 'win':
          [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, i === 5 ? 0.5 : 0.14, 'square', 0.09, null, i * 0.12));
          [262, 330, 392].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.1, null, 0.6 + i * 0.01));
          break;
        case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, i === 3 ? 0.6 : 0.2, 'triangle', 0.13, null, i * 0.2)); break;
        case 'land': if (this.throttle(name, 80)) this.noise(0.05, 0.06, 'lowpass', 500); break;
      }
    },

    // Map game events to effects.
    handleEvents(events) {
      for (const e of events) {
        switch (e.type) {
          case 'dig': case 'brick': case 'bricksLow': case 'explode': case 'saved': case 'splat':
          case 'drown': case 'steel': case 'hatch': case 'umbrella': case 'nuke': case 'goal':
            this.play(e.type); break;
          case 'burn': this.play(e.hazard === 'acid' ? 'acid' : 'burn'); break;
          case 'assign': this.play('assign'); break;
          case 'win': this.play('win'); break;
          case 'lose': this.play('lose'); break;
        }
      }
    },

    /* ---------------------------------- music --------------------------------- */
    playSong(name) {
      if (!this.ctx) { this.pendingSong = name; return; }
      if (this.songName === name && this.timer) return;
      this.stopSong();
      const def = SONGS[name] || SONGS.menu;
      this.songName = name;
      this.song = buildSong(def);
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 90);
    },
    stopSong() {
      if (this.timer) clearInterval(this.timer);
      this.timer = 0; this.songName = null;
    },
    schedule() {
      const c = this.ctx; if (!c || !this.song) return;
      if (c.state !== 'running') return;
      const s = this.song, stepDur = 60 / s.bpm / 2;
      while (this.nextTime < c.currentTime + 0.35) {
        const i = this.step % s.steps.length, st = s.steps[i];
        const t = this.nextTime - c.currentTime;
        if (st.lead) this.note(st.lead, stepDur * (st.len || 1) * 0.9, s.lead, 0.07, t, s.echo);
        if (st.bass) this.note(st.bass, stepDur * 1.8, 'triangle', 0.16, t);
        if (st.pad) st.pad.forEach(n => this.note(n, stepDur * 7.5, 'sine', 0.025, t));
        if (st.hat) this.noise(0.03, st.hat, 'highpass', 6000, null, t, this.musicGain);
        if (st.kick) this.tone(120, 0.12, 'sine', 0.22, 40, t, this.musicGain);
        this.nextTime += stepDur;
        this.step++;
      }
    },
    note(midi, dur, type, vol, delay, echo) {
      const c = this.ctx;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.musicGain);
      if (echo) g.connect(this.delay);
      o.start(t); o.stop(t + dur + 0.05);
    },
  };

  // Seeded procedural song: 4 bars x 16 eighth-notes, chord-aware melody.
  function buildSong(def) {
    let seed = def.seed * 9301 + 49297;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const sc = def.scale;
    const deg = (d, oct) => def.root + sc[((d % sc.length) + sc.length) % sc.length] + 12 * (oct + Math.floor(d / sc.length));
    const steps = [];
    let prev = 2;
    for (let bar = 0; bar < 8; bar++) {
      const chord = def.prog[bar % def.prog.length];
      for (let i = 0; i < 16; i++) {
        const st = {};
        if (i % 4 === 0) st.bass = deg(chord, -1) + (i === 8 ? 7 : 0);
        if (i === 0) st.pad = [deg(chord, 0), deg(chord + 2, 0), deg(chord + 4, 0)];
        if (i % 2 === 1) st.hat = 0.025;
        if (i % 8 === 0) st.kick = true;
        const strong = i % 4 === 0;
        if (rnd() < (strong ? 0.9 : 0.45)) {
          let d = strong ? chord + [0, 2, 4][(rnd() * 3) | 0] : prev + ((rnd() * 5) | 0) - 2;
          d = Math.max(chord - 3, Math.min(chord + 9, d));
          prev = d;
          st.lead = deg(d, 1);
          if (rnd() < 0.25) st.len = 2;
        }
        steps.push(st);
      }
    }
    return { steps, bpm: def.bpm, lead: def.lead, echo: def.echo };
  }

  GL.Audio = Audio;
})(window.GL = window.GL || {});
