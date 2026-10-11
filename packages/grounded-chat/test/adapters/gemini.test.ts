import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { LOOKUP_TOOL } from "../helpers/contract.js";
import { LlmProviderError, type ChatMessage, type LlmStreamEvent, type LlmTurn } from "../../src/index.js";
import { GeminiLlmAdapter } from "../../src/adapters/gemini/index.js";
import { runLlmPortContractTests } from "../helpers/contract.js";

const BASE_URL = "https://generativelanguage.googleapis.com";

function textResponse(text: string, totalTokens?: number) {
  return {
    steps: [{ type: "model_output", content: [{ type: "text", text }] }],
    ...(totalTokens !== undefined ? { usage: { total_tokens: totalTokens } } : {}),
  };
}

function functionCallResponse(name: string, args: Record<string, unknown>) {
  return { steps: [{ type: "function_call", id: "call_abc", name, arguments: args }] };
}


// Event streams recorded from the live Interactions API, signatures shortened.
function sse(events: unknown[]): string {
  return [...events.map((event) => `event: ${(event as { event_type: string }).event_type}\ndata: ${JSON.stringify(event)}\n\n`), "event: done\ndata: [DONE]\n\n"].join("");
}

const COMPLETED = { event_type: "interaction.completed", interaction: { status: "completed", usage: { total_tokens: 84 } } };

const TEXT_STREAM = sse([
  { event_type: "interaction.created", interaction: { object: "interaction", model: "gemini-3.1-flash-lite" } },
  { event_type: "step.start", index: 0, step: { type: "thought" } },
  { event_type: "step.delta", index: 0, delta: { type: "thought_signature", signature: "sig-thought" } },
  { event_type: "step.stop", index: 0 },
  { event_type: "step.start", index: 1, step: { type: "model_output" } },
  { event_type: "step.delta", index: 1, delta: { type: "text", text: "Your price is 14" } },
  { event_type: "step.delta", index: 1, delta: { type: "text", text: "80.00 EUR." } },
  { event_type: "step.stop", index: 1 },
  COMPLETED,
]);

const TOOL_STREAM = sse([
  { event_type: "step.start", index: 0, step: { type: "thought" } },
  { event_type: "step.delta", index: 0, delta: { type: "thought_signature", signature: "sig-thought" } },
  { event_type: "step.stop", index: 0 },
  {
    event_type: "step.start",
    index: 1,
    step: { id: "call_83473", signature: "sig-call", type: "function_call", name: "lookup_record", arguments: {} },
  },
  { event_type: "step.delta", index: 1, delta: { type: "arguments_delta", arguments: '{"age":22,"ci' } },
  { event_type: "step.delta", index: 1, delta: { type: "arguments_delta", arguments: 'ty":"Lisbon"}' } },
  { event_type: "step.stop", index: 1 },
  { event_type: "interaction.completed", interaction: { status: "requires_action", usage: { total_tokens: 91 } } },
]);

// The non-streamed response to the same request, as the live API returned it.
const TOOL_PLAIN = {
  status: "requires_action",
  usage: { total_tokens: 91 },
  steps: [
    { signature: "sig-thought", type: "thought" },
    { id: "call_83473", signature: "sig-call", type: "function_call", name: "lookup_record", arguments: { age: 22, city: "Lisbon" } },
  ],
};

async function collect(stream: AsyncIterable<LlmStreamEvent>) {
  const texts: string[] = [];
  let turn: LlmTurn | undefined;
  for await (const event of stream) {
    if (event.type === "text") texts.push(event.text);
    else turn = event.turn;
  }
  return { texts, turn };
}

