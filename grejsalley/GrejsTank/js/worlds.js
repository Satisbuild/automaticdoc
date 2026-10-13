/* =====================================================================
 * GREJS TANKS - worlds.js
 * 100 themed worlds: visuals, atmosphere, physics tweaks, music,
 * enemy pools, level templates, unlock requirements and (for worlds
 * 24-100) generated bosses.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const U = GT.U;

  const WORLDS = [
    {
      id: 1, name: 'Green Valley', sub: 'Rolling hills of Grejsdalen', icon: '🌳',
      sky: ['#5ab8ff', '#bfe8ff'], sun: { color: '#fff6b0', x: 0.78, y: 0.16, r: 48 },
      hills: ['#7fc48a', '#5fa56f'], clouds: '#ffffff',
      terrain: { top: '#5cc45a', top2: '#8be36b', soil: ['#8a5a32', '#6b4424', '#4a2e18'], speck: '#b0804e', topDepth: 12 },
      deco: ['tree', 'tree', 'pine', 'bush', 'flower', 'rock'], ambient: 'leaves',
      gravity: 1, wind: 4, hazard: null,
      music: { id: 'm1', bpm: 112, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 3], lead: 'triangle', bass: 'triangle', drums: 'soft', seed: 11, density: 0.5 },
      enemies: ['grunt', 'grunt', 'raider', 'bulwark', 'rocketeer'],
      templates: ['rolling', 'hill', 'valley', 'flat', 'twin_peaks', 'rolling', 'plateaus'],
      features: {}, stars: 0
    },
    {
      id: 2, name: 'Desert War', sub: 'Scorching dunes and canyons', icon: '🏜️',
      sky: ['#f7a64a', '#ffe0a3'], sun: { color: '#fff1c0', x: 0.25, y: 0.14, r: 60 },
      hills: ['#e5b775', '#cf9a55'], clouds: '#fff3dc',
      terrain: { top: '#f0cf85', top2: '#fbe3a8', soil: ['#d9a55c', '#b98242', '#8a5a2b'], speck: '#f4d99a', topDepth: 16 },
      deco: ['cactus', 'cactus', 'rock', 'skull', 'dead_tree'], ambient: 'sand',
      gravity: 1, wind: 6, hazard: null,
      music: { id: 'm2', bpm: 118, root: 57, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 1, 0, 6], lead: 'square', bass: 'triangle', drums: 'basic', seed: 22, density: 0.4 },
      enemies: ['grunt', 'raider', 'marksman', 'rocketeer', 'howitzer', 'bulwark'],
      templates: ['rolling', 'canyon', 'plateaus', 'cliffs', 'hill', 'valley', 'bunker'],
      features: { craters: 1 }, stars: 20
    },
    {
      id: 3, name: 'Volcano', sub: 'Rivers of lava and ash', icon: '🌋',
      sky: ['#3a0f14', '#b33a1f'], sun: { color: '#ff6a2a', x: 0.8, y: 0.2, r: 70, glow: true },
      hills: ['#4a1d19', '#2f1210'], clouds: '#5a3a36',
      terrain: { top: '#4a3a36', top2: '#6e5650', soil: ['#3a2a28', '#2a1c1a', '#1c1110'], speck: '#ff5a1f', topDepth: 8 },
      deco: ['lava_rock', 'dead_tree', 'rock', 'vent'], ambient: 'embers',
      gravity: 1, wind: 5, hazard: { type: 'lava', color: '#ff5a1a', dmg: 50 },
      music: { id: 'm3', bpm: 126, root: 52, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], lead: 'sawtooth', bass: 'sawtooth', drums: 'basic', seed: 33, density: 0.45 },
      enemies: ['grunt', 'scorcher', 'bulwark', 'howitzer', 'blaster', 'hydra'],
      templates: ['mountain', 'valley', 'cliffs', 'pits', 'twin_peaks', 'hill', 'tunnels'],
      features: { craters: 2 }, stars: 45, lavaLevel: 900
    },
    {
      id: 4, name: 'Frozen Lands', sub: 'Glaciers and endless snow', icon: '❄️',
      sky: ['#8fb8de', '#e8f4ff'], sun: { color: '#ffffff', x: 0.3, y: 0.18, r: 40 },
      hills: ['#cfe3f5', '#a9c8e6'], clouds: '#ffffff',
      terrain: { top: '#f4fbff', top2: '#ffffff', soil: ['#a8c9e6', '#7ea7cc', '#56789e'], speck: '#d9f1ff', topDepth: 16 },
      deco: ['pine_snow', 'pine_snow', 'ice_crystal', 'snowman', 'rock'], ambient: 'snow',
      gravity: 1, wind: 7, hazard: null,
      music: { id: 'm4', bpm: 100, root: 62, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 5, 4], lead: 'sine', bass: 'triangle', drums: 'soft', seed: 44, density: 0.4 },
      enemies: ['grunt', 'frosty', 'aegis', 'marksman', 'bulwark', 'mender'],
      templates: ['hill', 'plateaus', 'stairs', 'valley', 'tunnels', 'mountain', 'bunker'],
      features: { caves: 1 }, stars: 72
    },
    {
      id: 5, name: 'Jungle', sub: 'Dense, humid and dangerous', icon: '🌴',
      sky: ['#2e7d5b', '#a8e0a0'], sun: { color: '#fffbd0', x: 0.7, y: 0.12, r: 45 },
      hills: ['#2f7a4a', '#1f5a36'], clouds: '#e8ffe8',
      terrain: { top: '#2fa84f', top2: '#58d46b', soil: ['#5b3b22', '#442a16', '#2b1a0c'], speck: '#7e5530', topDepth: 14 },
      deco: ['palm', 'palm', 'jungle_tree', 'fern', 'flower', 'mushroom'], ambient: 'fireflies',
      gravity: 1, wind: 3, hazard: { type: 'swamp', color: '#4b7a2a', dmg: 30 },
      music: { id: 'm5', bpm: 120, root: 55, scale: [0, 2, 4, 7, 9], prog: [0, 2, 3, 1], lead: 'triangle', bass: 'sine', drums: 'basic', seed: 55, density: 0.55 },
      enemies: ['raider', 'plaguer', 'hydra', 'mender', 'homer', 'scorcher'],
      templates: ['twin_peaks', 'tunnels', 'valley', 'rolling', 'hill', 'pits', 'bunker'],
      features: { platforms: 1 }, stars: 100, lavaLevel: 930
    },
    {
      id: 6, name: 'Wasteland', sub: 'Ruins of a forgotten war', icon: '☢️',
      sky: ['#6b5a44', '#c9b28a'], sun: { color: '#fff0c8', x: 0.2, y: 0.2, r: 55 },
      hills: ['#7a6a55', '#5c4e3e'], clouds: '#a39479',
      terrain: { top: '#8a7a5a', top2: '#a8966e', soil: ['#6b5a42', '#4e412f', '#33291d'], speck: '#9c8c6a', topDepth: 8 },
      deco: ['ruin', 'tire', 'wreck', 'dead_tree', 'barrel_deco', 'sign'], ambient: 'ash',
      gravity: 1, wind: 7, hazard: { type: 'acid', color: '#9dff3a', dmg: 45 },
      music: { id: 'm6', bpm: 108, root: 50, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 6, 5, 4], lead: 'square', bass: 'sawtooth', drums: 'basic', seed: 66, density: 0.35 },
      enemies: ['boomer', 'blaster', 'plaguer', 'bulwark', 'hydra', 'burrower', 'rocketeer'],
      templates: ['pits', 'rolling', 'cliffs', 'bunker', 'canyon', 'plateaus', 'fortress'],
      features: { craters: 5 }, stars: 130, lavaLevel: 920
    },
    {
      id: 7, name: 'Moon Base', sub: 'Low gravity lunar warfare', icon: '🌙',
      sky: ['#05060f', '#1d2140'], sun: { color: '#4f8bff', x: 0.75, y: 0.2, r: 80, planet: true },
      hills: ['#3a3f52', '#2a2e3d'], clouds: null, stars: 160,
      terrain: { top: '#b9bcc6', top2: '#d8dbe3', soil: ['#8e919c', '#6c6f7a', '#4b4d56'], speck: '#5c5e68', topDepth: 6 },
      deco: ['moon_rock', 'antenna', 'dome', 'flag', 'moon_rock'], ambient: 'stars', skyStars: true,
      gravity: 0.55, wind: 0, hazard: null,
      music: { id: 'm7', bpm: 96, root: 57, scale: [0, 2, 3, 7, 8], prog: [0, 3, 1, 2], lead: 'sine', bass: 'sine', drums: 'soft', seed: 77, density: 0.35 },
      enemies: ['photon', 'lancer', 'volt', 'aegis', 'homer', 'marksman'],
      templates: ['plateaus', 'mountain', 'valley', 'pits', 'twin_peaks', 'hill', 'flat'],
      features: { craters: 6 }
    },
    {
      id: 8, name: 'Industrial Zone', sub: 'Factories, steel and smog', icon: '🏭',
      sky: ['#56606b', '#b8a58e'], sun: { color: '#ffe0b0', x: 0.6, y: 0.2, r: 50 },
      hills: ['#4a525c', '#343a42'], clouds: '#8a8a8a', factory: true,
      terrain: { top: '#6d6a66', top2: '#8f8b85', soil: ['#5a524a', '#433c35', '#2d2823'], speck: '#8a7f72', topDepth: 8, metal: '#7d8796' },
      deco: ['pipe', 'crate', 'lamp', 'chimney', 'barrel_deco'], ambient: 'sparks',
      gravity: 1, wind: 5, hazard: null,
      music: { id: 'm8', bpm: 128, root: 48, scale: [0, 3, 5, 6, 7, 10], prog: [0, 0, 3, 4], lead: 'square', bass: 'sawtooth', drums: 'boss', seed: 88, density: 0.45 },
      enemies: ['bulwark', 'juggernaut', 'volt', 'burrower', 'rocketeer', 'homer', 'howitzer'],
      templates: ['stairs', 'fortress', 'plateaus', 'cliffs', 'bunker', 'rolling', 'tunnels'],
      features: { metal: 3 }, stars: 190
    },
    {
      id: 9, name: 'Sky Battle', sub: 'Floating islands above the clouds', icon: '☁️',
      sky: ['#4a7bd8', '#ffd6a8'], sun: { color: '#fff8e0', x: 0.5, y: 0.1, r: 55 },
      hills: null, clouds: '#ffffff', seaOfClouds: true,
      terrain: { top: '#6fd36a', top2: '#9ff08a', soil: ['#a07850', '#7e5a38', '#5c3e22'], speck: '#c49a6a', topDepth: 12 },
      deco: ['tree', 'bush', 'flower', 'windmill', 'rock'], ambient: 'clouds',
      gravity: 0.9, wind: 8, hazard: { type: 'void' },
      music: { id: 'm9', bpm: 116, root: 64, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], lead: 'triangle', bass: 'triangle', drums: 'basic', seed: 99, density: 0.55 },
      enemies: ['homer', 'lancer', 'marksman', 'photon', 'raider', 'aegis', 'mender'],
      templates: ['islands'],
      features: {}, stars: 222, void: true
    },
    {
      id: 10, name: 'Final War', sub: 'The last battlefield', icon: '⚔️',
      sky: ['#1a0a1f', '#7a1f2b'], sun: { color: '#ff2a2a', x: 0.5, y: 0.22, r: 90, glow: true },
      hills: ['#3a1520', '#240c14'], clouds: '#4a2a30',
      terrain: { top: '#5a3a3a', top2: '#7a5050', soil: ['#3f2a2a', '#2c1c1c', '#1a1010'], speck: '#ff3a2a', topDepth: 8, metal: '#6a6f7a' },
      deco: ['ruin', 'wreck', 'spikes_deco', 'dead_tree', 'flag_enemy'], ambient: 'embers',
      gravity: 1, wind: 8, hazard: { type: 'lava', color: '#ff2a1a', dmg: 60 },
      music: { id: 'm10', bpm: 138, root: 50, scale: [0, 1, 3, 5, 6, 8, 10], prog: [0, 1, 5, 6], lead: 'sawtooth', bass: 'sawtooth', drums: 'boss', seed: 1010, density: 0.55 },
      enemies: ['juggernaut', 'lancer', 'hydra', 'boomer', 'volt', 'plaguer', 'howitzer', 'homer', 'blaster'],
      templates: ['mountain', 'fortress', 'pits', 'twin_peaks', 'bunker', 'canyon', 'stairs', 'tunnels'],
      features: { craters: 3, metal: 1 }, stars: 255, lavaLevel: 910, big: true
    },
    {
      id: 11, name: 'Buss World', sub: "Roads, bus stops and traffic jams", icon: '🚌',
      sky: ['#ffb347','#ffe9b0'], sun: { color: '#fff4c0', x: 0.7, y: 0.15, r: 52 },
      hills: ['#9aa3ad', '#6f7882'], clouds: '#ffffff',
      terrain: { top: '#4a4a4f', top2: '#ffd23f', soil: ['#6a6a70', '#4c4c52', '#323236'], speck: '#ffd23f', topDepth: 10, metal: '#e0a020' },
      deco: ['sign', 'lamp', 'tire', 'crate', 'barrel_deco', 'wreck'], ambient: 'sparks',
      gravity: 1, wind: 7, hazard: null,
      music: { id: 'm11', bpm: 110, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 2, 3, 4], lead: 'square', bass: 'sawtooth', drums: 'basic', seed: 1221, density: 0.5 },
      enemies: ['raider', 'boomer', 'rocketeer', 'juggernaut', 'howitzer', 'blaster', 'homer'],
      templates: ['flat', 'stairs', 'plateaus', 'fortress', 'bunker', 'rolling', 'cliffs'],
      features: { metal: 2, craters: 2 }, stars: 285
    },
    {
      id: 12, name: 'Joe World', sub: "Joe's wild backyard kingdom", icon: '🧢',
      sky: ['#6ad1ff','#d8f5ff'], sun: { color: '#ffffff', x: 0.25, y: 0.14, r: 50 },
      hills: ['#66bb6a', '#43a047'], clouds: '#ffffff',
      terrain: { top: '#43c463', top2: '#7cf08a', soil: ['#a0603a', '#7c4628', '#563018'], speck: '#d09060', topDepth: 14 },
      deco: ['tree', 'mushroom', 'windmill', 'flower', 'snowman', 'flag'], ambient: 'leaves',
      gravity: 0.85, wind: 8, hazard: null,
      music: { id: 'm12', bpm: 113, root: 50, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 3, 3, 4], lead: 'sawtooth', bass: 'sawtooth', drums: 'boss', seed: 1332, density: 0.5 },
      enemies: ['hydra', 'boomer', 'homer', 'plaguer', 'lancer', 'volt', 'juggernaut'],
      templates: ['twin_peaks', 'hill', 'pits', 'tunnels', 'valley', 'mountain', 'rolling'],
      features: { platforms: 2, caves: 1 }, stars: 315
    },
    {
      id: 13, name: 'Toxic Swamp', sub: "Bubbling poison everywhere", icon: '🐸',
      sky: ['#2b3a1a','#7a9a3a'], sun: { color: '#d8ff8a', x: 0.6, y: 0.18, r: 46 },
      hills: ['#3b5a2a', '#2a401c'], clouds: '#9ab07a',
      terrain: { top: '#4f7a2a', top2: '#7ab040', soil: ['#3a4a22', '#2a3618', '#1a220e'], speck: '#9dff3a', topDepth: 10 },
      deco: ['dead_tree', 'mushroom', 'fern', 'barrel_deco', 'skull'], ambient: 'spores',
      gravity: 1, wind: 5, hazard: { type: 'acid', color: '#9dff3a', dmg: 70 },
      music: { id: 'm13', bpm: 116, root: 55, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 4, 3, 4], lead: 'triangle', bass: 'sawtooth', drums: 'soft', seed: 1443, density: 0.5 },
      enemies: ['plaguer', 'hydra', 'mender', 'burrower', 'homer', 'boomer', 'scorcher'],
      templates: ['pits', 'valley', 'tunnels', 'rolling', 'bunker', 'canyon', 'hill'],
      features: { craters: 3 }, stars: 345, lavaLevel: 900
    },
    {
      id: 14, name: 'Crystal Caves', sub: "Glittering underground halls", icon: '💎',
      sky: ['#1a1040','#5a3a9a'], sun: { color: '#d0a0ff', x: 0.5, y: 0.15, r: 40, glow: true },
      hills: ['#3a2a6a', '#24184a'], clouds: null,
      terrain: { top: '#9a7aff', top2: '#d0b8ff', soil: ['#5a4a9a', '#40327a', '#281e52'], speck: '#ffffff', topDepth: 8 },
      deco: ['ice_crystal', 'ice_crystal', 'moon_rock', 'rock', 'mushroom'], ambient: 'fireflies',
      gravity: 1, wind: 2, hazard: null,
      music: { id: 'm14', bpm: 119, root: 60, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], lead: 'sine', bass: 'sawtooth', drums: 'basic', seed: 1554, density: 0.5 },
      enemies: ['photon', 'lancer', 'volt', 'aegis', 'frosty', 'burrower', 'marksman'],
      templates: ['tunnels', 'mountain', 'stairs', 'cliffs', 'plateaus', 'bunker', 'twin_peaks'],
      features: { caves: 3 }, stars: 375
    },
    {
      id: 15, name: 'Pirate Coast', sub: "Cannons, sand and salty winds", icon: '🏴‍☠️',
      sky: ['#3a8ad8','#bfe6ff'], sun: { color: '#fff6c0', x: 0.8, y: 0.16, r: 54 },
      hills: ['#e8d090', '#c8b070'], clouds: '#ffffff',
      terrain: { top: '#f0d890', top2: '#fff0b8', soil: ['#c09858', '#9a7840', '#705628'], speck: '#fff8d0', topDepth: 16 },
      deco: ['palm', 'palm', 'barrel_deco', 'skull', 'flag_enemy', 'crate'], ambient: 'sand',
      gravity: 1, wind: 10, hazard: null,
      music: { id: 'm15', bpm: 122, root: 48, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 1, 3, 4], lead: 'square', bass: 'sawtooth', drums: 'boss', seed: 1665, density: 0.5 },
      enemies: ['howitzer', 'rocketeer', 'marksman', 'boomer', 'hydra', 'juggernaut', 'blaster'],
      templates: ['cliffs', 'hill', 'valley', 'canyon', 'rolling', 'plateaus', 'twin_peaks'],
      features: { craters: 2 }, stars: 405
    },
    {
      id: 16, name: 'Candy Land', sub: "Sweet hills with a bitter fight", icon: '🍭',
      sky: ['#ff8ad8','#ffe0f4'], sun: { color: '#ffffff', x: 0.3, y: 0.15, r: 50 },
      hills: ['#ffb0e0', '#ff88cc'], clouds: '#ffffff',
      terrain: { top: '#ff6ab0', top2: '#ffc0e0', soil: ['#a0603a', '#804828', '#5a3018'], speck: '#7ad8ff', topDepth: 14 },
      deco: ['mushroom', 'flower', 'bush', 'snowman', 'flag'], ambient: 'fireflies',
      gravity: 0.9, wind: 6, hazard: null,
      music: { id: 'm16', bpm: 125, root: 53, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 2, 3, 4], lead: 'sawtooth', bass: 'sawtooth', drums: 'soft', seed: 1776, density: 0.5 },
      enemies: ['boomer', 'hydra', 'volt', 'homer', 'lancer', 'plaguer', 'juggernaut'],
      templates: ['rolling', 'twin_peaks', 'hill', 'pits', 'plateaus', 'valley', 'stairs'],
      features: { platforms: 1 }, stars: 435
    },
    {
      id: 17, name: 'Haunted Hollow', sub: "Ghosts drift between the graves", icon: '👻',
      sky: ['#0f0a1f','#3a2a5a'], sun: { color: '#e0e8ff', x: 0.75, y: 0.15, r: 46 },
      hills: ['#2a2040', '#1a1428'], clouds: '#5a5070',
      terrain: { top: '#3a3a4a', top2: '#5a5a70', soil: ['#2a2830', '#1e1c24', '#121016'], speck: '#8a7aff', topDepth: 8 },
      deco: ['dead_tree', 'skull', 'ruin', 'sign', 'lamp'], ambient: 'ash',
      gravity: 1, wind: 6, hazard: { type: 'swamp', color: '#6a4aaa', dmg: 60 },
      music: { id: 'm17', bpm: 128, root: 58, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 3, 3, 4], lead: 'triangle', bass: 'sawtooth', drums: 'basic', seed: 1887, density: 0.5 },
      enemies: ['photon', 'plaguer', 'burrower', 'lancer', 'hydra', 'volt', 'homer'],
      templates: ['tunnels', 'pits', 'bunker', 'mountain', 'cliffs', 'valley', 'fortress'],
      features: { craters: 2, caves: 2 }, stars: 465, lavaLevel: 915
    },
    {
      id: 18, name: 'Robot Factory', sub: "Machines building machines", icon: '🤖',
      sky: ['#2a3440','#6a8098'], sun: { color: '#a0e8ff', x: 0.5, y: 0.2, r: 44, glow: true },
      hills: ['#3a4450', '#262e38'], clouds: '#7a8a9a',
      terrain: { top: '#7d8796', top2: '#a8b4c4', soil: ['#4a525c', '#363c44', '#22262c'], speck: '#4dd2ff', topDepth: 8, metal: '#9aa8b8' },
      deco: ['pipe', 'antenna', 'crate', 'lamp', 'chimney', 'dome'], ambient: 'sparks',
      gravity: 1, wind: 4, hazard: null,
      music: { id: 'm18', bpm: 131, root: 46, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 4, 3, 4], lead: 'sine', bass: 'sawtooth', drums: 'boss', seed: 1998, density: 0.5 },
      enemies: ['juggernaut', 'volt', 'lancer', 'photon', 'aegis', 'rocketeer', 'homer'],
      templates: ['fortress', 'stairs', 'bunker', 'plateaus', 'cliffs', 'tunnels', 'flat'],
      features: { metal: 5 }, stars: 495
    },
    {
      id: 19, name: 'Thunder Peaks', sub: "Mountains in an endless storm", icon: '⛈️',
      sky: ['#2a3040','#6a7088'], sun: { color: '#ffffff', x: 0.2, y: 0.15, r: 36 },
      hills: ['#4a5060', '#30343f'], clouds: '#5a6070',
      terrain: { top: '#6a7080', top2: '#9098a8', soil: ['#4a4e58', '#363a42', '#22252b'], speck: '#fff27a', topDepth: 8 },
      deco: ['rock', 'pine_snow', 'antenna', 'dead_tree', 'windmill'], ambient: 'rain',
      gravity: 1, wind: 12, hazard: null,
      music: { id: 'm19', bpm: 134, root: 51, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], lead: 'square', bass: 'sawtooth', drums: 'soft', seed: 2109, density: 0.5 },
      enemies: ['volt', 'lancer', 'marksman', 'howitzer', 'homer', 'aegis', 'juggernaut'],
      templates: ['mountain', 'twin_peaks', 'cliffs', 'stairs', 'hill', 'canyon', 'plateaus'],
      features: { craters: 2 }, stars: 525
    },
    {
      id: 20, name: 'Lava Ocean', sub: "A sea of fire with stepping stones", icon: '🔥',
      sky: ['#2a0505','#c0300a'], sun: { color: '#ffaa2a', x: 0.5, y: 0.2, r: 90, glow: true },
      hills: null, clouds: '#6a2a1a',
      terrain: { top: '#3a2420', top2: '#5a3a30', soil: ['#2a1814', '#1c100c', '#100806'], speck: '#ff7a1a', topDepth: 8 },
      deco: ['lava_rock', 'vent', 'skull', 'spikes_deco', 'dead_tree'], ambient: 'embers',
      gravity: 1, wind: 6, hazard: { type: 'void' },
      music: { id: 'm20', bpm: 137, root: 56, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 1, 3, 4], lead: 'sawtooth', bass: 'sawtooth', drums: 'basic', seed: 2220, density: 0.5 },
      enemies: ['scorcher', 'juggernaut', 'blaster', 'hydra', 'howitzer', 'boomer', 'plaguer'],
      templates: ['islands'],
      features: {}, stars: 555, void: true
    },
    {
      id: 21, name: 'Deep Space', sub: "Fighting among the asteroids", icon: '🪐',
      sky: ['#000005','#0a0a2a'], sun: { color: '#ff8a4f', x: 0.2, y: 0.2, r: 100, planet: true },
      hills: null, clouds: null,
      terrain: { top: '#8a8090', top2: '#b0a8b8', soil: ['#5a5260', '#40384a', '#282230'], speck: '#4dd2ff', topDepth: 6 },
      deco: ['moon_rock', 'antenna', 'dome', 'flag'], ambient: 'stars',
      gravity: 0.4, wind: 0, hazard: { type: 'void' },
      music: { id: 'm21', bpm: 110, root: 61, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 2, 3, 4], lead: 'triangle', bass: 'sawtooth', drums: 'boss', seed: 2331, density: 0.5 },
      enemies: ['photon', 'lancer', 'volt', 'homer', 'aegis', 'marksman', 'juggernaut'],
      templates: ['islands'],
      features: { craters: 4 }, stars: 585, skyStars: true, void: true
    },
    {
      id: 22, name: 'Doom Fortress', sub: "The gate before the end", icon: '🏯',
      sky: ['#1a0505','#5a1010'], sun: { color: '#ff3a3a', x: 0.5, y: 0.2, r: 80, glow: true },
      hills: ['#2a0c10', '#1a0608'], clouds: '#3a1a1a',
      terrain: { top: '#4a3030', top2: '#6a4040', soil: ['#3a2222', '#2a1616', '#180c0c'], speck: '#ff3a2a', topDepth: 8, metal: '#5a5f6a' },
      deco: ['ruin', 'spikes_deco', 'flag_enemy', 'wreck', 'chimney'], ambient: 'embers',
      gravity: 1, wind: 9, hazard: { type: 'lava', color: '#ff2a1a', dmg: 80 },
      music: { id: 'm22', bpm: 113, root: 49, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 3, 3, 4], lead: 'sine', bass: 'sawtooth', drums: 'soft', seed: 2442, density: 0.5 },
      enemies: ['juggernaut', 'lancer', 'hydra', 'volt', 'howitzer', 'homer', 'blaster', 'plaguer', 'boomer'],
      templates: ['fortress', 'bunker', 'mountain', 'stairs', 'pits', 'canyon', 'tunnels'],
      features: { metal: 4, craters: 3 }, stars: 615, lavaLevel: 905, big: true
    },
    {
      id: 23, name: 'Grejs World', sub: "The legendary home of Grejs", icon: '👑',
      sky: ['#3a1a6a','#ffb347'], sun: { color: '#ffd23f', x: 0.5, y: 0.14, r: 70, glow: true },
      hills: ['#5a3a8a', '#3a2460'], clouds: '#ffe0a0',
      terrain: { top: '#ffd23f', top2: '#fff0a0', soil: ['#7a4a9a', '#5a3478', '#3a2050'], speck: '#ffd23f', topDepth: 14, metal: '#ffd23f' },
      deco: ['flag', 'tree', 'ruin', 'windmill', 'dome', 'flower'], ambient: 'fireflies',
      gravity: 1, wind: 10, hazard: { type: 'lava', color: '#ffb300', dmg: 100 },
      music: { id: 'm23', bpm: 116, root: 54, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 4, 3, 4], lead: 'square', bass: 'sawtooth', drums: 'basic', seed: 2553, density: 0.5 },
      enemies: ['juggernaut', 'lancer', 'hydra', 'volt', 'homer', 'boomer', 'plaguer', 'howitzer', 'blaster', 'photon'],
      templates: ['mountain', 'fortress', 'twin_peaks', 'pits', 'bunker', 'canyon', 'stairs', 'tunnels', 'cliffs'],
      features: { craters: 3, metal: 2, platforms: 1 }, stars: 645, lavaLevel: 900, big: true
    }
  ];

  /* ------------------------------------------------------------
   * Worlds 24-100. Each row borrows gameplay structure (terrain
   * templates, deco, enemies, hazard) from a base world and gets its
   * own name, palette, music, level names and boss.
   * [name, sub, icon, base, [sky0, sky1], groundTop, soil, levelKey, bossName, opts]
   * opts: gravity, wind, hazard, islands, skyStars, big, metal, noHills
   * ------------------------------------------------------------ */
  const LAVA = (color, dmg) => ({ type: 'lava', color, dmg });
  const ACID = (color, dmg) => ({ type: 'acid', color, dmg });
  const SWAMP = (color, dmg) => ({ type: 'swamp', color, dmg });
  const EXTRA = [
    ['Coral Depths', 'Undersea base among glowing reefs', '🐠', 14, ['#032a4a', '#0a8aa8'], '#3ac8b4', '#2a5a6a', 'Coral', 'Abyssal Kraken', { gravity: 0.8 }],
    ['Volcano Isles', 'Smoking islands in a boiling sea', '🏝️', 20, ['#3a1a10', '#ff8a3a'], '#5a4030', '#3a2418', 'Ember Isle', 'Isle Inferno', {}],
    ['Robot City', 'Neon streets ruled by machines', '🏙️', 18, ['#1a1035', '#ff4fa0'], '#5a6070', '#30343f', 'Neon', 'Chrome Mayor', {}],
    ['Arctic Outpost', 'A frozen military base at the pole', '🛰️', 4, ['#5a7a9a', '#d8eaf8'], '#e8f4ff', '#6a8aa8', 'Outpost', 'Polar Commander', { metal: 2 }],
    ['Orbital Station', 'Battles on a rotating space station', '🛸', 21, ['#020210', '#1a2a5a'], '#9aa4b8', '#4a5268', 'Orbit', 'Station AI', {}],
    ['Temple of Vines', 'Ancient temples swallowed by jungle', '🛕', 5, ['#1a5a3a', '#d8e890'], '#4a9a3a', '#6a5a3a', 'Temple', 'Idol Guardian', {}],
    ['Clockwork Citadel', 'A fortress of gears and springs', '⚙️', 8, ['#4a3020', '#d8a860'], '#a07840', '#5a4028', 'Gear', 'Clockwork King', {}],
    ['Storm Planet', 'Endless lightning on an alien world', '🌩️', 19, ['#1a1040', '#5a4aa0'], '#5a5a7a', '#30304a', 'Storm', 'Tempest Core', { gravity: 0.8 }],
    ['Mushroom Forest', 'Giant glowing fungi everywhere', '🍄', 13, ['#2a1a4a', '#a06ad8'], '#c060a0', '#4a2a4a', 'Spore', 'Fungal Overlord', { hazard: SWAMP('#b04ad8', 60) }],
    ['Sunken City', 'Drowned ruins of an old empire', '🏛️', 6, ['#0a3a5a', '#4ab0c8'], '#7a9a8a', '#3a5050', 'Sunken', 'Drowned Emperor', { hazard: SWAMP('#2a8aa8', 60) }],
    ['Savanna Strike', 'Golden grasslands at sunset', '🦁', 2, ['#e8783a', '#ffd890'], '#d0b040', '#8a6030', 'Savanna', 'Pride Leader', {}],
    ['Glacier Fortress', 'Ice walls and frozen cannons', '🏰', 4, ['#3a5a8a', '#b8d8f0'], '#c8e8ff', '#5a7aa8', 'Glacier', 'Ice Warden', { metal: 2 }],
    ['Neon Grid', 'A digital arena made of light', '💠', 18, ['#05001a', '#2a0a5a'], '#00e5ff', '#1a1040', 'Grid', 'Firewall', { skyStars: true }],
    ['Canyon Raiders', 'Red rock canyons and outlaw camps', '🤠', 2, ['#c0502a', '#ffc080'], '#c0603a', '#7a3a20', 'Canyon', 'Outlaw Baron', {}],
    ['Bamboo Valley', 'Misty bamboo forests', '🎋', 1, ['#8ab890', '#e8f4d8'], '#6ab850', '#5a4a30', 'Bamboo', 'Jade Shogun', { wind: 8 }],
    ['Meteor Fields', 'Craters left by falling stars', '☄️', 7, ['#0a0518', '#3a1a4a'], '#8a7a70', '#4a3a38', 'Meteor', 'Comet Crusher', { gravity: 0.7 }],
    ['Rust Harbor', 'Old docks and rusting warships', '⚓', 15, ['#5a6a7a', '#c8b8a0'], '#8a6a50', '#4a3a2a', 'Harbor', 'Rust Admiral', { metal: 2 }],
    ['Sky Citadel', 'Floating castles above the clouds', '🌤️', 9, ['#3a6ad8', '#ffe0c0'], '#88d870', '#8a7050', 'Citadel', 'Cloud Emperor', {}],
    ['Ash Wastes', 'Grey plains after the great eruption', '🌫️', 6, ['#4a4848', '#a8a0a0'], '#7a7878', '#4a4646', 'Ash', 'Cinder Tyrant', { hazard: LAVA('#ff6a2a', 70) }],
    ['Crystal Desert', 'Glass dunes that glitter in the sun', '🔮', 2, ['#4ab0d8', '#fff0d0'], '#a8e8f0', '#c0a070', 'Glass', 'Prism Sphinx', {}],
    ['Toxic Refinery', 'Leaking pipes and green sludge', '🧪', 8, ['#2a3a1a', '#8aa040'], '#5a6a4a', '#33402a', 'Refinery', 'Sludge Baron', { hazard: ACID('#9dff3a', 70) }],
    ['Pyramid Sands', 'Tombs of the ancient tank pharaohs', '🔺', 2, ['#f0a040', '#ffe8b0'], '#e8c070', '#a07838', 'Pyramid', 'Tank Pharaoh', { big: true }],
    ['Midnight Metro', 'Underground tunnels and runaway trains', '🚇', 11, ['#0a0a1a', '#2a2a4a'], '#4a4a5a', '#2a2a33', 'Metro', 'Night Conductor', {}],
    ['Aurora Tundra', 'Battles under the northern lights', '🌌', 4, ['#0a1a3a', '#3ad8a0'], '#e0f0ff', '#4a6a8a', 'Aurora', 'Aurora Wraith', { skyStars: true }],
    ['Dino Valley', 'Prehistoric jungle full of giant bones', '🦖', 5, ['#4a8a5a', '#f0e0a0'], '#5aa040', '#6a4a2a', 'Fossil', 'Rex Crusher', {}],
    ['Asteroid Mines', 'Mining rigs on drifting rocks', '⛏️', 21, ['#020208', '#2a1a2a'], '#8a7060', '#4a3a30', 'Mine', 'Drill Baron', {}],
    ['Grejs Colosseum', 'The great arena halfway to glory', '🏟️', 10, ['#4a1a1a', '#ffb060'], '#c8a060', '#7a5030', 'Arena', 'Champion Grejsus', { big: true }],
    ['Blossom Gardens', 'Cherry blossoms and quiet pagodas', '🌸', 16, ['#ffb0c8', '#fff0f4'], '#7ac060', '#6a4a3a', 'Blossom', 'Petal Shogun', {}],
    ['Magma Forge', 'Where the tank armies are made', '🔨', 3, ['#2a0a05', '#d0501a'], '#4a3a30', '#2a1a14', 'Forge', 'Forge Master', { metal: 2 }],
    ['Frostbite Caverns', 'Icy tunnels deep below the snow', '🧊', 14, ['#0a1a3a', '#4a8ac8'], '#b0e0ff', '#3a5a8a', 'Frost', 'Cryo Hydra', {}],
    ['Wild West', 'Saloons, mesas and high-noon showdowns', '🌵', 2, ['#e88a4a', '#ffe0a0'], '#d8a060', '#8a5a30', 'Mesa', 'Sheriff Steel', {}],
    ['Cyber Jungle', 'Nature overgrown with circuits', '🦎', 5, ['#0a2a2a', '#2ad8a0'], '#20c080', '#1a3a3a', 'Cyber', 'Data Serpent', { hazard: ACID('#2affd0', 70) }],
    ['Phantom Marsh', 'Fog, wisps and sunken graves', '🕯️', 17, ['#1a1a2a', '#5a6a7a'], '#4a5a4a', '#2a302a', 'Wisp', 'Marsh Wraith', {}],
    ['Thunder Plateau', 'High flat mesas under storm clouds', '🌪️', 19, ['#3a3a50', '#8a90a8'], '#7a8070', '#4a4a40', 'Plateau', 'Cyclone Lord', {}],
    ['Solar Station', 'Mirrors and power beams in orbit', '☀️', 21, ['#0a0510', '#ff9a3a'], '#c0b080', '#5a5040', 'Solar', 'Sun Engine', {}],
    ['Kraken Trench', 'The deepest point of the ocean', '🦑', 14, ['#000818', '#0a3a6a'], '#3a6a8a', '#1a2a40', 'Trench', 'Elder Kraken', { gravity: 0.75, hazard: SWAMP('#1a5a8a', 70) }],
    ['Sand Fortress', 'A citadel built on shifting dunes', '🧱', 22, ['#c08040', '#ffe0a0'], '#d8b070', '#9a7040', 'Sandkeep', 'Dune Warlord', { hazard: null }],
    ['Rainbow Highlands', 'Colourful hills and waterfalls', '🌈', 1, ['#5ab8ff', '#ffd0f0'], '#70d870', '#8a6040', 'Rainbow', 'Prism Dragon', {}],
    ['Junkyard Kingdom', 'Mountains of scrap metal', '🗑️', 6, ['#5a5040', '#b0a080'], '#7a7060', '#4a4238', 'Junk', 'Scrap Emperor', { metal: 2 }],
    ['Ice Comet', 'Riding a frozen comet through space', '🌠', 21, ['#000010', '#1a3a6a'], '#d0e8ff', '#5a7aa0', 'Comet', 'Comet Heart', { gravity: 0.5 }],
    ['Spider Caves', 'Webs and pitch-dark tunnels', '🕷️', 17, ['#100a10', '#3a2a3a'], '#4a404a', '#2a2228', 'Web', 'Widow Queen', {}],
    ['Lava Factory', 'Conveyors of molten steel', '🏗️', 8, ['#2a1008', '#c0601a'], '#6a5a50', '#3a2a22', 'Smelter', 'Molten Press', { hazard: LAVA('#ff5a1a', 80) }],
    ['Moonlit Bayou', 'A night swamp under a huge moon', '🐊', 13, ['#0a1a2a', '#3a5a6a'], '#3a5a3a', '#22302a', 'Bayou', 'Gator King', {}],
    ['Celestial Gardens', 'Floating gardens among the stars', '🌺', 9, ['#1a0a3a', '#8a5ad8'], '#a0e080', '#6a4a7a', 'Celestial', 'Star Gardener', { skyStars: true }],
    ['Titan Quarry', 'Giant stone pits and rusty cranes', '🪨', 6, ['#7a8090', '#d0c8b8'], '#a09888', '#6a6058', 'Quarry', 'Stone Titan', { hazard: null }],
    ['Obsidian Peaks', 'Black glass mountains', '🖤', 3, ['#1a0a1a', '#6a2a4a'], '#2a2a3a', '#1a1a24', 'Obsidian', 'Obsidian Drake', {}],
    ['Mirror Lake', 'A frozen lake that reflects the sky', '🪞', 4, ['#6a9ad8', '#f0f8ff'], '#d8f0ff', '#7a98b8', 'Mirror', 'The Reflection', {}],
    ['Martian Colony', 'Red dust and domed cities', '🔴', 7, ['#4a1a10', '#d8804a'], '#c0603a', '#7a3a22', 'Mars', 'Red Governor', { gravity: 0.7 }],
    ['Gold Mine', 'Glittering veins of treasure', '💰', 14, ['#2a1a0a', '#8a6a2a'], '#d8b040', '#5a4020', 'Gold', 'Golden Golem', {}],
    ['Hurricane Coast', 'Battered shores in a mega storm', '🌊', 15, ['#2a3a4a', '#7a8a9a'], '#c0b080', '#7a6a4a', 'Hurricane', 'Storm Captain', { wind: 14 }],
    ['Necro Citadel', 'A fortress of undead machines', '💀', 22, ['#0a0a10', '#3a4a3a'], '#3a3a3a', '#1a1a1a', 'Necro', 'Lich Tank', { hazard: ACID('#7aff9a', 85) }],
    ['Biolab Zero', 'Experiments gone horribly wrong', '🧬', 18, ['#0a2a1a', '#5ad890'], '#a0b0b8', '#3a4a50', 'Biolab', 'Specimen X', { hazard: ACID('#5aff8a', 80) }],
    ['Sandstorm Expanse', 'Endless dunes in a blinding storm', '🌬️', 2, ['#a07040', '#e0c090'], '#d8b878', '#9a7a48', 'Dune', 'Sand Wyrm', { wind: 13 }],
    ['Firefly Forest', 'Ancient woods glowing at night', '✨', 1, ['#0a1a20', '#2a4a3a'], '#3a7a3a', '#3a2a1a', 'Firefly', 'Elder Treant', { skyStars: true }],
    ['Iron Wall', 'A thousand-mile line of defences', '🛡️', 22, ['#3a3a40', '#9a9aa0'], '#7a7a80', '#4a4a50', 'Rampart', 'Wall Breaker', { hazard: null, metal: 3 }],
    ['Nebula Drift', 'Colourful gas clouds in deep space', '🌀', 21, ['#1a0530', '#c040a0'], '#a080c0', '#4a3060', 'Nebula', 'Nebula Wyrm', {}],
    ['Grejs Harbor', 'The great port of the Grejs empire', '⛵', 15, ['#3a8ad8', '#ffe8c0'], '#e0c890', '#a08050', 'Grejsport', 'Admiral Grejs', {}],
    ['Boiling Geysers', 'Steam vents and scalding springs', '♨️', 3, ['#5a6a7a', '#e0d8d0'], '#b0a080', '#6a5a40', 'Geyser', 'Steam Titan', { hazard: SWAMP('#8ad8ff', 80) }],
    ['Ancient Ruins', 'Lost civilisation of the first tanks', '🗿', 6, ['#8a9aa0', '#e8e0c8'], '#a09a78', '#6a6048', 'Relic', 'Stone Colossus', { hazard: null }],
    ['Quantum Lab', 'Where the laws of physics break down', '⚛️', 18, ['#000a1a', '#3a8aff'], '#80a0d0', '#2a3a5a', 'Quantum', 'Paradox Engine', { gravity: 0.75 }],
    ['Dragon Peaks', 'Lair of the fire-breathing tanks', '🐉', 3, ['#3a0a0a', '#ff6a3a'], '#5a4a40', '#3a2a22', 'Dragon', 'Dragon Tank', {}],
    ['Polar Night', 'Six months of darkness', '🌑', 4, ['#02050f', '#1a2a4a'], '#c8d8e8', '#4a5a70', 'Polar', 'Night Mammoth', { skyStars: true }],
    ['Carnival Chaos', 'A haunted funfair', '🎪', 16, ['#3a0a3a', '#ff7a3a'], '#e04a8a', '#5a2a3a', 'Carnival', 'The Ringmaster', {}],
    ['Black Hole Rim', 'At the edge of the event horizon', '🕳️', 21, ['#000000', '#1a0a2a'], '#5a4a6a', '#2a2030', 'Horizon', 'Singularity', { gravity: 0.35 }],
    ['Titanium Tundra', 'Armoured plains of the far north', '🏔️', 4, ['#4a5a6a', '#c8d0d8'], '#d0d8e0', '#6a7480', 'Titanium', 'Titan Plow', { metal: 3 }],
    ['Venom Jungle', 'Every plant here wants you dead', '🐍', 5, ['#0a2a0a', '#6aa03a'], '#3a8a2a', '#2a3a18', 'Venom', 'Venom Hydra', { hazard: ACID('#b0ff3a', 90) }],
    ['Inferno Gate', 'The doorway to the burning core', '🚪', 22, ['#2a0000', '#ff3a00'], '#4a2a20', '#2a1410', 'Inferno', 'The Gatekeeper', {}],
    ['Celestial Forge', 'Stars hammered into weapons', '🌟', 21, ['#0a0520', '#ffb03a'], '#c0a060', '#4a3a40', 'Starforge', 'Star Smith', {}],
    ['Shadow Realm', 'Where light goes to die', '🌘', 17, ['#000000', '#2a0a3a'], '#2a2030', '#120c18', 'Shadow', 'Shadow Tank', { hazard: SWAMP('#5a2a8a', 90) }],
    ['Mecha Megacity', 'Capital of the robot empire', '🌆', 18, ['#1a0a2a', '#ff6a3a'], '#6a7080', '#33363f', 'Megacity', 'Mecha Emperor', { big: true }],
    ['Eternal Winter', 'The blizzard that never ends', '🌨️', 4, ['#4a5a7a', '#d0dae8'], '#f0f8ff', '#7088a8', 'Winter', 'Winter King', { wind: 14 }],
    ['Cosmic Ocean', 'Islands floating in starlight', '🪼', 9, ['#05001a', '#3a1a8a'], '#60c0d0', '#3a3a6a', 'Cosmic', 'Leviathan Prime', { skyStars: true, gravity: 0.7 }],
    ['Apocalypse Plains', 'The world after the last war', '🏚️', 10, ['#2a0a05', '#a04a1a'], '#5a4030', '#2a1a12', 'Apocalypse', 'The Horseman', {}],
    ['Chaos Dimension', 'Reality torn to pieces', '🧿', 21, ['#3a003a', '#00e5ff'], '#ff3ad8', '#3a1a5a', 'Chaos', 'Chaos Engine', {}],
    ["Titan's Fortress", 'Stronghold of the tank titans', '🗼', 22, ['#1a0a0a', '#8a2a1a'], '#5a4a4a', '#2a2222', 'Titan', 'Titan Lord', {}],
    ['Throne Approach', 'The final road to the Grejs throne', '🛤️', 23, ['#2a0a4a', '#ff8a3a'], '#e0b030', '#5a3070', 'Throne', 'Royal Guard', {}],
    ['Grejs Eternity', 'The final battle for the Grejs universe', '🏆', 23, ['#0a0020', '#ffd23f'], '#ffd23f', '#4a2070', 'Eternity', 'Grejs Omega', { big: true, hazard: LAVA('#ffd23f', 100) }]
  ];

  EXTRA.forEach((row, i) => {
    const [name, sub, icon, baseId, sky, top, soil, key, bossName, o] = row;
    const id = 24 + i;
    const b = WORLDS[baseId - 1];
    const w = Object.assign({}, b, {
      id, name, sub, icon, base: baseId, levelKey: key, bossName,
      sky: sky.slice(),
      sun: Object.assign({}, b.sun, { x: 0.15 + ((id * 37) % 70) / 100 }),
      hills: b.hills ? [U.mix(soil, sky[1], 0.45), U.mix(soil, sky[0], 0.35)] : null,
      clouds: b.clouds ? U.mix('#ffffff', sky[1], 0.25) : null,
      terrain: Object.assign({}, b.terrain, {
        top, top2: U.shade(top, 0.3), soil: [soil, U.shade(soil, -0.3), U.shade(soil, -0.55)], speck: U.shade(top, 0.15)
      }),
      features: Object.assign({}, b.features),
      music: Object.assign({}, b.music, { id: 'm' + id, seed: id * 111, root: 45 + ((id * 7) % 17), bpm: 100 + ((id * 13) % 40) }),
      enemies: b.enemies.slice(),
      // ~30 extra stars per world, continuing the curve of worlds 1-23
      stars: 645 + (id - 23) * 30
    });
    if (o.gravity) w.gravity = o.gravity;
    if (o.wind) w.wind = o.wind;
    if ('hazard' in o) w.hazard = o.hazard;
    if (o.skyStars) w.skyStars = true;
    if (o.big) w.big = true;
    if (o.metal) w.features.metal = (w.features.metal || 0) + o.metal;
    if (w.hazard && w.hazard.type !== 'void' && !w.lavaLevel) w.lavaLevel = 915;
    // later worlds field tougher escorts
    for (const t of id >= 60 ? ['juggernaut', 'hydra', 'lancer'] : id >= 40 ? ['juggernaut'] : []) if (!w.enemies.includes(t)) w.enemies.push(t);
    WORLDS.push(w);
  });

  /* ------------------------------------------------------------
   * Bosses for worlds 24-100: the base world's boss, recoloured and
   * scaled up gradually. Every 10th world and worlds 90+ get an extra
   * phase; world 100 is the final showdown.
   * ------------------------------------------------------------ */
  const BOSSES = GT.Enemies.bosses;
  const LAST = WORLDS.length;
  const EXTRA_PHASES = [
    { w: ['nuke', 'hellfire'], enter: 'barrage', say: 'Total bombardment!' },
    { w: ['antimatter', 'storm_lance'], enter: 'rage', say: 'Maximum power!' },
    { w: ['armageddon', 'railgun'], enter: 'heal', say: 'I am not finished yet!' }
  ];
  for (const w of WORLDS) {
    if (w.id <= 23) continue;
    const src = BOSSES[w.base - 1];
    const k = w.id - 23; // 1..77
    const final = w.id === LAST;
    let phases = JSON.parse(JSON.stringify(final ? BOSSES[22].phases : src.phases)).map((p) => { delete p.at; return p; });
    const extra = final ? 2 : w.id % 10 === 0 || w.id >= 90 ? 1 : 0;
    for (let i = 0; i < extra; i++) phases.push(Object.assign({}, EXTRA_PHASES[(w.id + i) % EXTRA_PHASES.length]));
    phases = phases.map((p, i) => (i ? Object.assign({ at: +(1 - i / phases.length).toFixed(2) }, p) : p));
    if (final) phases[phases.length - 1].say = 'THE GREJS UNIVERSE ENDS HERE!';
    BOSSES.push({
      id: 'boss_' + w.id, name: w.bossName, world: w.id,
      hp: final ? 26000 : 13500 + k * 110,
      armor: final ? 62 : Math.min(60, Math.round(50 + k * 0.13)),
      dmg: final ? 1.45 : +Math.min(1.45, 1.3 + k * 0.002).toFixed(3),
      acc: final ? 0.94 : +Math.min(0.94, 0.88 + k * 0.0008).toFixed(3),
      scale: final ? 2.6 : Math.min(2.5, src.scale + 0.1),
      vis: Object.assign({}, src.vis, {
        body: w.terrain.soil[0], accent: w.terrain.top,
        deco: final ? ['crown', 'core', 'spikes', 'horns', 'lights'] : src.vis.deco
      }),
      phases
    });
  }

  // Boss music (shared, darker, faster)
  const BOSS_MUSIC = { id: 'boss', bpm: 148, root: 45, scale: [0, 1, 3, 5, 7, 8, 11], prog: [0, 1, 0, 5], lead: 'sawtooth', bass: 'sawtooth', drums: 'boss', seed: 666, density: 0.6 };
  const MENU_MUSIC = { id: 'menu', bpm: 104, root: 57, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], lead: 'triangle', bass: 'triangle', drums: 'soft', seed: 5, density: 0.4 };


  GT.Worlds = {
    list: WORLDS,
    BOSS_MUSIC,
    MENU_MUSIC,
    get(id) {
      return WORLDS[id - 1] || WORLDS[0];
    },
    count: WORLDS.length,
    /** is world unlocked? previous boss beaten + stars */
    isUnlocked(id) {
      if (id <= 1) return true;
      const S = GT.Save.data;
      const w = this.get(id);
      return !!S.bosses[id - 1] && GT.Save.totalStars() >= (w.stars || 0);
    },
    lockReason(id) {
      const w = this.get(id);
      const S = GT.Save.data;
      const parts = [];
      if (!S.bosses[id - 1]) parts.push('Defeat the boss of ' + this.get(id - 1).name);
      if (GT.Save.totalStars() < w.stars) parts.push('Collect ' + w.stars + ' ★ (' + GT.Save.totalStars() + '/' + w.stars + ')');
      return parts.join(' · ');
    }
  };
})();

