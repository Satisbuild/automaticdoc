// Programmets tilstand: det åbne system, fortryd/gentag, automatisk lagring, afspilning og tegning til skærmen.
(function (root) {
  'use strict';
  const G = root.GHB;
  const HISTORY_LIMIT = 150;
  const SAVE_DELAY = 400;

  const App = {
    doc: null,
    prefs: null,
    stepIndex: 0,
    t: 0,
    playing: false,
    ended: false,
    speed: 1,
    tool: 'select',
    selection: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    view: null,
    canvas: null,
    ctx: null,
    draftDraw: null,
    target: null,
    presenting: false,
    showLines: true,
    onUiChange: null,
    onStepUi: null,
    onTick: null,
  };

  let compiledCache = null;
  let undoStack = [];
  let redoStack = [];
  let saveTimer = null;
  let saveFailed = false;
  let renderQueued = false;
  let lastFrame = 0;
  let playOrigin = 0;
  let singleStop = null; // Trinnet, som "Næste" skal standse på. 'end' = slutstillingen.

  App.compiled = function () {
    if (!compiledCache) compiledCache = G.compile(App.doc);
    return compiledCache;
  };

  App.currentStep = function () { return App.doc.steps[App.stepIndex]; };

  App.findLine = function (id) {
    for (let i = 0; i < App.doc.steps.length; i += 1) {
      const line = App.doc.steps[i].lines.find((l) => l.id === id);
      if (line) return { line, stepIndex: i };
    }
    return null;
  };

  App.player = function (id) { return App.doc.players.find((p) => p.id === id) || null; };

  // ---------- Ændringer og historik ----------

  function snapshot() {
    return JSON.stringify({ doc: App.doc, stepIndex: App.stepIndex, selection: App.selection });
  }

  App.pushUndo = function () {
    undoStack.push(snapshot());
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    App.refreshHistoryButtons();
  };

  App.refreshHistoryButtons = function () {
    if (App.onHistory) App.onHistory(undoStack.length > 0, redoStack.length > 0);
  };

  function restore(json) {
    const data = JSON.parse(json);
    App.doc = data.doc;
    App.stepIndex = G.clamp(data.stepIndex, 0, App.doc.steps.length - 1);
    App.selection = data.selection;
    App.t = 0;
    App.playing = false;
    App.ended = false;
    App.softChange();
    App.uiChange();
  }

  App.undo = function () {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    App.refreshHistoryButtons();
  };

  App.redo = function () {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    App.refreshHistoryButtons();
  };

  // Lille ændring undervejs (træk, tekstfelt): gem og tegn, men byg ikke panelerne om.
  App.softChange = function () {
    compiledCache = null;
    App.scheduleSave();
    App.requestRender();
    if (App.onStepUi) App.onStepUi();
  };

  // En afsluttet handling, der kan fortrydes.
  App.mutate = function (fn) {
    App.pushUndo();
    fn(App.doc);
    App.softChange();
    App.uiChange();
  };

  App.uiChange = function () {
    if (App.onUiChange) App.onUiChange();
    App.requestRender();
  };

  // ---------- Lagring ----------

  function hasContent(doc) {
    return doc.named || doc.players.length > 0 || doc.ball.onCourt || doc.description !== ''
      || doc.steps.length > 1 || doc.steps.some((s) => s.lines.length > 0 || s.note !== '');
  }

  App.scheduleSave = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(App.saveNow, SAVE_DELAY);
  };

  App.saveNow = function () {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!App.doc || !hasContent(App.doc)) return true;
    App.doc.updatedAt = Date.now();
    const ok = G.Store.saveSystem(App.doc);
    App.prefs.lastOpenId = App.doc.id;
    G.Store.savePrefs(App.prefs);
    if (App.onSaved) App.onSaved(ok);
    if (!ok && !saveFailed) App.toast('Kunne ikke gemme i browseren. Lageret kan være fuldt – eksportér systemet som fil.', 'error');
    saveFailed = !ok;
    return ok;
  };

  App.flushSave = function () { if (saveTimer) App.saveNow(); };

  App.hasContent = () => hasContent(App.doc);

  App.openDoc = function (doc) {
    App.flushSave();
    App.doc = doc;
    App.stepIndex = 0;
    App.t = 0;
    App.playing = false;
    App.ended = false;
    App.selection = null;
    App.zoom = 1;
    App.panX = 0;
    App.panY = 0;
    undoStack = [];
    redoStack = [];
    compiledCache = null;
    App.refreshHistoryButtons();
    if (hasContent(doc)) {
      App.prefs.lastOpenId = doc.id;
      G.Store.savePrefs(App.prefs);
    }
    App.uiChange();
    if (App.onStepUi) App.onStepUi();
  };

  // En anden fane har gemt samme system: vis den nyeste version i stedet for at overskrive den senere.
  App.reloadFromStorage = function () {
    clearTimeout(saveTimer);
    saveTimer = null;
    const fresh = G.Store.loadSystem(App.doc.id);
    if (!fresh) return;
    const step = App.stepIndex;
    App.openDoc(fresh);
    App.selectStep(Math.min(step, fresh.steps.length - 1));
  };

  // ---------- Afspilning ----------

  App.isEditable = () => !App.playing && App.t === 0 && !App.ended;

  function frame(now) {
    if (!App.playing) return;
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    advance(dt * App.speed);
    App.draw();
    if (App.onTick) App.onTick();
    if (App.playing) requestAnimationFrame(frame);
    else App.uiChange();
  }

  function advance(dt) {
    const compiled = App.compiled();
    App.t += dt;
    while (App.t >= compiled[App.stepIndex].length) {
      const over = App.t - compiled[App.stepIndex].length;
      if (App.stepIndex >= compiled.length - 1) {
        App.t = compiled[App.stepIndex].length;
        App.ended = true;
        App.playing = false;
        singleStop = null;
        return;
      }
      App.stepIndex += 1;
      App.t = over;
      if (singleStop === App.stepIndex) {
        App.t = 0;
        App.playing = false;
        singleStop = null;
        return;
      }
    }
  }

  function startLoop() {
    App.playing = true;
    App.selection = null;
    lastFrame = performance.now();
    requestAnimationFrame(frame);
    App.uiChange();
  }

  App.play = function () {
    if (App.playing) return;
    if (App.ended) {
      App.stepIndex = 0;
      App.t = 0;
      App.ended = false;
    }
    if (App.t === 0) playOrigin = App.stepIndex;
    singleStop = null;
    startLoop();
  };

  App.pause = function () {
    App.playing = false;
    singleStop = null;
    App.uiChange();
  };

  App.togglePlay = function () { if (App.playing) App.pause(); else App.play(); };

  // Stop: afbryd og vend tilbage til det trin, afspilningen startede fra.
  App.stop = function () {
    App.playing = false;
    singleStop = null;
    App.ended = false;
    App.t = 0;
    App.stepIndex = G.clamp(playOrigin, 0, App.doc.steps.length - 1);
    App.uiChange();
  };

  App.toStart = function () {
    App.playing = false;
    singleStop = null;
    App.ended = false;
    App.t = 0;
    App.stepIndex = 0;
    playOrigin = 0;
    App.uiChange();
  };

  // Næste: afspil pilene i dette trin og stands klar til det næste.
  // Trykkes der undervejs i en animation, springes straks frem.
  App.next = function () {
    if (App.ended) return;
    const last = App.doc.steps.length - 1;
    if (App.playing || App.t > 0) {
      const target = singleStop != null && App.playing ? singleStop : App.stepIndex + 1;
      App.playing = false;
      singleStop = null;
      if (target > last) {
        App.stepIndex = last;
        App.t = App.compiled()[last].length;
        App.ended = true;
      } else {
        App.stepIndex = target;
        App.t = 0;
      }
      playOrigin = App.stepIndex;
      App.uiChange();
      return;
    }
    playOrigin = App.stepIndex;
    singleStop = App.stepIndex < last ? App.stepIndex + 1 : null;
    startLoop();
  };

  App.prev = function () {
    App.playing = false;
    singleStop = null;
    if (App.ended) {
      App.ended = false;
      App.t = 0;
    } else if (App.t > 0) {
      App.t = 0;
    } else if (App.stepIndex > 0) {
      App.stepIndex -= 1;
    }
    playOrigin = App.stepIndex;
    App.uiChange();
  };

  App.selectStep = function (i) {
    App.playing = false;
    singleStop = null;
    App.ended = false;
    App.t = 0;
    App.stepIndex = G.clamp(i, 0, App.doc.steps.length - 1);
    playOrigin = App.stepIndex;
    if (App.selection && App.selection.kind === 'line') {
      const found = App.findLine(App.selection.id);
      if (!found || (found.stepIndex !== App.stepIndex && !found.line.allSteps)) App.selection = null;
    }
    App.uiChange();
  };

  // Skyderen på tidslinjen
  App.seek = function (seconds) {
    const compiled = App.compiled();
    const total = G.totalLength(compiled);
    App.playing = false;
    singleStop = null;
    if (seconds >= total - 0.001) {
      App.stepIndex = compiled.length - 1;
      App.t = compiled[App.stepIndex].length;
      App.ended = true;
    } else {
      const at = G.locate(compiled, Math.max(0, seconds));
      App.stepIndex = at.step;
      App.t = at.t;
      App.ended = false;
    }
    App.selection = null;
    App.uiChange();
  };

  // ---------- Trin ----------

  App.addStep = function () {
    if (App.doc.steps.length >= G.LIMITS.steps) { App.toast('Der kan højst være ' + G.LIMITS.steps + ' trin.', 'error'); return; }
    App.mutate((doc) => { doc.steps.splice(App.stepIndex + 1, 0, G.createStep()); });
    App.selectStep(App.stepIndex + 1);
  };

  App.deleteStep = function () {
    if (App.doc.steps.length <= 1) { App.toast('Et system skal have mindst ét trin.'); return; }
    App.mutate((doc) => { doc.steps.splice(App.stepIndex, 1); });
    App.selectStep(Math.min(App.stepIndex, App.doc.steps.length - 1));
  };

  App.moveStep = function (delta) {
    const to = App.stepIndex + delta;
    if (to < 0 || to >= App.doc.steps.length) return;
    App.mutate((doc) => {
      const [s] = doc.steps.splice(App.stepIndex, 1);
      doc.steps.splice(to, 0, s);
    });
    App.selectStep(to);
  };

  // ---------- Tegning ----------

  App.requestRender = function () {
    if (renderQueued || !App.canvas) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      App.draw();
    });
  };

  App.draw = function () {
    const canvas = App.canvas;
    if (!canvas || !App.doc) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = App.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    App.view = G.makeView(App.doc.court, rect.width, rect.height, App.zoom, App.panX, App.panY);
    G.drawScene(ctx, App.view, App.doc, App.compiled(), {
      stepIndex: App.stepIndex,
      t: App.t,
      ended: App.ended,
      animating: App.playing || App.t > 0,
      showLines: App.showLines,
      selection: App.presenting ? null : App.selection,
      target: App.target,
      draft: App.draftDraw,
    });
  };

  App.setZoom = function (zoom, cx, cy) {
    const next = G.clamp(zoom, 1, 5);
    const view = App.view;
    if (!view) return;
    const px = cx == null ? view.width / 2 : cx;
    const py = cy == null ? view.height / 2 : cy;
    const k = next / App.zoom;
    const fit = G.makeView(App.doc.court, view.width, view.height, next, 0, 0);
    App.panX = next === 1 ? 0 : px - (px - view.ox) * k - fit.ox;
    App.panY = next === 1 ? 0 : py - (py - view.oy) * k - fit.oy;
    App.zoom = next;
    App.requestRender();
    if (App.onZoom) App.onZoom();
  };

  G.App = App;
})(window);
