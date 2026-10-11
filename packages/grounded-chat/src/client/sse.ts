/** One server-sent event: its name and its parsed JSON payload. */
export interface ServerSentEvent {
  event: string;
  data: unknown;
}

/**
 * Reads a server-sent event stream: blocks separated by a blank line, a named `event:` line and a
 * JSON `data:` line each. A block split across network chunks is held until its blank line arrives.
 */
export async function* readServerSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = done ? '' : (blocks.pop() ?? '');
    for (const block of blocks) {
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (data.length > 0) yield { event, data: JSON.parse(data.join('\n')) };
    }
    if (done) return;
  }
}
