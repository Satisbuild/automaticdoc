/* GrejsAlley Lemmings — levels-data.js
 * All worlds and levels as plain data. Add a level by appending an object to
 * GL.LEVELS (see README.md for the full format). The engine never needs to
 * change when levels are added.
 *
 * Level fields:
 *   id, world, name, intro      identity and the short introduction text
 *   w, h                        size in level pixels (a lemming is 10 px tall)
 *   count, required, best       lemmings in total, needed to win, best possible (3 stars)
 *   time                        time limit in seconds
 *   rate                        minimum release rate 1-99 (player can raise it)
 *   skills                      { climber, floater, bomber, blocker, builder, basher, miner, digger }
 *   entrance / entrances        { x, y, dir } spawn point(s); dir 1 = walks right
 *   exit / exits                { x, y } – y is snapped to the ground below
 *   hazards                     [{ type: 'water'|'lava'|'acid', x, y, w, h }]
 *   terrain                     shapes, painted in order (see level.js):
 *     ['land', x0, x1, bottom, [[x,y]...], mat, rough]   ground with a smooth top
 *     ['ceil', x0, x1, [[x,y]...], mat, rough]           ceiling from the top down
 *     ['rect', x, y, w, h, mat]   ['poly', [[x,y]...], mat]
 *     ['ellipse', cx, cy, rx, ry, mat]   ['blob', cx, cy, rx, ry, mat, seed]
 *     mat: 'd' dirt (diggable)  's' steel (indestructible)  'a' air (carve)
 */
