import type { ChatStore } from '../store/port.js';
import type { ConfigStore } from './config-store.js';

/**
 * The host's decision whether a request may use an admin handler. Every handler refuses unless it
 * returns true: a host that forgets to wire its auth gets 401s, never an open admin.
 */
export type Authorize = (request: Request) => boolean | Promise<boolean>;

/** A validator in the shape of zod's `safeParse`, so any schema library or a hand-written check fits. */
export interface ConfigValidator {
  safeParse(value: unknown): { success: true; data: unknown } | { success: false; error: { issues: unknown[] } };
}

async function refuse(request: Request, authorize: Authorize | undefined): Promise<Response | null> {
  let allowed = false;
  try {
    allowed = typeof authorize === 'function' && (await authorize(request)) === true;
  } catch {
    allowed = false;
  }
  return allowed ? null : Response.json({ error: 'Not authorized.' }, { status: 401 });
}

/**
 * GET and PUT for config rows by key. GET answers the value and its ETag. PUT validates with the
 * key's validator and, when the request carries If-Match, saves only if nobody changed the row
 * since that ETag was read (409 otherwise). A PUT without If-Match saves unconditionally.
 */
export function createConfigHandlers(options: { authorize: Authorize; store: ConfigStore; validators: Record<string, ConfigValidator> }) {
  const known = (key: string) => Object.prototype.hasOwnProperty.call(options.validators, key);
  const unknownKey = (key: string) => Response.json({ error: `Unknown config key "${key}".` }, { status: 404 });
  return {
    async GET(request: Request, key: string): Promise<Response> {
      const denied = await refuse(request, options.authorize);
      if (denied) return denied;
      if (!known(key)) return unknownKey(key);
      const row = await options.store.getRow(key);
      return Response.json({ key, value: row?.value ?? null }, { headers: { etag: row?.updatedAt ?? '' } });
    },
    async PUT(request: Request, key: string): Promise<Response> {
      const denied = await refuse(request, options.authorize);
      if (denied) return denied;
      if (!known(key)) return unknownKey(key);
      const body = await request.json().catch(() => null);
      const parsed = options.validators[key]!.safeParse(body);
      if (!parsed.success) return Response.json({ error: 'Invalid config.', issues: parsed.error.issues }, { status: 400 });
      const ifMatch = request.headers.get('if-match');
      if (ifMatch !== null) {
        const etag = await options.store.setIfUnchanged(key, parsed.data, ifMatch);
        if (etag === null) {
          return Response.json(
            { error: 'This was changed in another tab or by another admin. Reload the page and reapply your change.' },
            { status: 409 },
          );
        }
        return Response.json({ key, value: parsed.data }, { headers: { etag } });
      }
      const etag = await options.store.set(key, parsed.data);
      return Response.json({ key, value: parsed.data }, { headers: { etag } });
    },
  };
}

/**
 * GET one session's transcript. An unknown or pruned session is an empty list, an honest empty
 * state rather than an error.
 */
export function createTranscriptHandler(options: { authorize: Authorize; store: Pick<ChatStore, 'listMessages'> }) {
  return async function GET(request: Request, sessionId: string): Promise<Response> {
    const denied = await refuse(request, options.authorize);
    if (denied) return denied;
    return Response.json({ messages: await options.store.listMessages(sessionId) });
  };
}

/** POST: prunes expired messages now, bypassing the sweep throttle. 400 when no retention is configured. */
export function createPruneHandler(options: {
  authorize: Authorize;
  store: Pick<ChatStore, 'pruneExpiredMessages'>;
  retentionDays: () => Promise<number | undefined> | number | undefined;
}) {
  return async function POST(request: Request): Promise<Response> {
    const denied = await refuse(request, options.authorize);
    if (denied) return denied;
    const days = await options.retentionDays();
    if (!days) return Response.json({ error: 'No retention period is configured.' }, { status: 400 });
    return Response.json({ deleted: await options.store.pruneExpiredMessages(days) });
  };
}

/**
 * GET the red-team tally as JSON, never cached. Deny by default like every handler: a host that
 * wants the tally public passes `authorize: () => true`.
 */
export function createStatsHandler(options: { authorize: Authorize; stats: () => Promise<Record<string, number>> }) {
  return async function GET(request: Request): Promise<Response> {
    const denied = await refuse(request, options.authorize);
    if (denied) return denied;
    return Response.json(await options.stats(), { headers: { 'cache-control': 'no-store' } });
  };
}
