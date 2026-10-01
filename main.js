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
  }

  function frame(nowMs) {
    const dt = lastFrameMs === 0 ? 0 : nowMs - lastFrameMs;
    lastFrameMs = nowMs;

    const actions = Input.poll(input, paused ? 0 : dt);

    if (actions.retry) {
      newGame(game.mode);
    } else if (actions.pause && game.status === 'playing') {
      setPaused(!paused);
    }

    if (!paused && game.status === 'playing') {
      const events = Game.tick(game, dt, actions);
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (event.type === 'harddrop' && event.cells > 0 && event.piece) {
          renderer.addTrail(event.piece, event.piece.y - event.cells, event.piece.y);
        }
        if (event.type === 'lock' && event.lines > 0) renderer.addFlash(event.rows);
      }
      emit(events);
    }

    hud.update(game);
    renderer.draw({ game: game, paused: paused, dtMs: dt });
    root.requestAnimationFrame(frame);
  }

  root.addEventListener('resize', function () { renderer.resize(); });

  // A backgrounded tab stops receiving frames, then hands over one huge
  // delta on return. Pausing on blur means there is nothing to catch up.
  root.addEventListener('blur', function () {
    if (game && game.status === 'playing') setPaused(true);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game && game.status === 'playing') setPaused(true);
  });

  Input.attach(input, root);
  renderer.resize();
  newGame('marathon');
  root.requestAnimationFrame(frame);

  root.App = {
    newGame: newGame,
    togglePause: function () { setPaused(!paused); },
    setPaused: setPaused,
    isPaused: function () { return paused; },
    getGame: function () { return game; },
    getInput: function () { return input; },
    getRenderer: function () { return renderer; },
    onEvents: function (handler) { listeners.push(handler); }
  };

  root.App.onEvents(function (events) { hud.apply(events); });
})(window);
