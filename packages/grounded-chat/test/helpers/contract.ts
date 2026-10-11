import { describe, it } from 'vitest';
import { llmPortContractCases, type ChatMessage, type LlmPort, type ToolSchema } from '../../src/index.js';

/** A synthetic tool the contract scenarios and the adapter tests call. */
export const LOOKUP_TOOL: ToolSchema = {
  name: 'lookup_record',
  description: 'Look up a synthetic record by city and age. Internal reference QX-LANTERN-5519.',
  parameters: {
    type: 'object',
    properties: { city: { type: 'string' }, age: { type: 'integer' } },
    required: ['city', 'age'],
  },
};

export const CONTRACT_INPUT = {
  tools: [LOOKUP_TOOL],
  opening: [{ role: 'user', content: 'hello, can you help me look something up?' }] as ChatMessage[],
  readyForTool: [{ role: 'user', content: 'Lisbon, 22, please look it up' }] as ChatMessage[],
  toolResult: [
    { role: 'user', content: 'Lisbon, 22' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'lookup_record', arguments: {} }] },
    { role: 'tool', toolCallId: 'call_1', name: 'lookup_record', content: JSON.stringify({ total: 1676.0, unit: 'EUR' }) },
  ] as ChatMessage[],
};

/** Registers the exported contract with vitest, the way a consumer would. */
export function runLlmPortContractTests(name: string, makeAdapter: () => LlmPort): void {
  describe(`LlmPort contract: ${name}`, () => {
    for (const contractCase of llmPortContractCases(CONTRACT_INPUT)) {
      it(contractCase.name, () => contractCase.run(makeAdapter));
    }
  });
}