describe("GeminiLlmAdapter (against a mocked Interactions API)", () => {
  let mockAgent: MockAgent;
  let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;

  beforeEach(() => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(async () => {
    setGlobalDispatcher(originalDispatcher);
    await mockAgent.close();
  });

  it("posts to /v1beta/interactions with a system instruction and tools", async () => {
    const pool = mockAgent.get(BASE_URL);
    let capturedBody: string | undefined;
    pool
      .intercept({
        path: "/v1beta/interactions",
        method: "POST",
        body: (body) => {
          capturedBody = body;
          return true;
        },
      })
      .reply(200, textResponse("Which country will you be studying in?"));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a quotation assistant." },
      { role: "user", content: "hi" },
    ];
    const turn = await adapter.complete(messages, [LOOKUP_TOOL]);

    expect(turn.reply).toBe("Which country will you be studying in?");
    const parsed = JSON.parse(capturedBody ?? "{}");
    expect(parsed.store).toBe(false);
    expect(parsed.system_instruction).toContain("quotation assistant");
    expect(parsed.input).toEqual([{ type: "user_input", content: [{ type: "text", text: "hi" }] }]);
    expect(parsed.tools[0]).toEqual({
      type: "function",
      name: "lookup_record",
      description: LOOKUP_TOOL.description,
      parameters: LOOKUP_TOOL.parameters,
    });
    // Lowercase JSON Schema, unlike the old generateContent API's uppercase Schema type names.
    expect(parsed.tools[0].parameters.type).toBe("object");
  });

  it("forwards thinkingLevel as generation_config.thinking_level", async () => {
    const pool = mockAgent.get(BASE_URL);
    let capturedBody: string | undefined;
    pool
      .intercept({
        path: "/v1beta/interactions",
        method: "POST",
        body: (body) => {
          capturedBody = body;
          return true;
        },
      })
      .reply(200, textResponse("ok"));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    await adapter.complete([{ role: "user", content: "hi" }], [], { thinkingLevel: "low" });

    const parsed = JSON.parse(capturedBody ?? "{}");
    expect(parsed.generation_config).toEqual({ thinking_level: "low" });
  });

  it("asks for a JSON reply following the given schema as response_format", async () => {
    const pool = mockAgent.get(BASE_URL);
    let capturedBody: string | undefined;
    pool
      .intercept({
        path: "/v1beta/interactions",
        method: "POST",
        body: (body) => {
          capturedBody = body;
          return true;
        },
      })
      .reply(200, textResponse('{"ok":true}'));
    const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };
    const turn = await new GeminiLlmAdapter({ apiKey: "test-key" }).complete([{ role: "user", content: "hi" }], [], { responseSchema: schema });
    expect(turn.reply).toBe('{"ok":true}');
    expect(JSON.parse(capturedBody ?? "{}").response_format).toEqual({ type: "text", mime_type: "application/json", schema });
  });

  it("omits generation_config entirely when no thinkingLevel is given", async () => {
    const pool = mockAgent.get(BASE_URL);
    let capturedBody: string | undefined;
    pool
      .intercept({
        path: "/v1beta/interactions",
        method: "POST",
        body: (body) => {
          capturedBody = body;
          return true;
        },
      })
      .reply(200, textResponse("ok"));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    await adapter.complete([{ role: "user", content: "hi" }], []);

    const parsed = JSON.parse(capturedBody ?? "{}");
    expect(parsed.generation_config).toBeUndefined();
  });

  it("parses usage.total_tokens into tokensUsed", async () => {
    mockAgent
      .get(BASE_URL)
      .intercept({ path: "/v1beta/interactions", method: "POST" })
      .reply(200, textResponse("Which country will you be studying in?", 42));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    const turn = await adapter.complete([{ role: "user", content: "hi" }], []);
    expect(turn.tokensUsed).toBe(42);
  });

  it("leaves tokensUsed undefined when usage is absent from the response", async () => {
    mockAgent
      .get(BASE_URL)
      .intercept({ path: "/v1beta/interactions", method: "POST" })
      .reply(200, textResponse("ok"));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    const turn = await adapter.complete([{ role: "user", content: "hi" }], []);
    expect(turn.tokensUsed).toBeUndefined();
  });

  it("parses a function_call step into a ToolCall", async () => {
    mockAgent
      .get(BASE_URL)
      .intercept({ path: "/v1beta/interactions", method: "POST" })
      .reply(200, functionCallResponse("lookup_record", { city: "SG", age: 22 }));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    const turn = await adapter.complete([{ role: "user", content: "Lisbon, 22, please look it up" }], [
      LOOKUP_TOOL,
    ]);

    expect(turn.reply).toBeUndefined();
    expect(turn.toolCalls).toHaveLength(1);
    expect(turn.toolCalls?.[0]).toMatchObject({
      id: "call_abc",
      name: "lookup_record",
      arguments: { city: "SG", age: 22 },
    });
  });

  it("returns providerState with every step from a tool-calling turn, including a thought step", async () => {
    // Regression: the live API returns a `thought` step (with a `signature` field) ahead
    // of `function_call` and requires it replayed back verbatim on the follow-up request.
    // Reconstructing a bare function_call from the ToolCall alone silently drops it,
    // which the live API rejects with a 400 "invalid argument" — found via a real
    // multi-turn conversation this session.
    const thoughtStep = { type: "thought", signature: "opaque-signature-abc" };
    const functionCallStep = { type: "function_call", id: "call_abc", name: "lookup_record", arguments: { age: 22 } };
    mockAgent
      .get(BASE_URL)
      .intercept({ path: "/v1beta/interactions", method: "POST" })
      .reply(200, { steps: [thoughtStep, functionCallStep] });

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    const turn = await adapter.complete([{ role: "user", content: "hi" }], [LOOKUP_TOOL]);

    expect(turn.providerState).toEqual([thoughtStep, functionCallStep]);
  });

  it("omits providerState when the turn has no tool call", async () => {
    mockAgent
      .get(BASE_URL)
      .intercept({ path: "/v1beta/interactions", method: "POST" })
      .reply(200, textResponse("ok"));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    const turn = await adapter.complete([{ role: "user", content: "hi" }], []);

    expect(turn.providerState).toBeUndefined();
  });

  it("replays providerState verbatim (thought step and signature intact) instead of reconstructing a bare function_call", async () => {
    const thoughtStep = { type: "thought", signature: "opaque-signature-abc" };
    const functionCallStep = { type: "function_call", id: "call_abc", name: "lookup_record", arguments: { age: 22 } };
    const pool = mockAgent.get(BASE_URL);
    let capturedBody: string | undefined;
    pool
      .intercept({
        path: "/v1beta/interactions",
        method: "POST",
        body: (body) => {
          capturedBody = body;
          return true;
        },
      })
      .reply(200, textResponse("Your price is 1480.00 EUR."));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    const messages: ChatMessage[] = [
      { role: "user", content: "Lisbon, 22, please look it up" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call_abc", name: "lookup_record", arguments: { age: 22 } }],
        providerState: [thoughtStep, functionCallStep],
      },
      { role: "tool", toolCallId: "call_abc", name: "lookup_record", content: JSON.stringify({ total: 1480.0 }) },
    ];
    await adapter.complete(messages, [LOOKUP_TOOL]);

    const parsed = JSON.parse(capturedBody ?? "{}");
    // The thought step (with its signature) must appear ahead of the function_call step,
    // exactly as Gemini originally returned it — not a reconstructed bare function_call.
    expect(parsed.input[1]).toEqual(thoughtStep);
    expect(parsed.input[2]).toEqual(functionCallStep);
    expect(parsed.input[3]).toEqual({
      type: "function_result",
      name: "lookup_record",
      call_id: "call_abc",
      result: [{ type: "text", text: JSON.stringify({ total: 1480.0 }) }],
    });
  });

  it("maps an assistant tool-call message and a tool-result message into function_call/function_result steps", async () => {
    const pool = mockAgent.get(BASE_URL);
    let capturedBody: string | undefined;
    pool
      .intercept({
        path: "/v1beta/interactions",
        method: "POST",
        body: (body) => {
          capturedBody = body;
          return true;
        },
      })
      .reply(200, textResponse("Your price is 1480.00 EUR."));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    const messages: ChatMessage[] = [
      { role: "user", content: "Lisbon, 22, please look it up" },
      { role: "assistant", content: "", toolCalls: [{ id: "call_1", name: "lookup_record", arguments: { age: 22 } }] },
      { role: "tool", toolCallId: "call_1", name: "lookup_record", content: JSON.stringify({ total: 1480.0 }) },
    ];
    await adapter.complete(messages, [LOOKUP_TOOL]);

    const parsed = JSON.parse(capturedBody ?? "{}");
    expect(parsed.input[1]).toEqual({ type: "function_call", id: "call_1", name: "lookup_record", arguments: { age: 22 } });
    expect(parsed.input[2]).toEqual({
      type: "function_result",
      name: "lookup_record",
      call_id: "call_1",
      result: [{ type: "text", text: JSON.stringify({ total: 1480.0 }) }],
    });
  });

  it("replays a prior plain-text assistant turn as a model_output step", async () => {
    const pool = mockAgent.get(BASE_URL);
    let capturedBody: string | undefined;
    pool
      .intercept({
        path: "/v1beta/interactions",
        method: "POST",
        body: (body) => {
          capturedBody = body;
          return true;
        },
      })
      .reply(200, textResponse("ok"));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    const messages: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "Which country will you be studying in?" },
      { role: "user", content: "Lisbon" },
    ];
    await adapter.complete(messages, []);

    const parsed = JSON.parse(capturedBody ?? "{}");
    expect(parsed.input[1]).toEqual({
      type: "model_output",
      content: [{ type: "text", text: "Which country will you be studying in?" }],
    });
  });

  it("falls back to the default model when config.model is an empty string, not just undefined", async () => {
    // Regression: an admin-saved but never-filled-in "Model name" field persists as ""
    // (a real string), which a plain "??" fallback chain would send to Gemini verbatim
    // instead of skipping — a real 404 this hit ("Model '' not found").
    const pool = mockAgent.get(BASE_URL);
    let capturedBody: string | undefined;
    pool
      .intercept({
        path: "/v1beta/interactions",
        method: "POST",
        body: (body) => {
          capturedBody = body;
          return true;
        },
      })
      .reply(200, textResponse("ok"));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key", model: "" });
    await adapter.complete([{ role: "user", content: "hi" }], []);

    const parsed = JSON.parse(capturedBody ?? "{}");
    expect(parsed.model).toBe("gemini-3.5-flash-lite");
  });

  it("streams text as it arrives and ends with the turn complete() would return", async () => {
    const pool = mockAgent.get(BASE_URL);
    let capturedBody: string | undefined;
    pool
      .intercept({
        path: "/v1beta/interactions",
        method: "POST",
        body: (body) => {
          capturedBody = body;
          return true;
        },
      })
      .reply(200, TEXT_STREAM, { headers: { "content-type": "text/event-stream" } });

    const { texts, turn } = await collect(new GeminiLlmAdapter({ apiKey: "test-key" }).stream([{ role: "user", content: "hi" }], []));
    expect(JSON.parse(capturedBody ?? "{}").stream).toBe(true);
    expect(texts).toEqual(["Your price is 14", "80.00 EUR."]);
    expect(turn).toEqual({ reply: "Your price is 1480.00 EUR.", toolCalls: undefined, tokensUsed: 84, providerState: undefined });
  });

  it("reassembles a streamed tool call into exactly the steps a non-streamed response carries", async () => {
    const pool = mockAgent.get(BASE_URL);
    pool.intercept({ path: "/v1beta/interactions", method: "POST" }).reply(200, TOOL_STREAM, { headers: { "content-type": "text/event-stream" } });
    pool.intercept({ path: "/v1beta/interactions", method: "POST" }).reply(200, TOOL_PLAIN);

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    const messages: ChatMessage[] = [{ role: "user", content: "Look up Lisbon, age 22" }];
    const streamed = await collect(adapter.stream(messages, [LOOKUP_TOOL]));
    const plain = await adapter.complete(messages, [LOOKUP_TOOL]);

    expect(streamed.texts).toEqual([]);
    expect(streamed.turn).toEqual(plain);
    expect(streamed.turn?.toolCalls).toEqual([{ id: "call_83473", name: "lookup_record", arguments: { age: 22, city: "Lisbon" } }]);
  });

  it("throws an LlmProviderError with the mapped status when the stream reports an error", async () => {
    const stream = sse([
      { event_type: "step.start", index: 0, step: { type: "model_output" } },
      { event_type: "step.delta", index: 0, delta: { type: "text", text: "Your pre" } },
      { event_type: "error", error: { code: "service_unavailable", message: "high demand" } },
    ]);
    mockAgent.get(BASE_URL).intercept({ path: "/v1beta/interactions", method: "POST" }).reply(200, stream);

    const iterator = new GeminiLlmAdapter({ apiKey: "test-key" }).stream([{ role: "user", content: "hi" }], []);
    const seen: string[] = [];
    await expect(
      (async () => {
        for await (const event of iterator) if (event.type === "text") seen.push(event.text);
      })(),
    ).rejects.toMatchObject({ name: "LlmProviderError", status: 503 });
    expect(seen).toEqual(["Your pre"]);
  });

  it("treats a stream that closes before the completion event as a failed turn", async () => {
    const stream = sse([
      { event_type: "step.start", index: 0, step: { type: "model_output" } },
      { event_type: "step.delta", index: 0, delta: { type: "text", text: "Your pre" } },
    ]).replace("event: done\ndata: [DONE]\n\n", "");
    mockAgent.get(BASE_URL).intercept({ path: "/v1beta/interactions", method: "POST" }).reply(200, stream);

    await expect(collect(new GeminiLlmAdapter({ apiKey: "test-key" }).stream([{ role: "user", content: "hi" }], []))).rejects.toMatchObject({
      status: 502,
    });
  });

  it("throws before streaming anything on a non-2xx response", async () => {
    mockAgent.get(BASE_URL).intercept({ path: "/v1beta/interactions", method: "POST" }).reply(429, "rate limited");
    await expect(collect(new GeminiLlmAdapter({ apiKey: "test-key" }).stream([{ role: "user", content: "hi" }], []))).rejects.toMatchObject({
      status: 429,
    });
  });

  it("throws an LlmProviderError with the status and body on a non-2xx response", async () => {
    mockAgent
      .get(BASE_URL)
      .intercept({ path: "/v1beta/interactions", method: "POST" })
      .reply(404, "");

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    await expect(adapter.complete([{ role: "user", content: "hi" }], [])).rejects.toThrow(/404/);
  });

  it("throws an LlmProviderError carrying the real status (e.g. 429 rate-limited), not a blanket 500", async () => {
    // Regression: route.ts needs the real provider status to tell a "wait and retry"
    // rate limit apart from an actual bug — found via a live 429 from Gemini's free
    // tier quota.
    mockAgent
      .get(BASE_URL)
      .intercept({ path: "/v1beta/interactions", method: "POST" })
      .reply(429, JSON.stringify({ error: { message: "You exceeded your current quota", code: "too_many_requests" } }));

    const adapter = new GeminiLlmAdapter({ apiKey: "test-key" });
    try {
      await adapter.complete([{ role: "user", content: "hi" }], []);
      expect.unreachable("expected complete() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LlmProviderError);
      expect((error as LlmProviderError).status).toBe(429);
    }
  });
});

