(function () {
  'use strict';
  const { describe, it, assert, assertEqual, assertDeepEqual } = Harness;

  describe('Pieces', function () {
    it('has 7 types and 4 states', function () {
      assertEqual(Pieces.TYPES.length, 7);
      assertDeepEqual(Pieces.STATES, ['0', 'R', '2', 'L']);
    });

    it('gives every piece 4 cells in every state', function () {
      for (const type of Pieces.TYPES) {
        for (const state of Pieces.STATES) {
          assertEqual(Pieces.cells(type, state).length, 4, type + ' ' + state);
        }
      }
    });

    it('uses a 4-wide box for I and 3-wide for the rest', function () {
      assertEqual(Pieces.boxSize('I'), 4);
      assertEqual(Pieces.boxSize('T'), 3);
      assertEqual(Pieces.boxSize('O'), 3);
    });

    it('spawns T flat-side-down across columns 3 to 5', function () {
      const p = Pieces.spawn('T');
      assertEqual(p.state, '0');
      const xs = Pieces.cells('T', '0').map(c => c.x + p.x).sort();
      assertDeepEqual(xs, [3, 4, 4, 5]);
    });

    it('spawns I across columns 3 to 6', function () {
      const p = Pieces.spawn('I');
      const xs = Pieces.cells('I', '0').map(c => c.x + p.x).sort();
      assertDeepEqual(xs, [3, 4, 5, 6]);
    });

    it('spawns O across columns 4 and 5', function () {
      const p = Pieces.spawn('O');
      const xs = Pieces.cells('O', '0').map(c => c.x + p.x).sort();
      assertDeepEqual(xs, [4, 4, 5, 5]);
    });

    it('keeps O identical in all four states', function () {
      const base = JSON.stringify(Pieces.cells('O', '0'));
      for (const state of Pieces.STATES) {
        assertEqual(JSON.stringify(Pieces.cells('O', state)), base, 'O ' + state);
      }
    });

    it('spawns every piece inside the buffer, above the visible field', function () {
      const board = Board.create();
      const firstVisible = board.rows - board.visibleRows; // 20
      for (const type of Pieces.TYPES) {
        const p = Pieces.spawn(type);
        for (const c of Pieces.cells(type, '0')) {
          assert(c.y + p.y < firstVisible, type + ' spawns inside the visible field');
          assert(c.y + p.y >= 0, type + ' spawns above the grid');
        }
      }
    });
  });

  describe('Board', function () {
    it('creates a 10x40 grid with 20 visible rows', function () {
      const b = Board.create();
      assertEqual(b.cols, 10);
      assertEqual(b.rows, 40);
      assertEqual(b.visibleRows, 20);
      assertEqual(b.grid.length, 400);
      assert(b.grid.every(c => c === null), 'grid starts empty');
    });

    it('treats the walls and floor as occupied but open sky as free', function () {
      const b = Board.create();
      assert(Board.isOccupied(b, -1, 30), 'left wall');
      assert(Board.isOccupied(b, 10, 30), 'right wall');
      assert(Board.isOccupied(b, 5, 40), 'floor');
      assert(!Board.isOccupied(b, 5, -1), 'above the grid is free');
      assert(!Board.isOccupied(b, 5, 30), 'empty cell is free');
    });

    it('builds a board from rows, bottom-aligned', function () {
      const b = Board.fromRows([
        '..........',
        'XXXX.XXXXX'
      ]);
      assertEqual(Board.isOccupied(b, 0, 39), true, 'bottom row filled');
      assertEqual(Board.isOccupied(b, 4, 39), false, 'the gap is open');
      assertEqual(Board.isOccupied(b, 0, 38), false, 'row above is empty');
    });

    it('detects collision against the stack', function () {
      const b = Board.fromRows(['XXXXXXXXXX']);
      const resting = { type: 'O', state: '0', x: 3, y: 37 };
      const overlapping = { type: 'O', state: '0', x: 3, y: 38 };
      assertEqual(Board.collides(b, resting), false);
      assertEqual(Board.collides(b, overlapping), true);
    });

    it('locks a piece into the grid', function () {
      const b = Board.create();
      Board.lock(b, { type: 'O', state: '0', x: 4, y: 38 });
      assertEqual(b.grid[Board.index(b, 5, 38)], 'O');
      assertEqual(b.grid[Board.index(b, 5, 39)], 'O');
      assertEqual(b.grid[Board.index(b, 4, 37)], null);
    });

    it('clears one full row and shifts the rest down', function () {
      const b = Board.fromRows([
        '.X........',
        'XXXXXXXXXX'
      ]);
      const result = Board.clearLines(b);
      assertEqual(result.count, 1);
      assertDeepEqual(result.rows, [39]);
      assertEqual(Board.isOccupied(b, 1, 39), true, 'the leftover block fell to the floor');
      assertEqual(Board.isOccupied(b, 0, 39), false, 'the rest of the floor is empty');
    });

    it('clears four rows at once', function () {
      const b = Board.fromRows([
        'XXXXXXXXXX',
        'XXXXXXXXXX',
        'XXXXXXXXXX',
        'XXXXXXXXXX'
      ]);
      const result = Board.clearLines(b);
      assertEqual(result.count, 4);
      assert(Board.isEmpty(b), 'board is empty after a tetris on an otherwise clean board');
    });

    it('reports empty only when nothing is locked', function () {
      const b = Board.create();
      assertEqual(Board.isEmpty(b), true);
      Board.lock(b, { type: 'O', state: '0', x: 4, y: 38 });
      assertEqual(Board.isEmpty(b), false);
    });
  });

  describe('Randomizer', function () {
    it('deals all seven pieces in each bag of seven', function () {
      const r = Randomizer.create(1234);
      for (let bag = 0; bag < 20; bag++) {
        const seen = [];
        for (let i = 0; i < 7; i++) seen.push(r.next());
        const sorted = seen.slice().sort();
        assertDeepEqual(sorted, ['I', 'J', 'L', 'O', 'S', 'T', 'Z'], 'bag ' + bag);
      }
    });

    it('reproduces the same sequence for the same seed', function () {
      const a = Randomizer.create(99);
      const b = Randomizer.create(99);
      for (let i = 0; i < 30; i++) {
        assertEqual(a.next(), b.next(), 'piece ' + i);
      }
    });

    it('gives different sequences for different seeds', function () {
      const a = Randomizer.create(1);
      const b = Randomizer.create(2);
      let same = 0;
      for (let i = 0; i < 20; i++) {
        if (a.next() === b.next()) same++;
      }
      assert(same < 20, 'two seeds produced an identical 20-piece sequence');
    });

    it('peeks without consuming', function () {
      const r = Randomizer.create(7);
      const peeked = r.peek(5);
      assertEqual(peeked.length, 5);
      for (let i = 0; i < 5; i++) {
        assertEqual(r.next(), peeked[i], 'peek ' + i + ' matched next()');
      }
    });

    it('defaults to seed 0 when none is given', function () {
      assertEqual(Randomizer.create().next(), Randomizer.create(0).next());
    });
  });

  // A collision callback that treats every cell as blocked except an
  // explicitly allowed set. Lets a test prove which kick offset fired
  // without hand-crafting a board for all 16 transitions.
  function onlyAllow(cellKeys) {
    const allowed = {};
    for (const key of cellKeys) allowed[key] = true;
    return function (x, y) {
      return allowed[x + ',' + y] !== true;
    };
  }

  function cellKeysAt(type, state, x, y) {
    return Pieces.cells(type, state).map(function (c) {
      return (x + c.x) + ',' + (y + c.y);
    });
  }

  function boardOccupancy(board) {
    return function (x, y) {
      return Board.isOccupied(board, x, y);
    };
  }

  describe('SRS tables', function () {
    it('matches the published JLSTZ table exactly', function () {
      assertDeepEqual(SRS.KICKS_JLSTZ, {
        '0>R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        'R>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        'R>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        '2>R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '2>L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
        'L>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        'L>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '0>L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
      });
    });

    it('matches the published I table exactly', function () {
      assertDeepEqual(SRS.KICKS_I, {
        '0>R': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        'R>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        'R>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
        '2>R': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        '2>L': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        'L>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        'L>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        '0>L': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
      });
    });

    it('walks all four states in both directions', function () {
      assertEqual(SRS.nextState('0', 1), 'R');
      assertEqual(SRS.nextState('R', 1), '2');
      assertEqual(SRS.nextState('2', 1), 'L');
      assertEqual(SRS.nextState('L', 1), '0');
      assertEqual(SRS.nextState('0', -1), 'L');
      assertEqual(SRS.nextState('L', -1), '2');
      assertEqual(SRS.nextState('0', 2), '2');
      assertEqual(SRS.nextState('R', 2), 'L');
    });

    it('gives O no table', function () {
      assertEqual(SRS.table('O', '0', 'R'), null);
    });
  });

  describe('SRS.rotate offset order', function () {
    // For every transition and every offset index, build a world where
    // only that offset fits, then assert rotate() found it. This is the
    // guard against a mis-ordered or mistyped table.
    it('selects each offset index in turn, for every transition', function () {
      const cases = [
        { types: ['J', 'L', 'S', 'T', 'Z'], table: SRS.KICKS_JLSTZ },
        { types: ['I'], table: SRS.KICKS_I }
      ];
      let checked = 0;

      for (const group of cases) {
        for (const type of group.types) {
          for (const key of Object.keys(group.table)) {
            const from = key.charAt(0);
            const to = key.charAt(2);
            const dir = SRS.nextState(from, 1) === to ? 1 : -1;
            const offsets = group.table[key];

            for (let k = 0; k < offsets.length; k++) {
              const startX = 10;
              const startY = 10;
              const targetX = startX + offsets[k][0];
              const targetY = startY - offsets[k][1]; // table y is up-positive
              const isOccupied = onlyAllow(cellKeysAt(type, to, targetX, targetY));
              const result = SRS.rotate(
                { type: type, state: from, x: startX, y: startY },
                dir,
                isOccupied
              );
              assert(result !== null, type + ' ' + key + ' offset ' + k + ' was rejected');
              assertEqual(result.kickIndex, k, type + ' ' + key + ' picked the wrong offset');
              assertEqual(result.piece.x, targetX, type + ' ' + key + ' offset ' + k + ' x');
              assertEqual(result.piece.y, targetY, type + ' ' + key + ' offset ' + k + ' y');
              assertEqual(result.piece.state, to);
              checked++;
            }
          }
        }
      }

      assertEqual(checked, 6 * 8 * 5, 'expected 240 offset checks');
    });

    it('converts table y to board y exactly once', function () {
      // T 0>R offset index 3 is (0,-2): two rows DOWN in board coordinates.
      const isOccupied = onlyAllow(cellKeysAt('T', 'R', 10, 12));
      const result = SRS.rotate({ type: 'T', state: '0', x: 10, y: 10 }, 1, isOccupied);
      assertEqual(result.kickIndex, 3);
      assertEqual(result.piece.y, 12, 'a -2 table offset moves the piece down, not up');
    });

    it('does not mutate the piece it was given', function () {
      const piece = { type: 'T', state: '0', x: 4, y: 20 };
      SRS.rotate(piece, 1, function () { return false; });
      assertDeepEqual(piece, { type: 'T', state: '0', x: 4, y: 20 });
    });

    it('rotates O in place with no kick', function () {
      const result = SRS.rotate({ type: 'O', state: '0', x: 4, y: 20 }, 1, function () { return false; });
      assertEqual(result.kickIndex, 0);
      assertEqual(result.piece.x, 4);
      assertEqual(result.piece.y, 20);
      assertEqual(result.piece.state, 'R');
    });
  });

  describe('SRS.rotate against real boards', function () {
    it('wall-kicks a vertical I away from the left wall', function () {
      const board = Board.create();
      const result = SRS.rotate({ type: 'I', state: 'R', x: -2, y: 20 }, -1, boardOccupancy(board));
      assertEqual(result.kickIndex, 1, 'the +2 offset should fire');
      assertEqual(result.piece.x, 0);
      assertEqual(result.piece.state, '0');
    });

    it('floor-kicks a flat I off the floor', function () {
      const board = Board.create();
      const result = SRS.rotate({ type: 'I', state: '0', x: 3, y: 38 }, 1, boardOccupancy(board));
      assertEqual(result.kickIndex, 4, 'only the last offset lifts the I clear of the floor');
      assertEqual(result.piece.x, 4);
      assertEqual(result.piece.y, 36);
    });

    it('rejects a rotation when all five offsets collide', function () {
      const board = Board.fromRows([
        'XXXXXXXXXX',
        'XXXX.XXXXX',
        'XXX...XXXX',
        'XXXXXXXXXX'
      ]);
      const result = SRS.rotate({ type: 'T', state: '0', x: 3, y: 37 }, 1, boardOccupancy(board));
      assertEqual(result, null);
    });

    it('kicks a 180 upward off the floor before trying downward', function () {
      const board = Board.fromRows(['XXXXXXXXXX']);
      // A point-up T sitting one row above the floor. Rotating it 180
      // needs a row of clearance, and the only clearance is above: at the
      // (0,0) offset the T's new nub would land inside the floor row.
      const piece = { type: 'T', state: '0', x: 3, y: 37 };
      assertEqual(Board.collides(board, piece), false, 'the T starts in a legal spot');
      const result = SRS.rotate(piece, 2, boardOccupancy(board));
      assert(result !== null, '180 off the floor was rejected');
      assertEqual(result.piece.state, '2');
      assertEqual(result.kickIndex, 1, 'the upward offset should fire');
      assertEqual(result.piece.y, 36, '180 kicked downward into the floor');
    });
  });

  describe('SRS.classifySpin', function () {
    it('awards a full T-spin for a double setup', function () {
      const board = Board.fromRows([
        '.....X....',
        'XXX...XXXX',
        'XXXX.XXXXX'
      ]);
      const piece = { type: 'T', state: '2', x: 3, y: 37 };
      assertEqual(Board.collides(board, piece), false, 'the T fits the slot');
      assertEqual(SRS.classifySpin(piece, 0, boardOccupancy(board)), 'tspin');
    });

    it('awards a full T-spin for a triple setup', function () {
      const board = Board.fromRows([
        'XXXX.XXXXX',
        'XXXX..XXXX',
        'XXXX.XXXXX'
      ]);
      const piece = { type: 'T', state: 'R', x: 3, y: 37 };
      assertEqual(Board.collides(board, piece), false, 'the T fits the slot');
      assertEqual(SRS.classifySpin(piece, 4, boardOccupancy(board)), 'tspin');
    });

    it('awards a mini when only one front corner is filled', function () {
      const board = Board.fromRows([
        '.....X....',
        'XXX...XXXX',
        'XXXXXXXXXX'
      ]);
      const piece = { type: 'T', state: '0', x: 3, y: 37 };
      assertEqual(Board.collides(board, piece), false, 'the T fits the slot');
      assertEqual(SRS.classifySpin(piece, 0, boardOccupancy(board)), 'mini');
    });

    it('upgrades a mini to a full T-spin when the fifth offset fired', function () {
      const board = Board.fromRows([
        '.....X....',
        'XXX...XXXX',
        'XXXXXXXXXX'
      ]);
      const piece = { type: 'T', state: '0', x: 3, y: 37 };
      assertEqual(SRS.classifySpin(piece, 4, boardOccupancy(board)), 'tspin');
    });

    it('awards nothing on an open board', function () {
      const board = Board.create();
      const piece = { type: 'T', state: '0', x: 3, y: 30 };
      assertEqual(SRS.classifySpin(piece, 0, boardOccupancy(board)), 'none');
    });

    it('awards nothing to pieces other than T', function () {
      const board = Board.fromRows([
        'XXXXXXXXXX',
        'XXX...XXXX',
        'XXXXXXXXXX'
      ]);
      for (const type of ['I', 'J', 'L', 'O', 'S', 'Z']) {
        assertEqual(
          SRS.classifySpin({ type: type, state: '0', x: 3, y: 37 }, 4, boardOccupancy(board)),
          'none',
          type + ' earned a spin'
        );
      }
    });
  });

  describe('Scoring', function () {
    function scoreOnce(opts) {
      const st = Scoring.create();
      if (opts.level) st.level = opts.level;
      return Scoring.applyLock(st, {
        lines: opts.lines,
        spin: opts.spin || 'none',
        perfectClear: opts.perfectClear === true
      }).points;
    }

    it('scores the plain line clears', function () {
      assertEqual(scoreOnce({ lines: 1 }), 100);
      assertEqual(scoreOnce({ lines: 2 }), 300);
      assertEqual(scoreOnce({ lines: 3 }), 500);
      assertEqual(scoreOnce({ lines: 4 }), 800);
    });

    it('scores a lock that clears nothing as zero', function () {
      assertEqual(scoreOnce({ lines: 0 }), 0);
    });

    it('scores T-spins', function () {
      assertEqual(scoreOnce({ lines: 0, spin: 'tspin' }), 400);
      assertEqual(scoreOnce({ lines: 1, spin: 'tspin' }), 800);
      assertEqual(scoreOnce({ lines: 2, spin: 'tspin' }), 1200);
      assertEqual(scoreOnce({ lines: 3, spin: 'tspin' }), 1600);
    });

    it('scores mini T-spins', function () {
      assertEqual(scoreOnce({ lines: 0, spin: 'mini' }), 100);
      assertEqual(scoreOnce({ lines: 1, spin: 'mini' }), 200);
      assertEqual(scoreOnce({ lines: 2, spin: 'mini' }), 400);
    });

    it('multiplies by level', function () {
      assertEqual(scoreOnce({ lines: 4, level: 5 }), 4000);
      assertEqual(scoreOnce({ lines: 2, spin: 'tspin', level: 3 }), 3600);
    });

    it('names the clear kind', function () {
      assertEqual(Scoring.kindFor(1, 'none'), 'single');
      assertEqual(Scoring.kindFor(4, 'none'), 'tetris');
      assertEqual(Scoring.kindFor(0, 'tspin'), 'tspin');
      assertEqual(Scoring.kindFor(2, 'tspin'), 'tspin-double');
      assertEqual(Scoring.kindFor(1, 'mini'), 'mini-single');
      assertEqual(Scoring.kindFor(0, 'none'), 'none');
    });

    it('starts a combo on the second consecutive clear', function () {
      const st = Scoring.create();
      const first = Scoring.applyLock(st, { lines: 1, spin: 'none', perfectClear: false });
      assertEqual(first.chain, 1);
      assertEqual(first.points, 100, 'no combo bonus on the first clear');

      const second = Scoring.applyLock(st, { lines: 1, spin: 'none', perfectClear: false });
      assertEqual(second.chain, 2);
      assertEqual(second.points, 150, '100 for the single plus 50 for combo 1');

      const third = Scoring.applyLock(st, { lines: 1, spin: 'none', perfectClear: false });
      assertEqual(third.chain, 3);
      assertEqual(third.points, 200, '100 plus 100 for combo 2');
    });

    it('breaks the combo on a lock that clears nothing', function () {
      const st = Scoring.create();
      Scoring.applyLock(st, { lines: 1, spin: 'none', perfectClear: false });
      Scoring.applyLock(st, { lines: 1, spin: 'none', perfectClear: false });
      const dry = Scoring.applyLock(st, { lines: 0, spin: 'none', perfectClear: false });
      assertEqual(dry.chain, 0);
      assertEqual(st.chain, 0);
    });

    it('sets back-to-back on a tetris and rewards the next difficult clear', function () {
      const st = Scoring.create();
      const first = Scoring.applyLock(st, { lines: 4, spin: 'none', perfectClear: false });
      assertEqual(first.b2b, false, 'the first tetris has nothing to chain from');
      assertEqual(first.points, 800);

      const second = Scoring.applyLock(st, { lines: 4, spin: 'none', perfectClear: false });
      assertEqual(second.b2b, true);
      // 800 * 1.5 = 1200, plus 50 for combo 1
      assertEqual(second.points, 1250);
    });

    it('chains back-to-back between a tetris and a T-spin', function () {
      const st = Scoring.create();
      Scoring.applyLock(st, { lines: 4, spin: 'none', perfectClear: false });
      const spin = Scoring.applyLock(st, { lines: 2, spin: 'tspin', perfectClear: false });
      assertEqual(spin.b2b, true);
      // 1200 * 1.5 = 1800, plus 50 for combo 1
      assertEqual(spin.points, 1850);
    });

    it('breaks back-to-back on an easy clear', function () {
      const st = Scoring.create();
      Scoring.applyLock(st, { lines: 4, spin: 'none', perfectClear: false });
      const easy = Scoring.applyLock(st, { lines: 2, spin: 'none', perfectClear: false });
      assertEqual(easy.b2b, false);
      assertEqual(st.b2b, false, 'an easy clear ends the chain');
    });

    it('keeps back-to-back alive across a lock that clears nothing', function () {
      const st = Scoring.create();
      Scoring.applyLock(st, { lines: 4, spin: 'none', perfectClear: false });
      Scoring.applyLock(st, { lines: 0, spin: 'none', perfectClear: false });
      assertEqual(st.b2b, true, 'a dry lock breaks the combo but not back-to-back');
      const next = Scoring.applyLock(st, { lines: 4, spin: 'none', perfectClear: false });
      assertEqual(next.b2b, true);
    });

    it('adds the perfect clear bonus on top', function () {
      assertEqual(scoreOnce({ lines: 1, perfectClear: true }), 100 + 800);
      assertEqual(scoreOnce({ lines: 4, perfectClear: true }), 800 + 2000);
    });

    it('counts lines and raises the level every ten', function () {
      const st = Scoring.create();
      assertEqual(Scoring.levelForLines(0), 1);
      assertEqual(Scoring.levelForLines(9), 1);
      assertEqual(Scoring.levelForLines(10), 2);
      assertEqual(Scoring.levelForLines(25), 3);

      for (let i = 0; i < 4; i++) {
        Scoring.applyLock(st, { lines: 2, spin: 'none', perfectClear: false });
      }
      assertEqual(st.lines, 8);
      assertEqual(st.level, 1);
      const tenth = Scoring.applyLock(st, { lines: 2, spin: 'none', perfectClear: false });
      assertEqual(st.lines, 10);
      assertEqual(st.level, 2);
      assertEqual(tenth.leveledUp, true);
    });

    it('awards drop points without the level multiplier', function () {
      const st = Scoring.create();
      st.level = 9;
      assertEqual(Scoring.addDropPoints(st, 5, false), 5, 'soft drop is 1 per cell');
      assertEqual(Scoring.addDropPoints(st, 5, true), 10, 'hard drop is 2 per cell');
      assertEqual(st.score, 15);
    });

    it('starts level 1 at one second per cell and speeds up from there', function () {
      assertEqual(Math.round(Scoring.gravityMs(1)), 1000);
      assert(Scoring.gravityMs(5) < Scoring.gravityMs(4), 'level 5 is faster than 4');
      assert(Scoring.gravityMs(15) < 16.7, 'level 15 is under one frame');
    });

    it('never returns a broken gravity value at absurd levels', function () {
      for (const level of [20, 50, 200, 5000]) {
        const ms = Scoring.gravityMs(level);
        assert(isFinite(ms) && ms > 0, 'level ' + level + ' produced ' + ms);
      }
    });
  });

  describe('Game lifecycle', function () {
    const NOTHING = {};

    function gameWith(options) {
      const opts = { seed: 42 };
      for (const key of Object.keys(options || {})) opts[key] = options[key];
      return Game.create(opts);
    }

    // Advance in 16ms frames with the same actions held down throughout.
    // Tests that need a single pulse call Game.tick directly instead.
    function frames(g, count, actions) {
      let all = [];
      for (let i = 0; i < count; i++) {
        all = all.concat(Game.tick(g, 16, actions || NOTHING));
      }
      return all;
    }

    // Run until the active piece locks. A single huge tick cannot be used
    // here: Game.tick clamps its delta, so the lock delay needs real ticks.
    function untilLock(g) {
      const all = [];
      for (let i = 0; i < 100; i++) {
        const batch = Game.tick(g, 50, NOTHING);
        for (const e of batch) all.push(e);
        if (batch.some(e => e.type === 'lock')) break;
      }
      return all;
    }

    function dropToFloor(g) {
      let guard = 0;
      while (!Game.isGrounded(g) && guard++ < 100) Game.tick(g, 50, { softDrop: true });
    }

    // The T-spin Double slot used throughout. The 'X' on the top row is
    // the overhang that makes the slot reachable only by rotating into it.
    function tsdBoard() {
      return Board.fromRows([
        '.....X....',
        'XXX...XXXX',
        'XXXX.XXXXX'
      ]);
    }

    it('spawns a piece and fills the next queue', function () {
      const g = gameWith({});
      assert(g.piece !== null, 'no active piece');
      assertEqual(g.queue.length, 5);
      assertEqual(g.status, 'playing');
    });

    it('deals a scripted piece order when given one', function () {
      const g = gameWith({ pieces: ['T', 'I', 'O'] });
      assertEqual(g.piece.type, 'T');
      assertEqual(g.queue[0], 'I');
      assertEqual(g.queue[1], 'O');
    });

    it('clamps an absurd frame delta', function () {
      const g = gameWith({ pieces: ['I'] });
      const startY = g.piece.y;
      // A backgrounded tab handing over thirty seconds at once.
      Game.tick(g, 30000, NOTHING);
      assert(g.timeMs <= Game.MAX_TICK_MS, 'the clock absorbed the whole gap');
      assertEqual(g.piece.y, startY, 'the piece fell during a frozen frame');
    });

    it('drops one cell per second at level 1', function () {
      const g = gameWith({ pieces: ['O'] });
      const startY = g.piece.y;
      frames(g, 63);   // 1008ms: just past the 1000ms interval, not two of them
      assertEqual(g.piece.y, startY + 1);
    });

    it('moves one cell per action pulse, not per frame', function () {
      const g = gameWith({ pieces: ['O'] });
      const startX = g.piece.x;
      Game.tick(g, 16, { right: true });
      assertEqual(g.piece.x, startX + 1);
      Game.tick(g, 16, NOTHING);
      assertEqual(g.piece.x, startX + 1, 'the piece kept moving without an action');
    });

    it('slides as far as moveCells allows in one tick', function () {
      const g = gameWith({ pieces: ['O'] });
      Game.tick(g, 16, { left: true, moveCells: 10 });
      assertEqual(g.piece.x, -1, 'an ARR-0 pulse should reach the wall in one frame');
    });

    it('stops at the wall', function () {
      const g = gameWith({ pieces: ['O'] });
      frames(g, 20, { left: true });
      // The O's cells sit in box columns 1 and 2, so the leftmost legal
      // box origin is -1.
      assertEqual(g.piece.x, -1);
      assertEqual(Board.collides(g.board, g.piece), false);
    });

    it('reports the ghost row', function () {
      const g = gameWith({ pieces: ['O'] });
      assertEqual(Game.ghostY(g), 38, 'an O resting on an empty floor');
    });

    it('hard drops, scores two per cell, and locks at once', function () {
      const g = gameWith({ pieces: ['O', 'T'] });
      const distance = 38 - g.piece.y;
      const events = Game.tick(g, 16, { hardDrop: true });
      assertEqual(g.scoring.score, distance * 2);
      assert(events.some(e => e.type === 'lock'), 'no lock event');
      assertEqual(g.piece.type, 'T', 'the next piece should already be active');
      assertEqual(Board.isOccupied(g.board, 4, 39), true, 'the O landed on the floor');
    });

    it('scores one per cell for soft drop', function () {
      const g = gameWith({ pieces: ['O'] });
      const startY = g.piece.y;
      frames(g, 30, { softDrop: true });
      // 480ms of soft drop at a cell every 50ms.
      assertEqual(g.piece.y - startY, 9);
      assertEqual(g.scoring.score, 9);
    });

    it('locks about 500ms after landing, not before', function () {
      const g = gameWith({ pieces: ['O', 'T'] });
      dropToFloor(g);
      assertEqual(g.piece.type, 'O', 'still the same piece once grounded');

      let elapsed = g.lockMs;
      let guard = 0;
      while (g.piece.type === 'O' && guard++ < 200) {
        Game.tick(g, 16, NOTHING);
        elapsed += 16;
      }
      assert(elapsed >= 500 && elapsed <= 520, 'locked after ' + elapsed + 'ms, expected about 500ms');
      assertEqual(g.piece.type, 'T');
    });

    it('resets the lock timer on a move, up to fifteen times', function () {
      const g = gameWith({ pieces: ['O', 'T'], maxResets: 15 });
      dropToFloor(g);

      // Each nudge restarts the 500ms timer, so fifteen of them keep the
      // piece alive well past it.
      for (let i = 0; i < 15; i++) {
        frames(g, 20);  // 320ms, comfortably under the lock delay
        Game.tick(g, 16, i % 2 === 0 ? { left: true } : { right: true });
      }
      assertEqual(g.piece.type, 'O', 'the reset budget was not honoured');
      assertEqual(g.resets, 15);

      // Budget spent: further nudges no longer extend the timer.
      frames(g, 40, { left: true });
      assertEqual(g.piece.type, 'T', 'the piece never locked after the budget ran out');
    });

    it('holds a piece, swaps it back, and allows only one hold per piece', function () {
      const g = gameWith({ pieces: ['T', 'I', 'O'] });
      Game.tick(g, 16, { hold: true });
      assertEqual(g.hold, 'T');
      assertEqual(g.piece.type, 'I', 'the queue should have supplied the next piece');
      assertEqual(g.canHold, false);

      Game.tick(g, 16, { hold: true });
      assertEqual(g.piece.type, 'I', 'a second hold on the same piece was allowed');

      Game.tick(g, 16, { hardDrop: true });
      assertEqual(g.canHold, true, 'hold should be available again after a lock');
      Game.tick(g, 16, { hold: true });
      assertEqual(g.hold, 'O');
      assertEqual(g.piece.type, 'T', 'the held T should come back');
    });

    it('ends the game when a spawning piece has no room', function () {
      // Filled from row 21 down, column 9 left open so nothing clears. The
      // first O lands at rows 19-20, which then blocks the next spawn.
      const rows = [];
      for (let i = 0; i < 19; i++) rows.push('XXXXXXXXX.');
      const g = gameWith({ pieces: ['O', 'O'], board: Board.fromRows(rows) });
      const events = Game.tick(g, 16, { hardDrop: true });
      assertEqual(g.status, 'over');
      const over = events.filter(e => e.type === 'gameover')[0];
      assert(over, 'no gameover event');
      assertEqual(over.reason, 'blockout');
    });

    it('ends the game when a piece locks entirely above the visible field', function () {
      // The whole visible field filled except column 9, so nothing clears
      // and the O is forced to rest in the buffer.
      const rows = [];
      for (let i = 0; i < 20; i++) rows.push('XXXXXXXXX.');
      const g = gameWith({ pieces: ['O', 'T'], board: Board.fromRows(rows) });
      const events = Game.tick(g, 16, { hardDrop: true });
      const over = events.filter(e => e.type === 'gameover')[0];
      assert(over, 'no gameover event');
      assertEqual(over.reason, 'lockout');
    });

    it('clears a line and reports the row', function () {
      // The gap is columns 3..6, exactly where a spawned I sits.
      const g = gameWith({ pieces: ['I'], board: Board.fromRows(['XXX....XXX']) });
      const events = Game.tick(g, 16, { hardDrop: true });
      const lock = events.filter(e => e.type === 'lock')[0];
      assertEqual(lock.lines, 1);
      assertDeepEqual(lock.rows, [39]);
      assertEqual(g.scoring.lines, 1);
    });

    it('cannot reach the T-spin slot by dropping into it', function () {
      // This is why a T-spin is a spin: the overhang blocks every vertical
      // approach, so the only way in is a rotation.
      const g = gameWith({ pieces: ['T'], board: tsdBoard() });
      Game.tick(g, 16, { rotate180: true });
      assertEqual(g.piece.state, '2');
      dropToFloor(g);
      assert(g.piece.y < 37, 'the overhang should have stopped the T above the slot');
    });

    it('awards a T-spin double performed through real rotation', function () {
      const g = gameWith({ pieces: ['T'], board: tsdBoard() });
      Game.tick(g, 16, { rotateCCW: true });   // 0 -> L, nub to the left
      assertEqual(g.piece.state, 'L');
      dropToFloor(g);
      assertEqual(g.piece.y, 37, 'the L-facing T should slide down beside the slot');

      const rotated = Game.tick(g, 16, { rotateCCW: true });  // L -> 2, into the slot
      assert(rotated.some(e => e.type === 'rotate'), 'the rotation into the slot was rejected');
      assertEqual(g.piece.state, '2');

      const lock = untilLock(g).filter(e => e.type === 'lock')[0];
      assert(lock, 'the T never locked');
      assertEqual(lock.spin, 'tspin');
      assertEqual(lock.lines, 2);
      assertEqual(lock.kind, 'tspin-double');
      assertDeepEqual(lock.rows, [38, 39]);
    });

    it('keeps the spin when a hard drop moves the piece zero cells', function () {
      const g = gameWith({ pieces: ['T'], board: tsdBoard() });
      Game.tick(g, 16, { rotateCCW: true });
      dropToFloor(g);
      Game.tick(g, 16, { rotateCCW: true });
      const lock = Game.tick(g, 16, { hardDrop: true }).filter(e => e.type === 'lock')[0];
      assertEqual(lock.spin, 'tspin', 'slamming an already-resting spin lost the bonus');
    });

    it('clears the spin claim when gravity moves the piece', function () {
      const g = gameWith({ pieces: ['T'] });
      Game.tick(g, 16, { rotateCW: true });
      assertEqual(g.rotatedLast, true);
      frames(g, 70);  // over a second at level 1: the piece falls a cell
      assertEqual(g.rotatedLast, false, 'falling should cancel the spin claim');
    });

    it('clears the spin claim when the piece moves sideways', function () {
      const g = gameWith({ pieces: ['T'] });
      Game.tick(g, 16, { rotateCW: true });
      assertEqual(g.rotatedLast, true);
      Game.tick(g, 16, { right: true });
      assertEqual(g.rotatedLast, false);
    });

    it('ends a sprint when it reaches its line goal', function () {
      const g = gameWith({
        mode: 'sprint',
        pieces: ['I'],
        sprintLines: 1,
        board: Board.fromRows(['XXX....XXX'])
      });
      const events = Game.tick(g, 16, { hardDrop: true });
      assertEqual(g.status, 'won');
      const win = events.filter(e => e.type === 'win')[0];
      assert(win, 'no win event');
      assertEqual(win.lines, 1);
    });

    it('ignores input once the game is over', function () {
      const rows = [];
      for (let i = 0; i < 19; i++) rows.push('XXXXXXXXX.');
      const g = gameWith({ pieces: ['O', 'O'], board: Board.fromRows(rows) });
      Game.tick(g, 16, { hardDrop: true });
      assertEqual(g.status, 'over');
      const after = Game.tick(g, 16, { hardDrop: true, left: true, rotateCW: true });
      assertDeepEqual(after, []);
    });
  });
})();
