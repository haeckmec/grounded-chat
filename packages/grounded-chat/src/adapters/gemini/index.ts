/**
 * Gemini adapter: the only real model adapter. The only code in the package, with the other adapters,
 * that does network I/O. The API key comes from the host, never from config.
 */
import {
  LlmProviderError,
  type ChatMessage,
  type LlmPort,
  type LlmStreamEvent,
  type LlmTurn,
  type ModelOpts,
  type ToolCall,
  type ToolSchema,
} from '../../llm/port.js';

/** The Gemini adapter's settings. The key comes from the host's environment, never from config. */
export interface GeminiAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

// The Interactions API (POST /v1beta/interactions); the older generateContent endpoint and the
// gemini-2.0 models are deprecated. Flash Lite 3.5 answers a turn in under a second. It is also the
// model most willing to fill an unstated value with a default, which is why a pack should accept
// only values backed by the user's own words.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const API_REVISION = "2026-05-20";

interface InteractionContentBlock {
  type: string;
  text?: string;
}

interface InteractionStep {
  type: string;
  id?: string;
  signature?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  content?: InteractionContentBlock[];
}

type InteractionInputItem =
  | { type: "user_input"; content: InteractionContentBlock[] }
  | { type: "model_output"; content: InteractionContentBlock[] }
  | { type: "function_call"; id: string; name: string; arguments: Record<string, unknown> }
  | { type: "function_result"; name: string; call_id: string; result: InteractionContentBlock[] };

function toInteractionTools(tools: ToolSchema[]) {
  // A flat array with lowercase JSON-Schema parameters: no functionDeclarations wrapper and no
  // uppercase type names, so a pack's tool schemas pass through as they are.
  return tools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

// Stateless mode (store: false): the host owns transcript persistence, so the provider's own
// interaction storage would only be a second, less controllable retention clock for user data.
// Every prior turn, including tool-call and tool-result steps from earlier rounds of the same
// turn, is replayed as explicit steps.
function toInteractionInput(messages: ChatMessage[]): {
  systemInstruction: string | undefined;
  input: InteractionInputItem[];
} {
  const systemMessages = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");

  const input: InteractionInputItem[] = rest.flatMap((message): InteractionInputItem[] => {
    if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
      // The API requires every step it returned for a tool-calling turn (a `thought` step with
      // its `signature`, then the `function_call` step) to be replayed verbatim on the follow-up
      // request; a reconstructed bare function_call drops the thought step and the live API
      // answers 400 "invalid argument". providerState carries the exact steps this adapter
      // returned earlier in the loop.
      if (Array.isArray(message.providerState)) {
        return message.providerState as InteractionInputItem[];
      }
      return message.toolCalls.map((call) => ({
        type: "function_call" as const,
        id: call.id,
        name: call.name,
        arguments: call.arguments,
      }));
    }
    if (message.role === "tool") {
      return [
        {
          type: "function_result",
          name: message.name ?? "",
          call_id: message.toolCallId ?? "",
          result: [{ type: "text", text: message.content }],
        },
      ];
    }
    if (message.role === "assistant") {
      return [{ type: "model_output", content: [{ type: "text", text: message.content }] }];
    }
    return [{ type: "user_input", content: [{ type: "text", text: message.content }] }];
  });

  return {
    systemInstruction: systemMessages.length > 0 ? systemMessages.map((m) => m.content).join("\n") : undefined,
    input,
  };
}

interface InteractionResponseBody {
  steps?: InteractionStep[];
  usage?: { total_tokens?: number } | undefined;
}

function parseInteractionResponse(body: InteractionResponseBody): LlmTurn {
  const steps = body.steps ?? [];

  const textParts = steps
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c): c is { type: string; text: string } => c.type === "text" && typeof c.text === "string");

  const toolCalls: ToolCall[] = steps
    .filter((s) => s.type === "function_call")
    .map((s) => ({ id: s.id ?? globalThis.crypto.randomUUID(), name: s.name ?? "", arguments: s.arguments ?? {} }));

  return {
    reply: textParts.length > 0 ? textParts.map((p) => p.text).join("") : undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    tokensUsed: typeof body.usage?.total_tokens === "number" ? body.usage.total_tokens : undefined,
    // Every step Gemini returned this turn (thought, function_call, any accompanying
    // text), verbatim — see toInteractionInput's providerState branch for why this must
    // be replayed exactly as received, not reconstructed from toolCalls alone.
    providerState: toolCalls.length > 0 ? steps : undefined,
  };
}

/**
 * Gemini over the Interactions API, with function calling and streaming. The model comes from the
 * call's options, then the config, then the default. Tested against a mocked HTTP layer only; CI
 * never calls the real endpoint.
 */
export class GeminiLlmAdapter implements LlmPort {
  constructor(private readonly config: GeminiAdapterConfig) {}

  async complete(messages: ChatMessage[], tools: ToolSchema[], opts?: ModelOpts): Promise<LlmTurn> {
    const response = await this.post(messages, tools, opts, false);
    const body = (await response.json()) as InteractionResponseBody;
    return parseInteractionResponse(body);
  }

