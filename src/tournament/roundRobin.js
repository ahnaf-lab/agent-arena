// Round-robin tournament bracket: every agent plays every other agent
// exactly once, using whichever game engine (prisonersDilemma or
// resourceSplit) is passed in. Standings are ranked by total points
// (summed score across all of an agent's matches), with wins used only
// as a tiebreaker, since the two game engines don't share a notion of
// "win" beyond comparing each match's own totalScores.

export function buildPairings(agentNames) {
  if (agentNames.length < 2) {
    throw new Error('a tournament needs at least two agents');
  }
  const pairings = [];
  for (let i = 0; i < agentNames.length; i++) {
    for (let j = i + 1; j < agentNames.length; j++) {
      pairings.push([i, j]);
    }
  }
  return pairings;
}

function emptyStanding(name) {
  return { name, wins: 0, losses: 0, draws: 0, points: 0 };
}

function applyMatchToStandings(standings, indexA, indexB, totalScores) {
  standings[indexA].points += totalScores[0];
  standings[indexB].points += totalScores[1];
  if (totalScores[0] > totalScores[1]) {
    standings[indexA].wins += 1;
    standings[indexB].losses += 1;
  } else if (totalScores[1] > totalScores[0]) {
    standings[indexB].wins += 1;
    standings[indexA].losses += 1;
  } else {
    standings[indexA].draws += 1;
    standings[indexB].draws += 1;
  }
}

export function rankStandings(standings) {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });
}

// Runs every pairing in sequence, calling `onMatchComplete` after each one
// so a caller (the TUI driver) can redraw standings/bracket as the
// tournament progresses, rather than only seeing the final result.
export async function runRoundRobin(agents, game, rounds, options = {}) {
  const { onMatchComplete, gameOptions = {} } = options;
  const pairings = buildPairings(agents);
  const standings = agents.map((agent) => emptyStanding(agent.name ?? 'agent'));
  const matches = [];

  for (const [indexA, indexB] of pairings) {
    const agentA = agents[indexA];
    const agentB = agents[indexB];
    const result = await game.runMatch(agentA, agentB, rounds, gameOptions);
    applyMatchToStandings(standings, indexA, indexB, result.totalScores);

    const match = {
      indexA,
      indexB,
      players: result.players,
      result,
    };
    matches.push(match);

    if (typeof onMatchComplete === 'function') {
      await onMatchComplete({
        match,
        matchNumber: matches.length,
        totalMatches: pairings.length,
        standings: rankStandings(standings),
      });
    }
  }

  return { matches, standings: rankStandings(standings) };
}
