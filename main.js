(function (root) {
  'use strict';

  const canvas = document.getElementById('board');
  const renderer = Renderer.create(canvas);
  const hud = Hud.create(document.getElementById('stage'));
  const settings = Input.loadSettings(root.localStorage);
  const input = Input.createState(settings);

  let game = null;
  let paused = false;
  let lastFrameMs = 0;
  const listeners = [];

  function softDropMsFor(handling) {
    return 1000 / Math.max(1, handling.softDropFactor);
  }

  // Called when a settings slider moves, so the change lands on the game
  // already in progress rather than the next one.
  function applyHandling() {
    if (game) game.opts.softDropMs = softDropMsFor(input.handling);
  }

  function emit(events) {
    if (events.length === 0) return;
    for (const listener of listeners) listener(events, game);
  }

  function newGame(mode) {
    game = Game.create({
      mode: mode || 'marathon',
      seed: (Date.now() ^ Math.floor(Math.random() * 0xffff)) & 0xffffff,
      softDropMs: softDropMsFor(input.handling)
    });
    paused = false;
    lastFrameMs = 0;
    // A key held across the restart must not steer the new piece.
    Input.reset(input);
    emit([{ type: 'newgame', mode: game.mode }]);
    return game;
  }

  function setPaused(value) {
    if (paused === value) return;
    paused = value;
    Input.reset(input);
    emit([{ type: paused ? 'paused' : 'resumed' }]);
    if (paused) screens.show('pause');
    else screens.hide();
  }

  function showGameOver(event, result, isBest) {
    document.getElementById('over-title').textContent =
      event.type === 'win' ? 'Sprint complete' : 'Game over';
    document.getElementById('over-detail').textContent =
      event.type === 'win'
        ? Hud.formatTime(result.timeMs) + ' · ' + result.lines + ' lines'
        : result.score + ' points · ' + result.lines + ' lines';
    document.getElementById('over-best').hidden = !isBest;
    screens.show('over');
  }

  const guide = SpinGuide.create({
    overlay: document.getElementById('guide'),
    canvas: document.getElementById('guide-canvas'),
    list: document.getElementById('guide-list'),
    title: document.getElementById('guide-title'),
    caption: document.getElementById('guide-caption'),
    progress: document.getElementById('guide-progress'),
    reference: document.getElementById('guide-reference'),
    kick: document.getElementById('guide-kick'),
    play: document.getElementById('guide-play'),
    next: document.getElementById('guide-next'),
    prev: document.getElementById('guide-prev'),
    replayButton: document.getElementById('guide-replay'),
    close: document.getElementById('guide-close'),
    speed: document.getElementById('guide-speed')
  });

  const screensOptions = {
    app: null,
    onStartGame: function (mode) { newGame(mode); },
    onOpenGuide: function () { guide.open(); }
  };
  const screens = Screens.create(screensOptions);

  function handleEvent(event) {
    if (event.type === 'harddrop' && event.cells > 0 && event.piece) {
      renderer.addTrail(event.piece, event.piece.y - event.cells, event.piece.y);
    }
    if (event.type === 'lock' && event.lines > 0) {
      renderer.addFlash(event.rows);
    }
    if (event.type === 'gameover' || event.type === 'win') {
      const result = {
        score: game.scoring.score,
        lines: game.scoring.lines,
        timeMs: game.timeMs
      };
      const outcome = Bests.record(root.localStorage, game.mode, result);
      showGameOver(event, result, outcome.updated);
    }
  }

  function frame(nowMs) {
    const dt = lastFrameMs === 0 ? 0 : nowMs - lastFrameMs;
    lastFrameMs = nowMs;

    const actions = Input.poll(input, paused ? 0 : dt);

    // Menus, settings, and the game-over screen swallow play input. The
    // pause screen is the exception: Esc there resumes.
    const screen = screens.current();
    if (screen !== null && screen !== 'pause') {
      renderer.draw({ game: game, paused: true, dtMs: dt });
      root.requestAnimationFrame(frame);
      return;
    }

    if (actions.retry) {
      newGame(game.mode);
    } else if (actions.pause && game.status === 'playing') {
      setPaused(!paused);
    }

    if (!paused && game.status === 'playing') {
      const events = Game.tick(game, dt, actions);
      for (let i = 0; i < events.length; i++) handleEvent(events[i]);
      emit(events);
    }

    hud.update(game);
    renderer.draw({ game: game, paused: paused, dtMs: dt });
    root.requestAnimationFrame(frame);
  }

  root.addEventListener('resize', function () { renderer.resize(); });

  // A backgrounded tab stops receiving frames, then hands over one huge
  // delta on return. Pausing means there is nothing to catch up on.
  root.addEventListener('blur', function () {
    if (game && game.status === 'playing' && screens.current() === null) setPaused(true);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game && game.status === 'playing' && screens.current() === null) {
      setPaused(true);
    }
  });

  root.App = {
    newGame: newGame,
    togglePause: function () { setPaused(!paused); },
    setPaused: setPaused,
    isPaused: function () { return paused; },
    applyHandling: applyHandling,
    getGame: function () { return game; },
    getInput: function () { return input; },
    getRenderer: function () { return renderer; },
    getGuide: function () { return guide; },
    onEvents: function (handler) { listeners.push(handler); }
  };
  screensOptions.app = root.App;

  root.App.onEvents(function (events) { hud.apply(events); });

  Input.attach(input, root);
  renderer.resize();
  newGame('marathon');
  screens.show('menu');
  root.requestAnimationFrame(frame);
})(window);
