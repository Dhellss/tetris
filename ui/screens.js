(function (root) {
  'use strict';

  const SCREENS = ['menu', 'pause', 'over', 'settings'];

  // One row per action, in the order a player would look for them.
  const BINDABLE = [
    { action: 'left', label: 'Move left' },
    { action: 'right', label: 'Move right' },
    { action: 'softDrop', label: 'Soft drop' },
    { action: 'hardDrop', label: 'Hard drop' },
    { action: 'rotateCW', label: 'Rotate CW' },
    { action: 'rotateCCW', label: 'Rotate CCW' },
    { action: 'rotate180', label: 'Rotate 180' },
    { action: 'hold', label: 'Hold' },
    { action: 'pause', label: 'Pause' },
    { action: 'retry', label: 'Retry' }
  ];

  function codesFor(bindings, action) {
    const codes = [];
    for (const code of Object.keys(bindings)) {
      if (bindings[code] === action) codes.push(code);
    }
    return codes;
  }

  function prettyCode(code) {
    return code
      .replace(/^Key/, '')
      .replace(/^Digit/, '')
      .replace(/^Arrow/, '')
      .replace(/^Shift(Left|Right)$/, 'Shift')
      .replace(/^Control(Left|Right)$/, 'Ctrl');
  }

  function create(options) {
    // options.app is filled in after App is assembled, so it is read at
    // each call site rather than captured here.
    function app() { return options.app; }

    const overlay = document.getElementById('overlay');
    const panels = {};
    for (const name of SCREENS) panels[name] = document.getElementById('screen-' + name);

    const bindingList = document.getElementById('binding-list');
    const sliders = {
      dasMs: { input: document.getElementById('set-das'), output: document.getElementById('out-das') },
      arrMs: { input: document.getElementById('set-arr'), output: document.getElementById('out-arr') },
      softDropFactor: { input: document.getElementById('set-sdf'), output: document.getElementById('out-sdf') }
    };

    let currentName = null;
    let capturing = null;   // the action waiting for a key

    function show(name) {
      // Leaving a half-finished rebind armed would make the next key press
      // anywhere in the game rebind that action, silently.
      capturing = null;
      currentName = name;
      overlay.hidden = name === null;
      for (const key of SCREENS) panels[key].hidden = key !== name;
      if (name === 'menu') refreshBests();
      if (name === 'settings') refreshSettings();
    }

    function hide() { show(null); }

    function refreshBests() {
      const bests = Bests.load(root.localStorage);
      document.getElementById('best-marathon').textContent =
        bests.marathon ? String(bests.marathon.score) : '—';
      document.getElementById('best-sprint').textContent =
        bests.sprint ? Hud.formatTime(bests.sprint.timeMs) : '—';
    }

    function refreshSettings() {
      const handling = app().getInput().handling;
      for (const key of Object.keys(sliders)) {
        sliders[key].input.value = String(handling[key]);
        sliders[key].output.textContent = String(handling[key]);
      }
      renderBindings();
    }

    function renderBindings() {
      const bindings = app().getInput().bindings;
      bindingList.textContent = '';
      for (const entry of BINDABLE) {
        const row = document.createElement('div');
        row.className = 'binding';

        const label = document.createElement('span');
        label.textContent = entry.label;

        const button = document.createElement('button');
        button.type = 'button';
        const codes = codesFor(bindings, entry.action);
        button.textContent = capturing === entry.action
          ? 'press a key…'
          : (codes.length ? codes.map(prettyCode).join(' / ') : 'unbound');
        button.addEventListener('click', function () {
          capturing = entry.action;
          renderBindings();
        });

        row.appendChild(label);
        row.appendChild(button);
        bindingList.appendChild(row);
      }
    }

    // While capturing, the next key press becomes the only binding for
    // that action. Escape cancels instead of binding.
    function onCaptureKey(event) {
      if (capturing === null || currentName !== 'settings') return;
      event.preventDefault();
      event.stopPropagation();

      // Escape cancels; so does a key that arrives without a usable code,
      // since binding to it would leave the action unreachable.
      if (event.code && event.code !== 'Escape') {
        const input = app().getInput();
        const next = {};
        for (const code of Object.keys(input.bindings)) {
          if (input.bindings[code] !== capturing) next[code] = input.bindings[code];
        }
        next[event.code] = capturing;
        input.bindings = Input.sanitizeBindings(next);
        Input.saveSettings(root.localStorage, { bindings: input.bindings, handling: input.handling });
      }

      capturing = null;
      renderBindings();
    }

    function onSliderInput(key) {
      return function (event) {
        const input = app().getInput();
        const raw = {};
        for (const k of Object.keys(input.handling)) raw[k] = input.handling[k];
        raw[key] = Number(event.target.value);
        input.handling = Input.sanitizeHandling(raw);
        sliders[key].output.textContent = String(input.handling[key]);
        Input.saveSettings(root.localStorage, { bindings: input.bindings, handling: input.handling });
        app().applyHandling();
      };
    }

    function onClick(event) {
      const action = event.target.getAttribute('data-action');
      if (!action) return;

      if (action === 'marathon' || action === 'sprint') {
        hide();
        options.onStartGame(action);
      } else if (action === 'guide') {
        options.onOpenGuide();
      } else if (action === 'settings') {
        show('settings');
      } else if (action === 'menu') {
        show('menu');
      } else if (action === 'resume') {
        hide();
        app().setPaused(false);
      } else if (action === 'restart') {
        hide();
        options.onStartGame(app().getGame().mode);
      } else if (action === 'reset-settings') {
        const input = app().getInput();
        input.bindings = Input.sanitizeBindings(Input.DEFAULT_BINDINGS);
        input.handling = Input.sanitizeHandling(Input.DEFAULT_HANDLING);
        Input.saveSettings(root.localStorage, { bindings: input.bindings, handling: input.handling });
        app().applyHandling();
        refreshSettings();
      }
    }

    overlay.addEventListener('click', onClick);
    for (const key of Object.keys(sliders)) {
      sliders[key].input.addEventListener('input', onSliderInput(key));
    }
    // Capture phase, so a rebinding press never reaches the game's own
    // key handler.
    root.addEventListener('keydown', onCaptureKey, true);

    return {
      show: show,
      hide: hide,
      current: function () { return currentName; },
      isCapturing: function () { return capturing !== null; }
    };
  }

  root.Screens = {
    SCREENS: SCREENS,
    BINDABLE: BINDABLE,
    prettyCode: prettyCode,
    codesFor: codesFor,
    create: create
  };
})(typeof window !== 'undefined' ? window : globalThis);
