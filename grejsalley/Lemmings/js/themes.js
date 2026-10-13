/* GrejsAlley Lemmings — themes.js
 * Visual themes per world: sky, parallax layers, terrain palette, hazards and
 * ambient particles. Colors are [r,g,b] where the renderer mixes them per pixel.
 */
(function (GL) {
  'use strict';

  GL.THEMES = {
    hills: {
      name: 'Grønne Bakker',
      sky: ['#5fb4f2', '#a9dcff', '#e4f6ff'],
      sun: { x: 0.78, y: 0.2, r: 34, color: '#fff3b0', glow: 'rgba(255,240,170,.45)' },
      clouds: true,
      layers: [
        { color: '#8cc6e8', base: 0.58, amp: 0.14, freq: 0.004, factor: 0.12, seed: 1, peaks: 0 },
        { color: '#6fb07c', base: 0.68, amp: 0.1, freq: 0.007, factor: 0.25, seed: 2, trees: '#4e8d5c' },
        { color: '#4f9460', base: 0.8, amp: 0.07, freq: 0.012, factor: 0.42, seed: 3, trees: '#3a7549' },
      ],
      dirt: [[150, 100, 62], [124, 80, 50], [176, 122, 76]],
      strata: [96, 64, 40],
      top: [[92, 186, 76], [126, 214, 92]],
      topDepth: 3,
      edge: [70, 46, 30],
      steel: [[150, 160, 176], [104, 114, 130], [196, 206, 220]],
      brick: [[214, 160, 92], [176, 124, 66]],
      hatch: '#7a4a2a', hatchTrim: '#d9a066',
      exit: { frame: '#8a5a3a', glow: '#ffe28a', flag: '#ff6b3d' },
      ambient: 'leaves',
    },
    caves: {
      name: 'Klippehuler',
      sky: ['#0f0c1d', '#1d1733', '#2b2245'],
      layers: [
        { color: '#241d3a', base: 0.5, amp: 0.25, freq: 0.006, factor: 0.1, seed: 4, stalactites: true },
        { color: '#2e2549', base: 0.7, amp: 0.15, freq: 0.01, factor: 0.25, seed: 5, crystals: '#7de3ff' },
        { color: '#3a2f58', base: 0.86, amp: 0.08, freq: 0.016, factor: 0.42, seed: 6 },
      ],
      dirt: [[122, 104, 138], [98, 82, 116], [146, 128, 160]],
      strata: [84, 70, 102],
      top: [[110, 168, 130], [146, 206, 160]],
      topDepth: 2,
      edge: [58, 46, 74],
      steel: [[128, 138, 160], [86, 94, 116], [178, 188, 208]],
      brick: [[196, 150, 104], [158, 112, 72]],
      hatch: '#4d3f6b', hatchTrim: '#9fe8ff',
      exit: { frame: '#5b4a7e', glow: '#9ff0ff', flag: '#ff7ad9' },
      ambient: 'glow',
    },
    ice: {
      name: 'Is og Sne',
      sky: ['#7fb7e6', '#c3e2fa', '#f2fbff'],
      sun: { x: 0.2, y: 0.18, r: 26, color: '#ffffff', glow: 'rgba(255,255,255,.5)' },
      layers: [
        { color: '#b6d2ec', base: 0.5, amp: 0.22, freq: 0.006, factor: 0.12, seed: 7, peaks: 1, snowcaps: '#f4fbff' },
        { color: '#93b9dc', base: 0.68, amp: 0.14, freq: 0.009, factor: 0.25, seed: 8, peaks: 1, snowcaps: '#e8f4ff', pines: '#5f86a8' },
        { color: '#7aa3c8', base: 0.84, amp: 0.07, freq: 0.014, factor: 0.42, seed: 9, pines: '#4f7899' },
      ],
      dirt: [[150, 196, 228], [120, 170, 210], [184, 220, 244]],
      strata: [104, 150, 196],
      top: [[244, 250, 255], [255, 255, 255]],
      topDepth: 4,
      edge: [86, 128, 168],
      steel: [[150, 164, 186], [100, 114, 140], [204, 216, 232]],
      brick: [[178, 140, 106], [140, 104, 74]],
      hatch: '#5c7fa3', hatchTrim: '#e6f4ff',
      exit: { frame: '#6d8db0', glow: '#d9f6ff', flag: '#ff5d5d' },
      ambient: 'snow',
    },
    desert: {
      name: 'Ørkenruiner',
      sky: ['#ff9e5e', '#ffc98a', '#ffe9bf'],
      sun: { x: 0.7, y: 0.26, r: 46, color: '#fff1c4', glow: 'rgba(255,214,140,.55)' },
      layers: [
        { color: '#f0b27a', base: 0.6, amp: 0.1, freq: 0.004, factor: 0.1, seed: 10, pyramids: '#e39d63' },
        { color: '#e39d63', base: 0.72, amp: 0.08, freq: 0.007, factor: 0.24, seed: 11, cacti: '#b47a46' },
        { color: '#cf8a50', base: 0.86, amp: 0.05, freq: 0.012, factor: 0.42, seed: 12 },
      ],
      dirt: [[226, 184, 120], [204, 158, 98], [240, 206, 146]],
      strata: [190, 140, 86],
      top: [[246, 218, 160], [252, 232, 184]],
      topDepth: 2,
      edge: [160, 112, 66],
      steel: [[170, 160, 150], [120, 110, 102], [214, 204, 192]],
      brick: [[190, 120, 80], [150, 90, 56]],
      hatch: '#8f5c33', hatchTrim: '#ffd48a',
      exit: { frame: '#9b6a3f', glow: '#fff0b0', flag: '#2fb8a6' },
      ambient: 'dust',
    },
    industry: {
      name: 'Industriområdet',
      sky: ['#2c2547', '#6a3f5e', '#e08a5b'],
      sun: { x: 0.3, y: 0.62, r: 40, color: '#ffb36b', glow: 'rgba(255,140,80,.4)' },
      layers: [
        { color: '#4a3a5e', base: 0.6, amp: 0.05, freq: 0.01, factor: 0.1, seed: 13, factory: true },
        { color: '#3a2e4c', base: 0.72, amp: 0.04, freq: 0.012, factor: 0.24, seed: 14, factory: true, lights: '#ffd36b' },
        { color: '#2a2238', base: 0.86, amp: 0.03, freq: 0.02, factor: 0.42, seed: 15, pipes: true },
      ],
      dirt: [[132, 104, 92], [108, 84, 74], [154, 124, 108]],
      strata: [96, 72, 64],
      top: [[150, 132, 110], [170, 152, 126]],
      topDepth: 2,
      edge: [70, 54, 50],
      steel: [[146, 156, 170], [94, 104, 120], [200, 210, 222]],
      brick: [[224, 170, 70], [190, 134, 44]],
      hatch: '#4f5868', hatchTrim: '#ffcf4a',
      exit: { frame: '#55606f', glow: '#b8ff9a', flag: '#ffcf4a' },
      ambient: 'smoke',
    },
  };

  // A level uses its own 'theme' if set, otherwise the theme of its world.
  GL.themeOf = function (def) {
    if (def.theme && GL.THEMES[def.theme]) return def.theme;
    const w = (GL.WORLDS || []).find(w => w.id === def.world);
    return w && GL.THEMES[w.theme] ? w.theme : 'hills';
  };

  GL.HAZARD_COLORS = {
    water: { top: 'rgba(120,200,255,.95)', a: 'rgba(60,140,220,.85)', b: 'rgba(20,60,140,.95)' },
    lava: { top: 'rgba(255,230,120,1)', a: 'rgba(255,120,40,.95)', b: 'rgba(170,30,20,1)' },
    acid: { top: 'rgba(220,255,140,1)', a: 'rgba(120,230,70,.9)', b: 'rgba(30,110,40,.95)' },
  };
})(typeof window !== 'undefined' ? (window.GL = window.GL || {}) : (globalThis.GL = globalThis.GL || {}));
