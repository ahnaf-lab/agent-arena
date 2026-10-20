// Deterministic rendering of a saved replay: turns the frames captured by
// a finished broadcast back into the exact same frame strings
// src/tui/render.js drew live, with no agents and no game logic re-run --
// the replay file's data alone is enough to reproduce every frame byte for
// byte, which is what makes this renderer golden-testable.

import { renderFrame, pairKey } from '../tui/render.js';

export function renderReplayFrames(replay) {
  const { title, agentNames, pairings, frames } = replay;
  const completedByPair = new Map();
  const rendered = [];

  for (const frame of frames) {
    completedByPair.set(pairKey(frame.match.indexA, frame.match.indexB), frame.match.result.totalScores);
    rendered.push(
      renderFrame({
        title,
        standings: frame.standings,
        agentNames,
        pairings,
        completedByPair,
        latestMatch: frame.match,
        matchNumber: frame.matchNumber,
        totalMatches: frame.totalMatches,
      })
    );
  }

  return rendered;
}

// The final frame is the whole tournament's outcome -- what a spectator
// who skipped straight to the end would see.
export function renderReplaySummary(replay) {
  const frames = renderReplayFrames(replay);
  if (frames.length > 0) return frames[frames.length - 1];
  return renderFrame({
    title: replay.title,
    standings: replay.finalStandings,
    agentNames: replay.agentNames,
    pairings: replay.pairings,
    completedByPair: new Map(),
  });
}
