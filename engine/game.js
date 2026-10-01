(function (root) {
  'use strict';

  const MAX_TICK_MS = 100;

  const DEFAULTS = {
    mode: 'marathon',
    seed: 0,
    lockDelayMs: 500,
    maxResets: 15,
    queueSize: 5,
    sprintLines: 40,
    softDropMs: 50      // 20 cells per second; the settings screen can lower this
  };

  function occupancy(board) {
    return function (x, y) { return Board.isOccupied(board, x, y); };
  }

  function copyPiece(piece) {
    return { type: piece.type, state: piece.state, x: piece.x, y: piece.y };
  }

  // A dealer that hands out a scripted list first, then falls back to the
  // seeded bag. Lessons and tests need a known opening; play does not.
  function createDealer(seed, scripted) {
    const bag = Randomizer.create(seed);
    const pending = scripted ? scripted.slice() : [];
    return function () {
      return pending.length > 0 ? pending.shift() : bag.next();
    };
  }

  function refillQueue(g) {
    while (g.queue.length < g.opts.queueSize) g.queue.push(g.deal());
  }

  function spawn(g, type, events) {
    const piece = Pieces.spawn(type);
    g.piece = piece;
    g.gravityMs = 0;
    g.lockMs = 0;
    g.resets = 0;
    g.grounded = false;
    g.rotatedLast = false;
    g.lastKickIndex = 0;
    refillQueue(g);

    if (Board.collides(g.board, piece)) {
      g.status = 'over';
      events.push({ type: 'gameover', reason: 'blockout' });
      return false;
    }
    events.push({ type: 'spawn', piece: copyPiece(piece) });
    return true;
  }

  function create(options) {
    const opts = {};
    for (const key of Object.keys(DEFAULTS)) opts[key] = DEFAULTS[key];
    if (options) {
      for (const key of Object.keys(options)) opts[key] = options[key];
    }

    const g = {
      opts: opts,
      mode: opts.mode,
      board: opts.board || Board.create(),
      deal: createDealer(opts.seed, opts.pieces),
      queue: [],
      piece: null,
      hold: null,
      canHold: true,
      scoring: Scoring.create(),
      status: 'playing',
      gravityMs: 0,
      lockMs: 0,
      resets: 0,
      grounded: false,
      lastKickIndex: 0,
      rotatedLast: false,
      timeMs: 0,
      piecesPlaced: 0
    };

    refillQueue(g);
    spawn(g, g.queue.shift(), []);
    return g;
  }

  function isGrounded(g) {
    if (!g.piece) return false;
    return Board.collides(g.board, {
      type: g.piece.type,
      state: g.piece.state,
      x: g.piece.x,
      y: g.piece.y + 1
    });
  }

  function ghostY(g) {
    if (!g.piece) return null;
    let y = g.piece.y;
    while (!Board.collides(g.board, {
      type: g.piece.type, state: g.piece.state, x: g.piece.x, y: y + 1
    })) y++;
    return y;
  }

  function tryMove(g, dx, dy) {
    const moved = {
      type: g.piece.type, state: g.piece.state,
      x: g.piece.x + dx, y: g.piece.y + dy
    };
    if (Board.collides(g.board, moved)) return false;
    g.piece = moved;
    return true;
  }

  // Called after any successful move or rotation. Spends one unit of the
  // reset budget while grounded; airborne, the timer is simply irrelevant.
  function noteAction(g, wasRotation) {
    g.rotatedLast = wasRotation;
    if (isGrounded(g)) {
      if (g.resets < g.opts.maxResets) {
        g.resets += 1;
        g.lockMs = 0;
      }
    } else {
      g.lockMs = 0;
    }
  }

  function doHold(g, events) {
    if (!g.canHold || !g.piece) return;
    const held = g.piece.type;
    const incoming = g.hold === null ? g.queue.shift() : g.hold;
    g.hold = held;
    events.push({ type: 'hold', held: held, incoming: incoming });
    spawn(g, incoming, events);
    g.canHold = false;
  }

  function lockPiece(g, events) {
    const spin = g.rotatedLast
      ? SRS.classifySpin(g.piece, g.lastKickIndex, occupancy(g.board))
      : 'none';

    const cells = Pieces.cells(g.piece.type, g.piece.state);
    const visibleTop = g.board.rows - g.board.visibleRows;
    let lockedOut = true;
    for (let i = 0; i < cells.length; i++) {
      if (g.piece.y + cells[i].y >= visibleTop) { lockedOut = false; break; }
    }

    const placed = copyPiece(g.piece);
    Board.lock(g.board, g.piece);
    g.piecesPlaced += 1;

    const cleared = Board.clearLines(g.board);
    const perfectClear = cleared.count > 0 && Board.isEmpty(g.board);
    const result = Scoring.applyLock(g.scoring, {
      lines: cleared.count,
      spin: spin,
      perfectClear: perfectClear
    });

    events.push({
      type: 'lock',
      piece: placed,
      spin: spin,
      lines: cleared.count,
      rows: cleared.rows,
      perfectClear: perfectClear,
      points: result.points,
      b2b: result.b2b,
      chain: result.chain,
      kind: result.kind
    });
    if (result.leveledUp) events.push({ type: 'levelup', level: g.scoring.level });

    g.piece = null;
    g.canHold = true;

    if (lockedOut) {
      g.status = 'over';
      events.push({ type: 'gameover', reason: 'lockout' });
      return;
    }
    if (g.mode === 'sprint' && g.scoring.lines >= g.opts.sprintLines) {
      g.status = 'won';
      events.push({ type: 'win', timeMs: g.timeMs, lines: g.scoring.lines });
      return;
    }
    spawn(g, g.queue.shift(), events);
  }

  function tick(g, dtMs, actions) {
    const events = [];
    if (g.status !== 'playing') return events;

    // A backgrounded tab can hand over tens of seconds at once. Without
    // this clamp the piece teleports through the stack.
    const dt = Math.max(0, Math.min(dtMs || 0, MAX_TICK_MS));
    g.timeMs += dt;

    const a = actions || {};

    if (a.hold) doHold(g, events);
    if (g.status !== 'playing' || !g.piece) return events;

    let dir = 0;
    if (a.rotateCW) dir = 1;
    else if (a.rotateCCW) dir = -1;
    else if (a.rotate180) dir = 2;
    if (dir !== 0) {
      const spun = SRS.rotate(g.piece, dir, occupancy(g.board));
      if (spun) {
        g.piece = spun.piece;
        g.lastKickIndex = spun.kickIndex;
        noteAction(g, true);
        events.push({ type: 'rotate', kickIndex: spun.kickIndex, state: g.piece.state });
      }
    }

    // One cell per pulse by default. Input passes a larger moveCells when
    // ARR is 0, which is what makes a held key slide to the wall in one
    // frame the way modern clients do.
    let dx = 0;
    if (a.left) dx -= 1;
    if (a.right) dx += 1;
    if (dx !== 0) {
      const steps = Math.max(1, a.moveCells || 1);
      let moved = 0;
      while (moved < steps && tryMove(g, dx, 0)) moved += 1;
      if (moved > 0) {
        noteAction(g, false);
        events.push({ type: 'move', dx: dx * moved });
      }
    }

    if (a.hardDrop) {
      const target = ghostY(g);
      const distance = target - g.piece.y;
      if (distance > 0) {
        g.piece = { type: g.piece.type, state: g.piece.state, x: g.piece.x, y: target };
        Scoring.addDropPoints(g.scoring, distance, true);
        g.rotatedLast = false;
      }
      events.push({ type: 'harddrop', cells: distance });
      lockPiece(g, events);
      return events;
    }

    const level = g.mode === 'sprint' ? 1 : g.scoring.level;
    let intervalMs = Scoring.gravityMs(level);
    if (a.softDrop) intervalMs = Math.min(intervalMs, g.opts.softDropMs);

    g.gravityMs += dt;
    let fell = 0;
    while (g.gravityMs >= intervalMs) {
      g.gravityMs -= intervalMs;
      if (tryMove(g, 0, 1)) {
        fell += 1;
      } else {
        g.gravityMs = 0;
        break;
      }
    }
    if (fell > 0) {
      g.rotatedLast = false;
      g.lockMs = 0;
      if (a.softDrop) Scoring.addDropPoints(g.scoring, fell, false);
      events.push({ type: 'fall', cells: fell });
    }

    g.grounded = isGrounded(g);
    if (g.grounded) {
      g.lockMs += dt;
      if (g.lockMs >= g.opts.lockDelayMs) lockPiece(g, events);
    } else {
      g.lockMs = 0;
    }

    return events;
  }

  root.Game = {
    MAX_TICK_MS: MAX_TICK_MS,
    DEFAULTS: DEFAULTS,
    create: create,
    tick: tick,
    ghostY: ghostY,
    isGrounded: isGrounded
  };
})(typeof window !== 'undefined' ? window : globalThis);
