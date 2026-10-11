/** True once a session has as many messages as its cap allows. */
export function isMessageCapExceeded(messageCount: number, maxMessagesPerSession: number): boolean {
  return messageCount >= maxMessagesPerSession;
}

/** True once a session has spent its token budget. No budget means never exceeded. */
export function isTokenBudgetExceeded(tokenCount: number, tokenBudgetPerSession: number | undefined): boolean {
  if (tokenBudgetPerSession === undefined) return false;
  return tokenCount >= tokenBudgetPerSession;
}

/** Runs a job at most once per interval, such as a retention sweep triggered by chat turns. */
export interface SweepThrottle {
  maybeRun(run: () => Promise<unknown>): Promise<void>;
}

/** Options for `createSweepThrottle`. */
export interface SweepThrottleOptions {
  /** One hour when absent. */
  intervalMs?: number;
  now?: () => number;
}

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

/** A throttle with an injectable clock; the first call always runs. */
export function createSweepThrottle(options: SweepThrottleOptions = {}): SweepThrottle {
  const now = options.now ?? (() => Date.now());
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  // -Infinity, not 0: a test clock starting at 0 would otherwise make the first sweep look like it
  // had just happened and throttle it.
  let lastRunAt = -Infinity;
  return {
    async maybeRun(run: () => Promise<unknown>): Promise<void> {
      const t = now();
      if (t - lastRunAt < intervalMs) return;
      lastRunAt = t;
      await run();
    },
  };
}
