// Client side of the MCP tool contract: spawns a child process speaking the
// stdio protocol implemented in server.js and wraps it as an agent object
// (chooseMove / chooseClaim) that the engine can play against like any other
// bot. Both methods return Promises, which the engine's async runMatch
// already awaits.
//
// The child is launched with an argv array (never a shell string), so
// arguments are passed exactly as given with no shell-quoting involved.

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export function createMcpAgent({ command, args = [], name }) {
  const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });

  let nextId = 1;
  const pending = new Map();

  rl.on('line', (line) => {
    if (!line.trim()) return;
    const message = JSON.parse(line);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });

  child.on('error', (err) => {
    for (const waiter of pending.values()) waiter.reject(err);
    pending.clear();
  });

  function call(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  const ready = call('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'agent-arena', version: '0.1.0' },
  });

  async function callTool(toolName, toolArgs) {
    await ready;
    const result = await call('tools/call', { name: toolName, arguments: toolArgs });
    return JSON.parse(result.content[0].text);
  }

  return {
    name: name ?? 'mcp-agent',
    async chooseMove(history, playerIndex) {
      const { move } = await callTool('choose_move', { history, playerIndex });
      return move;
    },
    async chooseClaim(pool, history, playerIndex) {
      const { claim } = await callTool('choose_claim', { pool, history, playerIndex });
      return claim;
    },
    close() {
      rl.close();
      child.stdin.end();
      child.kill();
    },
  };
}
