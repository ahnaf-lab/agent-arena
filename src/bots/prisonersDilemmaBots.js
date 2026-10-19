import { MOVES } from '../engine/prisonersDilemma.js';
import { createRng, randomInt } from '../engine/rng.js';

export function alwaysCooperate() {
  return {
    name: 'always-cooperate',
    chooseMove: () => MOVES.COOPERATE,
  };
}

export function alwaysDefect() {
  return {
    name: 'always-defect',
    chooseMove: () => MOVES.DEFECT,
  };
}

export function titForTat() {
  return {
    name: 'tit-for-tat',
    chooseMove(history, playerIndex) {
      if (history.length === 0) return MOVES.COOPERATE;
      const opponentIndex = playerIndex === 0 ? 1 : 0;
      return history[history.length - 1].moves[opponentIndex];
    },
  };
}

export function grimTrigger() {
  return {
    name: 'grim-trigger',
    chooseMove(history, playerIndex) {
      const opponentIndex = playerIndex === 0 ? 1 : 0;
      const wasBetrayed = history.some(
        (round) => round.moves[opponentIndex] === MOVES.DEFECT
      );
      return wasBetrayed ? MOVES.DEFECT : MOVES.COOPERATE;
    },
  };
}

// Deterministic given the same seed: produces the same move sequence every
// run, which is what makes a fixed-seed test suite possible.
export function randomBot(seed) {
  const rng = createRng(seed);
  return {
    name: `random-bot-${seed}`,
    chooseMove() {
      return randomInt(rng, 0, 1) === 0 ? MOVES.COOPERATE : MOVES.DEFECT;
    },
  };
}
