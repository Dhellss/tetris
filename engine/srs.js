(function (root) {
  'use strict';

  const ORDER = ['0', 'R', '2', 'L'];

  // Offsets are [x, y] with y UP-positive, matching every published SRS
  // reference. rotate() is the only place that flips y for board use.
  const KICKS_JLSTZ = {
    '0>R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    'R>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    'R>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>R': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    'L>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    'L>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>L': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
  };

  const KICKS_I = {
    '0>R': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    'R>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    'R>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>R': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>L': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    'L>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    'L>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>L': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
  };

  // Up before down: a 180 is usually performed resting on a surface, so
  // the clearance it needs is above the piece.
  const HALF = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]];
  const KICKS_180 = {
    '0>2': HALF,
    'R>L': HALF,
    '2>0': HALF,
    'L>R': HALF
  };

  function nextState(state, dir) {
    const from = ORDER.indexOf(state);
    if (from === -1) throw new Error('unknown rotation state: ' + state);
    const steps = dir === 2 ? 2 : (dir > 0 ? 1 : 3);
    return ORDER[(from + steps) % 4];
  }

  function table(type, from, to) {
    if (type === 'O') return null;
    const key = from + '>' + to;
    if (KICKS_180[key]) return KICKS_180[key];
    return type === 'I' ? KICKS_I[key] : KICKS_JLSTZ[key];
  }

  function fits(piece, isOccupied) {
    const cells = Pieces.cells(piece.type, piece.state);
    for (let i = 0; i < cells.length; i++) {
      if (isOccupied(piece.x + cells[i].x, piece.y + cells[i].y)) return false;
    }
    return true;
  }

  function rotate(piece, dir, isOccupied) {
    const to = nextState(piece.state, dir);
    const offsets = table(piece.type, piece.state, to);

    if (!offsets) {
      // O: the cells are identical in every state, so the state label
      // changes and nothing moves.
      const spun = { type: piece.type, state: to, x: piece.x, y: piece.y };
      return fits(spun, isOccupied) ? { piece: spun, kickIndex: 0 } : null;
    }

    for (let i = 0; i < offsets.length; i++) {
      const candidate = {
        type: piece.type,
        state: to,
        x: piece.x + offsets[i][0],
        y: piece.y - offsets[i][1]
      };
      if (fits(candidate, isOccupied)) return { piece: candidate, kickIndex: i };
    }
    return null;
  }

  // The two cells adjacent to the T's pointing edge, as [dx, dy] from the
  // T's centre in board coordinates.
  const FRONT_CORNERS = {
    '0': [[-1, -1], [1, -1]],
    'R': [[1, -1], [1, 1]],
    '2': [[-1, 1], [1, 1]],
    'L': [[-1, -1], [-1, 1]]
  };
  const ALL_CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

  function classifySpin(piece, kickIndex, isOccupied) {
    if (piece.type !== 'T') return 'none';

    // The T's centre is box cell (1,1).
    const cx = piece.x + 1;
    const cy = piece.y + 1;

    let occupied = 0;
    for (let i = 0; i < ALL_CORNERS.length; i++) {
      if (isOccupied(cx + ALL_CORNERS[i][0], cy + ALL_CORNERS[i][1])) occupied++;
    }
    if (occupied < 3) return 'none';

    const front = FRONT_CORNERS[piece.state];
    let frontFilled = 0;
    for (let i = 0; i < front.length; i++) {
      if (isOccupied(cx + front[i][0], cy + front[i][1])) frontFilled++;
    }

    if (frontFilled === 2) return 'tspin';
    // The fifth offset is the deep kick that makes a T-spin Triple
    // possible; a mini reached that way counts as the real thing.
    return kickIndex === 4 ? 'tspin' : 'mini';
  }

  root.SRS = {
    KICKS_JLSTZ: KICKS_JLSTZ,
    KICKS_I: KICKS_I,
    KICKS_180: KICKS_180,
    nextState: nextState,
    table: table,
    rotate: rotate,
    classifySpin: classifySpin
  };
})(typeof window !== 'undefined' ? window : globalThis);
