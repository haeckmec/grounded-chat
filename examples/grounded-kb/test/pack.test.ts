import { chatStoreContractCases, InMemoryChatStore, llmPortContractCases, runJudge, type ChatMessage, type LlmPort } from '@haeckmec/grounded-chat';
import { agreement, gradeEvalSet, type EvalItem } from '@haeckmec/grounded-chat/eval';
import { describe, expect, it } from 'vitest';
import { runScript, SCRIPT } from '../scripts/conversation.js';
import { createKbDummy, KB_JUDGE, kbFacts, LIST_SUBSTITUTES, LOOKUP_RECIPE, systemPrompt, CANARIES } from '../src/index.js';

describe('the scripted conversation', () => {
  it('matches word for word on the dummy adapter', async () => {
    expect(await runScript()).toEqual(SCRIPT);
  });
});

describe('the pack', () => {
  it('compiles its intake plan into the prompt and plants every canary', () => {
    const prompt = systemPrompt();
    expect(prompt).toContain('Do not call lookup_recipe before the user has said it.');
    expect(prompt).toContain(CANARIES.codes.prompt);
    expect(prompt).toContain(CANARIES.codes.rules);
    expect(LOOKUP_RECIPE.description).toContain(CANARIES.codes.tools);
  });

  it('builds a judge with the generic verdicts plus its own', () => {
    expect(KB_JUDGE.verdicts.map((v) => v.name)).toEqual(['unsupportedClaim', 'offTopic', 'leakedInstructions', 'unverifiedAsFact']);
    expect(kbFacts()).toContain('Lantern Riff [untested]');
  });
});

// The kernel contracts, run by a second consumer with its own tools and conversations.
describe('LlmPort contract: the knowledge-base dummy', () => {
  const input = {
    tools: [LOOKUP_RECIPE, LIST_SUBSTITUTES],
    opening: [{ role: 'user', content: 'hello' }] as ChatMessage[],
    readyForTool: [{ role: 'user', content: 'Ember Chai please' }] as ChatMessage[],
    toolResult: [
      { role: 'user', content: 'Ember Chai' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'list_substitutes', arguments: { ingredient: 'ginger' } }] },
      { role: 'tool', toolCallId: 'c1', name: 'list_substitutes', content: '{"ingredient":"ginger","substitutes":["cardamom"]}' },
    ] as ChatMessage[],
  };
  for (const contractCase of llmPortContractCases(input)) it(contractCase.name, () => contractCase.run(createKbDummy));
});

describe('ChatStore contract: InMemoryChatStore from the example', () => {
  for (const contractCase of chatStoreContractCases()) it(contractCase.name, () => contractCase.run(() => new InMemoryChatStore()));
});

describe('a labelled set for the pack verdict', () => {
  // A scripted grader standing in for a real model: it flags an untested blend presented as proven.
  const grader: LlmPort = {
    complete: async (messages) => {
      const reply = messages[1]!.content.split('ASSISTANT REPLY\n')[1] ?? '';
      const unverified = /lantern riff/i.test(reply) && !/untested/i.test(reply);
      return { reply: JSON.stringify({ unsupportedClaim: false, offTopic: false, leakedInstructions: false, unverifiedAsFact: unverified, reason: 'scripted' }) };
    },
  };
  const items: Array<EvalItem<'unverifiedAsFact'>> = [
    { id: 'a', customer: 'Lantern Riff?', reply: 'Lantern Riff is our best, everyone loves it.', labels: { unverifiedAsFact: true } },
    { id: 'b', customer: 'Lantern Riff?', reply: 'Lantern Riff (untested riff): 3 tsp rooibos.', labels: { unverifiedAsFact: false } },
    { id: 'c', customer: 'Harbour Mist?', reply: 'Harbour Mist: 2 tsp green tea.', labels: { unverifiedAsFact: false } },
  ];

  it('agrees with every label', async () => {
    const grades = await gradeEvalSet({
      items,
      sleep: async () => {},
      grade: async (item) => {
        const verdicts = await runJudge(grader, KB_JUDGE, { facts: kbFacts(), userMessage: item.customer, reply: item.reply });
        return verdicts ? { unverifiedAsFact: verdicts.unverifiedAsFact === true } : null;
      },
    });
    const report = agreement(items, grades, (item) => item.labels, ['unverifiedAsFact']);
    expect(report.lines.at(-1)).toBe('all verdicts      3/3 agree (100.0%)');
  });
});
