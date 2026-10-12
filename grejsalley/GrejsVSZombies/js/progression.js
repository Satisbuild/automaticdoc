'use strict';
/* =====================================================================
   GREJS VS ZOMBIES - progression.js
   Gemmesystem (LocalStorage, versioneret og fejlsikret), økonomi,
   XP/spillerniveau, plantesamling, opgraderinger, stjerner, medaljer,
   evner og belønninger.
   ===================================================================== */
GVZ.Progress = (function () {
  const U = GVZ.U;
  const KEY = 'gvz_save';
  const VERSION = 1;
  let S = null;

  function defaults() {
    return {
      v: VERSION, created: Date.now(), updated: Date.now(),
      coins: 150, gems: 5, xp: 0, plvl: 1,
      plants: { kernekanon: { lv: 1, seeds: 0 } },
      levels: {}, chests: {}, seenZ: {}, seenBoss: {},
      endless: { bestWave: 0, bestScore: 0, runs: 0 },
      daily: {}, specials: {}, treasure: {}, medals: {},
      loadout: [], lastLevel: null,
      stats: { kills: 0, planted: 0, sun: 0, wins: 0, bosses: 0, losses: 0, powers: 0, upgrades: 0, dailies: 0 },
      settings: { musicVol: 0.5, sfxVol: 0.8, mute: false, quality: 'high', dmgNumbers: true, autoSun: false, speed: 1 },
      tutorial: {},
    };
  }
  /* Sikker sammenfletning: ukendte/ugyldige felter erstattes af standardværdier */
  function sanitize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    const out = d;
    const num = (v, def, min) => (typeof v === 'number' && isFinite(v) ? Math.max(min == null ? 0 : min, v) : def);
    out.created = num(raw.created, d.created);
    out.coins = Math.floor(num(raw.coins, d.coins));
    out.gems = Math.floor(num(raw.gems, d.gems));
    out.xp = Math.floor(num(raw.xp, 0));
    out.plvl = Math.floor(num(raw.plvl, 1, 1));
    if (raw.plants && typeof raw.plants === 'object') {
      for (const id in raw.plants) {
        if (!GVZ.Plants.BY[id]) continue;
        const p = raw.plants[id] || {};
        out.plants[id] = { lv: U.clamp(Math.floor(num(p.lv, 1, 1)), 1, GVZ.Plants.MAX_LV), seeds: Math.floor(num(p.seeds, 0)) };
      }
    }
    if (!out.plants.kernekanon) out.plants.kernekanon = { lv: 1, seeds: 0 };
    for (const k of ['levels', 'chests', 'seenZ', 'seenBoss', 'daily', 'specials', 'treasure', 'medals', 'tutorial']) if (raw[k] && typeof raw[k] === 'object') out[k] = raw[k];
    if (raw.endless && typeof raw.endless === 'object') out.endless = Object.assign(d.endless, raw.endless);
    if (raw.stats && typeof raw.stats === 'object') for (const k in d.stats) out.stats[k] = num(raw.stats[k], 0);
    if (raw.settings && typeof raw.settings === 'object') out.settings = Object.assign(d.settings, raw.settings);
    if (Array.isArray(raw.loadout)) out.loadout = raw.loadout.filter((id) => GVZ.Plants.BY[id]);
    out.lastLevel = typeof raw.lastLevel === 'string' ? raw.lastLevel : null;
    return out;
  }
  function load() {
    let raw = null;
    try { const s = localStorage.getItem(KEY); if (s) raw = JSON.parse(s); } catch (e) { raw = null; }
    if (raw && raw.v > VERSION) raw = null; // ukendt fremtidig version
    S = sanitize(raw);
    return S;
  }
  let saveTimer = null;
  function save(now) {
    if (!S) return;
    S.updated = Date.now();
    const doit = () => { saveTimer = null; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* fx privat browsing */ } };
    if (now) { if (saveTimer) clearTimeout(saveTimer); doit(); }
    else if (!saveTimer) saveTimer = setTimeout(doit, 300);
  }
  function reset() { S = defaults(); save(true); }
  function exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
  function importSave(str) {
    try { const raw = JSON.parse(decodeURIComponent(escape(atob(str.trim())))); S = sanitize(raw); save(true); return true; } catch (e) { return false; }
  }
  window.addEventListener('pagehide', () => save(true));

  /* ---------------- Planter ---------------- */
  const owns = (id) => !!S.plants[id];
  const plantLv = (id) => (S.plants[id] ? S.plants[id].lv : 1);
  const seeds = (id) => (S.plants[id] ? S.plants[id].seeds : 0);
  function unlockPlant(id) { if (!S.plants[id] && GVZ.Plants.BY[id]) { S.plants[id] = { lv: 1, seeds: 0 }; save(); return true; } return false; }
  function addSeeds(id, n) { if (S.plants[id]) { S.plants[id].seeds += n; save(); } }
  const SEED_COST = [0, 10, 20, 35, 55, 80];
  const COIN_COST = [0, 200, 500, 1000, 2000, 3500];
  function upgradeCost(id) { const lv = plantLv(id); if (lv >= GVZ.Plants.MAX_LV) return null; return { seeds: SEED_COST[lv], coins: COIN_COST[lv] }; }
  function canUpgrade(id) { const c = upgradeCost(id); return !!(c && owns(id) && seeds(id) >= c.seeds && S.coins >= c.coins); }
  function upgrade(id) {
    if (!canUpgrade(id)) return false;
    const c = upgradeCost(id);
    S.plants[id].seeds -= c.seeds; S.coins -= c.coins; S.plants[id].lv++;
    S.stats.upgrades++;
    checkMedals();
    save(true);
    return true;
  }
  function ownedList() { return GVZ.Plants.LIST.filter((d) => owns(d.id)).map((d) => d.id); }

  /* ---------------- Baner og verdener ---------------- */
  const lkey = (wi, li) => 'w' + wi + '-' + li;
  const levelState = (wi, li) => S.levels[lkey(wi, li)] || null;
  function worldUnlocked(wi) { return wi === 0 || !!(S.levels[lkey(wi - 1, 14)] && S.levels[lkey(wi - 1, 14)].done); }
  function levelUnlocked(wi, li) { if (!worldUnlocked(wi)) return false; if (li === 0) return true; const p = levelState(wi, li - 1); return !!(p && p.done); }
  function worldStars(wi) { let s = 0; for (let i = 0; i < 15; i++) { const st = levelState(wi, i); if (st) s += st.stars || 0; } return s; }
  function totalStars() { let s = 0; for (let w = 0; w < 10; w++) s += worldStars(w); return s; }
  function levelsDone() { let n = 0; for (const k in S.levels) if (S.levels[k].done) n++; return n; }
  function highestWorld() { let h = 0; for (let w = 0; w < 10; w++) if (worldUnlocked(w)) h = w; return h; }
  function nextLevel() {
    for (let w = 0; w < 10; w++) {
      if (!worldUnlocked(w)) break;
      for (let l = 0; l < 15; l++) { const st = levelState(w, l); if (!st || !st.done) return { wi: w, li: l }; }
    }
    return { wi: 9, li: 14 };
  }
  const CHEST_AT = [15, 30, 45];
  function chestState(wi) { return S.chests['w' + wi] || [false, false, false]; }
  function claimChest(wi, i) {
    const st = chestState(wi).slice();
    if (st[i] || worldStars(wi) < CHEST_AT[i]) return null;
    st[i] = true; S.chests['w' + wi] = st;
    const rew = { gems: [5, 10, 20][i], coins: [300, 700, 1500][i] * (1 + wi * 0.3) | 0 };
    S.gems += rew.gems; S.coins += rew.coins;
    save(true);
    return rew;
  }

  /* ---------------- XP ---------------- */
  const xpNeed = (lvl) => 150 + (lvl - 1) * 90;
  function addXP(n) {
    S.xp += n;
    const ups = [];
    while (S.xp >= xpNeed(S.plvl)) { S.xp -= xpNeed(S.plvl); S.plvl++; S.gems += 2; S.coins += 100; ups.push(S.plvl); }
    return ups;
  }

  /* ---------------- Evner (power-ups) ---------------- */
  const ABILITIES = [
    { id: 'meteor', name: 'Meteorregn', icon: '☄', cd: 70, req: [0, 4], text: 'Tre meteorer rammer de tætteste zombieklumper (600 skade i område).' },
    { id: 'frost', name: 'Frostbølge', icon: '❄', cd: 60, req: [0, 9], text: 'Fryser alle zombier i 5 sek.' },
    { id: 'sunrain', name: 'Solregn', icon: '☀', cd: 75, req: [0, 14], text: 'Giver straks 200 sol.' },
    { id: 'rage', name: 'Planteraseri', icon: '⚡', cd: 80, req: [1, 4], text: 'Alle planter angriber dobbelt så hurtigt og gør +50% skade i 10 sek.' },
    { id: 'gust', name: 'Stormvind', icon: '🌀', cd: 65, req: [2, 4], text: 'Skubber alle zombier 2 felter tilbage.' },
  ];
  function abilityUnlocked(a) { const st = levelState(a.req[0], a.req[1]); return !!(st && st.done); }
  function abilities() { return ABILITIES.filter(abilityUnlocked); }

  /* ---------------- Medaljer ---------------- */
  const MEDALS = [
    { id: 'firstwin', name: 'Første sejr', text: 'Vind din første bane.', test: () => S.stats.wins >= 1, gems: 2 },
    { id: 'kills100', name: 'Havevogter', text: 'Besejr 100 zombier.', test: () => S.stats.kills >= 100, gems: 3 },
    { id: 'kills1000', name: 'Zombieknuser', text: 'Besejr 1.000 zombier.', test: () => S.stats.kills >= 1000, gems: 8 },
    { id: 'kills10000', name: 'Legende', text: 'Besejr 10.000 zombier.', test: () => S.stats.kills >= 10000, gems: 25 },
    { id: 'boss1', name: 'Kongemorder', text: 'Besejr din første boss.', test: () => S.stats.bosses >= 1, gems: 5 },
    { id: 'boss5', name: 'Bossjæger', text: 'Besejr 5 forskellige bosser.', test: () => Object.keys(S.seenBoss).filter((k) => S.seenBoss[k] === 2).length >= 5, gems: 10 },
    { id: 'boss10', name: 'Imperiets fald', text: 'Besejr Zombiekejseren.', test: () => S.seenBoss.kejser === 2, gems: 30 },
    { id: 'sun10k', name: 'Solkonge', text: 'Saml 10.000 sol i alt.', test: () => S.stats.sun >= 10000, gems: 5 },
    { id: 'sun100k', name: 'Solgud', text: 'Saml 100.000 sol i alt.', test: () => S.stats.sun >= 100000, gems: 15 },
    { id: 'maxplant', name: 'Mestergartner', text: 'Opgradér en plante til maks niveau.', test: () => Object.values(S.plants).some((p) => p.lv >= GVZ.Plants.MAX_LV), gems: 10 },
    { id: 'stars30', name: 'Stjernestøv', text: 'Saml 30 stjerner.', test: () => totalStars() >= 30, gems: 5 },
    { id: 'stars150', name: 'Stjernehimmel', text: 'Saml 150 stjerner.', test: () => totalStars() >= 150, gems: 15 },
    { id: 'stars450', name: 'Perfektionist', text: 'Saml alle 450 stjerner.', test: () => totalStars() >= 450, gems: 50 },
    { id: 'endless10', name: 'Udholdende', text: 'Overlev 10 bølger i Endless Survival.', test: () => S.endless.bestWave >= 10, gems: 5 },
    { id: 'endless30', name: 'Uovervindelig', text: 'Overlev 30 bølger i Endless Survival.', test: () => S.endless.bestWave >= 30, gems: 15 },
    { id: 'daily5', name: 'Trofast', text: 'Gennemfør 5 daglige udfordringer.', test: () => S.stats.dailies >= 5, gems: 8 },
    { id: 'collector', name: 'Samler', text: 'Lås op for alle 39 planter.', test: () => ownedList().length >= GVZ.Plants.LIST.length, gems: 20 },
    { id: 'power50', name: 'Plantekraft', text: 'Brug Plant Power 50 gange.', test: () => S.stats.powers >= 50, gems: 5 },
  ];
  function checkMedals() {
    const got = [];
    for (const m of MEDALS) if (!S.medals[m.id] && m.test()) { S.medals[m.id] = Date.now(); S.gems += m.gems; got.push(m); }
    return got;
  }

  /* ---------------- Bane afsluttet ---------------- */
  function seedRewards(n, rand, prefer) {
    const own = ownedList();
    const out = [];
    for (let i = 0; i < n; i++) {
      const id = prefer && i === 0 ? prefer : own[Math.floor(rand() * own.length)];
      const amt = 3 + Math.floor(rand() * 4) + Math.floor(S.plvl / 4);
      const ex = out.find((o) => o.id === id);
      if (ex) ex.n += amt; else out.push({ id, n: amt });
    }
    return out;
  }
  /* res: { won, stars:[b,b,b], coinsPicked, gemsPicked, kills, sun, lostPlants, waves, score } */
  function finishLevel(lvl, res) {
    const out = { coins: res.coinsPicked || 0, gems: res.gemsPicked || 0, xp: 0, seeds: [], newPlant: null, stars: 0, newStars: 0, levelUps: [], medals: [], chests: [] };
    S.stats.kills += res.kills || 0;
    S.stats.sun += res.sun || 0;
    S.stats.powers += res.powers || 0;
    const rand = Math.random;
    if (lvl.mode === 'endless') {
      S.endless.runs++;
      const nb = res.waves > S.endless.bestWave;
      S.endless.bestWave = Math.max(S.endless.bestWave, res.waves || 0);
      S.endless.bestScore = Math.max(S.endless.bestScore, res.score || 0);
      out.coins += 20 * (res.waves || 0);
      out.xp = 15 * (res.waves || 0);
      if ((res.waves || 0) >= 5) out.seeds = seedRewards(Math.min(4, Math.floor(res.waves / 5)), rand);
      out.newRecord = nb;
    } else if (res.won) {
      S.stats.wins++;
      const r = lvl.reward || {};
      if (lvl.mode === 'adventure') {
        const k = lkey(lvl.world, lvl.idx);
        const prev = S.levels[k] || { done: false, stars: 0, s: [false, false, false] };
        const first = !prev.done;
        const s = [0, 1, 2].map((i) => !!(prev.s && prev.s[i]) || !!res.stars[i]);
        const stars = s.filter(Boolean).length;
        out.stars = stars; out.newStars = stars - (prev.stars || 0); out.first = first;
        S.levels[k] = { done: true, stars, s, best: Math.max(prev.best || 0, res.score || 0) };
        const mul = first ? 1 : 0.4;
        out.coins += Math.round((r.coins || 0) * mul);
        out.xp = Math.round((r.xp || 0) * mul);
        out.gems += first ? r.gems || 0 : 0;
        out.gems += Math.max(0, out.newStars) * 1;
        out.seeds = seedRewards(first ? 2 : 1, rand, r.plant && first ? null : null);
        if (first && r.plant) { if (unlockPlant(r.plant)) out.newPlant = r.plant; }
        if (lvl.boss) { S.stats.bosses++; S.seenBoss[lvl.boss] = 2; }
        // stjernekister
        for (let i = 0; i < 3; i++) if (!chestState(lvl.world)[i] && worldStars(lvl.world) >= CHEST_AT[i]) out.chests.push(i);
      } else {
        out.coins += r.coins || 0; out.xp = r.xp || 0; out.gems += r.gems || 0;
        if (lvl.dailyKey && !S.daily[lvl.dailyKey]) { S.daily[lvl.dailyKey] = true; S.stats.dailies++; }
        else if (lvl.dailyKey) { out.coins = Math.round(out.coins * 0.3); out.gems = res.gemsPicked || 0; }
        if (lvl.special) {
          const sp = GVZ.Worlds.SPECIALS.find((x) => x.id === lvl.special);
          if (!S.specials[lvl.special]) { S.specials[lvl.special] = true; out.gems += sp ? sp.gems : 5; }
        }
        if (lvl.treasure) { S.treasure[lvl.treasureId] = U.dayKey(); out.seeds = seedRewards((r.seeds || 3) + 1, rand); }
        else out.seeds = seedRewards(1, rand);
      }
    } else {
      S.stats.losses++;
      out.coins = res.coinsPicked || 0;
      out.xp = Math.round((res.kills || 0) * 1.5);
    }
    S.coins += out.coins;
    S.gems += out.gems;
    for (const sd of out.seeds) addSeeds(sd.id, sd.n);
    out.levelUps = addXP(out.xp);
    out.medals = checkMedals();
    if (lvl.mode === 'adventure') S.lastLevel = lvl.id;
    save(true);
    return out;
  }
  function seeZombie(id) { if (!S.seenZ[id]) { S.seenZ[id] = true; save(); return true; } return false; }
  function seeBoss(id) { if (!S.seenBoss[id]) { S.seenBoss[id] = 1; save(); } }

  /* ---------------- Butik ---------------- */
  const SHOP = [
    { id: 'pack_small', name: 'Frøpose', text: '12 tilfældige frø til dine planter', coins: 300, seeds: 12 },
    { id: 'pack_big', name: 'Frøsæk', text: '40 tilfældige frø til dine planter', coins: 900, seeds: 40 },
    { id: 'pack_gem', name: 'Målrettet frøpakke', text: '25 frø til den valgte plante', gems: 6, seeds: 25, targeted: true },
    { id: 'coins_gem', name: 'Møntkiste', text: '1.000 mønter', gems: 8, coinsOut: 1000 },
  ];
  function buy(itemId, plantId) {
    const it = SHOP.find((s) => s.id === itemId);
    if (!it) return null;
    if (it.coins && S.coins < it.coins) return null;
    if (it.gems && S.gems < it.gems) return null;
    if (it.targeted && !owns(plantId)) return null;
    if (it.coins) S.coins -= it.coins;
    if (it.gems) S.gems -= it.gems;
    let got = [];
    if (it.coinsOut) { S.coins += it.coinsOut; }
    else if (it.targeted) { addSeeds(plantId, it.seeds); got = [{ id: plantId, n: it.seeds }]; }
    else {
      const own = ownedList();
      for (let i = 0; i < it.seeds; i++) { const id = U.pick(own); const ex = got.find((g) => g.id === id); if (ex) ex.n++; else got.push({ id, n: 1 }); }
      for (const g of got) addSeeds(g.id, g.n);
    }
    save(true);
    return got;
  }

  return {
    load, save, reset, exportSave, importSave, get S() { return S; },
    owns, plantLv, seeds, unlockPlant, addSeeds, upgradeCost, canUpgrade, upgrade, ownedList,
    levelState, levelUnlocked, worldUnlocked, worldStars, totalStars, levelsDone, highestWorld, nextLevel, chestState, claimChest, CHEST_AT,
    xpNeed, addXP, ABILITIES, abilities, abilityUnlocked, MEDALS, checkMedals, finishLevel, seeZombie, seeBoss, SHOP, buy, VERSION,
  };
})();
