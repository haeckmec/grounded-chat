import { describe, expect, it } from 'vitest';
import { llmPortContractCases, type LlmPort } from '../../src/index.js';
import { CONTRACT_INPUT } from '../helpers/contract.js';

const run = async (port: LlmPort) => {
  const failures: string[] = [];
  for (const contractCase of llmPortContractCases(CONTRACT_INPUT)) {
    await contractCase.run(() => port).catch((error: Error) => failures.push(error.message));
  }
  return failures;
};

describe('llmPortContractCases', () => {
  it('fails an adapter that returns neither a reply nor tool calls', async () => {
    expect((await run({ complete: async () => ({}) })).join('\n')).toMatch(/neither a reply nor tool calls/);
  });

  it('fails an adapter that calls a tool the pack does not have', async () => {
    const port: LlmPort = { complete: async () => ({ toolCalls: [{ id: 'a', name: 'unknown_tool', arguments: {} }] }) };
    expect((await run(port)).join('\n')).toMatch(/unknown tool "unknown_tool"/);
  });

  it('fails a stream whose deltas do not join to the reply', async () => {
    const port: LlmPort = {
      complete: async () => ({ reply: 'ok' }),
      async *stream() {
        yield { type: 'text', text: 'o' };
        yield { type: 'done', turn: { reply: 'ok!' } };
      },
    };
    expect((await run(port)).join('\n')).toMatch(/do not join/);
  });
});
