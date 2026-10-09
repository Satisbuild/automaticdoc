'use strict';
/* =====================================================================
   SUPER GREJS - characters.js
   De 10 figurer. Alle har PRÆCIS samme fysik og evner - forskellen er
   kun udseende, så ranglisten afgøres af spillerens evner.
   Figurerne tegnes som pixel-art ud fra parametre (hår, hat, tøj ...).
   ===================================================================== */
SG.characters = (function () {
  const A = SG.art;
  const U = SG.util;
  const OUT = A.OUT;

  const LIST = [
    {
      id: 'jones', name: 'Jones',
      desc: 'Selvsikker eventyrer med solbriller - også om natten. Siger altid "det har jeg styr på" lige før det går galt.',
      skin: '#f2c79a', hair: '#4a2a14', hairStyle: 'slick', face: ['sunglasses'],
      top: '#2f8f5a', topStyle: 'jacket', pants: '#2a3a6a', shoes: '#6a3a1a', accent: '#ffc93c',
    },
    {
      id: 'langvad', name: 'Langvad',
      desc: 'Højeste figur i GrejsAlley. Kan se over de fleste mure - men elsker stadig at hoppe over dem.',
      skin: '#ffd8b8', hair: '#ffd34a', hairStyle: 'ponytail', head: 'headband', headCol: '#ff4d5e',
      top: '#8a4ad0', topStyle: 'plain', pants: '#22223a', shoes: '#ffffff', body: 'tall', accent: '#ff4d5e',
    },
    {
      id: 'grejs', name: 'Grejs',
      desc: 'Hovedpersonen selv. Har opfundet halvdelen af GrejsAlleys maskiner og ødelagt den anden halvdel.',
      skin: '#f7c89a', hair: '#ff7a1a', hairStyle: 'spiky', top: '#ffffff', topStyle: 'logo', extra: 'scarf', extraCol: '#ff3a4a',
      pants: '#2f5fd0', shoes: '#ff4d5e', accent: '#ff7a1a',
    },
    {
      id: 'buss', name: 'Buss',
      desc: 'Tidligere buschauffør med et hjerte af guld og en mave af stål. Stopper aldrig - heller ikke ved stoppestederne.',
      skin: '#e0a878', hair: '#3a2a1a', hairStyle: 'bald', head: 'driver', headCol: '#2a4aa0', face: ['mustache'],
      top: '#3a5ac0', topStyle: 'tie', topCol2: '#ffc93c', pants: '#2a2a4a', shoes: '#1a1a24', body: 'wide', accent: '#ffc93c',
    },
    {
      id: 'joe', name: 'Joe',
      desc: 'Lytter til musik hele tiden og hopper i takt. Påstår, at alle fjender bevæger sig i 4/4.',
      skin: '#8a5a3a', hair: '#1a1010', hairStyle: 'afro', head: 'headphones', headCol: '#ff4d8a',
      top: '#1ac8b8', topStyle: 'plain', pants: '#3a3a5a', shoes: '#ffd34a', accent: '#ff4d8a',
    },
    {
      id: 'luske', name: 'Luske',
      desc: 'Ingen ved helt, hvor Luske kommer fra. Dukker op bag dig, før du når at sige "hvor er Luske?".',
      skin: '#e8c0a0', hair: '#2a2430', hairStyle: 'short', head: 'hood', headCol: '#4a4458', face: ['mask'],
      top: '#4a4458', topStyle: 'hoodie', pants: '#2a2a36', shoes: '#6a6a7a', accent: '#9aa2b4',
    },
    {
      id: 'muggel', name: 'Muggel',
      desc: 'Drømmer om at kunne trylle. Kan ikke. Hopper til gengæld helt fortryllende.',
      skin: '#ffd0b0', hair: '#d8d8e8', hairStyle: 'short', head: 'wizard', headCol: '#5a3ab0', face: ['beard'],
      top: '#4a2a9a', topStyle: 'robe', pants: '#4a2a9a', shoes: '#ffc93c', accent: '#ffd34a',
    },
    {
      id: 'jeppegobi', name: 'Jeppe Gobi',
      desc: 'Ørkenforsker, der har krydset Gobi tre gange - to af dem med vilje. Har altid en mellemmad i tasken.',
      skin: '#d89a68', hair: '#6a4a2a', hairStyle: 'short', head: 'safari', headCol: '#e0c88a', face: ['stubble'],
      top: '#b8a070', topStyle: 'pockets', extra: 'backpack', extraCol: '#7a5a3a', pants: '#8a7a5a', shoes: '#5a3a1a', accent: '#e0c88a',
    },
    {
      id: 'pollyl', name: 'Polly L',
      desc: 'Superskarp, superhurtig og supersur, hvis man glemmer L\'et. Ingen ved, hvad L står for.',
      skin: '#ffd8c0', hair: '#ff7ab8', hairStyle: 'bob', head: 'bow', headCol: '#ffd34a', face: ['freckles'],
      top: '#ffe14d', topStyle: 'dress', pants: '#ffe14d', shoes: '#ff4d8a', accent: '#ff7ab8',
    },
    {
      id: 'ossy', name: 'Ossy',
      desc: 'Hyggens mester med hue på hele året. Har et smil, der kan smelte isen i Frostfjeldet.',
      skin: '#f2c090', hair: '#8a4a2a', hairStyle: 'short', head: 'beanie', headCol: '#e03a3a', face: ['glasses'],
      top: '#2a8aff', topStyle: 'stripes', topCol2: '#ffffff', pants: '#3a3a3a', shoes: '#2a2a2a', accent: '#e03a3a',
    },
  ];
  const BY_ID = Object.fromEntries(LIST.map(c => [c.id, c]));

  /* ---------------- Poser ---------------- */
  // legs: [venstre dx, venstre løft, højre dx, højre løft], arms: 'down'|'fwd'|'back'|'up'|'out'|'both'
  const POSES = {
    idle0: { bob: 0, legs: [0, 0, 0, 0], arms: 'down' },
    idle1: { bob: 1, legs: [0, 0, 0, 0], arms: 'down' },
    run0: { bob: 0, legs: [-3, 0, 3, 2], arms: 'swingA' },
    run1: { bob: 1, legs: [-1, 1, 1, 0], arms: 'down' },
    run2: { bob: 0, legs: [3, 2, -3, 0], arms: 'swingB' },
    run3: { bob: 1, legs: [1, 0, -1, 1], arms: 'down' },
    jump: { bob: 0, legs: [-2, 0, 3, 4], arms: 'up' },
    fall: { bob: 0, legs: [-2, 2, 2, 2], arms: 'both' },
    land: { bob: 2, legs: [-2, 0, 2, 0], arms: 'out', squash: true },
    skid: { bob: 0, legs: [3, 0, -2, 1], arms: 'back', lean: -1 },
    duck: { bob: 0, legs: [0, 0, 0, 0], arms: 'down', duck: true },
    hurt: { bob: 0, legs: [-2, 1, 2, 1], arms: 'both', face: 'hurt' },
    dead: { bob: 0, legs: [-2, 0, 2, 0], arms: 'both', face: 'dead' },
    win0: { bob: 0, legs: [0, 0, 0, 0], arms: 'win', face: 'happy' },
    win1: { bob: -1, legs: [-1, 1, 1, 1], arms: 'win2', face: 'happy' },
  };
  const FRAMES = Object.keys(POSES);

  const FIRE_TOP = '#f4fbff', FIRE_PANTS = '#1aa8ff';

  /* ---------------- Tegning ---------------- */
  function draw(ch, poseName, big, fire) {
    const pose = POSES[poseName] || POSES.idle0;
    // Ekstra luft over hovedet til hatte. Renderer bundjusterer altid.
    const W = 32, H = big ? 64 : 36;
    const P = A.painter(W, H);
    const top = fire ? FIRE_TOP : ch.top;
    const pants = fire ? FIRE_PANTS : ch.pants;
    const wide = ch.body === 'wide' ? 2 : 0;
    const tall = ch.body === 'tall' ? 1 : 0;

    // Proportioner for lille/stor form
    let L;
    if (big) {
      L = { shoeH: 4, legH: 12 + tall * 2, torsoH: 17, headH: 17, headW: 16, torsoW: 14, armW: 4, armH: 14, legW: 5 };
    } else {
      L = { shoeH: 3, legH: 4 + tall, torsoH: 8, headH: 13, headW: 16, torsoW: 12, armW: 3, armH: 7, legW: 4 };
    }
    if (pose.duck && big) { L.legH = 3; L.torsoH = 12; }
    const bob = pose.bob || 0;
    const sq = pose.squash ? 1 : 0;

    const feetY = H - 1;
    const shoeY = feetY - L.shoeH + 1;
    const legY = shoeY - L.legH;
    const torsoY = legY - L.torsoH + bob + sq;
    const headY = torsoY - L.headH + 1 + (big ? 0 : 1);
    const cx = 16 + (pose.lean || 0);
    const torsoX = cx - L.torsoW / 2 - wide;
    const torsoW = L.torsoW + wide * 2;
    const headX = cx - L.headW / 2;

    // Rygsæk og kappe bag kroppen
    if (ch.extra === 'backpack') {
      P.r(torsoX - 4, torsoY + 1, 6, L.torsoH - 1, ch.extraCol);
      P.r(torsoX - 4, torsoY + 1, 6, 2, U.shade(ch.extraCol, 0.25));
    }

    // Ben og sko
    const legs = pose.legs;
    const legColor = ch.topStyle === 'robe' ? U.shade(pants, -0.2) : pants;
    const legX0 = cx - (big ? 6 : 5) - Math.floor(wide / 2), legX1 = cx + (big ? 1 : 1) + Math.floor(wide / 2);
    [[legX0 + legs[0], legs[1]], [legX1 + legs[2], legs[3]]].forEach(([lx, lift], i) => {
      const ly = legY - lift;
      P.r(lx, ly, L.legW, L.legH + 1, i === 0 ? U.shade(legColor, -0.18) : legColor);
      P.r(lx - (i === 0 ? 1 : 0), shoeY - lift, L.legW + 2, L.shoeH, i === 0 ? U.shade(ch.shoes, -0.15) : ch.shoes);
      P.r(lx - (i === 0 ? 1 : 0), shoeY - lift, L.legW + 2, 1, U.shade(ch.shoes, 0.35));
    });

    // Bagerste arm
    drawArm(P, pose, ch, top, torsoX - 1, torsoY, L, true, big);

    // Overkrop
    P.r(torsoX, torsoY, torsoW, L.torsoH, top);
    P.r(torsoX, torsoY, torsoW, 2, U.shade(top, 0.25));
    P.r(torsoX + torsoW - 2, torsoY + 2, 2, L.torsoH - 2, U.shade(top, -0.15));
    decorateTop(P, ch, top, torsoX, torsoY, torsoW, L, big, fire);

    // Hoved
    const skinD = U.shade(ch.skin, -0.18);
    P.r(headX + 1, headY, L.headW - 2, L.headH, ch.skin);
    P.r(headX, headY + 1, L.headW, L.headH - 3, ch.skin);
    P.r(headX + 1, headY + L.headH - 2, L.headW - 3, 1, skinD);
    // Øre
    P.r(headX + 3, headY + Math.floor(L.headH / 2), 3, 3, skinD);
    // Ansigt (kigger mod højre)
    drawFace(P, ch, pose, headX, headY, L, big);
    drawHair(P, ch, headX, headY, L, big);
    drawHead(P, ch, headX, headY, L, big);

    // Forreste arm
    drawArm(P, pose, ch, top, torsoX + torsoW - L.armW + 1, torsoY, L, false, big);

    if (ch.extra === 'scarf') {
      P.r(torsoX - 1, torsoY - 1, torsoW + 2, 3, ch.extraCol);
      P.r(torsoX - 4, torsoY + 1, 4, big ? 8 : 4, U.shade(ch.extraCol, -0.15));
    }

    P.outline(OUT);
    return P.c;
  }

  function drawArm(P, pose, ch, top, x, torsoY, L, back, big) {
    const col = back ? U.shade(top, -0.25) : top;
    const hand = back ? U.shade(ch.skin, -0.15) : ch.skin;
    const a = pose.arms;
    const ay = torsoY + 1;
    const len = L.armH;
    const w = L.armW;
    const hs = big ? 4 : 3;
    if (a === 'up' && !back || a === 'win' && !back) {
      P.r(x + 1, ay - len + 2, w, len, col);
      P.r(x + 1, ay - len - hs + 2, w, hs, hand);
    } else if (a === 'both' || a === 'win2') {
      P.r(x + (back ? -1 : 1), ay - len + 3, w, len, col);
      P.r(x + (back ? -1 : 1), ay - len + 3 - hs, w, hs, hand);
    } else if (a === 'out') {
      P.r(back ? x - len + 3 : x + 1, ay + 1, len, w, col);
      P.r(back ? x - len + 3 - hs : x + len + 1, ay + 1, hs, w, hand);
    } else if (a === 'swingA' || a === 'swingB') {
      const fwd = (a === 'swingA') !== back;
      const dx = fwd ? 3 : -3;
      P.r(x + dx, ay, w, len - 1, col);
      P.r(x + dx, ay + len - 1, w, hs, hand);
    } else if (a === 'back') {
      P.r(x - 3, ay, w, len - 1, col);
      P.r(x - 3, ay + len - 1, w, hs, hand);
    } else {
      P.r(x, ay, w, len, col);
      P.r(x, ay + len, w, hs - 1, hand);
    }
  }

  function decorateTop(P, ch, top, x, y, w, L, big, fire) {
    const h = L.torsoH;
    const s = ch.topStyle;
    const c2 = ch.topCol2 || '#ffffff';
    if (s === 'logo') {
      const cx = x + Math.floor(w / 2) + 1, cy = y + Math.floor(h / 2);
      const k = fire ? '#1aa8ff' : '#ff3a4a';
      if (big) { P.r(cx - 3, cy - 3, 6, 2, k); P.r(cx - 3, cy - 3, 2, 7, k); P.r(cx - 3, cy + 2, 6, 2, k); P.r(cx + 1, cy, 2, 4, k); P.r(cx, cy, 3, 1, k); }
      else { P.r(cx - 2, cy - 2, 4, 1, k); P.r(cx - 2, cy - 2, 1, 4, k); P.r(cx - 2, cy + 1, 4, 1, k); P.r(cx + 1, cy, 1, 2, k); }
    } else if (s === 'tie') {
      P.r(x + Math.floor(w / 2), y + 1, 2, h - 2, fire ? '#1aa8ff' : c2);
      P.r(x + Math.floor(w / 2) - 2, y, 6, 2, '#ffffff');
    } else if (s === 'stripes') {
      for (let yy = y + 2; yy < y + h; yy += 3) P.r(x, yy, w, 1, fire ? '#bfe6ff' : c2);
    } else if (s === 'jacket') {
      P.r(x + Math.floor(w / 2) + 1, y, 1, h, U.shade(top, -0.35));
      P.r(x + w - 4, y, 3, 3, U.shade(top, 0.4));
      P.r(x, y + h - 2, w, 2, U.shade(top, -0.3));
    } else if (s === 'hoodie') {
      P.r(x + 3, y + h - 4, w - 6, 3, U.shade(top, -0.2));
      P.r(x + Math.floor(w / 2) + 2, y + 1, 1, 3, '#e8e8f0');
    } else if (s === 'robe') {
      P.r(x - 1, y + h - 1, w + 2, big ? 9 : 3, top);
      P.r(x - 1, y + h + (big ? 7 : 1), w + 2, 1, '#ffd34a');
      P.p(x + 3, y + 3, '#ffd34a'); P.p(x + w - 4, y + h - 3, '#ffd34a');
    } else if (s === 'dress') {
      P.r(x - 2, y + h - 2, w + 4, big ? 8 : 3, top);
      P.r(x - 2, y + h + (big ? 5 : 0), w + 4, 1, U.shade(top, -0.25));
      P.r(x + 2, y + 2, w - 4, 1, '#ffffff');
    } else if (s === 'pockets') {
      P.r(x + 2, y + 3, 4, 3, U.shade(top, -0.2)); P.r(x + w - 6, y + 3, 4, 3, U.shade(top, -0.2));
      P.r(x, y + h - 2, w, 2, '#5a3a1a');
      P.r(x + Math.floor(w / 2), y + h - 2, 2, 2, '#ffc93c');
    }
  }

  function drawFace(P, ch, pose, hx, hy, L, big) {
    const face = pose.face || 'normal';
    const ex = hx + L.headW - (big ? 6 : 6);
    const ey = hy + (big ? 7 : 5);
    const feats = ch.face || [];
    if (face === 'dead') {
      P.r(ex - 1, ey, 3, 1, OUT); P.r(ex, ey - 1, 1, 3, OUT);
      P.r(ex - 6, ey, 3, 1, OUT); P.r(ex - 5, ey - 1, 1, 3, OUT);
      P.r(ex - 4, ey + 4, 4, 2, OUT);
      return;
    }
    if (face === 'hurt') {
      P.r(ex - 1, ey + 1, 3, 1, OUT);
    } else if (face === 'happy') {
      P.r(ex - 1, ey, 3, 1, OUT); P.p(ex - 2, ey + 1, OUT); P.p(ex + 2, ey + 1, OUT);
    } else {
      P.r(ex, ey - 1, 2, big ? 4 : 3, '#ffffff');
      P.r(ex + 1, ey, 1, big ? 3 : 2, OUT);
    }
    // Næse og mund
    P.r(hx + L.headW - 1, ey + 2, 2, 2, U.shade(ch.skin, -0.12));
    if (face === 'happy' || face === 'normal') P.r(ex - 1, ey + (big ? 6 : 5), 3, 1, U.shade(ch.skin, -0.45));
    if (face === 'hurt') P.r(ex - 1, ey + (big ? 6 : 5), 3, 2, OUT);

    feats.forEach(f => {
      if (f === 'sunglasses') {
        P.r(ex - 5, ey - 1, 9, big ? 4 : 3, '#14141e');
        P.r(ex - 4, ey - 1, 2, 1, '#6a8aff');
        P.r(hx + 4, ey, ex - hx - 8, 1, '#14141e');
      } else if (f === 'glasses') {
        P.r(ex - 2, ey - 2, 5, 1, OUT); P.r(ex - 2, ey + (big ? 3 : 2), 5, 1, OUT);
        P.r(ex - 2, ey - 2, 1, big ? 6 : 5, OUT); P.r(ex + 2, ey - 2, 1, big ? 6 : 5, OUT);
        P.r(hx + 4, ey - 1, ex - hx - 6, 1, OUT);
      } else if (f === 'mask') {
        P.r(hx + 2, ey - 2, L.headW - 1, big ? 5 : 4, '#1a1a24');
        P.r(ex, ey - 1, 2, 2, '#ffffff');
      } else if (f === 'mustache') {
        P.r(ex - 3, ey + (big ? 4 : 3), 7, 2, '#3a2a1a');
        P.r(ex - 4, ey + (big ? 5 : 4), 2, 1, '#3a2a1a');
      } else if (f === 'beard') {
        P.r(hx + 6, ey + 2, L.headW - 5, big ? 9 : 6, '#e8e8f0');
        P.r(hx + 8, ey + (big ? 10 : 7), L.headW - 10, 2, '#e8e8f0');
        P.r(ex - 2, ey + (big ? 5 : 4), 4, 1, U.shade(ch.skin, -0.45));
      } else if (f === 'stubble') {
        for (let i = 0; i < 6; i++) P.p(hx + 7 + i * 1.5, ey + (big ? 7 : 6) + (i % 2), U.shade(ch.skin, -0.35));
      } else if (f === 'freckles') {
        P.p(ex - 2, ey + 3, '#d07050'); P.p(ex, ey + 3, '#d07050'); P.p(ex + 2, ey + 3, '#d07050');
      }
    });
  }

  function drawHair(P, ch, hx, hy, L, big) {
    const c = ch.hair, d = U.shade(ch.hair, -0.25), l = U.shade(ch.hair, 0.3);
    const W = L.headW, Hh = L.headH;
    switch (ch.hairStyle) {
      case 'slick':
        P.r(hx, hy - 1, W - 2, 5, c); P.r(hx, hy - 1, 5, Hh - 5, c);
        P.r(hx + W - 6, hy - 2, 6, 3, c); P.r(hx + 6, hy, 8, 1, l);
        break;
      case 'spiky':
        P.r(hx, hy - 1, W, 5, c); P.r(hx, hy, 5, Hh - 6, c);
        for (let i = 0; i < 4; i++) P.poly([hx + i * 4, hy, hx + i * 4 + 5, hy, hx + i * 4 + 1, hy - 5 - (i % 2) * 2], c);
        P.poly([hx + W - 2, hy + 1, hx + W + 3, hy + 3, hx + W - 2, hy + 4], c);
        P.r(hx + 4, hy, 7, 1, l);
        break;
      case 'ponytail':
        P.r(hx, hy - 1, W - 2, 5, c); P.r(hx, hy, 4, Hh - 5, c);
        P.r(hx - 4, hy + 2, 5, big ? 13 : 8, c); P.r(hx - 5, hy + (big ? 11 : 7), 4, 4, d);
        P.r(hx + 5, hy, 6, 1, l);
        break;
      case 'afro':
        P.ell(hx + W / 2 - 1, hy + 2, W / 2 + 3, big ? 7 : 6, c);
        P.r(hx - 2, hy + 2, 6, Hh - 5, c);
        P.ell(hx + 4, hy - 1, 3, 2, l);
        break;
      case 'bob':
        P.r(hx - 1, hy - 1, W + 1, 5, c);
        P.r(hx - 1, hy, 5, Hh - 2, c);
        P.r(hx + W - 4, hy + 2, 4, 3, c);
        P.r(hx + 4, hy, 8, 1, l);
        P.r(hx - 1, hy + Hh - 3, 5, 1, d);
        break;
      case 'bald':
        P.r(hx + 4, hy + 1, 3, 1, U.shade(ch.skin, 0.45));
        break;
      default: // short
        P.r(hx, hy - 1, W - 1, 4, c); P.r(hx, hy, 4, Hh - 6, c);
        P.r(hx + 5, hy, 6, 1, l);
    }
  }

  function drawHead(P, ch, hx, hy, L, big) {
    const c = ch.headCol, d = c && U.shade(c, -0.3), l = c && U.shade(c, 0.35);
    const W = L.headW;
    switch (ch.head) {
      case 'headband':
        P.r(hx, hy + 3, W, 2, c);
        break;
      case 'driver':
        P.r(hx - 1, hy - 3, W + 1, 6, c); P.r(hx - 1, hy - 3, W + 1, 1, l);
        P.r(hx + 6, hy + 3, W - 2, 2, '#14141e');
        P.r(hx + 6, hy - 1, 4, 2, '#ffc93c');
        break;
      case 'headphones':
        P.r(hx - 1, hy - 3, W + 1, 2, '#2a2a36');
        P.r(hx + 4, hy + 4, 5, 6, c); P.r(hx + 5, hy + 5, 3, 4, l);
        break;
      case 'hood':
        P.r(hx - 2, hy - 2, W + 1, 5, c); P.r(hx - 2, hy - 2, 6, L.headH + 2, c);
        P.r(hx + W - 3, hy - 1, 2, L.headH - 3, d);
        break;
      case 'wizard':
        P.poly([hx - 2, hy + 2, hx + W + 2, hy + 2, hx + W / 2 - 4, hy - (big ? 14 : 10)], c);
        P.r(hx - 3, hy + 1, W + 6, 3, d);
        P.p(hx + 6, hy - 3, '#ffd34a'); P.p(hx + 10, hy - 1, '#ffd34a'); P.p(hx + 4, hy - 6, '#ffd34a');
        break;
      case 'safari':
        P.r(hx - 3, hy + 1, W + 6, 2, d);
        P.r(hx + 1, hy - 4, W - 2, 6, c); P.r(hx + 1, hy - 4, W - 2, 1, l);
        P.r(hx + 1, hy, W - 2, 1, '#6a4a2a');
        break;
      case 'bow':
        P.poly([hx + 2, hy - 4, hx + 7, hy, hx + 2, hy + 3], c);
        P.poly([hx + 12, hy - 4, hx + 7, hy, hx + 12, hy + 3], c);
        P.r(hx + 6, hy - 1, 3, 3, d);
        break;
      case 'beanie':
        P.r(hx - 1, hy - 3, W + 1, 7, c); P.r(hx - 1, hy + 2, W + 1, 2, l);
        P.circ(hx + W / 2, hy - 4, 2, '#ffffff');
        break;
      default:
    }
  }

  /* ---------------- Cache ---------------- */
  const cache = new Map();
  function frame(id, poseName, big, fire) {
    const key = `${id}|${poseName}|${big ? 1 : 0}|${fire ? 1 : 0}`;
    let s = cache.get(key);
    if (!s) {
      const ch = BY_ID[id] || BY_ID.grejs;
      const r = draw(ch, poseName, big, fire);
      s = { r, l: A.flipX(r) };
      cache.set(key, s);
    }
    return s;
  }

  // Portræt til menuer: tegner figuren (stor form) i et canvas.
  function portrait(canvas, id, poseName, opts) {
    opts = opts || {};
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    const s = frame(id, poseName || 'idle0', true, false).r;
    if (opts.bust) {
      // Hoved og skuldre
      const crop = 34, y0 = 4;
      const scale = Math.min(canvas.width / 32, canvas.height / crop);
      const w = 32 * scale, h = crop * scale;
      g.drawImage(s, 0, y0, 32, crop, (canvas.width - w) / 2, (canvas.height - h) / 2 + canvas.height * 0.06, w, h);
    } else {
      const scale = Math.min(canvas.width / 32, canvas.height / 66);
      const w = 32 * scale, h = 64 * scale;
      g.drawImage(s, (canvas.width - w) / 2, canvas.height - h - canvas.height * 0.03, w, h);
    }
  }

  return { LIST, BY_ID, FRAMES, POSES, frame, portrait, get: id => BY_ID[id] || BY_ID.grejs };
})();
