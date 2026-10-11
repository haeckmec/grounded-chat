import { describe, expect, it } from "vitest";
import { readServerSentEvents } from "../../src/client/index.js";

function streamOf(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let at = 0;
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(at, at + chunkSize));
      at += chunkSize;
    },
  });
}

const STREAM =
  'event: card\ndata: {"card":{"total":1480}}\n\n' +
  'event: delta\ndata: {"text":"Votre prime est de 1 480,00 € é"}\n\n' +
  'event: done\ndata: {"sessionId":"s1"}\n\n';

describe("readServerSentEvents", () => {
  it("reads every event whole, however the bytes are chunked", async () => {
    for (const chunkSize of [1, 3, 7, 64, 4096]) {
      const events = [];
      for await (const event of readServerSentEvents(streamOf(STREAM, chunkSize))) events.push(event);
      expect(events, `chunk size ${chunkSize}`).toEqual([
        { event: "card", data: { card: { total: 1480 } } },
        { event: "delta", data: { text: "Votre prime est de 1 480,00 € é" } },
        { event: "done", data: { sessionId: "s1" } },
      ]);
    }
  });
});
