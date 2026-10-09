'use strict';
/* =====================================================================
   SUPER GREJS - audio.js
   Al lyd og musik genereres i browseren med Web Audio API. Der er ingen
   lydfiler, og alle melodier er skrevet til Super Grejs.
   Lyd starter først efter brugerens første klik/tastetryk (browserregel).
   ===================================================================== */
SG.audio = (function () {
  let ctx = null;
  let master, musicBus, sfxBus, noiseBuf, pulse25, pulse12;
  const settings = { music: true, musicVol: 0.55, sfx: true, sfxVol: 0.8 };

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      musicBus = ctx.createGain();
      sfxBus = ctx.createGain();
      musicBus.connect(master);
      sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      pulse25 = makePulse(0.25);
      pulse12 = makePulse(0.125);
      applyVolumes();
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (pendingSong && !music.current) music.play(pendingSong);
  }

  function makePulse(duty) {
    const n = 64;
    const re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return ctx.createPeriodicWave(re, im);
  }

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musicBus.gain.setTargetAtTime(settings.music ? settings.musicVol * 0.5 : 0, t, 0.05);
    sfxBus.gain.setTargetAtTime(settings.sfx ? settings.sfxVol * 0.6 : 0, t, 0.02);
  }

  function configure(s) {
    Object.assign(settings, s);
    applyVolumes();
  }

  const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(note) {
    if (typeof note === 'number') return note;
    const m = /^([A-G][#b]?)(-?\d)$/.exec(note);
    if (!m) return 440;
    const midi = NOTE_IDX[m[1]] + (Number(m[2]) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ---------------- Byggesten til lyd ---------------- */
  function osc(type, f, t0, dur, vol, bus, opts) {
    opts = opts || {};
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    if (type === 'pulse25') o.setPeriodicWave(pulse25);
    else if (type === 'pulse12') o.setPeriodicWave(pulse12);
    else o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + (opts.slide || dur));
    if (opts.vibrato) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = opts.vibrato;
      lg.gain.value = f * 0.025;
      l.connect(lg).connect(o.frequency);
      l.start(t0); l.stop(t0 + dur + 0.05);
    }
    const a = opts.attack || 0.004;
    const rel = opts.release == null ? Math.min(0.08, dur * 0.4) : opts.release;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    if (opts.decay) g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * opts.decay), t0 + dur);
    else g.gain.setValueAtTime(vol, Math.max(t0 + a, t0 + dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.01);
    o.connect(g).connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(t0, dur, vol, bus, opts) {
    opts = opts || {};
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.setValueAtTime(opts.f || 3000, t0);
    if (opts.fTo) f.frequency.exponentialRampToValueAtTime(opts.fTo, t0 + dur);
    f.Q.value = opts.q || 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t0, Math.random() * 0.5);
    s.stop(t0 + dur + 0.02);
  }

  /* ---------------- Lydeffekter ---------------- */
  const SFX = {
    jump(t, big) { osc('pulse25', big ? 190 : 260, t, 0.16, 0.22, sfxBus, { to: big ? 520 : 700, slide: 0.14 }); },
    coin(t) {
      osc('pulse12', 1320, t, 0.045, 0.2, sfxBus);
      osc('pulse12', 1980, t + 0.045, 0.05, 0.2, sfxBus);
      osc('triangle', 2640, t + 0.09, 0.22, 0.18, sfxBus, { decay: 0.05 });
    },
    stomp(t) {
      osc('square', 520, t, 0.1, 0.22, sfxBus, { to: 90 });
      noise(t, 0.08, 0.3, sfxBus, { f: 1800 });
    },
    bump(t) { osc('triangle', 150, t, 0.1, 0.4, sfxBus, { to: 70 }); noise(t, 0.05, 0.15, sfxBus, { f: 600 }); },
    brick(t) {
      noise(t, 0.28, 0.45, sfxBus, { f: 4000, fTo: 300 });
      osc('square', 180, t, 0.08, 0.15, sfxBus, { to: 60 });
    },
    sprout(t) { [0, 1, 2, 3, 4, 5].forEach(i => osc('pulse25', 300 + i * 90, t + i * 0.045, 0.05, 0.14, sfxBus)); },
    powerup(t) {
      ['C5', 'G5', 'E5', 'C6', 'G5', 'E6', 'C6', 'G6'].forEach((n, i) => osc('pulse25', freq(n), t + i * 0.05, 0.06, 0.17, sfxBus));
    },
    flower(t) {
      ['E5', 'B5', 'G#5', 'E6', 'B6'].forEach((n, i) => osc('square', freq(n), t + i * 0.06, 0.08, 0.12, sfxBus));
      osc('sine', 2000, t, 0.4, 0.08, sfxBus, { to: 4000 });
    },
    powerdown(t) { ['G5', 'D5', 'B4', 'G4', 'D4', 'B3'].forEach((n, i) => osc('pulse25', freq(n), t + i * 0.055, 0.06, 0.16, sfxBus)); },
    oneup(t) { ['E6', 'G6', 'E7', 'C7', 'D7', 'G7'].forEach((n, i) => osc('pulse12', freq(n), t + i * 0.08, 0.08, 0.15, sfxBus)); },
    fire(t) { osc('square', 900, t, 0.07, 0.12, sfxBus, { to: 200 }); noise(t, 0.05, 0.12, sfxBus, { f: 5000, filter: 'highpass' }); },
    kick(t) { osc('square', 700, t, 0.04, 0.16, sfxBus); osc('triangle', 300, t, 0.08, 0.3, sfxBus, { to: 120 }); },
    pipe(t) { [0, 1, 2].forEach(i => osc('pulse25', 220 - i * 50, t + i * 0.09, 0.08, 0.2, sfxBus, { to: 110 - i * 25 })); },
    hurt(t) { osc('square', 600, t, 0.25, 0.18, sfxBus, { to: 120 }); },
    die(t) {
      osc('pulse25', 880, t, 0.1, 0.2, sfxBus, { to: 440 });
      ['B4', 'F5', 'F5', 'F5', 'E5', 'D5', 'C5'].forEach((n, i) => osc('pulse25', freq(n) * 0.75, t + 0.35 + i * 0.13, 0.11, 0.17, sfxBus));
    },
    pause(t) { osc('pulse25', freq('E6'), t, 0.06, 0.15, sfxBus); osc('pulse25', freq('C6'), t + 0.08, 0.06, 0.15, sfxBus); osc('pulse25', freq('E6'), t + 0.16, 0.1, 0.15, sfxBus); },
    checkpoint(t) { ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => osc('triangle', freq(n), t + i * 0.07, 0.18, 0.2, sfxBus, { decay: 0.1 })); },
    spring(t) { osc('sine', 200, t, 0.3, 0.3, sfxBus, { to: 900, vibrato: 18 }); },
    bosshit(t) { noise(t, 0.3, 0.5, sfxBus, { f: 1200, fTo: 200 }); osc('square', 140, t, 0.25, 0.25, sfxBus, { to: 50 }); },
    roar(t) { noise(t, 0.6, 0.4, sfxBus, { f: 500, q: 6, filter: 'bandpass' }); osc('sawtooth', 90, t, 0.6, 0.18, sfxBus, { to: 60, vibrato: 11 }); },
    boom(t) { noise(t, 0.7, 0.6, sfxBus, { f: 900, fTo: 60 }); osc('sine', 110, t, 0.5, 0.45, sfxBus, { to: 30 }); },
    shoot(t) { osc('sawtooth', 500, t, 0.15, 0.12, sfxBus, { to: 160 }); },
    zap(t) { noise(t, 0.12, 0.18, sfxBus, { f: 6000, filter: 'highpass' }); osc('square', 1200, t, 0.1, 0.07, sfxBus, { to: 300 }); },
    crumble(t) { noise(t, 0.35, 0.25, sfxBus, { f: 700, fTo: 120 }); },
    slam(t) { osc('sine', 90, t, 0.35, 0.5, sfxBus, { to: 35 }); noise(t, 0.25, 0.35, sfxBus, { f: 400 }); },
    flag(t) { osc('pulse25', 1400, t, 0.8, 0.12, sfxBus, { to: 300, slide: 0.8 }); },
    tick(t) { osc('pulse12', 1760, t, 0.03, 0.08, sfxBus); },
    warn(t) { [0, 1, 2].forEach(i => { osc('pulse25', 1046, t + i * 0.16, 0.07, 0.14, sfxBus); osc('pulse25', 1318, t + i * 0.16 + 0.07, 0.07, 0.14, sfxBus); }); },
    door(t) { osc('triangle', 200, t, 0.12, 0.3, sfxBus, { to: 120 }); noise(t + 0.05, 0.1, 0.12, sfxBus, { f: 900 }); },
    ui(t) { osc('pulse25', 880, t, 0.04, 0.1, sfxBus); },
    select(t) { osc('pulse25', 660, t, 0.05, 0.12, sfxBus); osc('pulse25', 990, t + 0.05, 0.07, 0.12, sfxBus); },
    error(t) { osc('square', 180, t, 0.12, 0.13, sfxBus); osc('square', 140, t + 0.13, 0.16, 0.13, sfxBus); },
    clear(t) {
      ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => osc('pulse25', freq(n), t + i * 0.09, 0.09, 0.17, sfxBus));
      ['Ab5', 'C6', 'Eb6'].forEach((n, i) => osc('pulse25', freq(n), t + 0.6 + i * 0.12, 0.12, 0.17, sfxBus));
      ['Bb5', 'D6', 'F6', 'C7'].forEach((n, i) => osc('pulse25', freq(n), t + 0.96 + i * 0.12, i === 3 ? 0.7 : 0.12, 0.17, sfxBus));
      ['C3', 'G3', 'Ab3', 'Bb3', 'C4'].forEach((n, i) => osc('triangle', freq(n), t + i * 0.3, 0.28, 0.3, sfxBus));
    },
    gameover(t) {
      ['C5', 'G4', 'E4', 'A4', 'B4', 'A4', 'G#4', 'Bb4', 'G#4', 'G4', 'F4', 'G4'].forEach((n, i) => osc('pulse25', freq(n), t + i * 0.2, 0.18, 0.15, sfxBus));
    },
    fanfare(t) {
      ['G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => osc('pulse25', freq(n), t + i * 0.08, 0.08, 0.15, sfxBus));
      osc('pulse25', freq('E6'), t + 0.62, 0.3, 0.16, sfxBus);
      osc('pulse25', freq('G6'), t + 0.95, 0.9, 0.16, sfxBus, { vibrato: 6 });
      osc('triangle', freq('C4'), t + 0.62, 1.2, 0.3, sfxBus);
    },
  };

  let lastPlay = {};
  function sfx(name, arg) {
    if (!ctx || !settings.sfx || !SFX[name]) return;
    const now = ctx.currentTime;
    // Undgå at samme lyd hober sig op i samme frame.
    if (lastPlay[name] && now - lastPlay[name] < 0.03) return;
    lastPlay[name] = now;
    SFX[name](now + 0.005, arg);
  }

  /* =================================================================
     MUSIK - lille tracker. Hvert token er én 16.-del:
       "C5" = node, "-" = hold forrige node, "." = pause.
     ================================================================= */
  const bars = s => s.trim().split(/\s+/);
  // Bas ud fra akkord-grundtoner pr. takt.
  function bass(roots, style) {
    const out = [];
    const pat = style || 'r . o . f . o r r . o . f . o .';
    roots.forEach(r => {
      const [, n, o] = /^([A-G][#b]?)(\d)$/.exec(r);
      const fifthIdx = (NOTE_IDX[n] + 7) % 12;
      const fifthName = Object.keys(NOTE_IDX).find(k => NOTE_IDX[k] === fifthIdx && k.length <= 2 && !k.includes('b')) || n;
      const fifthOct = NOTE_IDX[n] + 7 >= 12 ? Number(o) + 1 : Number(o);
      bars(pat).forEach(tok => {
        if (tok === 'r') out.push(r);
        else if (tok === 'o') out.push(n + (Number(o) + 1));
        else if (tok === 'f') out.push(fifthName + fifthOct);
        else out.push(tok);
      });
    });
    return out;
  }
  const rep = (arr, n) => Array.from({ length: n }, () => arr).flat();

  const D_STD = bars('k . h . s . h k k . h . s . h h');
  const D_DRIVE = bars('k . h k s . h . k k h . s . h s');
  const D_HALF = bars('k . . . h . . . s . . . h . . .');
  const D_MECH = bars('k h . h s h k h . h k h s h . h');
  const D_BOSS = bars('k h s h k h s h k k s h k h s s');

  const SONGS = {
    title: {
      bpm: 128, lead: 'pulse25',
      lead1: bars(`D5 - G5 - B5 - D6 - - - B5 - D6 - E6 -  D6 - - - B5 - G5 - A5 - - - - - . .
                   C6 - - - A5 - F#5 - D5 - F#5 - A5 - C6 -  B5 - - - - - - - D5 - G5 - B5 - . .
                   E6 - - - D6 - C6 - B5 - - - A5 - G5 -  C6 - - - B5 - A5 - G5 - - - F#5 - E5 -
                   D5 - G5 - B5 - D6 - G6 - - - F#6 - E6 -  D6 - - - - - - - . . . . . . . .`),
      bass: bass(['G2', 'G2', 'D3', 'G2', 'C3', 'G2', 'D3', 'G2']),
      drums: rep(D_STD, 8),
    },
    w1: {
      bpm: 144, lead: 'pulse25',
      lead1: bars(`E5 - G5 - C6 - - - B5 - G5 - E5 - - -  F5 - A5 - D6 - - - C6 - A5 - F5 - - -
                   E5 - G5 - C6 - E6 - D6 - C6 - A5 - G5 -  F5 - E5 - D5 - - - G4 - B4 - D5 - - -
                   A5 - - - C6 - B5 - A5 - E5 - - - . .  F5 - A5 - C6 - - - A5 - F5 - - - . .
                   G5 - E5 - C5 - E5 - G5 - C6 - E6 - - -  D6 - C6 - B5 - G5 - D5 - - - . . . .`),
      bass: bass(['C3', 'F2', 'C3', 'G2', 'A2', 'F2', 'C3', 'G2']),
      drums: rep(D_STD, 8),
    },
    w2: {
      bpm: 132, lead: 'pulse25',
      lead1: bars(`A4 - C5 - E5 - A5 - G5 - E5 - C5 - D5 -  E5 - - - . . E5 - F5 - E5 - D5 - C5 -
                   F5 - A5 - C6 - A5 - F5 - C5 - F5 - A5 -  G#5 - - - B5 - - - E5 - - - . . . .
                   D5 - F5 - A5 - - - G5 - F5 - E5 - D5 -  C5 - E5 - A5 - - - B5 - C6 - B5 - A5 -
                   G#5 - E5 - B4 - E5 - G#5 - B5 - D6 - B5 -  A5 - - - E5 - - - A4 - - - . . . .`),
      bass: bass(['A2', 'A2', 'F2', 'E2', 'D2', 'A2', 'E2', 'A2'], 'r . r o . r f . r . r o . f o .'),
      drums: rep(D_STD, 8),
    },
    w3: {
      bpm: 116, lead: 'triangle', leadVol: 0.32,
      lead1: bars(`A5 - - - C6 - - - F6 - - - E6 - C6 -  G5 - - - C6 - - - E6 - - - D6 - C6 -
                   A5 - - - D6 - - - F6 - - - E6 - D6 -  D6 - - - C6 - A5 - Bb5 - - - . . . .
                   G5 - Bb5 - D6 - - - C6 - Bb5 - A5 - G5 -  E5 - G5 - C6 - - - Bb5 - A5 - G5 - E5 -
                   F5 - A5 - C6 - F6 - E6 - C6 - A5 - C6 -  G5 - - - - - - - . . . . . . . .`),
      bass: bass(['F2', 'C3', 'D3', 'Bb2', 'G2', 'C3', 'F2', 'C3'], 'r . . . f . . . o . . . f . . .'),
      drums: rep(D_HALF, 8),
      arp: true,
    },
    w4: {
      bpm: 156, lead: 'square', leadVol: 0.12,
      lead1: bars(`D5 - . D5 F5 - . D5 A5 - G5 - F5 - E5 -  D5 - . D5 F5 - . D5 C6 - A5 - G5 - F5 -
                   Bb5 - A5 - G5 - F5 - G5 - A5 - Bb5 - G5 -  A5 - - - C#6 - - - E6 - - - A5 - . .
                   G5 - Bb5 - D6 - . G5 Bb5 - D6 - G6 - - -  F6 - E6 - D6 - A5 - F5 - A5 - D6 - - -
                   Bb5 - D6 - F6 - D6 - Bb5 - F5 - D5 - F5 -  E5 - - - A5 - - - C#6 - - - E6 - . .`),
      bass: bass(['D2', 'D2', 'Bb1', 'A1', 'G2', 'D2', 'Bb1', 'A1'], 'r r o r r r o r r r o r f f o f'),
      drums: rep(D_DRIVE, 8),
    },
    w5: {
      bpm: 108, lead: 'sine', leadVol: 0.3, bell: true,
      lead1: bars(`B5 - - - G5 - - - E5 - - - F#5 - G5 -  E6 - - - C6 - - - G5 - - - A5 - B5 -
                   D6 - - - B5 - - - G5 - - - B5 - D6 -  F#6 - - - E6 - D6 - A5 - - - . . . .
                   C6 - - - A5 - - - E5 - - - A5 - C6 -  B5 - - - G5 - - - E5 - - - G5 - B5 -
                   E6 - - - D6 - C6 - G5 - - - E5 - G5 -  F#5 - - - D#5 - - - B4 - - - . . . .`),
      bass: bass(['E2', 'C3', 'G2', 'D3', 'A2', 'E2', 'C3', 'B2'], 'r . . . . . f . o . . . . . f .'),
      drums: rep(bars('k . . . h . . . s . . . h . h .'), 8),
    },
    w6: {
      bpm: 96, lead: 'triangle', leadVol: 0.3,
      lead1: bars(`G5 - - - . . Bb5 - A5 - - - G5 - . .  Eb5 - - - . . G5 - F5 - - - Eb5 - . .
                   C5 - - - Eb5 - G5 - C6 - - - Bb5 - A5 -  F#5 - - - - - - - D5 - - - . . . .
                   D6 - - - C6 - Bb5 - A5 - - - G5 - . .  G5 - - - Bb5 - Eb6 - D6 - - - . . . .
                   C6 - - - A5 - F5 - A5 - - - C6 - . .  A5 - - - F#5 - - - D5 - - - . . . .`),
      bass: bass(['G2', 'Eb2', 'C2', 'D2', 'G2', 'Eb2', 'F2', 'D2'], 'r - - - . . . . f - - - . . . .'),
      drums: rep(bars('k . . . . . h . . . k . s . . .'), 8),
    },
    w7: {
      bpm: 138, lead: 'pulse25',
      lead1: bars(`B4 B4 . B4 D5 - . D5 F#5 - E5 - D5 - C#5 -  B4 B4 . B4 D5 - . D5 G5 - F#5 - E5 - D5 -
                   A4 A4 . A4 D5 - . D5 F#5 - A5 - F#5 - D5 -  C#5 - E5 - A5 - - - G5 - F#5 - E5 - . .
                   E5 - G5 - B5 - G5 - E5 - G5 - B5 - E6 -  D6 - B5 - G5 - B5 - D6 - - - . . . .
                   C#6 - A5 - E5 - A5 - C#6 - E6 - C#6 - A5 -  A#5 - - - F#5 - - - C#5 - - - F#5 - . .`),
      bass: bass(['B1', 'G1', 'D2', 'A1', 'E2', 'G1', 'A1', 'F#1'], 'r . r . o . r . r . r . o . f .'),
      drums: rep(D_MECH, 8),
    },
    w8: {
      bpm: 168, lead: 'square', leadVol: 0.12,
      lead1: bars(`C5 - Eb5 - G5 - C6 - Bb5 - G5 - Eb5 - G5 -  Ab5 - - - C6 - - - Eb6 - D6 - C6 - Ab5 -
                   Bb5 - - - D6 - - - F6 - Eb6 - D6 - Bb5 -  B5 - - - D6 - - - G6 - - - F6 - D6 -
                   F5 - Ab5 - C6 - F6 - Eb6 - C6 - Ab5 - F5 -  G5 - C6 - Eb6 - G6 - F6 - Eb6 - D6 - C6 -
                   Ab5 - C6 - Eb6 - Ab6 - G6 - F6 - Eb6 - C6 -  B5 - - - G5 - - - D5 - - - G4 - . .`),
      bass: bass(['C2', 'Ab1', 'Bb1', 'G1', 'F1', 'C2', 'Ab1', 'G1'], 'r r o r r r o r r r o r f r o f'),
      drums: rep(D_DRIVE, 8),
    },
    fort: {
      bpm: 120, lead: 'pulse25',
      lead1: bars(`E5 - G5 - Bb5 - - - A5 - G5 - E5 - . .  F5 - Ab5 - B5 - - - Bb5 - Ab5 - F5 - . .
                   E5 - G5 - Bb5 - Db6 - C6 - Bb5 - G5 - E5 -  F5 - - - E5 - - - D#5 - - - . . . .`),
      bass: bass(['E2', 'F2', 'E2', 'B1'], 'r r . r r r . r r r . r o . r .'),
      drums: rep(bars('k . . k s . . . k . . k s . k .'), 4),
    },
    boss: {
      bpm: 176, lead: 'square', leadVol: 0.12,
      lead1: bars(`E5 E5 . E5 G5 - E5 - B5 - A5 - G5 - F#5 -  E5 E5 . E5 G5 - E5 - C6 - B5 - A5 - B5 -
                   E5 E5 . E5 G5 - E5 - D6 - C6 - B5 - A5 -  B5 - - - D#6 - - - F#6 - - - B5 - - -`),
      bass: bass(['E2', 'C2', 'D2', 'B1'], 'r r o r r r o r r r o r r r o r'),
      drums: rep(D_BOSS, 4),
    },
    star: {
      bpm: 184, lead: 'pulse12',
      lead1: bars(`C6 E6 G6 C7 G6 E6 C6 E6 G6 C7 G6 E6 C6 - . .  D6 F6 A6 D7 A6 F6 D6 F6 A6 D7 A6 F6 D6 - . .`),
      bass: bass(['C3', 'D3'], 'r . o . r . o . r . o . r . o .'),
      drums: rep(bars('k h s h k h s h k h s h k k s h'), 2),
    },
    ending: {
      bpm: 140, lead: 'pulse25',
      lead1: bars(`G5 - - - B5 - D6 - G6 - - - F#6 - E6 -  D6 - - - B5 - G5 - A5 - - - - - . .
                   C6 - E6 - G6 - - - F#6 - E6 - D6 - C6 -  B5 - - - D6 - - - G6 - - - - - - -`),
      bass: bass(['G2', 'D3', 'C3', 'G2']),
      drums: rep(D_STD, 4),
    },
  };

  /* ---------------- Sequencer ---------------- */
  let pendingSong = null;
  const music = {
    current: null,
    song: null,
    step: 0,
    nextTime: 0,
    timer: null,
    speed: 1,
    play(id) {
      pendingSong = id;
      if (!ctx) return;
      if (this.current === id) return;
      this.stop();
      const s = SONGS[id];
      if (!s) return;
      this.current = id;
      this.song = s;
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.08;
      this.timer = setInterval(() => this.tick(), 25);
    },
    stop() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.current = null;
      this.song = null;
    },
    setSpeed(x) { this.speed = x; },
    tick() {
      if (!ctx || !this.song) return;
      const s = this.song;
      const stepDur = 60 / (s.bpm * this.speed) / 4;
      const len = s.lead1.length;
      while (this.nextTime < ctx.currentTime + 0.12) {
        const i = this.step % len;
        const t = this.nextTime;
        this.playTrack(s.lead1, i, t, stepDur, s.lead, s.leadVol || 0.16, s.bell);
        if (s.bass) this.playTrack(s.bass, i % s.bass.length, t, stepDur, 'triangle', 0.32);
        if (s.arp && i % 2 === 0) {
          const tok = s.bass[i % s.bass.length];
          if (tok !== '.' && tok !== '-') osc('pulse12', freq(tok) * 4, t, stepDur * 0.8, 0.035, musicBus);
        }
        if (s.drums) this.drum(s.drums[i % s.drums.length], t);
        this.nextTime += stepDur;
        this.step++;
      }
    },
    playTrack(arr, i, t, stepDur, type, vol, bell) {
      const tok = arr[i];
      if (!tok || tok === '.' || tok === '-') return;
      let n = 1;
      while (arr[(i + n) % arr.length] === '-' && n < 16) n++;
      const dur = n * stepDur * 0.95;
      osc(type, freq(tok), t, dur, vol, musicBus, bell ? { decay: 0.15 } : { release: 0.03 });
      if (bell) osc('sine', freq(tok) * 2, t, dur * 0.6, vol * 0.25, musicBus, { decay: 0.05 });
    },
    drum(tok, t) {
      if (tok === 'k') osc('sine', 150, t, 0.12, 0.55, musicBus, { to: 45, slide: 0.1 });
      else if (tok === 's') noise(t, 0.12, 0.25, musicBus, { f: 2400, filter: 'bandpass', q: 0.8 });
      else if (tok === 'h') noise(t, 0.035, 0.12, musicBus, { f: 8000, filter: 'highpass' });
    },
  };

  return {
    unlock,
    configure,
    sfx,
    music: {
      play: id => music.play(id),
      stop: () => { pendingSong = null; music.stop(); },
      setSpeed: x => music.setSpeed(x),
      get current() { return music.current; },
    },
    get ready() { return !!ctx; },
  };
})();
