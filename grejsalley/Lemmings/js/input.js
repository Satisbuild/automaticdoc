/* GrejsAlley Lemmings — input.js
 * Mouse, touch and keyboard. Tap/click assigns the selected skill to the
 * lemming under the pointer; dragging pans the camera; wheel/pinch zooms.
 */
(function (GL) {
  'use strict';

  const DRAG_START = 8;   // px before a press becomes a pan instead of a tap

  // Find the best lemming near a level point. Lemmings that can take the
  // selected skill win over ones that can't; then the closest one.
  GL.pickLemming = function (game, lx, ly, slack, skill) {
    let best = null, bestScore = Infinity;
    for (const L of game.lemmings) {
      if (!L.active) continue;
      const dx = Math.abs(lx - (L.x + 0.5)), dy = Math.abs(ly - (L.y - 5));
      if (dx > 3.5 + slack || dy > 6.5 + slack) continue;
      let score = dx * dx + dy * dy;
      if (skill && GL.canAssign(L, skill, game) === '') score -= 10000;
      if (score < bestScore) { bestScore = score; best = L; }
    }
    return best;
  };

  const Input = {
    app: null,
    pointers: new Map(),
    pan: null,
    pinch: null,
    mouse: { inside: false, x: 0, y: 0, type: 'mouse' },

    init(app) {
      this.app = app;
      const cv = app.canvas;
      cv.addEventListener('pointerdown', e => this.down(e));
      cv.addEventListener('pointermove', e => this.move(e));
      cv.addEventListener('pointerup', e => this.up(e));
      cv.addEventListener('pointercancel', e => this.cancel(e));
      cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { this.mouse.inside = false; app.setHover(null); } });
      cv.addEventListener('wheel', e => this.wheel(e), { passive: false });
      cv.addEventListener('contextmenu', e => e.preventDefault());

      const mm = document.getElementById('minimap');
      const mmMove = e => {
        const r = mm.getBoundingClientRect();
        const p = app.renderer.minimapToLevel(e.clientX - r.left, e.clientY - r.top);
        if (p) app.renderer.centerOn(p.x, p.y);
      };
      mm.addEventListener('pointerdown', e => { mm.setPointerCapture(e.pointerId); mmMove(e); });
      mm.addEventListener('pointermove', e => { if (e.buttons) mmMove(e); });

      window.addEventListener('keydown', e => this.key(e));
      // First interaction unlocks audio (browsers block autoplay).
      const unlock = () => GL.Audio.unlock();
      window.addEventListener('pointerdown', unlock, { capture: true });
      window.addEventListener('keydown', unlock, { capture: true });
    },

    local(e) {
      const r = this.app.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    },

    down(e) {
      const p = this.local(e);
      this.app.canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, p);
      this.mouse.type = e.pointerType;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        this.pan = null;
        return;
      }
      // right/middle mouse button pans immediately
      this.pan = { sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: e.button === 1 || e.button === 2, id: e.pointerId, button: e.button };
      if (this.pan.moved) this.app.canvas.classList.add('panning');
    },

    move(e) {
      const p = this.local(e);
      this.mouse.inside = true; this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.type = e.pointerType;
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
      const R = this.app.renderer;

      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        if (this.pinch.d > 0) R.zoomAt(cx, cy, d / this.pinch.d);
        R.cam.x -= (cx - this.pinch.cx) * R.dpr / R.cam.z;
        R.cam.y -= (cy - this.pinch.cy) * R.dpr / R.cam.z;
        R.clampCamera();
        this.pinch = { d, cx, cy };
        return;
      }
      if (this.pan && this.pan.id === e.pointerId) {
        if (!this.pan.moved && Math.hypot(p.x - this.pan.sx, p.y - this.pan.sy) > DRAG_START) {
          this.pan.moved = true;
          this.app.canvas.classList.add('panning');
        }
        if (this.pan.moved) {
          R.cam.x -= (p.x - this.pan.lx) * R.dpr / R.cam.z;
          R.cam.y -= (p.y - this.pan.ly) * R.dpr / R.cam.z;
          R.clampCamera();
          this.app.setHover(null);
        }
        this.pan.lx = p.x; this.pan.ly = p.y;
        if (this.pan.moved) return;
      }
      if (e.pointerType === 'mouse') this.updateHover(p);
    },

    up(e) {
      const p = this.local(e);
      this.pointers.delete(e.pointerId);
      if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; this.pan = null; return; }
      const pan = this.pan;
      this.pan = null;
      this.app.canvas.classList.remove('panning');
      if (!pan || pan.moved || pan.button > 0) return;
      // A tap/click: assign the selected skill to the lemming under it.
      const L = this.lemmingAt(p, e.pointerType);
      this.app.clickLemming(L, p);
      if (e.pointerType === 'mouse') this.updateHover(p);
    },

    cancel(e) {
      this.pointers.delete(e.pointerId);
      this.pan = null; this.pinch = null;
      this.app.canvas.classList.remove('panning');
    },

    lemmingAt(p, type) {
      const app = this.app, R = app.renderer;
      if (!app.game) return null;
      const lp = R.screenToLevel(p.x, p.y);
      // Touch gets a much bigger hit area so precise taps are not needed.
      const slackCss = type === 'mouse' ? 6 : 18;
      const slack = slackCss * R.dpr / R.cam.z;
      return GL.pickLemming(app.game, lp.x, lp.y, slack, app.selected);
    },

    updateHover(p) {
      this.app.setHover(this.lemmingAt(p, 'mouse'), p);
    },

    wheel(e) {
      e.preventDefault();
      const R = this.app.renderer, p = this.local(e);
      if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) {
        R.zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
      } else {
        const d = e.shiftKey ? e.deltaY : e.deltaX;
        R.cam.x += d * R.dpr / R.cam.z;
        R.clampCamera();
      }
    },

    key(e) {
      const app = this.app;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); app.escape(); return; }
      if (app.dialogOpen()) {
        if (k === 'Enter' && app.ui.defaultAction()) e.preventDefault();
        return;
      }
      if (app.screen !== 'game' || !app.game) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;   // keep browser shortcuts
      const R = app.renderer;
      switch (k) {
        case ' ': case 'p': case 'P': e.preventDefault(); app.togglePause(); break;
        case 'r': case 'R': e.preventDefault(); app.askRestart(); break;
        case '+': case '=': e.preventDefault(); app.changeSpeed(1); break;
        case '-': case '_': e.preventDefault(); app.changeSpeed(-1); break;
        case 'z': case 'Z': app.changeRate(-5); break;
        case 'x': case 'X': app.changeRate(5); break;
        case 'f': case 'F': app.toggleRelease(); break;
        case 'n': case 'N': app.nukePress(); break;
        case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); R.cam.x -= 40 * R.dpr / R.cam.z; R.clampCamera(); break;
        case 'ArrowRight': case 'd': case 'D': e.preventDefault(); R.cam.x += 40 * R.dpr / R.cam.z; R.clampCamera(); break;
        case 'ArrowUp': case 'w': case 'W': e.preventDefault(); R.cam.y -= 30 * R.dpr / R.cam.z; R.clampCamera(); break;
        case 'ArrowDown': case 's': case 'S': e.preventDefault(); R.cam.y += 30 * R.dpr / R.cam.z; R.clampCamera(); break;
        default:
          if (k >= '1' && k <= '8') { e.preventDefault(); app.selectSkill(GL.SKILL_IDS[+k - 1]); }
      }
    },

    // Mouse near the left/right edge scrolls the view (desktop convenience).
    edgeScroll(dt) {
      const app = this.app, m = this.mouse;
      if (!m.inside || m.type !== 'mouse' || this.pan || app.dialogOpen()) return;
      const R = app.renderer, w = app.canvas.clientWidth, edge = 28;
      let v = 0;
      if (m.x < edge) v = -1; else if (m.x > w - edge) v = 1;
      if (v) { R.cam.x += v * 260 * dt * R.dpr / R.cam.z; R.clampCamera(); }
    },
  };

  GL.Input = Input;
})(window.GL = window.GL || {});
