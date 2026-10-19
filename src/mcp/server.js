// A minimal MCP-style JSON-RPC 2.0 server over stdio. It wraps a single
// agent object (anything with chooseMove / chooseClaim, such as one of the
// scripted bots) and answers the standard MCP methods -- initialize,
// tools/list, tools/call -- using the contract defined in schema.js.
//
// Messages are newline-delimited JSON, one object per line. That is a
// simplification of the reference MCP transport's Content-Length framing,
// but it carries the exact same jsonrpc/method/params/result shapes, so a
// tool implementation written against this server ports to the full spec
// unchanged. No network socket is opened anywhere in this file -- agents are
// addressed purely over local process stdio.

import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { TOOLS, PROTOCOL_VERSION, validateMoveResult, validateClaimResult } from './schema.js';
import * as prisonersDilemmaBots from '../bots/prisonersDilemmaBots.js';
import * as resourceSplitBots from '../bots/resourceSplitBots.js';

async function callTool(agent, name, args) {
  if (name === 'choose_move') {
    if (typeof agent.chooseMove !== 'function') {
      throw new Error('agent does not implement chooseMove');
    }
    const move = await agent.chooseMove(args.history ?? [], args.playerIndex);
    validateMoveResult({ move });
    return { move };
  }
  if (name === 'choose_claim') {
    if (typeof agent.chooseClaim !== 'function') {
      throw new Error('agent does not implement chooseClaim');
    }
    const claim = await agent.chooseClaim(args.pool, args.history ?? [], args.playerIndex);
    validateClaimResult({ claim }, args.pool);
    return { claim };
  }
  throw new Error(`unknown tool: ${name}`);
}

export function startServer({ agent, serverName, input = process.stdin, output = process.stdout }) {
  const rl = createInterface({ input, crlfDelay: Infinity });

  function respond(id, result) {
    output.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
  }

  function respondError(id, message) {
    output.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } }) + '\n');
  }

  rl.on('line', async (line) => {
    if (!line.trim()) return;

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return; // malformed input carries no id, so there is nothing to reply to
    }

    const { id, method, params } = message;
    try {
      if (method === 'initialize') {
        respond(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: serverName ?? agent.name ?? 'agent-arena-bot', version: '0.1.0' },
        });
      } else if (method === 'tools/list') {
        respond(id, { tools: TOOLS });
      } else if (method === 'tools/call') {
        const { name, arguments: toolArgs } = params ?? {};
        const payload = await callTool(agent, name, toolArgs ?? {});
        respond(id, { content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false });
      } else {
        respondError(id, `unknown method: ${method}`);
      }
    } catch (err) {
      respondError(id, err.message);
    }
  });

  return rl;
}

const BOT_FACTORIES = {
  prisonersDilemma: prisonersDilemmaBots,
  resourceSplit: resourceSplitBots,
};

export function resolveBot(game, spec) {
  const factories = BOT_FACTORIES[game];
  if (!factories) {
    throw new Error(`unknown game: ${game} (expected prisonersDilemma or resourceSplit)`);
  }
  const [botName, seedText] = spec.split(':');
  const factory = factories[botName];
  if (typeof factory !== 'function') {
    throw new Error(`unknown bot "${botName}" for game "${game}"`);
  }
  return seedText !== undefined ? factory(Number(seedText)) : factory();
}

function isEntryPoint() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isEntryPoint()) {
  const [, , game, botSpec] = process.argv;
  if (!game || !botSpec) {
    process.stderr.write(
      'usage: node src/mcp/server.js <prisonersDilemma|resourceSplit> <botName>[:seed]\n'
    );
    process.exit(1);
  }
  const agent = resolveBot(game, botSpec);
  startServer({ agent, serverName: agent.name });
}