  /**
   * Streams the same request as `complete`. Steps arrive as start, deltas and stop events; they are
   * reassembled into exactly the `steps` a non-streamed response carries (thought signature, function
   * call id, name and parsed arguments), so the finished turn, and the providerState replayed on the
   * tool loop's next round, are the same either way. Only text inside a model_output step is yielded
   * as it arrives.
   */
  async *stream(messages: ChatMessage[], tools: ToolSchema[], opts?: ModelOpts): AsyncGenerator<LlmStreamEvent> {
    const response = await this.post(messages, tools, opts, true);
    if (!response.body) throw new LlmProviderError("Gemini API stream had no body", 502);

    const steps: InteractionStep[] = [];
    const argumentText = new Map<number, string>();
    let usage: InteractionResponseBody["usage"];
    let completed = false;

    for await (const event of readServerSentEvents(response.body)) {
      if (event.event_type === "step.start" && typeof event.index === "number" && event.step) {
        steps[event.index] = event.step.type === "model_output" ? { ...event.step, content: [] } : { ...event.step };
      } else if (event.event_type === "step.delta" && typeof event.index === "number" && event.delta) {
        const step = steps[event.index];
        if (!step) continue;
        const delta = event.delta;
        if (delta.type === "text" && typeof delta.text === "string") {
          step.content = [{ type: "text", text: (step.content?.[0]?.text ?? "") + delta.text }];
          yield { type: "text", text: delta.text };
        } else if (delta.type === "thought_signature" && typeof delta.signature === "string") {
          step.signature = delta.signature;
        } else if (delta.type === "arguments_delta" && typeof delta.arguments === "string") {
          argumentText.set(event.index, (argumentText.get(event.index) ?? "") + delta.arguments);
        }
      } else if (event.event_type === "step.stop" && typeof event.index === "number") {
        const text = argumentText.get(event.index);
        const step = steps[event.index];
        if (step && text) step.arguments = JSON.parse(text) as Record<string, unknown>;
      } else if (event.event_type === "interaction.completed") {
        usage = event.interaction?.usage;
        completed = true;
      } else if (event.event_type === "error") {
        const code = event.error?.code ?? "";
        throw new LlmProviderError(`Gemini API stream failed (${code}): ${event.error?.message ?? ""}`, STREAM_ERROR_STATUS[code] ?? 502);
      }
    }

    // A connection that closes before the completion event is a failed turn, not a short reply.
    if (!completed) throw new LlmProviderError("Gemini API stream ended before the interaction completed", 502);
    yield { type: "done", turn: parseInteractionResponse({ steps: steps.filter(Boolean), usage }) };
  }

  private async post(messages: ChatMessage[], tools: ToolSchema[], opts: ModelOpts | undefined, stream: boolean): Promise<Response> {
    // "||" not "??": an empty model name saved from a blank form field must fall through to the
    // default too, not be sent to the API verbatim.
    const model = opts?.model || this.config.model || DEFAULT_MODEL;
    const baseUrl = this.config.baseUrl ?? DEFAULT_BASE_URL;
    const { systemInstruction, input } = toInteractionInput(messages);

    // Gemini 3.5 dropped temperature, top_p and top_k in favour of thinking_level under
    // generation_config, so opts.temperature is deliberately not forwarded.
    const response = await fetch(`${baseUrl}/v1beta/interactions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.config.apiKey,
        "api-revision": API_REVISION,
      },
      body: JSON.stringify({
        model,
        input,
        store: false,
        ...(stream ? { stream: true } : {}),
        ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
        ...(tools.length > 0 ? { tools: toInteractionTools(tools) } : {}),
        ...(opts?.thinkingLevel ? { generation_config: { thinking_level: opts.thinkingLevel } } : {}),
        ...(opts?.responseSchema
          ? { response_format: { type: "text", mime_type: "application/json", schema: opts.responseSchema } }
          : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new LlmProviderError(`Gemini API request failed (${response.status}): ${detail}`, response.status);
    }
    return response;
  }
}

// An `error` event mid-stream names a code, not an HTTP status; mapped so a caller answers a
// transient failure the way it answers the same failure before the stream started.
const STREAM_ERROR_STATUS: Record<string, number> = {
  resource_exhausted: 429,
  service_unavailable: 503,
  gateway_timeout: 504,
  deadline_exceeded: 504,
};

interface InteractionStreamEvent {
  event_type?: string;
  index?: number;
  step?: InteractionStep;
  delta?: { type?: string; text?: string; signature?: string; arguments?: string };
  interaction?: { usage?: { total_tokens?: number } };
  error?: { code?: string; message?: string };
}

/** Server-sent events: blocks separated by a blank line, the payload on `data:` lines, `[DONE]` last. */
async function* readServerSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<InteractionStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = done ? "" : (blocks.pop() ?? "");
    for (const block of blocks) {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") continue;
      yield JSON.parse(data) as InteractionStreamEvent;
    }
    if (done) return;
  }
}
