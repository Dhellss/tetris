# Tetris (tetr.io-style) — Design Spec

Date: 2026-10-01
Status: Approved for planning

## 1. Purpose and scope

A personal, modern Tetris game that runs by opening `index.html` in a
browser, plus a watchable animated guide that explains how spins work
(SRS wall kicks, floor kicks, T-spins).

**In scope**

- Single-player Tetris with guideline-compliant mechanics ("tetr.io feel")
- Two modes: Marathon and Sprint 40L
- Desktop keyboard controls, rebindable, with adjustable DAS/ARR
- An animated, non-interactive Spin Guide driven by the real game engine
- Local persistence of settings and personal bests

**Out of scope**

- Any server, networking, matchmaking, or online versus
- Local or online multiplayer
- Touch and gamepad input
- Interactive tutorial drills that grade the player's input
- Accounts, leaderboards, replays

**Success criteria**

1. The game feels like a modern Tetris client: pieces kick where an
   experienced player expects, holds and the next queue behave normally,
   and input latency is not noticeable.
2. T-spins are detected and scored correctly, including mini T-spins.
3. The Spin Guide can be watched start to finish and explains each kick
   with motion the player can follow, with no reading of code required.
4. Opening `index.html` from the filesystem is enough to play. No build
   step, no package install, no local server.
5. The engine's rules are verified by tests that run in the browser.

## 2. Constraints

- Vanilla HTML, CSS, and JavaScript. No framework, no bundler, no npm
  install needed to play or to run the tests.
- Plain `<script>` tags in dependency order, matching the convention
  already used in `Games/ProjectBato`.
- Must work from a `file://` URL, which rules out ES modules and `fetch`
  of local JSON. All data is declared in JavaScript.
- Target 60fps on a modest laptop.

## 3. Architecture

One hard boundary: **`engine/` never touches the canvas, the DOM, or
input events.** It is given a board state and a set of actions for the
current frame, and it returns a new state plus a list of events. Two
things follow from that:

- The engine can be tested headlessly and deterministically.
- The Spin Guide can animate lessons through the same engine the game
  uses, so the guide cannot teach a rule the game does not implement.

```
Tetris/
  index.html              shell: canvas, HUD, overlay screens
  styles.css              dark theme and layout
  main.js                 bootstrap, requestAnimationFrame loop, wiring
  engine/
    pieces.js             tetromino shapes, 4 rotation states each
    srs.js                kick tables, rotate(), spin classification
    randomizer.js         7-bag generator
    board.js              grid, collision, lock, line clear
    scoring.js            points, level, combo, back-to-back, perfect clear
    game.js               state machine and tick(dt, actions)
  ui/
    renderer.js           canvas drawing, ghost, effects
    hud.js                DOM score/level/lines/timer and text popups
    input.js              key handling, DAS/ARR, rebinding, persistence
    screens.js            menu, settings, pause, game over overlays
  guide/
    spin-guide.js         lesson data and animation player
  tests/
    test.html             browser test runner
    engine.test.js        engine assertions
  docs/superpowers/specs/  this spec and future ones
```

### Unit responsibilities

| Unit | Does | Depends on |
|---|---|---|
| `pieces.js` | Declares each tetromino's cells per rotation state and its spawn position. Pure data plus lookup helpers. | nothing |
| `srs.js` | Given a piece, a current state, and a direction, returns the resulting state and offset by walking the kick table against a collision test. Also classifies a lock as none / mini T-spin / T-spin. | `pieces.js`, a collision callback |
| `randomizer.js` | 7-bag sequence from a seeded PRNG, so tests and guide lessons are reproducible. | nothing |
| `board.js` | Fixed 10x40 grid (20 visible rows plus buffer). Collision test, piece lock, full-row detection and removal, perfect-clear test. | nothing |
| `scoring.js` | Turns clear events into points, tracks level, combo, back-to-back. No timing. | nothing |
| `game.js` | Owns the piece lifecycle: spawn, gravity, lock delay and its reset budget, hold, hard drop, line clear, top-out. Exposes `tick(dtMs, actions)` returning state and events. | all of `engine/` |
| `renderer.js` | Draws a given state to a canvas. Stateless except for effect animations. | `game.js` state shape |
| `input.js` | Converts key events into a per-frame action set, applying DAS and ARR. Stores bindings and handling values in `localStorage`. | nothing |
| `hud.js`, `screens.js` | DOM reflection of state and events. | state and event shapes |
| `spin-guide.js` | Lesson data and a player that feeds scripted actions into a `game.js` instance at reduced speed, with captions and kick arrows. | `game.js`, `renderer.js` |

