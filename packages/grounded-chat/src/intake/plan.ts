/** A quick reply offered under a question. */
export interface QuickReply {
  label: string;
  /** What is sent as the user's message when it is picked. */
  value: string;
  /** `explain` asks about the options rather than choosing one. */
  kind: 'option' | 'explain';
}

/** One thing the conversation collects before the completion tool runs. */
export interface IntakeSlot {
  /** The key in the completion tool's arguments and in the user's-words object. */
  id: string;
  /** How a refusal names the slot: "the user has not said their <label>". */
  label: string;
  /** How the prompt's question order names it, when it differs from `label`. */
  orderLabel?: string;
  /** The question that asks for it, word for word; the dummy adapter asks exactly this. */
  askHint: string;
  /** False for an optional slot; required by default. */
  required?: boolean;
  /** Asked only when this holds for the answers so far. */
  when?: (answers: Readonly<Record<string, unknown>>) => boolean;
  quickReplies?: QuickReply[];
}

/**
 * What to ask, in which order, and when the answers are complete. A pack without one runs free
 * question and answer. The plan compiles into the prompt's intake lines, the completion tool's
 * user's-words schema, the grounding check and the order a scripted adapter asks in.
 */
export interface IntakePlan {
  slots: IntakeSlot[];
  /** The tool that runs once every required slot is answered. */
  completionTool: string;
  /** The argument that carries the user's own words per slot; `userWords` when absent. */
  wordsField?: string;
  /** How the prompt names one slot; `detail` when absent. */
  slotNoun?: string;
  /** How the prompt names the person answering; `user` when absent. */
  userNoun?: string;
  /** An obvious default the model must still not assume, named in the prompt as an example. */
  defaultExample?: string;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function countWord(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}

/** The slots that apply given the answers so far, in plan order. */
export function applicableSlots(plan: IntakePlan, answers: object = {}): IntakeSlot[] {
  const known = answers as Readonly<Record<string, unknown>>;
  return plan.slots.filter((slot) => !slot.when || slot.when(known));
}

/** The first required, applicable slot without an answer, or undefined when the intake is complete. */
export function nextMissingSlot(plan: IntakePlan, answers: object): IntakeSlot | undefined {
  const known = answers as Readonly<Record<string, unknown>>;
  return applicableSlots(plan, known).find((slot) => slot.required !== false && known[slot.id] === undefined);
}

/**
 * The two prompt lines the plan compiles into: the question order, and the rule that every value
 * the completion tool receives carries the user's own words.
 */
export function intakePromptLines(plan: IntakePlan): [order: string, grounding: string] {
  const noun = plan.slotNoun ?? 'detail';
  const user = plan.userNoun ?? 'user';
  const field = plan.wordsField ?? 'userWords';
  const required = plan.slots.filter((slot) => slot.required !== false);
  const order = required.map((slot) => slot.orderLabel ?? slot.label).join(', then ');
  const all = required.length === 1 ? 'it' : `all ${countWord(required.length)}`;
  const example = plan.defaultExample ? `, not even an obvious default such as ${plan.defaultExample}` : '';
  return [
    `Ask for one missing ${noun} at a time (${order}). Do not call ${plan.completionTool} before the ${user} has said ${all}.`,
    `Never assume a ${noun}${example}: if the ${user} has not said it, ask. Every ${plan.completionTool} call carries ${field}, the ${user}'s own words for each value, copied exactly; a value without such words is refused.`,
  ];
}

/**
 * The JSON schema of the user's-words argument: one string per slot, every required slot required.
 * The pack puts it under its `wordsField` in the completion tool's parameters.
 */
export function userWordsSchema(plan: IntakePlan, description: string): Record<string, unknown> {
  return {
    type: 'object',
    description,
    properties: Object.fromEntries(plan.slots.map((slot) => [slot.id, { type: 'string' }])),
    required: plan.slots.filter((slot) => slot.required !== false).map((slot) => slot.id),
  };
}

function normalise(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'.,;:!?()-]+|[\s"'.,;:!?()-]+$/g, '');
}

/**
 * The slots whose cited words appear in nothing the user wrote. A model that guesses a value has
 * no words of the user's to cite for it, so the guess is refused before the tool runs. This checks
 * that the words exist, not that they mean the value chosen; that is the judge's job. Only required,
 * applicable slots are checked.
 */
export function unstatedSlots(
  userWords: object,
  userMessages: readonly string[],
  plan: IntakePlan,
  answers: object = {},
): IntakeSlot[] {
  const words = userWords as Readonly<Record<string, unknown>>;
  const said = userMessages.map(normalise);
  return applicableSlots(plan, answers)
    .filter((slot) => slot.required !== false)
    .filter((slot) => {
      const raw = words[slot.id];
      const cited = normalise(raw === undefined || raw === null ? '' : String(raw));
      return !cited || !said.some((message) => message.includes(cited));
    });
}
