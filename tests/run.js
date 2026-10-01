'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Order matters and mirrors index.html / test.html.
const FILES = [
  'tests/harness.js',
  'engine/pieces.js',
  'engine/board.js',
  'engine/randomizer.js',
  'engine/srs.js',
  'engine/scoring.js',
  'engine/game.js',
  'ui/input.js',
  'ui/renderer.js',
  'ui/hud.js',
  'ui/bests.js',
  'guide/spin-guide.js',
  'tests/engine.test.js',
  'tests/ui.test.js'
];

const rootDir = path.join(__dirname, '..');
const sandbox = { console: console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const rel of FILES) {
  const abs = path.join(rootDir, rel);
  if (!fs.existsSync(abs)) continue; // files arrive task by task
  vm.runInContext(fs.readFileSync(abs, 'utf8'), sandbox, { filename: rel });
}

const result = sandbox.Harness.run();
process.exit(result.failed > 0 ? 1 : 0);
