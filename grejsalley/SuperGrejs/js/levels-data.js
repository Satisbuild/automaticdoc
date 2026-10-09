'use strict';
/* =====================================================================
   SUPER GREJS - levels-data.js
   Alle 32 baner (8 verdener x 4). Hver bane er håndbygget med
   kommandoerne fra levels.js. y måles i tiles fra bunden; jorden er
   normalt y=0-1, så "y=2" er det første frie felt over jorden.
   Bane 4 i hver verden er en fæstning med boss.
   ===================================================================== */
(function () {
  const { define, world } = SG.levels;
  const T = SG.physics.T;

  /* ---------------- Verdener ---------------- */
  world(1, { name: 'Grønne Grejsmarker', theme: 'grass', tagline: 'Løb, hop og lær de første fjender at kende' });
  world(2, { name: 'Møntminen', theme: 'mine', tagline: 'Minevogne, løse sten og hemmelige lommer' });
  world(3, { name: 'Skyhøj', theme: 'sky', tagline: 'Skyer, vind og lange hop' });
  world(4, { name: 'Lava-laboratoriet', theme: 'lava', tagline: 'Varme gulve, stempler og perfekt timing' });
  world(5, { name: 'Frostfjeldet', theme: 'frost', tagline: 'Glat is, sne og faldende istapper' });
  world(6, { name: 'Mørkeskoven', theme: 'forest', tagline: 'Begrænset udsyn, tornranker og skjulte stier' });
  world(7, { name: 'Mekanikkens by', theme: 'mech', tagline: 'Transportbånd, stempler og tandhjul' });
  world(8, { name: 'Kaosfæstningen', theme: 'chaos', tagline: 'Alt på én gang - og Kaos-Kejseren venter' });

  /* ---------------- Fælles byggeklodser ---------------- */
  // Hemmeligt bonusrum med mønter og et udgangsrør tilbage til hovedbanen.
  function bonusRoom(L, name, exit, fill) {
    const r = L.room(name, 46, 18, { theme: 'bonus', camLock: false, music: 'title' });
    r.ground(0, 45, 2);
    r.fill(0, 2, 1, 17, T.HARD);
    r.fill(44, 2, 45, 17, T.HARD);
    r.fill(2, 16, 43, 17, T.BRICK);
    r.startAt(4, 2);
    if (fill) fill(r);
    else {
      r.coins(8, 3, 9); r.coins(8, 5, 9); r.coins(8, 7, 9);
      r.put(8, 10, 'BBBBBBBBB');
      r.coins(22, 4, 8); r.coins(22, 6, 8);
      r.put(22, 9, 'BBMBBBBB');
    }
    r.pipe(38, 2, 3, { to: { room: exit.room || 'main', x: exit.x, y: exit.y, pipe: true } });
    return r;
  }

  // Plateau af jord fra bunden op til (men ikke med) top
  function mesa(r, x0, x1, top, code) { r.fill(x0, 0, x1, top - 1, code || T.GROUND); }
  // Tunnel-loft fra y og op til toppen
  function roof(r, x0, x1, y, code) { r.fill(x0, y, x1, r.h - 1, code || T.GROUND); }
  // Lavagrav: jorden erstattes af lava
  function lavaPit(r, x0, x1, code) { r.fill(x0, 0, x1, 1, code || T.LAVA); }
  // Minevogn over et piggegulv, der stopper ved en lav væg
  function cartRide(r, cartX, spikeX0, spikeX1, wallX) {
    r.fill(spikeX0, 1, spikeX1, 1, T.SPIKE);
    r.fill(wallX, 2, wallX, 3, T.HARD);
    r.plat('cart', cartX, 2, { range: wallX - cartX + 2 });
  }

  // Bossarena i slutningen af en fæstning: flad gulvflade og lukket loft.
  function arena(r, x0, x1, boss, opts) {
    opts = opts || {};
    r.ground(x0 - 2, x1 + 2, 2);
    r.clear(x0, 2, x1, r.h - 3);
    r.fill(x0 - 2, r.h - 2, x1 + 2, r.h - 1, T.HARD);
    r.fill(x1 + 1, 2, x1 + 2, r.h - 3, T.HARD);
    if (opts.lava) { r.fill(x0 + 6, 0, x0 + 7, 1, T.LAVA); r.fill(x1 - 7, 0, x1 - 6, 1, T.LAVA); }
    if (opts.ledges) opts.ledges.forEach(([x, y, w]) => r.fill(x, y, x + w - 1, y, T.SEMI));
    if (opts.ice) r.fill(x0, 1, x1, 1, T.ICE);
    r.decorate('torch', x0 + 1, 2); r.decorate('torch', x1 - 2, 2);
    r.bossArena(x0, x1, boss);
  }

  /* =================================================================
     VERDEN 1 - GRØNNE GREJSMARKER
     ================================================================= */
  define('1-1', { name: 'Første skridt', theme: 'grass', time: 300 }, L => {
    const m = L.room('main', 200, 18);
    m.ground(0, 199, 2);
    m.startAt(3, 2);
    m.decorate('sign', 6, 2); m.decorate('bush', 9, 2); m.decorate('flowers', 15, 2);
    // Første blokke - lær at hoppe og slå
    m.put(12, 5, '?');
    m.put(16, 5, 'B?BPB');
    m.put(18, 9, '?');
    m.enemy('skramler', 24, 2);
    m.decorate('fence', 26, 2);
    // Rør i stigende højde
    m.pipe(28, 2, 2);
    m.pipe(37, 2, 3);
    m.enemy('skramler', 42, 2);
    m.pipe(46, 2, 4, { to: { room: 'bonus1', x: 4, y: 2 } });
    m.enemy('skramler', 51, 2); m.enemy('skramler', 53, 2);
    m.decorate('bush', 55, 2);
    // Første hul
    m.gap(60, 61);
    m.arc(59, 4, 4, 2);
    m.put(63, 5, '1');
    m.put(66, 5, 'B?B');
    m.put(69, 9, 'BBBBBBBB');
    m.enemy('skramler', 71, 10); m.enemy('skramler', 73, 10);
    m.gap(76, 78);
    m.put(80, 9, 'BBB?');
    m.put(83, 5, 'M');
    m.enemy('skramler', 85, 2); m.enemy('skramler', 87, 2);
    m.put(89, 5, 'BS');
    m.enemy('bille', 93, 2);
    m.put(96, 5, '?  ?  ?');
    m.put(99, 9, 'P');
    m.checkpoint(102, 2);
    m.decorate('tree', 104, 2);
    m.enemy('skramler', 107, 2); m.enemy('skramler', 109, 2);
    m.put(112, 5, 'B');
    m.put(113, 9, 'BBB');
    m.put(118, 9, 'B??B');
    m.put(119, 5, 'BB');
    // Trapper og huller
    m.stairs(124, 2, 4, 1);
    m.stairs(130, 2, 4, -1);
    m.stairs(138, 2, 4, 1);
    m.fill(142, 2, 142, 5, T.HARD);
    m.gap(143, 144);
    m.stairs(145, 2, 4, -1);
    m.decorate('bush', 150, 2);
    m.pipe(152, 2, 2);
    m.put(157, 5, 'BB?B');
    m.enemy('skramler', 161, 2); m.enemy('skramler', 163, 2);
    m.pipe(166, 2, 2);
    // Stor trappe op til målet
    m.stairs(170, 2, 8, 1);
    m.fill(178, 2, 178, 9, T.HARD);
    m.goalAt(184, 2);
    m.decorate('fence', 192, 2);
    bonusRoom(L, 'bonus1', { x: 152, y: 3 });
  });

  define('1-2', { name: 'Skjoldbillernes eng', theme: 'grass', time: 300 }, L => {
    const m = L.room('main', 210, 18);
    m.ground(0, 209, 2);
    m.startAt(3, 2);
    m.decorate('bush', 7, 2);
    m.put(10, 5, '?B?');
    m.enemy('bille', 16, 2);
    m.enemy('skramler', 20, 2);
    m.put(22, 5, 'BPB');
    m.put(23, 9, 'h');
    m.pipe(28, 2, 3);
    m.enemy('skramler', 33, 2);
    // Hemmelig vej: hold HOP på fjederen for at nå op på murstenstaget
    m.decorate('sign', 36, 2);
    m.spring(39, 2);
    m.set(39, 7, T.COIN); m.set(39, 10, T.COIN); m.set(40, 13, T.COIN);
    m.fill(42, 12, 149, 12, T.BRICK);
    m.clear(88, 12, 90, 12);
    // Øverste rute
    m.coins(44, 13, 8);
    m.enemy('skramler', 54, 13);
    m.coins(60, 14, 6);
    m.put(68, 16, '?');
    m.enemy('skramler', 76, 13);
    m.enemy('bille', 100, 13);
    m.coins(108, 13, 12);
    m.decorate('sign', 136, 13);
    m.pipe(140, 13, 2, { warp: 2 });
    m.coins(144, 13, 4);
    // Nederste rute
    m.put(46, 5, 'B?B?B');
    m.enemy('skramler', 50, 2); m.enemy('skramler', 52, 2);
    m.pipe(58, 2, 2);
    m.pipe(66, 2, 3, { biter: true });
    m.enemy('bille', 72, 2);
    m.put(76, 5, 'BBMBB');
    m.pipe(84, 2, 3, { to: { room: 'bonus2', x: 4, y: 2 } });
    m.enemy('skramler', 94, 2); m.enemy('skramler', 96, 2); m.enemy('skramler', 98, 2);
    m.checkpoint(104, 2);
    m.put(108, 5, '?');
    m.put(112, 5, '1');
    m.gap(116, 118);
    m.arc(115, 4, 5, 2);
    m.put(122, 5, 'BpB');
    m.pipe(128, 2, 2, { biter: true });
    m.enemy('skramler', 134, 2);
    m.pipe(150, 2, 2);
    m.stairs(156, 2, 5, 1);
    m.gap(161, 163);
    m.stairs(164, 2, 5, -1);
    m.enemy('bille', 172, 2);
    m.put(176, 5, 'B?B');
    m.stairs(182, 2, 6, 1);
    m.fill(188, 2, 188, 7, T.HARD);
    m.goalAt(194, 2);
    m.decorate('tree', 201, 2);
    bonusRoom(L, 'bonus2', { x: 150, y: 3 });
  });

  define('1-3', { name: 'Trætoppene', theme: 'grass', time: 300 }, L => {
    const m = L.room('main', 190, 18);
    m.ground(0, 14, 2);
    m.startAt(2, 2);
    m.decorate('bush', 5, 2); m.decorate('sign', 11, 2);
    mesa(m, 18, 22, 4);
    m.put(19, 8, '?P?');
    mesa(m, 26, 29, 6);
    m.enemy('drone', 27, 10, { mode: 'v', range: 1.5 });
    m.plat('h', 31, 5, { range: 6, w: 3, speed: 45 });
    mesa(m, 41, 46, 5);
    m.enemy('skramler', 44, 5);
    mesa(m, 50, 53, 8);
    m.coins(50, 9, 4);
    mesa(m, 56, 61, 5);
    m.pipe(58, 5, 2, { biter: true });
    m.plat('v', 63, 4, { range: 6, w: 3, speed: 38 });
    mesa(m, 67, 73, 10);
    m.coins(68, 11, 5);
    mesa(m, 76, 87, 3);
    m.put(78, 7, '?P');
    m.checkpoint(80, 3);
    m.enemy('skramler', 84, 3); m.enemy('skramler', 86, 3);
    // Faldende platforme
    m.plat('fall', 89, 5);
    m.plat('fall', 94, 6);
    m.plat('fall', 99, 5);
    m.coins(94, 8, 3);
    mesa(m, 104, 110, 5);
    m.enemy('bille', 107, 5);
    m.enemy('drone', 111, 10, { mode: 'h', range: 2 });
    mesa(m, 114, 116, 7);
    m.put(115, 11, 'h');
    m.enemy('drone', 118, 11, { mode: 'v', range: 2, phase: 1 });
    mesa(m, 121, 125, 4);
    m.plat('h', 127, 4, { range: 6, w: 3, speed: 55 });
    mesa(m, 138, 158, 2);
    m.pipe(141, 2, 3, { biter: true });
    m.enemy('skramler', 145, 2);
    m.pipe(147, 2, 2, { biter: 1 });
    m.stairs(154, 2, 5, 1);
    mesa(m, 162, 189, 2);
    m.arc(158, 7, 5, 2);
    m.goalAt(174, 2);
    m.decorate('tree', 182, 2);
  });

  define('1-4', { name: 'Brumles borg', theme: 'grass', fort: true, time: 300 }, L => {
    const m = L.room('main', 150, 18);
    m.ground(0, 149, 2);
    m.fill(0, 15, 107, 17, T.HARD);
    m.startAt(2, 2);
    m.decorate('torch', 5, 2);
    m.stairs(10, 2, 3, 1);
    m.fill(13, 4, 20, 4, T.HARD);
    lavaPit(m, 14, 19);
    m.enemy('gloeder', 16, 1, { h: 1.5 });
    m.fireBar(24, 6, 5, 1.6);
    // Lav gang med pigge
    m.fill(28, 10, 45, 14, T.HARD);
    m.fill(33, 2, 34, 2, T.SPIKE);
    m.fireBar(39, 2, 4, -1.8);
    m.enemy('skramler', 43, 2);
    lavaPit(m, 48, 53);
    m.fill(50, 2, 51, 3, T.HARD);
    m.enemy('gloeder', 49, 1, { h: 5, phase: 0.6 });
    m.enemy('gloeder', 52, 1, { h: 5, phase: 1.4 });
    m.put(57, 6, '?P?');
    lavaPit(m, 66, 76);
    m.plat('h', 67, 3, { range: 6, w: 3, speed: 45 });
    m.enemy('skramler', 80, 2); m.enemy('skramler', 84, 2);
    m.enemy('bille', 88, 2);
    m.fireBar(92, 5, 5, 1.8);
    m.fireBar(98, 9, 6, -1.5);
    m.checkpoint(103, 2);
    m.put(104, 6, 'P');
    arena(m, 110, 141, 'bulder');
  });

  /* =================================================================
     VERDEN 2 - MØNTMINEN
     ================================================================= */
  define('2-1', { name: 'Glimmergangen', theme: 'mine', time: 300 }, L => {
    const m = L.room('main', 200, 18);
    m.ground(0, 199, 2);
    roof(m, 0, 199, 16);
    m.startAt(3, 2);
    m.decorate('lantern', 6, 14); m.decorate('crystal', 9, 2);
    m.put(10, 5, '?M?');
    m.enemy('skramler', 16, 2);
    m.enemy('istap', 22, 15, { rock: true }); m.enemy('istap', 25, 15, { rock: true });
    // Hemmelig lomme bag en falsk væg
    m.fill(30, 2, 36, 5, T.GROUND);
    m.clear(31, 2, 35, 3);
    m.fill(36, 2, 36, 3, T.FAKE);
    m.coins(31, 2, 5); m.coins(32, 3, 4);
    m.put(31, 3, 'P');
    m.decorate('lantern', 40, 14);
    m.put(42, 5, '?BBP');
    m.enemy('hopper', 46, 2);
    // Minevogn over pigge
    m.decorate('sign', 50, 2);
    cartRide(m, 53, 58, 89, 91);
    m.enemy('istap', 66, 15, { rock: true }); m.enemy('istap', 73, 15, { rock: true }); m.enemy('istap', 81, 15, { rock: true });
    m.coins(64, 6, 4); m.coins(76, 7, 4);
    m.checkpoint(96, 2);
    m.pipe(103, 2, 3, { to: { room: 'bonus', x: 4, y: 2 } });
    m.enemy('skramler', 108, 2); m.enemy('skramler', 110, 2);
    // Kløft med stilladser
    m.clear(118, 0, 146, 1);
    m.fill(120, 4, 123, 4, T.SEMI);
    m.fill(127, 6, 129, 6, T.SEMI);
    m.plat('v', 132, 3, { range: 5, w: 2, speed: 40 });
    m.fill(137, 7, 140, 7, T.SEMI);
    m.plat('fall', 142, 5);
    m.coins(127, 8, 3);
    m.enemy('istap', 138, 15, { rock: true });
    m.enemy('bille', 155, 2);
    m.put(158, 5, 'B?B');
    m.enemy('hopper', 165, 2);
    // Lomme med hul i toppen
    m.fill(170, 2, 176, 5, T.GROUND);
    m.clear(171, 2, 175, 4);
    m.fill(172, 5, 173, 5, T.FAKE);
    m.fill(176, 2, 176, 3, T.FAKE);
    m.coins(171, 2, 5);
    m.put(171, 4, 'l');
    m.pipe(181, 2, 2);
    m.goalAt(186, 2);
    m.decorate('lantern', 184, 14);
    bonusRoom(L, 'bonus', { x: 181, y: 3 });
  });

  define('2-2', { name: 'Vognbanen', theme: 'mine', time: 300 }, L => {
    const m = L.room('main', 210, 18);
    m.ground(0, 209, 2);
    roof(m, 0, 209, 16);
    m.startAt(3, 2);
    m.decorate('lantern', 5, 14);
    m.put(9, 5, '?P?');
    m.enemy('hopper', 13, 2);
    cartRide(m, 18, 22, 60, 63);
    [30, 38, 46, 54].forEach(x => m.enemy('istap', x, 15, { rock: true }));
    m.coins(34, 7, 3); m.coins(50, 7, 3);
    m.enemy('skramler', 68, 2); m.enemy('skramler', 70, 2);
    m.enemy('bille', 74, 2);
    // Elevator op på et plateau
    m.plat('v', 82, 2, { range: 8, w: 3, speed: 42 });
    mesa(m, 87, 110, 10);
    m.checkpoint(90, 10);
    m.enemy('hopper', 96, 10);
    m.enemy('istap', 100, 15, { rock: true });
    m.put(102, 13, '?');
    m.enemy('skramler', 106, 10);
    // Lavasø med faldende platforme
    lavaPit(m, 111, 140);
    m.plat('fall', 113, 7);
    m.plat('fall', 118, 6);
    m.plat('fall', 123, 5);
    m.plat('h', 127, 4, { range: 5, w: 3, speed: 55 });
    m.plat('fall', 136, 5);
    m.enemy('gloeder', 121, 1, { h: 3, phase: 0.5 });
    m.enemy('gloeder', 133, 1, { h: 3, phase: 1.2 });
    m.coins(118, 9, 3);
    cartRide(m, 144, 149, 176, 178);
    m.enemy('drone', 158, 7, { mode: 'h', range: 3 });
    m.enemy('drone', 170, 8, { mode: 'v', range: 2 });
    m.pipe(184, 2, 2, { biter: true });
    m.put(188, 5, 'B?B');
    m.goalAt(195, 2);
  });

  define('2-3', { name: 'Den dybe skakt', theme: 'mine', time: 300 }, L => {
    const m = L.room('main', 110, 36);
    m.ground(0, 109, 2);
    m.fill(0, 12, 30, 35, T.GROUND);
    m.startAt(3, 2);
    m.decorate('lantern', 8, 10);
    m.enemy('skramler', 12, 2);
    m.put(16, 5, '?P');
    m.enemy('hopper', 22, 2);
    m.decorate('lantern', 26, 10);
    // Skakten
    mesa(m, 49, 109, 22);
    m.fill(30, 33, 48, 35, T.GROUND);
    m.fill(32, 5, 35, 5, T.SEMI);
    m.fill(39, 8, 42, 8, T.SEMI);
    m.fill(44, 11, 47, 11, T.SEMI);
    m.fill(36, 14, 39, 14, T.SEMI);
    m.fill(31, 17, 34, 17, T.SEMI);
    m.plat('v', 39, 17, { range: 4, w: 3, speed: 36 });
    m.fill(45, 21, 48, 21, T.SEMI);
    m.enemy('drone', 38, 12, { mode: 'h', range: 2 });
    m.enemy('istap', 40, 32, { rock: true });
    m.coins(32, 7, 4); m.coins(44, 13, 4); m.coins(31, 19, 4);
    m.put(33, 21, '1');
    // Plateauet på toppen
    m.checkpoint(52, 22);
    m.enemy('bille', 56, 22);
    m.put(58, 26, '?B?');
    m.enemy('skramler', 62, 22); m.enemy('skramler', 64, 22);
    m.clear(70, 18, 73, 21);
    m.fill(70, 18, 73, 18, T.SPIKE);
    m.pipe(78, 22, 2, { biter: true });
    m.enemy('hopper', 84, 22);
    m.goalAt(94, 22);
    m.decorate('crystal', 104, 22);
  });

  define('2-4', { name: 'Gravefæstningen', theme: 'mine', fort: true, time: 300 }, L => {
    const m = L.room('main', 160, 18);
    m.ground(0, 159, 2);
    m.fill(0, 15, 121, 17, T.HARD);
    m.startAt(2, 2);
    m.decorate('torch', 4, 2);
    // Smuldrebro over lava
    m.fill(10, 0, 20, 0, T.LAVA);
    m.fill(10, 1, 20, 1, T.CRUMBLE);
    m.fireBar(26, 5, 5, 2);
    // Lav gang med faldende sten
    m.fill(30, 10, 44, 14, T.HARD);
    [33, 37, 41].forEach(x => m.enemy('istap', x, 9, { rock: true }));
    m.enemy('skramler', 42, 2);
    lavaPit(m, 48, 59);
    m.fill(50, 2, 51, 3, T.HARD);
    m.fill(55, 2, 56, 4, T.HARD);
    m.enemy('gloeder', 49, 1, { h: 6 });
    m.enemy('gloeder', 54, 1, { h: 7, phase: 0.8 });
    m.enemy('gloeder', 57, 1, { h: 6, phase: 1.5 });
    m.put(65, 6, '?P?');
    cartRide(m, 74, 78, 92, 95);
    m.fireBar(86, 7, 4, 1.6);
    m.enemy('bille', 98, 2);
    m.enemy('skramler', 102, 2);
    m.fill(106, 0, 116, 0, T.LAVA);
    m.fill(106, 1, 116, 1, T.CRUMBLE);
    m.checkpoint(118, 2);
    m.put(119, 6, 'P');
    arena(m, 124, 155, 'graver');
  });

  /* =================================================================
     VERDEN 3 - SKYHØJ
     ================================================================= */
  define('3-1', { name: 'Skybroen', theme: 'sky', time: 300 }, L => {
    const m = L.room('main', 200, 18);
    mesa(m, 0, 12, 4);
    m.startAt(2, 4);
    m.decorate('sign', 9, 4);
    m.fill(15, 6, 18, 6, T.SEMI);
    m.fill(21, 8, 24, 8, T.SEMI);
    m.coins(21, 9, 4);
    m.enemy('drone', 22, 12, { mode: 'h', range: 1.5 });
    mesa(m, 27, 34, 5);
    m.put(29, 9, '?P?');
    m.enemy('skramler', 32, 5);
    mesa(m, 36, 39, 3);
    m.spring(39, 3);
    m.fill(40, 12, 47, 12, T.SEMI);
    m.coins(40, 13, 8);
    m.put(44, 16, 'l');
    m.fill(41, 5, 43, 5, T.SEMI);
    m.fill(46, 6, 48, 6, T.SEMI);
    mesa(m, 51, 60, 6);
    m.enemy('bille', 56, 6);
    // Medvind over et langt hul
    m.windZone(61, 74, 45);
    m.fill(66, 6, 68, 6, T.SEMI);
    m.arc(62, 8, 12, 3);
    mesa(m, 75, 84, 5);
    m.checkpoint(78, 5);
    m.plat('h', 86, 5, { range: 5, w: 3, speed: 50 });
    mesa(m, 95, 100, 7);
    m.enemy('drone', 102, 12, { mode: 'v', range: 2 });
    m.fill(103, 8, 105, 8, T.SEMI);
    m.fill(109, 9, 111, 9, T.SEMI);
    m.enemy('drone', 108, 13, { mode: 'h', range: 2, phase: 1 });
    m.fill(115, 7, 117, 7, T.SEMI);
    mesa(m, 120, 132, 4);
    m.pipe(125, 4, 2, { biter: true });
    m.enemy('hopper', 130, 4);
    // Modvind
    m.windZone(133, 150, -35);
    m.fill(136, 5, 139, 5, T.SEMI);
    m.fill(143, 6, 146, 6, T.SEMI);
    mesa(m, 151, 199, 3);
    m.enemy('skramler', 158, 3); m.enemy('skramler', 160, 3);
    m.put(163, 7, 'B?B?B');
    m.enemy('bille', 170, 3);
    m.goalAt(182, 3);
  });

  define('3-2', { name: 'Vindens vej', theme: 'sky', time: 300 }, L => {
    const m = L.room('main', 210, 18);
    mesa(m, 0, 10, 3);
    m.startAt(2, 3);
    m.windZone(12, 40, 55);
    m.fill(14, 5, 16, 5, T.SEMI);
    m.fill(20, 7, 22, 7, T.SEMI);
    m.fill(27, 6, 29, 6, T.SEMI);
    m.fill(34, 8, 36, 8, T.SEMI);
    m.coins(20, 9, 3); m.coins(34, 10, 3);
    mesa(m, 40, 50, 5);
    m.enemy('skramler', 45, 5); m.enemy('skramler', 47, 5);
    m.put(43, 9, '?P?');
    // Elevator til den hemmelige skyrute med warp-rør
    m.plat('v', 52, 4, { range: 6, w: 3, speed: 36 });
    m.fill(56, 11, 72, 11, T.SEMI);
    m.coins(57, 12, 8);
    m.decorate('sign', 63, 12);
    m.pipe(66, 12, 2, { warp: 4 });
    // Den normale rute
    m.plat('h', 57, 4, { range: 7, w: 3, speed: 50 });
    mesa(m, 69, 78, 4);
    m.checkpoint(72, 4);
    // Kraftig modvind - løb!
    m.windZone(79, 107, -50);
    mesa(m, 80, 83, 5);
    mesa(m, 88, 90, 6);
    m.enemy('drone', 92, 10, { mode: 'v', range: 2 });
    mesa(m, 95, 97, 5);
    m.enemy('drone', 99, 11, { mode: 'v', range: 2, phase: 1.5 });
    mesa(m, 102, 105, 6);
    mesa(m, 108, 118, 4);
    m.put(110, 8, '?P?');
    m.enemy('hopper', 114, 4);
    m.plat('fall', 121, 5);
    m.plat('fall', 126, 6);
    m.plat('fall', 131, 5);
    mesa(m, 135, 145, 4);
    m.enemy('bille', 140, 4);
    // Stærk medvind
    m.windZone(147, 170, 70);
    m.fill(150, 5, 151, 5, T.SEMI);
    m.fill(158, 6, 159, 6, T.SEMI);
    m.fill(166, 5, 167, 5, T.SEMI);
    m.arc(152, 8, 14, 3);
    mesa(m, 171, 209, 3);
    m.pipe(176, 3, 2, { biter: true });
    m.enemy('skramler', 182, 3);
    m.goalAt(192, 3);
  });

  define('3-3', { name: 'Stormtårnet', theme: 'sky', time: 300 }, L => {
    const m = L.room('main', 46, 48, { camLock: false });
    m.ground(0, 45, 2);
    m.fill(0, 0, 1, 47, T.HARD);
    m.fill(44, 0, 45, 47, T.HARD);
    m.startAt(4, 2);
    m.decorate('sign', 7, 2);
    m.enemy('skramler', 20, 2);
    m.fill(12, 6, 17, 6, T.SEMI);
    m.fill(21, 9, 26, 9, T.SEMI);
    m.fill(30, 12, 35, 12, T.SEMI);
    m.fill(37, 15, 42, 15, T.SEMI);
    m.enemy('drone', 28, 16, { mode: 'h', range: 3 });
    m.plat('h', 25, 18, { range: 8, w: 3, speed: 45 });
    m.fill(14, 18, 20, 18, T.SEMI);
    m.fill(4, 21, 10, 21, T.SEMI);
    m.spring(7, 22);
    m.coins(7, 24, 1); m.coins(7, 26, 1);
    // Mellemgulv med mini-boss
    m.fill(2, 25, 43, 25, T.SEMI);
    m.spawn('miniboss', 32, 26, { id: 'panserbille', drop: 'flower' });
    m.checkpoint(5, 26);
    m.put(18, 29, '?P?');
    m.fill(32, 29, 37, 29, T.SEMI);
    m.fill(24, 32, 28, 32, T.SEMI);
    m.enemy('drone', 14, 33, { mode: 'v', range: 2 });
    m.fill(30, 35, 43, 35, T.GROUND);
    m.coins(24, 34, 5);
    m.goalAt(34, 36);
  });

  define('3-4', { name: 'Skyfæstningen', theme: 'sky', fort: true, time: 300 }, L => {
    const m = L.room('main', 160, 18);
    m.ground(0, 159, 2);
    m.fill(0, 15, 121, 17, T.HARD);
    m.startAt(2, 2);
    m.decorate('torch', 5, 2);
    m.gap(14, 17);
    m.cannon(22, 2, { period: 3 });
    m.fill(30, 2, 30, 3, T.HARD);
    m.cannon(30, 4, { period: 3.4, phase: 1 });
    m.fireBar(38, 6, 5, 1.7);
    m.gap(44, 49);
    m.plat('fall', 46, 3);
    m.enemy('drone', 54, 8, { mode: 'h', range: 2 });
    m.enemy('drone', 60, 5, { mode: 'v', range: 1.5 });
    m.put(64, 6, '?P?');
    m.cannon(72, 2, { period: 2.8 });
    m.fill(80, 2, 80, 4, T.HARD);
    m.cannon(80, 5, { period: 3.2, phase: 0.7 });
    m.gap(86, 89);
    m.fireBar(92, 7, 6, -1.6);
    m.enemy('bille', 100, 2);
    m.enemy('skramler', 106, 2);
    m.checkpoint(114, 2);
    m.put(115, 6, 'P');
    arena(m, 124, 155, 'vindolf', { ledges: [[128, 6, 4], [148, 6, 4], [137, 9, 6]] });
  });

  /* =================================================================
     VERDEN 4 - LAVA-LABORATORIET
     ================================================================= */
  define('4-1', { name: 'Varme rør', theme: 'lava', time: 300 }, L => {
    const m = L.room('main', 200, 18);
    m.ground(0, 199, 2);
    m.startAt(2, 2);
    m.put(8, 5, '?P?');
    m.enemy('skramler', 14, 2);
    lavaPit(m, 18, 21);
    m.enemy('gloeder', 19, 1, { h: 4 });
    m.pipe(26, 2, 3, { biter: true });
    lavaPit(m, 30, 37);
    m.plat('h', 31, 3, { range: 3, w: 3, speed: 40 });
    m.enemy('gloeder', 36, 1, { h: 5, phase: 0.9 });
    // Første stempler
    m.decorate('sign', 38, 2);
    m.fill(41, 10, 51, 17, T.HARD);
    m.spawn('stempel', 43, 8, { period: 2 });
    m.spawn('stempel', 47, 8, { period: 2, phase: 1 });
    m.coins(43, 3, 2); m.coins(47, 3, 2);
    lavaPit(m, 55, 66);
    m.plat('h', 56, 3, { range: 3, w: 3, speed: 45 });
    m.plat('v', 62, 2, { range: 4, w: 3, speed: 40 });
    m.enemy('bille', 72, 2);
    m.enemy('skramler', 76, 2); m.enemy('skramler', 78, 2);
    m.checkpoint(84, 2);
    lavaPit(m, 90, 104);
    m.plat('fall', 92, 4);
    m.plat('fall', 97, 5);
    m.plat('fall', 101, 4);
    m.enemy('gloeder', 95, 1, { h: 5 });
    m.enemy('gloeder', 99, 1, { h: 6, phase: 1 });
    m.put(108, 6, '?M?');
    // Stempelgang
    m.fill(116, 10, 141, 17, T.HARD);
    [118, 124, 130, 136].forEach((x, i) => m.spawn('stempel', x, 8, { period: 1.8, phase: i * 0.6 }));
    lavaPit(m, 145, 150);
    m.enemy('gloeder', 147, 1, { h: 5 });
    m.pipe(154, 2, 2, { biter: true });
    m.enemy('hopper', 160, 2);
    m.put(165, 5, 'B?B');
    m.goalAt(180, 2);
  });

  define('4-2', { name: 'Stempelhallen', theme: 'lava', time: 300 }, L => {
    const m = L.room('main', 200, 18);
    m.ground(0, 199, 2);
    roof(m, 0, 199, 15, T.HARD);
    m.startAt(2, 2);
    m.fill(10, 0, 18, 0, T.LAVA);
    m.fill(10, 1, 18, 1, T.CRUMBLE);
    m.fill(22, 9, 41, 14, T.HARD);
    [24, 29, 34, 39].forEach((x, i) => m.spawn('stempel', x, 7, { period: 1.6, phase: i * 0.5 }));
    m.fireBar(46, 5, 6, 1.6);
    m.fireBar(53, 5, 6, -1.6, Math.PI);
    m.fill(60, 0, 70, 0, T.LAVA);
    m.fill(60, 1, 70, 1, T.CRUMBLE);
    m.put(64, 6, '?P?');
    lavaPit(m, 74, 90);
    m.plat('v', 76, 2, { range: 5, w: 3, speed: 38 });
    m.plat('h', 81, 7, { range: 5, w: 3, speed: 45 });
    m.checkpoint(95, 2);
    m.enemy('gnist', 100, 2);
    m.enemy('gnist', 107, 2, { phase: 2 });
    m.put(112, 6, '?B?');
    m.fill(118, 0, 128, 0, T.LAVA);
    m.fill(118, 1, 128, 1, T.CRUMBLE);
    m.spawn('stempel', 122, 7, { period: 1.4 });
    m.fill(120, 9, 126, 14, T.HARD);
    m.cannon(136, 2, { period: 2.8 });
    m.fill(146, 2, 146, 3, T.HARD);
    m.cannon(146, 4, { period: 3, phase: 1.2 });
    m.fill(154, 9, 170, 14, T.HARD);
    [156, 161, 166].forEach((x, i) => m.spawn('stempel', x, 7, { period: 1.5, phase: i * 0.45 }));
    m.enemy('skramler', 175, 2);
    m.goalAt(184, 2);
  });

  define('4-3', { name: 'Kogekammeret', theme: 'lava', time: 300 }, L => {
    const m = L.room('main', 200, 18);
    m.ground(0, 199, 2);
    m.startAt(2, 2);
    lavaPit(m, 10, 40);
    m.fill(14, 2, 15, 3, T.HARD);
    m.fill(20, 2, 21, 5, T.HARD);
    m.fill(26, 2, 27, 4, T.HARD);
    m.fill(32, 2, 33, 6, T.HARD);
    m.fill(37, 2, 38, 3, T.HARD);
    [12, 17, 23, 29, 35].forEach((x, i) => m.enemy('gloeder', x, 1, { h: 6, phase: i * 0.4 }));
    m.put(44, 6, '?P?');
    m.enemy('gnist', 48, 2);
    m.cannon(54, 2, { period: 2.6 });
    lavaPit(m, 58, 75);
    m.plat('fall', 60, 4);
    m.plat('fall', 65, 5);
    m.plat('fall', 70, 4);
    m.enemy('gloeder', 63, 1, { h: 6, phase: 0.6 });
    m.enemy('gloeder', 68, 1, { h: 6, phase: 1.3 });
    m.enemy('bille', 80, 2);
    m.checkpoint(86, 2);
    m.fireBar(92, 3, 5, 2);
    m.fireBar(99, 8, 5, -2);
    lavaPit(m, 104, 124);
    m.plat('h', 105, 3, { range: 6, w: 3, speed: 55 });
    m.plat('v', 116, 2, { range: 6, w: 3, speed: 45 });
    m.fill(121, 8, 124, 8, T.HARD);
    m.cannon(124, 9, { period: 3 });
    m.enemy('gnist', 130, 2, { phase: 1 });
    m.enemy('gnist', 136, 2, { phase: 3 });
    m.put(140, 6, 'M');
    lavaPit(m, 146, 160);
    m.fill(146, 2, 147, 2, T.HARD);
    m.fill(150, 2, 151, 3, T.HARD);
    m.fill(154, 2, 155, 4, T.HARD);
    m.fill(158, 2, 159, 3, T.HARD);
    m.enemy('gloeder', 152, 1, { h: 7 });
    m.enemy('gloeder', 156, 1, { h: 7, phase: 0.8 });
    m.enemy('hopper', 168, 2);
    m.goalAt(182, 2);
  });

  define('4-4', { name: 'Magmus\' laboratorium', theme: 'lava', fort: true, time: 300 }, L => {
    const m = L.room('main', 160, 18);
    m.ground(0, 159, 2);
    m.fill(0, 15, 121, 17, T.HARD);
    m.startAt(2, 2);
    m.decorate('torch', 4, 2);
    lavaPit(m, 10, 16);
    m.fill(12, 2, 13, 3, T.HARD);
    m.fireBar(12, 4, 4, 1.6);
    m.fill(22, 9, 34, 14, T.HARD);
    m.spawn('stempel', 24, 7, { period: 1.4 });
    m.spawn('stempel', 30, 7, { period: 1.4, phase: 0.7 });
    lavaPit(m, 38, 50);
    m.plat('h', 39, 3, { range: 6, w: 3, speed: 60 });
    m.enemy('gloeder', 44, 1, { h: 6 });
    m.put(55, 6, '?P?');
    m.enemy('gnist', 60, 2);
    m.fill(66, 0, 76, 0, T.LAVA);
    m.fill(66, 1, 76, 1, T.CRUMBLE);
    m.fireBar(71, 7, 5, -1.8);
    m.cannon(84, 2, { period: 2.5 });
    m.fill(92, 2, 92, 4, T.HARD);
    m.cannon(92, 5, { period: 2.8, phase: 1 });
    m.fireBar(100, 6, 6, 1.9);
    m.checkpoint(112, 2);
    m.put(113, 6, 'P');
    arena(m, 124, 155, 'magmus', { lava: true });
  });
  /* =================================================================
     VERDEN 5 - FROSTFJELDET
     ================================================================= */
  define('5-1', { name: 'Isglat', theme: 'frost', time: 300 }, L => {
    const m = L.room('main', 200, 18);
    m.ground(0, 199, 2);
    m.startAt(2, 2);
    m.decorate('pine', 5, 2); m.decorate('snowman', 10, 2);
    m.fill(14, 1, 41, 1, T.ICE);
    m.decorate('sign', 13, 2);
    m.enemy('skramler', 20, 2);
    m.put(22, 5, '?P?');
    m.enemy('skramler', 26, 2);
    m.fill(28, 10, 37, 10, T.ICE);
    m.enemy('istap', 30, 9); m.enemy('istap', 34, 9);
    m.enemy('bille', 36, 2);
    m.gap(42, 44);
    mesa(m, 45, 50, 4);
    m.fill(45, 3, 50, 3, T.ICE);
    m.enemy('skramler', 48, 4, { edge: true });
    m.stairs(54, 2, 4, 1, T.ICE);
    m.gap(58, 60);
    m.stairs(61, 2, 4, -1, T.ICE);
    m.decorate('pine', 66, 2);
    m.checkpoint(70, 2);
    m.enemy('hopper', 76, 2);
    m.put(79, 5, 'B?B');
    m.enemy('skramler', 82, 2, { edge: true });
    m.gap(86, 96);
    m.plat('fall', 88, 4);
    m.plat('fall', 93, 5);
    m.fill(100, 1, 130, 1, T.ICE);
    m.enemy('bille', 108, 2); m.enemy('bille', 116, 2); m.enemy('bille', 124, 2);
    m.put(110, 5, 'B?SB');
    m.pipe(134, 2, 3, { biter: true });
    m.pipe(140, 2, 2, { to: { room: 'bonus', x: 4, y: 2 } });
    m.pipe(150, 2, 2);
    m.fill(152, 10, 166, 10, T.ICE);
    [154, 158, 162].forEach(x => m.enemy('istap', x, 9));
    m.decorate('snowman', 168, 2);
    m.stairs(172, 2, 6, 1, T.ICE);
    m.fill(178, 2, 178, 7, T.ICE);
    m.goalAt(184, 2);
    m.decorate('pine', 192, 2);
    bonusRoom(L, 'bonus', { x: 150, y: 3 });
  });

  define('5-2', { name: 'Snebroen', theme: 'frost', time: 300 }, L => {
    const m = L.room('main', 200, 18);
    mesa(m, 0, 10, 4);
    m.startAt(2, 4);
    m.decorate('pine', 6, 4);
    // Smuldrebro i snestorm
    m.fill(11, 3, 30, 3, T.CRUMBLE);
    m.windZone(11, 30, -30);
    m.coins(16, 5, 3); m.coins(24, 5, 3);
    mesa(m, 31, 40, 5);
    m.enemy('skramler', 36, 5);
    m.plat('fall', 43, 5);
    m.plat('fall', 48, 6);
    m.plat('fall', 53, 5);
    mesa(m, 57, 66, 4);
    m.put(59, 8, '?P?');
    m.checkpoint(63, 4);
    m.fill(69, 6, 72, 6, T.SEMI);
    m.enemy('drone', 74, 11, { mode: 'v', range: 2 });
    m.fill(76, 8, 79, 8, T.SEMI);
    m.enemy('drone', 81, 12, { mode: 'h', range: 2 });
    m.fill(83, 6, 86, 6, T.SEMI);
    mesa(m, 89, 100, 4);
    m.fill(89, 3, 100, 3, T.ICE);
    m.enemy('bille', 94, 4);
    m.enemy('hopper', 98, 4);
    m.plat('h', 102, 4, { range: 6, w: 3, speed: 50 });
    mesa(m, 112, 118, 5);
    m.put(114, 9, 'M');
    m.fill(119, 4, 135, 4, T.CRUMBLE);
    m.windZone(119, 135, -35);
    m.enemy('hopper', 127, 5);
    mesa(m, 136, 199, 3);
    m.enemy('skramler', 145, 3); m.enemy('skramler', 147, 3);
    m.put(152, 7, 'B?B');
    m.enemy('bille', 160, 3);
    m.goalAt(180, 3);
    m.decorate('snowman', 190, 3);
  });

  define('5-3', { name: 'Gletsjergrotten', theme: 'frost', time: 300 }, L => {
    const m = L.room('main', 210, 18);
    m.ground(0, 209, 2);
    roof(m, 0, 209, 15);
    m.startAt(3, 2);
    [12, 18, 24].forEach(x => m.enemy('istap', x, 14));
    m.fill(10, 1, 40, 1, T.ICE);
    m.cannon(30, 2, { period: 3 });
    m.fill(44, 1, 48, 1, T.SPIKE);
    m.put(52, 5, '?P?');
    m.enemy('bille', 58, 2);
    m.fill(60, 1, 80, 1, T.ICE);
    m.fill(64, 9, 80, 14, T.GROUND);
    [66, 70, 74, 78].forEach(x => m.enemy('istap', x, 8));
    // Et uskyldigt rør ... der fører til warp-grotten
    m.decorate('sign', 89, 2);
    m.pipe(92, 2, 2, { to: { room: 'warp', x: 4, y: 2 } });
    m.checkpoint(102, 2);
    m.pipe(110, 2, 2);
    m.cannon(118, 2, { period: 2.8 });
    m.fill(126, 2, 126, 3, T.HARD);
    m.cannon(126, 4, { period: 3, phase: 1 });
    m.fill(132, 1, 140, 1, T.SPIKE);
    m.fill(133, 5, 135, 5, T.SEMI);
    m.fill(138, 5, 140, 5, T.SEMI);
    m.enemy('hopper', 146, 2);
    m.enemy('istap', 150, 14); m.enemy('istap', 154, 14);
    m.pipe(160, 2, 3, { biter: true });
    m.pipe(168, 2, 2, { biter: 1 });
    m.enemy('skramler', 176, 2, { edge: true });
    m.goalAt(190, 2);
    // Warp-grotten
    const w = L.room('warp', 46, 18, { theme: 'frost', camLock: false });
    w.ground(0, 45, 2);
    w.fill(0, 2, 1, 17, T.HARD); w.fill(44, 2, 45, 17, T.HARD);
    roof(w, 2, 43, 14);
    w.startAt(4, 2);
    w.decorate('sign', 18, 2);
    w.coins(10, 4, 6); w.coins(26, 4, 6);
    w.pipe(22, 2, 3, { warp: 6 });
    w.pipe(38, 2, 3, { to: { room: 'main', x: 110, y: 3, pipe: true } });
  });

  define('5-4', { name: 'Frostborgen', theme: 'frost', fort: true, time: 300 }, L => {
    const m = L.room('main', 160, 18);
    m.ground(0, 159, 2);
    m.fill(0, 15, 121, 17, T.HARD);
    m.startAt(2, 2);
    m.decorate('torch', 4, 2);
    m.gap(10, 18);
    m.fill(10, 1, 18, 1, T.CRUMBLE);
    m.fill(22, 1, 60, 1, T.ICE);
    m.fill(24, 9, 40, 14, T.HARD);
    [26, 30, 34, 38].forEach(x => m.enemy('istap', x, 8));
    m.cannon(46, 2, { period: 2.6 });
    m.fireBar(52, 6, 5, 1.8);
    m.put(57, 6, '?P?');
    m.gap(64, 67);
    m.plat('fall', 65, 3);
    m.fill(70, 10, 82, 14, T.HARD);
    m.fill(70, 9, 82, 9, T.SPIKE_DOWN);
    m.enemy('bille', 76, 2);
    m.fill(84, 1, 100, 1, T.ICE);
    m.enemy('bille', 88, 2); m.enemy('skramler', 94, 2);
    m.fireBar(104, 5, 6, -1.7);
    m.checkpoint(112, 2);
    m.put(113, 6, 'P');
    arena(m, 124, 155, 'frosti', { ice: true });
  });

  /* =================================================================
     VERDEN 6 - MØRKESKOVEN
     ================================================================= */
  define('6-1', { name: 'Skumringsstien', theme: 'forest', time: 300 }, L => {
    const m = L.room('main', 200, 18, { dark: true });
    m.ground(0, 199, 2);
    m.startAt(2, 2);
    [8, 20, 34, 50, 66, 82, 98, 114, 130, 146, 162, 178].forEach(x => m.decorate('mushroom', x, 2));
    m.decorate('sign', 4, 2);
    m.enemy('torn', 16, 2, { h: 3 });
    m.enemy('skramler', 24, 2);
    m.enemy('torn', 28, 2, { h: 2, phase: 1.2 });
    m.put(30, 5, '?P?');
    m.enemy('flagermus', 40, 13);
    m.enemy('skramler', 44, 2);
    m.enemy('flagermus', 56, 14);
    m.fill(60, 0, 64, 1, T.POISON);
    m.fill(61, 5, 63, 5, T.SEMI);
    // Usynlige trin op til en gren med ekstraliv
    m.coins(72, 3, 1); m.coins(75, 6, 1); m.coins(78, 9, 1);
    m.put(72, 5, 'h'); m.put(75, 8, 'h'); m.put(78, 11, 'h');
    m.fill(80, 13, 84, 13, T.SEMI);
    m.put(82, 16, 'l');
    m.checkpoint(100, 2);
    m.enemy('torn', 106, 2, { h: 3 });
    m.enemy('torn', 111, 2, { h: 3, phase: 1.2 });
    m.enemy('torn', 116, 2, { h: 3, phase: 2.4 });
    m.enemy('flagermus', 124, 13);
    m.enemy('bille', 128, 2);
    m.enemy('flagermus', 132, 14);
    m.enemy('hopper', 138, 2);
    m.fill(142, 0, 150, 1, T.POISON);
    m.plat('fall', 143, 4);
    m.plat('fall', 147, 5);
    m.enemy('torn', 156, 2, { h: 4 });
    m.put(160, 5, '?');
    m.enemy('skramler', 166, 2); m.enemy('skramler', 168, 2);
    m.goalAt(184, 2);
  });

  define('6-2', { name: 'Giftsumpen', theme: 'forest', time: 300 }, L => {
    const m = L.room('main', 210, 18);
    m.ground(0, 209, 2);
    m.startAt(2, 2);
    m.fill(10, 0, 15, 1, T.POISON);
    m.fill(12, 4, 13, 4, T.SEMI);
    m.enemy('torn', 20, 2, { h: 3 });
    m.enemy('torn', 24, 2, { h: 3, phase: 1.5 });
    m.enemy('hopper', 30, 2);
    m.fill(34, 0, 50, 1, T.POISON);
    m.plat('h', 35, 3, { range: 9, w: 3, speed: 50 });
    m.enemy('drone', 42, 8, { mode: 'h', range: 3 });
    m.put(54, 5, '?P?');
    m.fill(60, 0, 64, 1, T.POISON);
    m.enemy('torn', 68, 2, { h: 4 });
    m.enemy('bille', 72, 2);
    m.checkpoint(80, 2);
    // Åkander der synker
    m.fill(86, 0, 110, 1, T.POISON);
    [88, 92, 96, 100].forEach(x => m.plat('fall', x, 2, { w: 2 }));
    m.plat('v', 104, 2, { range: 3, w: 3, speed: 40 });
    m.coins(92, 5, 6);
    m.pipe(116, 2, 3, { biter: true });
    m.enemy('torn', 122, 2, { h: 3 });
    m.enemy('torn', 126, 2, { h: 3, phase: 0.9 });
    m.enemy('torn', 130, 2, { h: 3, phase: 1.8 });
    m.fill(136, 0, 150, 1, T.POISON);
    m.fill(138, 5, 140, 5, T.SEMI);
    m.fill(143, 7, 145, 7, T.SEMI);
    m.fill(148, 5, 150, 5, T.SEMI);
    m.enemy('drone', 144, 11, { mode: 'v', range: 1.5 });
    m.enemy('hopper', 158, 2);
    m.put(162, 5, 'BSB');
    m.enemy('skramler', 170, 2, { edge: true });
    m.goalAt(188, 2);
  });

  define('6-3', { name: 'De hviskende træer', theme: 'forest', time: 300 }, L => {
    const m = L.room('main', 170, 18, { dark: true });
    m.ground(0, 169, 2);
    m.startAt(2, 2);
    [6, 18, 30, 44, 56, 70, 84, 98, 112, 126, 140, 152].forEach(x => m.decorate('mushroom', x, 2));
    m.enemy('torn', 14, 2, { h: 3 });
    m.enemy('flagermus', 22, 13);
    m.put(26, 5, '?P?');
    m.fill(34, 0, 38, 1, T.POISON);
    m.enemy('skramler', 44, 2);
    m.enemy('torn', 50, 2, { h: 3, phase: 1 });
    // En mur af rødder - eneste vej videre er gennem døren
    m.decorate('sign', 54, 2);
    m.door(57, 2, { room: 'hule', x: 3, y: 2 });
    m.fill(60, 2, 62, 17, T.GROUND);
    m.enemy('flagermus', 70, 13);
    m.enemy('torn', 76, 2, { h: 3 });
    m.enemy('hopper', 82, 2);
    m.put(88, 5, 'BhB');
    m.fill(94, 0, 100, 1, T.POISON);
    m.plat('h', 95, 3, { range: 3, w: 2, speed: 40 });
    m.checkpoint(104, 2);
    m.enemy('torn', 110, 2, { h: 4 });
    m.enemy('bille', 116, 2);
    m.enemy('flagermus', 122, 14);
    m.enemy('torn', 128, 2, { h: 3, phase: 1.6 });
    m.put(132, 5, '?');
    m.goalAt(150, 2);
    // Hulen med mini-bossen
    const h = L.room('hule', 60, 18, { dark: true, camLock: false });
    h.ground(0, 59, 2);
    roof(h, 0, 59, 14);
    h.fill(0, 2, 1, 13, T.HARD);
    h.fill(58, 2, 59, 13, T.HARD);
    h.startAt(3, 2);
    [6, 20, 36, 50].forEach(x => h.decorate('mushroom', x, 2));
    h.enemy('torn', 12, 2, { h: 3 });
    h.put(16, 5, '?');
    h.spawn('miniboss', 34, 2, { id: 'kaempeskramler', drop: 'flower' });
    h.door(55, 2, { room: 'main', x: 65, y: 2 });
  });

  define('6-4', { name: 'Rodkongens hal', theme: 'forest', fort: true, time: 300 }, L => {
    const m = L.room('main', 160, 18);
    m.ground(0, 159, 2);
    m.fill(0, 15, 121, 17, T.HARD);
    m.startAt(2, 2);
    m.decorate('torch', 4, 2);
    m.fill(10, 0, 15, 1, T.POISON);
    m.fill(12, 2, 13, 3, T.HARD);
    m.enemy('torn', 20, 2, { h: 3 });
    m.enemy('torn', 24, 2, { h: 3, phase: 1.2 });
    m.enemy('torn', 28, 2, { h: 3, phase: 2.4 });
    m.enemy('flagermus', 34, 14); m.enemy('flagermus', 40, 14);
    m.put(46, 6, '?P?');
    m.fill(52, 0, 62, 1, T.POISON);
    m.plat('h', 53, 3, { range: 6, w: 3, speed: 55 });
    m.cannon(68, 2, { period: 2.6 });
    m.enemy('torn', 74, 2, { h: 4 });
    m.fireBar(82, 5, 5, 1.8);
    m.enemy('bille', 90, 2);
    m.enemy('torn', 96, 2, { h: 3, phase: 0.6 });
    m.enemy('flagermus', 102, 14);
    m.checkpoint(112, 2);
    m.put(113, 6, 'P');
    arena(m, 124, 155, 'rodkongen');
  });
  /* =================================================================
     VERDEN 7 - MEKANIKKENS BY
     ================================================================= */
  define('7-1', { name: 'Transportbåndene', theme: 'mech', time: 300 }, L => {
    const m = L.room('main', 210, 18);
    m.ground(0, 209, 2);
    m.startAt(2, 2);
    m.decorate('sign', 6, 2);
    m.fill(10, 1, 30, 1, T.CONV_R);
    m.put(16, 5, '?P?');
    m.enemy('skramler', 22, 2);
    m.fill(34, 1, 54, 1, T.CONV_L);
    m.enemy('gnist', 40, 2);
    m.enemy('gnist', 48, 2, { phase: 2 });
    m.decorate('gear', 56, 2);
    m.gap(58, 72);
    m.fill(59, 4, 62, 4, T.CONV_L);
    m.fill(66, 6, 69, 6, T.CONV_R);
    m.coins(66, 8, 4);
    m.cannon(78, 2, { period: 2.8 });
    m.checkpoint(84, 2);
    // Roterende platforme
    m.gap(90, 104);
    m.plat('circle', 94, 6, { range: 2.5, w: 3, speed: 60 });
    m.plat('circle', 101, 6, { range: 2.5, w: 3, speed: 60, angle: Math.PI });
    m.fill(106, 1, 124, 1, T.CONV_R);
    m.enemy('gnist', 110, 2);
    m.enemy('gnist', 116, 2, { phase: 1 });
    m.enemy('bille', 130, 2);
    m.pipe(136, 2, 3, { biter: true });
    m.fill(140, 1, 160, 1, T.CONV_L);
    m.enemy('hopper', 150, 2);
    m.put(148, 5, 'BSB');
    // Stempler over et bånd, der skubber dig fremad
    m.fill(162, 1, 178, 1, T.CONV_R);
    m.fill(164, 10, 176, 17, T.HARD);
    m.spawn('stempel', 166, 8, { period: 1.6 });
    m.spawn('stempel', 171, 8, { period: 1.6, phase: 0.8 });
    m.goalAt(192, 2);
    m.decorate('chimney', 200, 2);
  });

  define('7-2', { name: 'Stempelgaden', theme: 'mech', time: 300 }, L => {
    const m = L.room('main', 210, 18);
    m.ground(0, 209, 2);
    roof(m, 0, 209, 13, T.HARD);
    m.startAt(2, 2);
    [12, 17, 22].forEach((x, i) => m.spawn('stempel', x, 11, { period: 1.5, phase: i * 0.5 }));
    m.cannon(30, 2, { period: 2.6 });
    m.fill(38, 2, 38, 3, T.HARD);
    m.cannon(38, 4, { period: 3, phase: 1 });
    m.fill(44, 1, 60, 1, T.CONV_R);
    [48, 53, 58].forEach((x, i) => m.spawn('stempel', x, 11, { period: 1.4, phase: i * 0.45 }));
    m.enemy('gnist', 64, 2);
    m.enemy('gnist', 70, 2, { phase: 2 });
    m.put(74, 6, '?P?');
    m.checkpoint(80, 2);
    lavaPit(m, 86, 96);
    m.fill(88, 4, 90, 4, T.CONV_L);
    m.fill(93, 5, 95, 5, T.CONV_R);
    [100, 105, 110].forEach((x, i) => m.spawn('stempel', x, 11, { period: 1.3, phase: i * 0.4 }));
    m.cannon(116, 2, { period: 2.4 });
    m.fill(120, 1, 140, 1, T.CONV_L);
    m.enemy('hopper', 128, 2);
    m.enemy('hopper', 134, 2);
    m.pipe(146, 2, 3, { biter: true });
    m.spawn('stempel', 152, 11, { period: 1.2 });
    m.spawn('stempel', 157, 11, { period: 1.2, phase: 0.6 });
    m.enemy('bille', 166, 2);
    m.put(170, 5, '?');
    m.goalAt(186, 2);
  });

  define('7-3', { name: 'Tandhjulstårnet', theme: 'mech', time: 300 }, L => {
    const m = L.room('main', 46, 54, { camLock: false });
    m.ground(0, 45, 2);
    m.fill(0, 0, 1, 53, T.HARD);
    m.fill(44, 0, 45, 53, T.HARD);
    m.startAt(4, 2);
    m.fill(8, 1, 40, 1, T.CONV_R);
    m.enemy('gnist', 20, 2);
    m.fill(34, 5, 40, 5, T.CONV_L);
    m.fill(24, 8, 29, 8, T.CONV_L);
    m.plat('circle', 16, 11, { range: 3, w: 3, speed: 55 });
    m.fill(4, 14, 10, 14, T.SEMI);
    m.fill(14, 17, 20, 17, T.CONV_R);
    m.cannon(43, 18, { period: 3, always: true });
    m.fill(23, 20, 28, 20, T.SEMI);
    // Mellemgulv
    m.fill(2, 23, 43, 23, T.SEMI);
    m.checkpoint(6, 24);
    m.enemy('gnist', 20, 24);
    m.enemy('gnist', 32, 24, { phase: 2 });
    m.put(12, 27, '?P?');
    m.fill(36, 27, 42, 27, T.CONV_L);
    m.fill(26, 30, 31, 30, T.SEMI);
    m.plat('circle', 18, 33, { range: 3, w: 3, speed: 60, dir: -1 });
    m.enemy('drone', 28, 35, { mode: 'h', range: 3 });
    m.fill(5, 35, 11, 35, T.SEMI);
    m.cannon(43, 37, { period: 3.2, always: true });
    m.fill(14, 38, 19, 38, T.CONV_R);
    m.fill(24, 41, 30, 41, T.SEMI);
    m.coins(24, 42, 6);
    m.fill(32, 42, 43, 42, T.GROUND);
    m.goalAt(36, 43);
  });

  define('7-4', { name: 'Tyrannens fabrik', theme: 'mech', fort: true, time: 300 }, L => {
    const m = L.room('main', 160, 18);
    m.ground(0, 159, 2);
    m.fill(0, 15, 121, 17, T.HARD);
    m.startAt(2, 2);
    m.decorate('torch', 4, 2);
    m.fill(8, 1, 20, 1, T.CONV_R);
    m.spawn('stempel', 10, 13, { period: 1.6 });
    m.spawn('stempel', 15, 13, { period: 1.6, phase: 0.8 });
    m.cannon(26, 2, { period: 2.6 });
    m.enemy('gnist', 32, 2);
    lavaPit(m, 38, 48);
    m.fill(40, 4, 42, 4, T.CONV_R);
    m.fill(45, 5, 47, 5, T.CONV_L);
    m.fireBar(54, 6, 6, 1.8);
    m.put(60, 6, '?P?');
    m.fill(66, 1, 86, 1, T.CONV_L);
    [70, 76, 82].forEach((x, i) => m.spawn('stempel', x, 13, { period: 1.5, phase: i * 0.5 }));
    m.enemy('gnist', 92, 2, { phase: 1 });
    m.fill(98, 2, 98, 3, T.HARD);
    m.cannon(98, 4, { period: 2.8 });
    m.fireBar(104, 5, 5, -1.9);
    m.checkpoint(112, 2);
    m.put(113, 6, 'P');
    arena(m, 124, 155, 'tyrann');
  });

  /* =================================================================
     VERDEN 8 - KAOSFÆSTNINGEN
     ================================================================= */
  define('8-1', { name: 'Kaosporten', theme: 'chaos', time: 300 }, L => {
    const m = L.room('main', 220, 18);
    m.ground(0, 219, 2);
    m.startAt(2, 2);
    m.decorate('skullpost', 6, 2);
    m.windZone(10, 30, 55);
    lavaPit(m, 12, 28);
    m.fill(15, 2, 16, 3, T.HARD);
    m.fill(21, 2, 22, 4, T.HARD);
    m.fill(26, 2, 27, 3, T.HARD);
    m.enemy('gloeder', 19, 1, { h: 6 });
    m.enemy('gloeder', 24, 1, { h: 6, phase: 0.8 });
    m.cannon(34, 2, { period: 2.6 });
    m.enemy('bille', 40, 2);
    m.put(44, 5, '?P?');
    // Fjeder til den øverste rute - eller faldende platforme over lava
    m.spring(50, 2);
    m.fill(53, 12, 64, 12, T.SEMI);
    m.coins(53, 13, 12);
    lavaPit(m, 54, 63);
    m.plat('fall', 56, 4);
    m.plat('fall', 60, 5);
    m.enemy('drone', 70, 8, { mode: 'v', range: 2 });
    m.enemy('drone', 76, 6, { mode: 'h', range: 2 });
    m.checkpoint(82, 2);
    m.windZone(86, 108, -45);
    lavaPit(m, 88, 106);
    m.plat('h', 89, 3, { range: 4, w: 3, speed: 50 });
    m.fill(97, 2, 98, 4, T.HARD);
    m.fill(103, 2, 104, 3, T.HARD);
    m.enemy('gloeder', 101, 1, { h: 6 });
    m.enemy('gnist', 112, 2);
    m.fireBar(118, 5, 5, 1.8);
    m.fill(124, 1, 130, 1, T.SPIKE);
    m.fill(125, 5, 129, 5, T.SEMI);
    m.enemy('hopper', 136, 2); m.enemy('hopper', 140, 2);
    m.fill(146, 2, 146, 4, T.HARD);
    m.cannon(146, 5, { period: 2.8 });
    m.fill(152, 0, 162, 0, T.LAVA);
    m.fill(152, 1, 162, 1, T.CRUMBLE);
    m.enemy('bille', 168, 2);
    m.enemy('skramler', 172, 2, { edge: true });
    m.put(176, 5, 'B?B');
    m.goalAt(200, 2);
  });

  define('8-2', { name: 'Ruinbroen', theme: 'chaos', time: 300 }, L => {
    const m = L.room('main', 220, 18);
    m.ground(0, 219, 2);
    m.startAt(2, 2);
    m.fill(8, 1, 30, 1, T.ICE);
    m.enemy('bille', 14, 2); m.enemy('bille', 22, 2);
    m.fill(16, 10, 27, 10, T.ICE);
    [18, 22, 26].forEach(x => m.enemy('istap', x, 9));
    m.fill(34, 0, 46, 0, T.LAVA);
    m.fill(34, 1, 46, 1, T.CRUMBLE);
    m.enemy('gloeder', 37, 0, { h: 5 });
    m.enemy('gloeder', 43, 0, { h: 5, phase: 1 });
    // Stempler over is
    m.fill(50, 11, 80, 17, T.HARD);
    m.fill(50, 1, 66, 1, T.ICE);
    [52, 57, 62].forEach((x, i) => m.spawn('stempel', x, 9, { period: 1.5, phase: i * 0.5 }));
    m.put(70, 6, '?P?');
    lavaPit(m, 84, 100);
    m.plat('fall', 86, 4);
    m.plat('fall', 91, 5);
    m.plat('fall', 96, 4);
    m.checkpoint(104, 2);
    m.cannon(110, 2, { period: 2.4 });
    m.fill(118, 2, 118, 3, T.HARD);
    m.cannon(118, 4, { period: 2.8, phase: 1 });
    m.fill(120, 1, 135, 1, T.ICE);
    m.fireBar(124, 5, 6, 1.9);
    lavaPit(m, 140, 152);
    m.fill(143, 2, 144, 4, T.HARD);
    m.fill(148, 2, 149, 5, T.HARD);
    m.enemy('gloeder', 146, 1, { h: 7 });
    m.enemy('gloeder', 151, 1, { h: 7, phase: 0.9 });
    m.enemy('hopper', 158, 2);
    m.fill(164, 11, 178, 17, T.HARD);
    m.spawn('stempel', 166, 9, { period: 1.3 });
    m.spawn('stempel', 172, 9, { period: 1.3, phase: 0.65 });
    m.enemy('skramler', 184, 2, { edge: true });
    m.goalAt(200, 2);
  });

  define('8-3', { name: 'Mørkets labyrint', theme: 'chaos', time: 300 }, L => {
    const m = L.room('main', 220, 18, { dark: true });
    m.ground(0, 219, 2);
    m.startAt(2, 2);
    for (let x = 6; x < 210; x += 14) m.decorate('torch', x, 2);
    m.fill(8, 1, 24, 1, T.CONV_R);
    m.enemy('torn', 14, 2, { h: 3 });
    m.enemy('torn', 20, 2, { h: 3, phase: 1.5 });
    m.enemy('gnist', 30, 2);
    m.enemy('flagermus', 36, 13); m.enemy('flagermus', 44, 14);
    m.fill(48, 0, 56, 1, T.POISON);
    m.fill(49, 4, 51, 4, T.CONV_L);
    m.fill(53, 5, 55, 5, T.CONV_R);
    m.put(60, 5, '?P?');
    // Muren - vejen går gennem krypten
    m.decorate('sign', 66, 2);
    m.door(69, 2, { room: 'krypt', x: 3, y: 2 });
    m.fill(72, 2, 74, 17, T.GROUND);
    m.checkpoint(82, 2);
    m.put(86, 5, 'h'); m.put(89, 8, 'h');
    m.fill(91, 10, 95, 10, T.SEMI);
    m.put(93, 13, '1');
    m.enemy('torn', 94, 2, { h: 3 });
    m.enemy('torn', 99, 2, { h: 3, phase: 1.2 });
    m.enemy('torn', 104, 2, { h: 3, phase: 2.4 });
    m.fill(110, 0, 124, 1, T.POISON);
    m.plat('fall', 112, 3);
    m.plat('fall', 116, 4);
    m.plat('fall', 120, 3);
    m.enemy('flagermus', 117, 14);
    m.enemy('gnist', 130, 2);
    m.enemy('gnist', 136, 2, { phase: 2 });
    m.cannon(142, 2, { period: 2.6 });
    m.fill(148, 1, 170, 1, T.CONV_L);
    m.enemy('torn', 156, 2, { h: 4 });
    m.enemy('torn', 164, 2, { h: 4, phase: 1.8 });
    m.enemy('hopper', 176, 2);
    m.goalAt(200, 2);
    // Krypten
    const k = L.room('krypt', 60, 18, { dark: true, camLock: false });
    k.ground(0, 59, 2);
    roof(k, 0, 59, 14, T.HARD);
    k.fill(0, 2, 1, 13, T.HARD); k.fill(58, 2, 59, 13, T.HARD);
    k.startAt(3, 2);
    [5, 19, 33, 47].forEach(x => k.decorate('torch', x, 2));
    k.fill(4, 1, 20, 1, T.CONV_R);
    k.enemy('torn', 10, 2, { h: 3 });
    k.enemy('gnist', 26, 2);
    k.fill(32, 0, 36, 1, T.POISON);
    k.fill(33, 4, 35, 4, T.SEMI);
    k.enemy('flagermus', 40, 12);
    k.put(44, 5, '?');
    k.door(55, 2, { room: 'main', x: 77, y: 2 });
  });

  define('8-4', { name: 'Kejserens trone', theme: 'chaos', fort: true, time: 400 }, L => {
    const m = L.room('main', 200, 18);
    m.ground(0, 199, 2);
    m.fill(0, 15, 157, 17, T.HARD);
    m.startAt(2, 2);
    m.decorate('torch', 4, 2);
    lavaPit(m, 8, 14);
    m.fill(10, 2, 11, 3, T.HARD);
    m.fireBar(18, 5, 5, 1.8);
    m.fireBar(24, 8, 6, -1.6);
    m.fill(28, 9, 44, 14, T.HARD);
    [30, 35, 40].forEach((x, i) => m.spawn('stempel', x, 7, { period: 1.4, phase: i * 0.45 }));
    m.cannon(48, 2, { period: 2.4 });
    m.enemy('gnist', 54, 2);
    m.fill(58, 1, 72, 1, T.ICE);
    m.enemy('bille', 64, 2);
    lavaPit(m, 74, 84);
    m.plat('h', 75, 3, { range: 4, w: 3, speed: 55 });
    m.enemy('gloeder', 80, 1, { h: 6 });
    m.put(88, 6, '?P?');
    m.fill(92, 1, 108, 1, T.CONV_L);
    m.enemy('gnist', 98, 2, { phase: 1 });
    m.fireBar(104, 6, 5, 2);
    m.fill(112, 0, 122, 0, T.LAVA);
    m.fill(112, 1, 122, 1, T.CRUMBLE);
    m.fill(128, 2, 128, 3, T.HARD);
    m.cannon(128, 4, { period: 2.6 });
    m.enemy('torn', 134, 2, { h: 3 });
    m.enemy('torn', 138, 2, { h: 3, phase: 1.2 });
    m.checkpoint(146, 2);
    m.put(147, 6, 'P');
    m.put(150, 6, 'S');
    arena(m, 160, 191, 'kejser', { ledges: [[164, 6, 4], [184, 6, 4], [173, 9, 6]] });
  });
})();
