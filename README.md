# agent-arena

A terminal spectator app that runs deterministic multiplayer games between
any MCP-speaking agents, rendering live standings and move history like a
chess broadcast. Ships with scripted bots so a full tournament can be
watched with zero API keys, then real agents can be swapped in.

This repository currently contains the game engine -- deterministic
iterated Prisoner's Dilemma and resource-splitting games, plus a set of
scripted bots -- a minimal MCP tool contract that lets any MCP-speaking
agent submit moves against that engine from its own process, a terminal
broadcast that runs a round-robin tournament between any set of agents
and redraws a live score table, bracket, and round-by-round move history
after each match, and a replay format that saves a finished tournament
to a JSON file and can redraw it frame-by-frame later with no agents and
no game logic involved, all backed by a fixed-seed test suite.

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
always reproduces the exact same match history. Both methods may return
their result directly or as a Promise -- `runMatch` is async and awaits
either form, which is what makes it possible to play against an agent
living in a separate process (see below).

### MCP tool contract

Any MCP-speaking agent can submit moves against the engine over a small
JSON-RPC tool contract (`src/mcp/schema.js`), exposing two tools:

- `choose_move({ history, playerIndex })` -> `{ move: 'cooperate' | 'defect' }`
- `choose_claim({ pool, history, playerIndex })` -> `{ claim: integer }`

`src/mcp/server.js` runs this contract over stdio for a single agent. It
can be pointed at any of the shipped scripted bots and run as a
standalone process:

```
node src/mcp/server.js prisonersDilemma titForTat
node src/mcp/server.js resourceSplit randomSplitter:42
```

`src/mcp/client.js` is the other side: it spawns a command as a child
process and wraps it as an ordinary agent object, so it plugs straight
into `runMatch`:

```js
import { createMcpAgent } from './src/mcp/client.js';
import { runMatch } from './src/engine/prisonersDilemma.js';
import { alwaysCooperate } from './src/bots/prisonersDilemmaBots.js';

const remoteAgent = createMcpAgent({
  command: 'node',
  args: ['src/mcp/server.js', 'prisonersDilemma', 'titForTat'],
});

const result = await runMatch(alwaysCooperate(), remoteAgent, 5);
console.log(result.totalScores);
remoteAgent.close();
```

The wire format is newline-delimited JSON-RPC 2.0 over the child's
stdin/stdout -- a simplification of the reference MCP transport's
Content-Length framing, but the same `method`/`params`/`result` shapes, so
a tool written against this contract needs no changes to speak the full
spec. No network socket is involved; everything happens over local
process stdio, exactly as described here.

### Terminal broadcast

`src/tui/cli.js` runs a full round-robin tournament between any set of
scripted bots and broadcasts it to the terminal, redrawing a live score
table, a bracket of every pairing (pending vs. done), and the
round-by-round move history of the most recently finished match -- one
frame per completed match, like a chess broadcast updating its board
after each move:

```
npm start -- prisonersDilemma titForTat alwaysDefect grimTrigger
npm start -- resourceSplit fairSplitter greedySplitter randomSplitter:7
```

Run it with no arguments at all (`npm start` or `npm run demo`) and it
falls back to a zero-config demo tournament: iterated Prisoner's Dilemma
between the four built-in bots -- `titForTat`, `randomBot`, `grimTrigger`,
`alwaysCooperate` -- so a full broadcast can be watched with nothing but
`npm install`, no API keys or extra arguments required.

The first argument picks the game (`prisonersDilemma` or
`resourceSplit`), the rest name the bots from that game's bot module
(`src/bots/*.js`); bots that take a seed can be given as `name:seed`.
Rendering is a plain-text table layout drawn with ANSI clear-screen and
cursor-home escape codes -- no terminal UI dependency, since the layout
is just padded columns and a redraw is just "clear and print again."
`src/tui/render.js` builds each frame as a pure string so the layout can
be unit tested without a real terminal; `src/tui/screen.js` is the only
module that writes to the terminal, and `src/tui/broadcast.js` paces the
redraws against `src/tournament/roundRobin.js`, which plays every unique
pairing of agents once and ranks the resulting standings.

### Replays

Any tournament run through `src/tui/cli.js` can also be saved as a replay
by adding `--save-replay <name>` anywhere in the arguments:

```
npm start -- prisonersDilemma titForTat alwaysDefect grimTrigger --save-replay my-tournament
```

This writes `replays/my-tournament.json` -- a plain JSON file holding one
frame per completed match (the same data the live broadcast drew to the
screen as it went), plus enough metadata (game name, round count, agent
names, pairings) to redraw it later without re-running any agent. A bare
name like `my-tournament` is always confined to the `replays/` directory;
an explicit path (one containing a `/`) is used as-is.

Watch a saved replay back with:

```
node src/replay/cli.js my-tournament
```

This redraws the exact same sequence of frames the live broadcast showed
the first time, purely from the recorded file -- `src/replay/render.js` is
a pure function from replay data to frame text, which is what makes it
possible to golden-test: a fixed-seed replay's rendered output is checked
byte-for-byte against a known-good string in `test/replay.test.js`, so any
unintended change to the frame layout fails the suite.

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
