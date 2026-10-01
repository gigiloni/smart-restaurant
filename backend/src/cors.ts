import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE';

/**
 * `Content-Type` for JSON bodies; `Last-Event-ID` because a reconnecting
 * EventSource sends it and it is not a CORS-safelisted header.
 */
const ALLOWED_HEADERS = 'Content-Type, Last-Event-ID';

const PREFLIGHT_MAX_AGE_SECONDS = 600;

/**
 * Lets a frontend served from another origin call the API with its cookies.
 *
 * Only `origins` are allowed, and credentials with them, since every route
 * authenticates by cookie. Other origins get no CORS headers, so the browser
 * withholds the response from them.
 *
 * Written as a hook rather than with `@fastify/cors` because that plugin sets
 * its headers through Fastify's reply, and `@Sse()` routes write straight to
 * the Node.js response: the live stream would lose them. Headers set on
 * `reply.raw` reach both, since Fastify merges them into what it sends.
 */
export function enableCors(app: NestFastifyApplication, origins: string[]): void {
  const allowed = new Set(origins.map((origin) => new URL(origin).origin));

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (request, reply) => {
      // Caches must not serve one origin's response to another.
      reply.raw.setHeader('Vary', 'Origin');

      const origin = request.headers.origin;

      if (!origin || !allowed.has(origin)) {
        return;
      }

      reply.raw.setHeader('Access-Control-Allow-Origin', origin);
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');

      if (request.method === 'OPTIONS' && request.headers['access-control-request-method']) {
        reply.raw.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
        reply.raw.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
        reply.raw.setHeader('Access-Control-Max-Age', String(PREFLIGHT_MAX_AGE_SECONDS));

        return reply.code(204).send();
      }
    });
}