### Data flow per frame

```
key events ──▶ input.js ──actions──▶ game.tick(dt, actions) ──▶ state + events
                                                                  │
                                              ┌───────────────────┴──────────┐
                                              ▼                              ▼
                                      renderer.draw(state)          hud.apply(events)
```

The Spin Guide replaces only the first box: scripted actions in place of
keyboard actions, and a slower clock.

## 4. Engine rules

These are the concrete rules to implement. Tests in section 8 verify them.

### Playfield

10 columns, 20 visible rows, with a hidden buffer above (40 rows total)
so pieces can spawn and rotate off-screen. A piece spawns in the two
rows immediately above the visible field, horizontally centered, in
state `0`.

### Rotation (SRS)

Four states: `0` spawn, `R` one clockwise, `2` flipped, `L` one
counter-clockwise. On a rotate input, five offsets are tested in order;
the first that does not collide is applied. If all five fail, the
rotation is rejected and nothing changes.

Coordinate convention for the tables below: `x` is right-positive and
`y` is **up**-positive. Board storage is row-major with `y` down, so the
implementation negates the `y` component once, in one place, and a test
pins that conversion.

J, L, S, T, Z kicks:

| Transition | Offsets |
|---|---|
| 0→R | (0,0) (-1,0) (-1,+1) (0,-2) (-1,-2) |
| R→0 | (0,0) (+1,0) (+1,-1) (0,+2) (+1,+2) |
| R→2 | (0,0) (+1,0) (+1,-1) (0,+2) (+1,+2) |
| 2→R | (0,0) (-1,0) (-1,+1) (0,-2) (-1,-2) |
| 2→L | (0,0) (+1,0) (+1,+1) (0,-2) (+1,-2) |
| L→2 | (0,0) (-1,0) (-1,-1) (0,+2) (-1,+2) |
| L→0 | (0,0) (-1,0) (-1,-1) (0,+2) (-1,+2) |
| 0→L | (0,0) (+1,0) (+1,+1) (0,-2) (+1,-2) |

I kicks:

| Transition | Offsets |
|---|---|
| 0→R | (0,0) (-2,0) (+1,0) (-2,-1) (+1,+2) |
| R→0 | (0,0) (+2,0) (-1,0) (+2,+1) (-1,-2) |
| R→2 | (0,0) (-1,0) (+2,0) (-1,+2) (+2,-1) |
| 2→R | (0,0) (+1,0) (-2,0) (+1,-2) (-2,+1) |
| 2→L | (0,0) (+2,0) (-1,0) (+2,+1) (-1,-2) |
| L→2 | (0,0) (-2,0) (+1,0) (-2,-1) (+1,+2) |
| L→0 | (0,0) (+1,0) (-2,0) (+1,-2) (-2,+1) |
| 0→L | (0,0) (-1,0) (+2,0) (-1,+2) (+2,-1) |

O never kicks; its four states occupy the same cells.

**180° rotation** is supported on its own key. It tests `(0,0)` then
`(0,+1)` then `(0,-1)` then `(+1,0)` then `(-1,0)`, in that order, and
is rejected if all fail. Up is tried before down because a 180° is
usually performed with the piece resting on a surface, so the row of
clearance it needs is above: trying downward first would fail the most
common case. A 180° rotation never awards a T-spin.

### T-spin detection

On lock, a T piece earns a spin only if its last successful movement was
a rotation. Then, of the four cells diagonally adjacent to the T's
center, count those that are occupied or out of bounds:

