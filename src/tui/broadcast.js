// Live broadcast driver: runs a round-robin tournament and redraws the
// screen after every completed match, like a chess broadcast updating its
// board after each move. The actual match play is instantaneous (the game
// engines are synchronous/deterministic); `delayMs` just paces the redraws
// so a human spectator can follow along instead of seeing a single final
// frame.

import { buildPairings, runRoundRobin } from '../tournament/roundRobin.js';
import { renderFrame, pairKey } from './render.js';

function wait(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBroadcast(agents, game, rounds, options = {}) {
  const { title = 'Agent Arena', delayMs = 0, screen = null, gameOptions = {} } = options;
  const agentNames = agents.map((agent) => agent.name ?? 'agent');
  const pairings = buildPairings(agents);
  const completedByPair = new Map();

  const draw = (frameState) => {
    if (screen) screen.draw(renderFrame(frameState));
  };

  draw({ title, standings: [], agentNames, pairings, completedByPair });
  await wait(delayMs);

  const { matches, standings } = await runRoundRobin(agents, game, rounds, {
    gameOptions,
    onMatchComplete: async ({ match, matchNumber, totalMatches, standings: liveStandings }) => {
      completedByPair.set(pairKey(match.indexA, match.indexB), match.result.totalScores);
      draw({
        title,
        standings: liveStandings,
        agentNames,
        pairings,
        completedByPair,
        latestMatch: match,
        matchNumber,
        totalMatches,
      });
      await wait(delayMs);
    },
  });

  return { matches, standings };
}
