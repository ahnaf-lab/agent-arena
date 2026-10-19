import { createRng, randomInt } from '../engine/rng.js';

export function fairSplitter() {
  return {
    name: 'fair-splitter',
    chooseClaim(pool) {
      return Math.floor(pool / 2);
    },
  };
}

export function greedySplitter() {
  return {
    name: 'greedy-splitter',
    chooseClaim(pool) {
      return pool;
    },
  };
}

// Mirrors the opponent's previous claim, starting from a fair 50/50 split.
export function mirrorSplitter() {
  return {
    name: 'mirror-splitter',
    chooseClaim(pool, history, playerIndex) {
      if (history.length === 0) return Math.floor(pool / 2);
      const opponentIndex = playerIndex === 0 ? 1 : 0;
      return history[history.length - 1].claims[opponentIndex];
    },
  };
}

// Deterministic given the same seed: produces the same claim sequence every
// run, which is what makes a fixed-seed test suite possible.
export function randomSplitter(seed) {
  const rng = createRng(seed);
  return {
    name: `random-splitter-${seed}`,
    chooseClaim(pool) {
      return randomInt(rng, 0, pool);
    },
  };
}
