import type { ChatMessage, LlmTurn } from '@haeckmec/grounded-chat';
import { DummyLlmAdapter, dummyCallId } from '@haeckmec/grounded-chat/adapters/dummy';
import { RECIPES, SUBSTITUTES } from './kb.js';
import { narrate, nextQuestion, type RecipeSnapshot } from './pack.js';

/** The scripted model for this pack: what a real model would do, deterministically. */
export function kbScript(messages: ChatMessage[]): LlmTurn {
  const last = messages.at(-1);
  if (last?.role === 'tool' && last.name === 'lookup_recipe') {
    const result = JSON.parse(last.content) as RecipeSnapshot & { reason?: string };
    return { reply: result.reason ?? narrate(result) };
  }
  if (last?.role === 'tool' && last.name === 'list_substitutes') {
    const result = JSON.parse(last.content) as { ingredient: string; substitutes: string[] };
    return { reply: result.substitutes.length ? `Instead of ${result.ingredient}: ${result.substitutes.join(' or ')}.` : `I have no substitute for ${result.ingredient}.` };
  }
  const said = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const text = said.at(-1)?.toLowerCase() ?? '';
  const ingredient = Object.keys(SUBSTITUTES).find((name) => text.includes(`instead of ${name}`) || text.includes(`replace ${name}`));
  if (ingredient) return { toolCalls: [{ id: dummyCallId(), name: 'list_substitutes', arguments: { ingredient } }] };
  if (/how much|guess|roughly/.test(text)) return { reply: 'Roughly 300 ml and 4 tsp, I would guess.' };
  const named = said.flatMap((message) => RECIPES.filter((recipe) => message.toLowerCase().includes(recipe.name.toLowerCase())).map((recipe) => ({ recipe, message }))).at(-1);
  const question = nextQuestion(named ? { recipe: named.recipe.name } : {});
  if (question || !named) return { reply: question ?? 'Which blend?' };
  return { toolCalls: [{ id: dummyCallId(), name: 'lookup_recipe', arguments: { recipe: named.recipe.name, userWords: { recipe: named.message } } }] };
}

export function createKbDummy(): DummyLlmAdapter {
  return new DummyLlmAdapter(kbScript, { chunkSize: 5 });
}
