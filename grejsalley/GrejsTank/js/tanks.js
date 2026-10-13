/* =====================================================================
 * GREJS TANKS - tanks.js
 * Data for: special abilities, tank classes, 60 player tanks,
 * upgrade system, enemy types and bosses. Everything is data-driven:
 * add a row to TANKS / ENEMIES / BOSSES to extend the game.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;

  /* ------------------------------------------------------------
   * Special abilities
   * kind: self (instant, does not end turn) | target (pick a spot)
   *       weapon (arms an ability-weapon, fired with normal aim)
   *       auto (auto-targeted attack, ends turn)
   * cd: turns to recharge
   * ------------------------------------------------------------ */
  const ABILITIES = {
    shield: { name: 'Energy Shield', icon: '🛡️', kind: 'self', cd: 4, desc: 'Shield absorbs damage equal to 30% of max HP for 2 turns.' },
    repair: { name: 'Field Repair', icon: '🔧', kind: 'self', cd: 5, desc: 'Instantly repairs 28% of max HP.' },
    double: { name: 'Double Damage', icon: '✖️', kind: 'self', cd: 4, desc: 'Your next shot deals double damage.' },
    overcharge: { name: 'Overcharge', icon: '⚡', kind: 'self', cd: 4, desc: 'Next shot: +60% blast radius and +25% damage.' },
    nitro: { name: 'Nitro Boost', icon: '💨', kind: 'self', cd: 3, desc: 'Triple fuel this turn and repair 8% HP.' },
    teleport: { name: 'Teleport', icon: '🌀', kind: 'target', cd: 4, desc: 'Tap anywhere on the map to teleport there. You can still shoot.' },
    airstrike: { name: 'Air Strike', icon: '✈️', kind: 'weapon', weapon: 'ab_airstrike', cd: 4, desc: 'Fire a marker - six bombers drop bombs on it.' },
    laser_beam: { name: 'Laser Beam', icon: '🔆', kind: 'weapon', weapon: 'ab_laser', cd: 4, desc: 'A massive piercing beam along your aim.' },
    cluster: { name: 'Mega Cluster', icon: '💣', kind: 'weapon', weapon: 'ab_cluster', cd: 4, desc: 'A giant cluster bomb that splits into 10.' },
    mines: { name: 'Mine Deployment', icon: '✴️', kind: 'weapon', weapon: 'ab_mines', cd: 4, desc: 'Launch four proximity mines.' },
    meteor_strike: { name: 'Meteor Strike', icon: '☄️', kind: 'weapon', weapon: 'ab_meteor', cd: 5, desc: 'Mark a spot - three meteors crash down.' },
    barrage: { name: 'Missile Barrage', icon: '🚀', kind: 'auto', cd: 4, desc: 'Launch six homing missiles at enemies.' },
    drone: { name: 'Drone Attack', icon: '🛸', kind: 'auto', cd: 4, desc: 'A drone flies over the nearest enemy and drops four bombs.' },
    earthquake: { name: 'Earthquake', icon: '🌋', kind: 'auto', cd: 5, desc: 'Shakes the ground - all grounded enemies take damage.' },
    freeze: { name: 'Deep Freeze', icon: '❄️', kind: 'auto', cd: 5, desc: 'Freezes the nearest enemy (skips a turn) and deals damage.' },
    firestorm: { name: 'Firestorm', icon: '🔥', kind: 'auto', cd: 5, desc: 'Rains fire over the nearest enemy.' },
    emp_pulse: { name: 'EMP Pulse', icon: '📡', kind: 'auto', cd: 5, desc: 'Strips all enemy shields and disables their abilities.' },
    toxic_cloud: { name: 'Toxic Cloud', icon: '☣️', kind: 'auto', cd: 4, desc: 'Poison rain over the nearest enemy.' },
    siphon: { name: 'Siphon', icon: '🩸', kind: 'auto', cd: 5, desc: 'Drain HP from the nearest enemy and heal yourself.' }
  };

  /* ------------------------------------------------------------
   * Classes: base stats + default loadout + default visuals
   * ------------------------------------------------------------ */
  const CLASSES = {
    balanced: { name: 'Balanced', stats: [520, 12, 100, 100, 100, 3, 100, 60], w: ['shell', 'heavy_shell'], ab: 'shield', vis: { chassis: 'box', turret: 'dome', barrel: 'single', move: 'tracks' } },
    heavy: { name: 'Heavy', stats: [760, 26, 102, 94, 62, 2, 105, 90], w: ['shell', 'heavy_shell'], ab: 'repair', vis: { chassis: 'heavy', turret: 'box', barrel: 'thick', move: 'tracks', size: 1.14 } },
    scout: { name: 'Scout', stats: [400, 6, 94, 104, 155, 4, 92, 35], w: ['shell', 'triple'], ab: 'nitro', vis: { chassis: 'low', turret: 'dome', barrel: 'single', move: 'wheels', size: 0.9 } },
    artillery: { name: 'Artillery', stats: [470, 10, 104, 124, 72, 3, 112, 70], w: ['shell', 'mortar'], ab: 'airstrike', vis: { chassis: 'long', turret: 'tower', barrel: 'long', move: 'tracks' } },
    missile: { name: 'Missile', stats: [480, 10, 88, 110, 95, 3, 100, 55], w: ['rocket', 'volley'], ab: 'barrage', vis: { chassis: 'box', turret: 'box', barrel: 'pod', move: 'tracks' } },
    plasma: { name: 'Plasma', stats: [460, 14, 86, 100, 105, 4, 106, 55], w: ['plasma', 'lightning'], ab: 'overcharge', vis: { chassis: 'round', turret: 'orb', barrel: 'dish', move: 'hover' } },
    nuclear: { name: 'Nuclear', stats: [540, 16, 92, 95, 78, 1.5, 126, 70], w: ['heavy_shell', 'nuke'], ab: 'meteor_strike', vis: { chassis: 'heavy', turret: 'dome', barrel: 'thick', move: 'tracks', deco: ['hazard'] } },
    sniper: { name: 'Sniper', stats: [420, 8, 108, 122, 105, 3, 84, 70], w: ['shell', 'sniper'], ab: 'double', vis: { chassis: 'wedge', turret: 'angled', barrel: 'long', move: 'tracks' } },
    medic: { name: 'Support', stats: [580, 16, 92, 100, 100, 5, 100, 60], w: ['shell', 'heavy_shell'], ab: 'repair', vis: { chassis: 'round', turret: 'dome', barrel: 'short', move: 'wheels', deco: ['cross'] } },
    flame: { name: 'Flame', stats: [510, 14, 100, 96, 100, 3, 108, 55], w: ['shell', 'fire'], ab: 'firestorm', vis: { chassis: 'wedge', turret: 'box', barrel: 'short', move: 'tracks', deco: ['exhaust'] } },
    frost: { name: 'Frost', stats: [540, 18, 98, 100, 90, 3, 100, 65], w: ['shell', 'ice'], ab: 'freeze', vis: { chassis: 'hex', turret: 'angled', barrel: 'single', move: 'tracks', deco: ['crystals'] } },
    tesla: { name: 'Tesla', stats: [470, 10, 100, 104, 115, 4, 100, 50], w: ['shell', 'lightning'], ab: 'emp_pulse', vis: { chassis: 'box', turret: 'orb', barrel: 'coil', move: 'wheels' } },
    toxic: { name: 'Toxic', stats: [500, 12, 100, 100, 100, 3, 104, 55], w: ['shell', 'poison'], ab: 'toxic_cloud', vis: { chassis: 'round', turret: 'box', barrel: 'short', move: 'tracks', deco: ['canisters'] } },
    driller: { name: 'Driller', stats: [560, 20, 100, 98, 88, 3, 100, 75], w: ['shell', 'drill'], ab: 'earthquake', vis: { chassis: 'wedge', turret: 'flat', barrel: 'drill', move: 'tracks' } },
    mortar: { name: 'Mortar', stats: [500, 12, 104, 108, 85, 3, 110, 65], w: ['shell', 'mortar'], ab: 'cluster', vis: { chassis: 'box', turret: 'flat', barrel: 'short', move: 'wheels' } },
    laser: { name: 'Laser', stats: [450, 10, 102, 110, 110, 4, 90, 55], w: ['shell', 'laser'], ab: 'laser_beam', vis: { chassis: 'low', turret: 'angled', barrel: 'rail', move: 'hover' } },
    siege: { name: 'Siege', stats: [820, 30, 92, 96, 55, 2, 108, 95], w: ['heavy_shell', 'mega_rocket'], ab: 'shield', vis: { chassis: 'heavy', turret: 'twin', barrel: 'double', move: 'tracks', size: 1.2 } },
    hover: { name: 'Hover', stats: [450, 10, 98, 104, 135, 4, 100, 45], w: ['shell', 'homing'], ab: 'teleport', vis: { chassis: 'round', turret: 'dome', barrel: 'single', move: 'hover' } }
  };
  const STAT_KEYS = ['hp', 'armor', 'damage', 'power', 'speed', 'reload', 'radius', 'stability'];

  /* ------------------------------------------------------------
   * Tanks: [id, name, class, tier, bodyColor, accentColor, unlock, overrides]
   * unlock: null (starter) | {type, value, cost}
   *   types: coins, stars, boss, levels, challenges, blueprints,
   *          achievements, plevel
   * ------------------------------------------------------------ */
  const T = [
    // ---- Tier 1
    ['t_rookie', 'Grejs Rookie', 'balanced', 1, '#4caf50', '#2e7d32', null, { desc: 'A trusty all-rounder from Grejsdalen. Good at everything, great at nothing.' }],
    ['t_pebble', 'Pebble Scout', 'scout', 1, '#ffb74d', '#e65100', null, { desc: 'Tiny, quick and cheeky. Drives circles around heavier tanks.' }],
    ['t_bruiser', 'Iron Bruiser', 'heavy', 1, '#90a4ae', '#455a64', null, { desc: 'A rolling wall of steel. Slow, but shrugs off hits.' }],
    ['t_rusty', 'Rusty Bucket', 'balanced', 1, '#a1662f', '#5d3a1a', { type: 'challenges', value: 1 }, { vis: { chassis: 'round', deco: ['patches'] }, ab: 'repair', desc: 'Held together by tape and hope. Repairs itself in a pinch.' }],
    ['t_valley', 'Valley Mortar', 'mortar', 1, '#8bc34a', '#33691e', { type: 'coins', value: 1500 }, { desc: 'Lobs heavy shells over any hill.' }],
    ['t_spark', 'Spark Buggy', 'tesla', 1, '#ffee58', '#f57f17', { type: 'levels', value: 5, cost: 800 }, { vis: { move: 'bigwheels' }, desc: 'A buzzing electric buggy. Chains lightning between enemies.' }],
    ['t_zapper', 'Zapper Jr.', 'tesla', 1, '#4dd0e1', '#006064', { type: 'coins', value: 2500 }, { ab: 'double', desc: 'Small coil, big attitude.' }],
    // ---- Tier 2
    ['t_dune', 'Dune Striker', 'missile', 2, '#e0c068', '#8d6e2f', { type: 'boss', value: 1 }, { desc: 'Desert rocket platform. Fires volleys of missiles.' }],
    ['t_cactus', 'Cactus Sniper', 'sniper', 2, '#7cb342', '#2e5e1a', { type: 'stars', value: 20, cost: 1500 }, { vis: { deco: ['spikes'] }, desc: 'Prickly and precise. Long-range specialist.' }],
    ['t_ember', 'Ember Crawler', 'flame', 2, '#ff7043', '#bf360c', { type: 'coins', value: 3500 }, { desc: 'Sets the battlefield ablaze.' }],
    ['t_frostbite', 'Frostbite', 'frost', 2, '#81d4fa', '#0277bd', { type: 'levels', value: 12, cost: 2500 }, { desc: 'Chills enemies to the bone. Frozen tanks skip turns.' }],
    ['t_mud', 'Mudslinger', 'driller', 2, '#8d6e63', '#4e342e', { type: 'coins', value: 4000 }, { desc: 'Digs through hills to reach hiding enemies.' }],
    ['t_longshot', 'Longshot', 'artillery', 2, '#9ccc65', '#558b2f', { type: 'stars', value: 30, cost: 2000 }, { desc: 'Classic artillery with extreme range.' }],
    ['t_patch', 'Patchwork Medic', 'medic', 2, '#eeeeee', '#e53935', { type: 'challenges', value: 3 }, { desc: 'Keeps itself running long after others would fall.' }],
    ['t_pup', 'Plasma Pup', 'plasma', 2, '#ba68c8', '#6a1b9a', { type: 'plevel', value: 8, cost: 3000 }, { desc: 'Energy weapons with floaty, tricky trajectories.' }],
    ['t_brick', 'Brick Hauler', 'heavy', 2, '#d84315', '#6d2410', { type: 'coins', value: 4500 }, { ab: 'shield', vis: { chassis: 'box', turret: 'tower' }, desc: 'Built like a brick house. Literally.' }],
    ['t_scrap', 'Scrap Wolf', 'toxic', 2, '#9e9d24', '#4a4a12', { type: 'levels', value: 18, cost: 3000 }, { vis: { deco: ['patches', 'spikes'] }, desc: 'Wasteland scavenger armed with toxic sludge.' }],
    // ---- Tier 3
    ['t_destroyer', 'Grejs Destroyer', 'heavy', 3, '#43a047', '#1b5e20', { type: 'boss', value: 2 }, { w: ['shell', 'mega_rocket'], ab: 'barrage', vis: { turret: 'twin', barrel: 'double' }, desc: 'The pride of Grejs. Heavy armor and a rocket barrage.' }],
    ['t_viper', 'Viper', 'toxic', 3, '#76ff03', '#1b5e20', { type: 'coins', value: 7000 }, { vis: { chassis: 'low', move: 'wheels' }, desc: 'Fast and venomous.' }],
    ['t_thunder', 'Thunder Box', 'tesla', 3, '#5c6bc0', '#1a237e', { type: 'stars', value: 55, cost: 4000 }, { desc: 'A walking thunderstorm.' }],
    ['t_rascal', 'Rocket Rascal', 'missile', 3, '#ef5350', '#b71c1c', { type: 'levels', value: 25, cost: 5000 }, { w: ['rocket', 'homing'], desc: 'Homing missiles that never give up.' }],
    ['t_magma', 'Magma Maw', 'flame', 3, '#ff5722', '#3e2723', { type: 'boss', value: 3 }, { w: ['shell', 'napalm'], vis: { chassis: 'heavy', size: 1.08 }, desc: 'Forged in a volcano. Spits napalm.' }],
    ['t_glacier', 'Glacier', 'frost', 3, '#b3e5fc', '#01579b', { type: 'stars', value: 70, cost: 5000 }, { stats: { hp: 1.15, speed: 0.8 }, ab: 'shield', desc: 'A slab of living ice. Tough and chilling.' }],
    ['t_mole', 'Mole King', 'driller', 3, '#795548', '#ffca28', { type: 'blueprints', value: 8 }, { w: ['shell', 'tunnel'], desc: 'Rules the underground. Tunnels beneath enemies.' }],
    ['t_hawkeye', 'Hawkeye', 'sniper', 3, '#546e7a', '#ffab00', { type: 'plevel', value: 14, cost: 8000 }, { desc: 'Never misses twice.' }],
    ['t_hover', 'Hover Ace', 'hover', 3, '#26c6da', '#00838f', { type: 'coins', value: 9000 }, { desc: 'Glides over rough terrain. Can teleport.' }],
    ['t_x1', 'Blueprint X-1', 'laser', 3, '#90caf9', '#0d47a1', { type: 'blueprints', value: 5 }, { desc: 'Experimental laser prototype.' }],
    ['t_neon', 'Neon Racer', 'scout', 3, '#ff4081', '#00e5ff', { type: 'achievements', value: 14 }, { w: ['shell', 'shotgun'], vis: { deco: ['lights'] }, desc: 'Flashy, fast and loud.' }],
    ['t_tortoise', 'Turtle Fort', 'siege', 3, '#689f38', '#33691e', { type: 'stars', value: 85, cost: 6000 }, { w: ['heavy_shell', 'bouncer'], vis: { chassis: 'round' }, desc: 'Slow and steady wins the war.' }],
    // ---- Tier 4
    ['t_atom', 'Atom Ant', 'nuclear', 4, '#cddc39', '#33691e', { type: 'boss', value: 4 }, { vis: { size: 0.95, chassis: 'round' }, desc: 'Small tank, very big bomb.' }],
    ['t_solar', 'Solar Lance', 'laser', 4, '#ffd54f', '#ff6f00', { type: 'stars', value: 100, cost: 8000 }, { desc: 'Channels sunlight into devastating beams.' }],
    ['t_bastion', 'Bastion', 'siege', 4, '#78909c', '#263238', { type: 'coins', value: 14000 }, { desc: 'A fortress on tracks.' }],
    ['t_swarm', 'Swarm Queen', 'missile', 4, '#ffa000', '#3e2723', { type: 'levels', value: 50, cost: 9000 }, { w: ['rocket', 'split'], ab: 'drone', desc: 'Controls a swarm of drones and split missiles.' }],
    ['t_quakemaker', 'Quake Maker', 'artillery', 4, '#a1887f', '#3e2723', { type: 'challenges', value: 6 }, { w: ['shell', 'quake'], ab: 'earthquake', desc: 'Makes the ground itself fight for you.' }],
    ['t_nova', 'Nova Core', 'plasma', 4, '#7c4dff', '#311b92', { type: 'boss', value: 5 }, { ab: 'laser_beam', desc: 'A plasma reactor on tracks.' }],
    ['t_blizzard', 'Blizzard', 'frost', 4, '#e1f5fe', '#4fc3f7', { type: 'stars', value: 130, cost: 8000 }, { w: ['ice', 'ice'], desc: 'Every shell is an ice bomb.' }],
    ['t_tide', 'Toxic Tide', 'toxic', 4, '#00e676', '#004d40', { type: 'blueprints', value: 14 }, { w: ['shell', 'acid'], desc: 'Drowns enemies in acid rain.' }],
    ['t_stalker', 'Jungle Stalker', 'scout', 4, '#2e7d32', '#1b1b1b', { type: 'coins', value: 12000 }, { ab: 'teleport', vis: { deco: ['camo'] }, desc: 'Strikes from the undergrowth, then vanishes.' }],
    ['t_comet', 'Comet', 'missile', 4, '#e3f2fd', '#1565c0', { type: 'plevel', value: 22, cost: 12000 }, { w: ['rocket', 'mirv'], ab: 'meteor_strike', desc: 'Calls down fire from the sky.' }],
    // ---- Tier 5
    ['t_warhammer', 'Warhammer', 'heavy', 5, '#b0bec5', '#b71c1c', { type: 'boss', value: 6 }, { w: ['heavy_shell', 'mortar'], ab: 'double', desc: 'Hits like a hammer from the heavens.' }],
    ['t_storm', 'Storm Caller', 'tesla', 5, '#3949ab', '#ffeb3b', { type: 'stars', value: 170, cost: 14000 }, { w: ['lightning', 'thunder'], desc: 'Summons thunderstorms at will.' }],
    ['t_hellraiser', 'Hellraiser', 'flame', 5, '#d50000', '#212121', { type: 'coins', value: 22000 }, { w: ['fire', 'napalm'], vis: { deco: ['spikes', 'exhaust'] }, desc: 'Fire. Only fire.' }],
    ['t_specter', 'Specter', 'hover', 5, '#b39ddb', '#4527a0', { type: 'levels', value: 80, cost: 15000 }, { w: ['ghost', 'homing'], desc: 'Its shells phase through solid ground.' }],
    ['t_titandrill', 'Titan Drill', 'driller', 5, '#ff8f00', '#212121', { type: 'blueprints', value: 22 }, { w: ['drill', 'bunker_buster'], vis: { size: 1.12 }, desc: 'Nowhere to hide from the Titan.' }],
    ['t_starfall', 'Starfall', 'artillery', 5, '#1a237e', '#ffd600', { type: 'boss', value: 7 }, { w: ['shell', 'meteor'], ab: 'meteor_strike', desc: 'Calls meteors down from orbit.' }],
    ['t_angel', 'Guardian Angel', 'medic', 5, '#fffde7', '#ffd54f', { type: 'challenges', value: 12 }, { ab: 'shield', w: ['plasma', 'heavy_shell'], vis: { move: 'hover' }, desc: 'Radiant shields and plasma.' }],
    ['t_prism', 'Prism', 'laser', 5, '#e040fb', '#00e5ff', { type: 'stars', value: 210, cost: 15000 }, { vis: { turret: 'orb' }, desc: 'Refracts light into deadly beams.' }],
    ['t_moon', 'Moon Walker', 'hover', 5, '#cfd8dc', '#37474f', { type: 'plevel', value: 28, cost: 18000 }, { w: ['plasma', 'blackhole'], desc: 'Built for low gravity battles.' }],
    ['t_golden', 'Golden Grejs', 'balanced', 5, '#ffd700', '#b8860b', { type: 'achievements', value: 26 }, { w: ['heavy_shell', 'mega_rocket'], ab: 'double', vis: { deco: ['star'] }, desc: 'A trophy for true champions.' }],
    // ---- Tier 6
    ['t_doomsday', 'Doomsday', 'nuclear', 6, '#424242', '#ffeb3b', { type: 'boss', value: 8 }, { desc: 'The end of all things. Carries a nuke.' }],
    ['t_leviathan', 'Leviathan', 'siege', 6, '#004d40', '#00bfa5', { type: 'coins', value: 40000 }, { w: ['heavy_shell', 'hellfire'], ab: 'barrage', desc: 'An unstoppable armored beast.' }],
    ['t_eclipse', 'Eclipse', 'plasma', 6, '#212121', '#ff6d00', { type: 'stars', value: 260, cost: 25000 }, { w: ['plasma', 'solar'], desc: 'Harnesses the power of a dying sun.' }],
    ['t_vortex', 'Vortex', 'plasma', 6, '#6200ea', '#00e5ff', { type: 'blueprints', value: 32 }, { w: ['plasma', 'blackhole'], ab: 'emp_pulse', desc: 'Bends space with black holes.' }],
    ['t_phoenix', 'Phoenix', 'flame', 6, '#ff6d00', '#ffd600', { type: 'levels', value: 110, cost: 30000 }, { w: ['fire', 'solar'], ab: 'repair', vis: { move: 'hover' }, desc: 'Rises from the ashes again and again.' }],
    ['t_railgun', 'Omega Railgun', 'sniper', 6, '#263238', '#00e5ff', { type: 'boss', value: 9 }, { w: ['sniper', 'pierce'], vis: { barrel: 'rail' }, desc: 'Hypersonic slugs that pierce everything.' }],
    ['t_colossus', 'Iron Colossus', 'siege', 6, '#616161', '#ff3d00', { type: 'stars', value: 320, cost: 35000 }, { w: ['heavy_shell', 'nuke'], ab: 'siphon', desc: 'The largest tank ever built.' }],
    ['t_legend', 'Grejs Legend', 'balanced', 6, '#00c853', '#ffd600', { type: 'boss', value: 10 }, { w: ['heavy_shell', 'hellfire'], ab: 'double', vis: { deco: ['star', 'lights'] }, desc: 'The legendary tank of Grejs. Victory incarnate.' }],
    ['t_chaos', 'Chaos Engine', 'missile', 6, '#c51162', '#212121', { type: 'challenges', value: 20 }, { w: ['rocket', 'mirv'], ab: 'barrage', desc: 'Pure missile mayhem.' }],
    ['t_dragon', 'Sky Dragon', 'hover', 6, '#d50000', '#ffab00', { type: 'stars', value: 400, cost: 40000 }, { w: ['fire', 'hellfire'], ab: 'firestorm', vis: { deco: ['spikes', 'horns'] }, desc: 'Breathes fire from above the clouds.' }],
    ['t_fury', 'Final Fury', 'nuclear', 6, '#b71c1c', '#ffd600', { type: 'achievements', value: 36 }, { w: ['mega_rocket', 'nuke'], ab: 'siphon', vis: { deco: ['hazard', 'spikes'] }, desc: 'The last word in destruction.' }]
  ];

  /* ---------- build tank objects ---------- */
  const list = [];
  const byId = {};
  for (const row of T) {
    const [id, name, cls, tier, body, accent, unlock, ov] = row;
    const C = CLASSES[cls];
    const o = ov || {};
    const base = {};
    STAT_KEYS.forEach((k, i) => (base[k] = C.stats[i]));
    // tier scaling
    const tt = tier - 1;
    base.hp = Math.round(base.hp * (1 + 0.22 * tt));
    base.damage = Math.round(base.damage * (1 + 0.13 * tt));
    base.armor = base.armor + 3 * tt;
    base.power = base.power + 2 * tt;
    base.speed = base.speed + 3 * tt;
    base.reload = +(base.reload + 0.25 * tt).toFixed(2);
    if (o.stats) for (const k in o.stats) base[k] = Math.round(base[k] * o.stats[k]);
    const vis = Object.assign({}, C.vis, o.vis || {}, { body, accent });
    vis.deco = [].concat(C.vis.deco || [], (o.vis && o.vis.deco) || []);
    const t = {
      id, name, cls, className: C.name, tier, unlock, base, vis,
      weapons: o.w || C.w.slice(),
      ability: o.ab || C.ab,
      desc: o.desc || '',
      size: vis.size || 1
    };
    list.push(t);
    byId[id] = t;
  }

  /* ------------------------------------------------------------
   * Upgrades
   * ------------------------------------------------------------ */
  const UPGRADES = [
    { key: 'hp', name: 'HP', icon: '❤️', desc: '+8% max health', base: 260 },
    { key: 'armor', name: 'Armor', icon: '🛡️', desc: '+3 armor (less damage taken)', base: 340 },
    { key: 'damage', name: 'Damage', icon: '💥', desc: '+6% weapon damage', base: 380 },
    { key: 'power', name: 'Power', icon: '🎯', desc: '+3% shot power / range', base: 280 },
    { key: 'reload', name: 'Reload', icon: '⏱️', desc: 'Special ability charges faster', base: 300 },
    { key: 'mobility', name: 'Mobility', icon: '⚙️', desc: '+10% fuel and drive speed', base: 220 },
    { key: 'special', name: 'Special', icon: '⭐', desc: '+12% special ability power', base: 320 }
  ];
  const MAX_UPG = 10;

  /* ------------------------------------------------------------
   * Ability upgrades (per ability, shared by every tank that has it)
   * each level: +15% ability power; Lv 3 and Lv 5: -1 turn recharge
   * ------------------------------------------------------------ */
  const ABILITY_MAX = 5;
  // ability base numbers shown in the garage preview (must match Battle._selfAbility)
  const ABILITY_PREVIEW = {
    repair: (k) => `Repairs ${Math.round(28 * k)}% of max HP`,
    shield: (k) => `Shield absorbs ${Math.round(30 * k)}% of max HP`,
    nitro: (k) => `Triple fuel + repairs ${Math.round(8 * k)}% HP`
  };

  const Tanks = (GT.Tanks = {
    list,
    byId,
    CLASSES,
    ABILITIES,
    UPGRADES,
    MAX_UPG,
    ABILITY_MAX,
    get(id) {
      return byId[id] || byId.t_rookie;
    },
    abilityMult(lvl) {
      return 1 + 0.15 * lvl;
    },
    abilityCd(abId, lvl) {
      const ab = ABILITIES[abId];
      const base = ab ? ab.cd : 4;
      return Math.max(2, base - (lvl >= 3 ? 1 : 0) - (lvl >= 5 ? 1 : 0));
    },
    abilityCost(lvl) {
      return Math.round((600 * Math.pow(1.7, lvl)) / 10) * 10;
    },
    /** short text describing the ability's strength at multiplier k */
    abilityPreview(abId, k) {
      const f = ABILITY_PREVIEW[abId];
      return f ? f(k) : `Ability power ${Math.round(k * 100)}%`;
    },
    upgradeCost(tank, key, lvl) {
      const u = UPGRADES.find((x) => x.key === key);
      return Math.round((u.base * (1 + 0.3 * (tank.tier - 1)) * Math.pow(1.35, lvl)) / 10) * 10;
    },
    /** effective stats including upgrades + tank level */
    stats(id) {
      const t = this.get(id);
      const S = GT.Save;
      const u = S ? S.upgrades(t.id) : {};
      const lvl = S ? S.tankLevel(t.id) : 1;
      const b = t.base;
      const st = {
        hp: Math.round(b.hp * (1 + 0.08 * (u.hp || 0)) * (1 + 0.025 * (lvl - 1))),
        armor: b.armor + 3 * (u.armor || 0),
        damage: Math.round(b.damage * (1 + 0.06 * (u.damage || 0)) * (1 + 0.02 * (lvl - 1))),
        power: Math.round(b.power * (1 + 0.03 * (u.power || 0))),
        speed: Math.round(b.speed * (1 + 0.1 * (u.mobility || 0))),
        reload: +(b.reload + 0.4 * (u.reload || 0)).toFixed(1),
        radius: b.radius,
        stability: b.stability,
        special: Math.round(100 * (1 + 0.12 * (u.special || 0))),
        level: lvl
      };
      return st;
    },
    /** power rating used for sorting / display */
    rating(id) {
      const s = this.stats(id);
      return Math.round(s.hp / 10 + s.armor * 2 + s.damage * 1.5 + s.power * 0.5 + s.speed * 0.3 + s.reload * 10 + (s.special - 100) * 0.5);
    }
  });

  /* ------------------------------------------------------------
   * Enemy types
   * dmg: multiplier on weapon base damage; acc: AI accuracy 0..1
   * ai: behavior flags (mover, support, kamikaze ...)
   * ------------------------------------------------------------ */
  const ENEMIES = {
    grunt: { name: 'Grunt', hp: 190, armor: 6, dmg: 0.72, power: 100, acc: 0.5, w: ['shell'], ai: 'basic', vis: { chassis: 'box', turret: 'dome', barrel: 'single', move: 'tracks', body: '#a33b3b', accent: '#3d2323' } },
    raider: { name: 'Raider', hp: 140, armor: 2, dmg: 0.68, power: 104, acc: 0.48, w: ['shell', 'triple'], ai: 'mover', vis: { chassis: 'low', turret: 'dome', barrel: 'single', move: 'wheels', body: '#e07b39', accent: '#5a2d10', size: 0.9 } },
    bulwark: { name: 'Bulwark', hp: 340, armor: 20, dmg: 0.8, power: 94, acc: 0.5, w: ['heavy_shell', 'shell'], ai: 'basic', vis: { chassis: 'heavy', turret: 'box', barrel: 'thick', move: 'tracks', body: '#5d5d66', accent: '#2a2a30', size: 1.12 } },
    marksman: { name: 'Marksman', hp: 160, armor: 4, dmg: 0.78, power: 122, acc: 0.68, w: ['sniper', 'shell'], ai: 'basic', vis: { chassis: 'wedge', turret: 'angled', barrel: 'long', move: 'tracks', body: '#6b7a3a', accent: '#2f3618' } },
    rocketeer: { name: 'Rocketeer', hp: 200, armor: 8, dmg: 0.7, power: 110, acc: 0.52, w: ['rocket', 'volley'], ai: 'basic', vis: { chassis: 'box', turret: 'box', barrel: 'pod', move: 'tracks', body: '#c62828', accent: '#1f1f1f' } },
    howitzer: { name: 'Howitzer', hp: 230, armor: 10, dmg: 0.74, power: 124, acc: 0.52, w: ['mortar', 'shell', 'cluster'], ai: 'basic', vis: { chassis: 'long', turret: 'tower', barrel: 'long', move: 'tracks', body: '#795548', accent: '#3e2723' } },
    aegis: { name: 'Aegis', hp: 230, armor: 14, dmg: 0.66, power: 100, acc: 0.5, w: ['shell'], ai: 'shielder', vis: { chassis: 'hex', turret: 'orb', barrel: 'single', move: 'tracks', body: '#3f51b5', accent: '#1a237e' } },
    mender: { name: 'Mender', hp: 200, armor: 8, dmg: 0.6, power: 100, acc: 0.45, w: ['shell'], ai: 'healer', vis: { chassis: 'round', turret: 'dome', barrel: 'short', move: 'wheels', body: '#e0e0e0', accent: '#2e7d32', deco: ['cross'] } },
    boomer: { name: 'Boomer', hp: 130, armor: 4, dmg: 1.2, power: 100, acc: 0.4, w: ['shell'], ai: 'kamikaze', vis: { chassis: 'round', turret: 'flat', barrel: 'short', move: 'wheels', body: '#222222', accent: '#ffd600', deco: ['hazard', 'bomb'], size: 0.9 } },
    hydra: { name: 'Hydra', hp: 250, armor: 10, dmg: 0.7, power: 100, acc: 0.5, w: ['shell', 'triple'], ai: 'basic', split: 'hydrling', vis: { chassis: 'hex', turret: 'twin', barrel: 'double', move: 'tracks', body: '#8e24aa', accent: '#311b92' } },
    hydrling: { name: 'Hydrling', hp: 85, armor: 2, dmg: 0.55, power: 100, acc: 0.45, w: ['shell'], ai: 'mover', vis: { chassis: 'hex', turret: 'dome', barrel: 'single', move: 'wheels', body: '#ab47bc', accent: '#4a148c', size: 0.7 } },
    scorcher: { name: 'Scorcher', hp: 210, armor: 8, dmg: 0.7, power: 96, acc: 0.5, w: ['fire', 'shell'], ai: 'basic', vis: { chassis: 'wedge', turret: 'box', barrel: 'short', move: 'tracks', body: '#e64a19', accent: '#3e2723', deco: ['exhaust'] } },
    frosty: { name: 'Frosty', hp: 220, armor: 12, dmg: 0.66, power: 100, acc: 0.5, w: ['ice', 'shell'], ai: 'basic', vis: { chassis: 'hex', turret: 'angled', barrel: 'single', move: 'tracks', body: '#4fc3f7', accent: '#01579b', deco: ['crystals'] } },
    volt: { name: 'Volt', hp: 200, armor: 8, dmg: 0.68, power: 104, acc: 0.54, w: ['lightning', 'shell'], ai: 'basic', vis: { chassis: 'box', turret: 'orb', barrel: 'coil', move: 'wheels', body: '#fbc02d', accent: '#283593' } },
    photon: { name: 'Photon', hp: 210, armor: 10, dmg: 0.68, power: 100, acc: 0.55, w: ['plasma', 'shell'], ai: 'basic', vis: { chassis: 'round', turret: 'orb', barrel: 'dish', move: 'hover', body: '#7e57c2', accent: '#1a0d3d' } },
    burrower: { name: 'Burrower', hp: 240, armor: 14, dmg: 0.7, power: 98, acc: 0.52, w: ['drill', 'shell'], ai: 'basic', vis: { chassis: 'wedge', turret: 'flat', barrel: 'drill', move: 'tracks', body: '#6d4c41', accent: '#ffb300' } },
    blaster: { name: 'Blaster', hp: 220, armor: 8, dmg: 0.66, power: 104, acc: 0.52, w: ['cluster', 'bouncer', 'shell'], ai: 'basic', vis: { chassis: 'box', turret: 'box', barrel: 'thick', move: 'tracks', body: '#d32f2f', accent: '#ffca28' } },
    lancer: { name: 'Lancer', hp: 190, armor: 6, dmg: 0.66, power: 110, acc: 0.6, w: ['laser', 'shell'], ai: 'basic', vis: { chassis: 'low', turret: 'angled', barrel: 'rail', move: 'hover', body: '#ec407a', accent: '#1f1f2e' } },
    plaguer: { name: 'Plaguer', hp: 220, armor: 10, dmg: 0.66, power: 100, acc: 0.52, w: ['poison', 'acid', 'shell'], ai: 'basic', vis: { chassis: 'round', turret: 'box', barrel: 'short', move: 'tracks', body: '#558b2f', accent: '#1b1b1b', deco: ['canisters'] } },
    homer: { name: 'Seeker', hp: 210, armor: 8, dmg: 0.62, power: 106, acc: 0.6, w: ['homing', 'rocket'], ai: 'basic', vis: { chassis: 'box', turret: 'box', barrel: 'pod', move: 'bigwheels', body: '#455a64', accent: '#ff3d00' } },
    juggernaut: { name: 'Juggernaut', hp: 400, armor: 24, dmg: 0.74, power: 96, acc: 0.55, w: ['mega_rocket', 'heavy_shell'], ai: 'basic', vis: { chassis: 'heavy', turret: 'twin', barrel: 'double', move: 'tracks', body: '#37474f', accent: '#d50000', size: 1.25, deco: ['spikes'] } }
  };
  for (const k in ENEMIES) ENEMIES[k].id = k;

  /* ------------------------------------------------------------
   * Bosses (one per world). phases: triggered at HP fraction.
   * enter actions: barrage, shield, heal, summon, rage, quake,
   *                meteor, airstrike, freeze
   * ------------------------------------------------------------ */
  const BOSSES = [
    { id: 'boss_1', name: 'Valley Warlord', world: 1, hp: 950, armor: 12, dmg: 0.8, acc: 0.55, scale: 1.7, vis: { chassis: 'heavy', turret: 'twin', barrel: 'double', move: 'tracks', body: '#6d4c41', accent: '#ffb300', deco: ['crown', 'spikes'] },
      phases: [{ w: ['heavy_shell', 'shell'] }, { at: 0.66, w: ['volley', 'heavy_shell'], enter: 'barrage', say: 'Missile barrage incoming!' }, { at: 0.33, w: ['cluster', 'heavy_shell'], enter: 'shield', say: 'Shields up!' }] },
    { id: 'boss_2', name: 'Sand Scorpion', world: 2, hp: 1350, armor: 14, dmg: 0.85, acc: 0.58, scale: 1.7, vis: { chassis: 'wedge', turret: 'angled', barrel: 'long', move: 'bigwheels', body: '#d4a24c', accent: '#5d3a0e', deco: ['spikes', 'tail'] },
      phases: [{ w: ['sniper', 'rocket'] }, { at: 0.66, w: ['split', 'rocket'], enter: 'summon', summon: 'raider', say: 'Raiders, attack!' }, { at: 0.33, w: ['poison', 'mortar'], enter: 'rage', say: 'The Scorpion is enraged!' }] },
    { id: 'boss_3', name: 'Magma Titan', world: 3, hp: 1800, armor: 18, dmg: 0.9, acc: 0.6, scale: 1.85, vis: { chassis: 'heavy', turret: 'box', barrel: 'thick', move: 'tracks', body: '#3e2723', accent: '#ff3d00', deco: ['core', 'spikes', 'crown'] },
      phases: [{ w: ['fire', 'heavy_shell'] }, { at: 0.66, w: ['napalm', 'mortar'], enter: 'meteor', say: 'Volcanic eruption!' }, { at: 0.33, w: ['mega_rocket', 'fire'], enter: 'heal', say: 'The Titan absorbs magma!' }] },
    { id: 'boss_4', name: 'Frost Colossus', world: 4, hp: 2300, armor: 22, dmg: 0.9, acc: 0.62, scale: 1.85, vis: { chassis: 'hex', turret: 'tower', barrel: 'double', move: 'tracks', body: '#b3e5fc', accent: '#01579b', deco: ['crystals', 'crown'] },
      phases: [{ w: ['ice', 'heavy_shell'] }, { at: 0.66, w: ['split', 'ice'], enter: 'freeze', say: 'Absolute zero!' }, { at: 0.33, w: ['mortar', 'cluster'], enter: 'shield', say: 'Ice armor forms!' }] },
    { id: 'boss_5', name: 'Jungle Behemoth', world: 5, hp: 2800, armor: 22, dmg: 0.92, acc: 0.63, scale: 1.9, vis: { chassis: 'round', turret: 'twin', barrel: 'pod', move: 'bigwheels', body: '#2e7d32', accent: '#1b1b1b', deco: ['camo', 'horns'] },
      phases: [{ w: ['rocket', 'poison'] }, { at: 0.66, w: ['homing', 'acid'], enter: 'summon', summon: 'plaguer', say: 'The jungle awakens!' }, { at: 0.33, w: ['mirv', 'poison'], enter: 'barrage', say: 'Behemoth unleashes its swarm!' }] },
    { id: 'boss_6', name: 'Scrap King', world: 6, hp: 3400, armor: 26, dmg: 0.95, acc: 0.65, scale: 1.95, vis: { chassis: 'heavy', turret: 'box', barrel: 'thick', move: 'tracks', body: '#8d6e63', accent: '#fdd835', deco: ['patches', 'spikes', 'crown'] },
      phases: [{ w: ['bouncer', 'heavy_shell'] }, { at: 0.66, w: ['cluster', 'roller'], enter: 'heal', say: 'The King repairs with scrap!' }, { at: 0.33, w: ['mega_rocket', 'mines'], enter: 'summon', summon: 'boomer', say: 'Boomers - charge!' }] },
    { id: 'boss_7', name: 'Lunar Overlord', world: 7, hp: 3900, armor: 26, dmg: 0.95, acc: 0.68, scale: 1.9, vis: { chassis: 'round', turret: 'orb', barrel: 'dish', move: 'hover', body: '#cfd8dc', accent: '#7c4dff', deco: ['core', 'crown'] },
      phases: [{ w: ['plasma', 'laser'] }, { at: 0.66, w: ['blackhole', 'plasma'], enter: 'shield', say: 'Gravity shield online!' }, { at: 0.33, w: ['laser', 'ghost'], enter: 'meteor', say: 'Meteor storm!' }] },
    { id: 'boss_8', name: 'Iron Foundry', world: 8, hp: 4500, armor: 30, dmg: 1.0, acc: 0.7, scale: 2.0, vis: { chassis: 'heavy', turret: 'tower', barrel: 'double', move: 'tracks', body: '#546e7a', accent: '#ff6f00', deco: ['exhaust', 'lights', 'spikes'] },
      phases: [{ w: ['mortar', 'rocket'] }, { at: 0.66, w: ['hellfire', 'mortar'], enter: 'airstrike', say: 'Bombers deployed!' }, { at: 0.33, w: ['bunker_buster', 'lightning'], enter: 'rage', say: 'Foundry overheating!' }] },
    { id: 'boss_9', name: 'Sky Fortress', world: 9, hp: 5200, armor: 32, dmg: 1.0, acc: 0.72, scale: 2.0, vis: { chassis: 'long', turret: 'twin', barrel: 'pod', move: 'hover', body: '#eceff1', accent: '#1565c0', deco: ['lights', 'crown'] },
      phases: [{ w: ['homing', 'rocket'] }, { at: 0.66, w: ['mirv', 'thunder'], enter: 'barrage', say: 'All batteries fire!' }, { at: 0.33, w: ['laser', 'hellfire'], enter: 'shield', say: 'Fortress shields at maximum!' }] },
    { id: 'boss_10', name: 'Omega Dreadnought', world: 10, hp: 6500, armor: 36, dmg: 1.05, acc: 0.75, scale: 2.2, vis: { chassis: 'heavy', turret: 'twin', barrel: 'double', move: 'tracks', body: '#1b1b1b', accent: '#ff1744', deco: ['core', 'spikes', 'crown', 'horns'] },
      phases: [{ w: ['mega_rocket', 'heavy_shell'] }, { at: 0.75, w: ['hellfire', 'mortar'], enter: 'summon', summon: 'bulwark', say: 'Reinforcements!' }, { at: 0.5, w: ['nuke', 'laser'], enter: 'barrage', say: 'Dreadnought goes nuclear!' }, { at: 0.25, w: ['solar', 'blackhole'], enter: 'heal', say: 'Omega protocol activated!' }] },
    { id: 'boss_11', name: 'King of Buses', world: 11, hp: 7000, armor: 36, dmg: 1.05, acc: 0.75, scale: 2.2, vis: { chassis: 'long', turret: 'box', barrel: 'thick', move: 'bigwheels', body: '#ffc107', accent: '#212121', deco: ['lights', 'exhaust', 'crown'] },
      phases: [{ w: ['big_bertha', 'rocket'] }, { at: 0.66, w: ['carpet_bomb', 'mortar'], enter: 'summon', summon: 'raider', say: 'All aboard the pain bus!' }, { at: 0.33, w: ['mega_rocket', 'swarm'], enter: 'rage', say: 'Next stop: your doom!' }] },
    { id: 'boss_12', name: 'Big Joe', world: 12, hp: 7500, armor: 36, dmg: 1.08, acc: 0.76, scale: 2.2, vis: { chassis: 'round', turret: 'dome', barrel: 'pod', move: 'bigwheels', body: '#1e88e5', accent: '#ff5252', deco: ['crown', 'horns', 'lights'] },
      phases: [{ w: ['pinball', 'heavy_shell'] }, { at: 0.66, w: ['starburst', 'grenade'], enter: 'shield', say: 'Joe says: nope!' }, { at: 0.33, w: ['hydra_mirv', 'boulder'], enter: 'barrage', say: 'JOE SMASH!' }] },
    { id: 'boss_13', name: 'Bog Monarch', world: 13, hp: 7800, armor: 36, dmg: 1.08, acc: 0.76, scale: 2.1, vis: { chassis: 'round', turret: 'twin', barrel: 'pod', move: 'hover', body: '#558b2f', accent: '#cddc39', deco: ['horns', 'camo'] },
      phases: [{ w: ['toxic_shell', 'poison'] }, { at: 0.66, w: ['plague', 'acid'], enter: 'summon', summon: 'plaguer', say: 'Rise from the bog!' }, { at: 0.33, w: ['acid', 'plague'], enter: 'heal', say: 'The swamp heals its king!' }] },
    { id: 'boss_14', name: 'Prism Golem', world: 14, hp: 8200, armor: 38, dmg: 1.1, acc: 0.78, scale: 2.1, vis: { chassis: 'hex', turret: 'orb', barrel: 'rail', move: 'tracks', body: '#b388ff', accent: '#ffffff', deco: ['crystals', 'core', 'crown'] },
      phases: [{ w: ['railgun', 'plasma'] }, { at: 0.66, w: ['starburst', 'laser'], enter: 'shield', say: 'Crystal armor!' }, { at: 0.33, w: ['storm_lance', 'railgun'], enter: 'freeze', say: 'Shatter!' }] },
    { id: 'boss_15', name: 'Captain Cannonbeard', world: 15, hp: 8600, armor: 38, dmg: 1.12, acc: 0.78, scale: 2.2, vis: { chassis: 'long', turret: 'twin', barrel: 'double', move: 'tracks', body: '#5d4037', accent: '#212121', deco: ['spikes', 'crown', 'patches'] },
      phases: [{ w: ['big_bertha', 'heavy_shell'] }, { at: 0.66, w: ['buckshot', 'mortar'], enter: 'barrage', say: 'Fire the broadside!' }, { at: 0.33, w: ['siege', 'carpet_bomb'], enter: 'summon', summon: 'howitzer', say: 'All hands on deck!' }] },
    { id: 'boss_16', name: 'Sugar Rush', world: 16, hp: 9000, armor: 38, dmg: 1.12, acc: 0.8, scale: 2.1, vis: { chassis: 'round', turret: 'dome', barrel: 'coil', move: 'hover', body: '#ff4081', accent: '#ffffff', deco: ['lights', 'crown'] },
      phases: [{ w: ['firecracker', 'bouncer'] }, { at: 0.66, w: ['starburst', 'pinball'], enter: 'heal', say: 'Sugar high!' }, { at: 0.33, w: ['swarm', 'cluster'], enter: 'rage', say: 'SUGAR CRASH!' }] },
    { id: 'boss_17', name: 'The Phantom', world: 17, hp: 9400, armor: 40, dmg: 1.15, acc: 0.8, scale: 2.1, vis: { chassis: 'wedge', turret: 'orb', barrel: 'dish', move: 'hover', body: '#37305a', accent: '#b388ff', deco: ['core', 'horns'] },
      phases: [{ w: ['ghost', 'phantom'] }, { at: 0.66, w: ['void_orb', 'ghost'], enter: 'shield', say: 'You cannot touch me...' }, { at: 0.33, w: ['phantom', 'blackhole'], enter: 'summon', summon: 'photon', say: 'Spirits, awaken!' }] },
    { id: 'boss_18', name: 'Mecha Overseer', world: 18, hp: 9800, armor: 42, dmg: 1.15, acc: 0.82, scale: 2.2, vis: { chassis: 'heavy', turret: 'tower', barrel: 'rail', move: 'tracks', body: '#90a4ae', accent: '#00e5ff', deco: ['lights', 'core', 'exhaust'] },
      phases: [{ w: ['railgun', 'smart_rocket'] }, { at: 0.66, w: ['emp_rocket', 'hellfire'], enter: 'summon', summon: 'juggernaut', say: 'Production line online!' }, { at: 0.33, w: ['storm_lance', 'swarm'], enter: 'airstrike', say: 'Drones deployed!' }] },
    { id: 'boss_19', name: 'Storm Tyrant', world: 19, hp: 10300, armor: 42, dmg: 1.18, acc: 0.82, scale: 2.2, vis: { chassis: 'hex', turret: 'tower', barrel: 'coil', move: 'tracks', body: '#455a64', accent: '#ffeb3b', deco: ['spikes', 'lights', 'crown'] },
      phases: [{ w: ['lightning', 'spark_ball'] }, { at: 0.66, w: ['thunder', 'storm_lance'], enter: 'barrage', say: 'Feel the storm!' }, { at: 0.33, w: ['tornado', 'thunder'], enter: 'rage', say: 'HURRICANE!' }] },
    { id: 'boss_20', name: 'Inferno Leviathan', world: 20, hp: 10800, armor: 44, dmg: 1.2, acc: 0.84, scale: 2.3, vis: { chassis: 'heavy', turret: 'box', barrel: 'thick', move: 'hover', body: '#bf360c', accent: '#ffab00', deco: ['core', 'spikes', 'horns'] },
      phases: [{ w: ['magma_ball', 'fire'] }, { at: 0.66, w: ['napalm', 'comet'], enter: 'meteor', say: 'The ocean boils!' }, { at: 0.33, w: ['solar', 'napalm'], enter: 'heal', say: 'Reborn in flame!' }] },
    { id: 'boss_21', name: 'Star Devourer', world: 21, hp: 11400, armor: 46, dmg: 1.22, acc: 0.85, scale: 2.3, vis: { chassis: 'round', turret: 'orb', barrel: 'dish', move: 'hover', body: '#263238', accent: '#e040fb', deco: ['core', 'crown', 'lights'] },
      phases: [{ w: ['plasma', 'void_orb'] }, { at: 0.66, w: ['blackhole', 'comet'], enter: 'shield', say: 'Event horizon!' }, { at: 0.33, w: ['antimatter', 'railgun'], enter: 'meteor', say: 'I will eat the stars!' }] },
    { id: 'boss_22', name: 'Doom Warden', world: 22, hp: 12000, armor: 48, dmg: 1.25, acc: 0.86, scale: 2.4, vis: { chassis: 'heavy', turret: 'twin', barrel: 'double', move: 'tracks', body: '#212121', accent: '#d50000', deco: ['spikes', 'horns', 'crown', 'core'] },
      phases: [{ w: ['siege', 'mega_rocket'] }, { at: 0.75, w: ['hydra_mirv', 'deep_strike'], enter: 'summon', summon: 'juggernaut', say: 'Guards!' }, { at: 0.5, w: ['nuke', 'claymore'], enter: 'barrage', say: 'None shall pass!' }, { at: 0.25, w: ['armageddon', 'solar'], enter: 'heal', say: 'The fortress feeds me!' }] },
    { id: 'boss_23', name: 'Grejs the Eternal', world: 23, hp: 13500, armor: 50, dmg: 1.3, acc: 0.88, scale: 2.5, vis: { chassis: 'heavy', turret: 'tower', barrel: 'double', move: 'tracks', body: '#6a1b9a', accent: '#ffd23f', deco: ['crown', 'core', 'spikes', 'horns', 'lights'] },
      phases: [{ w: ['grejs_bomb', 'mega_rocket'] }, { at: 0.8, w: ['hydra_mirv', 'railgun'], enter: 'summon', summon: 'juggernaut', say: 'Kneel before Grejs!' }, { at: 0.6, w: ['antimatter', 'swarm'], enter: 'barrage', say: 'You dare challenge me?!' }, { at: 0.4, w: ['armageddon', 'storm_lance'], enter: 'shield', say: 'Grejs is eternal!' }, { at: 0.2, w: ['nuke', 'grejs_bomb'], enter: 'rage', say: 'THIS IS GREJS WORLD!' }] }
  ];

  GT.Enemies = {
    types: ENEMIES,
    bosses: BOSSES,
    get(id) {
      return ENEMIES[id] || ENEMIES.grunt;
    },
    boss(world) {
      return BOSSES[world - 1] || BOSSES[0];
    }
  };
})();

