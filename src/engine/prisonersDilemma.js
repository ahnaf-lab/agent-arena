// Iterated Prisoner's Dilemma engine.
//
// An agent is anything with a `chooseMove(history, playerIndex)` method that
// returns 'cooperate' or 'defect'. `history` is the array of completed
// rounds so far, each `{ moves: [moveA, moveB], scores: [scoreA, scoreB] }`.
// Agents only ever see completed rounds, never the opponent's current move,
// so outcomes depend solely on the agents' own logic and the fixed payoff
// matrix below -- no hidden randomness in the engine itself.

export const MOVES = Object.freeze({
  COOPERATE: 'cooperate',
  DEFECT: 'defect',
});

// [row player's payoff, column player's payoff] indexed by [rowMove][colMove].
export const DEFAULT_PAYOFF_MATRIX = Object.freeze({
  cooperate: Object.freeze({ cooperate: [3, 3], defect: [0, 5] }),
  defect: Object.freeze({ cooperate: [5, 0], defect: [1, 1] }),
});

function validateMove(move, agentLabel) {
  if (move !== MOVES.COOPERATE && move !== MOVES.DEFECT) {
    throw new Error(
      `${agentLabel} returned an invalid move: ${JSON.stringify(move)}`
    );
  }
  return move;
}

// chooseMove may return a move directly or a Promise of one -- the latter is
// what an MCP-speaking agent looks like, since its answer comes back over an
// out-of-process RPC round trip. Awaiting a non-Promise value resolves
// immediately, so in-process bots are unaffected.
export async function playRound(agentA, agentB, history, payoffMatrix) {
  const moveA = validateMove(await agentA.chooseMove(history, 0), agentA.name ?? 'agentA');
  const moveB = validateMove(await agentB.chooseMove(history, 1), agentB.name ?? 'agentB');
  const [scoreA, scoreB] = payoffMatrix[moveA][moveB];
  return { moves: [moveA, moveB], scores: [scoreA, scoreB] };
}

export async function runMatch(agentA, agentB, rounds, options = {}) {
  const payoffMatrix = options.payoffMatrix ?? DEFAULT_PAYOFF_MATRIX;
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new Error('rounds must be a positive integer');
  }

  const history = [];
  for (let i = 0; i < rounds; i++) {
    history.push(await playRound(agentA, agentB, history, payoffMatrix));
  }

  const totals = history.reduce(
    (acc, round) => [acc[0] + round.scores[0], acc[1] + round.scores[1]],
    [0, 0]
  );

  return {
    history,
    totalScores: totals,
    players: [agentA.name ?? 'agentA', agentB.name ?? 'agentB'],
  };
}
