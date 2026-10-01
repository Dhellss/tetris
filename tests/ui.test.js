(function () {
  'use strict';
  const { describe, it, assert, assertEqual, assertDeepEqual } = Harness;

  // A stand-in for localStorage, including one that throws the way a
  // privacy-restricted browser does.
  function fakeStorage(initial, broken) {
    const data = initial || {};
    return {
      getItem: function (key) {
        if (broken === 'read') throw new Error('access denied');
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
      },
      setItem: function (key, value) {
        if (broken === 'write') throw new Error('quota exceeded');
        data[key] = String(value);
      },
      data: data
    };
  }

  describe('Input defaults', function () {
    it('binds the keys the spec lists', function () {
      const b = Input.DEFAULT_BINDINGS;
      assertEqual(b.ArrowLeft, 'left');
      assertEqual(b.ArrowRight, 'right');
      assertEqual(b.ArrowDown, 'softDrop');
      assertEqual(b.Space, 'hardDrop');
      assertEqual(b.ArrowUp, 'rotateCW');
      assertEqual(b.KeyX, 'rotateCW');
      assertEqual(b.KeyZ, 'rotateCCW');
      assertEqual(b.KeyA, 'rotate180');
      assertEqual(b.KeyC, 'hold');
      assertEqual(b.ShiftLeft, 'hold');
      assertEqual(b.Escape, 'pause');
      assertEqual(b.KeyR, 'retry');
    });

    it('defaults DAS to 100ms and ARR to 0ms', function () {
      assertEqual(Input.DEFAULT_HANDLING.dasMs, 100);
      assertEqual(Input.DEFAULT_HANDLING.arrMs, 0);
      assertEqual(Input.DEFAULT_HANDLING.softDropFactor, 20);
    });
  });

  describe('Input one-shot actions', function () {
    it('fires once per press, however many frames pass', function () {
      const st = Input.createState();
      Input.press(st, 'Space');
      assertEqual(Input.poll(st, 16).hardDrop, true);
      assertEqual(Input.poll(st, 16).hardDrop, false, 'hard drop repeated while held');
      assertEqual(Input.poll(st, 16).hardDrop, false);
    });

    it('fires again after a release and a fresh press', function () {
      const st = Input.createState();
      Input.press(st, 'Space');
      Input.poll(st, 16);
      Input.release(st, 'Space');
      Input.press(st, 'Space');
      assertEqual(Input.poll(st, 16).hardDrop, true);
    });

    it('ignores a repeated press of a key that is already down', function () {
      const st = Input.createState();
      Input.press(st, 'KeyZ');
      Input.press(st, 'KeyZ');   // OS-level key repeat
      Input.press(st, 'KeyZ');
      assertEqual(Input.poll(st, 16).rotateCCW, true);
      assertEqual(Input.poll(st, 16).rotateCCW, false, 'held rotate fired twice');
    });

    it('ignores codes that are not bound', function () {
      const st = Input.createState();
      Input.press(st, 'KeyQ');
      Input.release(st, 'KeyQ');
      const actions = Input.poll(st, 16);
      for (const action of Input.ACTIONS) {
        assert(actions[action] !== true, action + ' fired from an unbound key');
      }
    });
  });

  describe('Input soft drop', function () {
    it('stays true for as long as the key is held', function () {
      const st = Input.createState();
      Input.press(st, 'ArrowDown');
      assertEqual(Input.poll(st, 16).softDrop, true);
      assertEqual(Input.poll(st, 16).softDrop, true);
      Input.release(st, 'ArrowDown');
      assertEqual(Input.poll(st, 16).softDrop, false);
    });
  });

  describe('Input DAS and ARR', function () {
    it('moves once on press, then waits out DAS before repeating', function () {
      const st = Input.createState({ handling: { dasMs: 100, arrMs: 50, softDropFactor: 20 } });
      Input.press(st, 'ArrowRight');

      const first = Input.poll(st, 16);
      assertEqual(first.right, true, 'the initial tap did not move');

      // Six more frames is 96ms of holding: still inside the 100ms DAS.
      for (let i = 0; i < 6; i++) {
        assertEqual(Input.poll(st, 16).right, false, 'repeated during the DAS delay');
      }
      // The seventh frame crosses 100ms and starts the repeat.
      assertEqual(Input.poll(st, 16).right, true, 'the repeat never started');
    });

    it('repeats every ARR milliseconds once DAS has elapsed', function () {
      const st = Input.createState({ handling: { dasMs: 100, arrMs: 50, softDropFactor: 20 } });
      Input.press(st, 'ArrowRight');
      Input.poll(st, 0);
      Input.poll(st, 100);        // DAS elapses, one move
      let moves = 0;
      for (let i = 0; i < 10; i++) {
        if (Input.poll(st, 25).right) moves++;
      }
      // 250ms at a move every 50ms.
      assertEqual(moves, 5);
    });

    it('slides to the wall in one frame when ARR is 0', function () {
      const st = Input.createState({ handling: { dasMs: 100, arrMs: 0, softDropFactor: 20 } });
      Input.press(st, 'ArrowRight');
      Input.poll(st, 0);
      const after = Input.poll(st, 100);
      assertEqual(after.right, true);
      assert(after.moveCells >= 10, 'ARR 0 should ask for a full-width slide, got ' + after.moveCells);
    });

    it('asks for a single cell on the initial tap even when ARR is 0', function () {
      const st = Input.createState({ handling: { dasMs: 100, arrMs: 0, softDropFactor: 20 } });
      Input.press(st, 'ArrowRight');
      const first = Input.poll(st, 16);
      assertEqual(first.right, true);
      assertEqual(first.moveCells, 1, 'a tap should move exactly one cell');
    });

    it('lets the most recent direction win', function () {
      const st = Input.createState();
      Input.press(st, 'ArrowLeft');
      Input.poll(st, 16);
      Input.press(st, 'ArrowRight');
      const actions = Input.poll(st, 16);
      assertEqual(actions.right, true);
      assertEqual(actions.left, false, 'both directions fired at once');
    });

    it('falls back to the other held direction on release', function () {
      const st = Input.createState();
      Input.press(st, 'ArrowLeft');
      Input.press(st, 'ArrowRight');
      Input.poll(st, 16);
      Input.release(st, 'ArrowRight');
      const actions = Input.poll(st, 16);
      assertEqual(actions.left, true, 'the still-held direction should take over');
    });

    it('restarts the DAS delay when the direction changes', function () {
      const st = Input.createState({ handling: { dasMs: 100, arrMs: 50, softDropFactor: 20 } });
      Input.press(st, 'ArrowLeft');
      Input.poll(st, 0);
      Input.poll(st, 200);                 // left is now auto-repeating
      Input.press(st, 'ArrowRight');
      Input.poll(st, 16);                  // the tap
      assertEqual(Input.poll(st, 50).right, false, 'the new direction skipped its DAS delay');
    });
  });

  describe('Input.reset', function () {
    it('drops every held key and queued action', function () {
      const st = Input.createState();
      Input.press(st, 'ArrowLeft');
      Input.press(st, 'ArrowDown');
      Input.press(st, 'Space');
      Input.reset(st);
      const actions = Input.poll(st, 500);
      assertEqual(actions.left, false, 'a held direction survived the reset');
      assertEqual(actions.softDrop, false, 'a held soft drop survived the reset');
      assertEqual(actions.hardDrop, false, 'a queued hard drop survived the reset');
    });

    it('lets a key that is still physically down fire again only after a new press', function () {
      const st = Input.createState();
      Input.press(st, 'ArrowLeft');
      Input.reset(st);
      assertEqual(Input.poll(st, 16).left, false);
      Input.press(st, 'ArrowLeft');
      assertEqual(Input.poll(st, 16).left, true);
    });
  });

  describe('Input settings', function () {
    it('returns the defaults when storage is empty', function () {
      const settings = Input.loadSettings(fakeStorage());
      assertDeepEqual(settings.handling, Input.DEFAULT_HANDLING);
      assertEqual(settings.bindings.ArrowLeft, 'left');
    });

    it('survives unparseable stored JSON', function () {
      const storage = fakeStorage();
      storage.data[Input.STORAGE_KEY] = '{not json at all';
      const settings = Input.loadSettings(storage);
      assertDeepEqual(settings.handling, Input.DEFAULT_HANDLING);
    });

    it('survives storage that throws on read', function () {
      const settings = Input.loadSettings(fakeStorage({}, 'read'));
      assertDeepEqual(settings.handling, Input.DEFAULT_HANDLING);
    });

    it('reports failure rather than throwing when storage rejects a write', function () {
      assertEqual(Input.saveSettings(fakeStorage({}, 'write'), {
        bindings: Input.DEFAULT_BINDINGS,
        handling: Input.DEFAULT_HANDLING
      }), false);
    });

    it('clamps out-of-range handling values', function () {
      const h = Input.sanitizeHandling({ dasMs: -40, arrMs: 9000, softDropFactor: 0 });
      assert(h.dasMs >= 0, 'negative DAS survived');
      assert(h.arrMs <= 200, 'a 9-second ARR survived: ' + h.arrMs);
      assert(h.softDropFactor >= 1, 'a zero soft drop factor survived');
    });

    it('replaces non-numeric handling values with the defaults', function () {
      const h = Input.sanitizeHandling({ dasMs: 'fast', arrMs: null, softDropFactor: NaN });
      assertDeepEqual(h, Input.DEFAULT_HANDLING);
    });

    it('drops bindings that name an unknown action', function () {
      const b = Input.sanitizeBindings({ KeyJ: 'left', KeyK: 'selfDestruct' });
      assertEqual(b.KeyJ, 'left');
      assertEqual(b.KeyK, undefined);
    });

    it('falls back to the defaults when no binding survives', function () {
      const b = Input.sanitizeBindings({ KeyK: 'selfDestruct' });
      assertEqual(b.ArrowLeft, 'left', 'an unusable binding map left the game unplayable');
    });

    it('ignores a stored value that is not an object', function () {
      const storage = fakeStorage();
      storage.data[Input.STORAGE_KEY] = '"just a string"';
      const settings = Input.loadSettings(storage);
      assertDeepEqual(settings.handling, Input.DEFAULT_HANDLING);
    });

    it('round-trips custom settings', function () {
      const storage = fakeStorage();
      const custom = {
        bindings: { KeyH: 'left', KeyL: 'right', Space: 'hardDrop' },
        handling: { dasMs: 83, arrMs: 17, softDropFactor: 30 }
      };
      assertEqual(Input.saveSettings(storage, custom), true);
      const loaded = Input.loadSettings(storage);
      assertEqual(loaded.bindings.KeyH, 'left');
      assertEqual(loaded.handling.dasMs, 83);
      assertEqual(loaded.handling.arrMs, 17);
    });
  });

  describe('Renderer.layout', function () {
    it('fits a comfortable desktop viewport', function () {
      const l = Renderer.layout(1280, 800);
      assert(l.cell > 20, 'cells are tiny on a 1280x800 screen: ' + l.cell);
      assertEqual(l.boardW, l.cell * 10);
      assertEqual(l.boardH, l.cell * 20);
      assert(l.totalW <= 1280, 'the layout is wider than the viewport');
      assert(l.totalH <= 800, 'the layout is taller than the viewport');
    });

    it('keeps all twenty rows on a 720p screen', function () {
      const l = Renderer.layout(1280, 720);
      assert(l.boardH <= 720, 'the board does not fit vertically');
      assertEqual(l.boardH / l.cell, 20);
    });

    it('clamps to a minimum cell size instead of vanishing', function () {
      const l = Renderer.layout(100, 50);
      assertEqual(l.cell, Renderer.MIN_CELL);
      assert(l.boardW > 0 && l.boardH > 0, 'the board collapsed');
    });

    it('survives a zero-size viewport', function () {
      const l = Renderer.layout(0, 0);
      assertEqual(l.cell, Renderer.MIN_CELL);
      assert(l.totalW >= 1 && l.totalH >= 1, 'a canvas dimension went below 1');
    });

    it('survives nonsense input without producing NaN', function () {
      for (const pair of [[NaN, NaN], [-500, -500], [undefined, undefined], [null, 0]]) {
        const l = Renderer.layout(pair[0], pair[1]);
        for (const key of Object.keys(l)) {
          assert(isFinite(l[key]), 'layout(' + pair[0] + ',' + pair[1] + ').' + key + ' = ' + l[key]);
        }
        assert(l.cell >= Renderer.MIN_CELL, 'cell fell below the minimum');
      }
    });

    it('places the board between the two panels', function () {
      const l = Renderer.layout(1280, 800);
      assert(l.holdX < l.boardX, 'the hold panel is not left of the board');
      assert(l.nextX > l.boardX, 'the next panel is not right of the board');
      assertEqual(l.nextX, l.boardX + l.boardW + l.gap);
    });
  });
})();
