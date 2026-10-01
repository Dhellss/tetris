(function (root) {
  'use strict';

  const MIN_CELL = 8;
  const PAD = 12;
  const GAP = 10;
  const PANEL_CELLS = 5;      // wide enough for a 4-cell piece plus margin
  const VISIBLE_ROWS = 20;
  const COLS = 10;

  const COLORS = {
    background: '#0e0f15',
    panel: '#15171f',
    grid: '#1e2130',
    border: '#2a2e42',
    garbage: '#555b70',
    ghost: 'rgba(215, 217, 224, 0.22)',
    text: '#d7d9e0'
  };

  function finiteOr(value, fallback) {
    const n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  // Derived entirely from the viewport so the board never outgrows the
  // screen, and never collapses to nothing on a tiny or unmeasured one.
  function layout(viewportWidth, viewportHeight) {
    const viewW = Math.max(0, finiteOr(viewportWidth, 0));
    const viewH = Math.max(0, finiteOr(viewportHeight, 0));

    const columnsNeeded = COLS + PANEL_CELLS * 2;
    const byHeight = Math.floor((viewH - PAD * 2) / VISIBLE_ROWS);
    const byWidth = Math.floor((viewW - PAD * 2 - GAP * 2) / columnsNeeded);
    const cell = Math.max(MIN_CELL, Math.min(byHeight, byWidth));

    const boardW = cell * COLS;
    const boardH = cell * VISIBLE_ROWS;
    const panelW = cell * PANEL_CELLS;
    const holdX = PAD;
    const boardX = holdX + panelW + GAP;
    const nextX = boardX + boardW + GAP;

    return {
      cell: cell,
      boardW: boardW,
      boardH: boardH,
      panelW: panelW,
      gap: GAP,
      pad: PAD,
      holdX: holdX,
      boardX: boardX,
      nextX: nextX,
      totalW: Math.max(1, nextX + panelW + PAD),
      totalH: Math.max(1, boardH + PAD * 2)
    };
  }

  // Effects are plain records aged by the frame delta. Keeping the ageing
  // separate from the drawing makes it testable without a canvas.
  function advanceEffects(effects, dtMs) {
    if (!effects || effects.length === 0) return [];
    const dt = Math.max(0, finiteOr(dtMs, 0));
    const alive = [];
    for (let i = 0; i < effects.length; i++) {
      const effect = effects[i];
      const aged = {};
      for (const key of Object.keys(effect)) aged[key] = effect[key];
      aged.ageMs = finiteOr(effect.ageMs, 0) + dt;
      if (aged.ageMs < finiteOr(effect.lifeMs, 0)) alive.push(aged);
    }
    return alive;
  }

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let current = layout(0, 0);
    let effects = [];

    const FLASH_MS = 180;
    const TRAIL_MS = 220;

    function resize() {
      const host = canvas.parentElement;
      const width = host ? host.clientWidth : 0;
      const height = host ? host.clientHeight : 0;
      current = layout(width, height);

      const dpr = Math.max(1, finiteOr(root.devicePixelRatio, 1));
      canvas.width = Math.max(1, Math.round(current.totalW * dpr));
      canvas.height = Math.max(1, Math.round(current.totalH * dpr));
      canvas.style.width = current.totalW + 'px';
      canvas.style.height = current.totalH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return current;
    }

    function colorFor(type) {
      return Pieces.COLORS[type] || COLORS.garbage;
    }

    // A single block with a lighter top-left bevel, which is what makes
    // the stack read as solid rather than flat.
    function block(x, y, size, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(x, y, size, Math.max(1, size * 0.14));
      ctx.fillRect(x, y, Math.max(1, size * 0.14), size);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(x, y + size - Math.max(1, size * 0.14), size, Math.max(1, size * 0.14));
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    }

    function drawWell(board) {
      const l = current;
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(l.boardX, l.pad, l.boardW, l.boardH);

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      for (let c = 1; c < COLS; c++) {
        const x = l.boardX + c * l.cell + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, l.pad);
        ctx.lineTo(x, l.pad + l.boardH);
        ctx.stroke();
      }
      for (let r = 1; r < VISIBLE_ROWS; r++) {
        const y = l.pad + r * l.cell + 0.5;
        ctx.beginPath();
        ctx.moveTo(l.boardX, y);
        ctx.lineTo(l.boardX + l.boardW, y);
        ctx.stroke();
      }

      const top = board.rows - board.visibleRows;
      for (let y = top; y < board.rows; y++) {
        for (let x = 0; x < board.cols; x++) {
          const type = board.grid[Board.index(board, x, y)];
          if (type === null) continue;
          block(l.boardX + x * l.cell, l.pad + (y - top) * l.cell, l.cell, colorFor(type));
        }
      }

      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(l.boardX - 1, l.pad - 1, l.boardW + 2, l.boardH + 2);
    }

    function drawPiece(piece, y, ghost) {
      const l = current;
      const top = Board.ROWS - Board.VISIBLE_ROWS;
      const cells = Pieces.cells(piece.type, piece.state);
      for (let i = 0; i < cells.length; i++) {
        const cx = piece.x + cells[i].x;
        const cy = (y === null || y === undefined ? piece.y : y) + cells[i].y;
        const row = cy - top;
        if (row < 0 || row >= VISIBLE_ROWS) continue;   // still in the buffer
        const px = l.boardX + cx * l.cell;
        const py = l.pad + row * l.cell;
        if (ghost) {
          ctx.fillStyle = COLORS.ghost;
          ctx.fillRect(px + 1, py + 1, l.cell - 2, l.cell - 2);
          ctx.strokeStyle = colorFor(piece.type);
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 1.5, py + 1.5, l.cell - 3, l.cell - 3);
        } else {
          block(px, py, l.cell, colorFor(piece.type));
        }
      }
    }

    // Draws a piece centred inside one of the side panels.
    function drawPreview(type, x, y, size) {
      const cells = Pieces.cells(type, '0');
      let minX = 99, maxX = -99, minY = 99, maxY = -99;
      for (let i = 0; i < cells.length; i++) {
        minX = Math.min(minX, cells[i].x);
        maxX = Math.max(maxX, cells[i].x);
        minY = Math.min(minY, cells[i].y);
        maxY = Math.max(maxY, cells[i].y);
      }
      const w = (maxX - minX + 1) * size;
      const h = (maxY - minY + 1) * size;
      const ox = x - w / 2;
      const oy = y - h / 2;
      for (let i = 0; i < cells.length; i++) {
        block(ox + (cells[i].x - minX) * size, oy + (cells[i].y - minY) * size, size, colorFor(type));
      }
    }

    function panelLabel(text, x, y) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(text, x, y);
    }

    function drawHold(game) {
      const l = current;
      panelLabel('HOLD', l.holdX, l.pad + 12);
      const boxY = l.pad + 20;
      const boxH = l.cell * 3;
      ctx.fillStyle = COLORS.panel;
      ctx.fillRect(l.holdX, boxY, l.panelW, boxH);
      if (game.hold) {
        const size = Math.max(4, Math.floor(l.cell * 0.72));
        ctx.globalAlpha = game.canHold ? 1 : 0.4;
        drawPreview(game.hold, l.holdX + l.panelW / 2, boxY + boxH / 2, size);
        ctx.globalAlpha = 1;
      }
    }

    function drawNext(game) {
      const l = current;
      panelLabel('NEXT', l.nextX, l.pad + 12);
      const size = Math.max(4, Math.floor(l.cell * 0.66));
      const slotH = l.cell * 2.6;
      for (let i = 0; i < game.queue.length; i++) {
        const boxY = l.pad + 20 + i * slotH;
        ctx.fillStyle = COLORS.panel;
        ctx.fillRect(l.nextX, boxY, l.panelW, slotH - 6);
        drawPreview(game.queue[i], l.nextX + l.panelW / 2, boxY + (slotH - 6) / 2, size);
      }
    }

    function addFlash(rows) {
      if (!rows || rows.length === 0) return;
      effects.push({ kind: 'flash', rows: rows.slice(), ageMs: 0, lifeMs: FLASH_MS });
    }

    function addTrail(piece, fromY, toY) {
      if (toY <= fromY) return;
      effects.push({
        kind: 'trail',
        type: piece.type,
        state: piece.state,
        x: piece.x,
        fromY: fromY,
        toY: toY,
        ageMs: 0,
        lifeMs: TRAIL_MS
      });
    }

    function drawEffects() {
      const l = current;
      const top = Board.ROWS - Board.VISIBLE_ROWS;

      for (let i = 0; i < effects.length; i++) {
        const effect = effects[i];
        const progress = Math.min(1, effect.ageMs / effect.lifeMs);

        if (effect.kind === 'flash') {
          ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.55 * (1 - progress)).toFixed(3) + ')';
          for (let r = 0; r < effect.rows.length; r++) {
            const row = effect.rows[r] - top;
            if (row < 0 || row >= VISIBLE_ROWS) continue;
            ctx.fillRect(l.boardX, l.pad + row * l.cell, l.boardW, l.cell);
          }
        } else if (effect.kind === 'trail') {
          const cells = Pieces.cells(effect.type, effect.state);
          ctx.fillStyle = colorFor(effect.type);
          ctx.globalAlpha = 0.3 * (1 - progress);
          for (let c = 0; c < cells.length; c++) {
            const cx = effect.x + cells[c].x;
            for (let y = effect.fromY; y < effect.toY; y++) {
              const row = y + cells[c].y - top;
              if (row < 0 || row >= VISIBLE_ROWS) continue;
              ctx.fillRect(l.boardX + cx * l.cell + 2, l.pad + row * l.cell, l.cell - 4, l.cell);
            }
          }
          ctx.globalAlpha = 1;
        }
      }
    }

    function draw(state) {
      const game = state.game;
      const l = current;

      effects = advanceEffects(effects, state.dtMs);

      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, l.totalW, l.totalH);

      drawWell(game.board);
      drawEffects();
      if (game.piece) {
        const ghost = Game.ghostY(game);
        if (ghost !== null && ghost !== game.piece.y) drawPiece(game.piece, ghost, true);
        drawPiece(game.piece, game.piece.y, false);
      }
      drawHold(game);
      drawNext(game);
    }

    resize();

    return {
      resize: resize,
      draw: draw,
      addFlash: addFlash,
      addTrail: addTrail,
      get layout() { return current; }
    };
  }

  root.Renderer = {
    MIN_CELL: MIN_CELL,
    PAD: PAD,
    GAP: GAP,
    PANEL_CELLS: PANEL_CELLS,
    COLORS: COLORS,
    layout: layout,
    advanceEffects: advanceEffects,
    create: create
  };
})(typeof window !== 'undefined' ? window : globalThis);