- fewer than 3 occupied: no spin
- 3 or more occupied, and both cells in front of the T's flat edge are
  among them: **T-spin**
- 3 or more occupied but only one front cell: **mini T-spin**, upgraded
  to a full T-spin if the rotation used the fifth kick offset (the one
  that makes a T-spin Triple possible)

Only the T piece can earn a spin bonus. There is no all-spin rule.

### Randomizer

7-bag: shuffle all seven pieces, deal them, refill. The next queue shows
5 pieces. The shuffle draws from a seeded PRNG so a given seed always
produces the same sequence.

### Hold

One slot, swaps with the active piece, usable once per piece. The
swapped-in piece re-spawns at the top in state `0`. The slot is cleared
between games, not between pieces.

### Gravity and drops

Seconds per cell at level `n`: `(0.8 - (n - 1) * 0.007) ^ (n - 1)`.
Level 1 is therefore 1.0s per cell, and by level 15 it is shorter than
one frame at 60fps. Gravity accumulates in milliseconds and the engine
applies as many whole cells per frame as the accumulator allows, so high
levels do not silently cap at one cell per frame.

Soft drop falls at 20 cells per second, or at the level's natural
gravity when that is already faster. Hard drop moves the piece to its
resting position and locks it immediately, ignoring lock delay.

### Lock delay

500ms once the piece rests on a surface. Any successful move or rotation
resets the timer, up to 15 resets per piece; after that the piece locks
on the next contact regardless. Moving off a ledge restarts the fall and
does not refund resets.

### Scoring

Base, each multiplied by level:

| Event | Points |
|---|---|
| Single | 100 |
| Double | 300 |
| Triple | 500 |
| Tetris | 800 |
| Mini T-spin, no lines | 100 |
| Mini T-spin single | 200 |
| Mini T-spin double | 400 |
| T-spin, no lines | 400 |
| T-spin single | 800 |
| T-spin double | 1200 |
| T-spin triple | 1600 |
| Perfect clear single | 800 |
| Perfect clear double | 1200 |
| Perfect clear triple | 1800 |
| Perfect clear tetris | 2000 |

Combo adds `50 * comboCount * level`, where `comboCount` is the number
of consecutive piece locks that cleared at least one line, minus one.
Back-to-back multiplies a difficult clear by 1.5; a Tetris and any
T-spin that clears lines are difficult, and anything else that clears
lines breaks the chain. Soft drop adds 1 point per cell and hard drop 2
points per cell, neither multiplied by level.

### Level and top-out

Marathon starts at level 1 and advances one level per 10 lines cleared.
Sprint stays at level 1 and ends at 40 lines. A game ends on block out
(the spawned piece overlaps existing blocks) or lock out (a piece locks
entirely above the visible field).

## 5. Input

Each frame, `input.js` produces a set of actions: `left`, `right`,
`softDrop`, `hardDrop`, `rotateCW`, `rotateCCW`, `rotate180`, `hold`,
`pause`, `retry`. Movement keys apply DAS and ARR: the first press moves
one cell, then after the DAS delay the piece repeats every ARR
milliseconds. ARR of 0 moves the piece to the wall in a single frame.
Rotation, hold, and hard drop fire once per press and never repeat.

Defaults, all rebindable from the settings screen:

| Action | Key |
|---|---|
| Move left / right | Arrow Left / Arrow Right |
| Soft drop | Arrow Down |
| Hard drop | Space |
| Rotate clockwise | Arrow Up or X |
| Rotate counter-clockwise | Z |
| Rotate 180° | A |
| Hold | C or Shift |
| Pause | Escape |
| Retry | R |

Handling defaults: DAS 100ms, ARR 0ms, soft drop factor 20. Bindings and
handling values persist in `localStorage` under one namespaced key, with
a reset-to-defaults button. Unknown or corrupt stored values fall back
to defaults rather than failing to start.

## 6. Presentation

