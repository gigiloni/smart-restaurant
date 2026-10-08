import { describe, expect, it } from 'vitest';

import { useTestApp } from './support/context.js';
import { PASSWORD } from './support/fixtures.js';
import { api, cookiesOf } from './support/http.js';

const t = useTestApp();

const NEW_PASSWORD = 'another correct horse battery';
// Browsers send Origin with every POST, and Better Auth refuses session requests without a trusted one.
const FROM_FRONTEND = { origin: 'http://localhost:4200' };

describe('I-AUTH login routes', () => {
  it('01 reports the session of a signed-in caller, and null otherwise', async () => {
    const waiter = await t.fixtures.staff('SERVICE');

    const signedIn = await waiter.api.get('/api/auth/get-session');
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.user.email).toMatch(/@test\.local$/);

    const anonymous = await t.http.get('/api/auth/get-session');
    expect(anonymous.status).toBe(200);
    expect(anonymous.body).toBeNull();
  });

  it('02 changes the password: the old one stops working, the new one works', async () => {
    const { email } = await t.fixtures.employee('BAR');
    const cookie = await t.fixtures.signIn(email);

    const changed = await api(t.app, cookie).post(
      '/api/auth/change-password',
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      FROM_FRONTEND,
    );

    expect(changed.status).toBe(200);
    expect((await t.http.post('/api/auth/sign-in/email', { email, password: PASSWORD })).status).toBe(401);
    expect((await t.http.post('/api/auth/sign-in/email', { email, password: NEW_PASSWORD })).status).toBe(200);
  });

  it('03 refuses a password change with the wrong current password', async () => {
    const { email } = await t.fixtures.employee('BAR');
    const cookie = await t.fixtures.signIn(email);

    const changed = await api(t.app, cookie).post(
      '/api/auth/change-password',
      { currentPassword: 'not the password', newPassword: NEW_PASSWORD },
      FROM_FRONTEND,
    );

    expect(changed.status).toBe(400);
    expect((await t.http.post('/api/auth/sign-in/email', { email, password: PASSWORD })).status).toBe(200);
  });

  it('04 refuses a signed-in request from a foreign origin', async () => {
    const { email } = await t.fixtures.employee('SERVICE');
    const cookie = await t.fixtures.signIn(email);
    const change = (origin: string) =>
      api(t.app, cookie).post(
        '/api/auth/change-password',
        { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
        { origin },
      );

    // Better Auth checks the origin of requests that carry a session: those are
    // what a forged cross-site request would abuse. No Origin at all is refused too.
    expect((await change('http://evil.test')).status).toBe(403);
    expect(
      (await api(t.app, cookie).post('/api/auth/change-password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }))
        .status,
    ).toBe(403);
    expect((await t.http.post('/api/auth/sign-in/email', { email, password: PASSWORD })).status).toBe(200);

    const fromFrontend = await change('http://localhost:4200');
    expect(fromFrontend.status).toBe(200);
  });

  it('04b signs in from the frontend origin with a session cookie', async () => {
    const { email } = await t.fixtures.employee('SERVICE');

    const response = await t.http.post(
      '/api/auth/sign-in/email',
      { email, password: PASSWORD },
      { origin: 'http://localhost:4200' },
    );

    expect(response.status).toBe(200);
    expect(cookiesOf(response)).toContain('better-auth.session_token=');
  });

  it('05 exposes only the documented auth routes', async () => {
    expect((await t.http.post('/api/auth/sign-up/email', { email: 'x@test.local', password: PASSWORD, name: 'X' })).status).toBe(404);
    expect((await t.http.get('/api/auth/list-sessions')).status).toBe(404);
    expect((await t.http.post('/api/auth/sign-in/email', {})).status).not.toBe(404);
  });
});
