// Paneler, tidslinje, dialoger, eksport, præsentation, tastatur og opstart.
(function (root) {
  'use strict';
  const G = root.GHB;
  const App = G.App;
  const Editor = G.Editor;
  const Store = G.Store;

  const $ = (id) => document.getElementById(id);

  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v; // Bruges kun til programmets egne ikoner.
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k in node && k !== 'list') node[k] = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => { if (c) node.append(c); });
    return node;
  }

  const ICONS = {
    start: '<svg viewBox="0 0 24 24"><path d="M6 5h2.5v14H6zM20 5v14L9.5 12z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M18 5v14L8 12zM5 5h2.5v14H5z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M6 5v14l10-7zM16.5 5H19v14h-2.5z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
  };

  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2];
  const fmt = (n) => n.toFixed(1).replace('.', ',');

  // ---------- Besked og bekræftelse ----------

  App.toast = function (message, kind) {
    const node = el('div', { class: 'toast' + (kind === 'error' ? ' error' : ''), text: message });
    $('toasts').append(node);
    setTimeout(() => node.remove(), kind === 'error' ? 6000 : 3800);
  };

  function confirmDialog(title, text, okLabel) {
    const dlg = $('confirm-dialog');
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    $('confirm-ok').textContent = okLabel;
    dlg.returnValue = 'no';
    dlg.showModal();
    return new Promise((resolve) => {
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'yes'), { once: true });
    });
  }

  // ---------- Venstre panel ----------

  const TOOLS = [
    { id: 'select', label: 'Vælg og flyt', key: 'V' },
    { id: 'run', label: 'Løbebane', key: 'L' },
    { id: 'pass', label: 'Aflevering', key: 'A' },
    { id: 'shot', label: 'Skud', key: 'S' },
    { id: 'defense', label: 'Forsvarsbevægelse', key: 'F' },
    { id: 'free', label: 'Fri tegning', key: 'T' },
  ];

  function toolIcon(id) {
    if (id === 'select') return '<svg viewBox="0 0 24 24" class="tool-ic"><path fill="currentColor" d="M6 3l12 10-5.2.6L16 20l-2.6 1.2-3-6.5L6 18z"/></svg>';
    if (id === 'free') return '<svg viewBox="0 0 24 24" class="tool-ic"><path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" d="M3 16c3-8 5-8 7-3s4 5 5 1 3-7 6-7"/></svg>';
    const def = G.LINE_TYPES[id];
    const dash = def.dash.length ? ' stroke-dasharray="' + def.dash.map((d) => d / 2).join(' ') + '"' : '';
    return '<svg viewBox="0 0 24 24" class="tool-ic"><path fill="none" stroke="' + def.color + '" stroke-width="' + (def.width * 0.8) + '"' + dash + ' d="M2 19L18 7"/><path fill="' + def.color + '" d="M22 4l-8 1.4 4.6 6.2z"/></svg>';
  }

  function setTool(id) {
    App.tool = id;
    document.querySelectorAll('.tool-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === id);
      b.setAttribute('aria-pressed', String(b.dataset.tool === id));
    });
    updateHint();
    closeDrawers();
    App.requestRender();
  }

  const dragToken = () => $('drag-token');

  // Fælles træk-og-slip fra listen. Virker også på touch, fordi den bygger på pointer-events.
  function makeDraggable(button, onDragStartToken, onPlace, onClick) {
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let active = false;
    button.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      active = true;
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      button.setPointerCapture(e.pointerId);
    });
    button.addEventListener('pointermove', (e) => {
      if (!active) return;
      if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 6) {
        dragging = true;
        onDragStartToken(dragToken());
        dragToken().hidden = false;
        closeDrawers();
      }
      if (dragging) {
        dragToken().style.transform = 'translate(' + (e.clientX - 20) + 'px,' + (e.clientY - 20) + 'px)';
      }
    });
    const finish = (e, cancelled) => {
      if (!active) return;
      active = false;
      dragToken().hidden = true;
      if (cancelled) return;
      if (dragging) {
        const w = Editor.dropPosition(e.clientX, e.clientY);
        if (w) onPlace(w);
      } else {
        onClick();
      }
    };
    button.addEventListener('pointerup', (e) => finish(e, false));
    button.addEventListener('pointercancel', (e) => finish(e, true));
    // Tastaturbrug: Enter/mellemrum svarer til et klik.
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClick(); }
    });
  }

  function freeSpot(x, y) {
    const positions = App.doc.players;
    let py = y;
    let tries = 0;
    while (positions.some((p) => G.dist(p, { x, y: py }) < 1) && tries < 12) {
      py = py + (y < 10 ? 1.3 : -1.3);
      tries += 1;
    }
    return { x, y: py };
  }

  function addPlayer(team, label, world) {
    if (App.doc.players.length >= G.LIMITS.players) { App.toast('Der kan højst være ' + G.LIMITS.players + ' spillere.', 'error'); return; }
    if (!App.isEditable()) App.selectStep(App.stepIndex);
    App.mutate((doc) => {
      const p = G.createPlayer(team, label, world.x, world.y);
      doc.players.push(p);
      App.selection = { kind: 'player', id: p.id };
    });
    setTool('select');
  }

  function addTeam(team) {
    if (!App.isEditable()) App.selectStep(App.stepIndex);
    App.mutate((doc) => {
      G.PALETTE[team].concat(G.PALETTE.gk).forEach((entry, i) => {
        const isGk = i === G.PALETTE[team].length;
        const usedGk = isGk && doc.players.some((p) => p.team === 'gk');
        const used = doc.players.some((p) => p.label === entry.label);
        if (used || usedGk || doc.players.length >= G.LIMITS.players) return;
        doc.players.push(G.createPlayer(isGk ? 'gk' : team, entry.label, entry.x, entry.y));
      });
    });
  }

  function placeBall(world) {
    if (!App.isEditable()) App.selectStep(App.stepIndex);
    App.mutate((doc) => {
      const near = Editor.playerNear(world);
      doc.ball = { onCourt: true, x: G.round2(world.x), y: G.round2(world.y), holder: near ? near.id : null };
      App.selection = { kind: 'ball' };
    });
    setTool('select');
  }

  function tokenButton(team, entry) {
    const btn = el('button', {
      class: 'token',
      type: 'button',
      title: entry.title ? entry.label + ' – ' + entry.title : entry.label,
      'aria-label': 'Tilføj ' + entry.label + (entry.title ? ', ' + entry.title : ''),
      text: entry.label,
    });
    btn.dataset.team = team;
    makeDraggable(btn, (tok) => {
      tok.className = 'drag-token';
      tok.textContent = entry.label;
      tok.style.background = App.doc.colors[team];
    }, (w) => addPlayer(team, entry.label, w), () => {
      const spot = entry.x != null ? entry : { x: 29, y: 10 };
      const inView = App.doc.court === 'half' ? { x: Math.max(spot.x, 20), y: spot.y } : spot;
      addPlayer(team, entry.label, freeSpot(inView.x, inView.y));
    });
    return btn;
  }

  function buildLeftPanel() {
    const panel = $('left-panel');
    panel.textContent = '';

    panel.append(el('h3', { text: 'Værktøjer' }));
    const tools = el('div', { class: 'tools' });
    TOOLS.forEach((t) => {
      const b = el('button', {
        class: 'tool-btn', type: 'button', title: t.label + ' (' + t.key + ')', onclick: () => setTool(t.id),
      });
      b.dataset.tool = t.id;
      b.innerHTML = toolIcon(t.id);
      b.append(el('span', { text: t.label }));
      tools.append(b);
    });
    panel.append(tools);

    const section = (title, team, whole) => {
      const head = el('div', { class: 'section-head' }, [el('h3', { text: title })]);
      if (whole) head.append(el('button', { class: 'link', type: 'button', text: 'Tilføj alle', onclick: () => addTeam(team) }));
      panel.append(head);
      const wrap = el('div', { class: 'tokens' });
      G.PALETTE[team].forEach((entry) => wrap.append(tokenButton(team, entry)));
      App.prefs.customPositions.filter((c) => c.team === team).forEach((c) => wrap.append(tokenButton(team, { label: c.label })));
      panel.append(wrap);
    };
    section('Angreb', 'attack', true);
    section('Forsvar', 'defense', true);
    section('Målmand', 'gk', false);

    panel.append(el('h3', { text: 'Bold' }));
    const ballBtn = el('button', { class: 'ball-btn', type: 'button', title: 'Træk bolden ind på banen', 'aria-label': 'Tilføj bold' });
    ballBtn.append(el('span', { class: 'ball-dot' }), el('span', { text: 'Håndbold' }));
    makeDraggable(ballBtn, (tok) => {
      tok.className = 'drag-token ball';
      tok.textContent = '';
      tok.style.background = '';
    }, placeBall, () => {
      if (App.doc.ball.onCourt) {
        App.selection = { kind: 'ball' };
        App.uiChange();
        App.toast('Bolden er allerede på banen.');
        return;
      }
      const holder = App.doc.players.find((p) => p.label === 'CB') || App.doc.players.find((p) => p.team === 'attack');
      placeBall(holder || { x: 28, y: 10 });
    });
    panel.append(ballBtn);

    panel.append(el('h3', { text: 'Egne positioner' }));
    const input = el('input', { placeholder: 'Fx HB', maxLength: G.LIMITS.label, 'aria-label': 'Forkortelse' });
    const teamSel = el('select', { 'aria-label': 'Hold' }, [
      el('option', { value: 'attack', text: 'Angreb' }),
      el('option', { value: 'defense', text: 'Forsvar' }),
      el('option', { value: 'gk', text: 'Målmand' }),
    ]);
    const form = el('form', {
      class: 'custom-form',
      onsubmit: (e) => {
        e.preventDefault();
        const label = input.value.trim();
        if (!label) return;
        if (!App.prefs.customPositions.some((c) => c.label === label && c.team === teamSel.value)) {
          App.prefs.customPositions.push({ label, team: teamSel.value });
          Store.savePrefs(App.prefs);
        }
        buildLeftPanel();
        updatePaletteColors();
      },
    }, [input, teamSel, el('button', { class: 'tbtn', type: 'submit', text: 'Tilføj' })]);
    panel.append(form);
    if (App.prefs.customPositions.length) {
      const list = el('ul', { class: 'custom-list' });
      App.prefs.customPositions.forEach((c, i) => {
        list.append(el('li', {}, [
          el('span', { text: c.label + ' (' + { attack: 'angreb', defense: 'forsvar', gk: 'målmand' }[c.team] + ')' }),
          el('button', {
            class: 'link', type: 'button', text: 'Fjern', 'aria-label': 'Fjern ' + c.label,
            onclick: () => {
              App.prefs.customPositions.splice(i, 1);
              Store.savePrefs(App.prefs);
              buildLeftPanel();
              updatePaletteColors();
            },
          }),
        ]));
      });
      panel.append(list);
    }
    setToolButtons();
  }

  function setToolButtons() {
    document.querySelectorAll('.tool-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === App.tool);
      b.setAttribute('aria-pressed', String(b.dataset.tool === App.tool));
    });
  }

  function updatePaletteColors() {
    document.querySelectorAll('.token').forEach((t) => {
      t.style.background = App.doc.colors[t.dataset.team];
    });
  }

  // ---------- Højre panel ----------

  // Kobler et inputfelt til dokumentet. Første tastetryk laver ét fortryd-punkt; panelet bygges ikke om undervejs.
  function bind(input, apply, opts) {
    let armed = false;
    const o = opts || {};
    input.addEventListener('focus', () => { armed = false; });
    input.addEventListener('input', () => {
      if (o.commitOnly) return;
      const value = readValue(input);
      if (value === undefined) return;
      if (!armed) { App.pushUndo(); armed = true; }
      apply(value);
      App.softChange();
    });
    input.addEventListener('change', () => {
      const value = readValue(input);
      if (value !== undefined) {
        if (!armed) App.pushUndo();
        apply(value);
        App.softChange();
      }
      armed = false;
      if (o.after) o.after();
    });
  }

  function readValue(input) {
    if (input.type === 'checkbox') return input.checked;
    if (input.type === 'number') {
      if (input.value === '') return null;
      const v = Number(input.value);
      return Number.isFinite(v) ? v : undefined;
    }
    return input.value;
  }

  const field = (label, control, hint) => el('label', { class: 'field' }, [
    el('span', { class: 'field-label', text: label }), control, hint ? el('small', { text: hint }) : null,
  ]);

  const section = (title, children) => el('section', { class: 'insp' }, [el('h3', { text: title })].concat(children));

  function textInput(value, max, apply) {
    const i = el('input', { type: 'text', value: value || '', maxLength: max, autocomplete: 'off' });
    bind(i, apply);
    return i;
  }

  function colorInput(value, apply) {
    const i = el('input', { type: 'color', value });
    bind(i, apply);
    return i;
  }

  function numberInput(value, min, max, step, apply, placeholder) {
    const i = el('input', { type: 'number', min, max, step, placeholder: placeholder || '' });
    i.value = value == null ? '' : String(value);
    bind(i, apply, { commitOnly: true });
    return i;
  }

  function teamLabel(team) { return { attack: 'Angreb', defense: 'Forsvar', gk: 'Målmand' }[team]; }

  function playerInspector(player) {
    const teamSel = el('select', {}, ['attack', 'defense', 'gk'].map((t) => el('option', { value: t, text: teamLabel(t), selected: player.team === t })));
    bind(teamSel, (v) => { player.team = v; });
    const custom = !!player.color;
    const color = colorInput(player.color || App.doc.colors[player.team], (v) => { player.color = v; });
    const reset = el('button', {
      class: 'link', type: 'button', text: 'Brug holdets farve', hidden: !custom,
      onclick: () => App.mutate(() => { player.color = null; }),
    });
    return section('Valgt spiller', [
      field('Position', textInput(player.label, G.LIMITS.label, (v) => { player.label = v; })),
      el('div', { class: 'row' }, [
        field('Nummer', textInput(player.number, G.LIMITS.number, (v) => { player.number = v; })),
        field('Hold', teamSel),
      ]),
      field('Navn', textInput(player.name, G.LIMITS.playerName, (v) => { player.name = v; })),
      el('div', { class: 'row center' }, [field('Egen farve', color), reset]),
      el('div', { class: 'row' }, [
        el('button', { class: 'tbtn', type: 'button', text: 'Kopiér', onclick: () => copyPlayer(player) }),
        el('button', { class: 'tbtn danger', type: 'button', text: 'Slet', onclick: deleteSelection }),
      ]),
    ]);
  }

  function copyPlayer(player) {
    if (App.doc.players.length >= G.LIMITS.players) { App.toast('Der kan højst være ' + G.LIMITS.players + ' spillere.', 'error'); return; }
    App.mutate((doc) => {
      const spot = App.view.clamp({ x: player.x - 1.2, y: player.y + 1.2 });
      const copy = G.createPlayer(player.team, player.label, spot.x, spot.y, { name: player.name, number: player.number, color: player.color });
      doc.players.push(copy);
      App.selection = { kind: 'player', id: copy.id };
    });
  }

  function ballInspector() {
    const c = App.compiled()[App.stepIndex];
    const children = [];
    if (App.stepIndex === 0 && !App.currentStep().lines.some(G.isBallLine)) {
      const sel = el('select', {}, [el('option', { value: '', text: 'Ingen – ligger frit', selected: !App.doc.ball.holder })]
        .concat(App.doc.players.map((p) => el('option', { value: p.id, text: p.label + (p.name ? ' – ' + p.name : ''), selected: App.doc.ball.holder === p.id }))));
      bind(sel, (v) => { App.doc.ball.holder = v || null; });
      children.push(field('Hvem har bolden', sel));
    } else {
      const holder = App.player(c.ballStart.holder);
      children.push(el('p', { class: 'muted', text: holder ? holder.label + ' har bolden, når trinnet starter.' : 'Bolden ligger frit, når trinnet starter.' }));
      children.push(el('p', { class: 'muted', text: 'Træk bolden for at lave en aflevering i dette trin.' }));
    }
    children.push(el('button', { class: 'tbtn danger', type: 'button', text: 'Fjern bold', onclick: deleteSelection }));
    return section('Bold', children);
  }

  function lineInspector(line) {
    const def = G.LINE_TYPES[line.type];
    const children = [];

    if (line.type !== 'free') {
      const options = G.isMove(line) ? ['run', 'defense'] : ['pass', 'shot'];
      const typeSel = el('select', {}, options.map((t) => el('option', { value: t, text: G.LINE_TYPES[t].label, selected: line.type === t })));
      typeSel.addEventListener('change', () => App.mutate(() => changeLineType(line, typeSel.value)));
      children.push(field('Type', typeSel));
    } else {
      children.push(el('p', { class: 'muted', text: def.label }));
    }

    if (line.type === 'pass') {
      const sel = el('select', {}, [el('option', { value: '', text: 'Et sted på banen', selected: !line.toPlayer })]
        .concat(App.doc.players.map((p) => el('option', { value: p.id, text: p.label, selected: line.toPlayer === p.id }))));
      sel.addEventListener('change', () => App.mutate(() => { line.toPlayer = sel.value || null; }));
      children.push(field('Modtager', sel));
    }

    children.push(el('div', { class: 'row center' }, [
      field('Farve', colorInput(line.color, (v) => { line.color = v; })),
      field('Tykkelse', (() => {
        const r = el('input', { type: 'range', min: 1, max: 10, step: 0.5, value: line.width });
        bind(r, (v) => { line.width = Number(v); });
        return r;
      })()),
    ]));

    if (line.type === 'free') {
      const arrow = el('input', { type: 'checkbox', checked: line.arrow });
      bind(arrow, (v) => { line.arrow = v; });
      const all = el('input', { type: 'checkbox', checked: line.allSteps });
      bind(all, (v) => { line.allSteps = v; });
      children.push(el('label', { class: 'check' }, [arrow, el('span', { text: 'Vis pilespids' })]));
      children.push(el('label', { class: 'check' }, [all, el('span', { text: 'Vis i alle trin' })]));
    } else {
      children.push(el('div', { class: 'row' }, [
        field('Starter efter (s)', numberInput(line.delay || 0, 0, G.LIMITS.maxDelay, 0.1, (v) => {
          line.delay = G.clamp(v == null ? 0 : v, 0, G.LIMITS.maxDelay);
        })),
        field('Varighed (s)', numberInput(line.time, G.LIMITS.minTime, G.LIMITS.maxDuration, 0.1, (v) => {
          if (v == null && G.isMove(line)) line.time = null;
          else if (v != null) line.time = G.clamp(v, G.LIMITS.minTime, G.LIMITS.maxDuration);
        }, G.isMove(line) ? 'Hele trinnet' : '')),
      ]));
      if (line.bend) {
        children.push(el('button', { class: 'link', type: 'button', text: 'Gør pilen lige', onclick: () => App.mutate(() => { line.bend = 0; }) }));
      } else {
        children.push(el('p', { class: 'muted', text: 'Træk i det blå håndtag for at gøre pilen buet.' }));
      }
    }
    children.push(el('button', { class: 'tbtn danger', type: 'button', text: 'Slet pil', onclick: deleteSelection }));
    return section('Valgt pil', children);
  }

  function changeLineType(line, type) {
    const oldDefault = G.LINE_TYPES[line.type];
    if (line.color === oldDefault.color) line.color = G.LINE_TYPES[type].color;
    if (line.width === oldDefault.width) line.width = G.LINE_TYPES[type].width;
    if (type === 'shot' && line.toPlayer) {
      const c = App.compiled()[App.stepIndex];
      const ev = c.ballEvents.find((e) => e.line === line);
      if (ev) line.to = G.pt(ev.to);
      line.toPlayer = null;
    }
    line.type = type;
    if (type === 'pass' && line.toPlayer === undefined) line.toPlayer = null;
  }

  function stepInspector() {
    const step = App.currentStep();
    const note = el('textarea', { rows: 3, maxLength: G.LIMITS.note, value: step.note, placeholder: 'Fx: CB skal vente med at krydse, indtil LB har fået bolden.' });
    bind(note, (v) => { step.note = v; });
    const dur = numberInput(step.duration, G.LIMITS.minDuration, G.LIMITS.maxDuration, 0.1, (v) => {
      if (v != null) step.duration = G.clamp(v, G.LIMITS.minDuration, G.LIMITS.maxDuration);
    });
    return section('Trin ' + (App.stepIndex + 1), [
      field('Note til trinnet', note),
      field('Varighed (sekunder)', dur),
    ]);
  }

  function systemInspector() {
    const doc = App.doc;
    const nameInput = textInput(doc.named ? doc.name : '', G.LIMITS.name, (v) => {
      doc.name = v.trim() || 'Uden navn';
      doc.named = !!v.trim();
      updateTitle();
    });
    nameInput.placeholder = 'Nyt system';
    const description = el('textarea', { rows: 3, maxLength: G.LIMITS.description, value: doc.description });
    bind(description, (v) => { doc.description = v; });
    const category = el('input', { type: 'text', value: doc.category, maxLength: G.LIMITS.category, autocomplete: 'off' });
    category.setAttribute('list', 'category-list');
    bind(category, (v) => { doc.category = v.trim() || 'Andet'; });
    const label = el('select', {}, [
      ['label', 'Position'], ['number', 'Nummer'], ['both', 'Position og nummer'],
    ].map(([v, t]) => el('option', { value: v, text: t, selected: doc.labelMode === v })));
    bind(label, (v) => { doc.labelMode = v; });
    const colors = el('div', { class: 'row' }, ['attack', 'defense', 'gk'].map((team) => field(teamLabel(team), colorInput(doc.colors[team], (v) => {
      doc.colors[team] = v;
      updatePaletteColors();
    }))));
    return section('System', [
      field('Navn', nameInput),
      field('Kategori', category),
      field('Beskrivelse', description),
      field('Vis på spillerne', label),
      colors,
    ]);
  }

  function buildRightPanel() {
    const panel = $('right-panel');
    panel.textContent = '';
    const sel = App.selection;
    if (sel) {
      if (sel.kind === 'player') {
        const p = App.player(sel.id);
        if (p) panel.append(playerInspector(p));
        else App.selection = null;
      } else if (sel.kind === 'ball') {
        if (App.doc.ball.onCourt) panel.append(ballInspector());
        else App.selection = null;
      } else if (sel.kind === 'line') {
        const found = App.findLine(sel.id);
        if (found) panel.append(lineInspector(found.line));
        else App.selection = null;
      }
    }
    panel.append(stepInspector());
    panel.append(systemInspector());
  }

  function deleteSelection() {
    const sel = App.selection;
    if (!sel || !App.isEditable()) return;
    App.mutate((doc) => {
      if (sel.kind === 'player') G.removePlayer(doc, sel.id);
      else if (sel.kind === 'ball') doc.ball.onCourt = false;
      else if (sel.kind === 'line') {
        doc.steps.forEach((s) => { s.lines = s.lines.filter((l) => l.id !== sel.id); });
      }
      App.selection = null;
    });
  }

  // ---------- Tidslinje ----------

  function buildSteps() {
    const compiled = App.compiled();
    const list = $('steps');
    const keep = list.scrollLeft;
    list.textContent = '';
    App.doc.steps.forEach((step, i) => {
      const b = el('button', {
        class: 'step-chip', type: 'button',
        'aria-current': i === App.stepIndex ? 'step' : null,
        title: step.note || ('Trin ' + (i + 1)),
        onclick: () => App.selectStep(i),
      }, [
        el('span', { class: 'chip-num', text: String(i + 1) }),
        el('span', { class: 'chip-body' }, [
          el('span', { class: 'chip-note', text: step.note || (step.lines.length ? step.lines.length + (step.lines.length === 1 ? ' pil' : ' pile') : 'Tomt trin') }),
          el('span', { class: 'chip-time', text: fmt(compiled[i].length) + ' s' }),
        ]),
        el('span', { class: 'chip-progress' }),
      ]);
      list.append(el('li', {}, [b]));
    });
    list.scrollLeft = keep;
    const current = list.children[App.stepIndex];
    if (current) {
      const r = current.getBoundingClientRect();
      const lr = list.getBoundingClientRect();
      if (r.left < lr.left || r.right > lr.right) list.scrollLeft += r.left - lr.left - 12;
    }
    updateTimelineState();
  }

  function updateTimelineState() {
    const compiled = App.compiled();
    const total = G.totalLength(compiled);
    const elapsed = App.ended ? total : G.elapsedTo(compiled, App.stepIndex, App.t);
    const seek = $('tl-seek');
    if (document.activeElement !== seek || App.playing) seek.value = total ? String(Math.round((elapsed / total) * 1000)) : '0';
    $('tl-time').textContent = fmt(elapsed) + ' / ' + fmt(total) + ' s';
    const icon = App.playing ? ICONS.pause : ICONS.play;
    const label = App.playing ? 'Pause' : 'Afspil';
    [$('tl-play'), $('pr-play')].forEach((b) => {
      if (b.dataset.state !== label) {
        b.innerHTML = icon;
        b.dataset.state = label;
        b.setAttribute('aria-label', label);
      }
    });
    document.querySelectorAll('.step-chip').forEach((chip, i) => {
      const active = i === App.stepIndex;
      chip.classList.toggle('active', active);
      const pr = chip.querySelector('.chip-progress');
      let w = 0;
      if (i < App.stepIndex && (App.playing || App.t > 0 || App.ended)) w = 100;
      if (active) w = App.ended ? 100 : (App.t / compiled[i].length) * 100;
      pr.style.width = w + '%';
    });
    $('step-left').disabled = App.stepIndex === 0;
    $('step-right').disabled = App.stepIndex === App.doc.steps.length - 1;
    $('step-del').disabled = App.doc.steps.length <= 1;
    $('tl-stop').disabled = !App.playing && App.t === 0 && !App.ended;
    updatePresentInfo();
  }

  function updatePresentInfo() {
    if (!App.presenting) return;
    const n = App.doc.steps.length;
    $('pr-pos').textContent = App.ended ? 'Slut' : 'Trin ' + (App.stepIndex + 1) + ' / ' + n;
    const note = App.currentStep().note;
    const noteEl = $('present-note');
    noteEl.textContent = note;
    noteEl.hidden = !note;
    // Banen rykker ned under noten, så teksten aldrig dækker målet. Pladsen holdes, så banen ikke hopper mellem trin.
    if (note) reservedNote = Math.max(reservedNote, noteEl.offsetHeight + 22);
    App.canvas.style.top = reservedNote + 'px';
    App.canvas.style.height = 'calc(100% - ' + reservedNote + 'px)';
  }

  function updateHint() {
    const hint = $('tool-hint');
    const first = App.stepIndex === 0;
    const texts = {
      select: first
        ? 'Trin 1 er startopstillingen: træk spillere og bold derhen, hvor de skal stå.'
        : 'Trin ' + (App.stepIndex + 1) + ': træk en spiller for at lave en løbepil, eller træk bolden for at aflevere.',
      run: 'Løbebane: træk fra en spiller derhen, hvor spilleren skal løbe.',
      defense: 'Forsvarsbevægelse: træk fra en spiller derhen, spilleren skal flytte sig.',
      pass: 'Aflevering: træk fra bolden til en medspiller – eller tryk på modtageren.',
      shot: 'Skud: træk fra bolden hen i målet.',
      free: 'Fri tegning: tegn med musen eller fingeren. Tryk Esc for at stoppe.',
    };
    hint.textContent = App.isEditable() ? texts[App.tool] : (App.playing ? 'Afspiller …' : 'Afspilning sat på pause.');
  }

  // ---------- Top og overlays ----------

  function updateTitle() {
    $('doc-title').textContent = App.doc.named ? App.doc.name : 'Nyt system (ikke navngivet)';
    document.title = (App.doc.named ? App.doc.name + ' – ' : '') + 'Grejs_Handball_Build';
  }

  function updateCourtButtons() {
    const half = App.doc.court === 'half';
    $('btn-half').setAttribute('aria-pressed', String(half));
    $('btn-full').setAttribute('aria-pressed', String(!half));
  }

  function updateOverlays() {
    $('empty-hint').hidden = App.doc.players.length > 0 || App.doc.ball.onCourt || App.presenting;
    const badge = $('offside-badge');
    if (App.doc.court === 'half') {
      const pose = G.poseAt(App.doc, App.compiled(), App.stepIndex, 0);
      const off = App.doc.players.filter((p) => pose.players[p.id].x < G.VIEWS.half.minX).length;
      badge.hidden = off === 0 || App.presenting;
      badge.textContent = off === 1
        ? '1 spiller står på den anden banehalvdel. Skift til fuld bane for at se spilleren.'
        : off + ' spillere står på den anden banehalvdel. Skift til fuld bane for at se dem.';
    } else {
      badge.hidden = true;
    }
    $('zoom-reset').textContent = Math.round(App.zoom * 100) + '%';
  }

  function setCourt(mode) {
    if (App.doc.court === mode) return;
    App.mutate((doc) => { doc.court = mode; });
    App.zoom = 1;
    App.panX = 0;
    App.panY = 0;
    App.uiChange();
  }

  function closeDrawers() {
    ['left-panel', 'right-panel'].forEach((id) => $(id).classList.remove('open'));
    $('btn-left').setAttribute('aria-expanded', 'false');
    $('btn-right').setAttribute('aria-expanded', 'false');
  }

  function toggleDrawer(id, btn) {
    const open = !$(id).classList.contains('open');
    closeDrawers();
    $(id).classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  }

  function closeMenu() {
    $('more-menu').hidden = true;
    $('btn-more').setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    const menu = $('more-menu');
    if (!menu.hidden) { closeMenu(); return; }
    menu.hidden = false;
    $('btn-more').setAttribute('aria-expanded', 'true');
    const r = $('btn-more').getBoundingClientRect();
    const w = menu.offsetWidth;
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.left = G.clamp(r.right - w, 8, window.innerWidth - w - 8) + 'px';
  }

  // ---------- Gem og bibliotek ----------

  function fillCategories() {
    const set = new Set(G.DEFAULT_CATEGORIES);
    Store.listSystems().forEach((d) => set.add(d.category));
    const list = $('category-list');
    list.textContent = '';
    set.forEach((c) => list.append(el('option', { value: c })));
    return [...set];
  }

  let saveMode = 'save';

  function openSaveDialog(mode) {
    saveMode = mode;
    const doc = App.doc;
    fillCategories();
    $('save-title').textContent = mode === 'saveas' ? 'Gem som nyt system' : 'Gem system';
    $('save-name').value = mode === 'saveas' ? (doc.name + ' (kopi)').slice(0, G.LIMITS.name) : (doc.named ? doc.name : '');
    $('save-category').value = doc.category;
    $('save-description').value = doc.description;
    $('save-dialog').showModal();
    $('save-name').select();
  }

  function submitSave(e) {
    e.preventDefault();
    const name = $('save-name').value.trim();
    if (!name) { $('save-name').focus(); return; }
    const category = $('save-category').value.trim() || 'Andet';
    const description = $('save-description').value;
    $('save-dialog').close();
    if (saveMode === 'saveas') {
      App.saveNow();
      const copy = G.duplicateSystem(App.doc, name);
      copy.named = true;
      copy.category = category;
      copy.description = description;
      Store.saveSystem(copy);
      App.openDoc(copy);
      App.selectStep(0);
      App.toast('Gemt som "' + name + '". Originalen er uændret.');
    } else {
      App.pushUndo();
      Object.assign(App.doc, { name, named: true, category, description });
      if (App.saveNow()) App.toast('"' + name + '" er gemt.');
      updateTitle();
      App.uiChange();
    }
  }

  function saveAction() {
    if (!App.doc.named) { openSaveDialog('save'); return; }
    if (App.saveNow()) App.toast('"' + App.doc.name + '" er gemt.');
  }

  function newSystem() {
    const hadContent = App.hasContent();
    App.saveNow();
    App.openDoc(G.createSystem());
    setTool('select');
    if (hadContent) App.toast('Det forrige system ligger i biblioteket.');
  }

  let libTab = 'mine';

  function openLibrary(tab) {
    App.saveNow();
    libTab = tab || 'mine';
    $('lib-search').value = '';
    $('library-dialog').showModal();
    renderLibrary(true);
  }

  function libThumb(doc) {
    const c = G.renderToCanvas(doc, 0, 208, { small: true });
    c.className = 'thumb';
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  function matches(doc, query, category) {
    if (category && doc.category !== category) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return doc.name.toLowerCase().includes(q) || doc.description.toLowerCase().includes(q) || doc.category.toLowerCase().includes(q);
  }

  function renderLibrary(resetCategory) {
    $('lib-tab-mine').setAttribute('aria-pressed', String(libTab === 'mine'));
    $('lib-tab-templates').setAttribute('aria-pressed', String(libTab === 'templates'));
    const mine = libTab === 'mine';
    const docs = mine ? Store.listSystems() : G.TEMPLATES.map(G.buildTemplate);
    const catSel = $('lib-category');
    const current = resetCategory ? '' : catSel.value;
    const cats = [...new Set(G.DEFAULT_CATEGORIES.concat(docs.map((d) => d.category)))]
      .filter((c) => docs.some((d) => d.category === c));
    catSel.textContent = '';
    catSel.append(el('option', { value: '', text: 'Alle kategorier' }));
    cats.forEach((c) => catSel.append(el('option', { value: c, text: c, selected: c === current })));

    const list = $('lib-list');
    list.textContent = '';
    const query = $('lib-search').value.trim();
    const shown = docs.filter((d) => matches(d, query, catSel.value));

    if (!shown.length) {
      list.append(el('p', { class: 'muted lib-empty', text: mine && !docs.length
        ? 'Du har ikke gemt nogen systemer endnu. Start fra en skabelon, eller tegn dit eget.'
        : 'Ingen systemer passer til søgningen.' }));
      return;
    }

    cats.forEach((cat) => {
      const group = shown.filter((d) => d.category === cat);
      if (!group.length) return;
      list.append(el('h3', { class: 'lib-group', text: cat }));
      const grid = el('div', { class: 'lib-grid' });
      group.forEach((doc, i) => grid.append(mine ? systemCard(doc) : templateCard(doc, i)));
      list.append(grid);
    });
  }

  function cardMeta(doc) {
    const date = new Date(doc.updatedAt).toLocaleDateString('da-DK');
    return doc.steps.length + ' trin · ' + doc.players.length + ' spillere · ' + date;
  }

  function systemCard(doc) {
    const open = () => {
      $('library-dialog').close();
      const fresh = Store.loadSystem(doc.id) || doc;
      App.openDoc(fresh);
      App.selectStep(0);
      setTool('select');
    };
    const isOpen = App.doc.id === doc.id;
    return el('article', { class: 'lib-card' + (isOpen ? ' current' : '') }, [
      el('button', { class: 'thumb-btn', type: 'button', onclick: open, 'aria-label': 'Åbn ' + doc.name }, [libThumb(doc)]),
      el('div', { class: 'lib-info' }, [
        el('strong', { text: (doc.named ? doc.name : 'Nyt system (ikke navngivet)') + (isOpen ? ' · åben nu' : '') }),
        doc.description ? el('p', { text: doc.description }) : null,
        el('small', { text: cardMeta(doc) }),
        el('div', { class: 'lib-actions' }, [
          el('button', { class: 'tbtn primary', type: 'button', text: 'Åbn', onclick: open }),
          el('button', {
            class: 'tbtn', type: 'button', text: 'Kopiér',
            onclick: () => {
              const copy = G.duplicateSystem(doc);
              copy.named = true;
              if (Store.saveSystem(copy)) App.toast('Kopi oprettet: ' + copy.name);
              else App.toast('Der er ikke plads til kopien i browseren.', 'error');
              renderLibrary();
            },
          }),
          el('button', { class: 'tbtn', type: 'button', text: 'Eksportér', onclick: () => exportSystems([doc], doc.name) }),
          el('button', {
            class: 'tbtn danger', type: 'button', text: 'Slet',
            onclick: async () => {
              $('library-dialog').close();
              const yes = await confirmDialog('Slet system?', '"' + doc.name + '" bliver slettet permanent fra denne browser.', 'Slet');
              if (yes) {
                Store.deleteSystem(doc.id);
                if (App.doc.id === doc.id) App.openDoc(G.createSystem());
                App.toast('"' + doc.name + '" er slettet.');
              }
              $('library-dialog').showModal();
              renderLibrary();
            },
          }),
        ]),
      ]),
    ]);
  }

  function templateCard(doc) {
    const use = () => {
      $('library-dialog').close();
      const fresh = G.TEMPLATES.map(G.buildTemplate).find((d) => d.name === doc.name) || doc;
      App.saveNow();
      App.openDoc(fresh);
      App.saveNow();
      App.selectStep(0);
      setTool('select');
      App.toast('Skabelonen er åbnet som dit eget system.');
    };
    return el('article', { class: 'lib-card' }, [
      el('button', { class: 'thumb-btn', type: 'button', onclick: use, 'aria-label': 'Brug ' + doc.name }, [libThumb(doc)]),
      el('div', { class: 'lib-info' }, [
        el('strong', { text: doc.name }),
        el('p', { text: doc.description }),
        el('small', { text: doc.steps.length + ' trin · ' + doc.players.length + ' spillere' }),
        el('div', { class: 'lib-actions' }, [el('button', { class: 'tbtn primary', type: 'button', text: 'Brug skabelon', onclick: use })]),
      ]),
    ]);
  }

  // ---------- Eksport, import, PNG og print ----------

  function exportSystems(docs, name) {
    App.saveNow();
    const blob = new Blob([Store.exportPayload(docs)], { type: 'application/json' });
    Store.download(Store.safeFileName(name) + '.json', blob);
  }

  async function importFiles(files) {
    let imported = 0;
    let firstDoc = null;
    for (const file of files) {
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error('Filen er større end 5 MB.');
        const docs = Store.parseImport(await file.text());
        docs.forEach((doc) => {
          // Et importeret system må aldrig overskrive et eksisterende.
          if (Store.loadSystem(doc.id)) doc.id = G.uid('sys');
          if (!Store.saveSystem(doc)) throw new Error('Der er ikke plads i browserens lager.');
          imported += 1;
          if (!firstDoc) firstDoc = doc;
        });
      } catch (err) {
        App.toast(file.name + ': ' + err.message, 'error');
      }
    }
    if (firstDoc) {
      if ($('library-dialog').open) $('library-dialog').close();
      App.openDoc(firstDoc);
      App.selectStep(0);
      setTool('select');
      App.toast(imported === 1 ? '"' + firstDoc.name + '" er importeret.' : imported + ' systemer er importeret.');
    }
  }

  function exportPng() {
    const step = App.stepIndex;
    const canvas = G.renderToCanvas(App.doc, step, 2400);
    canvas.toBlob((blob) => {
      if (!blob) { App.toast('Billedet kunne ikke laves.', 'error'); return; }
      Store.download(Store.safeFileName(App.doc.name) + '_trin_' + (step + 1) + '.png', blob);
    }, 'image/png');
  }

  async function printSystem() {
    const area = $('print-area');
    area.textContent = '';
    const doc = App.doc;
    area.append(el('h1', { text: doc.name }));
    area.append(el('p', { class: 'print-meta', text: doc.category + ' · ' + doc.steps.length + ' trin' }));
    if (doc.description) area.append(el('p', { text: doc.description }));
    const images = [];
    doc.steps.forEach((step, i) => {
      const img = el('img', { src: G.renderToCanvas(doc, i, 1400).toDataURL('image/png'), alt: 'Trin ' + (i + 1) });
      images.push(img);
      area.append(el('figure', {}, [
        img,
        el('figcaption', {}, [el('strong', { text: 'Trin ' + (i + 1) + (step.note ? ': ' : '') }), step.note ? step.note : '']),
      ]));
    });
    await Promise.all(images.map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
    window.addEventListener('afterprint', () => { area.textContent = ''; }, { once: true });
    window.print();
  }

  // ---------- Præsentation ----------

  let idleTimer = null;
  let reservedNote = 0;
  let savedView = null;

  function wakeBar() {
    if (!App.presenting) return;
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (App.presenting && !$('present-bar').matches(':hover')) document.body.classList.add('idle');
    }, 3500);
  }

  function enterPresentation() {
    App.saveNow();
    if (App.playing) App.pause();
    savedView = { zoom: App.zoom, panX: App.panX, panY: App.panY };
    App.zoom = 1;
    App.panX = 0;
    App.panY = 0;
    App.presenting = true;
    reservedNote = 0;
    App.showLines = true;
    $('pr-lines').textContent = 'Skjul pile';
    closeDrawers();
    closeMenu();
    document.body.classList.add('presenting');
    $('present-bar').hidden = false;
    updateFullscreenLabel();
    wakeBar();
    App.uiChange();
    App.onStepUi();
  }

  function exitPresentation() {
    App.presenting = false;
    document.body.classList.remove('presenting', 'idle');
    $('present-bar').hidden = true;
    $('present-note').hidden = true;
    App.canvas.style.top = '';
    App.canvas.style.height = '';
    clearTimeout(idleTimer);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (savedView) Object.assign(App, savedView);
    App.showLines = true;
    App.selectStep(App.stepIndex);
  }

  function updateFullscreenLabel() {
    const btn = $('pr-full');
    if (!document.fullscreenEnabled) { btn.hidden = true; return; }
    btn.textContent = document.fullscreenElement ? 'Luk fuldskærm' : 'Fuldskærm';
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => App.toast('Browseren tillod ikke fuldskærm.', 'error'));
  }

  // ---------- Tastatur ----------

  function onKey(e) {
    const tag = e.target && e.target.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
    const dialogOpen = !!document.querySelector('dialog[open]');
    if (dialogOpen) return;
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (typing) e.target.blur();
      saveAction();
      return;
    }
    if (typing) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (ctrl) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); App.undo(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); App.redo(); } else if (k === 'd') {
        e.preventDefault();
        if (App.selection && App.selection.kind === 'player' && App.isEditable()) {
          const p = App.player(App.selection.id);
          if (p) copyPlayer(p);
        }
      }
      return;
    }

    if (App.presenting) wakeBar();

    switch (e.key) {
      case ' ':
        if (tag === 'BUTTON') return; // Mellemrum på en knap aktiverer knappen.
        e.preventDefault();
        App.togglePlay();
        return;
      case 'ArrowRight':
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'ArrowDown':
        if (e.shiftKey && !App.presenting) {
          e.preventDefault();
          const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
          const a = App.view.toWorld({ x: 0, y: 0 });
          const b = App.view.toWorld({ x: dx, y: dy });
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          Editor.nudge(((b.x - a.x) / len) * 0.1, ((b.y - a.y) / len) * 0.1);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          if (e.key === 'ArrowRight') App.next();
          else App.prev();
        }
        return;
      case 'Home':
        e.preventDefault();
        App.toStart();
        return;
      case 'Escape':
        if (App.presenting) { exitPresentation(); return; }
        closeMenu();
        if (App.tool !== 'select') setTool('select');
        else if (App.selection) { App.selection = null; App.uiChange(); }
        return;
      default:
        break;
    }
    if (App.presenting) return;
    switch (e.key.toLowerCase()) {
      case 'delete':
      case 'backspace':
        e.preventDefault();
        deleteSelection();
        break;
      case 'v': setTool('select'); break;
      case 'l': setTool('run'); break;
      case 'a': setTool('pass'); break;
      case 's': setTool('shot'); break;
      case 'f': setTool('defense'); break;
      case 't': setTool('free'); break;
      case 'p': enterPresentation(); break;
      case '+': App.setZoom(App.zoom * 1.25); break;
      case '-': App.setZoom(App.zoom / 1.25); break;
      default: break;
    }
  }

  // ---------- Opstart ----------

  function fillSpeed(select) {
    SPEEDS.forEach((s) => select.append(el('option', { value: String(s), text: String(s).replace('.', ',') + 'x', selected: s === App.speed })));
    select.addEventListener('change', () => {
      App.speed = Number(select.value);
      App.prefs.speed = App.speed;
      Store.savePrefs(App.prefs);
      ['tl-speed', 'pr-speed'].forEach((id) => { $(id).value = select.value; });
    });
  }

  function wire() {
    $('btn-new').addEventListener('click', newSystem);
    $('btn-open').addEventListener('click', () => openLibrary('mine'));
    $('btn-save').addEventListener('click', saveAction);
    $('btn-saveas').addEventListener('click', () => openSaveDialog('saveas'));
    $('btn-undo').addEventListener('click', App.undo);
    $('btn-redo').addEventListener('click', App.redo);
    $('btn-half').addEventListener('click', () => setCourt('half'));
    $('btn-full').addEventListener('click', () => setCourt('full'));
    $('btn-present').addEventListener('click', enterPresentation);
    $('btn-more').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
    $('btn-left').addEventListener('click', () => toggleDrawer('left-panel', $('btn-left')));
    $('btn-right').addEventListener('click', () => toggleDrawer('right-panel', $('btn-right')));
    $('btn-empty-templates').addEventListener('click', () => openLibrary('templates'));
    document.addEventListener('click', (e) => { if (!e.target.closest('#more-menu')) closeMenu(); });
    $('stage').addEventListener('pointerdown', closeDrawers);

    $('more-menu').addEventListener('click', async (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (!act) return;
      closeMenu();
      if (act === 'export-json') exportSystems([App.doc], App.doc.name);
      else if (act === 'import-json') $('file-input').click();
      else if (act === 'export-all') {
        App.saveNow();
        const all = Store.listSystems();
        if (!all.length) App.toast('Der er ingen gemte systemer endnu.');
        else Store.download('grejs_handball_sikkerhedskopi_' + new Date().toISOString().slice(0, 10) + '.json', new Blob([Store.exportPayload(all)], { type: 'application/json' }));
      } else if (act === 'export-png') exportPng();
      else if (act === 'print') printSystem();
      else if (act === 'help') $('help-dialog').showModal();
      else if (act === 'clear') {
        const yes = await confirmDialog('Slet alt på banen?', 'Alle spillere, bolden, pile og trin i dette system bliver fjernet. Du kan fortryde med Fortryd.', 'Slet alt');
        if (yes) {
          App.mutate((doc) => {
            doc.players = [];
            doc.ball = { onCourt: false, x: 28, y: 10, holder: null };
            doc.steps = [G.createStep()];
            App.stepIndex = 0;
            App.selection = null;
          });
          App.selectStep(0);
        }
      }
    });

    $('file-input').addEventListener('change', (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (files.length) importFiles(files);
    });

    $('save-form').addEventListener('submit', submitSave);
    $('save-cancel').addEventListener('click', () => $('save-dialog').close());
    $('lib-close').addEventListener('click', () => $('library-dialog').close());
    $('lib-tab-mine').addEventListener('click', () => { libTab = 'mine'; renderLibrary(true); });
    $('lib-tab-templates').addEventListener('click', () => { libTab = 'templates'; renderLibrary(true); });
    $('lib-search').addEventListener('input', () => renderLibrary());
    $('lib-category').addEventListener('change', () => renderLibrary());
    $('lib-import').addEventListener('click', () => $('file-input').click());

    [['tl-start', 'start'], ['tl-prev', 'prev'], ['tl-next', 'next'], ['tl-stop', 'stop'], ['pr-start', 'start'], ['pr-prev', 'prev'], ['pr-next', 'next']]
      .forEach(([id, icon]) => { $(id).innerHTML = ICONS[icon]; });
    [['start', App.toStart], ['prev', App.prev], ['next', App.next]].forEach(([k, fn]) => {
      $('tl-' + k).addEventListener('click', fn);
      $('pr-' + k).addEventListener('click', fn);
    });
    $('tl-play').addEventListener('click', App.togglePlay);
    $('pr-play').addEventListener('click', App.togglePlay);
    $('tl-stop').addEventListener('click', App.stop);
    $('tl-seek').addEventListener('input', (e) => {
      App.seek((Number(e.target.value) / 1000) * G.totalLength(App.compiled()));
    });
    fillSpeed($('tl-speed'));
    fillSpeed($('pr-speed'));

    $('step-add').addEventListener('click', App.addStep);
    $('step-del').addEventListener('click', App.deleteStep);
    $('step-left').addEventListener('click', () => App.moveStep(-1));
    $('step-right').addEventListener('click', () => App.moveStep(1));

    $('zoom-in').addEventListener('click', () => App.setZoom(App.zoom * 1.25));
    $('zoom-out').addEventListener('click', () => App.setZoom(App.zoom / 1.25));
    $('zoom-reset').addEventListener('click', () => App.setZoom(1));

    $('pr-lines').addEventListener('click', () => {
      App.showLines = !App.showLines;
      $('pr-lines').textContent = App.showLines ? 'Skjul pile' : 'Vis pile';
      App.requestRender();
    });
    $('pr-full').addEventListener('click', toggleFullscreen);
    $('pr-exit').addEventListener('click', exitPresentation);
    document.addEventListener('fullscreenchange', updateFullscreenLabel);
    ['pointermove', 'pointerdown'].forEach((t) => document.addEventListener(t, wakeBar));

    App.onUiChange = () => {
      buildRightPanel();
      buildSteps();
      updateTitle();
      updateCourtButtons();
      updateOverlays();
      updatePaletteColors();
      updateHint();
    };
    App.onStepUi = () => { buildSteps(); updateOverlays(); };
    App.onTick = updateTimelineState;
    App.onZoom = updateOverlays;
    App.onPresentTap = App.next;
    App.onHistory = (canUndo, canRedo) => {
      $('btn-undo').disabled = !canUndo;
      $('btn-redo').disabled = !canRedo;
    };
    App.onSaved = (ok) => {
      const now = new Date();
      $('save-status').textContent = ok
        ? 'Gemt ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
        : 'Ikke gemt';
      $('save-status').classList.toggle('bad', !ok);
    };

    document.addEventListener('keydown', onKey);
    // Gem, inden siden lukkes eller skjules (fx når en tablet skifter app).
    window.addEventListener('pagehide', () => App.flushSave());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') App.flushSave(); });
    window.addEventListener('storage', (e) => {
      if (e.key === Store.PREFIX + App.doc.id && e.newValue && !Editor.isBusy()) {
        App.reloadFromStorage();
        App.toast('Systemet blev ændret i en anden fane. Den nyeste version er hentet.');
      }
    });
  }

  function boot() {
    App.prefs = Store.loadPrefs();
    App.speed = SPEEDS.includes(App.prefs.speed) ? App.prefs.speed : 1;
    Editor.init($('court'));
    const last = App.prefs.lastOpenId ? Store.loadSystem(App.prefs.lastOpenId) : null;
    App.doc = last || G.createSystem();
    buildLeftPanel();
    wire();
    App.openDoc(App.doc);
    if (!Store.available()) App.toast('Browseren tillader ikke lokal lagring her. Dit arbejde gemmes ikke, når siden lukkes.', 'error');
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => App.requestRender());
  }

  G.UI = { boot, setTool };
  boot();
})(window);
