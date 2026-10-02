# Tetris

A modern Tetris, plus an animated guide that teaches how spins actually work.

**[Play it](https://dhellss.github.io/tetris/)** — or clone the repo and open `index.html`. No build step, no dependencies, no server.

## The spin guide

Most Tetris clones leave you to work out wall kicks on your own. This one has
a guide with seven lessons, and every one of them runs on the real game
engine — so it cannot teach a rule the game does not implement.

The thing it makes visible: **no T-spin position can be reached by dropping
into it.** Filling three corners around the T always needs an overhang, and
that overhang is exactly what blocks the fall. The only way in is the
rotation itself. The guide draws that — where the piece *would* have landed
with no kick, dashed, and an arrow to where the kick actually put it.

Lessons: rotation states, wall kick, floor kick, T-Spin Single, Double,
Triple, and a page that draws all five kick positions for any piece and turn
you pick.

## The game

Guideline-compliant: SRS rotation with the full kick tables, 180° rotation,
7-bag randomizer, five-piece preview, hold, ghost piece, 500ms lock delay
with a 15-move reset budget, and both top-out conditions.

Scoring covers T-spins and minis, combos, back-to-back, and perfect clears.

Two modes — Marathon, which speeds up every ten lines, and Sprint 40L against
the clock. Personal bests are kept in your browser.

## Controls

| | |
|---|---|
| Move | ← → |
| Soft drop | ↓ |
| Hard drop | Space |
| Rotate | ↑ or X, Z for the other way |
| Rotate 180° | A |
| Hold | C or Shift |
| Pause | Esc |
| Retry | R |

All rebindable in Settings, along with DAS, ARR and soft drop speed.

## Layout

```
index.html  styles.css  main.js
engine/     pieces, board, randomizer, srs, scoring, game
ui/         renderer, input, hud, bests, screens
guide/      spin-guide
```

`engine/` never touches the DOM, the canvas, or an event. It takes a set of
actions for one frame and returns the new state plus what happened. That
boundary is what lets the guide drive the same engine the game runs on.
