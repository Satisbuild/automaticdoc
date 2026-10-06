/* Break-room Tetris. Guideline-style rules: SRS rotation with wall kicks, 7-bag randomizer,
   hold, ghost piece, move-reset lock delay, T-spins, back-to-back and combos. */
(() => {
	'use strict';

	// ------------------------------------------------------------------ rules
	const COLS = 10;
	const VISIBLE = 20;
	const BUFFER = 20;
	const ROWS = VISIBLE + BUFFER;
	const LOCK_DELAY = 500;
	const MAX_LOCK_RESETS = 15;
	const SPRINT_LINES = 40;
	const ULTRA_MS = 120000;
	const CLEAR_NAMES = ['', 'Single', 'Double', 'Triple', 'Tetris'];

	const COLORS = { I: '#3fc1cf', O: '#f2c14e', T: '#a678d6', S: '#5cbf86', Z: '#e8665a', J: '#4a7dd8', L: '#ef9147' };
	const SHAPES = {
		I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
		J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
		L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
		O: [[1, 1], [1, 1]],
		S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
		T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
		Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
	};
	const TYPES = Object.keys(SHAPES);

	// SRS rotation states are plain matrix rotations inside the bounding box.
	const rotateCW = m => m.map((row, y) => row.map((_, x) => m[m.length - 1 - x][y]));
	const ROT = {};
	for (const t of TYPES) {
		let m = SHAPES[t];
		ROT[t] = [];
		for (let r = 0; r < 4; r++) {
			const cells = [];
			m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
			ROT[t].push(cells);
			m = rotateCW(m);
		}
	}

	// Kick tables are written y-up (as in the SRS spec) and flipped to the y-down grid.
	const kicks = list => list.map(([x, y]) => [x, -y]);
	const KICKS_JLSTZ = {
		'0>1': kicks([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
		'1>0': kicks([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
		'1>2': kicks([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
		'2>1': kicks([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
		'2>3': kicks([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
		'3>2': kicks([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
		'3>0': kicks([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
		'0>3': kicks([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]])
	};
	const KICKS_I = {
		'0>1': kicks([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]),
		'1>0': kicks([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]),
		'1>2': kicks([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]),
		'2>1': kicks([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]),
		'2>3': kicks([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]),
		'3>2': kicks([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]),
		'3>0': kicks([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]),
		'0>3': kicks([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]])
	};
	const KICKS_180 = {
		'0>2': kicks([[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]]),
		'2>0': kicks([[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]]),
		'1>3': kicks([[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]]),
		'3>1': kicks([[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]])
	};

	// Guideline gravity curve, in ms per row. Level 20 and above is effectively 20G.
	const gravityMs = level => {
		const l = Math.min(level, 20);
		return Math.pow(0.8 - (l - 1) * 0.007, l - 1) * 1000;
	};

	const MODES = {
		marathon: { name: 'Marathon', desc: 'Endless. Speeds up every 10 lines.' },
		sprint: { name: 'Sprint', desc: 'Clear 40 lines as fast as you can.' },
		ultra: { name: 'Ultra', desc: 'Highest score in two minutes.' },
		zen: { name: 'Zen', desc: 'No gravity, no game over. Just stack.' }
	};
	const MODE_ORDER = Object.keys(MODES);

	// ------------------------------------------------------------------ storage & settings
	const store = {
		get(key, fallback) {
			try {
				const raw = localStorage.getItem(key);
				return raw === null ? fallback : JSON.parse(raw);
			} catch {
				return fallback;
			}
		},
		set(key, value) {
			try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
		}
	};

	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const ACTIONS = ['left', 'right', 'soft', 'hard', 'cw', 'ccw', 'r180', 'hold', 'pause', 'restart'];
	const ACTION_LABELS = {
		left: 'Move left', right: 'Move right', soft: 'Soft drop', hard: 'Hard drop',
		cw: 'Rotate clockwise', ccw: 'Rotate counter-clockwise', r180: 'Rotate 180°',
		hold: 'Hold', pause: 'Pause', restart: 'Restart'
	};
	const DEFAULT_KEYS = {
		left: ['ArrowLeft'], right: ['ArrowRight'], soft: ['ArrowDown'], hard: ['Space'],
		cw: ['ArrowUp', 'KeyX'], ccw: ['KeyZ'], r180: ['KeyA'], hold: ['KeyC', 'ShiftLeft'],
		pause: ['Escape', 'KeyP'], restart: ['KeyR']
	};
	const HANDLING_DEFAULTS = { das: 150, arr: 30, sdf: 20 };
	const DEFAULTS = {
		...HANDLING_DEFAULTS,
		previews: 5, ghost: true, grid: true, shake: !reducedMotion, effects: true,
		sfx: 50, music: false, musicVol: 40, muted: false, touch: 'auto', theme: 'auto'
	};

	const settings = loadSettings();
	function loadSettings() {
		const saved = store.get('tetris.settings', {}) || {};
		const s = { ...DEFAULTS, ...saved, keys: {} };
		for (const a of ACTIONS) {
			const keys = saved.keys && saved.keys[a];
			s.keys[a] = Array.isArray(keys) ? keys.slice(0, 3) : DEFAULT_KEYS[a].slice();
		}
		return s;
	}
	const saveSettings = () => store.set('tetris.settings', settings);

	let scores = store.get('tetris.scores', {}) || {};
	const SORTS = {
		marathon: (a, b) => b.score - a.score,
		ultra: (a, b) => b.score - a.score,
		sprint: (a, b) => a.time - b.time
	};
	function recordScore(mode, entry) {
		if (!SORTS[mode]) return -1;
		const list = (scores[mode] || []).concat(entry).sort(SORTS[mode]);
		const rank = list.indexOf(entry);
		scores[mode] = list.slice(0, 5);
		store.set('tetris.scores', scores);
		return rank < 5 ? rank : -1;
	}
	const bestOf = mode => (scores[mode] && scores[mode][0]) || null;

	// ------------------------------------------------------------------ formatting
	const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
	const fmtNum = n => Math.round(n).toLocaleString('en-US');
	function fmtTime(ms) {
		ms = Math.max(0, ms);
		const m = Math.floor(ms / 60000);
		const s = Math.floor(ms / 1000) % 60;
		const cs = Math.floor(ms / 10) % 100;
		return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
	}
	const fmtDate = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	const KEY_NAMES = {
		ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Escape: 'Esc',
		ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
		AltLeft: 'L Alt', AltRight: 'R Alt', Enter: 'Enter', Backspace: 'Bksp', Tab: 'Tab', CapsLock: 'Caps',
		Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
		Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`'
	};
	function keyName(code) {
		if (KEY_NAMES[code]) return KEY_NAMES[code];
		if (code.startsWith('Key')) return code.slice(3);
		if (code.startsWith('Digit')) return code.slice(5);
		if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
		return code;
	}

	// ------------------------------------------------------------------ dom
	const $ = sel => document.querySelector(sel);
	const $$ = sel => Array.from(document.querySelectorAll(sel));
	const rootEl = document.documentElement;
	const frame = $('#frame');
	const boardCanvas = $('#board');
	const holdCanvas = $('#hold');
	const nextCanvas = $('#next');
	const toastLayer = $('#toasts');
	const countEl = $('#count');
	const badgeB2b = $('#badge-b2b');
	const badgeCombo = $('#badge-combo');
	const goalBar = $('#goal-bar');
	let bctx, hctx, nctx;
	let cell = 28;
	let previewCell = 20;
	let holdSize = { w: 0, h: 0 };
	let nextSize = { w: 0, h: 0 };

	// ------------------------------------------------------------------ game state
	let state = 'menu'; // menu | countdown | playing | paused | ending | over
	let game = null;
	let countdown = null;
	let ending = null;
	let overShownAt = 0;
	let selectedMode = MODE_ORDER.includes(store.get('tetris.mode')) ? store.get('tetris.mode') : 'marathon';
	let startLevel = clamp(Number(store.get('tetris.level', 1)) || 1, 1, 15);

	const input = { dir: 0, das: 0, arr: 0, soft: false };
	const held = Object.fromEntries(ACTIONS.map(a => [a, 0]));
	const keysDown = new Set();
	const fx = { particles: [], flashes: [], lockFlashes: [], trails: [], kick: 0, score: 0 };

	function createGame(mode) {
		return {
			mode,
			board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
			bag: [], queue: [], hold: null, holdUsed: false, piece: null,
			score: 0, lines: 0, level: mode === 'marathon' ? startLevel : 1, startLevel: mode === 'marathon' ? startLevel : 1,
			combo: -1, b2b: false, pieces: 0, time: 0,
			gravityAcc: 0, lockTimer: 0, lockResets: 0, lowestY: 0, lastAction: null, lastKick: 0,
			stats: { tetrises: 0, tspins: 0, maxCombo: 0, perfect: 0 },
			result: null
		};
	}

	function refillQueue() {
		while (game.queue.length < 8) {
			if (!game.bag.length) {
				game.bag = TYPES.slice();
				for (let i = game.bag.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[game.bag[i], game.bag[j]] = [game.bag[j], game.bag[i]];
				}
			}
			game.queue.push(game.bag.pop());
		}
	}

	const cellsOf = (type, rot, x, y) => ROT[type][rot].map(([cx, cy]) => [x + cx, y + cy]);

	function fits(type, rot, x, y) {
		for (const [cx, cy] of ROT[type][rot]) {
			const bx = x + cx, by = y + cy;
			if (bx < 0 || bx >= COLS || by >= ROWS) return false;
			if (by >= 0 && game.board[by][bx]) return false;
		}
		return true;
	}

	const solid = (x, y) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && !!game.board[y][x]);

	function grounded() {
		const p = game.piece;
		return !!p && !fits(p.type, p.rot, p.x, p.y + 1);
	}

	// Pieces appear in the top visible rows; if blocked they may nudge up into the buffer.
	function spawn(type) {
		const x = type === 'O' ? 4 : 3;
		const top = Math.min(...ROT[type][0].map(c => c[1]));
		const baseY = BUFFER - top;
		for (let lift = 0; lift < 3; lift++) {
			if (fits(type, 0, x, baseY - lift)) {
				game.piece = { type, rot: 0, x, y: baseY - lift };
				game.lowestY = game.piece.y;
				game.lockTimer = 0;
				game.lockResets = 0;
				game.gravityAcc = 0;
				game.lastAction = null;
				return true;
			}
		}
		return false;
	}

	function takeFromQueue() {
		refillQueue();
		const type = game.queue.shift();
		refillQueue();
		return type;
	}

	function spawnOrTopOut(type) {
		if (spawn(type)) return;
		if (game.mode === 'zen') {
			zenReset();
			spawn(type);
		} else {
			game.piece = null;
			endGame(false);
		}
	}

	function nextPiece() {
		game.holdUsed = false;
		spawnOrTopOut(takeFromQueue());
	}

	function zenReset() {
		game.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
		game.combo = -1;
		toast([{ text: 'Fresh board', cls: 'main' }]);
		sfx('zen');
	}

	function noteLower(p) {
		if (p.y > game.lowestY) {
			game.lowestY = p.y;
			game.lockResets = 0;
			game.lockTimer = 0;
		}
	}

	function afterManipulation(wasGrounded) {
		if ((wasGrounded || grounded()) && game.lockResets < MAX_LOCK_RESETS) {
			game.lockTimer = 0;
			game.lockResets++;
		}
	}

	function shift(dx) {
		const p = game.piece;
		if (!p || !fits(p.type, p.rot, p.x + dx, p.y)) return false;
		const wasGrounded = grounded();
		p.x += dx;
		game.lastAction = 'move';
		afterManipulation(wasGrounded);
		return true;
	}

	function dropOne() {
		const p = game.piece;
		if (!p || !fits(p.type, p.rot, p.x, p.y + 1)) return false;
		p.y++;
		game.lastAction = 'drop';
		noteLower(p);
		return true;
	}

	function rotate(dir) {
		const p = game.piece;
		if (!p || p.type === 'O') return false;
		const to = (p.rot + dir + 4) % 4;
		const table = dir === 2 ? KICKS_180 : p.type === 'I' ? KICKS_I : KICKS_JLSTZ;
		const list = table[p.rot + '>' + to];
		const wasGrounded = grounded();
		for (let i = 0; i < list.length; i++) {
			const [kx, ky] = list[i];
			if (fits(p.type, to, p.x + kx, p.y + ky)) {
				p.x += kx;
				p.y += ky;
				p.rot = to;
				game.lastAction = 'rotate';
				game.lastKick = dir === 2 ? -1 : i;
				noteLower(p);
				afterManipulation(wasGrounded);
				sfx('rotate');
				return true;
			}
		}
		return false;
	}

	function hardDrop() {
		const p = game.piece;
		const startY = p.y;
		while (dropOne()) { /* fall */ }
		const distance = p.y - startY;
		game.score += distance * 2;
		if (distance > 0 && settings.effects) {
			const tops = {};
			for (const [x, y] of cellsOf(p.type, p.rot, p.x, p.y)) tops[x] = Math.min(tops[x] ?? Infinity, y);
			fx.trails.push({ tops, distance, color: COLORS[p.type], t: 0 });
		}
		kick(3);
		sfx('hard');
		lockPiece();
	}

	function hold() {
		if (game.holdUsed) {
			sfx('denied');
			return;
		}
		const current = game.piece.type;
		const type = game.hold || takeFromQueue();
		game.hold = current;
		sfx('hold');
		spawnOrTopOut(type);
		game.holdUsed = true;
	}

	// Three-corner rule; front corners decide full vs mini (the last SRS kick always counts as full).
	function detectTSpin(p) {
		if (p.type !== 'T' || game.lastAction !== 'rotate') return null;
		const corners = [[0, 0], [2, 0], [2, 2], [0, 2]].map(([cx, cy]) => solid(p.x + cx, p.y + cy));
		if (corners.filter(Boolean).length < 3) return null;
		const [a, b] = [[0, 1], [1, 2], [2, 3], [3, 0]][p.rot];
		return (corners[a] && corners[b]) || game.lastKick === 4 ? 'full' : 'mini';
	}

	function lockPiece() {
		const p = game.piece;
		const cells = cellsOf(p.type, p.rot, p.x, p.y);
		const tspin = detectTSpin(p);
		let lockedOut = true;
		for (const [x, y] of cells) {
			if (y >= 0) game.board[y][x] = p.type;
			if (y >= BUFFER) lockedOut = false;
		}
		game.piece = null;
		game.pieces++;
		if (settings.effects) fx.lockFlashes.push({ cells, t: 0 });

		if (lockedOut) {
			if (game.mode !== 'zen') return endGame(false);
			zenReset();
			return nextPiece();
		}

		const cleared = clearLines();
		applyClear(cleared, tspin);

		if (game.mode === 'sprint' && game.lines >= SPRINT_LINES) return endGame(true);
		nextPiece();
	}

	function clearLines() {
		const full = [];
		for (let y = 0; y < ROWS; y++) if (game.board[y].every(Boolean)) full.push(y);
		if (!full.length) return 0;
		for (const y of full) {
			const row = y - BUFFER;
			if (settings.effects) {
				fx.flashes.push({ row, t: 0 });
				game.board[y].forEach((type, x) => {
					for (let i = 0; i < 2; i++) {
						fx.particles.push({
							x: (x + 0.5) / COLS, y: (row + 0.5) / VISIBLE,
							vx: (Math.random() - 0.5) * 1.6, vy: -(Math.random() * 0.9 + 0.2),
							life: 0, max: 450 + Math.random() * 400, size: 0.14 + Math.random() * 0.16,
							color: COLORS[type]
						});
					}
				});
			}
		}
		game.board = game.board.filter((_, y) => !full.includes(y));
		while (game.board.length < ROWS) game.board.unshift(Array(COLS).fill(null));
		return full.length;
	}

	const boardEmpty = () => game.board.every(row => row.every(c => !c));

	function applyClear(n, tspin) {
		const level = game.level;
		let points;
		let title = null;
		if (tspin === 'full') {
			points = [400, 800, 1200, 1600][n];
			title = n ? `T-Spin ${CLEAR_NAMES[n]}` : 'T-Spin';
		} else if (tspin === 'mini') {
			points = [100, 200, 400, 400][n];
			title = n ? `Mini T-Spin ${CLEAR_NAMES[n]}` : 'Mini T-Spin';
		} else {
			points = [0, 100, 300, 500, 800][n];
			if (n >= 2) title = CLEAR_NAMES[n];
		}

		let b2b = false;
		if (n > 0) {
			const difficult = n === 4 || !!tspin;
			if (difficult) {
				b2b = game.b2b;
				if (b2b) points *= 1.5;
				game.b2b = true;
			} else {
				game.b2b = false;
			}
			game.combo++;
		} else {
			game.combo = -1;
		}

		let total = points * level;
		if (game.combo > 0) total += 50 * game.combo * level;
		const perfect = n > 0 && boardEmpty();
		if (perfect) total += (n === 4 && b2b ? 3200 : [0, 800, 1200, 1800, 2000][n]) * level;

		game.score += total;
		game.lines += n;
		if (n === 4) game.stats.tetrises++;
		if (tspin && n > 0) game.stats.tspins++;
		if (perfect) game.stats.perfect++;
		game.stats.maxCombo = Math.max(game.stats.maxCombo, game.combo);

		// Feedback
		if (perfect) sfx('perfect');
		else if (tspin && n > 0) sfx('tspin');
		else if (n === 4) sfx('tetris');
		else if (n > 0) sfx('clear', n);
		else if (tspin) sfx('tspinZero');
		else sfx('lock');
		if (game.combo > 0) sfx('combo', game.combo);
		if (n === 4 || (tspin && n > 0)) kick(n === 4 ? 7 : 5);
		if (perfect) kick(9);

		const lines = [];
		const kind = perfect ? 'perfect' : tspin ? 'tspin' : n === 4 ? 'tetris' : '';
		if (title) lines.push({ text: title, cls: n >= 2 || tspin ? 'main' : 'sub' });
		if (b2b) lines.push({ text: 'Back-to-Back', cls: 'sub' });
		if (game.combo > 0) lines.push({ text: `${game.combo} Combo`, cls: 'sub' });
		if (perfect) lines.push({ text: 'Perfect Clear', cls: 'main' });
		if (lines.length && total > 0) lines.push({ text: '+' + fmtNum(total), cls: 'pts' });
		if (lines.length) toast(lines, kind);

		if (game.mode === 'marathon') {
			const newLevel = game.startLevel + Math.floor(game.lines / 10);
			if (newLevel > game.level) {
				game.level = newLevel;
				toast([{ text: `Level ${newLevel}`, cls: 'main' }], 'level');
				sfx('level');
			}
		}
	}

	// ------------------------------------------------------------------ flow
	function startGame(mode) {
		ensureAudio();
		musicStop();
		music.step = 0;
		selectedMode = mode;
		store.set('tetris.mode', mode);
		game = createGame(mode);
		refillQueue();
		fx.particles.length = fx.flashes.length = fx.lockFlashes.length = fx.trails.length = 0;
		fx.score = 0;
		toastLayer.textContent = '';
		ending = null;
		showOverlay(null);
		beginCountdown(true);
	}

	function beginCountdown(fresh) {
		state = 'countdown';
		countdown = { t: 0, step: -1, stepMs: fresh ? 480 : 380, fresh };
	}

	function finishCountdown() {
		state = 'playing';
		countdown = null;
		showCount(game.time === 0 ? 'Go' : '', true);
		if (!game.piece) nextPiece();
		musicStart();
	}

	function pause() {
		if (state !== 'playing' && state !== 'countdown') return;
		state = 'paused';
		countdown = null;
		showCount('');
		musicStop();
		sfx('pause');
		showOverlay('pause');
	}

	function resume() {
		if (state !== 'paused') return;
		showOverlay(null);
		beginCountdown(false);
	}

	function toMenu() {
		musicStop();
		state = 'menu';
		game = null;
		ending = null;
		countdown = null;
		showCount('');
		toastLayer.textContent = '';
		renderMenu();
		showOverlay('menu');
	}

	function endGame(won) {
		if (state === 'ending' || state === 'over') return;
		state = 'ending';
		ending = { t: 0, won, dur: won ? 900 : 1100 };
		musicStop();
		sfx(won ? 'win' : 'gameover');
		if (won) toast([{ text: game.mode === 'ultra' ? 'Time!' : 'Complete!', cls: 'main' }], 'perfect');

		const g = game;
		const result = { won, rank: -1, entry: null };
		const base = { date: Date.now(), lines: g.lines, pieces: g.pieces, time: g.time, score: g.score, level: g.level };
		if (g.mode === 'marathon' && g.score > 0) result.entry = base;
		if (g.mode === 'ultra') result.entry = base;
		if (g.mode === 'sprint' && won) result.entry = base;
		if (result.entry) result.rank = recordScore(g.mode, result.entry);
		g.result = result;
	}

	function showOver() {
		state = 'over';
		overShownAt = performance.now();
		const g = game;
		const r = g.result;
		const pps = g.time > 0 ? g.pieces / (g.time / 1000) : 0;
		const titles = {
			marathon: 'Game over', zen: 'Session over',
			sprint: r.won ? 'Sprint complete' : 'Topped out',
			ultra: r.won ? "Time's up" : 'Topped out'
		};
		$('#over-title').textContent = titles[g.mode];
		$('#over-mode').textContent = MODES[g.mode].name;
		const sprintFail = g.mode === 'sprint' && !r.won;
		$('#over-big').textContent = g.mode === 'sprint' ? (r.won ? fmtTime(g.time) : `${g.lines}/${SPRINT_LINES}`) : fmtNum(g.score);
		$('#over-big-label').textContent = g.mode === 'sprint' ? (sprintFail ? 'Lines' : 'Time') : 'Score';
		$('#over-best').hidden = r.rank !== 0;

		const stats = [
			['Lines', g.lines], ['Level', g.level], ['Time', fmtTime(g.time)],
			['Pieces', g.pieces], ['PPS', pps.toFixed(2)], ['Tetrises', g.stats.tetrises],
			['T-Spins', g.stats.tspins], ['Max combo', Math.max(0, g.stats.maxCombo)], ['Perfect', g.stats.perfect]
		];
		const statWrap = $('#over-stats');
		statWrap.textContent = '';
		for (const [k, v] of stats) {
			const d = document.createElement('div');
			const dt = document.createElement('dt');
			const dd = document.createElement('dd');
			dt.textContent = k;
			dd.textContent = v;
			d.append(dt, dd);
			statWrap.append(d);
		}

		renderScoreList($('#over-scores'), g.mode, r.entry);
		$('#over-scores-wrap').hidden = !SORTS[g.mode];
		showOverlay('over');
	}

	// ------------------------------------------------------------------ input
	function actionsFor(code) {
		return ACTIONS.filter(a => settings.keys[a].includes(code));
	}

	function pressAction(action, source) {
		held[action]++;
		if (held[action] === 1) onPress(action, source);
	}

	function releaseAction(action) {
		if (held[action] <= 0) return;
		held[action]--;
		if (held[action] === 0) onRelease(action);
	}

	function releaseAll() {
		keysDown.clear();
		for (const a of ACTIONS) {
			if (held[a] > 0) {
				held[a] = 0;
				onRelease(a);
			}
		}
	}

	function onPress(action, source) {
		ensureAudio();
		if (source === 'pad' && padNavigate(action)) return;

		if (action === 'pause') {
			if (state === 'playing' || state === 'countdown') pause();
			else if (state === 'paused') resume();
			return;
		}
		if (action === 'restart') {
			if (game && state !== 'menu') startGame(game.mode);
			return;
		}
		if (action === 'left' || action === 'right') {
			const dir = action === 'left' ? -1 : 1;
			input.dir = dir;
			input.das = 0;
			input.arr = 0;
			if (state === 'playing' && game.piece && shift(dir)) sfx('move');
			return;
		}
		if (action === 'soft') {
			input.soft = true;
			return;
		}
		if (state !== 'playing' || !game.piece) return;
		if (action === 'hard') hardDrop();
		else if (action === 'cw') rotate(1);
		else if (action === 'ccw') rotate(-1);
		else if (action === 'r180') rotate(2);
		else if (action === 'hold') hold();
	}

	function onRelease(action) {
		if (action === 'left' || action === 'right') {
			const dir = action === 'left' ? -1 : 1;
			if (input.dir === dir) {
				const other = action === 'left' ? 'right' : 'left';
				input.dir = held[other] > 0 ? -dir : 0;
				input.das = 0;
				input.arr = 0;
			}
		} else if (action === 'soft') {
			input.soft = false;
		}
	}

	// Gamepad buttons double as menu navigation.
	function padNavigate(action) {
		if (state === 'menu') {
			const i = MODE_ORDER.indexOf(selectedMode);
			if (action === 'hard') selectMode(MODE_ORDER[(i + MODE_ORDER.length - 1) % MODE_ORDER.length]);
			else if (action === 'soft') selectMode(MODE_ORDER[(i + 1) % MODE_ORDER.length]);
			else if (action === 'left') setLevel(startLevel - 1);
			else if (action === 'right') setLevel(startLevel + 1);
			else if (action === 'cw' || action === 'pause') startGame(selectedMode);
			return true;
		}
		if (state === 'over') {
			if (performance.now() - overShownAt > 600 && (action === 'cw' || action === 'pause')) startGame(game.mode);
			else if (action === 'ccw') toMenu();
			return true;
		}
		return false;
	}

	function handleDas(dt) {
		if (!input.dir) return;
		if (input.das < settings.das) {
			input.das += dt;
			if (input.das < settings.das) return;
			input.arr = input.das - settings.das;
			autoShift(true);
		} else {
			input.arr += dt;
			autoShift(false);
		}
	}

	function autoShift(first) {
		if (!game.piece) return;
		let moved = false;
		if (settings.arr === 0) {
			while (shift(input.dir)) moved = true;
			input.arr = 0;
		} else {
			if (first && shift(input.dir)) moved = true;
			while (input.arr >= settings.arr) {
				input.arr -= settings.arr;
				if (!shift(input.dir)) {
					input.arr = 0;
					break;
				}
				moved = true;
			}
		}
		if (moved) sfx('move');
	}

	window.addEventListener('keydown', e => {
		ensureAudio();
		if (rebinding) {
			e.preventDefault();
			captureBinding(e.code);
			return;
		}
		if (settingsOpen) {
			if (e.code === 'Escape') {
				e.preventDefault();
				closeSettings();
			}
			return;
		}

		if (state === 'menu' && handleMenuKey(e.code)) {
			e.preventDefault();
			return;
		}
		if (state === 'over' && (e.code === 'Enter' || e.code === 'Escape')) {
			e.preventDefault();
			if (e.code === 'Escape') toMenu();
			else if (performance.now() - overShownAt > 400) startGame(game.mode);
			return;
		}
		if (state === 'paused' && e.code === 'Enter') {
			e.preventDefault();
			resume();
			return;
		}

		const actions = actionsFor(e.code);
		if (!actions.length) {
			if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey) toggleMute();
			return;
		}
		e.preventDefault();
		if (e.repeat || keysDown.has(e.code)) return;
		keysDown.add(e.code);
		actions.forEach(a => pressAction(a, 'key'));
	});

	window.addEventListener('keyup', e => {
		if (!keysDown.has(e.code)) return;
		e.preventDefault();
		keysDown.delete(e.code);
		actionsFor(e.code).forEach(releaseAction);
	});

	window.addEventListener('blur', () => {
		releaseAll();
		pause();
	});
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			releaseAll();
			pause();
		}
	});

	function handleMenuKey(code) {
		const i = MODE_ORDER.indexOf(selectedMode);
		if (code === 'ArrowUp') selectMode(MODE_ORDER[(i + MODE_ORDER.length - 1) % MODE_ORDER.length]);
		else if (code === 'ArrowDown') selectMode(MODE_ORDER[(i + 1) % MODE_ORDER.length]);
		else if (code === 'ArrowLeft') setLevel(startLevel - 1);
		else if (code === 'ArrowRight') setLevel(startLevel + 1);
		else if (/^Digit[1-4]$/.test(code)) selectMode(MODE_ORDER[Number(code.slice(5)) - 1]);
		else if (code === 'Enter' || code === 'Space') startGame(selectedMode);
		else return false;
		return true;
	}

	// Gamepad: standard mapping. D-pad / left stick move, A/B rotate, Y 180, X/LB/RB hold.
	const padPrev = {};
	function pollGamepad() {
		if (!navigator.getGamepads) return;
		let pad = null;
		for (const p of navigator.getGamepads()) if (p && p.connected) { pad = p; break; }
		const now = {};
		if (pad) {
			const b = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
			const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
			now.left = b(14) || ax < -0.5;
			now.right = b(15) || ax > 0.5;
			now.soft = b(13) || ay > 0.5;
			now.hard = b(12) || ay < -0.7;
			now.cw = b(0);
			now.ccw = b(1);
			now.r180 = b(3);
			now.hold = b(2) || b(4) || b(5);
			now.pause = b(9);
			now.restart = b(8);
		}
		for (const a of ACTIONS) {
			const down = !!now[a];
			if (down && !padPrev[a]) pressAction(a, 'pad');
			else if (!down && padPrev[a]) releaseAction(a);
			padPrev[a] = down;
		}
	}

	// Touch buttons share the keyboard's DAS path.
	for (const btn of $$('[data-touch]')) {
		const action = btn.dataset.touch;
		let active = false;
		const up = () => {
			if (!active) return;
			active = false;
			btn.classList.remove('is-down');
			releaseAction(action);
		};
		btn.addEventListener('pointerdown', e => {
			e.preventDefault();
			btn.setPointerCapture(e.pointerId);
			if (active) return;
			active = true;
			btn.classList.add('is-down');
			if (navigator.vibrate && action === 'hard') navigator.vibrate(8);
			pressAction(action, 'touch');
		});
		btn.addEventListener('pointerup', up);
		btn.addEventListener('pointercancel', up);
		btn.addEventListener('lostpointercapture', up);
		btn.addEventListener('contextmenu', e => e.preventDefault());
	}

	// ------------------------------------------------------------------ update
	function update(dt) {
		if (state === 'countdown') {
			countdown.t += dt;
			if (input.dir) input.das = Math.min(settings.das, input.das + dt); // pre-charge DAS
			const step = Math.floor(countdown.t / countdown.stepMs);
			if (step !== countdown.step && step < 3) {
				countdown.step = step;
				showCount(String(3 - step));
				sfx('count');
			}
			if (countdown.t >= countdown.stepMs * 3) {
				sfx('go');
				finishCountdown();
			}
			return;
		}
		if (state === 'ending') {
			ending.t += dt;
			if (ending.t >= ending.dur) showOver();
			return;
		}
		if (state !== 'playing') return;

		game.time += dt;
		if (game.mode === 'ultra' && game.time >= ULTRA_MS) {
			game.time = ULTRA_MS;
			game.piece = null;
			endGame(true);
			return;
		}

		handleDas(dt);
		if (!game.piece) return;

		const gravity = game.mode === 'zen' ? 0 : 1 / gravityMs(game.level);
		const softRate = Math.max(gravity, 1 / 1000) * settings.sdf;
		const soft = input.soft && softRate > gravity;
		if (soft && settings.sdf > 40) {
			while (dropOne()) game.score += 1;
			game.gravityAcc = 0;
		} else {
			game.gravityAcc = Math.min(game.gravityAcc + (soft ? softRate : gravity) * dt, ROWS);
			while (game.gravityAcc >= 1) {
				game.gravityAcc -= 1;
				if (!dropOne()) {
					game.gravityAcc = 0;
					break;
				}
				if (soft) game.score += 1;
			}
		}

		if (grounded()) {
			game.lockTimer += dt;
			if (game.lockTimer >= LOCK_DELAY || game.lockResets >= MAX_LOCK_RESETS) lockPiece();
		} else {
			game.lockTimer = 0;
		}
	}

	// ------------------------------------------------------------------ rendering
	function sizeCanvas(canvas, w, h) {
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		canvas.style.width = w + 'px';
		canvas.style.height = h + 'px';
		const ctx = canvas.getContext('2d');
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		return ctx;
	}

	function roundRect(ctx, x, y, w, h, r) {
		ctx.beginPath();
		if (ctx.roundRect) {
			ctx.roundRect(x, y, w, h, r);
			return;
		}
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	}

	function drawBlock(ctx, x, y, s, color, alpha = 1) {
		const g = Math.max(1, s * 0.06);
		const r = Math.max(1.5, s * 0.16);
		ctx.save();
		ctx.globalAlpha = alpha;
		roundRect(ctx, x + g / 2, y + g / 2, s - g, s - g, r);
		ctx.fillStyle = color;
		ctx.fill();
		ctx.clip();
		ctx.fillStyle = 'rgba(255,255,255,0.2)';
		ctx.fillRect(x, y, s, s * 0.38);
		ctx.fillStyle = 'rgba(0,0,0,0.14)';
		ctx.fillRect(x, y + s * 0.8, s, s * 0.2);
		ctx.restore();
	}

	function drawGhostBlock(ctx, x, y, s, color) {
		const g = Math.max(1.5, s * 0.08);
		const r = Math.max(1.5, s * 0.14);
		ctx.save();
		roundRect(ctx, x + g, y + g, s - g * 2, s - g * 2, r);
		ctx.globalAlpha = 0.16;
		ctx.fillStyle = color;
		ctx.fill();
		ctx.globalAlpha = 0.7;
		ctx.lineWidth = Math.max(1, s * 0.06);
		ctx.strokeStyle = color;
		ctx.stroke();
		ctx.restore();
	}

	function ghostY(p) {
		let y = p.y;
		while (fits(p.type, p.rot, p.x, y + 1)) y++;
		return y;
	}

	function renderBoard(dt) {
		const s = cell;
		const W = COLS * s, H = VISIBLE * s;
		const ctx = bctx;
		ctx.clearRect(0, 0, W, H);
		ctx.fillStyle = '#101c21';
		ctx.fillRect(0, 0, W, H);

		if (settings.grid) {
			ctx.strokeStyle = 'rgba(255,255,255,0.05)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			for (let x = 1; x < COLS; x++) {
				ctx.moveTo(x * s + 0.5, 0);
				ctx.lineTo(x * s + 0.5, H);
			}
			for (let y = 1; y < VISIBLE; y++) {
				ctx.moveTo(0, y * s + 0.5);
				ctx.lineTo(W, y * s + 0.5);
			}
			ctx.stroke();
		}

		if (!game) {
			frame.classList.remove('danger');
			return;
		}

		// Danger tint when the stack reaches the top quarter
		let danger = false;
		for (let y = BUFFER; y < BUFFER + 4 && !danger; y++) if (game.board[y].some(Boolean)) danger = true;
		danger = danger && (state === 'playing' || state === 'countdown');
		frame.classList.toggle('danger', danger);
		if (danger) {
			const grad = ctx.createLinearGradient(0, 0, 0, s * 5);
			grad.addColorStop(0, 'rgba(231,123,91,0.28)');
			grad.addColorStop(1, 'rgba(231,123,91,0)');
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, W, s * 5);
		}

		// Stack (greys out bottom-up on a loss)
		let greyFrom = VISIBLE;
		const lost = (state === 'ending' && !ending.won) || (state === 'over' && game.result && !game.result.won);
		if (lost) greyFrom = state === 'over' ? 0 : Math.floor(VISIBLE * (1 - Math.min(1, ending.t / (ending.dur * 0.8))));
		for (let y = BUFFER; y < ROWS; y++) {
			const row = y - BUFFER;
			for (let x = 0; x < COLS; x++) {
				const t = game.board[y][x];
				if (t) drawBlock(ctx, x * s, row * s, s, row >= greyFrom ? '#3d4c52' : COLORS[t]);
			}
		}

		// Ghost and active piece
		const p = game.piece;
		if (p && (state === 'playing' || state === 'countdown')) {
			if (settings.ghost) {
				const gy = ghostY(p);
				if (gy !== p.y) {
					for (const [x, y] of cellsOf(p.type, p.rot, p.x, gy)) if (y >= BUFFER) drawGhostBlock(ctx, x * s, (y - BUFFER) * s, s, COLORS[p.type]);
				}
			}
			const lockFade = grounded() ? Math.min(1, game.lockTimer / LOCK_DELAY) : 0;
			for (const [x, y] of cellsOf(p.type, p.rot, p.x, p.y)) {
				if (y < BUFFER) continue;
				drawBlock(ctx, x * s, (y - BUFFER) * s, s, COLORS[p.type]);
				if (lockFade > 0) {
					ctx.fillStyle = `rgba(16,28,33,${0.4 * lockFade})`;
					ctx.fillRect(x * s, (y - BUFFER) * s, s, s);
				}
			}
		}

		// Hard-drop trails
		fx.trails = fx.trails.filter(tr => (tr.t += dt) < 220);
		for (const tr of fx.trails) {
			const a = 1 - tr.t / 220;
			for (const [x, top] of Object.entries(tr.tops)) {
				const y1 = (top - BUFFER) * s;
				const y0 = Math.max(0, y1 - tr.distance * s);
				if (y1 <= 0) continue;
				const grad = ctx.createLinearGradient(0, y0, 0, y1);
				grad.addColorStop(0, 'rgba(255,255,255,0)');
				grad.addColorStop(1, hexAlpha(tr.color, 0.35 * a));
				ctx.fillStyle = grad;
				ctx.fillRect(x * s + s * 0.1, y0, s * 0.8, y1 - y0);
			}
		}

		// Lock flash
		fx.lockFlashes = fx.lockFlashes.filter(f => (f.t += dt) < 140);
		for (const f of fx.lockFlashes) {
			ctx.fillStyle = `rgba(255,255,255,${0.45 * (1 - f.t / 140)})`;
			for (const [x, y] of f.cells) if (y >= BUFFER) ctx.fillRect(x * s, (y - BUFFER) * s, s, s);
		}

		// Line clear flashes
		fx.flashes = fx.flashes.filter(f => (f.t += dt) < 300);
		for (const f of fx.flashes) {
			const k = f.t / 300;
			const h = s * (1 - k);
			ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
			ctx.fillRect(0, f.row * s + (s - h) / 2, W, h);
		}

		// Particles (stored in board-relative units so resizes don't break them)
		fx.particles = fx.particles.filter(pt => (pt.life += dt) < pt.max);
		for (const pt of fx.particles) {
			const sec = dt / 1000;
			pt.vy += 2.2 * sec;
			pt.x += pt.vx * sec * 0.35;
			pt.y += pt.vy * sec * 0.5;
			const a = 1 - pt.life / pt.max;
			ctx.globalAlpha = a;
			ctx.fillStyle = pt.color;
			const size = pt.size * s * (0.6 + 0.4 * a);
			ctx.fillRect(pt.x * W - size / 2, pt.y * H - size / 2, size, size);
		}
		ctx.globalAlpha = 1;
	}

	function hexAlpha(hex, a) {
		const n = parseInt(hex.slice(1), 16);
		return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
	}

	function drawPreview(ctx, type, cx, cy, s, color, alpha = 1) {
		const cells = ROT[type][0];
		const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
		const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
		const ox = cx - ((maxX - minX + 1) * s) / 2 - minX * s;
		const oy = cy - ((maxY - minY + 1) * s) / 2 - minY * s;
		for (const [x, y] of cells) drawBlock(ctx, ox + x * s, oy + y * s, s, color || COLORS[type], alpha);
	}

	function renderSide() {
		hctx.clearRect(0, 0, holdSize.w, holdSize.h);
		nctx.clearRect(0, 0, nextSize.w, nextSize.h);
		if (!game) return;
		if (game.hold) {
			drawPreview(hctx, game.hold, holdSize.w / 2, holdSize.h / 2, previewCell, game.holdUsed ? '#9aa7ab' : null, game.holdUsed ? 0.55 : 1);
		}
		let y = 0;
		for (let i = 0; i < settings.previews; i++) {
			const type = game.queue[i];
			if (!type) break;
			const s = i === 0 ? previewCell : previewCell * 0.82;
			const slot = i === 0 ? previewCell * 3 : previewCell * 2.6;
			drawPreview(nctx, type, nextSize.w / 2, y + slot / 2, s, null, i === 0 ? 1 : 0.9);
			y += slot;
		}
	}

	const statEls = {};
	for (const el of $$('[data-stat]')) (statEls[el.dataset.stat] ||= []).push(el);
	const statCache = {};
	function setStat(name, value) {
		value = String(value);
		if (statCache[name] === value) return;
		statCache[name] = value;
		for (const el of statEls[name] || []) el.textContent = value;
	}

	function renderStats(dt) {
		const g = game;
		const mode = g ? g.mode : selectedMode;
		const time = g ? g.time : 0;
		const score = g ? g.score : 0;
		// Score counts up smoothly instead of jumping
		fx.score += (score - fx.score) * Math.min(1, dt / 90);
		if (Math.abs(score - fx.score) < 1) fx.score = score;

		const best = bestOf(mode);
		if (mode === 'sprint') {
			setStat('primaryLabel', 'Time');
			setStat('primary', fmtTime(time));
			setStat('best', best ? 'Best ' + fmtTime(best.time) : '');
			setStat('altLabel', 'Score');
			setStat('alt', fmtNum(fx.score));
		} else if (mode === 'ultra') {
			setStat('primaryLabel', 'Time left');
			setStat('primary', fmtTime(ULTRA_MS - time));
			setStat('best', best ? 'Best ' + fmtNum(best.score) : '');
			setStat('altLabel', 'Score');
			setStat('alt', fmtNum(fx.score));
		} else {
			setStat('primaryLabel', 'Score');
			setStat('primary', fmtNum(fx.score));
			setStat('best', best ? 'Best ' + fmtNum(best.score) : '');
			setStat('altLabel', 'Time');
			setStat('alt', fmtTime(time));
		}
		setStat('lines', g ? (mode === 'sprint' ? `${g.lines}/${SPRINT_LINES}` : g.lines) : 0);
		setStat('level', g ? g.level : mode === 'marathon' ? startLevel : 1);
		setStat('pieces', g ? g.pieces : 0);
		setStat('pps', g && g.time > 500 ? (g.pieces / (g.time / 1000)).toFixed(2) : '0.00');

		badgeB2b.hidden = !(g && g.b2b);
		const comboOn = g && g.combo > 0;
		badgeCombo.hidden = !comboOn;
		if (comboOn) setStat('combo', `${g.combo} Combo`);

		// Goal panel
		let label = '', text = '', progress = 0;
		if (mode === 'marathon') {
			const level = g ? g.level : startLevel;
			const into = g ? g.lines % 10 : 0;
			label = `Level ${level}`;
			text = `${10 - into} line${10 - into === 1 ? '' : 's'} to level ${level + 1}`;
			progress = into / 10;
		} else if (mode === 'sprint') {
			const lines = g ? g.lines : 0;
			label = '40 lines';
			text = `${Math.max(0, SPRINT_LINES - lines)} to go`;
			progress = lines / SPRINT_LINES;
		} else if (mode === 'ultra') {
			label = '2 minutes';
			text = `${fmtTime(ULTRA_MS - time).slice(0, -3)} left`;
			progress = time / ULTRA_MS;
		} else {
			label = 'Zen';
			text = `${g ? g.lines : 0} lines cleared`;
			progress = 0;
		}
		setStat('goalLabel', label);
		setStat('goalText', text);
		const bar = goalBar;
		bar.style.width = (clamp(progress, 0, 1) * 100).toFixed(1) + '%';
		bar.parentElement.hidden = mode === 'zen';
	}

	function kick(amount) {
		if (settings.shake) fx.kick = Math.max(fx.kick, amount);
	}

	let lastFrame = performance.now();
	function frameLoop(now) {
		const dt = Math.min(now - lastFrame, 100);
		lastFrame = now;
		pollGamepad();
		update(dt);
		renderBoard(dt);
		renderSide();
		renderStats(dt);
		fx.kick *= Math.exp(-dt / 55);
		if (fx.kick < 0.1) fx.kick = 0;
		frame.style.transform = fx.kick ? `translateY(${fx.kick.toFixed(2)}px)` : '';
		requestAnimationFrame(frameLoop);
	}

	// ------------------------------------------------------------------ toasts & countdown
	function toast(lines, kind = '') {
		const el = document.createElement('div');
		el.className = 'toast ' + kind;
		for (const line of lines) {
			const d = document.createElement('div');
			d.className = line.cls || '';
			d.textContent = line.text;
			el.append(d);
		}
		el.addEventListener('animationend', () => el.remove());
		toastLayer.append(el);
		while (toastLayer.children.length > 3) toastLayer.firstChild.remove();
	}

	function showCount(text, fade = false) {
		countEl.textContent = text;
		countEl.classList.remove('tick', 'fade');
		if (!text) return;
		void countEl.offsetWidth; // restart the animation
		countEl.classList.add(fade ? 'fade' : 'tick');
	}

	// ------------------------------------------------------------------ audio
	const audio = { ctx: null, master: null, sfx: null, music: null, melody: null, noise: null };

	function ensureAudio() {
		if (!audio.ctx) {
			const AC = window.AudioContext || window.webkitAudioContext;
			if (!AC) return null;
			const ctx = new AC();
			audio.ctx = ctx;
			audio.master = ctx.createGain();
			audio.master.connect(ctx.destination);
			audio.sfx = ctx.createGain();
			audio.sfx.connect(audio.master);
			audio.music = ctx.createGain();
			audio.music.connect(audio.master);
			audio.melody = ctx.createBiquadFilter();
			audio.melody.type = 'lowpass';
			audio.melody.frequency.value = 2400;
			audio.melody.connect(audio.music);
			const len = Math.floor(ctx.sampleRate * 0.3);
			audio.noise = ctx.createBuffer(1, len, ctx.sampleRate);
			const data = audio.noise.getChannelData(0);
			for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
			applyVolumes();
		}
		if (audio.ctx.state === 'suspended') audio.ctx.resume();
		return audio.ctx;
	}

	function applyVolumes() {
		if (!audio.ctx) return;
		audio.master.gain.value = settings.muted ? 0 : 1;
		audio.sfx.gain.value = Math.pow(settings.sfx / 100, 2) * 0.9;
		audio.music.gain.value = Math.pow(settings.musicVol / 100, 2) * 0.55;
	}

	function blip({ freq, to, dur = 0.08, type = 'square', vol = 0.2, at = 0 }) {
		const ctx = audio.ctx;
		if (!ctx || settings.muted || settings.sfx === 0) return;
		const t = ctx.currentTime + at;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		osc.connect(gain);
		gain.connect(audio.sfx);
		osc.start(t);
		osc.stop(t + dur + 0.02);
	}

	function noise({ dur = 0.08, vol = 0.15, at = 0, freq = 1000 }) {
		const ctx = audio.ctx;
		if (!ctx || settings.muted || settings.sfx === 0) return;
		const t = ctx.currentTime + at;
		const src = ctx.createBufferSource();
		src.buffer = audio.noise;
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = freq;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(vol, t);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		src.connect(filter);
		filter.connect(gain);
		gain.connect(audio.sfx);
		src.start(t);
		src.stop(t + dur + 0.02);
	}

	const arp = (notes, step, opts) => notes.forEach((f, i) => blip({ freq: f, at: i * step, ...opts }));
	const SFX = {
		move: () => blip({ freq: 900, dur: 0.025, type: 'triangle', vol: 0.1 }),
		rotate: () => blip({ freq: 620, to: 840, dur: 0.045, type: 'triangle', vol: 0.13 }),
		hard: () => {
			blip({ freq: 190, to: 55, dur: 0.14, type: 'sine', vol: 0.5 });
			noise({ dur: 0.07, vol: 0.12, freq: 900 });
		},
		lock: () => blip({ freq: 260, to: 190, dur: 0.06, type: 'triangle', vol: 0.18 }),
		hold: () => blip({ freq: 440, to: 660, dur: 0.08, type: 'sine', vol: 0.2 }),
		denied: () => blip({ freq: 140, dur: 0.07, type: 'square', vol: 0.06 }),
		clear: n => arp([523, 659, 784, 1047].slice(0, n + 1), 0.045, { dur: 0.12, type: 'square', vol: 0.09 }),
		tetris: () => {
			arp([523, 659, 784, 1047, 1319], 0.05, { dur: 0.16, type: 'square', vol: 0.1 });
			noise({ dur: 0.25, vol: 0.05, freq: 4000, at: 0.05 });
		},
		tspin: () => arp([392, 494, 587, 740, 988], 0.045, { dur: 0.15, type: 'sawtooth', vol: 0.07 }),
		tspinZero: () => arp([392, 587], 0.05, { dur: 0.1, type: 'triangle', vol: 0.14 }),
		perfect: () => arp([523, 659, 784, 1047, 1319, 1568, 2093], 0.06, { dur: 0.22, type: 'triangle', vol: 0.18 }),
		combo: n => blip({ freq: 660 * Math.pow(2, Math.min(n, 16) / 12), dur: 0.09, type: 'sine', vol: 0.14, at: 0.06 }),
		level: () => arp([392, 523, 659, 784, 1047], 0.07, { dur: 0.14, type: 'triangle', vol: 0.18 }),
		count: () => blip({ freq: 440, dur: 0.09, type: 'sine', vol: 0.18 }),
		go: () => blip({ freq: 880, dur: 0.16, type: 'sine', vol: 0.2 }),
		pause: () => blip({ freq: 520, to: 330, dur: 0.1, type: 'sine', vol: 0.12 }),
		zen: () => arp([784, 659, 523], 0.06, { dur: 0.14, type: 'sine', vol: 0.14 }),
		win: () => arp([523, 659, 784, 1047, 784, 1047, 1319], 0.08, { dur: 0.2, type: 'triangle', vol: 0.2 }),
		gameover: () => {
			arp([392, 330, 262, 196], 0.14, { dur: 0.22, type: 'triangle', vol: 0.2 });
			noise({ dur: 0.5, vol: 0.06, freq: 500 });
		}
	};
	function sfx(name, arg) {
		if (audio.ctx && SFX[name]) SFX[name](arg);
	}

	// Korobeiniki (public-domain folk tune) on an eighth-note grid, with an alternating-octave bass.
	const SONG = (() => {
		const A = [
			[76, 1], [71, 0.5], [72, 0.5], [74, 1], [72, 0.5], [71, 0.5],
			[69, 1], [69, 0.5], [72, 0.5], [76, 1], [74, 0.5], [72, 0.5],
			[71, 1.5], [72, 0.5], [74, 1], [76, 1],
			[72, 1], [69, 1], [69, 1], [0, 1],
			[0, 0.5], [74, 1], [77, 0.5], [81, 1], [79, 0.5], [77, 0.5],
			[76, 1.5], [72, 0.5], [76, 1], [74, 0.5], [72, 0.5],
			[71, 1], [71, 0.5], [72, 0.5], [74, 1], [76, 1],
			[72, 1], [69, 1], [69, 1], [0, 1]
		];
		const B = [
			[76, 2], [72, 2], [74, 2], [71, 2], [72, 2], [69, 2], [68, 2], [71, 2],
			[76, 2], [72, 2], [74, 2], [71, 2], [72, 1], [76, 1], [81, 2], [80, 4]
		];
		const bassA = [40, 45, 40, 45, 38, 36, 40, 45];
		const bassB = [45, 40, 45, 40, 45, 40, 45, 40];
		const bars = [...bassA, ...bassA, ...bassB];
		const steps = bars.length * 8;
		const mel = new Array(steps).fill(null);
		let pos = 0;
		for (const [midi, beats] of [...A, ...A, ...B]) {
			const len = Math.round(beats * 2);
			if (midi) mel[pos] = { midi, len };
			pos += len;
		}
		const bass = [];
		for (const root of bars) for (let i = 0; i < 8; i++) bass.push(i % 2 ? root + 12 : root);
		return { mel, bass, steps };
	})();

	const music = { on: false, timer: 0, step: 0, next: 0 };

	function musicTempo() {
		if (!game) return 140;
		let bpm = 136 + Math.min(game.level - 1, 15) * 4;
		if (game.mode === 'ultra' && ULTRA_MS - game.time < 20000) bpm += 24;
		if (game.mode === 'sprint' && game.lines >= SPRINT_LINES - 10) bpm += 16;
		return bpm;
	}

	function playNote(midi, t, dur, type, vol, dest) {
		const ctx = audio.ctx;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type;
		osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(vol, t + 0.008);
		gain.gain.exponentialRampToValueAtTime(vol * 0.55, t + Math.max(0.02, dur * 0.6));
		gain.gain.linearRampToValueAtTime(0, t + dur);
		osc.connect(gain);
		gain.connect(dest);
		osc.start(t);
		osc.stop(t + dur + 0.02);
	}

	function musicTick() {
		const ctx = audio.ctx;
		if (music.next < ctx.currentTime - 0.1) music.next = ctx.currentTime + 0.05;
		const eighth = 60 / musicTempo() / 2;
		while (music.next < ctx.currentTime + 0.12) {
			const i = music.step;
			const note = SONG.mel[i];
			if (note) playNote(note.midi, music.next, note.len * eighth * 0.92, 'square', 0.1, audio.melody);
			playNote(SONG.bass[i], music.next, eighth * 0.8, 'triangle', 0.24, audio.music);
			music.step = (i + 1) % SONG.steps;
			music.next += eighth;
		}
	}

	function musicStart() {
		if (music.on || !settings.music || state !== 'playing') return;
		const ctx = ensureAudio();
		if (!ctx) return;
		music.on = true;
		music.next = ctx.currentTime + 0.06;
		music.timer = setInterval(musicTick, 25);
		musicTick();
	}

	function musicStop() {
		if (!music.on) return;
		music.on = false;
		clearInterval(music.timer);
	}

	function toggleMute() {
		settings.muted = !settings.muted;
		saveSettings();
		applyVolumes();
		syncHeader();
	}

	function toggleMusic() {
		settings.music = !settings.music;
		saveSettings();
		if (settings.music) musicStart();
		else musicStop();
		syncHeader();
		syncSettingsUI();
	}

	// ------------------------------------------------------------------ overlays & menu
	function showOverlay(name) {
		for (const el of $$('.overlay')) el.hidden = el.dataset.overlay !== name;
		if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
	}

	function selectMode(mode) {
		selectedMode = mode;
		store.set('tetris.mode', mode);
		renderMenu();
	}

	function setLevel(level) {
		if (selectedMode !== 'marathon') return;
		startLevel = clamp(level, 1, 15);
		store.set('tetris.level', startLevel);
		renderMenu();
	}

	function bestLabel(mode) {
		const best = bestOf(mode);
		if (!best) return mode === 'zen' ? 'Untimed' : 'No record yet';
		return 'Best ' + (mode === 'sprint' ? fmtTime(best.time) : fmtNum(best.score));
	}

	function renderMenu() {
		const list = $('#mode-list');
		list.textContent = '';
		MODE_ORDER.forEach((mode, i) => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'mode-card' + (mode === selectedMode ? ' is-selected' : '');
			btn.setAttribute('aria-pressed', mode === selectedMode);
			btn.innerHTML = `<span class="mode-key">${i + 1}</span><span class="mode-body"><span class="mode-name"></span><span class="mode-desc"></span></span><span class="mode-best"></span>`;
			btn.querySelector('.mode-name').textContent = MODES[mode].name;
			btn.querySelector('.mode-desc').textContent = MODES[mode].desc;
			btn.querySelector('.mode-best').textContent = bestLabel(mode);
			btn.addEventListener('click', () => {
				if (selectedMode === mode) startGame(mode);
				else selectMode(mode);
			});
			list.append(btn);
		});
		$('#level-pick').hidden = selectedMode !== 'marathon';
		$('#level-value').textContent = startLevel;
	}

	function renderScoreList(el, mode, current) {
		el.textContent = '';
		const list = scores[mode] || [];
		if (!list.length) {
			const li = document.createElement('li');
			li.className = 'empty';
			li.textContent = 'No records yet';
			el.append(li);
			return;
		}
		list.forEach((s, i) => {
			const li = document.createElement('li');
			if (current && s.date === current.date) li.className = 'is-current';
			const main = mode === 'sprint' ? fmtTime(s.time) : fmtNum(s.score);
			const meta = mode === 'sprint' ? `${s.pieces} pcs` : `${s.lines} lines`;
			li.innerHTML = '<span class="rank"></span><span class="main"></span><span class="meta"></span>';
			li.querySelector('.rank').textContent = i + 1;
			li.querySelector('.main').textContent = main;
			li.querySelector('.meta').textContent = `${meta} · ${fmtDate(s.date)}`;
			el.append(li);
		});
	}

	const onClick = (sel, fn) => $(sel).addEventListener('click', e => {
		e.currentTarget.blur();
		ensureAudio();
		fn();
	});
	onClick('#btn-play', () => startGame(selectedMode));
	onClick('#level-down', () => setLevel(startLevel - 1));
	onClick('#level-up', () => setLevel(startLevel + 1));
	onClick('#btn-resume', resume);
	onClick('#btn-restart', () => startGame(game.mode));
	onClick('#btn-pause-settings', openSettings);
	onClick('#btn-quit', toMenu);
	onClick('#btn-again', () => startGame(game.mode));
	onClick('#btn-menu', toMenu);
	onClick('#btn-music', toggleMusic);
	onClick('#btn-mute', toggleMute);
	onClick('#btn-settings', openSettings);
	onClick('#btn-theme', () => setTheme(THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length]));

	const THEMES = ['auto', 'light', 'dark'];
	const THEME_LABELS = { auto: 'Match system', light: 'Light', dark: 'Dark' };

	function applyTheme() {
		if (settings.theme === 'auto') delete rootEl.dataset.theme;
		else rootEl.dataset.theme = settings.theme;
		const btn = $('#btn-theme');
		btn.title = `Theme: ${THEME_LABELS[settings.theme]}`;
		for (const icon of btn.querySelectorAll('[data-theme-icon]')) icon.hidden = icon.dataset.themeIcon !== settings.theme;
		$('#set-theme').value = settings.theme;
	}

	function setTheme(theme) {
		settings.theme = THEMES.includes(theme) ? theme : 'auto';
		saveSettings();
		applyTheme();
	}

	function syncHeader() {
		const mute = $('#btn-mute');
		mute.setAttribute('aria-pressed', !settings.muted);
		mute.querySelector('.when-on').hidden = settings.muted;
		mute.querySelector('.when-off').hidden = !settings.muted;
		$('#btn-music').setAttribute('aria-pressed', settings.music);
	}

	// ------------------------------------------------------------------ settings modal
	let settingsOpen = false;
	let rebinding = null;
	const settingsSync = [];

	function openSettings() {
		pause();
		settingsOpen = true;
		releaseAll();
		$('#settings').hidden = false;
		renderBinds();
		$('#settings-close').focus();
	}

	function closeSettings() {
		settingsOpen = false;
		rebinding = null;
		$('#settings').hidden = true;
		$('#settings-close').blur();
		renderHints();
	}

	function bindRange(id, key, fmt, after) {
		const el = $('#' + id);
		const out = $(`[data-out="${id}"]`);
		const sync = () => {
			el.value = settings[key];
			out.textContent = fmt(settings[key]);
		};
		el.addEventListener('input', () => {
			settings[key] = Number(el.value);
			out.textContent = fmt(settings[key]);
			saveSettings();
			if (after) after();
		});
		settingsSync.push(sync);
	}

	function bindToggle(id, key, after) {
		const el = $('#' + id);
		el.addEventListener('change', () => {
			settings[key] = el.checked;
			saveSettings();
			if (after) after();
		});
		settingsSync.push(() => { el.checked = settings[key]; });
	}

	function syncSettingsUI() {
		settingsSync.forEach(fn => fn());
		$('#set-touch').value = settings.touch;
	}

	bindRange('set-das', 'das', v => `${v} ms`);
	bindRange('set-arr', 'arr', v => (v === 0 ? '0 ms · instant' : `${v} ms`));
	bindRange('set-sdf', 'sdf', v => (v > 40 ? 'Instant' : `${v}×`));
	bindRange('set-previews', 'previews', v => String(v), layout);
	bindRange('set-sfx', 'sfx', v => `${v}%`, applyVolumes);
	bindRange('set-musicvol', 'musicVol', v => `${v}%`, applyVolumes);
	bindToggle('set-ghost', 'ghost');
	bindToggle('set-grid', 'grid');
	bindToggle('set-shake', 'shake');
	bindToggle('set-effects', 'effects');
	bindToggle('set-music', 'music', () => {
		if (settings.music) musicStart();
		else musicStop();
		syncHeader();
	});
	$('#set-theme').addEventListener('change', e => setTheme(e.target.value));
	$('#set-touch').addEventListener('change', e => {
		settings.touch = e.target.value;
		saveSettings();
		layout();
	});

	onClick('#settings-close', closeSettings);
	$('#settings').addEventListener('click', e => {
		if (e.target.id === 'settings') closeSettings();
	});
	onClick('#reset-handling', () => {
		Object.assign(settings, HANDLING_DEFAULTS);
		saveSettings();
		syncSettingsUI();
	});
	onClick('#reset-keys', () => {
		for (const a of ACTIONS) settings.keys[a] = DEFAULT_KEYS[a].slice();
		saveSettings();
		renderBinds();
	});
	onClick('#clear-scores', () => {
		if (!window.confirm('Clear all personal bests on this device?')) return;
		scores = {};
		store.set('tetris.scores', scores);
		renderMenu();
	});

	function renderBinds() {
		const wrap = $('#binds');
		wrap.textContent = '';
		for (const a of ACTIONS) {
			const row = document.createElement('div');
			row.className = 'bind-row';
			const label = document.createElement('span');
			label.className = 'bind-label';
			label.textContent = ACTION_LABELS[a];
			const keys = document.createElement('div');
			keys.className = 'bind-keys';
			for (const code of settings.keys[a]) {
				const chip = document.createElement('button');
				chip.type = 'button';
				chip.className = 'chip';
				chip.title = 'Remove';
				chip.innerHTML = '<span></span><span aria-hidden="true">×</span>';
				chip.firstChild.textContent = keyName(code);
				chip.setAttribute('aria-label', `Remove ${keyName(code)} from ${ACTION_LABELS[a]}`);
				chip.addEventListener('click', () => {
					settings.keys[a] = settings.keys[a].filter(c => c !== code);
					saveSettings();
					renderBinds();
				});
				keys.append(chip);
			}
			const add = document.createElement('button');
			add.type = 'button';
			add.className = 'chip add' + (rebinding === a ? ' is-listening' : '');
			add.textContent = rebinding === a ? 'Press a key…' : '+ Add';
			add.addEventListener('click', () => {
				rebinding = rebinding === a ? null : a;
				renderBinds();
			});
			keys.append(add);
			row.append(label, keys);
			wrap.append(row);
		}
	}

	function captureBinding(code) {
		const action = rebinding;
		rebinding = null;
		if (code !== 'Escape' && code !== 'Tab') {
			for (const a of ACTIONS) settings.keys[a] = settings.keys[a].filter(c => c !== code);
			settings.keys[action].push(code);
			if (settings.keys[action].length > 3) settings.keys[action].shift();
			saveSettings();
		}
		renderBinds();
	}

	function renderHints() {
		const groups = [
			[['left', 'right'], 'Move'], [['soft'], 'Soft drop'], [['hard'], 'Hard drop'],
			[['cw'], 'Rotate'], [['ccw'], 'Rotate left'], [['r180'], '180°'],
			[['hold'], 'Hold'], [['pause'], 'Pause'], [['restart'], 'Restart']
		];
		const wrap = $('#hints');
		wrap.textContent = '';
		for (const [actions, label] of groups) {
			const codes = actions.flatMap(a => settings.keys[a]);
			if (!codes.length) continue;
			const item = document.createElement('span');
			item.className = 'hint';
			for (const code of codes) {
				const k = document.createElement('kbd');
				k.textContent = keyName(code);
				item.append(k);
			}
			item.append(document.createTextNode(label));
			wrap.append(item);
		}
		const holdKey = settings.keys.hold[0];
		setStat('holdKey', holdKey ? keyName(holdKey) : '');
	}

	// ------------------------------------------------------------------ layout
	function touchEnabled() {
		if (settings.touch === 'on') return true;
		if (settings.touch === 'off') return false;
		return window.matchMedia('(pointer: coarse)').matches;
	}

	function layout() {
		const viewW = document.documentElement.clientWidth;
		const narrow = viewW < 720;
		document.body.classList.toggle('narrow', narrow);
		document.body.classList.toggle('touch', touchEnabled());
		const sideCells = narrow ? 3.4 : 5.4;
		const gap = narrow ? 8 : 16;
		const pad = narrow ? 6 : 12;
		const below = touchEnabled() ? $('#touch').offsetHeight + 16 : $('#hints').offsetHeight + 20;
		const reserved = $('#top').offsetHeight + (narrow ? $('#stats-compact').offsetHeight + 10 : 0) + below + 44;
		const availH = window.innerHeight - reserved - 12;
		const availW = Math.min(viewW - 32, 1120) - gap * 2 - 12;
		cell = Math.floor(Math.min(availH / VISIBLE, availW / (COLS + sideCells * 2)));
		cell = clamp(cell, 12, 38);
		const side = Math.round(sideCells * cell);
		rootEl.style.setProperty('--cell', cell + 'px');
		rootEl.style.setProperty('--side', side + 'px');
		rootEl.style.setProperty('--gap', gap + 'px');
		rootEl.style.setProperty('--pad', pad + 'px');
		rootEl.style.setProperty('--overlay-top', Math.round($('#top').getBoundingClientRect().bottom) + 'px');
		bctx = sizeCanvas(boardCanvas, COLS * cell, VISIBLE * cell);
		const inner = side - pad * 2 - 2;
		previewCell = Math.min(Math.round(cell * (narrow ? 0.55 : 0.72)), Math.floor(inner / 4.4));
		holdSize = { w: inner, h: Math.round(previewCell * 2.8) };
		nextSize = { w: inner, h: Math.round(previewCell * (3 + 2.6 * (settings.previews - 1))) };
		hctx = sizeCanvas(holdCanvas, holdSize.w, holdSize.h);
		nctx = sizeCanvas(nextCanvas, nextSize.w, nextSize.h);
	}

	window.addEventListener('resize', layout);
	window.addEventListener('pointerdown', () => ensureAudio(), { passive: true });

	// ------------------------------------------------------------------ boot
	syncSettingsUI();
	applyTheme();
	syncHeader();
	renderHints();
	renderMenu();
	showOverlay('menu');
	layout();
	requestAnimationFrame(frameLoop);
})();
