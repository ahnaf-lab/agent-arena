#!/usr/bin/env node
// Replay viewer: `node src/replay/cli.js <file>` loads a saved tournament
// replay and redraws it frame-by-frame, exactly like the live broadcast
// did the first time, but with no agents and no game logic involved --
// just the recorded frames.

import { loadReplay } from './store.js';
import { renderReplayFrames } from './render.js';
import { createScreen } from '../tui/screen.js';

function wait(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function main(argv, { screen = createScreen(), delayMs = 400 } = {}) {
  const [file] = argv;
  if (!file) {
    throw new Error('usage: replay/cli.js <replay-file>');
  }
  const replay = loadReplay(file);
  const frames = renderReplayFrames(replay);
  for (const frame of frames) {
    screen.draw(frame);
    await wait(delayMs);
  }
  return replay.finalStandings;
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
