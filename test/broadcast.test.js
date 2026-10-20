import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBroadcast } from '../src/tui/broadcast.js';
import * as prisonersDilemma from '../src/engine/prisonersDilemma.js';
import {
  alwaysCooperate,
  alwaysDefect,
  titForTat,
} from '../src/bots/prisonersDilemmaBots.js';
import { parseArgs, DEFAULT_DEMO } from '../src/tui/cli.js';

function fakeScreen() {
  const frames = [];
  return { frames, draw: (frame) => frames.push(frame) };
}

test('runBroadcast draws one initial frame plus one frame per match', async () => {
  const agents = [alwaysCooperate(), alwaysDefect(), titForTat()];
  const screen = fakeScreen();

  const { matches, standings } = await runBroadcast(agents, prisonersDilemma, 5, { screen, delayMs: 0 });

  assert.strictEqual(matches.length, 3);
  assert.strictEqual(standings.length, 3);
  // 1 initial empty-bracket frame + 3 post-match frames
  assert.strictEqual(screen.frames.length, 4);
  assert.ok(screen.frames[0].includes('pending'));
  assert.ok(screen.frames[3].includes('Match 3 / 3'));
});

test('runBroadcast also returns one recorded frame per completed match, for replays', async () => {
  const agents = [alwaysCooperate(), alwaysDefect(), titForTat()];
  const { frames } = await runBroadcast(agents, prisonersDilemma, 5, { delayMs: 0 });

  assert.strictEqual(frames.length, 3);
  assert.deepStrictEqual(frames.map((f) => f.matchNumber), [1, 2, 3]);
  assert.ok(frames.every((f) => f.totalMatches === 3));
  assert.ok(frames[0].match.players.length === 2);
});

test('runBroadcast works with no screen attached (headless)', async () => {
  const agents = [alwaysCooperate(), alwaysDefect()];
  const { standings } = await runBroadcast(agents, prisonersDilemma, 3, { delayMs: 0 });
  assert.strictEqual(standings.length, 2);
});

test('cli parseArgs accepts a known game with at least two bots', () => {
  const { gameName, botSpecs } = parseArgs(['prisonersDilemma', 'titForTat', 'alwaysDefect']);
  assert.strictEqual(gameName, 'prisonersDilemma');
  assert.deepStrictEqual(botSpecs, ['titForTat', 'alwaysDefect']);
});

test('cli parseArgs rejects an unknown game', () => {
  assert.throws(() => parseArgs(['madeUpGame', 'a', 'b']));
});

test('cli parseArgs rejects fewer than two bots', () => {
  assert.throws(() => parseArgs(['prisonersDilemma', 'titForTat']));
});

test('cli parseArgs falls back to the no-API-key demo tournament when run with no arguments', () => {
  const { gameName, botSpecs } = parseArgs([]);
  const [demoGame, ...demoBotSpecs] = DEFAULT_DEMO;
  assert.strictEqual(gameName, demoGame);
  assert.deepStrictEqual(botSpecs, demoBotSpecs);
  assert.ok(botSpecs.length >= 2);
});

test('cli parseArgs pulls --save-replay out of the arguments wherever it appears', () => {
  const parsed = parseArgs(['prisonersDilemma', 'titForTat', '--save-replay', 'my-run', 'alwaysDefect']);
  assert.strictEqual(parsed.replayName, 'my-run');
  assert.deepStrictEqual(parsed.botSpecs, ['titForTat', 'alwaysDefect']);
});

test('cli parseArgs rejects --save-replay with no file name', () => {
  assert.throws(() => parseArgs(['prisonersDilemma', 'titForTat', 'alwaysDefect', '--save-replay']));
});

test('cli parseArgs leaves replayName null when the flag is absent', () => {
  const { replayName } = parseArgs(['prisonersDilemma', 'titForTat', 'alwaysDefect']);
  assert.strictEqual(replayName, null);
});
