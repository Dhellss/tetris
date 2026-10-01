(function (root) {
  'use strict';

  const STATES = ['0', 'R', '2', 'L'];

  // Box-relative cells, y down, origin at the box's top-left corner.
  // JLSTZ and O use a 3x3 box; I uses 4x4.
  const SHAPES = {
    I: {
      '0': [[0, 1], [1, 1], [2, 1], [3, 1]],
      'R': [[2, 0], [2, 1], [2, 2], [2, 3]],
      '2': [[0, 2], [1, 2], [2, 2], [3, 2]],
      'L': [[1, 0], [1, 1], [1, 2], [1, 3]]
    },
    J: {
      '0': [[0, 0], [0, 1], [1, 1], [2, 1]],
      'R': [[1, 0], [2, 0], [1, 1], [1, 2]],
      '2': [[0, 1], [1, 1], [2, 1], [2, 2]],
      'L': [[1, 0], [1, 1], [0, 2], [1, 2]]
    },
    L: {
      '0': [[2, 0], [0, 1], [1, 1], [2, 1]],
      'R': [[1, 0], [1, 1], [1, 2], [2, 2]],
      '2': [[0, 1], [1, 1], [2, 1], [0, 2]],
      'L': [[0, 0], [1, 0], [1, 1], [1, 2]]
    },
    O: {
      '0': [[1, 0], [2, 0], [1, 1], [2, 1]],
      'R': [[1, 0], [2, 0], [1, 1], [2, 1]],
      '2': [[1, 0], [2, 0], [1, 1], [2, 1]],
      'L': [[1, 0], [2, 0], [1, 1], [2, 1]]
    },
    S: {
      '0': [[1, 0], [2, 0], [0, 1], [1, 1]],
      'R': [[1, 0], [1, 1], [2, 1], [2, 2]],
      '2': [[1, 1], [2, 1], [0, 2], [1, 2]],
      'L': [[0, 0], [0, 1], [1, 1], [1, 2]]
    },
    T: {
      '0': [[1, 0], [0, 1], [1, 1], [2, 1]],
      'R': [[1, 0], [1, 1], [2, 1], [1, 2]],
      '2': [[0, 1], [1, 1], [2, 1], [1, 2]],
      'L': [[1, 0], [0, 1], [1, 1], [1, 2]]
    },
    Z: {
      '0': [[0, 0], [1, 0], [1, 1], [2, 1]],
      'R': [[2, 0], [1, 1], [2, 1], [1, 2]],
      '2': [[0, 1], [1, 1], [1, 2], [2, 2]],
      'L': [[1, 0], [0, 1], [1, 1], [0, 2]]
    }
  };

  // Precompute as {x, y} objects so callers never mutate the source arrays.
  const CELLS = {};
  for (const type of Object.keys(SHAPES)) {
    CELLS[type] = {};
    for (const state of STATES) {
      CELLS[type][state] = SHAPES[type][state].map(function (pair) {
        return { x: pair[0], y: pair[1] };
      });
    }
  }

  function boxSize(type) {
    return type === 'I' ? 4 : 3;
  }

  function cells(type, state) {
    const byState = CELLS[type];
    if (!byState) throw new Error('unknown piece type: ' + type);
    const list = byState[state];
    if (!list) throw new Error('unknown rotation state: ' + state);
    return list;
  }

  // Spawn so the box sits in columns 3..5 (3..6 for I), with its top row
  // two rows above the visible field. Rows 18 and 19 of a 40-row grid are
  // the last two buffer rows.
  function spawn(type) {
    return { type: type, state: '0', x: 3, y: 18 };
  }

  root.Pieces = {
    TYPES: ['I', 'J', 'L', 'O', 'S', 'T', 'Z'],
    STATES: STATES,
    COLORS: {
      I: '#31c7ef',
      J: '#5a65ad',
      L: '#ef7921',
      O: '#f7d308',
      S: '#42b642',
      T: '#ad4d9c',
      Z: '#ef2029'
    },
    boxSize: boxSize,
    cells: cells,
    spawn: spawn
  };
})(typeof window !== 'undefined' ? window : globalThis);
