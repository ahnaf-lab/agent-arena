import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMatch, MOVES } from '../src/engine/prisonersDilemma.js';
import {
  alwaysCooperate,
  alwaysDefect,
  titForTat,
  grimTrigger,
  randomBot,
} from '../src/bots/prisonersDilemmaBots.js';

test('mutual cooperation scores 3 points per round for both players', async () => {
  const result = await runMatch(alwaysCooperate(), alwaysCooperate(), 5);
  assert.deepStrictEqual(result.totalScores, [15, 15]);
  assert.ok(result.history.every((r) => r.moves[0] === MOVES.COOPERATE));
});

test('a defector exploits a cooperator every round', async () => {
  const result = await runMatch(alwaysCooperate(), alwaysDefect(), 4);
  // cooperator gets 0, defector gets 5, each round.
  assert.deepStrictEqual(result.totalScores, [0, 20]);
});

test('mutual defection scores 1 point per round for both players', async () => {
  const result = await runMatch(alwaysDefect(), alwaysDefect(), 6);
  assert.deepStrictEqual(result.totalScores, [6, 6]);
});

test('tit-for-tat cooperates first, then mirrors the opponent one round late', async () => {
  const result = await runMatch(titForTat(), alwaysDefect(), 4);
  const movesA = result.history.map((r) => r.moves[0]);
  assert.deepStrictEqual(movesA, [
    MOVES.COOPERATE,
    MOVES.DEFECT,
    MOVES.DEFECT,
    MOVES.DEFECT,
  ]);
});

test('grim trigger retaliates forever after the first betrayal', async () => {
  // Opponent cooperates, then defects once, then cooperates again -- grim
  // trigger should never forgive after the single defection.
  const scripted = {
    name: 'scripted',
    chooseMove(history) {
      const round = history.length;
      if (round === 1) return MOVES.DEFECT;
      return MOVES.COOPERATE;
    },
  };
  const result = await runMatch(grimTrigger(), scripted, 5);
  const movesA = result.history.map((r) => r.moves[0]);
  assert.deepStrictEqual(movesA, [
    MOVES.COOPERATE,
    MOVES.COOPERATE,
    MOVES.DEFECT,
    MOVES.DEFECT,
    MOVES.DEFECT,
  ]);
});

test('a fixed seed reproduces the exact same match history', async () => {
  const resultA = await runMatch(randomBot(123), randomBot(456), 20);
  const resultB = await runMatch(randomBot(123), randomBot(456), 20);
  assert.deepStrictEqual(resultA.history, resultB.history);
  assert.deepStrictEqual(resultA.totalScores, resultB.totalScores);
});

test('different seeds produce a different match history', async () => {
  const resultA = await runMatch(randomBot(1), randomBot(2), 20);
  const resultB = await runMatch(randomBot(1), randomBot(3), 20);
  assert.notDeepStrictEqual(resultA.history, resultB.history);
});

test('an invalid move from an agent throws instead of silently continuing', async () => {
  const brokenAgent = { name: 'broken', chooseMove: () => 'betray' };
  await assert.rejects(() => runMatch(brokenAgent, alwaysCooperate(), 1));
});

test('an agent may answer asynchronously, as an MCP-speaking agent would', async () => {
  const asyncCooperator = {
    name: 'async-cooperator',
    async chooseMove() {
      return MOVES.COOPERATE;
    },
  };
  const result = await runMatch(asyncCooperator, alwaysCooperate(), 3);
  assert.deepStrictEqual(result.totalScores, [9, 9]);
});
