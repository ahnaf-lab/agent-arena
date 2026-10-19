import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPairings, rankStandings, runRoundRobin } from '../src/tournament/roundRobin.js';
import * as prisonersDilemma from '../src/engine/prisonersDilemma.js';
import {
  alwaysCooperate,
  alwaysDefect,
  titForTat,
} from '../src/bots/prisonersDilemmaBots.js';

test('buildPairings covers every unique pair exactly once', () => {
  const pairings = buildPairings([{}, {}, {}, {}]);
  assert.deepStrictEqual(pairings, [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ]);
});

test('buildPairings rejects a field of fewer than two agents', () => {
  assert.throws(() => buildPairings([{}]));
});

test('rankStandings sorts by points, then wins, then name', () => {
  const standings = [
    { name: 'b', wins: 1, losses: 0, draws: 0, points: 10 },
    { name: 'a', wins: 2, losses: 0, draws: 0, points: 10 },
    { name: 'c', wins: 0, losses: 1, draws: 0, points: 20 },
  ];
  const ranked = rankStandings(standings);
  assert.deepStrictEqual(ranked.map((s) => s.name), ['c', 'a', 'b']);
});

test('runRoundRobin plays every pairing and produces a full standings table', async () => {
  const agents = [alwaysCooperate(), alwaysDefect(), titForTat()];
  const { matches, standings } = await runRoundRobin(agents, prisonersDilemma, 5);

  assert.strictEqual(matches.length, 3);
  assert.strictEqual(standings.length, 3);
  // every standing accounted for, points are non-negative integers
  for (const standing of standings) {
    assert.ok(Number.isInteger(standing.points) && standing.points >= 0);
    assert.strictEqual(standing.wins + standing.losses + standing.draws, 2);
  }
  // always-defect should out-score always-cooperate overall in this field
  const defector = standings.find((s) => s.name === 'always-defect');
  const cooperator = standings.find((s) => s.name === 'always-cooperate');
  assert.ok(defector.points > cooperator.points);
});

test('runRoundRobin calls onMatchComplete once per pairing, in order, with live standings', async () => {
  const agents = [alwaysCooperate(), alwaysDefect(), titForTat()];
  const seen = [];
  await runRoundRobin(agents, prisonersDilemma, 5, {
    onMatchComplete: ({ matchNumber, totalMatches, standings }) => {
      seen.push({ matchNumber, totalMatches, standingsCount: standings.length });
    },
  });

  assert.strictEqual(seen.length, 3);
  assert.deepStrictEqual(seen.map((s) => s.matchNumber), [1, 2, 3]);
  assert.ok(seen.every((s) => s.totalMatches === 3 && s.standingsCount === 3));
});
