import { describe, expect, it, vi } from 'vitest';
import { agreement, gradeEvalSet, percentile, refuseInCi, summariseLatency, timedPort, type EvalItem } from '../../src/eval/index.js';
import type { LlmPort } from '../../src/index.js';

type C = 'offTopic' | 'leak';
const ITEMS: Array<EvalItem<C>> = [
  { id: 'a', customer: 'x', reply: 'y', labels: { offTopic: true, leak: false } },
  { id: 'b', customer: 'x', reply: 'y', labels: { offTopic: false, leak: false } },
  { id: 'c', customer: 'x', reply: 'y', labels: { offTopic: false, leak: true } },
];

describe('gradeEvalSet', () => {
  it('grades every item, retries an ungraded one, and keeps null when it never grades', async () => {
    const tries: Record<string, number> = {};
    const grade = vi.fn(async (item: EvalItem<C>) => {
      tries[item.id] = (tries[item.id] ?? 0) + 1;
      if (item.id === 'b' && tries.b! < 2) return null;
      if (item.id === 'c') return null;
      return { offTopic: item.id === 'a', leak: false };
    });
    const sleep = vi.fn(async () => {});
    const onGraded = vi.fn();
    const grades = await gradeEvalSet({ items: ITEMS, grade, sleep, retries: 2, onGraded });
    expect(grades).toEqual({ a: { offTopic: true, leak: false }, b: { offTopic: false, leak: false }, c: null });
    expect(tries).toEqual({ a: 1, b: 2, c: 3 });
    expect(onGraded).toHaveBeenCalledTimes(3);
  });
});

describe('agreement', () => {
  it('reports matches, misses and false alarms per category, and the ungraded', () => {
    const report = agreement(ITEMS, { a: { offTopic: false, leak: false }, b: { offTopic: false, leak: true }, c: null }, (item) => item.labels, ['offTopic', 'leak']);
    expect(report.categories).toEqual([
      { category: 'offTopic', match: 1, compared: 2, missed: ['a'], falseAlarm: [] },
      { category: 'leak', match: 1, compared: 2, missed: [], falseAlarm: ['b'] },
    ]);
    expect(report.lines).toEqual([
      'offTopic          1/2 agree (50%)  missed: a',
      'leak              1/2 agree (50%)  false alarm: b',
      'all verdicts      2/4 agree (50.0%)',
      'ungraded: c',
    ]);
  });
});

describe('latency', () => {
  it('reads percentiles of a sorted list and summarises a set', () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4], 90)).toBe(4);
    expect(summariseLatency('turns', [30, 10, 20])).toBe('turns                        n=  3  median 20 ms  p90 30 ms  max 30 ms');
  });

  it('times every call, streamed or not', async () => {
    let t = 0;
    const timings: number[] = [];
    const port: LlmPort = { complete: async () => ((t += 120), { reply: 'hi' }) };
    const timed = timedPort(port, (ms) => timings.push(ms), () => t);
    await timed.complete([], []);
    const events = [];
    for await (const event of timed.stream!([], [])) events.push(event);
    expect(timings).toEqual([120, 120]);
    expect(events).toEqual([{ type: 'text', text: 'hi' }, { type: 'done', turn: { reply: 'hi' } }]);
  });
});

describe('refuseInCi', () => {
  it('throws under CI or Vercel only', () => {
    expect(() => refuseInCi({ CI: 'true' }, 'judge-eval')).toThrow(/never runs in CI/);
    expect(() => refuseInCi({ VERCEL: '1' }, 'judge-eval')).toThrow();
    expect(() => refuseInCi({}, 'judge-eval')).not.toThrow();
  });
});
