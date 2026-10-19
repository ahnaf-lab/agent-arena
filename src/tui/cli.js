#!/usr/bin/env node
// Spectator entry point: `node src/tui/cli.js <game> <bot> <bot> [bot...]`
// builds one agent per bot name/seed and broadcasts a full round-robin
// tournament between them to the terminal.
//
// Examples:
//   node src/tui/cli.js prisonersDilemma titForTat alwaysDefect grimTrigger
//   node src/tui/cli.js resourceSplit fairSplitter greedySplitter randomSplitter:7
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

export function parseArgs(argv) {
  const [gameName, ...botSpecs] = argv.length === 0 ? DEFAULT_DEMO : argv;
  if (!gameName || !GAMES[gameName]) {
    throw new Error(`usage: cli.js <${Object.keys(GAMES).join('|')}> <bot> <bot> [bot...]`);
  }
  if (botSpecs.length < 2) {
    throw new Error('at least two bots are required to run a tournament');
  }
  return { gameName, botSpecs };
}

export async function main(argv, { screen = createScreen(), delayMs = 400 } = {}) {
  const { gameName, botSpecs } = parseArgs(argv);
  const { engine, bots, defaultRounds } = GAMES[gameName];
  const agents = botSpecs.map((spec) => buildBot(bots, spec));

  const { standings } = await runBroadcast(agents, engine, defaultRounds, {
    title: `Agent Arena -- ${gameName}`,
    delayMs,
    screen,
  });

  return standings;
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
