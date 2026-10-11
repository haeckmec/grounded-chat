import { describe, expect, it, vi } from "vitest";
import { createSweepThrottle } from "../src/index.js";

describe("createSweepThrottle", () => {
  it("runs on the first call, then withholds until the interval elapses", async () => {
    let t = 0;
    const throttle = createSweepThrottle({ intervalMs: 1000, now: () => t });
    const run = vi.fn().mockResolvedValue(undefined);

    await throttle.maybeRun(run);
    expect(run).toHaveBeenCalledTimes(1);

    t = 500; // still within the throttle window
    await throttle.maybeRun(run);
    expect(run).toHaveBeenCalledTimes(1); // not run again yet

    t = 1500; // past the window
    await throttle.maybeRun(run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("tracks its own state independently per throttle instance", async () => {
    const throttleA = createSweepThrottle({ intervalMs: 1000, now: () => 0 });
    const throttleB = createSweepThrottle({ intervalMs: 1000, now: () => 0 });
    const runA = vi.fn().mockResolvedValue(undefined);
    const runB = vi.fn().mockResolvedValue(undefined);

    await throttleA.maybeRun(runA);
    await throttleB.maybeRun(runB);
    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).toHaveBeenCalledTimes(1);
  });
});
