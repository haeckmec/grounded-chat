import {
  runTurn,
  runJudge,
  scoreReply,
  type ChatStore,
  type LlmPort,
} from '@haeckmec/grounded-chat';
import {
  createConfigHandlers,
  createPruneHandler,
  createStatsHandler,
  createTranscriptHandler,
  findSecretShapedKeys,
  type Authorize,
  type ConfigStore,
  type ConfigValidator,
} from '@haeckmec/grounded-chat/admin';
import { createFixedWindowRateLimiter, guardPublicRequest } from '@haeckmec/grounded-chat/http';
import { CANARIES, KB_JUDGE, KB_PLAN, kbFacts, kbPack, type RecipeSnapshot } from './pack.js';

export interface KbServerOptions {
  llm: LlmPort;
  store: ChatStore<RecipeSnapshot>;
  configStore: ConfigStore;
  /** The host's admin check; the admin handlers refuse without it. */
  authorize: Authorize;
  /** A model that grades every reply for the red-team tally; no grading when absent. */
  judge?: LlmPort;
  originAllowlist?: string[];
}

// Any object without secret-shaped keys: the example keeps its config free-form.
const noSecrets: ConfigValidator = {
  safeParse: (value) => {
    const issues = findSecretShapedKeys(value);
    return issues.length === 0 && value && typeof value === 'object' ? { success: true, data: value } : { success: false, error: { issues } };
  },
};

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * The example's whole server as Web handlers: the streaming chat endpoint and the admin endpoints.
 * Mount them on any framework that speaks `Request` and `Response`.
 */
export function createKbServer(options: KbServerOptions) {
  const limiter = createFixedWindowRateLimiter({ windowMs: 60_000, maxRequests: 20 });
  const tally = { attempts: 0, held: 0, leaked: 0, leakedPrompt: 0, unverifiedAsFact: 0, failures: 0 };

  async function chat(request: Request): Promise<Response> {
    const denied = guardPublicRequest(request, limiter, options.originAllowlist ?? []);
    if (denied) return denied;
    const body = (await request.json().catch(() => null)) as { sessionId?: string; message?: string } | null;
    if (!body?.message) return Response.json({ error: 'A non-empty "message" is required.' }, { status: 400 });
    const sessionId = body.sessionId ?? (await options.store.createSession(request.headers.get('origin'))).id;
    if (!(await options.store.getSession(sessionId))) return Response.json({ error: 'Unknown session id.' }, { status: 404 });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const pack = kbPack();
          pack.afterToolRound = (snapshots) => {
            const last = snapshots.at(-1);
            if (last) controller.enqueue(sse('recipe', { recipe: last }));
          };
          const result = await runTurn({
            llm: options.llm,
            store: options.store,
            pack,
            sessionId,
            userMessage: body.message!,
            onDelta: (text) => controller.enqueue(sse('delta', { text })),
          });
          const asking = KB_PLAN.slots.find((slot) => slot.askHint === result.reply);
          controller.enqueue(sse('done', { sessionId, reply: result.reply, suggestedReplies: asking?.quickReplies }));
          if (!result.capped) await score(body.message!, result.reply, result.guard);
        } catch (error) {
          const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
          controller.enqueue(sse('error', { status }));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' } });
  }

  async function score(userMessage: string, reply: string, guard: Parameters<typeof scoreReply>[0]['guard']) {
    const verdicts = options.judge ? await runJudge(options.judge, KB_JUDGE, { facts: kbFacts(), userMessage, reply }) : null;
    const scored = scoreReply({ reply, guard, verdicts, verdictNames: KB_JUDGE.verdicts.map((v) => v.name), canaries: CANARIES, figureClass: kbPack().figureClass });
    tally.attempts++;
    if (scored.outcome === 'held') tally.held++;
    if (scored.outcome === 'leaked') tally.leaked++;
    if (scored.leakedPrompt) tally.leakedPrompt++;
    if (scored.verdicts.unverifiedAsFact) tally.unverifiedAsFact++;
    if (scored.failed) tally.failures++;
  }

  const config = createConfigHandlers({
    authorize: options.authorize,
    store: options.configStore,
    validators: { conversation: noSecrets, model: noSecrets, complianceTheme: noSecrets },
  });

  return {
    chat,
    config,
    transcript: createTranscriptHandler({ authorize: options.authorize, store: options.store }),
    prune: createPruneHandler({
      authorize: options.authorize,
      store: options.store,
      retentionDays: async () => ((await options.configStore.getRow('complianceTheme'))?.value as { retentionDays?: number } | undefined)?.retentionDays,
    }),
    // The tally is public, like the red-team page that shows it.
    stats: createStatsHandler({ authorize: () => true, stats: async () => ({ ...tally }) }),
  };
}

export type KbServer = ReturnType<typeof createKbServer>;

/**
 * Routes a request to the right handler by path, so a test or a tiny host can serve everything
 * through one `fetch`-shaped function.
 */
export function kbRouter(server: KbServer): (request: Request) => Promise<Response> {
  return async (request) => {
    const path = new URL(request.url).pathname;
    if (path === '/api/chat' && request.method === 'POST') return server.chat(request);
    if (path === '/api/playground/stats') return server.stats(request);
    if (path === '/api/admin/prune' && request.method === 'POST') return server.prune(request);
    const config = /^\/api\/admin\/config\/([^/]+)$/.exec(path);
    if (config) return request.method === 'PUT' ? server.config.PUT(request, config[1]!) : server.config.GET(request, config[1]!);
    const transcript = /^\/api\/admin\/sessions\/([^/]+)\/messages$/.exec(path);
    if (transcript) return server.transcript(request, transcript[1]!);
    return Response.json({ error: 'Not found.' }, { status: 404 });
  };
}
