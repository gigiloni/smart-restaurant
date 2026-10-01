import { describe, expect, it } from 'vitest';

import { useTestApp } from './support/context.js';

const t = useTestApp();

const FRONTEND = 'http://localhost:4200';

describe('I-HTTP cross-cutting behaviour', () => {
  it('01 refuses state-changing requests from foreign origins', async () => {
    expect((await t.http.post('/api/tables', { tableNumber: 1 }, { origin: 'http://evil.test' })).status).toBe(403);
    expect((await t.http.post('/api/tables', { tableNumber: 2 }, { origin: FRONTEND })).status).toBe(201);
    expect((await t.http.get('/api/tables', { origin: 'http://evil.test' })).status).toBe(200);
  });

  it('02 answers CORS preflights for the frontend only', async () => {
    const preflight = await t.http.options('/api/orders', {
      origin: FRONTEND,
      'access-control-request-method': 'POST',
    });

    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(FRONTEND);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
    expect(preflight.headers['access-control-allow-headers']).toContain('Last-Event-ID');

    const foreign = await t.http.get('/api/tables', { origin: 'http://evil.test' });
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
    expect(foreign.headers['vary']).toContain('Origin');
  });

  it('03 documents every route in the OpenAPI document', async () => {
    const response = await t.http.get('/api/docs-json');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/tables',
        '/api/tables/{id}/qr-code',
        '/api/employees/me',
        '/api/products-by-id',
        '/api/orders/{id}/close',
        '/api/orders/{orderId}/items/{id}',
        '/api/table-sessions/{id}/close',
        '/api/live/events',
        '/api/viewer/guest',
        '/api/auth/sign-in/email',
      ]),
    );
  });

  it('04 answers 404 for an unknown route', async () => {
    expect((await t.http.get('/api/nope')).status).toBe(404);
  });

  it('05 answers 400 for malformed JSON', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/tables',
      headers: { 'content-type': 'application/json' },
      payload: '{bad',
    });

    expect(response.statusCode).toBe(400);
  });
});
