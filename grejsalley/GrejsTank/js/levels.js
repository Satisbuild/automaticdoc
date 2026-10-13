/* =====================================================================
 * GREJS TANKS - levels.js
 * Deterministic level generator: 23 worlds x 15 levels = 345 levels.
 * Each level varies terrain template, map width, wind, enemies,
 * spawn positions, events and features. Level 15 of each world is
 * the boss. Increase LEVELS_PER_WORLD or add worlds to extend.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const U = GT.U;

  const LEVELS_PER_WORLD = 15;

  const NAMES = {
    1: ['First Steps', 'Meadow Run', 'Sheep Hills', 'Old Mill', 'Windy Ridge', 'Brook Crossing', 'Twin Oaks', 'Farm Fields', 'Fox Den', 'Stone Bridge', 'Hilltop Fort', 'Sunset Slopes', 'Deep Valley', 'Grejs Gorge'],
    2: ['Hot Sands', 'Dune Sea', 'Mirage', 'Cactus Pass', 'Dry Creek', 'Scorpion Nest', 'Sun Temple', 'Oasis', 'Sandstorm', 'Bone Yard', 'Red Mesa', 'Canyon Run', 'Sultan\'s Gate', 'Dust Devil'],
    3: ['Ash Fields', 'Ember Road', 'Magma Falls', 'Obsidian Ridge', 'Sulfur Vents', 'Cinder Hill', 'Lava Lake', 'Smoke Stack', 'Fire Pit', 'Molten Core', 'Crater Rim', 'Hell\'s Kitchen', 'Burning Bridge', 'Caldera'],
    4: ['Snowfall', 'Frost Bite', 'Ice Shelf', 'Polar Pass', 'Glacier Bay', 'Frozen Lake', 'Yeti Tracks', 'Blizzard Peak', 'Crystal Cave', 'Avalanche', 'Northern Lights', 'Cold Front', 'White Out', 'Permafrost'],
    5: ['Vine Walk', 'Temple Ruins', 'Monkey Ridge', 'Swamp Edge', 'Canopy', 'Lost River', 'Serpent Coil', 'Waterfall', 'Mud Flats', 'Parrot Peak', 'Hidden Idol', 'Deep Roots', 'Tiger Trail', 'Heart of Green'],
    6: ['Scrap Heap', 'Rust Town', 'Dead Highway', 'Crater Field', 'Toxic Creek', 'Broken Tower', 'Junk Maze', 'Radiation Row', 'Ghost Mall', 'Burned Bridge', 'Fallout', 'Bunker Hill', 'Ashen Plains', 'Last Refuge'],
    7: ['Touchdown', 'Crater Hop', 'Dark Side', 'Moon Dust', 'Lunar Lab', 'Tranquility', 'Orbit Ridge', 'Zero-G Zone', 'Rover Tracks', 'Earthrise', 'Silent Sea', 'Comet Tail', 'Star Base', 'Eclipse Point'],
    8: ['Assembly Line', 'Steel Mill', 'Smog Alley', 'Conveyor', 'Pipe Works', 'Power Plant', 'Crane Yard', 'Blast Furnace', 'Rivet Row', 'Gearbox', 'Refinery', 'Scrap Press', 'Coolant Tanks', 'Iron Gate'],
    9: ['Cloud Nine', 'Sky Harbor', 'Floating Isles', 'Wind Temple', 'Eagle Nest', 'Rainbow Bridge', 'High Winds', 'Stratosphere', 'Air Castle', 'Storm Front', 'Sky Garden', 'Thunder Head', 'Falling Stars', 'Heaven\'s Edge'],
    10: ['No Man\'s Land', 'Trench Line', 'Red Horizon', 'Siege Works', 'Iron Rain', 'Blood Ridge', 'War Machine', 'Last Stand', 'Doom Valley', 'Fortress Omega', 'Inferno', 'Point of No Return', 'Armageddon', 'Final Gate'],
    11: ['Bus Stop', 'Rush Hour', 'Route 66', 'Traffic Jam', 'Double Decker', 'Depot', 'Ticket Booth', 'Night Bus', 'Detour', 'Road Works', 'Last Stop', 'Highway Chase', 'Terminal', 'The Big Garage'],
    12: ['Joe\'s Gate', 'Backyard', 'Treehouse', 'Joe\'s Garden', 'Sandbox', 'Trampoline Hill', 'Garden Gnomes', 'Pool Party', 'Shed Siege', 'BBQ Grill', 'Lawnmower Road', 'Joe\'s Fort', 'Rooftop', 'Joe\'s Throne'],
    13: ['Murky Shore', 'Frog Pond', 'Bubble Bog', 'Rotten Log', 'Mosquito Marsh', 'Sludge Pit', 'Witch Hut', 'Gas Vents', 'Leech Lake', 'Fungus Grove', 'Slime Falls', 'Sunken Ruins', 'Black Water', 'Bog Heart'],
    14: ['Glimmer Gate', 'Shard Hall', 'Amethyst Way', 'Echo Chamber', 'Quartz Bridge', 'Geode', 'Prism Pass', 'Deep Glow', 'Crystal Lake', 'Gem Mine', 'Mirror Maze', 'Diamond Core', 'Radiant Hall', 'Prism Throne'],
    15: ['Shipwreck', 'Parrot Bay', 'Skull Rock', 'Treasure Dig', 'Plank Walk', 'Rum Cove', 'Cannon Cliffs', 'Smuggler\'s Cave', 'Kraken Reef', 'Black Sail', 'Lighthouse', 'Mutiny', 'Gold Hoard', 'Captain\'s Deck'],
    16: ['Gumdrop Hill', 'Lollipop Lane', 'Chocolate River', 'Cotton Clouds', 'Jelly Fields', 'Candy Cane Pass', 'Cookie Fort', 'Marshmallow Peak', 'Caramel Falls', 'Licorice Maze', 'Cupcake Castle', 'Sour Swamp', 'Sugar Mountain', 'Sweet Throne'],
    17: ['Graveyard Gate', 'Spooky Path', 'Crooked House', 'Bone Field', 'Whisper Woods', 'Crypt', 'Bat Cave', 'Moonlit Hill', 'Ghost Town', 'Pumpkin Patch', 'Cursed Well', 'Haunted Manor', 'Shadow Lake', 'Phantom Hall'],
    18: ['Loading Bay', 'Bolt Alley', 'Circuit Board', 'Laser Grid', 'Robot Arms', 'Server Farm', 'Battery Row', 'Weld Works', 'Gear Tower', 'Control Room', 'Clone Vats', 'Core Reactor', 'Mainframe', 'Overseer Hub'],
    19: ['Rain Gate', 'Thunder Road', 'Lightning Rod', 'Hail Hill', 'Cloud Burst', 'Storm Watch', 'Gale Ridge', 'Static Peak', 'Eye of the Storm', 'Monsoon', 'Tempest', 'Sky Crack', 'Thunder Throne', 'Final Bolt'],
    20: ['Fire Steps', 'Ember Isles', 'Magma Reef', 'Burning Tide', 'Ash Atoll', 'Lava Surf', 'Cinder Rocks', 'Molten Bay', 'Fire Fountain', 'Boiling Deep', 'Obsidian Isle', 'Flame Strait', 'Inferno Sea', 'Leviathan\'s Lair'],
    21: ['Launch Pad', 'Asteroid Belt', 'Space Junk', 'Nebula', 'Ring World', 'Orbit Station', 'Dark Matter', 'Comet Run', 'Solar Wind', 'Wormhole', 'Supernova', 'Gravity Well', 'Event Horizon', 'Void Core'],
    22: ['Outer Wall', 'Spike Gate', 'Moat of Fire', 'Barracks', 'Armory', 'Dungeon', 'Iron Bridge', 'War Room', 'Tower of Doom', 'Torture Yard', 'Siege Ramp', 'Inner Keep', 'Throne Steps', 'Doom Gate'],
    23: ['Welcome to Grejs', 'Grejs Village', 'Golden Fields', 'Grejs River', 'Royal Road', 'Grejs Market', 'Hall of Heroes', 'Grejs Mountain', 'Crown Valley', 'Golden Bridge', 'Grejs Castle', 'Royal Garden', 'Throne Room', 'Grejs Summit']
  };

  const EVENTS = {
    wind: { name: 'Strong Wind', icon: '🌬️', desc: 'Wind is twice as strong.' },
    lowgrav: { name: 'Low Gravity', icon: '🪐', desc: 'Projectiles fly much further.' },
    double: { name: 'Double Damage', icon: '💥', desc: 'All damage is doubled - for everyone!' },
    barrels: { name: 'Explosive Terrain', icon: '🛢️', desc: 'Explosive barrels are scattered around.' },
    platforms: { name: 'Moving Platforms', icon: '🧱', desc: 'Indestructible platforms move across the sky.' },
    meteors: { name: 'Meteor Shower', icon: '☄️', desc: 'Meteors fall at the end of every round.' },
    toxic: { name: 'Toxic Zones', icon: '☣️', desc: 'Poisonous pools damage tanks standing in them.' },
    crates: { name: 'Supply Drops', icon: '📦', desc: 'More supply crates parachute in. Shoot them!' }
  };
  const WORLD_EVENTS = {
    1: ['wind', 'crates', 'barrels'],
    2: ['wind', 'barrels', 'crates', 'double'],
    3: ['meteors', 'barrels', 'double', 'wind'],
    4: ['wind', 'lowgrav', 'crates', 'platforms'],
    5: ['toxic', 'crates', 'wind', 'double'],
    6: ['toxic', 'barrels', 'meteors', 'double'],
    7: ['meteors', 'platforms', 'crates', 'double'],
    8: ['barrels', 'platforms', 'double', 'wind'],
    9: ['wind', 'platforms', 'lowgrav', 'crates'],
    10: ['meteors', 'barrels', 'double', 'toxic', 'platforms', 'wind'],
    11: ['barrels', 'crates', 'double', 'wind'],
    12: ['platforms', 'lowgrav', 'crates', 'double', 'barrels'],
    13: ['toxic', 'toxic', 'double', 'meteors'],
    14: ['platforms', 'double', 'lowgrav', 'crates'],
    15: ['wind', 'wind', 'barrels', 'crates'],
    16: ['lowgrav', 'crates', 'platforms', 'double'],
    17: ['toxic', 'meteors', 'double', 'platforms'],
    18: ['barrels', 'platforms', 'double', 'meteors'],
    19: ['wind', 'wind', 'meteors', 'double'],
    20: ['meteors', 'double', 'wind', 'crates'],
    21: ['meteors', 'lowgrav', 'platforms', 'double'],
    22: ['meteors', 'barrels', 'double', 'toxic', 'platforms', 'wind'],
    23: ['meteors', 'barrels', 'double', 'toxic', 'platforms', 'wind', 'crates']
  };

  const cache = {};

  function build(w, l) {
    const world = GT.Worlds.get(w);
    const r = U.rng(w * 7919 + l * 104729 + 17);
    const isBoss = l === LEVELS_PER_WORLD;
    const id = 'w' + w + '_l' + l;

    // --- template
    let template;
    if (world.templates.length === 1) template = world.templates[0];
    else if (w === 1 && l <= 2) template = l === 1 ? 'flat' : 'rolling';
    else if (isBoss) template = w === 9 ? 'islands' : r.pick(['rolling', 'valley', 'hill', 'plateaus']);
    else template = world.templates[(l + r.int(0, world.templates.length - 1)) % world.templates.length];

    // --- size
    let width = 1500 + w * 50 + (l > 7 ? 150 : 0) + r.int(0, 3) * 50;
    if (world.big) width = 2300 + r.int(0, 4) * 60;
    if (isBoss) width = Math.max(width, 1800);
    if (template === 'islands') width = Math.max(width, 1900);

    // --- enemies
    let count;
    if (isBoss) count = 1;
    else if (w === 1) count = l <= 4 ? 1 : l <= 9 ? (l % 2 ? 1 : 2) : 2;
    else if (w <= 3) count = l <= 3 ? 1 : l <= 9 ? 2 : r.int(2, 3);
    else if (w <= 7) count = l <= 2 ? 2 : r.int(2, 3);
    else if (w <= 10) count = l <= 2 ? 2 : r.int(2, 4);
    else count = l <= 2 ? 3 : r.int(3, 4);
    // hard mode: often an extra enemy on later levels of each world
    if (!isBoss && l >= 5 && r() < 0.5) count = Math.min(5, count + 1);

    const pool = world.enemies.slice(0, Math.min(world.enemies.length, 2 + Math.floor(l / 3)));
    const enemies = [];
    for (let i = 0; i < count; i++) enemies.push({ type: r.pick(pool) });
    if (isBoss) {
      enemies.length = 0;
      enemies.push({ type: 'boss', boss: GT.Enemies.boss(w).id });
      if (w >= 4) enemies.push({ type: r.pick(pool) });
      // world 9 gets a second escort; the final boss summons its own reinforcements instead
      if (w === 9 || w >= 11) enemies.push({ type: r.pick(pool) });
    }

    // --- difficulty scalar 0..~10
    const diff = (w - 1) + (l - 1) / LEVELS_PER_WORLD;

    // --- spawns
    const playerRight = !isBoss && l % 4 === 3;
    const n = enemies.length;
    const pSide = playerRight ? width * r.range(0.84, 0.9) : width * r.range(0.1, 0.16);
    const ex = [];
    for (let i = 0; i < n; i++) {
      const lo = 0.6, hi = 0.92;
      const t = n === 1 ? r.range(0.72, 0.88) : lo + ((hi - lo) * (i + 0.5)) / n + r.range(-0.03, 0.03);
      ex.push(playerRight ? width * (1 - t) : width * t);
    }
    const islandY = () => r.range(430, 640);
    const spawns = {
      player: { x: pSide, y: template === 'islands' ? islandY() : undefined },
      enemies: ex.map((x) => ({ x, y: template === 'islands' ? islandY() : undefined }))
    };

    // --- features
    const f = Object.assign({}, world.features);
    if (template === 'tunnels') f.tunnels = r.int(1, 2);
    if (template === 'pits') f.pits = r.int(1, 3);
    if (template === 'bunker') f.bunker = true;
    if (template === 'fortress') f.metal = (f.metal || 0) + 2;
    if (w >= 3 && r() < 0.25 && template !== 'islands') f.platforms = (f.platforms || 0) + 1;
    if (r() < 0.2 && w >= 2) f.caves = (f.caves || 0) + 1;
    if (isBoss) {
      delete f.bunker;
      f.pits = 0;
    }

    // --- event
    let event = null;
    if (!(w === 1 && l <= 3)) {
      if ([4, 7, 10, 13].includes(l) || (l > 3 && r() < 0.22)) event = r.pick(WORLD_EVENTS[w]);
      if (isBoss && w >= 3) event = r() < 0.5 ? r.pick(WORLD_EVENTS[w]) : null;
    }

    // --- wind
    let windMax = world.wind * (w === 1 && l <= 3 ? 0.4 : 0.6 + 0.4 * Math.min(1, l / 8));
    if (event === 'wind') windMax *= 2;
    windMax = Math.min(2, windMax); // keep wind gentle: never more than 2

    const par = 2 + n * 2 + (isBoss ? 4 : 0) + (w >= 5 ? 1 : 0);
    const coins = Math.round((150 + w * 90 + l * 12) * (isBoss ? 2.5 : 1));
    const xp = Math.round((45 + w * 18 + l * 2) * (isBoss ? 2 : 1));

    return {
      id, world: w, index: l, isBoss,
      name: isBoss ? 'BOSS: ' + GT.Enemies.boss(w).name : (NAMES[w] && NAMES[w][l - 1]) || 'Level ' + l,
      seed: w * 1000 + l * 37 + 5,
      template, width, height: 1000,
      amp: 35 + w * 5 + r.range(0, 35) + (template === 'flat' ? -20 : 0),
      peak: 170 + w * 14 + r.range(0, 80),
      base: template === 'islands' ? 1000 : 1000 * r.range(0.6, 0.68),
      flip: playerRight,
      features: f,
      void: !!world.void,
      spawns, enemies, diff, event, windMax, par,
      rewards: { coins, xp }
    };
  }

  GT.Levels = {
    PER_WORLD: LEVELS_PER_WORLD,
    EVENTS,
    get(w, l) {
      const id = 'w' + w + '_l' + l;
      if (!cache[id]) {
        try {
          cache[id] = build(w, l);
        } catch (e) {
          console.error('[Levels] failed to build', id, e);
          cache[id] = build(1, 1);
        }
      }
      // return a fresh copy since battle code may mutate spawns
      return JSON.parse(JSON.stringify(cache[id]));
    },
    parseId(id) {
      const m = /^w(\d+)_l(\d+)$/.exec(id || '');
      if (!m) return { w: 1, l: 1 };
      return { w: U.clamp(+m[1], 1, GT.Worlds.count), l: U.clamp(+m[2], 1, LEVELS_PER_WORLD) };
    },
    /** level is playable if first of world, or previous completed */
    isUnlocked(w, l) {
      if (!GT.Worlds.isUnlocked(w)) return false;
      if (l === 1) return true;
      return !!GT.Save.data.completed['w' + w + '_l' + (l - 1)];
    },
    total() {
      return GT.Worlds.count * LEVELS_PER_WORLD;
    },
    /** next level to play in campaign */
    nextCampaign() {
      for (let w = 1; w <= GT.Worlds.count; w++) {
        if (!GT.Worlds.isUnlocked(w)) return null;
        for (let l = 1; l <= LEVELS_PER_WORLD; l++) {
          if (!GT.Save.data.completed['w' + w + '_l' + l]) return { w, l };
        }
      }
      return { w: GT.Worlds.count, l: LEVELS_PER_WORLD };
    }
  };
})();

