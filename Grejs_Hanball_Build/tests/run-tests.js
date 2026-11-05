#!/usr/bin/env node
// Tester beregningerne i model.js uden browser. Kør: node Grejs_Hanball_Build/tests/run-tests.js
'use strict';
const assert = require('assert');
const G = require('../js/model.js');

globalThis.GHB = G;
const { buildTemplate, TEMPLATES } = require('../js/templates.js');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log('ok  ' + name);
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + ' != ' + b);

function setup() {
  const doc = G.createSystem();
  const a = G.createPlayer('attack', 'CB', 28, 10);
  const b = G.createPlayer('attack', 'LB', 30, 5);
  doc.players = [a, b];
  doc.ball = { onCourt: true, x: 28, y: 10, holder: a.id };
  return { doc, a, b };
}

test('løb flytter spilleren til næste trin', () => {
  const { doc, a } = setup();
  doc.steps[0].lines.push(G.createLine('run', { player: a.id, to: { x: 32, y: 12 } }));
  doc.steps.push(G.createStep());
  const c = G.compile(doc);
  near(c[1].start[a.id].x, 32);
  near(c[1].start[a.id].y, 12);
});

test('ændring af startposition slår igennem i senere trin uden at ændre målet', () => {
  const { doc, a } = setup();
  doc.steps.push(G.createStep());
  doc.steps[1].lines.push(G.createLine('run', { player: a.id, to: { x: 32, y: 12 } }));
  a.x = 26;
  const c = G.compile(doc);
  near(c[1].start[a.id].x, 26);
  near(c[1].end[a.id].x, 32);
});

test('aflevering giver modtageren bolden, og bolden følger med i næste løb', () => {
  const { doc, b } = setup();
  doc.steps[0].lines.push(G.createLine('pass', { toPlayer: b.id }));
  doc.steps.push(G.createStep());
  doc.steps[1].lines.push(G.createLine('run', { player: b.id, to: { x: 33, y: 8 } }));
  const c = G.compile(doc);
  assert.strictEqual(c[0].ballEnd.holder, b.id);
  near(G.poseAt(doc, c, 1, c[1].length).ball.pos.x, 33 + G.BALL_OFFSET.x);
});

test('aflevering sigter efter en modtager i bevægelse', () => {
  const { doc, b } = setup();
  doc.steps[0].duration = 2;
  doc.steps[0].lines.push(G.createLine('run', { player: b.id, to: { x: 34, y: 5 } }));
  doc.steps[0].lines.push(G.createLine('pass', { toPlayer: b.id, delay: 0, time: 2 }));
  near(G.compile(doc)[0].ballEvents[0].to.x, 34 + G.BALL_OFFSET.x);
});

test('flere afleveringer i samme trin kører efter hinanden', () => {
  const { doc, a, b } = setup();
  doc.steps[0].lines.push(G.createLine('pass', { toPlayer: b.id, time: 0.5 }));
  doc.steps[0].lines.push(G.createLine('pass', { toPlayer: a.id, time: 0.5 }));
  const c = G.compile(doc);
  near(c[0].ballEvents[1].delay, 0.5);
  assert.strictEqual(c[0].ballEnd.holder, a.id);
});

test('trinnet varer mindst så længe som sin længste pil', () => {
  const { doc, a } = setup();
  doc.steps[0].duration = 1;
  doc.steps[0].lines.push(G.createLine('run', { player: a.id, to: { x: 30, y: 10 }, delay: 1, time: 3 }));
  near(G.compile(doc)[0].length, 4);
});

test('ingen teleportering i nogen skabelon', () => {
  TEMPLATES.forEach((tpl) => {
    const doc = buildTemplate(tpl);
    const c = G.compile(doc);
    const total = G.totalLength(c);
    let prev = null;
    for (let s = 0; s <= total; s += 0.01) {
      const at = G.locate(c, s);
      const pose = G.poseAt(doc, c, at.step, at.t);
      if (prev) {
        doc.players.forEach((p) => assert.ok(G.dist(pose.players[p.id], prev.players[p.id]) < 0.5, tpl.name + ': ' + p.label));
        if (doc.ball.onCourt) assert.ok(G.dist(pose.ball.pos, prev.ball.pos) < 1.5, tpl.name + ': bold');
      }
      prev = pose;
    }
  });
});

test('slettet spiller efterlader hverken pile eller boldholder', () => {
  const { doc, a, b } = setup();
  doc.steps[0].lines.push(G.createLine('run', { player: a.id, to: { x: 30, y: 10 } }));
  doc.steps[0].lines.push(G.createLine('pass', { toPlayer: a.id }));
  G.removePlayer(doc, a.id);
  assert.strictEqual(doc.ball.holder, null);
  assert.strictEqual(doc.steps[0].lines.length, 1);
  assert.strictEqual(doc.steps[0].lines[0].toPlayer, null);
  assert.ok(doc.players.includes(b));
  G.compile(doc);
});

test('kopi deler ikke data med originalen', () => {
  const { doc } = setup();
  const copy = G.duplicateSystem(doc);
  copy.players[0].x = 1;
  assert.notStrictEqual(doc.players[0].x, 1);
  assert.notStrictEqual(copy.id, doc.id);
});

test('normalisering renser ødelagte og skadelige data', () => {
  const doc = G.normalizeSystem({
    name: 'x'.repeat(999),
    colors: { attack: 'url(evil)' },
    court: 'evil',
    ball: 3,
    players: [{ id: 'a', x: 'NaN', y: 1e9, label: 'LANG_ETIKET', color: 'red', team: 'hacker' }, { id: 'a', x: 1, y: 1 }, null],
    steps: [{ duration: -1, lines: [{ type: 'run', player: 'findes-ikke' }, { type: 'evil' }, null, { type: 'free', points: [{ x: 1, y: 1 }] }] }],
  });
  assert.ok(doc.name.length <= G.LIMITS.name);
  assert.strictEqual(doc.colors.attack, G.DEFAULT_COLORS.attack);
  assert.strictEqual(doc.court, 'half');
  assert.strictEqual(doc.players.length, 2);
  assert.notStrictEqual(doc.players[0].id, doc.players[1].id);
  assert.ok(doc.players[0].y <= G.WORLD.maxY);
  assert.strictEqual(doc.players[0].color, null);
  assert.strictEqual(doc.players[0].team, 'attack');
  assert.strictEqual(doc.steps[0].lines.length, 0);
  assert.ok(doc.steps[0].duration >= G.LIMITS.minDuration);
  G.compile(doc);
});

test('et system overlever en tur gennem JSON uændret', () => {
  TEMPLATES.forEach((tpl) => {
    const doc = buildTemplate(tpl);
    const back = G.normalizeSystem(JSON.parse(JSON.stringify(doc)));
    assert.deepStrictEqual(back.steps, doc.steps, tpl.name);
    assert.deepStrictEqual(back.players, doc.players, tpl.name);
    assert.deepStrictEqual(back.ball, doc.ball, tpl.name);
  });
});

console.log('\n' + count + ' test bestået');
