(function (root) {
  'use strict';

  const SOFT_DROP_MS = 50;        // 20 cells per second
  const MAX_GRAVITY_LEVEL = 20;   // the curve goes imaginary past level 115

  const CLEAR_POINTS = {
    'none': 0,
    'single': 100,
    'double': 300,
    'triple': 500,
    'tetris': 800,
    'tspin': 400,
    'tspin-single': 800,
    'tspin-double': 1200,
    'tspin-triple': 1600,
    'mini': 100,
    'mini-single': 200,
    'mini-double': 400
  };

  const PERFECT_CLEAR_POINTS = { 1: 800, 2: 1200, 3: 1800, 4: 2000 };

  const PLAIN_NAMES = ['none', 'single', 'double', 'triple', 'tetris'];

  function create() {
    return { score: 0, lines: 0, level: 1, chain: 0, b2b: false };
  }

  function kindFor(lines, spin) {
    if (spin === 'tspin' || spin === 'mini') {
      const prefix = spin === 'tspin' ? 'tspin' : 'mini';
      if (lines === 0) return prefix;
      return prefix + '-' + PLAIN_NAMES[lines];
    }
    return PLAIN_NAMES[lines] || 'none';
  }

  function levelForLines(lines) {
    return 1 + Math.floor(lines / 10);
  }

  // Guideline curve: seconds per cell at level n.
  function gravityMs(level) {
    const n = Math.max(1, Math.min(level, MAX_GRAVITY_LEVEL));
    return Math.pow(0.8 - (n - 1) * 0.007, n - 1) * 1000;
  }

  // A clear is "difficult" — and so eligible for back-to-back — when it is
  // a tetris or any T-spin that cleared at least one line.
  function isDifficult(lines, spin) {
    if (lines === 0) return false;
    return lines === 4 || spin === 'tspin' || spin === 'mini';
  }

  function applyLock(state, event) {
    const lines = event.lines || 0;
    const spin = event.spin || 'none';
    const kind = kindFor(lines, spin);
    const difficult = isDifficult(lines, spin);

    // Back-to-back applies when the previous difficult clear is still
    // standing. A dry lock breaks the combo but leaves it alone.
    const b2b = difficult && state.b2b === true;

    let points = CLEAR_POINTS[kind] || 0;
    if (b2b) points = Math.floor(points * 1.5);

    if (lines > 0) {
      state.chain += 1;
      if (state.chain >= 2) points += 50 * (state.chain - 1);
    } else {
      state.chain = 0;
    }

    if (event.perfectClear && PERFECT_CLEAR_POINTS[lines]) {
      points += PERFECT_CLEAR_POINTS[lines];
    }

    points = points * state.level;

    if (difficult) {
      state.b2b = true;
    } else if (lines > 0) {
      state.b2b = false;
    }

    const levelBefore = state.level;
    state.lines += lines;
    state.level = levelForLines(state.lines);
    state.score += points;

    return {
      points: points,
      kind: kind,
      b2b: b2b,
      chain: state.chain,
      leveledUp: state.level > levelBefore
    };
  }

  function addDropPoints(state, cells, isHard) {
    const points = cells * (isHard ? 2 : 1);
    state.score += points;
    return points;
  }

  root.Scoring = {
    SOFT_DROP_MS: SOFT_DROP_MS,
    MAX_GRAVITY_LEVEL: MAX_GRAVITY_LEVEL,
    CLEAR_POINTS: CLEAR_POINTS,
    PERFECT_CLEAR_POINTS: PERFECT_CLEAR_POINTS,
    create: create,
    kindFor: kindFor,
    levelForLines: levelForLines,
    gravityMs: gravityMs,
    isDifficult: isDifficult,
    applyLock: applyLock,
    addDropPoints: addDropPoints
  };
})(typeof window !== 'undefined' ? window : globalThis);
