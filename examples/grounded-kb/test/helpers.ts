export { InMemoryChatStore } from '@haeckmec/grounded-chat';

/** Parses a finished server-sent event body, the way the widget reads it. */
export async function readServerSentEventsFromText(text: string): Promise<Array<{ event: string; data: unknown }>> {
  const { readServerSentEvents } = await import('@haeckmec/grounded-chat/client');
  const events: Array<{ event: string; data: unknown }> = [];
  for await (const event of readServerSentEvents(new Response(text).body!)) events.push(event);
  return events;
}