describe("GeminiLlmAdapter contract (mocked)", () => {
  let mockAgent: MockAgent;
  let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;

  beforeEach(() => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    mockAgent
      .get(BASE_URL)
      .intercept({ path: "/v1beta/interactions", method: "POST" })
      .reply((request) => {
        const args = { city: "SG", age: 22 };
        if (!JSON.parse(String(request.body)).stream) return { statusCode: 200, data: functionCallResponse("lookup_record", args) };
        return {
          statusCode: 200,
          data: sse([
            { event_type: "step.start", index: 0, step: { type: "function_call", id: "call_abc", name: "lookup_record", arguments: {} } },
            { event_type: "step.delta", index: 0, delta: { type: "arguments_delta", arguments: JSON.stringify(args) } },
            { event_type: "step.stop", index: 0 },
            COMPLETED,
          ]),
        };
      })
      .persist();
  });

  afterEach(async () => {
    setGlobalDispatcher(originalDispatcher);
    await mockAgent.close();
  });

  runLlmPortContractTests("GeminiLlmAdapter", () => new GeminiLlmAdapter({ apiKey: "test-key" }));
});

describe("GeminiLlmAdapter stream read from awkward network chunks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reassembles events split mid-line and mid-character", async () => {
    const bytes = new TextEncoder().encode(TEXT_STREAM.replace("80.00 EUR.", "80,00 € é."));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        let at = 0;
        const body = new ReadableStream<Uint8Array>({
          pull(controller) {
            if (at >= bytes.length) return controller.close();
            // 7-byte chunks cut through event boundaries, JSON and the multi-byte characters.
            controller.enqueue(bytes.slice(at, at + 7));
            at += 7;
          },
        });
        return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
      }),
    );

    const { texts, turn } = await collect(new GeminiLlmAdapter({ apiKey: "test-key" }).stream([{ role: "user", content: "hi" }], []));
    expect(texts.join("")).toBe("Your price is 1480,00 € é.");
    expect(turn?.reply).toBe("Your price is 1480,00 € é.");
  });
});
