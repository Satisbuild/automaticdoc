'use strict';
/* =====================================================================
   SUPER GREJS - powerups.js
   Power-ups og spillerens former.
     Kraftfrugt          -> stor form (tåler et ekstra hit, knuser mursten)
     Energiblomst        -> energi-form (skyder energikugler)
     Stjernekerne        -> midlertidig uovervindelighed
     Ekstralivs-kapsel   -> +1 liv
   Et hit tager én form ad gangen: energi -> stor -> lille -> mister liv.
   ===================================================================== */
SG.powerups = (function () {
  const FORM = { SMALL: 0, BIG: 1, FIRE: 2 };

  const ITEMS = {
    fruit: { name: 'Kraftfrugt', speed: 62, gravity: true },
    flower: { name: 'Energiblomst', speed: 0, gravity: false },
    star: { name: 'Stjernekerne', speed: 84, gravity: true, bounce: 300 },
    life: { name: 'Ekstralivs-kapsel', speed: 72, gravity: true },
  };

  // Hvilken power-up en "P"-blok giver afhænger af spillerens form.
  function blockReward(content, player) {
    if (content === 'power') return player.form === FORM.SMALL ? 'fruit' : 'flower';
    if (content === 'star') return 'star';
    if (content === 'life') return 'life';
    return null;
  }

  function collect(game, player, kind) {
    const A = SG.audio;
    switch (kind) {
      case 'fruit':
        if (player.form === FORM.SMALL) { player.setForm(FORM.BIG, true); A.sfx('powerup'); }
        else A.sfx('powerup');
        game.toastHud('Kraftfrugt!');
        break;
      case 'flower':
        if (player.form !== FORM.FIRE) player.setForm(FORM.FIRE, true);
        A.sfx('flower');
        game.toastHud('Energiblomst! Tryk LØB for at skyde');
        break;
      case 'star':
        player.star = SG.physics.C.STAR_TIME;
        A.sfx('powerup');
        A.music.play('star');
        game.toastHud('Stjernekerne!');
        break;
      case 'life':
        game.addLife(1, player.x + player.w / 2, player.y);
        break;
    }
    game.burst(player.x + player.w / 2, player.y + player.h / 2, kind === 'star' ? '#ffe14d' : kind === 'flower' ? '#6ff3ff' : '#ff8a6a', 16);
    game.hudDirty = true;
  }

  // Tekst og ikon til HUD
  function hudLabel(player) {
    if (player.star > 0) return { cls: 'star', text: 'STJERNE' };
    if (player.form === FORM.FIRE) return { cls: 'flower', text: 'ENERGI' };
    if (player.form === FORM.BIG) return { cls: 'fruit', text: 'KRAFT' };
    return null;
  }

  return { FORM, ITEMS, blockReward, collect, hudLabel };
})();
