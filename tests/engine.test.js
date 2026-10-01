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
})();
