// Wraps the frames produced by a finished broadcast (see
// src/tui/broadcast.js's runBroadcast, which now returns its frame list
// alongside matches/standings) into a plain, JSON-serializable replay
// object -- enough to re-render every frame later with no agents and no
// game logic involved, just the recorded data.

export const REPLAY_FORMAT_VERSION = 1;

export function buildReplay({ title, gameName, rounds, agentNames, pairings, frames, standings }) {
  if (!Array.isArray(frames)) {
    throw new Error('buildReplay requires a frames array');
  }
  if (!Array.isArray(agentNames) || !Array.isArray(pairings)) {
    throw new Error('buildReplay requires agentNames and pairings arrays');
  }
  return {
    version: REPLAY_FORMAT_VERSION,
    title,
    gameName,
    rounds,
    agentNames,
    pairings,
    frames,
    finalStandings: standings,
  };
}
