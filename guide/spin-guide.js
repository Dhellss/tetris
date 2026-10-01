(function (root) {
  'use strict';

  const TICK_MS = 50;
  const SPEEDS = [0.25, 0.5, 1];
  const MAX_ITERATIONS = 300;

  // Each lesson is a board, a scripted piece order, and an ordered list of
  // steps. A step with dtMs 0 applies its actions without letting any time
  // pass, which keeps gravity out of the way of what is being taught.
  const LESSONS = [
    {
      id: 'basic-rotation',
      title: 'Rotation states',
      blurb: 'Every piece has four states. Rotating does not move the piece around a corner — it spins it about a fixed centre.',
      rows: [],
      pieces: ['T'],
      steps: [
        { caption: 'A T spawns flat-side-down. This is state 0.', actions: {} },
        { caption: 'One rotation clockwise: state R. The centre cell has not moved.', actions: { rotateCW: true } },
        { caption: 'Again: state 2, upside down.', actions: { rotateCW: true } },
        { caption: 'Again: state L.', actions: { rotateCW: true } },
        { caption: 'Four rotations return the piece to state 0.', actions: { rotateCW: true } }
      ]
    },
    {
      id: 'wall-kick',
      title: 'Wall kick',
      blurb: 'When a rotation would push a piece into the wall, SRS tries up to five positions in a fixed order and takes the first that fits. That nudge is the kick.',
      rows: [],
      pieces: ['I'],
      steps: [
        { caption: 'Stand an I on end.', actions: { rotateCW: true } },
        { caption: 'Slide it against the left wall.', actions: { left: true }, repeat: 5 },
        {
          caption: 'Rotating flat would put two cells through the wall. The first offset fails, so SRS tries the second — two columns right — and the I snaps clear.',
          actions: { rotateCCW: true }
        }
      ],
      expect: { kickIndex: 1 }
    },
    {
      id: 'floor-kick',
      title: 'Floor kick',
      blurb: 'The same five offsets work vertically. A piece lying on the floor can still stand up, because one of the later offsets lifts it.',
      rows: [],
      pieces: ['I'],
      steps: [
        { caption: 'Let a flat I settle on the floor.', until: 'grounded' },
        {
          caption: 'Standing it up needs four rows, and only one is free. Offsets one through four all fail; the fifth lifts the I two rows and it stands.',
          actions: { rotateCW: true }
        }
      ],
      expect: { kickIndex: 4 }
    },
    {
      id: 'tspin-single',
      title: 'T-Spin Single',
      blurb: 'A T-spin needs a slot the T cannot fall into — it has to be rotated in. Three of the four corners around the T must be filled, and the rotation must be the last thing that moved it.',
      rows: [
        '.....X....',
        'XXX...XXXX',
        'XXXX.XXXX.'
      ],
      pieces: ['T'],
      steps: [
        { caption: 'The overhang on the top row seals the slot. Nothing can drop straight in.', actions: {} },
        { caption: 'Turn the T so its nub points left.', actions: { rotateCCW: true } },
        { caption: 'Drop it beside the slot.', until: 'grounded' },
        { caption: 'One more rotation and the T turns into the slot. Three corners are filled, so this counts as a spin.', actions: { rotateCCW: true } },
        { caption: 'The middle row completes: a T-Spin Single.', until: 'locked' }
      ],
      expect: { spin: 'tspin', lines: 1, kind: 'tspin-single' }
    },
    {
      id: 'tspin-double',
      title: 'T-Spin Double',
      blurb: 'The same shape, one row deeper. The T fills the gap in two rows at once, which is the bread-and-butter T-spin.',
      rows: [
        '.....X....',
        'XXX...XXXX',
        'XXXX.XXXXX'
      ],
      pieces: ['T'],
      steps: [
        { caption: 'Two rows need filling, and the only hole in the bottom row is one cell wide.', actions: {} },
        { caption: 'Point the nub left.', actions: { rotateCCW: true } },
        { caption: 'Drop in beside the slot.', until: 'grounded' },
        { caption: 'Rotate. The bar fills the middle row and the nub drops into the bottom one.', actions: { rotateCCW: true } },
        { caption: 'Two rows clear: a T-Spin Double.', until: 'locked' }
      ],
      expect: { spin: 'tspin', lines: 2, kind: 'tspin-double' }
    },
    {
      id: 'tspin-triple',
      title: 'T-Spin Triple',
      blurb: 'The deep one. Only the fifth kick offset reaches this slot, which is why a T-spin Triple is impossible without wall kicks.',
      rows: [
        '....X.....',
        '..........',
        'XXXX.XXXXX',
        'XXXX..XXXX',
        'XXXX.XXXXX'
      ],
      pieces: ['T'],
      steps: [
        { caption: 'A three-row notch with an overhang halfway down. No rotation from directly above can reach it.', actions: {} },
        { caption: 'Walk the T right, clear of the block above the notch.', actions: { right: true }, repeat: 2 },
        { caption: 'Let it settle on the overhang.', until: 'grounded' },
        { caption: 'Step back left, so the T sits directly over the notch.', actions: { left: true } },
        {
          caption: 'Rotate clockwise. The first four offsets are all blocked; the fifth drops the T a column left and two rows down, straight into the notch.',
          actions: { rotateCW: true }
        },
        { caption: 'All three rows complete: a T-Spin Triple.', until: 'locked' }
      ],
      expect: { kickIndex: 4, spin: 'tspin', lines: 3, kind: 'tspin-triple' }
    },
    {
      id: 'kick-table',
      title: 'The kick tables',
      blurb: 'Every kick you have just watched comes from one short list. Here is that list, drawn out: the five places the game tries a piece, in order, for any turn you pick.',
      reference: true,
      rows: [],
      pieces: [],
      steps: [
        { caption: 'The dashed outline is where the turn would have landed with no kick at all — so the gap between it and the solid piece IS the kick. Change the piece or the turn to see a different set of five.' }
      ]
    }
  ];

  function lessonById(id) {
    for (let i = 0; i < LESSONS.length; i++) {
      if (LESSONS[i].id === id) return LESSONS[i];
    }
    return null;
  }

  // How far the kick moved the piece away from where the rotation would
  // nominally have landed. null when the first offset fit, since then
  // there is no kick to point at.
  function kickDisplacement(rotation) {
    if (!rotation || rotation.kickIndex === 0) return null;
    return {
      dx: rotation.to.x - rotation.from.x,
      dy: rotation.to.y - rotation.from.y
    };
  }

  function collect(into, batch) {
    for (let i = 0; i < batch.length; i++) into.push(batch[i]);
  }

  function runStep(game, step, events) {
    if (step.until === 'grounded') {
      for (let i = 0; i < MAX_ITERATIONS && game.piece && !Game.isGrounded(game); i++) {
        collect(events, Game.tick(game, TICK_MS, { softDrop: true }));
      }
      return;
    }
    if (step.until === 'locked') {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const batch = Game.tick(game, TICK_MS, {});
        collect(events, batch);
        let locked = false;
        for (let e = 0; e < batch.length; e++) {
          if (batch[e].type === 'lock') locked = true;
        }
        if (locked) return;
      }
      return;
    }

    const repeat = step.repeat || 1;
    const dt = step.dtMs || 0;
    for (let i = 0; i < repeat; i++) {
      collect(events, Game.tick(game, dt, step.actions || {}));
    }
  }

  // Replays the lesson from scratch every time. Stepping backwards in the
  // player is then just "run to step n - 1", which keeps the player free of
  // its own copy of game state.
  function runLesson(lesson, upToStep) {
    if (!lesson || lesson.reference) return null;

    const limit = (upToStep === undefined || upToStep === null)
      ? lesson.steps.length
      : Math.max(0, Math.min(upToStep, lesson.steps.length));

    const game = Game.create({
      board: lesson.rows.length ? Board.fromRows(lesson.rows) : Board.create(),
      pieces: lesson.pieces,
      seed: 1,
      lockDelayMs: 500
    });

    const events = [];
    const rotations = [];
    let stepsRun = 0;

    for (let i = 0; i < limit; i++) {
      const before = game.piece
        ? { type: game.piece.type, state: game.piece.state, x: game.piece.x, y: game.piece.y }
        : null;
      const stepEvents = [];
      runStep(game, lesson.steps[i], stepEvents);

      for (let e = 0; e < stepEvents.length; e++) {
        if (stepEvents[e].type === 'rotate' && before) {
          // A step could in principle rotate and then lock, leaving no
          // active piece to read the landing position from.
          const landed = game.piece || before;
          rotations.push({
            step: i,
            from: before,
            to: { type: landed.type, state: stepEvents[e].state, x: landed.x, y: landed.y },
            kickIndex: stepEvents[e].kickIndex
          });
        }
      }

      collect(events, stepEvents);
      stepsRun += 1;
    }

    return { game: game, events: events, rotations: rotations, stepsRun: stepsRun };
  }

  // The player: a thin shell over runLesson. All the state it keeps is
  // "which lesson, which step"; the board for that step is recomputed by
  // replaying, so stepping backwards is exact.
  function create(elements) {
    const overlay = elements.overlay;
    const renderer = Renderer.create(elements.canvas);

    let lesson = LESSONS[0];
    let step = 0;
    let state = null;
    let playing = false;
    let speed = 1;
    let waitMs = 0;
    let rafId = null;
    let lastMs = 0;

    // Plain words for a table offset, which is written x then y with y
    // counted upward.
    function offsetWords(offset) {
      const parts = [];
      if (offset[0] !== 0) {
        parts.push(Math.abs(offset[0]) + (offset[0] > 0 ? ' right' : ' left'));
      }
      if (offset[1] !== 0) {
        parts.push(Math.abs(offset[1]) + (offset[1] > 0 ? ' up' : ' down'));
      }
      return parts.length === 0 ? 'stay put' : parts.join(', ');
    }

    const ORDINALS = ['1st try', '2nd try', '3rd try', '4th try', '5th try'];
    const GRID = 8;      // room for the widest box plus a two-cell offset
    const ORIGIN = 2;    // where the un-kicked box sits in that grid

    // One little board showing where the piece would sit for this offset,
    // with the un-kicked position dashed behind it.
    function buildTry(type, toState, offset, index) {
      const cells = Pieces.cells(type, toState);
      const nominal = {};
      const shifted = {};
      for (let i = 0; i < cells.length; i++) {
        nominal[(ORIGIN + cells[i].x) + ',' + (ORIGIN + cells[i].y)] = true;
        shifted[(ORIGIN + offset[0] + cells[i].x) + ',' + (ORIGIN - offset[1] + cells[i].y)] = true;
      }

      const box = document.createElement('div');
      box.className = 'kick-try';

      const head = document.createElement('h4');
      head.textContent = ORDINALS[index];
      box.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'kick-grid';
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const cell = document.createElement('span');
          const key = x + ',' + y;
          cell.className = 'kick-cell'
            + (nominal[key] ? ' nominal' : '')
            + (shifted[key] ? ' filled' : '');
          if (shifted[key]) cell.style.background = Pieces.COLORS[type];
          grid.appendChild(cell);
        }
      }
      box.appendChild(grid);

      const words = document.createElement('p');
      words.className = 'kick-words';
      words.textContent = offsetWords(offset);
      box.appendChild(words);

      return box;
    }

    function renderReference() {
      const host = elements.reference;
      host.textContent = '';

      const intro = document.createElement('p');
      intro.className = 'kick-intro';
      intro.textContent = 'When a rotation does not fit, the game does not refuse it. '
        + 'It tries the piece in five places, in a fixed order, and keeps the first one that fits. '
        + 'That nudge is the kick. Pick a piece and a turn to see the five it would work through.';
      host.appendChild(intro);

      const pickers = document.createElement('div');
      pickers.className = 'kick-pickers';

      const pieceSel = document.createElement('select');
      for (const type of ['T', 'J', 'L', 'S', 'Z', 'I']) {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type + ' piece';
        pieceSel.appendChild(option);
      }

      const turnSel = document.createElement('select');
      const TURNS = [
        ['0>R', '0 → R  (clockwise)'],
        ['R>2', 'R → 2  (clockwise)'],
        ['2>L', '2 → L  (clockwise)'],
        ['L>0', 'L → 0  (clockwise)'],
        ['0>L', '0 → L  (anticlockwise)'],
        ['L>2', 'L → 2  (anticlockwise)'],
        ['2>R', '2 → R  (anticlockwise)'],
        ['R>0', 'R → 0  (anticlockwise)'],
        ['0>2', '0 → 2  (half turn)'],
        ['R>L', 'R → L  (half turn)'],
        ['2>0', '2 → 0  (half turn)'],
        ['L>R', 'L → R  (half turn)']
      ];
      for (const turn of TURNS) {
        const option = document.createElement('option');
        option.value = turn[0];
        option.textContent = turn[1];
        turnSel.appendChild(option);
      }

      pickers.appendChild(pieceSel);
      pickers.appendChild(turnSel);
      host.appendChild(pickers);

      const strip = document.createElement('div');
      strip.className = 'kick-strip';
      host.appendChild(strip);

      const note = document.createElement('p');
      note.className = 'kick-note';
      host.appendChild(note);

      function draw() {
        const type = pieceSel.value;
        const key = turnSel.value;
        const offsets = SRS.table(type, key.charAt(0), key.charAt(2));
        strip.textContent = '';
        for (let i = 0; i < offsets.length; i++) {
          strip.appendChild(buildTry(type, key.charAt(2), offsets[i], i));
        }
        note.textContent = type === 'I'
          ? 'The I piece has its own table — it is four cells long, so it needs to move further to get clear.'
          : 'J, L, S, T and Z all share this table. The O piece is missing here because it never kicks: its four states occupy the same cells.';
      }

      pieceSel.addEventListener('change', draw);
      turnSel.addEventListener('change', draw);
      draw();
    }

    function rebuild() {
      state = runLesson(lesson, step);
      elements.title.textContent = lesson.title;
      elements.caption.textContent = lesson.reference
        ? lesson.steps[0].caption
        : (step === 0 ? lesson.blurb : lesson.steps[step - 1].caption);
      elements.progress.textContent = lesson.reference
        ? ''
        : step + ' / ' + lesson.steps.length;
      elements.reference.hidden = !lesson.reference;
      elements.canvas.hidden = lesson.reference === true;
      if (lesson.reference) renderReference();
    }

    function renderList() {
      elements.list.textContent = '';
      for (const entry of LESSONS) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = entry.title;
        button.className = entry.id === lesson.id ? 'active' : '';
        button.addEventListener('click', function () { select(entry.id); });
        elements.list.appendChild(button);
      }
    }

    function select(id) {
      const found = lessonById(id);
      if (!found) return;
      lesson = found;
      step = 0;
      playing = false;
      waitMs = 0;
      renderList();
      rebuild();
    }

    function stepForward() {
      if (lesson.reference || step >= lesson.steps.length) {
        playing = false;
        return;
      }
      step += 1;
      rebuild();
    }

    function stepBack() {
      if (lesson.reference || step === 0) return;
      step -= 1;
      playing = false;
      rebuild();
    }

    function replay() {
      step = 0;
      waitMs = 0;
      rebuild();
      playing = !lesson.reference;
    }

    // The centre of a piece's four cells, in canvas pixels.
    function centreOf(piece, l) {
      const cells = Pieces.cells(piece.type, piece.state);
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < cells.length; i++) {
        sx += piece.x + cells[i].x + 0.5;
        sy += piece.y + cells[i].y + 0.5;
      }
      const top = Board.ROWS - Board.VISIBLE_ROWS;
      return {
        x: l.boardX + (sx / cells.length) * l.cell,
        y: l.pad + (sy / cells.length - top) * l.cell
      };
    }

    function outlineCells(ctx, piece, l) {
      const cells = Pieces.cells(piece.type, piece.state);
      const top = Board.ROWS - Board.VISIBLE_ROWS;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(255, 217, 138, 0.75)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < cells.length; i++) {
        const row = piece.y + cells[i].y - top;
        if (row < 0 || row >= Board.VISIBLE_ROWS) continue;
        ctx.strokeRect(
          l.boardX + (piece.x + cells[i].x) * l.cell + 1,
          l.pad + row * l.cell + 1,
          l.cell - 2,
          l.cell - 2
        );
      }
      ctx.setLineDash([]);
    }

    // Shows where the rotation would have landed had the first offset fit,
    // and an arrow to where the kick actually put the piece. This is the
    // whole point of the guide: the motion, not just the caption.
    function drawKick() {
      elements.kick.hidden = true;
      if (!state || state.rotations.length === 0) return;
      const last = state.rotations[state.rotations.length - 1];
      if (last.step !== step - 1) return;
      const shift = kickDisplacement(last);
      if (!shift) return;

      elements.kick.textContent =
        'kick offset ' + (last.kickIndex + 1) + ' of 5  ·  ' +
        (shift.dx === 0 ? '' : (shift.dx > 0 ? shift.dx + ' right' : (-shift.dx) + ' left')) +
        (shift.dx !== 0 && shift.dy !== 0 ? ', ' : '') +
        (shift.dy === 0 ? '' : (shift.dy > 0 ? shift.dy + ' down' : (-shift.dy) + ' up'));
      elements.kick.hidden = false;

      const l = renderer.layout;
      const ctx = elements.canvas.getContext('2d');
      const nominal = {
        type: last.to.type, state: last.to.state, x: last.from.x, y: last.from.y
      };
      outlineCells(ctx, nominal, l);

      const a = centreOf(nominal, l);
      const b = centreOf(last.to, l);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 1) return;

      // Stop the arrow short of the piece centre so the head is visible
      // against the block rather than buried in it.
      const ux = dx / length;
      const uy = dy / length;
      const tipX = b.x - ux * l.cell * 0.35;
      const tipY = b.y - uy * l.cell * 0.35;

      ctx.strokeStyle = '#ffd98a';
      ctx.fillStyle = '#ffd98a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      const head = Math.max(5, l.cell * 0.32);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - ux * head - uy * head * 0.5, tipY - uy * head + ux * head * 0.5);
      ctx.lineTo(tipX - ux * head + uy * head * 0.5, tipY - uy * head - ux * head * 0.5);
      ctx.closePath();
      ctx.fill();
    }

    function frame(nowMs) {
      const dt = lastMs === 0 ? 0 : nowMs - lastMs;
      lastMs = nowMs;

      if (playing) {
        waitMs += dt;
        if (waitMs >= 1400 / speed) {
          waitMs = 0;
          stepForward();
        }
      }

      if (state && !lesson.reference) {
        renderer.draw({ game: state.game, paused: true, dtMs: dt, panels: false });
        drawKick();
      }
      rafId = root.requestAnimationFrame(frame);
    }

    function open() {
      overlay.hidden = false;
      renderer.resize();
      select(lesson.id);
      lastMs = 0;
      if (rafId === null) rafId = root.requestAnimationFrame(frame);
    }

    function close() {
      overlay.hidden = true;
      playing = false;
      if (rafId !== null) {
        root.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    elements.play.addEventListener('click', function () { playing = !playing; waitMs = 0; });
    elements.next.addEventListener('click', function () { playing = false; stepForward(); });
    elements.prev.addEventListener('click', stepBack);
    elements.replayButton.addEventListener('click', replay);
    elements.close.addEventListener('click', close);
    elements.speed.addEventListener('change', function (event) {
      speed = Number(event.target.value) || 1;
    });

    return {
      open: open,
      close: close,
      select: select,
      play: function () { playing = true; },
      pause: function () { playing = false; },
      stepForward: stepForward,
      stepBack: stepBack,
      replay: replay,
      setSpeed: function (value) { speed = Number(value) || 1; },
      currentStep: function () { return step; },
      currentLessonId: function () { return lesson.id; }
    };
  }

  root.SpinGuide = {
    TICK_MS: TICK_MS,
    SPEEDS: SPEEDS,
    LESSONS: LESSONS,
    lessonById: lessonById,
    runLesson: runLesson,
    kickDisplacement: kickDisplacement,
    create: create
  };
})(typeof window !== 'undefined' ? window : globalThis);
