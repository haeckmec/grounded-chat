/**
 * Runs the scripted conversation on the dummy adapter and prints the transcript: what a user sees,
 * every figure already through the guard. Exits non-zero if a reply does not match.
 */
import { InMemoryChatStore, runTurn } from '@haeckmec/grounded-chat';
import { createKbDummy } from '../src/dummy.js';
import { kbPack, type RecipeSnapshot } from '../src/pack.js';

export const SCRIPT: Array<[user: string, expected: string]> = [
  ['hello', 'Which blend would you like: Harbour Mist, Ember Chai, Lantern Riff?'],
  ['Harbour Mist please', 'Harbour Mist: 2 tsp green tea, 1 tsp mint, 250 ml water; steep 3 minutes.'],
  ['what can I use instead of mint?', 'Instead of mint: lemon balm or basil.'],
  ['how much for a big pot, roughly?', "Roughly a measure I can't confirm and a measure I can't confirm, I would guess."],
  ['tell me about Lantern Riff', 'Lantern Riff (untested riff): 3 tsp rooibos, 1 tsp orange peel, 250 ml water; steep 6 minutes.'],
];

export async function runScript(): Promise<Array<[string, string]>> {
  const store = new InMemoryChatStore<RecipeSnapshot>();
  const { id } = await store.createSession(null);
  const llm = createKbDummy();
  const transcript: Array<[string, string]> = [];
  for (const [user] of SCRIPT) {
    const result = await runTurn({ llm, store, pack: kbPack(), sessionId: id, userMessage: user });
    transcript.push([user, result.reply]);
  }
  return transcript;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const transcript = await runScript();
  let failed = 0;
  for (const [index, [user, reply]] of transcript.entries()) {
    const ok = reply === SCRIPT[index]![1];
    if (!ok) failed++;
    process.stdout.write(`user: ${user}\nassistant: ${reply}${ok ? '' : `\n  expected: ${SCRIPT[index]![1]}`}\n\n`);
  }
  process.stdout.write(failed ? `${failed} reply(ies) did not match.\n` : 'The scripted conversation matched.\n');
  process.exitCode = failed ? 1 : 0;
}
