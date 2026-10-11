import { describe, expect, it } from 'vitest';
import { applicableSlots, intakePromptLines, nextMissingSlot, unstatedSlots, userWordsSchema, type IntakePlan } from '../src/index.js';

// A synthetic booking intake: a city, a party size, and a seat preference asked only for big parties.
const PLAN: IntakePlan = {
  completionTool: 'find_table',
  slots: [
    { id: 'city', label: 'city', askHint: 'Which city?' },
    { id: 'party', label: 'party size', orderLabel: 'how many people', askHint: 'How many people?' },
    { id: 'seating', label: 'seating', askHint: 'Inside or outside?', when: (answers) => Number(answers.party) > 6 },
    { id: 'note', label: 'note', askHint: 'Anything else?', required: false },
  ],
};

describe('intakePromptLines', () => {
  it('compiles the question order and the own-words rule with generic defaults', () => {
    expect(intakePromptLines(PLAN)).toEqual([
      'Ask for one missing detail at a time (city, then how many people, then seating). Do not call find_table before the user has said all three.',
      "Never assume a detail: if the user has not said it, ask. Every find_table call carries userWords, the user's own words for each value, copied exactly; a value without such words is refused.",
    ]);
  });

  it('names what the pack chooses: the slot noun, the user, the words field and a default example', () => {
    const [order, grounding] = intakePromptLines({
      ...PLAN,
      slots: [PLAN.slots[0]!],
      slotNoun: 'search field',
      userNoun: 'guest',
      wordsField: 'guestWords',
      defaultExample: 'the nearest city',
    });
    expect(order).toBe('Ask for one missing search field at a time (city). Do not call find_table before the guest has said it.');
    expect(grounding).toBe(
      "Never assume a search field, not even an obvious default such as the nearest city: if the guest has not said it, ask. Every find_table call carries guestWords, the guest's own words for each value, copied exactly; a value without such words is refused.",
    );
  });
});

describe('userWordsSchema', () => {
  it('has one string per slot and requires the required ones', () => {
    expect(userWordsSchema(PLAN, 'The guest words.')).toEqual({
      type: 'object',
      description: 'The guest words.',
      properties: { city: { type: 'string' }, party: { type: 'string' }, seating: { type: 'string' }, note: { type: 'string' } },
      required: ['city', 'party', 'seating'],
    });
  });
});

describe('slot order', () => {
  it('asks the first required, applicable slot without an answer', () => {
    expect(nextMissingSlot(PLAN, {})?.askHint).toBe('Which city?');
    expect(nextMissingSlot(PLAN, { city: 'Lisbon' })?.id).toBe('party');
    expect(nextMissingSlot(PLAN, { city: 'Lisbon', party: 4 })).toBeUndefined();
    expect(nextMissingSlot(PLAN, { city: 'Lisbon', party: 8 })?.id).toBe('seating');
  });

  it('applies a conditional slot only when its condition holds', () => {
    expect(applicableSlots(PLAN, { party: 2 }).map((s) => s.id)).toEqual(['city', 'party', 'note']);
    expect(applicableSlots(PLAN, { party: 9 }).map((s) => s.id)).toEqual(['city', 'party', 'seating', 'note']);
  });
});

describe('unstatedSlots', () => {
  const said = ['We are in  Lisbon!', 'a table for “four people”, please'];

  it('passes words the user wrote, whatever the case, spacing, quotes or punctuation around them', () => {
    expect(unstatedSlots({ city: 'lisbon', party: '"Four people".' }, said, PLAN, { party: 4 })).toEqual([]);
  });

  it('refuses a value whose words the user never wrote, or that has no words', () => {
    expect(unstatedSlots({ city: 'Porto', party: '' }, said, PLAN).map((s) => s.label)).toEqual(['city', 'party size']);
    expect(unstatedSlots({ city: 'Lisbon' }, said, PLAN).map((s) => s.id)).toEqual(['party']);
  });

  it('checks a conditional slot only when it applies, and never an optional one', () => {
    expect(unstatedSlots({ city: 'Lisbon', party: 'four people' }, said, PLAN, { party: 8 }).map((s) => s.id)).toEqual(['seating']);
    expect(unstatedSlots({ city: 'Lisbon', party: 'four people', note: 'made up' }, said, PLAN, { party: 4 })).toEqual([]);
  });
});
