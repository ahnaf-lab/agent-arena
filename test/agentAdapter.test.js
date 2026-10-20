// Integration test for the external agent adapter wired into the
// spectator CLI: `--agent <name> <command> [arg...]` spawns any
// MCP-speaking process (src/mcp/client.js) and seats it as a tournament
// player alongside the named bots, exactly like src/mcp/server.js wraps
// one of the shipped scripted bots for use in test/mcp.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { main } from '../src/tui/cli.js';

const SERVER_PATH = fileURLToPath(new URL('../src/mcp/server.js', import.meta.url));

function fakeScreen() {
  const frames = [];
  return { frames, draw: (frame) => frames.push(frame) };
}

test('an external MCP agent seated via --agent plays a full tournament against a bot', async () => {
  const screen = fakeScreen();
  const standings = await main(
    [
      'prisonersDilemma',
      'alwaysCooperate',
      '--agent',
      'remote-defector',
      process.execPath,
      SERVER_PATH,
      'prisonersDilemma',
      'alwaysDefect',
    ],
    { screen, delayMs: 0 }
  );

  assert.strictEqual(standings.length, 2);
  const names = standings.map((s) => s.name).sort();
  assert.deepStrictEqual(names, ['always-cooperate', 'remote-defector']);

  const remote = standings.find((s) => s.name === 'remote-defector');
  const local = standings.find((s) => s.name === 'always-cooperate');
  // alwaysDefect beats alwaysCooperate every round of iterated Prisoner's Dilemma.
  assert.ok(remote.points > local.points);
});

test('main() still works with only built-in bots and no --agent flag', async () => {
  const standings = await main(['prisonersDilemma', 'alwaysCooperate', 'alwaysDefect', 'titForTat'], {
    screen: fakeScreen(),
    delayMs: 0,
  });
  assert.strictEqual(standings.length, 3);
});
