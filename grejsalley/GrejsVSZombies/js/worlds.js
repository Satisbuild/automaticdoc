'use strict';
/* =====================================================================
   GREJS VS ZOMBIES - worlds.js
   10 verdener × 15 baner. Verdensdata, baggrundsmaling, vejr-overlays
   og en datadrevet banegenerator, som bygger hver bane ud fra en
   skabelon (type, specialregel, nye zombier, belønning).
   Desuden: Endless Survival, daglige udfordringer, specialudfordringer
   og skattejagter.
   ===================================================================== */
GVZ.Worlds = (function () {
  const U = GVZ.U, A = GVZ.A;
  const W = 1280, H = 720;
  const LAYOUT = { W, H, X0: 240, Y0: 140, CW: 100, CH: 112, COLS: 9, ROWS: 5 };

  const WORLDS = [
    {
      key: 'w1', name: "Grejs' Have", sub: 'Hvor det hele begynder', boss: 'kompost', song: 'w1',
      sky: ['#7cc8ff', '#d8f2ff'], g1: '#6fc24a', g2: '#5fb03e', dirt: '#8a5a32', accent: '#ffd23f', ground: 'grass',
      mech: [], mechText: 'Lær det grundlæggende: plant, saml sol og forsvar alle rækker.',
      unlock: { 0: 'solspire', 1: 'barkmur', 2: 'knoldmine', 3: 'tomatbombe', 4: 'isknop', 5: 'pebberpuffer', 6: 'grejsgab', 8: 'tvillinglys', 10: 'grenskyder', 12: 'urtetid' },
      intro: { 0: 'shambler', 1: 'flag', 2: 'pothead', 4: 'sprinter', 6: 'kettle', 8: 'shieldbearer', 10: 'polejumper', 12: 'brute' },
    },
    {
      key: 'w2', name: 'Sandstormens Rige', sub: 'Ruiner, gravsten og sandstorme', boss: 'farao', song: 'w2',
      sky: ['#ffb45a', '#ffe9b0'], g1: '#e8c77a', g2: '#dcb866', dirt: '#b8874a', accent: '#ff8a2a', ground: 'sand',
      mech: ['tombs', 'sandstorm'], mechText: 'Gravsten blokerer lige skud og kan ikke beplantes. Sandstorme kaster zombier midt ind på banen.',
      unlock: { 1: 'bombebaer', 4: 'piggebold', 7: 'stenrod', 10: 'frostklokke', 14: 'flydeblad' },
      intro: { 0: 'mummy', 2: 'scarab', 4: 'tosser', 6: 'sarcophagus', 9: 'sidestepper', 11: 'gnawer' },
    },
    {
      key: 'w3', name: 'Piratbugten', sub: 'Planker, vand og kanonild', boss: 'raadskaeg', song: 'w3',
      sky: ['#5ab8ff', '#c8ecff'], g1: '#d8b878', g2: '#c9a868', dirt: '#8a6a3a', accent: '#3ad0e0', ground: 'deck',
      mech: ['water', 'wind'], mechText: 'De bageste kolonner er vand - plant et Flydeblad først. Vindstød skubber zombierne fremad.',
      unlock: { 3: 'naalepude', 6: 'blaesebaelg', 9: 'graeskarkaster' },
      intro: { 0: 'swashbuckler', 4: 'balloon', 6: 'parrot', 8: 'cannoneer', 11: 'splitter' },
    },
    {
      key: 'w4', name: 'Det Vilde Vest', sub: 'Minevogne, støv og revolvere', boss: 'larry', song: 'w4',
      sky: ['#ff9a5a', '#ffe0a0'], g1: '#c8a060', g2: '#ba9254', dirt: '#8a5a32', accent: '#e8423a', ground: 'dust',
      mech: ['rails'], mechText: 'Minevogne kører på skinner: tryk på en plante i en vogn og derefter på et andet skinnefelt for at flytte den.',
      unlock: { 1: 'tornlanse', 4: 'solkrukke', 7: 'tornmaatte', 10: 'flammerod' },
      intro: { 0: 'pianist', 3: 'gunslinger', 6: 'prospector', 9: 'warden', 11: 'digger' },
    },
    {
      key: 'w5', name: 'Neonfremtiden', sub: 'Energiskjolde og robotter', boss: 'zombot', song: 'w5',
      sky: ['#1a1240', '#5a2a8a'], g1: '#3a4a6a', g2: '#34425e', dirt: '#20283a', accent: '#5ae0ff', ground: 'metal',
      mech: ['power'], mechText: 'Kraftfelter giver planter, der står på dem, +50% skade og tempo.',
      unlock: { 1: 'laserlilje', 4: 'lynklover', 7: 'skjoldbregne', 10: 'rytmerod', 14: 'maaneblomst' },
      intro: { 0: 'shieldbot', 3: 'jetpack', 6: 'hologram', 9: 'berserker', 11: 'mech' },
    },
    {
      key: 'w6', name: 'Skyggernes Slot', sub: 'Nat, magi og riddere', boss: 'drage', song: 'w6',
      sky: ['#0a0a24', '#2a2050'], g1: '#4a5a4a', g2: '#405040', dirt: '#2a2a2a', accent: '#a26bff', ground: 'stone', night: true,
      mech: ['night', 'tombs'], mechText: 'Det er nat: der falder meget lidt sol. Måneblomster trives. Gravsten dukker op.',
      unlock: { 3: 'giftsvamp', 6: 'mospude', 9: 'glodstub' },
      intro: { 0: 'knight', 3: 'necromancer', 6: 'witch', 9: 'vampire' },
    },
    {
      key: 'w7', name: 'Den Frosne Grænse', sub: 'Is, sne og snestorme', boss: 'frostjaette', song: 'w7',
      sky: ['#8ac8f0', '#eaf6ff'], g1: '#e8f2fa', g2: '#d8e6f2', dirt: '#8aa0b8', accent: '#9be8ff', ground: 'snow',
      mech: ['ice', 'blizzard'], mechText: 'Isrækker får zombier til at glide hurtigere. Snestorme fryser planter fast - Ildblomst tør dem op.',
      unlock: { 1: 'ildblomst', 4: 'giftsump', 7: 'solspejl' },
      intro: { 0: 'skater', 3: 'snowballer', 6: 'yeti', 10: 'giant' },
    },
    {
      key: 'w8', name: 'Den Forladte Storby', sub: 'Biler, ruiner og sammenstyrtninger', boss: 'bulldozer', song: 'w8',
      sky: ['#6a7a8a', '#c8ccd0'], g1: '#7a7f88', g2: '#70757e', dirt: '#4a4a50', accent: '#ffc23a', ground: 'asphalt',
      mech: ['wrecks', 'collapse'], mechText: 'Bilvrag blokerer felter. Under kampen styrter dele af vejen sammen - planter på revnede felter går tabt!',
      unlock: { 1: 'bumerang', 4: 'kvikjord', 7: 'boblebusk' },
      intro: { 0: 'driver', 4: 'breakdancer' },
    },
    {
      key: 'w9', name: 'Den Giftige Jungle', sub: 'Sumpe, lianer og gift', boss: 'hydra', song: 'w9',
      sky: ['#3a8a5a', '#b8e8a0'], g1: '#4a8a3a', g2: '#428032', dirt: '#3a2a1a', accent: '#9cff6b', ground: 'moss',
      mech: ['bog', 'vines'], mechText: 'Giftsumpe forgifter zombier, men tærer også på planter. Lianer gror ud over tomme felter.',
      unlock: { 1: 'slimknop', 4: 'guldknop' },
      intro: { 0: 'vineswinger', 3: 'toad', 6: 'shaman' },
    },
    {
      key: 'w10', name: 'Zombieimperiet', sub: 'Den sidste fæstning', boss: 'kejser', song: 'w10',
      sky: ['#2a0a1a', '#7a2a3a'], g1: '#5a4a5a', g2: '#524252', dirt: '#2a1a2a', accent: '#ff4d5a', ground: 'empire',
      mech: ['power', 'collapse', 'tombs'], mechText: 'Alt på én gang: kraftfelter, gravsten og sammenstyrtninger - og zombier fra hele kortet.',
      unlock: {},
      intro: { 0: 'imperial' },
    },
  ];
  WORLDS.forEach((w, i) => { w.idx = i; });

  /* Hvilken verden/bane introducerer hver zombie (bruges til puljer) */
  const ZINTRO = {};
  WORLDS.forEach((w, wi) => { for (const li in w.intro) ZINTRO[w.intro[li]] = { wi, li: +li }; });
  ZINTRO.mini = ZINTRO.splitter;
  const PLANT_UNLOCK = {};
  WORLDS.forEach((w, wi) => { for (const li in w.unlock) PLANT_UNLOCK[w.unlock[li]] = { wi, li: +li }; });

  /* ---------------------------------------------------------------
     Banegenerator
     --------------------------------------------------------------- */
  const TEMPLATE = [
    { type: 'normal' }, { type: 'normal' }, { type: 'special' }, { type: 'normal' }, { type: 'conveyor' },
    { type: 'normal' }, { type: 'special' }, { type: 'gauntlet' }, { type: 'normal' }, { type: 'puzzle' },
    { type: 'conveyor' }, { type: 'normal' }, { type: 'special' }, { type: 'gauntlet' }, { type: 'boss' },
  ];
  const SPECIAL_ROT = ['protect', 'sunGoal', 'line', 'maxPlants', 'timeLimit', 'fewCards', 'noShredder'];

  function zombiePool(wi, li) {
    const out = [];
    for (const z of GVZ.Zombies.LIST) {
      if (z.id === 'mini') continue;
      const intro = ZINTRO[z.id];
      if (!intro) continue;
      const isWorldSpecific = z.w > 0;
      if (wi === 9) { if (intro.wi < 9 || intro.li <= li) out.push(z.id); continue; }
      if (isWorldSpecific) { if (intro.wi === wi && intro.li <= li) out.push(z.id); }
      else if (intro.wi < wi || (intro.wi === wi && intro.li <= li)) out.push(z.id);
    }
    return out;
  }
  /* Bygger bølger ud fra et budget af "zombiepoint" */
  function makeWaves(r, pool, nWaves, base, opts) {
    opts = opts || {};
    const waves = [];
    const ZB = GVZ.Zombies.BY;
    const focus = opts.focus;
    for (let k = 0; k < nWaves; k++) {
      const flag = (k + 1) % 5 === 0 || k === nWaves - 1;
      let budget = base * (0.55 + 0.95 * (k / Math.max(1, nWaves - 1))) * (flag ? 2.1 : 1);
      if (k === 0) budget = Math.max(1, base * 0.45);
      if (k === 0 && opts.wi != null) budget = Math.min(budget, 1.5 + opts.wi * 0.35);
      if (k === 1 && opts.wi != null) budget = Math.min(budget, 2.5 + opts.wi * 0.6);
      const list = [];
      if (flag) list.push('flag');
      let heavyCount = 0, guard = 0;
      if (focus && k >= 1 && ZB[focus].cost <= budget + 1) { list.push(focus); budget -= ZB[focus].cost; }
      while (budget > 0.5 && guard++ < 80) {
        const cands = pool.filter((id) => {
          const z = ZB[id];
          if (z.cost > budget + 0.5) return false;
          if (z.cost >= 7 && (k < 2 || heavyCount >= (flag ? 2 : 1))) return false;
          if (id === 'flag') return false;
          return true;
        });
        if (!cands.length) break;
        // vægtning: billige zombier oftere, nye zombier lidt oftere
        let tot = 0;
        const ws = cands.map((id) => { const w = (id === focus ? 2.2 : 1) / Math.sqrt(ZB[id].cost) * (id === 'shambler' ? 1.6 : 1); tot += w; return w; });
        let x = r() * tot, pick = cands[0];
        for (let i = 0; i < cands.length; i++) { x -= ws[i]; if (x <= 0) { pick = cands[i]; break; } }
        list.push(pick);
        budget -= ZB[pick].cost;
        if (ZB[pick].cost >= 7) heavyCount++;
      }
      if (!list.length || (list.length === 1 && list[0] === 'flag')) list.push('shambler');
      waves.push({ list, flag });
    }
    return waves;
  }
  function makeTiles(r, w, mech, rows, cols, li, boss) {
    const tiles = [];
    for (let y = 0; y < rows; y++) { tiles.push([]); for (let x = 0; x < cols; x++) tiles[y].push('grass'); }
    if (mech.includes('water')) for (let y = 0; y < rows; y++) for (let x = cols - 3; x < cols; x++) tiles[y][x] = 'water';
    if (mech.includes('rails')) {
      const railCols = li < 5 ? [3] : [2, 5];
      for (const c of railCols) for (let y = 0; y < rows; y++) tiles[y][c] = 'rail';
    }
    if (mech.includes('power')) {
      const n = 2 + Math.min(3, Math.floor(li / 4));
      for (let i = 0; i < n; i++) { const y = r.int(0, rows - 1), x = r.int(1, 5); if (tiles[y][x] === 'grass') tiles[y][x] = 'power'; }
    }
    if (mech.includes('ice')) {
      const n = li < 5 ? 1 : 2;
      const rowsPick = r.shuffle([0, 1, 2, 3, 4].slice(0, rows)).slice(0, n);
      for (const y of rowsPick) for (let x = 0; x < cols; x++) if (tiles[y][x] === 'grass') tiles[y][x] = 'ice';
    }
    if (mech.includes('bog')) {
      const n = 3 + Math.floor(li / 4);
      for (let i = 0; i < n; i++) { const y = r.int(0, rows - 1), x = r.int(2, cols - 1); if (tiles[y][x] === 'grass') tiles[y][x] = 'bog'; }
    }
    if (mech.includes('wrecks')) {
      const n = 2 + Math.floor(li / 5);
      for (let i = 0; i < n; i++) { const y = r.int(0, rows - 1), x = r.int(3, cols - 2); if (tiles[y][x] === 'grass') tiles[y][x] = 'wreck'; }
    }
    if (boss) for (let y = 0; y < rows; y++) tiles[y][cols - 1] = 'bossarea';
    return tiles;
  }
  function tombsFor(r, li, rows, cols, tiles) {
    const out = [];
    const n = 1 + Math.floor(li / 4);
    for (let i = 0; i < n; i++) {
      const y = r.int(0, rows - 1), x = r.int(5, cols - 1);
      if (tiles[y][x] !== 'grass') continue;
      if (out.some((o) => o.r === y && o.c === x)) continue;
      out.push({ r: y, c: x });
    }
    return out;
  }

  /* Plantes, der er låst op FØR bane (wi,li) - til gåde- og transportbånd-baner */
  function plantsUnlockedBefore(wi, li) {
    const out = ['kernekanon'];
    for (const id in PLANT_UNLOCK) { const u = PLANT_UNLOCK[id]; if (u.wi < wi || (u.wi === wi && u.li < li)) out.push(id); }
    return out;
  }

  function buildLevel(wi, li) {
    const w = WORLDS[wi];
    const r = U.rng(U.hashStr('gvz-' + wi + '-' + li));
    const tpl = TEMPLATE[li];
    const rows = 5, cols = 9;
    const isBoss = tpl.type === 'boss';
    const pool = zombiePool(wi, li);
    const focus = w.intro[li] && w.intro[li] !== 'flag' ? w.intro[li] : null;
    let nWaves = Math.min(10, 4 + Math.floor(li / 2.5) + (wi > 3 ? 1 : 0));
    if (tpl.type === 'gauntlet') nWaves += 1;
    // budget pr. bølge (sværhedskurve)
    let base = 1.3 + wi * 1.1 + li * 0.26 + Math.max(0, wi - 4) * 0.4;
    if (wi === 0) base = 1.1 + li * 0.3;
    if (tpl.type === 'gauntlet') base *= 1.06;
    if (tpl.type === 'puzzle') base *= 0.9;
    const lvl = {
      id: 'w' + wi + '-' + li, world: wi, idx: li, mode: 'adventure', type: tpl.type,
      name: w.name + ' ' + (li + 1), rows, cols,
      startSun: tpl.type === 'conveyor' ? 0 : 50 + (wi >= 5 ? 50 : 0) + (w.night ? 75 : 0),
      night: !!w.night, mech: w.mech.slice(), slots: wi === 0 ? Math.min(6, 3 + li) : wi < 3 ? 7 : 8,
      firstWave: wi === 0 && li < 2 ? 26 : wi === 0 ? 20 : 24, waves: null, lanes: null,
      objective: null, star3: null, plantsFixed: null, prePlaced: [], tombs: [], boss: null,
      reward: { coins: 70 + wi * 30 + li * 6, xp: 40 + wi * 18 + li * 3, gems: li === 4 || li === 9 ? 2 : 0, plant: w.unlock[li] || null },
      newZombie: focus, song: w.song,
    };
    if (wi === 0 && li === 0) { lvl.lanes = [2]; lvl.startSun = 150; lvl.plantsFixed = ['kernekanon']; nWaves = 4; base = 1; }
    if (wi === 0 && li === 1) { lvl.lanes = [1, 2, 3]; lvl.startSun = 100; }
    if (wi === 0 && li === 2) { lvl.startSun = 75; }
    // specialbaner
    if (tpl.type === 'special') {
      const kind = wi === 0 ? { 2: 'sunGoal', 6: 'protect', 12: 'line' }[li] : SPECIAL_ROT[(wi * 3 + li) % SPECIAL_ROT.length];
      lvl.objective = { type: kind };
      if (kind === 'protect') { lvl.objective.text = 'Beskyt de truede planter (markeret med ♥). Mister du én, taber du.'; lvl.protectN = 3; }
      if (kind === 'sunGoal') { lvl.objective.value = wi === 0 ? 800 : 1500 + wi * 300; lvl.objective.text = 'Saml ' + lvl.objective.value + ' sol i alt, før bølgerne er slut.'; }
      if (kind === 'line') { lvl.objective.value = 3; lvl.objective.text = 'Ingen zombie må krydse blomsterlinjen ved kolonne 4.'; lvl.firstWave = 28; lvl.startSun += 150; lvl.waveGap = 31; base *= 0.75; }
      if (kind === 'maxPlants') { lvl.objective.value = 12 + Math.floor(wi / 2); lvl.objective.text = 'Du må højst have ' + lvl.objective.value + ' planter på banen ad gangen.'; }
      if (kind === 'timeLimit') { lvl.objective.value = 170 + nWaves * 18; lvl.objective.text = 'Besejr alle zombier inden for ' + U.fmtTime(lvl.objective.value) + '.'; lvl.firstWave = 14; }
      if (kind === 'fewCards') { lvl.slots = 4; lvl.objective.text = 'Du har kun 4 plantekort. Vælg med omhu!'; }
      if (kind === 'noShredder') { lvl.noShredders = true; lvl.objective.text = 'Ingen kværnere - første zombie, der når huset, vinder.'; base *= 0.9; }
    }
    if (tpl.type === 'conveyor') {
      const avail = plantsUnlockedBefore(wi, li).filter((id) => id !== 'flydeblad' && id !== 'solspire' && id !== 'tvillinglys' && id !== 'maaneblomst' && id !== 'solkrukke' && id !== 'guldknop' && id !== 'urtetid' && id !== 'solspejl');
      const PB = GVZ.Plants.BY;
      const att = r.shuffle(avail.filter((id) => PB[id].cat === 'attack'));
      const picks = att.slice(0, 3);
      if (!picks.includes('kernekanon') && picks.length < 3) picks.push('kernekanon');
      for (const id of ['barkmur', 'stenrod', 'tomatbombe', 'knoldmine']) if (avail.includes(id) && picks.length < 6 && (id !== 'stenrod' || r() < 0.5)) picks.push(id);
      const rest = r.shuffle(avail.filter((id) => !picks.includes(id)));
      while (picks.length < 6 && rest.length) picks.push(rest.pop());
      if (att.length > 3) picks.push(att[3]);
      if (w.mech.includes('water')) picks.push('flydeblad');
      lvl.conveyor = picks;
      lvl.objective = lvl.objective || { type: 'conveyor', text: 'Transportbånd: planterne kommer af sig selv - ingen sol nødvendig.' };
      base *= 1.08;
    }
    if (tpl.type === 'puzzle') {
      const avail = plantsUnlockedBefore(wi, li).filter((id) => id !== 'flydeblad');
      const PB = GVZ.Plants.BY, of = (cat) => r.shuffle(avail.filter((id) => PB[id].cat === cat));
      const att = of('attack').sort((a, b) => PB[b].cost - PB[a].cost);
      const picks = [avail.includes('tvillinglys') && r() < 0.5 ? 'tvillinglys' : 'solspire'];
      picks.push(...att.slice(0, 2));
      const def = of('defense')[0]; if (def) picks.push(def);
      const rest = r.shuffle(avail.filter((id) => !picks.includes(id) && PB[id].cat !== 'resource'));
      if (rest[0]) picks.push(rest[0]);
      if (picks.length < 4 && !picks.includes('kernekanon')) picks.push('kernekanon');
      if (w.mech.includes('water') && !picks.includes('flydeblad')) picks.push('flydeblad');
      lvl.plantsFixed = picks;
      lvl.startSun = 150 + wi * 25;
      lvl.objective = { type: 'puzzle', text: 'Fast udvalg: du skal klare dig med de planter, banen giver dig.' };
    }
    if (isBoss) {
      lvl.boss = w.boss;
      lvl.startSun = 0;
      lvl.conveyorFromLoadout = true;
      lvl.slots = Math.max(lvl.slots, 7);
      lvl.objective = { type: 'boss', text: 'Besejr ' + GVZ.Zombies.BOSSES[w.boss].name + '! Bossbånd: dine valgte planter kommer på et transportbånd (ressourceplanter tæller ikke).' };
      lvl.reward.gems = 10 + wi * 2;
      lvl.reward.coins *= 2;
      lvl.reward.xp *= 2;
      nWaves = 0;
    }
    lvl.tiles = makeTiles(r, w, w.mech, rows, cols, li, isBoss);
    if (w.mech.includes('tombs')) lvl.tombs = tombsFor(r, li, rows, cols, lvl.tiles);
    if (lvl.objective && lvl.objective.type === 'protect') {
      const used = new Set();
      for (let i = 0; i < 3; i++) {
        let y, x, tries = 0;
        do { y = r.int(0, rows - 1); x = r.int(1, 3); tries++; } while ((used.has(y + ',' + x) || lvl.tiles[y][x] !== 'grass') && tries < 40);
        used.add(y + ',' + x);
        lvl.prePlaced.push({ id: r.pick(['solspire', 'kernekanon', 'barkmur']), r: y, c: x, protect: true });
      }
    }
    if (!isBoss) lvl.waves = makeWaves(r, pool, nWaves, base, { focus, wi });
    if (lvl.lanes) for (const wv of lvl.waves) wv.list = wv.list.filter((id) => id === 'shambler' || id === 'flag');
    // de første bølger på 'skrøbelige' specialbaner må ikke have hurtige eller snydende zombier
    if (lvl.waves && lvl.objective && ['line', 'noShredder', 'protect'].includes(lvl.objective.type)) {
      const ZB = GVZ.Zombies.BY;
      lvl.waves.slice(0, lvl.objective.type === 'line' ? 3 : 2).forEach((wv) => { wv.list = wv.list.map((id) => { const d = ZB[id]; return d && (d.speed >= 30 || d.ab.fly || d.ab.dig || d.ab.blast || d.ab.swingIn || d.ab.jump || d.ab.berserk || d.cost >= 4) ? (d.cost >= 4 ? 'pothead' : 'shambler') : id; }); });
      lvl.firstWave += 6; lvl.startSun += 100;
      // blomsterlinjen: ingen knusere/kæmper - de kan ikke holdes tilbage af vægge
      if (lvl.objective.type === 'line') lvl.waves.forEach((wv) => { wv.list = wv.list.map((id) => { const d = ZB[id]; return d && (d.ab.crush || d.ab.smash || d.ab.blast || d.ab.dig) ? (d.cost >= 7 ? 'kettle' : 'pothead') : id; }); });
    }
    // stjerne 3 - variationer
    const s3opts = [
      { type: 'noLoss', text: 'Mist ikke en eneste plante' },
      { type: 'spend', value: 1200 + wi * 250 + li * 40, text: 'Brug højst ' + (1200 + wi * 250 + li * 40) + ' sol' },
      { type: 'noPower', text: 'Brug hverken Plant Power eller evner' },
      { type: 'maxLost', value: 3, text: 'Mist højst 3 planter' },
      { type: 'time', value: 120 + nWaves * 25, text: 'Vind på under ' + U.fmtTime(120 + nWaves * 25) },
    ];
    lvl.star3 = isBoss ? { type: 'maxLost', value: 6, text: 'Mist højst 6 planter' } : tpl.type === 'conveyor' ? s3opts[3] : s3opts[(li + wi * 2) % s3opts.length];
    if (tpl.type === 'conveyor' && lvl.star3.type === 'spend') lvl.star3 = s3opts[3];
    lvl.pool = pool;
    lvl.zombiesPreview = isBoss ? GVZ.Zombies.BOSSES[w.boss].pool.slice() : Array.from(new Set(lvl.waves.flatMap((x) => x.list)));
    lvl.mechText = w.mechText;
    return lvl;
  }

  /* ---------------------------------------------------------------
     Andre spiltyper
     --------------------------------------------------------------- */
  function buildEndless(theme) {
    const wi = theme == null ? 0 : theme;
    const w = WORLDS[wi];
    const r = U.rng(Date.now() & 0xffffff);
    return {
      id: 'endless', world: wi, idx: 0, mode: 'endless', type: 'endless', name: 'Endless Survival - ' + w.name,
      rows: 5, cols: 9, startSun: 150, night: !!w.night, mech: w.mech.filter((m) => m !== 'collapse'), slots: 8, firstWave: 18,
      tiles: makeTiles(r, w, w.mech, 5, 9, 8, false), tombs: w.mech.includes('tombs') ? tombsFor(r, 4, 5, 9, makeTiles(r, w, [], 5, 9, 0, false)) : [],
      prePlaced: [], waves: [], endless: true, reward: { coins: 0, xp: 0, gems: 0 }, objective: { type: 'endless', text: 'Overlev så mange bølger som muligt. Hver 5. bølge er en stor bølge.' },
      star3: null, song: w.song, mechText: w.mechText, zombiesPreview: ['shambler', 'pothead', 'kettle', 'brute', 'giant'],
    };
  }
  /* Bølge n i Endless: puljen vokser med n */
  function endlessWave(n, worldIdx) {
    const r = U.rng(U.hashStr('end' + n + '-' + Math.random()));
    const all = GVZ.Zombies.LIST.filter((z) => z.id !== 'mini' && z.id !== 'flag').map((z) => z.id);
    const tierOf = (id) => { const i = ZINTRO[id]; return i ? i.wi * 15 + i.li : 0; };
    const limit = 8 + n * 7;
    const pool = all.filter((id) => tierOf(id) <= limit && (GVZ.Zombies.BY[id].w === 0 || GVZ.Zombies.BY[id].w === worldIdx + 1 || n > 12));
    const base = 2 + n * 1.25 + Math.pow(n, 1.35) * 0.25;
    return makeWaves(r, pool, 1, base * ((n + 1) % 5 === 0 ? 1 : 0.9))[0];
  }

  const MODS = {
    fast: { name: 'Speed-zombier', text: 'Alle zombier er 30% hurtigere.' },
    nosky: { name: 'Overskyet', text: 'Ingen sol falder fra himlen - du starter med 400 sol.' },
    armored: { name: 'Pansret horde', text: 'Alle almindelige zombier har urtepotte-hjelm.' },
    fewcards: { name: 'Minimalist', text: 'Kun 4 plantekort.' },
    conveyor: { name: 'Transportbånd', text: 'Planterne kommer på et transportbånd.' },
    bigwaves: { name: 'Stormbølger', text: 'Alle bølger er store bølger.' },
    noshred: { name: 'Uden kværnere', text: 'Ingen kværnere til at redde dig.' },
    tanky: { name: 'Seje zombier', text: 'Zombier har 40% mere liv - men du starter med ekstra sol.' },
    cheap: { name: 'Billige planter', text: 'Alle planter koster 25% mindre, men zombierne er flere.' },
    nopower: { name: 'Uden kræfter', text: 'Ingen Plant Power og ingen evner.' },
  };
  function applyMods(lvl, mods) {
    lvl.mods = mods.slice();
    if (mods.includes('nosky')) { lvl.noSky = true; lvl.startSun = 400; }
    if (mods.includes('fewcards')) lvl.slots = 4;
    if (mods.includes('noshred')) lvl.noShredders = true;
    if (mods.includes('tanky')) lvl.startSun += 150;
    if (mods.includes('conveyor')) {
      lvl.conveyor = ['kernekanon', 'pebberpuffer', 'barkmur', 'tomatbombe', 'isknop', 'knoldmine', 'bombebaer', 'grejsgab'].filter((id) => GVZ.Progress.owns(id));
      if (lvl.conveyor.length < 3) lvl.conveyor = ['kernekanon', 'barkmur', 'knoldmine'];
      lvl.startSun = 0;
    }
    if (mods.includes('bigwaves') && lvl.waves) lvl.waves.forEach((w) => { w.flag = true; w.list = w.list.concat(w.list.slice(0, Math.ceil(w.list.length / 2))); });
    if (mods.includes('cheap') && lvl.waves) lvl.waves.forEach((w) => { w.list = w.list.concat(w.list.slice(0, Math.ceil(w.list.length / 3))); });
    return lvl;
  }
  /* Basis-bane til udfordringer: genbruger generatoren med en given verden/sværhed */
  function challengeBase(id, wi, li, name) {
    const lvl = buildLevel(wi, Math.min(13, li));
    lvl.id = id; lvl.mode = 'challenge'; lvl.name = name;
    lvl.type = 'normal'; lvl.objective = null; lvl.plantsFixed = null; lvl.conveyor = null; lvl.prePlaced = [];
    lvl.boss = null; lvl.slots = 8;
    if (!lvl.waves || !lvl.waves.length) lvl.waves = makeWaves(U.rng(U.hashStr(id)), zombiePool(wi, li), 7, 2 + wi * 1.3 + li * 0.3);
    lvl.reward = { coins: 0, xp: 0, gems: 0 };
    return lvl;
  }
  function daily(dateKey) {
    const r = U.rng(U.hashStr('daily-' + dateKey));
    const maxW = Math.max(0, Math.min(9, GVZ.Progress.highestWorld()));
    const out = [];
    const modKeys = Object.keys(MODS);
    for (let i = 0; i < 3; i++) {
      const wi = r.int(0, maxW), li = r.int(3, 12);
      const mods = r.shuffle(modKeys.slice()).slice(0, i === 2 ? 2 : 1);
      const lvl = challengeBase('daily-' + dateKey + '-' + i, wi, li, ['Morgenudfordring', 'Middagsudfordring', 'Aftenudfordring'][i]);
      applyMods(lvl, mods);
      lvl.dailyKey = dateKey + '-' + i;
      lvl.reward = { coins: 250 + i * 150, xp: 120 + i * 60, gems: 2 + i * 2 };
      lvl.objective = { type: 'challenge', text: mods.map((m) => MODS[m].name + ': ' + MODS[m].text).join(' ') };
      out.push(lvl);
    }
    return out;
  }
  const SPECIALS = [
    { id: 'sp1', name: 'Ingen tab', text: 'Vind uden at miste en eneste plante.', wi: 0, li: 9, rule: 'noLoss', req: [0, 14], gems: 8 },
    { id: 'sp2', name: 'Tre kort', text: 'Kun 3 plantekort til hele banen.', wi: 1, li: 6, rule: 'cards3', req: [1, 5], gems: 8 },
    { id: 'sp3', name: 'Solsamleren', text: 'Saml 2500 sol, før zombierne er besejret.', wi: 1, li: 9, rule: 'sun2500', req: [1, 10], gems: 8 },
    { id: 'sp4', name: 'Lynkrig', text: 'Besejr alle zombier på under 3 minutter.', wi: 2, li: 7, rule: 'time180', req: [2, 7], gems: 10 },
    { id: 'sp5', name: 'Uden kræfter', text: 'Ingen Plant Power og ingen evner.', wi: 3, li: 9, rule: 'nopower', req: [3, 5], gems: 10 },
    { id: 'sp6', name: 'Nat-belejring', text: 'Ingen sol fra himlen, mørk nat og seje zombier.', wi: 5, li: 7, rule: 'nightTanky', req: [5, 5], gems: 12 },
    { id: 'sp7', name: 'Murmesteren', text: 'Kun ressource-, forsvars- og fældeplanter.', wi: 4, li: 8, rule: 'noAttack', req: [4, 10], gems: 12 },
    { id: 'sp8', name: 'Kæmpealarm', text: 'Bølger af Kæmper. Held og lykke.', wi: 6, li: 12, rule: 'giants', req: [6, 11], gems: 15 },
    { id: 'sp9', name: 'Båndkaos', text: 'Hurtigt transportbånd og hurtige zombier.', wi: 7, li: 10, rule: 'fastConveyor', req: [7, 5], gems: 15 },
    { id: 'sp10', name: 'Imperiets prøve', text: 'Stormbølger med zombier fra alle verdener.', wi: 9, li: 12, rule: 'imperial', req: [9, 5], gems: 20 },
  ];
  function buildSpecial(sp) {
    const lvl = challengeBase(sp.id, sp.wi, sp.li, sp.name);
    lvl.special = sp.id;
    lvl.reward = { coins: 400, xp: 200, gems: 0 };
    lvl.objective = { type: 'challenge', text: sp.text };
    switch (sp.rule) {
      case 'noLoss': lvl.rule = 'noLoss'; break;
      case 'cards3': lvl.slots = 3; break;
      case 'sun2500': lvl.objective = { type: 'sunGoal', value: 2500, text: sp.text }; break;
      case 'time180': lvl.objective = { type: 'timeLimit', value: 180, text: sp.text }; lvl.firstWave = 8; break;
      case 'nopower': applyMods(lvl, ['nopower']); break;
      case 'nightTanky': lvl.night = true; applyMods(lvl, ['nosky', 'tanky']); break;
      case 'noAttack': lvl.bannedCats = ['attack']; break;
      case 'giants': lvl.waves = lvl.waves.map((w, i) => ({ flag: w.flag, list: w.list.concat(i >= 2 ? ['giant'] : []).concat(i >= 5 ? ['giant'] : []) })); lvl.startSun += 200; break;
      case 'fastConveyor': applyMods(lvl, ['conveyor', 'fast']); lvl.conveyorFast = true; break;
      case 'imperial': applyMods(lvl, ['bigwaves']); lvl.waves.forEach((w) => w.list.push('imperial')); break;
    }
    return lvl;
  }
  const TREASURES = [
    { id: 'tr1', name: 'Guldregn i haven', text: 'Zombierne har lommerne fulde af mønter!', wi: 0, li: 8, req: [0, 5] },
    { id: 'tr2', name: 'Faraos skattekammer', text: 'Gravsten fulde af guld og ædelsten.', wi: 1, li: 8, req: [1, 14] },
    { id: 'tr3', name: 'Piratskatten', text: 'Kistefulde af frø og mønter.', wi: 2, li: 9, req: [2, 14] },
  ];
  function buildTreasure(tr) {
    const lvl = challengeBase(tr.id, tr.wi, tr.li, tr.name);
    lvl.treasure = true;
    lvl.treasureId = tr.id;
    lvl.reward = { coins: 500, xp: 150, gems: 3, seeds: 3 };
    lvl.objective = { type: 'treasure', text: tr.text + ' Alle zombier dropper mønter.' };
    return lvl;
  }

  /* ---------------------------------------------------------------
     Baggrundsmaling (cachet i offscreen-canvas)
     --------------------------------------------------------------- */
  function drawSky(ctx, w) {
    const g = ctx.createLinearGradient(0, 0, 0, LAYOUT.Y0 + 40);
    g.addColorStop(0, w.sky[0]); g.addColorStop(1, w.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, LAYOUT.Y0 + 40);
  }
  function hills(ctx, y, amp, col, seed, step) {
    const r = U.rng(seed);
    ctx.beginPath(); ctx.moveTo(0, LAYOUT.Y0 + 40);
    let x = 0;
    ctx.lineTo(0, y);
    while (x < W + 100) { const nx = x + (step || 140) * (0.6 + r() * 0.8); ctx.quadraticCurveTo((x + nx) / 2, y - amp * (0.4 + r()), nx, y + (r() - 0.5) * amp * 0.4); x = nx; }
    ctx.lineTo(W, LAYOUT.Y0 + 40); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  }
  const SCENERY = {
    grass(ctx, w) {
      hills(ctx, 110, 40, '#8fd47a', 3); hills(ctx, 128, 30, '#6fbf5a', 5);
      for (let i = 0; i < 9; i++) { const x = 300 + i * 120; A.circ(ctx, x, 104, 26, '#4f9e3a', 2); A.circ(ctx, x + 22, 112, 20, '#5aae44', 2); }
      // stakit
      ctx.fillStyle = '#f4ead2'; for (let x = 240; x < W; x += 22) { ctx.fillRect(x, 108, 12, 34); ctx.beginPath(); ctx.moveTo(x, 108); ctx.lineTo(x + 6, 100); ctx.lineTo(x + 12, 108); ctx.fill(); }
      ctx.fillRect(240, 116, W - 240, 6); ctx.fillRect(240, 132, W - 240, 5);
    },
    sand(ctx) {
      hills(ctx, 100, 50, '#f0c27a', 7, 220); hills(ctx, 124, 30, '#e2b066', 9, 180);
      ctx.fillStyle = '#d89a50'; ctx.beginPath(); ctx.moveTo(760, 120); ctx.lineTo(860, 20); ctx.lineTo(960, 120); ctx.fill();
      ctx.fillStyle = '#c4884a'; ctx.beginPath(); ctx.moveTo(860, 20); ctx.lineTo(960, 120); ctx.lineTo(900, 120); ctx.fill();
      for (let i = 0; i < 6; i++) { ctx.fillStyle = '#c9a26a'; ctx.fillRect(320 + i * 150, 96 - (i % 2) * 18, 26, 46 + (i % 2) * 18); ctx.fillStyle = '#b48c58'; ctx.fillRect(316 + i * 150, 92 - (i % 2) * 18, 34, 8); }
    },
    deck(ctx) {
      ctx.fillStyle = '#3a9ad6'; ctx.fillRect(0, 96, W, 60);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 97) % W, 104 + (i * 13) % 30, 30, 2);
      // skib i horisonten
      ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.moveTo(880, 98); ctx.lineTo(1100, 98); ctx.lineTo(1070, 120); ctx.lineTo(900, 120); ctx.fill();
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(980, 30, 6, 70); ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.moveTo(986, 34); ctx.quadraticCurveTo(1030, 60, 986, 92); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(986, 30, 26, 14);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = '#7a5a2a'; ctx.fillRect(300 + i * 140, 110, 10, 40); }
    },
    dust(ctx) {
      hills(ctx, 108, 26, '#e0a060', 11, 260);
      for (let i = 0; i < 3; i++) { const x = 380 + i * 300; ctx.fillStyle = '#b8703a'; ctx.beginPath(); ctx.moveTo(x, 130); ctx.lineTo(x + 20, 50 + i * 10); ctx.lineTo(x + 140, 50 + i * 10); ctx.lineTo(x + 160, 130); ctx.fill(); ctx.fillStyle = '#a05a2a'; ctx.fillRect(x + 20, 50 + i * 10, 120, 8); }
      // kaktus
      for (const x of [330, 760, 1180]) { ctx.fillStyle = '#4a8a3a'; U.roundRect(ctx, x, 70, 16, 70, 8); ctx.fill(); U.roundRect(ctx, x - 14, 90, 12, 26, 6); ctx.fill(); U.roundRect(ctx, x + 18, 84, 12, 30, 6); ctx.fill(); }
    },
    metal(ctx) {
      for (let i = 0; i < 14; i++) { const x = 250 + i * 76, h = 40 + ((i * 37) % 70); ctx.fillStyle = i % 2 ? '#2a1a5a' : '#3a2a6a'; ctx.fillRect(x, 140 - h, 60, h); ctx.fillStyle = i % 3 ? '#5ae0ff' : '#ff5ad6'; for (let y = 140 - h + 8; y < 136; y += 14) ctx.fillRect(x + 8, y, 10, 4), ctx.fillRect(x + 34, y, 10, 4); }
      ctx.strokeStyle = '#ff5ad6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(240, 132); ctx.lineTo(W, 132); ctx.stroke();
    },
    stone(ctx) {
      hills(ctx, 120, 20, '#1a1a3a', 13);
      ctx.fillStyle = '#2a2a48';
      ctx.fillRect(700, 30, 60, 110); ctx.fillRect(880, 50, 160, 90); ctx.fillRect(1040, 20, 50, 120);
      for (let x = 880; x < 1040; x += 20) ctx.fillRect(x, 40, 12, 12);
      ctx.beginPath(); ctx.moveTo(694, 30); ctx.lineTo(730, -6); ctx.lineTo(766, 30); ctx.fill();
      ctx.beginPath(); ctx.moveTo(1034, 20); ctx.lineTo(1065, -20); ctx.lineTo(1096, 20); ctx.fill();
      ctx.fillStyle = '#ffe680'; ctx.fillRect(720, 60, 10, 14); ctx.fillRect(1058, 50, 8, 12);
      ctx.fillStyle = '#f4f0d0'; ctx.beginPath(); ctx.arc(420, 50, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0a24'; ctx.beginPath(); ctx.arc(432, 44, 24, 0, Math.PI * 2); ctx.fill();
    },
    snow(ctx) {
      ctx.fillStyle = '#c8e0f4'; ctx.beginPath(); ctx.moveTo(250, 140); ctx.lineTo(420, 20); ctx.lineTo(560, 140); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(380, 48); ctx.lineTo(420, 20); ctx.lineTo(462, 50); ctx.lineTo(440, 60); ctx.lineTo(420, 50); ctx.lineTo(400, 62); ctx.fill();
      ctx.fillStyle = '#b0d0ec'; ctx.beginPath(); ctx.moveTo(620, 140); ctx.lineTo(860, 0); ctx.lineTo(1080, 140); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(800, 36); ctx.lineTo(860, 0); ctx.lineTo(920, 36); ctx.lineTo(880, 46); ctx.lineTo(860, 34); ctx.lineTo(830, 48); ctx.fill();
      for (let i = 0; i < 8; i++) { const x = 300 + i * 130; ctx.fillStyle = '#2a5a4a'; ctx.beginPath(); ctx.moveTo(x, 140); ctx.lineTo(x + 18, 86); ctx.lineTo(x + 36, 140); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 10, 110); ctx.lineTo(x + 18, 86); ctx.lineTo(x + 26, 110); ctx.fill(); }
    },
    asphalt(ctx) {
      for (let i = 0; i < 12; i++) { const x = 240 + i * 90, h = 60 + ((i * 53) % 80); ctx.fillStyle = i % 2 ? '#4a4f58' : '#5a5f68'; ctx.fillRect(x, 140 - h, 76, h); ctx.fillStyle = 'rgba(30,30,40,.6)'; for (let y = 140 - h + 10; y < 130; y += 18) for (let xx = x + 8; xx < x + 70; xx += 20) ctx.fillRect(xx, y, 10, 10); if (i % 3 === 0) { ctx.fillStyle = '#3a3f48'; ctx.beginPath(); ctx.moveTo(x + 76, 140 - h); ctx.lineTo(x + 50, 140 - h + 30); ctx.lineTo(x + 76, 140 - h + 40); ctx.fill(); } }
    },
    moss(ctx) {
      hills(ctx, 110, 40, '#2a6a3a', 17); hills(ctx, 126, 30, '#3a7a3a', 19);
      for (let i = 0; i < 10; i++) { const x = 260 + i * 110; ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, 140); ctx.quadraticCurveTo(x + 10, 80, x - 6, 40); ctx.stroke(); for (let j = 0; j < 4; j++) { ctx.fillStyle = j % 2 ? '#3a9a3a' : '#2a8a4a'; ctx.beginPath(); ctx.ellipse(x - 6 + (j - 1.5) * 18, 40 + Math.abs(j - 1.5) * 8, 30, 10, (j - 1.5) * 0.5, 0, Math.PI * 2); ctx.fill(); } }
      ctx.strokeStyle = '#4a8a2a'; ctx.lineWidth = 3; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(300 + i * 130, 0); ctx.quadraticCurveTo(320 + i * 130, 50, 296 + i * 130, 100); ctx.stroke(); }
    },
    empire(ctx) {
      hills(ctx, 118, 30, '#3a0a1a', 21);
      ctx.fillStyle = '#1a0a14';
      ctx.fillRect(640, 10, 300, 130); for (let x = 640; x < 940; x += 30) ctx.fillRect(x, 0, 18, 14);
      ctx.fillRect(600, -10, 50, 150); ctx.fillRect(930, -10, 50, 150);
      ctx.fillStyle = '#ff4d5a'; ctx.fillRect(770, 60, 40, 60); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(790, 40, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a1a2a'; for (let i = 0; i < 4; i++) { ctx.fillRect(670 + i * 70, 30, 24, 60); }
    },
  };
  function tilePaint(ctx, w, x, y, cw, ch, alt, seed) {
    const base = alt ? w.g1 : w.g2;
    ctx.fillStyle = base; ctx.fillRect(x, y, cw, ch);
    const r = U.rng(seed);
    const gnd = w.ground;
    if (gnd === 'grass' || gnd === 'moss') {
      ctx.strokeStyle = U.shade(base, -0.12); ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const gx = x + r() * cw, gy = y + 8 + r() * (ch - 10); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 2, gy - 7); ctx.moveTo(gx + 3, gy); ctx.lineTo(gx + 4, gy - 6); ctx.stroke(); }
      ctx.fillStyle = U.shade(base, 0.08); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(x + r() * cw, y + r() * ch, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); }
      if (gnd === 'grass' && r() < 0.3) { ctx.fillStyle = r() < 0.5 ? '#fff' : '#ffe14a'; ctx.beginPath(); ctx.arc(x + r() * cw, y + r() * ch, 2.5, 0, Math.PI * 2); ctx.fill(); }
    } else if (gnd === 'sand' || gnd === 'dust') {
      ctx.strokeStyle = U.shade(base, -0.08); ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { const yy = y + 14 + i * 26 + r() * 6; ctx.beginPath(); ctx.moveTo(x + 6, yy); ctx.quadraticCurveTo(x + cw / 2, yy - 6, x + cw - 6, yy); ctx.stroke(); }
      ctx.fillStyle = U.shade(base, -0.18); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + r() * cw, y + r() * ch, 1.5 + r() * 2, 0, Math.PI * 2); ctx.fill(); }
    } else if (gnd === 'deck') {
      ctx.strokeStyle = U.shade(base, -0.25); ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x, y + i * ch / 4); ctx.lineTo(x + cw, y + i * ch / 4); ctx.stroke(); }
      ctx.fillStyle = U.shade(base, -0.35); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 6 + (i % 2) * (cw - 12), y + 6 + Math.floor(i / 2) * (ch - 12), 2, 0, Math.PI * 2); ctx.fill(); }
    } else if (gnd === 'metal') {
      ctx.strokeStyle = U.shade(base, 0.15); ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, cw - 8, ch - 8);
      ctx.fillStyle = U.shade(base, 0.25); for (const [dx, dy] of [[10, 10], [cw - 10, 10], [10, ch - 10], [cw - 10, ch - 10]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = 'rgba(90,224,255,.15)'; ctx.beginPath(); ctx.moveTo(x + 4, y + ch / 2); ctx.lineTo(x + cw - 4, y + ch / 2); ctx.stroke();
    } else if (gnd === 'stone' || gnd === 'empire') {
      ctx.strokeStyle = U.shade(base, -0.25); ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, cw / 2 - 2, ch / 2 - 2); ctx.strokeRect(x + cw / 2 + 1, y + 2, cw / 2 - 3, ch / 2 - 2);
      ctx.strokeRect(x + 2, y + ch / 2 + 1, cw - 4, ch / 2 - 3);
      ctx.fillStyle = gnd === 'empire' ? 'rgba(255,77,90,.08)' : 'rgba(120,180,90,.15)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + r() * cw, y + r() * ch, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    } else if (gnd === 'snow') {
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(x + r() * cw, y + r() * ch, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(140,180,220,.25)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + r() * cw, y + r() * ch, 2, 0, Math.PI * 2); ctx.fill(); }
    } else if (gnd === 'asphalt') {
      ctx.fillStyle = U.shade(base, -0.15); for (let i = 0; i < 14; i++) ctx.fillRect(x + r() * cw, y + r() * ch, 2, 2);
      if (r() < 0.35) { ctx.strokeStyle = U.shade(base, -0.35); ctx.lineWidth = 1.5; ctx.beginPath(); let px = x + r() * cw, py = y + r() * ch; ctx.moveTo(px, py); for (let i = 0; i < 4; i++) { px += (r() - 0.5) * 30; py += (r() - 0.5) * 30; ctx.lineTo(px, py); } ctx.stroke(); }
    }
  }
  function house(ctx, w) {
    const X0 = LAYOUT.X0, Y0 = LAYOUT.Y0, HH = LAYOUT.CH * LAYOUT.ROWS;
    const themes = {
      grass: ['#f4e2c0', '#c8483a', '#7a4a2a'], sand: ['#e8c890', '#c08a3a', '#8a5a2a'], deck: ['#a87a4a', '#3a3a5a', '#5a3a1a'],
      dust: ['#c8905a', '#7a3a2a', '#5a3a1a'], metal: ['#4a5a7a', '#5ae0ff', '#2a3a5a'], stone: ['#5a5a6a', '#3a2a4a', '#2a2a34'],
      snow: ['#e0ecf8', '#5a8ac0', '#7a5a3a'], asphalt: ['#8a8a92', '#c0402a', '#4a4a52'], moss: ['#8a7a4a', '#3a7a3a', '#5a3a1a'], empire: ['#4a3a4a', '#ff4d5a', '#2a1a2a'],
    };
    const c = themes[w.ground] || themes.grass;
    // husvæg
    const g = ctx.createLinearGradient(0, 0, X0, 0); g.addColorStop(0, U.shade(c[0], -0.3)); g.addColorStop(1, c[0]);
    ctx.fillStyle = g; ctx.fillRect(0, 40, X0 - 60, H);
    ctx.fillStyle = U.shade(c[0], -0.15); for (let y = 60; y < H; y += 26) ctx.fillRect(0, y, X0 - 60, 3);
    ctx.fillStyle = c[1]; ctx.beginPath(); ctx.moveTo(-20, 50); ctx.lineTo(X0 - 30, 50); ctx.lineTo(X0 - 70, 0); ctx.lineTo(-20, 0); ctx.fill();
    // dør og vinduer
    ctx.fillStyle = c[2]; U.roundRect(ctx, 40, Y0 + HH / 2 - 60, 70, 120, 8); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(98, Y0 + HH / 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9ad8ff'; U.roundRect(ctx, 50, Y0 + 30, 56, 56, 6); ctx.fill(); U.roundRect(ctx, 50, Y0 + HH - 90, 56, 56, 6); ctx.fill();
    ctx.strokeStyle = c[2]; ctx.lineWidth = 5; ctx.strokeRect(50, Y0 + 30, 56, 56); ctx.strokeRect(50, Y0 + HH - 90, 56, 56);
    // terrasse/fortov
    const pg = ctx.createLinearGradient(X0 - 70, 0, X0, 0); pg.addColorStop(0, U.shade(w.dirt, -0.1)); pg.addColorStop(1, U.shade(w.dirt, 0.15));
    ctx.fillStyle = pg; ctx.fillRect(X0 - 70, Y0 - 6, 70, HH + 12);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; for (let y = Y0; y < Y0 + HH; y += 28) ctx.fillRect(X0 - 70, y, 70, 2);
  }
  function paintBackground(ctx, w, tiles) {
    const { X0, Y0, CW, CH } = LAYOUT;
    drawSky(ctx, w);
    // skyer (statiske, svage)
    if (!w.night && w.ground !== 'metal' && w.ground !== 'empire') {
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 4; i++) { const x = 320 + i * 260, y = 30 + (i % 2) * 20; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.arc(x + 22, y - 8, 22, 0, Math.PI * 2); ctx.arc(x + 46, y, 16, 0, Math.PI * 2); ctx.fill(); }
    }
    if (w.night) { ctx.fillStyle = '#fff'; const r = U.rng(5); for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.3 + r() * 0.7; ctx.fillRect(r() * W, r() * 120, 2, 2); } ctx.globalAlpha = 1; }
    (SCENERY[w.ground] || SCENERY.grass)(ctx, w);
    // jordkant
    ctx.fillStyle = w.dirt; ctx.fillRect(X0 - 10, Y0 - 10, W - X0 + 10, LAYOUT.ROWS * CH + 30);
    // felter
    const rows = tiles.length, cols = tiles[0].length;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = X0 + c * CW, y = Y0 + r * CH, t = tiles[r][c];
      tilePaint(ctx, w, x, y, CW, CH, (r + c) % 2 === 0, r * 31 + c * 7 + w.idx * 101);
      if (t === 'ice') { ctx.fillStyle = 'rgba(190,235,255,.75)'; ctx.fillRect(x, y, CW, CH); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, y + 20); ctx.lineTo(x + 40, y + 50); ctx.moveTo(x + 60, y + 30); ctx.lineTo(x + 90, y + 70); ctx.stroke(); }
      if (t === 'bog') { ctx.fillStyle = '#4a6a2a'; ctx.beginPath(); ctx.ellipse(x + CW / 2, y + CH / 2 + 6, CW * 0.46, CH * 0.38, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7ab83a'; ctx.beginPath(); ctx.ellipse(x + CW / 2, y + CH / 2 + 4, CW * 0.38, CH * 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
      if (t === 'rail') {
        ctx.fillStyle = '#6a4a2a'; for (let yy = y + 6; yy < y + CH; yy += 18) ctx.fillRect(x + 14, yy, CW - 28, 7);
        ctx.fillStyle = '#9aa0aa'; ctx.fillRect(x + 26, y, 6, CH); ctx.fillRect(x + CW - 32, y, 6, CH);
      }
      if (t === 'bossarea') { ctx.fillStyle = 'rgba(40,10,10,.35)'; ctx.fillRect(x, y, CW, CH); }
    }
    // rækkeskygger for dybde
    for (let r = 0; r < rows; r++) { ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(X0, Y0 + r * CH + CH - 6, cols * CW, 6); }
    // højre indgang
    const ex = X0 + cols * CW;
    const eg = ctx.createLinearGradient(ex, 0, W, 0); eg.addColorStop(0, U.shade(w.dirt, 0.05)); eg.addColorStop(1, U.shade(w.dirt, -0.25));
    ctx.fillStyle = eg; ctx.fillRect(ex, Y0 - 10, W - ex, rows * CH + 30);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 20; i++) ctx.fillRect(ex + 10 + (i * 37) % (W - ex - 20), Y0 + (i * 71) % (rows * CH), 8, 3);
    // forgrund nederst
    ctx.fillStyle = U.shade(w.g2, -0.35); ctx.fillRect(X0 - 10, Y0 + rows * CH + 4, W, 30);
    house(ctx, w);
  }
  const bgCache = new Map();
  function background(w, tiles, scale) {
    const key = w.key + '|' + JSON.stringify(tiles) + '|' + scale;
    if (bgCache.has(key)) return bgCache.get(key);
    const c = document.createElement('canvas');
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    paintBackground(ctx, w, tiles);
    if (bgCache.size > 6) bgCache.clear();
    bgCache.set(key, c);
    return c;
  }
  function thumb(wi, w, h) {
    const wd = WORLDS[wi];
    const tiles = makeTiles(U.rng(wi + 1), wd, wd.mech.filter((m) => m !== 'wrecks'), 5, 9, 6, false);
    const bg = background(wd, tiles, 0.5);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    // beskær til et udsnit med scenerie og græsplæne ("cover")
    const sx = 150 * 0.5, sw = bg.width - sx, sh = Math.min(bg.height, sw * (h / w));
    ctx.drawImage(bg, sx, 0, sw, sh, 0, 0, w, h);
    return c;
  }

  /* Vejr og animerede lag (tegnes hvert frame ovenpå) */
  function overlay(ctx, G, t, low, layer) {
    const w = WORLDS[G.level.world];
    const { X0, Y0, CW, CH } = LAYOUT;
    if (layer === 'weather') return weather(ctx, G, t, low, w);
    // vand og specialfelter
    for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
      const tt = G.tiles[r][c];
      const x = X0 + c * CW, y = Y0 + r * CH;
      if (tt === 'water') {
        const g = ctx.createLinearGradient(0, y, 0, y + CH); g.addColorStop(0, '#3ab0e8'); g.addColorStop(1, '#1a78b8');
        ctx.fillStyle = g; ctx.fillRect(x, y, CW, CH);
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const yy = y + 20 + i * 32 + Math.sin(t * 2 + i + c) * 3; ctx.beginPath(); ctx.moveTo(x + 10, yy); ctx.quadraticCurveTo(x + 30, yy - 6, x + 50, yy); ctx.quadraticCurveTo(x + 70, yy + 6, x + 90, yy); ctx.stroke(); }
      } else if (tt === 'power') {
        const a = 0.35 + Math.sin(t * 3 + c) * 0.15;
        ctx.fillStyle = 'rgba(90,224,255,' + a * 0.4 + ')'; ctx.fillRect(x + 4, y + 4, CW - 8, CH - 8);
        ctx.strokeStyle = 'rgba(140,240,255,' + (a + 0.3) + ')'; ctx.lineWidth = 3; ctx.strokeRect(x + 6, y + 6, CW - 12, CH - 12);
        A.star(ctx, x + CW / 2, y + CH - 18, 9, 4, 4, t, 'rgba(160,250,255,.9)', 0);
      } else if (tt === 'bog' && !low) {
        const bt = (t * 0.7 + c * 0.3 + r * 0.17) % 1;
        ctx.fillStyle = 'rgba(180,255,120,' + (1 - bt) * 0.7 + ')'; ctx.beginPath(); ctx.arc(x + CW / 2 + Math.sin(c * 7) * 18, y + CH / 2 + 10 - bt * 14, 3 + bt * 4, 0, Math.PI * 2); ctx.fill();
      } else if (tt === 'wreck') {
        drawWreck(ctx, x + CW / 2, y + CH - 14, c + r);
      } else if (tt === 'cracked') {
        ctx.strokeStyle = 'rgba(30,20,10,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 10, y + 20); ctx.lineTo(x + 40, y + 50); ctx.lineTo(x + 30, y + 80); ctx.moveTo(x + 40, y + 50); ctx.lineTo(x + 80, y + 40); ctx.lineTo(x + 92, y + 90); ctx.stroke();
        ctx.fillStyle = 'rgba(255,60,40,' + (0.2 + Math.sin(t * 10) * 0.15) + ')'; ctx.fillRect(x, y, CW, CH);
      } else if (tt === 'hole') {
        ctx.fillStyle = '#1a120a'; ctx.beginPath(); ctx.ellipse(x + CW / 2, y + CH / 2 + 6, CW * 0.45, CH * 0.36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 4; ctx.stroke();
      } else if (tt === 'vine') {
        ctx.strokeStyle = '#2a6a1a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 8 + i * 24, y + CH - 8); ctx.bezierCurveTo(x + 30 + i * 10, y + 20, x + 60 - i * 8, y + 70, x + 80 - i * 16, y + 10); ctx.stroke(); }
        ctx.lineCap = 'butt';
        for (let i = 0; i < 6; i++) A.leaf(ctx, x + 14 + i * 14, y + 20 + (i % 3) * 28, 16, 6, i, '#3a9a2a');
      }
    }
  }
  function weather(ctx, G, t, low, w) {
    if (G.level.night) {
      ctx.fillStyle = 'rgba(10,10,40,.32)'; ctx.fillRect(0, 0, W, H);
      if (!low) { for (let i = 0; i < 10; i++) { const x = (i * 211 + t * 20) % W, y = 200 + (i * 97) % 480; A.glow(ctx, x, y + Math.sin(t + i) * 10, 10, '#d8ff7a', 0.5 + Math.sin(t * 3 + i) * 0.3); } }
    }
    if (w.ground === 'snow' && !low) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 60; i++) { const x = (i * 97 + t * (20 + (i % 5) * 8)) % W, y = (i * 53 + t * (40 + (i % 7) * 6)) % H; ctx.globalAlpha = 0.5 + (i % 3) * 0.2; ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (w.ground === 'moss' && !low) {
      for (let i = 0; i < 12; i++) { const x = (i * 131 + t * 15) % W, y = 180 + (i * 61) % 500 + Math.sin(t * 1.5 + i) * 12; ctx.fillStyle = 'rgba(160,255,120,.5)'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    if (w.ground === 'metal' && !low) {
      ctx.fillStyle = 'rgba(90,224,255,.05)'; ctx.fillRect(0, (t * 120) % H, W, 3);
    }
    if (G.sandstorm > 0) {
      const a = Math.min(1, G.sandstorm) * 0.45;
      ctx.fillStyle = 'rgba(230,180,100,' + a + ')'; ctx.fillRect(0, 0, W, H);
      if (!low) { ctx.strokeStyle = 'rgba(255,230,180,' + a + ')'; ctx.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = (i * 71 - t * 600) % W, y = (i * 37) % H; ctx.beginPath(); ctx.moveTo(x + W, y); ctx.lineTo(x + W + 60, y + 4); ctx.stroke(); } }
    }
    if (G.blizzard > 0) {
      const a = Math.min(1, G.blizzard) * 0.4;
      ctx.fillStyle = 'rgba(220,240,255,' + a + ')'; ctx.fillRect(0, 0, W, H);
      if (!low) { ctx.strokeStyle = 'rgba(255,255,255,' + (a + 0.3) + ')'; ctx.lineWidth = 2; for (let i = 0; i < 50; i++) { const x = (i * 71 - t * 500) % W, y = (i * 37 + t * 100) % H; ctx.beginPath(); ctx.moveTo(x + W, y); ctx.lineTo(x + W + 30, y - 10); ctx.stroke(); } }
    }
    if (G.windT > 0 && !low) {
      ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.6, G.windT) + ')'; ctx.lineWidth = 2;
      for (let i = 0; i < 18; i++) { const x = ((i * 113 + t * 700) % (W + 200)) - 100, y = 160 + (i * 29) % 540; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 40, y - 8, x - 80, y); ctx.stroke(); }
    }
  }
  function drawWreck(ctx, x, y, seed) {
    const cols = ['#8a4a3a', '#4a6a8a', '#7a7a3a', '#5a5a6a'];
    const col = cols[seed % cols.length];
    ctx.save(); ctx.translate(x, y); ctx.rotate((seed % 3 - 1) * 0.08);
    A.shadow(ctx, 0, 2, 48, 8, 0.3);
    A.poly(ctx, [-44, 0, -42, -26, -16, -32, -4, -52, 30, -52, 40, -30, 46, -26, 46, 0], col, 3);
    ctx.fillStyle = 'rgba(40,40,50,.6)'; ctx.beginPath(); ctx.moveTo(-10, -32); ctx.lineTo(0, -48); ctx.lineTo(26, -48); ctx.lineTo(32, -32); ctx.fill();
    A.circ(ctx, -26, 0, 10, '#2a2a30', 3); A.circ(ctx, 28, 0, 10, '#2a2a30', 3);
    ctx.fillStyle = '#5a3a2a'; ctx.fillRect(-20, -22, 14, 6); ctx.fillRect(10, -18, 18, 5);
    ctx.restore();
  }

  return {
    WORLDS, LAYOUT, MODS, SPECIALS, TREASURES, ZINTRO, PLANT_UNLOCK,
    buildLevel, buildEndless, endlessWave, daily, buildSpecial, buildTreasure, applyMods,
    background, overlay, thumb, drawWreck, plantsUnlockedBefore,
  };
})();
