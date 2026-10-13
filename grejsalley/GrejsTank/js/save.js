/* =====================================================================
 * GREJS TANKS - save.js
 * Robust localStorage save system with backup copy, validation,
 * corruption fallback and in-memory fallback when storage is blocked.
 * ===================================================================== */
(function () {
  'use strict';
  const GT = window.GT;
  const KEY = 'grejsTanksSave';
  const BACKUP_KEY = 'grejsTanksSave_backup';
  const VERSION = 1;
  const memStore = {}; // used when localStorage is unavailable
  let storageOK = true;

  function lsGet(k) {
    try {
      return window.localStorage.getItem(k);
    } catch (e) {
      storageOK = false;
      return memStore[k] || null;
    }
  }
  function lsSet(k, v) {
    try {
      window.localStorage.setItem(k, v);
    } catch (e) {
      storageOK = false;
      memStore[k] = v;
    }
  }
  function lsDel(k) {
    try {
      window.localStorage.removeItem(k);
    } catch (e) {
      delete memStore[k];
    }
  }

  const STARTER_TANKS = ['t_rookie', 't_pebble', 't_bruiser'];
  const STARTER_WEAPONS = ['shell', 'heavy_shell', 'triple'];

  const Save = (GT.Save = {
    KEY,
    data: null,
    get storageOK() {
      return storageOK;
    },

    defaults() {
      return {
        version: VERSION,
        createdAt: Date.now(),
        savedAt: 0,
        coins: 600,
        xp: 0,
        blueprints: 0,
        stars: {}, // levelId -> 0..3
        completed: {}, // levelId -> true
        bestTurns: {}, // levelId -> turns
        bosses: {}, // worldIndex -> true
        unlockedTanks: STARTER_TANKS.slice(),
        tankUpgrades: {}, // tankId -> {hp:0,...}
        tankXp: {}, // tankId -> xp
        unlockedWeapons: STARTER_WEAPONS.slice(),
        weaponLevels: {}, // weaponId -> level (1..5)
        abilityLevels: {}, // abilityId -> upgrade level (0..ABILITY_MAX), shared by all tanks with that ability
        loadout: ['heavy_shell', 'triple', null, null],
        selectedTank: 't_rookie',
        achievements: {}, // id -> {done:true, claimed:bool, t}
        seenEnemies: {},
        lastLevel: 'w1_l1',
        challenges: { date: '', list: [], completedTotal: 0 },
        bounties: { date: '', list: [] }, // daily: levelIds that pay coins again once
        stats: {
          battles: 0, wins: 0, losses: 0, kills: 0, damage: 0, shots: 0, crits: 0,
          bossKills: 0, perfectWins: 0, fewShotWins: 0, multiKills: 0, crates: 0,
          nukeWins: 0, longShots: 0, survivorWins: 0, upgradesBought: 0, maxUpgrade: 0,
          coinsEarned: 0, playTime: 0, abilityUses: 0
        },
        settings: {
          music: true, sound: true, musicVol: 0.45, sfxVol: 0.8,
          aimGuide: 'normal', shake: true, damageNumbers: true, quality: 'high', turnHints: true
        }
      };
    },

    /** Load from storage; falls back to backup, then defaults. Never throws. */
    load() {
      let data = null;
      const tryParse = (raw) => {
        if (!raw) return null;
        try {
          const d = JSON.parse(raw);
          return d && typeof d === 'object' ? d : null;
        } catch (e) {
          return null;
        }
      };
      data = tryParse(lsGet(KEY));
      if (!data) {
        data = tryParse(lsGet(BACKUP_KEY));
        if (data) console.warn('[Save] main save corrupt/missing, restored backup');
      }
      this.data = this.merge(this.defaults(), data || {});
      return this.data;
    },

    /** merge loaded data onto defaults, keeping only correctly-typed values */
    merge(def, src) {
      const out = def;
      for (const k in src) {
        if (!(k in def)) continue;
        const dv = def[k], sv = src[k];
        if (Array.isArray(dv)) {
          if (Array.isArray(sv)) out[k] = sv;
        } else if (dv && typeof dv === 'object') {
          if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
            // nested known-structure objects (stats/settings/challenges) merged key by key
            if (k === 'stats' || k === 'settings' || k === 'challenges') {
              for (const kk in sv) if (kk in dv && typeof sv[kk] === typeof dv[kk]) out[k][kk] = sv[kk];
            } else out[k] = sv;
          }
        } else if (typeof dv === typeof sv && !(typeof sv === 'number' && !isFinite(sv))) {
          out[k] = sv;
        }
      }
      return out;
    },

    /** Called after all game data is loaded: remove unknown ids etc. */
    validate() {
      const d = this.data;
      const tankExists = (id) => GT.Tanks && GT.Tanks.byId[id];
      const wpExists = (id) => GT.Weapons && GT.Weapons.byId[id];
      d.unlockedTanks = Array.from(new Set(d.unlockedTanks.filter(tankExists).concat(STARTER_TANKS)));
      d.unlockedWeapons = Array.from(new Set(d.unlockedWeapons.filter(wpExists).concat(STARTER_WEAPONS)));
      if (!d.unlockedTanks.includes(d.selectedTank)) d.selectedTank = d.unlockedTanks[0];
      if (!Array.isArray(d.loadout)) d.loadout = [null, null, null, null];
      d.loadout = [0, 1, 2, 3].map((i) => {
        const w = d.loadout[i];
        return w && d.unlockedWeapons.includes(w) && w !== 'shell' ? w : null;
      });
      d.coins = Math.max(0, Math.floor(d.coins || 0));
      if (!d.bounties || !Array.isArray(d.bounties.list)) d.bounties = { date: '', list: [] };
      d.xp = Math.max(0, Math.floor(d.xp || 0));
      d.blueprints = Math.max(0, Math.floor(d.blueprints || 0));
      for (const id in d.stars) {
        const s = d.stars[id];
        if (typeof s !== 'number' || s < 0 || s > 3) delete d.stars[id];
      }
      for (const id in d.tankUpgrades) {
        if (!tankExists(id) || typeof d.tankUpgrades[id] !== 'object') delete d.tankUpgrades[id];
      }
      if (!d.challenges || !Array.isArray(d.challenges.list)) d.challenges = { date: '', list: [], completedTotal: 0 };
      this.save();
    },

    save() {
      if (!this.data) return;
      try {
        this.data.savedAt = Date.now();
        const str = JSON.stringify(this.data);
        const prev = lsGet(KEY);
        if (prev) lsSet(BACKUP_KEY, prev); // keep last good save as backup
        lsSet(KEY, str);
      } catch (e) {
        console.warn('[Save] failed', e);
      }
      if (GT.Cloud) GT.Cloud.schedule();
    },

    reset() {
      lsDel(KEY);
      lsDel(BACKUP_KEY);
      this.data = this.defaults();
      this.validate();
    },

    exportString() {
      try {
        return btoa(unescape(encodeURIComponent(JSON.stringify(this.data))));
      } catch (e) {
        return '';
      }
    },
    importString(str) {
      try {
        const d = JSON.parse(decodeURIComponent(escape(atob(String(str).trim()))));
        if (!d || typeof d !== 'object' || !('coins' in d)) return false;
        this.data = this.merge(this.defaults(), d);
        this.validate();
        return true;
      } catch (e) {
        return false;
      }
    },

    /* ---------- convenience helpers ---------- */
    addCoins(n) {
      this.data.coins += Math.round(n);
      if (n > 0) this.data.stats.coinsEarned += Math.round(n);
    },
    spend(n) {
      if (this.data.coins < n) return false;
      this.data.coins -= n;
      return true;
    },
    /** XP needed to go from level L to L+1 */
    xpNeed(L) {
      return 80 + 25 * (L - 1);
    },
    levelInfo(xp) {
      xp = xp == null ? this.data.xp : xp;
      let L = 1, rest = xp;
      while (L < 99 && rest >= this.xpNeed(L)) {
        rest -= this.xpNeed(L);
        L++;
      }
      return { level: L, cur: rest, need: this.xpNeed(L) };
    },
    playerLevel() {
      return this.levelInfo().level;
    },
    totalStars() {
      let s = 0;
      for (const k in this.data.stars) s += this.data.stars[k] || 0;
      return s;
    },
    worldStars(w) {
      let s = 0;
      for (let i = 1; i <= 15; i++) s += this.data.stars['w' + w + '_l' + i] || 0;
      return s;
    },
    levelsCompleted() {
      return Object.keys(this.data.completed).length;
    },
    upgrades(tankId) {
      let u = this.data.tankUpgrades[tankId];
      if (!u) u = this.data.tankUpgrades[tankId] = {};
      for (const k of ['hp', 'armor', 'damage', 'power', 'reload', 'mobility', 'special']) if (typeof u[k] !== 'number') u[k] = 0;
      return u;
    },
    tankLevel(tankId) {
      const xp = this.data.tankXp[tankId] || 0;
      return Math.min(20, Math.floor(Math.sqrt(xp / 40)) + 1);
    },
    weaponLevel(id) {
      return this.data.weaponLevels[id] || 1;
    },
    abilityLevel(id) {
      const v = this.data.abilityLevels[id];
      return typeof v === 'number' && isFinite(v) ? v : 0;
    }
  });
})();

