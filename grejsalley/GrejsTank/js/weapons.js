/* =====================================================================
 * GREJS TANKS - weapons.js
 * Data-driven weapon / projectile definitions (80 weapons).
 *
 * Fields:
 *  type     projectile behavior: ballistic | bounce | roll | drill | pierce
 *           | ghost | laser | homing | split | cluster | marker | rain
 *           | mines | dirt | tunnel
 *  dmg, r   base damage and explosion radius
 *  ammo     shots per battle (-1 = infinite)
 *  speed/grav/wind   multipliers on launch speed, gravity and wind drift
 *  count/spread/seq  multi-shot: projectiles, spread in degrees, delay
 *  effects  burn, poison, freeze, chain, emp, knock, quake, pull
 *  good     tags shown in UI: big, groups, bunker, far, under
 *  level    player level required; price = coins to buy after that
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;

  const W = [
    { id: 'shell', name: 'Normal Shell', icon: '●', cat: 'shell', type: 'ballistic', dmg: 60, r: 38, ammo: -1, trail: 'dot', color: '#ffe08a', size: 5, good: [], level: 1, price: 0, desc: 'Reliable standard shell. Infinite ammo.' },
    { id: 'heavy_shell', name: 'Heavy Shell', icon: '⬤', cat: 'shell', type: 'ballistic', dmg: 95, r: 48, ammo: 3, speed: 0.97, trail: 'smoke', color: '#ffb35a', size: 7, good: ['big'], level: 1, price: 0, desc: 'Bigger boom, bigger crater.' },
    { id: 'triple', name: 'Triple Shot', icon: '⁂', cat: 'shell', type: 'ballistic', dmg: 38, r: 30, ammo: 3, count: 3, spread: 5, trail: 'dot', color: '#ffe08a', size: 4, good: ['groups'], level: 1, price: 0, desc: 'Three shells in a fan. Great for forgiving aim.' },
    { id: 'rocket', name: 'Rocket', icon: '🚀', cat: 'rocket', type: 'ballistic', dmg: 78, r: 40, ammo: 3, speed: 1.12, grav: 0.8, wind: 0.6, trail: 'smoke', color: '#ff6a3d', size: 6, sprite: 'rocket', good: ['far'], level: 2, price: 400, sound: 'rocket', desc: 'Fast rocket with a flatter flight path. Less affected by wind.' },
    { id: 'volley', name: 'Volley', icon: '⋯', cat: 'shell', type: 'ballistic', dmg: 30, r: 28, ammo: 2, count: 5, seq: 0.16, spread: 2.2, trail: 'dot', color: '#ffe08a', size: 4, good: ['groups'], level: 3, price: 600, desc: 'Fires five shells one after another.' },
    { id: 'bouncer', name: 'Bouncing Bomb', icon: '◉', cat: 'explosive', type: 'bounce', dmg: 72, r: 42, ammo: 2, bounces: 3, trail: 'dot', color: '#8ef', size: 7, sprite: 'bomb', good: ['bunker'], level: 4, price: 750, desc: 'Bounces three times before exploding. Great around corners.' },
    { id: 'cluster', name: 'Cluster Bomb', icon: '✺', cat: 'explosive', type: 'cluster', dmg: 45, r: 32, ammo: 2, sub: { n: 6, dmg: 28, r: 26, spd: 260 }, trail: 'smoke', color: '#ffcf4a', size: 7, sprite: 'bomb', good: ['groups'], level: 5, price: 900, desc: 'Splits into six bomblets on impact.' },
    { id: 'drill', name: 'Drill Projectile', icon: '⛏', cat: 'special', type: 'drill', dmg: 85, r: 40, ammo: 2, drill: 150, trail: 'dot', color: '#c9c9d6', size: 6, sprite: 'drill', good: ['bunker', 'under'], level: 6, price: 1000, sound: 'drill', desc: 'Drills 150 units through the ground before detonating.' },
    { id: 'fire', name: 'Fire Bomb', icon: '🔥', cat: 'elemental', type: 'ballistic', dmg: 45, r: 40, ammo: 2, burn: { dmg: 22, turns: 3, r: 80 }, trail: 'fire', color: '#ff7a1a', size: 7, good: ['groups'], level: 7, price: 1100, sound: 'burn', desc: 'Sets the ground and tanks on fire for 3 turns.' },
    { id: 'ice', name: 'Ice Bomb', icon: '❄', cat: 'elemental', type: 'ballistic', dmg: 42, r: 42, ammo: 2, freeze: 1, trail: 'ice', color: '#aef', size: 7, good: ['big'], level: 8, price: 1200, sound: 'freeze', desc: 'Freezes hit tanks - they skip their next turn.' },
    { id: 'split', name: 'Split Missile', icon: '⋔', cat: 'rocket', type: 'split', dmg: 45, r: 34, ammo: 2, sub: { n: 3, dmg: 45, r: 34, spread: 0.22 }, speed: 1.05, grav: 0.9, trail: 'smoke', color: '#ff6a3d', size: 6, sprite: 'rocket', good: ['groups', 'far'], level: 9, price: 1300, sound: 'rocket', desc: 'Splits into three missiles at the top of its arc.' },
    { id: 'mega_rocket', name: 'Mega Rocket', icon: '🎇', cat: 'rocket', type: 'ballistic', dmg: 140, r: 62, ammo: 1, speed: 1.08, grav: 0.85, wind: 0.5, trail: 'smoke', color: '#ff3d3d', size: 9, sprite: 'rocket', good: ['big'], level: 10, price: 1600, sound: 'rocket', desc: 'A huge rocket with a massive warhead.' },
    { id: 'plasma', name: 'Plasma Shot', icon: '✦', cat: 'energy', type: 'ballistic', dmg: 82, r: 46, ammo: 2, speed: 0.92, grav: 0.45, wind: 0.2, trail: 'glow', color: '#6cf5ff', size: 8, glow: true, good: ['far'], level: 11, price: 1700, sound: 'plasma', desc: 'Energy orb with a floaty, low-gravity arc.' },
    { id: 'sniper', name: 'Sniper Round', icon: '➶', cat: 'shell', type: 'ballistic', dmg: 105, r: 20, ammo: 2, speed: 1.45, grav: 0.55, wind: 0.3, crit: 2, trail: 'dot', color: '#fff', size: 4, good: ['far', 'big'], level: 12, price: 1800, desc: 'Very fast and precise. Direct hits deal double damage.' },
    { id: 'poison', name: 'Poison Bomb', icon: '☣', cat: 'elemental', type: 'ballistic', dmg: 35, r: 40, ammo: 2, poison: { dmg: 26, turns: 3, r: 95 }, trail: 'toxic', color: '#7dff4a', size: 7, good: ['groups', 'big'], level: 13, price: 1900, sound: 'poison', desc: 'Leaves a toxic cloud. Poisoned tanks take damage every turn.' },
    { id: 'lightning', name: 'Lightning Shell', icon: '⚡', cat: 'energy', type: 'ballistic', dmg: 68, r: 36, ammo: 2, chain: { n: 3, dmg: 48, range: 480 }, trail: 'spark', color: '#fff27a', size: 6, glow: true, good: ['groups'], level: 14, price: 2000, sound: 'zap', desc: 'Lightning chains to up to 3 nearby tanks.' },
    { id: 'roller', name: 'Roller Bomb', icon: '◍', cat: 'explosive', type: 'roll', dmg: 90, r: 46, ammo: 2, trail: 'dot', color: '#d0d0d0', size: 8, sprite: 'bomb', good: ['bunker'], level: 15, price: 2100, desc: 'Lands and rolls along the ground until it hits something.' },
    { id: 'shotgun', name: 'Scatter Shot', icon: '⁘', cat: 'shell', type: 'ballistic', dmg: 22, r: 20, ammo: 2, count: 7, spread: 13, speed: 0.95, trail: 'dot', color: '#ffe08a', size: 3, good: ['groups'], level: 16, price: 2200, desc: 'Seven pellets in a wide cone. Deadly up close.' },
    { id: 'homing', name: 'Homing Missile', icon: '🎯', cat: 'rocket', type: 'homing', dmg: 88, r: 40, ammo: 2, homing: 2.4, speed: 1.0, grav: 0.7, trail: 'smoke', color: '#ff6a3d', size: 6, sprite: 'rocket', good: ['far'], level: 17, price: 2400, sound: 'rocket', desc: 'Locks onto the nearest enemy after launch.' },
    { id: 'laser', name: 'Laser Shot', icon: '═', cat: 'energy', type: 'laser', dmg: 92, r: 12, ammo: 2, range: 1500, color: '#ff4df0', good: ['far', 'groups'], level: 18, price: 2500, sound: 'laser', desc: 'Instant straight beam that pierces every tank in its path.' },
    { id: 'dirt', name: 'Dirt Bomb', icon: '⛰', cat: 'special', type: 'dirt', dmg: 0, r: 72, ammo: 2, trail: 'dot', color: '#a0703c', size: 8, good: ['bunker'], level: 19, price: 1500, desc: 'Creates a ball of earth. Bury enemies or build cover.' },
    { id: 'airstrike', name: 'Air Strike', icon: '✈', cat: 'special', type: 'marker', dmg: 10, r: 14, ammo: 1, marker: { kind: 'bombs', n: 5, dmg: 46, r: 36, spread: 150 }, trail: 'spark', color: '#ff4040', size: 5, good: ['groups', 'bunker'], level: 20, price: 2800, desc: 'Marks a spot - five bombs rain down on it.' },
    { id: 'napalm', name: 'Napalm', icon: '♨', cat: 'elemental', type: 'cluster', dmg: 40, r: 36, ammo: 1, sub: { n: 8, dmg: 12, r: 18, spd: 200, fire: true }, burn: { dmg: 26, turns: 3, r: 130 }, trail: 'fire', color: '#ff5a1a', size: 8, good: ['groups'], level: 21, price: 3000, sound: 'burn', desc: 'Splashes burning fuel over a wide area.' },
    { id: 'pierce', name: 'Piercing Shot', icon: '➹', cat: 'shell', type: 'pierce', dmg: 100, r: 34, ammo: 2, pierce: 230, speed: 1.1, trail: 'spark', color: '#e0e6ff', size: 5, good: ['bunker', 'under'], level: 22, price: 3100, desc: 'Passes through up to 230 units of ground to reach hidden targets.' },
    { id: 'mortar', name: 'Mortar', icon: '⌒', cat: 'shell', type: 'ballistic', dmg: 118, r: 52, ammo: 2, speed: 1.15, grav: 1.6, trail: 'smoke', color: '#ffb35a', size: 8, good: ['bunker', 'big'], level: 23, price: 3200, sound: 'heavyfire', desc: 'Heavy, steep-falling shell. Hits hard behind cover.' },
    { id: 'mirv', name: 'MIRV', icon: '⩚', cat: 'rocket', type: 'split', dmg: 40, r: 30, ammo: 1, sub: { n: 5, dmg: 50, r: 38, spread: 0.35 }, speed: 1.05, trail: 'smoke', color: '#ff3d3d', size: 7, sprite: 'rocket', good: ['groups'], level: 24, price: 3500, sound: 'rocket', desc: 'Releases five warheads at the apex.' },
    { id: 'tunnel', name: 'Tunneler', icon: '↯', cat: 'special', type: 'tunnel', dmg: 88, r: 44, ammo: 2, drill: 320, trail: 'dot', color: '#c9c9d6', size: 6, sprite: 'drill', good: ['under', 'bunker'], level: 25, price: 3600, sound: 'drill', desc: 'Burrows horizontally underground and erupts under the enemy.' },
    { id: 'meteor', name: 'Meteor', icon: '☄', cat: 'special', type: 'marker', dmg: 10, r: 14, ammo: 1, marker: { kind: 'meteor', n: 1, dmg: 155, r: 72 }, trail: 'spark', color: '#ff9a3d', size: 5, good: ['big', 'bunker'], level: 26, price: 3900, desc: 'Marks a spot - a meteor crashes down from space.' },
    { id: 'ghost', name: 'Ghost Shell', icon: '👻', cat: 'energy', type: 'ghost', dmg: 90, r: 42, ammo: 2, trail: 'glow', color: '#c7b8ff', size: 7, glow: true, good: ['bunker', 'under'], level: 27, price: 4000, sound: 'plasma', desc: 'Phases through ground while rising. Only solid on the way down.' },
    { id: 'shockwave', name: 'Shockwave', icon: '◎', cat: 'energy', type: 'ballistic', dmg: 55, r: 62, ammo: 2, knock: 3.2, trail: 'glow', color: '#9fd8ff', size: 7, glow: true, good: ['groups'], level: 28, price: 4100, desc: 'Massive knockback. Push enemies into pits and lava.' },
    { id: 'emp', name: 'EMP Blast', icon: 'ϟ', cat: 'energy', type: 'ballistic', dmg: 45, r: 85, ammo: 2, emp: 2, trail: 'spark', color: '#7af', size: 7, glow: true, good: ['big'], level: 29, price: 4200, sound: 'zap', desc: 'Destroys shields and disables abilities for 2 turns.' },
    { id: 'acid', name: 'Acid Rain', icon: '☔', cat: 'elemental', type: 'rain', dmg: 20, r: 22, ammo: 1, sub: { n: 12, dmg: 20, r: 24, width: 170 }, poison: { dmg: 14, turns: 2, r: 60 }, trail: 'toxic', color: '#9dff3a', size: 7, good: ['groups', 'bunker'], level: 30, price: 4400, sound: 'poison', desc: 'Bursts at the apex and pours acid over a wide area.' },
    { id: 'mines', name: 'Mine Layer', icon: '✹', cat: 'explosive', type: 'mines', dmg: 72, r: 44, ammo: 2, count: 3, spread: 7, trail: 'dot', color: '#ff4d4d', size: 5, good: ['groups'], level: 31, price: 4500, desc: 'Drops 3 proximity mines that trigger when tanks come close.' },
    { id: 'thunder', name: 'Thunderstorm', icon: '⛈', cat: 'energy', type: 'marker', dmg: 10, r: 14, ammo: 1, marker: { kind: 'lightning', n: 4, dmg: 58, r: 34, spread: 170 }, trail: 'spark', color: '#fff27a', size: 5, good: ['groups', 'under'], level: 32, price: 4700, desc: 'Summons four lightning strikes around the marker.' },
    { id: 'quake', name: 'Quake Shell', icon: '〰', cat: 'special', type: 'ballistic', dmg: 60, r: 36, ammo: 1, quake: { dmg: 80, range: 380 }, trail: 'smoke', color: '#c9a06a', size: 8, good: ['groups', 'bunker'], level: 33, price: 4900, desc: 'Seismic blast hurts every grounded tank within 380 units.' },
    { id: 'bunker_buster', name: 'Bunker Buster', icon: '⬇', cat: 'explosive', type: 'drill', dmg: 150, r: 60, ammo: 1, drill: 80, speed: 1.05, trail: 'smoke', color: '#b8b8c8', size: 9, sprite: 'drill', good: ['bunker', 'under', 'big'], level: 34, price: 5200, sound: 'heavyfire', desc: 'Penetrates the ground, then detonates with huge force.' },
    { id: 'blackhole', name: 'Black Hole', icon: '◐', cat: 'energy', type: 'ballistic', dmg: 110, r: 72, ammo: 1, pull: 150, trail: 'glow', color: '#b36bff', size: 9, glow: true, good: ['groups'], level: 35, price: 5600, sound: 'plasma', desc: 'Collapses into a singularity that sucks tanks in.' },
    { id: 'hellfire', name: 'Hellfire', icon: '♆', cat: 'rocket', type: 'homing', dmg: 58, r: 36, ammo: 1, homing: 2.0, count: 3, seq: 0.22, spread: 6, speed: 1.0, grav: 0.7, trail: 'fire', color: '#ff3d1a', size: 6, sprite: 'rocket', good: ['groups', 'far'], level: 36, price: 6000, sound: 'rocket', desc: 'Three homing rockets in rapid succession.' },
    { id: 'solar', name: 'Solar Flare', icon: '☀', cat: 'energy', type: 'ballistic', dmg: 175, r: 82, ammo: 1, speed: 0.9, grav: 0.5, wind: 0.2, burn: { dmg: 20, turns: 2, r: 90 }, trail: 'fire', color: '#ffdd55', size: 12, glow: true, good: ['big', 'groups'], level: 38, price: 7000, sound: 'plasma', desc: 'A miniature sun. Enormous blast and burning ground.' },
    { id: 'nuke', name: 'Nuclear Bomb', icon: '☢', cat: 'explosive', type: 'ballistic', dmg: 260, r: 125, ammo: 1, speed: 0.95, trail: 'smoke', color: '#d8ff3a', size: 11, sprite: 'nuke', good: ['big', 'groups'], level: 40, price: 9000, sound: 'heavyfire', desc: 'The ultimate weapon. Devastating radius. Handle with care.' },
    // ---- extra arsenal ----
    { id: 'pebble', name: 'Pebble Shot', icon: '·', cat: 'shell', type: 'ballistic', dmg: 34, r: 24, ammo: 6, speed: 1.08, trail: 'dot', color: '#d9d2c3', size: 3, good: ['far'], level: 1, price: 150, desc: 'Small, fast and plentiful. Six shots per battle.' },
    { id: 'twin_shell', name: 'Twin Shell', icon: '⁚', cat: 'shell', type: 'ballistic', dmg: 44, r: 30, ammo: 3, count: 2, spread: 3, trail: 'dot', color: '#ffe08a', size: 4, good: ['groups'], level: 1, price: 200, desc: 'Two shells side by side.' },
    { id: 'skipper', name: 'Skipper', icon: '◌', cat: 'explosive', type: 'bounce', dmg: 50, r: 34, ammo: 3, bounces: 2, trail: 'dot', color: '#9fe', size: 6, sprite: 'bomb', good: ['bunker'], level: 2, price: 300, desc: 'A small bomb that skips twice before going off.' },
    { id: 'firecracker', name: 'Firecracker', icon: '🧨', cat: 'explosive', type: 'cluster', dmg: 30, r: 26, ammo: 3, sub: { n: 4, dmg: 18, r: 20, spd: 220 }, trail: 'spark', color: '#ff4a4a', size: 5, sprite: 'bomb', good: ['groups'], level: 2, price: 350, desc: 'Pops into four little blasts.' },
    { id: 'bottle_rocket', name: 'Bottle Rocket', icon: '🎆', cat: 'rocket', type: 'ballistic', dmg: 55, r: 32, ammo: 4, speed: 1.2, grav: 0.7, wind: 0.8, trail: 'spark', color: '#ff8a3d', size: 5, sprite: 'rocket', good: ['far'], level: 3, price: 450, sound: 'rocket', desc: 'Cheap, quick rocket with a flat arc.' },
    { id: 'mud_ball', name: 'Mud Ball', icon: '🟤', cat: 'special', type: 'dirt', dmg: 0, r: 50, ammo: 3, trail: 'dot', color: '#8a5a32', size: 7, good: ['bunker'], level: 3, price: 400, desc: 'A smaller dirt bomb. Quick cover or a trap.' },
    { id: 'burst', name: 'Burst Fire', icon: '⋮', cat: 'shell', type: 'ballistic', dmg: 26, r: 22, ammo: 3, count: 3, seq: 0.1, spread: 1, trail: 'dot', color: '#fff2a8', size: 3, good: ['far'], level: 4, price: 550, desc: 'Three quick shells along the same line.' },
    { id: 'frost_dart', name: 'Frost Dart', icon: '❅', cat: 'elemental', type: 'ballistic', dmg: 30, r: 26, ammo: 2, speed: 1.25, grav: 0.7, freeze: 1, trail: 'ice', color: '#bff', size: 4, good: ['far'], level: 5, price: 800, sound: 'freeze', desc: 'Fast icy dart that freezes on a hit.' },
    { id: 'grenade', name: 'Grenade', icon: '💣', cat: 'explosive', type: 'bounce', dmg: 80, r: 44, ammo: 2, bounces: 1, trail: 'smoke', color: '#6b8e23', size: 7, sprite: 'bomb', good: ['big'], level: 6, price: 950, desc: 'Bounces once and explodes with a punch.' },
    { id: 'buckshot', name: 'Buckshot', icon: '⁖', cat: 'shell', type: 'ballistic', dmg: 18, r: 18, ammo: 3, count: 10, spread: 18, speed: 0.9, trail: 'dot', color: '#ffe08a', size: 3, good: ['groups'], level: 7, price: 1050, desc: 'Ten pellets in a huge cone.' },
    { id: 'drill_bit', name: 'Drill Bit', icon: '🔩', cat: 'special', type: 'drill', dmg: 60, r: 32, ammo: 3, drill: 90, trail: 'dot', color: '#c9c9d6', size: 5, sprite: 'drill', good: ['under'], level: 8, price: 1150, sound: 'drill', desc: 'A small drill that digs 90 units down.' },
    { id: 'spark_ball', name: 'Spark Ball', icon: '✧', cat: 'energy', type: 'ballistic', dmg: 50, r: 34, ammo: 3, grav: 0.6, chain: { n: 2, dmg: 30, range: 320 }, trail: 'spark', color: '#fff27a', size: 6, glow: true, good: ['groups'], level: 9, price: 1250, sound: 'zap', desc: 'Floaty orb that zaps two nearby tanks.' },
    { id: 'big_bertha', name: 'Big Bertha', icon: '⬛', cat: 'shell', type: 'ballistic', dmg: 125, r: 56, ammo: 1, speed: 0.92, grav: 1.1, trail: 'smoke', color: '#a08060', size: 10, good: ['big'], level: 10, price: 1500, sound: 'heavyfire', desc: 'An enormous, slow cannonball.' },
    { id: 'smart_rocket', name: 'Smart Rocket', icon: '🛰', cat: 'rocket', type: 'homing', dmg: 62, r: 34, ammo: 2, homing: 1.6, speed: 1.05, grav: 0.75, trail: 'smoke', color: '#7fd0ff', size: 5, sprite: 'rocket', good: ['far'], level: 11, price: 1650, sound: 'rocket', desc: 'Gently steers toward the closest enemy.' },
    { id: 'toxic_shell', name: 'Toxic Shell', icon: '🧪', cat: 'elemental', type: 'ballistic', dmg: 48, r: 34, ammo: 2, poison: { dmg: 18, turns: 2, r: 60 }, trail: 'toxic', color: '#a6ff4d', size: 6, good: ['big'], level: 12, price: 1750, sound: 'poison', desc: 'Leaves a small poison pool.' },
    { id: 'pinball', name: 'Pinball', icon: '🔘', cat: 'explosive', type: 'bounce', dmg: 64, r: 38, ammo: 2, bounces: 6, trail: 'glow', color: '#e0e0ff', size: 6, sprite: 'bomb', good: ['bunker'], level: 13, price: 1850, desc: 'Bounces six times. Hard to predict, hard to dodge.' },
    { id: 'starburst', name: 'Starburst', icon: '✷', cat: 'energy', type: 'split', dmg: 30, r: 28, ammo: 2, sub: { n: 7, dmg: 28, r: 26, spread: 0.5 }, trail: 'glow', color: '#ffd1ff', size: 6, glow: true, good: ['groups'], level: 14, price: 1950, sound: 'plasma', desc: 'Bursts into seven glowing shards at the apex.' },
    { id: 'boulder', name: 'Boulder', icon: '🪨', cat: 'explosive', type: 'roll', dmg: 120, r: 50, ammo: 1, trail: 'dot', color: '#8a8a8a', size: 10, sprite: 'bomb', good: ['big', 'bunker'], level: 15, price: 2150, desc: 'A huge rolling rock that crushes what it meets.' },
    { id: 'railgun', name: 'Railgun', icon: '┅', cat: 'energy', type: 'laser', dmg: 120, r: 16, ammo: 1, range: 2200, color: '#4dd2ff', good: ['far'], level: 16, price: 2300, sound: 'laser', desc: 'Long, straight high-power beam.' },
    { id: 'blizzard', name: 'Blizzard', icon: '🌨', cat: 'elemental', type: 'rain', dmg: 18, r: 22, ammo: 1, sub: { n: 10, dmg: 18, r: 22, width: 160 }, freeze: 1, trail: 'ice', color: '#dff6ff', size: 7, good: ['groups'], level: 17, price: 2450, sound: 'freeze', desc: 'Snows icy chunks over a wide area.' },
    { id: 'magma_ball', name: 'Magma Ball', icon: '🌋', cat: 'elemental', type: 'roll', dmg: 70, r: 42, ammo: 2, burn: { dmg: 20, turns: 3, r: 70 }, trail: 'fire', color: '#ff5a1a', size: 8, good: ['bunker'], level: 18, price: 2600, sound: 'burn', desc: 'Rolls along the ground leaving fire behind.' },
    { id: 'dirt_wall', name: 'Earth Wall', icon: '🧱', cat: 'special', type: 'dirt', dmg: 0, r: 105, ammo: 1, trail: 'dot', color: '#7a5030', size: 9, good: ['bunker'], level: 19, price: 1900, desc: 'A giant dirt ball. Bury enemies completely.' },
    { id: 'carpet_bomb', name: 'Carpet Bomb', icon: '🛩', cat: 'special', type: 'marker', dmg: 10, r: 14, ammo: 1, marker: { kind: 'bombs', n: 9, dmg: 34, r: 30, spread: 260 }, trail: 'spark', color: '#ff4040', size: 5, good: ['groups'], level: 20, price: 2900, desc: 'Nine bombs spread over a wide strip.' },
    { id: 'phantom', name: 'Phantom Rocket', icon: '🌀', cat: 'rocket', type: 'ghost', dmg: 70, r: 38, ammo: 2, speed: 1.1, grav: 0.8, trail: 'glow', color: '#b0a0ff', size: 6, sprite: 'rocket', good: ['bunker'], level: 21, price: 3050, sound: 'rocket', desc: 'A ghost rocket that passes through hills on the way up.' },
    { id: 'lance', name: 'Earth Lance', icon: '⤓', cat: 'shell', type: 'pierce', dmg: 85, r: 30, ammo: 2, pierce: 380, speed: 1.2, trail: 'spark', color: '#f0e0c0', size: 5, good: ['under'], level: 22, price: 3150, desc: 'Pierces 380 units of ground.' },
    { id: 'siege', name: 'Siege Shell', icon: '🏰', cat: 'shell', type: 'ballistic', dmg: 135, r: 58, ammo: 1, speed: 1.2, grav: 1.9, trail: 'smoke', color: '#c08050', size: 9, good: ['bunker', 'big'], level: 23, price: 3300, sound: 'heavyfire', desc: 'Drops almost straight down onto hidden targets.' },
    { id: 'swarm', name: 'Swarm', icon: '🐝', cat: 'rocket', type: 'homing', dmg: 26, r: 24, ammo: 1, homing: 2.8, count: 6, seq: 0.12, spread: 10, speed: 0.95, grav: 0.6, trail: 'smoke', color: '#ffcc33', size: 4, sprite: 'rocket', good: ['groups'], level: 24, price: 3550, sound: 'rocket', desc: 'Six mini homing rockets.' },
    { id: 'mole', name: 'Mole Bomb', icon: '🐀', cat: 'special', type: 'tunnel', dmg: 70, r: 38, ammo: 3, drill: 220, trail: 'dot', color: '#a08070', size: 5, sprite: 'drill', good: ['under'], level: 25, price: 3650, sound: 'drill', desc: 'Cheaper tunneler that pops up under the enemy.' },
    { id: 'comet', name: 'Comet Swarm', icon: '💫', cat: 'special', type: 'marker', dmg: 10, r: 14, ammo: 1, marker: { kind: 'meteor', n: 3, dmg: 80, r: 50, spread: 200 }, trail: 'spark', color: '#ffb84d', size: 5, good: ['groups', 'big'], level: 26, price: 3950, desc: 'Three meteors crash around the marker.' },
    { id: 'void_orb', name: 'Void Orb', icon: '⚫', cat: 'energy', type: 'ghost', dmg: 105, r: 50, ammo: 1, grav: 0.7, pull: 80, trail: 'glow', color: '#7a4dff', size: 8, glow: true, good: ['bunker'], level: 27, price: 4050, sound: 'plasma', desc: 'Phases through ground and pulls tanks together.' },
    { id: 'tornado', name: 'Tornado', icon: '🌪', cat: 'energy', type: 'ballistic', dmg: 40, r: 70, ammo: 1, knock: 4.5, trail: 'glow', color: '#cfe8ff', size: 8, glow: true, good: ['groups'], level: 28, price: 4150, desc: 'Gigantic knockback that hurls tanks away.' },
    { id: 'emp_rocket', name: 'EMP Rocket', icon: '📡', cat: 'rocket', type: 'homing', dmg: 50, r: 60, ammo: 1, homing: 2.0, emp: 2, trail: 'spark', color: '#7af', size: 6, sprite: 'rocket', good: ['far'], level: 29, price: 4300, sound: 'zap', desc: 'Homing rocket that knocks out shields and abilities.' },
    { id: 'plague', name: 'Plague Cloud', icon: '🦠', cat: 'elemental', type: 'cluster', dmg: 30, r: 30, ammo: 1, sub: { n: 6, dmg: 16, r: 24, spd: 220 }, poison: { dmg: 32, turns: 3, r: 120 }, trail: 'toxic', color: '#7dff4a', size: 8, good: ['groups'], level: 30, price: 4450, sound: 'poison', desc: 'Huge, lasting poison cloud.' },
    { id: 'claymore', name: 'Claymores', icon: '✴', cat: 'explosive', type: 'mines', dmg: 95, r: 50, ammo: 1, count: 5, spread: 10, trail: 'dot', color: '#ff7a4d', size: 5, good: ['groups', 'big'], level: 31, price: 4600, desc: 'Lays five powerful mines.' },
    { id: 'storm_lance', name: 'Storm Lance', icon: '🔱', cat: 'energy', type: 'laser', dmg: 85, r: 14, ammo: 1, range: 1800, chain: { n: 3, dmg: 40, range: 400 }, color: '#fff27a', good: ['groups', 'far'], level: 32, price: 4800, sound: 'zap', desc: 'Lightning beam that also chains to nearby tanks.' },
    { id: 'aftershock', name: 'Aftershock', icon: '🌊', cat: 'special', type: 'ballistic', dmg: 80, r: 44, ammo: 1, quake: { dmg: 110, range: 500 }, trail: 'smoke', color: '#c9a06a', size: 9, good: ['groups', 'bunker'], level: 33, price: 5100, desc: 'A massive quake that hits grounded tanks 500 units away.' },
    { id: 'deep_strike', name: 'Deep Strike', icon: '⏬', cat: 'explosive', type: 'drill', dmg: 175, r: 66, ammo: 1, drill: 200, trail: 'smoke', color: '#9a9ab0', size: 10, sprite: 'drill', good: ['under', 'bunker', 'big'], level: 35, price: 5400, sound: 'heavyfire', desc: 'Drills deep, then detonates with huge force.' },
    { id: 'hydra_mirv', name: 'Hydra MIRV', icon: '🐉', cat: 'rocket', type: 'split', dmg: 40, r: 32, ammo: 1, sub: { n: 8, dmg: 48, r: 36, spread: 0.45 }, speed: 1.05, trail: 'fire', color: '#ff3d1a', size: 8, sprite: 'rocket', good: ['groups'], level: 37, price: 6500, sound: 'rocket', desc: 'Releases eight warheads at the apex.' },
    { id: 'armageddon', name: 'Armageddon', icon: '🔥', cat: 'special', type: 'marker', dmg: 10, r: 14, ammo: 1, marker: { kind: 'meteor', n: 6, dmg: 110, r: 64, spread: 320 }, trail: 'spark', color: '#ff3d1a', size: 6, good: ['groups', 'big'], level: 42, price: 10000, desc: 'Six giant meteors rain down from the sky.' },
    { id: 'antimatter', name: 'Antimatter', icon: '⚛', cat: 'energy', type: 'ballistic', dmg: 230, r: 110, ammo: 1, speed: 0.95, grav: 0.6, pull: 120, trail: 'glow', color: '#ff66ff', size: 11, glow: true, good: ['big', 'groups'], level: 45, price: 12000, sound: 'plasma', desc: 'Annihilates everything and pulls in what survives.' },
    { id: 'grejs_bomb', name: 'Grejs Bomb', icon: '👑', cat: 'explosive', type: 'cluster', dmg: 200, r: 120, ammo: 1, sub: { n: 10, dmg: 50, r: 40, spd: 340 }, burn: { dmg: 30, turns: 3, r: 160 }, speed: 0.95, trail: 'fire', color: '#ffd23f', size: 12, sprite: 'nuke', good: ['big', 'groups'], level: 50, price: 15000, sound: 'heavyfire', desc: 'The legendary weapon of Grejs World. Burns the whole map.' }
  ];
  W.sort((a, b) => a.level - b.level);

  // Ability-only weapons (used by special abilities, not purchasable)
  const ABILITY_WEAPONS = [
    { id: 'ab_airstrike', name: 'Air Strike', icon: '✈', cat: 'special', type: 'marker', dmg: 10, r: 14, ammo: -1, marker: { kind: 'bombs', n: 6, dmg: 52, r: 38, spread: 170 }, trail: 'spark', color: '#ff4040', size: 5, hidden: true },
    { id: 'ab_laser', name: 'Laser Beam', icon: '═', cat: 'energy', type: 'laser', dmg: 130, r: 16, ammo: -1, range: 2600, color: '#ff2bd6', width: 16, hidden: true },
    { id: 'ab_cluster', name: 'Mega Cluster', icon: '✺', cat: 'explosive', type: 'cluster', dmg: 60, r: 40, ammo: -1, sub: { n: 10, dmg: 30, r: 28, spd: 300 }, trail: 'smoke', color: '#ffcf4a', size: 9, sprite: 'bomb', hidden: true },
    { id: 'ab_mines', name: 'Mine Field', icon: '✹', cat: 'explosive', type: 'mines', dmg: 80, r: 46, ammo: -1, count: 4, spread: 9, trail: 'dot', color: '#ff4d4d', size: 5, hidden: true },
    { id: 'ab_meteor', name: 'Meteor Strike', icon: '☄', cat: 'special', type: 'marker', dmg: 10, r: 14, ammo: -1, marker: { kind: 'meteor', n: 3, dmg: 95, r: 58, spread: 120 }, trail: 'spark', color: '#ff9a3d', size: 5, hidden: true },
    { id: 'ab_bomb', name: 'Drone Bomb', icon: '•', cat: 'explosive', type: 'ballistic', dmg: 40, r: 32, ammo: -1, trail: 'dot', color: '#ffcf4a', size: 5, sprite: 'bomb', hidden: true },
    { id: 'ab_missile', name: 'Barrage Missile', icon: '🚀', cat: 'rocket', type: 'homing', dmg: 36, r: 30, ammo: -1, homing: 3.2, grav: 0.4, trail: 'smoke', color: '#ff6a3d', size: 5, sprite: 'rocket', hidden: true },
    { id: 'ab_fire', name: 'Firestorm', icon: '🔥', cat: 'elemental', type: 'ballistic', dmg: 26, r: 26, ammo: -1, burn: { dmg: 18, turns: 2, r: 50 }, trail: 'fire', color: '#ff7a1a', size: 6, hidden: true },
    { id: 'ab_meteor_small', name: 'Meteor', icon: '☄', cat: 'special', type: 'ballistic', dmg: 60, r: 44, ammo: -1, trail: 'fire', color: '#ff9a3d', size: 10, sprite: 'meteor', hidden: true },
    { id: 'ab_toxic', name: 'Toxic Rain', icon: '☣', cat: 'elemental', type: 'ballistic', dmg: 18, r: 24, ammo: -1, poison: { dmg: 16, turns: 2, r: 45 }, trail: 'toxic', color: '#7dff4a', size: 5, hidden: true }
  ];

  const all = W.concat(ABILITY_WEAPONS);
  const byId = {};
  for (const w of all) {
    // defaults
    w.speed = w.speed || 1;
    w.grav = w.grav == null ? 1 : w.grav;
    w.wind = w.wind == null ? 1 : w.wind;
    w.count = w.count || 1;
    w.spread = w.spread || 0;
    w.seq = w.seq || 0;
    w.knock = w.knock || 1;
    w.good = w.good || [];
    byId[w.id] = w;
  }

  const CAT_NAMES = { shell: 'Shells', rocket: 'Rockets', explosive: 'Explosives', energy: 'Energy', elemental: 'Elemental', special: 'Special' };
  const GOOD_NAMES = { big: 'Big tanks', groups: 'Groups', bunker: 'Bunkered', far: 'Long range', under: 'Underground' };

  GT.Weapons = {
    list: W,
    all,
    byId,
    CAT_NAMES,
    GOOD_NAMES,
    get(id) {
      return byId[id] || byId.shell;
    },
    /** damage multiplier from weapon level (1..5) */
    levelMult(lvl) {
      return 1 + 0.08 * ((lvl || 1) - 1);
    },
    /** extra ammo from weapon level */
    levelAmmo(w, lvl) {
      if (w.ammo < 0) return -1;
      return w.ammo + (lvl >= 3 ? 1 : 0) + (lvl >= 5 ? 1 : 0);
    },
    upgradeCost(w, lvl) {
      return Math.round((250 + (w.price || 300) * 0.35) * Math.pow(1.6, lvl - 1) / 10) * 10;
    },
    MAX_LEVEL: 5
  };
})();

