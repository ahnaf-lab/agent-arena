import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMatch } from '../src/engine/resourceSplit.js';
import {
  fairSplitter,
  greedySplitter,
  mirrorSplitter,
  randomSplitter,
} from '../src/bots/resourceSplitBots.js';

test('two fair splitters each take half the pool every round', async () => {
  const result = await runMatch(fairSplitter(), fairSplitter(), 3, { pool: 100 });
  assert.deepStrictEqual(result.totalScores, [150, 150]);
  assert.ok(result.history.every((r) => !r.overClaimed));
});

test('two greedy splitters overclaim and both get nothing', async () => {
  const result = await runMatch(greedySplitter(), greedySplitter(), 3, { pool: 100 });
  assert.deepStrictEqual(result.totalScores, [0, 0]);
  assert.ok(result.history.every((r) => r.overClaimed));
});

test('a fair splitter yields when paired with a greedy one', async () => {
  const result = await runMatch(fairSplitter(), greedySplitter(), 2, { pool: 100 });
  // claims are 50 + 100 = 150 > pool, so this also overclaims and pays nothing.
  assert.deepStrictEqual(result.totalScores, [0, 0]);
});

test('mirror splitter starts fair and then copies the opponent', async () => {
  const result = await runMatch(mirrorSplitter(), greedySplitter(), 3, { pool: 100 });
  const claimsA = result.history.map((r) => r.claims[0]);
  // round 0: defaults to half (50); rounds 1-2: mirrors greedy's previous claim (100).
  assert.deepStrictEqual(claimsA, [50, 100, 100]);
});

test('a fixed seed reproduces the exact same claim history', async () => {
  const resultA = await runMatch(randomSplitter(10), randomSplitter(20), 15, { pool: 100 });
  const resultB = await runMatch(randomSplitter(10), randomSplitter(20), 15, { pool: 100 });
  assert.deepStrictEqual(resultA.history, resultB.history);
});

test('an invalid claim outside [0, pool] throws', async () => {
  const brokenAgent = { name: 'broken', chooseClaim: (pool) => pool + 1 };
  await assert.rejects(() => runMatch(brokenAgent, fairSplitter(), 1, { pool: 100 }));
});

test('an agent may answer asynchronously, as an MCP-speaking agent would', async () => {
  const asyncFairSplitter = {
    name: 'async-fair-splitter',
    async chooseClaim(pool) {
      return Math.floor(pool / 2);
    },
  };
  const result = await runMatch(asyncFairSplitter, fairSplitter(), 2, { pool: 100 });
  assert.deepStrictEqual(result.totalScores, [100, 100]);
});
