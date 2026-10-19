// Resource-splitting engine ("divide the pool").
//
// Each round, both agents simultaneously claim a share of a fixed pool.
// An agent is anything with a `chooseClaim(pool, history, playerIndex)`
// method returning an integer in [0, pool]. If the claims fit inside the
// pool, each agent gets exactly what it claimed and the unclaimed remainder
// is lost. If the claims together exceed the pool, both agents get nothing
// for that round -- the classic punishment for mutual greed.

function validateClaim(claim, pool, agentLabel) {
  if (!Number.isInteger(claim) || claim < 0 || claim > pool) {
    throw new Error(
      `${agentLabel} returned an invalid claim: ${JSON.stringify(claim)} (pool=${pool})`
    );
  }
  return claim;
}

// chooseClaim may return a claim directly or a Promise of one -- the latter
// is what an MCP-speaking agent looks like, since its answer comes back over
// an out-of-process RPC round trip. Awaiting a non-Promise value resolves
// immediately, so in-process bots are unaffected.
export async function playRound(agentA, agentB, pool, history) {
  const claimA = validateClaim(
    await agentA.chooseClaim(pool, history, 0),
    pool,
    agentA.name ?? 'agentA'
  );
  const claimB = validateClaim(
    await agentB.chooseClaim(pool, history, 1),
    pool,
    agentB.name ?? 'agentB'
  );

  const overClaimed = claimA + claimB > pool;
  const payouts = overClaimed ? [0, 0] : [claimA, claimB];

  return { claims: [claimA, claimB], payouts, overClaimed };
}

export async function runMatch(agentA, agentB, rounds, options = {}) {
  const pool = options.pool ?? 100;
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new Error('rounds must be a positive integer');
  }
  if (!Number.isInteger(pool) || pool < 1) {
    throw new Error('pool must be a positive integer');
  }

  const history = [];
  for (let i = 0; i < rounds; i++) {
    history.push(await playRound(agentA, agentB, pool, history));
  }

  const totals = history.reduce(
    (acc, round) => [acc[0] + round.payouts[0], acc[1] + round.payouts[1]],
    [0, 0]
  );

  return {
    history,
    totalScores: totals,
    pool,
    players: [agentA.name ?? 'agentA', agentB.name ?? 'agentB'],
  };
}
