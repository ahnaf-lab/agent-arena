import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  TOOLS,
  validateMoveResult,
  validateClaimResult,
  createMcpAgent,
} from '../src/mcp/index.js';
import { runMatch as runDilemmaMatch } from '../src/engine/prisonersDilemma.js';
import { runMatch as runSplitMatch } from '../src/engine/resourceSplit.js';
import { alwaysCooperate, alwaysDefect } from '../src/bots/prisonersDilemmaBots.js';
import { fairSplitter } from '../src/bots/resourceSplitBots.js';

const SERVER_PATH = fileURLToPath(new URL('../src/mcp/server.js', import.meta.url));

function spawnBot(game, botSpec) {
  return createMcpAgent({
    command: process.execPath,
    args: [SERVER_PATH, game, botSpec],
    name: `mcp:${botSpec}`,
  });
}

test('the tool contract declares exactly the two per-game move tools', () => {
  const names = TOOLS.map((tool) => tool.name);
  assert.deepStrictEqual(names, ['choose_move', 'choose_claim']);
  assert.ok(TOOLS.every((tool) => tool.inputSchema.type === 'object'));
});

test('validateMoveResult accepts valid moves and rejects garbage', () => {
  assert.strictEqual(validateMoveResult({ move: 'cooperate' }), 'cooperate');
  assert.throws(() => validateMoveResult({ move: 'betray' }));
  assert.throws(() => validateMoveResult(null));
});

test('validateClaimResult accepts in-range claims and rejects out-of-range ones', () => {
  assert.strictEqual(validateClaimResult({ claim: 40 }, 100), 40);
  assert.throws(() => validateClaimResult({ claim: 150 }, 100));
  assert.throws(() => validateClaimResult({ claim: 1.5 }, 100));
});

test('an MCP-wrapped bot plays Prisoner\'s Dilemma identically to the in-process bot', async () => {
  const mcpDefector = spawnBot('prisonersDilemma', 'alwaysDefect');
  try {
    const result = await runDilemmaMatch(alwaysCooperate(), mcpDefector, 4);
    assert.deepStrictEqual(result.totalScores, [0, 20]);
    assert.ok(result.history.every((r) => r.moves[1] === 'defect'));
  } finally {
    mcpDefector.close();
  }
});

test('an MCP-wrapped bot plays resource-split identically to the in-process bot', async () => {
  const mcpFairSplitter = spawnBot('resourceSplit', 'fairSplitter');
  try {
    const result = await runSplitMatch(fairSplitter(), mcpFairSplitter, 3, { pool: 100 });
    assert.deepStrictEqual(result.totalScores, [150, 150]);
  } finally {
    mcpFairSplitter.close();
  }
});

test('an MCP agent with a seeded bot is deterministic across separate processes', async () => {
  const botA = spawnBot('prisonersDilemma', 'randomBot:7');
  const botB = spawnBot('prisonersDilemma', 'randomBot:7');
  try {
    const resultA = await runDilemmaMatch(botA, alwaysDefect(), 10);
    const resultB = await runDilemmaMatch(botB, alwaysDefect(), 10);
    assert.deepStrictEqual(resultA.history, resultB.history);
  } finally {
    botA.close();
    botB.close();
  }
});

test('calling the wrong tool for an agent surfaces as a rejected call, not a crash', async () => {
  // This bot only implements chooseMove; asking it for a resource-split
  // claim should come back as an MCP tool error rather than hanging or
  // taking down the server process.
  const agent = spawnBot('prisonersDilemma', 'alwaysCooperate');
  try {
    await assert.rejects(() => agent.chooseClaim(100, [], 0));
  } finally {
    agent.close();
  }
});
