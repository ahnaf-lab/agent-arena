import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderStandingsTable,
  renderMoveHistory,
  renderBracket,
  renderFrame,
  pairKey,
} from '../src/tui/render.js';

test('renderStandingsTable lists agents in the order given, ranked beforehand', () => {
  const standings = [
    { name: 'always-defect', wins: 2, losses: 0, draws: 0, points: 34 },
    { name: 'tit-for-tat', wins: 1, losses: 1, draws: 0, points: 19 },
  ];
  const table = renderStandingsTable(standings);
  const lines = table.split('\n');

  assert.strictEqual(lines.length, 4); // header + rule + 2 rows
  assert.ok(lines[2].includes('always-defect'));
  assert.ok(lines[2].includes('34'));
  assert.ok(lines[3].includes('tit-for-tat'));
  // first data row (rank 1) should appear before the second (rank 2)
  assert.ok(table.indexOf('always-defect') < table.indexOf('tit-for-tat'));
});

test('renderMoveHistory renders prisoners-dilemma rounds with moves and scores', () => {
  const match = {
    players: ['alice', 'bob'],
    result: {
      history: [
        { moves: ['cooperate', 'defect'], scores: [0, 5] },
        { moves: ['defect', 'defect'], scores: [1, 1] },
      ],
    },
  };
  const text = renderMoveHistory(match);
  assert.ok(text.includes('alice'));
  assert.ok(text.includes('cooperate'));
  assert.ok(text.includes('0-5'));
  assert.ok(text.includes('1-1'));
});

test('renderMoveHistory renders resource-split rounds with claims and payouts', () => {
  const match = {
    players: ['alice', 'bob'],
    result: {
      history: [
        { claims: [50, 50], payouts: [50, 50], overClaimed: false },
        { claims: [80, 80], payouts: [0, 0], overClaimed: true },
      ],
    },
  };
  const text = renderMoveHistory(match);
  assert.ok(text.includes('50-50'));
  assert.ok(text.includes('both claims rejected'));
});

test('renderMoveHistory respects the limit option for recent rounds only', () => {
  const history = Array.from({ length: 5 }, (_, i) => ({
    moves: ['cooperate', 'cooperate'],
    scores: [3, 3],
  }));
  const match = { players: ['a', 'b'], result: { history } };
  const text = renderMoveHistory(match, { limit: 2 });
  const dataLines = text.split('\n').slice(2);
  assert.strictEqual(dataLines.length, 2);
  // the last round shown should be numbered 5, the round count, not 1 or 2
  assert.ok(dataLines[dataLines.length - 1].trim().startsWith('5'));
});

test('renderBracket marks pending vs completed pairings', () => {
  const agentNames = ['alice', 'bob', 'carol'];
  const pairings = [
    [0, 1],
    [0, 2],
  ];
  const completed = new Map([[pairKey(0, 1), [10, 4]]]);
  const text = renderBracket(agentNames, pairings, completed);

  assert.ok(text.includes('alice 10 > 4 bob'));
  assert.ok(text.includes('alice vs carol'));
  assert.ok(text.includes('pending'));
});

test('renderFrame assembles title, standings, bracket and latest match into one string', () => {
  const frame = renderFrame({
    title: 'Agent Arena',
    standings: [{ name: 'alice', wins: 1, losses: 0, draws: 0, points: 10 }],
    agentNames: ['alice', 'bob'],
    pairings: [[0, 1]],
    completedByPair: new Map([[pairKey(0, 1), [10, 2]]]),
    latestMatch: {
      players: ['alice', 'bob'],
      indexA: 0,
      indexB: 1,
      result: { history: [{ moves: ['cooperate', 'defect'], scores: [0, 5] }] },
    },
    matchNumber: 1,
    totalMatches: 1,
  });

  assert.ok(frame.includes('Agent Arena'));
  assert.ok(frame.includes('Standings:'));
  assert.ok(frame.includes('Bracket:'));
  assert.ok(frame.includes('Latest match: alice vs bob'));
  assert.ok(frame.includes('Match 1 / 1'));
});
