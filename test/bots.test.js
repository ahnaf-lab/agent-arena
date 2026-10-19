import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVES } from '../src/engine/prisonersDilemma.js';
import {
  alwaysCooperate,
  alwaysDefect,
  titForTat,
  grimTrigger,
  randomBot,
} from '../src/bots/prisonersDilemmaBots.js';
import {
  fairSplitter,
  greedySplitter,
  mirrorSplitter,
  randomSplitter,
} from '../src/bots/resourceSplitBots.js';

test('alwaysCooperate always returns cooperate, regardless of history', () => {
  const bot = alwaysCooperate();
  assert.strictEqual(bot.chooseMove([], 0), MOVES.COOPERATE);
  const history = [{ moves: [MOVES.DEFECT, MOVES.DEFECT], scores: [1, 1] }];
  assert.strictEqual(bot.chooseMove(history, 0), MOVES.COOPERATE);
});

test('titForTat opens with cooperate then mirrors the opponent\'s last move', () => {
  const bot = titForTat();
  assert.strictEqual(bot.chooseMove([], 0), MOVES.COOPERATE);

  const afterOpponentDefected = [
    { moves: [MOVES.COOPERATE, MOVES.DEFECT], scores: [0, 5] },
  ];
  assert.strictEqual(bot.chooseMove(afterOpponentDefected, 0), MOVES.DEFECT);

  const afterOpponentCooperated = [
    { moves: [MOVES.DEFECT, MOVES.COOPERATE], scores: [5, 0] },
  ];
  assert.strictEqual(bot.chooseMove(afterOpponentCooperated, 0), MOVES.COOPERATE);
});

test('grimTrigger cooperates until betrayed once, then defects forever', () => {
  const bot = grimTrigger();
  assert.strictEqual(bot.chooseMove([], 0), MOVES.COOPERATE);

  const neverBetrayed = [{ moves: [MOVES.COOPERATE, MOVES.COOPERATE], scores: [3, 3] }];
  assert.strictEqual(bot.chooseMove(neverBetrayed, 0), MOVES.COOPERATE);

  const betrayedOnce = [
    { moves: [MOVES.COOPERATE, MOVES.COOPERATE], scores: [3, 3] },
    { moves: [MOVES.COOPERATE, MOVES.DEFECT], scores: [0, 5] },
  ];
  assert.strictEqual(bot.chooseMove(betrayedOnce, 0), MOVES.DEFECT);

  const betrayedThenOpponentCooperatesAgain = [
    ...betrayedOnce,
    { moves: [MOVES.DEFECT, MOVES.COOPERATE], scores: [5, 0] },
  ];
  // Grim trigger never forgives -- one defection in history is permanent.
  assert.strictEqual(bot.chooseMove(betrayedThenOpponentCooperatesAgain, 0), MOVES.DEFECT);
});

test('randomBot is deterministic for a given seed and varies by seed', () => {
  const botA = randomBot(42);
  const botB = randomBot(42);
  const movesA = Array.from({ length: 10 }, () => botA.chooseMove([], 0));
  const movesB = Array.from({ length: 10 }, () => botB.chooseMove([], 0));
  assert.deepStrictEqual(movesA, movesB);

  const botC = randomBot(99);
  const movesC = Array.from({ length: 10 }, () => botC.chooseMove([], 0));
  assert.notDeepStrictEqual(movesA, movesC);

  for (const move of movesA) {
    assert.ok(move === MOVES.COOPERATE || move === MOVES.DEFECT);
  }
});

test('resource-split bots claim shares according to their strategy', () => {
  assert.strictEqual(fairSplitter().chooseClaim(100), 50);
  assert.strictEqual(greedySplitter().chooseClaim(100), 100);

  const mirror = mirrorSplitter();
  assert.strictEqual(mirror.chooseClaim(100, [], 0), 50);
  const history = [{ claims: [40, 70], payouts: [0, 0], overClaimed: true }];
  assert.strictEqual(mirror.chooseClaim(100, history, 0), 70);

  const randomA = randomSplitter(7);
  const randomB = randomSplitter(7);
  const claimA = randomA.chooseClaim(100, [], 0);
  const claimB = randomB.chooseClaim(100, [], 0);
  assert.strictEqual(claimA, claimB);
  assert.ok(claimA >= 0 && claimA <= 100);
});
