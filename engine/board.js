(function (root) {
  'use strict';

  const COLS = 10;
  const ROWS = 40;
  const VISIBLE_ROWS = 20;

  function create() {
    return {
      cols: COLS,
      rows: ROWS,
      visibleRows: VISIBLE_ROWS,
      grid: new Array(COLS * ROWS).fill(null)
    };
  }

  function index(board, x, y) {
    return y * board.cols + x;
  }

  // Outside the sides and below the floor counts as occupied so collision
  // needs no separate bounds check. Above the grid is open sky.
  function isOccupied(board, x, y) {
    if (x < 0 || x >= board.cols) return true;
    if (y >= board.rows) return true;
    if (y < 0) return false;
    return board.grid[index(board, x, y)] !== null;
  }

  function collides(board, piece) {
    const cells = Pieces.cells(piece.type, piece.state);
    for (let i = 0; i < cells.length; i++) {
      if (isOccupied(board, piece.x + cells[i].x, piece.y + cells[i].y)) return true;
    }
    return false;
  }

  function lock(board, piece) {
    const cells = Pieces.cells(piece.type, piece.state);
    for (let i = 0; i < cells.length; i++) {
      const x = piece.x + cells[i].x;
      const y = piece.y + cells[i].y;
      if (y >= 0 && y < board.rows && x >= 0 && x < board.cols) {
        board.grid[index(board, x, y)] = piece.type;
      }
    }
    return board;
  }

  function isRowFull(board, y) {
    for (let x = 0; x < board.cols; x++) {
      if (board.grid[index(board, x, y)] === null) return false;
    }
    return true;
  }

  // Removes every full row and lets the rows above fall. Returns the
  // cleared row indices, top first, so the renderer can flash them.
  function clearLines(board) {
    const cleared = [];
    for (let y = 0; y < board.rows; y++) {
      if (isRowFull(board, y)) cleared.push(y);
    }
    if (cleared.length === 0) return { rows: cleared, count: 0 };

    const kept = [];
    for (let y = 0; y < board.rows; y++) {
      if (cleared.indexOf(y) === -1) {
        kept.push(board.grid.slice(y * board.cols, (y + 1) * board.cols));
      }
    }
    while (kept.length < board.rows) {
      kept.unshift(new Array(board.cols).fill(null));
    }

    const next = [];
    for (let i = 0; i < kept.length; i++) {
      for (let x = 0; x < board.cols; x++) next.push(kept[i][x]);
    }
    board.grid = next;

    return { rows: cleared, count: cleared.length };
  }

  function isEmpty(board) {
    for (let i = 0; i < board.grid.length; i++) {
      if (board.grid[i] !== null) return false;
    }
    return true;
  }

  // Test and lesson helper: rows are 10-character strings, listed top to
  // bottom, anchored to the floor. '.' is empty; anything else is a
  // garbage block.
  function fromRows(rows) {
    const board = create();
    const offset = board.rows - rows.length;
    for (let r = 0; r < rows.length; r++) {
      const line = rows[r];
      for (let x = 0; x < board.cols; x++) {
        const ch = line.charAt(x);
        if (ch && ch !== '.') {
          board.grid[index(board, x, offset + r)] = 'G';
        }
      }
    }
    return board;
  }

  root.Board = {
    COLS: COLS,
    ROWS: ROWS,
    VISIBLE_ROWS: VISIBLE_ROWS,
    create: create,
    index: index,
    isOccupied: isOccupied,
    collides: collides,
    lock: lock,
    isRowFull: isRowFull,
    clearLines: clearLines,
    isEmpty: isEmpty,
    fromRows: fromRows
  };
})(typeof window !== 'undefined' ? window : globalThis);
