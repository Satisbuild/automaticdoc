'use strict';
/* =====================================================================
   GREJS VS ZOMBIES - audio.js
   Al lyd og musik genereres med Web Audio API - ingen lydfiler.
   Lyd startes først efter brugerens første klik/tryk (browserregel).
   ===================================================================== */
GVZ.Audio = (function () {
  const U = GVZ.U;
  let ctx = null, master, musicBus, sfxBus, noiseBuf;
  const st = { musicVol: 0.5, sfxVol: 0.8, mute: false };
  let pendingSong = null;
  const lastPlay = {};

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { ctx = null; return; }
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      musicBus = ctx.createGain(); sfxBus = ctx.createGain();
      musicBus.connect(master); sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      apply();
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (pendingSong) { const s = pendingSong; pendingSong = null; playSong(s); }
  }
  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(st.mute ? 0 : 0.9, t, 0.05);
    musicBus.gain.setTargetAtTime(st.musicVol * 0.45, t, 0.05);
    sfxBus.gain.setTargetAtTime(st.sfxVol * 0.7, t, 0.02);
  }
  function configure(s) { Object.assign(st, s); apply(); }

  function tone(type, f, t0, dur, vol, bus, to, attack) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + (attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, vol, filterType, freq, to, bus, q) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = filterType || 'lowpass';
    f.frequency.setValueAtTime(freq || 1200, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
    f.Q.value = q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(bus || sfxBus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  const N = (semi, base) => (base || 440) * Math.pow(2, semi / 12);

  /* Lydeffekter. throttle (ms) undgår, at 40 skud på én gang larmer */
  const SFX = {
    click: () => tone('sine', 660, now(), 0.06, 0.12),
    hover: () => tone('sine', 880, now(), 0.04, 0.05),
    select: () => { const t = now(); tone('triangle', 520, t, 0.07, 0.15); tone('triangle', 780, t + 0.05, 0.08, 0.12); },
    deny: () => { const t = now(); tone('square', 180, t, 0.12, 0.08); tone('square', 140, t + 0.1, 0.14, 0.08); },
    place: () => { const t = now(); noise(t, 0.12, 0.35, 'lowpass', 600, 150); tone('sine', 160, t, 0.15, 0.3, null, 70); },
    shovel: () => { const t = now(); noise(t, 0.2, 0.3, 'bandpass', 900, 300); tone('triangle', 300, t, 0.15, 0.12, null, 120); },
    shoot: () => { const t = now(); tone('sine', 420 + Math.random() * 60, t, 0.09, 0.16, null, 160); noise(t, 0.04, 0.12, 'highpass', 2000); },
    shootHeavy: () => { const t = now(); tone('sine', 220, t, 0.18, 0.3, null, 80); noise(t, 0.08, 0.2, 'lowpass', 800); },
    lob: () => { const t = now(); tone('triangle', 300, t, 0.2, 0.15, null, 600); },
    hit: () => { const t = now(); noise(t, 0.07, 0.2, 'bandpass', 1400 + Math.random() * 600, 500, null, 2); },
    armor: () => { const t = now(); tone('square', 900 + Math.random() * 200, t, 0.06, 0.07, null, 600); tone('triangle', 1800, t, 0.08, 0.05); },
    splat: () => { const t = now(); noise(t, 0.15, 0.25, 'lowpass', 900, 200); },
    explode: () => { const t = now(); noise(t, 0.9, 0.9, 'lowpass', 1800, 60); tone('sine', 90, t, 0.6, 0.6, null, 30); },
    bigExplode: () => { const t = now(); noise(t, 1.5, 1.0, 'lowpass', 2500, 40); tone('sine', 70, t, 1.1, 0.8, null, 22); noise(t + 0.08, 0.6, 0.4, 'highpass', 3000, 400); },
    freeze: () => { const t = now(); for (let i = 0; i < 6; i++) tone('sine', 1200 + i * 260, t + i * 0.03, 0.4, 0.06); noise(t, 0.6, 0.15, 'highpass', 5000); },
    zap: () => { const t = now(); tone('sawtooth', 900, t, 0.18, 0.12, null, 200); noise(t, 0.18, 0.18, 'highpass', 3000); },
    laser: () => { const t = now(); tone('sawtooth', 1400, t, 0.35, 0.12, null, 300); tone('sine', 700, t, 0.35, 0.12, null, 150); },
    fire: () => { const t = now(); noise(t, 0.5, 0.35, 'bandpass', 900, 300, null, 0.6); },
    poison: () => { const t = now(); noise(t, 0.3, 0.2, 'bandpass', 500, 900, null, 3); tone('sine', 200, t, 0.25, 0.08, null, 260); },
    chomp: () => { const t = now(); noise(t, 0.06, 0.3, 'bandpass', 700, 300, null, 1.5); },
    gulp: () => { const t = now(); tone('sine', 300, t, 0.3, 0.3, null, 80); noise(t + 0.15, 0.25, 0.2, 'lowpass', 500, 100); },
    sun: () => { const t = now(); tone('sine', N(7, 880), t, 0.12, 0.12); tone('sine', N(12, 880), t + 0.06, 0.16, 0.1); },
    sunDrop: () => tone('triangle', 900, now(), 0.15, 0.04, null, 1300),
    coin: () => { const t = now(); tone('square', 1320, t, 0.07, 0.06); tone('square', 1760, t + 0.06, 0.14, 0.06); },
    gem: () => { const t = now(); [0, 4, 7, 12].forEach((s, i) => tone('sine', N(s, 1046), t + i * 0.05, 0.2, 0.08)); },
    leaf: () => { const t = now(); [0, 5, 9].forEach((s, i) => tone('triangle', N(s, 660), t + i * 0.05, 0.18, 0.12)); },
    power: () => { const t = now(); [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone('triangle', N(s, 392), t + i * 0.045, 0.3, 0.14)); noise(t, 0.6, 0.12, 'highpass', 4000); },
    ability: () => { const t = now(); tone('sawtooth', 200, t, 0.5, 0.15, null, 900); [0, 7, 12].forEach((s, i) => tone('square', N(s, 523), t + 0.1 + i * 0.07, 0.15, 0.06)); },
    groan: () => { const t = now(); const f = 85 + Math.random() * 40; tone('sawtooth', f, t, 0.7, 0.07, null, f * 0.8, 0.1); tone('sine', f * 2, t, 0.6, 0.04, null, f * 1.5, 0.1); },
    zdie: () => { const t = now(); tone('sawtooth', 160, t, 0.4, 0.07, null, 50); noise(t, 0.2, 0.12, 'lowpass', 500); },
    plantDie: () => { const t = now(); tone('triangle', 500, t, 0.35, 0.1, null, 120); },
    shredder: () => { const t = now(); noise(t, 1.2, 0.5, 'bandpass', 400, 900, null, 2); tone('sawtooth', 70, t, 1.2, 0.15, null, 110); },
    wave: () => { const t = now(); tone('sawtooth', 110, t, 0.9, 0.2, null, 140, 0.15); tone('sawtooth', 165, t, 0.9, 0.12, null, 210, 0.15); },
    boss: () => { const t = now(); tone('sawtooth', 60, t, 1.4, 0.3, null, 45, 0.2); noise(t, 1.2, 0.3, 'lowpass', 400, 80); },
    warn: () => { const t = now(); tone('square', 880, t, 0.1, 0.06); tone('square', 880, t + 0.18, 0.1, 0.06); },
    upgrade: () => { const t = now(); [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone('triangle', N(s, 523), t + i * 0.07, 0.22, 0.14)); },
    win: () => { const t = now(); [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone('triangle', N(s, 392), t + i * 0.11, 0.4, 0.16)); [0, 7, 12].forEach((s) => tone('sine', N(s, 196), t + 0.8, 1.2, 0.12)); },
    lose: () => { const t = now(); [7, 5, 3, 0, -5].forEach((s, i) => tone('triangle', N(s, 330), t + i * 0.22, 0.45, 0.16)); },
    star: () => { const t = now(); tone('sine', 1568, t, 0.25, 0.12); tone('sine', 2093, t + 0.08, 0.3, 0.1); },
    whoosh: () => noise(now(), 0.35, 0.25, 'bandpass', 600, 2400, null, 1.2),
    count: () => tone('square', 1500, now(), 0.03, 0.03),
  };
  const throttle = { shoot: 45, hit: 40, armor: 60, chomp: 110, groan: 1800, sun: 50, coin: 60, splat: 60, zap: 80, fire: 120, poison: 120, sunDrop: 200, count: 35, zdie: 90 };
  function now() { return ctx.currentTime + 0.005; }
  function play(name) {
    if (!ctx || st.mute || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const th = throttle[name];
    if (th) {
      const t = performance.now();
      if (lastPlay[name] && t - lastPlay[name] < th) return;
      lastPlay[name] = t;
    }
    try { fn(); } catch (e) { /* lyd må aldrig stoppe spillet */ }
  }

  /* ---------------- Musik: lille sequencer pr. verden ---------------- */
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    phryg: [0, 1, 4, 5, 7, 8, 10], penta: [0, 2, 4, 7, 9], mpenta: [0, 3, 5, 7, 10], lyd: [0, 2, 4, 6, 7, 9, 11],
  };
  const SONGS = {
    menu: { bpm: 104, root: 55, scale: 'major', lead: 'triangle', bass: 'triangle', seed: 11, swing: 0.1, drums: 1 },
    w1: { bpm: 112, root: 57, scale: 'penta', lead: 'triangle', bass: 'triangle', seed: 21, swing: 0.12, drums: 1 },
    w2: { bpm: 100, root: 52, scale: 'phryg', lead: 'square', bass: 'triangle', seed: 31, swing: 0, drums: 2 },
    w3: { bpm: 126, root: 55, scale: 'dorian', lead: 'square', bass: 'triangle', seed: 41, swing: 0.18, drums: 1 },
    w4: { bpm: 118, root: 50, scale: 'mpenta', lead: 'triangle', bass: 'square', seed: 51, swing: 0.2, drums: 3 },
    w5: { bpm: 128, root: 53, scale: 'minor', lead: 'sawtooth', bass: 'square', seed: 61, swing: 0, drums: 4 },
    w6: { bpm: 92, root: 50, scale: 'minor', lead: 'triangle', bass: 'sawtooth', seed: 71, swing: 0, drums: 2 },
    w7: { bpm: 96, root: 59, scale: 'lyd', lead: 'sine', bass: 'triangle', seed: 81, swing: 0, drums: 1 },
    w8: { bpm: 122, root: 52, scale: 'dorian', lead: 'square', bass: 'sawtooth', seed: 91, swing: 0.08, drums: 4 },
    w9: { bpm: 110, root: 55, scale: 'mpenta', lead: 'triangle', bass: 'triangle', seed: 101, swing: 0.15, drums: 3 },
    w10: { bpm: 134, root: 49, scale: 'phryg', lead: 'sawtooth', bass: 'sawtooth', seed: 111, swing: 0, drums: 4 },
    boss: { bpm: 146, root: 45, scale: 'minor', lead: 'sawtooth', bass: 'sawtooth', seed: 121, swing: 0, drums: 4 },
    tense: { bpm: 140, root: 50, scale: 'minor', lead: 'square', bass: 'sawtooth', seed: 131, swing: 0, drums: 4 },
  };
  function buildSong(def) {
    const r = U.rng(def.seed);
    const sc = SCALES[def.scale];
    const deg = (d) => { const o = Math.floor(d / sc.length); return sc[((d % sc.length) + sc.length) % sc.length] + o * 12; };
    const prog = [0, r.pick([3, 5]), r.pick([4, 2]), r.pick([0, 4, 5])];
    const bars = [];
    for (let b = 0; b < 8; b++) {
      const chord = prog[b % 4];
      const lead = [];
      let cur = chord + 7 + r.int(-2, 2);
      for (let s = 0; s < 16; s++) {
        if (s % 2 === 0 && r() < (b % 4 === 3 ? 0.45 : 0.62)) {
          cur += r.pick([-2, -1, -1, 0, 1, 1, 2, 3, -3]);
          cur = U.clamp(cur, chord + 3, chord + 12);
          lead.push([s, deg(cur), r() < 0.25 ? 4 : 2]);
        }
      }
      bars.push({ chord, lead, bassRoot: deg(chord) - 12 });
    }
    return { def, bars, deg };
  }
  const music = { song: null, name: null, step: 0, next: 0, timer: null };
  function schedule() {
    if (!ctx || !music.song) return;
    const s = music.song, def = s.def;
    const stepDur = 60 / def.bpm / 4;
    while (music.next < ctx.currentTime + 0.25) {
      const st16 = music.step % 16, bar = s.bars[Math.floor(music.step / 16) % s.bars.length];
      let t = music.next;
      if (def.swing && st16 % 2 === 1) t += stepDur * def.swing;
      const root = def.root;
      // bas
      if (st16 % 4 === 0 || (def.drums >= 3 && st16 % 4 === 3 && Math.random() < 0.3)) {
        const semi = root + bar.bassRoot + (st16 === 8 ? 7 : 0) - 69 + 12;
        tone(def.bass, 440 * Math.pow(2, semi / 12), t, stepDur * 3.2, def.bass === 'triangle' ? 0.2 : 0.09, musicBus);
      }
      // akkord-pad på takt 1
      if (st16 === 0) {
        [0, 2, 4].forEach((d) => tone('sine', 440 * Math.pow(2, (root + s.deg(bar.chord + d) - 69 + 12) / 12), t, stepDur * 15, 0.035, musicBus, null, 0.2));
      }
      // melodi
      for (const n of bar.lead) if (n[0] === st16) tone(def.lead, 440 * Math.pow(2, (root + n[1] - 69 + 12) / 12), t, stepDur * n[2] * 0.9, def.lead === 'sawtooth' || def.lead === 'square' ? 0.045 : 0.09, musicBus);
      // trommer
      if (def.drums) {
        if (st16 % 8 === 0 || (def.drums >= 4 && st16 % 4 === 0)) { tone('sine', 120, t, 0.18, 0.35, musicBus, 40); }
        if (st16 % 8 === 4) noise(t, 0.12, def.drums >= 2 ? 0.22 : 0.12, 'bandpass', 1800, 900, musicBus, 0.9);
        if (st16 % 2 === 0 || def.drums >= 3) noise(t, 0.03, 0.05, 'highpass', 7000, null, musicBus);
      }
      music.step++;
      music.next += stepDur;
    }
  }
  function playSong(name) {
    if (!SONGS[name]) name = 'menu';
    if (!ctx) { pendingSong = name; return; }
    if (music.name === name) return;
    music.name = name;
    music.song = buildSong(SONGS[name]);
    music.step = 0;
    music.next = ctx.currentTime + 0.1;
    if (!music.timer) music.timer = setInterval(schedule, 90);
  }
  function stopSong() { music.song = null; music.name = null; }

  return { unlock, configure, play, playSong, stopSong, get ready() { return !!ctx; } };
})();
