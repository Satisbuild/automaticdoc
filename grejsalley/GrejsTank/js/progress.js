/* =====================================================================
 * GREJS TANKS - progress.js
 * Progression logic: rewards, stars, unlock conditions, achievements
 * (36) and locally generated daily challenges. Pure logic - no DOM.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const U = GT.U;

  /* ------------------------------------------------------------
   * Achievements: value(d) returns progress number, target = goal
   * ------------------------------------------------------------ */
  const ACH = [
    ['first_blood', 'First Blood', 'Win your first battle', '🩸', (d) => d.stats.wins, 1, 200],
    ['wins_10', 'Veteran', 'Win 10 battles', '🎖️', (d) => d.stats.wins, 10, 500],
    ['wins_50', 'Destroyer', 'Win 50 battles', '💀', (d) => d.stats.wins, 50, 2000],
    ['wins_150', 'Warlord', 'Win 150 battles', '👑', (d) => d.stats.wins, 150, 6000],
    ['kills_25', 'Tank Buster', 'Destroy 25 enemy tanks', '💥', (d) => d.stats.kills, 25, 600],
    ['kills_100', 'Scrap Maker', 'Destroy 100 enemy tanks', '🔩', (d) => d.stats.kills, 100, 2000],
    ['kills_400', 'Annihilator', 'Destroy 400 enemy tanks', '☠️', (d) => d.stats.kills, 400, 6000],
    ['boss_1', 'Boss Slayer', 'Defeat your first boss', '🐉', (d) => Object.keys(d.bosses).length, 1, 800],
    ['boss_5', 'Giant Killer', 'Defeat 5 bosses', '⚔️', (d) => Object.keys(d.bosses).length, 5, 3000],
    ['boss_10', 'Legend of Grejs', 'Defeat all 10 bosses', '🏆', (d) => Object.keys(d.bosses).length, 10, 10000],
    ['tanks_5', 'Small Fleet', 'Unlock 5 tanks', '🚜', (d) => d.unlockedTanks.length, 5, 400],
    ['tanks_10', 'Tank Collector', 'Unlock 10 tanks', '🛻', (d) => d.unlockedTanks.length, 10, 1000],
    ['tanks_25', 'Armored Division', 'Unlock 25 tanks', '🏭', (d) => d.unlockedTanks.length, 25, 3000],
    ['tanks_all', 'Complete Garage', 'Unlock every tank', '🌟', (d) => d.unlockedTanks.length, () => GT.Tanks.list.length, 15000],
    ['weapons_10', 'Armed & Ready', 'Unlock 10 weapons', '🔫', (d) => d.unlockedWeapons.length, 10, 800],
    ['weapons_20', 'Arsenal', 'Unlock 20 weapons', '🧨', (d) => d.unlockedWeapons.length, 20, 2500],
    ['weapons_all', 'Weapon Master', 'Unlock every weapon', '☢️', (d) => d.unlockedWeapons.length, () => GT.Weapons.list.length, 8000],
    ['perfect_shot', 'Perfect Shot', 'Win a battle using 2 shots or fewer', '🎯', (d) => d.stats.fewShotWins, 1, 700],
    ['untouchable', 'Untouchable', 'Win a battle without taking damage', '🛡️', (d) => d.stats.perfectWins, 1, 600],
    ['untouchable_10', 'Ghost', 'Win 10 battles without taking damage', '👻', (d) => d.stats.perfectWins, 10, 3000],
    ['stars_30', 'Rising Star', 'Collect 30 stars', '⭐', (d) => GT.Save.totalStars(), 30, 500],
    ['stars_120', 'Star Hunter', 'Collect 120 stars', '🌠', (d) => GT.Save.totalStars(), 120, 2000],
    ['stars_300', 'Constellation', 'Collect 300 stars', '✨', (d) => GT.Save.totalStars(), 300, 5000],
    ['stars_all', 'Superstar', 'Collect all 450 stars', '💫', (d) => GT.Save.totalStars(), 450, 20000],
    ['crits_10', 'Sharpshooter', 'Land 10 critical hits', '🔥', (d) => d.stats.crits, 10, 500],
    ['crits_100', 'Deadeye', 'Land 100 critical hits', '👁️', (d) => d.stats.crits, 100, 3000],
    ['dmg_10k', 'Heavy Hitter', 'Deal 10 000 total damage', '📈', (d) => d.stats.damage, 10000, 600],
    ['dmg_250k', 'Devastator', 'Deal 250 000 total damage', '🌋', (d) => d.stats.damage, 250000, 6000],
    ['upgrade_1', 'Mechanic', 'Buy your first upgrade', '🔧', (d) => d.stats.upgradesBought, 1, 150],
    ['upgrade_50', 'Chief Engineer', 'Buy 50 upgrades', '⚙️', (d) => d.stats.upgradesBought, 50, 3000],
    ['upgrade_max', 'Maxed Out', 'Max any upgrade to level 10', '🔝', (d) => d.stats.maxUpgrade, 10, 2500],
    ['multi_kill', 'Two Birds', 'Destroy 2 tanks with one shot', '🎳', (d) => d.stats.multiKills, 1, 1000],
    ['world_3', 'Explorer', 'Reach World 3', '🗺️', () => (GT.Worlds.isUnlocked(3) ? 1 : 0), 1, 1000],
    ['world_10', 'The Final War', 'Reach World 10', '⚔️', () => (GT.Worlds.isUnlocked(10) ? 1 : 0), 1, 8000],
    ['plevel_10', 'Commander', 'Reach player level 10', '🎖️', () => GT.Save.playerLevel(), 10, 1000],
    ['plevel_30', 'General', 'Reach player level 30', '🏅', () => GT.Save.playerLevel(), 30, 5000],
    ['challenge_1', 'Daily Duty', 'Complete a daily challenge', '📅', (d) => d.challenges.completedTotal, 1, 300],
    ['challenge_25', 'Dedicated', 'Complete 25 daily challenges', '📆', (d) => d.challenges.completedTotal, 25, 4000],
    ['nuke_win', 'Nuclear Option', 'Win a battle with a nuke', '☢️', (d) => d.stats.nukeWins, 1, 1500],
    ['long_shot', 'Long Shot', 'Hit a tank from over 1300 units away', '🔭', (d) => d.stats.longShots, 1, 800],
    ['survivor', 'Close Call', 'Win with less than 10% HP left', '😅', (d) => d.stats.survivorWins, 1, 600],
    ['crates_10', 'Crate Hunter', 'Shoot 10 supply crates', '📦', (d) => d.stats.crates, 10, 1000],
    ['rich', 'Money Bags', 'Hold 25 000 coins at once', '💰', (d) => d.coins, 25000, 2000]
  ].map(([id, name, desc, icon, value, target, reward]) => ({ id, name, desc, icon, value, target, reward }));

  /* ------------------------------------------------------------
   * Daily challenge templates
   * ------------------------------------------------------------ */
  const CH_TEMPLATES = [
    { type: 'kills', range: [3, 7], text: (c) => `Destroy ${c.n} enemy tanks` },
    { type: 'damage', range: [1500, 4000], step: 100, text: (c) => `Deal ${U.fmt(c.n)} damage` },
    { type: 'wins', range: [2, 4], text: (c) => `Win ${c.n} battles` },
    { type: 'fastwin', range: [3, 5], text: (c) => `Win a battle in ${c.n} turns or less`, single: true },
    { type: 'norockets', range: [1, 1], text: () => 'Win a battle without using rockets', single: true },
    { type: 'usetank', range: [1, 1], text: (c) => `Win a battle with ${GT.Tanks.get(c.tank).name}`, single: true },
    { type: 'crits', range: [3, 8], text: (c) => `Land ${c.n} critical hits` },
    { type: 'stars3', range: [1, 2], text: (c) => `Earn 3 stars on ${c.n} level${c.n > 1 ? 's' : ''}` },
    { type: 'abilities', range: [3, 6], text: (c) => `Use special abilities ${c.n} times` },
    { type: 'variety', range: [3, 4], text: (c) => `Use ${c.n} different weapons in one battle`, single: true },
    { type: 'noability', range: [1, 1], text: () => 'Win a battle without using your special ability', single: true },
    { type: 'boss', range: [1, 1], text: () => 'Defeat any boss (replays count)', single: true }
  ];

  const Progress = (GT.Progress = {
    ACH,

    /* ---------- unlock conditions ---------- */
    tankUnlockState(t) {
      const S = GT.Save, d = S.data;
      const unlocked = d.unlockedTanks.includes(t.id);
      const u = t.unlock;
      if (unlocked || !u) return { unlocked: true, met: true, text: 'Unlocked', cost: 0 };
      let met = false, text = '', cur = 0;
      switch (u.type) {
        case 'coins': met = true; text = 'Buy for ' + U.fmt(u.value) + ' coins'; break;
        case 'stars': cur = S.totalStars(); met = cur >= u.value; text = `Collect ${u.value} ★ (${cur}/${u.value})`; break;
        case 'boss': met = !!d.bosses[u.value]; text = 'Defeat the boss of World ' + u.value + ' (' + GT.Worlds.get(u.value).name + ')'; break;
        case 'levels': cur = S.levelsCompleted(); met = cur >= u.value; text = `Complete ${u.value} levels (${cur}/${u.value})`; break;
        case 'challenges': cur = d.challenges.completedTotal; met = cur >= u.value; text = `Complete ${u.value} daily challenges (${cur}/${u.value})`; break;
        case 'blueprints': cur = d.blueprints; met = cur >= u.value; text = `Spend ${u.value} blueprints (you have ${cur})`; break;
        case 'achievements': cur = this.achCount(); met = cur >= u.value; text = `Earn ${u.value} achievements (${cur}/${u.value})`; break;
        case 'plevel': cur = S.playerLevel(); met = cur >= u.value; text = `Reach player level ${u.value} (${cur}/${u.value})`; break;
      }
      const cost = u.type === 'coins' ? u.value : u.cost || 0;
      if (u.cost && u.type !== 'coins') text += ' + ' + U.fmt(u.cost) + ' coins';
      return { unlocked: false, met, text, cost, free: cost === 0 && u.type !== 'blueprints' };
    },

    /** try to unlock a tank (garage button). returns true on success */
    unlockTank(id) {
      const t = GT.Tanks.get(id);
      const st = this.tankUnlockState(t);
      const d = GT.Save.data;
      if (st.unlocked || !st.met) return false;
      if (st.cost > d.coins) return false;
      if (t.unlock.type === 'blueprints') d.blueprints -= t.unlock.value;
      d.coins -= st.cost;
      d.unlockedTanks.push(id);
      GT.Save.save();
      return true;
    },

    /** auto-unlock tanks with free conditions; returns list of new tanks */
    autoUnlockTanks() {
      const out = [];
      for (const t of GT.Tanks.list) {
        const st = this.tankUnlockState(t);
        if (!st.unlocked && st.met && st.free) {
          GT.Save.data.unlockedTanks.push(t.id);
          out.push(t);
        }
      }
      return out;
    },

    weaponState(w) {
      const d = GT.Save.data;
      if (d.unlockedWeapons.includes(w.id)) return { unlocked: true };
      const lvl = GT.Save.playerLevel();
      return { unlocked: false, met: lvl >= w.level, text: lvl >= w.level ? 'Buy for ' + U.fmt(w.price) + ' coins' : 'Requires player level ' + w.level, cost: w.price };
    },
    buyWeapon(id) {
      const w = GT.Weapons.get(id);
      const st = this.weaponState(w);
      if (st.unlocked || !st.met || GT.Save.data.coins < w.price) return false;
      GT.Save.data.coins -= w.price;
      GT.Save.data.unlockedWeapons.push(id);
      // auto-equip into a free loadout slot
      const lo = GT.Save.data.loadout;
      const free = lo.indexOf(null);
      if (free >= 0) lo[free] = id;
      GT.Save.save();
      return true;
    },

    /* ---------- achievements ---------- */
    achCount() {
      return Object.values(GT.Save.data.achievements).filter((a) => a && a.done).length;
    },
    achTarget(a) {
      return typeof a.target === 'function' ? a.target() : a.target;
    },
    /** check achievements, grant rewards; returns list of newly completed */
    checkAchievements() {
      const d = GT.Save.data;
      const out = [];
      for (const a of ACH) {
        if (d.achievements[a.id] && d.achievements[a.id].done) continue;
        let v = 0;
        try { v = a.value(d); } catch (e) { v = 0; }
        if (v >= this.achTarget(a)) {
          d.achievements[a.id] = { done: true, t: Date.now() };
          GT.Save.addCoins(a.reward);
          out.push(a);
        }
      }
      if (out.length) GT.Save.save();
      return out;
    },

    /* ---------- daily challenges ---------- */
    ensureChallenges() {
      const d = GT.Save.data;
      const key = U.todayKey();
      if (d.challenges.date === key && d.challenges.list.length) return d.challenges.list;
      const r = U.rng(U.hashStr('grejs' + key));
      const picks = r.shuffle(CH_TEMPLATES).slice(0, 3);
      const plv = GT.Save.playerLevel();
      d.challenges.date = key;
      d.challenges.list = picks.map((tpl, i) => {
        let n = r.int(tpl.range[0], tpl.range[1]);
        if (tpl.step) n = Math.round((n * (1 + plv * 0.06)) / tpl.step) * tpl.step;
        const c = { id: key + '_' + i, type: tpl.type, n, progress: 0, done: false, claimed: false, reward: 250 + i * 150 + plv * 15, bp: i === 2 ? 1 : 0 };
        if (tpl.type === 'usetank') c.tank = r.pick(d.unlockedTanks);
        if (tpl.type === 'boss' && !Object.keys(d.bosses).length) { c.type = 'wins'; c.n = 3; }
        return c;
      });
      GT.Save.save();
      return d.challenges.list;
    },
    /** coins paid for each star on a level (3 shares = 1.5x the base reward) */
    starShare(lv) {
      return Math.round((lv.rewards.coins * 0.5) / 5) * 5;
    },
    /** coins still to earn on a level from stars */
    coinsLeft(lv) {
      return Math.max(0, 3 - (GT.Save.data.stars[lv.id] || 0)) * this.starShare(lv);
    },

    /* ---------- daily bounties: 3 cleared levels that pay again today ---------- */
    ensureBounties() {
      const d = GT.Save.data;
      const key = U.todayKey();
      if (d.bounties.date === key && d.bounties.list.length) return d.bounties.list;
      const done = Object.keys(d.completed).filter((id) => /^w\d+_l\d+$/.test(id)).sort();
      d.bounties.date = key;
      d.bounties.list = [];
      if (!done.length) return d.bounties.list;
      const r = U.rng(U.hashStr('bounty' + key + done.length));
      d.bounties.list = r.shuffle(done).slice(0, 3).map((id, i) => {
        const [w, l] = id.slice(1).split('_l').map(Number);
        const lv = GT.Levels.get(w, l);
        return { id, w, l, reward: Math.round((lv.rewards.coins * (1 + i * 0.25)) / 10) * 10, claimed: false };
      });
      GT.Save.save();
      return d.bounties.list;
    },
    bountyFor(id) {
      return this.ensureBounties().find((b) => b.id === id && !b.claimed) || null;
    },
    challengeText(c) {
      const tpl = CH_TEMPLATES.find((t) => t.type === c.type) || CH_TEMPLATES[0];
      return tpl.text(c);
    },
    challengeTarget(c) {
      const tpl = CH_TEMPLATES.find((t) => t.type === c.type);
      return tpl && tpl.single ? 1 : c.n;
    },
    /** update challenges from a battle result */
    updateChallenges(res) {
      const list = this.ensureChallenges();
      const done = [];
      for (const c of list) {
        if (c.done) continue;
        let add = 0;
        switch (c.type) {
          case 'kills': add = res.kills; break;
          case 'damage': add = res.damage; break;
          case 'wins': add = res.win ? 1 : 0; break;
          case 'fastwin': add = res.win && res.turns <= c.n ? 1 : 0; break;
          case 'norockets': add = res.win && !res.usedCats.includes('rocket') ? 1 : 0; break;
          case 'usetank': add = res.win && res.tankId === c.tank ? 1 : 0; break;
          case 'crits': add = res.crits; break;
          case 'stars3': add = res.stars === 3 ? 1 : 0; break;
          case 'abilities': add = res.abilityUses; break;
          case 'variety': add = res.usedWeapons.length >= c.n ? 1 : 0; break;
          case 'noability': add = res.win && res.abilityUses === 0 ? 1 : 0; break;
          case 'boss': add = res.win && res.isBoss ? 1 : 0; break;
        }
        c.progress = Math.min(this.challengeTarget(c), c.progress + add);
        if (c.progress >= this.challengeTarget(c)) {
          c.done = true;
          done.push(c);
        }
      }
      return done;
    },
    claimChallenge(c) {
      if (!c.done || c.claimed) return false;
      c.claimed = true;
      GT.Save.addCoins(c.reward);
      GT.Save.data.blueprints += c.bp || 0;
      GT.Save.data.challenges.completedTotal++;
      GT.Save.save();
      return true;
    },

    /* ---------- battle end: rewards & bookkeeping ---------- */
    /**
     * res: {win, level, tankId, turns, kills, damage, damageTaken, crits,
     *       hpPct, usedCats[], usedWeapons[], abilityUses, crates,
     *       multiKills, longShot, nukeKill, shots, coinsFound, bpFound}
     * returns reward summary for victory/defeat screens
     */
    finishBattle(res) {
      const S = GT.Save, d = S.data, lv = res.level;
      const st = d.stats;
      const levelBefore = S.playerLevel();
      st.battles++;
      st.kills += res.kills;
      st.damage += Math.round(res.damage);
      st.crits += res.crits;
      st.shots += res.shots;
      st.crates += res.crates;
      st.multiKills += res.multiKills;
      st.abilityUses += res.abilityUses;
      if (res.longShot) st.longShots++;
      for (const e of res.enemiesSeen || []) d.seenEnemies[e] = true;

      const out = { coins: 0, xp: 0, stars: 0, starFlags: [false, false, false], bonuses: [], unlocks: [], achievements: [], challenges: [], blueprints: 0, levelUp: null, firstClear: false, newBest: false };

      if (res.win) {
        st.wins++;
        const first = !d.completed[lv.id];
        out.firstClear = first;
        // stars: 1 = win, 2 = hp >= 50%, 3 = turns <= par
        out.starFlags = [true, res.hpPct >= 0.5, res.turns <= lv.par];
        out.stars = out.starFlags.filter(Boolean).length;
        const prevStars = d.stars[lv.id] || 0;
        if (out.stars > prevStars) d.stars[lv.id] = out.stars;
        d.completed[lv.id] = true;
        if (!d.bestTurns[lv.id] || res.turns < d.bestTurns[lv.id]) {
          out.newBest = !!d.bestTurns[lv.id];
          d.bestTurns[lv.id] = res.turns;
        }
        // coins are only paid for NEW stars: each level has 3 star-shares of
        // coins. Once a level has 3 stars it pays nothing more (bounties aside).
        const newStars = Math.max(0, out.stars - prevStars);
        const share = GT.Progress.starShare(lv);
        const paid = newStars > 0;
        out.newStars = newStars;
        out.maxedBefore = prevStars >= 3;
        out.coinsLeft = Math.max(0, 3 - Math.max(out.stars, prevStars)) * share;
        let coins = newStars * share;
        let xp = lv.rewards.xp * (first ? 1 : 0.6);
        if (res.damageTaken <= 0) st.perfectWins++;
        if (paid) {
          out.bonuses.push({ name: newStars === 1 ? 'New star' : newStars + ' new stars', coins: Math.round(coins) });
          // bonuses only count on runs that earn new stars
          if (res.damageTaken <= 0) {
            const b = Math.round(coins * 0.3);
            out.bonuses.push({ name: 'Untouchable - no damage', coins: b });
            coins += b;
          }
          if (res.turns <= lv.par) {
            const b = Math.round(coins * 0.2);
            out.bonuses.push({ name: 'Quick victory', coins: b });
            coins += b;
          }
          if (res.crits) {
            const b = res.crits * 25;
            out.bonuses.push({ name: 'Critical hits x' + res.crits, coins: b });
            coins += b;
          }
          if (res.multiKills) {
            const b = res.multiKills * 120;
            out.bonuses.push({ name: 'Multi-kill x' + res.multiKills, coins: b });
            coins += b;
          }
          if (res.coinsFound) {
            out.bonuses.push({ name: 'Supply crates', coins: res.coinsFound });
            coins += res.coinsFound;
          }
        }
        // daily bounty: pays once per day on a win, even on 3-star levels
        const bounty = this.ensureBounties().find((b) => b.id === lv.id && !b.claimed);
        if (bounty) {
          bounty.claimed = true;
          out.bounty = bounty.reward;
          out.bonuses.push({ name: '💰 Bounty collected', coins: bounty.reward });
          coins += bounty.reward;
        }
        if (res.shots <= 2) st.fewShotWins++;
        if (res.hpPct < 0.1) st.survivorWins++;
        if (res.nukeKill) st.nukeWins++;
        if (lv.isBoss) {
          if (!d.bosses[lv.world]) {
            out.blueprints += 2;
            out.unlocks.push({ kind: 'world', text: lv.world < GT.Worlds.count ? 'Path to ' + GT.Worlds.get(lv.world + 1).name + ' opened!' : 'You conquered Grejs World!' });
          }
          d.bosses[lv.world] = true;
          st.bossKills++;
        } else if (lv.world >= 2 && Math.random() < (first ? 0.3 : 0.1)) out.blueprints += 1;
        out.coins = Math.round(coins);
        out.xp = Math.round(xp);
      } else {
        st.losses++;
        // consolation: small coins for damage dealt, never lose progress
        // (nothing on levels that already have 3 stars)
        if ((d.stars[lv.id] || 0) < 3) out.coins = Math.round(Math.min(lv.rewards.coins * 0.25, res.damage * 0.1) + (res.coinsFound || 0));
        out.xp = Math.round(lv.rewards.xp * 0.15);
      }
      out.blueprints += res.bpFound || 0;
      S.addCoins(out.coins);
      d.xp += out.xp;
      d.blueprints += out.blueprints;
      d.tankXp[res.tankId] = (d.tankXp[res.tankId] || 0) + out.xp;
      d.lastLevel = lv.id;

      const levelAfter = S.playerLevel();
      if (levelAfter > levelBefore) {
        out.levelUp = levelAfter;
        for (const w of GT.Weapons.list) if (w.level > levelBefore && w.level <= levelAfter) out.unlocks.push({ kind: 'weapon', text: 'New weapon available: ' + w.icon + ' ' + w.name });
      }
      // challenges
      out.challenges = this.updateChallenges(Object.assign({ isBoss: lv.isBoss, stars: out.stars }, res));
      // tanks with free conditions
      for (const t of this.autoUnlockTanks()) out.unlocks.push({ kind: 'tank', id: t.id, text: 'New tank unlocked: ' + t.name });
      out.achievements = this.checkAchievements();
      S.save();
      return out;
    }
  });
})();

