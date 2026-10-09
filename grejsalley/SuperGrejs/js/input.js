'use strict';
/* =====================================================================
   SUPER GREJS - input.js
   Tastatur (kan omdefineres), touchknapper og gamepad samlet til de
   samme handlinger: left, right, down, jump, run, pause.
   "pressed" er en kant (lige trykket) og holdes, indtil spillets faste
   fysiktrin har set den (endStep), så korte tryk aldrig tabes.
   ===================================================================== */
SG.input = (function () {
  const ACTIONS = ['left', 'right', 'down', 'jump', 'run', 'pause'];
  const DEFAULT_KEYS = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'KeyW', 'ArrowUp'],
    run: ['ShiftLeft', 'ShiftRight', 'KeyJ'],
    pause: ['Escape', 'KeyP'],
  };
  const LABELS = { left: 'Venstre', right: 'Højre', down: 'Duk / rør / dør', jump: 'Hop', run: 'Løb / skyd', pause: 'Pause' };

  let keys = clone(DEFAULT_KEYS);
  const held = {};      // kilde -> sæt af handlinger
  const pressed = {};
  let enabled = true;
  let rebinding = null;
  const listeners = [];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function actionFor(code) {
    for (const a of ACTIONS) if (keys[a] && keys[a].includes(code)) return a;
    return null;
  }

  const sources = { key: new Set(), touch: new Set(), pad: new Set() };
  function isDown(a) { return sources.key.has(a) || sources.touch.has(a) || sources.pad.has(a); }

  function press(src, a) {
    if (!sources[src].has(a) && !isDown(a)) {
      pressed[a] = true;
      listeners.forEach(fn => fn(a));
    }
    sources[src].add(a);
  }
  function release(src, a) { sources[src].delete(a); }

  window.addEventListener('keydown', e => {
    if (rebinding) {
      e.preventDefault();
      const cb = rebinding;
      rebinding = null;
      cb(e.code);
      return;
    }
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const a = actionFor(e.code);
    if (!a) return;
    // Spil-taster må ikke scrolle siden eller aktivere knapper med fokus.
    if (enabled && (a !== 'pause' || !e.repeat)) {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    }
    if (e.repeat) return;
    press('key', a);
  });
  window.addEventListener('keyup', e => {
    const a = actionFor(e.code);
    if (a) release('key', a);
  });
  window.addEventListener('blur', () => { sources.key.clear(); sources.touch.clear(); });

  /* ---------------- Touch ---------------- */
  const touchPtr = new Map(); // pointerId -> action
  function bindTouch(root) {
    const btnAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const b = el && el.closest && el.closest('.t-btn');
      return b && root.contains(b) ? b : null;
    };
    const refresh = () => {
      sources.touch.clear();
      touchPtr.forEach(a => a && sources.touch.add(a));
      root.querySelectorAll('.t-btn').forEach(b => b.classList.toggle('on', sources.touch.has(b.dataset.act)));
    };
    const setPtr = (id, b) => {
      const a = b ? b.dataset.act : null;
      if (a && !isDown(a)) { pressed[a] = true; listeners.forEach(fn => fn(a)); }
      touchPtr.set(id, a);
      refresh();
    };
    root.addEventListener('pointerdown', e => {
      const b = e.target.closest('.t-btn');
      if (!b) return;
      e.preventDefault();
      SG.audio.unlock();
      setPtr(e.pointerId, b);
    });
    window.addEventListener('pointermove', e => {
      if (!touchPtr.has(e.pointerId)) return;
      const b = btnAt(e.clientX, e.clientY);
      const a = b ? b.dataset.act : null;
      if (a !== touchPtr.get(e.pointerId)) setPtr(e.pointerId, b);
    });
    const end = e => {
      if (!touchPtr.has(e.pointerId)) return;
      touchPtr.delete(e.pointerId);
      refresh();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    root.addEventListener('contextmenu', e => e.preventDefault());
  }

  /* ---------------- Gamepad ---------------- */
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find(p => p && p.connected);
    const want = new Set();
    if (pad) {
      const b = i => pad.buttons[i] && pad.buttons[i].pressed;
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (ax < -0.4 || b(14)) want.add('left');
      if (ax > 0.4 || b(15)) want.add('right');
      if (ay > 0.6 || b(13)) want.add('down');
      if (b(0) || b(3)) want.add('jump');
      if (b(1) || b(2) || b(7) || b(6)) want.add('run');
      if (b(9)) want.add('pause');
    }
    ACTIONS.forEach(a => {
      if (want.has(a)) press('pad', a);
      else release('pad', a);
    });
  }

  return {
    ACTIONS, LABELS, DEFAULT_KEYS,
    bindTouch,
    poll: pollPad,
    down: a => enabled && isDown(a),
    pressed: a => enabled && !!pressed[a],
    consume(a) {
      const p = !!pressed[a];
      pressed[a] = false;
      return p;
    },
    endStep() { ACTIONS.forEach(a => { pressed[a] = false; }); },
    clear() {
      ACTIONS.forEach(a => { pressed[a] = false; });
      sources.key.clear(); sources.pad.clear();
    },
    setEnabled(v) { enabled = v; },
    onPress(fn) { listeners.push(fn); },
    getKeys: () => clone(keys),
    setKeys(k) {
      keys = clone(DEFAULT_KEYS);
      if (k) ACTIONS.forEach(a => { if (Array.isArray(k[a]) && k[a].length) keys[a] = k[a].slice(0, 4); });
    },
    resetKeys() { keys = clone(DEFAULT_KEYS); },
    // Næste tastetryk bliver den primære tast for handlingen.
    rebind(action, done) {
      rebinding = code => {
        if (code !== 'Escape' || action === 'pause') {
          ACTIONS.forEach(a => { keys[a] = keys[a].filter(c => c !== code); });
          keys[action] = [code, ...keys[action].filter(c => c !== code)].slice(0, 4);
        }
        done(keys);
      };
    },
    cancelRebind() { rebinding = null; },
    keyName(code) {
      const map = { Space: 'Mellemrum', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'Shift', ShiftRight: 'Shift (h)', Escape: 'Esc', Enter: 'Enter', ControlLeft: 'Ctrl', ControlRight: 'Ctrl (h)', AltLeft: 'Alt' };
      if (map[code]) return map[code];
      if (code.startsWith('Key')) return code.slice(3);
      if (code.startsWith('Digit')) return code.slice(5);
      return code;
    },
  };
})();
