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
})();
