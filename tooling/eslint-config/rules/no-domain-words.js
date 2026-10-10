/**
 * Flags domain vocabulary in identifiers, strings, templates, JSX text and
 * comments. The SDK must stay domain-free so any pack can use it; packs bring
 * their own words. Matching is per word after splitting camelCase, snake_case
 * and kebab-case, so `toolbar` passes while `progressBar` and `quote_id` fail.
 */

export const DEFAULT_WORDS = ['insurance', 'premium', 'quote', 'rate table', 'cocktail', 'bar', 'drink'];

/** Splits text into lowercase words on case changes and non-letters. */
export function toWords(text) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

const sameWord = (word, banned) => word === banned || word === `${banned}s` || word === `${banned}es`;

/** Returns the first banned phrase found in `text`, or null. */
export function findDomainWord(text, phrases = DEFAULT_WORDS) {
  const words = toWords(text);
  for (const phrase of phrases) {
    const parts = phrase.split(' ');
    for (let i = 0; i + parts.length <= words.length; i++) {
      const hit = parts.every((part, j) =>
        j === parts.length - 1 ? sameWord(words[i + j], part) : words[i + j] === part,
      );
      if (hit) return phrase;
    }
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow domain vocabulary in the domain-free SDK source.' },
    schema: [{ type: 'object', properties: { words: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }],
    messages: { domainWord: 'Domain word "{{word}}" in SDK source. Packs bring their own vocabulary.' },
  },
  create(context) {
    const phrases = context.options[0]?.words ?? DEFAULT_WORDS;
    const check = (node, text) => {
      if (typeof text !== 'string') return;
      const word = findDomainWord(text, phrases);
      if (word) context.report({ node, messageId: 'domainWord', data: { word } });
    };
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) check(comment, comment.value);
      },
      Identifier: (node) => check(node, node.name),
      PrivateIdentifier: (node) => check(node, node.name),
      JSXIdentifier: (node) => check(node, node.name),
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.cooked),
      JSXText: (node) => check(node, node.value),
    };
  },
};
