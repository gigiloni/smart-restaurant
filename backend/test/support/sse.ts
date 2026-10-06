import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import type { Json } from './http.js';

export interface SseMessage {
  event?: string;
  id?: string;
  retry?: string;
  data?: Json;
}

export interface SseStream {
  status: number;
  headers: Headers;
  /** Every message received so far; heartbeat comments are left out. */
  messages: SseMessage[];
  /** True once the server has closed the stream. */
  readonly ended: boolean;
  /** Resolves once `predicate` holds for the messages so far; rejects on timeout or if the stream ends first. */
  waitFor(predicate: (messages: SseMessage[]) => boolean, timeoutMs?: number): Promise<SseMessage[]>;
  /** Resolves once the server has closed the stream; rejects on timeout. */
  closed(timeoutMs?: number): Promise<SseMessage[]>;
  close(): void;
}

/**
 * Opens the live stream on a listening app and reads it in the background.
 * Wait for `ready` before changing anything the test expects to see live: a
 * change made earlier arrives as backlog instead, before `ready`.
 */
export async function openSse(
  app: NestFastifyApplication,
  path: string,
  headers: Record<string, string> = {},
): Promise<SseStream> {
  const abort = new AbortController();
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const response = await fetch(base + path, {
    headers: { accept: 'text/event-stream', ...headers },
    signal: abort.signal,
  });

  const messages: SseMessage[] = [];
  const waiters = new Set<() => void>();
  let ended = response.status !== 200;
  const wake = () => waiters.forEach((waiter) => waiter());

  if (!ended) {
    if (!response.body) {
      throw new Error(`${path} answered without a body`);
    }

    void read(response.body, messages, wake).then(
      () => {
        ended = true;
        wake();
      },
      () => {
        ended = true;
        wake();
      },
    );
  }

  const waitUntil = (done: () => boolean, failIfEnded: boolean, timeoutMs: number) =>
    new Promise<SseMessage[]>((resolve, reject) => {
      const check = () => {
        if (done()) {
          finish();
          resolve(messages);
        } else if (failIfEnded && ended) {
          finish();
          reject(new Error(`Stream ended first. Received: ${JSON.stringify(messages.map((m) => m.event))}`));
        }
      };
      const timer = setTimeout(() => {
        finish();
        reject(new Error(`Timed out. Received: ${JSON.stringify(messages.map((m) => m.event))}`));
      }, timeoutMs);
      const finish = () => {
        clearTimeout(timer);
        waiters.delete(check);
      };

      waiters.add(check);
      check();
    });

  return {
    status: response.status,
    headers: response.headers,
    messages,
    get ended() {
      return ended;
    },
    waitFor: (predicate, timeoutMs = 8_000) => waitUntil(() => predicate(messages), true, timeoutMs),
    closed: (timeoutMs = 8_000) => waitUntil(() => ended, false, timeoutMs),
    close: () => abort.abort(),
  };
}

async function read(body: ReadableStream<Uint8Array>, messages: SseMessage[], wake: () => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();

    if (done) return;

    buffer += decoder.decode(value, { stream: true });

    for (let end = buffer.indexOf('\n\n'); end !== -1; end = buffer.indexOf('\n\n')) {
      const message = parseBlock(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);

      if (message) {
        messages.push(message);
      }
    }

    wake();
  }
}

function parseBlock(block: string): SseMessage | null {
  const message: SseMessage = {};

  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');

    if (field === 'data') message.data = JSON.parse(value);
    else if (field === 'event' || field === 'id' || field === 'retry') message[field] = value;
  }

  return Object.keys(message).length ? message : null;
}

export const isReady = (messages: SseMessage[]) => messages.some((m) => m.event === 'ready');
export const has = (event: string) => (messages: SseMessage[]) => messages.some((m) => m.event === event);
export const eventsOf = (messages: SseMessage[]) => messages.map((m) => m.event);
