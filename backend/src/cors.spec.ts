import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { describe, expect, it, vi } from 'vitest';

import { stub } from '../test/support/unit.js';
import { enableCors } from './cors.js';

type Hook = (request: object, reply: object) => Promise<unknown>;

/** Registers the CORS hook on a fake Fastify instance and returns a way to call it. */
function cors(origins: string[]) {
  let hook: Hook | undefined;
  const app = stub<NestFastifyApplication>({
    getHttpAdapter: () => ({
      getInstance: () => ({ addHook: (_name: string, fn: Hook) => (hook = fn) }),
    }),
  });
  enableCors(app, origins);

  return async (method: string, headers: Record<string, string>) => {
    const raw: Record<string, string> = {};
    const reply = {
      raw: { setHeader: (name: string, value: string) => (raw[name] = value) },
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    if (!hook) throw new Error('enableCors registered no hook');
    await hook({ method, headers }, reply);

    return { headers: raw, reply };
  };
}

const FRONTEND = 'http://localhost:4200';

describe('U-CORS enableCors', () => {
  it('01 allows the configured origin with credentials', async () => {
    const { headers, reply } = await cors([FRONTEND])('GET', { origin: FRONTEND });

    expect(headers).toMatchObject({
      Vary: 'Origin',
      'Access-Control-Allow-Origin': FRONTEND,
      'Access-Control-Allow-Credentials': 'true',
    });
    // A plain request goes on to its route.
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('02 gives other origins no CORS headers, only Vary', async () => {
    for (const origin of ['http://evil.test', 'http://localhost:4201', undefined]) {
      const { headers } = await cors([FRONTEND])('GET', origin ? { origin } : {});

      expect(headers).toEqual({ Vary: 'Origin' });
    }
  });

  it('03 matches by origin, so a configured trailing slash or path does not matter', async () => {
    const { headers } = await cors([`${FRONTEND}/app/`])('GET', { origin: FRONTEND });

    expect(headers['Access-Control-Allow-Origin']).toBe(FRONTEND);
  });

  it('04 answers a preflight itself with 204', async () => {
    const { headers, reply } = await cors([FRONTEND])('OPTIONS', {
      origin: FRONTEND,
      'access-control-request-method': 'PATCH',
    });

    expect(headers).toMatchObject({
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
      'Access-Control-Max-Age': '600',
    });
    expect(reply.code).toHaveBeenCalledWith(204);
    expect(reply.send).toHaveBeenCalledOnce();
  });
});
