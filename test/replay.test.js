import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runBroadcast } from '../src/tui/broadcast.js';
import * as prisonersDilemma from '../src/engine/prisonersDilemma.js';
import { alwaysCooperate, alwaysDefect, titForTat } from '../src/bots/prisonersDilemmaBots.js';
import { buildPairings } from '../src/tournament/roundRobin.js';
import { buildReplay, REPLAY_FORMAT_VERSION } from '../src/replay/record.js';
import { renderReplayFrames, renderReplaySummary } from '../src/replay/render.js';
import { saveReplay, loadReplay, validateReplay, replayPathFor } from '../src/replay/store.js';

// A fixed, fully-deterministic 3-agent round robin (no seeded randomness
// involved), used across every test below as the thing being recorded,
// saved, reloaded and re-rendered.
async function recordFixtureReplay() {
  const agents = [alwaysCooperate(), alwaysDefect(), titForTat()];
  const { standings, frames } = await runBroadcast(agents, prisonersDilemma, 2, { delayMs: 0 });
  return buildReplay({
    title: 'Agent Arena -- prisonersDilemma',
    gameName: 'prisonersDilemma',
    rounds: 2,
    agentNames: agents.map((agent) => agent.name),
    pairings: buildPairings(agents),
    frames,
    standings,
  });
}

// The exact frame text recorded once from this fixture's deterministic
// bots -- any change to the renderer's output shape should break this
// golden comparison.
const GOLDEN_FRAME_1 =
  'Agent Arena -- prisonersDilemma\n' +
  '===============================\n\n' +
  'Match 1 / 3\n\n' +
  'Standings:\n\n' +
  ' #  Agent                 W    L    D  Points\n' +
  '--  ------------------  ---  ---  ---  ------\n' +
  ' 1  always-defect         2    0    0      16\n' +
  ' 2  always-cooperate      0    1    1       6\n' +
  ' 3  tit-for-tat           0    1    1       7\n\n' +
  'Bracket:\n\n' +
  '  always-cooperate 0 < 10 always-defect  (done)\n' +
  '  always-cooperate vs tit-for-tat  ... pending\n' +
  '  always-defect vs tit-for-tat  ... pending\n\n' +
  'Latest match: always-cooperate vs always-defect\n\n' +
  ' Rd  always-cooperate  always-defect   Result          \n' +
  '---  --------------  --------------  ----------------\n' +
  '  1  cooperate       defect          0-5             \n' +
  '  2  cooperate       defect          0-5             ';

const GOLDEN_FRAME_3 =
  'Agent Arena -- prisonersDilemma\n' +
  '===============================\n\n' +
  'Match 3 / 3\n\n' +
  'Standings:\n\n' +
  ' #  Agent                 W    L    D  Points\n' +
  '--  ------------------  ---  ---  ---  ------\n' +
  ' 1  always-defect         2    0    0      16\n' +
  ' 2  tit-for-tat           0    1    1       7\n' +
  ' 3  always-cooperate      0    1    1       6\n\n' +
  'Bracket:\n\n' +
  '  always-cooperate 0 < 10 always-defect  (done)\n' +
  '  always-cooperate 6 = 6 tit-for-tat  (done)\n' +
  '  always-defect 6 > 1 tit-for-tat  (done)\n\n' +
  'Latest match: always-defect vs tit-for-tat\n\n' +
  ' Rd  always-defect   tit-for-tat     Result          \n' +
  '---  --------------  --------------  ----------------\n' +
  '  1  defect          cooperate       5-0             \n' +
  '  2  defect          defect          1-1             ';

test('buildReplay captures version, metadata and one frame per match', async () => {
  const replay = await recordFixtureReplay();
  assert.strictEqual(replay.version, REPLAY_FORMAT_VERSION);
  assert.strictEqual(replay.gameName, 'prisonersDilemma');
  assert.strictEqual(replay.frames.length, 3);
  assert.deepStrictEqual(replay.agentNames, ['always-cooperate', 'always-defect', 'tit-for-tat']);
  assert.strictEqual(replay.finalStandings[0].name, 'always-defect');
});

test('renderReplayFrames reproduces the exact live-broadcast frame text (golden)', async () => {
  const replay = await recordFixtureReplay();
  const rendered = renderReplayFrames(replay);

  assert.strictEqual(rendered.length, 3);
  assert.strictEqual(rendered[0], GOLDEN_FRAME_1);
  assert.strictEqual(rendered[2], GOLDEN_FRAME_3);
});

test('renderReplaySummary returns the final frame', async () => {
  const replay = await recordFixtureReplay();
  const summary = renderReplaySummary(replay);
  assert.strictEqual(summary, GOLDEN_FRAME_3);
});

test('saveReplay then loadReplay round-trips the replay data exactly', async () => {
  const replay = await recordFixtureReplay();
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agent-arena-replay-'));
  const filePath = path.join(tmpDir, 'fixture.json');

  try {
    const savedPath = saveReplay(replay, filePath);
    assert.strictEqual(savedPath, path.resolve(filePath));

    const loaded = loadReplay(filePath);
    assert.deepStrictEqual(loaded, replay);
    assert.deepStrictEqual(renderReplayFrames(loaded), renderReplayFrames(replay));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('replayPathFor confines a bare name to the replays/ directory', () => {
  const resolved = replayPathFor('my-tournament');
  assert.ok(resolved.endsWith(path.join('replays', 'my-tournament.json')));
  // a bare name can never climb out of replays/, even if it looks like one
  const dotted = replayPathFor('..');
  assert.ok(dotted.startsWith(path.resolve('replays')));
});

test('validateReplay rejects malformed replay data', () => {
  assert.throws(() => validateReplay(null));
  assert.throws(() => validateReplay({ version: 99, frames: [], agentNames: [], pairings: [] }));
  assert.throws(() => validateReplay({ version: REPLAY_FORMAT_VERSION, agentNames: [], pairings: [] }));
});

test('loadReplay reports a clear error for a missing file', () => {
  assert.throws(() => loadReplay(path.join(os.tmpdir(), 'definitely-not-a-real-replay-file.json')));
});
