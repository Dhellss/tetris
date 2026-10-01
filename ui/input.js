(function (root) {
  'use strict';

  const ACTIONS = [
    'left', 'right', 'softDrop', 'hardDrop',
    'rotateCW', 'rotateCCW', 'rotate180', 'hold',
    'pause', 'retry'
  ];

  // Actions that fire exactly once per physical press.
  const ONE_SHOT = ['hardDrop', 'rotateCW', 'rotateCCW', 'rotate180', 'hold', 'pause', 'retry'];

  const DEFAULT_BINDINGS = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'softDrop',
    Space: 'hardDrop',
    ArrowUp: 'rotateCW',
    KeyX: 'rotateCW',
    KeyZ: 'rotateCCW',
    KeyA: 'rotate180',
    KeyC: 'hold',
    ShiftLeft: 'hold',
    ShiftRight: 'hold',
    Escape: 'pause',
    KeyR: 'retry'
  };

  const DEFAULT_HANDLING = { dasMs: 100, arrMs: 0, softDropFactor: 20 };

  const STORAGE_KEY = 'tetris.settings.v1';

  // Wide enough to cross the board from either edge in one frame.
  const SLIDE_CELLS = 12;

  const LIMITS = {
    dasMs: { min: 0, max: 500 },
    arrMs: { min: 0, max: 200 },
    softDropFactor: { min: 1, max: 60 }
  };

  function isOneShot(action) {
    return ONE_SHOT.indexOf(action) !== -1;
  }

  function copy(source) {
    const out = {};
    for (const key of Object.keys(source)) out[key] = source[key];
    return out;
  }

  function sanitizeHandling(raw) {
    const out = copy(DEFAULT_HANDLING);
    if (!raw || typeof raw !== 'object') return out;
    for (const key of Object.keys(LIMITS)) {
      const value = raw[key];
      if (typeof value !== 'number' || !isFinite(value)) continue;
      out[key] = Math.max(LIMITS[key].min, Math.min(value, LIMITS[key].max));
    }
    return out;
  }

  function sanitizeBindings(raw) {
    if (!raw || typeof raw !== 'object') return copy(DEFAULT_BINDINGS);
    const out = {};
    let kept = 0;
    for (const code of Object.keys(raw)) {
      const action = raw[code];
      // An empty code binds an action to a key nobody can press.
      if (code === '') continue;
      if (typeof action === 'string' && ACTIONS.indexOf(action) !== -1) {
        out[code] = action;
        kept += 1;
      }
    }
    // An empty or wholly invalid map would leave the game unplayable.
    return kept > 0 ? out : copy(DEFAULT_BINDINGS);
  }

  // Storage can be absent, throw outright, or hold anything at all. None
  // of that is a reason for the game not to start.
  function loadSettings(storage) {
    const fallback = { bindings: copy(DEFAULT_BINDINGS), handling: copy(DEFAULT_HANDLING) };
    if (!storage) return fallback;

    let raw = null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (err) {
      return fallback;
    }
    if (!raw) return fallback;

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;

    return {
      bindings: sanitizeBindings(parsed.bindings),
      handling: sanitizeHandling(parsed.handling)
    };
  }

  function saveSettings(storage, settings) {
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        bindings: sanitizeBindings(settings && settings.bindings),
        handling: sanitizeHandling(settings && settings.handling)
      }));
      return true;
    } catch (err) {
      return false;
    }
  }

  function createState(settings) {
    const resolved = settings || {};
    return {
      bindings: sanitizeBindings(resolved.bindings || DEFAULT_BINDINGS),
      handling: sanitizeHandling(resolved.handling || DEFAULT_HANDLING),
      held: {},          // action -> true while the key is down
      queued: {},        // one-shot action -> waiting to be polled
      direction: 0,      // -1 left, +1 right, 0 neither
      dirStack: [],      // held directions, most recent last
      repeatMs: 0,
      repeating: false,
      tapPending: false
    };
  }

  function reset(state) {
    state.held = {};
    state.queued = {};
    state.direction = 0;
    state.dirStack = [];
    state.repeatMs = 0;
    state.repeating = false;
    state.tapPending = false;
  }

  function applyDirection(state) {
    const stack = state.dirStack;
    const next = stack.length > 0 ? stack[stack.length - 1] : 0;
    if (next !== state.direction) {
      state.direction = next;
      // A new direction always starts from a fresh tap and a fresh DAS.
      state.repeatMs = 0;
      state.repeating = false;
      state.tapPending = next !== 0;
    }
  }

  function press(state, code) {
    const action = state.bindings[code];
    if (!action) return;
    if (state.held[action] === true) return;   // OS key repeat
    state.held[action] = true;

    if (isOneShot(action)) {
      state.queued[action] = true;
      return;
    }
    if (action === 'left' || action === 'right') {
      const dir = action === 'left' ? -1 : 1;
      const at = state.dirStack.indexOf(dir);
      if (at !== -1) state.dirStack.splice(at, 1);
      state.dirStack.push(dir);
      applyDirection(state);
    }
  }

  function release(state, code) {
    const action = state.bindings[code];
    if (!action) return;
    state.held[action] = false;

    if (action === 'left' || action === 'right') {
      const dir = action === 'left' ? -1 : 1;
      const at = state.dirStack.indexOf(dir);
      if (at !== -1) state.dirStack.splice(at, 1);
      applyDirection(state);
    }
  }

  function poll(state, dtMs) {
    const dt = Math.max(0, dtMs || 0);
    const actions = {};
    for (const action of ACTIONS) actions[action] = false;
    actions.moveCells = 1;

    for (const action of ONE_SHOT) {
      if (state.queued[action]) {
        actions[action] = true;
        state.queued[action] = false;
      }
    }

    actions.softDrop = state.held.softDrop === true;

    if (state.direction !== 0) {
      let move = false;

      if (state.tapPending) {
        state.tapPending = false;
        move = true;
        actions.moveCells = 1;
      } else {
        state.repeatMs += dt;
        if (!state.repeating) {
          if (state.repeatMs >= state.handling.dasMs) {
            state.repeating = true;
            state.repeatMs -= state.handling.dasMs;
            move = true;
            actions.moveCells = state.handling.arrMs === 0 ? SLIDE_CELLS : 1;
          }
        } else if (state.handling.arrMs === 0) {
          move = true;
          actions.moveCells = SLIDE_CELLS;
        } else {
          while (state.repeatMs >= state.handling.arrMs) {
            state.repeatMs -= state.handling.arrMs;
            move = true;
          }
          actions.moveCells = 1;
        }
      }

      if (move) {
        if (state.direction < 0) actions.left = true;
        else actions.right = true;
      }
    }

    return actions;
  }

  // The only part that needs a browser. Returns a detach function.
  function attach(state, target) {
    const node = target || root;

    function onKeyDown(event) {
      if (event.repeat) return;          // OS key repeat is not a new press
      if (!state.bindings[event.code]) return;
      event.preventDefault();            // stop Space and arrows scrolling the page
      press(state, event.code);
    }

    function onKeyUp(event) {
      if (!state.bindings[event.code]) return;
      event.preventDefault();
      release(state, event.code);
    }

    function onBlur() {
      reset(state);                      // keys cannot be seen going up
    }

    node.addEventListener('keydown', onKeyDown);
    node.addEventListener('keyup', onKeyUp);
    node.addEventListener('blur', onBlur);

    return function detach() {
      node.removeEventListener('keydown', onKeyDown);
      node.removeEventListener('keyup', onKeyUp);
      node.removeEventListener('blur', onBlur);
    };
  }

  root.Input = {
    ACTIONS: ACTIONS,
    ONE_SHOT: ONE_SHOT,
    DEFAULT_BINDINGS: DEFAULT_BINDINGS,
    DEFAULT_HANDLING: DEFAULT_HANDLING,
    STORAGE_KEY: STORAGE_KEY,
    SLIDE_CELLS: SLIDE_CELLS,
    sanitizeHandling: sanitizeHandling,
    sanitizeBindings: sanitizeBindings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    createState: createState,
    reset: reset,
    press: press,
    release: release,
    poll: poll,
    attach: attach
  };
})(typeof window !== 'undefined' ? window : globalThis);