Dark background, faint grid lines, one solid colour per piece with a
light bevel, and a translucent ghost outline at the landing position.
Side panels hold the hold slot, the 5-piece next queue, and the stats:
score, level, lines, time, and pieces per second.

Effects, all short and non-blocking: a brief trail behind a hard drop, a
flash on cleared rows before they collapse, and text popups for T-SPIN,
TETRIS, B2B, combo count, and PERFECT CLEAR.

The canvas is sized to the viewport with `devicePixelRatio` applied so
edges stay sharp. Cell size derives from available height; the layout
keeps the full 20 visible rows on screen at 720p and above.

## 7. Spin Guide

A separate screen reached from the main menu. It is watched, not played:
the player controls playback, not the piece.

Each lesson is declared as data: a starting board (rows as strings), the
piece to control, an ordered list of scripted actions, and a caption per
step. The player feeds those actions into a real `game.js` instance one
step at a time, renders through `renderer.js`, and draws an arrow from
the rotation's nominal position to the kicked position whenever a kick
offset other than `(0,0)` is used, labelled with which offset fired.

Playback controls: play, pause, step forward, step back, replay, and a
speed selector (0.25x, 0.5x, 1x). Step back re-runs the lesson from the
start to the previous step, which keeps the player stateless and exact.

Lessons, in order:

1. **Basic rotation** — the four states and where each piece's rotation
   centre sits
2. **Wall kick** — an L and an I rotated against the left wall
3. **Floor kick** — an I and a T rotated off the floor
4. **T-spin Single**
5. **T-spin Double**
6. **T-spin Triple**
7. **Kick table reference** — a static view of both tables with the
   offsets drawn on a grid

Each lesson's caption explains what was pressed, which offset the kick
used, and why the piece landed where it did.

## 8. Testing

`tests/test.html` loads the engine and `tests/engine.test.js` and prints
pass/fail to the page, with failures also logged to the console. A tiny
assert helper is written in the test file; no npm, no runner install.
The engine's purity is what makes this enough.

Cases to cover:

- **srs.js**: each of the 16 JLSTZ and I transitions returns the
  expected offset against a crafted board; a rotation with all five
  offsets blocked is rejected and leaves state unchanged; the y-axis
  conversion between table and board coordinates
- **T-spin**: known boards producing T-spin single, double, triple, mini,
  and no-spin; a T-spin shape reached by a move instead of a rotation
  awards nothing; a 180° rotation into a T-slot awards nothing
- **board.js**: collision at walls, floor, and against stack; locking
  writes the right cells; clearing one, two, three, and four rows
  collapses correctly; perfect clear detection
- **randomizer.js**: every 7 consecutive pieces contain all 7 shapes
  exactly once; the same seed reproduces the same sequence
- **scoring.js**: the full table above, combo accumulation and reset,
  back-to-back set and break, perfect clear bonuses
- **game.js**: lock delay resets stop after 15; hard drop locks without
  delay; hold swaps once per piece; block out and lock out both end the
  game

Each lesson in the Spin Guide also serves as a check: because lessons
run through the real engine, a broken kick table makes a lesson visibly
fail to produce its spin.

## 9. Risks

- **Kick table transcription errors.** The most likely source of a
  "feels wrong" bug, and the reason every transition has its own test
  rather than a sampled few.
- **Input latency from frame-based repeat.** If DAS and ARR are measured
  in frames rather than milliseconds, behaviour changes with refresh
  rate. All timing is in milliseconds, driven by the frame delta.
- **`file://` restrictions.** No ES modules and no local `fetch`, which
  is why lesson data lives in JavaScript and scripts load in order.

## 10. Build order

1. `pieces.js`, `board.js`, `randomizer.js` with tests
2. `srs.js` with the full kick table test suite
3. `game.js` lifecycle and `scoring.js` with tests
4. `renderer.js` and `main.js` — first playable Marathon
5. `input.js` with DAS/ARR, then `screens.js` settings and rebinding
6. `hud.js`, effects, Sprint 40L, personal bests
7. `spin-guide.js` lessons and player
