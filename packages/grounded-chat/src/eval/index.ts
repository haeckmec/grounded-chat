/**
 * Eval runners as library functions: grade a labelled set with any grader and report agreement per
 * verdict, time model calls and summarise latencies. No model, file or env access of their own; the
 * host's script supplies the grader, reads its fixtures and writes the results.
 */
import type { LlmPort } from '../llm/port.js';

/** One labelled conversation: the user's message, the reply, and the expected verdicts. */
export interface EvalItem<C extends string = string> {
  id: string;
  /** The user's message. */
  customer: string;
  reply: string;
  /** Absent in a set of live replies, which is graded for agreement between graders only. */
  labels?: Record<C, boolean>;
}

/** One grader's verdicts per item id; null where it could not grade. */
export type Grades<C extends string = string> = Record<string, Record<C, boolean> | null>;

/** Options for `gradeEvalSet`. */
export interface GradeSetOptions<C extends string> {
  items: ReadonlyArray<EvalItem<C>>;
  /** Grades one item; null when it could not. */
  grade: (item: EvalItem<C>) => Promise<Record<C, boolean> | null>;
  /** Further tries for an item the grader returned null for; 3 when absent. */
  retries?: number;
  /** Wait after an ungraded try, such as a rate limit on a free key; 8000 ms when absent. */
  retryPauseMs?: number;
  /** Wait between items; 500 ms when absent. */
  pauseMs?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Called after each item, for progress output. */
  onGraded?: (item: EvalItem<C>, grade: Record<C, boolean> | null) => void;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Grades every item in order, retrying an ungraded one, and returns the grades by id. */
export async function gradeEvalSet<C extends string>(options: GradeSetOptions<C>): Promise<Grades<C>> {
  const sleep = options.sleep ?? realSleep;
  const retries = options.retries ?? 3;
  const grades: Grades<C> = {};
  for (const item of options.items) {
    grades[item.id] = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const grade = await options.grade(item);
      if (grade) {
        grades[item.id] = grade;
        break;
      }
      await sleep(options.retryPauseMs ?? 8000);
    }
    options.onGraded?.(item, grades[item.id] ?? null);
    await sleep(options.pauseMs ?? 500);
  }
  return grades;
}

/** Agreement for one verdict: items compared, items matching, and the misses either way. */
export interface CategoryAgreement {
  category: string;
  match: number;
  compared: number;
  /** Expected true, graded false. */
  missed: string[];
  /** Expected false, graded true. */
  falseAlarm: string[];
}

/** The result of `agreement`: per category, overall, the ungraded items, and printable lines. */
export interface AgreementReport {
  categories: CategoryAgreement[];
  match: number;
  compared: number;
  ungraded: string[];
  /** The report as printable lines. */
  lines: string[];
}

/**
 * Agreement of `grades` with `reference` per category. Items either side could not grade are left
 * out of the comparison and listed as ungraded.
 */
export function agreement<C extends string>(
  items: ReadonlyArray<EvalItem<C>>,
  grades: Grades<C>,
  reference: (item: EvalItem<C>) => Record<C, boolean> | null | undefined,
  categories: readonly C[],
): AgreementReport {
  const percent = (match: number, compared: number, digits: number) => ((100 * match) / Math.max(compared, 1)).toFixed(digits);
  const result: CategoryAgreement[] = categories.map((category) => {
    const row: CategoryAgreement = { category, match: 0, compared: 0, missed: [], falseAlarm: [] };
    for (const item of items) {
      const grade = grades[item.id];
      const expected = reference(item);
      if (!grade || !expected) continue;
      row.compared++;
      if (grade[category] === expected[category]) row.match++;
      else if (expected[category]) row.missed.push(item.id);
      else row.falseAlarm.push(item.id);
    }
    return row;
  });
  const match = result.reduce((sum, row) => sum + row.match, 0);
  const compared = result.reduce((sum, row) => sum + row.compared, 0);
  const ungraded = items.filter((item) => !grades[item.id]).map((item) => item.id);
  const lines = result.map(
    (row) =>
      `${row.category.padEnd(17)} ${row.match}/${row.compared} agree (${percent(row.match, row.compared, 0)}%)` +
      `${row.missed.length ? `  missed: ${row.missed.join(' ')}` : ''}${row.falseAlarm.length ? `  false alarm: ${row.falseAlarm.join(' ')}` : ''}`,
  );
  lines.push(`${'all verdicts'.padEnd(17)} ${match}/${compared} agree (${percent(match, compared, 1)}%)`);
  if (ungraded.length) lines.push(`ungraded: ${ungraded.join(' ')}`);
  return { categories: result, match, compared, ungraded, lines };
}

/** The value at or above `p` percent of a sorted list; 0 for an empty list. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

/** One printable line: count, median, p90 and max of a set of millisecond timings. */
export function summariseLatency(label: string, values: readonly number[]): string {
  const sorted = [...values].sort((a, b) => a - b);
  return `${label.padEnd(28)} n=${String(sorted.length).padStart(3)}  median ${percentile(sorted, 50)} ms  p90 ${percentile(sorted, 90)} ms  max ${sorted.at(-1) ?? 0} ms`;
}

/** Wraps a port so every call, streamed or not, reports its own wall time in milliseconds. */
export function timedPort(port: LlmPort, onTiming: (ms: number) => void, clock: () => number = () => performance.now()): LlmPort {
  return {
    async complete(messages, tools, opts) {
      const startedAt = clock();
      try {
        return await port.complete(messages, tools, opts);
      } finally {
        onTiming(Math.round(clock() - startedAt));
      }
    },
    async *stream(messages, tools, opts) {
      const startedAt = clock();
      try {
        if (port.stream) yield* port.stream(messages, tools, opts);
        else {
          const turn = await port.complete(messages, tools, opts);
          if (turn.reply) yield { type: 'text', text: turn.reply };
          yield { type: 'done', turn };
        }
      } finally {
        onTiming(Math.round(clock() - startedAt));
      }
    },
  };
}

/**
 * Throws when a script that calls a paid model endpoint runs in CI or on a deployment. Pass the
 * host's environment, such as `process.env`.
 */
export function refuseInCi(env: Readonly<Record<string, string | undefined>>, what: string): void {
  if (env.CI || env.VERCEL) throw new Error(`${what} calls a real model endpoint and never runs in CI or on Vercel.`);
}
