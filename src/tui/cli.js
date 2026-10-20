#!/usr/bin/env node
// Spectator entry point: `node src/tui/cli.js <game> <bot> <bot> [bot...]`
// builds one agent per bot name/seed and broadcasts a full round-robin
// tournament between them to the terminal.
//
// Examples:
//   node src/tui/cli.js prisonersDilemma titForTat alwaysDefect grimTrigger
//   node src/tui/cli.js resourceSplit fairSplitter greedySplitter randomSplitter:7
//
// Add `--save-replay <name>` anywhere in the arguments to also write the
// finished tournament to replays/<name>.json (see src/replay/), so it can
// be watched again later with `node src/replay/cli.js <name>` without
// re-running any agent.
//
// Add `--agent <name> <command> [arg...]` one or more times to seat an
// external MCP-speaking agent (any process implementing the tool contract
// in src/mcp/schema.js) as an additional player alongside the named bots.
// The command is spawned directly (never through a shell), exactly as
// src/mcp/client.js documents; everything after the command, up to the
// next `--agent`/`--save-replay` flag or the end of the arguments, is
// passed to it as argv. For example, to seat the reference bot server
// itself as an external player:
//   node src/tui/cli.js prisonersDilemma titForTat \
//     --agent remote node src/mcp/server.js prisonersDilemma grimTrigger
//
// Run with no arguments at all and it falls back to DEFAULT_DEMO below, a
// zero-config Prisoner's Dilemma tournament between the four built-in bots
// -- the "watch it work with no API keys" path.

import * as prisonersDilemma from '../engine/prisonersDilemma.js';
import * as resourceSplit from '../engine/resourceSplit.js';
import * as prisonersDilemmaBots from '../bots/prisonersDilemmaBots.js';
import * as resourceSplitBots from '../bots/resourceSplitBots.js';
import { createScreen } from './screen.js';
import { runBroadcast } from './broadcast.js';
import { buildPairings } from '../tournament/roundRobin.js';
import { buildReplay } from '../replay/record.js';
import { saveReplay } from '../replay/store.js';
import { createMcpAgent } from '../mcp/client.js';

const GAMES = {
  prisonersDilemma: { engine: prisonersDilemma, bots: prisonersDilemmaBots, defaultRounds: 10 },
  resourceSplit: { engine: resourceSplit, bots: resourceSplitBots, defaultRounds: 10 },
};

// The no-API-key demo: four scripted bots playing iterated Prisoner's
// Dilemma, requiring nothing but `npm start`.
export const DEFAULT_DEMO = ['prisonersDilemma', 'titForTat', 'randomBot:1', 'grimTrigger', 'alwaysCooperate'];

function buildBot(bots, spec) {
  const [botName, rawSeed] = spec.split(':');
  const factory = bots[botName];
  if (typeof factory !== 'function') {
    throw new Error(`unknown bot "${botName}" (available: ${Object.keys(bots).join(', ')})`);
  }
  if (rawSeed === undefined) return factory();
  const seed = Number(rawSeed);
  if (!Number.isInteger(seed)) {
    throw new Error(`seed in "${spec}" must be an integer`);
  }
  return factory(seed);
}

const ARG_FLAGS = ['--agent', '--save-replay'];

export function parseArgs(argv) {
  const args = [...argv];
  let replayName = null;
  const replayFlagIndex = args.indexOf('--save-replay');
  if (replayFlagIndex !== -1) {
    replayName = args[replayFlagIndex + 1];
    if (!replayName) {
      throw new Error('--save-replay requires a file name');
    }
    args.splice(replayFlagIndex, 2);
  }

  const externalAgents = [];
  let agentFlagIndex;
  while ((agentFlagIndex = args.indexOf('--agent')) !== -1) {
    const name = args[agentFlagIndex + 1];
    const command = args[agentFlagIndex + 2];
    if (!name || !command) {
      throw new Error('--agent requires a name and a command, e.g. --agent remote node server.js');
    }
    let end = agentFlagIndex + 3;
    while (end < args.length && !ARG_FLAGS.includes(args[end])) end++;
    const commandArgs = args.slice(agentFlagIndex + 3, end);
    externalAgents.push({ name, command, args: commandArgs });
    args.splice(agentFlagIndex, end - agentFlagIndex);
  }

  const [gameName, ...botSpecs] = args.length === 0 ? DEFAULT_DEMO : args;
  if (!gameName || !GAMES[gameName]) {
    throw new Error(
      `usage: cli.js <${Object.keys(GAMES).join('|')}> <bot> <bot> [bot...] ` +
        '[--agent <name> <command> [arg...]] [--save-replay <name>]'
    );
  }
  if (botSpecs.length + externalAgents.length < 2) {
    throw new Error('at least two agents are required to run a tournament');
  }
  return { gameName, botSpecs, externalAgents, replayName };
}

export async function main(argv, { screen = createScreen(), delayMs = 400 } = {}) {
  const { gameName, botSpecs, externalAgents, replayName } = parseArgs(argv);
  const { engine, bots, defaultRounds } = GAMES[gameName];
  const agents = [
    ...botSpecs.map((spec) => buildBot(bots, spec)),
    ...externalAgents.map(({ name, command, args }) => createMcpAgent({ command, args, name })),
  ];
  const title = `Agent Arena -- ${gameName}`;

  try {
    const { standings, frames } = await runBroadcast(agents, engine, defaultRounds, {
      title,
      delayMs,
      screen,
    });

    if (replayName) {
      const replay = buildReplay({
        title,
        gameName,
        rounds: defaultRounds,
        agentNames: agents.map((agent) => agent.name ?? 'agent'),
        pairings: buildPairings(agents),
        frames,
        standings,
      });
      saveReplay(replay, replayName);
    }

    return standings;
  } finally {
    for (const agent of agents) {
      if (typeof agent.close === 'function') agent.close();
    }
  }
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
