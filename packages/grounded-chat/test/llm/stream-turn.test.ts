import { describe, expect, it } from "vitest";
import { streamTurn, type LlmPort, type LlmStreamEvent } from "../../src/index.js";

async function collect(stream: AsyncIterable<LlmStreamEvent>): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe("streamTurn", () => {
  it("gives an adapter that cannot stream one text delta and then its turn", async () => {
    const port: LlmPort = { complete: async () => ({ reply: "Which country?", tokensUsed: 12 }) };
    expect(await collect(streamTurn(port, [], []))).toEqual([
      { type: "text", text: "Which country?" },
      { type: "done", turn: { reply: "Which country?", tokensUsed: 12 } },
    ]);
  });

  it("sends no text delta for a turn that only calls tools", async () => {
    const toolCalls = [{ id: "call_1", name: "lookup_record", arguments: {} }];
    const port: LlmPort = { complete: async () => ({ toolCalls }) };
    expect(await collect(streamTurn(port, [], []))).toEqual([{ type: "done", turn: { toolCalls } }]);
  });

  it("passes an adapter's own stream through untouched", async () => {
    const events: LlmStreamEvent[] = [
      { type: "text", text: "Hel" },
      { type: "text", text: "lo" },
      { type: "done", turn: { reply: "Hello" } },
    ];
    const port: LlmPort = {
      complete: async () => {
        throw new Error("complete must not be called when the adapter streams");
      },
      async *stream() {
        yield* events;
      },
    };
    expect(await collect(streamTurn(port, [], []))).toEqual(events);
  });
});
