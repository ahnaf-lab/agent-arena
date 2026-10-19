import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMatch } from '../src/engine/resourceSplit.js';
import {
  fairSplitter,
  greedySplitter,
  mirrorSplitter,
  randomSplitter,
} from '../src/bots/resourceSplitBots.js';

test('two fair splitters each take half the pool every round', () => {
  const result = runMatch(fairSplitter(), fairSplitter(), 3, { pool: 100 });
  assert.deepStrictEqual(result.totalScores, [150, 150]);
  assert.ok(result.history.every((r) => !r.overClaimed));
});

test('two greedy splitters overclaim and both get nothing', () => {
  const result = runMatch(greedySplitter(), greedySplitter(), 3, { pool: 100 });
  assert.deepStrictEqual(result.totalScores, [0, 0]);
  assert.ok(result.history.every((r) => r.overClaimed));
});

test('a fair splitter yields when paired with a greedy one', () => {
  const result = runMatch(fairSplitter(), greedySplitter(), 2, { pool: 100 });
  // claims are 50 + 100 = 150 > pool, so this also overclaims and pays nothing.
  assert.deepStrictEqual(result.totalScores, [0, 0]);
});

test('mirror splitter starts fair and then copies the opponent', () => {
  const result = runMatch(mirrorSplitter(), greedySplitter(), 3, { pool: 100 });
  const claimsA = result.history.map((r) => r.claims[0]);
  // round 0: defaults to half (50); rounds 1-2: mirrors greedy's previous claim (100).
  assert.deepStrictEqual(claimsA, [50, 100, 100]);
});

test('a fixed seed reproduces the exact same claim history', () => {
  const resultA = runMatch(randomSplitter(10), randomSplitter(20), 15, { pool: 100 });
  const resultB = runMatch(randomSplitter(10), randomSplitter(20), 15, { pool: 100 });
  assert.deepStrictEqual(resultA.history, resultB.history);
});

test('an invalid claim outside [0, pool] throws', () => {
  const brokenAgent = { name: 'broken', chooseClaim: (pool) => pool + 1 };
  assert.throws(() => runMatch(brokenAgent, fairSplitter(), 1, { pool: 100 }));
});
