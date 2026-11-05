// Spillerliste og færdige skabeloner. Angrebet spiller mod målet ved x = 40; y = 0 er angribernes venstre side.
(function (root) {
  'use strict';
  const G = root.GHB;

  const ATTACK_SPOTS = {
    LW: [36.8, 1.3, 'Venstre fløj'], LB: [29.6, 4.8, 'Venstre back'], CB: [27.6, 10, 'Playmaker / center back'],
    RB: [29.6, 15.2, 'Højre back'], RW: [36.8, 18.7, 'Højre fløj'], PV: [33.3, 10, 'Stregspiller'],
  };
  const DEFENSE_SPOTS = {
    VF: [34.4, 4.7, 'Venstre forsvar'], MF: [33.1, 8.6, 'Midterforsvar'], HF: [34.4, 15.3, 'Højre forsvar'], F1: [28.8, 11, 'Fremskudt forsvarer'],
  };
  const GK_SPOT = [38.9, 10, 'Målmand'];

  const PALETTE = {
    attack: Object.keys(ATTACK_SPOTS).map((k) => ({ label: k, title: ATTACK_SPOTS[k][2], x: ATTACK_SPOTS[k][0], y: ATTACK_SPOTS[k][1] })),
    defense: Object.keys(DEFENSE_SPOTS).map((k) => ({ label: k, title: DEFENSE_SPOTS[k][2], x: DEFENSE_SPOTS[k][0], y: DEFENSE_SPOTS[k][1] })),
    gk: [{ label: 'GK', title: GK_SPOT[2], x: GK_SPOT[0], y: GK_SPOT[1] }],
  };

  const A = ATTACK_SPOTS;
  const attackSix = () => ['LW', 'LB', 'CB', 'RB', 'RW', 'PV'].map((k) => ['attack', k, A[k][0], A[k][1]]);
  const gk = ['gk', 'GK', 38.9, 10];

  const TEMPLATES = [
    {
      name: '6-0-forsvar', category: 'Forsvar',
      description: 'Seks forsvarere i en linje omkring 6-meter-linjen.',
      players: [gk, ['defense', 'VY', 37.4, 1.6], ['defense', 'VF', 34.6, 4.6], ['defense', 'MV', 33.3, 8.2], ['defense', 'MH', 33.3, 11.8], ['defense', 'HF', 34.6, 15.4], ['defense', 'HY', 37.4, 18.4]],
    },
    {
      name: '5-1-forsvar', category: 'Forsvar',
      description: 'Fem forsvarere på linjen og en fremskudt forsvarer, der forstyrrer playmakeren.',
      players: [gk, ['defense', 'VY', 37.4, 1.6], ['defense', 'VF', 34.5, 5], ['defense', 'MF', 33.3, 10], ['defense', 'HF', 34.5, 15], ['defense', 'HY', 37.4, 18.4], ['defense', 'F1', 28.8, 10]],
    },
    {
      name: '3-2-1-forsvar', category: 'Forsvar',
      description: 'Tre bagerste, to halvt fremskudte og en spids foran.',
      players: [gk, ['defense', 'VF', 35.6, 3.2], ['defense', 'MF', 33.3, 10], ['defense', 'HF', 35.6, 16.8], ['defense', 'VH', 30.8, 6.2], ['defense', 'HH', 30.8, 13.8], ['defense', 'F1', 27.8, 10]],
    },
    {
      name: '4-2-forsvar', category: 'Forsvar',
      description: 'Fire på linjen og to fremskudte mod backspillerne.',
      players: [gk, ['defense', 'VY', 36.4, 2.6], ['defense', 'MV', 33.4, 7.8], ['defense', 'MH', 33.4, 12.2], ['defense', 'HY', 36.4, 17.4], ['defense', 'F1', 29.4, 6.2], ['defense', 'F2', 29.4, 13.8]],
    },
    {
      name: '3-3-angreb', category: 'Angreb',
      description: 'Grundopstilling med tre backspillere, to fløje og en stregspiller.',
      players: [gk].concat(attackSix()),
      ball: { holder: 'CB' },
    },
    {
      name: '2-4-angreb', category: 'Angreb',
      description: 'Playmakeren løber ind som ekstra stregspiller, så angrebet går fra 3-3 til 2-4.',
      players: [gk].concat(attackSix()),
      ball: { holder: 'CB' },
      steps: [
        { note: 'Grundopstilling i 3-3.', duration: 1 },
        { note: 'CB spiller bolden til LB.', duration: 1, lines: [{ type: 'pass', toPlayer: 'LB' }] },
        { note: 'CB løber ind som anden stregspiller. LB og RB rykker ind mod midten.', duration: 1.8, lines: [
          { type: 'run', player: 'CB', to: [33.3, 6.5], bend: 1.5 },
          { type: 'run', player: 'PV', to: [33.3, 13.2] },
          { type: 'run', player: 'LB', to: [28.5, 7] },
          { type: 'run', player: 'RB', to: [28.5, 13] },
        ] },
      ],
    },
    {
      name: 'Kryds mellem backs', category: 'Angreb',
      description: 'CB spiller LB og krydser, hvorefter bolden føres til RB, der afslutter.',
      players: [gk].concat(attackSix()),
      ball: { holder: 'CB' },
      steps: [
        { note: 'Alle spillere står i deres startpositioner.', duration: 1 },
        { note: 'CB afleverer bolden til LB.', duration: 1, lines: [{ type: 'pass', toPlayer: 'LB' }] },
        { note: 'CB løber i en bue mod højre side.', duration: 1.6, lines: [{ type: 'run', player: 'CB', to: [31, 13], bend: 2.2 }] },
        { note: 'LB spiller bolden videre til RB.', duration: 1, lines: [{ type: 'pass', toPlayer: 'RB', time: 0.9 }] },
        { note: 'RB går mod mål og afslutter.', duration: 1.6, lines: [
          { type: 'run', player: 'RB', to: [31.6, 12.2] },
          { type: 'shot', to: [39.9, 9.1], delay: 1.2, time: 0.4 },
        ] },
      ],
    },
    {
      name: 'Stregindspil', category: 'Angreb',
      description: 'Backen trækker forsvareren ud og spiller stregspilleren fri.',
      players: [gk, ['defense', 'MF', 33.1, 8.8], ['defense', 'HF', 33.1, 12]].concat(attackSix()),
      ball: { holder: 'CB' },
      steps: [
        { note: 'Startopstilling. CB har bolden.', duration: 1 },
        { note: 'CB truer mod mål og trækker midterforsvareren frem.', duration: 1.4, lines: [
          { type: 'run', player: 'CB', to: [30.2, 9.8] },
          { type: 'defense', player: 'MF', to: [31.4, 9.4] },
        ] },
        { note: 'Stregspilleren spærrer og vender sig mod bolden.', duration: 1, lines: [{ type: 'run', player: 'PV', to: [33.5, 9.2] }] },
        { note: 'CB spiller stregindspil.', duration: 0.9, lines: [{ type: 'pass', toPlayer: 'PV' }] },
        { note: 'Stregspilleren afslutter.', duration: 0.8, lines: [{ type: 'shot', to: [39.9, 11], time: 0.4 }] },
      ],
    },
    {
      name: 'Fløjafslutning', category: 'Angreb',
      description: 'Bolden flyttes hurtigt over på højre fløj, der løber ind i afslutningen.',
      players: [gk].concat(attackSix()),
      ball: { holder: 'CB' },
      steps: [
        { note: 'CB spiller RB.', duration: 0.9, lines: [{ type: 'pass', toPlayer: 'RB' }] },
        { note: 'RB fører bolden frem, mens RW starter sit indløb.', duration: 1.3, lines: [
          { type: 'run', player: 'RB', to: [31.2, 14.2] },
          { type: 'run', player: 'RW', to: [36.4, 16.6], bend: 0.8 },
        ] },
        { note: 'RB spiller RW i løbet.', duration: 0.9, lines: [{ type: 'pass', toPlayer: 'RW' }] },
        { note: 'RW hopper ind over målfeltet og afslutter.', duration: 1.1, lines: [
          { type: 'run', player: 'RW', to: [36, 13.6], bend: 0.6 },
          { type: 'shot', to: [39.9, 9.1], delay: 0.8, time: 0.35 },
        ] },
      ],
    },
    {
      name: 'Overgangsspil', category: 'Overgang',
      description: 'Holdet vender fra forsvar til angreb og finder sin opstilling på modstanderens halvdel.',
      court: 'full',
      players: [['gk', 'GK', 1.1, 10], ['attack', 'LW', 7, 2], ['attack', 'LB', 8, 6.5], ['attack', 'CB', 7, 10], ['attack', 'RB', 8, 13.5], ['attack', 'RW', 7, 18], ['attack', 'PV', 9.5, 10]],
      ball: { holder: 'GK' },
      steps: [
        { note: 'Målmanden sætter hurtigt i gang med CB.', duration: 1, lines: [{ type: 'pass', toPlayer: 'CB' }] },
        { note: 'Hele holdet løber frem. CB fører bolden i midten.', duration: 2.6, lines: [
          { type: 'run', player: 'LW', to: [36.8, 1.3] }, { type: 'run', player: 'RW', to: [36.8, 18.7] },
          { type: 'run', player: 'LB', to: [29.6, 4.8] }, { type: 'run', player: 'RB', to: [29.6, 15.2] },
          { type: 'run', player: 'PV', to: [33.3, 10] }, { type: 'run', player: 'CB', to: [27.6, 10] },
        ] },
      ],
    },
    {
      name: 'Kontraspil', category: 'Kontra',
      description: 'Lang åbning fra målmanden til fløjen, der er stukket af.',
      court: 'full',
      players: [['gk', 'GK', 1.1, 10], ['attack', 'LW', 12, 2.5], ['attack', 'RW', 12, 17.5], ['attack', 'CB', 9, 10], ['defense', 'F1', 24, 9]],
      ball: { holder: 'GK' },
      steps: [
        { note: 'Bolden er erobret. Fløjene starter med det samme.', duration: 1.4, lines: [
          { type: 'run', player: 'RW', to: [26, 16.5] }, { type: 'run', player: 'LW', to: [24, 4] },
        ] },
        { note: 'Målmanden åbner langt til RW, som løber frit.', duration: 1.4, lines: [
          { type: 'pass', toPlayer: 'RW', time: 1.2, bend: -1 },
          { type: 'run', player: 'RW', to: [33, 13] },
          { type: 'defense', player: 'F1', to: [32, 9.5] },
        ] },
        { note: 'RW afslutter alene mod mål.', duration: 0.9, lines: [{ type: 'shot', to: [39.9, 9.2], time: 0.4 }] },
      ],
    },
  ];

  function buildTemplate(tpl) {
    const doc = G.createSystem({ name: tpl.name, named: true, description: tpl.description, category: tpl.category, court: tpl.court || 'half' });
    const byLabel = {};
    doc.players = tpl.players.map(([team, label, x, y]) => {
      const p = G.createPlayer(team, label, x, y);
      byLabel[label] = p.id;
      return p;
    });
    if (tpl.ball) {
      const holder = doc.players.find((p) => p.id === byLabel[tpl.ball.holder]);
      doc.ball = { onCourt: true, x: holder ? holder.x : 28, y: holder ? holder.y : 10, holder: holder ? holder.id : null };
    }
    if (tpl.steps) {
      doc.steps = tpl.steps.map((s) => G.createStep({
        note: s.note || '',
        duration: s.duration || 1.5,
        lines: (s.lines || []).map((l) => {
          const extra = {};
          if (l.player) extra.player = byLabel[l.player];
          if (l.toPlayer) extra.toPlayer = byLabel[l.toPlayer];
          if (l.to) extra.to = { x: l.to[0], y: l.to[1] };
          if (l.bend) extra.bend = l.bend;
          if (l.delay) extra.delay = l.delay;
          if (l.time) extra.time = l.time;
          return G.createLine(l.type, extra);
        }),
      }));
    }
    return doc;
  }

  Object.assign(G, { PALETTE, TEMPLATES, buildTemplate });
  if (typeof module !== 'undefined' && module.exports) module.exports = { PALETTE, TEMPLATES, buildTemplate };
})(typeof window !== 'undefined' ? window : globalThis);
