import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import type { Json } from './http.js';

export interface SseMessage {
  event?: string;
  id?: string;
  retry?: string;
  data?: Json;
}

export interface SseResult {
  status: number;
  messages: SseMessage[];
  /** True when the server closed the stream, false when the reader stopped. */
  ended: boolean;
  body?: string;
}

/**
 * Opens the live stream on a listening app and collects messages until `until`
 * is satisfied, the server ends the stream, or `timeoutMs` passes. Comment
 * lines (the heartbeat) are skipped.
 */
export async function readSse(
  app: NestFastifyApplication,
  path: string,
  options: {
    until?: (messages: SseMessage[]) => boolean;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {},
): Promise<SseResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), options.timeoutMs ?? 8_000);
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');

  const response = await fetch(base + path, {
    headers: { accept: 'text/event-stream', ...options.headers },
    signal: abort.signal,
  });

  if (response.status !== 200) {
    clearTimeout(timer);
    return { status: response.status, messages: [], ended: true, body: await response.text() };
  }

  if (!response.body) {
    throw new Error(`${path} answered without a body`);
  }

  const messages: SseMessage[] = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let ended = false;

  try {
    while (!options.until?.(messages)) {
      const { value, done } = await reader.read();

      if (done) {
        ended = true;
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      for (let end = buffer.indexOf('\n\n'); end !== -1; end = buffer.indexOf('\n\n')) {
        const message = parseBlock(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);

        if (message) {
          messages.push(message);
        }
      }
    }
  } catch (error) {
    if (!abort.signal.aborted) throw error;
  } finally {
    clearTimeout(timer);
    abort.abort();
  }

  return { status: response.status, messages, ended };
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

/** Gives a freshly opened stream time to subscribe before the test changes something. */
export const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
