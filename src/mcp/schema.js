// The MCP tool contract: the fixed shapes that let any MCP-speaking agent
// submit a move per round against the engine, independent of what language
// or process that agent runs in. Two tools, one per game, each a thin
// wrapper over the corresponding bot method (chooseMove / chooseClaim).

export const PROTOCOL_VERSION = '2024-11-05';

export const TOOLS = Object.freeze([
  Object.freeze({
    name: 'choose_move',
    description:
      "Choose this agent's move for the next round of iterated Prisoner's Dilemma.",
    inputSchema: Object.freeze({
      type: 'object',
      properties: {
        history: { type: 'array' },
        playerIndex: { type: 'integer', enum: [0, 1] },
      },
      required: ['history', 'playerIndex'],
    }),
  }),
  Object.freeze({
    name: 'choose_claim',
    description:
      "Choose this agent's claim for the next round of the resource-split game.",
    inputSchema: Object.freeze({
      type: 'object',
      properties: {
        pool: { type: 'integer' },
        history: { type: 'array' },
        playerIndex: { type: 'integer', enum: [0, 1] },
      },
      required: ['pool', 'history', 'playerIndex'],
    }),
  }),
]);

export function validateMoveResult(result) {
  if (!result || (result.move !== 'cooperate' && result.move !== 'defect')) {
    throw new Error(
      `choose_move must return { move: 'cooperate' | 'defect' }, got ${JSON.stringify(result)}`
    );
  }
  return result.move;
}

export function validateClaimResult(result, pool) {
  if (!result || !Number.isInteger(result.claim) || result.claim < 0 || result.claim > pool) {
    throw new Error(
      `choose_claim must return { claim: integer in [0, pool] }, got ${JSON.stringify(result)}`
    );
  }
  return result.claim;
}