(function (GL) {
  'use strict';

  GL.WORLDS = [
    { id: 'hills', name: 'Grønne Bakker', theme: 'hills', desc: 'Lær at gå, grave, bygge og stoppe.' },
    { id: 'caves', name: 'Klippehuler', theme: 'caves', desc: 'Klatring, faldskærm, bryder og minearbejder.' },
    { id: 'ice', name: 'Is og Sne', theme: 'ice', desc: 'Broer over iskoldt vand og glatte toppe.' },
    { id: 'desert', name: 'Ørkenruiner', theme: 'desert', desc: 'Slotte, pyramider og lava.' },
    { id: 'industry', name: 'Industriområdet', theme: 'industry', desc: 'Stål, syre og alle evner på én gang.' },
  ];

  GL.LEVELS = [
    /* ============================ GRØNNE BAKKER ============================ */
    {
      id: 'hills-1', world: 'hills', name: 'Første skridt',
      intro: 'Grejserne går helt af sig selv. Se dem vandre over bakken og hen til udgangen.',
      w: 520, h: 160, count: 10, required: 5, time: 180, rate: 50,
      skills: {},
      entrance: { x: 80, y: 80 }, exit: { x: 440, y: 104 },
      terrain: [
        ['land', 0, 520, 160, [[0, 118], [120, 112], [220, 116], [320, 108], [420, 113], [520, 110]], 'd', 1],
        ['blob', 260, 150, 34, 12, 's', 3],
        ['blob', 470, 60, 16, 70, 'd', 5],
      ],
    },
    {
      id: 'hills-2', world: 'hills', name: 'Grav dig ned',
      intro: 'Grejserne er spærret inde på en jordhylde. Vælg Graver og klik på en grejs for at grave et hul ned til udgangen.',
      w: 480, h: 160, count: 10, required: 8, time: 180, rate: 50,
      skills: { digger: 2 },
      entrance: { x: 240, y: 50 }, exit: { x: 440, y: 138 },
      terrain: [
        ['land', 0, 480, 160, [[0, 140], [480, 140]], 'd', 1],
        ['rect', 100, 80, 280, 20, 'd'],
        ['blob', 120, 96, 26, 10, 'd', 2],
        ['blob', 360, 96, 26, 10, 'd', 4],
        ['rect', 100, 50, 8, 30, 's'],
        ['rect', 372, 50, 8, 30, 's'],
      ],
    },
    {
      id: 'hills-3', world: 'hills', name: 'Byg en trappe',
      intro: 'Kanten er for høj at gå op ad. Giv en grejs Bygger lidt før kanten, så bygger den en trappe op.',
      w: 520, h: 160, count: 10, required: 8, time: 180, rate: 40,
      skills: { builder: 3 },
      entrance: { x: 120, y: 85 }, exit: { x: 470, y: 120 },
      terrain: [
        ['land', 0, 300, 160, [[0, 120], [300, 120]], 'd', 0],
        ['rect', 300, 108, 40, 52, 'd'],
        ['land', 340, 520, 160, [[340, 110], [380, 112], [420, 124], [520, 126]], 'd', 1],
        ['blob', 10, 100, 18, 40, 'd', 6],
      ],
    },
    {
      id: 'hills-4', world: 'hills', name: 'Stop dem!',
      intro: 'Til højre venter en klippe og koldt vand. Gør den første grejs til Stopper, så de andre vender om mod udgangen.',
      w: 480, h: 160, count: 12, required: 10, best: 11, time: 180, rate: 50,
      skills: { blocker: 1 },
      entrance: { x: 170, y: 70 }, exit: { x: 30, y: 108 },
      hazards: [{ type: 'water', x: 262, y: 138, w: 218, h: 22 }],
      terrain: [
        ['land', 0, 270, 160, [[0, 112], [140, 108], [270, 110]], 'd', 1],
        ['rect', 262, 150, 218, 10, 'd'],
        ['blob', 400, 132, 30, 26, 's', 9],
      ],
    },

    /* ============================== KLIPPEHULER ============================= */
    {
      id: 'caves-1', world: 'caves', name: 'Klatretur',
      intro: 'En klippesøjle står i vejen. Klatrere kan kravle op ad lodrette vægge — giv dem evnen, før de når søjlen.',
      w: 520, h: 160, count: 10, required: 8, time: 180, rate: 30,
      skills: { climber: 10 },
      entrance: { x: 70, y: 90 }, exit: { x: 440, y: 120 },
      terrain: [
        ['ceil', 0, 520, [[0, 16], [200, 30], [300, 24], [520, 18]], 'd', 2],
        ['land', 0, 520, 160, [[0, 124], [200, 122], [520, 124]], 'd', 1],
        ['rect', 210, 72, 40, 60, 'd'],
        ['blob', 230, 73, 16, 5, 'd', 8],
        ['blob', 120, 20, 30, 14, 'd', 1],
      ],
    },
    {
      id: 'caves-2', world: 'caves', name: 'Faldskærm',
      intro: 'Et dybt fald venter. Kun grejser med Faldskærm overlever turen ned til udgangen.',
      w: 480, h: 200, count: 10, required: 8, time: 180, rate: 30,
      skills: { floater: 10 },
      entrance: { x: 60, y: 22 }, exit: { x: 410, y: 168 },
      terrain: [
        ['ceil', 0, 480, [[0, 8], [480, 12]], 'd', 1],
        ['land', 0, 200, 200, [[0, 52], [200, 50]], 'd', 1],
        ['land', 200, 480, 200, [[200, 172], [480, 170]], 'd', 1],
        ['blob', 300, 40, 40, 18, 'd', 3],
      ],
    },
    {
      id: 'caves-3', world: 'caves', name: 'Gennem klippen',
      intro: 'Klippevæggen går helt op til loftet. En Bryder kan hakke en vandret tunnel igennem.',
      w: 560, h: 160, count: 12, required: 10, time: 200, rate: 40,
      skills: { basher: 2 },
      entrance: { x: 80, y: 90 }, exit: { x: 480, y: 120 },
      terrain: [
        ['ceil', 0, 560, [[0, 18], [560, 18]], 'd', 2],
        ['land', 0, 560, 160, [[0, 124], [560, 124]], 'd', 1],
        ['poly', [[216, 0], [334, 0], [322, 130], [226, 130]], 'd'],
        ['blob', 280, 60, 20, 16, 's', 4],
      ],
    },
    {
      id: 'caves-4', world: 'caves', name: 'Skråt ned',
      intro: 'Udgangen ligger i hulen nedenunder. En Minearbejder graver skråt ned gennem gulvet.',
      w: 560, h: 170, count: 12, required: 10, time: 200, rate: 40,
      skills: { miner: 2 },
      entrance: { x: 100, y: 50 }, exit: { x: 60, y: 150 },
      terrain: [
        ['ceil', 0, 560, [[0, 14], [560, 14]], 'd', 2],
        ['rect', 0, 80, 560, 40, 'd'],
        ['land', 0, 560, 170, [[0, 152], [560, 152]], 'd', 1],
        ['blob', 480, 110, 40, 10, 'd', 5],
      ],
    },

    /* =============================== IS OG SNE ============================== */
    {
      id: 'ice-1', world: 'ice', name: 'Isbroen',
      intro: 'Byg en bro over det iskolde vand. Brug en Stopper til at holde de andre tilbage, og en Bombe til at fjerne den bagefter.',
      w: 560, h: 160, count: 15, required: 12, best: 14, time: 240, rate: 30,
      skills: { builder: 3, blocker: 1, bomber: 1 },
      entrance: { x: 80, y: 65 }, exit: { x: 500, y: 96 },
      hazards: [{ type: 'water', x: 200, y: 135, w: 62, h: 25 }],
      terrain: [
        ['land', 0, 200, 160, [[0, 100], [200, 100]], 'd', 1],
        ['land', 262, 560, 160, [[262, 96], [560, 98]], 'd', 1],
        ['rect', 200, 150, 62, 10, 'd'],
      ],
    },
    {
      id: 'ice-2', world: 'ice', name: 'Snehulen',
      intro: 'Grav ned i snehulen og bryd igennem væggen ind til udgangen. Stålpladen kan man ikke grave i.',
      w: 520, h: 180, count: 12, required: 10, time: 240, rate: 40,
      skills: { digger: 2, basher: 2 },
      entrance: { x: 80, y: 30 }, exit: { x: 440, y: 115 },
      terrain: [
        ['land', 0, 520, 180, [[0, 62], [150, 58], [300, 64], [520, 60]], 'd', 1],
        ['rect', 150, 85, 150, 30, 'a'],
        ['rect', 360, 92, 110, 23, 'a'],
        ['rect', 350, 78, 130, 8, 's'],
      ],
    },
    {
      id: 'ice-3', world: 'ice', name: 'Glatte toppe',
      intro: 'Op ad den høje isvæg og ned på den anden side. Her skal grejserne både klatre og bruge faldskærm.',
      w: 520, h: 200, count: 8, required: 6, time: 240, rate: 30,
      skills: { climber: 8, floater: 8 },
      entrance: { x: 80, y: 135 }, exit: { x: 450, y: 180 },
      terrain: [
        ['land', 0, 200, 200, [[0, 172], [200, 170]], 'd', 1],
        ['rect', 200, 50, 40, 150, 'd'],
        ['blob', 220, 52, 16, 5, 'd', 2],
        ['land', 240, 520, 200, [[240, 180], [520, 182]], 'd', 1],
      ],
    },
    {
      id: 'ice-4', world: 'ice', name: 'Isflagen',
      intro: 'Grejserne er fanget på en tynd isflage. En Bombe kan sprænge hul i isen, så de kan hoppe ned.',
      w: 480, h: 170, count: 10, required: 8, best: 9, time: 180, rate: 40,
      skills: { bomber: 3 },
      entrance: { x: 230, y: 50 }, exit: { x: 420, y: 130 },
      terrain: [
        ['ceil', 0, 480, [[0, 18], [240, 26], [480, 16]], 'd', 2],
        ['rect', 180, 80, 100, 5, 'd'],
        ['rect', 180, 10, 6, 70, 's'],
        ['rect', 274, 10, 6, 70, 's'],
        ['land', 0, 480, 170, [[0, 132], [480, 130]], 'd', 1],
      ],
    },

    /* ============================== ØRKENRUINER ============================= */
    {
      id: 'desert-1', world: 'desert', name: 'Sandslottet',
      intro: 'Grav ned gennem slottets tag — men stålet kan ikke graves i. Inde i hallen skal I bryde ud gennem den rigtige mur.',
      w: 600, h: 160, count: 15, required: 12, time: 240, rate: 40,
      skills: { digger: 2, basher: 2 },
      entrance: { x: 300, y: 32 }, exit: { x: 70, y: 125 },
      terrain: [
        ['land', 0, 600, 160, [[0, 125], [600, 125]], 'd', 0],
        ['rect', 180, 68, 240, 58, 'd'],
        ['rect', 180, 56, 8, 12, 'd'],
        ['rect', 412, 56, 8, 12, 'd'],
        ['rect', 200, 92, 200, 33, 'a'],
        ['rect', 188, 76, 92, 8, 's'],
        ['rect', 330, 76, 82, 8, 's'],
        ['rect', 404, 68, 10, 57, 's'],
        ['blob', 520, 118, 30, 10, 'd', 4],
      ],
    },
    {
      id: 'desert-2', world: 'desert', name: 'Pyramiden',
      intro: 'Gravkammeret med udgangen er gemt inde i pyramiden. Pas på lavaen!',
      w: 600, h: 160, count: 15, required: 12, best: 14, time: 240, rate: 40,
      skills: { blocker: 1, basher: 2 },
      entrance: { x: 260, y: 35 }, exit: { x: 325, y: 125 },
      hazards: [{ type: 'lava', x: 470, y: 132, w: 40, h: 28 }],
      terrain: [
        ['land', 0, 600, 160, [[0, 125], [600, 125]], 'd', 0],
        ['rect', 470, 125, 40, 35, 'a'],
        ['rect', 180, 110, 260, 15, 'd'],
        ['rect', 180, 95, 230, 15, 'd'],
        ['rect', 180, 80, 200, 15, 'd'],
        ['rect', 180, 65, 170, 15, 'd'],
        ['rect', 172, 50, 10, 75, 's'],
        ['rect', 300, 100, 60, 25, 'a'],
      ],
    },
    {
      id: 'desert-3', world: 'desert', name: 'Faraos fælde',
      intro: 'Gulvet er af stål — undtagen et lille stykke sand. Tim din Bombe, og byg dig derefter op til udgangen.',
      w: 560, h: 180, count: 15, required: 12, best: 14, time: 300, rate: 40,
      skills: { bomber: 3, builder: 4 },
      entrance: { x: 130, y: 40 }, exit: { x: 500, y: 104 },
      terrain: [
        ['land', 0, 560, 180, [[0, 124], [560, 124]], 'd', 1],
        ['rect', 380, 104, 180, 76, 'd'],
        ['rect', 100, 70, 200, 6, 's'],
        ['rect', 180, 70, 40, 6, 'd'],
        ['rect', 94, 30, 6, 46, 's'],
        ['rect', 300, 30, 6, 46, 's'],
        ['rect', 94, 24, 212, 6, 's'],
      ],
    },
    {
      id: 'desert-4', world: 'desert', name: 'Oasen',
      intro: 'Grav ned fra plateauet, byg over oasens dam og bryd gennem klitten. Alle kræfter skal i brug!',
      w: 600, h: 180, count: 20, required: 15, best: 19, time: 300, rate: 35,
      skills: { miner: 1, builder: 2, blocker: 1, bomber: 1, basher: 2 },
      entrance: { x: 60, y: 20 }, exit: { x: 588, y: 130 },
      hazards: [{ type: 'water', x: 330, y: 144, w: 35, h: 36 }],
      terrain: [
        ['land', 0, 250, 180, [[0, 50], [250, 50]], 'd', 1],
        ['land', 250, 330, 180, [[250, 140], [330, 140]], 'd', 0],
        ['rect', 330, 165, 35, 15, 'd'],
        ['land', 365, 600, 180, [[365, 132], [420, 130], [600, 130]], 'd', 1],
        ['poly', [[458, 131], [470, 96], [510, 88], [550, 96], [572, 131]], 'd'],
        ['blob', 110, 28, 26, 10, 'd', 3],
      ],
    },

    /* ============================ INDUSTRIOMRÅDET =========================== */
    {
      id: 'industry-1', world: 'industry', name: 'Stålgulvet',
      intro: 'Find jordproppen i stålgulvet, bryd gennem muren og grav dig ned til udgangen.',
      w: 620, h: 200, count: 20, required: 16, time: 300, rate: 50,
      skills: { digger: 2, basher: 2, miner: 2 },
      entrance: { x: 120, y: 30 }, exit: { x: 590, y: 170 },
      hazards: [{ type: 'acid', x: 0, y: 186, w: 40, h: 14 }],
      terrain: [
        ['rect', 40, 60, 360, 6, 's'],
        ['rect', 300, 60, 30, 6, 'd'],
        ['rect', 40, 40, 8, 20, 's'],
        ['rect', 392, 40, 8, 20, 's'],
        ['rect', 32, 70, 8, 48, 's'],
        ['rect', 40, 110, 430, 8, 's'],
        ['rect', 430, 70, 20, 40, 'd'],
        ['rect', 470, 110, 110, 20, 'd'],
        ['rect', 572, 86, 8, 24, 's'],
        ['rect', 40, 170, 580, 30, 'd'],
      ],
    },
    {
      id: 'industry-2', world: 'industry', name: 'Trappen',
      intro: 'Byg en lang trappe op til dækket. Pas på syren til venstre — en Stopper kan redde dem, der vender om.',
      w: 600, h: 180, count: 20, required: 16, best: 19, time: 300, rate: 40,
      skills: { builder: 4, blocker: 1 },
      entrance: { x: 200, y: 100 }, exit: { x: 560, y: 106 },
      hazards: [{ type: 'acid', x: 20, y: 146, w: 40, h: 34 }],
      terrain: [
        ['rect', 0, 140, 600, 40, 'd'],
        ['rect', 20, 140, 40, 40, 'a'],
        ['rect', 400, 106, 200, 74, 's'],
      ],
    },
    {
      id: 'industry-3', world: 'industry', name: 'Højovnen',
      intro: 'Grav ned gennem ovnen, stop grejserne før lavaen og find vejen ned til bunden.',
      w: 520, h: 240, count: 20, required: 15, best: 19, time: 300, rate: 40,
      skills: { digger: 2, blocker: 1, miner: 2, bomber: 1 },
      entrance: { x: 200, y: 50 }, exit: { x: 90, y: 210 },
      hazards: [{ type: 'lava', x: 300, y: 142, w: 120, h: 6 }],
      terrain: [
        ['rect', 52, 30, 8, 210, 's'],
        ['rect', 460, 30, 8, 210, 's'],
        ['rect', 60, 82, 400, 20, 'd'],
        ['rect', 240, 88, 220, 8, 's'],
        ['rect', 60, 140, 400, 20, 'd'],
        ['rect', 300, 140, 120, 8, 'a'],
        ['rect', 60, 210, 400, 30, 'd'],
      ],
    },
    {
      id: 'industry-4', world: 'industry', name: 'Grejs-finalen',
      intro: 'Den store finale: bro over syren, grav, bryd og min dig frem. Brug alt, hvad du har lært.',
      w: 880, h: 200, count: 25, required: 20, best: 24, time: 360, rate: 40,
      skills: { climber: 2, floater: 2, bomber: 2, blocker: 1, builder: 3, basher: 2, miner: 2, digger: 2 },
      entrance: { x: 80, y: 40 }, exit: { x: 820, y: 166 },
      hazards: [{ type: 'acid', x: 220, y: 104, w: 32, h: 20 }],
      terrain: [
        ['land', 0, 220, 200, [[0, 70], [220, 70]], 'd', 0],
        ['rect', 252, 66, 248, 20, 'd'],
        ['rect', 470, 30, 30, 36, 's'],
        ['rect', 252, 86, 8, 38, 's'],
        ['rect', 220, 124, 660, 25, 'd'],
        ['rect', 560, 40, 40, 84, 'd'],
        ['rect', 660, 70, 12, 54, 's'],
        ['rect', 560, 166, 320, 34, 'd'],
        ['blob', 140, 140, 40, 22, 's', 5],
      ],
    },
  ];
})(typeof window !== 'undefined' ? (window.GL = window.GL || {}) : (globalThis.GL = globalThis.GL || {}));
