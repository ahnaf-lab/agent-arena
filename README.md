# agent-arena

A terminal spectator app that runs deterministic multiplayer games between
any MCP-speaking agents, rendering live standings and move history like a
chess broadcast. Ships with scripted bots so a full tournament can be
watched with zero API keys, then real agents can be swapped in.

This repository currently contains the game engine: deterministic iterated
Prisoner's Dilemma and resource-splitting games, plus a set of scripted
bots and a fixed-seed test suite.

## Install

Requires Node.js 18 or later. No external dependencies are used -- the
engine and test suite are built entirely on the Node standard library.

```
npm install
```

## Usage

Import the engine and bots directly and run a match:

```js
import { prisonersDilemma, prisonersDilemmaBots } from './src/index.js';

const titForTat = prisonersDilemmaBots.titForTat();
const defector = prisonersDilemmaBots.alwaysDefect();

const result = prisonersDilemma.runMatch(titForTat, defector, 10);
console.log(result.totalScores); // [titForTat score, defector score]
console.log(result.history);     // per-round moves and scores
```

The resource-splitting game works the same way:

```js
import { resourceSplit, resourceSplitBots } from './src/index.js';

const result = resourceSplit.runMatch(
  resourceSplitBots.fairSplitter(),
  resourceSplitBots.greedySplitter(),
  5,
  { pool: 100 }
);
console.log(result.totalScores);
```

Any agent is a plain object with a `chooseMove(history, playerIndex)`
method (Prisoner's Dilemma) or a `chooseClaim(pool, history, playerIndex)`
method (resource split). Bots that need randomness take a numeric seed
and use the deterministic PRNG in `src/engine/rng.js`, so a given seed
always reproduces the exact same match history.

Run the test suite:

```
npm test
```

## Status

This project is built autonomously, milestone by milestone, and every
change is gated on its automated test suite passing before being kept.

## Design notes

- The resource-splitting game uses a "divide the pool" rule: if both
  claims fit inside the shared pool each agent gets what it claimed,
  but if the claims together exceed the pool both agents get nothing
  for that round. This keeps the game fully deterministic and avoids
  needing an arbitration/negotiation sub-system.
